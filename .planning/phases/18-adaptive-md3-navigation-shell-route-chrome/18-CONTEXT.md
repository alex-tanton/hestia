# Phase 18: Adaptive MD3 Navigation Shell & Route Chrome - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace legacy responsive navigation chrome (1025px layout cliff, segmented sub-tabs, duplicate headings) with an adaptive MD3 shell: compact `<600px` 5-destination `NavigationBar` (Settings in Top App Bar), medium/expanded `>=600px` `80dp` `NavigationRail` (bottom-anchored Settings), scroll-aware Small Top App Bar owning each screen's single `<h1>`, MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`) in `SubTabs`, modal bottom sheet `HouseholdSwitcher` with single-membership copy, consolidated `Meals` routing (`Planner | Recipes` with "On sale / Ready now" `<md-filter-chip>` and `/meals/suggestions` redirect), and atomic deletion of `SectionProvider` and dead placeholder routes in `ListsRoute.tsx`.

</domain>

<decisions>
## Implementation Decisions

### Adaptive Shell Layout & Window Size Classes
- **D-01:** Standardize navigation active destinations on the **MD3 Active Indicator Pill**: a tonal `secondaryContainer` pill container behind the icon, active `filled={true}` Material Symbol (`Icon.tsx`), and medium-weight label text across both `NavigationBar` (`<600px`) and `NavigationRail` (`>=600px`). — **Reversibility:** costly — active indicator styling and DOM hierarchy touch navigation contracts and test assertions across both shell layouts.
- **D-02:** Structure the `80dp` `NavigationRail` (`>=600px`) with **top-aligned primary destinations** (Home, Lists, Meals, Bills, Chores) and **bottom-pinned Settings** anchored in the rail footer region. — **Reversibility:** costly — changes rail layout structure and Playwright locator scoping for desktop viewports.
- **D-03:** Scale `<main id="main">` with **fluid full-width expansion** across all viewports with fixed horizontal side margins (clearing the `80dp` rail on `>=600px`), allowing dashboard and planner multi-column views to utilize available desktop canvas.
- **D-04:** Implement the mobile `NavigationBar` (`<600px`) as a **standard MD3 80dp container** (`min-h-[80px]`) with `surfaceContainer` fill extending down through `env(safe-area-inset-bottom)`, and pad main content by `calc(5rem + env(safe-area-inset-bottom))` to clear navigation and PWA safe areas cleanly. — **Reversibility:** costly — bottom scroll offset and safe-area geometry affect every screen and bottom-anchored action button / FAB.

### Scroll-Aware Top App Bar & Single-`<h1>` Architecture
- **D-05:** Implement the Small Top App Bar (`64px` height) with **MD3 Scroll-Aware Tonal Tint**: flat `surface` canvas at top (`scrollY = 0`), smoothly tinting to `surfaceContainer` (elevation tier 2) on scroll (`scrollY > 0`) without harsh 1px borders.
- **D-06:** Standardize back navigation on pushed routes to a **circular `<md-icon-button>` with `arrow_back` Material Symbol** and accessible label (`aria-label={chrome.backLabel ? `Back to ${chrome.backLabel}` : 'Back'}`).
- **D-07:** Surface the Settings icon button in the Top App Bar on **compact `<600px` viewports only**; omit from the Top App Bar on `>=600px` where Settings is permanently accessible in the Navigation Rail footer.
- **D-08:** Enforce the **single-`<h1>` hierarchy** by establishing that the Top App Bar owns the page's single `<h1>` across all routes (dynamically synchronized via `useScreenChrome`); demote internal screen body headings in `RecipeDetailScreen`, `ChoreDetailScreen`, and `ChoreFormScreen` to `<h2>` (or section headings) to eliminate duplicate `<h1>` axe-core accessibility violations. — **Reversibility:** costly — touches heading hierarchies, screen test selectors, and accessibility tree structure across multiple screen components.

### Household Switcher Gating & Single-Household Affordance
- **D-09:** Retain the **Top App Bar dropdown button with chevron and `, switch household` accessible label across all users**. When clicked for a single-household user (`households.length === 1`), the sheet opens indicating the current household is active, displaying helper copy stating "No other households", and providing the "Join or create a household" action. — **Reversibility:** costly — preserves user access to create/join households directly from the top bar while adapting sheet contents for single memberships.
- **D-10:** Maintain full **E2E helper compatibility** with `e2e/support/app.ts` `switcher(page)` (`page.getByRole('button', { name: /switch household$/ })`) so all existing Playwright journeys (including single-household journeys like signup and first household) pass without fragile selector forks.
- **D-11:** Migrate the switcher surface from legacy Radix `Sheet` to **MD3 `ModalBottomSheet` (`<dialog>.showModal()`)**, displaying checkmark indicators on the active household and a clean MD3 action row for joining/creating households.
- **D-12:** Represent loading household state with a **tonal skeleton pill** (`surfaceContainerHighest`, `112px × 20px`, `role="status"`, `sr-only` "Loading households") to prevent layout shift.

### Pillar SubTabs & Consolidated Meals Routing
- **D-13:** Migrate `SubTabs.tsx` from `SegmentedControl` to **MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`)** with controlled `activeTabIndex` synchronized with React Router `location.pathname` and `onChange` dispatching `navigate(tab.path)`, ensuring animated indicator sliding and clean history navigation. — **Reversibility:** costly — replaces SegmentedControl across all 4 pillars and changes tab selection events.
- **D-14:** Support **scrollable horizontal tabs** on narrow viewports (`<375px`) without visible scrollbars or clipped labels so multi-tab pillars like Lists (`Lists`, `Deals`, `Flyers`, `Pantry`) stay fully legible.
- **D-15:** **Reset window scroll to top (`0`)** whenever the user switches between sub-tabs within a pillar so the user begins at the top of the newly selected list or view.
- **D-16:** Consolidate `Meals` sub-tabs from 3 to 2 (`Planner | Recipes`), folding suggestions into an **`<md-filter-chip label="On sale / Ready now">`** on `RecipeLibraryScreen`. When active, it filters recipes by current pantry inventory and active store deals, rendering a `surfaceContainerLow` empty state card with a "Clear filter" action if no recipes match.
- **D-17:** Redirect `/meals/suggestions` cleanly to **`/meals/recipes?filter=ready` with `replace: true`**, preserving existing bookmarks and links while automatically engaging the "On sale / Ready now" filter.
- **D-18:** Perform **atomic cleanup of dead scaffold code**: delete `SectionProvider` (`apps/web/src/lib/section-context.tsx`), delete `SubSectionComingSoon.tsx`, remove dead `comingSoon` strings from `Pillar` definitions in `sections.ts`, and update `scripts/knip-production-baseline.txt` in the same wave to keep CI hygiene green. — **Reversibility:** costly — deletes legacy files, cleans exports, and synchronizes the Knip production baseline.

### the agent's Discretion
- **Rail Width & Icon Centering:** Standardize on exact 80dp rail width with center-aligned 56dp × 32dp indicator pills and 12sp typography per MD3 Navigation Rail guidelines.
- **Scroll Detection Threshold:** Implement scroll detection using a passive scroll listener (or IntersectionObserver) triggering the Top App Bar `surfaceContainer` tint when `scrollY > 4px` with CSS transitions on `background-color`.
- **Primary vs Secondary Tab Styling in SubTabs:** Use `<md-tabs>` with `<md-primary-tab>` elements styled with Warm Terracotta `--md-sys-color-primary` active indicator and surface-blended background.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Phase Specifications
- `.planning/PROJECT.md` — Milestone v3.0 goal, constraints, and tech stack boundaries
- `.planning/REQUIREMENTS.md` — Requirements `NAV-01`, `NAV-02`, `NAV-03`, `NAV-04`
- `.planning/ROADMAP.md` — Phase 18 goal, dependencies, and success criteria
- `.planning/STATE.md` — Project progress and accumulated decisions
- `.planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-CONTEXT.md` — Phase 17 foundation tokens, Icon.tsx, gap primitives, and harness setup

### Architecture & Research Contracts
- `.planning/research/ARCHITECTURE.md` § Pattern 4 ("Unified Responsive MD3 App Shell") & Pattern 5 ("Route Cleanup & Screen Decomposition") — Shell layout anatomy, rail/bottom-bar breakpoints, and route table restructuring
- `.planning/research/SUMMARY.md` — Research flags for Phase 18 (NavigationRail/NavigationBar E2E selector compatibility, ModalBottomSheet across compact/desktop viewports)
- `.planning/research/PITFALLS.md` — Shadow DOM navigation, keyboard focus management, safe-area offsets, and Knip hygiene constraints

### Codebase Shell & Navigation Files
- `apps/web/src/components/shell/AppShell.tsx` — Current responsive shell container, scroll memory, and layout wrappers
- `apps/web/src/components/shell/TopBar.tsx` — Top bar layout, title, household switcher slot, and settings link
- `apps/web/src/components/shell/TabBar.tsx` — Current 5-tab fixed bottom bar and `lg:w-56` left sidebar (to be replaced by MD3 `NavigationBar` & `NavigationRail`)
- `apps/web/src/components/shell/SubTabs.tsx` — Current `SegmentedControl` sub-tab switcher (to be migrated to `<md-tabs>`)
- `apps/web/src/components/shell/HouseholdSwitcher.tsx` — Household switcher button and sheet dialog
- `apps/web/src/components/shell/screen-chrome.tsx` — `ScreenChromeProvider` and `useScreenChrome` context
- `apps/web/src/components/md/MdTabs.tsx` — Typed `@material/web` Lit wrappers for `md-tabs` and `md-primary-tab`
- `apps/web/src/components/ui/Icon.tsx` — Curated Material Symbols SVG registry with `filled?: boolean` support
- `apps/web/src/components/ui/ModalBottomSheet.tsx` — Native `<dialog>.showModal()` MD3 sheet primitive
- `apps/web/src/lib/sections.ts` — Section definitions, pillar configs, tabs, and `sectionForPath` helper
- `apps/web/src/lib/section-context.tsx` — Legacy `SectionProvider` slated for removal
- `apps/web/src/routes.tsx` — Route table and lazy loading splits
- `apps/web/src/pillars/lists/ListsRoute.tsx` — Lists route definition with placeholder coming soon routes slated for removal
- `apps/web/src/pillars/meals/MealsRoute.tsx` — Meals route definition with Suggestions sub-route consolidation
- `apps/web/src/screens/meals/RecipeLibraryScreen.tsx` — Recipe library screen to host "On sale / Ready now" `<md-filter-chip>`
- `apps/web/src/screens/meals/RecipeDetailScreen.tsx` — Screen with missing `useScreenChrome` and duplicate `<h1>`
- `apps/web/src/screens/chores/ChoreDetailScreen.tsx` & `ChoreFormScreen.tsx` — Screens with duplicate `<h1>` headings
- `e2e/support/app.ts` — Playwright navigation locators (`switcher()`, `expectDashboard()`, `openSettings()`)
- `scripts/knip-production-baseline.txt` — Knip production unused export baseline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/md/MdTabs.tsx`: Exports `MdTabs` and `MdPrimaryTab` wrapping `@material/web/tabs/tabs.js` and `primary-tab.js` via `@lit/react` with `onChange` event mapping.
- `apps/web/src/components/ui/Icon.tsx`: Pre-configured Material Symbols registry with `filled={true}` support for active destination icons (`dashboard`, `shopping_cart`, `restaurant`, `receipt_long`, `checklist`, `settings`, `arrow_back`, `expand_more`, `check`, `add`).
- `apps/web/src/components/ui/ModalBottomSheet.tsx`: Light-DOM MD3 bottom sheet over native `<dialog>.showModal()` with drag handle, title, accessible close button, and backdrop click handling.
- `apps/web/src/components/ui/Skeleton.tsx`: MD3 skeleton utility styled with `--md-sys-color-surface-container-highest`.
- `apps/web/src/components/shell/screen-chrome.tsx`: Already manages `title`, `backTo`, and `backLabel` with unmount cleanup; ready to be extended or enforced across all pushed routes.

### Established Patterns
- **Window Size Classes:** MD3 Compact (`<600px`), Medium (`600px–839px`), Expanded (`>=840px`). Navigation adapts at `600px` (`min-width: 600px`).
- **Safe Area Inset Handling:** Safe-area padding applied via CSS custom properties and `env(safe-area-inset-*)` (`pt-[env(safe-area-inset-top)]`, `pb-[calc(5rem+env(safe-area-inset-bottom))]`).
- **Strict TypeScript & React 19:** `exactOptionalPropertyTypes: true`, explicit return types on all exported functions, named exports only, `.tsx`/`.ts` extensions in ESM imports.
- **Accessibility:** Axe-core clean; exactly one `<h1>` per rendered route; explicit `aria-label`s on icon buttons and navigation landmarks (`aria-label="Main"`, `aria-label="<Pillar> sections"`).

### Integration Points
- `apps/web/src/components/shell/AppShell.tsx`: Replace legacy `TabBar` and `TopBar` layout with adaptive `NavigationBar` (`<600px`), `NavigationRail` (`>=600px`), and scroll-aware Small Top App Bar.
- `apps/web/src/components/shell/SubTabs.tsx`: Render `MdTabs` and `MdPrimaryTab` components inside `<nav aria-label={`${pillar.label} sections`}>` with scrollable tab container.
- `apps/web/src/pillars/lists/ListsRoute.tsx`: Drop `SubSectionComingSoon` imports and render real `Deals` and `Flyers` screen routes or lazy routes.
- `apps/web/src/pillars/meals/MealsRoute.tsx`: Remove `SuggestionsScreen` route and add `<Navigate to="/meals/recipes?filter=ready" replace />`.
- `apps/web/src/screens/meals/RecipeLibraryScreen.tsx`: Add `<md-filter-chip>` for "On sale / Ready now" reading `?filter=ready` search parameter.

</code_context>

<specifics>
## Specific Ideas

- Active navigation destination indicators should look unmistakably Material Design 3: a rounded capsule pill (`surfaceVariant`/`secondaryContainer`) hugging the icon with filled icon styling, while inactive destinations show outlined icons with muted text.
- NavigationRail pinned Settings item lives in a clean bottom footer container with an inset divider separating it from the 5 pillar destinations above.
- Single-household users clicking the household switcher should never feel broken or dead: opening the sheet and seeing "No other households" along with "Join or create a household" makes it intuitive how to add more households while explaining why there are no others to switch between.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-Adaptive MD3 Navigation Shell & Route Chrome*
*Context gathered: 2026-11-14*

