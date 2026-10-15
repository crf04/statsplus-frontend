#!/usr/bin/env python3
"""Require verify-statsplus evidence for pull requests that change the app.

A pull request that changes a runtime file (anything outside tests, docs, CI
and tooling) says which live checks apply, per the coordination CLAUDE.md, on a
line of its body:

    Live checks: user-visible

- gates only: the owning gates are enough; no evidence table is required.
- user-visible: the body includes a passed QA evidence.md table from
  verify-statsplus.
- boundary: the body also includes a passed production evidence.md table.

An evidence table counts only when its Frontend revision has the same runtime
files this pull request changes as the head does, so a later change to the app
needs a new run. Commit before running QA: uncommitted edits are invisible here.

Usage: check_qa_evidence.py [--body-file FILE] [--base REF] [--head REF]
Without arguments it reads the pull request event in GitHub Actions.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from fnmatch import fnmatch

# Paths that cannot change what a user sees. Everything else is runtime.
NON_RUNTIME = [
    "*.md",
    "LICENSE",
    ".gitignore",
    ".prettierignore",
    ".prettierrc.json",
    ".nvmrc",
    ".mcp.json",
    ".env.example",
    ".agents/*",
    ".github/*",
    "docs/*",
    "e2e/*",
    "scripts/*",
    "*/__tests__/*",
    "*.test.js",
    "*.test.jsx",
    "src/setupTests.js",
    "eslint.config.mjs",
    "playwright.config.mjs",
    "e2e.config.ts",
    "e2e.bugbash.config.ts",
    "tsconfig.e2e.json",
]

LIVE_CHECKS = re.compile(
    r"^[\s>*_-]*live checks[*_]*:[*_\s]*(user-visible|boundary|gates only)\b", re.I | re.M
)
EVIDENCE_HEADER = re.compile(r"^\s*\|\s*Evidence\s*\|\s*Value\s*\|\s*$")
ROW = re.compile(r"^\s*\|(.*)\|\s*$")


def is_runtime(path: str) -> bool:
    return not any(fnmatch(path, pattern) for pattern in NON_RUNTIME)


def live_checks(body: str) -> str | None:
    match = LIVE_CHECKS.search(body or "")
    return match.group(1).lower() if match else None


def evidence_tables(body: str) -> list[dict[str, str]]:
    """Each pasted evidence.md table as {key: value}."""
    tables, current = [], None
    for line in (body or "").splitlines():
        if EVIDENCE_HEADER.match(line):
            current = {}
            tables.append(current)
            continue
        row = ROW.match(line) if current is not None else None
        if row is None:
            current = None
            continue
        cells = [cell.strip() for cell in re.split(r"(?<!\\)\|", row.group(1))]
        if len(cells) >= 2 and not set(cells[0]) <= {"-", " ", ":"}:
            current[cells[0]] = cells[1]
    return tables


def git(*arguments: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *arguments], capture_output=True, text=True)


def changed_runtime_files(base: str, head: str) -> list[str]:
    result = git("diff", "--name-only", "--no-renames", f"{base}...{head}")
    if result.returncode:
        raise SystemExit(f"::error::git diff {base}...{head} failed: {result.stderr.strip()}")
    return [path for path in result.stdout.split() if is_runtime(path)]


def covers(revision: str, head: str, files: list[str]) -> bool:
    """True when the evidence revision has the head's version of every file."""
    if not re.fullmatch(r"[0-9a-f]{7,40}", revision):
        return False
    commit = git("rev-parse", "--verify", "--quiet", f"{revision}^{{commit}}")
    if commit.returncode:
        return False
    return git("diff", "--quiet", commit.stdout.strip(), head, "--", *files).returncode == 0


def problems(body: str, files: list[str], covered) -> list[str]:
    """Why the pull request lacks the evidence its live checks need, if it does."""
    if not files:
        return []
    declared = live_checks(body)
    if declared is None:
        return [
            "This pull request changes runtime files but does not say which live "
            "checks apply. Add a 'Live checks: user-visible', 'Live checks: boundary' "
            "or 'Live checks: gates only' line (see the coordination CLAUDE.md)."
        ]
    if declared == "gates only":
        return []
    needed = ["qa"] + (["production"] if declared == "boundary" else [])
    found = []
    for table in evidence_tables(body):
        frontend = table.get("Frontend", "")
        revision = frontend.rsplit("@", 1)[-1].strip("` ")
        if table.get("Result") == "passed" and covered(revision):
            found.append(table.get("Environment"))
    return [
        f"A {declared} change needs a passed {environment} evidence.md table "
        "from verify-statsplus whose Frontend revision has this pull request's "
        "runtime files. Run it at the current head and paste its evidence.md."
        for environment in needed
        if environment not in found
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--body-file")
    parser.add_argument("--base")
    parser.add_argument("--head")
    options = parser.parse_args()
    if options.body_file:
        body = open(options.body_file).read()
        base, head = options.base, options.head
    else:
        pull = json.load(open(os.environ["GITHUB_EVENT_PATH"]))["pull_request"]
        body = pull.get("body") or ""
        base, head = pull["base"]["sha"], pull["head"]["sha"]
    files = changed_runtime_files(base, head)
    found = problems(body, files, lambda revision: covers(revision, head, files))
    for problem in found:
        print(f"::error::{problem}")
    if not found:
        print(f"Verification evidence is sufficient ({len(files)} runtime files changed).")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
