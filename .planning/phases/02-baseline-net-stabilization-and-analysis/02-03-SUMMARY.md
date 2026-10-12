---
phase: 02-baseline-net-stabilization-and-analysis
plan: 03
subsystem: testing
tags: [vitest, clock-pin, timezone, sweep, service, packages]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "02-02: test/clock-setup.mjs (subclass-safe Date pin), test/global-tz.mjs, scripts/test-sweep.mjs"
provides:
  - "Service unit suite and the shared, recurrence and matching suites load the shared pin and TZ hook"
  - "Every unit suite (web, service, shared, recurrence, matching, e2e unit) passes in all six sweep cells: sweep 36/36"
  - "Plain pnpm test (no HEARTH_TEST_NOW, no TZ) passes on Node 24 with recurrence coverage thresholds met"
affects: [02-04, 02-05, 02-09, phase-06]

actuals:
  tokens: 1400
  tasks: 2
  commits: 1
plan_head_before: 8f4bb24487050fc8fc83beb292888ec9069b7869
plan_head_after: ff7e122626b1f62137d468bba038252d2cc64cbe

tech-stack:
  added: []
  patterns:
    - "Per-test opt-out from the pin uses a real-time source (performance.now) because vi.useRealTimers() does not unpin the subclass-safe Date"
    - "Deterministic counter instead of the clock as a uniqueness token"

key-files:
  created: []
  modified:
    - apps/service/vitest.config.ts
    - packages/shared/vitest.config.ts
    - packages/recurrence/vitest.config.ts
    - packages/matching/vitest.config.ts
    - packages/shared/src/api/schemas.test.ts
    - apps/service/src/cli.test.ts
    - apps/service/src/recipes/host-rate-limiter.test.ts

key-decisions:
  - "The host-rate-limiter real-sleep test measures elapsed time with performance.now() instead of vi.useRealTimers() (see Deviation 1)"

requirements-completed: [TIME-02]

duration: ~50min (start time not captured; approximate)
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 03: Service and package unit suites on the clock pin Summary

**The service and the three package Vitest configs now load `test/clock-setup.mjs` and `test/global-tz.mjs`; `node scripts/test-sweep.mjs --workspace all` ends `sweep: 36/36 passed` and the plain `pnpm test` is green (service 716, shared 148, recurrence 77, matching 156, web 715).**

## Performance

- **Tasks:** 2 of 2 (the tracer and the full sweep landed in the plan's single code commit)
- **Commits on `test/deterministic-clock`:** 1 code commit (measured from the ledger: `8f4bb24..ff7e122`), plus the docs commit that carries this SUMMARY
- **Sweep before test fixes:** 30/36 (service failed in all six cells, two tests); after: 36/36
- **Changed files:** 4 configs, 3 test files; no production module touched

## Accomplishments

- Tracer: `packages/shared` on the shared pin, `sweep: 6/6 passed`, `[test-clock] TZ=Asia/Tokyo` present in the Tokyo cell log, eslint and shared typecheck clean.
- `setupFiles: ['../../test/clock-setup.mjs']` and `globalSetup: ['../../test/global-tz.mjs']` added to the `test` block of `apps/service`, `packages/shared`, `packages/recurrence` and `packages/matching`. Integration and coverage configs are left to 02-04.
- Full unit sweep before any test edit: only the service workspace failed, with exactly the two tests the plan predicted (same two in every cell). Recurrence, matching, shared, web and e2e passed already.
- Plain `pnpm test` (TZ unset, no `HEARTH_TEST_NOW`): all five workspaces pass; recurrence coverage table shows 98.96 lines, 92.98 branches, 100 functions, 100 statements against the 90% thresholds, none edited. `pnpm typecheck`, `pnpm lint` and `pnpm format:check` exit 0. The commit's own hooks (lint-staged, typecheck) passed.

## Task Commits

1. Tasks 1 and 2 (plan says one commit): `ff7e122` test: pin the clock in service and package unit tests
2. This SUMMARY: `docs: complete plan 02-03` (made after this file was written, so not in `commits:` above)

## Per-test classification

| File > test | Class | Fix |
|-------------|-------|-----|
| `packages/shared/src/api/schemas.test.ts` > only accepts Crockford codes in a created invite | (a) now-relative fixture | `createdAt` is the literal `'2026-10-14T12:00:00.000Z'`; the schema only checks ISO shape |
| `apps/service/src/cli.test.ts` > writes a GoTrue refusal to real stderr and sets exit code 1 | (e) clock as uniqueness token | Cache-busting `?invoked-directly=` value comes from a module-level counter `importCount`; the query parameter name is unchanged. Under the pin the second import repeated the first's URL and hit the module cache (`exitCode` was `undefined`) |
| `apps/service/src/recipes/host-rate-limiter.test.ts` > really sleeps with the real clock and timer when no fakes are given | (d) measures real elapsed time | Elapsed time is read from `performance.now()`; see Deviation 1 |

No class (b) or (c) item was found, so no `checkpoint:decision` was raised. Every other service and package test passed unchanged under the pin, including `request-queue.test.ts` (its own `vi.useFakeTimers({ now: 0 })` overrides the pin per test) and the `fake-app.ts` / `routes.test.ts` claims code (consistent with the pinned service clock).

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan/pin mismatch] Class (d) opt-out cannot be `vi.useRealTimers()` with the subclass-safe pin**
- **Found during:** Task 2 step 3, after the first fix attempt
- **Issue:** The plan says to make `vi.useRealTimers()` the first statement of the real-elapsed-time test. The pin written in 02-02 (after its own deviation) is a `Date` of its own installed on `globalThis`, not a `vi.setSystemTime` mock, and no fake timers are installed, so `vi.useRealTimers()` does not restore the native `Date`. I tried it: the test still failed with `expected 0 to be greater than or equal to 15`. I did not revert or alter `test/clock-setup.mjs`, as instructed.
- **Fix:** In that one test only, the start and end timestamps come from `performance.now()` (real elapsed time, unaffected by the `Date` pin) and the comment says so. The limiter's default `now` stays the pinned `Date.now`, which still makes the second `wait()` sleep the full 20 ms gap through the real `setTimeout`-backed default sleep, so the test still exercises the constructor defaults it was written for. The assertion (`>= 15`) is unchanged and would fail if the default sleep did not wait. The rest of the file stays pinned.
- **Acceptance mismatch:** the acceptance line "begins with `vi.useRealTimers()` and a comment containing `real elapsed time`" holds only for the comment (the comment begins `Measures real elapsed time.`); there is no `vi.useRealTimers()` call. The intent (a per-test opt-out with a written reason, no weakened assertion) is met.
- **Files:** `apps/service/src/recipes/host-rate-limiter.test.ts`. **Commit:** `ff7e122`.

**2. [Process] The worktree branch-namespace check was not applied**
- Same as 02-02: the plan names `../hearth-clock` on `test/deterministic-clock`, so the protected/detached-branch check was applied and the `agent-*` allow-list was not.

**3. [Process] STATE.md, ROADMAP.md and REQUIREMENTS.md not touched**
- The orchestrator owns those writes, so this plan's docs commit carries only this SUMMARY, not the four files the plan's `<output>` names.

**Total deviations:** 1 plan/pin mismatch handled in test code, 2 process notes.

## Verification run

- Tracer: `logs/02-03-shared/summary.txt` ends `sweep: 6/6 passed`.
- Before fixes: `logs/02-03-all-before/summary.txt`, `sweep: 30/36 passed` (service, all six cells).
- After fixes: `logs/02-03-all/summary.txt` has 36 `result=PASS` lines and ends `sweep: 36/36 passed`; the service Kiritimati cell and the recurrence Pago Pago cell logs carry their `[test-clock] TZ=` lines.
- Plain `pnpm test`: exit 0; typecheck, lint, format:check: exit 0 (`logs/02-03-plain-exit.txt`).
- Added `.skip`/`.todo` lines in the diff: 0. Changed files under `apps/service/src` and `packages/*/src`: `*.test.ts` only.
- The session shell `TZ` stayed unset.
- Backup push (phase rule 4): pre-push checks listed no path under `.claude/`, `.github/`, `supabase/migrations/`, `docker/` or `.planning/cleanup/logs/`, no env file, and no secret-shaped added line. Plain `git push -u origin test/deterministic-clock` fast-forwarded `8f4bb24..ff7e122`; `git ls-remote` equals the local tip `ff7e122`; no pull request opened. The SUMMARY commit is pushed the same way afterwards.
- The Dependabot notice printed by the remote on push (default-branch vulnerability link) is informational and unrelated.

## Not done / could not do

- Integration and coverage Vitest configs are plan 02-04.
- `docs/testing.md` documentation of the pin is plan 02-09.

## Known Stubs

None.

## Threat Flags

None. No production module, endpoint or schema was touched.

## Self-Check

- FOUND: `setupFiles` / `globalSetup` entries in the four configs in `../hearth-clock`
- FOUND commit ff7e122 on `test/deterministic-clock` and on `origin/test/deterministic-clock`
- `git status --porcelain` in `../hearth-clock` was empty after the code commit
