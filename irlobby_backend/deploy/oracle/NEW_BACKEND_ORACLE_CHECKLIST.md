# New Oracle Backend Checklist

Use this checklist when provisioning a brand new IRLobby backend on Oracle Cloud.

## 1. Oracle Cloud Setup

- Create Ubuntu 22.04 VM on `VM.Standard.A1.Flex`.
- Reserve static public IP.
- Open inbound TCP ports `22`, `80`, `443` in NSG/Security List.
- Point your API domain `A` record to the VM public IP.

## 2. VM Bootstrap

- SSH into VM.
- Clone repo.
- Run:

```bash
cd IRLobby/irlobby_backend
sudo bash deploy/oracle/setup-oracle-vm.sh
```

Alternative: use `deploy/oracle/bootstrap-user-data.sh` as your Oracle instance user-data script to automate first-boot bootstrap.

## 3. Local Safety Guard (Before Any Commits)

Run this on your local clone:

```bash
cd IRLobby
bash scripts/install-secret-guard.sh
```

This enables a pre-commit check that blocks common secret leaks.

## 4. Production Environment File

- On the VM:

```bash
cd IRLobby/irlobby_backend
cp .env.oracle.example .env.production
nano .env.production
```

- If you are deploying by raw server IP first (no domain/cert yet), set:

```bash
SERVER_NAME=5.75.156.23
NGINX_TEMPLATE_PATH=./deploy/oracle/nginx/http-only.conf.template
PUBLIC_SCHEME=http
```

- After DNS and certs are ready, switch back to TLS mode:

```bash
NGINX_TEMPLATE_PATH=./deploy/oracle/nginx/default.conf.template
PUBLIC_SCHEME=https
```

- Generate secure values:

```bash
bash deploy/oracle/generate-secrets.sh --write
chmod 600 .env.production
```

- Fill all required values for your domain, database, CORS/CSRF, email, and third-party integrations.

## 5. HTTPS Certificate

Run on VM host:

```bash
sudo certbot certonly --standalone -d api.yourdomain.com -m you@yourdomain.com --agree-tos --no-eff-email
sudo certbot renew --dry-run
```

Skip this section only if you intentionally run temporary HTTP-only mode during initial bring-up.

## 6. Deploy

```bash
cd IRLobby/irlobby_backend
bash deploy/oracle/deploy.sh
```

## 7. Validate

```bash
curl -I https://api.yourdomain.com/api/health/
docker compose -f docker-compose.oracle.yml --env-file .env.production ps
docker compose -f docker-compose.oracle.yml --env-file .env.production logs -f web
```

## 8. Post-Deploy Tasks

- Set mobile/web API and websocket base URLs to your new domain.
- Configure daily backup cron:

```bash
(crontab -l 2>/dev/null; echo "20 3 * * * cd $(pwd) && bash deploy/oracle/backup.sh >/tmp/irlobby-backup.log 2>&1") | crontab -
```

- Save secrets in your secret manager and rotate any temporary/bootstrap values.

## 9. Secret Safety Rules

- Never commit `.env`, `.env.production`, API keys, DB passwords, or private keys.
- Use `.env.example` files for placeholders only.
- If a secret is ever committed, rotate it immediately and purge it from git history.