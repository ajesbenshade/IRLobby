#!/usr/bin/env python3
"""Drop http:// and localhost origins from CORS/CSRF/WS allowlists."""

from __future__ import annotations

import argparse
from pathlib import Path

KEYS = {
    "CORS_ALLOWED_ORIGINS",
    "CSRF_TRUSTED_ORIGINS",
    "WEBSOCKET_ALLOWED_ORIGINS",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default=".env.production")
    args = parser.parse_args()

    path = Path(args.env_file)
    lines = path.read_text().splitlines()
    out = []
    changed = False
    for line in lines:
        if "=" not in line or line.lstrip().startswith("#"):
            out.append(line)
            continue
        key, val = line.split("=", 1)
        if key not in KEYS:
            out.append(line)
            continue
        parts = [part.strip() for part in val.split(",") if part.strip()]
        kept = []
        for part in parts:
            if part.startswith("http://") or "localhost" in part or "127.0.0.1" in part:
                changed = True
                continue
            kept.append(part)
        out.append(f"{key}={','.join(kept)}")

    if changed:
        path.write_text("\n".join(out) + "\n")
        print("Sanitized non-HTTPS/local origins from CORS/CSRF/WS lists.")
    else:
        print("Origin lists already HTTPS-only.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
