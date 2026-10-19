---
phase: 02-baseline-net-stabilization-and-analysis
verified: 2026-10-19T15:10:00Z
status: passed
score: 10/11 must-haves verified
covered_files:
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-01-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-01-SUMMARY.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-02-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-02-SUMMARY.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-03-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-03-SUMMARY.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-04-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-04-SUMMARY.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-05-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-05-SUMMARY.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-06-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-06-SUMMARY.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-07-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-07-SUMMARY.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-08-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-08-SUMMARY.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-09-PLAN.md"
  - ".planning/phases/02-baseline-net-stabilization-and-analysis/02-09-SUMMARY.md"
  - "apps/service/src/bills.integration.test.ts"
  - "apps/service/src/test/zone-dates.test.ts"
  - "apps/service/src/test/zone-dates.ts"
  - "apps/service/vitest.config.ts"
  - "apps/service/vitest.coverage.config.ts"
  - "apps/service/vitest.integration.config.ts"
  - "apps/web/vite.config.ts"
  - "docs/file-map.md"
  - "docs/testing.md"
  - "e2e/playwright.config.ts"
  - "e2e/support/clock.test.ts"
  - "e2e/support/clock.ts"
  - "eslint.config.js"
  - "knip.json"
  - "package.json"
  - "packages/matching/vitest.config.ts"
  - "packages/recurrence/vitest.config.ts"
  - "packages/shared/vitest.config.ts"
  - "scripts/test-sweep.mjs"
  - "scripts/test-sweep.test.mjs"
  - "test/clock-setup.mjs"
  - "test/clock-setup.test.mjs"
  - "test/eslint-clock-ban.test.mjs"
  - "test/global-tz.mjs"
  - "test/global-tz.test.mjs"
  - "test/support/vitest-project.mjs"
  - "test/test-now.mjs"
covered_digest: "v3:sha256:ec0f808a76cbaf3774d9a2db98a4c84d926b6bad5de5846a89b2a065d34b9efe"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/10
  gaps_closed: []
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "E2E expectations are derived from seed data with no weekday assumptions (TIME-03)"
    test: "Run the CI test-e2e job (or the Playwright suite against the Compose stack) on a Saturday and a Sunday in the household zone, and once shortly after New York midnight"
    expected: "All 19 specs pass; specs 14, 15, 18 (seed-relative labels) and spec 19 (Saturday has no seeded dinner, so ensureDinnerOn plans one) behave the same as on a weekday"
    why_human: "The audit ledger (21 rows, 20 ok, 1 fixed, 0 owner) and the lint ban are static. Every test-e2e run on record happened on one household-zone weekday (a Monday evening or the Tuesday UTC date in October 2026; the latest, main at 4ebc90b, ran on Monday 2026-10-19). The owner DEFERRED the weekend run on 2026-10-13 (D-14, 02-UAT.md test 1: skipped, a deferred follow-up), so the truth stays unverified."
human_verification:
  - test: "Run test-e2e on a Saturday and a Sunday in New York, and once just after New York midnight"
    expected: "All 19 specs pass, including spec 19 on a Saturday and the seed-relative labels in specs 14, 15 and 18"
    why_human: "Only the CI stack runs the journeys; the Phase 6 matrix (TIME-06) covers unit and component tests only. Deferred by the owner (D-14); nothing waits on it."
---

# Phase 2: Baseline, Net Stabilization, and Analysis Verification Report

**Phase Goal:** The test suite passes deterministically on any weekday and household timezone, and a calibrated analyzer produces a triaged findings list, so removals can be attributed and trusted
**Verified:** 2026-10-19
**Status:** human_needed
**Re-verification:** Yes, on the final tree (the first report, 2026-10-13, was `human_needed`, 9/10; it had no `gaps:`, so every item was re-checked in full)

The code was verified in the primary checkout `/home/user/hearth` (session branch `claude/trusting-lovelace-y4r87h`, HEAD `03abfeb`). `git diff --stat origin/main HEAD -- . ':!.planning'` is empty, so the code equals `origin/main` `4ebc90b`. `node_modules` was installed there. Nothing was started or reset: Docker and the local Supabase stack were down and stayed down, so the integration checks rest on preserved logs and on CI, as stated per item below. `git status` was clean after every run (knip, lint, sweep, harness), and I modified no tracked file.

The earlier report's four non-E2E owner items are all resolved by the owner (D-13 to D-18, `02-UAT.md`: 4 pass, 1 skipped, 0 issues). The one open item is TIME-03 across weekdays, which the owner deferred. The status is therefore `human_needed`, not `passed`, and the orchestrator's verify-work step should canonicalize it from the UAT.

## What changed since the first report

Owner-merged pull requests on `main` after `e03142d`: #2 caddy 2.11.7 and a Dependabot ignore for Node majors (`149c5fe`); #5 root `vitest` 5.0.1 devDependency (`0608107`); #6 docs refresh (`2cff293`); #7 `fuzzy-benchmark.ts` removed (`d8f3daf`); #8 fixes for review warnings WR-01 to WR-05 (`4ebc90b`). I re-read the code at `4ebc90b` and re-ran the cheap checks; I did not copy conclusions from the first report.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 (BASE-01): typecheck, lint, test and build results on untouched `main` are recorded in `.planning/cleanup/`, showing which failures pre-exist | VERIFIED | `BASELINE.md` rows read directly: `test:integration` 426 tests, two runs, 0 failed; `test:coverage` 1142 tests, two runs; web suite 715 tests in 56 files, service 716 in 54; one pre-existing failure named (`favorites.test.tsx` "keeps the stale list with its as-of date rather than emptying"), failing in both runs and labelled `pre-existing`; nothing `flaky`. Integration 426 tests in 20 files and coverage 1142 in 74 files (716 unit + 426 integration, thresholds met) match the brief. The one stale environment line ("Docker: absent (path b)") noted in the first report is unchanged and still only an Info. |
| 2 | SC2 (TIME-01, TIME-02): unit and component tests pass under pinned dates and zones (weekday, weekend, UTC-negative, UTC-positive); the formerly failing web files are green; service and package suites pass the same sweep | VERIFIED | `node scripts/test-sweep.mjs --workspace all` on the final tree: `sweep: 36/36 passed`, 36 `result=PASS`, 0 `FAIL`, exit 0 (6 cells: default, Wed Tokyo, Sat-UTC/Fri-LA, Sun-UTC/Mon-Kiritimati, new-year Pago Pago, DST-start New York; 6 workspaces each). `--list` prints 6 unit cells and 5 integration cells (default, LA, Kiritimati, Pago Pago, Tokyo). `pnpm test:harness`: 167 tests, 167 pass, 0 fail, 0 skipped. Wiring read in all configs: `setupFiles: ['../../test/clock-setup.mjs']` and `globalSetup: ['../../test/global-tz.mjs']` in `apps/service/vitest.config.ts` and `vitest.coverage.config.ts`, `apps/web/vite.config.ts` (after `src/test-setup.ts`), and the three packages; `vitest.integration.config.ts` takes only the zone hook, by design (a comment says why: the Postgres clock cannot be pinned). Negative controls run now: `HEARTH_TEST_NOW=garbage` and `TZ=Mars/Olympus` both fail upfront with a clear message; `--only src/nope/none.test.tsx` exits 2 ("a sweep that runs nothing is not a pass"); `--only 'x;echo pwned'` exits 2. CI at `4ebc90b`: `test-unit` success. |
| 3 | SC3a (TIME-03): E2E expectations are derived from seed data with no weekday assumptions | PRESENT_BEHAVIOR_UNVERIFIED | Present and wired, re-checked: `e2e/support/clock.ts` (`currentInstant`, `dateInZone`, `hourInZone`, `addDays`; its one real-clock read carries a reasoned opt-out); specs 15, 16 and 19 import it; `grep -nE "[0-9]{4}-[0-9]{2}-[0-9]{2}" e2e/tests/*.ts` finds no calendar-date literal; `e2e/playwright.config.ts` has `timezoneId: 'America/New_York'` and `locale: 'en-US'`. `pnpm --filter @hearth/e2e test`: 15 of 15 pass. The 02-09 ledger (in `02-09-SUMMARY.md`) lists all 19 spec files, 21 rows, verdicts ok 20 / fixed 1 / owner 0. Spec 14's weekday-dependence is handled by a stated journey design (its comment at line 39). CI `test-e2e` is success at `4ebc90b`. But every run on record happened on one household-zone weekday, so no run exercises a Saturday, a Sunday, or New York midnight. The owner deferred the weekend run (D-14, `02-UAT.md` test 1 skipped). The truth is honestly unverified; it is not a failure, and nothing is scheduled that would close it. |
| 4 | SC3b (TIME-05): `bills.integration.test.ts` passes whether or not the UTC date and the household-zone date differ | VERIFIED | The file dates bills through `homeDate()` -> `householdDate(HOME_ZONE, n)` from `apps/service/src/test/zone-dates.ts`; `describe.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])` at line 559 is the guard, with a comment proving that the two zones' dates never both equal the UTC date at any hour. No bare `new Date()` or `Date.now` in any `*.integration.test.ts`. Preserved vitest JSON read now: `02-04-bills-red.json` is 36 tests, 34 passed, 2 failed (the Kiritimati "a bill anchored at the household's today is not overdue" guard and "a household bill due yesterday by the household's calendar is overdue"); `02-04-bills-green.json` is 36 passed, 0 failed, all four guard tests present and passing. Not re-run by me: Docker and Supabase were down and I was told not to start them. Green is corroborated by CI `test-integration` = success on main at `4ebc90b` (completed 13:16:30Z) and, per the first report, on four earlier commits. The integration zone sweep (5 cells) is likewise only in the preserved log `02-04-integration/` and CI. |
| 5 | SC4 (TIME-04): a bare `new Date()` or `Date.now()` in a test file or under `e2e/` fails lint | VERIFIED | `eslint.config.js`: a `no-restricted-syntax` block (lines 139-161) over `**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`, `e2e/**/*.ts`, `apps/service/src/test/**/*.ts`, `apps/web/src/test/**/*.{ts,tsx}`, `apps/web/src/test-setup.ts` and `test/**/*.mjs`, built from `CLOCK_READS` (16 selectors: `new Date()`, `new globalThis.Date()`, `new (Date as X)()`, `new Date(undefined)`, `void 0`, `...[]`, `Reflect.construct`, `Date()`, every `Date.now` spelling including destructuring) and `FORMATTER_READS` (zero-argument `Intl.DateTimeFormat().format()`). Probe (stdin file with `new Date()`, `Date.now()`, `globalThis.Date.now()`, `new Intl.DateTimeFormat('en-US').format()`): 4 `no-restricted-syntax` errors under each of `e2e/tests/16-...spec.ts`, `apps/web/src/screens/deals/favorites.test.tsx`, `apps/service/src/bills.integration.test.ts`, `apps/service/src/test/fake-app.ts`, `test/clock-setup.mjs` and `apps/web/src/test-setup.ts`; 0 under the production paths `apps/web/src/lib/format.ts`, `apps/service/src/services/bills.ts`, `apps/service/src/jobs/scheduler.ts`. `pnpm lint` (`eslint --max-warnings=0 .`): exit 0. Opt-outs: exactly four next-line `eslint-disable-next-line no-restricted-syntax -- <reason>` directives in source (`request-queue.test.ts` lines 27 and 174, `apps/service/src/test/zone-dates.ts` line 15, `e2e/support/clock.ts` line 12); the fifth hit, in `test/eslint-clock-ban.test.mjs`, is a string fixture. No file-level or block-level disable. The block replaces the service-role dynamic-import selector for test files, but that fence already `ignores` `*.test.ts` and `src/test/**`, so nothing is lost. The ban is a guard against common forms, not a proof, as its comment says. |
| 6 | SC5a (BASE-02): knip runs with explicit entry points, and planted canaries behave (known-dead reported, known-live not) | VERIFIED | `knip.json` read: entries for `sw.ts!`, `main.tsx!`, `index.html`, `cli.ts!`, `write-openapi.ts!`, `seed-users.ts`, the e2e `global-setup`/`global-teardown`/specs, package `src/index.ts!`, `common-passwords.ts!`, root `test/*.mjs!` and `scripts/test-sweep.mjs!`; no `ignore`, `ignoreFiles` or `ignoreDependencies` key (D-10). knip pinned at exactly `6.41.0`; the two scripts are report-only (`knip`, `knip:production`), no `--fix`. Canary evidence is the recorded `calibration-canary-*` and `calibration-*` summaries (the canaries lived on a deleted scratch branch; none is in the tree). I re-ran both modes on the final tree, exit 1 (findings reported) and `git status` clean. See "knip recount" below for the numbers. |
| 7 | SC5b (BASE-03): findings are triaged into proven-dead, config-gap, test-only and uncertain; the uncertain list goes to the owner | VERIFIED | `TRIAGE.md` `## Findings`: parsed 89 rows: proven-dead 6, test-only 19, config-gap 3, uncertain 61. `OWNER-CANDIDATES.md` has the Uncertain, Test-only and Proven-dead sections. The owner reviewed it and decided on 2026-10-13 (D-18, `02-UAT.md` test 2: pass). |
| 8 | SC5c (BASE-04): a jscpd duplication scan is recorded | VERIFIED | Recomputed from `.planning/cleanup/jscpd/*/jscpd-report.json` `statistics.total`: source-only 11 clones, 190 of 40,801 lines (0.4657%); test-inclusive 96 clones, 1,438 of 77,020 (1.867%); whole-repo (informational) 174 clones, 2,146 of 80,356 (2.67%). `TRIAGE.md` lines 262-263 and 391-392 record them, including the owner's D-13 baseline (test-inclusive: 96 clones, 85 test-involved, 1.87%). No jscpd dependency was added to `package.json`. |
| 9 | Derived: report-only, no behavior change. No production module changed, nothing weakened, no skipped or todo tests, no threshold changes | VERIFIED | `git diff --name-status 89eb558 origin/main -- . ':!.planning' ':!.claude' ':!docs'` read in full. Every path is a test, test helper (`apps/service/src/test/*`, `test/*`), vitest/vite/playwright/eslint config, `scripts/test-sweep*.mjs`, `knip.json`, `package.json`, lockfile, `e2e/*` or `e2e/support/clock*`, plus four owner-merged non-Phase-2 changes: `.github/dependabot.yml` (ignore Node major bumps), `docker/caddy.Dockerfile` (`caddy:2.11.4-alpine` to `2.11.7-alpine`, Dependabot PR #2 merged by the owner), `README.md` (docs, PR #6), `packages/matching/package.json` (remove `bench:fuzzy` script and the `tsx` devDependency, PR #7). One source file changed: `packages/matching/src/similarity.ts`, and the diff is a comment edit only (it dropped the reference to the deleted benchmark script); the code is byte-identical. One deletion outside `.planning`: `packages/matching/scripts/fuzzy-benchmark.ts` (owner decision D-16, PR #7). Added lines containing `.skip`, `.todo`, `.only`, `.fixme`, `xit(` or `xdescribe(`: 0 (the diff scan matched only `--only` option handling in `scripts/test-sweep.mjs`, which is not a test modifier). No threshold, statements, branches, lines or functions line changed in any vitest or vite config. `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` in the files changed since `89eb558`: 0. The harness itself reports `skipped 0, todo 0`. |
| 10 | Derived (plan 02-08): clock work and knip config reach `main` through owner-merged, green pull requests | VERIFIED | `02-08-SUMMARY.md` now exists (status complete): PR #3 squash `a23d038`, PR #4 squash `e03142d`, both merged by the owner, no force-push, six green jobs on each head. Follow-ups #5, #7, #8 are also owner merges. CI on `main` at `4ebc90b` read over the REST API (`commits/4ebc90b.../check-runs` and the Actions runs): `lint` success (13:10:30Z), `typecheck` success (13:10:24Z), `test-unit` success (13:13:32Z), `test-integration` success (13:16:30Z), `test-e2e` success (13:20:39Z), `build` success (13:09:56Z); the `CI` workflow run 39257756233 is `completed / success`. The `Deploy` run 39259346688 and the `deploy` check are `queued` on the unregistered self-hosted runner (expected, not a failure). A Dependabot update run was `in_progress` and is unrelated. |
| 11 | Derived (owner decision D-17): the five review warnings WR-01 to WR-05 are fixed with regression tests | VERIFIED | Each fix read in the code and exercised by the 167-test harness (`test/clock-setup.test.mjs`, `test/global-tz.test.mjs`, `scripts/test-sweep.test.mjs`, `test/eslint-clock-ban.test.mjs`, all passing). WR-01: `test/clock-setup.mjs` keeps a clock a suite installed in `beforeAll` or at module scope (`suiteClockInstalled`, `suiteClock` branch in `beforeEach`/`afterEach`) and re-pins after `vi.useRealTimers()`. WR-02: `--only` matching no file exits 2 (run now). WR-03: the ban covers the 16 `CLOCK_READS` selectors plus the formatter selectors, and the scope grew to `test/**/*.mjs`, `apps/*/src/test*` and `*.{test,spec}.*` of every extension (probes above). WR-04: the 167 harness tests, wired into `pnpm test` through the root `test:harness` script. WR-05: `TZ` and `HEARTH_TEST_NOW` validated upfront (negative controls run now). CI is green with these fixes. The review's eight info items stay open by owner choice (D-17); `02-REVIEW-DISPOSITION.md` records their disposition. |

**Score:** 10/11 truths verified (1 present, behavior-unverified: truth 3)

### knip recount (not a goal truth)

The brief expected 58 findings in default mode and 80 in production on the current tree. I counted by listing every `files`, `exports`, `types`, `devDependencies`, `unlisted`, `duplicates` entry in `knip --reporter json`:

| Mode | Recorded at `e03142d` (`.planning/cleanup/knip/*.json`, same method) | Final tree `4ebc90b` | Delta |
| --- | --- | --- | --- |
| default | 59 | **54** (exports 14, types 37, devDependencies 2, duplicates 1) | -5 |
| production | 80 | **79** (files 1, exports 40, types 37, duplicates 1) | -1 |

I could not reproduce 58 and 80; the exact differences, each tied to a cause:

- `unlisted test/clock-setup.mjs vitest`, in both modes (-1 default, -1 production): PR #5 declared `vitest`.
- `unlisted packages/matching/scripts/fuzzy-benchmark.ts fuse.js`, default only (-1): PR #7 deleted the script.
- Three `exports` in `apps/web/src/test/meal-fixtures.ts` (`currentWeekFixture`, `emptyWeekFixture`, `previousWeekFixture`), default only (-3): they are no longer reported. They are still unused (their names occur only in the defining file). The cause is the root `test:harness` script (`node --test ...`, added by PR #8): knip's Node.js plugin then treats `**/test/**/*.{cjs,mjs,js,cts,mts,ts}` as entry files, so `apps/web/src/test/*.ts` exports stop being analyzed (`--trace-export currentWeekFixture` now answers "No export currentWeekFixture found"). I confirmed it with a control experiment in a scratch copy of the tracked files (since removed): with the original root `package.json` the three rows are absent, and with only the `test:harness` script changed to `echo` they return and nothing else changes. This does not touch production mode, which excludes `src/test/**`.

The TRIAGE.md summary table (58 default, 79 production, "baseline config") and its combined-tree line (59 and 80) already differ from each other by one `unlisted` row; the recorded JSON gives 59 and 80.

Consequence for Phase 3, recorded as a warning: three of the six `proven-dead` rows (rows 4 to 6 of `TRIAGE.md`, the meal fixtures) cite "knip exports (default)" as tool evidence, but a fresh default knip run on `main` no longer reports them. Their evidence is the committed `.planning/cleanup/knip/default.json` plus the text search (0 hits), and Phase 3 must re-establish the tool evidence for those three (for example by running knip against a config without the `node --test` entry effect) before deleting them. Also, the `fuse.js`, `vitest` and benchmark rows in `TRIAGE.md` and `OWNER-CANDIDATES.md` are now resolved by D-15 and D-16.

### Plan 02-08 status

Complete. `02-08-SUMMARY.md` exists and records PRs #3 and #4 as owner-merged. `ROADMAP.md` in the primary checkout still shows Phase 2 as "In Progress" in the progress table (line 164) and the Phase 2 checkbox at line 16 unchecked, although the plan checkboxes are ticked and "9/9 plans executed" is written.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| BASE-01 | 02-01 | Baseline of typecheck, lint, test and build on untouched `main` | SATISFIED | Truth 1 |
| BASE-02 | 02-06, 02-07, 02-08 | knip with explicit entries, calibrated with canaries | SATISFIED | Truth 6; on `main` via PR #4 |
| BASE-03 | 02-07 | Findings triaged, uncertain list handed to the owner | SATISFIED | Truth 7 (owner decided, D-18) |
| BASE-04 | 02-07 | Duplication scan recorded | SATISFIED | Truth 8 (owner chose the test-inclusive baseline, D-13) |
| TIME-01 | 02-02, 02-08 | Global clock and zone pin; time-dependent web files fixed | SATISFIED | Truths 2 and 11 |
| TIME-02 | 02-03, 02-04, 02-08 | Service and package suites swept and fixed | SATISFIED | Truth 2 (unit 36/36 re-run); the integration 5-cell zone sweep rests on preserved logs and CI |
| TIME-03 | 02-05, 02-09, 02-08 | E2E expectations derived from seed data, no weekday assumptions | SATISFIED by audit; behavior across weekdays unverified | Truth 3 (owner deferred the weekend run, D-14) |
| TIME-04 | 02-05, 02-08 | Lint rule bans bare clock reads in tests and `e2e/` | SATISFIED | Truth 5 |
| TIME-05 | 02-04, 02-08 | Bills integration UTC-versus-household date flake fixed | SATISFIED | Truth 4 |

All nine IDs appear in the `requirements:` frontmatter of plans 02-01 to 02-09 (02-01: BASE-01; 02-02: TIME-01; 02-03: TIME-02; 02-04: TIME-02, TIME-05; 02-05: TIME-03, TIME-04; 02-06: BASE-02; 02-07: BASE-02, BASE-03, BASE-04; 02-08: TIME-01..05, BASE-02; 02-09: TIME-03). `REQUIREMENTS.md` maps exactly these nine IDs to Phase 2 and no other, so there are no orphaned requirements. TIME-06 is Phase 6 and correctly absent. `REQUIREMENTS.md` still shows all nine as unchecked and "Pending" (lines 19-30 and 109-117); the orchestrator should update that once it accepts the phase (TIME-03 with its caveat).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `test/clock-setup.mjs`, `test/test-now.mjs` | Global Date pin, `HEARTH_TEST_NOW` override, validation | VERIFIED | Read; wired into 7 configs; skips `*.integration.test.*` |
| `test/global-tz.mjs` | Zone validation hook | VERIFIED | Rejects `Mars/Olympus` (run now) |
| `scripts/test-sweep.mjs`, root `test:sweep`, `test:sweep:integration`, `test:harness` | 6 unit and 5 integration cells | VERIFIED | `--list` run; 36/36 sweep run |
| `test/*.test.mjs`, `scripts/test-sweep.test.mjs` | 167 harness tests | VERIFIED | 167 pass |
| `apps/service/src/test/zone-dates.ts` (+ test) | Zone-correct date helpers | VERIFIED | Used by `bills.integration.test.ts` and other integration files and `fake-app.ts` |
| `e2e/support/clock.ts` (+ test) | Household clock for E2E | VERIFIED | Used by specs 15, 16, 19; 15/15 node tests pass |
| `eslint.config.js` ban block | TIME-04 | VERIFIED | Truth 5 |
| `knip.json`, knip 6.41.0, `knip` scripts | BASE-02 | VERIFIED | Truth 6 |
| `.planning/cleanup/BASELINE.md`, `TRIAGE.md`, `OWNER-CANDIDATES.md`, `knip/`, `jscpd/` | BASE-01, 03, 04 | VERIFIED | Truths 1, 7, 8 |
| `docs/testing.md`, `docs/file-map.md` | Clock contract documented | VERIFIED | `testing.md` states the suite-level override contract and that `vi.useRealTimers()` re-pins (lines 78-83), closing the first report's Info about that gap |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Vitest configs (web, service x3, shared, recurrence, matching) | `test/clock-setup.mjs`, `test/global-tz.mjs` | `setupFiles`, `globalSetup` | WIRED | grep of all configs; integration config takes the zone hook only |
| `bills.integration.test.ts` and other integration files | `zone-dates.ts` | `currentInstant`, `householdDate`, `dateInZone` | WIRED | no bare clock read in `*.integration.test.ts` |
| E2E specs 15, 16, 19 | `e2e/support/clock.ts` | import | WIRED | grep shows the three imports |
| Playwright `use` | browser zone | `timezoneId`, `locale` | WIRED | config read; CI green |
| `knip.json` root entries | `test/*.mjs`, `scripts/test-sweep.mjs` | `entry` with `!` | WIRED | production run does not report them |
| `package.json` `test` | harness | `pnpm test:harness && pnpm -r test` | WIRED | harness runs inside `pnpm test` |

### Data-Flow Trace (Level 4)

Not applicable: the phase renders no dynamic data. The date helpers return values computed from an explicit instant or the process clock, traced in the zone-dates and clock unit tests.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Harness | `pnpm test:harness` | 167 tests, 167 pass, 0 fail, 0 skipped | PASS |
| Unit suites in all six cells | `node scripts/test-sweep.mjs --workspace all` | `sweep: 36/36 passed`, exit 0 | PASS |
| Matrix | `node scripts/test-sweep.mjs --list` | 6 unit + 5 integration cells | PASS |
| E2E helper tests | `pnpm --filter @hearth/e2e test` | 15 of 15 pass | PASS |
| Lint, including the ban | `pnpm lint` | exit 0 | PASS |
| Ban fires in tests and e2e, not in production | `eslint --stdin` with nine filenames | 4 errors in six test paths, 0 in three production paths | PASS |
| Negative controls | bad `TZ`, bad `HEARTH_TEST_NOW`, `--only` no match, `--only` with shell metacharacters | all fail upfront (non-zero) | PASS |
| knip both modes | `pnpm --silent knip --reporter json`, `knip:production` | 54 and 79 (see recount) | PASS (differs from brief, explained) |
| jscpd totals | recompute from three JSON reports | 11 / 96 / 174 clones | PASS |
| Bills integration file and integration sweep | needs the Supabase stack | stack down, not started by instruction | SKIP (preserved logs and CI `test-integration` success on main used) |

### Probe Execution

No probes are declared by the plans (no `probe-*.sh`); skipped.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| Phase 2 files | - | `TODO`, `FIXME`, `XXX`, `TBD`, `HACK` | none | scan of files changed since `89eb558` finds none |
| `test/clock-setup.mjs` | pin | `Function.prototype.toString.call(Date)` prints the pin, not `[native code]`; `Date.now` frozen but `performance.now()` real in `host-rate-limiter.test.ts` | Info | Both documented in the file header and in 02-03; the `>= 15` assertion is unchanged |
| `.planning/cleanup/TRIAGE.md` rows 4-6 | - | `proven-dead` tool evidence no longer reproducible on `main` | Warning (for Phase 3) | see "knip recount" |
| `.planning/cleanup/BASELINE.md` | Environment | "Docker: absent (path b)" | Info | stale line only; the table rows are correct |
| `.planning/cleanup/TRIAGE.md`, `OWNER-CANDIDATES.md` | - | still list the `fuse.js` and `vitest` unlisted rows and the deleted benchmark | Info | resolved by owner decisions D-15, D-16; Phase 3 should skip them |

### Judgement on the recorded deviations

| Deviation (where recorded) | Intent | Judgement |
| --- | --- | --- |
| Subclass-safe `Date` pin instead of `vi.setSystemTime` (02-02 Deviation 1) | D-01: a global pin that tests can override locally, no blanket `useFakeTimers()` | Met and justified, and it is now better covered. The WR-01 fix makes suite-level overrides work and `testing.md` documents both the cost (`vi.getMockedSystemTime()` is `null`) and the `vi.useRealTimers()` re-pin. The 36/36 sweep passes under the pin in every cell, including negative-offset zones where `vi.setSystemTime` broke `TZDate`. |
| Literal verify clauses that could not match (02-02 `TZ = 'America/New_York'` grep and `vi.setSystemTime(` count; 02-03 `vi.useRealTimers()` in the rate-limiter test; 02-05 six opt-outs in four files; 02-04 "Supabase is stopped"; 02-07 pipe-parsing verify; 02-01 regex) | Each clause served a truth that the SUMMARY shows met another way | Accepted. Each mismatch has a concrete cause (strict-TS `process.env['TZ']`, the pin design, an earlier plan removing the offender, the orchestrator forbidding a stack stop, a Markdown pipe, a malformed regex). I re-checked the substance of the ones that bear on the goal: four opt-outs in three files (counted above), pin wiring, and zone validation. No assertion was weakened. |
| Spec 15 literal `2026-12-01` replaced although it is an input (02-09 Deviation 2) | Prevents the new errand rendering overdue after that date | Accepted; the date literal scan of `e2e/tests` is now empty |
| Roadmap SC1 says "the 7 failing time-dependent web test files" | Show which failures pre-exist | The baseline is honest: at the real clock only one file failed (`favorites`); the other six failed only at UTC-11 or under pinned instants. The goal is unaffected. |

### Human Verification Required

#### 1. E2E on a different weekday (TIME-03), deferred by the owner

**Test:** Run the CI `test-e2e` job (or the Playwright suite locally against the Compose stack) on a Saturday and a Sunday in New York, and once just after New York midnight.
**Expected:** All 19 specs pass, in particular spec 19 on a Saturday (no seeded dinner, so `ensureDinnerOn` plans one) and the seed-relative labels in specs 14, 15 and 18.
**Why human:** Only the CI stack can run the journeys. The owner decided on 2026-10-13 to ignore the weekend run for now (D-14; `02-UAT.md` test 1 `skipped`, listed under Deferred Follow-Ups). The weekend of 2026-10-17/18 produced no `ci.yml` run (checked in the UAT on 2026-10-19), and the Phase 6 matrix covers unit and component tests only. This is the single open item; nothing waits on it.

The four other items from the first report are resolved and need no action: the candidate list (D-18), the jscpd baseline (D-13), `vitest` declared (D-15, PR #5) and the benchmark script (D-16, PR #7).

### Notes (advisory, not gaps)

1. **Deploys are queued.** The `Deploy` run for `4ebc90b` (39259346688) is `queued` on the self-hosted `hearth` runner, which is not registered. Phase 2 and its follow-ups changed no production module (only a comment in `similarity.ts`), and the caddy 2.11.7 bump is a deliberate owner merge. The owner should know a deploy waits.
2. **Security audit** (`02-SECURITY.md`): 36 of 36 threats closed, `threats_open: 0`, ASVS 1. Its Open Observations are non-blocking and are not Phase 2 gaps: no branch protection on `main` (the "never push `main`" control rests on process, and `CONTRIBUTING.md` says protection is not yet configured), a pre-Phase-2 force-push to `main` (`0c79874` to `89eb558`, 2026-10-12T21:55Z, by the owner's account, `d3da748` stayed an ancestor), self-reported consent evidence, the session branch on `origin` (planning documents only), and the audit's own limits (it did not run ESLint, the unit suites or Docker; I did run lint, the harness and the sweep here).
3. **Validation** (`02-VALIDATION.md`): `validated`, partial. TIME-01 to TIME-05 have automated checks that I re-ran or that CI ran; BASE-01 to BASE-04 are manual-only records, which I verified by inspection and recomputation above.
4. **What I did not run:** the integration suite and the 5-cell integration zone sweep (Docker and Supabase down, not started by instruction), the Playwright journeys (need the Compose stack), `pnpm typecheck`, `pnpm build` and the full `pnpm test`. For these I rely on the preserved logs under `.planning/cleanup/logs/` (gitignored, present in this checkout) and on CI at `4ebc90b`: all six jobs `success`.
5. **Bookkeeping left for the orchestrator:** check BASE-01..04 and TIME-01..05 in `REQUIREMENTS.md` (traceability table to Complete, with TIME-03's deferred weekend run noted); mark Phase 2 complete in `ROADMAP.md` (line 16 and the progress table row at line 164); remove the stale local worktrees when ready.

### Gaps Summary

No gaps. The phase goal is achieved in what exists now. On the final tree the unit and component suites pass in all six pinned date and zone cells (36/36, re-run here) and in CI. The 167-test harness passes. Bare clock reads in tests and under `e2e/` fail lint (probed in six test paths, absent in three production paths), with exactly four reasoned opt-outs. The bills integration flake is fixed behind a guard that failed twice on the UTC helper and passes with the fix (preserved red and green logs, and CI `test-integration` green on `main`). A calibrated knip run and a jscpd scan produce an 89-row triage that the owner has reviewed. All six CI jobs are green on `main` at `4ebc90b`. Nothing outside tests, test tooling and config was changed by the phase; the only source edit is a comment. The status is `human_needed` rather than `passed` because one truth, E2E independence from the weekday, was audited and wired but has never been run on another weekday; the owner deferred that run, so it stays honestly unverified.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
