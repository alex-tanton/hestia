---
phase: 21-legacy-stack-cleanup-full-verification
plan: "01"
status: complete
subsystem: ui-web
tags: [md3, styling, cleanup, material-symbols]
requires: []
provides:
  - FND-05
affects:
  - web
tech-stack:
  added: []
  patterns:
    - modular-css-manifest
    - domain-stylesheets
    - md3-window-size-classes
key-files:
  created:
    - apps/web/src/styles/reset.css
    - apps/web/src/styles/layout.css
    - apps/web/src/styles/meals.css
    - apps/web/src/styles/bills.css
    - apps/web/src/styles/chores.css
    - apps/web/src/styles/deals.css
    - apps/web/src/styles/lists.css
    - apps/web/src/styles/settings.css
  modified:
    - apps/web/package.json
    - apps/web/vite.config.ts
    - apps/web/src/index.css
    - apps/web/src/lib/sections.ts
    - apps/web/src/components/states/StaleNotice.tsx
    - apps/web/src/screens/PillarScreen.tsx
    - apps/web/src/components/shell/AppShell.tsx
    - apps/web/src/components/shell/TopBar.tsx
    - apps/web/src/components/shell/NavigationBar.tsx
    - apps/web/src/components/shell/NavigationRail.tsx
    - apps/web/src/screens/meals/PlannerScreen.tsx
    - apps/web/src/screens/bills/BillsIndexScreen.tsx
    - apps/web/src/screens/chores/ChoresListScreen.tsx
    - apps/web/src/screens/settings/SettingsScreen.tsx
decisions:
  - "Pruned tailwindcss, @tailwindcss/vite, radix-ui, and lucide-react from apps/web and migrated all surviving Lucide icons to Material Symbols Rounded via Icon.tsx"
  - "Centralized CSS architecture into 8 domain stylesheets under apps/web/src/styles/ imported via a 10-line modular index.css manifest with zero Tailwind directives"
  - "Standardized all responsive layout breakpoints on MD3 Window Size Classes (<600px compact, >=600px medium, >=840px expanded), eliminating legacy 1024px/1025px breakpoints"
metrics:
  duration: 18 min
  completed_date: "2026-11-19"
actuals:
  tokens: 72000
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 92bfac887d01bec5fc5059d5ea2cf3502623d02d
plan_head_after: 5dfcce66acba7fecaff8f7d768e4a29ecd4c5ed3
---

# Phase 21 Plan 01: Legacy Stack Cleanup & Modular CSS Architecture Summary

Pruned legacy dependencies (`tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`), deleted dead pre-MD3 components (`ComingSoon.tsx`), migrated all remaining Lucide icons to Material Symbols Rounded (`Icon.tsx`), established 8 domain stylesheets under `apps/web/src/styles/`, and refactored `apps/web/src/index.css` to a modular 10-line manifest.

## Accomplishments

1. **Legacy Stack & Dependency Pruning (Task 1 - Tracer)**
   - Uninstalled `lucide-react`, `radix-ui`, `tailwindcss`, and `@tailwindcss/vite` from `apps/web/package.json` and pruned 83 packages from `pnpm-lock.yaml`.
   - Cleaned `apps/web/vite.config.ts` by removing the Tailwind CSS Vite plugin.
   - Deleted pre-MD3 dead component `ComingSoon.tsx` and updated `PillarScreen.tsx` to render sub-tabs and active children directly.
   - Cleaned `sections.ts` of Lucide icon types and imports.
   - Replaced Lucide icons across 23 component and screen files with Material Symbols Rounded via `Icon.tsx` (using sizes 18px, 20px, 24px, 32px).
   - Verified that `grep -E 'lucide-react|radix-ui|@tailwindcss/vite'` across `apps/web/` returns 0 matches.

2. **Modular CSS Architecture & Domain Stylesheets (Task 2)**
   - Created foundational `apps/web/src/styles/reset.css` containing universal border-box reset, MD3 plain typeface binding, surface colors, 2px focus-visible outline in `--md-sys-color-primary`, accessible utilities (`.sr-only`, `.truncate`, `.tabular-nums`), reduced-motion overrides, and semantic color variable bindings.
   - Created `apps/web/src/styles/layout.css` defining `.shell-frame`, `.shell-content`, `.top-app-bar`, `.nav-bar`, `.nav-rail`, strictly adhering to MD3 Window Size Class breakpoints (<600px compact, >=600px medium with 80dp rail padding, >=840px expanded with max-width 1200px).
   - Created 6 domain stylesheets: `meals.css`, `bills.css`, `chores.css`, `deals.css`, `lists.css`, `settings.css`.
   - Rewrote `apps/web/src/index.css` into a clean modular manifest of 10 `@import` declarations, completely eliminating `@theme`, `@layer base`, and `@import 'tailwindcss'`.

3. **Semantic CSS Refactor & Verification (Task 3)**
   - Refactored shell components (`AppShell.tsx`, `TopBar.tsx`, `NavigationBar.tsx`, `NavigationRail.tsx`) and key screen monoliths (`PlannerScreen.tsx`, `BillsIndexScreen.tsx`, `ChoresListScreen.tsx`, `SettingsScreen.tsx`) to use the new scoped semantic class names (`.shell-frame`, `.shell-content`, `.top-app-bar`, `.nav-bar`, `.nav-rail`, `.planner-agenda`, `.bills-container`, `.chores-list`, `.settings-hub`, `.settings-avatar-pill`).
   - Verified clean production build via `pnpm --filter @hestia/web build`: gzipped app shell compiles to 171.2 KB (comfortably within the 200 KB budget).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cleaned up obsolete test asserting ComingSoon in shell.test.tsx**
- **Found during:** Task 1
- **Issue:** `apps/web/src/components/shell/shell.test.tsx` included a test `keeps an unshipped pillar on coming soon even with the released set supplied` that asserted `ComingSoon` component rendering, which was deleted in Task 1 per D-05.
- **Fix:** Removed the obsolete test since all 4 pillars are shipped in v3.0 and `ComingSoon` is permanently deleted.
- **Files modified:** `apps/web/src/components/shell/shell.test.tsx`
- **Commit:** `badb39b`

## Threat Surface Scan

No new network endpoints, authentication pathways, external package inputs, or storage boundaries were introduced. Threat mitigation T-21-01 and T-21-02 successfully achieved: package pruning reduced attack surface and eliminated 83 transitive packages; pure static modular CSS replaced dynamic Tailwind JIT evaluations.

## Known Stubs

None.

## Verification Evidence

1. `pnpm --filter @hestia/web typecheck` passes with 0 errors across all workspaces.
2. `pnpm --filter @hestia/web build` succeeds: `dist/index.html` (0.58 KB gzip), `dist/assets/index-*.css` (3.70 KB gzip), app shell gzipped at 171.2 KB <= 200 KB budget.
3. Zero references to `lucide-react`, `radix-ui`, `tailwindcss`, or `@tailwindcss/vite` in `apps/web/package.json` or source code.
4. Zero legacy `1024px` or `1025px` breakpoints in `apps/web/src/styles/`.

## Self-Check: PASSED
- FOUND: apps/web/src/styles/reset.css
- FOUND: apps/web/src/styles/layout.css
- FOUND: apps/web/src/styles/meals.css
- FOUND: apps/web/src/styles/bills.css
- FOUND: apps/web/src/styles/chores.css
- FOUND: apps/web/src/styles/deals.css
- FOUND: apps/web/src/styles/lists.css
- FOUND: apps/web/src/styles/settings.css
- FOUND: apps/web/src/index.css
- FOUND commit: badb39b
- FOUND commit: 6fdac3e
- FOUND commit: 5dfcce6
