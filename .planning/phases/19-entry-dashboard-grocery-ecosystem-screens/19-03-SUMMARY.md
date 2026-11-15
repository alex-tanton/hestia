---
phase: 19-entry-dashboard-grocery-ecosystem-screens
plan: 03
subsystem: web
tags:
  - grocery
  - shopping-lists
  - md3
  - pantry
  - material-web
requires:
  - 19-01
  - 19-02
provides:
  - list-store-group-headers
  - list-borderless-rows
  - item-sheet-store-chips
  - sync-to-pantry-sheet
  - pantry-inventory-location-chips
affects:
  - apps/web
tech-stack:
  added:
    - "@material/web/fab/fab.js (MdFab wrapper)"
  patterns:
    - "StoreGroupHeader sticky tonal surfaceContainer grouping"
    - "Collapsible Bought (N) section with persistent undo toast"
    - "SyncToPantrySheet ModalBottomSheet for batch inventory addition"
    - "ItemSheet horizontal MdFilterChip single-tap merchant assignment"
    - "PantryScreen storage location chip filtering and expiry urgency badges"
key-files:
  created:
    - apps/web/src/components/lists/SyncToPantrySheet.tsx
    - apps/web/src/components/md/MdFab.tsx
  modified:
    - apps/web/src/components/lists/ShoppingListRow.tsx
    - apps/web/src/components/lists/StoreGroupHeader.tsx
    - apps/web/src/components/lists/ItemSheet.tsx
    - apps/web/src/screens/lists/ListNameSheet.tsx
    - apps/web/src/screens/lists/ListDetailScreen.tsx
    - apps/web/src/screens/lists/ListsIndexScreen.tsx
    - apps/web/src/screens/lists/PantryScreen.tsx
    - apps/web/src/screens/lists/ListDetailScreen.test.tsx
    - apps/web/src/screens/lists/lists.test.tsx
    - apps/web/src/test/md-queries.ts
decisions:
  - "Migrated ListNameSheet from bottom sheet to MdDialog basic prompt with proper form submission handling"
  - "Created MdFab wrapper around @material/web/fab/fab.js for floating action buttons"
  - "Added persistent undo snackbar on grocery item checkoff with immediate optimistic state update"
  - "Implemented SyncToPantrySheet with prefilled storage locations and estimated shelf life"
  - "Organized PantryScreen with storage location chips (All, Fridge, Freezer, Pantry) and expiry status badges"
metrics:
  duration: 18m
  completed_date: "2026-11-15"
status: complete
actuals:
  tokens: 16913
  tasks: 3
  commits: 3
  plan_head_before: "60f1aaf8141b3ae200b3a722f67066bc6295c085"
  plan_head_after: "0fc3d83c912a9a747277b08e55d11aa5384a5e5d"
---

# Phase 19 Plan 03: Lists, ItemSheet & Pantry Summary

Overhauled lists, ItemSheet, and pantry inventory screens to MD3 design standards with borderless list rows, tonal sticky store group headers, quick-add input with Enter key commit, bottom-right MdFab, collapsible Bought section with persistent Undo snackbars, SyncToPantrySheet, and Pantry location filtering.

## What Was Built

### 1. List Row Primitives & Store Group Headers (Task 1)
- **`ShoppingListRow.tsx`**: Updated to borderless row layout with `min-h-[48px]`, `Checkbox` (`variant="in-list"`), Material Symbols `delete` / `more_vert` icons, strike-through transition on bought items, and repriced / conditional price badges.
- **`StoreGroupHeader.tsx`**: Implemented sticky tonal `surfaceContainer` header with store name title, item count pill badge, formatted currency subtotal, and expand/collapse chevron button.
- **`ListNameSheet.tsx`**: Replaced sheet with `MdDialog` basic prompt dialog featuring primary Save/Create and ghost Cancel buttons, supporting Escape and auto-focus.

### 2. Quick-Add, Collapsible Bought & SyncToPantrySheet (Task 2)
- **`MdFab.tsx`**: Created MD3 Floating Action Button web-component wrapper using `@material/web/fab/fab.js`.
- **`ListDetailScreen.tsx`**: Added top quick-add input with Enter key submission for rapid grocery entry, bottom-right floating `MdFab` for detailed ItemSheet creation, collapsible `Bought (N)` section with smooth strikethrough and item count badge, persistent Undo snackbar on checkoff, and overflow menu integration.
- **`SyncToPantrySheet.tsx`**: Implemented `ModalBottomSheet` displaying bought items eligible for pantry transfer, pre-filled storage location chips (`Fridge`, `Freezer`, `Pantry`), shelf-life expiry days estimates, and batch `useAddBoughtToPantry` mutation dispatch.

### 3. ItemSheet Store Chips, ListsIndexScreen FAB & PantryScreen Inventory (Task 3)
- **`ItemSheet.tsx`**: Converted to `ModalBottomSheet` with a horizontal tonal chip strip of stores (`MdFilterChip`) for single-tap merchant assignment, category selector, quantity, unit, and price input fields.
- **`ListsIndexScreen.tsx`**: Borderless rich list items with progress badges (`N items`), bottom-right floating `MdFab` for creating lists, and Material Symbols icons.
- **`PantryScreen.tsx`**: Added horizontal storage location filter chips (`All`, `Fridge`, `Freezer`, `Pantry`), item search bar, borderless inventory rows, and tonal urgency badges (`danger` for expired items, `warning` for items expiring soon).

## Key Commits

| Commit | Type | Description | Key Files |
| --- | --- | --- | --- |
| `0ac8de4` | feat | list row primitives, store group headers, and ListNameSheet md-dialog | `ShoppingListRow.tsx`, `StoreGroupHeader.tsx`, `ListNameSheet.tsx`, `lists.test.tsx` |
| `0479610` | feat | quick-add, collapsible bought section, and SyncToPantrySheet | `MdFab.tsx`, `SyncToPantrySheet.tsx`, `ListDetailScreen.tsx`, `ListDetailScreen.test.tsx`, `md-queries.ts` |
| `0fc3d83` | feat | update ItemSheet, lists index, and pantry screens | `ItemSheet.tsx`, `ListsIndexScreen.tsx`, `PantryScreen.tsx` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate toggle call in ShoppingListRow**
- **Found during:** Task 1
- **Issue:** `ShoppingListRow` bound `onToggleBought` to both `onCheckedChange` and `onChange`, firing double mutations per toggle.
- **Fix:** Retained only `onCheckedChange`.
- **Files modified:** `apps/web/src/components/lists/ShoppingListRow.tsx`
- **Commit:** `0ac8de4`

**2. [Rule 1 - Bug] MdDialog Lit wrapper form property error**
- **Found during:** Task 1
- **Issue:** `@lit/react` wrapper threw `Cannot set property form of [object HTMLElement] which has only a getter` when passing `form="list-name-form"` prop to `Button`.
- **Fix:** Handled form submission via standard form submit event and direct button `onClick`.
- **Files modified:** `apps/web/src/screens/lists/ListNameSheet.tsx`
- **Commit:** `0ac8de4`

**3. [Rule 2 - Critical Functionality] Added MdFab component wrapper**
- **Found during:** Task 2
- **Issue:** Plan specified floating FAB for ListDetailScreen and ListsIndexScreen but `@material/web/fab/fab.js` had no React wrapper in `src/components/md/`.
- **Fix:** Created `apps/web/src/components/md/MdFab.tsx` with `@lit/react` and updated `md-queries.ts` test selectors.
- **Files modified:** `apps/web/src/components/md/MdFab.tsx`, `apps/web/src/test/md-queries.ts`
- **Commit:** `0479610`

**4. [Rule 3 - Blocking Issue] Accessibility form label association in ItemSheet**
- **Found during:** Task 3
- **Issue:** ESLint rule `jsx-a11y/label-has-associated-control` failed on store chip container label.
- **Fix:** Changed label to `span` with `id="item-sheet-store-label"` and set `role="group"` + `aria-labelledby` on the container.
- **Files modified:** `apps/web/src/components/lists/ItemSheet.tsx`
- **Commit:** `0fc3d83`

## Self-Check: PASSED

1. **Created/Modified files exist:**
   - `apps/web/src/components/lists/ShoppingListRow.tsx`: FOUND
   - `apps/web/src/components/lists/StoreGroupHeader.tsx`: FOUND
   - `apps/web/src/screens/lists/ListNameSheet.tsx`: FOUND
   - `apps/web/src/components/lists/ItemSheet.tsx`: FOUND
   - `apps/web/src/components/lists/SyncToPantrySheet.tsx`: FOUND
   - `apps/web/src/screens/lists/ListDetailScreen.tsx`: FOUND
   - `apps/web/src/screens/lists/ListsIndexScreen.tsx`: FOUND
   - `apps/web/src/screens/lists/PantryScreen.tsx`: FOUND
   - `apps/web/src/components/md/MdFab.tsx`: FOUND

2. **Commits exist in branch history:**
   - `0ac8de4`: FOUND
   - `0479610`: FOUND
   - `0fc3d83`: FOUND

3. **Test verification:**
   - `vitest run --project dom src/screens/lists/lists.test.tsx src/screens/lists/ListDetailScreen.test.tsx`: 40/40 tests passing.
   - `tsc --noEmit` typecheck: clean across all packages.
