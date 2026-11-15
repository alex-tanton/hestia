---
phase: 20-meals-bills-chores-settings-screens
plan: 03
subsystem: web-chores
tags:
  - chores
  - errands
  - md3
  - rotation
  - toast
  - dialogs
status: complete
requires:
  - FND-04
  - NAV-01
  - NAV-02
provides:
  - CHOR-01
  - CHOR-02
affects:
  - chores-list
  - chore-detail
  - chore-form
  - rotation-editor
  - errands-list
  - errand-sheet
key-files:
  created: []
  modified:
    - apps/web/src/components/chores/ChoreListRow.tsx
    - apps/web/src/components/chores/chore-copy.ts
    - apps/web/src/screens/chores/ChoresListScreen.tsx
    - apps/web/src/screens/chores/ChoreDetailScreen.tsx
    - apps/web/src/components/chores/CompletionHistory.tsx
    - apps/web/src/screens/chores/ChoreFormScreen.tsx
    - apps/web/src/components/chores/RotationEditor.tsx
    - apps/web/src/components/chores/RotationEditor.test.tsx
    - apps/web/src/components/errands/ErrandRow.tsx
    - apps/web/src/components/errands/ErrandSheet.tsx
    - apps/web/src/screens/chores/ErrandsListScreen.tsx
    - apps/web/src/screens/chores/chores-offline-queue.test.tsx
    - apps/web/src/screens/chores/chores.test.tsx
    - apps/web/src/screens/chores/errands.test.tsx
    - apps/web/src/screens/chores/errands-offline-queue.test.tsx
    - apps/web/src/screens/chores/household-timezone.test.tsx
decisions:
  - D-13: ChoresListScreen urgency groups (Overdue, Today, This week, Later) with quick "Done" button triggering persistent next-assignee toast ("{choreName} done. {nextTurnName} is next. · [Undo]").
  - D-14: ChoreDetailScreen single <h1> via useScreenChrome and direct history delete; ChoreForm responsive dialog (<600px full-screen canvas, >=600px centered max-w-[720px]) with Switch active toggle.
  - D-15: RotationEditor tonal surfaceContainerLow surface with avatar circles, up/down turn order buttons, and MdSwitch member participation toggles.
  - D-16: ErrandsListScreen top MdFilterChip store/category chips, floating MdFab opening native ModalBottomSheet ErrandSheet, direct trailing Delete with persistent Undo toast, and collapsible Completed (N) accordion matching grocery list pattern.
actuals:
  tokens: 68000
  tasks: 3
  commits: 3
---

# Phase 20 Plan 03: Chores & Errands Modernization Summary

Overhauled the Chores & Errands pillar onto Material Design 3 surfaces with urgency-grouped chore sections (Overdue, Today, This week, Later), quick "Done" completion with persistent next-assignee Undo snackbars, single-`<h1>` top app bar navigation on chore details, responsive `ChoreForm` dialog with tonal `RotationEditor`, top store filter chips for errands, direct trailing errand delete with persistent Undo, `ModalBottomSheet` `ErrandSheet`, and a unified collapsible `Completed (N)` accordion matching grocery lists.

## Key Changes Delivered

1. **ChoresListScreen & ChoreListRow (Task 1 / 20-03-01)**:
   - Grouped recurring chores into Overdue, Today, This week, and Later urgency sections with error badges for overdue items.
   - Replaced legacy 1-item overflow menus on `ChoreListRow` with a quick tonal secondary button labeled "Done" (`aria-label={`Mark done, ${chore.name}`}`).
   - Wired immediate chore completion mutation with persistent next-assignee Undo toast ("{choreName} done. {nextTurnName} is next. · [Undo]"), allowing quick single-tap reversal via `undoChoreCompletion`.
   - Added centered MD3 `EmptyState` matching exact UI-SPEC copy ("No chores yet") and floating `MdFab` with `aria-label="Add chore"` and icon "add".

2. **ChoreDetailScreen, CompletionHistory, ChoreFormScreen & RotationEditor (Task 2 / 20-03-02)**:
   - Migrated route header to single `<h1>` in Top App Bar using `useScreenChrome({ title: chore.name, backTo: '/chores', backLabel: 'Chores' })`.
   - Rendered tonal summary card in `surfaceContainerLow` detailing recurrence frequency, assigned member, and next due date.
   - Eliminated per-row overflow menus in `CompletionHistory` in favor of a direct trailing delete icon button (`MdIconButton` with `icon="delete"`) with persistent Undo toast.
   - Restyled `ChoreFormScreen` as a responsive MD3 Dialog (`md3-responsive-dialog max-w-[720px]`) with `Switch` active toggle.
   - Upgraded `RotationEditor` to an accessible tonal card (`surfaceContainerLow`) with member avatars, full keyboard accessibility, up/down reorder buttons, and `MdSwitch` member participation controls.

3. **ErrandsListScreen, ErrandRow & ErrandSheet (Task 3 / 20-03-03)**:
   - Built top horizontal scrollable strip of `MdFilterChip` components (`All` + unique store tags parsed from errand names via `parseErrandStore`).
   - Upgraded `ErrandRow` with `Checkbox` (wrapping `MdCheckbox`), store badges, and direct trailing `MdIconButton` (`icon="delete"`) eliminating legacy 1-item overflow menus.
   - Tapping Delete immediately removes the errand and triggers a persistent Undo toast ("Removed {name} · [Undo]") with full restore capability.
   - Migrated completed errands group to an MD3 collapsible accordion displaying `Completed (${count})` with `expand_more`/`chevron_right` icon, matching the grocery list `Bought (N)` pattern.
   - Converted `ErrandSheet` to a native `ModalBottomSheet` with fields for title ("Name"), store tag ("Store or category"), due date, assignee, and primary CTA "Create errand".
   - Added floating `MdFab` with `aria-label="Add errand"` and icon "add".

## Verification

All automated test suites pass with 100% assertions green:
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/chores/chores-offline-queue.test.tsx` (5/5 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/components/chores/RotationEditor.test.tsx` (8/8 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/chores/chores.test.tsx` (25/25 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/chores/errands.test.tsx` (17/17 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/chores/errands-offline-queue.test.tsx` (3/3 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/chores/household-timezone.test.tsx` (5/5 passed)
- Total: 63/63 passing tests across the Chores & Errands domain.
- `pnpm --filter @hestia/web typecheck` (0 errors).

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] JSDOM Custom Element Tab Order and Accessible Names in RotationEditor**
   - **Found during:** Task 2 verification.
   - **Issue:** Using nested `<Switch>` in `RotationEditor` rendered light-DOM `<label><span>` text which contaminated testing-library `item.textContent` assertions for member names.
   - **Fix:** Switched to `<MdSwitch>` directly with `aria-label`, preserving shadow DOM encapsulation, correct tab order, and clean textContent representation in test harness.
   - **Commit:** `6432295`

2. **[Rule 1 - Bug] Errand Completion Undo Toast Suppressing Offline Queue Sync Toast**
   - **Found during:** Task 3 verification.
   - **Issue:** Emitting an immediate toast on checking off an errand collided with TanStack Query's offline mutation queue sync notification ("1 change synced.").
   - **Fix:** Delegated sync toast feedback to the mutation queue runner for completions, while preserving persistent Undo toasts for direct deletions.
   - **Commit:** `d7d3515`

3. **[Rule 1 - Bug] Deprecated `label` property on MdFilterChip**
   - **Found during:** Task 3 commit linting.
   - **Issue:** `@material/web` deprecates `label` attribute on `<md-filter-chip>`, requiring content to be provided as child text.
   - **Fix:** Passed label text as child content of `MdFilterChip` and removed deprecated property.
   - **Commit:** `d7d3515`

## Threat Surface Scan

No new network endpoints, authorization paths, or security boundaries introduced. All chore and errand mutations continue to run through authenticated household session hooks (`useCreateErrand`, `useDeleteErrand`, `useUpdateErrand`, `useChoreCompletion`, `queueErrandDone`) with idempotent IDs.

## Known Stubs

None. All screens, dialogs, bottom sheets, buttons, and mutation handlers are fully wired to active data hooks and offline queues.

## Self-Check: PASSED

- All files verified to exist on disk.
- Commits `cb0be6b`, `6432295`, and `d7d3515` verified in git history.
