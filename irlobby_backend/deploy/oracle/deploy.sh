#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.oracle.yml"
ENV_FILE="${ROOT_DIR}/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.oracle.example to .env.production and fill values."
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

fail() {
  echo "Preflight failed: $*" >&2
  exit 1
}

require_value() {
  local name="$1"
  local value="${!name:-}"
  [[ -n "${value}" ]] || fail "${name} is required."
  if [[ "${value}" =~ (replace-with|CHANGE_ME|your-domain|username:password|example\.com) ]]; then
    fail "${name} still contains a placeholder value."
  fi
}

require_https_origin_list() {
  local name="$1"
  local value="${!name:-}"
  require_value "${name}"
  local IFS=','
  local origin
  for origin in ${value}; do
    origin="$(printf '%s' "${origin}" | xargs)"
    [[ -n "${origin}" ]] || continue
    [[ "${origin}" == https://* ]] || fail "${name} contains non-HTTPS origin: ${origin}"
    [[ "${origin}" != *localhost* && "${origin}" != *127.0.0.1* ]] || fail "${name} contains a local origin: ${origin}"
  done
}

echo "Running production preflight checks..."
[[ "${DEBUG:-}" == "False" || "${DEBUG:-}" == "false" || "${DEBUG:-}" == "0" ]] || fail "DEBUG must be False in production."
require_value SECRET_KEY
require_value SERVER_NAME
require_value ALLOWED_HOSTS
require_https_origin_list CORS_ALLOWED_ORIGINS
require_https_origin_list CSRF_TRUSTED_ORIGINS
require_https_origin_list WEBSOCKET_ALLOWED_ORIGINS
require_value FRONTEND_BASE_URL
[[ "${FRONTEND_BASE_URL}" == https://* ]] || fail "FRONTEND_BASE_URL must use HTTPS."

if [[ "${USE_LOCAL_POSTGRES:-false}" == "true" ]]; then
  require_value POSTGRES_PASSWORD
  [[ "${POSTGRES_PASSWORD}" != "change-me" ]] || fail "POSTGRES_PASSWORD must not be change-me."
fi

require_value DATABASE_URL
if [[ "${DATABASE_URL}" =~ ^postgres(ql)?:// && ! "${DATABASE_URL}" =~ @(postgres|localhost|127\.0\.0\.1)(:|/) ]]; then
  [[ "${DATABASE_URL}" == *sslmode=require* ]] || fail "Remote DATABASE_URL must include sslmode=require."
fi

require_value REDIS_PASSWORD
if (( ${#REDIS_PASSWORD} < 32 )); then
  fail "REDIS_PASSWORD must be at least 32 characters."
fi

if [[ -n "${REDIS_URL:-}" ]]; then
  [[ "${REDIS_URL}" == redis://:*@* || "${REDIS_URL}" == rediss://:*@* ]] || fail "REDIS_URL must include Redis authentication."
fi

if [[ -f "${ENV_FILE}" ]]; then
  env_perms="$(stat -c '%a' "${ENV_FILE}" 2>/dev/null || stat -f '%Lp' "${ENV_FILE}" 2>/dev/null || echo '')"
  if [[ -n "${env_perms}" && "${env_perms: -1}" != "0" ]]; then
    fail "${ENV_FILE} must not be world-readable; run chmod 600 ${ENV_FILE}."
  fi
fi

bash "${ROOT_DIR}/deploy/oracle/validate-redis-ports.sh" "${COMPOSE_FILE}"

echo "Publishing App Store legal pages to /opt/irlobby/web..."
sudo mkdir -p /opt/irlobby/web /var/www/certbot
sudo cp -f "${ROOT_DIR}/deploy/oracle/legal/"*.html /opt/irlobby/web/
SITE_DIR="$(cd "${ROOT_DIR}/.." && pwd)/site"
if [[ -d "${SITE_DIR}" ]]; then
  sudo cp -f "${SITE_DIR}/"*.html /opt/irlobby/web/ || true
  sudo cp -f "${SITE_DIR}/robots.txt" "${SITE_DIR}/sitemap.xml" /opt/irlobby/web/ 2>/dev/null || true
fi

cd "${ROOT_DIR}"

DOCKER_CMD=(docker)
if ! docker info >/dev/null 2>&1; then
  DOCKER_CMD=(sudo docker)
fi

PROFILE_ARGS=()
if [[ "${USE_LOCAL_POSTGRES:-false}" == "true" ]]; then
  PROFILE_ARGS+=(--profile localdb)
  echo "USE_LOCAL_POSTGRES=true detected. Enabling local PostgreSQL service."
fi

echo "Building backend images..."
"${DOCKER_CMD[@]}" compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "${PROFILE_ARGS[@]}" build

if "${DOCKER_CMD[@]}" compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" \
    ps --status running -q nginx 2>/dev/null | grep -q .; then
  echo "Validating nginx config before updating the running proxy..."
  bash "${ROOT_DIR}/deploy/oracle/validate-nginx.sh" "${COMPOSE_FILE}" "${ENV_FILE}" </dev/null
fi

echo "Starting services..."
"${DOCKER_CMD[@]}" compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "${PROFILE_ARGS[@]}" up -d

echo "Verifying Redis is private..."
REQUIRE_DOCKER_REDIS_CHECKS=true bash "${ROOT_DIR}/deploy/oracle/verify-redis-private.sh" "${COMPOSE_FILE}" "${ENV_FILE}" "${SERVER_NAME}"

echo "Deployment complete."
echo "Health check: curl -I https://$(grep '^SERVER_NAME=' "${ENV_FILE}" | cut -d '=' -f2)/api/health/"
