const fs=require('fs'),vm=require('vm'),assert=require('assert');
const noop=()=>{};const ctx2d=new Proxy({},{get:()=>noop,set:()=>true});
const mutedCheck=[];
const sandbox={Image:class{constructor(){this.complete=true;this.naturalWidth=1254;}},document:{createElement:()=>({getContext:()=>ctx2d})},
 realmIndex:0,realmAfterFx:{shoeSkin:'aj6',enabled:true,hit:noop,update:noop,draw:noop,reset:noop,snapshot:()=>({})},
 paw_state:0,paw_y:64,paw_x:200,paw:{width:160},paw_min_y:64,floor_y:228,h:240,w:400,
 pressure:0,active:true,pause:false,tr:false,sc:2,realmPrefs:{sound:true},realmMood:{},
 sound:(name)=>{mutedCheck.push(name);return name;},
 realmAJ6Map:{a:1.025,b:-.120,c:.120,d:1.025,e:-20,f:22},realmFrameGeometry:()=>({x:0,y:0,scale:1,w:160,h:256}),
 realmAJ6F1Mask:{},realmAJ6F2Mask:{},draw_bug:noop,draw_stains:noop,draw_strands:noop,draw_droplets:noop,draw_stickers:noop,draw_fallers:noop,
 window:{parent:{location:{search:''}}},URLSearchParams,console};
vm.createContext(sandbox);
const source=fs.readFileSync('src/impact-pass.js','utf8').replace('__IMPACT_RECTS__',JSON.stringify(Array.from({length:16},()=>[0,0,100,100])));
vm.runInContext(source+';globalThis.controller=realmImpact;',sandbox);
const c=sandbox.controller,dt=1/60;let landedAt=0,elapsed=0,pressures=[];
for(let i=0;i<50;i++){
 const raw=478;
 const target=c.target(dt,raw);
 assert.equal(target,raw,'Native target destination must pass through untouched');
 const springV=Math.min(2400,(target-sandbox.paw_y)*(4+(target-sandbox.paw_y)/48));
 const v=c.velocity(dt,springV);
 assert.equal(v,springV,'Native spring velocity must pass through untouched');
 sandbox.paw_y+=v*dt;
 if(sandbox.paw_y>=228){sandbox.paw_y=228;sandbox.paw_state=3;if(!landedAt)landedAt=elapsed+dt;}
 sandbox.pressure=sandbox.paw_state===3?Math.max(0,(target-240)/240):0;
 c.target(dt,240+240*Math.min(1,(i+1)/20));
 pressures.push(c.pressure);elapsed+=dt;
}
assert(landedAt<.20,'Native spring acceleration reaches floor rapidly instead of fixed 0.23s lock');
assert(pressures.some(x=>x>.15&&x<.5)&&pressures.some(x=>x>.5&&x<.85),'Intermediate pressure values must be reachable');
c.target(dt,478);assert(c.pressure>.95,'Held press reaches full pressure');
assert.equal(c.soundEvents.length,0,'Empty pressure does not play target impact accents');
for(const n of ['crush','pop','bigcrush','squishy'])sandbox.sound(n);
assert.deepEqual(mutedCheck,['crush','pop','bigcrush','squishy'],'Native impact SFX must not be muted');
const b={seen:true,health:6,x:207,alive:()=>true};
c.hit(b,7,false);assert.equal(c.hits,1);c.hit(b,7,false);assert.equal(c.hits,1,'Repeated hit in same cooldown is coalesced');
assert.equal(c.soundEvents.filter(x=>x.kind==='hit').length,1);
const groundX=c.marks[0].x;sandbox.paw_x=270;c.update(dt);assert.equal(c.marks[0].x,groundX,'Ground mark cannot move with the shoe');
let liftAt=0;
for(let i=0;i<35;i++){
 const raw=0,springV=(raw-sandbox.paw_y)*4;
 c.target(dt,raw);sandbox.paw_y+=c.velocity(dt,springV)*dt;
 if(sandbox.paw_y<228)sandbox.paw_state=sandbox.paw_y>180?2:1;
 c.update(dt);if(sandbox.paw_y<=64.01&&!liftAt)liftAt=(i+1)*dt;
}
assert(liftAt>0&&liftAt<.40,'Native spring lift works cleanly without fixed 0.43s lock');
assert.equal(c.releases,1,'Release counted once');
assert(c.soundEvents.filter(x=>x.kind==='release').length<=1,'Break accents are rate limited');
sandbox.realmIndex=1;assert.equal(c.target(dt,300),300,'Later acts retain original motion');
console.log(JSON.stringify({passed:9,descentSeconds:landedAt,liftSeconds:liftAt,pressureSamples:pressures.filter((_,i)=>i%5===0),unmutedSfx:mutedCheck,groundAnchorPreserved:true,laterActsUntouched:true},null,2));
