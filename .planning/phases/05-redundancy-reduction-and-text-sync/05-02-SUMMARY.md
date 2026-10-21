---
phase: 05-redundancy-reduction-and-text-sync
plan: 02
subsystem: testing
tags: [vitest, integration-tests, test-helpers, jscpd, fixtures, fastify]

requires:
  - phase: 02-deterministic-tests
    provides: the test-inclusive jscpd baseline (96 clones) and the clock-banned test helper rules
provides:
  - apps/service/src/test/stack-hooks.ts with live stack and app, registerStackHooks() and expectStatus()
  - apps/service/src/test/job-logger.ts with recordingJobLogger(lines) and JobLogLine
  - branch test/shared-fixtures-wip (service half of PR B, backup, never a PR head), pushed
  - .planning/cleanup/tools/jscpd-compare.mjs and .planning/cleanup/FIXTURE-LEDGER.md with 15 service pair dispositions
affects: [05-04 web fixtures, 05-05 PR B landing, 05-13 redundancy index]

actuals:
  tokens: 6165
  tasks: 3
  commits: 6

plan_head_before: 4e39165141ea1c6655f1bcc6a357c2bf0511726a
plan_head_after: 8e7dbc3345d55a78341602aeaeb0a7a9af91d725

tech-stack:
  added: []
  patterns:
    - "A test-helper module exports `let` bindings that a registering function assigns inside vitest hooks; test files import them and read them at call time (live bindings)"
    - "Files whose hooks differ keep their hooks and adopt only the identical part (expectStatus)"

key-files:
  created:
    - apps/service/src/test/stack-hooks.ts (branch test/shared-fixtures-wip)
    - apps/service/src/test/job-logger.ts (branch test/shared-fixtures-wip)
    - .planning/cleanup/tools/jscpd-compare.mjs
    - .planning/cleanup/FIXTURE-LEDGER.md
    - .planning/cleanup/jscpd/phase5-05-02-before/, phase5-05-02-t1/, phase5-05-02-t2a/, phase5-05-02-t2/, phase5-05-02/ (jscpd-report.json each)
  modified:
    - "apps/service/src/*.integration.test.ts (api, bills, chores, deals, errands, lists, match-overrides, meal-plan, notifications, readiness, recipes) on test/shared-fixtures-wip"
    - "apps/service/src/dispatch-notifications.integration.test.ts, jobs.integration.test.ts on test/shared-fixtures-wip"
    - "apps/service/src/jobs/scheduler.test.ts, jobs/dispatch-notifications.test.ts on test/shared-fixtures-wip"

key-decisions:
  - "readiness keeps its own hooks and adopts only expectStatus: its tests and one nested beforeAll reassign `app`, which an imported live binding cannot do, and its beforeAll also clears six hardcoded postal codes"
  - "deals and recipes keep their hooks (injected deals service; one app per test) and adopt only expectStatus"
  - "No createJobTestDb() helper: after the logger moved, the two job integration files' remaining beforeAll text fell below the scan floor, so the db setup stays in each file in its original order"
  - "Three service pairs are kept (chores/errands createHome, lists/meal-plan itemNamed, meal-plan/readiness favoriteStore), each with the semantic difference in the ledger"

patterns-established:
  - "registerStackHooks() is called at the top level exactly where a file's own hooks were, so hook order is unchanged"

requirements-completed: []

duration: 15min
completed: 2026-10-21
status: complete
---

# Phase 5 Plan 02: Service fixture consolidation Summary

**Service integration tests take their stack lifecycle and status assertion from one `stack-hooks.ts`, and four job tests share one `recordingJobLogger`; the Phase 2 jscpd scan drops from 99 to 87 clones with 757 service unit tests before and after.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-21T17:52Z
- **Completed:** 2026-10-21T18:07Z
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 15 test files and 2 new helpers on `test/shared-fixtures-wip`; 1 tool, 1 ledger and 5 scans on the working branch

## Accomplishments

- Task 1 (tracer): `apps/service/src/test/stack-hooks.ts` exports live `stack` and `app`, `registerStackHooks()` and `expectStatus()`; `api.integration.test.ts` adopts it. The first scan fell from 99 to 98 clones, and a throwaway test showed an exported `let` reassigned in a helper-registered `beforeEach` is read live by the importing file. Verified end to end before expanding.
- Task 2: seven more files (bills, chores, errands, lists, match-overrides, meal-plan, notifications) use `registerStackHooks()`; readiness, deals and recipes adopt only `expectStatus`. All eleven integration files import from `./test/stack-hooks.js` and none defines `expectStatus`. Scan: 90 clones.
- Task 3: `apps/service/src/test/job-logger.ts` replaces four local recording loggers (two integration files, `jobs/scheduler.test.ts`, `jobs/dispatch-notifications.test.ts`). Final scan: 87 clones, 1,199 duplicated lines (baseline 99 and 1,472; Phase 2 reference 96 and 1,438), cross-file test pairs with a service side down from 15 to 3.
- `jscpd-compare.mjs` reports totals, lists cross-file test pairs against tracked paths (`--root`), and gates on `--max-clones`; it is lint-clean.

## Branches and commits

| Where | SHA | Subject |
| ----- | --- | ------- |
| test/shared-fixtures-wip | 948432f | test(service): share the integration stack hooks |
| test/shared-fixtures-wip | b3bf88f | test(service): use the shared stack hooks in every integration file |
| test/shared-fixtures-wip | 053f371 | test(service): share the recording job logger |
| working branch | 0b528d5 | docs: record the service fixture baseline and first scan |
| working branch | 65da753 | docs: record the integration fixture consolidation |
| working branch | 8e7dbc3 | docs: record the service fixture scan |

`test/shared-fixtures-wip` tip is 053f3714623545921c33a498cb303906c1f7c42e, cut from `4e39165` and pushed; its diff against that base lists only files under `apps/service/src/`. No pull request was opened.

## Clone totals and unit counts

| Scan | Clones | Duplicated lines | Cross-file test pairs |
| ---- | ------ | ---------------- | --------------------- |
| 05-02-before (base) | 99 | 1472 | 50 |
| 05-02-t1 | 98 | 1459 | 49 |
| 05-02-t2 | 90 | 1241 | 41 |
| 05-02 (final) | 87 | 1199 | 38 |

Service unit suite: 56 files, 757 tests before, after each task, and at the end (equal to the 757 05-01 recorded). Integration counts are compared in PR B's CI (05-05); per touched file the count of `it`/`describe`/`test` declarations and of lines matching the citation vocabulary equal the base.

## Pairs kept (service side, with reasons)

| Pair | Why it stays |
| ---- | ------------ |
| chores / errands (`createHome`, 12 lines) | chores adds `extraMembers` and a `members` list, errands returns a smaller `Home`; only the prefix is shared |
| lists / meal-plan (`allItems`, `itemNamed`, 12 lines) | meal-plan's `itemNamed` error also lists the items it saw, and `createList` defaults differ |
| meal-plan / readiness (`favoriteStore`, 15 lines) | `addPantryItem` differs (void vs the item) and readiness reassigns its own `app`, so a helper-bound `favoriteStore` would read an `app` readiness never sets |

## Task Commits

1. **Task 1: shared stack hooks, api adopted** - 948432f (test) on `test/shared-fixtures-wip`; ledger, tool and scans 0b528d5 on the working branch
2. **Task 2: every integration file on the hooks** - b3bf88f (test); ledger and scans 65da753
3. **Task 3: shared recording job logger** - 053f371 (test); ledger and final scan 8e7dbc3

## Deviations from Plan

### Auto-fixed Issues

None for code. Notes on how the plan's conditional steps resolved:

- Task 2 step 2 resolved as `kept` for readiness (reassigned `app`, wider `beforeAll`), so it imports only `expectStatus`. Task 2 step 4 moved nothing: all three leftover pairs differ semantically.
- Task 3 step 3 (`createJobTestDb()`) was not needed, see key-decisions.
- The plan names the working branch `claude/vigilant-gates-a4ihid`; the session's working branch is `claude/eloquent-mayer-szjtjf`, as recorded by 05-01 and directed by the orchestrator. Commits to the working branch were path-limited as the plan requires. Integration files cannot run here (no Supabase stack); they are typechecked, linted and formatted locally and run in PR B's CI.

**Total deviations:** 0 auto-fixed. **Impact:** none on scope.

## Issues Encountered

None. `git push` for the new code branch and the working branch succeeded with the default credentials, so no token helper was needed; both token scans (tracked patterns and the value scan) passed.

## Known Stubs

None.

## Threat Flags

None. The helpers add no network, auth or file-access surface; no package was added.

## Next Phase Readiness

05-04 can add the web fixtures to `test/shared-fixtures-wip` and measure against the same tool. The 87-clone service-side scan leaves room under the Phase 5 bar of 90 before the web side is counted. PR B itself is not open and no requirement is marked complete (RED-03 stays pending until PR B merges).

## Self-Check: PASSED

- Files found: stack-hooks.ts, job-logger.ts (in `../hearth-fixtures-wip`), `.planning/cleanup/tools/jscpd-compare.mjs`, `.planning/cleanup/FIXTURE-LEDGER.md`, all five scan reports.
- Commits found as ancestors of their branch tips: 948432f, b3bf88f, 053f371 (test/shared-fixtures-wip); 0b528d5, 65da753, 8e7dbc3 (working branch).
- Plan verification: every integration file on the helper, no local `expectStatus`, citation line counts equal, scan 87 (at most 90), 3 service pairs left (at most 3), all dispositions `removed` or `kept:`, both branches pushed at their tips.
