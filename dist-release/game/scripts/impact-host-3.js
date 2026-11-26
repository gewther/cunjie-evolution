(()=>{'use strict';

// v5.8.1 archive and presentation additions. All gameplay logic stays owned by StageManager.
let v581SettingsTab='玩法';
const v581Tabs=['玩法','画面与过场','音频与对白','操作','记录与存档'];
function v581GroupSettings(box){
 const nodes=[...box.children],nav=document.createElement('div'),groups=new Map();nav.className='v581-tabbar';nav.setAttribute('role','tablist');
 const info=nodes[0];info.className='v581-note';
 for(const name of v581Tabs){const section=document.createElement('section'),b=document.createElement('button');section.className='v581-tabpanel';section.id='v581-tab-'+v581Tabs.indexOf(name);section.setAttribute('role','tabpanel');groups.set(name,section);b.textContent=name;b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-controls',section.id);b.onclick=()=>v581ShowSettingsTab(box,name);nav.append(b);}
 for(const node of nodes.slice(1)){
  const txt=node.textContent||'';let group='画面与过场';
  if(node.classList.contains('settings-actions'))group='操作';
  else if(node.matches('input[type="file"]'))group='记录与存档';
  else if(/托管|自主|行动性格|自主行动|操作提示|运行速度|粘滞程度/.test(txt))group='玩法';
  else if(/音量|声音|脚步|喊话|气泡显示|气泡透明度|NPC 短气泡|试听|环境音景/.test(txt))group='音频与对白';
  else if(/画面|过场|接地|胶液|残留|反馈|视觉|镜头|震动|碰撞|HUD 自动淡出/.test(txt))group='画面与过场';
  groups.get(group).append(node);
 }
 box.replaceChildren(info,nav,...v581Tabs.map(n=>groups.get(n)));
 v581ShowSettingsTab(box,v581SettingsTab);
}
function v581ShowSettingsTab(box,name){
 v581SettingsTab=v581Tabs.includes(name)?name:v581Tabs[0];
 for(let i=0;i<v581Tabs.length;i++){const on=v581Tabs[i]===v581SettingsTab;box.querySelectorAll('.v581-tabbar [role="tab"]')[i]?.setAttribute('aria-selected',String(on));const p=box.querySelector('#v581-tab-'+i);if(p)p.hidden=!on;}
}
function v581ConfirmRestart(){
 if(manager.status!=='playing'&&manager.status!=='loading'){toast('当前无法重开本幕');return;}
 panel('重新开始本幕？','将重新计时并清空本幕的临时成绩；此前已完成的幕次与存档记录不会清除。',[
  btn('取消',()=>{panel('已暂停','游戏已暂停。',[btn('继续',resume,true),btn('设置',settings),btn('重开本幕',v581ConfirmRestart),btn('返回标题',home)]);}),
  btn('确认重开',()=>{paused=false;manager.restart();},true)
 ]);
}
const v581Replay={manager:null,renderer:null,audio:null,loader:null,index:-1,paused:true,raf:0,last:0,seek:false};
function v581Clock(ms){const sec=Math.max(0,Math.floor(ms/1000));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
function v581Library(){
 if(mode!=='home'&&!paused)freeze();
 const box=document.createElement('div');box.className='v581-library-grid';
 for(const [index,title,description] of [[0,'CG-01 · 球鞋 → 袜脚','继承当前选择的球鞋外观（含 AJ5 / AJ6 / 乔丹 / 自定义）'],[1,'CG-02 · 袜脚 → 裸爪','五镜头 · 7.5 秒']]){
  const card=document.createElement('section');card.className='v581-library-card';
  const h=document.createElement('strong');h.textContent=title;const p=document.createElement('p');p.textContent=description;
  const b=btn(save.data.seen.includes(index)?'▶ 播放过场':'🔒 尚未解锁',()=>v581OpenReplay(index),true);b.disabled=!save.data.seen.includes(index);
  card.append(h,p,b);box.append(card);
 }
 panel('剧情回顾 · 已看过场',box,[btn('成绩与成就',records),btn(mode==='home'?'关闭':'继续',()=>mode==='home'?($('modal').hidden=true,$('rescueBtn').hidden=true):resume(),true)]);
}
async function v581OpenReplay(index){
 if(!save.data.seen.includes(index))return;
 v581CloseReplay();
 const state=v581Replay,ui=$('v581Replay'),token=(state.token||0)+1;state.token=token;
 ui.hidden=false;state.index=index;state.paused=true;state.last=0;
 $('v581ReplayTitle').textContent=index===0?'CG-01 · 球鞋 → 袜脚':'CG-02 · 袜脚 → 裸爪';
 $('v581ReplayNotice').hidden=false;$('v581ReplayNotice').textContent='正在加载过场资源…';
 $('v581ReplayToggle').textContent='▶ 播放';$('v581ReplayCaption').textContent='';
 $('v581ReplayClose').focus();
 try{
  await ensureCinematics();
  if(state.token!==token||ui.hidden)return;
  const loader=new CinematicAssetLoader(DATA.cinematics.images),snd=new CinematicAudioController(DATA.audio);
  snd.configure(save.data.prefs);state.loader=loader;state.audio=snd;
  state.manager=new CinematicManager({scripts:DATA.cinematics.scripts,loader,audio:snd});
  const canvas=$('v581ReplayCanvas');state.renderer=new CinematicRenderer({canvas,c:canvas.getContext('2d')},loader);
  const manager=state.manager;
  const ok=await manager.begin(index,{shoeVariant:activeShoeSkin});if(!ok)throw Error(manager.reason||'过场资源未能载入');if(state.manager!==manager||ui.hidden)return;
  manager.pause();$('v581ReplaySeek').max=manager.script.durationMs;$('v581ReplaySeek').value='0';$('v581ReplayNotice').hidden=true;
  v581DrawReplay();v581ToggleReplay(true);state.raf=requestAnimationFrame(v581ReplayFrame);
 }catch(e){if(!ui.hidden&&state.token===token){$('v581ReplayNotice').textContent='载入失败：'+e.message;}}
}
function v581DrawReplay(){
 const state=v581Replay,manager=state.manager;if(!manager?.script)return;
 const frame=manager.frame(save.data.prefs.reduceMotion);state.renderer.render(frame,{reducedMotion:save.data.prefs.reduceMotion,lowEffects:save.data.prefs.lowEffects});
 $('v581ReplayCaption').textContent=save.data.prefs.cinematicCaptions===false?'':frame?.caption?((frame.caption.speaker?frame.caption.speaker+' · ':'')+frame.caption.text):'';
 $('v581ReplayCaption').style.opacity=frame?.caption?String(frame.captionOpacity??1):'1';$('v581ReplaySeek').value=String(Math.round(manager.elapsedMs));$('v581ReplayTime').textContent=v581Clock(manager.elapsedMs)+' / '+v581Clock(manager.script.durationMs);
}
function v581ReplayFrame(now){
 const state=v581Replay;if($('v581Replay').hidden)return;
 const dt=state.last?Math.min(.05,(now-state.last)/1000):0;state.last=now;
 if(!state.paused&&!document.hidden&&state.manager){
  if(state.manager.tick(dt)){state.paused=true;$('v581ReplayToggle').textContent='▶ 重播';}
 }
 v581DrawReplay();state.raf=requestAnimationFrame(v581ReplayFrame);
}
function v581ToggleReplay(forcePlay=false){
 const st=v581Replay,m=st.manager;if(!m||!m.script)return;
 if(forcePlay||st.paused){if(m.state==='finished'){m.elapsedMs=0;m.state='playing';st.audio.stop();}else m.resume();st.paused=false;$('v581ReplayToggle').textContent='Ⅱ 暂停';}
 else{m.pause();st.paused=true;$('v581ReplayToggle').textContent='▶ 继续';}
 st.last=0;
}
function v581SeekReplay(ms){
 const st=v581Replay,m=st.manager;if(!m?.script)return;
 const t=Math.max(0,Math.min(m.script.durationMs,Number(ms)||0));
 st.audio.stop();st.audio.played=new Set((m.script.sounds||[]).map((event,i)=>event.atMs<=t?i:-1).filter(i=>i>=0));
 m.elapsedMs=t;if(m.state==='finished'&&t<m.script.durationMs)m.state='paused';if(t>=m.script.durationMs){m.state='finished';st.paused=true;$('v581ReplayToggle').textContent='▶ 重播';}else{m.state=st.paused?'paused':'playing';m.pausedFrom='playing';}
 v581DrawReplay();
}
function v581CloseReplay(){
 const st=v581Replay;st.token=(st.token||0)+1;cancelAnimationFrame(st.raf);st.raf=0;st.manager?.abort();st.manager=null;st.renderer=null;st.loader=null;st.audio=null;st.index=-1;st.last=0;st.paused=true;
 const ui=$('v581Replay');if(ui)ui.hidden=true;
}
function v581Init(){
 $('cgLibraryBtn').onclick=v581Library;
 const quick=$('v56Menu');if(quick){quick.append(btn('📜 对白记录',()=>{v56Menu(false);freeze();log();}),btn('🎞 已看过场',()=>{v56Menu(false);v581Library();}));}
 $('v581ReplayClose').onclick=v581CloseReplay;
 $('v581ReplayToggle').onclick=()=>v581ToggleReplay();
 $('v581ReplayRestart').onclick=()=>{v581SeekReplay(0);v581ToggleReplay(true);};
 $('v581ReplaySeek').oninput=value=>v581SeekReplay(value.target.value);
 window.addEventListener('keydown',event=>{if(!$('v581Replay').hidden){if(event.code==='Escape'){v581CloseReplay();}else if(event.code==='Space'){v581ToggleReplay();}else if(event.code==='ArrowRight'){v581SeekReplay(Number($('v581ReplaySeek').value)+500);}else if(event.code==='ArrowLeft'){v581SeekReplay(Number($('v581ReplaySeek').value)-500);}else return;event.preventDefault();event.stopImmediatePropagation();}},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&!$('v581Replay').hidden&&v581Replay.manager){v581Replay.manager.pause();v581Replay.paused=true;v581Replay.last=0;$('v581ReplayToggle').textContent='▶ 继续';}});
}

let realmStorage;try{realmStorage=window.localStorage}catch{}realmStorage=realmStorage||{getItem:()=>null,setItem(){}};
const v58AllowedModes=new Set(['home','loading','playing','cinematic','paused','result']);
const v58UI={mode:'home',previous:'home',history:[]};
function v58SetUIState(mode){
 if(!v58AllowedModes.has(mode))throw Error('Invalid view '+mode);
 if(v58UI.mode!==mode){v58UI.previous=v58UI.mode;v58UI.mode=mode;v58UI.history.push(mode);if(v58UI.history.length>40)v58UI.history.shift();}
 document.getElementById('app')?.setAttribute('data-v58-mode',mode);
}
const $=id=>document.getElementById(id),save=new SaveManager(realmStorage),dialogue=new RealmDialogue(DATA.lines,DATA.original),audio=new RealmAudio(DATA.audio),images={},tinyVoices=new TinyVoices(DATA.tinyVoices),fever=new FeverController(DATA.fever);let tinyRenderer,nextSpeech='enter',lastGiantSerial=-1,lastReactive={};
dialogue.configureReactive(DATA.reactiveGiant||{lines:[]});
const autopilot=new AutonomousXiaolong({enabled:save.data.prefs.autoEnabled,personality:save.data.prefs.autoPersonality,pace:save.data.prefs.autoPace,smart:save.data.prefs.autoSmart,dialogue:save.data.prefs.autoDialogue});
const impactFeedback=new ImpactFeedback($('impactLayer'),$('play')),practiceDrills=new PracticeDrills(),footAudio=new FootstepAudio(audio);
// The active skin is selected on the title screen, then locked for the stage's lifetime.
let activeShoeSkin=CunjieShoeSkin.normalize(save.data.prefs.shoeSkin);
function v58EmbeddedVisualOnly(source){
 // Runtime-only injected source; DATA.storyLegacy stays byte-exact. UI only, ego calculations stay intact.
 const targets=[
  ['sprite(ego.bg_spr, w, 0, 0, 1);','if (!window.cunjieEmbeddedUi) sprite(ego.bg_spr, w, 0, 0, 1);'],
  ['sprite(ego.frame_spr, w, 0, 0, 1);','if (!window.cunjieEmbeddedUi) sprite(ego.frame_spr, w, 0, 0, 1);'],
  ['sprite((ego_excite||finished||','if (!window.cunjieEmbeddedUi) sprite((ego_excite||finished||']
 ];
 for(const [a,b] of targets){if(!source.includes(a))throw Error('Embedded UI patch anchor missing '+a);source=source.replace(a,b);}
 return source.replace('<head>','<head><script>window.cunjieEmbeddedUi=true;<\/script>'.replace('<\/','</'));
}
function v59EmbeddedVisualOnly(source){
 // Run after the already verified v5.8 visual adapter, never alter DATA.storyLegacy.
 // affect_ego still updates ego_val, score, combo, statistics and achievements;
 // only the floating-number enqueue path is skipped for embedded mainline.
 const guard='if (!ego.numbers_on)';
 if(!source.includes(guard))throw Error('v5.9 score visual anchor missing');
 source=source.replace(guard,'if (window.cunjieV59CleanNumbers !== false || !ego.numbers_on)');
 // The old renderer has a separate draw path for cached ego_nums. Disable
 // drawing too: it must not leak after a scene reload or live menu toggle.
 const drawStart='function draw_ego_cam() {\n\t// floating numbers';
 const drawEnd='\ttext_color(0, 0, 0, 255);\n\ttext_size();\n\t\n\tif (hide_cam)';
 if(!source.includes(drawStart)||!source.includes(drawEnd))throw Error('v5.9 number draw anchor missing');
 source=source.replace(drawStart,'function draw_ego_cam() {\n\tif (window.cunjieV59CleanNumbers === false) {\n\t// floating numbers');
 source=source.replace(drawEnd,'\ttext_color(0, 0, 0, 255);\n\ttext_size();\n\t}\n\t\n\tif (hide_cam)');
 // Kill counter owns a *second* floating-number visual distinct from ego_nums.
 // Its count and heat animation are retained; suppress only the trailing +N draw.
 const killNumber='\tif (kill_counter_heat > 0) {\n\t\tconst a = norm(kill_counter_heat, .5);';
 if(!source.includes(killNumber))throw Error('v5.9 kill popup visual anchor missing');
 source=source.replace(killNumber,'\tif (kill_counter_heat > 0 && window.cunjieV59CleanNumbers === false) {\n\t\tconst a = norm(kill_counter_heat, .5);');
 // Final rendering gate catches any remaining +N numeric popups from legacy
 // draw paths, without altering score calculation or ordinary HUD numbers.
 const textEmitter='function text(x, y, str) { shapes.push([3, x, y, str]); }';
 if(!source.includes(textEmitter))throw Error('v5.9 text emitter anchor missing');
 source=source.replace(textEmitter,'function text(x, y, str) { if(window.cunjieEmbeddedUi && window.cunjieV59CleanNumbers !== false && typeof str === "string" && /^\\+\\d/.test(str))return; shapes.push([3, x, y, str]); }');
 const head='window.cunjieEmbeddedUi=true;';
 if(!source.includes(head))throw Error('v5.9 iframe visual flag missing');
 const theme=(()=>{try{return $('roomTheme')?.value||localStorage.getItem('cunjie-room-theme')||'rooftop-day';}catch{return $('roomTheme')?.value||'rooftop-day';}})();
 return source.replace(head,head+'window.cunjieV59CleanNumbers='+String(globalThis.cunjieV59CleanNumbers!==false)+';window.__cunjieRoomTheme='+JSON.stringify(theme)+';');
}
function roomStageTitle(){
 const rk=(()=>{try{return $('roomTheme')?.value||localStorage.getItem('cunjie-room-theme')||'rooftop-day';}catch{return $('roomTheme')?.value||'rooftop-day';}})();
 return ({'rooftop-day':'篮球鞋 · 屋顶夕阳','rooftop-night':'篮球鞋 · 屋顶夜景','bedroom-wood':'篮球鞋 · 雨夜木地板','warm':'篮球鞋 · 午后卧室','rain':'篮球鞋 · 雨夜卧室','original':'篮球鞋 · 原版卧室'})[rk]||'篮球鞋 · 屋顶夕阳';
}
const FENRIR_MOTION_URL='assets/fenrir/fenrir-motion-v3.png';
function injectHttpBase(src){
 if(!/^https?:$/.test(location.protocol))return src;
 const baseTag=`<base href="${new URL('./',location.href).href.replace(/"/g,'&quot;')}">`;
 return src.includes('<head>')?src.replace('<head>','<head>'+baseTag):baseTag+src;
}
function legacySource(kind,motionAtlas='',isFenrir=false){
 if(kind==='free'&&motionAtlas){
  const tag=`<script>window.__cunjieCustomMotion=${JSON.stringify(motionAtlas)};window.__cunjieFenrirCity=${Boolean(isFenrir)};<\/script>`.replace('<\\/','</');
  let source=DATA.freeLegacy.includes('<head>')?DATA.freeLegacy.replace('<head>','<head>'+tag):DATA.freeLegacy;
  if(isFenrir){
   const anchor='ptime = performance.now();\nmainloop();';
   const bridge="/* Fenrir-only controls inside the legacy game iframe. */\n// Session-local persona director. No new movement or collision commands.\nfunction createFenrirPersona() {\n let phase = 'manual', handoffs = 0, interruptions = 0, lastClock = 0;\n let pending = null, lastLineAt = -Infinity, nextIdleAt = 0;\n let observed = 0, lastChargeBand = false, lastOverdrive = false;\n const pools = {\n  takeover: ['终于轮到我了。看好了。', '交给我？那你就坐稳。', '又把控制权交给我啦？'],\n  return: ['又想自己试试？行吧，轮到你了。', '抢得真快。我还没玩够呢。', '好好好，你来。我看着。'],\n  observe: ['雨声还挺好听的。', '这条街，我已经认熟了。', '你还在看吗？我可没走神。'],\n  ready: ['嗯，核心充满了。要不要试试？', '电量刚刚好。你看见了吗？'],\n  overdrive: ['核心状态确认。让我活动一下。'],\n  recovered: ['冷却完成。刚刚的动静还不错吧？']\n };\n const cursor = Object.create(null);\n function queue(kind, clock) {\n  pending = {kind, at: clock};\n }\n function reset(clock = 0) {\n  phase = 'manual'; pending = null; lastClock = clock;\n  lastLineAt = -Infinity; nextIdleAt = clock + 9;\n  observed = 0; lastChargeBand = false; lastOverdrive = false;\n  handoffs = 0; interruptions = 0;\n  for (const key of Object.keys(cursor)) delete cursor[key];\n }\n function setEnabled(enabled, clock) {\n  const next = enabled ? 'autonomous' : 'manual';\n  if (phase === next) return;\n  phase = next;\n  if (enabled) { handoffs++; queue('takeover', clock); }\n  else { interruptions++; queue('return', clock); }\n  nextIdleAt = clock + 9;\n }\n function update(input) {\n  const clock = Number(input.clock);\n  if (!Number.isFinite(clock)) return null;\n  if (clock < lastClock) reset(clock);\n  const dt = Math.max(0, Math.min(0.1, clock - lastClock));\n  lastClock = clock;\n  setEnabled(!!input.enabled, clock);\n  if (!input.active || input.paused || input.finished) return null;\n  if (phase === 'autonomous') observed += dt;\n  const charged = Number(input.charge) >= 100 && !input.overdrive;\n  if (phase === 'autonomous') {\n   if (input.overdrive && !lastOverdrive) queue('overdrive', clock);\n   else if (!input.overdrive && lastOverdrive) queue('recovered', clock);\n   else if (charged && !lastChargeBand) queue('ready', clock);\n   else if (!pending && clock >= nextIdleAt) queue('observe', clock);\n  }\n  lastChargeBand = charged;\n  lastOverdrive = !!input.overdrive;\n  if (pending && clock - pending.at > 8) pending = null;\n  if (!input.dialogue) { pending = null; return null; }\n  if (!pending || input.busy || clock - lastLineAt < 5) return null;\n  const kind = pending.kind;\n  pending = null;\n  const pool = pools[kind];\n  const index = (cursor[kind] || 0) % pool.length;\n  cursor[kind] = index + 1;\n  lastLineAt = clock;\n  nextIdleAt = clock + 12;\n  return {kind, text: pool[index]};\n }\n function status() {\n  return {phase, handoffs, interruptions, observedSeconds: Math.round(observed * 10) / 10, pending: pending?.kind || null};\n }\n return {setEnabled, update, reset, status};\n}\n\nif (fenrirCity) {\n const shell = document.getElementById('xl-shell');\n const drawer = document.getElementById('xl-drawer');\n const closeDrawerButton = document.getElementById('xl-drawer-close');\n const pauseButton = document.getElementById('xl-pause');\n const fullscreenButton = document.getElementById('fn-full-btn');\n const toolbar = document.getElementById('xl-toolbar');\n const dock = document.getElementById('fn-dock');\n const result = document.getElementById('fn-result');\n const stageHost = document.getElementById('outcanvasd') || document.getElementById('screen');\n const portraitBot = document.getElementById('fn-portrait-bot');\n const toolsButton = document.createElement('button');\n toolsButton.id = 'fn-tools-btn';\n toolsButton.type = 'button';\n toolsButton.textContent = '工具';\n toolsButton.setAttribute('aria-controls', dock.id);\n const style = document.createElement('style');\n style.textContent = `\n#xl-toolbar #fn-dock {\n position:absolute;top:calc(100% + 6px);right:0;bottom:auto;\n width:min(268px,calc(100vw - 20px));display:grid;grid-template-columns:repeat(2,minmax(0,1fr));\n gap:5px;padding:6px;border:1px solid #476e81;border-radius:8px;background:#101e29f5;opacity:1;line-height:1.2;\n}\n#xl-toolbar #fn-dock[hidden] {display:none}\n#xl-toolbar #fn-dock button {min-height:32px;padding:4px 6px;font-size:12px;touch-action:manipulation}\n#xl-toolbar #fn-tools-btn[aria-expanded=\"true\"],#xl-toolbar #fn-auto-btn[aria-pressed=\"true\"],#xl-toolbar #fn-touch-toggle[aria-pressed=\"true\"] {border-color:#67d6ef;color:#a8f3ff}\n#fn-thumb-pad {\n position:absolute;left:10px;bottom:10px;z-index:13;display:flex;gap:6px;align-items:center;\n pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;\n}\n#fn-thumb-pad[hidden] {display:none!important}\n#fn-thumb-pad button {\n min-width:56px;min-height:42px;padding:6px 10px;border-radius:10px;\n border:1px solid #48e5ff80;background:#0a1d2cd9;color:#e8f8ff;\n font-size:12px;font-weight:700;backdrop-filter:blur(4px);box-shadow:0 3px 12px #0008;\n touch-action:none;user-select:none;-webkit-user-select:none;\n}\n#fn-thumb-pad button[data-act=\"press\"] {border-color:#ffd166a8;background:#3a2b10de;color:#ffeab8}\n#fn-thumb-pad button:active,#fn-thumb-pad button.pressed {transform:translateY(1px);filter:brightness(1.25)}\n#xl-shell.fn-portrait #fn-thumb-pad {\n position:static;order:1;width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;\n}\n#xl-shell.fn-portrait #fn-thumb-pad button {min-height:46px;font-size:13px;}\n@media (pointer:coarse) {#xl-toolbar button,#xl-toolbar #fn-dock button {min-height:44px}}\n `;\n document.head.appendChild(style);\n toolbar.insertBefore(toolsButton, document.getElementById('xl-settings'));\n toolbar.append(dock);\n\n function showTools(open, restoreFocus = false) {\n  dock.hidden = !open;\n  toolsButton.setAttribute('aria-expanded', String(open));\n  if (restoreFocus) toolsButton.focus({preventScroll: true});\n }\n showTools(false);\n toolsButton.onclick = () => showTools(dock.hidden);\n document.addEventListener('pointerdown', event => {\n  if (!dock.hidden && !dock.contains(event.target) && event.target !== toolsButton) showTools(false);\n });\n\n const controller = window.parent.AutonomousXiaolong;\n let preferences = {};\n try {\n  preferences = JSON.parse(localStorage.getItem('cunjie-stomp-impact-v1'))?.prefs || {};\n } catch {}\n const pilot = controller ? new controller({\n  enabled: false, personality: preferences.autoPersonality,\n  pace: preferences.autoPace, smart: preferences.autoSmart\n }) : null;\n const hunt = window.xlFenrirState;\n const persona = createFenrirPersona();\n function personaDialogueEnabled() {\n  try {\n   const prefs = JSON.parse(localStorage.getItem('cunjie-stomp-impact-v1'))?.prefs || {};\n   return prefs.autoDialogue !== false && prefs.autoDialogue !== 0 && prefs.autoDialogue !== 'off';\n  } catch { return preferences.autoDialogue !== false; }\n }\n function showPersonaLine(line) {\n  const bubble = document.getElementById('xl-bubble');\n  const text = document.getElementById('xl-bubble-line');\n  const label = document.getElementById('xl-bubble-context');\n  if (!line || !bubble || !text) return;\n  // Share the existing speech arbiter: gameplay, wave and result lines take priority.\n  if (hunt.speakLeft > 0 || hunt.totalClock - hunt.lastSpeakAt < 2.1) return;\n  text.textContent = line.text;\n  if (label) label.textContent = '芬里尔 · 自主意识';\n  hunt.speakLeft = 3.2;\n  hunt.speakPriority = 1;\n  hunt.lastSpeakAt = hunt.totalClock;\n  bubble.classList.add('is-speaking');\n  bubble.classList.toggle('overdrive-voice', !!hunt.overdrive);\n  bubble.setAttribute('aria-hidden', 'false');\n }\n let aimX = 0;\n let aimY = 0;\n const commands = {\n  command(kind, {x} = {}) {\n   if (kind === 'move') aimX = clamp(x, 0, w - 1);\n   else if (kind === 'up') aimY = paw_min_y / 2;\n   else if (kind === 'down') aimY = (floor_y + 20) / 2;\n   else if (kind === 'press') aimY = h - 1;\n   else if (kind === 'release') aimY = paw_y / 2;\n   return true;\n  }\n };\n const aiButton = document.createElement('button');\n aiButton.id = 'fn-auto-btn';\n aiButton.type = 'button';\n dock.prepend(aiButton);\n\n function setPilot(enabled) {\n  if (pilot?.enabled !== enabled) {\n   pilot?.setEnabled(enabled, commands);\n   if (pilot) persona.setEnabled(enabled, hunt.totalClock);\n   if (enabled && pilot) {\n    realmTouchDisown();\n    touchmode = false;\n    touchid = null;\n    mp = false;\n    aimX = paw_x;\n    aimY = paw_y / 2;\n    if (!active) {\n     moncanvas = true;\n     mr = true;\n    }\n   } else if (pilot) {\n    mx = paw_x;\n    my = paw_y / 2;\n   }\n  }\n  aiButton.textContent = enabled ? '关闭 AI [A]' : 'AI 托管 [A]';\n  aiButton.setAttribute('aria-pressed', String(enabled));\n  toolsButton.textContent = enabled ? '工具 · AI' : '工具';\n }\n aiButton.disabled = !pilot;\n setPilot(false);\n aiButton.onclick = () => setPilot(!pilot.enabled);\n if (pilot) {\n  const chooseTarget = pilot.selectTarget.bind(pilot);\n  pilot.selectTarget = (snapshot, previousX) => {\n   if (hunt.evacZone) return {x: hunt.evacZone.x, reason: 'evac', type: 'rally', progress: 0};\n   const runner = bugs.find(bug => bug?.fenrirRunner && bug.alive() && bug.x > 16 && bug.x < w - 16);\n   if (runner) return {x: clamp(runner.x + (runner.fenrirExitDir || 0) * 14, 0, w - 1), reason: 'runner', type: 'npc', progress: 0};\n   return chooseTarget(snapshot, previousX);\n  };\n\n  let lastClock = 0;\n  window.__fenrirAutopilot = () => pilot.status();\n  window.__fenrirPersona = () => persona.status();\n  let dialogueClock = -Infinity, dialogueAllowed = preferences.autoDialogue !== false;\n  const updatePaw = update_paw;\n  update_paw = function() {\n   if (pilot.enabled && active && !pause && !tr && !hunt.finished) {\n    if (hunt.totalClock < lastClock) pilot.reset();\n    lastClock = hunt.totalClock;\n    const npcs = [];\n    for (const bug of bugs) {\n     if (bug?.alive()) npcs.push({x: bug.x / w * 1000});\n    }\n    pilot.tick(delta, {\n     world: {width: w, footX: paw_x, footState: paw_state},\n     visual: {footCollisionWidth: paw.width},\n     npcs, controlled: hunt.kills\n    }, commands, {value: hunt.thrill});\n    mx = aimX;\n    my = aimY;\n    paw_follows_mouse = true;\n   }\n   const output = updatePaw.apply(this, arguments);\n   if (hunt.totalClock < dialogueClock || hunt.totalClock - dialogueClock >= 1) {\n    dialogueAllowed = personaDialogueEnabled();\n    dialogueClock = hunt.totalClock;\n   }\n   const line = persona.update({\n    clock: hunt.totalClock, enabled: pilot.enabled, active,\n    paused: pause || tr, finished: hunt.finished,\n    charge: hunt.thrill, overdrive: hunt.overdrive,\n    dialogue: dialogueAllowed,\n    busy: hunt.speakLeft > 0 || hunt.totalClock - hunt.lastSpeakAt < 2.1\n   });\n   showPersonaLine(line);\n   return output;\n  };\n }\n\n const shortcuts = {\n  KeyA: 'fn-auto-btn',\n  KeyW: 'xl-up',\n  KeyS: 'xl-down',\n  KeyD: 'xl-press',\n  KeyF: 'fn-overdrive-btn',\n  Space: 'xl-pause'\n };\n const actionIds = ['xl-up', 'xl-down', 'xl-press'];\n const focusCanvas = () => oc.focus({preventScroll: true});\n const nativeFullscreen = () => document.fullscreenElement === shell;\n const immersive = () => shell.classList.contains('xl-immersive');\n\n for (const id of actionIds) {\n  document.getElementById(id).addEventListener('click', () => {\n   // Opening the settings drawer pauses the legacy engine.\n   if (!drawer.hidden) {\n    closeDrawerButton.click();\n    if (pause && !xlRuntime.session.completed) pauseButton.click();\n   }\n   setPilot(false);\n   focusCanvas();\n  }, {capture: true});\n }\n closeDrawerButton.addEventListener('click', focusCanvas);\n oc.addEventListener('pointerdown', () => {\n  setPilot(false);\n  focusCanvas();\n });\n dock.addEventListener('click', event => {\n  if (event.target.closest('button')) {\n   showTools(false);\n   focusCanvas();\n  }\n });\n // Mobile Thumb Action Pad (Lift / Drop / Press) for comfortable phone play\n const isCoarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;\n let thumbPadPref = null;\n try {\n  const saved = localStorage.getItem('cunjie-fn-thumb-pad');\n  if (saved === '1') thumbPadPref = true;\n  else if (saved === '0') thumbPadPref = false;\n } catch {}\n let thumbPadOn = thumbPadPref !== null ? thumbPadPref : isCoarsePointer;\n const thumbPad = document.createElement('nav');\n thumbPad.id = 'fn-thumb-pad';\n thumbPad.setAttribute('aria-label', '芬里尔触屏动作控制');\n let pressHoldActive = false;\n for (const [act, label] of [['up', '抬起'], ['down', '落脚'], ['press', '施压']]) {\n  const b = document.createElement('button');\n  b.type = 'button';\n  b.dataset.act = act;\n  b.textContent = label;\n  const trigger = () => {\n   setPilot(false);\n   if (act === 'up') document.getElementById('xl-up')?.click();\n   else if (act === 'down') document.getElementById('xl-down')?.click();\n   else {\n    pressHoldActive = true;\n    b.classList.add('pressed');\n    if (typeof mp !== 'undefined') mp = true;\n    my = h - 1;\n    paw_dest_y = h;\n   }\n  };\n  b.addEventListener('pointerdown', e => {\n   if (e.cancelable) e.preventDefault();\n   e.stopPropagation();\n   if (b.setPointerCapture) try { b.setPointerCapture(e.pointerId); } catch {}\n   trigger();\n  }, {passive: false});\n  if (act === 'press') {\n   for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {\n    b.addEventListener(ev, e => {\n     e.stopPropagation();\n     if (!pressHoldActive) return;\n     pressHoldActive = false;\n     b.classList.remove('pressed');\n     if (typeof mr !== 'undefined') mr = true;\n     if (typeof mp !== 'undefined') mp = false;\n     my = paw_y / 2;\n    }, {passive: true});\n   }\n  }\n  b.addEventListener('click', e => {\n   e.stopPropagation();\n   if (e.detail === 0) trigger();\n  });\n  thumbPad.appendChild(b);\n }\n if (stageHost) stageHost.appendChild(thumbPad);\n\n const thumbToggleBtn = document.createElement('button');\n thumbToggleBtn.id = 'fn-touch-toggle';\n thumbToggleBtn.type = 'button';\n function syncThumbPad() {\n  const portrait = shell.classList.contains('fn-portrait');\n  const visible = thumbPadOn || portrait;\n  thumbPad.hidden = !visible;\n  if (portrait && portraitBot && thumbPad.parentNode !== portraitBot) {\n   portraitBot.insertBefore(thumbPad, document.getElementById('xl-bubble'));\n  } else if (!portrait && stageHost && thumbPad.parentNode !== stageHost) {\n   stageHost.appendChild(thumbPad);\n  }\n  thumbToggleBtn.textContent = '触屏按键：' + (thumbPadOn ? '开' : '关');\n  thumbToggleBtn.setAttribute('aria-pressed', String(thumbPadOn));\n }\n thumbToggleBtn.onclick = () => {\n  thumbPadOn = !thumbPadOn;\n  try { localStorage.setItem('cunjie-fn-thumb-pad', thumbPadOn ? '1' : '0'); } catch {}\n  syncThumbPad();\n };\n dock.appendChild(thumbToggleBtn);\n window.addEventListener('fn-layout-change', syncThumbPad);\n syncThumbPad();\n\n // The canvas container cancels touchend to handle drag release. Keep\n // control touches away from that handler so the browser can dispatch clicks.\n for (const controls of [dock, thumbPad, result, document.getElementById('xl-result')]) {\n  if (!controls) continue;\n  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {\n   controls.addEventListener(type, event => event.stopPropagation(), {passive: true});\n  }\n }\n\n function syncFullscreenButton() {\n  let parentFull = false;\n  try { parentFull = !!(window.parent && window.parent !== window && window.parent.document.fullscreenElement); } catch {}\n  const activeFull = nativeFullscreen() || parentFull;\n  const label = activeFull ? '退出全屏' : immersive() ? '退出铺满' : '全屏';\n  fullscreenButton.textContent = '⛶ ' + label;\n  fullscreenButton.setAttribute('aria-label', label);\n  fullscreenButton.setAttribute('aria-pressed', String(activeFull || immersive()));\n }\n\n async function toggleFullscreen() {\n  const hostEmbedded = !!(window.frameElement && window.parent && window.parent !== window);\n  if (hostEmbedded) {\n   try {\n    window.parent.postMessage({type: 'cunjie-toggle-fullscreen'}, '*');\n    setTimeout(syncFullscreenButton, 120);\n    focusCanvas();\n    return;\n   } catch {}\n  }\n  if (nativeFullscreen()) {\n   await document.exitFullscreen().catch(() => {});\n  } else if (immersive()) {\n   shell.classList.remove('xl-immersive');\n  } else {\n   try {\n    if (!document.fullscreenEnabled || !shell.requestFullscreen) {\n     shell.classList.add('xl-immersive');\n    } else {\n     // Keep the request inside the iframe's actual click or tap.\n     await shell.requestFullscreen({navigationUI: 'hide'});\n    }\n   } catch {\n    shell.classList.add('xl-immersive');\n   }\n  }\n  syncFullscreenButton();\n  focusCanvas();\n }\n\n fullscreenButton.onclick = toggleFullscreen;\n document.addEventListener('fullscreenchange', syncFullscreenButton);\n try {\n  if (window.parent && window.parent !== window) {\n   window.parent.document.addEventListener('fullscreenchange', syncFullscreenButton);\n   window.addEventListener('pagehide', () => window.parent.document.removeEventListener('fullscreenchange', syncFullscreenButton), {once: true});\n  }\n } catch {}\n syncFullscreenButton();\n\n function handleShortcut(event) {\n  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;\n  if (event.code === 'Escape') {\n   if (drawer.hidden && dock.hidden && !immersive()) return;\n   event.preventDefault();\n   event.stopImmediatePropagation();\n   if (!drawer.hidden) closeDrawerButton.click();\n   else if (!dock.hidden) showTools(false, true);\n   else void toggleFullscreen();\n   return;\n  }\n  const target = event.target;\n  if (!drawer.hidden || target?.isContentEditable || target?.closest?.('input,select,textarea,[contenteditable]')) return;\n  if (event.code === 'Space' && target?.closest?.('button,a,[role=\"button\"]')) return;\n  const id = shortcuts[event.code];\n  if (!id || !result.hidden) return;\n  event.preventDefault();\n  event.stopImmediatePropagation();\n  if (!event.repeat) {\n   document.getElementById(id).click();\n   focusCanvas();\n  }\n }\n\n window.addEventListener('keydown', handleShortcut, {capture: true});\n // Key events stay in the document that owns focus, including the host page.\n const frame = window.frameElement;\n if (frame) {\n  const host = frame.ownerDocument.defaultView;\n  function forwardShortcut(event) {\n   if (frame.isConnected && !document.hidden) handleShortcut(event);\n  }\n  host.addEventListener('keydown', forwardShortcut, {capture: true});\n  window.addEventListener('pagehide', () => host.removeEventListener('keydown', forwardShortcut, true), {once: true});\n }\n focusCanvas();\n}\n/* Runs in the legacy engine scope, just before its first animation frame. */\nif (typeof window.__installFenrirScene === 'function' && fenrirCity) {\n const maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : Infinity;\n const fenrirScene = window.__installFenrirScene({\n  spriteScaled: sprite_scaled,\n  textures,\n  w,\n  h,\n  maxTextureSize,\n  newTexture(image) {\n   if (!gl) return new_texture(image);\n   const bound = gl.getParameter(gl.TEXTURE_BINDING_2D);\n   try {\n    const texture = new_texture(image);\n    if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) {\n     gl.deleteTexture(texture.gltex);\n     throw new Error('Fenrir texture upload failed');\n    }\n    return texture;\n   } finally {\n    gl.bindTexture(gl.TEXTURE_2D, bound);\n   }\n  },\n  deleteTexture(texture) {\n   if (gl) gl.deleteTexture(texture.gltex);\n  },\n  getPawX: () => active ? paw_x : w / 2,\n  getGroundPose() {\n   if (!freeContact.grounded) return null;\n   const geometry = xlSkinGeo();\n   return {\n    grounded: true,\n    supported: !paw.steamroller && supports > 0,\n    floorY: floor_y,\n    width: paw.width,\n    offset: paw.offset,\n    frameHeight: paw.front_spr[4],\n    texture: paw.front_spr[0],\n    soleOffset: geometry.frontOffsets[3],\n    contactCenter: geometry.frontContact[3][0],\n    force: freeContact.force,\n    age: freeContact.age,\n    pressure: freeContact.pressure\n   };\n  }\n });\n sprite_scaled = fenrirScene.drawSprite;\n draw_front_paw = fenrirScene.wrapFrontFoot(draw_front_paw);\n\n const updateContact = freeContact.update;\n freeContact.update = function() {\n  const event = updateContact.apply(this, arguments);\n  fenrirScene.recordLanding(event);\n  return event;\n };\n\n const drawFloor = window.xlDrawImpactFloorPass;\n window.xlDrawImpactFloorPass = function() {\n  if (active && !pause && !tr) fenrirScene.drawRoadContact(xlFloorGfx, freeContact.clock);\n  return drawFloor.apply(this, arguments);\n };\n\n const setImpactOffset = set_yoff;\n set_yoff = function(offset) {\n  const reduced = window.__xlImmersionPrefs?.reduceMotion;\n  setImpactOffset(reduced ? 0 : offset);\n  if (reduced) {\n   oc.style.transform = '';\n   oc.style.transformOrigin = '';\n  }\n };\n}\n";
   if(source.split(anchor).length===2){
    source=source.replace(anchor,()=>bridge+anchor);
    source=source.replace('<head>','<head><script src="scripts/fenrir-scene-v1.js"></script>');
   }else{console.warn('[Fenrir scene] Bridge anchor missing; original backdrop retained.');}
  }
  return injectHttpBase(source);
 }
 const source=CunjieShoeSkin.legacy(kind==='free'?DATA.freeLegacy:DATA.storyLegacy,DATA.images.sneakers,activeShoeSkin==='qiaodan'?DATA.images.sneakersQiaodan:DATA.images.sneakersAJ6,activeShoeSkin);
 return injectHttpBase(kind==='free'?source:v59EmbeddedVisualOnly(v58EmbeddedVisualOnly(source)));
}
function paintShoePreviews(){for(const [id,skin] of [['shoePreviewAJ5','aj5'],['shoePreviewAJ6','aj6'],['shoePreviewQiaodan','qiaodan']]){const canvas=$(id),im=CunjieShoeSkin.image(images,skin);if(!canvas||!im)continue;const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(im,160,106,160,150,0,0,canvas.width,canvas.height);}}
function syncShoeSelection(){activeShoeSkin=CunjieShoeSkin.normalize(save.data.prefs.shoeSkin);if(images.sneakersAJ5)images.sneakers=CunjieShoeSkin.image(images,activeShoeSkin);for(const [id,skin] of [['shoeAJ5','aj5'],['shoeAJ6','aj6'],['shoeQiaodan','qiaodan']]){const el=$(id);if(el)el.setAttribute('aria-pressed',String(activeShoeSkin===skin));}paintShoePreviews();}
async function syncRuntimePacks(){
 if(typeof CunjieSkinPacks==='undefined'){window.__cunjieRuntimePacks={};return;}
 window.__cunjieRuntimePacks=await CunjieSkinPacks.getRuntimeOverrides();
 const activeNames=Object.values(window.__cunjieRuntimePacks).map(p=>p.name);
 const titleEl=document.querySelector('.shoe-picker-title small');
 if(titleEl)titleEl.textContent=activeNames.length?('当前已启用自定义包：'+activeNames.join(' / ')):'只更换球鞋素材，不改变关卡难度和存档';
}
function openSkinPackManager(){
 if(typeof CunjieSkinPacks==='undefined'){toast('皮肤包模块未加载');return;}
 if(mode!=='home'&&!paused)freeze();
 CunjieSkinPacks.openManager({
  panel,btn,toast,
  onChanged:async()=>{await syncRuntimePacks();syncShoeSelection();},
  onPlayCharacter:pack=>{
   window.__cunjieCustomCharPack=pack;
   const src=pack.atlasDataUrl||(pack.hdFrames&&pack.hdFrames[3])||FENRIR_MOTION_URL;
   original(src,false,true);
  },
  onClose:()=>{if(mode==='home'){$('modal').hidden=true;$('rescueBtn').hidden=true;}else resume();}
 });
}
function chooseShoe(skin){if(mode!=='home')return;if(typeof CunjieSkinPacks!=='undefined')CunjieSkinPacks.setSlotActive('shoe',null);void syncRuntimePacks();save.data.prefs.shoeSkin=CunjieShoeSkin.normalize(skin);save.save();syncShoeSelection();toast('已选 '+({aj5:'AJ5 Aqua',aj6:'AJ6 UNC',qiaodan:'乔丹青黄'}[activeShoeSkin])+' · 下一局生效');}

let shoeMotionEnabled=false;let stage=null,floorCache=null,renderer,cinematic,cinematicRenderer,cinematicUI,paused=false,backgroundPaused=false,mode='home',roster=[],lastLine='',lastControl=0,last=0,inputID=null,inputX=520,held=false,keys=new Set(),loadTicket=0,lastRejectedSweep=0,lastMissToastAt=-10000,lastStageSnapshot=null,lastSnapshotAt=-Infinity,lastHudAt=-Infinity;
function btn(text,fn,primary=false){let b=document.createElement('button');b.textContent=text;if(primary)b.className='primary';b.onclick=fn;return b;}
function toast(t){$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2800);}
function clearInput(){inputID=null;held=false;keys.clear();stage?.release?.();stage?.action?.('release');}
function syncSlowUI(){const b=$('slowBtn');if(!b)return;const v=save.data.prefs.playbackSpeed||1;b.hidden=!(mode==='story'||mode==='practice');b.textContent=`◷ ${v}× [Q]`;b.title='慢动作：点击切换 1× / 0.5× / 0.25×';b.setAttribute('aria-pressed',String(v!==1));}
function cycleSlow(){if(!['story','practice'].includes(mode)||paused)return;const p=save.data.prefs;const values=[1,0.5,0.25];p.playbackSpeed=values[(values.indexOf(p.playbackSpeed)+1)%values.length];save.save();applyPrefs();toast('游戏速度 '+p.playbackSpeed+'× · 物理/计时同步');}
function syncImmersionPrefsToFrame(){const p=save.data.prefs,f=stage?.frame||$('mount').children[0];if(f&&f.contentWindow)try{f.contentWindow.postMessage({type:'cunjie-immersion-prefs',prefs:{immersionAmbience:p.immersionAmbience!==false,immersionHaptics:p.immersionHaptics!==false,immersionHudFade:p.immersionHudFade!==false,sound:p.sound!==false,volume:p.volume,reduceMotion:!!p.reduceMotion,lowEffects:!!p.lowEffects}},'*');}catch{}}
function applyPrefs(){let p=save.data.prefs;if(typeof CunjieRenderQuality!=='undefined')CunjieRenderQuality.setMode(p.renderQuality);audio.enabled=p.sound;audio.volume=p.volume;if(!p.sound||!p.footstepFx||p.footstepVolume===0)footAudio.stop();cinematic?.audio.configure(p);autopilot.configure({personality:p.autoPersonality,pace:p.autoPace,smart:p.autoSmart,dialogue:p.autoDialogue});stage?.configure?.(p);stage?.timeScale?.(p.playbackSpeed);syncSlowUI();if(stage instanceof LegacyStage)stage.autonomy(autopilot.enabled);syncAutoUI();$('speaker').style.opacity=p.opacity;if(!p.npcVoices){tinyVoices.clear();tinyRenderer?.clear();}syncImmersionPrefsToFrame();if(p.immersionHudFade===false)$('play').classList.remove('imm-hud-faded');}
function dispose(keepFloor=false){$('play').classList.remove('custom-motion');footAudio.reset();footAudio.stop();impactFeedback.reset();lastStageSnapshot=null;lastSnapshotAt=-Infinity;cinematic?.abort();cinematicUI?.hide();autopilot.safeRelease(stage);clearInput();tinyVoices.clear();tinyRenderer?.clear();audio.stop();if(stage instanceof LegacyStage&&keepFloor){stage.pause(true);floorCache=stage;}else stage?.dispose();stage=null;if(!keepFloor){floorCache?.dispose();floorCache=null;$('mount').replaceChildren();}loadTicket++;}
function showCanvas(on){$('canvasHost').hidden=!on;$('canvasHost').classList.toggle('active',on);if(on)renderer.resize();}
function freeze(v=true){paused=v;clearInput();audio.stop();footAudio.stop();stage?.pause?.(v);if(v)cinematic?.pause();else cinematic?.resume();$('pauseBtn').textContent=v?'继续':'暂停';
 if(v&&manager.status!=='home'&&manager.status!=='complete'&&manager.status!=='failed')v58SetUIState('paused');
 else if(!v)v58SetUIState(manager.status==='cutscene'?'cinematic':'playing');
}
function panel(title,body,actions=[]){$('modal').hidden=false;$('modal').dataset.v581Kind=(manager.status==='complete'||manager.status==='failed')?'result':'panel';$('rescueBtn').hidden=false;$('rescueBtn').textContent=['failed','complete'].includes(manager.status)?'↩ 返回标题':mode==='home'?'↩ 关闭面板':'↩ 恢复游戏';$('modalTitle').textContent=title;$('modalBody').replaceChildren();if(typeof body==='string')$('modalBody').innerHTML=body;else $('modalBody').append(body);const stats=$('modalBody').querySelector('table');if(stats&&$('modal').dataset.v581Kind==='result'){const details=document.createElement('details');details.className='v581-stats';const summary=document.createElement('summary');summary.textContent='展开分幕统计';stats.replaceWith(details);details.append(summary,stats);}$('modalActions').replaceChildren(...actions);}
function resume(){if(document.hidden)return;if(['failed','complete'].includes(manager.status)){home();return;}backgroundPaused=false;$('modal').hidden=true;$('rescueBtn').hidden=true;freeze(false);audio.unlock();applyPrefs();}
function home(){backgroundPaused=false;freeze();dispose();mode='home';v58SetUIState('home');$('cgPause').hidden=true;syncShoeSelection();$('rescueBtn').hidden=true;syncAutoUI();manager.status='home';$('home').hidden=false;$('play').hidden=true;$('modal').hidden=true;}
function syncAutoUI(){const eligible=(mode==='story'||mode==='practice');const on=eligible&&autopilot.enabled;syncSlowUI();
 $('play').classList.toggle('autonomous',on);$('play').classList.toggle('observing',eligible&&save.data.prefs.autoObserve);
 $('autoBtn').hidden=!eligible;$('observeBtn').hidden=!eligible;
 $('autoBtn').textContent=on?'◉ 托管 ON [A]':'◎ 手动模式 [A]';$('autoBtn').setAttribute('aria-pressed',String(on));
 $('observeBtn').textContent=save.data.prefs.autoObserve?'◫ 退出观察 [O]':'◫ 观察 [O]';$('observeBtn').setAttribute('aria-pressed',String(!!save.data.prefs.autoObserve));
}
function setAutoplay(value,notify=true){if(!(mode==='story'||mode==='practice'))return;autopilot.setEnabled(value,stage);save.data.prefs.autoEnabled=!!value;save.save();stage?.autonomy?.(!!value);syncAutoUI();if(notify)toast(value?'宵泷已接管操作 · A键切换':'已切换手动控制 · 可随时恢复托管');}
function toggleObserve(){if(!(mode==='story'||mode==='practice'))return;save.data.prefs.autoObserve=!save.data.prefs.autoObserve;save.save();syncAutoUI();}
const AUTO_LINES={
 'hidden-trail':['……这儿有小东西在动。','钻进缝里还乱扭？这点小动静早把你们卖了。'],
 'hit':['哟，刚好踩个正着。','换块地接着遛遛看。','这下倒干脆利索。'],
 'reveal':['呵，原来看起来空空的，全缩这儿。','遮不住啦，痕迹早露出来了。'],
 'rally-clear':['好，这处据点清净下来了。','换个边角继续晃晃看。'],
 'objective-hit':['可算摸到你们最后藏身的死角了。'],
 'miss':['咦，擦边滑出去了？换个角度再来。','刚走神看别处，落点偏了点。'],
 'burst':['……行，热身到此为止，全盘收场。'],
 'objective':['先去盯紧那边正集合的几只。'],
 'npc-help':['还会傻乎乎跑回去扶同伴？有点好玩。','前面那个停脚伸手拽人呢，真不慌啊。'],
 'npc-rescue':['哟呵，还真配合着拖出阴影了。','……那组居然真逃过去一个。'],
 'npc-signal':['听见了吧？最前头那个在瞎喊报方向呢。']
};
let autoSpeechCount=0,lastSocialSerial=0;
function autoSpeak(events){if(!autopilot.dialogue||!autopilot.enabled)return;for(const e of events){let lines=AUTO_LINES[e.kind];if(!lines)continue;
 if(e.priority<4&&autopilot.elapsed-autopilot.lastSpoken<10)continue;
 if(dialogue.current&&dialogue.current.priority>=70)continue;
 const text=lines[(autoSpeechCount++)%lines.length];autopilot.lastSpoken=autopilot.elapsed;dialogue.show(text,e.priority>=3?60:39,'auto-'+e.kind);break;
}}
function burst(){if(manager.status!=='playing'||manager.stage!==2||paused)return;
 const snap=stage?.snapshot?.()||{};
 if((snap.rallyCleared||0)<3){toast('先瓦解三个集结点');return;}
 if(fever.value<70){toast('狂热值需达到 70');return;}
 if(snap.burstUsed)return;
 if(stage?.action?.('burst')&&fever.activateBurst()){audio.play('stompboom2.ogg',.5,true);dialogue.show('行，光脚了——现在可没人替你们挡风。',85,'burst');}
}
function stageSpeech(){dialogue.event(nextSpeech,90);nextSpeech='enter';}
async function loadStage(index){v58SetUIState('loading');$('cgPause').hidden=true;dispose(false);const ticket=loadTicket;practiceDrills.reset(index);autopilot.reset(index);autopilot.enabled=save.data.prefs.autoEnabled;autoSpeechCount=0;lastLine='';lastControl=0;lastGiantSerial=-1;lastReactive={};lastSocialSerial=0;lastRejectedSweep=0;lastMissToastAt=-10000;paused=false;backgroundPaused=false;$('rescueBtn').hidden=true;$('pauseBtn').textContent='暂停';dialogue.resetStage(index);tinyVoices.reset(index);fever.setStage(index);renderer.sockPose=null;renderer.oldPose=null;$('play').hidden=false;$('home').hidden=true;$('modal').hidden=true;$('hud').hidden=false;$('speaker').hidden=false;$('pauseBtn').hidden=false;$('settingsBtn').hidden=false;$('skip').hidden=true;$('cutCaption').textContent='';$('burstBtn').hidden=index!==2;$('burstBtn').disabled=true;$('hint').textContent='正在载入互动场景资源…';
 try{await Promise.all([index>=1?ensureDeferredImages().catch(()=>{}):Promise.resolve(),ensureStoryLegacy()]);}catch(e){if(ticket===loadTicket){freeze();panel('场景资源加载失败','无法载入核心场景脚本：'+(e?.message||e),[btn('重试本幕',()=>loadStage(index),true),btn('返回',home)]);}return;}
 if(ticket!==loadTicket||mode==='home'||mode==='original')return;
 $('hint').textContent=index===1?'地毯追踪：浅色痕迹表示藏匿者；原地蓄压与接地横扫分别搜寻；蓄满后松开可再次触发':(index===2?'据点：床脚稳压／地毯蓄力脉冲／通道定点横扫；清除后 F 爆发有30点狂热代价':'球鞋：抬起时预览落点，尝试连续有效落脚；空踩额外耗体力 · W/S/D 操作');
 {showCanvas(false);if(floorCache?.bridge){stage=floorCache;floorCache=null;stage.bridge.setup(index,roster);stage.shoeMotion(shoeMotionEnabled);applyPrefs();manager.ready();v58SetUIState('playing');stageSpeech();return;}floorCache?.dispose();floorCache=null;stage=new LegacyStage($('mount'),legacySource('story'),index,roster,()=>{if(ticket!==loadTicket)return;stage.shoeMotion(shoeMotionEnabled);applyPrefs();manager.ready();v58SetUIState('playing');stageSpeech();});setTimeout(()=>{if(ticket===loadTicket&&manager.status==='loading'){freeze();panel('图像引擎未能启动','此设备未完成 WebGL 初始化。请用支持 WebGL 的浏览器直接打开 HTML。',[btn('重试本幕',()=>loadStage(index),true),btn('返回',home)]);}},15000);}
 applyPrefs();}
const manager=new StageManager(DATA.stages,save,{load:loadStage,freeze:()=>{tinyVoices.clear();tinyRenderer?.clear();stage?.pause?.(true);clearInput();audio.stop();footAudio.stop();},cutscene:async (index,context)=>{roster=stage?.survivors?.()||[];autopilot.safeRelease(stage);stage?.pause?.(true);showCanvas(true);dialogue.current=null;dialogue.event('transition',95);$('cgPause').hidden=false;$('cgPause').textContent='Ⅱ 暂停过场';$('skip').hidden=!save.data.seen.includes(index);$('hint').textContent='正在加载过场动画资源…';v58SetUIState('cinematic');try{await ensureCinematics();if(manager.status!=='cutscene')return;cinematicUI?.show();$('hint').textContent='过场期间已暂停物理与计时';cinematic?.begin(index,{...context,rosterCount:roster.length,autopilotEnabled:autopilot.enabled,shoeVariant:activeShoeSkin});}catch(e){toast('过场资源加载失败，已跳过：'+(e?.message||e));manager.skip();}},updateCutscene:dt=>cinematic?.tick(dt)===true,cutsceneElapsed:()=>((cinematic?.elapsedMs||0)/1000),result:won=>{v58SetUIState('result');$('cgPause').hidden=true;tinyVoices.clear();tinyRenderer?.clear();dialogue.current=null;dialogue.event(won?manager.summary().rank:'fail',100);const r=manager.summary();save.record(r);freeze();let body='<p>'+(won?({'S':'完全掌控','A':'游刃有余','B':'意外频发'}[r.rank]):'本幕目标未完成。可从当前阶段重试，已完成阶段得分保留。')+'</p><p>总分 '+r.score+' · 控制 '+r.controlled+' · 逃离 '+r.escapes+' · 最高连击 '+r.combo+' · 失败 '+r.failures+'</p><table><tr><th>幕</th><th>得分</th><th>控制 / 逃离</th><th>评级</th></tr>'+r.stages.map(s=>'<tr><td>'+(s.stage+1)+'</td><td>'+s.score+'</td><td>'+s.controlled+' / '+s.escapes+'</td><td>'+s.rank+'</td></tr>').join('')+'</table>'+(r.failedStage?'<p>当前幕：控制 '+r.failedStage.controlled+' · 逃离 '+r.failedStage.escapes+' · 得分 '+r.failedStage.score+'</p>':'')+'<p>'+dialogue.current.text+'</p>';panel(won?'三重领域 · '+r.rank:'第 '+(manager.stage+1)+' 幕挑战失败',body,won?[btn('再挑战一次',startStory,true),btn('自由场景',practice),btn('回到标题',home)]:[btn('重试本幕',()=>{paused=false;nextSpeech='retry';manager.retry();},true),btn('回到标题',home)]);}});
function startStory(){backgroundPaused=false;$('rescueBtn').hidden=true;fever.value=8;fever.peak=8;mode='story';roster=[];paused=false;audio.unlock();void ensureCinematics();manager.start();}
async function importCustomMotion(event){
 const input=event.currentTarget,file=input.files[0];
 input.value='';
 if(!file)return;
 const button=$('customMotionBtn');
 if(button)button.disabled=true;
 try{
  const signature=new Uint8Array(await file.slice(0,8).arrayBuffer());
  if(signature.join(',')!=='137,80,78,71,13,10,26,10')throw Error('请选择 PNG 图集');
  const url=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(Error('无法读取角色图集'));
   reader.readAsDataURL(new Blob([file],{type:'image/png'}));
  });
  await new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>{if(img.naturalWidth===1024&&img.naturalHeight===1024)resolve();else reject(Error('角色图集需要 1024 × 1024 像素'));};
   img.onerror=()=>reject(Error('无法解析角色图集'));
   img.src=url;
  });
  if(mode==='home')original(url,false);
 }catch(e){toast(e.message||'角色图集导入失败');}
 finally{if(button)button.disabled=false;}
}
async function original(motionAtlas='',isFenrir=false,keepCharPack=false){const custom=typeof motionAtlas==='string'&&motionAtlas.length>0;if(!keepCharPack)window.__cunjieCustomCharPack=null;dispose();$('play').classList.toggle('custom-motion',custom);mode='original';v58SetUIState('playing');syncSlowUI();backgroundPaused=false;$('rescueBtn').hidden=true;syncAutoUI();$('home').hidden=true;$('play').hidden=false;$('modal').hidden=true;$('hud').hidden=true;$('speaker').hidden=true;$('pauseBtn').hidden=true;$('settingsBtn').hidden=true;$('skip').hidden=true;$('hint').textContent=custom?(isFenrir?'正在载入芬里尔 · 雨后城市…':'正在载入自定义角色图集…'):'正在载入原版模式资源…';showCanvas(false);const ticket=loadTicket;try{await ensureFreeLegacy();}catch(e){if(mode==='original'&&ticket===loadTicket){panel('原版模式加载失败','无法载入原版脚本：'+(e?.message||e),[btn('重试',()=>original(custom?motionAtlas:'',isFenrir,keepCharPack),true),btn('返回标题',home)]);}return;}if(mode!=='original'||ticket!==loadTicket)return;$('hint').textContent=custom?(isFenrir?'芬里尔 · 雨后城市自由模式 · 通过右上角返回':'自定义角色 · 自由模式 · 通过右上角返回'):'原版模式 · 通过设置返回（主线进度独立）';let f=document.createElement('iframe');f.title=custom?(isFenrir?'芬里尔 · 雨后城市':'自定义角色 · 自由模式'):'原 Stompgame 自由与挑战';f.allow='autoplay; fullscreen';f.srcdoc=legacySource('free',custom?motionAtlas:'',custom&&isFenrir);$('mount').replaceChildren(f);}
function practice(){freeze();let body=document.createElement('div');let p=document.createElement('p');p.textContent='无倒计时结算，练习已解锁场景。剧情挑战的正式顺序不变。';body.append(p);for(let i of save.data.unlocked)body.append(btn(DATA.stages[i].title,()=>{audio.unlock();mode='practice';roster=[];paused=false;manager.start(true,i);},true));panel('自由场景选择',body,[btn('原版自由 / 换装',()=>original()),btn('标题',home)]);}
function records(){freeze();let box=document.createElement('div'),p=document.createElement('p');p.textContent='最高分 '+save.data.best+' · 已解锁 '+save.data.unlocked.length+'/3 · 成就 '+save.data.achievements.join(' / ');box.append(p);let list=document.createElement('div');list.className='record-list';for(let r of save.data.records){let p=document.createElement('p');p.textContent=r.date.slice(0,16)+' · '+r.rank+' · '+r.score+' 分 · 失败 '+r.failures;list.append(p);}box.append(list);panel('成绩与成就',box,[btn('已看过场',v581Library),btn(mode==='home'?'关闭':'返回游戏',()=>{if(mode==='home'){$('modal').hidden=true;$('rescueBtn').hidden=true;}else resume();})]);}
function settings(){let wasHome=mode==='home';freeze();let box=document.createElement('div');let shoeInfo=document.createElement('p');const shoeLabel={aj5:'AJ5 Aqua',aj6:'AJ6 UNC 北卡蓝',qiaodan:'乔丹 青黄'}[activeShoeSkin]||'AJ5 Aqua';shoeInfo.textContent='第一幕球鞋：'+shoeLabel+'（返回标题页可切换；当前游戏不中途换鞋）';box.append(shoeInfo);const controls=document.createElement('div');controls.className='settings-actions';for(let[a,t]of[['up','抬起'],['down','落脚'],['press','施压']])controls.append(btn(t,()=>{if(autopilot.enabled)setAutoplay(false,false);resume();stage?.action?.(a);}));controls.append(btn('对白记录',log),btn('重开当前幕',()=>{paused=false;manager.restart();}),btn('返回标题',home));if(!wasHome)box.append(controls);
 function check(text,key){let label=document.createElement('label'),input=document.createElement('input');label.textContent=text;input.type='checkbox';input.checked=save.data.prefs[key];input.onchange=()=>{save.data.prefs[key]=input.checked;save.save();if(key==='autoEnabled'&&(mode==='story'||mode==='practice'))setAutoplay(input.checked,false);applyPrefs();};label.append(input);box.append(label);}
 check('碰撞调试叠层（默认关闭）','debugOverlay');check('过场字幕','cinematicCaptions');check('2D 接地反馈特效','impactFx');check('原版粘附拉丝／黑色胶液痕迹','gooFx');check('强化踩中后的鞋底残留／地面痕迹','aftermathFx');check('AJ6 F1/F2 动态残留与拉丝','soleResidueFx');check('显示练习目标与操作提示','trainingGuide');
 check('托管默认开启（主线与练习）','autoEnabled');check('自主分析 NPC 位置和藏匿状态','autoSmart');check('托管行为触发宵泷对白','autoDialogue');check('观察模式（隐藏部分 HUD）','autoObserve');
 for(const [key,label,options] of [['renderQuality','游戏画面清晰度',[['auto','自动（最高 1080p）'],['hd','1080p · 1800×1080'],['qhd','2K · 2400×1440'],['classic','经典像素']]],['autoPersonality','宵泷行动性格',[['adaptive','自适应：随狂热变化'],['calm','慵懒'],['hunter','猎手'],['frenzy','狂热']]],['autoPace','自主行动节奏',[['slow','悠闲'],['normal','正常'],['fast','激进']]],['adhesionLevel','抬脚粘滞程度',[['soft','轻微'],['classic','经典原版'],['strong','更强阻力']]],['aftermathLevel','后续反馈强度',[['subtle','轻量（手机省电）'],['balanced','均衡'],['cinematic','强化（推荐）']]],['playbackSpeed','游戏运行速度',[[1,'1× 正常'],[0.5,'0.5× 慢动作'],[0.25,'0.25× 电影慢动作']]]]){
  const row=document.createElement('label'),select=document.createElement('select');row.textContent=label;
  for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)}
  select.value=save.data.prefs[key];select.onchange=()=>{save.data.prefs[key]=key==='playbackSpeed'?Number(select.value):select.value;save.save();applyPrefs();};row.append(select);box.append(row);
 }
check('气泡显示','bubbles');check('声音','sound');check('脚步物理音效 v5.5','footstepFx');check('动态环境音景（雨声/夜风/悬停闷音）','immersionAmbience');check('画面震动','shake');check('手机震动触觉反馈','immersionHaptics');check('操作态 HUD 自动淡出','immersionHudFade');check('减少镜头震动','reduceMotion');check('降低强烈视觉特效','lowEffects');check('微型 NPC 短气泡','npcVoices');let frequencyLabel=document.createElement('label'),frequency=document.createElement('select');frequencyLabel.textContent='NPC 喊话频率';for(let [value,text]of[[.5,'稀疏'],[1,'标准'],[1.5,'较多']]){let option=document.createElement('option');option.value=value;option.textContent=text;frequency.append(option);}frequency.value=save.data.prefs.npcFrequency;frequency.onchange=()=>{save.data.prefs.npcFrequency=Number(frequency.value);save.save();};frequencyLabel.append(frequency);box.append(frequencyLabel);for(let[key,text,min]of[['opacity','气泡透明度',.3],['volume','主音量',0]]){let label=document.createElement('label'),input=document.createElement('input');label.textContent=text;input.type='range';input.min=min;input.max=1;input.step=.05;input.value=save.data.prefs[key];input.oninput=()=>{save.data.prefs[key]=Number(input.value);save.save();applyPrefs();};label.append(input);box.append(label);}
 let sfxLabel=document.createElement('label'),sfxRange=document.createElement('input');sfxLabel.textContent='脚步层音量（叠加原有游戏音效）';sfxRange.type='range';sfxRange.min=0;sfxRange.max=1;sfxRange.step=.05;sfxRange.value=save.data.prefs.footstepVolume;sfxRange.oninput=()=>{save.data.prefs.footstepVolume=Number(sfxRange.value);save.save();};sfxLabel.append(sfxRange);box.append(sfxLabel);box.append(btn('试听 AJ5',async()=>{await audio.unlock();applyPrefs();footAudio.audition('aj5',save.data.prefs);}),btn('试听 AJ6',async()=>{await audio.unlock();applyPrefs();footAudio.audition('aj6',save.data.prefs);}));
 let file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.className='file-input';file.onchange=async()=>{if(!file.files[0])return;try{save.import(await file.files[0].text());applyPrefs();toast('导入成功');}catch(e){toast(e.message);}};box.append(file);v581GroupSettings(box);panel('设置与操作',box,[btn('导出 JSON',()=>{let b=new Blob([save.export()],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='Cunjie_ThreeRealms_v41.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}),btn('成绩',records),btn(wasHome?'关闭':'继续',()=>{if(wasHome){$('modal').hidden=true;$('rescueBtn').hidden=true;}else resume();},true)]);}
function log(){let box=document.createElement('div');let title=document.createElement('p');title.textContent='宵泷 / 匿名小人 · 最近事件';box.append(title);for(let x of tinyVoices.log){let p=document.createElement('p');p.textContent='小人 · 第 '+(x.stage+1)+' 幕 · '+x.time+'s　'+x.text;box.append(p);}for(let x of dialogue.log){let p=document.createElement('p');p.textContent='第 '+(x.stage+1)+' 幕 · '+x.time+'s　'+x.text;box.append(p);}panel('对白记录',box,[btn('返回设置',settings),btn('继续',resume,true)]);}
function pauseMenu(){if(mode==='home'||mode==='original')return;
 if(paused&&!$('modal').hidden)return;freeze();panel('已暂停','物理、过场和挑战计时均已暂停。',[btn('继续',resume,true),btn('设置',settings),btn('重开本幕',v581ConfirmRestart),btn('返回标题',home)]);
}
function suspendForBackground(){
 clearInput();if(mode!=='story'&&mode!=='practice')return;
 if(!['playing','cutscene'].includes(manager.status)||paused)return;
 backgroundPaused=true;freeze(true); // do not create a click-blocking modal while hidden
}
function foregroundRecovery(){
 if(document.hidden||!backgroundPaused)return; backgroundPaused=false;
 if((mode==='story'||mode==='practice')&&['playing','cutscene'].includes(manager.status)){
  panel('已安全暂停','切出游戏后操作已释放；点击“继续”恢复当前阶段，不会重开计时。',[btn('继续',resume,true),btn('设置',settings),btn('返回标题',home)]);
 }
}
$('shoeAJ5').onclick=()=>chooseShoe('aj5');$('shoeAJ6').onclick=()=>chooseShoe('aj6');if($('shoeQiaodan'))$('shoeQiaodan').onclick=()=>chooseShoe('qiaodan');
$('rescueBtn').onclick=()=>{if(mode==='home'){$('modal').hidden=true;$('rescueBtn').hidden=true;}else if(['failed','complete'].includes(manager.status))home();else resume();};
$('play').addEventListener('touchmove',e=>{if(e.cancelable)e.preventDefault();},{capture:true,passive:false});
window.addEventListener('pointercancel',clearInput,{passive:true});
window.addEventListener('touchcancel',clearInput,{passive:true});

$('closeModal').onclick=()=>{if(mode==='home'){$('modal').hidden=true;$('rescueBtn').hidden=true;}else if(['failed','complete'].includes(manager.status))home();else resume();};$('storyBtn').onclick=startStory;$('freeBtn').onclick=()=>original();if($('fenrirBtn'))$('fenrirBtn').onclick=()=>original(FENRIR_MOTION_URL,true);if($('customMotionBtn'))$('customMotionBtn').onclick=()=>$('customMotionFile')?.click();if($('customMotionFile'))$('customMotionFile').onchange=importCustomMotion;if($('skinPackBtn'))$('skinPackBtn').onclick=openSkinPackManager;$('practiceBtn').onclick=practice;$('recordsBtn').onclick=records;$('settingsHome').onclick=settings;$('settingsBtn').onclick=settings;$('pauseBtn').onclick=()=>paused?resume():pauseMenu();$('cgPause').onclick=()=>{if(manager.status!=='cutscene')return;freeze(!paused);$('cgPause').textContent=paused?'▶ 继续过场':'Ⅱ 暂停过场';};$('skip').onclick=()=>manager.skip();$('burstBtn').onclick=burst;$('autoBtn').onclick=()=>setAutoplay(!autopilot.enabled);$('observeBtn').onclick=toggleObserve;$('slowBtn').onclick=cycleSlow;
function syncFullscreenButton(){const on=!!document.fullscreenElement;const b=$('fullBtn');b.textContent=on?'⛶ 退出全屏':'⛶ 全屏';b.setAttribute('aria-label',on?'退出全屏':'进入全屏');b.title=on?'退出全屏':'进入全屏';}
$('fullBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('app').requestFullscreen)await $('app').requestFullscreen({navigationUI:'hide'});else toast('已使用整页沉浸布局');}catch{toast('浏览器限制原生全屏，已铺满当前视口');}syncFullscreenButton();renderer.resize();if(!paused&&manager.status==='playing'&&!document.hidden)stage?.pause?.(false);};
const canvas=$('world');function pos(e){let r=canvas.getBoundingClientRect();return (e.clientX-r.left)/r.width*1000;}
window.addEventListener('keydown',e=>{if(mode==='home'||mode==='original')return;if(e.key==='Escape'||e.code==='Space'){e.preventDefault();if(paused)resume();else pauseMenu();return;}if(!paused&&(mode==='story'||mode==='practice')&&e.code==='KeyQ'){e.preventDefault();if(!e.repeat)cycleSlow();return;}if(!paused&&(mode==='story'||mode==='practice')&&e.code==='KeyA'){e.preventDefault();if(!e.repeat)setAutoplay(!autopilot.enabled);return;}if(!paused&&(mode==='story'||mode==='practice')&&e.code==='KeyO'){e.preventDefault();if(!e.repeat)toggleObserve();return;}if(!paused&&manager.stage===2&&e.code==='KeyF'){e.preventDefault();burst();return;}if(!paused&&stage instanceof LegacyStage&&['KeyW','KeyS','KeyD'].includes(e.code)){if(!e.repeat){if(autopilot.enabled)setAutoplay(false,false);stage.command?.(({KeyW:'up',KeyS:'down',KeyD:'press'})[e.code],{source:'host-keyboard'});}e.preventDefault();return;}});window.addEventListener('keyup',e=>{if(e.code==='KeyD'&&stage instanceof LegacyStage)stage.command?.('release',{source:'host-keyboard'});});
window.addEventListener('message',e=>{const f=$('mount').children[0];if(!f||e.source!==f.contentWindow)return;if(e.data?.type==='cunjie-giant-home')home();if(e.data?.type==='cunjie-toggle-fullscreen')$('fullBtn')?.click();if(e.data?.type==='realm-pause')pauseMenu();if(e.data?.type==='realm-auto-hotkey'&&!paused&&(mode==='story'||mode==='practice')){if(e.data.code==='KeyA')setAutoplay(!autopilot.enabled);if(e.data.code==='KeyO')toggleObserve();}if(e.data?.type==='realm-takeover'&&!paused&&autopilot.enabled&&stage instanceof LegacyStage){setAutoplay(false,false);const command=({KeyW:'up',KeyS:'down',KeyD:'press'})[e.data.code];if(command)stage.command(command,{source:'host-keyboard'});}});
let immHostHudWakeAt=0;
function immWakeHostHud(ms=3600){immHostHudWakeAt=performance.now()+ms;$('play')?.classList.remove('imm-hud-faded');}
for(const id of ['hud','quick','v56Menu']){const el=$(id);if(el){el.addEventListener('pointerdown',()=>immWakeHostHud(4200),{passive:true});el.addEventListener('pointerenter',()=>immWakeHostHud(4200),{passive:true});}}
setInterval(()=>{const play=$('play');if(!play)return;const canFade=(mode==='story'||mode==='practice')&&!paused&&manager.status==='playing'&&$('modal').hidden&&!v56MenuOpen&&save.data.prefs.immersionHudFade!==false&&performance.now()>immHostHudWakeAt;play.classList.toggle('imm-hud-faded',canFade);},450);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendForBackground();else foregroundRecovery();});
window.addEventListener('blur',()=>{
 clearInput();
 // Android touch focus can move into the game iframe. That is not a real app pause.
 if(document.activeElement?.tagName==='IFRAME')return;
 if(document.hidden)suspendForBackground(); // focus alone is not a lifecycle transition on Android
});
window.addEventListener('focus',foregroundRecovery);
window.addEventListener('pagehide',suspendForBackground);
window.addEventListener('pageshow',foregroundRecovery);window.addEventListener('resize',()=>renderer?.resize());document.addEventListener('fullscreenchange',()=>{syncFullscreenButton();renderer?.resize();});
function frame(now){v56MonitorFrame(now);const realDt=Math.min(.05,(now-last)/1000||0);last=now;const dt=realDt*(save.data.prefs.playbackSpeed||1);if((mode==='story'||mode==='practice')&&stage){if(!paused){if(manager.status==='playing'){
 if(!lastStageSnapshot||now-lastSnapshotAt>=(v56Perf.fps>0&&v56Perf.fps<43?50:33)){
  lastStageSnapshot=v56Snapshot();lastSnapshotAt=now;
 }let s=lastStageSnapshot;const previousMood=fever.snapshot();
 if(stage instanceof LegacyStage&&autopilot.enabled&&(mode==='story'||mode==='practice')){
  autopilot.tick(dt,s,stage,previousMood);
  if(manager.stage===2&&s.rallyCleared===3&&!s.burstUsed&&previousMood.value>=70)burst();
  autoSpeak(autopilot.drainEvents());
 }
 fever.update(dt,s);const mood=fever.snapshot();stage.setMood?.({...mood,reduceMotion:save.data.prefs.reduceMotion,lowEffects:save.data.prefs.lowEffects});for(const line of fever.pending.splice(0)){dialogue.show(line.text,line.priority,'fever-'+line.event);if(line.event==='laugh')audio.chuckle();}tinyVoices.update(dt,s.npcs||[],manager.stage,save.data.prefs.npcVoices?save.data.prefs.npcFrequency:0);
 // The giant reacts to verified world events, not random fabricated exchanges.
 for(const e of s.socialEvents||[]){if(e.seq<=lastSocialSerial)continue;lastSocialSerial=e.seq;
  if(autopilot.enabled&&autopilot.dialogue&&['help','rescue','signal'].includes(e.kind))autopilot.emit('npc-'+e.kind,String(e.id),e.kind==='rescue'?3:1);
  if(e.kind==='rescue')dialogue.react('rescue');else if(e.kind==='help')dialogue.react('help');else if(e.kind==='signal')dialogue.react('signal');
 }
 // Sparse but scene-grounded giant commentary: no fabricated NPC events.
 const prev=lastReactive,near=(s.npcs||[]).filter(n=>n.danger>.48).length;
 let reaction=null;
 if((s.rallyCleared||0)>(prev.rallies||0)&&manager.stage===2)reaction='rally';
 else if((s.tactics?.misses||0)>(prev.misses||0))reaction='miss';
 else if((s.controlled||0)>(prev.controlled||0)+2)reaction='crowd';
 else if(s.pressure>.58&&(!prev.pressure||prev.pressure<.25))reaction='pressure';
 else if((s.npcs||[]).some(n=>n.event==='evade')&&Math.random()<.014)reaction='evade';
 else if((s.hiddenCount||0)>=6&&Math.random()<.009)reaction='observe';
 else if(near>=8&&Math.random()<.009)reaction='crowd';
 else if(Math.random()<.0017)reaction='observe';
 if(mood.special==='silence')reaction='silence';
 if(reaction)dialogue.react(reaction);
 lastReactive={rallies:s.rallyCleared||0,misses:s.tactics?.misses||0,controlled:s.controlled||0,pressure:s.pressure||0};for(const response of tinyVoices.responses.splice(0)){if(!dialogue.current){let bank=DATA.responses[response]||DATA.responses.plead;dialogue.show(bank[Math.floor(tinyVoices.serial/2)%bank.length],32,'tiny-reply');}}if(manager.stage===2&&s.controlled>lastControl){dialogue.event('contact',35);lastControl=s.controlled;}if(!s.active||(!s.paused&&!s.transitioning))manager.update(dt,s);
 if(manager.stage!==1&&stage.bridge){let line=stage.bridge.line();if(line&&line.text!==lastLine){lastLine=line.text;dialogue.show(line.text,25);}}
 }else if(manager.status==='cutscene')manager.update(dt,{});dialogue.update(dt);}
 if(manager.status==='cutscene'){const cs=cinematic?.getSnapshot()||{};const frameState=cs.state==='playing'||cs.state==='paused'?cinematic.frame(save.data.prefs.reduceMotion):null;if(frameState&&cinematic?.loader.get(frameState.layers[0]?.asset))cinematicRenderer.render(frameState,save.data.prefs);else renderer.cutscene(manager.stage,cs.state==='fallback'?Math.min(8,cs.elapsedMs/1000):0,roster);cinematicUI?.update(cs,frameState,save.data.prefs);}
 
 if(manager.status==='playing'&&lastStageSnapshot){impactFeedback.observe(now,manager.stage,lastStageSnapshot,save.data.prefs);if(!lastStageSnapshot.contactFeel&&!lastStageSnapshot.aftermath?.impact) footAudio.observe(manager.stage,lastStageSnapshot,activeShoeSkin,save.data.prefs);}
 impactFeedback.draw(now);
 if(now-lastHudAt<65){requestAnimationFrame(frame);return;}lastHudAt=now;
 let c=DATA.stages[manager.stage],s=lastStageSnapshot||stage.snapshot();
 const practiceLine=$('practiceLine');practiceLine.hidden=true;
 if(manager.status==='playing'&&manager.practice&&save.data.prefs.trainingGuide){
  const drill=practiceDrills.update(manager.stage,s);
  practiceLine.hidden=false;practiceLine.textContent=(drill.complete?'✓ 已完成 · ':'练习目标 · ')+drill.title+' | '+PracticeDrills.describe(drill);
  if(drill.newlyCompleted)toast('练习目标达成：'+drill.title);
  $('hint').textContent=drill.complete?'训练已完成，可继续自由探索或从设置重开':drill.tip;
 }else if(manager.status==='playing'&&save.data.prefs.trainingGuide){
  const t=s.tactics||{};
  if(manager.stage===0&&t.landings>=3&&t.accuracy<.35)$('hint').textContent='命中率偏低：先抬起观察落点，再调整位置；空踩会额外消耗体力';
  else if(manager.stage===1&&s.hiddenCount>=4&&t.validKneads===0)$('hint').textContent='藏匿目标较多：观察地毯痕迹，试试原地蓄压';
  else if(manager.stage===2&&s.rallyCleared===3&&!s.burstUsed)$('hint').textContent='三个据点已处理：狂热≥70时可使用 F 发动爆发';
 }
 if(manager.status==='playing'){if(manager.stage===2){
  if((s.sweepRejected||0)>lastRejectedSweep){lastRejectedSweep=s.sweepRejected;if(now-lastMissToastAt>2500){toast('横扫未经过撤离通道，不计入据点进度');lastMissToastAt=now;}}
  else lastRejectedSweep=s.sweepRejected||0;
 }let r=s.viewport||canvas.getBoundingClientRect();tinyRenderer.render(tinyVoices.snapshot(),r,save.data.prefs.opacity,{hotspot:s.world?{x:(s.world.footX/Math.max(1,s.world.width))*r.width,y:((s.world.floorY??s.world.height*.87)/Math.max(1,s.world.height))*r.height}:null});}else tinyRenderer.clear();$('autopilotStatus').textContent=(stage instanceof LegacyStage&&(mode==='story'||mode==='practice'))?(autopilot.enabled?'AI 托管 · '+({'survey':'观察','approach':'定位','descend':'落脚','press':'施压','sweep':'横扫','recover':'调整'})[autopilot.mode]+' · '+(autopilot.target?.reason||'搜索'):'手动操控'):' ';$('stageTitle').textContent='第 '+(manager.stage+1)+' 幕 · '+(manager.stage===0?roomStageTitle():c.title)+'　'+(manager.practice?'自由练习':Math.max(0,Math.ceil(c.duration-manager.elapsed))+'s');$('stageGoal').textContent=c.label+(manager.stage===2?' · '+(s.material==='carpet'?'地毯':'木地板')+' / 据点 '+(s.rallyCleared||0)+'/3 · '+(s.rallies||[]).map(r=>(r.cleared?'✓':Math.round(r.progress*100)+'%')+r.name).join(' / ')+' · 有效横扫 '+(s.sweepCredits||0)+' · 爆发成果 '+(s.tactics?.burstEffective||0):manager.stage===1?' · 藏匿 '+(s.hiddenCount||0)+' · 暴露 '+(s.tactics?.revealed||0)+' · 有效动作 '+((s.tactics?.validKneads||0)+(s.tactics?.validSweeps||0))+' · 蓄力 '+Math.round((s.charge||0)*100)+'%': ' · 有效落脚 '+(s.tactics?.hitLandings||0)+'/'+(s.tactics?.landings||0)+' · 空踩 '+(s.tactics?.misses||0));$('scoreLine').textContent='总分 '+(manager.results.reduce((a,x)=>a+x.score,0)+(manager.status==='playing'?(s.score||0):0))+' · 控制 '+(s.controlled||0)+' · 逃离 '+(s.escapes||0)+' · 连击 '+(s.combo||0)+(s.social?.rescues?' · 救援 '+s.social.rescues:'')+(manager.status==='playing'&&s.feedback&&s.feedback.time>=0&&s.gameTime-s.feedback.time<2.8?' · '+(s.feedback.description||''):'');$('pressureBar').style.width=Math.max(0,Math.min(1,s.pressure||0))*100+'%';$('staminaBar').style.width=Math.max(0,Math.min(1,s.stamina??1))*100+'%';const mood=fever.snapshot();$('moodLine').textContent=mood.phase+' · 狂热 '+mood.value+'/100'+(mood.special==='silence'?' · 寂静':'')+(mood.burstRemaining>0?' · BURST '+Math.ceil(mood.burstRemaining)+'s':'');
 $('burstBtn').hidden=manager.stage!==2||manager.status!=='playing';
 $('burstBtn').disabled=!(manager.stage===2&&s.rallyCleared===3&&!s.burstUsed&&mood.value>=70);
 $('burstBtn').textContent=s.burstUsed?(s.burstRemaining>0?'爆发中 '+Math.ceil(s.burstRemaining)+'s':'爆发结束'):'FEVER BURST [F]';$('feverBar').style.width=mood.value+'%';$('feverFrame').style.boxShadow=save.data.prefs.lowEffects?'none':('inset 0 0 '+Math.round(mood.value/100*36)+'px rgba(201,139,79,'+(mood.value/100*.2)+')');$('portrait').style.transform=mood.special==='laugh'&&!save.data.prefs.reduceMotion?'scale(1.05)':'none';$('speaker').hidden=!save.data.prefs.bubbles;$('bubble').hidden=!dialogue.current;if(dialogue.current){$('bubble').textContent=dialogue.current.text;if(dialogue.current.serial!==lastGiantSerial){lastGiantSerial=dialogue.current.serial;$('speaker').classList.remove('incoming');void $('speaker').offsetWidth;$('speaker').classList.add('incoming');}}
 let pc=$('portrait').getContext('2d');pc.clearRect(0,0,128,128);if(manager.stage===2){const im=images.feverFaces;if(im){const w=im.width/2,h=im.height/2,k=mood.expression;pc.drawImage(im,(k%2)*w,Math.floor(k/2)*h,w,h,0,0,128,128);}else{const fb=images.paws||images.sneakers;if(fb)pc.drawImage(fb,768,0,128,128,0,0,128,128);}}else{const im=(manager.stage===1?images.socks:null)||images.sneakers,excited=manager.stage===1&&mood.value>=45;if(im)pc.drawImage(im,excited?896:768,excited?128:0,128,128,0,0,128,128);}$('portrait').title=manager.stage===2?mood.expressionName:mood.phase;v56UpdateUI(now,s,mood);
 }requestAnimationFrame(frame);}
/* Project Cunjie v5.6.0 - responsive, reversible presentation layer. */
let v56Ready=false,v56Compact=true,v56Touch=true,v56PerfEnabled=false,v56MenuOpen=false;
const v56Perf={frames:0,last:0,fps:0,snapshots:0,peakSnapshotMs:0,snapEMA:0};
function v56Pref(key,fallback){try{const v=localStorage.getItem('cunjie-v56-'+key);return v===null?fallback:v==='1';}catch{return fallback;}}
function v56SetPref(key,value){try{localStorage.setItem('cunjie-v56-'+key,value?'1':'0');}catch{}}
function v56Menu(open){if(!v56Ready)return;v56MenuOpen=!!open;const panel=$('v56Menu'),trigger=$('v56MoreBtn');panel.hidden=!v56MenuOpen;trigger.setAttribute('aria-expanded',String(v56MenuOpen));}
function v56SetCompact(value){v56Compact=!!value;v56SetPref('compact',v56Compact);$('play').classList.toggle('v56-compact',v56Compact);if($('v56HudToggle')){$('v56HudToggle').textContent=v56Compact?'▤':'▱';$('v56HudToggle').title=v56Compact?'展开数据 HUD':'收起数据 HUD';$('v56HudToggle').setAttribute('aria-label',$('v56HudToggle').title)}if($('v56DensityBtn'))$('v56DensityBtn').textContent=v56Compact?'展开完整统计':'收起统计';}
function v56RefreshControls(){if(!v56Ready)return;const play=mode==='story'||mode==='practice',manual=play&&!autopilot.enabled&&!paused&&manager.status==='playing'&&v56Touch;
 $('play').classList.toggle('v56-manual',manual);$('play').classList.toggle('v56-legacy',mode==='original');
 $('v56TouchDock').setAttribute('aria-hidden',String(!manual));$('v56TouchBtn').textContent=v56Touch?'关闭触屏动作键':'启用触屏动作键';
 const more=$('v56MoreBtn');more.hidden=mode==='original';
 if(mode==='home'||mode==='original'||paused||manager.status==='cutscene'||!$('modal').hidden)v56Menu(false);
}
function v56Init(){
 if(v56Ready)return;v56Compact=v56Pref('compact',true);v56Touch=v56Pref('touch',true);v56PerfEnabled=v56Pref('perf',false);globalThis.cunjieV59CleanNumbers=v56Pref('clean',false);
 const hud=$('hud'),metrics=document.createElement('span');metrics.id='v56Metrics';metrics.textContent='准备游戏画面…';const stageTitle=$('stageTitle');stageTitle.insertAdjacentElement('afterend',metrics);
 const hudToggle=document.createElement('button');hudToggle.id='v56HudToggle';hudToggle.type='button';hudToggle.onclick=()=>v56SetCompact(!v56Compact);hud.append(hudToggle);
 const more=document.createElement('button');more.id='v56MoreBtn';more.type='button';more.textContent='☰';more.title='快捷菜单';more.setAttribute('aria-label','展开快捷菜单');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','v56Menu');$('quick').append(more);
 const menu=document.createElement('nav');menu.id='v56Menu';menu.hidden=true;menu.setAttribute('aria-label','游戏快捷菜单');const heading=document.createElement('div');heading.className='v56-label';heading.textContent='界面与操作';menu.append(heading);
 for(const id of ['observeBtn','fullBtn','settingsBtn'])menu.append($(id));
 const density=document.createElement('button');density.id='v56DensityBtn';density.type='button';density.onclick=()=>v56SetCompact(!v56Compact);menu.append(density);
 const touchBtn=document.createElement('button');touchBtn.id='v56TouchBtn';touchBtn.type='button';touchBtn.onclick=()=>{v56Touch=!v56Touch;v56SetPref('touch',v56Touch);v56RefreshControls()};menu.append(touchBtn);
 const cleanBtn=document.createElement('button');cleanBtn.id='v59CleanBtn';cleanBtn.type='button';
 const syncClean=()=>{const on=globalThis.cunjieV59CleanNumbers!==false;cleanBtn.textContent=on?'清晰反馈：开':'清晰反馈：关（原版弹字）';cleanBtn.setAttribute('aria-pressed',String(on));
   if(stage instanceof LegacyStage&&stage.frame?.contentWindow)stage.frame.contentWindow.cunjieV59CleanNumbers=on;
   const line=$('v59HitEvent');if(line)line.hidden=!on;
 };
 cleanBtn.onclick=()=>{globalThis.cunjieV59CleanNumbers=!(globalThis.cunjieV59CleanNumbers!==false);v56SetPref('clean',globalThis.cunjieV59CleanNumbers);syncClean();};
 menu.append(cleanBtn);syncClean();
 const perfBtn=document.createElement('button');perfBtn.id='v56PerfBtn';perfBtn.type='button';perfBtn.onclick=()=>{v56PerfEnabled=!v56PerfEnabled;v56SetPref('perf',v56PerfEnabled);v56UpdatePerfMenu()};menu.append(perfBtn);
 const perfLabel=document.createElement('div');perfLabel.id='v56PerfLabel';perfLabel.className='v56-perf';menu.append(perfLabel);
 $('play').append(menu);
 const dock=document.createElement('nav');dock.id='v56TouchDock';dock.setAttribute('aria-label','触摸动作控制');
 for(const [key,label] of [['up','抬起'],['down','落脚'],['press','施压']]){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.kind=key;b.setAttribute('aria-label',label);dock.append(b);
  const action=()=>{if(!(['story','practice'].includes(mode))||paused||autopilot.enabled||!(stage instanceof LegacyStage))return false;return stage.command(key,{source:'host-touch'});};
  b.addEventListener('pointerdown',e=>{if(e.cancelable)e.preventDefault();if(b.setPointerCapture)try{b.setPointerCapture(e.pointerId)}catch{}action();},{passive:false});
  if(key==='press')for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{if(stage instanceof LegacyStage)stage.command('release',{source:'host-touch'});});
  b.addEventListener('click',e=>{if(e.detail===0){action();if(key==='press')stage?.command?.('release',{source:'host-touch'});}});
 }
 $('play').append(dock);more.onclick=()=>v56Menu(!v56MenuOpen);
 document.addEventListener('pointerdown',e=>{if(v56MenuOpen&&!menu.contains(e.target)&&!more.contains(e.target))v56Menu(false);},{passive:true});
 for(const id of ['observeBtn','fullBtn','settingsBtn'])$(id).addEventListener('click',()=>v56Menu(false));
 v56Ready=true;v56SetCompact(v56Compact);v56RefreshControls();v56UpdatePerfMenu();
}
function v56UpdatePerfMenu(){if(!v56Ready)return;$('v56PerfBtn').textContent=v56PerfEnabled?'关闭性能信息':'显示性能信息';$('v56PerfLabel').hidden=!v56PerfEnabled;
 $('v56PerfLabel').textContent='宿主帧率 '+v56Perf.fps.toFixed(0)+' FPS  · 采样 '+v56Perf.snapshots+' 次/s\n快照平均耗时 '+v56Perf.snapEMA.toFixed(2)+'ms · 峰值 '+v56Perf.peakSnapshotMs.toFixed(2)+'ms\n说明：不包括 iframe 内部 WebGL 帧率';}
function v56MonitorFrame(now){v56Perf.frames++;if(!v56Perf.last)v56Perf.last=now;if(now-v56Perf.last>=1000){v56Perf.fps=v56Perf.frames*1000/(now-v56Perf.last);v56Perf.frames=0;v56Perf.last=now;v56UpdatePerfMenu();v56Perf.snapshots=0;v56Perf.peakSnapshotMs=0;}}
function v56Snapshot(sample){const a=performance.now(),result=stage.snapshot(),elapsed=performance.now()-a;v56Perf.snapshots++;v56Perf.peakSnapshotMs=Math.max(v56Perf.peakSnapshotMs,elapsed);v56Perf.snapEMA=v56Perf.snapEMA?(.85*v56Perf.snapEMA+.15*elapsed):elapsed;return result;}
function v56UpdateUI(now,s,mood){if(!v56Ready)return;
 const count=s?.controlled||0,escapes=s?.escapes||0,combo=s?.combo||0,stageNum=manager.stage+1;
 $('v56Metrics').textContent='控制 '+count+'  ·  逃离 '+escapes+'  ·  连击 '+combo+(manager.stage===2?'  ·  据点 '+(s?.rallyCleared||0)+'/3':'');
 const title=$('stageTitle');title.title=title.textContent;
 v56RefreshControls();
}
/* Noncritical image decoding is sequenced after the first interactive title.
   Preserves all 14 image data URLs and all original game source bytes. */
const v56ImageLoad={required:['sneakers','sneakersAJ6','sneakersQiaodan','background','tinies','stage1Normal'],loaded:[],failed:[],deferred:['socks','paws','bedside','stage1Fever','stage2Normal','stage2Fever','stage3Normal','stage3Fever','feverFaces'],state:'pending'};
const v56ScriptPromises=new Map();
function v56LoadScript(src){if(v56ScriptPromises.has(src))return v56ScriptPromises.get(src);const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>resolve();s.onerror=()=>{v56ScriptPromises.delete(src);s.remove();reject(Error('Script load failed: '+src));};document.head.append(s);});v56ScriptPromises.set(src,p);return p;}
let v56DeferredPromise=null,v56StoryPromise=null,v56FreePromise=null,v56CinematicsPromise=null;
function ensureDeferredImages(){if(!v56DeferredPromise)v56DeferredPromise=(async()=>{if(!DATA.images.bedside&&!DATA.images.socks)await v56LoadScript('data/04-images-deferred.js');for(const key of v56ImageLoad.deferred){if(!DATA.images[key]||images[key])continue;try{await v56LoadAsset(images,key);}catch(err){console.warn('Deferred asset failed',key);}}v56ImageLoad.state=v56ImageLoad.failed.length?'partial':'complete';})().catch(err=>{v56DeferredPromise=null;throw err;});return v56DeferredPromise;}
function ensureStoryLegacy(){if(DATA.storyLegacy)return Promise.resolve();if(!v56StoryPromise)v56StoryPromise=v56LoadScript('data/touch-v1-impact.js').catch(err=>{v56StoryPromise=null;throw err;});return v56StoryPromise;}
function ensureFreeLegacy(){if(DATA.freeLegacy)return Promise.resolve();if(!v56FreePromise)v56FreePromise=v56LoadScript('data/touch-v1-free.js').catch(err=>{v56FreePromise=null;throw err;});return v56FreePromise;}
function ensureCinematics(){if(cinematic)return Promise.resolve();if(!v56CinematicsPromise)v56CinematicsPromise=(async()=>{if(!DATA.cinematics)await v56LoadScript('data/13-cinematics.js');if(!cinematic){const cgLoader=new CinematicAssetLoader(DATA.cinematics.images),cgAudio=new CinematicAudioController(DATA.audio);cinematic=new CinematicManager({scripts:DATA.cinematics.scripts,loader:cgLoader,audio:cgAudio});cinematic.audio.configure(save.data.prefs);cinematicRenderer=new CinematicRenderer(renderer,cgLoader);cinematicUI=new CinematicUI($('play'),$('cutCaption'),$('cinematicProgress'),$('cinematicMark'),$('skip'));}})().catch(err=>{v56CinematicsPromise=null;throw err;});return v56CinematicsPromise;}
function v56LoadAsset(images,key){return new Promise((resolve,reject)=>{const src=DATA.images[key],im=new Image();im.decoding='async';im.onload=()=>{images[key]=im;v56ImageLoad.loaded.push(key);resolve(im)};im.onerror=()=>{v56ImageLoad.failed.push(key);reject(Error(key))};im.src=src;});}
async function v56LoadCriticalImages(images){
 await Promise.all(v56ImageLoad.required.filter(key=>DATA.images[key]).map(key=>v56LoadAsset(images,key)));
 v56ImageLoad.state='interactive';
 setTimeout(()=>{void ensureDeferredImages().then(()=>{if(mode==='home')void ensureStoryLegacy();}).catch(()=>{});},600);
}

async function boot(){try{v56Init();v581Init();await Promise.all([v56LoadCriticalImages(images),syncRuntimePacks()]);images.sneakersAJ5=images.sneakers;syncShoeSelection();renderer=new RealmRenderer(canvas,images);tinyRenderer=new TinyBubbleRenderer($('tinyLayer'));renderer.resize();let q=document.createElement('canvas');q.width=864;q.height=448;q.getContext('2d').drawImage(images.background,160,0,432,224,0,0,864,448);$('home').style.backgroundImage='url('+DATA.images.stage1Normal+')';$('play').hidden=true;applyPrefs();syncAutoUI();requestAnimationFrame(frame);}catch(e){toast('资源加载失败：'+e.message);}}
window.CunjieRealms={snapshot:()=>({mode,paused,status:manager.status,stage:manager.stage,elapsed:manager.elapsed,results:manager.results,live:manager.live,voices:tinyVoices.snapshot(),voiceCount:tinyVoices.serial,mood:fever.snapshot(),autonomy:autopilot.status()}),autopilot:()=>autopilot.status(),setAutoplay:v=>setAutoplay(v),cinematic:()=>cinematic?.getSnapshot(),shoeSkin:()=>activeShoeSkin,audio:()=>({stage:footAudio.stage,events:footAudio.emitted.map(e=>e.kind),enabled:save.data.prefs.footstepFx}),uiState:()=>({...v58UI}),cinematicResolved:()=>({id:cinematic?.script?.id,assets:cinematic?.script?.shots?.flatMap(s=>s.layers.map(l=>l.asset))||[],stage:cinematic?.stageIndex}),replay:()=>({open:!$('v581Replay').hidden,index:v581Replay.index,state:v581Replay.manager?.state||'idle'}),uxVersion:'v5.8.1',assets:()=>({state:v56ImageLoad.state,loaded:[...v56ImageLoad.loaded],failed:[...v56ImageLoad.failed],deferred:[...v56ImageLoad.deferred]}),performance:()=>({...v56Perf}),layout:()=>({compact:v56Compact,touch:v56Touch,menu:v56MenuOpen}),version:'5.8.1-cinematic-ui-C'};boot();
})();

