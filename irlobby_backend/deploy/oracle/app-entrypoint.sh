#!/usr/bin/env bash
set -euo pipefail

cd /app

wait_for_postgres() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    return
  fi

  if [[ ! "${DATABASE_URL}" =~ ^postgres(ql)?:// ]]; then
    return
  fi

  local host
  host="$(python - <<'PY'
from urllib.parse import urlparse
import os

url = os.environ.get('DATABASE_URL', '')
parsed = urlparse(url)
print(parsed.hostname or '')
PY
)"

  local port
  port="$(python - <<'PY'
from urllib.parse import urlparse
import os

url = os.environ.get('DATABASE_URL', '')
parsed = urlparse(url)
print(parsed.port or 5432)
PY
)"

  if [[ -z "${host}" ]]; then
    return
  fi

  echo "Waiting for PostgreSQL at ${host}:${port}..."
  for _ in {1..60}; do
    if nc -z "${host}" "${port}" >/dev/null 2>&1; then
      echo "PostgreSQL is reachable."
      return
    fi
    sleep 2
  done

  echo "PostgreSQL is not reachable after timeout." >&2
  exit 1
}

wait_for_postgres

if [[ "${RUN_MIGRATIONS:-false}" == "true" ]]; then
  echo "Running migrations..."
  python manage.py migrate --noinput
fi

if [[ "${RUN_COLLECTSTATIC:-false}" == "true" ]]; then
  echo "Collecting static files..."
  python manage.py collectstatic --noinput
fi

exec "$@"
