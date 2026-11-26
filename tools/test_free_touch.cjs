'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FreeTouchController = require('../src/free-touch-responsive.js');

const LIMITS = { minX: -48, maxX: 448, minY: 64, floorY: 228, height: 240 };
const DT = 1 / 60;

function makeSim({ x = 200, y = 64, absolute = false } = {}) {
  const c = new FreeTouchController();
  c.begin(x, y, 0, LIMITS, absolute);
  return { c, x, y, stamp: 0, landing: null, grounded: y >= LIMITS.floorY };
}

function tickRelative(sim, dx = 0, dy = 0, sensitivity = 1) {
  sim.stamp += 16.6666667;
  if (dx !== 0 || dy !== 0) {
    sim.c.moveRelative(dx, dy, sim.stamp, sensitivity, sim.y);
  }
  const prevY = sim.y;
  sim.c.stepY(DT, sim.y, LIMITS.minY, LIMITS.floorY, LIMITS.height, sensitivity);
  sim.y = sim.c.y;
  if (sim.y >= LIMITS.floorY) {
    if (prevY < LIMITS.floorY) {
      sim.landing = sim.c.velocity;
      sim.c.landing(sim.landing);
    }
    sim.y = LIMITS.floorY;
  }
  sim.grounded = sim.y >= LIMITS.floorY;
  sim.x = sim.c.stepX(DT, sim.x, LIMITS.minX, LIMITS.maxX, sim.grounded, sim.c.pressure, sensitivity);
  return sim;
}

// 1. Relative vertical swipe (12px/frame @ 60fps, sens=1.0) reaches floorY=228 from y=64 in <= 0.55s (33 frames)
const fastDown = makeSim({ y: 64 });
let framesToFloor = 0;
for (let i = 1; i <= 40 && fastDown.y < LIMITS.floorY; i++) {
  tickRelative(fastDown, 0, 12, 1.0);
  framesToFloor = i;
}
assert.equal(fastDown.y, LIMITS.floorY, 'fast swipe should reach floor');
assert(framesToFloor <= 33, `expected floor in <= 33 frames (0.55s), got ${framesToFloor}`);

// 2. Sensitivity scaling: 0.5 < 1.0 < 2.0 (slider > 1.25 must take real effect)
function distanceAfterFrames(sens, frames = 10) {
  const s = makeSim({ y: 64, x: 200 });
  for (let i = 0; i < frames; i++) tickRelative(s, 6, 8, sens);
  return { dy: s.y - 64, dx: s.x - 200 };
}
const d05 = distanceAfterFrames(0.5);
const d10 = distanceAfterFrames(1.0);
const d20 = distanceAfterFrames(2.0);
assert(d05.dy < d10.dy && d10.dy < d20.dy, `vertical sensitivity should increase 0.5 (${d05.dy}) < 1.0 (${d10.dy}) < 2.0 (${d20.dy})`);
assert(d05.dx < d10.dx && d10.dx < d20.dx, `horizontal sensitivity should increase 0.5 (${d05.dx}) < 1.0 (${d10.dx}) < 2.0 (${d20.dx})`);

// 3. Anti-flick guard: single massive 400px flick cannot teleport to floor (y < 145 after settling)
const flick = makeSim({ y: 64 });
flick.stamp += 16.6666667;
flick.c.moveRelative(0, 400, flick.stamp, 1.0, flick.y);
for (let i = 0; i < 60; i++) tickRelative(flick, 0, 0, 1.0);
assert(flick.y < 145, `single 400px flick settled too low: y=${flick.y}`);

// 4. Contact speed differentiation: fast > slow * 1.8
const slowDrop = makeSim({ y: 180 });
for (let i = 0; i < 160 && slowDrop.y < LIMITS.floorY; i++) tickRelative(slowDrop, 0, 1.0, 1.0);
const fastDrop = makeSim({ y: 180 });
for (let i = 0; i < 160 && fastDrop.y < LIMITS.floorY; i++) tickRelative(fastDrop, 0, 12, 1.0);
assert(slowDrop.landing > 0 && fastDrop.landing > slowDrop.landing * 1.8,
  `expected fast contact (${fastDrop.landing}) > 1.8x slow contact (${slowDrop.landing})`);

// 5. Floor clamping & continuous pressure control
const press = makeSim({ y: LIMITS.floorY });
for (let i = 0; i < 45; i++) tickRelative(press, 0, 3, 1.0);
assert.equal(press.y, LIMITS.floorY, 'must not penetrate floor');
assert(press.c.pressure > 0.65, `expected pressure > 0.65 while pressing down, got ${press.c.pressure}`);
for (let i = 0; i < 60; i++) tickRelative(press, 0, -4, 1.0);
assert.equal(press.c.pressure, 0, 'upward drag must unload pressure');
assert(press.y < 140, `upward drag must lift paw cleanly, got y=${press.y}`);

// 6. Horizontal responsiveness, full [-48, 448] edge reach, and grounded drag speed > 250 px/s
const horiz = makeSim({ x: 200, y: LIMITS.floorY });
horiz.c.targetY = LIMITS.floorY + LIMITS.height * 0.85 * 0.5;
for (let i = 0; i < 30; i++) tickRelative(horiz, -18, 0, 1.0);
assert.equal(horiz.x, LIMITS.minX, `should reach left limit -48 cleanly, got ${horiz.x}`);
let maxGroundedVx = 0;
for (let i = 0; i < 30; i++) {
  tickRelative(horiz, 25, 0, 1.0);
  maxGroundedVx = Math.max(maxGroundedVx, horiz.c.vx);
}
assert(maxGroundedVx > 250, `grounded horizontal drag speed too slow: ${maxGroundedVx}`);
for (let i = 0; i < 20; i++) tickRelative(horiz, 25, 0, 1.0);
assert.equal(horiz.x, LIMITS.maxX, `should reach right limit 448 cleanly, got ${horiz.x}`);

// 7. Zero fling on release (hold)
const holdTest = makeSim({ x: 220, y: 120 });
for (let i = 0; i < 8; i++) tickRelative(holdTest, 12, 10, 1.2);
const hx = holdTest.x;
const hy = holdTest.y;
holdTest.c.hold(hx, hy);
for (let i = 0; i < 30; i++) {
  tickRelative(holdTest, 0, 0, 1.2);
  assert(Math.abs(holdTest.x - hx) < 0.001, 'hold X drifted');
  assert(Math.abs(holdTest.y - hy) < 0.001, 'hold Y drifted');
  assert.equal(holdTest.c.velocity, 0, 'hold Y velocity must stay 0');
  assert.equal(holdTest.c.pressure, 0, 'hold pressure must stay 0');
}

// 8. Direct (absolute) mode: air mapping, ground pressure across splitY, freshTap, hold
const direct = makeSim({ x: 200, y: 64, absolute: true });
assert.equal(direct.c.freshTap, true);
direct.c.moveDirect(310, 140, 16.7);
for (let i = 0; i < 20; i++) {
  direct.stamp += 16.6666667;
  direct.c.stepY(DT, direct.y, LIMITS.minY, LIMITS.floorY, LIMITS.height, 1.0);
  direct.y = direct.c.y;
  direct.x = direct.c.stepX(DT, direct.x, LIMITS.minX, LIMITS.maxX, false, 0, 1.0);
}
assert(Math.abs(direct.x - 310) < 1, `direct X should track 310, got ${direct.x}`);
const expectedAirY = LIMITS.minY + ((140 - LIMITS.minY) / ((LIMITS.floorY - 34) - LIMITS.minY)) * (LIMITS.floorY - LIMITS.minY);
assert(Math.abs(direct.y - expectedAirY) < 0.01, `direct air height expected ${expectedAirY.toFixed(2)}, got ${direct.y}`);
assert(direct.y > 155 && direct.y < LIMITS.floorY, `direct air height expected between 155 and 228, got ${direct.y}`);
assert.equal(direct.c.pressure, 0);
direct.c.moveDirect(350, 232, 400);
for (let i = 0; i < 20; i++) {
  direct.stamp += 16.6666667;
  direct.c.stepY(DT, direct.y, LIMITS.minY, LIMITS.floorY, LIMITS.height, 1.0);
  direct.y = direct.c.y;
  direct.x = direct.c.stepX(DT, direct.x, LIMITS.minX, LIMITS.maxX, true, direct.c.pressure, 1.0);
}
assert.equal(direct.y, LIMITS.floorY);
assert(direct.c.pressure > 0.65, `direct ground pressure below splitY should exceed 0.65, got ${direct.c.pressure}`);
direct.c.hold(direct.x, direct.y);
direct.c.stepY(DT, direct.y, LIMITS.minY, LIMITS.floorY, LIMITS.height, 1.0);
assert.equal(direct.c.velocity, 0);
assert.equal(direct.c.pressure, 0);

// 9. Portrait (390x844 -> 374x224 canvas) & Landscape (844x390 -> 560x336 canvas) coordinate mapping
function canvasMap(clientX, clientY, rect, worldW = 400, worldH = 240) {
  return [(clientX - rect.left) * (worldW / rect.width), (clientY - rect.top) * (worldH / rect.height)];
}
const portraitSwipe = canvasMap(240, 160, { left: 8, top: 80, width: 374, height: 224 });
const landscapeSwipe = canvasMap(320, 200, { left: 142, top: 27, width: 560, height: 336 });
assert(portraitSwipe[0] > 240 && portraitSwipe[1] > 80);
assert(landscapeSwipe[0] > 120 && landscapeSwipe[1] > 120);

// 10. Verify built dist-release/game/data/touch-v1-free.js integration & zero root-absolute assets
const freePath = path.resolve(__dirname, '..', 'dist-release', 'game', 'data', 'touch-v1-free.js');
const raw = fs.readFileSync(freePath, 'utf8');
const html = JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;$/, ''));
assert(html.includes('/* FREE_TOUCH_V1_BEGIN */') && html.includes('/* FREE_TOUCH_V1_END */'),
  'touch-v1-free.js must contain FREE_TOUCH_V1 block');
assert(/window\.freeTouchDebug\s*=/.test(html), 'missing freeTouchDebug probe');
assert(/window\.realmTouchProbe\s*=/.test(html), 'missing realmTouchProbe probe');
assert(!/(?<![.])\/assets\//.test(raw), 'found forbidden root-absolute /assets/ path');
for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
  if (m[1].trim()) new vm.Script(m[1], { filename: 'touch-v1-free-verify.js' });
}

console.log(JSON.stringify({
  passed: 10,
  framesToFloor,
  sens05Dist: d05,
  sens10Dist: d10,
  sens20Dist: d20,
  flickSettledY: Number(flick.y.toFixed(2)),
  slowContactSpeed: Number(slowDrop.landing.toFixed(2)),
  fastContactSpeed: Number(fastDrop.landing.toFixed(2)),
  maxGroundedVx: Number(maxGroundedVx.toFixed(2)),
  directGroundPressure: Number(direct.c.pressure.toFixed(3))
}, null, 2));
