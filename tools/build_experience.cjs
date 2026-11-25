const fs=require('fs'),cp=require('child_process');const p='dist/data/touch-v1-impact.js';let raw=fs.readFileSync(p,'utf8'),h=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));
h=h.replace(/\/\* EXPERIENCE_V4_BEGIN \*\/[\s\S]*?\/\* EXPERIENCE_V4_END \*\//,'');
const a=h.indexOf('class RealmTouchVertical {'),b=h.indexOf('/* Installed inside the retained game closure',a);if(a<0||b<0)throw Error('touch anchors');
h=h.slice(0,a)+fs.readFileSync('src/touch-vertical.js','utf8').replace('/* Continuous hand-controlled vertical motion, in game-world units. No fling. */','')+'\n'+h.slice(b);
const entry='ptime = performance.now();\nmainloop();';if(h.split(entry).length!==2)throw Error('entry');h=h.replace(entry,'/* EXPERIENCE_V4_BEGIN */\n'+fs.readFileSync('src/experience-v4.js','utf8')+'\n/* EXPERIENCE_V4_END */\n'+entry);
for(const [,s] of h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)){const r=cp.spawnSync('node',['--check'],{input:s,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}fs.writeFileSync(p,'DATA["storyLegacy"]='+JSON.stringify(h).replace(/</g,'\\u003c')+';\n');console.log('experience built and syntax checked');
