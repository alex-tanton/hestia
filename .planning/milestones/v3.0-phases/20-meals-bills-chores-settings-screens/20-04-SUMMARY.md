---
phase: 20-meals-bills-chores-settings-screens
plan: 04
subsystem: web-settings
tags:
  - settings
  - notifications
  - stores
  - system-health
  - departure
  - md3
  - dialogs
status: complete
requires:
  - FND-04
  - NAV-01
  - NAV-02
provides:
  - SET-01
  - SET-02
  - SET-03
affects:
  - settings-hub
  - account-route
  - households-route
  - notifications-route
  - notification-types
  - favorite-stores
  - system-health
  - departure-screen
key-files:
  created:
    - apps/web/src/screens/settings/AccountRoute.tsx
    - apps/web/src/screens/settings/HouseholdsRoute.tsx
    - apps/web/src/screens/settings/NotificationsRoute.tsx
  modified:
    - apps/web/src/components/md/MdFilterChip.tsx
    - apps/web/src/components/ui/icon-paths.ts
    - apps/web/src/routes.tsx
    - apps/web/src/screens/deals/FavoriteStores.tsx
    - apps/web/src/screens/deals/favorites.test.tsx
    - apps/web/src/screens/settings/DeleteHouseholdPanel.tsx
    - apps/web/src/screens/settings/DepartureScreen.tsx
    - apps/web/src/screens/settings/NotificationTypeRows.tsx
    - apps/web/src/screens/settings/NotificationTypes.tsx
    - apps/web/src/screens/settings/SettingsScreen.tsx
    - apps/web/src/screens/settings/SystemHealthScreen.tsx
    - apps/web/src/screens/settings/departure.test.tsx
    - apps/web/src/screens/settings/notification-types.test.tsx
    - apps/web/src/screens/settings/settings.test.tsx
    - apps/web/src/screens/settings/system-health.test.tsx
decisions:
  - D-17: SettingsScreen renders a categorized list hub navigating to dedicated pushed sub-routes (/settings/account, /settings/households, /settings/notifications, /settings/system-health) with single <h1> Top App Bar back navigation via useScreenChrome.
  - D-18: FavoriteStores renders removable MdFilterChip pills with trailing remove 'x' (removable=true) and an "+ Add store" chip opening an md-list store picker dialog with search input.
  - D-19: /settings/notifications renders a top tonal device guidance card for PWA install and Web Push status, followed by clean Switch rows grouped by pillar.
  - D-20: DepartureScreen renders a progressive single-column flow with MdSelect item reassignments, tonal RotationNotes, and an error-styled ConfirmDialog for departure and household deletion.
actuals:
  tokens: 18200
  tasks: 3
  commits: 3
  plan_head_before: f2e6d0b2f7670f23fa0b46d230609cc595f4fb7f
  plan_head_after: c65a8097e688c58d71ee80f727813873ccfd8885
---

# Phase 20 Plan 04: Settings Hub, Diagnostics & Departure Summary

Delivered the Material Design 3 overhaul for Settings and Diagnostics: transformed `SettingsScreen` into an end-to-end categorized hub navigating to dedicated pushed sub-routes with single-`<h1>` Top App Bar back navigation; upgraded notification preferences with a top tonal device guidance card and switches grouped by pillar; migrated household favorite stores to removable `MdFilterChip` pills with a store picker dialog; converted `SystemHealthScreen` into a full-bleed borderless diagnostic panel; and streamlined `DepartureScreen` into a progressive single-column reassignment and deletion flow with `MdSelect` and `ConfirmDialog`.

## Key Changes Delivered

1. **Categorized Settings Hub & Pushed Sub-routes (Task 1 / 20-04-01)**:
   - Restyled `SettingsScreen` as a categorized MD3 list hub organized into clear sections:
     - **Household & Preferences**: Household profile, Favorite stores, Household members, Notification preferences (`/settings/notifications`).
     - **Account**: User profile & credentials (`/settings/account`), Switch households (`/settings/households`), Departure / delete household (`/settings/departure`).
     - **System**: Diagnostics & health (`/settings/system-health`), App version, sign out.
   - Created dedicated sub-routes with `useScreenChrome`:
     - `AccountRoute.tsx` (`/settings/account`) with title "Account" and `backTo="/settings"`.
     - `HouseholdsRoute.tsx` (`/settings/households`) with title "Households" and `backTo="/settings"`.
     - `NotificationsRoute.tsx` (`/settings/notifications`) with title "Notification Preferences" and `backTo="/settings"`.
   - Wired route paths in `routes.tsx` under authenticated layout.
   - Updated and expanded `settings.test.tsx` verifying navigation to sub-routes and single-`<h1>` presence.

2. **Notification Device Card, Switch Controls & Favorite Store Chips (Task 2 / 20-04-02)**:
   - **Notification Preferences (`NotificationTypes.tsx`, `NotificationTypeRows.tsx`)**:
     - Added top tonal device guidance card (`surfaceContainerLow` / `primaryContainer`) indicating PWA install status, browser permission state, and step-by-step guidance.
     - Grouped preferences by pillar (Grocery, Meals, Chores, Bills) rendered with standard `Switch` controls, subheaders, and helper copy.
     - Simplified parent `NotificationTypes` to focus purely on preference configuration, delegating device-level controls cleanly.
   - **Favorite Stores (`FavoriteStores.tsx`, `MdFilterChip.tsx`)**:
     - Replaced list rows with horizontal flex wrapping `MdFilterChip` pills.
     - Enabled `removable={true}` on chips, listening for `remove` events to trigger household favorite deletion.
     - Added `+ Add store` chip with `icon="add"` that opens an accessible `MdDialog` (`StorePickerDialog`) with search filtering across non-favorited merchants.
   - Updated `notification-types.test.tsx` and `favorites.test.tsx` with full assertion coverage for chip removals and dialog additions.

3. **Borderless System Health Panel & Progressive Departure Flow (Task 3 / 20-04-03)**:
   - **SystemHealthScreen (`SystemHealthScreen.tsx`)**:
     - Removed legacy `Card` wrapper in favor of a full-bleed borderless container with sticky subheaders.
     - Cleanly displays service connectivity, latency badges (`StatusBadge`), sync queue status, telemetry metrics, and cache skip rates.
   - **DepartureScreen (`DepartureScreen.tsx`, `DeleteHouseholdPanel.tsx`)**:
     - Re-architected multi-step friction into a clean, progressive single-column flow.
     - Reassignment section uses `MdSelect` for chore, bill, and errand item handoffs with contextual `RotationNotes` warning if rotation order will adjust.
     - Extracted `DeleteHouseholdPanel` for the last departing member, requiring the household name to be typed exactly before confirming.
     - Uses error-styled `ConfirmDialog` for destructive departure confirmation, navigating cleanly upon completion.
   - Verified with unit tests in `system-health.test.tsx` and `departure.test.tsx`.

## Verification

All automated test suites pass with 100% assertions green:
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/settings.test.tsx` (16/16 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/notification-types.test.tsx` (46/46 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/deals/favorites.test.tsx` (9/9 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/system-health.test.tsx` (4/4 passed)
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/departure.test.tsx` (9/9 passed)
- Total: 84/84 passing tests across Settings, Notifications, Favorite Stores, System Health, and Departure.
- Workspace typecheck: `pnpm -r --parallel typecheck` passed (0 errors across 7 workspace projects).

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] MdFilterChip child text projection for testing-library query support**
   - **Found during:** Task 2 verification (`favorites.test.tsx`).
   - **Issue:** Passing merchant name via deprecated `label` attribute prevented `@testing-library/react` `findByText` queries from locating the chip in JSDOM.
   - **Fix:** Projected merchant name as React child of `<MdFilterChip>` and passed child text to custom element slot.
   - **Commit:** `d20bc8d`

2. **[Rule 1 - Bug] Top-level SettingsScreen ScreenChrome constraint**
   - **Found during:** Task 1 typecheck.
   - **Issue:** `useScreenChrome` requires both `title` and `backTo` properties for pushed sub-routes; calling it on top-level `SettingsScreen` without `backTo` raised TypeScript TS2345.
   - **Fix:** Top-level `SettingsScreen` renders standard header container without `useScreenChrome`; pushed sub-routes (`AccountRoute`, `HouseholdsRoute`, `NotificationsRoute`) use `useScreenChrome` with `backTo="/settings"`.
   - **Commit:** `bf6f375`

3. **[Rule 1 - Bug] Commitlint body line length limit**
   - **Found during:** Task 3 commit hook.
   - **Issue:** Commit body lines exceeded the 100 character maximum enforced by commitlint.
   - **Fix:** Rewrapped commit body bullet points to <= 80 characters.
   - **Commit:** `c65a809`

## Threat Surface Scan

No new network endpoints, authorization paths, or security boundaries introduced. All departure, deletion, preference updates, and store queries execute through authenticated Supabase hooks (`useHousehold`, `useUpdateHousehold`, `useDeleteHousehold`, `useNotificationPreferences`, `useUpdateNotificationPreference`).

## Known Stubs

None. All sub-routes, device guidance cards, preference switches, favorite store chips, diagnostic metrics, and departure reassignment flows are fully wired to active data hooks and mutations.

## Self-Check: PASSED

- All created files verified to exist on disk:
  - `apps/web/src/screens/settings/AccountRoute.tsx`
  - `apps/web/src/screens/settings/HouseholdsRoute.tsx`
  - `apps/web/src/screens/settings/NotificationsRoute.tsx`
- Commits `bf6f375`, `d20bc8d`, and `c65a809` verified in git history.
