(() => {
 'use strict';
 if (typeof window === 'undefined' || !/^https?:$/.test(location.protocol)) return;

 const hasSw = 'serviceWorker' in navigator;
 const hasCaches = 'caches' in window;
 const isIos = /(iPhone|iPad|iPod)/i.test(navigator.userAgent || '');

 function isStandalone() {
  try {
   return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
   );
  } catch {
   return false;
  }
 }

 function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
   el.style.display = 'none';
  }, 3400);
 }

 const style = document.createElement('style');
 style.textContent = `
#pwaBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 4px;max-width:700px}
#pwaBar button{padding:7px 12px;min-height:38px;border-radius:9px;font-size:12px;font-weight:650;border:1px solid #4be5ff70;background:linear-gradient(135deg,#0d2230ee,#14303ee8);color:#e4f7ff;box-shadow:0 3px 12px #0004;touch-action:manipulation}
#pwaBar button:hover:not(:disabled){border-color:#7bf0ff;background:#183a4a}
#pwaBar button:disabled{opacity:.78;cursor:default}
#pwaBar button.pwa-ready{border-color:#ffd166b8;color:#fff2cc;background:linear-gradient(135deg,#12384be8,#3b2e11e8)}
#pwaBar button.pwa-installed{border-color:#7ee0b880;color:#d6ffeb;background:#143536d9}
@media(max-width:580px){#pwaBar{gap:6px}#pwaBar button{flex:1 1 auto;min-height:42px;font-size:11.5px;padding:7px 10px}}
 `;
 document.head.appendChild(style);

 const bar = document.createElement('div');
 bar.id = 'pwaBar';
 bar.setAttribute('role', 'region');
 bar.setAttribute('aria-label', '离线安装与缓存控制');

 const installBtn = document.createElement('button');
 installBtn.id = 'pwaInstallBtn';
 installBtn.type = 'button';

 const cacheBtn = document.createElement('button');
 cacheBtn.id = 'pwaCacheBtn';
 cacheBtn.type = 'button';
 cacheBtn.hidden = !(hasSw && hasCaches);
 cacheBtn.textContent = '📥 离线缓存（检测中…）';

 bar.append(installBtn, cacheBtn);

 const homeArticle = document.querySelector('#home article');
 const homeMenu = document.querySelector('#home .menu');
 if (homeArticle) {
  if (homeMenu) homeArticle.insertBefore(bar, homeMenu);
  else homeArticle.appendChild(bar);
 }

 let deferredPrompt = null;
 let swReg = null;
 let caching = false;
 let lastStatus = { ready: false, done: 0, total: 0, standalone: isStandalone() };

 function syncInstallButton() {
  lastStatus.standalone = isStandalone();
  if (lastStatus.standalone) {
   installBtn.textContent = '✓ 独立 App 模式';
   installBtn.disabled = true;
   installBtn.classList.add('pwa-installed');
   return;
  }
  installBtn.disabled = false;
  installBtn.classList.remove('pwa-installed');
  if (deferredPrompt) {
   installBtn.textContent = '📲 安装到手机桌面';
  } else if (isIos) {
   installBtn.textContent = '📲 添加到主屏幕';
  } else {
   installBtn.textContent = '📲 桌面快捷方式';
  }
 }

 installBtn.onclick = async () => {
  if (isStandalone()) return;
  if (deferredPrompt) {
   const promptEvent = deferredPrompt;
   deferredPrompt = null;
   try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice && choice.outcome === 'accepted') {
     showToast('已请求安装到桌面，安装后支持全屏断网游玩');
    }
   } catch {}
   syncInstallButton();
   return;
  }
  if (isIos) {
   showToast('点底部「分享」按钮 → 选择「添加到主屏幕」即可全屏运行');
  } else {
   showToast('打开浏览器右上角菜单 → 选择「安装应用 / 添加到主屏幕」');
  }
 };

 window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  syncInstallButton();
 });
 window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  lastStatus.standalone = true;
  syncInstallButton();
  showToast('寸界已安装为桌面 App');
 });
 try {
  window.matchMedia('(display-mode: standalone)').addEventListener('change', syncInstallButton);
 } catch {}
 syncInstallButton();

 function updateCacheButton(payload) {
  if (!payload || typeof payload !== 'object') return;
  const total = Number(payload.total) || 0;
  const done = Number(payload.done) || 0;
  const ready = !!payload.ready || (total > 0 && done >= total);
  lastStatus = { ...lastStatus, ready, done, total };
  if (payload.type === 'PWA_CACHE_PROGRESS' && !ready) {
   caching = true;
   cacheBtn.disabled = true;
   cacheBtn.classList.remove('pwa-ready');
   cacheBtn.textContent = `📥 离线缓存中 ${done}/${total}...`;
   return;
  }
  caching = false;
  cacheBtn.disabled = ready;
  cacheBtn.classList.toggle('pwa-ready', ready);
  if (ready) {
   cacheBtn.textContent = '✓ 已完整离线缓存（断网可玩）';
  } else {
   cacheBtn.textContent = total > 0 ? `📥 离线缓存 (${done}/${total})` : '📥 一键离线缓存';
  }
 }

 async function getActiveWorker() {
  if (!hasSw) return null;
  const reg = swReg || (await navigator.serviceWorker.ready);
  return reg?.active || navigator.serviceWorker.controller || null;
 }

 async function requestCacheStatus() {
  try {
   const worker = await getActiveWorker();
   if (worker) worker.postMessage({ type: 'GET_CACHE_STATUS' });
  } catch {}
 }

 async function cacheAll() {
  if (!hasSw || !hasCaches || caching) return false;
  caching = true;
  cacheBtn.disabled = true;
  cacheBtn.textContent = `📥 离线缓存中 ${lastStatus.done}/${lastStatus.total || '...'}...`;
  try {
   const worker = await getActiveWorker();
   if (!worker) throw new Error('Service Worker 未就绪');
   worker.postMessage({ type: 'CACHE_ALL' });
   return true;
  } catch (err) {
   caching = false;
   cacheBtn.disabled = false;
   cacheBtn.textContent = '📥 离线缓存（重试）';
   showToast(err?.message || '离线缓存启动失败');
   return false;
  }
 }

 cacheBtn.onclick = () => {
  void cacheAll();
 };

 if (hasSw) {
  navigator.serviceWorker.addEventListener('message', event => {
   const data = event.data;
   if (!data || (data.type !== 'PWA_CACHE_STATUS' && data.type !== 'PWA_CACHE_PROGRESS')) return;
   updateCacheButton(data);
   if (data.type === 'PWA_CACHE_PROGRESS' && data.ready) {
    showToast('全部游戏资源已离线缓存，断网也能畅玩');
   }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
   void requestCacheStatus();
  });

  const registerSw = async () => {
   try {
    swReg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    swReg.addEventListener('updatefound', () => {
     const installing = swReg.installing;
     if (!installing) return;
     installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
       showToast('发现新版本，下次打开自动生效');
      }
      if (installing.state === 'activated') {
       void requestCacheStatus();
      }
     });
    });
    await navigator.serviceWorker.ready;
    await requestCacheStatus();
   } catch {
    cacheBtn.hidden = true;
   }
  };

  if (document.readyState === 'complete') {
   void registerSw();
  } else {
   window.addEventListener('load', () => void registerSw(), { once: true });
  }
 }

 window.__cunjiePwa = {
  status: () => ({ ...lastStatus }),
  cacheAll,
 };
})();
