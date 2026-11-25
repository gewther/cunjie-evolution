(function(g){
class SaveManager{
 constructor(storage){this.storage=storage;this.key='cunjie-stomp-impact-v1';this.data=this.clean(this.read());}
 read(){try{return JSON.parse(this.storage.getItem(this.key)||'{}')}catch{return{}}}
 clean(d){const p=d.prefs||{};const rq=(typeof CunjieRenderQuality!=='undefined'?CunjieRenderQuality.normalize(p.renderQuality):(['classic','auto','hd','qhd'].includes(p.renderQuality)?p.renderQuality:'hd'));return{version:2,prefs:{renderQuality:rq,shoeSkin:['aj5','aj6','qiaodan'].includes(p.shoeSkin)?p.shoeSkin:'aj5',debugOverlay:p.debugOverlay===true,aftermathFx:p.aftermathFx!==false,soleResidueFx:p.soleResidueFx!==false,aftermathLevel:['subtle','balanced','cinematic'].includes(p.aftermathLevel)?p.aftermathLevel:'cinematic',gooFx:p.gooFx!==false,adhesionLevel:['soft','classic','strong'].includes(p.adhesionLevel)?p.adhesionLevel:'classic',playbackSpeed:[1,0.5,0.25].includes(p.playbackSpeed)?p.playbackSpeed:1,impactFx:p.impactFx!==false,trainingGuide:p.trainingGuide!==false,autoEnabled:p.autoEnabled!==false,autoPersonality:['adaptive','calm','hunter','frenzy'].includes(p.autoPersonality)?p.autoPersonality:'adaptive',autoPace:['slow','normal','fast'].includes(p.autoPace)?p.autoPace:'normal',autoSmart:p.autoSmart!==false,autoDialogue:p.autoDialogue!==false,autoObserve:p.autoObserve===true,cinematicQuality:['auto','low','high'].includes(p.cinematicQuality)?p.cinematicQuality:'auto',cinematicCaptions:p.cinematicCaptions!==false,reduceMotion:p.reduceMotion===true,lowEffects:p.lowEffects===true,npcVoices:p.npcVoices!==false,npcFrequency:[.5,1,1.5].includes(p.npcFrequency)?p.npcFrequency:1,footstepFx:p.footstepFx!==false,footstepVolume:Math.max(0,Math.min(1,Number.isFinite(p.footstepVolume)?p.footstepVolume:.65)),sound:p.sound!==false,bubbles:p.bubbles!==false,opacity:Math.max(.3,Math.min(1,Number(p.opacity)||.9)),shake:p.shake!==false,volume:Math.max(0,Math.min(1,Number.isFinite(p.volume)?p.volume:.45))},best:Math.max(0,Number(d.best)||0),unlocked:[...new Set([0,...(Array.isArray(d.unlocked)?d.unlocked.filter(n=>Number.isInteger(n)&&n>=0&&n<=2):[])])],seen:[...new Set(Array.isArray(d.seen)?d.seen.filter(n=>n===0||n===1):[])],achievements:Array.isArray(d.achievements)?d.achievements.filter(s=>['complete','rankS','interior','steady'].includes(s)):[],records:Array.isArray(d.records)?d.records.slice(0,20).filter(r=>r&&Number.isFinite(r.score)&&['S','A','B','F'].includes(r.rank)):[]};}
 save(){try{this.storage.setItem(this.key,JSON.stringify(this.data));return true}catch{return false}}
 export(){return JSON.stringify({schema:'cunjie-stomp-v41',version:2,data:this.data},null,2)}
 import(text){if(text.length>1000000)throw Error('文件过大');let d=JSON.parse(text);if(d.schema==='cunjie-xl-v33'&&d.version===1){this.data.prefs.sound=(d.prefs?.volume??25)>0;this.data.prefs.volume=Math.max(0,Math.min(1,(d.prefs?.volume??25)/100));this.data.prefs.bubbles=d.prefs?.enabled!==false;}else{if(d.schema!=='cunjie-stomp-v41'||![1,2].includes(d.version))throw Error('不是支持的记录');this.data=this.clean(d.data||{});}this.save();}
 record(r){this.data.records.unshift(r);this.data.records=this.data.records.slice(0,20);this.data.best=Math.max(this.data.best,r.score);if(r.rank!=='F'&&!this.data.achievements.includes('complete'))this.data.achievements.push('complete');if(r.rank==='S'&&!this.data.achievements.includes('rankS'))this.data.achievements.push('rankS');this.save();}
}
g.SaveManager=SaveManager;if(typeof module!=='undefined')module.exports=SaveManager;
})(globalThis);

/* v5.4.1 - visual-only skin switch. The legacy physics/selection code is unchanged. */
(function(g){
class ShoeSkin {
 static normalize(v){return ['aj5','aj6','qiaodan'].includes(v)?v:'aj5';}
 static legacy(source,original,alternate,selection){
  const skin=this.normalize(selection);
  const hdFlag=skin==='aj6'?'window.cunjieHDaj6=true;':'';
  const tag=`<script>window.__cunjieShoeSkin=${JSON.stringify(skin)};${hdFlag}<\/script>`.replace('<\\/','</');
  const out=skin==='aj5'?source:(()=>{
   if(!source.includes(original))throw Error('AJ5 legacy atlas not found in embedded engine');
   if(!alternate||alternate===original)throw Error('Missing AJ6 atlas');
   return source.replace(original,alternate);
  })();
  return out.includes('<head>')?out.replace('<head>','<head>'+tag):out;
 }
 static image(images,selection){return images[{aj5:'sneakersAJ5',aj6:'sneakersAJ6',qiaodan:'sneakersQiaodan'}[this.normalize(selection)]];}
}
g.CunjieShoeSkin=ShoeSkin;
if(typeof module!=='undefined')module.exports=ShoeSkin;
})(globalThis);

(function(g){
class StageManager{
 constructor(config,save,hooks={}){this.config=config;this.save=save;this.hooks=hooks;this.reset();}
 reset(){this.stage=0;this.status='home';this.elapsed=0;this.results=[];this.failures=0;this.cutscene=0;this.practice=false;this.live={controlled:0,escapes:0,score:0,combo:0,stability:1,efficiency:1};}
 start(practice=false,stage=0){this.reset();this.practice=practice;this.stage=stage;this.status='loading';this.hooks.load?.(stage);}
 ready(){if(this.status==='loading'){this.status='playing';this.elapsed=0;this.hooks.ready?.(this.stage);}}
 update(dt,s){if(this.status==='cutscene'){if(typeof this.hooks.updateCutscene==='function'){const finished=this.hooks.updateCutscene(dt,this.stage);this.cutscene=this.hooks.cutsceneElapsed?.()??this.cutscene;if(finished===true)this.finishCutscene();return;}this.cutscene+=dt;if(this.cutscene>=8)this.finishCutscene();return;}if(this.status!=='playing')return;this.live={...this.live,...s};this.elapsed=Math.min(this.config[this.stage].duration,this.elapsed+Math.min(.1,Math.max(0,dt)));if(this.practice)return;const c=this.config[this.stage];if(this.live.escapes>c.maxEscapes)this.endStage(false);
 else if(this.stage===2&&c.rallyGoal){
  const ready=this.live.rallyCleared>=c.rallyGoal&&this.live.burstUsed&&this.live.burstRemaining<=0&&this.live.controlled>=c.goal;
  if(ready&&this.elapsed>=(c.earlyAfter||0))this.endStage(true);
  else if(this.elapsed>=c.duration-1e-6){this.elapsed=c.duration;this.endStage(!!ready);}
 }
 else if(c.earlyAfter&&this.elapsed>=c.earlyAfter&&this.live.controlled>=c.goal&&(this.live.cycles||0)>=(c.minCycles||0)&&(this.live.zones||0)>=(c.minZones||0))this.endStage(true);else if(this.elapsed>=c.duration-1e-6){this.elapsed=c.duration;this.endStage(this.live.controlled>=c.goal&&(this.live.cycles||0)>=(c.minCycles||0)&&(this.live.zones||0)>=(c.minZones||0));}}
 endStage(won){if(this.status!=='playing')return;this.hooks.freeze?.();if(!won){this.failures++;this.status='failed';this.hooks.result?.(false);return;}
 const c=this.config[this.stage],l=this.live;let quality=Math.min(1,l.controlled/(c.goal*1.6))*.55+Math.max(0,1-l.escapes/(c.maxEscapes+1))*.2+(l.stability??1)*.15+(l.efficiency??1)*.1;let rank=quality>=.9?'S':quality>=.7?'A':'B';
 // An S grade is earned by technique, not merely farming control count. Old saves
 // are never regraded; snapshots without tactics remain valid for archive tests.
 if(rank==='S'&&l.tactics){const t=l.tactics;
  if(this.stage===0&&(t.landings<4||t.accuracy<.4))rank='A';
  if(this.stage===1&&(t.revealed<2||(t.validKneads+t.validSweeps)<2))rank='A';
  if(this.stage===2&&(t.rallyInteractions<3||t.burstEffective<4))rank='A';
 }
 this.results.push({stage:this.stage,score:Math.round(l.score||l.controlled*100),controlled:l.controlled,escapes:l.escapes,combo:l.combo,rank,stability:l.stability,efficiency:l.efficiency,cycles:l.cycles||0,zones:l.zones||0,kneads:l.kneads||0,sweeps:l.sweeps||0,rallyCleared:l.rallyCleared||0,burstUsed:!!l.burstUsed,tactics:l.tactics?{...l.tactics}:null});
 if(this.stage===2){this.status='complete';this.hooks.result?.(true);}else{this.status='cutscene';this.cutscene=0;this.hooks.cutscene?.(this.stage,{result:{...this.results[this.results.length-1]},live:{...this.live},elapsed:this.elapsed});}}
 finishCutscene(){if(this.status!=='cutscene')return;const previous=this.stage;if(!this.save.data.seen.includes(previous))this.save.data.seen.push(previous);this.stage++;if(!this.save.data.unlocked.includes(this.stage))this.save.data.unlocked.push(this.stage);this.save.save();this.status='loading';this.live={controlled:0,escapes:0,score:0,combo:0,stability:1,efficiency:1};this.hooks.load?.(this.stage);}
 skip(){if(this.status==='cutscene'&&this.save.data.seen.includes(this.stage))this.finishCutscene();}
 restart(){if(!['playing','failed','loading'].includes(this.status))return;this.hooks.freeze?.();this.status='loading';this.elapsed=0;this.live={controlled:0,escapes:0,score:0,combo:0,stability:1,efficiency:1};this.hooks.load?.(this.stage);}
 retry(){if(this.status!=='failed')return;this.status='loading';this.elapsed=0;this.live={controlled:0,escapes:0,score:0,combo:0,stability:1,efficiency:1};this.hooks.load?.(this.stage);}
 summary(){let score=this.results.reduce((a,r)=>a+r.score,0),controlled=this.results.reduce((a,r)=>a+r.controlled,0),escapes=this.results.reduce((a,r)=>a+r.escapes,0),combo=Math.max(0,...this.results.map(r=>r.combo||0));const ranks=this.results.map(r=>r.rank);return{date:new Date().toISOString(),score,controlled,escapes,combo,failures:this.failures,failedStage:this.status==='failed'?{stage:this.stage,...this.live}:null,stages:this.results.map(r=>({...r})),rank:this.status==='complete'?(ranks.every(r=>r==='S')&&this.failures===0?'S':ranks.includes('B')||this.failures>1?'B':'A'):'F'};}
}
g.StageManager=StageManager;if(typeof module!=='undefined')module.exports=StageManager;
})(globalThis);

/* Cunjie v5.4. Canvas-only, noninteractive feedback over the unchanged
 * original 11-slot sprite renderer. All events come from the live engine.
 */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS={
 'landing-hit':'#9ddfc4','landing-miss':'#e8af81',
 'cover-found':'#a2dcf0','cover-empty':'#bdc2bb',
 'sweep-found':'#b7e9f0','sweep-empty':'#b5b5aa',
 'rally-sweep':'#f4d188','rally-knead':'#f4d188','rally-clear':'#f4e7aa',
 'burst':'#f5ae83'
};
const LABELS={
 'landing-hit':'有效落脚','landing-miss':'空踩',
 'cover-found':'发现藏匿','cover-empty':'没有发现',
 'sweep-found':'搜寻成功','sweep-empty':'未命中',
 'rally-sweep':'通道推进','rally-knead':'据点推进',
 'rally-clear':'据点瓦解','burst':'狂热爆发'
};
class ImpactFeedback{
 constructor(canvas,host){this.canvas=canvas;this.host=host;this.ctx=canvas.getContext('2d');this.reset();}
 reset(){this.effects=[];this.lastKey='';this.stage=-1;this.lastFrame=-1;this.enabled=true;this.reduceMotion=false;this.lowEffects=false;this.latest=null;}
 observe(now,stage,s,prefs={}){
  if(!s||!s.world||!s.viewport)return;
  if(this.stage!==stage){this.reset();this.stage=stage;}
  this.enabled=prefs.impactFx!==false;this.reduceMotion=!!prefs.reduceMotion;this.lowEffects=!!prefs.lowEffects;
  this.latest=s;
  if(!this.enabled)return;
  const f=s.feedback;
  if(!f||!COLORS[f.kind]||!Number.isFinite(f.time)||!Number.isFinite(s.gameTime))return;
  const age=s.gameTime-f.time;
  // Do not resurrect old effects on resume or stage initialization.
  if(age<-.05||age>.40)return;
  const key=stage+':'+f.kind+':'+f.time;
  if(key===this.lastKey)return;
  this.lastKey=key;
  const world=s.world;
  let fx=world.footX;
  if((f.kind==='landing-hit'||f.kind==='landing-miss')&&Number.isFinite(s.tactics?.lastResult?.x))fx=s.tactics.lastResult.x;
  const nx=clamp((fx||0)/Math.max(1,world.width||1),0,1);
  const prev=this.effects[this.effects.length-1];
  if(prev && now-prev.at<190 && prev.kind===f.kind && Math.abs(prev.x-nx)<.085){
   prev.count=Math.min(99,(prev.count||1)+1);prev.at=now;prev.eventId=key;return;
  }
  this.effects.push({at:now,eventId:key,count:1,kind:f.kind,x:nx,
    y:clamp((world.floorY??(world.height||1)*.87)/Math.max(1,world.height||1),0,1),
    viewport:{...s.viewport},text:LABELS[f.kind],color:COLORS[f.kind]});
  if(this.effects.length>(root.cunjieV59CleanNumbers===false?8:4))this.effects.shift();
 }
 resize(){
  const rect=this.host.getBoundingClientRect();
  const dpr=clamp(root.devicePixelRatio||1,1,2);
  const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  this.canvas.style.width=rect.width+'px';this.canvas.style.height=rect.height+'px';
  this.ctx.setTransform(dpr,0,0,dpr,0,0);
  return {rect,width:rect.width,height:rect.height};
 }
 draw(now){
  if(!this.ctx)return;
  const {rect,width,height}=this.resize();const c=this.ctx;
  c.clearRect(0,0,width,height);
  const eventLine=this.host.querySelector('#v59HitEvent');
  if(!this.enabled||!this.latest){if(eventLine)eventLine.hidden=true;return;}
  const s=this.latest,wp=s.world,vp=s.viewport;
  // A dim floor pressure halo communicates sustained contact without modifying
  // the original shoe art or drawing an invented silhouette/sole.
  if(!this.lowEffects&&!this.reduceMotion&&wp.footState===3&&s.pressure>.12){
   const x=vp.left-rect.left+(wp.footX/wp.width)*vp.width,
    y=vp.top-rect.top+((wp.floorY??wp.height*.87)/wp.height)*vp.height;
   const radius=Math.max(7,Math.min(36,(s.pressure||0)*35));
   c.save();c.strokeStyle=['#8bc5b8','#b6d1cf','#e3b188'][this.stage]||'#8bc5b8';
   c.globalAlpha=clamp(s.pressure*.38,0,.4);c.lineWidth=2;c.beginPath();
   c.ellipse(x,y,radius*1.8,radius*.34,0,0,Math.PI*2);c.stroke();c.restore();
  }
  this.effects=this.effects.filter(e=>now-e.at<850);
  if(eventLine){
   const current=this.effects[this.effects.length-1];
   const visible=root.cunjieV59CleanNumbers!==false&&!!current;
   eventLine.hidden=!visible;
   if(visible){eventLine.textContent=current.text+(current.count>1?' ×'+current.count:'');eventLine.dataset.eventId=current.eventId;}
  }
  for(const e of this.effects){const t=clamp((now-e.at)/850,0,1),fade=this.reduceMotion?Math.max(0,1-t*2):1-t;
   const x=e.viewport.left-rect.left+e.x*e.viewport.width,
     y=e.viewport.top-rect.top+e.y*e.viewport.height,
     radius=this.reduceMotion?12:10+55*t;
   c.save();c.globalAlpha=fade*.88;c.strokeStyle=e.color;c.lineWidth=Math.max(1,3-2*t);
   c.beginPath();c.ellipse(x,y,radius*1.4,radius*.40,0,0,Math.PI*2);c.stroke();
   if(!this.lowEffects&&!this.reduceMotion){
    c.lineWidth=2;for(let i=0;i<7;i++){let a=Math.PI*(i/6),rr=radius*.8;
      c.beginPath();c.moveTo(x+Math.cos(a)*rr,y-Math.sin(a)*rr*.45);
      c.lineTo(x+Math.cos(a)*(rr+9),y-Math.sin(a)*(rr+9)*.45);c.stroke();}
   }
   if(root.cunjieV59CleanNumbers===false && (this.reduceMotion? t<.25 :t<.76)){
    c.font='bold 13px system-ui, Microsoft YaHei, sans-serif';c.textAlign='center';
    const tw=c.measureText(e.text).width+20,cy=y-35-(this.reduceMotion?0:t*18);
    c.fillStyle='#101c24df';c.fillRect(x-tw/2,cy-14,tw,24);
    c.fillStyle=e.color;c.fillText(e.text,x,cy+2);
   }
   c.restore();
  }
 }
}
root.ImpactFeedback=ImpactFeedback;
if(typeof module!=='undefined'&&module.exports)module.exports=ImpactFeedback;
})(globalThis);

/* Cunjie v5.4: optional practice objectives derived from authoritative
 * stage snapshots. Does not affect physics, score, saves or stage unlocking.
 */
(function(root){'use strict';
const n=v=>Number.isFinite(v)?v:0;
class PracticeDrills{
 constructor(){this.reset(0);}
 reset(stage){this.stage=stage;this.completed=false;this.completeCount=0;}
 progress(stage,s={}){
  const t=s.tactics||{};
  if(stage===0){const hit=n(t.hitLandings),land=n(t.landings),acc=land>0?hit/land:0;
   return {title:'精准落脚',steps:[{label:'有效落脚',value:hit,goal:3},{label:'准确率',value:Math.round(acc*100),goal:60,unit:'%'}],
    complete:hit>=3&&land>=3&&acc>=.60,
    tip:n(t.misses)>=2&&acc<.6?'空踩较多：先抬脚观察，再调整落点':'先抬脚找准位置，再连续落脚'};}
  if(stage===1){const knead=n(t.validKneads),sweep=n(t.validSweeps),revealed=n(t.revealed);
   return {title:'地毯搜寻',steps:[{label:'有效蓄压',value:knead,goal:1},{label:'有效横扫',value:sweep,goal:1},{label:'发现藏匿',value:revealed,goal:2}],
    complete:knead>=1&&sweep>=1&&revealed>=2,
    tip:knead<1?'寻找浅色痕迹并尝试原地蓄压':sweep<1?'尝试接地后横向移动':'继续追踪藏匿区域'};}
  const rallied=n(s.rallyCleared),burst=n(t.burstEffective);
  return {title:'终局据点',steps:[{label:'清除据点',value:rallied,goal:3},{label:'发动爆发',value:s.burstUsed?1:0,goal:1},{label:'爆发成果',value:burst,goal:4}],
   complete:rallied>=3&&!!s.burstUsed&&burst>=4,
   tip:rallied<3?'木地板稳压、地毯蓄力、通道横扫分别处理':!s.burstUsed?'据点完成后，狂热值达到70时发动爆发':'在爆发期间争取额外控制'};
 }
 update(stage,s){if(stage!==this.stage)this.reset(stage);const p=this.progress(stage,s);
  const newlyCompleted=p.complete&&!this.completed;
  if(p.complete){this.completed=true;if(newlyCompleted)this.completeCount++;}
  return {...p,complete:this.completed,newlyCompleted};
 }
 static describe(p){return p.steps.map(s=>`${s.label} ${Math.min(s.value,s.goal)}/${s.goal}${s.unit||''}`).join(' · ');}
}
root.PracticeDrills=PracticeDrills;
if(typeof module!=='undefined'&&module.exports)module.exports=PracticeDrills;
})(globalThis);

(function(g){
class RealmDialogue{
 constructor(bank,original){this.bank={...bank,pressure:[...bank.pressure,...original.stages[1].events.pressure.lines]};this.original=original;this.now=0;this.current=null;this.log=[];this.last={};this.indices={};this.serial=0;this.giant={};this.lastReaction=-100;this.recent=[];}
 configureReactive(data){this.giant={};for(const l of data.lines||[]){const key=l.stage+':'+l.event;(this.giant[key]??=[]).push(l.text);}}
 resetStage(stage){this.stage=stage;this.current=null;this.last={};this.lastReaction=-100;this.recent=[];}
 event(type,priority=30){let lines=this.bank[type];if(!lines)return;if(type==='enter')lines=lines[this.stage];if(type==='transition')lines=lines.slice(this.stage*2,this.stage*2+2);if(!Array.isArray(lines)||!lines.length)return;if(this.current&&this.current.priority>priority)return;if(priority<80&&this.now-(this.last[type]??-100)<13)return;if(priority<80&&this.current)return;let k=this.stage+':'+type,i=this.indices[k]||0;this.indices[k]=i+1;this.show(lines[i%lines.length],priority,type);}
 react(event){if(this.current||this.now-this.lastReaction<6.8||this.now-(this.last['react-'+event]??-100)<10)return false;const key=this.stage+':'+event,lines=this.giant[key];if(!lines?.length)return false;let usable=lines.filter(t=>!this.recent.includes(t));if(!usable.length)usable=lines;const i=this.indices[key]||0;const text=usable[i%usable.length];this.indices[key]=i+1;this.lastReaction=this.now;this.recent.unshift(text);this.recent=this.recent.slice(0,8);this.show(text,43,'react-'+event);return true;}
 show(text,priority=30,type='legacy'){if(!text||this.current&&this.current.priority>priority)return;this.last[type]=this.now;this.serial++;this.current={text,priority,until:this.now+Math.min(5.6,Math.max(3.5,2.1+Array.from(text).length*.13)),serial:this.serial};this.log.unshift({text,stage:this.stage,time:Math.floor(this.now)});this.log=this.log.slice(0,120);}
 update(dt){this.now+=dt;if(this.current&&this.now>this.current.until)this.current=null;}
}

g.RealmDialogue=RealmDialogue;
})(globalThis);

(function(g){
class RealmAudio{
 constructor(data){this.data=data;this.ctx=null;this.buffers={};this.loading=null;this.active=new Set();}
 async unlock(){if(!this.ctx){const A=g.AudioContext||g.webkitAudioContext;if(!A)return;this.ctx=new A();}await this.ctx.resume().catch(()=>{});if(!this.loading)this.loading=Promise.all(Object.entries(this.data).map(async([name,url])=>{try{this.buffers[name]=await this.ctx.decodeAudioData(await(await fetch(url)).arrayBuffer())}catch(e){}}));await this.loading;}
 play(name,volume=.15,low=false){if(!this.ctx||!this.enabled||!this.buffers[name])return;const s=this.ctx.createBufferSource(),gain=this.ctx.createGain();s.buffer=this.buffers[name];gain.gain.value=volume*(this.volume??.5);s.connect(gain);if(low){const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=220;gain.connect(f);f.connect(this.ctx.destination);}else gain.connect(this.ctx.destination);s.start();this.active.add(s);s.onended=()=>this.active.delete(s);}
 chuckle(){if(!this.ctx||!this.enabled||!this.ctx.createOscillator)return;let now=this.ctx.currentTime;for(let i=0;i<4;i++){let o=this.ctx.createOscillator(),a=this.ctx.createGain(),at=now+i*.22;o.type='triangle';o.frequency.setValueAtTime(92-i*5,at);o.frequency.exponentialRampToValueAtTime(52,at+.14);a.gain.setValueAtTime(.0001,at);a.gain.exponentialRampToValueAtTime(.045*(this.volume||.4),at+.035);a.gain.exponentialRampToValueAtTime(.0001,at+.19);o.connect(a);a.connect(this.ctx.destination);o.start(at);o.stop(at+.2);this.active.add(o);o.onended=()=>this.active.delete(o);}}
 stop(){for(const s of this.active)try{s.stop()}catch{}this.active.clear();}
}
g.RealmAudio=RealmAudio;
})(globalThis);

/* Cunjie v5.5 P0: event-synchronised, additive Web Audio foot-contact layer.
 * Effects are gated by the existing sound/volume settings, and never alter physics.
 * The legacy engine retains ownership of its old sound effects.
 */
(function(root){'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
class FootstepAudio {
 constructor(audio){this.audio=audio;this.reset();this.active=new Set();this.noise=null;this.maxVoices=16;this.emitted=[];}
 reset(){this.stage=-1;this.last=null;this.pressureStep=0;this.lastAccentAt=-1e6;this.emitted=[];}
 // Only authoritative stage counters and foot states trigger sound; HUD frames do not.
 observe(stage,s,skin='aj5',prefs={}){
  const world=s?.world;
  if(!world||!Number.isFinite(s.gameTime))return [];
  const state={landings:Math.max(0,s.landings||0),footState:world.footState,
   pressure:clamp(Number(s.pressure)||0,0,1),time:s.gameTime,material:s.material||'wood'};
  if(stage!==this.stage||!this.last||state.time<this.last.time-.05||state.landings<this.last.landings){
   this.stage=stage;this.last=state;this.pressureStep=0;return [];
  }
  let events=[],last=this.last;
  if(state.landings>last.landings){
   // Coalescing protects the audio path if the rendering thread skipped frames.
   let force=s.manualTouch?.enabled?clamp(.08+(s.manualTouch.contactSpeed||0)/160,.08,1):clamp(.35+state.pressure*.55,0.24,1);
   events.push({kind:'landing',stage,skin,material:state.material,strength:force});this.pressureStep=0;
  }
  const grounded=state.footState===3;
  if(grounded&&state.pressure>=.36&&this.pressureStep<1&&state.time-this.lastAccentAt>.12){
   events.push({kind:'pressure',stage,skin,material:state.material,strength:state.pressure});this.pressureStep=1;this.lastAccentAt=state.time;
  }
  if(grounded&&state.pressure>=.74&&this.pressureStep<2&&state.time-this.lastAccentAt>.12){
   events.push({kind:'pressure',stage,skin,material:state.material,strength:state.pressure});this.pressureStep=2;this.lastAccentAt=state.time;
  }
  if(last.footState===3&&!grounded){
   events.push({kind:'release',stage,skin,material:state.material,strength:Math.max(.24,last.pressure)});this.pressureStep=0;
  }
  this.last=state;
  const audible=prefs.sound!==false&&prefs.footstepFx!==false&&prefs.footstepVolume!==0;
  if(audible)for(const e of events)this.render(e,prefs);
  this.emitted=events;return events;
 }
 _makeNoise(ctx){
  const buf=ctx.createBuffer(1,Math.max(1,Math.round(ctx.sampleRate*.46)),ctx.sampleRate);
  const data=buf.getChannelData(0);let seed=0x12db4be7;
  for(let i=0;i<data.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;data[i]=(seed/2147483648)*.6;}
  return buf;
 }
 render(e,prefs={}){
  const ctx=this.audio?.ctx;
  if(!ctx||ctx.state!=='running'||!this.audio.enabled||!ctx.createOscillator||!ctx.createBufferSource)return false;
  if(this.active.size>=this.maxVoices)return false;
  const master=clamp(Number(this.audio.volume)||0,0,1)*clamp(Number(prefs.footstepVolume??.65),0,1);
  if(master<=0)return false;
  const now=ctx.currentTime,shoe=e.stage===0;
  // The different footwear and surfaces share a renderer, not the same timbre.
  const spec=shoe?(e.skin==='aj6'?{bass:57,decay:.28,grit:680,attack:.19}:{bass:77,decay:.21,grit:970,attack:.16}):
   e.stage===1?{bass:106,decay:.16,grit:320,attack:.085}:e.material==='carpet'?{bass:93,decay:.15,grit:290,attack:.075}:{bass:89,decay:.19,grit:520,attack:.11};
  const gainMult=e.kind==='landing'?1:e.kind==='pressure'?.31:.20;
  const duration=e.kind==='landing'?spec.decay:e.kind==='pressure'?.115:.10;
  const loud=master*spec.attack*gainMult*clamp(e.strength||.5,.2,1);
  if(loud<=0)return false;
  try{
   const tone=ctx.createOscillator(),env=ctx.createGain();tone.type=e.kind==='release'?'triangle':'sine';
   const pitch=spec.bass*(e.kind==='release'?1.8:e.kind==='pressure'?.8:1);
   tone.frequency.setValueAtTime(pitch*1.3,now);
   tone.frequency.exponentialRampToValueAtTime(Math.max(20,pitch*.64),now+duration*.75);
   env.gain.setValueAtTime(.00001,now);env.gain.exponentialRampToValueAtTime(loud,now+.008);
   env.gain.exponentialRampToValueAtTime(.00001,now+duration);
   tone.connect(env);env.connect(ctx.destination);tone.start(now);tone.stop(now+duration+.012);
   this.active.add(tone);tone.onended=()=>this.active.delete(tone);
   if(e.kind!=='pressure'){
    const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),nGain=ctx.createGain();
    noise.buffer=this.noise||this._makeNoise(ctx);this.noise=noise.buffer;
    filter.type='lowpass';filter.frequency.value=spec.grit;
    nGain.gain.setValueAtTime(.00001,now);
    nGain.gain.exponentialRampToValueAtTime(loud*(e.kind==='release'?.22:.75),now+.006);
    nGain.gain.exponentialRampToValueAtTime(.00001,now+Math.min(duration,.13));
    noise.connect(filter);filter.connect(nGain);nGain.connect(ctx.destination);
    noise.start(now);noise.stop(now+Math.min(duration,.13)+.014);
    this.active.add(noise);noise.onended=()=>this.active.delete(noise);
   }
   return true;
  }catch{return false;}
 }
 audition(skin='aj5',prefs={}){return this.render({kind:'landing',stage:0,skin,material:'wood',strength:.9},prefs);}
 stop(){for(const n of this.active)try{n.stop()}catch{}this.active.clear();}
}
root.FootstepAudio=FootstepAudio;
if(typeof module!=='undefined'&&module.exports)module.exports=FootstepAudio;
})(globalThis);

(function(g){
/* v4.8c: reactive crowd chatter; IDs must refer to visible live NPCs. */
class TinyVoices{
 constructor(data,random=Math.random){
  this.data=data;this.random=random;this.time=0;this.active=[];this.memory=new Map();this.recent=[];this.next=0;this.groupAt=-100;this.pairAt=-100;this.pending=[];this.responses=[];this.serial=0;this.lastResponse=-100;this.log=[];
  this.banks={};for(let stage=0;stage<3;stage++){this.banks[stage]={};for(const line of data.lines||[])if(line.stages.includes(stage))(this.banks[stage][line.event]??=[]).push(line);}
 }
 reset(stage){this.stage=stage;this.active=[];this.memory.clear();this.next=this.time+.35;this.groupAt=this.pairAt=-100;this.responses=[];this.pending=[];this.recent=[];}
 clear(){this.active=[];this.memory.clear();this.responses=[];this.pending=[];}
 choose(event,stage){let choices=(this.banks[stage]||{})[event]||[];if(!choices.length)return null;let unused=choices.filter(l=>!this.recent.includes(l.text));if(unused.length)choices=unused;let total=choices.reduce((s,l)=>s+(l.weight||1),0),v=this.random()*total;for(const l of choices){v-=l.weight||1;if(v<=0)return l;}return choices[choices.length-1];}
 add(n,line,group=false,members=[]){if(!line||this.active.length>=3)return false;
  const duration=Math.min(2.8,Math.max(1.35,.82+Array.from(line.text).length*.12));
  const item={id:n.id,text:line.text,priority:line.priority||30,x:n.x,y:n.y,until:this.time+duration,born:this.time,group,members};
  this.active.push(item);this.recent.unshift(line.text);this.recent.length=Math.min(this.recent.length,12);this.serial++;
  this.log.unshift({stage:this.stage,event:line.event,text:line.text,time:Math.floor(this.time)});this.log.length=Math.min(this.log.length,120);
  const m=this.memory.get(n.id)||{at:-100,seen:false};m.at=this.time;m.seen=true;this.memory.set(n.id,m);
  if(line.event==='plead'&&this.time-this.lastResponse>13){this.lastResponse=this.time;this.responses.push('plead');}
  return true;
 }
 update(dt,npcs,stage,frequency=1){
  this.time+=Math.max(0,dt);this.stage=stage;const live=new Map();for(const n of npcs||[])if(n&&n.id!=null&&n.alive!==false&&n.visible!==false&&n.x>=0&&n.x<=1000&&n.y>=0&&n.y<=600)live.set(n.id,n);
  this.active=this.active.filter(b=>b.until>this.time&&(b.group?b.members.some(id=>live.has(id)):live.has(b.id)));
  for(const id of this.memory.keys())if(!live.has(id))this.memory.delete(id);
  for(const b of this.active){if(b.group){const members=b.members.map(id=>live.get(id)).filter(Boolean);if(members.length){b.x=members.reduce((v,n)=>v+n.x,0)/members.length;b.y=members.reduce((v,n)=>v+n.y,0)/members.length;}}else{const n=live.get(b.id);if(n){b.x=n.x;b.y=n.y;}}}
  if(!frequency){this.active=[];this.responses=[];this.pending=[];return;}
  this.pending=this.pending.filter(p=>p.due>this.time-2&&live.has(p.id));
  if(this.pending.length&&this.active.length<3){const i=this.pending.findIndex(p=>p.due<=this.time);if(i>=0){const p=this.pending.splice(i,1)[0];this.add(live.get(p.id),p.line);}}
  if(this.time<this.next||!live.size)return;
  this.next=this.time+Math.max(.39,(.73+live.size/420)/Math.max(.5,frequency));
  if(this.active.length>=3)return;
  const all=[...live.values()],danger=all.filter(n=>n.danger>.62);
  // Contextual, collective alarm anchored at the actual group, not at the center of the screen.
  if(danger.length>=9&&this.time-this.groupAt>14/frequency&&this.active.length<=1){const line=this.choose('group',stage);if(line){const group=danger.slice(0,40),anchor={id:'group',x:group.reduce((v,n)=>v+n.x,0)/group.length,y:group.reduce((v,n)=>v+n.y,0)/group.length};this.groupAt=this.time;this.add(anchor,line,true,group.map(n=>n.id));return;}}
  // An exchange requires two separately alive, close NPCs (not invented voices off screen).
  if(this.time-this.pairAt>9/frequency&&this.active.length===0&&all.length>=2&&this.random()<.28){
   const first=all[Math.floor(this.random()*all.length)];const peers=all.filter(n=>n.id!==first.id&&Math.abs(n.x-first.x)<80&&Math.abs(n.y-first.y)<80);
   if(peers.length){const second=peers[Math.floor(this.random()*peers.length)],a=this.choose('call',stage),b=this.choose('answer',stage);if(a&&b){this.pairAt=this.time;this.add(first,a);this.pending.push({id:second.id,line:b,due:this.time+.55});return;}}
  }
  let options=[];for(const n of all){const mem=this.memory.get(n.id)||{at:-100,seen:false};if(this.time-mem.at<3.6/Math.max(.7,frequency)||this.active.some(b=>b.id===n.id))continue;
   let event=n.event||(n.cornered?'plead':n.danger>.55?'approach':n.hidden?'safety':!mem.seen?'discover':'chaos');
   if(stage===1&&event==='paw')event='approach';
   const isSocial=['fall','help','rescued','signal','hide','flee'].includes(event);
   if(!isSocial&&!mem.seen&&n.danger<.45)event='discover';
   else if(event==='plead'&&!n.cornered&&n.danger<.63)event='approach';
   if(event==='chaos'&&n.danger<.15&&mem.seen)continue;
   const line=this.choose(event,stage)||this.choose('chaos',stage);if(!line)continue;
   const urgency=event==='plead'?12:event==='rally'?7:event==='approach'||event==='evade'?5:0;
   const score=(line.priority||0)+urgency+(n.danger||0)*10+this.random()*15;
   options.push({n,line,score});
  }
  options.sort((a,b)=>b.score-a.score);
  for(const choice of options.slice(0,9)){if(this.random()>Math.min(1,(choice.line.probability??.9)*frequency))continue;if(this.add(choice.n,choice.line))break;}
 }
 snapshot(){return this.active.map(b=>({...b}));}
}
g.TinyVoices=TinyVoices;if(typeof module!=='undefined')module.exports=TinyVoices;
})(globalThis);

(function(g){
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
class FeverController{
 constructor(data,random=Math.random){this.data=data;this.random=random;this.now=0;this.value=8;this.pending=[];this.last={};this.lastText='';this.special='';this.specialTime=0;this.peak=0;this.expression=0;this.expressionUntil=0;this.setStage(0);}
 setStage(stage){this.stage=stage;this.value=clamp(Math.max(this.value,[8,30,55][stage]),0,[28,64,100][stage]);this.prev={controlled:0,combo:0,cycles:0,kneads:0,sweeps:0,landings:0,escapes:0};this.last={};this.pending=[];this.special='';this.specialTime=0;this.specialSeen=false;this.expression=0;this.expressionUntil=0;this.idle=0;this.enterAt=this.now+7;this.pleaAt=-100;this.impact=0;this.missAt=0;this.burstTimer=0;this.burstUsed=false;this.prev.rallyCleared=0;}
 emit(event,force=false){const cfg=this.data.events[event];if(!cfg)return;if(!force&&this.now-(this.last[event]??-100)<cfg.cooldown)return;const lines=this.data.lines.filter(x=>x.event===event&&x.stages.includes(this.stage)&&this.value>=x.minFever&&this.value<=x.maxFever&&x.text!==this.lastText);if(!lines.length)return;if(!force&&this.random()>[.28,.65,.86][this.stage]*cfg.probability)return;const l=lines[Math.floor(this.random()*lines.length)];this.last[event]=this.now;this.lastText=l.text;this.pending.push(l);this.pending=this.pending.slice(-3);if(l.expression!=null){this.expression=l.expression;this.expressionUntil=this.now+3.2;}}
 activateBurst(){if(this.stage!==2||this.burstUsed||this.value<70)return false;this.burstUsed=true;this.burstTimer=8;this.value=Math.max(0,this.value-30);this.expression=2;this.expressionUntil=this.now+8;return true;}
 update(dt,s){dt=clamp(dt,0,.1);this.now+=dt;this.burstTimer=Math.max(0,this.burstTimer-dt);
  const rallies=Math.max(0,(s.rallyCleared||0)-(this.prev.rallyCleared||0));if(rallies){this.value+=rallies*11;this.impact=1;this.emit('combo',true);} this.idle+=dt;this.impact=Math.max(0,this.impact-dt*3);let controlled=Math.max(0,(s.controlled||0)-this.prev.controlled),cycles=Math.max(0,(s.cycles||0)-this.prev.cycles),kneads=Math.max(0,(s.kneads||0)-this.prev.kneads),sweeps=Math.max(0,(s.sweeps||0)-this.prev.sweeps),landings=Math.max(0,(s.landings||0)-this.prev.landings),escapes=Math.max(0,(s.escapes||0)-this.prev.escapes);
  if(this.enterAt&&this.now>=this.enterAt){this.enterAt=0;this.emit('enter',true);}
  if(controlled){this.value+=Math.min(10,controlled*[.4,.7,.95][this.stage]);this.idle=0;this.impact=1;this.missAt=0;this.emit(controlled>=3?'multi':'contact');}
  if((s.combo||0)>this.prev.combo+2){this.value+=2;this.emit('combo');}
  if(cycles){this.value+=1.2*cycles;this.idle=0;this.emit('pressure');}
  if(kneads){this.value+=2.2;this.idle=0;this.emit('charge');this.impact=.8;}
  if(sweeps){this.value+=1.1;this.idle=0;this.emit('sweep');}
  if(landings&&!controlled){this.missAt=this.now+.45;this.missKills=s.controlled||0;}
  if(this.missAt&&this.now>=this.missAt){if((s.controlled||0)===this.missKills){this.value-=1.4;this.emit('miss');}this.missAt=0;}
  if(escapes>0){this.value-=Math.min(1.2,escapes*.15);this.emit('escape');}
  if((s.npcs||[]).some(n=>n.event==='plead'&&n.danger>=.65)&&this.now-(this.pleaAt??-100)>9){this.pleaAt=this.now;this.value+=this.stage*.7;this.emit('plead');}
  if(this.idle>7)this.value-=dt*.24;
  this.value=clamp(this.value,0,[28,64,100][this.stage]);this.peak=Math.max(this.peak,this.value);
  if(this.stage===2&&this.value>=85&&!this.specialSeen){this.specialSeen=true;this.special='laugh';this.specialTime=0;this.emit('laugh',true);}
  if(this.special){this.specialTime+=dt;if(this.special==='laugh'&&this.specialTime>=1.65){this.special='silence';this.emit('silence',true);}if(this.specialTime>=4.8){this.special='';this.expression=0;}}
  for(const k of Object.keys(this.prev))this.prev[k]=s[k]||0;
 }
 snapshot(){let expression=this.now<this.expressionUntil?this.expression:this.value>=82?2:this.value>=68?1:0;if(this.special==='laugh')expression=2;if(this.special==='silence')expression=3;return{value:Math.round(this.value),phase:this.burstTimer>0?'爆发':['从容','兴味渐浓',this.value>=80?'狂热':this.value>=65?'兴奋':'玩味'][this.stage],expression,expressionName:['轻笑','露齿笑','狂喜','突然冷静'][expression],special:this.special,quiet:this.special==='silence',impact:this.impact,tempo:(1+(this.stage===2?.12:.06)*this.value/100)*(this.burstTimer>0?1.28:1),burstRemaining:this.burstTimer,burstUsed:this.burstUsed,peak:Math.round(this.peak)};}
}
g.FeverController=FeverController;if(typeof module!=='undefined')module.exports=FeverController;
})(globalThis);

/* Project Cunjie v4.7. Offline decision controller (no network, no model API).
 * Perception -> utility target choice -> finite-step actuator -> observation.
 * All motion passes through LegacyStage.command; game physics remains authoritative.
 */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,defaultValue=0)=>Number.isFinite(v)?v:defaultValue;
const PACES={slow:.70,normal:1,fast:1.35};
const PERSONALITIES=['adaptive','calm','hunter','frenzy'];
class AutonomousXiaolong{
 constructor(opts={}){this.configure(opts);this.enabled=opts.enabled!==false;this.reset(0);}
 configure(o={}){this.personality=PERSONALITIES.includes(o.personality)?o.personality:(this.personality||'adaptive');this.pace=PACES[o.pace]?o.pace:(this.pace||'normal');this.smart=o.smart!==false;this.dialogue=o.dialogue!==false;}
 reset(stage=0){this.stage=stage;this.mode='observe';this.phase='raise';this.elapsed=0;this.actionElapsed=0;this.thinkElapsed=0;this.target=null;this.lastTarget=null;this.lastPosition=null;this.stall=0;this.score=0;this.pressure=0;this.lastControlled=0;this.lastRevealed=0;this.lastRally=0;this.lastFeedbackKey='';this.lastBurst=false;this.events=[];this.actions=0;this.sequence=0;this.lastDecision=null;this.lastSpoken=-99;this.stuckFrames=0;this.lastSnapshot=null;this.pauseSafe=true;this.lastProgressAt=0;this.staleTargets=0;this.lastTargetProgress=0;this.lastAimX=null;this.lastSocial={helps:0,rescues:0,signals:0};}
 setEnabled(value,stageApi){value=!!value;if(this.enabled===value)return;this.enabled=value;this.phase='raise';this.actionElapsed=0;this.target=null;this.mode=value?'observe':'manual';if(!value)this.safeRelease(stageApi);else this.reset(this.stage);}
 safeRelease(stageApi){try{stageApi?.command?.('release',{source:'autopilot'});}catch(e){} }
 emit(kind,detail='',priority=0){this.events.push({kind,detail,priority,time:this.elapsed});if(this.events.length>20)this.events.shift();}
 drainEvents(){return this.events.splice(0);}
 speedFactor(mood={}){const heat=finite(mood.value,0);const m=this.personality==='adaptive'?(heat>=72?'frenzy':heat>=36?'hunter':'calm'):this.personality;const urgency=this.elapsed>48?1.25:this.elapsed>37?1.12:1;return PACES[this.pace]*(m==='frenzy'?1.22:m==='calm'?.88:1)*urgency;}
 command(api,kind,extra={}){if(!api?.command)return false;this.actions++;return api.command(kind,{source:'autopilot',...extra})!==false;}
 selectTarget(s,previousX){const w=Math.max(1,finite(s?.world?.width,800));const pawX=clamp(finite(s?.world?.footX,w/2),0,w);const footW=finite(s?.visual?.footCollisionWidth,170);
  if(this.stage===2){const r=(s.rallies||[]).find(x=>!x.cleared);if(r){let x=finite(r.x,({desk:.19,rug:.62,exit:.83}[r.id]||.5)*w);if(r.id==='exit')x=clamp(x-footW*.10,0,w); /* start inside actual exit activation radius */return{x,reason:r.id,type:'rally',progress:r.progress||0};}}
  const npcs=(s.npcs||[]).filter(n=>n&&n.alive!==false&&Number.isFinite(n.x));const spots=npcs.map(n=>({x:clamp(n.x/1000*w,0,w),hidden:!!n.hidden,danger:finite(n.danger,0),socialState:n.socialState||'observe',id:n.id}));
  if(!spots.length){let pos=previousX==null?w*.5:(previousX<w*.48?w*.76:w*.24);return{x:pos,reason:'patrol',type:'patrol',progress:0};}
  if(!this.smart){const idx=(this.sequence*17+11)%spots.length;return{x:spots[idx].x,reason:'scan',type:'npc',progress:0};}
  // Bucket the crowd once instead of making an O(N²) pairwise sweep.
  const step=Math.max(26,footW*.42),cell=Math.max(24,step),buckets=new Map();
  for(const n of spots){let id=Math.floor(n.x/cell),bucket=buckets.get(id);if(!bucket){bucket=[];buckets.set(id,bucket);}bucket.push(n);}
  let best=null;
  for(const n of spots){let cluster=0,hidden=0,idx=Math.floor(n.x/cell);for(let b=idx-1;b<=idx+1;b++){for(const other of buckets.get(b)||[]){let d=Math.abs(n.x-other.x);if(d<step){let proximity=1-d/step;cluster+=proximity;if(other.hidden)hidden+=proximity;}}}
   let distance=Math.abs(n.x-pawX)/w;
   const interaction=n.socialState==='help'?3.3:n.socialState==='fallen'?1.0:n.socialState==='signal'?.55:0;
   let score=cluster*1.6+hidden*(this.stage===1?4.6:1.0)+interaction-distance*1.1-n.danger*.12;
   if(this.lastTarget&&Math.abs(this.lastTarget.x-n.x)<footW*.15)score-=.45;
   if(!best||score>best.score)best={x:n.x,score,reason:this.stage===1&&hidden>.65?'hidden':n.socialState==='help'?'rescue':'cluster',type:'npc',progress:hidden};}
  return best||{x:spots[0].x,reason:'npc',type:'npc',progress:0};
 }
 choose(s){const previous=this.target?.x??this.lastTarget?.x??null;this.target=this.selectTarget(s,previous);this.sequence++;this.lastTargetProgress=this.target.progress||0;this.lastProgressAt=this.elapsed;this.lastDecision={...this.target,stage:this.stage,at:this.elapsed};this.phase='raise';this.actionElapsed=0;this.thinkElapsed=0;
  if(this.target.reason==='hidden')this.emit('hidden-trail','发现藏匿痕迹',1);
  if(this.target.reason==='rescue')this.emit('npc-help','追踪救援队伍',1);
  else if(this.target.type==='rally')this.emit('objective',this.target.reason,1);
  return this.target;
 }
 observe(s){if(!s)return;const controlled=finite(s.controlled,0),revealed=finite(s.tactics?.revealed,0),rally=finite(s.rallyCleared,0);
  if(controlled>this.lastControlled&&this.elapsed>.2)this.emit('hit',String(controlled-this.lastControlled),2);
  if(revealed>this.lastRevealed)this.emit('reveal',String(revealed-this.lastRevealed),3);
  if(rally>this.lastRally)this.emit('rally-clear',String(rally),3);
  if(s.burstUsed&&!this.lastBurst)this.emit('burst','',4);
  const f=s.feedback;if(f&&f.kind&&f.kind!=='ready'){const key=`${f.time}:${f.kind}`;if(key!==this.lastFeedbackKey){this.lastFeedbackKey=key;
   if(f.kind==='landing-miss'||f.kind==='cover-empty'||f.kind==='sweep-empty')this.emit('miss',f.kind,0);
   if(f.kind==='rally-sweep'||f.kind==='rally-knead')this.emit('objective-hit',f.kind,1);
  }}
  if(controlled>this.lastControlled||revealed>this.lastRevealed||rally>this.lastRally)this.lastProgressAt=this.elapsed;
  const social=s.social||{};for(const [key,event] of [['helps','npc-help'],['rescues','npc-rescue'],['signals','npc-signal']]){
   const value=finite(social[key],0),previous=this.lastSocial[key]||0;
   if(value>previous&&this.elapsed>.2)this.emit(event,String(value-previous),event==='npc-rescue'?3:1);
   this.lastSocial[key]=value;
  }
  this.lastControlled=controlled;this.lastRevealed=revealed;this.lastRally=rally;this.lastBurst=!!s.burstUsed;this.lastSnapshot=s;
 }
 tick(dt,s,api,mood={}){if(!this.enabled||!api?.command||!s?.world)return{active:false};
  dt=clamp(finite(dt,0),0,.12);if(!dt)return this.status();this.elapsed+=dt;this.actionElapsed+=dt;this.thinkElapsed+=dt;this.observe(s);
  const w=Math.max(1,finite(s.world.width,800));const footW=finite(s.visual?.footCollisionWidth,180);const x=finite(s.world.footX,w*.5);
  const speed=this.speedFactor(mood),delay=1/Math.max(.4,speed);
  const footState=finite(s.world.footState,0),isDown=footState===3;
  if(!this.target)this.choose(s);
  // Stage III takes priority: finish actual spatial objectives, not the largest NPC cluster.
  if(this.stage===2&&this.target.type==='rally'){
   const current=(s.rallies||[]).find(r=>r.id===this.target.reason);
   if(!current||current.cleared){this.choose(s);return this.status();}
   // More progress means a real action has landed; preserve objective focus.
   if((current.progress||0)>this.lastTargetProgress+.005){this.lastTargetProgress=current.progress;this.lastProgressAt=this.elapsed;}
  }
  if(this.phase==='raise'){
   this.command(api,'release');this.command(api,'up');this.mode='survey';
   if(this.actionElapsed>clamp(.24*delay,.15,.55)){this.phase='aim';this.actionElapsed=0;}
  }else if(this.phase==='aim'){
   this.mode='approach';this.command(api,'move',{x:this.target.x});this.command(api,'up');
   const near=Math.abs(x-this.target.x)<Math.max(16,footW*.22);
   if(near||this.actionElapsed>clamp(.85*delay,.48,1.7)){this.phase='down';this.actionElapsed=0;}
  }else if(this.phase==='down'){
   this.mode='descend';this.command(api,'move',{x:this.target.x});this.command(api,'down');
   if(isDown||this.actionElapsed>clamp(.72*delay,.45,1.5)){this.phase='press';this.actionElapsed=0;}
  }else if(this.phase==='press'){
   this.mode='press';this.command(api,'press');
   const obj=this.target.reason;
   const hold=this.stage===2&&obj==='desk'?3.35:this.stage===2&&obj==='rug'?1.05:this.stage===1?.83:.62;
   if(this.actionElapsed>hold*delay){if(this.stage===2&&obj==='exit'){this.phase='sweep';this.actionElapsed=0;}
    else if(this.stage===1&&(s.hiddenCount||0)>0&&this.sequence%3===0){this.phase='sweep';this.actionElapsed=0;}
    else{this.phase='recover';this.actionElapsed=0;}}
  }else if(this.phase==='sweep'){
   this.mode='sweep';this.command(api,'press');
   const reach=Math.max(42,footW*.40);
   const right=clamp(this.target.x+reach,0,w+32);
   const left=clamp(this.target.x-reach,0,w);
   const dest=this.actionElapsed<.75*delay?right:left;
   this.command(api,'move',{x:dest});
   if(this.actionElapsed>1.30*delay){this.phase='recover';this.actionElapsed=0;}
  }else if(this.phase==='recover'){
   this.mode='recover';this.command(api,'release');this.command(api,'up');
   if(this.actionElapsed>clamp(.48*delay,.32,.75)){this.lastTarget=this.target;this.target=null;this.phase='raise';this.actionElapsed=0;}
  }
  // Replan after a sustained miss without issuing impossible teleports.
  // For objective holds the real engine is still authoritative.
  if(this.target?.type==='npc'&&this.elapsed-this.lastProgressAt>9){this.staleTargets++;this.target=null;this.phase='raise';this.actionElapsed=0;this.lastProgressAt=this.elapsed;}
  if(this.actionElapsed>5.2&&this.phase!=='press'){this.target=null;this.phase='raise';this.actionElapsed=0;}
  return this.status();
 }
 status(){return{active:this.enabled,mode:this.enabled?this.mode:'manual',phase:this.phase,stage:this.stage,targetX:this.target?.x??null,targetReason:this.target?.reason||null,personality:this.personality,pace:this.pace,smart:this.smart,actions:this.actions,elapsed:Number(this.elapsed.toFixed(2)),sequence:this.sequence,staleTargets:this.staleTargets,decision:this.lastDecision};}
}
root.AutonomousXiaolong=AutonomousXiaolong;
if(typeof module!=='undefined'&&module.exports)module.exports=AutonomousXiaolong;
})(globalThis);

(function(g){'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=(t,name)=>name==='linear'?t:name==='easeOutQuad'?t*(2-t):t*t*(3-2*t);
const lerp=(a,b,t)=>a+(b-a)*t;
function validate(script,resources){
 if(!script||script.schemaVersion!==1||typeof script.id!=='string'||!Array.isArray(script.shots)||!script.shots.length)throw Error('invalid cinematic script');
 if(!Number.isInteger(script.durationMs)||script.durationMs<100||script.durationMs>60000)throw Error('invalid cinematic duration');
 let prior=0;
 for(const shot of script.shots){
  if(!Number.isInteger(shot.startMs)||!Number.isInteger(shot.endMs)||shot.startMs<prior||shot.endMs<=shot.startMs||shot.endMs>script.durationMs)throw Error('cinematic shot interval');
  prior=shot.endMs;
  if(!Array.isArray(shot.layers)||!shot.layers.length)throw Error('cinematic shot without layers');
  for(const layer of shot.layers){
   if(typeof layer.asset!=='string'||typeof resources[layer.asset]!=='string')throw Error('missing cinematic resource '+layer.asset);
   if(!Number.isFinite(layer.z)||!Array.isArray(layer.from)||layer.from.length!==4||!layer.from.every(Number.isFinite))throw Error('invalid cinematic layer transform');
   if(layer.to&&(!Array.isArray(layer.to)||layer.to.length!==4||!layer.to.every(Number.isFinite)))throw Error('invalid cinematic layer end');
  }
 }
 if(script.shots[0].startMs!==0||prior!==script.durationMs)throw Error('gapped cinematic timeline');
 for(const event of [...(script.captions||[]),...(script.sounds||[])])if(!Number.isInteger(event.atMs)||event.atMs<0||event.atMs>=script.durationMs)throw Error('invalid cinematic event');
 return true;
}
class CinematicScriptPlayer{
 constructor(script,resources){validate(script,resources);this.script=script;}
 evaluate(elapsedMs,reducedMotion=false){
  const s=this.script,t=clamp(Number(elapsedMs)||0,0,s.durationMs),i=Math.min(s.shots.length-1,s.shots.findIndex(x=>t<x.endMs)>=0?s.shots.findIndex(x=>t<x.endMs):s.shots.length-1);
  const shot=s.shots[i],progress=clamp((t-shot.startMs)/(shot.endMs-shot.startMs)),e=ease(progress,shot.easing||'easeInOutCubic');
  const project=(sh,k)=>sh.layers.map(layer=>({id:layer.id,asset:layer.asset,z:layer.z,rect:layer.from.map((v,j)=>lerp(v,(layer.to||layer.from)[j],k)),alpha:lerp(layer.alphaFrom??1,layer.alphaTo??1,k),angle:lerp(layer.rotateFrom??0,layer.rotateTo??0,k),peel:layer.peelFrom===undefined?null:lerp(layer.peelFrom,layer.peelTo??layer.peelFrom,k),gather:layer.gatherFrom===undefined?0:lerp(layer.gatherFrom,layer.gatherTo??layer.gatherFrom,k)})).sort((a,b)=>a.z-b.z);
  const layers=project(shot,e);
  const caption=(s.captions||[]).find(x=>t>=x.atMs&&t<x.atMs+x.durationMs)||null;const captionOpacity=caption?Math.min(1,(t-caption.atMs)/170,(caption.atMs+caption.durationMs-t)/200):0;
  const fadeMs=reducedMotion?240:380;
  const transition=i>0?clamp((t-shot.startMs)/(reducedMotion?Math.min(160,shot.transitionMs??240):shot.transitionMs??380)):1;
  const previousLayers=transition<1?project(s.shots[i-1],1):null;
  return {transition,previousLayers,id:s.id,timeMs:t,durationMs:s.durationMs,progress:t/s.durationMs,shotId:shot.id,shotIndex:i,shotProgress:progress,layers,caption,captionOpacity,fadeIn:i>0?clamp((t-shot.startMs)/fadeMs):1,fadeOut: i===s.shots.length-1?clamp((s.durationMs-t)/fadeMs):1};
 }
}
g.CinematicScriptPlayer=CinematicScriptPlayer;
if(typeof module!=='undefined')module.exports={CinematicScriptPlayer,validate};
})(globalThis);

(function(g){'use strict';
class CinematicAssetLoader{
 constructor(resources,makeImage){this.resources=resources||{};this.makeImage=makeImage||(()=>new Image());this.cache=new Map();}
 get(id){return this.cache.get(id)||null;}
 async preload(ids,timeoutMs=7000){
  const unique=[...new Set(ids)];
  await Promise.all(unique.map(id=>{
   if(this.cache.has(id))return Promise.resolve();
   const src=this.resources[id];if(!src)return Promise.reject(Error('CG_RESOURCE_MISSING: '+id));
   return new Promise((resolve,reject)=>{
    const img=this.makeImage();let settled=false;
    const complete=(err)=>{if(settled)return;settled=true;clearTimeout(timer);img.onload=null;img.onerror=null;if(err)reject(err);else{this.cache.set(id,img);resolve();}};
    const timer=setTimeout(()=>complete(Error('CG_RESOURCE_TIMEOUT: '+id)),timeoutMs);
    img.onload=()=>{if(img.decode){img.decode().then(()=>complete(),()=>complete());}else complete();};
    img.onerror=()=>complete(Error('CG_RESOURCE_DECODE: '+id));
    img.src=src;
   });
  }));return true;
 }
 release(){this.cache.clear();}
}
g.CinematicAssetLoader=CinematicAssetLoader;
if(typeof module!=='undefined')module.exports=CinematicAssetLoader;
})(globalThis);

(function(g){'use strict';
class CinematicAudioController{
 constructor(assets,makeAudio){this.assets=assets||{};this.makeAudio=makeAudio||((src)=>new Audio(src));this.active=[];this.played=new Set();this.muted=false;this.volume=.45;}
 configure(prefs={}){this.muted=prefs.sound===false;this.volume=Math.max(0,Math.min(1,prefs.volume??.45));}
 tick(ms,events=[]){for(let i=0;i<events.length;i++){const e=events[i];if(e.atMs>ms||this.played.has(i))continue;this.played.add(i);if(this.muted||!this.assets[e.asset])continue;try{let a=this.makeAudio(this.assets[e.asset]);a.volume=this.volume*(e.gain??.5);this.active.push(a);a.play?.()?.catch?.(()=>{});}catch{}}}
 pause(){for(const a of this.active)try{a.pause();}catch{}}
 resume(){for(const a of this.active)try{if(!a.ended)a.play?.()?.catch?.(()=>{});}catch{}}
 stop(){for(const a of this.active)try{a.pause();a.currentTime=0;}catch{}this.active=[];this.played.clear();}
}
g.CinematicAudioController=CinematicAudioController;
if(typeof module!=='undefined')module.exports=CinematicAudioController;
})(globalThis);

(function(g){'use strict';
class CinematicManager{
 constructor({scripts,loader,audio,now}={}){this.scripts=scripts||{};this.loader=loader;this.audio=audio;this.now=now||(()=>Date.now());this.generation=0;this.abort();}
 abort(){this.generation++;this.audio?.stop();this.loader?.release();this.state='idle';this.elapsedMs=0;this.script=null;this.player=null;this.stageIndex=-1;this.reason='';this.pausedFrom='';this.context=null;}
 begin(index,context={}){
  this.abort();const token=this.generation;this.stageIndex=index;this.context=Object.freeze({...context});
  const id=['cg01_shoe_to_sock','cg02_sock_to_paw'][index];
  const source=this.scripts[id]||null;
  // Never mutate the shared schema script: the chosen shoe is locked once per stage.
  if(index===0&&source&&this.context.shoeVariant==='aj6'){
   const root='cg01_shoe_to_sock/';
   this.script={...source,shots:source.shots.map(shot=>({...shot,layers:shot.layers.map(layer=>{
    const name=layer.asset.slice(root.length);
    return layer.asset.startsWith(root)&&['sneaker_front.webp','sneaker_lift.webp','sneaker_sole.webp'].includes(name)
     ? {...layer,asset:root+'aj6_'+name} : layer;
   })}))};
  }else this.script=source;
  if(!this.script){this.fail('missing script: '+id);return Promise.resolve(false);}
  this.state='preparing';const Player=g.CinematicScriptPlayer||(typeof require==='function'?require('./CinematicScriptPlayer.js').CinematicScriptPlayer:null);try{this.player=new Player(this.script,this.loader.resources);}catch(e){this.fail(e.message);return Promise.resolve(false);}
  const ids=this.script.shots.flatMap(x=>x.layers.map(y=>y.asset));
  return this.loader.preload(ids).then(()=>{if(token!==this.generation)return false;if(this.state==='paused'){this.pausedFrom='playing';}else this.state='playing';return true;}).catch(e=>{if(token!==this.generation)return false;this.fail(e.message);return false;});
 }
 fail(reason){this.reason=reason;if(this.state==='paused')this.pausedFrom='fallback';else this.state='fallback';this.elapsedMs=0;this.audio?.stop();}
 tick(dt){if(!['playing','fallback'].includes(this.state))return false;this.elapsedMs+=Math.max(0,Math.min(.1,dt))*1000;
  if(this.state==='fallback'){if(this.elapsedMs>=8000){this.state='finished';return true;}return false;}
  this.audio?.tick(this.elapsedMs,this.script.sounds||[]);
  if(this.elapsedMs>=this.script.durationMs){this.elapsedMs=this.script.durationMs;this.state='finished';this.audio?.stop();return true;}
  return false;
 }
 frame(reducedMotion){return this.player?.evaluate(this.elapsedMs,reducedMotion)||null;}
 pause(){if(this.state==='playing'||this.state==='fallback'||this.state==='preparing'){this.pausedFrom=this.state;this.state='paused';this.audio?.pause();}}
 resume(){if(this.state==='paused'){this.state=this.pausedFrom;this.pausedFrom='';this.audio?.resume();}}
 getSnapshot(){return{state:this.state,stageIndex:this.stageIndex,elapsedMs:this.elapsedMs,durationMs:this.state==='fallback'?8000:this.script?.durationMs||8000,reason:this.reason,caption:this.state==='playing'?this.frame()?.caption:null};}
}
g.CinematicManager=CinematicManager;
if(typeof module!=='undefined')module.exports=CinematicManager;
})(globalThis);

(function(g){'use strict';
class CinematicUI{
 constructor(root,caption,progress,label,skip){this.root=root;this.caption=caption;this.progress=progress;this.label=label;this.skip=skip;}
 show(){this.root.classList.add('in-cinematic');}
 hide(){this.root.classList.remove('in-cinematic');this.caption.textContent='';this.progress.style.width='0%';}
 update(snapshot,frame,settings){this.progress.style.width=Math.min(100,Math.max(0,100*(snapshot.elapsedMs/snapshot.durationMs)))+'%';this.label.textContent=snapshot.stageIndex===0?'CG-01 · 脱去外壳':snapshot.stageIndex===1?'CG-02 · 本体':'';
  this.caption.textContent=settings.cinematicCaptions===false?'':frame?.caption?((frame.caption.speaker?frame.caption.speaker+' · ':'')+frame.caption.text):snapshot.state==='preparing'?'准备镜头资源…':snapshot.state==='fallback'?'使用旧版过场，画面资源未能载入':'';this.caption.style.opacity=frame?.caption?String(frame.captionOpacity??1):'1';
 }
}
g.CinematicUI=CinematicUI;
if(typeof module!=='undefined')module.exports=CinematicUI;
})(globalThis);

(function(g){
class TinyBubbleRenderer{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');}
 clear(){this.c.clearRect(0,0,this.canvas.width,this.canvas.height);}
 render(bubbles,rect,opacity=.96,options={}){
  const el=this.canvas;if(!rect||rect.width<=0||rect.height<=0){this.clear();return;}
  const d=Math.min(g.devicePixelRatio||1,2);el.style.left=rect.left+'px';el.style.top=rect.top+'px';el.style.width=rect.width+'px';el.style.height=rect.height+'px';
  const w=Math.round(rect.width*d),h=Math.round(rect.height*d);if(el.width!==w||el.height!==h){el.width=w;el.height=h;}
  const c=this.c;c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,rect.width,rect.height);
  const clean=g.cunjieV59CleanNumbers!==false;
  const fs=clean?Math.max(12,Math.min(14,rect.height/31)):Math.max(9,Math.min(11.5,rect.height/39));
  const lineHeight=fs*1.35,pad=clean?7:5,maxW=clean?Math.min(196,Math.max(110,rect.width*.29)):Math.min(154,Math.max(70,rect.width*.22));
  const safeTop=clean?Math.min(82,Math.max(34,rect.height*.15)):7;
  const safeBottom=clean?Math.min(76,Math.max(36,rect.height*.12)):8;
  const keep=clean?(rect.width<680?2:3):3,placed=[],seen=new Set();
  const ordered=(bubbles||[]).slice().sort((a,b)=>(b.priority||0)-(a.priority||0));
  c.font=`700 ${fs}px system-ui,'Microsoft YaHei',sans-serif`;c.textAlign='center';c.textBaseline='middle';
  for(const b of ordered){
   if(placed.length>=keep)break;
   const full=String(b.text||'');if(!full||(clean&&seen.has(full)))continue;seen.add(full);
   const text=Array.from(full).slice(0,clean?36:26).join('');
   let rows=[],current='';for(const ch of Array.from(text)){
    if(current&&c.measureText(current+ch).width>maxW-pad*2){rows.push(current);current=ch;}
    else current+=ch;
   }if(current)rows.push(current);
   if(rows.length>2){rows=rows.slice(0,2);rows[1]=Array.from(rows[1]).slice(0,-1).join('')+'…';}
   if(!rows.length)continue;
   const bw=Math.max(40,Math.min(maxW,Math.max(...rows.map(s=>c.measureText(s).width))+pad*2+2)),bh=rows.length*lineHeight+pad*2;
   const x=b.x/1000*rect.width,y=b.y/600*rect.height;
   const minX=6,maxX=Math.max(minX,rect.width-bw-6);
   let left=Math.max(minX,Math.min(maxX,x-bw/2));
   let top=Math.max(safeTop,Math.min(Math.max(safeTop,rect.height-safeBottom-bh),y-bh-11));
   const contact=options.hotspot;
   const collides=(r,q,gap=6)=>r.x<q.x+q.w+gap&&r.x+r.w+gap>q.x&&r.y<q.y+q.h+gap&&r.y+r.h+gap>q.y;
   for(let tries=0;tries<9;tries++){
    const candidate={x:left,y:top,w:bw,h:bh};
    const clash=placed.some(q=>collides(candidate,q,5));
    const contactClash=clean&&contact&&collides(candidate,{x:contact.x-64,y:contact.y-60,w:128,h:85},8);
    if(!clash&&!contactClash)break;
    if(top-bh-9>=safeTop)top-=bh+9;
    else if(left+bw+18<rect.width-8)left+=bw+12;
    else if(left-bw-18>=8)left-=bw+12;
    else {top=Math.min(rect.height-safeBottom-bh,top+bh+8);}
   }
   const candidate={x:left,y:top,w:bw,h:bh};
   if(clean&&(placed.some(q=>collides(candidate,q,5)) || (contact&&collides(candidate,{x:contact.x-62,y:contact.y-58,w:124,h:82},3))))continue;
   placed.push(candidate);
   c.save();c.globalAlpha=opacity;c.shadowColor='rgba(0,0,0,.3)';c.shadowBlur=6;c.shadowOffsetY=2;
   c.fillStyle='#f7f7f4';c.strokeStyle='#20323b';c.lineWidth=1.35;c.beginPath();c.roundRect(left,top,bw,bh,6);c.fill();c.stroke();c.shadowBlur=0;c.shadowOffsetY=0;
   const tip=Math.max(left+9,Math.min(left+bw-9,x));c.beginPath();c.moveTo(tip-4,top+bh-.7);c.lineTo(x,Math.min(y-2,top+bh+9));c.lineTo(tip+4,top+bh-.7);c.closePath();c.fill();c.stroke();
   c.fillStyle='#18242b';for(let i=0;i<rows.length;i++)c.fillText(rows[i],left+bw/2,top+pad+lineHeight*(i+.5));c.restore();
  }
 }
}
g.TinyBubbleRenderer=TinyBubbleRenderer;
})(globalThis);

/* The actual v3.3 engine runs inside a separate iframe; this host only adapts lifecycle. */
(function(g){
class LegacyStage{
 constructor(mount,source,index,roster,onReady){this.mount=mount;this.index=index;this.frame=document.createElement('iframe');this.frame.title=index===0?'卧室地板 · 篮球鞋':index===1?'地毯区域 · 袜脚':'床边终局 · 裸爪';this.frame.allow='autoplay; fullscreen';this.frame.srcdoc=source;this.mount.replaceChildren(this.frame);this.bridge=null;this.disposed=false;this.poll=setInterval(()=>{if(this.disposed)return;try{let b=this.frame.contentWindow.realmBridge;if(b){clearInterval(this.poll);this.bridge=b;b.setup(index,roster);onReady();}}catch(e){}},40);}
 snapshot(){return this.bridge?this.bridge.snapshot():{controlled:0,escapes:0,score:0,combo:0,stability:1,efficiency:1};}
 pause(v){this.bridge?.pause(v)}
 action(a){return this.bridge?.action(a)}
 command(kind,props){return this.bridge?.command(kind,props)}
 release(){this.bridge?.command?.('release',{source:'host'})}
 setMood(m){this.bridge?.mood?.(m)}
 timeScale(v){this.bridge?.timeScale?.(v)}
 configure(p){this.bridge?.configure(p)}
 autonomy(v){this.bridge?.autonomy?.(v)}
 shoeMotion(v){return this.bridge?.shoeMotion?.(v)}
 survivors(){return this.bridge?.survivors()||[];}
 dispose(){this.disposed=true;clearInterval(this.poll);this.bridge?.pause(true);this.mount.replaceChildren();this.bridge=null;this.frame=null;}
}
g.LegacyStage=LegacyStage;
})(globalThis);
