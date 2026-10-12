---
last_mapped_commit: b96ca32ac1130c09f8aa3066d715181ddf3fb31a
last_mapped_at: 2026-10-11
---
<!-- refreshed: 2026-10-11 -->

# Architecture

**Analysis Date:** 2026-10-11

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                  Browser: installed PWA (React + Vite)                    │
│  `apps/web/src/main.tsx` → `App.tsx` → `routes.tsx` → `screens/*`        │
│  TanStack Query cache + offline write queue  (`apps/web/src/lib/offline`)│
└───────────────┬───────────────────────────────────────┬──────────────────┘
                │ /api/* (Bearer JWT)                    │ /auth/v1/*, /realtime/v1/*
                ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│          Caddy (`docker/Caddyfile`): static PWA + reverse proxy           │
└───────────────┬───────────────────────────────────────┬──────────────────┘
                ▼                                        ▼
┌───────────────────────────────────┐   ┌──────────────────────────────────┐
│ Fastify service (`apps/service`)  │   │ Kong → GoTrue / Realtime         │
│ routes → services → withUserDb    │   │ (`docker/kong.yml`)              │
│ + in-process cron jobs            │   └──────────────────────────────────┘
└───────────────┬───────────────────┘
                │ hearth_service login (NOINHERIT)
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Postgres (Supabase schema): RLS policies are the isolation boundary     │
│  `supabase/migrations/*.sql`                                             │
└──────────────────────────────────────────────────────────────────────────┘

Pure libraries shared across the boundary (no I/O):
  `packages/shared` (Zod schemas, problem helpers)
  `packages/recurrence` (bill/chore dates, rotation)
  `packages/matching` (ingredient normalization and matching)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Service bootstrap | Reads env, builds Flipp/recipe/push clients, builds the Fastify app, starts the scheduler, handles SIGTERM | `apps/service/src/main.ts` |
| App assembly | Error handler, global rate limit, registers every route plugin under `/api` | `apps/service/src/app.ts` |
| Route context | Bearer-token authentication, `asUser` / `inHousehold` helpers that wrap `withUserDb` | `apps/service/src/http/context.ts` |
| RLS transaction wrapper | Opens a transaction, `set local role authenticated`, installs JWT claims | `apps/service/src/db/user-db.ts` |
| Routes | Thin HTTP layer per feature: parse input with shared schemas, call a service, shape the reply | `apps/service/src/routes/*.ts` |
| Services | Business rules per feature (recurrence, repricing, readiness, membership, invites) | `apps/service/src/services/*.ts` |
| Jobs | Cron-driven work: deal refresh, autopay logging, notification dispatch, cache pruning | `apps/service/src/jobs/*.ts`, `apps/service/src/jobs/scheduler.ts` |
| Privileged access | The only `service_role` code: outbox, GoTrue admin, job DB, system health | `apps/service/src/privileged/*.ts` |
| Deals source | Flipp HTTP client behind one rate-limited request queue, with fixture transport for E2E | `apps/service/src/deals/flipp/*.ts` |
| CLI | `hearth-admin` owner commands (password reset, etc.) | `apps/service/src/cli.ts` |
| Web bootstrap | Creates the Supabase client, auth client, query client, persisters, realtime port | `apps/web/src/main.tsx` |
| Web routing | Route table with lazy-loaded screens and session guards | `apps/web/src/routes.tsx`, `apps/web/src/screens/AuthenticatedLayout.tsx` |
| API client | `fetch` wrapper that attaches the bearer token, refreshes once, parses problem responses | `apps/web/src/lib/api/client.ts` |
| Query hooks | TanStack Query hooks per domain, validated with shared Zod schemas | `apps/web/src/lib/api/hooks.ts`, `apps/web/src/lib/api/*-hooks.ts` |
| Offline writes | Queueable mutations as paused TanStack mutations, persisted to IndexedDB | `apps/web/src/lib/offline/write-queue.ts`, `apps/web/src/lib/offline/persist.ts` |
| Realtime | Per-list Supabase channels for shopping list items and list row | `apps/web/src/lib/realtime/supabase-realtime.ts` |
| Service worker | Installability, offline caching, push display | `apps/web/src/sw.ts` |
| Shared contract | Request/response Zod schemas, OpenAPI source, problem details, scrubbing | `packages/shared/src/api/*.ts`, `packages/shared/src/problem.ts` |
| Recurrence math | Pure bill and chore occurrence and rotation logic | `packages/recurrence/src/*.ts` |
| Matching | Pure ingredient normalization, similarity, matcher | `packages/matching/src/*.ts` |
| Schema | Migrations (schema, RLS, functions, realtime, notifications) | `supabase/migrations/*.sql` |

## Pattern Overview

**Overall:** Modular monolith. A single Fastify service and a single React PWA, split by feature ("pillar") and by layer, with the database enforcing tenant isolation.

**Key Characteristics:**
- Every data-bearing request is authenticated by the service, then executed inside a Postgres transaction running as `authenticated` with the caller's claims. RLS decides what is visible, not application code (`apps/service/src/db/user-db.ts`, `docs/architecture.md`).
- The service is the only HTTP path to application data. PostgREST is not used. Supabase Auth and Realtime are reached directly through Caddy and Kong.
- Privileged `service_role` access is fenced into `apps/service/src/privileged/` and enforced by an ESLint `no-restricted-imports` rule (`eslint.config.js`, the `apps/service/src/**/*.ts` block).
- Background jobs run in-process via `node-cron` and are made safe under overlap with Postgres advisory locks (`apps/service/src/jobs/advisory-lock.ts`). The design therefore assumes one running service instance.
- The web app is a route-split SPA. Each pillar's tab, Settings, and onboarding load lazily (`apps/web/src/routes.tsx`).
- Pure packages (`packages/recurrence`, `packages/matching`, `packages/shared`) hold logic shared across the API boundary and carry no framework or I/O dependency.

## Layers

**Web presentation (screens and components):**
- Purpose: Render each route and interaction.
- Location: `apps/web/src/screens/`, `apps/web/src/components/`, `apps/web/src/pillars/`
- Contains: React screens (`*Screen.tsx`, `*Route.tsx`), feature components, UI primitives (`components/ui/`), shell (`components/shell/`).
- Depends on: `apps/web/src/lib/` hooks, `packages/shared` schemas and types, `packages/recurrence` for due-date display.
- Used by: `apps/web/src/routes.tsx` only.

**Web data access (`lib/`):**
- Purpose: Talk to the API and Supabase, manage cache and offline state.
- Location: `apps/web/src/lib/api/`, `apps/web/src/lib/auth/`, `apps/web/src/lib/offline/`, `apps/web/src/lib/realtime/`, `apps/web/src/lib/push/`
- Contains: `client.ts` (fetch wrapper), `*-hooks.ts` (TanStack Query hooks), `keys.ts` (query keys), `write-queue.ts`.
- Depends on: `packages/shared`, `@supabase/supabase-js`, TanStack Query.
- Used by: screens and `apps/web/src/main.tsx`.

**Service routes (HTTP):**
- Purpose: Map HTTP to domain calls.
- Location: `apps/service/src/routes/`
- Contains: One `FastifyPluginAsync` per feature (`bills.ts`, `chores.ts`, `lists.ts`, `households.ts`, etc.).
- Depends on: `apps/service/src/http/context.ts`, `apps/service/src/services/`, `packages/shared`.
- Used by: `apps/service/src/app.ts` registers each plugin.

**Service domain (services):**
- Purpose: Business rules and the queries that implement them.
- Location: `apps/service/src/services/` (flat, plus `services/deals/`)
- Contains: Functions such as `listBills(db, householdId, userId)`, `payBill`, `repriceExpiredItems`, `recomputeReadinessForHousehold`. Each takes a Kysely handle that is already inside `withUserDb`.
- Depends on: `packages/recurrence`, `packages/matching`, `apps/service/src/db/types.ts`.
- Used by: routes and jobs.

**Database access and isolation:**
- Purpose: Run every request as the caller.
- Location: `apps/service/src/db.ts`, `apps/service/src/db/user-db.ts`, `apps/service/src/db/types.ts`
- Contains: `withUserDb` (authenticated role plus claims), `withAnonDb` (for error recording only), Kysely types generated from the schema.
- Depends on: Postgres as `hearth_service`.
- Used by: `http/context.ts` and the jobs' `privileged/job-database.ts`.

**Privileged (service_role):**
- Purpose: The few cross-household operations.
- Location: `apps/service/src/privileged/`
- Contains: `service-role-db.ts` (`withServiceRoleDb`, `readSystemHealth`), `notification-outbox.ts` (claim-then-send), `scheduled-reminders.ts`, `gotrue-admin.ts` (email change), `job-database.ts`.
- Depends on: Postgres as `service_role`, GoTrue admin API.
- Used by: `main.ts`, `cli.ts`, and narrow functions handed to routes or jobs (`changeEmail`, `systemHealth`, `DispatchOutbox`). Only `main.ts` and `cli.ts` may import the module itself. `http/context.ts` has one type-only import (`SystemHealthRow`), which the lint rule permits.

**Jobs:**
- Purpose: Scheduled and on-demand background work.
- Location: `apps/service/src/jobs/`
- Contains: `refresh-deals.ts`, `log-autopay.ts`, `dispatch-notifications.ts`, `prune-cache.ts`, `refresh-plan.ts`; `scheduler.ts` registers the crons; `advisory-lock.ts` wraps each run.
- Depends on: `jobs/types.ts` (narrow `JobDatabase`, `DispatchOutbox`), services.
- Used by: `apps/service/src/main.ts` (`createScheduler`, `scheduler.start()`).

**External adapters:**
- Purpose: Isolate third-party protocols.
- Location: `apps/service/src/gotrue/` (GoTrue HTTP), `apps/service/src/auth/jwt.ts` (JWT verify, JWKS), `apps/service/src/deals/flipp/` (Flipp), `apps/service/src/recipes/` (URL fetch and JSON-LD), `apps/service/src/push/` (Web Push).
- Used by: `main.ts` injects them into `buildApp` and `scheduler`.

**Shared pure packages:**
- Purpose: One contract and one set of rules for both sides of the API.
- Location: `packages/shared/src/`, `packages/recurrence/src/`, `packages/matching/src/`
- Depends on: Zod, date-fns (recurrence) and no I/O.
- Used by: `apps/web`, `apps/service`, and `supabase/seed` (matching).

## Data Flow

### Primary Request Path (authenticated read or write)

1. A screen calls a query or mutation hook, for example `useBills` or `useChoreCompletion` (`apps/web/src/lib/api/bills-hooks.ts`, `apps/web/src/components/chores/use-chore-completion.ts`).
2. The hook calls `ApiClient.request` or `send`, which adds `authorization: Bearer <token>` and retries once after refresh on 401 (`apps/web/src/lib/api/client.ts`).
3. Fastify matches the route in a plugin such as `apps/service/src/routes/bills.ts` (registered in `apps/service/src/app.ts`). The global rate limit applies to `/api/*`.
4. The route calls `ctx.authenticate(request)`, which verifies the JWT signature and expiry (`apps/service/src/http/context.ts`, `apps/service/src/auth/jwt.ts`).
5. The route parses the body and params with a shared schema (`parse(createBillRequestSchema, request.body)`). Malformed input becomes a 400 problem response.
6. The route calls `ctx.inHousehold(user, id, fn)` or `ctx.asUser(user, fn)`. This opens `withUserDb`, which sets `authenticated` and the claims for the transaction (`apps/service/src/db/user-db.ts`).
7. The service function (`apps/service/src/services/bills.ts`) runs its queries and business rules inside that transaction. RLS filters every row.
8. The route returns the result. Snake_case columns are mapped to camelCase in the service layer, and the client parses the response with the same shared schema (`packages/shared/src/api/bills.ts`).
9. Errors surface as RFC 9457 problem responses through `setErrorHandler` in `apps/service/src/app.ts`. The client turns them into `ApiError` (`apps/web/src/lib/api/problem.ts`).

### Offline Write Path

1. A queueable mutation (list item add or edit, chore completion, errand status) is issued through TanStack Query with defaults set in `apps/web/src/lib/offline/write-queue.ts` and `chore-errand-writes.ts`.
2. Offline, TanStack pauses the mutation and applies the optimistic update. The persister (`apps/web/src/lib/offline/persist.ts`) writes the paused mutation to IndexedDB through `idb-keyval`, using the unthrottled flush persister for new writes.
3. On reconnect, the mutation resumes. Adds carry a client UUID and edits send absolute values, so replay is idempotent on the server.
4. Retries are capped at 3 attempts. A permanent failure (403/404/410) surfaces once as a toast.

### Realtime Sync Path

1. An open shopping list calls `createRealtimePort` (`apps/web/src/lib/realtime/supabase-realtime.ts`) and subscribes to channel `list:<listId>`.
2. Two `postgres_changes` bindings listen: `shopping_list_item` filtered by `list_id`, and `shopping_list` filtered by `id`. The second binding is the signal to refetch the list (DELETE on a filtered binding does not deliver).
3. Realtime evaluates RLS for the subscriber using the access token, so only household members receive events.

### Scheduled Job Path

1. `scheduler.start()` registers cron entries in `apps/service/src/jobs/scheduler.ts`: `refresh-deals` (08:00 UTC), `log-autopay` and `dispatch-notifications` (every 2 minutes), `prune-cache` (04:00 UTC).
2. Each run calls `withJobLock` with `pg_try_advisory_lock(hashtext('<job>'))` and skips if another run holds it (`apps/service/src/jobs/advisory-lock.ts`).
3. The run receives a narrow `JobDatabase` from `privileged/job-database.ts`. It writes across households only through that capability.
4. Notification dispatch enqueues today's reminders into the `notification` outbox, then claims and sends rows in `privileged/notification-outbox.ts` (claim-then-send).

### Notification Pipeline

Every writer enqueues with `on conflict do nothing` on `(user_id, type, target_id, occurrence_key)`. Quiet hours are computed in SQL (`next_local_time`, `after_quiet_hours`). The member-written types (`list_activity`, `chore_rotation`) are inserted by `authenticated` under the `member_event_*` policies (`supabase/migrations/20261004090000_notification_producers.sql`).

**State Management:**
- Server state: Postgres, read through the service. Web caches it in TanStack Query, persisted to IndexedDB (`apps/web/src/lib/api/query-client.ts`, `apps/web/src/lib/offline/persist.ts`).
- Session: Supabase auth client (`apps/web/src/lib/auth/auth-client.ts`), gated by `RequireSession` and `SignedOutOnly` in `apps/web/src/screens/AuthenticatedLayout.tsx`.
- Active household: stored on `profile.active_household_id`, stamped by `markHouseholdActive` on each household-scoped request (`apps/service/src/services/households.ts`).
- Service in-memory state: deal skip rates (`apps/service/src/services/skip-rates.ts`), the Flipp request queue (`apps/service/src/deals/flipp/request-queue.ts`), the recipe host rate limiter (`apps/service/src/recipes/host-rate-limiter.ts`).

## Key Abstractions

**`withUserDb` / `RouteContext.asUser` / `inHousehold`:**
- Purpose: The only sanctioned way for a request to reach the database.
- Examples: `apps/service/src/db/user-db.ts`, `apps/service/src/http/context.ts`
- Pattern: Transaction-local role switch and claims. `inHousehold` also answers 404 to non-members.

**Route plugin with context:**
- Purpose: Each feature is one Fastify plugin receiving `{ ctx: RouteContext }`.
- Examples: `apps/service/src/routes/bills.ts`, `apps/service/src/routes/lists.ts`
- Pattern: `export const billRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => { app.get(...) }`

**Shared Zod schema as contract:**
- Purpose: One definition for request validation, response parsing, and OpenAPI.
- Examples: `packages/shared/src/api/bills.ts`, `packages/shared/src/api/lists.ts`, `apps/service/src/openapi.ts`
- Pattern: Schema exported from `@hearth/shared`, used by `parse(...)` on the server and by `request({ schema })` on the client.

**`JobDatabase` and `DispatchOutbox`:**
- Purpose: Narrow capabilities handed to jobs so they cannot reach `service_role` directly.
- Examples: `apps/service/src/jobs/types.ts`, `apps/service/src/privileged/job-database.ts`
- Pattern: Dependency injection from `main.ts` through `createScheduler({ database, dispatch, refresh })`.

**Pillar and section registry:**
- Purpose: Declares each top-level area (Lists, Meals, Chores, Bills, Deals) and whether it is released.
- Examples: `apps/web/src/lib/sections.ts` (`PILLARS`, `RELEASED_PILLARS`), `apps/web/src/pillars/*/*Route.tsx`
- Pattern: Unreleased pillars render `ComingSoon` through `PillarScreen`.

**Problem details:**
- Purpose: Uniform error contract across service and client.
- Examples: `apps/service/src/problem.ts`, `packages/shared/src/problem.ts`, `apps/web/src/lib/api/problem.ts`
- Pattern: `fail(status, detail)` throws a `ProblemError`. The error handler sends `application/problem+json`. Non-5xx details are shown to clients; 5xx details are scrubbed and recorded through `recordAppError`.

## Entry Points

**Service process:**
- Location: `apps/service/src/main.ts`
- Triggers: `node` on the built bundle in the `hearth-service` container (`docker/service.Dockerfile`), or `pnpm --filter @hearth/service dev`.
- Responsibilities: Parse env, build clients, call `buildApp`, start the scheduler, register SIGTERM/SIGINT shutdown, listen on `HOST`/`PORT`.

**Owner CLI:**
- Location: `apps/service/src/cli.ts` (built to `apps/service/bin/hearth-admin`)
- Triggers: Manual operator command, for example `hearth-admin reset-password <email>`.
- Responsibilities: Privileged operations through GoTrue admin with `SERVICE_ROLE_KEY`.

**Web bootstrap:**
- Location: `apps/web/src/main.tsx`
- Triggers: Browser load of the PWA.
- Responsibilities: Install error reporting, create Supabase, auth, and query clients, register queue defaults before cache hydration, render `<App>`.

**Web router:**
- Location: `apps/web/src/routes.tsx`
- Triggers: Every navigation.
- Responsibilities: Map paths to lazy screens. `/` is the dashboard (`DashboardRoute`). `/sign-in`, `/sign-up`, `/set-password`, and `/forgot-password` are public. `/onboarding` and `/join` require a session. Pillar routes sit under `AuthenticatedLayout`.

**Service worker:**
- Location: `apps/web/src/sw.ts`
- Triggers: Browser service worker lifecycle.
- Responsibilities: Precache, offline support, push event display (`apps/web/src/lib/push/service-worker-handlers.ts`).

**Database migrations:**
- Location: `supabase/migrations/` (applied in filename order)
- Triggers: `supabase db reset`, `supabase start`, and `scripts/deploy.sh`.
- Responsibilities: Schema, RLS, helper and lifecycle functions, realtime publication, notification send-time logic.

## Architectural Constraints

- **Threading:** Single-threaded Node event loop for the service. Work runs as async I/O. No worker threads are used.
- **Process count:** One service process is assumed. Cron jobs and in-memory queues (Flipp, recipe rate limiter, skip rates) are per process. Advisory locks protect the jobs only against overlap within the database.
- **Global state:** Module-level singletons are built in `apps/service/src/main.ts` (`wiring`, `skipRates`, `flippQueue`, `recipeFetchLimiter`, `recordingTransport`). The web client builds its singletons in `apps/web/src/main.tsx`.
- **Circular imports:** Not analyzed in this pass.
- **Build-time configuration:** `VITE_MAGIC_LINK_ENABLED` and `VITE_SUPABASE_ANON_KEY` are fixed at build time (`apps/web/src/routes.tsx`, `apps/web/src/main.tsx`). Changing them requires a rebuild.
- **Test-only seams:** Fixture transports (`HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`) and the push double (`HEARTH_PUSH_TRANSPORT=test-double`) are reachable only through the E2E Compose overlay. The E2E push seam route is registered only when that switch is set (`apps/service/src/app.ts`, `apps/service/src/push/test-seam.ts`).
- **Pinned origin:** The public origin is baked into installed PWAs and push subscriptions (`README.md`, "Pinned names"). Changing the host is a breaking change.

## Anti-Patterns

### Querying the database outside `withUserDb`

**What happens:** A route or service opens its own connection or uses the Kysely instance from `AppDependencies.db` directly.
**Why it's wrong:** The query runs as `hearth_service` with no claims. It either fails under the NOINHERIT setup or, worse, bypasses the caller's identity.
**Do this instead:** Use `ctx.asUser` or `ctx.inHousehold` in the route, and pass the transaction handle into the service function (`apps/service/src/routes/bills.ts`).

### Importing `privileged/` from a route, service, or job

**What happens:** A feature imports `service-role-db` or `notification-outbox` for convenience.
**Why it's wrong:** It extends the `service_role` fence. ESLint blocks the static and dynamic import forms (`eslint.config.js`).
**Do this instead:** Add a narrow function in `privileged/` and inject it through `AppDependencies` or the job's dependencies, as `changeEmail` and `systemHealth` are wired in `apps/service/src/main.ts`.

### Enforcing household isolation only in application code

**What happens:** A handler filters by `household_id` in TypeScript and omits the policy.
**Why it's wrong:** The RLS policy is the actual boundary. A code path that forgets the check leaks data unless the database also refuses it (`docs/architecture.md`).
**Do this instead:** Write or reuse the RLS policy in a migration under `supabase/migrations/`, and keep application validation for business rules.

### Duplicating schemas on client and server

**What happens:** A response shape is typed by hand in `apps/web` next to a separate server type.
**Why it's wrong:** The two drift.
**Do this instead:** Add the schema to `packages/shared/src/api/<feature>.ts` and import it on both sides (`apps/web/src/lib/api/bills-hooks.ts`, `apps/service/src/routes/bills.ts`).

### Hand-edited generated database types

**What happens:** `apps/service/src/db/types.ts` is edited directly.
**Why it's wrong:** The next `pnpm db:types` run overwrites it, and it can drift from the migrated schema.
**Do this instead:** Change the migration, then run `pnpm db:types` and commit the result (`README.md`, "Database").

## Error Handling

**Strategy:** Typed errors become RFC 9457 problem responses. Unknown errors are scrubbed, recorded, and returned as a generic 5xx.

**Patterns:**
- Route code throws `fail(status, detail)` or a service-level error from `apps/service/src/services/errors.ts`. The error handler maps it (`apps/service/src/app.ts`).
- Postgres errors map through `problemFromDatabaseError` (`apps/service/src/problem.ts`). GoTrue errors map through `problemFromGoTrueError`. Recipe fetch errors map through `problemFromRecipeFetchError`.
- Server errors are recorded via `recordAppError`, which writes through `public.record_app_error` as `anon` (`apps/service/src/db/user-db.ts`, `withAnonDb`).
- The client throws `ApiError` (status 0 for network failures) and the query layer decides whether to retry (`apps/web/src/lib/api/client.ts`, `apps/web/src/lib/offline/write-queue.ts`).
- Web-level render errors are caught by `apps/web/src/components/states/ErrorBoundary.tsx` and the router's `errorElement` (`RouteError` in `apps/web/src/routes.tsx`).

## Cross-Cutting Concerns

**Logging:** Pino through Fastify (`apps/service/src/app.ts`). Request URLs are logged without query strings. Errors are scrubbed with `scrubErrorText` from `packages/shared/src/scrub.ts`. The client reports errors through `apps/web/src/lib/error-reporting.ts`.

**Validation:** Zod schemas in `packages/shared/src/api/`. Server-side with `parse(...)` in `apps/service/src/http/context.ts`. Client-side in the API hooks and form code (`apps/web/src/lib/validation.ts`, `apps/web/src/lib/use-field-errors.ts`).

**Authentication:** GoTrue issues tokens. The service verifies them with `JWT_SECRET` (HS256) or the JWKS endpoint (ES256) through `apps/service/src/auth/jwt.ts`. The web client uses supabase-js (`apps/web/src/lib/auth/auth-client.ts`).

**Authorization:** Postgres RLS policies and `security definer` helpers (`is_household_member`, `can_write_member_notification`) in `supabase/migrations/20260919070100_rls.sql` and `20260919070200_functions.sql`.

**Rate limiting:** `@fastify/rate-limit`, global and keyed on the trusted client IP. Only `/api/*` is limited. Unknown `/api` paths are limited too (`apps/service/src/app.ts`).

**Timezones:** Scheduling is UTC. User-facing dates resolve against the household or user timezone inside services and jobs (`apps/web/src/lib/household-date.ts`, `apps/web/src/lib/use-timezone-sync.ts`).

---

*Architecture analysis: 2026-10-11*
