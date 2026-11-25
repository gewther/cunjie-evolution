/* First-act material pass. Ground marks draw at the native floor layer. */
const residueImage=new Image();let residueTexture=null,residueMarks=[],residueSole=[],residueClock=0;
residueImage.onload=()=>{residueTexture=new_texture(residueImage);residueTexture.smooth=true;};
residueImage.src='/assets/impact/floor-residue-v3.png';
const residueOldHit=realmAfterFx.hit,residueOldUpdate=realmAfterFx.update;
realmAfterFx.hit=function(b,prev,dead){
 const valid=realmIndex===0&&this.enabled&&active&&!pause&&!tr&&b.seen&&prev>b.health&&(dead||b.health<=0);
 const result=residueOldHit.apply(this,arguments);
 if(valid&&xlGfxPrefs.blood!=='off'){
  const x=Math.max(0,Math.min(w,b.x));
  const nearby=residueMarks.find(m=>Math.abs(m.x-x)<14&&residueClock-m.created<.28);
  if(nearby)nearby.width=Math.min(72,nearby.width+5);
  else {residueMarks.push({x,y:floor_y-2,width:30+Math.min(18,Math.abs(paw_y_velo)/40),created:residueClock});if(residueMarks.length>24)residueMarks.shift();}
  // Copy native F1/F2 attachment coordinates; do not keep a live NPC reference.
  if(stickers.length&&sticker_planes.length){
   const slot=get_sticker(x,Math.max(0,b.z||0));
   if(slot){const found=residueSole.find(m=>m.slot[1]===slot[1]&&m.slot[2]===slot[2]);
    if(found){found.created=residueClock;found.strength=Math.min(1,found.strength+.12);}
    else{residueSole.push({slot:slot.slice(0,5),created:residueClock,strength:.80});if(residueSole.length>10)residueSole.shift();}
   }
  }
 }
 return result;
};
realmAfterFx.update=function(dt,...args){residueOldUpdate.call(this,dt,...args);if(realmIndex===0){residueClock+=Math.max(0,Math.min(.05,dt));residueMarks=residueMarks.filter(m=>residueClock-m.created<28);residueSole=residueSole.filter(m=>residueClock-m.created<20);}};
const residueOldDraw=realmAfterFx.draw;
realmAfterFx.draw=function(ctx){
 if(realmIndex!==0||(typeof realmImpact!=='undefined'&&realmImpact.enabled()))return residueOldDraw.call(this,ctx);
 if(typeof window.evoDrawContactFx==='function')window.evoDrawContactFx(ctx);
};
const residueOldFloor=draw_stains;
draw_stains=function(){
 if(realmIndex!==0){residueOldFloor();if(typeof realmAfterFx!=='undefined'&&realmAfterFx.drawWebglFloor)realmAfterFx.drawWebglFloor();return;}
 if(xlGfxPrefs.blood==='off'){
  if(typeof realmAfterFx!=='undefined'&&realmAfterFx.drawWebglFloor)realmAfterFx.drawWebglFloor();
  if(typeof realmV57Ground!=='undefined'&&realmV57Ground.drawWebglFloor)realmV57Ground.drawWebglFloor(realmAfterFx);
  if(typeof window.v4DrawBodies==='function')window.v4DrawBodies();
  return;
 }
 impactOldStains();
 if(typeof realmAfterFx!=='undefined'&&realmAfterFx.drawWebglFloor)realmAfterFx.drawWebglFloor();
 if(typeof realmV57Ground!=='undefined'&&realmV57Ground.drawWebglFloor)realmV57Ground.drawWebglFloor(realmAfterFx);
 if(!realmAfterFx.enabled||!residueTexture){if(typeof window.v4DrawBodies==='function')window.v4DrawBodies();return;}
 set_texture(residueTexture);const oldAlpha=alpha,oldFlip=hflip;hflip=false;
 for(const m of residueMarks){const age=residueClock-m.created,fade=Math.min(1,Math.max(0,(28-age)/5)),mh=m.h||26;alpha=fade*(xlGfxPrefs.blood==='light'?.48:.88)*(m.strength??1);
  quad(m.x-m.width/2,m.y-mh/2,m.width,mh,0,0,512,512);
 }
 alpha=oldAlpha;hflip=oldFlip;
 if(typeof window.v4DrawBodies==='function')window.v4DrawBodies();
};
// Reuse the original game's foot-relative attachments and strands in act I.
const residueOldStickerDraw=draw_stickers,residueOldStrandDraw=draw_strands,residueOldBugDraw=draw_bug,residueOldDropletDraw=draw_droplets,residueOldFallerDraw=draw_fallers;
draw_stickers=function(){
 if(realmIndex!==0)return residueOldStickerDraw();
 if(!realmAfterFx.enabled||!realmAfterFx.soleResidueFx||xlGfxPrefs.blood==='off'||paw_state===3||(paw_state===0&&!paw.show_stickers_on_upper_state))return;
 if(residueTexture){const oldAlpha=alpha,oldFlip=hflip;hflip=false;set_texture(residueTexture);
  for(const m of residueSole){const p=get_sticker_pos(m.slot),fade=Math.min(1,(20-(residueClock-m.created))/5);
   alpha=fade*m.strength*(xlGfxPrefs.blood==='light'?.4:1);
   const width=paw_state===1?30:35,height=paw_state===1?28:22;
   quad(p.x-width/2,p.y-height/2,width,height,0,0,512,512);
  }
  alpha=oldAlpha;hflip=oldFlip;
 }
 return impactOldStickers();
};
draw_strands=function(){if(realmIndex===0){if(realmAfterFx.soleResidueFx&&xlGfxPrefs.blood!=='off')return impactOldStrands();return;}return residueOldStrandDraw();};
draw_droplets=function(...a){if(realmIndex===0){if(xlGfxPrefs.blood!=='off')return impactOldDroplets(...a);return;}return residueOldDropletDraw(...a);};
draw_fallers=function(...a){if(realmIndex===0){if(xlGfxPrefs.blood!=='off')return impactOldFallers(...a);return;}return residueOldFallerDraw(...a);};
draw_bug=function(b){if(realmIndex===0&&typeof window.v4HasBody==='function'&&window.v4HasBody(b))return;return realmIndex===0?impactOldBugDraw(b):residueOldBugDraw(b);};
if(typeof realmImpact!=='undefined'){
 const residueOldImpactTarget=realmImpact.target,residueOldImpactAccent=realmImpact.accent;
 realmImpact.target=function(dt,raw){
  if(typeof realmTouchOwns==='function'&&realmTouchOwns()){this.clock+=Math.max(0,Math.min(.08,dt||0));this.path=null;this.pressure=realmTouch.pressure;this.phase=paw_state===3?(this.pressure>.18?'compression':'landed'):'touch';return raw;}
  return residueOldImpactTarget.call(this,dt,raw);
 };
 realmImpact.accent=function(kind,volume,rate){
  if(typeof evoEnabled==='function'&&evoEnabled()&&(kind==='pressure'||kind==='release'))return;
  return residueOldImpactAccent.call(this,kind,volume,rate);
 };
}
const residueOldSetup=window.realmBridge.setup,residueOldSnapshot=window.realmBridge.snapshot;
window.realmBridge.setup=function(...args){residueMarks=[];residueSole=[];residueClock=0;return residueOldSetup.apply(this,args);};
window.realmBridge.snapshot=function(){const s=residueOldSnapshot.call(this);return realmIndex===0?{...s,materialV3:{marks:residueMarks.length,soleMarks:residueSole.length,ready:!!residueTexture,positions:residueMarks.slice(-4).map(m=>({x:m.x,y:m.y}))}}:s;};
