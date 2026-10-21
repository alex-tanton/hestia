---
last_mapped_commit: 431e646ab110c804b7229cecc9e151d343790b3a
last_mapped_at: 2026-10-21
---
<!-- refreshed: 2026-10-21 -->

# Architecture

**Analysis Date:** 2026-10-21

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     Browser: installable PWA (apps/web)                   │
│  screens/ + pillars/ + components/  →  lib/api (TanStack Query hooks)     │
│  lib/auth (Supabase auth client)    lib/realtime   lib/offline (IDB)      │
└───────────┬────────────────────────────────┬─────────────────┬───────────┘
            │ /api/* (bearer JWT)            │ /auth/v1, /realtime │ static
            ▼                                ▼                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Caddy (docker/Caddyfile)  — static PWA + reverse proxy, :8080 on loopback │
└───────────┬────────────────────────────────┬─────────────────────────────┘
            │ /api/*                         │ auth, realtime
            ▼                                ▼
┌───────────────────────────────┐   ┌──────────────────────────────────────┐
│ hearth-service (apps/service) │   │ Kong (docker/kong.yml) → GoTrue,     │
│  app.ts  → routes/*.ts        │   │ Realtime                              │
│  http/context.ts (auth, scope)│   └──────────────────┬───────────────────┘
│  services/*.ts (rules)        │                      │
│  jobs/ (node-cron scheduler)  │                      │
│  privileged/ (service_role)   │──── GoTrue admin API ┘
└───────┬──────────────┬────────┘
        │ hearth_service role, withUserDb / withAnonDb / privileged fns
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Postgres 17 (supabase/migrations/*.sql) — RLS policies are the isolation │
│  boundary; helper functions, notification outbox, record_app_error        │
└──────────────────────────────────────────────────────────────────────────┘

Shared pure packages used across the boundary:
  packages/shared (Zod schemas, problem details, scrubbing)
  packages/recurrence (bill/chore occurrence and rotation)
  packages/matching (ingredient/item matching)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Service bootstrap | Reads env, builds Flipp/recipe/push clients, builds the Fastify app, starts the scheduler, handles SIGTERM/SIGINT | `apps/service/src/main.ts` |
| App assembly | Error handler, global rate limit, registers every route plugin under `/api` | `apps/service/src/app.ts` |
| Env validation | Zod parse of process env; fails startup on invalid values | `apps/service/src/env.ts` |
| Route context | Bearer-token authentication, `asUser` / `inHousehold` helpers that wrap `withUserDb` | `apps/service/src/http/context.ts` |
| RLS transaction wrapper | `set local role authenticated`, installs JWT claims; `withAnonDb` for error recording | `apps/service/src/db/user-db.ts` |
| Database pool | Kysely over `pg`, connects as `hearth_service` | `apps/service/src/db.ts`, `apps/service/src/db/types.ts` (generated) |
| Routes | Thin HTTP layer per feature: parse input with shared schemas, call a service, shape the reply | `apps/service/src/routes/*.ts` |
| Services | Business rules per feature (recurrence, repricing, readiness, membership, invites, notifications) | `apps/service/src/services/*.ts`, `apps/service/src/services/deals/` |
| Jobs | Cron-driven work: deal refresh, autopay logging, notification dispatch, cache pruning, plan refresh | `apps/service/src/jobs/*.ts` |
| Scheduler | Registers node-cron tasks; wraps each run in an advisory lock | `apps/service/src/jobs/scheduler.ts`, `apps/service/src/jobs/advisory-lock.ts` |
| Privileged access | The only `service_role` code: notification outbox, GoTrue admin, job DB, system health, scheduled reminders | `apps/service/src/privileged/*.ts` |
| Auth verification | JWT verify and JWKS fetch from GoTrue | `apps/service/src/auth/jwt.ts`, `apps/service/src/gotrue/client.ts` |
| Deals source | Flipp HTTP client behind one rate-limited request queue; fixture transport for E2E | `apps/service/src/deals/flipp/*.ts`, `apps/service/src/deals/deal-source.ts` |
| Recipe import | Fetch pasted URL server-side, extract JSON-LD, parse ingredients, per-host rate limit | `apps/service/src/recipes/*.ts` |
| Push | Web Push transport (VAPID), recording transport for E2E, E2E seam route | `apps/service/src/push/*.ts` |
| CLI | `hearth-admin` owner commands (password reset, etc.) | `apps/service/src/cli.ts`, `apps/service/bin/hearth-admin` |
| Web bootstrap | Creates the Supabase client, auth client, query client, persisters, realtime port | `apps/web/src/main.tsx` |
| Web routing | Route table with lazy-loaded screens and session guards | `apps/web/src/routes.tsx`, `apps/web/src/screens/AuthenticatedLayout.tsx` |
| API client | `fetch` wrapper that attaches the bearer token, refreshes once, parses problem responses | `apps/web/src/lib/api/client.ts` |
| Query hooks | TanStack Query hooks per domain, validated with shared Zod schemas | `apps/web/src/lib/api/hooks.ts`, `apps/web/src/lib/api/*-hooks.ts` |
| Offline writes | Queueable mutations as paused TanStack mutations, persisted to IndexedDB | `apps/web/src/lib/offline/write-queue.ts`, `apps/web/src/lib/offline/persist.ts` |
| Realtime | Per-list Supabase channels for shopping list items and list row | `apps/web/src/lib/realtime/supabase-realtime.ts` |
| Service worker | Installability, offline caching, push display | `apps/web/src/sw.ts`, `apps/web/src/lib/push/service-worker-handlers.ts` |
| Shared contract | Request/response Zod schemas, OpenAPI source, problem details, scrubbing | `packages/shared/src/api/*.ts`, `packages/shared/src/problem.ts`, `packages/shared/src/scrub.ts` |
| Recurrence math | Pure bill and chore occurrence and rotation logic | `packages/recurrence/src/*.ts` |
| Matching | Pure ingredient normalization, similarity, matcher | `packages/matching/src/*.ts` |
| Schema | Migrations (schema, RLS, functions, realtime, notifications) | `supabase/migrations/*.sql` |

## Pattern Overview

**Overall:** Modular monolith in a pnpm workspace. A single Fastify API process plus a React PWA, backed by Postgres with row-level security. The service is a thin, RLS-scoped gateway: business rules live in service modules, isolation lives in the database.

**Key Characteristics:**
- Every data-bearing request is authenticated by the service, then executed inside a Postgres transaction running as `authenticated` with the caller's claims. RLS decides what is visible, not application code (`apps/service/src/db/user-db.ts`, `docs/architecture.md`).
- The service is the only HTTP path to application data; PostgREST is not used. Supabase Auth and Realtime are reached directly through Caddy and Kong.
- Privileged `service_role` access is fenced into `apps/service/src/privileged/` and enforced by an ESLint `no-restricted-imports` rule (`eslint.config.js`).
- Background jobs run in-process via `node-cron` and are guarded against overlap with Postgres advisory locks (`apps/service/src/jobs/advisory-lock.ts`). The design assumes one running service instance.
- The web app is a route-split SPA: pillar tabs, Settings, and onboarding load lazily (`apps/web/src/routes.tsx`); the dashboard ships in the shell.
- Pure packages (`packages/recurrence`, `packages/matching`, `packages/shared`) hold logic shared across the API boundary and carry no framework or I/O dependency.
- Dependencies are injected by hand: `main.ts` builds concrete clients and passes narrow functions into `buildApp` and `createScheduler`. There is no DI container.

## Layers

**Web presentation:**
- Purpose: Render each route and interaction.
- Location: `apps/web/src/screens/`, `apps/web/src/components/`, `apps/web/src/pillars/`
- Contains: Screens (`*Screen.tsx`, `*Route.tsx`), feature components, UI primitives (`components/ui/`), shell (`components/shell/`), state blocks (`components/states/`).
- Depends on: `apps/web/src/lib/` hooks, `packages/shared` schemas and types, `packages/recurrence` for due-date display.
- Used by: `apps/web/src/routes.tsx` only.

**Web data access:**
- Purpose: Talk to the API and Supabase; manage cache and offline state.
- Location: `apps/web/src/lib/api/`, `apps/web/src/lib/auth/`, `apps/web/src/lib/offline/`, `apps/web/src/lib/realtime/`, `apps/web/src/lib/push/`
- Contains: `client.ts` (fetch wrapper), `*-hooks.ts` (TanStack Query hooks), `keys.ts` (query keys), `query-client.ts`, `write-queue.ts`, `persist.ts`.
- Depends on: `packages/shared`, `@supabase/supabase-js` (lazy), TanStack Query.
- Used by: screens and `apps/web/src/main.tsx`.

**HTTP routes (service):**
- Purpose: Map HTTP to domain calls.
- Location: `apps/service/src/routes/`
- Contains: One `FastifyPluginAsync<{ ctx: RouteContext }>` per feature (`bills.ts`, `chores.ts`, `lists.ts`, `households.ts`, `meal-plan.ts`, `deals.ts`, `errands.ts`, `recipes.ts`, `match-overrides.ts`, `users.ts`, `auth.ts`, `health.ts`, `system.ts`).
- Depends on: `apps/service/src/http/context.ts`, `apps/service/src/services/`, `packages/shared`.
- Used by: `apps/service/src/app.ts` registers each plugin under `/api`.

**Services (business rules):**
- Purpose: Business rules and the queries that implement them.
- Location: `apps/service/src/services/` (flat), `apps/service/src/services/deals/`, plus domain helpers in `apps/service/src/chores/`, `apps/service/src/notifications/`, `apps/service/src/recipes/`, `apps/service/src/deals/`.
- Contains: e.g. `listBills(db, householdId, userId)`, `payBill`, `repriceExpiredItems` (`services/repricing.ts`), `recomputeReadinessForHousehold` (`services/readiness.ts`).
- Depends on: `packages/recurrence`, `packages/matching`, `apps/service/src/db/types.ts`.
- Used by: routes and jobs. Each takes a Kysely handle that is already scoped by `withUserDb`.

**Database access:**
- Purpose: Run every request as the caller.
- Location: `apps/service/src/db.ts`, `apps/service/src/db/user-db.ts`, `apps/service/src/db/types.ts`
- Contains: `withUserDb` (authenticated role plus claims), `withAnonDb` (error recording only), Kysely types generated from the schema.
- Depends on: Postgres as `hearth_service` (NOINHERIT).
- Used by: `http/context.ts`, `main.ts` (error recorder), and `privileged/job-database.ts`.

**Privileged access:**
- Purpose: The few cross-household operations.
- Location: `apps/service/src/privileged/`
- Contains: `service-role-db.ts` (`withServiceRoleDb`, `readSystemHealth`), `notification-outbox.ts` (claim-then-send), `scheduled-reminders.ts`, `gotrue-admin.ts` (email change), `job-database.ts` (narrow job DB).
- Depends on: Postgres as `service_role`; GoTrue admin API.
- Used by: `main.ts` and `cli.ts` only at the module level. Routes and jobs receive narrow functions instead (`changeEmail`, `systemHealth`, `DispatchOutbox`, `JobDatabase`).

**Jobs:**
- Purpose: Scheduled and on-demand background work.
- Location: `apps/service/src/jobs/`
- Contains: `refresh-deals.ts`, `log-autopay.ts`, `dispatch-notifications.ts`, `prune-cache.ts`, `refresh-plan.ts`; `scheduler.ts` registers the crons; `advisory-lock.ts` wraps each run; `types.ts` declares the narrow `JobDatabase`, `JobLogger`.
- Depends on: `jobs/types.ts`, services.
- Used by: `apps/service/src/main.ts` (`createScheduler`, `scheduler.start()`).

**Third-party adapters:**
- Purpose: Isolate external protocols.
- Location: `apps/service/src/gotrue/` (GoTrue HTTP), `apps/service/src/auth/jwt.ts` (JWT verify, JWKS), `apps/service/src/deals/flipp/` (Flipp), `apps/service/src/recipes/` (URL fetch and JSON-LD), `apps/service/src/push/` (Web Push).
- Used by: `main.ts` injects them into `buildApp` and the scheduler.

**Shared contract and pure logic:**
- Purpose: One contract and one set of rules for both sides of the API.
- Location: `packages/shared/src/`, `packages/recurrence/src/`, `packages/matching/src/`
- Depends on: Zod, date-fns (recurrence) and no I/O.
- Used by: `apps/web`, `apps/service`, and `supabase/seed` (matching).

## Data Flow

### Primary Request Path (authenticated read or write)

1. Caddy terminates the public origin and proxies `/api/*` to the service (`docker/Caddyfile`).
2. `app.ts` applies the per-IP rate limit to `/api/*` and trusts proxies listed in `HEARTH_TRUSTED_PROXIES` (`apps/service/src/app.ts`).
3. The route plugin calls `ctx.authenticate(request)`, which reads the `Bearer` token and verifies it via `deps.verifyToken` (`apps/service/src/http/context.ts`, `apps/service/src/auth/jwt.ts`).
4. The route parses the body or params with a shared schema via `parse(schema, value)` (`apps/service/src/http/context.ts`, schemas in `packages/shared/src/api/*.ts`).
5. The route calls `ctx.inHousehold(user, householdId, fn)` or `ctx.asUser(user, fn)`, which opens a transaction with `set local role authenticated` and the JWT claims (`apps/service/src/db/user-db.ts`). `inHousehold` first stamps the household active and answers 404 to non-members.
6. The service function runs its queries; RLS filters rows as the caller.
7. The route returns the value or `reply.code(201).send(...)`. Errors are thrown as `ProblemError` and rendered as `application/problem+json` by the global handler (`apps/service/src/problem.ts`).

### Offline Write Path

1. Queueable writes (list items, chore and errand writes) are TanStack mutations registered in `apps/web/src/lib/offline/chore-errand-writes.ts` and `write-queue.ts`.
2. While offline the mutation pauses; `persist.ts` stores the paused mutation and cache in IndexedDB via `idb-keyval`.
3. On reconnect, `use-write-queue.ts` resumes the mutations; each replays through the normal API client.
4. Other writes are ordinary online mutations that disable controls while offline.

### Realtime Sync Path

1. `apps/web/src/lib/realtime/supabase-realtime.ts` subscribes to per-list Supabase channels routed through Kong.
2. A change event invalidates the matching TanStack Query keys (`apps/web/src/lib/api/keys.ts`), prompting a refetch through the service.
3. The change feed is a signal only; authorization still applies on the refetch.

### Scheduled Job Path

1. `main.ts` builds the scheduler with a `JobDatabase` from `privileged/job-database.ts` and dispatch/refresh deps.
2. `scheduler.ts` registers node-cron tasks in UTC (`refresh-deals` 08:00, `log-autopay` and `dispatch-notifications` every 2 minutes, `prune-cache` 04:00).
3. Each run calls `withJobLock` (`pg_try_advisory_lock(hashtext('<job name>'))`) and skips if the lock is held.
4. Jobs resolve user-facing time against household or user timezones inside the job, not at cron time.

### Notification Pipeline

1. Planners in `apps/service/src/notifications/planners.ts` and producers in the database (`supabase/migrations/20261004090000_notification_producers.sql`) enqueue outbox rows.
2. `dispatch-notifications` claims rows through `privileged/notification-outbox.ts` (claim-then-send), then calls the push transport (`push/web-push-transport.ts`).
3. The service worker displays the push (`apps/web/src/lib/push/service-worker-handlers.ts`).

**State Management:**
- Server state: Postgres, read through the service. Web caches it in TanStack Query, persisted to IndexedDB (`apps/web/src/lib/api/query-client.ts`, `apps/web/src/lib/offline/persist.ts`).
- Session: Supabase auth client (`apps/web/src/lib/auth/auth-client.ts`), gated by `RequireSession` and `SignedOutOnly` in `apps/web/src/screens/AuthenticatedLayout.tsx`.
- Active household: stored on `profile.active_household_id`, stamped by `markHouseholdActive` (`apps/service/src/services/households.ts`).
- Service in-memory state: deal skip rates (`apps/service/src/services/skip-rates.ts`), the Flipp request queue (`apps/service/src/deals/flipp/request-queue.ts`), the recipe host rate limiter (`apps/service/src/recipes/host-rate-limiter.ts`).

## Key Abstractions

**RLS-scoped database handle:**
- Purpose: The only sanctioned way for a request to reach the database.
- Examples: `apps/service/src/db/user-db.ts`, `apps/service/src/http/context.ts`
- Pattern: Transaction-local role switch and claims. `inHousehold` also answers 404 to non-members.

**Route plugin:**
- Purpose: Each feature is one Fastify plugin receiving `{ ctx: RouteContext }`.
- Examples: `apps/service/src/routes/bills.ts`, `apps/service/src/routes/lists.ts`
- Pattern: `export const billRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => { app.get(...) }`

**Shared API schema:**
- Purpose: One definition for request validation, response parsing, and OpenAPI.
- Examples: `packages/shared/src/api/bills.ts`, `packages/shared/src/api/lists.ts`, `apps/service/src/openapi.ts`
- Pattern: Schema exported from `@hearth/shared`, used by `parse(...)` on the server and by the client request helper on the web.

**Narrow job capabilities:**
- Purpose: Capabilities handed to jobs so they cannot reach `service_role` directly.
- Examples: `apps/service/src/jobs/types.ts`, `apps/service/src/privileged/job-database.ts`
- Pattern: Dependency injection from `main.ts` through `createScheduler({ database, dispatch, refresh })`.

**Pillar:**
- Purpose: Declares each top-level area (Lists, Meals, Chores, Bills, Deals) and whether it is released.
- Examples: `apps/web/src/lib/sections.ts` (`PILLARS`, `RELEASED_PILLARS`), `apps/web/src/pillars/*/*Route.tsx`
- Pattern: Unreleased pillars render `ComingSoon` through `PillarScreen`.

**Problem details:**
- Purpose: Uniform error contract across service and client.
- Examples: `apps/service/src/problem.ts`, `packages/shared/src/problem.ts`, `apps/web/src/lib/api/problem.ts`
- Pattern: `fail(status, detail)` throws a `ProblemError`. The error handler sends `application/problem+json`. Non-5xx details reach clients; 5xx details are scrubbed and recorded through `recordAppError`.

**Dependency-injected port interfaces (web):**
- Purpose: Keep the browser singletons swappable.
- Examples: `AuthClient`, `RealtimePort`, `PushPort` referenced from `apps/web/src/main.tsx` and `apps/web/src/lib/api/api-context.tsx`.

## Entry Points

**Service process:**
- Location: `apps/service/src/main.ts`
- Triggers: `node` on the built bundle `dist/main.js` in the `hearth-service` container (`docker/service.Dockerfile`), or `pnpm --filter @hearth/service dev`.
- Responsibilities: Parse env, build clients, call `buildApp`, start the scheduler, register SIGTERM/SIGINT shutdown, listen on `HOST`/`PORT`.

**Admin CLI:**
- Location: `apps/service/src/cli.ts` (wrapper `apps/service/bin/hearth-admin`)
- Triggers: Manual operator command, e.g. `hearth-admin reset-password <email>`.
- Responsibilities: Privileged operations through GoTrue admin with `SERVICE_ROLE_KEY`.

**Web app:**
- Location: `apps/web/src/main.tsx`
- Triggers: Browser load of the PWA.
- Responsibilities: Install error reporting, create Supabase, auth, and query clients, register queue defaults before cache hydration, render `<App>` (`apps/web/src/App.tsx`).

**Web routes:**
- Location: `apps/web/src/routes.tsx`
- Triggers: Every navigation.
- Responsibilities: Map paths to lazy screens. `/` is the dashboard (`DashboardRoute`). `/sign-in`, `/sign-up`, `/set-password`, and `/forgot-password` are public. `/onboarding` and `/join` require a session. Pillar routes sit under `AuthenticatedLayout`. Magic-link routes exist only when `VITE_MAGIC_LINK_ENABLED` is `true` at build time.

**Service worker:**
- Location: `apps/web/src/sw.ts`
- Triggers: Browser service worker lifecycle.
- Responsibilities: Precache, offline support, push event display.

**Database migrations:**
- Location: `supabase/migrations/` (applied in filename order)
- Triggers: `supabase db reset`, `supabase start`, and `scripts/deploy.sh`.
- Responsibilities: Schema, RLS, helper and lifecycle functions, realtime publication, notification send-time logic.

## Architectural Constraints

- **Threading:** Single-threaded Node event loop for the service. Work runs as async I/O. No worker threads are used.
- **Process count:** One service process is assumed. Cron jobs and in-memory queues (Flipp, recipe rate limiter, skip rates) are per process. Advisory locks protect jobs only against overlap within the database.
- **Global state:** Module-level singletons are built in `apps/service/src/main.ts` (`wiring`, `skipRates`, `flippQueue`, `recipeFetchLimiter`, `recordingTransport`). The web client builds its singletons in `apps/web/src/main.tsx`.
- **Build-time configuration:** `VITE_MAGIC_LINK_ENABLED` and `VITE_SUPABASE_ANON_KEY` are fixed at build time (`apps/web/src/routes.tsx`, `apps/web/src/main.tsx`). Changing them requires a rebuild.
- **Test-only seams:** Fixture transports (`HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`) and the push double (`HEARTH_PUSH_TRANSPORT=test-double`) are reachable only through the E2E Compose overlay (`e2e/docker-compose.e2e.yml`). The E2E push seam route is registered only when that switch is set (`apps/service/src/app.ts`, `apps/service/src/push/test-seam.ts`).
- **Pinned origin:** The public origin is baked into installed PWAs and push subscriptions (`README.md`). Changing the host is a breaking change.
- **Circular imports:** Not analyzed in this pass.

## Anti-Patterns

These are the patterns the codebase forbids. Each one has a sanctioned alternative already in place.

### Querying the database outside `withUserDb`

**What happens:** A route or service receives the raw `db` handle and runs queries directly.
**Why it's wrong:** The query runs as `hearth_service` without the caller's claims, bypassing the RLS boundary.
**Do this instead:** Go through `ctx.inHousehold(user, householdId, fn)` or `ctx.asUser(user, fn)` (`apps/service/src/http/context.ts`).

### Importing `privileged/` from a route, service, or job

**What happens:** A feature module imports `apps/service/src/privileged/*` to reach `service_role`.
**Why it's wrong:** It widens the blast radius of the service-role key beyond the few audited uses.
**Do this instead:** Accept a narrow function or interface injected through `RouteContext` or the scheduler deps (`changeEmail`, `systemHealth`, `JobDatabase`). `eslint.config.js` enforces this.

### Enforcing household isolation only in application code

**What happens:** A query filters by `household_id` in TypeScript and skips RLS.
**Why it's wrong:** A missed filter leaks another household's data; RLS is the backstop.
**Do this instead:** Write the access rule as a policy in `supabase/migrations/20260919070100_rls.sql` and reach data through `withUserDb`.

### Duplicating schemas on client and server

**What happens:** A request shape is redefined in `apps/web` or `apps/service`.
**Why it's wrong:** Validation drifts between the two sides of the API.
**Do this instead:** Define the Zod schema once in `packages/shared/src/api/*.ts` and import it on both sides.

### Hand-edited generated database types

**What happens:** `apps/service/src/db/types.ts` is edited by hand.
**Why it's wrong:** The next `kysely-codegen` run overwrites the change, and types diverge from the schema.
**Do this instead:** Change the migration, then run `pnpm db:types`.

## Error Handling

**Strategy:** Typed problem responses on the wire; scrubbed recording for server faults.

**Patterns:**
- Route code throws `fail(status, detail)` or a service-level error from `apps/service/src/services/errors.ts`. The error handler maps it (`apps/service/src/app.ts`).
- Postgres errors map through `problemFromDatabaseError` (SQLSTATE table in `apps/service/src/problem.ts`). GoTrue errors map through `problemFromGoTrueError` (`apps/service/src/gotrue/http.ts`). Recipe fetch errors map through `problemFromRecipeFetchError`.
- Server errors are recorded via `recordAppError`, which writes through `public.record_app_error` as `anon` (`apps/service/src/db/user-db.ts`, `withAnonDb`).
- The web client throws `ApiError` (status 0 for network failures); the query layer decides retries (`apps/web/src/lib/api/client.ts`, `apps/web/src/lib/offline/write-queue.ts`).
- Render-time errors are caught by `apps/web/src/components/states/ErrorBoundary.tsx` and the router's `errorElement` (`RouteError` in `apps/web/src/routes.tsx`).

## Cross-Cutting Concerns

**Logging:** Fastify's pino logger in `apps/service/src/app.ts`; query strings are stripped from logged paths. No `console.*` in shipped source.
**Validation:** Zod schemas from `packages/shared` at the route boundary (`parse`) and in web hooks.
**Authentication:** Bearer JWT verified against GoTrue JWKS in `apps/service/src/auth/jwt.ts`; the owner is identified by `HEARTH_OWNER_EMAIL` (`isOwner` in `RouteContext`).
**Rate limiting:** `@fastify/rate-limit` on `/api/*` (`HEARTH_RATE_LIMIT_PER_MINUTE`); Flipp and recipe fetches have their own outbound limiters.
**Time:** Jobs run in UTC; user-facing dates resolve in household timezone. Tests pin `Date` through `test/clock-setup.mjs`.

---

*Architecture analysis: 2026-10-21*
