---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 12
subsystem: testing
tags: [md3, shadow-dom, vitest, jsdom, rtl, md-queries, lists, bills]

# Dependency graph
requires:
  - phase: 17-10
    provides: Synchronized core test helpers (browser.ts openMenu) and infrastructure test suites
  - phase: 17-11
    provides: Settings and Onboarding test synchronization patterns
provides:
  - Synchronized BarcodeScannerDialog.test.tsx, ItemSheet.test.tsx, ListDetailScreen.test.tsx, lists.test.tsx Lists suites onto md-queries.ts
  - Synchronized bill-detail.test.tsx, bills-index.test.tsx, household-timezone.test.tsx, subscriptions.test.tsx Bills suites onto md-queries.ts
affects: [17-13, 17-14, 17-15]

# Actuals (#2632) & measured commit ledger (#3968)
actuals:
  tokens: 4400
  tasks: 2
  commits: 2
plan_head_before: 79c778ef61a06fce92c57f2025752c0e86b0da3e
plan_head_after: 7d80d0e1458e0a3014389ddffc46a6f3b0638e9c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lists component and screen tests query MD3 elements using findMdButton, getMdButton, findMdField, findMdCheckbox, findMdDialog, and openMenu/findMdMenuItem"
    - "In-list checkboxes assert toHaveProperty('checked', true) on <md-checkbox> hosts rather than role='checkbox'"
    - "Menu items query using getMdMenuItem/findMdMenuItem and assert toHaveProperty('disabled', true) rather than aria-disabled"
    - "Bills screen tests locate inner inputs via findFieldInput helper handling both Shadow DOM custom elements and native Light DOM inputs (DateField/NativePickerField)"
    - "Mark paid buttons targeted specifically via data-aria-label ('Mark paid, Duke Energy') preventing duplicate button query ambiguity"

key-files:
  created: []
  modified:
    - apps/web/src/components/lists/BarcodeScannerDialog.test.tsx
    - apps/web/src/components/lists/ItemSheet.test.tsx
    - apps/web/src/screens/lists/ListDetailScreen.test.tsx
    - apps/web/src/screens/lists/lists.test.tsx
    - apps/web/src/screens/bills/bill-detail.test.tsx
    - apps/web/src/screens/bills/bills-index.test.tsx
    - apps/web/src/screens/bills/household-timezone.test.tsx
    - apps/web/src/screens/bills/subscriptions.test.tsx

key-decisions:
  - "In BarcodeScannerDialog.test.tsx, targeted SegmentedControl aria-checked state and explicit button names for mode toggle and scanner submit actions"
  - "In ItemSheet.test.tsx, updated errorText property assertion directly on md-outlined-text-field host"
  - "In lists.test.tsx, used findFieldInput helper with fireEvent.input to update input fields inside shadow DOM without jsdom focus errors"
  - "In bill-detail.test.tsx, targeted payment menu by its formatted occurrence date and asserted softDisabled property on edit button"
  - "In bills-index.test.tsx, supported both NativePickerField HTMLInputElement directly and MD3 shadow inputs via polymorphic findFieldInput helper"

patterns-established:
  - "Polymorphic findFieldInput returns host directly if instance of HTMLInputElement/HTMLTextAreaElement, or queries shadowRoot for custom elements"
  - "OverflowMenu trigger items with duplicate action prefixes must be queried with specific occurrence labels or parent container scope"

requirements-completed: [FND-02, FND-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Lists test suites pass cleanly against MD3 custom element hosts (Button, Field, Checkbox, Menu, Dialog) via md-queries.ts"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/components/lists/BarcodeScannerDialog.test.tsx src/components/lists/ItemSheet.test.tsx src/screens/lists/ListDetailScreen.test.tsx src/screens/lists/lists.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bills test suites pass cleanly against MD3 hosts and native date inputs using shared md-queries.ts helpers"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/screens/bills/bill-detail.test.tsx src/screens/bills/bills-index.test.tsx src/screens/bills/household-timezone.test.tsx src/screens/bills/subscriptions.test.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: 40 min
completed: 2026-11-14
status: complete
---

# Phase 17 Plan 12: Lists and Bills Test Synchronization Summary

**Synchronized all 8 Lists and Bills test suites (81/81 tests passing across 4 Lists suites and 4 Bills suites) onto `apps/web/src/test/md-queries.ts` Shadow DOM queries with zero production screen modifications.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-11-14T11:45:00Z
- **Completed:** 2026-11-14T12:22:00Z
- **Tasks:** 2 (Task 1 Lists + Task 2 Bills)
- **Files modified:** 8 test files (7 modified, 1 passed as-is)
- **Commits:** 2 atomic commits (`94acff9`, `7d80d0e`)

## Accomplishments

- **Task 1 — Lists Suites (`BarcodeScannerDialog`, `ItemSheet`, `ListDetailScreen`, `lists`):**
  - Migrated `BarcodeScannerDialog.test.tsx` (7/7 tests passed): verified SegmentedControl via `aria-checked="true"` and button actions via `getMdButton`.
  - Migrated `ItemSheet.test.tsx` (3/3 tests passed): verified `getMdField`, `getMdButton`, and error message state via `toHaveProperty('errorText', ...)`.
  - Migrated `ListDetailScreen.test.tsx` (5/5 tests passed): updated action buttons to `findMdButton`/`getMdButton` and item input to `findMdField`.
  - Migrated `lists.test.tsx` (31/31 tests passed): migrated list CRUD, in-list checkboxes (`findMdCheckbox`), menu item operations (`openMenu`, `getMdMenuItem`), and bottom sheet dialogs (`findMdDialog`).
  - Committed in `94acff9`: `test(web): sync Lists suites to md-queries (17-12)`.

- **Task 2 — Bills Suites (`household-timezone`, `subscriptions`, `bill-detail`, `bills-index`):**
  - Verified `household-timezone.test.tsx` (3/3 tests passed as-is without change).
  - Migrated `subscriptions.test.tsx` (8/8 tests passed): updated action buttons and retry buttons to `findMdButton` and `getMdButton`.
  - Migrated `bill-detail.test.tsx` (11/11 tests passed): updated back button, offline button checks (`softDisabled`), archive/delete menus, and payment history overflow menus targeted by formatted occurrence date.
  - Migrated `bills-index.test.tsx` (13/13 tests passed): updated dashboard buttons, empty state button scoped to empty notice container, offline checks, bill payment by explicit label (`Mark paid, Duke Energy`), skip confirmation dialog, and add bill form supporting both MD3 fields and native `DateField` inputs.
  - Committed in `7d80d0e`: `test(web): sync Bills suites to md-queries (17-12)`.
