/* Free Mode & Fenrir City contact feel, wet-asphalt splash/rain FX, squash & micro-punch. */
const freeContact=new CunjieContactFeel();
window.xlFreeContact=freeContact;
let freePuffs=[],freeSpray=[],freeRain=[];
const freeIsFenrir=typeof fenrirCity!=='undefined'&&!!fenrirCity;
if(freeIsFenrir){
 for(let i=0;i<60;i++){
  freeRain.push({x:Math.random()*w,y:Math.random()*h,len:10+Math.random()*16,spd:260+Math.random()*140,a:.09+Math.random()*.15});
 }
}
let freeNoiseBuf=null,freeRainNode=null,freeRainGain=null;
function freeEnsureNoise(){
 if(freeNoiseBuf||typeof audio_ctx==='undefined'||!audio_ctx||typeof audio_ctx.createBuffer!=='function')return freeNoiseBuf;
 const len=Math.floor((audio_ctx.sampleRate||44100)*1.2);
 const buf=audio_ctx.createBuffer(1,len,audio_ctx.sampleRate||44100);
 const ch=buf.getChannelData(0);
 let last=0;
 for(let i=0;i<len;i++){const white=Math.random()*2-1;last=(last+0.08*white)/1.08;ch[i]=last*2.2;}
 freeNoiseBuf=buf;
 return buf;
}
window.xlFreeEnsureNoise=freeEnsureNoise;
function freeUpdateRainAmbience(){
 if(!freeIsFenrir||typeof audio_ctx==='undefined'||!audio_ctx||typeof main_volume_node==='undefined')return;
 const want=active&&!pause&&!tr&&audio_ctx.state==='running';
 if(want&&!freeRainNode){
  const buf=freeEnsureNoise();if(!buf)return;
  const src=audio_ctx.createBufferSource(),flt=audio_ctx.createBiquadFilter(),gn=audio_ctx.createGain();
  src.buffer=buf;src.loop=true;
  flt.type='bandpass';flt.frequency.setValueAtTime(1450,audio_ctx.currentTime);flt.Q.setValueAtTime(0.65,audio_ctx.currentTime);
  gn.gain.setValueAtTime(0.032,audio_ctx.currentTime);
  src.connect(flt);flt.connect(gn);gn.connect(main_volume_node);src.start();
  freeRainNode=src;freeRainGain=gn;
 }else if(freeRainGain){
  const target=want?0.032:0.0001;
  try{freeRainGain.gain.setTargetAtTime(target,audio_ctx.currentTime,0.12);}catch{freeRainGain.gain.setValueAtTime(target,audio_ctx.currentTime);}
 }
}
function freeSound(event){
 if(event.kind!=='landing'||typeof audio_ctx==='undefined'||!audio_ctx||audio_ctx.state!=='running'||typeof main_volume_node==='undefined')return;
 const ctx=audio_ctx,at=ctx.currentTime,force=event.force;
 const dur=freeIsFenrir?.22:.17,hz=freeIsFenrir?46:56;
 const osc=ctx.createOscillator(),env=ctx.createGain();
 osc.type='sine';
 osc.frequency.setValueAtTime(hz*1.28,at);osc.frequency.exponentialRampToValueAtTime(hz*.56,at+dur);
 const amp=(freeIsFenrir?.14:.11)*force;
 env.gain.setValueAtTime(.00001,at);env.gain.exponentialRampToValueAtTime(Math.max(.00002,amp),at+.006);env.gain.exponentialRampToValueAtTime(.00001,at+dur);
 osc.connect(env);env.connect(main_volume_node);osc.start(at);osc.stop(at+dur+.015);
 osc.onended=()=>{osc.disconnect();env.disconnect();};
 if(freeIsFenrir&&force>.12){
  const buf=freeEnsureNoise();
  if(buf){
   const ns=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),ng=ctx.createGain();
   ns.buffer=buf;bp.type='bandpass';bp.frequency.setValueAtTime(1150+force*700,at);bp.Q.setValueAtTime(1.1,at);
   const sDur=.14+.14*force;
   ng.gain.setValueAtTime(.00001,at);ng.gain.exponentialRampToValueAtTime(Math.max(.00002,.12*force),at+.008);ng.gain.exponentialRampToValueAtTime(.00001,at+sDur);
   ns.connect(bp);bp.connect(ng);ng.connect(main_volume_node);ns.start(at);ns.stop(at+sDur+.02);
   ns.onended=()=>{ns.disconnect();bp.disconnect();ng.disconnect();};
  }
 }
}
const freeOldUpdatePaw=update_paw;
update_paw=function(){
 freeOldUpdatePaw();
 freeUpdateRainAmbience();
 if(pause||tr||!active)return;
 const step=Math.min(.05,delta||0);
 const manual=typeof realmTouchOwns==='function'?realmTouchOwns():false;
 const event=freeContact.update(step,{state:paw_state,velocity:paw_y_velo,x:paw_x,pressure,manual});
 const fState=window.xlFenrirState||null;
 const isOverdrive=!!(fState&&fState.overdrive);
 if(event){
  freeSound(event);
  if(event.kind==='landing'&&event.force>.08){
   freePuffs.push({...event,age:0,width:paw.width,overdrive:isOverdrive});
   freePuffs=freePuffs.slice(-5);
   const n=Math.min(freeIsFenrir?(isOverdrive?36:28):20,Math.round((freeIsFenrir?10:6)+event.force*(freeIsFenrir?18:14)));
   for(let i=0;i<n;i++){
    const dir=i%2?1:-1,spd=(55+Math.random()*205)*(.45+event.force*.85)*(isOverdrive?1.2:1);
    freeSpray.push({
     x:paw_x+(Math.random()-.5)*paw.width*.76,
     y:floor_y-1-Math.random()*3,
     vx:dir*spd,
     vy:-(freeIsFenrir?42:28)-Math.random()*(freeIsFenrir?118:90)*(.4+event.force*.8),
     sz:freeIsFenrir?(1.5+Math.random()*2.5):(1.6+Math.random()*2.2),
     age:0,max:.28+Math.random()*.28,
     wet:freeIsFenrir,warm:Math.random()>.45,spark:isOverdrive&&(i%3===0)
    });
   }
   freeSpray=freeSpray.slice(-88);
   if(fState&&typeof fState.onLanding==='function')fState.onLanding(event);
  }
 }
 if(freeIsFenrir&&fState&&fState.grinding&&Math.random()<.72){
  const dir=fState.dragDir||1;
  freeSpray.push({
   x:paw_x-dir*paw.width*.28+(Math.random()-.5)*22,
   y:floor_y-1-Math.random()*2,
   vx:-dir*(38+Math.random()*95),
   vy:-24-Math.random()*58,
   sz:1.3+Math.random()*2,
   age:0,max:.22+Math.random()*.18,
   wet:true,warm:Math.random()>.55,spark:Math.random()<.35
  });
  if(freeSpray.length>88)freeSpray.shift();
 }
 for(const p of freePuffs)p.age+=step;
 freePuffs=freePuffs.filter(p=>p.age<(freeIsFenrir?.68:.52));
 for(const d of freeSpray){
  d.age+=step;d.x+=d.vx*step;d.y+=d.vy*step;d.vy+=(d.wet?380:340)*step;d.vx*=Math.max(0,1-(d.wet?3.2:4.2)*step);
  if(d.y>floor_y+1){d.y=floor_y+1;d.vy*=d.wet?-.18:-.32;}
 }
 freeSpray=freeSpray.filter(d=>d.age<d.max);
 if(freeIsFenrir){
  const rainMul=(fState&&fState.rainMul)||1;
  const activeRain=Math.min(freeRain.length,Math.round(34*rainMul));
  for(let i=0;i<activeRain;i++){
   const r=freeRain[i];
   r.x-=r.spd*.18*rainMul*step;r.y+=r.spd*(0.85+0.25*rainMul)*step;
   if(r.y>h+16){r.y=-14-Math.random()*24;r.x=Math.random()*(w+40);}
   if(r.x<-20)r.x+=w+40;
  }
 }
};
window.xlDrawImpactFloorPass=function(){
 if(!active||pause||tr||typeof xlFloorGfx==='undefined'||!xlFloorGfx.ready())return;
 const punch=freeContact.punch();
 if(freeContact.grounded){
  xlFloorGfx.drawContactPress(paw_x,floor_y+1,paw.width*(.44+freeContact.squash()*.5),freeContact.pressure,punch);
 }
 for(const p of freePuffs){
  const maxAge=freeIsFenrir?.68:.52,u=p.age/maxAge;
  if(freeIsFenrir){
   const oMul=p.overdrive?1.35:1;
   if(u<.85){
    const ru=u/.85,rx=p.width*(.40+ru*(1.15+p.force*.95))*oMul,ry=Math.max(2.2,rx*.13);
    xlFloorGfx.drawImpactRing(p.x,floor_y+1,rx,ry,(1-ru)*(.55+.35*p.force));
   }
   if(u>.12&&u<.95){
    const ru2=(u-.12)/.83,rx2=p.width*(.32+ru2*(.95+p.force*.82))*oMul,ry2=Math.max(1.8,rx2*.12);
    xlFloorGfx.drawImpactRing(p.x,floor_y+1,rx2,ry2,(1-ru2)*(.38+.28*p.force));
   }
   if(u<.18&&p.force>.18){
    xlFloorGfx.drawImpactFlash(p.x,floor_y,p.width*(p.overdrive?.85:.58),12+10*p.force,(1-u/.18)*(p.overdrive?.44:.28)*p.force);
   }
  }else{
   if(u<.65){
    const ru=u/.65,rx=p.width*(.48+ru*(.85+p.force*.95)),ry=Math.max(2,rx*.14);
    xlFloorGfx.drawImpactRing(p.x,floor_y+1,rx,ry,(1-ru)*(.42+.36*p.force));
   }
   if(u<.18&&p.force>.22){
    xlFloorGfx.drawImpactFlash(p.x,floor_y,p.width*.70,15+9*p.force,(1-u/.18)*.38*p.force);
   }
  }
 }
};
const freeOldSetYoff=typeof set_yoff==='function'?set_yoff:null;
if(freeOldSetYoff&&typeof oc!=='undefined'){
 set_yoff=function(off){
  if(pause||slow||!xlGfxPrefs.shake){oc.style.transform='';oc.style.transformOrigin='';freeOldSetYoff(off);return;}
  freeOldSetYoff(0);
  const punch=freeContact.punch(),baseAmp=Math.abs(off)/Math.max(1,sc);
  const jx=baseAmp>0.05?Math.sin(tick*2.3)*baseAmp*1.9:0;
  const jy=(off>=0?1:-1)*baseAmp*2.2+(punch>0.05?Math.cos(tick*3.1)*punch*(freeIsFenrir?5.0:4.2):0);
  const rot=baseAmp>0.05?Math.sin(tick*1.9)*Math.min(.50,baseAmp*.16):0;
  const zoom=1+punch*(freeIsFenrir?.032:.028);
  if(!jx&&!jy&&!rot&&zoom<=1.0005){oc.style.transform='';return;}
  oc.style.transformOrigin=`${Math.max(15,Math.min(85,(paw_x/Math.max(1,w))*100)).toFixed(1)}% 78%`;
  oc.style.transform=`translate3d(${jx.toFixed(1)}px,${jy.toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${zoom.toFixed(4)})`;
 };
}
const freeOldFront=draw_front_paw;
draw_front_paw=function(){
 if(hide_paws){freeOldFront();return;}
 if(!freeContact.grounded){
  if(paw_y_velo>340){
   const s=paw.front_spr,uw=s[3],uh=s[4],n=s[6],frame=paw_state;
   const fx=n?(s[5]?floor(frame/n):frame%n):(s[5]?0:frame),fy=n?(s[5]?frame%n:floor(frame/n)):(s[5]?frame:0);
   const fo=(typeof xlSkinGeo==='function'?xlSkinGeo():XL_GEOMETRY[xlActiveProfile.id]).frontOffsets;
   const hdKey=(typeof xlGetHdFrame==='function')?xlGetHdFrame(frame):((typeof xlHasHdAJ6==='function'&&xlHasHdAJ6()&&typeof realmAJ6Frames!=='undefined')?realmAJ6Frames.get(frame):null);
   const hdTex=hdKey?textures.get(hdKey):null;
   const sprSrc=hdKey?[hdKey,0,0,(hdTex&&hdTex.w)||960,(hdTex&&hdTex.h)||1536]:[s[0],s[1]+uxoff+fx*uw,s[2]+uyoff+fy*uh,uw,uh];
   const speedK=Math.min(1,(paw_y_velo-340)/1500),yBottom=paw_y+(fo[frame]||0);
   const oldAlpha=alpha;
   for(let k=3;k>=1;k--){
    alpha=xlModeFade*(.07+.14*speedK)/k;
    const dy=k*(6+14*speedK),stretch=1+.038*speedK;
    sprite_scaled(sprSrc,paw_x-paw.width/2-paw.offset,yBottom-dy-uh*stretch,uw,uh*stretch);
   }
   alpha=oldAlpha;
  }
  freeOldFront();return;
 }
 let off=0,frame=paw_state;stomp_frame=0;
 if(!paw.steamroller){if(supports>0)off=pin_min_y-floor_y;else if(pressure>.2)off=4;}
 if(pin_min_y>=floor_y||paw.steamroller)stomp_frame+=clamp(ceil(pressure*4)-1,0,2);else if(pressure>.1)frame=4;
 frame+=stomp_frame;
 const s=paw.front_spr,uw=s[3],uh=s[4],n=s[6],dw=paw.width,dh=uh*(dw/uw);
 const fx=n?(s[5]?floor(frame/n):frame%n):(s[5]?0:frame),fy=n?(s[5]?frame%n:floor(frame/n)):(s[5]?frame:0);
 const fo=(typeof xlSkinGeo==='function'?xlSkinGeo():XL_GEOMETRY[xlActiveProfile.id]).frontOffsets;
 const hdKey=(typeof xlGetHdFrame==='function')?xlGetHdFrame(frame):((typeof xlHasHdAJ6==='function'&&xlHasHdAJ6()&&typeof realmAJ6Frames!=='undefined')?realmAJ6Frames.get(frame):null);
 const hdTex=hdKey?textures.get(hdKey):null;
 const sprSrc=hdKey?[hdKey,0,0,(hdTex&&hdTex.w)||960,(hdTex&&hdTex.h)||1536]:[s[0],s[1]+uxoff+fx*uw,s[2]+uyoff+fy*uh,uw,uh];
 const squash=freeContact.squash()*(freeIsFenrir?.72:1),extra=dw*squash*.52,bottom=paw_y+off+(fo[frame]||0);
 alpha=xlModeFade;sprite_scaled(sprSrc,paw_x-dw/2-paw.offset-extra/2,bottom-dh*(1-squash),dw+extra,dh*(1-squash));draw_stickers();alpha=1;
};
const freeOldDrawWrap=draw;
draw=function(){
 freeOldDrawWrap();
 if(!active||pause||tr)return;
 const sx=(typeof quality!=='undefined'&&quality.displayScaleX)||sc,sy=(typeof quality!=='undefined'&&quality.displayScaleY)||sc;
 occ.save();occ.setTransform(sx,0,0,sy,0,0);
 if(freeIsFenrir&&freeRain.length){
  const fState=window.xlFenrirState||null;
  const rainMul=(fState&&fState.rainMul)||1;
  const activeRain=Math.min(freeRain.length,Math.round(34*rainMul));
  occ.strokeStyle=(fState&&fState.overdrive)?'rgba(148,236,255,0.52)':'rgba(176,214,244,0.42)';
  occ.lineWidth=rainMul>1.3?0.85:0.7;
  for(let i=0;i<activeRain;i++){
   const r=freeRain[i];
   occ.globalAlpha=r.a*(rainMul>1.3?1.18:1);
   occ.beginPath();occ.moveTo(r.x,r.y);occ.lineTo(r.x-r.len*.18,r.y+r.len);occ.stroke();
  }
 }
 for(const d of freeSpray){
  const fade=Math.max(0,1-d.age/d.max);
  occ.globalAlpha=fade*(d.spark?.95:d.wet?.78:.84);
  if(d.spark){
   occ.fillStyle=d.warm?'#ffdf80':'#4ef0ff';
   occ.fillRect(d.x-d.sz*.55,d.y-d.sz*.55,d.sz*1.1,d.sz*.75);
  }else if(d.wet){
   occ.fillStyle=d.warm?'#dff3ff':'#8ec3e8';
   occ.beginPath();occ.ellipse(d.x,d.y,d.sz*.65,d.sz*.48,0,0,Math.PI*2);occ.fill();
  }else{
   occ.fillStyle=d.warm?'#e8d5b3':'#2a2523';
   occ.fillRect(d.x-d.sz/2,d.y-d.sz/2,d.sz,d.sz*.75);
  }
 }
 const punch=freeContact.punch();
 if(punch>.22&&xlGfxPrefs.shake){
  const vg=occ.createRadialGradient(w/2,h*.55,w*.28,w/2,h*.55,w*.68);
  vg.addColorStop(0,'rgba(10,16,24,0)');vg.addColorStop(1,`rgba(10,16,24,${Math.min(.20,punch*.18)})`);
  occ.globalAlpha=1;occ.fillStyle=vg;occ.fillRect(0,0,w,h);
 }
 occ.restore();
};
