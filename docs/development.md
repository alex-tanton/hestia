# Development Guide

This guide covers local environment setup, dev servers, commands, local Supabase workflows, database seeding, and development hygiene gates.

## Quickstart

```bash
pnpm install                         # Install dependencies and git hooks
pnpm --filter @hestia/web dev        # Start PWA dev server (http://localhost:5173)
pnpm --filter @hestia/service dev    # Start API server (requires DATABASE_URL)
```

## Workspace Commands

| Command | Purpose |
| --- | --- |
| `pnpm lint` | Run ESLint across all workspaces (`--max-warnings=0`) |
| `pnpm format` | Format files with Prettier (`pnpm format:check` to verify) |
| `pnpm typecheck` | Validate TypeScript types across all projects without emitting files |
| `pnpm test` | Run unit and component test suites across workspaces |
| `pnpm test:integration` | Run database integration tests (requires `supabase start`) |
| `pnpm test:e2e` | Run Playwright end-to-end tests against Docker Compose stack |
| `pnpm build` | Create production builds for `@hestia/web` and `@hestia/service` |
| `pnpm knip` | Scan for unused files, exports, and dependencies |

See [testing.md](testing.md) for full details on each test layer.

## Running the Service Locally

The backend API requires a local Supabase instance (Postgres, GoTrue, Realtime, and Kong):

```bash
# 1. Start local Supabase containers and apply migrations
supabase start

# 2. Grant login permissions to the hestia_service role
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "alter role hestia_service with login password 'hestia'"

# 3. Export environment variables and start API server
eval "$(supabase status -o env)"
export DATABASE_URL=postgresql://hestia_service:hestia@127.0.0.1:54322/postgres
export GOTRUE_URL=http://127.0.0.1:54321/auth/v1
export HESTIA_ORIGIN=http://127.0.0.1:5173
export HESTIA_OWNER_EMAIL=you@example.com
export HESTIA_PUBLIC_SUPABASE_ANON_KEY SERVICE_ROLE_KEY JWT_SECRET
pnpm --filter @hestia/service dev
```

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string for `hestia_service` role (`withUserDb`) |
| `GOTRUE_URL` | Auth service URL for signup, sign-in, and password resets |
| `JWT_SECRET` | Secret used to verify HS256 access tokens |
| `HESTIA_PUBLIC_SUPABASE_ANON_KEY` | Public anon key sent to GoTrue / Kong |
| `SERVICE_ROLE_KEY` | Privileged key for admin operations (email update, CLI tasks) |
| `HESTIA_ORIGIN` | Base URL used for invite and password-reset links |
| `HESTIA_OWNER_EMAIL` | Email address permitted to access `GET /api/health/deep` |
| `HESTIA_TRUSTED_PROXIES` | Trusted reverse proxy CIDR ranges for client IP resolution |
| `BACKUP_DIR` | Optional backup storage path reported in system health diagnostics |

The live OpenAPI 3.1 specification is served at `GET /api/openapi.json`.

### Owner Administrative CLI

The `hestia-admin` CLI provides operational utilities:

```bash
# Build service CLI bundle
pnpm --filter @hestia/service build

# Run admin commands
GOTRUE_URL=http://127.0.0.1:54321/auth/v1 \
SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
HESTIA_ORIGIN=http://127.0.0.1:5173 \
./apps/service/bin/hestia-admin reset-password you@example.com
```

In production, run via Docker: `docker compose exec hestia-service hestia-admin <command>`.

## Database Management & Seeding

| Command | Purpose |
| --- | --- |
| `supabase db reset` | Recreates the local database and reapplies all migrations |
| `pnpm db:types` | Regenerates TypeScript schema types in `apps/service/src/db/types.ts` |
| `pnpm db:seed` | Populates five development seed users and initial household fixtures |

> [!NOTE]
> Run `pnpm db:types` after any new migration and commit the updated types. `pnpm db:seed` seeds test users (default password: `hestia-seed-pass-2026`) and prints household invite tokens.

## Pre-Push Quality Gates

Before pushing changes, run the repository validation gates:

```bash
# Core validation
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test

# Repository hygiene & audits
pnpm knip
node scripts/check-knip-baseline.mjs
pnpm jscpd
node scripts/audit-prod.mjs
node scripts/check-repo-hygiene.mjs
node scripts/check-migrations-append-only.mjs --base origin/main
```

- **Executable Permissions:** Shell scripts must be tracked with executable bit `100755` (`git add --chmod=+x <file>`).
- **Line Endings:** All text files must use standard LF line endings (`.gitattributes`).
- **Conventional Commits:** Commit messages follow conventional commit rules enforced by Husky and Commitlint (see [CONTRIBUTING.md](../CONTRIBUTING.md#commit-guidelines)).
