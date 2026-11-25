/* Installed inside the retained game closure, after the existing bridges. */
const realmTouch=new RealmTouchVertical();
const realmTouchAuto=()=>typeof realmAutonomyEnabled!=='undefined'&&realmAutonomyEnabled;
const realmTouchOwns=()=>realmTouch.owned&&!realmTouchAuto();
// mainloop is declared outside done_loading(), so it must use an explicit
// window bridge instead of closing over realmTouchOwns.
window.realmTouchOwnsInput=realmTouchOwns;
const handledTouchEvents=new WeakSet();
let realmTouchId=null,realmTouchLastY=0;
function realmTouchFreeze(){
 if(!realmTouchOwns())return;
 realmTouch.hold(paw_y);mp=false;touchid=null;realmTouchId=null;
 my=paw_y/2;paw_dest_y=paw_y;
}
function realmTouchDisown(reason){
 const owned=realmTouch.owned;realmTouch.disown(reason);realmTouchId=null;
 if(owned&&typeof realmImpact!=='undefined'){realmImpact.mode='';realmImpact.path=null;}
}
let realmLastTouchAt=-9999;
function realmTouchStart(e){
 if(handledTouchEvents.has(e)||realmTouchAuto()||(e.target&&e.target!==oc))return;
 handledTouchEvents.add(e);if(e.cancelable)e.preventDefault();
 if(realmTouchId!==null&&(!e.touches||![...e.touches].some(x=>x.identifier===realmTouchId)))realmTouchFreeze();
 if(realmTouchId!==null||e.changedTouches.length!==1)return;
 const t=e.changedTouches[0],m=canvas_coords(t);
 realmLastTouchAt=performance.now();
 realmTouchId=t.identifier;touchid=t.identifier;realmTouchLastY=m[1];
 tx=tdx=m[0];ty=tdy=m[1];touchmode=true;moncanvas=true;mp=true;
 realmTouch.begin(paw_y,performance.now(),paw_min_y,floor_y,h);
 realmTouch.absolute=true;realmTouchPoint(m);
}
function realmTouchPoint(m){
 tx=tdx=mx=Math.max(paw.left_limit,Math.min(w+paw.right_limit,m[0]));
 const yy=Math.max(paw_min_y,Math.min(h,m[1])),splitY=Math.max(paw_min_y+24,floor_y-34);
 if(yy<=splitY){
  const airT=(yy-paw_min_y)/Math.max(1,splitY-paw_min_y);
  realmTouch.target=paw_min_y+airT*(floor_y-paw_min_y);
 }else{
  const pressT=Math.max(0,Math.min(1,(yy-splitY)/Math.max(1,(h-4)-splitY)));
  realmTouch.target=floor_y+pressT*h*.85;
 }
 my=realmTouch.target/2;paw_dest_y=realmTouch.target;
}
function realmTouchMove(e){
 if(handledTouchEvents.has(e)||!realmTouchOwns()||!realmTouch.dragging)return;
 handledTouchEvents.add(e);if(e.cancelable)e.preventDefault();
 realmLastTouchAt=performance.now();
 for(const t of e.touches){if(t.identifier!==realmTouchId)continue;
  const m=canvas_coords(t);tdx=m[0];tdy=m[1];
  realmTouchPoint(m);
  realmTouchLastY=m[1];touchmode=true;
 }
}
function realmTouchEnd(e){
 if(handledTouchEvents.has(e))return;handledTouchEvents.add(e);
 if(e.cancelable)e.preventDefault();
 realmLastTouchAt=performance.now();
 for(const t of e.changedTouches)if(t.identifier===realmTouchId){realmTouchFreeze();mr=true;break;}
}
oc.ontouchstart=ocd.ontouchstart=realmTouchStart;
oc.ontouchmove=ocd.ontouchmove=realmTouchMove;
oc.ontouchend=ocd.ontouchend=realmTouchEnd;
oc.ontouchcancel=ocd.ontouchcancel=e=>{if(e.cancelable)e.preventDefault();realmTouchFreeze();};
// Explicit non-passive listeners work on Android and on TouchEvent replay hosts.
for(const target of [oc,ocd])for(const [type,handler] of [
 ['touchstart',realmTouchStart],['touchmove',realmTouchMove],['touchend',realmTouchEnd],['touchcancel',oc.ontouchcancel]
])target.addEventListener(type,handler,{passive:false});
const realmTouchMouseMove=onmousemove,realmTouchMouseDown=oc.onmousedown;
const realmTouchRecent=()=>performance.now()-realmLastTouchAt<500;
onmousemove=e=>{if(e.sourceCapabilities?.firesTouchEvents||(!(e.buttons>0)&&realmTouchRecent()))return;if(e.target===oc)realmTouchDisown();return realmTouchMouseMove(e);};
oc.onmousedown=e=>{if(!e.sourceCapabilities?.firesTouchEvents&&!(performance.now()-realmLastTouchAt<120))realmTouchDisown();return realmTouchMouseDown(e);};
if(typeof realmPlayerCommand==='function'){
 const oldTouchCommand=realmPlayerCommand;
 realmPlayerCommand=function(kind,props={}){
  if(realmTouchOwns()&&(kind==='release'||kind==='cancel')&&props.source!=='autopilot'){realmTouchFreeze();return true;}
  if(['up','down','press'].includes(kind)||props.source==='autopilot')realmTouchDisown('command:'+kind+':'+props.source);
  return oldTouchCommand(kind,props);
 };
}
if(window.realmBridge){
 const b=window.realmBridge,oldSetup=b.setup,oldAuto=b.autonomy,oldPause=b.pause,oldSnapshot=b.snapshot;
 b.setup=function(...a){realmTouchDisown('setup');return oldSetup.apply(this,a);};
 b.autonomy=function(...a){realmTouchDisown('autonomy');return oldAuto.apply(this,a);};
 b.pause=function(...a){if(realmTouchOwns())realmTouchFreeze();return oldPause.apply(this,a);};
 b.snapshot=function(){const s=oldSnapshot.call(this);return realmTouchOwns()?{...s,manualTouch:realmTouch.snapshot()}:s;};
}
window.addEventListener('blur',realmTouchFreeze);
document.addEventListener('visibilitychange',()=>{if(document.hidden)realmTouchFreeze();});
// This read-only probe is used by the separate gesture replay page, not gameplay.
window.realmTouchProbe=()=>({...realmTouch.snapshot(),actualY:paw_y,footState:paw_state,actualPressure:pressure,stomp:stomp_size,x:paw_x});
