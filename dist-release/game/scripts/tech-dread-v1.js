/* Project Cunjie v6.5 — High-Tech Surveillance Terminal & Psychological Dread Layer (V1)
 * Host-side non-destructive layer: corner viewfinder brackets, subtle scanlines,
 * dynamic breathing dread vignette, monospace telemetry strip, glitch pulse,
 * home screen terminal grid, 3-mode selector ('standard' | 'soft' | 'off'), and crisp WebAudio ticks.
 * Never alters gameplay physics, saves (cunjie-stomp-impact-v1), or Fenrir controls.
 */
(function installCunjieTechDreadV1(){
 'use strict';
 if(typeof window==='undefined'||window.__cunjieTechDreadV1)return;
 window.__cunjieTechDreadV1=true;

 const MODE_KEY='cunjie-tech-dread-v1';
 const VALID_MODES=['standard','soft','off'];
 const MODE_LABELS={standard:'标准',soft:'柔和',off:'关'};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

 function readMode(){
  try{
   const v=window.localStorage&&window.localStorage.getItem(MODE_KEY);
   return VALID_MODES.indexOf(v)>=0?v:'standard';
  }catch{return 'standard';}
 }
 function writeMode(next){
  try{if(window.localStorage)window.localStorage.setItem(MODE_KEY,next);}catch{}
 }
 function readHostPrefs(){
  const out={sound:true,volume:0.45,reduceMotion:false,lowEffects:false};
  try{
   const raw=window.localStorage&&window.localStorage.getItem('cunjie-stomp-impact-v1');
   if(raw){
    const p=JSON.parse(raw)?.prefs;
    if(p){
     out.sound=p.sound!==false;
     if(Number.isFinite(p.volume))out.volume=clamp(p.volume,0,1);
     out.reduceMotion=!!p.reduceMotion;
     out.lowEffects=!!p.lowEffects;
    }
   }
  }catch{}
  try{
   if(typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    out.reduceMotion=true;
   }
  }catch{}
  return out;
 }

 let mode=readMode();
 let lastDread=0;
 let lastRawDread=0;
 let lastPressure=0;
 let lastSilence=false;
 let lastBurst=false;
 let lastGlitchAt=0;
 let lastAlertAudioAt=0;
 let lastTickAudioAt=0;
 let glitchTimer=null;

 const styleText=`
/* Tech Dread V1 Terminal Overlay */
#home.td-home-active::after{
 content:"";
 position:fixed;
 inset:0;
 pointer-events:none;
 z-index:0;
 background:
  linear-gradient(rgba(72,229,255,.032) 1px,transparent 1px),
  linear-gradient(90deg,rgba(72,229,255,.024) 1px,transparent 1px);
 background-size:36px 36px;
 opacity:.65;
}
#home.td-home-active article{z-index:1}
#tdv1Overlay{
 position:absolute;
 inset:0;
 pointer-events:none;
 z-index:4;
 overflow:hidden;
 --td-dread:0;
}
#tdv1Overlay .td-vignette{
 position:absolute;
 inset:0;
 background:radial-gradient(ellipse at 50% 52%,
  rgba(4,10,16,0) 42%,
  rgba(3,9,15,calc(.20 + var(--td-dread) * .38)) 82%,
  rgba(2,6,11,calc(.42 + var(--td-dread) * .46)) 100%);
 transition:box-shadow 180ms ease,opacity 180ms ease;
}
#tdv1Overlay.td-alert .td-vignette{
 box-shadow:inset 0 0 calc(26px + var(--td-dread) * 24px) rgba(255,77,90,.24);
}
#tdv1Overlay .td-scanlines{
 position:absolute;
 inset:0;
 background:repeating-linear-gradient(
  to bottom,
  rgba(148,236,255,.06) 0px,
  rgba(148,236,255,.06) 1px,
  transparent 1px,
  transparent 4px
 );
 opacity:.45;
}
#tdv1Overlay .td-corners{
 position:absolute;
 inset:max(6px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));
}
#tdv1Overlay .td-corners i{
 position:absolute;
 width:14px;
 height:14px;
 border-color:rgba(72,229,255,.32);
 border-style:solid;
 transition:border-color 180ms ease;
}
#tdv1Overlay.td-alert .td-corners i{border-color:rgba(255,77,90,.62)}
#tdv1Overlay .td-c-tl{top:0;left:0;border-width:1.5px 0 0 1.5px}
#tdv1Overlay .td-c-tr{top:0;right:0;border-width:1.5px 1.5px 0 0}
#tdv1Overlay .td-c-bl{bottom:0;left:0;border-width:0 0 1.5px 1.5px}
#tdv1Overlay .td-c-br{bottom:0;right:0;border-width:0 1.5px 1.5px 0}
#play #hud #tdv1Telemetry,
#tdv1Overlay #tdv1Telemetry{
 position:static;
 transform:none;
 display:block;
 margin-top:6px;
 padding-top:4px;
 border-top:1px solid rgba(72,229,255,.20);
 background:transparent;
 border-radius:0;
 color:#9fdff0;
 font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
 font-size:9.5px;
 letter-spacing:.04em;
 line-height:1.35;
 white-space:nowrap;
 overflow:hidden;
 text-overflow:ellipsis;
}
#tdv1Overlay #tdv1Telemetry{
 position:absolute;
 left:50%;
 bottom:max(8px,env(safe-area-inset-bottom));
 transform:translateX(-50%);
 margin-top:0;
 padding:2px 9px;
 border-top:none;
 border-radius:999px;
 background:rgba(6,16,24,.72);
 border:1px solid rgba(72,229,255,.26);
 max-width:92vw;
 text-shadow:0 1px 4px rgba(0,0,0,.7);
}
#play #hud #tdv1Telemetry.td-tel-alert,
#tdv1Overlay.td-alert #tdv1Telemetry{
 border-color:rgba(255,77,90,.56);
 border-top-color:rgba(255,77,90,.46);
 color:#ffb4bc;
}
#tdv1Overlay.td-glitch{
 animation:tdGlitchPulse 160ms steps(2,end);
}
@keyframes tdGlitchPulse{
 0%{transform:translate3d(-2px,0,0);filter:contrast(1.12)}
 50%{transform:translate3d(2px,-1px,0);filter:saturate(.75) contrast(1.18)}
 100%{transform:translate3d(0,0,0);filter:none}
}
:root[data-td-dread-mode="soft"] #tdv1Overlay .td-scanlines{opacity:.22}
:root[data-td-dread-mode="soft"] #tdv1Overlay .td-corners i{border-color:rgba(72,229,255,.20)}
:root[data-td-dread-mode="soft"] #tdv1Overlay.td-alert .td-vignette{box-shadow:inset 0 0 calc(14px + var(--td-dread) * 14px) rgba(255,77,90,.12)}
:root[data-td-dread-mode="soft"] #tdv1Overlay.td-alert .td-corners i{border-color:rgba(255,77,90,.36)}
:root[data-td-dread-mode="soft"] #tdv1Overlay.td-alert #tdv1Telemetry,
:root[data-td-dread-mode="soft"] #play #hud #tdv1Telemetry.td-tel-alert{border-color:rgba(255,77,90,.40);border-top-color:rgba(255,77,90,.34);color:#f3a8b0}
:root[data-td-dread-mode="off"] #tdv1Overlay,
:root[data-td-dread-mode="off"] #tdv1Telemetry,
#play[hidden] #tdv1Overlay,
#play.in-cinematic #tdv1Overlay,
#play.in-cinematic #tdv1Telemetry,
#app[data-v58-mode="cinematic"] #tdv1Overlay,
#app[data-v58-mode="cinematic"] #tdv1Telemetry,
#play.v56-legacy #tdv1Overlay,
#play.v56-legacy #tdv1Telemetry,
#play.custom-motion #tdv1Overlay,
#play.custom-motion #tdv1Telemetry{display:none!important}
#play.observing #tdv1Telemetry{display:none!important}
#tdv1Overlay.td-lowfx .td-scanlines,
#tdv1Overlay.td-lowfx .td-vignette{display:none!important}
#tdv1Overlay.td-rm .td-vignette{box-shadow:none!important;transition:none!important}
#tdv1Overlay.td-rm .td-corners i{transition:none!important}
@media(max-height:520px) and (orientation:landscape){
 #play #hud #tdv1Telemetry{
  margin-top:4px;
  padding-top:3px;
  font-size:9px;
 }
}
@media(prefers-reduced-motion:reduce){
 #tdv1Overlay.td-glitch{animation:none!important;transform:none!important;filter:none!important}
 #tdv1Overlay .td-vignette,#tdv1Overlay .td-corners i{transition:none!important}
}
`;

 // WebAudio synth for mechanical relay UI clicks & low warning chime
 let audioCtx=null;
 function getAudioCtx(){
  if(audioCtx)return audioCtx;
  const Ctor=window.AudioContext||window.webkitAudioContext;
  if(!Ctor)return null;
  try{audioCtx=new Ctor();return audioCtx;}catch{return null;}
 }
 function unlockAudioIfNeeded(){
  const ctx=getAudioCtx();
  if(ctx&&ctx.state==='suspended'&&typeof ctx.resume==='function'){
   try{ctx.resume().catch(()=>{});}catch{}
  }
  return ctx;
 }
 function playRelayTick(){
  if(mode==='off')return;
  const prefs=readHostPrefs();
  if(!prefs.sound||prefs.volume<=0.005)return;
  const now=Date.now();
  if(now-lastTickAudioAt<42)return;
  lastTickAudioAt=now;
  const ctx=unlockAudioIfNeeded();
  if(!ctx||ctx.state!=='running'||typeof ctx.createOscillator!=='function')return;
  try{
   const t=ctx.currentTime;
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='triangle';
   osc.frequency.setValueAtTime(1480,t);
   osc.frequency.exponentialRampToValueAtTime(620,t+0.022);
   const amp=Math.max(0.001,(mode==='soft'?0.032:0.055)*prefs.volume);
   gain.gain.setValueAtTime(0.0001,t);
   gain.gain.exponentialRampToValueAtTime(amp,t+0.003);
   gain.gain.exponentialRampToValueAtTime(0.0001,t+0.024);
   osc.connect(gain);gain.connect(ctx.destination);
   osc.start(t);osc.stop(t+0.028);
   osc.onended=()=>{try{osc.disconnect();gain.disconnect();}catch{}};
  }catch{}
 }
 function playAlertPulse(){
  if(mode==='off')return;
  const prefs=readHostPrefs();
  if(!prefs.sound||prefs.volume<=0.005)return;
  const now=Date.now();
  if(now-lastAlertAudioAt<4500)return;
  lastAlertAudioAt=now;
  const ctx=getAudioCtx();
  if(!ctx||ctx.state!=='running'||typeof ctx.createOscillator!=='function')return;
  try{
   const t=ctx.currentTime;
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='sine';
   osc.frequency.setValueAtTime(210,t);
   osc.frequency.exponentialRampToValueAtTime(165,t+0.15);
   const amp=Math.max(0.001,(mode==='soft'?0.035:0.06)*prefs.volume);
   gain.gain.setValueAtTime(0.0001,t);
   gain.gain.exponentialRampToValueAtTime(amp,t+0.014);
   gain.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
   osc.connect(gain);gain.connect(ctx.destination);
   osc.start(t);osc.stop(t+0.17);
   osc.onended=()=>{try{osc.disconnect();gain.disconnect();}catch{}};
  }catch{}
 }

 let overlay=null,telemetryEl=null,modeBtn=null,styleInjected=false;
 function syncDomAppearance(){
  if(typeof document==='undefined')return;
  if(document.documentElement)document.documentElement.dataset.tdDreadMode=mode;
  const home=document.getElementById('home');
  if(home&&home.classList)home.classList.toggle('td-home-active',mode!=='off');
  if(modeBtn)modeBtn.textContent='压迫氛围：'+MODE_LABELS[mode];
  if(overlay){
   const prefs=readHostPrefs();
   const effDread=prefs.reduceMotion?0:lastDread;
   if(overlay.style&&typeof overlay.style.setProperty==='function'){
    overlay.style.setProperty('--td-dread',effDread.toFixed(3));
   }
   if(overlay.classList){
    overlay.classList.toggle('td-lowfx',!!prefs.lowEffects);
    overlay.classList.toggle('td-rm',!!prefs.reduceMotion);
    overlay.classList.toggle('td-alert',mode!=='off'&&lastRawDread>=0.68);
   }
  }
  if(telemetryEl&&telemetryEl.classList){
   telemetryEl.classList.toggle('td-tel-alert',mode!=='off'&&lastRawDread>=0.68);
  }
 }
 function broadcastMode(){
  try{
   const mount=typeof document!=='undefined'&&document.getElementById('mount');
   const iframe=mount&&mount.querySelector?mount.querySelector('iframe'):null;
   if(iframe&&iframe.contentWindow&&typeof iframe.contentWindow.postMessage==='function'){
    iframe.contentWindow.postMessage({type:'cunjie-tech-dread-mode',mode},'*');
   }
  }catch{}
 }
 function setMode(next){
  if(VALID_MODES.indexOf(next)<0)return mode;
  mode=next;
  writeMode(mode);
  if(mode==='off'){lastDread=0;lastRawDread=0;}
  syncDomAppearance();
  broadcastMode();
  return mode;
 }
 function cycleMode(){
  const idx=VALID_MODES.indexOf(mode);
  return setMode(VALID_MODES[(idx+1)%VALID_MODES.length]);
 }

 function ensureUiMounted(){
  if(typeof document==='undefined')return;
  if(!styleInjected&&document.head){
   const st=document.createElement('style');
   st.id='tdv1Style';
   st.textContent=styleText;
   document.head.appendChild(st);
   styleInjected=true;
  }
  const play=document.getElementById('play');
  if(play&&!document.getElementById('tdv1Overlay')){
   overlay=document.createElement('div');
   overlay.id='tdv1Overlay';
   overlay.setAttribute('aria-hidden','true');
   overlay.innerHTML='<div class="td-vignette"></div><div class="td-scanlines"></div><div class="td-corners"><i class="td-c-tl"></i><i class="td-c-tr"></i><i class="td-c-bl"></i><i class="td-c-br"></i></div>';
   play.appendChild(overlay);
  }else if(!overlay){
   overlay=document.getElementById('tdv1Overlay');
  }
  const hud=document.getElementById('hud');
  const hostTarget=hud||overlay;
  telemetryEl=telemetryEl||document.getElementById('tdv1Telemetry');
  if(!telemetryEl&&hostTarget){
   telemetryEl=document.createElement('div');
   telemetryEl.id='tdv1Telemetry';
   telemetryEl.textContent='REC ● SECTOR-01 · SCALE 30.0m · LOAD 000 kPa · STANDBY';
   hostTarget.appendChild(telemetryEl);
  }else if(telemetryEl&&hud&&telemetryEl.parentNode!==hud){
   hud.appendChild(telemetryEl);
  }
  const menu=document.getElementById('v56Menu');
  if(menu&&!document.getElementById('tdv1ModeBtn')){
   modeBtn=document.createElement('button');
   modeBtn.id='tdv1ModeBtn';
   modeBtn.type='button';
   modeBtn.onclick=()=>{
    cycleMode();
    playRelayTick();
   };
   const perfBtn=document.getElementById('v56PerfBtn');
   if(perfBtn&&perfBtn.parentNode===menu&&typeof menu.insertBefore==='function'){
    menu.insertBefore(modeBtn,perfBtn);
   }else{
    menu.appendChild(modeBtn);
   }
  }else if(!modeBtn){
   modeBtn=document.getElementById('tdv1ModeBtn');
  }
  syncDomAppearance();
 }

 function triggerGlitch(){
  if(mode!=='standard'||!overlay||!overlay.classList)return;
  const prefs=readHostPrefs();
  if(prefs.reduceMotion||prefs.lowEffects)return;
  const now=Date.now();
  if(now-lastGlitchAt<2500)return;
  lastGlitchAt=now;
  overlay.classList.remove('td-glitch');
  void overlay.offsetWidth;
  overlay.classList.add('td-glitch');
  if(glitchTimer)clearTimeout(glitchTimer);
  glitchTimer=setTimeout(()=>{
   if(overlay&&overlay.classList)overlay.classList.remove('td-glitch');
  },180);
 }

 function tickTelemetry(){
  ensureUiMounted();
  if(!overlay||mode==='off'){
   lastDread=0;lastRawDread=0;
   syncDomAppearance();
   return;
  }
  const snap=(window.CunjieRealms&&typeof window.CunjieRealms.snapshot==='function')?window.CunjieRealms.snapshot():null;
  if(!snap||snap.status!=='playing'){
   lastDread=0;lastRawDread=0;lastPressure=0;lastSilence=false;lastBurst=false;
   syncDomAppearance();
   if(telemetryEl)telemetryEl.textContent='REC ● SECTOR-01 · SCALE 30.0m · LOAD 000 kPa · STANDBY';
   return;
  }
  const p=clamp(Number(snap.live&&snap.live.pressure)||0,0,1);
  const moodVal=clamp((Number(snap.mood&&snap.mood.value)||0)/100,0,1);
  const silence=!!(snap.mood&&snap.mood.special==='silence');
  const burst=(Number(snap.mood&&snap.mood.burstRemaining)||0)>0;
  const rawDread=clamp(p*0.58+moodVal*0.28+(silence?0.25:0)+(burst?0.22:0),0,1);
  lastRawDread=rawDread;
  lastDread=mode==='soft'?rawDread*0.52:rawDread;

  const spiked=(p>=0.85&&lastPressure<0.85)||(silence&&!lastSilence)||(burst&&!lastBurst);
  if(spiked){
   triggerGlitch();
   if(p>=0.86||silence)playAlertPulse();
  }
  lastPressure=p;
  lastSilence=silence;
  lastBurst=burst;

  const sector=Math.max(1,Math.min(4,(Number(snap.stage)||0)+1));
  const kpa=String(Math.round(p*240)).padStart(3,'0');
  const status=burst?'OVERDRIVE':(silence?'SIGNAL VOID':(rawDread>=0.68?'HIGH LOAD':'OBSERVING'));
  if(telemetryEl){
   telemetryEl.textContent='REC ● SECTOR-0'+sector+' · SCALE 30.0m · LOAD '+kpa+' kPa · '+status;
  }
  syncDomAppearance();
 }

 function bindUiAudio(){
  if(typeof document==='undefined'||typeof document.addEventListener!=='function')return;
  document.addEventListener('click',e=>{
   const t=e&&e.target;
   if(!t||typeof t.closest!=='function')return;
   if(t.id==='tdv1ModeBtn')return;
   if(t.closest('#home button, #quick button, #v56Menu button, #modal button, #v56TouchDock button')){
    playRelayTick();
   }
  },{passive:true});
 }

 ensureUiMounted();
 bindUiAudio();
 if(typeof document!=='undefined'&&document.readyState==='loading'&&typeof document.addEventListener==='function'){
  document.addEventListener('DOMContentLoaded',ensureUiMounted,{once:true});
 }
 setTimeout(ensureUiMounted,120);
 const intervalId=typeof setInterval==='function'?setInterval(tickTelemetry,200):null;

 window.__cunjieTechDread={
  getMode:()=>mode,
  setMode,
  cycleMode,
  tick:tickTelemetry,
  destroy:()=>{if(intervalId)clearInterval(intervalId);},
  snapshot:()=>({mode,dread:Number(lastDread.toFixed(3)),rawDread:Number(lastRawDread.toFixed(3)),telemetry:telemetryEl?telemetryEl.textContent:''})
 };
})();
