#!/usr/bin/env python3
"""
Generate cohesive HD visual assets for Project Cunjie:
1. 2048x512 HD tiny-pedestrian sprite sheet (16 cols x 4 rows of 128x128: 4 outfit variants x 16 poses)
2. 1280x768 Act III midnight rainy bedside scene (Normal + Fever)
3. 44 HD foot skin frames (aj5-hd, qiaodan-hd, socks-hd, paws-hd; 11 frames each at 480x768 WebP)
4. Calibrated sole offsets & contact boxes -> src/art-hd-geo.json
"""
import base64
import colorsys
import io
import json
import math
import os
import re
from scipy import ndimage
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE_GAME = os.path.join(ROOT, "dist-release", "game")
DIST = os.path.join(ROOT, "dist")
ART_REFS = os.path.join(ROOT, "baseline", "_art_refs")
BRAIN_DIR = r"C:\Users\gewangzhengba\.gemini\antigravity\brain\20e9b6b2-8047-4fa5-a171-e4b84d890cd2"
SCRATCH_DIR = os.path.join(BRAIN_DIR, "scratch")

TINIES_MASTER = os.path.join(BRAIN_DIR, "tinies_hd_sheet_v3_1795696682091.jpg")
BEDSIDE_MASTER = os.path.join(BRAIN_DIR, "stage3_bedside_hd_1795696810896.jpg")
SKIN_MASTERS = {
    "aj5": os.path.join(BRAIN_DIR, "aj5_hd_pose3_1795696464416.jpg"),
    "qiaodan": os.path.join(BRAIN_DIR, "qiaodan_hd_pose0_1795696815996.jpg"),
    "socks": os.path.join(BRAIN_DIR, "socks_hd_pose3_v2_1795696490021.jpg"),
    "paws": os.path.join(BRAIN_DIR, "paws_hd_pose3_1795696552627.jpg"),
}


def remove_white_bg_clean(im: Image.Image, white_thresh: int = 232, chroma_thresh: int = 22, clean_enclosed_gaps: bool = False) -> Image.Image:
    """
    Flood-fill remove exterior white background from borders while preserving internal white pixels
    (socks, leather, shirts, eye whites) and cleanly de-fringing anti-aliased outlines.
    """
    rgba = np.array(im.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.int16)
    h, w, _ = rgb.shape

    cmin = rgb.min(axis=2)
    cmax = rgb.max(axis=2)
    lum = rgb.mean(axis=2)
    is_bg_cand = (cmin >= white_thresh) & ((cmax - cmin) <= chroma_thresh)

    # C-level connected components of candidate background; keep components touching border!
    labeled, n_cc = ndimage.label(is_bg_cand)
    border_labels = set()
    if n_cc > 0:
        border_labels.update(np.unique(labeled[0, :]).tolist())
        border_labels.update(np.unique(labeled[-1, :]).tolist())
        border_labels.update(np.unique(labeled[:, 0]).tolist())
        border_labels.update(np.unique(labeled[:, -1]).tolist())
        border_labels.discard(0)
    bg_mask = np.isin(labeled, list(border_labels)) if border_labels else np.zeros((h, w), dtype=bool)

    if clean_enclosed_gaps:
        # Clean trapped pure-white background gaps between striding legs, raised arms, or under toes
        pure_white = (cmin >= 242) & ((cmax - cmin) <= 12) & (~bg_mask)
        plab, pn = ndimage.label(pure_white)
        if pn > 0:
            counts = np.bincount(plab.ravel())
            slices = ndimage.find_objects(plab)
            for lbl in range(1, pn + 1):
                if counts[lbl] < 10 or slices[lbl - 1] is None:
                    continue
                sy_s, sx_s = slices[lbl - 1]
                y0, y1 = max(0, sy_s.start - 1), min(h, sy_s.stop + 1)
                x0, x1 = max(0, sx_s.start - 1), min(w, sx_s.stop + 1)
                sub_mask = plab[y0:y1, x0:x1] == lbl
                ring = ndimage.binary_dilation(sub_mask, iterations=1) & (~sub_mask)
                border_lums = lum[y0:y1, x0:x1][ring]
                if len(border_lums) > 0 and float((border_lums < 135).mean()) > 0.34:
                    bg_mask[y0:y1, x0:x1][sub_mask] = True

    # Soft anti-aliased perimeter ramp (1-2px fringe touching bg_mask)
    fg = ~bg_mask
    near_bg_1 = ndimage.binary_dilation(bg_mask, iterations=1)
    near_bg_2 = ndimage.binary_dilation(near_bg_1, iterations=1)
    edge1 = near_bg_1 & fg
    edge2 = near_bg_2 & fg & (~edge1)

    alpha = np.where(bg_mask, 0.0, 255.0).astype(np.float32)

    # Smooth feather on bright anti-aliased edge pixels + un-premultiply white matte halo
    out_rgb = rgba[:, :, :3].astype(np.float32)
    high_lum = np.clip((lum - 140.0) / 108.0, 0.0, 1.0)
    neutral = np.clip(1.0 - (cmax - cmin) / 40.0, 0.0, 1.0)

    for ring_mask, weight in ((edge1, 0.92), (edge2, 0.42)):
        m = ring_mask & (lum > 155)
        a_frac = np.clip(1.0 - weight * high_lum * (0.45 + 0.55 * neutral), 0.12, 1.0)
        alpha = np.where(m, np.minimum(alpha, 255.0 * a_frac), alpha)
        denom = np.maximum(a_frac, 0.25)[:, :, None]
        bg_comp = (1.0 - a_frac)[:, :, None] * 246.0
        dehalo = np.clip((out_rgb - bg_comp) / denom, 0.0, 255.0)
        out_rgb = np.where(m[:, :, None], dehalo, out_rgb)

    rgba[:, :, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def find_largest_components_per_cell(fg_mask: np.ndarray, grid_cols: int, grid_rows: int):
    """Assign each foreground connected component cleanly to its grid cell via fast scipy.ndimage."""
    h, w = fg_mask.shape
    cw, ch = w / grid_cols, h / grid_rows
    dil = ndimage.binary_dilation(fg_mask, iterations=2)
    labeled, n_cc = ndimage.label(dil)
    counts = np.bincount(labeled.ravel())
    slices = ndimage.find_objects(labeled)
    cells = [[[] for _ in range(grid_cols)] for _ in range(grid_rows)]
    for lbl in range(1, n_cc + 1):
        if counts[lbl] < 35 or slices[lbl - 1] is None:
            continue
        sy_s, sx_s = slices[lbl - 1]
        cent_x = (sx_s.start + sx_s.stop) * 0.5
        cent_y = (sy_s.start + sy_s.stop) * 0.5
        c_idx = min(grid_cols - 1, max(0, int(cent_x // cw)))
        r_idx = min(grid_rows - 1, max(0, int(cent_y // ch)))
        cells[r_idx][c_idx].append((sx_s.start, sy_s.start, sx_s.stop, sy_s.stop, lbl))
    return cells, labeled


def place_in_cell_128(sprite: Image.Image, target_h: int = 104, bottom_pad: int = 4) -> Image.Image:
    """Scale character cleanly into 128x128 preserving aspect, anchored bottom-center."""
    arr = np.array(sprite)
    ys, xs = np.where(arr[:, :, 3] > 24)
    if len(ys) == 0:
        return Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    crop = sprite.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    scale = min(target_h / max(1, crop.height), 118.0 / max(1, crop.width))
    nw = max(1, int(round(crop.width * scale)))
    nh = max(1, int(round(crop.height * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    px = (128 - nw) // 2
    py = 128 - bottom_pad - nh
    cell.alpha_composite(resized, (max(0, px), max(0, py)))
    return cell


def recolor_tiny_variant(cell: Image.Image, variant: int) -> Image.Image:
    """
    Create 4 crisp outfit colorways while strictly protecting skin tones, hair, eyes, and shoes:
    variant 0: Navy Coat / Grey Hoodie (master)
    variant 1: Warm Camel-Tan Coat / Cream Hoodie
    variant 2: Forest Olive Parka / Moss Hoodie
    variant 3: Deep Burgundy-Wine Coat / Charcoal Hoodie
    """
    if variant == 0:
        return cell
    arr = np.array(cell.convert("RGBA"))
    a = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.float32) / 255.0
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    df = mx - mn
    # Identify navy/slate coat pixels: cool blue bias (b >= r + 0.025) & mid-dark lum (0.11..0.46)
    coat_mask = (a > 24) & (b > r + 0.022) & (b >= g) & (mx >= 0.11) & (mx <= 0.48)
    # Identify inner grey hoodie pixels: low chroma neutral grey in middle brightness (0.42..0.72) above legs
    ys_grid, _ = np.mgrid[0:cell.height, 0:cell.width]
    hoodie_mask = (a > 24) & (df < 0.045) & (mx >= 0.40) & (mx <= 0.72) & (ys_grid < 82)

    out = rgb.copy()
    if variant == 1:  # Camel Coat / Warm Sand Hoodie
        out[coat_mask, 0] = np.clip(rgb[coat_mask, 2] * 1.48 + 0.06, 0, 0.78)
        out[coat_mask, 1] = np.clip(rgb[coat_mask, 2] * 1.12 + 0.03, 0, 0.62)
        out[coat_mask, 2] = np.clip(rgb[coat_mask, 0] * 0.92 + 0.01, 0, 0.44)
        out[hoodie_mask, 0] = np.clip(rgb[hoodie_mask, 0] * 1.07, 0, 0.85)
        out[hoodie_mask, 1] = np.clip(rgb[hoodie_mask, 1] * 1.03, 0, 0.82)
        out[hoodie_mask, 2] = np.clip(rgb[hoodie_mask, 2] * 0.92, 0, 0.76)
    elif variant == 2:  # Olive Parka / Charcoal Hoodie
        out[coat_mask, 0] = np.clip(rgb[coat_mask, 1] * 0.95 + 0.03, 0, 0.44)
        out[coat_mask, 1] = np.clip(rgb[coat_mask, 2] * 1.08 + 0.04, 0, 0.52)
        out[coat_mask, 2] = np.clip(rgb[coat_mask, 0] * 0.85 + 0.02, 0, 0.34)
        out[hoodie_mask] = np.clip(rgb[hoodie_mask] * np.array([0.84, 0.88, 0.82]), 0, 0.7)
    elif variant == 3:  # Deep Burgundy Coat / Cool Steel Hoodie
        out[coat_mask, 0] = np.clip(rgb[coat_mask, 2] * 1.42 + 0.05, 0, 0.68)
        out[coat_mask, 1] = np.clip(rgb[coat_mask, 0] * 0.82 + 0.02, 0, 0.32)
        out[coat_mask, 2] = np.clip(rgb[coat_mask, 1] * 0.88 + 0.03, 0, 0.38)
        out[hoodie_mask] = np.clip(rgb[hoodie_mask] * np.array([0.86, 0.88, 0.94]), 0, 0.75)

    res = np.zeros_like(arr)
    res[:, :, :3] = np.clip(out * 255.0, 0, 255).astype(np.uint8)
    res[:, :, 3] = a
    return Image.fromarray(res, "RGBA")


def build_tinies_sheet():
    print("Building HD tinies sprite sheet (2048x512)...")
    src = Image.open(TINIES_MASTER)
    matted = remove_white_bg_clean(src, white_thresh=234, chroma_thresh=18, clean_enclosed_gaps=True)
    m_arr = np.array(matted)
    fg = m_arr[:, :, 3] > 32
    cells_cc, comp_labels = find_largest_components_per_cell(fg, 4, 3)

    base_block = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    # Target heights preserve consistent human proportions across standing vs crouched/prone rows
    row_targets = [
        [108, 108, 108, 108],  # row 0: walking looking up
        [106, 104, 104, 100],  # row 1: panic sprint
        [102, 68, 52, 74],     # row 2: limp, crawl, prone cower, supine reach
    ]
    raw_cells = {}
    for r in range(3):
        for c in range(4):
            comps = cells_cc[r][c]
            assert comps, f"Missing character component at row={r}, col={c}"
            minx = min(x[0] for x in comps)
            miny = min(x[1] for x in comps)
            maxx = max(x[2] for x in comps)
            maxy = max(x[3] for x in comps)
            lbl_ids = [x[4] for x in comps]
            mask_sub = np.isin(comp_labels[miny:maxy, minx:maxx], lbl_ids) & (m_arr[miny:maxy, minx:maxx, 3] > 0)
            cell_rgba = np.zeros((maxy - miny, maxx - minx, 4), dtype=np.uint8)
            cell_rgba[mask_sub] = m_arr[miny:maxy, minx:maxx][mask_sub]

            sprite_im = Image.fromarray(cell_rgba, "RGBA")
            placed = place_in_cell_128(sprite_im, target_h=row_targets[r][c], bottom_pad=4)
            raw_cells[(r, c)] = placed
            base_block.alpha_composite(placed, (c * 128, r * 128))

    # Row 3 (derived action/tumble frames):
    # (3,0): Limp stagger stride 2 (mirrored slight forward lean & dip)
    limp2 = raw_cells[(2, 0)].rotate(-7, resample=Image.Resampling.BICUBIC, center=(64, 120))
    base_block.alpha_composite(limp2, (0 * 128, 3 * 128))
    # (3,1..3): Faller / tumble frames from panic & supine poses rotated dynamically around center
    tumble_sources = [
        (raw_cells[(1, 1)], -24, 92),
        (raw_cells[(2, 3)], 38, 86),
        (raw_cells[(1, 2)], 135, 88),
    ]
    for idx, (src_pose, ang, tgt_h) in enumerate(tumble_sources, start=1):
        # Extract & rotate around center, place centered vertically/horizontally in 128x128
        arr_p = np.array(src_pose)
        ys, xs = np.where(arr_p[:, :, 3] > 24)
        crop_p = src_pose.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
        rot_p = crop_p.rotate(ang, resample=Image.Resampling.BICUBIC, expand=True)
        arr_r = np.array(rot_p)
        ry, rx = np.where(arr_r[:, :, 3] > 24)
        crop_r = rot_p.crop((int(rx.min()), int(ry.min()), int(rx.max()) + 1, int(ry.max()) + 1))
        placed_t = place_in_cell_128(crop_r, target_h=tgt_h, bottom_pad=16)
        base_block.alpha_composite(placed_t, (idx * 128, 3 * 128))

    sheet = Image.new("RGBA", (2048, 512), (0, 0, 0, 0))
    for v in range(4):
        for r in range(4):
            for c in range(4):
                cell = base_block.crop((c * 128, r * 128, (c + 1) * 128, (r + 1) * 128))
                recolored = recolor_tiny_variant(cell, v)
                sheet.alpha_composite(recolored, ((v * 4 + c) * 128, r * 128))

    return sheet


def build_bedside_scenes():
    print("Building Act III HD bedside scenes (1280x768 Normal + Fever)...")
    src = Image.open(BEDSIDE_MASTER).convert("RGB")
    # Center crop to 5:3 (1280x768) preserving bedside lamp left & rain city window right
    sw, sh = src.size
    target_ratio = 1280.0 / 768.0
    if sw / sh > target_ratio:
        crop_w = int(round(sh * target_ratio))
        x0 = max(0, (sw - crop_w) // 2 - 20)  # keep warm bed/lamp left comfortably framed
        src = src.crop((x0, 0, x0 + crop_w, sh))
    normal = src.resize((1280, 768), Image.Resampling.LANCZOS)
    normal = normal.filter(ImageFilter.UnsharpMask(radius=1.1, percent=65, threshold=2))

    # Build Fever variant: richer amber lamp pool left, cooler stormy indigo rain window right, higher drama
    arr = np.array(normal, dtype=np.float32)
    h, w, _ = arr.shape
    ys, xs = np.mgrid[0:h, 0:w]
    # Lamp glow hotspot around (x=0.35*w, y=0.36*h) and floor reflection cone below it
    d_lamp = np.hypot((xs - w * 0.355) / (w * 0.30), (ys - h * 0.48) / (h * 0.48))
    warm_mask = np.clip(1.0 - d_lamp, 0.0, 1.0) ** 1.4
    win_mask = np.clip((xs - w * 0.44) / (w * 0.45), 0.0, 1.0) * (1.0 - warm_mask * 0.6)
    fever_arr = arr.copy()
    # Intensify contrast slightly
    mean_v = fever_arr.mean(axis=(0, 1), keepdims=True)
    fever_arr = (fever_arr - mean_v) * 1.09 + mean_v * 0.96
    # Warm golden rim bloom
    fever_arr[:, :, 0] += warm_mask * 26.0
    fever_arr[:, :, 1] += warm_mask * 12.0
    fever_arr[:, :, 2] -= warm_mask * 8.0
    # Deepen rainy indigo atmosphere on right
    fever_arr[:, :, 0] -= win_mask * 8.0
    fever_arr[:, :, 2] += win_mask * 14.0
    fever = Image.fromarray(np.clip(fever_arr, 0, 255).astype(np.uint8), "RGB")
    return normal, fever


def apply_twill_and_clarity(rgba_im: Image.Image, skin: str, pose_idx: int) -> Image.Image:
    """
    Elevate _art_refs 640x1024 poses:
    - Subtle anisotropic diagonal trouser weave in dark jogger fabric
    - Edge-aware crisp clarity boost
    - Special de-plastification of paws underside pads (poses 1, 2, 10): velvet matte rose-terracotta suede
    - Atmospheric depth shading on back leg poses (6..10)
    """
    arr = np.array(rgba_im.convert("RGBA")).astype(np.float32)
    h, w, _ = arr.shape
    rgb = arr[:, :, :3]
    a = arr[:, :, 3]
    lum = rgb.mean(axis=2)
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1.0)

    # 1. Trouser weave & upper shading enhancement (charcoal neutral dark fabric, excluding pure black outline & shoes)
    ys_g, xs_g = np.mgrid[0:h, 0:w]
    in_cuff_zone = ys_g < int(h * (0.48 if pose_idx not in (1, 2, 10) else 0.36))
    trouser_mask = (a > 120) & in_cuff_zone & (lum >= 28) & (lum <= 122) & (sat < 0.25)
    diag = np.sin((xs_g + ys_g * 0.9) * 1.15) * 0.5 + np.cos((xs_g - ys_g) * 2.1) * 0.3
    rgb[trouser_mask] = np.clip(rgb[trouser_mask] + diag[trouser_mask, None] * 2.4, 18, 255)
    if skin == "paws":
        # Harmonize reference grey-slate cuffs to deep matte charcoal matching paws poses 3..5
        cuff_tone = (a > 120) & (ys_g < int(h * 0.43)) & (lum >= 40) & (lum <= 130) & (sat < 0.22)
        rgb[cuff_tone, 0] *= 0.84
        rgb[cuff_tone, 1] *= 0.85
        rgb[cuff_tone, 2] *= 0.84

    # 2. Fix plastic pink paw pads on paws underside views (poses 1, 2, 10)
    if skin == "paws" and pose_idx in (1, 2, 10):
        # Pads are salmon/pink: R substantially above G & B, medium-high luminance
        r_c, g_c, b_c = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        raw_pad = (a > 120) & (r_c - g_c > 24) & (r_c - b_c > 18) & (r_c > 125) & (ys_g > int(h * 0.30))
        # Keep only the 4-5 real large oval toe/metacarpal pads (>= 2500 px at 640x1024), excluding heel skin noise
        pad_clean = ndimage.binary_closing(raw_pad, iterations=2)
        pad_clean = ndimage.binary_opening(pad_clean, iterations=2)
        plab, pn = ndimage.label(pad_clean)
        pad_mask = np.zeros_like(raw_pad)
        if pn > 0:
            pcounts = np.bincount(plab.ravel())
            ranked = sorted(
                (lbl for lbl in range(1, pn + 1) if pcounts[lbl] >= max(2200, int(h * w * 0.0034))),
                key=lambda l: pcounts[l],
                reverse=True,
            )[:5]
            for lbl in ranked:
                pad_mask |= (plab == lbl)
        if pad_mask.any():
            # Soft perimeter distance weighting inside pad blobs -> organic AO edge darken
            pm_im = Image.fromarray((pad_mask * 255).astype(np.uint8), "L")
            eroded1 = np.array(pm_im.filter(ImageFilter.MinFilter(7))) > 0
            eroded2 = np.array(pm_im.filter(ImageFilter.MinFilter(15))) > 0
            border_ao = pad_mask & (~eroded1)
            mid_ao = pad_mask & eroded1 & (~eroded2)

            # Kill sharp glossy specular highlights (white/bright spots on center of pink pads)
            spec = pad_mask & (lum > 188)
            rgb[spec] = rgb[spec] * 0.72 + np.array([196.0, 128.0, 122.0]) * 0.28

            # Warm velvet mauve-rose matte tint + subtle organic skin micro-texture
            grain = np.sin(xs_g * 0.95) * np.cos(ys_g * 0.85) * 2.8 + np.sin((xs_g + ys_g) * 2.3) * 1.5
            pad_rgb = rgb.copy()
            pad_rgb[:, :, 0] = rgb[:, :, 0] * 0.90 + 18.0 + grain
            pad_rgb[:, :, 1] = rgb[:, :, 1] * 0.84 + 10.0 + grain * 0.8
            pad_rgb[:, :, 2] = rgb[:, :, 2] * 0.82 + 12.0 + grain * 0.8
            # Apply smooth crease AO
            pad_rgb[border_ao] *= 0.85
            pad_rgb[mid_ao] *= 0.94
            rgb = np.where(pad_mask[:, :, None], np.clip(pad_rgb, 15, 225), rgb)

    # 3. Back foot depth recession (poses 6..10 sit behind foreground leg)
    if pose_idx >= 6:
        rgb[:, :, 0] *= 0.91
        rgb[:, :, 1] *= 0.93
        rgb[:, :, 2] *= 0.97

    # 4. Strip cast floor shadows strictly below the bottom-most dark-ink/saturated paw contour
    # (applies cleanly to all poses 0,1,2,6,7,8,9,10: never touches fur/toes above the bottom outline)
    if skin == "paws" and pose_idx in (0, 1, 2, 6, 7, 8, 9, 10):
        fg_b = a > 24
        solid = fg_b & ((lum < 128) | ((rgb.max(axis=2) - rgb.min(axis=2)) > 24))
        last_y = np.full(w, -1, dtype=int)
        for xx in range(w):
            ys_s = np.where(solid[:, xx])[0]
            if len(ys_s):
                last_y[xx] = int(ys_s[-1])
        # Seal 1px diagonal outline slopes by checking column min over [x-1..x+1] ONLY when not jumping upward >12px
        cmin = rgb.min(axis=2)
        cmax = rgb.max(axis=2)
        drop = fg_b & (ys_g >= int(h * 0.65)) & (last_y[None, :] >= 0) & (ys_g > last_y[None, :]) & ((cmax - cmin) <= 26)
        a[drop] = 0.0
        rgb[drop] = 0.0
        # Remove any detached exterior slivers not connected to the main upper leg body
        fg_after = a > 24
        flab, fn = ndimage.label(fg_after)
        if fn > 1:
            fcounts = np.bincount(flab.ravel())
            main_lbl = int(np.argmax(fcounts[1:]) + 1)
            small_sliver = (flab > 0) & (flab != main_lbl)
            a[small_sliver] = 0.0
            rgb[small_sliver] = 0.0
        # Soften 1px bottom-edge anti-aliased fringe below the ink outline
        y_band = int(h * 0.65)
        near_clr = ndimage.binary_dilation(a <= 24, iterations=1) & (a > 24) & (cmin >= 145) & ((cmax - cmin) <= 26)
        near_clr[:y_band, :] = False
        a[near_clr] *= 0.35

    out = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 255)]).astype(np.uint8), "RGBA")
    return out


def crop_fg_rgba(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    ys, xs = np.where(arr[:, :, 3] > 28)
    if len(ys) == 0:
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def measure_alpha_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    arr = np.array(im.convert("RGBA"))
    ys, xs = np.where(arr[:, :, 3] > 20)
    if len(ys) == 0:
        return (0, 0, im.width, im.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))


def warp_master_to_pose(master_rgba: Image.Image, target_bbox_480: tuple[int, int, int, int], pose_idx: int, skin: str) -> Image.Image:
    """
    Place an ultra-HD AI standing master cleanly into 480x768 matching target_bbox_480,
    with authentic biomechanical knee/ankle crouch for pose 4 (mid press) and pose 5 (heavy press).
    """
    x0, y0, x1, y1 = target_bbox_480
    tw = max(1, x1 - x0 + 1)
    th = max(1, y1 - y0 + 1)
    m_crop = crop_fg_rgba(master_rgba)

    canvas = Image.new("RGBA", (480, 768), (0, 0, 0, 0))
    # Resize preserving natural thickness around target bbox height/width
    scale = min(th / m_crop.height, (tw * 1.06) / m_crop.width)
    # Keep trousers extending firmly up toward y=0 so lifted feet never cut off mid-screen
    rw = max(1, min(472, int(round(m_crop.width * scale))))
    rh = max(1, min(762, int(round(m_crop.height * scale))))
    scaled = m_crop.resize((rw, rh), Image.Resampling.LANCZOS)

    # Apply subtle progressive crouch compression + forefoot splay on poses 4 and 5
    if pose_idx in (4, 5):
        arr = np.array(scaled)
        sh, sw, _ = arr.shape
        out_arr = np.zeros_like(arr)
        # Progressively widen bottom 34% slightly and drop cuff downward for authentic weight bearing
        drop_px = 10 if pose_idx == 4 else 22
        widen = 1.03 if pose_idx == 4 else 1.065
        ys_out = np.arange(sh, dtype=np.float32)
        # Bottom stays pinned at sh-1; upper leg drops down smoothly toward foot
        top_cut = drop_px
        t_rows = np.clip((ys_out - top_cut) / max(1.0, (sh - 1 - top_cut)), 0.0, 1.0)
        sy = t_rows * (sh - 1)
        iy0 = np.clip(np.floor(sy).astype(int), 0, sh - 2)
        fy = (sy - iy0)[:, None, None]
        compressed = arr[iy0] * (1.0 - fy) + arr[iy0 + 1] * fy
        # Horizontal sole splay near bottom 35%
        for yy in range(sh):
            foot_w = max(0.0, (t_rows[yy] - 0.62) / 0.38)
            hw_s = 1.0 + (widen - 1.0) * (foot_w ** 1.4)
            if hw_s > 1.001:
                cx_s = sw * 0.45
                xs_in = np.clip(cx_s + (np.arange(sw) - cx_s) / hw_s, 0, sw - 1.001)
                ix = xs_in.astype(int)
                fx = (xs_in - ix)[:, None]
                out_arr[yy] = np.clip(compressed[yy, ix] * (1.0 - fx) + compressed[yy, ix + 1] * fx, 0, 255).astype(np.uint8)
            else:
                out_arr[yy] = np.clip(compressed[yy], 0, 255).astype(np.uint8)
        scaled = Image.fromarray(out_arr, "RGBA")

    # Sharp crisp anime clarity pass
    rgb_p = scaled.convert("RGB").filter(ImageFilter.UnsharpMask(radius=0.9, percent=55, threshold=2))
    r_, g_, b_ = rgb_p.split()
    _, _, _, a_ = scaled.split()
    scaled = Image.merge("RGBA", (r_, g_, b_, a_))

    # Align horizontally centered inside target_bbox and pinned at bottom y1
    px = max(2, min(480 - rw - 2, int(round((x0 + x1) * 0.5 - rw * 0.5))))
    py = max(0, y1 - rh + 1)
    # If trouser stops slightly below y=0 because source aspect was tall, stretch top cuff strip up cleanly to y=0..6
    canvas.alpha_composite(scaled, (px, py))
    return extend_top_cuff_if_needed(canvas)


def extend_top_cuff_if_needed(canvas: Image.Image, target_top: int = 2) -> Image.Image:
    """If trouser top starts below target_top (gap when airborne), cleanly extend top fabric stripes up to y=2."""
    arr = np.array(canvas)
    row_cnt = (arr[:, :, 3] > 60).sum(axis=1)
    first_y = next((y for y in range(canvas.height) if row_cnt[y] > 24), None)
    if first_y is None or first_y <= target_top + 4 or first_y > 140:
        return canvas
    y_ref = min(canvas.height - 10, first_y + 4)
    xs_l = np.where(arr[y_ref, :, 3] > 80)[0]
    if len(xs_l) < 16:
        return canvas
    l0, r0 = float(xs_l[0]), float(xs_l[-1])
    y_ref2 = min(canvas.height - 4, y_ref + 14)
    xs_l2 = np.where(arr[y_ref2, :, 3] > 80)[0]
    dl = ((float(xs_l2[0]) - l0) / 14.0) if len(xs_l2) >= 16 else 0.0
    dr = ((float(xs_l2[-1]) - r0) / 14.0) if len(xs_l2) >= 16 else 0.0
    dl = max(-0.45, min(0.45, -dl))
    dr = max(-0.45, min(0.45, -dr))
    # Average 4 rows at y_ref as normalized profile
    n_grid = 180
    u = np.linspace(0, 1, n_grid)
    prof = np.zeros((n_grid, 4), dtype=np.float32)
    for yy in range(y_ref, y_ref + 4):
        xs_r = np.where(arr[yy, :, 3] > 60)[0]
        la, ra = float(xs_r[0]), float(xs_r[-1])
        sx = np.clip(la + u * max(1.0, ra - la), 0, canvas.width - 1.001)
        ix = sx.astype(int)
        fx = (sx - ix)[:, None]
        prof += arr[yy, ix] * (1.0 - fx) + arr[yy, ix + 1] * fx
    prof /= 4.0
    prof[6:-6, 3] = 255.0
    arr[:first_y, :, :] = 0
    for y in range(target_top, y_ref):
        dy = y_ref - y
        nl = max(0.0, min(canvas.width - 20.0, l0 + dl * dy))
        nr = max(nl + 16.0, min(canvas.width - 1.0, r0 + dr * dy))
        xs_d = np.arange(int(np.floor(nl)), int(np.ceil(nr)) + 1)
        uu = np.clip((xs_d - nl) / max(1.0, nr - nl), 0.0, 1.0) * (n_grid - 1)
        p0 = uu.astype(int)
        p1 = np.minimum(p0 + 1, n_grid - 1)
        pf = (uu - p0)[:, None]
        arr[y, xs_d] = np.clip(prof[p0] * (1.0 - pf) + prof[p1] * pf, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def calibrate_frame_geo(rgba_im: Image.Image) -> tuple[int, list[float]]:
    """Compute exact (bottom offset in 256-logical px, [contact_cx, contact_hw]) matching skin-packs.js."""
    arr = np.array(rgba_im.resize((160, 256), Image.Resampling.LANCZOS))
    a = arr[:, :, 3]
    ys = np.where((a > 20).any(axis=1))[0]
    if len(ys) == 0:
        return 2, [0.48, 0.36]
    max_y = int(ys[-1])
    band_start = max(0, max_y - 12)
    band = a[band_start : max_y + 1, :] > 20
    xs = np.where(band.any(axis=0))[0]
    cx = float((xs[0] + xs[-1]) * 0.5 / 160.0) if len(xs) else 0.48
    hw = float(max(0.08, (xs[-1] - xs[0]) * 0.5 / 160.0)) if len(xs) else 0.36
    pad_off = (255 - max_y) + 1
    return int(pad_off), [round(cx, 2), round(hw, 2)]


def build_all_skin_packs():
    print("Building 4 HD foot skin packs (aj5, qiaodan, socks, paws @ 480x768)...")
    masters = {
        k: remove_white_bg_clean(Image.open(path), white_thresh=232, chroma_thresh=18, clean_enclosed_gaps=False)
        for k, path in SKIN_MASTERS.items()
    }

    frames_by_skin = {}
    geo_map = {}

    for skin in ("aj5", "qiaodan", "socks", "paws"):
        frames = []
        front_offs, back_offs, front_contacts, back_contacts = [], [], [], []
        for idx in range(11):
            ref_path = os.path.join(ART_REFS, f"{skin}_pose{idx}.png")
            ref_raw = Image.open(ref_path)
            ref_matted = remove_white_bg_clean(ref_raw, white_thresh=236, chroma_thresh=16, clean_enclosed_gaps=(skin == "paws"))
            # Resize reference nicely to 480x768 to inspect exact bbox anchor
            ref_480 = ref_matted.resize((480, 768), Image.Resampling.LANCZOS)
            bbox = measure_alpha_bbox(ref_480)

            # Poses 3, 4, 5 use our ultra-HD AI master aligned cleanly to exact game crouch geometry!
            if idx in (3, 4, 5):
                frame_im = warp_master_to_pose(masters[skin], bbox, idx, skin)
            else:
                enhanced = apply_twill_and_clarity(ref_matted, skin, idx)
                frame_im = enhanced.resize((480, 768), Image.Resampling.LANCZOS)
                frame_im = extend_top_cuff_if_needed(frame_im)
                # Subtle micro-sharpening preserving outline & alpha
                rgb_s = frame_im.convert("RGB").filter(ImageFilter.UnsharpMask(radius=0.85, percent=48, threshold=2))
                r_, g_, b_ = rgb_s.split()
                _, _, _, a_ = frame_im.split()
                frame_im = Image.merge("RGBA", (r_, g_, b_, a_))

            off, contact = calibrate_frame_geo(frame_im)
            if idx < 6:
                front_offs.append(off)
                front_contacts.append(contact)
            else:
                back_offs.append(off)
                back_contacts.append(contact)
            frames.append(frame_im)

        frames_by_skin[skin] = frames
        geo_map[f"{skin}hd"] = {
            "frontOffsets": front_offs,
            "backOffsets": back_offs,
            "frontContact": front_contacts,
            "backContact": back_contacts,
        }
    return frames_by_skin, geo_map


def save_webp_to_roots(im: Image.Image, rel_path: str, quality: int = 86):
    targets = [
        os.path.join(ROOT, rel_path),
        os.path.join(RELEASE_GAME, rel_path),
    ]
    if os.path.isdir(DIST):
        targets.append(os.path.join(DIST, rel_path))
    buf = io.BytesIO()
    im.save(buf, format="WEBP", quality=quality, method=4)
    data = buf.getvalue()
    for t in targets:
        os.makedirs(os.path.dirname(t), exist_ok=True)
        with open(t, "wb") as f:
            f.write(data)
    return data


def update_act3_scene_uris(normal_webp_bytes: bytes, fever_webp_bytes: bytes):
    """Replace duplicated gaming-room Stage 3 normal/fever/bedside textures in 04-images-deferred.js and touch-v1-impact.js."""
    n_uri = "data:image/webp;base64," + base64.b64encode(normal_webp_bytes).decode("ascii")
    f_uri = "data:image/webp;base64," + base64.b64encode(fever_webp_bytes).decode("ascii")

    for base_dir in [RELEASE_GAME] + ([DIST] if os.path.isdir(DIST) else []):
        p_def = os.path.join(base_dir, "data", "04-images-deferred.js")
        if os.path.isfile(p_def):
            txt = open(p_def, "r", encoding="utf-8").read()
            txt = re.sub(r'("stage3Normal"\s*:\s*)"data:image/[^"]+"', lambda m: m.group(1) + f'"{n_uri}"', txt, count=1)
            txt = re.sub(r'("stage3Fever"\s*:\s*)"data:image/[^"]+"', lambda m: m.group(1) + f'"{f_uri}"', txt, count=1)
            txt = re.sub(r'("bedside"\s*:\s*)"data:image/[^"]+"', lambda m: m.group(1) + f'"{n_uri}"', txt, count=1)
            open(p_def, "w", encoding="utf-8", newline="").write(txt)
            print(f"Updated stage3Normal/stage3Fever/bedside in {os.path.relpath(p_def, ROOT)}")

        p_imp = os.path.join(base_dir, "data", "touch-v1-impact.js")
        if os.path.isfile(p_imp):
            raw = open(p_imp, "r", encoding="utf-8").read()
            eq = raw.index("=")
            prefix = raw[: eq + 1]
            html = json.loads(raw[eq + 1 :].strip().rstrip(";"))
            m_rsu = re.search(r"const realmSceneUris=\[(\[[^\]]+\]),(\[[^\]]+\]),(\[[^\]]+\])\];", html)
            assert m_rsu, "realmSceneUris[2] not found in touch-v1-impact.js"
            new_s3 = json.dumps([n_uri, f_uri])
            html = html[: m_rsu.start(3)] + new_s3 + html[m_rsu.end(3) :]
            # Also update inline realm_bedside fallback image
            i_bed = html.find("let realmArtReady=false;")
            assert i_bed >= 0
            seg = html[i_bed : i_bed + 600000]
            seg_new = re.sub(r'fetch\("data:image/[^"]+"\)', f'fetch("{n_uri}")', seg, count=1)
            html = html[:i_bed] + seg_new + html[i_bed + len(seg) :]
            out = prefix + json.dumps(html, ensure_ascii=False).replace("<", "\\u003c") + ";\n"
            open(p_imp, "w", encoding="utf-8", newline="").write(out)
            print(f"Updated Act III realmSceneUris[2] + realm_bedside in {os.path.relpath(p_imp, ROOT)}")


def write_visual_inspection_sheets(tinies_sheet: Image.Image, normal_bed: Image.Image, fever_bed: Image.Image, frames_by_skin: dict):
    os.makedirs(SCRATCH_DIR, exist_ok=True)
    # 1. Tinies check on dark charcoal ground (reveals any white matting halos!)
    t_bg = Image.new("RGBA", (2048, 512), (24, 34, 46, 255))
    t_bg.alpha_composite(tinies_sheet)
    t_bg.convert("RGB").save(os.path.join(SCRATCH_DIR, "inspect_tinies_hd.png"))

    # 2. Bedside normal vs fever
    cmp_bed = Image.new("RGB", (1280, 384))
    cmp_bed.paste(normal_bed.resize((640, 384), Image.Resampling.LANCZOS), (0, 0))
    cmp_bed.paste(fever_bed.resize((640, 384), Image.Resampling.LANCZOS), (640, 0))
    cmp_bed.save(os.path.join(SCRATCH_DIR, "inspect_bedside_hd.png"))

    # 3. 4 skins x 11 frames on slate dark backdrop (reveals edges + paws matte pads!)
    W, H = 160, 256
    s_grid = Image.new("RGBA", (W * 11, H * 4), (26, 36, 48, 255))
    for r_i, skin in enumerate(("aj5", "qiaodan", "socks", "paws")):
        for c_i, fr in enumerate(frames_by_skin[skin]):
            s_grid.alpha_composite(fr.resize((W, H), Image.Resampling.LANCZOS), (c_i * W, r_i * H))
    s_grid.convert("RGB").save(os.path.join(SCRATCH_DIR, "inspect_skins_hd.png"))
    print("Saved visual inspection sheets in scratch/.")


def main():
    tinies = build_tinies_sheet()
    t_bytes = save_webp_to_roots(tinies, "assets/tinies/tinies-hd-v1.webp", quality=88)
    print(f"  tinies-hd-v1.webp: {len(t_bytes)/1024:.1f} KB")

    bed_n, bed_f = build_bedside_scenes()
    bn_bytes = save_webp_to_roots(bed_n, "assets/rooms/bedside-hd.webp", quality=86)
    bf_bytes = save_webp_to_roots(bed_f, "assets/rooms/bedside-hd-fever.webp", quality=86)
    print(f"  bedside-hd.webp: {len(bn_bytes)/1024:.1f} KB, bedside-hd-fever.webp: {len(bf_bytes)/1024:.1f} KB")

    update_act3_scene_uris(bn_bytes, bf_bytes)

    frames_by_skin, geo_map = build_all_skin_packs()
    total_skin_bytes = 0
    for skin, frames in frames_by_skin.items():
        pack_b = 0
        for idx, fr in enumerate(frames):
            b = save_webp_to_roots(fr, f"assets/{skin}-hd/{idx}.webp", quality=85)
            pack_b += len(b)
        total_skin_bytes += pack_b
        print(f"  assets/{skin}-hd/0..10.webp: {pack_b/1024:.1f} KB")
    print(f"  Total across 4 new HD packs (44 frames): {total_skin_bytes/1024:.1f} KB")

    geo_path = os.path.join(ROOT, "src", "art-hd-geo.json")
    os.makedirs(os.path.dirname(geo_path), exist_ok=True)
    with open(geo_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(geo_map, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Wrote calibrated geometry -> src/art-hd-geo.json")

    write_visual_inspection_sheets(tinies, bed_n, bed_f, frames_by_skin)


if __name__ == "__main__":
    main()
