'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const game=path.join(root,'dist-release','game');
const host=fs.readFileSync(path.join(game,'scripts','impact-host-3.js'),'utf8');
const scene=fs.readFileSync(path.join(game,'scripts','fenrir-scene-v1.js'),'utf8');
assert(host.includes('scripts/fenrir-scene-v1.js'),'Fenrir-only scene script must be injected by the host');
assert(host.includes('__installFenrirScene'),'host must install the scene bridge in the Fenrir iframe');
assert(host.includes("if(source.split(anchor).length===2)"),'scene bridge must fail open to the original backdrop');
assert(scene.includes("spr[0]!=='fenrirCity'"),'scene adapter must only replace the Fenrir city backdrop');
assert(scene.includes('original.call(this,[layer.key,sourceX,0,viewW,viewH]'),'scene must draw cropped parallax layers');
assert(scene.includes('reduceMotion'),'scene must respect reduced-motion preferences');
for(const name of ['city-far.svg','city-mid.svg','city-near.svg']){
 const svg=fs.readFileSync(path.join(game,'assets','fenrir',name),'utf8');
 assert(/<svg[^>]*width="1200"[^>]*height="240"[^>]*viewBox="0 0 1200 240"/.test(svg),name+' must be a 1200x240 wide scene layer');
 assert(svg.includes('</svg>'),name+' must close its SVG root');
}
// Exercise the actual scene adapter with mocked browser primitives.
const textures=new Map();
const calls=[];
let tick=1000;
class FakeImage{
 set src(value){this._src=value;this.complete=true;this.naturalWidth=1200;this.naturalHeight=240;queueMicrotask(()=>this.onload&&this.onload());}
 get src(){return this._src;}
}
const sandbox={
 window:{__xlImmersionPrefs:{reduceMotion:false},console:{warn(){}}},
 document:{baseURI:'https://example.test/cunjie-evolution/'},
 Image:FakeImage,
 performance:{now:()=>{tick+=16;return tick;}},
 URL,
 Map,
 Promise,
 console,
};
vm.runInNewContext(scene,sandbox,{filename:'fenrir-scene-v1.js'});
assert.equal(typeof sandbox.window.__installFenrirScene,'function');
const original=function(spr,x,y,w,h){calls.push({spr,x,y,w,h});};
const wrapped=sandbox.window.__installFenrirScene({
 spriteScaled:original,
 textures,
 newTexture:image=>({image,smooth:false}),
 w:400,h:240,
 getPawX:()=>300
});
assert.equal(typeof wrapped,'function');
setImmediate(()=>{
 try{
  assert.equal(sandbox.window.__fenrirCitySceneV1Status.ready,true,'all three scene layers should load');
  wrapped(['fenrirCity',0,0,400,240],0,0,400,240);
  assert.equal(calls.length,3,'Fenrir backdrop should expand into three parallax draws');
  assert.deepEqual(calls.map(c=>c.spr[0]),['fenrirCityFarV1','fenrirCityMidV1','fenrirCityNearV1']);
  assert.equal(textures.size,3,'all three scene textures should be cached');
  calls.length=0;
  wrapped(['unrelatedBackground',0,0,400,240],0,0,400,240);
  assert.equal(calls.length,1,'non-Fenrir backgrounds must pass through unchanged');
  assert.equal(calls[0].spr[0],'unrelatedBackground');
  console.log('Fenrir city scene tests passed: asset dimensions, async texture loading, three parallax draws, and non-Fenrir passthrough.');
 }catch(error){console.error(error);process.exitCode=1;}
});
