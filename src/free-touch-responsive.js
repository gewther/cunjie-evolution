/* Project Cunjie — Responsive Mobile Touch Controller for Free Mode & Fenrir Mode.
 * Fixes sluggish relative swipe caps while preserving foot contact, pressure control,
 * wet-asphalt slide scuffs, and anti-flick / anti-teleport safety.
 */
class FreeTouchController {
 constructor() {
  this.owned = false;
  this.dragging = false;
  this.absolute = false;
  this.freshTap = false;
  this.x = 200;
  this.targetX = 200;
  this.vx = 0;
  this.y = 64;
  this.targetY = 64;
  this.vy = 0;
  this.velocity = 0;
  this.pressure = 0;
  this.lastContactSpeed = 0;
  this.lastStamp = 0;
  this.lastEvent = '';
  this.minX = -48;
  this.maxX = 448;
  this.minY = 64;
  this.floorY = 228;
  this.height = 240;
 }

 static clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
 }

 _setLimits(limits) {
  if (!limits) return;
  if (Number.isFinite(limits.minX)) this.minX = limits.minX;
  if (Number.isFinite(limits.maxX)) this.maxX = limits.maxX;
  if (Number.isFinite(limits.minY)) this.minY = limits.minY;
  if (Number.isFinite(limits.floorY)) this.floorY = limits.floorY;
  if (Number.isFinite(limits.height)) this.height = limits.height;
 }

 begin(x, y, stamp, limits, absolute) {
  this._setLimits(limits);
  this.x = FreeTouchController.clamp(Number.isFinite(x) ? x : 200, this.minX, this.maxX);
  this.targetX = this.x;
  this.y = FreeTouchController.clamp(Number.isFinite(y) ? y : this.minY, this.minY, this.floorY);
  this.targetY = this.y;
  this.vx = 0;
  this.vy = 0;
  this.velocity = 0;
  this.pressure = 0;
  this.lastContactSpeed = 0;
  this.lastStamp = Number.isFinite(stamp) ? stamp : 0;
  this.owned = true;
  this.dragging = true;
  this.absolute = !!absolute;
  this.freshTap = true;
  this.lastEvent = 'touchstart';
 }

 moveRelative(dx, dy, stamp, sensitivity, currentY) {
  if (!this.owned || !this.dragging) return;
  const now = Number.isFinite(stamp) ? stamp : this.lastStamp + 16.6666667;
  const dt = FreeTouchController.clamp((now - this.lastStamp) / 1000, 0.004, 0.05);
  this.lastStamp = now;
  const s = FreeTouchController.clamp(Number(sensitivity) || 1, 0.5, 2.5);

  const dxStep = FreeTouchController.clamp((dx || 0) * 2.15 * s, -160, 160);
  this.targetX = FreeTouchController.clamp(this.targetX + dxStep, this.minX, this.maxX);

  const vGain = 1.65 * s;
  const maxDy = Math.min(72, 680 * s * dt);
  const dyStep = FreeTouchController.clamp((dy || 0) * vGain, -maxDy, maxDy);
  let nextY = FreeTouchController.clamp(this.targetY + dyStep, this.minY, this.floorY + this.height * 0.85);

  const curY = Number.isFinite(currentY) ? currentY : this.y;
  const leash = FreeTouchController.clamp(56 * s, 48, 96);
  if (curY < this.floorY - 0.1) {
   nextY = FreeTouchController.clamp(nextY, curY - leash, curY + leash);
  }
  this.targetY = nextY;
  this.lastEvent = 'touchmove';
 }

 moveDirect(x, y, stamp) {
  if (!this.owned || !this.dragging) return;
  if (Number.isFinite(stamp)) this.lastStamp = stamp;
  this.targetX = FreeTouchController.clamp(Number.isFinite(x) ? x : this.targetX, this.minX, this.maxX);
  const yy = FreeTouchController.clamp(Number.isFinite(y) ? y : this.minY, this.minY, this.height);
  const splitY = Math.max(this.minY + 24, this.floorY - 34);
  if (yy <= splitY) {
   const airT = (yy - this.minY) / Math.max(1, splitY - this.minY);
   this.targetY = this.minY + airT * (this.floorY - this.minY);
  } else {
   const pressT = FreeTouchController.clamp((yy - splitY) / Math.max(1, (this.height - 4) - splitY), 0, 1);
   this.targetY = this.floorY + pressT * this.height * 0.85;
  }
  this.lastEvent = 'touchmove';
 }

 hold(x, y) {
  if (!this.owned) return;
  this.dragging = false;
  if (Number.isFinite(x)) this.x = FreeTouchController.clamp(x, this.minX, this.maxX);
  this.targetX = this.x;
  if (Number.isFinite(y)) this.y = FreeTouchController.clamp(y, this.minY, this.floorY);
  this.targetY = this.y;
  this.vx = 0;
  this.vy = 0;
  this.velocity = 0;
  this.pressure = 0;
  this.freshTap = false;
  this.lastEvent = 'hold';
 }

 disown(reason) {
  this.lastEvent = reason || 'disown';
  this.owned = false;
  this.dragging = false;
  this.vx = 0;
  this.vy = 0;
  this.velocity = 0;
  this.pressure = 0;
  this.freshTap = false;
 }

 stepY(dt, y, minY, floorY, height, sensitivity) {
  this.minY = minY;
  this.floorY = floorY;
  this.height = height;
  const startY = Number.isFinite(y) ? y : this.y;
  this.y = startY;
  const total = FreeTouchController.clamp(dt || 0, 0, 0.05);

  if (this.absolute) {
   if (!this.dragging) {
    this.vy = 0;
    this.velocity = 0;
    this.pressure = 0;
    return Math.min(floorY, this.y);
   }
   const clampedTarget = FreeTouchController.clamp(this.targetY, minY, floorY);
   const maxStep = 880 * total;
   const dy = clampedTarget - startY;
   this.y = Math.abs(dy) <= maxStep ? clampedTarget : startY + Math.sign(dy) * maxStep;
   this.y = FreeTouchController.clamp(this.y, minY, floorY);
   this.velocity = total > 0 ? (this.y - startY) / total : 0;
   this.vy = this.velocity;
   const grounded = this.y >= floorY - 0.001;
   this.pressure = grounded && this.targetY >= floorY
    ? FreeTouchController.clamp((this.targetY - floorY) / (height * 0.85), 0, 1)
    : 0;
   return grounded && this.targetY >= floorY ? height * (1 + this.pressure) : Math.min(floorY, this.y);
  }

  const s = FreeTouchController.clamp(Number(sensitivity) || 1, 0.5, 2.5);
  const sFactor = FreeTouchController.clamp(0.65 + 0.35 * s, 0.75, 1.6);
  let left = total;

  if (startY >= floorY - 0.001 && this.targetY >= floorY) {
   this.y = floorY;
   this.vy = 0;
  } else {
   while (left > 1e-7) {
    const step = Math.min(1 / 120, left);
    const error = this.targetY - this.y;
    const limit = error >= 0 ? 460 * sFactor : 560 * sFactor;
    const accel = 2800 * sFactor;
    const desired = Math.sign(error) * Math.min(limit, Math.abs(error) * 28, Math.sqrt(2 * accel * Math.abs(error)));
    this.vy += FreeTouchController.clamp(desired - this.vy, -accel * step, accel * step);
    this.y += this.vy * step;
    if (Math.abs(this.targetY - this.y) < 0.025 && Math.abs(this.vy) < 1) {
     this.y = this.targetY;
     this.vy = 0;
    }
    if (this.y < minY) {
     this.y = minY;
     this.vy = 0;
    }
    if (this.y >= floorY) {
     this.y = floorY;
     this.vy = 0;
     break;
    }
    left -= step;
   }
  }

  this.velocity = total > 0 ? (this.y - startY) / total : 0;
  const targetP = this.dragging ? FreeTouchController.clamp((this.targetY - floorY) / (height * 0.85), 0, 1) : 0;
  const grounded = startY >= floorY - 0.001 || this.y >= floorY;
  this.pressure += FreeTouchController.clamp((grounded ? targetP : 0) - this.pressure, -5.0 * total, 3.6 * total);
  this.pressure = FreeTouchController.clamp(this.pressure, 0, 1);
  return grounded && this.targetY >= floorY ? height * (1 + this.pressure) : Math.min(floorY, this.targetY);
 }

 stepX(dt, x, minX, maxX, grounded, pressure, sensitivity) {
  this.minX = minX;
  this.maxX = maxX;
  const startX = FreeTouchController.clamp(Number.isFinite(x) ? x : this.x, minX, maxX);
  this.x = startX;
  if (!this.owned || !this.dragging) {
   this.vx = 0;
   return startX;
  }
  const total = FreeTouchController.clamp(dt || 0, 0, 0.05);
  const s = FreeTouchController.clamp(Number(sensitivity) || 1, 0.5, 2.5);
  const target = FreeTouchController.clamp(this.targetX, minX, maxX);
  const diff = target - startX;
  const groundFactor = grounded ? (1 - Math.min(0.42, Math.max(0, pressure || 0) * 0.42)) : 1;
  const maxSpeed = this.absolute ? 1400 : (920 + 260 * s) * groundFactor;
  const blend = 1 - Math.exp(-(this.absolute ? 32 : 26) * total);
  let step = diff * blend;
  const cap = maxSpeed * total;
  if (Math.abs(step) > cap) step = Math.sign(step) * cap;
  if (Math.abs(diff) < 0.05) step = diff;
  const nextX = FreeTouchController.clamp(startX + step, minX, maxX);
  this.vx = total > 0 ? (nextX - startX) / total : 0;
  this.x = nextX;
  return nextX;
 }

 landing(speed) {
  this.lastContactSpeed = Math.max(0, speed || 0);
 }

 snapshot() {
  return {
   enabled: this.owned,
   dragging: this.dragging,
   absolute: this.absolute,
   x: this.x,
   targetX: this.targetX,
   vx: this.vx,
   target: this.targetY,
   y: this.y,
   velocity: this.velocity,
   pressure: this.pressure,
   contactSpeed: this.lastContactSpeed,
   lastEvent: this.lastEvent
  };
 }
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = FreeTouchController;
}

if (typeof oc !== 'undefined' && typeof realmTouch !== 'undefined' && typeof canvas_coords === 'function') {
 (function installFreeResponsiveTouch() {
  const freeTouch = new FreeTouchController();
  const freeHandled = new WeakSet();
  let freeTouchId = null;
  let freeLastX = 0;
  let freeLastY = 0;
  let freeLastTouchAt = -9999;

  function syncRealmTouch() {
   realmTouch.owned = freeTouch.owned;
   realmTouch.dragging = freeTouch.dragging;
   realmTouch.absolute = freeTouch.absolute;
   realmTouch.freshTap = freeTouch.freshTap;
   realmTouch.target = freeTouch.targetY;
   realmTouch.y = freeTouch.y;
   realmTouch.v = freeTouch.vy;
   realmTouch.velocity = freeTouch.velocity;
   realmTouch.pressure = freeTouch.pressure;
   realmTouch.lastContactSpeed = freeTouch.lastContactSpeed;
   realmTouch.lastEvent = freeTouch.lastEvent;
  }

  function freeTouchFreeze() {
   if (!freeTouch.owned && !realmTouchOwns()) return;
   freeTouch.hold(paw_x, paw_y);
   syncRealmTouch();
   mp = false;
   touchid = null;
   freeTouchId = null;
   my = paw_y / 2;
   paw_dest_y = paw_y;
   paw_dest_x = paw_x;
  }

  function freeTouchDisown(reason) {
   const wasOwned = freeTouch.owned || realmTouch.owned;
   freeTouch.disown(reason);
   freeTouchId = null;
   syncRealmTouch();
   if (wasOwned && typeof realmImpact !== 'undefined') {
    realmImpact.mode = '';
    realmImpact.path = null;
   }
  }

  function freeTouchStart(e) {
   if (freeHandled.has(e) || realmTouchAuto() || (e.target && e.target !== oc)) return;
   freeHandled.add(e);
   if (e.cancelable) e.preventDefault();
   if (freeTouchId !== null && (!freeTouch.dragging || !e.touches || ![...e.touches].some(x => x.identifier === freeTouchId))) {
    freeTouchFreeze();
   }
   if (freeTouchId !== null || e.changedTouches.length !== 1) return;
   const t = e.changedTouches[0];
   const m = canvas_coords(t);
   const now = performance.now();
   freeLastTouchAt = now;
   freeTouchId = t.identifier;
   touchid = t.identifier;
   freeLastX = m[0];
   freeLastY = m[1];
   tx = tdx = m[0];
   ty = tdy = m[1];
   touchmode = true;
   moncanvas = true;
   mp = true;

   const isDirect = typeof xlGfxPrefs !== 'undefined' ? !xlGfxPrefs.relative : false;
   freeTouch.begin(paw_x, paw_y, now, {
    minX: paw.left_limit,
    maxX: w + paw.right_limit,
    minY: paw_min_y,
    floorY: floor_y,
    height: h
   }, isDirect);
   if (isDirect) {
    freeTouch.moveDirect(m[0], m[1], now);
    mx = freeTouch.targetX;
    my = freeTouch.targetY / 2;
    paw_dest_y = freeTouch.targetY;
   } else {
    mx = paw_x;
    my = paw_y / 2;
    paw_dest_y = paw_y;
   }
   syncRealmTouch();
  }

  function freeTouchMove(e) {
   if (freeHandled.has(e) || !realmTouchOwns() || !freeTouch.owned || !freeTouch.dragging) return;
   freeHandled.add(e);
   if (e.cancelable) e.preventDefault();
   const now = performance.now();
   freeLastTouchAt = now;
   const sens = typeof xlGfxPrefs !== 'undefined' ? xlGfxPrefs.sensitivity : 1;
   const isDirect = typeof xlGfxPrefs !== 'undefined' ? !xlGfxPrefs.relative : false;
   freeTouch.absolute = isDirect;
   for (const t of e.touches) {
    if (t.identifier !== freeTouchId) continue;
    const m = canvas_coords(t);
    if (freeTouch.absolute) {
     freeTouch.moveDirect(m[0], m[1], now);
    } else {
     freeTouch.moveRelative(m[0] - freeLastX, m[1] - freeLastY, now, sens, paw_y);
    }
    freeLastX = m[0];
    freeLastY = m[1];
    tx = tdx = m[0];
    ty = tdy = m[1];
    mx = freeTouch.targetX;
    touchmode = true;
   }
   syncRealmTouch();
  }

  function freeTouchEnd(e) {
   if (freeHandled.has(e)) return;
   freeHandled.add(e);
   if (e.cancelable) e.preventDefault();
   freeLastTouchAt = performance.now();
   for (const t of e.changedTouches) {
    if (t.identifier === freeTouchId) {
     freeTouchFreeze();
     mr = true;
     break;
    }
   }
  }

  function freeTouchCancel(e) {
   if (freeHandled.has(e)) return;
   freeHandled.add(e);
   if (e.cancelable) e.preventDefault();
   freeLastTouchAt = performance.now();
   freeTouchFreeze();
  }

  // Remove legacy RealmTouchVertical listeners registered via addEventListener before installing ours.
  const legacyCancel = oc.ontouchcancel;
  for (const target of [oc, ocd]) {
   if (typeof realmTouchStart === 'function') target.removeEventListener('touchstart', realmTouchStart);
   if (typeof realmTouchMove === 'function') target.removeEventListener('touchmove', realmTouchMove);
   if (typeof realmTouchEnd === 'function') target.removeEventListener('touchend', realmTouchEnd);
   if (typeof legacyCancel === 'function') target.removeEventListener('touchcancel', legacyCancel);
  }

  oc.ontouchstart = ocd.ontouchstart = freeTouchStart;
  oc.ontouchmove = ocd.ontouchmove = freeTouchMove;
  oc.ontouchend = ocd.ontouchend = freeTouchEnd;
  oc.ontouchcancel = ocd.ontouchcancel = freeTouchCancel;
  for (const target of [oc, ocd]) {
   for (const [type, handler] of [
    ['touchstart', freeTouchStart],
    ['touchmove', freeTouchMove],
    ['touchend', freeTouchEnd],
    ['touchcancel', freeTouchCancel]
   ]) {
    target.addEventListener(type, handler, { passive: false });
   }
  }

  // Guard ghost mouse events generated right after touch interaction.
  const prevMouseMove = onmousemove;
  const prevMouseDown = oc.onmousedown;
  const recentTouch = () => performance.now() - freeLastTouchAt < 500;
  onmousemove = e => {
   if (e.sourceCapabilities?.firesTouchEvents || (!(e.buttons > 0) && recentTouch())) return;
   if (e.target === oc) freeTouchDisown('mousemove');
   return prevMouseMove ? prevMouseMove(e) : undefined;
  };
  oc.onmousedown = e => {
   if (!e.sourceCapabilities?.firesTouchEvents && !(performance.now() - freeLastTouchAt < 120)) {
    freeTouchDisown('mousedown');
   }
   return prevMouseDown ? prevMouseDown(e) : undefined;
  };

  if (typeof realmTouchFreeze === 'function') window.removeEventListener('blur', realmTouchFreeze);
  window.addEventListener('blur', freeTouchFreeze);
  document.addEventListener('visibilitychange', () => {
   if (document.hidden) freeTouchFreeze();
  });

  // Delegate legacy realmTouch methods so base update_paw() and downstream callers stay synced.
  const origStep = realmTouch.step.bind(realmTouch);
  realmTouch.step = function (dt, y, minY, floorY, height) {
   if (freeTouch.owned) {
    const sens = typeof xlGfxPrefs !== 'undefined' ? xlGfxPrefs.sensitivity : 1;
    const dest = freeTouch.stepY(dt, y, minY, floorY, height, sens);
    syncRealmTouch();
    return dest;
   }
   return origStep(dt, y, minY, floorY, height);
  };
  const origLanding = realmTouch.landing.bind(realmTouch);
  realmTouch.landing = function (speed) {
   freeTouch.landing(speed);
   origLanding(speed);
   syncRealmTouch();
  };
  const origHold = realmTouch.hold.bind(realmTouch);
  realmTouch.hold = function (y) {
   freeTouch.hold(paw_x, y);
   freeTouchId = null;
   origHold(y);
   syncRealmTouch();
  };
  const origDisown = realmTouch.disown.bind(realmTouch);
  realmTouch.disown = function (reason) {
   freeTouch.disown(reason);
   freeTouchId = null;
   origDisown(reason);
   syncRealmTouch();
  };

  // Override horizontal tracking in update_paw() without triggering duplicate kick_bugs.
  let directKickGuard = false;
  const origKickBugs = kick_bugs;
  kick_bugs = function (dx) {
   if (directKickGuard) return;
   return origKickBugs(dx);
  };
  const origUpdatePaw = update_paw;
  update_paw = function () {
   const activeFreeTouch = freeTouch.owned && realmTouchOwns() && !pause && !tr && active && !exhausted && !finished;
   const prevX = paw_x;
   directKickGuard = activeFreeTouch;
   try {
    origUpdatePaw();
   } finally {
    directKickGuard = false;
   }
   if (!activeFreeTouch) return;
   const sens = typeof xlGfxPrefs !== 'undefined' ? xlGfxPrefs.sensitivity : 1;
   const nextX = freeTouch.stepX(delta, prevX, paw.left_limit, w + paw.right_limit, paw_state === 3, pressure, sens);
   const dx = nextX - prevX;
   if (freeTouch.freshTap) {
    freeTouch.freshTap = false;
    paw_x = nextX;
    paw_dest_x = nextX;
    return;
   }
   if (dx && !paw.steamroller && freeTouch.dragging) {
    origKickBugs(FreeTouchController.clamp(dx, -14, 14));
   }
   paw_x_diff += nextX - paw_x;
   paw_x = nextX;
   paw_dest_x = freeTouch.targetX;
   if (paw_state === 3 && paw_slide_track) {
    const vx = dx / Math.max(0.001, delta);
    setsoundvolume(paw_slide_track, (Math.abs(paw_x_diff) > 0.1) * clamp(Math.abs(vx / 1600), 0, 0.6));
   }
  };

  window.realmTouchProbe = () => ({
   ...freeTouch.snapshot(),
   actualY: paw_y,
   footState: paw_state,
   actualPressure: pressure,
   stomp: stomp_size,
   x: paw_x
  });
  window.freeTouchDebug = () => ({
   mode: (typeof xlGfxPrefs !== 'undefined' && !xlGfxPrefs.relative) ? 'absolute' : 'relative',
   sensitivity: typeof xlGfxPrefs !== 'undefined' ? xlGfxPrefs.sensitivity : 1,
   ...freeTouch.snapshot(),
   actualX: paw_x,
   actualY: paw_y,
   footState: paw_state,
   actualPressure: pressure
  });
 })();
}
