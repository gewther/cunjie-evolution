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
const controls = read(root, 'src/fenrir-controls.js').replace(/\r\n/g, '\n');
const bridge = read(root, 'src/fenrir-scene-bridge.js').replace(/\r\n/g, '\n');
assert.equal(scene, read(root, 'src/fenrir-scene-v1.js'));

const names = ['far', 'mid', 'near'];
for (const name of names) {
 const file = 'assets/fenrir/city-' + name + '.svg';
 const svg = read(game, file);
 assert.equal(svg, read(root, file));
 assert.match(svg, /<svg[^>]*width="2400"[^>]*height="240"[^>]*viewBox="0 0 2400 240"/);
 assert(svg.trim().endsWith('</svg>'));
}
const far = read(game, 'assets/fenrir/city-far.svg');
assert(far.includes('id="tower-scale-cues"'), 'Far skyline must include cropped tower-scale facades');
assert(far.includes('data-reference-height="30m"'), 'Tower art must document the 30 m scale cue');
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

function createScene({textureLimit = 4096, failMid = false, document: documentOverride = null, windowOverrides = {}} = {}) {
 let tick = 1000;
 const original = ['fenrirCity', 0, 0, 400, 240];
 const textures = new Map();
 const calls = [], urls = [], deleted = [], warnings = [];
 const pose = {
  grounded: true, supported: false, floorY: 228, width: 160, offset: 0,
  frameHeight: 256, texture: 'giant', soleOffset: 2, contactCenter: 0.54,
  force: 0.8, age: 0, pressure: 0.9
 };
 const window = {__xlImmersionPrefs: {}, ...windowOverrides};
 const document = documentOverride || {baseURI: 'https://example.test/cunjie-evolution/'};
 window.document = document;
 const sandbox = {
  window, URL, document,
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

function testPersona() {
 const sandbox = {fenrirCity: false};
 vm.runInNewContext(controls, sandbox);
 const p = sandbox.createFenrirPersona();
 const input = {clock: 0, enabled: true, active: true, paused: false, finished: false, charge: 18, overdrive: false, dialogue: true, busy: false};
 const step = (clock, overrides = {}) => p.update({...input, clock, ...overrides});
 assert.equal(step(0, {busy: true}), null);
 assert.equal(step(1).kind, 'takeover');
 assert.equal(p.status().handoffs, 1);
 assert.equal(step(2, {enabled: false}), null);
 assert.equal(step(6, {enabled: false}).kind, 'return');
 assert.equal(p.status().interruptions, 1);
 assert.equal(step(7, {busy: true}), null);
 assert.equal(step(11).kind, 'takeover');
 assert.equal(p.status().handoffs, 2);
 assert.equal(step(12, {charge: 100, paused: true}), null);
 assert.equal(step(16, {charge: 100}).kind, 'ready');
 assert.equal(step(17, {overdrive: true, dialogue: false}), null);
 assert.equal(step(22, {overdrive: true}), null);
 assert.equal(step(23, {overdrive: false}).kind, 'recovered');
 assert.equal(step(0.1, {enabled: false}), null);
 assert.equal(p.status().handoffs, 0);
 assert.equal(p.status().interruptions, 0);
}
function testContextualDialogue() {
 const sandbox = {fenrirCity: false};
 vm.runInNewContext(controls, sandbox);
 const p = sandbox.createFenrirPersona();
 const input = {enabled:false, active:true, paused:false, finished:false,
  charge:18, overdrive:false, dialogue:true, busy:false, landing:null, hoverFoot:null};
 const step = (clock, overrides) => p.update({...input, clock, ...overrides});
 const hoverFoot = {x:140, y:150};
 assert.equal(step(0, {hoverFoot}), null);
 assert.equal(step(1, {hoverFoot:{x:155, y:150}}), null, 'movement restarts the hover timer');
 assert.equal(step(1.5, {hoverFoot}), null);
 assert.equal(step(2.5, {hoverFoot}), null);
 const firstHover = step(3, {hoverFoot});
 assert.equal(firstHover.kind, 'hover');
 assert.equal(step(8.1, {hoverFoot}), null, 'same hover plays once');
 step(9);
 step(10, {hoverFoot});
 const nextHover = step(11.5, {hoverFoot});
 assert.equal(nextHover.kind, 'hover');
 assert.notEqual(nextHover.text, firstHover.text, 'the next hover rotates the line');

 const landing = {};
 assert.equal(step(20, {landing}), null);
 assert.equal(step(20.1, {landing}), null, 'repeated frames count as one landing');
 assert.equal(step(21, {landing:{}}), null);
 assert.equal(step(22, {landing:{}, busy:true}), null);
 assert.equal(step(22.1).kind, 'sequence', 'gameplay speech delays the combo line');
 step(30, {landing:{}});
 step(35, {landing:{}});
 assert.equal(step(36, {landing:{}}), null, 'old landings cannot complete a combo');
 assert.equal(step(37, {landing:{}, paused:true}), null);
 assert.equal(step(38, {landing:{}}), null, 'a pause clears the combo');
 step(40, {hoverFoot, dialogue:false});
 assert.equal(step(42, {hoverFoot}), null, 'muted play does not charge up a hover');

 assert.equal(step(44, {enabled:true}).kind, 'takeover');
 p.setEnabled(false, 45, true);
 assert.equal(step(45, {busy:true}), null);
 assert.equal(step(49).kind, 'interrupted');
 assert.equal(p.status().interruptions, 1);
 step(50, {hoverFoot});
 assert.equal(step(52, {hoverFoot, busy:true}), null);
 p.setEnabled(true, 53);
 assert.equal(step(54, {enabled:true}).kind, 'takeover', 'new control phase supersedes queued banter');
 assert.equal(step(0.1, {hoverFoot}), null, 'a restarted run clears contextual state');
}
function testMemory() {
 const sandbox = {fenrirCity: false};
 vm.runInNewContext(controls, sandbox);
 const map = new Map();
 let writes = 0;
 const storage = {getItem: k => map.get(k) || null, setItem: (k,v) => {map.set(k,v);writes++;}};
 const create = () => sandbox.createFenrirMemory(storage);
 const m = create();
 const input = {clock: 0, enabled: false, active: true, paused: false, finished: false};
 const step = (clock, overrides = {}) => m.record({...input, clock, ...overrides});
 step(0, {active: false});
 assert.equal(m.status().runs, 0);
 step(0.1);
 step(0.2, {enabled: true});
 const w = writes;
 for(let i=3;i<=23;i++) step(i/10, {enabled: true});
 assert.equal(writes, w, 'no per-frame storage writes');
 assert(m.status().aiSeconds > 1.9);
 step(2.4);
 step(2.5, {finished: true});
 step(2.6, {finished: true});
 m.save();
 assert.equal(m.status().runs, 1);
 assert.equal(m.status().completed, 1);
 assert.equal(m.status().handoffs, 1);
 assert.equal(m.status().interruptions, 1);
 const restored = create();
 assert.equal(restored.prior().runs, 1);
 assert.equal(restored.status().handoffs, 1);
 const p = sandbox.createFenrirPersona(restored);
 const line = p.update({clock: 1, enabled: true, active: true, paused: false, finished: false, charge: 18, dialogue: true, busy: false});
 assert.equal(line.kind, 'takeover');
 assert.match(line.text, /又见面/);
 step(0.01);
 assert.equal(m.status().runs, 2);
 assert.equal(m.prior().runs, 1);
 m.clear();
 assert.equal(create().status().runs, 0);
 assert.equal(m.prior().handoffs, 0);
 m.setEnabled(false);
 step(1, {enabled: true});
 assert.equal(create().status().enabled, false);
 assert.equal(create().status().handoffs, 0);
 m.setEnabled(true);
 assert.equal(create().status().enabled, true);
 const bad = sandbox.createFenrirMemory({getItem: () => '{bad', setItem: () => {throw Error('blocked');}});
 bad.record(input);
 assert.equal(bad.status().runs, 1);
 assert.equal(bad.status().available, false);
 const corrupt = sandbox.createFenrirMemory({getItem: () => JSON.stringify({version:2,runs:-4,handoffs:'7',aiSeconds:1e300})});
 assert.equal(corrupt.status().runs, 0);
 assert.equal(corrupt.status().handoffs, 0);
 assert.equal(corrupt.status().aiSeconds, 100000000);
}
function testCadence() {
 const sandbox = {fenrirCity:false};
 vm.runInNewContext(controls, sandbox);
 const c = sandbox.createFenrirCadence('playful');
 assert.equal(c.factor({enabled:true,phase:'raise',sequence:1}), 0.78);
 assert.equal(c.factor({enabled:true,phase:'raise',sequence:2}), 1.02);
 assert.equal(c.factor({enabled:true,phase:'recover',sequence:2}), 0.80);
 for (const phase of ['aim','down','press','sweep']) assert.equal(c.factor({enabled:true,phase,sequence:1}),1);
 assert.equal(c.factor({enabled:false,phase:'raise',sequence:1}),1);
 assert.equal(c.next(),'deliberate');
 assert.equal(c.factor({enabled:true,phase:'raise',sequence:1}),0.76);
 assert.equal(c.next(),'classic');
 for (const phase of ['raise','aim','down','press','recover']) assert.equal(c.factor({enabled:true,phase,sequence:2}),1);
 assert.equal(c.next(),'playful');
 assert.equal(c.configure('invalid'),'playful');
 assert.equal(sandbox.createFenrirCadence('bad').status().mode,'playful');
 // Exercise the actual legacy controller, not just the timing helper.
 const engine = read(game, 'scripts/touch-v1-impact-host-1.js');
 const mark = engine.indexOf('/* Project Cunjie v4.7. Offline decision controller');
 const stop = engine.indexOf('})(globalThis);',mark);
 assert(mark>=0 && stop>mark);
 vm.runInNewContext(engine.slice(mark,stop+'})(globalThis);'.length),sandbox);
 function simulate(mode) {
  const pilot = new sandbox.AutonomousXiaolong({enabled:true,personality:'hunter',pace:'normal'});
  const tempo = sandbox.createFenrirCadence(mode);
  const base = pilot.speedFactor.bind(pilot);
  pilot.speedFactor = mood => base(mood)*tempo.factor({enabled:pilot.enabled,phase:pilot.phase,sequence:pilot.sequence});
  const commands = [];
  const api = {command:(kind) => {commands.push(kind);return true;}};
  let elapsed = 0;
  const snapshot = {world:{width:400,footX:200,footState:0},visual:{footCollisionWidth:160},npcs:[]};
  while(pilot.phase==='raise' && elapsed<2) {pilot.tick(.01,snapshot,api,{value:20});elapsed+=.01;}
  assert.equal(pilot.phase,'aim');
  assert(commands.every(k=>k==='up'||k==='release'));
  pilot.setEnabled(false,api);
  const n=commands.length;
  pilot.tick(.1,snapshot,api,{value:20});
  assert.equal(commands.length,n,'manual handoff stops AI commands');
  return elapsed;
 }
 assert(simulate('deliberate') > simulate('classic'));
}

function makeIntroDom({portrait = false, lowEffects = false} = {}) {
 const timers = [];
 const skipListeners = {};
 const group = () => ({attrs:{},setAttribute(name,value){this.attrs[name]=value;}});
 const wide = group(), tall = group();
 const svg = {
  attrs:{},
  setAttribute(name,value){this.attrs[name]=value;},
  querySelector(selector){return selector === '.wide' ? wide : selector === '.tall' ? tall : null;}
 };
 const skip = {
  addEventListener(type,fn){skipListeners[type]=fn;},
  focus(){},
  click(){if(skipListeners.click)skipListeners.click({preventDefault(){},stopPropagation(){}});}
 };
 const overlay = {
  className:'', innerHTML:'', removed:false, attrs:{}, style:{cssText:''},
  classList:{toggle(name,value){overlay.attrs[name]=value;}},
  setAttribute(name,value){this.attrs[name]=value;},
  querySelector(selector){return selector === '.fenrir-establishing__svg' ? svg : selector === '.fenrir-establishing__skip' ? skip : null;},
  remove(){this.removed=true;}
 };
 const document = {
  baseURI:'https://example.test/cunjie-evolution/',
  documentElement:{clientWidth:portrait?390:1280,clientHeight:portrait?844:720},
  body:{child:null,appendChild(el){this.child=el;el.parentNode=this;}},
  createElement(){return overlay;},
  addEventListener(){},
  removeEventListener(){}
 };
 const windowOverrides = {
  __xlImmersionPrefs:{lowEffects},
  innerWidth:portrait?390:1280,
  innerHeight:portrait?844:720,
  setTimeout(fn,ms){timers.push({fn,ms,cleared:false});return timers.length;},
  clearTimeout(id){if(timers[id-1])timers[id-1].cleared=true;},
  addEventListener(){},
  removeEventListener(){}
 };
 return {document,windowOverrides,timers,overlay,skip,svg,wide,tall};
}
function testEstablishingShot() {
 const wideDom = makeIntroDom();
 const wideScene = createScene({document:wideDom.document,windowOverrides:wideDom.windowOverrides});
 let completed = 0;
 assert.equal(wideScene.api.showEstablishingShot(() => completed++), true);
 assert.equal(wideDom.document.body.child, wideDom.overlay);
 assert.match(wideDom.overlay.innerHTML,/data-reference-height="30m"/);
 assert.match(wideDom.overlay.innerHTML,/30\.0m MECHA/);
 assert.match(wideDom.overlay.innerHTML,/6\.0m STREETLIGHT/);
 assert.match(wideDom.overlay.innerHTML,/4\.5m VEHICLE/);
 assert.match(wideDom.overlay.innerHTML,/18\.0m \/ BLOCK/);
 assert.match(wideDom.overlay.innerHTML,/fenrir-establishing__skip/);
 assert.equal(wideDom.svg.attrs.viewBox,'0 0 1600 900');
 assert.equal(wideDom.timers[0].ms,5200);
 wideDom.skip.click();
 wideDom.skip.click();
 assert.equal(wideDom.overlay.removed,true);
 assert.equal(completed,1,'skip and timer completion are idempotent');
 assert.equal(wideDom.timers[0].cleared,true);

 const tallDom = makeIntroDom({portrait:true,lowEffects:true});
 const tallScene = createScene({document:tallDom.document,windowOverrides:tallDom.windowOverrides});
 let tallCompleted = 0;
 assert.equal(tallScene.api.showEstablishingShot(() => tallCompleted++),true);
 assert.equal(tallDom.svg.attrs.viewBox,'0 0 900 1600');
 assert.equal(tallDom.overlay.attrs['is-portrait'],true);
 assert.equal(tallDom.timers[0].ms,3000);
 assert.match(tallDom.overlay.innerHTML,/lowfx/);
 tallDom.skip.click();
 assert.equal(tallCompleted,1);

 const fallback = createScene();
 assert.equal(fallback.api.showEstablishingShot(()=>{}),false,'missing DOM must leave the game playable');
}

async function main() {
 testPersona();
 testEstablishingShot();
 testContextualDialogue();
 testMemory();
 testCadence();
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

 // P6.2: heavy landings transmit a short vibration through the city depth.
 const rumble = createScene();
 await new Promise(resolve => setImmediate(resolve));
 rumble.api.recordLanding({kind: 'landing', x: 200, at: 1, force: 0.9});
 rumble.draw();
 const rumbleDraws = rumble.calls.slice(-3);
 const [farY, midY, nearY] = rumbleDraws.map(([, , y]) => y);
 assert(Math.abs(midY) > Math.abs(farY), 'mid buildings react more strongly than the distant skyline');
 assert.notEqual(midY, 0, 'heavy landing must create a visible mid-layer response');
 assert.equal(nearY, 0, 'near road must remain world-locked during building vibration');
 assert.notEqual(rumble.status.weight.environmentRumble, 0);
 rumble.window.__xlImmersionPrefs.reduceMotion = true;
 rumble.draw();
 assert.equal(rumble.status.weight.environmentRumble, 0, 'reduced motion suppresses building vibration');
 assert.deepEqual(rumble.calls.slice(-3).map(([, , y]) => y), [0, 0, 0]);

 const lowFxRumble = createScene();
 await new Promise(resolve => setImmediate(resolve));
 lowFxRumble.api.recordLanding({kind: 'landing', x: 200, at: 1, force: 1});
 lowFxRumble.window.__xlImmersionPrefs.lowEffects = true;
 lowFxRumble.draw();
 assert.equal(lowFxRumble.status.weight.environmentRumble, 0, 'low-effects mode suppresses building vibration');

 const decayRumble = createScene();
 await new Promise(resolve => setImmediate(resolve));
 decayRumble.api.recordLanding({kind: 'landing', x: 200, at: 1, force: 0.9});
 decayRumble.draw();
 for (let i = 0; i < 40; i++) decayRumble.draw();
 assert.equal(decayRumble.status.weight.environmentRumble, 0, 'building vibration decays without a lingering offset');

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
 console.log('Fenrir tests passed: release assets and host, actual iframe injection, camera continuity, sole anchor, world-space water, P5 settling and mark budget, skippable 30 m establishing shot, and fallback.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
