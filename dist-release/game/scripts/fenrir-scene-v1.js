/* Cunjie v6.3 — Fenrir 150 m city world / dead-zone camera adapter.
 * Decorative-only scene layers. Collision, NPC movement, paw physics, score and hunt state stay untouched.
 */
(function installFenrirCityScene(global){
 'use strict';
 if(global.__fenrirCitySceneV1)return;
 global.__fenrirCitySceneV1=true;
 const WORLD_WIDTH=2400;
 const WORLD_HEIGHT=240;
 const SPECS=[
  {key:'fenrirCityFarV1',url:'assets/fenrir/city-far.svg',parallax:.12},
  {key:'fenrirCityMidV1',url:'assets/fenrir/city-mid.svg',parallax:.36},
  {key:'fenrirCityNearV1',url:'assets/fenrir/city-near.svg',parallax:1.0}
 ];
 global.__installFenrirScene=function(context){
  if(!context||typeof context.spriteScaled!=='function'||!(context.textures instanceof Map)||typeof context.newTexture!=='function')return context&&context.spriteScaled;
  const original=context.spriteScaled,textures=context.textures,newTexture=context.newTexture;
  const requestedW=Number(context.w),requestedH=Number(context.h);
  const viewW=Number.isFinite(requestedW)&&requestedW>0?Math.min(WORLD_WIDTH,requestedW):400;
  const viewH=Number.isFinite(requestedH)&&requestedH>0?Math.min(WORLD_HEIGHT,requestedH):WORLD_HEIGHT;
  const maxScroll=Math.max(0,WORLD_WIDTH-viewW);
  const deadZone=viewW*.16,edgeSpan=Math.max(1,viewW*.5-deadZone);
  let ready=false,failed=false,cameraX=maxScroll*.5,targetX=cameraX,lastTime=0,lastPawX=null,pawVelocity=0;
  const status={ready:false,failed:false,worldWidth:WORLD_WIDTH,worldHeight:WORLD_HEIGHT,viewWidth:viewW,maxScroll,deadZone,cameraX,targetX,pawX:viewW*.5,pawVelocity};
  global.__fenrirCitySceneV1Status=status;
  function load(spec){
   return new Promise((resolve,reject)=>{
    const image=new Image();image.decoding='async';
    image.onload=()=>{try{const texture=newTexture(image);texture.smooth=true;textures.set(spec.key,texture);resolve(texture);}catch(error){reject(error);}};
    image.onerror=()=>reject(new Error('Unable to load '+spec.url));
    image.src=new URL(spec.url,document.baseURI).href;
   });
  }
  Promise.all(SPECS.map(load)).then(()=>{ready=true;status.ready=true;}).catch(error=>{failed=true;status.failed=true;if(global.console&&console.warn)console.warn('[Fenrir scene] Layer load failed; using original city backdrop.',error);});
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function getTarget(pawX,reduced,dt){
   if(reduced){lastPawX=pawX;pawVelocity=0;return maxScroll*.5;}
   if(dt>0&&lastPawX!==null)pawVelocity=clamp((pawX-lastPawX)/dt,-2400,2400);
   lastPawX=pawX;
   const offset=pawX-viewW*.5;
   if(Math.abs(offset)<=deadZone)return cameraX;
   const progress=clamp((Math.abs(offset)-deadZone)/edgeSpan,0,1);
   const base=maxScroll*.5+Math.sign(offset)*progress*maxScroll*.5;
   const lookAhead=clamp(pawVelocity*.055,-120,120);
   return clamp(base+lookAhead,0,maxScroll);
  }
  function wrapped(spr,x,y,ww,hh){
   if(!ready||!spr||spr[0]!=='fenrirCity')return original.apply(this,arguments);
   const now=performance.now(),dt=lastTime?clamp((now-lastTime)/1000,0,.05):0;lastTime=now;
   let pawX=viewW*.5;
   try{const value=Number(context.getPawX());if(Number.isFinite(value))pawX=clamp(value,0,viewW);}catch{}
   const prefs=global.__xlImmersionPrefs||{};
   targetX=getTarget(pawX,!!prefs.reduceMotion,dt);
   cameraX+=(targetX-cameraX)*(1-Math.exp(-7*dt));
   status.cameraX=cameraX;status.targetX=targetX;status.pawX=pawX;status.pawVelocity=pawVelocity;
   for(const layer of SPECS){
    const sourceX=Math.round(clamp(cameraX*layer.parallax,0,maxScroll));
    original.call(this,[layer.key,sourceX,0,viewW,viewH],x,y,ww,hh);
   }
  }
  return wrapped;
 };
})(window);
