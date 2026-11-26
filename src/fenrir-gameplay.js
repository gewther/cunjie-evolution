/* Project Cunjie v6.1 — Fenrir Blue-Hour Hunt Mode ("蓝调雨夜猎场").
 * Strictly activates ONLY when fenrirCity === true; standard Free Mode and other custom PNGs are untouched.
 */
if(typeof fenrirCity!=='undefined'&&fenrirCity){
 (function installFenrirHunt(){
  const WAVES=[
   {id:1,name:'霓虹初雨',dur:35,rain:1.0,runners:false,evac:false,sub:'悬停威压聚拢 · 重踏收割'},
   {id:2,name:'路口截击',dur:40,rain:1.35,runners:true,evac:false,sub:'半路截杀红标领跑者'},
   {id:3,name:'暴雨收网',dur:45,rain:1.85,runners:true,evac:true,sub:'端掉撤离点 · 核心过载清场'}
  ];
  const LINES={
   enter:[
    '雨刚下透，整条大道倒挺热闹——都别走啊，今晚的玩具箱归我管了。',
    '哟，这么晚还满街乱窜？正好拿你们试试我刚校准完的金爪。',
    '把街口全封上吧。谁先跑不动，我就先拿谁开荤。',
    '呵，看着密密麻麻的，其实也就够我踩两分钟热身吧。'
   ],
   tease:[
    '哈哈，怎么全挤一块发抖了？我爪子还没落下去呢，这么不禁吓？',
    '别急呀，我就悬这儿挑一挑——哪个哭得最惨，待会儿重点照顾。',
    '抬头看看，阴影都把你们吞完了，还指望往哪儿钻呢？',
    '这就腿软啦？真没劲，我还没开始认真玩呢。',
    '喂，中间那个抖成筛子的，再缩也躲不进柏油缝里啊。',
    '猜猜我下一秒是直接踩下去，还是接着悬着看你们互相推？',
    '呵，连我脚风都扛不住，刚才不是跑得挺起劲的吗？'
   ],
   intercept:[
    '差两步就冲出路口了呢——哈哈，偏不让你过去！',
    '跑最前头那个装什么英雄啊，我专门盯着你截的！',
    '想从我金爪边溜出去？太嫩了吧你！',
    '啧，跑得挺快嘛，可惜再快也快不过我落脚。',
    '刚谁在前面带队喊撤退的？闭嘴躺平吧你！',
    '半路截杀最带劲了——下一个想赌命冲刺的是谁？'
   ],
   multi:[
    '哇哦！一脚下去整块路面都清净了，声音还挺脆！',
    '就这？一堆人凑一起都不够我一脚掌塞牙缝的。',
    '哈哈，听见没？积水和骨头一块响，比雨声好听多了。',
    '连成一排给我踩，你们倒挺懂事的嘛。',
    '爽快！这一片柏油总算彻底安静下来了。',
    '全按进水洼里咯——连溅起来的水花都比你们有气势。'
   ],
   grind:[
    '再往下按半寸——看看这湿路能不能把你们彻底抹平。',
    '别抠我金爪缝啦，挠痒痒都不够劲呢。',
    '滋啦滋啦的……这碾过湿沥青的手感，简直会上瘾啊。',
    '想从脚底板爬出去？那我偏要慢慢拖着碾过去！',
    '叫大声点嘛，雨这么大，小声点我可听不清。',
    '呵，压实了之后再蹭两下，这下才算彻底老实。'
   ],
   evac:[
    '哦？居然凑一块搞撤离点？太好了，省得我一个个满街抓！',
    '全往那块红圈里挤呀——等人聚齐了，我一脚连锅端！',
    '整处撤离点一口气清空，哈哈，还有哪儿敢搭窝？'
   ],
   escape:[
    '啧，居然让几只老鼠顺着街角溜了……真碍眼。',
    '跑得倒挺滑溜，下回直接封死路口一个不留！',
    '切，漏网之鱼最扫兴了，都给我拦住！',
    '算你命大躲过一脚——别让我再在街上撞见你。'
   ],
   wave2:[
    '热身结束。听说有几个跑得快的想带队冲街口？哈哈，我专截领跑的！'
   ],
   wave3:[
    '暴雨来了，全街开始乱撞咯——撤离点亮起来了？正好给我当靶心！'
   ],
   overdrive:[
    '反应核拉满啦——电弧全开，整条街谁也别想活着拐出路口！',
    '哈哈哈哈！核心过载！现在求饶也晚啦！',
    '青金出力 100%！准备好看整条雨夜大道彻底安静吧！',
    '玩具时间升级——这七秒里，你们连喘气的空隙都没有！'
   ],
   finishS:[
    '整条街静得只剩雨声和我的核心嗡鸣……哈哈，勉强够我玩这一趟！'
   ],
   finishA:[
    '收割得还算痛快，就是漏掉那几只扫了点兴——下回一个都别想溜。'
   ],
   finishB:[
    '切，放跑太多吵闹的家伙了，完全没玩过瘾。再来一局，我要封死整条街！'
   ]
  };
  const TINY_LINES={
   hover:['快躲！白爪悬在头顶！','他故意不落脚！！','救命——阴影盖过来了！','别发愣！往两边散！'],
   runner:['跟着冲出路口！','快啊！就差几步了！','别回头看他！'],
   panic:['领跑的被踩扁了！！','路震得站不稳了！','退不回去了——救命！','金爪拖过来了！！'],
   overdrive:['核心发亮了！快逃！！','水洼带电！散开！！','谁能拦住他啊！！'],
   evac:['快往撤离区跑！','别挤！往红圈汇合！']
  };
  const CTX_LABELS={
   enter:'入街',tease:'悬停威压',intercept:'路口截击',multi:'清场收割',
   grind:'湿路拖碾',evac:'撤离点',escape:'漏网',wave2:'第 2 波',wave3:'第 3 波',
   overdrive:'核心过载',finishS:'S 级评价',finishA:'A 级评价',finishB:'B 级评价'
  };

  const st={
   mode:'hunt', // 'hunt' | 'endless'
   wave:0,
   waveClock:0,
   totalClock:0,
   finished:false,
   thrill:18,
   overdrive:false,
   overdriveLeft:0,
   rainMul:1.0,
   grinding:false,
   dragDir:1,
   kills:0,
   escapes:0,
   runnerEscapes:0,
   intercepts:0,
   evacClears:0,
   maxSingleStomp:0,
   hoverTime:0,
   lockCount:0,
   grindClock:0,
   lastPawX:0,
   runnerTimer:2.5,
   evacZone:null,
   evacCooldown:5,
   tinyPanicOn:true,
   tinyBubbles:[],
   tinyCooldown:1.4,
   popups:[],
   speakLeft:0,
   speakPriority:0,
   lastSpeakAt:-99,
   entered:false,
   lineCursor:{},
   seenBugs:new WeakSet(),
   trackedAlive:new Map(),
   prevKillsSnapshot:0,
   audioClock:0,
   onLanding:null
  };
  window.xlFenrirState=st;
  window.__xlFenrirOwnsHud=true;

  function pick(cat){
   const arr=LINES[cat]||LINES.enter;
   const idx=(st.lineCursor[cat]||0)%arr.length;
   st.lineCursor[cat]=idx+1;
   return arr[idx];
  }
  function addPopup(text,x,y,color='#5af2ff'){
   const px=clamp(x,44,w-44);
   let py=clamp(y,46,floor_y-16);
   for(let pass=0;pass<4;pass++){
    if(!st.popups.some(p=>Math.abs(p.x-px)<76&&Math.abs(p.y-py)<14))break;
    py=Math.max(36,py-15);
   }
   st.popups.push({text,x:px,y:py,age:0,max:1.25,color});
   if(st.popups.length>10)st.popups.shift();
  }
  function addThrill(amount){
   if(st.overdrive)return;
   st.thrill=clamp(st.thrill+amount,0,100);
  }
  function playChime(freq1,freq2,dur,amp,type='triangle'){
   if(typeof audio_ctx==='undefined'||!audio_ctx||audio_ctx.state!=='running'||typeof main_volume_node==='undefined')return;
   try{
    const at=audio_ctx.currentTime,osc=audio_ctx.createOscillator(),env=audio_ctx.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(freq1,at);osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq2),at+dur);
    env.gain.setValueAtTime(.00001,at);env.gain.exponentialRampToValueAtTime(Math.max(.00002,amp),at+.01);env.gain.exponentialRampToValueAtTime(.00001,at+dur);
    osc.connect(env);env.connect(main_volume_node);osc.start(at);osc.stop(at+dur+.02);
    osc.onended=()=>{osc.disconnect();env.disconnect();};
   }catch{}
  }
  function playGrindScrape(){
   if(st.audioClock>0||typeof audio_ctx==='undefined'||!audio_ctx||audio_ctx.state!=='running'||typeof main_volume_node==='undefined')return;
   const buf=typeof window.xlFreeEnsureNoise==='function'?window.xlFreeEnsureNoise():null;
   if(!buf)return;
   st.audioClock=.13;
   try{
    const at=audio_ctx.currentTime,ns=audio_ctx.createBufferSource(),bp=audio_ctx.createBiquadFilter(),gn=audio_ctx.createGain();
    ns.buffer=buf;bp.type='bandpass';bp.frequency.setValueAtTime(780+Math.random()*380,at);bp.Q.setValueAtTime(2.6,at);
    gn.gain.setValueAtTime(.00001,at);gn.gain.exponentialRampToValueAtTime(.055,at+.02);gn.gain.exponentialRampToValueAtTime(.00001,at+.14);
    ns.connect(bp);bp.connect(gn);gn.connect(main_volume_node);ns.start(at);ns.stop(at+.16);
    ns.onended=()=>{ns.disconnect();bp.disconnect();gn.disconnect();};
   }catch{}
  }

  // Inject crisp cyan-gold Fenrir tactical styling & controls
  const shell=document.getElementById('xl-shell');
  if(shell&&shell.classList)shell.classList.add('fenrir-mode');
  if(document.head&&document.createElement){
   const style=document.createElement('style');
   style.textContent=`
#xl-shell.fenrir-mode{--accent:#38e4ff;--gold:#ffd166;}
#xl-shell.fenrir-mode #xl-hud{background:linear-gradient(135deg,#07141fe8,#0b1d2de0);border:1px solid #38e4ff66;box-shadow:0 6px 24px #0009;min-width:170px;max-width:44%;padding:7px 10px;border-radius:10px;}
#xl-shell.fenrir-mode #xl-stage-name{color:#6af3ff;font-size:12.5px;letter-spacing:.03em;}
#xl-shell.fenrir-mode #xl-bubble{right:12px;left:auto;top:max(52px,calc(env(safe-area-inset-top) + 46px));width:min(320px,44%);max-width:340px;background:linear-gradient(135deg,#081724f5,#102336f0);border:1px solid #38e4ff88;box-shadow:0 8px 26px #000a;padding:8px 12px;border-radius:11px;}
#xl-shell.fenrir-mode #xl-bubble:after{display:none;}
#xl-shell.fenrir-mode #xl-bubble strong{color:#6df4ff;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;letter-spacing:.05em;}
#xl-shell.fenrir-mode #xl-bubble-line{font-size:clamp(11px,1.5vw,15px);line-height:1.42;}
#xl-shell.fenrir-mode #xl-bubble.overdrive-voice{border-color:#ffd166cc;box-shadow:0 0 22px #38e4ff55;}
@media (max-height:460px){
 #xl-shell.fenrir-mode #xl-hud{min-width:144px;max-width:42%;padding:5px 8px;font-size:10px;line-height:1.25;}
 #xl-shell.fenrir-mode #xl-stage-name{font-size:11px;}
 #xl-shell.fenrir-mode #xl-bubble{top:48px;right:10px;width:min(275px,42%);padding:6px 10px;}
 #xl-shell.fenrir-mode #xl-bubble-line{font-size:11.5px;line-height:1.34;}
}
#fn-portrait-top,#fn-portrait-bot{display:none;}
#xl-shell.fn-portrait{justify-content:flex-start!important;gap:8px;padding:max(50px,calc(env(safe-area-inset-top) + 46px)) max(6px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left))!important;}
#xl-shell.fn-portrait #fn-portrait-top,#xl-shell.fn-portrait #fn-portrait-bot{display:flex;width:min(100%,540px);flex-direction:column;gap:8px;z-index:8;}
#xl-shell.fn-portrait #fn-portrait-top{flex:0 0 auto;}
#xl-shell.fn-portrait #fn-portrait-bot{flex:1 1 auto;min-height:0;overflow:auto;}
#xl-shell.fn-portrait #xl-hud{position:static!important;width:100%!important;max-width:none!important;min-width:0!important;display:grid;grid-template-columns:1fr auto;gap:3px 10px;align-items:center;padding:7px 11px;font-size:11px;}
#xl-shell.fn-portrait #xl-stage-name{grid-column:1;}
#xl-shell.fn-portrait #xl-hud>span:nth-child(2){grid-column:2;text-align:right;font-size:10.5px;color:#9edff0;}
#xl-shell.fn-portrait #xl-count,#xl-shell.fn-portrait #xl-goal,#xl-shell.fn-portrait #fn-thrill-wrap{grid-column:1 / -1;}
#xl-shell.fn-portrait #xl-bubble{position:static!important;width:100%!important;max-width:none!important;right:auto!important;top:auto!important;left:auto!important;padding:9px 12px;order:2;box-shadow:0 4px 16px #0007;}
#xl-shell.fn-portrait #xl-bubble-line{font-size:13px;line-height:1.45;}
.fn-core-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#38e4ff;box-shadow:0 0 8px #38e4ff;}
.fn-core-dot.hot{background:#ffd166;box-shadow:0 0 11px #ffd166;}
#fn-thrill-wrap{margin-top:5px;display:flex;align-items:center;gap:6px;font-size:10px;color:#9cdff0;}
#fn-thrill-track{flex:1;height:6px;background:#0a2233;border:1px solid #38e4ff44;border-radius:4px;overflow:hidden;}
#fn-thrill-fill{height:100%;width:18%;background:linear-gradient(90deg,#1bb8e6,#5ef3ff);transition:width .12s;}
#fn-thrill-fill.ready{background:linear-gradient(90deg,#38e4ff,#ffd166);box-shadow:0 0 10px #38e4ff;}
#fn-quick-overdrive{position:absolute;right:10px;bottom:10px;z-index:13;min-height:40px;padding:7px 14px;border-radius:999px;border:1.5px solid #ffd166;background:linear-gradient(135deg,#0d4a66f2,#5e4310f2);color:#fff6d1;font-size:12px;font-weight:800;letter-spacing:.03em;box-shadow:0 0 18px #38e4ff88;cursor:pointer;touch-action:manipulation;pointer-events:auto;}
#fn-quick-overdrive[hidden]{display:none!important;}
#fn-quick-overdrive.active{border-color:#6af3ff;background:linear-gradient(135deg,#09374de8,#115f7ae8);color:#c8f9ff;}
#xl-shell.fn-portrait #fn-quick-overdrive{position:static;align-self:stretch;min-height:44px;font-size:13px;order:0;}
#fn-dock{position:absolute;right:12px;bottom:12px;z-index:12;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;pointer-events:auto;}
#fn-dock button{background:#091c2ce8;color:#dff7ff;border:1px solid #38e4ff77;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;min-height:34px;}
#fn-dock button:hover{background:#12334c;}
#fn-dock #fn-overdrive-btn.ready{background:linear-gradient(135deg,#0d4a66,#594312);border-color:#ffd166;color:#fff6d1;box-shadow:0 0 14px #38e4ff66;}
#fn-dock #fn-overdrive-btn:disabled{opacity:.52;cursor:default;}
#fn-result{position:absolute;inset:0;z-index:20;background:#050f19d9;display:grid;place-items:center;padding:14px;}
#fn-result[hidden]{display:none!important;}
#fn-result-card{width:min(420px,92%);background:#0a1c2cf7;border:1px solid #48e5ff88;border-radius:14px;padding:18px 20px;color:#e8f6ff;box-shadow:0 18px 50px #000b;display:grid;gap:10px;}
#fn-result-card h2{margin:0;color:#ffd166;font-size:20px;letter-spacing:.04em;}
#fn-result-card p{margin:0;font-size:13px;line-height:1.55;color:#cde7f2;}
#fn-result-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;}
#fn-result-actions button{flex:1;min-width:110px;min-height:38px;border-radius:8px;border:1px solid #4be5ff88;background:#13354c;color:#eefaff;font-weight:700;cursor:pointer;}
#fn-result-actions button.primary{background:linear-gradient(135deg,#135877,#207e94);border-color:#ffd166;}
   `;
   document.head.appendChild(style);
  }

  const bubbleEl=document.getElementById('xl-bubble');
  const bubbleCtxEl=document.getElementById('xl-bubble-context');
  const bubbleLineEl=document.getElementById('xl-bubble-line');
  let coreDot=null;
  if(bubbleEl){
   const strong=bubbleEl.querySelector&&bubbleEl.querySelector('strong');
   if(strong){
    strong.textContent='';
    coreDot=document.createElement('i');coreDot.className='fn-core-dot';
    strong.append(coreDot,'FENRIR // 芬里尔');
   }
  }

  // Mount thrill bar inside #xl-hud and tactical dock inside #outcanvasd
  const hudEl=document.getElementById('xl-hud');
  let thrillFill=null,thrillPct=null;
  if(hudEl){
   const wrap=document.createElement('div');wrap.id='fn-thrill-wrap';
   const lbl=document.createElement('span');lbl.textContent='核心猎趣';
   const track=document.createElement('div');track.id='fn-thrill-track';
   thrillFill=document.createElement('div');thrillFill.id='fn-thrill-fill';
   thrillPct=document.createElement('b');thrillPct.textContent='18%';
   track.appendChild(thrillFill);wrap.append(lbl,track,thrillPct);
   hudEl.appendChild(wrap);
  }

  const stageHost=document.getElementById('outcanvasd')||document.getElementById('screen');
  const screenEl=document.getElementById('screen');
  let overdriveBtn=null,quickOverdriveBtn=null,modeBtn=null,tinyBtn=null,resultEl=null,resultTitle=null,resultStats=null,resultQuote=null;
  let portraitTopEl=null,portraitBotEl=null;
  if(stageHost){
   const dock=document.createElement('div');dock.id='fn-dock';
   overdriveBtn=document.createElement('button');overdriveBtn.id='fn-overdrive-btn';overdriveBtn.type='button';
   overdriveBtn.textContent='⚡ 核心过载 [F]';overdriveBtn.disabled=true;
   overdriveBtn.onclick=()=>activateOverdrive();
   modeBtn=document.createElement('button');modeBtn.type='button';modeBtn.textContent='模式：雨夜猎场';
   modeBtn.onclick=()=>toggleMode();
   tinyBtn=document.createElement('button');tinyBtn.type='button';tinyBtn.textContent='小人短呼：开';
   tinyBtn.onclick=()=>{st.tinyPanicOn=!st.tinyPanicOn;tinyBtn.textContent='小人短呼：'+(st.tinyPanicOn?'开':'关');if(!st.tinyPanicOn)st.tinyBubbles.length=0;};
   const restartBtn=document.createElement('button');restartBtn.type='button';restartBtn.textContent='重开';
   restartBtn.onclick=()=>resetRun(st.mode);
   dock.append(overdriveBtn,modeBtn,tinyBtn,restartBtn);
   stageHost.appendChild(dock);

   quickOverdriveBtn=document.createElement('button');
   quickOverdriveBtn.id='fn-quick-overdrive';
   quickOverdriveBtn.type='button';
   quickOverdriveBtn.hidden=true;
   quickOverdriveBtn.textContent='⚡ 发动过载';
   quickOverdriveBtn.onclick=()=>activateOverdrive();
   for(const ev of ['touchstart','touchend','touchcancel']){
    quickOverdriveBtn.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
   }
   stageHost.appendChild(quickOverdriveBtn);

   if(shell&&screenEl&&screenEl.parentNode===shell){
    portraitTopEl=document.createElement('div');portraitTopEl.id='fn-portrait-top';
    portraitBotEl=document.createElement('div');portraitBotEl.id='fn-portrait-bot';
    shell.insertBefore(portraitTopEl,screenEl);
    shell.insertBefore(portraitBotEl,screenEl.nextSibling);
   }

   resultEl=document.createElement('div');resultEl.id='fn-result';resultEl.hidden=true;
   const card=document.createElement('div');card.id='fn-result-card';
   resultTitle=document.createElement('h2');
   resultStats=document.createElement('p');
   resultQuote=document.createElement('p');
   const acts=document.createElement('div');acts.id='fn-result-actions';
   const againBtn=document.createElement('button');againBtn.className='primary';againBtn.textContent='再来一轮猎场';
   againBtn.onclick=()=>resetRun('hunt');
   const endBtn=document.createElement('button');endBtn.textContent='切入无尽自由';
   endBtn.onclick=()=>resetRun('endless');
   acts.append(againBtn,endBtn);
   card.append(resultTitle,resultStats,resultQuote,acts);
   resultEl.appendChild(card);
   stageHost.appendChild(resultEl);
  }

  function syncMobileLayout(){
   if(!shell||!portraitTopEl||!portraitBotEl||!stageHost)return;
   const isPortrait=(window.innerHeight>window.innerWidth)&&window.innerWidth<=760;
   shell.classList.toggle('fn-portrait',isPortrait);
   if(isPortrait){
    if(hudEl&&hudEl.parentNode!==portraitTopEl)portraitTopEl.appendChild(hudEl);
    if(quickOverdriveBtn&&quickOverdriveBtn.parentNode!==portraitBotEl)portraitBotEl.prepend(quickOverdriveBtn);
    if(bubbleEl&&bubbleEl.parentNode!==portraitBotEl)portraitBotEl.appendChild(bubbleEl);
   }else{
    if(hudEl&&hudEl.parentNode!==stageHost)stageHost.appendChild(hudEl);
    if(bubbleEl&&bubbleEl.parentNode!==stageHost)stageHost.appendChild(bubbleEl);
    if(quickOverdriveBtn&&quickOverdriveBtn.parentNode!==stageHost)stageHost.appendChild(quickOverdriveBtn);
   }
   window.dispatchEvent(new Event('fn-layout-change'));
  }
  if(typeof window!=='undefined'){
   window.addEventListener('resize',syncMobileLayout);
   syncMobileLayout();
  }

  function speak(cat,priority=1){
   const now=st.totalClock;
   if(st.speakLeft>0&&priority<st.speakPriority)return;
   if(priority<3&&now-st.lastSpeakAt<2.1)return;
   const text=pick(cat);
   st.speakLeft=priority>=3?4.4:3.2;
   st.speakPriority=priority;
   st.lastSpeakAt=now;
   if(bubbleEl&&bubbleLineEl){
    bubbleLineEl.textContent=text;
    if(bubbleCtxEl)bubbleCtxEl.textContent=CTX_LABELS[cat]||'雨夜大道';
    bubbleEl.classList.add('is-speaking');
    bubbleEl.classList.toggle('overdrive-voice',st.overdrive||cat==='overdrive');
    bubbleEl.setAttribute('aria-hidden','false');
   }
  }

  function spawnTinyBubble(b,kind){
   if(!st.tinyPanicOn||!b||st.tinyBubbles.length>=2||st.tinyCooldown>0)return;
   const pool=TINY_LINES[kind]||TINY_LINES.panic;
   const text=pool[Math.floor(Math.random()*pool.length)];
   st.tinyBubbles.push({bug:b,x:b.x,y:floor_y-18,text,age:0,max:1.85});
   st.tinyCooldown=1.35+Math.random()*.9;
  }

  function activateOverdrive(){
   if(st.finished||st.overdrive||st.thrill<100)return false;
   st.overdrive=true;
   st.overdriveLeft=7.0;
   st.thrill=100;
   paw.max_velocity=3000;
   fatigue=0;
   addPopup('⚡ 核心过载启动',paw_x,floor_y-54,'#ffd166');
   speak('overdrive',4);
   playChime(240,760,.36,.15,'sawtooth');
   playChime(92,48,.42,.18,'sine');
   const alive=bugs.filter(b=>b&&b.alive&&b.alive()&&b.x>20&&b.x<w-20);
   if(alive.length)spawnTinyBubble(alive[Math.floor(Math.random()*alive.length)],'overdrive');
   return true;
  }

  function finishHunt(){
   if(st.finished)return;
   st.finished=true;
   st.overdrive=false;
   paw.max_velocity=2400;
   const score=st.kills*100+st.intercepts*280+st.evacClears*320-st.runnerEscapes*120-st.escapes*12;
   const rank=(st.kills>=42&&st.runnerEscapes<=2&&(st.intercepts>=1||st.evacClears>=1))?'S':(st.kills>=22&&st.runnerEscapes<=5)?'A':'B';
   const quote=pick('finish'+rank);
   speak('finish'+rank,5);
   if(resultEl&&resultTitle&&resultStats&&resultQuote){
    resultTitle.textContent=`蓝调雨夜猎场 · 评级 ${rank}`;
    resultStats.textContent=`总击倒 ${st.kills} · 截击领跑 ${st.intercepts} · 端掉撤离点 ${st.evacClears} · 漏网 ${st.escapes} · 单脚最高 ${st.maxSingleStomp} · 评分 ${Math.max(0,score)}`;
    resultQuote.textContent=`「${quote}」`;
    resultEl.hidden=false;
   }
  }

  function resetRun(nextMode){
   st.mode=nextMode==='endless'?'endless':'hunt';
   st.wave=0;st.waveClock=0;st.totalClock=0;st.finished=false;
   st.thrill=18;st.overdrive=false;st.overdriveLeft=0;
   st.rainMul=1.0;st.grinding=false;
   st.kills=0;st.escapes=0;st.runnerEscapes=0;st.intercepts=0;st.evacClears=0;st.maxSingleStomp=0;
   st.hoverTime=0;st.grindClock=0;st.runnerTimer=3.0;st.evacZone=null;st.evacCooldown=5.0;
   st.tinyBubbles.length=0;st.popups.length=0;
   st.trackedAlive.clear();
   paw.max_velocity=2400;
   if(resultEl)resultEl.hidden=true;
   if(modeBtn)modeBtn.textContent=st.mode==='hunt'?'模式：雨夜猎场':'模式：无尽自由';
   st.entered=true;
   speak('enter',3);
  }

  function toggleMode(){
   resetRun(st.mode==='hunt'?'endless':'hunt');
  }

  function promoteRunner(){
   const cands=bugs.filter(b=>b&&b.alive&&b.alive()&&!b.fenrirRunner&&b.x>w*.14&&b.x<w*.86);
   if(cands.length){
    const target=cands[Math.floor(Math.random()*cands.length)];
    target.fenrirRunner=true;
    target.fenrirExitDir=target.x<w/2?-1:1;
    target.dir=target.fenrirExitDir;
    spawnTinyBubble(target,'runner');
    return true;
   }
   if(typeof add_bug==='function'){
    const b=add_bug();
    if(b){
     b.x=w*(0.35+Math.random()*0.3);b.seen=true;
     b.fenrirRunner=true;b.fenrirExitDir=Math.random()<.5?-1:1;b.dir=b.fenrirExitDir;
     spawnTinyBubble(b,'runner');
     return true;
    }
   }
   return false;
  }

  // Landing shockwave stagger + multi-kill / evac wipe check
  st.onLanding=function(event){
   if(st.finished)return;
   const force=event.force||0;
   const isHeavy=force>.52||st.overdrive;
   // Shockwave stagger outer tinies
   if(isHeavy){
    const inner=paw.width*.46,outer=paw.width*(st.overdrive?.92:.68);
    let staggered=0;
    for(const b of bugs){
     if(!b||!b.alive||!b.alive()||b.knocked)continue;
     const dx=b.x-paw_x,adx=Math.abs(dx);
     if(adx>=inner&&adx<=outer){
      b.knocked=true;b.rolling=true;
      b.roll_x_vel=(dx>=0?1:-1)*(55+force*95*(st.overdrive?1.25:1));
      b.roll_y_vel=-26-force*40;
      b.get_up=Math.max(b.get_up||0,st.overdrive?1.6:1.0);
      b.agitated=true;
      staggered++;
     }
    }
    if(staggered>=2){
     addThrill(staggered*2.2);
     addPopup(st.overdrive?`⚡ 电弧震晕 ×${staggered}`:`震波失衡 ×${staggered}`,paw_x,floor_y-38,st.overdrive?'#ffd166':'#7af3ff');
     const panicked=bugs.find(b=>b&&b.alive&&b.alive()&&Math.abs(b.x-paw_x)<outer+30);
     if(panicked)spawnTinyBubble(panicked,'panic');
    }
   }
   // Check Wave 3 Evac Zone clear
   if(st.evacZone&&Math.abs(paw_x-st.evacZone.x)<paw.width*.52){
    const zx=st.evacZone.x;
    st.evacZone=null;st.evacCooldown=9.5;
    st.evacClears++;
    addThrill(26);
    addPopup('撤离点清剿！',zx,floor_y-52,'#ffd166');
    playChime(520,220,.26,.12,'sawtooth');
    speak('evac',3);
   }
   // Snapshot stomp burst kills right after collision settles (checked in next update tick)
   st.pendingStompCheck={at:st.totalClock+.06,x:paw_x,baseKills:st.kills};
  };

  window.addEventListener('keydown',e=>{
   if(e.code==='KeyF'&&!e.repeat){
    if(activateOverdrive())e.preventDefault();
   }
  });

  function updateHudDom(){
   const wCfg=WAVES[st.wave]||WAVES[0];
   const nameEl=document.getElementById('xl-stage-name');
   const modeEl=document.getElementById('xl-mode-name');
   const timeEl=document.getElementById('xl-time');
   const countEl=document.getElementById('xl-count');
   const goalEl=document.getElementById('xl-goal');
   if(nameEl)nameEl.textContent=st.mode==='hunt'?`芬里尔 · W${wCfg.id} ${wCfg.name}`:'芬里尔 · 蓝调雨夜自由';
   if(modeEl)modeEl.textContent=st.overdrive?'⚡ 核心过载':(st.mode==='hunt'?'雨夜猎场':'无尽自由');
   if(timeEl){
    const sec=st.mode==='hunt'?Math.max(0,Math.ceil(wCfg.dur-st.waveClock)):Math.floor(st.totalClock);
    const mm=String(Math.floor(sec/60)).padStart(2,'0'),ss=String(sec%60).padStart(2,'0');
    timeEl.textContent=st.mode==='hunt'?`剩余 ${mm}:${ss}`:`${mm}:${ss}`;
   }
   if(countEl)countEl.textContent=`击倒 ${st.kills} · 截击 ${st.intercepts} · 漏网 ${st.escapes}`;
   if(goalEl){goalEl.hidden=false;goalEl.textContent=st.overdrive?`过载剩余 ${st.overdriveLeft.toFixed(1)}s`:wCfg.sub;}
   if(thrillFill&&thrillPct){
    const pct=st.overdrive?Math.round((st.overdriveLeft/7)*100):Math.round(st.thrill);
    thrillFill.style.width=pct+'%';
    thrillFill.classList.toggle('ready',st.overdrive||st.thrill>=100);
    thrillPct.textContent=st.overdrive?`${st.overdriveLeft.toFixed(1)}s`:`${pct}%`;
   }
   if(coreDot)coreDot.classList.toggle('hot',st.overdrive||st.thrill>=85);
   if(overdriveBtn){
    const ready=!st.overdrive&&st.thrill>=100&&!st.finished;
    overdriveBtn.disabled=!ready;
    overdriveBtn.classList.toggle('ready',ready||st.overdrive);
    overdriveBtn.textContent=st.overdrive?`⚡ 过载中 ${st.overdriveLeft.toFixed(1)}s`:ready?'⚡ 发动过载 [F]':`⚡ 充能 ${Math.round(st.thrill)}%`;
   }
   if(quickOverdriveBtn){
    const ready=!st.overdrive&&st.thrill>=100&&!st.finished;
    quickOverdriveBtn.hidden=!(ready||st.overdrive);
    quickOverdriveBtn.disabled=st.overdrive;
    quickOverdriveBtn.classList.toggle('active',st.overdrive);
    quickOverdriveBtn.textContent=st.overdrive?`⚡ 核心过载中 ${st.overdriveLeft.toFixed(1)}s`:'⚡ 发动核心过载';
   }
  }

  // Hook main update loop cleanly
  const fnOldUpdate=update_paw;
  update_paw=function(){
   fnOldUpdate();
   if(pause||tr||!active)return;
   const dt=Math.min(.05,delta||0);
   st.audioClock=Math.max(0,st.audioClock-dt);
   st.tinyCooldown=Math.max(0,st.tinyCooldown-dt);
   if(st.finished)return;

   st.totalClock+=dt;
   if(!st.entered){st.entered=true;speak('enter',3);}

   // Wave progression in Hunt mode
   if(st.mode==='hunt'){
    st.waveClock+=dt;
    const wCfg=WAVES[st.wave];
    st.rainMul=wCfg.rain;
    if(st.waveClock>=wCfg.dur){
     if(st.wave<WAVES.length-1){
      st.wave++;st.waveClock=0;
      addPopup(`第 ${st.wave+1} 波 · ${WAVES[st.wave].name}`,w/2,86,'#ffd166');
      playChime(320,580,.28,.11,'triangle');
      speak(st.wave===1?'wave2':'wave3',3);
     }else{
      finishHunt();
      updateHudDom();
      return;
     }
    }
   }else{
    st.rainMul=1.25;
   }

   // Core Overdrive timer
   if(st.overdrive){
    fatigue=0;
    st.overdriveLeft-=dt;
    if(st.overdriveLeft<=0){
     st.overdrive=false;st.overdriveLeft=0;st.thrill=0;
     paw.max_velocity=2400;
    }
   }

   // Hover lock-on & tease charging
   const halfW=paw.width*.46;
   let locked=0;
   let lockedSample=null;
   for(const b of bugs){
    if(!b||!b.alive||!b.alive())continue;
    if(Math.abs(b.x-paw_x)<=halfW){
     locked++;
     if(!lockedSample)lockedSample=b;
     if((paw_state===1||paw_state===2)&&paw_y>h*.42){
      b.agitated=true;
      // Subtle panic pull/hesitation under hovering mecha claw
      const pull=paw_x-b.x;
      b.x+=Math.sign(pull)*Math.min(Math.abs(pull),12*dt);
     }
    }
   }
   st.lockCount=locked;
   if((paw_state===1||paw_state===2)&&locked>=2&&paw_y>h*.40){
    st.hoverTime+=dt;
    addThrill(14*dt);
    if(st.hoverTime>=.55){
     st.hoverTime=0;
     addPopup(`威压锁定 ${locked}`,paw_x,floor_y-32,'#6af3ff');
     speak('tease',2);
     if(lockedSample)spawnTinyBubble(lockedSample,'hover');
    }
   }else{
    st.hoverTime=Math.max(0,st.hoverTime-dt*1.5);
   }

   // Drag grind detection
   const vx=(paw_x-st.lastPawX)/Math.max(.008,dt);
   st.lastPawX=paw_x;
   if(paw_state===3&&pressure>.42&&Math.abs(vx)>22){
    st.grinding=true;st.dragDir=Math.sign(vx)||1;st.grindClock+=dt;
    addThrill(13*dt);
    playGrindScrape();
    if(st.grindClock>=.75){
     st.grindClock=0;
     addPopup('湿路拖碾',paw_x,floor_y-28,'#7cf6ff');
     speak('grind',2);
    }
   }else{
    st.grinding=false;st.grindClock=Math.max(0,st.grindClock-dt*2);
   }

   // Wave 2/3 Runner spawning & steering
   const runnersEnabled=st.mode==='endless'||WAVES[st.wave].runners;
   if(runnersEnabled){
    st.runnerTimer-=dt;
    const activeRunners=bugs.filter(b=>b&&b.alive&&b.alive()&&b.fenrirRunner).length;
    if(st.runnerTimer<=0&&activeRunners<2){
     if(promoteRunner())st.runnerTimer=st.wave>=2?5.8:7.2;
     else st.runnerTimer=1.5;
    }
    for(const b of bugs){
     if(!b||!b.alive||!b.alive()||!b.fenrirRunner||b.knocked)continue;
     b.x+=(b.fenrirExitDir||b.dir||1)*26*dt;
    }
   }

   // Wave 3 Evac Zone spawning & attraction
   const evacEnabled=st.mode==='hunt'&&WAVES[st.wave].evac;
   if(evacEnabled){
    if(!st.evacZone){
     st.evacCooldown-=dt;
     if(st.evacCooldown<=0){
      const zx=w*(0.22+Math.random()*0.56);
      st.evacZone={x:zx,age:0,max:13};
      addPopup('⚠ 临时撤离点出现',zx,floor_y-48,'#ff9b54');
      speak('evac',2);
     }
    }else{
     st.evacZone.age+=dt;
     let nearZone=null;
     for(const b of bugs){
      if(!b||!b.alive||!b.alive()||b.knocked||b.fenrirRunner)continue;
      const dx=st.evacZone.x-b.x;
      if(Math.abs(dx)<115&&Math.abs(dx)>8){
       b.x+=Math.sign(dx)*15*dt;
       if(!nearZone)nearZone=b;
      }
     }
     if(nearZone&&Math.random()<.02)spawnTinyBubble(nearZone,'evac');
     if(st.evacZone.age>=st.evacZone.max){st.evacZone=null;st.evacCooldown=6;}
    }
   }else{
    st.evacZone=null;
   }

   // Track alive -> dead (kills & Runner intercepts) and off-screen escapes
   const curAlive=new Set();
   for(const b of bugs){
    if(!b)continue;
    const isAlive=!!(b.alive&&b.alive());
    if(isAlive&&b.seen)curAlive.add(b);
    if(isAlive&&b.seen&&!st.trackedAlive.has(b)){
     st.trackedAlive.set(b,{runner:!!b.fenrirRunner,x:b.x});
    }else if(st.trackedAlive.has(b)){
     const rec=st.trackedAlive.get(b);
     rec.runner=rec.runner||!!b.fenrirRunner;
     rec.x=b.x;
     if(!isAlive){
      st.trackedAlive.delete(b);
      st.kills++;
      addThrill(3.2);
      if(rec.runner){
       st.intercepts++;
       addThrill(22);
       addPopup('⚡ 截击领跑者！',b.x,floor_y-44,'#ffd166');
       playChime(620,940,.22,.11,'triangle');
       speak('intercept',3);
      }
     }
    }
   }
   for(const [b,rec] of st.trackedAlive.entries()){
    if(!curAlive.has(b)){
     st.trackedAlive.delete(b);
     if(b.alive&&b.alive()&&(rec.runner||b.agitated)){
      st.escapes++;
      if(rec.runner)st.runnerEscapes++;
      if(rec.runner||st.escapes%4===0){
       addPopup(rec.runner?'领跑者逃脱！':'漏网逃脱',clamp(rec.x,32,w-32),floor_y-30,'#ff7676');
       speak('escape',2);
      }
     }
    }
   }

   // Multi-kill burst check after landing
   if(st.pendingStompCheck&&st.totalClock>=st.pendingStompCheck.at){
    const gained=st.kills-st.pendingStompCheck.baseKills;
    if(gained>st.maxSingleStomp)st.maxSingleStomp=gained;
    if(gained>=6){
     addThrill(Math.min(24,gained*1.8));
     addPopup(`一脚 ${gained} 连杀！`,st.pendingStompCheck.x,floor_y-46,'#5af2ff');
     speak('multi',3);
    }
    st.pendingStompCheck=null;
   }

   // Update timers for dialogue, tiny bubbles, and popups
   if(st.speakLeft>0){
    st.speakLeft-=dt;
    if(st.speakLeft<=0&&bubbleEl){
     bubbleEl.classList.remove('is-speaking');
     bubbleEl.setAttribute('aria-hidden','true');
     st.speakPriority=0;
    }
   }
   for(const tb of st.tinyBubbles){
    tb.age+=dt;
    if(tb.bug&&tb.bug.alive&&tb.bug.alive())tb.x=tb.bug.x;
   }
   st.tinyBubbles=st.tinyBubbles.filter(tb=>tb.age<tb.max);
   for(const p of st.popups){p.age+=dt;p.y-=18*dt;}
   st.popups=st.popups.filter(p=>p.age<p.max);

   updateHudDom();
  };

  // WebGL Floor pass extension: hover target ring & Wave 3 evac zone
  const fnOldFloor=window.xlDrawImpactFloorPass;
  window.xlDrawImpactFloorPass=function(){
   if(typeof fnOldFloor==='function')fnOldFloor();
   if(!active||pause||tr||typeof xlFloorGfx==='undefined'||!xlFloorGfx.ready())return;
   if(paw_state<3&&paw_y>h*.34){
    const near=st.lockCount>=2;
    xlFloorGfx.drawTargetGuide(paw_x,floor_y-1,paw.width*(near?.88:.66),near||st.overdrive);
   }
   if(st.evacZone){
    const pulse=.5+.5*Math.sin(st.evacZone.age*7);
    xlFloorGfx.drawRallyFloorZone(st.evacZone.x,floor_y-1,.4+.6*pulse);
   }
  };

  // 2D overlay pass: Runner diamonds, Evac Zone tag, Hover lock readout, Tiny panic bubbles, Chinese tactical popups, Overdrive frame
  const fnOldDraw=draw;
  draw=function(){
   fnOldDraw();
   if(!active||pause||tr)return;
   const sx=(typeof quality!=='undefined'&&quality.displayScaleX)||sc,sy=(typeof quality!=='undefined'&&quality.displayScaleY)||sc;
   occ.save();occ.setTransform(sx,0,0,sy,0,0);

   // Overdrive cyan-gold edge pulse
   if(st.overdrive){
    const p=.14+.07*Math.sin(st.totalClock*12);
    const vg=occ.createRadialGradient(w/2,h*.55,w*.30,w/2,h*.55,w*.70);
    vg.addColorStop(0,'rgba(40,228,255,0)');
    vg.addColorStop(1,`rgba(40,228,255,${p.toFixed(3)})`);
    occ.fillStyle=vg;occ.fillRect(0,0,w,h);
   }

   // Hover lock count badge on road
   if(paw_state<3&&st.lockCount>0&&paw_y>h*.36){
    const txt=`锁定 ${st.lockCount}`;
    occ.font='700 9px "Microsoft YaHei",sans-serif';
    occ.textAlign='center';occ.textBaseline='middle';
    const bw=occ.measureText(txt).width+10;
    occ.globalAlpha=.86;
    occ.fillStyle='#071926d8';occ.fillRect(paw_x-bw/2,floor_y-18,bw,12);
    occ.strokeStyle=st.overdrive?'#ffd166':'#44e7ff';occ.lineWidth=.8;occ.strokeRect(paw_x-bw/2,floor_y-18,bw,12);
    occ.fillStyle=st.overdrive?'#ffe58f':'#8cf6ff';occ.fillText(txt,paw_x,floor_y-12);
   }

   // Wave 2/3 Runner markers
   occ.font='700 8px "Microsoft YaHei",sans-serif';occ.textAlign='center';
   for(const b of bugs){
    if(!b||!b.alive||!b.alive()||!b.fenrirRunner)continue;
    const rx=b.x,ry=floor_y-22-(b.z||0);
    occ.globalAlpha=.95;occ.fillStyle='#ff6b4a';
    occ.beginPath();occ.moveTo(rx,ry+5);occ.lineTo(rx-4,ry);occ.lineTo(rx+4,ry);occ.closePath();occ.fill();
    occ.fillStyle='#ffe2c8';occ.fillText('领跑',rx,ry-2);
   }

   // Wave 3 Evac Zone tactical brackets
   if(st.evacZone){
    const zx=st.evacZone.x,pulse=.6+.4*Math.sin(st.evacZone.age*7);
    occ.globalAlpha=.85*pulse;occ.strokeStyle='#ff9b54';occ.lineWidth=1.1;
    occ.strokeRect(zx-26,floor_y-13,52,11);
    occ.fillStyle='#ffd2a8';occ.font='700 8px "Microsoft YaHei",sans-serif';occ.textAlign='center';
    occ.fillText('撤离集结点',zx,floor_y-16);
   }

   // Tiny panic micro-bubbles
   if(st.tinyPanicOn&&st.tinyBubbles.length){
    occ.font='600 8px "Microsoft YaHei",sans-serif';occ.textAlign='center';occ.textBaseline='middle';
    for(const tb of st.tinyBubbles){
     const fade=Math.min(1,(tb.max-tb.age)/.35)*Math.min(1,tb.age/.12);
     if(fade<=.02)continue;
     const tw=occ.measureText(tb.text).width+9;
     const bx=clamp(tb.x,tw/2+4,w-tw/2-4),by=tb.y-tb.age*6;
     occ.globalAlpha=fade*.92;
     occ.fillStyle='#0c151fe6';occ.fillRect(bx-tw/2,by-6.5,tw,13);
     occ.strokeStyle='#ff8a6b99';occ.lineWidth=.7;occ.strokeRect(bx-tw/2,by-6.5,tw,13);
     occ.fillStyle='#f6ece4';occ.fillText(tb.text,bx,by);
    }
   }

   // Chinese tactical popups (replacing English stat spam)
   if(st.popups.length){
    occ.font='700 10px "Microsoft YaHei",sans-serif';occ.textAlign='center';occ.textBaseline='middle';
    for(const p of st.popups){
     const fade=Math.max(0,1-p.age/p.max);
     occ.globalAlpha=fade;
     occ.fillStyle='#030c14cc';occ.fillText(p.text,p.x+1,p.y+1);
     occ.fillStyle=p.color;occ.fillText(p.text,p.x,p.y);
    }
   }

   occ.restore();
  };

  updateHudDom();
 })();
}
