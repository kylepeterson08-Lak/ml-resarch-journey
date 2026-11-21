"""Tests for examples/repo_health_check.py. No network: every response is canned."""
from __future__ import annotations

import io
import json
import sys
import unittest
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "examples"))

import repo_health_check as rhc  # noqa: E402


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def fake_opener(routes: dict, seen: list | None = None):
    """Stand in for urlopen: answer from a dict of path -> JSON, else 404."""

    def opener(request, timeout=0):
        path = request.full_url.replace(rhc.API, "")
        if seen is not None:
            seen.append(request)
        if path not in routes:
            raise urllib.error.HTTPError(request.full_url, 404, "Not Found", {}, None)
        value = routes[path]
        if isinstance(value, Exception):
            raise value
        return FakeResponse(json.dumps(value).encode("utf-8"))

    return opener


HEALTHY = {
    "/repos/you/project": {
        "full_name": "you/project", "description": "Notes on ML research", "default_branch": "main",
        "visibility": "public", "archived": False, "topics": ["machine-learning"], "license": {"spdx_id": "MIT"},
    },
    "/repos/you/project/community/profile": {"files": {"readme": {}, "contributing": {}, "pull_request_template": {}}},
    "/repos/you/project/branches/main": {"protected": True},
    "/repos/you/project/actions/workflows": {"total_count": 2},
    "/repos/you/project/releases/latest": {"tag_name": "v1.0.0"},
    "/repos/you/project/contents/SECURITY.md": {"name": "SECURITY.md"},
    "/repos/you/project/contents/CITATION.cff": {"name": "CITATION.cff"},
}


class RepoHealthCheckTest(unittest.TestCase):
    def test_a_well_kept_repository_passes_every_check(self) -> None:
        report = rhc.check_repository("you/project", rhc.make_fetch(None, fake_opener(HEALTHY)))
        self.assertEqual(report["passed"], report["total"])
        self.assertIn("11 of 11 checks pass", rhc.format_report(report))

    def test_a_bare_repository_reports_what_is_missing(self) -> None:
        bare = {"/repos/you/project": {"full_name": "you/project", "default_branch": "main", "visibility": "public", "license": None}}
        report = rhc.check_repository("you/project", rhc.make_fetch(None, fake_opener(bare)))
        self.assertEqual(report["passed"], 0)
        text = rhc.format_report(report)
        self.assertIn("MISSING  License", text)
        self.assertIn("see the lesson: expert-law-tax-access", text)

    def test_every_lesson_it_recommends_exists(self) -> None:
        manifest = json.loads((ROOT / "content" / "tracks.json").read_text(encoding="utf-8"))
        known = {lesson for track in manifest["tracks"] for lesson in track["lessons"]}
        report = rhc.check_repository("you/project", rhc.make_fetch(None, fake_opener(HEALTHY)))
        for check in report["checks"]:
            self.assertIn(check["lesson"], known)

    def test_an_unknown_repository_is_an_error_not_a_crash(self) -> None:
        with self.assertRaises(rhc.ApiError):
            rhc.check_repository("you/missing", rhc.make_fetch(None, fake_opener({})))

    def test_a_rate_limit_is_not_mistaken_for_a_missing_file(self) -> None:
        limited = urllib.error.HTTPError("u", 403, "Forbidden", {"X-RateLimit-Remaining": "0"}, None)
        with self.assertRaisesRegex(rhc.ApiError, "Rate limit"):
            rhc.make_fetch(None, fake_opener({"/repos/you/project": limited}))("/repos/you/project")

    def test_the_token_travels_in_a_header_and_only_when_given(self) -> None:
        seen: list = []
        rhc.make_fetch("s3cret", fake_opener(HEALTHY, seen))("/repos/you/project")
        self.assertEqual(seen[0].get_header("Authorization"), "Bearer s3cret")
        self.assertNotIn("s3cret", seen[0].full_url)
        seen.clear()
        rhc.make_fetch(None, fake_opener(HEALTHY, seen))("/repos/you/project")
        self.assertIsNone(seen[0].get_header("Authorization"))
        self.assertEqual(seen[0].get_method(), "GET")


if __name__ == "__main__":
    unittest.main()
