---
phase: 01-git-history-curation-and-branch-policy
plan: 02
subsystem: infra
tags: [git, history-rewrite, rebase, commitlint, husky, filter-branch, contributing, branch-policy]

requires:
  - phase: 01-01
    provides: "approved todo (43 pick, 8 fixup, 11 exec), 11 commitlint-clean messages, curated-main worktree at b96ca32, Gate 1 approve-personal"
provides:
  - "curated-main (local only): 43 curated product commits plus 1 policy commit on 7da55e3, tip 83eae2c"
  - "Single published identity alex.c.tanton@gmail.com on all 44 commits (author and committer)"
  - ".husky/pre-commit and .husky/commit-msg at 100755 from the rewritten 3ae2afd (now 27d1e5e) onward"
  - "Root CONTRIBUTING.md (D-08 branch and PR policy) and a docs/file-map.md row"
  - "Proof logs in ../hearth-aside/logs/ (quick-proof-02.txt, dry-run-curated.txt, dry-run-final.txt, email and identity before/after)"
affects: [01-03, 01-04, 01-05]

actuals:
  tokens: 800
  tasks: 2
  commits: 44
plan_head_before: b96ca32ac1130c09f8aa3066d715181ddf3fb31a
plan_head_after: 83eae2c

tech-stack:
  added: []
  patterns:
    - "Scripted git rebase -i via GIT_SEQUENCE_EDITOR with exec amend -F per reworded commit, hooks active (no --no-verify)"
    - "Identity rewrite via filter-branch env-filter limited to one address, proven by before/after cmp of tree, names, dates, subjects and bodies"

key-files:
  created:
    - "CONTRIBUTING.md (on curated-main in ../hearth-curate)"
  modified:
    - "docs/file-map.md (one row, on curated-main)"

key-decisions:
  - "Tip identity: the rebuilt product tip is 9dd6668 after the identity pass (it was 3c1dcea before); the policy commit is 83eae2c. rebuilt-tip.txt still holds the pre-identity 3c1dcea; final tips are in final-tip.txt and rebuilt-product-tip-final.txt"
  - "Plan 01-03 and later must use 83eae2c (or curated-main), not 3c1dcea"

requirements-completed: [GIT-01, GIT-03]  # GIT-04's full-range mode and CRLF scan runs in 01-03; GIT-02 completes at Gates 2 and 3

duration: ~11min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 02: Rebuild curated-main and Add the Policy Commit Summary

**`curated-main` now holds the 43-commit curated history plus one policy commit on `7da55e3`: tree-identical to `b96ca32` apart from two hook modes, commitlint-clean over the whole range, one author and committer email (`alex.c.tanton@gmail.com`), and a fast-forward in a dry run. Nothing was pushed.**

## Performance

- **Duration:** about 11 min (first command 21:11Z, last proof 21:21Z); the scripted rebase itself took about 5 min (21:11 to 21:16Z)
- **Tasks:** 2 of 2 (Task 1 tracer, Task 2 auto)
- **Files:** 2 changed on `curated-main` in the policy commit (`CONTRIBUTING.md` added, `docs/file-map.md` one row)

## Accomplishments

### Task 1: rebuild and prove (tracer)

- Ran `git rebase -i 7da55e3` in `../hearth-curate` with the approved `todo.txt` copied in by `GIT_SEQUENCE_EDITOR`. 62 steps, 0 stops; `rebase.log` ends `Successfully rebased and updated refs/heads/curated-main.` No conflicts, no commitlint rejections, no typecheck failures, no dirty-worktree stops.
- All 11 reword `exec` amends ran with hooks active (pre-commit lint-staged and `pnpm typecheck`, commit-msg commitlint). `HUSKY` was empty and `.husky/_/h` present before starting.
- Quick proofs (all pass, outputs in `../hearth-aside/logs/quick-proof-02.txt`):
  - (a) `git rev-list --count 7da55e3..curated-main` was 43.
  - (b) `git diff --name-only b96ca32 curated-main` listed exactly `.husky/commit-msg` and `.husky/pre-commit`, both `mode change 100644 => 100755`, 0 `@@` hunks.
  - (c) `commitlint --from 7da55e3 --to curated-main` exited 0.
  - (d) the second commit of the range (the rewritten `3ae2afd`) lists both hooks at `100755`.
  - (e) the 43 curated subjects equal the original 51 minus the 8 folded commits (with the 11 message files' first lines); `cmp` clean.
  - (f) `7da55e3` is an ancestor; the dry-run push printed `7da55e3..3c1dcea  curated-main -> main` (fast-forward).
  - (g) `.planning/STATE.md` and `.claude/CLAUDE.md` still present in the primary checkout.
- The plan's Task 1 automated verify command passed in full.

### Task 2: identity and policy commit

- `approve-personal` path. `emails-before.txt`: 43 lines, all `actanton@ncsu.edu actanton@ncsu.edu`. Ran `git config --local user.email alex.c.tanton@gmail.com`, then the spelled-out `git filter-branch --env-filter` over `7da55e3..curated-main` (43 commits rewritten, 0 skipped).
- `emails-after.txt`: 43 lines, all `alex.c.tanton@gmail.com alex.c.tanton@gmail.com`. `cmp` of `identity-before/after.txt` (tree, author and committer names and dates, subject) and `bodies-before/after.txt` both clean. `refs/original/refs/heads/curated-main` deleted afterward and confirmed absent. `7da55e3` untouched.
- `CONTRIBUTING.md` written at the repo root in the `README.md` tone: `How changes land`, `Deploys`, `Commit and squash messages`, `Branches and worktrees`, `Scripts`, `Checks before pushing`, `Not yet enforced`. It links `commitlint.config.js`, `.github/workflows/deploy.yml` and `docs/testing.md` instead of copying lists. Prettier-clean.
- `docs/file-map.md`: one row inserted under `README.md`, unaligned like its neighbours.
- Policy commit `83eae2c` `docs: add contributing guide with branch and pr policy`, made with Husky active (lint-staged, typecheck, commitlint all ran and passed), trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- The plan's Task 2 automated verify command passed in full: 44 commits, four-path diff versus `b96ca32` (the two hooks, `CONTRIBUTING.md`, `docs/file-map.md`), `.github` and `.gitignore` unchanged, one identity.
- A second dry run at the final tip printed `7da55e3..83eae2c  curated-main -> main` (`../hearth-aside/logs/dry-run-final.txt`).

## Final state

| Ref | Value |
| --- | --- |
| `curated-main` (policy commit, tip) | `83eae2c` |
| Curated product tip (after identity pass) | `9dd6668` (tree identical to `b96ca32` except the two hook modes) |
| Pre-identity rebuilt tip | `3c1dcea` (no longer a branch tip; `rebuilt-tip.txt` still names it) |
| Range | 44 commits on `7da55e3` |
| `main`, `backup/pre-curation` | both `38f3a88`, untouched |
| `origin` | still only `main` at `7da55e3`, nothing pushed |

## Task Commits

No commits in the primary checkout (phase rule 2, D-03). The 44 commits are the rewritten history and the policy commit on `curated-main` in `../hearth-curate`. `commits: 44` is measured as `git rev-list --count 7da55e3..curated-main`. `plan_head_before` is the start of the curation branch (`b96ca32`, the product tip), `plan_head_after` is `83eae2c`; the primary checkout's HEAD stayed at `38f3a88`, so a `plan_head_before..HEAD` count in the primary checkout is 0 by design.

## Deviations from Plan

None - plan executed as written. The rebase needed none of the step 4 recovery branches.

### Observations (no plan impact)

- `../hearth-aside/logs/rebuilt-tip.txt` holds `3c1dcea`, the tip before the identity pass, exactly as Task 1 step 5 requires at that point in time. The identity pass then rewrote every SHA. The new tips are in `final-tip.txt` (`83eae2c`) and `rebuilt-product-tip-final.txt` (`9dd6668`). Plan 01-03 onward must read `curated-main` or `final-tip.txt`.
- `identity-before.txt` and `identity-after.txt` have 44 lines, not 43: the plan's `git log` has no range, so the line for `7da55e3` is included (and unchanged).
- Rewritten SHAs, for reference: `3ae2afd` is now `27d1e5e`, `e86c43c` is `07db639`, `46d170e` is `dc46e82`.
- The phase-rule worktree branch-name allow-list from the executor's generic commit protocol (`agent-*`) does not apply here: the target branch is the plan's own `curated-main`, and the protected-branch check (`main`) was satisfied.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or trust-boundary schema change. T-01-05 to T-01-08 mitigations held as planned: hooks were active throughout (no `--no-verify`, `HUSKY=0`, or `--skip`), no planning commit was replayed, the tree-identity proof shows no content change, and the identity pass is proven by before/after comparison.

## Self-Check: PASSED

- `curated-main` resolves to `83eae2c`; `git rev-list --count 7da55e3..curated-main` is 44.
- `CONTRIBUTING.md` and the `docs/file-map.md` row exist at the tip (`contributing-at-tip.md`, `file-map-at-tip.md`).
- Both plan verify commands passed; `git ls-remote origin` still lists only `main` at `7da55e3`; local `main` and `backup/pre-curation` at `38f3a88`; `../hearth-aside/pre-curation.bundle` present.
