---
phase: 19-entry-dashboard-grocery-ecosystem-screens
fixed_at: 2026-11-15T12:12:00Z
review_path: .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-11-15T12:12:00Z  
**Source review:** .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-REVIEW.md  
**Iteration:** 1  

**Summary:**
- Findings in scope: 5 (2 Critical, 3 Warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Stale Closure / Empty `listId` in Undo Action Breaks Item Deletion Across Deal Screens

**Files modified:**
- `apps/web/src/lib/api/list-hooks.ts`
- `apps/web/src/screens/deals/AddToListSheet.tsx`
- `apps/web/src/screens/deals/DealSearchScreen.tsx`
- `apps/web/src/screens/deals/FlyerItemsScreen.tsx`

**Applied fix:**
Updated `useDeleteListItem` in `list-hooks.ts` to accept either `string` (when `listId` is bound at the caller) or `{ listId: string; itemId: string }` input. Updated `AddToListSheet.tsx`, `DealSearchScreen.tsx`, and `FlyerItemsScreen.tsx` to dispatch `{ listId: list.id, itemId: data.id }` in the toast undo callback, ensuring item deletions fire against the correct list path and invalidate the proper list cache.

### CR-02: ItemSheet Wipes Out Merchant Data When Store Is Not Present in List Choices

**Files modified:**
- `apps/web/src/components/lists/ItemSheet.tsx`

**Applied fix:**
Derived `availableStores` via `useMemo` from `stores` plus `item?.merchantId` / `initialDraft?.merchantId` if not already present in the list's store choices. Added resolution logic on submit to ensure pre-existing or initial draft merchant IDs and names are preserved rather than overwritten with `null`.

### WR-01: BarcodeScannerDialog Toast & Undo Handler Alignment

**Files modified:**
- `apps/web/src/components/lists/BarcodeScannerDialog.tsx`

**Applied fix:**
Aligned `commitScan` in `BarcodeScannerDialog.tsx` to dispatch batch counter snackbars with `handleUndoLastScan` strictly in accordance with D-16.

### WR-03: Dynamic Category Options Disappear When Filter Is Applied in Deal Search and Flyer Items

**Files modified:**
- `apps/web/src/screens/deals/DealSearchScreen.tsx`
- `apps/web/src/screens/deals/FlyerItemsScreen.tsx`

**Applied fix:**
Retained previously seen categories across queries in `seenCategoriesRef`, ensuring selecting a category does not truncate the dropdown options down to only the active selection.

### WR-04: BarcodeScannerDialog Closes Viewport on Escape When Sub-Sheet Is Open

**Files modified:**
- `apps/web/src/components/lists/BarcodeScannerDialog.tsx`

**Applied fix:**
Updated Escape key handler in `BarcodeScannerDialog.tsx` to check if `unknownBarcode !== null`. If the naming sub-sheet is open, Escape closes the sub-sheet first (`setUnknownBarcode(null)`) rather than dismissing the entire barcode scanner dialog.

### Regression Fix: ListDetailScreen Checkbox Mutation & Toast Queue Reconciliation

**Files modified:**
- `apps/web/src/screens/lists/ListDetailScreen.tsx`

**Applied fix:**
Moved the persistent Undo snackbar dispatch ("Marked as bought · [Undo]") into `updateItem.mutate`'s `onSuccess` callback, conditioned on `shouldToast = isOnline` captured at the time of user toggle. This ensures:
1. Online checkoffs immediately dispatch the persistent Undo snackbar and pass all component-level assertions in `ListDetailScreen.test.tsx`.
2. Failed mutations (409/403/404/410) do not trigger `onSuccess`, preventing success toasts from blocking error notices in the single-slot FIFO toast queue.
3. Offline toggles do not spawn individual toasts during reconnect replay, allowing the queue's summary announcement ("2 changes synced.") to render unblocked, passing all 15 tests in `write-queue.test.tsx`.
