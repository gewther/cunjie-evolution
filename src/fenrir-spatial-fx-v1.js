/* P6.2-B: Fenrir's height-aware ground shadow, civilian shadowing and wet-road sheen.
 * Injected into the Fenrir iframe before the scene bridge and first animation frame.
 * No new textures, particles, network requests or gameplay/collision changes.
 */
if (typeof fenrirCity !== 'undefined' && fenrirCity) {
 (function installFenrirSpatialFx(global) {
  'use strict';
  if (global.__fenrirSpatialFxV1Installed) return;
  global.__fenrirSpatialFxV1Installed = true;

  const MAX_SHADED_TINIES = 28;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const state = global.__fenrirSpatialFxV1Status = {
   version: 'p6.2-b',
   active: false,
   heightRatio: 0,
   shadowX: 0,
   shadowWidth: 0,
   shadowOpacity: 0,
   reflectionOpacity: 0,
   shadedTinies: 0,
   reflections: 0
  };

  function currentShadow() {
   const scene = global.__fenrirCitySceneV1Status;
   if (!scene || !scene.ready || scene.failed) return null;
   if (typeof floor_y === 'undefined' || typeof paw_y === 'undefined' ||
       typeof paw_x === 'undefined' || typeof paw === 'undefined') return null;
   if (!Number.isFinite(Number(floor_y)) || !Number.isFinite(Number(paw_y)) ||
       !Number.isFinite(Number(paw_x)) || !Number.isFinite(Number(paw.width)) ||
       Number(paw.width) <= 0) return null;
   if (typeof hide_paws !== 'undefined' && hide_paws) return null;

   const prefs = global.__xlImmersionPrefs || {};
   const profile = global.__xlSceneLighting?.getSceneLightingProfile('fenrir');
   const lightDirection = Number(profile?.shadowDirection);
   // The profile direction points toward the light; the projection travels away from it.
   const castDirection = Number.isFinite(lightDirection) && lightDirection !== 0
    ? Math.sign(lightDirection) : -1;
   const width = Number(paw.width);
   const altitude = Math.max(0, Number(floor_y) - Number(paw_y));
   const heightRatio = prefs.reduceMotion ? 0 : clamp(altitude / Math.max(60, width * 1.1), 0, 1);
   const forceValue = typeof freeContact !== 'undefined' ? Number(freeContact.force) : NaN;
   const pressureValue = typeof freeContact !== 'undefined' ? Number(freeContact.pressure) : NaN;
   const force = clamp(Number.isFinite(forceValue) ? forceValue :
    Number.isFinite(pressureValue) ? pressureValue : 0.38, 0, 1);

   const shadowX = Number(paw_x) + castDirection * heightRatio * width * 0.38;
   const shadowWidth = width * (0.50 + heightRatio * 0.66);
   const shadowHeight = Math.max(2.4, width * (0.030 + heightRatio * 0.018));
   const shadowOpacity = prefs.reduceMotion ? 0.16 :
    clamp(0.23 + force * 0.085 - heightRatio * 0.075, 0.12, 0.32);
   const reflectionOpacity = prefs.reduceMotion ? 0 :
    clamp((prefs.lowEffects ? 0.035 : 0.075 + force * 0.025) * (1 - heightRatio * 0.68), 0, 0.12);

   return {
    x: shadowX, width: shadowWidth, height: shadowHeight,
    opacity: shadowOpacity, reflection: reflectionOpacity,
    direction: castDirection, heightRatio
   };
  }

  function drawGroundShadow() {
   state.shadedTinies = 0;
   state.reflections = 0;
   state.active = false;
   const prefs = global.__xlImmersionPrefs || {};
   if ((typeof active !== 'undefined' && !active) ||
       (typeof pause !== 'undefined' && pause) ||
       (typeof tr !== 'undefined' && tr)) return;

   const floorFx = typeof xlFloorGfx !== 'undefined' ? xlFloorGfx : null;
   if (!floorFx || typeof floorFx.ready !== 'function' || !floorFx.ready()) return;
   const shadow = currentShadow();
   if (!shadow) return;

   state.active = true;
   state.heightRatio = shadow.heightRatio;
   state.shadowX = shadow.x;
   state.shadowWidth = shadow.width;
   state.shadowOpacity = shadow.opacity;
   state.reflectionOpacity = shadow.reflection;

   // Soft contact shadow grows and shifts opposite the blue-hour key light as the foot rises.
   if (typeof floorFx.drawContactPress === 'function') {
    floorFx.drawContactPress(shadow.x, Number(floor_y) + 1, shadow.width, shadow.opacity, 0);
   }

   // The wet road catches two narrow specular bands. These reuse the existing floor pass,
   // so the reflection stays world-locked and does not create another full-screen canvas.
   if (shadow.reflection > 0 && typeof floorFx.drawOval === 'function') {
    floorFx.drawOval(false, shadow.x, Number(floor_y) + 1.5,
     shadow.width * 0.76, shadow.height, shadow.reflection);
    state.reflections++;
    if (!prefs.lowEffects && !prefs.reduceMotion) {
     floorFx.drawOval(false,
      shadow.x - shadow.direction * shadow.width * 0.20,
      Number(floor_y) + 2,
      shadow.width * 0.34, shadow.height * 0.46,
      shadow.reflection * 0.58);
     state.reflections++;
    }
   }
   if (shadow.reflection > 0.045 && typeof floorFx.drawImpactRing === 'function') {
    floorFx.drawImpactRing(shadow.x, Number(floor_y) + 1,
     shadow.width * 0.62, Math.max(1.4, shadow.height * 0.35),
     shadow.reflection * 0.32);
    state.reflections++;
   }
  }

  function shadeCivilian(b) {
   if (!state.active || state.shadedTinies >= MAX_SHADED_TINIES || !b ||
       typeof occ === 'undefined' || !occ || typeof occ.ellipse !== 'function') return;
   const x = Number(b.x), y = Number(b.y), z = Number(b.z) || 0;
   if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs((y - z) - Number(floor_y)) > 25) return;

   const horizontal = clamp(1 - Math.abs(x - state.shadowX) / Math.max(1, state.shadowWidth * 1.08), 0, 1);
   const vertical = clamp(1 - Math.abs((y - z) - Number(floor_y)) / 25, 0, 1);
   const intensity = horizontal * vertical * state.shadowOpacity;
   if (intensity < 0.025) return;

   const sx = typeof quality !== 'undefined' && quality.displayScaleX ? quality.displayScaleX : (typeof sc === 'number' ? sc : 1);
   const sy = typeof quality !== 'undefined' && quality.displayScaleY ? quality.displayScaleY : (typeof sc === 'number' ? sc : 1);
   occ.save();
   occ.setTransform(sx, 0, 0, sy, 0, 0);
   occ.globalCompositeOperation = 'source-over';
   occ.globalAlpha = clamp(intensity * 0.62, 0, 0.16);
   occ.fillStyle = '#061827';
   occ.beginPath();
   occ.ellipse(x, y - z - 14, 5.4, 12.5, 0, 0, Math.PI * 2);
   occ.fill();
   occ.restore();
   state.shadedTinies++;
  }

  const originalFloorPass = global.xlDrawImpactFloorPass;
  if (typeof originalFloorPass === 'function') {
   global.xlDrawImpactFloorPass = function(...args) {
    drawGroundShadow();
    return originalFloorPass.apply(this, args);
   };
  }

  const originalDrawBug = typeof draw_bug === 'function' ? draw_bug : null;
  if (originalDrawBug) {
   draw_bug = function(b) {
    const result = originalDrawBug.apply(this, arguments);
    shadeCivilian(b);
    return result;
   };
  }

  global.__fenrirSpatialFxV1 = {
   snapshot: () => ({...state}),
   shadow: currentShadow
  };
 })(window);
}
