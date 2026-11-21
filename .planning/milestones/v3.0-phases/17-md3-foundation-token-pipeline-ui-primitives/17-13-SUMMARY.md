---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 13
subsystem: testing
tags: [md3, shadow-dom, vitest, jsdom, rtl, md-queries, chores, errands, deals]

# Dependency graph
requires:
  - phase: 17-11
    provides: Settings and Onboarding test synchronization patterns
  - phase: 17-12
    provides: Lists and Bills test synchronization patterns and polymorphic findFieldInput
provides:
  - Synchronized RotationEditor.test.tsx, chores-offline-queue.test.tsx, errands.test.tsx, errands-offline-queue.test.tsx, and household-timezone.test.tsx Chores/Errands suites onto md-queries.ts
  - Synchronized deal-card.test.tsx, deal-search.test.tsx, favorites.test.tsx, and flyers.test.tsx Deals suites onto md-queries.ts
affects: [17-14, 17-15]

# Actuals (#2632) & measured commit ledger (#3968)
actuals:
  tokens: 4900
  tasks: 2
  commits: 2
plan_head_before: 39e31fe0b6ee480f28eec4cbb58c56e3e5b7b9e7
plan_head_after: 253af0a4f6bb9993e36495ee91a27e7740e2cf93

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chores and Errands suites query buttons, checkboxes, dialogs, and fields via md-queries.ts with zero production component changes"
    - "RotationEditor custom element tab navigation in jsdom patched via tabIndex assignment in connectedCallback and updated hooks"
    - "Deals screen tests query MD3 Button, TextField, Checkbox, Dialog, and Pagination controls through md-queries.ts"
    - "Single-slot FIFO Toast queue handling: persistent error toasts (toastDuration = Infinity) dismissed explicitly to unblock queued success toasts"
    - "TextField error state assertions validated directly via getMdField host properties (error: boolean, errorText: string)"

key-files:
  created: []
  modified:
    - apps/web/src/components/chores/RotationEditor.test.tsx
    - apps/web/src/screens/chores/chores-offline-queue.test.tsx
    - apps/web/src/screens/chores/errands-offline-queue.test.tsx
    - apps/web/src/screens/chores/errands.test.tsx
    - apps/web/src/screens/chores/household-timezone.test.tsx
    - apps/web/src/screens/deals/deal-card.test.tsx
    - apps/web/src/screens/deals/deal-search.test.tsx
    - apps/web/src/screens/deals/favorites.test.tsx
    - apps/web/src/screens/deals/flyers.test.tsx

key-decisions:
  - "In RotationEditor.test.tsx, patched md-icon-button prototype to provide tabIndex = disabled ? -1 : 0 and used getMdAccessibleName in focusedName helper"
  - "In chores-offline-queue.test.tsx and deal-card.test.tsx, dismissed blocking error toast via Dismiss button to allow subsequent queued toast to display"
  - "In errands.test.tsx and deal-search.test.tsx, utilized polymorphic findFieldInput to dispatch fireEvent.input to shadow input elements without jsdom focus trapping"
  - "In favorites.test.tsx, migrated merchant checkboxes to findMdCheckbox/getMdCheckbox with toHaveProperty('checked', ...)"
  - "In deal-search.test.tsx, validated price error feedback through getMdField error and errorText host properties rather than light-DOM query"

patterns-established:
  - "MD3 error toasts with infinite duration must be dismissed with user.click(screen.getByRole('button', { name: 'Dismiss' })) before asserting subsequent toasts"
  - "Custom element input error validation in test suites asserts on host element error and errorText properties"

requirements-completed: [FND-02, FND-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Chores and Errands test suites pass cleanly against MD3 custom element hosts (Button, Field, Checkbox, Dialog) via md-queries.ts"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/components/chores/RotationEditor.test.tsx src/screens/chores/chores-offline-queue.test.tsx src/screens/chores/errands.test.tsx src/screens/chores/errands-offline-queue.test.tsx src/screens/chores/household-timezone.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Deals test suites pass cleanly against MD3 hosts (Button, TextField, Checkbox, Dialog) via md-queries.ts"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/screens/deals/deal-card.test.tsx src/screens/deals/deal-search.test.tsx src/screens/deals/favorites.test.tsx src/screens/deals/flyers.test.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: 45 min
completed: 2026-11-14
status: complete
---

# Phase 17 Plan 13: Chores, Errands, and Deals Test Synchronization Summary

**Synchronized all 9 Chores, Errands, and Deals test suites (91/91 tests passing across 5 Chores/Errands suites and 4 Deals suites) onto `apps/web/src/test/md-queries.ts` Shadow DOM queries with zero production screen modifications.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-11-14T12:25:00Z
- **Completed:** 2026-11-14T12:57:00Z
- **Tasks:** 2 (Task 1 Chores & Errands + Task 2 Deals)
- **Files modified:** 9 test files
- **Commits:** 2 atomic commits (`16d6a9d`, `253af0a`)

## Accomplishments

- **Task 1 — Chores and Errands Suites (`RotationEditor`, `chores-offline-queue`, `errands-offline-queue`, `errands`, `household-timezone`):**
  - Migrated `household-timezone.test.tsx` (5/5 tests passed): updated `rowOfDoneButton` to target `getMdButton` and assertions to `queryMdButton`.
  - Migrated `RotationEditor.test.tsx` (7/7 tests passed): patched `md-icon-button` prototype in `beforeEach` to provide `tabIndex = disabled ? -1 : 0` so jsdom `userEvent.tab()` traverses enabled controls in sequence; added `focusInnerButton` helper to focus shadow button before keyboard activation; updated `focusedName` helper to use `getMdAccessibleName`.
  - Migrated `chores-offline-queue.test.tsx` (4/4 tests passed): updated action button queries to `findMdButton`/`getMdButton`, added `waitFor` to ensure mutations pause before reconnecting, and dismissed persistent Undo snackbars to assert queued reconnection notices.
  - Migrated `errands-offline-queue.test.tsx` (3/3 tests passed): updated checkbox queries to `findMdCheckbox`/`getMdCheckbox` asserting `toHaveProperty('checked', ...)` and `softDisabled`.
  - Migrated `errands.test.tsx` (15/15 tests passed): updated errand quick-add/edit form fields and action buttons using polymorphic `findFieldInput`, `findMdButton`, `findMdDialog`, and `findMdField`.
  - Committed in `16d6a9d`: `test(web): sync Chores and Errands suites to md-queries (17-13)`.

- **Task 2 — Deals Suites (`deal-card`, `deal-search`, `favorites`, `flyers`):**
  - Migrated `deal-card.test.tsx` (22/22 tests passed): updated "Add to list" action buttons to `findMdButton`/`getMdButton`; dismissed error toasts via `Dismiss` button to unblock single-slot FIFO queue for subsequent success toasts.
  - Migrated `flyers.test.tsx` (13/13 tests passed): updated "Add items by hand", "Browse all stores", "Change the postal code", and pagination Next buttons to `getMdButton`.
  - Migrated `favorites.test.tsx` (9/9 tests passed): updated merchant favorite checkboxes to `findMdCheckbox`/`getMdCheckbox` asserting `toHaveProperty('checked', true/false)` and retry/navigation buttons to `getMdButton`.
  - Migrated `deal-search.test.tsx` (13/13 tests passed): updated search field input to `findFieldInput` with `fireEvent.input`; updated shortcut buttons, pagination controls, search submit, and filter action buttons to `getMdButton`/`getAllMdButtons`; asserted `error` and `errorText` on `getMdField('Lowest price')`.
  - Committed in `253af0a`: `test(web): sync Deals suites to md-queries (17-13)`.
