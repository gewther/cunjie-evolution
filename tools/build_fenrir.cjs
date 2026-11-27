'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const gameDir = path.join(root, process.argv.includes('--release') ? 'dist-release/game' : 'dist');
const file = path.join(gameDir, 'data', 'touch-v1-free.js');
const raw = fs.readFileSync(file, 'utf8');
const eq = raw.indexOf('=');
const prefix = raw.slice(0, eq + 1);
let html = JSON.parse(raw.slice(eq + 1).trim().replace(/;$/, ''));

const hudOld = 'if(stamp!==lastHUD){lastHUD=stamp;';
const hudNew = 'if(stamp!==lastHUD&&!window.__xlFenrirOwnsHud){lastHUD=stamp;';
if (html.includes(hudOld)) {
  html = html.replace(hudOld, hudNew);
}

const src = fs.readFileSync(path.join(root, 'src', 'fenrir-gameplay.js'), 'utf8').replace(/\r\n/g, '\n');
const block = `/* FENRIR_GAMEPLAY_BEGIN */\n${src}\n/* FENRIR_GAMEPLAY_END */\n`;
const begin = '/* FENRIR_GAMEPLAY_BEGIN */';
const end = '/* FENRIR_GAMEPLAY_END */\n';

if (html.includes(begin)) {
  const a = html.indexOf(begin);
  const b = html.indexOf(end, a);
  if (b < 0) throw new Error('Missing FENRIR_GAMEPLAY_END');
  html = html.slice(0, a) + block + html.slice(b + end.length);
} else {
  const anchor = 'ptime = performance.now();\nmainloop();';
  if (!html.includes(anchor)) throw new Error('Missing mainloop anchor in touch-v1-free.js');
  html = html.replace(anchor, block + anchor);
}

for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
  if (m[1].trim()) new vm.Script(m[1], { filename: 'touch-v1-free-fenrir-inner.js' });
}
const out = prefix + JSON.stringify(html).replace(/</g, '\\u003c') + ';\n';
fs.writeFileSync(file, out, 'utf8');
console.log('Fenrir gameplay module built into', path.relative(root, file), ', syntax checked');
