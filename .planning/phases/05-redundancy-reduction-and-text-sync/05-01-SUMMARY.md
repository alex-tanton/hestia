---
phase: 05-redundancy-reduction-and-text-sync
plan: 01
subsystem: infra
tags: [github-actions, composite-action, ci, dependabot, typecheck, actionlint]

requires:
  - phase: 02-deterministic-tests
    provides: the green CI suite the equivalence proof is measured against
provides:
  - .github/actions/setup, a three-step composite action (pnpm, Node from .nvmrc with the pnpm cache, frozen install) called by all six CI jobs
  - branch ci/setup-action on origin (PR A content, five files), pushed by the owner through apply.sh
  - .planning/cleanup/tools/expand-compare.mjs, the expanded-steps equivalence proof with a mutant negative control
  - .planning/cleanup/tools/cit-rx.txt, the retired-spec citation vocabulary later checks read
  - .planning/cleanup/CI-SETUP-LEDGER.md with the D-12 owner-decision row and the pr-a-body-d12 sentence for PR A
affects: [05-03 PR A landing, 05-05 WB sync past PR A, 05-06 to 05-10 citation cleanup, 05-13 redundancy index]

actuals:
  tokens: 4182
  tasks: 3
  commits: 7

# commits: 3 on ci/setup-action (c64d79e..2344443) plus 4 task commits on the working branch
# (9f76f22, cbe7282, 7aa0e3c, 4e39165). A plain base..HEAD count on the working branch would also
# include the orchestrator's state commit and plan 05-02, so it is not used here.
plan_head_before: c64d79e41ae7daab9ca48e3841a08db1446c64e5
plan_head_after: 4e39165141ea1c6655f1bcc6a357c2bf0511726a

tech-stack:
  added: []
  patterns:
    - "A local composite action holds the shared job preamble; each job keeps actions/checkout first because a local action is read from the checked-out workspace"
    - "A refactor of workflow YAML is proven by expanding the composite back into every job and deep-comparing the parsed result, with a mutated action as a negative control"
    - "A push GitHub refuses for lack of the workflow scope is handed over as format-patch files plus an apply script that pushes only when the tree equals the proven tree"

key-files:
  created:
    - .github/actions/setup/action.yml
    - .planning/cleanup/CI-SETUP-LEDGER.md
    - .planning/cleanup/tools/expand-compare.mjs
    - .planning/cleanup/tools/cit-rx.txt
    - .planning/cleanup/patches/ci-setup-action/apply.sh
    - .planning/cleanup/patches/ci-setup-action/0001-ci-share-one-setup-action-across-the-six-CI-jobs.patch
    - .planning/cleanup/patches/ci-setup-action/0002-chore-typecheck-the-seed-workspace-only-once.patch
    - .planning/cleanup/patches/ci-setup-action/0003-ci-watch-the-setup-action-and-drop-two-spec-citation.patch
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/deploy.yml
    - .github/dependabot.yml
    - apps/service/package.json

key-decisions:
  - "D-12 deviation: the composite holds three steps, not four. Each job keeps actions/checkout@v7 first, because a local action cannot load before checkout. Recorded as an owner decision in CI-SETUP-LEDGER.md for PR A's body."
  - "D-14: apps/service typecheck is exactly tsc --noEmit; the seed is typechecked once, by @hearth/seed's own script"
  - "Dependabot's github-actions entry scans / and /.github/actions/setup so the two actions in the composite keep getting weekly bumps"
  - "The two workflow comments lose their retired-spec citations in PR A, so PR C never needs the workflow scope"
  - "The plan's working branch name claude/vigilant-gates-a4ihid does not exist; claude/eloquent-mayer-szjtjf, where the session ran, serves as WB for the phase"

requirements-completed: []  # RED-01, RED-02 and RED-04 are in the plan's requirements, but PR A is not merged yet

coverage:
  - id: D1
    description: "All six CI jobs run their setup through one local composite action; workflow name CI and job ids unchanged"
    requirement: "RED-01"
    verification:
      - kind: other
        ref: "node .planning/cleanup/tools/expand-compare.mjs (prints OK, jobs: lint, typecheck, test-unit, test-integration, test-e2e, build; the cache: npm mutant exits 1)"
        status: pass
      - kind: other
        ref: "actionlint .github/workflows/ci.yml .github/workflows/deploy.yml"
        status: pass
    human_judgment: true
    rationale: "The real end-to-end proof is PR A's own six-job CI run, observed in 05-03"
  - id: D2
    description: "The seed workspace is typechecked once by pnpm -r typecheck"
    requirement: "RED-02"
    verification:
      - kind: other
        ref: "pnpm -r --reporter=append-only typecheck (05-01-typecheck-after.log: one supabase/seed line, apps/service tsc --noEmit only)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two workflow comments state their rule without a retired-spec citation; Dependabot watches the composite action"
    requirement: "RED-04"
    verification:
      - kind: other
        ref: "parsed deploy.yml deep-equals its base; git grep -nE -f cit-rx.txt -- .github prints nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "ci/setup-action is on origin with the proven tree"
    verification:
      - kind: other
        ref: "git ls-remote --heads origin ci/setup-action = 43672635ca3fafe9c46c87c10c4fb0d96f6757e1; tree fd704a4c1fbb066fb7402eaee02a950aae456177 equals the ledger tree"
        status: pass
    human_judgment: false

duration: ~45min active, plus the owner's push hand-off
completed: 2026-10-21
status: complete
---

# Phase 5 Plan 01: CI setup action Summary

**One local composite action (pnpm, Node from .nvmrc with the pnpm cache, frozen install) now serves all six CI jobs, proven equal to the old workflow by expansion, with the seed typechecked once and `ci/setup-action` on origin through an owner hand-off.**

## Performance

- **Duration:** about 45 min of executor time, excluding the wait for the owner's push
- **Started:** 2026-10-21T17:25Z (approximate)
- **Completed:** 2026-10-21
- **Tasks:** 3 (tracer, auto, owner hand-off)
- **Files modified:** 5 in the PR A branch, 8 added under `.planning/`

## Accomplishments

- **Composite action (RED-01).** `.github/actions/setup/action.yml` runs `pnpm/action-setup@v6`, `actions/setup-node@v7` (`node-version-file: .nvmrc`, `cache: pnpm`), then `pnpm install --frozen-lockfile` (`shell: bash`). Each of the six jobs keeps `actions/checkout@v7` first and then calls `./.github/actions/setup`. The Supabase CLI step stays inline in `test-integration` and `test-e2e`.
- **Equivalence proof.** `expand-compare.mjs` expands the composite back into every job and deep-compares the parsed YAML with the pre-change workflow. It also asserts the name `CI` and the ordered job ids. It prints `OK`; with `cache: npm` in the action it exits 1. Actionlint is clean.
- **Seed typecheck (RED-02).** The service `typecheck` script is `tsc --noEmit`. Before, the log had `apps/service typecheck$ tsc --noEmit && tsc --noEmit -p ../../supabase/seed` plus `supabase/seed typecheck$ tsc --noEmit`. After, the seed runs once.
- **Dependabot and comments (RED-04).** The github-actions entry scans `/` and `/.github/actions/setup`. The two citation comments in `deploy.yml` and `ci.yml` are reworded; the parsed `deploy.yml` equals its base and no citation remains under `.github`.
- **Push outcome.** GitHub refused the `GH_TOKEN` push for lack of the `workflow` scope (D-22). The three patches and `apply.sh` were committed on the working branch; its dry run printed `tree matches`. The owner ran it (on Windows Git Bash with `MSYS_NO_PATHCONV=1`). Origin now holds `ci/setup-action` at `43672635ca3fafe9c46c87c10c4fb0d96f6757e1`, tree `fd704a4c1fbb066fb7402eaee02a950aae456177`, equal to the ledger's tree, and its diff against `origin/main` is exactly the five planned files.

## Task Commits

On `ci/setup-action` (local SHAs; origin has re-committed equivalents with the same tree):

1. Task 1 composite action: `86666b2` ci: share one setup action across the six CI jobs
2. Task 2 seed typecheck: `cfc666a` chore: typecheck the seed workspace only once
3. Task 2 Dependabot and comments: `2344443` ci: watch the setup action and drop two spec citations

On the working branch `claude/eloquent-mayer-szjtjf`:

- `9f76f22` docs: record the CI setup action proof (ledger, `expand-compare.mjs`)
- `cbe7282` docs: hand off the CI setup branch as patches
- `7aa0e3c` docs: record the seed typecheck and push outcome (`cit-rx.txt`, dry-run result)
- `4e39165` docs: mark the CI setup hand-off script executable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Working branch name**
- **Found during:** Task 1 setup
- **Issue:** The plan fixes the working branch as `claude/vigilant-gates-a4ihid`. That branch exists neither locally nor on origin; the session ran on `claude/eloquent-mayer-szjtjf`, and the orchestrator directed commits there.
- **Fix:** Treated `claude/eloquent-mayer-szjtjf` as WB, pushed it to origin as a new branch, and baked its name into `apply.sh` and the owner command. Recorded in the ledger. Later plans must use the same branch.
- **Commit:** n/a (naming only)

**2. [Rule 1 - Bug] Executable bit lost by a path-limited commit**
- **Found during:** Task 2 verification
- **Issue:** `git commit -- {paths}` recorded `apply.sh` as 100644 although it had been staged with `--chmod=+x`.
- **Fix:** `git update-index --chmod=+x` and a follow-up commit, `4e39165`; `git ls-tree` shows 100755.
- **Files modified:** `.planning/cleanup/patches/ci-setup-action/apply.sh`

**3. [Rule 1 - Bug] ESLint `no-unused-vars` in the proof tool**
- **Found during:** Task 1 step 5
- **Issue:** Destructuring `shell` out of each step to drop it left an unused variable.
- **Fix:** Clone the step and `delete copy.shell`. The tool passes ESLint with zero warnings.

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs). **Impact:** none on the delivered tree. The branch-name substitution is the one later plans must repeat.

## Authentication Gates

**Task 2 push, then Task 3 (human-action):** the session token has no `workflow` scope (scopes seen: `gist, read:org, repo`), so GitHub refused creating a branch that changes `.github/workflows/ci.yml`. This is the planned D-22 path, not a failure. The owner ran the recorded `apply.sh` command from their own clone, which pushed the proven tree. Windows Git Bash needed `MSYS_NO_PATHCONV=1` for it.

## Issues Encountered

- The shell default was Node 22.22.0, so all gates ran on the installed Node 24.21.0 (`/opt/node-v24/bin`).
- No `Tests  N passed` count changed: matching 156, shared 172, recurrence 77, service 757, web 728 before and after; `pnpm test:harness` passes.
- Integration, E2E and the Docker images were not run locally; PR A's CI in 05-03 is the end-to-end evidence.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the local composite action and a Dependabot directory, both in the plan's threat model (T-05-01, T-05-04). The token never appeared in a file, commit, log or command line; the pattern and value scans over `.planning` are clean.

## Next Phase Readiness

- 05-03 opens PR A from `ci/setup-action` and must paste the ledger's `pr-a-body-d12=` sentence into the PR body.
- 05-04 (web fixtures) does not depend on this plan.
- 05-05 syncs the working branch past PR A after the owner merges it; a workflow-scope refusal there follows the D-22 hand-off, and a WB sync that carries `.github` changes will hit the same token limit.

## Self-Check: PASSED

- `.github/actions/setup/action.yml`, `.planning/cleanup/CI-SETUP-LEDGER.md`, `expand-compare.mjs`, `cit-rx.txt` and `apply.sh` exist, and `apply.sh` is 100755 in the index.
- Commits `9f76f22`, `cbe7282`, `7aa0e3c` and `4e39165` are ancestors of the working branch; `86666b2`, `cfc666a` and `2344443` are on the local `ci/setup-action` worktree.
- Origin `ci/setup-action` is at `43672635ca3fafe9c46c87c10c4fb0d96f6757e1` with the ledger's tree.
