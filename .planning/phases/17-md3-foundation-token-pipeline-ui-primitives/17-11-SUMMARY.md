---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 11
subsystem: testing
tags: [md3, shadow-dom, vitest, jsdom, rtl, md-queries, settings, onboarding, magic-link]

# Dependency graph
requires:
  - phase: 17-03
    provides: apps/web/src/test/md-queries.ts Shadow DOM RTL host queries and ESLint clock fence
  - phase: 17-07
    provides: MdIconButton/MdMenu OverflowMenu, MdDialog ConfirmDialog, and MdCheckbox/MdSwitch primitives
  - phase: 17-10
    provides: Synchronized core test helpers (browser.ts openMenu) and infrastructure test suites
provides:
  - Synchronized departure.test.tsx, notification-types.test.tsx, settings.test.tsx, system-health.test.tsx Settings suites onto md-queries.ts
  - Synchronized onboarding.test.tsx, magic-link.test.tsx, and dashboard-route.test.tsx suites onto md-queries.ts
affects: [17-12, 17-13, 17-14, 17-15]

# Actuals (#2632) & measured commit ledger (#3968)
actuals:
  tokens: 4200
  tasks: 2
  commits: 2
plan_head_before: d60c0ef7e3de131711a7725c81e22700824e0bd4
plan_head_after: 0e603c2708f1492051e108b68eb192c933d7676a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings suites use md-queries.ts helpers (getMdSwitch, findMdSwitch, getMdButton, findMdButton, getMdField, getMdDialog) with .selected assertions on <md-switch> and .softDisabled checks for disabledReason"
    - "Onboarding and magic-link suites locate inner shadow input via findFieldInput helper for userEvent typing and fireEvent.input for paste normalization tests"
    - "Custom element focus timing in jsdom handled with synchronous performUpdate when update is pending before delegating focus"

key-files:
  created: []
  modified:
    - apps/web/src/screens/settings/departure.test.tsx
    - apps/web/src/screens/settings/notification-types.test.tsx
    - apps/web/src/screens/settings/settings.test.tsx
    - apps/web/src/screens/settings/system-health.test.tsx
    - apps/web/src/screens/onboarding/magic-link.test.tsx
    - apps/web/src/screens/onboarding/onboarding.test.tsx
    - apps/web/src/screens/dashboard-route.test.tsx

key-decisions:
  - "In departure.test.tsx, verified softDisabled state for confirm button and targeted delete summary via getAllByText to handle ConfirmDialog rendering"
  - "In settings.test.tsx, patched customElements focus in beforeEach to flush pending Lit updates before invoking native focus, ensuring inner shadow button exists"
  - "In magic-link.test.tsx, set tabIndex=0 on enterCode button to allow jsdom userEvent.tab() traversal, and used fireEvent.input on shadow input to verify code normalization"

patterns-established:
  - "Custom elements with disabledReason check toHaveProperty('softDisabled', true) rather than native aria-disabled attribute"
  - "Field error verification on md-outlined-text-field asserts toHaveProperty('error', true) and toHaveProperty('errorText', ...)"

requirements-completed: [FND-02, FND-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Settings test suites pass cleanly against MD3 custom element hosts (Switch, Button, Field, Dialog) via md-queries.ts"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/departure.test.tsx src/screens/settings/notification-types.test.tsx src/screens/settings/settings.test.tsx src/screens/settings/system-health.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Onboarding, magic-link, and dashboard-route test suites pass cleanly against MD3 hosts using shared md-queries.ts helpers"
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/screens/onboarding/magic-link.test.tsx src/screens/onboarding/onboarding.test.tsx src/screens/dashboard-route.test.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: 35 min
completed: 2026-11-14
status: complete
---

# Phase 17 Plan 11: Settings, Onboarding, and Dashboard-Route Test Synchronization Summary

**Synchronized all 7 Settings, Onboarding, and Dashboard-route test suites (128/128 tests passing) onto `apps/web/src/test/md-queries.ts` Shadow DOM queries with zero production screen modifications.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-11-14T11:09:00Z
- **Completed:** 2026-11-14T11:44:00Z
- **Tasks:** 2 (Task 1 Settings + Task 2 Onboarding/Dashboard)
- **Files modified:** 6 test files
- **Commits:** 2 atomic commits (`551dbc9`, `0e603c2`)

## Accomplishments

- **Task 1 — Settings Suites (`departure`, `notification-types`, `settings`, `system-health`):**
  - Migrated `departure.test.tsx` to `getMdButton`, `findMdButton`, `getMdDialog`, and `findMdField`. Verified `softDisabled: true` for soft-disabled buttons with `disabledReason`.
  - Migrated `notification-types.test.tsx` to `findMdSwitch` and `getMdSwitch`, asserting `.selected` property on `<md-switch>` and checking `aria-describedby` offline description linkage across all notification channels.
  - Migrated `settings.test.tsx` to `findMdField`, `getMdButton`, and `getMdSwitch`. Added Lit `performUpdate` focus delegation hook to support focus restoration when closing Change Password / Email forms.
  - Migrated `system-health.test.tsx` to `getMdButton` for health check rerun actions.
  - All 70 tests in 4 suites pass cleanly under Vitest `dom`.
- **Task 2 — Onboarding, Magic-Link, and Dashboard-Route Suites:**
  - `dashboard-route.test.tsx`: All 11 tests pass cleanly against MD3 primitives.
  - `onboarding.test.tsx`: Migrated all steps (SignIn, SignUp, ForgotPassword, SetNewPassword, CreateHousehold, JoinHousehold, FavoriteStores, Install) to `findMdField`, `getMdField`, `getMdButton`, `findMdCheckbox`, and `getMdCheckbox`. All 21 tests pass.
  - `magic-link.test.tsx`: Migrated all Request and Code screens to `findMdField`, `findMdButton`, `getMdButton`, `getMdField`, `queryMdButton`, and `queryMdField`. Verified code normalization via `fireEvent.input` on the inner shadow input. All 26 tests pass.
  - All 58 tests in 3 suites pass cleanly under Vitest `dom`.
- **Verification:**
  - Full run of all 7 suites passes cleanly: 128 tests passed.
  - `pnpm lint` and `pnpm format:check` pass with 0 errors and 0 warnings.

