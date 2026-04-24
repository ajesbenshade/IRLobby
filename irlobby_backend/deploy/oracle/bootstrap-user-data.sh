#!/usr/bin/env bash
# IRLobby Backend - Oracle Cloud Initialization Script (cloud-init user-data)
# Runs as root on first boot.

exec > >(tee -a /var/log/user-data.log) 2>&1
set -euo pipefail

echo "=== IRLobby Bootstrap Started at $(date -Is) ==="

# ----------------------------
# Config (override via cloud-init user-data if needed)
# ----------------------------
REPO_URL="${REPO_URL:-https://github.com/ajesbenshade/IRLobby.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_ROOT="${APP_ROOT:-/opt/irlobby}"
BACKEND_DIR="${BACKEND_DIR:-${APP_ROOT}/irlobby_backend}"

GITHUB_TOKEN="${GITHUB_TOKEN:-}"   # Optional: for private repo
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"

# Optional automation toggles.
RUN_SETUP_SCRIPT="${RUN_SETUP_SCRIPT:-true}"
CONFIGURE_FIREWALL="${CONFIGURE_FIREWALL:-true}"
AUTO_CERTBOT="${AUTO_CERTBOT:-false}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
# Comma-separated list, e.g. CERTBOT_DOMAINS=api.example.com,www.api.example.com
CERTBOT_DOMAINS="${CERTBOT_DOMAINS:-}"
AUTO_DEPLOY="${AUTO_DEPLOY:-false}"

export DEBIAN_FRONTEND=noninteractive

retry() {
  local n=0
  local max=5
  local delay=5
  until "$@"; do
    n=$((n + 1))
    if [[ "$n" -ge "$max" ]]; then
      echo "Command failed after ${max} attempts: $*"
      return 1
    fi
    echo "Retry ${n}/${max} in ${delay}s: $*"
    sleep "$delay"
    delay=$((delay * 2))
  done
}

echo "Updating system and installing base packages..."
retry apt-get update -y
retry apt-get upgrade -y
retry apt-get install -y git curl unzip jq ca-certificates

if [[ "${CONFIGURE_FIREWALL}" == "true" ]]; then
  retry apt-get install -y ufw
  ufw allow OpenSSH || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw --force enable || true
fi

# Create directory
mkdir -p "${APP_ROOT}"
cd "${APP_ROOT}"

# Clone or update repo
if [[ -d "${APP_ROOT}/.git" ]]; then
  echo "Repo already exists, updating..."
  git fetch --all --prune
  git checkout "${REPO_BRANCH}"
  git reset --hard "origin/${REPO_BRANCH}"
else
  clone_url="${REPO_URL}"
  if [[ -n "${GITHUB_TOKEN}" && "${REPO_URL}" =~ ^https://github.com/ ]]; then
    clone_url="https://${GITHUB_TOKEN}@${REPO_URL#https://}"
  fi
  echo "Cloning ${REPO_URL} (branch: ${REPO_BRANCH})..."
  retry git clone --branch "${REPO_BRANCH}" --single-branch "${clone_url}" .
fi

cd "${BACKEND_DIR}"

if [[ "${RUN_SETUP_SCRIPT}" == "true" ]]; then
  echo "Running Oracle VM setup script..."
  bash deploy/oracle/setup-oracle-vm.sh || echo "Warning: setup-oracle-vm.sh returned non-zero (check log)"
fi

# Cloud-init usually runs as root (no SUDO_USER), so ensure the deploy user gets docker access.
if id "${DEPLOY_USER}" >/dev/null 2>&1; then
  usermod -aG docker "${DEPLOY_USER}" || true
fi

# Create .env.production from template if it doesn't exist
if [[ -f .env.oracle.example && ! -f .env.production ]]; then
  cp .env.oracle.example .env.production
  chmod 600 .env.production
  echo "✅ Created .env.production from template. Please edit it with real values!"
fi

# Optionally issue HTTPS certificate before deploy.
if [[ "${AUTO_CERTBOT}" == "true" ]]; then
  retry apt-get install -y certbot python3-certbot-nginx

  cert_domains="${CERTBOT_DOMAINS}"
  if [[ -z "${cert_domains}" && -f .env.production ]]; then
    server_name_value="$(grep -E '^SERVER_NAME=' .env.production | cut -d '=' -f2- | tr -d '[:space:]' || true)"
    cert_domains="${server_name_value}"
  fi

  if [[ -z "${CERTBOT_EMAIL}" || -z "${cert_domains}" ]]; then
    echo "AUTO_CERTBOT=true but CERTBOT_EMAIL or CERTBOT_DOMAINS/SERVER_NAME is missing. Skipping cert issuance."
  else
    certbot_args=()
    IFS=',' read -r -a domain_list <<< "${cert_domains}"
    for d in "${domain_list[@]}"; do
      trimmed="$(echo "${d}" | xargs)"
      [[ -n "${trimmed}" ]] && certbot_args+=( -d "${trimmed}" )
    done

    if (( ${#certbot_args[@]} > 0 )); then
      echo "Issuing certificate for domains: ${cert_domains}"
      retry certbot certonly --standalone "${certbot_args[@]}" -m "${CERTBOT_EMAIL}" --agree-tos --no-eff-email
      certbot renew --dry-run || true
    fi
  fi
fi

# Optionally auto-run deploy if env appears configured.
if [[ "${AUTO_DEPLOY}" == "true" ]]; then
  if [[ ! -f .env.production ]]; then
    echo "AUTO_DEPLOY=true but .env.production is missing. Skipping deploy."
  elif rg -n "replace-with|CHANGE_ME|yourdomain|username:password@host|example.com" .env.production >/dev/null 2>&1; then
    echo "AUTO_DEPLOY=true but .env.production still has placeholder values. Skipping deploy for safety."
  else
    echo "Running deploy.sh..."
    bash deploy/oracle/deploy.sh
  fi
fi

cat <<EOF
=== IRLobby Bootstrap Finished at $(date -Is) ===

Next manual steps:
1. SSH in:   ssh ubuntu@<IP>
2. Edit:     nano /opt/irlobby/irlobby_backend/.env.production
3. Deploy:   cd /opt/irlobby/irlobby_backend && bash deploy/oracle/deploy.sh
4. Check logs: sudo tail -n 100 /var/log/user-data.log
EOF