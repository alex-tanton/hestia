<!-- GSD:project-start source:PROJECT.md -->

## Project

**Hestia — Cleanup and Hardening**

Hestia is a household-management PWA (shopping lists, chores, bills, meals/recipes, deals, notifications) for a single household, built as a React + Vite PWA and a Fastify service over Postgres/Supabase with RLS as the isolation boundary. The application was built largely with an LLM. This milestone is a cleanup pass: remove dead code, generated and leftover files, and redundancy, and make the repo, CI, and code healthier and more robust before the owner does a manual review.

**Core Value:** The owner can start a manual review from a lean, trustworthy base: no dead code or stray generated files, a CI suite that passes repeatably regardless of day or timezone, and the known bugs fixed with regression tests.

### Constraints

- **Behavior**: Existing application behavior must not change except where fixing a documented bug — cleanup must be safe
- **Evidence**: Dead-code removal requires tooling or test proof; ambiguous cases are reported, not deleted
- **Verification**: Every bug fix ships with a regression test; full suite and CI must remain green
- **Tech stack**: Existing stack (pnpm, TypeScript, Fastify, React/Vite, Postgres/Supabase, Playwright) — no framework migrations
- **Git**: `main` is curated and published (Phase 1, `origin/main` from d3da748), and every push to it runs CI, and a passing run deploys unless only `docs/` and `.planning/` changed since the running revision (`scripts/deploy-gate.sh`). Work on branches or worktrees and land changes through pull requests per `CONTRIBUTING.md`; never force-push or rewrite published history without the owner's approval
- **Docs**: Specs in `docs/` are the only source of truth; no review, decision-log, or ADR files are added there

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 6.0.3 (`typescript` devDependency in the root and every workspace) - all application code: `apps/service/src/`, `apps/web/src/`, `packages/*/src/`, `e2e/`, `supabase/seed/`
- TSX - React screens and components in `apps/web/src/components/`, `apps/web/src/screens/`, `apps/web/src/pillars/`
- SQL (PostgreSQL dialect) - schema, RLS, and functions in `supabase/migrations/*.sql` (8 files, applied in filename order)
- HTML and CSS - `apps/web/index.html`, `apps/web/src/index.css` (Tailwind CSS v4)
- POSIX shell - `scripts/deploy.sh`, `scripts/deploy-gate.sh`, `scripts/generate-secrets.sh`, `scripts/ci-prepull-images.sh`, `docker/caddy-entrypoint.sh`, `docker/kong-entrypoint.sh`, and the CLI wrapper `apps/service/bin/hestia-admin` (a hand-written `sh` script that `exec`s `node dist/cli.js`; it is not a build output)
- Node ESM `.mjs` - `apps/web/scripts/check-build.mjs`, `apps/web/scripts/generate-icons.mjs`, `test/clock-setup.mjs`, `test/global-tz.mjs`, `scripts/test-sweep.mjs`, `scripts/knip-summary.mjs`, and the CI gate scripts `scripts/check-knip-baseline.mjs`, `scripts/check-repo-hygiene.mjs`, `scripts/check-migrations-append-only.mjs`, `scripts/audit-prod.mjs`

## Runtime

- Node.js 24 - `.nvmrc` contains `24`; root `package.json` `engines` is `>=24 <25`
- Container base image: `node:24.21.0-bookworm-slim` in `docker/service.Dockerfile` (all stages) and in the build stage of `docker/caddy.Dockerfile`
- Browser target: evergreen browsers, installed as a PWA (`apps/web/vite.config.ts`, `vite-plugin-pwa`)
- pnpm 10.34.5 - pinned by the `packageManager` field in `package.json`; activated with `corepack enable` in the Dockerfiles and `pnpm/action-setup@v6` in CI (`.github/actions/setup/action.yml`)
- Workspace definition: `pnpm-workspace.yaml` (packages `apps/*`, `packages/*`, `e2e`, `supabase/seed`); `saveExact: true`; `onlyBuiltDependencies: [esbuild]`
- Lockfile: present - `pnpm-lock.yaml`. CI and Docker builds use `--frozen-lockfile`.
- Dependency override: `esbuild` forced to `0.28.2` in root `package.json` `pnpm.overrides`
- Peer-dependency exception: `allowedVersions` in `pnpm-workspace.yaml` permits `eslint-plugin-jsx-a11y` to peer on ESLint 10

| Package | Path | Role |
|---------|------|------|
| `@hestia/service` | `apps/service` | Fastify HTTP API, job scheduler, owner CLI |
| `@hestia/web` | `apps/web` | React PWA (Vite) |
| `@hestia/shared` | `packages/shared` | Shared Zod request and response schemas, problem and error types, scrubbing, password rules |
| `@hestia/matching` | `packages/matching` | Ingredient and item fuzzy matching |
| `@hestia/recurrence` | `packages/recurrence` | Bill and chore recurrence logic |
| `@hestia/e2e` | `e2e` | Playwright end-to-end suite |
| `@hestia/seed` | `supabase/seed` | Seed-user, seed-SQL, and pantry-readiness tooling |

## Frameworks

- Fastify 5.12.5 - HTTP server; app factory `apps/service/src/app.ts`, entry point `apps/service/src/main.ts`
- `@fastify/rate-limit` 11.2.0 - per-IP limit on `/api/*`; default 300 per minute from `apps/service/src/env.ts` (`HESTIA_RATE_LIMIT_PER_MINUTE`)
- Zod 4.6.5 - environment and request validation (`apps/service/src/env.ts`)
- Kysely 0.29.6 over `pg` 8.23.0 - typed query builder; pool in `apps/service/src/db.ts`; generated types in `apps/service/src/db/types.ts`
- node-cron 4.6.0 - in-process scheduler (`apps/service/src/jobs/scheduler.ts`)
- cheerio 1.2.0 - HTML parsing for recipe import (`apps/service/src/recipes/json-ld.ts`, `apps/service/src/recipes/fetch-recipe.ts`)
- parse-ingredient 3.0.0 - recipe ingredient parsing (`apps/service/src/recipes/ingredient-parser.ts`)
- web-push 3.6.7 - VAPID-signed Web Push delivery (`apps/service/src/push/web-push-transport.ts`, typed in `apps/service/src/push/web-push.d.ts`)
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
- `@hestia/shared` (`packages/shared`) - Zod 4.6.5 request and response schemas
- `@hestia/recurrence` (`packages/recurrence`) - `@date-fns/tz` 1.5.0 and date-fns 4.4.0
- `@hestia/matching` (`packages/matching`) - fastest-levenshtein 1.0.16
- `@hestia/seed` (`supabase/seed`) - `@hestia/matching` and `pg` 8.23.0
- tsup 8.5.1 - bundles the service to `apps/service/dist/` (`apps/service/tsup.config.ts`); `apps/service/src/write-openapi.ts` runs after it in `build`
- tsx 4.23.13 - runs TypeScript directly for `dev`, the seed tooling, and fixture scripts
- Vitest 5.0.1 - unit and integration tests in every workspace (`apps/service/vitest.config.ts`, `vitest.integration.config.ts`, `vitest.coverage.config.ts`; `apps/web/vite.config.ts` test block). Every unit config (and the service coverage config) loads `test/clock-setup.mjs` as a setup file, which pins `Date`, and `test/global-tz.mjs` as `globalSetup`, which validates `TZ`; the integration config loads only `global-tz.mjs`. `pnpm test:sweep` and `pnpm test:sweep:integration` (`scripts/test-sweep.mjs`) run the suites across a fixed date and time-zone matrix; see `docs/testing.md`
- `@vitest/coverage-v8` 5.0.1 - coverage in `apps/service`, `apps/web`, and `packages/*`
- jsdom 30.1.0 - DOM environment for `apps/web`
- @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 7.0.1, @testing-library/user-event 14.6.7 - component tests
- `@playwright/test` 1.63.0 and `@axe-core/playwright` 4.13.0 - E2E and accessibility (`e2e/playwright.config.ts`, which pins the browser to `America/New_York` and `en-US`)
- Supabase CLI 2.117.0 (`supabase/setup-cli@v3` in CI) - local Postgres, GoTrue, and Realtime stack for the integration tests; the E2E job uses it to apply migrations
- Test harness uses `node --test` for the root harness tests (`package.json` `test:harness`)
- ESLint 10.11.0 with `typescript-eslint` 8.70.0, `@eslint/js` 10.0.1, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-jsx-a11y` 6.10.2, `eslint-config-prettier` 10.1.8, `globals` 17.12.0 - config in `eslint.config.js`
- Prettier 3.9.8 - `.prettierrc.json`, ignores in `.prettierignore`
- Husky 9.1.7 and lint-staged 17.5.1 - hooks in `.husky/pre-commit` and `.husky/commit-msg`; `.lintstagedrc.json`
- `@commitlint/cli` and `@commitlint/config-conventional` 21.2.2 - `commitlint.config.js`
- knip 6.41.0 - unused-code scan; config `knip.json`; run with `pnpm knip` or `pnpm knip:production`. CI's `hygiene` job blocks on `pnpm knip` (zero findings) and on `node scripts/check-knip-baseline.mjs` (production findings must equal `scripts/knip-production-baseline.txt`)
- jscpd 5.4.1 - duplicate-code scan; config `.jscpd.json` (test files included, 2% limit); run with `pnpm jscpd`, which CI's `hygiene` job also runs
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

- Read from process environment and validated by Zod; the service fails at startup on an invalid or missing variable
- Required: `DATABASE_URL`, `HESTIA_ORIGIN`, `GOTRUE_URL`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- Optional with defaults: `HOST` (`0.0.0.0`), `PORT` (`3000`), `LOG_LEVEL` (`info`), `HESTIA_TRUSTED_PROXIES`, `HESTIA_OWNER_EMAIL`, `HESTIA_RATE_LIMIT_PER_MINUTE` (`300`), `HESTIA_PUSH_TRANSPORT` (`web-push`)
- Optional: `BACKUP_DIR`, `VAPID_SUBJECT`
- `CLOUDFLARE_TUNNEL_TOKEN` is Compose-only: `cloudflared` reads it, the service does not
- E2E-only overrides (set only by the E2E Compose overlay): `HESTIA_FLIPP_FIXTURE_DIR`, `HESTIA_FLIPP_FIXTURE_NOW`, `HESTIA_RECIPE_FIXTURE_DIR`, `HESTIA_PUSH_TRANSPORT=test-double`
- The owner CLI reads only `HESTIA_ORIGIN`, `GOTRUE_URL`, and `SERVICE_ROLE_KEY` (`parseCliEnv` in `apps/service/src/env.ts`)
- Client variables: `HESTIA_PUBLIC_MAGIC_LINK_ENABLED`, `HESTIA_PUBLIC_SUPABASE_ANON_KEY`, `HESTIA_PUBLIC_VAPID_KEY` (with legacy `VITE_*` fallbacks), validated via typed `parseClientConfig` in `@hestia/shared/config`
- Injected as Docker build args in `docker/caddy.Dockerfile`; changing them requires a rebuild
- Dev and preview proxies read `HESTIA_DEV_API` (default `http://127.0.0.1:3000`) and `HESTIA_DEV_SUPABASE` (default `http://127.0.0.1:54321`) from `apps/web/vite.config.ts`
- The production env file lives outside the checkout at `/srv/hestia/.env`, passed to Compose with `--env-file`. `.env.example` at the repo root documents every key by name; `.gitignore` excludes `.env*` except `.env.example`.
- `scripts/generate-secrets.sh` writes that file once and refuses to overwrite it.
- `pnpm-workspace.yaml` (workspace graph), root `package.json`, `tsconfig.base.json` (shared TypeScript options) with per-package `tsconfig.json` in `apps/service`, `apps/web`, `packages/*`, and `e2e`
- `apps/service/tsup.config.ts` (service bundle), `apps/web/vite.config.ts` (Vite, React, Tailwind, and PWA plugins), `apps/service/vitest*.config.ts`, `e2e/playwright.config.ts`
- `eslint.config.js`, `.prettierrc.json`, `commitlint.config.js`, `.lintstagedrc.json`, `knip.json`
- `supabase/config.toml` - local Supabase CLI stack (Postgres major version 17, Realtime enabled, GoTrue auth with `site_url` `http://127.0.0.1:5173`, API gateway disabled)
- `.github/dependabot.yml` - weekly updates for npm, GitHub Actions, and Docker images

## Platform Requirements

- Node.js 24 and pnpm 10.34.5 (via corepack)
- Supabase CLI 2.117.0 for `supabase start` and `supabase db reset` (CI pins the same version)
- `psql` on PATH for `pnpm db:seed`
- Docker with the Compose plugin for the full stack and the E2E overlay `e2e/docker-compose.e2e.yml`
- Playwright Chromium: `pnpm --filter @hestia/e2e exec playwright install --with-deps chromium`
- Single Linux host running the Compose stack in `docker/docker-compose.yml`
- No service publishes a host port. Public ingress is a remotely-managed Cloudflare Tunnel: the `cloudflared` service, with its token `CLOUDFLARE_TUNNEL_TOKEN` in `/srv/hestia/.env`, routes `hestia.aberrance.app` to `http://caddy:8080`. The origin is `https://hestia.aberrance.app`
- A second disk mounted at `BACKUP_DIR`
- Self-hosted GitHub Actions runner with labels `self-hosted, hestia`, running as a user in the `docker` group (`.github/workflows/deploy.yml`)

## Container Images

| Service | Image | Source | Notes |
|---------|-------|--------|-------|
| `db` | `public.ecr.aws/supabase/postgres:17.6.1.167` | `docker/docker-compose.yml` | Postgres 17 (Supabase build) |
| `auth` | `public.ecr.aws/supabase/gotrue:v2.196.0` | `docker/docker-compose.yml` | Supabase GoTrue auth server |
| `realtime` | `public.ecr.aws/supabase/realtime:v2.130.0` | `docker/docker-compose.yml` | Supabase Realtime (WebSocket change feed) |
| `kong` | `kong/kong:3.9.3` | `docker/docker-compose.yml`, config `docker/kong.yml` | API gateway for GoTrue and Realtime |
| `hestia-service` | `hestia-service:${HESTIA_TAG}` | built from `docker/service.Dockerfile` | The Fastify service |
| `caddy` | `hestia-caddy:${HESTIA_TAG}` | built from `docker/caddy.Dockerfile`, final stage `caddy:2.11.7-alpine`, config `docker/Caddyfile` | Static PWA plus reverse proxy; resolves the client address from `CF-Connecting-IP`, trusted only from the Compose subnet |
| `cloudflared` | `cloudflare/cloudflared:2026.10.3` | `docker/docker-compose.yml` | Tunnel connector; token from `CLOUDFLARE_TUNNEL_TOKEN`; never started in E2E |
| `backup` | `prodrigestivill/postgres-backup-local:17-debian-d257e5d` | `docker/docker-compose.yml` | Daily dump at `0 2 * * *`; keeps 14 days, 8 weeks, 6 months |

## Database

- PostgreSQL 17 (`supabase/config.toml` `major_version = 17`)
- Migrations: `supabase/migrations/` (8 files; `20260919060000_hestia_service_role.sql` through `20261004090100_depart_clears_notification_preferences.sql`)
- Typed schema: `apps/service/src/db/types.ts` (generated by `kysely-codegen`, committed)
- Login role used by the service: `hestia_service` (NOINHERIT; the password is supplied through `HESTIA_SERVICE_DB_PASSWORD`, applied by `docker/db/hestia-service-login.sql`)

## CI/CD Toolchain

- `.github/workflows/ci.yml` - seven jobs, each with a timeout: `lint` (lint and format check), `typecheck`, `test-unit` (harness tests, the non-web workspaces' tests, then web `test:coverage` with thresholds), `test-integration` (Supabase CLI start, then `test:coverage`, and a step that fails when `apps/service/src/db/types.ts` differs from `pnpm db:types`), `test-e2e` (Playwright, pull requests and `main`), `build`, and `hygiene` (`pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `node scripts/audit-prod.mjs`, `node scripts/check-repo-hygiene.mjs` and `node scripts/check-migrations-append-only.mjs`, each as its own step); all on GitHub-hosted runners
- `.github/actions/setup/action.yml` - composite action every job runs after checkout: `pnpm/action-setup@v6`, `actions/setup-node@v7` (Node from `.nvmrc`, pnpm store cached), `pnpm install --frozen-lockfile`
- `.github/workflows/sweep.yml` - workflow `Sweep`: the date and time-zone test matrix on pushes to `main` that change more than `docs/` and `.planning/`, nightly (with the day-dependent cell), and on demand; it never gates a merge or a deploy
- `.github/workflows/deploy.yml` - triggered by `workflow_run` after a successful push-triggered CI run on `main`; runs on the self-hosted runner labelled `self-hosted, hestia`; decides through `scripts/deploy-gate.sh` (compares with the running revision), then executes `scripts/deploy.sh`
- Actions: `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `supabase/setup-cli@v3`, `docker/login-action@v4`, `actions/upload-artifact@v7`
- `scripts/ci-prepull-images.sh` - pre-pulls the Compose and Dockerfile images for the E2E job

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Service and package modules are kebab-case `.ts`: `apps/service/src/services/bills.ts`, `apps/service/src/chores/occurrence.ts`, `apps/service/src/deals/flipp/request-queue.ts`, `packages/recurrence/src/bills.ts`.
- React components are PascalCase `.tsx` named after the component: `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/bills/BillRow.tsx`, `apps/web/src/screens/bills/BillDetailScreen.tsx`.
- Other web modules are kebab-case `.ts`: `apps/web/src/lib/format.ts`, `apps/web/src/lib/offline/write-queue.ts`.
- Web hooks are `use-*.ts(x)` (`apps/web/src/lib/use-online-status.ts`, `apps/web/src/components/chores/use-chore-completion.ts`). The API hook modules are `*-hooks.ts` (`apps/web/src/lib/api/bills-hooks.ts`, `apps/web/src/lib/api/list-hooks.ts`).
- Copy catalogs sit next to their feature as `*-copy.ts` (`apps/web/src/components/bills/bills-copy.ts`, `apps/web/src/components/chores/chore-copy.ts`, `apps/web/src/screens/deals/deal-copy.ts`).
- Screens are `*Screen.tsx` under `apps/web/src/screens/<feature>/`. Route wrappers are `*Route.tsx` (`apps/web/src/screens/settings/SettingsRoute.tsx`, `apps/web/src/pillars/bills/BillsRoute.tsx`).
- Route plugins: one file per resource in `apps/service/src/routes/` (`bills.ts`, `chores.ts`, `meal-plan.ts`).
- Migrations: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`.
- Tests: `<name>.test.ts(x)` co-located with the module, or `<name>.integration.test.ts` for database and route tests against `supabase start`. Test helpers live in `apps/service/src/test/` and `apps/web/src/test/`.
- Test time: unit and component tests run with `Date` pinned to `2026-10-14T12:00:00.000Z` (`HESTIA_TEST_NOW` overrides it), and ESLint `no-restricted-syntax` bans bare `new Date()` and `Date.now()` in test files and test helpers. Do not set `TZ` by hand: set it only through the sweep or an `env` object passed to a spawned process, and never force `TZ=UTC` for a whole suite; see "Dates and time zones" in `docs/testing.md`.
- camelCase. Service and domain functions are verbs: `listBills`, `createHouseholdBill`, `payBill`, `archiveBill` in `apps/service/src/services/bills.ts`.
- Pure planners return a plan object: `planBillMove` in `apps/service/src/services/bills.ts`.
- Pure bill helpers: `currentBillOccurrence` in `packages/recurrence/src/bills.ts`; `billOccurrence` and `planBillMove` in `apps/service/src/services/bills.ts`.
- Query-key factories live in `apps/web/src/lib/api/keys.ts` (`queryKeys.bills(householdId)`).
- React components are PascalCase function declarations with an explicit return type: `export function Button({...}: ButtonProps): ReactElement` in `apps/web/src/components/ui/Button.tsx`.
- camelCase locals.
- Module-level constants are SCREAMING_SNAKE_CASE: `PROBLEM_CONTENT_TYPE` (`packages/shared/src/problem.ts`), `SCRUBBED_MESSAGE_MAX_LENGTH` (`packages/shared/src/scrub.ts`), `DATABASE_PROBLEMS` (a non-exported table in `apps/service/src/problem.ts`), `BUTTON_BASE` and `VARIANT_CLASSES` (`apps/web/src/components/ui/Button.tsx`), `DASHBOARD_EMPTY_COPY` (`apps/web/src/components/dashboard/DashboardCards.tsx`), `FIRST_RUN_HEADING` (`apps/web/src/components/dashboard/DashboardFirstRun.tsx`).
- Lookup tables are typed `Readonly<Record<...>>`.
- Zod schemas are camelCase with a `Schema` suffix; the type is the inferred PascalCase name: `billSchema` and `type Bill = z.infer<typeof billSchema>` in `packages/shared/src/api/bills.ts`.
- Request and path-param schemas follow the same pair: `createBillRequestSchema`, `billIdParamsSchema`.
- Props interfaces are `<Component>Props` (`ButtonProps`), exported when tests or siblings need them (`DashboardScreenProps`).
- Use string-union types over enums: `export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';` in `apps/web/src/components/ui/Button.tsx`. Zod enums are `z.enum([...])`, then inferred (`billVisibilitySchema`).
- Database columns and raw rows are snake_case (`recurrence_unit`, `anchor_date`). API and shared-layer fields are camelCase (`recurrenceUnit`, `anchorDate`). The mapping happens in one layer (see `docs/architecture.md`). Service code that works with raw rows uses snake_case field names (`apps/service/src/services/bills.test.ts`).
- `apps/service/src/db/types.ts` is generated by kysely-codegen (`pnpm db:types`). It is excluded from ESLint and must not be hand-edited.

## Code Style

- Prettier 3 with `.prettierrc.json`: `"singleQuote": true`, `"printWidth": 100`. Trailing commas, semicolons, and 2-space indent are Prettier defaults.
- `.prettierignore` lists the non-source paths. CI enforces formatting with `pnpm format:check` (`.github/workflows/ci.yml`, `lint` job).
- Long union types and call arguments wrap one item per line. JSX props wrap one per line.
- ESLint flat config at `eslint.config.js`: `js.configs.recommended`, `tseslint.configs.strictTypeChecked`, and `stylisticTypeChecked`, plus `eslint-config-prettier` last.
- Web files (`apps/web/**/*.{ts,tsx}`) add `eslint-plugin-jsx-a11y` (strict) and `eslint-plugin-react-hooks` (recommended).
- Rules set explicitly: `@typescript-eslint/explicit-module-boundary-types` (error) and `@typescript-eslint/no-non-null-assertion` (error, off in test files).
- `pnpm lint` runs `eslint --max-warnings=0 .`. Warnings fail the run. It runs in CI and in the pre-commit hook.
- Service-role fence (`eslint.config.js`): under `apps/service/src/**/*.ts`, value imports of `privileged/` are errors (type-only imports are allowed). `main.ts`, `cli.ts`, `privileged/**`, and test code are exempt. A dynamic `import()` of `privileged` is also an error.
- Clock fence (`eslint.config.js`): `no-restricted-syntax` bans real-clock reads in test files, `e2e/`, `apps/service/src/test/**`, `apps/web/src/test/**`, `apps/web/src/test-setup.ts`, and `test/**/*.mjs` (see `docs/testing.md`, "Dates and time zones").
- `tsconfig.base.json` is strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.
- Run with `pnpm typecheck` (`pnpm -r --parallel typecheck`).
- Optional props use `?` with `exactOptionalPropertyTypes` in mind: `disabledReason?: string | undefined` in `apps/web/src/components/ui/Button.tsx`.
- Lint suppression directives in source, tests, and E2E: five real `eslint-disable-next-line` comments. `apps/service/src/cli.test.ts:65` (`prefer-promise-reject-errors`); `apps/service/src/test/zone-dates.ts:15`, `apps/service/src/deals/flipp/request-queue.test.ts` (two, lines 27 and 174), and `e2e/support/clock.ts:12` (all `no-restricted-syntax`, clock reads). Four carry a `-- reason`; the `cli.test.ts` one states its reason in the comment line above it.
- `as any` does not appear in `apps/*/src` or `packages/*/src`. `strictTypeChecked` forbids explicit `any`.
- Double casts (`as unknown as`) appear in production code only in `apps/service/src/services/deals/storage.ts` (two uses of `as unknown as DealRow[]`). Test code uses more of them, mostly to hand a stub to a typed port (`apps/web/src/lib/realtime/supabase-realtime.test.ts`). Prefer a narrowed type or a Zod `parse()` over `as`.
- Do not add new `as` casts to production code without a reason in the review.
- ESM everywhere (`"type": "module"`).
- Service and packages use NodeNext resolution: relative imports end in `.js` even though the source is `.ts`. Example: `import { ProblemError } from '../problem.js';` in `apps/service/src/services/bills.test.ts`.
- Web uses Bundler resolution with explicit `.ts` and `.tsx` extensions: `import { useApi } from './api-context.tsx';` in `apps/web/src/lib/api/bills-hooks.ts`, enabled by `allowImportingTsExtensions`. Example: `apps/web/src/test/harness.tsx` imports `../App.tsx`.
- Type-only imports use `import type`. Mixed imports inline the modifier: `import { x, type Y }` (`apps/web/src/components/ui/Button.tsx`).

## Import Organization

- Third-party packages first (`@tanstack/...`, `@testing-library/...`, `react`, `react-router`, `fastify`, `vitest`), then workspace packages (`@hestia/shared`), then relative imports, parent directories before siblings.
- This order is a convention, not enforced by ESLint. No import-order rule is configured.
- None. Cross-package imports use the `@hestia/*` workspace names (`pnpm-workspace.yaml`). Within an app, imports are relative.
- Each package exports from `packages/*/src/index.ts`. `packages/shared/src/index.ts` is a pure re-export barrel that re-exports the `api/*` modules; consumers import from `@hestia/shared`.
- `apps/service/src/jobs/index.ts` is also a barrel. Inside an app, prefer the defining file over a barrel.

## Error Handling

- Errors are RFC 9457 problem details (`type`, `title`, `status`, `detail`), never bare strings. `problem(status, detail?)` builds the body and `fail(status, detail?)` throws a `ProblemError`. Both are in `apps/service/src/problem.ts`.
- The global error handler in `apps/service/src/app.ts` sends a `ProblemError` unchanged. For 5xx responses it logs the error with `scrubErrorName` and `scrubErrorText` (from `@hestia/shared`) applied to the name and message, not the raw values.
- Validate at the route boundary with `parse(schema, value)` from `apps/service/src/http/context.ts`. It throws a 400 `fail` with detail `"<path>: <message>"`.
- Database errors map by SQLSTATE in the `DATABASE_PROBLEMS` table in `apps/service/src/problem.ts` (for example `42501` to 403, `23505` to 409, `HR001` to 410). Add new membership or constraint messages there, not in route code. `problemFromDatabaseError` performs the lookup.
- Route handlers stay thin: authenticate, `parse`, call a service function inside `ctx.inHousehold(...)` or `ctx.asUser(...)`, then return or `reply.code(201).send(...)`. Route files call `parse(` about 119 times across `apps/service/src/routes/`.
- Business-rule violations throw `ProblemError` or `fail` with a caller-facing message. Example: `apps/service/src/services/bills.test.ts` asserts `ProblemError` for an invalid visibility move.
- Server errors are recorded with `buildErrorRecord` and `recordAppError` (`apps/service/src/services/errors.ts`). Names, messages, and routes are scrubbed first (`scrubErrorReport` in `packages/shared/src/scrub.ts`).
- The API client in `apps/web/src/lib/api/client.ts` throws `ApiError` (status 0 for network failures).
- Problem bodies are parsed by `apps/web/src/lib/api/problem.ts`. Show them through `FormMessage` (`apps/web/src/components/ui/FormMessage.tsx`) or `Toast` (`apps/web/src/components/ui/Toast.tsx`).
- Field-level validation uses `apps/web/src/lib/use-field-errors.ts` and `apps/web/src/lib/validation.ts`.
- Render-time crashes are caught by `apps/web/src/components/states/ErrorBoundary.tsx` and the router's error element.
- Offline-queueable writes (list items, chore and errand writes) go through `apps/web/src/lib/offline/write-queue.ts`. Other writes are ordinary online mutations that disable their controls while offline.
- Scheduled jobs live in `apps/service/src/jobs/*.ts` and are driven by `apps/service/src/jobs/scheduler.ts`; `apps/service/src/jobs/advisory-lock.ts` provides the Postgres advisory-lock helper the scheduler uses to guard against overlap.

## Logging

- Service logging uses the Fastify request logger: `request.log.error(...)` in the global error handler in `apps/service/src/app.ts`. Do not log raw request bodies or secrets.
- `console.*` does not appear in `apps/*/src`, `packages/*/src`, or `e2e/`. Verified by search. Only tooling scripts (`scripts/`, `test/`, `apps/*/scripts/`, `supabase/seed/`) use `console`, including the test clock hook `test/global-tz.mjs`. Do not add `console.*` to shipped code.
- The test app in `apps/service/src/test/fake-app.ts` is built with `logger: false`.

## Comments

- Explain why, not what. Do not cite sections of retired spec documents; state the rule itself. Comments state the invariant or the non-obvious constraint behind the code.
- Module-level block comments (`/* ... */` or `/** ... */`) open files that carry a rule set or a contract, such as `apps/web/src/test/harness.tsx` and `apps/service/src/services/bills.test.ts`.
- Document invariants with the reason, for example the opacity floors in `apps/web/src/components/ui/Button.tsx` (the 95% and 97% values exist because of measured WCAG AA contrast), or why the service role is fenced in `eslint.config.js`.
- JSDoc (`/** */`) goes on exported functions and types whose contract is not obvious from the signature, for example `errorFingerprint` in `apps/service/src/services/errors.ts` and `ProblemError` in `apps/service/src/problem.ts`. It is not required on every export.
- A single-line `//` comment that exists to suppress a lint rule must carry a reason after `--`: `// eslint-disable-next-line no-restricted-syntax -- reason`.

## Function Design

- Service functions take the scoped database handle first, then IDs, then a validated body: `createHouseholdBill(db, id, user.id, body)` in `apps/service/src/services/bills.ts`.
- Components take one typed props object: `<DashboardCard pillar="bills" title="Bills" state={state} />`.
- Exported functions have explicit return types. Async service functions return `Promise<T>`.
- Prefer returning a value to mutating an argument. Pure planners return a plan object.

## Module Design

- Named exports only (web components too: `export function Button`). Outside declaration files, `export default` appears only where a runner requires it: `e2e/playwright.config.ts`, `e2e/global-setup.ts`, and `e2e/global-teardown.ts`. The one declaration file that uses it is `apps/service/src/push/web-push.d.ts`.
- Route plugins are `FastifyPluginAsync<{ ctx: RouteContext }>` values named `billRoutes`, `choreRoutes`, and so on, wired in `apps/service/src/app.ts`.
- `packages/*/src/index.ts` files are re-export barrels. Do not add logic to them. `packages/matching/vitest.config.ts` and `packages/shared/vitest.config.ts` exclude the barrel from coverage for that reason.
- Server state is in TanStack Query hooks under `apps/web/src/lib/api/` (`useBills`, `useBill`), keyed by `queryKeys` from `apps/web/src/lib/api/keys.ts`.
- Ambient state is in React context providers (`apps/web/src/lib/api/api-context.tsx`, `apps/web/src/lib/section-context.tsx`, `apps/web/src/components/ui/Toast.tsx`). Dependencies such as the auth client and realtime port are injected through interfaces (`AuthClient`, `RealtimePort`, `PushPort`).
- Styling is Tailwind CSS 4 utilities composed with `cn()` from `apps/web/src/lib/cn.ts`; design tokens are in `apps/web/src/index.css` and checked by `apps/web/src/tokens.test.ts`. Variant maps are `Record<Variant, string>` constants. Touch targets use `min-h-11 min-w-11` in shared primitives.

## Patterns for New Code

- New service endpoint: add the request and response schemas in `packages/shared/src/api/`, a service function in `apps/service/src/services/`, and a route in `apps/service/src/routes/` that calls `parse` and the service inside `ctx.inHousehold` or `ctx.asUser`. Register the plugin in `apps/service/src/app.ts`.
- New database error message: add it to `DATABASE_PROBLEMS` in `apps/service/src/problem.ts`.
- Never import from `apps/service/src/privileged/` in routes, services, or jobs.
- New test: co-located, Vitest, `it.each` for table cases. Read time only from the pinned clock or an explicit instant (see `docs/testing.md`, "Dates and time zones").

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Service bootstrap | Reads env, builds the Flipp, recipe, and push clients, builds the Fastify app, starts the scheduler, handles SIGTERM and SIGINT | `apps/service/src/main.ts` |
| App assembly | Error handler, global rate limit, registers every route plugin (every route lives under `/api`) | `apps/service/src/app.ts` |
| Env validation | Zod parse of process env; fails startup on a missing or invalid value; `parseCliEnv` for the owner CLI | `apps/service/src/env.ts` |
| Route context | Bearer-token authentication, `asUser` / `inHousehold` helpers that wrap `withUserDb` | `apps/service/src/http/context.ts` |
| RLS transaction wrapper | Opens a transaction, `set local role authenticated`, installs JWT claims; `withAnonDb` for error recording | `apps/service/src/db/user-db.ts` |
| Database pool | Kysely over `pg`, connects as `hestia_service` | `apps/service/src/db.ts`, `apps/service/src/db/types.ts` (generated) |
| Routes | Thin HTTP layer per feature: parse input with shared schemas, call a service, shape the reply | `apps/service/src/routes/*.ts` |
| Services | Business rules per feature (recurrence, repricing, readiness, membership, invites, notifications); chores and errands sit in a sibling folder | `apps/service/src/services/*.ts`, `apps/service/src/services/deals/`, `apps/service/src/chores/*.ts`, `apps/service/src/notifications/*.ts` |
| Jobs | Cron-driven work: deal refresh, autopay logging, notification dispatch, cache pruning (four scheduled jobs; `refresh-plan.ts` is a planner that `refresh-deals.ts` calls, not a job) | `apps/service/src/jobs/*.ts` |
| Scheduler | Registers the node-cron tasks; wraps each run in an advisory lock | `apps/service/src/jobs/scheduler.ts`, `apps/service/src/jobs/advisory-lock.ts` |
| Privileged access | The only `service_role` code: notification outbox, GoTrue admin, job DB, system health, scheduled reminders | `apps/service/src/privileged/*.ts` |
| Auth verification | Verifies the bearer token's signature and expiry (HS256 with `JWT_SECRET`; ES256 only for a key GoTrue publishes at its JWKS endpoint, as `supabase start` does); GoTrue HTTP client | `apps/service/src/auth/jwt.ts`, `apps/service/src/gotrue/client.ts` |
| Deals source | Flipp HTTP client behind one rate-limited request queue, with a fixture transport for E2E | `apps/service/src/deals/flipp/*.ts`, `apps/service/src/deals/deal-source.ts` |
| Recipe import | Fetches a pasted URL server-side, extracts JSON-LD, parses ingredients, rate-limits per host | `apps/service/src/recipes/*.ts` |
| Push | Web Push transport (VAPID), recording transport for E2E, E2E seam route | `apps/service/src/push/*.ts` |
| CLI | `hestia-admin reset-password`, the only owner command; the shell wrapper runs `node dist/cli.js` | `apps/service/src/cli.ts`, `apps/service/bin/hestia-admin` |
| Web bootstrap | Creates the Supabase client, auth client, query client, persisters, realtime port | `apps/web/src/main.tsx` |
| Web routing | Route table with lazy-loaded screens and session guards | `apps/web/src/routes.tsx`, `apps/web/src/screens/AuthenticatedLayout.tsx` |
| API client | `fetch` wrapper that attaches the bearer token, refreshes once, parses problem responses | `apps/web/src/lib/api/client.ts` |
| Query hooks | TanStack Query hooks per domain, validated with shared Zod schemas | `apps/web/src/lib/api/hooks.ts`, `apps/web/src/lib/api/*-hooks.ts` |
| Offline writes | Queueable mutations as paused TanStack mutations, persisted to IndexedDB | `apps/web/src/lib/offline/write-queue.ts`, `apps/web/src/lib/offline/persist.ts` |
| Realtime | One Supabase channel per open shopping list, for item changes and the list row | `apps/web/src/lib/realtime/supabase-realtime.ts` |
| Service worker | Installability, offline caching, push display | `apps/web/src/sw.ts`, `apps/web/src/lib/push/service-worker-handlers.ts` |
| Shared contract | Request and response Zod schemas, OpenAPI source, problem details, scrubbing | `packages/shared/src/api/*.ts`, `packages/shared/src/problem.ts`, `packages/shared/src/scrub.ts` |
| Recurrence math | Pure bill and chore occurrence and rotation logic | `packages/recurrence/src/*.ts` |
| Matching | Pure ingredient normalization, similarity, matcher | `packages/matching/src/*.ts` |
| Schema | Migrations (schema, RLS, functions, realtime, notifications) | `supabase/migrations/*.sql` |

## Pattern Overview

- Every data-bearing request is authenticated in the service, then runs inside one Postgres transaction that sets `role authenticated` and the caller's JWT claims (`apps/service/src/db/user-db.ts`). Row-level security decides what is visible; application code does not re-implement it.
- Route plugins are thin: authenticate, `parse` input with a shared Zod schema, call a service function on the scoped transaction, shape the reply (`apps/service/src/routes/bills.ts`).
- Service-role access is fenced. Only `apps/service/src/main.ts` and `apps/service/src/cli.ts` import modules from `apps/service/src/privileged/`; the fence is an ESLint rule (`eslint.config.js`, `no-restricted-imports` and an `ImportExpression` selector for dynamic imports). Jobs and routes receive narrow injected functions instead.
- The service is the only HTTP path to application data. PostgREST is not used. Supabase Auth and Realtime are reached directly through Caddy and Kong (`docker/Caddyfile`, `docker/kong.yml`).
- Background work runs in-process via `node-cron` in a single service process, guarded by Postgres advisory locks (`apps/service/src/jobs/advisory-lock.ts`). The design therefore assumes one running service instance.
- The web app is a route-split SPA: pillar tabs, Settings, and onboarding are lazy chunks (`apps/web/src/routes.tsx`).
- Shared contract: request and response Zod schemas live once in `packages/shared/src/api/*.ts` and are imported by both the service and the web client.
- Pure packages (`packages/recurrence`, `packages/matching`, `packages/shared`) hold logic shared across the API boundary and carry no framework or I/O dependency.

## Layers

- Purpose: Render routes and interactions.
- Location: `apps/web/src/screens/`, `apps/web/src/pillars/`, `apps/web/src/components/`
- Contains: `*Screen.tsx`, `*Route.tsx` wrappers, feature components, primitives under `apps/web/src/components/ui/`, shell under `apps/web/src/components/shell/`.
- Depends on: `apps/web/src/lib/` hooks, `@hestia/shared`, `@hestia/recurrence` (due-date display).
- Used by: `apps/web/src/routes.tsx`.
- Purpose: Talk to the API and Supabase, manage cache, offline writes, and realtime.
- Location: `apps/web/src/lib/api/`, `apps/web/src/lib/auth/`, `apps/web/src/lib/offline/`, `apps/web/src/lib/realtime/`, `apps/web/src/lib/push/`
- Contains: `client.ts` (fetch wrapper, one refresh retry, problem parsing), `api-context.tsx` (providers and `useApi`, `useAuthState`), `keys.ts` (household-scoped query keys), `*-hooks.ts` (TanStack Query hooks), `write-queue.ts` and `chore-errand-writes.ts` (queued mutations), `persist.ts` (IndexedDB persistence), `supabase-realtime.ts` (realtime port).
- Depends on: `@hestia/shared`, `@supabase/supabase-js` (lazy-loaded), TanStack Query.
- Used by: screens and `apps/web/src/main.tsx`.
- Purpose: Map HTTP to domain calls.
- Location: `apps/service/src/routes/`
- Contains: One `FastifyPluginAsync<{ ctx: RouteContext }>` per resource (`auth.ts`, `users.ts`, `households.ts`, `lists.ts`, `bills.ts`, `chores.ts`, `errands.ts`, `meal-plan.ts`, `recipes.ts`, `deals.ts`, `match-overrides.ts`, `system.ts`, `health.ts`).
- Depends on: `apps/service/src/http/context.ts`, domain modules, `@hestia/shared`.
- Used by: `apps/service/src/app.ts`, which registers each plugin.
- Purpose: Authentication, input validation helper, and the only sanctioned path to the database for handlers.
- Location: `apps/service/src/http/context.ts`, `apps/service/src/db/user-db.ts`, `apps/service/src/db.ts`
- Contains: `createRouteContext` (`authenticate`, `asUser`, `inHousehold`, `isOwner`), `parse(schema, value)`, `withUserDb`, `withAnonDb`, the Kysely `Database` type from `apps/service/src/db/types.ts`.
- Depends on: `apps/service/src/auth/jwt.ts` (token verification), `apps/service/src/services/households.ts` (`markHouseholdActive`).
- Purpose: Business rules and the queries that implement them.
- Location: `apps/service/src/services/` (flat, plus `services/deals/`), and two sibling domain folders: `apps/service/src/chores/` (chores, errands, occurrence logic) and `apps/service/src/notifications/` (copy and planners).
- Contains: functions such as `listBills(db, householdId, userId)`, `createHouseholdBill`, `payBill`, `repriceExpiredItems`, `recomputeReadinessForHousehold`, `createMatchOverride`, `markHouseholdActive`. Each takes a Kysely handle already bound to the caller's transaction.
- Depends on: `@hestia/recurrence`, `@hestia/matching`, `@hestia/shared`, the generated DB types.
- Used by: route plugins and scheduled jobs (through the scheduler's injected functions).
- Purpose: Run every request as the caller.
- Location: `apps/service/src/db.ts`, `apps/service/src/db/user-db.ts`, `apps/service/src/db/types.ts`
- Contains: `withUserDb` (authenticated role plus claims), `withAnonDb` (error recording only), the Kysely pool, and the Kysely types generated from the schema.
- Depends on: Postgres as `hestia_service`, a NOINHERIT login role that holds no table rights until a transaction switches role.
- Used by: `apps/service/src/http/context.ts` (`withUserDb`), `apps/service/src/routes/deals.ts` (`claimForUser`, the one route that opens its own transaction), and `apps/service/src/main.ts` (`withAnonDb`, for the error recorder).
- Purpose: The few cross-household operations.
- Location: `apps/service/src/privileged/`
- Contains: `service-role-db.ts` (`withServiceRoleDb`, `readSystemHealth`), `notification-outbox.ts` (outbox claim and send), `scheduled-reminders.ts`, `gotrue-admin.ts` (email change, recovery links), `job-database.ts` (builds the `JobDatabase` handed to jobs).
- Depends on: Postgres as the service role, GoTrue admin API.
- Used by: `apps/service/src/main.ts` and `apps/service/src/cli.ts` only, plus the type-only `SystemHealthRow` import in `apps/service/src/http/context.ts`.
- Purpose: Scheduled and on-demand background work.
- Location: `apps/service/src/jobs/`
- Contains: `scheduler.ts` (registers cron tasks, runs and tracks jobs, `stop()` waits for in-flight runs), `advisory-lock.ts`, `refresh-deals.ts`, `log-autopay.ts`, `dispatch-notifications.ts`, `prune-cache.ts`, and `refresh-plan.ts`, which is a pure planner used by `refresh-deals.ts` and is not scheduled itself. `types.ts` defines the narrow `JobDatabase`, `DispatchOutbox`, and `JobLogger` interfaces.
- Depends on: `JobDatabase` injected from `apps/service/src/privileged/job-database.ts`, services.
- Used by: `apps/service/src/main.ts` (`createScheduler`, `scheduler.start()`), plus `queueBackgroundRefresh` injected into the deals service.
- Purpose: Isolate third-party protocols.
- Location: `apps/service/src/gotrue/` (GoTrue HTTP client), `apps/service/src/auth/jwt.ts` (token verification: HS256 with `JWT_SECRET`; ES256 only for keys GoTrue publishes at its JWKS endpoint), `apps/service/src/deals/flipp/` (Flipp HTTP through one rate-limited queue, fixture transport for E2E), `apps/service/src/deals/price/` (price parsing), `apps/service/src/recipes/` (recipe fetch, JSON-LD, host rate limiter, private-address guard), `apps/service/src/push/` (Web Push transport, recording transport, E2E test seam).
- Used by: `apps/service/src/main.ts`, which injects them into `buildApp` and the scheduler.
- Purpose: One contract and one set of rules for both sides of the API.
- Location: `packages/shared/src/` (Zod request/response schemas in `api/`, problem details, scrubbing, password rules; subpath export `@hestia/shared/common-passwords`), `packages/recurrence/src/` (bill and chore occurrence and rotation), `packages/matching/src/` (ingredient normalization, similarity, matcher).
- Depends on: Zod, date-fns and `@date-fns/tz` (recurrence), `fastest-levenshtein` (matching). No I/O.
- Used by: `apps/web`, `apps/service`, and `supabase/seed` (matching).

## Data Flow

### Primary Request Path (authenticated household write)

### Error Path

### Offline Write Path (list items, chore and errand writes)

### Realtime Sync Path

### Scheduled Job Path

### Notification Pipeline

### Deals and Recipe Import Paths

- Deals: `apps/service/src/routes/deals.ts` calls `DealsService` (`apps/service/src/services/deals/deals.ts`), which reads through caches in `services/deals/cache.ts` and `services/deals/storage.ts`. Fetches to Flipp go through the single `FlippRequestQueue` (`apps/service/src/deals/flipp/request-queue.ts`) shared by requests and the refresh job.
- Recipes: `apps/service/src/routes/recipes.ts` calls `parseRecipeUrl` (`apps/service/src/recipes/parse-recipe-url.ts`), which fetches through `fetch-recipe.ts` and `host-rate-limiter.ts`, and extracts JSON-LD with `json-ld.ts`.
- Server state: Postgres, read through the service, cached in TanStack Query and persisted to IndexedDB (`apps/web/src/lib/api/query-client.ts`, `apps/web/src/lib/offline/persist.ts`).
- Session: Supabase auth client (`apps/web/src/lib/auth/auth-client.ts`), exposed through `useAuthState`; `RequireSession` and `SignedOutOnly` in `apps/web/src/screens/AuthenticatedLayout.tsx` act as route guards.
- Active household: stored on `profile.active_household_id` and stamped by `markHouseholdActive` (`apps/service/src/services/households.ts`) on each household-scoped request.
- In-memory service state: skip-rate registry (`apps/service/src/services/skip-rates.ts`), Flipp request queue, recipe host rate limiter.

## Key Abstractions

- Purpose: The only sanctioned way for a request to reach the database as a user.
- Examples: `apps/service/src/http/context.ts`, `apps/service/src/db/user-db.ts`
- Pattern: Transaction-local role switch and claims. `inHousehold` also returns 404 to non-members.
- Purpose: Each feature is one Fastify plugin receiving `{ ctx }`.
- Examples: `apps/service/src/routes/bills.ts`, `apps/service/src/routes/lists.ts`
- Pattern: `export const billRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => { app.get(...) }`
- Purpose: One definition for request validation, response parsing on the client, and OpenAPI.
- Examples: `packages/shared/src/api/bills.ts`, `packages/shared/src/api/lists.ts`, `apps/service/src/openapi.ts`
- Pattern: Schema exported from `@hestia/shared`, used by `parse(...)` on the server and by `api.request({ schema })` on the client.
- Purpose: Give jobs and routes only the privilege they need.
- Examples: `apps/service/src/jobs/types.ts` (`JobDatabase`, `DispatchOutbox`), `apps/service/src/privileged/job-database.ts`
- Pattern: Dependency injection from `main.ts` into `createScheduler({ database, dispatch, refresh })` and `buildApp(deps, options)`.
- Purpose: Declares each top-level area (Lists, Meals, Bills, Chores; Deals, Flyers, and Pantry are sub-tabs of Lists) and whether it is released. All four are in `RELEASED_PILLARS` today.
- Examples: `apps/web/src/lib/sections.ts` (`PILLARS`, `RELEASED_PILLARS`), `apps/web/src/pillars/*/*Route.tsx`
- Pattern: Unreleased pillars render `ComingSoon` through `PillarScreen` (`apps/web/src/screens/PillarScreen.tsx`).
- Purpose: Uniform error contract across service and client.
- Examples: `apps/service/src/problem.ts`, `packages/shared/src/problem.ts`, `apps/web/src/lib/api/problem.ts`
- Pattern: `fail(status, detail)` throws a `ProblemError`; the error handler sends `application/problem+json`. The detail of an unexpected 5xx error never reaches the client: it is scrubbed, recorded through `recordAppError`, and the reply is a generic problem. Client `ApiError` has status 0 for network failures.

## Entry Points

- Location: `apps/service/src/main.ts`
- Triggers: `node dist/main.js` in the `hestia-service` container (`docker/service.Dockerfile`, `CMD ["node", "dist/main.js"]`); `pnpm --filter @hestia/service dev` runs `tsx watch src/main.ts`.
- Responsibilities: Parse env (`apps/service/src/env.ts`), build the pool, GoTrue, Flipp, recipe, and push clients, call `buildApp`, start the scheduler, handle SIGTERM and SIGINT, listen on the configured host and port.
- Location: `apps/service/src/cli.ts`, built to `apps/service/dist/cli.js`. The hand-written POSIX shell wrapper `apps/service/bin/hestia-admin` resolves its own path and runs `node dist/cli.js`.
- Triggers: `docker compose exec hestia-service hestia-admin reset-password <email>`.
- Responsibilities: Creates a one-time GoTrue recovery link through the admin API. The only CLI command is `reset-password`.
- Location: `apps/web/src/main.tsx`
- Triggers: Browser load of the PWA.
- Responsibilities: Install error reporting, create the Supabase client, auth client, query client, and write-queue defaults, then render `<App>` with the realtime port and persisters.
- Location: `apps/web/src/routes.tsx`
- Triggers: Every navigation.
- Responsibilities: Map paths to lazily loaded screens. `/` is the dashboard (`DashboardRoute`). Public routes are `/sign-in`, `/sign-up`, `/forgot-password`, `/set-password`. `/onboarding` and `/join` require a session. Pillar routes and Settings sit under `AuthenticatedLayout`. Magic-link routes exist only when `VITE_MAGIC_LINK_ENABLED` is `'true'` at build time.
- Location: `apps/web/src/sw.ts` (built with `injectManifest` by `vite-plugin-pwa`, `apps/web/vite.config.ts`)
- Triggers: Browser service worker lifecycle.
- Responsibilities: Precache, navigation fallback, offline caching strategies, push event display (`apps/web/src/lib/push/service-worker-handlers.ts`).
- Location: `supabase/migrations/*.sql` (applied in filename order; eight files from `20260919060000_hestia_service_role.sql` to `20261004090100_depart_clears_notification_preferences.sql`).
- Triggers: `supabase db reset`, `supabase start`, the database container's init scripts (`docker/docker-compose.yml`), and `scripts/deploy.sh`, which runs `supabase migration up` against the Compose database.
- Responsibilities: Schema, RLS policies, helper and lifecycle functions, realtime publication, notification send times and producers.
- `apps/service/src/write-openapi.ts` runs at the end of the service `build` script and emits the OpenAPI document.
- `.github/workflows/deploy.yml` runs on `workflow_run` after a successful push-triggered CI run on `main`, on the self-hosted runner, and executes `scripts/deploy.sh` only when `scripts/deploy-gate.sh` finds a change outside `docs/` and `.planning/` since the running revision or when you re-run the Deploy run.

## Architectural Constraints

- **Threading:** Single-threaded Node event loop for the service; async I/O only. No worker threads.
- **Process count:** One service process is assumed. Cron jobs and in-memory state (Flipp queue, recipe rate limiter, skip rates) are per process. Advisory locks prevent overlap of the same job, and only through the database.
- **Global state:** Module-level singletons are created in `apps/service/src/main.ts` (`wiring`, `skipRates`, `flippQueue`, `recipeFetchLimiter`, `recordingTransport`). The web client creates its singletons in `apps/web/src/main.tsx`.
- **Build-time configuration:** `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, and `VITE_MAGIC_LINK_ENABLED` are fixed at build time; a change requires a rebuild.
- **Test-only seams:** Fixture transports (`HESTIA_FLIPP_FIXTURE_DIR`, `HESTIA_RECIPE_FIXTURE_DIR`), the push double (`HESTIA_PUSH_TRANSPORT=test-double`) (all set only by the E2E Compose overlay, `e2e/docker-compose.e2e.yml`), and the `POST /api/test/push/dispatch` and `GET /api/test/push/deliveries` routes in `apps/service/src/push/test-seam.ts`. The seam is registered only when `main.ts` passes it, which happens only for the test-double transport.
- **Pinned origin:** The public origin is part of installed PWAs and push subscriptions (`docs/deployment.md`, "Pinned names"). `HESTIA_ORIGIN` is used for invite links and the user agent; changing the host is a breaking change.
- **Public unauthenticated routes:** `/api/health`, `/api/signup`, `/api/client-error` (rate limited per IP, `apps/service/src/routes/system.ts`), `/api/openapi.json`. All others call `ctx.authenticate`.

## Layering Deviations (observed)

- **Chores and errands** do not live under `services/`. `apps/service/src/routes/chores.ts` and `routes/errands.ts` import from the domain folder `apps/service/src/chores/`. Searching only `services/` misses this logic.
- **Deals** span two folders: the orchestrator `apps/service/src/services/deals/deals.ts` and the Flipp adapter in `apps/service/src/deals/flipp/`.
- **Deals route opens its own transaction:** `apps/service/src/routes/deals.ts` calls `withUserDb` directly (the `claimForUser` helper) so a dormant postal-code claim commits independently of the request. This is the only route file that imports `withUserDb`.
- **Type-only privileged import:** `apps/service/src/http/context.ts` imports `SystemHealthRow` from `apps/service/src/privileged/service-role-db.ts`. The lint fence allows type imports.
- **Shadowed sub-route:** `apps/web/src/routes.tsx` maps `lists/deals` and `lists/flyers` before the `lists/*` pillar wrapper, so the `deals` branch inside `apps/web/src/pillars/lists/ListsRoute.tsx` (which renders `SubSectionComingSoon`) is not reached through the router.

## Anti-Patterns

### Querying the database outside `withUserDb`

- **What happens:** A route or service receives the raw `db` handle and runs queries on it directly.
- **Why it's wrong:** Nothing sets the caller's role and claims, so RLS has no caller to judge. `hestia_service` is NOINHERIT and holds no table rights until a transaction switches role (`supabase/migrations/20260919060000_hestia_service_role.sql`), so such a query fails; the shortcut of switching to `service_role` by hand runs outside the policies, because `service_role` bypasses RLS.
- **Do this instead:** Go through `ctx.inHousehold(user, householdId, fn)` or `ctx.asUser(user, fn)` (`apps/service/src/http/context.ts`). `withAnonDb` is for error recording only.

### Importing `privileged/` from a route, service, or job

- **What happens:** A feature module imports `apps/service/src/privileged/*` to reach `service_role`.
- **Why it's wrong:** It widens the blast radius of the service-role key beyond the few audited uses.
- **Do this instead:** Accept a narrow function or interface injected through `RouteContext` or the scheduler dependencies (`changeEmail`, `systemHealth`, `JobDatabase`). `eslint.config.js` enforces this for value imports and for dynamic `import()`; type-only imports are allowed.

### Enforcing household isolation only in application code

- **What happens:** A query relies on a `household_id` filter written in TypeScript as the only isolation rule, with no policy behind it.
- **Why it's wrong:** A missed filter leaks another household's data. RLS is the boundary; application filters are not.
- **Do this instead:** Write the access rule as a policy in `supabase/migrations/20260919070100_rls.sql` and reach data through `withUserDb`.

### Duplicating schemas on client and server

- **What happens:** A request or response shape is redefined in `apps/web` or `apps/service`.
- **Why it's wrong:** Validation drifts between the two sides of the API.
- **Do this instead:** Define the Zod schema once in `packages/shared/src/api/*.ts` and import it on both sides.

### Hand-edited generated database types

- **What happens:** `apps/service/src/db/types.ts` is edited by hand.
- **Why it's wrong:** The next `kysely-codegen` run overwrites the change, and the types diverge from the schema.
- **Do this instead:** Change the migration, apply it to a local database, then run `pnpm db:types`.

## Error Handling

- Route code throws `fail(status, detail)` or a service-level error (`apps/service/src/services/errors.ts`). The error handler maps it (`apps/service/src/app.ts`).
- Postgres errors map by SQLSTATE through `DATABASE_PROBLEMS` in `apps/service/src/problem.ts`, via `problemFromDatabaseError`. GoTrue errors map through `problemFromGoTrueError` and recipe fetch errors through `problemFromRecipeFetchError`, both in the same file.
- Server errors are recorded through `recordAppError`, which writes as `anon` through `public.record_app_error` (`apps/service/src/db/user-db.ts`, `withAnonDb`).
- The client throws `ApiError`; the query layer decides on retry (`apps/web/src/lib/api/client.ts`, `apps/web/src/lib/offline/write-queue.ts`).
- Render-time crashes are caught by `apps/web/src/components/states/ErrorBoundary.tsx` and the router's `errorElement` (`RouteError` in `apps/web/src/routes.tsx`).

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

## Running E2E in the Claude cloud sandbox

This section is hand-maintained and sits outside the `GSD:*` managed blocks, so GSD regeneration leaves it alone.

`pnpm test:e2e` builds the `hestia-service` and `hestia-caddy` images with Docker. In the cloud sandbox, build containers reach the network through a TLS-intercepting proxy whose CA they do not trust, so corepack's pnpm download fails with `SELF_SIGNED_CERT_IN_CHAIN` (`pnpm fetch` exits 1 in both Dockerfiles). Apply this workaround before running, and revert it afterwards. It is local-only: never commit it, and never disable TLS verification.

1. `cp /root/.ccr/ca-bundle.crt docker/ca.crt`
2. In `docker/service.Dockerfile` (the `source` stage) and `docker/caddy.Dockerfile` (the `build` stage), add these two lines directly after the `FROM node:...` line. Do not add them to the final runtime stage.

   ```dockerfile
   COPY docker/ca.crt /ca.crt
   ENV NODE_EXTRA_CA_CERTS=/ca.crt
   ```

3. Append `!docker/ca.crt` to `.dockerignore` (the `docker` directory is otherwise excluded from the build context).
4. Run `pnpm test:e2e`. It takes about 9 minutes; the expected result is 107 passed.
5. Revert: `git checkout docker/service.Dockerfile docker/caddy.Dockerfile .dockerignore && rm docker/ca.crt`, then confirm `git status` is clean.

Retagging a local `node:24.21.0-bookworm-slim` image with the CA does not work: BuildKit resolves the `FROM` by registry digest and ignores local tags.
