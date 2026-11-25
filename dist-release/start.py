"""Run the clean Cunjie v6.0 static release on localhost."""
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
        parser.exit(1, "Missing game/index.html.\n")
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
