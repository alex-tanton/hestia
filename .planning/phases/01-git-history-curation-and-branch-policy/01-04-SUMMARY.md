---
phase: 01-git-history-curation-and-branch-policy
plan: 04
subsystem: infra
tags: [git, publish, staging-branch, gate-2, ci, pull-request]

requires:
  - phase: 01-03
    provides: "Proven curated tip 83eae2c841ab8de096d52990f8f3be3f4379c448 (44 commits on 7da55e3)"
provides:
  - "origin/curated-main at 83eae2c841ab8de096d52990f8f3be3f4379c448 (new branch, plain push, no force)"
  - "Gate 2 approval and Staging push done lines in 01-REWRITE-PROPOSAL.md ## Owner approvals"
  - "PR #1 (curated-main to main, not merged) and its measured CI results in 01-REWRITE-PROPOSAL.md ## Staging CI results"
  - "Push log and post-push ls-remote capture in ../hearth-aside/logs/"
affects: [01-05]

actuals:
  tokens: 14000
  tasks: 3
  commits: 0
plan_head_before: 38f3a8878d8e0899406b31f025239ccfae1b876f
plan_head_after: 38f3a8878d8e0899406b31f025239ccfae1b876f

key-files:
  created: []
  modified:
    - ".planning/phases/01-git-history-curation-and-branch-policy/01-REWRITE-PROPOSAL.md (## Owner approvals, ## Staging CI results, ## What each push does; local-only)"

key-decisions:
  - "Gate 2 recorded in the plan's line format (so Task 2's precondition and verify match) with the owner's literal reply approve-gate-2 noted on the line"
  - "Both red CI jobs are classified pre-existing (content identical to b96ca32), not introduced; neither blocks Gate 3 under this plan's rule, and the owner decides how to treat them"
  - "The test-unit time-dependence attribution is recorded as the analyst's reading (4 hour offset, UTC runner vs America/New_York-style expectation), not as a verified root cause"
  - "GIT-02 is not marked complete: history has not reached origin/main; plan 01-05 (Gate 3) owns that"

duration: ~25min (both sessions)
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 04: Stage the Curated History on origin/curated-main Summary

**The proven tip `83eae2c841ab8de096d52990f8f3be3f4379c448` is on GitHub as the branch `curated-main` and PR #1 (`curated-main` to `main`, not merged) has run CI: lint, typecheck, test-integration and build pass; test-unit and test-e2e fail in content identical to `b96ca32`, so neither is introduced by the rewrite. `origin/main` is still `7da55e387f0a766c26c1913004f060608c5152f9`; nothing was committed locally, merged or pushed beyond the staging branch.**

## Performance

- **Duration:** ~25 min across two sessions (Tasks 1 and 2, then Task 3)
- **Completed:** 2026-10-11
- **Tasks:** 3 of 3 (Task 3 completed by the owner/orchestrator opening the PR; the executor recorded the results)
- **Files modified:** 1 (local-only proposal)

## Accomplishments

### Task 1: Gate 2

- Owner replied `approve-gate-2` to "approve pushing 83eae2c to origin/curated-main" (scope: that one SHA to `refs/heads/curated-main` only; Gate 3 not approved).
- Before recording, confirmed `git rev-parse curated-main` equals `../hearth-aside/logs/curated-tip.txt` and that `## Proof results` names that SHA.
- One Gate 2 line under `## Owner approvals`: `- Gate 2 (staging push of 83eae2c841ab8de096d52990f8f3be3f4379c448): push-staging - 2026-10-11 - owner reply approve-gate-2 ...`.

### Task 2: staging push

- Pre-checks passed (origin URL `git@github-personal:alex-tanton/hearth.git`; `origin/main` = `7da55e3`; `curated-main` absent on remote; local `curated-main` = tip; `origin/main` is an ancestor).
- `git push -u origin curated-main` exited 0 (`* [new branch] curated-main -> curated-main`). No force, no `+` refspec, no tags. `ls-remote` afterwards: `curated-main` at `83eae2c`, `main` and `HEAD` at `7da55e3` (`../hearth-aside/logs/ls-remote-after-staging.txt`). Task 2 verify printed `TASK2 VERIFY PASS`.

### Task 3: PR and CI results

- The orchestrator opened PR https://github.com/alex-tanton/hearth/pull/1 (base `main`, head `curated-main`, tip `83eae2c`) through the `gh` CLI with the owner's authorization. Nothing was merged. CI run: https://github.com/alex-tanton/hearth/actions/runs/38177721565.
- Before recording, `git ls-remote origin` showed `main` at `7da55e3`, `curated-main` and `refs/pull/1/head` at `83eae2c`, and `refs/pull/1/merge` (GitHub's test-merge ref, created by the PR itself; not a branch on `main`).
- `## Staging CI results` was added to `01-REWRITE-PROPOSAL.md` with the PR URL, a line stating the measured results replace the Gate 2 prediction, and one line per job. Item 4 of `## What each push does` was relabelled as superseded. The plan's Task 3 verify printed `TASK3 VERIFY PASS`.

| Job | Conclusion | Duration | Classification |
| --- | --- | --- | --- |
| lint | success | 1m18s | |
| typecheck | success | 43s | |
| build | success | 34s | |
| test-integration | success | 6m43s | |
| test-unit | failure | 4m23s | pre-existing |
| test-e2e | failure | 1m13s | pre-existing (infrastructure) |

## Red jobs and the Gate 3 decision

Both classifications are the analyst's reading of the CI output and the diff, not verified root causes.

- **test-unit.** Step `pnpm test`; apps/web 1 failed file of 56, 1 failed test of 715: `src/screens/deals/favorites.test.tsx > favorite stores > keeps the stale list with its as-of date rather than emptying`. Expected `As of 09/24/2026, 4:00 AM`, rendered `As of 09/24/2026, 8:00 AM`. The test input is `2026-09-24T08:00:00.000Z` and the expectation is a UTC-4 rendering, so a 4 hour offset fits a UTC runner against an America/New_York-style expectation, the same class as Phase 2 TIME-01. No timezone is pinned in `apps/web/vitest.config.ts`, `apps/web/vite.config.ts` or `.github/workflows/ci.yml`. It was not re-run with `TZ` set. It is a different test from the three failures in RESEARCH Pitfall 7's local scratch run (`App.test.tsx` x2, `write-queue.test.tsx` x1), so these two runs are not a stable Phase 2 baseline. Service, shared, matching, recurrence and e2e unit tests passed.
- **test-e2e.** Step `pnpm test:e2e`: `docker compose ... up --detach --wait db auth realtime kong` exited 1 with `auth Error toomanyrequests: Rate exceeded` from the image registry. No Playwright test ran. The job has not been re-run, so whether it passes on retry is unknown.
- **Not introduced by the rewrite.** `git diff --name-status b96ca32 83eae2c` lists only the two `.husky` mode changes, `CONTRIBUTING.md` and `docs/file-map.md`. `git diff --quiet b96ca32 83eae2c` exits 0 for `apps/web/src/screens/deals`, `favorites.test.tsx`, `docker`, `e2e`, `.github`, `package.json`, `pnpm-lock.yaml` and `apps/web/package.json`.

**Owner decision needed at Gate 3 (plan 01-05):** how to treat the two red jobs. Option A: accept them, because the content is unchanged from `b96ca32` and Phase 2 owns the date-dependent failure. Option B: re-run `test-e2e` first (a re-run only; it does not touch the PR or `origin/main`) to see whether it goes green once the registry limit clears. Plan 01-05 should present both and must not treat the red jobs as approved by the Gate 2 reply.

## Task Commits

No commits, by design (phase rule 2, D-03, `commit_docs=false`). `commits: 0` is measured: `git rev-list --count 38f3a88..HEAD` = 0 and primary checkout HEAD stayed at `38f3a88`. The only writes outside the repo were the staging push (session 1) and logs in `../hearth-aside/logs/`. This session pushed, merged and altered nothing.

## Deviations from Plan

### Auto-fixed Issues

None - no code was changed.

### Notes

- **Gate 2 line wording.** The dispatching instruction gave a literal line format (`- Gate 2 (staging push): approve-gate-2 - ... - tip 83eae2c...`), but the plan's Task 2 precondition and automated verify grep for `^- Gate 2 (staging push of {SHA}): push-staging`. I wrote the plan's format and kept the owner's literal reply, the date and the scope on the same single line.
- **PR opened via `gh`.** The plan assumed `gh` was not installed and the owner would open the PR in the browser. The orchestrator opened it with `gh` under the owner's authorization instead. The outcome matches the plan's Task 3 (PR exists, not merged, `origin/main` untouched).
- **Extra proposal edits.** Beyond the plan's required section, `## What each push does` was touched in two places so it no longer says "Nothing below has happened" or presents the prediction as current. No other content changed.
- **Requirements.** The plan frontmatter lists GIT-02, which is not marked complete here: the history has not reached `origin/main`. Plan 01-05 completes it.

## Authentication Gates

None. The push used the existing `github-personal` SSH identity without prompting.

## Known Stubs

None.

## Threat Flags

None. Mitigations held: T-01-12 (remote URL and `origin/main` pre-checked), T-01-13 (only `curated-main` pushed; the PR ran CI only, no Deploy; `.github/workflows/` untouched), T-01-14 (PR not merged; `origin/main` re-checked at `7da55e3` before recording), T-01-15 (Gate 2 line names the exact SHA; pushed ref equals it).

## Next Phase Readiness

Plan 01-05 (Gate 3, fast-forward push of `main`) is unblocked: no `introduced` failure exists, `origin/main` is still `7da55e3` so the push stays a fast-forward, and PR #1 will be marked merged by GitHub when `main` reaches `83eae2c`. It needs the owner's explicit Gate 3 approval and a decision on the two red jobs (above). GitHub-side branch protection and the Deploy queue behavior from `## What each push does` item 3 still apply.

## Self-Check: PASSED

- `git ls-remote origin`: `main` at `7da55e387f0a766c26c1913004f060608c5152f9`; `curated-main` and `refs/pull/1/head` at `83eae2c841ab8de096d52990f8f3be3f4379c448`.
- `01-REWRITE-PROPOSAL.md` contains `## Staging CI results` with exactly 6 job lines, both failure lines carrying a ` - pre-existing: ` classification (plan Task 3 verify passed).
- `../hearth-aside/logs/push-staging.txt` and `ls-remote-after-staging.txt` match the plan's required lines (Task 2 verify passed).
- Primary checkout HEAD `38f3a88`; no local commits.
