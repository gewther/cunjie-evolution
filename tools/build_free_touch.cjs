'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const gameDir = path.join(root, process.argv.includes('--release') ? 'dist-release/game' : 'dist');
const src = fs.readFileSync(path.join(root, 'src', 'free-touch-responsive.js'), 'utf8').replace(/\r\n/g, '\n');
const begin = '/* FREE_TOUCH_V1_BEGIN */';
const end = '/* FREE_TOUCH_V1_END */\n';
const block = `${begin}\n${src}\n${end}`;

function injectIntoFree(relFile) {
  const file = path.join(gameDir, relFile);
  const raw = fs.readFileSync(file, 'utf8');
  const eq = raw.indexOf('=');
  const prefix = raw.slice(0, eq + 1);
  let html = JSON.parse(raw.slice(eq + 1).trim().replace(/;$/, ''));

  if (html.includes(begin)) {
    const a = html.indexOf(begin);
    const b = html.indexOf(end, a);
    if (b < 0) throw new Error(`Missing FREE_TOUCH_V1_END in ${relFile}`);
    html = html.slice(0, a) + block + html.slice(b + end.length);
  } else {
    const immAnchor = '/* IMMERSION_V1_BEGIN */';
    const mainAnchor = 'ptime = performance.now();\nmainloop();';
    const anchor = html.includes(immAnchor) ? immAnchor : mainAnchor;
    if (!html.includes(anchor)) throw new Error(`Missing injection anchor in ${relFile}`);
    html = html.replace(anchor, block + anchor);
  }

  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1].trim()) new vm.Script(m[1], { filename: `${path.basename(relFile)}-free-touch.js` });
  }
  const out = prefix + JSON.stringify(html).replace(/</g, '\\u003c') + ';\n';
  fs.writeFileSync(file, out, 'utf8');
}

injectIntoFree(path.join('data', 'touch-v1-free.js'));
console.log('Responsive Free/Fenrir mobile touch built into', path.relative(root, gameDir), ', syntax checked');
