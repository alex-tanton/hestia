---
phase: 19-entry-dashboard-grocery-ecosystem-screens
plan: 05
subsystem: deals
tags:
  - deals
  - flyers
  - md3
  - modal-bottom-sheet
  - segmented-control
  - search-bar
  - card-grid
requires:
  - DEAL-06
  - DEAL-07
provides:
  - DEAL-06
  - DEAL-07
affects:
  - apps/web/src/screens/deals/DealCard.tsx
  - apps/web/src/screens/deals/AddToListSheet.tsx
  - apps/web/src/screens/deals/DealSearchScreen.tsx
  - apps/web/src/screens/deals/DealFreshness.tsx
  - apps/web/src/screens/deals/FlyersScreen.tsx
  - apps/web/src/screens/deals/FlyerItemsScreen.tsx
tech-stack:
  - added: []
  - patterns:
      - Compact mobile horizontal card layout with 72x72 photo and + Add button
      - Screen-level lifted AddToListSheet with smart 1-list addition
      - Single-slot persistent Undo snackbar queue
      - MD3 Search Bar, SegmentedControl, and quick filter chips
      - FilterModalBottomSheet for advanced filtering
      - 2-4 column elevated MD3 card grid with aspect-[4/3] cover preview
key-files:
  - created:
      - apps/web/src/screens/deals/AddToListSheet.tsx
  - modified:
      - apps/web/src/lib/api/deals.ts
      - apps/web/src/screens/deals/DealCard.tsx
      - apps/web/src/screens/deals/DealFreshness.tsx
      - apps/web/src/screens/deals/DealResults.tsx
      - apps/web/src/screens/deals/DealSearchScreen.tsx
      - apps/web/src/screens/deals/FlyersScreen.tsx
      - apps/web/src/screens/deals/FlyerItemsScreen.tsx
      - apps/web/src/screens/deals/deal-card.test.tsx
      - apps/web/src/screens/deals/deal-search.test.tsx
      - apps/web/src/screens/deals/flyers.test.tsx
decisions:
  - Formatted DealCard on mobile (<600px) as single-column horizontal card with 72x72 photo, bold price, tonal discount badge, and circular + Add button
  - Lifted shared AddToListSheet to screen level, eliminating per-card Sheet instances
  - Implemented smart addition flow where 1 active list commits immediately with persistent Undo toast, while 0 or >1 lists opens AddToListSheet
  - Added MD3 Search Bar, SegmentedControl, quick filter chips, and FilterModalBottomSheet to DealSearchScreen
  - Rendered DealFreshness banner as a compact tonal surfaceContainerLow banner with Material Symbols schedule and refresh icons
  - Presented store flyers in a 2-4 column elevated MD3 card grid with cover previews and item count badges
  - Synchronized FlyerItemsScreen with Top App Bar and integrated the lifted AddToListSheet
metrics:
  duration: 20m
  completed_date: "2026-11-15"
status: complete
actuals:
  tokens: 8250
  tasks: 3
  commits: 3
plan_head_before: 3f03e01
plan_head_after: cb643e7
---

# Phase 19 Plan 05: Deals, Lifted AddToListSheet & Flyers Summary

Overhauled circular deals browsing, compact deal cards, lifted sheet addition, and weekly store flyers onto Material Design 3 surfaces. Delivered a compact horizontal DealCard for mobile, lifted the AddToListSheet to the screen level with smart 1-list addition and persistent Undo snackbars, modernized DealSearchScreen with MD3 search controls and filter sheet, and presented weekly store flyers in a 2–4 column elevated card grid.

## Key Changes Implemented

### 1. Compact Mobile DealCard & Reusable AddToListSheet
- **DealCard (`DealCard.tsx`):**
  - Restructured to a compact horizontal layout with a `72x72` thumbnail (`DealImage`) on the left, title/store/validity in the middle, and bold unit price (`text-title-md font-semibold text-primary tabular-nums`), single tonal discount badge (`-{deal.discountPercent}%`), and circular + Add button on the right.
  - Eliminated per-card sheet mounting; card now emits an `onAdd(deal)` callback.
- **AddToListSheet (`AddToListSheet.tsx`):**
  - Reusable `ModalBottomSheet` instance handling active list selection, quantity decrement/increment buttons, and list row selection.
  - Tapping a list adds the deal, closes the sheet, and dispatches a persistent Undo snackbar (`Added '{deal.name}' to {list.name} · [Undo]`).

### 2. Modernized DealSearchScreen
- **MD3 Search Bar & SegmentedControl:**
  - Integrated top search input with search icon alongside SegmentedControl toggling between "Favorite stores" and "All stores".
- **Filter Chips & FilterModalBottomSheet:**
  - Added horizontal scrollable strip with `MdFilterChip`s for quick category filters and "All filters (N)" opening `FilterModalBottomSheet`.
  - Filter modal encapsulates store, category, and price range inputs with "Apply filters" and "Clear deal filters" actions.
- **DealFreshness Banner:**
  - Restyled as a compact tonal `surfaceContainerLow` card with Material Symbols Rounded icons (`schedule` and `refresh`).
- **Smart 1-List Addition:**
  - When exactly 1 active list exists in household, deal addition commits immediately without opening sheet and presents an Undo snackbar. When multiple or 0 lists exist, opens the lifted `AddToListSheet`.

### 3. Elevated Flyers Grid & FlyerItemsScreen
- **FlyersScreen (`FlyersScreen.tsx`):**
  - Replaced Lucide `Newspaper` icon with `Icon name="newspaper"`.
  - Presented flyers in a 2-4 column elevated card grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`).
  - Cards feature `aspect-[4/3]` cover preview (`DealImage`), store title, validity dates, and neutral item count badge (`{count} items`).
- **FlyerItemsScreen (`FlyerItemsScreen.tsx`):**
  - Synchronized with Top App Bar via `useScreenChrome` for back navigation to `/lists/flyers`.
  - Rendered deals using compact `DealCard`s and shared the lifted `AddToListSheet` smart addition flow.

## Verification Results

### Automated Test Suites
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/deals/deal-card.test.tsx` (23 tests passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/deals/deal-search.test.tsx` (15 tests passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/deals/flyers.test.tsx` (15 tests passed)
- Full deals test suite passed: 53 tests passed across all 3 suites.
- `pnpm typecheck` passed across all 7 workspace projects with 0 errors.

## Self-Check: PASSED

1. Created files exist:
   - `apps/web/src/screens/deals/AddToListSheet.tsx`: FOUND
2. Commits exist in history:
   - `78704c2`: FOUND (feat(web): compact mobile DealCard and lifted shared AddToListSheet)
   - `fa32aae`: FOUND (feat(web): overhaul deal search with MD3 controls and filters)
   - `cb643e7`: FOUND (feat(web): elevated flyers grid and lifted AddToListSheet)
