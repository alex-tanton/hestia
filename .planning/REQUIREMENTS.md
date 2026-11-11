# Requirements: Hestia — Household Management PWA (v3.0 Material Design 3 Overhaul)

**Defined:** 2026-11-11
**Core Value:** Completely overhaul Hestia's frontend across all screens using Google's Material Design 3 for Web (`@material/web`) to deliver minimal, uncluttered visuals, unified warm tonal theming, restructured navigation, and clear flow of control.

## v3.0 Requirements

Requirements for the Material Design 3 UI overhaul. Each maps to roadmap phases.

### Foundation & Design System

- [ ] **FND-01**: Generate build-time Warm Terracotta light and dark `--md-sys-*` CSS tokens (`@material/material-color-utilities` `SchemeTonalSpot` + `MaterialDynamicColors` + harmonized semantic status roles) with WCAG AA contrast verified across all five `surfaceContainer*` tiers in `tokens.test.ts`, replacing `[data-section]` color ramps.
- [ ] **FND-02**: Isolate all `@material/web@2.5.0` custom elements behind typed React 19 `@lit/react` wrappers (`components/md/` -> `components/ui/`) enforcing strict subpath imports, `exactOptionalPropertyTypes` normalization, `onInput`/`onChange`, `md-switch` `selected`, `md-dialog` `closed` state sync, `soft-disabled` guards, `useFieldErrors` host `aria-invalid` forwarding, explicit `Switch`/`Checkbox` labels, `positioning="fixed"` on menus/selects, and ESLint `no-restricted-imports` + `jsx-a11y` rules.
- [ ] **FND-03**: Lock and implement the Material Symbols delivery contract behind `Icon.tsx` (`@material-symbols/font-400` WOFF2 vs curated inline `@material-symbols/svg-400`) with `aria-hidden="true"` and clean Workbox + Caddy `'self'` CSP compatibility.
- [ ] **FND-04**: Provide minimal light-DOM and native-`<dialog>` MD3 gap primitives (`ModalBottomSheet`, persistent-until-acted-upon Undo `Snackbar`, `Card`, `ListRow`, `Badge`, `SegmentedControl`, `Skeleton`, `FormMessage`, and styled native `date`/`time` fields).
- [ ] **FND-05**: Remove `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`, and legacy Tailwind CSS/config cleanly once all screens migrate.

### Navigation & Application Shell

- [ ] **NAV-01**: Replace the `1025px` layout cliff with MD3 Window Size Classes: 5-destination `NavigationBar` (`<600px`, Settings in Top App Bar), `80dp` `NavigationRail` (`>=600px`, bottom-anchored Settings), and `>=840px` expanded content grids.
- [ ] **NAV-02**: Enforce a scroll-aware Small Top App Bar owning the screen's single `<h1>` and `useScreenChrome` across all pushed routes (fixing missing `useScreenChrome` in `RecipeDetailScreen` and duplicate `<h1>`s in `RecipeDetailScreen`, `ChoreDetailScreen`, and `ChoreFormScreen`).
- [ ] **NAV-03**: Migrate `SubTabs` from `SegmentedControl` to MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`), gate `HouseholdSwitcher` sheet access to `households.length > 1`, and delete `SectionProvider` plus dead `SubSectionComingSoon` routes in `ListsRoute.tsx`.
- [ ] **NAV-04**: Consolidate `Meals` sub-tabs from 3 (`Planner | Recipes | Suggestions`) to 2 (`Planner | Recipes`) by folding `SuggestionsScreen` into an `"On sale / Ready now"` `<md-filter-chip>` on `Recipes`, keeping `/meals/suggestions` redirecting to `/meals/recipes`.

### Dashboard, Onboarding & Auth

- [ ] **DASH-01**: Redesign `Dashboard` (`This Week`) as a 1–2 column grid of borderless tonal cards (`surfaceContainerLow`, max 3 `<md-list-item>` rows per card, `error` reserved strictly for overdue alerts) plus a tonal `DashboardFirstRun` hero card.
- [ ] **DASH-02**: Unify `EmptyState`, `ErrorState`, and `OfflineState` blocks using MD3 tonal containers, Material Symbols, and MD3 typography.
- [ ] **AUTH-06**: Redesign all auth screens (`/sign-in`, `/sign-up`, `/sign-in/link`, `/sign-in/code`, `/forgot-password`, `/set-password`) as centered tonal Surface Container cards (`max-w-[440px]`) with `<md-outlined-text-field>` and MD3 buttons, preserving `MAGIC_LINK_COPY` and `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` gating.
- [ ] **AUTH-07**: Redesign `OnboardingLayout`, household `Create`/`Join` steps, and `InstallStep` using tonal MD3 action cards, single-field `<md-outlined-text-field>` inputs, and clear guidance cards.

### Grocery Lists, Pantry, Deals & Flyers

- [ ] **LIST-01**: Overhaul `ListsIndexScreen`, `ListDetailScreen`, `ArchivedListsScreen`, and `PantryScreen` with borderless `<md-list>` + `<md-checkbox>`, `<md-fab>` creation actions, `ListNameSheet` converted to basic `<md-dialog>`, and Top App Bar overflow actions (`Archived`, `Add bought to pantry`).
- [ ] **LIST-02**: Standardize `ListDetailScreen` with tonal `StoreGroupHeader` subheaders, `ItemSheet` Modal Bottom Sheet, and a unified MD3 collapsible `Bought (N)` section.
- [ ] **LIST-03**: Restyle `BarcodeScannerDialog` as a dark-scheme MD3 Full-Screen Dialog preserving camera `BarcodeDetector`/WASM polyfill, flashlight, manual code entry, `Add to list | Mark bought` Segmented Button, and persistent Undo Snackbar feedback.
- [ ] **DEAL-06**: Collapse `DealSearchScreen` filters behind an MD3 Search Bar, `Favorites | All stores` Segmented Button, and `<md-filter-chip>` row opening a Filter Modal Bottom Sheet, paired with a compact tonal `DealFreshness` banner.
- [ ] **DEAL-07**: Simplify `DealCard` (photo, title, store/dates, bold price, single `-X%` tonal badge, `+ Add` icon button), lift a single shared `AddToListSheet` per screen, and present `FlyersScreen` / `FlyerItemsScreen` in 2–4 column elevated MD3 cards.

### Meals & Recipes

- [ ] **MEAL-04**: De-clutter `PlannerScreen` by removing triple-stacked mobile chrome in favor of a compact Week Switcher, Day Anchor Pills, and a 7-day vertical `<md-list>` agenda on Compact/Medium (`<840px`) plus a 7-column tonal card board on Expanded (`>=840px`).
- [ ] **MEAL-05**: Overhaul `MealPlacementSheet` and `PlaceOnPlannerSheet` as Modal Bottom Sheets featuring a Segmented Button meal-slot selector, `<md-outlined-text-field>` custom entry, `<md-suggestion-chip>` strip for `QUICK_SUGGESTIONS`, and `<md-list>` recipe picker.
- [ ] **MEAL-06**: Overhaul `RecipeLibraryScreen` (Search Bar + `<md-filter-chip>` `"Ready now"`/`"On sale"` + tonal `RecipeCard`s), `RecipeDetailScreen` (tonal `ReadinessBreakdown`, clean `<md-list>` `IngredientRow` actions, tabbed `MatchToSheet` `Pantry | Deals`, `ListPickerSheet`), and `RecipeForm` as a Full-Screen/Centered Dialog with borderless `IngredientEditor`.

### Bills, Chores & Settings

- [ ] **BILL-01**: Overhaul `BillsIndexScreen` (`<md-list>` sections `Overdue`/`Upcoming`/`Inactive`, `<md-fab>`, zero 1-item overflow menus via consolidated `BillRow` actions) and `SubscriptionsScreen` (tonal Hero Card + borderless `<md-list>`).
- [ ] **BILL-02**: Overhaul `BillDetailScreen` (Top App Bar `Edit` + multi-item `OverflowMenu`, tonal summary card, `<md-list>` `PaymentHistory` with direct `Delete` icon on skipped rows, `PaymentEditSheet` Modal Bottom Sheet) and Full-Screen Dialog / pushed `BillForm` using `<md-switch>` toggles.
- [ ] **CHOR-01**: Overhaul `ChoresListScreen` (`<md-list>`, quick `Done` tonal icon button, `<md-fab>`), `ChoreDetailScreen` (single `<h1>`, direct `Edit` icon button, direct `Delete` icon on latest `CompletionHistory` entry), and `ChoreFormScreen` (single `<h1>`, `<md-switch>`, tonal `<md-list>` `RotationEditor`).
- [ ] **CHOR-02**: Overhaul `ErrandsListScreen` (`<md-list>` + `<md-checkbox>`, direct trailing `Delete` icon with persistent Undo Snackbar, `<md-fab>`, `ErrandSheet` Modal Bottom Sheet, and unified collapsible `Completed` section matching `Bought`).
- [ ] **SET-01**: Replace `SettingsScreen`'s 6-section stacked form wall with a categorized `<md-list>` hub opening focused sheets/dialogs or sub-views (`Account`, `Households & Invites`, `Household Preferences & Stores`, `Notifications`, `About & System Health`).
- [ ] **SET-02**: Convert `NotificationTypeRows` checkboxes to real `<md-switch>` controls with a tonal device guidance banner, and modernize `FavoriteStores` with `<md-filter-chip>` selected pills and an `<md-list>` picker.
- [ ] **SET-03**: Redesign `SystemHealthScreen` as a borderless `<md-list>` diagnostic panel and `DepartureScreen` as a single-column progressive flow (`ReassignmentList` `<md-outlined-select>`, tonal `RotationNotes`, `error`-styled `<md-dialog>` delete confirmation).

### Verification & Quality Gates

- [ ] **VER-01**: Update Vitest unit and component suites (`tokens.test.ts` light/dark AA across all 5 `surfaceContainer*` tiers, `primitives.test.tsx`, `shell.test.tsx`, and screen tests) to pass on the locked Phase 1 harness while meeting coverage thresholds (`84/80/77/85`).
- [ ] **VER-02**: Update all 24 Playwright E2E specs to MD3 semantic locators with zero functional regressions across offline queues, barcode scanning, deals/flyers, meals, bills, chores, auth, and household departure.
- [ ] **VER-03**: Pass light and dark WCAG 2.1 AA accessibility audits (`17-accessibility-states.spec.ts` + `e2e/support/axe.ts` `{ subtree: true }` animation settling) across all routes.
- [ ] **VER-04**: Pass all build and CI ratchets: `check-build.mjs` (`<= 200 KB` gzipped shell budget + `MAGIC_LINK_COPY`), Caddy `'self'` CSP + Workbox offline precaching, `pnpm lint`, `pnpm typecheck`, `pnpm knip` + `scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `audit-prod.mjs`, and `scripts/check-repo-hygiene.mjs` (LF endings, zero legacy tokens).

## Future Requirements (Deferred)

### Advanced Pantry & Deal Features (Carried from v2.1)

- **SCAN-05**: Barcode scanning directly to household pantry inventory with expiration date tracking.
- **SCAN-06**: Continuous multi-barcode scanning mode for rapid pantry auditing.
- **DEAL-04**: Automated deal price history tracking to identify "all-time low" prices.
- **DEAL-05**: Cross-store deal price comparison for identical UPC/barcodes.

### Deferred UI Enhancements (v3.x)

- **MEAL-07**: Server-side multi-page recipe search replacing current page-1 client filtering.
- **LIST-04**: Touch swipe-to-complete / swipe-to-delete gestures on shopping list rows.
- **FND-06**: Experimental M3 Expressive motion/spring physics and custom shape morphing.

## Out of Scope

| Feature | Reason |
|---------|--------|
| `@material/web/all.js` eager bundle import | Blows `200 KB` gzipped `SHELL_BUDGET_BYTES` (`78.89 KB` gz alone) in `check-build.mjs` |
| Unstable `@material/web/labs/*` widgets | Pre-release churn and broken ARIA roles (e.g. `labs/navigationbar` uses `role="tablist"`) |
| External Google Fonts CDN requests | Violates `docker/Caddyfile` `default-src 'self'` CSP and offline PWA requirements |
| Multi-tenant household segregation | Remains single household / small family circle under existing RLS schema |
| Rewriting database migration history | Migrations remain strictly forward-only / append-only |
| Replacing Fastify / Vite / Postgres stack | Core backend, API contracts, and persistence stack stay unchanged |
| Federated OAuth providers | Retaining email/password + GoTrue magic link authentication |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | TBD | Pending |
| FND-02 | TBD | Pending |
| FND-03 | TBD | Pending |
| FND-04 | TBD | Pending |
| FND-05 | TBD | Pending |
| NAV-01 | TBD | Pending |
| NAV-02 | TBD | Pending |
| NAV-03 | TBD | Pending |
| NAV-04 | TBD | Pending |
| DASH-01 | TBD | Pending |
| DASH-02 | TBD | Pending |
| AUTH-06 | TBD | Pending |
| AUTH-07 | TBD | Pending |
| LIST-01 | TBD | Pending |
| LIST-02 | TBD | Pending |
| LIST-03 | TBD | Pending |
| DEAL-06 | TBD | Pending |
| DEAL-07 | TBD | Pending |
| MEAL-04 | TBD | Pending |
| MEAL-05 | TBD | Pending |
| MEAL-06 | TBD | Pending |
| BILL-01 | TBD | Pending |
| BILL-02 | TBD | Pending |
| CHOR-01 | TBD | Pending |
| CHOR-02 | TBD | Pending |
| SET-01 | TBD | Pending |
| SET-02 | TBD | Pending |
| SET-03 | TBD | Pending |
| VER-01 | TBD | Pending |
| VER-02 | TBD | Pending |
| VER-03 | TBD | Pending |
| VER-04 | TBD | Pending |

**Coverage:**
- v3.0 requirements: 32 total
- Mapped to phases: 0
- Unmapped: 32

---
*Requirements defined: 2026-11-11*
*Last updated: 2026-11-11 after initial definition*
