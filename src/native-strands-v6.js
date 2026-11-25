/* Native strip texture renderer retained; adapt attachment to absolute touch. */
const nativeStrandUpdate=update_strands,nativeAddStrand=add_strand;
add_strand=function(x,z,fit){const n=strands.length;nativeAddStrand(x,z,fit);if(realmIndex!==0||strands.length===n)return;
 const s=strands[strands.length-1],p=get_sticker_pos(s.s);s.top_x=p.x;s.top_y=floor_y-s.z;s.liftAge=0;
 if(strands.length>48)strands.splice(0,strands.length-48);
};
update_strands=function(){
 if(realmIndex!==0)return nativeStrandUpdate();
 attached_strands=0;
 for(const s of strands){
  const fit=s.fit,sp=get_sticker_pos(s.s),bottom=floor_y-s.z;
  if(s.attach){
   if(paw_state===3){s.top_x=sp.x;s.top_y=bottom;s.liftAge=0;attached_strands++;continue;}
   s.liftAge=(s.liftAge||0)+Math.min(.05,delta);
   const length=Math.max(0,bottom-sp.y),side=Math.abs(sp.x-s.x),limit=Math.max(88,h*.46);
   // Preserve native strand_damp lift drag and stretch before snapping at full lift or sideways tear.
   s.top_x=s.x+Math.max(-limit,Math.min(limit,sp.x-s.x));
   s.top_y=bottom-Math.min(limit,length);
   const wetTear=paw_state<=1&&randevent(r=>r<0.012+paw.wetness);
   if(paw_state===0||length>limit||side>Math.max(fit.strand_hold,46)||wetTear||s.liftAge>2.4){s.attach=false;s.frame=fit.strand_init_frames;}
   else attached_strands++;
  }else{
   s.frame=Math.max(fit.strand_init_frames,s.frame+delta*fit.strand_fall_fr);
   s.top_y=Math.min(floor_y-floor_depth,s.top_y+delta*fit.strand_fall_speed);
  }
 }
 for(let i=strands.length-1;i>=0;i--)if(strands[i].frame>=strands[i].fit.strand_frames)strands.splice(i,1);
};
