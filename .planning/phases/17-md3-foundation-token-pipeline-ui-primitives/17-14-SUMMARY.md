---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 14
subsystem: testing
tags: [md3, shadow-dom, vitest, jsdom, rtl, md-queries, meals, planner, recipes]

# Dependency graph
requires:
  - phase: 17-10
    provides: ModalBottomSheet, OverflowMenu, and UI primitive MD3 migrations
  - phase: 17-13
    provides: Chores, Errands, and Deals test synchronization patterns
provides:
  - Synchronized MealPlacementSheet.test.tsx, MealSlotEntry.test.tsx, and meal-components.test.tsx component suites onto md-queries.ts
  - Synchronized household-timezone.test.tsx, planner.test.tsx, recipe-detail.test.tsx, recipe-library.test.tsx, and suggestions.test.tsx screen suites onto md-queries.ts
affects: [17-15]

# Actuals (#2632) & measured commit ledger (#3968)
actuals:
  tokens: 5800
  tasks: 2
  commits: 2
plan_head_before: e72f3c9889751761ef7f6311689ea6d933e14757
plan_head_after: 5c3b25bf3967aa545eb126156bb9fdf0182c61aa

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Meal component tests query MD3 Tabs, OverflowMenu, Buttons, and TextFields via md-queries.ts with zero production component changes"
    - "Meal screen tests query 7-day planner MD3 Tabs strip, recipe form/detail TextFields, ConfirmDialogs, and ListRow selection through md-queries.ts"
    - "Active tab state on <md-primary-tab> validated using toHaveProperty('active', true/false) instead of Radix data-state"
    - "Offline-disabled controls assert toHaveProperty('softDisabled', true) on MD3 Button hosts instead of aria-disabled attribute"
    - "TextField form validation error state asserts error and errorText properties directly on host elements"

key-files:
  created: []
  modified:
    - apps/web/src/components/meals/MealPlacementSheet.test.tsx
    - apps/web/src/components/meals/MealSlotEntry.test.tsx
    - apps/web/src/components/meals/meal-components.test.tsx
    - apps/web/src/screens/meals/household-timezone.test.tsx
    - apps/web/src/screens/meals/planner.test.tsx
    - apps/web/src/screens/meals/recipe-detail.test.tsx
    - apps/web/src/screens/meals/recipe-library.test.tsx
    - apps/web/src/screens/meals/suggestions.test.tsx

key-decisions:
  - "In MealPlacementSheet.test.tsx, queried Recipe and Quick Item tabs using getMdTab and asserted active boolean property rather than getByRole('tab')"
  - "In MealSlotEntry.test.tsx and meal-components.test.tsx, utilized shared openMenu helper from browser.ts and verified disabled states on md-menu-item hosts"
  - "In IngredientEditor (meal-components.test.tsx), validated required field errors via getMdField('Item') error and errorText properties"
  - "In recipe-library.test.tsx, aligned search input, recipe dialog inputs, and blank ingredient validation with findFieldInput and getMdField properties"
  - "In recipe-detail.test.tsx, aligned match corrections, deal search, and offline controls with findMdButton, findFieldInput, and softDisabled property assertions"
  - "In planner.test.tsx and household-timezone.test.tsx, aligned 7-day strip with findMdTab/getMdTab and verified desktop 7-column layout via queryMdTab() null check"

patterns-established:
  - "MD3 Tab components query via getMdTab/findMdTab and assert toHaveProperty('active', true)"
  - "MD3 Button disabledReason sets host softDisabled: true which must be asserted via toHaveProperty('softDisabled', true)"

requirements-completed: [FND-02, FND-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Meal component test suites pass cleanly against MD3 custom element hosts (Tabs, Button, TextField, Select, OverflowMenu) via md-queries.ts"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/components/meals/MealPlacementSheet.test.tsx src/components/meals/MealSlotEntry.test.tsx src/components/meals/meal-components.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Meal screen test suites pass cleanly against MD3 hosts (Tabs, Button, TextField, Select, Dialog) via md-queries.ts"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/screens/meals/household-timezone.test.tsx src/screens/meals/planner.test.tsx src/screens/meals/recipe-detail.test.tsx src/screens/meals/recipe-library.test.tsx src/screens/meals/suggestions.test.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: 40 min
completed: 2026-11-14
status: complete
---

# Phase 17 Plan 14: Meals Component and Screen Test Synchronization Summary

**Synchronized all 8 Meal component and screen test suites (78/78 tests passing across 3 Meal component suites and 5 Meal screen suites) onto `apps/web/src/test/md-queries.ts` Shadow DOM queries with zero production screen modifications.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-11-14T12:58:00Z
- **Completed:** 2026-11-14T13:28:00Z
- **Tasks:** 2 (Task 1 Meal Component Suites + Task 2 Meal Screen Suites)
- **Files modified:** 8 test files
- **Commits:** 2 atomic commits (`1866c6c`, `5c3b25b`)

## Accomplishments

- **Task 1 — Meal Component Suites (`MealPlacementSheet`, `MealSlotEntry`, `meal-components` - 28/28 tests passing):**
  - Migrated `MealSlotEntry.test.tsx` overflow menu interaction to `openMenu` from `browser.ts`, querying `findMdMenuItem` / `queryMdMenuItem` and asserting `toHaveProperty('disabled', true)` and `queryMdButton`.
  - Migrated `MealPlacementSheet.test.tsx` tab queries to `getMdTab('Recipe')` and `getMdTab('Quick Item')`, asserting `toHaveProperty('active', true/false)`; mapped input fields to `findFieldInput` and action buttons to `getMdButton`.
  - Migrated `meal-components.test.tsx` `IngredientEditor` tests to validate form errors directly on `getMdField('Item')` properties (`error: true`, `errorText: 'Enter an ingredient.'`); updated buttons to `getMdButton` and overflow menus to `openMenu` / `findMdMenuItem`.
  - Committed in `1866c6c`: `test(web): sync Meal component suites to md-queries (17-14)`.

- **Task 2 — Meal Screen Suites (`suggestions`, `recipe-library`, `recipe-detail`, `planner`, `household-timezone` - 50/50 tests passing):**
  - `suggestions.test.tsx` (6/6): updated action buttons ("Add a recipe", "Try again") to `getMdButton`.
  - `recipe-library.test.tsx` (13/13): mapped search, recipe title, ingredient, and URL input fields to `findFieldInput` using `fireEvent.input`; updated buttons to `getMdButton` / `findMdButton` / `getAllMdButtons`; validated blank ingredient error on `getMdField('Item')` properties (`error: true`, `errorText: 'Enter an ingredient.'`).
  - `recipe-detail.test.tsx` (13/13): migrated ingredient match corrections and deal search to `getMdButton`, `findMdButton`, `findFieldInput`, and `openMenu`; asserted `softDisabled` on offline action buttons; validated delete confirmation dialog.
  - `planner.test.tsx` (13/13): aligned 7-day day-of-week tab strip to `findMdTab` / `getMdTab`; mapped placed meals and overflow menus to `openMenu` and `findMdMenuItem`; verified desktop grid via `queryMdTab()` null check.
  - `household-timezone.test.tsx` (5/5): migrated active day tab checks to `findMdTab(/Sat 10\/03/)` with `toHaveProperty('active', true)`; verified non-existent browser Sunday tab with `queryMdTab(/Sun 10\/04/)`; mapped planner placement sheet date field to `findFieldInput('Date')`.
  - Committed in `5c3b25b`: `test(web): sync Meal screen suites to md-queries (17-14)`.

## Verification

- `pnpm --filter @hestia/web exec vitest run --project dom src/components/meals/*.test.tsx`: 28 passed (28)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/meals/*.test.tsx`: 50 passed (50)
- `pnpm --filter @hestia/web exec eslint src/components/meals/*.test.tsx src/screens/meals/*.test.tsx`: 0 warnings, 0 errors
- `pnpm -r --parallel typecheck`: All 7 projects clean
- Zero production component or screen code modified
