const assert=require('assert'),Contact=require('../src/contact-feel.js');
const c=new Contact();let events=[];
for(let i=0;i<60;i++){const e=c.update(1/60,{state:3,velocity:620,x:200,pressure:1,manual:false});if(e)events.push(e);}
assert.equal(c.landings,1);assert.equal(events.filter(e=>e.kind==='landing').length,1);assert.equal(events.filter(e=>e.kind==='pressure').length,2);assert(c.pressure>.99);
const elapsed=events.find(e=>e.kind==='pressure').at;assert(elapsed<=.12,'instantaneous native pressure reaches accent without lag');
c.update(.02,{state:2,velocity:-100,x:200,pressure:0});assert.equal(c.releases,1);assert.equal(c.pressure,0);
let max=0;const motion=new Contact();for(let i=0;i<60;i++){const v=motion.limitVelocity(2400,1/60);max=Math.max(max,v);}assert.equal(max,2400,'native 2400 max velocity unlocked');assert.equal(motion.limitVelocity(0,.02),0);
const light=new Contact(),heavy=new Contact();light.update(.02,{state:3,velocity:12,x:0,pressure:0,manual:true});heavy.update(.02,{state:3,velocity:180,x:0,pressure:0,manual:true});assert(heavy.force>light.force*5);assert(heavy.squash()>light.squash());
const sample=hz=>{const v=new Contact();for(let i=0;i<hz*.3;i++)v.update(1/hz,{state:3,velocity:1400,x:0,pressure:1});return v.pressure;};assert(Math.abs(sample(60)-sample(120))<.04);
const rearm=new Contact();let hits=[];const press=p=>{let e=rearm.update(.02,{state:3,velocity:0,x:0,pressure:p,manual:true});if(e?.kind==='pressure')hits.push(e);};
for(let i=0;i<6;i++)press(0);press(.41);press(.37);press(.40);assert.equal(hits.length,1,'small fluctuations cannot retrigger');
press(.8);press(.76);press(.8);assert.equal(hits.length,2,'high threshold has hysteresis');
press(.5);press(.8);assert.equal(hits.length,3,'partial release rearms heavy pressure');
press(.1);press(.4);assert.equal(hits.length,4,'full release rearms light pressure without lifting');
for(let i=0;i<1000;i++){c.update(.02,{state:i%2?2:3,velocity:100,x:0,pressure:1});}assert(c.events.length<=32);
console.log(JSON.stringify({checks:9,passed:true,pressureAccentSeconds:elapsed,maximumAutoDownSpeed:max,lightForce:light.force,heavyForce:heavy.force,pressureAt300ms:{hz60:sample(60),hz120:sample(120)},boundedEvents:c.events.length},null,2));
