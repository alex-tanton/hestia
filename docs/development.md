# Development

This file covers local setup, the dev servers, the commands, running the API against a local Supabase
stack, the database and seed data, and the commit hooks. Prerequisites are in
[README.md](../README.md#prerequisites), the test suites in [testing.md](testing.md), and production
in [deployment.md](deployment.md).

## Setup

`pnpm install` installs the dependencies and the Husky hooks; run it in every new worktree (see
[Branches and worktrees](../CONTRIBUTING.md#branches-and-worktrees)).

## Dev servers

```sh
pnpm install
pnpm --filter @hearth/web dev        # PWA dev server
pnpm --filter @hearth/service dev    # API (needs DATABASE_URL)
```

The API needs `DATABASE_URL` and the rest of its environment; see
[Running the service locally](#running-the-service-locally).

## Commands

| Command | Runs |
| --- | --- |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier (write); `pnpm format:check` to verify |
| `pnpm typecheck` | `tsc --noEmit` in every workspace |
| `pnpm test` | Harness tests, then Vitest unit and component tests |
| `pnpm test:integration` | Vitest against `supabase start` |
| `pnpm test:sweep` | Unit tests across pinned dates and time zones |
| `pnpm test:e2e` | Playwright against the Compose stack ([testing.md](testing.md#end-to-end-tests)) |
| `pnpm build` | Production builds of web and service |
| `pnpm knip` | Report of unused files, exports and dependencies |

`pnpm --filter @hearth/service test:coverage` reports the service's coverage over its unit and
integration tests together, so it needs `supabase start` running too.

[testing.md](testing.md) describes each suite.

## Running the service locally

`supabase start` runs Postgres, GoTrue, Realtime, Kong, and Studio locally and applies
`supabase/migrations/`. The migrations create `hestia_service` without a login; give it one, then
point the service at the local database and at GoTrue through Kong:

```sh
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "alter role hestia_service with login password 'hearth'"

eval "$(supabase status -o env)"                                    # ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET
export DATABASE_URL=postgresql://hestia_service:hearth@127.0.0.1:54322/postgres
export GOTRUE_URL=http://127.0.0.1:54321/auth/v1                    # http://auth:9999 in production
export HEARTH_ORIGIN=http://127.0.0.1:5173                          # where invite and reset links point
export HEARTH_OWNER_EMAIL=you@example.com                           # unlocks GET /api/health/deep
export ANON_KEY SERVICE_ROLE_KEY JWT_SECRET
pnpm --filter @hearth/service dev
```

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | The `hestia_service` login; every request runs through `withUserDb` |
| `GOTRUE_URL` | Signup, password change, and the admin calls |
| `JWT_SECRET` | Verifying access tokens (HS256; local sessions are ES256 via its JWKS) |
| `ANON_KEY` | The `apikey` header on GoTrue calls |
| `SERVICE_ROLE_KEY` | The sanctioned service-role uses only (email change, owner CLI) |
| `HEARTH_ORIGIN` | Invite links (`/join#token=…`) and the reset link's `/set-password` |
| `HEARTH_OWNER_EMAIL` | Who may open System health; unset means nobody |
| `HEARTH_TRUSTED_PROXIES` | Whose `X-Forwarded-For` to believe; unset trusts none |
| `BACKUP_DIR` | Optional; System health reports the newest backup file's time |
| `LOG_LEVEL`, `HOST`, `PORT` | Pino level and the listen address |

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

## Database

| Command | Runs |
| --- | --- |
| `supabase db reset` | Recreates the local database and applies every migration |
| `pnpm db:types` | Regenerates `apps/service/src/db/types.ts` from the migrated local schema |
| `pnpm db:seed` | Creates the seed users through GoTrue, then applies the seed SQL |
| `pnpm test:integration` | RLS, database and route tests; isolation is in [testing.md](testing.md#integration-tests) |

Run `pnpm db:types` after every new migration and commit the result. `pnpm db:seed` needs `psql`
on the path. It creates the five seed users (password `hearth-seed-pass-2026`) and prints the
outstanding Oak Street invite's code and link token. It runs once per database: run
`supabase db reset` before seeding again. It refuses a database or GoTrue that has any user other
than the five seed users, so it cannot add them to a stack that real people use. See
[Seed data](testing.md#seed-data) for what the seed contains.

To seed a Compose stack instead (development only, never production), point it at Caddy and at
the `db` container's address on the Compose network (`hearth-compose` is the alias defined in
[First-time setup](deployment.md#first-time-setup)):

```sh
set -a; . /srv/hearth/.env; set +a
DB_IP=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
  "$(hearth-compose ps --quiet db)")
HEARTH_SEED_AUTH_URL=http://127.0.0.1:8080/auth/v1 \
  HEARTH_SEED_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  HEARTH_SEED_DB_URL="postgresql://postgres:$POSTGRES_PASSWORD@$DB_IP:5432/postgres" \
  pnpm db:seed
```

## Commits and hooks

Commits follow Conventional Commits, checked by commitlint in a Husky hook; the pre-commit hook
lints, formats, and typechecks. The hook runs lint-staged, then `pnpm typecheck`. The message, branch
and pull-request rules are in [CONTRIBUTING.md](../CONTRIBUTING.md#commit-and-squash-messages).

## Scripts

Add a new executable with `git add --chmod=+x {file}` (or `git update-index --chmod=+x {file}`),
because checkouts with `core.filemode=false` cannot record the bit. Check it with
`git ls-files -s {file}`, which must show `100755`. Files stay LF through `.gitattributes`;
`git ls-files --eol {file}` shows `i/lf`. CI's `hygiene` job fails a tracked script (a file that
starts with a shebang, or whose name ends in .sh) that is not `100755`, and any text file with
CRLF endings.

## Checks before pushing

Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm test`. Also run the checks that
`hygiene` runs: `pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`,
`node scripts/audit-prod.mjs` and `node scripts/check-repo-hygiene.mjs`; for a change that touches
migrations, `node scripts/check-migrations-append-only.mjs --base origin/main`. See
[testing.md](testing.md) for integration and E2E runs.

[Commands](#commands) says what the first four commands run, and
[What CI checks](../CONTRIBUTING.md#what-ci-checks) says what fails each hygiene check.
