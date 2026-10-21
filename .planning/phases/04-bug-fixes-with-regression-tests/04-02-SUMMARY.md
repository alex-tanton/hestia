---
phase: 04-bug-fixes-with-regression-tests
plan: 02
subsystem: pull-request-1
tags: [github, ci, pull-request, fix-ledger, advisory-lock, regression-tests]

requires:
  - phase: 04-bug-fixes-with-regression-tests
    provides: "04-01: fix/list-adds-rotation (FIX-01, FIX-04, FIX-02 tests) and fix/list-adds-lock (the FIX-02 lock, one commit ahead)"
provides:
  - "PR 1 (https://github.com/alex-tanton/hearth/pull/15), open and unmerged, from fix/list-adds-rotation into main, head edd41ec14a384f7dc185a40afe9f628b96e96d24, six green CI jobs"
  - "A CI-sourced red for FIX-02: test-integration job 118687530778 failed on the overlap case at head 1571f07"
  - "A CI-sourced green for FIX-02: test-integration job 118692254393 passed at head edd41ec, with the lock"
  - "FIX-LEDGER-WEB.md lines pr1, pr1-head-red, fix02-red, pr1-head, pr1-ci, pr1-ci-note, fix02-green and the FIX-02 row filled"
affects: [04-03 and later (PR 2 opens only after the owner merges PR 1), 04-08 (ledger index)]

actuals:
  tokens: 3500
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Red-then-green through CI: open the PR at a head without the fix, record the failing job, then fast-forward the continuation branch onto the PR branch (a plain push)"

key-files:
  created: []
  modified:
    - .planning/cleanup/FIX-LEDGER-WEB.md
    - .claude/CLAUDE.md (on fix/list-adds-lock, carried into PR 1 by the fast-forward; lines 199 and 236 only)

key-decisions:
  - "gate-pr1=approve (owner, 2026-10-20): PR 1 carries the two .claude/CLAUDE.md lines that FIX-04 made stale (suppression count six to five; the example directive)"
  - "The owner allowed exactly one re-run of test-e2e for an attempt-1 failure in a spec PR 1 does not touch; it passed on attempt 2, and the attempt-1 failure stays on record in pr1-ci-note"

requirements-completed: []

plan_head_before: 21821d6789d845fd06133e8d5fb42140f195ead1
plan_head_after: 2570d44d5490ee0ceab901ebbf04f8c8d65f35ea
commits: 5

coverage:
  - id: D1
    description: "PR 1 is open from fix/list-adds-rotation into main and its files are the six PR 1 files plus .claude/CLAUDE.md"
    verification:
      - kind: other
        ref: "gh api repos/alex-tanton/hearth/pulls/15/files (7 files: the six plus .claude/CLAUDE.md)"
        status: pass
    human_judgment: false
  - id: D2
    description: "FIX-02 is red in CI on the overlap case without the lock and green with it"
    requirement: FIX-02
    verification:
      - kind: integration
        ref: "apps/service/src/meal-plan.integration.test.ts#two calls in flight at once add each ingredient once (run 39440151507 job 118687530778 failure at 1571f07; run 39441333162 job 118692254393 success at edd41ec)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All six CI jobs are green on the PR head, including the deal-card, rotation-editor and add-to-list tests and the E2E rotation drive"
    requirement: FIX-04
    verification:
      - kind: e2e
        ref: "run 39441333162 attempt 2, jobs lint, typecheck, test-unit, test-integration, test-e2e, build on edd41ec: all success"
        status: pass
    human_judgment: false

duration: 51min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 02: Open PR 1, record the FIX-02 red and green in CI Summary

**PR 1 (#15) is open into `main` at `edd41ec` with six green CI jobs; FIX-02's overlap test failed in CI without the per-list lock (`bread` duplicated) and passes with it, and `test-e2e` went green on attempt 2 after one owner-approved re-run of an unrelated attempt-1 failure.**

## Performance

- **Duration:** about 51 min of wall-clock across the sessions, most of it waiting on CI (first 04-02 commit 14:19Z, last CI result 15:08Z)
- **Tasks:** 3 (tracer, owner gate, PR and CI)
- **Files modified:** the ledger on the working branch; `.claude/CLAUDE.md` (two lines) on `fix/list-adds-lock`

## Accomplishments

- **Task 1 (tracer).** Both PR 1 heads were already on current `main` (9819e7c). Every local gate and the full unit sweep passed on the content PR 1 would merge, knip added nothing beyond the Phase 3 baseline, and the PR body was drafted. Recorded as `pr1-ready=W:1571f07... C:2e357e5...`.
- **Task 2 (owner gate).** The owner answered `approve`: open PR 1 and update the two `.claude/CLAUDE.md` lines.
- **Task 3.** PR 1 opened as #15 at `1571f0778aab255b9c4b75b7489e2b90725c27d9` (the head with the FIX-02 tests and no lock). Run A (39440151507), job 118687530778, concluded `failure`: `two calls in flight at once add each ingredient once` failed with `AssertionError: expected [ 'bread', 'bread', 'butter', ...(3) ] to deeply equal [ 'bread', 'butter', 'cheese' ]`, 1 failed / 1157 passed. Then the `.claude/CLAUDE.md` commit and the lock were fast-forwarded onto the PR branch (head `edd41ec14a384f7dc185a40afe9f628b96e96d24`). Run B (39441333162) on that head: attempt 1 had lint, typecheck, test-unit, build and test-integration (job 118692254393) green and test-e2e (job 118692254126) failed; attempt 2 (the one re-run) is all six `success`, test-e2e job 118699848627.

## The test-e2e attempt-1 failure and the one re-run

- Attempt 1, job 118692254126: 1 failed / 101 passed, `tests/17-accessibility-states.spec.ts:498` (dark theme), `notification type: saving, then a failed save`, `toBeVisible` timed out waiting for "Couldn't save that setting. Try again." It was not the image pre-pull flake.
- PR 1 does not touch that spec or the notification settings code. The same area failed on attempt 1 of main's run 39346293068 (9819e7c) and passed on re-run, so it looks like an existing intermittent failure. This is a judgment from that single prior occurrence, not a proven root cause.
- The owner approved exactly one re-run of `test-e2e`; the orchestrator triggered it and the executor did not trigger any re-run. Attempt 2 passed. The ledger keeps the attempt-1 failure in `pr1-ci-note=`.
- Worth a follow-up: that spec is flaky in CI, which touches the milestone goal of a repeatable suite. It is not fixed here (out of scope).

## Task Commits

1. **Task 1:** `7be5b41` docs: record the PR 1 pre-open proof (working branch)
2. **Task 2:** `e05bdb4` docs: record the PR 1 owner gate (working branch)
3. **Task 3:** `edd41ec` docs: update the lint suppression count in the project instructions (`fix/list-adds-lock`, carried into PR 1); `6cc7026` docs: record PR 1 and its CI runs and `2570d44` docs: record PR 1 CI green (working branch)

`commits: 5` counts these five. `plan_head_before` is the parent of the first 04-02 commit; the plan kept no head ledger, and a raw `rev-list` over that range would also count the interleaved 04-03 and 04-05 ledger commits, so the count is by commit, not by range.

## Deviations from Plan

### Auto-fixed Issues

None.

### Process deviations

**1. [Process] test-e2e re-run for a non-pre-pull failure.** Plan rule 8 allows re-runs only for the ECR pre-pull flake, and says to stop with a checkpoint otherwise. The executor stopped, the owner decided in-session to allow exactly one re-run, and it passed. Recorded in `pr1-ci-note=`.

**2. [Process] Ledger commit message.** The plan names `docs: record PR 1 and its CI runs` for the final ledger commit; two commits were made (the first recorded the red run and the e2e failure, the second `docs: record PR 1 CI green`).

## Known Stubs

None.

## Threat Flags

None. PR 1's file list was checked through REST: the six PR 1 files plus `.claude/CLAUDE.md`, nothing from `.planning/`, `supabase/`, `docker/` or `.github/`.

## Open items for the owner

- PR 1 is open and unmerged: https://github.com/alex-tanton/hearth/pull/15. Squash title proposed: `fix: stop duplicate list adds and fix rotation editor semantics`. The merge queues a Deploy run. PR 2 opens only after this merge.
- Requirements FIX-01, FIX-02 and FIX-04 are not marked complete until PR 1 is merged.

## Self-Check: PASSED

- PR 1 open, head `edd41ec14a384f7dc185a40afe9f628b96e96d24`, six jobs `success` on that SHA (REST).
- Job 118687530778 is `test-integration`, `failure`, on `1571f0778aab255b9c4b75b7489e2b90725c27d9`; `1571f07` is an ancestor of `edd41ec`.
- Ledger lines present and pushed (`2570d44` is on `origin/claude/trusting-lovelace-y4r87h`).
