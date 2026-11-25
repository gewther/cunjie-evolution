/* Presentation/controller state; all time is simulation time in seconds. */
class CunjieContactFeel {
 constructor(){this.reset();}
 reset(){this.grounded=false;this.age=0;this.clock=0;this.force=0;this.pressure=0;this.v=0;this.step=0;this.events=[];this.landings=0;this.releases=0;}
 limitVelocity(desired,dt){
  // Hold and direction reversal must never queue an involuntary downstroke.
  if(Math.abs(desired)<.1){this.v=0;return 0;}
  if(Math.sign(desired)!==Math.sign(this.v))this.v=0;
  this.v=Math.max(-2400,Math.min(2400,desired));
  return this.v;
 }
 update(dt,s){
  const t=Math.max(0,Math.min(.05,dt));this.clock+=t;
  const ground=s.state===3;let event=null;
  if(ground&&!this.grounded){this.age=0;this.step=0;this.landings++;
   this.force=Math.max(.04,Math.min(1,Math.max(0,s.velocity)/(s.manual?220:1400)));
   event={kind:'landing',force:this.force,x:s.x,at:this.clock};this.v=0;
  }
  if(ground){this.age+=t;const target=Math.max(0,Math.min(1,s.pressure));
   this.pressure=target;
   // Re-arm only after a meaningful pressure drop, not threshold jitter.
   if(this.pressure<.24)this.step=0;
   else if(this.pressure<.62&&this.step===2)this.step=1;
   if(this.age>.08&&this.pressure>.38&&this.step===0){this.step=1;event={kind:'pressure',force:this.pressure,x:s.x,at:this.clock};}
   else if(this.pressure>.78&&this.step===1){this.step=2;event={kind:'pressure',force:this.pressure,x:s.x,at:this.clock};}
  }else{
   if(this.grounded){this.releases++;event={kind:'release',force:this.pressure,x:s.x,at:this.clock};}
   this.pressure=0;this.age=0;this.step=0;
  }
  this.grounded=ground;
  if(event){this.events.push(event);if(this.events.length>32)this.events.shift();}
  return event;
 }
 squash(){return this.grounded?Math.min(.10,this.pressure*.036+this.force*.076*Math.exp(-this.age/.095)):0;}
 punch(){return this.grounded?this.force*Math.exp(-this.age/.13):0;}
 snapshot(){return {version:'contact-feel-2',grounded:this.grounded,age:this.age,force:this.force,pressure:this.pressure,squash:this.squash(),landings:this.landings,releases:this.releases,events:this.events.slice(-6)};}
}
if(typeof module!=='undefined')module.exports=CunjieContactFeel;
