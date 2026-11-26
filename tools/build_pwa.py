"""Generate PWA icons, manifest.webmanifest, scripts/pwa.js, and two-tier Service Worker (sw.js)."""
import argparse
import hashlib
import json
import math
import os
import shutil
import struct
import subprocess
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

CORE_PREFIXES = ("scripts/", "assets/icons/")
CORE_EXACT = {
    "data/00-init.js",
    "data/01-stages.js",
    "data/02-lines.js",
    "data/03-original.js",
    "data/04-images-boot.js",
    "data/05-audio.js",
    "data/08-visualConfig.js",
    "data/09-fever.js",
    "data/10-tinyVoices.js",
    "data/11-reactiveGiant.js",
    "data/12-responses.js",
    "assets/fenrir/city-far.svg",
    "assets/fenrir/city-mid.svg",
    "assets/fenrir/city-near.svg",
}


def encode_png_rgba(width, height, rgba_rows):
    """Encode packed RGBA rows into a standard PNG using Python stdlib only."""
    def chunk(tag, payload):
        crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    raw = bytearray()
    for row in rgba_rows:
        raw.append(0)
        raw.extend(row)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), level=6)
    return b"".join([
        b"\x89PNG\r\n\x1a\n",
        chunk(b"IHDR", ihdr),
        chunk(b"IDAT", idat),
        chunk(b"IEND", b""),
    ])


def clamp_u8(v):
    return 0 if v < 0 else (255 if v > 255 else int(v + 0.5))


def blend_pixel(buf, x, y, w, h, r, g, b, a):
    if x < 0 or y < 0 or x >= w or y >= h or a <= 0:
        return
    idx = (y * w + x) * 4
    alpha = min(1.0, a / 255.0)
    inv = 1.0 - alpha
    buf[idx] = clamp_u8(buf[idx] * inv + r * alpha)
    buf[idx + 1] = clamp_u8(buf[idx + 1] * inv + g * alpha)
    buf[idx + 2] = clamp_u8(buf[idx + 2] * inv + b * alpha)
    buf[idx + 3] = 255


def point_to_segment_dist(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy
    if l2 <= 1e-9:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def draw_thick_line(buf, size, x1, y1, x2, y2, thickness, rgba):
    pad = int(math.ceil(thickness + 2))
    minx = max(0, int(min(x1, x2)) - pad)
    maxx = min(size - 1, int(max(x1, x2)) + pad)
    miny = max(0, int(min(y1, y2)) - pad)
    maxy = min(size - 1, int(max(y1, y2)) + pad)
    r, g, b, a = rgba
    half = thickness * 0.5
    for py in range(miny, maxy + 1):
        for px in range(minx, maxx + 1):
            d = point_to_segment_dist(px + 0.5, py + 0.5, x1, y1, x2, y2)
            cov = max(0.0, min(1.0, half + 0.75 - d))
            if cov > 0:
                blend_pixel(buf, px, py, size, size, r, g, b, a * cov)


def render_icon_png(size, maskable=False):
    """Render a crisp blue-hour cyan/gold tactical emblem PNG of `size x size`."""
    buf = bytearray(size * size * 4)
    cx = size * 0.5
    cy = size * 0.5
    scale = 0.72 if maskable else 0.92
    r_outer = size * 0.43 * scale
    r_inner = size * 0.375 * scale
    ring_w = max(2.2, size * 0.022 * scale)
    gold_w = max(1.4, size * 0.011 * scale)

    for y in range(size):
        ty = y / max(1, size - 1)
        bg_r = 8.0 + 13.0 * ty
        bg_g = 19.0 + 25.0 * ty
        bg_b = 31.0 + 30.0 * ty
        for x in range(size):
            dx = (x + 0.5) - cx
            dy = (y + 0.5) - cy
            dist = math.hypot(dx, dy)
            # Soft radial blue-hour cyan core glow
            glow = max(0.0, 1.0 - dist / (size * 0.42 * scale)) ** 2.2
            rr = bg_r + 18.0 * glow
            gg = bg_g + 68.0 * glow
            bb = bg_b + 86.0 * glow

            # Outer cyan tactical ring
            d_outer = abs(dist - r_outer)
            if d_outer < ring_w + 1.0:
                c_cov = max(0.0, min(1.0, ring_w * 0.5 + 0.8 - d_outer))
                rr = rr * (1.0 - 0.85 * c_cov) + 56.0 * 0.85 * c_cov
                gg = gg * (1.0 - 0.85 * c_cov) + 228.0 * 0.85 * c_cov
                bb = bb * (1.0 - 0.85 * c_cov) + 255.0 * 0.85 * c_cov

            # Inner gold tactical accent ring
            d_inner = abs(dist - r_inner)
            if d_inner < gold_w + 1.0:
                g_cov = max(0.0, min(1.0, gold_w * 0.5 + 0.75 - d_inner))
                rr = rr * (1.0 - 0.78 * g_cov) + 255.0 * 0.78 * g_cov
                gg = gg * (1.0 - 0.78 * g_cov) + 209.0 * 0.78 * g_cov
                bb = bb * (1.0 - 0.78 * g_cov) + 102.0 * 0.78 * g_cov

            idx = (y * size + x) * 4
            buf[idx] = clamp_u8(rr)
            buf[idx + 1] = clamp_u8(gg)
            buf[idx + 2] = clamp_u8(bb)
            buf[idx + 3] = 255

    # Geometric emblem inside circle: stylized "寸" + horizon ground slash in cyan/gold
    u = size * scale
    stroke = max(3.0, u * 0.052)
    gold = (255, 214, 118, 245)
    cyan = (90, 234, 255, 240)
    white_soft = (232, 248, 255, 230)

    # Top horizontal beam of "寸"
    draw_thick_line(buf, size, cx - u * 0.20, cy - u * 0.11, cx + u * 0.21, cy - u * 0.11, stroke, white_soft)
    # Vertical hook spine
    draw_thick_line(buf, size, cx + u * 0.06, cy - u * 0.24, cx + u * 0.06, cy + u * 0.18, stroke, cyan)
    draw_thick_line(buf, size, cx + u * 0.06, cy + u * 0.18, cx - u * 0.03, cy + u * 0.12, stroke * 0.9, cyan)
    # Gold contact dot / core spark
    draw_thick_line(buf, size, cx - u * 0.12, cy + u * 0.01, cx - u * 0.05, cy + u * 0.07, stroke * 1.15, gold)
    # Wet road horizon ground anchor bar + impact ripple highlight
    draw_thick_line(buf, size, cx - u * 0.24, cy + u * 0.24, cx + u * 0.24, cy + u * 0.24, max(2.2, stroke * 0.68), (56, 228, 255, 210))
    draw_thick_line(buf, size, cx - u * 0.14, cy + u * 0.29, cx + u * 0.14, cy + u * 0.29, max(1.6, stroke * 0.42), (255, 209, 102, 180))

    # Diagonal rain accents
    rain_w = max(1.4, u * 0.018)
    for rx, ry in ((-0.25, -0.22), (-0.19, -0.27), (0.22, -0.25), (0.27, -0.18)):
        x1 = cx + u * rx
        y1 = cy + u * ry
        draw_thick_line(buf, size, x1, y1, x1 - u * 0.035, y1 + u * 0.09, rain_w, (130, 232, 255, 130))

    row_bytes = size * 4
    rows = [memoryview(buf)[y * row_bytes : (y + 1) * row_bytes] for y in range(size)]
    return encode_png_rgba(size, size, rows)


def generate_icons(game_dir, mirror_root_icons=False):
    icons_dir = os.path.join(game_dir, "assets", "icons")
    os.makedirs(icons_dir, exist_ok=True)
    specs = [
        ("icon-180.png", 180, False),
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-512-maskable.png", 512, True),
    ]
    for name, sz, maskable in specs:
        out = os.path.join(icons_dir, name)
        with open(out, "wb") as f:
            f.write(render_icon_png(sz, maskable=maskable))
        if mirror_root_icons:
            root_icons = os.path.join(ROOT, "assets", "icons")
            os.makedirs(root_icons, exist_ok=True)
            shutil.copy2(out, os.path.join(root_icons, name))


def write_manifest(game_dir):
    manifest = {
        "id": "./",
        "name": "寸界 · Evolution",
        "short_name": "寸界",
        "description": "《寸界》Evolution — 三幕剧情、AJ6 高清与芬里尔蓝调雨夜猎场",
        "lang": "zh-CN",
        "start_url": "./",
        "scope": "./",
        "display": "standalone",
        "display_override": ["fullscreen", "standalone"],
        "orientation": "any",
        "background_color": "#0e171e",
        "theme_color": "#0e171e",
        "icons": [
            {
                "src": "assets/icons/icon-192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": "assets/icons/icon-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": "assets/icons/icon-512-maskable.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
    }
    path = os.path.join(game_dir, "manifest.webmanifest")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")


def collect_assets(game_dir):
    files = []
    for sub in ("scripts", "data", "assets"):
        base = os.path.join(game_dir, sub)
        if not os.path.isdir(base):
            continue
        for r, _, fns in os.walk(base):
            for fn in fns:
                fp = os.path.join(r, fn)
                rel = os.path.relpath(fp, game_dir).replace("\\", "/")
                files.append((rel, fp))
    files.sort(key=lambda x: x[0])

    hasher = hashlib.sha256()
    for top in ("index.html", "manifest.webmanifest"):
        tp = os.path.join(game_dir, top)
        if os.path.isfile(tp):
            hasher.update(top.encode("utf-8"))
            hasher.update(open(tp, "rb").read())

    core = ["./", "./index.html", "./manifest.webmanifest"]
    all_assets = ["./", "./index.html", "./manifest.webmanifest"]
    for rel, fp in files:
        size = os.path.getsize(fp)
        hasher.update(rel.encode("utf-8"))
        hasher.update(open(fp, "rb").read())
        url = f"./{rel}"
        all_assets.append(url)
        if rel in CORE_EXACT or rel.startswith(CORE_PREFIXES):
            core.append(url)

    build_hash = hasher.hexdigest()[:8]
    return build_hash, core, all_assets


def write_service_worker(game_dir, build_hash, core_assets, all_assets):
    sw_code = f"""/* Project Cunjie v6.2 PWA Service Worker (Workbox-inspired two-tier caching). */
'use strict';

const CACHE_PREFIX = 'cunjie-pwa-';
const CACHE_NAME = CACHE_PREFIX + {json.dumps(build_hash)};
const CORE_ASSETS = {json.dumps(core_assets, ensure_ascii=False, indent=2)};
const ALL_ASSETS = {json.dumps(all_assets, ensure_ascii=False, indent=2)};

function toRelKey(url) {{
 try {{
  const reqUrl = new URL(url, self.registration.scope);
  const scopeUrl = new URL(self.registration.scope);
  if (!reqUrl.href.startsWith(scopeUrl.href)) return null;
  let rel = './' + reqUrl.href.slice(scopeUrl.href.length).split('?')[0].split('#')[0];
  if (rel === './') return './';
  return rel;
 }} catch {{
  return null;
 }}
}}

self.addEventListener('install', event => {{
 event.waitUntil((async () => {{
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
  await self.skipWaiting();
 }})());
}});

self.addEventListener('activate', event => {{
 event.waitUntil((async () => {{
  const names = await caches.keys();
  await Promise.all(
   names
    .filter(n => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
    .map(n => caches.delete(n))
  );
  await self.clients.claim();
 }})());
}});

async function matchScoped(cache, request) {{
 const direct = await cache.match(request, {{ ignoreSearch: true }});
 if (direct) return direct;
 const rel = toRelKey(request.url);
 if (rel) return cache.match(rel);
 return undefined;
}}

self.addEventListener('fetch', event => {{
 const req = event.request;
 if (!req || req.method !== 'GET') return;
 const rel = toRelKey(req.url);
 if (!rel) return;

 if (req.mode === 'navigate' || rel === './' || rel === './index.html') {{
  event.respondWith((async () => {{
   const cache = await caches.open(CACHE_NAME);
   try {{
    const res = await fetch(req);
    if (res && res.ok) await cache.put('./index.html', res.clone());
    return res;
   }} catch {{
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
   }}
  }})());
  return;
 }}

 if (rel.startsWith('./assets/')) {{
  event.respondWith((async () => {{
   const cache = await caches.open(CACHE_NAME);
   const hit = await matchScoped(cache, req);
   if (hit) return hit;
   try {{
    const res = await fetch(req);
    if (res && res.ok) await cache.put(rel, res.clone());
    return res;
   }} catch {{
    return Response.error();
   }}
  }})());
  return;
 }}

 // Scripts, data bundles, and manifest: stale-while-revalidate
 event.respondWith((async () => {{
  const cache = await caches.open(CACHE_NAME);
  const hit = await matchScoped(cache, req);
  const netPromise = fetch(req).then(async res => {{
   if (res && res.ok) await cache.put(rel, res.clone());
   return res;
  }}).catch(() => null);
  if (hit) {{
   event.waitUntil(netPromise);
   return hit;
  }}
  const net = await netPromise;
  return net || Response.error();
 }})());
}});

async function countCached() {{
 const cache = await caches.open(CACHE_NAME);
 let done = 0;
 for (const asset of ALL_ASSETS) {{
  const hit = await cache.match(asset, {{ ignoreSearch: true }});
  if (hit) done++;
 }}
 return {{ done, total: ALL_ASSETS.length, ready: done >= ALL_ASSETS.length, cacheName: CACHE_NAME }};
}}

async function broadcast(payload) {{
 const list = await self.clients.matchAll({{ includeUncontrolled: true, type: 'window' }});
 for (const client of list) client.postMessage(payload);
}}

self.addEventListener('message', event => {{
 const data = event.data;
 if (!data || !data.type) return;

 if (data.type === 'GET_CACHE_STATUS') {{
  event.waitUntil((async () => {{
   const st = await countCached();
   const msg = {{ type: 'PWA_CACHE_STATUS', ...st }};
   if (event.source && typeof event.source.postMessage === 'function') event.source.postMessage(msg);
   else await broadcast(msg);
  }})());
  return;
 }}

 if (data.type === 'CACHE_ALL') {{
  event.waitUntil((async () => {{
   const cache = await caches.open(CACHE_NAME);
   const missing = [];
   let done = 0;
   for (const asset of ALL_ASSETS) {{
    if (await cache.match(asset, {{ ignoreSearch: true }})) done++;
    else missing.push(asset);
   }}
   const total = ALL_ASSETS.length;
   await broadcast({{ type: 'PWA_CACHE_PROGRESS', done, total, ready: done >= total, cacheName: CACHE_NAME }});
   const concurrency = 3;
   let cursor = 0;
   async function worker() {{
    while (cursor < missing.length) {{
     const item = missing[cursor++];
     try {{
      const res = await fetch(item, {{ cache: 'no-cache' }});
      if (res && res.ok) await cache.put(item, res);
     }} catch {{}}
     done++;
     await broadcast({{ type: 'PWA_CACHE_PROGRESS', done, total, ready: false, cacheName: CACHE_NAME }});
    }}
   }}
   await Promise.all(Array.from({{ length: Math.min(concurrency, missing.length) }}, () => worker()));
   const finalSt = await countCached();
   await broadcast({{ type: 'PWA_CACHE_PROGRESS', ...finalSt }});
  }})());
  return;
 }}

 if (data.type === 'CLEAR_CACHE') {{
  event.waitUntil((async () => {{
   await caches.delete(CACHE_NAME);
   const st = await countCached();
   await broadcast({{ type: 'PWA_CACHE_STATUS', ...st }});
  }})());
 }}
}});
"""
    sw_path = os.path.join(game_dir, "sw.js")
    with open(sw_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(sw_code)
    return sw_path


def build_pwa(game_dir, mirror_root_icons=False):
    generate_icons(game_dir, mirror_root_icons=mirror_root_icons)
    write_manifest(game_dir)
    scripts_dir = os.path.join(game_dir, "scripts")
    os.makedirs(scripts_dir, exist_ok=True)
    pwa_client_out = os.path.join(scripts_dir, "pwa.js")
    shutil.copy2(os.path.join(ROOT, "src", "pwa-client.js"), pwa_client_out)

    build_hash, core, all_assets = collect_assets(game_dir)
    sw_path = write_service_worker(game_dir, build_hash, core, all_assets)

    for script_path in (pwa_client_out, sw_path):
        res = subprocess.run(["node", "--check", script_path], capture_output=True, text=True)
        if res.returncode != 0:
            raise SystemExit(f"PWA syntax check failed for {script_path}: {res.stderr}")
    print(f"Built PWA ({build_hash}): {len(core)} core / {len(all_assets)} total assets in {os.path.relpath(game_dir, ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", action="store_true", help="Build PWA files directly inside dist-release/game")
    args = parser.parse_args()
    if args.release:
        build_pwa(os.path.join(ROOT, "dist-release", "game"), mirror_root_icons=True)
    else:
        build_pwa(DIST, mirror_root_icons=False)
