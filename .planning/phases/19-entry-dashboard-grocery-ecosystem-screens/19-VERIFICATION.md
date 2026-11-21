---
phase: 19-entry-dashboard-grocery-ecosystem-screens
verified: 2026-11-15T07:22:00Z
status: human_needed
score: 29/29 must-haves verified
covered_files:
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-01-PLAN.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-01-SUMMARY.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-02-PLAN.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-02-SUMMARY.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-03-PLAN.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-03-SUMMARY.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-04-PLAN.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-04-SUMMARY.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-05-PLAN.md
  - .planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-05-SUMMARY.md
  - apps/web/src/components/dashboard/DashboardCard.tsx
  - apps/web/src/components/dashboard/DashboardCards.tsx
  - apps/web/src/components/dashboard/DashboardFirstRun.tsx
  - apps/web/src/components/dashboard/dashboard.test.tsx
  - apps/web/src/components/lists/BarcodeScannerDialog.test.tsx
  - apps/web/src/components/lists/BarcodeScannerDialog.tsx
  - apps/web/src/components/lists/ItemSheet.tsx
  - apps/web/src/components/lists/ShoppingListRow.tsx
  - apps/web/src/components/lists/StoreGroupHeader.tsx
  - apps/web/src/components/lists/SyncToPantrySheet.tsx
  - apps/web/src/components/md/MdFab.tsx
  - apps/web/src/components/states/StateBlocks.test.tsx
  - apps/web/src/components/states/StateBlocks.tsx
  - apps/web/src/screens/DashboardScreen.tsx
  - apps/web/src/screens/dashboard-route.test.tsx
  - apps/web/src/screens/deals/AddToListSheet.tsx
  - apps/web/src/screens/deals/DealCard.tsx
  - apps/web/src/screens/deals/DealFreshness.tsx
  - apps/web/src/screens/deals/DealSearchScreen.tsx
  - apps/web/src/screens/deals/FlyerItemsScreen.tsx
  - apps/web/src/screens/deals/FlyersScreen.tsx
  - apps/web/src/screens/deals/deal-card.test.tsx
  - apps/web/src/screens/deals/deal-search.test.tsx
  - apps/web/src/screens/deals/flyers.test.tsx
  - apps/web/src/screens/lists/ListDetailScreen.test.tsx
  - apps/web/src/screens/lists/ListDetailScreen.tsx
  - apps/web/src/screens/lists/ListNameSheet.tsx
  - apps/web/src/screens/lists/ListsIndexScreen.tsx
  - apps/web/src/screens/lists/PantryScreen.tsx
  - apps/web/src/screens/lists/lists.test.tsx
  - apps/web/src/screens/onboarding/CreateHouseholdStep.tsx
  - apps/web/src/screens/onboarding/ForgotPasswordScreen.tsx
  - apps/web/src/screens/onboarding/InstallStep.tsx
  - apps/web/src/screens/onboarding/JoinHouseholdStep.tsx
  - apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx
  - apps/web/src/screens/onboarding/MagicLinkRequestScreen.tsx
  - apps/web/src/screens/onboarding/OnboardingLayout.tsx
  - apps/web/src/screens/onboarding/SetPasswordScreen.tsx
  - apps/web/src/screens/onboarding/SignInScreen.tsx
  - apps/web/src/screens/onboarding/SignUpScreen.tsx
  - apps/web/src/screens/onboarding/magic-link.test.tsx
  - apps/web/src/screens/onboarding/onboarding.test.tsx
covered_digest: "v3:sha256:e264d94b72054cb3424c6e4b45dbd7ac1d9e318a9f5572543c055ebb6f59a6fb"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Real mobile camera barcode scan & flashlight HUD test"
    expected: "When tapping 'Scan barcode' in /lists/[id] on a mobile device, the dark HUD (#1A110E) opens, camera reticle acquires feed, flashlight button turns on physical LED, pointing at a product barcode chimes audio and haptic feedback, and continuous scanning updates persistent snackbar 'Added N items · [Undo last]'."
    why_human: "jsdom and headless test environments mock MediaDevices, video track torch constraints, Web Audio, and Vibration APIs; hardware camera decoding requires a physical mobile device."
  - test: "Visual verification of MD3 borderless tonal surfaces and responsive grid layouts"
    expected: "Dashboard shows 1 column on <600px and 2 columns on >=600px; flyers show 2–4 column elevated cards; Auth screens center in 440px tonal cards; List rows render borderless with subtle separator hierarchy."
    why_human: "CSS media query breakpoint behavior, typography proportions, and visual surface contrast require in-browser inspection."
---

# Phase 19: Entry, Dashboard & Grocery Ecosystem Screens Verification Report

**Phase Goal:** Overhaul Onboarding, Auth, Dashboard, Shared State blocks, Grocery Lists, Pantry, Barcode Scanner, Deals, and Flyers onto borderless MD3 tonal surfaces with progressive chip filtering, `<md-dialog>` prompts, lifted `AddToListSheet`, and persistent Undo Snackbars while updating affected unit and E2E selectors incrementally.  
**Verified:** 2026-11-15T07:22:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification  

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EmptyState, ErrorState, and OfflineState adapt to card vs page layout context, replacing lucide-react with Icon.tsx (D-04, DASH-02) | ✓ VERIFIED | `StateBlocks.tsx` uses MD3 tokens, `layout="card" \| "page"`, `Icon.tsx` (Material Symbols Rounded), 0 lucide imports. All 6 tests pass in `StateBlocks.test.tsx`. |
| 2 | DashboardCard renders borderless surfaceContainerLow flat tonal cards with at most 3 preview rows, with overdue items ranked first using error semantic tokens (D-01, D-02, DASH-01) | ✓ VERIFIED | `DashboardCard.tsx` uses `variant="flat"`, `bg-surface-container-low`, `sortPillarItems` ranking overdue items first with `text-error`. Passed in `dashboard.test.tsx` (14/14) and `dashboard-route.test.tsx` (11/11). |
| 3 | When a pillar has >3 items, card footer presents a dedicated text button "+N more in [Pillar]" linking to the pillar route (D-01, DASH-01) | ✓ VERIFIED | `DashboardCard.tsx:128` renders `+{remainder} more in {title}` as a `<Link to={path}>` inside the card footer. |
| 4 | DashboardFirstRun renders a warm tonal surfaceContainerLow hero card with quick-start action pills on empty first-run households (D-03, DASH-01) | ✓ VERIFIED | `DashboardFirstRun.tsx` renders `col-span-full` hero card with "Create a shopping list", "Add upcoming bill", and "Plan first meal" pills. Verified in `dashboard.test.tsx`. |
| 5 | DashboardScreen presents a responsive 1-2 column grid of pillar cards (1 col on <600px, 2 col on >=600px) (D-01, DASH-01) | ✓ VERIFIED | `DashboardScreen.tsx:56` uses `grid grid-cols-1 md:grid-cols-2 gap-4`. Tested in `dashboard.test.tsx`. |
| 6 | Auth screens render inside centered tonal surfaceContainer cards (max-w-[440px]) with MdOutlinedTextField inputs and filled buttons (D-21, AUTH-06) | ✓ VERIFIED | `SignInScreen.tsx`, `SignUpScreen.tsx`, `MagicLinkRequestScreen.tsx`, `MagicLinkCodeScreen.tsx`, `ForgotPasswordScreen.tsx`, and `SetPasswordScreen.tsx` use `Card` (`max-w-[440px]`, `bg-surface-container`) and `TextField` wrapping `MdOutlinedTextField`. 47 tests pass in `onboarding.test.tsx` and `magic-link.test.tsx`. |
| 7 | MAGIC_LINK_COPY 'Email me a sign-in link' and HESTIA_PUBLIC_MAGIC_LINK_ENABLED gating are preserved exactly in SignInScreen (D-21, AUTH-06) | ✓ VERIFIED | `SignInScreen.tsx:106,123` preserves exact string and `import.meta.env.HESTIA_PUBLIC_MAGIC_LINK_ENABLED === 'true'` gating. `check-build.mjs` verifies shell budget (155.7 KB <= 200 KB) and copy contracts. |
| 8 | OnboardingLayout renders an MD3 frame with Icon name="arrow_back" and display typography (D-22, AUTH-07) | ✓ VERIFIED | `OnboardingLayout.tsx:49,56` uses `Icon name="arrow_back"`, `text-display font-semibold`, and single-slot layout. |
| 9 | CreateHouseholdStep and JoinHouseholdStep use single-field MdOutlinedTextField inputs inside tonal action cards (D-22, AUTH-07) | ✓ VERIFIED | `CreateHouseholdStep.tsx` and `JoinHouseholdStep.tsx` render centered 440px tonal cards with `TextField` and CTA buttons "Create household group" / "Join household group". |
| 10 | InstallStep renders an MD3 guidance card with share and smartphone Material Symbols (D-22, AUTH-07) | ✓ VERIFIED | `InstallStep.tsx:40,60` renders `Icon name="share"` and `Icon name="smartphone"` in centered tonal guidance cards. |
| 11 | ListDetailScreen renders store-grouped items under tonal surfaceContainer StoreGroupHeaders with store name, count badge, and chevron toggle (D-05, LIST-02) | ✓ VERIFIED | `StoreGroupHeader.tsx` renders sticky `bg-surface-container` subheaders with `Icon name="expand_more"` / `"expand_less"`, count badge, and subtotal. Verified in `ListDetailScreen.test.tsx` and `lists.test.tsx`. |
| 12 | Checked items move down into a collapsible Bought (N) section with smooth strikethrough animation and persistent Undo Snackbar (D-06, LIST-02) | ✓ VERIFIED | `ListDetailScreen.tsx:463` renders collapsible `Bought (${String(detail.bought.length)})` section; `ShoppingListRow.tsx` applies `line-through` and `opacity-60`. Persistent Undo snackbar verified in `ListDetailScreen.test.tsx`. |
| 13 | Top quick-add input field in ListDetailScreen enables rapid item addition on Enter, alongside floating MdFab for rich ItemSheet (D-09, LIST-01) | ✓ VERIFIED | `ListDetailScreen.tsx` quick-add input captures Enter key; `MdFab` renders floating action button opening `ItemSheet`. Verified in `ListDetailScreen.test.tsx`. |
| 14 | ListNameSheet is implemented as a basic MdDialog for list creation and renaming (D-11, LIST-01) | ✓ VERIFIED | `ListNameSheet.tsx` uses `MdDialog` with `slot="headline"`, `slot="content"`, `slot="actions"`, and handles Escape and form submit. Tested in `lists.test.tsx`. |
| 15 | ItemSheet provides a horizontal tonal chip strip of favorite/recent stores for single-tap selection (D-10, LIST-02) | ✓ VERIFIED | `ItemSheet.tsx:69-72` computes `availableStores` and renders horizontal `MdFilterChip` strip. Tested in `lists.test.tsx`. |
| 16 | PantryScreen organizes inventory with storage location chips (All, Fridge, Freezer, Pantry) and expiry status badges (D-08, D-12, LIST-01) | ✓ VERIFIED | `PantryScreen.tsx:34-40` renders `MdFilterChip` row for location filtering and shelf-life expiry status calculation (`getExpiryStatus`). Tested in `lists.test.tsx`. |
| 17 | Top App Bar overflow action 'Add bought to pantry' opens SyncToPantrySheet Review Modal Bottom Sheet (D-07, LIST-01) | ✓ VERIFIED | `ListDetailScreen.tsx:569` registers 'Add bought to pantry' in overflow menu opening `SyncToPantrySheet`. Tested in `ListDetailScreen.test.tsx`. |
| 18 | BarcodeScannerDialog restyles as a dark-scheme MD3 Full-Screen Dialog (bg-[#1A110E]) with top action bar, targeting reticle, and bottom controls (D-13, D-15, LIST-03) | ✓ VERIFIED | `BarcodeScannerDialog.tsx:339` renders native `<dialog>` full-screen container with `bg-[#1A110E]`, reticle box, torch toggle, and bottom HUD controls. Tested in `BarcodeScannerDialog.test.tsx`. |
| 19 | Camera MediaStream tracks are stopped completely upon dialog dismissal or tab switch, preventing device battery drain and active privacy indicators (D-13, LIST-03) | ✓ VERIFIED | `BarcodeScannerDialog.tsx:125,182` stops all `streamRef.current.getTracks()` on unmount, dialog close, and `visibilitychange`. Tested in `BarcodeScannerDialog.test.tsx`. |
| 20 | Scanning operates continuously without camera teardown, triggering instant audio and haptic feedback on successful barcode commit (D-13, LIST-03) | ✓ VERIFIED | `BarcodeScannerDialog.tsx:100,210` invokes `playScanChime()` and `triggerScanHaptic()` with continuous loop. Tested in `BarcodeScannerDialog.test.tsx`. |
| 21 | Unknown barcodes slide up an in-HUD quick naming Modal Bottom Sheet with TextField and category chips, resuming scanning immediately on submit (D-14, LIST-03) | ✓ VERIFIED | `BarcodeScannerDialog.tsx:507` opens in-HUD `ModalBottomSheet` for unknown barcodes; Escape dismisses sub-sheet before HUD. Tested in `BarcodeScannerDialog.test.tsx`. |
| 22 | Continuous batch scans update a persistent Undo snackbar 'Added N items · [Undo last]' with a 'View scanned' action pill (D-16, LIST-03) | ✓ VERIFIED | `BarcodeScannerDialog.tsx:100` dispatches `toast` with batch counter and `handleUndoLastScan`. Tested in `BarcodeScannerDialog.test.tsx`. |
| 23 | SegmentedControl toggles between 'Add to list' and 'Mark bought' modes seamlessly (D-15, LIST-03) | ✓ VERIFIED | `BarcodeScannerDialog.tsx:444` uses `SegmentedControl` syncing with localStorage key `hestia.scanner_mode`. Tested in `BarcodeScannerDialog.test.tsx`. |
| 24 | DealCard renders a compact single-column horizontal card on mobile (<600px): 72x72 photo on left, title/store in middle, bold price with single tonal -X% badge and + Add icon button on right (D-17, DEAL-07) | ✓ VERIFIED | `DealCard.tsx` renders 72x72 `DealImage`, title/merchant middle, unit price, `-X%` badge, and circular `+ Add` button. Tested in `deal-card.test.tsx` (23/23). |
| 25 | DealSearchScreen lifts a single shared AddToListSheet instance at screen root, eliminating per-card Sheet instances (D-18, DEAL-07) | ✓ VERIFIED | `DealSearchScreen.tsx:437` renders single root `AddToListSheet`; individual `DealCard`s invoke `onAdd(deal)` callback. Tested in `deal-search.test.tsx`. |
| 26 | Tapping + Add on a deal with exactly 1 active list adds immediately with a persistent Undo Snackbar ('Added deal to list · [Undo]') (D-18, DEAL-07) | ✓ VERIFIED | `DealSearchScreen.tsx:163` checks `activeLists.length === 1` and dispatches immediate add with undo toast `{ listId: list.id, itemId: data.id }`. Tested in `deal-search.test.tsx`. |
| 27 | DealSearchScreen features an MD3 Search Bar, Favorites \| All stores SegmentedControl, quick filter chips, and FilterModalBottomSheet (D-19, DEAL-06) | ✓ VERIFIED | `DealSearchScreen.tsx:220-330` provides Search input, `SegmentedControl`, `MdFilterChip` row, and `ModalBottomSheet` filter sheet. Tested in `deal-search.test.tsx` (15/15). |
| 28 | FlyersScreen presents store catalogs in a 2-4 column elevated MD3 card grid with flyer cover thumbnail and item count badge (D-20, DEAL-07) | ✓ VERIFIED | `FlyersScreen.tsx:128,133` renders `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` with `variant="raised"` elevated cards, cover image, and item count badge. Tested in `flyers.test.tsx`. |
| 29 | FlyerItemsScreen presents pushed flyer items with Top App Bar back navigation and integrated screen-level AddToListSheet (D-20, DEAL-07) | ✓ VERIFIED | `FlyerItemsScreen.tsx:184` integrates screen-level `AddToListSheet` and synchronizes with `TopBar` back button. Tested in `flyers.test.tsx` (15/15). |

**Score:** 29/29 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `apps/web/src/components/states/StateBlocks.tsx` | Context-adaptive EmptyState, ErrorState, OfflineState | ✓ VERIFIED | Substantive (180 lines), MD3 tokens, card/page layout, 0 lucide imports. |
| `apps/web/src/components/states/StateBlocks.test.tsx` | Unit tests for adaptive state blocks | ✓ VERIFIED | Substantive (140 lines), 6/6 tests passing in Vitest. |
| `apps/web/src/components/dashboard/DashboardCard.tsx` | Borderless flat tonal surfaceContainerLow cards with max 3 rows and urgency ranking | ✓ VERIFIED | Substantive (197 lines), `variant="flat"`, urgency-first sorting, "+N more" link. |
| `apps/web/src/components/dashboard/DashboardCards.tsx` | Specific pillar cards (Bills, Lists, Meals, Chores) | ✓ VERIFIED | Substantive (43 lines), maps pillar status to card states. |
| `apps/web/src/components/dashboard/DashboardFirstRun.tsx` | Warm tonal surfaceContainerLow hero card with quick-start action pills | ✓ VERIFIED | Substantive (62 lines), `col-span-full`, 3 quick-start pills. |
| `apps/web/src/screens/DashboardScreen.tsx` | Responsive 1-2 column grid for This Week dashboard | ✓ VERIFIED | Substantive (68 lines), `grid-cols-1 md:grid-cols-2 gap-4`. |
| `apps/web/src/screens/onboarding/OnboardingLayout.tsx` | MD3 single-column frame with back navigation and display typography | ✓ VERIFIED | Substantive (70 lines), `Icon name="arrow_back"`, `text-display`. |
| `apps/web/src/screens/onboarding/SignInScreen.tsx` | Centered 440px tonal card with MdOutlinedTextField and magic link preservation | ✓ VERIFIED | Substantive (145 lines), exact `MAGIC_LINK_COPY`, gating preserved. |
| `apps/web/src/screens/onboarding/SignUpScreen.tsx` | Centered 440px tonal card for registration | ✓ VERIFIED | Substantive (142 lines), password rule, timezone detection. |
| `apps/web/src/screens/onboarding/MagicLinkRequestScreen.tsx` | Magic link request step in tonal card | ✓ VERIFIED | Substantive (168 lines), live region, rate limit handling. |
| `apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx` | 6-digit code entry step in tonal card | ✓ VERIFIED | Substantive (184 lines), auto-advance, verification error handling. |
| `apps/web/src/screens/onboarding/ForgotPasswordScreen.tsx` | Forgot password request step | ✓ VERIFIED | Substantive (38 lines), links to reset flow. |
| `apps/web/src/screens/onboarding/SetPasswordScreen.tsx` | New password creation step | ✓ VERIFIED | Substantive (141 lines), token validation, single-field entry. |
| `apps/web/src/screens/onboarding/CreateHouseholdStep.tsx` | Household creation action card with postal code and timezone | ✓ VERIFIED | Substantive (123 lines), `TextField` postal code validation. |
| `apps/web/src/screens/onboarding/JoinHouseholdStep.tsx` | Household join action card with invite code validation | ✓ VERIFIED | Substantive (170 lines), normalized code input, expired invite copy. |
| `apps/web/src/screens/onboarding/InstallStep.tsx` | PWA installation guidance card with Material Symbols | ✓ VERIFIED | Substantive (96 lines), `Icon name="share"` and `Icon name="smartphone"`. |
| `apps/web/src/components/lists/ShoppingListRow.tsx` | Borderless list row with in-list Checkbox, strikethrough, and price badges | ✓ VERIFIED | Substantive (141 lines), `Checkbox variant="in-list"`, `opacity-60 bg-surface-container-low`. |
| `apps/web/src/components/lists/StoreGroupHeader.tsx` | Sticky tonal surfaceContainer store group headers | ✓ VERIFIED | Substantive (84 lines), merchant title, item count badge, subtotal, chevron. |
| `apps/web/src/screens/lists/ListNameSheet.tsx` | List creation and renaming basic MdDialog | ✓ VERIFIED | Substantive (133 lines), `MdDialog` prompt with slots and autofocus. |
| `apps/web/src/components/lists/ItemSheet.tsx` | Quick-add and edit ModalBottomSheet with store chip strip | ✓ VERIFIED | Substantive (250 lines), `availableStores` derivation, `MdFilterChip` store strip. |
| `apps/web/src/components/lists/SyncToPantrySheet.tsx` | Add bought to pantry review ModalBottomSheet | ✓ VERIFIED | Substantive (151 lines), category prediction and expiry calculation. |
| `apps/web/src/screens/lists/ListDetailScreen.tsx` | Grocery list detail screen with store groups, collapsible bought, quick-add, and FAB | ✓ VERIFIED | Substantive (690 lines), `MdFab`, quick-add on Enter, persistent Undo toasts. |
| `apps/web/src/screens/lists/ListsIndexScreen.tsx` | Shopping lists index with active and archived lists | ✓ VERIFIED | Substantive (286 lines), `MdFab` creation, delete dialog confirmation. |
| `apps/web/src/screens/lists/PantryScreen.tsx` | Pantry inventory screen with location chips and expiry tracking | ✓ VERIFIED | Substantive (392 lines), `MdFilterChip` storage filters (Fridge, Freezer, Pantry). |
| `apps/web/src/components/md/MdFab.tsx` | Lit `@material/web/fab/fab.js` React wrapper | ✓ VERIFIED | Substantive (9 lines), `@lit/react` wrapper for FAB actions. |
| `apps/web/src/components/lists/BarcodeScannerDialog.tsx` | MD3 dark-scheme (#1A110E) Full-Screen Dialog with continuous HUD | ✓ VERIFIED | Substantive (601 lines), reticle, torch toggle, camera lifecycle cleanup, in-HUD naming sheet. |
| `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` | Unit tests for BarcodeScannerDialog | ✓ VERIFIED | Substantive (288 lines), 9/9 tests passing in Vitest. |
| `apps/web/src/screens/deals/DealCard.tsx` | Compact horizontal card with 72x72 photo, price, -X% badge, + Add button | ✓ VERIFIED | Substantive (91 lines), `onAdd(deal)` callback, lifted sheet integration. |
| `apps/web/src/screens/deals/AddToListSheet.tsx` | Lifted screen-level bottom sheet for adding deals to shopping lists | ✓ VERIFIED | Substantive (166 lines), list picker, persistent Undo snackbar. |
| `apps/web/src/screens/deals/DealSearchScreen.tsx` | Deal search screen with MD3 search, segmented control, filter sheet, and lifted AddToListSheet | ✓ VERIFIED | Substantive (454 lines), `SegmentedControl`, `MdFilterChip` row, 1-list immediate add. |
| `apps/web/src/screens/deals/DealFreshness.tsx` | Compact tonal surfaceContainerLow freshness and stale banner | ✓ VERIFIED | Substantive (74 lines), schedule and refresh icons, retry button. |
| `apps/web/src/screens/deals/FlyersScreen.tsx` | Store flyers screen with 2-4 column elevated MD3 card grid | ✓ VERIFIED | Substantive (174 lines), `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`, cover image, item badge. |
| `apps/web/src/screens/deals/FlyerItemsScreen.tsx` | Flyer items screen with category filter, search, and lifted AddToListSheet | ✓ VERIFIED | Substantive (201 lines), shared `AddToListSheet` integration. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `StateBlocks.tsx` | `Icon.tsx` | Material Symbols Rounded name mapping | ✓ WIRED | Imports `Icon`, `IconName` and renders 24dp, 32dp, 48dp icons without Lucide dependencies. |
| `DashboardCard.tsx` | `DashboardCards.tsx` / `DashboardScreen.tsx` | `sortPillarItems` & Card mapping | ✓ WIRED | Calls `sortPillarItems`, maps top 3 items, and links to pillar route with `+{remainder} more in {title}`. |
| `DashboardScreen.tsx` | `DashboardFirstRun.tsx` | Empty household state rendering | ✓ WIRED | Spans `col-span-full` when all shipped pillars are empty. |
| `SignInScreen.tsx` | `OnboardingLayout.tsx` | Layout wrapper and centered card | ✓ WIRED | Centered 440px `Card bg-surface-container`, preserving exact magic link copy and gating. |
| `ListDetailScreen.tsx` | `StoreGroupHeader.tsx` / `ShoppingListRow.tsx` | Store-grouped list rendering | ✓ WIRED | Groups items by merchant, renders collapsible StoreGroupHeader and borderless rows. |
| `ListDetailScreen.tsx` | `ListNameSheet.tsx` | Basic `<md-dialog>` list creation/rename | ✓ WIRED | Renders `ListNameSheet` wrapping `MdDialog` with autofocus on input. |
| `ListDetailScreen.tsx` | `SyncToPantrySheet.tsx` | Overflow menu item 'Add bought to pantry' | ✓ WIRED | Dispatches `setIsSyncToPantryOpen(true)` from top app bar overflow menu. |
| `BarcodeScannerDialog.tsx` | `navigator.mediaDevices` | `streamRef.current` lifecycle cleanup | ✓ WIRED | Loops through `streamRef.current.getTracks()` calling `track.stop()` on unmount/close. |
| `DealCard.tsx` | `DealSearchScreen.tsx` / `FlyerItemsScreen.tsx` | Lifted `AddToListSheet` callback | ✓ WIRED | Emits `onAdd(deal)`, allowing parent screens to handle smart 1-list addition with persistent Undo snackbar. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `DashboardScreen.tsx` | `states` | Pillar query hooks (`bills`, `shopping`, `meals`, `chores`) | Real query state per pillar | ✓ FLOWING |
| `SignInScreen.tsx` | `auth.signIn` | `useAuthClient()` | Real auth client API mutations | ✓ FLOWING |
| `ListDetailScreen.tsx` | `detail.storeGroups` | `useShoppingListDetail(householdId, listId)` | Real store groups with computed subtotals | ✓ FLOWING |
| `PantryScreen.tsx` | `pantry.data` | `usePantry(householdId)` | Real pantry inventory items | ✓ FLOWING |
| `BarcodeScannerDialog.tsx` | `createBarcodeDetector()` | Native BarcodeDetector or WASM ZXing polyfill | Real video frame barcode scanning | ✓ FLOWING |
| `DealSearchScreen.tsx` | `results.data` | `useDealSearch(...)` | Real Flipp API deals | ✓ FLOWING |
| `FlyersScreen.tsx` | `flyers.data` | `useFlyers(...)` | Real Flipp store flyers | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| App shell budget and copy check | `node apps/web/scripts/check-build.mjs` | Shell 155.7 KB <= 200 KB, magic link off as built | ✓ PASS |
| StateBlocks adaptive card/page layout | `pnpm --filter @hestia/web exec vitest run --project dom src/components/states/StateBlocks.test.tsx -t "EmptyState"` | 2 tests passed (4 skipped) | ✓ PASS |
| BarcodeScannerDialog reticle and open state | `pnpm --filter @hestia/web exec vitest run --project dom src/components/lists/BarcodeScannerDialog.test.tsx -t "renders dialog"` | 1 test passed (8 skipped) | ✓ PASS |
| Full Phase 19 DOM test suites execution | `pnpm --filter @hestia/web exec vitest run --project dom (11 test files)` | 180 passed across 11 test suites | ✓ PASS |
| Web workspace TypeScript typecheck | `pnpm --filter @hestia/web typecheck` | `tsc --noEmit` exited with code 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| **DASH-01** | 19-01-PLAN.md | Redesign `Dashboard` (`This Week`) as 1–2 column grid of borderless tonal cards (`surfaceContainerLow`, max 3 rows, `error` for overdue) + `DashboardFirstRun` hero card | ✓ SATISFIED | `DashboardCard.tsx`, `DashboardFirstRun.tsx`, `DashboardScreen.tsx`. 14 tests in `dashboard.test.tsx`, 11 in `dashboard-route.test.tsx`. |
| **DASH-02** | 19-01-PLAN.md | Unify `EmptyState`, `ErrorState`, and `OfflineState` blocks using MD3 tonal containers, Material Symbols, and MD3 typography | ✓ SATISFIED | `StateBlocks.tsx`, 0 lucide imports, adaptive card/page modes. 6 tests in `StateBlocks.test.tsx`. |
| **AUTH-06** | 19-02-PLAN.md | Redesign all auth screens as centered tonal Surface Container cards (`max-w-[440px]`) with `<md-outlined-text-field>`, preserving `MAGIC_LINK_COPY` and gating | ✓ SATISFIED | `SignInScreen.tsx` et al., `TextField.tsx` returning `MdOutlinedTextField`, `check-build.mjs`. 26 tests in `magic-link.test.tsx`. |
| **AUTH-07** | 19-02-PLAN.md | Redesign `OnboardingLayout`, household `Create`/`Join` steps, and `InstallStep` using tonal MD3 action cards and single-field inputs | ✓ SATISFIED | `OnboardingLayout.tsx`, `CreateHouseholdStep.tsx`, `JoinHouseholdStep.tsx`, `InstallStep.tsx`. 21 tests in `onboarding.test.tsx`. |
| **LIST-01** | 19-03-PLAN.md | Overhaul `ListsIndexScreen`, `ListDetailScreen`, `ArchivedListsScreen`, `PantryScreen` with borderless rows, `<md-fab>`, `ListNameSheet` `<md-dialog>`, Top App Bar actions | ✓ SATISFIED | `ListsIndexScreen.tsx`, `ListDetailScreen.tsx`, `PantryScreen.tsx`, `ListNameSheet.tsx`, `MdFab.tsx`. 31 tests in `lists.test.tsx`. |
| **LIST-02** | 19-03-PLAN.md | Standardize `ListDetailScreen` with tonal `StoreGroupHeader`, `ItemSheet` Modal Bottom Sheet, unified collapsible `Bought (N)` section | ✓ SATISFIED | `StoreGroupHeader.tsx`, `ItemSheet.tsx`, `ListDetailScreen.tsx`. 9 tests in `ListDetailScreen.test.tsx`. |
| **LIST-03** | 19-04-PLAN.md | Restyle `BarcodeScannerDialog` as dark-scheme MD3 Full-Screen Dialog with camera polyfill, flashlight, manual entry, mode toggle, persistent Undo Snackbar | ✓ SATISFIED | `BarcodeScannerDialog.tsx`. 9 tests in `BarcodeScannerDialog.test.tsx`. |
| **DEAL-06** | 19-05-PLAN.md | Collapse `DealSearchScreen` filters behind MD3 Search Bar, Segmented Button, `<md-filter-chip>` row, Filter Modal Bottom Sheet, and `DealFreshness` banner | ✓ SATISFIED | `DealSearchScreen.tsx`, `DealFreshness.tsx`. 15 tests in `deal-search.test.tsx`. |
| **DEAL-07** | 19-05-PLAN.md | Simplify `DealCard`, lift shared `AddToListSheet`, and present `FlyersScreen` / `FlyerItemsScreen` in 2–4 column elevated MD3 cards | ✓ SATISFIED | `DealCard.tsx`, `AddToListSheet.tsx`, `FlyersScreen.tsx`, `FlyerItemsScreen.tsx`. 23 tests in `deal-card.test.tsx`, 15 in `flyers.test.tsx`. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| None | - | No TBD, FIXME, or XXX markers; no empty stubs or disconnected data flows | ℹ️ Info | Codebase is clean and adheres to MD3 guidelines |

### Human Verification Required

### 1. Real Mobile Camera Barcode Scan & Flashlight HUD Test

**Test:** On a physical mobile phone (iOS Safari or Android Chrome) with camera and flashlight, navigate to `/lists/[id]`, tap "Scan barcode" in the header toolbar, toggle the flashlight, switch between "Add to list" and "Mark bought" modes, and scan a physical grocery product barcode (UPC-A/EAN-13).  
**Expected:** The dark HUD (`#1A110E`) opens smoothly in full-screen mode, targeting reticle displays over camera viewfinder, flashlight turns on/off physical device torch, scanning decodes the barcode instantly with audio chime and haptic feedback, and a persistent Undo snackbar displays "Added N items · [Undo last]". Tapping close or navigating away turns off the camera hardware indicator immediately.  
**Why human:** jsdom and headless browsers mock `navigator.mediaDevices.getUserMedia`, video stream tracks, hardware torch constraints, Web Audio, and Vibration APIs. Hardware validation requires physical mobile device testing.

### 2. Visual Verification of MD3 Tonal Surfaces & Responsive Breakpoints

**Test:** Open the app on desktop and resize viewport from 360px up to 1200px across `/` (Dashboard), `/lists`, `/pantry`, `/deals`, and `/flyers`.  
**Expected:**  
1. Dashboard (`This Week`): 1 column on <600px, responsive 2 columns on >=600px with borderless `surfaceContainerLow` cards and max 3 items per card. First-run household shows warm tonal hero card.  
2. Auth screens: Forms appear centered inside 440px flat tonal cards with floating label `<md-outlined-text-field>` inputs.  
3. Grocery Lists: Store group subheaders stick on scroll with count badge and chevron; checking items strikes through and moves them to collapsible `Bought (N)` group; floating `MdFab` is fixed in bottom-right corner.  
4. Deals & Flyers: Deal cards render compact single-column horizontal rows with 72x72 photo and bold price; Flyers render elevated cards in 2–4 columns.  
**Why human:** Visual layout aesthetics, CSS grid reflow, typography hierarchy, and surface contrast cannot be validated in automated headless tests.

---

_Verified: 2026-11-15T07:22:00Z_  
_Verifier: the agent (gsd-verifier)_
