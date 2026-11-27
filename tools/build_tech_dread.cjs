'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const isRelease = process.argv.includes('--release');
const gameDir = path.join(root, isRelease ? 'dist-release/game' : 'dist');
const srcPath = path.join(root, 'src', 'tech-dread-v1.js');
const outPath = path.join(gameDir, 'scripts', 'tech-dread-v1.js');

const code = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n');
new vm.Script(code, { filename: 'tech-dread-v1.js' });

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, code, 'utf8');
console.log('Tech Dread V1 built into', path.relative(root, outPath), ', syntax checked');
