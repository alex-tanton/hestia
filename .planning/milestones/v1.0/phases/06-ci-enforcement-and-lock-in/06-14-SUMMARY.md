---
phase: 06-ci-enforcement-and-lock-in
plan: 14
subsystem: infra
tags: [ci, test-e2e, flakes, root-cause, diagnosis, owner-gate, proof-bar, uat-gap-closure]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: Plan 06-11 flake inventory and unexpired artifacts, Plan 06-13 deploy gate PR #44
provides:
  - OD-8 owner decision recorded: measured failure rate is enough regression evidence for test-class fixes; product-class fixes require Vitest regression tests failing first
  - F-01 (19-notifications:140) diagnosed as product race condition (stale GET /api/users/me overwriting active household mutation); reproduced locally 2/5
  - F-02 (17-accessibility-states:497) diagnosed as test bug (unfulfilled PATCH route leaves save.isPending true in NotificationTypes.tsx, dropping second toggle); reproduced locally 5/5
  - F-03 (17-accessibility-states:526) diagnosed as test shared-state bug (earlier tests leave Alex's switches checked, search loop returns index -1); reproduced locally 5/5
  - F-04 (17-accessibility-states:320) diagnosed as test race condition (immediate navigation to /lists/archived aborts in-flight PATCH /api/lists/:id); reproduced locally 2/5
  - F-05 (18-chores-and-errands-offline:140) diagnosed as test race condition (offline reload within createCachePersister 1000ms throttle window leaves app without cached profile); reproduced locally 2/5
  - All 5 flaky tests diagnosed and reproduced locally; diagnosis=done flaky=5 product=1 test=4 infra=0 not-reproduced=0
  - Infra dispositions proposed: ECR pull rate limit mitigated, Docker rate limit mitigated, pnpm engine verification external re-run
  - Owner checkpoint gate approved: gate-flake-fixes=approve 2026-10-24, proof-bar-ci=15, proof-reruns=14
affects: [06-15, 06-16]

actuals:
  tokens: 22000
  tasks: 3
  commits: 3 on WB

tech-stack:
  added: []
  patterns:
    - "Playwright trace analysis over action, console, and network logs for root-cause diagnosis"
    - "Isolated local E2E reproduction in throwaway worktree with controlled network latency and race conditions"
    - "Clean test isolation and query client cache synchronization patterns"

key-files:
  created:
    - .planning/phases/06-ci-enforcement-and-lock-in/06-14-SUMMARY.md
  modified:
    - .planning/cleanup/FLAKE-INVENTORY.md
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "OD-8: Measured failure rate before fix is sufficient regression evidence for test-class fixes; product fixes require a Vitest regression test failing first"
  - "F-01 product fix: useSwitchHousehold cancels in-flight profile queries via onMutate to prevent stale profile overwriting mutated active household"
  - "F-02..F-05 test fixes: address test-side routing, shared state isolation, mutation awaiting, and cache persister throttle timing"
  - "Proof bar: N = 15 consecutive complete green CI runs required on fix/ci-flakes, with a budget of 14 proof-reruns"

requirements-completed: []

plan_head_before: 0243f23
plan_head_after: 5a29a41

coverage:
  - id: ROOT-CAUSE-01
    description: "Every flaky test from CI history (F-01..F-05) has a written root cause with all 8 fields and local reproduction"
    requirement: G-06-5
    verification:
      - kind: document
        ref: ".planning/cleanup/FLAKE-INVENTORY.md (### F-01 through ### F-05)"
        status: pass
      - kind: log
        ref: ".planning/cleanup/logs/06-14-repro-F-*.log (F-01: 2/5, F-02: 5/5, F-03: 5/5, F-04: 2/5, F-05: 2/5)"
        status: pass
      - human_judgment: false
  - id: GATE-01
    description: "Owner approves fix list, product changes, infra dispositions, and CI proof bar"
    requirement: G-06-5
    verification:
      - kind: decision
        ref: "Owner response to Task 3 checkpoint: approve as presented (proof-bar=15, proof-reruns=14)"
        status: pass
      - kind: ledger
        ref: ".planning/cleanup/CI-ENFORCEMENT-LEDGER.md (gate-flake-fixes=approve 2026-10-24)"
        status: pass
      - human_judgment: true
---

# Plan 06-14 Summary

**Phase:** 06 — CI Enforcement and Lock-in  
**Plan:** 06-14 — Root cause diagnosis of every flaky test, local reproduction, infra dispositions, and owner gate approval  
**Status:** Complete  
**Date:** 2026-10-24  

## Overview

Plan 06-14 diagnosed every flaky test identified across GitHub Actions CI history (F-01 through F-05), evidenced each cause via preserved CI Playwright traces, reproduced every failure locally in an isolated environment under controlled conditions, and secured owner approval for the fix list, product change, infra dispositions, and the CI proof bar ($N = 15$).

## Root Cause Diagnoses & Reproduction Summary

| ID | Spec & Location | Cause Summary | Class | Repro Rate | Fix Summary | Regression Test |
|---|---|---|---|---|---|---|
| **F-01** | `tests/19-notifications.spec.ts:140` | Stale in-flight `GET /api/users/me` response overwrites active household set by `useSwitchHousehold` on navigation with `?household=` | `product` | 2/5 (40%) | `apps/web/src/lib/api/hooks.ts`: cancel in-flight `profile` queries in `onMutate` | Vitest unit/integration test in `App.test.tsx` + repro spec |
| **F-02** | `tests/17-accessibility-states.spec.ts:497` | Test route intercept on `PATCH` returns without fulfilling or aborting; `save.isPending` remains `true` in `NotificationTypes.tsx`, dropping the second toggle | `test` | 5/5 (100%) | `tests/17-accessibility-states.spec.ts:503`: abort or fulfill routed request before unrouting and second click | Repro spec under test conditions |
| **F-03** | `tests/17-accessibility-states.spec.ts:526` | Test shared state: earlier journey tests leave Alex's switches checked; search loop finds no unchecked switch and returns index `-1` | `test` | 5/5 (100%) | `tests/17-accessibility-states.spec.ts:526`: reset Alex's notification preferences before test or ensure unchecked switch | Repro spec under test conditions |
| **F-04** | `tests/17-accessibility-states.spec.ts:320` | Test clicks "Archive" and immediately executes `page.goto('/lists/archived')`; Chromium unloads page and aborts `PATCH /api/lists/:id` before commit | `test` | 2/5 (40%) | `tests/17-accessibility-states.spec.ts:353`: await `page.waitForResponse` or DOM detachment before navigating | Repro spec under test conditions |
| **F-05** | `tests/18-chores-and-errands-offline.spec.ts:140` | Test calls `page.reload()` offline before `createCachePersister` 1000ms throttle timer flushes to IndexedDB; app loads with empty cache stuck on skeleton | `test` | 2/5 (40%) | `tests/18-chores-and-errands-offline.spec.ts:119`: wait 1100ms for persistence throttle window before reload | Repro spec under test conditions |

All 5 flaky tests were reproduced locally with measured rates. No tests were categorized as `not-reproduced`.

## Infrastructure Dispositions

1. `Could not pull public.ecr.aws/supabase/gotrue:v2.196.0 after 6 attempts`: Mitigated by `scripts/ci-prepull-images.sh` pulling from ghcr.io mirror first. Disposition: `mitigated`.
2. `toomanyrequests: Rate exceeded`: Docker daemon ECR pull rate limits mitigated by pre-pull script and Docker Hub authenticated logins. Disposition: `mitigated`.
3. `ERR_PNPM_PNPM_ENGINE_IDENTITY_UNVERIFIABLE`: Transient npm registry signature verification failure. Disposition: `external` (re-run per rule 9).

## Owner Gate Decision (Task 3)

The owner reviewed the fix list, product change justification, infra dispositions, and proof criteria, and approved as presented:
- `gate-flake-fixes=approve 2026-10-24`
- `proof-bar-ci=15` (consecutive complete green CI runs required on `fix/ci-flakes`)
- `proof-reruns=14` (re-run all jobs budget on the PR's CI run)

## Next Steps

Proceed directly to **Plan 06-15**:
- Cut `fix/ci-flakes` from `origin/main` in worktree `/home/user/hearth-ci-flakes`.
- Implement F-01 product fix with failing Vitest regression test committed first.
- Implement F-02 through F-05 test-class fixes.
- Execute local proof per test under reproduction conditions ($\ge \max(30, \lceil \ln 0.05 / \ln(1 - r) \rceil)$ iterations green) and three consecutive clean full E2E suite runs (104/104 passed each).
- Run all 16 local gates and push `fix/ci-flakes`.
