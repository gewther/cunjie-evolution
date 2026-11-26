'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'dist-release', 'game');
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const host = read(game, 'scripts/impact-host-3.js');
const scene = read(game, 'scripts/fenrir-scene-v1.js');
const controls = read(root, 'src/fenrir-controls.js');
const bridge = read(root, 'src/fenrir-scene-bridge.js');
assert.equal(scene, read(root, 'src/fenrir-scene-v1.js'));

const names = ['far', 'mid', 'near'];
for (const name of names) {
 const file = 'assets/fenrir/city-' + name + '.svg';
 const svg = read(game, file);
 assert.equal(svg, read(root, file));
 assert.match(svg, /<svg[^>]*width="2400"[^>]*height="240"[^>]*viewBox="0 0 2400 240"/);
 assert(svg.trim().endsWith('</svg>'));
}
const near = read(game, 'assets/fenrir/city-near.svg');
assert(near.includes('M0 194H2400V240H0Z'));
assert(near.includes('M20 228h42'), 'lane markings align with the contact plane');

const legacyData = read(game, 'data/touch-v1-free.js');
const legacy = JSON.parse(legacyData.slice(legacyData.indexOf('=') + 1).trim().replace(/;$/, ''));
const anchor = 'ptime = performance.now();\nmainloop();';
assert.equal(legacy.split(anchor).length, 2);
const fn = host.slice(host.indexOf('function injectHttpBase'), host.indexOf('function paintShoePreviews'));
const placement = {
 DATA: {freeLegacy: legacy, images: {}},
 location: {protocol: 'https:', href: 'https://example.test/cunjie-evolution/'},
 URL, console
};
vm.runInNewContext(fn, placement);
const rendered = placement.legacySource('free', 'motion.png', true);
assert(rendered.includes('<base href="https://example.test/cunjie-evolution/">'));
assert(rendered.includes('<script src="scripts/fenrir-scene-v1.js"></script>'));
assert(rendered.includes(controls + bridge + anchor));
for (const script of rendered.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(script[1]);
assert(!placement.legacySource('free', 'custom.png', false).includes(bridge));
assert(!placement.legacySource('free', 'custom.png', false).includes(controls));
assert(!placement.legacySource('free', 'custom.png', false).includes('scripts/fenrir-scene-v1.js'));

function createScene({textureLimit = 4096, failMid = false} = {}) {
 let tick = 1000;
 const original = ['fenrirCity', 0, 0, 400, 240];
 const textures = new Map();
 const calls = [], urls = [], deleted = [], warnings = [];
 const pose = {
  grounded: true, supported: false, floorY: 228, width: 160, offset: 0,
  frameHeight: 256, texture: 'giant', soleOffset: 2, contactCenter: 0.54,
  force: 0.8, age: 0, pressure: 0.9
 };
 const window = {__xlImmersionPrefs: {}};
 const sandbox = {
  window, URL, document: {baseURI: 'https://example.test/cunjie-evolution/'},
  performance: {now: () => tick += 16},
  console: {warn: (...args) => warnings.push(args)},
  Image: class {
   set src(url) {
    urls.push(url);
    this.naturalWidth = 2400;
    this.naturalHeight = 240;
    queueMicrotask(() => failMid && url.endsWith('city-mid.svg') ? this.onerror() : this.onload());
   }
  }
 };
 let pawX = 200;
 vm.runInNewContext(scene, sandbox);
 const api = window.__installFenrirScene({
  spriteScaled: (...args) => calls.push(args), textures,
  newTexture: image => ({image}), deleteTexture: texture => deleted.push(texture),
  maxTextureSize: textureLimit, w: 400, h: 240,
  getPawX: () => pawX, getGroundPose: () => pose
 });
 return {
  api, window, textures, calls, urls, deleted, warnings, pose, original,
  status: window.__fenrirCitySceneV1Status,
  setPawX: x => pawX = x,
  draw: () => api.drawSprite(original, 0, 0, 400, 240)
 };
}

async function main() {
 const env = createScene();
 const {api, status, textures, calls, urls, window, pose} = env;
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(status.ready, true);
 assert.equal(status.maxScroll, 2000);
 assert.equal(textures.size, 3);
 assert(urls.every((url, index) => url === 'https://example.test/cunjie-evolution/assets/fenrir/city-' + names[index] + '.svg'));
 assert([...textures.values()].every(texture => texture.smooth));

 env.draw();
 assert.equal(status.cameraX, 1000);
 assert.deepEqual(calls.map(([sprite]) => sprite[0]), ['fenrirCityFarV1', 'fenrirCityMidV1', 'fenrirCityNearV1']);
 assert.deepEqual(calls.map(([sprite]) => sprite[1]), [120, 360, 1000]);

 env.setPawX(300);
 env.draw();
 const progress = (300 - 264) / 136;
 const base = 1000 + 1000 * progress ** 2 * (3 - 2 * progress);
 assert(status.targetX > base, 'positive motion leads the position-only target');
 assert(status.targetX - base <= 120, 'direction prediction remains capped');
 env.setPawX(0);
 for (let i = 0; i < 90; i++) env.draw();
 assert(status.cameraX < 1);
 env.setPawX(263);
 env.draw();
 const leftCamera = status.cameraX;
 env.setPawX(265);
 env.draw();
 assert(Math.abs(status.targetX - leftCamera) < 5, 'leaving the dead zone from the opposite side does not snap to the middle');

 const foot = ['giant', 160, 0, 160, 256];
 const drawFoot = api.wrapFrontFoot(() => api.drawSprite(foot, 120, -23, 160, 256));
 drawFoot();
 let [, x, y, width, height] = calls.at(-1);
 const sole = y + height * (1 - 1 / 256);
 assert(Math.abs(sole - 228) < 0.001);
 assert(height < 250, 'a fresh landing compresses the leg about the sole');
 assert.equal(x + width * 0.54, status.lastFootContact.x);
 pose.age = 0.5;
 drawFoot();
 assert(calls.at(-1)[4] > height, 'the leg recovers as landing energy decays');
 pose.supported = true;
 drawFoot();
 assert.deepEqual(calls.at(-1), [foot, 120, -23, 160, 256], 'support contact keeps the original draw');
 pose.supported = false;

 const effects = {ready: () => true, drawContactPress() {}, drawImpactRing() {}};
 api.recordLanding({kind: 'landing', x: 200, at: 1, force: 0.8});
 env.setPawX(300);
 env.draw();
 api.drawRoadContact(effects, 1.01);
 assert(Math.abs(status.lastRoadMark.x - (120 + 160 * 0.54)) < 1e-8, 'the first mark starts under the foot using the current crop');
 const worldX = status.lastRoadMark.worldX;
 env.setPawX(300);
 env.draw();
 api.drawRoadContact(effects, 1.15);
 assert.equal(status.lastRoadMark.worldX, worldX);
 assert(Math.abs(status.lastRoadMark.x + status.cameraX - worldX) < 1e-8);

 // P5: heavy impacts leave longer-lived road imprints and delayed secondary ripples.
 const weighted = createScene();
 await new Promise(resolve => setImmediate(resolve));
 const wapi = weighted.api, wstatus = weighted.status;
 const presses = [], rings = [];
 const wetFx = {ready: () => true, drawContactPress: (...args) => presses.push(args), drawImpactRing: (...args) => rings.push(args)};
 wapi.recordLanding({kind: 'landing', x: 200, at: 1, force: 0.9});
 weighted.draw();
 wapi.drawRoadContact(wetFx, 1.2);
 assert.equal(rings.length, 2, 'a firm landing creates a delayed secondary water front');
 assert.equal(wstatus.weight.roadMarks, 1);
 rings.length = 0;
 presses.length = 0;
 wapi.drawRoadContact(wetFx, 2.3);
 assert.equal(rings.length, 0, 'short-lived waves stop before the road imprint');
 assert.equal(presses.length, 1, 'a wet contact imprint persists during recovery');
 wapi.drawRoadContact(wetFx, 4.21);
 assert.equal(wstatus.weight.roadMarks, 0, 'road marks expire');
 weighted.pose.supported = true;
 wapi.recordLanding({kind: 'landing', x: 200, at: 5, force: 1});
 wapi.drawRoadContact(wetFx, 5.01);
 assert.equal(wstatus.weight.roadMarks, 0, 'supported contact must not mark the road');
 weighted.pose.supported = false;
 for (let i = 0; i < 10; i++) {
  const at = 6 + i * 0.1;
  wapi.recordLanding({kind: 'landing', x: 200, at, force: 1});
  wapi.drawRoadContact(wetFx, at);
 }
 assert.equal(wstatus.weight.roadMarks, 6, 'particle/mark budget remains bounded');
 weighted.window.__xlImmersionPrefs.lowEffects = true;
 wapi.drawRoadContact(wetFx, 7.1);
 assert.equal(wstatus.weight.roadMarks, 0);
 weighted.window.__xlImmersionPrefs.lowEffects = false;
 wapi.drawRoadContact(wetFx, 7.2);
 assert.equal(wstatus.weight.roadMarks, 0, 'disabled effects never replay');
 wapi.recordLanding({kind: 'landing', x: 200, at: 7.3, force: 0.9});
 wapi.drawRoadContact(wetFx, 7.31);
 wapi.drawRoadContact(wetFx, 0.01);
 assert.equal(wstatus.weight.roadMarks, 0, 'clock reset clears prior run effects');

 const weightedDraw = wapi.wrapFrontFoot(() => wapi.drawSprite(foot, 120, -23, 160, 256));
 weighted.pose.age = 0;
 weighted.pose.force = 0.2;
 weightedDraw();
 const light = wstatus.weight.compression;
 weighted.pose.force = 0.9;
 weightedDraw();
 assert(wstatus.weight.compression > light, 'heavier impact increases suspension compression');
 assert(wstatus.weight.compression <= 0.058, 'visual compression is bounded');
 weighted.window.__xlImmersionPrefs.reduceMotion = true;
 weightedDraw();
 assert(wstatus.weight.compression < light, 'reduced motion preserves the sole anchor with minimal travel');

 window.__xlImmersionPrefs.lowEffects = true;
 api.drawRoadContact(effects, 1.16);
 assert.equal(status.lastRoadMark, null);
 window.__xlImmersionPrefs.reduceMotion = true;
 for (let i = 0; i < 120; i++) env.draw();
 assert(Math.abs(status.cameraX - 1000) < 1);
 assert.equal(status.pawVelocity, 0);

 api.drawSprite(['unrelated', 0, 0, 40, 40], 1, 2, 40, 40);
 assert.deepEqual(calls.at(-1), [['unrelated', 0, 0, 40, 40], 1, 2, 40, 40]);

 for (const options of [{failMid: true}, {textureLimit: 2048}]) {
  const failed = createScene(options);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(failed.status.failed, true);
  assert.equal(failed.textures.size, 0);
  assert.equal(failed.deleted.length, options.failMid ? 2 : 0);
  failed.draw();
  assert.deepEqual(failed.calls[0], [failed.original, 0, 0, 400, 240]);
 }
 console.log('Fenrir tests passed: release assets and host, actual iframe injection, camera continuity, sole anchor, world-space water, P5 settling and mark budget, and fallback.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
