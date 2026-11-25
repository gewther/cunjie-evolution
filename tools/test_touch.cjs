const assert=require('node:assert/strict');
const Control=require('../src/touch-vertical.js');
function world(y=80){const c=new Control();c.begin(y,0,64,228,240);return {c,y,time:0,landing:null};}
function tick(w,dy=0){w.time+=16.6666667;if(dy)w.c.move(dy,w.time,1,w.y);const before=w.y;
 w.c.step(1/60,w.y,64,228,240);w.y+=w.c.velocity/60;
 if(w.y>=228){if(before<228){w.landing=w.c.velocity;w.c.landing(w.landing);}w.y=228;}
 return w;
}
const slow=world();for(let i=0;i<100;i++)tick(slow,.6);
assert(slow.y>110&&slow.y<150,'slow drag follows a continuous intermediate height');
const target=slow.c.target;for(let i=0;i<90;i++)tick(slow);
assert(Math.abs(slow.y-target)<.04,'stationary finger settles at the airborne target');
assert(slow.y<228,'hover must not invoke an end-to-end descent');
const flick=world();tick(flick,400);for(let i=0;i<60;i++)tick(flick);
assert(flick.y<90,'one huge flick cannot queue a ground-level destination');
const fast=world();let previousV=0,maxAcceleration=0,maxSpeed=0;
for(let i=0;i<100&&fast.y<228;i++){tick(fast,12);const v=fast.c.velocity;maxAcceleration=Math.max(maxAcceleration,Math.abs(v-previousV)*60);maxSpeed=Math.max(maxSpeed,v);previousV=v;}
assert(maxSpeed<=130.001,'independent downward speed cap');
assert(maxAcceleration<=701,'independent acceleration cap');
const light=world(205);for(let i=0;i<160&&light.y<228;i++)tick(light,.45);
const heavy=world(205);for(let i=0;i<160&&heavy.y<228;i++)tick(heavy,12);
assert(light.landing>0&&heavy.landing>light.landing*2,'contact speed remains dependent on the gesture');
const press=world(228);for(let i=0;i<100;i++)tick(press,2);
assert(press.c.pressure>.6&&press.y===228,'continued drag increases pressure without moving through the floor');
for(let i=0;i<180;i++)tick(press,-2);
assert(press.y<120&&press.c.pressure===0,'upward drag unloads and lifts');
const end=world();for(let i=0;i<15;i++)tick(end,12);const endY=end.y;end.c.hold(endY);for(let i=0;i<60;i++)tick(end);
assert(Math.abs(end.y-endY)<.001,'touch end/cancel has no fling or queued fall');
console.log(JSON.stringify({passed:8,hoverY:slow.y,flickY:flick.y,maxDownSpeed:maxSpeed,maxAcceleration,lightContactSpeed:light.landing,fastContactSpeed:heavy.landing,pressureHeld:press.c.pressure,liftY:press.y},null,2));
