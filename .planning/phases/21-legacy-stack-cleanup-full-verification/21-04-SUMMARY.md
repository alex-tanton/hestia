---
phase: 21-legacy-stack-cleanup-full-verification
plan: "04"
subsystem: release-gates
tags: [accessibility, wcag-2.1-aa, knip, bundle-size, jscpd, ci-ratchets, hygiene]
requires:
  - 21-03
provides:
  - wcag-2.1-aa-verified-light-dark
  - clean-knip-production-baseline
  - shell-budget-under-200kb
  - ci-ratchets-passed
affects:
  - apps/web
  - e2e
  - scripts
tech-stack:
  added: []
  patterns:
    - full WCAG 2.1 AA coverage across light and dark themes using AxeBuilder
    - atomic Knip production baseline reconciliation with zero un-allowlisted exports
    - shell bundle ratchet verification <= 200 KB gzipped
    - repo hygiene, duplication, lint, and typecheck enforcement
key-files:
  created: []
  modified:
    - e2e/tests/17-accessibility-states.spec.ts
    - apps/web/src/screens/chores/ChoreFormScreen.tsx
    - knip.json
    - scripts/knip-production-baseline.txt
    - apps/web/src/components/bills/bills-copy.ts
    - apps/web/src/components/ui/Button.tsx
    - apps/web/src/lib/use-media-query.ts
  deleted:
    - apps/web/src/screens/deals/AddToList.tsx
decisions:
  - D-13: Atomically reconciled Knip production baseline against knip:production output
  - D-14: Maintained repo hygiene clean across 937 files
  - D-15: Kept gzipped app shell at 171.3 KB, well below the 200 KB budget ceiling
  - D-16: Maintained jscpd token duplication at 1.90%, far below 5.0% threshold
status: complete
actuals:
  tokens: 1400
  tasks: 3
  commits: 1
  plan_head_before: f7cc6f082e6d98cb82bbba7ca3ea5cb6ce013143
  plan_head_after: 22d36d3fdf6c638f32279bbecbc5f8f5ea0f0550
---

# Phase 21 Plan 04: Release Verification Gates Summary

Executed the complete suite of release verification gates for Phase 21: light and dark theme WCAG 2.1 AA accessibility audits, Knip production baseline reconciliation, app shell gzipped bundle ceiling enforcement, and repository hygiene ratchets.

## Performance & Execution Metrics

- **Total Tasks:** 3
- **Commits:** 1
  - `22d36d3`: `chore(web): pass a11y audits, knip baseline, ci ratchets (21-04)`
- **Accessibility:** 66/66 test cases passed in `17-accessibility-states.spec.ts` with zero WCAG 2.1 AA violations in light and dark schemes.
- **Knip Baseline:** 28 rows match exactly (`check-knip-baseline.mjs` exits with code 0).
- **Bundle Budget:** 171.3 KB gzipped shell (budget <= 200 KB gzipped; margin: 28.7 KB).
- **Code Duplication:** 1.90% line duplication (limit <= 5.00%).
- **Repo Hygiene:** 937 files clean (`check-repo-hygiene.mjs` exits with code 0).
- **Lint & Typecheck:** 0 warnings, 0 errors across all 7 workspace packages.
- **Production Audit:** 0 advisories, 0 allowed, 0 problems (`audit-prod.mjs` exits with code 0).

## Key Changes

### Task 1: Accessibility Audits (WCAG 2.1 AA)
- Modernized `e2e/tests/17-accessibility-states.spec.ts` to assert user-facing semantic queries (`getByLabel`, `getByRole('alertdialog')`, `getByRole('dialog')`, `md-outlined-button`).
- Synchronized empty state copy strings with current MD3 component copy definitions (`COPY.recipesEmpty`, `COPY.billsEmpty`, etc.).
- Fixed `ChoreFormScreen.tsx`: moved `<ConfirmDialog>` outside `<MdDialog>` so that light DOM slotted children are projected into the document tree rather than ignored by Material Web's `<md-dialog>` shadow root.
- Successfully verified both light and dark theme states with zero axe violations across 66 screen states.

### Task 2: Knip Baseline Clean Slate
- Purged obsolete `"tailwindcss"` dependency from `knip.json` `ignoreDependencies`.
- Deleted unused dead file `apps/web/src/screens/deals/AddToList.tsx`.
- Removed stale unused exports in `apps/web/src/components/bills/bills-copy.ts`, `apps/web/src/components/ui/Button.tsx`, and `apps/web/src/lib/use-media-query.ts`.
- Atomically regenerated `scripts/knip-production-baseline.txt` via `scripts/knip-summary.mjs`, correctly tracking active tested primitives (`Tabs.tsx`).
- Verified `node scripts/check-knip-baseline.mjs` passes with code 0.

### Task 3: CI Hygiene & Ratchet Gates
- Ran `pnpm jscpd`: 1.90% total duplication (limit 5.0%).
- Ran `pnpm build`: app shell built successfully at 171.3 KB gzipped (limit 200 KB).
- Ran `node scripts/check-repo-hygiene.mjs`: verified LF endings and zero legacy design token violations.
- Ran `pnpm lint`: clean pass with zero warnings across the repository.
- Ran `pnpm typecheck`: clean pass across all 7 workspaces.
- Ran `node scripts/audit-prod.mjs`: zero advisories or untracked production script leaks.
- Ran `pnpm test`: 881 web tests, 214 shared tests, 72 recurrence tests, 156 matching tests, and all service integration tests passing green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Nested `<ConfirmDialog>` in `<MdDialog>` dropped by shadow DOM**
- **Found during:** Task 1 (`17-accessibility-states.spec.ts`)
- **Fix:** Moved `<ConfirmDialog>` outside `<MdDialog>` in `ChoreFormScreen.tsx` as a sibling element so that its alertdialog is projected and rendered properly.

**2. [Rule 1 - Bug] Commitlint subject length constraint**
- **Found during:** Commit step
- **Fix:** Shortened commit message from 81 characters to 52 characters to conform to `subject-max-length` constraint (<= 71 characters).

## Verification Results

| Gate | Target | Result | Status |
|------|--------|--------|--------|
| WCAG 2.1 AA (Light) | 0 violations | 0 violations | PASS |
| WCAG 2.1 AA (Dark) | 0 violations | 0 violations | PASS |
| Knip Production Baseline | 0 drift | 28/28 rows match | PASS |
| Shell Bundle Budget | <= 200 KB gzipped | 171.3 KB gzipped | PASS |
| JSCPD Code Duplication | <= 5% | 1.90% | PASS |
| Repository Hygiene | Clean | 937 files clean | PASS |
| ESLint | 0 warnings | 0 warnings | PASS |
| TypeScript Typecheck | 0 errors | 0 errors | PASS |
| Production Dependency Audit | 0 advisories | 0 advisories | PASS |
| Unit Test Suite | 100% green | 1,323+ tests passing | PASS |
