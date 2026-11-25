/* Bounded, first-act experience changes. No save or hit-mask changes. */
let v4Bodies=[];const v4Hit=realmAfterFx.hit,v4Update=realmAfterFx.update,v4Floor=draw_stains;
realmAfterFx.hit=function(b,prev,dead){
 if(realmIndex===0&&this.enabled&&active&&!pause&&!tr&&b.seen&&prev>b.health&&(dead||b.health<=0)&&!v4Bodies.some(m=>m.id===b)){
  const variant=(Math.imul(Number(b.xlId||0)^0x25b,2654435761)>>>0)%4;
  v4Bodies.push({id:b,variant,x:b.x,y:floor_y-1,age:0});if(v4Bodies.length>20)v4Bodies.shift();
 }
 return v4Hit.apply(this,arguments);
};
realmAfterFx.update=function(dt,...args){v4Update.call(this,dt,...args);for(const m of v4Bodies)m.age+=Math.max(0,Math.min(.05,dt));v4Bodies=v4Bodies.filter(m=>m.age<12);};
window.v4HasBody=b=>realmIndex===0&&v4Bodies.some(m=>m.id===b);
window.v4DrawBodies=()=>{if(realmIndex!==0||!realmAfterFx.enabled||!realmHumanArtReady)return;
 const a=alpha,f=hflip;hflip=false;
 for(const m of v4Bodies){alpha=Math.min(.88,(12-m.age)/4);sprite_scaled(['realm_tiny_humans',m.variant*48,128,48,64],m.x-15,m.y-8,30,8);}
 alpha=a;hflip=f;
};
draw_stains=function(){v4Floor();window.v4DrawBodies();};
const v4BugDraw=draw_bug;draw_bug=function(b){if(window.v4HasBody(b))return;return v4BugDraw(b);};
const v4Bugs=update_bugs;
update_bugs=function(){return v4Bugs();};
const roomKey=window.__cunjieRoomTheme||(()=>{try{return window.parent.localStorage.getItem('cunjie-room-theme')||'rooftop-day';}catch{return 'rooftop-day';}})();
let v4Room=null;const roomImg=new Image();
if(roomKey!=='original'){roomImg.onload=()=>{v4Room=new_texture(roomImg);v4Room.smooth=true;};roomImg.src=roomKey==='rooftop-day'?'/assets/rooftop/day.webp':roomKey==='rooftop-night'?'/assets/rooftop/night.webp':roomKey==='bedroom-wood'?'/assets/rooms/bedroom-wood.webp':roomKey==='rain'?'/assets/rooms/room-rain.webp':'/assets/rooms/room-warm.webp';}
const v4Terrain=realmDrawTerrain;
realmDrawTerrain=function(){
 if(realmIndex!==0||!v4Room)return v4Terrain();
 const iw=roomImg.naturalWidth||1280,ih=roomImg.naturalHeight||768;
 const c=(typeof xlSceneLight==='function'?xlSceneLight().crop:null)||[0,0,1280,768];
 const cx=Math.round(iw*(c[0]/1280)),cy=Math.round(ih*(c[1]/768)),cw=Math.round(iw*(c[2]/1280)),ch=Math.round(ih*(c[3]/768));
 const a=alpha;alpha=1;set_texture(v4Room);quad(0,0,w,h,cx,cy,cw,ch);alpha=a;
 if(typeof xlFloorGfx!=='undefined')xlFloorGfx.drawFloorWash();
 if(paw_state!==3){
  const tx=clamp(realmTouchOwns()?paw_x:(paw_dest_x||paw_x),0,w),nn=RealmTactics.landsNear(tx,bugs.filter(b=>b&&b.alive?.()),paw.width*.46);
  if(typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready())xlFloorGfx.drawTargetGuide(tx,floor_y-1,paw.width*.68,nn);
  else darkrect(tx-paw.width*.33,floor_y-4,paw.width*.66,3,nn?.30:.13);
 }
};
const v4Config=realmAfterFx.configure;
realmAfterFx.configure=function(p={}){v4Config.call(this,p);const fb=window.__cunjieShoeSkin||'aj5';this.shoeSkin=['aj5','aj6','qiaodan'].includes(p.shoeSkin)?p.shoeSkin:fb;};
const v4Setup=window.realmBridge.setup,v4Snapshot=window.realmBridge.snapshot;
window.realmBridge.setup=function(...args){v4Bodies=[];return v4Setup.apply(this,args);};
window.realmBridge.snapshot=function(){const s=v4Snapshot.call(this);return {...s,experienceV4:{bodies:v4Bodies.length,room:roomKey,roomReady:!!v4Room,npcSpeed:1}};};
