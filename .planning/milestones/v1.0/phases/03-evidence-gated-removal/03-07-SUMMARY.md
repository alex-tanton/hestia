---
phase: 03-evidence-gated-removal
plan: 07
subsystem: pr2-landing
tags: [knip, dead-code, pull-request, ci, fixed-point, pr-2]

requires:
  - phase: 03-evidence-gated-removal
    provides: "03-03 to 03-05 refactor/dead-exports content (ledger rows 2 to 62); 03-02 PR 1 merged as 51c077e; 03-06 stale-reference sweep"
provides:
  - "PR 2 (#13, refactor/dead-exports into main) open with all six CI jobs green, waiting for the owner's squash merge"
  - "Knip fixed point at the PR 2 tip under default, production and nonode, fully explained by the ledger"
  - "orphan-docs result at the tip (1 hit, not orphaned, nothing reworded) and the PR 2 tip column of the ledger counts"
affects: [03-08, 03-09]

tech-stack:
  added: []
  patterns: ["ledger check of base versus tip summaries in three configs", "rerun-failed-jobs for the documented ECR pre-pull flake"]

key-files:
  created:
    - .planning/cleanup/knip/phase3-pr2-default-summary.txt
    - .planning/cleanup/knip/phase3-pr2-production-summary.txt
    - .planning/cleanup/knip/phase3-pr2-nonode-summary.txt
  modified:
    - .planning/cleanup/REMOVAL-LEDGER.md

key-decisions:
  - "gate-pr2=approve (owner, 2026-10-19): PR 2 opened only after the answer was committed and pushed"
  - "test-e2e re-run twice for the ECR toomanyrequests flake; no removal reverted"

requirements-completed: []

plan_head_before: dcc0485389267670ef6c7b93f0e2ad9f3af97754
plan_head_after: 0e5e5271616055ac61269d7a19e7d2206d331958
commits: 6
actuals:
  tokens: 6000
  tasks: 3
  commits: 6

duration: resumed session (Task 1 earlier, Tasks 2 and 3 on 2026-10-19)
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 07: PR 2 fixed point, owner gate and CI Summary

**PR 2 (#13) is open from `refactor/dead-exports` into `main` at head `5f5b090`, all six `CI` jobs are `success` (test-e2e on its third attempt after two ECR pre-pull flakes), and the owner's squash merge is the only step left.**

## What happened

- **Task 1 (earlier session):** PR 1 (#12) was merged as `51c077e`; `origin/main` was merged into the working branch (`1103639`) and into `refactor/dead-exports` (`5f5b090`) by plain merges. The ledger check exited 0 on the three base and tip pairs (default 54 to 1, production 79 to 28, nonode 57 to 1). DEAD-01 holds: no file removed, `normalized-fixtures.ts` kept (D-04). The orphan-docs re-check found one hit (`DispatchOutbox` at `docs/architecture.md:58`), not orphaned because the interface is still declared in `jobs/dispatch-notifications.ts`; nothing reworded. All seven local gates and the 36-cell sweep passed.
- **Task 2 (owner gate):** the owner answered `approve` on 2026-10-19. `gate-pr2=approve (owner, 2026-10-19)` is in the ledger under `## Gates and decisions` (commit `6342995`, pushed). No pull request existed for the branch before that line.
- **Task 3:** PR 2 opened through REST with the drafted body (`$L/03-07-pr2.md`, which ends with the Claude Code footer and the session link). `pr2=13` and `pr2-head=5f5b090df761eb3eeb067e4c889c2a475bdf63b5` recorded (`c2ea36c`).

## CI result

| Job | Conclusion |
| --- | --- |
| lint | success |
| typecheck | success |
| test-unit | success |
| test-integration | success |
| test-e2e | success (attempt 3) |
| build | success |

Run id `39338329263` (event `pull_request`, head `5f5b090`). `test-e2e` attempts 1 and 2 failed in the image pre-pull step (`Could not pull public.ecr.aws/supabase/gotrue:v2.196.0 after 6 attempts`, `toomanyrequests: Data limit exceeded`), before `pnpm test:e2e` ran. `rerun-failed-jobs` was called twice (limit of three, rule 10), and attempt 3 passed, building both images through Compose. The other five jobs passed on attempt 1. Job logs: `$L/03-07-job-test-e2e.log`, `$L/03-07-job-test-e2e-attempt2.log`. `pr2-ci=` is in the ledger (`0e5e527`).

## PR 2 tip totals

| Config | Base | PR 2 tip |
| --- | --- | --- |
| default | 54 | 1 (`tailwindcss`, D-04 keep) |
| production | 79 | 28 (base 79 plus the Kept `knip-summary.mjs` line, minus 52) |
| nonode | 57 | 1 (`tailwindcss`) |

The PR 2 diff is 20 files modified (14 insertions, 162 deletions), none deleted.

## Reverted items

None. Nothing moved from Removals to Kept for CI.

## Deviations from Plan

None. The plan executed as written. The ECR flake re-runs are the documented procedure, not a deviation.

## Known Stubs

None. No code was added.

## Threat Flags

None. This plan changed only `.planning/` files on the working branch; PR 2's own diff was checked against T-03-20 to T-03-22 in Task 1 (nothing under `.planning`, `.claude`, `supabase`, `docker`, `.github`, `privileged/`, `eslint.config.js` or `knip.json`).

## Not done here

PR 2 is not merged (the executor merges nothing). Plan 03-08 opens PR 3 only after the owner's squash merge of PR 2, and the merge queues a Deploy run. `requirements-completed` is none.

## Self-Check: PASSED

- Files exist: the three `phase3-pr2-*` summaries, the ledger, this summary.
- Commits `6342995`, `c2ea36c`, `0e5e527` are ancestors of the working-branch HEAD and the remote working branch equals HEAD; `git ls-remote origin refactor/dead-exports` equals `5f5b090df761eb3eeb067e4c889c2a475bdf63b5`.
- Task 3 verify command printed OK. The raw `commits:` count of 6 comes from `rev-list dcc0485..HEAD` and includes the merged-in PR 1 squash commit `51c077e`; five are this plan's own working-branch commits before this summary.
