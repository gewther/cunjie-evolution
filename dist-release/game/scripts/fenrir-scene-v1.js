/* Fenrir city scene / P5 mechanical weight: anchored hydraulic settling and wet-road contact. */
(function installFenrirCityScene(global) {
 'use strict';
 if (global.__installFenrirScene) return;

 const WORLD_WIDTH = 2400;
 const WORLD_HEIGHT = 240;
 const LAYERS = [
  {key: 'fenrirCityFarV1', url: 'assets/fenrir/city-far.svg', parallax: 0.12, rumbleGain: 0.45},
  {key: 'fenrirCityMidV1', url: 'assets/fenrir/city-mid.svg', parallax: 0.36, rumbleGain: 1},
  {key: 'fenrirCityNearV1', url: 'assets/fenrir/city-near.svg', parallax: 1, rumbleGain: 0}
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
  const MAX_ROAD_MARKS = 6;
  const MARK_LIFE = 3.2;
  let lastRoadClock = null;
  status.weight = {compression: 0, roadMarks: 0, landingForce: 0, environmentRumble: 0};
  let impactRumbleAt = null;
  let impactRumbleForce = 0;

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

   const prefs = global.__xlImmersionPrefs;
   let environmentRumble = 0;
   if (reduced || prefs?.lowEffects) {
    impactRumbleAt = null;
    impactRumbleForce = 0;
   } else if (impactRumbleAt !== null) {
    const age = (now - impactRumbleAt) / 1000;
    if (age >= 0 && age < 0.46) {
     // Distant facades react to a heavy landing; the near road remains world-locked.
     environmentRumble = Math.sin(age * 58) * Math.exp(-age / 0.18) * impactRumbleForce * 1.25;
    } else if (age >= 0.46) {
     impactRumbleAt = null;
     impactRumbleForce = 0;
    }
   }
   status.weight.environmentRumble = environmentRumble;

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
   // Visual suspension travel, not rubber-like widening or a change to collision geometry.
   const age = Math.max(0, Number(pose.age) || 0);
   const force = clamp(Number(pose.force) || 0, 0, 1);
   const pressure = clamp(Number(pose.pressure) || 0, 0, 1);
   const reduced = global.__xlImmersionPrefs?.reduceMotion;
   const settling = force * (1 + age / 0.10) * Math.exp(-age / 0.10);
   const compression = reduced ? pressure * 0.008 : Math.min(0.058, settling * 0.047 + pressure * 0.010);
   status.weight.compression = compression;
   const heightScale = 1 - compression;
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
     const layerY = y + status.weight.environmentRumble * layer.rumbleGain;
     spriteScaled.call(this, [layer.key, sourceX, 0, viewW, viewH], x, layerY, width, height);
    }
    return;
   }
   const groundedFoot = frontFootPose && drawGroundedFoot(sprite, x, width, height);
   return spriteScaled.apply(this, groundedFoot || arguments);
  }

  function wrapFrontFoot(draw) {
   return function() {
    status.lastFootContact = null;
    status.weight.compression = 0;
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
   if (!pose?.grounded || pose.supported || !Number.isFinite(event.x) || !Number.isFinite(event.at)) return;
   const force = clamp(Number(event.force) || 0, 0, 1);
   impactRumbleAt = performance.now();
   impactRumbleForce = Math.max(force, impactRumbleForce * 0.72);
   const width = Math.max(1, Number(pose.width) || 1);
   const x = event.x - width / 2 - pose.offset + width * pose.contactCenter;
   pendingLanding = {x, y: pose.floorY, at: event.at, force, width};
   status.weight.landingForce = force;
  }

  function drawRoadContact(floorGraphics, clock) {
   status.lastRoadMark = null;
   if (!Number.isFinite(clock)) return;
   // A restarted simulation may reset the contact clock; never replay old marks.
   if (lastRoadClock !== null && clock < lastRoadClock) {
    roadMarks.length = 0;
    if (pendingLanding && pendingLanding.at > clock) pendingLanding = null;
   }
   lastRoadClock = clock;
   const prefs = global.__xlImmersionPrefs;
   if (prefs?.lowEffects || prefs?.reduceMotion) {
    roadMarks.length = 0;
    pendingLanding = null;
    status.weight.roadMarks = 0;
    return;
   }
   if (!status.ready || !floorGraphics.ready()) {
    pendingLanding = null;
    return;
   }
   while (roadMarks.length && clock - roadMarks[0].at >= MARK_LIFE) roadMarks.shift();
   if (pendingLanding) {
    const {x, y, at, force, width} = pendingLanding;
    pendingLanding = null;
    if (clock >= at && clock - at < MARK_LIFE) {
     // Anchor the footprint to the near-layer crop used for this frame.
     roadMarks.push({worldX: x + status.cameraX, y, at, force, width});
     if (roadMarks.length > MAX_ROAD_MARKS) roadMarks.shift();
    }
   }
   status.weight.roadMarks = roadMarks.length;

   for (const mark of roadMarks) {
    const x = mark.worldX - status.cameraX;
    const age = Math.max(0, clock - mark.at);
    const fade = Math.pow(1 - clamp(age / MARK_LIFE, 0, 1), 1.5);
    const halfWidth = mark.width * (0.30 + 0.10 * mark.force);
    if (x + mark.width * 2 < 0 || x - mark.width * 2 > viewW) continue;
    // Persistent wet depression / dark contact imprint: slow recovery after lift.
    floorGraphics.drawContactPress(x, mark.y + 1, halfWidth, fade * (0.25 + 0.35 * mark.force), 0);
    // Two staggered water fronts. The second wave is weaker and only on firm impacts.
    for (const [delay, gain, duration] of [[0, 1, 0.72], [0.15, 0.48, 0.95]]) {
     if (delay && mark.force < 0.35) continue;
     const t = (age - delay) / duration;
     if (t < 0 || t >= 1) continue;
     const radius = halfWidth * (1 + t * (1.5 + mark.force * 0.8));
     const alpha = (1 - t) ** 2 * gain * (0.12 + mark.force * 0.20);
     floorGraphics.drawImpactRing(x, mark.y, radius, Math.max(2, radius * 0.085), alpha);
    }
    status.lastRoadMark = {x, worldX: mark.worldX, y: mark.y};
   }
  }


  function showEstablishingShot(onFinish) {
   const doc = global.document;
   if (!doc || !doc.body || typeof doc.createElement !== 'function' || typeof global.setTimeout !== 'function') return false;
   const prefs = global.__xlImmersionPrefs || {};
   let reduced = !!(prefs.reduceMotion || prefs.lowEffects);
   try { reduced = reduced || !!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch {}
   const duration = reduced ? 3000 : 5200;
   const layerSource = name => {
    const path = 'assets/fenrir/city-' + name + '.svg';
    const inline = global.__cunjieFenrirSceneLayers?.[path];
    if (inline) return inline;
    try { return new URL(path, doc.baseURI).href; } catch { return path; }
   };
   const farSrc = layerSource('far');
   const midSrc = layerSource('mid');
   const nearSrc = layerSource('near');
   const overlay = doc.createElement('div');
   overlay.className = 'fenrir-establishing' + (reduced ? ' lowfx' : '');
   overlay.setAttribute('role', 'dialog');
   overlay.setAttribute('aria-modal', 'true');
   overlay.setAttribute('aria-label', '芬里尔全身尺度建立镜头');
   overlay.style.cssText = '--shot-duration:' + duration + 'ms;';
   overlay.innerHTML = `
<style>
.fenrir-establishing{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#06111b;color:#eaf4f6;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans SC",sans-serif;isolation:isolate;touch-action:manipulation;animation:feFadeIn .22s ease-out both}
.fenrir-establishing *{box-sizing:border-box}
.fenrir-establishing__svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.fenrir-establishing__header{position:absolute;top:max(16px,env(safe-area-inset-top));left:max(18px,env(safe-area-inset-left));z-index:3;display:flex;align-items:center;gap:12px;text-shadow:0 2px 12px #000}
.fenrir-establishing__header strong{font-size:clamp(15px,2.1vw,24px);letter-spacing:.2em;color:#eaf7fa}
.fenrir-establishing__header span{font-size:11px;letter-spacing:.16em;color:#9bd5df;border-left:1px solid #7dbac7;padding-left:12px}
.fenrir-establishing__caption{position:absolute;left:50%;bottom:max(24px,env(safe-area-inset-bottom));z-index:3;transform:translateX(-50%);width:min(72%,720px);text-align:center;text-shadow:0 3px 16px #000;background:linear-gradient(90deg,transparent,#06111bd9 18%,#06111bd9 82%,transparent);padding:10px 18px 15px}
.fenrir-establishing__caption strong{display:block;font-size:clamp(20px,3.2vw,34px);font-weight:700;letter-spacing:.12em;color:#f2f7f4}
.fenrir-establishing__caption span{display:block;margin-top:5px;font-size:clamp(10px,1.35vw,14px);letter-spacing:.14em;color:#a7c5cd}
.fenrir-establishing__skip{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));z-index:4;min-width:132px;min-height:46px;padding:0 16px;border:1px solid #8dcbd5a8;border-radius:5px;background:#102b38e8;color:#e9f7f8;font:600 13px/1 system-ui,sans-serif;letter-spacing:.08em;box-shadow:0 5px 24px #0008;cursor:pointer}
.fenrir-establishing__skip:focus-visible{outline:3px solid #9cecff;outline-offset:3px}
.fenrir-establishing__progress{position:absolute;left:0;right:0;bottom:0;height:3px;z-index:5;background:#8adce7;transform:scaleX(0);transform-origin:left;animation:feProgress var(--shot-duration,5200ms) linear forwards}
.fenrir-establishing .fe-push{transform-box:fill-box;transform-origin:center;animation:fePush var(--shot-duration,5200ms) ease-in-out both}
.fenrir-establishing .fe-core{transform-box:fill-box;transform-origin:center;animation:feCore 2.4s ease-in-out infinite}
.fenrir-establishing .fe-rain{animation:feRain 1.6s linear infinite}
.fenrir-establishing .tall{display:none}
.fenrir-establishing.is-portrait .wide{display:none}
.fenrir-establishing.is-portrait .tall{display:inline}
.fenrir-establishing.is-portrait .fenrir-establishing__caption{bottom:max(86px,calc(env(safe-area-inset-bottom) + 76px));width:min(92%,620px);padding:8px 12px 12px}
.fenrir-establishing.is-portrait .fenrir-establishing__caption strong{font-size:clamp(19px,5.3vw,27px)}
.fenrir-establishing.is-portrait .fenrir-establishing__caption span{font-size:10px;letter-spacing:.08em}
.fenrir-establishing.is-portrait .fenrir-establishing__header{top:max(14px,env(safe-area-inset-top))}
.fenrir-establishing.is-portrait .fenrir-establishing__skip{bottom:max(18px,env(safe-area-inset-bottom));left:50%;right:auto;transform:translateX(-50%);min-width:164px}
.fenrir-establishing.lowfx .fe-push,.fenrir-establishing.lowfx .fe-core,.fenrir-establishing.lowfx .fe-rain{animation:none!important}
.fenrir-establishing.lowfx .fe-rain{display:none}
@keyframes feFadeIn{from{opacity:0}to{opacity:1}}
@keyframes feProgress{to{transform:scaleX(1)}}
@keyframes fePush{0%{transform:scale(1) translateY(0)}100%{transform:scale(1.025) translateY(-5px)}}
@keyframes feCore{0%,100%{opacity:.76}50%{opacity:1}}
@keyframes feRain{from{transform:translateY(-16px)}to{transform:translateY(20px)}}
@media(prefers-reduced-motion:reduce){.fenrir-establishing *{animation:none!important;transition:none!important}}
</style>
<svg class="fenrir-establishing__svg" viewBox="0 0 1600 900" role="img" aria-label="30米芬里尔机甲与城市路灯、车辆的尺度对照">
 <defs>
  <linearGradient id="fe-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#071522"/><stop offset=".52" stop-color="#102b3b"/><stop offset="1" stop-color="#284858"/></linearGradient>
  <linearGradient id="fe-armor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0f4ef"/><stop offset=".48" stop-color="#b9c6c8"/><stop offset="1" stop-color="#657984"/></linearGradient>
  <linearGradient id="fe-armor-light" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".7" stop-color="#c9d5d6"/><stop offset="1" stop-color="#82959c"/></linearGradient>
  <linearGradient id="fe-dark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#465b67"/><stop offset=".45" stop-color="#1b2d39"/><stop offset="1" stop-color="#091722"/></linearGradient>
  <linearGradient id="fe-gold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe5a0"/><stop offset=".45" stop-color="#c79a4e"/><stop offset="1" stop-color="#76542b"/></linearGradient>
  <linearGradient id="fe-red" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#7d2831"/><stop offset=".5" stop-color="#f05e62"/><stop offset="1" stop-color="#6c202b"/></linearGradient>
  <linearGradient id="fe-cyan" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d7ffff"/><stop offset=".38" stop-color="#70f2ff"/><stop offset="1" stop-color="#168da9"/></linearGradient>
  <linearGradient id="fe-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1d4053"/><stop offset=".5" stop-color="#0b1d2a"/><stop offset="1" stop-color="#3c7181"/></linearGradient>
  <pattern id="fe-vents" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M2 2h7M2 6h7M2 10h7" stroke="#06121b" stroke-width="2" opacity=".8"/></pattern>
  <filter id="fe-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="fe-shadow" x="-40%" y="-30%" width="180%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="9" result="b"/><feOffset dy="8"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <g id="fenrir-unit-body" data-reference-height="30m" stroke-linejoin="round" stroke-linecap="round">
   <ellipse cx="250" cy="748" rx="205" ry="18" fill="#02080e" opacity=".62"/>
   <g filter="url(#fe-shadow)">
    <!-- Heavy twin backpack and shoulder-mounted cooling stacks -->
    <g stroke="#718b96" stroke-width="4">
     <path d="M104 116L88 68L116 42L169 63L178 202L143 246L105 215Z" fill="url(#fe-dark)"/>
     <path d="M396 116L412 68L384 42L331 63L322 202L357 246L395 215Z" fill="url(#fe-dark)"/>
     <path d="M112 84L151 70L160 190L126 204Z" fill="#233946"/>
     <path d="M388 84L349 70L340 190L374 204Z" fill="#233946"/>
    </g>
    <g stroke="#78c9d6" stroke-width="3" opacity=".7"><path d="M121 104l30-10m-29 26l31-10m-30 26l31-10m225-22l-30-10m29 26l-31-10m30 26l-31-10"/></g>
    <g fill="#e95c61"><rect x="111" y="174" width="17" height="6" rx="2"/><rect x="372" y="174" width="17" height="6" rx="2"/></g>
    <!-- Rear leg actuators -->
    <path d="M180 378L225 385L218 548L194 646L151 638L160 520Z" fill="url(#fe-dark)" stroke="#81949b" stroke-width="5"/>
    <path d="M275 385L320 378L340 520L349 638L306 646L282 548Z" fill="url(#fe-dark)" stroke="#81949b" stroke-width="5"/>
    <!-- Left and right arms -->
    <path d="M91 190L151 203L139 304L116 397L70 389L75 286Z" fill="url(#fe-dark)" stroke="#82979e" stroke-width="5"/>
    <path d="M409 190L349 203L361 304L384 397L430 389L425 286Z" fill="url(#fe-dark)" stroke="#82979e" stroke-width="5"/>
    <path d="M83 222L138 235L129 302L82 290Z" fill="url(#fe-armor)" stroke="#d9e2df" stroke-width="3"/>
    <path d="M417 222L362 235L371 302L418 290Z" fill="url(#fe-armor)" stroke="#d9e2df" stroke-width="3"/>
    <path d="M70 319L125 332L111 382L64 373Z" fill="url(#fe-armor-light)" stroke="#7d9199" stroke-width="3"/>
    <path d="M430 319L375 332L389 382L436 373Z" fill="url(#fe-armor-light)" stroke="#7d9199" stroke-width="3"/>
    <path d="M75 392L116 399L112 430L70 423Z" fill="#111f29" stroke="#738994" stroke-width="4"/>
    <path d="M425 392L384 399L388 430L430 423Z" fill="#111f29" stroke="#738994" stroke-width="4"/>
    <path d="M81 406l29 5m-24 8l20 4m293-17l-29 5m24 8l-20 4" stroke="#9fb2b7" stroke-width="2"/>
    <!-- Shoulder armor -->
    <path d="M171 126L112 104L57 136L42 184L77 229L159 207L190 167Z" fill="url(#fe-armor-light)" stroke="#e6efec" stroke-width="5"/>
    <path d="M329 126L388 104L443 136L458 184L423 229L341 207L310 167Z" fill="url(#fe-armor-light)" stroke="#e6efec" stroke-width="5"/>
    <path d="M63 171L117 145L150 161L133 195L81 210Z" fill="url(#fe-glass)" stroke="#91aab2" stroke-width="3"/>
    <path d="M437 171L383 145L350 161L367 195L419 210Z" fill="url(#fe-glass)" stroke="#91aab2" stroke-width="3"/>
    <path d="M78 151l32-14m-25 24l32-14M422 151l-32-14m25 24l-32-14" stroke="#e4bd72" stroke-width="5"/>
    <path d="M95 218l42-11m226 0l42 11" stroke="url(#fe-red)" stroke-width="8"/>
    <!-- Neck and central torso -->
    <path d="M218 112L282 112L294 153L276 183L224 183L206 153Z" fill="url(#fe-dark)" stroke="#83969c" stroke-width="4"/>
    <path d="M178 151L250 127L322 151L346 279L306 357L250 379L194 357L154 279Z" fill="url(#fe-armor)" stroke="#dce6e3" stroke-width="5"/>
    <path d="M196 164L250 146L304 164L317 271L286 323L250 342L214 323L183 271Z" fill="url(#fe-dark)" stroke="#6f838d" stroke-width="4"/>
    <path d="M210 184L250 168L290 184L281 252L250 278L219 252Z" fill="#0b2533" stroke="#9cb1b8" stroke-width="3"/>
    <path class="fe-core" d="M225 195L250 184L275 195L270 244L250 262L230 244Z" fill="url(#fe-cyan)" stroke="#b9fbff" stroke-width="3" filter="url(#fe-glow)"/>
    <path d="M236 207L250 199L264 207L260 237L250 245L240 237Z" fill="#e3ffff" opacity=".72"/>
    <path d="M177 218L203 210L214 280L187 294Z" fill="url(#fe-armor-light)" stroke="#718791" stroke-width="3"/>
    <path d="M323 218L297 210L286 280L313 294Z" fill="url(#fe-armor-light)" stroke="#718791" stroke-width="3"/>
    <path d="M185 302L218 318L208 350L176 337ZM315 302L282 318L292 350L324 337Z" fill="#263a46" stroke="#7b9098" stroke-width="3"/>
    <!-- Waist, hip guards and red warning marks -->
    <path d="M196 345L250 361L304 345L326 397L287 429L213 429L174 397Z" fill="url(#fe-dark)" stroke="#8a9ca2" stroke-width="4"/>
    <path d="M178 362L213 372L207 437L159 453L137 411Z" fill="url(#fe-armor-light)" stroke="#d5dfdc" stroke-width="4"/>
    <path d="M322 362L287 372L293 437L341 453L363 411Z" fill="url(#fe-armor-light)" stroke="#d5dfdc" stroke-width="4"/>
    <path d="M159 414l37-11m108 0l37 11" stroke="url(#fe-red)" stroke-width="8"/>
    <path d="M221 374L250 382L279 374L274 409L250 423L226 409Z" fill="url(#fe-gold)" stroke="#f3d28a" stroke-width="3"/>
    <!-- Upper legs and knee joints -->
    <path d="M169 427L229 429L226 526L204 566L156 554L146 490Z" fill="url(#fe-armor-light)" stroke="#d8e2df" stroke-width="4"/>
    <path d="M331 427L271 429L274 526L296 566L344 554L354 490Z" fill="url(#fe-armor-light)" stroke="#d8e2df" stroke-width="4"/>
    <path d="M185 449L214 446L211 511L181 520Z" fill="url(#fe-vents)" opacity=".85"/>
    <path d="M315 449L286 446L289 511L319 520Z" fill="url(#fe-vents)" opacity=".85"/>
    <path d="M149 516L209 530L204 582L151 570Z" fill="url(#fe-dark)" stroke="#8a9ca2" stroke-width="4"/>
    <path d="M351 516L291 530L296 582L349 570Z" fill="url(#fe-dark)" stroke="#8a9ca2" stroke-width="4"/>
    <circle cx="180" cy="545" r="17" fill="#0b1b27" stroke="#d3b36d" stroke-width="4"/>
    <circle cx="320" cy="545" r="17" fill="#0b1b27" stroke="#d3b36d" stroke-width="4"/>
    <circle cx="180" cy="545" r="7" fill="#6ce8f6"/><circle cx="320" cy="545" r="7" fill="#6ce8f6"/>
    <!-- Shin armor, pistons and red hydraulic bands -->
    <path d="M153 574L205 584L218 665L184 695L126 677L135 618Z" fill="url(#fe-armor)" stroke="#dce6e3" stroke-width="4"/>
    <path d="M347 574L295 584L282 665L316 695L374 677L365 618Z" fill="url(#fe-armor)" stroke="#dce6e3" stroke-width="4"/>
    <path d="M160 595L193 603L188 660L151 652Z" fill="url(#fe-vents)" opacity=".8"/>
    <path d="M340 595L307 603L312 660L349 652Z" fill="url(#fe-vents)" opacity=".8"/>
    <path d="M145 611L202 623M298 623L355 611" stroke="url(#fe-red)" stroke-width="9"/>
    <path d="M205 580L225 598L218 682L198 693L189 677L198 615Z" fill="#192c38" stroke="#748b95" stroke-width="4"/>
    <path d="M295 580L275 598L282 682L302 693L311 677L302 615Z" fill="#192c38" stroke="#748b95" stroke-width="4"/>
    <path d="M214 603L226 613L218 665M286 603L274 613L282 665" stroke="#e0bf77" stroke-width="4"/>
    <!-- Three individually articulated gold toes on each foot -->
    <path d="M120 676L174 684L185 719L169 744L87 744L72 720Z" fill="url(#fe-gold)" stroke="#f1d38e" stroke-width="4"/>
    <path d="M174 681L218 681L232 717L215 746L164 744L169 718Z" fill="url(#fe-gold)" stroke="#f1d38e" stroke-width="4"/>
    <path d="M218 681L249 683L258 719L244 746L210 746L215 717Z" fill="url(#fe-gold)" stroke="#f1d38e" stroke-width="4"/>
    <path d="M251 683L282 681L285 717L301 746L256 746L244 719Z" fill="url(#fe-gold)" stroke="#f1d38e" stroke-width="4"/>
    <path d="M282 681L326 681L331 717L346 744L297 746L285 717Z" fill="url(#fe-gold)" stroke="#f1d38e" stroke-width="4"/>
    <path d="M326 684L380 676L428 720L413 744L331 744L315 719Z" fill="url(#fe-gold)" stroke="#f1d38e" stroke-width="4"/>
    <g fill="#152632" stroke="#647d88" stroke-width="2">
     <path d="M91 712L159 712L160 726L84 726Z"/><path d="M174 710L219 710L220 727L166 727Z"/><path d="M220 710L250 710L251 727L213 727Z"/>
     <path d="M257 710L284 710L288 727L252 727Z"/><path d="M289 710L331 710L337 727L292 727Z"/><path d="M340 710L412 710L418 726L345 726Z"/>
    </g>
    <g stroke="#8ca2a8" stroke-width="2" opacity=".85"><path d="M99 716v9m12-9v9m12-9v9m12-9v9m12-9v9m-56 0h70M176 714v10m12-10v10m12-10v10m-33 0h44M222 714v10m10-10v10m10-10v10m-26 0h30M260 714v10m10-10v10m10-10v10m-24 0h30M294 714v10m12-10v10m12-10v10m-25 0h45M350 716v9m12-9v9m12-9v9m12-9v9m-49 0h70"/></g>
    <!-- Three-toe side armor, shield plates and ankle pistons -->
    <path d="M79 665L116 644L164 652L174 684L132 700L87 692Z" fill="url(#fe-dark)" stroke="#b3c2c3" stroke-width="4"/>
    <path d="M421 665L384 644L336 652L326 684L368 700L413 692Z" fill="url(#fe-dark)" stroke="#b3c2c3" stroke-width="4"/>
    <path d="M102 666l44-12m-39 22l39-11m222 1l39 12m-39-1l39 11" stroke="#d8e4e1" stroke-width="3"/>
    <path d="M194 631L208 624L218 686L203 697ZM306 631L292 624L282 686L297 697Z" fill="#0c1d28" stroke="#9aabb0" stroke-width="3"/>
    <path d="M199 652l12 3m-10 8l12 3m78-14l-12 3m10 8l-12 3" stroke="#e15c61" stroke-width="5"/>
    <!-- Helmet and crown silhouette -->
    <path d="M208 51L174 12L190 81L157 63L194 119L306 119L343 63L310 81L326 12L292 51L250 29Z" fill="url(#fe-gold)" stroke="#f3d18a" stroke-width="4"/>
    <path d="M205 56L250 34L295 56L309 117L281 151L219 151L191 117Z" fill="url(#fe-armor-light)" stroke="#e9f0eb" stroke-width="5"/>
    <path d="M211 83L250 67L289 83L283 117L250 137L217 117Z" fill="url(#fe-dark)" stroke="#7e949d" stroke-width="3"/>
    <path d="M218 91L250 82L282 91L275 103L250 109L225 103Z" fill="url(#fe-cyan)" filter="url(#fe-glow)"/>
    <path d="M229 118L250 126L271 118" fill="none" stroke="#d6e2e1" stroke-width="4"/>
    <path d="M194 104L176 122L202 139M306 104L324 122L298 139" fill="none" stroke="#c9a05b" stroke-width="6"/>
    <path d="M227 43l23-11 23 11" fill="none" stroke="#fff4d3" stroke-width="3"/>
    <!-- Small identity marks and panel seams -->
    <path d="M90 178l34-13m-27 24l23-9M375 178l-34-13m27 24l-23-9" stroke="#d84e58" stroke-width="5"/>
    <path d="M191 285l18 8m100-8l-18 8M169 466l35 9m127-9l-35 9" stroke="#f1d18a" stroke-width="3"/>
    <path d="M183 304l20 7m94-7l-20 7M153 640l35 10m159-10l-35 10" stroke="#6ccbd9" stroke-width="2"/>
    <path d="M224 292h52M216 302h68" stroke="#8ca1a8" stroke-width="2"/>
    <path d="M248 354v18" stroke="#f0d18a" stroke-width="4"/>
   </g>
  </g>
 </defs>
 <g class="wide">
  <rect width="1600" height="900" fill="url(#fe-sky)"/>
  <path d="M0 150Q250 80 490 142T970 122T1600 138V420H0Z" fill="#1b3b4d" opacity=".28"/>
  <image href="${farSrc}" x="-975" y="150" width="3600" height="360" opacity=".92"/>
  <image href="${midSrc}" x="-975" y="390" width="3600" height="360" opacity=".94"/>
  <!-- 18 m service block: deliberately lower than Fenrir, taller than the street furniture. -->
  <g opacity=".94">
   <path d="M1112 831V410L1150 380H1296V831Z" fill="url(#fe-glass)" stroke="#82a9b6" stroke-opacity=".55" stroke-width="3"/>
   <path d="M1126 424H1284V818H1126Z" fill="url(#fe-vents)" opacity=".7"/>
   <path d="M1144 410V831M1190 410V831M1236 410V831M1280 410V831" stroke="#9ccbd4" stroke-opacity=".22" stroke-width="3"/>
   <path d="M1112 505H1296M1112 610H1296M1112 715H1296" stroke="#9ccbd4" stroke-opacity=".20" stroke-width="3"/>
   <path d="M1130 444h22v8h-22m88 0h22v8h-22" stroke="#d6b777" stroke-width="3" opacity=".8"/>
  </g>
  <image href="${nearSrc}" x="-975" y="540" width="3600" height="360"/>
  <path d="M0 832H1600V900H0Z" fill="#07131e" opacity=".62"/>
  <path d="M600 832L800 900M1000 832L800 900M300 832L610 900M1300 832L990 900" stroke="#7ab5c4" stroke-opacity=".18" stroke-width="3"/>
  <ellipse cx="800" cy="836" rx="285" ry="24" fill="#050d15" opacity=".56"/>
  <ellipse cx="800" cy="840" rx="180" ry="9" fill="#4fd7e8" opacity=".11"/>
  <!-- Tiny human silhouettes: 1.8 m against a 30 m frame. -->
  <g fill="#07131c" stroke="#8ba9b2" stroke-width="2" opacity=".9">
   <circle cx="520" cy="798" r="5"/><path d="M520 804v18m-7-11l7 5 7-5m-7 11l-6 9m6-9l6 9" fill="none"/>
   <circle cx="1080" cy="797" r="5"/><path d="M1080 803v18m-7-11l7 5 7-5m-7 11l-6 9m6-9l6 9" fill="none"/>
  </g>
  <g class="fe-push"><use href="#fenrir-unit-body" transform="translate(560 110) scale(.95)"/></g>
  <g fill="none" stroke="#9fe6ed" stroke-width="2" opacity=".7">
   <path d="M78 110V832m-8-722h16m-16 361h16m-16 361h16"/>
  </g>
  <g fill="#d9eef1" font-family="system-ui,sans-serif" font-size="22" letter-spacing="2">
   <text x="100" y="118">30.0m</text><text x="100" y="480">15.0m</text><text x="100" y="826">00.0m</text>
   <text x="1325" y="675" fill="#e9d9ad">6.0m / LAMP</text>
   <text x="95" y="774" fill="#e9d9ad">4.5m / VEHICLE</text>
   <text x="1118" y="365" fill="#e9d9ad">18.0m / BLOCK</text>
  </g>
  <g class="fe-rain" stroke="#9ddce5" stroke-width="2" opacity=".26"><path d="M210 120l-22 76m160-116l-18 60m102-18l-20 68m101-130l-21 72m880-36l-20 68m-90-30l-19 65m190-116l-18 60"/></g>
 </g>
 <g class="tall" display="none">
  <rect width="900" height="1600" fill="url(#fe-sky)"/>
  <path d="M0 360Q220 250 450 350T900 320V850H0Z" fill="#17384a" opacity=".30"/>
  <image href="${farSrc}" x="-1800" y="430" width="4800" height="480" opacity=".92"/>
  <image href="${midSrc}" x="-1800" y="680" width="4800" height="480" opacity=".94"/>
  <g opacity=".94">
   <path d="M700 1128V570L728 540H890V1128Z" fill="url(#fe-glass)" stroke="#82a9b6" stroke-opacity=".55" stroke-width="3"/>
   <path d="M714 590H876V1110H714Z" fill="url(#fe-vents)" opacity=".7"/>
   <path d="M744 570V1128M790 570V1128M836 570V1128M880 570V1128" stroke="#9ccbd4" stroke-opacity=".22" stroke-width="3"/>
   <path d="M700 700H890M700 840H890M700 980H890" stroke="#9ccbd4" stroke-opacity=".20" stroke-width="3"/>
  </g>
  <image href="${nearSrc}" x="-1800" y="740" width="4800" height="480"/>
  <path d="M0 1128H900V1600H0Z" fill="#07131e" opacity=".60"/>
  <path d="M450 1128L120 1600M450 1128L780 1600M450 1128L0 1450M450 1128L900 1450" stroke="#7ab5c4" stroke-opacity=".17" stroke-width="4"/>
  <ellipse cx="450" cy="1133" rx="255" ry="22" fill="#050d15" opacity=".58"/>
  <ellipse cx="450" cy="1138" rx="170" ry="8" fill="#4fd7e8" opacity=".12"/>
  <g class="fe-push"><use href="#fenrir-unit-body" transform="translate(140 178) scale(1.25)"/></g>
  <g fill="#d9eef1" font-family="system-ui,sans-serif" font-size="28" letter-spacing="2">
   <text x="48" y="128">30.0m / FENRIR</text>
   <text x="34" y="920" fill="#e9d9ad">6.0m LAMP</text>
   <text x="650" y="1238" fill="#e9d9ad">4.5m VEHICLE</text>
   <text x="680" y="520" fill="#e9d9ad">18.0m BLOCK</text>
  </g>
  <g class="fe-rain" stroke="#9ddce5" stroke-width="3" opacity=".24"><path d="M160 250l-22 90m160-120l-18 70m490-140l-20 78m-90 40l-20 72m170 90l-18 66"/></g>
 </g>
</svg>
<div class="fenrir-establishing__header"><strong>FENRIR</strong><span>UNIT 01 / SCALE LOCKED</span></div>
<div class="fenrir-establishing__caption"><strong>抬头，朋友。</strong><span>30.0 m MECHA · 6.0 m STREETLIGHT · 4.5 m VEHICLE</span></div>
<button class="fenrir-establishing__skip" type="button">跳过镜头 / 进入街区</button>
<div class="fenrir-establishing__progress" aria-hidden="true"></div>`;
   const svg = overlay.querySelector('.fenrir-establishing__svg');
   const skip = overlay.querySelector('.fenrir-establishing__skip');
   if (!svg || !skip) return false;
   let finished = false;
   let timer = null;
   const updateLayout = () => {
    const width = Number(global.innerWidth) || Number(doc.documentElement?.clientWidth) || 1600;
    const height = Number(global.innerHeight) || Number(doc.documentElement?.clientHeight) || 900;
    const portrait = height > width;
    svg.setAttribute('viewBox', portrait ? '0 0 900 1600' : '0 0 1600 900');
    overlay.classList.toggle('is-portrait', portrait);
    const wide = svg.querySelector('.wide');
    const tall = svg.querySelector('.tall');
    if (wide) wide.setAttribute('display', portrait ? 'none' : 'inline');
    if (tall) tall.setAttribute('display', portrait ? 'inline' : 'none');
   };
   const onKey = event => {
    if (!['Escape', 'Enter', ' ', 'Spacebar'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    finish();
   };
   const finish = () => {
    if (finished) return;
    finished = true;
    if (timer !== null && typeof global.clearTimeout === 'function') global.clearTimeout(timer);
    if (typeof doc.removeEventListener === 'function') doc.removeEventListener('keydown', onKey, true);
    if (typeof global.removeEventListener === 'function') global.removeEventListener('resize', updateLayout);
    if (typeof overlay.remove === 'function') overlay.remove();
    else if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    try { if (typeof onFinish === 'function') onFinish(); } catch (error) { console.warn('[Fenrir intro] resume failed:', error); }
   };
   skip.addEventListener('click', finish);
   if (typeof doc.addEventListener === 'function') doc.addEventListener('keydown', onKey, true);
   doc.body.appendChild(overlay);
   updateLayout();
   if (typeof global.addEventListener === 'function') global.addEventListener('resize', updateLayout, {passive:true});
   try { skip.focus({preventScroll:true}); } catch { try { skip.focus(); } catch {} }
   timer = global.setTimeout(finish, duration);
   return true;
  }

  return {drawSprite, wrapFrontFoot, recordLanding, drawRoadContact, showEstablishingShot};
 };
})(window);
