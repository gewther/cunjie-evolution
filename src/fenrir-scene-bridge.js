/* Runs in the legacy engine scope, just before its first animation frame. */
if (typeof window.__installFenrirScene === 'function' && fenrirCity) {
 const maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : Infinity;
 const fenrirScene = window.__installFenrirScene({
  spriteScaled: sprite_scaled,
  textures,
  w,
  h,
  maxTextureSize,
  newTexture(image) {
   if (!gl) return new_texture(image);
   const bound = gl.getParameter(gl.TEXTURE_BINDING_2D);
   try {
    const texture = new_texture(image);
    if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) {
     gl.deleteTexture(texture.gltex);
     throw new Error('Fenrir texture upload failed');
    }
    return texture;
   } finally {
    gl.bindTexture(gl.TEXTURE_2D, bound);
   }
  },
  deleteTexture(texture) {
   if (gl) gl.deleteTexture(texture.gltex);
  },
  getPawX: () => active ? paw_x : w / 2,
  getGroundPose() {
   if (!freeContact.grounded) return null;
   const geometry = xlSkinGeo();
   return {
    grounded: true,
    supported: !paw.steamroller && supports > 0,
    floorY: floor_y,
    width: paw.width,
    offset: paw.offset,
    frameHeight: paw.front_spr[4],
    texture: paw.front_spr[0],
    soleOffset: geometry.frontOffsets[3],
    contactCenter: geometry.frontContact[3][0],
    force: freeContact.force,
    age: freeContact.age,
    pressure: freeContact.pressure
   };
  }
 });
 sprite_scaled = fenrirScene.drawSprite;
 draw_front_paw = fenrirScene.wrapFrontFoot(draw_front_paw);

 const updateContact = freeContact.update;
 freeContact.update = function() {
  const event = updateContact.apply(this, arguments);
  fenrirScene.recordLanding(event);
  return event;
 };

 const drawFloor = window.xlDrawImpactFloorPass;
 window.xlDrawImpactFloorPass = function() {
  if (active && !pause && !tr) fenrirScene.drawRoadContact(xlFloorGfx, freeContact.clock);
  return drawFloor.apply(this, arguments);
 };

 const setImpactOffset = set_yoff;
 set_yoff = function(offset) {
  const reduced = window.__xlImmersionPrefs?.reduceMotion;
  setImpactOffset(reduced ? 0 : offset);
  if (reduced) {
   oc.style.transform = '';
   oc.style.transformOrigin = '';
  }
 };
}
