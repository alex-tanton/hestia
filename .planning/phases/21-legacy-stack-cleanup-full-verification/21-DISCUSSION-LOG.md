# Phase 21: Legacy Stack Cleanup & Full Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-15
**Phase:** 21-Legacy Stack Cleanup & Full Verification
**Areas discussed:** CSS replacement strategy, Lucide icon retirement & component pruning, E2E & a11y test verification staging, Knip baseline & CI hygiene strictness

---

## CSS replacement strategy

### Question 1: When Tailwind is uninstalled, how should existing utility classes across components be handled?
| Option | Description | Selected |
|--------|-------------|----------|
| Curated lightweight utility stylesheet | Keep utility classNames in JSX by defining a minimal, zero-build pure CSS file (e.g., `src/styles/utilities.css`) for flexbox, grid, spacing, and MD3 typography/color bridges. Zero build overhead, zero rewrite of JSX markup. | |
| Semantic CSS classes | Refactor component elements to use semantic class names (e.g., `.recipe-card`, `.nav-rail-item`) and write scoped CSS rules. Cleaner markup, but requires touching many components. | ✓ |
| You decide | Agent chooses the cleanest path that keeps bundle size under the 200 KB gzipped shell budget and passes all visual/E2E tests. | |

**User's choice:** Semantic CSS classes — Refactor component elements to use semantic class names (e.g., `.recipe-card`, `.nav-rail-item`) and write scoped CSS rules. Cleaner markup, but requires touching many components.

### Question 2: Where should the new semantic CSS stylesheets be organized?
| Option | Description | Selected |
|--------|-------------|----------|
| Colocated standard CSS files | Put `.css` files right next to screens/components (e.g., `src/screens/meals/PlannerScreen.css`) and import them directly. Simple, clean, standard Vite imports. | |
| Vite CSS Modules (*.module.css) | Use scoped CSS modules for complete name isolation without naming collisions. Supported natively by Vite with zero extra dependencies. | |
| Centralized domain stylesheets | Place domain-level CSS files inside `src/styles/` (e.g., `src/styles/meals.css`, `src/styles/bills.css`). Keeps `src/styles/` as the single styling authority. | ✓ |
| You decide | Agent chooses based on simplicity and ease of testing. | |

**User's choice:** Centralized domain stylesheets — Place domain-level CSS files inside `src/styles/` (e.g., `src/styles/meals.css`, `src/styles/bills.css`). Keeps `src/styles/` as the single styling authority.

### Question 3: How should the root styling entry point (`index.css`) and global resets be structured?
| Option | Description | Selected |
|--------|-------------|----------|
| Modular index.css entry with layout & reset | `index.css` acts as the manifest importing `tokens.css`, `reset.css`, `layout.css` (shell & containers), and domain sheets (`meals.css`, `bills.css`, etc.). Clean separation of concerns. | ✓ |
| Single unified index.css | Consolidate all reset and common container rules into `index.css` without extra intermediate files. Fewer files to track. | |
| You decide | Agent chooses based on readability and Vite bundling performance. | |

**User's choice:** Modular index.css entry with layout & reset — `index.css` acts as the manifest importing `tokens.css`, `reset.css`, `layout.css` (shell & containers), and domain sheets (`meals.css`, `bills.css`, etc.). Clean separation of concerns.

### Question 4: How should responsive breakpoints be standardized in the new stylesheets?
| Option | Description | Selected |
|--------|-------------|----------|
| Standard MD3 window size classes | Standardize all media queries strictly to MD3 breakpoints: compact (<600px), medium (600px–839px), and expanded (>=840px). Completely eliminates any legacy 1024px/1025px breakpoints. | ✓ |
| MD3 breakpoints + container queries | Use MD3 media queries for shell layouts and CSS container queries (`@container`) for responsive cards/grids. Maximum component self-containment. | |
| You decide | Agent applies standard MD3 breakpoints consistently across all domain stylesheets. | |

**User's choice:** Standard MD3 window size classes — Standardize all media queries strictly to MD3 breakpoints: compact (<600px), medium (600px–839px), and expanded (>=840px). Completely eliminates any legacy 1024px/1025px breakpoints.

---

## Lucide icon retirement & component pruning

### Question 1: How should the 26 files importing `lucide-react` and potential legacy dead components be handled?
| Option | Description | Selected |
|--------|-------------|----------|
| Dead-code triage first | Scan and safely prune unused legacy components (e.g. `ComingSoon.tsx`, obsolete shims) before touching icons. Avoids wasting effort migrating code that is no longer rendered anywhere. | ✓ |
| Migrate all in-place first | Replace `lucide-react` imports with `Icon.tsx` across all 26 files first, then address dead-code removal as a separate subsequent step. | |
| You decide | Agent inspects imports and prunes clearly dead components before converting active ones. | |

**User's choice:** Dead-code triage first — Scan and safely prune unused legacy components (e.g. `ComingSoon.tsx`, obsolete shims) before touching icons. Avoids wasting effort migrating code that is no longer rendered anywhere.

### Question 2: If a surviving Lucide icon requires a Material Symbol not yet in `icon-paths.ts`, how should it be added?
| Option | Description | Selected |
|--------|-------------|----------|
| Extend `generate-icon-paths.mjs` registry | Add any required Material Symbol glyph names to `generate-icon-paths.mjs` and re-run the generator to maintain deterministic, supply-chain verified SVG paths from google/material-design-icons. | ✓ |
| Manual icon-paths.ts additions | Manually add missing path data directly into `icon-paths.ts` without regenerating the file. Faster, but drifts from the generator script. | |
| You decide | Agent ensures all needed symbols are generated deterministically via the existing script. | |

**User's choice:** Extend `generate-icon-paths.mjs` registry — Add any required Material Symbol glyph names to `generate-icon-paths.mjs` and re-run the generator to maintain deterministic, supply-chain verified SVG paths from google/material-design-icons.

### Question 3: How should icon sizing and colors be standardized when migrating from Lucide to `Icon.tsx`?
| Option | Description | Selected |
|--------|-------------|----------|
| MD3 standard size tiers (`sm` \| `md` \| `lg`) | Standardize icons to MD3 scale (sm=18px, md=24px, lg=32px) and inherit colors via semantic MD3 text tokens (`onSurface`, `onSurfaceVariant`, `primary`). Clean and visually uniform. | ✓ |
| Allow numeric pixel sizes | Support explicit pixel sizes (e.g. `size={16}`, `size={20}`) alongside standard tiers to preserve exact legacy spacing where tight. | |
| You decide | Agent applies standard MD3 sizing tiers with minimal exceptions where tight layout demands it. | |

**User's choice:** MD3 standard size tiers (`sm` | `md` | `lg`) — Standardize icons to MD3 scale (sm=18px, md=24px, lg=32px) and inherit colors via semantic MD3 text tokens (`onSurface`, `onSurfaceVariant`, `primary`). Clean and visually uniform.

### Question 4: How should the permanent removal of `lucide-react` and `radix-ui` be enforced?
| Option | Description | Selected |
|--------|-------------|----------|
| Uninstall packages + ESLint import ban ratchet | Remove `lucide-react` and `radix-ui` from `package.json`, update lockfile, and enforce an ESLint `no-restricted-imports` rule in CI to permanently block reintroduction. | |
| Uninstall packages only | Remove from `package.json` and lockfile without configuring an ESLint ban rule. Rely on build failure if someone imports them. | ✓ |
| You decide | Agent ensures complete removal and appropriate CI protection. | |

**User's choice:** Uninstall packages only — Remove from `package.json` and lockfile without configuring an ESLint ban rule. Rely on build failure if someone imports them.

---

## E2E & a11y test verification staging

### Question 1: How should the test verification suite be staged during Phase 21 execution?
| Option | Description | Selected |
|--------|-------------|----------|
| Staged domain waves | Execute and verify in 4 waves: (1) Unit & DOM suites + coverage thresholds, (2) Core E2E (Auth/Shell/Dashboard/Lists), (3) Feature E2E (Deals/Meals/Bills/Chores/Settings), and (4) Cross-cutting (Offline replay/Barcode/Axe A11y). Keeps debugging focused and fast. | ✓ |
| Unified full sequential sweep | Run the entire 24-spec Playwright suite from spec 01 to 24 end-to-end, fixing issues linearly in numerical order. | |
| You decide | Agent chooses the wave breakdown that optimizes execution time and error diagnosis. | |

**User's choice:** Staged domain waves — Execute and verify in 4 waves: (1) Unit & DOM suites + coverage thresholds, (2) Core E2E (Auth/Shell/Dashboard/Lists), (3) Feature E2E (Deals/Meals/Bills/Chores/Settings), and (4) Cross-cutting (Offline replay/Barcode/Axe A11y). Keeps debugging focused and fast.

### Question 2: What locator strategy should be enforced across the 24 Playwright specs?
| Option | Description | Selected |
|--------|-------------|----------|
| User-facing semantic locators (`getByRole`, `getByLabel`, `getByText`) | Standardize on user-observable roles and text; avoid CSS class locators or querying shadow DOM internals. Keeps tests robust against internal component refactoring. | ✓ |
| Hybrid user-facing + data-testid fallback | Prefer semantic roles, but allow explicit `data-testid` on complex MD3 web component boundaries where shadow DOM or delegatesAria makes standard role queries ambiguous. | |
| You decide | Agent applies standard Playwright best practices with semantic locators first. | |

**User's choice:** User-facing semantic locators (`getByRole`, `getByLabel`, `getByText`) — Standardize on user-observable roles and text; avoid CSS class locators or querying shadow DOM internals. Keeps tests robust against internal component refactoring.

### Question 3: How should animation settling be handled during WCAG 2.1 AA axe audits across light and dark modes?
| Option | Description | Selected |
|--------|-------------|----------|
| Test-wide CSS animation disable in Playwright | Inject `* { animation-duration: 0s !important; transition-duration: 0s !important; }` in E2E runs so dialogs, ripples, and sheets settle instantaneously, preventing flaky timing during axe contrast analysis. | ✓ |
| Deterministic transition settling helper | Wait for specific transition events / element stability before triggering axe scans via `e2e/support/axe.ts`. Tests real production animation timings. | |
| You decide | Agent ensures zero false-positive contrast flakes during light and dark axe scans. | |

**User's choice:** Test-wide CSS animation disable in Playwright — Inject `* { animation-duration: 0s !important; transition-duration: 0s !important; }` in E2E runs so dialogs, ripples, and sheets settle instantaneously, preventing flaky timing during axe contrast analysis.

### Question 4: How should Vitest coverage thresholds (`84/80/77/85`) be managed when dead code and shims are removed?
| Option | Description | Selected |
|--------|-------------|----------|
| Strict locked thresholds (84/80/77/85) | Maintain the existing thresholds without lowering them; add focused unit/DOM tests if pruning dead code creates coverage dips. Guarantees zero regression in test rigor. | |
| Allow threshold recalibration if necessary | If pure deletions shift branch/statement distributions, adjust thresholds strictly to the new clean baseline without lowering code coverage quality. | ✓ |
| You decide | Agent preserves strict coverage standards and supplements tests as needed. | |

**User's choice:** Allow threshold recalibration if necessary — If pure deletions shift branch/statement distributions, adjust thresholds strictly to the new clean baseline without lowering code coverage quality.

---

## Knip baseline & CI hygiene strictness

### Question 1: How should `knip.json` and `scripts/knip-production-baseline.txt` be reconciled after removing legacy packages?
| Option | Description | Selected |
|--------|-------------|----------|
| Zero-legacy clean slate | Purge all obsolete entries from `knip.json` and atomically re-generate `scripts/knip-production-baseline.txt` with only legitimate current production exceptions. No dead ignores or ghost packages remain. | ✓ |
| Conservative baseline update | Keep existing `knip.json` structure and only update `knip-production-baseline.txt` to match the post-removal run output. Less disruptive to existing exclusions. | |
| You decide | Agent ensures clean Knip execution with zero obsolete references. | |

**User's choice:** Zero-legacy clean slate — Purge all obsolete entries from `knip.json` and atomically re-generate `scripts/knip-production-baseline.txt` with only legitimate current production exceptions. No dead ignores or ghost packages remain.

### Question 2: Should `scripts/check-repo-hygiene.mjs` be extended to permanently ban residual legacy tokens and package imports?
| Option | Description | Selected |
|--------|-------------|----------|
| Extend `check-repo-hygiene.mjs` | Add an explicit check ensuring zero references to `tailwindcss`, `lucide-react`, `radix`, or `@theme` remain in `apps/web/src`. Permanently gates the repo against legacy leaks. | |
| Rely on standard toolchain | Rely on Vite build, Knip, and TypeScript compiler errors without adding custom grep ratchets to `check-repo-hygiene.mjs`. | ✓ |
| You decide | Agent chooses based on CI speed and enforcement certainty. | |

**User's choice:** Rely on standard toolchain — Rely on Vite build, Knip, and TypeScript compiler errors without adding custom grep ratchets to `check-repo-hygiene.mjs`.

### Question 3: How should the gzipped shell bundle budget in `scripts/check-build.mjs` be handled after removing legacy dependencies?
| Option | Description | Selected |
|--------|-------------|----------|
| Ratchet down bundle budget | If removing the legacy stack drops the gzipped shell size (e.g. below 170 KB), tighten the ceiling in `scripts/check-build.mjs` to lock in the performance win and prevent future bundle creep. | |
| Keep 200 KB ceiling | Maintain the `<= 200 KB` limit as specified in VER-04, allowing margin for future feature additions. | ✓ |
| You decide | Agent evaluates actual post-cleanup gzipped size before deciding whether to ratchet. | |

**User's choice:** Keep 200 KB ceiling — Maintain the `<= 200 KB` limit as specified in VER-04, allowing margin for future feature additions.

### Question 4: How should code duplication checks (`pnpm jscpd`) handle repetitive CSS patterns across the new domain stylesheets?
| Option | Description | Selected |
|--------|-------------|----------|
| Calibrate `jscpd.json` for CSS | Configure `jscpd.json` to ignore `.css` files or tune duplication thresholds so repetitive CSS properties across domain stylesheets don't cause false positive CI failures. | ✓ |
| Consolidate shared CSS into `layout.css` | If duplication is detected across domain stylesheets, refactor common rule blocks into `src/styles/layout.css` without modifying `jscpd.json`. | |
| You decide | Agent balances clean CSS organization with JSCPD compliance. | |

**User's choice:** Calibrate `jscpd.json` for CSS — Configure `jscpd.json` to ignore `.css` files or tune duplication thresholds so repetitive CSS properties across domain stylesheets don't cause false positive CI failures.

---

## the agent's Discretion

- Clean semantic CSS class naming conventions adhering to domain stylesheets.
- Determination of truly unreferenced dead legacy components for safe pruning.
- Staging wave boundaries balancing runtime and isolation across the 24 Playwright specs.

## Deferred Ideas

None — discussion remained focused strictly within Phase 21 scope.
