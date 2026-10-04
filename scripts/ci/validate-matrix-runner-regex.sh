#!/usr/bin/env bash
# Regex-sample tests for the github-runners matrix custom manager.
# Uses python3 (stock on GitHub-hosted ubuntu) so reusable-validate
# does not need bun. JS named groups are rewritten to Python (?P<name>).
set -euo pipefail

python3 - "$@" <<'PY'
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# python3 - reads stdin; resolve from cwd (repo root, as CI invokes us).
REPO = Path.cwd()
CONFIG = json.loads((REPO / "renovate-config.json").read_text(encoding="utf-8"))
TESTDATA = REPO / "scripts" / "ci" / "testdata" / "matrix-runners"


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def to_python_regex(pattern: str) -> str:
    return re.sub(r"\(\?<", "(?P<", pattern)


def extract(content: str, line_re: re.Pattern[str], label_re: re.Pattern[str]) -> list[str]:
    labels: list[str] = []
    for line_match in line_re.finditer(content):
        for label_match in label_re.finditer(line_match.group(0)):
            dep_name = label_match.groupdict().get("depName")
            current_value = label_match.groupdict().get("currentValue")
            if dep_name and current_value:
                labels.append(f"{dep_name}-{current_value}")
    return labels


def assert_labels(title: str, actual: list[str], expected: list[str]) -> None:
    if sorted(actual) != sorted(expected):
        fail(f"{title}: expected {sorted(expected)!r}, got {sorted(actual)!r}")


managers = [
    entry
    for entry in CONFIG.get("customManagers", [])
    if entry.get("datasourceTemplate") == "github-runners"
]
if len(managers) != 1:
    fail("expected exactly one github-runners custom manager")
manager = managers[0]
match_strings = manager.get("matchStrings")
if not isinstance(match_strings, list) or len(match_strings) != 2:
    fail("github-runners manager must have exactly two matchStrings")
if "latest" in match_strings[1]:
    fail("label regex must not mention latest")

file_patterns = manager.get("managerFilePatterns", [])
if not file_patterns or not str(file_patterns[0]).startswith("/"):
    fail("managerFilePatterns must be a /regex/")
file_re = re.compile(str(file_patterns[0])[1:-1])
if file_re.search(".github/workflows/build-binary.yml") is None:
    fail("file pattern must match .github/workflows/build-binary.yml")
if file_re.search("docker-compose.yml") is not None:
    fail("file pattern must not match docker-compose.yml")
if file_re.search("scripts/ci/testdata/matrix-runners/outside-workflow.yaml") is not None:
    fail("file pattern must not match testdata outside workflows")

line_re = re.compile(to_python_regex(str(match_strings[0])))
label_re = re.compile(to_python_regex(str(match_strings[1])))

rustume = (TESTDATA / "build-binary.yml").read_text(encoding="utf-8")
if "windows-latest" not in rustume:
    fail("Rustume fixture must still contain windows-latest as a negative")
assert_labels(
    "Rustume build-binary.yml",
    extract(rustume, line_re, label_re),
    ["ubuntu-24.04", "ubuntu-24.04", "macos-15-intel", "macos-14"],
)

lists = (TESTDATA / "lists-and-nested.yml").read_text(encoding="utf-8")
assert_labels(
    "lists and nested runs-on",
    extract(lists, line_re, label_re),
    [
        "ubuntu-24.04",
        "macos-14",
        "windows-2022",
        "macos-14",
        "ubuntu-22.04-arm",
    ],
)

outside = (TESTDATA / "outside-workflow.yaml").read_text(encoding="utf-8")
if not extract(outside, line_re, label_re):
    fail("regex should see runner labels in non-workflow YAML; file pattern excludes it")

negatives = [
    "    runs-on: ${{ matrix.os }}\n",
    "    runs-on: ubuntu-24.04\n",
    "    runs-on: ubuntu-latest\n",
    "        os: windows-latest\n",
    "        os: ubuntu-latest-arm\n",
    "        runner: macos-latest\n",
]
for sample in negatives:
    found = extract(sample, line_re, label_re)
    if found:
        fail(f"negative sample should not match: {sample!r} -> {found!r}")

print("matrix runner regex samples passed")
PY
