---
phase: 06-ci-enforcement-and-lock-in
plan: 15
subsystem: infra
tags: [ci, test-e2e, flakes, product-fix, test-fix, local-proof, whole-suite-proof, gates, push, uat-gap-closure]

requires:
  - phase: 06-ci-enforcement-and-lock-in
    provides: Plan 06-14 root causes, local repros, owner gate approval, and CI proof bar
provides:
  - F-01 product fix implemented and verified (commit 7ff1f7b), preceded by failing Vitest regression test (commit 7bc09a0), with 30/30 local proof under 25ms delay
  - F-02 test fix implemented (commit c2b9ea4), aborting hanging route before toggle in accessibility states, with 30/30 local proof
  - F-03 test fix implemented (commit fbdbd03), awaiting switch visibility and toggling off when all switches enabled, with 30/30 local proof
  - F-04 test fix implemented (commit ea4103e), awaiting archive mutation response before navigation to /lists/archived, with 30/30 local proof
  - F-05 test fix implemented (commit b921b82), waiting 1100ms for cache persister throttle before offline reload, with 30/30 local proof
  - Final cross-check: 30 consecutive iterations of all 5 tests on HEAD b921b82 (150 passes, 0 failures)
  - Whole suite proof: 3 consecutive full E2E runs (104 passed each, 0 failed, 0 flaky, 0 skipped), third run pinned to 2 CPU cores
  - 15 local gates executed on W6 with exit=0
  - WB merged cleanly into W6, pre-push safety scans clean, and fix/ci-flakes pushed to origin at 5c44cc98a017f829e0cd1fa08d617f3d4769cd7b
affects: [06-16]

actuals:
  tokens: 45000
  tasks: 3
  commits: 6 on fix/ci-flakes, 1 merge commit

tech-stack:
  added: []
  patterns:
    - "React Query queryClient.cancelQueries on mutation onMutate to prevent in-flight query race conditions"
    - "Playwright route interception with held Promise and clean abort before unrouting"
    - "Skeleton loading awareness in accessibility and settings tests"
    - "Network response synchronization before client-side navigation"
    - "Cache persister throttle window synchronization before offline simulation"

key-files:
  created:
    - .planning/phases/06-ci-enforcement-and-lock-in/06-15-SUMMARY.md
  modified:
    - apps/web/src/App.test.tsx
    - apps/web/src/lib/api/hooks.ts
    - e2e/tests/17-accessibility-states.spec.ts
    - e2e/tests/18-chores-and-errands-offline.spec.ts
    - .planning/cleanup/FLAKE-INVENTORY.md
    - .planning/cleanup/CI-ENFORCEMENT-LEDGER.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "F-01 product fix: cancel in-flight profile queries in useSwitchHousehold onMutate rather than relying solely on onSuccess setQueryData"
  - "F-02 fix: hold intercepted route with Promise and call route.abort() before unrouting to ensure save.isPending resets cleanly"
  - "F-03 fix: await switch visibility before count/querying to avoid race with SkeletonRows, and ensure an unchecked switch exists"
  - "F-04 fix: await POST /api/lists/:id/archive mutation response before navigating to /lists/archived"
  - "F-05 fix: wait 1100ms for createCachePersister throttle to persist query cache to IndexedDB before offline reload"
  - "Local proof bar met: every fix proven with 30 consecutive passes under repro conditions, plus 30 cross-check passes on HEAD, plus 3 full suite runs of 104 tests"

requirements-completed: []

plan_head_before: 5a29a41
plan_head_after: 2211010c32750423accea292d8c74b539691b982 (on fix/ci-flakes)

coverage:
  - id: FLAKE-FIX-01
    description: "F-01 product fix implemented red-before-green with Vitest test and proven locally 30/30"
    requirement: G-06-5
    verification:
      - kind: log
        ref: ".planning/cleanup/logs/06-15-F-01-unit-red.log (exit=1), 06-15-F-01-unit-green.log (exit=0)"
        status: pass
      - kind: log
        ref: ".planning/cleanup/logs/06-15-proof-F-01.log (30 passes, 0 failures)"
        status: pass
      - human_judgment: false
  - id: FLAKE-FIX-02-05
    description: "F-02 through F-05 test fixes implemented each as own commit and proven locally 30/30"
    requirement: G-06-5
    verification:
      - kind: log
        ref: ".planning/cleanup/logs/06-15-proof-F-{02..05}.log (30 passes each, 0 failures)"
        status: pass
      - kind: log
        ref: ".planning/cleanup/logs/06-15-proof-final-F-{01..05}.log (30 passes each on HEAD, 150 total)"
        status: pass
      - human_judgment: false
  - id: SUITE-PROOF-01
    description: "Whole E2E suite passes 3 consecutive times from empty database (104 passed each)"
    requirement: G-06-5
    verification:
      - kind: log
        ref: ".planning/cleanup/logs/06-15-e2e-full-{1,2,3}.log (104 passed each, 0 failures/flakes/skips)"
        status: pass
      - human_judgment: false
  - id: GATES-AND-PUSH-01
    description: "All 15 local gates pass with exit=0, WB merged, security scans clean, and fix/ci-flakes pushed"
    requirement: G-06-5
    verification:
      - kind: log
        ref: ".planning/cleanup/logs/06-15-{frozen,lint,format-check,typecheck,test,web-coverage,sweep,knip,knip-baseline,jscpd,audit,hygiene,migrations,build,commitlint}.log (exit=0 each)"
        status: pass
      - kind: git
        ref: "origin/fix/ci-flakes equals 5c44cc98a017f829e0cd1fa08d617f3d4769cd7b"
        status: pass
      - human_judgment: false
---

# Plan 06-15 Summary

**Phase:** 06 — CI Enforcement and Lock-in  
**Plan:** 06-15 — Fix every flaky test at its cause on `fix/ci-flakes`, local 30-iteration proof, cross-check, full-suite proof, gates, and push  
**Status:** Complete  
**Date:** 2026-10-24  

## Overview

Plan 06-15 resolved all five flaky tests identified across the repository's GitHub Actions CI history (F-01 through F-05) on the dedicated branch `fix/ci-flakes` cut from `origin/main` (`f1c8583`). Each fix was addressed at its genuine root cause without masking (no test was skipped, quarantined, retried, or given loosened assertions). F-01 was verified red-before-green with a failing Vitest regression test. Every fix was proven locally with 30 consecutive passes under reproduction conditions, verified through a 30-iteration cross-check on HEAD (150 passes), and validated through three consecutive whole-suite E2E passes (104 tests passed each, with the third run pinned to 2 CPU cores). All 15 local gates passed cleanly (`exit=0`), and `fix/ci-flakes` was merged with WB and pushed to `origin`.

## Commits on `fix/ci-flakes`

1. `7bc09a0`: `test(web): add regression test for active household switch race`
   - Vitest test in `apps/web/src/App.test.tsx` simulating concurrent profile revalidation and active household switch. Failed with `exit=1` prior to product fix (`06-15-F-01-unit-red.log`).
2. `7ff1f7b`: `fix(web): cancel in-flight profile queries on active household switch`
   - Added `onMutate: async () => { await queryClient.cancelQueries({ queryKey: queryKeys.profile }); }` to `useSwitchHousehold` in `apps/web/src/lib/api/hooks.ts`. Vitest suite passed 9/9 (`06-15-F-01-unit-green.log`).
3. `c2b9ea4`: `test(e2e): abort hanging route before toggle in accessibility states`
   - In `e2e/tests/17-accessibility-states.spec.ts:497`, held intercepted PATCH route open asynchronously until `COPY.saving` assertions passed, then aborted before unrouting and second click, resetting `save.isPending`.
4. `fbdbd03`: `test(e2e): isolate notification preferences in unregistered device test`
   - In `e2e/tests/17-accessibility-states.spec.ts:526`, awaited `switches.first().toBeVisible()` to handle SkeletonRows loading, and ensured an unchecked switch exists by toggling the first off if all were enabled by prior tests.
5. `ea4103e`: `test(e2e): await archive response before navigating to archived lists`
   - In `e2e/tests/17-accessibility-states.spec.ts:320`, added `await page.waitForResponse(res => res.url().includes('/archive') && res.request().method() === 'POST' && res.status() === 200)` before `page.goto('/lists/archived')`.
6. `b921b82`: `test(e2e): wait for cache persister throttle before offline reload`
   - In `e2e/tests/18-chores-and-errands-offline.spec.ts:140`, added `await page.waitForTimeout(1100)` before offline `page.reload()` to allow `createCachePersister` 1000ms throttle timer to flush to IndexedDB.
7. `5c44cc9`: Merge commit merging WB (`claude/confident-dirac-10eu0a`) into `fix/ci-flakes`.

## Proof and Verification Summary

### 1. Local Iteration Proofs under Repro Conditions ($\ge 30$ passes)
- **F-01 (`tests/19-notifications.spec.ts:140`)**: 30/30 PASS on isolated stack `proof01` with 25ms route delay (`06-15-proof-F-01.log`).
- **F-02 (`tests/17-accessibility-states.spec.ts:497`)**: 30/30 PASS on isolated stack `proof02` with route hold and abort (`06-15-proof-F-02.log`).
- **F-03 (`tests/17-accessibility-states.spec.ts:526`)**: 30/30 PASS on isolated stack `proof03` under forced-all-enabled state (`06-15-proof-F-03.log`).
- **F-04 (`tests/17-accessibility-states.spec.ts:320`)**: 30/30 PASS on isolated stack `proof04` with 20ms route delay (`06-15-proof-F-04.log`).
- **F-05 (`tests/18-chores-and-errands-offline.spec.ts:140`)**: 30/30 PASS on isolated stack `proof05` with offline reload (`06-15-proof-F-05.log`).

### 2. Final Cross-Check on HEAD (`b921b82`)
- Ran 30 consecutive iterations of all 5 tests sequentially on isolated stack `finalproof`.
- All 5 tests scored 30/30 PASS (150 passes total, 0 failures) logged in `06-15-proof-final-{F-01..F-05}.log`.

### 3. Whole-Suite Proof (3 Consecutive Full Runs)
- Run 1: 104 passed in 7.2m (`06-15-e2e-full-1.log`)
- Run 2: 104 passed in 7.8m (`06-15-e2e-full-2.log`)
- Run 3: 104 passed in 8.2m (`06-15-e2e-full-3.log`), Playwright runner pinned to 2 CPU cores (`taskset -c 0,1`)

### 4. Local Gates
All 15 gates passed on W6, each ending with `exit=0`:
`frozen`, `lint`, `format-check`, `typecheck`, `test`, `web-coverage` (85.38% against 84%), `sweep` (36/36 passed), `knip`, `knip-baseline` (28 entries), `jscpd` (1.14%), `audit` (0 advisories), `hygiene` (clean across 983 files and 14 scripts), `migrations` (0 added, append-only clean), `build`, `commitlint`.

### 5. Delivery
- Pre-push scans: 0 tokens detected, no CA workaround artifacts, no changes to docker, .dockerignore, migrations, or database types.
- Remote push: `git push origin HEAD:refs/heads/fix/ci-flakes` succeeded.
- `flake-push=5c44cc98a017f829e0cd1fa08d617f3d4769cd7b`
- `flake-tree=076a04e356c0fc0fff74d1c89acfb0fd6a1a5d5e`
- `flake-handoff=none` (no workflow file changes).

## Next Steps

Proceed directly to **Plan 06-16**:
- Open pull request PR 4 from `fix/ci-flakes` into `main`.
- Achieve the approved CI proof bar: $N = 15$ consecutive complete green CI runs across all jobs.
- Verify Sweep workflow on `main`.
- Document complete flake closure and close UAT gap G-06-5.
