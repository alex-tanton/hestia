---
phase: 20-meals-bills-chores-settings-screens
plan: 02
subsystem: web-bills
tags:
  - bills
  - subscriptions
  - md3
  - dialogs
  - toast
status: complete
requires:
  - FND-04
  - NAV-01
  - NAV-02
provides:
  - BILL-01
  - BILL-02
affects:
  - bills-index
  - subscriptions
  - bill-detail
key-files:
  created: []
  modified:
    - apps/web/src/screens/bills/BillsIndexScreen.tsx
    - apps/web/src/components/bills/BillRow.tsx
    - apps/web/src/screens/bills/SubscriptionsScreen.tsx
    - apps/web/src/components/bills/SubscriptionRow.tsx
    - apps/web/src/screens/bills/BillDetailScreen.tsx
    - apps/web/src/components/bills/PaymentHistory.tsx
    - apps/web/src/components/bills/PaymentEditSheet.tsx
    - apps/web/src/components/bills/BillForm.tsx
    - apps/web/src/screens/bills/bills-index.test.tsx
    - apps/web/src/screens/bills/subscriptions.test.tsx
    - apps/web/src/screens/bills/bill-detail.test.tsx
decisions:
  - D-09: Direct one-tap "Mark Paid" button on BillRow with persistent single-slot Undo toast invoking payment deletion.
  - D-10: SubscriptionsScreen 28px Display spend Hero Card showing "$X/month across N active services" without annualized projection.
  - D-11: Responsive MD3 BillForm dialog (<600px full-screen canvas, >=600px centered max-w-[720px]) with native MD3 Switch controls for recurrence, autopay, and subscription tracking.
  - D-12: Direct inline delete action on PaymentHistory with persistent Undo toast, and tap on paid rows opening ModalBottomSheet PaymentEditSheet.
actuals:
  tokens: 58000
  tasks: 3
  commits: 3
---

# Phase 20 Plan 02: Bills & Subscriptions Modernization Summary

Overhauled the Bills & Subscriptions pillar onto Material Design 3 surfaces with urgency-grouped sections (Overdue, Upcoming, Inactive), floating MdFab for bill and subscription creation, zero 1-item overflow menus, direct one-tap payments with persistent Undo snackbars, a 28px Display spend Hero Card, and responsive dialogs with native MD3 Switch controls.

## Key Changes Delivered

1. **BillsIndexScreen & BillRow (Task 1 / 20-02-01)**:
   - Organized bills by urgency into Overdue, Upcoming, and Inactive sections with error semantic status badges for overdue items.
   - Completely eliminated legacy 1-item overflow menus on BillRow in favor of a direct secondary button labeled "Mark paid" (`min-h-12` 48px touch target).
   - Wired immediate payment recording with persistent Undo toast feedback ("Marked {name} as paid · [Undo]"), where clicking Undo deletes the newly recorded payment occurrence.
   - Replaced empty state with MD3 tonal `EmptyState` matching exact UI-SPEC copywriting contract ("No bills tracked yet").
   - Added floating `MdFab` with `aria-label="Add bill"` and icon "add".

2. **SubscriptionsScreen & SubscriptionRow (Task 2 / 20-02-02)**:
   - Formatted monthly spend using a minimal 28px Display Hero Card (`Card variant="flat"` in `surfaceContainerLow`) reading "Total per month", formatted monthly spend, and "across N active services" per D-10.
   - Rendered borderless `SubscriptionRow` items showing service name, formatted cadence amount, annual amount, and direct link to bill detail.
   - Added `EmptyState` when zero subscriptions are active ("No subscriptions tracked yet") with primary CTA "Add subscription".
   - Added floating `MdFab` with `aria-label="Add subscription"` preselecting subscription tracking in `BillForm`.

3. **BillDetailScreen, PaymentHistory, PaymentEditSheet & BillForm (Task 3 / 20-02-03)**:
   - Enforced single `<h1>` route header via `useScreenChrome` with back navigation to `/bills`.
   - Rendered tonal `surfaceContainerLow` summary card with due date, amount, recurrence interval, and autopay status.
   - Eliminated per-row overflow menus in `PaymentHistory`; added direct trailing delete icon button with persistent Undo toast ("Removed payment for {name} · [Undo]").
   - Tapping paid payment rows opens `PaymentEditSheet` inside native `<dialog>` `ModalBottomSheet` to edit paid date and amount.
   - Overhauled `BillForm` as a responsive MD3 Dialog (`md3-responsive-dialog w-full max-w-[720px]`) featuring native MD3 `Switch` toggles for recurrence, autopay, and subscription tracking.
   - Destructive confirmation dialogs for deleting ("Delete {name}? Its payment history is removed with it.") and archiving ("Archive {name}? It stops showing up and sends no more reminders; its history is kept.").

## Verification Results

All 3 automated Vitest DOM test suites pass with 100% green assertions:
- `src/screens/bills/bills-index.test.tsx`: 12 tests passed
- `src/screens/bills/subscriptions.test.tsx`: 8 tests passed
- `src/screens/bills/bill-detail.test.tsx`: 13 tests passed
- Total: 33 tests passed

## Deviations from Plan

None - executed all tasks per specifications and design tokens.

## Self-Check: PASSED
- `apps/web/src/screens/bills/BillsIndexScreen.tsx`: FOUND
- `apps/web/src/components/bills/BillRow.tsx`: FOUND
- `apps/web/src/screens/bills/SubscriptionsScreen.tsx`: FOUND
- `apps/web/src/components/bills/SubscriptionRow.tsx`: FOUND
- `apps/web/src/screens/bills/BillDetailScreen.tsx`: FOUND
- `apps/web/src/components/bills/PaymentHistory.tsx`: FOUND
- `apps/web/src/components/bills/PaymentEditSheet.tsx`: FOUND
- `apps/web/src/components/bills/BillForm.tsx`: FOUND
- Commit `0b925c9`: FOUND
- Commit `bbcc9d5`: FOUND
- Commit `4a9b24e`: FOUND
