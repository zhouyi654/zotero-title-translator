#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "scripts" / "workflow_templates"
TARGET = ROOT / ".github" / "workflows"


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for name in ("ci.yml", "release.yml"):
        source = TEMPLATES / name
        destination = TARGET / name
        if not source.is_file():
            raise FileNotFoundError(source)
        shutil.copyfile(source, destination)
        print(f"installed {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
