# Hearth

A self-hosted household-admin PWA: grocery deals and shopping lists, meal planning, bills, and
chores for one household (or a few), running on a single home server. The specifications in
[`docs/`](docs/) are the source of truth for behaviour, architecture, and design.

## Prerequisites

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 10 (`corepack enable` picks up the version pinned in `package.json`)
- Docker with Compose
- Supabase CLI

## Layout

| Path                  | Contents                                            |
| --------------------- | --------------------------------------------------- |
| `apps/web`            | React PWA (Vite, Tailwind, Workbox)                 |
| `apps/service`        | Fastify API, jobs, and the `hearth-admin` CLI       |
| `packages/shared`     | Zod schemas, domain types, shared constants         |
| `packages/recurrence` | Anchored recurrence logic (pure, dependency-free)   |
| `packages/matching`   | Ingredient normalization and matching (pure)        |
| `e2e`                 | Playwright journeys and Flipp fixtures              |
| `supabase`            | Supabase CLI config, SQL migrations, and seed       |
| `docker`              | Compose file, Caddyfile, Kong config, Dockerfiles   |
| `scripts`             | Deploy, secrets, CI pre-pull and test sweep scripts |

## Development

```sh
pnpm install
pnpm --filter @hearth/web dev        # PWA dev server
pnpm --filter @hearth/service dev    # API (needs DATABASE_URL)
```

| Command                 | Runs                                                |
| ----------------------- | --------------------------------------------------- |
| `pnpm lint`             | ESLint                                              |
| `pnpm format`           | Prettier (write); `pnpm format:check` to verify     |
| `pnpm typecheck`        | `tsc --noEmit` in every workspace                   |
| `pnpm test`             | Harness tests, then Vitest unit and component tests |
| `pnpm test:integration` | Vitest against `supabase start`                     |
| `pnpm test:sweep`       | Unit tests across pinned dates and time zones       |
| `pnpm test:e2e`         | Playwright against the Compose stack (below)        |
| `pnpm build`            | Production builds of web and service                |
| `pnpm knip`             | Report of unused files, exports and dependencies    |

`pnpm --filter @hearth/service test:coverage` reports the service's coverage over its unit and
integration tests together, so it needs `supabase start` running too.

Commits follow Conventional Commits, checked by commitlint in a Husky hook; the pre-commit hook
lints, formats, and typechecks.

### End-to-end tests

`pnpm test:e2e` is the whole command. It needs Docker, the Supabase CLI, and `psql`, plus the
browser once (`pnpm --filter @hearth/e2e exec playwright install --with-deps chromium`). Playwright's
global setup builds and starts `docker/docker-compose.yml` with `e2e/docker-compose.e2e.yml` over
it — the production stack, so the journeys really do run through Caddy — applies the migrations,
seeds, and hands the suite a stack on a free loopback port, printed as `ready at …` when it is up.
Teardown drops it, database volume included, so every run starts from the same fixtures.

Each run has its own Compose project (`hearth-e2e-<run id>`), network, image tag, and ports, and
its secrets are a throwaway `.env` generated under the run's temporary directory. Two runs can
therefore start at once, from two clones, and neither touches the other's stack, nor a
`supabase start`, nor an `.env` already on the machine. `HEARTH_E2E_REUSE_STACK=1` skips bring-up
and leaves the stack running, which is for iterating on one test: pass the run id it printed as
`HEARTH_E2E_RUN_ID=<id>` to find that stack again. A run whose result is being trusted starts from
an empty database.

### Running the service locally

`supabase start` runs Postgres, GoTrue, Realtime, Kong, and Studio locally and applies
`supabase/migrations/`. The migrations create `hearth_service` without a login; give it one, then
point the service at the local database and at GoTrue through Kong:

```sh
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "alter role hearth_service with login password 'hearth'"

eval "$(supabase status -o env)"                                    # ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET
export DATABASE_URL=postgresql://hearth_service:hearth@127.0.0.1:54322/postgres
export GOTRUE_URL=http://127.0.0.1:54321/auth/v1                    # http://auth:9999 in production
export HEARTH_ORIGIN=http://127.0.0.1:5173                          # where invite and reset links point
export HEARTH_OWNER_EMAIL=you@example.com                           # unlocks GET /api/health/deep
export ANON_KEY SERVICE_ROLE_KEY JWT_SECRET
pnpm --filter @hearth/service dev
```

| Variable                    | Used for                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`              | The `hearth_service` login; every request runs through `withUserDb`    |
| `GOTRUE_URL`                | Signup, password change, and the admin calls                           |
| `JWT_SECRET`                | Verifying access tokens (HS256; local sessions are ES256 via its JWKS) |
| `ANON_KEY`                  | The `apikey` header on GoTrue calls                                    |
| `SERVICE_ROLE_KEY`          | The sanctioned service-role uses only (email change, owner CLI)        |
| `HEARTH_ORIGIN`             | Invite links (`/join#token=…`) and the reset link's `/set-password`    |
| `HEARTH_OWNER_EMAIL`        | Who may open System health; unset means nobody                         |
| `HEARTH_TRUSTED_PROXIES`    | Whose `X-Forwarded-For` to believe; unset trusts none                  |
| `BACKUP_DIR`                | Optional; System health reports the newest backup file's time          |
| `LOG_LEVEL`, `HOST`, `PORT` | Pino level and the listen address                                      |

The generated API document is at `GET /api/openapi.json`. The owner CLI is a bin in the service
image, a shell wrapper around the built `dist/cli.js` (`docker compose exec hearth-service
hearth-admin reset-password <email>`); locally it runs from the built bundle with `GOTRUE_URL`,
`SERVICE_ROLE_KEY`, and `HEARTH_ORIGIN` set:

```sh
pnpm --filter @hearth/service build
./apps/service/bin/hearth-admin reset-password you@example.com
```

The PWA's magic-link screens are decided at build time by `VITE_MAGIC_LINK_ENABLED`, which the
`caddy` image build takes from `HEARTH_MAGIC_LINK_ENABLED` in `.env` (default `false`).

### Database

| Command                 | Runs                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `supabase db reset`     | Recreates the local database and applies every migration                  |
| `pnpm db:types`         | Regenerates `apps/service/src/db/types.ts` from the migrated local schema |
| `pnpm db:seed`          | Creates the seed users through GoTrue, then applies the seed SQL          |
| `pnpm test:integration` | RLS, database and route tests; isolation is in `docs/testing.md`          |

Run `pnpm db:types` after every new migration and commit the result. `pnpm db:seed` needs `psql`
on the path. It creates the five seed users (password `hearth-seed-pass-2026`) and prints the
outstanding Oak Street invite's code and link token. It runs once per database: run
`supabase db reset` before seeding again. It refuses a database or GoTrue that has any user other
than the five seed users, so it cannot add them to a stack that real people use.

To seed a Compose stack instead (development only, never production), point it at Caddy and at
the `db` container's address on the Compose network (`hearth-compose` is the alias from "First
start"):

```sh
set -a; . /srv/hearth/.env; set +a
DB_IP=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
  "$(hearth-compose ps --quiet db)")
HEARTH_SEED_AUTH_URL=http://127.0.0.1:8080/auth/v1 \
  HEARTH_SEED_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  HEARTH_SEED_DB_URL="postgresql://postgres:$POSTGRES_PASSWORD@$DB_IP:5432/postgres" \
  pnpm db:seed
```

## Deployment

Production is one Linux box running `docker/docker-compose.yml`, published to the internet by
Tailscale Funnel. Only Caddy publishes a port, and only on `127.0.0.1:8080`.

### Pinned names

> **The machine name and the tailnet name are pinned and must never change.** The origin
> `https://<machine>.<tailnet>.ts.net` is baked into every installed PWA, its service worker,
> and every push subscription. Renaming the machine or the tailnet strands installed apps and
> invalidates every push subscription. The owner fills these in once, here and as
> `HEARTH_ORIGIN` in `/srv/hearth/.env`.

| Name    | Value                                |
| ------- | ------------------------------------ |
| Machine | `<machine>`                          |
| Tailnet | `<tailnet>`                          |
| Origin  | `https://<machine>.<tailnet>.ts.net` |

### Host prerequisites

- Ubuntu Server LTS (any Docker-capable Linux), with a **second physical disk** mounted for
  backups, for example at `/mnt/backup`
- Docker Engine with the Compose plugin
- The Supabase CLI, version 2.117.0 (the version CI uses), for migrations
- Node 24, git, and curl
- Tailscale, logged in to the tailnet, with Funnel allowed for this machine in the tailnet policy
- For automatic deploys: a GitHub Actions self-hosted runner registered to this repository with
  the labels `self-hosted` and `hearth`, running as a user in the `docker` group. It runs only
  `.github/workflows/deploy.yml`, never pull-request jobs.

### First start

Run from a checkout of `main`. The `.env` lives outside the checkout, at `/srv/hearth/.env`,
because the runner wipes its checkout on every run.

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

`generate-secrets.sh` refuses to overwrite an existing `.env`: regenerating secrets on a live
install signs everyone out and breaks the database login. `scripts/deploy.sh` also works as the
first start; it builds, starts the stack, and migrates in one step.

The commands in this README use the `hearth-compose` alias above, run from the repository root.

### Deploy

A merge to `main` whose CI passed runs `scripts/deploy.sh` on the self-hosted runner (skipped
when nothing outside `docs/` and `.planning/` changed since the running revision, for a commit
already running except a re-run of the Deploy run, and never for a commit older than the running
one). It can also be run by hand from a checkout. It:

1. records the images tagged `current` as the rollback target
2. builds `hearth-service:<sha>` and `hearth-caddy:<sha>` (the PWA is built into the Caddy image)
3. starts any Supabase service that is not running, without recreating any
4. takes a backup with `hearth-compose exec -T backup /backup.sh`; a failure aborts the deploy
5. applies pending migrations with `supabase migration up`; a failure aborts the deploy
6. re-applies the `hearth_service` login from `.env` (`docker/db/hearth-service-login.sql`)
7. tags the new images `current` and recreates `hearth-service` and `caddy` on them
8. polls `GET http://127.0.0.1:8080/api/health` for 60 seconds; if it never succeeds, tags the
   previous images `current` again, recreates both containers, and exits non-zero

Nothing is restarted before the backup and migrations succeed, and re-running a deploy of the
same commit is harmless. The five newest SHA-tagged images of each kind are kept. To roll back
by hand to an older build:

```sh
docker image ls 'hearth-*'
docker tag hearth-service:<sha> hearth-service:current
docker tag hearth-caddy:<sha> hearth-caddy:current
hearth-compose up -d --no-deps hearth-service caddy
```

Migrations are forward-only, so rolling back images never rolls back the schema.

A deploy never recreates `db`, `auth`, `realtime`, `kong`, or `backup`. After a change to their
configuration or image tag, take a backup and apply it by hand with `hearth-compose up -d --wait`.

## Backups

The `backup` container runs `pg_dump` nightly at 02:00 UTC into `BACKUP_DIR` on the second disk,
gzip-compressed, keeping 14 daily, 8 weekly, and 6 monthly dumps
(`$BACKUP_DIR/{last,daily,weekly,monthly}/postgres-*.sql.gz`, each with a
`postgres-latest.sql.gz` link). Every deploy takes one before migrating. To take one now:

```sh
hearth-compose exec -T backup /backup.sh
```

### Restore test (quarterly)

An untested backup is an assumption. This restores the newest dump into a throwaway container of
the same pinned Postgres image, leaving production untouched:

```sh
set -a; . /srv/hearth/.env; set +a
DUMP="$BACKUP_DIR/last/postgres-latest.sql.gz"

docker run --detach --name hearth-restore -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  public.ecr.aws/supabase/postgres:17.6.1.167 \
  postgres -c config_file=/etc/postgresql/postgresql.conf
until docker logs hearth-restore 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec hearth-restore pg_isready -U postgres -h localhost -q; do sleep 1; done

# Roles are not in the dump: hearth_service comes from its migration, and
# supabase_realtime_admin (created by Realtime, not the image) is created here.
docker exec -i hearth-restore psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  < supabase/migrations/20260919060000_hearth_service_role.sql
docker exec -i hearth-restore psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create role supabase_realtime_admin noinherit nologin noreplication;
grant anon, authenticated, service_role to supabase_realtime_admin;
SQL

gunzip -c "$DUMP" |
  docker exec -i hearth-restore psql -U supabase_admin -d postgres -q -o /dev/null \
  2> restore-errors.log
grep -c ERROR restore-errors.log    # expect 0

docker exec hearth-restore psql -U supabase_admin -d postgres -c "
  select rolname, rolinherit, rolcanlogin from pg_roles where rolname = 'hearth_service';
  select nspname from pg_namespace
    where nspname in ('auth', 'public', 'realtime', 'supabase_migrations');
  select count(*) as users from auth.users;
  select version from supabase_migrations.schema_migrations order by version;"

docker rm -f hearth-restore && rm restore-errors.log
```

### Restore production

This replaces the live database with a dump. The site is down while it runs.

```sh
set -a; . /srv/hearth/.env; set +a
DUMP="$BACKUP_DIR/daily/postgres-<yyyymmdd>.sql.gz"    # the dump to restore

hearth-compose stop
hearth-compose rm --force db
docker volume rm hearth_db-data

# A fresh database: the image creates the Supabase roles, and the init scripts recreate
# hearth_service from its migration and give it its login from .env.
hearth-compose up -d --wait db
hearth-compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create role supabase_realtime_admin noinherit nologin noreplication;
grant anon, authenticated, service_role to supabase_realtime_admin;
SQL
gunzip -c "$DUMP" |
  hearth-compose exec -T db psql -U supabase_admin -d postgres -q -o /dev/null \
  2> restore-errors.log
grep -c ERROR restore-errors.log    # expect 0

hearth-compose up -d --wait
curl -fsS http://127.0.0.1:8080/api/health
```

Only `db` runs while the dump loads: GoTrue and Realtime keep their own migration state in the
database, and must find the restored state when they start.
