/* Project Cunjie v6.0 — Persistent Shoe / Sock / Paw / Character Skin Pack Manager.
 * Supports 1024x1024 PNG/WebP atlases and .zip packs (manifest.json + atlas or 11 HD frames 0..10 + optional bg).
 * Zero external dependencies; works in HTTP and standalone file:// offline HTML via IndexedDB + DecompressionStream.
 */
(function (root) {
 'use strict';

 const DB_NAME = 'cunjie-skin-packs-v1';
 const STORE = 'packs';
 const ACTIVE_KEY = 'cunjie-active-packs-v1';
 const VALID_SLOTS = ['shoe', 'socks', 'paws', 'character'];
 const SLOT_LABELS = { shoe: '一幕 · 球鞋', socks: '二幕 · 袜子', paws: '三幕 · 裸爪', character: '自由 · 角色' };

 let memPacks = [];
 let dbPromise = null;

 function openDB() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbPromise = new Promise(resolve => {
   try {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
     const db = req.result;
     if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
   } catch { resolve(null); }
  });
  return dbPromise;
 }

 async function listPacks() {
  const db = await openDB();
  if (!db) return memPacks.slice();
  return new Promise(resolve => {
   try {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
     const rows = (req.result || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
     memPacks = rows;
     resolve(rows);
    };
    req.onerror = () => resolve(memPacks.slice());
   } catch { resolve(memPacks.slice()); }
  });
 }

 async function savePack(pack) {
  memPacks = [pack, ...memPacks.filter(p => p.id !== pack.id)];
  const db = await openDB();
  if (!db) return pack;
  return new Promise((resolve, reject) => {
   try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(pack);
    tx.oncomplete = () => resolve(pack);
    tx.onerror = () => reject(tx.error || Error('保存装扮包失败'));
   } catch (e) { reject(e); }
  });
 }

 async function deletePack(id) {
  memPacks = memPacks.filter(p => p.id !== id);
  const active = getActiveIds();
  let changed = false;
  for (const s of ['shoe', 'socks', 'paws']) {
   if (active[s] === id) { active[s] = null; changed = true; }
  }
  if (changed) setActiveIds(active);
  const db = await openDB();
  if (!db) return;
  return new Promise(resolve => {
   try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
   } catch { resolve(); }
  });
 }

 function getActiveIds() {
  try {
   const raw = JSON.parse(localStorage.getItem(ACTIVE_KEY) || '{}');
   return { shoe: raw.shoe || null, socks: raw.socks || null, paws: raw.paws || null };
  } catch { return { shoe: null, socks: null, paws: null }; }
 }

 function setActiveIds(next) {
  const clean = { shoe: next.shoe || null, socks: next.socks || null, paws: next.paws || null };
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(clean)); } catch {}
  return clean;
 }

 function setSlotActive(slot, id) {
  if (!['shoe', 'socks', 'paws'].includes(slot)) return getActiveIds();
  const cur = getActiveIds();
  cur[slot] = id || null;
  return setActiveIds(cur);
 }

 function bytesToDataUrl(bytes, mime) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
   bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
 }

 function guessMime(name) {
  const low = (name || '').toLowerCase();
  if (low.endsWith('.webp')) return 'image/webp';
  if (low.endsWith('.jpg') || low.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
 }

 function loadImage(url) {
  return new Promise((resolve, reject) => {
   const im = new Image();
   im.onload = () => resolve(im);
   im.onerror = () => reject(Error('无法解析图片素材'));
   im.src = url;
  });
 }

 async function inflateRaw(data) {
  if (typeof DecompressionStream !== 'function') {
   throw Error('当前浏览器不支持解压压缩型 ZIP，请使用无压缩（Stored）ZIP 或直接导入 1024×1024 PNG');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
 }

 async function parseZip(buffer) {
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
   if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw Error('不是有效的 ZIP 文件');
  const total = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8');
  const files = new Map();
  for (let n = 0; n < total; n++) {
   if (dv.getUint32(off, true) !== 0x02014b50) break;
   const method = dv.getUint16(off + 10, true);
   const compSize = dv.getUint32(off + 20, true);
   const nameLen = dv.getUint16(off + 28, true);
   const extraLen = dv.getUint16(off + 30, true);
   const commentLen = dv.getUint16(off + 32, true);
   const localOff = dv.getUint32(off + 42, true);
   const rawName = dec.decode(u8.subarray(off + 46, off + 46 + nameLen)).replace(/\\/g, '/');
   off += 46 + nameLen + extraLen + commentLen;
   if (rawName.endsWith('/')) continue;
   const lNameLen = dv.getUint16(localOff + 26, true);
   const lExtraLen = dv.getUint16(localOff + 28, true);
   const dataStart = localOff + 30 + lNameLen + lExtraLen;
   const slice = u8.subarray(dataStart, dataStart + compSize);
   let out;
   if (method === 0) out = slice.slice();
   else if (method === 8) out = await inflateRaw(slice);
   else throw Error('不支持的 ZIP 压缩方式: ' + method);
   files.set(rawName, out);
  }
  return files;
 }

 function scanPixels(data, w, h, fallbackOff, fallbackContact) {
  let maxY = -1;
  for (let y = h - 1; y >= 0 && maxY < 0; y--) {
   const row = y * w * 4;
   for (let x = 0; x < w; x++) { if (data[row + x * 4 + 3] > 20) { maxY = y; break; } }
  }
  if (maxY < 0) return { off: fallbackOff, contact: fallbackContact, mask: null };
  let minX = w, maxX = -1;
  const band = Math.max(1, Math.round(12 * (h / 256)));
  for (let y = Math.max(0, maxY - band); y <= maxY; y++) {
   const row = y * w * 4;
   for (let x = 0; x < w; x++) {
    if (data[row + x * 4 + 3] > 20) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
   }
  }
  const cx = maxX >= minX ? ((minX + maxX) / 2) / w : fallbackContact[0];
  const hw = maxX >= minX ? Math.max(0.08, ((maxX - minX) / 2) / w) : fallbackContact[1];
  const padLogical = Math.round(((h - 1) - maxY) / (h / 256));
  const maskBand = Math.max(1, Math.round(24 * (h / 256)));
  const mask = Array.from({ length: 160 }, (_, mx) => {
   const sx = Math.min(w - 1, Math.floor(mx * (w / 160)));
   for (let y = Math.max(0, h - maskBand); y < h; y++) {
    if (data[(y * w + sx) * 4 + 3] >= 128) return 1;
   }
   return 0;
  });
  return { off: padLogical + 1, contact: [+cx.toFixed(2), +hw.toFixed(2)], mask: mask.some(Boolean) ? mask : null };
 }

 function calibrateAtlasImage(img) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1024;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, 1024, 1024);
  const front = [0, 1, 2, 3, 4, 5].map(idx => {
   const d = ctx.getImageData(Math.floor(idx / 3) * 160, (idx % 3) * 256, 160, 256).data;
   return scanPixels(d, 160, 256, 2, [0.48, 0.36]);
  });
  const back = [0, 1, 2, 3, 4].map(idx => {
   const d = ctx.getImageData(320 + Math.floor(idx / 3) * 160, (idx % 3) * 256, 160, 256).data;
   return scanPixels(d, 160, 256, 2, [0.46, 0.34]);
  });
  const thumb = document.createElement('canvas');
  thumb.width = 96; thumb.height = 84;
  thumb.getContext('2d').drawImage(cv, 160, 106, 160, 150, 0, 0, 96, 84);
  const masks = [3, 4, 5].map(i => front[i].mask || Array(160).fill(1));
  return {
   geo: {
    frontOffsets: front.map(f => f.off),
    backOffsets: back.map(b => b.off),
    frontContact: front.map(f => f.contact),
    backContact: back.map(b => b.contact),
   },
   masks,
   previewUrl: thumb.toDataURL('image/png'),
  };
 }

 function calibrateHdImages(imgs) {
  const cv = document.createElement('canvas');
  cv.width = 160; cv.height = 256;
  const ctx = cv.getContext('2d');
  const scanned = imgs.map(im => {
   ctx.clearRect(0, 0, 160, 256);
   ctx.drawImage(im, 0, 0, 160, 256);
   return scanPixels(ctx.getImageData(0, 0, 160, 256).data, 160, 256, 2, [0.48, 0.36]);
  });
  const thumb = document.createElement('canvas');
  thumb.width = 96; thumb.height = 84;
  const f3 = imgs[3] || imgs[0];
  thumb.getContext('2d').drawImage(f3, 0, Math.round(f3.naturalHeight * 0.42), f3.naturalWidth, Math.round(f3.naturalHeight * 0.58), 0, 0, 96, 84);
  const masks = [3, 4, 5].map(i => scanned[i].mask || Array(160).fill(1));
  return {
   geo: {
    frontOffsets: scanned.slice(0, 6).map(f => f.off),
    backOffsets: scanned.slice(6, 11).map(b => b.off),
    frontContact: scanned.slice(0, 6).map(f => f.contact),
    backContact: scanned.slice(6, 11).map(b => b.contact),
   },
   masks,
   previewUrl: thumb.toDataURL('image/png'),
  };
 }

 async function importImageFile(file, slot, customName) {
  if (!VALID_SLOTS.includes(slot)) throw Error('无效的装扮槽位');
  const buf = await file.arrayBuffer();
  const dataUrl = bytesToDataUrl(new Uint8Array(buf), guessMime(file.name));
  const img = await loadImage(dataUrl);
  if (img.naturalWidth !== 1024 || img.naturalHeight !== 1024) {
   throw Error(`单张图集需要 1024 × 1024 像素（当前为 ${img.naturalWidth} × ${img.naturalHeight}）`);
  }
  const cal = calibrateAtlasImage(img);
  const baseName = (customName || file.name.replace(/\.[^.]+$/, '') || '自定义装扮').trim().slice(0, 28);
  const pack = {
   id: 'pack_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
   name: baseName,
   slot,
   format: 'atlas',
   atlasDataUrl: dataUrl,
   hdFrames: null,
   bgDataUrl: null,
   warmLight: null,
   previewUrl: cal.previewUrl,
   geo: cal.geo,
   masks: cal.masks,
   createdAt: new Date().toISOString(),
  };
  return savePack(pack);
 }

 async function importZipFile(file, fallbackSlot, fallbackName) {
  const files = await parseZip(await file.arrayBuffer());
  const findFile = (suffix) => {
   const target = suffix.toLowerCase();
   for (const [k, v] of files.entries()) {
    if (k.toLowerCase() === target || k.toLowerCase().endsWith('/' + target)) return { name: k, bytes: v };
   }
   return null;
  };
  const manEntry = findFile('manifest.json');
  const manifest = manEntry ? JSON.parse(new TextDecoder('utf-8').decode(manEntry.bytes)) : {};
  const slot = VALID_SLOTS.includes(manifest.slot) ? manifest.slot : (VALID_SLOTS.includes(fallbackSlot) ? fallbackSlot : 'shoe');
  const name = String(manifest.name || fallbackName || file.name.replace(/\.zip$/i, '') || '自定义皮肤包').trim().slice(0, 28);

  let bgDataUrl = null;
  if (manifest.background) {
   const bgF = findFile(manifest.background);
   if (bgF) bgDataUrl = bytesToDataUrl(bgF.bytes, guessMime(bgF.name));
  } else {
   const bgAuto = findFile('bg.webp') || findFile('bg.png') || findFile('background.webp') || findFile('background.png');
   if (bgAuto) bgDataUrl = bytesToDataUrl(bgAuto.bytes, guessMime(bgAuto.name));
  }

  // Try 11 HD frames first (manifest.frames or 0..10.webp / 0..10.png)
  const frameNames = Array.isArray(manifest.frames) && manifest.frames.length === 11
   ? manifest.frames
   : Array.from({ length: 11 }, (_, i) => `${i}.webp`);
  const hdEntries = frameNames.map((fn, i) => findFile(fn) || findFile(`${i}.png`));
  if (hdEntries.every(Boolean)) {
   const hdUrls = hdEntries.map(e => bytesToDataUrl(e.bytes, guessMime(e.name)));
   const imgs = await Promise.all(hdUrls.map(loadImage));
   const cal = calibrateHdImages(imgs);
   const pack = {
    id: 'pack_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    slot,
    format: 'hd11',
    atlasDataUrl: null,
    hdFrames: hdUrls,
    bgDataUrl,
    warmLight: typeof manifest.warmLight === 'boolean' ? manifest.warmLight : null,
    previewUrl: cal.previewUrl,
    geo: manifest.geo || cal.geo,
    masks: manifest.masks || cal.masks,
    createdAt: new Date().toISOString(),
   };
   return savePack(pack);
  }

  // Fallback to 1024x1024 atlas inside ZIP
  const atlasEntry = (manifest.atlas && findFile(manifest.atlas)) || findFile('atlas.png') || findFile('atlas.webp') || [...files.entries()].map(([k, v]) => ({ name: k, bytes: v })).find(e => /\.(png|webp)$/i.test(e.name));
  if (!atlasEntry) throw Error('ZIP 包内未找到 11 帧 (0..10.webp/png) 或 1024×1024 图集');
  const atlasUrl = bytesToDataUrl(atlasEntry.bytes, guessMime(atlasEntry.name));
  const img = await loadImage(atlasUrl);
  if (img.naturalWidth !== 1024 || img.naturalHeight !== 1024) {
   throw Error(`ZIP 内图集需要 1024 × 1024 像素（当前为 ${img.naturalWidth} × ${img.naturalHeight}）`);
  }
  const cal = calibrateAtlasImage(img);
  const pack = {
   id: 'pack_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
   name,
   slot,
   format: 'atlas',
   atlasDataUrl: atlasUrl,
   hdFrames: null,
   bgDataUrl,
   warmLight: typeof manifest.warmLight === 'boolean' ? manifest.warmLight : null,
   previewUrl: cal.previewUrl,
   geo: manifest.geo || cal.geo,
   masks: manifest.masks || cal.masks,
   createdAt: new Date().toISOString(),
  };
  return savePack(pack);
 }

 async function getRuntimeOverrides() {
  const packs = await listPacks();
  const active = getActiveIds();
  const byId = new Map(packs.map(p => [p.id, p]));
  const out = {};
  for (const slot of ['shoe', 'socks', 'paws']) {
   const p = active[slot] ? byId.get(active[slot]) : null;
   if (p && p.slot === slot) out[slot] = p;
  }
  return out;
 }

 function openManager({ panel, btn, toast, onChanged, onPlayCharacter, onClose }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;gap:12px;';

  const intro = document.createElement('p');
  intro.className = 'v581-note';
  intro.textContent = '支持导入标准 1024×1024 图集（PNG/WebP）或含 11 张高清分帧（0.webp~10.webp）的 .zip 皮肤包。导入后会自动扫描鞋底轮廓校准接地与碰撞，并持久保存在本地浏览器中。';
  wrap.append(intro);

  const form = document.createElement('div');
  form.style.cssText = 'display:grid;gap:8px;padding:12px;background:#162932;border:1px solid #4d736e;border-radius:10px;';
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
  const nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.placeholder = '装扮名称（留空自动取文件名）';
  nameIn.style.cssText = 'flex:1;min-width:150px;padding:8px 10px;background:#0e1d24;color:#edf5ef;border:1px solid #597c76;border-radius:8px;';
  const slotSel = document.createElement('select');
  slotSel.style.cssText = 'padding:8px 10px;background:#0e1d24;color:#edf5ef;border:1px solid #597c76;border-radius:8px;';
  for (const s of VALID_SLOTS) {
   const opt = document.createElement('option');
   opt.value = s; opt.textContent = SLOT_LABELS[s];
   slotSel.append(opt);
  }
  row1.append(nameIn, slotSel);

  const fileIn = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = '.zip,image/png,image/webp';
  fileIn.style.cssText = 'width:100%;padding:10px;background:#10222b;color:#cfe3dc;border:1px dashed #6ca198;border-radius:8px;';

  const importBtn = btn('导入并自动校准保存', async () => {
   const f = fileIn.files && fileIn.files[0];
   if (!f) { toast('请先选择 .zip 皮肤包或 1024×1024 图片'); return; }
   importBtn.disabled = true;
   try {
    const pack = f.name.toLowerCase().endsWith('.zip')
     ? await importZipFile(f, slotSel.value, nameIn.value)
     : await importImageFile(f, slotSel.value, nameIn.value);
    if (['shoe', 'socks', 'paws'].includes(pack.slot)) setSlotActive(pack.slot, pack.id);
    nameIn.value = ''; fileIn.value = '';
    toast(`已保存「${pack.name}」（${pack.format === 'hd11' ? '高清 11 帧' : '标准图集'}）`);
    await renderList();
    if (onChanged) await onChanged();
   } catch (e) {
    toast('导入失败：' + (e?.message || e));
   } finally {
    importBtn.disabled = false;
   }
  }, true);

  form.append(row1, fileIn, importBtn);
  wrap.append(form);

  const listBox = document.createElement('div');
  listBox.style.cssText = 'display:grid;gap:8px;';
  wrap.append(listBox);

  async function renderList() {
   const packs = await listPacks();
   const active = getActiveIds();
   listBox.replaceChildren();
   if (!packs.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:#95b3ad;font-size:13px;margin:4px 0;';
    empty.textContent = '暂无已保存的自定义装扮或角色包。上方选择文件即可导入。';
    listBox.append(empty);
    return;
   }
   for (const p of packs) {
    const card = document.createElement('div');
    const isOn = ['shoe', 'socks', 'paws'].includes(p.slot) && active[p.slot] === p.id;
    card.style.cssText = `display:flex;gap:10px;align-items:center;padding:10px;border-radius:10px;background:#14252e;border:1px solid ${isOn ? '#8fd4c4' : '#3f5f5c'};`;
    const img = document.createElement('img');
    img.src = p.previewUrl || p.atlasDataUrl || (p.hdFrames && p.hdFrames[3]) || '';
    img.alt = p.name;
    img.style.cssText = 'width:56px;height:49px;object-fit:contain;background:#0a151b;border-radius:6px;flex:none;';
    const meta = document.createElement('div');
    meta.style.cssText = 'flex:1;min-width:0;';
    const title = document.createElement('strong');
    title.style.cssText = 'display:block;color:#eef5ef;font-size:14px;';
    title.textContent = p.name + (isOn ? ' · 已启用' : '');
    const sub = document.createElement('small');
    sub.style.cssText = 'color:#9cbdb7;font-size:11px;';
    sub.textContent = `${SLOT_LABELS[p.slot] || p.slot} · ${p.format === 'hd11' ? '高清 11 帧' : '1024×1024 图集'}${p.bgDataUrl ? ' · 含场景图' : ''}`;
    meta.append(title, sub);
    const acts = document.createElement('div');
    acts.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    if (p.slot === 'character') {
     acts.append(btn('试玩', () => { if (onPlayCharacter) onPlayCharacter(p); }, true));
    } else {
     acts.append(btn(isOn ? '停用' : '启用', async () => {
      setSlotActive(p.slot, isOn ? null : p.id);
      await renderList();
      if (onChanged) await onChanged();
      toast(isOn ? `已切回默认${SLOT_LABELS[p.slot]}` : `已启用「${p.name}」· 下一局生效`);
     }, !isOn));
    }
    acts.append(btn('删除', async () => {
     await deletePack(p.id);
     await renderList();
     if (onChanged) await onChanged();
     toast(`已删除「${p.name}」`);
    }));
    card.append(img, meta, acts);
    listBox.append(card);
   }
  }

  void renderList();
  panel('装扮与角色皮肤包管理', wrap, [btn('完成关闭', () => { if (onClose) onClose(); }, true)]);
 }

 root.CunjieSkinPacks = {
  VALID_SLOTS, SLOT_LABELS,
  listPacks, savePack, deletePack,
  getActiveIds, setSlotActive, getRuntimeOverrides,
  parseZip, importImageFile, importZipFile,
  openManager,
 };
 if (typeof module !== 'undefined') module.exports = root.CunjieSkinPacks;
})(globalThis);
