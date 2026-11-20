# Phase 21: Legacy Stack Cleanup & Full Verification - Context

**Gathered:** 2026-11-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`, and legacy styling shims cleanly once all screens have migrated, reconcile Knip baselines, and pass all Vitest coverage, 24 Playwright E2E specs, light/dark WCAG 2.1 AA accessibility audits, shell bundle budget, Caddy CSP, and CI hygiene gates (`FND-05`, `VER-01`, `VER-02`, `VER-03`, `VER-04`).

</domain>

<decisions>
## Implementation Decisions

### CSS Replacement & Architecture
- **D-01:** Refactor component elements to use semantic CSS class names (e.g., `.recipe-card`, `.nav-rail-item`) and write scoped CSS rules, replacing Tailwind utility classes. — **Reversibility:** costly — touches markup and class attributes across multiple screen and component files.
- **D-02:** Organize new semantic CSS in centralized domain stylesheets located inside `apps/web/src/styles/` (e.g., `src/styles/meals.css`, `src/styles/bills.css`, `src/styles/chores.css`, `src/styles/deals.css`, `src/styles/lists.css`, `src/styles/settings.css`), keeping `src/styles/` as the single styling authority. — **Reversibility:** costly — establishes the project stylesheet layout and bundle entry graph.
- **D-03:** Structure `index.css` as a clean modular manifest importing `tokens.css`, `reset.css`, `layout.css` (shell, navigation, and core container structures), `gap-primitives.css`, and the domain stylesheets.
- **D-04:** Standardize all media queries strictly to MD3 window size class breakpoints: compact (`<600px`), medium (`600px–839px`), and expanded (`>=840px`), eliminating any residual legacy `1024px` / `1025px` breakpoints.

### Lucide Icon Retirement & Component Pruning
- **D-05:** Perform a dead-code triage first to identify and safely prune unreferenced legacy components (e.g. `ComingSoon.tsx`, `StaleNotice.tsx`, obsolete settings/navigation shims) before replacing icons in surviving active components.
- **D-06:** For any surviving Lucide icon requiring a Material Symbol not yet present in `icon-paths.ts`, add the glyph name to `apps/web/scripts/generate-icon-paths.mjs` and re-run the generator to maintain deterministic, supply-chain verified SVG paths from `google/material-design-icons`.
- **D-07:** Standardize all converted icons to MD3 standard size tiers (`sm`=18px, `md`=24px, `lg`=32px) and inherit colors via semantic MD3 text tokens (`onSurface`, `onSurfaceVariant`, `primary`), avoiding arbitrary numeric pixel sizes.
- **D-08:** Uninstall `lucide-react`, `radix-ui`, `tailwindcss`, and `@tailwindcss/vite` from `apps/web/package.json` and prune the lockfile cleanly without adding explicit ESLint ban rules (relying on compiler and build errors to prevent reintroduction).

### E2E & Accessibility Test Verification Staging
- **D-09:** Execute test verification in 4 staged waves: (1) Unit & DOM suites + coverage thresholds, (2) Core E2E (Auth, Navigation, Dashboard, Lists), (3) Feature E2E (Deals/Flyers, Meals, Bills, Chores, Settings/Departure), and (4) Cross-cutting (Offline queue replay, Barcode scanner, Axe light/dark A11y audits). — **Reversibility:** reversible — determines plan breakdown and verification cadence.
- **D-10:** Standardize Playwright locators on user-facing semantic queries (`getByRole`, `getByLabel`, `getByText`) and avoid querying shadow DOM internals or fragile CSS selectors.
- **D-11:** Disable CSS animations test-wide in Playwright runs via injected style (`* { animation-duration: 0s !important; transition-duration: 0s !important; }`) to ensure instantaneous settling of dialogs, sheets, and ripples, preventing timing flakes during axe contrast analysis.
- **D-12:** Maintain rigorous testing standards while allowing Vitest coverage threshold recalibration if pure deletions of dead shims shift branch/statement distributions, preserving test quality without blocking on deletion math artifacts.

### Knip Baseline & CI Hygiene
- **D-13:** Execute a zero-legacy clean slate by purging all obsolete package ignores from `knip.json` and atomically re-generating `scripts/knip-production-baseline.txt` with only legitimate current production exceptions.
- **D-14:** Rely on standard toolchain checks (Vite build, Knip, TypeScript compiler, Vitest) for legacy package prevention rather than adding custom grep assertions to `scripts/check-repo-hygiene.mjs`.
- **D-15:** Maintain the established `<= 200 KB` gzipped shell bundle budget ceiling in `scripts/check-build.mjs`, retaining comfortable margin for future features.
- **D-16:** Configure `jscpd.json` to calibrate duplication thresholds or exclude `.css` stylesheets so that repetitive CSS property blocks across domain sheets do not trigger false positive duplication failures.

### the agent's Discretion
- **CSS class naming conventions:** Use clean BEM-like or descriptive semantic class names scoped to domain stylesheets.
- **Pruning selection:** Dead-code triage determines which unrendered pre-MD3 components can be deleted safely.
- **Test execution grouping:** Staging wave boundaries can adjust slightly to balance execution runtimes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Phase Specifications
- `.planning/PROJECT.md` — Milestone v3.0 goal, constraints, and tech stack boundaries
- `.planning/REQUIREMENTS.md` — Requirements `FND-05`, `VER-01`, `VER-02`, `VER-03`, `VER-04`
- `.planning/ROADMAP.md` — Phase 21 goal, dependencies, and success criteria
- `.planning/STATE.md` — Project progress and accumulated decisions
- `.planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-CONTEXT.md` — Foundation tokens, Icon.tsx, gap primitives, and snackbar queue
- `.planning/phases/18-adaptive-md3-navigation-shell-route-chrome/18-CONTEXT.md` — Adaptive navigation shell, Top App Bar, single-`<h1>` architecture, and primary tabs
- `.planning/phases/19-entry-dashboard-grocery-ecosystem-screens/19-CONTEXT.md` — Entry, dashboard, and grocery ecosystem MD3 surfaces
- `.planning/phases/20-meals-bills-chores-settings-screens/20-CONTEXT.md` — Meals, bills, chores, and settings MD3 workflows

### Styling & Configuration Files to Overhaul
- `apps/web/package.json` — Remove `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`
- `apps/web/vite.config.ts` — Remove Tailwind Vite plugin and references
- `apps/web/src/index.css` — Transform from `@theme` / Tailwind bridge into clean modular manifest
- `apps/web/src/styles/tokens.css` — Warm Terracotta MD3 CSS tokens
- `apps/web/src/styles/gap-primitives.css` — Sheets, dialogs, and native control styling
- `apps/web/scripts/generate-icon-paths.mjs` — Icon generator script for `icon-paths.ts`
- `apps/web/src/components/ui/Icon.tsx` — Material Symbols SVG component
- `knip.json` — Prune legacy ignore patterns
- `scripts/knip-production-baseline.txt` — Reconcile production baseline findings
- `scripts/check-build.mjs` — Verify gzipped shell bundle budget (`<= 200 KB`)
- `scripts/check-repo-hygiene.mjs` — Repo hygiene verification
- `jscpd.json` — Code duplication configuration

### Test Harnesses & Suites
- `apps/web/vitest.config.ts` & `apps/web/vite.config.ts` — Vitest unit & DOM project configurations and coverage thresholds (`84/80/77/85`)
- `apps/web/src/tokens.test.ts` — Contrast ratio testing across light & dark tiers
- `apps/web/e2e/support/axe.ts` — Axe accessibility scanner helper
- `apps/web/e2e/17-accessibility-states.spec.ts` — WCAG 2.1 AA accessibility audit spec
- `apps/web/e2e/` — 24 Playwright E2E spec files

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/ui/Icon.tsx`: Fully functional SVG Material Symbols component driven by static `icon-paths.ts`.
- `apps/web/scripts/generate-icon-paths.mjs`: Automated tool to pull verified Material Symbols from Google's repository into `icon-paths.ts`.
- `apps/web/src/styles/tokens.css`: Complete `--md-sys-*` tokens for light and dark schemes.

### Established Patterns
- All UI primitives in `apps/web/src/components/ui/` wrap `@material/web` components via `@lit/react` with zero Tailwind dependency.
- Responsive design standardizes on MD3 window classes: compact (`<600px`), medium (`600px–839px`), and expanded (`>=840px`).
- Top App Bar owns single-`<h1>` heading per screen with `useScreenChrome`.

### Integration Points
- `apps/web/src/index.css`: Root styling entry point, to be converted to modular manifest importing `tokens.css`, `reset.css`, `layout.css`, `gap-primitives.css`, and centralized domain stylesheets in `src/styles/`.
- `apps/web/vite.config.ts`: Clean removal of `tailwindcss()` plugin.
- `scripts/check-build.mjs`: Bundle size checks against production build artifacts.

</code_context>

<specifics>
## Specific Ideas

- Centralize all new semantic CSS files in `apps/web/src/styles/` (`meals.css`, `bills.css`, `chores.css`, `deals.css`, `lists.css`, `settings.css`, `layout.css`, `reset.css`) to maintain a single styling authority.
- Test-wide CSS animation disabling in Playwright guarantees zero false-positive contrast flakes during light and dark axe scans.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed strictly within phase scope.

</deferred>

---

*Phase: 21-Legacy Stack Cleanup & Full Verification*
*Context gathered: 2026-11-15*
