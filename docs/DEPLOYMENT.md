# Deployment Overview

This document lists production deployment information. The root README covers product and contributor flow.

## Production shape

- Public web app and marketing pages: `https://irlobby.com`
- Public API and WebSocket host: `https://api.irlobby.com` / `wss://api.irlobby.com`
- Backend: Django, Channels, Celery, Redis, and Docker Compose on the production host
- Database: PostgreSQL/PostGIS in production. Local development can use the SQLite default from `.env.example`
- Mobile: Expo/EAS builds. App release notes are in the mobile docs

The detailed backend deployment runbook is at [irlobby_backend/deploy/oracle/README.md](../irlobby_backend/deploy/oracle/README.md).

## Required environment groups

Configure these groups with real secret values in the deployment environment. Do not put real secrets in committed files:

- Django core: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`
- Database: `DATABASE_URL`
- Redis and Celery: `REDIS_PASSWORD`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
- Browser origins: `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `WEBSOCKET_ALLOWED_ORIGINS`, `FRONTEND_BASE_URL`
- Email delivery: `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`
- OAuth and mobile integrations: Twitter OAuth variables, Expo push variables, Mapbox public token, and platform-specific build variables
- Payments and ticketing: Stripe API and webhook settings when paid activities are enabled
- Monitoring: Sentry DSN, environment, and sampling variables when enabled

Use [.env.example](../.env.example) for placeholder names. Use [EMAIL_SETUP.md](EMAIL_SETUP.md) for SMTP details.

## Redis hardening

Keep Redis private to Docker networking in production.

- Do not publish TCP port `6379` to the public internet.
- Require `REDIS_PASSWORD` and authenticated Redis URLs for Django and Celery.
- After deploy, run `bash deploy/oracle/verify-redis-private.sh docker-compose.oracle.yml .env.production <public-host>` on the backend host.
- From an external network, verify that a connection to Redis/TCP `6379` is refused or times out.
- Confirm that worker and web containers can still reach Redis internally.

If Redis/TCP `6379` is already reachable publicly:

1. Close the provider firewall rule first.
2. Run `sudo bash deploy/oracle/contain-redis-exposure.sh <public-host>` on the backend host as an emergency containment step.
3. Rotate Redis credentials.
4. Redeploy.

## Web deployment notes

The web app can use relative `/api` routes when hosted behind the same origin or a rewrite. If the frontend and backend are on different origins, set `VITE_API_BASE_URL` and `VITE_WEBSOCKET_BASE_URL` at build time.

Optional web OAuth build-time variables:

- `VITE_GOOGLE_WEB_CLIENT_ID` — Google OAuth **web** client ID used by Google Identity Services on `irlobby.com`. Also include this ID in backend `GOOGLE_OAUTH_CLIENT_IDS`.
- `VITE_APPLE_WEB_CLIENT_ID` — Apple Services ID for Sign in with Apple on the web. Ensure `APPLE_OAUTH_AUDIENCES` / domain association covers `irlobby.com`.
- `VITE_APPLE_REDIRECT_URI` — optional; defaults to `window.location.origin` (typically `https://irlobby.com`).

cPanel deploys by copying the prebuilt `apps/web/dist` tree (see `.cpanel.yml`). After you push `main`, use cPanel → Git Version Control → **Update from Remote** → **Deploy HEAD Commit**.

Use `VITE_LOG_CONFIG=true` only while you diagnose startup config. Do not leave config logging enabled for normal production builds.

## App Store legal pages (`/privacy` and `/support`)

Apple review requires working HTTPS URLs at `https://irlobby.com/privacy` and `https://irlobby.com/support`.

**What is live today:** `irlobby.com` still points at leftover Namecheap shared hosting (`162.0.209.170`) with a `*.web-hosting.com` certificate mismatch and a cPanel default page. Those paths 404. Do **not** treat that host as the marketing site.

**What should serve the pages:** the Hetzner VPS that already runs `api.irlobby.com` (`5.75.156.23`, nginx 1.27 in Docker). This repo:

- Stores the HTML in `site/privacy.html` and `site/support.html` (copies also live in `irlobby_backend/deploy/oracle/legal/` so the backend image can serve them).
- Serves `/privacy` and `/support` (with and without a trailing slash) from nginx when the files exist under `/opt/irlobby/web`, and from Django as a fallback.
- Adds an HTTP vhost for `irlobby.com` / `www.irlobby.com` so a later DNS A-record change is enough for HTTP. HTTPS on the apex needs a Let's Encrypt cert after DNS moves.

Human steps after this code is deployed:

1. Run the **Backend Deploy** workflow so nginx, `/opt/irlobby/web`, and Django pick up the pages.
2. Confirm `https://api.irlobby.com/privacy` and `https://api.irlobby.com/support` return the real documents (the workflow already checks this).
3. Point the `irlobby.com` and `www.irlobby.com` A records from `162.0.209.170` to `5.75.156.23`. Do not change `api.irlobby.com`. The Enable Marketing TLS workflow does not change DNS.
4. After those A records propagate, run the **Enable Marketing TLS** workflow (`.github/workflows/enable-marketing-tls.yml`). It SSHs to the VPS, issues the apex cert, and runs `enable-marketing-tls.sh`. `/var/www/certbot` is bind-mounted into nginx at the same path, and the HTTP vhost serves `/.well-known/acme-challenge/` from there.

   Manual equivalent on the VPS **host** (not inside the nginx container):

   ```bash
   sudo mkdir -p /var/www/certbot
   sudo certbot certonly --webroot -w /var/www/certbot -d irlobby.com -d www.irlobby.com
   bash deploy/oracle/enable-marketing-tls.sh
   ```

   Do not pass `-w deploy/oracle/certbot-webroot` (that directory is not served). Do not renew or replace the existing `api.irlobby.com` certificate.
5. Confirm `https://irlobby.com/privacy` and `https://irlobby.com/support`.
6. Confirm `support@irlobby.com` (and `ajesbenshade@gmail.com` as backup) can receive mail. App Store Connect URLs stay as they are; this change does not submit the app.

`ALLOWED_HOSTS` on the VPS must include `irlobby.com` and `www.irlobby.com` so the Django fallback accepts those `Host` headers.

## Mobile release notes

Coordinate mobile production builds through EAS and GitHub Actions.

- [App Store release flow](../apps/mobile/APP_STORE_RELEASE.md)
- [Launch checklist](../LAUNCH_CHECKLIST.md)
- [Play Store launch checklist](../PLAY_STORE_LAUNCH.md)
- [Screenshot capture guide](../apps/mobile/store/screenshots/README.md)

The `mobile-eas-build.yml` workflow needs the required Expo and store credentials as repository secrets or variables before it can submit without interaction.

## Secret safety

Install the repository secret guard before you work with deployment files:

```bash
bash scripts/install-secret-guard.sh
```

Keep real credentials in the deployment provider, GitHub Actions secrets, Expo/EAS secrets, or the production host private environment. Committed docs must use placeholders only.

## Post-deploy checks

After a production deploy, verify:

- The backend health endpoint returns HTTP `200`
- Web login, registration, password reset, discovery, matching, and chat start without configuration errors
- WebSocket traffic connects from the public web and mobile clients
- Celery workers are running and can reach Redis
- External Redis access is blocked
- Email delivery works with the configured provider
- Stripe webhooks are configured when ticketing is enabled

## Related docs

- [Repository settings checklist](REPOSITORY_SETTINGS.md)
- [Brand tokens](BRAND_TOKENS.md)
- [Parity release gate](PARITY_RELEASE_GATE.md)
- [Web/mobile parity checklist](PARITY_WEB_VS_MOBILE_CHECKLIST.md)
