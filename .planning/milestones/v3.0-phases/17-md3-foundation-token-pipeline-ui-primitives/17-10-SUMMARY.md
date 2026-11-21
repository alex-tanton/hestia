---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 10
subsystem: testing
tags: [md3, shadow-dom, vitest, jsdom, rtl, md-queries, open-menu]

# Dependency graph
requires:
  - phase: 17-03
    provides: apps/web/src/test/md-queries.ts Shadow DOM RTL host queries and ESLint clock fence
  - phase: 17-07
    provides: MdIconButton/MdMenu OverflowMenu, MdDialog ConfirmDialog, and MdCheckbox/MdSwitch primitives
  - phase: 17-08
    provides: Native ModalBottomSheet and single-slot FIFO Snackbar ToastProvider
  - phase: 17-09
    provides: Light-DOM MD3 Card, ListRow, Badge, SegmentedControl, Skeleton, FormMessage, CopyButton
provides:
  - Updated openMenu helper in apps/web/src/test/browser.ts targeting MdIconButton hosts via findMdButton and inner shadow button focus
  - Synchronized shell.test.tsx, dashboard.test.tsx, write-queue.test.tsx, realtime.test.tsx, and about-sign-out.test.tsx suites onto md-queries.ts
affects: [17-11, 17-12, 17-13, 17-14, 17-15]

# Actuals (#2632) & measured commit ledger (#3968)
actuals:
  tokens: 3425
  tasks: 2
  commits: 2
plan_head_before: cadd4e831564bc645db76ec8dbd76da284c369d1
plan_head_after: 89c9c7af08383fcdf45bcacc89101952d779a621

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "openMenu in apps/web/src/test/browser.ts resolves MdIconButton hosts via findMdButton(triggerName) and focuses the inner shadow <button> before dispatching Enter"
    - "Web test assertions on MdCheckbox checked state read host .checked property (toHaveProperty('checked', false)) and MdTextField input typing targets field.shadowRoot.querySelector('input')"

key-files:
  created: []
  modified:
    - apps/web/src/test/browser.ts
    - apps/web/src/components/shell/shell.test.tsx
    - apps/web/src/components/dashboard/dashboard.test.tsx
    - apps/web/src/lib/offline/write-queue.test.tsx
    - apps/web/src/lib/realtime/realtime.test.tsx
    - apps/web/src/screens/settings/about-sign-out.test.tsx

key-decisions:
  - "Resolved openMenu triggers via findMdButton and focused the inner shadow <button> for custom elements (falling back to host focus for native buttons) so Wave 11 screen tests open OverflowMenu reliably in jsdom"

patterns-established:
  - "Shared browser.ts openMenu accepts TextMatcher and awaits inner shadow button readiness before keyboard activation"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "browser.ts openMenu locates <md-icon-button> trigger hosts via md-queries.ts findMdButton without altering stubCoarsePointer or the ESLint clock fence"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web typecheck && pnpm lint && apps/web/src/test/browser.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "shell, dashboard, write-queue, realtime, and about-sign-out Vitest dom suites pass using md-queries.ts helpers without fake host ARIA roles"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/components/shell/shell.test.tsx src/components/dashboard/dashboard.test.tsx src/lib/offline/write-queue.test.tsx src/lib/realtime/realtime.test.tsx src/screens/settings/about-sign-out.test.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: 19 min
completed: 2026-11-12
status: complete
---

# Phase 17 Plan 10: Shared Test Helper & Core Suite MD3 Sync Summary

**Updated `browser.ts` `openMenu` onto `md-queries.ts` `findMdButton` with inner shadow button focus, and synchronized all 5 core infrastructure test suites (62/62 tests passing) onto MD3 Shadow DOM host queries with zero fake ARIA roles.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-11-12T15:12:45Z
- **Completed:** 2026-11-12T15:31:43Z
- **Tasks:** 2 (Task 1 tracer + Task 2)
- **Files modified:** 6
- **Measured diff tokens (`chars/4`):** 3,425

## Accomplishments

- **Task 1 (tracer) — `browser.ts`, `shell.test.tsx`, and `dashboard.test.tsx`:**
  - Updated `openMenu` in `apps/web/src/test/browser.ts` to accept `TextMatcher`, locate the trigger via `findMdButton(triggerName)`, await and focus the inner shadow `<button>` when the host is a custom element, and press `{Enter}` while preserving `stubCoarsePointer()` and the ESLint clock fence.
  - Updated `UpdateAvailable` button queries (`Reload`, `Dismiss update notice`) in `apps/web/src/components/shell/shell.test.tsx` to `getMdButton` / `findMdButton`, leaving all `SegmentedControl` and `ModalBottomSheet` assertions intact (`26/26` tests pass).
  - Updated `DashboardCard` error retry query (`Try again`) in `apps/web/src/components/dashboard/dashboard.test.tsx` to `getMdButton('Try again', { container: card('Bills') })` (`13/13` tests pass).
- **Task 2 — `write-queue.test.tsx`, `realtime.test.tsx`, and `about-sign-out.test.tsx`:**
  - Synchronized `apps/web/src/lib/offline/write-queue.test.tsx` onto `getMdCheckbox`, `getMdButton`, and `findMdField` (typing `'Milk'` into the inner shadow `<input>` and asserting `toHaveProperty('checked', false)` on rollback), passing `15/15` tests.
  - Synchronized `apps/web/src/lib/realtime/realtime.test.tsx` onto `findMdCheckbox`, `getMdCheckbox`, and `queryMdCheckbox`, passing `6/6` tests.
  - Synchronized `apps/web/src/screens/settings/about-sign-out.test.tsx` onto `getMdButton('Sign out')`, passing `2/2` tests.
- **Verification:**
  - Targeted Vitest `dom` run across all 5 files: **5 files, 62 tests passed** (`dashboard.test.tsx`: 13, `about-sign-out.test.tsx`: 2, `shell.test.tsx`: 26, `realtime.test.tsx`: 6, `write-queue.test.tsx`: 15).
  - `pnpm --filter @hestia/web typecheck` and pre-commit `pnpm -r --parallel typecheck`: **passed**.
  - `pnpm lint` (`eslint --max-warnings=0 .`): **passed** with 0 errors and 0 warnings.
  - `pnpm prettier --check` on all 6 modified files: **passed**.
  - `pnpm jscpd`: **passed** (`Total: 1.34%` duplicated lines, within `.jscpd.json` thresholds).

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): browser.ts openMenu, shell.test.tsx, dashboard.test.tsx** - `51b4059` (`test(web): update openMenu and sync shell/dashboard tests (17-10)`)
2. **Task 2: write-queue.test.tsx, realtime.test.tsx, about-sign-out.test.tsx** - `89c9c7a` (`test(web): sync write-queue, realtime, and about tests (17-10)`)

## Files Created/Modified

- `apps/web/src/test/browser.ts` - Updated `openMenu` to resolve trigger via `findMdButton` and focus inner shadow `<button>` before `{Enter}`.
- `apps/web/src/components/shell/shell.test.tsx` - Aligned `UpdateAvailable` button queries with `getMdButton` / `findMdButton`.
- `apps/web/src/components/dashboard/dashboard.test.tsx` - Aligned `DashboardCard` retry button query with `getMdButton(..., { container })`.
- `apps/web/src/lib/offline/write-queue.test.tsx` - Aligned item checkboxes, sheet field typing, and add buttons with `md-queries.ts` and shadow DOM contracts.
- `apps/web/src/lib/realtime/realtime.test.tsx` - Aligned item checkbox queries (`findMdCheckbox`, `getMdCheckbox`, `queryMdCheckbox`).
- `apps/web/src/screens/settings/about-sign-out.test.tsx` - Aligned `Sign out` button query with `getMdButton`.

## Decisions Made

- Resolved `openMenu` triggers via `findMdButton` and focused the inner shadow `<button>` for custom elements (with host fallback for native buttons) so downstream Wave 11 screen tests open `OverflowMenu` cleanly in `jsdom`.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- `requirements.ready-ids` reported `ready: []` and `blocked: ["FND-02", "FND-04"]` because sibling Wave 11–15 plans (`17-11`–`17-15`) still declare `FND-02` / `FND-04` and do not yet have summaries; `REQUIREMENTS.md` was left unchanged per the shared-ID gate (`#2388`).
- Pre-existing unstaged formatting diff in `apps/web/src/components/ui/Toast.test.tsx` and orchestrator-owned `.planning/milestone.lock` were left untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Shared `apps/web/src/test/browser.ts` `openMenu` and core infrastructure test suites are verified on MD3 primitives, unblocking Wave 11 screen/feature test-sync plans (`17-11`–`17-14`).

## Self-Check: PASSED

- Verified all 6 modified files and `17-10-SUMMARY.md` exist on disk.
- Verified Task 1 (`51b4059`) and Task 2 (`89c9c7a`) commits exist as ancestors of `HEAD` with zero file deletions.
- Verified all 5 Vitest `dom` suites (62/62 tests), `typecheck`, `pnpm lint`, Prettier on all 6 modified files, and `pnpm jscpd` passed after the final edit.

