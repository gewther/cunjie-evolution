/* Project Cunjie v6.2 — Wave 1 Immersion Layer
 * Dynamic WebAudio ambience + proximity lowpass muffling + stereo spatial sub-bass,
 * tactile Hit-stop + breathing focus camera + looming shadow occlusion,
 * camera-lens rain droplets / rooftop dust motes, mobile haptics, and Fenrir HUD auto-fade.
 * Works cleanly in both Story Mode (touch-v1-impact.js) and Free/Fenrir Mode (touch-v1-free.js).
 */
(function installCunjieImmersionV1(){
 if(window.__cunjieImmersionV1)return;
 window.__cunjieImmersionV1=true;
 window.__xlImmersionOwnsAmbience=true;

 const isFenrir=typeof fenrirCity!=='undefined'&&!!fenrirCity;
 const isStory=typeof realmIndex!=='undefined';

 // Read initial immersion preferences safely from host localStorage if available
 function readInitialPrefs(){
  const base={immersionAmbience:true,immersionHaptics:true,immersionHudFade:true,sound:true,volume:.45,reduceMotion:false,lowEffects:false};
  try{
   const raw=window.parent&&window.parent.localStorage&&window.parent.localStorage.getItem('cunjie-stomp-impact-v1');
   if(raw){
    const parsed=JSON.parse(raw);
    const p=parsed&&parsed.prefs;
    if(p){
     base.immersionAmbience=p.immersionAmbience!==false;
     base.immersionHaptics=p.immersionHaptics!==false;
     base.immersionHudFade=p.immersionHudFade!==false;
     base.sound=p.sound!==false;
     if(Number.isFinite(p.volume))base.volume=p.volume;
     base.reduceMotion=!!p.reduceMotion;
     base.lowEffects=!!p.lowEffects;
    }
   }
  }catch{}
  return base;
 }
 const immPrefs=Object.assign(readInitialPrefs(),window.__xlImmersionPrefs||{});
 window.__xlImmersionPrefs=immPrefs;

 function readInitialDreadMode(){
  try{
   const v=window.parent&&window.parent.localStorage&&window.parent.localStorage.getItem('cunjie-tech-dread-v1');
   return (v==='soft'||v==='off')?v:'standard';
  }catch{return 'standard';}
 }
 let dreadMode=readInitialDreadMode();
 let lastDreadLevel=0;

 if(typeof window.addEventListener==='function'){
  window.addEventListener('message',e=>{
   const d=e&&e.data;
   if(d&&d.type==='cunjie-immersion-prefs'&&d.prefs){
    Object.assign(immPrefs,d.prefs);
   }else if(d&&d.type==='cunjie-tech-dread-mode'&&(d.mode==='standard'||d.mode==='soft'||d.mode==='off')){
    dreadMode=d.mode;
   }
  });
 }

 function getSceneKind(){
  if(isFenrir)return 'fenrir-rain';
  if(isStory){
   if(realmIndex===1)return 'carpet-indoor';
   if(realmIndex===2)return 'bedside-night';
   const rk=(typeof roomKey!=='undefined'&&roomKey)||window.__cunjieRoomTheme||'rooftop-day';
   if(rk==='rooftop-day'||rk==='rooftop-night')return rk;
   if(rk==='rain'||rk==='bedroom-wood')return 'room-rain';
   return 'room-warm';
  }
  return 'room-indoor';
 }

 function isReducedMotion(){
  return !!(immPrefs.reduceMotion||(typeof realmMood!=='undefined'&&realmMood&&realmMood.reduceMotion));
 }
 function isLowEffects(){
  return !!(immPrefs.lowEffects||(typeof realmMood!=='undefined'&&realmMood&&realmMood.lowEffects));
 }
 function isSoundEnabled(){
  if(isStory&&typeof realmPrefs!=='undefined'&&realmPrefs&&realmPrefs.sound===false)return false;
  return immPrefs.sound!==false;
 }

 // --- Mobile Haptics (navigator.vibrate) ---
 let lastVibeAt=0,lastGrindVibeAt=0,lastProxVibeAt=0;
 function immVibrate(pattern,minGapMs=55){
  if(immPrefs.immersionHaptics===false)return;
  if(typeof navigator==='undefined'||typeof navigator.vibrate!=='function')return;
  const now=typeof performance!=='undefined'?performance.now():Date.now();
  if(now-lastVibeAt<minGapMs)return;
  lastVibeAt=now;
  try{navigator.vibrate(pattern);}catch{}
 }

 // --- WebAudio Dynamic Layered Ambience + Proximity Muffling + Stereo Spatial Impact ---
 let ambNoiseBuf=null;
 let ambGraph=null;
 let ambClock=0;
 let thunderTimer=9+Math.random()*10;
 let duckUntil=0;

 function ensureAmbNoise(ctx){
  if(ambNoiseBuf)return ambNoiseBuf;
  if(!ctx||typeof ctx.createBuffer!=='function')return null;
  const sr=ctx.sampleRate||44100;
  const len=Math.floor(sr*2.4);
  const buf=ctx.createBuffer(1,len,sr);
  const ch=buf.getChannelData(0);
  // Warm pink-ish noise
  let b0=0,b1=0,b2=0;
  for(let i=0;i<len;i++){
   const white=Math.random()*2-1;
   b0=0.99765*b0+white*0.099046;
   b1=0.96300*b1+white*0.2965164;
   b2=0.57000*b2+white*1.0526913;
   ch[i]=(b0+b1+b2+white*0.1848)*0.16;
  }
  ambNoiseBuf=buf;
  return buf;
 }

 function ensureAmbGraph(){
  if(ambGraph)return ambGraph;
  if(typeof audio_ctx==='undefined'||!audio_ctx||typeof main_volume_node==='undefined'||!main_volume_node)return null;
  if(audio_ctx.state!=='running')return null;
  const buf=ensureAmbNoise(audio_ctx);
  if(!buf)return null;
  try{
   const ctx=audio_ctx,at=ctx.currentTime;
   const master=ctx.createGain();
   master.gain.setValueAtTime(0.0001,at);
   const lowpass=ctx.createBiquadFilter();
   lowpass.type='lowpass';
   lowpass.frequency.setValueAtTime(2400,at);
   lowpass.Q.setValueAtTime(0.7,at);
   lowpass.connect(master);
   master.connect(main_volume_node);

   // Layer 1: Primary texture noise (rain hiss / rooftop wind / room tone)
   const src1=ctx.createBufferSource();
   src1.buffer=buf;src1.loop=true;
   const flt1=ctx.createBiquadFilter();
   flt1.type='bandpass';flt1.frequency.setValueAtTime(1200,at);flt1.Q.setValueAtTime(0.7,at);
   const g1=ctx.createGain();g1.gain.setValueAtTime(0.0001,at);
   src1.connect(flt1);flt1.connect(g1);g1.connect(lowpass);
   src1.start(at);

   // Layer 2: Secondary low body (road rain body / city hum)
   const src2=ctx.createBufferSource();
   src2.buffer=buf;src2.loop=true;
   const flt2=ctx.createBiquadFilter();
   flt2.type='lowpass';flt2.frequency.setValueAtTime(380,at);flt2.Q.setValueAtTime(0.6,at);
   const g2=ctx.createGain();g2.gain.setValueAtTime(0.0001,at);
   src2.connect(flt2);flt2.connect(g2);g2.connect(lowpass);
   src2.start(at);

   // Layer 3: Proximity looming sub-pressure drone (48Hz sine)
   const droneOsc=ctx.createOscillator();
   droneOsc.type='sine';droneOsc.frequency.setValueAtTime(48,at);
   const droneGain=ctx.createGain();droneGain.gain.setValueAtTime(0.0001,at);
   droneOsc.connect(droneGain);droneGain.connect(main_volume_node);
   droneOsc.start(at);

   ambGraph={master,lowpass,src1,flt1,g1,src2,flt2,g2,droneOsc,droneGain};
   return ambGraph;
  }catch{
   return null;
  }
 }

 function safeRamp(param,val,at,tc){
  try{param.setTargetAtTime(val,at,tc);}catch{try{param.setValueAtTime(val,at);}catch{}}
 }

 function triggerDistantThunder(stormLevel){
  if(typeof audio_ctx==='undefined'||!audio_ctx||audio_ctx.state!=='running'||typeof main_volume_node==='undefined')return;
  const buf=ensureAmbNoise(audio_ctx);if(!buf)return;
  try{
   const ctx=audio_ctx,at=ctx.currentTime;
   const src=ctx.createBufferSource(),lp=ctx.createBiquadFilter(),gn=ctx.createGain();
   src.buffer=buf;src.loop=true;
   lp.type='lowpass';lp.frequency.setValueAtTime(82+stormLevel*25,at);lp.frequency.exponentialRampToValueAtTime(42,at+2.2);
   const peak=0.055+stormLevel*0.035;
   gn.gain.setValueAtTime(0.0001,at);
   gn.gain.exponentialRampToValueAtTime(peak,at+0.35);
   gn.gain.exponentialRampToValueAtTime(0.0001,at+2.4);
   src.connect(lp);lp.connect(gn);
   if(typeof ctx.createStereoPanner==='function'){
    const pan=ctx.createStereoPanner();
    pan.pan.setValueAtTime((Math.random()*2-1)*0.65,at);
    gn.connect(pan);pan.connect(main_volume_node);
    src.onended=()=>{try{src.disconnect();lp.disconnect();gn.disconnect();pan.disconnect();}catch{}};
   }else{
    gn.connect(main_volume_node);
    src.onended=()=>{try{src.disconnect();lp.disconnect();gn.disconnect();}catch{}};
   }
   src.start(at);src.stop(at+2.45);
  }catch{}
 }

 function playSpatialImpact(force,x,isOverdrive){
  if(!isSoundEnabled()||typeof audio_ctx==='undefined'||!audio_ctx||audio_ctx.state!=='running'||typeof main_volume_node==='undefined')return;
  const ctx=audio_ctx,at=ctx.currentTime;
  const panVal=clamp(((x||w*.5)/Math.max(1,w))*2-1,-0.78,0.78);
  const volMul=isStory?Math.max(0.2,Math.min(1,(typeof realmPrefs!=='undefined'&&realmPrefs&&Number.isFinite(realmPrefs.footstepVolume))?realmPrefs.footstepVolume:.75)):1;
  try{
   let dest=main_volume_node,panner=null;
   if(typeof ctx.createStereoPanner==='function'){
    panner=ctx.createStereoPanner();
    panner.pan.setValueAtTime(panVal,at);
    panner.connect(main_volume_node);
    dest=panner;
   }
   // Sub-bass chest thump (52Hz -> 25Hz)
   const subDur=0.22+force*0.12+(isOverdrive?0.08:0);
   const osc=ctx.createOscillator(),env=ctx.createGain();
   osc.type='sine';
   const startHz=isFenrir?(isOverdrive?58:50):54;
   osc.frequency.setValueAtTime(startHz,at);
   osc.frequency.exponentialRampToValueAtTime(24,at+subDur);
   const subAmp=Math.min(0.22,(0.065+force*0.115)*(isOverdrive?1.25:1)*volMul);
   env.gain.setValueAtTime(0.0001,at);
   env.gain.exponentialRampToValueAtTime(Math.max(0.0002,subAmp),at+0.007);
   env.gain.exponentialRampToValueAtTime(0.0001,at+subDur);
   osc.connect(env);env.connect(dest);
   osc.start(at);osc.stop(at+subDur+0.02);

   // Spatial air/mist whoosh tail on heavy landings
   const scene=getSceneKind();
   const buf=ensureAmbNoise(ctx);
   if(buf&&force>0.22){
    const ns=ctx.createBufferSource(),flt=ctx.createBiquadFilter(),ng=ctx.createGain();
    ns.buffer=buf;
    const isWet=scene==='fenrir-rain'||scene==='room-rain';
    flt.type='bandpass';
    flt.frequency.setValueAtTime(isWet?1500+force*900:420+force*320,at);
    flt.Q.setValueAtTime(isWet?0.9:1.3,at);
    const wDur=0.14+force*0.18;
    const wAmp=(isWet?0.085:0.055)*force*volMul;
    ng.gain.setValueAtTime(0.0001,at);
    ng.gain.exponentialRampToValueAtTime(Math.max(0.0002,wAmp),at+0.012);
    ng.gain.exponentialRampToValueAtTime(0.0001,at+wDur);
    ns.connect(flt);flt.connect(ng);ng.connect(dest);
    ns.start(at);ns.stop(at+wDur+0.02);
    ns.onended=()=>{try{ns.disconnect();flt.disconnect();ng.disconnect();}catch{}};
   }

   osc.onended=()=>{try{osc.disconnect();env.disconnect();if(panner)panner.disconnect();}catch{}};
   // Brief ambience ducking for extra impact weight
   if(force>0.32)duckUntil=at+0.14;
  }catch{}
 }

 function updateAmbience(step,prox,isOverdrive){
  ambClock+=step;
  const want=active&&!pause&&!tr&&isSoundEnabled()&&immPrefs.immersionAmbience!==false;
  const g=want?ensureAmbGraph():ambGraph;
  if(!g||typeof audio_ctx==='undefined'||!audio_ctx)return;
  const at=audio_ctx.currentTime;
  const scene=getSceneKind();
  const fState=window.xlFenrirState||null;
  const rainMul=(fState&&fState.rainMul)||1;
  const duck=at<duckUntil?0.48:1;

  if(!want){
   safeRamp(g.master.gain,0.0001,at,0.12);
   safeRamp(g.droneGain.gain,0.0001,at,0.1);
   return;
  }

  let openCut=2400,muffCut=420,l1Freq=1200,l1Q=0.7,l1Gain=0.02,l2Freq=320,l2Gain=0.01,masterGain=0.85;
  if(scene==='fenrir-rain'){
   openCut=3600;muffCut=440;
   l1Freq=1550+rainMul*180;l1Q=0.6;l1Gain=0.044*Math.min(1.65,0.78+rainMul*0.42);
   l2Freq=460;l2Gain=0.028*Math.min(1.6,0.8+rainMul*0.35);
   thunderTimer-=step*(0.8+rainMul*0.45);
   if(thunderTimer<=0){
    thunderTimer=12+Math.random()*14;
    triggerDistantThunder(Math.min(1,(rainMul-0.8)/1.1));
   }
  }else if(scene==='room-rain'){
   openCut=2200;muffCut=380;
   l1Freq=980;l1Q=0.85;l1Gain=0.030;
   l2Freq=340;l2Gain=0.016;
   thunderTimer-=step*0.6;
   if(thunderTimer<=0){
    thunderTimer=18+Math.random()*16;
    triggerDistantThunder(0.3);
   }
  }else if(scene==='rooftop-day'||scene==='rooftop-night'){
   const windWave=0.5+0.5*Math.sin(ambClock*0.45)+0.25*Math.sin(ambClock*1.15);
   openCut=2500;muffCut=360;
   l1Freq=270+windWave*210;l1Q=1.35;l1Gain=(scene==='rooftop-night'?0.036:0.030)*(0.75+windWave*0.4);
   l2Freq=130;l2Gain=0.020;
  }else{
   openCut=1400;muffCut=320;
   l1Freq=320;l1Q=0.9;l1Gain=0.011;
   l2Freq=160;l2Gain=0.009;
  }

  // Proximity low-pass muffling + sudden silence vacuum before heavy impact
  const inSilenceMood=isStory&&typeof realmMood!=='undefined'&&realmMood&&realmMood.special==='silence';
  const loomDrop=!prevGrounded&&prox>0.82&&typeof paw_y_velo==='number'&&paw_y_velo>480;
  const inVacuum=dreadMode!=='off'&&(inSilenceMood||loomDrop);
  const vacuumMul=inVacuum?(dreadMode==='soft'?0.45:0.18):1;
  const cut=openCut-(openCut-muffCut)*Math.pow(prox,1.15);
  safeRamp(g.flt1.frequency,l1Freq,at,0.12);
  safeRamp(g.flt1.Q,l1Q,at,0.12);
  safeRamp(g.g1.gain,l1Gain,at,0.12);
  safeRamp(g.flt2.frequency,l2Freq,at,0.12);
  safeRamp(g.g2.gain,l2Gain,at,0.12);
  safeRamp(g.lowpass.frequency,cut,at,0.08);
  safeRamp(g.master.gain,masterGain*duck*vacuumMul,at,0.06);

  // Subtle sub-pressure drone when looming low, in sudden silence vacuum, or during overdrive/fever burst
  const burst=(isStory&&typeof realmBurstTime==='number'&&realmBurstTime>0);
  const baseDrone=(isOverdrive||burst)?0.028:(prox>0.42?(prox-0.42)*0.038:0.0001);
  const droneTarget=inVacuum?Math.max(baseDrone,dreadMode==='soft'?0.018:0.032):baseDrone;
  safeRamp(g.droneOsc.frequency,inVacuum?44:(isOverdrive?56:(burst?52:46)),at,0.12);
  safeRamp(g.droneGain.gain,Math.max(0.0001,droneTarget),at,0.09);
 }

 // --- Camera-Lens Water Droplets & Rooftop Motes ---
 const lensDrops=[];
 const motes=[];
 for(let i=0;i<18;i++){
  motes.push({x:Math.random()*w,y:Math.random()*h,vx:8+Math.random()*16,vy:-3+Math.random()*6,sz:.7+Math.random()*1.5,a:.10+Math.random()*.18});
 }

 function spawnLensDrops(count,force){
  if(isLowEffects()||isReducedMotion())return;
  for(let i=0;i<count;i++){
   // Bias droplets toward edges and lower-mid camera glass so center stays clear
   const side=Math.random()<.5?Math.random()*0.34:(0.66+Math.random()*0.34);
   const yNorm=0.14+Math.random()*0.68;
   lensDrops.push({
    x:side*w,
    y:yNorm*h,
    r:2.1+Math.random()*3.2*(0.7+force*0.5),
    vy:1.2+Math.random()*3.8,
    age:0,
    max:2.8+Math.random()*2.2,
    wobble:Math.random()*Math.PI*2
   });
  }
  while(lensDrops.length>12)lensDrops.shift();
 }

 function blastRooftopMotes(x,force){
  if(isLowEffects()||isReducedMotion())return;
  for(const m of motes){
   const dx=m.x-x,dy=m.y-floor_y;
   const dist=Math.max(24,Math.hypot(dx,dy));
   const push=(force*165)/(dist*0.025+1);
   m.vx+=(dx/dist)*push;
   m.vy-=Math.abs(push)*0.55;
  }
 }

 // --- Tactile Hit-Stop, Proximity & Breathing Camera State ---
 let hitStopLeft=0,hitStopCooldown=0;
 let prevGrounded=false,prevProx=0;
 let camZoom=1,camFocusX=w*0.5;
 let rainLensTimer=1.8;

 function onDetectedLanding(force,x){
  const fState=window.xlFenrirState||null;
  const isOverdrive=!!(fState&&fState.overdrive);
  const isBurst=(isStory&&typeof realmBurstTime==='number'&&realmBurstTime>0);
  playSpatialImpact(force,x,isOverdrive||isBurst);

  // Mobile haptics
  if(isOverdrive||isBurst){
   immVibrate([22,18,36],90);
  }else if(force>=0.20){
   immVibrate(Math.round(16+Math.min(1,force)*28),70);
  }

  // Hit-stop on heavy impacts (28-50ms)
  if(!isReducedMotion()&&!slow&&force>=0.42&&hitStopCooldown<=0){
   hitStopLeft=clamp(0.026+force*0.024+(isOverdrive?0.01:0),0.026,0.052);
   hitStopCooldown=0.28;
  }

  // Foreground lens droplets or rooftop dust gust
  const scene=getSceneKind();
  if((scene==='fenrir-rain'||scene==='room-rain')&&force>=0.22){
   spawnLensDrops(force>=0.55?3:2,force);
  }else if(scene==='rooftop-day'||scene==='rooftop-night'){
   blastRooftopMotes(x,force);
  }
 }

 function currentContact(){
  if(typeof evoContact!=='undefined'&&evoContact)return evoContact;
  if(typeof window.xlFreeContact!=='undefined'&&window.xlFreeContact)return window.xlFreeContact;
  return null;
 }

 // Wrap update_bugs so hit-stop pauses crowd motion in sync with paw
 const immOldUpdateBugs=typeof update_bugs==='function'?update_bugs:null;
 if(immOldUpdateBugs){
  update_bugs=function(){
   if(hitStopLeft>0&&active&&!pause&&!tr)return;
   return immOldUpdateBugs.apply(this,arguments);
  };
 }

 // Wrap update_paw for hit-stop, ambience, landing detection, lens drops, and haptics
 const immOldUpdatePaw=typeof update_paw==='function'?update_paw:null;
 if(immOldUpdatePaw){
  update_paw=function(){
   const step=Math.min(0.05,(typeof delta==='number'&&delta>0)?delta:0.016);
   if(hitStopCooldown>0)hitStopCooldown=Math.max(0,hitStopCooldown-step);
   if(hitStopLeft>0&&active&&!pause&&!tr){
    hitStopLeft=Math.max(0,hitStopLeft-Math.min(0.025,step));
    return;
   }
   immOldUpdatePaw.apply(this,arguments);

   const prox=active&&!pause&&!tr?clamp((paw_y-h*0.26)/Math.max(1,floor_y-h*0.26),0,1):0;
   const fState=window.xlFenrirState||null;
   const isOverdrive=!!(fState&&fState.overdrive);
   updateAmbience(step,prox,isOverdrive);

   if(!active||pause||tr){
    prevGrounded=false;prevProx=0;
    return;
   }

   // Detect fresh landing via contact feel tracker
   const ct=currentContact();
   const grounded=ct?!!ct.grounded:(paw_state>=3);
   if(grounded&&!prevGrounded){
    const force=ct?clamp(ct.punch()||ct.impactForce||0.38,0.12,1):clamp(Math.abs(paw_y_velo||400)/1100,0.15,1);
    onDetectedLanding(force,paw_x);
   }
   prevGrounded=grounded;

   // Subtle proximity haptic tick when looming close from above
   const nowMs=typeof performance!=='undefined'?performance.now():Date.now();
   if(!grounded&&prox>=0.74&&prevProx<0.74&&paw_y_velo>60&&nowMs-lastProxVibeAt>950){
    lastProxVibeAt=nowMs;
    immVibrate(8,80);
   }
   prevProx=prox;

   // Rhythmic micro-vibration during wet-asphalt drag grinding
   const grinding=!!(fState&&fState.grinding)||(isStory&&grounded&&pressure>0.38&&Math.abs(paw_x-camFocusX)>3.5);
   if(grinding&&nowMs-lastGrindVibeAt>120){
    lastGrindVibeAt=nowMs;
    immVibrate(10,95);
   }

   // Smooth breathing camera state
   const punch=ct?ct.punch():0;
   const targetZoom=isReducedMotion()?1:(1+prox*0.013+clamp(pressure||0,0,1)*0.015+punch*0.026+(isOverdrive?0.008:0));
   camZoom+=(targetZoom-camZoom)*Math.min(1,step*11);
   camFocusX+=(paw_x-camFocusX)*Math.min(1,step*7);

   // Update lens water droplets
   const scene=getSceneKind();
   if((scene==='fenrir-rain'||scene==='room-rain')&&!isLowEffects()&&!isReducedMotion()){
    const rainMul=(fState&&fState.rainMul)||1;
    rainLensTimer-=step*rainMul;
    if(rainLensTimer<=0){
     rainLensTimer=(scene==='fenrir-rain'?2.6:4.2)+Math.random()*2.5;
     if(lensDrops.length<7)spawnLensDrops(1,0.3);
    }
   }
   for(const d of lensDrops){
    d.age+=step;
    const slide=d.age>0.45?(d.vy+d.age*2.6):d.vy*0.25;
    d.y+=slide*step;
    d.x+=Math.sin(d.age*2.2+d.wobble)*1.4*step;
   }
   for(let i=lensDrops.length-1;i>=0;i--){
    if(lensDrops[i].age>=lensDrops[i].max||lensDrops[i].y>h+10)lensDrops.splice(i,1);
   }

   // Update rooftop sunlit dust motes
   if((scene==='rooftop-day'||scene==='rooftop-night')&&!isLowEffects()&&!isReducedMotion()){
    for(const m of motes){
     m.x+=m.vx*step;m.y+=m.vy*step;
     m.vx+=(10-m.vx)*Math.min(1,step*2.4);
     m.vy+=(-1-m.vy)*Math.min(1,step*2.4);
     if(m.x>w+12)m.x=-10;
     if(m.x<-14)m.x=w+10;
     if(m.y<4)m.y=h-24;
     if(m.y>h-8)m.y=12;
    }
   }
  };
 }

 // Wrap set_yoff for breathing zoom + hit-stop micro-jolt
 const immOldSetYoff=typeof set_yoff==='function'?set_yoff:null;
 if(immOldSetYoff&&typeof oc!=='undefined'){
  set_yoff=function(off){
   immOldSetYoff(off);
   if(pause||slow||isReducedMotion()||(typeof xlGfxPrefs!=='undefined'&&!xlGfxPrefs.shake))return;
   if(camZoom<=1.0015&&hitStopLeft<=0)return;
   const ox=clamp((camFocusX/Math.max(1,w))*100,18,82).toFixed(1);
   const cur=oc.style.transform||'';
   if(!cur){
    oc.style.transformOrigin=`${ox}% 78%`;
    const hs=hitStopLeft>0?1.008:1;
    oc.style.transform=`scale(${(camZoom*hs).toFixed(4)})`;
   }else if(hitStopLeft>0){
    oc.style.transform=cur+' scale(1.008)';
   }
  };
 }

 // Wrap draw for Looming Shadow Occlusion, Camera-Lens Droplets, Rooftop Motes, and Overdrive Ready Cues
 const immOldDraw=typeof draw==='function'?draw:null;
 if(immOldDraw&&typeof occ!=='undefined'){
  draw=function(){
   immOldDraw.apply(this,arguments);
   if(!active||pause||tr)return;
   const sx=(typeof quality!=='undefined'&&quality.displayScaleX)||sc;
   const sy=(typeof quality!=='undefined'&&quality.displayScaleY)||sc;
   occ.save();
   occ.setTransform(sx,0,0,sy,0,0);

   // 1. Looming Shadow Occlusion ("天黑了一块") + Shadow-first anticipation
   const prox=clamp((paw_y-h*0.28)/Math.max(1,floor_y-h*0.28),0,1);
   const pressureNow=clamp(typeof pressure==='number'?pressure:0,0,1);
   const burstNow=(isStory&&typeof realmBurstTime==='number'&&realmBurstTime>0);
   const overNow=!!(window.xlFenrirState&&window.xlFenrirState.overdrive);
   const rawDread=clamp(prox*0.48+pressureNow*0.52+((overNow||burstNow)?0.25:0),0,1);
   lastDreadLevel=dreadMode==='off'?0:(dreadMode==='soft'?rawDread*0.55:rawDread);

   if(!hide_paws&&!isLowEffects()){
    const shadowMin=dreadMode==='off'?0.22:0.14;
    const shadowMul=dreadMode==='off'?1:(dreadMode==='soft'?1:1.22);
    if(prox>shadowMin){
     const k=(prox-shadowMin)/(1-shadowMin);
     const rad=Math.max(70,(paw&&paw.width?paw.width:96)*(1.15+k*0.65));
     const gx=paw_x,gy=floor_y-6;
     const grad=occ.createRadialGradient(gx,gy,rad*0.12,gx,gy,rad);
     const peak=(isFenrir?0.30:0.22)*k*shadowMul;
     grad.addColorStop(0,`rgba(4,9,16,${Math.min(0.65,peak).toFixed(3)})`);
     grad.addColorStop(0.65,`rgba(4,9,16,${Math.min(0.45,peak*0.42).toFixed(3)})`);
     grad.addColorStop(1,'rgba(4,9,16,0)');
     occ.globalAlpha=1;
     occ.fillStyle=grad;
     occ.fillRect(Math.max(0,gx-rad),Math.max(0,gy-rad*0.75),rad*2,rad*1.1);
    }

    // 1b. Contracting High-Tech Surveillance Target Reticle (airborne descent only)
    if(dreadMode!=='off'&&typeof paw_state!=='undefined'&&paw_state!==3&&prox>0.16){
     const footW=(paw&&paw.width?paw.width:96);
     const rw=Math.max(footW*0.55,footW*(1.28-0.52*prox));
     const halfW=rw*0.5,rh=Math.max(7,rw*0.15),br=Math.max(5,rw*0.14);
     const rx=paw_x,ry=floor_y-4;
     const warn=prox>0.72;
     const rAlpha=(0.24+0.44*prox)*(dreadMode==='soft'?0.65:1);
     occ.globalAlpha=1;
     occ.strokeStyle=warn?`rgba(255,77,90,${rAlpha.toFixed(3)})`:`rgba(72,229,255,${rAlpha.toFixed(3)})`;
     occ.lineWidth=warn?1.15:0.9;
     occ.beginPath();
     occ.moveTo(rx-halfW,ry-rh+br);occ.lineTo(rx-halfW,ry-rh);occ.lineTo(rx-halfW+br,ry-rh);
     occ.moveTo(rx+halfW-br,ry-rh);occ.lineTo(rx+halfW,ry-rh);occ.lineTo(rx+halfW,ry-rh+br);
     occ.moveTo(rx-halfW,ry+rh-br);occ.lineTo(rx-halfW,ry+rh);occ.lineTo(rx-halfW+br,ry+rh);
     occ.moveTo(rx+halfW-br,ry+rh);occ.lineTo(rx+halfW,ry+rh);occ.lineTo(rx+halfW,ry+rh-br);
     occ.moveTo(rx-3,ry);occ.lineTo(rx+3,ry);
     occ.stroke();
     if(typeof occ.fillText==='function'){
      occ.fillStyle=occ.strokeStyle;
      occ.font='600 6.5px ui-monospace,monospace';
      occ.textAlign='center';
      occ.fillText('ALT '+Math.max(0.1,30*(1-prox)).toFixed(1)+'m',rx,ry-rh-2.5);
     }
    }
   }

   // 1c. Radial edge dread vignette inside canvas
   if(lastDreadLevel>0.08&&!isLowEffects()){
    const r0=Math.min(w,h)*0.28,r1=Math.max(w,h)*0.72;
    const vg=occ.createRadialGradient(w*0.5,h*0.54,r0,w*0.5,h*0.54,r1);
    vg.addColorStop(0,'rgba(4,9,15,0)');
    vg.addColorStop(1,`rgba(3,7,13,${(0.38*lastDreadLevel).toFixed(3)})`);
    occ.globalAlpha=1;
    occ.fillStyle=vg;
    occ.fillRect(0,0,w,h);
   }

   // 2. Rain camera-lens droplets
   const scene=getSceneKind();
   if((scene==='fenrir-rain'||scene==='room-rain')&&lensDrops.length&&!isLowEffects()&&!isReducedMotion()){
    for(const d of lensDrops){
     const fade=Math.min(1,d.age/0.18)*Math.min(1,(d.max-d.age)/0.9);
     if(fade<=0.02)continue;
     // Faint gravity smear above droplet
     if(d.age>0.55){
      occ.globalAlpha=fade*0.14;
      occ.strokeStyle=isFenrir?'#98dcff':'#dce8f5';
      occ.lineWidth=Math.max(0.7,d.r*0.36);
      occ.beginPath();occ.moveTo(d.x,d.y-d.r*0.4);occ.lineTo(d.x,d.y-Math.min(14,d.age*3.2));occ.stroke();
     }
     // Translucent refraction body
     occ.globalAlpha=fade*0.30;
     const rg=occ.createRadialGradient(d.x-d.r*0.3,d.y-d.r*0.3,d.r*0.1,d.x,d.y,d.r);
     rg.addColorStop(0,isFenrir?'rgba(200,245,255,0.85)':'rgba(240,248,255,0.80)');
     rg.addColorStop(0.65,isFenrir?'rgba(45,130,175,0.28)':'rgba(130,155,180,0.24)');
     rg.addColorStop(1,'rgba(12,24,38,0.45)');
     occ.fillStyle=rg;
     occ.beginPath();occ.ellipse(d.x,d.y,d.r*0.86,d.r*1.08,0,0,Math.PI*2);occ.fill();
     // Crisp rim specular highlight
     occ.globalAlpha=fade*0.62;
     occ.fillStyle='#ffffff';
     occ.beginPath();occ.arc(d.x-d.r*0.28,d.y-d.r*0.32,Math.max(0.55,d.r*0.24),0,Math.PI*2);occ.fill();
    }
   }

   // 3. Rooftop sunlit / night windblown dust motes
   if((scene==='rooftop-day'||scene==='rooftop-night')&&!isLowEffects()&&!isReducedMotion()){
    occ.fillStyle=scene==='rooftop-day'?'#ffe4b5':'#b5d6f5';
    for(const m of motes){
     occ.globalAlpha=m.a;
     occ.beginPath();occ.arc(m.x,m.y,m.sz,0,Math.PI*2);occ.fill();
    }
   }

   // 4. Diegetic Overdrive-Ready peripheral pulse for Fenrir (thrill >= 85%)
   if(isFenrir&&window.xlFenrirState&&!window.xlFenrirState.overdrive&&window.xlFenrirState.thrill>=85&&!isLowEffects()){
    const pulse=0.5+0.5*Math.sin(ambClock*7.5);
    const a=(0.08+0.09*pulse);
    const lg=occ.createLinearGradient(0,0,28,0);
    lg.addColorStop(0,`rgba(56,228,255,${a.toFixed(3)})`);lg.addColorStop(1,'rgba(56,228,255,0)');
    occ.globalAlpha=1;occ.fillStyle=lg;occ.fillRect(0,0,28,h);
    const rg=occ.createLinearGradient(w,0,w-28,0);
    rg.addColorStop(0,`rgba(255,209,102,${a.toFixed(3)})`);rg.addColorStop(1,'rgba(255,209,102,0)');
    occ.fillStyle=rg;occ.fillRect(w-28,0,28,h);
   }

   occ.restore();
  };
 }

 // --- Fenrir / Free Mode Auto-Fading HUD + Mobile Fullscreen Button ---
 if(typeof document!=='undefined'&&document.head&&document.getElementById){
  const stEl=document.createElement('style');
  stEl.textContent=`
#xl-hud,#fn-dock{transition:opacity .55s ease;}
body.imm-hud-faded #xl-hud{opacity:.30;}
body.imm-hud-faded #fn-dock{opacity:.34;}
body.imm-hud-faded #xl-hud:hover,body.imm-hud-faded #fn-dock:hover{opacity:1;}
  `;
  document.head.appendChild(stEl);

  // Add one-tap Fullscreen button to Fenrir tactical dock (works on mobile & desktop)
  const dock=document.getElementById('fn-dock');
  if(dock&&!document.getElementById('fn-full-btn')){
   const fsBtn=document.createElement('button');
   fsBtn.id='fn-full-btn';
   fsBtn.type='button';
   fsBtn.textContent='⛶ 全屏';
   fsBtn.onclick=()=>{
    try{
     if(window.parent&&window.parent!==window){
      window.parent.postMessage({type:'cunjie-toggle-fullscreen'},'*');
     }else if(document.fullscreenElement){
      document.exitFullscreen().catch(()=>{});
     }else if(document.documentElement.requestFullscreen){
      document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
     }
    }catch{}
   };
   dock.appendChild(fsBtn);
  }

  let hudWakeUntil=(typeof performance!=='undefined'?performance.now():Date.now())+4200;
  function wakeHud(ms=3600){
   hudWakeUntil=(typeof performance!=='undefined'?performance.now():Date.now())+ms;
   if(document.body)document.body.classList.remove('imm-hud-faded');
  }
  for(const id of ['xl-hud','fn-dock']){
   const el=document.getElementById(id);
   if(el){
    el.addEventListener('pointerdown',()=>wakeHud(4500),{passive:true});
    el.addEventListener('pointerenter',()=>wakeHud(4500),{passive:true});
   }
  }
  if(typeof setInterval==='function'){
   setInterval(()=>{
    if(!document.body)return;
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    const fState=window.xlFenrirState||null;
    const busy=typeof active==='undefined'||!active||(typeof pause!=='undefined'&&pause)||(fState&&(fState.finished||fState.thrill>=100));
    const shouldFade=!busy&&immPrefs.immersionHudFade!==false&&now>hudWakeUntil;
    document.body.classList.toggle('imm-hud-faded',shouldFade);
   },450);
  }
 }

 window.__xlImmersionDebug=()=>({
  scene:getSceneKind(),
  ambienceActive:!!ambGraph,
  lensDrops:lensDrops.length,
  camZoom:Number(camZoom.toFixed(4)),
  dreadMode,
  dreadLevel:Number(lastDreadLevel.toFixed(3)),
  prefs:{...immPrefs}
 });
})();
