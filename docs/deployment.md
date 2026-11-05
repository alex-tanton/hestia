# Deployment & Operations Guide

## Overview

Hestia runs on a single Linux server managed via Docker Compose (`docker/docker-compose.yml`). External traffic reaches the application exclusively through a Cloudflare Zero Trust Tunnel:
- Cloudflare edge terminates TLS for `https://hestia.aberrance.app`.
- The `cloudflared` container tunnels traffic securely to `caddy:8080`.
- No host ports are published; internal communication is isolated within the `hestia` Docker network.
- Automated deploys run via a self-hosted GitHub Actions runner executing `scripts/deploy.sh`.

---

## Compose Services

| Service | Image | Role |
| --- | --- | --- |
| `db` | `public.ecr.aws/supabase/postgres:17.6.1.167` | Primary PostgreSQL database with Supabase extensions. |
| `auth` | `public.ecr.aws/supabase/gotrue:v2.196.0` | GoTrue authentication service (magic links, passwords, sessions). |
| `realtime` | `public.ecr.aws/supabase/realtime:v2.130.0` | Realtime WebSocket sync server. |
| `kong` | `kong/kong:3.9.3` | Minimal API gateway routing `/auth/v1/*` and `/realtime/v1/*`. |
| `hestia-service` | `hestia-service:<sha>` | Fastify API backend and background cron scheduler. |
| `caddy` | `hestia-caddy:<sha>` | Reverse proxy and static PWA file server. |
| `cloudflared` | `cloudflare/cloudflared:2026.10.3` | Outbound Cloudflare Tunnel connector. |
| `backup` | `prodrigestivill/postgres-backup-local:17-debian-d257e5d` | Nightly automated `pg_dump` backups to secondary physical storage. |

---

## Host Requirements & Dependencies

### Hardware Requirements
- **CPU:** 2 cores minimum (4 cores recommended).
- **RAM:** 8 GB minimum (16 GB recommended).
- **Storage:** 60 GB SSD root disk, plus a dedicated **second physical disk** mounted for backups (e.g., `/mnt/backup/hestia`).
- **OS:** Ubuntu Server LTS (or any Docker-supported Linux distribution).

### Software Dependencies
- **Docker Engine & Compose Plugin** (`docker compose` v2).
- **Supabase CLI 2.117.0** (required for running database migrations during deploys).
- **Node.js 24 & git**.
- **Cloudflare Account:** Zero Trust enabled with active domain zone `aberrance.app`. Outbound TCP/UDP access on port 7844.
- **GitHub Actions Runner:** Registered to repository with labels `[self-hosted, hestia]` in the `docker` user group.

---

## Pinned Identifiers

> [!IMPORTANT]
> The origin `https://hestia.aberrance.app` is permanently baked into PWA installations, service workers, push subscriptions, and auth tokens. Never change this origin.

| Parameter | Value |
| --- | --- |
| Hostname | `hestia` |
| Domain Zone | `aberrance.app` |
| Public Origin | `https://hestia.aberrance.app` |

---

## Environment Variables (`/srv/hestia/.env`)

Production settings reside outside the repository at `/srv/hestia/.env`.

| Variable | Description | Source |
| --- | --- | --- |
| `HESTIA_ORIGIN` | Pinned public origin (`https://hestia.aberrance.app`) | Configured |
| `CLOUDFLARE_TUNNEL_TOKEN` | Tunnel authentication token from Cloudflare dashboard | Configured |
| `HESTIA_OWNER_EMAIL` | Admin email address granting access to deep system health | Configured |
| `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` | Toggles passwordless magic link authentication (`true`/`false`) | Configured |
| `GOTRUE_SMTP_HOST` | SMTP server host (`smtp.resend.com`) | Configured |
| `GOTRUE_SMTP_PORT` | SMTP port (`465` for implicit TLS) | Configured |
| `GOTRUE_SMTP_USER` | SMTP username (`resend`) | Configured |
| `GOTRUE_SMTP_PASS` | SMTP API key / password | Configured |
| `GOTRUE_SMTP_ADMIN_EMAIL` | Sender address (`auth@aberrance.app`) | Configured |
| `GOTRUE_SMTP_SENDER_NAME` | Sender display name (`Hestia`) | Configured |
| `BACKUP_DIR` | Backup storage path on secondary physical disk | Configured |
| `HESTIA_RATE_LIMIT_PER_MINUTE` | Optional per-IP rate limit on `/api/*` (default: 300) | Optional |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | `generate-secrets.sh` |
| `HESTIA_SERVICE_DB_PASSWORD` | Password for `hestia_service` database login role | `generate-secrets.sh` |
| `JWT_SECRET` | HS256 secret for signing auth tokens | `generate-secrets.sh` |
| `HESTIA_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for GoTrue / Kong / Web | `generate-secrets.sh` |
| `SERVICE_ROLE_KEY` | Privileged admin key for internal system calls | `generate-secrets.sh` |
| `REALTIME_SECRET_KEY_BASE` | Cookie secret for Realtime | `generate-secrets.sh` |
| `REALTIME_DB_ENC_KEY` | 16-character encryption key for Realtime | `generate-secrets.sh` |
| `HESTIA_PUBLIC_VAPID_KEY` | RFC 8292 Web Push public key (base64url P-256) | `generate-secrets.sh` |
| `VAPID_PRIVATE_KEY` | RFC 8292 Web Push private key (base64url P-256) | `generate-secrets.sh` |
| `VAPID_SUBJECT` | Contact URI sent with push payloads (`mailto:...`) | Configured |

---

## First-Time Setup

1. **Configure Cloudflare Tunnel:**
   - In Cloudflare Zero Trust → Networks → Tunnels, create a tunnel named `hestia`.
   - Copy the tunnel token.
   - Add a Public Hostname route: `hestia.aberrance.app` → Service `HTTP` → `caddy:8080`.

2. **Initialize Host Environment:**
   ```bash
   sudo install -d -m 700 -o "$USER" /srv/hestia
   sudo install -d -m 755 /mnt/backup/hestia

   # Generate secrets and create /srv/hestia/.env
   HESTIA_OWNER_EMAIL="owner@example.com" \
   BACKUP_DIR="/mnt/backup/hestia" \
   scripts/generate-secrets.sh

   # Edit /srv/hestia/.env to insert CLOUDFLARE_TUNNEL_TOKEN and GOTRUE_SMTP_PASS
   nano /srv/hestia/.env
   ```

3. **Build & Start Services:**
   ```bash
   alias hestia-compose='docker compose --env-file /srv/hestia/.env -f docker/docker-compose.yml'

   hestia-compose build
   hestia-compose up -d --wait
   hestia-compose exec -T caddy wget -q -O - http://127.0.0.1:8080/api/health
   ```

---

## Deployment Pipeline

Pushing to `main` with a passing CI build triggers `.github/workflows/deploy.yml` on the self-hosted runner, executing `scripts/deploy.sh`:

1. **Deploy Gate:** Evaluates whether files outside `docs/` and `.planning/` changed since the active image SHA (`scripts/deploy-gate.sh`).
2. **Build:** Compiles `hestia-service:<sha>` and `hestia-caddy:<sha>` (PWA assets baked into Caddy).
3. **Container Preparation:** Ensures all infrastructure containers (`db`, `auth`, `realtime`, `kong`, `backup`, `cloudflared`) and networks are healthy.
4. **Pre-Deploy Backup:** Executes a full database dump via the `backup` container. A backup failure terminates the deploy immediately.
5. **Database Migration:** Applies pending SQL migrations via `supabase migration up`.
6. **Role Synchronization:** Idempotently refreshes `hestia_service` credentials.
7. **Service Re-creation:** Recreates `hestia-service` and `caddy` with the new image tags.
8. **Health Gate & Rollback:** Polls `http://caddy:8080/api/health` for 60 seconds. If the health check fails, the deploy automatically rolls back to the previous image tags.

### Manual Rollback
```bash
docker tag hestia-service:<sha> hestia-service:current
docker tag hestia-caddy:<sha> hestia-caddy:current
hestia-compose up -d --no-deps hestia-service caddy
```

---

## Backups & Disaster Recovery

### Automated Backup Schedule
The `backup` container executes `pg_dump` nightly at 02:00 UTC into `$BACKUP_DIR`. Backups are compressed with gzip and retained across rotations:
- 14 daily dumps
- 8 weekly dumps
- 6 monthly dumps

Trigger an immediate backup manually:
```bash
hestia-compose exec -T backup /backup.sh
```

### Quarterly Restore Verification Test
Restores the latest backup into a temporary test container to verify dump integrity without affecting production:

```bash
set -a; . /srv/hestia/.env; set +a
DUMP="$BACKUP_DIR/last/postgres-latest.sql.gz"

docker run --detach --name hestia-restore -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  public.ecr.aws/supabase/postgres:17.6.1.167 \
  postgres -c config_file=/etc/postgresql/postgresql.conf

until docker exec hestia-restore pg_isready -U postgres -h localhost -q; do sleep 1; done

# Apply roles missing from pg_dump
docker exec -i hestia-restore psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  < supabase/migrations/20260919060000_hestia_service_role.sql
docker exec -i hestia-restore psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create role supabase_realtime_admin noinherit nologin noreplication;
grant anon, authenticated, service_role to supabase_realtime_admin;
SQL

# Restore dump and verify 0 errors
gunzip -c "$DUMP" | docker exec -i hestia-restore psql -U supabase_admin -d postgres -q 2> restore.log
grep -c ERROR restore.log    # Must be 0

docker rm -f hestia-restore && rm restore.log
```

### Production Restore Procedure
To restore production from a backup archive:

```bash
set -a; . /srv/hestia/.env; set +a
DUMP="$BACKUP_DIR/daily/postgres-<date>.sql.gz"

hestia-compose stop
hestia-compose rm --force db
docker volume rm hestia_db-data

hestia-compose up -d --wait db
hestia-compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create role supabase_realtime_admin noinherit nologin noreplication;
grant anon, authenticated, service_role to supabase_realtime_admin;
SQL

gunzip -c "$DUMP" | hestia-compose exec -T db psql -U supabase_admin -d postgres -q 2> restore.log
grep -c ERROR restore.log    # Must be 0

hestia-compose up -d --wait
rm restore.log
```

---

## Transactional Email & DNS Setup

Configured for Resend with sender `Hestia <auth@aberrance.app>`:

### Cloudflare DNS Records
| Type | Name | Content / Target |
| --- | --- | --- |
| `TXT` | `@` | `v=spf1 include:resend.com ~all` |
| `CNAME` | `resend._domainkey` | `resend._domainkey.resend.com.` |
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@aberrance.app; pct=100;` |
| `MX` | `bounces` | `feedback-smtp.resend.com` (Priority 10) |
| `TXT` | `bounces` | `v=spf1 include:resend.com ~all` |

After configuring `GOTRUE_SMTP_PASS` in `/srv/hestia/.env`, recreate the `auth` container:
```bash
hestia-compose up -d --wait auth
```

---

## Cloudflare Edge Policies

### Static Asset Caching
- **Rule:** Cache Hestia Static Assets
- **Expression:** `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/assets/")`
- **Cache Eligibility:** Eligible for cache; Edge & Browser TTL: Respect origin (`Cache-Control: immutable, max-age=31536000`).

### WAF Rate Limiting
- **Rule:** Protect Hestia Auth Endpoints
- **Expression:** `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/auth/v1/") and http.request.method eq "POST"`
- **Threshold:** 15 requests per 1 minute per IP.
- **Action:** Managed Challenge (Cloudflare Turnstile), 10-minute action duration.

---

## Mobile Web Push Verification

### Prerequisites
- **iOS Safari (16.4+):** Must be installed to Home Screen (`display: standalone`). Standard browser tabs do not support Web Push. User must explicitly grant permission via a touch gesture in **Settings → Notifications**.
- **Android Chrome:** Install as standalone PWA and allow notifications.

### Test Push Dispatch
To dispatch an immediate test notification to a registered user:
```bash
docker compose exec hestia-service hestia-admin test-push --email user@example.com
```

---

## Troubleshooting

- **Check Service Health:**
  ```bash
  hestia-compose exec -T caddy wget -q -O - http://127.0.0.1:8080/api/health
  ```
  Deep diagnostics (backup age, job status, error fingerprints) are visible to the owner at `GET /api/health/deep` or **Settings → About → System Health**.
- **Tunnel Unreachable:** Run `hestia-compose logs --tail 50 cloudflared`. Confirm tunnel token is valid and route points to `http://caddy:8080`.
- **Client IP Resolution:** If backend logs show internal Compose IPs (`172.16.238.x`), verify `HESTIA_TRUSTED_PROXIES` matches the Compose subnet.
- **Recreating Containers on Config Changes:** Updating bind mounts like `docker/kong.yml` requires explicit recreation:
  ```bash
  hestia-compose up -d --force-recreate kong
  ```
- **Forward-Only Migrations:** Rollbacks never alter database migrations. Rolling back a migration requires applying a compensatory forward migration or restoring from backup.
