'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src', 'skin-pack-runtime.js'), 'utf8');
const block = `/* SKIN_PACK_RUNTIME_BEGIN */\n${src}\n/* SKIN_PACK_RUNTIME_END */\n`;
const begin = '/* SKIN_PACK_RUNTIME_BEGIN */';
const end = '/* SKIN_PACK_RUNTIME_END */\n';

for (const rel of ['dist/data/touch-v1-impact.js', 'dist/data/touch-v1-free.js']) {
  const file = path.join(root, rel);
  const raw = fs.readFileSync(file, 'utf8');
  const eq = raw.indexOf('=');
  const prefix = raw.slice(0, eq + 1);
  let html = JSON.parse(raw.slice(eq + 1).trim().replace(/;$/, ''));

  if (html.includes(begin)) {
    const a = html.indexOf(begin);
    const b = html.indexOf(end, a);
    if (b < 0) throw new Error(`Missing SKIN_PACK_RUNTIME_END in ${rel}`);
    html = html.slice(0, a) + block + html.slice(b + end.length);
  } else {
    const anchor = 'ptime = performance.now();\nmainloop();';
    if (!html.includes(anchor)) throw new Error(`Missing mainloop anchor in ${rel}`);
    html = html.replace(anchor, block + anchor);
  }

  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    new vm.Script(m[1], { filename: path.basename(rel) + '-inner.js' });
  }
  const out = prefix + JSON.stringify(html).replace(/</g, '\\u003c') + ';\n';
  fs.writeFileSync(file, out, 'utf8');
  console.log(`Skin pack runtime built into ${rel}, syntax checked`);
}
