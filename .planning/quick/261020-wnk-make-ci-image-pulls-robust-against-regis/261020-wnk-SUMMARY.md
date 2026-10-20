---
phase: quick-261020-wnk
plan: 01
subsystem: ci
tags: [github-actions, docker, ghcr, ecr, rate-limit, harness-test]

requires: []
provides:
  - scripts/ci-prepull-images.sh, the tested test-e2e image pre-pull (GHCR first for the three Supabase images, ECR fallback per attempt)
  - scripts/ci-prepull-images.test.mjs, ten stubbed cases wired into test:harness
  - test-e2e job permissions, ghcr.io login and optional Docker Hub login (both continue-on-error)
affects: [phase-6 CI hardening, RED-05 file-map cleanup]

actuals:
  tokens: 24000
  tasks: 2
  commits: 2

tech-stack:
  added: [docker/login-action@v4 (workflow action, major-tag pinned)]
  patterns: [stub-binary harness test of a CI shell script, name-check before passing file text to docker]

key-files:
  created: [scripts/ci-prepull-images.sh, scripts/ci-prepull-images.test.mjs, .planning/cleanup/FIX-LEDGER-CI-PULL.md]
  modified: [.github/workflows/ci.yml, package.json, docs/testing.md]

key-decisions:
  - "Each of the six attempts tries ghcr.io, then public.ecr.aws, then waits (planner point 1, accepted by the owner)"
  - "Both login steps carry continue-on-error: true so a failed login cannot fail the job before the ECR fallback runs (owner adjustment 1)"
  - "docs/file-map.md is not updated; left for the later cleanup phase (owner adjustment 3)"

requirements-completed: []
# Contributes to CI-05 (workflow robustness); it does not complete CI-05.

plan_head_before: 48c111f79ecde910636805976752c94b5f615802
plan_head_after: d25d8e66617b7bc12310c969e92d5593af6cee3d

duration: 50min
completed: 2026-10-20
status: complete-with-blocker
---

# Quick 261020-wnk: CI image pulls from GHCR first Summary

**test-e2e now pulls the three Supabase images from ghcr.io/supabase (equal digests) and tags them back to their public.ecr.aws names, falling back to ECR in every attempt, through a stub-tested script. The two commits are on the local branch `ci/pull-supabase-from-ghcr`; the push to origin was rejected for a missing `workflow` token scope, so nothing is on GitHub yet.**

## Blocker: the branch is not pushed

`git push -u origin ci/pull-supabase-from-ghcr` was rejected: `refusing to allow an OAuth App to create or update workflow .github/workflows/ci.yml without workflow scope`. Per the plan's rule I stopped there and tried no other route. The branch is local in `/home/user/hearth-ci-pull` at `d25d8e66617b7bc12310c969e92d5593af6cee3d`; `git ls-remote` shows no such branch on origin. The owner (or a credential with `workflow` scope) can publish it with `git -C /home/user/hearth-ci-pull push -u origin ci/pull-supabase-from-ghcr`. No PR was opened.

## What was done

- **Task 1 (tracer), commit 871ff4d.** Digests confirmed equal on both registries for gotrue, postgres and realtime. Test file written first and run red against a no-GHCR variant (`ℹ pass 6`, `ℹ fail 4`, exactly the four GHCR cases). The GHCR step was then added and the run is green (`ℹ pass 10`, `ℹ fail 0`). Wired into `test:harness` (231 of 231 pass), `docs/testing.md` counts and a new harness bullet updated, and the inline pre-pull in ci.yml replaced by `run: bash scripts/ci-prepull-images.sh`.
- **Task 2, commit d25d8e6.** test-e2e got job-level `permissions: {contents: read, packages: read}`, `env.DOCKERHUB_USERNAME`, a ghcr.io login and an optional Docker Hub login (`if: env.DOCKERHUB_USERNAME != ''`), both with `continue-on-error: true` and a comment saying why. lint, format:check, typecheck, `pnpm test`, `bash -n` and commitlint all exit 0. The structural YAML check prints `ci.yml structure ok` (updated to require `continue-on-error: true` on both logins). A real-files derivation with a stub docker shows the GHCR pull and tag-back for each Supabase image. The secret scan of added lines is clean. The push failed (above).
- **Task 3.** Ledger `.planning/cleanup/FIX-LEDGER-CI-PULL.md` written and committed on the session branch (ed206d4) with `pushed=none` and a Push status section, because the plan's precondition (Task 2 pushed) did not hold. Finding (e) is recorded as resolved by the `continue-on-error` adjustment, and finding (f) records that `docs/file-map.md` is left for the later cleanup phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test case 3 filter included `docker image inspect`**
- **Found during:** Task 1, first green run
- **Issue:** the case compared every gotrue-related call, so the leading `image inspect` call made the expected sequence unequal
- **Fix:** the filter keeps only `sleep`, `pull` and `tag` calls; no GHCR assertion was loosened, and the red run was repeated (still 4 failing GHCR cases)
- **Files modified:** scripts/ci-prepull-images.test.mjs
- **Commit:** 871ff4d

**2. [Rule 3 - Blocking] Case 4 asserted at least one ghcr.io argument**
- **Found during:** Task 1, writing the red variant
- **Issue:** that assertion would have failed case 4 on the no-GHCR variant, contradicting the required "only four fail" red
- **Fix:** removed the non-empty assertion from case 4; the GHCR presence is already asserted by case 1
- **Commit:** 871ff4d

### Owner adjustments applied

- `continue-on-error: true` and a comment on both login steps; structural check and ledger finding (e) updated to match.
- Branch cut from `origin/main` (48c111f), not from `fix/held-deal-id`.

### Blocked

- **Push of `ci/pull-supabase-from-ghcr` rejected** (token lacks `workflow` scope). Not auto-fixable; reported, not worked around.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. The new workflow surface (permissions, logins) is the planned T-wnk-02 and T-wnk-03 surface.

## Self-Check

- scripts/ci-prepull-images.sh, scripts/ci-prepull-images.test.mjs: present in `/home/user/hearth-ci-pull`, mode 100755 for the script
- commits 871ff4d and d25d8e6: present on `ci/pull-supabase-from-ghcr`; ed206d4 on the session branch
- Task 1 automated verify: passed. Task 2 verify: all gates pass except the final origin checks (branch on origin, no PR), which could not hold because of the rejected push
- Task 3 verify: `pushed=` check not satisfiable for the same reason

## Self-Check: PARTIAL (all local work verified; origin publication blocked by token scope)
