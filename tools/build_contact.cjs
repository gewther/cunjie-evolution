const fs=require('fs'),cp=require('child_process');
const file='dist/data/touch-v1-impact.js';
const raw=fs.readFileSync(file,'utf8');
let html=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));
html=html.replace(/\/\* EVOLUTION_CONTACT_BEGIN \*\/[\s\S]*?\/\* EVOLUTION_CONTACT_END \*\//,'');
const velocity='\tif(evoEnabled()&&!realmTouchOwns()&&!realmImpact.enabled()&&!exhausted) paw_y_velo=evoContact.limitVelocity(paw_y_velo,delta);\n';
html=html.replace(velocity,'');
const anchor='\tpaw_y_diff = paw_y_velo * delta;';
if(html.split(anchor).length!==2)throw Error('velocity anchor');
html=html.replace(anchor,velocity+anchor);
const start='ptime = performance.now();\nmainloop();';
if(html.split(start).length!==2)throw Error('entry anchor');
const patch=['src/contact-feel.js','src/contact-integration.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
html=html.replace(start,'/* EVOLUTION_CONTACT_BEGIN */\n'+patch+'\n/* EVOLUTION_CONTACT_END */\n'+start);
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
for(const [,s] of scripts){const r=cp.spawnSync('node',['--check'],{input:s,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
fs.writeFileSync(file,'DATA["storyLegacy"]='+JSON.stringify(html).replace(/</g,'\\u003c')+';\n');
console.log('Built first-act contact feel, inner scripts syntax checked');
