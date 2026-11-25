/* Fenrir-only controls inside the legacy game iframe. */
if (fenrirCity) {
 const shell = document.getElementById('xl-shell');
 const drawer = document.getElementById('xl-drawer');
 const closeDrawerButton = document.getElementById('xl-drawer-close');
 const pauseButton = document.getElementById('xl-pause');
 const fullscreenButton = document.getElementById('fn-full-btn');
 const dock = document.getElementById('fn-dock');
 const result = document.getElementById('fn-result');
 const shortcuts = {
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
   focusCanvas();
  }, {capture: true});
 }
 closeDrawerButton.addEventListener('click', focusCanvas);
 oc.addEventListener('pointerdown', focusCanvas);
 dock.addEventListener('click', event => {
  if (event.detail > 0 && event.target.closest('button')) focusCanvas();
 });
 // The canvas container cancels touchend to handle drag release. Keep
 // control touches away from that handler so the browser can dispatch clicks.
 for (const controls of [dock, result, document.getElementById('xl-result')]) {
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
   controls.addEventListener(type, event => event.stopPropagation(), {passive: true});
  }
 }

 function syncFullscreenButton() {
  const label = nativeFullscreen() ? '退出全屏' : immersive() ? '退出铺满' : '全屏';
  fullscreenButton.textContent = '⛶ ' + label;
  fullscreenButton.setAttribute('aria-label', label);
  fullscreenButton.setAttribute('aria-pressed', String(nativeFullscreen() || immersive()));
 }

 async function toggleFullscreen() {
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
 syncFullscreenButton();

 function handleShortcut(event) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === 'Escape') {
   if (drawer.hidden && !immersive()) return;
   event.preventDefault();
   event.stopImmediatePropagation();
   if (!drawer.hidden) closeDrawerButton.click();
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
