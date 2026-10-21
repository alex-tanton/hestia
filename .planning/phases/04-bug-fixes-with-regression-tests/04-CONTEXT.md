# Phase 4: Bug Fixes With Regression Tests - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the seven known bugs and robustness gaps (FIX-01 to FIX-07) and guard each with a regression test that is shown to fail on the unfixed code and pass after. Application behavior does not change except where a documented bug is fixed. New capabilities (for example making deal-add offline-queueable) are out of scope.

The seven items:

- **FIX-01** Deal add-to-list can create a duplicate after a lost response (`useAddDealToList`).
- **FIX-02** Recipe add-to-list idempotency is checked, and fixed only if it leaks.
- **FIX-03** A structural test guards every PATCH/update schema against default injection.
- **FIX-04** The `RotationEditor` accessibility suppression is replaced with proper semantics.
- **FIX-05** Service-role usage is audited and a test proves the ESLint fence fails when violated.
- **FIX-06** `deploy.sh` no longer passes the database password on a command line.
- **FIX-07** Kong denies the unused GoTrue paths, with positive sign-in and refresh flows still proven.

</domain>

<decisions>
## Implementation Decisions

### Offline replay (FIX-01, FIX-02)
- **D-01:** Scout finding that frames the fix: mutations use `retry: false` (`apps/web/src/lib/api/query-client.ts:34`) and the deal-add button is disabled offline, so this is not an automatic replay. The duplicate happens when a request lands server-side, the response is lost, the user sees the error toast and taps again, and a fresh `crypto.randomUUID()` goes out. The server already ignores a repeated item id (`on conflict (id) do nothing`, `apps/service/src/services/lists.ts:324`), so the fix is client-side only. The failing test must reproduce exactly this sequence before the fix goes in (STATE.md: "the offline-duplicate root cause is unproven").
- **D-02:** Hold the id until success. `useAddDealToList` mints the id once per user attempt (a ref or the mutation variables), reuses it on a re-tap after an error, and mints a fresh one only after a success. Deliberately adding the same deal twice still works. No server change, no new capability. — **Reversibility:** reversible — one hook, no contract change.
- **D-03:** Rejected: a deterministic UUIDv5 per list+deal (blocks adding the same deal twice, a behavior change) and routing deal-add through the offline write queue (new capability, out of scope).
- **D-04:** Recipe add-to-list: prove it first, fix only a real leak. `addMissingIngredientsToList` (`apps/service/src/services/add-to-list.ts`) already skips an ingredient whose normalized name is on the list as `needed` or `in_cart`, so an immediate replay is probably already a no-op. Write a service-level test that replays the same call after a lost response. If it is a no-op, keep that test as the guard and record "no leak" as the finding. If an edge case leaks (for example an item marked bought between the two calls), fix that case only, and decide whether re-adding a bought item is intended before changing it. No idempotency-key table or column (that would need a migration and a contract change).

### RotationEditor (FIX-04)
- **D-05:** Keep drag-and-drop; restructure so it needs no suppression. Design › 17 specifies "reorderable by drag handles with up and down buttons as the non-gesture alternative", so removing drag would depart from the written spec. The lint rule fires on the drag handlers on the `<li>` (confirmed by lifting the suppression: `jsx-a11y/no-noninteractive-element-interactions` at the `<li>`). Target structure: the grip becomes a real draggable `<button>` (the drag source); drop handlers move to a `role="presentation"` wrapper inside the `<li>`, so the list keeps its semantics. Planning must verify the exact structure passes lint with no `eslint-disable`. — **Reversibility:** reversible.
- **D-06:** Keyboard test scope: with keyboard only (userEvent), Tab reaches Up/Down/Remove in order, Enter and Space move or remove a member, edge buttons disable, and focus follows the member as the existing focus-request code intends. No new interaction (no arrow keys on the grip). `RotationEditor` has no test file today, so this is a new `RotationEditor.test.tsx`. Existing focus management (`focusRequest` effect) must not change.

### Kong and GoTrue paths (FIX-07)
- **D-07:** Kong gets an allowlist, not a denylist. Replace the catch-all `auth-v1-all` route in `docker/kong.yml` with explicit routes and methods for only the GoTrue paths the browser needs, and answer everything else with a refusal. Planning must enumerate the paths from the supabase-js source and the E2E sign-in flows (the web app calls `signInWithPassword`, `refreshSession`, `signOut`, `setSession`, and `signInWithOtp`/`verifyOtp` behind the magic-link flag in `apps/web/src/lib/auth/auth-client.ts`). `hearth-service` reaches GoTrue directly on `auth:9999` (signup, token, user, admin) and never through Kong, so Kong can deny those paths without affecting the service. Caddy's existing refusals stay as the first layer. The existing open route `auth-v1-open` (`/auth/v1/verify`) must keep working for email links. — **Reversibility:** costly — a missed path breaks sign-in on the production host and a rollback needs a redeploy; this is why the proof below has two layers.
- **D-08:** Proof is a static test plus E2E. A vitest unit test parses `docker/kong.yml` and asserts the exact allowed route and method set (it fails if a route is added or widened) and always runs in the unit suite, with no Docker. `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts` gains probes for denied paths and methods, and the existing sign-in, refresh and reset-password specs are the positive flows in PR CI.

### deploy.sh password (FIX-06)
- **D-09:** Pass the password through the environment, scoped to the one command: `PGPASSWORD=… supabase migration up --db-url postgresql://postgres@host:5432/…`, with the variable set only for that command (`scripts/deploy.sh:94-97`). The CLI uses pgx, which reads `PGPASSWORD` by default; planning must confirm the CLI honors it (the cloud box has no Docker). The environment is still visible to the same user or root, but the password is no longer in `ps` or in any `set -x` trace of the command line. Rejected: a temporary `PGPASSFILE` (file lifecycle on a production script) and running the CLI in a container (changes how deploys run). — **Reversibility:** reversible.
- **D-10:** Test it by running the real `scripts/deploy.sh` with stub binaries. A Node test in the style of `scripts/test-sweep.test.mjs` puts stub `docker`, `supabase`, `curl` and `git` on `PATH` that log argv and environment to a file, runs the script against a fake env file with a sentinel password, and asserts the sentinel appears in no argv. It must fail against the current line 96. Do not restructure `deploy.sh` just to make it testable.

### Landing and red-first evidence
- **D-11:** Three PRs by risk domain, merged in this order, each squash-merged per `CONTRIBUTING.md` (all of it changes behavior, tests, Docker or CI, so none goes straight to `main`): (1) web fixes: FIX-01, FIX-02, FIX-04. (2) guard tests: FIX-03 and FIX-05 (tests and lint only, no runtime behavior). (3) infra: FIX-06 and FIX-07 (`scripts/deploy.sh`, `docker/kong.yml`, E2E), merged last and reviewed most carefully. Every merge to `main` deploys; `.planning/` edits stay out of the PRs. Keep the workflow named `CI` and its job ids unchanged.
- **D-12:** Red-first proof is a ledger, because a squash merge discards a failing-test-first commit. For each fix, run the new test against the unfixed source (a worktree at the parent commit, or the fix reverted) and record the failing output, then the passing run after, in a ledger under `.planning/cleanup/`. Checks that need Docker (the Kong E2E probes) take their red and green from the PR's CI runs, with run links noted. Nothing goes into `docs/` (no review, decision-log, or ADR files).
- **D-13 (owner, 2026-10-20):** Accept the FIX-02 server change: a per-list `pg_advisory_xact_lock` taken after `requireList` in `addMissingIngredientsToList`, no migration, no contract change. Overlapping add-recipe-to-list calls are the real leak under D-04. The PR 1 body states the assumption.
- **D-14 (owner, 2026-10-20):** Keep `GET` and `POST /auth/v1/admin/users` routable in Kong, behind the service-role-only `admin` ACL, for the E2E seed. This is an owner exception to D-07's deny-the-unused-paths rule. The PR 3 description notes the alternative (publish `auth:9999` in the E2E overlay, allocate a port in `run-identity.ts`, repoint the seed).
- **D-15 (owner, 2026-10-20):** Document the manual `hearth-compose up -d --force-recreate kong` step after a `kong.yml` change instead of changing `deploy.sh` (D-10 stands; automatic recreate is a Phase 6 idea). Keep the button drag handle for FIX-04 and note the Firefox pointer-drag caveat in the PR description; the Up/Down buttons still work.

### Claude's Discretion
- **FIX-03:** How PATCH/update schemas in `packages/shared/src/api/` are discovered (a naming convention such as `update*RequestSchema` versus an explicit registry list), and the assertion itself. Intent: an empty body parses to an empty result, so an omitted field can never be reset by a partial update. Cover the schemas the CONCERNS map names (`bills.ts`, `membership.ts`, `deals.ts`) and check that schemas with `.default()` that are not update schemas (query schemas in `deals.ts`, `recipes.ts`) are not flagged.
- **FIX-05:** The audit of service-role usage outside `apps/service/src/privileged/` (`routes/users.ts`, `http/context.ts`, `cli.ts`, `main.ts` per CONCERNS) and the negative-control test: lint a fixture file through the ESLint Node API and assert the privileged-import rule (`no-restricted-imports` and the dynamic-import `no-restricted-syntax` rule in `eslint.config.js`) reports it. Whether the audit finds a real violation to fix, and where the test lives, are the planner's call; do not widen the fence without a finding.
- Names of ledger files, test file placement, commit grouping inside each PR, and the order of items within a PR.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/ROADMAP.md` — Phase 4 goal and the five success criteria
- `.planning/REQUIREMENTS.md` — FIX-01 to FIX-07 and the Out of Scope table
- `.planning/PROJECT.md` — constraints (no behavior change, every fix has a regression test, `main` deploys, `docs/` is the only spec source)
- `.planning/STATE.md` — blockers: the unproven offline-duplicate root cause, main CI gaps, no branch protection
- `.planning/codebase/CONCERNS.md` — the source of the Known Bugs and Security Considerations behind FIX-01 to FIX-07
- `.planning/phases/03-evidence-gated-removal/03-CONTEXT.md` — landing pattern (PRs, stacked, squash merge, `.planning/` out of PRs) and the ledger approach

### Process
- `CONTRIBUTING.md` — which changes go through PRs and which go straight to `main`; commitlint scope enum
- `docs/testing.md` — clock pin, the date and timezone sweep, and test conventions new tests must follow (no bare `new Date()` or `Date.now()` in tests)
- `docs/architecture.md` — the RLS rule and the service-role fence (FIX-05)
- `.github/workflows/ci.yml` — jobs including Docker builds, integration and E2E; keep the name `CI` and job ids unchanged

### FIX-01 / FIX-02 (offline replay)
- `apps/web/src/lib/api/deals.ts` — `useAddDealToList`
- `apps/web/src/screens/deals/AddToList.tsx` — the add button and error toast flow
- `apps/web/src/lib/api/meal-hooks.ts` — `useAddRecipeToList`
- `apps/web/src/lib/offline/write-queue.ts` — the queue contract and the "client-generated id" rule (non-negotiable 9)
- `apps/web/src/lib/api/query-client.ts` — mutation retry defaults
- `apps/service/src/services/lists.ts` — `addListItem` and its `on conflict (id) do nothing`
- `apps/service/src/services/add-to-list.ts` — `addMissingIngredientsToList`
- `e2e/tests/11-offline-list-sync.spec.ts`, `e2e/tests/09-search-deals-and-add-to-list.spec.ts`, `e2e/tests/13-recipe-import-and-readiness.spec.ts` — related E2E coverage

### FIX-03 / FIX-05 (guard tests)
- `packages/shared/src/api/bills.ts` (lines 77-122), `packages/shared/src/api/membership.ts`, `packages/shared/src/api/deals.ts`, and the other `update*RequestSchema` modules
- `eslint.config.js` — the service-role fence block (`apps/service/src/**/*.ts`)
- `apps/service/src/privileged/`, `apps/service/src/http/context.ts`, `apps/service/src/routes/users.ts`, `apps/service/src/cli.ts`, `apps/service/src/main.ts`

### FIX-04 (RotationEditor)
- `apps/web/src/components/chores/RotationEditor.tsx` — the suppression at the `<li>` and the focus-request effect
- `apps/web/src/screens/chores/ChoreFormScreen.tsx` — its only consumer
- Design › "17. Chores" › Chore sheet and Accessibility › Keyboard / Focus management (cited in the component header; the spec text lives under `docs/`)

### FIX-06 / FIX-07 (infra)
- `scripts/deploy.sh` (line 96 is the exposure) and `.github/workflows/deploy.yml`
- `scripts/test-sweep.test.mjs` — the pattern for a Node test of a script
- `docker/kong.yml`, `docker/Caddyfile`, `docker/docker-compose.yml` (GoTrue settings), `docker/kong-entrypoint.sh`
- `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts`, `e2e/tests/01-signup-and-first-household.spec.ts`, `e2e/tests/06-owner-reset-password.spec.ts`, `e2e/tests/07-magic-link-disabled.spec.ts`
- `apps/web/src/lib/auth/auth-client.ts` — every GoTrue call the browser makes
- `apps/service/src/gotrue/client.ts`, `apps/service/src/privileged/gotrue-admin.ts` — the paths the service calls directly

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/test/harness.tsx` and the existing hook and component tests (`write-queue.test.tsx`, `chores-offline-queue.test.tsx`): the harness for a deal-add hook test with a fake API client whose first call lands but whose response is lost
- `scripts/test-sweep.test.mjs`: pattern for spawning a script from a Node test
- `apps/service/src/test/` and the integration setup (`*.integration.test.ts`): the pattern for the service-level recipe replay test, which needs the Supabase stack (PR CI) unless a fake-app seam covers it
- `e2e/support/raw-http.ts`: `rawRequest` for Kong and Caddy probes

### Established Patterns
- Zod update schemas are built from unwrapped field shapes, never `.partial()` on a create schema (`updateBillRequestSchema` in `packages/shared/src/api/bills.ts`); the structural test generalizes this.
- Offline-queueable writes carry a client-generated id; online-only mutations (deal add, recipe add) do not.
- Errors surface through toasts and `FormMessage`; new UI code follows the existing `Button` and `ListRow` primitives.
- Lint runs with `--max-warnings=0`; the repo has six `eslint-disable` comments, each with a reason. FIX-04 removes one.
- Tests may not read the real clock; the unit pin fixes `Date` to `2026-10-14T12:00:00.000Z`.

### Integration Points
- `useAddDealToList` is called only from `AddToList.tsx`; the hook change stays inside `deals.ts` and its test.
- Kong changes affect sign-in, token refresh, sign-out, and the Realtime WebSocket route (do not touch the `realtime-v1-*` routes).
- `deploy.sh` runs on the self-hosted runner on every deploy; the test uses stubs and never runs a real deploy.

</code_context>

<specifics>
## Specific Ideas

- The owner accepted the recommended option on every question; the choices favour smallest behavior change and deny-by-default security.
- The ledger and evidence stay under `.planning/cleanup/` and in PR descriptions, not in `docs/`.

</specifics>

<deferred>
## Deferred Ideas

- Making deal-add (or recipe add) an offline-queueable write: a new capability, not a bug fix.
- A server-side idempotency key for add-to-list (new table or column plus contract change): only if D-04's proof finds a leak that no client-side or query change can close.
- Arrow-key reordering on the drag handle: new interaction behavior.
- Removing the CSP `style-src 'unsafe-inline'` risk (SEC-01), actionlint and action pinning (CIX-01), splitting large test files (TEST-01): v2 requirements.
- The permanent PATCH-schema, Kong and deploy checks in CI beyond the tests added here: Phase 6.

</deferred>

---

*Phase: 4-Bug Fixes With Regression Tests*
*Context gathered: 2026-10-20*
