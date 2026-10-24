---
phase: 06-ci-enforcement-and-lock-in
plan: 10
subsystem: infra
tags: [ci, deploy-gate, sweep, phase-close, owner-gate]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: PR 3 (#42) open and green on all seven jobs, main green on hygiene after the zod and undici/fast-uri fixes (06-09)
provides:
  - PR 3 squash-merged by the owner as f1c8583; main's CI on it passed all seven jobs
  - Deploy workflow_run created by CI's completion on that merge (CI-07 trigger observed); the deploy job itself not evaluated (runner not provisioned)
  - Sweep green on the merge push (36/36), by hand with the today cell (42/42) and on its first scheduled run (42/42)
  - the phase close in the ledger and REQUIREMENTS.md with CI-01 to CI-07 and TIME-06 complete (CI-07 with a caveat)
affects: []

actuals:
  tokens: 9000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "A Deploy run created by CI's completion proves the trigger; its job needs a registered runner and a free concurrency group to be evaluated"

key-files:
  created: []
  modified:
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "CI-07 is ticked complete with a caveat, not as strictly proven: the trigger fired within two seconds of green CI on f1c8583 and guard acceptance was seen on 5216fc7, but this merge's own deploy job was never evaluated (unprovisioned hearth runner, older queued run 40041408163 holds the concurrency group); the owner said the runner is not a requirement"
  - "The first scheduled Sweep ran about 4h20m after its 05:17 UTC cron (GitHub scheduling delay) and passed 42/42 with the today cell on Pacific/Pago_Pago"

requirements-completed: [CI-07, TIME-06]

plan_head_before: 64d23c112e6d73d913f6c70e930b29549cf93638
plan_head_after: c9fbad05e456f8998b7921dfc1473da33436a010

coverage:
  - id: D1
    description: "After PR 3's squash merge, CI concludes success and a Deploy workflow_run exists for the same SHA"
    requirement: CI-07
    verification:
      - kind: other
        ref: "CI push run 40059342546 on f1c8583: seven jobs success; Deploy run 40059927037 event workflow_run created 2s after CI completed (pending, no jobs: held behind queued run 40041408163); guard acceptance of a green push run observed on 5216fc7 (run 40041408163, deploy job queued on self-hosted,hearth)"
        status: partial
    human_judgment: true
  - id: D2
    description: "Sweep passes on the merge push, by hand with the today cell, and on its first scheduled run"
    requirement: TIME-06
    verification:
      - kind: other
        ref: "push run 40059342611 36/36; workflow_dispatch run 40060752810 42/42; schedule run 40082646319 42/42, six cell=today PASS lines, tz=Pacific/Pago_Pago, now=2026-10-24T09:37:11.818Z"
        status: pass
    human_judgment: false
  - id: D3
    description: "Requirements CI-01 to CI-07 and TIME-06 are complete with the CI-02 and CI-04 wording notes, and the ledger maps the five ROADMAP criteria to evidence"
    requirement: CI-07
    verification:
      - kind: other
        ref: ".planning/REQUIREMENTS.md lines CI-01..CI-07, TIME-06 ticked and traceability rows Complete; ledger '## Phase close' and phase6-close=done"
        status: pass
    human_judgment: false
---

# Phase 6 Plan 10: PR 3 merge, CI-07 and the phase close Summary

**PR 3 merged green and the Deploy workflow was triggered by CI's completion on it, the Sweep matrix passed on the merge push, by hand and on its first scheduled run, and Phase 6 is closed with CI-07 recorded as complete with a caveat (the deploy job could not be evaluated without a provisioned runner).**

## Performance

- **Duration:** about 10 hours of wall clock (2026-10-24 03:42Z to 13:30Z), almost all of it waiting for the first scheduled Sweep run, which GitHub started at 09:36Z.
- **Tasks:** 3 (one tracer, one owner step, one auto).
- **Files:** the ledger and `REQUIREMENTS.md` on WB.

## Accomplishments

- **Tasks 1 and 2 were satisfied by 06-09.** PR #42 (head `8b47f6b`, CI run 40058213754, seven jobs `success`) is the PR 3 of the plan; the owner squash-merged it at 2026-10-24T03:41:37Z as `f1c8583` (`pr3-merged=`). The owner did not cancel the older Deploy runs first (`deploy-cleared=no`).
- **CI on the merge.** Push run 40059342546 on `f1c8583` passed all seven jobs, `test-e2e` included, with no rerun.
- **Deploy (CI-07).** Two seconds after that run completed, Deploy run 40059927037 was created with event `workflow_run`: `deploy.yml` still fires from the workflow named `CI` after the workflow changes. The run is `pending` with no jobs, held by the `deploy` concurrency group behind the older run 40041408163 (for `5216fc7`, `deploy` job `queued` on `self-hosted, hearth`); the run 40057102510 was replaced by GitHub itself. The guard accepting a green push run was observed earlier on `5216fc7`. Nothing was cancelled or touched.
- **Sweep.** Push run 40059342611 (36/36); a manual `workflow_dispatch` run 40060752810 (42/42, today cell on `Pacific/Pago_Pago`, `now=2026-10-24T04:03:34.735Z`); and the first scheduled run 40082646319 (42/42, today cell on `Pacific/Pago_Pago`, `now=2026-10-24T09:37:11.818Z`, completed 10:00:22Z), which GitHub started about 4h20m after the 05:17 UTC cron.
- **Phase close.** The ledger's `## Phase close` maps the five ROADMAP success criteria to evidence keys and lists the deferred items; `phase6-close=done`. `REQUIREMENTS.md` ticks CI-01 to CI-07 and TIME-06 (the first seven were ticked in 06-09), with the CI-02 and CI-04 wording notes and a CI-07 caveat.
- **WB sync.** `origin/main` (`f1c8583`) was merged into WB as `de4b338`; the four `.planning` conflicts were resolved with `git checkout --ours` under the owner's authorization; outside `.planning/` WB equals `main`.

## Task Commits

1. **Task 1/2 (records)**: WB `5a0b522` docs: record PR 3 green and merged by the owner
2. **Task 3**: WB `ab43051` docs: record CI-07 partial evidence and the sweep today cell; `de4b338` merge of `origin/main`; `c9fbad0` docs: close phase 6 with the CI-07 caveat and the nightly sweep

(`commits: 6` is the measured `rev-list` count since `64d23c1`; it also counts `f1c8583` and `7d2b84e`, the commits from `main` that the sync merged in.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Judgment on plan acceptance] CI-07 ticked as complete with a caveat, `ci07=proven` not written**
- **Found during:** Task 3 step 2
- **Issue:** The plan requires the Deploy run's `deploy` job to be `queued`, `in_progress` or `success` on the `hearth` labels, and sends a pending run to a checkpoint asking the owner to cancel the holder. This merge's run stayed `pending` with no jobs: the older run 40041408163 holds the concurrency group and no runner is provisioned.
- **Fix:** The owner answered that the runner is not provisioned yet and is not a requirement, and asked that 40041408163 be left alone. The trigger (the requirement's and ROADMAP criterion 5's wording) is recorded as observed, guard acceptance as observed on `5216fc7`, and the ledger carries `ci07=partial` and `ci07-closure=complete-with-caveat`. A strict proof needs the older run cancelled or a runner registered.
- **Files modified:** `.planning/cleanup/CI-ENFORCEMENT-LEDGER.md`, `.planning/REQUIREMENTS.md`

**2. [Plan text adapted] Tasks 1 and 2 carried out earlier**
- PR 3 was opened and merged as PR #42 during 06-09 (after two owner-merged dependency-fix PRs, #38 and #43, recorded in the 06-09 summary), so 06-10 only recorded the keys. The plan's step 1 of Task 3 (the 75-minute poll) and the Deploy poll were done against `f1c8583`.

### Rule 9 decisions (not code deviations)

- None in this plan: `test-e2e` passed on the merge commit's first attempt. The notification E2E flakiness evidence from 06-08 and 06-09 is carried in the ledger's deferred items (DA-4).

## Known Stubs

None.

## Issues Encountered

- The `deploy` job for the PR 3 merge was never evaluated (above). Deploy runs 40041408163 (queued) and 40059927037 (pending) remain; the owner chose not to cancel.
- GitHub started the first scheduled Sweep about 4h20m late; the matrix itself passed.
- The date-dependent audit gate turned `hygiene` red twice (zod, then undici and fast-uri) and held back deploys until owner-merged fix PRs #38 and #43; the phase close lists what the owner may want to decide about it.

## User Setup Required

Register the `hearth` self-hosted runner when deploys are wanted (not required now); until then Deploy runs wait. Triage open Dependabot PRs #39, #40, #41 and remove the leftover sibling worktrees when convenient.

## Next Phase Readiness

Phase 6 is complete and, with it, the planned work of the milestone. Phase verification and the milestone audit are next.

## Self-Check: PASSED

- WB commits `5a0b522`, `ab43051`, `de4b338` and `c9fbad0` are ancestors of HEAD, and `f1c8583` (PR 3's squash commit) is an ancestor of HEAD.
- The ledger has `pr3-merged=`, `main-ci-after-pr3=`, `ci07-ci-run=`, `ci07-deploy-run=`, `ci07-deploy-job=`, `ci07=partial`, `sweep-second-push=`, `sweep-today=`, `sweep-first-nightly=`, `## Phase close` and `phase6-close=done`.
- REST: PR #42 merged as `f1c858395725c1d72a004a704dc0a0c3e31e2df4`; schedule run 40082646319 `success`; token pattern and value scans under `.planning` are clean.
