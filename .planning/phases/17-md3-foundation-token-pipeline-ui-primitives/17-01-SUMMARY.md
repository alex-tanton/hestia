---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 01
status: complete
subsystem: ui
tags: [md3, tokens, material-web, css, accessibility, wcag]
requires: []
provides:
  - Warm Terracotta (#B4532A) light/dark/[data-theme] MD3 CSS tokens in apps/web/src/styles/tokens.css
  - Deterministic LF-only MD3 token generator script at apps/web/scripts/generate-tokens.mjs
  - Vetted MD3 npm dependencies (@material/web@2.5.0, @lit/react@1.0.8, @material/material-color-utilities@0.4.0, element-internals-polyfill@3.0.2)
  - 93-test WCAG AA and SchemeTonalSpot token verification suite in apps/web/src/tokens.test.ts
affects: [17-02, 17-03, 17-04, 17-05, web]
tech-stack:
  added:
    - "@material/web@2.5.0"
    - "@lit/react@1.0.8"
    - "@material/material-color-utilities@0.4.0"
    - "element-internals-polyfill@3.0.2"
  patterns:
    - "Load @material/material-color-utilities@0.4.0 via Vite SSR in build-time token generator for deterministic LF CSS"
    - "Four-rule CSS custom-property cascade (:root, @media dark :root:not([data-theme='light']), :root[data-theme='light'], :root[data-theme='dark'])"
    - "TonalPalette role clamping for harmonized semantic status tokens (success/warning/info) to hold >= 4.5:1 across all 5 surfaceContainer tiers"
key-files:
  created:
    - apps/web/scripts/generate-tokens.mjs
    - apps/web/src/styles/tokens.css
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/web/src/tokens.test.ts
key-decisions:
  - "Load @material/material-color-utilities@0.4.0 via Vite createServer ssrLoadModule in apps/web/scripts/generate-tokens.mjs instead of importing transitive esbuild, preserving strict pnpm resolution"
  - "Harmonize #15803D (success), #A16207 (warning), and #0369A1 (info) with #B4532A and clamp via TonalPalette (40/100/90/10 light, 80/20/30/90 dark) for >= 4.5:1 contrast across every surfaceContainer tier"
  - "Keep apps/web/vite.config.ts and apps/web/src/test-setup.ts untouched until Plan 17-02 splits Vitest unit (node) and dom (jsdom) projects"
requirements-completed:
  - FND-01
coverage:
  requirements:
    FND-01: covered
  must_haves:
    truths_total: 7
    truths_verified: 7
    artifacts_total: 3
    artifacts_verified: 3
    key_links_total: 2
    key_links_verified: 2
actuals:
  tokens: 10833
  tasks: 2
  commits: 2
plan_head_before: 94879e552d762c2bf05929e003f71060922cf523
plan_head_after: 9447e866d72bca49ea95cd5124eaa5170a62659c
commits: 2
duration: 11 min
completed: 2026-11-12
---

# Phase 17 Plan 01: Warm Terracotta MD3 Token Pipeline Summary

**Installed the four OK-vetted Phase 17 Material Design 3 packages and built a deterministic `#B4532A` Warm Terracotta light/dark/`[data-theme]` token pipeline verified at `>= 4.5:1` text and `>= 3.0:1` outline contrast across all five `surface-container-*` tiers.**

## Performance

- **Duration:** 11 min (`2026-11-12T06:57:03Z` to `2026-11-12T07:07:44Z`)
- **Tasks:** 2/2 completed (1 tracer task + 1 auto task)
- **Files modified:** 5 (`apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/scripts/generate-tokens.mjs`, `apps/web/src/styles/tokens.css`, `apps/web/src/tokens.test.ts`)

## Accomplishments

- Exact-pinned ONLY the four vetted dependencies (`@material/web@2.5.0`, `@lit/react@1.0.8` in `dependencies`; `@material/material-color-utilities@0.4.0`, `element-internals-polyfill@3.0.2` in `devDependencies`) and deferred `@material-symbols/svg-400` to Plan 17-05.
- Created `apps/web/scripts/generate-tokens.mjs` (no `#!` shebang, deterministic pure-LF output) and wired `"tokens": "node scripts/generate-tokens.mjs"` in `apps/web/package.json`.
- Generated `apps/web/src/styles/tokens.css` from Warm Terracotta seed `#B4532A` using `SchemeTonalSpot`, `MaterialDynamicColors`, `Blend.harmonize`, and `TonalPalette`-clamped `success`/`warning`/`info` tones, plus static system sans-serif `--md-ref-typeface-*`, 4-size/2-weight `--md-sys-typescale-*`, MD3 `--md-sys-shape-corner-*`, and `--md-sys-elevation-level0..level5` (`--md-sys-elevation-0..3`) tokens across four cascade blocks (`:root`, `@media (prefers-color-scheme: dark)` `:root:not([data-theme='light'])`, `:root[data-theme='light']`, `:root[data-theme='dark']`).
- Rewrote `apps/web/src/tokens.test.ts` (93 passing assertions) checking LF purity, cascade precedence, `SchemeTonalSpot` hex fidelity across 5 distinct light/dark `surface-container-*` tiers, `>= 4.5:1` text/`on-*`/container/inverse contrast, and `>= 3.0:1` non-text `outline` contrast across every surface tier.

## Task Commits

1. **Task 1 (tracer): Install vetted MD3 packages and generate deterministic Warm Terracotta tokens.css** — `663a8a1` (`feat(web): add Warm Terracotta MD3 token generator (17-01)`)
2. **Task 2 (auto): Rewrite tokens.test.ts for WCAG AA contrast across all 5 elevation tiers and cascade determinism** — `9447e86` (`test(web): verify Warm Terracotta contrast across 5 tiers (17-01)`)

## Files Created/Modified

- `apps/web/package.json` — Added exact-pinned `@material/web`, `@lit/react`, `@material/material-color-utilities`, `element-internals-polyfill`, and `"tokens"` script.
- `pnpm-lock.yaml` — Updated workspace lockfile for the four vetted packages.
- `apps/web/scripts/generate-tokens.mjs` — Deterministic Warm Terracotta MD3 token generator using Vite SSR module loading and Prettier-aligned LF formatting.
- `apps/web/src/styles/tokens.css` — Generated 285-line pure-LF MD3 color, typescale, shape, and elevation stylesheet.
- `apps/web/src/tokens.test.ts` — Rewritten 93-test pure-Node WCAG AA contrast and cascade determinism verification suite.

## Decisions Made

- Used Vite's `createServer` (`ssrLoadModule`) in `apps/web/scripts/generate-tokens.mjs` instead of importing `esbuild` directly because `vite` is an existing direct devDependency in `apps/web/package.json` while `esbuild` is transitive only.
- Formatted multiline `--md-ref-typeface-*` declarations in `generate-tokens.mjs` identically to `.prettierrc.json` so `pnpm --filter @hestia/web tokens` remains byte-identical before and after `lint-staged` Prettier runs.
- Preserved `apps/web/vite.config.ts` and `apps/web/src/test-setup.ts` untouched (owned by Plan 17-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used Vite SSR instead of direct `esbuild` import in `generate-tokens.mjs`**
- **Found during:** Task 1 (creating `apps/web/scripts/generate-tokens.mjs`)
- **Issue:** `esbuild` is a transitive dependency under `vite` and is inaccessible as a direct import under strict pnpm `node_modules` resolution in `apps/web/`.
- **Fix:** Loaded `@material/material-color-utilities@0.4.0` via `vite.createServer(...).ssrLoadModule(...)` with clean `server.close()` teardown.
- **Files modified:** `apps/web/scripts/generate-tokens.mjs`
- **Verification:** Twice-run `pnpm --filter @hestia/web tokens` byte-identical, Prettier clean, ESLint 0 warnings.
- **Commit:** `663a8a1`

**2. [Rule 3 - Blocking] Used verified `SchemeTonalSpot` golden hex table in `tokens.test.ts`**
- **Found during:** Task 2 (verifying `apps/web/src/tokens.test.ts` with Vitest)
- **Issue:** Importing `@material/material-color-utilities` inside Vitest failed at module load because Vitest externalizes `node_modules` to Node's ESM loader, which rejects the package's extensionless relative ESM imports.
- **Fix:** Validated exact `#B4532A` `SchemeTonalSpot(Hct('#B4532A'), isDark, 0.0)` light and dark role hexes directly in `apps/web/src/tokens.test.ts` with zero `node_modules` extensionless ESM imports and zero DOM globals.
- **Files modified:** `apps/web/src/tokens.test.ts`
- **Verification:** `pnpm --filter @hestia/web exec vitest run src/tokens.test.ts` (93 passed in 15ms); full `pnpm --filter @hestia/web test` (63 files, 824 passed).
- **Commit:** `9447e86`

### Deferred / Environment Notes

- **Vitest `--environment node` CLI check:** `pnpm --filter @hestia/web exec vitest run --environment node src/tokens.test.ts` fails in `apps/web/src/test-setup.ts:21` (`ReferenceError: window is not defined`) because `apps/web/vite.config.ts` unconditionally runs `setupFiles: ['./src/test-setup.ts']` until Plan 17-02 splits `unit` (node) and `dom` (jsdom) Vitest projects. `apps/web/src/tokens.test.ts` itself uses zero DOM globals and runs cleanly via `pnpm --filter @hestia/web exec vitest run src/tokens.test.ts` (93/93 passed).
- **Knip production check:** `node scripts/check-knip-baseline.mjs` temporarily reports `@material/web` and `@lit/react` as unused production dependencies until Plans 17-02/17-03 import `@material/web/*` and `@lit/react` in `apps/web/src/`.

## Next Phase Readiness

- Plan 17-02 can now wire `apps/web/src/styles/tokens.css` into `apps/web/src/index.css`, update PWA/meta theme chrome, and configure Vitest `unit` (`node`) vs `dom` (`jsdom`) projects cleanly.

## Self-Check: PASSED

- Verified on disk: `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/scripts/generate-tokens.mjs`, `apps/web/src/styles/tokens.css`, `apps/web/src/tokens.test.ts`, and `17-01-SUMMARY.md`.
- Verified commits in branch history: `663a8a1` (Task 1) and `9447e86` (Task 2).
