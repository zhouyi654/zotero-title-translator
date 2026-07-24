#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

EXCLUDED_TOP_LEVEL = {
    ".git",
    ".github",
    "dist",
    "tests",
    "examples",
    "__pycache__",
}

EXCLUDED_FILES = {
    ".gitignore",
    "package.json",
    "package-lock.json",
    "build_xpi.py",
    "SECURITY.md",
    "PRIVACY.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
}

def plugin_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if rel.parts and rel.parts[0] in EXCLUDED_TOP_LEVEL:
            continue
        if rel.as_posix() in EXCLUDED_FILES:
            continue
        if rel.suffix in {".xpi", ".zip", ".pyc"}:
            continue
        files.append(path)
    return sorted(files)

def build() -> Path:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    output = DIST / f"zotero-title-translator-{version}.xpi"
    DIST.mkdir(exist_ok=True)
    output.unlink(missing_ok=True)

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in plugin_files():
            archive.write(path, path.relative_to(ROOT).as_posix())

    with zipfile.ZipFile(output, "r") as archive:
        if archive.testzip() is not None:
            raise RuntimeError("XPI integrity check failed")
        names = set(archive.namelist())
        for required in (
            "manifest.json",
            "bootstrap.js",
            "core.js",
            "prefs.js",
            "content/preferences.xhtml",
            "content/preferences.js",
        ):
            if required not in names:
                raise RuntimeError(f"Missing required file: {required}")

    return output

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = build()
    print(output)
    if args.check:
        print("XPI build and integrity check passed.")

if __name__ == "__main__":
    main()
