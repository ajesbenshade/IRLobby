#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.production"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required but not installed." >&2
  exit 1
fi

DJANGO_SECRET_KEY="$(openssl rand -base64 64 | tr -d '\n' | tr '/+' '_-' | cut -c1-64)"
POSTGRES_PASSWORD="$(openssl rand -base64 48 | tr -d '\n' | tr '/+' '_-' | cut -c1-40)"
REDIS_PASSWORD="$(openssl rand -base64 48 | tr -d '\n' | tr '/+' '_-' | cut -c1-40)"
REDIS_URL_VALUE="redis://:${REDIS_PASSWORD}@redis:6379/0"
TWITTER_CLIENT_ID_PLACEHOLDER="CHANGE_ME_TWITTER_CLIENT_ID"
TWITTER_CLIENT_SECRET_PLACEHOLDER="CHANGE_ME_TWITTER_CLIENT_SECRET"
SMTP_USER_PLACEHOLDER="CHANGE_ME_SMTP_USER"
SMTP_PASSWORD_PLACEHOLDER="CHANGE_ME_SMTP_APP_PASSWORD"

cat <<EOF
# Generated secrets (copy into .env.production)
SECRET_KEY=${DJANGO_SECRET_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://irlobby:${POSTGRES_PASSWORD}@postgres:5432/irlobby
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=${REDIS_URL_VALUE}
CELERY_BROKER_URL=${REDIS_URL_VALUE}
CELERY_RESULT_BACKEND=${REDIS_URL_VALUE}
TWITTER_CLIENT_ID=${TWITTER_CLIENT_ID_PLACEHOLDER}
TWITTER_CLIENT_SECRET=${TWITTER_CLIENT_SECRET_PLACEHOLDER}
EMAIL_HOST_USER=${SMTP_USER_PLACEHOLDER}
EMAIL_HOST_PASSWORD=${SMTP_PASSWORD_PLACEHOLDER}
EOF

if [[ "${1:-}" == "--write" ]]; then
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing ${ENV_FILE}. Create it first (e.g., copy deploy/oracle/.env.production.liyf.example)." >&2
    exit 1
  fi

  tmp_file="$(mktemp)"
  awk \
    -v django_secret="${DJANGO_SECRET_KEY}" \
    -v postgres_password="${POSTGRES_PASSWORD}" \
    -v redis_password="${REDIS_PASSWORD}" \
    -v redis_url="${REDIS_URL_VALUE}" \
    'BEGIN { }\
    /^SECRET_KEY=/ { print "SECRET_KEY=" django_secret; next }\
    /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" postgres_password; next }\
    /^DATABASE_URL=postgresql:\/\// { print "DATABASE_URL=postgresql://irlobby:" postgres_password "@postgres:5432/irlobby"; next }\
    /^REDIS_PASSWORD=/ { print "REDIS_PASSWORD=" redis_password; seen_redis_password=1; next }\
    /^REDIS_URL=/ { print "REDIS_URL=" redis_url; seen_redis_url=1; next }\
    /^CELERY_BROKER_URL=/ { print "CELERY_BROKER_URL=" redis_url; seen_celery_broker=1; next }\
    /^CELERY_RESULT_BACKEND=/ { print "CELERY_RESULT_BACKEND=" redis_url; seen_celery_result=1; next }\
    { print }\
    END {\
      if (!seen_redis_password) print "REDIS_PASSWORD=" redis_password;\
      if (!seen_redis_url) print "REDIS_URL=" redis_url;\
      if (!seen_celery_broker) print "CELERY_BROKER_URL=" redis_url;\
      if (!seen_celery_result) print "CELERY_RESULT_BACKEND=" redis_url;\
    }' "${ENV_FILE}" >"${tmp_file}"

  mv "${tmp_file}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo "Updated ${ENV_FILE} with generated SECRET_KEY, POSTGRES_PASSWORD, and REDIS_PASSWORD."
fi
