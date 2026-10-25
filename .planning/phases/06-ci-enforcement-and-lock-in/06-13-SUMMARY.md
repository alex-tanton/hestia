---
phase: 06-ci-enforcement-and-lock-in
plan: 13
subsystem: infra
tags: [ci, deploy, deploy-gate, github-actions, pull-request, uat-gap-closure]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: Plan 06-12 deploy gate script, tests, docs, and pushed branch
provides:
  - deploy.yml passes HEARTH_DEPLOY_ATTEMPT=${{ github.run_attempt }} to scripts/deploy-gate.sh (OD-7)
  - workflow-facts.mjs extracts and verifies step id and environment variables
  - Wiring smoke test verified against stub docker: attempt 1 gives deploy=false, attempt 2 gives deploy=true
  - PR #44 opened into main with flagged deploy behavior changes and explanation
  - Pre-fix occurrence O-117 recorded in FLAKE-INVENTORY.md for F-03 on attempt 1
  - Single owner-approved re-run executed via route (a), bringing all 7 CI jobs to success (run 40115799178)
  - PR #44 left open waiting for owner squash-merge (Claude does not merge)
affects: [06-14, 06-15, 06-16]

actuals:
  tokens: 18500
  tasks: 3
  commits: 1 on W5, 2 on WB

tech-stack:
  added: []
  patterns:
    - "github.run_attempt passed to deploy gate in GitHub Actions deploy.yml"
    - "AST/YAML parsing of workflow steps and env in workflow-facts.mjs"

key-files:
  created:
    - .planning/phases/06-ci-enforcement-and-lock-in/06-13-SUMMARY.md
  modified:
    - .github/workflows/deploy.yml
    - .planning/cleanup/tools/workflow-facts.mjs
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md
    - .planning/cleanup/FLAKE-INVENTORY.md

key-decisions:
  - "OD-7 wiring: pass github.run_attempt from the Deploy workflow's own context to the deploy-gate step"
  - "Direct push: session token has workflow scope, allowing direct push to fix/deploy-gate-running-commit"
  - "Route (a): owner authorized one rerun-failed-jobs exception for known pre-fix flake F-03, achieving 7/7 green CI jobs"

requirements-completed: []

plan_head_before: 1f2df0d
plan_head_after: 4609b9e

coverage:
  - id: WIRE-01
    description: "deploy.yml passes HEARTH_DEPLOY_ATTEMPT: ${{ github.run_attempt }} to the changes step"
    requirement: G-06-3
    verification:
      - kind: test
        ref: "workflow-facts.mjs facts check and wiring smoke test (attempt1:false attempt2:true)"
        status: pass
      - human_judgment: false
  - id: WIRE-02
    description: "PR #44 opened from fix/deploy-gate-running-commit with flagged deploy behavior change"
    requirement: G-06-3
    verification:
      - kind: document
        ref: "PR #44 (https://github.com/alex-tanton/hearth/pull/44) body contains required sections"
        status: pass
      - human_judgment: false
  - id: WIRE-03
    description: "All seven CI jobs conclude success on PR #44 head commit"
    requirement: G-06-3
    verification:
      - kind: test
        ref: "run 40115799178 (attempt 2, owner-approved re-run): lint, typecheck, test-unit, test-integration, test-e2e, build, hygiene all success"
        status: pass
      - human_judgment: false
---

# Phase 6 Plan 13: Wire Deploy Gate in deploy.yml and Open Flagged PR #44 Summary

**Wired `HEARTH_DEPLOY_ATTEMPT: ${{ github.run_attempt }}` into `.github/workflows/deploy.yml`, validated via wiring smoke test, pushed directly to origin with workflow-scoped token, opened flagged PR #44, cataloged pre-fix flake occurrence O-117, and achieved 7/7 green CI jobs via owner-authorized re-run.**

## Performance

- **Tasks:** 3 (100% completed)
- **Commits:**
  - W5 (`fix/deploy-gate-running-commit`): `3859fd3` (`ci: pass run_attempt to deploy gate for deliberate redeploy`)
  - WB (`claude/confident-dirac-10eu0a`): `b3fdf19` (`feat(ci): emit step id and env in workflow-facts`), `4609b9e` (`docs: record deploy.yml facts and owner push match in ledger`)
- **CI Run:** `40115799178` (PR #44)
  - `lint`: success
  - `typecheck`: success
  - `test-unit`: success
  - `test-integration`: success
  - `test-e2e`: success (attempt 2, owner-approved re-run)
  - `build`: success
  - `hygiene`: success

## Accomplishments

1. **deploy.yml Wiring & Facts Tool:**
   - Extended `.planning/cleanup/tools/workflow-facts.mjs` to extract step `id` and `env.*` properties.
   - Updated `.github/workflows/deploy.yml` to pass `HEARTH_DEPLOY_ATTEMPT: ${{ github.run_attempt }}` to the gate step with `id: changes`.
   - Verified that all existing workflow facts (trigger, guard conditions, concurrency, permissions, runner labels) remain intact.
   - Checked with `actionlint` and Prettier.

2. **Wiring Smoke Test:**
   - Executed deploy gate against stub Docker container simulating currently running image rev.
   - Attempt 1: output `deploy=false` (skips rebuild/redeploy for running commit).
   - Attempt 2: output `deploy=true` (deliberate redeploy path).

3. **Direct Push & Pull Request #44:**
   - Pushed commit `3859fd3` directly to `origin/fix/deploy-gate-running-commit`.
   - Generated PR body with required sections:
     - `## Summary`
     - `## Why the running commit was redeployed`
     - `## Deploy behavior changes (flagged)` (D-20)
     - `## What changed`
     - `## The workflow commit`
     - `## User Stories & Acceptance Criteria`
     - `## Risks & Dependencies`
   - Opened PR #44: `https://github.com/alex-tanton/hearth/pull/44`.

4. **Flake Tracking & Route (a) Re-Run:**
   - Attempt 1 experienced a failure on known flaky spec F-03 (`tests/17-accessibility-states.spec.ts:526:5`).
   - Recorded pre-fix occurrence O-117 in `.planning/cleanup/FLAKE-INVENTORY.md` and updated F-03 statistics. Saved test log and Playwright zip artifact.
   - Owner authorized Route (a) re-run exception. Triggered `rerun-failed-jobs`.
   - Attempt 2 completed with all 7 jobs passing (`success`).
   - PR #44 remains open waiting for owner squash-merge in the order stated in 06-16. Claude does not merge.

---
*Generated by Claude (af07cdcb-a128-4414-bfde-2d9fe655fadc)*
