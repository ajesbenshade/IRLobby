#!/usr/bin/env python3
"""Fill REDIS_PASSWORD / REDIS_URL in .env.production from a live REDIS_URL."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse


def get_val(text: str, key: str) -> str | None:
    match = re.search(rf"^{re.escape(key)}=(.*)$", text, flags=re.M)
    return None if match is None else match.group(1)


def is_placeholder(value: str | None) -> bool:
    if value is None:
        return True
    stripped = value.strip()
    if not stripped:
        return True
    return bool(re.search(r"replace-with|CHANGE_ME|change-me", stripped, flags=re.I))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default=".env.production")
    parser.add_argument("--redis-url", default="")
    args = parser.parse_args()

    path = Path(args.env_file)
    text = path.read_text()
    redis_url = args.redis_url.strip().strip('"').strip("'")
    if not redis_url:
        redis_url = (get_val(text, "REDIS_URL") or "").strip().strip('"').strip("'")

    password = ""
    if redis_url:
        password = unquote(urlparse(redis_url).password or "")

    current = get_val(text, "REDIS_PASSWORD")
    placeholder = is_placeholder(current)
    if not password and placeholder:
        print("Could not recover REDIS_PASSWORD from REDIS_URL", file=sys.stderr)
        return 1

    if placeholder and password:
        if current is None:
            if not text.endswith("\n"):
                text += "\n"
            text += f"REDIS_PASSWORD={password}\n"
            print("Appended REDIS_PASSWORD from live REDIS_URL.")
        else:
            text = re.sub(
                r"^REDIS_PASSWORD=.*$",
                f"REDIS_PASSWORD={password}",
                text,
                count=1,
                flags=re.M,
            )
            print("Filled REDIS_PASSWORD from live REDIS_URL.")
    else:
        print("REDIS_PASSWORD already set in .env.production.")

    if get_val(text, "REDIS_URL") is None and redis_url:
        if not text.endswith("\n"):
            text += "\n"
        text += f"REDIS_URL={redis_url}\n"
        print("Appended REDIS_URL from live container.")

    path.write_text(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
