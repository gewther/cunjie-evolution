'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.env.CUNJIE_ROOT ? path.resolve(process.env.CUNJIE_ROOT) : path.resolve(__dirname, '..');
const gameDir = path.join(root, process.argv.includes('--release') ? 'dist-release/game' : 'dist');
const hostPath = path.join(gameDir, 'scripts', 'impact-host-3.js');
const source = fs.readFileSync(path.join(root, 'src', 'fenrir-scene-v1.js'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'src', 'fenrir-controls.js'), 'utf8').replace(/\r\n/g, '\n');
const bridge = fs.readFileSync(path.join(root, 'src', 'fenrir-scene-bridge.js'), 'utf8').replace(/\r\n/g, '\n');
new vm.Script(source, {filename: 'fenrir-scene-v1.js'});
new vm.Script(controls + bridge, {filename: 'fenrir iframe integration'});

let host = fs.readFileSync(hostPath, 'utf8');
const start = host.indexOf('function legacySource');
const end = host.indexOf('function paintShoePreviews', start);
if (start < 0 || end < 0) throw new Error('Cannot locate legacySource in the Fenrir host');
const tagLine = host.slice(start, end).split('\n').find(line => line.includes('const tag='));
if (!tagLine) throw new Error('Original custom-motion flag missing');

const sourceFunction = [
 "function legacySource(kind,motionAtlas='',isFenrir=false){",
 " if(kind==='free'&&motionAtlas){",
 tagLine,
 "  let source=DATA.freeLegacy.includes('<head>')?DATA.freeLegacy.replace('<head>','<head>'+tag):DATA.freeLegacy;",
 "  if(isFenrir){",
 "   const anchor='ptime = performance.now();\\nmainloop();';",
 "   const bridge=" + JSON.stringify(controls + bridge) + ";",
 "   if(source.split(anchor).length===2){",
 "    source=source.replace(anchor,()=>bridge+anchor);",
 "    source=source.replace('<head>','<head><script src=\"scripts/fenrir-scene-v1.js\"></script>');",
 "   }else{console.warn('[Fenrir scene] Bridge anchor missing; original backdrop retained.');}",
 "  }",
 "  return injectHttpBase(source);",
 " }",
 " const source=CunjieShoeSkin.legacy(kind==='free'?DATA.freeLegacy:DATA.storyLegacy,DATA.images.sneakers,activeShoeSkin==='qiaodan'?DATA.images.sneakersQiaodan:DATA.images.sneakersAJ6,activeShoeSkin);",
 " return injectHttpBase(kind==='free'?source:v59EmbeddedVisualOnly(v58EmbeddedVisualOnly(source)));",
 "}",
 ""
].join('\n');
host = host.slice(0, start) + sourceFunction + host.slice(end);
new vm.Script(host, {filename: 'impact-host-3.js'});

const sceneOut = path.join(gameDir, 'scripts', 'fenrir-scene-v1.js');
const assetDir = path.join(gameDir, 'assets', 'fenrir');
fs.mkdirSync(assetDir, {recursive: true});
for (const name of ['city-far.svg', 'city-mid.svg', 'city-near.svg']) {
 fs.copyFileSync(path.join(root, 'assets', 'fenrir', name), path.join(assetDir, name));
}
fs.writeFileSync(sceneOut, source);
fs.writeFileSync(hostPath, host);
console.log('Fenrir scene, layer assets and runtime bridge synchronized.');
