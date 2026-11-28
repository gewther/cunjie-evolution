'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'fenrir-spatial-fx-v1.js'), 'utf8').replace(/\r\n/g, '\n');
const builder = fs.readFileSync(path.join(root, 'tools', 'build_fenrir_scene.cjs'), 'utf8');
assert(builder.includes("src', 'fenrir-spatial-fx-v1.js'"), 'release builder must inject the spatial FX bridge');
assert(builder.includes('spatialBridge + controls + bridge'), 'spatial FX must run after art code and before the Fenrir scene bridge');
new vm.Script(source, {filename: 'fenrir-spatial-fx-v1.js'});

function createScene() {
 const calls = [], overlays = [];
 const floor = {
  ready: () => true,
  drawContactPress: (...args) => calls.push(['press', ...args]),
  drawOval: (...args) => calls.push(['oval', ...args]),
  drawImpactRing: (...args) => calls.push(['ring', ...args])
 };
 const occ = {
  save() {}, restore() {}, setTransform() {}, beginPath() {},
  ellipse: (...args) => overlays.push(args), fill() {},
  globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: ''
 };
 const sandbox = {
  window: {
   __xlImmersionPrefs: {},
   __fenrirCitySceneV1Status: {ready: true, failed: false},
   __xlSceneLighting: {getSceneLightingProfile: () => ({shadowDirection: -1})},
   xlDrawImpactFloorPass() { calls.push(['base-floor']); return 'base-floor-result'; }
  },
  fenrirCity: true,
  floor_y: 228, paw_y: 140, paw_x: 200, paw: {width: 160},
  freeContact: {force: 0.8, pressure: 0.6, grounded: false},
  w: 400, active: true, pause: false, tr: false, hide_paws: false,
  xlFloorGfx: floor, occ, quality: {displayScaleX: 1, displayScaleY: 1}, sc: 1,
  draw_bug(b) { calls.push(['bug', b.x]); return 'bug-result'; },
  console
 };
 vm.runInNewContext(source, sandbox);
 return {sandbox, calls, overlays, floor};
}

const scene = createScene();
const result = scene.sandbox.window.xlDrawImpactFloorPass();
assert.equal(result, 'base-floor-result', 'the original floor pass result is preserved');
const snapshot = scene.sandbox.window.__fenrirSpatialFxV1.snapshot();
assert.equal(snapshot.active, true);
assert(snapshot.heightRatio > 0.4 && snapshot.heightRatio < 0.6, 'shadow softness responds to foot height');
assert(snapshot.shadowX < 200, 'blue-hour projection travels away from the right-side key light');
assert(snapshot.shadowWidth > 80, 'the airborne shadow expands');
assert(scene.calls.some(c => c[0] === 'press'), 'the broad contact shadow is drawn');
assert(scene.calls.some(c => c[0] === 'oval'), 'wet-road reflection bands are drawn');
assert(snapshot.reflections >= 2);

const before = scene.overlays.length;
scene.sandbox.draw_bug({x: snapshot.shadowX, y: 228, z: 0});
assert.equal(scene.overlays.length, before + 1, 'a civilian inside the shadow receives a darkened overlay');
assert.equal(scene.sandbox.window.__fenrirSpatialFxV1.snapshot().shadedTinies, 1);
scene.sandbox.draw_bug({x: 395, y: 228, z: 0});
assert.equal(scene.overlays.length, before + 1, 'civilians outside the shadow remain unchanged');

scene.sandbox.window.__xlImmersionPrefs.lowEffects = true;
scene.sandbox.window.xlDrawImpactFloorPass();
const low = scene.sandbox.window.__fenrirSpatialFxV1.snapshot();
assert(low.active);
assert(low.reflections <= 1, 'low-effects mode keeps only the cheapest reflection band');

scene.sandbox.window.__xlImmersionPrefs = {reduceMotion: true};
scene.sandbox.paw_y = 20;
scene.sandbox.window.xlDrawImpactFloorPass();
const reduced = scene.sandbox.window.__fenrirSpatialFxV1.snapshot();
assert.equal(reduced.heightRatio, 0, 'reduced motion removes dynamic shadow travel');
assert.equal(reduced.shadowX, 200, 'reduced motion keeps the shadow centered');
assert.equal(reduced.reflections, 0, 'reduced motion disables animated wet-road sheen');

scene.sandbox.active = false;
const priorCalls = scene.calls.length;
scene.sandbox.window.xlDrawImpactFloorPass();
assert.equal(scene.calls.length, priorCalls + 1, 'the original floor pass still runs while the spatial effect is inactive');
assert.equal(scene.sandbox.window.__fenrirSpatialFxV1.snapshot().active, false);

const failed = createScene();
failed.sandbox.window.__fenrirCitySceneV1Status.ready = false;
failed.sandbox.window.xlDrawImpactFloorPass();
assert.equal(failed.sandbox.window.__fenrirSpatialFxV1.snapshot().active, false, 'scene texture fallback disables the new effects cleanly');

console.log('Fenrir spatial FX tests passed: height-aware directional shadow, wet-road reflection bands, civilian shadowing, low-effects and reduced-motion fallbacks.');
