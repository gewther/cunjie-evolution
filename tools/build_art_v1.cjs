'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const gameDir = path.join(root, process.argv.includes('--release') ? 'dist-release/game' : 'dist');
const geoRaw = fs.readFileSync(path.join(root, 'src', 'art-hd-geo.json'), 'utf8').trim();
const geo = JSON.parse(geoRaw);
const rawSrc = fs.readFileSync(path.join(root, 'src', 'art-overhaul-v1.js'), 'utf8').replace(/\r\n/g, '\n');
if (!rawSrc.includes('__XL_HD_GEO__')) throw new Error('Missing __XL_HD_GEO__ placeholder in src/art-overhaul-v1.js');
const src = rawSrc.replace('__XL_HD_GEO__', JSON.stringify(geo));

const begin = '/* ART_OVERHAUL_V1_BEGIN */';
const end = '/* ART_OVERHAUL_V1_END */\n';
const block = `${begin}\n${src}\n${end}`;

function injectInto(relFile) {
  const file = path.join(gameDir, relFile);
  const raw = fs.readFileSync(file, 'utf8');
  const eq = raw.indexOf('=');
  const prefix = raw.slice(0, eq + 1);
  let html = JSON.parse(raw.slice(eq + 1).trim().replace(/;$/, ''));

  if (html.includes(begin)) {
    const a = html.indexOf(begin);
    const b = html.indexOf(end, a);
    if (b < 0) throw new Error(`Missing ART_OVERHAUL_V1_END in ${relFile}`);
    html = html.slice(0, a) + block + html.slice(b + end.length);
  } else {
    const anchor = 'ptime = performance.now();\nmainloop();';
    const parts = html.split(anchor);
    if (parts.length !== 2) throw new Error(`Expected exact 1 mainloop anchor in ${relFile}, found ${parts.length - 1}`);
    html = parts[0] + block + anchor + parts[1];
  }

  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1].trim()) new vm.Script(m[1], { filename: `${path.basename(relFile)}-art-v1.js` });
  }
  const out = prefix + JSON.stringify(html).replace(/</g, '\\u003c') + ';\n';
  fs.writeFileSync(file, out, 'utf8');
}

injectInto(path.join('data', 'touch-v1-impact.js'));
injectInto(path.join('data', 'touch-v1-free.js'));
console.log('Art Overhaul v1 built into', path.relative(root, gameDir), ', syntax checked');
