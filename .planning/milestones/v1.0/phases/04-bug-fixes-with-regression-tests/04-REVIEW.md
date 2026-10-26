---
phase: 04-bug-fixes-with-regression-tests
reviewed: 2026-10-20T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/service/src/services/add-to-list.ts
  - apps/service/src/meal-plan.integration.test.ts
  - apps/service/src/kong-routes.test.ts
  - apps/web/src/lib/api/deals.ts
  - apps/web/src/screens/deals/deal-card.test.tsx
  - apps/web/src/components/chores/RotationEditor.tsx
  - apps/web/src/components/chores/RotationEditor.test.tsx
  - docker/kong.yml
  - scripts/deploy.sh
  - scripts/deploy.test.mjs
  - test/eslint-service-role-fence.test.mjs
  - packages/shared/src/api/patch-schemas.test.ts
  - e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts
  - package.json
  - apps/service/package.json
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-20
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The Phase 4 fixes are mostly sound. I found no blocking defects, but five warnings remain.

- **FIX-02 (advisory lock):** The lock is correct in scope and ordering. It is transaction-scoped, taken inside the `withUserDb` transaction, and read-committed semantics let the second caller see the first's rows. The lock order is add-to-list, then list-activity, then notification rows. `addListItem` takes only the last two in the same order, so no deadlock cycle exists.
- **FIX-06 (deploy.sh):** `PGPASSWORD` is scoped to the single `supabase migration up` command and the URL carries no password. I found no remaining command-line or log exposure.
- **FIX-07 (Kong):** I traced every `supabase-js` call in `apps/web/src/lib/auth/auth-client.ts` against the new allowlist. Each call the PWA makes has a route, and nothing the PWA needs is blocked. One dangerous route is still allowed (WR-01).
- **FIX-01 (held deal-add id):** The fix only partly covers its own scenario, because the held ids live in a per-card hook instance (WR-02).
- **FIX-04 (RotationEditor):** The change swaps the `<li draggable>` drag source for `<button draggable>`, which has a browser-compat risk (WR-03). The add-member focus path is untested (WR-04).
- **FIX-03/05 (guard tests):** The patch-schema guard has a blind spot for nested fields (WR-05).

## Warnings

### WR-01: `/auth/v1/otp` stays open to the anon key with signup enabled and autoconfirm on, so it still creates users and bypasses `/api/signup`

**File:** `docker/kong.yml:105-124` (context: `docker/docker-compose.yml:78,89`, `apps/service/src/routes/auth.ts:10-11`)
**Issue:**
- The allowlist keeps `POST /auth/v1/otp` open to the anon key, which the owner approved. The comment says it is "used only when the build enables magic link", but the route is unconditional.
- Compose runs GoTrue with `GOTRUE_DISABLE_SIGNUP: 'false'` and `GOTRUE_MAILER_AUTOCONFIRM: 'true'`, and `HEARTH_MAGIC_LINK_ENABLED` defaults to `false` (no SMTP).
- From my recollection of GoTrue's magic-link handler (not verified against the v2.196 source), `signInWithOtp({ email })` defaults to `create_user: true`. With autoconfirm it creates a confirmed user in `auth.users` first, then tries to send the mail. With no SMTP the mail step fails, but the user row is already committed.
- Any internet caller can therefore create confirmed, passwordless `auth.users` rows for arbitrary email addresses.
  - The `auth.users` insert trigger (`supabase/migrations/20260919070000_schema.sql:654`) creates a profile row for each one.
  - The email is squatted, so a later legitimate `/api/signup` for that address (for example an invitee) fails with "already registered".
  - The comment in `apps/service/src/routes/auth.ts` ("Caddy refuses GoTrue's own /signup from outside, so there is no way around it") is no longer true.
- This predates the change (all of `/auth/v1/` was open before). The new allowlist keeps the hole rather than closing it, and the approval may not have considered `create_user`.

**Fix:** The least invasive fix is to make the route conditional on the magic-link switch, so it exists only when `HEARTH_MAGIC_LINK_ENABLED=true`. Otherwise drop the route by default, and keep the kong-routes table and the E2E expectations in sync. If the route must stay, either gate it behind a request-transformer/pre-function that rejects bodies where `create_user` is not explicitly `false`, or set `GOTRUE_DISABLE_SIGNUP=true` after confirming that hearth-service's `/signup` and the admin API still work. At minimum, correct the `routes/auth.ts` comment and the `kong.yml` comment so they state the real exposure. Please verify the GoTrue behaviour on a running stack (`curl -X POST .../auth/v1/otp` with the anon key and a fresh email) before choosing.

### WR-02: Held deal-add id lives in a per-card hook instance, so it is lost whenever the card unmounts

**File:** `apps/web/src/lib/api/deals.ts:256-272` (instantiated per card in `apps/web/src/screens/deals/AddToList.tsx:34`)
**Issue:**
- `held` is a `useRef` inside `useAddDealToList`, and the hook is called once per `AddToList`, so once per `DealCard`.
- A lost-response error followed by anything that unmounts that card discards the id. Examples: changing the search or filter, paging, or navigating away and back.
- The retry then mints a new UUID, the service's `on conflict (id) do nothing` does not apply, and the deal lands twice. That is exactly the duplicate FIX-01 set out to prevent.
- The `Map` is never pruned on a permanent failure, such as a 404 for an expired deal. The id is reused for the life of the card, which is harmless but unbounded in principle.
- A held id outlives its usefulness in one more case. If the first add actually landed (lost response) and the user later taps Add on that deal again, expecting a second copy, the old id is reused. The insert is silently swallowed and the toast still says "Added".

**Fix:** Hold the ids at a scope that survives card unmounts, for example a module-level `Map` or one owned by the `QueryClient` (a `WeakMap<QueryClient, Map<string, string>>`). Delete the entry on success. Optionally also delete it on a definitive 4xx other than network failure/5xx, and give entries a short TTL (a few minutes) so a stale id cannot swallow a deliberate second add:

```ts
const heldIds = new WeakMap<QueryClient, Map<string, { id: string; at: number }>>();
```

### WR-03: The drag source is now a `<button draggable>`, which may not start a drag in Firefox

**File:** `apps/web/src/components/chores/RotationEditor.tsx:142-156`
**Issue:**
- Before FIX-04 the drag source was the `<li draggable>`. It is now a `<button draggable>`.
- From memory (not verified here), Firefox does not initiate HTML5 drag from `<button>` elements. If so, pointer reordering silently stops working in Firefox.
- The test drives `fireEvent.dragStart/dragOver/drop` directly, so it cannot catch a browser-level regression.
- Drag-and-drop never worked on touch (no polyfill), so the pointer path is desktop-only anyway.

**Fix:** Make the draggable element a non-button, for example `<span draggable ...>`, or put `draggable` on a wrapper `<div>` around the handle. Add a Playwright check for the drag in at least Chromium and Firefox if cross-browser support matters. Otherwise document that drag is best-effort.

### WR-04: The add-member focus path is untested and its focus request can be stolen or left pending

**File:** `apps/web/src/components/chores/RotationEditor.tsx:57-80, 103-107`
**Issue:**
- `add()` sets `focusRequest` and the layout effect focuses the new row's "up" control. The new member's row is typically last, so "up" is enabled. The `Select`'s own close/focus-restore handling (Radix) can then run after this effect and move focus back to the trigger. There is no test for the add path (the tests cover move, remove and unavailable only).
- The effect has no dependency array, and `focusRequest` is only cleared when an effect runs. If a request is set but `onChange` leads to no re-render (a parent that ignores the change), the pending request fires on a later unrelated render and pulls focus there.
- The selectors interpolate `userId` straight into a CSS attribute selector (`[data-member="${userId}"]`). Ids are UUIDs today, but a `"` in an id would make `querySelector` throw inside an effect.

**Fix:**
- Add a keyboard test that picks a member from "Add to rotation" and asserts where focus lands.
- Use `CSS.escape(userId)` in the selector.
- Clear any stale request when `order` is unchanged, for example by recording the expected next order and consuming the request only when `order` matches it.

### WR-05: The PATCH-default guard does not descend into nested objects or arrays

**File:** `packages/shared/src/api/patch-schemas.test.ts:54-60`
**Issue:**
- `defaultingFields` unwraps only the wrappers directly around each top-level field (`optional`, `nullable`, `pipe`, and so on).
- A PATCH body with a nested object or array whose inner schema defaults would not be flagged. An example is `settings: z.object({ x: z.number().default(1) }).optional()`.
  - A partial update that sends `settings: {}` would reset `x` to 1.
  - This is the same bug class the guard targets, so a future schema would pass unnoticed.
- A whole-body `.transform` that injects values also goes unseen, because only the `pipe` input side is followed.
- The `safeParse({})` assertion is vacuous when parsing fails (it maps to `[]`), so it adds no signal.
- The "Eleven today" count in a comment will rot.

**Fix:** Recurse into `object` shapes, `array` elements and `record`/`tuple` members in `defaultingFields`, and add a mutant for a nested default (`z.object({ a: z.object({ b: z.number().default(1) }).optional() })`). Drop the hard-coded count from the comment.

## Info

### IN-01: `admin/users` is exposed on the production gateway only for the E2E seed

**File:** `docker/kong.yml:126-146`
**Issue:**
- `GET`/`POST /auth/v1/admin/users` is reachable through Caddy on the public ingress in production. It is guarded only by the service-role key via key-auth plus the `admin` ACL (the owner-approved exception).
- Only the E2E seed uses it, and the seed targets the Supabase CLI's Kong, not this file, in dev.
- It adds production attack surface with no production use. It is not a regression, because the old config allowed the whole GoTrue surface to the admin group.

**Fix:** Move the route to an E2E-only declarative file or compose overlay (mount an extra kong config under `e2e/`), so production Kong carries only the PWA's routes.

### IN-02: Add-to-list lock: scope notes and a concurrency test that proves the lock only by timing

**File:** `apps/service/src/services/add-to-list.ts:35-37`, `apps/service/src/meal-plan.integration.test.ts:~437-450`
**Issue:**
- The lock serializes only add-to-list against add-to-list. A concurrent manual add via `POST /api/lists/:id/items` of the same ingredient is not serialized and can still duplicate. The comment's "two members adding together" is accurate only for two add-to-list calls.
- The lock is taken even when `recipeIds` is empty (a week with no meals). There is no `lock_timeout`, so a stuck holder blocks later callers until the pool or a request timeout gives out.
- `requireList` runs before the lock and calls `mark_household_active`, which may write the household row (first call of a UTC day). That write also serializes same-household calls, so a test that happens to run on the first call of a day could pass without the advisory lock.
- The test fires two `Promise.all` calls from one user against a fresh household. It relies on the two requests overlapping, and nothing proves that it fails without the lock.

**Fix:** Skip the lock when there is nothing to add. Consider `set local lock_timeout` for the transaction. For test determinism, hold the lock from the test (open a second connection, take `pg_advisory_xact_lock(hashtextextended('add-to-list:<id>', 0))`, start the request, assert it blocks, then release).

### IN-03: deploy.sh does not guard an empty password, and the stub test cannot prove the real CLI honors `PGPASSWORD`

**File:** `scripts/deploy.sh:97-99`, `scripts/deploy.test.mjs`
**Issue:**
- Result: the password is on no command line and in no log, and it is scoped to one command (confirmed by the stubbed run). What remains is the process environment of the `supabase` process, which same-uid and root users can read from `/proc/<pid>/environ`. This is normal for `PGPASSWORD`.
- If `POSTGRES_PASSWORD` is missing or empty in `.env`, `env_value` returns an empty string and the CLI is run with an empty password. It fails with a confusing connection error instead of a clear message. The sed parse also keeps surrounding quotes if the value is quoted in `.env`.
- The test uses stubs, so it cannot confirm that the real Supabase CLI picks `PGPASSWORD` up for `--db-url` without a password. If it did not, the failure mode is a safe abort before any restart, but it would only show up on a real deploy.

**Fix:** Add `[[ -n "$pw" ]] || fail "POSTGRES_PASSWORD is not set in $env_file"` before the migration. Strip surrounding quotes in `env_value`. Verify the PGPASSWORD behaviour once against a real CLI and note it in `docs/deploy.md`.

### IN-04: Drag handle is a button that does nothing when activated; unnecessary cast

**File:** `apps/web/src/components/chores/RotationEditor.tsx:142-156, 75`
**Issue:**
- The handle is a real `<button>` with an accessible name ("Drag X to reorder") but no click or keyboard behaviour. Screen-reader users who navigate by virtual cursor will meet buttons that look actionable and do nothing.
- Line 75 casts `target as HTMLButtonElement` to read `.disabled` on an `HTMLElement` (the heading is not a button).

**Fix:** Mark the handle `aria-hidden="true"` with a non-button element (this also helps WR-03), and replace the cast with `'disabled' in target && target.disabled === true`.

---

_Reviewed: 2026-10-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
