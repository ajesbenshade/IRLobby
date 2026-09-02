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

if [[ -z "${BACKUP_GPG_RECIPIENT:-}" && -z "${BACKUP_GPG_PASSPHRASE:-}" ]]; then
  if [[ "${ALLOW_UNENCRYPTED_BACKUPS:-false}" != "true" ]]; then
    echo "Refusing to write plaintext backups. Set BACKUP_GPG_RECIPIENT or BACKUP_GPG_PASSPHRASE, or set ALLOW_UNENCRYPTED_BACKUPS=true for a local-only emergency backup."
    exit 1
  fi
fi

encrypt_stream() {
  local output_path="$1"

  if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
    gpg --batch --yes --trust-model always --encrypt \
      --recipient "${BACKUP_GPG_RECIPIENT}" \
      --output "${output_path}.gpg" \
      -
  elif [[ -n "${BACKUP_GPG_PASSPHRASE:-}" ]]; then
    gpg --batch --yes --pinentry-mode loopback \
      --passphrase "${BACKUP_GPG_PASSPHRASE}" \
      --symmetric --cipher-algo AES256 \
      --output "${output_path}.gpg" \
      -
  else
    cat > "${output_path}"
  fi
}

echo "Creating PostgreSQL dump..."
docker run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
  postgres:16-alpine \
  sh -lc 'pg_dump "$DATABASE_URL" | gzip' \
  | encrypt_stream "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

echo "Saving deployment config snapshot..."
tar -cz \
  -C "${ROOT_DIR}" \
  docker-compose.oracle.yml \
  .env.oracle.example \
  deploy/oracle/nginx/default.conf.template \
  deploy/oracle/nginx/legal-locations.inc \
  deploy/oracle/legal/privacy.html \
  deploy/oracle/legal/support.html \
  | encrypt_stream "${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz"

if [[ "${BACKUP_RETENTION_DAYS:-30}" =~ ^[0-9]+$ ]]; then
  find "${BACKUP_DIR}" -type f -mtime +"${BACKUP_RETENTION_DAYS:-30}" \
    \( -name 'db_*.sql.gz' -o -name 'db_*.sql.gz.gpg' -o -name 'config_*.tar.gz' -o -name 'config_*.tar.gz.gpg' \) \
    -delete
fi

echo "Backup complete in ${BACKUP_DIR}."
