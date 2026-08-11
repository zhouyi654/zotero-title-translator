#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def load_manifest() -> dict:
    return json.loads((ROOT / "manifest.json").read_text(encoding="utf-8-sig"))


def repository_from_homepage(homepage_url: str) -> str:
    match = re.fullmatch(r"https://github\.com/([^/]+)/([^/]+)/?", homepage_url.strip())
    if not match:
        raise ValueError("homepage_url must be a GitHub repository URL")
    return f"{match.group(1)}/{match.group(2)}"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_update_manifest(xpi_path: Path, tag: str | None = None) -> dict:
    manifest = load_manifest()
    version = str(manifest["version"])
    expected_tag = f"v{version}"
    if tag and tag != expected_tag:
        raise ValueError(f"Tag {tag!r} does not match manifest version {version!r}")

    addon = manifest["applications"]["zotero"]
    addon_id = addon["id"]
    repository = repository_from_homepage(manifest["homepage_url"])
    release_tag = tag or expected_tag
    update_link = (
        f"https://github.com/{repository}/releases/download/"
        f"{release_tag}/{xpi_path.name}"
    )

    zotero_compat = {"strict_min_version": addon["strict_min_version"]}
    if addon.get("strict_max_version"):
        zotero_compat["strict_max_version"] = addon["strict_max_version"]

    return {
        "addons": {
            addon_id: {
                "updates": [
                    {
                        "version": version,
                        "update_link": update_link,
                        "update_hash": f"sha256:{sha256(xpi_path)}",
                        "applications": {"zotero": zotero_compat},
                    }
                ]
            }
        }
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Zotero updates.json for the built XPI."
    )
    parser.add_argument("--tag", help="Release tag, for example v0.3.10")
    parser.add_argument(
        "--output",
        default=str(DIST / "updates.json"),
        help="Output JSON path",
    )
    args = parser.parse_args()

    manifest = load_manifest()
    xpi_path = DIST / f"zotero-title-translator-{manifest['version']}.xpi"
    if not xpi_path.is_file():
        raise FileNotFoundError(
            f"Built XPI not found: {xpi_path}. Run python build_xpi.py --check first."
        )

    payload = build_update_manifest(xpi_path, args.tag)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(output)


if __name__ == "__main__":
    main()
