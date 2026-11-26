"""Build Cunjie with the original dist workspace or update its tracked release."""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
RELEASE = os.path.join(ROOT, "dist-release")

BUILD_STEPS = [
    ("Layer & grounding core", [sys.executable, "tools/fix_layers_and_grounding.py"]),
    ("v5.9.5 HD/QHD + AJ6-HD + Fenrir integration", [sys.executable, "tools/integrate_v595_features.py"]),
    ("Experience v4 module", ["node", "tools/build_experience.cjs"]),
    ("Contact Feel v2 + Act II/III material FX", ["node", "tools/build_contact.cjs"]),
    ("Ground residue v3 module", ["node", "tools/build_residue.cjs"]),
    ("Free Mode & Fenrir wet-asphalt impact v6", ["node", "tools/build_free_impact.cjs"]),
    ("Fenrir Blue-Hour Hunt gameplay", ["node", "tools/build_fenrir.cjs"]),
    ("Fenrir city-scale scene layers", ["node", "tools/build_fenrir_scene.cjs"]),
    ("Wave 1 Immersion (ambience, haptics, camera, lens FX)", ["node", "tools/build_immersion.cjs"]),
    ("Unified HD & custom skin pack runtime", ["node", "tools/build_skin_runtime.cjs"]),
    ("Standalone offline single-file HTML", [sys.executable, "tools/build_offline_html.py"]),
]

TEST_STEPS = [
    ("Contact feel tests", ["node", "tools/test_contact.cjs"]),
    ("Impact pass tests", ["node", "tools/test_impact.cjs"]),
    ("Touch vertical tests", ["node", "tools/test_touch.cjs"]),
    ("Direct touch tests", ["node", "tools/test_direct.cjs"]),
    ("Fenrir city scene tests", ["node", "tools/test_fenrir_scene.cjs"]),
]

CHECK_SCRIPTS = [
    "dist/scripts/render-quality.js",
    "dist/scripts/skin-packs.js",
    "dist/scripts/room-choice.js",
    "dist/scripts/touch-v1-impact-host-1.js",
    "dist/scripts/host-2.js",
    "dist/scripts/impact-host-3.js",
    "dist/scripts/fenrir-scene-v1.js",
    "dist/data/touch-v1-impact.js",
    "dist/data/touch-v1-free.js",
]

RELEASE_FILES = [
    "scripts/render-quality.js",
    "scripts/skin-packs.js",
    "scripts/room-choice.js",
    "scripts/touch-v1-impact-host-1.js",
    "scripts/host-2.js",
    "scripts/impact-host-3.js",
    "data/00-init.js",
    "data/01-stages.js",
    "data/02-lines.js",
    "data/03-original.js",
    "data/04-images-boot.js",
    "data/04-images-deferred.js",
    "data/05-audio.js",
    "data/08-visualConfig.js",
    "data/09-fever.js",
    "data/10-tinyVoices.js",
    "data/11-reactiveGiant.js",
    "data/12-responses.js",
    "data/13-cinematics.js",
    "data/touch-v1-impact.js",
    "data/touch-v1-free.js",
    "assets/qiaodan-flatheel-v4.webp",
    "assets/rooftop/aj6.webp",
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
    "scripts/fenrir-scene-v1.js",
    "assets/fenrir/city-far.svg",
    "assets/fenrir/city-mid.svg",
    "assets/fenrir/city-near.svg",
] + [f"assets/aj6-hd/{i}.webp" for i in range(11)]

START_PY = '''"""Run the clean Cunjie v6.0 static release on localhost."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    game = Path(__file__).resolve().parent / "game"
    if not (game / "index.html").is_file():
        parser.exit(1, "Missing game/index.html.\\n")
    handler = partial(SimpleHTTPRequestHandler, directory=str(game))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    with server:
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"Open {url} (Ctrl+C to stop)", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
'''

README_TXT = """《寸界》v6.0 · 完整融合版（高清管线 / 屋顶与雨夜木地板 / 芬里尔雨后城市 / 自定义皮肤包）

本地游玩：
1. 在本目录运行：python start.py（或 py start.py）
2. 浏览器访问 http://127.0.0.1:8000/ 即可游玩。
3. 静态网站部署：将 game/ 设为站点根目录即可。
4. 手机/无网络直开：请直接使用主工程 dist/cunjie-offline.html 单文件版本。
"""


def run_step(label, cmd):
    print(f"[STEP] {label}...")
    res = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stdout)
        print(res.stderr, file=sys.stderr)
        raise SystemExit(f"Failed at step: {label}")
    if res.stdout.strip():
        first_line = res.stdout.strip().splitlines()[0]
        print(f"       {first_line}")


def export_clean_release():
    print("[STEP] Exporting lean static web release -> dist-release/...")
    game_dir = os.path.join(RELEASE, "game")
    if os.path.exists(RELEASE):
        shutil.rmtree(RELEASE)
    os.makedirs(game_dir, exist_ok=True)
    shutil.copy2(os.path.join(DIST, "impact.html"), os.path.join(game_dir, "index.html"))
    total_bytes = os.path.getsize(os.path.join(game_dir, "index.html"))
    for rel in RELEASE_FILES:
        src = os.path.join(DIST, rel.replace("/", os.sep))
        dst = os.path.join(game_dir, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        total_bytes += os.path.getsize(dst)
    # Make dist-release/game/ 100% subpath-safe for GitHub Pages (e.g. /cunjie-evolution/)
    for rel_sub in ("data/touch-v1-free.js", "data/touch-v1-impact.js", "scripts/impact-host-3.js"):
        p_sub = os.path.join(game_dir, rel_sub.replace("/", os.sep))
        txt_sub = open(p_sub, "r", encoding="utf-8").read()
        txt_sub = re.sub(r'''(["']|\\")/assets/''', r"\1assets/", txt_sub)
        open(p_sub, "w", encoding="utf-8", newline="").write(txt_sub)
    idx_sub = os.path.join(game_dir, "index.html")
    idx_txt = open(idx_sub, "r", encoding="utf-8").read()
    dead_links = '<br><a href="contact-compare.html" style="color:var(--teal)">查看落脚对照 ↗</a> · <a href="contact-before.html" style="color:var(--teal)">游玩修改前版本 ↗</a>'
    if dead_links in idx_txt:
        open(idx_sub, "w", encoding="utf-8", newline="").write(idx_txt.replace(dead_links, ""))
    open(os.path.join(game_dir, ".nojekyll"), "w", encoding="utf-8").write("")
    with open(os.path.join(RELEASE, "start.py"), "w", encoding="utf-8") as f:
        f.write(START_PY)
    with open(os.path.join(RELEASE, "README.txt"), "w", encoding="utf-8") as f:
        f.write(README_TXT)
    print(f"       Exported {len(RELEASE_FILES) + 1} game files ({total_bytes / 1024 / 1024:.2f} MiB) to dist-release/game/")


def verify_syntax(paths):
    print("[STEP] Syntax-checking runtime scripts and offline HTML...")
    for path in paths:
        res = subprocess.run(["node", "--check", path], cwd=ROOT, capture_output=True, text=True)
        if res.returncode != 0:
            raise SystemExit(f"Syntax check failed for {path}: {res.stderr}")
    off_path = os.path.join(DIST, "cunjie-offline.html")
    html = open(off_path, encoding="utf-8").read()
    scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)
    with tempfile.TemporaryDirectory() as td:
        for i, code in enumerate(scripts):
            fp = os.path.join(td, f"off_{i}.js")
            open(fp, "w", encoding="utf-8").write(code)
            res = subprocess.run(["node", "--check", fp], capture_output=True, text=True)
            if res.returncode != 0:
                raise SystemExit(f"Offline HTML inline script #{i} syntax error: {res.stderr}")
    print(f"       Checked {len(paths)} files + {len(scripts)} inline offline scripts OK ({os.path.getsize(off_path)/1024/1024:.2f} MiB)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-release", action="store_true",
                        help="Synchronize the Fenrir sources and rebuild the offline HTML from the tracked release")
    args = parser.parse_args()
    if args.from_release:
        run_step("Fenrir Hunt release sync", ["node", "tools/build_fenrir.cjs", "--release"])
        run_step("Wave 1 Immersion release sync", ["node", "tools/build_immersion.cjs", "--release"])
        run_step("Fenrir city release sync", ["node", "tools/build_fenrir_scene.cjs", "--release"])
        run_step("Standalone offline HTML from release", [sys.executable, "tools/build_offline_html.py", "--release"])
        paths = [os.path.join("dist-release", "game", rel.removeprefix("dist/")) for rel in CHECK_SCRIPTS]
    else:
        if not os.path.isfile(os.path.join(DIST, "data", "touch-v1-impact.js")):
            parser.error("The original dist workspace is missing. Use --from-release to build from a clean checkout.")
        for label, cmd in BUILD_STEPS:
            run_step(label, cmd)
        export_clean_release()
        paths = CHECK_SCRIPTS
    for label, cmd in TEST_STEPS:
        run_step(label, cmd)
    verify_syntax(paths)
    print("\nBUILD AND REGRESSION CHECKS PASSED.")


if __name__ == "__main__":
    main()
