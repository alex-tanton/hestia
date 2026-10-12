# Pitfalls Research

**Domain:** Cleanup, test stabilization, and hardening of an LLM-generated pnpm TypeScript monorepo (Fastify service, React/Vite PWA with a hand-written Workbox service worker, Supabase/Postgres with RLS, Playwright E2E on a full Docker Compose stack, GitHub Actions CI with deploy-on-merge to the owner's own host)
**Researched:** 2026-10-11
**Repo state read:** commit `224b93b` on `main` (clean tree)
**Confidence:** MEDIUM overall. Repo-specific findings are first-hand reads of this checkout (HIGH). External API/doc claims were fetched through the seam and are rated LOW by `classify-confidence` for the WebFetch/WebSearch providers, so each one is corroborated against the repo where possible and flagged "verify at phase time" where it is not.

**Evidence legend used below**
- `[R]` read directly from this repo (file and line cited). Treat as HIGH.
- `[D]` external documentation via the research seam. Seam tier is LOW; "corroborated" means the repo's own code or history confirms it.
- `[T]` training-data knowledge not re-verified this session. Treat as a hypothesis and verify when the phase starts.

**Working phase labels** (the roadmapper may rename; the mapping at the end uses these):
`P1` Baseline and evidence tooling, `P2` Test determinism, `P3` Evidence-gated removal, `P4` Bug fixes with regression tests, `P5` CI enforcement and docs sync.

---

## Critical Pitfalls

### Pitfall 1: Deleting code that is reachable only through config, strings, or the runtime

**What goes wrong:**
A file or export with zero static importers is deleted, and something that loads it by name at build time, container start, or runtime stops working. Most of these fail late (in the Docker image, on the production box, or in a user's installed PWA), not in `pnpm test`.

**Why it happens:**
Static analysis only sees `import` edges. This repo wires a large amount of behaviour through names in config files, shell scripts, Dockerfiles, and conventions. LLM-generated code also leans on these indirections heavily.

Concrete "looks dead, is live" inventory for this repo `[R]`:

| Looks dead | Actually reached by |
|---|---|
| `apps/web/src/sw.ts` and everything only it imports (`lib/push/service-worker-handlers.ts`, `workbox-precaching/routing/strategies/expiration/cacheable-response`) | `vite.config.ts` `VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts' })`. No TS file imports it. `self.__WB_MANIFEST` is textually replaced at build. |
| `apps/service/src/cli.ts` | `tsup.config.ts` second entry; `apps/service/bin/hearth-admin` runs `dist/cli.js`; `service.Dockerfile` copies and symlinks the bin onto `PATH`; `package.json` `bin`. |
| `apps/service/src/main.ts`, `write-openapi.ts`, `openapi.ts` | tsup entry; `build` script runs `tsx src/write-openapi.ts`; the service serves `dist/openapi.json`. `write-openapi.ts` is also excluded from coverage. |
| `apps/web/scripts/check-build.mjs`, `generate-icons.mjs` | `package.json` scripts; `check-build.mjs` also greps built output for copy strings and fails if a string "is no longer in" its source file. |
| `supabase/seed/seed-users.ts`, `compute-readiness.ts` | `db:seed` script (`tsx ../../supabase/seed/seed-users.ts`), E2E global setup, and `tsc -p ../../supabase/seed` inside the service `typecheck` script. |
| `docker/db/*.sql`, `docker/kong.yml`, `docker/*-entrypoint.sh`, `supabase/config.toml` | Compose volume mounts and container init; `supabase start` in CI. Excluded from the Docker build context by `.dockerignore`, so they are invisible to image builds and to code tools. |
| Web `pillars/*Route.tsx` `export const Component` | React Router `lazy: () => import(...)` consumes the export by convention, not by an import statement. An "unused export" report on `Component` is wrong, and deleting it renders an empty route at runtime without a type error. |
| Captured fixtures in `e2e/fixtures/flipp/**`, `apps/service/src/recipes/fixtures/*.html` | Opened by template-string filenames, e.g. `search-27514-${query}.json` in `fixture-yield.test.ts`, or by env-var directories (`HEARTH_FLIPP_FIXTURE_DIR`). A grep for the file's basename finds nothing. |
| Variables in `.env.example` not present in `apps/service/src/env.ts` | Docker Compose interpolation, Caddy, Kong, `scripts/deploy.sh`, `e2e/support/env.ts`. |
| `packages/matching/scripts/fuzzy-benchmark.ts` (imports `fuse.js`, which is no longer a dependency; ESLint-ignored) | Deliberately kept "as the recorded methodology" per the comment in `eslint.config.js`. Intent is documented, so this is an owner decision, not a tool decision. |
| `.husky/*`, `commitlint.config.js`, `.lintstagedrc.json`, `.nvmrc` | Executed by git hooks and CI; nothing imports them. |

**How to avoid:**
1. Require a three-part proof before any deletion, recorded in the commit body or the review list:
   (a) no static importer, (b) a repo-wide text search of the file's basename AND its export names across all file types (`*.yml`, `*.toml`, `*.sql`, `*.sh`, `Dockerfile*`, `*.json`, `*.md`, `*.mjs`), including template-string forms, (c) the specific build or test that exercises it passes after removal (see Pitfall 10 for the exact gate list).
2. Anything that fails (b) or (c) goes on an owner-review list. That list lives in `.planning/`, never in `docs/` (Pitfall 13).
3. Seed the dead-code tool's configuration with the entries above before reading any report (Pitfall 2).
4. Delete in small, single-purpose commits so a bad deletion is a one-commit revert.

**Warning signs:**
- A deletion PR touches `apps/web/src/sw.ts`, `apps/service/src/cli.ts`, or anything under `docker/`, `scripts/`, `supabase/` without an image build in its verification.
- Test count drops but no one can name which tests went with which deleted source.
- `pnpm test` is green but `pnpm build`, `docker build`, or E2E has not been run on the branch.

**Phase to address:** P3 (removal), with the entry list built in P1.

---

### Pitfall 2: Trusting the dead-code / unused-dependency tool (false positives and false negatives)

**What goes wrong:**
Knip (or depcheck/ts-prune) output is treated as a delete list. Dependencies the build needs get removed, or the tool is "fixed" by sprinkling `ignore` entries until it is quiet, which hides real dead code.

**Why it happens:**
Documented limits `[D]` (Knip docs, seam tier LOW): dynamic import specifiers and template-string imports are not resolved; conditional config dependencies may be missed; CommonJS member access is not traced; an `entry` setting replaces defaults rather than merging; the docs say to fix `entry`/plugin config first and treat `ignore*` as a last resort. Unlisted binaries and string-only references are the classic source of unused-dependency false positives.

Repo-specific false-positive candidates `[R]`:
- `workbox-*` (only imported from `sw.ts`), and `workbox-window` (never imported in source; it sits behind `virtual:pwa-register/react`). External sources conflict on whether the plugin bundles it `[D, LOW]`; `node_modules` is not installed in this checkout, so it could not be checked locally. Do not remove it on tool say-so. Prove removal with `pnpm build` plus a registration check.
- `esbuild` (root `pnpm.overrides` AND `onlyBuiltDependencies` in `pnpm-workspace.yaml`): never imported, required by tsup and Vite, and the override pins a CVE fix (`0.28.2`).
- Referenced only by strings or config: `tsx`, `tsup`, `kysely-codegen` (script strings), `@vitest/coverage-v8` (`provider: 'v8'`), `jsdom` (`environment: 'jsdom'`), `@testing-library/jest-dom` (types via tsconfig), `@axe-core/playwright`, `husky` (`prepare`), `@commitlint/*` (hook + config file), `lint-staged`, `globals`, `@eslint/js`, `@types/*`.
- `apps/service/src/db/types.ts` is generated by `kysely-codegen`; every unused interface in it will be reported. It must be excluded, never pruned by hand.
- The opposite error: Knip's Vitest plugin treats test files as entries, so an export used only by tests looks "used". It is dead in production. Decide per case; do not auto-keep and do not auto-delete.

**How to avoid:**
- Configure per workspace with explicit `entry` for: `apps/web/src/sw.ts`, `apps/web/src/main.tsx`, `apps/web/src/pillars/*.tsx`, `apps/service/src/{main,cli,write-openapi}.ts`, `apps/*/scripts/*`, `supabase/seed/*.ts`, `e2e/{global-setup,global-teardown}.ts`, `e2e/tests/*.spec.ts`; and `ignore` for generated `apps/service/src/db/types.ts` and `e2e/fixtures/**`.
- Run the tool in report-only mode first, and diff its report against the false-positive table above. Any finding that matches a row is a config bug, not a deletion.
- For dependencies: remove one package at a time, regenerate the lockfile in the same commit, then run install with `--frozen-lockfile`, `pnpm build`, both Docker image builds, and E2E.
- Never add `pnpm audit` or Knip as a blocking CI step until the baseline is clean (Pitfall 9).

**Warning signs:**
- The `ignore`/`ignoreDependencies` list grows faster than the delete list.
- A removal commit touches `package.json` but not `pnpm-lock.yaml`.
- Tool reports hundreds of findings on the first run (almost always missing entries, not hundreds of dead files).

**Phase to address:** P1 (configure), P3 (act on it), P5 (enforce).

---

### Pitfall 3: A cleanup merge to `main` is a production deploy

**What goes wrong:**
Cleanup commits land on `main` and `deploy.yml` runs `scripts/deploy.sh` on the self-hosted runner on the production host: build images, back up, run migrations against the live database, restart containers. A large refactor, or a half-finished cleanup, ships to the owner's real household app. Image rollback does not undo migrations.

**Why it happens:**
`deploy.yml` fires on `workflow_run` of the workflow named `CI` `[R]`. Its change filter is `git diff --name-only HEAD~1 HEAD | grep -qv '^docs/'`, so only `docs/` is exempt. `.planning/**`, `README.md`, tests, and CI files all count as "deploy". GSD workflows commit `.planning/` artifacts often; each push to `main` containing a non-`docs/` change deploys. The filter also looks at only the last commit, so a multi-commit push whose tip is docs-only skips the deploy of the code beneath it, which is the same flaw in the other direction. The repo's stated convention is that `main` is squash-merged `[R]`; the session is currently on `main` directly.

**How to avoid:**
- Do all cleanup on a branch and squash-merge by PR so CI (including E2E, which runs on PRs) gates it and exactly one deploy occurs.
- Keep `.planning/` commits off `main` until the squash (the repo has a `gsd-pr-branch` skill for filtering them), or make a deliberate, reviewed one-line change to the deploy path filter to exclude `.planning/`. Do not change `deploy.yml` casually; it is a production safety contract.
- Merge when the owner can watch the health gate. Do not include migration changes (Pitfall 4) in the same merge as refactors.

**Warning signs:**
- `git log origin/main` shows many small commits pushed directly.
- A deploy run appears in Actions for a commit that only touched `.planning/` or tests.

**Phase to address:** P1 (branch and merge policy), enforced through P5.

---

### Pitfall 4: Touching migrations, generated DB types, or seed layers

**What goes wrong:**
A "redundant" migration is merged, renamed, or squashed, or the generated types file is hand-edited. The live database and the history table disagree, or CI passes on a freshly built stack while production diverges.

**Why it happens:**
- Migrations are forward-only and applied in order by `supabase migration up` against the live DB `[R]` (STRUCTURE.md: "Do not edit an applied migration"). The CLI tracks versions in `supabase_migrations.schema_migrations`; reconciliation is done with `migration repair` `[D, LOW; docs do not cover editing an applied migration]`. Two late migrations (`20261004090000_notification_producers.sql`, `20261004090100_depart_clears_notification_preferences.sql`) look consolidatable. They are not.
- `apps/service/src/db/types.ts` is generated against a live DB by `pnpm db:types`; CI has no drift check, so a bad hand edit or tool-driven prune is invisible until a query changes `[R]`.
- Seeds are layered: `supabase/seed/seed.sql` (dates computed relative to the seed run, in each household's timezone, per `docs/testing.md`) plus `e2e/fixtures/e2e-seed.sql`. Tests depend on seeded shapes (for example "dinner Sunday to Friday, none on Saturday").

**How to avoid:**
- Treat `supabase/migrations/**` as read-only for this milestone. If a bug fix needs schema change, add a new migration with a fresh timestamp and a rollback note, in its own PR, and rehearse `migration up` against a snapshot.
- Exclude `db/types.ts` from every cleanup tool and regenerate it only with `pnpm db:types` against a freshly migrated DB. A diff of that file must be empty after cleanup.
- Do not convert relative seed dates to fixed dates "for determinism"; it breaks the documented "never goes stale" property. Fix tests instead (Pitfall 6).

**Warning signs:**
- Any diff under `supabase/migrations/` that is not a pure addition.
- `db/types.ts` appears in a cleanup diff.
- E2E passes only after `supabase db reset` with the changed file.

**Phase to address:** P3 (guard), P4 (only if a fix truly needs a migration).

---

### Pitfall 5: Fixing flaky tests by masking them

**What goes wrong:**
The suite goes green because failures were hidden, not because the nondeterminism was removed. The next calendar boundary (a Saturday, a DST change, midnight in some zone) fails again, and the suite no longer proves anything.

**Why it happens:**
Masking is the cheapest way to turn CI green. This project explicitly forbids it `[R]`: `e2e/playwright.config.ts` sets `retries: 0` and says "A flake has to be fixed rather than retried away"; `docs/testing.md` says "Never add a fixed wait or a retry to make a flaky step pass". Journeys share one database and later specs account for earlier mutations (`20-remove-member.spec.ts` must run last), so a retry of a state-changing step reports a failure that means nothing.

Masks to refuse (each is a regression against the spec):
- Playwright `retries`, `test.slow()`, raising `timeout`/`expect.timeout`, `waitForTimeout`, `{ force: true }`.
- Vitest `retry`, bumping `testTimeout`, `test.skip`/`it.todo`/`fixme`, loosening assertions (`toBeGreaterThan(0)`, regex that matches anything).
- Wrapping the failing step in `try/catch` and returning a sentinel (the existing `firstMealOn()` returns `''` for "none"; the fix in `b96ca32` pairs it with `ensureDinnerOn` which creates the prerequisite, which is the right shape).
- Setting `TZ=UTC` globally in CI or in the Vitest config. It makes the household-timezone code paths pass on every machine by never exercising them (also see Pitfall 6).
- Lowering coverage thresholds to recover from deleting well-tested code (Pitfall 9).

**How to avoid:**
Classify each flake before touching it, then apply the matching fix:

| Class | Example here | Fix |
|---|---|---|
| Wall-clock read | `new Date()` in `bills.integration.test.ts`, `e2e/tests/16-bill-paid-late-keeps-anchor.spec.ts` | Pin or derive time (Pitfall 6) |
| Seed-shape assumption | Saturday has no seeded dinner | Create the prerequisite through the API, or read it from the seeded data |
| Shared-state / order | later spec assumes earlier mutation | Make the spec build its own data; keep file order for seed-mutating specs |
| Async race | asserting before a refetch/realtime event | Web-first assertion or `waitFor` on the user-visible outcome, never on time |

Prove stability by repetition rather than by one green run: loop the unit/component suite N times under three `TZ` values (Pitfall 6), and run E2E from a cold stack twice on different weekdays.

**Warning signs:**
- A diff adds a number to a timeout, a `retries` key, or a `try/catch` inside a test helper.
- "Passes on rerun" appears in a commit message or PR comment.
- `TZ` appears in `ci.yml` or a Vitest config.

**Phase to address:** P2.

---

### Pitfall 6: Pinning the clock in one place while another clock keeps running

**What goes wrong:**
Time is "fixed" in the test process, but the browser, the service, Postgres, or `Intl` keeps real time or a different zone, so "today" disagrees between layers and a new, rarer flake replaces the old one. Or a global fake timer freezes everything and tests hang.

**Why it happens:**
There are four independent clocks and a timezone in this stack `[R]`: the Vitest process (`Date`), the jsdom/Playwright browser, the Node service (`new Date()` passed into jobs), and Postgres (`now()` defaults such as `created_at`). `Intl.DateTimeFormat` uses the process `TZ`, which no fake timer changes. Specific traps:

1. **Vitest semantics `[D]`, corroborated by repo usage:** without fake timers, `vi.setSystemTime` mocks only `Date`. `vi.useFakeTimers()` also fakes `setTimeout`/`setInterval`/`setImmediate`, which stalls Testing Library `waitFor`, `user-event`, and TanStack Query retry/gc timers. The repo already uses `vi.useFakeTimers({ toFake: ['Date'] })`; keep that pattern and do not move to a blanket `useFakeTimers()` in `test-setup.ts`.
2. **Teardown undoes a global pin:** many existing web tests call `vi.useRealTimers()` in `afterEach`. A pin applied once in a setup file is silently dropped after the first such test; it has to be re-applied in a `beforeEach`.
3. **Playwright `page.clock` is browser-only `[D]`.** There is no server clock seam (a search for a `HEARTH_NOW`-style override in `env.ts`, `e2e/`, `docker/` found none `[R]`) and Postgres `now()` cannot be faked. Pinning the browser while the service and seed run on real time creates browser-vs-server "today" disagreement. For E2E, do not fake time: derive expectations from seeded data or create prerequisites via the API.
4. **Midnight straddle:** a test that computes "today" locally and then calls an API that computes its own "today" fails for the seconds around a zone's midnight. `Pacific/Kiritimati` (the household zone in `bills.integration.test.ts`) crosses midnight at 10:00 UTC every day, so this is a daily, not a weekly, window.
5. **UTC-date vs household-date helpers:** `isoDate(offsetDays)` in `bills.integration.test.ts` uses the UTC calendar date, while the service dates by household zone. They disagree for several hours of every day. That is a time-of-day flake, so a weekday matrix will not find it.
6. **Passing in CI by luck:** CI runs on `ubuntu-latest` (UTC); a Windows dev machine runs local zone. A test can pass in one and fail in the other without any code change.

**How to avoid:**
- Unit/component/service tests: inject or pin `now` explicitly; use `toFake: ['Date']`; derive every expected date from the pinned instant in the household's zone, never from the process zone.
- Add a verification loop (script, not 20 CI jobs): run the web and package suites under `TZ=UTC`, `TZ=America/Los_Angeles`, `TZ=Pacific/Kiritimati`, `TZ=Pacific/Pago_Pago`, each at a pinned Saturday, a Sunday 23:30 local, and a month-end/DST-boundary instant.
- E2E: audit every `new Date()`/`Date.now()` site (28 call sites per CONCERNS.md; the grep shows `19-notifications.spec.ts:200` and `16-bill-paid-late-keeps-anchor.spec.ts:30` in `e2e/`). Replace "assume weekday" with "read it from seed or create it". Add a scheduled (not per-PR) E2E run so different weekdays get exercised over a week.
- Do not convert the seed to fixed dates (Pitfall 4).

**Warning signs:**
- A fix that touches only the browser clock for a failure that involves a server-computed date.
- Tests that pass at 14:00 and fail at 00:10 local, or only on one weekday.
- A `vi.useFakeTimers()` with no `toFake`, followed by timeouts in `waitFor`.

**Phase to address:** P2 (before any deletion, so that "green" is a trustworthy signal in P3).

---

### Pitfall 7: Fixing the offline-duplicate bug against the wrong diagnosis, with a regression test that cannot fail

**What goes wrong:**
Work goes into adding server-side dedupe that already exists, while the actual duplicate path stays open. Or a regression test is added that passes both before and after the fix, so it proves nothing.

**Why it happens:**
CONCERNS.md and the `write-queue.ts` header both say there is "no server-side dedupe". The code says otherwise `[R]`:
- `apps/service/src/services/lists.ts:315-326` inserts with `.onConflict(c => c.column('id').doNothing())`, takes an optional client `id`, and only records activity when a row was actually inserted. `lists.integration.test.ts:539-600` already covers same-id replay, replay with a different payload, and cross-list/cross-household ids.
- `ListDetailScreen.tsx:104` mints the id at enqueue time inside `handleAdd`, which is correct (the id is persisted in the paused mutation's variables).
- **The leak candidate:** `useAddDealToList` in `apps/web/src/lib/api/deals.ts:273` calls `crypto.randomUUID()` inside `mutationFn`. Every invocation sends a fresh id, so a re-tap or any retry after a lost response inserts a second row. It is a plain `useMutation` outside the persisted queue, and its doc comment claims the id makes replay a no-op, which is not true for this call.
- Unverified, must be checked before assuming safe: `POST /api/recipes/:id/add-to-list` (`services/add-to-list.ts`) takes no visible client id; `use-chore-completion.ts:88` mints `completionId` at call time (good) but the online and offline branches should be confirmed to use the same id.
- `[T, LOW]` TanStack's default `shouldDehydrateMutation` persists only paused mutations, so a write that was in flight when the tab closed may not be replayed at all; the "reload between send and response" gap in CONCERNS may produce a missing local row (fixed by refetch) rather than a duplicate. Verify with a test, not an assumption.

**How to avoid:**
1. Reproduce first. Write the failing test on the unfixed code and watch it fail for the right reason (a second row exists), then fix.
2. Fix at the right layer: the idempotency key must be created once, at user-action time, stored in the mutation variables, and reused on every attempt. Generating it inside `mutationFn` is the anti-pattern.
3. Test the lost-response case at three layers, not one:
   - Web unit: stub `fetch` so the "server" records the request, then the transport rejects; assert the replay carries the identical id and the stub store ends with one row.
   - Service integration: same body POSTed twice returns the same result, one row, activity recorded once (partly present).
   - E2E: `page.route(..., async route => { await route.fetch(); await route.abort('connectionreset'); })` for the first attempt only, then assert a single row after reconnect. `route.fetch()` performs the request so the server has processed it, and the documented abort codes include `connectionreset` `[D, LOW]`.
4. Remember delete is not queued in v1 (`write-queue.ts` header). A replayed add after a manual delete would resurrect the item, because the conflict target is gone. Decide and document whether that is accepted; do not "fix" it with tombstones in a cleanup milestone.

**Warning signs:**
- A new migration or unique constraint proposed for list items.
- The new test has no step that makes the first attempt reach the server and then fail.
- The fix touches only `write-queue.ts` while `deals.ts` still mints ids per attempt.

**Phase to address:** P4.

---

### Pitfall 8: Re-introducing the Zod 4 default-in-partial bug, or over-applying the fix

**What goes wrong:**
A PATCH schema built with `.partial()` on a create schema silently rewrites stored columns with create-time defaults (the `1030b35` bug: a partial `PATCH /bills/:id` reset six fields). Alternatively, a blanket "no `.default()`" rule breaks legitimate query-string defaults.

**Why it happens:**
Zod 4 applies defaults inside optional fields `[D]`: `z.string().default('x').optional().parse({})` returns `{ a: 'x' }` (Zod 3 returned `{}`). The changelog calls it a subtle change that can break code relying on key existence. Corroborated in-repo: `bills.ts:97-118` documents exactly this, and the fix unwraps each default with `.unwrap()` before `.partial()`. The workaround is hand-maintained per schema, so the next PATCH schema is one `.partial()` away from the same bug, and the failure is silent.

Legitimate defaults that the rule must not touch `[R]`: `dealSearchQuerySchema` and `flyerItemsQuerySchema` (`scope`, `sort`, `page`), `flyersQuerySchema`, `recipesQuerySchema` are GET query schemas where "absent means default" is the contract; `departRequestSchema.reassignments.default({})` is a POST body. Only PATCH/update bodies are in scope.

**How to avoid:**
- Enforce with one generic contract test rather than prose: the shared package already exports an `endpoints` registry whose entries carry `method` (`contract.ts:129`). Iterate every `PATCH` endpoint and assert (a) `schema.parse({})` either throws or yields an object with no keys, and (b) for each field, `parse({ [field]: validValue })` yields exactly that one key. New PATCH endpoints are then covered automatically.
- Keep the per-endpoint persistence test pattern from `95b0bd2` (send `{ name }`, assert other columns unchanged), because the contract test cannot see service-side `SET` clauses.
- Regenerating OpenAPI changes with the schema (`z.toJSONSchema(..., { io: 'input' | 'output' })`); run `openapi.test.ts` and diff `dist/openapi.json` so a contract change is deliberate.
- Do not introduce a lint rule that bans `.default()` in `packages/shared`.

**Warning signs:**
- `.partial()` or `.extend()` applied to an object whose fields contain `.default(...)`.
- A PATCH handler that builds `SET` from `parsed` using `Object.entries` without checking for `undefined`.
- Tests that PATCH with a full body only.

**Phase to address:** P4.

---

### Pitfall 9: Gate changes that break the CI-to-deploy contract

**What goes wrong:**
A "robustness" change to CI blocks every production deploy, silently disables deploys, or leaves a gate that looks enforced but is not.

**Why it happens:**
`[R]` Contracts that are easy to break:
- `deploy.yml` triggers on `workflows: [CI]` and requires `conclusion == 'success'`, `event == 'push'`, `head_branch == 'main'`. Renaming the workflow silently disables auto-deploy. Per GitHub docs `workflow_run` matches by workflow name and runs from the default branch `[D, LOW]`.
- Adding a new job that is red on day one (Knip, `pnpm audit`, a stricter lint) makes the whole CI conclusion `failure`, which blocks deploy, including a hotfix.
- Required status checks are configured in GitHub, not in the repo, so job id/name changes can unseat them. Per GitHub docs `[D, LOW]`: a workflow skipped by path/branch filter leaves its required checks Pending and blocks merge, a job skipped by a conditional reports Success, and a job that depends on a failed job is skipped rather than failed. The `test-e2e` job already uses an `if:` for this reason.
- `pnpm audit` as a hard gate fails permanently on the known `braces` advisory (no upstream patch, CONCERNS.md). Use an advisory-only job or an explicit allowlist.
- Coverage: service thresholds (`95/83/96/97`, set "a few points under" measured) are enforced in CI only through the `test-integration` job. Web thresholds exist in `apps/web/vite.config.ts` but CI runs plain `pnpm test`, so they are not enforced, and `docs/testing.md` says web has no coverage configuration (drift). Deleting well-covered dead code can lower a ratio under a tight threshold; lowering the threshold to compensate is a mask (Pitfall 5).
- Only `test-e2e` has `timeout-minutes`; the other jobs inherit the 360-minute default, so a hung `supabase start` ties up CI and blocks deploy for hours.
- `pnpm install --frozen-lockfile` (CI and `service.Dockerfile`) fails when `package.json` and the lockfile disagree, and `pnpm fetch --frozen-lockfile` in the image build uses the lockfile alone. `saveExact: true` means additions must stay exact-pinned.

**How to avoid:**
- Land enforcement last (P5), after the baseline is clean, and introduce each new check as its own job with report-only behaviour first (`continue-on-error` or Knip `--no-exit-code`) for one cycle.
- Never rename the `CI` workflow or its job ids in this milestone. If a job must be added, add it; do not rename.
- Decide web coverage explicitly: enforce it (run `test:coverage` in `test-unit` after measuring it passes) or remove the stale config and fix the doc. Do not lower thresholds to land a deletion; add tests for the now-larger uncovered share, or ratchet with a written reason.
- Add `timeout-minutes` from measured p95 durations times 2 to 3, not from guesses.
- Do not run `pnpm update` or `pnpm dedupe` casually; Dependabot already opens one grouped weekly PR (`.github/dependabot.yml`).

**Warning signs:**
- `name: CI` changed, or job ids renamed, in a diff.
- First run of a new job is red on `main`.
- A threshold number decreases in a diff.

**Phase to address:** P5 (with P1 recording the measured baselines).

---

### Pitfall 10: Mixing behaviour changes into cleanup commits, with no baseline to prove "unchanged"

**What goes wrong:**
The milestone's core promise ("behaviour unchanged except documented bug fixes, suite stays green") cannot be shown, because deletions, refactors, and fixes are interleaved and the starting numbers were never recorded.

**Why it happens:**
Cleanup and bug fixing share files (for example `bills.ts`, `write-queue.ts`, `RotationEditor.tsx`). The reachable proof is weak by default: this checkout has no `node_modules`, the integration job needs `supabase start`, E2E needs the full Compose stack (about 40 minutes in CI), and `docs/testing.md` warns that only results from a run that started from an empty database count (`HEARTH_E2E_REUSE_STACK=1` iteration can hide state leakage).

**How to avoid:**
- P1 records a baseline on untouched `main`: `pnpm install --frozen-lockfile`; `pnpm lint`, `format:check`, `typecheck`, `test`, `test:integration`, `build`; test counts per workspace; coverage numbers; a build output manifest (file list and sizes of `apps/web/dist` and `apps/service/dist`); the CI duration of each job.
- One concern per commit. A commit is either removal, or a bug fix with its test, or a CI change. Use scope names from the closed list in `commitlint.config.js` (Pitfall 12).
- After P3, show: same test count minus an explicit list of removed tests with the removed source they covered; identical `dist/openapi.json`; identical `apps/web/dist` manifest apart from the removed modules.
- Required gate list for any removal PR: lint, format, typecheck, unit, service integration, `pnpm build` (which runs `check-build.mjs`), both Docker images build, and a cold E2E run in CI.

**Warning signs:**
- A PR description says "cleanup and fix X".
- Test count after is lower and no list explains why.
- Verification evidence is "unit tests pass locally" for a change touching Docker, CI, or the service worker.

**Phase to address:** P1 (baseline), applied in P3 and P4.

---

### Pitfall 11: Security hardening that locks out legitimate traffic or only relocates the problem

**What goes wrong:**
Kong/Caddy tightening blocks a flow the web app needs (found by users, not by tests), the service-role "audit" passes by moving code rather than shrinking privilege, or the deploy-password fix breaks the only deploy path.

**Why it happens and what to do, by item `[R]` unless noted:**

**Kong/Caddy GoTrue path coverage.**
- Enumerating "needed" paths from memory instead of from the pinned GoTrue version's route list will drop real flows (token refresh via `/auth/v1/token`, logout, `GET /auth/v1/user`, recovery/verify, JWKS if the service fetches it). Refresh happens only after access-token expiry, which a 15-minute E2E almost never reaches, so a broken refresh route would not be caught by the existing journeys.
- Fix by pairing every new refusal assertion with a positive one: add an explicit test that exercises refresh, logout, and the invite/password flows through Caddy and Kong. Extend `08-caddy-refuses-gotrue-endpoints.spec.ts` with variants: trailing slash, double slash, percent-encoded segments, and each HTTP method.
- Validate config syntactically (`caddy validate`, Kong declarative config parse) before the E2E run; `kong-entrypoint.sh` templates env into `kong.yml`, so a YAML typo only shows at container start.
- A deny-in-Kong change must not be the only layer removed: keep the Caddy refusal, add the Kong one (defence in depth), never swap.

**Service-role fence.**
- The ESLint fence restricts imports and dynamic imports of `**/privileged/*`; it cannot see capabilities passed as function arguments, which is the design (`main.ts` hands narrow functions to routes). A passing lint run therefore does not prove the key is not reachable.
- Before changing anything, read `routes/users.ts` and `http/context.ts`. They may only import types or receive injected functions, in which case the CONCERNS finding is a false alarm.
- Do not satisfy the audit by moving logic into `privileged/`; that enlarges the trusted region. Prefer a narrow function in `privileged/` injected from `main.ts`.
- Enforce with a test that scans `apps/service/src` for the service-role env var name and `service_role` outside `main.ts`, `cli.ts`, `privileged/**`, tests, and `test/**`. The integration harness (`startStack()`) legitimately builds privileged clients, so keep it exempt.
- Note `allowTypeImports: true` is intentional; do not remove it.

**Deploy-script password exposure.**
- `scripts/deploy.sh:95-96` interpolates `POSTGRES_PASSWORD` into the `--db-url`. Moving it to an environment variable or `.pgpass` is fine in principle, but whether the Supabase CLI honours `PGPASSWORD` when the URL omits the password is `[T, LOW]`; verify on a throwaway stack.
- The first execution of a modified `deploy.sh` is the production deploy, because the runner checks out the merged commit. CI's E2E applies migrations "the way a deploy applies them" but does not run `deploy.sh` itself.
- A rotated password containing URL-reserved characters would already break the current URL form (`generate-secrets.sh` uses hex, which is safe; a manually rotated one may not be). Percent-encode or avoid the URL form.
- Rehearse with `bash -n`, `shellcheck`, and a dry run against the E2E stack. Keep the diff minimal.

**Phase to address:** P4 (all three), with the positive-flow tests written before any rule tightening.

---

### Pitfall 12: Local tooling traps for agent-made commits on Windows

**What goes wrong:**
Commits are rejected, hooks are bypassed with `--no-verify` (skipping lint-staged and the whole-repo typecheck), shell scripts lose their executable bit, or CRLF makes a script unrunnable in a Linux container.

**Why it happens `[R]`:**
- `commitlint.config.js` has a closed `scope-enum`: `web, service, shared, recurrence, matching, db, e2e, docker`; a closed `type-enum`; `subject-max-length` 71. A cleanup commit with scope `ci`, `deps`, `cleanup`, `planning`, or `scripts` is rejected by the `commit-msg` hook. `[T, MEDIUM]` `config-conventional` also caps body lines at 100 characters.
- `pre-commit` runs lint-staged and then `pnpm typecheck` for the whole workspace on every commit, which is slow enough that skipping it is tempting.
- This machine has `core.fileMode=false` and `core.autocrlf=true`. With `fileMode=false`, a newly added script is committed as `100644`, and `deploy.yml` runs `scripts/deploy.sh` directly, so a new or recreated script without `+x` fails with "Permission denied" on the runner. Existing executables are `100755` today (`deploy.sh`, `generate-secrets.sh`, `hearth-admin`, both entrypoints). `.gitattributes` has `* text=auto eol=lf`, which protects line endings, but editors that write CRLF to `*.sh` inside the working tree are still a risk until the file is re-normalized.

**How to avoid:**
- Use scope-less commits (`chore: ...`, `ci: ...`) or a listed scope; keep the subject under 71 characters. Never `--no-verify`.
- After touching or adding any script: `git ls-files -s <path>` must show `100755`; fix with `git update-index --chmod=+x`.
- Add a test or CI step that asserts the mode of every `scripts/*.sh`, `docker/*.sh`, and `apps/service/bin/*` in the index, and that none contains `\r`.

**Warning signs:**
- Hook failures that end with someone suggesting `--no-verify`.
- A script diff showing every line changed (line-ending flip) or `old mode 100755`/`new mode 100644`.

**Phase to address:** P1 (policy), re-checked at every phase's commit step.

---

### Pitfall 13: Docs drift, and violating "docs/ is the only source of truth"

**What goes wrong:**
Files are deleted that `docs/` and `README.md` still name, a decision log or review file is added under `docs/` (forbidden by the project constraint and the owner's saved preference), or spec comments that carry traceability are stripped as "narration".

**Why it happens `[R]`:**
- `docs/file-map.md`, `docs/deploy.md`, and `README.md` enumerate scripts and paths (`scripts/deploy.sh`, `scripts/generate-secrets.sh`, `sw.ts`, `hearth-admin`). Removing or renaming anything listed leaves stale references.
- When code and docs disagree, "docs are the source of truth" does not tell you which side is wrong. Example: `docs/testing.md` says web has no coverage config, while `vite.config.ts` has thresholds (probably stale doc, added later in `801f9fd`), but that is a judgement for the owner.
- Comments cite `Handoff non-negotiable 9`, `Engineering Practices >`, `Technical Architecture >`. They are the only link from code to spec. `check-build.mjs` also cross-checks copy strings against their source files. Treating these as LLM narration and stripping or "deduping" them destroys traceability and can trip `pnpm build`.

**How to avoid:**
- Treat docs as an edit target only for factual as-built corrections that are provable from code; list real code-vs-spec conflicts for the owner.
- Put the owner-review list, the baseline numbers, and any decisions in `.planning/` only. Never create review, log, or ADR files under `docs/`.
- Remove a comment only if it is wrong or duplicates the adjacent identifier name; keep every spec reference.
- Any path rename or deletion includes a repo-wide search of `docs/`, `README.md`, `.github/`, `docker/`, and comments for the old path, in the same commit.

**Phase to address:** P3 (reference sweep), P5 (docs sync).

---

## Moderate Pitfalls

### Pitfall 14: Splitting or merging test files and fixtures
**What goes wrong:** Splitting the 800 to 1100 line integration files (`api`, `lists`, `jobs`, `policies`) puts the same `nextPostalCode()`/`uniqueName()` counters into several files. Files run serially (`fileParallelism: false`) but share one database and natural keys such as postal code, so restarted counters collide across files. Merging fixture modules that hold module-level counters has the same effect `[R]` (TESTING.md).
**Prevention:** CONCERNS.md already says "split when next touched". Do not split in this milestone unless a file is being edited for a fix. If split, centralize the counters in `apps/service/src/test/` with a per-file base, and run the integration job twice back to back.
**Phase:** P3.

### Pitfall 15: Replacing the `RotationEditor` a11y suppression with something worse
**What goes wrong:** The `eslint-disable` at `RotationEditor.tsx:132` sits on an `<li draggable>` inside an `<ol>`. The adjacent comment documents that Up/Down/Remove buttons are the keyboard-operable path (the WCAG single-pointer-alternative requirement). Adding `role="button"` and `tabIndex` to the `li` breaks list semantics and adds a spurious tab stop; deleting the comment without changing the DOM just hides it.
**Prevention:** First prove or disprove a real defect: keyboard-only reorder through the buttons, and the E2E axe run that already covers the screen. Then move pointer-drag handlers to a dedicated handle element or accept a scoped, justified suppression. Success criterion is the axe/E2E result plus an unchanged keyboard flow, not a cleaner lint output.
**Phase:** P4.

### Pitfall 16: Stale ignore files edited without knowing what they gate
**What goes wrong:** `.dockerignore` excludes `docs`, `docker`, `supabase`, `e2e/fixtures` and re-includes only `docker/Caddyfile` and `docker/caddy-entrypoint.sh`. A "consolidate scripts" change that adds a file COPY'd by a Dockerfile needs a negation entry or the image build fails; removing entries exposes large trees to the build context. `BUILD_PROMPT.md` is named in `.dockerignore` and `.prettierignore` but does not exist (an LLM leftover, safe to remove). `.prettierignore` lists `docs/`, so docs are not format-checked.
**Prevention:** Remove only entries for files that provably do not exist; build both images after any `.dockerignore` change.
**Phase:** P3.

### Pitfall 17: Source-scanning tests break on structural cleanup
**What goes wrong:** `apps/web/src/lib/password.test.ts` walks the static import graph from `main.tsx` with regexes and asserts the app shell never reaches the common-password list (200 KB gzipped budget). `tokens.test.ts` reads `src/index.css`. `check-build.mjs` budget-checks the shell. Collapsing barrels, changing import syntax, or hoisting a lazy import to static can fail these tests or, worse, defeat the budget while the test's regexes miss the new form.
**Prevention:** Keep the "is walking a real graph" guard; after any import-structure change, run `pnpm build` and compare the shell size against the P1 manifest.
**Phase:** P3.

### Pitfall 18: Treating `braces` as a task
**What goes wrong:** An override is added for a version that does not exist, or the transitive dev dependency is forced to a major that breaks tooling.
**Prevention:** No upstream patch exists (commit `b96ca32`). Record the accepted risk and re-check on a schedule; do not add a gate that fails on it (Pitfall 9).
**Phase:** P5.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add Knip `ignore`/`ignoreDependencies` until it is quiet | Green dead-code job | Real dead code and real unused deps hidden; list becomes a second undocumented config | Only for items on the Pitfall 1/2 tables, each with a one-line reason |
| Global `TZ=UTC` in CI | Timezone tests pass everywhere | Household-timezone logic no longer exercised; local and CI diverge | Never |
| Raise a timeout or add a retry | One red test goes green | Masks state leakage; violates `docs/testing.md` | Never in this repo |
| Lower a coverage threshold | Unblocks a deletion PR | Gate no longer reflects reality | Only with a measured before/after and a written reason, never to fix a flake |
| Delete tests together with "their" dead code in one commit | Small diff | Cannot tell dead code from untested live code | Only when the test exclusively imports the deleted module |
| Hand-edit `db/types.ts` | Silences type errors | Drift from schema invisible to CI | Never |
| Bump deps while cleaning (`pnpm update`) | "Fresh" lockfile | Unreviewable diff, Dependabot churn, `esbuild` override interactions | Never in this milestone |
| Push planning commits straight to `main` | Fewer steps | Each push is a production deploy | Never (Pitfall 3) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| vite-plugin-pwa `injectManifest` | Flagging `sw.ts` and `workbox-*` as unused | Declare `sw.ts` as an entry; verify any removal with `pnpm build` and a service-worker registration check |
| Workbox / service worker | Editing cache rules or the navigation denylist (`/api/`, `/auth/`, `/realtime/`) during "simplification" | Treat `sw.ts` as behaviour; its tests (`sw.test.ts`) mock Workbox, so they will not catch a real cache regression |
| TanStack Query paused mutations | Creating the idempotency id inside `mutationFn` | Create in variables at enqueue time; only state is persisted, functions cannot be serialized `[D, LOW]`; `setMutationDefaults` must be registered before restore |
| TanStack mutation `scope` | Changing scope ids (`list:<id>`) while refactoring | Same scope runs serially in order `[D, LOW]`; treat the id format as a contract |
| Playwright | Using `page.clock` to fix a server-dependent date | Browser-only `[D, LOW]`; derive from seed or create data via API |
| Vitest fake timers | Blanket `useFakeTimers()` | `toFake: ['Date']` or `setSystemTime` (Date-only without fake timers) `[D, LOW]` |
| Supabase CLI | Editing/renaming an applied migration | New forward migration only; `migration repair` is a history-table tool, not a license to edit |
| Docker build | New file under `docker/` or `scripts/` not in the build context | Add the `.dockerignore` negation; build both images |
| GitHub Actions | Renaming `CI` or job ids | Add jobs; never rename (deploy and branch protection depend on names) |
| pnpm | Removing a dependency without regenerating the lockfile | Same-commit lockfile change; `--frozen-lockfile` must pass; keep exact pins |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running the full E2E for every cleanup iteration | 40-minute feedback loops, cleanup stalls | Iterate with `HEARTH_E2E_REUSE_STACK=1` for targeted specs, but gate on a cold run | Every PR (E2E builds two images cold on GitHub-hosted runners) |
| Timezone/weekday matrix as many CI jobs | CI minutes and queue time balloon | A local/verification script plus one scheduled workflow | Immediately |
| Coverage over service integration requires `supabase start` | Local runs impossible on a plain Windows setup | Rely on the CI job; do not duplicate it | Always |
| Knip across all workspaces with type-aware resolution | Slow first run | Run report-only on a schedule before adding to the PR path | Large workspaces |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Swapping a Caddy refusal for a Kong ACL instead of layering | One misconfiguration reopens signup and password change on the public URL | Keep both; test refusals and the positive flows |
| Moving code into `privileged/` to satisfy the fence | Larger service-role surface | Inject narrow functions from `main.ts` |
| Weakening `allowTypeImports` or the dynamic-import selector | Fence bypass | Leave the rule shape intact; add tests |
| Leaving `--db-url` with embedded password while "hardening" elsewhere | Credential in `ps` and traces | Minimal, rehearsed change to `deploy.sh` |
| Adding `unsafe-eval`/removing hashes while "fixing" CSP to quiet a violation | Weakens `script-src 'self'` | Accept or document `style-src 'unsafe-inline'` explicitly; do not widen `script-src` |
| Cleanup test code that logs secrets from `.env` parsing in `e2e/support/env.ts` | Leak in CI logs | No new logging of env content |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Shipping the duplicate-add fix without a visible-state check | Offline user still sees two items until refetch | Verify the optimistic row and the server row share one id in the cache (`list-cache.ts`) |
| Changing offline toast/notice copy during dedupe of strings | `check-build.mjs` and tests that assert copy fail, or users lose meaning | Keep copy files (`*-copy.ts`) unchanged unless a bug |
| Altering the "Update available" flow while touching the service worker | A waiting worker reloads under the user (spec forbids it) | `registerType: 'prompt'` and `injectRegister: false` stay as they are |

## "Looks Done But Isn't" Checklist

- [ ] **Dead-code removal:** often missing the non-TS references; verify a repo-wide text search of basename and export names across yml/toml/sql/sh/Dockerfile/md, and both Docker images build.
- [ ] **Unused dependency removed:** often missing the lockfile; verify `pnpm install --frozen-lockfile` passes and `pnpm build` including `check-build.mjs`.
- [ ] **Flake "fixed":** often missing a repeat run; verify N consecutive green runs under three `TZ` values, and a cold E2E on two different weekdays.
- [ ] **Regression test added:** often passes before the fix; verify it fails on the pre-fix commit for the stated reason.
- [ ] **Offline duplicate fix:** often missing the "request reached server, response lost" step; verify the E2E uses `route.fetch()` then `route.abort()` once.
- [ ] **New PATCH schema:** often missing the single-field persistence test; verify the generic contract test covers it and `{}` is rejected or empty.
- [ ] **Docs match code:** often missing `docs/file-map.md` and `README.md` path updates; verify a search for every deleted or renamed path.
- [ ] **CI change:** often missing the deploy contract; verify the workflow is still named `CI`, job ids unchanged, and the first run on the branch is green.
- [ ] **Script added/edited:** often missing the exec bit and LF endings; verify `git ls-files -s` shows `100755` and no `\r`.
- [ ] **Coverage unchanged:** verify thresholds are not lower than the P1 baseline.
- [ ] **No decision-log or review file under `docs/`.**

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrongly deleted live file found in CI | LOW | `git revert` the single-purpose commit; add the missing entry to the tool config and the false-positive table |
| Wrongly deleted file found in production (deploy already ran) | MEDIUM | Revert on a branch, squash-merge for a new deploy; the health gate's image rollback covers code but not migrations |
| Bad migration or migration history mismatch | HIGH | Stop deploys; restore from the pre-migration backup per `docs/deploy.md`; use `migration repair` only after confirming actual schema state |
| Masked flake discovered later | MEDIUM | Remove the mask, reproduce on the failing weekday/zone, apply the class-specific fix |
| CI renamed and deploy stopped | LOW | Restore the `name: CI`; re-run the failed `main` workflow so `workflow_run` fires |
| Red enforcement job blocking deploy | LOW | Switch the job to report-only (`continue-on-error`) in a one-line PR, then fix findings |
| Script lost exec bit in production | LOW | `git update-index --chmod=+x`, commit, redeploy (deploy fails before touching containers) |
| Duplicate list rows already in the database | LOW | Users delete rows; do not write a data-fix migration in a cleanup milestone |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Config/string-reachable code deleted | P1 entry list, P3 removal | Both images build, `pnpm build`, cold E2E; each deletion has the three-part proof |
| 2. Tool false positives/negatives | P1 configure, P3 act, P5 enforce | Report diffed against the Pitfall 1/2 tables; `ignore` list reviewed |
| 3. Merge equals production deploy | P1 policy | One squash merge by PR; no direct pushes to `main` |
| 4. Migrations/types/seed touched | P3 guard, P4 if needed | `git diff` shows no change under `supabase/migrations/` or `db/types.ts` |
| 5. Flakes masked | P2 | No retry/timeout/skip/TZ diff; repeat-run evidence |
| 6. Clocks inconsistent | P2 | TZ x instant loop green; E2E derived from seed; no browser-only clock for server dates |
| 7. Offline duplicate misdiagnosed | P4 | Red-then-green test at unit, integration, and E2E; `useAddDealToList` id minted at action time |
| 8. Zod default-in-partial | P4 | Generic PATCH contract test over `endpoints`; `openapi.test.ts` diff reviewed |
| 9. CI/deploy contract | P5 (baselines in P1) | Workflow name/job ids unchanged; new jobs green or report-only first; thresholds not lowered |
| 10. Mixed changes, no baseline | P1 baseline, P3/P4 discipline | Before/after counts, manifest, and removed-test list in the PR |
| 11. Security hardening regressions | P4 | Positive-flow tests exist before refusal rules tighten; fence test; `deploy.sh` rehearsed |
| 12. Hooks/modes/CRLF | P1 policy, every phase | No `--no-verify`; `git ls-files -s` modes; no `\r` |
| 13. Docs drift / docs-rule violation | P3 sweep, P5 sync | Search for every removed path; no new files under `docs/` besides factual corrections |
| 14. Test-file split collisions | P3 | Integration job run twice back to back |
| 15. a11y suppression | P4 | axe E2E plus keyboard reorder unchanged |
| 16. Ignore files | P3 | Image builds |
| 17. Source-scanning tests | P3 | `password.test.ts`, `check-build.mjs`, shell budget vs baseline |
| 18. `braces` | P5 | Risk recorded, no failing gate |

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| P1 Baseline and evidence tooling | Starting deletions without a measured baseline; node_modules not installed so nothing has been run | Install, run everything once on untouched `main`, record numbers; configure the dead-code tool entries |
| P2 Test determinism | Masking; browser-only clock pins | Class-based fix table; TZ x instant loop; derive E2E from seed |
| P3 Evidence-gated removal | Config-reachable deletions; coverage dip; docs references | Three-part proof; owner-review list in `.planning/`; reference sweep |
| P4 Bug fixes | Wrong diagnosis; vacuous tests; lockouts | Reproduce first; red-green; positive-flow tests; minimal `deploy.sh` change |
| P5 CI enforcement and docs | Red job blocks deploy; rename breaks deploy; web coverage not enforced | Report-only first; no renames; decide web coverage explicitly |

## Research Flags for Planning

- **Needs deeper phase research:** P4 Kong/Caddy path enumeration (read the pinned GoTrue version's routes and `kong.yml`), P4 Supabase CLI password handling (verify on a throwaway stack), P2 E2E weekday strategy (there is no server clock seam; decide between seed-derived expectations and adding a seam, which is a behaviour change).
- **Standard patterns, low research need:** Knip configuration and entry lists, Vitest `toFake: ['Date']` usage, Zod default unwrapping, the generic PATCH contract test.
- **Verify before relying on:** `workbox-window` necessity, TanStack default dehydration of in-flight mutations, `commitlint` body line limit, whether `routes/users.ts` and `http/context.ts` actually hold a privileged client.

## Sources

**First-hand (repo at `224b93b`), HIGH:**
- `.planning/PROJECT.md`, `.planning/codebase/{CONCERNS,TESTING,STRUCTURE}.md`
- `.github/workflows/{ci,deploy}.yml`, `.github/dependabot.yml`, `commitlint.config.js`, `eslint.config.js`, `.gitattributes`, `.dockerignore`, `.prettierignore`, `.husky/*`
- `apps/web/vite.config.ts`, `apps/web/src/sw.ts`, `apps/web/scripts/check-build.mjs`, `apps/web/src/lib/offline/write-queue.ts`, `apps/web/src/lib/api/{deals,query-client}.ts`, `apps/web/src/screens/lists/ListDetailScreen.tsx`
- `apps/service/src/services/lists.ts`, `apps/service/src/openapi.ts`, `apps/service/tsup.config.ts`, `apps/service/bin/hearth-admin`, `docker/service.Dockerfile`
- `packages/shared/src/api/{bills,deals,lists,membership,contract}.ts`
- `e2e/playwright.config.ts`, `docs/testing.md`, `docs/file-map.md`, `scripts/deploy.sh`
- Git history: `1030b35`, `95b0bd2`, `b96ca32`

**External documentation via the research seam (seam tier LOW; cached in `.planning/research/.cache`):**
- Zod 4 changelog, defaults inside optional fields: https://zod.dev/v4/changelog (corroborated by repo history)
- Vitest `vi` API, `setSystemTime`/`useFakeTimers`: https://vitest.dev/api/vi.html (corroborated by repo usage)
- Knip entry files and handling issues: https://knip.dev/explanations/entry-files and https://knip.dev/guides/handling-issues
- Playwright network mocking, `Route`, and clock: https://playwright.dev/docs/mock, https://playwright.dev/docs/api/class-route, https://playwright.dev/docs/clock
- TanStack Query mutations, offline persistence and scopes: https://tanstack.com/query/latest/docs/framework/react/guides/mutations
- GitHub Actions `workflow_run`: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#workflow_run
- GitHub required status checks troubleshooting (the github.com URL returned 404; wording taken from Enterprise Server mirrors): https://docs.github.com/en/enterprise-server@3.19/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks
- Supabase CLI `migration repair`: https://supabase.com/docs/reference/cli/supabase-migration-repair

**Not verified (treat as hypotheses):** `workbox-window` necessity (sources conflict, `node_modules` absent), TanStack default dehydration scope, `config-conventional` body line limit, Supabase CLI behaviour with `PGPASSWORD`.

---
*Pitfalls research for: cleanup, test stabilization, and hardening of an LLM-generated TypeScript monorepo*
*Researched: 2026-10-11*
