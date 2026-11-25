'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const game=path.join(root,'dist-release','game');
const host=fs.readFileSync(path.join(game,'scripts','impact-host-3.js'),'utf8');
const scene=fs.readFileSync(path.join(game,'scripts','fenrir-scene-v1.js'),'utf8');
assert(host.includes('scripts/fenrir-scene-v1.js'),'Fenrir-only scene script must be injected by the host');
assert(host.includes('__installFenrirScene'),'host must install the scene bridge in the Fenrir iframe');
assert(scene.includes('original.call(this,[layer.key,sourceX,0,viewW,viewH]'),'scene must draw cropped parallax layers');
assert(scene.includes('reduceMotion'),'scene must respect reduced-motion preferences');
for(const name of ['city-far.svg','city-mid.svg','city-near.svg']){
 const svg=fs.readFileSync(path.join(game,'assets','fenrir',name),'utf8');
 assert(/<svg[^>]*width="1200"[^>]*height="240"[^>]*viewBox="0 0 1200 240"/.test(svg),name+' must be a 1200x240 wide scene layer');
}
assert(host.includes("if(isFenrir){"),'scene injection must be restricted to Fenrir mode');
console.log('Fenrir city scene tests passed: 3 layers, host injection, parallax adapter, reduced-motion gate.');
