/* Continuous hand-controlled vertical motion, in game-world units. No fling. */
class RealmTouchVertical {
 constructor(){this.owned=false;this.dragging=false;this.y=64;this.target=64;this.v=0;this.velocity=0;this.pressure=0;this.lastContactSpeed=0;this.lastStamp=0;}
 begin(y,stamp,minY,floorY,height){
  this.minY=minY;this.floorY=floorY;this.height=height;
  this.y=Math.max(minY,Math.min(floorY,y));this.target=this.y;
  this.v=0;this.velocity=0;this.pressure=0;this.lastContactSpeed=0;
  this.lastStamp=stamp;this.owned=true;this.dragging=true;this.freshTap=true;this.lastEvent='touchstart';
 }
 move(dy,stamp,sensitivity,y){
  if(!this.owned||!this.dragging)return;
  const dt=Math.max(.004,Math.min(.05,(stamp-this.lastStamp)/1000));this.lastStamp=stamp;
  const gain=.8*Math.max(.5,Math.min(1.25,sensitivity||1));
  const dyTarget=Math.max(-220*dt,Math.min(220*dt,dy*gain));
  let next=Math.max(this.minY,Math.min(this.floorY+this.height*.85,this.target+dyTarget));
  // A flick cannot queue a full-screen destination while the shoe is still high.
  if(y<this.floorY-.1)next=Math.max(y-24,Math.min(y+24,next));
  this.target=next;
 }
 hold(y){
  if(!this.owned)return;
  this.dragging=false;this.y=Math.max(this.minY,Math.min(this.floorY,y));
  this.target=this.y;this.v=0;this.velocity=0;this.pressure=0;this.freshTap=false;
 }
 disown(reason){this.lastEvent=reason||'disown';this.owned=false;this.dragging=false;this.v=0;this.velocity=0;this.pressure=0;this.freshTap=false;}
 step(dt,y,minY,floorY,height){
  this.minY=minY;this.floorY=floorY;this.height=height;this.y=y;
  const total=Math.max(0,Math.min(.05,dt));let left=total;
  if(this.absolute){
   this.y=Math.max(minY,Math.min(floorY,this.target));this.v=0;
   this.velocity=dt>0?(this.y-y)/dt:0;
   this.pressure=this.dragging&&this.y>=floorY?Math.max(0,Math.min(1,(this.target-floorY)/(height*.85))):0;
   return this.y>=floorY&&this.target>=floorY?height*(1+this.pressure):this.y;
  }
  if(y>=floorY-.001&&this.target>=floorY){
   this.y=floorY;this.v=0;
  }else while(left>1e-7){
   const step=Math.min(1/120,left),error=this.target-this.y;
   const limit=error>=0?130:170,accel=700;
   const desired=Math.sign(error)*Math.min(limit,Math.abs(error)*22,Math.sqrt(2*accel*Math.abs(error)));
   this.v+=Math.max(-accel*step,Math.min(accel*step,desired-this.v));
   this.y+=this.v*step;
   if(Math.abs(this.target-this.y)<.025&&Math.abs(this.v)<1){this.y=this.target;this.v=0;}
   if(this.y<minY){this.y=minY;this.v=0;}
   if(this.y>=floorY){this.y=Math.max(floorY,this.y);break;}
   left-=step;
  }
  this.velocity=dt>0?(this.y-y)/dt:0;
  const targetP=this.dragging?Math.max(0,Math.min(1,(this.target-floorY)/(height*.85))):0;
  const grounded=y>=floorY-.001||this.y>=floorY;
  this.pressure+=Math.max(-3*total,Math.min(1.6*total,(grounded?targetP:0)-this.pressure));
  const destination=grounded&&this.target>=floorY?height*(1+this.pressure):Math.min(floorY,this.target);
  return destination;
 }
 landing(speed){this.lastContactSpeed=Math.max(0,speed);}
 snapshot(){return {enabled:this.owned,dragging:this.dragging,target:this.target,y:this.y,velocity:this.velocity,pressure:this.pressure,contactSpeed:this.lastContactSpeed,lastEvent:this.lastEvent};}
}
if(typeof module!=='undefined'&&module.exports)module.exports=RealmTouchVertical;
