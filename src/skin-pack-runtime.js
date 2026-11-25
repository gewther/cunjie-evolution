/* Project Cunjie v6.0 — Unified HD Frame Pack Registry & Runtime Custom Skin Pack Loader.
 * Works identically in Story Mode (Act I shoe / Act II socks / Act III paws) and Free Mode (outfits + custom characters).
 */
const xlHdPacks=new Map();
const xlCustomPackGeo={};
let xlCustomBgTex=null,xlCustomBgWarm=null;
if(typeof realmAJ6Frames!=='undefined')xlHdPacks.set('aj6',realmAJ6Frames);
function xlActiveSlotKey(){
 if(typeof customMotionSource!=='undefined'&&customMotionSource)return 'character';
 const base=(typeof xlActiveProfile!=='undefined'&&xlActiveProfile&&xlActiveProfile.id)?xlActiveProfile.id:'sneakers';
 return base==='sneakers'?'shoe':base;
}
window.xlGetHdFrame=function(frameIdx){
 const slot=xlActiveSlotKey();
 const customMap=xlHdPacks.get('pack_'+slot);
 if(customMap&&customMap.size===11&&customMap.has(frameIdx))return customMap.get(frameIdx);
 if(typeof xlHasHdAJ6==='function'&&xlHasHdAJ6()&&typeof realmAJ6Frames!=='undefined'&&realmAJ6Frames.has(frameIdx))return realmAJ6Frames.get(frameIdx);
 return null;
};
const xlPackOrigSkinGeo=typeof xlSkinGeo==='function'?xlSkinGeo:null;
if(xlPackOrigSkinGeo){
 xlSkinGeo=function(){
  const slot=xlActiveSlotKey();
  if(xlCustomPackGeo[slot])return xlCustomPackGeo[slot];
  return xlPackOrigSkinGeo();
 };
}
const xlPackOrigSceneLight=typeof xlSceneLight==='function'?xlSceneLight:null;
if(xlPackOrigSceneLight){
 xlSceneLight=function(){
  const base=xlPackOrigSceneLight();
  if(xlActiveSlotKey()==='shoe'&&xlCustomBgTex&&typeof xlCustomBgWarm==='boolean'){
   return {...base,warm:xlCustomBgWarm,crop:null};
  }
  return base;
 };
}
function xlPackLoadImg(url){
 return new Promise((res,rej)=>{const im=new Image();im.decoding='async';im.onload=()=>res(im);im.onerror=()=>rej(Error('pack image load failed'));im.src=url;});
}
function xlPackSpliceAtlas(stageIdx,img){
 const key='outfit'+stageIdx,baseTex=textures.get(key)||(stageIdx===0?textures.get('giant'):null);
 const cv=document.createElement('canvas');cv.width=1024;cv.height=1024;
 const ctx=cv.getContext('2d');
 if(baseTex&&baseTex.bitmap)ctx.drawImage(baseTex.bitmap,0,0);
 ctx.clearRect(0,0,640,768);
 ctx.drawImage(img,0,0,640,768,0,0,640,768);
 const tx=new_texture(cv);
 textures.set(key,tx);
 const curStage=typeof realmIndex==='number'?realmIndex:(xlActiveProfile&&xlActiveProfile.id==='socks'?1:xlActiveProfile&&xlActiveProfile.id==='paws'?2:0);
 if(curStage===stageIdx)textures.set('giant',tx);
}
function xlApplyCustomPacks(packs){
 if(!packs||typeof packs!=='object')return;
 const slotToStage={shoe:0,socks:1,paws:2};
 for(const [slot,pack] of Object.entries(packs)){
  if(!pack)continue;
  const stageIdx=slotToStage[slot];
  if(pack.geo)xlCustomPackGeo[slot]=pack.geo;
  if(Array.isArray(pack.masks)&&pack.masks.length===3){
   const profileId=slot==='shoe'?'sneakers':slot;
   if(XL_GEOMETRY[profileId])XL_GEOMETRY[profileId].mask=pack.masks[0].slice();
   const curStage=typeof realmIndex==='number'?realmIndex:0;
   if(curStage===stageIdx){paw.stomp_masks=pack.masks.map(m=>m.slice());init_stomp_masks();}
  }
  if(pack.format==='hd11'&&Array.isArray(pack.hdFrames)&&pack.hdFrames.length===11){
   Promise.all(pack.hdFrames.map(xlPackLoadImg)).then(imgs=>{
    render();
    const mp=new Map();
    for(let i=0;i<11;i++){const k='xl-pack-hd-'+slot+'-'+i,tx=new_texture(imgs[i]);tx.smooth=true;textures.set(k,tx);mp.set(i,k);}
    xlHdPacks.set('pack_'+slot,mp);
   }).catch(()=>{});
  }else if(pack.format==='atlas'&&pack.atlasDataUrl&&typeof stageIdx==='number'){
   xlPackLoadImg(pack.atlasDataUrl).then(img=>xlPackSpliceAtlas(stageIdx,img)).catch(()=>{});
  }
  if(slot==='shoe'&&pack.bgDataUrl){
   xlPackLoadImg(pack.bgDataUrl).then(img=>{
    const tx=new_texture(img);tx.smooth=true;xlCustomBgTex=tx;xlCustomBgWarm=pack.warmLight;
   }).catch(()=>{});
  }
 }
}
// Upgrade draw_back_paw and draw_front_paw to honor generalized xlGetHdFrame() on ALL stages (Act I, II, III & Free Mode).
const xlPackOldBack=draw_back_paw;
draw_back_paw=function(){
 if(hide_paws)return;
 const frame=clamp(round(pressure*4),0,4);
 const hdKey=window.xlGetHdFrame(frame+6);
 if(!hdKey){xlPackOldBack();return;}
 const scale=paw.width/160,yBase=(typeof customMotionSource!=='undefined'&&customMotionSource)?floor_y-floor_depth-6:h*paw.back_paw_y;
 const x=w*paw.back_paw_x,yDraw=yBase+(xlSkinGeo().backOffsets[frame]||0);
 if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready())xlFloorGfx.drawBackFootShadow(x,yBase,frame,paw.width,xlModeFade);
 const tx=textures.get(hdKey);
 alpha=xlModeFade;
 sprite_scaled([hdKey,0,0,(tx&&tx.w)||960,(tx&&tx.h)||1536],x,yDraw-256*scale,paw.width,256*scale);
 alpha=1;
};
if(typeof realmDrawTerrain==='function'){
 const xlPackOldTerrain=realmDrawTerrain;
 realmDrawTerrain=function(){
  if(typeof realmIndex==='number'&&realmIndex===0&&xlCustomBgTex){
   const a=alpha;alpha=1;set_texture(xlCustomBgTex);quad(0,0,w,h,0,0,xlCustomBgTex.w||1280,xlCustomBgTex.h||768);alpha=a;
   if(typeof xlFloorGfx!=='undefined')xlFloorGfx.drawFloorWash();
   if(paw_state!==3){
    const tx=clamp((typeof realmTouchOwns==='function'&&realmTouchOwns())?paw_x:(paw_dest_x||paw_x),0,w);
    const nn=typeof RealmTactics!=='undefined'?RealmTactics.landsNear(tx,bugs.filter(b=>b&&b.alive?.()),paw.width*.46):false;
    if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready())xlFloorGfx.drawTargetGuide(tx,floor_y-1,paw.width*.68,nn);
   }
   return;
  }
  return xlPackOldTerrain();
 };
}
// Auto-load active custom packs from parent window on startup
try{
 const rt=(window.parent&&window.parent.__cunjieRuntimePacks)||window.__cunjieRuntimePacks||null;
 if(rt)xlApplyCustomPacks(rt);
 const charPack=(window.parent&&window.parent.__cunjieCustomCharPack)||window.__cunjieCustomCharPack||null;
 if(charPack&&typeof customMotionSource!=='undefined'&&customMotionSource){
  xlApplyCustomPacks({character:charPack});
  if(charPack.bgDataUrl){
   xlPackLoadImg(charPack.bgDataUrl).then(img=>{
    const tx=new_texture(img);tx.smooth=true;textures.set('fenrirCity',tx);set.bg_spr=['fenrirCity',0,0,tx.w,tx.h];
   }).catch(()=>{});
  }
 }
}catch{}
