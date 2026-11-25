"""Sync Plan B (native feel & 39-sound Stompgame audio pack) into dist bundles."""
import argparse
import base64
import json
import os
import re
import subprocess
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")


def load_data(path):
    raw = open(path, "r", encoding="utf-8").read()
    eq = raw.index("=")
    prefix = raw[: eq + 1]
    body = raw[eq + 1 :].strip().rstrip(";")
    return prefix, json.loads(body)


def save_data(path, prefix, obj, compact=False):
    sep = (",", ":") if compact else None
    payload = json.dumps(obj, ensure_ascii=False, separators=sep)
    if isinstance(obj, str):
        payload = payload.replace("<", "\\u003c")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"{prefix}{payload};\n")


def check_inner_scripts(html, label):
    for m in re.finditer(r"<script[^>]*>([\s\S]*?)</script>", html):
        res = subprocess.run(["node", "--check"], input=m.group(1), text=True, capture_output=True)
        if res.returncode != 0:
            raise RuntimeError(f"{label} syntax check failed: {res.stderr}")


def sync_impact_pass():
    impact_path = os.path.join(DIST, "data", "touch-v1-impact.js")
    prefix, html = load_data(impact_path)
    rects = json.loads(open(os.path.join(DIST, "assets", "impact", "atlas.json"), encoding="utf-8").read())["rects"]
    patch = open(os.path.join(ROOT, "src", "impact-pass.js"), encoding="utf-8").read().replace(
        "__IMPACT_RECTS__", json.dumps(rects)
    )
    if not patch.endswith("\n"):
        patch += "\n"
    start_marker = "/* Impact Feel Pass v1"
    end_marker = "/* Continuous hand-controlled vertical motion"
    a = html.index(start_marker)
    b = html.index(end_marker, a)
    html = html[:a] + patch + "\n" + html[b:]
    check_inner_scripts(html, "touch-v1-impact.js")
    save_data(impact_path, prefix, html)
    print("Synced src/impact-pass.js into dist/data/touch-v1-impact.js")


def merge_audio_pack(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        settings = json.loads(z.read("settings.json"))
        sound_urls = settings["sound_urls"]
        ogg_uris = {}
        for name in sorted(z.namelist()):
            if name.startswith("sfx/") and name.endswith(".ogg"):
                ogg_uris[name] = "data:audio/ogg;base64," + base64.b64encode(z.read(name)).decode("ascii")

    # 1. Merge into dist/data/05-audio.js while preserving existing keys (ambience, softslide, impact1..3).
    audio_path = os.path.join(DIST, "data", "05-audio.js")
    aprefix, adata = load_data(audio_path)
    for rel, uri in ogg_uris.items():
        adata[rel.split("/", 1)[1]] = uri
    save_data(audio_path, aprefix, adata, compact=True)
    print(f"Updated dist/data/05-audio.js -> {len(adata)} audio keys")

    # 2. Merge into xlAssets + sound_urls (top-level & apply_settings) in story & free engines.
    su_pretty = json.dumps(sound_urls, ensure_ascii=False, indent="\t")
    su_inline = json.dumps(sound_urls, ensure_ascii=False)
    for bundle in ("touch-v1-impact.js", "touch-v1-free.js"):
        bpath = os.path.join(DIST, "data", bundle)
        bprefix, html = load_data(bpath)

        xa_tag = "const xlAssets = "
        xa_a = html.index(xa_tag) + len(xa_tag)
        xa_b = html.index(";\napply_settings(", xa_a)
        xa = json.loads(html[xa_a:xa_b])
        xa.update(ogg_uris)
        html = html[:xa_a] + json.dumps(xa, ensure_ascii=False) + html[xa_b:]

        su_pat = re.compile(r"const sound_urls = \[[\s\S]*?\];")
        assert len(su_pat.findall(html)) == 1, f"Expected single const sound_urls in {bundle}"
        html = su_pat.sub(f"const sound_urls = {su_pretty};", html, count=1)

        emb_a = html.index("apply_settings(", xa_a)
        emb_m = re.search(r'("sound_urls"\s*:\s*)\[\[[\s\S]*?\]\]', html[emb_a : emb_a + 40000])
        assert emb_m is not None, f"Expected apply_settings sound_urls in {bundle}"
        s_abs = emb_a + emb_m.start()
        e_abs = emb_a + emb_m.end()
        html = html[:s_abs] + emb_m.group(1) + su_inline + html[e_abs:]

        check_inner_scripts(html, bundle)
        save_data(bpath, bprefix, html)
        print(f"Updated {bundle} -> xlAssets={len(xa)}, sound_urls={len(sound_urls)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", help="Path to official_character.zip with 39 .ogg files")
    args = parser.parse_args()
    sync_impact_pass()
    if args.zip:
        merge_audio_pack(args.zip)
