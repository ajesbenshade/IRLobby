# Oracle Deployment (Always Free) for IRLobby Backend

This runbook deploys Django on an Oracle VM.

The stack uses Docker, Nginx, Gunicorn, Daphne, HTTPS, environment variables, and backup scripts.

The runbook supports two database modes:
- Managed PostgreSQL (`USE_LOCAL_POSTGRES=false`)
- PostgreSQL container on the same VM (`USE_LOCAL_POSTGRES=true`)

## 1) Oracle Infrastructure

1. Create an Oracle Cloud VM (Ubuntu 22.04) on shape `VM.Standard.A1.Flex`.
2. Reserve a public IP for the instance.
3. Open ingress rules on Security List or NSG for TCP `22`, `80`, and `443` only. Do not open Redis or TCP `6379`. Redis must stay private to Docker networking.
4. Point DNS `A` record (example: `your-domain.com`) to the VM public IP.

## 2) Prepare VM

SSH to the VM and run:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone <your-repo-url>
cd IRLobby/irlobby_backend
sudo bash deploy/oracle/setup-oracle-vm.sh
```

## 3) Configure env vars

```bash
cp .env.oracle.example .env.production
nano .env.production
```

Generate strong secrets with OpenSSL:

```bash
chmod +x deploy/oracle/generate-secrets.sh
bash deploy/oracle/generate-secrets.sh
```

To write generated `SECRET_KEY`, `POSTGRES_PASSWORD`, and `REDIS_PASSWORD` directly into `.env.production`:

```bash
bash deploy/oracle/generate-secrets.sh --write
```

Set these required values:
- `SERVER_NAME`
- `SECRET_KEY`
- `DATABASE_URL`
- `SWIPE_DAILY_LIMIT`
- `AXES_FAILURE_LIMIT`
- `AXES_COOLOFF_MINUTES`
- `REDIS_PASSWORD`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `CORS_ALLOWED_ORIGINS`
- `WEBSOCKET_ALLOWED_ORIGINS`
- `FRONTEND_BASE_URL`

Set these email values for password reset delivery:
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USE_TLS`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`

If web is hosted on cPanel or any custom domain, include your public web origin in:
- `CSRF_TRUSTED_ORIGINS` (for example: `https://your-domain.com`)
- `CORS_ALLOWED_ORIGINS` (same web origin)
- `WEBSOCKET_ALLOWED_ORIGINS` (same web origin; do not use localhost or Expo dev origins in prod)
- `FRONTEND_BASE_URL` (set to your primary web URL)

If you use local PostgreSQL on the VM (recommended for low-cost single-VM launch):
- Set `USE_LOCAL_POSTGRES=true`
- Set `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- Set `DATABASE_URL` like:

```bash
DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>
```

If you use managed PostgreSQL:
- Keep `USE_LOCAL_POSTGRES=false`
- Set `DATABASE_URL` to your managed DB URL (often with `?sslmode=require`)
- For launch, use a provider pooler URL when you use Neon or Supabase. Neon pooled hosts include `-pooler`. Supabase pooler hosts usually use port `6543`. This gives Django and Celery safer connection behavior without adding PgBouncer to the VM.
- Keep `conn_max_age` managed by Django. Do not add PgBouncer to the VM unless provider pooling is not available or production metrics show connection pressure.

Redis is provided by the Docker Compose `redis` service. Leave `REDIS_URL`, `CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND` empty unless you intentionally use an external Redis service. Compose derives authenticated internal URLs from `REDIS_PASSWORD`.

Launch abuse-prevention defaults:
- `SWIPE_THROTTLE_RATE=120/hour` controls burst swipe behavior.
- `SWIPE_DAILY_LIMIT=500` caps successful swipes per user until midnight UTC.
- `REVIEW_CREATE_THROTTLE_RATE=30/hour` applies to review creation only.
- `AXES_FAILURE_LIMIT=5` and `AXES_COOLOFF_MINUTES=30` lock repeated failed password logins by account and client IP.

Optional Sentry settings:
- Set `SENTRY_DSN` only after you create the production project in Sentry.
- Start with `SENTRY_TRACES_SAMPLE_RATE=0.1` for launch visibility.
- Keep `SENTRY_PROFILES_SAMPLE_RATE=0.0` at launch unless profiling is explicitly needed. Raise it temporarily during performance investigations.
- Set `SENTRY_ENVIRONMENT=production` on the VM.

## 4) Issue HTTPS certificate

On the VM host:

```bash
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com -m you@your-domain.com --agree-tos --no-eff-email
```

For `irlobby.com` / `www.irlobby.com` on the existing Hetzner box (nginx already bound to port 80), do **not** use `--standalone` and do **not** replace the `api.irlobby.com` certificate. Use host webroot `/var/www/certbot` as documented in [docs/DEPLOYMENT.md](../../../docs/DEPLOYMENT.md).

Test renewal:

```bash
sudo certbot renew --dry-run
```

## 5) Deploy stack

```bash
chmod +x deploy/oracle/*.sh
bash deploy/oracle/deploy.sh
```

The deploy script starts these services:
- `postgres` (when `USE_LOCAL_POSTGRES=true`)
- `redis` (private Docker-network service; no public `6379` listener)
- `web` (Gunicorn on 8000)
- `ws` (Daphne on 8001)
- `nginx` (TLS reverse proxy on 443)

## 6) Verify

```bash
curl -I https://your-domain.com/api/health/
docker compose -f docker-compose.oracle.yml --env-file .env.production ps
docker compose -f docker-compose.oracle.yml --env-file .env.production logs -f web
docker compose -f docker-compose.oracle.yml --env-file .env.production exec redis sh -lc 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
```

If local PostgreSQL is enabled:

```bash
docker compose -f docker-compose.oracle.yml --env-file .env.production --profile localdb logs -f postgres
```

Expected health endpoint response: HTTP `200`. Expected Redis ping response: `PONG`.

The deploy script also runs a local Redis privacy check. The check verifies that the Compose Redis service is not published on the host. The check verifies that TCP `6379` is not listening on a non-loopback host address. Run the check manually with:

```bash
bash deploy/oracle/verify-redis-private.sh docker-compose.oracle.yml .env.production your-domain.com
```

From outside the VM, verify Redis is not reachable:

```bash
nc -vz your-domain.com 6379
```

The command must fail, refuse, or time out. If it succeeds, close TCP `6379` in the cloud firewall or security list and on the host before you continue.

For emergency host-side containment when TCP `6379` is already reachable publicly, first close the provider firewall rule. Then SSH to the host and run:

```bash
sudo bash deploy/oracle/contain-redis-exposure.sh your-domain.com
```

This script removes common UFW allow rules. It adds host and Docker ingress drops for Redis on the default public interface. It prints the remaining listeners and Docker port mappings. This is a containment step, not the full fix. Rotate `REDIS_PASSWORD`, remove the underlying public listener or published port, and redeploy afterward.

To make the script perform the same network check, run it from a machine outside the VM or from a network path that does not bypass the provider firewall:

```bash
VERIFY_EXTERNAL_REDIS=true bash deploy/oracle/verify-redis-private.sh docker-compose.oracle.yml .env.production your-domain.com
```

## 7) Mobile and Web client updates

- Mobile `EXPO_PUBLIC_API_BASE_URL`: `https://your-domain.com`
- Mobile `EXPO_PUBLIC_WEBSOCKET_URL`: `wss://your-domain.com`
- Web static hosting without a proxy `VITE_API_BASE_URL`: `https://your-domain.com`
- Web `VITE_WEBSOCKET_BASE_URL`: `wss://your-domain.com`
- Web same-origin or rewrite hosting: leave `VITE_API_BASE_URL` empty only when `/api/*` is guaranteed to proxy to this backend. The web app will use relative `/api` requests instead of failing at startup.
- Set `VITE_LOG_CONFIG=true` temporarily if you need the web app to print non-secret config diagnostics during startup.

## 8) Backups

Run manual backup:

```bash
bash deploy/oracle/backup.sh
```

Add daily cron at 03:20:

```bash
(crontab -l 2>/dev/null; echo "20 3 * * * cd $(pwd) && bash deploy/oracle/backup.sh >/tmp/irlobby-backup.log 2>&1") | crontab -
```

## 9) Update and rollback

Update:

```bash
git pull
bash deploy/oracle/deploy.sh
```

Rollback to prior commit:

```bash
git checkout <previous-commit-sha>
bash deploy/oracle/deploy.sh
```

## 10) Migrate database to Neon

This procedure moves existing PostgreSQL data to Neon. Then it switches app runtime to Neon.

1) In `.env.production`, add:

```bash
NEON_DATABASE_URL=postgresql://<user>:<password>@<your-neon-host>/neondb?sslmode=require&channel_binding=require
```

2) Run migration script:

```bash
chmod +x deploy/oracle/migrate-to-neon.sh
bash deploy/oracle/migrate-to-neon.sh
```

3) Cut over runtime settings in `.env.production`:

```bash
USE_LOCAL_POSTGRES=false
DATABASE_URL=<same Neon URL as above>
```

4) Redeploy and verify:

```bash
bash deploy/oracle/deploy.sh
curl -I https://your-domain.com/api/health/
```
