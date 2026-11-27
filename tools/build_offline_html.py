"""Build a standalone single-file offline HTML (dist/cunjie-offline.html) for Android / file:// play."""
import argparse
import base64
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

ASSET_MIME = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".svg": "image/svg+xml",
}

AJ6_HD_ASSETS = [f"assets/aj6-hd/{i}.webp" for i in range(11)]
HD_SKIN_NAMES = ("aj5", "aj6", "qiaodan", "socks", "paws")
SKIN_HD_ASSETS = {skin: [f"assets/{skin}-hd/{i}.webp" for i in range(11)] for skin in HD_SKIN_NAMES}
HD_EXTRA_ASSETS = [
    "assets/tinies/tinies-hd-v1.webp",
    "assets/rooms/bedside-hd.webp",
    "assets/rooms/bedside-hd-fever.webp",
] + [p for skin in ("aj5", "qiaodan", "socks", "paws") for p in SKIN_HD_ASSETS[skin]]

PATCHED_ASSETS = [
    "assets/rooftop/aj6.webp",
    "assets/qiaodan-flatheel-v4.webp",
    "assets/rooftop/day.webp",
    "assets/rooftop/night.webp",
    "assets/rooms/bedroom-wood.webp",
    "assets/rooms/room-rain.webp",
    "assets/rooms/room-warm.webp",
    "assets/impact/contact-dust-v2.webp",
    "assets/impact/floor-residue-v3.png",
    "assets/impact/impact-atlas-v1.png",
    "assets/fenrir/fenrir-city-blue-hour.webp",
    "assets/fenrir/fenrir-motion-v3.png",
] + AJ6_HD_ASSETS + HD_EXTRA_ASSETS


def to_data_uri(game_dir, rel_path):
    fp = os.path.join(game_dir, rel_path.replace("/", os.sep))
    ext = os.path.splitext(fp)[1].lower()
    mime = ASSET_MIME[ext]
    with open(fp, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode("ascii")


def inline_safe(js_text):
    # Ensure raw script bodies cannot accidentally terminate an enclosing <script> tag.
    return js_text.replace("</script", "<\\/script").replace("</SCRIPT", "<\\/SCRIPT")


def inline_asset(text, path, uri):
    for quote in ("'", '"'):
        for prefix in ("/", ""):
            text = text.replace(f"{quote}{prefix}{path}{quote}", f"{quote}{uri}{quote}")
    return text


def build_offline_html(game_dir=DIST, entry="impact.html"):
    uris = {rel: to_data_uri(game_dir, rel) for rel in PATCHED_ASSETS}
    html = open(os.path.join(game_dir, entry), encoding="utf-8").read()
    for pwa_link in (
        '<link rel="manifest" href="manifest.webmanifest">',
        '<link rel="icon" type="image/png" sizes="192x192" href="assets/icons/icon-192.png">',
        '<link rel="apple-touch-icon" sizes="180x180" href="assets/icons/icon-180.png">',
    ):
        html = html.replace(pwa_link, "")

    # Load and inline dist/scripts/room-choice.js right where it appears inside <select>.
    room_choice = inline_safe(open(os.path.join(game_dir, "scripts", "room-choice.js"), encoding="utf-8").read())
    rc_tag = '<script src="scripts/room-choice.js"></script>'
    assert rc_tag in html, "Missing room-choice.js script tag"
    html = html.replace(rc_tag, f"<script>{room_choice}</script>", 1)

    # Order all data bundles cleanly before the host runtime scripts.
    boot_imgs = open(os.path.join(game_dir, "data", "04-images-boot.js"), encoding="utf-8").read()
    for rel in ["assets/rooftop/aj6.webp", "assets/qiaodan-flatheel-v4.webp"]:
        boot_imgs = boot_imgs.replace(f'"{rel}"', f'"{uris[rel]}"')

    def_imgs = open(os.path.join(game_dir, "data", "04-images-deferred.js"), encoding="utf-8").read()

    # Inline /assets/... references inside touch-v1-impact.js so srcdoc works offline / file://.
    impact_raw = open(os.path.join(game_dir, "data", "touch-v1-impact.js"), encoding="utf-8").read()
    eq = impact_raw.index("=")
    story_html = json.loads(impact_raw[eq + 1 :].strip().rstrip(";"))
    for rel in [
        "assets/rooftop/day.webp",
        "assets/rooftop/night.webp",
        "assets/rooms/bedroom-wood.webp",
        "assets/rooms/room-rain.webp",
        "assets/rooms/room-warm.webp",
        "assets/impact/contact-dust-v2.webp",
        "assets/impact/floor-residue-v3.png",
        "assets/impact/impact-atlas-v1.png",
    ]:
        assert rel in story_html, f"Missing {rel} inside storyLegacy"
        story_html = inline_asset(story_html, rel, uris[rel])

    for sm in re.finditer(r"<script[^>]*>([\s\S]*?)</script>", story_html):
        res = subprocess.run(["node", "--check"], input=sm.group(1), text=True, capture_output=True)
        if res.returncode != 0:
            raise RuntimeError(f"Offline storyLegacy syntax check failed: {res.stderr}")
    impact_inlined = 'DATA["storyLegacy"]=' + json.dumps(story_html, ensure_ascii=False).replace("<", "\\u003c") + ";\n"

    # Inline /assets/... references inside touch-v1-free.js (Fenrir City) so free mode works offline too.
    free_raw = open(os.path.join(game_dir, "data", "touch-v1-free.js"), encoding="utf-8").read()
    feq = free_raw.index("=")
    free_html = json.loads(free_raw[feq + 1 :].strip().rstrip(";"))
    backdrop = "assets/fenrir/fenrir-city-blue-hour.webp"
    assert backdrop in free_html, "Missing Fenrir fallback backdrop"
    free_html = inline_asset(free_html, backdrop, uris[backdrop])
    for sm in re.finditer(r"<script[^>]*>([\s\S]*?)</script>", free_html):
        res = subprocess.run(["node", "--check"], input=sm.group(1), text=True, capture_output=True)
        if res.returncode != 0:
            raise RuntimeError(f"Offline freeLegacy syntax check failed: {res.stderr}")
    free_inlined = 'DATA["freeLegacy"]=' + json.dumps(free_html, ensure_ascii=False).replace("<", "\\u003c") + ";\n"

    # Share HD assets once on window.parent.DATA (read by host previews, story & free iframes).
    skin_hd_map = {skin: [uris[p] for p in paths] for skin, paths in SKIN_HD_ASSETS.items()}
    room_hd_map = {
        "rooftop-day": uris["assets/rooftop/day.webp"],
        "rooftop-night": uris["assets/rooftop/night.webp"],
        "bedroom-wood": uris["assets/rooms/bedroom-wood.webp"],
        "warm": uris["assets/rooms/room-warm.webp"],
        "rain": uris["assets/rooms/room-rain.webp"],
    }
    aj6_hd_js = (
        f'DATA["aj6Hd"]={json.dumps([uris[rel] for rel in AJ6_HD_ASSETS], ensure_ascii=False, separators=(",", ":"))};\n'
        f'DATA["tiniesHd"]={json.dumps(uris["assets/tinies/tinies-hd-v1.webp"], ensure_ascii=False, separators=(",", ":"))};\n'
        f'DATA["skinHd"]={json.dumps(skin_hd_map, ensure_ascii=False, separators=(",", ":"))};\n'
        f'DATA["rooms"]={json.dumps(room_hd_map, ensure_ascii=False, separators=(",", ":"))};\n'
    )

    host3_js = inline_safe(open(os.path.join(game_dir, "scripts", "impact-host-3.js"), encoding="utf-8").read())
    fenrir_rel = "assets/fenrir/fenrir-motion-v3.png"
    assert fenrir_rel in host3_js, "Missing Fenrir motion URL"
    host3_js = inline_asset(host3_js, fenrir_rel, uris[fenrir_rel])

    layer_uris = {
        f"assets/fenrir/city-{layer}.svg": to_data_uri(game_dir, f"assets/fenrir/city-{layer}.svg")
        for layer in ("far", "mid", "near")
    }
    scene_path = "scripts/fenrir-scene-v1.js"
    with open(os.path.join(game_dir, scene_path), encoding="utf-8") as scene:
        scene_code = f"window.__cunjieFenrirSceneLayers={json.dumps(layer_uris)};\n" + scene.read()
    assert host3_js.count(scene_path) == 1, "Missing or repeated Fenrir scene script in the host"
    scene_uri = "data:text/javascript;base64," + base64.b64encode(scene_code.encode("utf-8")).decode("ascii")
    host3_js = host3_js.replace(scene_path, scene_uri)

    cin_js = open(os.path.join(game_dir, "data", "13-cinematics.js"), encoding="utf-8").read()

    script_paths = [
        "scripts/render-quality.js",
        "scripts/skin-packs.js",
        "data/00-init.js",
        "data/01-stages.js",
        "data/02-lines.js",
        "data/03-original.js",
        ("INLINE_BOOT_IMAGES", boot_imgs),
        ("INLINE_DEFERRED_IMAGES", def_imgs),
        ("INLINE_AJ6_HD", aj6_hd_js),
        "data/05-audio.js",
        ("INLINE_FREE_LEGACY", free_inlined),
        ("INLINE_STORY_LEGACY", impact_inlined),
        "data/08-visualConfig.js",
        "data/09-fever.js",
        "data/10-tinyVoices.js",
        "data/11-reactiveGiant.js",
        "data/12-responses.js",
        ("INLINE_CINEMATICS", cin_js),
        "scripts/touch-v1-impact-host-1.js",
        "scripts/host-2.js",
        ("INLINE_HOST_3", host3_js),
        "scripts/tech-dread-v1.js",
    ]

    tail_anchor = '<script src="scripts/render-quality.js"></script>'
    end_anchor = "</body></html>"
    a = html.index(tail_anchor)
    b = html.index(end_anchor, a)

    chunks = []
    for item in script_paths:
        if isinstance(item, tuple):
            content = item[1]
        else:
            content = inline_safe(open(os.path.join(game_dir, item.replace("/", os.sep)), encoding="utf-8").read())
        chunks.append(f"<script>{content}</script>")

    out_html = html[:a] + "".join(chunks) + html[b:]
    os.makedirs(DIST, exist_ok=True)
    out_path = os.path.join(DIST, "cunjie-offline.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out_html)
    print(f"Built offline single-file HTML: {out_path} ({os.path.getsize(out_path)/1024/1024:.2f} MiB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", action="store_true", help="Build from the tracked static release")
    args = parser.parse_args()
    if args.release:
        build_offline_html(os.path.join(ROOT, "dist-release", "game"), "index.html")
    else:
        build_offline_html()
