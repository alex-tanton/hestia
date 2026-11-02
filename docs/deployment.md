# Deploying Hestia

## Overview

Production is one Linux box running the stack defined in `docker/docker-compose.yml` under Docker
Compose. The box is reached over the internet only through a remotely-managed Cloudflare Tunnel.
Cloudflare's edge terminates TLS for `https://hestia.aberrance.app`; the `cloudflared` container
dials out to Cloudflare and forwards plain HTTP to `caddy:8080` over the `hestia` network. No
container publishes a host port and the router forwards none. Caddy serves the built PWA directly
and reverse-proxies `/api/*` to the Hestia service and `/auth/v1/*` / `/realtime/v1/*` to Kong,
which fronts GoTrue (auth) and Realtime. A nightly backup container dumps Postgres to a second
physical disk. Deploys are triggered by a passing CI run on `main` and run on a self-hosted GitHub
Actions runner on the same box.

TLS ends at Cloudflare's edge, so Cloudflare sees requests in clear text. That is the trade-off of
a Cloudflare-fronted design; the leg from the edge to the box is the encrypted tunnel.

## Compose services

`docker/docker-compose.yml` defines eight services. The two built images, `hestia-service` and
`hestia-caddy`, are tagged `<sha>` by each deploy and run through their `current` tags.

| Service | Image | Role |
| --- | --- | --- |
| `db` | `public.ecr.aws/supabase/postgres:17.6.1.167` | The Postgres database. |
| `auth` | `public.ecr.aws/supabase/gotrue:v2.196.0` | GoTrue, handling sign-in and account management. |
| `realtime` | `public.ecr.aws/supabase/realtime:v2.130.0` | Pushes live updates to connected clients. |
| `kong` | `kong/kong:3.9.3` | The gateway that routes external requests to `auth` and `realtime` only; nothing else is exposed through it. |
| `hestia-service` | `hestia-service:<sha>` | The backend API and background jobs (built from `apps/service`). |
| `caddy` | `hestia-caddy:<sha>` | The reverse proxy that the PWA is served through and that forwards API and auth traffic to the right internal service. It also builds in the PWA itself as static files. |
| `cloudflared` | `cloudflare/cloudflared:2026.10.3` | The tunnel connector: carries public traffic from Cloudflare to `caddy:8080`. |
| `backup` | `prodrigestivill/postgres-backup-local:17-debian-d257e5d` | Runs the nightly database backup and keeps a rotation of older backups. |

No service publishes a host port; operator checks use `hestia-compose exec` (the alias is defined in
"First-time setup"). All services share the `hestia` network, and Postgres data lives in the
`db-data` and `db-config` volumes.

## System requirements

- **OS:** Ubuntu Server LTS is assumed; any Docker-capable Linux distribution works.
- **Hardware:** a repurposed desktop or laptop is the target:

  | Resource | Minimum | Comfortable |
  | --- | --- | --- |
  | CPU | 2 cores | 4 cores |
  | RAM | 8 GB | 16 GB |
  | Disk | 60 GB SSD, plus a second local disk for backups | 120 GB SSD, plus a second local disk for backups |

  If it's a laptop, disable sleep-on-lid-close and, where practical, leave it plugged in — its
  battery serves as a UPS.
- **Second physical disk:** required, for backups. `BACKUP_DIR` must point at a directory on it
  (for example `/mnt/backup/hestia`), separate from the disk holding the Docker data root and the
  Postgres volume. This is the only copy of the data: there is no off-site or cloud backup copy.

## Dependencies

Install on the host before first start:

- **Docker Engine with the Compose plugin** (`docker compose`, not the standalone `docker-compose`).
- **The Supabase CLI, version 2.117.0** — the exact version CI uses (`supabase/setup-cli@v3` pins
  it in `.github/workflows/ci.yml`) — needed to apply migrations during deploys.
- **Node 24** (the version pinned in `.nvmrc`) and **git**.
- **Cloudflare:** an account with the `aberrance.app` zone active and Zero Trust enabled, which is
  where the tunnel and its route live. The host needs outbound TCP and UDP to Cloudflare on port 7844;
  nothing inbound.
- **For automatic deploys:** a GitHub Actions **self-hosted runner** registered to this
  repository, labeled `self-hosted` and `hestia` (the deploy workflow targets
  `runs-on: [self-hosted, hestia]`), running as a user in the **`docker` group**. This runner must
  run only `.github/workflows/deploy.yml` — never pull-request jobs, since those would execute
  untrusted code on the production box.

## Pinned names

> **The hostname `hestia` in the zone `aberrance.app` is pinned and must never change.** The
> origin `https://hestia.aberrance.app` is baked into every installed PWA, its service worker
> registration, every push subscription and GoTrue's URLs. Moving to another hostname or zone
> strands installed apps, orphans service workers, and invalidates every push subscription — there
> is no migration path for an origin change.

`HESTIA_ORIGIN` in `/srv/hestia/.env` must equal the origin below. Keep the two in sync.

| Name     | Value                         |
| -------- | ----------------------------- |
| Hostname | `hestia`                      |
| Zone     | `aberrance.app`               |
| Origin   | `https://hestia.aberrance.app` |

## Dependencies the stack provides for itself

Three services exist purely to route and protect traffic, configured by files in `docker/`:

- **cloudflared** is the tunnel connector. It is remotely managed: the route lives in the
  Cloudflare dashboard and the repository holds no credentials or tunnel configuration. It reads
  its token from `CLOUDFLARE_TUNNEL_TOKEN` through the environment, never from a command line. The
  image is pinned (`cloudflare/cloudflared:2026.10.3`), runs as a non-root user, and is
  health-checked with `cloudflared tunnel ready` against metrics served on loopback only. It is
  never started in E2E.
- **Caddy** (`docker/Caddyfile`) receives plain HTTP from cloudflared on `caddy:8080` and publishes
  no port. It takes the client address only from `CF-Connecting-IP`, and only when the connection
  comes from the Compose subnet (`HESTIA_TRUSTED_PROXIES`, which `docker/caddy-entrypoint.sh`
  refuses to leave empty). It never reads a client's `X-Forwarded-For` and passes exactly one
  address downstream. It applies security headers (CSP, HSTS, etc.) to every response, with a CSP
  whose `connect-src` names the origin's host for WebSockets, serves the built PWA with SPA
  fallback, reverse-proxies `/api/*` to `hestia-service` and `/auth/v1/*` / `/realtime/v1/*` to
  Kong, and refuses direct `POST /auth/v1/signup*` and `PUT /auth/v1/user*` calls with a 403 so
  those paths can only be reached through `hestia-service`.
- **Kong** (`docker/kong.yml`, started by `docker/kong-entrypoint.sh`) is a minimal declarative API
  gateway in front of GoTrue and Realtime only — there are deliberately no `rest`, `storage`,
  `functions`, or `analytics` routes. It key-authenticates callers as `anon` or `service_role` and
  only allows those two groups through. GoTrue is an allowlist: Kong routes only the calls the PWA
  makes for sign-in, token refresh, sign-out and the session check (the routes `auth-v1-token`,
  `auth-v1-logout` and `auth-v1-user`), the magic-link `auth-v1-otp`, the email-link
  `auth-v1-verify` (no key, because the link opens in a browser), and `auth-v1-admin-users` for the
  service-role key only (the E2E seed). Everything else under `/auth/v1` (signup, recover,
  settings, the rest of `admin`, and any other method on an allowed path) ends at the
  `auth-v1-denied` route, which refuses it with a 403 `Access is forbidden.`, whatever key is
  sent. Caddy's two refusals stay the first layer in front of it. Realtime has the WebSocket route
  `realtime-v1-ws` and the REST route `realtime-v1-rest` for the same two key groups; its
  `/api/tenants` and `/api/openapi` paths are refused with the same 403.

## Environment variables

Every variable in `.env.example`, in order. The first six are filled in by the owner (four of
them copied in by `generate-secrets.sh` when set in its own environment); everything below
"Generated by `scripts/generate-secrets.sh`" is generated automatically and should never be typed
by hand.

| Variable | Purpose |
| --- | --- |
| `HESTIA_ORIGIN` | The pinned public origin, `https://hestia.aberrance.app`. Baked into every installed PWA and push subscription; must never change. |
| `CLOUDFLARE_TUNNEL_TOKEN` | The tunnel token, read only by `cloudflared`. It cannot be generated: paste it into `/srv/hestia/.env` by editing the file, never on a command line. Compose refuses every command while it is empty. `generate-secrets.sh` copies it only when it is already in its environment, as E2E does. |
| `HESTIA_OWNER_EMAIL` | The server owner's sign-in email. Unlocks `GET /api/health/deep` (System health). |
| `HESTIA_MAGIC_LINK_ENABLED` | Whether magic-link sign-in is enabled. The Caddy image build turns this into `VITE_MAGIC_LINK_ENABLED` for the PWA. Defaults to `true`. |
| `GOTRUE_SMTP_HOST` | GoTrue SMTP host. Defaults to `smtp.resend.com`. |
| `GOTRUE_SMTP_PORT` | GoTrue SMTP port. Defaults to `465` (implicit TLS). |
| `GOTRUE_SMTP_USER` | GoTrue SMTP username. Defaults to `resend`. |
| `GOTRUE_SMTP_PASS` | GoTrue SMTP password (Resend API key). Empty default for dev/test; must be set in production `/srv/hestia/.env`. |
| `GOTRUE_SMTP_ADMIN_EMAIL` | Sender email address for auth emails. Defaults to `auth@aberrance.app`. |
| `GOTRUE_SMTP_SENDER_NAME` | Sender display name. Defaults to `Hestia`. |
| `BACKUP_DIR` | The backup directory on the second physical disk. Mounted read-write into the `backup` container and read-only into `hestia-service`. |
| `HESTIA_RATE_LIMIT_PER_MINUTE` | Optional. Per-IP requests per minute across `/api`. Commented out in `.env.example`; leave unset in production (default 300). |
| `POSTGRES_PASSWORD` | Postgres superuser password. Also used by GoTrue (`supabase_auth_admin`), Realtime, and the backup container. |
| `HESTIA_SERVICE_DB_PASSWORD` | Password for `hestia_service`, the login role the Hestia service connects to Postgres as. |
| `JWT_SECRET` | GoTrue's HS256 JWT signing secret. |
| `ANON_KEY` | The anon API key, signed with `JWT_SECRET`. Used as the `apikey` header on GoTrue/Kong calls. |
| `SERVICE_ROLE_KEY` | The service-role API key, signed with `JWT_SECRET`. Used only for sanctioned service-role operations. |
| `REALTIME_SECRET_KEY_BASE` | Realtime's cookie-signing secret. |
| `REALTIME_DB_ENC_KEY` | Realtime's 16-character tenant-credential encryption key. |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (P-256, base64url). |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key (P-256, base64url). |
| `VAPID_SUBJECT` | The contact URI sent in each push request's VAPID claims (RFC 8292). Strictly required; must be a valid mailto: or https: URI (e.g. mailto:admin@aberrance.app). |

## Cloudflare Tunnel

The tunnel and its route exist only in the Cloudflare dashboard. Do steps 1 to 3 once, before the
first deploy:

1. In Cloudflare Zero Trust, under Networks, Tunnels, create a cloudflared tunnel named `hestia`.
   Copy only the token from the install screen.
2. Paste it into `/srv/hestia/.env` as `CLOUDFLARE_TUNNEL_TOKEN=<token>` by editing the file. Do not
   put it on a command line, where it would reach shell history and the process list.
3. Add the route. The dashboard calls it a published application (older dashboards say public
   hostname): `hestia.aberrance.app` to the service `http://caddy:8080`. Point it at Caddy, never at
   a backend service: Caddy's refusals and its client-address rule only apply there. Check that the
   proxied DNS record for `hestia` exists; if the dashboard did not create it, add a proxied CNAME
   `hestia` to `<tunnel-id>.cfargotunnel.com`.
4. Deploy (see "First-time setup" and "Ongoing deploys").
5. Verify:
   - `hestia-compose ps cloudflared` shows healthy, and `hestia-compose logs --tail 50 cloudflared`
     shows registered connections.
   - `curl -fsS https://hestia.aberrance.app/api/health` from any machine succeeds.
   - The browser console shows no CSP violation, including while a list syncs between two devices
     (that is the WebSocket through the tunnel).
   - `hestia-compose logs hestia-service` shows the visitor's public address as `remoteAddress`,
     not a `172.16.238.x` address.

### Before you merge

Merging to `main` deploys. The token and the new `HESTIA_ORIGIN` must already be in
`/srv/hestia/.env`; without them the deploy stops at its first Compose call and nothing restarts.

### After an origin change

GoTrue reads its URLs only when it is recreated, and a deploy never recreates `auth`. After the
first deploy on a new origin, run `hestia-compose up -d --wait` once so `auth` takes it.

### Rotating the token

Refresh the token in the dashboard, edit `CLOUDFLARE_TUNNEL_TOKEN` in `/srv/hestia/.env`, then run
`hestia-compose up -d --wait cloudflared`.

## First-time setup

Run from a checkout of `main`, on the host, after steps 1 to 3 of "Cloudflare Tunnel". The real
`.env` lives outside the checkout, at `/srv/hestia/.env`, because the deploy runner wipes its
checkout on every run.

```sh
sudo install -d -m 700 -o "$USER" /srv/hestia
sudo install -d -m 755 /mnt/backup/hestia
HESTIA_OWNER_EMAIL=<owner email> BACKUP_DIR=/mnt/backup/hestia scripts/generate-secrets.sh
# Now edit /srv/hestia/.env and paste CLOUDFLARE_TUNNEL_TOKEN=<token> (Cloudflare Tunnel, step 2).

alias hestia-compose='docker compose --env-file /srv/hestia/.env -f docker/docker-compose.yml'
hestia-compose build
hestia-compose up -d --wait
hestia-compose exec -T caddy wget -q -O - http://127.0.0.1:8080/api/health
```

Notes:

- The origin is already `.env.example`'s value, so `generate-secrets.sh` needs only the owner email
  and the backup directory. It warns about each value still missing.
- `generate-secrets.sh` writes `/srv/hestia/.env` from `.env.example` with every secret generated,
  and **refuses to overwrite an existing `.env`** — regenerating secrets on a live install signs
  everyone out and breaks the database login.
- `scripts/deploy.sh` also works as the first start: it builds, starts the stack, and migrates in
  one step.
- All commands below assume the `hestia-compose` alias above, run from the repository root.

## Ongoing deploys

A merge to `main` whose CI passed triggers `scripts/deploy.sh` on the self-hosted runner
(`.github/workflows/deploy.yml`, which watches the `CI` workflow's `workflow_run` and re-checks
that it was a push to `main` before deploying). Its `changes` step runs `scripts/deploy-gate.sh`
against the revision label of the running `hestia-service:current` image, and the deploy runs only
when that gate says so: it **deploys when something outside `docs/` and `.planning/` changed**
since the running revision (the whole range, not only the tip commit, so a code change whose deploy
never ran still ships behind a later docs-only commit), **skips a commit already running** (a `CI`
push run on `main` starts a new Deploy run, at attempt 1, every time one of its attempts completes,
so re-running a job of a green run used to rebuild the commit already running; that is now skipped),
deploys when no labelled image is running, and **skips a commit older than the running one** (a
re-run of an old CI run never rolls production back). To deliberately redeploy the commit already running,
re-run the Deploy run from the Actions tab (which raises that run's own attempt number to 2 or later and
redeploys), or run `scripts/deploy.sh` by hand on the host from a checkout of the commit, with
`HESTIA_DEPLOY_SHA` set to it. The job checks out the full history the comparison needs and keeps
no token on the host. A deploy can also be run by hand from a checkout.

`scripts/deploy.sh` performs these steps, in order, aborting before anything is restarted if any
of the first few fail:

1. Records the images currently tagged `current` as the rollback target.
2. Builds `hestia-service:<sha>` and `hestia-caddy:<sha>` (the PWA is built into the Caddy image).
   A failed build changes nothing.
3. Prepares every container and the `hestia` network without starting or recreating any container
   (`up --no-start --no-recreate --no-build`, with the new tag). On a normal deploy this changes
   nothing. When the network's configuration has changed, Compose recreates the network here, which
   stops every container: the supporting services come back later in this step, and
   `hestia-service` and `caddy` come back at step 7 (see "The first deploy on the tunnel ingress"
   below). Then starts any supporting service (`db`, `auth`, `realtime`, `kong`, `backup`,
   `cloudflared`) that isn't already running, without recreating any that are. A bad tunnel token
   fails this step with nothing restarted.
4. Takes a backup with `hestia-compose exec -T backup /backup.sh`. **A failed backup aborts the
   deploy** — nothing is migrated or restarted.
5. Applies pending migrations with `supabase migration up` against the Compose database. The CLI
   gets the database password in `PGPASSWORD`, set for that one command and never on its command
   line. **A failed migration aborts the deploy**; the backup just taken is the restore point.
6. Re-applies the `hestia_service` login from `.env` (`docker/db/hestia-service-login.sql`) —
   idempotent, and picks up a rotated password.
7. Tags the new images `current` and recreates `hestia-service` and `caddy` on them.
8. Polls `GET /api/health` for 60 seconds, from inside the caddy container (no host port exists).
   If it never succeeds, the script tags the **previous** images `current` again, recreates both
   containers on them, and exits non-zero (automatic rollback).

Nothing is restarted before the backup and migrations succeed, with one exception: a changed
network, which step 3 recreates. Re-running a deploy of the same commit is harmless. The five
newest SHA-tagged images of each kind are kept.

A deploy never recreates `db`, `auth`, `realtime`, `kong`, `backup`, or `cloudflared`. After
changing their configuration or image tag, take a backup by hand and apply the change with
`hestia-compose up -d --wait`.

### The first deploy on the tunnel ingress

The tunnel ingress removed the network's pinned gateway, which changes the `hestia` network's
configuration, so the first deploy of it recreates the network. In the deploy log, step 3 prints
`Network hestia Removing`, `Network hestia Removed`, `Network hestia Creating` and
`Network hestia Created`. Recreating the network stops every container; the supporting services
restart in step 3 (before the backup), and `hestia-service` and `caddy` restart at step 7. The site
is down from the recreate until the health gate passes, about a minute. Later deploys print only
`Running` lines in the prepare step and stop nothing.

If the deploy stops after the recreate, `hestia-service` and `caddy` stay stopped until a deploy
succeeds:

- `the Supabase services, the backup or the tunnel are not healthy; nothing restarted`: read
  `hestia-compose logs --tail 50 cloudflared`, fix `/srv/hestia/.env` (usually the token), and
  re-run the Deploy run from the Actions tab.
- `could not prepare the containers and the hestia network`, or Compose reporting
  `has active endpoints` or `is not connected to the network`: the recreate was left half done.
  Run `hestia-compose down` (named volumes and the backup directory are kept; never add `-v`),
  then re-run the Deploy run.

Until that deploy has run, do not run a `hestia-compose up` that names only some services from a
checkout of the new code; it would leave the recreate half done.

Compose also does not recreate a running service when only a bind-mounted file changed, and
`docker/kong.yml` is bind-mounted. After merging a `docker/kong.yml` change, take a backup by hand
and run `hestia-compose up -d --force-recreate kong` on the host. Sign-ins can fail for a few
seconds while Kong restarts. To roll back a Kong change, revert it, let the deploy finish and run
the same command again.

## Manual rollback

To roll back by hand to an older build (beyond the deploy's own automatic rollback):

```sh
docker image ls 'hestia-*'
docker tag hestia-service:<sha> hestia-service:current
docker tag hestia-caddy:<sha> hestia-caddy:current
hestia-compose up -d --no-deps hestia-service caddy
```

Migrations are forward-only, so rolling back images never rolls back the schema.

## Backups

The `backup` container runs `pg_dump` nightly at 02:00 UTC into `BACKUP_DIR` on the second disk,
gzip-compressed, keeping 14 daily, 8 weekly, and 6 monthly dumps
(`$BACKUP_DIR/{last,daily,weekly,monthly}/postgres-*.sql.gz`, each with a `postgres-latest.sql.gz`
link alongside it). Every deploy takes one before migrating.

To take a backup right now:

```sh
hestia-compose exec -T backup /backup.sh
```

## Restore

There is no off-site or cloud backup copy, so a correct restore procedure is the whole safety net.

### Restore test (quarterly)

An untested backup is an assumption. The test restores the newest dump into a **throwaway**
container of the same pinned Postgres image, leaving production untouched:

1. Load `/srv/hestia/.env` and locate `$BACKUP_DIR/last/postgres-latest.sql.gz`.
2. Start a detached `public.ecr.aws/supabase/postgres:17.6.1.167` container named
   `hestia-restore`, and wait for its init process and for `pg_isready`.
3. Because `pg_dump` does not include roles: apply the `hestia_service` role migration
   (`supabase/migrations/20260919060000_hestia_service_role.sql`) and manually create
   `supabase_realtime_admin` (it's created by Realtime at runtime, not by the Postgres image).
4. Load the dump with `gunzip -c "$DUMP" | docker exec -i hestia-restore psql ...`, capturing
   errors to a log file, and confirm the error count is 0.
5. Sanity-check the restored state: `hestia_service`'s role attributes, that `auth`/`public`/
   `realtime`/`supabase_migrations` schemas exist, a user count, and the applied migration list.
6. Remove the throwaway container and the error log.

The full command sequence, run from the repository root:

```sh
set -a; . /srv/hestia/.env; set +a
DUMP="$BACKUP_DIR/last/postgres-latest.sql.gz"

docker run --detach --name hestia-restore -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  public.ecr.aws/supabase/postgres:17.6.1.167 \
  postgres -c config_file=/etc/postgresql/postgresql.conf
until docker logs hestia-restore 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec hestia-restore pg_isready -U postgres -h localhost -q; do sleep 1; done

# Roles are not in the dump: hestia_service comes from its migration, and
# supabase_realtime_admin (created by Realtime, not the image) is created here.
docker exec -i hestia-restore psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  < supabase/migrations/20260919060000_hestia_service_role.sql
docker exec -i hestia-restore psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create role supabase_realtime_admin noinherit nologin noreplication;
grant anon, authenticated, service_role to supabase_realtime_admin;
SQL

gunzip -c "$DUMP" |
  docker exec -i hestia-restore psql -U supabase_admin -d postgres -q -o /dev/null \
  2> restore-errors.log
grep -c ERROR restore-errors.log    # expect 0

docker exec hestia-restore psql -U supabase_admin -d postgres -c "
  select rolname, rolinherit, rolcanlogin from pg_roles where rolname = 'hestia_service';
  select nspname from pg_namespace
    where nspname in ('auth', 'public', 'realtime', 'supabase_migrations');
  select count(*) as users from auth.users;
  select version from supabase_migrations.schema_migrations order by version;"

docker rm -f hestia-restore && rm restore-errors.log
```

### Restore production

This replaces the **live** database with a dump; the site is down while it runs.

1. Load `/srv/hestia/.env` and choose the dump to restore (for example
   `$BACKUP_DIR/daily/postgres-<yyyymmdd>.sql.gz`).
2. `hestia-compose stop`, then `hestia-compose rm --force db`, then remove the `hestia_db-data`
   volume — this destroys the current database.
3. `hestia-compose up -d --wait db` to get a **fresh** database: the image creates the Supabase
   roles, and the init scripts recreate `hestia_service` from its migration and give it its login
   from `.env`.
4. Manually create `supabase_realtime_admin` again (same reason as the restore test), load the
   dump the same way, and confirm 0 errors.
5. `hestia-compose up -d --wait` to bring the rest of the stack up, then
   `hestia-compose exec -T caddy wget -q -O - http://127.0.0.1:8080/api/health` to confirm.

The full command sequence:

```sh
set -a; . /srv/hestia/.env; set +a
DUMP="$BACKUP_DIR/daily/postgres-<yyyymmdd>.sql.gz"    # the dump to restore

hestia-compose stop
hestia-compose rm --force db
docker volume rm hestia_db-data

# A fresh database: the image creates the Supabase roles, and the init scripts recreate
# hestia_service from its migration and give it its login from .env.
hestia-compose up -d --wait db
hestia-compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create role supabase_realtime_admin noinherit nologin noreplication;
grant anon, authenticated, service_role to supabase_realtime_admin;
SQL
gunzip -c "$DUMP" |
  hestia-compose exec -T db psql -U supabase_admin -d postgres -q -o /dev/null \
  2> restore-errors.log
grep -c ERROR restore-errors.log    # expect 0

hestia-compose up -d --wait
hestia-compose exec -T caddy wget -q -O - http://127.0.0.1:8080/api/health
```

Only `db` runs while the dump loads: GoTrue and Realtime keep their own migration state inside the
database, so they must find the restored state when they start — bringing them up early would let
them re-initialize against the wrong state.

## Transactional Email (SMTP & DNS)

Hestia uses passwordless magic link authentication and transactional emails delivered via Resend. GoTrue handles outbound SMTP (`smtp.resend.com:465`, implicit TLS) with sender `Hestia <auth@aberrance.app>`.

### Provider Configuration

- **Provider**: Resend
- **Host**: `smtp.resend.com`
- **Port**: `465` (SSL/TLS implicit)
- **User**: `resend`
- **Password**: Resend API key (`re_...`), configured in `/srv/hestia/.env` as `GOTRUE_SMTP_PASS`
- **From Address**: `auth@aberrance.app`
- **From Name**: `Hestia`

### Cloudflare DNS Configuration

To ensure optimal inbox deliverability and prevent spoofing, the following DNS records must be configured in Cloudflare for `aberrance.app`:

```dns
; 1. SPF (Sender Policy Framework)
TXT    @                  v=spf1 include:resend.com ~all

; 2. DKIM (DomainKeys Identified Mail)
CNAME  resend._domainkey  resend._domainkey.resend.com.

; 3. DMARC (Domain-based Message Authentication, Reporting, and Conformance)
TXT    _dmarc             v=DMARC1; p=quarantine; rua=mailto:dmarc@aberrance.app; pct=100;

; 4. Custom Return-Path (Bounce Handling)
MX     bounces            feedback-smtp.resend.com. (Priority 10)
TXT    bounces            v=spf1 include:resend.com ~all
```

### Applying SMTP Configuration (GoTrue Service Recreation)

Because `scripts/deploy.sh` only recreates application containers (`hestia-service` and `caddy`) and leaves supporting infrastructure services running by default, operators must recreate the `auth` container once after adding or updating `GOTRUE_SMTP_PASS` in `/srv/hestia/.env`:

```bash
hestia-compose up -d --wait
```

This picks up the new environment variables and restarts `auth` with the updated SMTP credentials.

### Production Smoke Verification

Verify end-to-end transactional email delivery:

1. **Verify DNS alignment**:
   ```bash
   dig +short TXT aberrance.app
   dig +short CNAME resend._domainkey.aberrance.app
   ```
2. **Inspect server environment**: Confirm `GOTRUE_SMTP_PASS` is non-empty in `/srv/hestia/.env`.
3. **Trigger sign-in link**: Navigate to `https://hestia.aberrance.app/sign-in`, click **Email me a sign-in link**, and enter the owner email address.
4. **Confirm receipt**: Check the recipient inbox for an email from `Hestia <auth@aberrance.app>` with subject `Your Magic Link`, containing both the button and the 6-digit numeric OTP code.
5. **Inspect headers**: Confirm authentication headers pass:
   - `SPF: PASS` with domain `aberrance.app` or `bounces.aberrance.app`
   - `DKIM: PASS` with domain `aberrance.app` (selector `resend`)
6. **Complete sign-in**: Enter the 6-digit OTP code on the web screen (or click the confirmation link) and verify successful authentication into the household dashboard.

## Cloudflare Edge Caching

Hestia's ingress emits explicit `Cache-Control` headers for all served routes. Cloudflare's Edge Cache respects these headers when a Cache Rule is configured.

### Configuring the Cache Rule
1. In Cloudflare Dashboard, select domain `aberrance.app`.
2. Navigate to **Caching** → **Cache Rules** → **Create rule**.
3. Rule name: `Cache Hestia Static Assets`.
4. Expression:
   ```text
   http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/assets/")
   ```
5. Cache eligibility: **Eligible for cache**.
6. Edge TTL: **Respect origin** (falls back to 1 year / 31536000s).
7. Browser TTL: **Respect origin**.
8. Click **Deploy**.

### Verifying Edge Caching
Verify using curl against an active hashed asset bundle:
```bash
curl -sI https://hestia.aberrance.app/assets/<bundle>.js | grep -iE 'cf-cache-status|cache-control'
```
- Initial request returns `cf-cache-status: MISS` (or `DYNAMIC`).
- Immediate subsequent request returns `cf-cache-status: HIT` and `cache-control: public, max-age=31536000, immutable`.
- Requesting entrypoint `https://hestia.aberrance.app/` or `/sw.js` returns `cache-control: no-cache, must-revalidate` and `cf-cache-status: DYNAMIC`.

## Cloudflare Edge Security & WAF Rate Limiting

To protect GoTrue authentication endpoints (`/auth/v1/token`, `/auth/v1/otp`, `/auth/v1/recover`) against automated brute-force attacks and credential stuffing, Cloudflare WAF Rate Limiting enforces an edge threshold before requests reach host infrastructure.

### Policy Specifications
- **Scope:** Strictly POST requests targeting `/auth/v1/*` (`http.request.method eq "POST"`). Read-only requests (`GET /auth/v1/user`), which the client issues to check session status, are excluded to prevent quota exhaustion on shared household Wi-Fi.
- **Rate:** 15 requests per 1-minute window per client IP.
- **Mitigation Action:** **Managed Challenge** (Cloudflare Turnstile challenge) with a **10-minute action duration**. Automated attack bots fail the challenge, while human users encountering a false positive can self-verify.

### Configuring the WAF Rate Limiting Rule
1. In Cloudflare Dashboard, select domain `aberrance.app`.
2. Navigate to **Security** → **WAF** → **Rate limiting rules** → **Create rule**.
3. Rule name: `Protect Hestia Auth Endpoints`.
4. Expression:
   ```text
   http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/auth/v1/") and http.request.method eq "POST"
   ```
5. Rate: `15` requests per `1 minute`.
6. Mitigation action: `Managed Challenge`, duration `10 minutes`.
7. Click **Deploy**.

### Verifying Rate Limiting Simulation
Run a rapid curl loop sending 16 requests to the OTP endpoint:
```bash
for i in $(seq 1 16); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://hestia.aberrance.app/auth/v1/otp \
    -H "Content-Type: application/json" -d '{"email":"probe@example.com"}'
done
```
- Requests 1 through 15 return standard application responses (`400`, `422`, or `200`).
- Request 16 returns HTTP `403` with Cloudflare Managed Challenge HTML.

## Mobile Web Push Verification

Web Push notifications operate across desktop browsers, Android Chrome, and iOS Safari 16.4+. Testing on real mobile devices requires specific device prerequisites and standalone PWA installation.

### Mobile OS Prerequisites & Constraints
- **iOS Safari (16.4+) Requirements:**
  1. Must be served over HTTPS (`https://hestia.aberrance.app`).
  2. The application **must** be added to the Home Screen (`display: standalone`). Standard Safari browser tabs do not support Web Push.
  3. Permission can only be requested via direct user touch gesture (navigating to **Settings → Notifications** and toggling an alert type).
  4. Apple Push Notification Service (APNs) mandates RFC 8292 compliant VAPID JWT claims (`VAPID_SUBJECT=mailto:admin@aberrance.app`).
- **Android Chrome Requirements:**
  1. Application must be served with valid PWA manifest and icons (`/manifest.webmanifest`).
  2. User must grant notification permission when prompted.

### Step-by-Step Device Verification Runbook
1. **Install PWA on Device**:
   - **iOS**: Open `https://hestia.aberrance.app` in Safari. Tap the **Share** button (box with upward arrow) → **Add to Home Screen** → **Add**.
   - **Android**: Open `https://hestia.aberrance.app` in Chrome. Tap the **Install** banner or menu (⋮) → **Install app**.
2. **Launch Standalone Application**:
   - Tap the Hestia icon on the device Home Screen. Verify the app launches in standalone display mode (no browser URL bar or navigation controls).
3. **Sign In**:
   - Sign in using a magic link or password.
4. **Enable Push Notifications**:
   - Navigate to **Settings** (gear icon) → **Notifications**.
   - Toggle on any notification type (e.g. **Chore reminders** or **Bill due reminders**).
   - When the native system dialog appears ("Hestia Would Like to Send You Notifications"), tap **Allow**.
5. **Dispatch Immediate Test Notification**:
   - From the deployment server or development terminal, run the administrative test push tool:
     ```bash
     # Inside Docker Compose:
     docker compose exec hestia-service hestia-admin test-push --email <user-email>

     # Or via pnpm shortcut on host:
     pnpm hestia-admin test-push --email <user-email>
     # Or:
     pnpm hestia:test-push --email <user-email>
     ```
   - Confirm terminal output:
     `Dispatched test push to 1 device(s) for <user-email>: 1 accepted, 0 gone, 0 failed.`
6. **Verify Device Notification Receipt**:
   - Lock the device or switch to another app.
   - Confirm a system notification banner appears with title "Test Push Notification" and body "This is a test notification from Hestia.".
   - Tap the notification banner and confirm it opens Hestia to the home dashboard (`/`).

## Troubleshooting

- **Health check:** `hestia-compose exec -T caddy wget -q -O - http://127.0.0.1:8080/api/health`
  (through Caddy, from inside its container) returns service status plus a database connectivity
  check. Both `scripts/deploy.sh`'s health gate and the first-start verification use it. From any
  machine the same endpoint is `https://hestia.aberrance.app/api/health`. `GET /api/health/deep` is owner-only (gated on
  `HESTIA_OWNER_EMAIL`) and backs Settings → About → System health in the app, for deeper
  diagnosis (job freshness, recent error fingerprints, backup age, Flipp skip rates).
- **Failed deploy / automatic rollback:** if the new images don't pass the health check within 60
  seconds, `scripts/deploy.sh` re-tags the previously running images `current`, recreates
  `hestia-service` and `caddy` on them, and exits non-zero. If that rollback itself fails to
  become healthy, the script still exits non-zero and leaves the previous images running —
  check `hestia-compose logs hestia-service caddy` for the cause. When a deploy fails after both
  images were already tagged `current` but before the containers came up healthy (or a first deploy
  had nothing to roll back to), retrying requires the deliberate path because the commit is already
  running: re-run the Deploy run from the Actions tab (attempt 2 or later redeploys the commit
  already running), or run `scripts/deploy.sh` by hand on the host with `HESTIA_DEPLOY_SHA` set to
  the commit.
- **Hung but "running" container:** Docker only restarts a container that exits, never one that's
  merely `unhealthy`. Restart it by hand with `docker compose restart <service>`.
- **Regenerating secrets:** never run `generate-secrets.sh` against a live install's `.env` path —
  it refuses to overwrite an existing file for exactly this reason: regenerating secrets signs
  everyone out and breaks the `hestia_service` database login.
- **Pinned names:** the hostname `hestia` and the zone `aberrance.app` must never change — see
  "Pinned names" above. There is no remediation for a rename short of every installed PWA and
  push subscription being re-created from scratch.
- **The site is unreachable:** run `hestia-compose ps cloudflared` and
  `hestia-compose logs --tail 50 cloudflared`. Check that the token in `/srv/hestia/.env` is
  current, that the route targets `http://caddy:8080`, and that the proxied DNS record for `hestia`
  exists.
- **Every request logs a `172.16.238.x` address:** Caddy is not taking the client from
  `CF-Connecting-IP`. Check that `HESTIA_TRUSTED_PROXIES` holds the Compose subnet and that the
  route points at `caddy:8080`, not at a backend service.
- **A network recreate left half done:** the deploy stops with
  `could not prepare the containers and the hestia network`, or Compose reports
  `has active endpoints` or `is not connected to the network`. This is usually an `up` that named
  only some services meeting a changed network. Run `hestia-compose down`, which keeps the named
  volumes and the backup directory (never add `-v`), then re-run the Deploy run; its prepare step
  recreates the network and brings every service back.
- **Migrations are forward-only:** rolling back `hestia-service`/`caddy` images (manual or
  automatic) never rolls back the database schema. A migration that needs undoing requires a new
  forward migration or a full restore from backup.
- **Another Compose project already on this host:** the stack pins its Compose network to
  `172.16.238.0/24`. A different Compose project on the same host that holds that subnet must be
  stopped before the first deploy; otherwise `scripts/deploy.sh` stops at the supporting-services
  health gate with "the Supabase services, the backup or the tunnel are not healthy; nothing
  restarted", and whatever is already running keeps serving.
- **Docs-only changes don't deploy:** `deploy.yml` skips the deploy step when nothing outside
  `docs/` and `.planning/` changed since the running revision (see "Ongoing deploys").
