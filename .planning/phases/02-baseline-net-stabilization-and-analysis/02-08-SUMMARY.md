---
phase: 02-baseline-net-stabilization-and-analysis
plan: 08
subsystem: delivery
tags: [pull-requests, ci, branch-landing, stacked-branches]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "02-02 to 02-05 and 02-09: the finished clock branch test/deterministic-clock; 02-06 and 02-07: the knip branch chore/knip-config"
provides:
  - "Clock PR #3 squash-merged into main as a23d038, all six CI jobs green"
  - "Knip PR #4 squash-merged into main as e03142d, all six CI jobs green, diff outside .planning/ limited to docs/file-map.md, knip.json, package.json and pnpm-lock.yaml"
affects: [phase-03, phase-05, phase-06]

actuals:
  tasks: 5
  commits: 1
plan_head_before: 9d192ce
plan_head_after: 3c0fe6b

tech-stack:
  added: []
  patterns:
    - "Stacked branches landed by plain merges only: every push a fast-forward, no rebase, no force-push"
    - "Clock PR first; knip PR retargeted to main by GitHub when its base branch was deleted, then synced with origin/main"

key-files:
  created:
    - .planning/cleanup/logs/02-08-prs.txt (gitignored)
  modified: []

key-decisions:
  - "Owner gate answered approve-both on 2026-10-13: push the knip tip, open the clock PR into main, then the knip PR stacked on the clock branch once the clock PR's six jobs passed"
  - "GitHub GraphQL is blocked in the cloud session, so every gh pr view/checks/edit step in the plan ran as its REST equivalent"

requirements-completed: [TIME-01, TIME-02, TIME-04, TIME-05, BASE-02]

duration: ~2h of executor time across three runs, plus the owner's two squash merges
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 08: Land the clock and knip branches through pull requests Summary

**Both Phase 2 branches reached `main` through owner-merged, fully green pull requests: the clock PR #3 as `a23d038` and the knip PR #4 as `e03142d`. `main`'s own CI is green at both commits.**

## Performance

- **Tasks:** 5 of 5. Task 1 was the local tracer, Task 2 the owner gate (answered `approve-both`), Task 3 the push and PR openings, Task 4 the pause for the owner's clock squash, Task 5 the knip sync.
- **Commits:** one local merge commit, `f357b85`, then `3c0fe6b` (a plain merge of `origin/main` into the knip branch). The merged tree of `3c0fe6b` was identical to the previous tip.
- **Pushes:** all plain fast-forwards. Nothing was force-pushed and nothing was pushed to `main` by an agent.

## Accomplishments

- **Task 1:** the clock branch already contained `origin/main`, so it needed no merge. One plain merge brought the clock branch into the knip branch with no conflicts and no regenerated lockfile. In both worktrees, install, lint, format check, typecheck, `pnpm test` and build all exited 0 (12 of 12), the unit sweep ended `36/36 passed`, and commitlint was clean. The dry-run push showed only a fast-forward of the knip branch.
- **Task 3:** the knip tip was pushed (`9d192ce..f357b85`), clock PR #3 opened against `main`, and knip PR #4 opened against the clock branch only after #3's six jobs had passed. Both PRs were green on the first run, with no reruns or fixes.
- **Task 4:** the owner squash-merged #3 as `a23d038` at 2026-10-13T02:14:57Z. GitHub deleted the clock branch and retargeted #4 to `main`.
- **Task 5:** `origin/main` was merged into the knip branch (`3c0fe6b`, no conflicts), pushed as one fast-forward, and #4 stayed `mergeable` and `clean` with six green jobs. The owner squash-merged #4 as `e03142d` at 2026-10-13T02:37:22Z. The merged tree equals the tree verified at `3c0fe6b`.

## Task Commits

- `f357b85`: merge of `test/deterministic-clock` into `chore/knip-config` (local until Task 3)
- `3c0fe6b`: merge of `origin/main` (`a23d038`) into `chore/knip-config`
- `a23d038`: squash of PR #3 on `main` (made by the owner)
- `e03142d`: squash of PR #4 on `main` (made by the owner)

## For the owner

- `main` carries the Phase 2 work. CI on `main` is green at `a23d038` and `e03142d`, and the `Deploy` runs for both are queued on the unregistered self-hosted `hearth` runner. Phase 2 changed no production code, so a deploy is behavior-neutral.
- Every `test-e2e` run on record happened on a single calendar day. TIME-03 stays behavior-unverified until `test-e2e` has run on a Saturday and a Sunday; the verifier recorded this as the one open truth.
- Leftover local state: `/home/user/hearth-clock` (branch `test/deterministic-clock`, gone from origin, needs `git branch -D` because it was squash-merged) and `/home/user/hearth-knip` (branch `chore/knip-config`, gone from origin).

## Deviations from Plan

1. **GraphQL blocked.** `gh pr list/create/view/checks/edit` fail with HTTP 403 in the session. PRs were created and edited through the REST API, checks were read from `commits/{sha}/check-runs`, and the plan's `--watch` became a bounded poll. The plan's automated verify one-liners that use `gh pr view` could not run as written; each of their conditions was checked over REST instead.
2. **Base wording.** The plan names `d3da748` as `main`; `main` was `89eb558` (d3da748 plus one docs commit). The clock branch already contained it, so nothing changed.
3. **Planning commit.** The plan's output section puts a `docs: complete plan 02-08` commit on the knip branch. The owner squashed #4 before that SUMMARY existed, so this SUMMARY lives on the session branch instead and reaches `main` only through a later planning PR if the owner wants one.
4. **Decision recorded.** The gate decision line in `02-08-prs.txt` is `decision=approve-both - 2026-10-13`, followed by `clock=3`, `knip=4`, `clock-merged=a23d038e5a22f227e19d16a1656dd6d9df526685` and `knip-synced=3c0fe6bbc6fe1c0ca5b218eb329ac1cb556f0523`.

## Known Stubs

None.

## Threat Flags

None. Pull requests and merges only; no endpoint, auth path or schema changed.

## Self-Check

- FOUND: PR #3 `merged=true` (squash `a23d038`) and PR #4 `merged=true` (squash `e03142d`), read over the REST API
- FOUND: `origin/main` is `e03142d`, six CI jobs `success` on it and on `a23d038`
- FOUND: the tree of `e03142d` is identical to the tree of `3c0fe6b` (the head of PR #4 that passed all six jobs)
- No force-push, no direct push to `main`, and no PR other than #3 and #4 touched in this plan
