#!/usr/bin/env python3
"""Preview the guide on your own machine.

    python tools/serve.py            http://127.0.0.1:8000
    python tools/serve.py --port 9000

Builds the site, serves dist/, and rebuilds when a file under content/ or
src/ changes, so a browser refresh always shows your latest edit. The server
listens on 127.0.0.1 only: it is not reachable from other machines.

Standard library only.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402

WATCHED = (build.ROOT / "content", build.ROOT / "src")


def newest_change() -> float:
    """Modification time of the most recently edited source file."""
    latest = 0.0
    for folder in WATCHED:
        for path in folder.rglob("*"):
            if path.is_file():
                latest = max(latest, path.stat().st_mtime)
    return latest


class Handler(http.server.SimpleHTTPRequestHandler):
    last_built = 0.0

    def do_GET(self) -> None:  # noqa: N802 (name fixed by the base class)
        changed = newest_change()
        if changed > Handler.last_built:
            Handler.last_built = changed
            status = build.build(quiet=True)
            print("rebuilt" if status == 0 else "build failed: fix the errors above, then refresh")
        super().do_GET()

    def end_headers(self) -> None:
        # Never cache during development, so a refresh always shows the edit.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass  # keep the terminal quiet; build messages are what matter


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the guide locally.")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    if build.build() != 0:
        return 1
    Handler.last_built = newest_change()
    handler = functools.partial(Handler, directory=str(build.DIST))
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"\nServing the guide at http://127.0.0.1:{args.port}  (Ctrl+C to stop)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
