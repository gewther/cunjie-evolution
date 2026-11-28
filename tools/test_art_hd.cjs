'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const releaseGame = path.join(root, 'dist-release', 'game');

function parseWebpDimensions(filePath) {
 const buf = fs.readFileSync(filePath);
 assert(buf.length >= 30, `File too small to be WebP: ${filePath}`);
 assert.equal(buf.toString('ascii', 0, 4), 'RIFF', `Missing RIFF header: ${filePath}`);
 assert.equal(buf.toString('ascii', 8, 12), 'WEBP', `Missing WEBP header: ${filePath}`);
 const chunk = buf.toString('ascii', 12, 16);
 if (chunk === 'VP8X') {
  const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
  const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
  return { width, height, chunk };
 }
 if (chunk === 'VP8L') {
  const bits = buf.readUInt32LE(21);
  const width = (bits & 0x3FFF) + 1;
  const height = ((bits >> 14) & 0x3FFF) + 1;
  return { width, height, chunk };
 }
 if (chunk === 'VP8 ') {
  assert.equal(buf[23], 0x9d);
  assert.equal(buf[24], 0x01);
  assert.equal(buf[25], 0x2a);
  const width = buf.readUInt16LE(26) & 0x3FFF;
  const height = buf.readUInt16LE(28) & 0x3FFF;
  return { width, height, chunk };
 }
 throw new Error(`Unsupported WebP chunk ${chunk} in ${filePath}`);
}

function testAssets() {
 const checks = [
  ['assets/tinies/tinies-hd-v1.webp', 2048, 512],
  ['assets/rooms/bedside-hd.webp', 1280, 768],
  ['assets/rooms/bedside-hd-fever.webp', 1280, 768],
 ];
 for (const skin of ['aj5', 'qiaodan', 'socks', 'paws']) {
  for (let i = 0; i < 11; i++) checks.push([`assets/${skin}-hd/${i}.webp`, 480, 768]);
 }
 for (const [rel, ew, eh] of checks) {
  const rootFp = path.join(root, rel);
  const relFp = path.join(releaseGame, rel);
  assert(fs.existsSync(rootFp), `Missing root asset: ${rel}`);
  assert(fs.existsSync(relFp), `Missing release asset: ${rel}`);
  const rootBuf = fs.readFileSync(rootFp);
  const relBuf = fs.readFileSync(relFp);
  assert(rootBuf.equals(relBuf), `Root/release asset mismatch: ${rel}`);
  const dims = parseWebpDimensions(relFp);
  assert.equal(dims.width, ew, `Unexpected width for ${rel}`);
  assert.equal(dims.height, eh, `Unexpected height for ${rel}`);
 }
 for (let i = 0; i < 11; i++) {
  const rel = `assets/aj6-hd/${i}.webp`;
  const dims = parseWebpDimensions(path.join(releaseGame, rel));
  assert(dims.width >= 480 && dims.height >= 768, `Unexpected AJ6 HD dims: ${rel}`);
 }

 const geo = JSON.parse(fs.readFileSync(path.join(root, 'src', 'art-hd-geo.json'), 'utf8'));
 for (const key of ['aj5hd', 'qiaodanhd', 'sockshd', 'pawshd']) {
  const entry = geo[key];
  assert(entry, `Missing geo entry ${key}`);
  assert.equal(entry.frontOffsets.length, 6);
  assert.equal(entry.backOffsets.length, 5);
  assert.equal(entry.frontContact.length, 6);
  assert.equal(entry.backContact.length, 5);
  for (const [cx, rx] of [...entry.frontContact, ...entry.backContact]) {
   assert(cx >= 0 && cx <= 1 && rx > 0 && rx <= 1, `Invalid contact pair in ${key}`);
  }
 }
}

function testReleasePathsAndAnchors() {
 const scanFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'scripts/host-2.js',
  'scripts/impact-host-3.js',
  'scripts/touch-v1-impact-host-1.js',
  'scripts/fenrir-scene-v1.js',
  'data/04-images-boot.js',
  'data/04-images-deferred.js',
  'data/touch-v1-impact.js',
  'data/touch-v1-free.js',
 ];
 for (const rel of scanFiles) {
  const content = fs.readFileSync(path.join(releaseGame, rel), 'utf8');
  assert(!/(?<![.])\/assets\//.test(content), `Found forbidden root-absolute /assets/ path in ${rel}`);
 }

 const anchor = 'ptime = performance.now();\nmainloop();';
 for (const name of ['touch-v1-impact.js', 'touch-v1-free.js']) {
  const raw = fs.readFileSync(path.join(releaseGame, 'data', name), 'utf8');
  const html = JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;$/, ''));
  assert(html.includes('/* ART_OVERHAUL_V1_BEGIN */'), `${name} missing ART_OVERHAUL_V1_BEGIN`);
  assert(html.includes('/* ART_OVERHAUL_V1_END */'), `${name} missing ART_OVERHAUL_V1_END`);
  assert.equal(html.split(anchor).length, 2, `${name} must contain exact 1 mainloop anchor`);
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
   if (m[1].trim()) new vm.Script(m[1], { filename: `${name}-inner.js` });
  }
 }
}

async function testRuntimeBehavior() {
 const geo = JSON.parse(fs.readFileSync(path.join(root, 'src', 'art-hd-geo.json'), 'utf8'));
 const code = fs.readFileSync(path.join(root, 'src', 'art-overhaul-v1.js'), 'utf8')
  .replace('__XL_HD_GEO__', JSON.stringify(geo));

 function makeSandbox({ story = false, customMotion = false, fenrir = false, shoeSkin = 'aj5', profile = 'sneakers', roomTheme = 'rooftop-day' } = {}) {
  const drawCalls = [];
  const spriteCalls = [];
  const occOps = [];
  const textures = new Map();
  const baseSkin = (customMotion ? 'fenrir' : (story ? (realm => realm === 1 ? 'socks' : realm === 2 ? 'paws' : shoeSkin)(story === true ? 0 : story.realmIndex) : (profile === 'sneakers' ? shoeSkin : profile)));
  const XL_SKIN_GEO = {
   aj5: { frontOffsets: [2,2,2,2,2,2], backOffsets: [2,2,3,1,2], frontContact: [], backContact: [] },
   aj6: { frontOffsets: [4,2,2,4,4,4], backOffsets: [10,10,4,8,9], frontContact: [], backContact: [] },
   qiaodan: { frontOffsets: [3,3,3,3,7,7], backOffsets: [2,2,2,3,2], frontContact: [], backContact: [] },
   socks: { frontOffsets: [2,2,2,2,2,2], backOffsets: [2,2,2,2,2], frontContact: [], backContact: [] },
   paws: { frontOffsets: [19,24,2,18,25,2], backOffsets: [23,28,2,21,35], frontContact: [], backContact: [] },
   fenrir: { frontOffsets: [10,7,5,2,2,2], backOffsets: [2,2,2,2,2], frontContact: [], backContact: [] },
  };
  const XL_GEOMETRY = { sneakers: XL_SKIN_GEO.aj5, socks: XL_SKIN_GEO.socks, paws: XL_SKIN_GEO.paws };

  class Endless { draw_scene() { occOps.push('orig_scene'); } draw_ui() { occOps.push(set.show_pressure ? 'orig_pressure_drawn' : 'orig_pressure_suppressed'); } }
  class EndScreen { draw_scene() {} }

  const set = { show_pressure: true, bg_spr: [fenrir ? 'fenrirCity' : 'env', 0, 0, 400, 240] };
  const occ = {
   save: () => occOps.push('save'),
   restore: () => occOps.push('restore'),
   setTransform: () => {},
   beginPath: () => {},
   moveTo: () => {},
   lineTo: () => {},
   quadraticCurveTo: () => {},
   closePath: () => {},
   fill: () => occOps.push('fill'),
   stroke: () => occOps.push('stroke'),
   createLinearGradient: () => ({ addColorStop: () => {} }),
   fillText: t => occOps.push('text:' + t),
  };

  const sandbox = {
   Math, Number, Array, Object, Map, Set, Promise, JSON, Error, setTimeout, clearTimeout,
   window: {
    __cunjieShoeSkin: shoeSkin,
    __cunjieRoomTheme: roomTheme,
    parent: { DATA: null, localStorage: { getItem: () => null } },
    xlGetHdFrame: () => null,
   },
   Image: class {
    set src(u) {
     this._src = u;
     this.naturalWidth = u.includes('tinies') ? 2048 : u.includes('rooftop') || u.includes('rooms') ? 1280 : 480;
     this.naturalHeight = u.includes('tinies') ? 512 : (u.includes('rooftop') || u.includes('rooms')) ? 768 : 768;
     queueMicrotask(() => this.onload && this.onload());
    }
   },
   new_texture: img => ({ w: img.naturalWidth || 480, h: img.naturalHeight || 768, smooth: false }),
   render: () => {},
   clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
   ceil: Math.ceil,
   round: Math.round,
   textures,
   customMotionSource: customMotion ? 'fenrir.png' : '',
   fenrirCity: fenrir,
   XL_SKIN_GEO,
   XL_GEOMETRY,
   xlActiveProfile: { id: profile },
   xlHdPacks: new Map(),
   xlActiveSlotKey: () => customMotion ? 'character' : (profile === 'sneakers' ? 'shoe' : profile),
   xlSkinId: () => baseSkin,
   xlSkinGeo: () => XL_SKIN_GEO[sandbox.xlSkinId()],
   xlModeFade: 1,
   xlFloorGfx: story ? { ready: () => true, drawTinyShadow: (...a) => occOps.push(['shadow', ...a]), drawFloorWash: () => occOps.push('wash') } : { ready: () => false, drawFloorWash: () => occOps.push('wash') },
   paw: { width: 160, offset: 0, front_spr: ['giant', 0, 0, 160, 256], steamroller: false },
   paw_x: 200, paw_y: 228, paw_dest_y: 240, paw_y_velo: 500, paw_state: 3, stomp_frame: 0, supports: 0, pressure: 0.72, pin_min_y: 228, floor_y: 228,
   hide_paws: false, active: true, pause: false, tr: false, exhausted: false, w: 400, h: 240, sc: 2, alpha: 1, hflip: false, tick: 10, bug_max_hp: 5, stats: { time_elapsed: 1 },
   set, occ,
   draw: () => { new Endless().draw_ui(); },
   Endless: story ? undefined : Endless,
   EndScreen: story ? undefined : EndScreen,
   set_fit: f => f,
   unset_fit: () => occOps.push('unset_fit'),
   sprite: (...a) => spriteCalls.push(a),
   sprite_scaled: (...a) => drawCalls.push(a),
   darkrect: (...a) => occOps.push(['darkrect', ...a]),
   draw_stickers: () => {},
   draw_front_paw: () => drawCalls.push(['orig_front']),
   draw_bug: () => drawCalls.push(['orig_bug']),
   draw_fallers: () => drawCalls.push(['orig_fallers']),
   fallers: [{ x: 180, y: 120, frame: 1, xv: 12 }],
   v4Bodies: [{ x: 150, y: 227, age: 1, variant: 2 }],
  };
  if (story) {
   sandbox.realmIndex = typeof story === 'object' ? story.realmIndex : 0;
   sandbox.realmAfterFx = { shoeSkin, enabled: true };
   sandbox.realmVisual = () => ({ tinyScale: 1, footScale: 1 });
   sandbox.realmFrameGeometry = (frame, off = 0) => ({ frame, x: 120, y: 228 + off - 256, w: 160, h: 256, scale: 1 });
   sandbox.realmDebug = false;
   sandbox.realmPrefs = { impactFx: true };
   sandbox.realmMood = { reduceMotion: false, lowEffects: false };
   sandbox.window.v4HasBody = () => false;
   sandbox.window.v4DrawBodies = () => drawCalls.push(['orig_v4bodies']);
  } else {
   sandbox.xlFreeContact = { grounded: true, squash: () => 0.1 };
  }
  sandbox.window.textures = textures;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return { sandbox, drawCalls, spriteCalls, occOps, textures, Endless };
 }

 // Test 1: Story Act I AJ5 -> loads aj5-hd, xlSkinId switches to aj5hd after async load, airborne uses HD
 const s1 = makeSandbox({ story: { realmIndex: 0 }, shoeSkin: 'aj5' });
 assert.equal(s1.sandbox.xlSkinId(), 'aj5');
 assert.equal(s1.sandbox.window.xlGetHdFrame(0), null);
 await new Promise(r => setImmediate(r));
 await new Promise(r => setImmediate(r));
 assert.equal(s1.sandbox.xlSkinId(), 'aj5hd', 'xlSkinId should promote to aj5hd once 11 HD frames load');
 assert.equal(s1.sandbox.window.xlGetHdFrame(3), 'xl-art-hd-aj5-3');
 s1.sandbox.paw_state = 1;
 s1.sandbox.pin_min_y = 64;
 s1.sandbox.pressure = 0;
 s1.sandbox.draw_front_paw();
 assert(s1.drawCalls.some(c => c[0][0] === 'xl-art-hd-aj5-1'), 'Airborne Act I AJ5 should render HD frame with trails');

 // Test 2: Story Act III paws -> 5 toe slices of pawshd + tinies_hd_v1 + v4DrawBodies
 const s3 = makeSandbox({ story: { realmIndex: 2 } });
 s3.sandbox.paw_state = 3;
 s3.sandbox.pin_min_y = 228;
 s3.sandbox.pressure = 0.72;
 await new Promise(r => setImmediate(r));
 await new Promise(r => setImmediate(r));
 assert.equal(s3.sandbox.xlSkinId(), 'pawshd');
 s3.sandbox.draw_front_paw();
 const toeDraws = s3.drawCalls.filter(c => c[0][0].startsWith('xl-art-hd-paws-'));
 assert.equal(toeDraws.length, 6, 'Act III grounded paw should draw 1 upper slice + 5 bottom toe wiggle strips');

 // Tinies HD in Story Mode
 const bugA = { xlId: 42, x: 140, y: 220, z: 0, dir: -1, health: 5, tick: 12, x_vel: 0 };
 s1.sandbox.draw_bug(bugA);
 const tiniesCall = s1.drawCalls.find(c => c[0][0] === 'tinies_hd_v1');
 assert(tiniesCall, 'draw_bug should draw from tinies_hd_v1');
 assert.equal(tiniesCall[0][3], 128);
 assert.equal(tiniesCall[0][4], 128);
 s1.sandbox.window.v4DrawBodies();
 assert(s1.drawCalls.some(c => c[0][0] === 'tinies_hd_v1' && c[0][3] === 100 && c[0][4] === 56), 'v4DrawBodies should draw prone HD crop');
 s1.sandbox.draw_fallers();
 assert(s1.drawCalls.some(c => c[0][0] === 'tinies_hd_v1' && c[0][2] === 384), 'draw_fallers should draw row 3 tumbling cells');

 // Test 3: Fenrir safety -> customMotionSource prevents hijacking Fenrir sprites/geometry/tinies
 const fEnv = makeSandbox({ story: false, customMotion: true, fenrir: true });
 await new Promise(r => setImmediate(r));
 assert.equal(fEnv.sandbox.xlSkinId(), 'fenrir');
 assert.equal(fEnv.sandbox.window.xlGetHdFrame(0), null);
 fEnv.sandbox.draw_front_paw();
 assert.deepEqual(fEnv.drawCalls, [['orig_front']], 'Fenrir custom motion must preserve original draw_front_paw');

 // Test 4: Free Mode Qiaodan + HD Backdrop + Vector Pressure Gauge
 const freeEnv = makeSandbox({ story: false, shoeSkin: 'qiaodan', roomTheme: 'rooftop-day' });
 await new Promise(r => setImmediate(r));
 await new Promise(r => setImmediate(r));
 assert.equal(freeEnv.sandbox.xlSkinId(), 'qiaodanhd');
 assert.equal(freeEnv.sandbox.window.xlGetHdFrame(6), 'xl-art-hd-qiaodan-6');
 const endless = new freeEnv.Endless();
 endless.draw_scene();
 assert(freeEnv.drawCalls.some(c => c[0][0] === 'xl-free-room-rooftop-day' && c[3] === 400 && c[4] === 240), 'Endless.draw_scene should draw HD room backdrop');
 freeEnv.sandbox.draw();
 assert(freeEnv.occOps.includes('orig_pressure_suppressed'), 'Original pixelated pressure meter must be suppressed when vector bar draws');
 assert(freeEnv.occOps.includes('text:72%'), 'Crisp vector pressure bar must render numeric percentage');

 // Test 5: Free Impact + HD Airborne Motion Trails respect reduceMotion/lowEffects and preserve paw.width/aspect ratio
 const trailEnv = makeSandbox({ story: false, shoeSkin: 'aj5' });
 const freeImpactCode = fs.readFileSync(path.join(root, 'src', 'free-impact-v6.js'), 'utf8');
 trailEnv.sandbox.CunjieContactFeel = class { update() { return null; } punch() { return 0; } squash() { return 0; } };
 trailEnv.sandbox.xlGfxPrefs = { shake: true };
 trailEnv.sandbox.oc = { style: {} };
 trailEnv.sandbox.update_paw = () => {};
 trailEnv.sandbox.set_yoff = () => {};
 trailEnv.sandbox.floor = Math.floor;
 trailEnv.sandbox.uxoff = 0;
 trailEnv.sandbox.uyoff = 0;
 trailEnv.sandbox.paw_y_velo = 650;
 trailEnv.sandbox.paw_state = 1;
 trailEnv.sandbox.paw.width = 160;
 trailEnv.sandbox.paw.front_spr = ['giant', 0, 0, 160, 256, 0, 3];
 trailEnv.sandbox.draw_front_paw = () => trailEnv.drawCalls.push(['orig_front']);
 trailEnv.sandbox.window.__cunjieArtOverhaulV1 = false;
 trailEnv.sandbox.xlGetHdFrame = (...a) => trailEnv.sandbox.window.xlGetHdFrame(...a);
 vm.runInNewContext(freeImpactCode + '\n' + code, trailEnv.sandbox);
 trailEnv.sandbox.xlFreeContact.grounded = false;

 // 5a: Legacy pre-load airborne draws 3 trails + orig_front with dw=160, dh=256
 trailEnv.drawCalls.length = 0;
 trailEnv.sandbox.draw_front_paw();
 assert.equal(trailEnv.drawCalls.length, 4, 'Legacy airborne draw_front_paw must emit 3 trails + main foot');
 assert.equal(trailEnv.drawCalls[0][3], 160, 'Trail width must equal paw.width');
 assert(trailEnv.drawCalls[0][4] > 256 && trailEnv.drawCalls[0][4] < 270, 'Trail height must scale by 256/160 aspect ratio');

 // 5b: HD airborne normal vs reduceMotion vs lowEffects
 await new Promise(r => setImmediate(r));
 await new Promise(r => setImmediate(r));
 trailEnv.drawCalls.length = 0;
 trailEnv.sandbox.draw_front_paw();
 const hdAirDraws = trailEnv.drawCalls.filter(c => Array.isArray(c[0]) && c[0][0] === 'xl-art-hd-aj5-1');
 assert.equal(hdAirDraws.length, 4, 'HD airborne Free Mode must draw 3 trails + 1 main foot');
 assert.equal(hdAirDraws[3][3], 160);
 assert.equal(hdAirDraws[3][4], 256);

 trailEnv.drawCalls.length = 0;
 trailEnv.sandbox.window.__xlImmersionPrefs = { reduceMotion: true, lowEffects: false };
 trailEnv.sandbox.draw_front_paw();
 assert.equal(trailEnv.drawCalls.filter(c => Array.isArray(c[0]) && c[0][0] === 'xl-art-hd-aj5-1').length, 1, 'reduceMotion must suppress HD trails while keeping main foot');

 trailEnv.drawCalls.length = 0;
 trailEnv.sandbox.window.__xlImmersionPrefs = { reduceMotion: false, lowEffects: true };
 trailEnv.sandbox.draw_front_paw();
 assert.equal(trailEnv.drawCalls.filter(c => Array.isArray(c[0]) && c[0][0] === 'xl-art-hd-aj5-1').length, 1, 'lowEffects must suppress HD trails while keeping main foot');
}

function testHostAndOffline() {
 // RealmRenderer unit test with hdPose3, hdPose6, tiniesHd
 const host2Code = fs.readFileSync(path.join(releaseGame, 'scripts', 'host-2.js'), 'utf8');
 const draws = [];
 const mockCtx = {
  save: () => {}, restore: () => {}, scale: () => {}, translate: () => {}, setTransform: () => {},
  clearRect: () => {}, fillRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
  drawImage: (...args) => draws.push(args),
 };
 const hSandbox = { globalThis: {} };
 hSandbox.globalThis = hSandbox;
 vm.runInNewContext(host2Code, hSandbox);
 const rr = new hSandbox.RealmRenderer(
  { getContext: () => mockCtx, getBoundingClientRect: () => ({ width: 1000, height: 600 }), width: 1000, height: 600 },
  {
   stage1Normal: { width: 1280, height: 768 },
   tiniesHd: { width: 2048, height: 512 },
   hdPose3: { aj6: { width: 480, height: 768 }, paws: { width: 480, height: 768 } },
   hdPose6: { aj6: { width: 480, height: 768 } },
  }
 );
 rr.width = 1000; rr.height = 600;
 hSandbox.globalThis.__cunjieSelectedShoe = 'aj6';
 rr.floorPreview(0);
 assert(draws.some(a => a[0].width === 480 && a[1] === 0 && a[5] === 290), 'floorPreview(0) should use hdPose3 for selected shoe');
 assert(draws.some(a => a[0].width === 2048 && a[3] === 128 && a[4] === 128), 'floorPreview should draw tiniesHd cells');

 const offlinePath = path.join(root, 'dist', 'cunjie-offline.html');
 if (fs.existsSync(offlinePath)) {
  const off = fs.readFileSync(offlinePath, 'utf8');
  assert(off.includes('DATA["tiniesHd"]="data:image/webp;base64,'), 'Offline HTML missing DATA.tiniesHd');
  assert(off.includes('DATA["skinHd"]={"aj5":['), 'Offline HTML missing DATA.skinHd');
  assert(off.includes('DATA["rooms"]={"rooftop-day":"data:image/webp;base64,'), 'Offline HTML missing DATA.rooms');
  assert(off.includes('/* ART_OVERHAUL_V1_BEGIN */'), 'Offline HTML missing ART_OVERHAUL_V1 runtime');
 }
}

async function main() {
 testAssets();
 testReleasePathsAndAnchors();
 await testRuntimeBehavior();
 testHostAndOffline();
 console.log('HD art overhaul tests passed: 47 WebPs validated, zero /assets/ leaks, Story/Free/Fenrir VM + RealmRenderer + offline HTML verified.');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
