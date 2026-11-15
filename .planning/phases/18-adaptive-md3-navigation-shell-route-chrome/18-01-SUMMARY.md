---
phase: 18
plan: "01"
subsystem: web/shell
tags: [md3, navigation-bar, navigation-rail, top-bar, single-h1, accessibility]
requires: []
provides:
  - NavigationBar component (compact mobile bottom nav 80dp)
  - NavigationRail component (medium/expanded desktop left rail 80dp)
  - Responsive AppShell with fluid main container clearing 80dp rail
  - Scroll-aware TopBar tinted on scrollY > 4 with single-h1 hierarchy
affects:
  - Navigation landmarks across all screens
  - Screen title chrome and heading levels
tech-stack:
  added: []
  patterns:
    - Material Design 3 Active Indicator Pill (w-16 h-8 rounded-full bg-secondary-container)
    - Scroll-aware tonal elevation tinting via surface-container
    - Single-h1 document outline with useScreenChrome registration
key-files:
  created:
    - apps/web/src/components/shell/NavigationBar.tsx
    - apps/web/src/components/shell/NavigationRail.tsx
  modified:
    - apps/web/src/components/shell/AppShell.tsx
    - apps/web/src/components/shell/TopBar.tsx
    - apps/web/src/screens/meals/RecipeDetailScreen.tsx
    - apps/web/src/screens/chores/ChoreDetailScreen.tsx
    - apps/web/src/screens/chores/ChoreFormScreen.tsx
    - apps/web/src/components/shell/shell.test.tsx
decisions:
  - Use Material Symbols with filled variants for active destination icons and outlined for inactive
  - Keep mobile Settings icon button in TopBar for <600px and bottom-pinned destination in NavigationRail for >=600px
  - Maintain single-h1 strictly in TopBar while demoting detail/form screen body headings to h2
metrics:
  duration: 18m
  completed_date: "2026-11-14"
status: complete
requirements:
  - NAV-01
  - NAV-02
actuals:
  tokens: 28000
  tasks: 3
  commits: 3
  plan_head_before: "a113416825a7ee3d3a349c260b7b34c0679f96e7"
  plan_head_after: "cbc320d4b2e4886cb8869f5a73d45628696ca34e"
---

# Phase 18 Plan 01: Adaptive MD3 Navigation Shell & Route Chrome Summary

MD3 NavigationBar (<600px) and NavigationRail (>=600px) with Active Indicator Pills, scroll-aware TopBar tinting, and single-h1 document outline.

## Implementation Overview

1. **Adaptive Navigation Shell (Task 1):**
   - Created `NavigationBar.tsx`: fixed bottom 80dp container on compact viewports (`max-[599px]:flex min-[600px]:hidden`) rendering the 5 primary destinations (`dashboard`, `lists`, `meals`, `bills`, `chores`).
   - Created `NavigationRail.tsx`: fixed left 80dp rail on medium/expanded viewports (`hidden min-[600px]:flex`) with the 5 primary destinations grouped at top, an inset divider, and Settings pinned to the bottom.
   - Built MD3 Active Indicator Pill (`w-16 h-8 rounded-full bg-secondary-container text-on-secondary-container`) using outlined Material Symbols when inactive and filled Material Symbols when active, with `label-medium` typography.
   - Updated `AppShell.tsx` to clear 80dp left padding on desktop (`min-[600px]:pl-20`), 80dp bottom padding on mobile (`max-[599px]:pb-20`), with fluid `w-full min-w-0 flex-1` content.
   - Scoped TopBar's Settings button to compact viewports (`max-[599px]:block min-[600px]:hidden`) since NavigationRail provides persistent desktop Settings access.

2. **Scroll-Aware Top Bar & Single-`<h1>` Architecture (Task 2):**
   - Updated `TopBar.tsx` with a passive scroll listener tracking `window.scrollY > 4`. At rest, displays flat `bg-surface`; on scroll, tints to `bg-surface-container` with subtle elevation shadow (`shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]`).
   - Standardized single `<h1>` strictly in `TopBar.tsx`, styled as MD3 `title-large` font.
   - Added circular 40dp back navigation button (`w-10 h-10 rounded-full hover:bg-surface-container-highest`) when `canGoBack` is active.
   - Audited screens and demoted duplicate `<h1>` elements to `<h2>`:
     - `RecipeDetailScreen.tsx`: Registered recipe title with `useScreenChrome` and demoted body heading to `<h2>`.
     - `ChoreDetailScreen.tsx`: Demoted chore title heading to `<h2>`.
     - `ChoreFormScreen.tsx`: Demoted new/edit chore heading to `<h2>`.

3. **Shell Test Synchronization (Task 3):**
   - Updated `apps/web/src/components/shell/shell.test.tsx` to handle dual landmarks (`NavigationBar` + `NavigationRail`).
   - Verified active state indicators (`aria-current="page"` and `bg-secondary-container` indicator pill) on both shells.
   - Verified dual Settings navigation links (TopBar on mobile, NavigationRail on desktop).
   - Verified TopBar single `<h1>` rendering for active route titles.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDOM multiple navigation landmarks in shell tests**
- **Found during:** Task 3
- **Issue:** In JSDOM, CSS media queries do not prevent DOM nodes from rendering, causing `getByRole('navigation', { name: 'Main' })` to throw when both `NavigationBar` and `NavigationRail` are mounted.
- **Fix:** Updated test suite to find all navigation landmarks with `findAllByRole('navigation', { name: 'Main' })` and assert against both navigation bar and rail structures.
- **Files modified:** `apps/web/src/components/shell/shell.test.tsx`
- **Commit:** `cbc320d`

## Threat Flags

None - standard UI layout and navigation chrome changes with zero credential or data mutations.

## Self-Check: PASSED

- All 8 target files verified present on disk.
- All 3 atomic commits verified in git history: `860fa32`, `2a7fc93`, `cbc320d`.
- Vitest tests: 26/26 passed.
- Typecheck: passed without errors.
- ESLint: passed without errors.
