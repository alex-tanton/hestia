---
phase: 06-ci-enforcement-and-lock-in
plan: 08
subsystem: infra
tags: [ci, pull-request, canary, owner-gate, deploy-gate]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: ci/enforce-gates on origin at the proven tree, the owner's approve-pr2 and canary=with-migration replies (06-07)
provides:
  - PR 2 (#36) opened with the OD-4 deploy changes flagged, green on all seven jobs, squash-merged by the owner as 5643554
  - runner proof of the db:types drift step, the six hygiene steps and the web coverage thresholds
  - a draft canary PR (#37) showing every gate red on CI, closed by the owner with its branch deleted
affects: [06-09, 06-10]

actuals:
  tokens: 14000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "A throwaway canary PR into the unmerged branch shows each gate failing on GitHub's runners without touching main"

key-files:
  created: []
  modified:
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md

key-decisions:
  - "The unused-dependency canary plant is fastest-levenshtein@1.0.16, not yaml@2.9.1: knip counts yaml as used (an optional peer of installed packages)"
  - "test-e2e on PR 2 needed three attempts (two notification-area spec failures, no registry flake), each rerun authorized by the owner under rule 9 (DA-4)"

requirements-completed: []

plan_head_before: fd79d90be3403bba96399f2e8daceaff132614c4
plan_head_after: 9ef5a0c8cc9a71cfbdee63e6c8f8442feba94946

coverage:
  - id: D1
    description: "PR 2 is open with the deploy-behavior changes flagged and all seven jobs green on the pushed head"
    requirement: CI-05
    verification:
      - kind: other
        ref: "PR #36 head 0061269 tree 54069f0; CI run 40017353021 attempt 3: lint, typecheck, test-unit, test-integration, test-e2e, build, hygiene all success; body has '## Deploy behavior changes (flagged)' with OD-4 a to d"
        status: pass
    human_judgment: false
  - id: D2
    description: "The new gates pass on the runner: six hygiene steps, db:types drift, web coverage thresholds"
    requirement: CI-06
    verification:
      - kind: other
        ref: "jobs API: hygiene steps knip, knip --production, jscpd, audit, repository hygiene, migrations all success; 'db:types matches the migrated schema' success; runner web coverage 85.38/81.83/78.59/86.96 against 84/80/77/85"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every gate fails on the problem it exists to catch (ROADMAP success criteria 1 and 2)"
    requirement: CI-01
    verification:
      - kind: other
        ref: "canary PR #37 run 40023558441: canary-steps=knip:failure,knip-production:failure,jscpd:failure,audit:failure,hygiene:failure,migrations:failure,db-types:failure; hygiene log names the dead file, dead export, expired allowance, ignored file and non-executable script"
        status: pass
    human_judgment: false
  - id: D4
    description: "PR 2 merged and the canary closed by the owner"
    requirement: CI-05
    verification:
      - kind: other
        ref: "REST: PR #36 merged 2026-10-23T21:08:26Z as 56435543eee0cb765f9e85dddc5d2007dd86862d; PR #37 closed unmerged; ci/gate-canaries absent from origin"
        status: pass
    human_judgment: false
---

# Phase 6 Plan 08: PR 2 landing Summary

**PR 2 went from open to squash-merged with all seven jobs green (the new `hygiene` job and the `db:types` drift step included), and a throwaway canary PR showed every gate failing on GitHub's runners before the owner closed it.**

## Performance

- **Tasks:** 3 (one tracer, one auto, one owner checkpoint).
- **Files:** only the ledger on WB; the code branches were the owner-pushed `ci/enforce-gates` and the throwaway `ci/gate-canaries`.

## Accomplishments

- **PR 2 (#36).** Opened by REST from `ci/enforce-gates` at `0061269` (tree `54069f0`, equal to `pr2-tree`) into `main`, with a `## Deploy behavior changes (flagged)` section listing OD-4 a to d with before and after, the D-01 contract, the date-dependent audit, the first Sweep run on merge and the applicable OD, DA, PC and research items.
- **Seven green jobs.** CI run 40017353021 attempt 3: lint, typecheck, test-unit, test-integration, test-e2e, build and hygiene all `success`. The six `hygiene` steps and `db:types matches the migrated schema` are `success` (the CI half of D-10). Runner web coverage is 85.38/81.83/78.59/86.96, at or above the 84/80/77/85 thresholds (research A6 holds).
- **Canary (#37).** A draft PR from `ci/gate-canaries` (one commit, no `.github/` change) into `ci/enforce-gates`, run 40023558441: both knip steps, jscpd, the audit, the hygiene step, the migrations check and the `db:types` drift step all `failure`. The hygiene log names `zz-canary-dead.ts`, `zzCanaryDeadExport`, `allowance expired`, `coverage/zz-canary.txt`, `zz-canary-mode.sh` and `zz-canary-crlf.sh`, with `jscpd` at 2.9% over the 2% limit and the migration append-only message. `test-unit` also failed, as expected: the harness test `ships an empty allowlist` sees the planted allowance. The CRLF script reached the index as `i/crlf` at mode `100755`.
- **Owner gate.** The owner closed #37, deleted `ci/gate-canaries` and squash-merged #36 as `5643554` (`origin/main`'s tip) at 2026-10-23T21:08:26Z, then replied `merged`.

## Task Commits

1. **Task 1 (tracer)**: WB `7d064d1` docs: record PR 2 opened and the first CI run; `c166793` docs: record the second PR 2 test-e2e failure; `92a17ba` docs: record PR 2 CI green on attempt 3
2. **Task 2**: WB `2b138ac` docs: record the gate canary results (canary branch commit `1d5cbf1`, never merged)
3. **Task 3**: WB `9ef5a0c` docs: record the PR 2 merge and the canary closing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Unused-dependency plant changed from `yaml@2.9.1` to `fastest-levenshtein@1.0.16`**
- **Found during:** Task 2 local pre-check
- **Issue:** knip did not report `yaml` as an unused devDependency in `apps/web`; it is an optional peer dependency of installed packages (vite among them), which knip counts as used. The plan's plant could not make the knip step red for the dependency.
- **Fix:** planted `fastest-levenshtein@1.0.16` (already a dependency of `@hearth/matching`, so no new lockfile package) on the throwaway branch only; knip then reported `Unused devDependencies fastest-levenshtein`. Recorded in the ledger (`canary-dependency-plant=`) and in the canary PR body. The plan's verify clause grepping the hygiene log for `yaml` was replaced by `fastest-levenshtein`.
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml` on `ci/gate-canaries` only
- **Commit:** `1d5cbf1` (never merged)

### Rule 9 decisions (not code deviations)

- `test-e2e` failed on PR 2's unchanged head twice before passing: attempt 1 `17-accessibility-states.spec.ts:497` (light), attempt 2 `19-notifications.spec.ts:140` (light). Neither log had `toomanyrequests`, so they were not registry flakes. Each rerun was an owner decision (DA-4: the notification E2E spec flakiness is out of scope); attempt 3 passed all 104 tests. The two distinct failures are recorded as flake evidence (`pr2-e2e-flake-evidence=`), not proof.

## Known Stubs

None.

## Issues Encountered

- The notification E2E flakiness above. It is deferred under DA-4 and remains a risk for every later `main` run (a red `test-e2e` blocks the Deploy).
- The Deploy workflow still waits on an unregistered `hearth` self-hosted runner; it was not touched.

## User Setup Required

None open.

## Next Phase Readiness

06-09 syncs WB with `main` (`5643554`), records `main`'s CI run on the merge, the first `Sweep` run and the Deploy run under the new rule, and then adds the CI-07 docs (`CONTRIBUTING.md`, `.claude/CLAUDE.md`, `.planning/codebase/*`) in PR 3. `requirements-completed` stays empty here; 06-09 records `main`'s run on the merge.

## Self-Check: PASSED

- WB commits `7d064d1`, `c166793`, `92a17ba`, `2b138ac` and `9ef5a0c` are ancestors of HEAD.
- The ledger has `pr2=`, `pr2-ci=`, `pr2-hygiene-steps=`, `pr2-db-types-on-ci=`, `pr2-runner-coverage=`, `canary-pr=`, `canary-head=`, `canary-steps=`, `canary=done`, `canary-closed=`, `pr2-merged=` and `pr2-merged-reply=`.
- REST: PR #36 merged as `56435543eee0cb765f9e85dddc5d2007dd86862d`; PR #37 closed, unmerged; `ci/gate-canaries` absent from `origin`.
- WB's `supabase/migrations/` and `apps/service/src/db/types.ts` equal `main`'s as of this plan; token pattern and value scans under `.planning` are clean.
