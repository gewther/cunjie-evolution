/* Basketball-shoe first act only. Input ownership and collision masks stay native. */
const evoContact=new CunjieContactFeel();
const evoDust=new Image();let evoDustTex=null;
function evoBindDustTex(){
 if(!evoDust.complete||!evoDust.naturalWidth||typeof new_texture!=='function'||evoDustTex)return;
 if(typeof createImageBitmap==='function'){
  createImageBitmap(evoDust).then(b=>{evoDustTex=new_texture(b);evoDustTex.smooth=true;}).catch(()=>{evoDustTex=new_texture(evoDust);evoDustTex.smooth=true;});
 }else{evoDustTex=new_texture(evoDust);evoDustTex.smooth=true;}
}
evoDust.addEventListener('load',evoBindDustTex);
evoDust.src='/assets/impact/contact-dust-v2.webp';
if(evoDust.complete)evoBindDustTex();
let evoPuffs=[],evoDebris=[],evoAudioEvents=[],evoMotionTrail=[];
const evoEnabled=()=>realmIndex===0;
function xlStageMat(){
 if(realmIndex===0)return {id:'hard',squash:1,dust:true,hz:56,amp:.11,dur:.18,ring:'hard',flash:true,debris:'chip',zoom:.036};
 if(realmIndex===1)return {id:'carpet',squash:.62,dust:false,hz:40,amp:.09,dur:.24,ring:'plush',flash:false,debris:'fiber',zoom:.018};
 const onCarpet=paw_x>w*.56,burst=(typeof realmBurstTime==='number'&&realmBurstTime>0);
 if(onCarpet)return {id:'paw-carpet',squash:.72,dust:false,hz:42,amp:burst?.13:.10,dur:.23,ring:'plush',flash:burst,debris:'fiber',zoom:burst?.032:.022};
 return {id:'paw-wood',squash:.84,dust:false,hz:49,amp:burst?.16:.13,dur:.21,ring:'warm',flash:true,debris:'warm',zoom:burst?.038:.030};
}
function evoSound(event){
 if(event.kind!=='landing'||!realmPrefs.sound||realmPrefs.footstepFx===false||audio_ctx.state!=='running')return;
 const vol=Math.max(0,Math.min(1,realmPrefs.footstepVolume??.65));if(!vol)return;
 const mat=xlStageMat(),ctx=audio_ctx,at=ctx.currentTime,force=event.force;
 const duration=mat.dur,hz=mat.hz;
 const osc=ctx.createOscillator(),env=ctx.createGain();
 osc.type='sine';
 osc.frequency.setValueAtTime(hz*(mat.id==='carpet'?1.12:1.25),at);osc.frequency.exponentialRampToValueAtTime(hz*.58,at+duration);
 const amp=vol*mat.amp*force;
 env.gain.setValueAtTime(.00001,at);env.gain.exponentialRampToValueAtTime(Math.max(.00002,amp),at+(mat.id==='carpet'?.014:.005));env.gain.exponentialRampToValueAtTime(.00001,at+duration);
 osc.connect(env);env.connect(main_volume_node);osc.start(at);osc.stop(at+duration+.015);
 evoAudioEvents.push(event.kind);if(evoAudioEvents.length>24)evoAudioEvents.shift();
 osc.onended=()=>{osc.disconnect();env.disconnect();};
}
const evoUpdatePaw=update_paw;
update_paw=function(){
 evoUpdatePaw();
 if(pause||tr||!active)return;
 const impactOwns=evoEnabled()&&typeof realmImpact!=='undefined'&&realmImpact.enabled();
 const event=evoContact.update(delta,{state:paw_state,velocity:paw_y_velo,x:paw_x,pressure,manual:realmTouchOwns()});
 if(evoEnabled()&&paw_state===3&&!realmTouchOwns()&&!impactOwns)pressure=evoContact.pressure;
 if(event){
  evoSound(event);
  if(event.kind==='landing'&&event.force>.08){
   const mat=xlStageMat();
   evoPuffs.push({...event,age:0,width:paw.width,mat:mat.id});evoPuffs=evoPuffs.slice(-4);
   const n=Math.min(22,Math.round((mat.debris==='fiber'?5:7)+event.force*(mat.debris==='fiber'?9:15)));
   for(let i=0;i<n;i++){
    const dir=i%2?1:-1,spd=(mat.debris==='fiber'?(28+Math.random()*85):(65+Math.random()*195))*(.45+event.force*.85);
    evoDebris.push({x:paw_x+(Math.random()-.5)*paw.width*.85,y:floor_y-1-Math.random()*3,vx:dir*spd,vy:-(mat.debris==='fiber'?16:28)-Math.random()*(mat.debris==='fiber'?45:95)*(.4+event.force*.8),sz:mat.debris==='fiber'?(1.4+Math.random()*1.8):(1.6+Math.random()*2.4),age:0,max:(mat.debris==='fiber'?.42:.26)+Math.random()*.24,warm:Math.random()>.45,kind:mat.debris});
   }
   evoDebris=evoDebris.slice(-64);
  }
 }
};
const evoAfterUpdate=realmAfterFx.update;
realmAfterFx.update=function(dt,...args){evoAfterUpdate.call(this,dt,...args);const step=Math.min(.05,dt);for(const p of evoPuffs)p.age+=step;evoPuffs=evoPuffs.filter(p=>p.age<.58);for(const d of evoDebris){d.age+=step;d.x+=d.vx*step;d.y+=d.vy*step;d.vy+=(d.kind==='fiber'?110:340)*step;d.vx*=Math.max(0,1-(d.kind==='fiber'?5.2:4.2)*step);if(d.y>floor_y+1){d.y=floor_y+1;d.vy*=d.kind==='fiber'?-.12:-.32;}}evoDebris=evoDebris.filter(d=>d.age<d.max);};
window.xlDrawImpactFloorPass=function(){
 if(!active||pause||tr||realmPrefs.impactFx===false)return;
 if(typeof xlFloorGfx==='undefined'||!xlFloorGfx.ready())return;
 const mat=xlStageMat(),punch=evoContact.punch();
 if(evoContact.grounded){
  xlFloorGfx.drawContactPress(paw_x,floor_y+1,paw.width*(.47+evoContact.squash()*.5),evoContact.pressure*(mat.id==='carpet'?.72:1),punch*(mat.id==='carpet'?.55:1));
 }
 if(!realmMood.reduceMotion){
  for(const p of evoPuffs){
   const u=p.age/.58;
   if(p.mat==='hard'&&!realmMood.lowEffects&&evoDustTex){
    const width=p.width*(1.12+u*1.36*(.65+p.force*.55)),height=width*.28;
    const oldA=alpha,oldF=hflip;hflip=false;alpha=(1-u)*(.26+.48*p.force);
    set_texture(evoDustTex);quad(p.x-width/2,floor_y-height*.84,width,height,0,0,evoDustTex.w||512,evoDustTex.h||256);
    alpha=oldA;hflip=oldF;
   }
   if(p.mat==='carpet'||p.mat==='paw-carpet'){
    if(u<.75){
     const ru=u/.75,rx=p.width*(.44+ru*(.58+p.force*.42)),ry=Math.max(2.4,rx*.16);
     xlFloorGfx.drawOval(false,p.x,floor_y+1,rx,ry,(1-ru)*(.26+.20*p.force));
     xlFloorGfx.drawImpactRing(p.x,floor_y+1,rx*.96,ry*.9,(1-ru)*(.22+.18*p.force));
    }
   }else{
    if(u<.65){
     const ru=u/.65,rx=p.width*(.48+ru*(.85+p.force*.95)),ry=Math.max(2,rx*.14);
     xlFloorGfx.drawImpactRing(p.x,floor_y+1,rx,ry,(1-ru)*(.42+.36*p.force));
    }
    if(u<.18&&p.force>.22){
     xlFloorGfx.drawImpactFlash(p.x,floor_y,p.width*.72,16+10*p.force,(1-u/.18)*.42*p.force);
    }
   }
  }
 }
};
window.evoDrawContactFx=function(ctx){
 if(!active||pause||tr||realmPrefs.impactFx===false)return;
 const hasGlFloor=typeof xlFloorGfx!=='undefined'&&xlFloorGfx.ready();
 const mat=xlStageMat();
 const sx=(typeof quality!=='undefined'&&quality.displayScaleX)||sc,sy=(typeof quality!=='undefined'&&quality.displayScaleY)||sc;
 ctx.save();ctx.setTransform(sx,0,0,sy,0,0);
 const punch=evoContact.punch();
 if(!hasGlFloor&&evoContact.grounded){
  ctx.globalAlpha=.18+.24*evoContact.pressure+punch*.22;ctx.fillStyle='#1d1714';ctx.beginPath();ctx.ellipse(paw_x,floor_y+1,paw.width*(.47+evoContact.squash()*.5),2+2.6*evoContact.pressure,0,0,Math.PI*2);ctx.fill();
 }
 if(!realmMood.reduceMotion){
  for(const p of evoPuffs){
   const u=p.age/.58;
   if(p.mat==='hard'&&!realmMood.lowEffects&&evoDust.complete&&evoDust.naturalWidth){
    const width=p.width*(1.15+u*1.38*(.65+p.force*.55)),height=width*.28;
    ctx.globalAlpha=(1-u)*(hasGlFloor?.14:.24+.50*p.force);
    ctx.drawImage(evoDust,p.x-width/2,floor_y-height*(hasGlFloor?.42:.80),width,height*(hasGlFloor?.68:1));
   }
   if(!hasGlFloor&&u<.65){
    const ru=u/.65,rx=p.width*(.48+ru*(.85+p.force*.95)),ry=Math.max(2,rx*.14);
    ctx.globalAlpha=(1-ru)*(.42+.38*p.force);
    ctx.strokeStyle=p.mat==='carpet'?'rgba(205,216,232,.75)':'rgba(255,246,226,.92)';ctx.lineWidth=Math.max(1,(3.2-2.2*ru)*(.6+p.force*.6));
    ctx.beginPath();ctx.ellipse(p.x,floor_y+1,rx,ry,0,0,Math.PI*2);ctx.stroke();
   }
  }
  if(!realmMood.lowEffects){
   for(const d of evoDebris){
    const fade=Math.max(0,1-d.age/d.max);
    ctx.globalAlpha=fade*(d.kind==='fiber'?.58:.86);
    if(d.kind==='fiber'){
     ctx.fillStyle=d.warm?'#d6d0df':'#9aa7bc';
     ctx.beginPath();ctx.ellipse(d.x,d.y,d.sz*.6,d.sz*.4,0,0,Math.PI*2);ctx.fill();
    }else if(d.kind==='warm'){
     ctx.fillStyle=d.warm?'#f0d8b4':'#7c5b42';
     ctx.fillRect(d.x-d.sz/2,d.y-d.sz/2,d.sz,d.sz*.72);
    }else{
     ctx.fillStyle=d.warm?'#e8d5b3':'#2a2523';
     ctx.fillRect(d.x-d.sz/2,d.y-d.sz/2,d.sz,d.sz*.75);
    }
   }
  }
  const burst=(realmIndex===2&&typeof realmBurstTime==='number'&&realmBurstTime>0);
  if((punch>.20||burst)&&!realmMood.lowEffects){
   const vg=ctx.createRadialGradient(w/2,h*.55,w*.26,w/2,h*.55,w*.68);
   if(burst){
    vg.addColorStop(0,'rgba(229,183,107,0)');vg.addColorStop(1,`rgba(195,122,52,${Math.min(.26,.10+punch*.18)})`);
   }else{
    vg.addColorStop(0,'rgba(12,16,20,0)');vg.addColorStop(1,`rgba(12,16,20,${Math.min(.22,punch*(mat.id==='carpet'?.12:.20))})`);
   }
   ctx.globalAlpha=1;ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
  }
 }
 ctx.restore();
};
const evoAfterDraw=realmAfterFx.draw;
realmAfterFx.draw=function(ctx){
 evoAfterDraw.call(this,ctx);
 window.evoDrawContactFx(ctx);
};
const evoOldSetYoff=typeof set_yoff==='function'?set_yoff:null;
if(evoOldSetYoff&&typeof oc!=='undefined'){
 set_yoff=function(off){
  if(pause||slow||!xlGfxPrefs.shake||realmMood.reduceMotion){oc.style.transform='';oc.style.transformOrigin='';evoOldSetYoff(off);return;}
  evoOldSetYoff(0);
  const mat=xlStageMat(),punch=evoContact.punch(),baseAmp=Math.abs(off)/Math.max(1,sc);
  const jx=baseAmp>0.05?Math.sin(tick*2.3)*baseAmp*(mat.id==='carpet'?1.3:2.1):0;
  const jy=(off>=0?1:-1)*baseAmp*(mat.id==='carpet'?1.6:2.4)+(punch>0.05?Math.cos(tick*3.1)*punch*(mat.id==='carpet'?2.4:4.5):0);
  const rot=baseAmp>0.05?Math.sin(tick*1.9)*Math.min(.55,baseAmp*(mat.id==='carpet'?.10:.18)):0;
  const zoom=1+(realmMood.lowEffects?punch*mat.zoom*.45:punch*mat.zoom);
  if(!jx&&!jy&&!rot&&zoom<=1.0005){oc.style.transform='';return;}
  oc.style.transformOrigin=`${Math.max(15,Math.min(85,(paw_x/Math.max(1,w))*100)).toFixed(1)}% 78%`;
  oc.style.transform=`translate3d(${jx.toFixed(1)}px,${jy.toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${zoom.toFixed(4)})`;
 };
}
const evoFront=draw_front_paw;
draw_front_paw=function(){
 if(hide_paws||realmPrefs.impactFx===false||realmMood.reduceMotion){evoFront();return;}
 const mat=xlStageMat();
 const s=paw.front_spr,uw=s[3],uh=s[4],n=s[6],dw=paw.width,dh=uh*(dw/uw);
 if(!evoContact.grounded){
  if(!realmMood.lowEffects&&paw_y_velo>320){
   const frame=paw_state;
   const fx=n?(s[5]?floor(frame/n):frame%n):(s[5]?0:frame),fy=n?(s[5]?frame%n:floor(frame/n)):(s[5]?frame:0);
   const fo=(typeof xlSkinGeo==='function'?xlSkinGeo():XL_GEOMETRY[xlActiveProfile.id]).frontOffsets;
   const hdKey=(typeof xlGetHdFrame==='function')?xlGetHdFrame(frame):((typeof xlHasHdAJ6==='function'&&xlHasHdAJ6()&&typeof realmAJ6Frames!=='undefined')?realmAJ6Frames.get(frame):null);
   const hdTex=hdKey?textures.get(hdKey):null;
   const sprSrc=hdKey?[hdKey,0,0,(hdTex&&hdTex.w)||960,(hdTex&&hdTex.h)||1536]:[s[0],s[1]+uxoff+fx*uw,s[2]+uyoff+fy*uh,uw,uh];
   const speedK=Math.min(1,(paw_y_velo-320)/1500),yBottom=paw_y+(fo[frame]||0);
   const oldAlpha=alpha;
   for(let k=3;k>=1;k--){
    alpha=xlModeFade*(.07+.15*speedK)/k;
    const dy=k*(7+15*speedK),stretch=1+.04*speedK;
    sprite_scaled(sprSrc,paw_x-dw/2-paw.offset,yBottom-dy-dh*stretch,dw,dh*stretch);
   }
   alpha=oldAlpha;
  }
  evoFront();return;
 }
 let off=0,frame=paw_state;stomp_frame=0;
 if(!paw.steamroller){if(supports>0)off=pin_min_y-floor_y;else if(pressure>.2)off=4;}
 if(pin_min_y>=floor_y||paw.steamroller)stomp_frame+=clamp(ceil(pressure*4)-1,0,2);else if(pressure>.1)frame=4;
 frame+=stomp_frame;
 const fx=n?(s[5]?floor(frame/n):frame%n):(s[5]?0:frame),fy=n?(s[5]?frame%n:floor(frame/n)):(s[5]?frame:0);
 const fo=(typeof xlSkinGeo==='function'?xlSkinGeo():XL_GEOMETRY[xlActiveProfile.id]).frontOffsets;
 const hdKey=(typeof xlGetHdFrame==='function')?xlGetHdFrame(frame):((typeof xlHasHdAJ6==='function'&&xlHasHdAJ6()&&typeof realmAJ6Frames!=='undefined')?realmAJ6Frames.get(frame):null);
 const hdTex=hdKey?textures.get(hdKey):null;
 const sprSrc=hdKey?[hdKey,0,0,(hdTex&&hdTex.w)||960,(hdTex&&hdTex.h)||1536]:[s[0],s[1]+uxoff+fx*uw,s[2]+uyoff+fy*uh,uw,uh];
 const squash=evoContact.squash()*mat.squash,extra=dw*squash*.58,bottom=paw_y+off+(fo[frame]||0);
 alpha=xlModeFade;sprite_scaled(sprSrc,paw_x-dw/2-paw.offset-extra/2,bottom-dh*(1-squash),dw+extra,dh*(1-squash));draw_stickers();alpha=1;
};
const evoSetup=window.realmBridge.setup,evoSnapshot=window.realmBridge.snapshot;
window.realmBridge.setup=function(...args){evoContact.reset();evoPuffs=[];evoDebris=[];evoAudioEvents=[];evoMotionTrail=[];return evoSetup.apply(this,args);};
window.realmBridge.snapshot=function(){const s=evoSnapshot.call(this);return evoEnabled()?{...s,contactFeel:{...evoContact.snapshot(),audioScheduled:evoAudioEvents.slice(-6),dustReady:evoDust.complete&&evoDust.naturalWidth>0}}:s;};
