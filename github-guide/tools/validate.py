#!/usr/bin/env python3
"""Validate the guide's content files.

Standard library only, so it runs anywhere Python 3.9+ runs, including a bare
GitHub Actions runner.

Usage:
    python tools/validate.py              report problems; exit 1 on errors
    python tools/validate.py --strict     also fail on warnings and missing lessons
    python tools/validate.py --only expert    check one track's lessons

The rules here are the contract described in docs/AUTHORING.md. If the two
ever disagree, this file wins, because this file is what CI runs.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"

LENSES = ("everyday", "legal", "ml", "technical")
TOOLS = ("browser", "phone", "cli", "editor")
CALLOUT_KINDS = {"tip", "note", "warn", "danger", "law", "a11y"}
CODE_LANGS = {
    "bash", "yaml", "json", "python", "diff", "text", "gitignore",
    "markdown", "toml", "ini", "conflict", "graphql", "dockerfile",
}
COMMAND_KINDS = {"git", "gh", "shell", "key", "search", "web"}
RISKS = {"safe", "caution", "danger"}
VERDICTS = {"best", "ok", "bad"}
VISUAL_BLOCKS = {"graph", "flow", "compare", "table"}
TOOL_ROUTES = {
    "home", "lab", "drills", "cards", "cheatsheet", "glossary",
    "progress", "about", "placement", "workflow",
}
# Hosts we are willing to send a learner to. Anything else is a warning so a
# human looks at it.
LINK_HOSTS = {
    "docs.github.com", "git-scm.com", "cli.github.com", "github.com",
    "code.visualstudio.com", "github.blog", "docs.python.org",
    "choosealicense.com", "opensource.org", "spdx.org", "semver.org",
    "www.conventionalcommits.org", "containers.dev", "git-lfs.com",
    "slsa.dev", "docs.sigstore.dev", "www.irs.gov", "www.w3.org",
    "citation-file-format.github.io", "dvc.org", "jupytext.readthedocs.io",
    "nbdime.readthedocs.io", "pre-commit.com", "www.eeoc.gov",
    "www.copyright.gov", "leginfo.legislature.ca.gov", "developercertificate.org",
    "www.contributor-covenant.org", "docs.zenodo.org", "securitylab.github.com",
    "graphql.org", "www.dol.gov", "askjan.org", "www.ada.gov",
}
# Checks a lab step may use. js/gitsim.js implements each one.
LAB_CHECKS = {
    "ran", "branch", "branchExists", "branchMissing", "headDetached", "clean",
    "staged", "unstaged", "untracked", "minCommits", "merging", "rebasing",
    "conflicts", "isAncestor", "sameCommit", "fileContains", "fileLacks",
    "fileExists", "fileMissing", "headMessage", "parents", "stash",
    "tagExists", "linear", "prOpen", "prMerged", "not", "differentCommit",
    "reachable", "rebasePlanOpen", "exactCommits", "historyHasFile", "ignored",
}
PLAN_ACTIONS = {"pick", "reword", "squash", "fixup", "drop"}

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LINK_RE = re.compile(r"\[([^\]\n]+)\]\(([^)\s]+)\)")
CODE_SPAN_RE = re.compile(r"`[^`\n]*`")
WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9'.\-/]*")
FORBIDDEN_RE = re.compile(r"\b(TODO|TBD|FIXME|XXX)\b|lorem ipsum")
RAW_HTML_RE = re.compile(r"<\s*/?\s*[A-Za-z!][^>]*>")


@dataclass
class Problem:
    level: str  # "error" or "warning"
    where: str
    message: str

    def __str__(self) -> str:
        mark = "ERROR" if self.level == "error" else "warn "
        return f"  {mark}  {self.where}: {self.message}"


class Report:
    """Collects problems so one run reports everything, not just the first."""

    def __init__(self) -> None:
        self.problems: list[Problem] = []

    def error(self, where: str, message: str) -> None:
        self.problems.append(Problem("error", where, message))

    def warn(self, where: str, message: str) -> None:
        self.problems.append(Problem("warning", where, message))

    @property
    def errors(self) -> list[Problem]:
        return [p for p in self.problems if p.level == "error"]

    @property
    def warnings(self) -> list[Problem]:
        return [p for p in self.problems if p.level == "warning"]


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

def load_json(path: Path, report: Report) -> Any:
    """Read a JSON file, reporting a precise location when it is malformed."""
    rel = str(path.relative_to(ROOT))
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        report.error(rel, f"cannot read file: {exc}")
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        report.error(rel, f"invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}")
        return None


def strip_markup(text: str) -> str:
    """Remove inline markup so word counts measure prose, not punctuation."""
    text = LINK_RE.sub(lambda m: m.group(1), text)
    return text.replace("**", "").replace("*", "").replace("`", "").replace("{{", "").replace("}}", "")


def count_words(text: str) -> int:
    return len(WORD_RE.findall(strip_markup(text)))


def check_inline(report: Report, where: str, text: str, known_routes: set[str]) -> None:
    """Check the small inline markup subset the renderer understands."""
    if "\t" in text:
        report.error(where, "contains a tab character; use spaces")
    if FORBIDDEN_RE.search(text):
        report.error(where, "contains a placeholder word (TODO, TBD, FIXME, lorem ipsum)")
    if text.count("`") % 2:
        report.error(where, "unbalanced backticks: every `code` span needs a closing backtick")
        return
    outside = CODE_SPAN_RE.sub(" ", text)
    if outside.count("**") % 2:
        report.error(where, "unbalanced ** bold markers")
    if outside.count("{{") != outside.count("}}"):
        report.error(where, "unbalanced {{key}} markers")
    if RAW_HTML_RE.search(outside):
        report.error(where, "raw HTML is not allowed; wrap literal <text> in backticks")
    for match in LINK_RE.finditer(outside):
        url = match.group(2)
        if url.startswith("#"):
            if url[1:] not in known_routes:
                report.error(where, f"internal link {url} points at nothing")
        elif not url.startswith("https://"):
            report.error(where, f"link must be https:// or an internal #route: {url}")


def check_text(
    report: Report,
    where: str,
    value: Any,
    known_routes: set[str],
    *,
    min_chars: int = 1,
    max_chars: int | None = None,
    inline: bool = True,
) -> bool:
    if not isinstance(value, str):
        report.error(where, f"expected text, found {type(value).__name__}")
        return False
    stripped = value.strip()
    if len(stripped) < min_chars:
        report.error(where, f"too short ({len(stripped)} characters, need at least {min_chars})")
        return False
    if max_chars is not None and len(stripped) > max_chars:
        report.error(where, f"too long ({len(stripped)} characters, limit {max_chars})")
    if inline:
        if value != stripped:
            report.warn(where, "has leading or trailing whitespace")
        check_inline(report, where, value, known_routes)
    return True


def check_text_list(
    report: Report,
    where: str,
    value: Any,
    known_routes: set[str],
    *,
    min_items: int,
    max_items: int,
    min_chars: int = 3,
) -> bool:
    if not isinstance(value, list):
        report.error(where, "expected a list")
        return False
    if not min_items <= len(value) <= max_items:
        report.error(where, f"has {len(value)} items; expected {min_items} to {max_items}")
    for i, item in enumerate(value):
        check_text(report, f"{where}[{i}]", item, known_routes, min_chars=min_chars)
    return True


def require_keys(report: Report, where: str, obj: Any, required: Iterable[str], optional: Iterable[str] = ()) -> bool:
    if not isinstance(obj, dict):
        report.error(where, "expected an object")
        return False
    required = list(required)
    allowed = set(required) | set(optional)
    ok = True
    for key in required:
        if key not in obj:
            report.error(where, f"missing required field '{key}'")
            ok = False
    for key in obj:
        if key not in allowed:
            report.error(where, f"unknown field '{key}' (typo?)")
    return ok


# --------------------------------------------------------------------------
# Blocks
# --------------------------------------------------------------------------

def check_graph(report: Report, where: str, block: dict) -> None:
    commits = block.get("commits")
    if not isinstance(commits, list) or not commits:
        report.error(where, "graph needs a non-empty 'commits' list")
        return
    seen: list[str] = []
    for i, commit in enumerate(commits):
        cw = f"{where}.commits[{i}]"
        if not require_keys(report, cw, commit, ["id"], ["parents", "msg", "ghost"]):
            continue
        cid = commit["id"]
        if not isinstance(cid, str) or not cid:
            report.error(cw, "commit id must be non-empty text")
            continue
        if cid in seen:
            report.error(cw, f"duplicate commit id '{cid}'")
        for parent in commit.get("parents", []):
            if parent not in seen:
                report.error(cw, f"parent '{parent}' must be listed before '{cid}'")
        seen.append(cid)
    branches = block.get("branches", {})
    if not isinstance(branches, dict) or not branches:
        report.error(where, "graph needs at least one entry in 'branches'")
        branches = {}
    for name, target in branches.items():
        if target not in seen:
            report.error(where, f"branch '{name}' points at unknown commit '{target}'")
    for name, target in block.get("tags", {}).items():
        if target not in seen:
            report.error(where, f"tag '{name}' points at unknown commit '{target}'")
    head = block.get("head")
    if head is not None and head not in branches and head not in seen:
        report.error(where, f"head '{head}' is neither a branch nor a commit")
    for cid in block.get("highlight", []):
        if cid not in seen:
            report.error(where, f"highlight refers to unknown commit '{cid}'")


def check_block(report: Report, where: str, block: Any, routes: set[str]) -> str | None:
    if not isinstance(block, dict) or "type" not in block:
        report.error(where, "each block needs a 'type'")
        return None
    kind = block["type"]
    if kind == "p":
        require_keys(report, where, block, ["type", "text"])
        check_text(report, f"{where}.text", block.get("text"), routes, min_chars=20)
    elif kind == "list":
        require_keys(report, where, block, ["type", "items"], ["ordered"])
        check_text_list(report, f"{where}.items", block.get("items"), routes, min_items=2, max_items=10)
    elif kind == "code":
        require_keys(report, where, block, ["type", "lang", "code"], ["caption", "file"])
        if block.get("lang") not in CODE_LANGS:
            report.error(where, f"unknown code lang '{block.get('lang')}'; use one of {sorted(CODE_LANGS)}")
        check_text(report, f"{where}.code", block.get("code"), routes, min_chars=2, inline=False)
        if isinstance(block.get("code"), str) and block["code"].endswith("\n"):
            report.warn(where, "code ends with a newline; trim it")
        if "caption" in block:
            check_text(report, f"{where}.caption", block["caption"], routes)
    elif kind == "callout":
        require_keys(report, where, block, ["type", "kind", "text"], ["title"])
        if block.get("kind") not in CALLOUT_KINDS:
            report.error(where, f"unknown callout kind '{block.get('kind')}'; use one of {sorted(CALLOUT_KINDS)}")
        check_text(report, f"{where}.text", block.get("text"), routes, min_chars=20)
        if "title" in block:
            check_text(report, f"{where}.title", block["title"], routes, max_chars=70)
    elif kind == "table":
        require_keys(report, where, block, ["type", "head", "rows"], ["caption"])
        head = block.get("head")
        rows = block.get("rows")
        if not isinstance(head, list) or not 2 <= len(head) <= 5:
            report.error(where, "table 'head' needs 2 to 5 columns")
            head = head if isinstance(head, list) else []
        if not isinstance(rows, list) or not rows:
            report.error(where, "table needs at least one row")
            rows = []
        for cell_i, cell in enumerate(head):
            check_text(report, f"{where}.head[{cell_i}]", cell, routes)
        for r, row in enumerate(rows):
            if not isinstance(row, list) or len(row) != len(head):
                report.error(f"{where}.rows[{r}]", f"row must have {len(head)} cells to match the header")
                continue
            for c, cell in enumerate(row):
                check_text(report, f"{where}.rows[{r}][{c}]", cell, routes)
    elif kind == "compare":
        require_keys(report, where, block, ["type", "items"], ["caption"])
        items = block.get("items")
        if not isinstance(items, list) or not 2 <= len(items) <= 4:
            report.error(where, "compare needs 2 to 4 items")
            items = []
        for i, item in enumerate(items):
            iw = f"{where}.items[{i}]"
            if require_keys(report, iw, item, ["title", "points"]):
                check_text(report, f"{iw}.title", item["title"], routes, max_chars=60)
                check_text_list(report, f"{iw}.points", item["points"], routes, min_items=2, max_items=6)
    elif kind == "flow":
        require_keys(report, where, block, ["type", "steps"], ["caption"])
        steps = block.get("steps")
        if not isinstance(steps, list) or not 2 <= len(steps) <= 6:
            report.error(where, "flow needs 2 to 6 steps")
            steps = []
        for i, step in enumerate(steps):
            sw = f"{where}.steps[{i}]"
            if require_keys(report, sw, step, ["label"], ["note", "via"]):
                check_text(report, f"{sw}.label", step["label"], routes, max_chars=40)
                if "note" in step:
                    check_text(report, f"{sw}.note", step["note"], routes, max_chars=140)
                if "via" in step:
                    check_text(report, f"{sw}.via", step["via"], routes, max_chars=40)
                    if i == 0:
                        report.warn(sw, "'via' labels the arrow INTO a step; the first step has none")
    elif kind == "graph":
        require_keys(report, where, block, ["type", "commits", "branches"], ["caption", "head", "tags", "highlight"])
        check_graph(report, where, block)
        if "caption" in block:
            check_text(report, f"{where}.caption", block["caption"], routes)
        else:
            report.warn(where, "graph has no caption; say what the picture shows")
    elif kind == "reveal":
        require_keys(report, where, block, ["type", "prompt", "answer"])
        check_text(report, f"{where}.prompt", block.get("prompt"), routes, min_chars=15)
        check_text(report, f"{where}.answer", block.get("answer"), routes, min_chars=20)
    else:
        report.error(where, f"unknown block type '{kind}'")
        return None
    return kind


def block_words(block: dict) -> int:
    """Approximate reading words in a block (code counts at half weight)."""
    kind = block.get("type")
    total = 0
    if kind in ("p", "callout"):
        total += count_words(str(block.get("text", "")))
    elif kind == "list":
        total += sum(count_words(str(i)) for i in block.get("items", []))
    elif kind == "code":
        total += count_words(str(block.get("code", ""))) // 2
    elif kind == "table":
        for row in block.get("rows", []):
            total += sum(count_words(str(c)) for c in row)
    elif kind == "compare":
        for item in block.get("items", []):
            total += sum(count_words(str(p)) for p in item.get("points", []))
    elif kind == "flow":
        for step in block.get("steps", []):
            total += count_words(str(step.get("label", ""))) + count_words(str(step.get("note", "")))
    elif kind == "reveal":
        total += count_words(str(block.get("prompt", ""))) + count_words(str(block.get("answer", "")))
    return total


# --------------------------------------------------------------------------
# Lessons
# --------------------------------------------------------------------------

LESSON_REQUIRED = [
    "id", "track", "title", "minutes", "summary", "outcomes", "lenses",
    "sections", "howto", "pitfalls", "quiz", "mission", "terms", "commands", "links",
]
LESSON_OPTIONAL = ["prereqs", "lab", "moreLabs"]


def lesson_word_count(lesson: dict) -> int:
    total = count_words(str(lesson.get("summary", "")))
    total += sum(count_words(str(o)) for o in lesson.get("outcomes", []))
    lenses = lesson.get("lenses", {})
    if isinstance(lenses, dict) and lenses:
        # A reader normally reads one lens, so count the average, not the sum.
        total += sum(count_words(str(v)) for v in lenses.values()) // max(len(lenses), 1)
    for section in lesson.get("sections", []):
        if isinstance(section, dict):
            for block in section.get("blocks", []):
                if isinstance(block, dict):
                    total += block_words(block)
    for task in lesson.get("howto", []):
        if isinstance(task, dict):
            per_tool = [sum(count_words(str(s)) for s in task.get(t, [])) for t in TOOLS]
            total += sum(per_tool) // len(TOOLS)
    for pit in lesson.get("pitfalls", []):
        if isinstance(pit, dict):
            total += count_words(str(pit.get("trap", ""))) + count_words(str(pit.get("fix", "")))
    return total


def check_lesson(report: Report, rel: str, lesson: Any, ctx: dict) -> None:
    routes: set[str] = ctx["routes"]
    if not require_keys(report, rel, lesson, LESSON_REQUIRED, LESSON_OPTIONAL):
        if not isinstance(lesson, dict):
            return

    lid = lesson.get("id")
    track = lesson.get("track")
    expected_id = Path(rel).stem
    if lid != expected_id:
        report.error(rel, f"id '{lid}' must match the file name '{expected_id}'")
    if not isinstance(lid, str) or not ID_RE.match(lid or ""):
        report.error(rel, "id must be lowercase words joined by hyphens")
    if track not in ctx["track_ids"]:
        report.error(rel, f"unknown track '{track}'")
    elif isinstance(lid, str):
        if not lid.startswith(track + "-"):
            report.error(rel, f"id must start with '{track}-'")
        if Path(rel).parent.name != track:
            report.error(rel, f"file belongs in content/lessons/{track}/")
        if lid not in ctx["lesson_order"]:
            report.error(rel, "lesson is not listed in content/tracks.json")
        elif ctx["lesson_track"].get(lid) != track:
            report.error(rel, f"tracks.json lists this lesson under '{ctx['lesson_track'].get(lid)}'")
        expected_title = ctx["lesson_titles"].get(lid)
        if expected_title and lesson.get("title") != expected_title:
            report.error(rel, f"title must match tracks.json: '{expected_title}'")

    check_text(report, f"{rel}.title", lesson.get("title"), routes, min_chars=8, max_chars=90)
    check_text(report, f"{rel}.summary", lesson.get("summary"), routes, min_chars=60, max_chars=340)

    minutes = lesson.get("minutes")
    if not isinstance(minutes, int) or isinstance(minutes, bool) or not 3 <= minutes <= 45:
        report.error(f"{rel}.minutes", "must be a whole number from 3 to 45")

    check_text_list(report, f"{rel}.outcomes", lesson.get("outcomes"), routes, min_items=3, max_items=6, min_chars=15)

    for i, prereq in enumerate(lesson.get("prereqs", []) or []):
        if prereq not in ctx["lesson_order"]:
            report.error(f"{rel}.prereqs[{i}]", f"unknown lesson '{prereq}'")
        elif prereq == lid:
            report.error(f"{rel}.prereqs[{i}]", "a lesson cannot require itself")
        elif isinstance(lid, str) and lid in ctx["lesson_order"] and ctx["lesson_order"][prereq] > ctx["lesson_order"][lid]:
            report.warn(f"{rel}.prereqs[{i}]", f"'{prereq}' comes later in the curriculum than this lesson")

    # Lenses: exactly four, each a real paragraph.
    lenses = lesson.get("lenses")
    if require_keys(report, f"{rel}.lenses", lenses, LENSES):
        for name in LENSES:
            where = f"{rel}.lenses.{name}"
            if check_text(report, where, lenses.get(name), routes, min_chars=120):
                words = count_words(lenses[name])
                if not 35 <= words <= 135:
                    report.error(where, f"is {words} words; keep each lens between 35 and 135")

    # Sections and blocks.
    kinds_used: set[str] = set()
    sections = lesson.get("sections")
    if not isinstance(sections, list) or not 2 <= len(sections) <= 7:
        report.error(f"{rel}.sections", "expected 2 to 7 sections")
        sections = sections if isinstance(sections, list) else []
    for s, section in enumerate(sections):
        sw = f"{rel}.sections[{s}]"
        if not require_keys(report, sw, section, ["heading", "blocks"]):
            continue
        check_text(report, f"{sw}.heading", section["heading"], routes, min_chars=3, max_chars=70)
        blocks = section["blocks"]
        if not isinstance(blocks, list) or not blocks:
            report.error(f"{sw}.blocks", "a section needs at least one block")
            continue
        for b, block in enumerate(blocks):
            kind = check_block(report, f"{sw}.blocks[{b}]", block, routes)
            if kind:
                kinds_used.add(kind)
    if sections and not kinds_used & VISUAL_BLOCKS:
        report.warn(rel, "no visual block (graph, flow, compare or table); add one")
    if sections and "reveal" not in kinds_used:
        report.warn(rel, "no 'reveal' block; add one predict-then-check prompt")
    if sections and "callout" not in kinds_used:
        report.warn(rel, "no callout; flag at least one tip or warning")

    # How-to: every task explained for every tool.
    howto = lesson.get("howto")
    if not isinstance(howto, list) or not 1 <= len(howto) <= 3:
        report.error(f"{rel}.howto", "expected 1 to 3 tasks")
        howto = howto if isinstance(howto, list) else []
    for t, task in enumerate(howto):
        tw = f"{rel}.howto[{t}]"
        if not require_keys(report, tw, task, ["task", *TOOLS]):
            continue
        check_text(report, f"{tw}.task", task["task"], routes, min_chars=8, max_chars=90)
        for tool in TOOLS:
            check_text_list(report, f"{tw}.{tool}", task[tool], routes, min_items=1, max_items=9, min_chars=10)

    # Pitfalls.
    pitfalls = lesson.get("pitfalls")
    if not isinstance(pitfalls, list) or not 2 <= len(pitfalls) <= 6:
        report.error(f"{rel}.pitfalls", "expected 2 to 6 pitfalls")
        pitfalls = pitfalls if isinstance(pitfalls, list) else []
    for p, pit in enumerate(pitfalls):
        pw = f"{rel}.pitfalls[{p}]"
        if require_keys(report, pw, pit, ["trap", "fix"]):
            check_text(report, f"{pw}.trap", pit["trap"], routes, min_chars=15)
            check_text(report, f"{pw}.fix", pit["fix"], routes, min_chars=15)

    # Lab references: one main lab, and optionally more.
    if "lab" in lesson and lesson["lab"] not in ctx["lab_ids"]:
        report.error(f"{rel}.lab", f"unknown lab '{lesson['lab']}'")
    if "moreLabs" in lesson:
        extra = lesson["moreLabs"]
        if "lab" not in lesson:
            report.error(f"{rel}.moreLabs", "give the lesson a main 'lab' before listing more")
        if not isinstance(extra, list) or not extra:
            report.error(f"{rel}.moreLabs", "expected a non-empty list of lab ids")
        else:
            for i, lab_id in enumerate(extra):
                if lab_id not in ctx["lab_ids"]:
                    report.error(f"{rel}.moreLabs[{i}]", f"unknown lab '{lab_id}'")
                elif lab_id == lesson.get("lab"):
                    report.error(f"{rel}.moreLabs[{i}]", "already the lesson's main lab")

    # Quiz.
    quiz = lesson.get("quiz")
    answers: list[int] = []
    if not isinstance(quiz, list) or not 3 <= len(quiz) <= 6:
        report.error(f"{rel}.quiz", "expected 3 to 6 questions")
        quiz = quiz if isinstance(quiz, list) else []
    for q, question in enumerate(quiz):
        qw = f"{rel}.quiz[{q}]"
        if not require_keys(report, qw, question, ["q", "choices", "answer", "why"]):
            continue
        check_text(report, f"{qw}.q", question["q"], routes, min_chars=15)
        check_text_list(report, f"{qw}.choices", question["choices"], routes, min_items=3, max_items=5, min_chars=1)
        check_text(report, f"{qw}.why", question["why"], routes, min_chars=40)
        answer = question["answer"]
        n = len(question["choices"]) if isinstance(question["choices"], list) else 0
        if not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer < n:
            report.error(f"{qw}.answer", f"must be the zero-based index of the right choice (0 to {max(n - 1, 0)})")
        else:
            answers.append(answer)
        if isinstance(question["choices"], list) and len(set(question["choices"])) != len(question["choices"]):
            report.error(f"{qw}.choices", "two choices are identical")
    if len(answers) >= 3 and len(set(answers)) == 1:
        report.warn(f"{rel}.quiz", "every correct answer is in the same position; vary it")

    # Mission.
    mission = lesson.get("mission")
    if require_keys(report, f"{rel}.mission", mission, ["title", "steps"], ["where"]):
        check_text(report, f"{rel}.mission.title", mission["title"], routes, min_chars=8, max_chars=90)
        check_text_list(report, f"{rel}.mission.steps", mission["steps"], routes, min_items=3, max_items=7, min_chars=12)
        if "where" in mission:
            check_text(report, f"{rel}.mission.where", mission["where"], routes, min_chars=8)

    # Terms.
    terms = lesson.get("terms")
    if not isinstance(terms, list) or not 3 <= len(terms) <= 8:
        report.error(f"{rel}.terms", "expected 3 to 8 terms")
        terms = terms if isinstance(terms, list) else []
    for t, term in enumerate(terms):
        tw = f"{rel}.terms[{t}]"
        if require_keys(report, tw, term, ["term", "def"]):
            check_text(report, f"{tw}.term", term["term"], routes, min_chars=2, max_chars=50)
            check_text(report, f"{tw}.def", term["def"], routes, min_chars=25, max_chars=320)
            if isinstance(term["term"], str):
                # The same term may be defined in more than one lesson. The
                # build keeps the first definition in curriculum order for
                # the glossary, so a repeat is allowed, but not within one
                # lesson.
                key = term["term"].strip().lower()
                if ctx["terms_seen"].get(key) == rel:
                    report.error(tw, f"term '{term['term']}' is defined twice in this lesson")
                ctx["terms_seen"].setdefault(key, rel)

    # Commands.
    commands = lesson.get("commands")
    if not isinstance(commands, list) or not 2 <= len(commands) <= 10:
        report.error(f"{rel}.commands", "expected 2 to 10 commands")
        commands = commands if isinstance(commands, list) else []
    for c, command in enumerate(commands):
        cw = f"{rel}.commands[{c}]"
        if require_keys(report, cw, command, ["cmd", "does", "kind", "risk"]):
            check_text(report, f"{cw}.cmd", command["cmd"], routes, min_chars=1, max_chars=160, inline=False)
            check_text(report, f"{cw}.does", command["does"], routes, min_chars=15, max_chars=240)
            if command["kind"] not in COMMAND_KINDS:
                report.error(f"{cw}.kind", f"must be one of {sorted(COMMAND_KINDS)}")
            if command["risk"] not in RISKS:
                report.error(f"{cw}.risk", f"must be one of {sorted(RISKS)}")

    # Links.
    links = lesson.get("links")
    if not isinstance(links, list) or not 2 <= len(links) <= 6:
        report.error(f"{rel}.links", "expected 2 to 6 links")
        links = links if isinstance(links, list) else []
    for l, link in enumerate(links):
        lw = f"{rel}.links[{l}]"
        if require_keys(report, lw, link, ["label", "url"]):
            check_text(report, f"{lw}.label", link["label"], routes, min_chars=5, max_chars=110)
            url = link["url"]
            if not isinstance(url, str) or not url.startswith("https://"):
                report.error(f"{lw}.url", "must be an https:// address")
            else:
                host = url.split("/")[2]
                if host not in LINK_HOSTS:
                    report.warn(f"{lw}.url", f"host '{host}' is not on the reviewed list in tools/validate.py")
                if " " in url:
                    report.error(f"{lw}.url", "contains a space")

    # Reading time sanity check (about 180 words a minute for technical prose,
    # plus time for the quiz and the how-to).
    words = lesson_word_count(lesson)
    lesson["_words"] = words
    if isinstance(minutes, int) and words:
        estimate = max(3, round(words / 180) + 3)
        if minutes > estimate * 2 or minutes * 2 < estimate:
            report.warn(f"{rel}.minutes", f"says {minutes} min but the text reads like about {estimate} min")
    if words and words < 450:
        report.warn(rel, f"only about {words} words; lessons usually need 600 or more to teach the idea")


# --------------------------------------------------------------------------
# Labs, drills, placement
# --------------------------------------------------------------------------

def check_lab_check(report: Report, where: str, check: Any) -> None:
    if not isinstance(check, dict) or not check:
        report.error(where, "check must be a non-empty object")
        return
    for key, value in check.items():
        if key not in LAB_CHECKS:
            report.error(where, f"unknown check '{key}'")
        elif key == "not":
            check_lab_check(report, f"{where}.not", value)


def check_labs(report: Report, labs: Any, ctx: dict) -> None:
    rel = "content/labs.json"
    if not isinstance(labs, list) or not labs:
        report.error(rel, "expected a non-empty list of labs")
        return
    seen: set[str] = set()
    for i, lab in enumerate(labs):
        where = f"{rel}[{i}]"
        if not isinstance(lab, dict):
            report.error(where, "expected an object")
            continue
        lid = lab.get("id", "")
        if not isinstance(lid, str) or not lid.startswith("lab-") or not ID_RE.match(lid):
            report.error(where, "id must look like 'lab-something'")
        if lid in seen:
            report.error(where, f"duplicate lab id '{lid}'")
        seen.add(lid)
        if lab.get("track") not in ctx["track_ids"]:
            report.error(where, f"unknown track '{lab.get('track')}'")
        if lab.get("draft"):
            report.warn(where, f"lab '{lid}' is still a draft stub")
            continue
        if not require_keys(report, where, lab, ["id", "track", "title", "minutes", "intro", "setup", "steps", "outro"], ["free"]):
            continue
        routes = ctx["routes"]
        check_text(report, f"{where}.title", lab["title"], routes, max_chars=80)
        check_text(report, f"{where}.intro", lab["intro"], routes, min_chars=30)
        check_text(report, f"{where}.outro", lab["outro"], routes, min_chars=20)
        if not isinstance(lab["setup"], list) or not all(isinstance(s, str) for s in lab["setup"]):
            report.error(f"{where}.setup", "must be a list of commands")
        steps = lab["steps"]
        if not isinstance(steps, list) or (not steps and not lab.get("free")):
            report.error(f"{where}.steps", "a guided lab needs steps")
            continue
        for s, step in enumerate(steps):
            sw = f"{where}.steps[{s}]"
            if not require_keys(report, sw, step, ["goal", "say", "suggest", "check"], ["hint", "after", "before", "plan"]):
                continue
            check_text(report, f"{sw}.goal", step["goal"], routes, max_chars=90)
            check_text(report, f"{sw}.say", step["say"], routes, min_chars=20)
            # A step is completed by commands, by a rebase plan, or by both.
            if not isinstance(step["suggest"], list) or (not step["suggest"] and "plan" not in step):
                report.error(f"{sw}.suggest", "list at least one command that completes the step, or give a rebase 'plan'")
            if "plan" in step and step["plan"] != "default":
                plan = step["plan"]
                if not isinstance(plan, list) or not plan:
                    report.error(f"{sw}.plan", "must be 'default' or a list of entries such as {\"fixup\": \"wip\"}")
                else:
                    for n, entry in enumerate(plan):
                        actions = [k for k in entry if k in PLAN_ACTIONS] if isinstance(entry, dict) else []
                        if len(actions) != 1 or set(entry) - PLAN_ACTIONS - {"message"}:
                            report.error(f"{sw}.plan[{n}]", f"needs exactly one of {sorted(PLAN_ACTIONS)} and optionally 'message'")
            check_lab_check(report, f"{sw}.check", step["check"])
            for opt in ("hint", "after"):
                if opt in step:
                    check_text(report, f"{sw}.{opt}", step[opt], routes, min_chars=10)


def check_drills(report: Report, rel: str, drills: Any, ctx: dict) -> None:
    routes = ctx["routes"]
    if not isinstance(drills, list) or not drills:
        report.error(rel, "expected a non-empty list of drills")
        return
    for i, drill in enumerate(drills):
        where = f"{rel}[{i}]"
        if not require_keys(report, where, drill, ["id", "track", "title", "minutes", "situation", "steps", "debrief", "lesson"]):
            continue
        did = drill["id"]
        if not isinstance(did, str) or not did.startswith("drill-") or not ID_RE.match(did):
            report.error(where, "id must look like 'drill-something'")
        elif did in ctx["drill_ids_seen"]:
            report.error(where, f"duplicate drill id '{did}'")
        else:
            ctx["drill_ids_seen"].add(did)
        if drill["track"] not in ctx["track_ids"]:
            report.error(where, f"unknown track '{drill['track']}'")
        if drill["lesson"] not in ctx["lesson_order"]:
            report.error(where, f"unknown lesson '{drill['lesson']}'")
        if not isinstance(drill["minutes"], int) or isinstance(drill["minutes"], bool) or not 1 <= drill["minutes"] <= 30:
            report.error(f"{where}.minutes", "must be a whole number from 1 to 30")
        check_text(report, f"{where}.title", drill["title"], routes, min_chars=10, max_chars=90)
        check_text(report, f"{where}.situation", drill["situation"], routes, min_chars=80)
        check_text(report, f"{where}.debrief", drill["debrief"], routes, min_chars=60)
        steps = drill["steps"]
        if not isinstance(steps, list) or not 2 <= len(steps) <= 5:
            report.error(f"{where}.steps", "expected 2 to 5 decision points")
            continue
        for s, step in enumerate(steps):
            sw = f"{where}.steps[{s}]"
            if not require_keys(report, sw, step, ["prompt", "choices"]):
                continue
            check_text(report, f"{sw}.prompt", step["prompt"], routes, min_chars=15)
            choices = step["choices"]
            if not isinstance(choices, list) or not 2 <= len(choices) <= 4:
                report.error(f"{sw}.choices", "expected 2 to 4 choices")
                continue
            verdicts = []
            for c, choice in enumerate(choices):
                cw = f"{sw}.choices[{c}]"
                if require_keys(report, cw, choice, ["text", "verdict", "feedback"]):
                    check_text(report, f"{cw}.text", choice["text"], routes, min_chars=5)
                    check_text(report, f"{cw}.feedback", choice["feedback"], routes, min_chars=30)
                    if choice["verdict"] not in VERDICTS:
                        report.error(f"{cw}.verdict", f"must be one of {sorted(VERDICTS)}")
                    verdicts.append(choice["verdict"])
            if verdicts.count("best") != 1:
                report.error(f"{sw}.choices", "exactly one choice must have verdict 'best'")


def check_placement(report: Report, placement: Any, ctx: dict) -> None:
    rel = "content/placement.json"
    routes = ctx["routes"]
    if not require_keys(report, rel, placement, ["intro", "questions"]):
        return
    check_text(report, f"{rel}.intro", placement["intro"], routes, min_chars=30)
    questions = placement["questions"]
    if not isinstance(questions, list) or len(questions) < 4:
        report.error(f"{rel}.questions", "expected at least 4 questions")
        return
    for q, question in enumerate(questions):
        qw = f"{rel}.questions[{q}]"
        if not require_keys(report, qw, question, ["track", "q", "choices", "answer", "why"]):
            continue
        if question["track"] not in ctx["track_ids"]:
            report.error(qw, f"unknown track '{question['track']}'")
        check_text(report, f"{qw}.q", question["q"], routes, min_chars=15)
        check_text_list(report, f"{qw}.choices", question["choices"], routes, min_items=3, max_items=5, min_chars=1)
        check_text(report, f"{qw}.why", question["why"], routes, min_chars=30)
        n = len(question["choices"]) if isinstance(question["choices"], list) else 0
        if not isinstance(question["answer"], int) or not 0 <= question["answer"] < n:
            report.error(f"{qw}.answer", "must be the zero-based index of the right choice")


# --------------------------------------------------------------------------
# Whole-content validation
# --------------------------------------------------------------------------

def load_all(report: Report, only: str | None = None) -> dict:
    """Load and validate everything. Returns the assembled content."""
    manifest = load_json(CONTENT / "tracks.json", report)
    if not isinstance(manifest, dict):
        return {}
    for key in ("site", "lenses", "tools", "tracks", "lessonTitles"):
        if key not in manifest:
            report.error("content/tracks.json", f"missing '{key}'")
            return {}

    if [l.get("id") for l in manifest["lenses"]] != list(LENSES):
        report.error("content/tracks.json", f"lenses must be exactly {list(LENSES)} in that order")
    if [t.get("id") for t in manifest["tools"]] != list(TOOLS):
        report.error("content/tracks.json", f"tools must be exactly {list(TOOLS)} in that order")

    track_ids: list[str] = []
    lesson_order: dict[str, int] = {}
    lesson_track: dict[str, str] = {}
    for track in manifest["tracks"]:
        tid = track.get("id")
        if not isinstance(tid, str) or not ID_RE.match(tid):
            report.error("content/tracks.json", f"bad track id '{tid}'")
            continue
        if tid in track_ids:
            report.error("content/tracks.json", f"duplicate track '{tid}'")
        track_ids.append(tid)
        for key in ("letter", "title", "subtitle", "promise", "audience", "lessons"):
            if key not in track:
                report.error("content/tracks.json", f"track '{tid}' is missing '{key}'")
        for lid in track.get("lessons", []):
            if lid in lesson_order:
                report.error("content/tracks.json", f"lesson '{lid}' is listed twice")
            lesson_order[lid] = len(lesson_order)
            lesson_track[lid] = tid
            if lid not in manifest["lessonTitles"]:
                report.error("content/tracks.json", f"lesson '{lid}' has no entry in lessonTitles")

    labs = load_json(CONTENT / "labs.json", report)
    lab_ids = {lab.get("id") for lab in labs if isinstance(lab, dict)} if isinstance(labs, list) else set()

    drills: list[dict] = []
    drill_files = sorted((CONTENT / "drills").glob("*.json"))
    drill_sources: list[tuple[str, Any]] = []
    for path in drill_files:
        data = load_json(path, report)
        drill_sources.append((str(path.relative_to(ROOT)), data))
        if isinstance(data, list):
            drills.extend(d for d in data if isinstance(d, dict))
    drill_ids = {d.get("id") for d in drills}

    routes = set(lesson_order) | {i for i in lab_ids if i} | {i for i in drill_ids if i}
    routes |= TOOL_ROUTES | {f"track-{t}" for t in track_ids}

    ctx = {
        "track_ids": set(track_ids),
        "lesson_order": lesson_order,
        "lesson_track": lesson_track,
        "lesson_titles": manifest["lessonTitles"],
        "lab_ids": lab_ids,
        "routes": routes,
        "terms_seen": {},
        "drill_ids_seen": set(),
    }

    # Lessons.
    lessons: dict[str, dict] = {}
    lesson_dir = CONTENT / "lessons"
    for path in sorted(lesson_dir.glob("*/*.json")):
        rel = str(path.relative_to(ROOT))
        if only and path.parent.name != only:
            data = load_json(path, Report())  # load quietly so cross-references resolve
            if isinstance(data, dict) and isinstance(data.get("id"), str):
                lessons[data["id"]] = data
            continue
        data = load_json(path, report)
        if data is None:
            continue
        check_lesson(report, rel, data, ctx)
        if isinstance(data, dict) and isinstance(data.get("id"), str):
            lessons[data["id"]] = data

    missing = [lid for lid in lesson_order if lid not in lessons]
    if only:
        missing = [lid for lid in missing if lesson_track[lid] == only]

    # Labs, drills, placement.
    if not only:
        check_labs(report, labs, ctx)
        for rel, data in drill_sources:
            if data is not None:
                check_drills(report, rel, data, ctx)
        placement_path = CONTENT / "placement.json"
        placement = load_json(placement_path, report) if placement_path.exists() else None
        if placement is not None:
            check_placement(report, placement, ctx)
        lab_used = {l.get("lab") for l in lessons.values() if l.get("lab")}
        lab_used |= {lab_id for l in lessons.values() for lab_id in (l.get("moreLabs") or [])}
        for lab in labs if isinstance(labs, list) else []:
            lid = lab.get("id")
            if lid and lid not in lab_used and not lab.get("free") and lid != "lab-playground" and not lab.get("draft"):
                report.warn("content/labs.json", f"lab '{lid}' is not attached to any lesson")
    else:
        placement_path = CONTENT / "placement.json"
        placement = load_json(placement_path, Report()) if placement_path.exists() else None
        for rel, data in drill_sources:
            if data is not None and Path(rel).stem == only:
                check_drills(report, rel, data, ctx)

    return {
        "manifest": manifest,
        "lessons": lessons,
        "missing": missing,
        "labs": labs if isinstance(labs, list) else [],
        "drills": drills,
        "placement": placement,
        "lesson_order": lesson_order,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate the guide's content.")
    parser.add_argument("--strict", action="store_true", help="fail on warnings and on lessons that are listed but not written")
    parser.add_argument("--only", metavar="TRACK", help="check only this track's lessons and drills")
    parser.add_argument("--quiet", action="store_true", help="print the summary line only")
    args = parser.parse_args(argv)

    report = Report()
    content = load_all(report, only=args.only)
    missing = content.get("missing", [])

    if not args.quiet:
        for problem in report.problems:
            print(problem)
        for lid in missing:
            print(f"  {'ERROR' if args.strict else 'warn '}  content/tracks.json: lesson '{lid}' is listed but not written yet")

    n_lessons = len(content.get("lessons", {}))
    n_errors = len(report.errors) + (len(missing) if args.strict else 0)
    n_warnings = len(report.warnings) + (0 if args.strict else len(missing))
    print(f"validate: {n_lessons} lessons loaded, {n_errors} errors, {n_warnings} warnings")

    if n_errors:
        return 1
    if args.strict and report.warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
