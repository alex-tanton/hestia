# Architecture

## System Overview

Hestia is a monorepo consisting of:
- **Web Frontend (`apps/web`):** React Progressive Web App (PWA) with offline-first capabilities.
- **Backend API (`apps/service`):** Fastify REST service and background scheduler (`node-cron`).
- **Data & Auth Platform:** Self-hosted Supabase services (Postgres, GoTrue auth, Realtime, and Kong API gateway).
- **Reverse Proxy & Ingress:** Caddy terminates internal HTTP traffic, serves built PWA assets, and reverse-proxies `/api/*`, `/auth/v1/*`, and `/realtime/v1/*`. Public ingress is tunneled via Cloudflare Zero Trust (`cloudflared`).

```
Internet ──> Cloudflare Edge ──(Tunnel)──> cloudflared ──> Caddy (8080)
                                                             ├── /            ──> Static PWA Assets
                                                             ├── /api/*       ──> Fastify Service (3000)
                                                             ├── /auth/v1/*   ──> Kong (8000) ──> GoTrue
                                                             └── /realtime/*  ──> Kong (8000) ──> Realtime
```

---

## Authorization & Database Isolation

### Row-Level Security (RLS) as Security Boundary

Household isolation is enforced exclusively at the database layer via PostgreSQL Row-Level Security:

1. **Request Flow:** The Fastify service validates caller Supabase JWTs (signature and expiration).
2. **Transaction Scoping:** Every authenticated database operation executes inside a dedicated transaction managed by `withUserDb` (`apps/service/src/db/user-db.ts`):
   ```sql
   set local role authenticated;
   select set_config('request.jwt.claims', $1, true);
   ```
3. **Identity Resolution:** Inside the transaction, `auth.uid()` evaluates to the caller's user ID. Postgres RLS policies in `supabase/migrations/20260919070100_rls.sql` automatically scope all queries. Both the role switch and claims are transaction-local and cannot leak across pooled connections.
4. **Service Role:** The API connects to Postgres as `hestia_service` (`NOINHERIT`, `NOLOGIN`), holding memberships in `anon`, `authenticated`, and `service_role`. Privilege escalation requires explicit role switching.

### Service-Role Fence

Cross-household operations (background jobs, system health diagnostics, email modifications) execute as `service_role` via `withServiceRoleDb` (`apps/service/src/privileged/`). Access is restricted by ESLint boundaries: only `main.ts` and `cli.ts` may import from `apps/service/src/privileged/`.

---

## Data Model

Database tables (`supabase/migrations/20260919070000_schema.sql`) are organized by domain:

| Domain | Tables | Responsibilities |
| --- | --- | --- |
| **Identity & Households** | `profile`, `household`, `household_member`, `household_invite` | Users, households, member roles (`admin`/`member`), and 7-day join invites. |
| **Deals & Lists** | `deal`, `deal_query_cache`, `postal_code_refresh`, `household_favorite_store`, `shopping_list`, `shopping_list_item`, `pantry_item` | Flipp deals cached by postal code, favorite merchants, synchronized shopping lists, and pantry inventory. |
| **Meal Planning** | `recipe`, `recipe_ingredient`, `recipe_readiness`, `ingredient_match_override`, `meal_plan_entry` | Recipes, ingredient parsing, precomputed sale/pantry readiness, match overrides, and weekly calendar slots. |
| **Bills & Subscriptions** | `bill`, `bill_payment_log` | Recurring bills (household and personal), autopay, and payment history logs. |
| **Chores & Errands** | `chore`, `chore_completion`, `errand` | Single-owner and rotating recurring chores, completion history, and one-off errands. |
| **Notifications & Push** | `notification_preference`, `push_subscription`, `notification` | User notification preferences, Web Push subscriptions, and outbox queue. |
| **System Operations** | `app_error` | Fingerprinted, scrubbed error tallies recorded via `record_app_error`. |

### RLS Policies & Helper Functions

- **Household Scoping:** Most tables evaluate membership using a `security definer` helper:
  ```sql
  create function public.is_household_member(hid uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
    select exists (select 1 from public.household_member where household_id = hid and user_id = auth.uid());
  $$;
  ```
- **Child Tables:** `shopping_list_item`, `recipe_ingredient`, and `chore_completion` inherit membership validation by joining their parent rows.
- **Dual-Visibility Bills:** `bill` applies `is_household_member(household_id)` when `visibility = 'household'`, and restricts to `owner_user_id = auth.uid()` when `visibility = 'personal'`.
- **Sensitive Operations:** Household creation, member departure/removal, invite redemption, and admin transfers execute via hardened functions in `supabase/migrations/20260919070200_functions.sql`.

---

## API Surface

The Fastify API serves REST endpoints under `/api`:
- **Schemas:** Contract shapes are defined as Zod schemas in `packages/shared`, used for request validation and generating OpenAPI documentation at `GET /api/openapi.json`.
- **Error Format:** Errors adhere to RFC 9457 Problem Details (`{ type, title, status, detail }`).
- **Data Conventions:** Request/response bodies use camelCase; database columns use snake_case. Currency is represented as integer cents.
- **Idempotency:** Creation endpoints (lists, chores, errands) accept client-generated UUIDs to support safe offline replay.

---

## Background Scheduler

In-process cron jobs run via `node-cron` in `apps/service/src/jobs/scheduler.ts` (all schedules UTC):

| Job | Schedule | Purpose |
| --- | --- | --- |
| `refresh-deals` | `0 8 * * *` (08:00 UTC) | Refreshes Flipp flyers by postal code, reprices list items, recomputes recipe readiness, enqueues flyer refresh notices. |
| `log-autopay` | `*/2 * * * *` (Every 2 min) | Logs payment records for due autopay bills (`(bill_id, occurrence_date)` unique constraint prevents duplicates). |
| `dispatch-notifications` | `*/2 * * * *` (Every 2 min) | Evaluates reminder triggers, enqueues due reminders, and dispatches Web Push payloads. |
| `prune-cache` | `0 4 * * *` (04:00 UTC) | Cleans expired deals, query caches, sent notifications (>7 days), and resolved error logs. |

**Concurrency Safety:** Every job acquires a Postgres advisory lock (`pg_try_advisory_lock(hashtext('<job-name>'))`) before execution and releases it in `finally`.

---

## Realtime Synchronization

- **Transport:** The web client connects to Supabase Realtime WebSockets through Caddy (`/realtime/v1/*` → Kong). Channels authenticate using caller JWT claims against RLS policies.
- **Channels:** Shopping lists subscribe to resource-scoped channels (`list:<listId>`).
- **Replication Trigger:** Because Postgres write-ahead logs for deleted rows include only primary keys, list item modifications trigger updates to the parent `shopping_list.updated_at` timestamp, signaling clients to reconcile state.

---

## Offline Client Architecture

- **Mutation Queue:** Offline writes utilize TanStack Query's paused mutation queue (`apps/web/src/lib/offline/write-queue.ts`).
- **Persistence:** Query caches and pending mutations persist to IndexedDB via `idb-keyval` (`apps/web/src/lib/offline/persist.ts`).
- **Replay Idempotency:** Writes supply client-generated UUIDs or absolute state values (e.g., status updates) ensuring idempotent convergence on reconnect.
- **Failure Handling:** Retries are bounded to 3 attempts with exponential backoff; permanent 4xx failures display error toasts without blocking the queue.

---

## Notifications & Web Push

1. **Outbox Model:** Reminders are staged in the `notification` table with a uniqueness constraint on `(user_id, type, target_id, occurrence_key)`.
2. **Claim-Then-Send:** `dispatch-notifications` claims unsent rows by verifying `public.notification_still_holds(n)` and setting `sent_at = now()` atomically. If all push endpoints fail, `sent_at` is cleared for retry.
3. **Quiet Hours:** Calculated in Postgres via `public.after_quiet_hours()` to defer delivery to the recipient's configured wake window in their local timezone.
4. **Push Protocol:** Web Push notifications conform to RFC 8292 (VAPID authentication over P-256 curves).

---

## Workspace Packages

- **`packages/shared`:** Zod schemas, domain interfaces, RFC 9457 error helpers, and PII scrubbing functions shared across web and service.
- **`packages/recurrence`:** Pure, dependency-free mathematical engine for anchored recurrence calculations (daily, weekly, monthly, annual, rotation schedules).
- **`packages/matching`:** Pure ingredient normalization, unit conversions, and token similarity algorithms for deal and recipe pairing.
