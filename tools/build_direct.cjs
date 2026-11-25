const fs=require('fs'),cp=require('child_process'),p='dist/data/touch-v1-impact.js';let raw=fs.readFileSync(p,'utf8'),h=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));
const start=h.indexOf('/* Installed inside the retained game closure'),end=h.indexOf('window.realmTouchProbe=',start);if(start<0||end<0)throw Error('adapter anchors');const finish=h.indexOf('\n',end);
h=h.slice(0,start)+fs.readFileSync('src/touch-adapter.js','utf8')+'\n'+h.slice(finish);
h=h.replace(/\/\* DIRECT_V5_BEGIN \*\/[\s\S]*?\/\* DIRECT_V5_END \*\//,'');
const entry='ptime = performance.now();\nmainloop();';if(h.split(entry).length!==2)throw Error('entry');h=h.replace(entry,'/* DIRECT_V5_BEGIN */\n'+fs.readFileSync('src/direct-touch-v5.js','utf8')+'\n/* DIRECT_V5_END */\n'+entry);
for(const [,s] of h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)){const r=cp.spawnSync('node',['--check'],{input:s,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}fs.writeFileSync(p,'DATA["storyLegacy"]='+JSON.stringify(h).replace(/</g,'\\u003c')+';\n');console.log('absolute touch built and syntax checked');
