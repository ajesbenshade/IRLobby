#!/usr/bin/env bash
# Fail-closed check of the nginx config the next container start would apply.
# Does not replace, restart, or publish ports on the running nginx process, so
# api.irlobby.com TLS stays up if this check fails.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${1:-${ROOT_DIR}/docker-compose.oracle.yml}"
ENV_FILE="${2:-${ROOT_DIR}/.env.production}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}; cannot validate nginx." >&2
  exit 1
fi

mkdir -p /var/www/certbot /opt/irlobby/web 2>/dev/null \
  || sudo mkdir -p /var/www/certbot /opt/irlobby/web

# compose run does not publish 80/443 unless --service-ports is set.
# The official image entrypoint envsubst's the bind-mounted template, then
# execs `nginx -t` against that generated config (including SSL cert paths).
echo "Validating nginx config in a throwaway container (live proxy unchanged)..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" \
  run --rm --no-deps --name "irlobby-nginx-configtest-$$" \
  nginx nginx -t
