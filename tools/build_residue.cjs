const fs=require('fs'),cp=require('child_process');
const path='dist/data/touch-v1-impact.js',raw=fs.readFileSync(path,'utf8');
let html=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));
html=html.replace(/\/\* RESIDUE_V3_BEGIN \*\/[\s\S]*?\/\* RESIDUE_V3_END \*\//,'');
const entry='ptime = performance.now();\nmainloop();';
if(html.split(entry).length!==2)throw Error('entry anchor');
html=html.replace(entry,'/* RESIDUE_V3_BEGIN */\n'+fs.readFileSync('src/ground-residue-v3.js','utf8')+'\n/* RESIDUE_V3_END */\n'+entry);
for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)){const r=cp.spawnSync('node',['--check'],{input:script,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
fs.writeFileSync(path,'DATA["storyLegacy"]='+JSON.stringify(html).replace(/</g,'\\u003c')+';\n');console.log('Residue layer built; embedded JavaScript valid');
