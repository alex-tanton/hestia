# Phase 4: Bug Fixes With Regression Tests - Research

**Researched:** 2026-10-20
**Domain:** Regression-guarded fixes across a React/TanStack Query PWA, a Fastify/Kysely service, an ESLint flat config, a bash deploy script, and a Kong/GoTrue gateway
**Confidence:** HIGH (every fix and every guard test below was prototyped and run red-then-green in a scratch worktree; the four places where research contradicts or extends CONTEXT.md are flagged in the Summary)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Offline replay (FIX-01, FIX-02)**
- **D-01:** Scout finding that frames the fix: mutations use `retry: false` (`apps/web/src/lib/api/query-client.ts:34`) and the deal-add button is disabled offline, so this is not an automatic replay. The duplicate happens when a request lands server-side, the response is lost, the user sees the error toast and taps again, and a fresh `crypto.randomUUID()` goes out. The server already ignores a repeated item id (`on conflict (id) do nothing`, `apps/service/src/services/lists.ts:324`), so the fix is client-side only. The failing test must reproduce exactly this sequence before the fix goes in (STATE.md: "the offline-duplicate root cause is unproven").
- **D-02:** Hold the id until success. `useAddDealToList` mints the id once per user attempt (a ref or the mutation variables), reuses it on a re-tap after an error, and mints a fresh one only after a success. Deliberately adding the same deal twice still works. No server change, no new capability. — **Reversibility:** reversible — one hook, no contract change.
- **D-03:** Rejected: a deterministic UUIDv5 per list+deal (blocks adding the same deal twice, a behavior change) and routing deal-add through the offline write queue (new capability, out of scope).
- **D-04:** Recipe add-to-list: prove it first, fix only a real leak. `addMissingIngredientsToList` (`apps/service/src/services/add-to-list.ts`) already skips an ingredient whose normalized name is on the list as `needed` or `in_cart`, so an immediate replay is probably already a no-op. Write a service-level test that replays the same call after a lost response. If it is a no-op, keep that test as the guard and record "no leak" as the finding. If an edge case leaks (for example an item marked bought between the two calls), fix that case only, and decide whether re-adding a bought item is intended before changing it. No idempotency-key table or column (that would need a migration and a contract change).

**RotationEditor (FIX-04)**
- **D-05:** Keep drag-and-drop; restructure so it needs no suppression. Design › 17 specifies "reorderable by drag handles with up and down buttons as the non-gesture alternative", so removing drag would depart from the written spec. The lint rule fires on the drag handlers on the `<li>` (confirmed by lifting the suppression: `jsx-a11y/no-noninteractive-element-interactions` at the `<li>`). Target structure: the grip becomes a real draggable `<button>` (the drag source); drop handlers move to a `role="presentation"` wrapper inside the `<li>`, so the list keeps its semantics. Planning must verify the exact structure passes lint with no `eslint-disable`. — **Reversibility:** reversible.
- **D-06:** Keyboard test scope: with keyboard only (userEvent), Tab reaches Up/Down/Remove in order, Enter and Space move or remove a member, edge buttons disable, and focus follows the member as the existing focus-request code intends. No new interaction (no arrow keys on the grip). `RotationEditor` has no test file today, so this is a new `RotationEditor.test.tsx`. Existing focus management (`focusRequest` effect) must not change.

**Kong and GoTrue paths (FIX-07)**
- **D-07:** Kong gets an allowlist, not a denylist. Replace the catch-all `auth-v1-all` route in `docker/kong.yml` with explicit routes and methods for only the GoTrue paths the browser needs, and answer everything else with a refusal. Planning must enumerate the paths from the supabase-js source and the E2E sign-in flows (the web app calls `signInWithPassword`, `refreshSession`, `signOut`, `setSession`, and `signInWithOtp`/`verifyOtp` behind the magic-link flag in `apps/web/src/lib/auth/auth-client.ts`). `hearth-service` reaches GoTrue directly on `auth:9999` (signup, token, user, admin) and never through Kong, so Kong can deny those paths without affecting the service. Caddy's existing refusals stay as the first layer. The existing open route `auth-v1-open` (`/auth/v1/verify`) must keep working for email links. — **Reversibility:** costly — a missed path breaks sign-in on the production host and a rollback needs a redeploy; this is why the proof below has two layers.
- **D-08:** Proof is a static test plus E2E. A vitest unit test parses `docker/kong.yml` and asserts the exact allowed route and method set (it fails if a route is added or widened) and always runs in the unit suite, with no Docker. `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts` gains probes for denied paths and methods, and the existing sign-in, refresh and reset-password specs are the positive flows in PR CI.

**deploy.sh password (FIX-06)**
- **D-09:** Pass the password through the environment, scoped to the one command: `PGPASSWORD=… supabase migration up --db-url postgresql://postgres@host:5432/…`, with the variable set only for that command (`scripts/deploy.sh:94-97`). The CLI uses pgx, which reads `PGPASSWORD` by default; planning must confirm the CLI honors it (the cloud box has no Docker). The environment is still visible to the same user or root, but the password is no longer in `ps` or in any `set -x` trace of the command line. Rejected: a temporary `PGPASSFILE` (file lifecycle on a production script) and running the CLI in a container (changes how deploys run). — **Reversibility:** reversible.
- **D-10:** Test it by running the real `scripts/deploy.sh` with stub binaries. A Node test in the style of `scripts/test-sweep.test.mjs` puts stub `docker`, `supabase`, `curl` and `git` on `PATH` that log argv and environment to a file, runs the script against a fake env file with a sentinel password, and asserts the sentinel appears in no argv. It must fail against the current line 96. Do not restructure `deploy.sh` just to make it testable.

**Landing and red-first evidence**
- **D-11:** Three PRs by risk domain, merged in this order, each squash-merged per `CONTRIBUTING.md` (all of it changes behavior, tests, Docker or CI, so none goes straight to `main`): (1) web fixes: FIX-01, FIX-02, FIX-04. (2) guard tests: FIX-03 and FIX-05 (tests and lint only, no runtime behavior). (3) infra: FIX-06 and FIX-07 (`scripts/deploy.sh`, `docker/kong.yml`, E2E), merged last and reviewed most carefully. Every merge to `main` deploys; `.planning/` edits stay out of the PRs. Keep the workflow named `CI` and its job ids unchanged.
- **D-12:** Red-first proof is a ledger, because a squash merge discards a failing-test-first commit. For each fix, run the new test against the unfixed source (a worktree at the parent commit, or the fix reverted) and record the failing output, then the passing run after, in a ledger under `.planning/cleanup/`. Checks that need Docker (the Kong E2E probes) take their red and green from the PR's CI runs, with run links noted. Nothing goes into `docs/` (no review, decision-log, or ADR files).

### Claude's Discretion
- **FIX-03:** How PATCH/update schemas in `packages/shared/src/api/` are discovered (a naming convention such as `update*RequestSchema` versus an explicit registry list), and the assertion itself. Intent: an empty body parses to an empty result, so an omitted field can never be reset by a partial update. Cover the schemas the CONCERNS map names (`bills.ts`, `membership.ts`, `deals.ts`) and check that schemas with `.default()` that are not update schemas (query schemas in `deals.ts`, `recipes.ts`) are not flagged.
- **FIX-05:** The audit of service-role usage outside `apps/service/src/privileged/` (`routes/users.ts`, `http/context.ts`, `cli.ts`, `main.ts` per CONCERNS) and the negative-control test: lint a fixture file through the ESLint Node API and assert the privileged-import rule (`no-restricted-imports` and the dynamic-import `no-restricted-syntax` rule in `eslint.config.js`) reports it. Whether the audit finds a real violation to fix, and where the test lives, are the planner's call; do not widen the fence without a finding.
- Names of ledger files, test file placement, commit grouping inside each PR, and the order of items within a PR.

### Deferred Ideas (OUT OF SCOPE)
- Making deal-add (or recipe add) an offline-queueable write: a new capability, not a bug fix.
- A server-side idempotency key for add-to-list (new table or column plus contract change): only if D-04's proof finds a leak that no client-side or query change can close.
- Arrow-key reordering on the drag handle: new interaction behavior.
- Removing the CSP `style-src 'unsafe-inline'` risk (SEC-01), actionlint and action pinning (CIX-01), splitting large test files (TEST-01): v2 requirements.
- The permanent PATCH-schema, Kong and deploy checks in CI beyond the tests added here: Phase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | Offline list-add replay reproduced with a failing test, then fixed (stable ID in `useAddDealToList`) | Sequence reproduced and gone red/green in a worktree (section FIX-01); id must be held per list+deal, not just per hook |
| FIX-02 | Recipe add-to-list idempotency checked and fixed if it leaks | Sequential replay does not leak; two overlapping calls do (6 rows instead of 3, 5 of 5 runs); per-list advisory lock fixes it (section FIX-02) |
| FIX-03 | Structural test guards every PATCH schema against default injection | `endpoints` registry in `contract.ts` lists all 11 PATCH bodies; all 11 reject `{}` today, so the assertion is a wrapper scan plus "`{}` rejected or key-free" (section FIX-03) |
| FIX-04 | `RotationEditor` suppression replaced with proper keyboard semantics | Candidate JSX lints clean with zero `eslint-disable`; keyboard tests pass before and after, handle test is the red one (section FIX-04) |
| FIX-05 | Service-role usage audited, test proves the lint fence fails when violated | Audit table (no violation found); `node --test` probe file with 28 cases kills 4 of 4 config mutants (section FIX-05) |
| FIX-06 | `deploy.sh` no longer passes the database password on the command line | `PGPASSWORD` honored by supabase CLI 2.117.0 (verified against a live Postgres); stubbed-argv test red on current line 96, green after (section FIX-06) |
| FIX-07 | Kong denies the unused GoTrue paths, with positive-flow tests | Allowlist prototyped on Kong 3.9.3 and exercised with real supabase-js 2.116.0 against real GoTrue v2.196.0; needs `_format_version: '3.0'`, keeps `admin/users` for the E2E seed, and needs a manual Kong recreate on the host (section FIX-07) |
</phase_requirements>

## Summary

All seven items were prototyped in a scratch git worktree (since removed) with real tooling: a real Postgres 17 + GoTrue v2.196.0 + the repo's migrations for the service tests, Kong 3.9.3 in front of that GoTrue for the gateway, the real `supabase` 2.117.0 CLI for the password question, and the repo's own ESLint config for the lint questions. The full prototype is saved as `.planning/phases/04-bug-fixes-with-regression-tests/04-prototype.patch` (1,500 lines, all new files and edits except the `yaml` devDependency line). Use it as a reference, not as something to apply blindly; the snippets below are the load-bearing parts. Every changed file passed `eslint --max-warnings=0` rules, `prettier --check`, and `tsc --noEmit` in the prototype; the full service unit suite (725 tests) and the affected web suites (115 tests) stayed green.

**Five findings change or extend CONTEXT.md; the planner must carry them:**

1. **FIX-02 does leak, so the recipe half of success criterion 1 needs a fix, not just a guard.** A sequential replay is a no-op (proven), and a bought item being re-added is intended behavior (`docs/use-cases.md:291` step 2 counts only "needed or in cart"). But two overlapping `addMissingIngredientsToList` calls on one list each read an empty "already on the list" set and each insert everything: 6 rows instead of 3, in 5 of 5 runs on unfixed code. A per-list `pg_advisory_xact_lock` taken after `requireList` makes it 3 of 3 correct, with no migration and no contract change (the same pattern `recordListActivity` already uses). Without this fix there is no recipe test that "fails on the pre-fix code", which the ROADMAP criterion demands. D-04 permits exactly this ("fix that case only").
2. **FIX-03's "an empty body parses to an empty result" is false for all 11 PATCH schemas** (each has an at-least-one-field refine, so `{}` is *rejected*). The assertion must be "no field is wrapped in `default`/`prefault`/`catch`" plus "`{}` is rejected or yields no keys". Discovery: iterate `endpoints.filter(method === 'PATCH')` from `@hearth/shared`, which is the registry the service validates against and the OpenAPI document is built from, then cross-check that every exported `update*RequestSchema` is one of those bodies.
3. **FIX-07 needs three things CONTEXT did not know.** (a) Kong regex paths (`~/auth/v1/token/?$`) are rejected under the file's current `_format_version: '2.1'`; the file must move to `'3.0'` (the whole file, including the untouched realtime routes, was re-tested). (b) The E2E seed (`supabase/seed/seed-users.ts:55,89`, pointed at `${BASE_URL}/auth/v1` by `e2e/setup/stack.ts:151`) creates and lists users through Caddy and Kong with the service-role key, so `GET`/`POST /auth/v1/admin/users` must stay routable (ACL `admin` only). (c) `scripts/deploy.sh` runs `compose up --no-recreate ... kong`, and Compose does not recreate a service when only its bind-mounted `kong.yml` changes (verified), so after merge the owner must run `hearth-compose up -d --force-recreate kong` on the host; document it in the PR and `docs/deploy.md`.
4. **FIX-06 is as CONTEXT hoped:** the supabase CLI 2.117.0 honors `PGPASSWORD` with `--db-url` (verified live), while `SUPABASE_DB_PASSWORD`, which the CLI's own error message suggests, is *not* honored with `--db-url`. A bonus: a password with `@ / : #` now arrives intact, which the URL form would break.
5. **FIX-04: the keyboard path already works.** The Up/Down/Remove buttons are real buttons, so the new keyboard tests pass on the *unfixed* component. The red evidence for FIX-04 is the lint run with the suppression lifted (1 error, `jsx-a11y/no-noninteractive-element-interactions` at the `<li>`) and a drag-handle test. One caveat for the owner: a `<button>` is not a drag source in Firefox (see Assumptions A1); the Up/Down buttons remain the guaranteed alternative.

Two smaller departures: the Kong static test (D-08) and the other infra guards live in the root `node --test` harness (`pnpm test:harness`), not Vitest, because no Vitest project covers repo-root files and the precedent (`test/eslint-clock-ban.test.mjs`) is already there; it needs `yaml@2.9.1` as a root devDependency (the lockfile diff is three importer lines; the version is already locked transitively). And the FIX-01 id must be keyed by list *and* deal, or an id held from a failed add to list A would be silently swallowed (`on conflict (id) do nothing`) when the user then adds to list B.

**Primary recommendation:** Land the three PRs as D-11 orders them, using the prototype's tests nearly verbatim; add the advisory lock for FIX-02; switch `kong.yml` to `_format_version: '3.0'` with the allowlist below; and treat the manual Kong recreate as part of PR 3's definition of done.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stable item id across a deal-add retry (FIX-01) | Browser / Client (`useAddDealToList`) | API (`on conflict (id) do nothing` already dedupes) | The id is minted client-side by design (non-negotiable 9); the server already honors a repeated id |
| Recipe add-to-list serialisation (FIX-02) | API / Backend (`add-to-list.ts`) | Database (advisory lock) | The read-then-insert race is in the service; a unique index would need a migration, which D-04 rejects |
| PATCH defaults guard (FIX-03) | Shared contract package (`packages/shared`) | API (consumes the schemas) | The schemas live in `@hearth/shared`; the service and the PWA both parse with them |
| Keyboard-operable rotation editor (FIX-04) | Browser / Client | — | Pure UI semantics |
| Service-role fence (FIX-05) | Build tooling (ESLint config) | API (the code being fenced) | The fence is a lint rule; the test lives with the repo-level harness |
| Database password handling (FIX-06) | Deploy tooling (`scripts/deploy.sh`) | Database (the credential) | A host-side script on the self-hosted runner |
| GoTrue path allowlist (FIX-07) | Gateway (Kong) | CDN/edge proxy (Caddy keeps its two refusals as layer one) | Kong sits in front of GoTrue; Caddy is the first layer; `hearth-service` reaches `auth:9999` directly and never through either |

## Standard Stack

No new runtime dependency. One new devDependency for the Kong config test.

### Core (all already in the repo; versions read or executed this session)
| Library / tool | Version | Purpose | Why standard here |
|----------------|---------|---------|-------------------|
| Vitest | 5.0.1 | Web, shared, service unit and integration tests | The repo's runner in every workspace [VERIFIED: ran `vitest run` v5.0.1 in the worktree] |
| @testing-library/react, user-event | 16.3.3, 14.6.7 | RotationEditor keyboard test, deal-add flow test | Existing component-test stack [CITED: `.claude/CLAUDE.md` Technical Stack] |
| `node:test` (Node 24.21.0) | built in | Root harness: fence probe, deploy.sh stub run, Kong config test | Precedent: `test/eslint-clock-ban.test.mjs`, `scripts/test-sweep.test.mjs` [VERIFIED: `node --version` v24.21.0; `package.json:16`] |
| ESLint + typescript-eslint | 10.11.0, 8.70.0 | Node API `lintText` for the fence probes | Same pattern as the clock-ban test [VERIFIED: `test/eslint-clock-ban.test.mjs`] |
| eslint-plugin-jsx-a11y (strict) | 6.10.2 | Lint that FIX-04 must satisfy | Already applied to `apps/web/**` [VERIFIED: `eslint.config.js` `jsxA11y.flatConfigs.strict`] |
| Zod | 4.6.5 | `_zod.def` introspection in the PATCH guard | Zod 4's documented library-author surface [CITED: zod.dev/packages/core]; the `type` strings used (`default`, `prefault`, `catch`, `optional`, `nullable`, `pipe`, `object`) were observed against the installed 4.6.5 |
| Kong | 3.9.3 | Gateway under test (Docker image) | Pinned in `docker/docker-compose.yml` [VERIFIED: pulled `kong/kong:3.9.3` and ran it] |
| supabase CLI | 2.117.0 | `migration up --db-url` | Pinned in CI [VERIFIED: `supabase --version` 2.117.0] |
| @supabase/supabase-js / auth-js | 2.116.0 | Source of truth for which GoTrue paths the browser calls | [VERIFIED: `apps/web/package.json:18`; `node_modules/.pnpm/@supabase+auth-js@2.116.0`] |

### Supporting (new)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yaml | 2.9.1 (exact, `saveExact`) | Parse `docker/kong.yml` and `docker/docker-compose.yml` in `test/kong-routes.test.mjs` | Root devDependency: `pnpm add -D -w yaml@2.9.1`. Already locked transitively (`pnpm-lock.yaml` has `yaml@2.9.1`); a dry run adds only the 3-line root importer entry, no new package [VERIFIED: ran `pnpm add -D -w yaml@2.9.1 --lockfile-only` on a copy of the manifests] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `yaml` devDependency | `js-yaml@4.3.2` (also transitive) | Same situation; `yaml` ships types and is the maintained one |
| Root `node --test` for the Kong test | A Vitest unit test (D-08's wording) | No Vitest project covers repo-root files; putting it in `apps/service` would read `../../docker/kong.yml` across a workspace boundary and force `yaml` into the service. Intent of D-08 (always runs in the unit suite, no Docker) is met either way, because `pnpm test` and CI's `test-unit` run `test:harness` first. **Planner may keep Vitest if the owner insists**; the prototype assertions port unchanged |
| Kong exact regex paths | Kong prefix paths (`/auth/v1/token`) | Prefix is a plain string prefix in Kong, so it would also match `/auth/v1/tokenfoo` and `/auth/v1/token/x`; exact regex is the allowlist you can state precisely |

**Installation:**
```bash
pnpm add -D -w yaml@2.9.1
```

**Version verification:** `npm view yaml version` returned `2.9.1` (latest) on 2026-10-20; created 2011-04-15, maintainer `eemeli`, repository `github.com/eemeli/yaml`, 133,252,983 downloads in the week ending 2026-10-18 [VERIFIED: npm registry, api.npmjs.org].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| yaml | npm | 15 yrs (created 2011-04-15) | 133M/wk | github.com/eemeli/yaml | [SUS] from `gsd-tools query package-legitimacy check` (reason `unknown-downloads`: the seam's download lookup returned null; the npm API call made directly returned 133,252,983) | Flagged: planner adds a `checkpoint:human-verify` before the install. Mitigation evidence: already pinned in `pnpm-lock.yaml` at 2.9.1 (resolves to an already-locked tarball, `integrity sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==`); no postinstall script (`postinstall: null`) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `yaml` `[WARNING: flagged as suspicious by the seam; the cause is a failed download lookup, not a package property. Verify before using.]`

No other package is introduced. The Kong, Postgres and GoTrue Docker images used during research are pinned images already named in `docker/docker-compose.yml`.

## Architecture Patterns

### System Architecture Diagram

FIX-01 and FIX-02: where the duplicate comes from.

```
user taps "Add to list"                       user taps again (error toast shown)
        |                                                   |
 useAddDealToList.mutate                          useAddDealToList.mutate
   mutationFn mints crypto.randomUUID()  <-- BUG:   mints ANOTHER id            (FIX-01)
        |                                                   |
POST /api/lists/:id/items {id: A} --lands--> DB        POST ... {id: B} --> DB   2 rows
        |   response lost (fetch rejects -> ApiError(0))
        x
recipe path:  POST /api/recipes/:id/add-to-list {listId}
   addMissingIngredientsToList:  requireList -> SELECT existing normalized_names
        -> match -> INSERT each missing ingredient                                (FIX-02)
   two overlapping calls both SELECT before either INSERT --> every row twice
   fix: pg_advisory_xact_lock('add-to-list:<listId>') right after requireList
```

FIX-07: layers a GoTrue request passes through.

```
browser (supabase-js 2.116.0)
   |  POST /auth/v1/token, POST /auth/v1/logout, GET /auth/v1/user,
   |  POST /auth/v1/otp (magic link only), GET|POST /auth/v1/verify (email link, no apikey)
   v
Caddy :8080  -- layer 1: 403 for POST /auth/v1/signup*, PUT /auth/v1/user* (unchanged)
   |  everything under /auth/v1/* and /realtime/v1/* is proxied
   v
Kong 3.9.3 (DB-less) -- layer 2 (NEW): per-route allowlist; unmatched -> auth-v1-denied (403)
   |  key-auth + acl (anon, admin) on the keyed routes; auth-v1-verify open
   v
GoTrue v2.196.0 on auth:9999

hearth-service --direct--> auth:9999   (signup, token check, user PUT, admin, jwks): never via Kong
E2E seed (supabase-js-free fetch) --> Caddy --> Kong --> /auth/v1/admin/users (service key)
```

### Recommended Project Structure (additions only)
```
apps/web/src/components/chores/RotationEditor.test.tsx     # FIX-04 (new)
apps/web/src/screens/deals/deal-card.test.tsx              # FIX-01 (extend existing describe area)
apps/service/src/meal-plan.integration.test.ts             # FIX-02 (extend "add missing to list")
packages/shared/src/api/patch-schemas.test.ts              # FIX-03 (new)
test/eslint-service-role-fence.test.mjs                    # FIX-05 (new, root harness)
scripts/deploy.test.mjs                                    # FIX-06 (new, root harness)
test/kong-routes.test.mjs                                  # FIX-07 (new, root harness)
e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts        # FIX-07 (extend)
.planning/cleanup/FIX-LEDGER.md                            # D-12 red/green ledger (not in any PR)
```

Root `package.json:16` `test:harness` gains the three new files (a harness file not in this list never runs, and knip would then also flag `yaml` as unused):
`node --test test/clock-setup.test.mjs test/global-tz.test.mjs scripts/test-sweep.test.mjs test/eslint-clock-ban.test.mjs test/eslint-service-role-fence.test.mjs scripts/deploy.test.mjs test/kong-routes.test.mjs`

### Pattern 1: FIX-01 hold the id per (list, deal) until success

**What:** a `useRef` inside `useAddDealToList` that remembers the `{listId, dealId, id}` of the attempt in flight or last failed; `mutationFn` reuses it when the same pair is tapped again; `onSuccess` clears it.
**When to use:** only this hook; `AddToList.tsx` is untouched (it is the sole caller).
**Why keyed by list and deal:** the PK is `id` alone (`shopping_list_item.id uuid primary key`, `supabase/migrations/20260919070000_schema.sql:197`), so an id reused for a *different list* would be swallowed by `on conflict (id) do nothing` and the deal silently not added. The prototype has a test for this.

```ts
// Source: prototype, apps/web/src/lib/api/deals.ts (red/green verified)
const attempt = useRef<{ listId: string; dealId: string; id: string } | null>(null);
return useMutation({
  mutationFn: ({ listId, dealId }: AddDealToList) => {
    const held = attempt.current;
    const current =
      held?.listId === listId && held.dealId === dealId
        ? held
        : { listId, dealId, id: crypto.randomUUID() };
    attempt.current = current;
    return api.send({
      method: 'POST',
      path: `/api/lists/${listId}/items`,
      body: { source: 'from_deal', id: current.id, dealId },
    });
  },
  onSuccess: async () => {
    attempt.current = null;
    await queryClient.invalidateQueries({ queryKey: dealKeys.lists(householdId) });
  },
});
```

Test harness pattern (extends `describe('adding a deal to a list')` in `deal-card.test.tsx`, uses the existing `createFetchStub`/`renderScreen`): a stateful fake server keyed by id, whose `POST /api/lists/:id/items` handler records the row **then throws `new TypeError('Failed to fetch')` on the first call** (the stub's `fetch` rejects, `client.ts:54-58` turns that into `ApiError(0, undefined, true)`, `userMessage` shows `OFFLINE_MESSAGE`). Three cases: retry sends the same id and the server holds 1 row (**red on unfixed: `expected 'cface6af…' to be 'b8dc504e…'`**); after a success a new id is minted (2 rows; passes before and after, guards against over-fixing); a failed add to list A followed by an add to list B uses a different id (passes before and after; guards the list+deal key).

### Pattern 2: FIX-02 serialise per list

```ts
// Source: prototype, apps/service/src/services/add-to-list.ts (import { sql, type Kysely } from 'kysely')
const list = await requireList(db, listId);
const householdId = list.household_id;

// "Already on the list" is read before anything is written, so two overlapping calls for one
// list would each see an empty list and each add every ingredient. ... released when this
// request's transaction ends.
await sql`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`add-to-list:${listId}`}, 0))`.execute(
  db,
);
```

Same primitive and spelling as `recordListActivity` in `apps/service/src/services/list-activity.ts`. Lock order is consistent (add-to-list key first, then the `list-activity:<id>` key inside `recordListActivity`), so there is no deadlock; different lists never contend. All three entry points (recipe, planned meal, whole week) converge on this function, so one lock covers them.

Integration tests (extend `describe('add missing to list')` in `apps/service/src/meal-plan.integration.test.ts`, using the file's own `household`, `createList`, `createRecipe`, `allItems`, `itemNamed`, `as`): a nested `describe('when the same call arrives again')` with three tests. (1) sequential replay returns the same item ids (passes before and after, the "no leak" guard); (2) `Promise.all` of two identical POSTs leaves `['bread','butter','cheese']` (**red on unfixed: `expected ['bread','bread','butter',…(3)] to deeply equal ['bread','butter','cheese']`, 2 of 2 runs through the real HTTP path, 5 of 5 through the service function**); (3) a bought item is added again (characterization of the intended rule from `docs/use-cases.md`, passes before and after).

### Pattern 3: FIX-03 registry-driven wrapper scan

Discovery is `endpoints.filter((e) => e.method === 'PATCH')` from `./contract.js`. Today it yields exactly these 11 (path and body schema) [VERIFIED: ran against `packages/shared/src/api/contract.ts`; each is `method: 'PATCH'` at lines 158, 197, 252, 353, 395, 437, 505, 623, 665, 724, 783]:

| PATCH path | Body schema | `{}` today |
|------------|-------------|------------|
| `/api/users/me` | `updateProfileRequestSchema` | rejected (refine) |
| `/api/users/me/notification-preferences` | `updateNotificationPreferenceRequestSchema` (`type`, `enabled` required) | rejected |
| `/api/households/:id` | `updateHouseholdRequestSchema` | rejected |
| `/api/lists/:id` | `updateListRequestSchema` (`name` required, no refine) | rejected |
| `/api/lists/:id/items/:itemId` | `updateListItemRequestSchema` | rejected |
| `/api/pantry/:id` | `updatePantryItemRequestSchema` | rejected |
| `/api/recipes/:id` | `updateRecipeRequestSchema` | rejected |
| `/api/bills/:id` | `updateBillRequestSchema` | rejected |
| `/api/chores/:id` | `updateChoreRequestSchema` | rejected |
| `/api/bills/:id/payments/:paymentId` | `updateBillPaymentRequestSchema` | rejected |
| `/api/errands/:id` | `updateErrandRequestSchema` | rejected |

Why a wrapper scan and not only `{}`: for `updateList` and `updateNotificationPreference`, `{}` is rejected because a field is *required*, which would hide a newly added defaulted sibling. The scan walks `schema._zod.def.shape` (unwrapping a root `pipe` via `def.in`), follows `optional|nullable|nonoptional|readonly|default|prefault|catch|lazy` via `def.innerType` and `pipe` via `def.in`, and flags any field with `default`, `prefault` or `catch` in its chain. Observed Zod 4.6.5 behavior for the mutants: `.partial()` over a defaulted field injects (`{a:1}`), `optional().default()`, `default().optional()`, `nullable().default(null)` and `prefault` all inject; `catch` does not inject but silently replaces an invalid value, so it is flagged too. The schemas the CONTEXT discretion note worries about (`deals.ts` query schemas, `recipes.ts:115` `recipesQuerySchema`, `membership.ts:39` `reassignments ... .default({})`) are never PATCH bodies, so registry discovery never visits them; a test names `departRequestSchema.parse({})` staying `{ reassignments: {} }` already (`schemas.test.ts`).

Cross-check test: every export matching `/^update[A-Z]\w*RequestSchema$/` from `../index.js` must be the `body` of some PATCH endpoint (11 = 11 today), so a new update schema that is not wired into the contract fails.

Guard-the-guard: a `describe('the guard itself')` with eight mutant schemas that must each be flagged, one clean schema that must not, and `z.string()` as a body that must throw. Mutation-tested against the real code by restoring `autopay: billFieldsSchema.shape.autopay` (dropping the `.unwrap()`) in `updateBillRequestSchema`: `AssertionError: expected [ 'autopay' ] to deeply equal []` on `/api/bills/:id`.

### Pattern 4: FIX-04 restructure (verified lint-clean, no suppression)

```tsx
// Source: prototype, apps/web/src/components/chores/RotationEditor.tsx (eslint: 0 messages, jsx-a11y strict)
<li key={userId} data-member={userId} className="rounded-md border border-border bg-base">
  <div
    role="presentation"
    onDragOver={(event) => { event.preventDefault(); }}
    onDrop={handleDrop(index)}                       // handleDrop typed DragEvent<HTMLDivElement>
    className="flex min-h-11 items-center gap-2 px-2 py-1.5"
  >
    <button
      type="button"
      draggable={!isUnavailable}
      tabIndex={-1}
      aria-label={`Drag ${nameOf(userId)} to reorder`}
      onDragStart={() => { setDragIndex(index); }}
      onDragEnd={() => { setDragIndex(null); }}
      className="inline-flex min-h-11 min-w-11 shrink-0 cursor-grab items-center justify-center text-muted"
    >
      <GripVertical aria-hidden size={20} strokeWidth={1.5} />
    </button>
    {/* name span, then the three <Button data-member data-control ...> unchanged */}
  </div>
</li>
```

Rules this satisfies (all under `jsxA11y.flatConfigs.strict` as wired at `eslint.config.js`): the `<li>` carries no handlers, so `no-noninteractive-element-interactions` is silent; the `div` has `role="presentation"`, which `no-static-element-interactions` exempts; the draggable element is a native `button`. Also verified clean: a `span role="presentation" draggable` handle (variant A2, see A1). Notes: the drag handle is `tabIndex={-1}` so the Tab order stays Up, Down, Remove per row and no focusable control does nothing; `min-h-11 min-w-11` keeps the 44px target (project rule in `.claude/CLAUDE.md`, and E2E 17 runs axe); the `data-member`/`data-control` attributes and the `focusRequest` effect are unchanged, and the `[data-member="…"][data-control="…"]` selectors in the effect still resolve (the `<li>` keeps `data-member` but has no `data-control`).

Delete the eslint-disable comment block at `RotationEditor.tsx:129-132`. Then `.claude/CLAUDE.md` lines 199 and 236 (which say "`eslint-disable` appears only six times" and give the `RotationEditor` example) need updating to five and a different example; that file is not under `.planning/`, so it rides in the web PR.

Keyboard test approach (prototype `RotationEditor.test.tsx`, 7 tests): a small stateful `Harness` (the component is controlled), `render` from Testing Library with no providers (the editor needs none), `userEvent.setup()`. Cases: (1) seven `user.tab()` calls visit exactly `Move Alex Rivera down`, `Remove Alex Rivera from rotation`, `Move Sam Chen up`, `Move Sam Chen down`, `Remove Sam Chen from rotation`, `Move Jordan Blake up`, `Remove Jordan Blake from rotation`, an eighth leaves the editor (`document.body` has focus), and the two edge buttons are `toBeDisabled()`; (2) Enter on `Move Sam Chen down` reorders and focus lands on `Move Sam Chen up` (he is last, so "down" is disabled and the effect falls back to the row's other move button); (3) Space does the same on Jordan; (4) Enter on `Remove Sam Chen from rotation` removes him and focus lands on `Remove Jordan Blake from rotation`; (5) removing the last member focuses the `Rotation order` heading; (6) with `disabledReason`, every Move/Remove button is disabled and Tab+Enter calls `onChange` zero times; (7) pointer path: `fireEvent.dragStart` on the handle, `dragOver` and `drop` on `screen.getByText('3. Jordan Blake').closest('[role="presentation"]')` calls `onChange([SAM, JORDAN, ALEX])`, and the `<li>` has no `draggable` attribute. jsdom runs the existing `focusRequest` effect correctly (`target.focus()` works on real buttons), so no mock is needed. `e2e/tests/15-chores-and-errands.spec.ts:124-131` already drives the same buttons by keyboard in a real browser, so CI is the positive-flow check.

### Pattern 5: FIX-05 root-harness probe (ESLint Node API)

Copy `test/eslint-clock-ban.test.mjs`'s setup exactly: `new ESLint({ cwd: REPO_ROOT, overrideConfig: tseslint.config(tseslint.configs.disableTypeChecked) })` (virtual files are not in any tsconfig, so the type-aware project service must be off), `lintText(code, { filePath })`, fail on `message.fatal`, and **filter by rule id** (`@typescript-eslint/no-restricted-imports`, `no-restricted-syntax`) because probes also raise `no-unused-vars`. The fence is `eslint.config.js:100-130`: files `apps/service/src/**/*.ts`, ignoring `main.ts`, `cli.ts`, `privileged/**`, `**/*.test.ts`, `test/**`; rule `'@typescript-eslint/no-restricted-imports'` with `group: ['**/privileged/*']`, `allowTypeImports: true`; plus `no-restricted-syntax` with `selector: 'ImportExpression > Literal[value=/privileged/]'`. Cost: the 28-probe file runs in about 1.5 s. Assert severity `2`, not just presence, so a downgrade to `warn` fails.

Probe results observed (so the test can state them as fact):
- Reported: value import, namespace import, side-effect import, `export { } from`, `export * from`, a mixed `import { type X, y }`, `await import('…/privileged/…')`, and `void import('…').then(…)`.
- Not reported (allowed by design): `import type { SystemHealthRow } from '…/privileged/service-role-db.js'` and `import { type SystemHealthRow } …` (that is exactly what `http/context.ts:9` does).
- Exempt paths: `main.ts`, `cli.ts`, anything under `privileged/` (any depth), `*.test.ts`, `*.integration.test.ts`, `apps/service/src/test/**`.
- **Known gaps, record them in the test header and `docs/testing.md`, do not widen the fence (CONTEXT: no widening without a finding):** `import(variable)`, `` import(`../privileged/${x}`) ``, `require`, a raw `` sql`set local role service_role` ``, and any code outside `apps/service/src`.

Mutation proof against the test (edit `eslint.config.js` in a scratch worktree, run the probe file): fence `error`→`warn`: 7 of 28 fail; `routes/**` added to the ignores: 10 fail; the `ImportExpression` selector neutralized: 2 fail; the block's `files` pointed elsewhere: 17 fail; unmodified: 0 fail.

### Pattern 6: FIX-06 stubbed-argv run of the real script

```bash
# Source: prototype scripts/deploy.sh (replaces the supabase command at lines 95-97)
PGPASSWORD="$(env_value POSTGRES_PASSWORD)" supabase migration up --workdir "$repo_root" \
  --db-url "postgresql://postgres@${db_ip}:5432/postgres?sslmode=disable" ||
  fail "migration failed; nothing restarted (the backup above is the restore point)"
```

A prefix assignment scopes the variable to that one process; the next `docker compose exec` sees `PGPASSWORD=<unset>` (asserted). Current exposure, quoted: `deploy.sh:95-96`: `supabase migration up --workdir "$repo_root" \` / `--db-url "postgresql://postgres:$(env_value POSTGRES_PASSWORD)@${db_ip}:5432/postgres?sslmode=disable" ||`.

What `deploy.sh` needs to run to the end under stubs (verified by running it): only `docker`, `supabase` and `curl` stubs first on `PATH`; `HEARTH_ENV_FILE` pointing at a fake env file; `HEARTH_DEPLOY_SHA` set (which skips the `git rev-parse` at line 18, so no `git` stub is needed); `cwd` the real repo (the script `cd`s to its own repo root and reads `docker/db/hearth-service-login.sql`). The stub is one bash script symlinked as the three names; it appends `name<TAB>arg...` and `ENV<TAB>name<TAB>PGPASSWORD=<value or <unset>>` to `$STUB_LOG` and answers three queries: `docker image inspect --format {{.Id}} …` → an id, `docker … ps --quiet db` → a container name, `docker inspect --format …` → `172.16.238.5`. Spawn with `spawnSync('bash', [DEPLOY])` (not the executable bit), and delete an inherited `PGPASSWORD` from the child env. Six assertions: exit 0 and a `supabase migration up` call was logged (so a pass cannot be vacuous); the sentinel is in no argv; the script's stdout/stderr never print it; only the `supabase` stub saw `PGPASSWORD=<sentinel>`; the `--db-url` parses with `username === 'postgres'`, empty password, host `172.16.238.5:5432`; and a password `p@ss/w:rd#1?x%y` arrives intact. **Red on the current script: 4 of 6 fail; green after the one-line change: 6 of 6.**

### Pattern 7: FIX-07 Kong allowlist (verified)

Constraints discovered by running Kong 3.9.3:
- Per-route services: under `strip_path: true` the matched path is removed entirely, so a route on `/auth/v1/token` needs a service whose `url` is `http://auth:9999/token` (the existing `auth-v1-open` already works this way). The old catch-all works only because its service url is `http://auth:9999/` and the remainder is appended.
- Exact regex paths (`~/auth/v1/token/?$`) beat the prefix refusing route `/auth/v1` and routes with `methods` only match their methods; a wrong method falls through to the refusal. Kong normalizes the path before matching (`/auth/v1/./token`, `//auth/v1/token`, `%74oken` all reach the allowed `token` route as `/token`; `/auth/v1/x/../signup` and `%73ignup` reach the refusal).
- **`_format_version: '2.1'` rejects every regex path** with `should start with: / (fixed path) or ~/ (regex path)` (Kong rewrites regex-looking paths for 2.x files and breaks the `~`); `'3.0'` loads them. This was tested on the whole file; the four `realtime-v1-*` routes behave identically (status-for-status comparison, 39 probes).
- `request-termination` is already in `KONG_PLUGINS: key-auth,acl,request-termination` (`docker/docker-compose.yml:165`).

```yaml
# Source: prototype docker/kong.yml (GoTrue half; realtime services unchanged below it)
_format_version: '3.0'
_transform: true
# consumers: / acls: unchanged

services:
  - name: auth-v1-verify            # email links (no apikey) and verifyOtp
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-verify
        strip_path: true
        methods: [GET, POST]        # written one per line in the file
        paths: [~/auth/v1/verify/?$]
  - name: auth-v1-token             # signInWithPassword, refreshSession, auto refresh
    url: http://auth:9999/token     # methods: POST, paths: ~/auth/v1/token/?$
    # plugins: key-auth {hide_credentials: false}; acl {hide_groups_header: true, allow: [admin, anon]}
  - name: auth-v1-logout            # signOut (any scope); url .../logout; POST; ~/auth/v1/logout/?$
  - name: auth-v1-user              # setSession and URL-fragment sign-in; url .../user; GET; ~/auth/v1/user/?$
  - name: auth-v1-otp               # signInWithOtp (magic-link build only); url .../otp; POST; ~/auth/v1/otp/?$
  - name: auth-v1-admin-users       # E2E seed; url .../admin/users; GET, POST; ~/auth/v1/admin/users/?$
    # plugins: key-auth; acl allow: [admin]   (service-role key only)
  - name: auth-v1-denied            # everything else under /auth/v1
    url: http://auth:9999/
    routes: [{ name: auth-v1-denied, strip_path: true, paths: [/auth/v1] }]
    plugins:
      - name: request-termination
        config: { status_code: 403, message: Access is forbidden. }
```
The complete file (with comments, one YAML line per item as Kong's loader and Prettier expect) is in the prototype patch; copy it from there. Delete `auth-v1-open` and `auth-v1-all`.

The browser's GoTrue calls, enumerated from `@supabase/auth-js@2.116.0` `GoTrueClient.ts`/`GoTrueAdminApi.ts` and `apps/web/src/lib/auth/auth-client.ts` [VERIFIED: read the source this session]:

| App call (auth-client.ts) | HTTP | Source line |
|---------------------------|------|-------------|
| `signInWithPassword` (:129) | `POST /token?grant_type=password` | `GoTrueClient.ts:1246` |
| `refreshSession` (:116), auto refresh, `_recoverAndRefresh` | `POST /token?grant_type=refresh_token` | `:4788` |
| `signOut()` (:178) and `signOut({scope:'local'})` (:124) | `POST /logout?scope=…` (the admin API call, for every scope) | `GoTrueAdminApi.ts:153` |
| `setSession` (:169, after `/api/signup`) when the access token has not expired | `GET /user` | `GoTrueClient.ts:3644` via `_getUser` (:3245-3249) |
| `detectSessionInUrl` implicit flow (recovery link lands with a fragment) | `GET /user` | `:3958` |
| `signInWithOtp` (:139) | `POST /otp` | `:2319` |
| `verifyOtp` (:152) | `POST /verify` | `:2490` |
| the recovery/invite/confirmation email link | `GET /verify?token=…` (browser navigation, no apikey) | `docker-compose.yml` `GOTRUE_MAILER_URLPATHS_*: /auth/v1/verify` |

Calls the app never makes (and which Kong now refuses): `signUp` (`/signup`, handled by `/api/signup`), `resetPasswordForEmail` (`/recover`), `updateUser` (`PUT /user`), `getClaims`/JWKS (`/.well-known/jwks.json`; the service fetches JWKS directly from `GOTRUE_URL`, `docker-compose.yml:205` `GOTRUE_URL: http://auth:9999`), `/settings`, `/health`, `/authorize`, `/invite`, `/admin/generate_link` (the `hearth-admin` CLI reaches it directly on `auth:9999`).

Real-flow proof (not just status codes): Kong 3.9.3 in front of real GoTrue v2.196.0, driven by real `@supabase/supabase-js@2.116.0` with the candidate and with the current file. With the **candidate**: admin create and list users with the service key 200/200; admin list with the anon key 403; `signInWithPassword`, `refreshSession`, `setSession` (fresh token), `getUser`, `signOut({scope:'local'})` and `signOut()` all `ok`; `GET /verify` for a real recovery link (minted by `POST /admin/generate_link` straight on GoTrue, as the CLI does) returns `303` to the app origin with `#access_token=…`; `signUp`, `resetPasswordForEmail` and `updateUser` return 403. With the **current** file the same three "not used" calls succeed (`ok`), which is the red. A 39-request matrix confirmed everything else (token without key 401, bad key 401, realtime routes) is status-for-status identical except the intended 200→403 changes.

Static test (`test/kong-routes.test.mjs`, 32 tests, green on the candidate, **13 red on the current file**): parse with `yaml`; assert `_format_version === '3.0'`; flatten services to routes; select those whose paths start `/auth/v1` or `~/auth/v1`; deep-equal `[name, upstream, methods, path, plugins]` against the exact seven-row table; assert each non-refusing route has methods, an exact `~…$` path, `strip_path`, and an upstream with a path; `key-auth` present on all but `auth-v1-verify` and the refusing route; the `admin/users` ACL is exactly `['admin']`; the four `realtime-v1-*` routes unchanged; every plugin used is in the Compose `KONG_PLUGINS` env; and a small `decide(method, path)` model of Kong's precedence that maps the table of browser calls above to their routes and a table of refused calls (`POST /signup`, `PUT /user`, `POST /recover`, `GET /token`, `DELETE /logout`, `POST /user`, `GET /auth/v1`, …) to the refusing route. The model is for the test only; the E2E probes are the proof against the real router.

E2E additions (to `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts`, which already imports `rawRequest` and `readStackEnv`): (1) for 17 refused method/path/spelling combinations, with and without the anon `apikey`, expect `403` **and** a body containing `Access is forbidden.` (Kong's `request-termination` body; it distinguishes Kong from Caddy's empty 403 and from GoTrue's own answers); (2) the calls the app makes are not refused: `POST /auth/v1/token?grant_type=password` with the key and no body → 400; `GET /auth/v1/user` with the key → 401; `POST …/logout?scope=local`, the refresh grant and `GET …/verify?token=nope&type=recovery` (no key) return something that is not Kong's refusal body; `GET /auth/v1/admin/users` with only the anon key → 403 whose body is the ACL's, not the refusal. Simulated against the candidate and the current Kong with real GoTrue: current file 0 of 34 combinations refused (red), candidate 34 of 34 (green). Which spellings Caddy forwards to Kong untouched (e.g. `//auth/v1/recover`) could not be checked without the Caddy image; drop any spelling that CI shows Caddy answers itself.

### Anti-Patterns to Avoid
- **Writing the Kong list as prefixes:** `/auth/v1/token` is a string prefix in Kong and also matches `/auth/v1/tokenfoo`.
- **Leaving `_format_version: '2.1'` with `~` paths:** Kong refuses to start (config load error), so Kong is down and sign-in with it. Pre-flight with `docker run --rm -v /tmp/rendered.yml:/t.yml:ro -e KONG_DATABASE=off kong/kong:3.9.3 kong config parse /t.yml`, where `/tmp/rendered.yml` is `docker/kong.yml` with the two `$SUPABASE_*` placeholders substituted the way `docker/kong-entrypoint.sh` does (the config parse was run on rendered files only).
- **Asserting `{}` parses to `{}` for PATCH schemas:** false for all eleven.
- **A `userEvent` keyboard test on the RotationEditor that clicks:** the point is Tab/Enter/Space only.
- **Restructuring `deploy.sh` for testability:** D-10 forbids it and the stub run needs no restructuring.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing `docker/kong.yml` | A regex or line parser | `yaml` (`parse`) | The file uses lists, nested plugin config and comments; a hand parser would not fail loudly on a malformed route |
| Discovering PATCH schemas | A grep over `routes/*.ts` for `app.patch` | The `endpoints` array exported by `@hearth/shared` | It is what the service validates with and builds OpenAPI from; `routes.test.ts` already asserts every endpoint is a registered route |
| Proving the lint fence | Shelling out to `eslint` on temp files | `ESLint#lintText` with `disableTypeChecked` (the clock-ban precedent) | No temp files, 28 probes in ~1.5 s, rule ids and severities are inspectable |
| Observing argv/env of `deploy.sh` | Parsing `ps` or `set -x` output | Stub binaries that log `"$@"` and `${PGPASSWORD-<unset>}` | Deterministic, no race with process lifetime |
| Serialising concurrent adds | A new table, column or unique index | `pg_advisory_xact_lock` as `recordListActivity` does | D-04 forbids a migration; the lock is transaction-scoped, so nothing needs cleanup |
| Time in tests | `new Date()` / `Date.now()` | Not needed: none of the seven tests reads the clock | `eslint.config.js` bans bare reads in test files (`docs/testing.md`) |

**Key insight:** every guard in this phase is an existing mechanism pointed at a new target (the `endpoints` registry, the ESLint API pattern, the sweep-test spawn pattern, the advisory-lock pattern); the research found no case that needs a new mechanism.

## Common Pitfalls

### Pitfall 1: Kong 3.0 format version
**What goes wrong:** the container exits at start with `error parsing declarative config file ... should start with: / (fixed path) or ~/ (regex path)` for every regex route; Kong is down in production and sign-in fails.
**Why it happens:** under `_format_version: '2.1'` Kong rewrites regex-looking paths; a leading `~` is then rejected.
**How to avoid:** `'3.0'`, asserted by the static test; run `kong config parse` once locally.
**Warning signs:** `docker compose logs kong` shows the traceback from `kong/init.lua:731`.

### Pitfall 2: Merging the Kong change does not apply it
**What goes wrong:** the PR is green, merged, deployed, and production Kong still runs the old config.
**Why it happens:** `scripts/deploy.sh` starts Kong with `--no-recreate`, and Compose leaves a running service alone when only a bind-mounted file changed (verified: plain `up -d` printed `Running`; `--force-recreate` picked up the new content). `docs/deploy.md:165` says a deploy never recreates `kong`.
**How to avoid:** put the exact host step in PR 3's description and in `docs/deploy.md` ("after merging a change to `docker/kong.yml`: back up, then `hearth-compose up -d --force-recreate kong`"); expect a few seconds of failed sign-ins during it. The owner decides when. A rollback is revert, then the same recreate.

### Pitfall 3: The E2E seed needs `admin/users` through Kong
**What goes wrong:** with a pure allowlist the E2E stack fails at the seeding step (`creating … failed: 403`), failing every journey.
**Why it happens:** `e2e/setup/stack.ts:150-154` seeds with `HEARTH_SEED_AUTH_URL: ${BASE_URL}/auth/v1` and the service-role key.
**How to avoid:** keep `auth-v1-admin-users` (GET, POST, ACL `admin`). The alternative (publish `auth:9999` in `e2e/docker-compose.e2e.yml`, allocate a port in `run-identity.ts`, repoint the seed) is a larger change to the E2E hot path; see Open Question 2.

### Pitfall 4: A held id leaks across lists
**What goes wrong:** a failed add to list A, then a deliberate add to list B, sends the same id and the server's `on conflict (id) do nothing` swallows the second add; the toast says "Added".
**How to avoid:** key the held attempt by list and deal (Pattern 1); the third deal-card test guards it.

### Pitfall 5: `cancel-in-progress` eats the red CI run
**What goes wrong:** D-12 wants the Kong probes' red from CI, but pushing the fix commit cancels the still-running first run (`ci.yml`: `group: ci-${{ github.ref }}`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`), so no red run is recorded.
**How to avoid:** push the probes-only commit, wait for its `test-e2e` to finish red, record the run link, then push the Kong change. `test-e2e` also flakes on `toomanyrequests` image pulls (STATE.md): confirm a red is the probe assertion, not the pull.

### Pitfall 6: ESLint API probes on virtual files
**What goes wrong:** `lintText` with a virtual path fails with a project-service error, or probes report unrelated rules.
**How to avoid:** `overrideConfig: tseslint.config(tseslint.configs.disableTypeChecked)` and filter messages by `ruleId`; assert `severity === 2`.

### Pitfall 7: The deploy stub test passing vacuously
**What goes wrong:** the script aborts early (missing stub), nothing is logged, "sentinel in no argv" passes.
**How to avoid:** assert exit 0 and that a `supabase migration up` line was logged; delete the parent's `PGPASSWORD` from the child env.

### Pitfall 8: Harness tests silently not running
**What goes wrong:** a new `.test.mjs` is written but not added to `package.json:16`; `pnpm test` and CI never run it, and knip flags `yaml` as unused.
**How to avoid:** add all three paths to `test:harness`; the prototype patch does (apart from the `yaml` line).

### Pitfall 9: Docs and project-instruction counts go stale
**What goes wrong:** `docs/testing.md` says "six `node --test` files" (lines 9, 45), "the other four are the harness tests" (30-31), "only the four harness tests" (51), and lists the harness tests (133-150); `.claude/CLAUDE.md:199,236` still describe the `RotationEditor` suppression; `docs/deploy.md:74-77` describes Kong without the allowlist or the recreate step.
**How to avoid:** update in the PR that changes the behavior; those are the only places that need edits (checked by grep).

### Pitfall 10: Firefox cannot start a drag from a `<button>`
See Assumptions A1. Mitigation is already in the spec: Up/Down are the non-gesture alternative. Adding `dataTransfer.setData(...)` in `onDragStart` is also needed for Firefox to start any drag; the current code never called it, so this is not a regression, and "no new interaction" (D-06) argues for leaving it.

## Code Examples

The full, runnable versions are in `04-prototype.patch`. Load-bearing fragments:

### FIX-05 probe skeleton
```js
// Source: prototype test/eslint-service-role-fence.test.mjs (28 tests, ~1.5 s)
const eslint = new ESLint({ cwd: REPO_ROOT, overrideConfig: tseslint.config(tseslint.configs.disableTypeChecked) });
const FENCE_RULES = new Set(['@typescript-eslint/no-restricted-imports', 'no-restricted-syntax']);
async function fenceMessages(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.deepEqual(result.messages.filter((m) => m.fatal), []);
  return result.messages.filter((m) => FENCE_RULES.has(m.ruleId));
}
// BAD: "import { withServiceRoleDb } from '../privileged/service-role-db.js';" ... at apps/service/src/routes/probe.ts
// GOOD: "import type { SystemHealthRow } from '../privileged/service-role-db.js';"
// fenced paths: routes/users.ts, http/context.ts, services/lists.ts, jobs/scheduler.ts, db/user-db.ts, app.ts, env.ts, push/test-seam.ts
// exempt: main.ts, cli.ts, privileged/probe.ts, privileged/nested/probe.ts, routes/probe.test.ts, probe.integration.test.ts, test/probe.ts
```

### FIX-03 core
```ts
// Source: prototype packages/shared/src/api/patch-schemas.test.ts
const DEFAULTING = new Set(['default', 'prefault', 'catch']);
const WRAPPERS = new Set(['optional', 'nullable', 'nonoptional', 'readonly', ...DEFAULTING]);
// objectShape(schema): unwrap a root 'pipe' via def.in, require def.type === 'object', return def.shape
// defaultingFields(schema): entries of the shape whose chain (innerType / pipe.in) hits DEFAULTING
it.each(patchEndpoints.map((e) => [e.path, e.body] as const))('%s injects no default for a field left out', (_p, body) => {
  expect(defaultingFields(body)).toEqual([]);
  const parsed = body.safeParse({});
  expect(parsed.success ? Object.keys(parsed.data) : []).toEqual([]);
});
```

### Red-first worktree recipe for the ledger (D-12)
```bash
git worktree add --detach /tmp/wt-fix HEAD            # the parent commit
for d in . apps/web apps/service packages/shared packages/matching packages/recurrence e2e supabase/seed; do
  ln -s "$PWD/$d/node_modules" "/tmp/wt-fix/$d/node_modules"; done
# copy ONLY the new test files in, run them (expect red), then copy the fix in and re-run (expect green)
cd /tmp/wt-fix/apps/web && "$OLDPWD/apps/web/node_modules/.bin/vitest" run src/screens/deals/deal-card.test.tsx
git worktree remove --force /tmp/wt-fix && git worktree prune
```
Verified: vitest, tsc and ESLint all run correctly from a worktree whose `node_modules` are symlinks. Expected red/green outcomes for the ledger:

| Fix | Command | Unfixed | Fixed |
|-----|---------|---------|-------|
| FIX-01 | `vitest run src/screens/deals/deal-card.test.tsx` (web) | 1 failed: `expected 'cface6af-…' to be 'b8dc504e-…'` (15 pass) | 16 pass |
| FIX-02 | `vitest run --config vitest.integration.config.ts src/meal-plan.integration.test.ts -t "when the same call arrives again"` (service, needs the stack) | `two calls in flight…` fails: `expected ['bread','bread','butter',…] to deeply equal ['bread','butter','cheese']`; the other two pass | 3 pass |
| FIX-03 | `vitest run src/api/patch-schemas.test.ts` (shared) | passes (no schema defaults today); red only by mutation: drop `.unwrap()` on `autopay` → `expected [ 'autopay' ] to deeply equal []` | 23 pass |
| FIX-04 | lint with the suppression line removed; `vitest run src/components/chores/RotationEditor.test.tsx` | lint: 1 error `jsx-a11y/no-noninteractive-element-interactions` at the `<li>`; test: handle test fails (6 pass) | lint 0; 7 pass |
| FIX-05 | `node --test test/eslint-service-role-fence.test.mjs` | passes on the real config (28); red by config mutation (7/10/2/17 failures) | 28 pass |
| FIX-06 | `node --test scripts/deploy.test.mjs` | 4 of 6 fail (sentinel in `--db-url`) | 6 pass |
| FIX-07 static | `node --test test/kong-routes.test.mjs` | 13 of 32 fail on the current `kong.yml` | 32 pass |
| FIX-07 E2E | `pnpm test:e2e` (CI) | probes red on the current Kong (0 of 34 refused in simulation) | green |

Honest note for the ledger: FIX-03, FIX-05 and the keyboard half of FIX-04 are *guards* for properties that already hold (no bug exists to fail against); their red evidence is the lint-with-suppression or the config/schema mutation, recorded as such. FIX-01, FIX-02 (overlap), FIX-06 and FIX-07 have genuine red-on-unfixed runs.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Kong declarative `_format_version: '2.1'` with auto-detected regex paths | `'3.0'` with explicit `~` regex paths | Kong 3.0 [CITED: Kong declarative-config format, observed behavior on 3.9.3] | The allowlist's exact paths need `'3.0'` |
| Zod 3 `schema._def.typeName` | Zod 4 `schema._zod.def.type` strings | Zod 4 [CITED: zod.dev/packages/core] | The PATCH scan uses `_zod.def` |
| supabase-js reading the session with `getSession` only | `setSession` and URL sign-in verify with `GET /user` | auth-js 2.x (read in 2.116.0 source) | `GET /auth/v1/user` must stay open or signup/recovery sign-in breaks |

**Deprecated/outdated:** none relevant; no dependency upgrades are in scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firefox does not fire `dragstart` for `<button>` (Mozilla bug 568313; duplicates 1967645) and needs `dataTransfer.setData` to start any drag. Source: web search results only, status of 568313 not confirmed. `[CITED: bugzilla.mozilla.org/show_bug.cgi?id=568313 via search summary]` | Pattern 4, Pitfall 10 | Pointer drag does nothing in Firefox desktop (it likely already fails there today because `onDragStart` never calls `setData`). Up/Down buttons still work. If the owner wants drag in Firefox: use the verified-lint-clean `span role="presentation" draggable` handle (variant A2) plus `setData`. Needs a one-line owner confirmation |
| A2 | The owner accepts keeping `GET`/`POST /auth/v1/admin/users` (admin ACL) in Kong for the E2E seed, instead of re-plumbing the seed to reach GoTrue directly. `[ASSUMED]` (a design call, evidence is `e2e/setup/stack.ts:150-154` and `seed-users.ts:55,89`) | FIX-07, Open Question 2 | If the owner wants admin fully denied in Kong, PR 3 grows by an E2E-overlay port publish, `run-identity.ts` port allocation and a seed URL change |
| A3 | The owner accepts a server change for FIX-02 (an advisory lock, no migration, no contract change). D-04 allows "fix that case only"; the lock is that case. `[ASSUMED]` that the overlap case counts as the "real leak" the owner meant | FIX-02 | If not accepted, FIX-02 reduces to the guard tests and success criterion 1 has no fails-before test for recipes |
| A4 | Caddy forwards the odd-spelling probes (`//auth/v1/recover`, `/auth/v1/x/../recover`, `%72ecover`, trailing slash, query string) to Kong in a form Kong refuses. Kong was tested directly; Caddy was not runnable here. `[ASSUMED]` | FIX-07 E2E | One or two spellings may be answered by Caddy (SPA fallback) in CI; trim them from the list |
| A5 | The magic-link build flag may be turned on later, so `POST /auth/v1/otp` stays routable even though the shipped build has the flag off (`HEARTH_MAGIC_LINK_ENABLED` default false). `[ASSUMED]` from D-07's own list of calls | FIX-07 | If the owner prefers it denied until the flag is used, delete one service and its table row (the static test will say which) |
| A6 | CI's `ubuntu-latest` and the self-hosted runner have `bash`, `sed`, `tail`, `date` and `sleep` on `PATH` for the deploy stub test (the script already requires them). `[ASSUMED]` for the hosted runner; the local run was on Linux | FIX-06 | Test fails in CI for an environmental reason; fix by pointing the stub PATH at the system dirs |
| A7 | Production's `POSTGRES_PASSWORD` is the generated `hex(24)` (`scripts/generate-secrets.sh:59`), so the old URL form worked; the new form is correct for any password. `[VERIFIED: generate-secrets.sh:59 `POSTGRES_PASSWORD: hex(24)`]` | FIX-06 | none |

## Open Questions

1. **Does the owner accept the FIX-02 lock?**
   - What we know: overlap duplicates are real (5 of 5 unfixed runs) and the lock fixes them (3 of 3, and the HTTP-level test); sequential replay and bought-item re-add are fine.
   - What's unclear: whether the owner counts overlap as "the lost-response leak" or as out of scope.
   - Recommendation: implement it; it is the only way the recipe half of success criterion 1 gets a test that fails before the fix.

2. **Keep `admin/users` in Kong, or re-plumb the E2E seed?**
   - What we know: the seed needs it today; keeping it narrows the old catch-all to two methods on one path and the service-role key only (anon gets the ACL's 403, verified).
   - What's unclear: whether "denies the unused GoTrue paths" in the owner's mind includes admin.
   - Recommendation: keep it in this phase; note the alternative in the PR.

3. **Should `deploy.sh` recreate Kong when `kong.yml` changed?**
   - What we know: it never does, and D-10 says do not restructure `deploy.sh`.
   - Recommendation: document the manual step (Pitfall 2) and leave the script alone; raise automatic recreate as a Phase 6 idea.

4. **Firefox pointer drag (A1).** Recommendation: keep the button handle as D-05 locks; mention the caveat in the PR description.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all tests | ✓ | v24.21.0 | — |
| pnpm | install, scripts | ✓ | 10.34.5 | — |
| Installed `node_modules` | all tests | ✓ | (workspace install present) | — |
| supabase CLI | FIX-06 verification, integration stack | ✓ | 2.117.0 at `/usr/local/bin/supabase` | — |
| psql | seed, scratch DB | ✓ | present | — |
| Docker CLI | Kong/GoTrue/Postgres experiments | ✓ client only | 29.8.2; the daemon is not running by default (`Cannot connect to the Docker daemon`) | A private daemon works as root: `dockerd --storage-driver=vfs --iptables=false --bridge=none -H unix:///tmp/X.sock --data-root /tmp/X-data --exec-root /tmp/X-exec`, then `DOCKER_HOST=unix:///tmp/X.sock`. Container networks, host networking, pulls from Docker Hub and ghcr.io all worked; `vfs` copies every layer, so budget disk |
| Image pulls through the agent proxy | Docker Hub and ghcr.io | ✓ (`kong/kong:3.9.3`, `postgres:17-alpine`, `ghcr.io/supabase/gotrue:v2.196.0` pulled); `supabase start` pulled its Kong 2.8.1 and GoTrue images, then its `supabase/postgres:17.6.1.167` pull failed with `no space left on device` at 17 GB of vfs data with 7 GB free | — | Use `postgres:17-alpine` + the repo migrations + GoTrue instead of `supabase start` |
| Local Postgres + GoTrue stack for service integration tests | FIX-02 red/green | ✓ via the lightweight recipe | postgres 17-alpine, GoTrue v2.196.0 | PR CI `test-integration` |
| Playwright + full Compose stack | FIX-07 E2E | ✗ not run here (needs the Caddy, service and Kong builds) | — | PR CI `test-e2e` (red/green per D-12) |
| `shellcheck` | optional lint of `deploy.sh` | ✗ | — | `bash -n scripts/deploy.sh` (passes on the prototype) |

Lightweight integration recipe that ran the repo's real `meal-plan.integration.test.ts` locally (15 pass before the new tests): one `postgres:17-alpine` container with password auth enforced on a non-loopback address; roles `anon`, `authenticated`, `service_role` (bypassrls), `supabase_auth_admin`; database with `create schema extensions; create extension pgcrypto schema extensions;`, `create schema auth authorization supabase_auth_admin`, `create publication supabase_realtime`; start GoTrue (`GOTRUE_DB_DATABASE_URL=…?search_path=auth`, `GOTRUE_DB_NAMESPACE=auth`, `GOTRUE_MAILER_AUTOCONFIRM=true`, a ≥32-char `GOTRUE_JWT_SECRET`) so it creates `auth.users`; apply the eight `supabase/migrations/*.sql` with `psql -v ON_ERROR_STOP=1`; mint HS256 `anon` and `service_role` JWTs with that secret; run vitest with `HEARTH_TEST_DATABASE_URL`, `HEARTH_TEST_GOTRUE_URL=http://127.0.0.1:9999`, `HEARTH_TEST_ANON_KEY`, `HEARTH_TEST_SERVICE_ROLE_KEY`, `HEARTH_TEST_JWT_SECRET` (the names `apps/service/src/test/service-stack.ts` reads). Nothing was committed from this setup.

**Missing dependencies with no fallback:** none for planning; the Kong E2E probes can only be green/red in CI.
**Missing dependencies with fallback:** Docker daemon (private daemon), full Supabase stack (lightweight recipe or CI).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 (web, shared, service); `node --test` (root harness, `e2e/support`); Playwright 1.63.0 (E2E) |
| Config file | `apps/web/vitest.config.ts` (jsdom), `packages/shared/vitest.config.ts`, `apps/service/vitest.config.ts` + `vitest.integration.config.ts`; root harness has none (`package.json:16`) |
| Quick run command | `pnpm --filter @hearth/web exec vitest run src/screens/deals/deal-card.test.tsx src/components/chores/RotationEditor.test.tsx && pnpm --filter @hearth/shared exec vitest run src/api/patch-schemas.test.ts && node --test test/eslint-service-role-fence.test.mjs scripts/deploy.test.mjs test/kong-routes.test.mjs` |
| Full suite command | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` (CI `test-unit` runs `pnpm test`, which runs `test:harness` first); plus CI `test-integration` and `test-e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | A retry after a lost response sends the same id; success mints a new id; a different list gets a different id | component (jsdom) | `pnpm --filter @hearth/web exec vitest run src/screens/deals/deal-card.test.tsx` | ✅ extend (Wave 0: add describe) |
| FIX-02 | Replay is a no-op; two overlapping calls add once; a bought item is re-added | integration (Postgres + GoTrue) | `pnpm --filter @hearth/service exec vitest run --config vitest.integration.config.ts src/meal-plan.integration.test.ts` | ✅ extend |
| FIX-03 | No PATCH body defaults/prefaults/catches a field; every `update*RequestSchema` is a PATCH body; the guard flags eight mutants | unit | `pnpm --filter @hearth/shared exec vitest run src/api/patch-schemas.test.ts` | ❌ Wave 0 |
| FIX-04 | Rotation editor operable by keyboard alone; edge buttons disabled; focus follows; drag handle reorders; no `eslint-disable` | component + lint | `pnpm --filter @hearth/web exec vitest run src/components/chores/RotationEditor.test.tsx` and `pnpm lint` | ❌ Wave 0 |
| FIX-05 | Fence reports value/dynamic privileged imports in the service tree, allows type imports and the sanctioned files | harness (`node --test`) | `node --test test/eslint-service-role-fence.test.mjs` | ❌ Wave 0 |
| FIX-06 | No argv of any command `deploy.sh` runs holds the password; it reaches only the migration command via `PGPASSWORD` | harness (`node --test`, real script, stubs) | `node --test scripts/deploy.test.mjs` | ❌ Wave 0 |
| FIX-07 (static) | Exact Kong allowlist table, methods, ACLs, refusal route, realtime untouched | harness (`node --test`) | `node --test test/kong-routes.test.mjs` | ❌ Wave 0 (needs `yaml`) |
| FIX-07 (live) | Refused paths/methods answer Kong's 403 body; sign-in, refresh, sign-out, reset-password flows still pass | E2E (Playwright, Compose) | `pnpm test:e2e` (or `HEARTH_E2E_REUSE_STACK=1 pnpm --filter @hearth/e2e exec playwright test tests/08-caddy-refuses-gotrue-endpoints.spec.ts`) | ✅ extend; positive flows: `01-signup-and-first-household`, `06-owner-reset-password`, `15-chores-and-errands` (rotation keyboard), 08's own sign-in check |

### Sampling Rate
- **Per task commit:** the quick run command for the files that task touched (each runs in seconds: web ~5 s, shared <1 s, harness ~2 s).
- **Per wave merge:** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.
- **Phase gate:** the above plus green `test-integration` and `test-e2e` on each PR before `/gsd-verify-work`; Kong probes' red and green recorded from the two CI runs.

### Wave 0 Gaps
- [ ] `pnpm add -D -w yaml@2.9.1` (after a `checkpoint:human-verify`; see Package Legitimacy Audit), commit `package.json` + `pnpm-lock.yaml` together
- [ ] Append the three new files to `test:harness` in root `package.json:16`
- [ ] `packages/shared/src/api/patch-schemas.test.ts`, `apps/web/src/components/chores/RotationEditor.test.tsx`, `test/eslint-service-role-fence.test.mjs`, `scripts/deploy.test.mjs`, `test/kong-routes.test.mjs` (all in the prototype)
- [ ] `.planning/cleanup/FIX-LEDGER.md` (D-12), not in any PR
- [ ] Commitlint headers (scope enum from `commitlint.config.js:10-14`: `['web', 'service', 'shared', 'recurrence', 'matching', 'db', 'e2e', 'docker']`; the scope is optional). Dry-run passing examples: `fix(web): hold the deal-add id across a retry`, `fix(service): serialise add-to-list calls per list`, `test(shared): guard PATCH schemas against injected defaults`, `test: lint-fence probes for the service role`, `fix(docker): allowlist the GoTrue paths in Kong`, `fix: keep the database password off deploy.sh command lines`, `test(e2e): probe Kong refusals`. `test(scripts): …` **fails** (`scope must be one of [...]`). Subjects ≤ 71 chars.

## Security Domain

`security_enforcement` is enabled (absent from config means enabled; `.planning/config.json` has `security_enforcement: true`, level 1, block on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Sign-in/refresh/sign-out/OTP/verify stay reachable through Kong; the allowlist changes only what *else* is reachable; verified with real supabase-js against real GoTrue |
| V3 Session Management | yes | Token refresh and `GET /user` session checks preserved (the two paths easiest to miss) |
| V4 Access Control | yes | Kong ACL: `admin/users` is `admin` (service-role key) only; service-role Postgres access fenced by ESLint to `apps/service/src/privileged/` |
| V5 Input Validation | yes | PATCH schemas stay Zod-validated; the new guard forbids silent default injection that would overwrite stored values |
| V6 Cryptography | no | No new crypto; no secret handling beyond moving one env var |
| V14 Configuration / deployment | yes | Database password moved off the process command line (`ps`, `set -x`, CI logs) to a process-scoped environment variable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| GoTrue endpoints reachable from the internet through Kong with the public anon key (`/signup`, `/recover`, `/settings`, `/admin/*`, `PUT /user`) | Elevation / Tampering | Allowlist with a deny-by-default route; Caddy's refusals remain the first layer; the static test pins the table, the E2E probes prove the running gateway |
| Credential in argv visible to every local user via `ps` or logged by `set -x` | Information disclosure | `PGPASSWORD` in the environment of the one command; environment still readable by the same user and root via `/proc/<pid>/environ` (D-09 accepts this) |
| Service-role client used from request-handling code (bypasses RLS) | Elevation of privilege | ESLint `no-restricted-imports` + dynamic-import selector, now probed by a test; remaining gaps are listed (variable/template dynamic import, raw `set local role service_role`, `require`) |
| Partial update silently resets a stored field (data integrity) | Tampering (unintended) | Structural PATCH guard |
| Duplicate writes from a lost response | Repudiation / integrity | Stable client id (deal); per-list advisory lock (recipe) |
| Kong config load failure takes sign-in down | Denial of service | `_format_version: '3.0'` asserted by test; `kong config parse` pre-flight; E2E boots the real config |

**Audit of service-role usage outside `apps/service/src/privileged/` (FIX-05 deliverable).** Method: `grep -rniE "service_role|SERVICE_ROLE_KEY|withServiceRoleDb|serviceRole|privileged/"` over `apps`, `packages`, `supabase/seed` and `e2e`, then opening the hits [VERIFIED: grep plus reading `http/context.ts:1-40`, `main.ts:105-128`, `push/test-seam.ts:1-45`, `privileged/service-role-db.ts`]. Result: **no violation**; no code path outside `privileged/` constructs a service-role database or GoTrue client.

| Location | What it does | Verdict |
|----------|--------------|---------|
| `apps/service/src/main.ts:18-21,43,121` | Imports `createGoTrueAdmin`, `createJobDatabase`, `createNotificationOutbox`, `readSystemHealth`; passes `env.SERVICE_ROLE_KEY` | Sanctioned (fence ignores `main.ts`) |
| `apps/service/src/cli.ts:5,65` | `createGoTrueAdmin({ url: env.GOTRUE_URL, serviceRoleKey: env.SERVICE_ROLE_KEY })` | Sanctioned (fence ignores `cli.ts`) |
| `apps/service/src/http/context.ts:9` | `import type { SystemHealthRow } from '../privileged/service-role-db.js';` | Type-only, allowed by `allowTypeImports` |
| `apps/service/src/routes/users.ts` | Named in CONCERNS, but contains no `service_role`/privileged reference; calls the injected `changeEmail` | Clean; the capability arrives as a function from `main.ts` |
| `apps/service/src/jobs/*.ts` | `deps.database.asServiceRole(...)` (`jobs/types.ts:13-14`) | A narrow function handed in from `privileged/job-database.ts`; the intended design |
| `apps/service/src/services/readiness.ts`, `services/deals/{storage,dormancy}.ts`, `jobs/prune-cache.ts` | Mentions of `service_role` in comments | Comments only |
| `apps/service/src/env.ts:50,149` | `SERVICE_ROLE_KEY: z.string().min(1)` and its redaction flag | Config parsing, builds no client |
| `apps/service/src/push/test-seam.ts:15,34` | Takes `serviceRoleKey` and compares it to the `Authorization` header with `timingSafeEqual` | Never builds a client; registered only when `HEARTH_PUSH_TRANSPORT` is `test-double` (`main.ts:119-121`); worth one line in the audit note |
| `apps/service/src/test/service-stack.ts:12-13`, `*.integration.test.ts` | Import `privileged/*` directly | Test code, exempt by the fence's `ignores` |
| `supabase/seed/seed-users.ts`, `e2e/support/push.ts`, `e2e/setup/stack.ts` | Use the service-role key for the dev seed and E2E | Outside the service tree, dev/test tooling; not covered by the fence by design |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `.planning/phases/04-…/04-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.claude/CLAUDE.md`, `CONTRIBUTING.md`, `commitlint.config.js`, `eslint.config.js`, `package.json`, `.github/workflows/{ci,deploy}.yml`, `docs/{testing,deploy,architecture,use-cases}.md` (relevant sections), `scripts/{deploy.sh,test-sweep.test.mjs}`, `test/eslint-clock-ban.test.mjs`, `test/support/vitest-project.mjs`, `docker/{kong.yml,Caddyfile,kong-entrypoint.sh,docker-compose.yml}`, `e2e/{docker-compose.e2e.yml,setup/stack.ts,support/{raw-http,api}.ts,tests/{06,07,08,15}-*.spec.ts}`, `supabase/seed/seed-users.ts`, all of `apps/web/src/{lib/api/deals.ts,screens/deals/AddToList.tsx,lib/api/client.ts,lib/api/query-client.ts,lib/auth/auth-client.ts,components/chores/RotationEditor.tsx,components/ui/Button.tsx,test/harness.tsx}`, `apps/service/src/{services/add-to-list.ts,services/lists.ts,services/list-activity.ts,services/list-aggregation.ts,http/context.ts,main.ts,push/test-seam.ts,privileged/service-role-db.ts,test/{fake-app,integration-db,service-stack}.ts}`, `packages/shared/src/api/{contract.ts,bills.ts,schemas.test.ts}`, `supabase/migrations/*.sql` (grep).
- `@supabase/auth-js@2.116.0` source in `node_modules/.pnpm` (`GoTrueClient.ts`, `GoTrueAdminApi.ts`): every `_request(` call site listed above.
- Executed this session: Kong 3.9.3 (`kong config parse`, live routing probes, source of `typedefs.lua` for the path validator), GoTrue v2.196.0 with the repo's migrations, supabase CLI 2.117.0 `migration up --db-url` against a password-protected Postgres (no `PGPASSWORD` → `client password must be a string`; wrong → `password authentication failed`; right → applied; `SUPABASE_DB_PASSWORD` → not honored), Docker Compose v5.6.0 (bind-mount edit does not recreate), Vitest 5.0.1, tsc, ESLint 10.11.0, Prettier, commitlint dry runs, `npm view yaml`, `api.npmjs.org`.
- `gsd-tools query package-legitimacy check --ecosystem npm yaml` (SUS, `unknown-downloads`).

### Secondary (MEDIUM confidence)
- zod.dev/packages/core (via web search summary): `_zod.def` as the library-author introspection surface; the specific `type` strings were verified against the installed package, not the page.
- Mozilla Bugzilla 568313 / 1967645 / 1203810 (via web search summary): Firefox `dragstart` on `<button>`, and `setData` requirement.

### Tertiary (LOW confidence)
- None used for decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing new apart from `yaml`, whose only flag is a failed download lookup.
- Architecture: HIGH. Each pattern was run red and green against the real tool (Postgres, GoTrue, Kong, ESLint, bash, jsdom).
- Pitfalls: HIGH for the Kong, deploy and CI ones (reproduced); MEDIUM for Firefox drag (A1) and for how Caddy forwards odd spellings (A4).

**Research date:** 2026-10-20
**Valid until:** 2026-11-19 (30 days; the Kong, GoTrue and supabase-js versions are pinned, so the findings hold until a Dependabot bump of those images, which should re-run the Kong static test and E2E)
