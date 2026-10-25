---
phase: 06-ci-enforcement-and-lock-in
plan: 05
subsystem: infra
tags: [ci, pull-request, deploy, gate-scripts]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: ci/gate-scripts at f79f84e (pr1-head) and the owner's gate-pr1=approve-pr1 (06-04)
provides:
  - PR 1 (#33) opened at pr1-head with six green CI jobs, the new harness tests seen running on a hosted runner
  - PR 1 squash-merged by the owner as b585d25; main's CI on it recorded with six green jobs
  - the queued Deploy run recorded (pending on the unregistered self-hosted runner)
  - WB synced with origin/main (contains b585d25 and the dependency fix f624a34), ready for PR 2
affects: [06-06, 06-07, 06-09, 06-10]

actuals:
  tokens: 4000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Open the pull request through REST only after the owner's gate reply is in the ledger; the owner merges; Claude records the squash commit, main's CI and Deploy afterwards"

key-files:
  created: []
  modified:
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md

key-decisions:
  - "A Deploy run that stays pending for the unregistered self-hosted runner is recorded, not awaited (expected, CONTRIBUTING.md)"

requirements-completed: []

plan_head_before: 3ff35c4e4dc76ea5f4d9cac27eb80cf709c09703
plan_head_after: eeb4c7095559e69346c2e89866b99baa6eb49951

coverage:
  - id: D1
    description: "PR 1 opened at the proven head with the six CI jobs green and the thirteen harness files run on CI"
    requirement: CI-01
    verification:
      - kind: other
        ref: "PR #33 head f79f84e, CI run 40007205181: lint, typecheck, test-unit, test-integration, test-e2e, build all success; test-unit log shows node --test over 13 files, 382 of 382 pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "PR 1 merged by the owner; main's CI on the squash commit is green; Deploy run recorded; WB synced"
    requirement: CI-05
    verification:
      - kind: other
        ref: "pulls/33 merged=true, merge_commit_sha b585d25; CI push run 40009409885 six success; Deploy run 40011784566 workflow_run pending; git merge-base --is-ancestor b585d25 HEAD"
        status: pass
    human_judgment: false
---

# Phase 6 Plan 05: PR 1 landing Summary

**PR 1 (#33) carried the CI gate scripts to `main` as squash commit `b585d25` with six green jobs on the PR and on `main`; nothing blocks in CI until PR 2.**

## Performance

- **Tasks:** 3 (one tracer, one owner checkpoint, one recording task); the two executor sessions were separated by the owner's merge.
- **Files:** one planning file changed by the plan itself (the ledger), plus the WB sync with `main`.

## Accomplishments

- Opened PR #33 from `ci/gate-scripts` at `pr1-head` `f79f84e` into `main`, with the title `ci: add the CI gate scripts and their tests`. The branch's tree is the recorded `pr1-tree`.
- The six `CI` jobs on the PR head (run 40007205181) all concluded `success` on the first attempt, with no registry-flake rerun. The `test-unit` log shows `node --test` over the thirteen harness files, 382 of 382 passing, so the six new harness tests pass on GitHub-hosted runners.
- The owner squash-merged #33 at 2026-10-23T19:11:17Z as `b585d25`, after PR #32 (`f624a34`, fastify 5.12.6 and the `ip-address` override) had landed, so `main` now has the dependency fix the audit gate needs.
- `main`'s `CI` push run 40009409885 on `b585d25` waited `pending` for about two minutes, then all six jobs concluded `success`.
- The Deploy runs for `b585d25` were recorded without touching them: 40009996509 ended `cancelled` (replaced by the `deploy` concurrency group) and 40011784566 is `pending` with no jobs, held for the unregistered `hearth` self-hosted runner, as are older runs for `cb808e6`.
- WB was merged with `origin/main` (`eeb4c70`); WB contains `b585d25` and is pushed.

## Task Commits

1. **Task 1 (tracer)**: `2d828d2` docs: record PR 1 and its CI run
2. **Task 2 (owner merge)**: no commit; the owner merged #33.
3. **Task 3**: `b81a011` docs: record PR 1 merge, main CI and Deploy run, then the WB sync merge `eeb4c70`

`commits: 4` counts the first-parent commits from `plan_head_before` (the three above plus this summary's own commit); `plan_head_after` is the sync merge, the head before that final commit.

## Deviations from Plan

None in the work itself. Notes:

- The PR body was edited once with a REST PATCH right after opening, to rewrap four lines that exceeded 100 characters. The head SHA did not change.
- The sync merge conflicted in four planning files (`ROADMAP.md`, `STATE.md`, `state.json` and the ledger, an add/add because `main` carries the ledger as part of the squash). All four are under `.planning/**` and were resolved with `--ours`, as rule 7 allows. A diff of the merge result against `origin/main` outside `.planning/` is empty.
- The Deploy workflow shows two `workflow_run` runs for `b585d25`; the first (created at 19:15:42Z, before `main`'s CI finished) ended `cancelled` through the concurrency group. I did not investigate why it was created early; it is recorded as observed.

## Known Stubs

None.

## Issues Encountered

- `main`'s `CI` run sat `pending` for about two minutes before starting; it was polled to completion.
- Deploy stays `pending` until a `hearth` self-hosted runner is registered (CONTRIBUTING.md); nothing deploys from it yet.

## User Setup Required

None.

## Next Phase Readiness

PR 2 can be cut from a WB tip that contains PR 1's squash commit `b585d25` and the dependency fix, so `audit-prod.mjs` is no longer red on `main`.

## Self-Check: PASSED

- `b585d25`, `2d828d2`, `b81a011` and `eeb4c70` exist and are ancestors of HEAD.
- The ledger has `pr1=33`, `pr1-ci=`, `pr1-harness-on-ci=13`, `pr1-merged=b585d25…`, `main-ci-after-pr1=` with six successes and `deploy-after-pr1=40011784566 workflow_run pending job=none`.
- `.planning/cleanup/logs/06-05-test-unit.log` and `06-05-pr1.md` exist (gitignored).
