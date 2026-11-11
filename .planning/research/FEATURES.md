# Feature & UX Pattern Research — Material Design 3 Overhaul (v3.0)

**Domain:** Self-Hosted Household Management PWA (Lists, Deals, Meals, Bills, Chores, Settings)
**Researched:** 2026-11-11
**Confidence:** HIGH (directly grounded in full inspection of `apps/web/src/` and official Material Design 3 / `@material/web` specifications)

---

## Executive Summary

Hestia v2.1 ships complete household workflows across 7 screen groups, but its UI accumulated heavy `1px` bordered containers, per-section color ramps (`dashboard` slate, `lists` green, `meals` amber, `bills` blue, `chores` violet in `apps/web/src/index.css`), misused controls (`SegmentedControl` for route-level navigation in `SubTabs.tsx`), triple-stacked tab rows (`PlannerScreen.tsx`), always-expanded multi-control filter walls (`DealSearchScreen.tsx`), one-item `"..."` overflow menus (`BillRow.tsx`, `ChoreDetailScreen.tsx`, `ErrandRow.tsx`, `CompletionHistory.tsx`), and an auto-dismissing Undo toast (`Toast.tsx`).

Milestone v3.0 transforms Hestia into a cohesive **Material Design 3 (MD3)** web application powered by `@material/web`, `@material/material-color-utilities` (warm Terracotta seed palette), and Material Symbols:
1. **Unify visual language** around tonal `surfaceContainerLowest..Highest` elevation instead of `border-border` boxes, reserving `error` strictly for overdue/failed/destructive states rather than competing per-pillar accent colors.
2. **Fix navigation hierarchy** with a 5-destination MD3 Navigation Bar (`<600px` Compact) -> Navigation Rail (`>=600px` Medium / `>=840px` Expanded), moving route sub-views to MD3 Primary Tabs (`<md-primary-tab>`), folding `Suggestions` into `Recipes`, relocating `Settings` to the Top App Bar (compact) + Rail footer (expanded), and stripping stacked chrome from `PlannerScreen.tsx`.
3. **Apply strict progressive disclosure** across overlays (`<md-dialog>` vs Modal Bottom Sheet vs Full-Screen Dialog/Pushed Route), chip-driven filtering (`DealSearchScreen.tsx`, `RecipeLibraryScreen.tsx`, `MealPlacementSheet.tsx`), zero 1-item overflow menus, a categorized Settings hub, and a compliant non-auto-dismissing Undo Snackbar.

---

## 1. Top-Level Navigation Information Architecture (IA) Proposal

### 1.1 Current IA vs Recommended MD3 IA

| Layer | Current Implementation (`sections.ts`, `routes.tsx`, `AppShell.tsx`) | Recommended MD3 v3.0 IA | Rationale (MD3 & Hestia Workflows) |
|---|---|---|---|
| **Responsive Breakpoints** | Single cliff at `1025px` (`--breakpoint-lg: 64.0625rem` in `index.css`) | **MD3 Window Size Classes:** Compact (`<600px`), Medium (`600–839px`), Expanded (`>=840px`) | Unlocks tablet/desktop two-pane and multi-column ergonomics earlier than `1025px` while matching MD3 specs (`m3.material.io`). |
| **Primary Navigation Chrome** | `<TabBar>` fixed bottom bar `<1025px`; left `lg:w-56` sidebar `>=1025px` with 2px line indicator | **Compact (`<600px`):** MD3 **Navigation Bar** (5 items, `secondaryContainer` active pill). **Medium/Expanded (`>=600px`):** MD3 **Navigation Rail** (80dp rail with top FAB slot + 5 destinations + bottom-anchored Settings item). | MD3 Navigation Bar caps cleanly at **3–5 equal destinations**; Rail scales cleanly on Medium/Expanded without consuming a full `224px` drawer width for 5 items. |
| **Top-Level Destinations** | 5 tabs (`Dashboard`, `Lists`, `Meals`, `Bills`, `Chores`) + Settings gear in `TopBar` | **5 Core Destinations:** `This Week` (`/`), `Lists` (`/lists`), `Meals` (`/meals`), `Bills` (`/bills`), `Chores` (`/chores`) | Preserves all 5 existing top-level mental models and route prefixes (`/lists`, `/meals`, `/bills`, `/chores`, `/`) without forcing a 6th item into the mobile Navigation Bar. |
| **Settings Placement** | Small gear icon link in `TopBar.tsx` on all viewports | **Compact:** Trailing Settings icon button in Top App Bar on top-level screens. **Medium/Expanded:** Dedicated bottom-aligned footer destination in the **Navigation Rail** (plus Top App Bar access if desired). | Keeps Navigation Bar within MD3's strict 5-item maximum on phones while elevating Settings to a persistent utility anchor on Navigation Rail. |
| **Household Switcher** | `TopBar` button opening `HouseholdSwitcher.tsx` `Sheet` even when `households.length === 1` | **If `households.length === 1`:** Display quiet subtitle or manage households inside `Settings > Households` (no wasted Top App Bar sheet trigger). **If `households.length > 1`:** Leading/title dropdown chip or Top App Bar button opening Modal Bottom Sheet to switch households. | Single-household deployments (Hestia's common self-hosted case) currently expose a dead-end sheet solely to show `"Join or create a household"`. |
| **Pillar Sub-Views (`SubTabs.tsx`)** | `SubTabs` wraps `SegmentedControl` for route transitions | **MD3 Primary Tabs (`<md-tabs>` + `<md-primary-tab>`)** placed directly below Top App Bar on pillar roots. Reserve **Segmented Buttons** strictly for local in-page scope/view switches (e.g., `Favorite stores \| All stores`). | Per MD3, Tabs switch peer content views/routes; Segmented Buttons switch local options/display modes within one screen. |
| **Lists Sub-Views** | 4 subTabs: `Lists`, `Deals`, `Flyers`, `Pantry` (+ dead `SubSectionComingSoon` in `ListsRoute.tsx` shadowed by `routes.tsx`) | **4 Primary Tabs:** `Lists`, `Deals`, `Flyers`, `Pantry`. Delete dead placeholder routes in `ListsRoute.tsx`. Keep `/lists/archived` as a pushed route opened from `Lists` Top App Bar Overflow Menu. | Four short 1-word tabs fit even 360px compact screens without scrolling; `Deals` (cross-store search) and `Flyers` (store booklet browse) serve distinct workflows. |
| **Meals Sub-Views** | 3 subTabs: `Planner`, `Recipes`, `Suggestions` (+ 7-tab `Tabs` inside `PlannerScreen`) | **Consolidate to 2 Primary Tabs: `Planner` \| `Recipes`.** Fold `SuggestionsScreen` into `Recipes` via an `<md-filter-chip>` (`"On sale / Ready now"` + `DealFreshness` banner) and keep `/meals/suggestions` redirecting to `/meals/recipes?sort=readiness`. | Code inspection confirms `SuggestionsScreen.tsx` renders the exact same `RecipeCard` component as `RecipeLibraryScreen.tsx`, which *already* offers `Sort by: Readiness`. Eliminates confusing duplicate tab. |
| **Bills Sub-Views** | 2 subTabs: `Bills`, `Subscriptions` | **2 Primary Tabs: `Bills` \| `Subscriptions`** | Cleanly separates due-date bill tracking/autopay from recurring spend totals. |
| **Chores Sub-Views** | 2 subTabs: `Chores`, `Errands` | **2 Primary Tabs: `Chores` \| `Errands`** | Cleanly separates rotating recurring chores from ad-hoc one-off errands. |
| **Top App Bar & Heading Hierarchy** | `TopBar` renders `<h1>`, yet `RecipeDetailScreen`, `ChoreDetailScreen`, `ChoreFormScreen` render a second `<h1>` in body; `RecipeDetailScreen` omits `useScreenChrome` completely | **Single `<h1>` strictly in MD3 Small Top App Bar** across every screen. Enforce `useScreenChrome` on `RecipeDetailScreen` (back arrow + recipe title). Max 1–2 trailing icon actions + Overflow Menu. | Fixes broken back navigation on `/meals/recipes/:recipeId` and eliminates duplicate `<h1>` accessibility violations. |

---

## 2. Feature Landscape

### 2.1 Table Stakes (Expected Baseline MD3 UX & Preserved Workflows)

| Feature | Why Expected | Complexity | Notes & Grounding |
|---|---|---|---|
| **Single Warm Terracotta Color & Tonal Surface System** | Users perceive fragmented rainbow per-tab colors (`index.css`) as jarring; MD3 relies on tonal containment over heavy `1px` borders | MEDIUM | Use `@material/material-color-utilities` seeded with Hestia's warm terracotta/amber seed color to generate light/dark `surfaceContainerLowest..Highest` + `primary/secondary/tertiary/error` tokens. |
| **Adaptive MD3 Shell (Nav Bar <-> Nav Rail)** | Thumb-reachable bottom navigation on phones; efficient vertical rail on tablets/desktop | MEDIUM | Custom React MD3-spec wrappers (missing from `@material/web`) at `<600px` Navigation Bar and `>=600px` Navigation Rail (`80dp`) with `secondaryContainer` active pill. |
| **Scroll-Aware Top App Bar** | Unified back navigation, clear screen context, and max 1–2 trailing actions + overflow | LOW | Small Top App Bar (`surface` -> `surfaceContainer` on scroll). Enforces single `<h1>` and `useScreenChrome` across pushed detail/form routes including `RecipeDetailScreen.tsx`. |
| **Primary Creation FAB Pattern** | Replacing top-of-page `<div className="flex justify-end">` create buttons frees vertical viewport space on lists | LOW | `<md-fab>` / `<md-fab labeled>` in bottom-right above Nav Bar on Compact, or in Navigation Rail top slot on Medium/Expanded (`ListsIndex`, `ListDetail`, `Pantry`, `Recipes`, `Bills`, `Chores`, `Errands`). |
| **1–3 Line MD3 List Density** | Dense horizontal collections read faster without heavy bordered boxes around every list or row | MEDIUM | Replace bordered `ul` wrappers and `Card`s on homogeneous collections with `<md-list>`, `<md-list-item>`, `<md-divider inset>`, and `min-h-12`/`min-h-14` touch targets. |
| **Proper Overlay Tiering (Dialog / Sheet / Full-Screen)** | Wrong modal container causes mobile keyboard clipping (`BillForm`/`RecipeForm` in `85dvh` sheets) or heavyweight modals (`ListNameSheet`) | MEDIUM | Basic `<md-dialog>` for confirms & 1-field prompts; Modal Bottom Sheet (`28dp` radius, `640dp` max width) for pickers & quick-adds; Full-Screen Dialog / pushed route for multi-field forms & camera scanner. |
| **Compliant Snackbar with Persistent Undo** | Existing `Toast.tsx` auto-dismisses at 5s even when `Undo` is attached, violating MD3 and WCAG low-vision access | LOW | Custom MD3 Snackbar (`inverseSurface`/`inverseOnSurface`), queued 1-at-a-time, positioned above bottom bar/FAB; **never auto-dismiss when an action button (`Undo`) is present**. |
| **100% Core Workflow Parity** | Redesign must never drop domain capabilities already built in v1.0–v2.1 | HIGH | Preserve offline write queue (lists/chores/errands), realtime list sync, Flipp deals/flyers & freshness retry, camera + manual Open Food Facts barcode flow, non-recipe meals, bill recurrence/autopay/skip, chore rotations, magic link/password auth, Web Push toggles, System Health, and departure reassignment. |

### 2.2 Differentiators (High-Leverage Clutter Reduction & UX Polish)

| Feature | Value Proposition | Complexity | Notes & Grounding |
|---|---|---|---|
| **Chip-Collapsed Deal & Recipe Filtering** | Frees ~250px of vertical above-the-fold space on mobile `DealSearchScreen.tsx` by hiding the 5-control filter grid behind a crisp chip bar | MEDIUM | Search Bar + 2-segment Scope Toggle (`Favorites \| All`) + scrollable `<md-filter-chip>` strip (`Store`, `Category`, `Price`, `Sort`, `Clear`) opening a Filter Modal Bottom Sheet. |
| **Unified `Recipes` + `Suggestions` View** | Eliminates redundant `SuggestionsScreen.tsx` tab and lets users toggle deal/pantry readiness in-place | LOW | Add `<md-filter-chip>` `"On sale / Ready now"` + `DealFreshness` compact banner to `RecipeLibraryScreen.tsx`. Keep `/meals/suggestions` route alias redirecting cleanly. |
| **Single Screen-Level `AddToListSheet`** | Stops mounting N redundant `<Sheet>` portals (one inside every `DealCard.tsx` via `AddToList.tsx`) | LOW | Lift one shared `AddToListSheet` state to `DealResults`, `DealSearchScreen`, `FlyerItemsScreen`, and `MatchToSheet`. |
| **Zero 1-Item Overflow Menus** | Eliminates wasted two-tap `"..."` menus where only 1 option exists (`BillRow`, `ChoreDetailScreen`, `ErrandRow`, `CompletionHistory`) | LOW | Promote single actions to direct trailing `<md-icon-button>` / Top App Bar `Edit`, or consolidate full row actions (`Mark paid`, `Skip`, `Edit`, `Delete`) cleanly into one coherent menu. |
| **Categorized MD3 Settings Hub** | Replaces the 6-section wall of stacked forms in `SettingsScreen.tsx` with a scannable `<md-list>` hub | MEDIUM | Grouped `<md-list-item>` categories opening focused sub-views/sheets (`Account`, `Households & Invites`, `Notifications` w/ real `<md-switch>`, `About & System Health`). |
| **Suggestion Chips for Quick Meals** | Replaces 8 bulky `min-h-11` buttons (`QUICK_SUGGESTIONS` in `MealPlacementSheet.tsx`) with scannable horizontal chips | LOW | `<md-chip-set>` of `<md-suggestion-chip>`s (`Banana`, `Greek Yogurt`, `Apple`, `Oatmeal`, `Protein Shake`, `Leftovers`, `Salad`, `Sandwich`). |
| **De-Cluttered Deal Card & Tabbed Matcher** | Trims `DealCard` from 3 badges + 2 price styles + nested button down to clear scannable hierarchy; splits `MatchToSheet` into 2 clean tabs | MEDIUM | `DealCard`: photo + title + store/validity line + bold price + single `-X%` tonal badge + `+ Add` icon button. `MatchToSheet`: MD3 Secondary Tabs (`Pantry \| Deals`) inside sheet instead of stacking both below each other. |

### 2.3 Anti-Features (Current Clutter & MD3 Traps to Eliminate)

| Anti-Pattern / Feature | Why Problematic (Observed in Code / MD3 Rules) | MD3 Replacement |
|---|---|---|
| **Per-Pillar Accent Rainbow (`data-section` overrides)** | Forces users to re-learn what green/amber/blue/violet mean per tab while colliding with semantic status indicators (`index.css`) | One warm **Terracotta** primary/secondary/tertiary palette (`surfaceContainer` hierarchy) + `error` reserved exclusively for overdue/destructive alerts. |
| **`SegmentedControl` for Route Navigation (`SubTabs.tsx`)** | Violates MD3 spec separating route navigation from in-page local option switching | `<md-tabs>` + `<md-primary-tab>` for pillar sub-routes. |
| **Triple-Stacked Navigation Bars in Meal Planner** | `TopBar` + `SubTabs` + Week Switcher + 7-day `Tabs` + bottom `TabBar` leaves tiny content area on mobile (`PlannerScreen.tsx`) | On Compact/Medium: `Planner \| Recipes` tabs -> compact Week Switcher -> scrollable 7-day vertical agenda (auto-scrolled to Today, compact day jumper pills instead of nested `<md-tabs>`). |
| **Inline Always-Open Filter Form (`DealSearchScreen.tsx`)** | Pushes deal results below the fold on mobile phones and turns `FavoriteStores` into large secondary buttons | MD3 Search Bar + Scope Segmented Button + `<md-filter-chip>` strip -> Filter Bottom Sheet. |
| **Per-Card Sheet Portals (`AddToList.tsx` inside `DealCard.tsx`)** | Instantiates dozens of hidden portal trees per search result page | One lifted screen-level `AddToListSheet` controlled by selected deal item. |
| **1-Item Overflow Menus** | Forces two taps for one action in `BillRow` (`Skip` only), `ChoreDetailScreen` (`Edit` only), `ErrandRow` (`Delete` only), `CompletionHistory` (`Delete` only) | Direct trailing `<md-icon-button>` (e.g. `Delete` on `ErrandRow` / latest `CompletionHistory`), Top App Bar `Edit` button (`ChoreDetailScreen`, `BillDetailScreen`), or multi-item contextual menu (`Mark paid`, `Skip`). |
| **Full Bottom Sheet for 1 Text Input (`ListNameSheet.tsx`)** | Overweight modal sheet chrome for naming/renaming a shopping list | Basic `<md-dialog>` with `<md-outlined-text-field>` and `Cancel` / `Save` text buttons. |
| **Multi-Field Forms in `85dvh` Bottom Sheets** | `BillForm.tsx` (10+ fields) and `RecipeForm.tsx` (3 modes + `IngredientEditor` + instructions) cramp mobile viewports & fight virtual keyboards | **Full-Screen Dialog (Compact)** / Centered Dialog or Pushed Form Route (Medium/Expanded). |
| **Auto-Dismissing Undo Snackbar (`Toast.tsx`)** | 5000ms auto-dismiss drops `Undo` actions before screen-reader or low-vision users can act | Persistent Snackbar whenever an action (`Undo`) is attached; auto-dismiss (4–10s) only for actionless confirmations. |
| **Duplicate Body `<h1>` & Missing Chrome Hooks** | `RecipeDetailScreen`, `ChoreDetailScreen`, `ChoreFormScreen` duplicate `<h1>`; `RecipeDetailScreen` leaves TopBar showing `"Recipes"` with `HouseholdSwitcher` instead of Back + title | Enforce single `<h1>` in `TopBar` and `useScreenChrome` on every non-root route. |
| **Mixed Accordion Implementations** | `ListDetailScreen.tsx` jams an action button inside a custom `aria-expanded` header (`Bought`), whereas `ErrandsListScreen.tsx` uses native `<details>/<summary>` | Standardize one MD3 Expandable List Row header; move `Add bought items to pantry` to Top App Bar Overflow Menu or subtle tonal list footer/chip. |
| **Unrequested MD3 Expressive Decorative Animations** | Shimmering skeletons and bouncy physics conflict with Hestia's quiet, fast utility aesthetic (`Skeleton.tsx`) | Keep static tonal `Skeleton` placeholders and brisk `150–200ms` state transitions respecting `prefers-reduced-motion`. |

---

## 3. Screen-by-Screen MD3 UX Pattern Inventory (All 7 Screen Groups)

### Group 1: Dashboard (`This Week`)
*Inspected files: `DashboardScreen.tsx`, `DashboardRoute.tsx`, `DashboardCard.tsx`, `DashboardCards.tsx`, `DashboardFirstRun.tsx`.*

| Screen / Component | Current Chrome & Clutter | MD3 Layout, Components & Controls |
|---|---|---|
| **Dashboard (`/`)** | 4 vertically stacked `1px border-border` cards with 4 distinct section tint bars, stretched-link overlays, `> + action` all inline in headers; `DashboardFirstRun` as plain stacked text. | **Top App Bar:** Small (`This Week`, conditional Household menu/subtitle, trailing Settings icon on Compact). **Body:** `1-col` (`<600px`) / `2-col` (`>=600px`) grid of MD3 **Elevated / Filled Cards** (`surfaceContainerLow` on `surface`, `0px` border). Inside each card: compact title + count + trailing chevron icon (`View all`), max 3 clean `<md-list-item>` rows with subtle leading status icon (`error` token *only* when Overdue), and 1 tonal quick-action chip/button if empty or actionable. `DashboardFirstRun` uses tonal Hero Card (`surfaceContainer`) + `<md-filled-tonal-button>` onboarding CTAs. |

### Group 2: Lists, Deals, Flyers & Pantry
*Inspected files: `ListsIndexScreen.tsx`, `ListDetailScreen.tsx`, `ArchivedListsScreen.tsx`, `ListNameSheet.tsx`, `PantryScreen.tsx`, `ItemSheet.tsx`, `ShoppingListRow.tsx`, `StoreGroupHeader.tsx`, `BarcodeScannerDialog.tsx`, `DealSearchScreen.tsx`, `DealCard.tsx`, `DealResults.tsx`, `FavoriteStores.tsx`, `AddToList.tsx`, `FlyersScreen.tsx`, `FlyerItemsScreen.tsx`, `DealFreshness.tsx`, `Pagination.tsx`.*

| Screen / Component | Current Chrome & Clutter | MD3 Layout, Components & Controls |
|---|---|---|
| **Lists Index (`/lists`)** | Top-right `New list` button pushing list down; `border-border` list wrapper; `ListNameSheet` full bottom sheet for 1 input; bottom link for archived lists. | **Primary Tabs:** `Lists \| Deals \| Flyers \| Pantry`. **Top App Bar Overflow:** `Archived lists`. **Body:** Borderless `<md-list>` of 2-line `<md-list-item>`s (list name, outstanding count + realtime indicator) + `<md-divider inset>` inside a subtle `surfaceContainerLow` container. **FAB:** Extended `<md-fab labeled>` `"New list"` opening a **Basic `<md-dialog>`** (single `<md-outlined-text-field>`). |
| **List Detail (`/lists/:listId`)** | Top-right `Scan barcode` + `Add an item` buttons; `Bought (N)` toggle button crammed next to `Add bought items to pantry` button; custom `Checkbox` rows inside bordered box. | **Top App Bar:** `<` Back + list name, trailing `Scan barcode` `<md-icon-button>` + `OverflowMenu` (`Rename list`, `Add bought to pantry`, `Archive list`, `Delete list`). **Body:** Clean `<md-list>` grouped under tonal Store Subheaders (`StoreGroupHeader` w/ `surfaceContainerHigh`), each `ShoppingListRow` using `<md-checkbox>` + 2-line supporting text (qty/unit/notes) + trailing edit/tap opens `ItemSheet` **Modal Bottom Sheet**. Unified collapsible `Bought (N)` list section. **FAB:** `"Add item"` (`ItemSheet`). |
| **Barcode Scanner (`BarcodeScannerDialog.tsx`)** | Custom dark `bg-neutral-950` + `emerald-400` dialog with `SegmentedControl` mode switcher + top icon toggles. | **Full-Screen Dialog** using MD3 dark color scheme tokens (`surfaceContainerLowest`, Terracotta `primary` reticle), clean Top App Bar (`Close`, `Flashlight`, `Manual code`), bottom **Segmented Button** (`Add to list \| Mark bought`) + compact scanned-item confirmation card (`surfaceContainerHigh`) with Undo/retry. |
| **Pantry (`/lists/pantry`)** | Top-right `Add an item` button; `border-border` wrapper; custom inline search input. | Inline **Search Bar** (`surfaceContainerHighest` pill) + optional `<md-filter-chip>` (`Expiring soon` / `All`) + `<md-list>` items (tap -> `ItemSheet`/`PantrySheet` **Modal Bottom Sheet** with Delete inside or swipe/trailing delete icon). **FAB:** `"Add item"`. |
| **Deals (`/lists/deals`) & `DealCard`** | Always-expanded Search + `SegmentedControl` + 5-field filter grid (`Store`, `Category`, `Min/Max price`, `Sort`) + `Button` favorite stores; `DealCard` mounts per-card `AddToList` `Sheet` portal + 3 badges + dual prices. | **Search Bar** + **2-segment Segmented Button** (`Favorites \| All stores`) + horizontal **Filter Chip** row (`Store`, `Category`, `Max price`, `Sort`, `Clear`) opening a **Filter Modal Bottom Sheet**. `DealFreshness` as compact tonal banner (`surfaceContainerHigh`). `DealResults` uses `1-col`/`2-col` (`Expanded`) MD3 Filled Cards (`surfaceContainerLow`): product image, 2-line title, store/dates supporting text, bold price + single `-X%` tonal badge (`tertiaryContainer`), and trailing `+ Add` `<md-filled-tonal-icon-button>` triggering **one shared screen-level `AddToListSheet`**. `Pagination` via MD3 `<md-outlined-button>` prev/next. |
| **Flyers (`/lists/flyers` & `:flyerId`)** | Stacked bordered flyer tiles; `FlyerItemsScreen` replicates pagination/add-to-list boxes. | `FlyersScreen`: `2-col` (`Compact`) / `3–4-col` (`Medium/Expanded`) MD3 **Elevated Cards** (cover image + merchant name + validity range). `FlyerItemsScreen`: Small Top App Bar (`<` + Merchant Flyer), compact filter/search chip strip, shared `DealCard` grid + single `AddToListSheet`. |

### Group 3: Meals, Recipes & Suggestions
*Inspected files: `PlannerScreen.tsx`, `PlannerDay.tsx`, `MealSlotEntry.tsx`, `MealPlacementSheet.tsx`, `PlaceOnPlannerSheet.tsx`, `RecipeLibraryScreen.tsx`, `SuggestionsScreen.tsx`, `RecipeDetailScreen.tsx`, `RecipeForm.tsx`, `RecipeCard.tsx`, `ReadinessBreakdown.tsx`, `IngredientRow.tsx`, `IngredientEditor.tsx`, `MatchToSheet.tsx`, `ListPickerSheet.tsx`.*

| Screen / Component | Current Chrome & Clutter | MD3 Layout, Components & Controls |
|---|---|---|
| **Meals Tabs & `SuggestionsScreen`** | 3 tabs (`Planner \| Recipes \| Suggestions`); `SuggestionsScreen` duplicates `RecipeLibraryScreen` using the exact same `RecipeCard`. | **2 Primary Tabs: `Planner \| Recipes`.** `SuggestionsScreen` becomes an `<md-filter-chip>` mode (`"Ready / On sale"`) on `Recipes` (preserving `/meals/suggestions` route alias). |
| **Planner (`/meals`)** | Triple-stacked chrome on mobile (`SubTabs` + Week bar w/ full-width `Add week's missing to list` button + 7-tab horizontal `Tabs`); cramped ~125px columns on 960px desktop. | **Compact/Medium:** Week Switcher strip (`<` `Apr 14–20` `>` + trailing `Shopping cart / Overflow` icon for `Add missing to list`) + compact **Day Anchor Pills** (quick scroll-to-day, not nested `<md-tabs>`) above a clean 7-day vertical `<md-list>` agenda (auto-scrolled to Today). **Expanded (`>=840px`):** Full-width 7-column tonal card board inside rail layout (widening columns beyond `960px`). **FAB / Slot `+`:** Opens `MealPlacementSheet`. |
| **`MealPlacementSheet` & `PlaceOnPlannerSheet`** | `MealPlacementSheet` renders 8 `QUICK_SUGGESTIONS` as big `min-h-11` `Button`s + bordered recipe list. | **Modal Bottom Sheet:** Meal slot segmented selector (`Breakfast \| Lunch \| Dinner \| Snack` via compact Segmented Button), `<md-outlined-text-field>` quick custom entry, horizontal `<md-chip-set>` of **8 `<md-suggestion-chip>`s**, and `<md-list>` recipe picker below. `PlaceOnPlannerSheet` uses clean `<md-outlined-select>` / day-slot pickers inside Modal Bottom Sheet. |
| **Recipe Library (`/meals/recipes`)** | Top-right `Add a recipe` button; bordered `RecipeCard`s; client search on page 1. | **Search Bar** + horizontal `<md-filter-chip>` row (`Ready now`, `On sale`, `Sort`) + optional `DealFreshness` banner + responsive 1–2 col MD3 Filled Cards (`RecipeCard`: title, cook/ingredient metadata, single readiness status chip). **FAB:** `"Add recipe"` opening `RecipeForm`. *(Note: flag client-side page-1 search limitation honestly if server search isn't in v3.0 UI scope.)* |
| **Recipe Detail (`/meals/recipes/:recipeId`)** | **Omits `useScreenChrome`** (TopBar broken); duplicate `<h1>` in body; `IngredientRow` renders 2 text ghost buttons (`Not a match` + `Match to…`) per row; `MatchToSheet` stacks Pantry + full Deal Search vertically. | **Top App Bar:** `<` Back + recipe title (single `<h1>`), trailing `Place on planner` icon, `Edit` icon, `OverflowMenu` (`Add missing to list`, `Delete`). **Body:** Tonal `ReadinessBreakdown` summary card + `<md-list>` ingredients where each `IngredientRow` shows status icon/badge (`In pantry`, `On sale`, `Missing`) + single trailing `<md-icon-button>` / menu (`Match to…`, `Clear match`). **`MatchToSheet`:** Modal Bottom Sheet with **MD3 Secondary Tabs (`Pantry \| Deals`)** separating Pantry picker from live Deal search. `ListPickerSheet`: clean Modal Bottom Sheet `<md-list>`. |
| **`RecipeForm`** | 3 modes (`choose \| url \| edit`) + `IngredientEditor` + instructions textarea jammed inside `85dvh` `Sheet`. | **Full-Screen Dialog** (Compact) / Centered Dialog (`Expanded`), with top `Save` action, 2-segment mode switch (`Import URL \| Manual`) when creating, and clean borderless `<md-list>` rows for `IngredientEditor` (`quantity`, `unit`, `itemName`, delete icon). |

### Group 4: Bills & Subscriptions
*Inspected files: `BillsIndexScreen.tsx`, `BillDetailScreen.tsx`, `SubscriptionsScreen.tsx`, `BillForm.tsx`, `BillRow.tsx`, `SubscriptionRow.tsx`, `PaymentHistory.tsx`, `PaymentEditSheet.tsx`.*

| Screen / Component | Current Chrome & Clutter | MD3 Layout, Components & Controls |
|---|---|---|
| **Bills Index (`/bills`)** | Top-right `Add a bill` button; `border-border` list boxes; `BillRow` pairs inline `Mark paid` button with a **1-item `OverflowMenu` (`Skip`)**. | **Primary Tabs:** `Bills \| Subscriptions`. **Body:** Tonal grouped `<md-list>` sections (`Overdue` with `error` emphasis, `Upcoming`, `Inactive`). Each `BillRow` (`<md-list-item>`): title, due date + `Autopay`/personal supporting line, trailing amount + **either** single-tap tonal `Pay` button w/ `OverflowMenu` (`Pay`, `Skip`, `Edit`) **or** direct `<md-overflow-menu>` containing `Mark paid`, `Skip`, `Edit` (zero 1-item menus!). **FAB:** `"Add bill"`. |
| **Bill Detail (`/bills/:billId`)** | `Edit bill` button below summary card while `Archive`/`Delete` sit in `OverflowMenu` (no `Mark paid`/`Skip` in header); `PaymentHistory` has bordered box & 1-item `Delete` menu on skipped payments. | **Top App Bar:** `<` Back + Bill name, trailing `Edit` icon + `OverflowMenu` (`Mark paid`, `Skip`, `Archive`, `Delete`). **Body:** Tonal Summary Card (`surfaceContainerLow` w/ amount, next due date, recurrence, autopay badge, quick `Mark paid` `<md-filled-tonal-button>`) + `<md-list>` `PaymentHistory` (2-item `OverflowMenu` `Edit`/`Delete` on normal payments; direct `Delete` `<md-icon-button>` on skipped payments). `PaymentEditSheet` remains a crisp **Modal Bottom Sheet**. |
| **Bill Form (`BillForm.tsx`)** | 10+ fields inside an `85dvh` bottom `Sheet`. | **Full-Screen Dialog** (Compact) / Dialog or Pushed Route (`/bills/new`, `/bills/:id/edit`), using `<md-outlined-text-field>`, `<md-outlined-select>`, `<md-switch>` (`Autopay`, `Variable amount`, `Household vs Personal`), and collapsible/grouped `RecurrenceFields` with live preview caption. |
| **Subscriptions (`/bills/subscriptions`)** | Bordered summary card + bordered list box (`SubscriptionRow`). | MD3 **Filled Hero Card** (`surfaceContainerHighest` monthly & annualized total) + borderless `<md-list>` (`<md-list-item>` with provider name, billing cadence, trailing normalized monthly/cycle cost). |

### Group 5: Chores & Errands
*Inspected files: `ChoresListScreen.tsx`, `ChoreDetailScreen.tsx`, `ChoreFormScreen.tsx`, `ErrandsListScreen.tsx`, `ChoreListRow.tsx`, `RotationEditor.tsx`, `CompletionHistory.tsx`, `RecurrenceFields.tsx`, `ErrandRow.tsx`, `ErrandSheet.tsx`.*

| Screen / Component | Current Chrome & Clutter | MD3 Layout, Components & Controls |
|---|---|---|
| **Chores Index (`/chores`)** | Top-right `Add a chore` button; `border-border` list boxes. | **Primary Tabs:** `Chores \| Errands`. **Body:** `<md-list>` grouped by `Overdue` (`error` status dot/chip), `Due soon / Active`, `Paused`. `ChoreListRow`: chore name, recurrence + rotation assignee (`"Alex's turn"`), trailing quick `Done` `<md-filled-tonal-icon-button>` (offline-queued!). **FAB:** `"Add chore"`. |
| **Chore Detail (`/chores/:choreId`)** | Duplicate `<h1>` in body; **1-item `OverflowMenu` (`Edit` only)** in TopBar; `CompletionHistory` has bordered box + **1-item `OverflowMenu` (`Delete` only)** on most-recent entry. | **Top App Bar:** `<` Back + Chore name (single `<h1>`), trailing **direct `Edit` `<md-icon-button>`** + optional `Delete` in overflow (removing 1-item menu!). **Body:** Tonal Summary Card (`surfaceContainerLow` w/ `<md-filled-button>` `"Mark done"` + rotation up-next preview) + borderless `<md-list>` `CompletionHistory` where most-recent row has a **direct trailing `Delete` `<md-icon-button>`** opening `<md-dialog>` confirm. |
| **Chore Form (`/chores/new`, `/chores/:choreId/edit`)** | Duplicate `<h1>` in body; bordered `RotationEditor` container. | **Pushed Route** (already routed!) with single `<h1>` in Top App Bar (`<` Back + `New chore`/`Edit chore` + trailing `Save` action or bottom full-width `<md-filled-button>`), `<md-outlined-text-field>`, `RecurrenceFields`, `<md-switch>` (`Paused`, `Enable rotation`), and tonal `RotationEditor` (`<md-list>` ordered turn roster + `<md-filter-chip>` member toggles). |
| **Errands (`/chores/errands`)** | Top-right `Add an errand` button; `border-border` wrapper; native `<details>` completed accordion diverging from `ListDetailScreen`; `ErrandRow` has **1-item `OverflowMenu` (`Delete` only)**. | **Body:** Borderless `<md-list>` using `<md-checkbox>` + 2-line supporting text (assignee, due date, notes); tap item to edit in `ErrandSheet` **Modal Bottom Sheet**, or **direct trailing `Delete` `<md-icon-button>`** (with Undo Snackbar!). Unified MD3 Expandable Completed section matching `ListDetailScreen`'s `Bought` pattern. **FAB:** `"Add errand"` (`ErrandSheet`). |

### Group 6: Onboarding & Auth
*Inspected files: `OnboardingLayout.tsx`, `SignInScreen.tsx`, `SignUpScreen.tsx`, `MagicLinkRequestScreen.tsx`, `MagicLinkCodeScreen.tsx`, `ForgotPasswordScreen.tsx`, `SetPasswordScreen.tsx`, `OnboardingScreen.tsx`, `CreateHouseholdStep.tsx`, `JoinHouseholdStep.tsx`, `InstallStep.tsx`.*

| Screen / Component | Current Chrome & Clutter | MD3 Layout, Components & Controls |
|---|---|---|
| **Auth Flows (`/sign-in`, `/sign-up`, `/sign-in/link`, `/sign-in/code`, `/forgot-password`, `/set-password`)** | Clean centered layout, styled with Tailwind borders & Lucide icons. | Single centered MD3 **Surface Container Card** (`max-w-[440px]`, `surfaceContainerLow`, `28dp` or `16dp` corners, no app bar/nav chrome), `<md-outlined-text-field>` w/ native error supporting text, `<md-filled-button>` primary submit, `<md-text-button>` / `<md-outlined-button>` secondary paths (Magic link, Forgot password, Sign up/in). Preserve `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` gating cleanly. |
| **Household Onboarding & Install (`/onboarding`, `/join`)** | Bordered step containers in `OnboardingScreen.tsx`; `InstallStep.tsx` instructions. | **Action Cards** (`Create household` vs `Join with code`) on tonal `surfaceContainer`, single `<md-outlined-text-field>` forms in `CreateHouseholdStep` / `JoinHouseholdStep`, and tonal guidance card (`surfaceContainerHigh`) in `InstallStep` w/ Material Symbols `ios_share` / `install_mobile` icons and `<md-filled-tonal-button>` continue action. |

### Group 7: Settings, System Health & Household Departure
*Inspected files: `SettingsScreen.tsx`, `SettingsSection.tsx`, `AccountSection.tsx`, `DisplayNameForm.tsx`, `ChangeEmailForm.tsx`, `ChangePasswordForm.tsx`, `HouseholdsSection.tsx`, `HouseholdCard.tsx`, `InvitesSection.tsx`, `HouseholdSettingsSection.tsx`, `NotificationsSection.tsx`, `NotificationTypes.tsx`, `NotificationTypeRows.tsx`, `AboutSection.tsx`, `SystemHealthScreen.tsx`, `DepartureScreen.tsx`, `DeleteHouseholdPanel.tsx`, `ReassignmentList.tsx`.*

| Screen / Component | Current Chrome & Clutter | MD3 Layout, Components & Controls |
|---|---|---|
| **Settings Hub (`/settings`)** | Massive vertical scroll dumping all 6 sections (`AccountSection` w/ 3 nested forms + `HouseholdsSection` w/ nested member lists + `InvitesSection` + `HouseholdSettingsSection` w/ `FavoriteStores` + `NotificationsSection` w/ `NotificationTypes` + `AboutSection`) in bordered boxes simultaneously. | **Compact (`<600px`) / Medium:** Categorized `<md-list>` Hub (`Account`, `Households & Invites`, `Household Preferences & Stores`, `Notifications`, `About & System Health`). Tapping rows opens either a **Modal Bottom Sheet / Basic Dialog** (`DisplayName`, `ChangeEmail`, `ChangePassword`, `PostalCode`, `Create/Join household`) or a **focused pushed section / sub-view** (`Households`, `Notifications`, `SystemHealth`). **Expanded (`>=840px`):** Optional 2-pane Settings rail + detail pane! |
| **Notifications (`NotificationTypeRows.tsx`)** | Uses `<Checkbox role="switch" />` styled as a square checkbox instead of a visual switch. | Real **`<md-switch>`** trailing inside `<md-list-item>` rows with supporting description text; tonal device status banner (`surfaceContainerHigh`) for `IosInstallLine` / `DeviceNoteLine` / `UnsupportedLine`. |
| **Household Preferences & `FavoriteStores`** | `FavoriteStores` mixes search/checkbox list inside nested `HouseholdSettingsSection` bordered box. | Tonal section or Modal Bottom Sheet picker using `<md-filter-chip>` selected stores + `<md-list>` search results with `<md-checkbox>`. |
| **System Health (`/settings/system-health`)** | Bordered key-value card (`SystemHealthScreen.tsx`). | Borderless `<md-list>` diagnostic rows inside `surfaceContainerLow` card, trailing semantic tonal badges (`tertiaryContainer` healthy / `errorContainer` degraded) + `<md-outlined-button>` refresh. |
| **Departure (`/settings/households/:id/members/:userId/depart`)** | Multiple bordered `Card`s stacking `ReassignmentList` pickers, `RotationNotes`, and `DeleteHouseholdPanel`. | Clear single-column progressive flow: `<md-list>` sections per `OwnedGroup` with `<md-outlined-select>` assignee pickers, tonal `RotationNotes` card (`surfaceContainer`), and `DeleteHouseholdPanel` opening an `error`-styled **`<md-dialog>`** requiring typed household name confirmation. |

---

## 4. Progressive Disclosure & Overlay Strategy Map (All 7 Screen Groups)

| Disclosure Tier | MD3 Mechanism | Exact Hestia Mappings Across the 7 Screen Groups |
|---|---|---|
| **Tier 1: Always Visible (Primary Scan Surface)** | Top App Bar (Title + <=2 actions), Navigation Bar/Rail (5 destinations), Primary Tabs (2–4), Search Bar, Single primary `<md-fab>`, Core `<md-list-item>` 1–2 line summary + primary check/complete affordance | **Dashboard:** 4 summary cards (max 3 items each). **Lists:** List rows, active items + store headers, FABs. **Deals:** Search Bar + `Favorites\|All` + 4 filter chips. **Meals:** 2 tabs (`Planner\|Recipes`), Week switcher, day agenda, recipe cards w/ single readiness badge. **Bills:** 2 tabs, `Overdue`/`Upcoming` rows, Pay/Done quick action. **Chores:** 2 tabs, chore/errand rows, `Done`/checkbox. **Auth:** Core credentials fields. **Settings:** Grouped category `<md-list>` rows. |
| **Tier 2: Secondary Inline / Chip-Collapsed** | `<md-filter-chip>`, `<md-suggestion-chip>`, `<md-divider inset>` expandable completed sections, secondary/tertiary supporting text | **Lists/Deals/Pantry:** `Bought (N)` collapsible list; `DealSearch` filters collapsed into `<md-filter-chip>` triggers; `Pantry` expiring filter chip. **Meals:** `Recipes` `"Ready / On sale"` chip + `DealFreshness` strip; `MealPlacementSheet` `QUICK_SUGGESTIONS` as `<md-suggestion-chip>`s. **Chores:** `Completed` errands collapsible list (unified with `Bought` pattern). **Settings:** Subheader summaries (`"3 households"`, `"Email & Push active"`). |
| **Tier 3: Direct Trailing Action vs Overflow Menu (`<md-menu>`)** | Direct `<md-icon-button>` when **only 1 secondary action exists**; `<md-menu>` **only when >=2 actions exist** | **Top App Bar Overflows:** `ListDetail` (`Rename`, `Add bought to pantry`, `Archive`, `Delete`), `ListsIndex` (`Archived`), `RecipeDetail` (`Add missing to list`, `Delete`), `BillDetail` (`Mark paid`, `Skip`, `Archive`, `Delete`). **Row Direct Icons (no 1-item menu!):** `DealCard` (`+ Add`), `ErrandRow` (`Delete`), `CompletionHistory` (`Delete` on newest), `ChoreDetailScreen` (`Edit` in TopBar), `PaymentHistory` skipped row (`Delete`). **Row Multi-Item Menus:** `BillRow` (`Mark paid`, `Skip`, `Edit`), `PaymentHistory` paid row (`Edit`, `Delete`), `IngredientRow` (`Match to…`, `Clear match`). |
| **Tier 4: Basic `<md-dialog>`** | Interruptive short decision or single-field prompt (max 1 input, 2 text buttons) | `ConfirmDialog` across all destructive/irreversible actions (`Delete household` typed name, `Delete bill/chore/recipe/completion`, `Leave household`, `Archive/Delete list`); **List rename/create** (`ListNameSheet` converted from sheet -> `<md-dialog>`). |
| **Tier 5: Modal Bottom Sheet (`28dp` top radius, `<=640dp` wide)** | Contextual pickers & quick 1–4 field edits keeping parent context dimmed behind | `HouseholdSwitcher` (only when `>1` households), `ItemSheet` (list/pantry quick add/edit), shared `AddToListSheet`, `DealFilterSheet`, `ListPickerSheet`, `MealPlacementSheet`, `PlaceOnPlannerSheet`, `MatchToSheet` (`Pantry \| Deals` tabs), `PaymentEditSheet`, `ErrandSheet`, Settings account/postal quick-edit sheets. |
| **Tier 6: Full-Screen Dialog / Pushed Route** | Dense multi-field forms (>=5 fields or nested editors), camera hardware overlays, multi-step flows | **BarcodeScannerDialog** (camera viewfinder + manual fallback), **BillForm** (10+ fields + recurrence), **RecipeForm** (URL import + `IngredientEditor` + instructions), **ChoreFormScreen** (already pushed route w/ `RotationEditor` + `RecurrenceFields`), **SystemHealthScreen**, **DepartureScreen**, pushed Settings sub-screens (`Households`, `Notifications`). |
| **Tier 7: Non-Interruptive Feedback (`Snackbar`)** | Transient bottom bar above Navigation Bar / FAB | All offline-queued confirmations, list item completions, errand deletions, meal/bill updates. **Rule:** Persistent until dismissed or acted upon whenever an `Undo` button is present; auto-dismiss (4–6s) only for pure info confirmations. |

---

## 5. Feature Dependencies

```
[MD3 Warm Terracotta Color & Surface System + Typography Tokens]
    ├──powers──> [MD3 Base Wrappers (@material/web + Snackbars + Bottom Sheets)]
    │                └──powers──> [Adaptive Shell: Nav Bar (<600px) / Nav Rail (>=600px) + Top App Bar + Primary Tabs]
    │                                 ├──unblocks──> [Group 6: Onboarding & Auth] (independent of Authenticated shell chrome, shares tokens + fields)
    │                                 ├──unblocks──> [Group 1: Dashboard ("This Week")]
    │                                 ├──unblocks──> [Group 2: Lists, Deals, Flyers & Pantry]
    │                                 │                  └──requires──> [Shared AddToListSheet + Chip Filter Pattern]
    │                                 ├──unblocks──> [Group 3: Meals & Recipes (merged Suggestions)]
    │                                 │                  └──reuses──> [ListPickerSheet + DealCard/MatchToSheet Tabs]
    │                                 ├──unblocks──> [Group 4: Bills & Subscriptions]
    │                                 ├──unblocks──> [Group 5: Chores & Errands]
    │                                 │                  └──shares──> [RecurrenceFields + Unified Collapsible Completed Section]
    │                                 └──unblocks──> [Group 7: Settings Hub, System Health & Departure]
    │
    └──fixes───> [Cross-Cutting UX Bugs]
                     ├── Enforced single <h1> + useScreenChrome (RecipeDetailScreen, ChoreDetailScreen, ChoreFormScreen)
                     ├── Persistent Undo Snackbar (Toast.tsx migration)
                     └── Zero 1-item OverflowMenus across Bills, Chores, Errands
```

---

## 6. MVP Definition (Phased v3.0 Rollout)

### Launch With (v3.0 — Complete MD3 Overhaul)
Following `PROJECT.md`'s 4-phase structure (`MD3-FOUNDATION` -> `MD3-NAV-SHELL` -> `MD3-SCREENS` -> `MD3-VERIFY`):
- [ ] **Foundation (`MD3-FOUNDATION`):** Warm Terracotta seed theme (`@material/material-color-utilities`), light/dark tonal surface tokens (`surfaceContainerLowest..Highest`), Material Symbols, `@material/web` React wrappers, plus spec-compliant React wrappers for **Navigation Bar, Navigation Rail, Modal Bottom Sheet, Segmented Button, Search Bar, and Persistent-Undo Snackbar**.
- [ ] **Navigation Shell (`MD3-NAV-SHELL`):** Compact/Medium/Expanded adaptive breakpoints (`600px`, `840px`), 5-destination Nav Bar / Nav Rail w/ Settings in TopBar (compact) + Rail footer (expanded), Small Top App Bar enforcing single `<h1>`, `HouseholdSwitcher` gated on `>1` households, MD3 Primary Tabs replacing `SegmentedControl` in `SubTabs.tsx`, and removal of dead `SubSectionComingSoon` routes.
- [ ] **All 7 Screen Groups (`MD3-SCREENS`):**
  - Dashboard tonal summary cards w/ strict `error`-only overdue alerts.
  - Lists (`ListNameSheet` -> `<md-dialog>`, FAB, TopBar Overflow w/ `Add bought to pantry` + `Archived`, MD3 `<md-list>` + `<md-checkbox>`, MD3-styled `BarcodeScannerDialog`).
  - Deals & Flyers (Search Bar + `Favorites\|All` + `<md-filter-chip>` sheet, single lifted `AddToListSheet`, trimmed `DealCard`).
  - Meals (`Planner\|Recipes` 2-tab consolidation folding `Suggestions` into `Recipes` chip, stripped planner mobile chrome + horizontal `MealPlacementSheet` suggestion chips, fixed `RecipeDetailScreen` Top App Bar + tabbed `MatchToSheet`, full-screen `RecipeForm`).
  - Bills (`BillRow` + `BillDetailScreen` consistent actions w/ zero 1-item overflow menus, full-screen `BillForm`, `Subscriptions` Hero Card).
  - Chores & Errands (direct `Edit`/`Delete` icons replacing 1-item menus, unified collapsible completed list, `<md-list>` rotation & recurrence forms).
  - Onboarding & Auth (tonal centered card, `<md-outlined-text-field>`).
  - Settings Hub (categorized `<md-list>` hub replacing stacked wall of forms, `<md-switch>` notifications, tonal System Health & Departure).
- [ ] **Verification (`MD3-VERIFY`):** Preserve all existing unit, integration, and Playwright E2E coverage across offline queue, barcode, deals, meals, bills, chores, auth, and departure flows.

### Defer / Explicit Non-Goals (`v3.x`)
- **Full multi-page server-side recipe search:** `RecipeLibraryScreen.tsx` currently filters client-side; upgrading backend search endpoints is out of v3.0 visual/UX overhaul scope (surface clear pagination/search copy honestly in UI).
- **Swipe-to-complete / swipe-to-delete list gestures:** Touch swipe conflicts with browser back-navigation gestures and offline undo timing on mobile PWAs; explicit `<md-checkbox>`, `Done` buttons, and Undo Snackbars are faster and safer.
- **M3 Expressive experimental spring physics / custom shapes:** Stick to stable baseline MD3 tokens and `@material/web` stability; avoid unstandardized experimental tokens in maintenance-mode web components.

---

## 7. Feature Prioritization Matrix

| UX Improvement / Pattern | User Impact | Implementation Effort | Priority |
|---|---|---|---|
| Unified Warm Terracotta Tonal Surfaces (drop `1px` borders & rainbow tabs) | HIGH | MEDIUM | **P0 (Foundation)** |
| Adaptive Nav Bar (`<600px`) / Rail (`>=600px`) + Primary Tabs + Top App Bar `<h1>` fix | HIGH | MEDIUM | **P0 (Shell)** |
| Overlay Tiering (`ListNameSheet` -> Dialog, `BillForm`/`RecipeForm` -> Full-Screen, Shared `AddToListSheet`) | HIGH | MEDIUM | **P0 (High Friction Fix)** |
| Chip-Collapsed `DealSearchScreen` & Trimmed `DealCard` | HIGH | MEDIUM | **P1 (Mobile Clarity)** |
| `Meals` Consolidation (`Planner\|Recipes` + Strip Planner Chrome + `RecipeDetailScreen` TopBar fix) | HIGH | MEDIUM | **P1 (Navigation Fix)** |
| Categorized Settings Hub (`SettingsScreen` refactor + real `<md-switch>`) | HIGH | MEDIUM | **P1 (Clutter Reduction)** |
| Zero 1-Item Overflow Menus (`Bills`, `Chores`, `Errands`) & Persistent-Undo Snackbar | MEDIUM | LOW | **P1 (Quick Win)** |
| `Dashboard` Tonal Cards & `Subscriptions` Hero Card | MEDIUM | LOW | **P2 (Polish)** |
| `BarcodeScannerDialog` MD3 Dark Tokens + `Onboarding` / `Departure` / `SystemHealth` Alignment | MEDIUM | LOW | **P2 (Polish)** |

---

## 8. MD3 vs Current Hestia Pattern Comparison

| UX Dimension | Hestia v2.1 (Observed Pattern) | Comparable Best-Practice MD3 Pattern (Google Keep / Tasks / MD3 Spec) | v3.0 Convergence Decision |
|---|---|---|---|
| **List vs Card Usage** | Bordered boxes around homogeneous lists (`Lists`, `Pantry`, `Bills`, `Chores`, `Errands`, `Settings`) | MD3 uses borderless `<md-list>` on `surface`/`surfaceContainerLow` for homogeneous rows; Filled/Elevated Cards strictly for heterogeneous summary tiles (`Dashboard`, `Flyers`, `Deals`) | **Adopt MD3 split strictly:** `<md-list>` for operational rows; borderless tonal Cards for summary/media tiles. |
| **Primary Create CTA** | Inline top-right `<Button>` above page content on 7 screens | Bottom-right `<md-fab>` / `<md-fab labeled>` (Compact) or Navigation Rail top slot (Medium/Expanded) | **Adopt MD3 FAB** across all 7 list/collection screens. |
| **Search & Multi-Filter** | Full inline grid of 5 selects/inputs (`DealSearchScreen`) | MD3 Search Bar + horizontal scrollable `<md-filter-chip>` strip -> Filter Modal Bottom Sheet | **Adopt Search Bar + Filter Chips** on `Deals` & `Recipes`. |
| **Tabs vs Segmented Buttons** | `SegmentedControl` used for route sub-views (`SubTabs.tsx`) | Primary Tabs for sub-views; Segmented Buttons (`2–5` items) solely for in-page view/scope selection (`Favorites\|All`, `Add\|Bought`, Meal Slot) | **Adopt strict separation.** |
| **Snackbar Undo Safety** | `5000ms` auto-dismiss even with `Undo` callback (`Toast.tsx`) | Persistent Snackbar whenever an action (`Undo`) is attached; auto-dismiss strictly for actionless notices | **Enforce MD3 persistent-with-action rule.** |

---

## 9. Sources

- **Codebase Inspection (HIGH Confidence):**
  - Routing & IA: `apps/web/src/routes.tsx`, `apps/web/src/lib/sections.ts`, `apps/web/src/index.css`, `apps/web/src/screens/AuthenticatedLayout.tsx`, `apps/web/src/screens/PillarScreen.tsx`
  - App Shell & Chrome: `apps/web/src/components/shell/AppShell.tsx`, `TopBar.tsx`, `TabBar.tsx`, `SubTabs.tsx`, `HouseholdSwitcher.tsx`, `screen-chrome.tsx`
  - Shared UI Primitives: `apps/web/src/components/ui/Button.tsx`, `Card.tsx`, `Badge.tsx`, `ListRow.tsx`, `Field.tsx`, `Select.tsx`, `Checkbox.tsx`, `OverflowMenu.tsx`, `SegmentedControl.tsx`, `Sheet.tsx`, `Tabs.tsx`, `Toast.tsx`, `ConfirmDialog.tsx`, `Skeleton.tsx`
  - Screen Groups 1–7: `apps/web/src/screens/DashboardScreen.tsx`, `DashboardRoute.tsx`, `lists/*`, `deals/*`, `meals/*`, `bills/*`, `chores/*`, `onboarding/*`, `settings/*` and feature components under `apps/web/src/components/{dashboard,lists,meals,bills,chores,errands}/`
- **Material Design 3 Official Guidelines (HIGH Confidence):**
  - Official MD3 specifications (`https://m3.material.io/`) verified via search across: Adaptive Window Size Classes (`Compact <600dp`, `Medium 600–839dp`, `Expanded >=840dp`), Navigation Bar (3–5 destinations) & Navigation Rail (3–7 + FAB), Primary/Secondary Tabs vs Segmented Buttons, Lists vs Cards, Surface Container tonal roles (`surface-container-lowest..highest`), Bottom Sheets (Modal/Standard, `28dp` radius, `640dp` max-width), Basic vs Full-Screen Dialogs, Top App Bar variants, Filter/Suggestion Chips, and Snackbar duration/action accessibility rules.
- **`@material/web` Official Component Coverage (HIGH Confidence):**
  - Official Material Web library (`https://github.com/material-components/material-web`): Verified available `<md-*>` elements (`md-list`, `md-list-item`, `md-tabs`, `md-primary-tab`, `md-secondary-tab`, `md-dialog`, `md-menu`, `md-menu-item`, `md-fab`, buttons, text fields, selects, checkboxes, switches, chips, dividers, progress) and confirmed gaps requiring React MD3-spec wrappers (Navigation Bar, Navigation Rail, Bottom Sheet, Segmented Button, Snackbar, Search Bar/View, Date Picker).

---
*Feature & UX Pattern Research for: Hestia Milestone v3.0 (Material Design 3 Overhaul)*
*Researched: 2026-11-11*
