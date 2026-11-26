/* Fenrir city background, grounded foot rendering, and wet-road contact effects. */
(function installFenrirCityScene(global) {
 'use strict';
 if (global.__installFenrirScene) return;

 const WORLD_WIDTH = 2400;
 const WORLD_HEIGHT = 240;
 const LAYERS = [
  {key: 'fenrirCityFarV1', url: 'assets/fenrir/city-far.svg', parallax: 0.12},
  {key: 'fenrirCityMidV1', url: 'assets/fenrir/city-mid.svg', parallax: 0.36},
  {key: 'fenrirCityNearV1', url: 'assets/fenrir/city-near.svg', parallax: 1}
 ];
 const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

 global.__installFenrirScene = function(context) {
  const {spriteScaled, textures, newTexture, deleteTexture, maxTextureSize} = context;
  const viewW = Math.min(context.w, WORLD_WIDTH);
  const viewH = Math.min(context.h, WORLD_HEIGHT);
  const maxScroll = WORLD_WIDTH - viewW;
  const center = maxScroll / 2;
  const deadZone = viewW * 0.16;
  const edgeSpan = viewW / 2 - deadZone;
  const status = {
   ready: false, failed: false, worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT,
   viewWidth: viewW, maxScroll, deadZone, cameraX: center, targetX: center,
   pawX: viewW / 2, pawVelocity: 0, lastFootContact: null, lastRoadMark: null
  };
  global.__fenrirCitySceneV1Status = status;

  let anchor = center;
  let lastTime = null;
  let lastPawX = null;
  let pawVelocity = 0;
  let frontFootPose = null;
  let pendingLanding = null;
  const roadMarks = [];

  function loadLayer(layer) {
   return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
     try {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width !== WORLD_WIDTH || height !== WORLD_HEIGHT || Math.max(width, height) > maxTextureSize) {
       throw new Error('Unsupported Fenrir layer dimensions: ' + layer.url);
      }
      const texture = newTexture(image);
      texture.smooth = true;
      resolve(texture);
     } catch (error) {
      reject(error);
     }
    };
    image.onerror = () => reject(new Error('Unable to load ' + layer.url));
    const inlineLayers = global.__cunjieFenrirSceneLayers;
    image.src = new URL(inlineLayers?.[layer.url] || layer.url, document.baseURI).href;
   });
  }

  Promise.allSettled(LAYERS.map(loadLayer)).then(results => {
   const failure = results.find(result => result.status === 'rejected');
   if (failure) {
    for (const result of results) {
     if (result.status === 'fulfilled') deleteTexture(result.value);
    }
    status.failed = true;
    console.warn('[Fenrir scene] Using the original backdrop.', failure.reason);
    return;
   }
   LAYERS.forEach((layer, index) => textures.set(layer.key, results[index].value));
   status.ready = true;
  });

  function updateCamera() {
   const now = performance.now();
   const elapsed = lastTime === null ? 0 : (now - lastTime) / 1000;
   lastTime = now;
   const dt = clamp(elapsed, 0, 0.05);
   const pawX = clamp(context.getPawX(), 0, viewW);
   const offset = pawX - viewW / 2;
   const reduced = global.__xlImmersionPrefs?.reduceMotion;

   if (lastPawX === null || elapsed > 0.15 || reduced) {
    pawVelocity = 0;
   } else if (dt > 0) {
    const speed = clamp((pawX - lastPawX) / dt, -2400, 2400);
    pawVelocity += (speed - pawVelocity) * (1 - Math.exp(-24 * dt));
   }
   lastPawX = pawX;

   let target = status.cameraX;
   if (reduced) {
    target = center;
   } else if (Math.abs(offset) <= deadZone) {
    anchor = status.cameraX;
   } else {
    const progress = clamp((Math.abs(offset) - deadZone) / edgeSpan, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    const edge = offset < 0 ? 0 : maxScroll;
    // Taper prediction at both ends so a slow dead-zone crossing stays continuous.
    const lead = clamp(pawVelocity * 0.055, -120, 120) * 4 * progress * (1 - progress);
    target = clamp(anchor + (edge - anchor) * eased + lead, 0, maxScroll);
   }
   status.cameraX += (target - status.cameraX) * (1 - Math.exp(-7 * dt));
   if (reduced) anchor = status.cameraX;
   status.targetX = target;
   status.pawX = pawX;
   status.pawVelocity = pawVelocity;
  }

  function drawGroundedFoot(sprite, x, width, height) {
   const pose = frontFootPose;
   if (sprite[0] !== pose.texture) return null;
   frontFootPose = null;
   const response = pose.force * Math.exp(-pose.age / 0.12);
   const heightScale = 1 - Math.min(0.065, response * 0.056 + pose.pressure * 0.013);
   const heightOnRoad = height * heightScale;
   const soleGap = (pose.soleOffset - 1) * heightOnRoad / pose.frameHeight;
   status.lastFootContact = {x: x + width * pose.contactCenter, y: pose.floorY};
   return [sprite, x, pose.floorY + soleGap - heightOnRoad, width, heightOnRoad];
  }

  function drawSprite(sprite, x, y, width, height) {
   if (status.ready && sprite[0] === 'fenrirCity') {
    updateCamera();
    for (const layer of LAYERS) {
     const sourceX = clamp(status.cameraX * layer.parallax, 0, maxScroll);
     spriteScaled.call(this, [layer.key, sourceX, 0, viewW, viewH], x, y, width, height);
    }
    return;
   }
   const groundedFoot = frontFootPose && drawGroundedFoot(sprite, x, width, height);
   return spriteScaled.apply(this, groundedFoot || arguments);
  }

  function wrapFrontFoot(draw) {
   return function() {
    status.lastFootContact = null;
    const pose = context.getGroundPose();
    frontFootPose = pose?.grounded && !pose.supported ? pose : null;
    try {
     return draw.apply(this, arguments);
    } finally {
     frontFootPose = null;
    }
   };
  }

  function recordLanding(event) {
   if (!status.ready || event?.kind !== 'landing') return;
   const pose = context.getGroundPose();
   if (pose.supported) return;
   const x = event.x - pose.width / 2 - pose.offset + pose.width * pose.contactCenter;
   pendingLanding = {x, y: pose.floorY, at: event.at, force: event.force};
  }

  function drawRoadContact(floorGraphics, clock) {
   status.lastRoadMark = null;
   if (!status.ready || !floorGraphics.ready()) return;
   const prefs = global.__xlImmersionPrefs;
   while (roadMarks.length && clock - roadMarks[0].at >= 0.85) roadMarks.shift();
   if (pendingLanding) {
    const {x, y, at, force} = pendingLanding;
    pendingLanding = null;
    if (!prefs?.lowEffects && !prefs?.reduceMotion) {
     // Use the crop already drawn for the same frame as the foot.
     roadMarks.push({worldX: x + status.cameraX, y, at, force});
     if (roadMarks.length > 3) roadMarks.shift();
    }
   }
   if (prefs?.lowEffects || prefs?.reduceMotion) return;

   for (const mark of roadMarks) {
    const x = mark.worldX - status.cameraX;
    const progress = clamp((clock - mark.at) / 0.85, 0, 1);
    const fade = 1 - progress;
    const width = 33 + 23 * mark.force + 20 * progress;
    if (x + width < 0 || x - width > viewW) continue;
    floorGraphics.drawContactPress(x, mark.y + 1, width, 0.45 * fade, 0);
    floorGraphics.drawImpactRing(x, mark.y, width, 2.5 + 2 * progress, fade * (0.10 + 0.11 * mark.force));
    status.lastRoadMark = {x, worldX: mark.worldX, y: mark.y};
   }
  }

  return {drawSprite, wrapFrontFoot, recordLanding, drawRoadContact};
 };
})(window);
