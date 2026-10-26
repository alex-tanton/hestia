---
phase: 02-baseline-net-stabilization-and-analysis
plan: 05
subsystem: testing
tags: [eslint, no-restricted-syntax, e2e, clock, timezone, playwright]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "02-04: apps/service/src/test/zone-dates.ts (currentInstant and zone helpers); 02-02/02-03: test/clock-setup.mjs pin"
provides:
  - "e2e/support/clock.ts: currentInstant, dateInZone, hourInZone, addDays, with node:test straddle cases run by the e2e test script"
  - "E2E specs 16 and 19 take their dates from the household-zone helper; no weekday assumption, no server clock seam"
  - "TIME-04 lint ban: bare new Date() and Date.now() fail pnpm lint in every test file, e2e/, test helper folders and test/*.mjs"
affects: [02-08, 02-09, phase-06]

actuals:
  tokens: 3500
  tasks: 2
  commits: 2
plan_head_before: 35e6ea1786bc6fc484826855b14c6371f0c0ce12
plan_head_after: 1ba69ddbf15f86b2885d2e8e066938ee3ef6283a

tech-stack:
  added: []
  patterns:
    - "Real-clock reads in test code go through a currentInstant helper or carry a next-line eslint-disable with a reason after ' -- '"
    - "The opt-out sits on the line directly above the read, inside the function body, not above the JSDoc"

key-files:
  created:
    - e2e/support/clock.ts
    - e2e/support/clock.test.ts
  modified:
    - e2e/package.json
    - e2e/tests/16-bill-paid-late-keeps-anchor.spec.ts
    - e2e/tests/19-notifications.spec.ts
    - eslint.config.js
    - apps/service/src/test/zone-dates.ts
    - apps/service/src/test/fake-app.ts
    - apps/service/src/routes/routes.test.ts
    - apps/service/src/deals/flipp/request-queue.test.ts

key-decisions:
  - "No opt-outs were added to host-rate-limiter.test.ts: plan 02-03 already moved its real-elapsed-time test to performance.now(), so the file has no bare clock read left"
  - "The currentInstant opt-out comments sit inside the function body, directly above `return new Date()`, because ESLint applies a next-line directive to the very next line only"

requirements-completed: [TIME-03, TIME-04]

duration: ~25min (start time not captured; approximate)
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 05: E2E household clock helper and the bare-clock lint ban Summary

**Specs 16 and 19 now read "today" through `e2e/support/clock.ts` (household-zone date at run time), and `no-restricted-syntax` rejects `new Date()` and `Date.now()` in every test file, `e2e/`, test helper folder and `test/**/*.mjs` while leaving production modules alone.**

## Performance

- **Tasks:** 2 of 2
- **Commits on `test/deterministic-clock`:** 2 code commits (measured from the ledger: `35e6ea1..1ba69dd`), plus the docs commit that carries this SUMMARY
- **Changed files:** 2 new (helper and its test), 8 modified (all test, test-helper or lint config; no production module)

## Accomplishments

- `e2e/support/clock.ts` exports `currentInstant`, `dateInZone`, `hourInZone` and `addDays`, each with an explicit return type and JSDoc. The module comment states that E2E has no clock seam, so dates are computed at run time in the household zone and never assume a weekday.
- `e2e/support/clock.test.ts` (`node:test`, explicit instants): `dateInZone` New York `2026-10-17T02:30Z` is `2026-10-16`, Kiritimati `2026-10-18T22:30Z` is `2026-10-19`, Los Angeles `2027-01-01T00:30Z` is `2026-12-31`; `hourInZone` New York gives 8 and, across spring-forward, 3; `addDays` crosses the year boundary and a DST date; `currentInstant` returns a finite `Date`. `pnpm --filter @hearth/e2e test` ends `tests 15, pass 15, fail 0` (the 6 existing run-identity cases plus 9 new). `e2e/package.json` `test` is exactly `node --test support/run-identity.test.ts support/clock.test.ts`.
- Spec 16: `householdToday()` is gone; `fixture()` takes `today` from `dateInZone(HOUSEHOLD_TZ, currentInstant())`. Spec 19: `newYorkDate`, `newYorkHour` and the local `addDays` are gone; `reminderDay` uses `dateInZone(NEW_YORK, now)` and `hourInZone(NEW_YORK, now)`, and the call site is `reminderDay(currentInstant())`. `reminderDay`'s logic, its explicit-instant `new Date(`${yesterday}T17:00:00Z`)` fallback clock, `ensureDinnerOn` and every assertion are unchanged. No server clock seam or application change was made (D-05).
- `eslint.config.js`: one block after the non-null-assertion block and before `prettier`, `files` = the seven globs (`**/*.test.{ts,tsx}`, `**/*.spec.ts`, `e2e/**/*.ts`, `apps/service/src/test/**/*.ts`, `apps/web/src/test/**/*.{ts,tsx}`, `apps/web/src/test-setup.ts`, `test/**/*.mjs`), `no-restricted-syntax` at `error` with the two selectors `NewExpression[callee.name='Date'][arguments.length=0]` and `CallExpression[callee.object.name='Date'][callee.property.name='now']`. It does not overlap the service block, which ignores service tests and `src/test/**`.
- Bare-clock offenders found after widening: `lint` flagged nothing beyond the files the plan predicted, so no extra file was changed.

## Task Commits

1. Task 1 (tracer): `358d5db` test(e2e): derive e2e dates from one household clock helper
2. Task 2: `1ba69dd` test: ban bare clock reads in tests and e2e
3. This SUMMARY: `docs: complete plan 02-05` (made after this file was written, so not in `commits:` above)

## Opt-outs (T-02-12)

`git grep -n 'eslint-disable-next-line no-restricted-syntax'` outside `.planning/` lists exactly four, each with a ` -- ` reason, all next-line:

| File | Count | Reason given |
|------|-------|--------------|
| `e2e/support/clock.ts` | 1 | E2E reads the real clock the stack also uses; there is no seam to pin |
| `apps/service/src/test/zone-dates.ts` | 1 | the one clock read: real in integration tests, pinned in unit tests |
| `apps/service/src/deals/flipp/request-queue.test.ts` | 2 | reads the fake-timer clock installed in beforeEach |

The acceptance pattern `eslint-(disable|enable)(-line)? +no-restricted-syntax` matches nothing, so there are no file-level, block-level or same-line opt-outs.

## Controls

A snippet with `new Date().getTime()` and `Date.now()` piped to `eslint --stdin` yields 2 `no-restricted-syntax` errors under each of `e2e/tests/16-bill-paid-late-keeps-anchor.spec.ts`, `apps/web/src/screens/deals/favorites.test.tsx`, `apps/service/src/routes/routes.test.ts`, `apps/service/src/test/fake-app.ts` and `packages/shared/src/api/schemas.test.ts`, and 0 under the production module `apps/web/src/lib/format.ts`.

## Verification run

- Task 1 verify, re-run clause by clause: e2e unit `fail 0`, e2e typecheck, `pnpm lint` (exit 0), planted-snippet count 2, spec 16 imports `../support/clock.ts`, spec 19 contains `reminderDay(currentInstant())`, `grep -cE 'function (householdToday|newYorkDate|newYorkHour|addDays)'` is 0 for both specs.
- Task 2: `pnpm lint` exit 0; plain `pnpm test` exit 0 (matching 156, shared 148, recurrence 77, service 725, web 715, all passed); `node scripts/test-sweep.mjs --workspace service` is `sweep: 6/6 passed`; `pnpm typecheck` and `pnpm format:check` exit 0. The commit hooks passed on both commits.
- Added `.skip`/`.todo`: none. Changed files under `apps/service/src` are `*.test.ts` and `src/test/` only; no production module touched.
- Backup push (phase rule 4): `git diff --name-only origin/main...test/deterministic-clock` (40 paths) held nothing under `.claude/`, `.github/`, `supabase/migrations/`, `docker/` or `.planning/cleanup/logs/` and no env file; the secret-shaped scan of added lines counted 0. Plain `git push -u origin test/deterministic-clock` fast-forwarded `35e6ea1..1ba69dd`; `git ls-remote` equals the local tip `1ba69dd`. No pull request was opened. The SUMMARY commit is pushed the same way afterwards.

## Not run

- E2E journeys (specs 16 and 19 against the Compose stack): they need the full stack, which is not run here. Their gate is CI's `test-e2e` job on the pull request in plan 02-08. The specs were checked by typecheck, lint and the helper's `node --test` cases only.

## Deviations from Plan

**1. [Plan/state mismatch] `host-rate-limiter.test.ts` got no opt-outs**
- The plan (Task 2 step 6, acceptance, and the verify's expected-file list) expects two `no-restricted-syntax` opt-outs in `apps/service/src/recipes/host-rate-limiter.test.ts`. Plan 02-03 already moved that real-elapsed-time test onto `performance.now()` (see 02-03 Deviation 1), so the file has no bare `new Date()` or `Date.now()` left. Lint is green without any opt-out, and an opt-out with nothing to suppress would be reported as an unused directive (a warning, which fails `--max-warnings=0`). I added none and did not revert the 02-03 fix. Consequence: the plan's literal count (6 opt-outs, 4 files) is 4 opt-outs in 3 files, and the Task 2 verify clause that compares the file list to the four named files would not match as written.

**2. [Plan detail] Placement of the `currentInstant` opt-out in `e2e/support/clock.ts`**
- The plan says to put the directive "directly above" `currentInstant`. Placed above the JSDoc and function line, ESLint reported an unused directive and the error on the read inside the body (a next-line directive covers only the next line). I moved it inside the function body, directly above `return new Date();`. Same for `zone-dates.ts`, where the plan itself placed it above the read.

**3. [Process] STATE.md, ROADMAP.md and REQUIREMENTS.md not touched**
- The orchestrator owns those writes, so this plan's docs commit carries only this SUMMARY, not the four files the plan's `<output>` names.

**4. [Process] The worktree branch-namespace check was not applied**
- Same as 02-02 to 02-04: the plan names `../hearth-clock` on `test/deterministic-clock`, so the protected/detached-branch check was applied and the `agent-*` allow-list was not.

**Total deviations:** 1 plan/state mismatch, 1 placement detail, 2 process notes.

## Known Stubs

None.

## Threat Flags

None. Only test files, test helpers and lint configuration changed; no endpoint, auth path or schema.

## Self-Check

- FOUND: `e2e/support/clock.ts`, `e2e/support/clock.test.ts` in `../hearth-clock`
- FOUND commits 358d5db and 1ba69dd on `test/deterministic-clock` and on `origin/test/deterministic-clock`
- `git status --porcelain` in `../hearth-clock` was empty after the code commits
