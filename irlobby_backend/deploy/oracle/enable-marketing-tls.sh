#!/usr/bin/env bash
# Enable HTTPS for irlobby.com / www.irlobby.com on the existing nginx container.
# Run on the Hetzner host AFTER DNS A records point at this box AND certbot has
# issued a certificate. Does not change DNS and does not touch App Store Connect.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENABLED_DIR="${ROOT_DIR}/deploy/oracle/nginx/enabled"
CERT_LIVE="${CERT_LIVE:-/etc/letsencrypt/live/irlobby.com}"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.oracle.yml"
ENV_FILE="${ROOT_DIR}/.env.production"

if [[ ! -f "${CERT_LIVE}/fullchain.pem" || ! -f "${CERT_LIVE}/privkey.pem" ]]; then
  echo "Missing Let's Encrypt files under ${CERT_LIVE}." >&2
  echo "Point irlobby.com and www.irlobby.com at this host, then issue:" >&2
  echo "  sudo mkdir -p /var/www/certbot" >&2
  echo "  sudo certbot certonly --webroot -w /var/www/certbot -d irlobby.com -d www.irlobby.com" >&2
  echo "Run certbot on the host, not inside the nginx container. /var/www/certbot is bind-mounted into nginx at the same path; that is the ACME webroot the HTTP vhost serves. Do not use deploy/oracle/certbot-webroot. Do not renew or replace the existing api.irlobby.com certificate." >&2
  exit 1
fi

mkdir -p "${ENABLED_DIR}"
cat > "${ENABLED_DIR}/irlobby.com.conf" <<'NGINX'
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.irlobby.com;

    ssl_certificate /etc/letsencrypt/live/irlobby.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/irlobby.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    return 301 https://irlobby.com$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name irlobby.com;

    ssl_certificate /etc/letsencrypt/live/irlobby.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/irlobby.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    client_max_body_size 25m;
    root /usr/share/nginx/html;
    index index.html;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    include /etc/nginx/legal-locations.inc;

    location @django {
        proxy_pass http://django_web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /api/ {
        proxy_pass http://django_web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /ws/ {
        proxy_pass http://django_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    location / {
        try_files $uri $uri.html $uri/ @django;
    }
}
NGINX

echo "Wrote ${ENABLED_DIR}/irlobby.com.conf"

if [[ -f "${ENV_FILE}" ]]; then
  if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T nginx nginx -t; then
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T nginx nginx -s reload
  else
    echo "nginx -t failed; removing ${ENABLED_DIR}/irlobby.com.conf so api.irlobby.com stays up." >&2
    rm -f "${ENABLED_DIR}/irlobby.com.conf"
    exit 1
  fi
else
  echo "No ${ENV_FILE}; wrote the config only. Recreate/reload nginx yourself." >&2
fi

echo "Verify: curl -sSI https://irlobby.com/privacy && curl -sSI https://irlobby.com/support"
