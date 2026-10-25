---
phase: 06-ci-enforcement-and-lock-in
plan: 11
subsystem: infra
tags: [ci, test-e2e, flakes, flake-inventory, proof-bar, uat-gap-closure]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: Phase 6 base complete, UAT gap G-06-5 identified for flake resolution
provides:
  - 18 unexpired playwright-report artifacts saved with SHA256SUMS before retention expiry (earliest expiry 2026-10-26T23:00:02Z)
  - ci-flake-inventory.mjs tool mining all 89 CI runs and 6 Sweep runs across 116 attempts and 676 jobs
  - All 116 failure signatures classified into 17 flaky, 56 real, 10 intentional, 33 infra, 0 unexplained
  - 5 distinct flaky specs identified with locations, counts, and timing characteristics (F-01..F-05)
  - Flake rate measured (p = 15/81 = 0.185 for test-e2e; 0.000 for unit and integration) and proof bar calculated (N = 15)
  - Local repetitions completed: unit 5/5, integration 3/3, integration sweep 5/5, unit sweep with today cell 42/42 with no failures
affects: [06-14, 06-15, 06-16]

actuals:
  tokens: 18000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Comprehensive CI flake inventory tool using Node ESM and gh API"
    - "PC-13 proof bar formula derived from historical test-e2e flake rate"

key-files:
  created:
    - .planning/cleanup/tools/ci-flake-inventory.mjs
    - .planning/cleanup/FLAKE-INVENTORY.md
  modified:
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md

key-decisions:
  - "OD-5: G-06-5 supersedes DA-4; all test flakiness in CI must be resolved before Phase 6 is complete"
  - "PC-13: The CI proof bar is N = max(10, ceil(ln(0.05) / ln(1 - p))) = 15 consecutive green CI runs"

requirements-completed: []

plan_head_before: f1c858395725c1d72a004a704dc0a0c3e31e2df4
plan_head_after: e08f305

coverage:
  - id: FLAKE-01
    description: "Every unexpired playwright-report artifact is saved and checksummed before retention expiry"
    requirement: G-06-5
    verification:
      - kind: artifact
        ref: ".planning/cleanup/logs/06-11-artifacts/ (18 zips with passing SHA256SUMS and unzip -tq)"
        status: pass
    human_judgment: false
  - id: FLAKE-02
    description: "Every CI and Sweep test failure signature is classified from evidence in FLAKE-INVENTORY.md"
    requirement: G-06-5
    verification:
      - kind: document
        ref: ".planning/cleanup/FLAKE-INVENTORY.md (116 O-rows matching failures.tsv, 5 F-rows)"
        status: pass
    human_judgment: false
  - id: FLAKE-03
    description: "CI proof bar is calculated objectively from measured test-e2e flake rate"
    requirement: G-06-5
    verification:
      - kind: formula
        ref: "p = 15/81 = 0.185 -> N = 15 (PC-13 formula)"
        status: pass
    human_judgment: false
  - id: FLAKE-04
    description: "Unit, component, integration, and sweep suites pass repeatedly locally on origin/main"
    requirement: G-06-5
    verification:
      - kind: test
        ref: "local-unit-repeat=5/5, local-integration-repeat=3/3, local-integration-sweep=5/5, local-sweep=42/42"
        status: pass
    human_judgment: false
---

# Phase 6 Plan 11: Flake Inventory, Proof Bar, and Local Repeats Summary

**Inventoried all 18 unexpired E2E traces before retention expiry, classified 100% of historical CI/Sweep failures (116 signatures across 95 runs and 116 attempts), established the CI proof bar (N = 15) from measured flake rate (p = 0.185), and proved local suites repeatable with 0 failures.**

## Performance

- **Duration:** ~2 hours
- **Tasks:** 3 (100% completed)
- **Artifacts:** 18 trace archives saved and checksummed
- **Commits:** 3 on working branch `claude/confident-dirac-10eu0a`

## Accomplishments

- **Task 1: E2E Traces Preserved and Inventory Tracer**
  - Downloaded all 18 unexpired `playwright-report` artifacts into `.planning/cleanup/logs/06-11-artifacts/`. Earliest expiry: `2026-10-26T23:00:02Z`. Verified integrity with `SHA256SUMS` and `unzip -tq`.
  - Added OD-5 and PC-13 decisions to `.planning/cleanup/CI-ENFORCEMENT-LEDGER.md`.
  - Created `.planning/cleanup/tools/ci-flake-inventory.mjs` (Node ESM, CLI flags, log caching, failure signature extraction, ESLint clean).
  - Validated tracer run on 40017353021 (2 rows with `green-on-attempt 3`).
  - Created `.planning/cleanup/FLAKE-INVENTORY.md` with all 8 mandatory sections.

- **Task 2: Full History Mining & Proof Bar Calculation**
  - Mined all 89 CI runs and 6 Sweep runs (116 attempts, 676 jobs across attempts, 85 failed job attempts).
  - Classified 116 failure signatures into:
    - `flaky`: 17
    - `real`: 56
    - `intentional`: 10
    - `infra`: 33
    - `unexplained`: 0
  - Summarized the 5 distinct flaky specs in `## Flaky tests`:
    - **F-01**: `tests/19-notifications.spec.ts:140` (8 occurrences, PR #43 & PR 2, spread over day)
    - **F-02**: `tests/17-accessibility-states.spec.ts:497` (5 occurrences, PR 2 & main, spread over day)
    - **F-03**: `tests/17-accessibility-states.spec.ts:526` (3 occurrences, main & 9819e7c, spread over day)
    - **F-04**: `tests/17-accessibility-states.spec.ts:320` (1 occurrence, Dependabot PR #41 attempt 1)
    - **F-05**: `tests/18-chores-and-errands-offline.spec.ts:140` (1 occurrence, Dependabot PR #39 attempt 1)
  - Computed flake rates:
    - `test-e2e`: $k = 15$, $n = 81$, $p = 15/81 = 0.185$
    - `test-unit`: $k = 0$, $n = 93$, $p = 0.000$
    - `test-integration`: $k = 0$, $n = 104$, $p = 0.000$
  - Computed CI proof bar:
    $$N = \max(10, \lceil \ln(0.05) / \ln(1 - 0.185185) \rceil) = \lceil 14.63 \rceil = 15$$
  - Recorded in ledger: `flake-inventory-runs=`, `flake-classes=`, `flaky-tests=`, `flake-rate-*`, `proof-bar-ci=15`.

- **Task 3: Local Repetition Beyond CI History**
  - Executed tests in detached throwaway worktree at `origin/main` (`f1c858395725c1d72a004a704dc0a0c3e31e2df4`):
    - `local-unit-repeat=5/5`: 5/5 passes
    - `local-integration-repeat=3/3`: 3/3 passes against fresh local Supabase stack
    - `local-integration-sweep=5/5`: 5/5 matrix cells passed
    - `local-sweep=42/42 now=2026-10-24T16:30:19.493Z tz=Pacific/Pago_Pago`: 42/42 workspace runs passed across 7 cells (6 fixed + today cell)
  - No intermittent unit, component, or integration failures detected; no `L-nn` rows generated.
  - Worktree removed cleanly and Supabase stopped. Recorded `flake-inventory=done`.

## Task Commits

1. **Task 1 (artifacts & tool)**: `8e62bf7` `docs: start the CI flake inventory and save the e2e traces`
2. **Task 2 (classification & proof bar)**: `c4ee04a` `docs: classify every CI test failure in the flake inventory`
3. **Task 3 (local repetitions & ledger complete)**: `e08f305` `docs: record local repeats of the unit and integration suites`

## Next Steps

- Proceed to **Wave 12 (`06-12-PLAN.md`)**: G-06-3 deploy gate "skip running commit" tracer and redeploy path.
