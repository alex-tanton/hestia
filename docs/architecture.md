# Architecture

## Overview

Hearth is a monorepo: a Fastify API service (`apps/service`), a React PWA (`apps/web`), and a
self-hosted Supabase stack — Postgres, GoTrue (auth), Realtime, and Kong (the gateway in front of
GoTrue and Realtime) — all reachable through Caddy as a single origin. The service is the only
HTTP path to application data; there is no PostgREST. Caddy also serves the built PWA as static
assets and proxies `/auth/v1/*` and `/realtime/v1/*` straight to Kong, so sign-in, token refresh,
and realtime subscriptions reach Supabase directly without passing through the service.

## Request flow and authorization

Every data-bearing request follows the same path: browser → Caddy → the Fastify service →
Postgres, and back. The service verifies the caller's Supabase JWT itself (signature and expiry)
and then does all of its database work through one function, `withUserDb` (`apps/service/src/db/user-db.ts`).
`withUserDb` opens a transaction on the service's connection pool and, before running anything
else, issues:

```sql
set local role authenticated;
select set_config('request.jwt.claims', $1, true);  -- the verified claims, as JSON
```

Inside that transaction `auth.uid()` resolves to the caller, and every Postgres row-level-security
policy in `supabase/migrations/20260919070100_rls.sql` applies exactly as it would if the caller
had connected directly. Both the role switch and the claims are transaction-local, so nothing
leaks into the next request that reuses the pooled connection. A route handler has no other way to
reach the database — `apps/service/src/http/context.ts` hands every route an `asUser` /
`inHousehold` helper that wraps `withUserDb`, and nothing in `apps/service/src/routes/` opens a
connection on its own.

This matters because **RLS, not application code, is the actual isolation boundary.** A route
handler can contain a bug — a missing `WHERE household_id = …`, a forgotten membership check — and
a cross-household leak is still refused at the database. The service's own validation exists for
business rules (derived recurrence, deal repricing, notification batching) that RLS cannot express,
not for household isolation itself.

The service connects to Postgres as a dedicated login role, `hestia_service`
(`supabase/migrations/20260919060000_hestia_service_role.sql`). That role is `NOLOGIN` in the
migration — its password is supplied separately by the deploy environment — and `NOINHERIT`, with
membership in `anon`, `authenticated`, and `service_role` and no privileges of its own. Until a
transaction explicitly switches role, it holds none of those three roles' rights, so a code path
that forgets to switch fails outright rather than running with elevated access.

### The service-role fence

A handful of things legitimately need to see across households — the scheduled jobs (deal
refresh, autopay logging, notification dispatch, cache pruning), and `GET /api/health/deep`'s
aggregate figures. Those run as `service_role`, which bypasses RLS entirely, through
`withServiceRoleDb` in `apps/service/src/privileged/service-role-db.ts`. Everything that can reach
`service_role` — that function, the notification outbox's cross-user reads/writes
(`apps/service/src/privileged/notification-outbox.ts`), the GoTrue admin call used for email
changes (`apps/service/src/privileged/gotrue-admin.ts`), and the scheduled-reminder producer
(`apps/service/src/privileged/scheduled-reminders.ts`) — lives in `apps/service/src/privileged/`.

Only `main.ts` and the `hearth-admin` CLI (`cli.ts`) may import from that folder; every other
module gets the one narrow function it needs (`changeEmail`, `systemHealth`, a `DispatchOutbox`),
never the privileged client itself. This is enforced by an ESLint rule in `eslint.config.js`
(`@typescript-eslint/no-restricted-imports`, pattern `**/privileged/*`, scoped to
`apps/service/src/**/*.ts` and excluding `main.ts`, `cli.ts`, `privileged/**`, and test files), plus
a `no-restricted-syntax` rule blocking a dynamic `import('../privileged/…')` from slipping past the
static-import check. A new route cannot quietly acquire service-role access without failing lint.

## Data model

Tables live in `supabase/migrations/20260919070000_schema.sql`, grouped by pillar below (one line
each; see the migration for full column lists and constraints).

**Identity and households**

| Table | Purpose |
| --- | --- |
| `profile` | One row per `auth.users` row; display name, timezone, quiet hours, active household |
| `household` | A household: name, postal code, timezone, last-activity stamp |
| `household_member` | Membership and role (`admin` or `member`); at most one admin per household |
| `household_invite` | Hashed link token and code for joining a household; 7-day lifetime |

**Deals, lists, and pantry**

| Table | Purpose |
| --- | --- |
| `deal` | A normalized Flipp deal, cached per postal code |
| `deal_query_cache` | Cached search results keyed by (postal code, query) |
| `postal_code_refresh` | Last daily and last on-demand refresh time per postal code |
| `household_favorite_store` | A household's favorited merchants |
| `shopping_list` / `shopping_list_item` | A household's shopping lists and their items |
| `pantry_item` | A household's on-hand ingredients, one row per normalized name |

**Recipes and meal plans**

| Table | Purpose |
| --- | --- |
| `recipe` / `recipe_ingredient` | A household's saved recipes and their ingredient lines |
| `recipe_readiness` | Precomputed on-sale/in-pantry/to-buy counts for a recipe |
| `ingredient_match_override` | A household's forced match / forced no-match decisions |
| `meal_plan_entry` | A recipe (or its title snapshot) planned for a date and meal |

**Bills and subscriptions**

| Table | Purpose |
| --- | --- |
| `bill` | A household or personal bill: amount, recurrence, autopay, visibility |
| `bill_payment_log` | One row per paid or skipped occurrence of a bill |

**Chores and errands**

| Table | Purpose |
| --- | --- |
| `chore` | A recurring chore, either assigned to one member or rotating through several |
| `chore_completion` | One row per completed occurrence; client-generated id for offline replay |
| `errand` | A one-off household task with open/done status |

**Notifications, preferences, and push**

| Table | Purpose |
| --- | --- |
| `notification_preference` | Per-user (and, for the weekly meal nudge, per-household) opt-in |
| `push_subscription` | A browser's Web Push subscription (endpoint and keys) |
| `notification` | The single outbox: one row per pending or sent notification |

**Operations**

| Table | Purpose |
| --- | --- |
| `app_error` | Scrubbed, fingerprinted error counts, written only through `record_app_error` |

Realtime streams four of these tables — `shopping_list`, `shopping_list_item`, `chore_completion`,
`errand` — added to the `supabase_realtime` publication in
`supabase/migrations/20260919070300_realtime.sql`.

### The RLS pattern

Every table has RLS enabled; a table with no policy denies everything by default (`app_error` is
the one table with RLS on and no policy — it is reachable only through the `record_app_error`
function). The shape is the same everywhere: a `security definer`, `stable` helper answers a yes/no
membership question, and policies call it. For a plain household-scoped table:

```sql
create function public.is_household_member(hid uuid)
returns boolean language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.household_member
    where household_id = hid and user_id = auth.uid()
  );
$$;

create policy household_read on public.shopping_list
  for select using (public.is_household_member(household_id));
create policy household_write on public.shopping_list
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
```

Other real policy shapes in `20260919070100_rls.sql`:

- **Child tables** (`shopping_list_item`, `recipe_ingredient`, `chore_completion`,
  `bill_payment_log`) check membership through the parent row rather than carrying their own
  `household_id` — e.g. `shopping_list_item`'s `household_read`/`household_write` policies join out
  to `shopping_list` and test `is_household_member(l.household_id)`.
- **`bill`** has two independent policy pairs: `household_read`/`household_write` apply when
  `visibility = 'household'` (membership-gated), and `personal_read`/`personal_write` apply when
  `visibility = 'personal'` (`owner_user_id = auth.uid()` only).
- **Own-row-only tables** (`profile`, `notification_preference`, `push_subscription`) restrict by
  `id`/`user_id = auth.uid()`; a co-member's display name is readable only through the
  `household_members()` function, never through `profile` directly.
- **`notification`** mixes an own-rows read policy with four `member_event_*` policies that let a
  request write only *unsent* `list_activity` and `chore_rotation` rows, and only when
  `can_write_member_notification(type, target_id, user_id)` confirms both the caller and the named
  recipient belong to the target list's or chore's household. Every other notification type is
  written exclusively by jobs running as `service_role`.
- **`deal`, `deal_query_cache`, `postal_code_refresh`** are shared per postal code: readable and
  writable by any caller belonging to a household at that postal code
  (`is_member_postal_code(postal_code)`), with no delete policy — pruning is a job.
- **`household`/`household_member`** rows are read by membership but only ever inserted, role
  changed, or deleted through the membership-lifecycle functions (below); the admin may update the
  household's own name/postal code/timezone directly.

Grants are explicit and narrow: migrations revoke Supabase's default `anon`/`authenticated` grants
on `public` and `PUBLIC`'s default `EXECUTE`, then grant back only what each policy needs.
`authenticated` holds table/column privileges plus `EXECUTE` on the helper and lifecycle functions;
`anon` holds nothing but `EXECUTE` on `record_app_error`.

### Membership lifecycle functions

Operations that touch rows a member cannot write directly — another member's role, deleting a
whole household, redeeming an invite — are `security definer` Postgres functions in
`supabase/migrations/20260919070200_functions.sql`, called through `withUserDb` so `auth.uid()` is
still the caller: `create_household`, `household_members`, `mark_household_active`,
`departure_preview`, `depart_household` (reassign-and-depart, with rotation rebasing via
`rebase_rotation`, and household deletion for the last member after a typed-name confirmation),
`transfer_admin`, and `redeem_invite`. Each checks the caller explicitly before doing anything, and
each uses `set search_path = ''` with fully schema-qualified names.

## API surface

REST under `/api`, resource-oriented and household-scoped by path where applicable, assembled in
`apps/service/src/app.ts`. Every route except those marked *public* requires a bearer JWT. Grouped
by pillar:

| Group | Covers |
| --- | --- |
| Auth / identity | Signup (`POST /api/signup`, public); the caller's profile, memberships, active household, password and email change (`/api/users/me/*`) |
| Households | Create/read/update a household, list members, join by invite token or code |
| Invites | Admin-only: create, list, revoke household invites |
| Membership | Departure preview, leave, remove a member, transfer admin |
| Favorite stores | A household's favorited merchants |
| Deals | Search, flyers, flyer items, merchants — all server-side reads of the Flipp wrapper's cache |
| Lists | Lists and their items, archive/unarchive, add-bought-to-pantry |
| Pantry | A household's pantry items |
| Recipes | CRUD, URL parsing into a draft, add-to-list, match overrides, suggestions |
| Meal plan | A household's weekly plan, add-to-list for one entry or the whole week |
| Bills / subscriptions | Household and personal bills, pay/skip/archive, move between scopes, subscriptions view |
| Chores | CRUD, completion (and undo of the most recent completion) |
| Errands | CRUD, absolute status set (open/done) |
| Notifications / preferences / push | Per-type preferences, push subscription registration |
| System | Public error intake, health check, owner-only deep health |

Request and response shapes are Zod schemas in `packages/shared`, which the service validates
against directly. An OpenAPI 3.1 document is generated from those same schemas at build time and
served live at **`GET /api/openapi.json`**.

Errors are RFC 9457 problem details (`type`, `title`, `status`, `detail`), never a bare string.
Responses are camelCase; the database is snake_case; the mapping happens in one layer. Monetary
amounts cross the API as integer cents.

A subset of writes — adding a list item, editing/checking a list item, completing a chore, setting
an errand's status — accept a client-generated UUID on creation and are idempotent on it, which is
what lets the offline write queue replay them safely. Adding a deal to a list takes the same id but
is an online mutation rather than a queued write (see Offline writes). Adding a recipe's, a
planned meal's or a planned week's missing ingredients to a list reads what is already on the list
before it writes, so `apps/service/src/services/add-to-list.ts` serializes those calls per list with
a transaction-scoped advisory lock: two overlapping calls for one list cannot each add every
ingredient.

## Background jobs

`node-cron`, in-process, registered in `apps/service/src/jobs/scheduler.ts`. Schedules are UTC;
anything user-facing (due dates, reminder times) resolves against the owning household's or user's
own timezone inside the job, not the server's.

| Job | Schedule | Does |
| --- | --- | --- |
| `refresh-deals` | `0 8 * * *` (daily, 08:00 UTC) | Refreshes Flipp deals for every active postal code, reprices expired list items, recomputes recipe readiness for affected households, enqueues `flyer_refresh` notifications |
| `log-autopay` | `*/2 * * * *` (every 2 minutes) | Inserts a `bill_payment_log` row for every due autopay occurrence that doesn't have one yet |
| `dispatch-notifications` | `*/2 * * * *` (every 2 minutes) | Enqueues today's scheduled reminders into the `notification` outbox, then sends due rows |
| `prune-cache` | `0 4 * * *` (daily, 04:00 UTC) | Deletes expired `deal` rows, stale `deal_query_cache` rows, old sent `notification` rows, and old `app_error` rows |

**Double-run safety.** Every job run takes `pg_try_advisory_lock(hashtext('<job name>'))` on a
dedicated pooled connection before doing anything (`apps/service/src/jobs/advisory-lock.ts`,
`withJobLock`) and simply skips the run if another process already holds it. The lock is released
in a `finally`, so a run that throws still frees it for the next tick. An on-demand background
refresh for a dormant postal code (triggered by a request, queued via
`scheduler.queueBackgroundRefresh`) takes the *same* lock name as `refresh-deals`, so it can never
run concurrently with the daily job either.

**Double-send safety.** `log-autopay` relies on the unique `(bill_id, occurrence_date)` key on
`bill_payment_log` and inserts with `on conflict do nothing`. `dispatch-notifications` relies on
the outbox's own idempotent key (see Notifications pipeline below) plus a claim-then-send pattern:
a row is stamped `sent_at` in the same statement that re-checks its condition, before any device is
contacted, so a rerun after a crash never resends a row a previous run already claimed — at most it
loses one in-flight notification to the crashed run, never duplicates one.

## Realtime sync

The PWA subscribes to Supabase Realtime directly over the same origin (Caddy proxies
`/realtime/v1/*` to Kong), so the stream is governed by the same RLS policies as everything else —
Realtime evaluates each subscriber's policies as that user, from the claims on the access token the
channel carries.

An open shopping list subscribes to one channel per list, named `list:<listId>`
(`apps/web/src/lib/realtime/supabase-realtime.ts`), with two `postgres_changes` bindings: one on
`shopping_list_item` filtered to `list_id=eq.<listId>`, one on `shopping_list` filtered to
`id=eq.<listId>`. Channels are named after the resource rather than the household, so switching
household tears down exactly the subscriptions that belonged to the previous one.

The second binding exists because of a real limitation: a `DELETE` on a filtered Postgres
replication subscription carries only the deleted row's primary key (that's all the default
replica identity puts in the write-ahead log), so a `list_id=eq.<listId>` filter can never match it
and Realtime does not deliver it. The workaround is the `shopping_list.updated_at` trigger, which
fires on every insert, update, *and delete* of one of its items — a client treats any change to the
list row itself as the signal to refetch the whole list, which is also how it picks up a subtotal
it couldn't otherwise recompute locally.

## Offline writes

Offline support has no separate queue table and no custom client-side dedupe layer: the queue *is*
TanStack Query's paused-mutation mechanism. `apps/web/src/lib/offline/write-queue.ts` registers a
shared `mutationFn` and lifecycle callbacks (via `setMutationDefaults`) for every queueable write —
list item add/edit, and (per `chore-errand-writes.ts`) chore completion and errand status — so that
when a mutation is issued offline, TanStack pauses it rather than failing it, applies an optimistic
update immediately, and resumes it automatically on reconnect.

Persistence is what makes the queue survive a reload or browser restart rather than just a network
blip: `apps/web/src/lib/offline/persist.ts` wires TanStack's async-storage persister to IndexedDB
through `idb-keyval`. The same persisted payload carries both halves of offline support — the
last-synced query cache (so a cold start renders real data instead of nothing) and any paused
mutations (the write queue itself). A second, unthrottled persister instance flushes a newly queued
write to IndexedDB immediately, separately from the query cache's normal throttle, so a write is
never left only in memory during that throttle window.

Replay is idempotent because every queueable write either carries a client-generated UUID (an add)
or sends an absolute value rather than a delta (an edit, a status set) — a replayed add is a
duplicate-key no-op at the database, and a replayed edit converges to the same state no matter how
many times it's resent. Retries are bounded (`retryQueuedWrite`, capped at 3 attempts) and distinguish
retryable failures (offline, 5xx) from permanent ones (403/404/410, where the row or its list is
already gone), surfacing a permanent failure once via a toast rather than retrying forever.

Adding a deal to a list is not a queued write, and its item id is held across a retry.
`useAddDealToList` (`apps/web/src/lib/api/deals.ts`) is an ordinary online mutation that posts a
client-generated item id with the deal's id, and the service's `on conflict (id) do nothing` makes
a repeat of the same id a no-op. Because a response can be lost after the request landed, the id is
kept per list and deal, at `QueryClient` scope (so it survives the card unmounting) and per
signed-in user, and only a success starts the next add with a fresh id. The held ids live in memory
only, so a reload between a failure and the retry mints a new id.

## Notifications pipeline

`notification` is a single outbox table, one row per pending-or-sent notification. Its idempotency
comes entirely from one unique key: `(user_id, type, target_id, occurrence_key)`. Every writer —
jobs running as `service_role`, and the two request-written types (`list_activity`,
`chore_rotation`) written by `authenticated` under the `member_event_*` RLS policies — enqueues with
`on conflict do nothing` against that key, so re-enqueuing the same reminder is always a no-op.

`dispatch-notifications` runs every 2 minutes and does two things each run:

1. **Enqueue.** For each scheduled type and each recipient whose send time for *today* has passed
   in the relevant timezone, insert an outbox row. Only today's send times are enqueued, so
   downtime never produces a backlog of stale reminders.
2. **Send.** First delete unsent rows more than 24 hours past their `send_after` (expired, logged
   and dropped). Then select rows with `sent_at is null and send_after <= now()` and, for each,
   push to every one of the recipient's subscriptions.

The **claim-then-send** step is one SQL statement in
`apps/service/src/privileged/notification-outbox.ts` (`claim`): it re-checks the row's condition
via `public.notification_still_holds(n)` and, in the same write, either stamps `sent_at` (claimed,
proceed to send) or deletes the row (`stale`, condition no longer holds — e.g. the bill got paid)
— never both, and never twice. If no device accepts a claimed row, `release` clears `sent_at` so
the next run retries it; once at least one device has accepted, the claim stays permanently, so a
device that failed is never retried for a notification another device already received.

**Quiet hours** are computed in SQL, not in application code, so every writer gets the same answer
in the right timezone: `public.next_local_time(after, tz, at_local)` finds the next instant the
local clock in `tz` reads `at_local`, and `public.after_quiet_hours(send_at, tz, quiet_start,
quiet_end)` shifts a send time that falls inside the window to the end of it (both in
`supabase/migrations/20260925080000_notification_send_times.sql`). A request-written row (list
activity, chore rotation) can't read another member's `profile` directly under RLS, so it goes
through `public.member_quiet_send_at(recipient, send_at)` — a `security definer` function that
returns only the shifted instant, guarded so a caller can ask about a co-member but nothing wider
(`supabase/migrations/20261004090000_notification_producers.sql`). The same migration's
`notification_wanted(recipient, type, household_id)` is the one place the "does this recipient want
this type" default lives, consulted at both enqueue time and (for request-written types) write
time.

## Shared packages

Three packages exist specifically to keep logic pure, dependency-free, and usable from both sides
of the API boundary, rather than duplicated or re-implemented:

- **`packages/shared`** — Zod schemas for every request/response shape, used by the service to
  validate incoming requests and to generate the OpenAPI document, and by the web client to parse
  responses and type its API calls. One schema, one source of truth for validation on both sides;
  a shape can't drift between client and server because they import the same definition. It also
  carries the common-password list, RFC 9457 problem helpers, and the error-scrubbing function used
  identically by the service and the PWA.
- **`packages/recurrence`** — the math for bill and chore recurrence, occurrence dates, and chore
  rotation assignment. Kept pure (no I/O, no database, no framework dependency) and unit-tested
  at high coverage specifically because recurrence and rotation bugs are easy to get subtly wrong
  and expensive to get wrong in production (a bill reminder on the wrong day, a chore assigned to
  the wrong person); a pure function is exhaustively testable against recorded date math instead of
  needing a database to verify.
- **`packages/matching`** — ingredient name normalization and fuzzy matching (deal-to-recipe,
  pantry-to-recipe). Kept pure for the same reason: matching quality is validated against fixtures
  and similarity-scoring unit tests, independent of the deal cache or the database, so a change to
  the matching algorithm can be verified without spinning up the service.
