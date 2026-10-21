---
phase: 05-redundancy-reduction-and-text-sync
plan: 03
subsystem: infra
tags: [github-actions, composite-action, ci, pull-request, deploy]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-01: branch ci/setup-action on origin at 43672635, tree fd704a4c, and the pr-a-body-d12 sentence"
provides:
  - PR A (#26) opened through REST and squash-merged by the owner as ac8ef34bb913418e425eca1157fb9249b6017733
  - six green CI jobs on PR A's head (run 39650921896), on GitHub-hosted runners
  - the recorded before/after job steps (main run 39645569683 versus PR A run 39650921896) and the single seed typecheck from the CI log
  - main's CI on the squash commit, recorded in the ledger with the first failure and the owner-approved rerun
affects: [05-05 WB sync past PR A, 05-13 redundancy index, 06 CI work]

actuals:
  tokens: 3300
  tasks: 2
  commits: 4

# commits: 3 task commits on the working branch (9a0edc2, 5a4a88c, 748ffb5) plus the plan close-out
# commit. A plain base..HEAD count would also include plan 05-04's concurrent commits, so it is not
# used. plan_head_before is the working-branch tip before this plan's first commit.
plan_head_before: 8a1b57fec0ea32975f81eeaa6abd64323b5e533a
plan_head_after: 748ffb56fef0cfa9a176fc2e9ea858999ff9d098

tech-stack:
  added: []
  patterns:
    - "A CI-affecting PR is proven by its own six-job run and a programmatic before/after comparison of the jobs API step names, not by narrative"
    - "A red run on main after a merge is recorded with its first-attempt evidence, and a rerun needs an explicit owner exception to the registry-flake-only rule"

key-files:
  created:
    - .planning/phases/05-redundancy-reduction-and-text-sync/05-03-SUMMARY.md
  modified:
    - .planning/cleanup/CI-SETUP-LEDGER.md

key-decisions:
  - "PR A was opened at the head the owner pushed (43672635, tree equal to 05-01's proven tree) with the D-12 deviation stated word for word in the body"
  - "The owner approved exactly one rerun of main's failed test-e2e job as an exception to the registry-flake-only rule; it passed, so the plan closes with both runs on record"

requirements-completed: [RED-01, RED-02]

coverage:
  - id: D1
    description: "All six CI jobs run through the composite setup action on GitHub-hosted runners (PR A head and main squash commit)"
    requirement: "RED-01"
    verification:
      - kind: other
        ref: "gh api repos/alex-tanton/hearth/commits/43672635ca3fafe9c46c87c10c4fb0d96f6757e1/check-runs: lint, typecheck, test-unit, test-integration, test-e2e, build all success (run 39650921896)"
        status: pass
      - kind: other
        ref: "CI run 39653516611 on ac8ef34, attempt 2: six jobs success"
        status: pass
    human_judgment: false
  - id: D2
    description: "The seed workspace is typechecked once in CI"
    requirement: "RED-02"
    verification:
      - kind: other
        ref: "typecheck job 119398705202 log: one 'supabase/seed typecheck$ tsc --noEmit' line, 'apps/service typecheck$ tsc --noEmit' alone"
        status: pass
    human_judgment: false
  - id: D3
    description: "The before/after job steps differ only by the composite replacing the three setup steps"
    requirement: "RED-01"
    verification:
      - kind: other
        ref: "steps[].name of main run 39645569683 versus PR A run 39650921896, collapsed programmatically: identical for all six jobs"
        status: pass
    human_judgment: false

duration: ~1h wall time including CI waits (about 20 min of CI per run) and the owner's merge
completed: 2026-10-21
status: complete
---

# Phase 5 Plan 03: PR A landing Summary

**PR A (#26, one composite CI setup action plus a single seed typecheck) was opened with six green jobs and a CI-derived before/after step comparison, squash-merged by the owner as `ac8ef34`, and `main`'s CI on it is green after one owner-approved rerun of a single flaky e2e test.**

## Performance

- **Duration:** about 1h wall time, mostly waiting for CI runs and the owner's merge
- **Started:** 2026-10-21T18:00Z (approximate)
- **Completed:** 2026-10-21T18:57Z
- **Tasks:** 2 (tracer, owner merge hand-off)
- **Files modified:** 1 (`CI-SETUP-LEDGER.md`), plus this summary

## Accomplishments

- **PR A opened (Task 1).** #26 goes from `ci/setup-action` into `main` at head `43672635ca3fafe9c46c87c10c4fb0d96f6757e1`, whose tree equals 05-01's proven tree. Its files outside `.planning/` are exactly the five planned files. The body states the proof, the deploy consequence and the D-12 deviation with the ledger's sentence word for word. The title is `ci: share one setup action across the CI jobs`.
- **Six green jobs on the head.** Run 39650921896, attempt 1, no registry flake: lint, typecheck, test-unit, test-integration, test-e2e and build all `success`.
- **Before/after steps from CI (D-15).** Main's last green run (39645569683) versus PR A's run: in each job `Run pnpm/action-setup@v6`, `Run actions/setup-node@v7` and `Run pnpm install --frozen-lockfile` became one `Run ./.github/actions/setup`, and the two matching post steps became one post step. A programmatic collapse of the before lists equals the after lists for all six jobs. The setup step's log shows the three sub-steps ran (Node v24.21.0, pnpm cache hit, 869 packages). Ledger: `steps-compare=as-expected`.
- **Seed typechecked once in CI.** The typecheck log prints `supabase/seed typecheck$ tsc --noEmit` once and the service line as `tsc --noEmit` alone. Ledger: `ci-seed-typecheck=once`.
- **Owner merge and main's CI (Task 2).** The owner squash-merged #26 at 2026-10-21T18:31:35Z as `ac8ef34bb913418e425eca1157fb9249b6017733`. `main`'s CI run 39653516611 failed on attempt 1: five jobs passed and `test-e2e` failed one test of 104 (`18-chores-and-errands-offline.spec.ts:140`, journey 7 light: the 'Water plants' row did not show "Waiting to sync" after `page.reload()`). The owner approved one rerun as an exception to the registry-flake-only rule. Attempt 2 passed all six jobs. Ledger: `main-ci-after-a=` (attempt 1, failure kept) and `main-ci-after-a-rerun=` (attempt 2, six success).
- **Deploy.** The first Deploy run (39654799904) ended `cancelled` while CI was red. After the green rerun a new Deploy run (39657035815) for `ac8ef34` was created and was `pending`, waiting for the self-hosted `hearth` runner, when last read. No deploy had started yet.

## Task Commits

1. **Task 1: PR A opened, six green jobs, step comparison** - `9a0edc2` (docs: record PR A and its CI run)
2. **Task 2: merge and main CI, first result** - `5a4a88c` (docs: record PR A merge and main CI result)
3. **Task 2: rerun and green main CI** - `748ffb5` (docs: record the PR A rerun and green main CI)

**Plan metadata:** the `docs: complete plan 05-03` commit that adds this summary.

## Files Created/Modified

- `.planning/cleanup/CI-SETUP-LEDGER.md` - `pr-a=26`, `pr-a-ci=`, the per-job before/after table, `steps-compare=`, `ci-seed-typecheck=`, `pr-a-merged=`, `main-ci-after-a=`, `owner-decision=`, `main-ci-after-a-rerun=`
- `.planning/phases/05-redundancy-reduction-and-text-sync/05-03-SUMMARY.md` - this file
- Gitignored logs under `.planning/cleanup/logs/`: `05-03-pr-a.md`, `05-03-setup-step.log`, `05-03-typecheck.log`, `05-03-main-test-e2e.log`

## Decisions Made

- PR A's head was taken as the owner pushed it (43672635); nothing was pushed to `ci/setup-action` after that.
- The one rerun of `main`'s failed job was approved by the owner and queued by the orchestrator. I queued no rerun myself and none beyond that one was made.

## Deviations from Plan

None in the delivered work. Two points differ from the plan text:

- The plan names the working branch `claude/vigilant-gates-a4ihid`; the real one is `claude/eloquent-mayer-szjtjf`, as 05-01 recorded. The PR body's ledger link uses the real name.
- Plan step 8's rule treats only registry flakes as rerunnable. `main`'s `test-e2e` failure was not a registry failure, so the plan's own rule required a checkpoint:decision; the owner chose one rerun, and that decision is recorded in the ledger.

**Total deviations:** 0 auto-fixed. **Impact on plan:** none on the delivered tree.

## Issues Encountered

- **Intermittent e2e failure on main.** `tests/18-chores-and-errands-offline.spec.ts:140` (light variant) failed once on `ac8ef34` and passed on rerun with no code change; its dark variant and both variants in PR A's run passed. This looks like a timing flake in the offline queue test after a reload, and I did not investigate it. It is outside this plan's scope and is reported for the owner. It is not caused by the setup action: the failing lines do not touch setup, install or Node.
- A `git commit` hit an `index.lock` collision with plan 05-04's concurrent commit; waiting 10 s and retrying once succeeded.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The token was used only through the inline credential helper for the WB push and `gh` REST calls; the pattern and value scans over `.planning` are clean.

## Next Phase Readiness

- 05-05 syncs the working branch with `main` past PR A (`ac8ef34`). A workflow-scope refusal there follows the D-22 hand-off.
- `main` carries the composite action, so later PR CI runs use it.
- Deploy for `ac8ef34` is queued and waits for the self-hosted runner; this plan does not wait for it.

## Self-Check: PASSED

- `/home/user/hearth/.planning/cleanup/CI-SETUP-LEDGER.md` exists and holds `pr-a=`, `pr-a-ci=`, `steps-compare=as-expected`, `ci-seed-typecheck=once`, `pr-a-merged=` and `main-ci-after-a-rerun=`.
- Commits `9a0edc2`, `5a4a88c` and `748ffb5` are ancestors of the working branch.
- REST: PR #26 `merged` is true with merge commit `ac8ef34`; CI run 39653516611 attempt 2 is `completed success`.

---
*Phase: 05-redundancy-reduction-and-text-sync*
*Completed: 2026-10-21*
