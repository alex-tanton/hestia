# Phase 19: Entry, Dashboard & Grocery Ecosystem Screens - Context

**Gathered:** 2026-11-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Overhaul Onboarding, Auth, Dashboard, Shared State blocks (`EmptyState`, `ErrorState`, `OfflineState`), Grocery Lists, Pantry, Barcode Scanner, Deals, and Flyers onto borderless MD3 tonal surfaces with progressive chip filtering, `<md-dialog>` prompts, lifted `AddToListSheet`, and persistent Undo Snackbars while updating affected unit and E2E selectors incrementally (`DASH-01`, `DASH-02`, `AUTH-06`, `AUTH-07`, `LIST-01`, `LIST-02`, `LIST-03`, `DEAL-06`, `DEAL-07`).

</domain>

<decisions>
## Implementation Decisions

### Dashboard & Shared State Blocks
- **D-01:** Implement `Dashboard` (`This Week`) as a 1–2 column grid of borderless `surfaceContainerLow` cards with at most 3 `<md-list-item>` preview rows per card. When a pillar has >3 active items, present the overflow via a dedicated card footer text button: `+N more in [Pillar]` linking directly to that pillar's route. — **Reversibility:** costly — touches dashboard card anatomy, routing links, and Playwright locator scoping.
- **D-02:** Sort and prioritize the 3 preview rows within each pillar card using **urgency-first ranking**: overdue items highlighted strictly with `error` semantic tokens at the top, followed by items due today, then items due next this week.
- **D-03:** Feature a warm tonal **`DashboardFirstRun` hero card** on empty first-run households presenting stepped quick-start pills ("Create a shopping list", "Add upcoming bill", "Plan first meal") to let new household members choose their initial action.
- **D-04:** Standardize `EmptyState`, `ErrorState`, and `OfflineState` blocks across routes and cards with **context-adaptive layout**: compact inline layout within cards (32dp Material Symbol, `bodyMedium` text, text button action) versus full-bleed centered column on full-page routes (48dp Material Symbol, `titleMedium` heading, filled/tonal button action).

### Grocery Lists, Store Grouping & Pantry Inventory
- **D-05:** Structure `ListDetailScreen` store-grouped items under **tonal `surfaceContainer` subheaders** with store name, item count badge (e.g., "Trader Joe's (4)"), and chevron collapse/expand toggle. — **Reversibility:** costly — affects grocery item list hierarchy, collapse persistence state, and test assertions.
- **D-06:** Transition checked grocery items into the collapsible `Bought (N)` section with smooth strikethrough animation, moving down to `Bought (N)` automatically while dispatching a **persistent Undo Snackbar** ("Marked as bought · [Undo]").
- **D-07:** Implement the Top App Bar overflow action "Add bought to pantry" by opening a **Review Modal Bottom Sheet** (`ItemSheet`/`SyncToPantrySheet`) with pre-filled storage categories and expiry estimates before committing items to the pantry.
- **D-08:** Structure `PantryScreen` inventory using **storage location filter chips** (`All`, `Fridge`, `Freezer`, `Pantry`) paired with an MD3 Search Bar, rendering items as borderless `<md-list>` rows with quantity and expiry indicator pills.
- **D-09:** Provide rapid grocery item addition in `ListDetailScreen` via a **persistent top quick-add input field** (Enter to add next item) alongside the floating `<md-fab>` which opens the full `ItemSheet` for rich attributes (quantity, unit, store, notes).
- **D-10:** Design `ItemSheet` store assignment with a **horizontal tonal chip strip of favorite/recent household stores** for single-tap selection, plus an `<md-outlined-select>` / autocomplete menu for all stores or adding a new store.
- **D-11:** Render multiple shopping lists in `ListsIndexScreen` as **borderless rich list rows** with store tag, progress badge (`4/12 bought`), last updated date, and Top App Bar / row overflow menu (Edit name, Archive, Delete).
- **D-12:** Highlight pantry item expiration dates with **tonal status badges** (`error` container strictly for expired items, `warning` container for items expiring soon within 3 days) paired with an "Expiring soon" quick-sort chip at the top.

### Barcode Scanner Dark HUD
- **D-13:** Restyle `BarcodeScannerDialog` as a dark-scheme MD3 Full-Screen Dialog with **continuous scanning and instant audio/haptic feedback**: camera remains live while items commit immediately.
- **D-14:** Handle unknown barcodes by sliding up an **in-HUD quick naming Modal Bottom Sheet** with an `<md-outlined-text-field>` ("Item name") and store/category chips, immediately saving and resuming scanner flow.
- **D-15:** Organize scanner HUD controls with a **balanced layout**: top bar with Close (`arrow_back`) and Flashlight (`torch`) icon buttons; center with targeting reticle; bottom floating container with `Add to list | Mark bought` Segmented Button and "Enter code manually" button.
- **D-16:** Manage rapid sequential barcode scans using a **batch counter persistent snackbar**: count updates ("Added 3 items · [Undo last]") with a "View scanned" action pill to review all scanned items in the session.

### Deals & Flyers Browsing
- **D-17:** Format `DealCard`s on compact mobile screens (`<600px`) as **single-column horizontal list cards**: 72×72dp product photo on the left, item title/store/dates in the middle, and bold price with single tonal discount badge (`-X%`) and `+ Add` icon button on the right. — **Reversibility:** costly — touches deal card component anatomy, image sizing, and test locators.
- **D-18:** Lift a single shared `AddToListSheet` per screen with **smart addition flow**: if the user has only 1 active list, add immediately with a persistent Undo Snackbar ("Added to [List] · [Undo]"); if multiple active lists exist, open `AddToListSheet` to choose list and adjust quantity.
- **D-19:** Structure `DealSearchScreen` filters with a top horizontal strip of quick filter chips (`Category`, `Discount threshold`, `Store`) alongside an "All filters (N)" chip opening the full Filter Modal Bottom Sheet.
- **D-20:** Present `FlyersScreen` store catalogs in a 2–4 column elevated MD3 card grid (store logo, cover preview thumbnail, valid dates, item count badge); tapping a card navigates to the dedicated `FlyerItemsScreen` route with Top App Bar back navigation and deal grid.

### Auth & Onboarding Cards (from Requirements)
- **D-21:** Standardize all unauthenticated auth screens (`/sign-in`, `/sign-up`, `/sign-in/link`, `/sign-in/code`, `/forgot-password`, `/set-password`) as centered tonal Surface Container cards (`max-w-[440px]`) with `<md-outlined-text-field>` inputs and MD3 buttons, preserving `MAGIC_LINK_COPY` and `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` gating (`AUTH-06`).
- **D-22:** Redesign `OnboardingLayout`, household `Create`/`Join` steps, and `InstallStep` using tonal MD3 action cards, single-field inputs, and clear guidance cards (`AUTH-07`).

### the agent's Discretion
- **Animation timing:** Subtle 200–300ms CSS transitions for grocery item strikethrough and move-to-bought reordering.
- **Barcode reticle styling:** Subtle corner-bracket aiming frame with warm terracotta pulsing scan line in the camera HUD.
- **Filter bottom sheet density:** Group categories and store toggles cleanly inside `FilterModalBottomSheet` using `<md-filter-chip>` wrap containers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Phase Specifications
- `.planning/PROJECT.md` — Milestone v3.0 goal, constraints, and tech stack boundaries
- `.planning/REQUIREMENTS.md` — Requirements `DASH-01`, `DASH-02`, `AUTH-06`, `AUTH-07`, `LIST-01`, `LIST-02`, `LIST-03`, `DEAL-06`, `DEAL-07`
- `.planning/ROADMAP.md` — Phase 19 goal, dependencies, and success criteria
- `.planning/STATE.md` — Project progress and accumulated decisions
- `.planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-CONTEXT.md` — Phase 17 foundation tokens, Icon.tsx, gap primitives, and snackbar queue
- `.planning/phases/18-adaptive-md3-navigation-shell-route-chrome/18-CONTEXT.md` — Phase 18 adaptive navigation shell, Top App Bar, single-`<h1>` architecture, and primary tabs

### Architecture & Design System Patterns
- `.planning/research/ARCHITECTURE.md` § Pattern 5 ("Route Cleanup & Screen Decomposition"), Pattern 6 ("Surface Elevation & Card Architecture"), Pattern 7 ("Complex Sheet Lifting & Dialog Decomposition")
- `.planning/research/PITFALLS.md` — Shadow DOM form validation, focus traps in `<md-dialog>`, camera polyfill in PWA context

### Existing Codebase Screens & Components
- `apps/web/src/screens/DashboardScreen.tsx` & `apps/web/src/components/dashboard/` — Current dashboard cards and first run component
- `apps/web/src/components/states/StateBlocks.tsx` — Current EmptyState, ErrorState, OfflineState implementations
- `apps/web/src/screens/onboarding/` — Sign-in, sign-up, magic link, and onboarding steps
- `apps/web/src/screens/lists/ListsIndexScreen.tsx` & `ListDetailScreen.tsx` & `PantryScreen.tsx` & `ArchivedListsScreen.tsx` — Current grocery and pantry screens
- `apps/web/src/components/lists/BarcodeScannerDialog.tsx` & `apps/web/src/lib/api/barcode-hooks.ts` — Current barcode scanner and camera polyfill
- `apps/web/src/screens/deals/DealSearchScreen.tsx`, `DealCard.tsx`, `FlyersScreen.tsx`, `FlyerItemsScreen.tsx`, `AddToList.tsx` — Current deals and flyers screens
- `apps/web/src/components/ui/ModalBottomSheet.tsx` & `apps/web/src/components/ui/Toast.tsx` — MD3 bottom sheet and persistent snackbar primitives
- `apps/web/src/components/ui/Icon.tsx` — Material Symbols icon registry

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/ui/ModalBottomSheet.tsx`: Native `<dialog>.showModal()` MD3 sheet for `ItemSheet`, `FilterModalBottomSheet`, `SyncToPantrySheet`, and quick naming.
- `apps/web/src/components/ui/Toast.tsx` (`useToast`): Persistent Undo snackbar queue with `action` support (`toast.undo("Marked as bought", onUndo)`).
- `apps/web/src/components/ui/Icon.tsx`: Material Symbols Rounded icons with `filled` prop support.
- `apps/web/src/components/ui/Checkbox.tsx`: MD3 checkbox with `variant="in-list"` full-row tap targets for grocery items.
- `apps/web/src/components/ui/Field.tsx` & `Button.tsx`: MD3 outlined text fields and buttons for auth and onboarding cards.

### Established Patterns
- Borderless cards: `surfaceContainerLow` flat tonal cards with zero 1px borders.
- Semantic color discipline: `error` tokens strictly reserved for overdue alerts and expired items; `warning` for items expiring soon; `primary` for actions and active indicators.
- Single-`<h1>` rule: Top App Bar owns the route `<h1>`; screen headings use `<h2>` or card title typography.
- Strict TypeScript & React 19: `exactOptionalPropertyTypes: true`, named exports, explicit return types, ESM `.tsx`/`.ts` imports.

### Integration Points
- `apps/web/src/routes.tsx` & `apps/web/src/screens/AuthenticatedLayout.tsx`: Mount points for dashboard, lists, deals, and onboarding routes.
- `apps/web/src/components/dashboard/DashboardCards.tsx`: Overhaul of individual pillar cards (BillsCard, ShoppingCard, MealsCard, ChoresCard).
- `e2e/`: Update Playwright selectors incrementally as screens transition to MD3 components.

</code_context>

<specifics>
## Specific Ideas

- **Persistent Top Quick-Add:** Typing an item name and pressing Enter directly in `ListDetailScreen` adds it to the list without opening a modal, while the FAB remains accessible for rich editing.
- **Batch Barcode Counter:** Fast pantry inventory scanning allows continuous scanning without dismissing the camera, displaying "Added 3 items · [Undo last]" above the bottom HUD.
- **Smart Deal Add:** If only 1 grocery list exists in the household, tapping `+ Add` on a deal adds it immediately with a persistent Undo snackbar rather than popping up a single-option list picker.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-entry-dashboard-grocery-ecosystem-screens*
*Context gathered: 2026-11-15*

