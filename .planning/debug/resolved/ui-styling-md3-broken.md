---
status: resolved
trigger: "The UI is completely ugly and not working right. What is the problem? Make a fix."
created: 2026-11-21T18:22:00-05:00
updated: 2026-11-21T18:39:00-05:00
---

## Current Focus

hypothesis: Phase 21 prematurely removed Tailwind CSS and its Vite plugin without migrating existing UI components and screens away from Tailwind utility classes, causing global layout collapse and missing styling.
test: Restore @tailwindcss/vite, tailwindcss, and the @theme / @theme inline bridge in index.css, build the client bundle, and verify layout generation.
expecting: Compiled CSS bundle includes all utility styles for flex, grid, gap, colors, rounded borders, and cards, while passing all tests and build budgets.
next_action: complete
bug_class: regression
reasoning_checkpoint: null
tdd_checkpoint: null

## Symptoms

expected: Clean, polished Material Design 3 UI with proper colors, spacing, typography, theme tokens, and working interactive components across all screens.
actual: The UI looks completely ugly and broken; layout and styling (colors, spacing, typography, theme) across all screens and global app shell are not working properly.
errors: Visual degradation across all screens; styling not rendering as intended.
reproduction: Open any screen in the web app (Dashboard, Meals, Bills, Chores, etc.).
started: Since the recent Material Design 3 (MD3) migration (Milestone v3.0).

## Eliminated

- Hypothesis: Missing Material Design 3 CSS custom properties in tokens.css. (Refuted: tokens.css contains full set of 285 MD3 design tokens).
- Hypothesis: Runtime JavaScript errors in Lit / @material/web custom element adapters. (Refuted: all 64 test suites pass and component unit tests render correctly).

## Evidence

- timestamp: 2026-11-21T18:23:41-05:00
  finding: 734 lines across 110+ components in apps/web/src/ use Tailwind utility classes (flex, grid, p-*, gap-*, rounded-*, bg-[var(--md-sys-color-*)], text-*, etc.).
- timestamp: 2026-11-21T18:23:55-05:00
  finding: Commit 3e4f6be removed tailwindcss and @tailwindcss/vite and deleted @import 'tailwindcss' from index.css under FND-05, but only migrated 4 container elements to custom CSS classes while the domain stylesheets (meals.css, bills.css, etc.) were never referenced by the components.
- timestamp: 2026-11-21T18:25:05-05:00
  finding: Built CSS bundle was only 23 KB with Tailwind removed, missing rules for cards, badges, list rows, tabs, dialogs, flex layouts, and grids.
- timestamp: 2026-11-21T18:27:23-05:00
  finding: Restoring @tailwindcss/vite and the @theme inline token bridge compiled 61 KB of CSS, restoring layout, colors, padding, and responsive grids while keeping app shell within budget at 177.9 KB gzipped (< 200 KB budget).
- timestamp: 2026-11-21T18:29:28-05:00
  finding: All 64 test suites (881 tests), coverage thresholds (82/77/75/83), ESLint zero-warnings, and TypeScript typechecking pass with 0 errors.

## Resolution

root_cause: Phase 21 (commit 3e4f6be) prematurely removed tailwindcss, @tailwindcss/vite, and the index.css Tailwind @theme bridge before migrating the codebase's 110+ components and screens off Tailwind utility classes, leaving hundreds of components and screens unstyled and visually distorted.
fix: Re-added @tailwindcss/vite and tailwindcss to apps/web devDependencies, reinstated tailwindcss() in vite.config.ts, and restored @import 'tailwindcss' with the @theme / @theme inline token bridge in index.css so all utility classes correctly map to MD3 tokens.
verification: pnpm --filter @hestia/web build compiles successfully within the 200 KB app shell budget (177.9 KB); all 64 Vitest suites (881 tests) pass; test coverage thresholds pass; pnpm lint and pnpm typecheck pass clean.
oracle_type: automated_tests_and_build
files_changed:
  - apps/web/package.json
  - apps/web/vite.config.ts
  - apps/web/src/index.css
  - pnpm-lock.yaml
