#!/usr/bin/env python3
"""
Fix Stage 2 (socks) and Stage 3 (paws) artwork, sprite alignment, carpet seams,
and transition cinematics across active game bundles.
"""
import base64
import hashlib
import io
import json
import os
import re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIST = os.path.join(ROOT, 'dist')
DATA = os.path.join(DIST, 'data')
SCRATCH = r'C:\Users\gewangzhengba\.gemini\antigravity\brain\20e9b6b2-8047-4fa5-a171-e4b84d890cd2\scratch\stage_imgs'


def decode_uri(uri: str) -> Image.Image:
    b64 = uri.split(',', 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64)))


def encode_png(im: Image.Image) -> tuple[str, bytes]:
    buf = io.BytesIO()
    im.save(buf, format='PNG', optimize=True)
    raw = buf.getvalue()
    return 'data:image/png;base64,' + base64.b64encode(raw).decode('ascii'), raw


def encode_webp(im: Image.Image, quality: int = 92, lossless: bool = False) -> tuple[str, bytes]:
    buf = io.BytesIO()
    im.save(buf, format='WEBP', quality=quality, lossless=lossless, method=6)
    raw = buf.getvalue()
    return 'data:image/webp;base64,' + base64.b64encode(raw).decode('ascii'), raw


def extend_trouser_top(arr: np.ndarray, cx: int, cy: int, target_y: int = 3) -> np.ndarray:
    """Extend a clipped trouser cuff upward cleanly without horizontal stripe artifacts."""
    cell = arr[cy:cy + 256, cx:cx + 160].copy()
    row_cnt = (cell[:, :, 3] > 80).sum(axis=1)
    first_y = next((y for y in range(256) if row_cnt[y] > 20), None)
    if first_y is None or first_y <= target_y:
        # Clear any faint stray pixels above first_y
        if first_y is not None:
            cell[:first_y, :, :] = 0
        arr[cy:cy + 256, cx:cx + 160] = cell
        return arr

    # Clear stray semi-transparent pixels above first_y so edges stay crisp
    cell[:first_y, :, :] = 0

    def span_at(y):
        xs = np.where(cell[y, :, 3] > 60)[0]
        return (float(xs[0]), float(xs[-1])) if len(xs) >= 12 else None

    y_a = min(246, first_y + 3)
    # Fit linear left/right cuff edges over [y_a .. y_a + 18]
    pts_y, pts_l, pts_r = [], [], []
    for yy in range(y_a, min(252, y_a + 18)):
        s = span_at(yy)
        if s:
            pts_y.append(yy)
            pts_l.append(s[0])
            pts_r.append(s[1])
    if len(pts_y) < 3:
        return arr

    dl = float(np.polyfit(pts_y, pts_l, 1)[0])
    dr = float(np.polyfit(pts_y, pts_r, 1)[0])
    # Flip sign semantics: as y decreases (dy > 0 moving up), x changes by -dl, -dr
    step_l = max(-0.48, min(0.48, -dl))
    step_r = max(-0.48, min(0.48, -dr))
    # Prevent silhouette ballooning out unreasonably or collapsing
    sa = span_at(y_a)
    if not sa:
        return arr
    src_l, src_r = sa

    # Build one smooth canonical cel cross-section in normalized coordinate u in [0..1]
    # averaged across [y_a .. y_a + 5] so there are zero horizontal striping jumps.
    grid_n = 160
    u_grid = np.linspace(0.0, 1.0, grid_n)
    accum = np.zeros((grid_n, 4), dtype=np.float32)
    valid = 0
    for yy in range(y_a, min(254, y_a + 6)):
        s = span_at(yy)
        if not s:
            continue
        l0, r0 = s
        xs0 = l0 + u_grid * max(1.0, r0 - l0)
        i0 = np.clip(np.floor(xs0).astype(int), 0, 159)
        i1 = np.clip(i0 + 1, 0, 159)
        f = (xs0 - i0)[:, None]
        accum += cell[yy, i0].astype(np.float32) * (1.0 - f) + cell[yy, i1].astype(np.float32) * f
        valid += 1
    if valid == 0:
        return arr
    profile = accum / float(valid)
    # Force interior opacity to 255 while keeping crisp antialiased outer ink boundary
    profile[4:-4, 3] = 255.0

    for y in range(target_y, y_a):
        dy = y_a - y
        nl = max(0.0, min(157.0, src_l + step_l * dy))
        nr = max(nl + 6.0, min(159.0, src_r + step_r * dy))
        nw = nr - nl
        xs_dst = np.arange(int(np.floor(nl)), int(np.ceil(nr)) + 1)
        u_dst = np.clip((xs_dst - nl) / max(1.0, nw), 0.0, 1.0) * (grid_n - 1)
        p0 = np.clip(np.floor(u_dst).astype(int), 0, grid_n - 1)
        p1 = np.clip(p0 + 1, 0, grid_n - 1)
        pf = (u_dst - p0)[:, None]
        sampled = profile[p0] * (1.0 - pf) + profile[p1] * pf
        cell[y, :] = 0
        cell[y, xs_dst] = np.clip(sampled, 0, 255).astype(np.uint8)

    arr[cy:cy + 256, cx:cx + 160] = cell
    return arr


def build_clean_paws(paws_im: Image.Image, clean_right_im: Image.Image) -> Image.Image:
    arr = np.array(paws_im.convert('RGBA'))
    # 1. Remove stray horizontal divider bars in Row 0 (y=247..255) & Row 1 (y=498..511)
    arr[247:256, 0:640] = 0
    arr[256 + 242:512, 0:640] = 0

    # Verify Row 1 & Row 2 top border cleanliness (clear accidental stray top row < y=3)
    for r in (0, 1, 2):
        arr[r * 256:r * 256 + 3, 0:640] = 0

    # 2. Extend clipped trouser tops on (1,2) and (3,2) up to y=3
    arr = extend_trouser_top(arr, 160, 512, target_y=3)
    arr = extend_trouser_top(arr, 480, 512, target_y=3)

    # 3. Copy clean right-hand portrait & HUD grid [640..1024] from sneakers/official_socks (0 bleed!)
    r_arr = np.array(clean_right_im.convert('RGBA'))
    arr[:, 640:1024] = r_arr[:, 640:1024]
    return Image.fromarray(arr, 'RGBA')


def build_clean_socks(socks_im: Image.Image, clean_right_im: Image.Image) -> Image.Image:
    arr = np.array(socks_im.convert('RGBA'))
    # Extend clipped trouser tops on (3,1) back[4] and (3,2) up to y=3
    arr = extend_trouser_top(arr, 480, 256, target_y=3)
    arr = extend_trouser_top(arr, 480, 512, target_y=3)
    # Clean right-hand portrait & HUD grid
    r_arr = np.array(clean_right_im.convert('RGBA'))
    arr[:, 640:1024] = r_arr[:, 640:1024]
    return Image.fromarray(arr, 'RGBA')


def _hblur(arr_f32: np.ndarray, rx: int = 36) -> np.ndarray:
    """Fast horizontal low-pass lighting envelope (works across any Pillow version)."""
    h, w, c = arr_f32.shape
    im = Image.fromarray(np.clip(arr_f32, 0, 255).astype(np.uint8), 'RGB')
    small_w = max(8, w // max(1, rx))
    low = im.resize((small_w, h), Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(radius=1.5))
    return np.array(low.resize((w, h), Image.Resampling.BILINEAR), dtype=np.float32)


def heal_carpet_scene(im: Image.Image, horizon_y: int, src_start_y: int, src_end_y: int, blur_top: float = 6.5) -> Image.Image:
    """
    Replace the torn/stitched horizontal seam band [horizon_y .. src_start_y]
    using forward-continuing (non-mirrored!) perspective carpet tufts quilted seamlessly
    onto src_start_y via a dynamic-programming minimum-error crevice cut, with progressive
    optical bokeh toward the distant bedroom horizon.
    """
    rgb = np.array(im.convert('RGB'), dtype=np.float32)
    h, w, _ = rgb.shape
    out = rgb.copy()

    clean_top = src_start_y + 2
    band_top = max(0, horizon_y - 16)
    overlap_h = 22
    band_bot = min(h, clean_top + overlap_h)
    src_need = clean_top - band_top

    # Reflect-pad horizontally so perspective width contraction never clamps into edge streaks
    pad_w = 240
    padded = np.pad(rgb, ((0, 0), (pad_w, pad_w), (0, 0)), mode='reflect')

    # Find best tuft-phase alignment inside clean foreground rug [clean_top + 130 .. src_end_y - 25]
    # Note: source block runs UPWARD from best_ym, staying cleanly >= clean_top + 8!
    tgt = rgb[clean_top:clean_top + overlap_h]
    tgt_hp = tgt.mean(axis=2) - tgt.mean(axis=(1, 2), keepdims=True)
    cx = w * 0.5
    xs = np.arange(w, dtype=np.float32)

    min_ym = min(src_end_y - overlap_h - 4, clean_top + int(1.38 * src_need) + 12)
    max_ym = min(src_end_y - overlap_h - 2, clean_top + int(1.45 * src_need) + 90)
    best_score = 1e18
    best_ym = min_ym
    best_scale = 1.10

    for h_scale in (1.06, 1.10, 1.14, 1.18):
        sx = np.clip(pad_w + cx + (xs - cx) * h_scale, 0, padded.shape[1] - 1.001)
        ix = sx.astype(int)
        fx = (sx - ix)[:, None]
        for ym in range(min_ym, max(min_ym + 1, max_ym), 2):
            cand = padded[ym:ym + overlap_h, ix] * (1.0 - fx) + padded[ym:ym + overlap_h, ix + 1] * fx
            cand_hp = cand.mean(axis=2) - cand.mean(axis=(1, 2), keepdims=True)
            diff = float(np.abs(cand_hp - tgt_hp).mean())
            if diff < best_score:
                best_score = diff
                best_ym = ym
                best_scale = h_scale

    # Precompute bokeh pyramid levels over padded clean carpet
    pad_pil = Image.fromarray(np.clip(padded, 0, 255).astype(np.uint8), 'RGB')
    levels = [
        padded,
        np.array(pad_pil.filter(ImageFilter.GaussianBlur(radius=1.2)), dtype=np.float32),
        np.array(pad_pil.filter(ImageFilter.GaussianBlur(radius=3.0)), dtype=np.float32),
        np.array(pad_pil.filter(ImageFilter.GaussianBlur(radius=blur_top)), dtype=np.float32),
    ]

    # Measure smooth horizontal illumination across clean_top edge vs far room shadow base
    edge_env = _hblur(rgb[clean_top:clean_top + 16], rx=32).mean(axis=0, keepdims=True)  # (1, w, 3)
    room_base = _hblur(rgb[max(0, horizon_y - 26):max(1, horizon_y - 8)], rx=24).mean(axis=0, keepdims=True)

    # Compute source block's own smooth horizontal illumination so high-frequency tuft texture transfers cleanly
    padded_env = _hblur(rgb[clean_top:src_end_y], rx=32)

    band = np.zeros((band_bot - band_top, w, 3), dtype=np.float32)
    max_travel = float(best_ym - (clean_top + 8))

    for idx, y in enumerate(range(band_top, band_bot)):
        if y >= clean_top:
            # Overlap region moves forward cleanly at 1:1 rate below best_ym for seam alignment
            sy = float(best_ym + (y - clean_top))
            t = 0.0
        else:
            dist_up = float(clean_top - y)
            t = np.clip(dist_up / max(1.0, float(clean_top - band_top)), 0.0, 1.0)
            # Non-reversing monotonic upward mapping: deeper compression toward horizon, capped safely >= clean_top+8
            rate = min(1.36, max_travel / max(1.0, float(src_need)))
            # Gentle perspective acceleration while staying monotonic
            travel = min(max_travel, dist_up * (0.94 * rate + 0.12 * rate * t))
            sy = float(best_ym) - travel

        sy = np.clip(sy, float(clean_top + 4), float(h - 2))
        iy = int(np.floor(sy))
        fy = sy - iy

        # Slight progressive horizontal perspective taper (closer rows slightly wider -> need slightly wider src span)
        scale_x = best_scale + 0.06 * t
        sx = np.clip(pad_w + cx + (xs - cx) * scale_x, 0.0, float(padded.shape[1] - 2))
        ix = sx.astype(int)
        fx = (sx - ix)[:, None]

        # Sample bokeh level smoothly from t=0 (sharp) to t=1 (6.5px optical DOF)
        dof = (t ** 1.25) * 3.0
        l0 = min(2, int(np.floor(dof)))
        lw = dof - l0
        p0 = levels[l0][iy, ix] * (1.0 - fx) + levels[l0][iy, ix + 1] * fx
        p1 = levels[l0][iy + 1, ix] * (1.0 - fx) + levels[l0][iy + 1, ix + 1] * fx
        q0 = levels[l0 + 1][iy, ix] * (1.0 - fx) + levels[l0 + 1][iy, ix + 1] * fx
        q1 = levels[l0 + 1][iy + 1, ix] * (1.0 - fx) + levels[l0 + 1][iy + 1, ix + 1] * fx
        tex = (p0 * (1.0 - fy) + p1 * fy) * (1.0 - lw) + (q0 * (1.0 - fy) + q1 * fy) * lw

        # Transfer smooth illumination from clean_top edge -> subtle depth falloff at horizon
        src_env_row = padded_env[min(padded_env.shape[0] - 1, max(0, iy - clean_top))]
        # Map src_env horizontally matching scale_x approximately
        esx = np.clip(cx + (xs - cx) * scale_x, 0.0, float(w - 1)).astype(int)
        src_col = src_env_row[esx]
        target_col = edge_env[0] * (1.0 - 0.24 * (t ** 1.1)) + room_base[0] * (0.20 * (t ** 1.3))
        high_freq = tex - src_col
        band[idx] = np.clip(target_col + high_freq * (1.0 - 0.15 * t), 0.0, 255.0)

    # Dynamic programming minimum-error seam across the overlap [clean_top .. band_bot]
    ov_start = clean_top - band_top
    ov_patch = band[ov_start:ov_start + overlap_h]
    ov_orig = rgb[clean_top:clean_top + overlap_h]
    err = np.abs(ov_patch - ov_orig).mean(axis=2)  # (overlap_h, w)

    dp = np.zeros_like(err)
    dp[:, 0] = err[:, 0]
    back = np.zeros_like(err, dtype=np.int32)
    rows = np.arange(overlap_h)
    for x in range(1, w):
        prev = dp[:, x - 1]
        best_r = np.zeros(overlap_h, dtype=np.int32)
        best_v = prev.copy()
        # up-left
        m_up = prev[:-1] < best_v[1:]
        best_v[1:][m_up] = prev[:-1][m_up]
        best_r[1:][m_up] = -1
        # down-left
        m_dn = prev[1:] < best_v[:-1]
        best_v[:-1][m_dn] = prev[1:][m_dn]
        best_r[:-1][m_dn] = 1
        dp[:, x] = err[:, x] + best_v
        back[:, x] = rows + best_r

    seam = np.zeros(w, dtype=np.int32)
    seam[-1] = int(np.argmin(dp[:, -1]))
    for x in range(w - 2, -1, -1):
        seam[x] = int(back[seam[x + 1], x + 1])

    # Composite band cleanly: bokeh horizon feather at top -> 100% patch -> feathered DP seam at bottom
    # Extend only the upper bedroom pixels (y < horizon_y - 1) across the feather zone so zero sharp carpet paste step leaks back
    feather_top_start = horizon_y - 12
    feather_top_end = horizon_y + 14
    room_limit_y = max(1, horizon_y - 2)
    for idx, y in enumerate(range(band_top, band_bot)):
        if y < feather_top_start:
            continue
        elif y < feather_top_end:
            u = (y - feather_top_start) / float(feather_top_end - feather_top_start)
            alpha = u * u * (3.0 - 2.0 * u)
            room_y = y if y <= room_limit_y else max(0, room_limit_y - (y - room_limit_y))
            out[y] = rgb[room_y] * (1.0 - alpha) + band[idx] * alpha
        elif y < clean_top:
            out[y] = band[idx]
        else:
            dy_seam = (y - clean_top) - seam  # (w,)
            # Smooth 9px feather around DP crevice seam
            blend = np.clip((4.5 - dy_seam) / 9.0, 0.0, 1.0)
            blend = (blend * blend * (3.0 - 2.0 * blend))[:, None]
            out[y] = rgb[y] * (1.0 - blend) + band[idx] * blend

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def cell_to_cg_layer(sheet: Image.Image, col: int, row: int, target_top: int = 54, target_bot: int = 912, target_cx: float = 299.0) -> Image.Image:
    """Crop a 160x256 spritesheet cell and rescale cleanly onto a 600x960 transparent CG canvas."""
    cell = sheet.crop((col * 160, row * 256, (col + 1) * 160, (row + 1) * 256)).convert('RGBA')
    arr = np.array(cell)
    ys, xs = np.where(arr[:, :, 3] > 20)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    cropped = cell.crop((x0, y0, x1, y1))

    target_h = target_bot - target_top
    scale = target_h / float(cropped.height)
    new_w = max(1, int(round(cropped.width * scale)))
    new_h = target_h
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new('RGBA', (600, 960), (0, 0, 0, 0))
    paste_x = int(round(target_cx - new_w / 2.0))
    canvas.alpha_composite(resized, (max(0, paste_x), target_top))
    return canvas


def refine_sock_slip(im: Image.Image) -> Image.Image:
    """
    Remove the flat horizontal knife-cut & stray trouser cuff fringe at the top of sock_slip.webp
    and draw a clean 2x-supersampled elliptical ribbed crew-sock cuff opening with shaded interior.
    """
    arr = np.array(im.convert('RGBA'))
    h, w, _ = arr.shape

    row_cnt = (arr[:, :, 3] > 25).sum(axis=1)
    top_y = next((y for y in range(h) if row_cnt[y] > 20), 420)
    cut_y = top_y + 16  # cleanly below the chopped trouser cuff shadow [420..434]

    xs_ref = np.where(arr[cut_y + 2, :, 3] > 80)[0]
    lx = int(xs_ref.min()) + 2
    rx = int(xs_ref.max()) - 2
    cx = (lx + rx) * 0.5
    half_w = (rx - lx) * 0.5

    # Match the slight diagonal slant of the sock cuff at cut_y
    tilt = -4.0  # slight natural downward tilt toward right edge

    # 1. Clear everything strictly above the front rim arc y_front(x)
    ys_grid, xs_grid = np.mgrid[0:h, 0:w]
    u = np.clip((xs_grid - cx) / max(1.0, half_w), -1.0, 1.0)
    inside_span = np.abs(xs_grid - cx) <= (half_w + 1.5)
    cos_arc = np.sqrt(np.clip(1.0 - u * u, 0.0, 1.0))

    ry_back = 18.0
    ry_front = 13.0
    y_center = cut_y + u * tilt
    y_back = y_center - ry_back * cos_arc
    y_front = y_center + ry_front * cos_arc

    # Erase original pixels above the front rim (plus tiny fringe cleanup outside outer sock walls above cut_y + 6)
    erase_mask = (ys_grid < cut_y - 1) | (inside_span & (ys_grid < np.floor(y_front)))
    # Also erase any stray top outer pixels above cut_y + 6 that were part of old fringe
    erase_mask |= (ys_grid < cut_y + 8) & (~inside_span)
    arr[erase_mask] = 0
    # Slightly lift residual dark cuff tint in the 6px band just below y_front into warm white sock luminance
    tint_zone = inside_span & (ys_grid >= np.floor(y_front)) & (ys_grid < np.floor(y_front) + 7) & (arr[:, :, 3] > 100)
    if tint_zone.any():
        dist = np.clip((ys_grid - y_front) / 7.0, 0.0, 1.0)
        # Exclude dark outline pixels (luminance < 70) so outer outline stays crisp
        lum = arr[:, :, :3].mean(axis=2)
        light_zone = tint_zone & (lum > 75)
        for c, target_v in enumerate((212.0, 206.0, 218.0)):
            arr[:, :, c] = np.where(
                light_zone,
                np.clip(arr[:, :, c] * (0.45 + 0.55 * dist) + target_v * (0.55 * (1.0 - dist)), 0, 255).astype(np.uint8),
                arr[:, :, c],
            )

    # 2. Render crisp 2x-supersampled ellipse opening + stroke over the clean sock cut
    S = 2
    hi_w, hi_h = w * S, h * S
    opening = Image.new('RGBA', (hi_w, hi_h), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(opening, 'RGBA')

    steps = 120
    # Closed polygon for hollow interior opening (top back arc -> bottom front arc)
    poly_open = []
    for i in range(steps + 1):
        t = -1.0 + 2.0 * (i / steps)
        x = cx + t * half_w
        ca = float(np.sqrt(max(0.0, 1.0 - t * t)))
        poly_open.append((x * S, (cut_y + t * tilt - ry_back * ca) * S))
    for i in range(steps, -1, -1):
        t = -1.0 + 2.0 * (i / steps)
        x = cx + t * half_w
        ca = float(np.sqrt(max(0.0, 1.0 - t * t)))
        poly_open.append((x * S, (cut_y + t * tilt + ry_front * ca) * S))
    odraw.polygon(poly_open, fill=(136, 142, 158, 255))

    # Deeper vertical gradient shadow core inside sock tube
    poly_deep = []
    for i in range(steps + 1):
        t = -1.0 + 2.0 * (i / steps)
        x = cx + t * (half_w * 0.86)
        ca = float(np.sqrt(max(0.0, 1.0 - t * t)))
        poly_deep.append((x * S, (cut_y + t * tilt - (ry_back * 0.45) * ca + 2.0) * S))
    for i in range(steps, -1, -1):
        t = -1.0 + 2.0 * (i / steps)
        x = cx + t * (half_w * 0.86)
        ca = float(np.sqrt(max(0.0, 1.0 - t * t)))
        poly_deep.append((x * S, (cut_y + t * tilt + (ry_front * 0.92) * ca) * S))
    odraw.polygon(poly_deep, fill=(84, 90, 108, 255))

    # Downsample hollow interior cleanly and composite behind/with outer ink border
    interior = opening.resize((w, h), Image.Resampling.LANCZOS)
    base_im = Image.fromarray(arr, 'RGBA')
    out_hi = Image.new('RGBA', (hi_w, hi_h), (0, 0, 0, 0))
    draw_rim = ImageDraw.Draw(out_hi, 'RGBA')

    # Clean ink outline all around top back rim and front cuff lip (zero inner horizontal chord!)
    rim_closed = poly_open + [poly_open[0]]
    draw_rim.line(rim_closed, fill=(28, 28, 34, 255), width=int(round(3.6 * S)), joint='curve')
    rim_clean = out_hi.resize((w, h), Image.Resampling.LANCZOS)

    # Layering: interior shadow -> clean original sock front below y_front -> crisp outer elliptical rim
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(interior)
    canvas.alpha_composite(base_im)
    canvas.alpha_composite(rim_clean)
    return canvas


def main():
    print('Loading sources (preserving unmodified SCRATCH originals when available) ...')
    p_04 = os.path.join(DATA, '04-images.js')
    s_04 = open(p_04, encoding='utf-8').read()

    def get_04_key(key):
        m = re.search(rf'"{key}"\s*:\s*"(data:image/[^"]+)"', s_04)
        assert m, f'missing {key} in 04-images.js'
        return m.group(1)

    def load_orig(scratch_name, fallback_im):
        sp = os.path.join(SCRATCH, scratch_name)
        if os.path.exists(sp):
            return Image.open(sp)
        return fallback_im

    sneakers_im = load_orig('xl_sneakers_png.png', decode_uri(get_04_key('sneakers')))
    socks_raw = load_orig('xl_socks_png.png', decode_uri(get_04_key('socks')))
    paws_raw = load_orig('xl_paws_png.png', decode_uri(get_04_key('paws')))
    s2n_raw = load_orig('rsu_s1_v0.webp', decode_uri(get_04_key('stage2Normal')))
    s2f_raw = load_orig('rsu_s1_v1.webp', decode_uri(get_04_key('stage2Fever')))

    # 1. Clean atlases
    print('Cleaning paws.png & socks.png ...')
    paws_clean = build_clean_paws(paws_raw, sneakers_im)
    socks_clean = build_clean_socks(socks_raw, sneakers_im)
    paws_png_uri, paws_png_bytes = encode_png(paws_clean)
    socks_png_uri, socks_png_bytes = encode_png(socks_clean)
    paws_webp_uri, _ = encode_webp(paws_clean, quality=92, lossless=False)
    socks_webp_uri, _ = encode_webp(socks_clean, quality=92, lossless=False)

    paws_clean.save(os.path.join(SCRATCH, 'fixed_paws.png'))
    socks_clean.save(os.path.join(SCRATCH, 'fixed_socks.png'))

    # Save visual inspection grids for fixed paws & socks
    for name, im in [('paws', paws_clean), ('socks', socks_clean)]:
        grid = Image.new('RGBA', (640, 768), (248, 244, 240, 255))
        grid.alpha_composite(im.crop((0, 0, 640, 768)))
        gd = ImageDraw.Draw(grid)
        for c in range(1, 4):
            gd.line([(c * 160, 0), (c * 160, 768)], fill=(255, 80, 80, 255), width=2)
        for r in range(1, 3):
            gd.line([(0, r * 256), (640, r * 256)], fill=(255, 80, 80, 255), width=2)
        grid.save(os.path.join(SCRATCH, f'grid_fixed_{name}.png'))

    # 2. Heal Stage 2 carpet backgrounds
    print('Healing Stage 2 carpet backgrounds ...')
    s2n_clean = heal_carpet_scene(s2n_raw, horizon_y=210, src_start_y=286, src_end_y=580, blur_top=6.5)
    s2f_clean = heal_carpet_scene(s2f_raw, horizon_y=210, src_start_y=286, src_end_y=580, blur_top=6.5)
    s2n_uri, _ = encode_webp(s2n_clean, quality=92)
    s2f_uri, _ = encode_webp(s2f_clean, quality=92)
    s2n_clean.save(os.path.join(SCRATCH, 'fixed_stage2Normal.webp'))
    s2f_clean.save(os.path.join(SCRATCH, 'fixed_stage2Fever.webp'))

    # 3. Update 04-images.js
    print('Updating 04-images.js ...')
    def replace_04_key(text, key, new_uri):
        pat = re.compile(rf'("{key}"\s*:\s*)"data:image/[^"]+"')
        out, n = pat.subn(rf'\1"{new_uri}"', text, count=1)
        assert n == 1, f'failed to replace {key}'
        return out

    s_04_new = s_04
    s_04_new = replace_04_key(s_04_new, 'paws', paws_png_uri)
    s_04_new = replace_04_key(s_04_new, 'socks', socks_png_uri)
    s_04_new = replace_04_key(s_04_new, 'stage2Normal', s2n_uri)
    s_04_new = replace_04_key(s_04_new, 'stage2Fever', s2f_uri)
    open(p_04, 'w', encoding='utf-8').write(s_04_new)

    # 4. Update 04-images-deferred.js
    print('Updating 04-images-deferred.js ...')
    p_def = os.path.join(DATA, '04-images-deferred.js')
    s_def = open(p_def, encoding='utf-8').read()
    s_def = replace_04_key(s_def, 'paws', paws_webp_uri)
    s_def = replace_04_key(s_def, 'socks', socks_webp_uri)
    s_def = replace_04_key(s_def, 'stage2Normal', s2n_uri)
    s_def = replace_04_key(s_def, 'stage2Fever', s2f_uri)
    open(p_def, 'w', encoding='utf-8').write(s_def)

    # 5. Update touch-v1-impact.js & touch-v1-free.js
    for fn, has_scenes in [('touch-v1-impact.js', True), ('touch-v1-free.js', False)]:
        print(f'Updating {fn} ...')
        fp = os.path.join(DATA, fn)
        txt = open(fp, encoding='utf-8').read()

        # Replace embedded xlAssets paws.png & socks.png (Notice escaped quotes \" in string literal!)
        p_pat = re.compile(r'(\\"paws\.png\\":\s*\\")data:image/[^\\"]+')
        s_pat = re.compile(r'(\\"socks\.png\\":\s*\\")data:image/[^\\"]+')
        txt, np_cnt = p_pat.subn(rf'\1{paws_png_uri}', txt, count=1)
        txt, ns_cnt = s_pat.subn(rf'\1{socks_png_uri}', txt, count=1)
        assert np_cnt == 1 and ns_cnt == 1, f'{fn}: asset replace counts {(np_cnt, ns_cnt)}'

        # Fix XL_GEOMETRY["paws"] frontOffsets & backOffsets (row 1 offset fix after black divider removal)
        old_geo_pat = re.compile(
            r'(\\"paws\\":\s*\{\\"frontOffsets\\":\s*)\[[^\]]+\](,\s*\\"backOffsets\\":\s*)\[[^\]]+\]'
        )
        txt, ng_cnt = old_geo_pat.subn(r'\1[18, 26, 4, 16, 21, 5]\2[17, 21, 3, 17, 27]', txt, count=1)
        assert ng_cnt == 1, f'{fn}: XL_GEOMETRY paws replace count {ng_cnt}'

        if has_scenes:
            # Replace realmSceneUris[1] (second element pair in realmSceneUris=[ [s0v0, s0v1], [s1v0, s1v1], [s2v0, s2v1] ])
            m_rsu = re.search(r'realmSceneUris=\[(\[[^\]]+\]),(\[[^\]]+\])', txt)
            assert m_rsu, 'realmSceneUris[1] not found'
            new_pair = f'[\\"{s2n_uri}\\",\\"{s2f_uri}\\"]'
            txt = txt[:m_rsu.start(2)] + new_pair + txt[m_rsu.end(2):]

        open(fp, 'w', encoding='utf-8').write(txt)

    # 6. Update 13-cinematics.js (Stage 2/3 cutscene artwork & hashes)
    print('Updating 13-cinematics.js ...')
    p_cin = os.path.join(DATA, '13-cinematics.js')
    cin_raw = open(p_cin, encoding='utf-8').read()
    j_start = cin_raw.find('{')
    j_end = cin_raw.rfind('}') + 1
    prefix, suffix = cin_raw[:j_start], cin_raw[j_end:]
    cin_data = json.loads(cin_raw[j_start:j_end])

    # 6a. Heal cg01/s04_rug.webp (horizon ~154, clean start ~244)
    s04_rug_im = load_orig('cg_cg01_shoe_to_sock__s04_rug.webp', decode_uri(cin_data['images']['cg01_shoe_to_sock/s04_rug.webp']))
    s04_rug_clean = heal_carpet_scene(s04_rug_im, horizon_y=154, src_start_y=244, src_end_y=540, blur_top=7.0)

    # 6b. Rebuild sock_sole.webp from cleaned socks.png cell (0,1) [0,256] (lifted striped sole!)
    sock_sole_clean = cell_to_cg_layer(socks_clean, col=0, row=1, target_top=10, target_bot=956, target_cx=299.0)

    # 6c. Rebuild paw_front.webp, paw_lift.webp, paw_side.webp cleanly from cleaned paws.png (zero bars!)
    paw_front_clean = cell_to_cg_layer(paws_clean, col=0, row=0, target_top=54, target_bot=912, target_cx=298.5)
    paw_lift_clean = cell_to_cg_layer(paws_clean, col=0, row=1, target_top=54, target_bot=912, target_cx=299.5)
    paw_side_clean = cell_to_cg_layer(paws_clean, col=3, row=0, target_top=54, target_bot=912, target_cx=298.0)

    # 6d. Refine sock_slip.webp cuff rim
    sock_slip_raw = load_orig('cg_cg02_sock_to_paw__sock_slip.webp', decode_uri(cin_data['images']['cg02_sock_to_paw/sock_slip.webp']))
    sock_slip_clean = refine_sock_slip(sock_slip_raw)

    # Save top crop of sock_slip on neutral gray for zoom inspection
    zoom = Image.new('RGBA', (600, 300), (225, 225, 225, 255))
    zoom.alpha_composite(sock_slip_clean.crop((0, 360, 600, 660)))
    zoom.save(os.path.join(SCRATCH, 'zoom_fixed_sock_slip_top.png'))

    replacements = {
        'cg01_shoe_to_sock/s04_rug.webp': s04_rug_clean,
        'cg01_shoe_to_sock/sock_sole.webp': sock_sole_clean,
        'cg02_sock_to_paw/paw_front.webp': paw_front_clean,
        'cg02_sock_to_paw/paw_lift.webp': paw_lift_clean,
        'cg02_sock_to_paw/paw_side.webp': paw_side_clean,
        'cg02_sock_to_paw/sock_slip.webp': sock_slip_clean,
    }
    for asset_key, img in replacements.items():
        uri, raw_bytes = encode_webp(img, quality=92, lossless=False)
        cin_data['images'][asset_key] = uri
        cin_data['hashes'][asset_key] = hashlib.sha256(raw_bytes).hexdigest()
        save_name = 'fixed_cg_' + asset_key.replace('/', '__')
        img.save(os.path.join(SCRATCH, save_name))
        print(f'  updated {asset_key}: sha256={cin_data["hashes"][asset_key][:12]}... ({len(raw_bytes):,} B)')

    open(p_cin, 'w', encoding='utf-8').write(prefix + json.dumps(cin_data, ensure_ascii=False) + suffix)
    print('All data assets & geometries updated successfully!')


if __name__ == '__main__':
    main()
