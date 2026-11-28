'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const source = read('src/scene-lighting-v1.js');
const renderer = read('src/realm-renderer.js').trim();

const calls = [];
const context = {
 window: {__cunjieRoomTheme: 'rooftop-day'},
 paw: {front_spr: ['giant', 0, 0, 160, 256, true, 3],
  back_spr: ['giant', 320, 0, 160, 256, true, 3], back_paw_y: .75},
 h: 240, floor_y: 200, floor_depth: 8,
 uxoff: 0, uyoff: 0, hflip: false,
 textures: new Map([['xl-art-hd-paws-3', {w: 480, h: 768}]]),
 xlSkinGeo: () => ({frontOffsets: [2, 2, 2, 2, 2, 2], backOffsets: [2, 2, 2, 2, 2]}),
 draw_front_paw(...args) {
  const result = context.window.__xlSceneLighting.gains(...args);
  return result && Array.from(result);
 },
 draw_back_paw(...args) {
  const result = context.window.__xlSceneLighting.gains(...args);
  return result && Array.from(result);
 },
 document: {
  createElement(tag) {
   assert.equal(tag, 'canvas');
   calls.push(tag);
   return {width: 300, height: 150, getContext() {
    return {clearRect() {}, fillRect() {}, drawImage() {}, createLinearGradient() {
     calls.push('gradient');
     return {addColorStop() {}};
    }};
   }};
  },
 },
};
vm.runInNewContext(source, context);
const lighting = context.window.__xlSceneLighting;
const front = y => context.draw_front_paw(context.paw.front_spr, y, 256, 0, 0, 160, 256);

const warm = front(-54);
const airborne = front(-250);
assert(warm[6] > warm[8], 'sunset warms the sole');
assert(warm[7] > airborne[7], 'ground bounce weakens when the same frame lifts');
assert.equal(warm[0], airborne[0], 'lighting at the top does not change with height');
context.window.__cunjieRoomTheme = 'rooftop-night';
const cold = front(-54);
assert(cold[8] > cold[6], 'room switch applies night lighting');
assert.equal(lighting.getSceneLightingProfile('rooftop-day').shadowDirection, 1);
assert.equal(lighting.getSceneLightingProfile('rooftop-night').shadowDirection, -1);
context.window.__cunjieRoomTheme = 'rain';
assert.notDeepEqual(front(-54), cold, 'wet floor has its own response');
context.realmIndex = 2;
const bedside = front(-54);
assert(bedside[0] > bedside[3] && bedside[5] > bedside[3], 'warm left light within cold room');
context.window.__xlImmersionPrefs = {lowEffects: true};
const low = front(-54);
assert.equal(low[0], low[3], 'low effects drops side gradients');
assert(low[7] > low[1], 'low effects keeps ground lighting');
context.window.__xlImmersionPrefs = {reduceMotion: true, impactFx: false};
assert.deepEqual(front(-54), bedside, 'ambient light remains under motion/impact settings');
context.realmIndex = 1;
assert.notDeepEqual(front(-54), bedside);

context.realmIndex = undefined;
context.fenrirCity = true;
context.customMotionSource = 'assets/fenrir/fenrir-motion-v3.png';
const fenrir = front(-54);
assert(fenrir[8] > fenrir[6], 'Fenrir atlas receives its own blue-hour profile');
const rear = context.paw.back_spr;
assert.deepEqual(context.draw_back_paw(rear, -68, 256, 320, 0, 160, 256), fenrir);
assert.equal(context.draw_front_paw(['giant'], 0, 256, 320, 0, 160, 256), null, 'rear atlas cells do not light during front draw');
assert.equal(context.draw_front_paw(['giant'], 0, 32, 0, 0, 32, 32), null, 'unrelated atlas sprites stay original');
assert.equal(lighting.gains(context.paw.front_spr, 0, 256, 0, 0, 160, 256), null, 'lighting scope closes');
context.fenrirCity = false;
assert.equal(front(-54), null, 'imported character motion remains original');
context.customMotionSource = '';
context.custom = true;
assert.equal(front(-54), null, 'custom upload remains original');
context.custom = false;

context.realmIndex = 2;
const hd = ['xl-art-hd-paws-3'];
const left = context.draw_front_paw(hd, -54, 128, 0, 0, 240, 384);
const right = context.draw_front_paw(hd, -54, 128, 240, 0, 240, 384);
assert.deepEqual(left.slice(3, 6), right.slice(0, 3), 'adjacent HD slices share side lighting');
context.hflip = true;
const mirrored = context.draw_front_paw(hd, -54, 128, 0, 0, 240, 384);
assert.deepEqual(mirrored.slice(0, 3), right.slice(0, 3), 'side light stays fixed in scene when mirrored');
const canvasTarget = {drawImage() {}};
lighting.paintLitSprite(canvasTarget, {}, 0, 0, 480, 768, 0, 0, 160, 256, mirrored, true);
assert.equal(calls.filter(x => x === 'gradient').length, 3);
context.window.__xlImmersionPrefs.lowEffects = true;
const lowHd = context.draw_front_paw(hd, -54, 256, 0, 0, 480, 768);
lighting.paintLitSprite(canvasTarget, {}, 0, 0, 480, 768, 0, 0, 160, 256, lowHd, false);
assert.equal(calls.filter(x => x === 'gradient').length, 4);
assert.equal(calls.filter(x => x === 'canvas').length, 1, 'fallback reuses its scratch canvas');

const atlasTile = ['giant', 0, 0, 160, 256, true, 3];
let drawnQuad;
const atlasDraw = {
 textures: new Map([['giant', {}]]),
 set_texture() {},
 uxoff: 0, uyoff: 0, floor: Math.floor,
 quad(...args) { drawnQuad = args; },
};
vm.runInNewContext(renderer.slice(renderer.indexOf('function sprite(')), atlasDraw);
atlasDraw.sprite(atlasTile, 0, 228, 2, 0, 1);
assert.deepEqual(drawnQuad, [0, -28, 160, 256, 0, 512, 160, 256, atlasTile],
 'unscaled atlas sprites send the crop size before the optional lighting descriptor');

for (const kind of ['impact', 'free']) {
 const bundle = read(`dist-release/game/data/touch-v1-${kind}.js`);
 const html = JSON.parse(bundle.slice(bundle.indexOf('=') + 1).trim().replace(/;$/, ''));
 assert(html.includes(renderer), `${kind} generated renderer is synchronized`);
 assert(html.includes(source.trim()), `${kind} generated lighting is synchronized`);
 assert.equal(html.split('function installRealmRenderer()').length, 2);
 assert.equal(html.split('function installSceneLighting()').length, 2);
}

console.log('Scene lighting tests passed: phase, height, back foot, atlas/HD scope, mirroring, Canvas fallback and release wiring.');
