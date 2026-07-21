# Deployment Overview

This page keeps the root README focused on product and contributor flow while collecting production deployment pointers in one place.

## Production shape

- Public web app and marketing pages: `https://irlobby.com`.
- Public API and WebSocket host: `https://api.irlobby.com` / `wss://api.irlobby.com`.
- Backend: Django, Channels, Celery, Redis, and Docker Compose on the production host.
- Database: PostgreSQL/PostGIS in production. Local development can use the SQLite default from `.env.example`.
- Mobile: Expo/EAS builds, with app release notes in the mobile docs.

The detailed backend deployment runbook lives at [irlobby_backend/deploy/oracle/README.md](../irlobby_backend/deploy/oracle/README.md).

## Required environment groups

Production deployments should configure these groups with real secret values in the deployment environment, never in committed files:

- Django core: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`.
- Database: `DATABASE_URL`.
- Redis and Celery: `REDIS_PASSWORD`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`.
- Browser origins: `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `WEBSOCKET_ALLOWED_ORIGINS`, `FRONTEND_BASE_URL`.
- Email delivery: `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`.
- OAuth and mobile integrations: Twitter OAuth variables, Expo push variables, Mapbox public token, and any platform-specific build variables.
- Payments and ticketing: Stripe API and webhook settings when paid activities are enabled.
- Monitoring: Sentry DSN, environment, and sampling variables when enabled.

Use [.env.example](../.env.example) for placeholder names and [EMAIL_SETUP.md](EMAIL_SETUP.md) for SMTP details.

## Redis hardening

Redis should stay private to Docker networking in production.

- Do not publish TCP port `6379` to the public internet.
- Require `REDIS_PASSWORD` and authenticated Redis URLs for Django and Celery.
- After deploy, run `bash deploy/oracle/verify-redis-private.sh docker-compose.oracle.yml .env.production <public-host>` on the backend host.
- From an external network, verify a connection to Redis/TCP `6379` is refused or times out.
- Confirm worker and web containers can still reach Redis internally.

If Redis/TCP `6379` is already reachable publicly, close the provider firewall rule first, then run `sudo bash deploy/oracle/contain-redis-exposure.sh <public-host>` on the backend host as an emergency containment step before rotating Redis credentials and redeploying.

## Web deployment notes

The web app can use relative `/api` routes when hosted behind the same origin or a rewrite. If the frontend and backend are on different origins, set `VITE_API_BASE_URL` and `VITE_WEBSOCKET_BASE_URL` at build time.

Optional web OAuth build-time variables:

- `VITE_GOOGLE_WEB_CLIENT_ID` — Google OAuth **web** client ID used by Google Identity Services on `irlobby.com`. Also include this ID in backend `GOOGLE_OAUTH_CLIENT_IDS`.
- `VITE_APPLE_WEB_CLIENT_ID` — Apple Services ID for Sign in with Apple on the web. Ensure `APPLE_OAUTH_AUDIENCES` / domain association covers `irlobby.com`.
- `VITE_APPLE_REDIRECT_URI` — optional; defaults to `window.location.origin` (typically `https://irlobby.com`).

cPanel deploys by copying the prebuilt `apps/web/dist` tree (see `.cpanel.yml`). After pushing `main`, use cPanel → Git Version Control → **Update from Remote** → **Deploy HEAD Commit**.

Use `VITE_LOG_CONFIG=true` only while diagnosing startup config. Do not leave noisy config logging enabled for normal production builds.

## Mobile release notes

Mobile production builds are coordinated through EAS and GitHub Actions.

- [App Store release flow](../apps/mobile/APP_STORE_RELEASE.md)
- [Launch checklist](../LAUNCH_CHECKLIST.md)
- [Play Store launch checklist](../PLAY_STORE_LAUNCH.md)
- [Screenshot capture guide](../apps/mobile/store/screenshots/README.md)

The `mobile-eas-build.yml` workflow needs the required Expo and store credentials configured as repository secrets or variables before it can submit non-interactively.

## Secret safety

Install the repository secret guard before working with deployment files:

```bash
bash scripts/install-secret-guard.sh
```

Keep real credentials in the deployment provider, GitHub Actions secrets, Expo/EAS secrets, or the production host's private environment. Committed docs should use placeholders only.

## Post-deploy checks

After a production deploy, verify:

- The backend health endpoint returns HTTP `200`.
- Web login, registration, password reset, discovery, matching, and chat boot without configuration errors.
- WebSocket traffic connects from the public web and mobile clients.
- Celery workers are running and can reach Redis.
- External Redis access is blocked.
- Email delivery works with the configured provider.
- Stripe webhooks are configured when ticketing is enabled.

## Related docs

- [Repository settings checklist](REPOSITORY_SETTINGS.md)
- [Brand tokens](BRAND_TOKENS.md)
- [Parity release gate](PARITY_RELEASE_GATE.md)
- [Web/mobile parity checklist](PARITY_WEB_VS_MOBILE_CHECKLIST.md)