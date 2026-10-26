---
phase: 05-redundancy-reduction-and-text-sync
plan: 05
subsystem: testing
tags: [git, pull-request, jscpd, fixtures, ci, vitest]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-03: PR A squash commit ac8ef34 on main; 05-02 and 05-04: test/shared-fixtures-wip at 8a7e8e4 with the service and web fixture work"
provides:
  - working branch synced past PR A by one ordinary merge of origin/main (post-a-sync=claude)
  - PR B (#27) opened from test/shared-fixtures with six green CI jobs, squash-merged by the owner as a660d58
  - final jscpd scan 66 clones / 858 duplicated lines (1.11%) against the Phase 2 baseline of 96 / 1,438 (1.87%)
  - integration test count 1190 on PR B's head equal to main's last green run
affects: [05-06 PR C start, 05-13 redundancy index, 06 CI work]

actuals:
  tokens: 9500
  tasks: 3
  commits: 4

# commits: measured on the working branch from plan_head_before: the sync merge 1ab6170 and the three
# ledger commits (1a56e7d, f8a347c, 793fa88); `git rev-list --count 305f2b3..793fa88` is 5 because
# it also counts PR A's squash commit ac8ef34, which arrived through that merge. The close-out commit
# `docs: complete plan 05-05` follows plan_head_after and adds this summary.
plan_head_before: 305f2b3c9045a337dd64b15025e36a4d90a0adde
plan_head_after: 793fa8886f27000fa45eedc7f1000413b3454afa

tech-stack:
  added: []
  patterns:
    - "A code branch is cut from the synced working branch and takes the fixture commits by cherry-pick, proven with git patch-id --stable over apps/"
    - "A fixture refactor that touches integration tests is proven by the equal Tests N passed line of the test-integration job on the PR head and on main's last green run"

key-files:
  created:
    - .planning/cleanup/jscpd/phase5-05-05/jscpd-report.json
    - .planning/phases/05-redundancy-reduction-and-text-sync/05-05-SUMMARY.md
  modified:
    - .planning/cleanup/CI-SETUP-LEDGER.md
    - .planning/cleanup/FIXTURE-LEDGER.md

key-decisions:
  - "The WB sync push to the working branch was accepted without a workflow-scope refusal, so the D-22 hand-off (patch plus apply.sh) was not needed"
  - "PR B's head merges the working branch's newer .planning state after the cherry-pick, so the head SHA is 8e3239b while the code is the cherry-picked 13fcc01"

patterns-established:
  - "Compare the final Tests N passed line of test-integration on the PR and on main to prove no integration test was silently skipped"

requirements-completed: [RED-03]

duration: ~1h45m wall time including CI waits (two CI runs of about 12 minutes) and the owner's merge
completed: 2026-10-21
status: complete
---

# Phase 5 Plan 05: PR B landing Summary

**The working branch was synced past PR A with one ordinary merge, the nine fixture commits were cherry-picked onto it with an identical patch, and PR B (#27) merged with six green jobs, 66 jscpd clones against the 96 baseline, and 1190 integration tests equal to `main`'s.**

## Performance

- **Duration:** about 1h45m wall time, mostly CI waits and the owner's merge
- **Completed:** 2026-10-21
- **Tasks:** 3 (one tracer, one auto, one owner hand-off)
- **Files modified:** two ledgers, one jscpd report, this summary on the working branch; 41 test files and helpers under `apps/` ride in PR B

## Accomplishments

- **Sync (Task 1).** `post-a-sync=claude`. One ordinary `git merge origin/main` in the throwaway worktree `../hearth-sync` was clean. Outside `.planning/` the merge equals `main` (`ac8ef34`), and its diff against the prior tip is exactly PR A's five files. It was pushed once to the working branch (`1ab6170`) with the inline credential helper; GitHub accepted it with no `workflow`-scope refusal, so no patch hand-off was written.
- **PR B head.** `test/shared-fixtures` was cut from `1ab6170` and the nine wip commits (`4e39165..8a7e8e4`) were cherry-picked without conflict. `pr-b-patch-id=4e14160077f92434539b1111d2fab446a0b88000` is identical for the wip branch and the new branch over `apps/`. Head after merging the working branch's later `.planning/` state: `8e3239b0f8068540ee1fce85b03668eb034bee04`.
- **Local gates (Task 2).** `frozen`, `lint`, `format-check`, `typecheck`, `test-workspaces`, `harness`, `build` and `commitlint` all `exit=0` on Node 24.21.0. Workspace test counts: matching 156, shared 172, recurrence 77, service 757, web 728, equal to `origin/main` and to the recorded before counts.
- **Final scan.** 66 clones, 858 duplicated lines, 1.11%. The Phase 2 baseline was 96 / 1,438 / 1.87%; `main` was 99 / 1,472 / 1.90% before this phase's edits. No pair names a helper file. `knip-new=` lists only the two `.planning/cleanup/tools/*.mjs` files lines.
- **PR B and CI.** #27 from `test/shared-fixtures` into `main`; its 66 files are under `.planning/`, `apps/service/src/` and `apps/web/src/` only. `pr-b-ci`: run 39658694324, attempt 1, all six jobs `success`. `pr-b-integration-tests=1190` equals `main-integration-tests=1190` (76 files each; `main`'s from run 39653516611 attempt 2).
- **Owner merge (Task 3).** The owner squash-merged #27 at 2026-10-21T19:23:45Z as `pr-b-merged=a660d58101321dbfa0d98c2ceb93783e06ed161c`. `main-ci-after-b`: run 39661257811, attempt 1, all six jobs `success`, no rerun. Deploy run 39662881431 was `pending` for the self-hosted runner when last read.

## Task Commits

1. **Task 1: sync and PR B head** - `1ab6170` (merge of `origin/main`), `1a56e7d` (docs: record the sync after PR A and PR B's head)
2. **Task 2: gates, scan, PR, CI** - `f8a347c` (docs: record PR B and its CI run)
3. **Task 3: merge and main CI** - `793fa88` (docs: record the PR B merge and main's CI)

**Plan metadata:** the `docs: complete plan 05-05` commit that adds this summary and the state updates.

PR B's code commits on `test/shared-fixtures`: d8f328d, 21caae6, ee7b4bc, dd857dd, a24f597, 0eb8664, 646f905, 56c0d69, 13fcc01 (squashed into `a660d58` on `main`).

## Decisions Made

- No D-22 hand-off: the sync push was accepted, so the fallback in the plan stayed unused.
- Pushes to `test/shared-fixtures` and the working branch were plain fast-forwards or new branches; `main` was never pushed.

## Deviations from Plan

- The plan names the working branch `claude/vigilant-gates-a4ihid`; the real one is `claude/eloquent-mayer-szjtjf`, as 05-01 and the orchestrator recorded. The sync push targeted only that branch.
- I amended the unpushed sync merge's message before the first push to add the attribution trailers. Nothing published was rewritten.

**Total deviations:** 0 auto-fixed. **Impact on plan:** none.

## Issues Encountered

None. No registry flake, no rerun, no conflict.

## Known Stubs

None.

## Threat Flags

None. Tests and test helpers only. The token was used once through the inline credential helper for the sync push and for `gh` REST calls; the tracked-pattern scan printed nothing and the token value scan passed.

## Next Phase Readiness

- RED-03 is complete: shared fixtures live in `apps/service/src/test/` and `apps/web/src/test/`, tests pass in CI, and the clone count is 66, below 96.
- 05-06 starts PR C from a working branch synced with `main` past PR B (`a660d58`).
- Deploy for `a660d58` waits for the self-hosted runner; this plan does not wait for it.

## Self-Check: PASSED

- Ledgers hold `post-a-sync=claude`, `pr-b-patch-id=`, `final-b-clones=66`, `pr-b=27`, `pr-b-ci=`, `pr-b-integration-tests=1190`, `main-integration-tests=1190`, `pr-b-merged=` and `main-ci-after-b=`.
- Commits `1ab6170`, `1a56e7d`, `f8a347c` and `793fa88` are ancestors of the working branch; `a660d58` is on `origin/main`.
- REST: PR #27 `merged` is true with merge commit `a660d58`; CI run 39661257811 is `completed success`.

---
*Phase: 05-redundancy-reduction-and-text-sync*
*Completed: 2026-10-21*
