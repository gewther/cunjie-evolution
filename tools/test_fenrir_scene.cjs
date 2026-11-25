'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const os=require('os');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const game=path.join(root,'dist-release','game');
const host=fs.readFileSync(path.join(game,'scripts','impact-host-3.js'),'utf8');
const scene=fs.readFileSync(path.join(game,'scripts','fenrir-scene-v1.js'),'utf8');

assert(host.includes('scripts/fenrir-scene-v1.js'),'Fenrir-only scene script must be injected by the host');
assert(host.includes('__installFenrirScene'),'host must install the scene bridge in the Fenrir iframe');
assert(host.includes('if(source.split(anchor).length===2)'),'scene bridge must fail open to the original backdrop');
assert(scene.includes("spr[0]!=='fenrirCity'"),'scene adapter must only replace the Fenrir city backdrop');
assert(scene.includes('original.call(this,[layer.key,sourceX,0,viewW,viewH]'),'scene must draw cropped parallax layers');
assert(scene.includes('reduceMotion'),'scene must respect reduced-motion preferences');

for(const name of ['city-far.svg','city-mid.svg','city-near.svg']){
 const svg=fs.readFileSync(path.join(game,'assets','fenrir',name),'utf8');
 assert(/<svg[^>]*width="1200"[^>]*height="240"[^>]*viewBox="0 0 1200 240"/.test(svg),name+' must be a 1200x240 wide scene layer');
 assert(svg.includes('</svg>'),name+' must close its SVG root');
}

function testBuildIntegration(){
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'cunjie-fenrir-build-'));
 try{
  for(const dir of ['src','assets/fenrir','dist/scripts'])fs.mkdirSync(path.join(fixture,dir),{recursive:true});
  fs.copyFileSync(path.join(root,'src','fenrir-scene-v1.js'),path.join(fixture,'src','fenrir-scene-v1.js'));
  for(const name of ['city-far.svg','city-mid.svg','city-near.svg'])fs.copyFileSync(path.join(root,'assets','fenrir',name),path.join(fixture,'assets','fenrir',name));
  const hostFixture=[
   'function injectHttpBase(src){return src;}',
   "function legacySource(kind,motionAtlas='',isFenrir=false){",
   " const tag='<script>window.__cunjieCustomMotion=true;window.__cunjieFenrirCity=true;</script>';",
   ' return injectHttpBase(DATA.freeLegacy);',
   '}',
   'function paintShoePreviews(){}'
  ].join(String.fromCharCode(10));
  fs.writeFileSync(path.join(fixture,'dist','scripts','impact-host-3.js'),hostFixture);
  const result=spawnSync(process.execPath,[path.join(root,'tools','build_fenrir_scene.cjs')],{
   encoding:'utf8',env:{...process.env,CUNJIE_ROOT:fixture}
  });
  assert.equal(result.status,0,'isolated build fixture should succeed: '+result.stderr);
  const builtHost=fs.readFileSync(path.join(fixture,'dist','scripts','impact-host-3.js'),'utf8');
  new vm.Script(builtHost,{filename:'fixture-impact-host-3.js'});
  assert(builtHost.includes('window.__installFenrirScene'),'builder must inject the Fenrir runtime bridge');
  assert(builtHost.includes('scripts/fenrir-scene-v1.js'),'builder must load the scene adapter');
  assert(fs.existsSync(path.join(fixture,'dist','scripts','fenrir-scene-v1.js')),'builder must copy the scene adapter');
  for(const name of ['city-far.svg','city-mid.svg','city-near.svg']){
   assert.equal(fs.readFileSync(path.join(fixture,'dist','assets','fenrir',name),'utf8'),fs.readFileSync(path.join(root,'assets','fenrir',name),'utf8'),name+' must be copied byte-for-byte');
  }
 }finally{
  fs.rmSync(fixture,{recursive:true,force:true});
 }
}
testBuildIntegration();

function makeSandbox(ImageClass){
 let tick=1000;
 return {
  window:{__xlImmersionPrefs:{reduceMotion:false},console:{warn(){}}},
  document:{baseURI:'https://example.test/cunjie-evolution/'},
  Image:ImageClass,
  performance:{now:()=>{tick+=16;return tick;}},
  URL,Map,Promise,console
 };
}
function nextTurn(){return new Promise(resolve=>setImmediate(resolve));}

async function main(){
 const textures=new Map(),calls=[],imageUrls=[];
 class FakeImage{
  set src(value){this._src=value;imageUrls.push(value);this.complete=true;this.naturalWidth=1200;this.naturalHeight=240;queueMicrotask(()=>this.onload&&this.onload());}
  get src(){return this._src;}
 }
 const sandbox=makeSandbox(FakeImage);
 vm.runInNewContext(scene,sandbox,{filename:'fenrir-scene-v1.js'});
 assert.equal(typeof sandbox.window.__installFenrirScene,'function');
 let pawX=300;
 const original=function(spr,x,y,w,h){calls.push({spr,x,y,w,h});};
 const wrapped=sandbox.window.__installFenrirScene({
  spriteScaled:original,textures,newTexture:image=>({image,smooth:false}),
  w:400,h:240,getPawX:()=>pawX
 });
 assert.equal(typeof wrapped,'function');
 await nextTurn();
 assert.equal(sandbox.window.__fenrirCitySceneV1Status.ready,true,'all three scene layers should load');
 assert.equal(textures.size,3,'all three scene textures should be cached');
 assert.deepEqual(imageUrls.sort(),['https://example.test/cunjie-evolution/assets/fenrir/city-far.svg','https://example.test/cunjie-evolution/assets/fenrir/city-mid.svg','https://example.test/cunjie-evolution/assets/fenrir/city-near.svg'].sort(),'scene URLs must resolve correctly under a GitHub Pages subpath');
 assert([...textures.values()].every(t=>t.smooth===true),'all city textures should use smooth sampling');

 wrapped(['fenrirCity',0,0,400,240],0,0,400,240); // prime the frame clock
 calls.length=0;
 wrapped(['fenrirCity',0,0,400,240],0,0,400,240);
 assert.equal(calls.length,3,'Fenrir backdrop should expand into three parallax draws');
 assert.deepEqual(calls.map(c=>c.spr[0]),['fenrirCityFarV1','fenrirCityMidV1','fenrirCityNearV1']);
 const sourceXs=calls.map(c=>c.spr[1]);
 assert(sourceXs[0]<sourceXs[1]&&sourceXs[1]<sourceXs[2],'near layers must move farther than mid and far layers');
 assert(sandbox.window.__fenrirCitySceneV1Status.cameraX>400,'camera should follow the paw position');
 calls.length=0;

 sandbox.window.__xlImmersionPrefs.reduceMotion=true;
 pawX=400;
 for(let i=0;i<120;i++)wrapped(['fenrirCity',0,0,400,240],0,0,400,240);
 assert(Math.abs(sandbox.window.__fenrirCitySceneV1Status.cameraX-400)<1,'reduced motion should return camera to a steady centered view');

 calls.length=0;
 wrapped(['unrelatedBackground',0,0,400,240],0,0,400,240);
 assert.equal(calls.length,1,'non-Fenrir backgrounds must pass through unchanged');
 assert.equal(calls[0].spr[0],'unrelatedBackground');

 class BrokenImage{
  set src(value){this._src=value;queueMicrotask(()=>this.onerror&&this.onerror(new Error('mock image failure')));}
 }
 const failedTextures=new Map(),failedCalls=[],failedSandbox=makeSandbox(BrokenImage);
 vm.runInNewContext(scene,failedSandbox,{filename:'fenrir-scene-failure-test.js'});
 const failedWrapped=failedSandbox.window.__installFenrirScene({
  spriteScaled:function(spr){failedCalls.push(spr);},textures:failedTextures,
  newTexture:image=>({image}),w:400,h:240,getPawX:()=>200
 });
 await nextTurn();
 assert.equal(failedSandbox.window.__fenrirCitySceneV1Status.failed,true,'failed assets should set failure status');
 failedWrapped(['fenrirCity',0,0,400,240],0,0,400,240);
 assert.equal(failedCalls.length,1,'failed asset loading must preserve the original city backdrop');
 assert.equal(failedCalls[0][0],'fenrirCity');

 console.log('Fenrir city scene tests passed: isolated build integration, SVG dimensions, async texture loading, Pages subpath URLs, three-layer parallax, paw tracking, reduced motion, non-Fenrir passthrough, and graceful asset fallback.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
