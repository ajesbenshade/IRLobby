#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${1:-${ROOT_DIR}/docker-compose.oracle.yml}"
ENV_FILE="${2:-${ROOT_DIR}/.env.production}"
PUBLIC_HOST="${3:-${REDIS_PUBLIC_CHECK_HOST:-}}"
REQUIRE_DOCKER_REDIS_CHECKS="${REQUIRE_DOCKER_REDIS_CHECKS:-false}"
VERIFY_EXTERNAL_REDIS="${VERIFY_EXTERNAL_REDIS:-false}"

fail() {
  echo "Redis privacy check failed: $*" >&2
  exit 1
}

warn() {
  echo "Redis privacy warning: $*" >&2
}

validate_compose_file() {
  local compose_file="$1"
  [[ -f "${compose_file}" ]] || fail "Missing compose file: ${compose_file}"
  bash "${ROOT_DIR}/deploy/oracle/validate-redis-ports.sh" "${compose_file}"
}

validate_rendered_compose() {
  command -v docker >/dev/null 2>&1 || {
    warn "Docker CLI not found; skipped rendered Compose Redis port check."
    return
  }

  local compose_args=(docker compose -f "${COMPOSE_FILE}")
  if [[ -f "${ENV_FILE}" ]]; then
    compose_args+=(--env-file "${ENV_FILE}")
  fi

  local rendered_config
  if ! rendered_config="$("${compose_args[@]}" config)"; then
    if [[ "${REQUIRE_DOCKER_REDIS_CHECKS}" == "true" ]]; then
      fail "docker compose config could not render ${COMPOSE_FILE}."
    fi
    warn "docker compose config failed; skipped rendered Compose Redis port check."
    return
  fi

  local rendered_file
  rendered_file="$(mktemp)"
  printf '%s\n' "${rendered_config}" > "${rendered_file}"
  bash "${ROOT_DIR}/deploy/oracle/validate-redis-ports.sh" "${rendered_file}"
  rm -f "${rendered_file}"
}

detect_docker_command() {
  command -v docker >/dev/null 2>&1 || return 1

  if docker info >/dev/null 2>&1; then
    printf 'docker\n'
    return 0
  fi

  if command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
    printf 'sudo docker\n'
    return 0
  fi

  return 1
}

check_docker_runtime_ports() {
  local docker_command
  if ! docker_command="$(detect_docker_command)"; then
    if [[ "${REQUIRE_DOCKER_REDIS_CHECKS}" == "true" ]]; then
      fail "Docker daemon is unavailable for runtime Redis port checks."
    fi
    warn "Docker daemon is unavailable; skipped runtime Redis port checks."
    return
  fi

  local docker_parts=()
  read -r -a docker_parts <<< "${docker_command}"

  local compose_args=("${docker_parts[@]}" compose -f "${COMPOSE_FILE}")
  if [[ -f "${ENV_FILE}" ]]; then
    compose_args+=(--env-file "${ENV_FILE}")
  fi

  local published_port
  published_port="$("${compose_args[@]}" port redis 6379 2>/dev/null || true)"
  if [[ -n "${published_port}" ]]; then
    fail "Docker Compose reports Redis is published on the host: ${published_port}"
  fi

  local published_containers
  published_containers="$("${docker_parts[@]}" ps --format '{{.Names}}\t{{.Ports}}' | grep -E '(^|[[:space:]])(0\.0\.0\.0|\[::\]|[^[:space:]]+):6379->6379/tcp' || true)"
  if [[ -n "${published_containers}" ]]; then
    fail "Docker container ports expose Redis: ${published_containers}"
  fi
}

check_host_listener() {
  if ! command -v ss >/dev/null 2>&1; then
    warn "ss command not found; skipped host listener check."
    return
  fi

  local listeners
  listeners="$(ss -H -ltn 'sport = :6379' 2>/dev/null || true)"
  [[ -n "${listeners}" ]] || return 0

  local public_listeners
  public_listeners="$(printf '%s\n' "${listeners}" | awk '{print $4}' | grep -Ev '^(127\.|\[::1\]|::1|localhost)' || true)"

  if [[ -n "${public_listeners}" ]]; then
    fail "TCP 6379 is listening on non-loopback addresses: $(printf '%s' "${public_listeners}" | tr '\n' ' ')"
  fi

  warn "TCP 6379 is listening on loopback only. Confirm no external Redis service is intended."
}

check_ufw_rules() {
  command -v ufw >/dev/null 2>&1 || return 0

  local ufw_status
  ufw_status="$(ufw status 2>/dev/null || true)"
  if printf '%s\n' "${ufw_status}" | grep -Eiq '6379(/tcp)?[[:space:]]+ALLOW'; then
    fail "UFW contains an allow rule for Redis/TCP 6379."
  fi
}

check_external_access() {
  [[ "${VERIFY_EXTERNAL_REDIS}" == "true" ]] || return 0
  [[ -n "${PUBLIC_HOST}" ]] || fail "VERIFY_EXTERNAL_REDIS=true requires a public host argument or REDIS_PUBLIC_CHECK_HOST."
  command -v nc >/dev/null 2>&1 || fail "nc is required for VERIFY_EXTERNAL_REDIS=true."

  if nc -vz -w 5 "${PUBLIC_HOST}" 6379; then
    fail "External Redis connection to ${PUBLIC_HOST}:6379 succeeded."
  fi
}

validate_compose_file "${COMPOSE_FILE}"
validate_rendered_compose
check_docker_runtime_ports
check_host_listener
check_ufw_rules
check_external_access

echo "Redis private-network check passed."

if [[ "${VERIFY_EXTERNAL_REDIS}" != "true" ]]; then
  echo "From an external network, run: nc -vz ${PUBLIC_HOST:-<public-host>} 6379"
  echo "That external Redis connection must fail, refuse, or time out."
fi
