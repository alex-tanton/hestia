# Phase 20: Meals, Bills, Chores & Settings Screens - Research

**Researched:** 2026-11-15  
**Domain:** Material Design 3 Web Frontend (`apps/web`), React 19.3, `@material/web@2.5.0`, Lit adapters, Full-Screen/Centered Responsive Dialogs, Modal Bottom Sheets, Persistent Undo Snackbars, Zero 1-Item Overflow Menus, Categorized Settings Hub, Vitest DOM Harness, and Playwright E2E Compatibility  
**Confidence:** HIGH  

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Meals & Recipe Planning
- **D-01:** In `PlannerScreen` on mobile (`<840px`), render the 7-day agenda with scheduled meals only and a compact "+ Plan meal" button per day; empty days display an uncluttered indicator rather than empty placeholder rows (`MEAL-04`). — **Reversibility:** costly — touches agenda layout, day group styling, and Playwright locator scoping.
- **D-02:** Present `RecipeForm` (create/edit recipe) as a Responsive MD3 Dialog (Full-screen dialog on mobile `<600px`, centered wide dialog `max-w-[720px]` on desktop) to keep users in context without full route switching (`MEAL-06`). — **Reversibility:** costly — defines dialog wrapper, portal hierarchy, and route interception.
- **D-03:** Structure `IngredientEditor` inside `RecipeForm` as an inline rapid row editor with borderless rows for quantity, unit, and ingredient name, using the Enter key to advance to the next ingredient row and reorder controls (`MEAL-06`).
- **D-04:** In `RecipeDetailScreen`, exporting ingredients to grocery lists always opens `ListPickerSheet` with a checklist of missing ingredients and target list selector, allowing verification and deselecting items before addition (`MEAL-06`).
- **D-05:** When tapping "Plan this meal" in `RecipeDetailScreen`, open `PlaceOnPlannerSheet` to select day (mon–sun pills) and meal slot (Breakfast, Lunch, Dinner segmented button) with "Today" preselected (`MEAL-05`).
- **D-06:** In `RecipeDetailScreen`, visualize ingredient readiness using a tonal progress card with inline deal/pantry badges per ingredient row, where tapping opens `MatchToSheet` (`Pantry | Deals` tabs) (`MEAL-06`).
- **D-07:** In `MealPlacementSheet`, present quick meal shortcuts (`QUICK_SUGGESTIONS`: Takeout, Leftovers, etc.) as a horizontal `<md-suggestion-chip>` strip directly above the custom dish text input (`MEAL-05`).
- **D-08:** On expanded desktop screens (`>=840px`), render the 7-column Planner weekly board with click-to-open actions menu for accessible move/edit/remove meal actions (`MEAL-04`).

#### Bills & Subscriptions
- **D-09:** On `BillsIndexScreen`, implement direct one-tap "Mark Paid" icon button on active bill rows that immediately records payment and triggers a persistent Undo Snackbar (`toast.undo`) (`BILL-01`). — **Reversibility:** costly — affects quick payment mutation, test assertions, and row action layout.
- **D-10:** On `SubscriptionsScreen`, format the Hero Card as a minimal monthly spend badge ("$X/month across N active services") without annualized projection, emphasizing clean simplicity (`BILL-01`).
- **D-11:** Present `BillForm` (create/edit bill or subscription) as a Responsive MD3 Dialog (Full-screen on mobile `<600px`, centered on desktop) using `<md-switch>` toggles for recurrence and autopay (`BILL-02`).
- **D-12:** On `BillDetailScreen`'s `PaymentHistory`, provide direct inline action buttons (direct Delete on skipped payments, tap on paid rows opens `PaymentEditSheet` to adjust amount/date) with persistent Undo Snackbar feedback (`BILL-02`).

#### Chores Rotation & Errands
- **D-13:** On `ChoresListScreen`, tapping the quick "Done" tonal icon button immediately records completion, advances rotation, and triggers a persistent Undo toast announcing the next assignee: "Completed! Next up: [Name] · [Undo]" (`CHOR-01`). — **Reversibility:** costly — touches chore completion pipeline, toast payload, and offline queue synchronization.
- **D-14:** Present `ChoreForm` (create/edit chore) as a Responsive MD3 Dialog (Full-screen on mobile `<600px`, centered on desktop) maintaining consistency across all creation dialogs (`CHOR-01`).
- **D-15:** Structure `RotationEditor` inside `ChoreForm` as an accessible tonal `<md-list>` with per-member enable switches, avatars, and up/down turn order controls (`CHOR-01`).
- **D-16:** On `ErrandsListScreen`, provide store/category filter chips (`All`, `Hardware`, `Pharmacy`, etc.) at the top, a floating `<md-fab>` opening `ErrandSheet` Modal Bottom Sheet, direct trailing Delete with persistent Undo, and a collapsible `Completed (N)` section matching grocery `Bought (N)` (`CHOR-02`).

#### Settings Hub Architecture
- **D-17:** Architect `SettingsScreen` as a categorized `<md-list>` hub navigating to pushed sub-routes (`/settings/account`, `/settings/households`, `/settings/notifications`, `/settings/system-health`) with Top App Bar back navigation and a single `<h1>` (`SET-01`). — **Reversibility:** costly — defines client-side routes, navigation stack, and test URLs.
- **D-18:** Manage household `FavoriteStores` via removable tonal filter chips with 'x' to remove, plus an "+ Add store" chip opening an `<md-list>` regional store picker dialog (`SET-02`).
- **D-19:** In `/settings/notifications`, present a top tonal device guidance card showing PWA install & Web Push permission status (with direct enable CTA if needed), followed by clean `<md-switch>` rows grouped by pillar (Deals, Chores, Bills) (`SET-02`).
- **D-20:** Design `DepartureScreen` as a progressive single-column flow with `<md-outlined-select>` reassignments for chores and bills, tonal `RotationNotes`, and an `error`-styled confirmation dialog requiring explicit confirmation to depart or delete (`SET-03`).

### the agent's Discretion
- **Dialog transition & animation:** Standard 150–200ms scale/fade transitions on desktop dialogs and slide-up on mobile dialogs.
- **Empty state illustrations:** Use Material Symbols (`restaurant`, `receipt_long`, `cleaning_services`, `inventory_2`) with `bodyMedium` copy in tonal cards.
- **Touch target sizing:** Ensure all icon buttons and row tap targets maintain at least 48×48dp (`min-h-12`).

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **MEAL-04** | De-clutter `PlannerScreen` by removing triple-stacked mobile chrome in favor of a compact Week Switcher, Day Anchor Pills, and a 7-day vertical `<md-list>` agenda on Compact/Medium (`<840px`) plus a 7-column tonal card board on Expanded (`>=840px`). | `PlannerScreen.tsx` de-cluttering with `useMediaQuery('(min-width: 840px)')`, compact week switch bar, day anchor pills, planned-only scheduled rows with empty-day subtle indicators, and click-to-open actions menu on desktop. |
| **MEAL-05** | Overhaul `MealPlacementSheet` and `PlaceOnPlannerSheet` as Modal Bottom Sheets featuring a Segmented Button meal-slot selector, `<md-outlined-text-field>` custom entry, `<md-suggestion-chip>` strip for `QUICK_SUGGESTIONS`, and `<md-list>` recipe picker. | Native `<dialog>.showModal()` `ModalBottomSheet` migration, new `MdSuggestionChip.tsx` wrapper for `@material/web/chips/suggestion-chip.js`, horizontal suggestion chip strip, and `SegmentedControl` meal-slot picker. |
| **MEAL-06** | Overhaul `RecipeLibraryScreen` (Search Bar + `<md-filter-chip>` `"Ready now"`/`"On sale"` + tonal `RecipeCard`s), `RecipeDetailScreen` (tonal `ReadinessBreakdown`, clean `<md-list>` `IngredientRow` actions, tabbed `MatchToSheet` `Pantry \| Deals`, `ListPickerSheet`), and `RecipeForm` as a Full-Screen/Centered Dialog with borderless `IngredientEditor`. | Tonal `Card` for `RecipeCard` with `ReadinessRing`, `IngredientRow` borderless MD3 list rows, `MatchToSheet` and `ListPickerSheet` migration to `ModalBottomSheet`, and `RecipeForm` as responsive `MdDialog` (`<600px` full-screen, `>=600px` centered `max-w-[720px]`). |
| **BILL-01** | Overhaul `BillsIndexScreen` (`<md-list>` sections `Overdue`/`Upcoming`/`Inactive`, `<md-fab>`, zero 1-item overflow menus via consolidated `BillRow` actions) and `SubscriptionsScreen` (tonal Hero Card + borderless `<md-list>`). | Grouped `<md-list>` sections with urgency ranking, direct "Mark Paid" button on `BillRow` with persistent Undo toast (`toast({ variant: 'success', message, action: { label: 'Undo', onAction } })`), `<md-fab>` for adding bills, and `SubscriptionsScreen` 28px Display tonal Hero Card. |
| **BILL-02** | Overhaul `BillDetailScreen` (Top App Bar `Edit` + multi-item `OverflowMenu`, tonal summary card, `<md-list>` `PaymentHistory` with direct `Delete` icon on skipped rows, `PaymentEditSheet` Modal Bottom Sheet) and Full-Screen Dialog / pushed `BillForm` using `<md-switch>` toggles. | Direct inline actions on `PaymentHistory` eliminating per-row overflow menus, `PaymentEditSheet` on `ModalBottomSheet`, `BillForm` as responsive `MdDialog` using `<md-switch>` (`Switch.tsx`) for `autopay` and `isSubscription`. |
| **CHOR-01** | Overhaul `ChoresListScreen` (`<md-list>`, quick `Done` tonal icon button, `<md-fab>`), `ChoreDetailScreen` (single `<h1>`, direct `Edit` icon button, direct `Delete` icon on latest `CompletionHistory` entry), and `ChoreFormScreen` (single `<h1>`, `<md-switch>`, tonal `<md-list>` `RotationEditor`). | Quick "Done" icon button on `ChoreListRow` with persistent next-assignee toast (`"Completed! Next up: [Name] · [Undo]"`), single-`<h1>` enforcement in Top App Bar (`useScreenChrome`), `RotationEditor` accessible tonal list with avatar switches and up/down turn order controls, and `ChoreForm` as responsive `MdDialog`. |
| **CHOR-02** | Overhaul `ErrandsListScreen` (`<md-list>` + `<md-checkbox>`, direct trailing `Delete` icon with persistent Undo Snackbar, `<md-fab>`, `ErrandSheet` Modal Bottom Sheet, and unified collapsible `Completed` section matching `Bought`). | Errand category/store filter chips (`MdFilterChip`), direct trailing Delete button on `ErrandRow` with persistent Undo toast, `<md-fab>` opening `ErrandSheet` (`ModalBottomSheet`), and unified collapsible `Completed (N)` matching grocery list `Bought (N)` pattern. |
| **SET-01** | Replace `SettingsScreen`'s 6-section stacked form wall with a categorized `<md-list>` hub opening focused sheets/dialogs or sub-views (`Account`, `Households & Invites`, `Household Preferences & Stores`, `Notifications`, `About & System Health`). | Modular categorized `<md-list>` hub on `/settings` with leading Material Symbols (`person`, `home`, `notifications`, `dns`, `info`), pushed sub-routes (`/settings/account`, `/settings/households`, `/settings/notifications`, `/settings/system-health`), each with single-`<h1>` Top App Bar back navigation. |
| **SET-02** | Convert `NotificationTypeRows` checkboxes to real `<md-switch>` controls with a tonal device guidance banner, and modernize `FavoriteStores` with `<md-filter-chip>` selected pills and an `<md-list>` picker. | Top tonal surfaceContainerLow device guidance card (PWA install + Web Push status + enable CTA) in `/settings/notifications`, grouped `<Switch>` rows by pillar (Deals, Chores, Bills), and `FavoriteStores` converted to removable `<md-filter-chip>` pills with "+ Add store" picker dialog. |
| **SET-03** | Redesign `SystemHealthScreen` as a borderless `<md-list>` diagnostic panel and `DepartureScreen` as a single-column progressive flow (`ReassignmentList` `<md-outlined-select>`, tonal `RotationNotes`, `error`-styled `<md-dialog>` delete confirmation). | `SystemHealthScreen` borderless list cards with status indicators and latency stats, `DepartureScreen` progressive single-column flow with `<md-outlined-select>` reassignments, and `error`-styled destructive `<ConfirmDialog>` / text-confirmation dialog for household deletion. |
</phase_requirements>

---

## Summary

Phase 20 delivers the comprehensive Material Design 3 overhaul of Hestia's four core operational pillars: Meals & Recipes, Bills & Subscriptions, Chores & Errands, and Settings & Departure. Following Phase 17's token foundation and primitives, Phase 18's adaptive navigation shell, and Phase 19's entry, dashboard, and grocery ecosystem migrations, Phase 20 completes the visual and interaction modernization of all remaining user-facing application screens.

The primary architectural themes of this phase resolve long-standing friction points:
1. **De-cluttering & Window Size Classes:** Replacing the triple-stacked mobile chrome in the meal planner with a clean planned-only agenda `<840px` and a 7-column tonal board `>=840px`.
2. **Form Presentation Modernization:** Converting multi-field creation/edit forms (`RecipeForm`, `BillForm`, `ChoreForm`) from legacy Radix sheets to responsive MD3 Dialogs (full-screen on mobile `<600px`, centered wide `max-w-[720px]` on desktop).
3. **Menu Streamlining:** Completely eliminating 1-item overflow menus across bills, payment history, and errands in favor of direct inline actions backed by persistent single-slot Undo Snackbars (`toast.undo`).
4. **Settings Restructure:** Replacing the overwhelming 6-section stacked form wall on `/settings` with a categorized `<md-list>` hub navigating to dedicated pushed sub-routes with Top App Bar back navigation and single-`<h1>` architecture.

**Primary recommendation:** Decompose Phase 20 into 4 functional waves aligned with the 4 pillars (Meals, Bills, Chores, Settings), with paired DOM component tests and Playwright E2E locators updated in lockstep in each wave, followed by a dedicated release verification gate.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| **Planner Agenda Viewport Adaptation** | Client Component (`PlannerScreen`) | Layout CSS (`gap-primitives.css`) | Responsive switching between `<840px` compact planned-only agenda and `>=840px` 7-column board is client presentation logic driven by window size class. |
| **Responsive Form Dialog Presentation** | UI Wrapper (`ResponsiveDialog` / `MdDialog`) | Client Forms (`RecipeForm`, `BillForm`, `ChoreForm`) | Full-screen (`<600px`) vs centered modal (`>=600px`) presentation is handled consistently via MD3 dialog layout tokens, keeping form business logic isolated. |
| **Instant Quick Actions & Reversible State** | Client Optimistic Queue (`useToast`) | API / Service Mutation (`/api/...`) | One-tap "Mark Paid", chore "Done", and errand "Delete" immediately update local state and announce via persistent Undo Snackbar; actual deletion or advance is reversible within toast duration. |
| **Chore Rotation Succession Display** | Client Presentation (`ChoreListRow`) | Shared Recurrence Engine (`@hestia/recurrence`) | Announcing "Next up: [Name]" in completion toasts uses household roster and rotation order already cached in client state. |
| **Settings Hub Navigation** | React Router (`routes.tsx` / `SettingsRoute.tsx`) | Screen Components | Dedicated pushed sub-routes (`/settings/account`, etc.) maintain clean browser history, deep-linking, and Top App Bar back navigation rather than mounting heavy forms in memory. |
| **Store Matching & Inventory Export** | Client Sheets (`MatchToSheet`, `ListPickerSheet`) | Deals & Lists APIs | Selecting missing ingredients and target grocery lists happens in focused Modal Bottom Sheets before issuing batch additions to shopping lists. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@material/web` | 2.5.0 | Official MD3 Web Components (`<md-switch>`, `<md-dialog>`, `<md-filter-chip>`, `<md-suggestion-chip>`, `<md-fab>`, `<md-list>`) | Google's reference Material 3 implementation for Web; custom elements wrapped via `@lit/react`. [VERIFIED: apps/web/package.json:22] |
| `@lit/react` | 1.0.8 | React 19 wrappers for `@material/web` custom elements | Enforces typed event binding, property synchronization, and SSR safety. [VERIFIED: apps/web/package.json:21] |
| `@material/material-color-utilities` | 0.4.0 | Warm Terracotta token generation (`SchemeTonalSpot`, `MaterialDynamicColors`) | Generates WCAG AA compliant tonal palette across all 5 `surfaceContainer` elevation tiers. [VERIFIED: apps/web/package.json:37] |
| `react-router` | 8.4.0 | Client routing, pushed sub-routes, navigation parameters, and back navigation | Standardized router across the application; powers `/settings/*` sub-routes and pillar tabs. [VERIFIED: apps/web/package.json:33] |
| `@tanstack/react-query` | 5.103.1 | Server state caching, optimistic updates, and offline mutation queue | Core state engine for bills, chores, meals, and settings data synchronization. [VERIFIED: apps/web/package.json:25] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Icon.tsx` | In-repo | Curated Material Symbols Rounded SVG registry | All icons across list rows, app bars, empty states, and action buttons. [VERIFIED: apps/web/src/components/ui/Icon.tsx:1-40] |
| `ModalBottomSheet.tsx` | In-repo | Native `<dialog>.showModal()` MD3 sheet with light-dismiss | `MealPlacementSheet`, `PlaceOnPlannerSheet`, `ListPickerSheet`, `PaymentEditSheet`, `ErrandSheet`. [VERIFIED: apps/web/src/components/ui/ModalBottomSheet.tsx:1-50] |
| `Toast.tsx` (`useToast`) | In-repo | Single-slot FIFO persistent snackbar queue with persistent Undo | Bill payment, payment deletion, chore completion, errand deletion, and meal removal. [VERIFIED: apps/web/src/components/ui/Toast.tsx:1-55] |
| `Card.tsx` | In-repo | MD3 borderless card (`surfaceContainerLow` elevation-1) | Subscriptions Hero card, ReadinessBreakdown progress card, Settings section cards. [VERIFIED: apps/web/src/components/ui/Card.tsx:1-35] |
| `SegmentedControl.tsx` | In-repo | Light-DOM MD3 Segmented Button (`role="radiogroup"`) | Meal slot picker (`Breakfast \| Lunch \| Dinner`), bill cadence, and view toggles. [VERIFIED: apps/web/src/components/ui/SegmentedControl.tsx:1-40] |
| `Switch.tsx` | In-repo | Typed `@material/web` `<md-switch>` wrapper | Bill autopay, bill recurrence, chore active state, and notification preference rows. [VERIFIED: apps/web/src/components/ui/Switch.tsx:1-30] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pushed `/settings/*` routes | Modal Bottom Sheets / Dialogs on `/settings` | Sheets cause excessive DOM nesting, lose browser back button history, and crowd small screens. Pushed routes provide clean URLs, deep-linking, and Top App Bar back navigation. |
| Direct inline row actions | Contextual 1-item OverflowMenu (`...`) | 1-item menus require two taps for a routine action (e.g., skip payment, delete errand) and create visual clutter. Direct inline action buttons with persistent Undo are faster and more accessible. |
| Planned-only agenda `<840px` | Explicit 3-slot empty rows per day | 3 empty rows across 7 days results in 21 empty boxes crowding mobile screens. Planned-only list with a compact "+ Plan meal" button per day keeps the agenda uncluttered. |

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@material/web` | npm | 3+ yrs | ~350k/wk | `github.com/material-components/material-web` | [OK] | Approved (already installed v2.5.0) |
| `@lit/react` | npm | 4+ yrs | ~1.5M/wk | `github.com/lit/lit` | [OK] | Approved (already installed v1.0.8) |
| `lucide-react` | npm | 3+ yrs | ~15M/wk | `github.com/lucide-icons/lucide` | [OK] | Legacy (being phased out in favor of `Icon.tsx`) |
| `radix-ui` | npm | 3+ yrs | ~8M/wk | `github.com/radix-ui/primitives` | [OK] | Legacy (being phased out in favor of MD3 primitives) |

**Packages removed due to [SLOP] verdict:** None  
**Packages flagged as suspicious [SUS]:** None  
*No new external runtime packages need to be installed for Phase 20. All required primitives and adapters exist in-repo or are available in the installed `@material/web@2.5.0` package.*

---

## Architecture Patterns

### System Architecture Diagram

```
+--------------------------------------------------------------------------------------------------+
|                                    HESTIA CLIENT APP SHELL                                       |
|                                                                                                  |
|  [ Top App Bar (Small, scroll-aware, owns single <h1> & Back Navigation) ]                        |
+--------------------------------------------------------------------------------------------------+
                                                 |
         +---------------------------------------+---------------------------------------+
         |                                       |                                       |
         v                                       v                                       v
+------------------+                   +------------------+                   +------------------+
|   MEALS PILLAR   |                   |   BILLS PILLAR   |                   |  CHORES PILLAR   |
|                  |                   |                  |                   |                  |
| <840px: Agenda   |                   | BillsIndexScreen |                   | ChoresListScreen |
|  - Planned-only  |                   |  - Overdue / Due |                   |  - Urgency list  |
|  - + Plan button |                   |  - Direct "Paid" |                   |  - Quick "Done"  |
|                  |                   |  - Zero 1-item   |                   |  - Undo Toast    |
| >=840px: 7-Col   |                   |    overflows     |                   |                  |
|  - Tonal board   |                   |                  |                   | ErrandsList      |
|  - Slot actions  |                   | Subscriptions    |                   |  - Filter chips  |
|                  |                   |  - 28px Spend    |                   |  - Direct delete |
| RecipeLibrary    |                   |    Hero Card     |                   |  - Collapsible   |
|  - Filter chips  |                   |                  |                   |    Completed(N)  |
|  - Tonal cards   |                   | BillDetailScreen |                   |                  |
|                  |                   |  - Tonal summary |                   | ChoreDetail      |
| RecipeDetail     |                   |  - Direct inline |                   |  - Single <h1>   |
|  - Readiness     |                   |    Delete/Edit   |                   |  - Rotation list |
+------------------+                   +------------------+                   +------------------+
         |                                       |                                       |
         +---------------------------------------+---------------------------------------+
                                                 |
                                                 v
                               +----------------------------------+
                               |         SETTINGS HUB             |
                               |                                  |
                               | /settings: Categorized <md-list> |
                               |   - Account  (/settings/account) |
                               |   - House    (/settings/house)   |
                               |   - Notif    (/settings/notif)   |
                               |   - System   (/settings/health)  |
                               |   - Depart   (/settings/depart)  |
                               +----------------------------------+
                                                 |
                   +-----------------------------+-----------------------------+
                   |                                                           |
                   v                                                           v
+--------------------------------------+                   +--------------------------------------+
|       RESPONSIVE MD3 DIALOGS         |                   |         MODAL BOTTOM SHEETS          |
|                                      |                   |                                      |
|  - RecipeForm (create / edit recipe) |                   |  - MealPlacementSheet / PlacePlanner |
|  - BillForm (create / edit bill)     |                   |  - MatchToSheet (Pantry | Deals)     |
|  - ChoreForm (create / edit chore)   |                   |  - ListPickerSheet (Checklist export)|
|  - StorePicker (<md-list> dialog)    |                   |  - PaymentEditSheet (Amount / date)  |
|  - ConfirmDialog (error-styled lock) |                   |  - ErrandSheet (Quick errand entry)  |
|                                      |                   |                                      |
| Mobile <600px: Full-screen canvas    |                   | Native <dialog>.showModal() top-layer|
| Desktop >=600px: Centered max-w-720  |                   | closedby="any" light dismiss         |
+--------------------------------------+                   +--------------------------------------+
```

### Recommended Project Structure

```
apps/web/src/
├── components/
│   ├── md/
│   │   ├── MdDialog.tsx            # [VERIFIED: apps/web/src/components/md/MdDialog.tsx:1-16]
│   │   ├── MdFab.tsx               # [VERIFIED: apps/web/src/components/md/MdFab.tsx:1-9]
│   │   ├── MdFilterChip.tsx        # [VERIFIED: apps/web/src/components/md/MdFilterChip.tsx:1-13]
│   │   └── MdSuggestionChip.tsx    # NEW: wraps @material/web/chips/suggestion-chip.js
│   ├── meals/
│   │   ├── PlannerDay.tsx          # Updated: scheduled-only rows, "+ Plan" button, slot actions
│   │   ├── RecipeCard.tsx          # Updated: borderless surfaceContainerLow Card + ReadinessRing
│   │   ├── ReadinessBreakdown.tsx  # Updated: tonal progress card + inline deal/pantry badges
│   │   ├── IngredientRow.tsx       # Updated: borderless list row + direct MatchToSheet trigger
│   │   ├── IngredientEditor.tsx    # Updated: borderless rapid row editor + Enter key navigation
│   │   ├── MealPlacementSheet.tsx  # Updated: ModalBottomSheet + MdSuggestionChip strip
│   │   ├── PlaceOnPlannerSheet.tsx # Updated: ModalBottomSheet + day pills + slot segmented control
│   │   ├── MatchToSheet.tsx        # Updated: ModalBottomSheet + Pantry | Deals tabbed search
│   │   └── ListPickerSheet.tsx     # Updated: ModalBottomSheet + missing ingredient checklist
│   ├── bills/
│   │   ├── BillRow.tsx             # Updated: direct one-tap "Mark Paid" button, ZERO overflow menus
│   │   ├── BillForm.tsx            # Updated: Responsive MD3 Dialog + <md-switch> toggles
│   │   ├── SubscriptionRow.tsx     # Updated: borderless list row + inline status badges
│   │   ├── PaymentHistory.tsx      # Updated: direct inline Delete / Edit actions (ZERO overflow menus)
│   │   └── PaymentEditSheet.tsx    # Updated: ModalBottomSheet for date & amount editing
│   ├── chores/
│   │   ├── ChoreListRow.tsx        # Updated: direct "Done" tonal icon button + Undo toast
│   │   ├── RotationEditor.tsx      # Updated: accessible tonal list with avatar switches + reorder
│   │   └── ChoreForm.tsx           # Updated: Responsive MD3 Dialog
│   ├── errands/
│   │   ├── ErrandRow.tsx           # Updated: direct trailing Delete icon (ZERO overflow menus)
│   │   └── ErrandSheet.tsx         # Updated: ModalBottomSheet for quick errand creation
│   └── ui/
│       ├── ModalBottomSheet.tsx    # [VERIFIED: apps/web/src/components/ui/ModalBottomSheet.tsx:1-50]
│       ├── Toast.tsx               # [VERIFIED: apps/web/src/components/ui/Toast.tsx:1-55]
│       ├── Switch.tsx              # [VERIFIED: apps/web/src/components/ui/Switch.tsx:1-30]
│       └── Card.tsx                # [VERIFIED: apps/web/src/components/ui/Card.tsx:1-35]
├── screens/
│   ├── meals/
│   │   ├── PlannerScreen.tsx       # Updated: compact week switcher, day pills, planned-only agenda
│   │   ├── RecipeLibraryScreen.tsx # Updated: Search Bar, filter chips, RecipeCard grid, MdFab
│   │   ├── RecipeDetailScreen.tsx  # Updated: single <h1>, ReadinessBreakdown, ListPickerSheet
│   │   └── RecipeForm.tsx          # Updated: Responsive MD3 Dialog
│   ├── bills/
│   │   ├── BillsIndexScreen.tsx    # Updated: Overdue/Upcoming/Inactive groups, MdFab, one-tap pay
│   │   ├── SubscriptionsScreen.tsx # Updated: 28px Display spend Hero Card + borderless list
│   │   └── BillDetailScreen.tsx    # Updated: summary card, PaymentHistory direct actions
│   ├── chores/
│   │   ├── ChoresListScreen.tsx    # Updated: urgency sections, quick Done, MdFab
│   │   ├── ChoreDetailScreen.tsx   # Updated: single <h1>, direct Edit & Delete actions
│   │   ├── ChoreFormScreen.tsx     # Updated: single <h1>, Responsive Dialog form
│   │   └── ErrandsListScreen.tsx   # Updated: store filter chips, MdFab, collapsible Completed (N)
│   └── settings/
│       ├── SettingsScreen.tsx      # Updated: categorized <md-list> hub navigating to sub-routes
│       ├── AccountRoute.tsx        # NEW: pushed /settings/account route
│       ├── HouseholdsRoute.tsx     # NEW: pushed /settings/households route
│       ├── NotificationsRoute.tsx  # NEW: pushed /settings/notifications route
│       ├── SystemHealthScreen.tsx  # Updated: borderless diagnostic list panel
│       ├── DepartureScreen.tsx     # Updated: single-column progressive flow + error ConfirmDialog
│       ├── FavoriteStores.tsx      # Updated: removable filter chips + MdList store picker dialog
│       └── NotificationTypes.tsx   # Updated: tonal device guidance card + grouped <Switch> rows
```

### Pattern 1: Responsive Form Dialog (RecipeForm, BillForm, ChoreForm)
**What:** Complex, multi-field creation and edit forms render inside an MD3 responsive dialog rather than occupying full pushed routes or narrow slide-up sheets. On mobile (`<600px`), the dialog fills the viewport (`100vw × 100vh`) with a fixed Top App Bar containing Close and Save actions. On desktop (`>=600px`), it renders as a centered wide modal dialog (`max-w-[720px]`) with backdrop light-dismiss.  
**When to use:** Dense forms with extensive child fields (`RecipeForm` with `IngredientEditor`, `BillForm` with recurrence preview, `ChoreForm` with `RotationEditor`).  
**Example:**
```tsx
// Source: MD3 Dialog Specification & apps/web/src/components/md/MdDialog.tsx
import { MdDialog } from '../../components/md/MdDialog.tsx';
import { Button } from '../../components/ui/Button.tsx';

export function ResponsiveFormDialog({
  open,
  title,
  onOpenChange,
  children,
  onSubmit,
  isSaving,
}: ResponsiveFormDialogProps): ReactElement {
  return (
    <MdDialog
      open={open}
      aria-label={title}
      className="md3-responsive-dialog w-full max-w-[720px]"
      onClosed={() => onOpenChange(false)}
    >
      <div slot="headline" className="text-title-lg font-semibold text-[var(--md-sys-color-on-surface)]">
        {title}
      </div>
      <div slot="content" className="flex flex-col gap-4 py-2">
        {children}
      </div>
      <div slot="actions" className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="primary" isLoading={isSaving} onClick={onSubmit}>
          Save
        </Button>
      </div>
    </MdDialog>
  );
}
```

### Pattern 2: Direct Inline Actions with Persistent Single-Slot Undo (Zero 1-Item Menus)
**What:** Reversible routine operations (marking bills paid, completing chores, deleting errands, deleting skipped payments) discard legacy 1-item overflow menus (`OverflowMenu` with only "Delete" or "Skip") in favor of direct trailing icon buttons with explicit `aria-label` and `min-h-12` touch targets. Every mutation immediately triggers an optimistic update paired with a persistent single-slot Undo toast via `useToast`.  
**When to use:** Bill payment on `BillRow`, chore checkoff on `ChoreListRow`, errand deletion on `ErrandRow`, payment deletion on `PaymentHistory`.  
**Example:**
```tsx
// Source: apps/web/src/components/ui/Toast.tsx
const toast = useToast();

const handleMarkPaid = (bill: Bill) => {
  payBill.mutate({ billId: bill.id }, {
    onSuccess: (payment) => {
      toast({
        variant: 'success',
        message: `Marked ${bill.name} as paid.`,
        action: {
          label: 'Undo',
          onAction: () => {
            deletePayment.mutate({ billId: bill.id, paymentId: payment.id });
          },
        },
      });
    },
  });
};
```

### Pattern 3: Categorized Settings Hub with Pushed Sub-Routes & Single `<h1>`
**What:** `/settings` transforms from a monolithic 6-section stacked form wall into a categorized navigation hub rendering a clean `<md-list>` of destination rows. Each row displays a leading Material Symbol, section title, and descriptive summary, pushing dedicated sub-routes (`/settings/account`, `/settings/households`, `/settings/notifications`, `/settings/system-health`). Each pushed screen integrates `useScreenChrome` to guarantee that the Top App Bar owns the single `<h1>` and provides accessible back navigation.  
**When to use:** Application configuration and preferences architecture (`SET-01`).  

### Anti-Patterns to Avoid
- **1-Item Overflow Menus:** Never render a 3-dot `<OverflowMenu>` whose popup menu contains only one action (e.g., just "Delete" or just "Skip"). Use direct inline buttons with persistent Undo.
- **Stacked Form Walls:** Never stack 6 full-length administrative forms on a single settings page. Use categorized hub rows navigating to focused sub-views.
- **Duplicate `<h1>` Tags:** Detail and form screens (`RecipeDetailScreen`, `ChoreDetailScreen`, `ChoreFormScreen`) must never render an in-page `<h1>`. The Top App Bar owns the route's single `<h1>` via `useScreenChrome`; page sub-headings use `<h2>` or card title typography.
- **Empty Agenda Slot Overload:** On mobile viewports (`<840px`), never render empty placeholder rows for Breakfast, Lunch, and Dinner across all 7 days (21 empty slots). Render only scheduled meals with a compact "+ Plan meal" button per day.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal Bottom Sheets | Custom fixed-position `<div>` with touch event handlers | `ModalBottomSheet.tsx` | Native `<dialog>.showModal()` ensures browser top-layer stacking, light dismiss, backdrop inertness, focus restoration, and accessibility. [VERIFIED: apps/web/src/components/ui/ModalBottomSheet.tsx:1-50] |
| Persistent Undo Queue | Custom setTimeout/clearTimeout state machine | `Toast.tsx` (`useToast`) | Single-slot FIFO queue handles non-overlapping snackbar presentation, infinite duration for action snackbars, and auto-dismiss on non-action toasts. [VERIFIED: apps/web/src/components/ui/Toast.tsx:45-55] |
| Toggle Controls | Custom button toggles with SVG sliders | `Switch.tsx` (`<md-switch>`) | `@material/web` switches provide native form association, touch ripple, exact checked/selected states, and ARIA switch semantics. [VERIFIED: apps/web/src/components/ui/Switch.tsx:1-30] |
| Segmented Buttons | Radio buttons styled with custom CSS | `SegmentedControl.tsx` | Provides light-DOM roving `Arrow`/`Home`/`End` focus, RTL support, and accessible selection for meal slots (`Breakfast \| Lunch \| Dinner`). [VERIFIED: apps/web/src/components/ui/SegmentedControl.tsx:1-40] |
| Suggestion Chips | Custom pill buttons with rounded borders | `MdSuggestionChip` (wrapping `@material/web/chips/suggestion-chip.js`) | Material 3 suggestion chips provide standard elevation, state layer ripples, and touch targets. [VERIFIED: @material/web@2.5.0] |

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data** | LocalStorage key `hestia.scanner_mode` [VERIFIED: apps/web/src/components/lists/BarcodeScannerDialog.tsx:26] | None — untouched by Phase 20 screens. |
| **Live service config** | None — verified across service configuration and database schemas. | None. |
| **OS-registered state** | Service Worker push event subscriptions in IndexedDB (`idb-keyval`) [VERIFIED: apps/web/src/lib/push/device-subscription.ts:1-30] | Maintained without alteration; `/settings/notifications` respects existing push tokens. |
| **Secrets/env vars** | `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` [VERIFIED: apps/web/scripts/check-build.mjs:26-40] | Preserved strictly in build check and routes. |
| **Build artifacts** | Precached routes in `apps/web/dist/` [VERIFIED: apps/web/vite.config.ts:68-103] | Re-generated upon `pnpm build` with new `/settings/*` lazy route chunks. |

---

## Common Pitfalls

### Pitfall 1: Dual `<h1>` Violations on Pushed Screens
**What goes wrong:** `RecipeDetailScreen`, `ChoreDetailScreen`, or `ChoreFormScreen` renders an `<h1>{title}</h1>` in the screen body while the Top App Bar simultaneously renders `<h1>` from `useScreenChrome({ title })`, triggering axe-core accessibility violations.  
**Why it happens:** Legacy screens managed their own headings before the Phase 18 adaptive shell centralized heading authority.  
**How to avoid:** Demote all screen-level headings to `<h2>` or card title typography (`text-title-md font-semibold`). Verify axe audits pass with zero duplicate `h1` violations.

### Pitfall 2: Window Size Class Mismatches (`<840px` vs `<600px`)
**What goes wrong:** Planner agenda erroneously switches between mobile agenda and 7-column board at `600px` (the NavigationBar threshold) instead of `840px` (the Expanded threshold), breaking 7-column layout on medium screens (tablets / foldables).  
**Why it happens:** Conflating Navigation Bar size class (`<600px`) with Content Grid size class (`>=840px`).  
**How to avoid:** Use `useMediaQuery('(min-width: 840px)')` explicitly for `PlannerScreen` board layout, while dialog full-screen presentation uses `<600px` (`useMediaQuery('(max-width: 599px)')`).

### Pitfall 3: Re-emergence of 1-Item Overflow Menus
**What goes wrong:** An engineer wraps a single action (e.g., "Skip" on a bill, "Delete" on an errand) inside an `<OverflowMenu>` to "keep the row clean", violating requirements `BILL-01` and `CHOR-02`.  
**Why it happens:** Defaulting to generic menu components rather than designing direct inline touch targets.  
**How to avoid:** Enforce direct inline icon buttons with 48×48dp targets and persistent Undo toasts. Lint or test against 1-item overflow menu instances.

### Pitfall 4: Material Web Shadow DOM Event Loss in jsdom Tests
**What goes wrong:** Vitest DOM tests dispatching React `fireEvent.click()` directly on `<md-switch>` or `<md-dialog>` hosts fail to trigger React `onChange` or update internal state.  
**Why it happens:** `@material/web` components encapsulate internal buttons and inputs inside Shadow DOM. React synthetic event bubbling does not always penetrate custom element shadow roots under jsdom.  
**How to avoid:** Use `apps/web/src/test/md-queries.ts` helpers (`findMdButton`, `findMdField`, `getMdButton`, `findMdDialog`) which target the inner shadow element and dispatch native events.

### Pitfall 5: Knip Baseline Drift on Deleted or Renamed Exports
**What goes wrong:** Renaming or removing components (e.g. deleting legacy `Sheet` imports or old copy strings) causes `pnpm knip` or `scripts/check-knip-baseline.mjs` to fail in CI.  
**Why it happens:** The repository maintains a strict 27-row Knip production baseline (`scripts/knip-production-baseline.txt`). Any change in unused production exports fails the ratchet.  
**How to avoid:** Run `node scripts/check-knip-baseline.mjs` locally whenever modifying exports or removing dead code, updating the baseline atomically if exports are retired.

---

## Code Examples

### Verified Pattern 1: Responsive Dialog for Multi-Field Forms
```tsx
// Source: apps/web/src/components/md/MdDialog.tsx & apps/web/src/screens/lists/ListNameSheet.tsx
import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { MdDialog } from '../../components/md/MdDialog.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Switch } from '../../components/ui/Switch.tsx';
import { TextField } from '../../components/ui/Field.tsx';

export function BillForm({ open, onOpenChange, onSubmit }: BillFormProps): ReactElement {
  const [name, setName] = useState('');
  const [autopay, setAutopay] = useState(false);

  return (
    <MdDialog
      open={open}
      aria-label="Add bill"
      onClosed={() => onOpenChange(false)}
      className="md3-responsive-dialog"
    >
      <div slot="headline" className="text-title-lg font-semibold text-[var(--md-sys-color-on-surface)]">
        Add bill
      </div>
      <form slot="content" className="flex flex-col gap-4 py-2" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <TextField label="Bill name" value={name} onChange={(e) => setName(e.target.value)} />
        <Switch label="Autopay" checked={autopay} onCheckedChange={setAutopay} />
      </form>
      <div slot="actions" className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="primary" type="submit" onClick={onSubmit}>Save bill</Button>
      </div>
    </MdDialog>
  );
}
```

### Verified Pattern 2: Direct Action with Persistent Single-Slot Undo
```tsx
// Source: apps/web/src/components/ui/Toast.tsx & apps/web/src/screens/bills/BillsIndexScreen.tsx
import { Button } from '../../components/ui/Button.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { useToast } from '../../components/ui/Toast.tsx';

export function BillRow({ bill, onPay, onDelete }: BillRowProps): ReactElement {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 min-h-12 border-b border-[var(--md-sys-color-outline-variant)]">
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-body font-semibold truncate text-[var(--md-sys-color-on-surface)]">{bill.name}</span>
        <span className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">{bill.formattedAmount} · Due {bill.dueDate}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          aria-label={`Mark paid, ${bill.name}`}
          onClick={() => onPay(bill)}
        >
          Mark paid
        </Button>
      </div>
    </li>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Radix UI Dialog & Sheet (`radix-ui`) | `@material/web` `<md-dialog>` & Native `<dialog>.showModal()` `ModalBottomSheet` | Phase 17 & Phase 19 | Standard top-layer browser stacking, zero external Radix runtime bloat, consistent MD3 token theming. |
| 1-Item Overflow Menus (`OverflowMenu` with single Delete/Skip item) | Direct inline icon button with persistent Undo toast (`toast.undo`) | Phase 20 (D-09, D-12, D-16) | Eliminates 2-tap friction on routine tasks, zero popup menu clipping issues. |
| Monolithic 6-section settings page | Categorized `<md-list>` hub navigating to pushed sub-routes (`/settings/*`) | Phase 20 (D-17) | Uncluttered view, preserves browser history, enables direct URL deep-linking, fixes heading hierarchy. |
| Triple-stacked mobile meal planning agenda | Planned-only agenda with day anchor pills and compact "+ Plan" button | Phase 20 (D-01) | Eliminates 21 empty slot placeholders crowding small screens. |
| `lucide-react` icons | Curated inline SVG `Icon.tsx` (Material Symbols Rounded) | Phase 17 (FND-03) | Zero external font dependencies, strict Caddy `'self'` CSP compatibility. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@material/web/chips/suggestion-chip.js` is available in `@material/web@2.5.0` for wrapping as `MdSuggestionChip`. | Standard Stack / MEAL-05 | Low — verified package exports custom elements; fallback to standard `<Button variant="secondary">` pills is trivial. |

---

## Open Questions

1. **Settings Hub About Section:**
   - *What we know:* `AboutSection` currently displays server version, Git commit hash, and sign-out button.
   - *Recommendation:* Keep the minimal version & sign-out information anchored at the bottom of the `/settings` hub, while deep diagnostics move to `/settings/system-health`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build & tests | ✓ | 24.13.6 [VERIFIED: package.json:7] | — |
| pnpm | Package management | ✓ | 10.34.5 [VERIFIED: package.json:5] | — |
| Vitest | Unit & DOM testing | ✓ | 5.0.1 [VERIFIED: apps/web/package.json:53] | — |
| Playwright | E2E testing | ✓ | 1.63.0 [VERIFIED: e2e/package.json:16] | — |
| Docker / Compose | E2E stack | ✓ | Available | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 (`unit` Node.js + `dom` jsdom) [VERIFIED: apps/web/vite.config.ts:112-150] |
| Config file | `apps/web/vite.config.ts` [VERIFIED: apps/web/vite.config.ts:1-164] |
| Quick run command | `pnpm --filter @hestia/web exec vitest run --project dom <test-path>` |
| Full suite command | `pnpm --filter @hestia/web test:coverage` |
| Coverage thresholds | Statements: 84%, Branches: 80%, Functions: 77%, Lines: 85% [VERIFIED: apps/web/vite.config.ts:161] |
| Playwright E2E command | `pnpm --filter @hestia/e2e test:e2e` [VERIFIED: e2e/package.json:9] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **MEAL-04** | Planned-only agenda `<840px`, 7-col board `>=840px`, compact week switch | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/meals/planner.test.tsx` | ✅ Exists |
| **MEAL-05** | `MealPlacementSheet` / `PlaceOnPlannerSheet` suggestion chips & slot selector | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/components/meals/MealPlacementSheet.test.tsx` | ✅ Exists |
| **MEAL-06** | Recipe library readiness filter, recipe detail readiness breakdown & checklist export | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/meals/recipe-detail.test.tsx src/screens/meals/recipe-library.test.tsx` | ✅ Exists |
| **BILL-01** | Bills list grouped sections, direct mark-paid with Undo toast, Subscriptions Hero card | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/bills/bills-index.test.tsx src/screens/bills/subscriptions.test.tsx` | ✅ Exists |
| **BILL-02** | `BillDetailScreen` payment history direct actions, `PaymentEditSheet`, `BillForm` dialog | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/bills/bill-detail.test.tsx` | ✅ Exists |
| **CHOR-01** | Chores list quick Done with next assignee toast, single `<h1>` detail, `RotationEditor` | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/components/chores/RotationEditor.test.tsx src/screens/chores/chores-offline-queue.test.tsx` | ✅ Exists |
| **CHOR-02** | Errands store filter chips, direct trailing Delete, collapsible Completed (N) | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/chores/errands.test.tsx src/screens/chores/errands-offline-queue.test.tsx` | ✅ Exists |
| **SET-01** | Categorized `<md-list>` Settings hub, pushed sub-routes, Top App Bar back nav | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/settings.test.tsx` | ✅ Exists |
| **SET-02** | Notification types `<md-switch>` controls with device guidance card, `FavoriteStores` chips | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/notification-types.test.tsx src/screens/deals/favorites.test.tsx` | ✅ Exists |
| **SET-03** | `SystemHealthScreen` diagnostics panel, `DepartureScreen` single-column reassignment | dom unit | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/system-health.test.tsx src/screens/settings/departure.test.tsx` | ✅ Exists |

### Sampling Rate
- **Per task commit:** `pnpm --filter @hestia/web exec vitest run --project dom <modified-screen-test>`
- **Per wave merge:** `pnpm --filter @hestia/web test:coverage && pnpm typecheck && pnpm lint`
- **Phase gate:** Full suite green, coverage >= 84/80/77/85, `check-build.mjs` <= 200 KB gzipped shell budget, zero Knip drift.

### Wave 0 Gaps
- None — existing test infrastructure in `apps/web/src/screens/` covers all 10 phase requirements.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| **V2 Authentication** | Yes | Session validation via `RequireSession` in `routes.tsx`; sign-out cleanly invalidates tokens. [VERIFIED: apps/web/src/routes.tsx:73] |
| **V3 Session Management** | Yes | Push subscription re-registration on login and removal on logout. [VERIFIED: apps/web/src/screens/settings/NotificationTypes.tsx:84-97] |
| **V4 Access Control** | Yes | Household RLS segregation; `SystemHealthScreen` guarded by `isServerOwner` check. [VERIFIED: apps/web/src/screens/settings/SystemHealthScreen.tsx:90-96] |
| **V5 Input Validation** | Yes | Zod schema validation on forms (`listNameSchema`, `householdNameSchema`, `postalCodeSchema`, price inputs). [VERIFIED: apps/web/src/screens/settings/HouseholdSettingsSection.tsx:51-54] |
| **V6 Cryptography** | No | Passwords and auth tokens managed by Supabase GoTrue; no client-side cryptography. |

### Known Threat Patterns for Web & Mobile UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Overdue Status Tampering | Tampering | Due dates, overdue calculations, and occurrence timestamps calculated from immutable server timestamps and verified in household timezone. |
| Insecure Direct Object Reference (IDOR) | Information Disclosure | All item mutations (bills, chores, meals) scoped strictly to authenticated `householdId` via RLS. |
| Unintended Reassignment on Departure | Denial of Service | `DepartureScreen` enforces explicit confirmation dialog with household name verification before executing member departure or household deletion. |

---

## Sources

### Primary (HIGH confidence)
- `@material/web@2.5.0` component definitions and custom element exports (`dialog`, `fab`, `chips`, `switch`, `list`). [VERIFIED: apps/web/package.json:22]
- `apps/web/vite.config.ts`: Vitest test projects, coverage thresholds (`84/80/77/85`), and inline Lit/Material Web deps. [VERIFIED: apps/web/vite.config.ts:112-162]
- In-repo UI Primitives: `ModalBottomSheet.tsx`, `Toast.tsx`, `Switch.tsx`, `Card.tsx`, `ListRow.tsx`, `SegmentedControl.tsx`. [VERIFIED: apps/web/src/components/ui/]
- In-repo Context & UI Spec: `20-CONTEXT.md`, `20-UI-SPEC.md`, `20-DISCUSSION-LOG.md`. [VERIFIED: .planning/phases/20-meals-bills-chores-settings-screens/]

### Secondary (MEDIUM confidence)
- Phase 17, 18, and 19 execution plans and test synchronization patterns in `.planning/phases/`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — fully verified against repository packages and working adapters.
- Architecture: HIGH — maps directly to user-approved decisions in `20-CONTEXT.md` and `20-UI-SPEC.md`.
- Pitfalls & Tests: HIGH — verified against existing test fixtures, jsdom setup, and CI ratchets.

**Research date:** 2026-11-15  
**Valid until:** End of Milestone v3.0