"""Fix WebGL rectangular texture UVs, multi-outfit sole grounding, shadow/floor layer order, and stage camera framing."""
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")


def load_data(path):
    raw = open(path, "r", encoding="utf-8").read()
    eq = raw.index("=")
    return raw[: eq + 1], json.loads(raw[eq + 1 :].strip().rstrip(";"))


def save_data(path, prefix, html):
    for m in re.finditer(r"<script[^>]*>([\s\S]*?)</script>", html):
        res = subprocess.run(["node", "--check"], input=m.group(1), text=True, capture_output=True)
        if res.returncode != 0:
            raise RuntimeError(f"Syntax error in {os.path.basename(path)}: {res.stderr}")
    payload = json.dumps(html, ensure_ascii=False).replace("<", "\\u003c")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"{prefix}{payload};\n")


def replace_once(text, old, new, label):
    cnt = text.count(old)
    if cnt != 1:
        raise RuntimeError(f"Expected 1 match for {label}, found {cnt}")
    return text.replace(old, new, 1)


RENDERER_2D_OLD = """ const textures=new Map();let current=null;
 function new_texture(bitmap){return {bitmap,size:bitmap.width};}
 function set_texture(t){current=t;}
 function clear(r,g,b,a){ctx.globalAlpha=1;ctx.fillStyle=`rgba(${r},${g},${b},${a/255})`;ctx.fillRect(0,0,c.width,c.height);}
 function render(){renders++;}
 function quad(x,y,ww,hh,ux,uy,uw,uh){
  if(!current||!ww||!hh)return;
  uw=uw||ww;uh=uh||hh;x=floor(x);y=floor(y);
  ctx.save();ctx.globalAlpha=clamp(alpha,0,1);
  if(hflip){ctx.translate(x+ww,y);ctx.scale(-1,1);x=0;y=0;}
  ctx.drawImage(current.bitmap,ux,uy,uw,uh,x,y,ww,hh);ctx.restore();
 }
 return {textures,new_texture,set_texture,clear,render,quad};"""

RENDERER_2D_NEW = """ const textures=new Map();let current=null;
 function new_texture(bitmap){const w=bitmap.width||bitmap.naturalWidth||1,h=bitmap.height||bitmap.naturalHeight||1;return {bitmap,size:w,w,h,smooth:false};}
 function new_raw_tex(w,h,rgbaPremul,rgbaStraight){
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const c2=cv.getContext('2d');const id=c2.createImageData(w,h);id.data.set(rgbaStraight);c2.putImageData(id,0,0);
  return {bitmap:cv,size:w,w,h,smooth:true};
 }
 function set_texture(t){current=t;}
 function clear(r,g,b,a){ctx.globalAlpha=1;ctx.fillStyle=`rgba(${r},${g},${b},${a/255})`;ctx.fillRect(0,0,c.width,c.height);}
 function render(){renders++;}
 function quad(x,y,ww,hh,ux,uy,uw,uh){
  if(!current||!ww||!hh)return;
  uw=uw||ww;uh=uh||hh;x=floor(x);y=floor(y);
  ctx.save();ctx.imageSmoothingEnabled=!!current.smooth;ctx.globalAlpha=clamp(alpha,0,1);
  if(hflip){ctx.translate(x+ww,y);ctx.scale(-1,1);x=0;y=0;}
  ctx.drawImage(current.bitmap,ux,uy,uw,uh,x,y,ww,hh);ctx.restore();
 }
 return {textures,new_texture,new_raw_tex,set_texture,clear,render,quad};"""

VERT_SHADER_OLD = """\tuniform vec2 u_screen_size;
\tuniform float u_texture_size;
\tvoid main() {
\t\tv_uv = floor(a_uv)/u_texture_size;
\t\tv_alpha = a_alpha;
\t\tgl_Position = vec4(vec2(-1.0,1.0)+(floor(a_pos)*u_screen_size),0.0,1.0);
\t}"""

VERT_SHADER_NEW = """\tuniform vec2 u_screen_size;
\tuniform vec2 u_texture_size;
\tvoid main() {
\t\tv_uv = a_uv/u_texture_size;
\t\tv_alpha = a_alpha;
\t\tgl_Position = vec4(vec2(-1.0,1.0)+(floor(a_pos)*u_screen_size),0.0,1.0);
\t}"""

WEBGL_TEX_OLD = """const textures = new Map();
function new_texture(bitmap) {
\tconst gltex = gl.createTexture();
\tgl.bindTexture(gl.TEXTURE_2D, gltex);
\tgl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
\treturn { size: bitmap.width, gltex: gltex };
}

var texture = null;
function set_texture(to) {
\tif (texture == to)
\t\treturn;
\trender();
\ttexture = to;
\tgl.bindTexture(gl.TEXTURE_2D, to.gltex);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

var inds = 0, verts = 0, vertidx = 0;
function clear(r, g, b, a) {
\tgl.clearColor(r/255, g/255, b/255, a/255);
\tgl.clear(gl.COLOR_BUFFER_BIT);
}


function render() {
\tif (inds == 0)
\t\treturn;
\tgl.uniform1i(u_texture, 0);
\tgl.uniform2f(u_screen_size, 2/w, -2/h);
\tgl.uniform1f(u_texture_size, texture.size);
\tgl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(vbuf, 0, vertidx));
\tgl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(ibuf, 0, inds));
\tgl.drawElements(gl.TRIANGLES, inds, gl.UNSIGNED_SHORT, 0);
\tinds = 0, verts = 0, vertidx = 0;
\trenders++;
}"""

WEBGL_TEX_NEW = """const textures = new Map();
function new_texture(bitmap) {
\tconst gltex = gl.createTexture();
\tgl.bindTexture(gl.TEXTURE_2D, gltex);
\tgl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
\tgl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
\tconst bw = bitmap.width || bitmap.naturalWidth || 1, bh = bitmap.height || bitmap.naturalHeight || 1;
\treturn { size: bw, w: bw, h: bh, gltex: gltex, smooth: false };
}
function new_raw_tex(tw, th, rgbaPremul, rgbaStraight) {
\tconst gltex = gl.createTexture();
\tgl.bindTexture(gl.TEXTURE_2D, gltex);
\tgl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
\tgl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgbaPremul);
\treturn { size: tw, w: tw, h: th, gltex: gltex, smooth: true };
}

var texture = null;
function set_texture(to) {
\tif (texture == to)
\t\treturn;
\trender();
\ttexture = to;
\tgl.bindTexture(gl.TEXTURE_2D, to.gltex);
\tconst flt = to.smooth ? gl.LINEAR : gl.NEAREST;
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

var inds = 0, verts = 0, vertidx = 0;
function clear(r, g, b, a) {
\tgl.clearColor(r/255, g/255, b/255, a/255);
\tgl.clear(gl.COLOR_BUFFER_BIT);
}


function render() {
\tif (inds == 0)
\t\treturn;
\tgl.uniform1i(u_texture, 0);
\tgl.uniform2f(u_screen_size, 2/w, -2/h);
\tgl.uniform2f(u_texture_size, texture.w || texture.size || 1, texture.h || texture.size || 1);
\tgl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(vbuf, 0, vertidx));
\tgl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(ibuf, 0, inds));
\tgl.drawElements(gl.TRIANGLES, inds, gl.UNSIGNED_SHORT, 0);
\tinds = 0, verts = 0, vertidx = 0;
\trenders++;
}"""

RETURN_RENDERER_OLD = "return {textures,new_texture,set_texture,clear,render,quad};\n}\nconst {textures,new_texture,set_texture,clear,render,quad}=installRealmRenderer();"
RETURN_RENDERER_NEW = "return {textures,new_texture,new_raw_tex,set_texture,clear,render,quad};\n}\nconst {textures,new_texture,new_raw_tex,set_texture,clear,render,quad}=installRealmRenderer();"
DONE_LOADING_OLD = "function done_loading() {\nvar xlRuntime=null;"

XL_FLOOR_BLOCK = """const XL_SKIN_GEO={
 aj5:{frontOffsets:[2,2,2,2,2,2],backOffsets:[2,2,3,1,2],frontContact:[[0.33,0.30],[0.71,0.20],[0.72,0.22],[0.49,0.45],[0.50,0.48],[0.50,0.48]],backContact:[[0.50,0.45],[0.42,0.36],[0.32,0.18],[0.32,0.24],[0.32,0.18]]},
 aj6:{frontOffsets:[4,2,2,4,4,4],backOffsets:[10,10,4,8,9],frontContact:[[0.48,0.44],[0.70,0.20],[0.72,0.20],[0.49,0.47],[0.48,0.46],[0.49,0.47]],backContact:[[0.50,0.42],[0.41,0.33],[0.32,0.23],[0.33,0.22],[0.30,0.19]]},
 qiaodan:{frontOffsets:[3,3,3,3,7,7],backOffsets:[2,2,2,3,2],frontContact:[[0.34,0.29],[0.68,0.17],[0.70,0.18],[0.50,0.46],[0.50,0.47],[0.50,0.48]],backContact:[[0.28,0.24],[0.34,0.31],[0.47,0.43],[0.49,0.46],[0.50,0.46]]},
 socks:{frontOffsets:[2,2,2,2,2,2],backOffsets:[2,2,2,2,2],frontContact:[[0.30,0.27],[0.72,0.19],[0.72,0.24],[0.38,0.31],[0.43,0.39],[0.48,0.46]],backContact:[[0.46,0.25],[0.45,0.27],[0.45,0.28],[0.51,0.45],[0.30,0.24]]},
 paws:{frontOffsets:[19,24,2,18,25,2],backOffsets:[23,28,2,21,35],frontContact:[[0.31,0.23],[0.72,0.14],[0.77,0.18],[0.41,0.33],[0.41,0.36],[0.46,0.44]],backContact:[[0.47,0.27],[0.47,0.26],[0.47,0.30],[0.54,0.38],[0.25,0.12]]}
};
function xlSkinId(){
 const base=(typeof xlActiveProfile!=='undefined'&&xlActiveProfile&&xlActiveProfile.id)?xlActiveProfile.id:'sneakers';
 if(base!=='sneakers')return XL_SKIN_GEO[base]?base:'aj5';
 const s=(typeof realmAfterFx!=='undefined'&&realmAfterFx.shoeSkin)||window.__cunjieShoeSkin||'aj5';
 return XL_SKIN_GEO[s]?s:'aj5';
}
function xlSkinGeo(){return XL_SKIN_GEO[xlSkinId()];}
function xlSceneLight(){
 const idx=typeof realmIndex==='number'?realmIndex:0;
 const rk=(typeof window!=='undefined'&&window.__cunjieRoomTheme)||(()=>{try{return window.parent.localStorage.getItem('cunjie-room-theme')||'rooftop-day';}catch{return 'rooftop-day';}})();
 if(idx===1)return {warm:false,dx:6,carpet:2.6,crop:null,wash:.16};
 if(idx===2)return {warm:true,dx:10,carpet:0.6,crop:null,wash:.14};
 if(rk==='rooftop-day')return {warm:true,dx:15,carpet:0,crop:[75,42,1130,678],wash:.15};
 if(rk==='rooftop-night')return {warm:false,dx:12,carpet:0,crop:[75,42,1130,678],wash:.18};
 if(rk==='rain')return {warm:false,dx:-10,carpet:0,crop:[75,58,1130,678],wash:.16};
 if(rk==='warm')return {warm:true,dx:13,carpet:0,crop:[75,58,1130,678],wash:.12};
 return {warm:true,dx:9,carpet:0,crop:[38,23,1204,722],wash:.11};
}
const xlFloorGfx=(()=>{
 let tex=null;
 function makeTex(size,fn){
  const pm=new Uint8Array(size*size*4),st=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++){
   const ny=(y+.5)/size*2-1;
   for(let x=0;x<size;x++){
    const nx=(x+.5)/size*2-1;
    const [r,g,b,a]=fn(nx,ny,(y+.5)/size);
    const ca=Math.max(0,Math.min(1,a));
    const o=(y*size+x)*4;
    st[o]=r;st[o+1]=g;st[o+2]=b;st[o+3]=Math.round(ca*255);
    pm[o]=Math.round(r*ca);pm[o+1]=Math.round(g*ca);pm[o+2]=Math.round(b*ca);pm[o+3]=Math.round(ca*255);
   }
  }
  return new_raw_tex(size,size,pm,st);
 }
 function ensure(){
  if(tex)return true;
  if(typeof new_raw_tex!=='function')return false;
  const oval=(col)=>makeTex(128,(nx,ny)=>{const d=Math.sqrt(nx*nx+ny*ny);if(d>=1)return [0,0,0,0];const k=1-d;return [col[0],col[1],col[2],Math.pow(k,1.65)];});
  const haze=(col)=>makeTex(128,(nx,ny,v)=>v<.02?[0,0,0,0]:[col[0],col[1],col[2],Math.pow(v,1.45)]);
  const ring=(col)=>makeTex(128,(nx,ny)=>{const d=Math.sqrt(nx*nx+ny*ny);if(d>=1||d<.52)return [0,0,0,0];const edge=Math.exp(-Math.pow((d-.86)/.085,2));return [col[0],col[1],col[2],edge];});
  tex={
   sc:oval([12,16,28]),
   sw:oval([30,17,11]),
   hc:haze([10,14,26]),
   hw:haze([26,16,11]),
   rc:ring([115,190,210]),
   rw:ring([255,244,212]),
   gw:oval([255,242,208]),
   rk:oval([24,20,18]),
  };
  return true;
 }
 function blit(t,cx,cy,rx,ry,a){
  if(!t||a<=.004||rx<=0||ry<=0)return;
  const oa=alpha,oh=hflip;hflip=false;alpha=clamp(a,0,1);
  set_texture(t);quad(cx-rx,cy-ry,rx*2,ry*2,0,0,128,128);
  alpha=oa;hflip=oh;
 }
 return {
  ready(){return ensure();},
  drawOval(warm,cx,cy,rx,ry,a){if(!ensure())return;blit(warm?tex.sw:tex.sc,cx,cy,rx,ry,a);},
  drawFloorWash(){
   if(!ensure())return;
   const L=xlSceneLight(),oa=alpha,oh=hflip;hflip=false;alpha=L.wash;
   set_texture(L.warm?tex.hw:tex.hc);quad(0,Math.floor(h*.70),w,h-Math.floor(h*.70),0,0,128,128);
   alpha=oa;hflip=oh;
  },
  drawBackFootShadow(x,y,frame,wPaw,fade){
   if(!ensure())return;
   const L=xlSceneLight(),geo=xlSkinGeo();
   const c=geo.backContact[Math.max(0,Math.min(geo.backContact.length-1,frame|0))]||[0.45,0.36];
   const cx=x+c[0]*wPaw,hr=c[1]*wPaw,st=tex[L.warm?'sw':'sc'],aFade=(fade==null?1:fade);
   const pressK=frame/4;
   blit(st,cx+L.dx*.85,y+2.5,hr*(1.28-pressK*.08),6.2+L.carpet*.8,.28*aFade);
   blit(st,cx+L.dx*.22,y+1.2,hr*1.04,3.4+L.carpet*.45,.48*aFade);
   blit(tex.rk,cx,y+.5,hr*.88,1.9,.42*aFade);
  },
  drawFrontFootShadow(){
   if(!ensure())return;
   const L=xlSceneLight(),geo=xlSkinGeo(),rf=(typeof realmContactFrame==='function'?realmContactFrame():paw_state);
   const c=geo.frontContact[Math.max(0,Math.min(geo.frontContact.length-1,rf|0))]||[0.49,0.45];
   const cx=paw_x-paw.width/2-paw.offset+c[0]*paw.width,hr=c[1]*paw.width,fy=floor_y+1,st=tex[L.warm?'sw':'sc'];
   const lift=Math.max(0,floor_y-paw_y),liftK=Math.min(1,lift/Math.max(40,floor_y-paw_min_y));
   if(paw_state<3){
    const spread=1+liftK*.24,a=(1-liftK*.62);
    blit(st,cx+L.dx*(.65+liftK*.75),fy+2,hr*1.18*spread,5.5+liftK*3.5+L.carpet*.5,.30*a);
    blit(st,cx+L.dx*(.2+liftK*.25),fy+1,hr*.92*spread,3.2+liftK*1.8,.42*a);
   }else{
    const sq=(typeof evoContact!=='undefined'&&evoEnabled?.())?evoContact.squash()*18:0;
    const p=clamp(typeof pressure==='number'?pressure:0,0,1);
    blit(st,cx+L.dx*.85,fy+2.2,hr*(1.22+p*.08)+sq,6.4+p*1.4+L.carpet*.8,.34+.14*p);
    blit(st,cx+L.dx*.20,fy+1.1,hr*(1.03+p*.05)+sq*.7,3.6+p*.8+L.carpet*.45,.52+.16*p);
    blit(tex.rk,cx,fy+.5,hr*.90+sq*.5,2.1+.6*p,.54+.14*p);
   }
  },
  drawTinyShadow(bx,by,actorW,a){if(!ensure())return;const L=xlSceneLight();blit(tex[L.warm?'sw':'sc'],bx,by,actorW*.36,Math.max(1.8,actorW*.11),.52*(a==null?1:a));},
  drawTargetGuide(tx,fy,width,near){if(!ensure())return;blit(near?tex.rw:tex.rc,tx,fy,width*.46,4.2,near?.32:.14);},
  drawContactPress(px,fy,hr,press,punch){if(!ensure())return;blit(tex.rk,px,fy,hr*1.02,2.4+2.2*press,.22+.24*press+punch*.20);},
  drawImpactRing(px,fy,rx,ry,a){if(!ensure())return;const L=xlSceneLight();blit(L.warm?tex.rw:tex.rc,px,fy,rx,ry,a);},
  drawImpactFlash(px,fy,rx,ry,a){if(!ensure())return;blit(tex.gw,px,fy,rx,ry,a);},
  drawRallyFloorZone(x,fy,prog){if(!ensure())return;blit(tex.gw,x,fy,26,4.5,.24+.18*prog);blit(tex.rw,x,fy,24,4,.36+.25*prog);}
 };
})();"""

PAWS_GEO_OLD = '"paws": {"frontOffsets": [18, 26, 4, 16, 21, 5], "backOffsets": [17, 21, 3, 17, 27],'
PAWS_GEO_NEW = '"paws": {"frontOffsets": [19, 24, 2, 18, 25, 2], "backOffsets": [23, 28, 2, 21, 35],'

DRAW_BUGS_OLD = """function draw_bugs() {
\tfor (const b of bugs)
\t\tif (b) {draw_bug(b);alpha=1;}
\thflip = false;
\tunset_fit();
}"""

DRAW_BUGS_NEW = """let xlBugPass = 0;
function xlIsBackBug(b) {
\tif (!b) return true;
\tif (paw_state >= 3) {
\t\tif ((b.z || 0) >= 2.2 || b.eliminated || b.knocked || b.rolling) return true;
\t\tif (typeof b.under_paw === 'function' && b.under_paw()) return true;
\t\treturn false;
\t}
\treturn (b.z || 0) >= 2.8;
}
function draw_bugs() {
\tfor (const b of bugs) {
\t\tif (!b) continue;
\t\tif (xlBugPass === 1 && !xlIsBackBug(b)) continue;
\t\tif (xlBugPass === 2 && xlIsBackBug(b)) continue;
\t\tdraw_bug(b);alpha=1;
\t}
\thflip = false;
\tunset_fit();
}"""

PAWS_DRAW_OLD = """function draw_back_paw() {
\tif (hide_paws)
\t\treturn;
\t
\tconst frame = clamp(round(pressure*4), 0, 4);
\tconst x = w*paw.back_paw_x, y = h*paw.back_paw_y;
\talpha = 1-frame/4;
\tif (pressure<0.8 && paw.back_paw_shadow)
\t\tdraw_paw_shadow(x+paw.width/2, y, paw.width-(frame/4)*paw.width);
\talpha = 1;
\t
\talpha=xlModeFade;
\tsprite(paw.back_spr,x,y+(XL_GEOMETRY[xlActiveProfile.id].backOffsets[frame]||0),frame,0,1);alpha=1;
}

function draw_front_paw() {
\tif (hide_paws)
\t\treturn;
\t
\tvar y_off = 0;
\tif (paw_state == 3 && !paw.steamroller) {
\t\tif (supports > 0)
\t\t\ty_off = pin_min_y - floor_y;
\t\telse if (pressure > 0.2)
\t\t\ty_off = 4;
\t}
\t
\tvar frame = paw_state;
\tstomp_frame = 0;
\tif (pin_min_y >= floor_y || paw.steamroller)
\t\tstomp_frame += clamp(ceil(pressure*4) - 1, 0, 2);
\telse
\t\tif (paw_state == 3 && pressure > 0.1)
\t\t\tframe = 4;
\t
\talpha=xlModeFade;
\tsprite(paw.front_spr,paw_x-paw.width/2-paw.offset,paw_y+y_off+(XL_GEOMETRY[xlActiveProfile.id].frontOffsets[frame+stomp_frame]||0),frame+stomp_frame,0,1);
\tdraw_stickers();alpha=1;
}"""

PAWS_DRAW_NEW = """function draw_back_paw() {
\tif (hide_paws)
\t\treturn;
\t
\tconst frame = clamp(round(pressure*4), 0, 4);
\tconst x = w*paw.back_paw_x, y = h*paw.back_paw_y;
\tif (typeof xlFloorGfx !== 'undefined' && xlFloorGfx.ready()) {
\t\txlFloorGfx.drawBackFootShadow(x, y, frame, paw.width, xlModeFade);
\t} else {
\t\talpha = 1-frame/4;
\t\tif (pressure<0.8 && paw.back_paw_shadow)
\t\t\tdraw_paw_shadow(x+paw.width/2, y, paw.width-(frame/4)*paw.width);
\t\talpha = 1;
\t}
\t
\talpha=xlModeFade;
\tsprite(paw.back_spr,x,y+(xlSkinGeo().backOffsets[frame]||0),frame,0,1);alpha=1;
}

function draw_front_paw() {
\tif (hide_paws)
\t\treturn;
\t
\tvar y_off = 0;
\tif (paw_state == 3 && !paw.steamroller) {
\t\tif (supports > 0)
\t\t\ty_off = pin_min_y - floor_y;
\t\telse if (pressure > 0.2)
\t\t\ty_off = 4;
\t}
\t
\tvar frame = paw_state;
\tstomp_frame = 0;
\tif (pin_min_y >= floor_y || paw.steamroller)
\t\tstomp_frame += clamp(ceil(pressure*4) - 1, 0, 2);
\telse
\t\tif (paw_state == 3 && pressure > 0.1)
\t\t\tframe = 4;
\t
\talpha=xlModeFade;
\tsprite(paw.front_spr,paw_x-paw.width/2-paw.offset,paw_y+y_off+(xlSkinGeo().frontOffsets[frame+stomp_frame]||0),frame+stomp_frame,0,1);
\tdraw_stickers();alpha=1;
}"""

DRAW_MAIN_OLD = """draw_stains();
\tdraw_back_paw();
\tif (paw_y > floor_y - 100) {
\t\tconst len = paw.width-(floor_y-paw_y);
\t\talpha = len/paw.width;
\t\tdraw_paw_shadow(paw_x, floor_y-floor_depth/2, len);
\t\talpha = 1.0;
\t}
\tif (paw_state < 3)
\t\tif (paw_state == 0)
\t\t\tdraw_droplets(), draw_fallers(), draw_front_paw();
\t\telse
\t\t\tdraw_front_paw(), draw_droplets(), draw_fallers();
\t
\tdraw_bugs();
\tdraw_strands();
\t
\tif (paw_state == 3)
\t\tdraw_droplets(), draw_fallers(), draw_front_paw();"""

DRAW_MAIN_NEW = """draw_stains();
\tdraw_back_paw();
\tif (typeof xlFloorGfx !== 'undefined' && xlFloorGfx.ready()) {
\t\txlFloorGfx.drawFrontFootShadow();
\t\tif (typeof window.xlDrawImpactFloorPass === 'function') window.xlDrawImpactFloorPass();
\t} else if (paw_y > floor_y - 100) {
\t\tconst len = paw.width-(floor_y-paw_y);
\t\talpha = len/paw.width;
\t\tdraw_paw_shadow(paw_x, floor_y-floor_depth/2, len);
\t\talpha = 1.0;
\t}
\tif (paw_state == 0) {
\t\tdraw_droplets(), draw_fallers(), draw_front_paw();
\t\tdraw_bugs();
\t\tdraw_strands();
\t} else if (paw_state < 3) {
\t\tif (paw_y >= floor_y - 38) {
\t\t\txlBugPass = 1; draw_bugs();
\t\t\tdraw_front_paw(), draw_droplets(), draw_fallers();
\t\t\txlBugPass = 2; draw_bugs();
\t\t\txlBugPass = 0;
\t\t} else {
\t\t\tdraw_front_paw(), draw_droplets(), draw_fallers();
\t\t\tdraw_bugs();
\t\t}
\t\tdraw_strands();
\t} else {
\t\txlBugPass = 1; draw_bugs();
\t\tdraw_droplets(), draw_fallers(), draw_front_paw();
\t\txlBugPass = 2; draw_bugs();
\t\txlBugPass = 0;
\t\tdraw_strands();
\t}"""


def ensure_floor_in_done_loading(html, label):
    """Ensure XL_SKIN_GEO and xlFloorGfx are defined inside done_loading() lexical scope."""
    top_block = RETURN_RENDERER_NEW + "\n" + XL_FLOOR_BLOCK
    if top_block in html:
        html = replace_once(html, top_block, RETURN_RENDERER_NEW, f"{label} strip top-level XL_FLOOR_BLOCK")
    if (DONE_LOADING_OLD + "\nconst XL_SKIN_GEO={") not in html:
        html = replace_once(html, DONE_LOADING_OLD, DONE_LOADING_OLD + "\n" + XL_FLOOR_BLOCK, f"{label} insert XL_FLOOR_BLOCK into done_loading")
    return html


def patch_impact():
    path = os.path.join(DIST, "data", "touch-v1-impact.js")
    prefix, html = load_data(path)

    if "XL_SKIN_GEO" in html:
        html = ensure_floor_in_done_loading(html, "impact")
        print("touch-v1-impact.js scoped cleanly inside done_loading()")
    else:
        html = replace_once(html, RENDERER_2D_OLD, RENDERER_2D_NEW, "impact RENDERER_2D")
        html = replace_once(html, VERT_SHADER_OLD, VERT_SHADER_NEW, "impact VERT_SHADER")
        html = replace_once(html, WEBGL_TEX_OLD, WEBGL_TEX_NEW, "impact WEBGL_TEX")
        html = replace_once(html, RETURN_RENDERER_OLD, RETURN_RENDERER_NEW, "impact RETURN_RENDERER")
        html = ensure_floor_in_done_loading(html, "impact")
        html = replace_once(html, PAWS_GEO_OLD, PAWS_GEO_NEW, "impact PAWS_GEO")
        html = replace_once(html, DRAW_BUGS_OLD, DRAW_BUGS_NEW, "impact DRAW_BUGS")
        html = replace_once(html, PAWS_DRAW_OLD, PAWS_DRAW_NEW, "impact PAWS_DRAW")
        html = replace_once(html, DRAW_MAIN_OLD, DRAW_MAIN_NEW, "impact DRAW_MAIN")

        # 1. Move realmAfterFx ink/pulses out of 2D top overlay into WebGL Floor Pass
        af_old = """ draw(ctx){
  if(!this.enabled||!active||pause||tr||!this.factor)return;
  // Original texture remains untouched. The separate pass can be toggled off.
  ctx.save();ctx.setTransform(sc,0,0,sc,0,0);
  const strength=this.factor;
  // Stains are in *world* coordinates and survive multiple foot cycles.
  for(const b of this.ink){
   let fade=Math.min(1,(b.max-b.age)/4);if(fade<=0)continue;
   ctx.save();ctx.globalAlpha=fade*.75*strength;
   ctx.translate(b.x,b.y);ctx.rotate(Math.sin(b.seed)*.2);
   ctx.fillStyle='#111923';ctx.beginPath();ctx.ellipse(0,0,b.size,Math.max(1,b.size*.22),0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#25414a';ctx.beginPath();ctx.ellipse(b.size*.22,-1,b.size*.27,Math.max(.5,b.size*.07),0,0,Math.PI*2);ctx.fill();
   ctx.restore();
  }
  // Hit pulse: readable timing without shaking entire UI.
  for(const p of this.pulses){
   const t=p.age/p.max;if(t>=1)continue;
   ctx.beginPath();ctx.ellipse(p.x,p.y,4+t*(12+16*p.force),1.2+t*4,0,0,Math.PI*2);
   ctx.strokeStyle=`rgba(103,186,203,${(1-t)*.42*strength})`;ctx.lineWidth=1.2;ctx.stroke();
  }"""

        af_new = """ drawWebglFloor(){
  if(!this.enabled||!active||pause||tr||!this.factor||typeof xlFloorGfx==='undefined'||!xlFloorGfx.ready())return;
  const strength=this.factor,warm=xlSceneLight().warm;
  for(const b of this.ink){
   const fade=Math.min(1,(b.max-b.age)/4);if(fade<=0)continue;
   xlFloorGfx.drawOval(warm,b.x,b.y,b.size,Math.max(1.2,b.size*.22),fade*.68*strength);
  }
  for(const p of this.pulses){
   const t=p.age/p.max;if(t>=1)continue;
   xlFloorGfx.drawImpactRing(p.x,p.y,4+t*(12+16*p.force),1.2+t*4,(1-t)*.42*strength);
  }
 },
 draw(ctx){
  if(!this.enabled||!active||pause||tr||!this.factor)return;
  ctx.save();ctx.setTransform(sc,0,0,sc,0,0);
  const strength=this.factor;
  if(typeof xlFloorGfx==='undefined'||!xlFloorGfx.ready()){
   for(const b of this.ink){
    let fade=Math.min(1,(b.max-b.age)/4);if(fade<=0)continue;
    ctx.save();ctx.globalAlpha=fade*.75*strength;
    ctx.translate(b.x,b.y);ctx.rotate(Math.sin(b.seed)*.2);
    ctx.fillStyle='#111923';ctx.beginPath();ctx.ellipse(0,0,b.size,Math.max(1,b.size*.22),0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#25414a';ctx.beginPath();ctx.ellipse(b.size*.22,-1,b.size*.27,Math.max(.5,b.size*.07),0,0,Math.PI*2);ctx.fill();
    ctx.restore();
   }
   for(const p of this.pulses){
    const t=p.age/p.max;if(t>=1)continue;
    ctx.beginPath();ctx.ellipse(p.x,p.y,4+t*(12+16*p.force),1.2+t*4,0,0,Math.PI*2);
    ctx.strokeStyle=`rgba(103,186,203,${(1-t)*.42*strength})`;ctx.lineWidth=1.2;ctx.stroke();
   }
  }"""
        html = replace_once(html, af_old, af_new, "realmAfterFx.drawWebglFloor")

        # 2. Move realmV57Ground world-space floor marks from 2D top overlay into WebGL Floor Pass
        v57_old = """ draw(ctx,af){
  if(!af.enabled||realmIndex!==0||af.shoeSkin!=='aj6'||!active||pause||tr)return;
  const reduced=!!(realmMood.lowEffects||realmMood.reduceMotion);
  const opacity=reduced?.42:1;
  ctx.save();ctx.setTransform(sc,0,0,sc,0,0);
  // World-space floor marks, never painted into the sneaker sprite.
  for(const m of this.marks){
   const fade=Math.min(1,(m.max-m.age)/4);
   if(fade<=0)continue;
   ctx.save();ctx.globalAlpha=opacity*fade*(m.kind==='scuff'?.23:.28)*m.force;
   ctx.fillStyle='#14242c';ctx.beginPath();ctx.ellipse(m.x,m.y,m.size,Math.max(1.1,m.size*.058),0,0,Math.PI*2);ctx.fill();
   ctx.globalAlpha*=.36;ctx.fillStyle='#698a8e';ctx.beginPath();ctx.ellipse(m.x,m.y+1,m.size*.65,Math.max(.8,m.size*.021),0,0,Math.PI*2);ctx.fill();
   ctx.restore();
  }"""

        v57_new = """ drawWebglFloor(af){
  if(!af||!af.enabled||realmIndex!==0||af.shoeSkin!=='aj6'||!active||pause||tr||typeof xlFloorGfx==='undefined'||!xlFloorGfx.ready())return;
  const reduced=!!(realmMood.lowEffects||realmMood.reduceMotion),opacity=reduced?.42:1,warm=xlSceneLight().warm;
  for(const m of this.marks){
   const fade=Math.min(1,(m.max-m.age)/4);if(fade<=0)continue;
   xlFloorGfx.drawOval(warm,m.x,m.y,m.size,Math.max(1.3,m.size*.075),opacity*fade*(m.kind==='scuff'?.22:.27)*m.force);
  }
 },
 draw(ctx,af){
  if(!af.enabled||realmIndex!==0||af.shoeSkin!=='aj6'||!active||pause||tr)return;
  const reduced=!!(realmMood.lowEffects||realmMood.reduceMotion);
  const opacity=reduced?.42:1;
  ctx.save();ctx.setTransform(sc,0,0,sc,0,0);
  if(typeof xlFloorGfx==='undefined'||!xlFloorGfx.ready()){
   for(const m of this.marks){
    const fade=Math.min(1,(m.max-m.age)/4);
    if(fade<=0)continue;
    ctx.save();ctx.globalAlpha=opacity*fade*(m.kind==='scuff'?.23:.28)*m.force;
    ctx.fillStyle='#14242c';ctx.beginPath();ctx.ellipse(m.x,m.y,m.size,Math.max(1.1,m.size*.058),0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha*=.36;ctx.fillStyle='#698a8e';ctx.beginPath();ctx.ellipse(m.x,m.y+1,m.size*.65,Math.max(.8,m.size*.021),0,0,Math.PI*2);ctx.fill();
    ctx.restore();
   }
  }"""
        html = replace_once(html, v57_old, v57_new, "realmV57Ground.drawWebglFloor")

        # 3. realmFrameGeometry uses xlSkinGeo()
        fg_old = "offset=(XL_GEOMETRY[xlActiveProfile.id].frontOffsets[frame]||0);"
        fg_new = "offset=((typeof xlSkinGeo==='function'?xlSkinGeo():XL_GEOMETRY[xlActiveProfile.id]).frontOffsets[frame]||0);"
        html = replace_once(html, fg_old, fg_new, "realmFrameGeometry frontOffsets")

        # 4. realmSceneLoaded + realm_bedside smooth linear filter + realmDrawTerrain wash/crop/rallies
        sc_old = """for(let i=0;i<3;i++)for(let v=0;v<2;v++){
 fetch(realmSceneUris[i][v]).then(r=>r.blob()).then(createImageBitmap).then(b=>{
  textures.set('realm_scene_'+i+'_'+v,new_texture(b));realmSceneLoaded[i][v]=true;
 }).catch(()=>{realmSceneLoaded[i][v]=false;});
}"""
        sc_new = """for(let i=0;i<3;i++)for(let v=0;v<2;v++){
 fetch(realmSceneUris[i][v]).then(r=>r.blob()).then(createImageBitmap).then(b=>{
  const tx=new_texture(b);tx.smooth=true;textures.set('realm_scene_'+i+'_'+v,tx);realmSceneLoaded[i][v]=true;
 }).catch(()=>{realmSceneLoaded[i][v]=false;});
}"""
        html = replace_once(html, sc_old, sc_new, "realmSceneLoaded smooth")

        bed_old = "textures.set('realm_bedside',new_texture(b));realmArtReady=true;"
        bed_new = "const btx=new_texture(b);btx.smooth=true;textures.set('realm_bedside',btx);realmArtReady=true;"
        html = replace_once(html, bed_old, bed_new, "realm_bedside smooth")

        tr_old = """function realmDrawTerrain(){
 const scene=realmVisual(),base=[8,30,55][realmIndex],cap=[28,64,100][realmIndex],v=realmMood.lowEffects?0:Math.min(1,Math.max(0,(realmMood.value-base)/(cap-base)))*[.64,.80,1][realmIndex];
 const zoom=scene.camera,cropx=1280*(1-1/zoom)/2,cropy=768*(1-1/zoom)/2,cw=1280/zoom,ch=768/zoom;
 if(realmSceneLoaded[realmIndex][0]){
  alpha=1;sprite_scaled(['realm_scene_'+realmIndex+'_0',cropx,cropy,cw,ch],0,0,w,h);
  if(realmSceneLoaded[realmIndex][1]&&v>.02){alpha=Math.min(1,v+(realmBurstTime>0?.38:0));sprite_scaled(['realm_scene_'+realmIndex+'_1',cropx,cropy,cw,ch],0,0,w,h);alpha=1;}
 }else if(realmIndex===2&&realmArtReady){sprite_scaled(['realm_bedside',0,0,1024,1024],0,0,w,h);}
 if(realmIndex===0&&paw_state!==3){
  // Landing preview: the actual destination in world units, not a screen-space guess.
  const tx=clamp(paw_dest_x||paw_x,0,w),nn=RealmTactics.landsNear(tx,bugs.filter(b=>b&&b.alive?.()),paw.width*.46);
  darkrect(tx-paw.width*.33,floor_y-4,paw.width*.66,3,nn?.30:.13);
 }
 if(realmIndex===1){
  // Small, visible signs of hidden NPCs: the cover is no longer visually empty.
  for(const b of bugs){if(!b||!b.alive?.()||!b.realmHidden)continue;
   darkrect(b.x-4,floor_y-8,8,2,.32);
   darkrect(b.x-1,floor_y-11,2,3,.19);
  }
 }
 if(realmIndex===2){
  for(const r of realmRallies){if(r.cleared)continue;
   darkrect(r.x-18,floor_y-38,36,8,.42);
   darkrect(r.x-17,floor_y-37,34*Math.min(1,r.progress/3),6,.20);
  }
 }
 if(realmIndex===1&&realmMood.value>42){
  // Short, semi-transparent compression tracks. Never obscure an active NPC.
  if(paw_state===3){darkrect(paw_x-paw.width*.3,floor_y-3,paw.width*.6,2,.12);}
 }
}"""

        tr_new = """function realmDrawTerrain(){
 const scene=realmVisual(),base=[8,30,55][realmIndex],cap=[28,64,100][realmIndex],v=realmMood.lowEffects?0:Math.min(1,Math.max(0,(realmMood.value-base)/(cap-base)))*[.64,.80,1][realmIndex];
 const zoom=scene.camera,L=xlSceneLight();
 let cropx=1280*(1-1/zoom)/2,cropy=768*(1-1/zoom)/2,cw=1280/zoom,ch=768/zoom;
 if(realmIndex===0&&L.crop){[cropx,cropy,cw,ch]=L.crop;}
 if(realmSceneLoaded[realmIndex][0]){
  alpha=1;sprite_scaled(['realm_scene_'+realmIndex+'_0',cropx,cropy,cw,ch],0,0,w,h);
  if(realmSceneLoaded[realmIndex][1]&&v>.02){alpha=Math.min(1,v+(realmBurstTime>0?.38:0));sprite_scaled(['realm_scene_'+realmIndex+'_1',cropx,cropy,cw,ch],0,0,w,h);alpha=1;}
 }else if(realmIndex===2&&realmArtReady){const bt=textures.get('realm_bedside');sprite_scaled(['realm_bedside',0,0,(bt&&bt.w)||1024,(bt&&bt.h)||1024],0,0,w,h);}
 if(typeof xlFloorGfx!=='undefined')xlFloorGfx.drawFloorWash();
 if(realmIndex===0&&paw_state!==3){
  const tx=clamp(paw_dest_x||paw_x,0,w),nn=RealmTactics.landsNear(tx,bugs.filter(b=>b&&b.alive?.()),paw.width*.46);
  if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready())xlFloorGfx.drawTargetGuide(tx,floor_y-1,paw.width*.68,nn);
  else darkrect(tx-paw.width*.33,floor_y-4,paw.width*.66,3,nn?.30:.13);
 }
 if(realmIndex===1){
  for(const b of bugs){if(!b||!b.alive?.()||!b.realmHidden)continue;
   if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready()){xlFloorGfx.drawOval(false,b.x,floor_y-b.z,5.5,2.2,.28);darkrect(b.x-1,floor_y-b.z-5,2,3,.24);}
   else{darkrect(b.x-4,floor_y-8,8,2,.32);darkrect(b.x-1,floor_y-11,2,3,.19);}
  }
 }
 if(realmIndex===2){
  for(const r of realmRallies){if(r.cleared)continue;
   if(typeof xlFloorGfx!=='undefined')xlFloorGfx.drawRallyFloorZone(r.x,floor_y-1,Math.min(1,r.progress/3));
   darkrect(r.x-18,floor_y-38,36,8,.42);
   darkrect(r.x-17,floor_y-37,34*Math.min(1,r.progress/3),6,.20);
  }
 }
 if(realmIndex===1&&realmMood.value>42){
  if(paw_state===3){
   if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready())xlFloorGfx.drawOval(false,paw_x,floor_y-1,paw.width*.38,3.2,.18);
   else darkrect(paw_x-paw.width*.3,floor_y-3,paw.width*.6,2,.12);
  }
 }
}"""
        html = replace_once(html, tr_old, tr_new, "realmDrawTerrain")

        # 5. Tiny human soft drop shadow + 3/64 pad fix + realmBack shadow/offsets
        bug_old = """ hflip=b.dir<0;
 alpha=(realmIndex>=1&&b.realmHidden?.58:1)*(b.xlDeadAge?Math.max(0,1-b.xlDeadAge/7):1);
 sprite_scaled(['realm_tiny_humans',variant*48,frame*64,48,64],b.x-actorW/2,b.y-b.z-actorH,actorW,actorH);
 alpha=1;"""
        bug_new = """ const tinyAlpha=(realmIndex>=1&&b.realmHidden?.58:1)*(b.xlDeadAge?Math.max(0,1-b.xlDeadAge/7):1);
 if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready())xlFloorGfx.drawTinyShadow(b.x,b.y-b.z+.6,actorW,tinyAlpha);
 hflip=b.dir<0;
 alpha=tinyAlpha;
 const padFix=Math.round((3/64)*actorH);
 sprite_scaled(['realm_tiny_humans',variant*48,frame*64,48,64],b.x-actorW/2,b.y-b.z-actorH+padFix,actorW,actorH);
 alpha=1;"""
        html = replace_once(html, bug_old, bug_new, "realmBugDraw shadow and grounding")

        rb_old = """const realmBack=draw_back_paw;
draw_back_paw=function(){
 if(realmIndex===0){realmBack();return;}
 if(hide_paws)return;
 const frame=clamp(round(pressure*4),0,4),scale=paw.width/160;
 const x=w*paw.back_paw_x,y=h*paw.back_paw_y+(XL_GEOMETRY[xlActiveProfile.id].backOffsets[frame]||0);
 // Pressure fades only the shadow. The back-foot art stays opaque.
 alpha=xlModeFade*(1-frame/4);
 if(pressure<.8&&paw.back_paw_shadow)draw_paw_shadow(x+paw.width/2,y,paw.width*(1-frame/4));
 alpha=xlModeFade;
 const sx=paw.back_spr[1]+Math.floor(frame/3)*160,sy=paw.back_spr[2]+(frame%3)*256;
 sprite_scaled(['giant',sx,sy,160,256],x,y-256*scale,paw.width,256*scale);
 alpha=1;
};"""

        rb_new = """const realmBack=draw_back_paw;
draw_back_paw=function(){
 if(realmIndex===0){realmBack();return;}
 if(hide_paws)return;
 const frame=clamp(round(pressure*4),0,4),scale=paw.width/160,yBase=h*paw.back_paw_y;
 const x=w*paw.back_paw_x,y=yBase+(xlSkinGeo().backOffsets[frame]||0);
 if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready()){
  xlFloorGfx.drawBackFootShadow(x,yBase,frame,paw.width,xlModeFade);
 }else{
  alpha=xlModeFade*(1-frame/4);
  if(pressure<.8&&paw.back_paw_shadow)draw_paw_shadow(x+paw.width/2,y,paw.width*(1-frame/4));
 }
 alpha=xlModeFade;
 const sx=paw.back_spr[1]+Math.floor(frame/3)*160,sy=paw.back_spr[2]+(frame%3)*256;
 sprite_scaled(['giant',sx,sy,160,256],x,y-256*scale,paw.width,256*scale);
 alpha=1;
};"""
        html = replace_once(html, rb_old, rb_new, "realmBack grounding and shadow")

    save_data(path, prefix, html)
    print("Patched dist/data/touch-v1-impact.js core")


def patch_free():
    path = os.path.join(DIST, "data", "touch-v1-free.js")
    prefix, html = load_data(path)

    if "XL_SKIN_GEO" in html:
        html = ensure_floor_in_done_loading(html, "free")
        save_data(path, prefix, html)
        print("touch-v1-free.js scoped cleanly inside done_loading()")
        return

    html = replace_once(html, RENDERER_2D_OLD, RENDERER_2D_NEW, "free RENDERER_2D")
    html = replace_once(html, VERT_SHADER_OLD, VERT_SHADER_NEW, "free VERT_SHADER")
    html = replace_once(html, WEBGL_TEX_OLD, WEBGL_TEX_NEW, "free WEBGL_TEX")
    html = replace_once(html, RETURN_RENDERER_OLD, RETURN_RENDERER_NEW, "free RETURN_RENDERER")
    html = ensure_floor_in_done_loading(html, "free")
    html = replace_once(html, PAWS_GEO_OLD, PAWS_GEO_NEW, "free PAWS_GEO")
    html = replace_once(html, DRAW_BUGS_OLD, DRAW_BUGS_NEW, "free DRAW_BUGS")
    html = replace_once(html, PAWS_DRAW_OLD, PAWS_DRAW_NEW, "free PAWS_DRAW")
    html = replace_once(html, DRAW_MAIN_OLD, DRAW_MAIN_NEW, "free DRAW_MAIN")

    save_data(path, prefix, html)
    print("Patched dist/data/touch-v1-free.js")


if __name__ == "__main__":
    patch_impact()
    patch_free()
