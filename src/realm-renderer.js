/* Shared sprite renderer for the story and free-mode legacy runtimes. */
function installRealmRenderer(){
if(!gl){
 const ctx=c.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
 const textures=new Map();let current=null;
 function new_texture(bitmap){const w=bitmap.width||bitmap.naturalWidth||1,h=bitmap.height||bitmap.naturalHeight||1;return {bitmap,size:w,w,h,smooth:false};}
 function new_raw_tex(w,h,rgbaPremul,rgbaStraight){
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const c2=cv.getContext('2d');const id=c2.createImageData(w,h);id.data.set(rgbaStraight);c2.putImageData(id,0,0);
  return {bitmap:cv,size:w,w,h,smooth:true};
 }
 function set_texture(t){current=t;}
 function clear(r,g,b,a){ctx.globalAlpha=1;ctx.fillStyle=`rgba(${r},${g},${b},${a/255})`;ctx.fillRect(0,0,c.width,c.height);}
 function render(){renders++;}
 function quad(x,y,ww,hh,ux,uy,uw,uh,sprite){
  if(!current||!ww||!hh)return;
  uw=uw||ww;uh=uh||hh;
  const sm=!!(current.smooth||quality.smooth);
  if(!sm){x=floor(x);y=floor(y);}
  ctx.save();ctx.setTransform(c.width/w,0,0,c.height/h,0,0);ctx.imageSmoothingEnabled=sm;ctx.globalAlpha=clamp(alpha,0,1);
  if(hflip){ctx.translate(x+ww,y);ctx.scale(-1,1);x=0;y=0;}
  const lighting = window.__xlSceneLighting;
  const gain = sprite && lighting?.gains(sprite, y, hh, ux, uy, uw, uh);
  if (!gain || !lighting.paintLitSprite(ctx, current.bitmap, ux, uy, uw, uh, x, y, ww, hh, gain, hflip)) {
   ctx.drawImage(current.bitmap, ux, uy, uw, uh, x, y, ww, hh);
  }

  ctx.restore();
 }
 return {textures,new_texture,new_raw_tex,set_texture,clear,render,quad};
}
function shader(n, k, sc) {
	const s = gl.createShader(k);
	gl.shaderSource(s, sc);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
		const err = n + " shader error: " + gl.getShaderInfoLog(s);
		gl.deleteShader(s);
		throw new Error(err);
	}
	return s;
}

const a_pos = 0, a_uv = 1, a_alpha = 2, a_light = 3;
function makeSpriteProgram(lit) {
	const vertShader = shader("vertex", gl.VERTEX_SHADER, `
		attribute vec2 a_pos, a_uv;
		attribute float a_alpha;
		${lit ? "attribute vec3 a_light;" : ""}
		varying vec2 v_uv;
		varying float v_alpha;
		${lit ? "varying vec3 v_light;" : ""}
		uniform vec2 u_screen_size;
		uniform vec2 u_texture_size;
		uniform float u_smooth;
		void main() {
			v_uv = (u_smooth > 0.5 ? a_uv : floor(a_uv))/u_texture_size;
			v_alpha = a_alpha;
			${lit ? "v_light = a_light;" : ""}
			vec2 position = u_smooth > 0.5 ? a_pos : floor(a_pos);
			gl_Position = vec4(vec2(-1.0,1.0)+(position*u_screen_size),0.0,1.0);
		}
	`);

	const fragShader = shader("fragment", gl.FRAGMENT_SHADER, `
		precision mediump float;
		varying vec2 v_uv;
		varying float v_alpha;
		${lit ? "varying vec3 v_light;" : ""}
		uniform sampler2D u_texture;
		void main() {
			gl_FragColor = texture2D(u_texture,v_uv)${lit ? "*vec4(v_light,1.0)" : ""}*v_alpha;
		}
	`);

	const program = gl.createProgram();
	gl.attachShader(program, vertShader);
	gl.attachShader(program, fragShader);
	gl.bindAttribLocation(program, a_pos, "a_pos");
	gl.bindAttribLocation(program, a_uv, "a_uv");
	gl.bindAttribLocation(program, a_alpha, "a_alpha");
	if (lit) gl.bindAttribLocation(program, a_light, "a_light");
	gl.linkProgram(program);
	gl.deleteShader(vertShader);
	gl.deleteShader(fragShader);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error("shader link error: " + gl.getProgramInfoLog(program));
	}
	return {
		program,
		screenSize: gl.getUniformLocation(program, "u_screen_size"),
		textureSize: gl.getUniformLocation(program, "u_texture_size"),
		smooth: gl.getUniformLocation(program, "u_smooth"),
		sampler: gl.getUniformLocation(program, "u_texture")
	};
}

// Keep large terrain and background quads on the original shader.
const plainProgram = makeSpriteProgram(false);
const litProgram = makeSpriteProgram(true);
let spriteProgram = plainProgram;
gl.useProgram(spriteProgram.program);

const quads_per_draw = 16000;

const ibufstride = 2;
const ibuflen = quads_per_draw*6;
const ibuf = new ArrayBuffer(ibuflen*ibufstride);
const ibufv = new Uint16Array(ibuf);
const ibufid = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibufid);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ibuflen*ibufstride, gl.DYNAMIC_DRAW);

const vbufstride = 6*4;
const vbuflen = quads_per_draw*4;
const vbuf = new ArrayBuffer(vbuflen*vbufstride);
const vbufv = new Float32Array(vbuf);
const vbufBytes = new Uint8Array(vbuf);
const vbufid = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbufid);
gl.bufferData(gl.ARRAY_BUFFER, vbuflen*vbufstride, gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(a_pos);
gl.enableVertexAttribArray(a_uv);
gl.enableVertexAttribArray(a_alpha);
gl.vertexAttribPointer(a_pos,   2, gl.FLOAT, false, vbufstride, 0);
gl.vertexAttribPointer(a_uv,    2, gl.FLOAT, false, vbufstride, 8);
gl.vertexAttribPointer(a_alpha, 1, gl.FLOAT, false, vbufstride, 16);
gl.vertexAttribPointer(a_light, 3, gl.UNSIGNED_BYTE, true, vbufstride, 20);

gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

const textures = new Map();
function new_texture(bitmap) {
	const gltex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, gltex);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
	const bw = bitmap.width || bitmap.naturalWidth || 1, bh = bitmap.height || bitmap.naturalHeight || 1;
	return { size: bw, w: bw, h: bh, gltex: gltex, smooth: false };
}
function new_raw_tex(tw, th, rgbaPremul, rgbaStraight) {
	const gltex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, gltex);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgbaPremul);
	return { size: tw, w: tw, h: th, gltex: gltex, smooth: true };
}

var texture = null, textureSmooth = false;
function set_texture(to) {
	const wantSmooth = !!(to.smooth || quality.smooth);
	if (texture == to && textureSmooth === wantSmooth)
		return;
	render();
	texture = to;
	textureSmooth = wantSmooth;
	gl.bindTexture(gl.TEXTURE_2D, to.gltex);
	const flt = wantSmooth ? gl.LINEAR : gl.NEAREST;
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

var inds = 0, verts = 0, vertidx = 0;
function clear(r, g, b, a) {
	gl.clearColor(r/255, g/255, b/255, a/255);
	gl.clear(gl.COLOR_BUFFER_BIT);
}


function render() {
	if (inds == 0)
		return;
	gl.uniform1i(spriteProgram.sampler, 0);
	gl.uniform2f(spriteProgram.screenSize, 2/w, -2/h);
	gl.uniform2f(spriteProgram.textureSize, texture.w || texture.size || 1, texture.h || texture.size || 1);
	gl.uniform1f(spriteProgram.smooth, textureSmooth ? 1 : 0);
	gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(vbuf, 0, vertidx));
	gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(ibuf, 0, inds));
	gl.drawElements(gl.TRIANGLES, inds, gl.UNSIGNED_SHORT, 0);
	inds = 0, verts = 0, vertidx = 0;
	renders++;
}


function vert(x, y, ux, uy, light, offset) {
	vbufv[vertidx++] = x,  vbufv[vertidx++] = y;
	vbufv[vertidx++] = ux, vbufv[vertidx++] = uy;
	vbufv[vertidx++] = alpha;
	const color = vertidx++ * 4;
	if (light) {
		vbufBytes[color] = Math.round(light[offset]*255);
		vbufBytes[color+1] = Math.round(light[offset+1]*255);
		vbufBytes[color+2] = Math.round(light[offset+2]*255);
	}
	verts++;
}


function quad(x, y, w, h, ux, uy, uw, uh, sprite) {
	const light = sprite && window.__xlSceneLighting?.gains(sprite, y, h, ux, uy, uw || w, uh || h);
	const nextProgram = light ? litProgram : plainProgram;
	if (nextProgram !== spriteProgram) {
		render();
		spriteProgram = nextProgram;
		gl.useProgram(spriteProgram.program);
		if (light) gl.enableVertexAttribArray(a_light);
		else gl.disableVertexAttribArray(a_light);
	}
	x = floor(x), y = floor(y), uw = uw || w, uh = uh || h;
	if(inds+6 >= ibuflen || verts+4 >= vbuflen)
		render();

	ibufv[inds++] = verts,   ibufv[inds++] = verts+1, ibufv[inds++] = verts+2;
	ibufv[inds++] = verts+2, ibufv[inds++] = verts+3, ibufv[inds++] = verts;
	if (hflip) {
		vert(x,   y,   ux+uw, uy, light, 0);
		vert(x+w, y,   ux,    uy, light, 3);
		vert(x+w, y+h, ux,    uy+uh, light, 9);
		vert(x,   y+h, ux+uw, uy+uh, light, 6);
		return;
	}
	vert(x,   y,   ux,    uy, light, 0);
	vert(x+w, y,   ux+uw, uy, light, 3);
	vert(x+w, y+h, ux+uw, uy+uh, light, 9);
	vert(x,   y+h, ux,    uy+uh, light, 6);
}


return {textures,new_texture,new_raw_tex,set_texture,clear,render,quad};
}
const {textures,new_texture,new_raw_tex,set_texture,clear,render,quad}=installRealmRenderer();
var uxoff = 0, uyoff = 0;
function sprite(s, x, y, f, cx, cy) {
	const t = textures.get(s[0]);
	if (!t) throw new Error(`missing texture ${t}`);
	set_texture(t);
	const uw = s[3], uh = s[4];
	var fx = 0, fy = 0, sp;
	if (f && (f = floor(f)))
		(sp = s[6]) ? (s[5] ? (fy = f % sp, fx = floor(f / sp)) : (fx = f % sp, fy = floor(f / sp)))
		            : (s[5] ?  fy = f : fx = f);
	quad(x-(cx||0)*uw, y-(cy||0)*uh, uw, uh, s[1]+uxoff+fx*uw, s[2]+uyoff+fy*uh, s);
}

function sprite_scaled(s, x, y, w, h) {
	const t = textures.get(s[0]);
	if (!t) throw new Error(`missing texture ${t}`);
	set_texture(t);
	quad(x, y, w, h, s[1], s[2], s[3], s[4], s);
}
