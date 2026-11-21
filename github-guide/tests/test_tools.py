"""Tests for the Python tooling and for the design tokens.

Run with:  python -m unittest discover -s github-guide/tests -v
"""
from __future__ import annotations

import copy
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import build  # noqa: E402
import validate  # noqa: E402


# ---------------------------------------------------------------------------
# Accessibility: color contrast is checked by a machine, not by eye
# ---------------------------------------------------------------------------

def relative_luminance(hex_color: str) -> float:
    """WCAG relative luminance of an sRGB color such as '#0F1B2A'."""
    value = hex_color.lstrip("#")
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(a: str, b: str) -> float:
    la, lb = relative_luminance(a), relative_luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def read_themes() -> dict[str, dict[str, str]]:
    """Read tokens.css and return the color tokens for each of the four themes."""
    css = (ROOT / "src" / "css" / "tokens.css").read_text(encoding="utf-8")
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)

    def block(selector: str) -> dict[str, str]:
        match = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", css)
        if not match:
            raise AssertionError(f"tokens.css has no block for {selector}")
        return dict(re.findall(r"--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;", match.group(1)))

    light = block(":root")
    dark = {**light, **block(':root[data-theme="dark"]')}
    return {
        "light": light,
        "dark": dark,
        "light, more contrast": {**light, **block(':root[data-contrast="more"]')},
        "dark, more contrast": {**dark, **block(':root[data-contrast="more"][data-theme="dark"]')},
    }


# Text on a background: WCAG 2.2 AA asks for 4.5 to 1.
TEXT_PAIRS = [
    ("ink", "paper"), ("ink", "surface"), ("ink", "well"),
    ("ink-2", "paper"), ("ink-2", "surface"), ("ink-2", "well"),
    ("link", "paper"), ("link", "surface"), ("link", "note-bg"),
    ("line-b", "paper"), ("line-i", "paper"), ("line-a", "paper"), ("line-e", "paper"),
    ("line-b", "surface"), ("line-i", "surface"), ("line-a", "surface"), ("line-e", "surface"),
    ("on-line", "line-b"), ("on-line", "line-i"), ("on-line", "line-a"), ("on-line", "line-e"),
    ("good", "good-bg"), ("warn", "warn-bg"), ("bad", "bad-bg"),
    ("ink", "good-bg"), ("ink", "warn-bg"), ("ink", "bad-bg"), ("ink", "note-bg"),
    ("paper", "ink"),
]
# Borders of controls and the focus ring: 3 to 1.
UI_PAIRS = [
    ("rule-strong", "surface"), ("rule-strong", "paper"),
    ("focus", "paper"), ("focus", "surface"),
]


class ContrastTest(unittest.TestCase):
    def test_text_meets_aa_in_every_theme(self) -> None:
        for theme, tokens in read_themes().items():
            for fg, bg in TEXT_PAIRS:
                with self.subTest(theme=theme, pair=f"{fg} on {bg}"):
                    ratio = contrast(tokens[fg], tokens[bg])
                    self.assertGreaterEqual(ratio, 4.5, f"{fg} on {bg} is {ratio:.2f}:1 in the {theme} theme")

    def test_controls_and_focus_ring_meet_three_to_one(self) -> None:
        for theme, tokens in read_themes().items():
            for fg, bg in UI_PAIRS:
                with self.subTest(theme=theme, pair=f"{fg} on {bg}"):
                    ratio = contrast(tokens[fg], tokens[bg])
                    self.assertGreaterEqual(ratio, 3.0, f"{fg} on {bg} is {ratio:.2f}:1 in the {theme} theme")

    def test_dark_theme_is_defined_twice_identically(self) -> None:
        """The system-preference block and the explicit block must not drift apart."""
        css = (ROOT / "src" / "css" / "tokens.css").read_text(encoding="utf-8")
        by_media = re.search(r':root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}', css).group(1)
        by_attr = re.search(r':root\[data-theme="dark"\]\s*\{([^}]*)\}', css).group(1)
        tokens = lambda text: sorted(re.findall(r"--[a-z0-9-]+:\s*[^;]+;", text))  # noqa: E731
        self.assertEqual(tokens(by_media), tokens(by_attr))


# ---------------------------------------------------------------------------
# The validator
# ---------------------------------------------------------------------------

def make_context() -> dict:
    manifest = json.loads((ROOT / "content" / "tracks.json").read_text(encoding="utf-8"))
    labs = json.loads((ROOT / "content" / "labs.json").read_text(encoding="utf-8"))
    order = {lid: i for i, lid in enumerate(l for t in manifest["tracks"] for l in t["lessons"])}
    lab_ids = {lab["id"] for lab in labs}
    return {
        "track_ids": {t["id"] for t in manifest["tracks"]},
        "lesson_order": order,
        "lesson_track": {l: t["id"] for t in manifest["tracks"] for l in t["lessons"]},
        "lesson_titles": manifest["lessonTitles"],
        "lab_ids": lab_ids,
        "routes": set(order) | lab_ids | validate.TOOL_ROUTES | {"drill-huge-file"},
        "terms_seen": {},
        "drill_ids_seen": set(),
    }


GOLD = "content/lessons/intermediate/intermediate-merge-conflicts.json"


class ValidatorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.gold = json.loads((ROOT / GOLD).read_text(encoding="utf-8"))

    def errors_for(self, lesson: dict) -> list[str]:
        report = validate.Report()
        validate.check_lesson(report, GOLD, lesson, make_context())
        return [p.message for p in report.errors]

    def test_reference_lesson_is_clean(self) -> None:
        self.assertEqual(self.errors_for(copy.deepcopy(self.gold)), [])

    def test_all_content_passes_strict_validation(self) -> None:
        report = validate.Report()
        loaded = validate.load_all(report)
        self.assertEqual([str(p) for p in report.problems], [])
        self.assertEqual(loaded["missing"], [], "every lesson in tracks.json should be written")
        self.assertEqual(len(loaded["lessons"]), 34)

    def test_quiz_answer_must_point_at_a_choice(self) -> None:
        lesson = copy.deepcopy(self.gold)
        lesson["quiz"][0]["answer"] = 9
        self.assertTrue(any("zero-based index" in e for e in self.errors_for(lesson)))

    def test_every_lens_is_required(self) -> None:
        lesson = copy.deepcopy(self.gold)
        del lesson["lenses"]["legal"]
        self.assertTrue(any("missing required field 'legal'" in e for e in self.errors_for(lesson)))

    def test_every_tool_needs_steps(self) -> None:
        lesson = copy.deepcopy(self.gold)
        del lesson["howto"][0]["phone"]
        self.assertTrue(any("missing required field 'phone'" in e for e in self.errors_for(lesson)))

    def test_unknown_block_type_is_rejected(self) -> None:
        lesson = copy.deepcopy(self.gold)
        lesson["sections"][0]["blocks"].append({"type": "video", "url": "https://example.com"})
        self.assertTrue(any("unknown block type" in e for e in self.errors_for(lesson)))

    def test_title_must_match_the_curriculum(self) -> None:
        lesson = copy.deepcopy(self.gold)
        lesson["title"] = "Merge conflicts"
        self.assertTrue(any("title must match" in e for e in self.errors_for(lesson)))

    def test_misspelled_field_is_caught(self) -> None:
        lesson = copy.deepcopy(self.gold)
        lesson["sumary"] = "typo"
        self.assertTrue(any("unknown field 'sumary'" in e for e in self.errors_for(lesson)))

    def inline_errors(self, text: str) -> list[str]:
        report = validate.Report()
        validate.check_inline(report, "t", text, {"basics-commits"})
        return [p.message for p in report.errors]

    def test_inline_markup_rules(self) -> None:
        self.assertEqual(self.inline_errors("Run `git status` and read **every** line. See [commits](#basics-commits)."), [])
        self.assertEqual(self.inline_errors("An expression such as `${{ secrets.TOKEN }}` is code."), [])
        self.assertTrue(self.inline_errors("An `unclosed code span"))
        self.assertTrue(self.inline_errors("A **bold that never ends"))
        self.assertTrue(self.inline_errors("Raw <b>HTML</b> is refused"))
        self.assertTrue(self.inline_errors("A [link](http://insecure.example) must be https"))
        self.assertTrue(self.inline_errors("A [link](#no-such-lesson) must resolve"))
        self.assertTrue(self.inline_errors("TODO write this"))
        self.assertEqual(self.inline_errors("Git calls the rebase plan a todo list."), [])

    def test_graph_parents_must_come_first(self) -> None:
        report = validate.Report()
        validate.check_graph(report, "g", {
            "commits": [{"id": "B", "parents": ["A"]}, {"id": "A"}],
            "branches": {"main": "B"},
        })
        self.assertTrue(any("must be listed before" in p.message for p in report.errors))

    def test_word_count_ignores_markup(self) -> None:
        self.assertEqual(validate.count_words("Run `git status` **now**, [here](https://example.com)."), 5)


# ---------------------------------------------------------------------------
# The build
# ---------------------------------------------------------------------------

class BuildTest(unittest.TestCase):
    def test_content_hash_is_stable_and_sensitive(self) -> None:
        a = {"title": "Commits", "minutes": 12}
        self.assertEqual(build.content_sha(a), build.content_sha({"minutes": 12, "title": "Commits"}))
        self.assertNotEqual(build.content_sha(a), build.content_sha({"title": "Commits", "minutes": 13}))
        self.assertEqual(len(build.content_sha(a)), 40)

    def test_assemble_produces_what_the_site_expects(self) -> None:
        loaded = validate.load_all(validate.Report())
        content = build.assemble(loaded)
        self.assertEqual([t["id"] for t in content["tracks"]], ["basics", "intermediate", "advanced", "expert"])
        for lesson in content["lessons"].values():
            self.assertRegex(lesson["sha"], r"^[0-9a-f]{7}$")
            self.assertNotIn("_words", lesson)
            self.assertGreater(lesson["words"], 400)
        self.assertEqual(content["build"]["counts"]["lessons"], 34)
        self.assertTrue(all(not lab.get("draft") for lab in content["labs"]))
        # Every lab a lesson points at must exist in the built content.
        lab_ids = {lab["id"] for lab in content["labs"]}
        for lesson in content["lessons"].values():
            if "lab" in lesson:
                self.assertIn(lesson["lab"], lab_ids)

    def test_offline_bundle_is_self_contained(self) -> None:
        index = (ROOT / "src" / "index.html").read_text(encoding="utf-8")
        html = build.write_offline(index, json.dumps({"note": "a </script> inside data"}))
        self.assertNotIn('<script src="js/', html, "local scripts must be inlined")
        self.assertNotIn('href="css/', html, "local stylesheets must be inlined")
        self.assertIn('id="gg-content"', html)
        self.assertNotIn("a </script> inside data", html, "a closing tag inside the data must be escaped")
        self.assertEqual(html.count("<script"), html.count("</script>"))

    def test_index_lists_every_script_that_exists(self) -> None:
        index = (ROOT / "src" / "index.html").read_text(encoding="utf-8")
        listed = set(re.findall(r'<script src="js/([^"]+)" defer></script>', index))
        on_disk = {p.name for p in (ROOT / "src" / "js").glob("*.js")}
        self.assertEqual(listed, on_disk)


if __name__ == "__main__":
    unittest.main()
