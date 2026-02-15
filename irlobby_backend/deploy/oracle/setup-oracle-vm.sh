#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/oracle/setup-oracle-vm.sh"
  exit 1
fi

apt-get update
apt-get upgrade -y

apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  docker.io \
  certbot \
  python3-certbot-nginx \
  ufw

if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin
elif apt-cache show docker-compose-v2 >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2
else
  echo "No Docker Compose v2 package found in apt repositories." >&2
  exit 1
fi

systemctl enable docker
systemctl start docker

if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  usermod -aG docker "${SUDO_USER}" || true
fi

iptables -C INPUT -j REJECT --reject-with icmp-host-prohibited >/dev/null 2>&1 \
  && iptables -D INPUT -j REJECT --reject-with icmp-host-prohibited || true
iptables -C FORWARD -j REJECT --reject-with icmp-host-prohibited >/dev/null 2>&1 \
  && iptables -D FORWARD -j REJECT --reject-with icmp-host-prohibited || true

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Oracle VM bootstrap complete."
echo "Next: create deploy user, copy repo, then use deploy/oracle/deploy.sh"
