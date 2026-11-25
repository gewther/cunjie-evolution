"""Integrate v5.9.5 features (CunjieRenderQuality HD/QHD + u_smooth, 960x1536 HD AJ6 frames,
bedroom-wood room lighting, and Fenrir City / 1024x1024 custom motion atlas importer)
into dist/data/touch-v1-impact.js and dist/data/touch-v1-free.js while preserving all
Cunjie_Evolution_Source physics, audio, dialogue, grounding, and layer fixes."""
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


QUALITY_INIT_OLD = 'const gl = c.getContext("webgl", {antialias: false, alpha: false});'
QUALITY_INIT_NEW = (
    'const gl = c.getContext("webgl", {antialias: false, alpha: false});\n'
    'const quality = (window.parent && window.parent.CunjieRenderQuality)\n'
    '\t? window.parent.CunjieRenderQuality.create(c, oc, gl, w, h, !!sticker_ed)\n'
    '\t: { smooth: false, displayScaleX: sc, displayScaleY: sc, frame() {} };'
)

MAINLOOP_OLD = "function mainloop() {\n\tctime   = performance.now();"
MAINLOOP_NEW = "function mainloop() {\n\tctime   = performance.now();\n\tquality.frame(ctime);"

QUAD_2D_OLD = """ function quad(x,y,ww,hh,ux,uy,uw,uh){
  if(!current||!ww||!hh)return;
  uw=uw||ww;uh=uh||hh;x=floor(x);y=floor(y);
  ctx.save();ctx.imageSmoothingEnabled=!!current.smooth;ctx.globalAlpha=clamp(alpha,0,1);
  if(hflip){ctx.translate(x+ww,y);ctx.scale(-1,1);x=0;y=0;}
  ctx.drawImage(current.bitmap,ux,uy,uw,uh,x,y,ww,hh);ctx.restore();
 }"""

QUAD_2D_NEW = """ function quad(x,y,ww,hh,ux,uy,uw,uh){
  if(!current||!ww||!hh)return;
  uw=uw||ww;uh=uh||hh;
  const sm=!!(current.smooth||quality.smooth);
  if(!sm){x=floor(x);y=floor(y);}
  ctx.save();ctx.setTransform(c.width/w,0,0,c.height/h,0,0);ctx.imageSmoothingEnabled=sm;ctx.globalAlpha=clamp(alpha,0,1);
  if(hflip){ctx.translate(x+ww,y);ctx.scale(-1,1);x=0;y=0;}
  ctx.drawImage(current.bitmap,ux,uy,uw,uh,x,y,ww,hh);ctx.restore();
 }"""

VERT_OLD = """\tuniform vec2 u_screen_size;
\tuniform vec2 u_texture_size;
\tvoid main() {
\t\tv_uv = a_uv/u_texture_size;
\t\tv_alpha = a_alpha;
\t\tgl_Position = vec4(vec2(-1.0,1.0)+(floor(a_pos)*u_screen_size),0.0,1.0);
\t}"""

VERT_NEW = """\tuniform vec2 u_screen_size;
\tuniform vec2 u_texture_size;
\tuniform float u_smooth;
\tvoid main() {
\t\tv_uv = (u_smooth > 0.5 ? a_uv : floor(a_uv))/u_texture_size;
\t\tv_alpha = a_alpha;
\t\tvec2 position = u_smooth > 0.5 ? a_pos : floor(a_pos);
\t\tgl_Position = vec4(vec2(-1.0,1.0)+(position*u_screen_size),0.0,1.0);
\t}"""

UNIFORM_LOC_OLD = '\tu_texture_size = gl.getUniformLocation(sprg, "u_texture_size"),\n\tu_texture      = gl.getUniformLocation(sprg, "u_texture");'
UNIFORM_LOC_NEW = '\tu_texture_size = gl.getUniformLocation(sprg, "u_texture_size"),\n\tu_smooth       = gl.getUniformLocation(sprg, "u_smooth"),\n\tu_texture      = gl.getUniformLocation(sprg, "u_texture");'

SET_TEX_OLD = """var texture = null;
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
}"""

SET_TEX_NEW = """var texture = null, textureSmooth = false;
function set_texture(to) {
\tconst wantSmooth = !!(to.smooth || quality.smooth);
\tif (texture == to && textureSmooth === wantSmooth)
\t\treturn;
\trender();
\ttexture = to;
\ttextureSmooth = wantSmooth;
\tgl.bindTexture(gl.TEXTURE_2D, to.gltex);
\tconst flt = wantSmooth ? gl.LINEAR : gl.NEAREST;
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
\tgl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}"""

RENDER_UNIFORM_OLD = "\tgl.uniform2f(u_texture_size, texture.w || texture.size || 1, texture.h || texture.size || 1);"
RENDER_UNIFORM_NEW = (
    "\tgl.uniform2f(u_texture_size, texture.w || texture.size || 1, texture.h || texture.size || 1);\n"
    "\tgl.uniform1f(u_smooth, textureSmooth ? 1 : 0);"
)

OCC_BLIT_OLD = "\tocc.drawImage(c, 0, 0, w*sc, h*sc);\n\n\t// debug shapes\n\tocc.scale(sc,sc);"
OCC_BLIT_NEW = "\tocc.imageSmoothingEnabled = quality.smooth;\n\tocc.drawImage(c, 0, 0, oc.width, oc.height);\n\n\t// debug shapes\n\tocc.scale(quality.displayScaleX, quality.displayScaleY);"

DUST_SCALE_OLD = "occ.save();occ.scale(sc,sc);"
DUST_SCALE_NEW = "occ.save();occ.scale(quality.displayScaleX,quality.displayScaleY);"

CANVAS_COORDS_OLD = """function canvas_coords(event) {
\tconst ocr = oc.getBoundingClientRect();
\tconst sx = oc.width / ocr.width,
\t      sy = oc.height / ocr.height;
\treturn [
\t\t(event.clientX - ocr.left       ) * sx / sc,
\t\t(event.clientY - ocr.top + syoff) * sy / sc,
\t];
}"""

CANVAS_COORDS_NEW = """function canvas_coords(event) {
\tconst ocr = oc.getBoundingClientRect();
\treturn [
\t\t(event.clientX - ocr.left       ) * (w / Math.max(1, ocr.width)),
\t\t(event.clientY - ocr.top + syoff) * (h / Math.max(1, ocr.height)),
\t];
}"""

SKIN_GEO_OLD = """const XL_SKIN_GEO={
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
}"""

SKIN_GEO_NEW = """const XL_SKIN_GEO={
 aj5:{frontOffsets:[2,2,2,2,2,2],backOffsets:[2,2,3,1,2],frontContact:[[0.33,0.30],[0.71,0.20],[0.72,0.22],[0.49,0.45],[0.50,0.48],[0.50,0.48]],backContact:[[0.50,0.45],[0.42,0.36],[0.32,0.18],[0.32,0.24],[0.32,0.18]]},
 aj6:{frontOffsets:[4,2,2,4,4,4],backOffsets:[10,10,4,8,9],frontContact:[[0.48,0.44],[0.70,0.20],[0.72,0.20],[0.49,0.47],[0.48,0.46],[0.49,0.47]],backContact:[[0.50,0.42],[0.41,0.33],[0.32,0.23],[0.33,0.22],[0.30,0.19]]},
 aj6hd:{frontOffsets:[1,1,3,1,1,3],backOffsets:[1,1,3,1,1],frontContact:[[0.46,0.42],[0.70,0.19],[0.72,0.20],[0.46,0.44],[0.47,0.47],[0.49,0.49]],backContact:[[0.49,0.45],[0.49,0.44],[0.49,0.37],[0.31,0.24],[0.32,0.19]]},
 qiaodan:{frontOffsets:[3,3,3,3,7,7],backOffsets:[2,2,2,3,2],frontContact:[[0.34,0.29],[0.68,0.17],[0.70,0.18],[0.50,0.46],[0.50,0.47],[0.50,0.48]],backContact:[[0.28,0.24],[0.34,0.31],[0.47,0.43],[0.49,0.46],[0.50,0.46]]},
 socks:{frontOffsets:[2,2,2,2,2,2],backOffsets:[2,2,2,2,2],frontContact:[[0.30,0.27],[0.72,0.19],[0.72,0.24],[0.38,0.31],[0.43,0.39],[0.48,0.46]],backContact:[[0.46,0.25],[0.45,0.27],[0.45,0.28],[0.51,0.45],[0.30,0.24]]},
 paws:{frontOffsets:[19,24,2,18,25,2],backOffsets:[23,28,2,21,35],frontContact:[[0.31,0.23],[0.72,0.14],[0.77,0.18],[0.41,0.33],[0.41,0.36],[0.46,0.44]],backContact:[[0.47,0.27],[0.47,0.26],[0.47,0.30],[0.54,0.38],[0.25,0.12]]},
 fenrir:{frontOffsets:[10,7,5,2,2,2],backOffsets:[2,2,2,2,2],frontContact:[[0.22,0.10],[0.38,0.28],[0.50,0.30],[0.54,0.32],[0.54,0.32],[0.54,0.32]],backContact:[[0.54,0.32],[0.54,0.32],[0.54,0.32],[0.54,0.32],[0.54,0.32]]}
};
const xlHDaj6Urls=(window.parent&&window.parent.DATA&&window.parent.DATA.aj6Hd)||['/assets/aj6-hd/0.webp','/assets/aj6-hd/1.webp','/assets/aj6-hd/2.webp','/assets/aj6-hd/3.webp','/assets/aj6-hd/4.webp','/assets/aj6-hd/5.webp','/assets/aj6-hd/6.webp','/assets/aj6-hd/7.webp','/assets/aj6-hd/8.webp','/assets/aj6-hd/9.webp','/assets/aj6-hd/10.webp'];
const realmAJ6Frames=new Map();
if(window.cunjieHDaj6&&!(typeof customMotionSource!=='undefined'&&customMotionSource)){
 Promise.all(xlHDaj6Urls.map(u=>new Promise((res,rej)=>{const im=new Image();im.decoding='async';im.onload=()=>res(im);im.onerror=()=>rej(Error(u));im.src=u;})))
 .then(imgs=>{
  render();
  for(let i=0;i<imgs.length;i++){const key='realm-aj6-frame-'+i,tx=new_texture(imgs[i]);tx.smooth=true;textures.set(key,tx);realmAJ6Frames.set(i,key);}
 }).catch(()=>{});
}
function xlHasHdAJ6(){
 if(typeof customMotionSource!=='undefined'&&customMotionSource)return false;
 if(typeof realmIndex==='number'&&realmIndex!==0)return false;
 const base=(typeof xlActiveProfile!=='undefined'&&xlActiveProfile&&xlActiveProfile.id)?xlActiveProfile.id:'sneakers';
 if(base!=='sneakers')return false;
 const s=window.__cunjieShoeSkin||(typeof realmAfterFx!=='undefined'&&realmAfterFx.shoeSkin)||'aj5';
 return s==='aj6'&&realmAJ6Frames.size===11;
}
function xlSkinId(){
 if(typeof customMotionSource!=='undefined'&&customMotionSource)return 'fenrir';
 if(xlHasHdAJ6())return 'aj6hd';
 const base=(typeof xlActiveProfile!=='undefined'&&xlActiveProfile&&xlActiveProfile.id)?xlActiveProfile.id:'sneakers';
 if(base!=='sneakers')return XL_SKIN_GEO[base]?base:'aj5';
 const s=window.__cunjieShoeSkin||(typeof realmAfterFx!=='undefined'&&realmAfterFx.shoeSkin)||'aj5';
 return XL_SKIN_GEO[s]?s:'aj5';
}
function xlSkinGeo(){
 if(typeof customMotionSource!=='undefined'&&customMotionSource&&typeof customMotionGeo!=='undefined'&&customMotionGeo)return customMotionGeo;
 return XL_SKIN_GEO[xlSkinId()];
}
function xlSceneLight(){
 if(typeof fenrirCity!=='undefined'&&fenrirCity)return {warm:false,dx:-6,carpet:0,crop:null,wash:.18};
 const idx=typeof realmIndex==='number'?realmIndex:0;
 const rk=(typeof window!=='undefined'&&window.__cunjieRoomTheme)||(()=>{try{return window.parent.localStorage.getItem('cunjie-room-theme')||'rooftop-day';}catch{return 'rooftop-day';}})();
 if(idx===1)return {warm:false,dx:6,carpet:2.6,crop:null,wash:.16};
 if(idx===2)return {warm:true,dx:10,carpet:0.6,crop:null,wash:.14};
 if(rk==='rooftop-day')return {warm:true,dx:15,carpet:0,crop:[75,42,1130,678],wash:.15};
 if(rk==='rooftop-night')return {warm:false,dx:12,carpet:0,crop:[75,42,1130,678],wash:.18};
 if(rk==='bedroom-wood')return {warm:true,dx:11,carpet:0,crop:null,wash:.12};
 if(rk==='rain')return {warm:false,dx:-10,carpet:0,crop:[75,58,1130,678],wash:.16};
 if(rk==='warm')return {warm:true,dx:13,carpet:0,crop:[75,58,1130,678],wash:.12};
 return {warm:true,dx:9,carpet:0,crop:[38,23,1204,722],wash:.11};
}"""

PAWS_DRAW_OLD = """function draw_back_paw() {
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

PAWS_DRAW_NEW = """function draw_back_paw() {
\tif (hide_paws)
\t\treturn;
\t
\tconst frame = clamp(round(pressure*4), 0, 4);
\tconst x = w*paw.back_paw_x, y = (typeof customMotionSource !== 'undefined' && customMotionSource) ? floor_y - floor_depth - 6 : h*paw.back_paw_y;
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
\tconst yDraw = y + (xlSkinGeo().backOffsets[frame] || 0);
\tif (typeof xlHasHdAJ6 === 'function' && xlHasHdAJ6() && realmAJ6Frames.has(frame + 6)) {
\t\tsprite_scaled([realmAJ6Frames.get(frame + 6), 0, 0, 960, 1536], x, yDraw - 256, paw.width, 256);
\t} else {
\t\tsprite(paw.back_spr, x, yDraw, frame, 0, 1);
\t}
\talpha=1;
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
\tconst fIdx = frame + stomp_frame;
\tconst yDraw = paw_y + y_off + (xlSkinGeo().frontOffsets[fIdx] || 0);
\talpha=xlModeFade;
\tif (typeof xlHasHdAJ6 === 'function' && xlHasHdAJ6() && realmAJ6Frames.has(fIdx)) {
\t\tsprite_scaled([realmAJ6Frames.get(fIdx), 0, 0, 960, 1536], paw_x - paw.width/2 - paw.offset, yDraw - 256, paw.width, 256);
\t} else {
\t\tsprite(paw.front_spr, paw_x - paw.width/2 - paw.offset, yDraw, fIdx, 0, 1);
\t}
\tdraw_stickers();alpha=1;
}"""


# Free-mode Fenrir + custom 1024x1024 motion atlas patches
FREE_VARS_OLD = 'const url_params = new URLSearchParams();'
FREE_VARS_NEW = (
    'const url_params = new URLSearchParams();\n'
    'const customMotionSource = window.__cunjieCustomMotion || "";\n'
    'const fenrirCity = Boolean(window.__cunjieFenrirCity) || customMotionSource === "/assets/fenrir/fenrir-motion-v3.png";\n'
    'const customMotionTitle = fenrirCity ? "芬里尔" : "自定义角色";\n'
    'let customContactMasks;\n'
    'let customMotionGeo = null;'
)

FREE_LOAD_OLD = """\t\tapply_settings(json);
\t}
\t
\t// images
\tvar i=0, count=Object.keys(images).length;
\tfor (const [k, v] of Object.entries(images)) {
\t\tconst bitmap = await createImageBitmap(await ((await load(k, v, i, count)).blob()), {});
\t\tif (!bitmap) throw new Error(`while loading ${k}: "${v}" is not an image file!`);
\t\ttextures.set(k, new_texture(bitmap));
\t}"""

FREE_LOAD_NEW = """\t\tapply_settings(json);
\t}
\t
\tif (fenrirCity) {
\t\timages.fenrirCity = "/assets/fenrir/fenrir-city-blue-hour.webp";
\t\tObject.assign(set, {floor_name: "大道", day_night_cycle: false, foreground_spr: false, shadow_spr: false});
\t}
\t
\t// images
\tconst xlLoadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(`failed to load image: ${src}`)); im.src = src; });
\tvar i=0, count=Object.keys(images).length;
\tfor (const [k, v] of Object.entries(images)) {
\t\tif (k === "fenrirCity") {
\t\t\tconst img = await xlLoadImg(v);
\t\t\tconst tx = new_texture(img);
\t\t\ttx.smooth = true;
\t\t\ttextures.set(k, tx);
\t\t\tset.bg_spr = [k, 0, 0, tx.w, tx.h];
\t\t\tcontinue;
\t\t}
\t\tconst bitmap = await createImageBitmap(await ((await load(k, v, i, count)).blob()), {});
\t\tif (!bitmap) throw new Error(`while loading ${k}: "${v}" is not an image file!`);
\t\tif (k === "giant" && customMotionSource) {
\t\t\tconst motion = await xlLoadImg(customMotionSource);
\t\t\tconst atlas = document.createElement("canvas");
\t\t\tatlas.width = bitmap.width;
\t\t\tatlas.height = bitmap.height;
\t\t\tconst actx = atlas.getContext("2d");
\t\t\tactx.drawImage(bitmap, 0, 0);
\t\t\t// Imported 1024x1024 PNG owns the 640x768 action tiles; UI & shadow tiles stay on base atlas.
\t\t\tactx.clearRect(0, 0, 640, 768);
\t\t\tactx.drawImage(motion, 0, 0, 640, 768, 0, 0, 640, 768);
\t\t\tif (typeof actx.getImageData === "function") {
\t\t\t\tcustomContactMasks = [0, 1, 2].map(frame => {
\t\t\t\t\tconst stripe = actx.getImageData(160, frame * 256 + 232, 160, 24).data;
\t\t\t\t\tconst mask = Array.from({length: 160}, (_, x) => {
\t\t\t\t\t\tfor (let y = 0; y < 24; y++) {
\t\t\t\t\t\t\tif (stripe[(y * 160 + x) * 4 + 3] >= 128) return 1;
\t\t\t\t\t\t}
\t\t\t\t\t\treturn 0;
\t\t\t\t\t});
\t\t\t\t\treturn mask.some(Boolean) ? mask : XL_GEOMETRY.sneakers.mask.slice();
\t\t\t\t});
\t\t\t\tconst scanCell = (sx, sy, fallbackOff, fallbackContact) => {
\t\t\t\t\tconst data = actx.getImageData(sx, sy, 160, 256).data;
\t\t\t\t\tlet maxY = -1;
\t\t\t\t\tfor (let dy = 255; dy >= 0 && maxY < 0; dy--) {
\t\t\t\t\t\tconst row = dy * 160 * 4;
\t\t\t\t\t\tfor (let dx = 0; dx < 160; dx++) { if (data[row + dx * 4 + 3] > 20) { maxY = dy; break; } }
\t\t\t\t\t}
\t\t\t\t\tif (maxY < 0) return { off: fallbackOff, contact: fallbackContact };
\t\t\t\t\tlet minX = 160, maxX = -1;
\t\t\t\t\tfor (let dy = Math.max(0, maxY - 12); dy <= maxY; dy++) {
\t\t\t\t\t\tconst row = dy * 160 * 4;
\t\t\t\t\t\tfor (let dx = 0; dx < 160; dx++) { if (data[row + dx * 4 + 3] > 20) { if (dx < minX) minX = dx; if (dx > maxX) maxX = dx; } }
\t\t\t\t\t}
\t\t\t\t\tconst cx = maxX >= minX ? ((minX + maxX) / 2) / 160 : fallbackContact[0];
\t\t\t\t\tconst hw = maxX >= minX ? Math.max(0.08, ((maxX - minX) / 2) / 160) : fallbackContact[1];
\t\t\t\t\treturn { off: (255 - maxY) + 1, contact: [cx, hw] };
\t\t\t\t};
\t\t\t\tconst fScanned = [0,1,2,3,4,5].map(idx => scanCell(Math.floor(idx/3)*160, (idx%3)*256, 2, [0.50, 0.34]));
\t\t\t\tconst bScanned = [0,1,2,3,4].map(idx => scanCell(320 + Math.floor(idx/3)*160, (idx%3)*256, 2, [0.50, 0.34]));
\t\t\t\tcustomMotionGeo = {
\t\t\t\t\tfrontOffsets: fScanned.map(s => s.off),
\t\t\t\t\tbackOffsets: bScanned.map(s => s.off),
\t\t\t\t\tfrontContact: fScanned.map(s => s.contact),
\t\t\t\t\tbackContact: bScanned.map(s => s.contact)
\t\t\t\t};
\t\t\t}
\t\t\tgiant.name = customMotionTitle;
\t\t\tgiant.description = fenrirCity ? "雨后城市 · 自由模式" : "动作图集 · 自由模式";
\t\t\tif (bitmap.close) bitmap.close();
\t\t\ttextures.set(k, new_texture(atlas));
\t\t} else {
\t\t\ttextures.set(k, new_texture(bitmap));
\t\t}
\t}"""

FREE_MASKS_OLD = "function init_stomp_masks() {\n\tfor (const mask of paw.stomp_masks) {"
FREE_MASKS_NEW = "function init_stomp_masks() {\n\tif (customContactMasks) paw.stomp_masks = customContactMasks;\n\tfor (const mask of paw.stomp_masks) {"

FREE_APPLY_STAGE_OLD = """function xlApplyStage(stage){
 const profile=XL_STAGES[stage],geo=XL_GEOMETRY[profile.id];
 if(xlRuntime){strands.length=0;fallers.length=0;droplets.length=0;}
 xlActiveProfile=profile;textures.set('giant',textures.get('outfit'+stage));"""

FREE_APPLY_STAGE_NEW = """function xlApplyStage(stage){
 const profile=XL_STAGES[customMotionSource?0:stage],geo=XL_GEOMETRY[profile.id];
 if(xlRuntime){strands.length=0;fallers.length=0;droplets.length=0;}
 xlActiveProfile=profile;if(!customMotionSource)textures.set('giant',textures.get('outfit'+stage));"""

FREE_BG_OLD = "\tsprite(set.bg_spr, 0, 0);"
FREE_BG_NEW = (
    '\tif (set.bg_spr[0] === "fenrirCity") {\n'
    '\t\tsprite_scaled(set.bg_spr, 0, 0, w, h);\n'
    "\t\tif (typeof xlFloorGfx !== 'undefined') xlFloorGfx.drawFloorWash();\n"
    "\t} else sprite(set.bg_spr, 0, 0);"
)

FREE_UI_OLD = (
    "id('xl-stage-name').textContent=XL_STAGES[stage].name+' · '+XL_STAGES[stage].tone;"
    "id('xl-stage-badge').textContent=String(stage+1).padStart(2,'0')+' / 03';"
    "id('xl-next').textContent=stage===0?'脱鞋 → 袜子':stage===1?'脱袜 → 裸爪':'已是裸爪';"
)
FREE_UI_NEW = (
    "id('xl-stage-name').textContent=customMotionSource?customMotionTitle+' · 第 '+(stage+1)+' 阶段':XL_STAGES[stage].name+' · '+XL_STAGES[stage].tone;"
    "id('xl-stage-badge').textContent=String(stage+1).padStart(2,'0')+' / 03';"
    "id('xl-next').textContent=customMotionSource?(stage===2?'已到最后阶段':'切换下一阶段'):(stage===0?'脱鞋 → 袜子':stage===1?'脱袜 → 裸爪':'已是裸爪');"
)

FREE_DIR_OLD = "function applyPrefs(){director.setEnabled(prefs.enabled);"
FREE_DIR_NEW = "function applyPrefs(){director.setEnabled(prefs.enabled&&!customMotionSource);"

FREE_CAM_OLD = "\tif (hide_cam)\n\t\treturn;"
FREE_CAM_NEW = "\tif (hide_cam || customMotionSource)\n\t\treturn;"

FREE_NEXT_OLD = "id('xl-next').disabled=stage===2||!!session?.switching;"
FREE_NEXT_NEW = "id('xl-next').hidden=Boolean(customMotionSource);id('xl-next').disabled=stage===2||!!session?.switching;"

FREE_GENSTAT_OLD = "\tpriority = priority || 0;\n\tif (priority == 0 || vd == 0)\n\t\treturn;"
FREE_GENSTAT_NEW = "\tpriority = priority || 0;\n\tif (priority == 0 || vd == 0 || fenrirCity)\n\t\treturn;"

FREE_EGONUMS_OLD = "function draw_ego_cam() {\n\t// floating numbers"
FREE_EGONUMS_NEW = "function draw_ego_cam() {\n\tif (fenrirCity) return;\n\t// floating numbers"


def patch_shared(html, label):
    old_hd = "const xlHDaj6Urls=['/assets/aj6-hd/0.webp',"
    new_hd = "const xlHDaj6Urls=(window.parent&&window.parent.DATA&&window.parent.DATA.aj6Hd)||['/assets/aj6-hd/0.webp',"
    if old_hd in html:
        html = html.replace(old_hd, new_hd, 1)
    old_skin_prec = "const s=(typeof realmAfterFx!=='undefined'&&realmAfterFx.shoeSkin)||window.__cunjieShoeSkin||'aj5';"
    new_skin_prec = "const s=window.__cunjieShoeSkin||(typeof realmAfterFx!=='undefined'&&realmAfterFx.shoeSkin)||'aj5';"
    if old_skin_prec in html:
        html = html.replace(old_skin_prec, new_skin_prec)
    if CANVAS_COORDS_OLD in html:
        html = replace_once(html, CANVAS_COORDS_OLD, CANVAS_COORDS_NEW, f"{label} CANVAS_COORDS HD fix")
    if "CunjieRenderQuality.create" in html and "xlHasHdAJ6" in html:
        print(f"{label}: shared v5.9.5 features already integrated")
        return html
    html = replace_once(html, QUALITY_INIT_OLD, QUALITY_INIT_NEW, f"{label} QUALITY_INIT")
    html = replace_once(html, MAINLOOP_OLD, MAINLOOP_NEW, f"{label} MAINLOOP")
    html = replace_once(html, QUAD_2D_OLD, QUAD_2D_NEW, f"{label} QUAD_2D")
    html = replace_once(html, VERT_OLD, VERT_NEW, f"{label} VERT")
    html = replace_once(html, UNIFORM_LOC_OLD, UNIFORM_LOC_NEW, f"{label} UNIFORM_LOC")
    html = replace_once(html, SET_TEX_OLD, SET_TEX_NEW, f"{label} SET_TEX")
    html = replace_once(html, RENDER_UNIFORM_OLD, RENDER_UNIFORM_NEW, f"{label} RENDER_UNIFORM")
    html = replace_once(html, OCC_BLIT_OLD, OCC_BLIT_NEW, f"{label} OCC_BLIT")
    html = replace_once(html, DUST_SCALE_OLD, DUST_SCALE_NEW, f"{label} DUST_SCALE")
    html = replace_once(html, SKIN_GEO_OLD, SKIN_GEO_NEW, f"{label} SKIN_GEO")
    html = replace_once(html, PAWS_DRAW_OLD, PAWS_DRAW_NEW, f"{label} PAWS_DRAW")
    return html


def patch_impact():
    path = os.path.join(DIST, "data", "touch-v1-impact.js")
    prefix, html = load_data(path)
    html = patch_shared(html, "impact")
    # Update overlay 2D canvas transforms in realmAfterFx, realmV57Ground, and embedded realmImpact
    if "ctx.setTransform(sc,0,0,sc,0,0);" in html:
        html = html.replace(
            "ctx.setTransform(sc,0,0,sc,0,0);",
            "ctx.setTransform(quality.displayScaleX,0,0,quality.displayScaleY,0,0);",
        )
    save_data(path, prefix, html)
    print("Integrated v5.9.5 features into dist/data/touch-v1-impact.js")


def patch_free():
    path = os.path.join(DIST, "data", "touch-v1-free.js")
    prefix, html = load_data(path)
    html = patch_shared(html, "free")
    if "const customMotionSource =" not in html:
        html = replace_once(html, FREE_VARS_OLD, FREE_VARS_NEW, "free FREE_VARS")
        html = replace_once(html, FREE_LOAD_OLD, FREE_LOAD_NEW, "free FREE_LOAD")
        html = replace_once(html, FREE_MASKS_OLD, FREE_MASKS_NEW, "free FREE_MASKS")
        html = replace_once(html, FREE_APPLY_STAGE_OLD, FREE_APPLY_STAGE_NEW, "free FREE_APPLY_STAGE")
        html = replace_once(html, FREE_BG_OLD, FREE_BG_NEW, "free FREE_BG")
        html = replace_once(html, FREE_UI_OLD, FREE_UI_NEW, "free FREE_UI")
        html = replace_once(html, FREE_DIR_OLD, FREE_DIR_NEW, "free FREE_DIR")
    if FREE_CAM_OLD in html:
        html = replace_once(html, FREE_CAM_OLD, FREE_CAM_NEW, "free FREE_CAM hide portrait")
    if FREE_NEXT_OLD in html and "id('xl-next').hidden=Boolean(customMotionSource);" not in html:
        html = replace_once(html, FREE_NEXT_OLD, FREE_NEXT_NEW, "free FREE_NEXT hide stage swap")
    if FREE_GENSTAT_OLD in html:
        html = replace_once(html, FREE_GENSTAT_OLD, FREE_GENSTAT_NEW, "free FREE_GENSTAT hide English popups in fenrirCity")
    if FREE_EGONUMS_OLD in html:
        html = replace_once(html, FREE_EGONUMS_OLD, FREE_EGONUMS_NEW, "free FREE_EGONUMS clean fenrirCity sky")
    if "if(typeof fenrirCity!=='undefined'&&fenrirCity)return {warm:false,dx:-5,carpet:0,crop:null,wash:.14};" in html:
        html = html.replace(
            "if(typeof fenrirCity!=='undefined'&&fenrirCity)return {warm:false,dx:-5,carpet:0,crop:null,wash:.14};",
            "if(typeof fenrirCity!=='undefined'&&fenrirCity)return {warm:false,dx:-6,carpet:0,crop:null,wash:.18};",
            1,
        )
    save_data(path, prefix, html)
    print("Integrated v5.9.5 features into dist/data/touch-v1-free.js")


if __name__ == "__main__":
    patch_impact()
    patch_free()
