#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.production"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}."
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

set -a
source "${ENV_FILE}"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set in ${ENV_FILE}."
  exit 1
fi

echo "Creating PostgreSQL dump..."
docker run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
  -v "${BACKUP_DIR}:/backup" \
  postgres:16-alpine \
  sh -lc 'pg_dump "$DATABASE_URL" | gzip > "/backup/db_${0}.sql.gz"' "${TIMESTAMP}"

echo "Saving deployment config snapshot..."
tar -czf "${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz" \
  -C "${ROOT_DIR}" \
  docker-compose.oracle.yml \
  .env.production \
  .env.oracle.example \
  deploy/oracle/nginx/default.conf.template

echo "Backup complete in ${BACKUP_DIR}."
