# Deploying Hearth

## Overview

Production is one Linux box running the stack defined in `docker/docker-compose.yml` under Docker
Compose. The box is reached over the internet only through Tailscale Funnel, which terminates TLS
on the host and forwards plain HTTP to Caddy; Caddy is the only container that publishes a port
(`127.0.0.1:8080`), and it is the only way in — there is no port forwarded on the router and no
DNS record to manage. Caddy serves the built PWA directly and reverse-proxies `/api/*` to the
Hearth service and `/auth/v1/*` / `/realtime/v1/*` to Kong, which fronts GoTrue (auth) and
Realtime. A nightly backup container dumps Postgres to a second physical disk. Deploys are
triggered by a passing CI run on `main` and run on a self-hosted GitHub Actions runner on the same
box.

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
  (for example `/mnt/backup/hearth`), separate from the disk holding the Docker data root and the
  Postgres volume. This is the only copy of the data: there is no off-site or cloud backup copy.

## Dependencies

Install on the host before first start:

- **Docker Engine with the Compose plugin** (`docker compose`, not the standalone `docker-compose`).
- **The Supabase CLI, version 2.117.0** — the exact version CI uses (`supabase/setup-cli@v3` pins
  it in `.github/workflows/ci.yml`) — needed to apply migrations during deploys.
- **Node 24** (the version pinned in `.nvmrc`), **git**, and **curl**.
- **Tailscale**, logged in to the tailnet, with **Funnel allowed for this machine in the tailnet
  policy**. `tailscaled` runs on the host, not in a container.
- **For automatic deploys:** a GitHub Actions **self-hosted runner** registered to this
  repository, labeled `self-hosted` and `hearth` (the deploy workflow targets
  `runs-on: [self-hosted, hearth]`), running as a user in the **`docker` group**. This runner must
  run only `.github/workflows/deploy.yml` — never pull-request jobs, since those would execute
  untrusted code on the production box.

## Pinned names

> **The machine name and the tailnet name are pinned and must never change once chosen.** The
> origin `https://<machine>.<tailnet>.ts.net` is baked into every installed PWA, its service
> worker registration, and every push subscription. Renaming the machine or the tailnet strands
> installed apps, orphans service workers, and invalidates every push subscription — there is no
> migration path for an origin change.

The owner fills in the machine and tailnet names once: in the repository's README ("Pinned
names" table) and as `HEARTH_ORIGIN` in `/srv/hearth/.env`. Keep the two recordings in sync.

| Name    | Value                                |
| ------- | ------------------------------------ |
| Machine | `<machine>`                          |
| Tailnet | `<tailnet>`                          |
| Origin  | `https://<machine>.<tailnet>.ts.net` |

## Dependencies the stack provides for itself

Two services exist purely to route and protect traffic, configured by files in `docker/`:

- **Caddy** (`docker/Caddyfile`) is the stack's only published port. It terminates the plain-HTTP
  side of Funnel, applies security headers (CSP, HSTS, etc.) to every response, serves the built
  PWA with SPA fallback, reverse-proxies `/api/*` to `hearth-service` and `/auth/v1/*` /
  `/realtime/v1/*` to Kong, and refuses direct `POST /auth/v1/signup*` and `PUT /auth/v1/user*`
  calls with a 403 so those paths can only be reached through `hearth-service`.
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

Every variable in `.env.example`, in order. The first five are filled in by the owner (three of
them copied in by `generate-secrets.sh` when set in its own environment); everything below
"Generated by `scripts/generate-secrets.sh`" is generated automatically and should never be typed
by hand.

| Variable | Purpose |
| --- | --- |
| `HEARTH_ORIGIN` | The pinned public origin, `https://<machine>.<tailnet>.ts.net`. Baked into every installed PWA and push subscription; must never change. |
| `HEARTH_OWNER_EMAIL` | The server owner's sign-in email. Unlocks `GET /api/health/deep` (System health). |
| `HEARTH_MAGIC_LINK_ENABLED` | Whether magic-link sign-in is enabled. Needs a domain and SMTP relay to work; the Caddy image build turns this into `VITE_MAGIC_LINK_ENABLED` for the PWA. Defaults to `false`. |
| `BACKUP_DIR` | The backup directory on the second physical disk. Mounted read-write into the `backup` container and read-only into `hearth-service`. |
| `HEARTH_RATE_LIMIT_PER_MINUTE` | Optional. Per-IP requests per minute across `/api`. Commented out in `.env.example`; leave unset in production (default 300). |
| `POSTGRES_PASSWORD` | Postgres superuser password. Also used by GoTrue (`supabase_auth_admin`), Realtime, and the backup container. |
| `HEARTH_SERVICE_DB_PASSWORD` | Password for `hearth_service`, the login role the Hearth service connects to Postgres as. |
| `JWT_SECRET` | GoTrue's HS256 JWT signing secret. |
| `ANON_KEY` | The anon API key, signed with `JWT_SECRET`. Used as the `apikey` header on GoTrue/Kong calls. |
| `SERVICE_ROLE_KEY` | The service-role API key, signed with `JWT_SECRET`. Used only for sanctioned service-role operations. |
| `REALTIME_SECRET_KEY_BASE` | Realtime's cookie-signing secret. |
| `REALTIME_DB_ENC_KEY` | Realtime's 16-character tenant-credential encryption key. |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (P-256, base64url). |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key (P-256, base64url). |

Not in `.env.example` but worth knowing: an optional `VAPID_SUBJECT` can be set by hand. When
unset, the service falls back to `mailto:` + `HEARTH_OWNER_EMAIL`, or else `HEARTH_ORIGIN` if it's
an `https:` URL; a set value must itself be a `mailto:` or `https:` URI, or the service fails at
startup.

## First-time setup

Run from a checkout of `main`, on the host. The real `.env` lives outside the checkout, at
`/srv/hearth/.env`, because the deploy runner wipes its checkout on every run.

```sh
sudo install -d -m 700 -o "$USER" /srv/hearth
sudo install -d -m 755 /mnt/backup/hearth
HEARTH_ORIGIN=https://<machine>.<tailnet>.ts.net HEARTH_OWNER_EMAIL=<owner email> \
  BACKUP_DIR=/mnt/backup/hearth scripts/generate-secrets.sh

alias hearth-compose='docker compose --env-file /srv/hearth/.env -f docker/docker-compose.yml'
hearth-compose build
hearth-compose up -d --wait
curl -fsS http://127.0.0.1:8080/api/health

sudo tailscale funnel --bg http://127.0.0.1:8080
```

Notes:

- `generate-secrets.sh` writes `/srv/hearth/.env` from `.env.example` with every secret generated,
  and **refuses to overwrite an existing `.env`** — regenerating secrets on a live install signs
  everyone out and breaks the database login.
- `scripts/deploy.sh` also works as the first start: it builds, starts the stack, and migrates in
  one step.
- All commands below assume the `hearth-compose` alias above, run from the repository root.

## Ongoing deploys

A merge to `main` whose CI passed triggers `scripts/deploy.sh` on the self-hosted runner
(`.github/workflows/deploy.yml`, which watches the `CI` workflow's `workflow_run` and re-checks
that it was a push to `main` before deploying). Its `changes` step runs `scripts/deploy-gate.sh`
against the revision label of the running `hearth-service:current` image, and the deploy runs only
when that gate says so: it **deploys when something outside `docs/` and `.planning/` changed**
since the running revision (the whole range, not only the tip commit, so a code change whose deploy
never ran still ships behind a later docs-only commit), redeploys on a re-run of the running
commit, deploys when no labelled image is running, and **skips a commit older than the running
one** (a re-run of an old CI run never rolls production back). The job checks out the full history
the comparison needs and keeps no token on the host. A deploy can also be run by hand from a
checkout.

`scripts/deploy.sh` performs these steps, in order, aborting before anything is restarted if any
of the first few fail:

1. Records the images currently tagged `current` as the rollback target.
2. Builds `hearth-service:<sha>` and `hearth-caddy:<sha>` (the PWA is built into the Caddy image).
   A failed build changes nothing.
3. Starts any Supabase service (`db`, `auth`, `realtime`, `kong`, `backup`) that isn't already
   running, without recreating any that are.
4. Takes a backup with `hearth-compose exec -T backup /backup.sh`. **A failed backup aborts the
   deploy** — nothing is migrated or restarted.
5. Applies pending migrations with `supabase migration up` against the Compose database. The CLI
   gets the database password in `PGPASSWORD`, set for that one command and never on its command
   line. **A failed migration aborts the deploy**; the backup just taken is the restore point.
6. Re-applies the `hearth_service` login from `.env` (`docker/db/hearth-service-login.sql`) —
   idempotent, and picks up a rotated password.
7. Tags the new images `current` and recreates `hearth-service` and `caddy` on them.
8. Polls `GET http://127.0.0.1:8080/api/health` for 60 seconds. If it never succeeds, the script
   tags the **previous** images `current` again, recreates both containers on them, and exits
   non-zero (automatic rollback).

Nothing is restarted before the backup and migrations succeed, and re-running a deploy of the same
commit is harmless. The five newest SHA-tagged images of each kind are kept.

A deploy never recreates `db`, `auth`, `realtime`, `kong`, or `backup`. After changing their
configuration or image tag, take a backup by hand and apply the change with
`hearth-compose up -d --wait`.

Compose also does not recreate a running service when only a bind-mounted file changed, and
`docker/kong.yml` is bind-mounted. After merging a `docker/kong.yml` change, take a backup by hand
and run `hearth-compose up -d --force-recreate kong` on the host. Sign-ins can fail for a few
seconds while Kong restarts. To roll back a Kong change, revert it, let the deploy finish and run
the same command again.

## Manual rollback

To roll back by hand to an older build (beyond the deploy's own automatic rollback):

```sh
docker image ls 'hearth-*'
docker tag hearth-service:<sha> hearth-service:current
docker tag hearth-caddy:<sha> hearth-caddy:current
hearth-compose up -d --no-deps hearth-service caddy
```

Migrations are forward-only, so rolling back images never rolls back the schema.

## Backups

The `backup` container runs `pg_dump` nightly at 02:00 UTC into `BACKUP_DIR` on the second disk,
gzip-compressed, keeping 14 daily, 8 weekly, and 6 monthly dumps
(`$BACKUP_DIR/{last,daily,weekly,monthly}/postgres-*.sql.gz`, each with a `postgres-latest.sql.gz`
link alongside it). Every deploy takes one before migrating.

To take a backup right now:

```sh
hearth-compose exec -T backup /backup.sh
```

## Restore

There is no off-site or cloud backup copy, so a correct restore procedure is the whole safety net.

### Restore test (quarterly)

An untested backup is an assumption. The test restores the newest dump into a **throwaway**
container of the same pinned Postgres image, leaving production untouched:

1. Load `/srv/hearth/.env` and locate `$BACKUP_DIR/last/postgres-latest.sql.gz`.
2. Start a detached `public.ecr.aws/supabase/postgres:17.6.1.167` container named
   `hearth-restore`, and wait for its init process and for `pg_isready`.
3. Because `pg_dump` does not include roles: apply the `hearth_service` role migration
   (`supabase/migrations/20260919060000_hearth_service_role.sql`) and manually create
   `supabase_realtime_admin` (it's created by Realtime at runtime, not by the Postgres image).
4. Load the dump with `gunzip -c "$DUMP" | docker exec -i hearth-restore psql ...`, capturing
   errors to a log file, and confirm the error count is 0.
5. Sanity-check the restored state: `hearth_service`'s role attributes, that `auth`/`public`/
   `realtime`/`supabase_migrations` schemas exist, a user count, and the applied migration list.
6. Remove the throwaway container and the error log.

### Restore production

This replaces the **live** database with a dump; the site is down while it runs.

1. Load `/srv/hearth/.env` and choose the dump to restore (for example
   `$BACKUP_DIR/daily/postgres-<yyyymmdd>.sql.gz`).
2. `hearth-compose stop`, then `hearth-compose rm --force db`, then remove the `hearth_db-data`
   volume — this destroys the current database.
3. `hearth-compose up -d --wait db` to get a **fresh** database: the image creates the Supabase
   roles, and the init scripts recreate `hearth_service` from its migration and give it its login
   from `.env`.
4. Manually create `supabase_realtime_admin` again (same reason as the restore test), load the
   dump the same way, and confirm 0 errors.
5. `hearth-compose up -d --wait` to bring the rest of the stack up, then
   `curl -fsS http://127.0.0.1:8080/api/health` to confirm.

Only `db` runs while the dump loads: GoTrue and Realtime keep their own migration state inside the
database, so they must find the restored state when they start — bringing them up early would let
them re-initialize against the wrong state.

## Troubleshooting

- **Health check:** `GET http://127.0.0.1:8080/api/health` (through Caddy) returns service status
  plus a database connectivity check. This is the URL both `scripts/deploy.sh`'s health gate and
  the first-start verification use. `GET /api/health/deep` is owner-only (gated on
  `HEARTH_OWNER_EMAIL`) and backs Settings → About → System health in the app, for deeper
  diagnosis (job freshness, recent error fingerprints, backup age, Flipp skip rates).
- **Failed deploy / automatic rollback:** if the new images don't pass the health check within 60
  seconds, `scripts/deploy.sh` re-tags the previously running images `current`, recreates
  `hearth-service` and `caddy` on them, and exits non-zero. If that rollback itself fails to
  become healthy, the script still exits non-zero and leaves the previous images running —
  check `hearth-compose logs hearth-service caddy` for the cause.
- **Hung but "running" container:** Docker only restarts a container that exits, never one that's
  merely `unhealthy`. Restart it by hand with `docker compose restart <service>`.
- **Regenerating secrets:** never run `generate-secrets.sh` against a live install's `.env` path —
  it refuses to overwrite an existing file for exactly this reason: regenerating secrets signs
  everyone out and breaks the `hearth_service` database login.
- **Pinned names:** the machine name and tailnet name must never change after they're chosen —
  see "Pinned names" above. There is no remediation for a rename short of every installed PWA and
  push subscription being re-created from scratch.
- **Migrations are forward-only:** rolling back `hearth-service`/`caddy` images (manual or
  automatic) never rolls back the database schema. A migration that needs undoing requires a new
  forward migration or a full restore from backup.
- **Docs-only changes don't deploy:** `deploy.yml` skips the deploy step when nothing outside
  `docs/` and `.planning/` changed since the running revision (see "Ongoing deploys").
