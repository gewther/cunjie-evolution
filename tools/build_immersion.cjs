'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src', 'immersion-v1.js'), 'utf8');
const begin = '/* IMMERSION_V1_BEGIN */';
const end = '/* IMMERSION_V1_END */\n';
const block = `${begin}\n${src}\n${end}`;

function injectInto(relFile) {
  const file = path.join(root, relFile);
  const raw = fs.readFileSync(file, 'utf8');
  const eq = raw.indexOf('=');
  const prefix = raw.slice(0, eq + 1);
  let html = JSON.parse(raw.slice(eq + 1).trim().replace(/;$/, ''));

  if (html.includes(begin)) {
    const a = html.indexOf(begin);
    const b = html.indexOf(end, a);
    if (b < 0) throw new Error(`Missing IMMERSION_V1_END in ${relFile}`);
    html = html.slice(0, a) + block + html.slice(b + end.length);
  } else {
    const anchor = 'ptime = performance.now();\nmainloop();';
    if (!html.includes(anchor)) throw new Error(`Missing mainloop anchor in ${relFile}`);
    html = html.replace(anchor, block + anchor);
  }

  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1].trim()) new vm.Script(m[1], { filename: `${path.basename(relFile)}-immersion.js` });
  }
  const out = prefix + JSON.stringify(html).replace(/</g, '\\u003c') + ';\n';
  fs.writeFileSync(file, out, 'utf8');
}

injectInto(path.join('dist', 'data', 'touch-v1-impact.js'));
injectInto(path.join('dist', 'data', 'touch-v1-free.js'));
console.log('Wave 1 Immersion module built into touch-v1-impact.js and touch-v1-free.js, syntax checked');
