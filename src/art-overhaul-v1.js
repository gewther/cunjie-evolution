/* Project Cunjie v6.3 — Cohesive Anime-Cel HD Art Overhaul Runtime.
 * Upgrades Act I (AJ5 / Qiaodan), Act II (Socks), Act III (Paws), Free Mode skins & backdrops,
 * HD Tinies sprite sheet (tinies-hd-v1.webp), and Crisp Vector Pressure Gauge.
 * Preserves Fenrir (customMotionSource / fenrirCity), custom .zip skin packs, hitboxes & saves.
 */
(function installCunjieArtOverhaulV1(){
 if(window.__cunjieArtOverhaulV1)return;
 window.__cunjieArtOverhaulV1=true;

 const xlArtHdGeo=__XL_HD_GEO__;
 if(typeof XL_SKIN_GEO==='object'&&XL_SKIN_GEO){
  Object.assign(XL_SKIN_GEO,xlArtHdGeo);
 }

 const BUILTIN_HD_SKINS=['aj5','qiaodan','socks','paws'];
 const ROOM_URLS={
  'rooftop-day':'assets/rooftop/day.webp',
  'rooftop-night':'assets/rooftop/night.webp',
  'bedroom-wood':'assets/rooms/bedroom-wood.webp',
  'warm':'assets/rooms/room-warm.webp',
  'rain':'assets/rooms/room-rain.webp'
 };

 function getParentData(){
  try{return window.parent&&window.parent.DATA?window.parent.DATA:null;}catch{return null;}
 }
 function loadImageAsync(url){
  return new Promise((resolve,reject)=>{
   if(typeof Image!=='function'){reject(new Error('Image unavailable'));return;}
   const im=new Image();
   im.decoding='async';
   im.onload=()=>resolve(im);
   im.onerror=()=>reject(new Error('Art load failed: '+url));
   im.src=url;
  });
 }
 function makeSmoothTex(img){
  if(typeof new_texture!=='function')return null;
  const tx=new_texture(img);
  if(tx)tx.smooth=true;
  return tx;
 }
 function hasCustomMotion(){
  return typeof customMotionSource!=='undefined'&&!!customMotionSource;
 }
 function isFenrir(){
  return typeof fenrirCity!=='undefined'&&!!fenrirCity;
 }
 function hasCustomPackForActiveSlot(){
  if(typeof xlActiveSlotKey!=='function'||typeof xlHdPacks==='undefined'||!xlHdPacks)return false;
  const mp=xlHdPacks.get('pack_'+xlActiveSlotKey());
  return !!(mp&&mp.size===11);
 }

 function xlBuiltInSkinName(){
  if(hasCustomMotion())return null;
  if(typeof realmIndex==='number'){
   if(realmIndex===1)return 'socks';
   if(realmIndex===2)return 'paws';
   const s=window.__cunjieShoeSkin||(typeof realmAfterFx!=='undefined'&&realmAfterFx&&realmAfterFx.shoeSkin)||'aj5';
   if(s==='aj6')return null;
   return (s==='qiaodan')?'qiaodan':'aj5';
  }
  const base=(typeof xlActiveProfile!=='undefined'&&xlActiveProfile&&xlActiveProfile.id)?xlActiveProfile.id:'sneakers';
  if(base==='socks')return 'socks';
  if(base==='paws')return 'paws';
  const s=window.__cunjieShoeSkin||'aj5';
  if(s==='aj6')return null;
  return (s==='qiaodan')?'qiaodan':'aj5';
 }

 // Ensure AJ6 offline DATA.aj6Hd also loads cleanly even if boot ran before parent DATA populated
 function ensureAj6OfflineFallback(){
  if(hasCustomMotion()||typeof realmAJ6Frames==='undefined'||realmAJ6Frames.size===11)return;
  if(!window.cunjieHDaj6)return;
  const data=getParentData();
  const urls=(data&&Array.isArray(data.aj6Hd)&&data.aj6Hd.length===11)?data.aj6Hd:null;
  if(!urls||window.__xlAj6FallbackLoading)return;
  window.__xlAj6FallbackLoading=true;
  Promise.all(urls.map(loadImageAsync)).then(imgs=>{
   if(typeof render==='function')render();
   for(let i=0;i<imgs.length;i++){
    const key='realm-aj6-frame-'+i;
    const tx=makeSmoothTex(imgs[i]);
    if(tx&&typeof textures!=='undefined'){textures.set(key,tx);realmAJ6Frames.set(i,key);}
   }
  }).catch(()=>{window.__xlAj6FallbackLoading=false;});
 }

 const xlBuiltInSkins=new Map();
 const xlBuiltInLoading=new Set();
 function getSkinUrls(skin){
  const data=getParentData();
  const offline=data&&data.skinHd&&data.skinHd[skin];
  if(Array.isArray(offline)&&offline.length===11)return offline;
  const arr=[];
  for(let i=0;i<11;i++)arr.push('assets/'+skin+'-hd/'+i+'.webp');
  return arr;
 }
 function xlEnsureBuiltInSkin(skin){
  if(!skin||BUILTIN_HD_SKINS.indexOf(skin)<0)return null;
  const cached=xlBuiltInSkins.get(skin);
  if(cached&&cached.size===11)return cached;
  if(xlBuiltInLoading.has(skin))return null;
  xlBuiltInLoading.add(skin);
  Promise.all(getSkinUrls(skin).map(loadImageAsync)).then(imgs=>{
   if(typeof render==='function')render();
   const mp=new Map();
   for(let i=0;i<11;i++){
    const key='xl-art-hd-'+skin+'-'+i;
    const tx=makeSmoothTex(imgs[i]);
    if(tx&&typeof textures!=='undefined'){textures.set(key,tx);mp.set(i,key);}
   }
   if(mp.size===11)xlBuiltInSkins.set(skin,mp);
   else xlBuiltInLoading.delete(skin);
  }).catch(()=>{xlBuiltInLoading.delete(skin);});
  return null;
 }

 const artOrigSkinId=typeof xlSkinId==='function'?xlSkinId:null;
 if(artOrigSkinId){
  xlSkinId=function(){
   if(!hasCustomMotion()&&!hasCustomPackForActiveSlot()){
    const skin=xlBuiltInSkinName();
    if(skin){
     const mp=xlBuiltInSkins.get(skin);
     if(mp&&mp.size===11&&typeof XL_SKIN_GEO==='object'&&XL_SKIN_GEO[skin+'hd']){
      return skin+'hd';
     }
    }
   }
   return artOrigSkinId();
  };
 }

 const artOrigGetHdFrame=typeof window.xlGetHdFrame==='function'?window.xlGetHdFrame:null;
 window.xlGetHdFrame=function(frameIdx){
  if(artOrigGetHdFrame){
   const baseHit=artOrigGetHdFrame(frameIdx);
   if(baseHit)return baseHit;
  }
  if(hasCustomMotion())return null;
  const skin=xlBuiltInSkinName();
  if(!skin){
   ensureAj6OfflineFallback();
   return null;
  }
  const mp=xlEnsureBuiltInSkin(skin);
  if(mp&&mp.size===11&&mp.has(frameIdx))return mp.get(frameIdx);
  return null;
 };

 function kickPreloads(){
  const cur=xlBuiltInSkinName();
  if(cur)xlEnsureBuiltInSkin(cur);
  else ensureAj6OfflineFallback();
  if(!hasCustomMotion()){
   setTimeout(()=>{
    xlEnsureBuiltInSkin('socks');
    xlEnsureBuiltInSkin('paws');
   },140);
  }
 }
 kickPreloads();

 if(window.realmBridge&&typeof window.realmBridge.setup==='function'){
  const artOrigSetup=window.realmBridge.setup;
  window.realmBridge.setup=function(...args){
   const res=artOrigSetup.apply(this,args);
   kickPreloads();
   return res;
  };
 }

 // --- 1. HD Front Paw Rendering across Act I (airborne/fallback), Act II, Act III & Free Mode ---
 function artTrailsAllowed(){
  if(typeof realmPrefs!=='undefined'&&realmPrefs&&realmPrefs.impactFx===false)return false;
  if(typeof realmMood!=='undefined'&&realmMood&&(realmMood.reduceMotion||realmMood.lowEffects))return false;
  const imm=window.__xlImmersionPrefs||null;
  if(imm&&(imm.reduceMotion||imm.lowEffects))return false;
  return true;
 }
 function drawHdFrameWithTrails(hdKey,frame,yOff,includeTrails){
  const s=paw.front_spr,uw=s[3],uh=s[4],dw=paw.width,dh=uh*(dw/uw);
  const fo=(typeof xlSkinGeo==='function'?xlSkinGeo():(XL_SKIN_GEO[typeof xlSkinId==='function'?xlSkinId():'aj5']||XL_GEOMETRY[xlActiveProfile.id])).frontOffsets;
  const tx=typeof textures!=='undefined'?textures.get(hdKey):null;
  const sprSrc=[hdKey,0,0,(tx&&tx.w)||480,(tx&&tx.h)||768];
  const yBottom=paw_y+yOff+(fo[frame]||0);
  const fade=typeof xlModeFade==='number'?xlModeFade:1;
  if(includeTrails&&artTrailsAllowed()){
   if(typeof window.__xlDrawAirTrails==='function'){
    window.__xlDrawAirTrails(sprSrc,paw_x-dw/2-paw.offset,yBottom,dw,dh,330,.07,7,14,.038);
   }else if(typeof paw_y_velo==='number'&&paw_y_velo>330){
    const speedK=Math.min(1,(paw_y_velo-330)/1500);
    const oldAlpha=alpha;
    for(let k=3;k>=1;k--){
     alpha=fade*(.07+.14*speedK)/k;
     const dy=k*(7+14*speedK),stretch=1+.038*speedK;
     sprite_scaled(sprSrc,paw_x-dw/2-paw.offset,yBottom-dy-dh*stretch,dw,dh*stretch);
    }
    alpha=oldAlpha;
   }
  }
  alpha=fade;
  sprite_scaled(sprSrc,paw_x-dw/2-paw.offset,yBottom-dh,dw,dh);
  if(typeof draw_stickers==='function')draw_stickers();
  alpha=1;
 }

 const artOrigFront=typeof draw_front_paw==='function'?draw_front_paw:null;
 if(artOrigFront){
  draw_front_paw=function(){
   if(typeof hide_paws!=='undefined'&&hide_paws){return artOrigFront();}
   const fade=typeof xlModeFade==='number'?xlModeFade:1;

   // Story Mode (Act I, II, III)
   if(typeof realmIndex==='number'){
    if(realmIndex===0){
     const impactOn=(typeof realmPrefs==='undefined'||realmPrefs.impactFx!==false)&&!(typeof realmMood!=='undefined'&&realmMood.reduceMotion);
     if(impactOn&&typeof evoContact!=='undefined'&&evoContact&&evoContact.grounded){
      artOrigFront();
      if(typeof realmDebug!=='undefined'&&realmDebug&&typeof realmFrameGeometry==='function'){
       realmLastSprite=realmFrameGeometry(realmContactFrame());
       if(typeof realmDrawDebug==='function')realmDrawDebug();
      }
      return;
     }
     let y_off=0,frame=paw_state,stompLocal=0;
     if(paw_state===3&&!paw.steamroller){
      if(supports>0)y_off=pin_min_y-floor_y;
      else if(pressure>0.2)y_off=4;
     }
     if(pin_min_y>=floor_y||paw.steamroller)stompLocal+=clamp(ceil(pressure*4)-1,0,2);
     else if(paw_state===3&&pressure>0.1)frame=4;
     stomp_frame=stompLocal;
     const fIdx=frame+stompLocal;
     const hdKey=window.xlGetHdFrame(fIdx);
     if(!hdKey)return artOrigFront();
     drawHdFrameWithTrails(hdKey,fIdx,y_off,paw_state!==3&&impactOn&&!(typeof realmMood!=='undefined'&&realmMood.lowEffects));
     if(typeof realmDebug!=='undefined'&&realmDebug&&typeof realmFrameGeometry==='function'){
      realmLastSprite=realmFrameGeometry(realmContactFrame());
      if(typeof realmDrawDebug==='function')realmDrawDebug();
     }
     return;
    }

    if(realmIndex===1||paw_state!==3){
     const impactOn=(typeof realmPrefs==='undefined'||realmPrefs.impactFx!==false)&&!(typeof realmMood!=='undefined'&&realmMood.reduceMotion);
     if(realmIndex===1&&paw_state===3&&impactOn&&typeof evoContact!=='undefined'&&evoContact&&evoContact.grounded){
      const fChk=3+Math.min(2,Math.max(0,Math.ceil(pressure*4)-1));
      if(window.xlGetHdFrame(fChk)){
       artOrigFront();
       if(typeof realmDebug!=='undefined'&&realmDebug&&typeof realmFrameGeometry==='function'){
        realmLastSprite=realmFrameGeometry(realmContactFrame());
        if(typeof realmDrawDebug==='function')realmDrawDebug();
       }
       return;
      }
     }
     let frame=paw_state,stompLocal=0,off=0;
     if(paw_state===3&&!paw.steamroller){if(supports>0)off=pin_min_y-floor_y;else if(pressure>0.2)off=4;}
     if(pin_min_y>=floor_y||paw.steamroller)stompLocal+=clamp(Math.ceil(pressure*4)-1,0,2);
     else if(paw_state===3&&pressure>0.1)frame=4;
     stomp_frame=stompLocal;
     const f=frame+stompLocal;
     const hdKey=window.xlGetHdFrame(f);
     if(!hdKey)return artOrigFront();
     const g=realmFrameGeometry(f,off);
     realmLastSprite=g;
     const tx=textures.get(hdKey);
     const tw=(tx&&tx.w)||480,th=(tx&&tx.h)||768;
     if(paw_state!==3&&artTrailsAllowed()&&typeof paw_y_velo==='number'&&paw_y_velo>320){
      const speedK=Math.min(1,(paw_y_velo-320)/1500),oldA=alpha;
      for(let k=3;k>=1;k--){
       alpha=fade*(.07+.15*speedK)/k;
       const dy=k*(7+15*speedK),stretch=1+.04*speedK;
       sprite_scaled([hdKey,0,0,tw,th],g.x,g.y+g.h-dy-g.h*stretch,g.w,g.h*stretch);
      }
      alpha=oldA;
     }
     alpha=fade;
     sprite_scaled([hdKey,0,0,tw,th],g.x,g.y,g.w,g.h);
     alpha=1;
     if(typeof realmDrawDebug==='function')realmDrawDebug();
     return;
    }

    // Act III (realmIndex === 2 && paw_state === 3): 5-toe adaptive contact wiggle with HD paws
    const frame=3+Math.min(2,Math.max(0,Math.ceil(pressure*4)-1));
    stomp_frame=frame-3;
    const hdKey=window.xlGetHdFrame(frame);
    if(!hdKey)return artOrigFront();
    const g=realmFrameGeometry(frame);
    realmLastSprite=g;
    const tx=textures.get(hdKey),tw=(tx&&tx.w)||480,th=(tx&&tx.h)||768;
    const splitFrac=206/256,sySplit=Math.round(th*splitFrac);
    const squash=(typeof evoContact!=='undefined'&&evoContact&&(typeof realmPrefs==='undefined'||realmPrefs.impactFx!==false)&&!(typeof realmMood!=='undefined'&&realmMood.reduceMotion))?evoContact.squash()*0.52:0;
    const extraW=g.w*squash*0.48,baseY=g.y+g.h*squash,drawW=g.w+extraW,drawH=g.h*(1-squash),drawX=g.x-extraW/2;
    alpha=fade;
    sprite_scaled([hdKey,0,0,tw,sySplit],drawX,baseY,drawW,drawH*splitFrac);
    const d=pressure*2.4;
    for(let i=0;i<5;i++){
     const sx=Math.round(tw*i/5),sw=Math.round(tw*(i+1)/5)-sx;
     const sink=d*(0.5+Math.sin(i+stats.time_elapsed*4)*0.15);
     sprite_scaled([hdKey,sx,sySplit,sw,th-sySplit],drawX+drawW*(i/5),baseY+drawH*splitFrac+sink,drawW/5,Math.max(1,drawH*(1-splitFrac)-sink));
    }
    alpha=1;
    if(typeof realmDrawDebug==='function')realmDrawDebug();
    return;
   }

   // Free Mode (no realmIndex)
   if(typeof window.xlFreeContact!=='undefined'&&window.xlFreeContact&&window.xlFreeContact.grounded){
    return artOrigFront();
   }
   const frame=paw_state;
   const hdKey=window.xlGetHdFrame(frame);
   if(!hdKey)return artOrigFront();
   drawHdFrameWithTrails(hdKey,frame,0,artTrailsAllowed());
  };
 }

 // --- 2. HD Tiny Civilians (2048x512 = 4 outfit variants x 4 cols x 4 rows of 128x128) ---
 let tiniesHdReady=false;
 const tiniesUrl=(()=>{const d=getParentData();return (d&&d.tiniesHd)||'assets/tinies/tinies-hd-v1.webp';})();
 if(tiniesUrl&&!hasCustomMotion()){
  loadImageAsync(tiniesUrl).then(img=>{
   const tx=makeSmoothTex(img);
   if(tx&&typeof textures!=='undefined'){textures.set('tinies_hd_v1',tx);tiniesHdReady=true;}
  }).catch(()=>{tiniesHdReady=false;});
 }
 function artTiniesReady(){
  return tiniesHdReady&&typeof textures!=='undefined'&&textures.has('tinies_hd_v1')&&!hasCustomMotion();
 }

 let bugVariantSeq=0;
 function getBugVariant(b){
  if(typeof b.xlHdVar==='number')return b.xlHdVar;
  let seed=0;
  if(b.xlId!==undefined&&b.xlId!==null)seed=Number(b.xlId)^0x25b;
  else seed=(++bugVariantSeq)^((b.fit&&b.fit.off_y)||0);
  const v=(Math.imul(seed,2654435761)>>>0)%4;
  b.xlHdVar=v;
  return v;
 }
 function getBugCell(b){
  if(b.knocked)return {row:2,col:b.onback?3:2};
  if(b.rolling||(b.xlDeadAge||0)>0||b.realmSocialState==='fallen'||b.realmHidden)return {row:2,col:2};
  if(b.agitated||b.realmSocialState==='flee'||b.realmSocialState==='help'||b.realmSocialState==='signal'||Math.abs(b.x_vel||0)>1){
   return {row:1,col:Math.floor(Math.abs((b.tick||0)*0.24))%4};
  }
  const maxHp=typeof bug_max_hp==='number'?bug_max_hp:5;
  if(typeof b.health==='number'&&b.health<maxHp){
   if(b.health<=maxHp-2)return {row:2,col:1};
   const tk=Math.floor(Math.abs(b.tick||0));
   return {row:(tk&16)?3:2,col:0};
  }
  return {row:0,col:Math.floor(Math.abs((b.tick||0)*0.14))%4};
 }

 const artOrigBugDraw=typeof draw_bug==='function'?draw_bug:null;
 if(artOrigBugDraw){
  draw_bug=function(b){
   if(!b)return;
   if(!artTiniesReady())return artOrigBugDraw(b);
   if(typeof window.v4HasBody==='function'&&window.v4HasBody(b))return;
   if(typeof realmImpact!=='undefined'&&typeof realmImpact.enabled==='function'&&realmImpact.enabled()&&realmImpact.ready()&&(b.impactStateUntil||0)>realmImpact.clock)return;
   if((b.xlDeadAge||0)>2.3)return;

   const v=getBugVariant(b);
   const cell=getBugCell(b);
   const bx=b.x+(b.knocked&&typeof b.alive==='function'&&b.alive()&&(b.buckling||b.get_up===1||b.get_up===2)&&((typeof tick==='number'?tick:0)%4>1)?1:0);
   const bz=b.z||0;

   if(typeof realmIndex==='number'){
    const scale=typeof realmVisual==='function'?realmVisual().tinyScale:1;
    const dw=40*scale,dh=40*scale,padFix=dh*(4/128);
    if(b.realmSocialState==='help'&&b.realmSocialTarget&&typeof b.realmSocialTarget.alive==='function'&&b.realmSocialTarget.alive()){
     const dx=b.realmSocialTarget.x-bx;
     if(Math.abs(dx)<32&&typeof darkrect==='function')darkrect(bx+Math.sign(dx)*3,b.y-bz-dh*0.66,Math.min(11,Math.abs(dx)*0.35),2,0.22);
    }
    const tinyAlpha=(realmIndex>=1&&b.realmHidden?0.58:1)*(b.xlDeadAge?Math.max(0,1-b.xlDeadAge/7):1);
    if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready())xlFloorGfx.drawTinyShadow(bx,b.y-bz+0.6,24*scale,tinyAlpha);
    hflip=(b.dir||1)<0;
    alpha=tinyAlpha;
    sprite_scaled(['tinies_hd_v1',(v*4+cell.col)*128,cell.row*128,128,128],bx-dw/2,b.y-bz-dh+padFix,dw,dh);
    alpha=1;
    hflip=false;
    return;
   }

   // Free / Fenrir Mode
   const tinyAlpha=b.xlDeadAge?Math.max(0,1-b.xlDeadAge/2.3):1;
   alpha=tinyAlpha;
   if(typeof b.draw_under==='function')b.draw_under();
   if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready()){
    xlFloorGfx.drawTinyShadow(bx,b.y-bz+0.6,18,tinyAlpha);
   }else if(b.fit&&b.fit.shadow_spr&&typeof set_fit==='function'&&typeof unset_fit==='function'){
    const fit=set_fit(b.fit);
    sprite(fit.shadow_spr,bx,b.y-bz,0,0.5,0.5);
    unset_fit();
   }
   const dw=31,dh=31,padFix=dh*(4/128);
   hflip=(b.dir||1)<0;
   alpha=tinyAlpha;
   sprite_scaled(['tinies_hd_v1',(v*4+cell.col)*128,cell.row*128,128,128],bx-dw/2,b.y-bz-dh+padFix,dw,dh);
   alpha=1;
   hflip=false;
  };
 }

 if(typeof window.v4DrawBodies==='function'){
  const artOrigV4Bodies=window.v4DrawBodies;
  window.v4DrawBodies=function(){
   if(typeof realmIndex!=='number'||realmIndex!==0||typeof realmAfterFx==='undefined'||!realmAfterFx.enabled)return;
   if(!artTiniesReady())return artOrigV4Bodies();
   const a=alpha,f=hflip;
   hflip=false;
   if(typeof v4Bodies!=='undefined'&&Array.isArray(v4Bodies)){
    for(const m of v4Bodies){
     alpha=Math.min(0.88,(12-m.age)/4);
     sprite_scaled(['tinies_hd_v1',(m.variant*4+2)*128+14,2*128+70,100,56],m.x-17,m.y-9,34,10);
    }
   }
   alpha=a;
   hflip=f;
  };
 }

 const artOrigFallers=typeof draw_fallers==='function'?draw_fallers:null;
 if(artOrigFallers){
  draw_fallers=function(){
   if(!artTiniesReady())return artOrigFallers();
   if(typeof fallers==='undefined'||!Array.isArray(fallers))return;
   const prevA=alpha,prevF=hflip;
   const scale=typeof realmVisual==='function'?realmVisual().tinyScale:1;
   const dw=34*scale,dh=34*scale,padFix=dh*(4/128);
   for(const f of fallers){
    const v=getBugVariant(f);
    const col=1+(Math.floor(Math.abs(f.frame||0))%3);
    hflip=(f.xv||f.x_vel||0)<0;
    alpha=1;
    sprite_scaled(['tinies_hd_v1',(v*4+col)*128,3*128,128,128],f.x-dw/2,f.y-dh+padFix,dw,dh);
   }
   alpha=prevA;
   hflip=prevF;
  };
 }

 // --- 3. Free Mode HD Backdrop + Vector Vertical Pressure Gauge ---
 let artFreeRoomTex=null;
 const artFreeRoomLoading=new Set();
 function resolveFreeRoomKey(){
  if(window.__cunjieRoomTheme)return window.__cunjieRoomTheme;
  try{
   const p=window.parent;
   const el=p&&p.document&&p.document.getElementById&&p.document.getElementById('roomTheme');
   if(el&&el.value)return el.value;
   return (p&&p.localStorage&&p.localStorage.getItem('cunjie-room-theme'))||'rooftop-day';
  }catch{return 'rooftop-day';}
 }
 function ensureFreeRoomBackdrop(){
  if(typeof realmIndex==='number'||isFenrir()||hasCustomMotion())return null;
  const rk=resolveFreeRoomKey();
  if(rk==='original')return null;
  const key='xl-free-room-'+rk;
  if(typeof textures!=='undefined'&&textures.has(key))return key;
  if(artFreeRoomLoading.has(rk))return null;
  const data=getParentData();
  const url=(data&&data.rooms&&data.rooms[rk])||ROOM_URLS[rk];
  if(!url)return null;
  artFreeRoomLoading.add(rk);
  loadImageAsync(url).then(img=>{
   const tx=makeSmoothTex(img);
   if(tx&&typeof textures!=='undefined'){textures.set(key,tx);artFreeRoomTex=tx;}
   else artFreeRoomLoading.delete(rk);
  }).catch(()=>{artFreeRoomLoading.delete(rk);});
  return null;
 }
 ensureFreeRoomBackdrop();

 function drawFreeHdScene(){
  if(isFenrir()||hasCustomMotion())return;
  if(typeof set!=='undefined'&&set.bg_spr&&set.bg_spr[0]==='fenrirCity')return;
  const texKey=ensureFreeRoomBackdrop();
  if(!texKey)return;
  const tx=textures.get(texKey);
  if(!tx)return;
  const oldA=alpha,oldF=hflip;
  alpha=1;hflip=false;
  sprite_scaled([texKey,0,0,tx.w||1280,tx.h||768],0,0,w,h);
  alpha=oldA;hflip=oldF;
  if(typeof xlFloorGfx!=='undefined'&&typeof xlFloorGfx.drawFloorWash==='function'){
   xlFloorGfx.drawFloorWash();
  }
 }

 if(typeof Endless==='function'&&Endless.prototype){
  const artOrigEndlessScene=Endless.prototype.draw_scene;
  Endless.prototype.draw_scene=function(){
   if(typeof artOrigEndlessScene==='function')artOrigEndlessScene.apply(this,arguments);
   drawFreeHdScene();
  };
 }
 if(typeof EndScreen==='function'&&EndScreen.prototype){
  const artOrigEndScreenScene=EndScreen.prototype.draw_scene;
  EndScreen.prototype.draw_scene=function(){
   if(typeof artOrigEndScreenScene==='function')artOrigEndScreenScene.apply(this,arguments);
   drawFreeHdScene();
  };
 }

 let artShowVectorPressure=false;
 if(typeof Endless==='function'&&Endless.prototype&&typeof Endless.prototype.draw_ui==='function'){
  const artOrigEndlessUi=Endless.prototype.draw_ui;
  Endless.prototype.draw_ui=function(){
   const useVector=!isFenrir()&&typeof paw_state!=='undefined'&&paw_state===3&&typeof set!=='undefined'&&set.show_pressure&&typeof exhausted!=='undefined'&&!exhausted;
   const prevShow=set&&set.show_pressure;
   if(useVector){
    artShowVectorPressure=true;
    set.show_pressure=false;
   }else{
    artShowVectorPressure=false;
   }
   try{
    return artOrigEndlessUi.apply(this,arguments);
   }finally{
    if(useVector)set.show_pressure=prevShow;
   }
  };
 }

 function drawRoundedPill(ctx,x,y,rw,rh,r){
  const rad=Math.min(r,rw/2,rh/2);
  ctx.beginPath();
  ctx.moveTo(x+rad,y);
  ctx.lineTo(x+rw-rad,y);
  ctx.quadraticCurveTo(x+rw,y,x+rw,y+rad);
  ctx.lineTo(x+rw,y+rh-rad);
  ctx.quadraticCurveTo(x+rw,y+rh,x+rw-rad,y+rh);
  ctx.lineTo(x+rad,y+rh);
  ctx.quadraticCurveTo(x,y+rh,x,y+rh-rad);
  ctx.lineTo(x,y+rad);
  ctx.quadraticCurveTo(x,y,x+rad,y);
  ctx.closePath();
 }

 const artOrigDraw=typeof draw==='function'?draw:null;
 if(artOrigDraw&&typeof occ!=='undefined'&&occ){
  draw=function(){
   artShowVectorPressure=false;
   artOrigDraw.apply(this,arguments);
   if(!artShowVectorPressure||typeof active==='undefined'||!active||pause||tr)return;
   const p=clamp(Number(typeof pressure==='number'?pressure:0),0,1);
   const sx=(typeof quality!=='undefined'&&quality.displayScaleX)||sc;
   const sy=(typeof quality!=='undefined'&&quality.displayScaleY)||sc;
   occ.save();
   occ.setTransform(sx,0,0,sy,0,0);
   const x=10,y=62,bw=11,bh=96;
   drawRoundedPill(occ,x,y,bw,bh,5.5);
   occ.fillStyle='rgba(12,18,26,0.72)';
   occ.fill();
   occ.lineWidth=0.9;
   occ.strokeStyle='rgba(218,236,248,0.28)';
   occ.stroke();
   const pad=1.8,innerH=bh-pad*2,fillH=Math.max(0,innerH*Math.max(0.04,p));
   if(fillH>0.5){
    const gy=y+bh-pad-fillH;
    const grad=occ.createLinearGradient(0,y+bh-pad,0,y+pad);
    grad.addColorStop(0,'#45d9f5');
    grad.addColorStop(0.55,'#ffd166');
    grad.addColorStop(1,'#ff5a6e');
    drawRoundedPill(occ,x+pad,gy,bw-pad*2,fillH,4);
    occ.fillStyle=grad;
    occ.fill();
   }
   occ.strokeStyle='rgba(255,255,255,0.22)';
   occ.lineWidth=0.6;
   for(const f of [0.25,0.5,0.75]){
    const ty=y+pad+innerH*(1-f);
    occ.beginPath();occ.moveTo(x+2.2,ty);occ.lineTo(x+bw-2.2,ty);occ.stroke();
   }
   occ.fillStyle='rgba(232,246,255,0.92)';
   occ.font='bold 7px sans-serif';
   occ.textAlign='center';
   occ.fillText(Math.round(p*100)+'%',x+bw/2,y+bh+9);
   occ.restore();
  };
 }

 window.__xlArtOverhaulDebug=()=>({
  skin:xlBuiltInSkinName(),
  loadedSkins:[...xlBuiltInSkins.keys()],
  tiniesReady:artTiniesReady(),
  freeRoom:artFreeRoomTex?resolveFreeRoomKey():null
 });
})();
