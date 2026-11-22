#!/usr/bin/env python3
"""Build the guide into a static site.

    content/*.json  +  src/ (HTML, CSS, JS)   ->   dist/

Steps:
  1. Validate every content file (tools/validate.py). Stop on errors.
  2. Merge tracks, lessons, labs, drills and the placement check into one
     file, dist/data/content.json, so the browser makes a single request.
  3. Give every lesson a short id: the first seven characters of the SHA-1
     of its content. Edit a lesson and its id changes, which is the same
     idea Git uses to name every object it stores.
  4. Copy src/ to dist/.
  5. With --offline, also write dist/offline.html: one self-contained file
     with the CSS, JavaScript and content inlined, for use without a server.

Standard library only.

Usage:
    python tools/build.py              build into dist/
    python tools/build.py --strict     fail on warnings and unwritten lessons (CI uses this)
    python tools/build.py --offline    also write dist/offline.html
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate  # noqa: E402  (local module, imported after the path tweak)

ROOT = validate.ROOT
SRC = ROOT / "src"
DIST = ROOT / "dist"


def content_sha(obj: object) -> str:
    """A stable hash of a JSON value: same content, same id, on any machine."""
    canonical = json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def git_commit() -> str:
    """The commit being built, from CI's environment or the local checkout."""
    sha = os.environ.get("GITHUB_SHA", "")
    if sha:
        return sha[:7]
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short=7", "HEAD"],
            cwd=ROOT, capture_output=True, text=True, timeout=10, check=False,
        )
        return out.stdout.strip() if out.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def assemble(loaded: dict) -> dict:
    """Turn validated source files into the single object the site loads."""
    manifest = loaded["manifest"]
    lessons_out: dict[str, dict] = {}
    total_minutes = 0
    total_words = 0
    quiz_count = 0

    for track in manifest["tracks"]:
        for position, lesson_id in enumerate(track["lessons"], start=1):
            lesson = loaded["lessons"].get(lesson_id)
            if lesson is None:
                # Listed in the curriculum but not written yet: ship a stub so
                # navigation still works and the gap is visible.
                lessons_out[lesson_id] = {
                    "id": lesson_id,
                    "track": track["id"],
                    "title": manifest["lessonTitles"][lesson_id],
                    "position": position,
                    "stub": True,
                }
                continue
            lesson = dict(lesson)
            words = lesson.pop("_words", 0)
            lesson["sha"] = content_sha(lesson)[:7]
            lesson["words"] = words
            lesson["position"] = position
            lessons_out[lesson_id] = lesson
            total_minutes += lesson.get("minutes", 0)
            total_words += words
            quiz_count += len(lesson.get("quiz", []))

    labs = [lab for lab in loaded["labs"] if not lab.get("draft")]
    written = [l for l in lessons_out.values() if not l.get("stub")]
    terms = {t["term"].strip().lower() for l in written for t in l.get("terms", [])}
    commands = {c["cmd"] for l in written for c in l.get("commands", [])}

    # The Workflow reader's first example is this repository's real workflow,
    # read at build time so the example can never drift from the file.
    workflow_file = ROOT.parent / ".github" / "workflows" / "guide.yml"
    workflow_text = workflow_file.read_text(encoding="utf-8") if workflow_file.exists() else ""

    return {
        "site": manifest["site"],
        "workflow": {"guide": workflow_text},
        "lenses": manifest["lenses"],
        "tools": manifest["tools"],
        "tracks": [
            {key: track[key] for key in ("id", "letter", "title", "subtitle", "promise", "audience", "lessons")}
            for track in manifest["tracks"]
        ],
        "lessons": lessons_out,
        "labs": labs,
        "drills": loaded["drills"],
        "placement": loaded["placement"],
        "build": {
            "version": manifest["site"]["version"],
            "commit": git_commit(),
            "date": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
            "counts": {
                "tracks": len(manifest["tracks"]),
                "lessons": len(written),
                "lessonsPlanned": len(lessons_out),
                "labs": len([lab for lab in labs if not lab.get("free")]),
                "drills": len(loaded["drills"]),
                "quiz": quiz_count,
                "terms": len(terms),
                "commands": len(commands),
                "minutes": total_minutes,
                "words": total_words,
            },
        },
    }


SCRIPT_TAG = re.compile(r'<script src="([^"]+)" defer></script>')
STYLE_TAG = re.compile(r'<link rel="stylesheet" href="((?!https:)[^"]+)">')


def write_offline(index_html: str, content_json: str) -> str:
    """Inline local CSS, JS and the content so one file works on its own."""

    def inline_style(match: re.Match) -> str:
        css = (SRC / match.group(1)).read_text(encoding="utf-8")
        return f"<style>\n{css}\n</style>"

    def inline_script(match: re.Match) -> str:
        js = (SRC / match.group(1)).read_text(encoding="utf-8")
        # A closing script tag inside the code would end the element early.
        return "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>"

    html = STYLE_TAG.sub(inline_style, index_html)
    # Embed the content just before the first script so it exists when the app boots.
    safe_json = content_json.replace("</", "<\\/").replace("<!--", "<\\!--")
    data_tag = f'<script type="application/json" id="gg-content">{safe_json}</script>\n'
    first_script = SCRIPT_TAG.search(html)
    if first_script:
        html = html[: first_script.start()] + data_tag + html[first_script.start():]
    return SCRIPT_TAG.sub(inline_script, html)


def build(strict: bool = False, offline: bool = False, quiet: bool = False) -> int:
    report = validate.Report()
    loaded = validate.load_all(report)
    if not loaded:
        for problem in report.problems:
            print(problem)
        print("build: stopped, the curriculum file could not be read")
        return 1

    missing = loaded["missing"]
    errors = len(report.errors) + (len(missing) if strict else 0)
    blocking_warnings = strict and report.warnings
    if errors or blocking_warnings:
        for problem in report.problems:
            print(problem)
        for lesson_id in missing if strict else []:
            print(f"  ERROR  content/tracks.json: lesson '{lesson_id}' is listed but not written yet")
        print(f"build: stopped, {errors} errors and {len(report.warnings)} warnings")
        return 1

    content = assemble(loaded)
    content_json = json.dumps(content, ensure_ascii=False, separators=(",", ":"))

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SRC, DIST)
    (DIST / "data").mkdir(exist_ok=True)
    (DIST / "data" / "content.json").write_text(content_json, encoding="utf-8")

    if offline:
        index_html = (SRC / "index.html").read_text(encoding="utf-8")
        (DIST / "offline.html").write_text(write_offline(index_html, content_json), encoding="utf-8")

    if not quiet:
        counts = content["build"]["counts"]
        print(f"build: wrote {DIST.relative_to(ROOT.parent)}/")
        print(
            f"  {counts['lessons']} of {counts['lessonsPlanned']} lessons, "
            f"{counts['labs']} labs, {counts['drills']} drills, {counts['quiz']} quiz questions"
        )
        print(
            f"  {counts['terms']} glossary terms, {counts['commands']} commands, "
            f"about {counts['minutes']} minutes of lessons, {counts['words']:,} words"
        )
        print(f"  content.json is {len(content_json.encode('utf-8')) / 1024:.0f} KB")
        if report.warnings or missing:
            print(f"  {len(report.warnings) + len(missing)} warnings (run tools/validate.py to see them)")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the guide into dist/.")
    parser.add_argument("--strict", action="store_true", help="fail on warnings and unwritten lessons")
    parser.add_argument("--offline", action="store_true", help="also write a single-file dist/offline.html")
    parser.add_argument("--quiet", action="store_true", help="print nothing on success")
    args = parser.parse_args(argv)
    return build(strict=args.strict, offline=args.offline, quiet=args.quiet)


if __name__ == "__main__":
    sys.exit(main())
