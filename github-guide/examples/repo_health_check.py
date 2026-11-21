#!/usr/bin/env python3
"""Check a GitHub repository against the habits this guide teaches.

A worked example for the lesson "GitHub without the browser". It asks the
GitHub REST API a handful of read-only questions and prints a checklist:
is there a README, a license, a description, a protected default branch,
a security policy, a workflow, a release?

    python repo_health_check.py OWNER/REPO
    python repo_health_check.py OWNER/REPO --json
    GITHUB_TOKEN=... python repo_health_check.py OWNER/REPO

Public repositories work without a token, within a small hourly limit. For
private repositories or more requests, create a fine-grained personal access
token with read-only access to the repository's metadata and contents, and
export it as GITHUB_TOKEN. The token is read from the environment so it
never appears in your shell history or in this file.

Standard library only. Nothing is written, anywhere: every request is a GET.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Callable, Optional

API = "https://api.github.com"
API_VERSION = "2022-11-28"

Fetch = Callable[[str], Optional[Any]]


class ApiError(Exception):
    """A response we cannot treat as a plain yes or no."""


def make_fetch(token: str | None, opener: Callable = urllib.request.urlopen) -> Fetch:
    """Return a function that GETs an API path and decodes the JSON.

    A 404 becomes None, because "not found" is an answer here: the repository
    has no license, no release, no such file. Everything else unexpected is
    raised, so a rate limit is never mistaken for a missing file.
    """

    def fetch(path: str) -> Any | None:
        request = urllib.request.Request(API + path)
        request.add_header("Accept", "application/vnd.github+json")
        request.add_header("X-GitHub-Api-Version", API_VERSION)
        request.add_header("User-Agent", "repo-health-check-example")
        if token:
            request.add_header("Authorization", f"Bearer {token}")
        try:
            with opener(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            if error.code in (403, 429) and error.headers.get("X-RateLimit-Remaining") == "0":
                raise ApiError("Rate limit reached. Wait for the reset, or set GITHUB_TOKEN for a higher limit.") from error
            if error.code == 401:
                raise ApiError("The token was rejected. Check that GITHUB_TOKEN is current.") from error
            raise ApiError(f"GitHub answered {error.code} for {path}") from error
        except urllib.error.URLError as error:
            raise ApiError(f"Could not reach GitHub: {error.reason}") from error

    return fetch


def first_existing(fetch: Fetch, repo: str, paths: list[str]) -> str | None:
    """Return the first of several file locations that exists in the repository."""
    for path in paths:
        if fetch(f"/repos/{repo}/contents/{path}") is not None:
            return path
    return None


def check_repository(repo: str, fetch: Fetch) -> dict:
    """Gather facts about a repository and turn them into a checklist."""
    info = fetch(f"/repos/{repo}")
    if info is None:
        raise ApiError(f"No repository named {repo} is visible. Check the spelling, or set GITHUB_TOKEN if it is private.")

    branch = info.get("default_branch", "main")
    profile = fetch(f"/repos/{repo}/community/profile") or {}
    files = profile.get("files") or {}
    branch_info = fetch(f"/repos/{repo}/branches/{branch}") or {}
    workflows = fetch(f"/repos/{repo}/actions/workflows") or {}
    release = fetch(f"/repos/{repo}/releases/latest")
    security = first_existing(fetch, repo, ["SECURITY.md", ".github/SECURITY.md", "docs/SECURITY.md"])
    citation = first_existing(fetch, repo, ["CITATION.cff"])
    license_info = info.get("license") or {}

    def has(name: str) -> bool:
        # The API returns an object for a file that exists and null for one that does not.
        return files.get(name) is not None

    def item(name: str, ok: bool, detail: str, lesson: str) -> dict:
        return {"check": name, "ok": bool(ok), "detail": detail, "lesson": lesson}

    checks = [
        item("Description", info.get("description"), info.get("description") or "No description in the About panel", "basics-repo-tour"),
        item("README", has("readme"), "Found" if has("readme") else "No README", "basics-markdown"),
        item("License", license_info.get("spdx_id") not in (None, "NOASSERTION"),
             license_info.get("spdx_id") or "No license: others may look and may not reuse", "expert-law-tax-access"),
        item("Topics", info.get("topics"), ", ".join(info.get("topics") or []) or "No topics, so the repository is harder to find", "intermediate-navigation-search"),
        item("Contributing guide", has("contributing"), "Found" if has("contributing") else "No CONTRIBUTING file", "intermediate-forks-open-source"),
        item("Pull request template", has("pull_request_template"), "Found" if has("pull_request_template") else "No template", "intermediate-code-review"),
        item("Default branch protected", branch_info.get("protected"),
             f"{branch} is protected" if branch_info.get("protected") else f"{branch} accepts direct pushes", "advanced-branch-protection"),
        item("Workflows", workflows.get("total_count"), f"{workflows.get('total_count', 0)} workflow file(s)", "advanced-actions-fundamentals"),
        item("Security policy", security, security or "No SECURITY.md", "advanced-security-features"),
        item("Release", release, (release or {}).get("tag_name") or "No published release", "intermediate-pages-releases"),
        item("Citation file", citation, citation or "No CITATION.cff", "advanced-research-repro"),
    ]
    return {
        "repository": info.get("full_name", repo),
        "visibility": info.get("visibility", "unknown"),
        "default_branch": branch,
        "archived": bool(info.get("archived")),
        "passed": sum(1 for c in checks if c["ok"]),
        "total": len(checks),
        "checks": checks,
    }


def format_report(report: dict) -> str:
    """Plain text, with words for status so nothing depends on color."""
    lines = [
        f"{report['repository']}  ({report['visibility']}, default branch {report['default_branch']})",
        f"{report['passed']} of {report['total']} checks pass",
        "",
    ]
    width = max(len(c["check"]) for c in report["checks"])
    for c in report["checks"]:
        status = "ok     " if c["ok"] else "MISSING"
        lines.append(f"  {status}  {c['check'].ljust(width)}  {c['detail']}")
        if not c["ok"]:
            lines.append(f"           {' ' * width}  see the lesson: {c['lesson']}")
    if report["archived"]:
        lines += ["", "Note: this repository is archived, so it is read-only."]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check a GitHub repository against good habits.")
    parser.add_argument("repo", help="the repository as OWNER/REPO")
    parser.add_argument("--json", action="store_true", help="print the result as JSON")
    parser.add_argument("--strict", action="store_true", help="exit with status 1 if any check is missing")
    args = parser.parse_args(argv)

    if args.repo.count("/") != 1 or not all(args.repo.split("/")):
        parser.error("give the repository as OWNER/REPO, for example octocat/Hello-World")

    try:
        report = check_repository(args.repo, make_fetch(os.environ.get("GITHUB_TOKEN")))
    except ApiError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    print(json.dumps(report, indent=2) if args.json else format_report(report))
    return 1 if args.strict and report["passed"] < report["total"] else 0


if __name__ == "__main__":
    sys.exit(main())
