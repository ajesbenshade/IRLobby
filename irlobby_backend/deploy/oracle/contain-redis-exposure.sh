#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUBLIC_HOST="${1:-${REDIS_PUBLIC_CHECK_HOST:-}}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/oracle/contain-redis-exposure.sh ${PUBLIC_HOST:-<public-host>}" >&2
  exit 1
fi

ensure_iptables_rule() {
  local table_chain="$1"
  shift

  iptables -C "${table_chain}" "$@" >/dev/null 2>&1 || iptables -I "${table_chain}" "$@"
}

default_iface() {
  ip -o route show default 2>/dev/null | awk '{print $5; exit}' || true
}

echo "Applying emergency Redis/TCP 6379 containment on this host..."

if command -v ufw >/dev/null 2>&1; then
  ufw delete allow 6379/tcp >/dev/null 2>&1 || true
  ufw delete allow 6379 >/dev/null 2>&1 || true
  ufw deny 6379/tcp
  ufw reload >/dev/null 2>&1 || ufw --force enable
fi

if command -v iptables >/dev/null 2>&1; then
  iface="$(default_iface)"
  ensure_iptables_rule INPUT -p tcp --dport 6379 -j DROP

  if iptables -S DOCKER-USER >/dev/null 2>&1; then
    if [[ -n "${iface}" ]]; then
      ensure_iptables_rule DOCKER-USER -i "${iface}" -p tcp --dport 6379 -j DROP
    else
      echo "Could not detect the default network interface; skipped DOCKER-USER Redis drop rule." >&2
    fi
  fi
fi

echo "Current Redis listeners:"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 'sport = :6379' || true
else
  echo "ss is not installed; skipped listener display."
fi

echo "Current Docker port mappings mentioning Redis/6379:"
if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '6379|redis' || true
else
  echo "Docker CLI is not installed; skipped Docker port mapping display."
fi

echo "Emergency containment applied."
echo "This script is firewall-only. Do not rotate REDIS_PASSWORD or recreate app containers from here."
echo "HOLD rotate / requirepass / redeploy until Aaron or CoS authorizes that step."
echo "Webmaster: verify external Redis PING to TCP 6379 fails from outside the VPS."

if [[ -n "${PUBLIC_HOST}" ]]; then
  echo "Verification command from an external network: nc -vz ${PUBLIC_HOST} 6379"
fi
