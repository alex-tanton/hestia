# Roadmap: Hestia

## Milestones

- ✅ **[v1.0 Hearth — Cleanup and Hardening](milestones/v1.0/ROADMAP.md)** — Phases 1-6 (shipped 2026-10-25)
- ✅ **[v2.0 Hestia — Domain Migration and Rebrand](milestones/v2.0-ROADMAP.md)** — Phases 7-11 (shipped 2026-11-02)
- ✅ **[v2.1 Grocery & Deals Intelligence](milestones/v2.1-ROADMAP.md)** — Phases 12-16 (shipped 2026-11-10)
- 🚧 **v3.0 Material Design 3 Overhaul** — Phases 17-21 (in progress)

## Phases

<details>
<summary>✅ v1.0 Hearth — Cleanup and Hardening (Phases 1-6) — SHIPPED 2026-10-25</summary>

- [x] Phase 1: Published History & Branch Policy (5/5 plans) — completed 2026-10-24
- [x] Phase 2: Test Suite Determinism & Lint Fencing (8/8 plans) — completed 2026-10-24
- [x] Phase 3: Dead Code & Redundancy Reduction (12/12 plans) — completed 2026-10-24
- [x] Phase 4: Bug Fixes & Security Hardening (10/10 plans) — completed 2026-10-25
- [x] Phase 5: CI/CD Pipeline & Tooling Consolidation (8/8 plans) — completed 2026-10-25
- [x] Phase 6: Code Quality Gates & Ratchet Enforcement (17/17 plans) — completed 2026-10-25

</details>

<details>
<summary>✅ v2.0 Hestia — Domain Migration and Rebrand (Phases 7-11) — SHIPPED 2026-11-02</summary>

- [x] Phase 7: Planning Cleanup & Documentation Restructure (4/4 plans) — completed 2026-10-25
- [x] Phase 8: Full Rebrand to Hestia (7/7 plans) — completed 2026-10-26
- [x] Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress) (5/5 plans) — completed 2026-11-01
- [x] Phase 10: Magic Links & Transactional Email (3/3 plans) — completed 2026-11-01
- [x] Phase 11: Web Push & Edge Hardening (4/4 plans) — completed 2026-11-02

</details>

<details>
<summary>✅ v2.1 Grocery & Deals Intelligence (Phases 12-16) — SHIPPED 2026-11-10</summary>

- [x] Phase 12: Store & Deal Image Delivery (2/2 plans) — completed 2026-11-09
- [x] Phase 13: Deal Pricing Engine & Ingestion Performance (3/3 plans) — completed 2026-11-09
- [x] Phase 14: Barcode Scanning & Grocery List Integration (3/3 plans) — completed 2026-11-10
- [x] Phase 15: Flexible Meal Planning (Custom Items & Recipes) (2/2 plans) — completed 2026-11-10
- [x] Phase 16: Verification & Real-World Test Hardening (3/3 plans) — completed 2026-11-10

</details>

### 🚧 v3.0 Material Design 3 Overhaul (In Progress)

**Milestone Goal:** Completely overhaul Hestia's frontend across all screens using Google's Material Design 3 for Web (`@material/web`) to deliver minimal, uncluttered visuals, unified Warm Terracotta tonal theming, restructured navigation, and clear flow of control.

- [ ] **Phase 17: MD3 Foundation, Token Pipeline & UI Primitives** - Warm Terracotta light/dark `--md-sys-*` tokens, `@material/web` React 19 interop wrappers (`components/md/` -> `components/ui/`), Material Symbols `Icon` contract, and light-DOM/native-`<dialog>` gap primitives (with Tailwind CSS coexisting behind `components/ui/`).
- [ ] **Phase 18: Adaptive MD3 Navigation Shell & Route Chrome** - Window Size Class `NavigationBar` (`<600px`) and `NavigationRail` (`>=600px`), scroll-aware Small Top App Bar owning each screen's single `<h1>`, MD3 Primary Tabs, conditional `HouseholdSwitcher`, and consolidated Meals/Lists routing.
- [ ] **Phase 19: Entry, Dashboard & Grocery Ecosystem Screens** - Overhaul Onboarding, Auth, Dashboard, Shared State blocks, Lists, Pantry, Barcode Scanner, Deals, and Flyers onto uncluttered tonal MD3 surfaces with progressive chip filtering and persistent Undo Snackbars.
- [ ] **Phase 20: Meals, Bills, Chores & Settings Screens** - Overhaul Meal Planner/Recipes, Bills/Subscriptions, Chores/Errands, and Settings/System Health/Departure using MD3 lists, Full-Screen/Centered dialogs for dense forms, `<md-switch>` controls, zero 1-item overflow menus, and a categorized Settings hub.
- [ ] **Phase 21: Legacy Stack Cleanup & Full Verification** - Remove Tailwind CSS, Radix UI, and Lucide cleanly after all screens migrate, reconcile Knip baselines, and verify Vitest coverage, 24 Playwright E2E specs, light/dark WCAG 2.1 AA audits, shell budget, Caddy CSP, and CI hygiene gates.

## Phase Details

### Phase 17: MD3 Foundation, Token Pipeline & UI Primitives

**Goal**: Establish the unified Warm Terracotta MD3 design token system, isolated `@material/web@2.5.0` React 19 adapters, Material Symbols delivery contract, and light-DOM/native-`<dialog>` gap primitives while keeping Tailwind CSS coexisting cleanly behind `components/ui/` until Phase 21 cleanup so unit and sequential E2E suites stay verifiable at every step.
**Depends on**: Phase 16 (previous milestone)
**Requirements**: FND-01, FND-02, FND-03, FND-04
**Success Criteria** (what must be TRUE):
  1. Static light and dark `--md-sys-color-*` and harmonized semantic status CSS tokens generated from a Warm Terracotta seed pass WCAG AA contrast checks across all five `surfaceContainer*` elevation tiers in `tokens.test.ts` (replacing `[data-section]` color ramps).
  2. Application code accesses `@material/web@2.5.0` controls strictly through typed `components/md/` -> `components/ui/` `@lit/react` wrappers enforcing subpath imports, `exactOptionalPropertyTypes` normalization, `onInput`/`onChange`, `md-switch` `selected`, `md-dialog` `closed` sync, `soft-disabled` guards, `useFieldErrors` host `aria-invalid` forwarding, explicit `Switch`/`Checkbox` labels, `positioning="fixed"` on menus/selects, and ESLint import/`jsx-a11y` rules.
  3. All icons render through `Icon.tsx` behind a single locked Material Symbols delivery contract (`@material-symbols/font-400` WOFF2 vs curated inline `@material-symbols/svg-400`) with `aria-hidden="true"`, clean Workbox precaching, and Caddy `'self'` CSP compatibility.
  4. Light-DOM and native-`<dialog>` MD3 gap primitives (`ModalBottomSheet`, persistent-until-acted-upon Undo `Snackbar`, `Card`, `ListRow`, `Badge`, `SegmentedControl`, `Skeleton`, `FormMessage`, and styled native `date`/`time` fields) pass `primitives.test.tsx` under the locked Phase 17 component test harness while Tailwind CSS continues coexisting cleanly for unmigrated screens.

**Plans**: 10/15 plans executed

Plans:
**Wave 1**
- [x] 17-01-PLAN.md — Install vetted foundation packages (`@material/web`, `@lit/react`, `material-color-utilities`, `element-internals-polyfill`), generate Warm Terracotta `tokens.css`, and verify AA contrast across all 5 elevation tiers in `tokens.test.ts` (`FND-01`)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 17-02-PLAN.md — Map all `@theme inline` custom properties (including `--overlay`) cleanly in `index.css`, update `index.html`/launcher icons to Warm Terracotta chrome, and split Vitest `unit` (`node`) vs `dom` (`jsdom`, routing 6 browser/RTL `.test.ts` suites cleanly) (`FND-01`)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 17-03-PLAN.md — Configure ESLint `@material/web` import/a11y rules preserving `CLOCK_READS`/`FORMATTER_READS` test clock fences, bootstrap forced `element-internals-polyfill` in `test-setup.ts`, create `md-queries.ts`, and implement `MdTextField`/`MdButton`/`MdSelect`/`MdCheckbox` adapters (`FND-02`)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 17-04-PLAN.md — Implement `MdSwitch`/`MdRadio`/`MdDialog`/`MdMenu`/`MdTabs`/`MdProgress` adapters and execute `D-13` 5-check jsdom smoke gate (`FND-02`)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 17-05-PLAN.md — Execute human supply-chain gate for `@material-symbols/svg-400` sequentially after `test-setup.ts`/`D-13` and build static rounded SVG `Icon.tsx` contract (`FND-03`)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 17-06-PLAN.md — Upgrade `Button`, `Field`, `Select` (coarse native + fixed fine menu) and add light-DOM 56px `DateField` and `TimeField` primitives (`FND-02`, `FND-04`)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 17-07-PLAN.md — Add `Switch`, upgrade `Checkbox` (`CheckboxChangeEvent`), migrate `NotificationTypeRows` directly to `<Switch>`, and upgrade `ConfirmDialog`, `OverflowMenu`, and `Tabs` (`FND-02`, `FND-04`)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 17-08-PLAN.md — Add top-layer `gap-primitives.css`, native-`<dialog>` `ModalBottomSheet`/`Sheet`, and single-slot FIFO persistent Undo/Error `Snackbar` (`Toast.tsx` + `Toast.test.tsx` + `chores.test.tsx`) (`FND-04`)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 17-09-PLAN.md — Upgrade light-DOM `Card`, `ListRow`, `Badge`, `SegmentedControl`, `Skeleton`, `FormMessage`, and `CopyButton` onto MD3 tonal tokens and `Icon` (`FND-04`)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 17-10-PLAN.md — Update shared `browser.ts` (`openMenu`) and synchronize `shell`, `dashboard`, `write-queue`, `realtime`, and `about-sign-out` tests (`FND-02`, `FND-04`)

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 17-11-PLAN.md — Synchronize Settings (`departure`, `notification-types`, `settings`, `system-health`), Onboarding (`magic-link`, `onboarding`), and `dashboard-route` tests (`FND-02`, `FND-04`)
- [ ] 17-12-PLAN.md — Synchronize Lists (`BarcodeScannerDialog`, `ItemSheet`, `ListDetailScreen`, `lists`) and Bills (`bill-detail`, `bills-index`, `household-timezone`, `subscriptions`) tests (`FND-02`, `FND-04`)
- [ ] 17-13-PLAN.md — Synchronize Chores, Errands, and Deals `.test.tsx` suites to `md-queries.ts` (`FND-02`, `FND-04`)
- [ ] 17-14-PLAN.md — Synchronize Meals component and screen `.test.tsx` suites to `md-queries.ts` (`FND-02`, `FND-04`)

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 17-15-PLAN.md — Reconcile Knip baseline and pass release verification gates (`84/80/77/85` `test:coverage`, `<= 200 KB` build, `0` WOFF2 precache, JSCPD, `audit-prod`, LF hygiene) (`FND-01`–`FND-04`)

**UI hint**: yes

### Phase 18: Adaptive MD3 Navigation Shell & Route Chrome

**Goal**: Replace legacy responsive chrome with an adaptive MD3 shell (`NavigationBar` on compact `<600px`, `NavigationRail` on `>=600px`), scroll-aware Small Top App Bar owning each screen's single `<h1>`, MD3 Primary Tabs, conditional `HouseholdSwitcher`, and consolidated Meals/Lists routing while preserving passing E2E flows across coexisting screens.
**Depends on**: Phase 17
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. Viewport layout adapts at MD3 Window Size Classes (`<600px` 5-destination `NavigationBar` with `Settings` in Top App Bar; `>=600px` `80dp` `NavigationRail` with bottom-anchored `Settings`; `>=840px` expanded content grids), eliminating the legacy `1025px` layout cliff.
  2. Every top-level and pushed route renders a scroll-aware Small Top App Bar owning the page's single `<h1>` and `useScreenChrome` navigation (fixing missing `useScreenChrome` in `RecipeDetailScreen` and duplicate `<h1>` headings in `RecipeDetailScreen`, `ChoreDetailScreen`, and `ChoreFormScreen`).
  3. Pillar sub-views switch via MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`), `HouseholdSwitcher` sheet access renders only when `households.length > 1`, and `SectionProvider` plus dead `SubSectionComingSoon` routes in `ListsRoute.tsx` are removed.
  4. `Meals` presents two consolidated sub-tabs (`Planner | Recipes`) with `"On sale / Ready now"` filtering surfaced via `<md-filter-chip>` on `Recipes` and `/meals/suggestions` redirecting cleanly to `/meals/recipes`.

**Plans**: TBD
**UI hint**: yes

### Phase 19: Entry, Dashboard & Grocery Ecosystem Screens

**Goal**: Overhaul Onboarding, Auth, Dashboard, Shared State blocks, Grocery Lists, Pantry, Barcode Scanner, Deals, and Flyers onto borderless MD3 tonal surfaces with progressive chip filtering, `<md-dialog>` prompts, lifted `AddToListSheet`, and persistent Undo Snackbars while updating affected unit and E2E selectors incrementally.
**Depends on**: Phase 18
**Requirements**: DASH-01, DASH-02, AUTH-06, AUTH-07, LIST-01, LIST-02, LIST-03, DEAL-06, DEAL-07
**Success Criteria** (what must be TRUE):
  1. Users view `Dashboard` (`This Week`) as a 1–2 column grid of borderless `surfaceContainerLow` cards (max 3 `<md-list-item>` rows per card, `error` reserved strictly for overdue alerts), see a tonal `DashboardFirstRun` hero card when empty, and see unified MD3 `EmptyState`, `ErrorState`, and `OfflineState` blocks across routes.
  2. Unauthenticated and onboarding users complete sign-in, sign-up, magic link request/code, password reset, household create/join, and PWA install steps inside centered tonal MD3 cards with `<md-outlined-text-field>` inputs while preserving `MAGIC_LINK_COPY` and `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` gating.
  3. Users manage active/archived shopping lists and pantry inventory through borderless `<md-list>` + `<md-checkbox>` rows, `<md-fab>` creation CTAs, basic `<md-dialog>` list naming, tonal `StoreGroupHeader` sections, `ItemSheet` Modal Bottom Sheets, Top App Bar overflow actions (`Archived`, `Add bought to pantry`), and a unified collapsible `Bought (N)` section.
  4. Users scan barcodes in a dark-scheme MD3 Full-Screen Dialog (`Add to list | Mark bought` Segmented Button, flashlight, manual entry, camera polyfill, persistent Undo Snackbar) with full functional parity.
  5. Users search and browse deals and flyers through an MD3 Search Bar, `Favorites | All stores` Segmented Button, `<md-filter-chip>` Filter Modal Bottom Sheet, compact tonal `DealFreshness` banner, simplified `DealCard`s sharing a single screen-level `AddToListSheet`, and 2–4 column elevated `FlyersScreen` / `FlyerItemsScreen` cards.

**Plans**: TBD
**UI hint**: yes

### Phase 20: Meals, Bills, Chores & Settings Screens

**Goal**: Overhaul Meals/Recipes, Bills/Subscriptions, Chores/Errands, and Settings/System Health/Departure into uncluttered MD3 workflows featuring a de-cluttered Planner, Full-Screen/Centered dialogs for multi-field forms, `<md-switch>` controls, zero 1-item overflow menus, and a categorized Settings hub while updating paired unit and E2E selectors.
**Depends on**: Phase 19
**Requirements**: MEAL-04, MEAL-05, MEAL-06, BILL-01, BILL-02, CHOR-01, CHOR-02, SET-01, SET-02, SET-03
**Success Criteria** (what must be TRUE):
  1. Users plan weekly meals in a de-cluttered `PlannerScreen` (compact Week Switcher + Day Anchor Pills + 7-day `<md-list>` agenda `<840px`; 7-column tonal card board `>=840px`), place meals via `MealPlacementSheet` / `PlaceOnPlannerSheet` Modal Bottom Sheets with `<md-suggestion-chip>` quick suggestions, and browse, inspect, match (`MatchToSheet` `Pantry | Deals` tabs), export (`ListPickerSheet`), and edit (`RecipeForm` Full-Screen/Centered Dialog) recipes in MD3 surfaces.
  2. Users manage bills and subscriptions via grouped `<md-list>` sections (`Overdue`/`Upcoming`/`Inactive`), a tonal `SubscriptionsScreen` Hero Card, a tonal `BillDetailScreen` with `PaymentHistory` and `PaymentEditSheet`, and a Full-Screen Dialog / pushed `BillForm` using `<md-switch>` toggles, with zero 1-item overflow menus.
  3. Users complete rotating chores and ad-hoc errands via `<md-list>` rows with direct quick-action/delete icons (no 1-item overflow menus), persistent Undo Snackbars, single-`<h1>` `ChoreDetailScreen`/`ChoreFormScreen` with tonal `RotationEditor`, `ErrandSheet` Modal Bottom Sheet, and a unified collapsible `Completed` section matching `Bought`.
  4. Users configure account, households, invites, preferences, favorite stores (`<md-filter-chip>` + `<md-list>` picker), and notifications (`<md-switch>` controls + tonal device guidance banner) from a categorized `<md-list>` Settings hub, review diagnostics in a borderless `SystemHealthScreen`, and execute household departure or deletion in a progressive `DepartureScreen` flow with `error`-styled confirmation dialog.

**Plans**: TBD
**UI hint**: yes

### Phase 21: Legacy Stack Cleanup & Full Verification

**Goal**: Remove Tailwind CSS, Radix UI, Lucide, and legacy styling shims cleanly once all screens have migrated, reconcile Knip baselines, and pass all Vitest coverage, 24 Playwright E2E specs, light/dark WCAG 2.1 AA accessibility audits, shell bundle budget, Caddy CSP, and CI hygiene gates.
**Depends on**: Phase 20
**Requirements**: FND-05, VER-01, VER-02, VER-03, VER-04
**Success Criteria** (what must be TRUE):
  1. `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`, `@tailwindcss/vite` Vite configuration, legacy Tailwind CSS/config, and obsolete `knip.json` ignores are completely removed with zero broken styles or missing imports, and `scripts/knip-production-baseline.txt` is atomically reconciled.
  2. Vitest unit and component suites (`tokens.test.ts` light/dark AA across all 5 `surfaceContainer*` tiers, `primitives.test.tsx`, `shell.test.tsx`, and all screen tests) pass while meeting coverage thresholds (`84/80/77/85`).
  3. All 24 Playwright E2E specs pass sequentially using MD3 semantic locators with zero functional regressions across offline queues, barcode scanning, deals/flyers, meals, bills, chores, auth, and household departure, and light/dark WCAG 2.1 AA audits (`17-accessibility-states.spec.ts` + `e2e/support/axe.ts` `{ subtree: true }`) pass across all routes.
  4. All build and CI ratchets pass: `check-build.mjs` (`<= 200 KB` gzipped shell budget + `MAGIC_LINK_COPY`), Caddy `'self'` CSP + Workbox offline precaching, `pnpm lint`, `pnpm typecheck`, `pnpm knip` + `scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `audit-prod.mjs`, and `scripts/check-repo-hygiene.mjs` (LF endings, zero legacy tokens).

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 17 → 18 → 19 → 20 → 21

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 17. MD3 Foundation, Token Pipeline & UI Primitives | v3.0 | 10/15 | In Progress | - |
| 18. Adaptive MD3 Navigation Shell & Route Chrome | v3.0 | 0/0 | Not started | - |
| 19. Entry, Dashboard & Grocery Ecosystem Screens | v3.0 | 0/0 | Not started | - |
| 20. Meals, Bills, Chores & Settings Screens | v3.0 | 0/0 | Not started | - |
| 21. Legacy Stack Cleanup & Full Verification | v3.0 | 0/0 | Not started | - |
