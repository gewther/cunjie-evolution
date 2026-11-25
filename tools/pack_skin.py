"""Validate and package a folder of shoe/sock/paw/character art into a Cunjie v6.0 Skin Pack (.zip).

Usage:
  python tools/pack_skin.py --dir ./my_aj11 --slot shoe --name "AJ11 Concord" --out ./aj11-pack.zip
  python tools/pack_skin.py --dir ./my_char --slot character --name "New OC" --bg ./street.webp --out ./oc.zip

Accepted inputs inside --dir:
  - 11 HD frame files named 0.webp..10.webp (or 0.png..10.png): 0..5 = Front F0..F5, 6..10 = Back B0..B4
  - OR a single 1024x1024 atlas named atlas.png / atlas.webp (or any single 1024x1024 PNG/WebP file)
"""
import argparse
import json
import os
import zipfile
from PIL import Image

VALID_SLOTS = ("shoe", "socks", "paws", "character")


def scan_cell_image(im):
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    max_y = -1
    for y in range(h - 1, -1, -1):
        if any(px[x, y][3] > 20 for x in range(w)):
            max_y = y
            break
    if max_y < 0:
        return 2, [0.48, 0.36], None
    band = max(1, round(12 * (h / 256.0)))
    xs = [x for y in range(max(0, max_y - band), max_y + 1) for x in range(w) if px[x, y][3] > 20]
    cx = round(((min(xs) + max(xs)) / 2) / w, 2) if xs else 0.48
    hw = round(max(0.08, ((max(xs) - min(xs)) / 2) / w), 2) if xs else 0.36
    pad_logical = round(((h - 1) - max_y) / (h / 256.0))
    mask_band = max(1, round(24 * (h / 256.0)))
    mask = []
    for mx in range(160):
        sx = min(w - 1, int(mx * (w / 160.0)))
        hit = 1 if any(px[sx, y][3] >= 128 for y in range(max(0, h - mask_band), h)) else 0
        mask.append(hit)
    return pad_logical + 1, [cx, hw], (mask if any(mask) else None)


def pack_skin(src_dir, slot, name, out_zip, bg_path=None, warm_light=None):
    assert slot in VALID_SLOTS, f"Invalid slot '{slot}', choose from {VALID_SLOTS}"
    manifest = {"version": 1, "name": name, "slot": slot}
    if warm_light is not None:
        manifest["warmLight"] = bool(warm_light)

    # Detect 11 HD frames
    hd_files = []
    for i in range(11):
        found = None
        for ext in (".webp", ".png"):
            cand = os.path.join(src_dir, f"{i}{ext}")
            if os.path.isfile(cand):
                found = cand
                break
        if found:
            hd_files.append(found)

    entries = []
    if len(hd_files) == 11:
        manifest["frames"] = [os.path.basename(f) for f in hd_files]
        front_off, front_con, back_off, back_con, masks = [], [], [], [], []
        for idx, fp in enumerate(hd_files):
            with Image.open(fp) as im:
                off, con, msk = scan_cell_image(im)
            if idx < 6:
                front_off.append(off)
                front_con.append(con)
                if idx >= 3:
                    masks.append(msk or [1] * 160)
            else:
                back_off.append(off)
                back_con.append(con)
            entries.append((os.path.basename(fp), fp))
        manifest["geo"] = {
            "frontOffsets": front_off,
            "backOffsets": back_off,
            "frontContact": front_con,
            "backContact": back_con,
        }
        manifest["masks"] = masks
    else:
        atlas = None
        for cand in ("atlas.png", "atlas.webp"):
            p = os.path.join(src_dir, cand)
            if os.path.isfile(p):
                atlas = p
                break
        if not atlas:
            imgs = [os.path.join(src_dir, f) for f in sorted(os.listdir(src_dir)) if f.lower().endswith((".png", ".webp"))]
            if len(imgs) == 1:
                atlas = imgs[0]
        if not atlas:
            raise SystemExit("Expected either 11 HD frames (0..10.webp/png) or a single 1024x1024 atlas.png/webp")
        with Image.open(atlas) as im:
            if im.size != (1024, 1024):
                raise SystemExit(f"Atlas must be 1024x1024, got {im.size}")
            front_off, front_con, back_off, back_con, masks = [], [], [], [], []
            for idx in range(6):
                sx, sy = (idx // 3) * 160, (idx % 3) * 256
                off, con, msk = scan_cell_image(im.crop((sx, sy, sx + 160, sy + 256)))
                front_off.append(off)
                front_con.append(con)
                if idx >= 3:
                    masks.append(msk or [1] * 160)
            for idx in range(5):
                sx, sy = 320 + (idx // 3) * 160, (idx % 3) * 256
                off, con, _ = scan_cell_image(im.crop((sx, sy, sx + 160, sy + 256)))
                back_off.append(off)
                back_con.append(con)
        manifest["atlas"] = os.path.basename(atlas)
        manifest["geo"] = {
            "frontOffsets": front_off,
            "backOffsets": back_off,
            "frontContact": front_con,
            "backContact": back_con,
        }
        manifest["masks"] = masks
        entries.append((os.path.basename(atlas), atlas))

    if bg_path:
        if not os.path.isfile(bg_path):
            raise SystemExit(f"Background not found: {bg_path}")
        bg_name = "bg" + os.path.splitext(bg_path)[1].lower()
        manifest["background"] = bg_name
        entries.append((bg_name, bg_path))

    os.makedirs(os.path.dirname(os.path.abspath(out_zip)), exist_ok=True)
    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_STORED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        for arcname, fp in entries:
            zf.write(fp, arcname)
    print(f"Packed Cunjie skin pack: {out_zip} ({os.path.getsize(out_zip):,} bytes, slot={slot}, geo={manifest['geo']['frontOffsets']}/{manifest['geo']['backOffsets']})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", required=True, help="Source folder containing 0..10.webp/png or atlas.png/webp")
    ap.add_argument("--slot", required=True, choices=VALID_SLOTS, help="Target outfit/character slot")
    ap.add_argument("--name", required=True, help="Display name shown in the game")
    ap.add_argument("--out", required=True, help="Output .zip file path")
    ap.add_argument("--bg", default=None, help="Optional custom background image (.webp/.png)")
    ap.add_argument("--warm", choices=("true", "false"), default=None, help="Optional warm lighting hint")
    args = ap.parse_args()
    warm = None if args.warm is None else (args.warm == "true")
    pack_skin(args.dir, args.slot, args.name, args.out, bg_path=args.bg, warm_light=warm)
