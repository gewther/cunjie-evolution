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

const feel = fs.readFileSync(path.join(root, 'src', 'contact-feel.js'), 'utf8');
const integ = fs.readFileSync(path.join(root, 'src', 'free-impact-v6.js'), 'utf8');
const block = `/* FREE_IMPACT_V6_BEGIN */\n${feel}\n${integ}\n/* FREE_IMPACT_V6_END */\n`;

const begin = '/* FREE_IMPACT_V6_BEGIN */';
const end = '/* FREE_IMPACT_V6_END */\n';
if (html.includes(begin)) {
  const a = html.indexOf(begin);
  const b = html.indexOf(end, a);
  if (b < 0) throw new Error('Missing FREE_IMPACT_V6_END');
  html = html.slice(0, a) + block + html.slice(b + end.length);
} else {
  const anchor = 'ptime = performance.now();\nmainloop();';
  if (!html.includes(anchor)) throw new Error('Missing mainloop anchor in touch-v1-free.js');
  html = html.replace(anchor, block + anchor);
}

for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
  new vm.Script(m[1], { filename: 'touch-v1-free-inner.js' });
}
const out = prefix + JSON.stringify(html).replace(/</g, '\\u003c') + ';\n';
fs.writeFileSync(file, out, 'utf8');
console.log('Free Mode & Fenrir impact layer built, inner scripts syntax checked');
