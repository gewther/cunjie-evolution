'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const releaseGame = path.join(root, 'dist-release', 'game');

function testFilesAndPaths() {
 const src = fs.readFileSync(path.join(root, 'src', 'tech-dread-v1.js'), 'utf8').replace(/\r\n/g, '\n');
 assert(!src.includes('+ 98px'), 'Telemetry must anchor to #hud rather than hardcoded + 98px offset');
 const relPath = path.join(releaseGame, 'scripts', 'tech-dread-v1.js');
 assert(fs.existsSync(relPath), 'Missing release script scripts/tech-dread-v1.js');
 const rel = fs.readFileSync(relPath, 'utf8').replace(/\r\n/g, '\n');
 assert.equal(src, rel, 'src/tech-dread-v1.js and release script must match');
 assert(!/(?<![.])\/assets\//.test(rel), 'Found forbidden root-absolute /assets/ path in tech-dread-v1.js');
 new vm.Script(rel, { filename: 'tech-dread-v1.js' });

 const idxHtml = fs.readFileSync(path.join(releaseGame, 'index.html'), 'utf8');
 assert(idxHtml.includes('src="scripts/tech-dread-v1.js"'), 'index.html missing scripts/tech-dread-v1.js');
 assert(!/(?<![.])\/assets\//.test(idxHtml), 'Found forbidden root-absolute /assets/ path in index.html');

 for (const bundle of ['touch-v1-free.js', 'touch-v1-impact.js']) {
  const bTxt = fs.readFileSync(path.join(releaseGame, 'data', bundle), 'utf8');
  assert(!bTxt.includes('\\r\\n'), `Found non-normalized \\r\\n in ${bundle}`);
 }

 const offlinePath = path.join(root, 'dist', 'cunjie-offline.html');
 if (fs.existsSync(offlinePath)) {
  const off = fs.readFileSync(offlinePath, 'utf8');
  assert(off.includes('__cunjieTechDreadV1'), 'cunjie-offline.html missing __cunjieTechDreadV1');
 }
}

function makeFakeElement(id, tag = 'div') {
 const attrs = {};
 const classes = new Set();
 const styles = {};
 const listeners = {};
 const children = [];
 return {
  id,
  tagName: tag.toUpperCase(),
  children,
  parentNode: null,
  _text: '',
  _html: '',
  set textContent(v) { this._text = String(v); },
  get textContent() { return this._text; },
  set innerHTML(v) { this._html = String(v); },
  get innerHTML() { return this._html; },
  dataset: {},
  style: {
   setProperty(k, v) { styles[k] = String(v); },
   getPropertyValue(k) { return styles[k] || ''; },
  },
  classList: {
   add: (...c) => c.forEach(x => classes.add(x)),
   remove: (...c) => c.forEach(x => classes.delete(x)),
   toggle: (c, force) => {
    const on = force === undefined ? !classes.has(c) : !!force;
    if (on) classes.add(c); else classes.delete(c);
    return on;
   },
   contains: c => classes.has(c),
  },
  setAttribute: (k, v) => { attrs[k] = String(v); },
  getAttribute: k => attrs[k],
  appendChild(el) {
   el.parentNode = this;
   children.push(el);
   return el;
  },
  insertBefore(el, ref) {
   el.parentNode = this;
   const idx = children.indexOf(ref);
   if (idx >= 0) children.splice(idx, 0, el);
   else children.push(el);
   return el;
  },
  addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
  querySelector: sel => {
   if (sel === '#tdv1Telemetry') return children.find(c => c.id === 'tdv1Telemetry') || { id: 'tdv1Telemetry', textContent: '' };
   if (sel === 'iframe') return null;
   return null;
  },
  closest: () => null,
  get offsetWidth() { return 100; },
 };
}

function testHostTerminalBehavior() {
 const code = fs.readFileSync(path.join(root, 'src', 'tech-dread-v1.js'), 'utf8');
 const store = new Map([['cunjie-stomp-impact-v1', JSON.stringify({ version: 2, prefs: { sound: true, volume: 0.5, reduceMotion: false, lowEffects: false } })]]);
 const created = new Map();
 const home = makeFakeElement('home', 'section');
 const play = makeFakeElement('play', 'section');
 const hud = makeFakeElement('hud', 'div');
 play.appendChild(hud);
 const menu = makeFakeElement('v56Menu', 'nav');
 const perfBtn = makeFakeElement('v56PerfBtn', 'button');
 menu.appendChild(perfBtn);
 const mount = makeFakeElement('mount', 'div');
 created.set('home', home);
 created.set('play', play);
 created.set('hud', hud);
 created.set('v56Menu', menu);
 created.set('v56PerfBtn', perfBtn);
 created.set('mount', mount);
 const docElem = makeFakeElement('html', 'html');
 const head = makeFakeElement('head', 'head');
 const listeners = {};
 let snap = { status: 'playing', stage: 2, live: { pressure: 0.9 }, mood: { value: 85, special: 'silence', burstRemaining: 0 } };

 const timers = [];
 const sandbox = {
  Math, Number, String, Array, Object, Date, JSON, Set, Map,
  setTimeout: (fn) => { timers.push(fn); return timers.length; },
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  document: {
   readyState: 'complete',
   documentElement: docElem,
   head,
   getElementById: id => {
    if (created.has(id)) return created.get(id);
    if (id === 'tdv1Telemetry') return created.get('tdv1Telemetry') || null;
    return null;
   },
   createElement: tag => {
    const el = makeFakeElement('', tag);
    const origSetId = Object.getOwnPropertyDescriptor(el, 'id');
    return new Proxy(el, {
     set(obj, prop, val) {
      obj[prop] = val;
      if (prop === 'id' && val) created.set(val, obj);
      if (prop === 'innerHTML' && String(val).includes('tdv1Telemetry')) {
       const tel = makeFakeElement('tdv1Telemetry', 'div');
       created.set('tdv1Telemetry', tel);
       obj.appendChild(tel);
      }
      return true;
     }
    });
   },
   addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
  },
  window: {
   localStorage: {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => { store.set(k, String(v)); },
   },
   matchMedia: () => ({ matches: false }),
   CunjieRealms: { snapshot: () => snap },
  },
 };
 sandbox.window.window = sandbox.window;
 sandbox.window.document = sandbox.document;
 sandbox.globalThis = sandbox.window;
 vm.runInNewContext(code, sandbox);

 const api = sandbox.window.__cunjieTechDread;
 assert(api, '__cunjieTechDread must be exposed');
 assert.equal(api.getMode(), 'standard');
 assert(created.has('tdv1Overlay'), 'Must mount #tdv1Overlay inside #play');
 assert(created.has('tdv1Telemetry') && created.get('tdv1Telemetry').parentNode === hud, '#tdv1Telemetry must anchor inside #hud');
 assert(created.has('tdv1ModeBtn'), 'Must inject #tdv1ModeBtn into #v56Menu');
 assert.equal(home.classList.contains('td-home-active'), true);

 api.tick();
 const s1 = api.snapshot();
 assert(s1.dread > 0.7, 'High pressure + silence should elevate dread');
 assert(s1.telemetry.includes('SECTOR-03') && s1.telemetry.includes('SIGNAL VOID'), `Unexpected telemetry: ${s1.telemetry}`);
 assert.equal(created.get('tdv1Overlay').classList.contains('td-alert'), true);
 assert.equal(created.get('tdv1Telemetry').classList.contains('td-tel-alert'), true);
 assert.equal(created.get('tdv1Overlay').classList.contains('td-glitch'), true);

 assert.equal(api.cycleMode(), 'soft');
 assert.equal(store.get('cunjie-tech-dread-v1'), 'soft');
 snap = { status: 'playing', stage: 2, live: { pressure: 0.9 }, mood: { value: 75, special: '', burstRemaining: 0 } };
 api.tick();
 assert(api.snapshot().dread < s1.dread, 'Soft mode should attenuate visual dread');
 assert(api.snapshot().rawDread >= 0.68, 'Soft mode should keep rawDread high');
 assert(api.snapshot().telemetry.includes('HIGH LOAD'), `Soft mode must still report HIGH LOAD, got: ${api.snapshot().telemetry}`);
 assert.equal(created.get('tdv1Overlay').classList.contains('td-alert'), true);
 assert.equal(created.get('tdv1Telemetry').classList.contains('td-tel-alert'), true);

 // reduceMotion must freeze HUD --td-dread vignette and apply td-rm
 store.set('cunjie-stomp-impact-v1', JSON.stringify({ version: 2, prefs: { sound: true, volume: 0.5, reduceMotion: true, lowEffects: false } }));
 api.tick();
 assert.equal(created.get('tdv1Overlay').classList.contains('td-rm'), true);
 assert.equal(created.get('tdv1Overlay').style.getPropertyValue('--td-dread'), '0.000');

 assert.equal(api.cycleMode(), 'off');
 assert.equal(store.get('cunjie-tech-dread-v1'), 'off');
 assert.equal(home.classList.contains('td-home-active'), false);
 assert.equal(api.snapshot().dread, 0);

 // Main save data must remain completely untouched
 const mainSave = JSON.parse(store.get('cunjie-stomp-impact-v1'));
 assert.equal(mainSave.prefs.volume, 0.5);
}

function testImmersionDreadCues() {
 const code = fs.readFileSync(path.join(root, 'src', 'immersion-v1.js'), 'utf8');
 const occCalls = [];
 const masterGains = [];
 const gains = [];
 const droneFreqs = [];
 const msgListeners = [];
 const ocListeners = {};
 let simNow = 1000;
 let pawTicks = 0;
 let groundedNow = false;
 let punchNow = 0;
 const sandbox = {
  Math, Number, Array, Object, Set, Map, Date, JSON,
  setInterval: () => 1,
  clearInterval: () => {},
  performance: { now: () => simNow },
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  active: true, pause: false, tr: false, slow: false, hide_paws: false,
  delta: 0.016,
  w: 400, h: 240, sc: 2, floor_y: 228, paw_x: 200, paw_y: 196, paw_y_velo: 560, paw_state: 1, pressure: 0.7,
  paw: { width: 100 },
  realmIndex: 0,
  realmMood: { special: 'silence', reduceMotion: false, lowEffects: false },
  realmPrefs: { sound: true, footstepVolume: 0.8 },
  realmBurstTime: 0,
  realmTouch: { freshTap: false },
  fenrirCity: false,
  xlGfxPrefs: { shake: true },
  evoContact: { get grounded() { return groundedNow; }, punch: () => punchNow },
  update_paw: () => { pawTicks++; },
  update_bugs: () => {},
  set_yoff: () => {},
  draw: () => {},
  oc: { style: {}, addEventListener: (t, fn) => { (ocListeners[t] ||= []).push(fn); } },
  occ: {
   save: () => {}, restore: () => {}, setTransform: () => {},
   beginPath: () => {}, moveTo: (x, y) => occCalls.push(['moveTo', x, y]), lineTo: () => {},
   arc: () => {}, ellipse: () => {}, fill: () => {}, stroke: () => occCalls.push(['stroke']),
   fillRect: (...a) => occCalls.push(['fillRect', ...a]),
   fillText: t => occCalls.push(['text', t]),
   createRadialGradient: () => ({ addColorStop: () => {} }),
   createLinearGradient: () => ({ addColorStop: () => {} }),
  },
  audio_ctx: {
   state: 'running', currentTime: 1, sampleRate: 8000,
   createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }),
   createBufferSource: () => ({ buffer: null, loop: false, connect: () => {}, start: () => {}, stop: () => {}, disconnect: () => {} }),
   createBiquadFilter: () => ({ type: '', frequency: { setValueAtTime: () => {}, setTargetAtTime: () => {} }, Q: { setValueAtTime: () => {}, setTargetAtTime: () => {} }, connect: () => {}, disconnect: () => {} }),
   createGain: () => {
    const obj = { values: [], gain: { setValueAtTime: v => obj.values.push(v), setTargetAtTime: v => { obj.values.push(v); } }, connect: () => {}, disconnect: () => {} };
    gains.push(obj);
    if (masterGains.length === 0) masterGains.push(obj);
    return obj;
   },
   createOscillator: () => ({ type: '', frequency: { setValueAtTime: v => droneFreqs.push(v), setTargetAtTime: v => droneFreqs.push(v) }, connect: () => {}, start: () => {} }),
  },
  main_volume_node: {},
  window: {
   parent: { localStorage: { getItem: k => k === 'cunjie-tech-dread-v1' ? 'standard' : null } },
   addEventListener: (t, fn) => { if (t === 'message') msgListeners.push(fn); },
  },
 };
 sandbox.window.window = sandbox.window;
 sandbox.globalThis = sandbox;
 vm.runInNewContext(code, sandbox);

 sandbox.update_paw();
 sandbox.draw();
 assert(occCalls.some(c => c[0] === 'text' && String(c[1]).startsWith('ALT ')), 'Descending airborne foot should draw targeting reticle');
 assert(occCalls.some(c => c[0] === 'fillRect' && c[3] === 400 && c[4] === 240), 'Should draw canvas dread vignette');
 const lastMaster = masterGains[0].values.at(-1);
 assert(lastMaster < 0.3, `Silence vacuum should duck master ambience (${lastMaster})`);
 assert.equal(sandbox.window.__xlImmersionDebug().dreadMode, 'standard');

 // Rising foot must NOT show reticle even close to floor
 occCalls.length = 0;
 sandbox.paw_y_velo = -220;
 sandbox.draw();
 assert(!occCalls.some(c => c[0] === 'text' && String(c[1]).startsWith('ALT ')), 'Rising airborne foot must NOT draw targeting reticle');
 sandbox.paw_y_velo = 560;

 // reduceMotion must disable canvas vignette and silence ambience vacuum
 occCalls.length = 0;
 masterGains[0].values.length = 0;
 gains[3].values.length = 0;
 droneFreqs.length = 0;
 sandbox.realmMood.reduceMotion = true;
 sandbox.update_paw();
 sandbox.draw();
 assert(!occCalls.some(c => c[0] === 'fillRect' && c[3] === 400 && c[4] === 240), 'reduceMotion must disable canvas dread vignette');
 assert(masterGains[0].values.at(-1) > 0.4, 'reduceMotion must disable sudden-silence vacuum ducking');
 assert.notEqual(droneFreqs.at(-1), 44, 'reduceMotion must disable forced 44 Hz vacuum drone');
 sandbox.realmMood.reduceMotion = false;

 // lowEffects must disable canvas vignette AND sudden-silence ambience vacuum / 44 Hz drone
 occCalls.length = 0;
 masterGains[0].values.length = 0;
 gains[3].values.length = 0;
 droneFreqs.length = 0;
 sandbox.realmMood.lowEffects = true;
 sandbox.update_paw();
 sandbox.draw();
 assert(!occCalls.some(c => c[0] === 'fillRect' && c[3] === 400 && c[4] === 240), 'lowEffects must disable canvas dread vignette');
 assert(masterGains[0].values.at(-1) > 0.4, 'lowEffects must disable sudden-silence vacuum ducking');
 assert.notEqual(droneFreqs.at(-1), 44, 'lowEffects must disable forced 44 Hz vacuum drone');
 assert(gains[3].values.at(-1) < 0.02, 'lowEffects must not boost vacuum drone amplitude');
 sandbox.realmMood.lowEffects = false;

 // Switch to off via postMessage
 msgListeners.forEach(fn => fn({ data: { type: 'cunjie-tech-dread-mode', mode: 'off' } }));
 occCalls.length = 0;
 sandbox.draw();
 assert.equal(sandbox.window.__xlImmersionDebug().dreadMode, 'off');
 assert.equal(sandbox.window.__xlImmersionDebug().dreadLevel, 0);
 assert(!occCalls.some(c => c[0] === 'text' && String(c[1]).startsWith('ALT ')), 'Off mode must disable reticle');

 // Real-time hit-stop must auto-recover by wall clock AND yield immediately on manual takeover
 groundedNow = false;
 punchNow = 0;
 sandbox.update_paw();
 const ticksBeforeHit = pawTicks;
 groundedNow = true;
 punchNow = 0.85;
 sandbox.update_paw();
 assert.equal(pawTicks, ticksBeforeHit + 1, 'Landing impact tick itself executes');
 assert.equal(sandbox.window.__xlImmersionDebug().hitStopActive, true, 'Heavy landing triggers real-time hit-stop');

 // Inside hit-stop (< 40 ms), update_paw pauses
 simNow += 20;
 sandbox.update_paw();
 assert.equal(pawTicks, ticksBeforeHit + 1, 'update_paw stays frozen during real-time hit-stop window');

 // Once real time passes > 55 ms, hit-stop auto-releases without needing extra frames
 simNow += 45;
 assert.equal(sandbox.window.__xlImmersionDebug().hitStopActive, false, 'Real-time hit-stop must recover once wall clock expires');
 sandbox.update_paw();
 assert.equal(pawTicks, ticksBeforeHit + 2, 'update_paw resumes cleanly after hit-stop');

 // Next heavy landing after cooldown: manual touchstart takeover immediately cancels hit-stop
 simNow += 320;
 groundedNow = false;
 punchNow = 0;
 sandbox.update_paw();
 groundedNow = true;
 punchNow = 0.9;
 sandbox.update_paw();
 assert.equal(sandbox.window.__xlImmersionDebug().hitStopActive, true);
 assert(Array.isArray(ocListeners.touchstart) && ocListeners.touchstart.length > 0, 'touchstart takeover listener must be bound on oc');
 ocListeners.touchstart.forEach(fn => fn());
 assert.equal(sandbox.window.__xlImmersionDebug().hitStopActive, false, 'Manual touchstart must cancel hit-stop immediately');
 const beforeTakeover = pawTicks;
 sandbox.update_paw();
 assert.equal(pawTicks, beforeTakeover + 1, 'Manual takeover executes immediately on the very next update_paw tick');

 // freshTap during hit-stop also cancels hit-stop inline inside update_paw
 simNow += 320;
 groundedNow = false;
 punchNow = 0;
 sandbox.update_paw();
 groundedNow = true;
 punchNow = 0.9;
 sandbox.update_paw();
 assert.equal(sandbox.window.__xlImmersionDebug().hitStopActive, true);
 const beforeFreshTap = pawTicks;
 sandbox.realmTouch.freshTap = true;
 sandbox.update_paw();
 assert.equal(sandbox.window.__xlImmersionDebug().hitStopActive, false, 'realmTouch.freshTap must cancel hit-stop inline');
 assert.equal(pawTicks, beforeFreshTap + 1, 'freshTap takeover executes immediately with zero frame drop');
}

function main() {
 testFilesAndPaths();
 testHostTerminalBehavior();
 testImmersionDreadCues();
 console.log('High-tech dread atmosphere tests passed: host overlay/telemetry/toggle/audio + immersion reticle/vignette/silence verified.');
}

main();
