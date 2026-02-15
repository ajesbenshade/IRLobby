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

echo "Starting services..."
"${DOCKER_CMD[@]}" compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "${PROFILE_ARGS[@]}" up -d

echo "Deployment complete."
echo "Health check: curl -I https://$(grep '^SERVER_NAME=' "${ENV_FILE}" | cut -d '=' -f2)/api/health/"
