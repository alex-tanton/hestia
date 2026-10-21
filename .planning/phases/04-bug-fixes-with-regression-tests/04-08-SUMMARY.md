---
phase: 04-bug-fixes-with-regression-tests
plan: 08
subsystem: phase-close
tags: [fix-ledger, main-ci, final-main, kong, deploy, phase-index]

requires:
  - phase: 04-bug-fixes-with-regression-tests
    provides: "PR 1 (#15), PR 2 (#16) and PR 3 (#18) squash-merged on origin/main as 1b0e69f, 7da1461 and 48c111f"
provides:
  - ".planning/cleanup/FIX-LEDGER.md: the Phase 4 index (FIX-01 to FIX-07 red and green evidence, success-criteria map, open items, deploy and Kong status)"
  - "A local proof run of every Phase 4 test and the full gates on a clean detached checkout of final main (48c111f), all exit=0"
  - "main CI recorded for the three squash commits, including two red jobs that were not papered over"
affects: [Phase 5 (docs and text sync), owner manual review, owner Kong host step]

actuals:
  tokens: 40000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Phase close: prove the merged tree on a detached checkout of origin/main, then index each fix's fails-before evidence in one file"
    - "A red job on a superseded main commit is recorded with its cause, never re-run (a re-run would make Deploy pick up an old tree)"

key-files:
  created:
    - .planning/cleanup/FIX-LEDGER.md
    - .planning/phases/04-bug-fixes-with-regression-tests/04-08-SUMMARY.md
  modified:
    - .planning/cleanup/FIX-LEDGER-INFRA.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "PR 2's main CI test-e2e failure is recorded as a runner-setup failure (job 118734797533 failed at pnpm/action-setup@v6 after 3 seconds, every later step skipped) and was not re-run; the proof that PR 2's content is green on main is the CI of 48c111f plus the local final-main run"
  - "PR 3's attempt-1 test-e2e failure on main (job 118774234646) was a registry rate limit (toomanyrequests pulling the gotrue image), so no test ran; the owner re-ran the run and attempt 2 is green on all six jobs. It is recorded as a flake, not as red evidence"
  - "deploy-pr3 is recorded as a fact (run 39468151212 pending on the self-hosted runner) and kong-recreate=pending-owner; neither was touched"

requirements-completed: [FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07]

plan_head_before: 8917188
plan_head_after: 29670622357990d0e1510e69231dbeb5b1e61070
commits: 3

duration: about 1h wall-clock, mostly waiting for PR 3's squash CI
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 08: Phase close Summary

**Final main (48c111f) holds all seven Phase 4 fixes and guards, every Phase 4 test and the full lint, typecheck and test gates pass on a clean detached checkout of it, and one index file maps each FIX and each ROADMAP success criterion to its fails-before and passes-after proof.**

## Recorded facts

- `final-main=48c111f79ecde910636805976752c94b5f615802`
- `pr1-merged=1b0e69f2414cf3619b8941a8596842edee6d274d` (PR 1, #15)
- `pr2-merged=7da14613cd4060086c3ce8daeb13ffcfb0afd20b` (PR 2, #16)
- `pr3-merged=48c111f79ecde910636805976752c94b5f615802` (PR 3, #18, merged 2026-10-20T17:19:28Z)
- `main-ci-pr1=` all six jobs success (run 39448163354)
- `main-ci-pr2=` five jobs success, `test-e2e` failure (run 39453673854, job 118734797533): a runner-setup failure at `Run pnpm/action-setup@v6` after 3 seconds; install and all test steps were skipped, so no test ran. Recorded, not re-run (a successful re-run would have made Deploy pick up a superseded commit)
- `main-ci-pr3=` all six jobs success on attempt 2 of run 39465074029 (test-e2e 118779326521, lint 118779328491, test-unit 118779328754, typecheck 118779371813, build 118779388800, test-integration 118779394959). Attempt 1: `test-e2e` job 118774234646 failed at `Run set -euo pipefail` because `public.ecr.aws/supabase/gotrue:v2.196.0` could not be pulled (`toomanyrequests: Data limit exceeded`, 6 attempts). It is a registry rate limit, no test ran; the owner re-ran the run
- `deploy-pr3=39468151212 pending` (queued on the self-hosted runner `hearth`; run 39466389042 for the same sha is completed, cancelled as superseded). A fact, not touched
- `kong-recreate=pending-owner`

## What was done

**Task 1 (tracer).** Merged `origin/main` into the working branch with a plain merge (7635169); the three squash SHAs are ancestors of `origin/main`. Created a detached, read-only worktree at 48c111f with a frozen install (Node v24.21.0, pnpm 10.34.5, `TZ` unset). All proofs ended `exit=0` (logs `04-08-*.log`, gitignored):

| Proof | Result |
| --- | --- |
| web: deal-card and RotationEditor tests | 24 passed |
| shared: patch-schemas test | 24 passed |
| harness: fence probe and deploy test | pass 34, fail 0 |
| kong: `kong-routes.test.ts` | 32 passed |
| `pnpm lint`, `pnpm typecheck` | clean |
| `pnpm test` | matching 156, shared 172, recurrence 77, service 757, web 726 |

Static checks on that tree held: no `eslint-disable` in `RotationEditor.tsx`; `PGPASSWORD=` only on the `supabase migration up` command with a password-free `--db-url`; `docker/kong.yml` at `'3.0'` with `auth-v1-denied`; the `add-to-list:` advisory lock; the held-id map in `deals.ts`; no new file under `docs/`. `FIX-LEDGER.md` was written and every cited CI job id (11 of them) was checked through REST for existence and the stated conclusion.

**Task 2.** Recorded the deploy and Kong status, then removed the six local worktrees (`hearth-list-adds-rotation`, `-list-adds-lock`, `-guard-tests`, `-deploy-kong`, `-kong-allowlist`, `-final`): each was clean and each branch tip equalled its `origin/` tracking tip. No branch, local or remote, was deleted. `../hearth-dbtypes` (Phase 3) was left alone.

## Deviations from Plan

### Verify mismatch recorded, not worked around

**Task 2's automated verify loop would fail.** It expects all five Phase 4 branches on `origin`, but `fix/list-adds-rotation`, `test/guard-tests` and `fix/deploy-kong` are no longer on `origin` (`git ls-remote --heads` returns nothing for them). The executor never pushed a delete or ran any command that deletes a remote branch; the likely cause is GitHub's delete-branch-on-merge setting or the owner. `fix/list-adds-lock` (edd41ec) and `fix/kong-allowlist` (7c0efdc) are still on `origin`, and all five branches exist locally. The squash commits carry the content, so nothing is lost. The plan's `fails_when` clause is about deletion by the executor, which did not happen; this is recorded in `FIX-LEDGER.md` under "Open for the owner".

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale dependency install in the primary checkout**
- **Found during:** first commit of the index
- **Issue:** the pre-commit typecheck failed with `Cannot find module 'yaml'`: PR 3's `yaml` devDependency came in with the merge of `origin/main` and the primary checkout had not been installed since.
- **Fix:** `pnpm install --frozen-lockfile` from the committed lockfile (the owner-approved `yaml@2.9.1`; no package was chosen or added).
- **Files modified:** none tracked
- **Commit:** none (the retried commit is 95c63d8)

**Other notes.** The brief said `gh` was unusable; REST reads worked and were used for check runs, jobs and workflow runs. `commits: 3` is `git rev-list --count --first-parent 8917188..HEAD` at the point the summary was written (the plain merge of `origin/main`, the index commit, the deploy and Kong commit); the completion commit that carries this summary is not counted. The `plan_head_before` base is 8917188 because no ledger file was created at the first commit.

## Auth gates

None.

## Known Stubs

None. This plan adds only planning documents.

## Threat Flags

None.

## Open for the owner (also in `FIX-LEDGER.md`)

- **Kong host step (the end-of-phase human check; not done by the executor):** take a backup by hand, run `hearth-compose up -d --force-recreate kong`, then sign in, sign out and in again, force a token refresh, open a recovery link from `hearth-admin reset-password {email}`; from outside, `POST /auth/v1/recover` should answer 403 `Access is forbidden.`. FIX-07 is not live in production until this is done.
- Deploy run 39468151212 for 48c111f is queued on the self-hosted runner.
- Firefox drag caveat A1, kept `admin/users` and `otp` Kong routes (A2, A5), the four fence gaps, and the E2E flakiness seen outside the touched files (spec 17 notification and accessibility tests, the push-reminder test, and the registry rate limit).
- `.claude/CLAUDE.md` was updated in PR 1 (`gate-pr1=approve`), so Phase 5 RED-05 has nothing left to sync for those two lines.

## Self-Check: PASSED

- `.planning/cleanup/FIX-LEDGER.md` exists with seven FIX rows, `## Success criteria`, `## Open for the owner`, `final-main=`, `main-ci-pr{1,2,3}=`, `deploy-pr3=` and `kong-recreate=`.
- Commits 7635169, 95c63d8 and 2967062 are in the working branch's history and pushed.
- `04-08-{web,shared,harness,kong,lint,typecheck,test}.log` all end `exit=0`.
