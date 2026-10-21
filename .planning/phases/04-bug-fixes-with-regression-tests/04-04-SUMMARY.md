---
phase: 04-bug-fixes-with-regression-tests
plan: 04
subsystem: pull-request
tags: [pull-request, ci, guard-tests, fix-ledger, owner-gate]

requires:
  - phase: 04-bug-fixes-with-regression-tests
    provides: "PR 1 (#15) merged into main at 1b0e69f; test/guard-tests from plan 04-03"
provides:
  - "PR 2 (#16, test/guard-tests into main, open, unmerged) with six green CI jobs on head f246c74"
  - "FIX-LEDGER-GUARDS.md with pr1-merged, pr2-ready, gate-pr2, pr2, pr2-head, pr2-ci and the test-unit job URL in the FIX-03 and FIX-05 green cells"
affects: [04-05 and 04-07 (PR 3 opens only after the owner squash-merges PR 2), 04-08 (ledger index)]

actuals:
  tokens: 2200
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Open a pull request through REST only, after the owner gate line is committed and pushed; poll the head SHA's check runs and never re-run without a documented flake"

key-files:
  created: []
  modified:
    - .planning/cleanup/FIX-LEDGER-GUARDS.md

key-decisions:
  - "PR 2 was opened only after gate-pr2=approve was committed and pushed, and nothing was merged, closed or marked ready"
  - "No CI job needed a re-run: all six jobs passed on the first attempt, so the ECR pre-pull flake path was not used"

requirements-completed: []

plan_head_before: 1513b42
plan_head_after: 8497b4d4b1779adf959a1a57fbafabc6c59bcbd2
commits: 4

coverage:
  - id: D1
    description: "PR 2 is open into main after PR 1's merge, with exactly the four guard files and six green CI jobs, waiting for the owner's squash merge"
    requirement: FIX-03, FIX-05
    verification:
      - kind: ci
        ref: "CI run 39450888999 on f246c74: lint, typecheck, test-unit, test-integration, test-e2e, build all success"
        status: pass
      - kind: other
        ref: "REST: pulls/16 base main, head test/guard-tests, merged false, files = docs/testing.md, package.json, packages/shared/src/api/patch-schemas.test.ts, test/eslint-service-role-fence.test.mjs"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 04: Open PR 2 and get it green Summary

**PR #16 (`test/guard-tests` into `main`) is open on the post-PR-1 tip f246c74 with all six CI jobs green on the first run, carrying only the PATCH-default guard, the service-role fence probe, their harness line and docs; the owner squash-merges it.**

## Performance

- **Duration:** about 31 min across this plan (Task 1 and the continuation); this continuation took about 15 min, most of it waiting for CI
- **Completed:** 2026-10-20T15:55Z
- **Tasks:** 3 (Task 1 tracer, Task 2 owner gate, Task 3 PR and CI)
- **Files:** one ledger changed (`FIX-LEDGER-GUARDS.md`); the PR itself changes four files

## Accomplishments

- **Task 1 (tracer).** PR 1 (#15) is merged, `pr1-merged=1b0e69f2414cf3619b8941a8596842edee6d274d` is in both ledgers, and `test/guard-tests` took `origin/main` by a plain merge (f246c74, no conflict, no lockfile change). Every local gate, the knip comparison and the 36/36 sweep passed; the PR body was drafted.
- **Task 2 (owner gate).** The owner answered `approve`; `gate-pr2=approve (owner, 2026-10-20)` was committed (e03708f) and pushed before any pull request existed (REST showed none for the branch at that point).
- **Task 3.** PR 2 opened through REST as #16, https://github.com/alex-tanton/hearth/pull/16, head `f246c74ec58e88b93020eafa3320c4d4cdca129b`, base `main`, not a draft. REST reports exactly the four PR 2 files. The head's `CI` run 39450888999 (event `pull_request`) finished with all six jobs `success`.

## CI result

| Job | Conclusion | Job id |
| --- | --- | --- |
| lint | success | 118725081599 |
| typecheck | success | 118725082154 |
| test-unit | success | 118725082175 |
| test-integration | success | 118725082059 |
| test-e2e | success | 118725082167 |
| build | success | 118725081818 |

`test-unit` URL (cited in the FIX-03 and FIX-05 green cells): https://github.com/alex-tanton/hearth/actions/runs/39450888999/job/118725082175. No job was re-run and no log needed saving.

## Task Commits

Working branch `claude/trusting-lovelace-y4r87h` (the measured `commits: 4`, first-parent from `plan_head_before`):

1. **Task 1:** `fc847f1` (plain merge of `origin/main`) and `2c0933b` (`docs: record the PR 2 pre-open proof`); code branch merge f246c74 on `test/guard-tests`
2. **Task 2:** `e03708f` (`docs: record the PR 2 owner gate`)
3. **Task 3:** `8497b4d` (`docs: record PR 2 and its CI`)

The plan metadata commit (`docs: complete plan 04-04`) follows this file. `plan_head_before` is the working-branch head before Task 1 (`1513b42`, `docs: complete plan 04-06`); no per-plan head file was kept by the Task 1 agent, so it was reconstructed from the log, and the count excludes the commits that arrive with the merged `origin/main`.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

None - the plan's Tasks 2 and 3 ran as written.

Notes that are not deviations: `requirements-completed` is empty on the orchestrator's instruction (PR 2 is not merged). The plan's `<output>` section also names FIX-01, FIX-02 and FIX-04 for `.planning/REQUIREMENTS.md` because PR 1 is merged; `REQUIREMENTS.md` still shows them Pending, so the orchestrator should decide whether to mark them now or at the phase verification. `.planning/milestone.lock` was left alone.

## Issues Encountered

None. No fix attempt, no flake, no re-run, no auth gate.

## Known Stubs

None.

## Threat Flags

None. T-04-10 is mitigated: the PR's file list is exactly the four expected files. T-04-11 is mitigated: all six jobs passed on the merge-ready tip. T-04-SC: no package was added.

## User Setup Required

None.

## Next Phase Readiness

PR 2 waits for the owner's squash merge (proposed title `test: guard PATCH schemas and the service-role lint fence`). The merge runs CI on `main` and queues Deploy. PR 3 (04-07) opens only after that merge, per D-11. Nothing was merged, closed, marked ready or force-pushed.

## Self-Check: PASSED

- Task 3's `<verify>` command printed `TASK3_VERIFY_OK`: gate line present, PR 16 goes `test/guard-tests` into `main`, `pr2-head=` equals the PR head, six jobs `success`, `pr2-ci=` present, four-file list, ledger clean and the working branch pushed at its tip.
- Commits `fc847f1`, `2c0933b`, `e03708f` and `8497b4d` are ancestors of the working branch; `origin/test/guard-tests` is f246c74.

---
*Phase: 04-bug-fixes-with-regression-tests*
*Completed: 2026-10-20*
