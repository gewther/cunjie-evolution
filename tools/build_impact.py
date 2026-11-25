"""Build an isolated AJ6 first-act candidate from the retained v5.9 baseline."""
from pathlib import Path
import json, re, subprocess, hashlib

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'

def js_value(path):
    text = path.read_text()
    return json.loads(text[text.index('=') + 1:].rstrip().removesuffix(';'))

story = js_value(DIST / 'data/07-storyLegacy.js')
rects = json.loads((DIST / 'assets/impact/atlas.json').read_text())['rects']
patch = (ROOT / 'src/impact-pass.js').read_text().replace('__IMPACT_RECTS__', json.dumps(rects))
anchor = '\tif (exhausted)\n\t\tpaw_dest_y = h*1.3, y_move = paw.exhaust_paw_speed;'
assert story.count(anchor) == 1
story = story.replace(anchor, '\tif(realmImpact.enabled()) paw_dest_y=realmImpact.target(delta,paw_dest_y);\n' + anchor)
anchor = '\tpaw_y_diff = paw_y_velo * delta;'
assert story.count(anchor) == 1
story = story.replace(anchor, '\tif(realmImpact.enabled()&&!exhausted) paw_y_velo=realmImpact.velocity(delta,paw_y_velo);\n' + anchor)
anchor = 'ptime = performance.now();\nmainloop();'
assert story.count(anchor) == 1
story = story.replace(anchor, patch + '\n' + anchor)
payload = json.dumps(story, ensure_ascii=False).replace('<', '\\u003c')
(DIST / 'data/07-story-impact.js').write_text('DATA["storyLegacy"]=' + payload + ';\n')

host1 = (DIST / 'scripts/host-1.js').read_text()
host1 = host1.replace("this.key='cunjie-stomp-v41'", "this.key='cunjie-stomp-impact-v1'")
(DIST / 'scripts/impact-host-1.js').write_text(host1)
host3 = (DIST / 'scripts/host-3.js').read_text()
anchor = 'footAudio.observe(manager.stage,lastStageSnapshot,activeShoeSkin,save.data.prefs);'
assert host3.count(anchor) == 1
host3 = host3.replace(anchor, 'if(!lastStageSnapshot.aftermath?.impact) ' + anchor)
# Disable the neon host halo for the candidate; contact art is in world space.
host3 = host3.replace('impactFeedback.observe(now,manager.stage,lastStageSnapshot,save.data.prefs);',
    'impactFeedback.observe(now,manager.stage,lastStageSnapshot,{...save.data.prefs,impactFx:lastStageSnapshot.aftermath?.impact?false:save.data.prefs.impactFx});')
host3 += "\n document.getElementById('shoeAJ6')?.click();\n"
(DIST / 'scripts/impact-host-3.js').write_text(host3)

html = (DIST / 'index.html').read_text()
html = html.replace('data/07-storyLegacy.js', 'data/07-story-impact.js').replace('scripts/host-1.js','scripts/impact-host-1.js').replace('scripts/host-3.js','scripts/impact-host-3.js')
html = html.replace('<title>寸界 v5.8.2 · CG-02 动作精修</title>', '<title>寸界 · AJ6 命中反馈候选版</title>')
html = html.replace('PROJECT 寸界 / v5.9.0 Gameplay Clarity', 'PROJECT 寸界 / AJ6 · IMPACT FEEL V1')
html = html.replace('同一间卧室，越往后，足下的世界越渺小；每次逃生都可能产生新的抉择。',
    'AJ6 第一幕：渐进施压 · 新接触材质 · 命中音效分层。<br><a href="/" style="color:var(--teal)">打开迁移原版对照 ↗</a>')
(DIST / 'impact.html').write_text(html)

# The gallery displays the exact runtime atlas, not a simulated game screenshot.
(DIST / 'impact-art.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>寸界 · 新素材</title><style>body{margin:24px;background:#243039;color:#eee;font:16px system-ui}img{display:block;width:min(95vw,1000px);background:#657078;border-radius:12px}a{color:#a9d9d5}</style><h1>AJ6 命中反馈 · 新素材</h1><p>真实透明图集：接触压印 / 鞋底附着 / 拉伸断裂 / 非露骨目标状态。此页是素材展示，并非实机截图。</p><p><a href="/impact.html">进入游戏候选版</a> · <a href="/">迁移原版</a></p><img src="assets/impact/impact-atlas-v1.png" alt="16 格新美术素材">''')
for path in [DIST/'data/07-story-impact.js',DIST/'scripts/impact-host-1.js',DIST/'scripts/impact-host-3.js']:
    subprocess.run(['node','--check',str(path)],check=True)
print(json.dumps({'candidate':'impact.html','baseline_index_sha256':hashlib.sha256((DIST/'index.html').read_bytes()).hexdigest(),'atlas_sha256':hashlib.sha256((DIST/'assets/impact/impact-atlas-v1.png').read_bytes()).hexdigest()},indent=2))
