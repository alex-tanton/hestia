---
gsd_state_version: "1.0"
milestone: v3.0
milestone_name: Material Design 3 Overhaul
current_phase: 21
current_phase_name: Legacy Stack Cleanup & Full Verification
status: planning
stopped_at: Phase 20 complete, ready to plan Phase 21
last_updated: "2026-11-15T20:42:41.762Z"
last_activity: 2026-11-15
last_activity_desc: Phase 20 complete, transitioned to Phase 21
state_head: 5dda9fd7103e0cf8c73f8a922fa732539cb95a24
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 27
  completed_plans: 27
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-15)

**Core value:** Completely overhaul Hestia's frontend across all screens using Google's Material Design 3 for Web (`@material/web`) to deliver minimal, uncluttered visuals, unified Warm Terracotta tonal theming, restructured navigation, and clear flow of control.
**Current focus:** Phase 21 — Legacy Stack Cleanup & Full Verification

## Current Position

Phase: 21 — Legacy Stack Cleanup & Full Verification
Plan: Not started
Status: Ready to plan
Last activity: 2026-11-15 — Phase 20 complete, transitioned to Phase 21

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 32
- Average duration: ~15 min
- Total execution time: ~4.0 hrs

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 17 | 15 | ~225 min | ~15 min |
| 18 | 3 | - | - |
| Phase 19 | 5 | ~85 min | ~17 min |
| 19 | 5 | - | - |
| 20 | 4 | - | - |

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 17 P01 | 11 min | 2 tasks | 5 files |
| Phase 17 P02 | 5m 25s | 2 tasks | 6 files |
| Phase 17 P03 | 13m 33s | 2 tasks | 8 files |
| Phase 17 P04 | 20 min | 2 tasks | 10 files |
| Phase 17 P05 | 11 min | 2 tasks | 6 files |
| Phase 17 P06 | 25min | 3 tasks | 10 files |
| Phase 17 P07 | 33min | 3 tasks | 10 files |
| Phase 17 P08 | 24min | 2 tasks | 9 files |
| Phase 17 P09 | 10min | 2 tasks | 8 files |
| Phase 17 P10 | 19 min | 2 tasks | 6 files |
| Phase 17 P11 | 22 min | 2 tasks | 8 files |
| Phase 17 P12 | 26 min | 2 tasks | 9 files |
| Phase 17 P13 | 18 min | 2 tasks | 7 files |
| Phase 17 P14 | 24 min | 2 tasks | 8 files |
| Phase 17 P15 | 20 min | 3 tasks | 6 files |
| Phase 18 P01 | 18m | 3 tasks | 8 files |
| Phase 18 P02 | 35m | 3 tasks | 7 files |
| Phase 18 P03 | 25m | 2 tasks | 7 files |
| Phase 19-entry-dashboard-grocery-ecosystem-screens P19-02 | 15m | 3 tasks | 12 files |
| Phase 19 P03 | 18m | 3 tasks | 12 files |
| Phase 19 P04 | 15m | 2 tasks | 2 files |
| Phase 19 P05 | 20m | 3 tasks | 11 files |

## Accumulated Context

### Decisions

- Standardize frontend on `@material/web@2.5.0` subpath imports wrapped with `@lit/react@1.0.8` behind `components/md/` -> `components/ui/`, plus static build-time Warm Terracotta `--md-sys-*` CSS tokens (`@material/material-color-utilities`).
- Keep Tailwind CSS coexisting behind `components/ui/` through Phases 17-20 and defer `FND-05` dependency removal plus Knip baseline reconciliation to Phase 21 so unit and sequential E2E suites stay verifiable at every step.
- Lock Phase 17 architectural decisions upfront before Phase 18 shell work: (1) Material Symbols delivery behind `Icon.tsx` (`@material-symbols/font-400` WOFF2 vs inline `@material-symbols/svg-400`) and (2) Vitest DOM component harness (`jsdom` + forced `element-internals-polyfill` vs `@vitest/browser-playwright`).
- [Phase 17]: Load @material/material-color-utilities@0.4.0 via Vite SSR in apps/web/scripts/generate-tokens.mjs for deterministic LF tokens.css
- [Phase 17]: Clamp harmonized status tokens (#15803D, #A16207, #0369A1) via Material TonalPalette (40/100/90/10 light, 80/20/30/90 dark) for >= 4.5:1 AA contrast across all 5 surfaceContainer tiers
- [Phase 17]: Removed legacy palette ramps and [data-section] selectors from index.css; bridged all 32 @theme inline tokens plus --md-focus-ring-color onto --md-sys-*
- [Phase 17]: Split Vitest test.projects into unit (node, extends: false) and dom (jsdom, extends: true) with explicit 6-file DOM_UNIT_TS_TESTS list preserving 84/80/77/85 thresholds
- [Phase 17]: Encoded Warm Terracotta PWA icon background as 3-byte RGB [0x8e, 0x4c, 0x32] to match colour type 2 PNG encoder
- [Phase 17]: Preserved jsx-a11y default ignoreElements/ignoreRoles/includeRoles on control-has-associated-label while banning @material/web, lit, and @lit outside components/md/ and retaining test CLOCK_READS/FORMATTER_READS (17-03)
- [Phase 17]: Used zero-cast Reflect.set omitUndefined helper, EventTarget-backed microtask animate shim, and createHostQueries factory in md-queries.ts (17-03)
- [Phase 17]: Kept jsdom@30.1.0 + element-internals-polyfill@3.0.2 for Material Web tests by configuring Vitest dom ssr.resolve.conditions browser + server.deps.inline and standard matchMedia/scrollTo/setValidity shims (no @vitest/browser-playwright escalation)
- [Phase 17]: Extended useFieldErrors invalid-field focus selector to match data-aria-invalid and error host state emitted by @material/web mixinDelegatesAria
- [Phase 17]: Rejected @material-symbols/svg-400 per user supply-chain directive; generated static icon-paths.ts from official google/material-design-icons@10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7 via apps/web/scripts/generate-icon-paths.mjs (17-05)
- [Phase 17]: Pass ariaInvalid: 'true' | undefined literal in Field/Select (zero as casts) and restrict Vitest dom resolve/ssr conditions to ['browser', 'development'] for jsdom decimal.js compatibility.
- [Phase 17]: Deduplicate MdSwitch onInput/onChange with microtask flag and add tabIndex=0 on enabled MdCheckbox/MdSwitch hosts for jsdom user-event label/Tab compatibility
- [Phase 17]: Handle RTL-aware Arrow/Home/End keyboard navigation in Tabs onKeyDown with event.preventDefault() to bypass jsdom :focus-within limitation without double-navigating in browsers
- [Phase 17]: ModalBottomSheet delegates Sheet via useState trigger element and native dialog useEffect keydown/pointer fallback
- [Phase 17]: Snackbar uses single-slot FIFO ToastProvider with 4000ms non-action duration and persistent error/Undo
- [Phase 17]: Replaced Radix ToggleGroup in SegmentedControl with light-DOM role=radiogroup and button[role=radio] implementing roving Arrow/Home/End focus, RTL support, scrollIntoView, and locked active selection
- [Phase 17]: Upgraded Card (.hestia-card, surfaceContainerLow/surfaceContainer, elevation-1, no overflow-hidden), ListRow (min-h-12, optional slot omission), Badge/FormMessage/CopyButton (Icon.tsx), and Skeleton (surface-container-highest)
- [Phase 17]: browser.ts openMenu resolves MdIconButton hosts via findMdButton and focuses the inner shadow <button> before dispatching Enter
- [Phase 18]: Use Material Symbols with filled variants for active destination icons and outlined for inactive
- [Phase 18]: Keep mobile Settings icon button in TopBar for <600px and bottom-pinned destination in NavigationRail for >=600px
- [Phase 18]: Maintain single-h1 strictly in TopBar while demoting detail/form screen body headings to h2
- [Phase 18]: Migrate SubTabs to MD3 Primary Tabs with explicit ARIA roles (role=tablist / role=tab) and aria-selected for robust accessibility and testing support
- [Phase 18]: Reset scroll position with window.scrollTo(0, 0) when switching pillar sub-tabs
- [Phase 18]: Replace custom Popover/dialog in HouseholdSwitcher with ModalBottomSheet, adding single-household guidance copy ('No other households') and fixed 112x20px skeleton pill
- [Phase 18]: Completely purge SectionProvider and SubSectionComingSoon from the codebase to eliminate legacy section context
- [Phase 18]: Consolidate Meals sub-tabs from 3 to 2 (Planner | Recipes) and redirect /meals/suggestions to /meals/recipes?filter=ready with replace: true
- [Phase 18]: Use child text content for MdFilterChip label to adhere to @material/web deprecation of label property
- [Phase 18]: Render a surfaceContainerLow Card empty state with 'No matching recipes' and 'Clear recipe filter' button when zero recipes match pantry or deal criteria
- [Phase 18]: Delete orphaned SuggestionsScreen and suggestions copy to preserve the 27-row Knip baseline
- [Phase 19-entry-dashboard-grocery-ecosystem-screens]: Preserve exact build contract string 'Email me a sign-in link' in SignInScreen under HESTIA_PUBLIC_MAGIC_LINK_ENABLED gating
- [Phase 19-entry-dashboard-grocery-ecosystem-screens]: Keep ForgotPasswordScreen informational card without input form aligning with self-hosted admin reset pattern
- [Phase 19-entry-dashboard-grocery-ecosystem-screens]: Update onboarding step button CTAs to 'Create household group' and 'Join household group' per MD3 copywriting contract
- [Phase 19]: Migrated ListNameSheet from bottom sheet to MdDialog basic prompt with proper form submission handling
- [Phase 19]: Created MdFab wrapper around @material/web/fab/fab.js for floating action buttons
- [Phase 19]: Added persistent undo snackbar on grocery item checkoff with immediate optimistic state update
- [Phase 19]: Implemented SyncToPantrySheet with prefilled storage locations and estimated shelf life
- [Phase 19]: Organized PantryScreen with storage location chips (All, Fridge, Freezer, Pantry) and expiry status badges
- [Phase 19]: Restyled BarcodeScannerDialog as an MD3 dark-scheme full-screen dialog with top-bar actions, corner-bracket reticle, in-HUD naming ModalBottomSheet, and single-slot persistent Undo snackbar queue
- [Phase 19]: Formatted DealCard on mobile (<600px) as single-column horizontal card with 72x72 photo, bold price, tonal discount badge, and circular + Add button (19-05)
- [Phase 19]: Lifted shared AddToListSheet to screen level with smart 1-list immediate addition paired with persistent Undo Snackbar (19-05)
- [Phase 19]: Overhauled DealSearchScreen with MD3 search bar, SegmentedControl, quick filter chips, and FilterModalBottomSheet; presented FlyersScreen in 2-4 column elevated MD3 card grid (19-05)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-15T20:43:00.000Z
Stopped at: Phase 20 complete, ready to plan Phase 21
Resume file: None
