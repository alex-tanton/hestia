---
phase: 18
plan: "02"
subsystem: web/shell
tags: [md3, sub-tabs, primary-tabs, modal-bottom-sheet, household-switcher, cleanup]
requires:
  - "18-01"
provides:
  - SubTabs component using MD3 Primary Tabs (<md-tabs> / <md-primary-tab>) with scroll reset
  - HouseholdSwitcher using ModalBottomSheet with single-membership copy and loading skeleton
  - Cleaned codebase with SectionProvider, SubSectionComingSoon, and TabBar fully deleted
affects:
  - Pillar sub-tab navigation
  - Household switcher bottom sheet
  - App shell and section context dependencies
tech-stack:
  added: []
  patterns:
    - Material Design 3 Primary Tabs (<md-tabs> / <md-primary-tab>) with animated indicator
    - ModalBottomSheet for household switching with single-membership guidance
    - window.scrollTo(0, 0) scroll-to-top on section navigation
key-files:
  created: []
  modified:
    - apps/web/src/components/shell/SubTabs.tsx
    - apps/web/src/components/shell/HouseholdSwitcher.tsx
    - apps/web/src/components/ui/ModalBottomSheet.tsx
    - apps/web/src/pillars/lists/ListsRoute.tsx
    - apps/web/src/lib/sections.ts
    - apps/web/src/components/shell/shell.test.tsx
    - scripts/knip-production-baseline.txt
  deleted:
    - apps/web/src/lib/section-context.tsx
    - apps/web/src/components/states/SubSectionComingSoon.tsx
    - apps/web/src/components/shell/TabBar.tsx
decisions:
  - Migrate SubTabs to MD3 Primary Tabs with explicit ARIA roles (role="tablist" / role="tab") and aria-selected for robust accessibility and testing support
  - Reset scroll position with window.scrollTo(0, 0) when switching pillar sub-tabs
  - Replace custom Popover/dialog in HouseholdSwitcher with ModalBottomSheet, adding single-household guidance copy ("No other households") and fixed 112x20px skeleton pill
  - Completely purge SectionProvider and SubSectionComingSoon from the codebase to eliminate legacy section context
metrics:
  duration: 35m
  completed_date: "2026-11-15"
status: complete
requirements:
  - NAV-03
actuals:
  tokens: 10272
  tasks: 3
  commits: 3
  plan_head_before: "743224da664836a56a358d87e413a3e564c42f28"
  plan_head_after: "9f5882c3f701ac56ee610f5dbe4a95ec2d08043d"
---

# Phase 18 Plan 02: MD3 Primary Tabs, Household Switcher Bottom Sheet, and Section Cleanup Summary

Migrated SubTabs to MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`) with `window.scrollTo(0, 0)` reset, upgraded HouseholdSwitcher to `ModalBottomSheet` with single-membership guidance and loading skeleton, and atomically pruned legacy `SectionProvider` and `SubSectionComingSoon`.

## Implementation Overview

1. **MD3 Primary Tabs & Household Switcher (Task 1):**
   - Refactored `apps/web/src/components/shell/SubTabs.tsx` to use Material Web's `<md-tabs>` and `<md-primary-tab>`, providing the animated active indicator line and scroll reset via `window.scrollTo(0, 0)` on sub-tab navigation.
   - Refactored `apps/web/src/components/shell/HouseholdSwitcher.tsx` to open a unified `ModalBottomSheet` titled "Households".
   - Added single-membership guidance copy (`No other households`) below the active membership when `households.length === 1`.
   - Replaced text-based loading fallback with an accessible `112px x 20px` skeleton pill (`role="status" aria-label="Loading households"`) matching TopBar typography to prevent layout shift.
   - Added `.no-scrollbar` utility to `apps/web/src/styles/gap-primitives.css` for clean horizontal tab overflow.

2. **Atomic Section Cleanup & Dead Route Pruning (Task 2):**
   - Decoupled `ModalBottomSheet.tsx` from `section-context.tsx`.
   - Purged `SectionProvider` and `useSection()` from all dialogs, menus, cards, onboarding steps, and test harnesses.
   - Pruned dead `deals` and `flyers` placeholder routes from `apps/web/src/pillars/lists/ListsRoute.tsx`.
   - Removed `comingSoon` properties from `Pillar` definitions in `apps/web/src/lib/sections.ts`.
   - Deleted obsolete files: `apps/web/src/lib/section-context.tsx`, `apps/web/src/components/states/SubSectionComingSoon.tsx`, and `apps/web/src/components/shell/TabBar.tsx`.
   - Reconciled `scripts/knip-production-baseline.txt` (27 rows cleanly matched).

3. **Shell Test Suite Synchronization (Task 3):**
   - Updated `apps/web/src/components/shell/shell.test.tsx` to assert MD3 tabs under `role="navigation"` with `role="tablist"` and `role="tab"`.
   - Verified active tab selection and `aria-selected="true"` mapping for deep pillar routes.
   - Verified scroll reset to `(0, 0)` and route navigation on sub-tab switch.
   - Verified single-membership helper text (`No other households`) and "Join or create a household" action.
   - All 24 tests passed under Vitest DOM project, monorepo typecheck passed with 0 errors, and ESLint passed with 0 warnings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Explicit ARIA roles on MD3 tabs for testing and accessibility**
- **Found during:** Task 3
- **Issue:** Lit/Material Web sets `this.internals.role = 'tablist'` and `this.internals.role = 'tab'` via `ElementInternals`, which JSDOM's accessibility queries do not automatically reflect as DOM element roles.
- **Fix:** Added explicit `role="tablist"` on `<MdTabs>`, `role="tab"` on `<MdPrimaryTab>`, and explicit `aria-selected={isSelected ? 'true' : 'false'}` string attributes.
- **Files modified:** `apps/web/src/components/shell/SubTabs.tsx`
- **Commit:** `9f5882c`

**2. [Rule 3 - Blocking Issue] Purging SectionProvider and TabBar across monorepo**
- **Found during:** Task 2
- **Issue:** Deleting `section-context.tsx` and updating Knip baseline required removing references from components (`ConfirmDialog`, `OverflowMenu`, `DashboardCard`, `DashboardFirstRun`, `FavoriteStoresStep`, `OnboardingLayout`, `HouseholdSettingsSection`) and deleting unused `TabBar.tsx` to match the exact Knip baseline count (27 items).
- **Fix:** Removed all dangling `SectionProvider` and `TabBar` references across components and test harnesses.
- **Files modified:** multiple components, deleted `TabBar.tsx`
- **Commit:** `9874ea6`

## Threat Flags

None - standard UI layout, sheet transitions, and code cleanup with no new data queries or privilege boundaries.

## Self-Check: PASSED

- All key files verified on disk (created/modified/deleted).
- All 3 atomic commits verified in git history: `f0b7f54`, `9874ea6`, `9f5882c`.
- Vitest tests: 24/24 passed in `src/components/shell/shell.test.tsx`.
- Typecheck: passed without errors (`tsc --noEmit`).
- ESLint: passed with 0 warnings.
