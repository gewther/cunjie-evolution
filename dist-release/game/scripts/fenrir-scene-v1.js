/* Cunjie v6.2 — Fenrir city scale / parallax background adapter.
 * Decorative-only scene layers. No collision, NPC, paw, score, or hunt-state mutation.
 */
(function installFenrirCityScene(global){
 'use strict';
 if(global.__fenrirCitySceneV1)return;
 global.__fenrirCitySceneV1=true;
 const SPECS=[
  {key:'fenrirCityFarV1',url:'assets/fenrir/city-far.svg',parallax:.12},
  {key:'fenrirCityMidV1',url:'assets/fenrir/city-mid.svg',parallax:.36},
  {key:'fenrirCityNearV1',url:'assets/fenrir/city-near.svg',parallax:1.0}
 ];
 global.__installFenrirScene=function(context){
  if(!context||typeof context.spriteScaled!=='function'||!(context.textures instanceof Map)||typeof context.newTexture!=='function')return context&&context.spriteScaled;
  const original=context.spriteScaled,textures=context.textures,newTexture=context.newTexture;
  const viewW=400,viewH=240,maxScroll=800;
  let ready=false,failed=false,cameraX=maxScroll*.5,lastTime=0;
  const status={ready:false,failed:false,cameraX};global.__fenrirCitySceneV1Status=status;
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
  function wrapped(spr,x,y,ww,hh){
   if(!ready||!spr||spr[0]!=='fenrirCity')return original.apply(this,arguments);
   const now=performance.now(),dt=lastTime?clamp((now-lastTime)/1000,0,.05):0;lastTime=now;
   let pawX=viewW*.5;try{const value=Number(context.getPawX());if(Number.isFinite(value))pawX=clamp(value,0,viewW);}catch{}
   const prefs=global.__xlImmersionPrefs||{};
   const reduced=!!prefs.reduceMotion;
   const target=reduced?maxScroll*.5:(pawX/viewW)*maxScroll;
   cameraX+=(target-cameraX)*(1-Math.exp(-7*dt));
   status.cameraX=cameraX;
   for(const layer of SPECS){
    const sourceX=Math.round(clamp(cameraX*layer.parallax,0,maxScroll));
    original.call(this,[layer.key,sourceX,0,viewW,viewH],x,y,ww,hh);
   }
  }
  return wrapped;
 };
})(window);
