/* Absolute pointer position and a material scuff gesture for act I. */
let directActive=false;
const directKick=kick_bugs;
kick_bugs=function(dx){if(directActive)return;return directKick(dx);};
const directPawUpdate=update_paw;
update_paw=function(){
 const owns=realmTouchOwns()&&realmTouch.absolute&&!pause&&!tr&&active;
 const prevX=paw_x;
 directActive=owns;
 try{directPawUpdate();}finally{directActive=false;}
 if(!owns)return;
 const x=Math.max(paw.left_limit,Math.min(w+paw.right_limit,mx)),dx=x-prevX;
 if(realmTouch.freshTap){realmTouch.freshTap=false;paw_x=x;return;}
 if(dx&&!paw.steamroller&&realmTouch.dragging)directKick(Math.max(-12,Math.min(12,dx)));
 paw_x_diff+=x-paw_x;paw_x=x;
};
let scuffX=null,scuffAt=-1;
const directMaterialUpdate=realmAfterFx.update;
realmAfterFx.update=function(dt,...args){directMaterialUpdate.call(this,dt,...args);
 if(realmIndex!==0||!this.enabled||xlGfxPrefs.blood==='off'||paw_state!==3||pressure<.2||!residueSole.length){scuffX=null;return;}
 if(scuffX===null){scuffX=paw_x;return;}
 if(Math.abs(paw_x-scuffX)>8&&residueClock-scuffAt>.08){
  const span=Math.abs(paw_x-scuffX),avg=residueSole.reduce((s,m)=>s+m.strength,0)/residueSole.length;
  residueMarks.push({x:(paw_x+scuffX)/2,y:floor_y-1+(Math.random()-.5)*2,width:Math.min(84,26+span),h:14,strength:Math.min(1,.35+avg*.65),created:residueClock});
  if(residueMarks.length>24)residueMarks.shift();
  for(const m of residueSole)m.strength*=.88;
  residueSole=residueSole.filter(m=>m.strength>=.06);
  scuffX=paw_x;scuffAt=residueClock;
 }
};
