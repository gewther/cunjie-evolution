/* Fenrir-only controls inside the legacy game iframe. */
// Local, bounded gameplay counters; no identifying data, network or shared save changes.
function createFenrirMemory(storage) {
 const key = 'cunjie-fenrir-persona-v2';
 const fields = ['runs', 'completed', 'handoffs', 'interruptions', 'aiSeconds'];
 const blank = () => ({version: 2, runs: 0, completed: 0, handoffs: 0, interruptions: 0, aiSeconds: 0});
 const limit = 100000000;
 let data = blank(), enabled = true, available = !!storage, dirty = false;
 let lastClock = null, lastEnabled = false, started = false, completed = false, lastSave = 0;
 function clean(raw) {
  const out = blank();
  if (!raw || raw.version !== 2) return out;
  for (const k of fields) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) out[k] = Math.min(limit, Math.max(0, k === 'aiSeconds' ? raw[k] : Math.floor(raw[k])));
  return out;
 }
 try {
  const raw = JSON.parse(storage?.getItem(key) || 'null');
  if (raw?.version === 2) {
   enabled = raw.enabled !== false;
   if (enabled) data = clean(raw);
  }
 } catch { available = false; }
 // Snapshot of prior runs, used for dialogue, not fabricated relationship history.
 let prior = {...data};
 function save() {
  if (!dirty || !storage) return;
  try {
   storage.setItem(key, JSON.stringify({...data, aiSeconds: Math.round(data.aiSeconds * 100) / 100, enabled}));
   available = true; dirty = false;
  } catch { available = false; }
 }
 function add(k, n = 1) {
  data[k] = Math.min(limit, data[k] + n); dirty = true;
 }
 function record(input) {
  const clock = Number(input.clock);
  if (!Number.isFinite(clock) || clock < 0) return;
  const reset = lastClock !== null && clock < lastClock;
  const dt = lastClock === null || reset ? 0 : Math.min(0.1, Math.max(0, clock - lastClock));
  if (reset) { started = false; completed = false; lastSave = clock; prior = {...data}; }
  lastClock = clock;
  const ai = !!input.enabled;
  if (!enabled) { lastEnabled = ai; return; }
  if (input.finished && started && !completed) {
   completed = true; add('completed'); save();
  }
  if (!input.active || input.paused || input.finished) return;
  if (!started) {
   started = true; add('runs'); if (ai) add('handoffs'); lastEnabled = ai; save();
  } else if (ai !== lastEnabled) {
   add(ai ? 'handoffs' : 'interruptions'); lastEnabled = ai; save();
  }
  if (ai && dt > 0) add('aiSeconds', dt);
  if (clock - lastSave >= 10) { lastSave = clock; save(); }
 }
 function clear() {
  data = blank(); prior = blank(); dirty = true; save();
  // Keep the current run's baseline: clearing does not invent another visit.
 }
 function setEnabled(next) {
  const value = !!next;
  if (enabled === value) return;
  enabled = value;
  if (!enabled) clear();
  else { dirty = true; save(); }
 }
 function status() { return {...data, aiSeconds: Math.round(data.aiSeconds * 10) / 10, enabled, available}; }
 return {record, save, clear, setEnabled, status, prior: () => ({...prior})};
}

// Fenrir-only choreography: vary preparation and recovery timing, never physics or aiming.
function createFenrirCadence(initial = 'playful') {
 const modes = ['playful', 'deliberate', 'classic'];
 const labels = {playful:'灵动', deliberate:'从容', classic:'原版'};
 let mode = modes.includes(initial) ? initial : 'playful';
 let last = {phase:'manual', factor:1, sequence:0};
 function configure(value) { if (modes.includes(value)) mode = value; return mode; }
 function next() { return configure(modes[(modes.indexOf(mode) + 1) % modes.length]); }
 function factor(input = {}) {
  const seq = Number.isFinite(input.sequence) ? Math.max(0, Math.floor(input.sequence)) : 0;
  const phase = input.enabled ? input.phase : 'manual';
  let value = 1;
  // One longer theatrical pause every third cycle; no change during approach/contact.
  if (mode === 'deliberate') {
   if (phase === 'raise') value = 0.76;
   else if (phase === 'recover') value = 0.82;
  } else if (mode === 'playful') {
   if (phase === 'raise') value = [0.92, 0.78, 1.02][seq % 3];
   else if (phase === 'recover') value = [1.02, 0.90, 0.80][seq % 3];
  }
  last = {phase, factor:value, sequence:seq};
  return value;
 }
 function status() { return {mode, label:labels[mode], ...last}; }
 return {configure, next, factor, status};
}

// Session-local persona director. No new movement or collision commands.
function createFenrirPersona(memory = null) {
 let phase = 'manual', handoffs = 0, interruptions = 0, lastClock = 0;
 let pending = null, lastLineAt = -Infinity, nextIdleAt = 0;
 let observed = 0, lastChargeBand = false, lastOverdrive = false;
 const pools = {
  takeover: [
   '总算舍得松手了？靠边看着——这条街怎么踩才带劲，我亲自示范。',
   '交给我就对了，你那步子太客气，底下那群小虫子根本不怕呢。',
   '哈哈，又轮到我接管？那今晚路口一个都别想完整溜出去！'
  ],
  return: [
   '啧，才热完身就把控制权抢回去？你最好踩得比我狠点。',
   '行行行，还你就是了——不过漏跑了小老鼠，我可是会笑话你的。',
   '这就急着亲自动脚了？行啊，我在旁边看着你打算怎么收尾。'
  ],
  observe: [
   '雨越下越密，路面滑得刚好——踩下去连逃跑都打滑，真省事。',
   '这条大道每一处水洼我都摸熟了，谁往哪儿钻一眼就看穿。',
   '怎么光盯着看？嫌我踩得太快，连求饶声都没听清吗？'
  ],
  ready: [
   '核心出力顶满 100% 了——还不快按下去，让整条街见识下什么叫过载？',
   '反应核烫得发亮了哦，再憋着不开大，我可要嫌你太磨蹭了。'
  ],
  overdrive: ['过载接管确认——青金电弧全开，整条雨夜大道彻底安静吧！'],
  recovered: ['冷却结束。呵，刚才那一波电弧清场，动静听着还够爽吧？']
 };
 const cursor = Object.create(null);
 function queue(kind, clock) {
  pending = {kind, at: clock};
 }
 function reset(clock = 0) {
  phase = 'manual'; pending = null; lastClock = clock;
  lastLineAt = -Infinity; nextIdleAt = clock + 9;
  observed = 0; lastChargeBand = false; lastOverdrive = false;
  handoffs = 0; interruptions = 0;
  for (const key of Object.keys(cursor)) delete cursor[key];
 }
 function setEnabled(enabled, clock) {
  const next = enabled ? 'autonomous' : 'manual';
  if (phase === next) return;
  phase = next;
  if (enabled) { handoffs++; queue('takeover', clock); }
  else { interruptions++; queue('return', clock); }
  nextIdleAt = clock + 9;
 }
 function update(input) {
  const clock = Number(input.clock);
  if (!Number.isFinite(clock)) return null;
  if (clock < lastClock) reset(clock);
  const dt = Math.max(0, Math.min(0.1, clock - lastClock));
  lastClock = clock;
  setEnabled(!!input.enabled, clock);
  if (!input.active || input.paused || input.finished) return null;
  if (phase === 'autonomous') observed += dt;
  const charged = Number(input.charge) >= 100 && !input.overdrive;
  if (phase === 'autonomous') {
   if (input.overdrive && !lastOverdrive) queue('overdrive', clock);
   else if (!input.overdrive && lastOverdrive) queue('recovered', clock);
   else if (charged && !lastChargeBand) queue('ready', clock);
   else if (!pending && clock >= nextIdleAt) queue('observe', clock);
  }
  lastChargeBand = charged;
  lastOverdrive = !!input.overdrive;
  if (pending && clock - pending.at > 8) pending = null;
  if (!input.dialogue) { pending = null; return null; }
  if (!pending || input.busy || clock - lastLineAt < 5) return null;
  const kind = pending.kind;
  pending = null;
  const history = memory?.prior();
  const pool = kind === 'takeover' && handoffs === 1 && history?.handoffs > 0
   ? ['又见面啦——上回让我接管还挺过瘾吧？今晚继续由我清场！', '哟，又见面了，上回你可也是直接把整条街丢给我踩的呢。']
   : pools[kind];
  const index = (cursor[kind] || 0) % pool.length;
  cursor[kind] = index + 1;
  lastLineAt = clock;
  nextIdleAt = clock + 12;
  return {kind, text: pool[index]};
 }
 function status() {
  return {phase, handoffs, interruptions, observedSeconds: Math.round(observed * 10) / 10, pending: pending?.kind || null};
 }
 return {setEnabled, update, reset, status};
}

if (fenrirCity) {
 const shell = document.getElementById('xl-shell');
 const drawer = document.getElementById('xl-drawer');
 const closeDrawerButton = document.getElementById('xl-drawer-close');
 const pauseButton = document.getElementById('xl-pause');
 const fullscreenButton = document.getElementById('fn-full-btn');
 const toolbar = document.getElementById('xl-toolbar');
 const dock = document.getElementById('fn-dock');
 const result = document.getElementById('fn-result');
 const stageHost = document.getElementById('outcanvasd') || document.getElementById('screen');
 const portraitBot = document.getElementById('fn-portrait-bot');
 const toolsButton = document.createElement('button');
 toolsButton.id = 'fn-tools-btn';
 toolsButton.type = 'button';
 toolsButton.textContent = '工具';
 toolsButton.setAttribute('aria-controls', dock.id);
 const style = document.createElement('style');
 style.textContent = `
#xl-toolbar #fn-dock {
 position:absolute;top:calc(100% + 6px);right:0;bottom:auto;
 width:min(268px,calc(100vw - 20px));max-height:calc(100dvh - 64px);
 overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
 display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
 gap:5px;padding:6px;border:1px solid #476e81;border-radius:8px;background:#101e29f5;opacity:1;line-height:1.2;
}
#xl-toolbar #fn-dock[hidden] {display:none}
#xl-toolbar #fn-dock button {min-height:32px;padding:4px 6px;font-size:12px;touch-action:manipulation}
#xl-toolbar #fn-tools-btn[aria-expanded="true"],#xl-toolbar #fn-auto-btn[aria-pressed="true"],#xl-toolbar #fn-touch-toggle[aria-pressed="true"],#xl-toolbar #fn-memory-toggle[aria-pressed="true"] {border-color:#67d6ef;color:#a8f3ff}
#fn-thumb-pad {
 position:absolute;left:10px;bottom:10px;z-index:13;display:flex;gap:6px;align-items:center;
 pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;
}
#fn-thumb-pad[hidden] {display:none!important}
#fn-thumb-pad button {
 min-width:56px;min-height:42px;padding:6px 10px;border-radius:10px;
 border:1px solid #48e5ff80;background:#0a1d2cd9;color:#e8f8ff;
 font-size:12px;font-weight:700;backdrop-filter:blur(4px);box-shadow:0 3px 12px #0008;
 touch-action:none;user-select:none;-webkit-user-select:none;
}
#fn-thumb-pad button[data-act="press"] {border-color:#ffd166a8;background:#3a2b10de;color:#ffeab8}
#fn-thumb-pad button:active,#fn-thumb-pad button.pressed {transform:translateY(1px);filter:brightness(1.25)}
#xl-shell.fn-portrait #fn-thumb-pad {
 position:static;order:1;width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
}
#xl-shell.fn-portrait #fn-thumb-pad button {min-height:46px;font-size:13px;}
@media (pointer:coarse) {#xl-toolbar button,#xl-toolbar #fn-dock button {min-height:44px}}
@media (max-height:460px) {#xl-toolbar #fn-dock {max-height:calc(100dvh - 54px);gap:4px;padding:5px;}#xl-toolbar #fn-dock button {min-height:36px;font-size:11px;padding:4px 5px;}}
 `;
 document.head.appendChild(style);
 toolbar.insertBefore(toolsButton, document.getElementById('xl-settings'));
 toolbar.append(dock);

 function showTools(open, restoreFocus = false) {
  dock.hidden = !open;
  toolsButton.setAttribute('aria-expanded', String(open));
  if (restoreFocus) toolsButton.focus({preventScroll: true});
 }
 showTools(false);
 toolsButton.onclick = () => showTools(dock.hidden);
 document.addEventListener('pointerdown', event => {
  if (!dock.hidden && !dock.contains(event.target) && event.target !== toolsButton) showTools(false);
 });

 const controller = window.parent.AutonomousXiaolong;
 let preferences = {};
 try {
  preferences = JSON.parse(localStorage.getItem('cunjie-stomp-impact-v1'))?.prefs || {};
 } catch {}
 const pilot = controller ? new controller({
  enabled: false, personality: preferences.autoPersonality,
  pace: preferences.autoPace, smart: preferences.autoSmart
 }) : null;
 const hunt = window.xlFenrirState;
 let personaStorage = null;
 try { personaStorage = window.localStorage; } catch {}
 const memory = createFenrirMemory(personaStorage);
 const persona = createFenrirPersona(memory);
 let cadencePreference;
 try { cadencePreference = personaStorage?.getItem('cunjie-fenrir-cadence-v3'); } catch {}
 const cadence = createFenrirCadence(cadencePreference || 'playful');
 window.__fenrirCadence = () => cadence.status();
 window.__fenrirMemory = () => memory.status();
 window.addEventListener('pagehide', () => memory.save());
 document.addEventListener('visibilitychange', () => { if (document.hidden) memory.save(); });
 function personaDialogueEnabled() {
  try {
   const prefs = JSON.parse(localStorage.getItem('cunjie-stomp-impact-v1'))?.prefs || {};
   return prefs.autoDialogue !== false && prefs.autoDialogue !== 0 && prefs.autoDialogue !== 'off';
  } catch { return preferences.autoDialogue !== false; }
 }
 function showPersonaLine(line) {
  const bubble = document.getElementById('xl-bubble');
  const text = document.getElementById('xl-bubble-line');
  const label = document.getElementById('xl-bubble-context');
  if (!line || !bubble || !text) return;
  // Share the existing speech arbiter: gameplay, wave and result lines take priority.
  if (hunt.speakLeft > 0 || hunt.totalClock - hunt.lastSpeakAt < 2.1) return;
  text.textContent = line.text;
  if (label) label.textContent = '芬里尔 · 自主意识';
  hunt.speakLeft = 3.2;
  hunt.speakPriority = 1;
  hunt.lastSpeakAt = hunt.totalClock;
  bubble.classList.add('is-speaking');
  bubble.classList.toggle('overdrive-voice', !!hunt.overdrive);
  bubble.setAttribute('aria-hidden', 'false');
 }
 let aimX = 0;
 let aimY = 0;
 const commands = {
  command(kind, {x} = {}) {
   if (kind === 'move') aimX = clamp(x, 0, w - 1);
   else if (kind === 'up') aimY = paw_min_y / 2;
   else if (kind === 'down') aimY = (floor_y + 20) / 2;
   else if (kind === 'press') aimY = h - 1;
   else if (kind === 'release') aimY = paw_y / 2;
   return true;
  }
 };
 const aiButton = document.createElement('button');
 aiButton.id = 'fn-auto-btn';
 aiButton.type = 'button';
 dock.prepend(aiButton);
 const memoryButton = document.createElement('button');
 memoryButton.type = 'button';
 memoryButton.id = 'fn-memory-toggle';
 const clearMemoryButton = document.createElement('button');
 clearMemoryButton.type = 'button';
 clearMemoryButton.id = 'fn-memory-clear';
 clearMemoryButton.textContent = '清空角色记忆';
 clearMemoryButton.title = '清空芬里尔本地游玩统计，不影响游戏存档';
 function syncMemoryButtons() {
  const m = memory.status();
  memoryButton.textContent = '角色记忆：' + (m.enabled ? (m.available ? '开' : '仅本局') : '关');
  memoryButton.setAttribute('aria-pressed', String(m.enabled));
  clearMemoryButton.disabled = !m.enabled;
 }
 memoryButton.onclick = () => { memory.setEnabled(!memory.status().enabled); syncMemoryButtons(); };
 clearMemoryButton.onclick = () => { memory.clear(); syncMemoryButtons(); };
 dock.append(memoryButton, clearMemoryButton);
 syncMemoryButtons();
 const cadenceButton = document.createElement('button');
 cadenceButton.type = 'button';
 cadenceButton.id = 'fn-cadence';
 cadenceButton.title = '仅改变 AI 准备和恢复动作的节奏，不改变手动控制';
 function syncCadenceButton() {
  cadenceButton.textContent = '自主节奏：' + cadence.status().label;
 }
 cadenceButton.onclick = () => {
  const mode = cadence.next();
  try { personaStorage?.setItem('cunjie-fenrir-cadence-v3', mode); } catch {}
  syncCadenceButton();
 };
 cadenceButton.disabled = !pilot;
 dock.appendChild(cadenceButton);
 syncCadenceButton();

 function setPilot(enabled) {
  if (pilot?.enabled !== enabled) {
   pilot?.setEnabled(enabled, commands);
   if (pilot) persona.setEnabled(enabled, hunt.totalClock);
   if (!enabled) cadence.factor({enabled:false});
   if (enabled && pilot) {
    realmTouchDisown();
    touchmode = false;
    touchid = null;
    mp = false;
    aimX = paw_x;
    aimY = paw_y / 2;
    if (!active) {
     moncanvas = true;
     mr = true;
    }
   } else if (pilot) {
    mx = paw_x;
    my = paw_y / 2;
   }
  }
  aiButton.textContent = enabled ? '关闭 AI [A]' : 'AI 托管 [A]';
  aiButton.setAttribute('aria-pressed', String(enabled));
  toolsButton.textContent = enabled ? '工具 · AI' : '工具';
 }
 aiButton.disabled = !pilot;
 setPilot(false);
 aiButton.onclick = () => setPilot(!pilot.enabled);
 if (pilot) {
  const baseSpeed = pilot.speedFactor.bind(pilot);
  pilot.speedFactor = mood => baseSpeed(mood) * cadence.factor({
   enabled: pilot.enabled, phase: pilot.phase, sequence: pilot.sequence
  });
  const chooseTarget = pilot.selectTarget.bind(pilot);
  pilot.selectTarget = (snapshot, previousX) => {
   if (hunt.evacZone) return {x: hunt.evacZone.x, reason: 'evac', type: 'rally', progress: 0};
   const runner = bugs.find(bug => bug?.fenrirRunner && bug.alive() && bug.x > 16 && bug.x < w - 16);
   if (runner) return {x: clamp(runner.x + (runner.fenrirExitDir || 0) * 14, 0, w - 1), reason: 'runner', type: 'npc', progress: 0};
   return chooseTarget(snapshot, previousX);
  };

  let lastClock = 0;
  window.__fenrirAutopilot = () => pilot.status();
  window.__fenrirPersona = () => persona.status();
  let dialogueClock = -Infinity, dialogueAllowed = preferences.autoDialogue !== false;
  const updatePaw = update_paw;
  update_paw = function() {
   if (pilot.enabled && active && !pause && !tr && !hunt.finished) {
    if (hunt.totalClock < lastClock) pilot.reset();
    lastClock = hunt.totalClock;
    const npcs = [];
    for (const bug of bugs) {
     if (bug?.alive()) npcs.push({x: bug.x / w * 1000});
    }
    pilot.tick(delta, {
     world: {width: w, footX: paw_x, footState: paw_state},
     visual: {footCollisionWidth: paw.width},
     npcs, controlled: hunt.kills
    }, commands, {value: hunt.thrill});
    mx = aimX;
    my = aimY;
    paw_follows_mouse = true;
   }
   const output = updatePaw.apply(this, arguments);
   if (hunt.totalClock < dialogueClock || hunt.totalClock - dialogueClock >= 1) {
    dialogueAllowed = personaDialogueEnabled();
    dialogueClock = hunt.totalClock;
   }
   memory.record({clock: hunt.totalClock, enabled: pilot.enabled, active,
     paused: pause || tr, finished: hunt.finished});
   const line = persona.update({
    clock: hunt.totalClock, enabled: pilot.enabled, active,
    paused: pause || tr, finished: hunt.finished,
    charge: hunt.thrill, overdrive: hunt.overdrive,
    dialogue: dialogueAllowed,
    busy: hunt.speakLeft > 0 || hunt.totalClock - hunt.lastSpeakAt < 2.1
   });
   showPersonaLine(line);
   return output;
  };
 }

 const shortcuts = {
  KeyA: 'fn-auto-btn',
  KeyW: 'xl-up',
  KeyS: 'xl-down',
  KeyD: 'xl-press',
  KeyF: 'fn-overdrive-btn',
  Space: 'xl-pause'
 };
 const actionIds = ['xl-up', 'xl-down', 'xl-press'];
 const focusCanvas = () => oc.focus({preventScroll: true});
 const nativeFullscreen = () => document.fullscreenElement === shell;
 const immersive = () => shell.classList.contains('xl-immersive');

 for (const id of actionIds) {
  document.getElementById(id).addEventListener('click', () => {
   // Opening the settings drawer pauses the legacy engine.
   if (!drawer.hidden) {
    closeDrawerButton.click();
    if (pause && !xlRuntime.session.completed) pauseButton.click();
   }
   setPilot(false);
   focusCanvas();
  }, {capture: true});
 }
 closeDrawerButton.addEventListener('click', focusCanvas);
 oc.addEventListener('pointerdown', () => {
  setPilot(false);
  focusCanvas();
 });
 dock.addEventListener('click', event => {
  if (event.target.closest('button')) {
   showTools(false);
   focusCanvas();
  }
 });
 // Mobile Thumb Action Pad (Lift / Drop / Press) for comfortable phone play
 const isCoarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
 let thumbPadPref = null;
 try {
  const saved = localStorage.getItem('cunjie-fn-thumb-pad');
  if (saved === '1') thumbPadPref = true;
  else if (saved === '0') thumbPadPref = false;
 } catch {}
 let thumbPadOn = thumbPadPref !== null ? thumbPadPref : isCoarsePointer;
 const thumbPad = document.createElement('nav');
 thumbPad.id = 'fn-thumb-pad';
 thumbPad.setAttribute('aria-label', '芬里尔触屏动作控制');
 let pressHoldActive = false;
 for (const [act, label] of [['up', '抬起'], ['down', '落脚'], ['press', '施压']]) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.act = act;
  b.textContent = label;
  const trigger = () => {
   setPilot(false);
   if (act === 'up') document.getElementById('xl-up')?.click();
   else if (act === 'down') document.getElementById('xl-down')?.click();
   else {
    pressHoldActive = true;
    b.classList.add('pressed');
    if (typeof mp !== 'undefined') mp = true;
    my = h - 1;
    paw_dest_y = h;
   }
  };
  b.addEventListener('pointerdown', e => {
   if (e.cancelable) e.preventDefault();
   e.stopPropagation();
   if (b.setPointerCapture) try { b.setPointerCapture(e.pointerId); } catch {}
   trigger();
  }, {passive: false});
  if (act === 'press') {
   for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    b.addEventListener(ev, e => {
     e.stopPropagation();
     if (!pressHoldActive) return;
     pressHoldActive = false;
     b.classList.remove('pressed');
     if (typeof mr !== 'undefined') mr = true;
     if (typeof mp !== 'undefined') mp = false;
     my = paw_y / 2;
    }, {passive: true});
   }
  }
  b.addEventListener('click', e => {
   e.stopPropagation();
   if (e.detail === 0) trigger();
  });
  thumbPad.appendChild(b);
 }
 if (stageHost) stageHost.appendChild(thumbPad);

 const thumbToggleBtn = document.createElement('button');
 thumbToggleBtn.id = 'fn-touch-toggle';
 thumbToggleBtn.type = 'button';
 function syncThumbPad() {
  const portrait = shell.classList.contains('fn-portrait');
  const visible = thumbPadOn || portrait;
  thumbPad.hidden = !visible;
  if (portrait && portraitBot && thumbPad.parentNode !== portraitBot) {
   portraitBot.insertBefore(thumbPad, document.getElementById('xl-bubble'));
  } else if (!portrait && stageHost && thumbPad.parentNode !== stageHost) {
   stageHost.appendChild(thumbPad);
  }
  thumbToggleBtn.textContent = '触屏按键：' + (thumbPadOn ? '开' : '关');
  thumbToggleBtn.setAttribute('aria-pressed', String(thumbPadOn));
 }
 thumbToggleBtn.onclick = () => {
  thumbPadOn = !thumbPadOn;
  try { localStorage.setItem('cunjie-fn-thumb-pad', thumbPadOn ? '1' : '0'); } catch {}
  syncThumbPad();
 };
 dock.appendChild(thumbToggleBtn);
 window.addEventListener('fn-layout-change', syncThumbPad);
 syncThumbPad();

 // The canvas container cancels touchend to handle drag release. Keep
 // control touches away from that handler so the browser can dispatch clicks.
 for (const controls of [dock, thumbPad, result, document.getElementById('xl-result')]) {
  if (!controls) continue;
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
   controls.addEventListener(type, event => event.stopPropagation(), {passive: true});
  }
 }

 function syncFullscreenButton() {
  let parentFull = false;
  try { parentFull = !!(window.parent && window.parent !== window && window.parent.document.fullscreenElement); } catch {}
  const activeFull = nativeFullscreen() || parentFull;
  const label = activeFull ? '退出全屏' : immersive() ? '退出铺满' : '全屏';
  fullscreenButton.textContent = '⛶ ' + label;
  fullscreenButton.setAttribute('aria-label', label);
  fullscreenButton.setAttribute('aria-pressed', String(activeFull || immersive()));
 }

 async function toggleFullscreen() {
  const hostEmbedded = !!(window.frameElement && window.parent && window.parent !== window);
  if (hostEmbedded) {
   try {
    window.parent.postMessage({type: 'cunjie-toggle-fullscreen'}, '*');
    setTimeout(syncFullscreenButton, 120);
    focusCanvas();
    return;
   } catch {}
  }
  if (nativeFullscreen()) {
   await document.exitFullscreen().catch(() => {});
  } else if (immersive()) {
   shell.classList.remove('xl-immersive');
  } else {
   try {
    if (!document.fullscreenEnabled || !shell.requestFullscreen) {
     shell.classList.add('xl-immersive');
    } else {
     // Keep the request inside the iframe's actual click or tap.
     await shell.requestFullscreen({navigationUI: 'hide'});
    }
   } catch {
    shell.classList.add('xl-immersive');
   }
  }
  syncFullscreenButton();
  focusCanvas();
 }

 fullscreenButton.onclick = toggleFullscreen;
 document.addEventListener('fullscreenchange', syncFullscreenButton);
 try {
  if (window.parent && window.parent !== window) {
   window.parent.document.addEventListener('fullscreenchange', syncFullscreenButton);
   window.addEventListener('pagehide', () => window.parent.document.removeEventListener('fullscreenchange', syncFullscreenButton), {once: true});
  }
 } catch {}
 syncFullscreenButton();

 function handleShortcut(event) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === 'Escape') {
   if (drawer.hidden && dock.hidden && !immersive()) return;
   event.preventDefault();
   event.stopImmediatePropagation();
   if (!drawer.hidden) closeDrawerButton.click();
   else if (!dock.hidden) showTools(false, true);
   else void toggleFullscreen();
   return;
  }
  const target = event.target;
  if (!drawer.hidden || target?.isContentEditable || target?.closest?.('input,select,textarea,[contenteditable]')) return;
  if (event.code === 'Space' && target?.closest?.('button,a,[role="button"]')) return;
  const id = shortcuts[event.code];
  if (!id || !result.hidden) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!event.repeat) {
   document.getElementById(id).click();
   focusCanvas();
  }
 }

 window.addEventListener('keydown', handleShortcut, {capture: true});
 // Key events stay in the document that owns focus, including the host page.
 const frame = window.frameElement;
 if (frame) {
  const host = frame.ownerDocument.defaultView;
  function forwardShortcut(event) {
   if (frame.isConnected && !document.hidden) handleShortcut(event);
  }
  host.addEventListener('keydown', forwardShortcut, {capture: true});
  window.addEventListener('pagehide', () => host.removeEventListener('keydown', forwardShortcut, true), {once: true});
 }
 focusCanvas();
}
