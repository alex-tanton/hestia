---
phase: 21-legacy-stack-cleanup-full-verification
plan: "02"
subsystem: web
tags: [vitest, unit-tests, dom-tests, coverage, md3, tokens, wcag]
requires:
  - 21-01
provides:
  - pure-md3-unit-and-dom-green
  - calibrated-coverage-thresholds
affects:
  - apps/web
tech-stack:
  added: []
  patterns:
    - calibrated v8 coverage thresholds accounting for legacy dead-code deletion
    - elevated asyncUtilTimeout and testTimeout for jsdom concurrency stability
key-files:
  created: []
  modified:
    - apps/web/vite.config.ts
    - apps/web/src/lib/sections.test.ts
    - apps/web/src/test-setup.ts
    - apps/web/src/components/shell/shell.test.tsx
decisions:
  - D-12: Calibrated coverage thresholds to statements: 82, branches: 77, functions: 75, lines: 83 (measured post-purge rounded down minus 1%)
status: complete
actuals:
  tokens: 1053
  tasks: 2
  commits: 2
  plan_head_before: e28925a7a2d8fbc4bae32d18f9a7ec859ff1560f
  plan_head_after: cccf947ad67661d511a59d0d63c8b07314cf3a90
---

# Phase 21 Plan 02: Vitest Unit & DOM Test Suite Stabilization & Coverage Calibration Summary

Synchronized Vitest unit and DOM suites across the Pure MD3 stack, verified WCAG AA contrast across all five surfaceContainer tiers in tokens.test.ts, cleaned Tab assertions in sections.test.ts, and calibrated v8 coverage thresholds in apps/web/vite.config.ts per Decision D-12.

## Performance & Execution Metrics

- **Total Tasks:** 2
- **Commits:** 2
  - `034b601`: `test(web): synchronize vitest unit and dom component test suites for md3 stack`
  - `cccf947`: `test(web): calibrate coverage thresholds for pure md3 web client`
- **Unit & DOM Tests:** 64 test files passed, 881 passing tests green across unit (Node) and dom (jsdom) project isolates.
- **Coverage Ratchet (v8):**
  - Statements: 83.45% (threshold: 82%)
  - Branches: 78.70% (threshold: 77%)
  - Functions: 76.60% (threshold: 75%)
  - Lines: 84.93% (threshold: 83%)
- **Exit Code:** `0` (clean run on `pnpm --filter @hestia/web test:coverage`).

## Key Changes

### Task 1: Vitest Unit & DOM Suites Synchronization
- Verified WCAG AA contrast across all 5 `surfaceContainer` tiers (`surfaceContainerLowest`, `surfaceContainerLow`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`) in `apps/web/src/tokens.test.ts` for both light and dark modes (93 tests green).
- Synchronized `apps/web/src/lib/sections.test.ts` to assert against clean `Tab` interfaces with zero Lucide icon definitions or legacy properties.
- Configured default Testing Library `asyncUtilTimeout: 5000` in `apps/web/src/test-setup.ts` to prevent DOM query race conditions under heavy parallel jsdom worker loads on Windows.
- Verified all 64 unit and DOM test files pass with 0 failures (`034b601`).

### Task 2: Coverage Ratchet & Threshold Calibration
- Measured test coverage under v8 engine across the full web client test suite.
- As anticipated by Decision D-12, the pure deletion of dead code shims (`ComingSoon.tsx`, unused Lucide definitions, legacy Tailwind bridges) shifted distribution math slightly by eliminating covered trivial code blocks.
- Calibrated thresholds in `apps/web/vite.config.ts` per Decision D-12 (measured value rounded down minus 1%):
  - Statements: 82% (measured 83.45%)
  - Branches: 77% (measured 78.70%)
  - Functions: 75% (measured 76.60%)
  - Lines: 83% (measured 84.93%)
- Increased `testTimeout: 30_000` in `apps/web/vite.config.ts` (matching service coverage configuration) and adjusted lazy Meals chunk `findByRole` timeout in `apps/web/src/components/shell/shell.test.tsx` to ensure stable AST instrumentation under heavy parallel execution.
- Verified that `pnpm --filter @hestia/web test:coverage` passes with exit code 0 (`cccf947`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Increased jsdom asyncUtilTimeout in test-setup.ts**
- **Found during:** Task 1
- **Issue:** Under 50+ concurrent jsdom worker threads, dependent queries in `deal-search.test.tsx` occasionally exceeded the default 1000ms async timeout before MSW mock data settled.
- **Fix:** Added `configure({ asyncUtilTimeout: 5000 })` in `apps/web/src/test-setup.ts`.
- **Files modified:** `apps/web/src/test-setup.ts`
- **Commit:** `034b601`

**2. [Rule 1 - Bug] Raised testTimeout to 30s in apps/web/vite.config.ts**
- **Found during:** Task 2
- **Issue:** v8 coverage instrumentation adds overhead to async database rollback simulations in `write-queue.test.tsx` and dynamic chunk loading in `shell.test.tsx`, exceeding 15s.
- **Fix:** Aligned `testTimeout: 30_000` with service configuration in `apps/web/vite.config.ts` and set `findByRole` timeout to 20s for lazy chunk navigation in `shell.test.tsx`.
- **Files modified:** `apps/web/vite.config.ts`, `apps/web/src/components/shell/shell.test.tsx`
- **Commit:** `cccf947`

## Self-Check: PASSED
- `apps/web/vite.config.ts`: FOUND
- `apps/web/src/tokens.test.ts`: FOUND
- `apps/web/src/lib/sections.test.ts`: FOUND
- `034b601`: FOUND
- `cccf947`: FOUND
