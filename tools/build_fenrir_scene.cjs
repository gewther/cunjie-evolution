'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist');
const src=path.join(root,'src','fenrir-scene-v1.js');
const hostPath=path.join(dist,'scripts','impact-host-3.js');
const sceneOut=path.join(dist,'scripts','fenrir-scene-v1.js');
const source=fs.readFileSync(src,'utf8');
new vm.Script(source,{filename:'fenrir-scene-v1.js'});
fs.mkdirSync(path.dirname(sceneOut),{recursive:true});
fs.writeFileSync(sceneOut,source,'utf8');
for(const name of ['city-far.svg','city-mid.svg','city-near.svg']){
 const from=path.join(root,'assets','fenrir',name);
 const to=path.join(dist,'assets','fenrir',name);
 fs.mkdirSync(path.dirname(to),{recursive:true});
 fs.copyFileSync(from,to);
}
let host=fs.readFileSync(hostPath,'utf8');
const injectStart=host.indexOf('function injectHttpBase');
const legacyStart=host.indexOf('function legacySource',injectStart);
const paintStart=host.indexOf('function paintShoePreviews',legacyStart);
if(injectStart<0||legacyStart<0||paintStart<0)throw new Error('Cannot locate legacySource in impact-host-3.js');
const tagLine=host.slice(legacyStart,paintStart).split(String.fromCharCode(10)).find(line=>line.includes('const tag='));
if(!tagLine)throw new Error('Original custom-motion tag line missing');
const inject=host.slice(injectStart,legacyStart);
const lines=[
 "function legacySource(kind,motionAtlas='',isFenrir=false){",
 " if(kind==='free'&&motionAtlas){",
 tagLine,
 "  let source=DATA.freeLegacy.includes('<head>')?DATA.freeLegacy.replace('<head>','<head>'+tag):DATA.freeLegacy;",
 "  if(isFenrir){",
 "   const anchor=String.raw`ptime = performance.now();\\nmainloop();`;",
 "   const bridge='if(typeof window.__installFenrirScene==="function"&&typeof fenrirCity!=="undefined"&&fenrirCity){sprite_scaled=window.__installFenrirScene({spriteScaled:sprite_scaled,textures:textures,newTexture:new_texture,w:w,h:h,getPawX:()=>paw_x});}';",
 "   if(source.split(anchor).length!==2)throw new Error('Fenrir scene bridge anchor missing or ambiguous');",
 "   source=source.replace(anchor,bridge+String.fromCharCode(10)+anchor);",
 "   source=source.replace('<head>','<head><script src="scripts/fenrir-scene-v1.js"></script>');",
 "  }",
 "  return injectHttpBase(source);",
 " }",
 " const source=CunjieShoeSkin.legacy(kind==='free'?DATA.freeLegacy:DATA.storyLegacy,DATA.images.sneakers,activeShoeSkin==='qiaodan'?DATA.images.sneakersQiaodan:DATA.images.sneakersAJ6,activeShoeSkin);",
 " return injectHttpBase(kind==='free'?source:v59EmbeddedVisualOnly(v58EmbeddedVisualOnly(source)));",
 "}",
 ""
];
host=host.slice(0,injectStart)+inject+lines.join(String.fromCharCode(10))+host.slice(paintStart);
fs.writeFileSync(hostPath,host,'utf8');
new vm.Script(host,{filename:'impact-host-3.js'});
console.log('Fenrir city scale scene adapter, three SVG layers, and runtime bridge built.');
