---
phase: 19-entry-dashboard-grocery-ecosystem-screens
plan: 01
subsystem: web
tags: [dashboard, states, md3, tonal-surfaces, vitest]
requires: []
provides: [DASH-01, DASH-02]
affects: [apps/web]
tech-stack:
  added: []
  patterns: [tonal-surfaceContainerLow, urgency-ranking, context-adaptive-states]
key-files:
  created:
    - apps/web/src/components/states/StateBlocks.test.tsx
  modified:
    - apps/web/src/components/states/StateBlocks.tsx
    - apps/web/src/components/dashboard/DashboardCard.tsx
    - apps/web/src/components/dashboard/DashboardFirstRun.tsx
    - apps/web/src/screens/DashboardScreen.tsx
    - apps/web/src/components/dashboard/dashboard.test.tsx
    - apps/web/src/screens/dashboard-route.test.tsx
decisions:
  - "StateBlocks: context-adaptive layout prop ('card' vs 'page') using Material Symbols Rounded via Icon.tsx, eliminating lucide-react."
  - "DashboardCard: borderless flat tonal cards using surfaceContainerLow with urgency-first sorting (overdue items ranked first with error semantic styling) and dedicated '+N more in [Pillar]' text button links."
  - "DashboardScreen & FirstRun: responsive 1-column mobile / 2-column md grid with warm tonal DashboardFirstRun hero card featuring stepped quick-start action pills."
metrics:
  duration: 10m
  completed_date: "2026-11-15"
status: complete
actuals:
  tokens: 7855
  tasks: 3
  commits: 3
  plan_head_before: d8797f8f381b4796cf60d623766895a46f4bafc2
  plan_head_after: 880ace4efc288d67a99f1faeebcf6f6336e4f3eb
---

# Phase 19 Plan 01: Dashboard & StateBlocks Summary

Tonal surfaceContainerLow cards, urgency ranking, and adaptive state blocks migrated to Material Design 3 tokens.

## What Was Built

1. **Context-Adaptive StateBlocks (`EmptyState`, `ErrorState`, `OfflineState`)**:
   - Eliminated `lucide-react` imports in favor of `Icon.tsx` (Material Symbols Rounded) and `Button.tsx`.
   - Added support for `layout="card"` (compact inline column with 32dp/24dp icons, body-sm copy, ghost button) and `layout="page"` (centered full-page display with 48dp icon in a 64px `surfaceContainerHigh` pill, title-lg heading, body-md copy, primary button).
   - Created `apps/web/src/components/states/StateBlocks.test.tsx` testing both variants across all three state blocks.

2. **Borderless surfaceContainerLow DashboardCard with Urgency-First Ranking**:
   - Converted `DashboardCard` into borderless flat tonal cards (`variant="flat"`, `bg-[var(--md-sys-color-surface-container-low)]`).
   - Implemented `sortPillarItems` prioritizing overdue items at the top with error semantic tokens (`text-[var(--md-sys-color-error)]` and `Icon name="error"`).
   - Replaced plain text overflow with dedicated text button link `+{remainder} more in {title}` linking directly to the pillar route.
   - Converted card header title into a direct `Link`, eliminating stretched-link collision with interactive card footer buttons.

3. **Responsive 1–2 Column Grid and Tonal DashboardFirstRun Hero**:
   - Updated `DashboardScreen` root layout to `grid grid-cols-1 md:grid-cols-2 gap-4`.
   - Redesigned `DashboardFirstRun` as a warm tonal `surfaceContainerLow` hero card spanning `col-span-full`, with stepped quick-start pills ("Create a shopping list", "Add upcoming bill", "Plan first meal").
   - Synchronized all test suites in `dashboard.test.tsx` and `dashboard-route.test.tsx`.

## Key Commits

- `9d20465`: feat(web): context-adaptive StateBlocks migration and DOM test scaffold
- `9fe944c`: feat(web): borderless surfaceContainerLow DashboardCard with urgency ranking
- `880ace4`: feat(web): responsive 1-2 column DashboardScreen and tonal DashboardFirstRun hero

## Deviations from Plan

None - plan executed exactly as specified. Commitlint scope rule required `feat(web):` rather than `feat(19-01):`, which was applied automatically.

## Known Stubs

None.

## Verification

- `pnpm --filter @hestia/web exec vitest run --project dom src/components/states/StateBlocks.test.tsx`: 6/6 passed.
- `pnpm --filter @hestia/web exec vitest run --project dom src/components/dashboard/dashboard.test.tsx`: 14/14 passed.
- `pnpm --filter @hestia/web exec vitest run --project dom src/screens/dashboard-route.test.tsx`: 11/11 passed.
- `pnpm --filter @hestia/web typecheck`: 0 errors.

## Self-Check: PASSED
