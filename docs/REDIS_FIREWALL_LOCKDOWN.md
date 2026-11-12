# Redis TCP 6379 lockdown (firewall only)

Close public Redis on the Hetzner IRLobby VPS `5.75.156.23:6379`.

**This runbook is firewall-only.** Do not rotate `REDIS_PASSWORD`. Do not recreate `redis` / `web` / `ws` / `celery`. Do not change DNS. Do not change the `api.irlobby.com` TLS certificate. Keep `https://api.irlobby.com/api/health/` on HTTP `200`.

HOLD rotate / `requirepass` / redeploy until GitHub Actions billing is fixed or Aaron provides SSH.

## Preferred P0: Hetzner Cloud Firewall (no SSH)

Hetzner Cloud Firewall is a stateful **whitelist**. When a firewall is attached to the server, inbound traffic is dropped unless a rule allows it. There is no separate "deny 6379" rule: omit TCP `6379`.

1. Open Hetzner Cloud Console for the project that owns public IP `5.75.156.23`.
2. Go to **Firewalls**. Create a firewall, or edit the firewall already attached to this VPS.
3. Inbound allow rules only:
   - TCP `22` (SSH)
   - TCP `80` (HTTP)
   - TCP `443` (HTTPS)
   - ICMP is optional
4. Do **not** add inbound TCP `6379`.
5. If any inbound rule already allows `6379`, delete that rule.
6. Attach the firewall to the IRLobby VPS (`5.75.156.23`).
7. Leave outbound rules unchanged.
8. Confirm `https://api.irlobby.com/api/health/` returns HTTP `200`.
9. Webmaster: from an external network, Redis `PING` / `nc -vz 5.75.156.23 6379` must fail, refuse, or time out.

Do not change `irlobby.com` or `api.irlobby.com` DNS records.

## Optional host-side deny (only if SSH / GHA works)

Repo Compose already uses `expose: "6379"` (not published host ports) in `irlobby_backend/docker-compose.oracle.yml`. If the host still listens on `0.0.0.0:6379`, apply the existing containment script. It only adds UFW / iptables drops.

GitHub Action: **Redis Firewall Deny** (`.github/workflows/redis-lockdown.yml`). Manual `workflow_dispatch` only. It copies and runs `irlobby_backend/deploy/oracle/contain-redis-exposure.sh`. It does not rotate secrets and does not recreate app containers.

Manual equivalent on the VPS:

```bash
sudo bash deploy/oracle/contain-redis-exposure.sh 5.75.156.23
```

The script prints Docker port mappings and TCP `6379` listeners. Webmaster still checks the external `PING`.

## Out of scope (HOLD)

- `REDIS_PASSWORD` rotation and `REDIS_URL` rewrite
- `docker compose` recreate of `redis`, `web`, `ws`, or Celery
- DNS changes
- App Store changes
- Marketing / apex TLS changes
