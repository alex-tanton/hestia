---
phase: 02-baseline-net-stabilization-and-analysis
plan: 04
subsystem: testing
tags: [vitest, integration, timezone, bills, regression-guard, zone-dates, sweep]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "02-02/02-03: test/clock-setup.mjs (subclass-safe Date pin), test/global-tz.mjs, scripts/test-sweep.mjs; 02-01: BASELINE.md integration rows"
provides:
  - "apps/service/src/test/zone-dates.ts: currentInstant, dateInZone, addDays, daysBetween, householdDate, with pinned-instant unit tests"
  - "bills.integration.test.ts dated by the household calendar (America/New_York), plus a two-zone regression guard seen red then green"
  - "vitest.integration.config.ts on the TZ hook (globalSetup only); vitest.coverage.config.ts on the pin plus the hook"
  - "Integration suite green under five process zones: sweep 5/5"
affects: [02-05, 02-08, 02-09, phase-06]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: f04593bfb2d25a4ea8b72024abdd258020b061c8
plan_head_after: 04aa68f9cde0950e2efd56905af6393233786772

tech-stack:
  added: []
  patterns:
    - "Zone-correct test dates: household date = addDays(dateInZone(zone, now), n), never the UTC calendar"
    - "Regression guard without a clock pin: Kiritimati (UTC+14) and Pago Pago (UTC-11) cannot both share the UTC date at any instant"
    - "Integration files read the clock only through currentInstant()"

key-files:
  created:
    - apps/service/src/test/zone-dates.ts
    - apps/service/src/test/zone-dates.test.ts
  modified:
    - apps/service/src/bills.integration.test.ts
    - apps/service/vitest.integration.config.ts
    - apps/service/vitest.coverage.config.ts
    - apps/service/src/api.integration.test.ts
    - apps/service/src/chores.integration.test.ts
    - apps/service/src/deals.integration.test.ts
    - apps/service/src/errands.integration.test.ts
    - apps/service/src/jobs.integration.test.ts
    - apps/service/src/log-autopay.integration.test.ts
    - apps/service/src/meal-plan.integration.test.ts

key-decisions:
  - "Path (a): Docker and the local Supabase stack were available, so the red/green proof and the integration sweep ran locally; no pull request and no CI evidence were used"
  - "The stack was left running and was not reset: the orchestrator forbade stopping, restarting or resetting it, so plan steps `supabase db reset` and `supabase stop` were skipped"

requirements-completed: [TIME-02, TIME-05]

duration: ~50min (start 2026-10-12T23:40Z; approximate)
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 04: Zone-correct bill dates, the two-zone guard and the integration sweep Summary

**`bills.integration.test.ts` now dates bills by the household calendar through a shared `zone-dates.ts`, a Kiritimati/Pago Pago guard was seen failing on the UTC helper and passing on the fix, and `node scripts/test-sweep.mjs --suite integration` ends `sweep: 5/5 passed`.**

## Performance

- **Tasks:** 2 of 2
- **Commits on `test/deterministic-clock`:** 2 code commits (measured from the ledger: `f04593b..04aa68f`), plus the docs commit that carries this SUMMARY
- **Changed files:** 2 new helper files, 10 modified test and config files; no production module touched

## Accomplishments

- `apps/service/src/test/zone-dates.ts` exports `currentInstant`, `dateInZone`, `addDays`, `daysBetween` and `householdDate`, each with an explicit return type and JSDoc. `zone-dates.test.ts` has 9 tests with explicit instants, including the `2026-10-15T02:00:00.000Z` straddle (`householdDate('America/New_York', -1, ...)` is `2026-10-13`).
- `bills.integration.test.ts`: the top-level `isoDate` is gone; `HOME_ZONE = 'America/New_York'` and `homeDate()` replace it at every call site. The household-timezone block uses the shared `dateInZone`, `daysBetween`, `currentInstant` and `householdDate`.
- Guard: `describe.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])('one-off bills are dated by the household calendar in %s')`, two tests per zone: a one-off bill anchored at the household's today is not overdue and its `currentOccurrenceDate` equals that date; one anchored at the household's yesterday is overdue. The service's rule (`services/bills.ts`, `currentBillOccurrence`) is overdue when the date is strictly before today, which matches the plan's assertions.
- Configs: `vitest.integration.config.ts` has `globalSetup` only (no `setupFiles`); `vitest.coverage.config.ts` has `setupFiles` and `globalSetup`. Coverage thresholds are unchanged.
- Seven integration files read the clock through `currentInstant()` and the bare-clock selector check over every `apps/service/src/**/*.integration.test.ts` now reports nothing.

## Task Commits

1. Task 1 (tracer): `3e4d764` test(service): date bills tests by the household calendar
2. Task 2: `04aa68f` test(service): read the clock through one helper in integration tests
3. This SUMMARY: `docs: complete plan 02-04` (made after this file was written, so not in `commits:` above)

## Red then green (TIME-05, T-02-09)

Path (a), local Supabase, run from the primary checkout against `../hearth-clock`.

| Step | UTC time | `householdDate` | Result |
|------|----------|-----------------|--------|
| Unit red | 2026-10-12T23:40Z | UTC calendar, zone ignored | `zone-dates.test.ts`: 2 failed, 7 passed (the straddle cases) |
| Integration red | 2026-10-12T23:40:52Z | UTC calendar | `bills.integration.test.ts`: 2 failed, 34 passed (36). Guard result `...in Pacific/Kiritimati > a bill anchored at the household's today is not overdue` failed with `AssertionError: expected true to be false`. The existing `dates follow the household timezone` test "a household bill due yesterday..." also failed, as its premise (`profileYesterday() != yesterday`) depends on the same helper |
| Unit green | 2026-10-12T23:41Z | `addDays(dateInZone(zone, now), n)` | 9/9 passed; service sweep on the helper test `6/6 passed` |
| Integration green | 2026-10-12T23:41:23Z | zone-correct | 36 passed (36), 0 failed; all four guard results `passed`, both zones present |

Red and green report the same total (36 tests), so the same tests ran. At 23:40Z Kiritimati is a UTC day ahead, so its "today" case is the one that bites; at other hours Pago Pago's cases do (before 11:00Z). The verify clauses for the red JSON/log and green JSON/log were re-run after the second commit and passed (`RED-OK`, `GREEN-OK`). The raw logs are `logs/02-04-bills-red.{log,json}` and `logs/02-04-bills-green.{log,json}` (gitignored).

## Clock-read audit (Task 2)

| File:line (before) | Read | Class | Now |
|--------------------|------|-------|-----|
| `api.integration.test.ts:1074, 1104` | `Math.floor(Date.now() / 1000)` for the JWT `now` used in forged-token claims and the `amr` timestamp | real instant | `Math.floor(currentInstant().getTime() / 1000)` |
| `chores.integration.test.ts:390, 405, 415, 421` | `doneAt` relative to now; `completedAt <= now` | real instant | `currentInstant().getTime()` |
| `errands.integration.test.ts:198, 210, 220, 226` | same pattern as chores | real instant | `currentInstant().getTime()` |
| `deals.integration.test.ts:46` | `clock = new Date()` injected as the job clock | real instant | `currentInstant()` |
| `jobs.integration.test.ts:83, 788, 835` | job clock, scheduler `now`, `pruneCache` `now` | real instant | `currentInstant()` |
| `log-autopay.integration.test.ts:59` | `Intl` format of `new Date()` in a zone | calendar date, already zone-correct | `dateInZone(zone, currentInstant())` (helper dedupe) |
| `log-autopay.integration.test.ts:~179` | `setUTCDate` day offsets from the household date | calendar arithmetic on a given date | `addDays(today, -n)` |
| `meal-plan.integration.test.ts:247` | live Sunday check against `new Date()` | real instant | `currentInstant().toISOString()` |

Left unchanged on purpose, all pure arithmetic on a date string the test was given, not a clock read: `chores.integration.test.ts` 702-743 (`new Date(`${chore.dueDate}T00:00:00Z`)` plus `setUTCDate`), `meal-plan.integration.test.ts:149` (local `addDays`, a copy of the shared helper; not swapped, to keep the diff to clock reads), `api.integration.test.ts:1058` (`getUTCFullYear` of an expiry). Fixed-instant constants in `notification-producers.integration.test.ts` are literals, and `dispatch-notifications.integration.test.ts` moves `send_after` in SQL, so neither reads the process clock. No other integration file under `apps/service/src` or `apps/service/src/db` has a bare clock read (the selector check lists exactly the seven files above, none after the change).

No class (c) item (a production module dating by the process zone) was found, so no `checkpoint:decision` was raised.

## Verification run

- Bills integration file against local Supabase: red 2 failed/34 passed, green 36 passed.
- `node scripts/test-sweep.mjs --workspace service --only src/test/zone-dates.test.ts`: `sweep: 6/6 passed`.
- `node scripts/test-sweep.mjs --suite integration --log-dir .planning/cleanup/logs/02-04-integration`: five `workspace=service result=PASS` lines (`default`, `la`, `kiritimati`, `pago-pago`, `tokyo`), `sweep: 5/5 passed`; the Kiritimati log carries its `[test-clock] TZ=Pacific/Kiritimati` line. The run crossed UTC midnight (2026-10-12 to 2026-10-13) and passed regardless.
- `pnpm --filter @hearth/service test:coverage` (CI's `test-integration` command): 75 files, 1155 tests passed, 0 failed. Coverage 96.77 statements / 86.55 branches / 98.07 functions / 98.66 lines, identical to the untouched-main baseline (74 files, 1142 tests; the difference is the 9 helper tests, the 4 guard tests, and the new file). Thresholds unchanged.
- `node scripts/test-sweep.mjs --workspace service`: `sweep: 6/6 passed`.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` in `../hearth-clock`: exit 0. The commit hooks passed.
- Bare-clock selector check over `apps/service/src/**/*.integration.test.ts`: exit 0, no `no-restricted-syntax`.
- Added `.skip`/`.todo`: none. Changed files under `apps/service/src` against `origin/main` are `*.test.ts` files and `src/test/` only; no production module touched.
- Backup push (phase rule 4): pre-push path list (31 paths) held nothing under `.claude/`, `.github/`, `supabase/migrations/`, `docker/` or `.planning/cleanup/logs/`, and no env file; the secret-shaped scan of added lines counted 0. Plain `git push -u origin test/deterministic-clock` fast-forwarded `f04593b..04aa68f`; `git ls-remote` equals the local tip. No pull request was opened.

## Deviations from Plan

**1. [Instruction] Local stack left as is: `supabase db reset` and `supabase stop` skipped**
- The orchestrator forbade stopping, restarting or resetting the stack, so plan Task 1 step 1 (`supabase start`, `db reset`), Task 2 step 3's `db reset` and step 6 (`supabase stop`) were not run. The stack was already up with migrations applied. The integration tests roll back their own transactions, and all runs passed without a reset. The acceptance line "Supabase is stopped" therefore does not hold; this is intentional.

**2. [Plan/pin mismatch] The `currentInstant` unit test does not compare to `vi.getMockedSystemTime()` of the default pin**
- The plan's behavior bullet says `currentInstant()` equals the pinned instant via `vi.getMockedSystemTime()`. With the subclass-safe `Date` pin from 02-02 (not a `vi.setSystemTime` mock), `vi.getMockedSystemTime()` is `null` until a test calls `vi.setSystemTime`. The test therefore sets its own instant with `vi.setSystemTime(STRADDLE)` (which the pin follows, as `test/clock-setup.mjs` documents) and asserts both `vi.getMockedSystemTime()` and `currentInstant()` equal it. `test/clock-setup.mjs` was not touched.

**3. [Process] Path (b) steps were not applicable**
- No early-CI gate, draft pull request, CI run or `02-04-ci.txt` were used (path a). The path (b) `checkpoint:decision` for the four zoned cells does not apply, since all five cells ran locally.

**4. [Process] STATE.md, ROADMAP.md and REQUIREMENTS.md not touched**
- The orchestrator owns those writes, so this plan's docs commit carries only this SUMMARY, not the four files the plan's `<output>` names.

**5. [Process] The worktree branch-namespace check was not applied**
- Same as 02-02 and 02-03: the plan names `../hearth-clock` on `test/deterministic-clock`, so the protected/detached-branch check was applied and the `agent-*` allow-list was not.

**6. [Plan verify note] A secret-file guard fired on the first pre-push path check**
- My first pre-push command used a grep for env-file path patterns; the environment's secret guard blocked it. I listed the changed paths and reviewed them by eye instead, as instructed.

**Total deviations:** 1 plan/pin mismatch handled in test code, 5 process notes.

## Not done / could not do

- Plan 02-05 (lint rule over the same selectors) and 02-09 (docs and root scripts) are later plans.
- The unrelated process-wide items in the plan's `user_setup` (GH_TOKEN) were not needed on path (a).

## Known Stubs

None.

## Threat Flags

None. Only test files, a test helper and two test configs changed; no endpoint, auth path or schema.

## Self-Check

- FOUND: `apps/service/src/test/zone-dates.ts`, `zone-dates.test.ts` in `../hearth-clock`
- FOUND commits 3e4d764 and 04aa68f on `test/deterministic-clock` and on `origin/test/deterministic-clock`
- `git status --porcelain` in `../hearth-clock` was empty after the code commits
