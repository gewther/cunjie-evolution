'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const gameDir = path.join(root, 'dist-release', 'game');

function readPngSize(filePath) {
 const buf = fs.readFileSync(filePath);
 assert.equal(buf.toString('ascii', 1, 4), 'PNG', `Not a PNG: ${filePath}`);
 return {
  width: buf.readUInt32BE(16),
  height: buf.readUInt32BE(20),
 };
}

async function testManifestAndHtml() {
 const manifestPath = path.join(gameDir, 'manifest.webmanifest');
 assert(fs.existsSync(manifestPath), 'Missing manifest.webmanifest');
 const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
 assert.equal(manifest.start_url, './');
 assert.equal(manifest.scope, './');
 assert.equal(manifest.display, 'standalone');
 assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'Missing manifest icons');

 for (const icon of manifest.icons) {
  assert(!icon.src.startsWith('/'), `Icon src must be relative: ${icon.src}`);
  const fp = path.join(gameDir, icon.src.replace(/\//g, path.sep));
  assert(fs.existsSync(fp), `Missing icon file: ${icon.src}`);
  const expected = Number(icon.sizes.split('x')[0]);
  const actual = readPngSize(fp);
  assert.equal(actual.width, expected, `Unexpected width for ${icon.src}`);
  assert.equal(actual.height, expected, `Unexpected height for ${icon.src}`);
 }

 const icon180 = readPngSize(path.join(gameDir, 'assets', 'icons', 'icon-180.png'));
 assert.equal(icon180.width, 180);
 assert.equal(icon180.height, 180);

 const indexHtml = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
 assert(indexHtml.includes('href="manifest.webmanifest"'), 'index.html missing manifest link');
 assert(indexHtml.includes('href="assets/icons/icon-180.png"'), 'index.html missing apple-touch-icon');
 assert(indexHtml.includes('src="scripts/pwa.js"'), 'index.html missing scripts/pwa.js');
}

async function testServiceWorker() {
 const swPath = path.join(gameDir, 'sw.js');
 const swCode = fs.readFileSync(swPath, 'utf8');
 const scope = 'https://example.test/cunjie-evolution/';
 const listeners = {};
 const cacheStore = new Map();
 const messages = [];
 let skipWaitCalled = false;
 let claimCalled = false;

 const openCache = async name => {
  if (!cacheStore.has(name)) cacheStore.set(name, new Map());
  const bucket = cacheStore.get(name);
  return {
   addAll: async urls => {
    for (const u of urls) bucket.set(u, { ok: true, status: 200, url: u, clone() { return this; } });
   },
   put: async (k, v) => {
    const key = typeof k === 'string' ? k : k.url;
    bucket.set(key, v);
   },
   match: async req => {
    const key = typeof req === 'string' ? req : req.url;
    if (bucket.has(key)) return bucket.get(key);
    if (key.startsWith(scope)) {
     const rel = './' + key.slice(scope.length).split('?')[0];
     return bucket.get(rel);
    }
    return undefined;
   },
  };
 };

 const sandbox = {
  URL,
  Response: { error: () => ({ ok: false, status: 504 }) },
  caches: {
   open: openCache,
   keys: async () => [...cacheStore.keys()],
   delete: async name => cacheStore.delete(name),
  },
  fetch: async req => {
   const url = typeof req === 'string' ? req : req.url;
   if (sandbox.__offline) throw new Error('offline');
   return { ok: true, status: 200, url, clone() { return this; } };
  },
  self: {
   registration: { scope },
   addEventListener: (type, fn) => { listeners[type] = fn; },
   skipWaiting: async () => { skipWaitCalled = true; },
   clients: {
    claim: async () => { claimCalled = true; },
    matchAll: async () => [{ postMessage: msg => messages.push(msg) }],
   },
  },
  __offline: false,
 };
 sandbox.globalThis = sandbox;
 vm.runInNewContext(`${swCode}\nthis.__exported = { CORE_ASSETS, ALL_ASSETS, CACHE_NAME };`, sandbox);

 const { CORE_ASSETS, ALL_ASSETS, CACHE_NAME } = sandbox.__exported;
 assert(ALL_ASSETS.length >= CORE_ASSETS.length && CORE_ASSETS.length >= 10, 'Asset lists look incomplete');
 for (const asset of ALL_ASSETS) {
  assert(!asset.startsWith('/'), `SW asset must be relative: ${asset}`);
  if (asset !== './') {
   const fp = path.join(gameDir, asset.slice(2).replace(/\//g, path.sep));
   assert(fs.existsSync(fp), `SW listed non-existent asset: ${asset}`);
  }
 }

 const waits = [];
 listeners.install({ waitUntil: p => waits.push(p) });
 await Promise.all(waits.splice(0));
 assert.equal(skipWaitCalled, true, 'SW install must call skipWaiting');
 assert.equal(cacheStore.get(CACHE_NAME).size, CORE_ASSETS.length);

 // Stale cache cleanup on activate
 cacheStore.set('cunjie-pwa-oldhash', new Map());
 listeners.activate({ waitUntil: p => waits.push(p) });
 await Promise.all(waits.splice(0));
 assert.equal(claimCalled, true, 'SW activate must call clients.claim');
 assert.equal(cacheStore.has('cunjie-pwa-oldhash'), false, 'Stale cache must be deleted');

 // GET_CACHE_STATUS before full cache
 const replyMsgs = [];
 listeners.message({
  data: { type: 'GET_CACHE_STATUS' },
  source: { postMessage: m => replyMsgs.push(m) },
  waitUntil: p => waits.push(p),
 });
 await Promise.all(waits.splice(0));
 assert.equal(replyMsgs[0].type, 'PWA_CACHE_STATUS');
 assert.equal(replyMsgs[0].done, CORE_ASSETS.length);
 assert.equal(replyMsgs[0].total, ALL_ASSETS.length);
 assert.equal(replyMsgs[0].ready, false);

 // CACHE_ALL warms every remaining asset
 listeners.message({
  data: { type: 'CACHE_ALL' },
  waitUntil: p => waits.push(p),
 });
 await Promise.all(waits.splice(0));
 const finalMsg = messages.at(-1);
 assert.equal(finalMsg.type, 'PWA_CACHE_PROGRESS');
 assert.equal(finalMsg.ready, true);
 assert.equal(finalMsg.done, ALL_ASSETS.length);
 assert.equal(finalMsg.total, ALL_ASSETS.length);

 // Offline fallback for navigation & cached asset
 sandbox.__offline = true;
 let navResp = null;
 listeners.fetch({
  request: { method: 'GET', mode: 'navigate', url: scope },
  respondWith: p => { navResp = p; },
  waitUntil: p => waits.push(p),
 });
 const resolvedNav = await navResp;
 assert.equal(resolvedNav.ok, true, 'Offline navigation must resolve from cache');

 let assetResp = null;
 listeners.fetch({
  request: { method: 'GET', mode: 'no-cors', url: scope + 'assets/icons/icon-192.png' },
  respondWith: p => { assetResp = p; },
  waitUntil: p => waits.push(p),
 });
 const resolvedAsset = await assetResp;
 assert.equal(resolvedAsset.ok, true, 'Offline asset must resolve from cache');
}

function testClientFileProtocolGuard() {
 const clientCode = fs.readFileSync(path.join(gameDir, 'scripts', 'pwa.js'), 'utf8');
 const fileSandbox = {
  window: {},
  location: { protocol: 'file:' },
  document: { createElement() { throw new Error('Should not touch DOM under file://'); } },
 };
 vm.runInNewContext(clientCode, fileSandbox);
 assert.equal(fileSandbox.window.__cunjiePwa, undefined, 'pwa.js must be a clean no-op under file://');
}

async function main() {
 await testManifestAndHtml();
 await testServiceWorker();
 testClientFileProtocolGuard();
 console.log('PWA tests passed: manifest, icons, SW two-tier cache, offline fetch fallback, and file:// guard.');
}

main().catch(err => {
 console.error(err);
 process.exitCode = 1;
});
