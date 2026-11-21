# Phase 20: Meals, Bills, Chores & Settings Screens - Context

**Gathered:** 2026-11-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Overhaul Meals/Recipes, Bills/Subscriptions, Chores/Errands, and Settings/System Health/Departure into uncluttered Material Design 3 workflows featuring a de-cluttered Planner, Full-Screen/Centered dialogs for multi-field forms, `<md-switch>` controls, zero 1-item overflow menus, and a categorized Settings hub while updating paired unit and E2E selectors (`MEAL-04`, `MEAL-05`, `MEAL-06`, `BILL-01`, `BILL-02`, `CHOR-01`, `CHOR-02`, `SET-01`, `SET-02`, `SET-03`).

</domain>

<decisions>
## Implementation Decisions

### Meals & Recipe Planning
- **D-01:** In `PlannerScreen` on mobile (`<840px`), render the 7-day agenda with scheduled meals only and a compact "+ Plan meal" button per day; empty days display an uncluttered indicator rather than empty placeholder rows (`MEAL-04`). — **Reversibility:** costly — touches agenda layout, day group styling, and Playwright locator scoping.
- **D-02:** Present `RecipeForm` (create/edit recipe) as a Responsive MD3 Dialog (Full-screen dialog on mobile `<600px`, centered wide dialog `max-w-[720px]` on desktop) to keep users in context without full route switching (`MEAL-06`). — **Reversibility:** costly — defines dialog wrapper, portal hierarchy, and route interception.
- **D-03:** Structure `IngredientEditor` inside `RecipeForm` as an inline rapid row editor with borderless rows for quantity, unit, and ingredient name, using the Enter key to advance to the next ingredient row and reorder controls (`MEAL-06`).
- **D-04:** In `RecipeDetailScreen`, exporting ingredients to grocery lists always opens `ListPickerSheet` with a checklist of missing ingredients and target list selector, allowing verification and deselecting items before addition (`MEAL-06`).
- **D-05:** When tapping "Plan this meal" in `RecipeDetailScreen`, open `PlaceOnPlannerSheet` to select day (mon–sun pills) and meal slot (Breakfast, Lunch, Dinner segmented button) with "Today" preselected (`MEAL-05`).
- **D-06:** In `RecipeDetailScreen`, visualize ingredient readiness using a tonal progress card with inline deal/pantry badges per ingredient row, where tapping opens `MatchToSheet` (`Pantry | Deals` tabs) (`MEAL-06`).
- **D-07:** In `MealPlacementSheet`, present quick meal shortcuts (`QUICK_SUGGESTIONS`: Takeout, Leftovers, etc.) as a horizontal `<md-suggestion-chip>` strip directly above the custom dish text input (`MEAL-05`).
- **D-08:** On expanded desktop screens (`>=840px`), render the 7-column Planner weekly board with click-to-open actions menu for accessible move/edit/remove meal actions (`MEAL-04`).

### Bills & Subscriptions
- **D-09:** On `BillsIndexScreen`, implement direct one-tap "Mark Paid" icon button on active bill rows that immediately records payment and triggers a persistent Undo Snackbar (`toast.undo`) (`BILL-01`). — **Reversibility:** costly — affects quick payment mutation, test assertions, and row action layout.
- **D-10:** On `SubscriptionsScreen`, format the Hero Card as a minimal monthly spend badge ("$X/month across N active services") without annualized projection, emphasizing clean simplicity (`BILL-01`).
- **D-11:** Present `BillForm` (create/edit bill or subscription) as a Responsive MD3 Dialog (Full-screen on mobile `<600px`, centered on desktop) using `<md-switch>` toggles for recurrence and autopay (`BILL-02`).
- **D-12:** On `BillDetailScreen`'s `PaymentHistory`, provide direct inline action buttons (direct Delete on skipped payments, tap on paid rows opens `PaymentEditSheet` to adjust amount/date) with persistent Undo Snackbar feedback (`BILL-02`).

### Chores Rotation & Errands
- **D-13:** On `ChoresListScreen`, tapping the quick "Done" tonal icon button immediately records completion, advances rotation, and triggers a persistent Undo toast announcing the next assignee: "Completed! Next up: [Name] · [Undo]" (`CHOR-01`). — **Reversibility:** costly — touches chore completion pipeline, toast payload, and offline queue synchronization.
- **D-14:** Present `ChoreForm` (create/edit chore) as a Responsive MD3 Dialog (Full-screen on mobile `<600px`, centered on desktop) maintaining consistency across all creation dialogs (`CHOR-01`).
- **D-15:** Structure `RotationEditor` inside `ChoreForm` as an accessible tonal `<md-list>` with per-member enable switches, avatars, and up/down turn order controls (`CHOR-01`).
- **D-16:** On `ErrandsListScreen`, provide store/category filter chips (`All`, `Hardware`, `Pharmacy`, etc.) at the top, a floating `<md-fab>` opening `ErrandSheet` Modal Bottom Sheet, direct trailing Delete with persistent Undo, and a collapsible `Completed (N)` section matching grocery `Bought (N)` (`CHOR-02`).

### Settings Hub Architecture
- **D-17:** Architect `SettingsScreen` as a categorized `<md-list>` hub navigating to pushed sub-routes (`/settings/account`, `/settings/households`, `/settings/notifications`, `/settings/system-health`) with Top App Bar back navigation and a single `<h1>` (`SET-01`). — **Reversibility:** costly — defines client-side routes, navigation stack, and test URLs.
- **D-18:** Manage household `FavoriteStores` via removable tonal filter chips with 'x' to remove, plus an "+ Add store" chip opening an `<md-list>` regional store picker dialog (`SET-02`).
- **D-19:** In `/settings/notifications`, present a top tonal device guidance card showing PWA install & Web Push permission status (with direct enable CTA if needed), followed by clean `<md-switch>` rows grouped by pillar (Deals, Chores, Bills) (`SET-02`).
- **D-20:** Design `DepartureScreen` as a progressive single-column flow with `<md-outlined-select>` reassignments for chores and bills, tonal `RotationNotes`, and an `error`-styled confirmation dialog requiring explicit confirmation to depart or delete (`SET-03`).

### the agent's Discretion
- **Dialog transition & animation:** Standard 150–200ms scale/fade transitions on desktop dialogs and slide-up on mobile dialogs.
- **Empty state illustrations:** Use Material Symbols (`restaurant`, `receipt_long`, `cleaning_services`, `inventory_2`) with `bodyMedium` copy in tonal cards.
- **Touch target sizing:** Ensure all icon buttons and row tap targets maintain at least 48×48dp (`min-h-12`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Phase Specifications
- `.planning/PROJECT.md` — Milestone v3.0 goal, constraints, and tech stack boundaries
- `.planning/REQUIREMENTS.md` — Requirements `MEAL-04`, `MEAL-05`, `MEAL-06`, `BILL-01`, `BILL-02`, `CHOR-01`, `CHOR-02`, `SET-01`, `SET-02`, `SET-03`
- `.planning/ROADMAP.md` — Phase 20 goal, dependencies, and success criteria
- `.planning/STATE.md` — Project progress and accumulated decisions
- `.planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-CONTEXT.md` — Phase 17 foundation tokens, Icon.tsx, gap primitives, and snackbar queue
- `.planning/phases/18-adaptive-md3-navigation-shell-route-chrome/18-CONTEXT.md` — Phase 18 adaptive navigation shell, Top App Bar, single-`<h1>` architecture, and primary tabs
- `.planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-CONTEXT.md` — Phase 19 card elevation, collapsible sections, and lifted sheets

### Existing Screens & Components to Overhaul
- `apps/web/src/screens/meals/PlannerScreen.tsx` & `apps/web/src/components/meals/PlannerDay.tsx` — Weekly meal planning agenda and board
- `apps/web/src/screens/meals/RecipeLibraryScreen.tsx` & `RecipeCard.tsx` — Recipe library and search/filtering
- `apps/web/src/screens/meals/RecipeDetailScreen.tsx` & `ReadinessBreakdown.tsx` — Recipe view, pantry/deal matching, and export
- `apps/web/src/screens/meals/RecipeForm.tsx` & `IngredientEditor.tsx` — Recipe creation and ingredient list editing
- `apps/web/src/components/meals/MealPlacementSheet.tsx` & `PlaceOnPlannerSheet.tsx` — Slot picker and custom item chips
- `apps/web/src/screens/bills/BillsIndexScreen.tsx` & `BillRow.tsx` — Active/upcoming/overdue bills list
- `apps/web/src/screens/bills/SubscriptionsScreen.tsx` & `SubscriptionRow.tsx` — Subscriptions list and total spend hero
- `apps/web/src/screens/bills/BillDetailScreen.tsx` & `PaymentHistory.tsx` & `PaymentEditSheet.tsx` — Bill details and payment history
- `apps/web/src/components/bills/BillForm.tsx` — Bill/subscription create/edit form
- `apps/web/src/screens/chores/ChoresListScreen.tsx` & `ChoreListRow.tsx` — Chores list and quick completion
- `apps/web/src/screens/chores/ChoreDetailScreen.tsx` & `CompletionHistory.tsx` — Chore details and completion history
- `apps/web/src/screens/chores/ChoreFormScreen.tsx` & `RotationEditor.tsx` — Chore creation and rotation configuration
- `apps/web/src/screens/chores/ErrandsListScreen.tsx` — Errands list and category filter
- `apps/web/src/screens/settings/SettingsScreen.tsx` & `SettingsRoute.tsx` — Settings hub and section navigation
- `apps/web/src/screens/settings/NotificationTypes.tsx` & `NotificationTypeRows.tsx` — Notification preferences and push status
- `apps/web/src/screens/settings/SystemHealthScreen.tsx` & `SystemHealthRoute.tsx` — Diagnostics panel
- `apps/web/src/screens/settings/DepartureScreen.tsx` & `DepartRoute.tsx` — Household departure and reassignment flow

### Design System Primitives
- `apps/web/src/components/ui/ModalBottomSheet.tsx` — Native `<dialog>.showModal()` sheet for placement and errand sheets
- `apps/web/src/components/ui/Toast.tsx` (`useToast`) — Persistent Undo snackbar queue (`toast.undo(...)`)
- `apps/web/src/components/ui/Icon.tsx` — Material Symbols Rounded icon registry
- `apps/web/src/components/ui/Field.tsx` & `Button.tsx` & `Switch.tsx` & `Checkbox.tsx` — MD3 core inputs and controls
- `apps/web/src/components/ui/SegmentedControl.tsx` — MD3 segmented button wrapper
- `apps/web/src/components/md/MdDialog.tsx` & `MdFab.tsx` — MD3 dialog and floating action button wrappers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/ui/ModalBottomSheet.tsx`: Accessible MD3 bottom sheet used for `MealPlacementSheet`, `PlaceOnPlannerSheet`, `ListPickerSheet`, `PaymentEditSheet`, and `ErrandSheet`.
- `apps/web/src/components/ui/Toast.tsx`: Persistent Undo snackbar queue for bill payments, chore completions, and errand deletions.
- `apps/web/src/components/ui/Switch.tsx`: Clean `@material/web` switch wrapper for bill autopay, recurrence, chore active state, and notification types.
- `apps/web/src/components/ui/SegmentedControl.tsx`: Used for meal slot selection (`Breakfast | Lunch | Dinner`).
- `apps/web/src/components/md/MdFab.tsx`: Floating action buttons for adding meals, bills, chores, and errands.

### Established Patterns
- Borderless cards: `surfaceContainerLow` flat tonal cards with zero 1px borders.
- Semantic color discipline: `error` tokens strictly reserved for overdue alerts, expired items, and destructive confirmations.
- Single-`<h1>` rule: Top App Bar owns the route `<h1>`; screen headings use `<h2>` or card title typography.
- Persistent Undo: Single-slot FIFO queue for reversible mutations without blocking confirmation modals.
- Responsive Dialogs: Full-screen `<md-dialog>` on mobile (`<600px`), centered wide `<md-dialog>` on desktop (`>=600px`).

### Integration Points
- Routes in `apps/web/src/App.tsx` and nested screen routers (`SettingsRoute.tsx`, `MealsRoute.tsx`, `BillsRoute.tsx`, `ChoresRoute.tsx`).
- React Query invalidation hooks (`useBills`, `useChores`, `usePlannerWeek`, `useRecipes`).
- Offline write queue replay in `apps/web/src/lib/offline/`.

</code_context>

<specifics>
## Specific Ideas

- **Planner Agenda:** Clean planned-only list where each day with scheduled meals shows compact rows, and an empty day is just a subtle line with a small "+ Plan" icon button.
- **Subscriptions Hero:** Minimal monthly stat badge ("$X/month across N active services") keeping the header focused and light.
- **Chore Completion Toast:** Immediate checkoff with toast feedback: "Completed! Next up: [Name] · [Undo]" so users know the rotation advanced properly.
- **Settings Sub-Routes:** Pushed sub-pages with browser history and Top App Bar back button, rather than burying complex configurations in deep sheets.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-Meals, Bills, Chores & Settings Screens*
*Context gathered: 2026-11-15*
