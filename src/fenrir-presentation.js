/* Fenrir-specific presentation, installed inside its game iframe. */
(function installFenrirPresentation() {
 const shell = document.getElementById('xl-shell');
 if (!fenrirCity || !shell) return;

 const key = 'cunjie-fenrir-render-quality';
 const modes = new Map([
  ['auto', '自动（优先流畅）'],
  ['hd', '高清 · 1080p'],
  ['classic', '经典 · 400 × 240'],
 ]);
 let selected = 'auto';
 try {
  const saved = localStorage.getItem(key);
  if (modes.has(saved)) selected = saved;
 } catch {
  // Private and offline contexts can still change quality for the current session.
 }
 quality.setFenrirMode?.(selected);

 shell.classList.add('fn-observation');
 document.title = '芬里尔 · 雨夜猎场';
 oc.setAttribute('aria-label', '芬里尔雨夜猎场游戏画面');

 const style = document.createElement('style');
 style.textContent = `
.fn-observation {
 --fn-ink:#06111b;
 --fn-panel:#0b1926;
 --fn-line:#2d4d63;
 --fn-ice:#a7dae5;
 --fn-gold:#f3c66c;
 background:var(--fn-ink);
}
#xl-shell.fn-observation #outcanvasd{outline:1px solid var(--fn-line);outline-offset:-1px}
#xl-shell.fn-observation #fn-entry {
 position:absolute;inset:0;z-index:10;display:flex;align-items:flex-end;
 padding:clamp(10px,3.5vw,32px);padding-bottom:clamp(58px,11vh,104px);
 background:linear-gradient(90deg,#06111be8,#06111b00 78%);pointer-events:none;
}
#xl-shell.fn-observation #fn-entry h1 {
 margin:0 0 8px;color:#edf7fb;font-size:clamp(20px,4vw,42px);
 font-weight:750;letter-spacing:.07em;line-height:1.15;
}
#xl-shell.fn-observation #fn-enter-button {
 pointer-events:auto;min-height:44px;padding:8px 16px;border:1px solid #5e879d;
 border-radius:3px;background:#153248;color:#eaf8fc;font-weight:700;font-size:14px;
}
#xl-shell.fn-observation.fn-portrait #fn-entry{padding-bottom:clamp(12px,3vh,26px)}
#xl-shell.fn-observation #xl-hud {
 right:8px;left:auto;top:max(8px,calc(50px - (100dvh - min(100dvh,60vw))/2));
 min-width:0;width:clamp(154px,28%,224px);max-width:46%;
 border:1px solid var(--fn-line);border-top:2px solid var(--fn-ice);
 border-radius:2px;background:var(--fn-panel);box-shadow:none;
 padding:7px 9px;color:#d4e8ee;font-variant-numeric:tabular-nums;
}
#xl-shell.fn-observation #xl-stage-name{color:#ecf6f9;letter-spacing:.03em}
#xl-shell.fn-observation #fn-scale{display:block;color:var(--fn-ice);font:600 9px/1.3 ui-monospace,monospace;letter-spacing:.09em}
#xl-shell.fn-observation #fn-thrill-track{height:4px;border:0;border-radius:0;background:#233845}
#xl-shell.fn-observation #fn-thrill-fill{background:#65c8d7;box-shadow:none}
#xl-shell.fn-observation #fn-thrill-fill.ready{background:var(--fn-gold)}
#xl-shell.fn-observation #xl-bubble {
 left:8px;right:auto;top:8px;width:min(280px,45%);max-width:45%;
 border:1px solid var(--fn-line);border-left:2px solid var(--fn-ice);
 border-radius:2px;background:var(--fn-panel);box-shadow:none;color:#e4eff3;
}
#xl-shell.fn-observation #xl-bubble.overdrive-voice{border-left-color:var(--fn-gold)}
#xl-shell.fn-observation #xl-toolbar button,
#xl-shell.fn-observation #fn-thumb-pad button {
 border:1px solid var(--fn-line);border-radius:3px;
 background:var(--fn-panel);color:#e3f1f5;backdrop-filter:none;box-shadow:none;
}
#xl-shell.fn-observation #fn-thumb-pad button[data-act="press"]{color:var(--fn-gold)}
#xl-shell.fn-observation #fn-dock,
#xl-shell.fn-observation #xl-drawer,
#xl-shell.fn-observation #fn-result-card {
 border:1px solid var(--fn-line);border-top:2px solid var(--fn-ice);
 border-radius:3px;background:var(--fn-panel);box-shadow:none;backdrop-filter:none;
}
#xl-shell.fn-observation #fn-result{background:#06111bdf}
#xl-shell.fn-observation #fn-result-card h2{color:#ecf6f9}
#xl-shell.fn-observation #fn-result-actions button{border-radius:3px;background:#172d3e;border-color:var(--fn-line)}
#xl-shell.fn-observation #fn-result-actions button.primary{color:var(--fn-gold);border-color:#8d713c}
#xl-shell.fn-observation #fn-render-label{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 12px;color:#d4e8ee}
#xl-shell.fn-observation #fn-render-quality{min-height:36px;color:#f2f7fa;background:#132839;border:1px solid var(--fn-line);border-radius:3px;padding:5px 8px}
#xl-shell.fn-observation.fn-portrait #fn-scale{grid-column:1 / -1}
#xl-shell.fn-observation.fn-portrait #xl-stage-name + span{grid-column:2;text-align:right;color:var(--fn-ice)}
#xl-shell.fn-observation.fn-portrait #xl-hud,
#xl-shell.fn-observation.fn-portrait #xl-bubble{max-width:none}
@media (max-height:460px) and (orientation:landscape){
 #xl-shell.fn-observation #xl-hud{padding:4px 7px}
 #xl-shell.fn-observation #xl-bubble{padding:5px 8px}
}
 `;
 document.head.appendChild(style);

 const stageName = document.getElementById('xl-stage-name');
 if (stageName) {
  const scale = document.createElement('span');
  scale.id = 'fn-scale';
  scale.textContent = 'FENRIR / 30 M';
  stageName.before(scale);
 }

 const stage = document.getElementById('outcanvasd');
 if (stage && !active) {
  const entry = document.createElement('section');
  entry.id = 'fn-entry';
  const card = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = '雨夜猎场';
  const enter = document.createElement('button');
  enter.id = 'fn-enter-button';
  enter.type = 'button';
  enter.textContent = '进入猎场';
  enter.addEventListener('click', () => {
   active = true;
   activated = true;
   oc.focus({preventScroll: true});
  });
  card.append(title, enter);
  entry.appendChild(card);
  stage.appendChild(entry);
  intro_screen = () => {};
  const drawStage = draw;
  draw = function () {
   if (active) {
    entry.remove();
    draw = drawStage;
   }
   return drawStage.apply(this, arguments);
  };
 }

 const settingsPanel = document.getElementById('xl-settings-panel');
 if (!settingsPanel || !quality.setFenrirMode) return;
 const label = document.createElement('label');
 label.id = 'fn-render-label';
 label.textContent = '芬里尔画质';
 const select = document.createElement('select');
 select.id = 'fn-render-quality';
 for (const [value, title] of modes) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = title;
  select.appendChild(option);
 }
 select.value = selected;
 select.addEventListener('change', () => {
  quality.setFenrirMode(select.value);
  try { localStorage.setItem(key, select.value); } catch {}
 });
 label.appendChild(select);
 settingsPanel.querySelector('h2')?.after(label);
})();
