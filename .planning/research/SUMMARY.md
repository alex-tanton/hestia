# Project Research Summary

**Project:** Hestia v3.0 — Material Design 3 Overhaul (`apps/web`)
**Domain:** Self-Hosted Household Management PWA (React 19 + TypeScript 6 + Vite 8 + Workbox)
**Researched:** 2026-11-11
**Confidence:** HIGH

## Executive Summary

Hestia (`apps/web`) is an offline-capable household management PWA spanning 7 domain screen groups (`Dashboard`, `Lists/Deals/Flyers/Pantry`, `Meals/Recipes`, `Bills/Subscriptions`, `Chores/Errands`, `Onboarding/Auth`, and `Settings/SystemHealth/Departure`), all of which must retain 100% functional parity across offline queues, realtime list sync, barcode scanning, Flipp deals, bill/chore recurrence, auth, and departure reassignment. Across all four research tracks, the clear expert architecture for bringing authentic Material Design 3 (MD3) to React 19 + TypeScript 6 is **Google `@material/web@2.5.0`** consumed exclusively via **per-component subpath imports** wrapped with **`@lit/react@1.0.8`** inside a strict UI interop boundary (`apps/web/src/components/md/` and `components/ui/`), paired with **build-time MD3 token generation (`@material/material-color-utilities@0.4.0`)** into static light/dark CSS and clean light-DOM/native-`<dialog>` primitives for the MD3 surfaces absent from `@material/web` (`NavigationBar`, `NavigationRail`, `TopAppBar`, `ModalBottomSheet`, `Card`, `Badge`, `Snackbar`, `SegmentedControl`, and native `date`/`time` fields). Removing `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, and `lucide-react` replaces fragmented `1px` borders and 5 competing per-pillar color ramps with one unified **Warm Terracotta** tonal surface hierarchy and standard MD3 Window Size Class navigation (`<600px` Navigation Bar -> `>=600px` Navigation Rail).

Beyond visual styling, v3.0 resolves accumulated UX and accessibility friction across the app: consolidating `Meals` from 3 tabs to 2 (`Planner | Recipes`, folding `SuggestionsScreen` into a filter chip), replacing `SubTabs`'s misused `SegmentedControl` with MD3 Primary Tabs, stripping triple-stacked mobile Planner chrome, collapsing `DealSearchScreen`'s always-open filter grid behind `<md-filter-chip>` triggers, lifting a single screen-level `AddToListSheet`, migrating `ListNameSheet` to `<md-dialog>` and `BillForm`/`RecipeForm`/`BarcodeScannerDialog` to full-screen/pushed flows, eliminating all 1-item overflow menus, enforcing a single `<h1>` in the Top App Bar (`RecipeDetailScreen` chrome fix), converting `NotificationTypeRows` checkboxes to `<md-switch>`, and making `Undo` Snackbars persistent until acted upon. Isolating all `<md-*>` custom elements behind typed React wrappers protects feature screens from React 19 camelCase custom-event bugs (`onClose` vs `'close'`, `onInput` vs `onChange`), `md-switch` `selected` property differences, TypeScript 6 `exactOptionalPropertyTypes` (`TS2375`) errors, `eslint-plugin-jsx-a11y` strict failures, and `.jscpd.json` duplication limits.

The primary execution risks are (1) breaching the `200 KB` gzipped shell budget (`SHELL_BUDGET_BYTES` in `apps/web/scripts/check-build.mjs`) or `docker/Caddyfile` strict `'self'` CSP via `@material/web/all.js` (`78.89 KB` gz) or external/oversized icon fonts; (2) `jsdom@30.1.0` partial `attachInternals()` / missing `showModal()` and `animate()`, plus `@testing-library/dom` Shadow DOM opacity breaking 63 unit tests and 24 sequential Playwright + `@axe-core/playwright` E2E specs; (3) warm terracotta/amber hues failing WCAG AA `4.5:1`/`3:1` contrast across `surfaceContainer*` elevation tiers; and (4) big-bang UI/CI failures across `knip` (bidirectional 26-row baseline), `jscpd`, and LF repo hygiene. Mitigation requires strictly bottom-up phased delivery (keeping Tailwind coexisting until final `MD3-VERIFY` cleanup), settling two explicit Phase 1 technical trade-offs upfront (Material Symbols delivery and unit component test harness), and enforcing `check-build.mjs` + expanded `tokens.test.ts` gates at every phase boundary.

---

## Key Findings

### Recommended Stack

Adopt `@material/web@2.5.0` stable subpaths + `@lit/react@1.0.8` + build-time `@material/material-color-utilities@0.4.0` while deleting `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `radix-ui@1.6.7`, and `lucide-react@1.47.0` at final cleanup. Never import `@material/web/all.js` (`460.24 KB` min / `78.89 KB` gz) or unstable `@material/web/labs/*` (`labs/navigationbar` misuses `role="tablist"`, breaking `<NavLink>` semantics; `labs/card` and `labs/segmentedbutton` carry pre-release churn). See [STACK.md](./STACK.md) for measured `esbuild` weights and exact API details.

**Core technologies:**
- `@material/web@2.5.0`: Core MD3 controls, ripple, elevation, focus ring, and `md-typescale-styles.css` — shell-eager subpaths (`icon`, `icon-button`, buttons, `ripple`, `focus-ring`, `elevation`) add `17.18 KB` gz (including `lit` + `@lit/react`), offset by reclaiming `~36–40 KB` gz from Radix/Lucide/Tailwind; heavy controls (`outlined-text-field`, `outlined-select`, `checkbox`, `switch`, `tabs`, `chips`) must stay in lazy route/sheet chunks (`325.41 KB` min / `62.82 KB` gz if all bundled eagerly).
- `@lit/react@1.0.8`: Strongly typed React 19 custom-element wrapper factory (`1.36 KB` min / `0.77 KB` gz) — maps lowercase/hyphenated custom events (`close`, `closed`, `cancel`, `input`, `change`) to React camelCase callbacks and avoids manual `JSX.IntrinsicElements` boilerplate.
- `@material/material-color-utilities@0.4.0` (devDependency): Build-time `Hct.fromInt(argbFromHex(...))` + `SchemeTonalSpot` + `MaterialDynamicColors` (instance methods) + `Blend.harmonize` — emits all 49 static `--md-sys-color-*` light/dark roles (`0 KB` runtime JS; execute via `esbuild`/Vite rather than raw Node 24 ESM due to extensionless import in `color_spec_2025.js:21`).
- Custom Light-DOM / Native `<dialog>` Primitives: Implements verified `@material/web` gaps (`NavigationBar`, `NavigationRail`, `TopAppBar`, `ModalBottomSheet` via native `<dialog>.showModal()`, `Card`, `Badge`, `Snackbar`, `SegmentedControl`, and styled native `<input type="date"|"time">` because `date`/`time` are `UnsupportedTextFieldType` in `@material/web`).

### Technical Trade-Offs to Reconcile (Phase 1 / Phase 2 Planning)

The four reports surfaced two deliberate implementation trade-offs where `STACK.md` and `ARCHITECTURE.md` / `PITFALLS.md` propose different defaults. Both are isolated behind single Phase 1 boundaries and must be locked explicitly in Phase 1 before Phase 2 shell work begins:

#### 1. Material Symbols Delivery: Variable WOFF2 (`@material-symbols/font-400`) vs. Curated Inline SVGs (`@material-symbols/svg-400`)

| Option | Empirical Evidence & Pros | Risks & Mitigations Required |
|---|---|---|
| **`@material-symbols/font-400@0.48.3`** (`outlined.css` in `src/main.tsx` + `'woff2'` in `vite.config.ts` `globPatterns`) — *Recommended by `STACK.md`* | Empirically verified at **482.4 KiB (`493,972` B)** (24% of Workbox's 2 MiB cap, unlike `material-symbols` full `3.83 MiB`), natively carries `FILL: 0..1` variable axis (`fvar`) for active nav icon fill transitions, uses `font-display: block` (no FOUT), matches `<md-icon>` default font family, adds **0 bytes** to `SHELL_BUDGET_BYTES` (`200 KB` index-preloaded JS/CSS), and traces cleanly in Knip. | Raw `<md-icon>settings</md-icon>` ligatures leak `"settings Settings"` into `textContent` and screen readers unless **all** usages go through `Icon.tsx` forcing `aria-hidden="true"`; adds ~482 KiB to offline SW precache and requires `'woff2'` in `injectManifest.globPatterns` (verified by `sw.test.ts`). |
| **`@material-symbols/svg-400@0.48.3`** (curated inline SVG map inside `Icon.tsx` for Hestia's ~49–54 distinct icons) — *Preferred by `ARCHITECTURE.md` & `PITFALLS.md`* | **0 bytes** of `.woff2` precache weight, zero `globPatterns` font changes, zero FOIT/FOUT, and **structurally immune** to ligature `textContent` / screen-reader leaks across unit and E2E tests. | Adds `~15–30 KB` min (`~6–8 KB` gz, comparable to removed `lucide-react`'s `5.91 KB` gz) to JS chunks, requires maintaining a typed icon registry plus importing filled (`-fill`) SVG variants for the 5 active nav destinations instead of CSS `'FILL' 1`. |

**Reconciled Phase 1 Recommendation:** Isolate **all** icons behind `apps/web/src/components/ui/Icon.tsx` (banning raw `<md-icon>` text ligatures in screens). **Default to `@material-symbols/font-400@0.48.3` inside `Icon.tsx` (with mandatory `aria-hidden="true"` + `'woff2'` in `globPatterns`)** if preserving maximum `SHELL_BUDGET_BYTES` headroom (`200 KB`) and CSS `'FILL' 0->1` nav transitions is prioritized; **switch cleanly to `@material-symbols/svg-400@0.48.3` inside `Icon.tsx`** if keeping the offline SW cache free of the `482.4 KiB` font payload and guaranteeing zero ligature `textContent` leakage outweighs `~6–8 KB` gz of JS bundle weight.

#### 2. Component Test Harness: `jsdom@30.1.0` + Polyfills vs. Vitest Browser Mode (`@vitest/browser-playwright`)

| Option | Empirical Evidence & Pros | Risks & Mitigations Required |
|---|---|---|
| **`jsdom@30.1.0` + `element-internals-polyfill@3.0.2` + DOM shims** — *Verified by `STACK.md` / hedged in `PITFALLS.md`* | Empirically verified against 14 `@material/web@2.5.0` elements in `jsdom@30.1.0` + React `19.3.0`: keeps the fast existing RTL loop across 63 test files with zero Chromium startup in `pnpm test` (`vitest`), provided `test-setup.ts` **unconditionally** calls `forceElementInternalsPolyfill()`, `forceCustomStateSetPolyfill()`, normalizes `setValidity` flags with `Boolean(v)` (for `md-radio`), and stubs `matchMedia`, `IntersectionObserver`, `HTMLDialogElement.prototype.{showModal,show,close}`, and `Element.prototype.{animate,getAnimations}`. | `jsdom` lacks `ShadowRoot.adoptedStyleSheets` and genuine `<dialog>.showModal()` Top Layer/focus-trap behavior; `@testing-library/dom` does not pierce Shadow DOM (requiring `within(host.shadowRoot)` helpers); masks CSS cascade and anchor-positioning bugs until Playwright E2E runs. |
| **Vitest 5 `projects` (`node` + `@vitest/browser-playwright@5.0.1`)** — *Recommended by `ARCHITECTURE.md`* | Splits pure logic + `tokens.test.ts` into millisecond `node` tests while running UI primitives, shell, and screen specs in headless Chromium (reusing already-installed Playwright). Eliminates all JSDOM shims, verifies real Shadow DOM, `adoptedStyleSheets`, `<dialog>.showModal()`, and CSS tokens, and unifies `page.getByRole` Shadow-DOM queries with Playwright E2E. | Adds `@vitest/browser-playwright`/`vitest-browser-react`, requires adapting RTL queries in component tests, slows local unit runs relative to JSDOM, and risks `@vitest/coverage-v8` heap bloat across 63 files in CI without pool/isolation tuning. |

**Reconciled Phase 1 Recommendation:** Adopt a **Vitest `projects` split** (`node` for pure unit tests and `tokens.test.ts`), and **default the DOM component project to `jsdom@30.1.0` + forced `element-internals-polyfill@3.0.2` + `shadow` query helpers** to preserve all 63 existing test files and the `84/80/77/85` coverage CI runtime without heap risk — **contingent on a Phase 1 `primitives.test.tsx` smoke gate** confirming form validation, `md-radio`, and dialog state sync pass cleanly, while keeping the 24 Playwright + `@axe-core/playwright` E2E specs as the non-negotiable truth gate for Top-Layer sheets/dialogs, focus traps, and CSS cascades. Only switch the component project to `@vitest/browser-playwright` if Phase 1 hits an unresolvable JSDOM custom-element fidelity wall and a Phase 1 benchmark proves V8 coverage memory stays stable.

### Expected Features

Full functional parity across all 7 household workflows is mandatory; v3.0 transforms visual hierarchy, navigation IA, and progressive disclosure rather than cutting domain features. See [FEATURES.md](./FEATURES.md) for the complete screen-by-screen inventory.

**Must have (table stakes):**
- **Single Warm Terracotta color & tonal surface system** (`surfaceContainerLowest..Highest`, reserving `error` exclusively for overdue/failed/destructive states; deleting 5 `[data-section]` rainbow themes).
- **Adaptive MD3 shell** (`<600px` 5-destination `NavigationBar` w/ Settings in Top App Bar; `>=600px` `80px` `NavigationRail` w/ bottom Settings anchor) + **Small Top App Bar** enforcing a single `<h1>` and `useScreenChrome` across every route (fixing `RecipeDetailScreen`).
- **Proper overlay & density patterns** — `<md-list>` + `<md-divider inset>` replacing `1px`-bordered row boxes, primary `<md-fab>` creation actions, `<md-dialog>` for 1-field prompts (`ListNameSheet`) and confirms, Modal Bottom Sheets (`28dp` top radius, `<=640dp`) for pickers/quick-adds, Full-Screen Dialogs / pushed routes for `BillForm`, `RecipeForm`, and `BarcodeScannerDialog`, and **persistent-until-acted-upon `Undo` Snackbars**.
- **MD3 Primary Tabs** (`<md-tabs>`) replacing `SegmentedControl` in `SubTabs.tsx`, reserving Segmented Buttons strictly for in-page scope switches.

**Should have (high-leverage differentiators):**
- **Meals consolidation & Planner declutter:** Merge `SuggestionsScreen` into `Recipes` via an `<md-filter-chip>` (`"On sale / Ready now"`), keeping `/meals/suggestions` redirect; strip stacked Planner bars on mobile; render `MealPlacementSheet` `QUICK_SUGGESTIONS` as `<md-suggestion-chip>`s; tab `MatchToSheet` (`Pantry | Deals`).
- **Chip-collapsed filtering & lifted `AddToListSheet`:** Collapse `DealSearchScreen`'s 5-control filter grid into Search Bar + `Favorites | All` toggle + `<md-filter-chip>` strip -> Filter Bottom Sheet; trim `DealCard`; lift one shared `AddToListSheet` instead of per-card portals.
- **Zero 1-item overflow menus & categorized Settings hub:** Promote single actions (`BillRow`, `ChoreDetailScreen`, `ErrandRow`, `CompletionHistory`) to direct icons or multi-item menus; convert `SettingsScreen` from 6 stacked form boxes into a grouped `<md-list>` hub with real `<md-switch>` notifications; gate `HouseholdSwitcher` on `households.length > 1`.

**Defer (`v3.x` non-goals):**
- Server-side multi-page recipe search (keep current client-side page-1 behavior with honest UI scope copy).
- Touch swipe-to-complete / swipe-to-delete list gestures (conflicts with mobile browser back gestures and offline undo timing).
- Experimental M3 Expressive spring physics or unstable `@material/web/labs/*` widgets.

### Architecture Approach

Enforce a clean bottom-up separation so no feature screen ever references `@material/web/*` directly, enabling safe incremental migration while keeping CI green at every step. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full directory layout and interop examples.

**Major components & boundaries:**
1. **Static Token Pipeline (`apps/web/scripts/generate-tokens.mjs` -> `src/styles/*.css`)** — Generates light (`:root`) and dark (`@media (prefers-color-scheme: dark)`) `--md-sys-color-*` + harmonized semantic status tokens (`success`/`warning`/`info`) verified on disk by `tokens.test.ts`; deletes `section-context.tsx` and `[data-section]` CSS overrides.
2. **Custom Element Interop (`src/components/md/` + `src/components/ui/`)** — Encapsulates `@lit/react` `createComponent` factories (`exactOptionalPropertyTypes` normalization, `onInput` vs `onChange`, `closed` dialog state sync, `soft-disabled` click guards, `aria-invalid` host forwarding for `useFieldErrors`, explicit `Switch`/`Checkbox` `aria-label`/`htmlFor`, `positioning="fixed"` on overlay menus/selects), guarded by ESLint `no-restricted-imports` and `settings['jsx-a11y'].components`.
3. **Light-DOM MD3 Gap Primitives (`src/components/ui/`)** — Implements `ModalBottomSheet` (native `<dialog>.showModal()`), `Snackbar`, `Card`, `Badge`, `SegmentedControl`, `ListRow` (avoiding invalid nested interactive children in `md-list-item`), `Skeleton`, and native `date`/`time` fields using `--md-sys-*` tokens + `<md-ripple>`/`<md-elevation>`.
4. **Unified MD3 Application Shell (`src/components/shell/`)** — `AppShell`, `NavigationBar` (`<600px`), `NavigationRail` (`>=600px`), `AppTopBar`, `SubTabs`, `HouseholdSwitcher`, `OfflineBanner`, `UpdatePrompt`, and `OnboardingLayout`, decoupling navigation (`600px`) from wide content grids (`1024px`).
5. **Cleaned Routes & Decomposed Feature Screens (`src/pillars/`, `src/screens/`)** — Removes shadowed `SubSectionComingSoon` cases in `ListsRoute.tsx`, preserves lazy route splits and exact `MAGIC_LINK_COPY` files/strings (`SignInScreen.tsx`, `magic-link.ts`), and breaks apart 300–550-line screen monoliths (`ListDetailScreen`, `ChoreFormScreen`, `PlannerScreen`, `DealSearchScreen`, `SettingsScreen`).

### Critical Pitfalls

Top 5 risks synthesized from [PITFALLS.md](./PITFALLS.md) (all 8 pitfalls mapped to phases below):

1. **Shell Budget (`200 KB` gz) & Caddy CSP (`'self'`) Violations** — `docker/Caddyfile:14` enforces `default-src 'self'` (blocking Google Fonts CDN), `vite.config.ts` omits `woff2` from `globPatterns`, and `@material/web/all.js` adds `78.89 KB` gz. **Avoid:** Import `@material/web` strictly by per-component subpath inside UI wrappers and lazy routes, keep `THEME_COLOR` (`#475569`) updated in `index.html`/`vite.config.ts`, preserve `MAGIC_LINK_COPY`, and verify `apps/web/scripts/check-build.mjs` continuously.
2. **`jsdom@30.1.0` Incomplete `attachInternals` & Shadow DOM Test Blindness** — `jsdom@30.1.0` defines a partial `attachInternals()` stub that bypasses naive `if (!...)` polyfills while omitting `setFormValue`/`setValidity`/`states`, `showModal()`, `animate()`, and `adoptedStyleSheets`; `@testing-library/dom` does not traverse Shadow DOM, and Tailwind/Radix locators (`.line-through`, `.text-section`, `[data-state]`) will break across 63 unit and 24 E2E tests. **Avoid:** Force-override `attachInternals` + `setValidity` coercion + DOM shims in `test-setup.ts` (or use Browser Mode), provide shadow-aware test helpers, and update selectors slice-by-slice alongside each screen PR.
3. **React 19 Custom Element Event, Form Validation (`useFieldErrors`), & Accessibility Desyncs** — `<md-outlined-text-field>` emits `input` per keystroke (`change` only on blur) and places `aria-invalid="true"` inside Shadow DOM (breaking `useFieldErrors.ts` `querySelector('[aria-invalid="true"]')?.focus()`); `<md-checkbox>`/`<md-switch>` fail `<label>` wrapping (`b/294081528`); `md-switch` uses `selected` not `checked`; `<md-dialog>` `Escape` desyncs React `open`; `soft-disabled` still fires `onClick`; and selects/menus clip inside sheets unless `fixed` (`positioning="fixed"`). **Avoid:** Enforce all 6 rules inside `components/ui/` wrappers once before screen migration.
4. **Warm Terracotta/Amber Contrast Failures & `tokens.test.ts` Regressions** — Legacy `themeFromSourceColor()` omits `surfaceContainer*` tokens, and high-chroma warm amber/terracotta roles easily dip below `4.5:1` text / `3:1` UI contrast (`outlineVariant` is `<3:1` and invalid for field borders); shadow fade animations can trigger transient `axe-core` failures. **Avoid:** Generate static CSS via `SchemeTonalSpot` + `MaterialDynamicColors`, expand `tokens.test.ts` across all 5 `surfaceContainer*` tiers in light/dark modes, and update `e2e/support/axe.ts` `settleAnimations()` with `{ subtree: true }`.
5. **Knip Bidirectional Baseline, JSCPD, LF Hygiene & Big-Bang Rewrite Collapse** — `scripts/check-knip-baseline.mjs` fails on both new AND stale entries in the 26-row baseline; `.jscpd.json` caps TS/TSX duplication tightly; `scripts/check-repo-hygiene.mjs` rejects any CRLF line endings or legacy product-name tokens; and sequential single-worker Playwright (`retries: 0`) collapses if Tailwind/Radix are deleted before screens migrate. **Avoid:** Coexist cleanly behind `components/ui/` until Phase 4 cleanup, centralize `@lit/react` factories to stay under `.jscpd.json`, enforce LF endings, and update `knip.json` + `scripts/knip-production-baseline.txt` atomically in Phase 4.

---

## Implications for Roadmap

Research strongly endorses a **4-phase bottom-up structure** (matching the `MD3-FOUNDATION` -> `MD3-NAV-SHELL` -> `MD3-SCREENS` -> `MD3-VERIFY` sequence), with Phase 3 executed in explicit incremental screen waves (or split into 2 execution phases if desired) so unit and sequential E2E baselines remain verifiable at every merge.

### Phase 1: MD3 Foundation, Token Pipeline & Wrapper Interop (`MD3-FOUNDATION`)
**Rationale:** Every shell and feature screen depends on static Terracotta `--md-sys-*` tokens, the Material Symbols `Icon` contract, `@lit/react` / light-DOM `components/ui/` wrappers, and a functioning test harness. Resolving the two technical trade-offs here prevents mid-milestone rework across 60+ files.
**Delivers:**
- Locked ADR decisions + setup for **(1) Material Symbols delivery** (`@material-symbols/font-400` behind `Icon.tsx` w/ `aria-hidden="true"` + `woff2` precaching OR `@material-symbols/svg-400` inline registry) and **(2) Vitest component harness** (`node` unit project + forced `jsdom@30.1.0` polyfills/shadow helpers OR `@vitest/browser-playwright` spike).
- `apps/web/scripts/generate-tokens.mjs` + checked-in light/dark `src/styles/tokens.css`, `typescale.css`, `surface.css`, updated `THEME_COLOR` (`vite.config.ts` / `index.html`), and expanded `tokens.test.ts` validating WCAG AA contrast across all `surfaceContainer*` tiers.
- Full `components/md/` + `components/ui/` primitive suite (`Button`, `Icon`, `Field`, `Select` w/ coarse-pointer parity + `fixed`, `Checkbox`, `Switch` w/ explicit label, `ConfirmDialog`, `ModalBottomSheet` over `<dialog>`, `OverflowMenu`, `Tabs`, `SegmentedControl`, `Card`, `ListRow`, `Badge`, `Snackbar` w/ persistent-on-action rule, `Skeleton`, `FormMessage`) + ESLint `no-restricted-imports` & `jsx-a11y` mappings + `useFieldErrors.ts` compatibility verified in `primitives.test.tsx`.
**Addresses:** Warm Terracotta tonal system, 16px iOS input floor, `soft-disabled` offline accessibility, persistent Undo Snackbar capability, zero shell-budget bloat.
**Avoids:** Pitfalls 1, 2 (wrapper foundation), 3, 4, 5, 6 (CSP & subpath tree-shaking), 7 (gap primitives).

### Phase 2: Unified Responsive Navigation Shell & Route Chrome (`MD3-NAV-SHELL`)
**Rationale:** Migrating the authenticated and onboarding app shells cleanly shifts breakpoints from `1025px` to MD3's `600px` Window Size Class, deletes `[data-section]` rainbow theming and dead shadowed routes, and fixes cross-cutting `<h1>` / `HouseholdSwitcher` / `SubTabs` IA bugs once before touching individual screens.
**Delivers:**
- `NavigationBar` (`<600px`, 5 destinations), `NavigationRail` (`>=600px`, `80px` width + bottom Settings item), `AppTopBar` (single `<h1>`, conditional `HouseholdSwitcher` only when `households.length > 1`), `SubTabs` migrated to MD3 Primary Tabs (`<md-tabs>`), `OfflineBanner`, `UpdatePrompt`, `AppShell`, and `OnboardingLayout`.
- Cleanup of `SectionProvider` (`section-context.tsx`), `[data-section]` theme maps in `sections.ts`, and shadowed `SubSectionComingSoon` cases in `ListsRoute.tsx`.
- Passing `shell.test.tsx`, `onboarding.test.tsx`, and shell/navigation Playwright E2E assertions across `<600px` and `>=600px`/`>=1024px`.
**Uses:** `Icon`, `Tabs`, `ModalBottomSheet`, `Snackbar`, `OverflowMenu`, and `use-media-query.ts` (`NAV_RAIL_QUERY = 600px` vs `WIDE_CONTENT_QUERY = 1024px`).
**Implements:** Unified MD3 Application Shell & route cleanup (`Pattern 4` + `Pattern 5` route scaffolding).
**Avoids:** Pitfalls 2 (`shell.test.tsx` ligature/selector breaks), 6 (eager shell `<= 200 KB` budget check), 7 (Navigation Bar/Rail ARIA semantics).

### Phase 3: Feature Screen Migration & Progressive Disclosure (`MD3-SCREENS`)
**Rationale:** With tokens, wrappers, and shell green, migrating all 7 screen groups **slice-by-slice** alongside their Vitest and Playwright specs preserves a passing test baseline after every PR while eliminating Tailwind/Radix/Lucide usage completely from feature files. *(Roadmapper note: execute in 4–5 ordered domain slices, or split into two milestone phases — Core Daily Flows vs. Operational/Account Flows — if smaller phase granularity is preferred.)*
**Delivers (ordered migration waves):**
- **Wave A (`Dashboard` + `states/` + `Onboarding/Auth`):** Tonal 1–2 col `Dashboard` cards (`error` strictly for overdue), `DashboardFirstRun` hero card, `EmptyState`/`ErrorState`/`OfflineState`, and centered tonal auth/onboarding cards preserving `SignInScreen.tsx` / `magic-link.ts` paths and `MAGIC_LINK_COPY`.
- **Wave B (`Lists`, `Deals`, `Flyers`, `Pantry`):** `ListDetailScreen` decomposition, `ListNameSheet` -> `<md-dialog>`, `<md-fab>` creation CTAs, TopBar Overflow (`Add bought to pantry`, `Archived`), `BarcodeScannerDialog` MD3 full-screen dark dialog, chip-collapsed `DealSearchScreen` + Filter Bottom Sheet, trimmed `DealCard` + single lifted `AddToListSheet`, and `Flyers`/`Pantry` `<md-list>`/`Card` polish.
- **Wave C (`Meals` & `Recipes`):** 2-tab `Planner | Recipes` consolidation (folding `SuggestionsScreen` into `Recipes` filter chip + `/meals/suggestions` redirect), stripped mobile `PlannerScreen` chrome + 7-column desktop grid, `<md-suggestion-chip>` `MealPlacementSheet`, fixed `RecipeDetailScreen` `useScreenChrome` + single `<h1>`, tabbed `MatchToSheet` (`Pantry | Deals`), and full-screen `RecipeForm`.
- **Wave D (`Bills`, `Subscriptions`, `Chores`, `Errands`):** Zero 1-item overflow menus (`BillRow`, `ChoreDetailScreen`, `ErrandRow`, `CompletionHistory`), full-screen/pushed `BillForm`, `Subscriptions` Hero Card, unified collapsible completed section, `<md-list>` `RotationEditor` (preserving `combobox`/`option` Playwright contracts), and single `<h1>` in `ChoreDetailScreen`/`ChoreFormScreen`.
- **Wave E (`Settings`, `SystemHealth`, `Departure`):** Categorized `<md-list>` Settings hub, `<md-switch>` in `NotificationTypeRows`, `FavoriteStores` chip/list picker, tonal `SystemHealthScreen`, and progressive `DepartureScreen` flow.
**Addresses:** Every P0/P1/P2 table-stake and differentiator feature in `FEATURES.md`, plus all `e2e/tests/*` semantic locator updates (`.line-through`, `.text-section`, `[data-state]`).
**Avoids:** Pitfall 8 (big-bang rewrite collapse across 63 unit + 24 sequential E2E specs) and JSCPD duplication across forms.

### Phase 4: Legacy Dependency Removal, Hygiene Reconciliation & Full Verification (`MD3-VERIFY`)
**Rationale:** Deleting `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, and `lucide-react` only after every screen has migrated ensures zero broken intermediate CSS or test builds, and lets Knip, JSCPD, coverage, shell budget, Caddy CSP, and light/dark/offline E2E pass cleanly in one atomic hardening gate.
**Delivers:**
- Uninstallation of `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, and `lucide-react`; removal of `@tailwindcss/vite` from `vite.config.ts`, dead Tailwind CSS/shims, and `"tailwindcss"` from `knip.json` `ignoreDependencies`; atomic update of `scripts/knip-production-baseline.txt`.
- Updated `e2e/support/axe.ts` `settleAnimations()` (`{ subtree: true }`) and verified `17-accessibility-states.spec.ts` light/dark WCAG 2.1 AA, offline PWA precache (`sw.test.ts` + Caddy Docker CSP), and full 24-spec sequential E2E run.
- Passing full CI gate: `pnpm lint`, `pnpm typecheck`, Vitest coverage (`84/80/77/85`), `check-build.mjs` (`<= 200 KB` gz + `MAGIC_LINK_COPY`), `pnpm knip` + `check-knip-baseline.mjs`, `pnpm jscpd`, `audit-prod.mjs`, and `check-repo-hygiene.mjs` (LF endings, zero legacy tokens).
**Avoids:** Pitfalls 5 (light/dark contrast & animation-race verification), 6 (final shell budget + offline Caddy CSP check), 8 (bidirectional Knip baseline & hygiene failures).

### Phase Ordering Rationale

- **Bottom-up dependency graph:** Token CSS -> `@material/web` React wrappers & light-DOM gap primitives -> Responsive `AppShell` -> Domain screen waves -> Legacy removal mirrors the strict code dependency tree in `ARCHITECTURE.md` and `FEATURES.md`.
- **De-risking CI & sequential E2E:** Keeping Tailwind CSS coexisting until Phase 4 lets every Phase 1–3 PR pass unit tests and Playwright E2E continuously instead of maintaining a multi-week red branch.
- **Boundary enforcement:** Creating `components/md/` + `components/ui/` + ESLint restrictions in Phase 1 guarantees TS6 strictness, `jsx-a11y`, `.jscpd.json`, and `useFieldErrors` are solved once rather than repeated in 60+ screen files.

### Research Flags

Phases likely needing targeted spikes or `/gsd-plan-phase --research` during planning:
- **Phase 1 (`MD3-FOUNDATION`):** Validate the two reconciled trade-offs (`@material-symbols/font-400` vs `svg-400` behind `Icon.tsx`; `jsdom` + forced `element-internals-polyfill` vs `@vitest/browser-playwright` heap/speed), tune exact Warm Terracotta seed hex / tone stops across all 5 `surfaceContainer*` roles for WCAG AA contrast in `tokens.test.ts`, and verify `useFieldErrors.ts` + coarse-pointer `Select` + `md-dialog` `closed`/form behavior empirically inside the chosen test harness.
- **Phase 2 (`MD3-NAV-SHELL`):** Verify `ModalBottomSheet` native `<dialog>.showModal()` focus restoration/backdrop behavior across mobile `<600px` and desktop `>=600px`, plus `NavigationRail` / `NavigationBar` E2E selector compatibility (`e2e/support/app.ts`).

Phases following well-established patterns (standard execution, skip deep library research):
- **Phase 3 (`MD3-SCREENS`):** Consumes Phase 1–2 primitives and patterns directly; planning focuses on screen UX decomposition and updating paired unit/E2E selectors per wave.
- **Phase 4 (`MD3-VERIFY`):** Deterministic dependency cleanup, Knip baseline sync, and execution of existing repo CI gates.

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| **Stack** | **HIGH** | All npm versions (`@material/web@2.5.0`, `@lit/react@1.0.8`, `@material/material-color-utilities@0.4.0`, `@material-symbols/font-400@0.48.3`, `@material-symbols/svg-400@0.48.3`, `element-internals-polyfill@3.0.2`), WOFF2 `fvar` tables, `esbuild` bundle sizes, `tsc@6.0.3` checks, and `jsdom@30.1.0` probes were empirically verified. |
| **Features** | **HIGH** | Grounded in full codebase inspection of all 7 screen groups (`apps/web/src/`) cross-referenced against official MD3 specs and verified `@material/web` component coverage. |
| **Architecture** | **MEDIUM-HIGH** | Codebase boundaries, CI gates, and token/shell structure are **HIGH**; final choice between `jsdom` polyfills and `@vitest/browser-playwright` V8 coverage memory under CI warrants a small Phase 1 validation check. |
| **Pitfalls** | **HIGH** | Backed by direct inspection of `jsdom@30.1.0` runtime internals, `docker/Caddyfile`, `apps/web/scripts/check-build.mjs`, `eslint.config.js`, `tsconfig.base.json`, `knip`, `.jscpd.json`, `check-repo-hygiene.mjs`, and `e2e/` Playwright/Axe suites. |

**Overall confidence:** **HIGH**

### Gaps to Address

- **Material Symbols ADR (Font vs. Inline SVG):** Lock in Phase 1 before `Icon.tsx` is wired into Phase 2 `NavigationBar`/`NavigationRail`; measure `check-build.mjs` shell headroom and `sw.test.ts` offline precache directly.
- **Component Test Harness ADR (`jsdom` Polyfills vs. Vitest Browser Mode):** Run `primitives.test.tsx` in Phase 1 to confirm whether `jsdom@30.1.0` + forced `element-internals-polyfill` covers `md-radio`, `md-outlined-select`, `md-outlined-text-field`, and `ModalBottomSheet` cleanly or whether `@vitest/browser-playwright` is warranted.
- **Exact Warm Terracotta Seed Hex & Contrast Overrides:** Candidate terracotta seeds (`#B4532A`–`#C85A32`) need empirical tuning in `generate-tokens.mjs` against all 5 `surfaceContainer*` light/dark backgrounds and `3:1` interactive `outline` tokens inside `tokens.test.ts`.
- **Coarse-Pointer `Select.tsx` Parity & `e2e/support/axe.ts` Shadow Settling:** Confirm during Phase 1/2 that preserving native `<select>` on `(pointer: coarse)` works seamlessly alongside desktop `<md-outlined-select>` Playwright `combobox`/`option` assertions (`RotationEditor`, `e2e/support/app.ts`), and verify `settleAnimations()` (`{ subtree: true }`) settles shadow-root ripple/dialog transitions in `17-accessibility-states.spec.ts`.
- **Client-Side Recipe Search Copy:** Since expanding backend recipe search is deferred (`v3.x`), ensure `RecipeLibraryScreen` surfaces clear UX copy regarding current search/pagination scope during Phase 3 Wave C.

---

## Sources

### Primary (HIGH confidence)
- [STACK.md](./STACK.md) — Empirical npm tarball inspections, `esbuild@0.28.2` shell/chunk measurements, WOFF2 SFNT `fvar` inspection, `tsc@6.0.3` strict checks, and live `jsdom@30.1.0` + React `19.3.0` + `@testing-library/react@16.3.3` probes.
- [FEATURES.md](./FEATURES.md) — Full `apps/web/src/` screen/component inventory across all 7 screen groups, MD3 guidelines (`https://m3.material.io/`), and `@material/web` component gap mapping.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Two-tier `components/md/` -> `components/ui/` boundary design, static `SchemeTonalSpot` token pipeline, `600px` Navigation Rail architecture, and Vitest Browser Mode analysis.
- [PITFALLS.md](./PITFALLS.md) — Direct inspection of `jsdom@30.1.0` internals (`ShadowRoot-impl.js`, `HTMLDialogElement-impl.js`), `docker/Caddyfile`, `apps/web/vite.config.ts`, `apps/web/scripts/check-build.mjs`, `eslint.config.js`, `tsconfig.base.json`, `knip.json`, `scripts/check-knip-baseline.mjs`, `.jscpd.json`, `scripts/check-repo-hygiene.mjs`, and `e2e/` Playwright/Axe specs.

### Secondary (MEDIUM confidence)
- Official documentation reviewed across research reports: `@material/web` v2.5.0 docs/releases (`soft-disabled`, `md-dialog` `type="alert"`/`method="dialog"`, `md-switch` `aria-label` guidance), `@lit/react` React 19 + TS integration, `@material/material-color-utilities` `SchemeTonalSpot`/`MaterialDynamicColors` specs, `eslint-plugin-jsx-a11y` custom component mapping, and Vitest Browser Mode (`@vitest/browser-playwright` + `@vitest/coverage-v8`).

---
*Research completed: 2026-11-11*
*Ready for roadmap: yes*
