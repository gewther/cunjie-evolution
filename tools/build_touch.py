"""Patch touch input only; keep the deployed engines as rollback references."""
from pathlib import Path
import json, subprocess

ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'dist'
patch=(ROOT/'src/touch-vertical.js').read_text()+'\n'+(ROOT/'src/touch-adapter.js').read_text()

def once(s,a,b):
    assert s.count(a)==1,(a[:70],s.count(a))
    return s.replace(a,b,1)

def build(name,out):
    t=(D/'data'/name).read_text();engine=json.loads(t[t.index('=')+1:].rstrip().removesuffix(';'))
    s=engine
    s=once(s,'\t\t\tmy = clamp(my+(tdy-ty)*1.5*xlGfxPrefs.sensitivity, 0, h-1);',
        '\t\t\tif(!window.realmTouchOwnsInput?.()) my = clamp(my+(tdy-ty)*1.5*xlGfxPrefs.sensitivity, 0, h-1);')
    s=once(s,'\t\t\tmx = tdx, my = tdy;', '\t\t\t{mx = tdx;if(!window.realmTouchOwnsInput?.())my = tdy;}')
    a='\tif (exhausted)\n\t\tpaw_dest_y = h*1.3, y_move = paw.exhaust_paw_speed;'
    s=once(s,a,'\tif(realmTouchOwns()&&!exhausted){paw_dest_y=realmTouch.step(delta,paw_y,paw_min_y,floor_y,h);my=paw_dest_y/2;}\n'+a)
    if 'realmImpact.target(delta,paw_dest_y)' in s:
        s=once(s,'if(realmImpact.enabled()) paw_dest_y=realmImpact.target(delta,paw_dest_y);',
            'if(realmImpact.enabled()){const touchDest=paw_dest_y;paw_dest_y=realmImpact.target(delta,paw_dest_y);if(realmTouchOwns()){paw_dest_y=touchDest;realmImpact.pressure=realmTouch.pressure;}}')
    s=once(s,'\tpaw_y_diff = paw_y_velo * delta;', '\tif(realmTouchOwns()&&!exhausted) paw_y_velo=realmTouch.velocity;\n\tpaw_y_diff = paw_y_velo * delta;')
    s=once(s,'\t\t\tstomp_size = paw_y_diff*paw.strength;', '\t\t\tif(realmTouchOwns())realmTouch.landing(paw_y_velo);\n\t\t\tstomp_size = paw_y_diff*paw.strength;')
    # Explicit buttons/keyboard relinquish only the touch-owned target.
    a="action:kind=>{if(!active){moncanvas=true;mr=true;return;}"
    if a in s:s=once(s,a,"action:kind=>{realmTouchDisown();if(!active){moncanvas=true;mr=true;return;}")
    if 'const realmImpact=' in s:
        a='const strength=Math.max(.2,Math.min(1,.3+pressure*.6+(dead?.1:0)));'
        s=once(s,a,'const strength=realmTouchOwns()?Math.max(.08,Math.min(1,.08+pressure*.6+realmTouch.lastContactSpeed/200+(dead?.1:0))):Math.max(.2,Math.min(1,.3+pressure*.6+(dead?.1:0)));')
        s=once(s,"this.accent('hit',.43,.86+(this.hits%3)*.045);", "this.accent('hit',realmTouchOwns()?.10+.33*Math.min(1,realmTouch.lastContactSpeed/130):.43,.86+(this.hits%3)*.045);")
    s=once(s,'ptime = performance.now();\nmainloop();',patch+'\nptime = performance.now();\nmainloop();')
    key='freeLegacy' if 'free' in name.lower() else 'storyLegacy'
    (D/'data'/out).write_text('DATA['+json.dumps(key)+']='+json.dumps(s,ensure_ascii=False).replace('<','\\u003c')+';\n')
    # Check the real inner engine script, rather than only the JSON wrapper.
    start=s.index('<script>')+8;end=s.rfind('</script>')
    assert end>start
    r=subprocess.run(['node','--check'],input=s[start:end],text=True,capture_output=True)
    assert r.returncode==0,r.stderr[:2000]

build('07-storyLegacy.js','touch-v1-story.js')
build('07-story-impact.js','touch-v1-impact.js')
build('06-freeLegacy.js','touch-v1-free.js')
for source,out in [('host-1.js','touch-v1-host-1.js'),('impact-host-1.js','touch-v1-impact-host-1.js')]:
    s=(D/'scripts'/source).read_text()
    s=once(s,'let force=clamp(.35+state.pressure*.55,0.24,1);',
        'let force=s.manualTouch?.enabled?clamp(.08+(s.manualTouch.contactSpeed||0)/160,.08,1):clamp(.35+state.pressure*.55,0.24,1);')
    (D/'scripts'/out).write_text(s)

def page(source,preview,impact=False):
    s=(D/source).read_text()
    replacements={'data/06-freeLegacy.js':'data/touch-v1-free.js',
        'data/07-storyLegacy.js':'data/touch-v1-story.js',
        'data/07-story-impact.js':'data/touch-v1-impact.js',
        'scripts/host-1.js':'scripts/touch-v1-host-1.js',
        'scripts/impact-host-1.js':'scripts/touch-v1-impact-host-1.js'}
    for a,b in replacements.items():s=s.replace(a,b)
    (D/preview).write_text(s)
page('index.html','touch-baseline-preview.html')
page('impact.html','touch-preview.html',True)
print('Built independent touch previews; production HTML has not been changed.')
