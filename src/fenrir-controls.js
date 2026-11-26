/* Fenrir-only controls inside the legacy game iframe. */
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
 width:min(268px,calc(100vw - 20px));display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
 gap:5px;padding:6px;border:1px solid #476e81;border-radius:8px;background:#101e29f5;opacity:1;line-height:1.2;
}
#xl-toolbar #fn-dock[hidden] {display:none}
#xl-toolbar #fn-dock button {min-height:32px;padding:4px 6px;font-size:12px;touch-action:manipulation}
#xl-toolbar #fn-tools-btn[aria-expanded="true"],#xl-toolbar #fn-auto-btn[aria-pressed="true"],#xl-toolbar #fn-touch-toggle[aria-pressed="true"] {border-color:#67d6ef;color:#a8f3ff}
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

 function setPilot(enabled) {
  if (pilot?.enabled !== enabled) {
   pilot?.setEnabled(enabled, commands);
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
  const chooseTarget = pilot.selectTarget.bind(pilot);
  pilot.selectTarget = (snapshot, previousX) => {
   if (hunt.evacZone) return {x: hunt.evacZone.x, reason: 'evac', type: 'rally', progress: 0};
   const runner = bugs.find(bug => bug?.fenrirRunner && bug.alive() && bug.x > 16 && bug.x < w - 16);
   if (runner) return {x: clamp(runner.x + (runner.fenrirExitDir || 0) * 14, 0, w - 1), reason: 'runner', type: 'npc', progress: 0};
   return chooseTarget(snapshot, previousX);
  };

  let lastClock = 0;
  window.__fenrirAutopilot = () => pilot.status();
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
   return updatePaw.apply(this, arguments);
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
