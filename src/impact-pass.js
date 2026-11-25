/* Impact Feel Pass v1. AJ6 / Act I only. The baseline renderer is retained. */
const realmImpactAtlas = new Image();
realmImpactAtlas.src = '/assets/impact/impact-atlas-v1.png';
const realmImpactRects = __IMPACT_RECTS__;
const realmImpactQA=(()=>{try{return new URLSearchParams(window.parent.location.search).has('impactQA');}catch{return false;}})();
const realmImpact = {
 clock:0, mode:'', phase:'ready', path:null, pressure:0, groundAge:0,
 wasGround:false, marks:[], contacts:[], trails:[], bodies:[], hits:0,
 cycleHits:0, cycle:0, landings:0, releases:0, soundEvents:[], pressureStep:0,
 soundAt:-99, lastX:0, lastDraws:0, reduced:false,
 enabled(){return realmIndex===0 && realmAfterFx.shoeSkin==='aj6';},
 ready(){return realmImpactAtlas.complete && realmImpactAtlas.naturalWidth>0;},
 reset(){this.clock=0;this.mode='';this.phase='ready';this.path=null;this.pressure=0;this.groundAge=0;
  this.wasGround=false;this.marks=[];this.contacts=[];this.trails=[];this.bodies=[];
  this.hits=0;this.cycle=0;this.cycleHits=0;this.landings=0;this.releases=0;this.pressureStep=0;this.soundEvents=[];this.soundAt=-99;},
 target(dt,raw){
  if(!this.enabled())return raw;
  dt=Math.max(0,Math.min(.08,dt));this.clock+=dt;
  const grounded=paw_state===3, mode=raw<floor_y-1?'up':'down';
  if(grounded&&!this.wasGround){this.groundAge=0;this.phase='contact';this.pressureStep=0;this.landings++;}
  if(grounded)this.groundAge+=dt;
  if(!grounded&&this.wasGround){
   this.releases++;this.phase='release';
   if(this.cycleHits>0){
    for(const c of this.contacts.filter(c=>c.cycle===this.cycle).slice(-3))this.trails.push({...c,age:0,broken:false});
   }
  }
  this.wasGround=grounded;
  if(mode!==this.mode){this.mode=mode;if(mode==='down'&&!grounded){this.cycle++;this.cycleHits=0;}}
  this.path=null;
  this.pressure=grounded?Math.max(0,Math.min(1,(raw-h)/h)):0;
  if(grounded){
   this.phase=this.groundAge<.04?'contact':this.pressure>.18?'compression':'landed';
   if(this.cycleHits>0&&this.pressure>.4&&this.pressureStep===0){this.accent('pressure',.23,.89);this.pressureStep=1;}
   if(this.cycleHits>0&&this.pressure>.76&&this.pressureStep===1){this.accent('pressure',.15,.79);this.pressureStep=2;}
  }else{
   const strandsAttached=typeof attached_strands!=='undefined'&&attached_strands>0;
   this.phase=mode==='up'?(strandsAttached?'adhesive-release':'lift'):'descent';
  }
  return raw;
 },
 velocity(dt,normal){
  if(!this.enabled())return normal;
  if(paw_state===3){this.phase=this.pressure>.18?'compression':'landed';return normal;}
  const strandsAttached=typeof attached_strands!=='undefined'&&attached_strands>0;
  if(normal>1)this.phase='descent';
  else if(normal<-1)this.phase=strandsAttached?'adhesive-release':'lift';
  else this.phase=this.mode==='up'?'raised':'landed';
  return normal;
 },
 accent(kind){
  if(!realmPrefs.sound)return;
  this.soundEvents.push({kind,time:this.clock});if(this.soundEvents.length>48)this.soundEvents.shift();
 },
 hit(b,prev,dead){
  if(!active||pause||tr||!b.seen||prev<=b.health)return;
  if(this.clock-(b.impactLast??-99)<.14)return;b.impactLast=this.clock;
  this.hits++;this.cycleHits++;
  const x=Math.max(1,Math.min(w-1,b.x)),u=Math.max(.04,Math.min(.96,(x-(paw_x-paw.width/2))/paw.width));
  const strength=Math.max(.2,Math.min(1,.3+pressure*.6+(dead?.1:0)));
  const c={id:this.hits,cycle:this.cycle,x,y:floor_y-1,u,age:0,power:strength,col:this.hits%4};
  this.contacts.push(c);this.contacts=this.contacts.slice(-12);
  this.marks.push({...c,age:0,max:9});this.marks=this.marks.slice(-24);
  const eliminated=!!dead||b.health===0;
  b.impactStateUntil=this.clock+(eliminated?2.8:.8);
  this.bodies=this.bodies.filter(e=>e.b!==b);
  this.bodies.push({b,x,age:0,dead:eliminated});this.bodies=this.bodies.slice(-16);
  if(this.clock-this.soundAt>.095){this.accent('hit',.43,.86+(this.hits%3)*.045);this.soundAt=this.clock;}
 },
 update(dt){
  dt=Math.max(0,Math.min(.08,dt));this.reduced=!!(realmMood.lowEffects||realmMood.reduceMotion);
  for(const group of [this.marks,this.contacts,this.trails,this.bodies])for(const e of group)e.age+=dt;
  this.marks=this.marks.filter(e=>e.age<e.max);this.contacts=this.contacts.filter(e=>e.age<10);
  this.bodies=this.bodies.filter(e=>e.age<(e.dead?2.8:.8));
  if(paw_state===3&&this.cycleHits>0&&Math.abs(paw_x-this.lastX)>5){
   const c=this.contacts[this.contacts.length-1];if(c){this.marks.push({...c,x:(paw_x+this.lastX)/2,age:0,max:7,col:2,power:this.pressure});this.marks=this.marks.slice(-24);}
  }
  this.lastX=paw_x;
  for(const f of this.trails){
   const a=realmImpactSolePoint(f.u,Math.max(1,Math.min(2,paw_state)));
   const distance=Math.hypot(a.x-f.x,a.y-f.y);
   if(!f.broken&&(distance>48||f.age>.48||paw_state===0)){
    f.broken=true;f.breakAge=f.age;f.end=a;
    if(this.clock-this.soundAt>.13){this.accent('release',.14,1.08);this.soundAt=this.clock;}
   }
  }
  this.trails=this.trails.filter(f=>f.age<.8&&(!f.broken||f.age-f.breakAge<.16));
  if(realmImpactQA&&this.clock-(this.lastQA||-99)>1){
   this.lastQA=this.clock;console.info('IMPACT_QA',JSON.stringify(this.snapshot()));
  }
 },
 sprite(ctx,col,row,x,y,width,height,opacity=1){
  if(!this.ready()||opacity<=0)return;const r=realmImpactRects[row*4+col];
  ctx.save();ctx.globalAlpha=Math.min(1,opacity);ctx.drawImage(realmImpactAtlas,...r,x-width/2,y-height,width,height);ctx.restore();this.lastDraws++;
 },
 draw(ctx){
  if(!active||pause||tr||!this.ready()||!realmAfterFx.enabled)return;
  this.lastDraws=0;const sx=(typeof quality!=='undefined'&&quality.displayScaleX)||sc,sy=(typeof quality!=='undefined'&&quality.displayScaleY)||sc;ctx.save();ctx.setTransform(sx,0,0,sy,0,0);
  for(const m of this.marks){const fade=Math.min(1,(m.max-m.age)/2.2);
   this.sprite(ctx,m.age<.18?0:m.col===2?2:3,0,m.x,m.y+2,22+m.power*30,4+m.power*5,fade*.88);
  }
  for(const e of this.bodies){
   const grounded=paw_state===3&&Math.abs(e.x-paw_x)<paw.width*.5;
   const col=e.age<.12?1:grounded&&this.pressure>.55?3:2;
   const width=col===1?19:26,height=col===1?14:grounded?3+3*(1-this.pressure):9;
   this.sprite(ctx,col,3,e.b.alive()?e.b.x:e.x,floor_y+1,width,height,Math.min(1,(e.dead?2.8:.8)-e.age));
  }
  if(paw_state===3&&this.groundAge<.48){
   this.sprite(ctx,this.pressure>.35?1:0,0,paw_x,floor_y+2,paw.width*.94,5+this.pressure*6,(1-this.groundAge/.55)*.78);
  }
  if((paw_state===1||paw_state===2)&&realmAfterFx.soleResidueFx){
   realmImpactSoleCtx.clearRect(0,0,160,256);
   for(const c of this.contacts){
    const pt=realmImpactLocalPoint(c.u,paw_state),sz=13+c.power*13;
    this.sprite(realmImpactSoleCtx,c.col,1,pt.x,pt.y+sz*.4,sz,sz*.75,Math.min(.8,(10-c.age)/3));
   }
   realmImpactSoleCtx.globalCompositeOperation='destination-in';
   realmImpactSoleCtx.drawImage(paw_state===1?realmAJ6F1Mask:realmAJ6F2Mask,0,0);
   realmImpactSoleCtx.globalCompositeOperation='source-over';
   const g=realmFrameGeometry(paw_state);ctx.drawImage(realmImpactSoleCanvas,g.x,g.y,g.w,g.h);
  }
  if(!this.reduced&&realmAfterFx.soleResidueFx)for(const f of this.trails){
   const valid=paw_state===1||paw_state===2;if(!valid)continue;
   const a=f.broken?f.end:realmImpactSolePoint(f.u,paw_state);
   const dx=a.x-f.x,dy=a.y-f.y,len=Math.hypot(dx,dy);if(len<2)continue;
   const col=f.broken?3:len<15?0:len<32?1:2;
   const fade=f.broken?Math.max(0,1-(f.age-f.breakAge)/.16):Math.max(0,1-f.age/.8);
   ctx.save();ctx.translate(f.x,f.y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
   this.sprite(ctx,col,2,0,0,Math.max(2,7-len*.065),len,fade*.85);ctx.restore();
  }
  ctx.restore();
 },
 snapshot(){return {version:'impact-v1',phase:this.phase,hits:this.hits,landings:this.landings,releases:this.releases,pressure:this.pressure,assetReady:this.ready(),marks:this.marks.length,contacts:this.contacts.length,trails:this.trails.length,draws:this.lastDraws,sounds:this.soundEvents.slice(-8)};}
};
function realmImpactLocalPoint(u,frame){
 // F1 heel-to-forefoot axis; transform the same contact into F2.
 const p={x:25+u*74,y:452-u*92-256};
 if(frame===2){const m=realmAJ6Map;return{x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};}
 return p;
}
function realmImpactSolePoint(u,frame){const p=realmImpactLocalPoint(u,frame),g=realmFrameGeometry(frame);return{x:g.x+p.x*g.scale,y:g.y+p.y*g.scale};}
const realmImpactSoleCanvas=document.createElement('canvas');realmImpactSoleCanvas.width=160;realmImpactSoleCanvas.height=256;
const realmImpactSoleCtx=realmImpactSoleCanvas.getContext('2d');
const realmImpactOriginalSound=sound;
const impactOldHit=realmAfterFx.hit,impactOldUpdate=realmAfterFx.update,impactOldDraw=realmAfterFx.draw,impactOldReset=realmAfterFx.reset,impactOldSnapshot=realmAfterFx.snapshot;
realmAfterFx.hit=function(...args){return realmImpact.enabled()?realmImpact.hit(...args):impactOldHit.apply(this,args);};
realmAfterFx.update=function(dt,...args){return realmImpact.enabled()?realmImpact.update(dt):impactOldUpdate.call(this,dt,...args);};
realmAfterFx.draw=function(ctx){return realmImpact.enabled()?realmImpact.draw(ctx):impactOldDraw.call(this,ctx);};
realmAfterFx.reset=function(){impactOldReset.call(this);realmImpact.reset();};
realmAfterFx.snapshot=function(){const s=impactOldSnapshot.call(this);return realmImpact.enabled()?{...s,impact:realmImpact.snapshot()}:s;};
const impactOldBugDraw=draw_bug;
draw_bug=function(b){if(realmImpact.enabled()&&realmImpact.ready()&&(b.impactStateUntil||0)>realmImpact.clock)return;return impactOldBugDraw(b);};
const impactOldStains=draw_stains,impactOldStrands=draw_strands,impactOldDroplets=draw_droplets,impactOldStickers=draw_stickers,impactOldFallers=draw_fallers;
draw_stains=function(...a){return impactOldStains(...a);};
draw_strands=function(...a){return impactOldStrands(...a);};
draw_droplets=function(...a){return impactOldDroplets(...a);};
draw_stickers=function(...a){return impactOldStickers(...a);};
draw_fallers=function(...a){return impactOldFallers(...a);};
