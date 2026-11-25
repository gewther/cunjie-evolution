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
const start=host.indexOf('function legacySource('),end=host.indexOf('function paintShoePreviews',start);
if(start<0||end<0)throw new Error('Cannot locate legacySource in impact-host-3.js');
const block=host.slice(start,end);
if(!block.includes('fenrir-scene-v1.js')){
 const replacement=`function legacySource(kind,motionAtlas='',isFenrir=false){
 if(kind==='free'&&motionAtlas){
  const tag=`<script>window.__cunjieCustomMotion=${JSON.stringify(motionAtlas)};window.__cunjieFenrirCity=${Boolean(isFenrir)};<\\/script>`.replace('<\\\\/','</');
  let source=DATA.freeLegacy.includes('<head>')?DATA.freeLegacy.replace('<head>','<head>'+tag):DATA.freeLegacy;
  if(isFenrir){
   const anchor='ptime = performance.now();\\nmainloop();';
   const bridge='if(typeof window.__installFenrirScene==="function"&&typeof fenrirCity!=="undefined"&&fenrirCity){sprite_scaled=window.__installFenrirScene({spriteScaled:sprite_scaled,textures:textures,newTexture:new_texture,w:w,h:h,getPawX:()=>paw_x});}';
   if(source.split(anchor).length!==2)throw new Error('Fenrir scene bridge anchor missing or ambiguous');
   source=source.replace(anchor,bridge+'\\n'+anchor);
   source=source.replace('<head>','<head><script src="scripts/fenrir-scene-v1.js"></script>');
  }
  return injectHttpBase(source);
 }
 const source=CunjieShoeSkin.legacy(kind==='free'?DATA.freeLegacy:DATA.storyLegacy,DATA.images.sneakers,activeShoeSkin==='qiaodan'?DATA.images.sneakersQiaodan:DATA.images.sneakersAJ6,activeShoeSkin);
 return injectHttpBase(kind==='free'?source:v59EmbeddedVisualOnly(v58EmbeddedVisualOnly(source)));
}
`;
 host=host.slice(0,start)+replacement+host.slice(end);
 fs.writeFileSync(hostPath,host,'utf8');
}
new vm.Script(host,{filename:'impact-host-3.js'});
console.log('Fenrir city scale scene adapter, three SVG layers, and runtime bridge built.');
