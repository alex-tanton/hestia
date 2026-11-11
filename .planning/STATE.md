---
gsd_state_version: "1.0"
milestone: v3.0
milestone_name: Material Design 3 Overhaul
status: planning
last_updated: "2026-11-11T20:55:03Z"
last_activity: 2026-11-11
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-11)

**Core value:** Completely overhaul Hestia's frontend across all screens using Google's Material Design 3 for Web (`@material/web`) to deliver minimal, uncluttered visuals, unified Warm Terracotta tonal theming, restructured navigation, and clear flow of control.
**Current focus:** Phase 17 — MD3 Foundation, Token Pipeline & UI Primitives

## Current Position

Phase: 17 of 21 (MD3 Foundation, Token Pipeline & UI Primitives)
Plan: 0 of 0 in current phase
Status: Ready to plan
Last activity: 2026-11-11 — v3.0 Material Design 3 Overhaul roadmap created (Phases 17-21)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- Standardize frontend on `@material/web@2.5.0` subpath imports wrapped with `@lit/react@1.0.8` behind `components/md/` -> `components/ui/`, plus static build-time Warm Terracotta `--md-sys-*` CSS tokens (`@material/material-color-utilities`).
- Keep Tailwind CSS coexisting behind `components/ui/` through Phases 17-20 and defer `FND-05` dependency removal plus Knip baseline reconciliation to Phase 21 so unit and sequential E2E suites stay verifiable at every step.
- Lock Phase 17 architectural decisions upfront before Phase 18 shell work: (1) Material Symbols delivery behind `Icon.tsx` (`@material-symbols/font-400` WOFF2 vs inline `@material-symbols/svg-400`) and (2) Vitest DOM component harness (`jsdom` + forced `element-internals-polyfill` vs `@vitest/browser-playwright`).

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-11 20:55
Stopped at: Created v3.0 roadmap (Phases 17-21) and mapped all 32 requirements
Resume file: None
