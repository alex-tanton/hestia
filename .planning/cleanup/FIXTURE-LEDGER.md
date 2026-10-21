# Fixture consolidation ledger (PR B: RED-03)

base=4e39165141ea1c6655f1bcc6a357c2bf0511726a
branch=test/shared-fixtures-wip
worktree=../hearth-fixtures-wip

Working branch note: the plan names `claude/vigilant-gates-a4ihid`; the session's working branch is
`claude/eloquent-mayer-szjtjf` (see `CI-SETUP-LEDGER.md`, "Gates and decisions"), and `base=` is its
tip when `test/shared-fixtures-wip` was cut.

## Baseline

Scan: the Phase 2 test-inclusive jscpd command (jscpd 5.4.1, `--min-tokens 60 --min-lines 8`, formats
typescript and tsx), run from the root of `../hearth-fixtures-wip` at `base=`, label `05-02-before`.

before-clones=99
before-duplicated-lines=1472
before-cross-test=50

Phase 2 reference (TRIAGE.md): 96 clones, 1,438 duplicated lines, 1.87%. Today's `main` reports 99
clones, 1,472 lines, 1.90%, so the Phase 5 bar of "at most 90 clones" is 9 below the starting point.
Of the 99 clones, 61 are across two files and 38 repeat inside one file (D-07: those stay); 50 of the
61 cross-file clones have a test, test-helper or e2e side, and 15 of those have a side under
`apps/service/`.

## Clone dispositions

One row per cross-file test clone pair of the `05-02-before` scan that has a side under
`apps/service/`. Clusters: A is the integration stack hooks plus per-file helpers, B is the job logger.

| # | File A (lines) | File B (lines) | Lines | Cluster | Disposition | Commit |
| - | -------------- | -------------- | ----- | ------- | ----------- | ------ |
| 1 | `apps/service/src/api.integration.test.ts` 28-57 | `apps/service/src/chores.integration.test.ts` 11-40 | 30 | A | removed | 948432f |
| 2 | `apps/service/src/api.integration.test.ts` 29-57 | `apps/service/src/meal-plan.integration.test.ts` 17-46 | 29 | A | removed | 948432f |
| 3 | `apps/service/src/api.integration.test.ts` 32-57 | `apps/service/src/bills.integration.test.ts` 22-54 | 26 | A | removed | 948432f |
| 4 | `apps/service/src/api.integration.test.ts` 32-53 | `apps/service/src/lists.integration.test.ts` 21-42 | 22 | A | removed | 948432f |
| 5 | `apps/service/src/api.integration.test.ts` 32-60 | `apps/service/src/notifications.integration.test.ts` 20-41 | 29 | A | removed | 948432f |
| 6 | `apps/service/src/api.integration.test.ts` 39-57 | `apps/service/src/match-overrides.integration.test.ts` 21-38 | 19 | A | removed | 948432f |
| 7 | `apps/service/src/chores.integration.test.ts` 7-40 | `apps/service/src/errands.integration.test.ts` 6-38 | 34 | A | pending | |
| 8 | `apps/service/src/chores.integration.test.ts` 56-67 | `apps/service/src/errands.integration.test.ts` 45-54 | 12 | A | pending | |
| 9 | `apps/service/src/dispatch-notifications.integration.test.ts` 36-55 | `apps/service/src/jobs.integration.test.ts` 49-68 | 20 | B | pending | |
| 10 | `apps/service/src/dispatch-notifications.integration.test.ts` 36-47 | `apps/service/src/jobs/scheduler.test.ts` 25-36 | 12 | B | pending | |
| 11 | `apps/service/src/dispatch-notifications.integration.test.ts` 37-46 | `apps/service/src/jobs/dispatch-notifications.test.ts` 110-119 | 10 | B | pending | |
| 12 | `apps/service/src/lists.integration.test.ts` 19-42 | `apps/service/src/match-overrides.integration.test.ts` 10-34 | 24 | A | pending | |
| 13 | `apps/service/src/lists.integration.test.ts` 89-100 | `apps/service/src/meal-plan.integration.test.ts` 119-132 | 12 | A | pending | |
| 14 | `apps/service/src/match-overrides.integration.test.ts` 29-42 | `apps/service/src/meal-plan.integration.test.ts` 37-50 | 14 | A | pending | |
| 15 | `apps/service/src/meal-plan.integration.test.ts` 42-60 | `apps/service/src/readiness.integration.test.ts` 54-72 | 19 | A | pending | |

## Test counts

tests-before.service-unit=757

`pnpm --filter @hearth/service test` at `base=` (log `05-02-service-unit-before.log`): 56 files, 757
tests. This equals the 757 recorded by 05-01 for the service workspace. Integration files do not run
here (no Supabase stack); their counts are compared in PR B's CI (05-05).

## Scans

| Label | Where | Clones | Duplicated lines | Cross-file | Cross-file test | Note |
| ----- | ----- | ------ | ---------------- | ---------- | --------------- | ---- |
| 05-02-before | `base=` | 99 | 1472 | 61 | 50 | before any edit |
| 05-02-t1 | after commit 948432f | 98 | 1459 | 60 | 49 | api on the shared hooks |

Reports: `.planning/cleanup/jscpd/phase5-{label}/jscpd-report.json`; read them with
`node .planning/cleanup/tools/jscpd-compare.mjs {report} --list cross-test --root ../hearth-fixtures-wip`.

## Gates

Task 1 (`../hearth-fixtures-wip` at 948432f): service typecheck passes; `eslint --max-warnings=0` and
`prettier --check` pass on `stack-hooks.ts` and `api.integration.test.ts`; the service unit suite
reports 757 passed (log `05-02-t1-service-unit.log`); the pre-commit hook (lint-staged, root
typecheck) and commitlint pass. A throwaway test confirmed that an exported `let` reassigned in a
`beforeEach` registered by a helper module is read live by the importing test file.

## CI

Not run yet: integration files run in PR B's CI (05-05).
