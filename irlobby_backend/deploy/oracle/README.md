# Oracle Deployment (Always Free) for IRLobby Backend

This runbook deploys Django on an Oracle VM with Docker, Nginx, Gunicorn, Daphne, HTTPS, env vars, and backup scripts.

It supports two database modes:
- Managed PostgreSQL (`USE_LOCAL_POSTGRES=false`)
- PostgreSQL container on the same VM (`USE_LOCAL_POSTGRES=true`)

## 1) Oracle Infrastructure

1. Create an Oracle Cloud VM (Ubuntu 22.04) on shape `VM.Standard.A1.Flex`.
2. Reserve a public IP for the instance.
3. Open ingress rules on Security List / NSG for TCP `22`, `80`, and `443`.
4. Point DNS `A` record (example: `liyf.app`) to the VM public IP.

## 2) Prepare VM

SSH to VM and run:

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

To write generated `SECRET_KEY` and `POSTGRES_PASSWORD` directly into `.env.production`:

```bash
bash deploy/oracle/generate-secrets.sh --write
```

Required values to set:
- `SERVER_NAME`
- `SECRET_KEY`
- `DATABASE_URL`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `CORS_ALLOWED_ORIGINS`

If using local PostgreSQL on the VM (recommended for low-cost single-VM launch):
- Set `USE_LOCAL_POSTGRES=true`
- Set `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- Set `DATABASE_URL` like:

```bash
DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>
```

If using managed PostgreSQL:
- Keep `USE_LOCAL_POSTGRES=false`
- Set `DATABASE_URL` to your managed DB URL (often with `?sslmode=require`)

## 4) Issue HTTPS certificate

On the VM host:

```bash
sudo certbot certonly --standalone -d liyf.app -d www.liyf.app -m you@liyf.app --agree-tos --no-eff-email
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

## 5) Deploy stack

```bash
chmod +x deploy/oracle/*.sh
bash deploy/oracle/deploy.sh
```

Services started:
- `postgres` (when `USE_LOCAL_POSTGRES=true`)
- `web` (Gunicorn on 8000)
- `ws` (Daphne on 8001)
- `nginx` (TLS reverse proxy on 443)

## 6) Verify

```bash
curl -I https://liyf.app/api/health/
docker compose -f docker-compose.oracle.yml --env-file .env.production ps
docker compose -f docker-compose.oracle.yml --env-file .env.production logs -f web
```

If local PostgreSQL is enabled:

```bash
docker compose -f docker-compose.oracle.yml --env-file .env.production --profile localdb logs -f postgres
```

Expected health endpoint response: HTTP `200`.

## 7) Mobile/Web client updates

- Mobile `EXPO_PUBLIC_API_BASE_URL`: `https://liyf.app`
- Mobile `EXPO_PUBLIC_WEBSOCKET_URL`: `wss://liyf.app`
- Web `VITE_API_BASE_URL`: `https://liyf.app`

## 8) Backups

Run manual backup:

```bash
bash deploy/oracle/backup.sh
```

Add daily cron at 03:20:

```bash
(crontab -l 2>/dev/null; echo "20 3 * * * cd $(pwd) && bash deploy/oracle/backup.sh >/tmp/irlobby-backup.log 2>&1") | crontab -
```

## 9) Update / rollback

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

This moves existing PostgreSQL data to Neon, then switches app runtime to Neon.

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
curl -I https://liyf.app/api/health/
```
