---
phase: 06-ci-enforcement-and-lock-in
plan: 07
subsystem: infra
tags: [ci, docs, ci-05-review, owner-handoff, deploy-gate]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: ci/enforce-gates (W2) with five commits from pr2-base d0c587c (06-06)
provides:
  - docs on W2 that describe what PR 2 enforces (testing.md, deploy.md, file-map.md, README.md)
  - the CI-05 review of ci.yml, sweep.yml, deploy.yml and the setup action, with F1 to F17 and OD-4 a to d dispositioned
  - sixteen green local gates on W2 at 45ca790
  - six patches and a tree-pinned apply.sh; ci/enforce-gates on origin at the proven tree
  - the owner's gate reply and canary choice (with-migration)
affects: [06-08, 06-09, 06-10]

actuals:
  tokens: 9249
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A branch the token cannot push is handed over as committed patches plus a script that pins base and tree and refuses to push on a mismatch"

key-files:
  created:
    - .planning/cleanup/patches/ci-enforce-gates/apply.sh
    - .planning/cleanup/patches/ci-enforce-gates/0006-docs-describe-the-CI-gates-the-sweep-workflow-and-th.patch
  modified:
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md
    - .planning/cleanup/patches/ci-enforce-gates/0001-ci-add-a-hygiene-job-that-runs-the-repository-gates.patch

key-decisions:
  - "The token push of ci/enforce-gates is refused for the missing workflow scope; the owner pushes it from patches whose tree is pinned (T-06-25)"
  - "Canary choice with-migration: the throwaway canary may edit one line of the newest migration (PC-11, D-03 exception)"

requirements-completed: []

plan_head_before: 4dac89afa5ff924b4d871cabed0b09b8bdaa391a
plan_head_after: 51314198c051d84548b93857a90f9ad2481bf4cc

coverage:
  - id: D1
    description: "The four doc files state what PR 2 makes true and no stale sentence remains"
    requirement: CI-06
    verification:
      - kind: other
        ref: "stale-phrase search over W2 docs/ and README.md prints nothing; prettier --check README.md; docs-claims checked=2767 misses=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "CI-05 review covers three workflows and the setup action, with 21 dispositions"
    requirement: CI-05
    verification:
      - kind: other
        ref: "ledger '## CI-05 review', ci05-review=complete findings=21; actionlint clean; zizmor 29 shown findings (17 unpinned-uses, 8 self-repository, 3 dependabot-cooldown, 1 dangerous-triggers)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ci/enforce-gates reached origin at the proven tree"
    requirement: CI-05
    verification:
      - kind: other
        ref: "origin/ci/enforce-gates 0061269c32e30c9f84eb3d80198577888dd31084, tree 54069f099544ee0c93b741e935104ffe6a271acd equals pr2-tree; apply.sh dry run printed 'tree matches'"
        status: pass
    human_judgment: false
---

# Phase 6 Plan 07: PR 2 finish Summary

**PR 2's docs, the CI-05 review and sixteen green local gates are done, and the owner pushed `ci/enforce-gates` to `origin` at exactly the proven tree after the token push was refused for the missing `workflow` scope.**

## Performance

- **Tasks:** 3 (one tracer, one auto, one owner checkpoint).
- **Files:** W2 changes `docs/testing.md`, `docs/deploy.md`, `docs/file-map.md` and `README.md`; WB gains the review, six patches, `apply.sh` and ledger keys.

## Accomplishments

- **Docs (W2 `45ca790`).** `docs/testing.md` states the web thresholds 84/80/77/85 and that `test-unit` runs web `test:coverage` while web's `test` stays plain, that `test-unit` runs `pnpm test:harness` first, the `db:types` drift step, `sweep.yml` (six fixed cells on `main`, the today cell nightly at 05:17 UTC and in manual runs, `sweep-logs` for 14 days, never a deploy), and the `hygiene` job with its date-dependent audit. `docs/deploy.md` and `README.md` state the OD-4 rule (running-revision comparison through `scripts/deploy-gate.sh`, `docs/` and `.planning/` only changes skip, older commits skip, full history, no token). `docs/file-map.md` names `sweep.yml`, seven jobs and the gate rows.
- **CI-05 review.** The ledger's `## CI-05 review` holds an 11-row checklist table and 21 finding rows. F1, F3, F4, F6, F8 and OD-4 a to d are fixed in PR 2; OD-4 a to d are flagged for PR 2's body; F2, F5, F7 and F9 to F14 are kept with reasons; F15 and F16 are deferred as owner repository settings; F17 is deferred under DA-4.
- **Sixteen local gates** exited 0 on W2: frozen, lint, format-check, typecheck, test, knip, knip-baseline, jscpd, audit, hygiene, migrations, web-coverage, build, actionlint, commitlint, docs-claims (`pr2-local=16/16`).
- **Delivery.** One token push was refused (`workflow` scope), recorded as `pr2-push=fallback`. Six patches and a `100755` `apply.sh` pin `BASE=d0c587c`, `TREE=54069f0...` and `BRANCH=ci/enforce-gates`; the dry run printed `tree matches`.
- **Owner gate.** The owner ran the hand-off command and replied `pushed approve-pr2 canary=with-migration`. `origin/ci/enforce-gates` is `0061269c32e30c9f84eb3d80198577888dd31084` and its tree equals `pr2-tree` (`pr2-pushed-tree-match=yes`). PR 2 is not opened yet.

## Task Commits

1. **Task 1 (tracer)**: W2 `45ca790` docs: describe the CI gates, the sweep workflow and the deploy gate; WB `78fbf6a` docs: record the CI-05 review and the PR 2 local proof
2. **Task 2**: WB `de0a796` docs: hand off the PR 2 branch as patches; `43133bd` docs: record the PR 2 hand-off dry run
3. **Task 3**: WB `5131419` docs: record the PR 2 push and the owner's gate reply

## Deviations from Plan

None. Notes:

- Patches 0001 to 0005 were regenerated with the six-patch numbering (`[PATCH n/6]`), the only change in them.
- `CONTRIBUTING.md`, `.claude/CLAUDE.md` and `.planning/codebase/*` still carry the older CI wording; they belong to PR 3 (06-09).
- The Deploy workflow still waits on an unregistered `hearth` self-hosted runner; it was not touched. PR #32 and #33 were not touched.

## Known Stubs

None.

## Issues Encountered

None. The token refusal was the expected outcome.

## User Setup Required

None open. The owner's push is done.

## Next Phase Readiness

06-08 opens PR 2 from `ci/enforce-gates` (head `0061269`) with OD-4 a to d in the body, waits for seven green jobs, and, per the canary choice `with-migration`, opens the throwaway canary pull request. The first `hygiene` run depends on today's advisory database (Pitfall 10), and the nightly sweep costs Actions minutes (A2).

## Self-Check: PASSED

- W2 commit `45ca790` exists on `ci/enforce-gates`; WB commits `78fbf6a`, `de0a796`, `43133bd` and `5131419` exist and are pushed.
- `apply.sh` is mode `100755`; the ledger has `ci05-review=`, `pr2-local=`, `pr2-head=`, `pr2-tree=`, `pr2-files=`, `pr2-push=`, `pr2-push-refusal=`, `owner-command=`, `dry-run=`, `pr2-pushed=`, `pr2-pushed-tree-match=`, `gate-pr2=` and `canary-choice=`.
- Token pattern and value scans under `.planning` are clean.
