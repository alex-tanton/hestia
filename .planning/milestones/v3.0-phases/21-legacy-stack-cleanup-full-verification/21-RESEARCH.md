# Phase 21: Legacy Stack Cleanup & Full Verification - Research

**Researched:** 2026-11-15  
**Domain:** Frontend CSS Architecture, Dependency Pruning, Vitest/Coverage Validation, Playwright E2E Suite Modernization, WCAG 2.1 AA A11y, CI Ratchets  
**Confidence:** HIGH  

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### CSS Replacement & Architecture
- **D-01:** Refactor component elements to use semantic CSS class names (e.g., `.recipe-card`, `.nav-rail-item`) and write scoped CSS rules, replacing Tailwind utility classes. — *Reversibility: costly — touches markup and class attributes across multiple screen and component files.*
- **D-02:** Organize new semantic CSS in centralized domain stylesheets located inside `apps/web/src/styles/` (e.g., `src/styles/meals.css`, `src/styles/bills.css`, `src/styles/chores.css`, `src/styles/deals.css`, `src/styles/lists.css`, `src/styles/settings.css`), keeping `src/styles/` as the single styling authority. — *Reversibility: costly — establishes the project stylesheet layout and bundle entry graph.*
- **D-03:** Structure `index.css` as a clean modular manifest importing `tokens.css`, `reset.css`, `layout.css` (shell, navigation, and core container structures), `gap-primitives.css`, and the domain stylesheets.
- **D-04:** Standardize all media queries strictly to MD3 window size class breakpoints: compact (`<600px`), medium (`600px–839px`), and expanded (`>=840px`), eliminating any residual legacy `1024px` / `1025px` breakpoints.

#### Lucide Icon Retirement & Component Pruning
- **D-05:** Perform a dead-code triage first to identify and safely prune unreferenced legacy components (e.g. `ComingSoon.tsx`, `StaleNotice.tsx`, obsolete settings/navigation shims) before replacing icons in surviving active components.
- **D-06:** For any surviving Lucide icon requiring a Material Symbol not yet present in `icon-paths.ts`, add the glyph name to `apps/web/scripts/generate-icon-paths.mjs` and re-run the generator to maintain deterministic, supply-chain verified SVG paths from `google/material-design-icons`.
- **D-07:** Standardize all converted icons to MD3 standard size tiers (`sm`=18px, `md`=24px, `lg`=32px) and inherit colors via semantic MD3 text tokens (`onSurface`, `onSurfaceVariant`, `primary`), avoiding arbitrary numeric pixel sizes.
- **D-08:** Uninstall `lucide-react`, `radix-ui`, `tailwindcss`, and `@tailwindcss/vite` from `apps/web/package.json` and prune the lockfile cleanly without adding explicit ESLint ban rules (relying on compiler and build errors to prevent reintroduction).

#### E2E & Accessibility Test Verification Staging
- **D-09:** Execute test verification in 4 staged waves: (1) Unit & DOM suites + coverage thresholds, (2) Core E2E (Auth, Navigation, Dashboard, Lists), (3) Feature E2E (Deals/Flyers, Meals, Bills, Chores, Settings/Departure), and (4) Cross-cutting (Offline queue replay, Barcode scanner, Axe light/dark A11y audits). — *Reversibility: reversible — determines plan breakdown and verification cadence.*
- **D-10:** Standardize Playwright locators on user-facing semantic queries (`getByRole`, `getByLabel`, `getByText`) and avoid querying shadow DOM internals or fragile CSS selectors.
- **D-11:** Disable CSS animations test-wide in Playwright runs via injected style (`* { animation-duration: 0s !important; transition-duration: 0s !important; }`) to ensure instantaneous settling of dialogs, sheets, and ripples, preventing timing flakes during axe contrast analysis.
- **D-12:** Maintain rigorous testing standards while allowing Vitest coverage threshold recalibration if pure deletions of dead shims shift branch/statement distributions, preserving test quality without blocking on deletion math artifacts.

#### Knip Baseline & CI Hygiene
- **D-13:** Execute a zero-legacy clean slate by purging all obsolete package ignores from `knip.json` and atomically re-generating `scripts/knip-production-baseline.txt` with only legitimate current production exceptions.
- **D-14:** Rely on standard toolchain checks (Vite build, Knip, TypeScript compiler, Vitest) for legacy package prevention rather than adding custom grep assertions to `scripts/check-repo-hygiene.mjs`.
- **D-15:** Maintain the established `<= 200 KB` gzipped shell bundle budget ceiling in `scripts/check-build.mjs`, retaining comfortable margin for future features.
- **D-16:** Configure `jscpd.json` to calibrate duplication thresholds or exclude `.css` stylesheets so that repetitive CSS property blocks across domain sheets do not trigger false positive duplication failures.

### the agent's Discretion
- **CSS class naming conventions:** Use clean BEM-like or descriptive semantic class names scoped to domain stylesheets.
- **Pruning selection:** Dead-code triage determines which unrendered pre-MD3 components can be deleted safely.
- **Test execution grouping:** Staging wave boundaries can adjust slightly to balance execution runtimes.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed strictly within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| `FND-05` | Remove `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`, and legacy Tailwind CSS/config cleanly once all screens migrate. | Researched exact dependency declarations in `apps/web/package.json`, Vite configuration in `apps/web/vite.config.ts`, `knip.json` ignore list, dead components (`ComingSoon.tsx`, `StaleNotice.tsx`, `sections.ts` Lucide imports), and modular CSS replacements in `apps/web/src/styles/`. |
| `VER-01` | Update Vitest unit and component suites (`tokens.test.ts` light/dark AA across all 5 `surfaceContainer*` tiers, `primitives.test.tsx`, `shell.test.tsx`, and screen tests) to pass on the locked Phase 1 harness while meeting coverage thresholds (`84/80/77/85`). | Researched Vitest configuration in `apps/web/vite.config.ts`, project split (`unit` Node vs `dom` jsdom), current threshold calibrations, and dead component pruning impacts on coverage distribution. |
| `VER-02` | Update all 24 Playwright E2E specs to MD3 semantic locators with zero functional regressions across offline queues, barcode scanning, deals/flyers, meals, bills, chores, auth, and household departure. | Researched Playwright E2E runner in `e2e/playwright.config.ts`, helper methods in `e2e/support/app.ts`, and DOM locator updates required for migrated MD3 screens (e.g. Settings hub, single-`<h1>` Top App Bar). |
| `VER-03` | Pass light and dark WCAG 2.1 AA accessibility audits (`17-accessibility-states.spec.ts` + `e2e/support/axe.ts` `{ subtree: true }` animation settling) across all routes. | Researched axe runner in `e2e/support/axe.ts`, `settleAnimations` helper, and global CSS animation disabling injection per D-11 to eliminate transition contrast flakes. |
| `VER-04` | Pass all build and CI ratchets: `check-build.mjs` (`<= 200 KB` gzipped shell budget + `MAGIC_LINK_COPY`), Caddy `'self'` CSP + Workbox offline precaching, `pnpm lint`, `pnpm typecheck`, `pnpm knip` + `scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `audit-prod.mjs`, and `scripts/check-repo-hygiene.mjs` (LF endings, zero legacy tokens). | Verified and mapped all verification gates across repo root and `apps/web/scripts/` to ensure end-to-end green status. |
</phase_requirements>

---

## Summary

Phase 21 is the final, culminating phase of the Milestone v3.0 Material Design 3 Overhaul. Over Phases 17–20, all application screens (Auth, Onboarding, Dashboard, Lists, Pantry, Deals, Flyers, Meals, Recipes, Bills, Subscriptions, Chores, Errands, Settings, Departure) were migrated to Google's Material Design 3 for Web (`@material/web` wrapped with `@lit/react`), Warm Terracotta `--md-sys-*` tonal tokens, single-`<h1>` Top App Bar, and Material Symbols Rounded SVGs (`Icon.tsx`).

Phase 21 removes the scaffolding that coexisted during migration:
1. Prunes `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, and `lucide-react` from `apps/web/package.json` and `pnpm-lock.yaml`.
2. Prunes dead pre-MD3 components (`ComingSoon.tsx`, `StaleNotice.tsx`, and unused `LucideIcon` definitions in `sections.ts`).
3. Replaces Tailwind utility classes across components with clean semantic CSS organized in centralized domain stylesheets under `apps/web/src/styles/` (`reset.css`, `layout.css`, `meals.css`, `bills.css`, `chores.css`, `deals.css`, `lists.css`, `settings.css`) and converts `index.css` into a modular manifest.
4. Updates all 24 Playwright E2E specs to use MD3 semantic user-facing locators (`getByRole`, `getByLabel`, `getByText`) and injects test-wide animation disabling (`* { animation-duration: 0s !important; transition-duration: 0s !important; }`) to ensure 100% stable axe WCAG 2.1 AA contrast scans.
5. Reconciles `knip.json` and `scripts/knip-production-baseline.txt` atomically, verifies Vitest coverage (`84/80/77/85`), and validates that the gzipped app shell stays under the `<= 200 KB` ceiling in `apps/web/scripts/check-build.mjs`.

**Primary recommendation:** Execute in 4 planned waves: (1) Legacy package pruning, dead-code removal, and CSS domain stylesheet migration, (2) Vitest unit & component test suite stabilization + coverage verification, (3) 24 Playwright E2E spec modernization with semantic locators, and (4) Light/Dark WCAG 2.1 AA axe audits, Knip production baseline reconciliation, and CI ratchet gate verification.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domain Stylesheets & Reset | Browser / Client (`apps/web/src/styles/`) | — | Centralizes CSS rules into single styling authority; eliminates Tailwind build dependency. |
| Dependency Pruning | Build Tooling (`apps/web/package.json`) | Bundler (`vite.config.ts`) | Removes runtime and dev dependencies, pruning `pnpm-lock.yaml` and Vite plugins cleanly. |
| Dead Code & Icon Triage | Browser / Client (`apps/web/src/components/`) | Generator (`generate-icon-paths.mjs`) | Eliminates unreferenced shims (`ComingSoon.tsx`, `StaleNotice.tsx`, `sections.ts` Lucide types). |
| Unit & DOM Component Tests | Test Harness (`Vitest` Node/jsdom) | — | Guarantees component contracts, token cascade AA compliance, and coverage thresholds (`84/80/77/85`). |
| E2E Sequential Journeys | Test Harness (`Playwright` Chromium) | Gateway (`Caddy` / Compose) | Validates full system functionality end-to-end across all 24 journeys with semantic user-facing locators. |
| Accessibility Verification | Test Harness (`@axe-core/playwright`) | Browser / Client | Verifies light and dark WCAG 2.1 AA contrast compliance with test-wide animation suppression. |
| CI Ratchets & Baseline Check | CI/CD Pipeline (`scripts/`) | Build Tooling (`knip`, `jscpd`) | Atomic verification of zero legacy tokens, shell size <= 200 KB, Knip production baseline, and repo hygiene. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@material/web` | `2.5.0` [VERIFIED: apps/web/package.json:22] | MD3 Custom Elements | Standard MD3 implementation for Web, isolated behind typed React 19 wrappers. |
| `@lit/react` | `1.0.8` [VERIFIED: apps/web/package.json:21] | Web Component Wrapper | React 19 wrapper for custom element event mapping, prop synchronization, and SSR safety. |
| `@material/material-color-utilities` | `0.4.0` [VERIFIED: apps/web/package.json:37] | Design Token Generation | Generates Warm Terracotta tonal palettes and `--md-sys-*` CSS variables at build time. |
| `Vite` | `8.3.0` [VERIFIED: apps/web/package.json:51] | Bundler & Dev Server | Fast ESM-native bundler, dev proxy, and PWA integration. |
| `vite-plugin-pwa` | `1.3.0` [VERIFIED: apps/web/package.json:52] | PWA & Service Worker | Manages injectManifest precaching for offline-first support. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Vitest` | `5.0.1` [VERIFIED: apps/web/package.json:53] | Unit & Component Runner | Fast Vite-native test runner with split `unit` (Node) and `dom` (jsdom) projects. |
| `@axe-core/playwright` | `4.13.0` [VERIFIED: e2e/package.json:15] | Automated A11y Scanner | Evaluates WCAG 2.1 AA violations on all visited screens across light and dark themes. |
| `@playwright/test` | `1.63.0` [VERIFIED: e2e/package.json:16] | E2E Journey Runner | Executes 24 sequential end-to-end journeys against full Docker Compose stack. |
| `knip` | `6.41.0` [VERIFIED: .planning/CLAUDE.md:93] | Dead-Code Scanner | Verifies zero unused exports and matches production findings against baseline. |
| `jscpd` | `5.4.1` [VERIFIED: .planning/CLAUDE.md:94] | Duplication Detection | Enforces <= 5% code duplication across repository. |

### Packages to Remove
| Package | Source File | Removal Action |
|---------|-------------|----------------|
| `tailwindcss` | `apps/web/package.json:49` | Remove from `devDependencies` [VERIFIED: apps/web/package.json:49] |
| `@tailwindcss/vite` | `apps/web/package.json:38`, `apps/web/vite.config.ts:1,67` | Remove from `devDependencies` and Vite config [VERIFIED: apps/web/vite.config.ts:1,67] |
| `radix-ui` | `apps/web/package.json:30` | Remove from `dependencies` [VERIFIED: apps/web/package.json:30] |
| `lucide-react` | `apps/web/package.json:29` | Remove from `dependencies` [VERIFIED: apps/web/package.json:29] |

---

## Package Legitimacy Audit

> All packages verified from repository source of truth and npm registry.

| Package | Registry | Purpose | Verdict | Disposition |
|---------|----------|---------|---------|-------------|
| `@material/web` | npm | MD3 Custom Elements | `[OK]` | Approved (Active) |
| `@lit/react` | npm | React 19 Custom Element bridge | `[OK]` | Approved (Active) |
| `@material/material-color-utilities` | npm | Color math engine | `[OK]` | Approved (Active) |
| `tailwindcss` | npm | Legacy styling utility | `[OK]` | REMOVED in Phase 21 |
| `@tailwindcss/vite` | npm | Legacy Vite plugin | `[OK]` | REMOVED in Phase 21 |
| `radix-ui` | npm | Legacy unstyled primitives | `[OK]` | REMOVED in Phase 21 |
| `lucide-react` | npm | Legacy icon library | `[OK]` | REMOVED in Phase 21 |

**Packages removed due to [SLOP] verdict:** None.  
**Packages removed due to Phase 21 deprecation/clean-up:** `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`.

---

## Architecture Patterns

### System Architecture Diagram: Styling & Asset Delivery

```text
index.html
  │
  ▼
apps/web/src/index.css (Modular CSS Manifest)
  ├── @import './styles/tokens.css'         <-- Warm Terracotta MD3 CSS Custom Properties
  ├── @import './styles/reset.css'          <-- Element reset, font stack, .sr-only, :focus-visible
  ├── @import './styles/layout.css'         <-- Shell, TopBar, NavigationBar, NavigationRail, Breakpoints
  ├── @import './styles/gap-primitives.css' <-- Native <dialog> ModalBottomSheet, hestia-native-field
  ├── @import './styles/meals.css'          <-- Planner agenda, board, RecipeCard, readiness ring, forms
  ├── @import './styles/bills.css'          <-- Bill lists, spend hero, PaymentHistory, forms
  ├── @import './styles/chores.css'         <-- Chore rows, RotationEditor, errands list
  ├── @import './styles/deals.css'          <-- Deal search, DealCard, lifted AddToListSheet, flyer grid
  ├── @import './styles/lists.css'          <-- Shopping list rows, StoreGroupHeader, BarcodeScanner HUD
  └── @import './styles/settings.css'       <-- Settings hub, avatar header, notifications, departure
```

### Recommended Project Structure
```text
apps/web/src/
├── styles/
│   ├── tokens.css               # Generated Warm Terracotta MD3 CSS custom properties (existing)
│   ├── gap-primitives.css       # Native dialog sheets and control framing (existing)
│   ├── reset.css                # NEW: Clean CSS reset, base typography, .sr-only, focus outlines
│   ├── layout.css               # NEW: Responsive shell, NavigationBar/Rail, TopBar, Window Size Classes
│   ├── meals.css                # NEW: Planner agenda, recipe cards, readiness ring, dialogs
│   ├── bills.css                # NEW: Bills list sections, spend hero card, payment history
│   ├── chores.css               # NEW: Chores list, rotation editor, errand rows
│   ├── deals.css                # NEW: Deal cards, lifted AddToListSheet, flyer grid
│   ├── lists.css                # NEW: Grocery lists, pantry inventory, barcode scanner HUD
│   └── settings.css             # NEW: Settings categorized list hub, forms, departure flow
├── components/
│   ├── md/                      # Typed @lit/react wrappers for @material/web custom elements
│   ├── ui/                      # App primitives (Button, Field, Card, ListRow, ModalBottomSheet, Icon)
│   ├── shell/                   # AppShell, TopBar, NavigationBar, NavigationRail, SubTabs
│   └── states/                  # StateBlocks (EmptyState, ErrorState, OfflineState)
└── index.css                    # Clean modular manifest importing all stylesheets
```

### Pattern 1: Modular Semantic CSS with MD3 Breakpoints
**What:** Scoped, semantic CSS classes referencing `--md-sys-*` tokens directly, avoiding utility clutter.  
**When to use:** All component layout and visual styling.  
**Breakpoints:**
- Compact: `<600px` (default mobile-first styles)
- Medium: `@media (min-width: 600px)` (NavigationRail, expanded padding)
- Expanded: `@media (min-width: 840px)` (7-column meal planner board, multi-column grids)

```css
/* apps/web/src/styles/layout.css */
.shell-frame {
  min-height: 100dvh;
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
}

.shell-content {
  margin-inline: auto;
  width: 100%;
  padding: 1rem;
  padding-bottom: calc(5rem + env(safe-area-inset-bottom));
  outline: none;
}

@media (min-width: 600px) {
  .shell-frame {
    padding-left: 5rem; /* 80dp NavigationRail */
  }
  .shell-content {
    padding-bottom: 2rem;
  }
}
```

### Pattern 2: Global Playwright CSS Animation Suppression
**What:** Inject an aggressive style block in Playwright browser context to force instant settling of sheets, dialogs, and ripples.  
**When to use:** Playwright E2E and axe contrast testing per D-11.  
```typescript
// e2e/support/axe.ts or playwright fixture
export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}
```

### Anti-Patterns to Avoid
- **Arbitrary pixel breakpoints:** Never use legacy `1024px` or `1025px` queries. Standardize strictly on MD3 Window Size Classes (`600px` and `840px`).
- **Inline style overrides for theming:** Never hardcode hex values in component inline styles; always use `var(--md-sys-color-*)` tokens.
- **Shadow-DOM internal queries in Playwright:** Do not use `locator('md-filled-button >>> button')` or CSS class selectors (`locator('.bg-primary')`). Query by user-visible roles and text (`getByRole('button', { name: 'Sign in' })`).
- **Retaining dead Lucide imports in active files:** Ensure `sections.ts` removes all `LucideIcon` types and `lucide-react` imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS Reset | Custom hacky CSS reset | Semantic MD3 reset (`reset.css`) | Avoids layout bugs across browsers while binding `--md-ref-typeface-plain` and `--md-sys-color-surface`. |
| Icon SVGs | Custom manual SVG path strings | Deterministic `generate-icon-paths.mjs` | Pulls supply-chain verified Material Symbols from Google's repository with automated path sanitization. |
| Contrast Verification | Custom luminance comparison in E2E | `@axe-core/playwright` with TAGS `wcag2aa`, `wcag21aa` | Industry standard; inspects computed DOM styles and catches contrast, ARIA, and hierarchy issues. |
| Dead Code Detection | Custom file grep scripts | `knip` and `scripts/check-knip-baseline.mjs` | AST-aware unused export, unlisted dependency, and dead file scanner with exact baseline verification. |
| Duplicate CSS Prevention | Manual CSS audits | `jscpd` configuration | Automated token-based duplication scanner preventing copy-paste bloat. |

---

## Runtime State Inventory

> This phase removes build/package dependencies and refactors CSS/tests with zero database schema migrations or state format shifts.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None | Verified: database schema, RLS policies, and Postgres types remain completely untouched. |
| Live service config | None | Verified: Caddy CSP already specifies `default-src 'self'`; removing Tailwind/Lucide removes external surface. |
| OS-registered state | None | No OS tasks, daemons, or systemd services reference frontend styling or packaging. |
| Secrets/env vars | None | No env vars reference `tailwindcss`, `radix-ui`, or `lucide-react`. |
| Build artifacts / installed packages | `apps/web/node_modules/` contains `tailwindcss`, `radix-ui`, `lucide-react` | Run `pnpm install` after removing from `apps/web/package.json` to prune `pnpm-lock.yaml`. |

---

## Common Pitfalls

### Pitfall 1: Missing Essential CSS Utilities During Tailwind Purge
**What goes wrong:** After removing `tailwindcss`, utility classes like `.sr-only`, `flex`, `grid`, `truncate`, or `tabular-nums` silently stop working, causing layout breakage or accessibility test failures.  
**Why it happens:** Components relied on Tailwind utility classes without dedicated stylesheet rules.  
**How to avoid:** Define foundational utilities in `apps/web/src/styles/reset.css` and `layout.css` (e.g. `.sr-only`, `.truncate`, `.tabular-nums`, `.no-scrollbar`) before removing Tailwind.  
**Warning signs:** Broken layout in visual inspection or `sr-only` skip links appearing visible on screen.

### Pitfall 2: Flaky Contrast Checks in Axe-Core Due to Mid-Transition Frames
**What goes wrong:** `@axe-core/playwright` reports intermittent color contrast violations on dialogs, sheets, or buttons in `17-accessibility-states.spec.ts`.  
**Why it happens:** CSS transitions (opacity, transform, background-color) take 150–200ms to settle; if axe analyzes the computed style during a transition, it reads an intermediate blended color that fails the 4.5:1 ratio.  
**How to avoid:** Enforce Decision D-11: inject test-wide CSS animation suppression (`animation-duration: 0s !important; transition-duration: 0s !important;`) before running axe scans, combined with `settleAnimations(page)`.  
**Warning signs:** Contrast failures that pass on retry or fail only in CI headless runs.

### Pitfall 3: Playwright E2E Locator Failures on Migrated Screen Structures
**What goes wrong:** E2E specs fail with `locator.waitFor: Timeout 15000ms exceeded` looking for old screen headers or buttons.  
**Why it happens:** Phase 18–20 migrated screens to MD3 conventions (e.g. Settings became a list hub rather than a form wall; Top App Bar owns the single `<h1>`; forms became responsive `<md-dialog>`s).  
**How to avoid:** Audit helper functions like `openSettings` in `e2e/support/app.ts` (which currently asserts `heading: 'My Households'`) to navigate through the new Settings hub list rows. Standardize on user-facing semantic queries (`getByRole`, `getByLabel`, `getByText`).  
**Warning signs:** E2E journeys failing on navigation or form submission steps.

### Pitfall 4: Knip Baseline Mismatch on Dead Component Pruning
**What goes wrong:** `pnpm knip:production` or `node scripts/check-knip-baseline.mjs` fails in CI hygiene gate with "stale baseline row" or "new finding".  
**Why it happens:** Pruning `ComingSoon.tsx`, `StaleNotice.tsx`, or modifying exports in `sections.ts` shifts the production knip report.  
**How to avoid:** Atomically regenerate `scripts/knip-production-baseline.txt` immediately after pruning dead code using `pnpm knip:production --reporter json` through `scripts/knip-summary.mjs` per Decision D-13.  
**Warning signs:** CI `hygiene` job failing on `check-knip-baseline.mjs`.

### Pitfall 5: Vitest Coverage Dropping Below Thresholds
**What goes wrong:** Vitest `test:coverage` fails in CI `test-unit` job with statements/branches below `84/80/77/85`.  
**Why it happens:** Deleting dead code files can inadvertently reduce the ratio of covered to uncovered code in remaining files if the deleted files had 100% test coverage, or vice versa.  
**How to avoid:** Follow Decision D-12: verify coverage immediately after pruning; if pure deletions shift percentages by fractional points without removing real tests, recalibrate thresholds in `apps/web/vite.config.ts`.  
**Warning signs:** CI `test-unit` job reporting `Coverage threshold for statements (84%) not met`.

---

## Code Examples

### 1. Clean Modular CSS Manifest (`apps/web/src/index.css`)
```css
/* apps/web/src/index.css */
@import './styles/tokens.css';
@import './styles/reset.css';
@import './styles/layout.css';
@import './styles/gap-primitives.css';
@import './styles/meals.css';
@import './styles/bills.css';
@import './styles/chores.css';
@import './styles/deals.css';
@import './styles/lists.css';
@import './styles/settings.css';
```

### 2. Foundational Reset & Accessibility Utilities (`apps/web/src/styles/reset.css`)
```css
/* apps/web/src/styles/reset.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--md-ref-typeface-plain);
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 3. Clean Vite Configuration without Tailwind (`apps/web/vite.config.ts`)
```typescript
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// Warm Terracotta MD3 light surface color.
const THEME_COLOR = '#fff8f6';

export default defineConfig({
  envPrefix: 'HESTIA_PUBLIC_',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { proxy },
  preview: { proxy },
  optimizeDeps: {
    exclude: ['@undecaf/barcode-detector-polyfill', '@undecaf/zbar-wasm'],
  },
  plugins: [
    localZbarWasmPlugin(),
    react(),
    VitePWA({ ... }),
  ],
  // ...
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v4 utility classes (`@theme`, `@apply`) | Centralized semantic domain CSS files in `apps/web/src/styles/` | Phase 21 | Zero build-time CSS compiler overhead, clean modular CSS, pure MD3 tokens. |
| Lucide React icons (`lucide-react`) | Curated Material Symbols Rounded SVG component (`Icon.tsx`) | Phase 17–21 | 0 B font precache, deterministic SVG paths from official Google repo, strict CSP. |
| Radix UI headless primitives (`radix-ui`) | `@material/web` custom elements + native `<dialog>` gap primitives | Phase 17–21 | Native Web Components, accessible ARIA roles, unified Material 3 aesthetic. |
| Legacy `1024px` layout cliff | MD3 Window Size Classes (`<600px`, `600px–839px`, `>=840px`) | Phase 18–21 | Fluid responsive adaptation from mobile phones to foldables, tablets, and desktops. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All surviving screen components from Phases 17-20 have already replaced Lucide icons with `Icon.tsx`, leaving only `ComingSoon.tsx`, `StaleNotice.tsx`, and `sections.ts` to prune. | Architecture Patterns | If an unmigrated screen still imports Lucide, removing `lucide-react` will cause a build/typecheck failure that will immediately identify the missing conversion. |
| A2 | Playwright E2E suite will run cleanly with animations disabled without altering timing expectations in test assertions. | Verification Protocol | Disabling animations actually improves stability by preventing race conditions during sheet/dialog opening. |

---

## Open Questions

1. **How should `StaleNotice.tsx` be handled during dead-code triage?**
   - *What we know:* `ChoresListScreen.tsx` imports `StaleNotice`, which imports `RotateCw` from `lucide-react`. `refresh` is already present in `icon-paths.ts`.
   - *Recommendation:* Replace `RotateCw` with `<Icon name="refresh" size={18} />` inside `StaleNotice.tsx`, restyle with semantic CSS classes, and keep it active rather than deleting it.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pnpm` | Package manager | ✓ | 10.34.5 | — |
| `node` | Runtime | ✓ | 24.x | — |
| `docker` / `docker-compose` | E2E test stack | ✓ | Available | Mocked integration where applicable |
| `playwright` | E2E runner | ✓ | 1.63.0 | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 (Unit & DOM) + Playwright 1.63.0 (E2E) |
| Config file | `apps/web/vite.config.ts` & `e2e/playwright.config.ts` |
| Quick run command | `pnpm --filter @hestia/web test` |
| Full suite command | `pnpm --filter @hestia/web test:coverage && pnpm test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| `FND-05` | Clean removal of `tailwindcss`, `radix-ui`, `lucide-react` | Build / Lint | `pnpm lint && pnpm typecheck && pnpm build` | ✅ |
| `VER-01` | Vitest unit/component suite & coverage `84/80/77/85` | Unit / DOM | `pnpm --filter @hestia/web test:coverage` | ✅ |
| `VER-02` | All 24 Playwright E2E specs pass sequentially | E2E | `pnpm test:e2e` | ✅ |
| `VER-03` | Light/dark WCAG 2.1 AA accessibility audits pass | A11y | `pnpm --filter @hestia/e2e exec playwright test tests/17-accessibility-states.spec.ts` | ✅ |
| `VER-04` | Shell budget <= 200 KB, CSP 'self', Knip baseline, hygiene | CI Ratchets | `node apps/web/scripts/check-build.mjs && node scripts/check-knip-baseline.mjs && node scripts/check-repo-hygiene.mjs` | ✅ |

### Sampling Rate
- **Per task commit:** `pnpm --filter @hestia/web test`
- **Per wave merge:** `pnpm --filter @hestia/web test:coverage && pnpm lint && pnpm typecheck`
- **Phase gate:** Full suite green (`pnpm test:e2e` + CI ratchets) before phase completion.

### Wave 0 Gaps
None — test harnesses exist and are operational across Vitest, Playwright, Knip, and repo hygiene.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Existing shared Zod schemas (`packages/shared/src/api/`). |
| V14 Build and Deployment | yes | Dependency pruning removes attack surface; zero external CDNs enforces Caddy `default-src 'self'` CSP. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply Chain Dependency Vulnerability | Tampering | Purging `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react` directly reduces supply chain risk. |
| Insecure Inline Scripts / Styles | Tampering | Strict CSP `script-src 'self'` and `style-src 'self'` with zero unsafe-inline. |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/package.json` [VERIFIED: lines 21-61]
- `apps/web/vite.config.ts` [VERIFIED: lines 1-164]
- `apps/web/src/index.css` [VERIFIED: lines 1-193]
- `apps/web/src/lib/sections.ts` [VERIFIED: lines 1-117]
- `apps/web/src/components/states/ComingSoon.tsx` [VERIFIED: lines 1-47]
- `apps/web/src/components/states/StaleNotice.tsx` [VERIFIED: lines 1-29]
- `apps/web/scripts/check-build.mjs` [VERIFIED: lines 1-126]
- `scripts/check-knip-baseline.mjs` [VERIFIED: lines 1-178]
- `scripts/knip-production-baseline.txt` [VERIFIED: lines 1-28]
- `scripts/check-repo-hygiene.mjs` [VERIFIED: lines 1-250]
- `e2e/playwright.config.ts` [VERIFIED: lines 1-40]
- `e2e/support/axe.ts` [VERIFIED: lines 1-57]
- `e2e/tests/17-accessibility-states.spec.ts` [VERIFIED: lines 1-592]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Verified in-repo dependencies and configurations.
- Architecture: HIGH — Concrete domain stylesheet layout and CSS manifest structure mapped.
- Pitfalls: HIGH — Identified specific failure modes around transitions in axe scans, E2E locator drift, and Knip baselines.

**Research date:** 2026-11-15  
**Valid until:** 2026-12-15

---

## Execution Staging Plan Recommendation for Planner

The planner should structure Phase 21 into **4 sequential waves**:

1. **Wave 1: Dependency Pruning & Semantic CSS Architecture**
   - Create `apps/web/src/styles/` domain stylesheets (`reset.css`, `layout.css`, `meals.css`, `bills.css`, `chores.css`, `deals.css`, `lists.css`, `settings.css`).
   - Rewrite `apps/web/src/index.css` as a clean modular manifest importing the domain sheets.
   - Convert `StaleNotice.tsx` icon to Material Symbol `refresh`; delete dead `ComingSoon.tsx`; remove `LucideIcon` and `lucide-react` imports from `sections.ts`.
   - Remove `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react` from `apps/web/package.json` and `apps/web/vite.config.ts`.
   - Run `pnpm install` to prune `pnpm-lock.yaml`.

2. **Wave 2: Vitest Suites & Coverage Threshold Ratchet**
   - Run `pnpm --filter @hestia/web test` and verify `tokens.test.ts`, `primitives.test.tsx`, `shell.test.tsx`, and all screen tests.
   - Run `pnpm --filter @hestia/web test:coverage`; recalibrate thresholds in `apps/web/vite.config.ts` if dead-code deletion math shifted distributions (`84/80/77/85`).

3. **Wave 3: Playwright E2E Locator Modernization**
   - Inject global CSS animation disabling (`* { animation-duration: 0s !important; transition-duration: 0s !important; }`) in E2E setup.
   - Update E2E helper methods in `e2e/support/app.ts` (e.g. `openSettings` targeting the new Settings hub).
   - Verify and update all 24 Playwright E2E specs to pass sequentially with zero functional regressions.

4. **Wave 4: Accessibility Audits, Knip Baseline & CI Ratchets**
   - Verify light and dark WCAG 2.1 AA audits in `tests/17-accessibility-states.spec.ts` using `e2e/support/axe.ts`.
   - Update `knip.json` (remove `tailwindcss` ignore) and reconcile `scripts/knip-production-baseline.txt` atomically.
   - Verify all CI gates: `node apps/web/scripts/check-build.mjs`, `pnpm lint`, `pnpm typecheck`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `node scripts/audit-prod.mjs`, and `node scripts/check-repo-hygiene.mjs`.
