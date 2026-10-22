---
last_mapped_commit: 283f15dbb2b5ed8ded0ba14e04d5015e5d0d367c
last_mapped_at: 2026-10-22
---
# Technology Stack

**Analysis Date:** 2026-10-22

## Languages

**Primary:**
- TypeScript 6.0.3 (`typescript` devDependency in the root and every workspace) - all application code: `apps/service/src/`, `apps/web/src/`, `packages/*/src/`, `e2e/`, `supabase/seed/`

**Secondary:**
- TSX - React screens and components in `apps/web/src/components/`, `apps/web/src/screens/`, `apps/web/src/pillars/`
- SQL (PostgreSQL dialect) - schema, RLS, and functions in `supabase/migrations/*.sql` (8 files, applied in filename order)
- HTML and CSS - `apps/web/index.html`, `apps/web/src/index.css` (Tailwind CSS v4)
- POSIX shell - `scripts/deploy.sh`, `scripts/generate-secrets.sh`, `scripts/ci-prepull-images.sh`, `docker/caddy-entrypoint.sh`, `docker/kong-entrypoint.sh`, and the CLI wrapper `apps/service/bin/hearth-admin` (a hand-written `sh` script that `exec`s `node dist/cli.js`; it is not a build output)
- Node ESM `.mjs` - `apps/web/scripts/check-build.mjs`, `apps/web/scripts/generate-icons.mjs`, `test/clock-setup.mjs`, `test/global-tz.mjs`, `scripts/test-sweep.mjs`, `scripts/knip-summary.mjs`

## Runtime

**Environment:**
- Node.js 24 - `.nvmrc` contains `24`; root `package.json` `engines` is `>=24 <25`
- Container base image: `node:24.21.0-bookworm-slim` in `docker/service.Dockerfile` (all stages) and in the build stage of `docker/caddy.Dockerfile`
- Browser target: evergreen browsers, installed as a PWA (`apps/web/vite.config.ts`, `vite-plugin-pwa`)

**Package Manager:**
- pnpm 10.34.5 - pinned by the `packageManager` field in `package.json`; activated with `corepack enable` in the Dockerfiles and `pnpm/action-setup@v6` in CI (`.github/actions/setup/action.yml`)
- Workspace definition: `pnpm-workspace.yaml` (packages `apps/*`, `packages/*`, `e2e`, `supabase/seed`); `saveExact: true`; `onlyBuiltDependencies: [esbuild]`
- Lockfile: present - `pnpm-lock.yaml`. CI and Docker builds use `--frozen-lockfile`.
- Dependency override: `esbuild` forced to `0.28.2` in root `package.json` `pnpm.overrides`
- Peer-dependency exception: `allowedVersions` in `pnpm-workspace.yaml` permits `eslint-plugin-jsx-a11y` to peer on ESLint 10

**Workspace packages:**

| Package | Path | Role |
|---------|------|------|
| `@hearth/service` | `apps/service` | Fastify HTTP API, job scheduler, owner CLI |
| `@hearth/web` | `apps/web` | React PWA (Vite) |
| `@hearth/shared` | `packages/shared` | Shared Zod request and response schemas, problem and error types, scrubbing, password rules |
| `@hearth/matching` | `packages/matching` | Ingredient and item fuzzy matching |
| `@hearth/recurrence` | `packages/recurrence` | Bill and chore recurrence logic |
| `@hearth/e2e` | `e2e` | Playwright end-to-end suite |
| `@hearth/seed` | `supabase/seed` | Seed-user, seed-SQL, and pantry-readiness tooling |

## Frameworks

**Service (`apps/service`):**
- Fastify 5.12.5 - HTTP server; app factory `apps/service/src/app.ts`, entry point `apps/service/src/main.ts`
- `@fastify/rate-limit` 11.2.0 - per-IP limit on `/api/*`; default 300 per minute from `apps/service/src/env.ts` (`HEARTH_RATE_LIMIT_PER_MINUTE`)
- Zod 4.6.5 - environment and request validation (`apps/service/src/env.ts`)
- Kysely 0.29.6 over `pg` 8.23.0 - typed query builder; pool in `apps/service/src/db.ts`; generated types in `apps/service/src/db/types.ts`
- node-cron 4.6.0 - in-process scheduler (`apps/service/src/jobs/scheduler.ts`)
- cheerio 1.2.0 - HTML parsing for recipe import (`apps/service/src/recipes/json-ld.ts`, `apps/service/src/recipes/fetch-recipe.ts`)
- parse-ingredient 3.0.0 - recipe ingredient parsing (`apps/service/src/recipes/ingredient-parser.ts`)
- web-push 3.6.7 - VAPID-signed Web Push delivery (`apps/service/src/push/web-push-transport.ts`, typed in `apps/service/src/push/web-push.d.ts`)

**Web (`apps/web`):**
- React 19.3.0 and react-dom 19.3.0; `@types/react` and `@types/react-dom` 19.3.0
- React Router 8.4.0 (`react-router`) - routes in `apps/web/src/routes.tsx`
- TanStack Query 5.103.1 (`@tanstack/react-query`), with `@tanstack/react-query-persist-client` and `@tanstack/query-async-storage-persister` 5.103.1 for the offline cache (`apps/web/src/lib/offline/persist.ts`)
- idb-keyval 6.2.2 - IndexedDB storage behind the persisted query cache
- Radix UI 1.6.7 (`radix-ui`) - primitives wrapped in `apps/web/src/components/ui/`
- lucide-react 1.47.0 - icons
- Tailwind CSS 4.3.3 with `@tailwindcss/vite` 4.3.3 - styling (`apps/web/src/index.css`)
- Vite 8.3.0 with `@vitejs/plugin-react` 6.1.1 - dev server and bundler (`apps/web/vite.config.ts`)
- `vite-plugin-pwa` 1.3.0 - `injectManifest` strategy; the service worker is authored in `apps/web/src/sw.ts`; `registerType: 'prompt'`. Workbox 7.4.1 packages (`workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`, `workbox-cacheable-response`, `workbox-window`) are direct devDependencies of `apps/web`
- `@supabase/supabase-js` 2.116.0 - browser auth and Realtime client, loaded with a dynamic `import()` (`apps/web/src/lib/auth/auth-client.ts`)

**Shared packages:**
- `@hearth/shared` (`packages/shared`) - Zod 4.6.5 request and response schemas
- `@hearth/recurrence` (`packages/recurrence`) - `@date-fns/tz` 1.5.0 and date-fns 4.4.0
- `@hearth/matching` (`packages/matching`) - fastest-levenshtein 1.0.16
- `@hearth/seed` (`supabase/seed`) - `@hearth/matching` and `pg` 8.23.0

**Build:**
- tsup 8.5.1 - bundles the service to `apps/service/dist/` (`apps/service/tsup.config.ts`); `apps/service/src/write-openapi.ts` runs after it in `build`
- tsx 4.23.13 - runs TypeScript directly for `dev`, the seed tooling, and fixture scripts

**Testing:**
- Vitest 5.0.1 - unit and integration tests in every workspace (`apps/service/vitest.config.ts`, `vitest.integration.config.ts`, `vitest.coverage.config.ts`; `apps/web/vite.config.ts` test block). Every unit config (and the service coverage config) loads `test/clock-setup.mjs` as a setup file, which pins `Date`, and `test/global-tz.mjs` as `globalSetup`, which validates `TZ`; the integration config loads only `global-tz.mjs`. `pnpm test:sweep` and `pnpm test:sweep:integration` (`scripts/test-sweep.mjs`) run the suites across a fixed date and time-zone matrix; see `docs/testing.md`
- `@vitest/coverage-v8` 5.0.1 - coverage in `apps/service`, `apps/web`, and `packages/*`
- jsdom 30.1.0 - DOM environment for `apps/web`
- @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1, @testing-library/user-event 14.6.7 - component tests
- `@playwright/test` 1.63.0 and `@axe-core/playwright` 4.13.0 - E2E and accessibility (`e2e/playwright.config.ts`, which pins the browser to `America/New_York` and `en-US`)
- Supabase CLI 2.117.0 (`supabase/setup-cli@v3` in CI) - local Postgres, GoTrue, and Realtime stack for the integration tests; the E2E job uses it to apply migrations
- Test harness uses `node --test` for the root harness tests (`package.json` `test:harness`)

**Quality and tooling:**
- ESLint 10.11.0 with `typescript-eslint` 8.70.0, `@eslint/js` 10.0.1, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-jsx-a11y` 6.10.2, `eslint-config-prettier` 10.1.8, `globals` 17.12.0 - config in `eslint.config.js`
- Prettier 3.9.8 - `.prettierrc.json`, ignores in `.prettierignore`
- Husky 9.1.7 and lint-staged 17.5.1 - hooks in `.husky/pre-commit` and `.husky/commit-msg`; `.lintstagedrc.json`
- `@commitlint/cli` and `@commitlint/config-conventional` 21.2.2 - `commitlint.config.js`
- knip 6.41.0 - report-only unused-code scan; config `knip.json`; run with `pnpm knip` or `pnpm knip:production` (CI does not run it)
- kysely-codegen 0.20.0 - `pnpm db:types` regenerates `apps/service/src/db/types.ts` against a running local database
- `yaml` 2.9.1 - devDependency of `apps/service`

## Key Dependencies

- `fastify` 5.12.5 - the entire HTTP API surface; routes in `apps/service/src/routes/`
- `kysely` 0.29.6 and `pg` 8.23.0 - all application database access, always inside a user- or service-scoped transaction (`apps/service/src/db/user-db.ts`); row-level security is enforced in Postgres (`supabase/migrations/20260919070100_rls.sql`), not only in code
- `zod` 4.6.5 - validation shared by service, web, and `packages/shared`
- `web-push` 3.6.7 - Web Push; the VAPID key pair is required at startup (`apps/service/src/env.ts`)
- `node-cron` 4.6.0 - scheduled jobs: `refresh-deals`, `log-autopay`, `dispatch-notifications`, and `prune-cache`, registered in `apps/service/src/jobs/scheduler.ts` (`refresh-plan.ts` is a planner that `refresh-deals.ts` calls, not a job)
- `@fastify/rate-limit` 11.2.0 - API rate limiting
- `@supabase/supabase-js` 2.116.0 - browser sign-in, token refresh, and Realtime channels (`apps/web/src/lib/realtime/supabase-realtime.ts`)
- `@tanstack/react-query` 5.103.1 - server state and offline persistence
- `cheerio` 1.2.0 and `parse-ingredient` 3.0.0 - recipe import
- `idb-keyval` 6.2.2 - offline persistence
- `vite-plugin-pwa` 1.3.0 - installable PWA and update prompt (`apps/web/src/components/shell/UpdatePrompt.tsx`)

## Configuration

**Service runtime (validated at startup by `apps/service/src/env.ts`):**
- Read from process environment and validated by Zod; the service fails at startup on an invalid or missing variable
- Required: `DATABASE_URL`, `HEARTH_ORIGIN`, `GOTRUE_URL`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- Optional with defaults: `HOST` (`0.0.0.0`), `PORT` (`3000`), `LOG_LEVEL` (`info`), `HEARTH_TRUSTED_PROXIES`, `HEARTH_OWNER_EMAIL`, `HEARTH_RATE_LIMIT_PER_MINUTE` (`300`), `HEARTH_PUSH_TRANSPORT` (`web-push`)
- Optional: `BACKUP_DIR`, `VAPID_SUBJECT`
- E2E-only overrides (set only by the E2E Compose overlay): `HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_FLIPP_FIXTURE_NOW`, `HEARTH_RECIPE_FIXTURE_DIR`, `HEARTH_PUSH_TRANSPORT=test-double`
- The owner CLI reads only `HEARTH_ORIGIN`, `GOTRUE_URL`, and `SERVICE_ROLE_KEY` (`parseCliEnv` in `apps/service/src/env.ts`)

**Web build-time variables (Vite `import.meta.env`, baked into the bundle):**
- `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_MAGIC_LINK_ENABLED`
- Injected as Docker build args in `docker/caddy.Dockerfile`; changing them requires a rebuild
- Dev and preview proxies read `HEARTH_DEV_API` (default `http://127.0.0.1:3000`) and `HEARTH_DEV_SUPABASE` (default `http://127.0.0.1:54321`) from `apps/web/vite.config.ts`

**Host configuration:**
- The production env file lives outside the checkout at `/srv/hearth/.env`, passed to Compose with `--env-file`. `.env.example` at the repo root documents every key by name; `.gitignore` excludes `.env*` except `.env.example`.
- `scripts/generate-secrets.sh` writes that file once and refuses to overwrite it.

**Build and tooling configuration files:**
- `pnpm-workspace.yaml` (workspace graph), root `package.json`, `tsconfig.base.json` (shared TypeScript options) with per-package `tsconfig.json` in `apps/service`, `apps/web`, `packages/*`, and `e2e`
- `apps/service/tsup.config.ts` (service bundle), `apps/web/vite.config.ts` (Vite, React, Tailwind, and PWA plugins), `apps/service/vitest*.config.ts`, `e2e/playwright.config.ts`
- `eslint.config.js`, `.prettierrc.json`, `commitlint.config.js`, `.lintstagedrc.json`, `knip.json`
- `supabase/config.toml` - local Supabase CLI stack (Postgres major version 17, Realtime enabled, GoTrue auth with `site_url` `http://127.0.0.1:5173`, API gateway disabled)
- `.github/dependabot.yml` - weekly updates for npm, GitHub Actions, and Docker images

## Platform Requirements

**Development:**
- Node.js 24 and pnpm 10.34.5 (via corepack)
- Supabase CLI 2.117.0 for `supabase start` and `supabase db reset` (CI pins the same version)
- `psql` on PATH for `pnpm db:seed`
- Docker with the Compose plugin for the full stack and the E2E overlay `e2e/docker-compose.e2e.yml`
- Playwright Chromium: `pnpm --filter @hearth/e2e exec playwright install --with-deps chromium`

**Production:**
- Single Linux host running the Compose stack in `docker/docker-compose.yml`
- Only the `caddy` service publishes a port, bound to `127.0.0.1:8080`; public ingress is Tailscale Funnel (`sudo tailscale funnel --bg http://127.0.0.1:8080`), origin `https://<machine>.<tailnet>.ts.net`
- A second disk mounted at `BACKUP_DIR`
- Self-hosted GitHub Actions runner with labels `self-hosted, hearth`, running as a user in the `docker` group (`.github/workflows/deploy.yml`)

## Container Images

| Service | Image | Source | Notes |
|---------|-------|--------|-------|
| `db` | `public.ecr.aws/supabase/postgres:17.6.1.167` | `docker/docker-compose.yml` | Postgres 17 (Supabase build) |
| `auth` | `public.ecr.aws/supabase/gotrue:v2.196.0` | `docker/docker-compose.yml` | Supabase GoTrue auth server |
| `realtime` | `public.ecr.aws/supabase/realtime:v2.130.0` | `docker/docker-compose.yml` | Supabase Realtime (WebSocket change feed) |
| `kong` | `kong/kong:3.9.3` | `docker/docker-compose.yml`, config `docker/kong.yml` | API gateway for GoTrue and Realtime |
| `hearth-service` | `hearth-service:${HEARTH_TAG}` | built from `docker/service.Dockerfile` | The Fastify service |
| `caddy` | `hearth-caddy:${HEARTH_TAG}` | built from `docker/caddy.Dockerfile`, final stage `caddy:2.11.7-alpine`, config `docker/Caddyfile` | Static PWA plus reverse proxy |
| `backup` | `prodrigestivill/postgres-backup-local:17-debian-d257e5d` | `docker/docker-compose.yml` | Daily dump at `0 2 * * *`; keeps 14 days, 8 weeks, 6 months |

## Database

- PostgreSQL 17 (`supabase/config.toml` `major_version = 17`)
- Migrations: `supabase/migrations/` (8 files; `20260919060000_hearth_service_role.sql` through `20261004090100_depart_clears_notification_preferences.sql`)
- Typed schema: `apps/service/src/db/types.ts` (generated by `kysely-codegen`, committed)
- Login role used by the service: `hearth_service` (NOINHERIT; the password is supplied through `HEARTH_SERVICE_DB_PASSWORD`, applied by `docker/db/hearth-service-login.sql`)

## CI/CD Toolchain

- `.github/workflows/ci.yml` - jobs `lint` (lint and format check), `typecheck`, `test-unit`, `test-integration` (Supabase CLI start, then `test:coverage`), `test-e2e` (Playwright, pull requests and `main`), and `build`; all on GitHub-hosted runners
- `.github/actions/setup/action.yml` - composite action every job runs after checkout: `pnpm/action-setup@v6`, `actions/setup-node@v7` (Node from `.nvmrc`, pnpm store cached), `pnpm install --frozen-lockfile`
- `.github/workflows/deploy.yml` - triggered by `workflow_run` after a successful push-triggered CI run on `main`; runs on the self-hosted runner labelled `self-hosted, hearth`; executes `scripts/deploy.sh` unless only `docs/` changed
- Actions: `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `supabase/setup-cli@v3`, `docker/login-action@v4`, `actions/upload-artifact@v7`
- `scripts/ci-prepull-images.sh` - pre-pulls the Compose and Dockerfile images for the E2E job

---

*Stack analysis: 2026-10-22*
