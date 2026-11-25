(function(g){
class RealmRenderer{
 constructor(canvas,images){this.canvas=canvas;this.c=canvas.getContext('2d');this.im=images;}
 resize(){let r=this.canvas.getBoundingClientRect(),d=Math.min(g.devicePixelRatio||1,1.75);this.width=r.width;this.height=r.height;this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);this.c.setTransform(d,0,0,d,0,0);}
 base(){let c=this.c;c.save();c.scale(this.width/1000,this.height/600);c.clearRect(0,0,1000,600);return c;}
 tiny(c,n,x,y,scale=1){c.save();c.translate(x,y);if(n.dir<0)c.scale(-1,1);c.imageSmoothingEnabled=false;if(this.im.tinies){const col=(Math.floor(n.x/19)%4+4)%4,row=1;const ww=18*scale,hh=27*scale;c.drawImage(this.im.tinies,col*48,row*64,48,64,-ww/2,-hh,ww,hh);}else c.drawImage(this.im.background,0,272+(Math.floor(n.x/4)%12)*32,32,32,-4*scale,-8*scale,8*scale,8*scale);c.restore();}
 floorPreview(index){let c=this.base();c.imageSmoothingEnabled=false;if(index===2&&(this.im.bedside||this.im.stage3Normal))c.drawImage(this.im.bedside||this.im.stage3Normal,0,0,1000,600);else if(index===1&&this.im.stage2Normal)c.drawImage(this.im.stage2Normal,0,0,1000,600);else if(this.im.background)c.drawImage(this.im.background,160,0,432,224,0,0,1000,560);c.fillStyle=index===2?'#35414b88':(index===1?'#1e293833':'#735d3a22');c.fillRect(0,0,1000,600);if(index===2&&!(this.im.bedside||this.im.stage3Normal)){c.fillStyle='#655d6a';c.fillRect(560,510,440,90);c.strokeStyle='#a697a333';for(let x=565;x<1000;x+=8){c.beginPath();c.moveTo(x,510);c.lineTo(x+10,600);c.stroke();}c.fillStyle='#293137';c.fillRect(0,290,85,250);}else if(index===0){c.fillStyle='#393e40';c.fillRect(63,485,50,85);c.fillRect(860,485,55,85);}
 let im=index===2?this.im.paws:(index===1?(this.im.socks||this.im.sneakers):this.im.sneakers);if(im){c.drawImage(im,160,0,160,256,290,index===2?-30:-65,400,640);c.drawImage(im,320,0,160,256,710,index===2?87:58,310,496);}for(let i=0;i<30;i++){let n={dir:i%2?1:-1,x:i*39};this.tiny(c,n,25+i*32,568-(i%3)*6,1.2);}c.restore();}
 cutscene(index,t,roster=[]){const c=this.base(),q=Math.max(0,Math.min(1,t/8)),fade=Math.max(0,Math.min(1,(t-2.4)/3)),startKey=index===0?'stage1':'stage2',endKey=index===0?'stage2':'stage3';
 const a=this.im[startKey+'Normal']||this.im.bedside||this.im.stage1Normal,b=this.im[endKey+'Normal']||this.im.bedside||this.im.stage1Normal;
 const drift=(x,k)=>{if(x)c.drawImage(x,Math.round(k*45),0,x.width-Math.round(k*45),x.height,0,0,1000,600);};
 drift(a,q*.27);c.globalAlpha=fade;drift(b,Math.max(0,1-q)*.17);c.globalAlpha=1;
 // Shoes and socks are supplied by the original 3.3 atlas, without identity replacements.
 if(index===0){
  const out=Math.max(0,1-t/4.6),incoming=Math.max(0,Math.min(1,(t-3)/2.3));
  c.globalAlpha=out;if(this.im.sneakers)c.drawImage(this.im.sneakers,160,0,160,256,328,-80-Math.min(1,t/3)*320,310,495);c.globalAlpha=incoming;
  if(this.im.socks)c.drawImage(this.im.socks,0,0,160,256,350,-200+Math.max(0,t-3)*72,340,535);c.globalAlpha=1;
 }else{
  const out=Math.max(0,1-t/4.6),incoming=Math.max(0,Math.min(1,(t-3)/2.3));
  c.globalAlpha=out;if(this.im.socks)c.drawImage(this.im.socks,160,0,160,256,320,-110-Math.min(1,t/3)*250,340,535);c.globalAlpha=incoming;
  if(this.im.paws)c.drawImage(this.im.paws,0,0,160,256,338,-220+Math.max(0,t-3)*73,400,640);c.globalAlpha=1;
 }
 if(roster.length){const count=Math.min(18,roster.length);for(let k=0;k<count;k++){let x=80+k*45+(index===0?10:28)*q,y=545-(k%3)*7;this.tiny(c,{dir:k%2?1:-1,x:k*8},x,y,(index===0?1:.82)*(1-q*.20));}}
 c.restore();}

}
g.RealmRenderer=RealmRenderer;
})(globalThis);

(function(g){'use strict';
class CinematicRenderer{
 constructor(legacy,loader){this.legacy=legacy;this.loader=loader;}
 render(frame,{reducedMotion=false,lowEffects=false}={}){
  const c=this.legacy.c,cv=this.legacy.canvas;const bw=cv.width,bh=cv.height;const fit=Math.min(bw/1000,bh/600);c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#070e15';c.fillRect(0,0,bw,bh);c.translate((bw-1000*fit)/2,(bh-600*fit)/2);c.scale(fit,fit);c.imageSmoothingEnabled=true;c.fillStyle='#121922';c.fillRect(0,0,1000,600);
  if(!frame){c.restore();return;}
  const draw=(layers,opacity)=>{for(const layer of layers){let im=this.loader.get(layer.asset);if(!im)continue;
   const [x,y,w,h]=layer.rect;c.save();c.globalAlpha=Math.max(0,Math.min(1,layer.alpha*opacity*frame.fadeOut));
   c.translate(x+w/2,y+h/2);if(!reducedMotion)c.rotate(layer.angle*Math.PI/180);
   if(layer.id.includes('shadow')){c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=lowEffects?0:26;}
   if(layer.peel!==null&&layer.peel!==undefined){
    const peel=Math.max(0,Math.min(1,layer.peel)),gather=Math.max(0,Math.min(1,layer.gather||0));
    const visible=Math.max(.003,1-peel), sw=Math.max(1,Math.floor(im.width*visible)), N=24;
    const dx=w*visible/N, sx=sw/N, top=-h/2, left=-w/2;
    // Wavy narrow bands preserve original sock color/print while forming compressive folds.
    c.beginPath();c.rect(left-1,top-8,w*visible+4,h+16);c.clip();
    for(let j=0;j<N;j++){
     const u=j/N, micro=Math.sin(u*Math.PI*4+peel*2.2)*gather*h*.006;
     const compression=gather*h*.018*Math.sin(u*Math.PI);
     c.drawImage(im,j*sx,0,sx+1,im.height,left+j*dx,top+micro+compression,dx+1.5,h-compression*.35);
    }
    // Curled hem follows the boundary as the sock slips away, instead of a hard vertical crop.
    if(peel>.025&&peel<.98){
     const edgeX=left+w*visible, hemY=top+h*.61;
     c.globalAlpha*=.42*gather;
     c.strokeStyle='#d9dadb';c.lineWidth=Math.max(2,Math.min(12,w*.015));
     c.beginPath();c.moveTo(edgeX-4,hemY-h*.10);c.bezierCurveTo(edgeX+w*.023,hemY-h*.05,edgeX+w*.022,hemY+h*.07,edgeX-6,hemY+h*.10);c.stroke();
     c.strokeStyle='#447a82';c.lineWidth=Math.max(1.5,Math.min(7,w*.007));c.stroke();
    }
   }else c.drawImage(im,-w/2,-h/2,w,h);c.restore();
  }};
  if(frame.previousLayers)draw(frame.previousLayers,1-frame.transition);
  draw(frame.layers,frame.transition);
  if(!lowEffects&&!reducedMotion){const v=c.createRadialGradient(500,270,200,500,280,680);v.addColorStop(0,'rgba(10,15,24,0)');v.addColorStop(1,'rgba(3,7,12,.35)');c.fillStyle=v;c.fillRect(0,0,1000,600);}
  c.restore();
 }
}
g.CinematicRenderer=CinematicRenderer;
if(typeof module!=='undefined')module.exports=CinematicRenderer;
})(globalThis);
