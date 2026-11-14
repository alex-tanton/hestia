---
gsd_state_version: "1.0"
milestone: v3.0
milestone_name: Material Design 3 Overhaul
current_phase: 18
current_phase_name: Adaptive MD3 Navigation Shell & Route Chrome
status: ready
stopped_at: Completed Phase 17 (17-15-PLAN.md release verification gate)
last_updated: "2026-11-14T18:51:00.000Z"
last_activity: 2026-11-14
last_activity_desc: Completed Phase 17 (MD3 Foundation, Token Pipeline & UI Primitives)
state_head: 392a1c0cb1f41d39986bfa332b702ecf0a6d0ca0
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 15
  completed_plans: 15
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-14)

**Core value:** Completely overhaul Hestia's frontend across all screens using Google's Material Design 3 for Web (`@material/web`) to deliver minimal, uncluttered visuals, unified Warm Terracotta tonal theming, restructured navigation, and clear flow of control.
**Current focus:** Phase 18 — Adaptive MD3 Navigation Shell & Route Chrome

## Current Position

Phase: 18 (Adaptive MD3 Navigation Shell & Route Chrome) — READY TO PLAN
Plan: 0 of TBD
Status: Ready to plan
Last activity: 2026-11-14 — Completed Phase 17 release verification gate

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: ~15 min
- Total execution time: ~3.7 hrs

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 17 | 15 | ~225 min | ~15 min |

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-12T15:32:31.378Z
Stopped at: Completed 17-10-PLAN.md
Resume file: None
