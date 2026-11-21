---
phase: 18-adaptive-md3-navigation-shell-route-chrome
fixed_at: 2026-11-15T04:10:00Z
review_path: .planning/phases/18-adaptive-md3-navigation-shell-route-chrome/18-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-11-15T04:10:00Z  
**Source review:** .planning/phases/18-adaptive-md3-navigation-shell-route-chrome/18-REVIEW.md  
**Iteration:** 1  

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Verification Environment
All verification checks and test suites were executed directly in the main checkout environment (`workflow.use_worktrees: false`). Full workspace typechecks (`pnpm typecheck`) across all 7 projects passed with 0 errors.

## Fixed Issues

### CR-01: Rogue auto-navigation on nested sub-tab routes in `SubTabs.tsx`

**Files modified:** `apps/web/src/components/shell/SubTabs.tsx`  
**Commit:** `dc53fa0`  
**Applied fix:** Guarded tab change navigation in `SubTabs.tsx` with `tabIndex !== activeIndex` so `@material/web` `<md-tabs>` selection initialization events do not trigger rogue navigations on nested sub-tab routes (e.g. `/lists/flyers/:flyerId`). Verified with `flyers.test.tsx` (13/13 passing).

### CR-02: Heading demotions broke isolated screen unit tests across test suites

**Files modified:** `apps/web/src/screens/meals/recipe-detail.test.tsx`, `apps/web/src/screens/chores/chores.test.tsx`, `apps/web/src/screens/meals/household-timezone.test.tsx`  
**Commit:** `d5aceb3`  
**Applied fix:** Updated test queries in isolated screen tests mounting `RecipeDetailScreen` and `ChoreDetailScreen` to assert `{ level: 2 }` with specific heading accessible names, aligning test assertions with the single-`<h1>` document outline owned by `TopBar`. Verified with `recipe-detail.test.tsx` (13/13), `chores.test.tsx` (25/25), and `household-timezone.test.tsx` (5/5).

### CR-03: Stale `/meals/suggestions` sub-tab test cases

**Files modified:** `apps/web/src/components/shell/shell.test.tsx`, `apps/web/src/lib/sections.test.ts`  
**Commit:** `374182b`, `54e3a57`  
**Applied fix:** Updated test assertions in `shell.test.tsx`'s `titleForPath` parameterized table and `sections.test.ts`'s sub-tab enumeration to reflect the removal of `/meals/suggestions` and its consolidation into `/meals/recipes?filter=ready`. Verified with `shell.test.tsx` (24/24) and `sections.test.ts` (13/13).

### WR-01: RecipeLibraryScreen pagination not reset when toggling readiness filter

**Files modified:** `apps/web/src/screens/meals/RecipeLibraryScreen.tsx`, `apps/web/src/screens/meals/recipe-library.test.tsx`  
**Commit:** `636f4cb`  
**Applied fix:** Added `setPage(1)` inside `handleToggleFilter` in `RecipeLibraryScreen.tsx` so toggling "On sale / Ready now" always resets pagination to page 1, preventing empty states when higher pages have 0 matching recipes. Added a regression unit test in `recipe-library.test.tsx` (16/16 passing).

### WR-02: Missing keyboard focus indicator on NavigationBar and NavigationRail (WCAG 2.4.7)

**Files modified:** `apps/web/src/components/shell/NavigationBar.tsx`, `apps/web/src/components/shell/NavigationRail.tsx`  
**Commit:** `0b10fe0`  
**Applied fix:** Added `focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-lg` styling to `NavLink` elements across both navigation shells to ensure visible focus indicators during keyboard navigation per WCAG 2.4.7. Verified in `shell.test.tsx`.

### WR-03: Transparent safe-area header padding causes content bleed-through on iOS

**Files modified:** `apps/web/src/components/shell/AppShell.tsx`  
**Commit:** `fcef0f7`  
**Applied fix:** Added `bg-surface` to `<header className="sticky top-0 z-20 bg-surface pt-[env(safe-area-inset-top)]">` in `AppShell.tsx` so scrolled content does not bleed through the top safe area on notched mobile devices. Verified in `shell.test.tsx`.

### WR-04: Initial scroll state desynchronization in TopBar on mount

**Files modified:** `apps/web/src/components/shell/TopBar.tsx`  
**Commit:** `38ecca1`  
**Applied fix:** Called `onScroll()` immediately on mount within `useEffect` before registering the scroll listener, ensuring `isScrolled` reflects the current `window.scrollY > 4` position upon mounting or page reload. Verified in `shell.test.tsx`.

---

_Fixed: 2026-11-15T04:10:00Z_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 1_
