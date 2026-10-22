---
last_mapped_commit: 283f15dbb2b5ed8ded0ba14e04d5015e5d0d367c
last_mapped_at: 2026-10-22
---
<!-- refreshed: 2026-10-22 -->

# Architecture

**Analysis Date:** 2026-10-22

## System Overview

```text
                         Browser (installed PWA)
        apps/web  src/main.tsx -> App.tsx -> routes.tsx (lazy screens)
        TanStack Query cache + paused-mutation write queue (IndexedDB)
        Service worker apps/web/src/sw.ts (precache, push display)
                                   |
                                   v  HTTPS via Tailscale Funnel
                    Caddy  docker/Caddyfile  (:8080, only published port)
          /api/*  ----------------------+     /auth/v1/*, /realtime/v1/*
          /*      static SPA from /srv  |        |
                                        v        v
        hearth-service  apps/service   |    kong:8000 -> GoTrue (auth), Realtime
        (Fastify, dist/main.js)  <-----+
          |  routes/*.ts  -> services/*.ts, chores/*.ts, ...
          |  http/context.ts: authenticate -> withUserDb (RLS transaction)
          |  jobs/scheduler.ts (node-cron, in-process)
          |        |                     |                    |
          v        v                     v                    v
   Postgres 17   GoTrue admin/API    Flipp (deals)     Web Push services
   (Supabase)    (service role)      recipe hosts       (VAPID)
```

Two separate paths reach the database. Request handlers and jobs use the `hearth_service` pool through transactions that switch role (`authenticated` for callers, `service_role` only inside `apps/service/src/privileged/`). Caddy never forwards `/api/*` to Postgres or PostgREST.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Service bootstrap | Reads env, builds the Flipp, recipe, and push clients, builds the Fastify app, starts the scheduler, handles SIGTERM and SIGINT | `apps/service/src/main.ts` |
| App assembly | Error handler, global rate limit, registers every route plugin (every route lives under `/api`) | `apps/service/src/app.ts` |
| Env validation | Zod parse of process env; fails startup on a missing or invalid value; `parseCliEnv` for the owner CLI | `apps/service/src/env.ts` |
| Route context | Bearer-token authentication, `asUser` / `inHousehold` helpers that wrap `withUserDb` | `apps/service/src/http/context.ts` |
| RLS transaction wrapper | Opens a transaction, `set local role authenticated`, installs JWT claims; `withAnonDb` for error recording | `apps/service/src/db/user-db.ts` |
| Database pool | Kysely over `pg`, connects as `hearth_service` | `apps/service/src/db.ts`, `apps/service/src/db/types.ts` (generated) |
| Routes | Thin HTTP layer per feature: parse input with shared schemas, call a service, shape the reply | `apps/service/src/routes/*.ts` |
| Services | Business rules per feature (recurrence, repricing, readiness, membership, invites, notifications); chores and errands sit in a sibling folder | `apps/service/src/services/*.ts`, `apps/service/src/services/deals/`, `apps/service/src/chores/*.ts`, `apps/service/src/notifications/*.ts` |
| Jobs | Cron-driven work: deal refresh, autopay logging, notification dispatch, cache pruning (four scheduled jobs; `refresh-plan.ts` is a planner that `refresh-deals.ts` calls, not a job) | `apps/service/src/jobs/*.ts` |
| Scheduler | Registers the node-cron tasks; wraps each run in an advisory lock | `apps/service/src/jobs/scheduler.ts`, `apps/service/src/jobs/advisory-lock.ts` |
| Privileged access | The only `service_role` code: notification outbox, GoTrue admin, job DB, system health, scheduled reminders | `apps/service/src/privileged/*.ts` |
| Auth verification | Verifies the bearer token's signature and expiry (HS256 with `JWT_SECRET`; ES256 only for a key GoTrue publishes at its JWKS endpoint, as `supabase start` does); GoTrue HTTP client | `apps/service/src/auth/jwt.ts`, `apps/service/src/gotrue/client.ts` |
| Deals source | Flipp HTTP client behind one rate-limited request queue, with a fixture transport for E2E | `apps/service/src/deals/flipp/*.ts`, `apps/service/src/deals/deal-source.ts` |
| Recipe import | Fetches a pasted URL server-side, extracts JSON-LD, parses ingredients, rate-limits per host | `apps/service/src/recipes/*.ts` |
| Push | Web Push transport (VAPID), recording transport for E2E, E2E seam route | `apps/service/src/push/*.ts` |
| CLI | `hearth-admin reset-password`, the only owner command; the shell wrapper runs `node dist/cli.js` | `apps/service/src/cli.ts`, `apps/service/bin/hearth-admin` |
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

**Overall:** Modular monolith with a thin HTTP layer, domain service modules, and database-enforced isolation. Pure logic lives in workspace packages shared by the browser and the service.

**Key Characteristics:**
- Every data-bearing request is authenticated in the service, then runs inside one Postgres transaction that sets `role authenticated` and the caller's JWT claims (`apps/service/src/db/user-db.ts`). Row-level security decides what is visible; application code does not re-implement it.
- Route plugins are thin: authenticate, `parse` input with a shared Zod schema, call a service function on the scoped transaction, shape the reply (`apps/service/src/routes/bills.ts`).
- Service-role access is fenced. Only `apps/service/src/main.ts` and `apps/service/src/cli.ts` import modules from `apps/service/src/privileged/`; the fence is an ESLint rule (`eslint.config.js`, `no-restricted-imports` and an `ImportExpression` selector for dynamic imports). Jobs and routes receive narrow injected functions instead.
- The service is the only HTTP path to application data. PostgREST is not used. Supabase Auth and Realtime are reached directly through Caddy and Kong (`docker/Caddyfile`, `docker/kong.yml`).
- Background work runs in-process via `node-cron` in a single service process, guarded by Postgres advisory locks (`apps/service/src/jobs/advisory-lock.ts`). The design therefore assumes one running service instance.
- The web app is a route-split SPA: pillar tabs, Settings, and onboarding are lazy chunks (`apps/web/src/routes.tsx`).
- Shared contract: request and response Zod schemas live once in `packages/shared/src/api/*.ts` and are imported by both the service and the web client.
- Pure packages (`packages/recurrence`, `packages/matching`, `packages/shared`) hold logic shared across the API boundary and carry no framework or I/O dependency.

## Layers

**Web screens and components:**
- Purpose: Render routes and interactions.
- Location: `apps/web/src/screens/`, `apps/web/src/pillars/`, `apps/web/src/components/`
- Contains: `*Screen.tsx`, `*Route.tsx` wrappers, feature components, primitives under `apps/web/src/components/ui/`, shell under `apps/web/src/components/shell/`.
- Depends on: `apps/web/src/lib/` hooks, `@hearth/shared`, `@hearth/recurrence` (due-date display).
- Used by: `apps/web/src/routes.tsx`.

**Web data and session layer:**
- Purpose: Talk to the API and Supabase, manage cache, offline writes, and realtime.
- Location: `apps/web/src/lib/api/`, `apps/web/src/lib/auth/`, `apps/web/src/lib/offline/`, `apps/web/src/lib/realtime/`, `apps/web/src/lib/push/`
- Contains: `client.ts` (fetch wrapper, one refresh retry, problem parsing), `api-context.tsx` (providers and `useApi`, `useAuthState`), `keys.ts` (household-scoped query keys), `*-hooks.ts` (TanStack Query hooks), `write-queue.ts` and `chore-errand-writes.ts` (queued mutations), `persist.ts` (IndexedDB persistence), `supabase-realtime.ts` (realtime port).
- Depends on: `@hearth/shared`, `@supabase/supabase-js` (lazy-loaded), TanStack Query.
- Used by: screens and `apps/web/src/main.tsx`.

**HTTP routes (service):**
- Purpose: Map HTTP to domain calls.
- Location: `apps/service/src/routes/`
- Contains: One `FastifyPluginAsync<{ ctx: RouteContext }>` per resource (`auth.ts`, `users.ts`, `households.ts`, `lists.ts`, `bills.ts`, `chores.ts`, `errands.ts`, `meal-plan.ts`, `recipes.ts`, `deals.ts`, `match-overrides.ts`, `system.ts`, `health.ts`).
- Depends on: `apps/service/src/http/context.ts`, domain modules, `@hearth/shared`.
- Used by: `apps/service/src/app.ts`, which registers each plugin.

**Request context:**
- Purpose: Authentication, input validation helper, and the only sanctioned path to the database for handlers.
- Location: `apps/service/src/http/context.ts`, `apps/service/src/db/user-db.ts`, `apps/service/src/db.ts`
- Contains: `createRouteContext` (`authenticate`, `asUser`, `inHousehold`, `isOwner`), `parse(schema, value)`, `withUserDb`, `withAnonDb`, the Kysely `Database` type from `apps/service/src/db/types.ts`.
- Depends on: `apps/service/src/auth/jwt.ts` (token verification), `apps/service/src/services/households.ts` (`markHouseholdActive`).

**Domain services:**
- Purpose: Business rules and the queries that implement them.
- Location: `apps/service/src/services/` (flat, plus `services/deals/`), and two sibling domain folders: `apps/service/src/chores/` (chores, errands, occurrence logic) and `apps/service/src/notifications/` (copy and planners).
- Contains: functions such as `listBills(db, householdId, userId)`, `createHouseholdBill`, `payBill`, `repriceExpiredItems`, `recomputeReadinessForHousehold`, `createMatchOverride`, `markHouseholdActive`. Each takes a Kysely handle already bound to the caller's transaction.
- Depends on: `@hearth/recurrence`, `@hearth/matching`, `@hearth/shared`, the generated DB types.
- Used by: route plugins and scheduled jobs (through the scheduler's injected functions).

**Database access:**
- Purpose: Run every request as the caller.
- Location: `apps/service/src/db.ts`, `apps/service/src/db/user-db.ts`, `apps/service/src/db/types.ts`
- Contains: `withUserDb` (authenticated role plus claims), `withAnonDb` (error recording only), the Kysely pool, and the Kysely types generated from the schema.
- Depends on: Postgres as `hearth_service`, a NOINHERIT login role that holds no table rights until a transaction switches role.
- Used by: `apps/service/src/http/context.ts` (`withUserDb`), `apps/service/src/routes/deals.ts` (`claimForUser`, the one route that opens its own transaction), and `apps/service/src/main.ts` (`withAnonDb`, for the error recorder).

**Privileged access (service role):**
- Purpose: The few cross-household operations.
- Location: `apps/service/src/privileged/`
- Contains: `service-role-db.ts` (`withServiceRoleDb`, `readSystemHealth`), `notification-outbox.ts` (outbox claim and send), `scheduled-reminders.ts`, `gotrue-admin.ts` (email change, recovery links), `job-database.ts` (builds the `JobDatabase` handed to jobs).
- Depends on: Postgres as the service role, GoTrue admin API.
- Used by: `apps/service/src/main.ts` and `apps/service/src/cli.ts` only, plus the type-only `SystemHealthRow` import in `apps/service/src/http/context.ts`.

**Jobs:**
- Purpose: Scheduled and on-demand background work.
- Location: `apps/service/src/jobs/`
- Contains: `scheduler.ts` (registers cron tasks, runs and tracks jobs, `stop()` waits for in-flight runs), `advisory-lock.ts`, `refresh-deals.ts`, `log-autopay.ts`, `dispatch-notifications.ts`, `prune-cache.ts`, and `refresh-plan.ts`, which is a pure planner used by `refresh-deals.ts` and is not scheduled itself. `types.ts` defines the narrow `JobDatabase`, `DispatchOutbox`, and `JobLogger` interfaces.
- Depends on: `JobDatabase` injected from `apps/service/src/privileged/job-database.ts`, services.
- Used by: `apps/service/src/main.ts` (`createScheduler`, `scheduler.start()`), plus `queueBackgroundRefresh` injected into the deals service.

**External protocol adapters:**
- Purpose: Isolate third-party protocols.
- Location: `apps/service/src/gotrue/` (GoTrue HTTP client), `apps/service/src/auth/jwt.ts` (token verification: HS256 with `JWT_SECRET`; ES256 only for keys GoTrue publishes at its JWKS endpoint), `apps/service/src/deals/flipp/` (Flipp HTTP through one rate-limited queue, fixture transport for E2E), `apps/service/src/deals/price/` (price parsing), `apps/service/src/recipes/` (recipe fetch, JSON-LD, host rate limiter, private-address guard), `apps/service/src/push/` (Web Push transport, recording transport, E2E test seam).
- Used by: `apps/service/src/main.ts`, which injects them into `buildApp` and the scheduler.

**Shared packages (pure):**
- Purpose: One contract and one set of rules for both sides of the API.
- Location: `packages/shared/src/` (Zod request/response schemas in `api/`, problem details, scrubbing, password rules; subpath export `@hearth/shared/common-passwords`), `packages/recurrence/src/` (bill and chore occurrence and rotation), `packages/matching/src/` (ingredient normalization, similarity, matcher).
- Depends on: Zod, date-fns and `@date-fns/tz` (recurrence), `fastest-levenshtein` (matching). No I/O.
- Used by: `apps/web`, `apps/service`, and `supabase/seed` (matching).

## Data Flow

### Primary Request Path (authenticated household write)

Example: `POST /api/households/:id/bills`, defined in `apps/service/src/routes/bills.ts`.

1. Caddy terminates the request and proxies `/api/*` to `hearth-service:3000` with the resolved client address (`docker/Caddyfile`).
2. `buildApp` in `apps/service/src/app.ts` runs the global rate limit (only `/api/*` routes are limited) and dispatches to the plugin.
3. `ctx.authenticate(request)` reads the `Authorization: Bearer` header and verifies the token; failures become 401 problems (`apps/service/src/http/context.ts`).
4. `parse(householdIdParamsSchema, request.params)` and `parse(createBillRequestSchema, request.body)` validate input; failures become 400 problems.
5. `ctx.inHousehold(user, id, fn)` opens `withUserDb`: a transaction with `set local role authenticated` and `request.jwt.claims` set, then calls `markHouseholdActive`, which answers 404 to non-members.
6. `createHouseholdBill(db, id, user.id, body)` in `apps/service/src/services/bills.ts` runs its queries; RLS policies in `supabase/migrations/20260919070100_rls.sql` apply to every statement.
7. The route returns `reply.code(201).send(bill)`. The transaction commits when the callback resolves and rolls back when it throws.

### Error Path

1. Services throw `ProblemError` via `fail(status, detail)` (`apps/service/src/problem.ts`).
2. The global `setErrorHandler` in `apps/service/src/app.ts` maps Postgres errors (`problemFromDatabaseError`), GoTrue errors, and recipe fetch errors to problems.
3. For status 500 and above, the handler logs a scrubbed record, calls `deps.recordError` (which writes through `withAnonDb` to `public.record_app_error`), and returns a generic problem with no internal detail.

### Offline Write Path (list items, chore and errand writes)

1. `apps/web/src/main.tsx` calls `registerQueueDefaults` before the persisted cache hydrates (`apps/web/src/lib/offline/chore-errand-writes.ts`, `apps/web/src/lib/offline/write-queue.ts`).
2. A queueable mutation runs as a TanStack mutation; while offline it stays paused.
3. `PersistQueryClientProvider` (`apps/web/src/App.tsx`) stores the paused mutation in IndexedDB through `apps/web/src/lib/offline/persist.ts`; the flush persister writes it immediately.
4. On hydrate, `onSuccess` calls `resumePausedMutations()`, so queued writes resume after a reload.
5. Other writes (bills, recipes, households) are ordinary online mutations; their controls are disabled while offline.

### Realtime Sync Path

1. `apps/web/src/lib/realtime/supabase-realtime.ts` creates a realtime port over the lazily loaded Supabase client.
2. `apps/web/src/lib/realtime/use-list-realtime.ts` subscribes per list; Caddy proxies `/realtime/v1/*` through Kong to the Realtime service.
3. A realtime message only invalidates the affected TanStack queries (for example `queryKeys.list` and `queryKeys.lists` in `apps/web/src/lib/realtime/use-list-realtime.ts`); the server stays the source of truth.

### Scheduled Job Path

1. `apps/service/src/main.ts` builds the scheduler with `createJobDatabase` (service role) and injected dispatch and refresh dependencies, then calls `scheduler.start()`.
2. `apps/service/src/jobs/scheduler.ts` registers four `node-cron` tasks in UTC:
   - `refresh-deals`: `0 8 * * *`
   - `log-autopay`: `*/2 * * * *`
   - `dispatch-notifications`: `*/2 * * * *`
   - `prune-cache`: `0 4 * * *`
3. Each run goes through `withJobLock` (`apps/service/src/jobs/advisory-lock.ts`), which takes `pg_try_advisory_lock` on a dedicated connection and skips if the lock is held.
4. Errors are logged with scrubbed messages; `stop()` waits for in-flight runs before the pool closes.

### Notification Pipeline

1. Producers write notification rows through database functions and services (`supabase/migrations/20261004090000_notification_producers.sql`, `apps/service/src/services/notifications.ts`).
2. `apps/service/src/jobs/dispatch-notifications.ts` consumes a `DispatchOutbox` built in `apps/service/src/privileged/notification-outbox.ts`.
3. Pushes go through `apps/service/src/push/web-push-transport.ts`; with `HEARTH_PUSH_TRANSPORT=test-double` the recording transport is used instead.
4. The browser receives pushes in `apps/web/src/sw.ts` and `apps/web/src/lib/push/service-worker-handlers.ts`.

### Deals and Recipe Import Paths

- Deals: `apps/service/src/routes/deals.ts` calls `DealsService` (`apps/service/src/services/deals/deals.ts`), which reads through caches in `services/deals/cache.ts` and `services/deals/storage.ts`. Fetches to Flipp go through the single `FlippRequestQueue` (`apps/service/src/deals/flipp/request-queue.ts`) shared by requests and the refresh job.
- Recipes: `apps/service/src/routes/recipes.ts` calls `parseRecipeUrl` (`apps/service/src/recipes/parse-recipe-url.ts`), which fetches through `fetch-recipe.ts` and `host-rate-limiter.ts`, and extracts JSON-LD with `json-ld.ts`.

**State Management:**
- Server state: Postgres, read through the service, cached in TanStack Query and persisted to IndexedDB (`apps/web/src/lib/api/query-client.ts`, `apps/web/src/lib/offline/persist.ts`).
- Session: Supabase auth client (`apps/web/src/lib/auth/auth-client.ts`), exposed through `useAuthState`; `RequireSession` and `SignedOutOnly` in `apps/web/src/screens/AuthenticatedLayout.tsx` act as route guards.
- Active household: stored on `profile.active_household_id` and stamped by `markHouseholdActive` (`apps/service/src/services/households.ts`) on each household-scoped request.
- In-memory service state: skip-rate registry (`apps/service/src/services/skip-rates.ts`), Flipp request queue, recipe host rate limiter.

## Key Abstractions

**RouteContext and `withUserDb`:**
- Purpose: The only sanctioned way for a request to reach the database as a user.
- Examples: `apps/service/src/http/context.ts`, `apps/service/src/db/user-db.ts`
- Pattern: Transaction-local role switch and claims. `inHousehold` also returns 404 to non-members.

**Route plugin:**
- Purpose: Each feature is one Fastify plugin receiving `{ ctx }`.
- Examples: `apps/service/src/routes/bills.ts`, `apps/service/src/routes/lists.ts`
- Pattern: `export const billRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => { app.get(...) }`

**Shared schema:**
- Purpose: One definition for request validation, response parsing on the client, and OpenAPI.
- Examples: `packages/shared/src/api/bills.ts`, `packages/shared/src/api/lists.ts`, `apps/service/src/openapi.ts`
- Pattern: Schema exported from `@hearth/shared`, used by `parse(...)` on the server and by `api.request({ schema })` on the client.

**Injected narrow capabilities:**
- Purpose: Give jobs and routes only the privilege they need.
- Examples: `apps/service/src/jobs/types.ts` (`JobDatabase`, `DispatchOutbox`), `apps/service/src/privileged/job-database.ts`
- Pattern: Dependency injection from `main.ts` into `createScheduler({ database, dispatch, refresh })` and `buildApp(deps, options)`.

**Pillars and released sections:**
- Purpose: Declares each top-level area (Lists, Meals, Bills, Chores; Deals, Flyers, and Pantry are sub-tabs of Lists) and whether it is released. All four are in `RELEASED_PILLARS` today.
- Examples: `apps/web/src/lib/sections.ts` (`PILLARS`, `RELEASED_PILLARS`), `apps/web/src/pillars/*/*Route.tsx`
- Pattern: Unreleased pillars render `ComingSoon` through `PillarScreen` (`apps/web/src/screens/PillarScreen.tsx`).

**Problem details:**
- Purpose: Uniform error contract across service and client.
- Examples: `apps/service/src/problem.ts`, `packages/shared/src/problem.ts`, `apps/web/src/lib/api/problem.ts`
- Pattern: `fail(status, detail)` throws a `ProblemError`; the error handler sends `application/problem+json`. The detail of an unexpected 5xx error never reaches the client: it is scrubbed, recorded through `recordAppError`, and the reply is a generic problem. Client `ApiError` has status 0 for network failures.

## Entry Points

**Service process:**
- Location: `apps/service/src/main.ts`
- Triggers: `node dist/main.js` in the `hearth-service` container (`docker/service.Dockerfile`, `CMD ["node", "dist/main.js"]`); `pnpm --filter @hearth/service dev` runs `tsx watch src/main.ts`.
- Responsibilities: Parse env (`apps/service/src/env.ts`), build the pool, GoTrue, Flipp, recipe, and push clients, call `buildApp`, start the scheduler, handle SIGTERM and SIGINT, listen on the configured host and port.

**Owner CLI:**
- Location: `apps/service/src/cli.ts`, built to `apps/service/dist/cli.js`. The hand-written POSIX shell wrapper `apps/service/bin/hearth-admin` resolves its own path and runs `node dist/cli.js`.
- Triggers: `docker compose exec hearth-service hearth-admin reset-password <email>`.
- Responsibilities: Creates a one-time GoTrue recovery link through the admin API. The only CLI command is `reset-password`.

**Web bootstrap:**
- Location: `apps/web/src/main.tsx`
- Triggers: Browser load of the PWA.
- Responsibilities: Install error reporting, create the Supabase client, auth client, query client, and write-queue defaults, then render `<App>` with the realtime port and persisters.

**Web routes:**
- Location: `apps/web/src/routes.tsx`
- Triggers: Every navigation.
- Responsibilities: Map paths to lazily loaded screens. `/` is the dashboard (`DashboardRoute`). Public routes are `/sign-in`, `/sign-up`, `/forgot-password`, `/set-password`. `/onboarding` and `/join` require a session. Pillar routes and Settings sit under `AuthenticatedLayout`. Magic-link routes exist only when `VITE_MAGIC_LINK_ENABLED` is `'true'` at build time.

**Service worker:**
- Location: `apps/web/src/sw.ts` (built with `injectManifest` by `vite-plugin-pwa`, `apps/web/vite.config.ts`)
- Triggers: Browser service worker lifecycle.
- Responsibilities: Precache, navigation fallback, offline caching strategies, push event display (`apps/web/src/lib/push/service-worker-handlers.ts`).

**Database schema:**
- Location: `supabase/migrations/*.sql` (applied in filename order; eight files from `20260919060000_hearth_service_role.sql` to `20261004090100_depart_clears_notification_preferences.sql`).
- Triggers: `supabase db reset`, `supabase start`, the database container's init scripts (`docker/docker-compose.yml`), and `scripts/deploy.sh`, which runs `supabase migration up` against the Compose database.
- Responsibilities: Schema, RLS policies, helper and lifecycle functions, realtime publication, notification send times and producers.

**Build and deploy:**
- `apps/service/src/write-openapi.ts` runs at the end of the service `build` script and emits the OpenAPI document.
- `.github/workflows/deploy.yml` runs on `workflow_run` after a successful push-triggered CI run on `main`, on the self-hosted runner, and executes `scripts/deploy.sh`.

## Architectural Constraints

- **Threading:** Single-threaded Node event loop for the service; async I/O only. No worker threads.
- **Process count:** One service process is assumed. Cron jobs and in-memory state (Flipp queue, recipe rate limiter, skip rates) are per process. Advisory locks prevent overlap of the same job, and only through the database.
- **Global state:** Module-level singletons are created in `apps/service/src/main.ts` (`wiring`, `skipRates`, `flippQueue`, `recipeFetchLimiter`, `recordingTransport`). The web client creates its singletons in `apps/web/src/main.tsx`.
- **Build-time configuration:** `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, and `VITE_MAGIC_LINK_ENABLED` are fixed at build time; a change requires a rebuild.
- **Test-only seams:** Fixture transports (`HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`), the push double (`HEARTH_PUSH_TRANSPORT=test-double`) (all set only by the E2E Compose overlay, `e2e/docker-compose.e2e.yml`), and the `POST /api/test/push/dispatch` and `GET /api/test/push/deliveries` routes in `apps/service/src/push/test-seam.ts`. The seam is registered only when `main.ts` passes it, which happens only for the test-double transport.
- **Pinned origin:** The public origin is part of installed PWAs and push subscriptions (`README.md`, "Pinned names"). `HEARTH_ORIGIN` is used for invite links and the user agent; changing the host is a breaking change.
- **Public unauthenticated routes:** `/api/health`, `/api/signup`, `/api/client-error` (rate limited per IP, `apps/service/src/routes/system.ts`), `/api/openapi.json`. All others call `ctx.authenticate`.

## Layering Deviations (observed)

These are places where the code does not follow the default layering. Each is deliberate or noted for review; none is a behavior change proposal.

- **Chores and errands** do not live under `services/`. `apps/service/src/routes/chores.ts` and `routes/errands.ts` import from the domain folder `apps/service/src/chores/`. Searching only `services/` misses this logic.
- **Deals** span two folders: the orchestrator `apps/service/src/services/deals/deals.ts` and the Flipp adapter in `apps/service/src/deals/flipp/`.
- **Deals route opens its own transaction:** `apps/service/src/routes/deals.ts` calls `withUserDb` directly (the `claimForUser` helper) so a dormant postal-code claim commits independently of the request. This is the only route file that imports `withUserDb`.
- **Type-only privileged import:** `apps/service/src/http/context.ts` imports `SystemHealthRow` from `apps/service/src/privileged/service-role-db.ts`. The lint fence allows type imports.
- **Shadowed sub-route:** `apps/web/src/routes.tsx` maps `lists/deals` and `lists/flyers` before the `lists/*` pillar wrapper, so the `deals` branch inside `apps/web/src/pillars/lists/ListsRoute.tsx` (which renders `SubSectionComingSoon`) is not reached through the router.

## Anti-Patterns

These are the patterns the codebase forbids. Each one has a sanctioned alternative already in place.

### Querying the database outside `withUserDb`

- **What happens:** A route or service receives the raw `db` handle and runs queries on it directly.
- **Why it's wrong:** Nothing sets the caller's role and claims, so RLS has no caller to judge. `hearth_service` is NOINHERIT and holds no table rights until a transaction switches role (`supabase/migrations/20260919060000_hearth_service_role.sql`), so such a query fails; the shortcut of switching to `service_role` by hand runs outside the policies, because `service_role` bypasses RLS.
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

**Strategy:** Errors are problem details end to end. Business-rule violations are caller-facing; unexpected errors are scrubbed, recorded, and reduced to a generic problem.

**Patterns:**
- Route code throws `fail(status, detail)` or a service-level error (`apps/service/src/services/errors.ts`). The error handler maps it (`apps/service/src/app.ts`).
- Postgres errors map by SQLSTATE through `DATABASE_PROBLEMS` in `apps/service/src/problem.ts`, via `problemFromDatabaseError`. GoTrue errors map through `problemFromGoTrueError` and recipe fetch errors through `problemFromRecipeFetchError`, both in the same file.
- Server errors are recorded through `recordAppError`, which writes as `anon` through `public.record_app_error` (`apps/service/src/db/user-db.ts`, `withAnonDb`).
- The client throws `ApiError`; the query layer decides on retry (`apps/web/src/lib/api/client.ts`, `apps/web/src/lib/offline/write-queue.ts`).
- Render-time crashes are caught by `apps/web/src/components/states/ErrorBoundary.tsx` and the router's `errorElement` (`RouteError` in `apps/web/src/routes.tsx`).

## Cross-Cutting Concerns

**Logging:** Fastify's pino logger in the service, with the request serializer limited to method, path (no query string), and remote address (`apps/service/src/app.ts`). Request IDs are generated server-side. Job loggers are child loggers bound to the job name (`apps/service/src/jobs/scheduler.ts`). The web client reports through `apps/web/src/lib/error-reporting.ts`.

**Validation:** Zod schemas from `packages/shared` on both sides; service input validated at the route boundary with `parse`; web-side field errors through `apps/web/src/lib/use-field-errors.ts` and `apps/web/src/lib/validation.ts`.

**Authentication:** Supabase/GoTrue issues tokens; the service verifies them with `JWT_SECRET` (HS256), and accepts ES256 only for keys GoTrue publishes at its JWKS endpoint, as `supabase start` signs (`apps/service/src/auth/jwt.ts`). Owner checks use `HEARTH_OWNER_EMAIL` through `isOwner` in `apps/service/src/http/context.ts`. Caddy refuses GoTrue's public signup and user-update endpoints from outside (`docker/Caddyfile`), so account password changes and signups must go through `POST /api/signup` (`apps/service/src/routes/auth.ts`) and `POST /api/users/me/password` (`apps/service/src/routes/users.ts`, which re-verifies the current password first).

**Isolation:** Enforced in Postgres by RLS (`supabase/migrations/20260919070100_rls.sql`), with `hearth_service` as a NOINHERIT login role (`docker/db/hearth-service-login.sql`, `supabase/migrations/20260919060000_hearth_service_role.sql`).

---

*Architecture analysis: 2026-10-22*
