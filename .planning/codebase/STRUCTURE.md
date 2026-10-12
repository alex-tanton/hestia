---
last_mapped_commit: b96ca32ac1130c09f8aa3066d715181ddf3fb31a
last_mapped_at: 2026-10-11
---
# Codebase Structure

**Analysis Date:** 2026-10-11

## Directory Layout

```
hearth/
├── apps/
│   ├── service/              # Fastify API, cron jobs, hearth-admin CLI
│   │   ├── src/              # TypeScript source (see Directory Purposes)
│   │   ├── bin/              # Built hearth-admin executable
│   │   └── scripts/          # Service helper scripts (e.g. write-openapi)
│   └── web/                  # React PWA (Vite, Tailwind, Workbox)
│       ├── src/              # TypeScript/TSX source
│       ├── public/           # Static assets, icons
│       └── scripts/          # Build-time helpers
├── packages/
│   ├── shared/src/           # Zod API schemas, problem helpers, scrubbing, password lists
│   ├── recurrence/src/       # Pure bill and chore recurrence logic
│   └── matching/src/         # Pure ingredient normalization and matching
│       └── data/             # Matching data tables
├── supabase/
│   ├── config.toml           # Supabase CLI config
│   ├── migrations/           # Ordered SQL migrations (schema, RLS, functions, realtime)
│   └── seed/                 # Seed SQL and seed scripts (workspace @hearth/seed)
├── e2e/                      # Playwright suite and Compose overlay
│   ├── tests/                # Journey specs
│   ├── support/              # Test helpers (API, DB, axe, logs)
│   ├── setup/                # Stack bring-up for a disposable run
│   └── fixtures/             # Flipp flyer and recipe fixtures
├── docker/                   # Compose file, Caddy, Kong, Dockerfiles, db init SQL
├── docs/                     # Specifications (source of truth for behaviour)
├── scripts/                  # deploy.sh, generate-secrets.sh
├── .github/workflows/        # ci.yml, deploy.yml
├── .husky/                   # Git hooks
├── .planning/                # GSD planning artifacts (codebase maps live here)
├── package.json              # Root scripts and devDependencies
├── pnpm-workspace.yaml       # Workspace globs: apps/*, packages/*, e2e, supabase/seed
├── tsconfig.base.json        # Shared TypeScript settings
├── eslint.config.js          # Lint rules, including the privileged/ fence
└── README.md
```

## Directory Purposes

**`apps/service/src/routes/`:**
- Purpose: One Fastify plugin per feature. Parses input and calls services.
- Contains: `auth.ts`, `bills.ts`, `chores.ts`, `deals.ts`, `errands.ts`, `health.ts`, `households.ts`, `lists.ts`, `match-overrides.ts`, `meal-plan.ts`, `recipes.ts`, `system.ts`, `users.ts`, plus `routes.test.ts`.
- Key files: `apps/service/src/routes/bills.ts`, `apps/service/src/routes/lists.ts`

**`apps/service/src/services/`:**
- Purpose: Business logic and data access inside a transaction. Flat, one file per feature, with `deals/` as a subfolder.
- Contains: `bills.ts`, `lists.ts`, `meal-plan.ts`, `recipes.ts`, `repricing.ts`, `readiness.ts`, `membership.ts`, `invites.ts`, `notifications.ts`, `subscriptions.ts`, `skip-rates.ts`, `deals/deals.ts`, `deals/cache.ts`, `deals/filter.ts`, `deals/dormancy.ts`, `deals/storage.ts`, and others. Unit tests sit beside each file.

**`apps/service/src/jobs/`:**
- Purpose: Scheduled and on-demand background work.
- Contains: `scheduler.ts` (cron registration), `index.ts` (`createScheduler` export), `advisory-lock.ts`, `refresh-deals.ts`, `refresh-plan.ts`, `log-autopay.ts`, `dispatch-notifications.ts`, `prune-cache.ts`, `types.ts`.

**`apps/service/src/privileged/`:**
- Purpose: The only `service_role` code. Fenced by ESLint.
- Contains: `service-role-db.ts`, `notification-outbox.ts`, `scheduled-reminders.ts`, `gotrue-admin.ts`, `job-database.ts`.
- Do not import from outside `main.ts`, `cli.ts`, and this folder.

**`apps/service/src/db/`:**
- Purpose: Database access wrapper and generated types.
- Contains: `user-db.ts` (`withUserDb`, `withAnonDb`), `types.ts` (generated, do not edit by hand), and integration tests for RLS and membership (`*.integration.test.ts`).
- Also: `apps/service/src/db.ts` creates the Kysely pool.

**`apps/service/src/http/`:**
- Purpose: Route plumbing shared across plugins.
- Contains: `context.ts` (`RouteContext`, `parse`, `authenticate`, `asUser`, `inHousehold`).

**`apps/service/src/auth/`, `gotrue/`:**
- Purpose: JWT verification and the GoTrue HTTP client.

**`apps/service/src/deals/`:**
- Purpose: Deal sources, pricing, and the Flipp client.
- Contains: `deal-source.ts` (interface), `money.ts`, `flipp/` (client, request queue, fixture transport), `price/` (parsers and price copy).

**`apps/service/src/recipes/`:**
- Purpose: Recipe URL fetching, JSON-LD extraction, ingredient parsing, SSRF guard.
- Contains: `fetch-recipe.ts`, `parse-recipe-url.ts`, `json-ld.ts`, `ingredient-parser.ts`, `private-address.ts`, `host-rate-limiter.ts`, `fixtures/`.

**`apps/service/src/notifications/`, `push/`:**
- Purpose: Notification copy and planners (`notifications/`), Web Push transport and E2E test double (`push/`).

**`apps/service/src/chores/`:**
- Purpose: Chore occurrence and errand scheduling helpers (`occurrence.ts`, `chores.ts`, `errands.ts`).

**`apps/service/src/test/`:**
- Purpose: Shared harnesses for service tests: `fake-app.ts`, `integration-db.ts`, `service-stack.ts`, `world.ts`, `push-double.ts`, and fixture deal source.

**`apps/web/src/screens/`:**
- Purpose: Route-level pages. Each folder is a pillar or area.
- Contains: `bills/`, `chores/`, `deals/`, `lists/`, `meals/`, `onboarding/`, `settings/` (with `settings/account/`), plus `DashboardScreen.tsx`, `DashboardRoute.tsx`, `AuthenticatedLayout.tsx`, `PillarScreen.tsx`.
- Naming: `<Name>Screen.tsx` or `<Name>Route.tsx` (route wrapper that reads params or session).

**`apps/web/src/pillars/`:**
- Purpose: Thin route modules for each pillar with sub-routes (`BillsRoute.tsx`, `ChoresRoute.tsx`, `ListsRoute.tsx`, `MealsRoute.tsx`). Each exports a `Component`, which the router loads lazily.

**`apps/web/src/components/`:**
- Purpose: Reusable UI, grouped by feature.
- Contains: `ui/` (primitives: `Button.tsx`, `Card.tsx`, `Sheet.tsx`, `Select.tsx`, `Toast.tsx`, `Tabs.tsx`), `shell/` (`AppShell.tsx`, `TabBar.tsx`, `TopBar.tsx`, `SubTabs.tsx`, `HouseholdSwitcher.tsx`, `OfflineBanner.tsx`, `UpdatePrompt.tsx`), `states/` (`ErrorBoundary.tsx`, `StateBlocks.tsx`, `ComingSoon.tsx`, `StaleNotice.tsx`), and feature folders `bills/`, `chores/`, `dashboard/`, `errands/`, `lists/`, `meals/`.
- Feature copy lives beside its components, for example `components/bills/bills-copy.ts`, `components/meals/meal-copy.ts`.

**`apps/web/src/lib/`:**
- Purpose: Non-visual logic.
- Contains: `api/` (client, query hooks, keys, problem parsing), `auth/` (supabase-js client wrapper), `offline/` (write queue, persistence, list cache), `realtime/` (channel port), `push/` (device subscription, service worker handlers), `bills/` (recurrence preview), plus top-level helpers such as `format.ts`, `money.ts`, `household-date.ts`, `sections.ts`, `validation.ts`, `password.ts`, `url-hash.ts`, and hooks named `use-*.ts`.

**`apps/web/src/test/`:** Vitest helpers shared by the web suite. `apps/web/src/test-setup.ts` is the setup file.

**`packages/shared/src/api/`:**
- Purpose: The API contract. One file per feature, each exporting Zod request and response schemas and inferred types.
- Contains: `auth.ts`, `bills.ts`, `chores.ts`, `deals.ts`, `errands.ts`, `households.ts`, `invites.ts`, `lists.ts`, `matching.ts`, `meal-plan.ts`, `membership.ts`, `notifications.ts`, `pantry.ts`, `recipes.ts`, `system.ts`, `users.ts`, and `common.ts`/`contract.ts` for shared pieces.
- Other files in `packages/shared/src/`: `problem.ts`, `scrub.ts`, `password.ts`, `common-passwords.ts`, `data/` (common-password list), `index.ts` (barrel).

**`packages/recurrence/src/`:**
- Contains: `bills.ts`, `chores.ts`, `occurrence.ts`, `rotation.ts`, `calendar-date.ts`, `types.ts`, `index.ts` (barrel), with a test beside each.

**`packages/matching/src/`:**
- Contains: `normalize.ts`, `singularize.ts`, `similarity.ts`, `matcher.ts`, `index.ts`, and `data/` (static lookup data).

**`supabase/migrations/`:**
- Purpose: Forward-only schema history. Files are named `YYYYMMDDHHMMSS_<name>.sql` and applied in order.
- Contains: `20260919060000_hearth_service_role.sql`, `20260919070000_schema.sql`, `20260919070100_rls.sql`, `20260919070200_functions.sql`, `20260919070300_realtime.sql`, `20260925080000_notification_send_times.sql`, `20261004090000_notification_producers.sql`, `20261004090100_depart_clears_notification_preferences.sql`.

**`supabase/seed/`:**
- Purpose: Local and E2E seed data. `seed.sql`, `seed-users.ts`, `compute-readiness.ts`.

**`e2e/`:**
- Purpose: Playwright journeys against the full Compose stack.
- Contains: `tests/` (one spec per scenario), `support/`, `setup/`, `fixtures/` (`flipp/raw`, `flipp/normalized`, `recipes/`), `global-setup.ts`, `global-teardown.ts`, `playwright.config.ts`, `docker-compose.e2e.yml`.

**`docker/`:**
- Contains: `docker-compose.yml`, `Caddyfile`, `caddy-entrypoint.sh`, `caddy.Dockerfile`, `service.Dockerfile`, `kong.yml`, `kong-entrypoint.sh`, and `db/` (role-setup SQL run at container start).

**`docs/`:**
- Contains: `architecture.md`, `file-map.md`, `design.md`, `branding.md`, `deploy.md`, `testing.md`, `use-cases.md`. These specifications are the source of truth.

**`.github/workflows/`:** `ci.yml` (lint, typecheck, tests on PRs and pushes), `deploy.yml` (deploy `main` on the self-hosted runner).

**`.planning/`:** GSD planning state. `.planning/codebase/` holds these maps.

## Key File Locations

**Entry Points:**
- `apps/service/src/main.ts`: Service process.
- `apps/service/src/cli.ts`: `hearth-admin` owner CLI.
- `apps/web/src/main.tsx`: PWA bootstrap.
- `apps/web/src/App.tsx`: Providers and router mount.
- `apps/web/src/routes.tsx`: Route table.
- `apps/web/src/sw.ts`: Service worker.

**Configuration:**
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`: Workspace and TypeScript.
- `eslint.config.js`: Lint, including the privileged fence.
- `apps/web/vite.config.ts`: Vite and PWA build.
- `apps/service/src/env.ts`: Environment schema for the service. Read the file for variable names; `.env.example` at the root lists them without values.
- `supabase/config.toml`: Supabase CLI.
- `docker/docker-compose.yml`, `docker/Caddyfile`, `docker/kong.yml`: Production runtime.

**Core Logic:**
- `apps/service/src/app.ts`: Route registration and error handling.
- `apps/service/src/http/context.ts`: Request context.
- `apps/service/src/db/user-db.ts`: RLS transaction boundary.
- `apps/service/src/services/bills.ts`, `lists.ts`, `meal-plan.ts`, `readiness.ts`, `repricing.ts`: Core domain services.
- `apps/service/src/jobs/scheduler.ts`: Cron schedule.
- `apps/web/src/lib/api/client.ts`: API client.
- `apps/web/src/lib/offline/write-queue.ts`: Offline writes.
- `apps/web/src/lib/realtime/supabase-realtime.ts`: Realtime channels.
- `apps/web/src/lib/sections.ts`: Pillar registry and released pillars.

**Testing:**
- Unit and component tests: co-located as `*.test.ts(x)` beside source (for example `apps/web/src/screens/chores/chores.test.tsx`, `apps/service/src/services/bills.test.ts`).
- Service integration tests: `apps/service/src/*.integration.test.ts` and `apps/service/src/db/*.integration.test.ts`.
- Shared test harnesses: `apps/service/src/test/`, `apps/web/src/test/`.
- E2E: `e2e/tests/`.

## Naming Conventions

**Files:**
- Web components: PascalCase `.tsx`, one component per file (`BillRow.tsx`, `PlannerDay.tsx`). Examples: `apps/web/src/components/bills/BillRow.tsx`.
- Web screens: PascalCase with a `Screen` or `Route` suffix (`BillsIndexScreen.tsx`, `ListsIndexScreen.tsx`, `DashboardRoute.tsx`).
- Web non-component modules: kebab-case `.ts` (`write-queue.ts`, `household-date.ts`, `use-refresh-poll.ts`). Hooks are prefixed `use-`.
- Feature copy: `<area>-copy.ts` (`bills-copy.ts`, `deal-copy.ts`).
- Service modules: kebab-case `.ts` (`notification-outbox.ts`, `match-overrides.ts`, `parse-recipe-url.ts`).
- Route modules: plural feature nouns (`bills.ts`, `chores.ts`, `errands.ts`).
- Tests: `<name>.test.ts(x)` for unit and component; `<name>.integration.test.ts` for database or stack tests (`apps/service/src/bills.integration.test.ts`).
- Migrations: `YYYYMMDDHHMMSS_<snake_or_kebab_name>.sql`.
- Shared schemas: `packages/shared/src/api/<feature>.ts`.

**Directories:**
- Lowercase, kebab-case, feature-named (`apps/service/src/deals/flipp/`, `apps/web/src/components/chores/`).
- Web `screens/` and `components/` are grouped by pillar: `bills`, `chores`, `lists`, `meals`, `deals`, `dashboard`, `errands`, `onboarding`, `settings`.

**Identifiers:**
- Functions and variables: camelCase. Route constants: `<feature>Routes` (`billRoutes`, `listRoutes`).
- Schemas: `<action><Entity>RequestSchema` and `<entity>IdParamsSchema` (`createBillRequestSchema`, `billIdParamsSchema`).
- Database: snake_case tables and columns (`shopping_list_item`, `household_member`). The API and client use camelCase.

## Where to Add New Code

**New API endpoint for an existing feature:**
- Route: add to `apps/service/src/routes/<feature>.ts`.
- Service logic: add to `apps/service/src/services/<feature>.ts`, taking a Kysely handle from `ctx.asUser` or `ctx.inHousehold`.
- Schema: add request and response schemas to `packages/shared/src/api/<feature>.ts`.
- Tests: `apps/service/src/services/<feature>.test.ts` for logic, `apps/service/src/<feature>.integration.test.ts` for the route against the database.

**New feature (new route file):**
- Create `apps/service/src/routes/<feature>.ts` exporting a `FastifyPluginAsync<{ ctx: RouteContext }>`.
- Register it in `apps/service/src/app.ts` alongside the other `app.register(...)` calls.
- Create `packages/shared/src/api/<feature>.ts` and export it from `packages/shared/src/index.ts`.

**New database table or policy:**
- Add a new migration in `supabase/migrations/` named with a fresh timestamp. Do not edit an applied migration.
- Enable RLS and write policies using `public.is_household_member(...)` or the existing helpers.
- Run `pnpm db:types` and commit `apps/service/src/db/types.ts`.
- Add an RLS test in `apps/service/src/db/` (see `rls-isolation.integration.test.ts`).

**New cross-household or service-role operation:**
- Put it in `apps/service/src/privileged/`. Expose one narrow function to the caller and wire it in `apps/service/src/main.ts`. Do not import the module from routes or services.

**New scheduled job:**
- Implement in `apps/service/src/jobs/<name>.ts`, take `JobDatabase` and dependencies as parameters, and wrap with `withJobLock` through the scheduler.
- Register the cron in `apps/service/src/jobs/scheduler.ts`.

**New web screen in an existing pillar:**
- Screen: `apps/web/src/screens/<pillar>/<Name>Screen.tsx`.
- Route entry: add to the pillar's route module in `apps/web/src/pillars/<pillar>/<Pillar>Route.tsx`, or to `apps/web/src/routes.tsx` for a top-level route.
- Data hooks: add to `apps/web/src/lib/api/<domain>-hooks.ts` and keys to `apps/web/src/lib/api/keys.ts`.
- Tests: co-located `<Name>.test.tsx` under the same screen folder.

**New pillar:**
- Add to `PILLARS` and `RELEASED_PILLARS` in `apps/web/src/lib/sections.ts`.
- Add `apps/web/src/pillars/<pillar>/<Pillar>Route.tsx` and `apps/web/src/screens/<pillar>/`.

**New reusable UI component:**
- Generic primitive: `apps/web/src/components/ui/<Name>.tsx`.
- Feature component: `apps/web/src/components/<feature>/<Name>.tsx`.

**New offline-queueable write:**
- Register its `mutationFn` and lifecycle in `apps/web/src/lib/offline/chore-errand-writes.ts` or `write-queue.ts`. Ensure the server endpoint is idempotent on a client UUID or an absolute value.

**New pure logic shared across the API boundary:**
- Put it in `packages/recurrence/src/` (dates and rotation) or `packages/matching/src/` (names and matching), or in `packages/shared/src/` for validation and contract types. These packages must not import I/O or framework code.

**Utilities:**
- Web shared helpers: `apps/web/src/lib/` (for example `format.ts`, `money.ts`).
- Service shared helpers: `apps/service/src/http/` for request plumbing, or the relevant feature folder for domain helpers.
- Cross-package helpers: `packages/shared/src/`.

## Special Directories

**`apps/service/src/db/types.ts`:**
- Purpose: Kysely types generated from the migrated schema.
- Generated: Yes, by `pnpm db:types`.
- Committed: Yes.

**`apps/service/bin/`:**
- Purpose: Built `hearth-admin` executable.
- Generated: Yes, by `pnpm --filter @hearth/service build`.
- Committed: Not expected to be edited by hand.

**`apps/web/public/icons/`:**
- Purpose: PWA install icons.
- Generated: No.
- Committed: Yes.

**`e2e/fixtures/flipp/raw/` and `normalized/`, `e2e/fixtures/recipes/`:**
- Purpose: Recorded third-party responses that the E2E stack serves in place of live calls.
- Generated: Recorded from live services; normalized by `pnpm fixtures:normalize`.
- Committed: Yes.

**`apps/service/src/recipes/fixtures/`:**
- Purpose: Fixture pages for recipe unit tests.
- Committed: Yes.

**`.planning/codebase/`:**
- Purpose: Codebase maps consumed by GSD planning commands.
- Generated: Yes, by `/gsd-map-codebase`.
- Committed: Yes.

---

*Structure analysis: 2026-10-11*
