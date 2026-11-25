(function (root) {
 'use strict';

 const heights = {hd: 1080, qhd: 1440};
 const valid = new Set(['classic', 'auto', ...Object.keys(heights)]);
 const normalize = value => valid.has(value) ? value : 'hd';
 const minimumScale = 1.5;
 let mode = 'hd';

 function sceneSize(width, height, selected, cssWidth, dpr, autoLimit = 1080) {
  if (selected === 'classic') {
   return {width, height, displayWidth: width * 2, displayHeight: height * 2};
  }
  const autoHeight = Math.round((cssWidth || width * 2) * dpr * height / width / 60) * 60;
  const targetHeight = heights[selected] ||
   Math.max(Math.min(autoLimit, Math.ceil(height * minimumScale)), Math.min(autoLimit, autoHeight));
  const targetWidth = Math.round(targetHeight * width / height);
  return {width: targetWidth, height: targetHeight, displayWidth: targetWidth, displayHeight: targetHeight};
 }

 function create(scene, display, graphics, width, height, classicOnly) {
  const view = display.ownerDocument.defaultView;
  let activeMode, cssWidth = 0, lastDpr = 0, dirty = true;
  let autoLimit = 1080, sampleStart = 0, frames = 0, fastSamples = 0;
  if (typeof view.ResizeObserver === 'function') {
   const observer = new view.ResizeObserver(entries => {
    cssWidth = entries[0].contentRect.width;
    dirty = true;
   });
   observer.observe(display);
  } else {
   view.addEventListener('resize', () => { cssWidth = 0; dirty = true; });
  }

  const settings = {
   smooth: false,
   displayScaleX: 2,
   displayScaleY: 2,
   frame(now) {
    const selected = classicOnly ? 'classic' : mode;
    const dpr = view.devicePixelRatio || 1;
    if (selected !== activeMode || dpr !== lastDpr) {
     activeMode = selected;
     lastDpr = dpr;
     autoLimit = 1080;
     sampleStart = now;
     frames = fastSamples = 0;
     dirty = true;
    }

    if (selected === 'auto' && !display.ownerDocument.hidden) {
     frames++;
     const elapsed = now - sampleStart;
     if (elapsed >= 2400) {
      const fps = frames * 1000 / elapsed;
      fastSamples = fps >= 52 ? fastSamples + 1 : 0;
      if (fps < 38 && scene.height > height * minimumScale) {
       autoLimit = Math.max(Math.ceil(height * minimumScale), Math.floor(scene.height * .77 / 60) * 60);
       dirty = true;
      } else if (fastSamples >= 3 && autoLimit < 1080) {
       autoLimit = Math.min(1080, autoLimit + 120);
       fastSamples = 0;
       dirty = true;
      }
      sampleStart = now;
      frames = 0;
     }
    }
    if (!dirty) return;
    dirty = false;
    const size = sceneSize(width, height, selected, cssWidth || display.clientWidth, dpr, autoLimit);
    if (scene.width !== size.width) scene.width = size.width;
    if (scene.height !== size.height) scene.height = size.height;
    if (display.width !== size.displayWidth) display.width = size.displayWidth;
    if (display.height !== size.displayHeight) display.height = size.displayHeight;
    graphics?.viewport(0, 0, scene.width, scene.height);

    settings.smooth = selected !== 'classic';
    settings.displayScaleX = display.width / width;
    settings.displayScaleY = display.height / height;
    display.style.imageRendering = settings.smooth ? 'auto' : 'pixelated';
    display.dataset.renderResolution = scene.width + '×' + scene.height;
    display.dataset.renderQuality = selected;
   }
  };
  return settings;
 }

 root.CunjieRenderQuality = {
  normalize, create, sceneSize,
  setMode(value) { mode = normalize(value); }
 };
})(globalThis);
