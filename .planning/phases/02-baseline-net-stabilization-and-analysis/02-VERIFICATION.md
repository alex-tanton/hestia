---
phase: 02-baseline-net-stabilization-and-analysis
verified: 2026-10-13T03:10:00Z
status: human_needed
score: 9/10 must-haves verified
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
  - "e2e/support/clock.ts"
  - "eslint.config.js"
  - "knip.json"
  - "package.json"
  - "packages/matching/vitest.config.ts"
  - "packages/recurrence/vitest.config.ts"
  - "packages/shared/vitest.config.ts"
  - "scripts/test-sweep.mjs"
  - "test/clock-setup.mjs"
  - "test/global-tz.mjs"
covered_digest: "v3:sha256:8163c8e341adf77a5936af0688dde44675eb74034bf3d5dcb2063d7ac86a4f4c"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "E2E expectations are derived from seed data with no weekday assumptions (TIME-03)"
    test: "Run the CI test-e2e job (or the Playwright suite against the Compose stack) on a Saturday and a Sunday in the household zone, and once shortly after New York midnight"
    expected: "All 19 specs pass; specs 14, 15, 18 (seed-relative labels) and spec 19 (Saturday has no seeded dinner, so ensureDinnerOn plans one) behave the same as on a weekday"
    why_human: "The audit (ledger of 21 rows, 20 ok, 1 fixed, 0 owner) and the lint ban are static. Every CI test-e2e run on record (PR 3, PR 4, main at a23d038 and e03142d) happened on the same household-zone day (Monday 2026-10-12 evening in New York, Tuesday 2026-10-13 UTC), so no run exercised another weekday."
human_verification:
  - test: "Run test-e2e on a Saturday and a Sunday in New York, and once just after New York midnight"
    expected: "All 19 specs pass, including spec 19 on a Saturday and the seed-relative labels in specs 14, 15 and 18"
    why_human: "Only the CI stack runs the journeys, and every run on record was on one day; the Phase 6 matrix covers unit tests only"
  - test: "Review .planning/cleanup/OWNER-CANDIDATES.md (61 uncertain, 11 standing, 19 test-only, 6 proven-dead)"
    expected: "Keep or may-go for each item before Phase 3 removes anything"
    why_human: "The hand-off list is the owner decision (BASE-03, DEAD-06)"
  - test: "Choose the jscpd baseline Phase 5 compares against: source-only (11 clones, 0.47%) or test-inclusive (96 clones, 1.87%)"
    expected: "A decision recorded before Phase 5 plans RED-03"
    why_human: "D-12 names source-only, but RED-03 is about test fixtures, which that scan excludes"
  - test: "Decide whether to declare vitest in the root package.json"
    expected: "test/clock-setup.mjs imports vitest and works only through hoisting; knip reports it as unlisted"
    why_human: "A dependency change outside the report-only scope of Phase 2"
  - test: "Keep or delete packages/matching/scripts/fuzzy-benchmark.ts"
    expected: "The script no longer runs as committed (fuse.js is not a dependency)"
    why_human: "DEAD-06 reserves candidates tooling cannot prove dead for the owner"
---

# Phase 2: Baseline, Net Stabilization, and Analysis Verification Report

**Phase Goal:** The test suite passes deterministically on any weekday and household timezone, and a calibrated analyzer produces a triaged findings list, so removals can be attributed and trusted
**Verified:** 2026-10-13
**Status:** human_needed
**Re-verification:** No, initial verification

The code was verified against `/home/user/hearth-knip` (branch `chore/knip-config` at `3c0fe6b`). While this verification ran, the owner squash-merged PR #4, so `origin/main` is now `e03142d` and its tree (`81ca3440...`) is byte-identical to the tree verified (`git rev-parse e03142d^{tree} 3c0fe6b^{tree}` gives the same hash; `git diff --stat 3c0fe6b origin/main` is empty). Everything below that was checked in that tree therefore holds for `main`. The primary checkout (`claude/trusting-lovelace-y4r87h`) predates the phase code and was not used for code checks. The covered-input fingerprint was computed against the verified tree (`--project-dir /home/user/hearth-knip`), because the implementation files do not exist in the primary checkout; the phase documents are byte-identical in both trees.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 (BASE-01): typecheck, lint, test and build results on untouched `main` are recorded in `.planning/cleanup/`, showing which failures pre-exist | VERIFIED | `BASELINE.md` is measured on a detached `d3da748`, Node 24.21.0, two full runs. Real numbers, not placeholders: web 714 passed / 1 failed (715 tests, 56 files), service 716, shared 148, recurrence 77, matching 156, e2e-unit 6; integration 426 tests in 20 files; coverage run 1142 tests in 74 files with thresholds met (96.77 / 86.55 / 98.07 / 98.66). The single pre-existing failure is named (`favorites.test.tsx` "keeps the stale list with its as-of date rather than emptying") and labelled `pre-existing`; nothing is `flaky`. The seven time-dependent web files are tabulated across two runs and four zones. Integration and coverage rows are local counts (path a), cross-checked against CI runs 38206071791 and 38254024046. |
| 2 | SC2 (TIME-01, TIME-02): unit and component tests pass under pinned dates and zones (weekday, weekend, UTC-negative, UTC-positive); the seven formerly failing web files are green; service and package suites pass the same sweep | VERIFIED | I re-ran `node scripts/test-sweep.mjs --workspace all` in the verified tree: `sweep: 36/36 passed`, 36 `result=PASS`, 0 `FAIL` (six cells: default, Wed Tokyo, Sat-UTC/Fri-LA, Sun-UTC/Mon-Kiritimati, new-year Pago Pago, DST-start New York; six workspaces each). `favorites.test.tsx` alone: 9/9 pass (it was the one failure on untouched main). `test/clock-setup.mjs` and `test/global-tz.mjs` are wired into every workspace config (web `vite.config.ts`; service `vitest.config.ts`, `vitest.coverage.config.ts`; shared, recurrence, matching; the integration config takes the zone hook only, by design). CI `test-unit` is green on PR 3, PR 4 and main at `a23d038` and `e03142d`. |
| 3 | SC3a (TIME-03): E2E expectations are derived from seed data with no weekday assumptions | PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: `e2e/support/clock.ts` (household-zone helpers, `node:test` straddle cases), specs 16 and 19 take their dates from it, spec 15's `2026-12-01` literal is replaced, `e2e/playwright.config.ts` pins `timezoneId: 'America/New_York'` and `locale: 'en-US'`. A scan of `e2e/tests` finds no calendar-date literal and no weekday logic besides the Saturday-aware `ensureDinnerOn` in spec 19. No server clock seam was added (D-05). All four CI `test-e2e` runs pass, but they all ran on one household-zone day, so no run exercises a different weekday. See Human Verification item 1. |
| 4 | SC3b (TIME-05): `bills.integration.test.ts` passes whether or not the UTC date and the household-zone date differ | VERIFIED | The file dates bills through `householdDate('America/New_York', n)` (`homeDate`), and `describe.each(['Pacific/Kiritimati','Pacific/Pago_Pago'])` is the guard (two tests per zone). Preserved vitest JSON: red `02-04-bills-red.json` is 36 tests, 34 passed, 2 failed (the Kiritimati "today is not overdue" guard test and the "household bill due yesterday" test) with the UTC-calendar helper; green `02-04-bills-green.json` is 36 passed, 0 failed, all four guard tests present. I checked the guard's logic independently over all 24 UTC hours on three dates: there is no hour at which the UTC date equals both zones' dates, so the guard bites at any run time. Green is corroborated by CI `test-integration` success on PR 3, PR 4 and both `main` pushes. Not re-run by me: Docker and the Supabase stack were unreachable in this session (port 54322 refused), so the red and green results rest on the preserved logs and CI. |
| 5 | SC4 (TIME-04): a bare `new Date()` or `Date.now()` in a test file or under `e2e/` fails lint | VERIFIED | `eslint.config.js` block with `no-restricted-syntax` over seven globs. Piping `new Date(); Date.now();` to `eslint --stdin` under seven filenames gives 2 errors under each of `e2e/tests/16-...spec.ts`, `favorites.test.tsx`, `bills.integration.test.ts`, `apps/service/src/test/fake-app.ts` and `test/clock-setup.mjs`, and 0 under production modules `apps/web/src/lib/format.ts` and `apps/service/src/services/bills.ts`. The service-role fence selector still fires on `import('../privileged/...')`. Full `eslint . --max-warnings=0 --no-cache` on the verified tree exits 0. Opt-outs are exactly four next-line directives, each with a reason (`request-queue.test.ts` x2, `zone-dates.ts`, `e2e/support/clock.ts`); no file-level or block-level disable. |
| 6 | SC5a (BASE-02): knip runs with explicit entry points, and planted canaries behave (known-dead reported, known-live not) | VERIFIED | `knip.json` declares `sw.ts!`, `seed-users.ts`, `global-setup.ts`, `global-teardown.ts`, `cli.ts`, the package entries and `common-passwords.ts`, and has no `ignore`, `ignoreFiles` or `ignoreDependencies` key (D-10). knip is exact-pinned at `6.41.0`. I re-ran both modes in the verified tree: default 59 findings, production 80, matching TRIAGE.md's combined-tree totals; `git status` stayed clean. The canary summaries show dead file `knip-canary-orphan.ts` (both modes), dead export `KNIP_CANARY_UNUSED_EXPORT` (both), unused dependency `fastest-levenshtein` (both), and the test-only export `knipCanaryTestOnly` absent in default and reported in production. None of the nine known-live entry files is on a `files` line in either summary. The canaries lived on a deleted scratch branch; none is in the tree. |
| 7 | SC5b (BASE-03): findings are triaged into proven-dead, config-gap, test-only and uncertain; the uncertain list goes to the owner | VERIFIED | `TRIAGE.md` `## Findings` has 89 rows: I counted proven-dead 6, test-only 19, config-gap 3, uncertain 61, and 89 rows in total, each with tool evidence and text-search evidence columns. Bucket rules and precedence are written down. `OWNER-CANDIDATES.md` has 61 uncertain entries (each with mechanism, evidence and one question) plus the D-10 standing list of 11 entries, the test-only table and the proven-dead names. The three config-gap rows are real: root entries `test/*.mjs!` and `scripts/test-sweep.mjs!` are in `knip.json`. The list reached the owner by way of the merged PR #4; the owner reading it is Human Verification item 2. |
| 8 | SC5c (BASE-04): a jscpd duplication scan is recorded | VERIFIED | The raw reports are in `.planning/cleanup/jscpd/`. I recomputed `statistics.total` from the JSON: source-only 11 clones, 190 of 40,801 lines (0.4657%); test-inclusive 96 clones, 1,438 of 77,020 (1.867%); whole-repo (informational) 174 clones, 2.67%. These match the TRIAGE.md baseline lines (11 / 0.47% and 96 / 1.87%, 85 test-involved). Exact commands are recorded; nothing was added to `package.json` for jscpd. |
| 9 | Derived: report-only, no behavior change. Nothing deleted, no production code changed, no skipped or weakened tests | VERIFIED | `git diff --name-status d3da748 origin/main -- . ':!.planning' ':!.claude' ':!docs'`: the only non-test paths are ignore files, test helpers (`apps/service/src/test/*`), vitest/vite/playwright/eslint configs, `e2e/package.json`, `e2e/support/clock.ts`, `scripts/test-sweep.mjs`, `test/*.mjs`, root `package.json`, `knip.json` and the lockfile. No deletion outside `.planning`. Added `.skip`, `.todo`, `.only`, `.fixme`: 0 (diff scan). No threshold, statements, branches, lines or functions line changed in any vitest or vite config. Reviewed assertion edits: expected strings stay literals (viewer-zone pin in four web files), the host-rate-limiter assertion `>= 15` is unchanged, `schemas.test.ts` swaps a now-relative fixture for a literal ISO string the schema only shape-checks. No `docs/` file besides `testing.md` and `file-map.md` changed, and no ADR or decision-log file exists. |
| 10 | Derived (plan 02-08): clock work and knip config reach `main` through owner-merged pull requests, green | VERIFIED | PR #3 (clock) squash-merged by the owner at 02:14:57Z into `a23d038`; PR #4 (knip) squash-merged by the owner at 02:37:22Z into `e03142d`. Both had six green CI jobs on their heads (lint, typecheck, test-unit, test-integration, test-e2e, build). CI on `main` at `a23d038` is success. CI on `main` at `e03142d` (run 38337755744) is success, all six jobs. The executor merged neither; no force-push is recorded on the work branches. PR #4 touches outside `.planning/` exactly `docs/file-map.md`, `knip.json`, `package.json`, `pnpm-lock.yaml`; no path under `.claude/`, `.github/`, `supabase/migrations/`, `docker/` or `logs/`. |

**Score:** 9/10 truths verified (1 present, behavior-unverified: truth 3)

### Plan 02-08 status

The brief expected plan 02-08 to be "complete except the owner's squash of PR #4". That squash has since happened (02:37:22Z). What is left of 02-08 is bookkeeping only: there is no `02-08-SUMMARY.md`, and `ROADMAP.md` still shows 8/9 and the Wave 8 box unchecked. The deliveries that depended on the squash (the knip config reaching `main`) are therefore delivered, not pending.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| BASE-01 | 02-01 | Baseline of typecheck, lint, test and build on untouched `main` | SATISFIED | Truth 1 |
| BASE-02 | 02-06, 02-07, 02-08 | knip with explicit entries, calibrated with canaries | SATISFIED | Truth 6; on `main` via PR #4 |
| BASE-03 | 02-07 | Findings triaged, uncertain list handed to the owner | SATISFIED | Truth 7 (owner review pending, item 2) |
| BASE-04 | 02-07 | Duplication scan recorded | SATISFIED | Truth 8 (which baseline Phase 5 uses is the owner's call, item 3) |
| TIME-01 | 02-02, 02-08 | Global clock and zone pin; seven web files fixed | SATISFIED | Truth 2 |
| TIME-02 | 02-03, 02-04, 02-08 | Service and package suites swept and fixed | SATISFIED | Truth 2 (unit, 36/36 re-run); integration 5/5 zone sweep is in the preserved log `02-04-integration/summary.txt`, not re-run |
| TIME-03 | 02-05, 02-09, 02-08 | E2E expectations derived from seed data, no weekday assumptions | SATISFIED by audit; behavior across weekdays unverified | Truth 3 (item 1) |
| TIME-04 | 02-05, 02-08 | Lint rule bans bare clock reads in tests and `e2e/` | SATISFIED | Truth 5 |
| TIME-05 | 02-04, 02-08 | Bills integration UTC-versus-household date flake fixed | SATISFIED | Truth 4 |

All nine IDs appear in plan frontmatter (`requirements:` of 02-01 through 02-09). `REQUIREMENTS.md` maps no other ID to Phase 2, so there are no orphaned requirements. TIME-06 (CI date matrix) is Phase 6 and is correctly absent. `REQUIREMENTS.md` in the primary checkout still shows all nine as unchecked and "Pending"; the orchestrator should update it.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `test/clock-setup.mjs` | Global Date pin, `HEARTH_TEST_NOW` override | VERIFIED | 79 lines, substantive; wired into 7 configs. Skips `*.integration.test.*`. |
| `test/global-tz.mjs` | TZ validation hook | VERIFIED | Fails a bad zone (negative control recorded in 02-02: `Mars/Olympus` exits non-zero). |
| `scripts/test-sweep.mjs`, root `test:sweep`, `test:sweep:integration` | Six unit and five integration cells | VERIFIED | `--list` prints 6 and 5 cells; my 36-run passed. |
| `apps/service/src/test/zone-dates.ts` (+ test) | Zone-correct date helpers | VERIFIED | Used by `bills.integration.test.ts` and seven other integration files. |
| `e2e/support/clock.ts` (+ test) | Household clock for E2E | VERIFIED | Used by specs 16 and 19 and spec 15. |
| `eslint.config.js` ban block | TIME-04 | VERIFIED | Truth 5. |
| `knip.json`, knip 6.41.0 pin, `knip` scripts | BASE-02 | VERIFIED | Truth 6. |
| `.planning/cleanup/BASELINE.md`, `TRIAGE.md`, `OWNER-CANDIDATES.md`, `knip/`, `jscpd/` | BASE-01, 03, 04 | VERIFIED | Truths 1, 7, 8. `BASELINE.md`, `TRIAGE.md`, `OWNER-CANDIDATES.md` are byte-identical in both trees. |
| `docs/testing.md`, `docs/file-map.md` | Document the clock contract | VERIFIED | Sixteen matches for the clock terms in `testing.md`; `test/` and `knip.json` rows in `file-map.md`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Vitest configs (web, service x3, shared, recurrence, matching) | `test/clock-setup.mjs`, `test/global-tz.mjs` | `setupFiles`, `globalSetup` | WIRED | grep of all configs |
| `bills.integration.test.ts` and 7 integration files | `zone-dates.ts` | `currentInstant`, `householdDate`, `dateInZone` | WIRED | Bare-clock check over `*.integration.test.ts` reports nothing |
| E2E specs 15, 16, 19 | `e2e/support/clock.ts` | import | WIRED | Spec 19 uses `reminderDay(currentInstant())` |
| Playwright `use` | browser zone | `timezoneId`, `locale` | WIRED (config inspection; CI green) | |
| `knip.json` root entries | `test/*.mjs`, `scripts/test-sweep.mjs` | `entry` with `!` | WIRED | Production run does not report them |
| `package.json` `test:sweep` | `scripts/test-sweep.mjs` | script | WIRED | |

### Data-Flow Trace (Level 4)

Not applicable: the phase renders no dynamic data. The test helpers return values computed from an explicit instant or the process clock, traced in the zone-dates unit tests (9 tests, explicit instants).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Unit suites pass in all six cells | `node scripts/test-sweep.mjs --workspace all` | `sweep: 36/36 passed`, exit 0 | PASS |
| Previously failing test passes | `vitest run src/screens/deals/favorites.test.tsx` (apps/web) | 9 passed | PASS |
| Lint, including the ban, over the whole tree | `eslint . --max-warnings=0 --no-cache` | exit 0 | PASS |
| Ban fires in tests and e2e, not in production | `eslint --stdin` with seven filenames | 2 errors in five test paths, 0 in two production paths | PASS |
| knip default / production | `pnpm knip --reporter json`, `pnpm knip:production --reporter json` | 59 and 80 findings, matching TRIAGE.md | PASS |
| jscpd totals | recompute from the three JSON reports | 11 / 96 / 174 clones | PASS |
| Guard bites at every hour | 24-hour simulation of Kiritimati and Pago Pago dates against UTC | no hour where all three agree | PASS |
| Bills integration file, integration sweep | needs the Supabase stack | stack unreachable in this session | SKIP (preserved logs and CI used) |

### Probe Execution

No probes are declared by the plans (no `probe-*.sh`); skipped.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| Phase 2 files (test, e2e, config, `knip.json`, docs) | - | `TODO`, `FIXME`, `XXX`, `TBD` | none | Scan of the new and changed files finds none |
| `test/clock-setup.mjs` | 42 | `globalThis.Date.now()` | Info | Legitimate (the pin's own read) and not matched by the ban's selector, which matches `Date.now` on a bare `Date` identifier only. Also not matched: `new Date(undefined)`. The ban is a guard against the common forms, not a proof. |
| `apps/service/src/recipes/host-rate-limiter.test.ts` | real-sleep test | `performance.now()` replaces `Date.now()` | Info | The `>= 15` assertion is unchanged and the default sleep still has to wait, but the limiter's default `now` stays the frozen pinned `Date.now`, so the test no longer shows that the default clock advances with real time. Reason recorded in 02-03. |
| `docs/file-map.md` | 176 | "Phase 3 removes only what knip ..." | Info | A milestone phase name in a source-of-truth doc will go stale; candidate for RED-05. |
| `docs/testing.md` | clock section | No note that `vi.useRealTimers()` does not unpin the Date | Info | Discovered in 02-03 (cost a failed attempt); a test author will hit it again. Candidate for RED-05. |
| `BASELINE.md` | Environment | "Docker: absent (path b)" | Info | Stale: the Integration section and result table were later re-measured locally (path a). The rows are correct, the one environment line is not. |

### Judgement on the recorded deviations

| Deviation (where recorded) | Intent | Judgement |
| --- | --- | --- |
| Subclass-safe `Date` pin instead of `vi.setSystemTime` (02-02 Dev. 1) | D-01: a global pin that tests can override locally, no blanket `useFakeTimers()` | Met, and justified. `vi.setSystemTime` at module scope made `@date-fns/tz`'s `TZDate` answer in the machine zone in every negative-offset zone, which the sweep reproduced (3/6 cells failed). The pin follows a local `vi.setSystemTime` and fake timers, is re-installed per test, and skips integration files. Cost: `vi.getMockedSystemTime()` is `null` and `vi.useRealTimers()` does not unpin (see the docs note above). |
| Literal verify clauses unmet: `grep "TZ = 'America/New_York'"` (02-02), `vi.setSystemTime(` count in the pin (02-02), `vi.useRealTimers()` in the rate-limiter test (02-03), six opt-outs in four files (02-05), "Supabase is stopped" (02-04), 02-07 pipe-parsing verify, 02-01 regex | Each clause served a truth that the SUMMARY shows met another way | Accepted. Each mismatch has a concrete cause (strict-TS `process.env['TZ']`, the pin design, an earlier plan already removing the offender, the orchestrator forbidding stack stop, a Markdown pipe, a malformed regex) and none was papered over with a contrived line. No assertion was weakened to get a pass. |
| Spec 15 literal `2026-12-01` replaced although it is an input, not an expectation (02-09 Dev. 2) | Prevents the new errand rendering overdue after that date | Accepted; easily reverted if the owner prefers (3 lines). |
| Roadmap SC1 says "the 7 failing time-dependent web test files" | Show which failures pre-exist | The baseline is honest: on untouched `main` at the real clock only 1 file fails (`favorites`). Three fail only at UTC-11 and three only under pinned instants (a pin artifact, fixed by the pin design). The premise of "7 failing" came from research sweeps at pinned instants, not from the baseline. The goal is unaffected. |

### Human Verification Required

#### 1. E2E on a different weekday (TIME-03)

**Test:** Run the CI `test-e2e` job (or the Playwright suite locally against the Compose stack) on a Saturday and a Sunday in New York, and once just after New York midnight.
**Expected:** All 19 specs pass. In particular spec 19 on a Saturday (no seeded dinner, planned through the API) and the seed-relative labels in specs 14, 15 and 18.
**Why human:** Only the CI stack can run the journeys, and every run on record happened on one day. The Phase 6 matrix (TIME-06) covers unit and component tests, not E2E, so nothing scheduled will exercise this. A single weekend-day run of `test-e2e` closes it.

#### 2. Review the owner candidate list (BASE-03)

**Test:** Read `.planning/cleanup/OWNER-CANDIDATES.md` (61 uncertain items, the 11 D-10 standing items, 19 test-only, 6 proven-dead).
**Expected:** For each item, keep or may-go. Phase 3 will treat only the 6 proven-dead as removable on tooling evidence.
**Why human:** The list is the hand-off; only the owner can decide. 61 of 89 rows are uncertain because package public-surface exports and the `jobs/index.ts` barrel lines were forced there by rule. If `packages/*` is considered internal-only, many of the 18 unused `@hearth/shared` types become removal candidates by the owner's decision.

#### 3. Which jscpd figure Phase 5 compares against (BASE-04)

**Test:** Choose between the source-only baseline (11 clones, 0.47%, per D-12) and the test-inclusive baseline (96 clones, 1.87%, 85 test-involved).
**Expected:** A decision recorded before Phase 5 plans RED-03.
**Why human:** RED-03 and Phase 5 criterion 3 are about duplicated test fixtures, which the source-only scan excludes by design. Both are recorded at identical thresholds, so either can be re-run unchanged.

#### 4. `vitest` is not declared in the root `package.json`

**Test:** Decide whether to add `vitest` (exact version) to the root devDependencies.
**Expected:** `test/clock-setup.mjs` imports `vitest` and works only through pnpm hoisting; knip reports it as unlisted.
**Why human:** It is a dependency change outside Phase 2's report-only scope; the owner or Phase 3 decides.

#### 5. `packages/matching/scripts/fuzzy-benchmark.ts`

**Test:** Keep or delete.
**Expected:** The script cannot run as committed (`fuse.js` is not a dependency on `d3da748` either). It is a D-10 standing-list item, so it was neither fixed nor deleted.
**Why human:** DEAD-06 reserves it for the owner.

### Notes (advisory, not gaps)

1. **Deploys are queued.** Pushes to `main` trigger the `Deploy` workflow: the run for `a23d038` is `queued` and the one for `e03142d` is `pending` on the self-hosted `hearth` runner. Phase 2 changed no production module, so a deploy is behavior-neutral, but the owner should know a deploy is waiting.
2. **Phase 1's "planning files absent from `main`" no longer holds, deliberately.** `89eb558` ("docs: track gsd planning and cloud setup for phase 2") added `.planning/` and `.claude/CLAUDE.md` to `main` (66 paths; 73 at `a23d038`; 94 at `e03142d`), and plan 02-08's own truths allow those paths on the branches. The activity feed also shows a `force_push` to `main` (`0c79874 -> 89eb558`) at 2026-10-12T21:55Z by the owner's account, before the Phase 2 plans were written; `d3da748` stayed an ancestor. This is outside Phase 2's scope, and the Phase 1 report's "no force-push" finding concerned the 13:12Z publish, which is unchanged. Recorded so the owner is not surprised.
3. **Plan 02-04 left the Supabase stack running and un-reset**, because the orchestrator forbade stopping it. The integration tests roll back their own transactions, and all runs passed.
4. **The integration zone sweep (`--suite integration`, 5/5) and the 1155-test coverage run** (75 files, thresholds unchanged) are evidenced by preserved logs and by CI `test-integration` on four commits; I did not re-run them (no Docker daemon in this session).
5. **Bookkeeping left for the orchestrator:** write `02-08-SUMMARY.md`; mark 02-08 and Phase 2 complete in `ROADMAP.md` (it still reads 8/9, "In Progress"); check BASE-01..04 and TIME-01..05 in `REQUIREMENTS.md` and set them to Complete in the traceability table; remove the merged local worktrees `hearth-clock` and `hearth-knip` and the deleted remote branches' local copies when ready (not done by me).

### Gaps Summary

No gaps. The phase goal is achieved in what exists now: the unit and component suites pass in all six pinned date and zone cells (re-run here, 36/36) and in CI, the one failure that pre-existed on untouched `main` is fixed, the bills integration flake is fixed behind a guard that is proven (by preserved red and green runs and by a check over all 24 hours) to fail on the UTC helper, bare clock reads in tests and `e2e/` fail lint, and a calibrated knip run and jscpd scan produce an 89-row triage whose uncertain list is with the owner. Both pull requests are merged and `main` is green at `e03142d`. Nothing was deleted and no production code changed. The status is `human_needed` rather than `passed` because one truth (E2E independence from the weekday) is audited but has never been run on another weekday, and four owner decisions (the candidate list, the jscpd baseline, the undeclared `vitest`, the benchmark script) are the owner's to make.

---

_Verified: 2026-10-13_
_Verifier: Claude (gsd-verifier)_
