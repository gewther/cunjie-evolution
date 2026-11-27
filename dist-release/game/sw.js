/* Project Cunjie v6.2 PWA Service Worker (Workbox-inspired two-tier caching). */
'use strict';

const CACHE_PREFIX = 'cunjie-pwa-';
const CACHE_NAME = CACHE_PREFIX + "a2f14af4";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/fenrir/city-far.svg",
  "./assets/fenrir/city-mid.svg",
  "./assets/fenrir/city-near.svg",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/icon-512.png",
  "./data/00-init.js",
  "./data/01-stages.js",
  "./data/02-lines.js",
  "./data/03-original.js",
  "./data/04-images-boot.js",
  "./data/05-audio.js",
  "./data/08-visualConfig.js",
  "./data/09-fever.js",
  "./data/10-tinyVoices.js",
  "./data/11-reactiveGiant.js",
  "./data/12-responses.js",
  "./scripts/fenrir-scene-v1.js",
  "./scripts/host-2.js",
  "./scripts/impact-host-3.js",
  "./scripts/pwa.js",
  "./scripts/render-quality.js",
  "./scripts/room-choice.js",
  "./scripts/skin-packs.js",
  "./scripts/touch-v1-impact-host-1.js"
];
const ALL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/aj5-hd/0.webp",
  "./assets/aj5-hd/1.webp",
  "./assets/aj5-hd/10.webp",
  "./assets/aj5-hd/2.webp",
  "./assets/aj5-hd/3.webp",
  "./assets/aj5-hd/4.webp",
  "./assets/aj5-hd/5.webp",
  "./assets/aj5-hd/6.webp",
  "./assets/aj5-hd/7.webp",
  "./assets/aj5-hd/8.webp",
  "./assets/aj5-hd/9.webp",
  "./assets/aj6-hd/0.webp",
  "./assets/aj6-hd/1.webp",
  "./assets/aj6-hd/10.webp",
  "./assets/aj6-hd/2.webp",
  "./assets/aj6-hd/3.webp",
  "./assets/aj6-hd/4.webp",
  "./assets/aj6-hd/5.webp",
  "./assets/aj6-hd/6.webp",
  "./assets/aj6-hd/7.webp",
  "./assets/aj6-hd/8.webp",
  "./assets/aj6-hd/9.webp",
  "./assets/fenrir/city-far.svg",
  "./assets/fenrir/city-mid.svg",
  "./assets/fenrir/city-near.svg",
  "./assets/fenrir/fenrir-city-blue-hour.webp",
  "./assets/fenrir/fenrir-motion-v3.png",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/icon-512.png",
  "./assets/impact/contact-dust-v2.webp",
  "./assets/impact/floor-residue-v3.png",
  "./assets/impact/impact-atlas-v1.png",
  "./assets/paws-hd/0.webp",
  "./assets/paws-hd/1.webp",
  "./assets/paws-hd/10.webp",
  "./assets/paws-hd/2.webp",
  "./assets/paws-hd/3.webp",
  "./assets/paws-hd/4.webp",
  "./assets/paws-hd/5.webp",
  "./assets/paws-hd/6.webp",
  "./assets/paws-hd/7.webp",
  "./assets/paws-hd/8.webp",
  "./assets/paws-hd/9.webp",
  "./assets/qiaodan-flatheel-v4.webp",
  "./assets/qiaodan-hd/0.webp",
  "./assets/qiaodan-hd/1.webp",
  "./assets/qiaodan-hd/10.webp",
  "./assets/qiaodan-hd/2.webp",
  "./assets/qiaodan-hd/3.webp",
  "./assets/qiaodan-hd/4.webp",
  "./assets/qiaodan-hd/5.webp",
  "./assets/qiaodan-hd/6.webp",
  "./assets/qiaodan-hd/7.webp",
  "./assets/qiaodan-hd/8.webp",
  "./assets/qiaodan-hd/9.webp",
  "./assets/rooftop/aj6.webp",
  "./assets/rooftop/day.webp",
  "./assets/rooftop/night.webp",
  "./assets/rooms/bedroom-wood.webp",
  "./assets/rooms/bedside-hd-fever.webp",
  "./assets/rooms/bedside-hd.webp",
  "./assets/rooms/room-rain.webp",
  "./assets/rooms/room-warm.webp",
  "./assets/socks-hd/0.webp",
  "./assets/socks-hd/1.webp",
  "./assets/socks-hd/10.webp",
  "./assets/socks-hd/2.webp",
  "./assets/socks-hd/3.webp",
  "./assets/socks-hd/4.webp",
  "./assets/socks-hd/5.webp",
  "./assets/socks-hd/6.webp",
  "./assets/socks-hd/7.webp",
  "./assets/socks-hd/8.webp",
  "./assets/socks-hd/9.webp",
  "./assets/tinies/tinies-hd-v1.webp",
  "./data/00-init.js",
  "./data/01-stages.js",
  "./data/02-lines.js",
  "./data/03-original.js",
  "./data/04-images-boot.js",
  "./data/04-images-deferred.js",
  "./data/05-audio.js",
  "./data/08-visualConfig.js",
  "./data/09-fever.js",
  "./data/10-tinyVoices.js",
  "./data/11-reactiveGiant.js",
  "./data/12-responses.js",
  "./data/13-cinematics.js",
  "./data/touch-v1-free.js",
  "./data/touch-v1-impact.js",
  "./scripts/fenrir-scene-v1.js",
  "./scripts/host-2.js",
  "./scripts/impact-host-3.js",
  "./scripts/pwa.js",
  "./scripts/render-quality.js",
  "./scripts/room-choice.js",
  "./scripts/skin-packs.js",
  "./scripts/touch-v1-impact-host-1.js"
];

function toRelKey(url) {
 try {
  const reqUrl = new URL(url, self.registration.scope);
  const scopeUrl = new URL(self.registration.scope);
  if (!reqUrl.href.startsWith(scopeUrl.href)) return null;
  let rel = './' + reqUrl.href.slice(scopeUrl.href.length).split('?')[0].split('#')[0];
  if (rel === './') return './';
  return rel;
 } catch {
  return null;
 }
}

self.addEventListener('install', event => {
 event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
  await self.skipWaiting();
 })());
});

self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(
   names
    .filter(n => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
    .map(n => caches.delete(n))
  );
  await self.clients.claim();
 })());
});

async function matchScoped(cache, request) {
 const direct = await cache.match(request, { ignoreSearch: true });
 if (direct) return direct;
 const rel = toRelKey(request.url);
 if (rel) return cache.match(rel);
 return undefined;
}

self.addEventListener('fetch', event => {
 const req = event.request;
 if (!req || req.method !== 'GET') return;
 const rel = toRelKey(req.url);
 if (!rel) return;

 if (req.mode === 'navigate' || rel === './' || rel === './index.html') {
  event.respondWith((async () => {
   const cache = await caches.open(CACHE_NAME);
   try {
    const res = await fetch(req);
    if (res && res.ok) await cache.put('./index.html', res.clone());
    return res;
   } catch {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
   }
  })());
  return;
 }

 if (rel.startsWith('./assets/')) {
  event.respondWith((async () => {
   const cache = await caches.open(CACHE_NAME);
   const hit = await matchScoped(cache, req);
   if (hit) return hit;
   try {
    const res = await fetch(req);
    if (res && res.ok) await cache.put(rel, res.clone());
    return res;
   } catch {
    return Response.error();
   }
  })());
  return;
 }

 // Scripts, data bundles, and manifest: stale-while-revalidate
 event.respondWith((async () => {
  const cache = await caches.open(CACHE_NAME);
  const hit = await matchScoped(cache, req);
  const netPromise = fetch(req).then(async res => {
   if (res && res.ok) await cache.put(rel, res.clone());
   return res;
  }).catch(() => null);
  if (hit) {
   event.waitUntil(netPromise);
   return hit;
  }
  const net = await netPromise;
  return net || Response.error();
 })());
});

async function countCached() {
 const cache = await caches.open(CACHE_NAME);
 let done = 0;
 for (const asset of ALL_ASSETS) {
  const hit = await cache.match(asset, { ignoreSearch: true });
  if (hit) done++;
 }
 return { done, total: ALL_ASSETS.length, ready: done >= ALL_ASSETS.length, cacheName: CACHE_NAME };
}

async function broadcast(payload) {
 const list = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
 for (const client of list) client.postMessage(payload);
}

self.addEventListener('message', event => {
 const data = event.data;
 if (!data || !data.type) return;

 if (data.type === 'GET_CACHE_STATUS') {
  event.waitUntil((async () => {
   const st = await countCached();
   const msg = { type: 'PWA_CACHE_STATUS', ...st };
   if (event.source && typeof event.source.postMessage === 'function') event.source.postMessage(msg);
   else await broadcast(msg);
  })());
  return;
 }

 if (data.type === 'CACHE_ALL') {
  event.waitUntil((async () => {
   const cache = await caches.open(CACHE_NAME);
   const missing = [];
   let done = 0;
   for (const asset of ALL_ASSETS) {
    if (await cache.match(asset, { ignoreSearch: true })) done++;
    else missing.push(asset);
   }
   const total = ALL_ASSETS.length;
   await broadcast({ type: 'PWA_CACHE_PROGRESS', done, total, ready: done >= total, cacheName: CACHE_NAME });
   const concurrency = 3;
   let cursor = 0;
   async function worker() {
    while (cursor < missing.length) {
     const item = missing[cursor++];
     try {
      const res = await fetch(item, { cache: 'no-cache' });
      if (res && res.ok) await cache.put(item, res);
     } catch {}
     done++;
     await broadcast({ type: 'PWA_CACHE_PROGRESS', done, total, ready: false, cacheName: CACHE_NAME });
    }
   }
   await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, () => worker()));
   const finalSt = await countCached();
   await broadcast({ type: 'PWA_CACHE_PROGRESS', ...finalSt });
  })());
  return;
 }

 if (data.type === 'CLEAR_CACHE') {
  event.waitUntil((async () => {
   await caches.delete(CACHE_NAME);
   const st = await countCached();
   await broadcast({ type: 'PWA_CACHE_STATUS', ...st });
  })());
 }
});
