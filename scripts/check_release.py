#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
EXPECTED_ADDON_ID = "zotero-title-translator@zhouyi654.github.io"
EXPECTED_HOMEPAGE = "https://github.com/zhouyi654/zotero-title-translator"
EXPECTED_UPDATE_URL = (
    "https://github.com/zhouyi654/zotero-title-translator/"
    "releases/latest/download/updates.json"
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fail(message: str) -> None:
    raise ValueError(message)


def check_metadata(tag: str | None) -> str:
    manifest = load_json(ROOT / "manifest.json")
    package = load_json(ROOT / "package.json")

    version = str(manifest.get("version", "")).strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", version):
        fail(f"Invalid manifest version: {version!r}")
    if str(package.get("version", "")).strip() != version:
        fail("manifest.json and package.json versions differ")

    zotero = manifest.get("applications", {}).get("zotero", {})
    if zotero.get("id") != EXPECTED_ADDON_ID:
        fail("Unexpected Zotero add-on id")
    if manifest.get("homepage_url") != EXPECTED_HOMEPAGE:
        fail("Unexpected homepage_url")
    if zotero.get("update_url") != EXPECTED_UPDATE_URL:
        fail("Unexpected update_url")

    strict_min = str(zotero.get("strict_min_version", ""))
    strict_max = str(zotero.get("strict_max_version", ""))
    if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", strict_min):
        fail(f"Invalid strict_min_version: {strict_min!r}")
    # Zotero recommends x.x.* for the latest minor release actually tested.
    if not re.fullmatch(r"\d+\.\d+\.\*", strict_max):
        fail(
            "strict_max_version must use the tested-minor form x.x.* "
            f"(got {strict_max!r})"
        )

    if tag is not None and tag != f"v{version}":
        fail(f"Tag {tag!r} does not match version v{version}")

    for readme_name in ("README.md", "README_EN.md"):
        text = (ROOT / readme_name).read_text(encoding="utf-8-sig")
        if version not in text:
            fail(f"{readme_name} does not mention current version {version}")

    required = [
        "LICENSE",
        "PRIVACY.md",
        "SECURITY.md",
        "CONTRIBUTING.md",
        "build_xpi.py",
        "scripts/generate_updates.py",
        "scripts/workflow_templates/ci.yml",
        "scripts/workflow_templates/release.yml",
    ]
    missing = [name for name in required if not (ROOT / name).is_file()]
    if missing:
        fail("Missing release files: " + ", ".join(missing))

    return version


def check_dist(version: str) -> None:
    xpi = DIST / f"zotero-title-translator-{version}.xpi"
    updates = DIST / "updates.json"
    if not xpi.is_file():
        fail(f"Built XPI not found: {xpi}")
    if not updates.is_file():
        fail(f"Update manifest not found: {updates}")

    with zipfile.ZipFile(xpi, "r") as archive:
        if archive.testzip() is not None:
            fail("XPI integrity check failed")
        try:
            embedded = json.loads(archive.read("manifest.json").decode("utf-8-sig"))
        except KeyError as exc:
            raise ValueError("XPI does not contain manifest.json") from exc
        if str(embedded.get("version")) != version:
            fail("XPI manifest version differs from repository version")

    update_payload = load_json(updates)
    addon = update_payload.get("addons", {}).get(EXPECTED_ADDON_ID, {})
    entries = addon.get("updates", [])
    if len(entries) != 1:
        fail("updates.json must contain exactly one current update entry")
    entry = entries[0]
    if str(entry.get("version")) != version:
        fail("updates.json version differs from repository version")
    expected_hash = "sha256:" + hashlib.sha256(xpi.read_bytes()).hexdigest()
    if entry.get("update_hash") != expected_hash:
        fail("updates.json update_hash does not match the built XPI")
    expected_suffix = f"/v{version}/{xpi.name}"
    if not str(entry.get("update_link", "")).endswith(expected_suffix):
        fail("updates.json update_link does not target the versioned XPI")

    manifest = load_json(ROOT / "manifest.json")
    zotero = manifest["applications"]["zotero"]
    expected_compat = {"strict_min_version": zotero["strict_min_version"]}
    if zotero.get("strict_max_version"):
        expected_compat["strict_max_version"] = zotero["strict_max_version"]
    actual_compat = entry.get("applications", {}).get("zotero")
    if actual_compat != expected_compat:
        fail("updates.json Zotero compatibility differs from manifest.json")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate public-release metadata.")
    parser.add_argument("--tag", help="Expected Git tag, for example v0.3.10")
    parser.add_argument(
        "--dist",
        action="store_true",
        help="Also verify dist XPI and updates.json after building",
    )
    args = parser.parse_args()

    try:
        version = check_metadata(args.tag)
        if args.dist:
            check_dist(version)
    except (OSError, ValueError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        print(f"Release check failed: {exc}", file=sys.stderr)
        return 1

    print(f"Release metadata check passed for v{version}.")
    if args.dist:
        print("Built XPI and updates.json check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
