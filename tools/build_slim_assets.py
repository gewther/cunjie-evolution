"""Build slimmed asset bundles for dist/impact.html without altering legacy bundles."""
import base64
import io
import json
import os
import re
import subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")


def load_data_assignment(path):
    raw = open(path, encoding="utf-8").read()
    eq = raw.index("=")
    body = raw[eq + 1 :].strip()
    if body.endswith(";"):
        body = body[:-1]
    return json.loads(body)


def encode_webp_b64(png_b64, lossless=False, quality=90):
    raw = base64.b64decode(png_b64)
    im = Image.open(io.BytesIO(raw))
    buf = io.BytesIO()
    if lossless:
        im.save(buf, format="WEBP", lossless=True, exact=True, method=6)
    else:
        im.convert("RGB").save(buf, format="WEBP", quality=quality, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def slim_embedded_bedside():
    path = os.path.join(DIST, "data", "touch-v1-impact.js")
    h = load_data_assignment(path)
    pat = re.compile(r'(let realmArtReady=false;\s*fetch\(")(data:image/png;base64,([A-Za-z0-9+/=]+))("\))')
    m = pat.search(h)
    if not m:
        print("touch-v1-impact.js: embedded bedside already slimmed or absent")
        return
    webp_uri = encode_webp_b64(m.group(3), lossless=False, quality=90)
    h2 = h[: m.start(2)] + webp_uri + h[m.end(2) :]
    for sm in re.finditer(r"<script[^>]*>([\s\S]*?)</script>", h2):
        res = subprocess.run(["node", "--check"], input=sm.group(1), text=True, capture_output=True)
        if res.returncode != 0:
            raise RuntimeError(f"Inner script syntax check failed: {res.stderr}")
    out = 'DATA["storyLegacy"]=' + json.dumps(h2, ensure_ascii=False).replace("<", "\\u003c") + ";\n"
    old_sz = os.path.getsize(path)
    with open(path, "w", encoding="utf-8") as f:
        f.write(out)
    new_sz = os.path.getsize(path)
    print(f"touch-v1-impact.js: {old_sz/1024:.1f} KB -> {new_sz/1024:.1f} KB (bedside PNG -> WebP)")


def build_split_image_bundles():
    imgs = load_data_assignment(os.path.join(DIST, "data", "04-images.js"))

    def png_uri_to_webp(uri, lossless=True, quality=90):
        _, b64 = uri.split(",", 1)
        return encode_webp_b64(b64, lossless=lossless, quality=quality)

    boot = {
        "sneakers": imgs["sneakers"],
        "sneakersAJ6": "assets/rooftop/aj6.webp",
        "sneakersQiaodan": "assets/qiaodan-flatheel-v4.webp",
        "background": png_uri_to_webp(imgs["background"], lossless=True),
        "tinies": png_uri_to_webp(imgs["tinies"], lossless=True),
        "stage1Normal": imgs["stage1Normal"],
    }
    deferred = {
        "socks": png_uri_to_webp(imgs["socks"], lossless=True),
        "paws": png_uri_to_webp(imgs["paws"], lossless=True),
        "bedside": png_uri_to_webp(imgs["bedside"], lossless=False, quality=90),
        "stage1Fever": imgs["stage1Fever"],
        "stage2Normal": imgs["stage2Normal"],
        "stage2Fever": imgs["stage2Fever"],
        "stage3Normal": imgs["stage3Normal"],
        "stage3Fever": imgs["stage3Fever"],
        "feverFaces": imgs["feverFaces"],
    }

    boot_path = os.path.join(DIST, "data", "04-images-boot.js")
    def_path = os.path.join(DIST, "data", "04-images-deferred.js")
    with open(boot_path, "w", encoding="utf-8") as f:
        f.write('DATA["images"]=' + json.dumps(boot, ensure_ascii=True, separators=(",", ":")) + ";\n")
    with open(def_path, "w", encoding="utf-8") as f:
        f.write('Object.assign(DATA["images"],' + json.dumps(deferred, ensure_ascii=True, separators=(",", ":")) + ");\n")

    print(f"04-images-boot.js: {os.path.getsize(boot_path)/1024:.1f} KB")
    print(f"04-images-deferred.js: {os.path.getsize(def_path)/1024:.1f} KB")


if __name__ == "__main__":
    slim_embedded_bedside()
    build_split_image_bundles()
