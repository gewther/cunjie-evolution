/* Runs after the story/free mode draw wrappers, inside the legacy engine scope. */
(function installSceneLighting() {
 const sunset = {ambient: [1,.91,.80], topShadow: .07, bounce: [.08,.09,.05], side: [.055,.035,0], shadowDirection: 1};
 const night = {ambient: [.77,.84,.93], topShadow: .10, bounce: [.025,.055,.07], side: [0,.02,.035], shadowDirection: -1};
 const bedside = {ambient: [.77,.85,.95], topShadow: .10, bounce: [.08,.065,.035], side: [.19,.09,0], shadowDirection: 1};
 const rain = {ambient: [.76,.86,.95], topShadow: .09, bounce: [.025,.08,.10], side: [0,.02,.03], shadowDirection: -1};
 const fenrir = {ambient: [.80,.88,.95], topShadow: .09, bounce: [.035,.075,.095], side: [0,.025,.035], shadowDirection: -1};
 const indoor = {ambient: [.97,.91,.84], topShadow: .06, bounce: [.035,.055,.045], side: [.04,.02,0], shadowDirection: 1};
 const profiles = new Map([
  ['rooftop-day', sunset], ['rooftop-night', night], ['bedside-night', bedside],
  ['rain', rain], ['bedroom-wood', rain], ['fenrir', fenrir],
 ]);
 const corners = new Float32Array(12);
 const clamp01 = n => Math.max(0, Math.min(1, n));
 let profile = null;
 let foot = null;
 let isBackFoot = false;
 let lowEffects = false;
 let lightCanvas;
 let roomPicker;

 function getSceneLightingProfile(sceneId) {
  return profiles.get(sceneId) ?? indoor;
 }

 function currentScene() {
  if (typeof fenrirCity !== 'undefined' && fenrirCity) return 'fenrir';
  if (typeof realmIndex === 'number') {
   if (realmIndex === 2) return 'bedside-night';
   if (realmIndex === 1) return 'indoor';
   if (typeof roomKey !== 'undefined') return roomKey;
  }
  if (window.__cunjieRoomTheme) return window.__cunjieRoomTheme;
  try {
   roomPicker ??= window.parent.document.getElementById('roomTheme');
   return roomPicker?.value || window.parent.localStorage.getItem('cunjie-room-theme') || 'rooftop-day';
  } catch {
   return 'rooftop-day';
  }
 }

 function withFootLighting(drawFoot, back) {
  return function () {
   if (typeof custom !== 'undefined' && custom) return drawFoot.apply(this, arguments);
   const scene = currentScene();
   if (typeof customMotionSource !== 'undefined' && customMotionSource && scene !== 'fenrir') {
    return drawFoot.apply(this, arguments);
   }
   profile = getSceneLightingProfile(scene);
   foot = back ? paw.back_spr : paw.front_spr;
   isBackFoot = back;
   lowEffects = !!(window.__xlImmersionPrefs?.lowEffects ||
    (typeof realmMood !== 'undefined' && realmMood.lowEffects));
   try {
    return drawFoot.apply(this, arguments);
   } finally {
    foot = null;
   }
  };
 }

 function atlasFrame(sprite, sx, sy, sw, sh) {
  if (sprite[0] !== foot[0] || sw !== foot[3] || sh !== foot[4]) return -1;
  const col = (sx - foot[1] - uxoff) / sw;
  const row = (sy - foot[2] - uyoff) / sh;
  if (col < 0 || row < 0 || !Number.isInteger(col) || !Number.isInteger(row)) return -1;
  const across = foot[5] ? col : row;
  const along = foot[5] ? row : col;
  const frame = across * (foot[6] || 1) + along;
  if (foot[6] ? along >= foot[6] : across !== 0) return -1;
  return frame < (isBackFoot ? 5 : 6) ? frame : -1;
 }

 function gains(sprite, y, height, sx, sy, sw, sh) {
  if (!foot || !sprite || height <= 0) return null;
  const key = sprite[0];
  const frame = atlasFrame(sprite, sx, sy, sw, sh);
  const hd = typeof key === 'string' && (key.startsWith('xl-art-hd-') || key.startsWith('realm-aj6-frame-')) && textures.get(key);
  if (frame < 0 && !hd) return null;

  // HD Act III may draw the same frame in slices. Reconstruct its full bounds
  // so ground light is shared by the upper armor and the individual toes.
  const footHeight = hd ? height * hd.h / sh : height;
  const solePadding = frame >= 0 && typeof xlSkinGeo === 'function'
   ? (isBackFoot ? xlSkinGeo().backOffsets : xlSkinGeo().frontOffsets)[frame] || 0 : 0;
  const bottom = hd ? y + height * (hd.h - sy) / sh : y + height;
  const sole = bottom - solePadding * height / sh;
  const groundY = !isBackFoot ? floor_y : profile === fenrir
   ? floor_y - floor_depth - 6 : h * paw.back_paw_y;
  const contact = clamp01(1 - Math.max(0, groundY - sole) / Math.max(1, footHeight * .7));

  for (let i = 0; i < 4; i++) {
   const upper = clamp01((bottom - (i < 2 ? y : y + height)) / footHeight);
   const bounce = contact * (1 - upper) ** 2;
   const right = i % 2 === 1;
   const x = hd ? (sx + ((right !== hflip) ? sw : 0)) / hd.w : Number(right);
   const screenX = hd && hflip ? 1 - x : x;
   const side = lowEffects ? 0 : profile.shadowDirection > 0 ? 1 - screenX : screenX;
   for (let c = 0; c < 3; c++) {
    corners[i * 3 + c] = clamp01(profile.ambient[c] - profile.topShadow * upper +
     profile.bounce[c] * bounce + profile.side[c] * side);
   }
  }
  return corners;
 }

 function color(light, corner) {
  const i = corner * 3;
  return `rgb(${Math.round(light[i] * 255)},${Math.round(light[i + 1] * 255)},${Math.round(light[i + 2] * 255)})`;
 }

 function paintLitSprite(ctx, bitmap, sx, sy, sw, sh, x, y, width, height, light, flipped) {
  if (!lightCanvas) lightCanvas = document.createElement('canvas');
  const scale = Math.min(1, (lowEffects ? 384 : 768) / Math.max(sw, sh));
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  if (lightCanvas.width < tw) lightCanvas.width = tw;
  if (lightCanvas.height < th) lightCanvas.height = th;
  const lighting = lightCanvas.getContext('2d');
  if (!lighting) return false;

  const left = flipped ? 1 : 0;
  const right = 1 - left;
  lighting.clearRect(0, 0, tw, th);
  const vertical = lighting.createLinearGradient(0, 0, 0, th);
  vertical.addColorStop(0, color(light, left));
  vertical.addColorStop(1, color(light, left + 2));
  lighting.fillStyle = vertical;
  lighting.fillRect(0, 0, tw, th);

  if (!lowEffects) {
   lighting.globalCompositeOperation = 'destination-out';
   const horizontal = lighting.createLinearGradient(0, 0, tw, 0);
   horizontal.addColorStop(0, 'transparent');
   horizontal.addColorStop(1, '#000');
   lighting.fillStyle = horizontal;
   lighting.fillRect(0, 0, tw, th);
   lighting.globalCompositeOperation = 'destination-over';
   const backing = lighting.createLinearGradient(0, 0, 0, th);
   backing.addColorStop(0, color(light, right));
   backing.addColorStop(1, color(light, right + 2));
   lighting.fillStyle = backing;
   lighting.fillRect(0, 0, tw, th);
  }

  lighting.globalCompositeOperation = 'multiply';
  lighting.drawImage(bitmap, sx, sy, sw, sh, 0, 0, tw, th);
  lighting.globalCompositeOperation = 'destination-in';
  lighting.drawImage(bitmap, sx, sy, sw, sh, 0, 0, tw, th);
  lighting.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightCanvas, 0, 0, tw, th, x, y, width, height);
  return true;
 }

 draw_front_paw = withFootLighting(draw_front_paw, false);
 draw_back_paw = withFootLighting(draw_back_paw, true);
 window.__xlSceneLighting = {getSceneLightingProfile, gains, paintLitSprite};
})();
