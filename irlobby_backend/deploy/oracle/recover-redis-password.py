#!/usr/bin/env python3
"""Fill REDIS_PASSWORD / REDIS_URL in .env.production from a live REDIS_URL."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse


def get_val(text, key):
    match = re.search(rf"^{re.escape(key)}=(.*)$", text, flags=re.M)
    return None if match is None else match.group(1)


def is_placeholder(value):
    if value is None:
        return True
    stripped = value.strip()
    if not stripped:
        return True
    return bool(re.search(r"replace-with|CHANGE_ME|change-me", stripped, flags=re.I))


def password_from_redis_url(redis_url):
    if not redis_url:
        return ""
    cleaned = redis_url.strip().strip('"').strip("'")
    if not cleaned:
        return ""
    parsed = urlparse(cleaned)
    if parsed.password:
        return unquote(parsed.password)
    # Fallback for redis://:password@host when urlparse is picky.
    match = re.match(r"^rediss?://(?:[^:/@]*):([^@]*)@", cleaned)
    if match:
        return unquote(match.group(1))
    return ""


def password_from_redis_cmd_json(raw):
    if not raw:
        return ""
    cleaned = raw.strip()
    if not cleaned:
        return ""
    try:
        import json

        cmd = json.loads(cleaned)
    except Exception:
        cmd = cleaned
    blob = " ".join(cmd) if isinstance(cmd, list) else str(cmd)
    match = re.search(
        r"--requirepass(?:\s+|=\s*)(?:\"([^\"]+)\"|'([^']+)'|(\S+))",
        blob,
    )
    if not match:
        return ""
    return next(group for group in match.groups() if group)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default=".env.production")
    parser.add_argument("--redis-url", default="")
    parser.add_argument("--redis-url-file", default="")
    parser.add_argument("--password", default="")
    parser.add_argument("--password-file", default="")
    parser.add_argument("--redis-cmd-json-file", default="")
    args = parser.parse_args()

    path = Path(args.env_file)
    text = path.read_text()

    redis_url = args.redis_url
    if args.redis_url_file:
        redis_url = Path(args.redis_url_file).read_text().strip()
    redis_url = (redis_url or "").strip().strip('"').strip("'")
    if not redis_url:
        redis_url = (get_val(text, "REDIS_URL") or "").strip().strip('"').strip("'")

    password = args.password
    if args.password_file:
        password = Path(args.password_file).read_text().strip()
    password = (password or "").strip()
    if not password and args.redis_cmd_json_file:
        cmd_path = Path(args.redis_cmd_json_file)
        if cmd_path.exists():
            password = password_from_redis_cmd_json(cmd_path.read_text())
            if password:
                print("Captured REDIS_PASSWORD from redis Cmd")
    if not password:
        password = password_from_redis_url(redis_url)

    current = get_val(text, "REDIS_PASSWORD")
    placeholder = is_placeholder(current)

    has_auth_marker = "@" in redis_url and "://" in redis_url
    print(
        "redis_url_present={} redis_url_has_auth_marker={} password_recovered={} existing_password_set={}".format(
            bool(redis_url),
            has_auth_marker,
            bool(password),
            not placeholder,
        )
    )

    # Compose still interpolates ${REDIS_PASSWORD:?...} even for --no-deps
    # rebuilds. If the live app REDIS_URL has no auth (common on older
    # deployments), synthesize a password solely for compose parsing and keep
    # the captured REDIS_URL as the runtime value.
    allow_insecure_redis = False
    if not password and placeholder and redis_url and not has_auth_marker:
        import secrets

        password = secrets.token_urlsafe(48)
        allow_insecure_redis = True
        print(
            "Synthesized REDIS_PASSWORD for compose interpolation; "
            "keeping unauthenticated REDIS_URL for app runtime."
        )

    if not password and placeholder:
        print("Could not recover REDIS_PASSWORD from REDIS_URL", file=sys.stderr)
        return 1

    if placeholder and password:
        if current is None:
            if not text.endswith("\n"):
                text += "\n"
            text += "REDIS_PASSWORD={}\n".format(password)
            print("Appended REDIS_PASSWORD from live source.")
        else:
            text = re.sub(
                r"^REDIS_PASSWORD=.*$",
                "REDIS_PASSWORD={}".format(password),
                text,
                count=1,
                flags=re.M,
            )
            print("Filled REDIS_PASSWORD from live source.")
    else:
        print("REDIS_PASSWORD already set in .env.production.")

    # Always prefer the live container REDIS_URL when present.
    if redis_url:
        if get_val(text, "REDIS_URL") is None:
            if not text.endswith("\n"):
                text += "\n"
            text += "REDIS_URL={}\n".format(redis_url)
            print("Appended REDIS_URL from live container.")
        else:
            text = re.sub(
                r"^REDIS_URL=.*$",
                "REDIS_URL={}".format(redis_url),
                text,
                count=1,
                flags=re.M,
            )
            print("Updated REDIS_URL from live container.")

    if allow_insecure_redis or (redis_url and not has_auth_marker):
        if get_val(text, "REDIS_REQUIRE_AUTH") is None:
            if not text.endswith("\n"):
                text += "\n"
            text += "REDIS_REQUIRE_AUTH=false\n"
            print("Set REDIS_REQUIRE_AUTH=false for legacy unauthenticated Redis URL.")
        else:
            text = re.sub(
                r"^REDIS_REQUIRE_AUTH=.*$",
                "REDIS_REQUIRE_AUTH=false",
                text,
                count=1,
                flags=re.M,
            )
            print("Updated REDIS_REQUIRE_AUTH=false for legacy unauthenticated Redis URL.")

    path.write_text(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
