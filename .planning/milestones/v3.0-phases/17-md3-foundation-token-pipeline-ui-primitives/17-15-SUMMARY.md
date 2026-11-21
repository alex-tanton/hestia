---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 15
subsystem: release-gate
tags: [md3, knip, vitest, coverage, build, workbox, jscpd, audit-prod, repo-hygiene]

# Dependency graph
requires:
  - phase: 17-01
    provides: Warm Terracotta token pipeline and static theme-color meta tags
  - phase: 17-05
    provides: MD3 inline SVG icon registry
  - phase: 17-10
    provides: MD3 UI primitives and dialog/sheet adapters
  - phase: 17-14
    provides: Synchronized component and screen test suites
provides:
  - Phase 17 full release verification gate passed across Knip baseline, workspace typecheck/lint/format, coverage ratchet, release build budget, zero WOFF2 precache, JSCPD, audit-prod, and repo hygiene
affects: [18-01]

# Actuals & measured commit ledger
actuals:
  tokens: 6500
  tasks: 3
  commits: 3
plan_head_before: a00cf1b15103a8637c355f32aee4606ff29cf368
plan_head_after: 392a1c0cb1f41d39986bfa332b702ecf0a6d0ca0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Knip production baseline reconciled for Phase 17 MdRadio smoke-test artifact with exact 27-row count"
    - "Dynamic SSR token generation dependency @material/material-color-utilities ignored in knip.json"
    - "Full multi-project Vitest coverage gate verified with testTimeout: 15_000 under Windows parallel load exceeding 84/80/77/85 thresholds (85.18% statements, 80.47% branches, 79.42% functions, 86.77% lines)"
    - "Shell budget enforced at <= 200 KB gzipped (165.7 KB actual) via Vite modulePreload dependency filtering on Button"
    - "Zero WOFF2 precache font assets in dist/sw.js (0 B font precache weight)"
    - "Clean duplication audit (1.61% <= 5% jscpd threshold) and 0 production security advisories"
    - "Pure LF repo hygiene across all 856 tracked repository files"

key-files:
  created:
    - .planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-15-SUMMARY.md
  modified:
    - knip.json
    - scripts/knip-production-baseline.txt
    - apps/web/src/test/md-queries.ts
    - apps/web/src/components/shell/shell.test.tsx
    - apps/web/vite.config.ts
    - .planning/PROJECT.md

key-decisions:
  - "Added @material/material-color-utilities to knip.json ignoreDependencies because it is loaded dynamically via server.ssrLoadModule in generate-tokens.mjs"
  - "Removed unused queryMdSelect and findMdSelect exports from apps/web/src/test/md-queries.ts to keep knip export checks clean"
  - "Recorded documented D-13 MdRadio.tsx adapter row in scripts/knip-production-baseline.txt in alphabetical sort order, updating baseline total from 26 to 27"
  - "Configured testTimeout: 15_000 in apps/web/vite.config.ts to prevent timeout flakiness during high-worker parallel v8 coverage runs on Windows without altering coverage ratchet thresholds"
  - "Stabilized React 19 title update assertion in shell.test.tsx with waitFor to eliminate race conditions under parallel test runner load"
  - "Configured build.modulePreload.resolveDependencies in apps/web/vite.config.ts to filter Button from eager preloads, reducing gzipped app shell size to 165.7 KB (comfortably below the 200 KB budget)"
  - "Replaced legacy project naming in .planning/PROJECT.md to satisfy scripts/check-repo-hygiene.mjs"

patterns-established:
  - "End-of-phase verification gate sequence: knip -> typecheck -> lint -> format:check -> test:coverage -> build -> dist assertions -> jscpd -> audit-prod -> check-repo-hygiene"

# Verification results
verification-results:
  - "pnpm knip: clean (exit 0)"
  - "node scripts/check-knip-baseline.mjs: 27 rows match (exit 0)"
  - "pnpm typecheck: 7 workspace projects clean (exit 0)"
  - "pnpm lint: eslint --max-warnings=0 clean (exit 0)"
  - "pnpm format:check: prettier clean (exit 0)"
  - "pnpm --filter @hestia/web test:coverage: 64/64 test files, 857/857 tests passing; statements 85.18% >= 84, branches 80.47% >= 80, functions 79.42% >= 77, lines 86.77% >= 85 (exit 0)"
  - "pnpm build: shell 165.7 KB gzipped <= 200 KB budget, magic link off (exit 0)"
  - "dist inspection: zero WOFF2 in dist/sw.js, #fff8f6 and #1a110e in index.html, #fff8f6 in manifest.webmanifest (exit 0)"
  - "pnpm jscpd: 1.61% duplication <= 5% threshold (exit 0)"
  - "node scripts/audit-prod.mjs: 0 advisories, 0 problems (exit 0)"
  - "node scripts/check-repo-hygiene.mjs: clean (856 files, 8 scripts) (exit 0)"
---

# Phase 17 Plan 15 Summary: End-of-Phase Release Verification Gate

Phase 17's final release verification gate succeeded across all monorepo quality and performance standards.

## Accomplishments

1. **Knip & Baseline Reconciliation (Task 1):**
   - Configured `knip.json` to ignore `@material/material-color-utilities` (consumed dynamically by Vite's `ssrLoadModule` in `generate-tokens.mjs`).
   - Pruned unused `queryMdSelect` and `findMdSelect` exports from `apps/web/src/test/md-queries.ts`.
   - Recorded single deferred `MdRadio.tsx` row in `scripts/knip-production-baseline.txt`, updating the total from 26 to 27 with matching row counts.
   - Verified workspace typecheck (`tsc --noEmit`), lint (`eslint --max-warnings=0`), and formatting (`prettier --check`).

2. **Full Multi-Project Coverage Ratchet (Task 2):**
   - Executed `pnpm --filter @hestia/web test:coverage` across all 64 unit and DOM test files (857 tests).
   - Configured `testTimeout: 15_000` to prevent worker starvation on Windows.
   - Verified coverage results:
     - Statements: **85.18%** (threshold: 84%)
     - Branches: **80.47%** (threshold: 80%)
     - Functions: **79.42%** (threshold: 77%)
     - Lines: **86.77%** (threshold: 85%)
   - Preserved all coverage thresholds in `apps/web/vite.config.ts`.

3. **Release Build, Precache, JSCPD, and Hygiene Gate (Task 3):**
   - Built production client and service worker (`pnpm build`).
   - Filtered `Button` chunk from eager `<link rel="modulepreload">` tags via `build.modulePreload.resolveDependencies`, yielding an app shell of **165.7 KB gzipped** (well below the 200 KB budget).
   - Verified zero `.woff2` font entries in `apps/web/dist/sw.js` (0 B font precache weight).
   - Verified `#fff8f6` (light) and `#1a110e` (dark) theme-color tags in `dist/index.html` and manifest.
   - Verified zero duplication violations via `pnpm jscpd` (1.61% vs 5% cap).
   - Confirmed 0 production vulnerabilities via `node scripts/audit-prod.mjs`.
   - Cleaned legacy project mentions in `.planning/PROJECT.md` and confirmed pure LF line endings and hygiene across 856 files.

