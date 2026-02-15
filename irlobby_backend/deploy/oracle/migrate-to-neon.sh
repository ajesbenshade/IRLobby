#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}." >&2
  echo "Copy .env.oracle.example to .env.production first." >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

SOURCE_DATABASE_URL="${DATABASE_URL:-}"
TARGET_DATABASE_URL="${NEON_DATABASE_URL:-}"

if [[ -n "${1:-}" ]]; then
  TARGET_DATABASE_URL="${1}"
fi

if [[ -z "${SOURCE_DATABASE_URL}" ]]; then
  echo "DATABASE_URL is missing in ${ENV_FILE}." >&2
  exit 1
fi

if [[ -z "${TARGET_DATABASE_URL}" ]]; then
  echo "NEON_DATABASE_URL is missing in ${ENV_FILE} (or pass it as arg #1)." >&2
  exit 1
fi

if [[ "${TARGET_DATABASE_URL}" != *"neon.tech"* ]]; then
  echo "Target URL does not look like a Neon host. Aborting for safety." >&2
  exit 1
fi

if [[ "${SOURCE_DATABASE_URL}" == "${TARGET_DATABASE_URL}" ]]; then
  echo "Source and target DATABASE_URL values are identical. Aborting." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi

DOCKER_CMD=(docker)
if ! docker info >/dev/null 2>&1; then
  DOCKER_CMD=(sudo docker)
fi

echo "Starting migration: source DATABASE_URL -> Neon target"
echo "Running pg_dump (custom format, no owner/acl), then pg_restore to Neon..."

"${DOCKER_CMD[@]}" run --rm \
  -e SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL}" \
  -e TARGET_DATABASE_URL="${TARGET_DATABASE_URL}" \
  postgres:16-alpine \
  sh -lc 'pg_dump --format=custom --no-owner --no-acl "$SOURCE_DATABASE_URL" | pg_restore --no-owner --no-acl --clean --if-exists --dbname="$TARGET_DATABASE_URL"'

echo "Data import complete. Running Django migrations against Neon target..."

"${DOCKER_CMD[@]}" run --rm \
  -e DATABASE_URL="${TARGET_DATABASE_URL}" \
  -e SECRET_KEY="${SECRET_KEY:-temporary-secret-for-migration}" \
  -e DEBUG="False" \
  -e ALLOWED_HOSTS="${ALLOWED_HOSTS:-localhost,127.0.0.1}" \
  -v "${ROOT_DIR}:/app" \
  -w /app \
  python:3.12-slim \
  sh -lc 'pip install -q -r requirements.txt && python manage.py migrate --noinput'

echo "Migration verification query (Neon):"
"${DOCKER_CMD[@]}" run --rm \
  -e DATABASE_URL="${TARGET_DATABASE_URL}" \
  postgres:16-alpine \
  sh -lc 'psql "$DATABASE_URL" -c "SELECT NOW() AS migrated_at;"'

echo
echo "Next steps:"
echo "1) Set USE_LOCAL_POSTGRES=false in .env.production"
echo "2) Set DATABASE_URL to your Neon pooled URL"
echo "3) bash deploy/oracle/deploy.sh"
