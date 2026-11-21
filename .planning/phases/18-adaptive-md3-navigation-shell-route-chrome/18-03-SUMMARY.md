---
phase: 18
plan: "03"
subsystem: web/meals
tags: [md3, filter-chip, meals, recipe-library, route-consolidation, dead-code-pruning]
requires:
  - "18-02"
provides:
  - MdFilterChip wrapper for Material Web filter chip
  - Consolidated Meals routing (2 sub-tabs: Planner | Recipes)
  - /meals/suggestions redirect to /meals/recipes?filter=ready with replace: true
  - "On sale / Ready now" readiness filter chip on RecipeLibraryScreen
  - SurfaceContainerLow empty state card on RecipeLibraryScreen for zero readiness matches
affects:
  - Meals navigation sub-tabs
  - Recipe library filtering and routing
tech-stack:
  added: []
  patterns:
    - Lit React createComponent wrapper for @material/web/chips/filter-chip.js
    - URL search param (?filter=ready) synchronized readiness filter
    - SurfaceContainerLow empty state card with CTA button
key-files:
  created:
    - apps/web/src/components/md/MdFilterChip.tsx
  modified:
    - apps/web/src/components/meals/meal-copy.ts
    - apps/web/src/lib/sections.ts
    - apps/web/src/pillars/meals/MealsRoute.tsx
    - apps/web/src/screens/meals/RecipeLibraryScreen.tsx
    - apps/web/src/screens/meals/recipe-library.test.tsx
  deleted:
    - apps/web/src/screens/meals/SuggestionsScreen.tsx
    - apps/web/src/screens/meals/suggestions.test.tsx
decisions:
  - Consolidate Meals sub-tabs from 3 to 2 (Planner | Recipes) and redirect /meals/suggestions to /meals/recipes?filter=ready with replace: true (D-16, D-17)
  - Use child text content for MdFilterChip label to adhere to @material/web deprecation of the label property and ESLint rules
  - Render a surfaceContainerLow Card empty state with 'No matching recipes' and 'Clear recipe filter' button when zero recipes match pantry or deal criteria
  - Delete orphaned SuggestionsScreen and suggestions copy to preserve the 27-row Knip baseline
metrics:
  duration: 25m
  completed_date: "2026-11-15"
status: complete
requirements:
  - NAV-04
actuals:
  tokens: 19500
  tasks: 2
  commits: 2
  plan_head_before: "cb87d23d8c1be1ff67be16a5b2fc4561a0eb1b25"
  plan_head_after: "524046fa4360e57201b17b6a1e35fa14ea8ecae8"
---

# Phase 18 Plan 03: Meals Sub-Tab Consolidation & Recipe Readiness Filter Chip Summary

Consolidated Meals routing from 3 sub-tabs to 2 (`Planner | Recipes`), redirected `/meals/suggestions` to `/meals/recipes?filter=ready`, wrapped `@material/web/chips/filter-chip.js` as `MdFilterChip`, integrated the "On sale / Ready now" readiness filter chip and empty state card into `RecipeLibraryScreen`, and removed orphaned `SuggestionsScreen` files and unused copy to preserve Knip baseline hygiene.

## Implementation Overview

1. **MdFilterChip Component (Task 1):**
   - Created `apps/web/src/components/md/MdFilterChip.tsx` wrapping `@material/web/chips/filter-chip.js` via `@lit/react`'s `createComponent`.
   - Mapped `onChange` and `onInput` custom events to standard React handler signatures.
   - Enforced subpath imports ensuring zero bundle regression against the 200 KB shell budget.

2. **Meals Route Consolidation & Recipe Readiness Filter (Task 2):**
   - Updated `apps/web/src/lib/sections.ts` to reduce `MEALS.subTabs` to 2 items: `Planner` (`/meals`) and `Recipes` (`/meals/recipes`) per D-16.
   - Updated `apps/web/src/pillars/meals/MealsRoute.tsx` to remove `SuggestionsScreen` route and replace `/meals/suggestions` with `<Navigate to="/meals/recipes?filter=ready" replace />` per D-16 and D-17.
   - Deleted obsolete production screens `SuggestionsScreen.tsx` and `suggestions.test.tsx`.
   - Cleaned up unused `SUGGESTIONS_EMPTY_COPY` and `SUGGESTIONS_NO_DEALS_COPY` in `apps/web/src/components/meals/meal-copy.ts`.
   - Updated `RecipeLibraryScreen.tsx`:
     - Synchronized `filterReady` boolean with URL search param `?filter=ready` using `useSearchParams`.
     - Added `<MdFilterChip selected={filterReady} onClick={handleToggleFilter}>On sale / Ready now</MdFilterChip>` in the filter toolbar.
     - Filtered recipes when active to those with `inPantryCount > 0` or `onSaleCount > 0`.
     - Rendered a `surfaceContainerLow` Card empty state displaying heading `No matching recipes`, helper text, and secondary `Clear recipe filter` button when 0 recipes match the readiness criteria.
   - Updated `recipe-library.test.tsx`:
     - Added unit tests for toggling the filter chip and verifying recipes without pantry/sale ingredients are filtered out.
     - Added unit test for empty state rendering and clearing the filter via the CTA button.
     - Verified all 15 tests pass cleanly in Vitest DOM project.
   - Reconciled Knip baseline verification (`node scripts/check-knip-baseline.mjs` exits 0 with 27 rows matching).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Passed child text to MdFilterChip instead of deprecated label prop**
- **Found during:** Task 2 (ESLint verification)
- **Issue:** `@material/web/chips/filter-chip.js` deprecates `label: string` property in favor of slotted text content, causing `@typescript-eslint/no-deprecated` to fail.
- **Fix:** Switched `<MdFilterChip label="On sale / Ready now">` to `<MdFilterChip>On sale / Ready now</MdFilterChip>`.
- **Files modified:** `apps/web/src/screens/meals/RecipeLibraryScreen.tsx`
- **Commit:** `524046f`

**2. [Rule 1 - Bug] Commit subject character length limit**
- **Found during:** Task 2 (commit-msg hook)
- **Issue:** Initial commit subject exceeded commitlint 71-character limit.
- **Fix:** Adjusted subject to `refactor(web): consolidate meals routing and add recipe filter chip` (52 chars).
- **Files modified:** git commit message
- **Commit:** `524046f`

## Threat Flags

None - standard UI layout, route redirects, and filter query parameters with zero credential or data mutations.

## Self-Check: PASSED

- All 6 target files verified present on disk (and 2 obsolete files verified deleted).
- Both atomic commits verified in git history: `83d3e6b`, `524046f`.
- Vitest tests: 15/15 passed (`recipe-library.test.tsx`).
- Typecheck: passed without errors.
- ESLint: passed without errors.
- Knip baseline: passed (27 rows matched).
- Production build: passed (app shell 165.4 KB gzipped within 200 KB budget).
