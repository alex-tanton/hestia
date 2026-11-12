---
phase: 17-md3-foundation-token-pipeline-ui-primitives
researched: 2026-11-11T20:25:00-05:00
domain: frontend-design-system-web-components
confidence: HIGH
requirements:
  - FND-01
  - FND-02
  - FND-03
  - FND-04
---

# Phase 17: MD3 Foundation, Token Pipeline & UI Primitives - Research

**Researched:** 2026-11-11
**Domain:** Material Design 3 design tokens (`@material/material-color-utilities`), React 19 + `@material/web@2.5.0` (`@lit/react@1.0.8`), Material Symbols (`@material-symbols/svg-400`), light-DOM / native `<dialog>` gap primitives, Vitest 5 `jsdom` Shadow DOM testing
**Confidence:** HIGH (verified directly against repository files, npm package tarballs/`package-legitimacy`, `@material/web@2.5.0` JS/`.d.ts` internals, `@lit/react@1.0.8` runtime source, `@material/material-color-utilities@0.4.0` esbuild calculation, `@material-symbols/svg-400@0.48.3` tarball listing, `eslint-plugin-jsx-a11y@6.10.2`, and `@types/react@19.3.0`; see `Package Legitimacy Audit` for `@material-symbols/svg-400` `SUS` gate)

---

## User Constraints

<user_constraints>
### Warm Terracotta Palette, Dark Mode & Typography
- **D-01:** Target an **earthy terracotta clay** seed hex (`~#B4532A`) using `@material/material-color-utilities` `SchemeTonalSpot` + `MaterialDynamicColors` + harmonized semantic status roles (`success`, `warning`, `info`, `error`), tuned to provide warm creamy `surfaceContainer*` tints and comfortable WCAG AA contrast margins across all five `surfaceContainerLowest`..`surfaceContainerHighest` tiers in both light and dark themes.
- **D-02:** Activate light/dark MD3 CSS tokens by **OS default (`@media (prefers-color-scheme: dark)`) plus an explicit `data-theme` attribute override on `<html>`** (`:root[data-theme="light"]` / `:root[data-theme="dark"]`). Keep zero inline FOUC scripts in `index.html` to preserve `docker/Caddyfile` `script-src 'self'`.
- **D-03:** Replace the legacy `#475569` slate `theme-color` in `apps/web/index.html` and `apps/web/vite.config.ts` with **MD3 tonal `surface` / `surfaceContainer` colors per color scheme** (light and dark `<meta name="theme-color" media="...">` tags plus matching PWA manifest `theme_color` / `background_color`) so browser and installed PWA chrome blends seamlessly with the MD3 Top App Bar.
- **D-04:** Back `--md-ref-typeface-*` / `--md-sys-typescale-*` tokens with the **native system UI sans-serif font stack** (`ui-sans-serif, system-ui, -apple-system, ...`) — zero WOFF2 font precache weight and zero FOUT under strict `'self'` CSP.

### Material Symbols Delivery & Icon Style
- **D-05:** Standardize all icon rendering behind `apps/web/src/components/ui/Icon.tsx` using a **curated inline SVG registry from `@material-symbols/svg-400`** (`aria-hidden="true"`, `0 B` WOFF2 precache weight in Workbox, zero ligature `textContent` or screen-reader leakage) — **Reversibility:** `costly` — switching to a WOFF2 font later touches Workbox `globPatterns`, `Icon` usage ergonomics, and test assertions across all screens.
- **D-06:** Standardize on the **Rounded (`@material-symbols/svg-400/rounded`)** shape style across all screens.
- **D-07:** Expose `filled?: boolean` on `Icon` for icons with active/selected MD3 states (e.g., active navigation destinations, favorited stores, active toggles), importing `-fill.svg` variants only for those registered icons.
- **D-08:** Maintain a **single central static icon registry** in `Icon.tsx` (`~50` curated Hestia icons), verified against the `200 KB` gzipped shell budget in `apps/web/scripts/check-build.mjs` rather than splitting per-route icon registries.

### Gap Primitives & Control Behavior
- **D-09:** Upgrade `apps/web/src/components/ui/` **in place onto MD3 wrappers while preserving existing exported prop contracts** where unmigrated screens still consume them (`Button`, `TextField`, `TextAreaField`, `Select`, `Checkbox`, `ConfirmDialog`, `OverflowMenu`, `Tabs`, `SegmentedControl`, `Card`, `ListRow`, `Badge`, `Skeleton`, `SkeletonRows`, `FormMessage`, `Sheet`, `ToastProvider`/`useToast`), adding new MD3 primitives (`Icon`, `Switch`, `ModalBottomSheet`, `Snackbar`, `DateField`, `TimeField`) and keeping Tailwind utility classes in unmigrated screens working until Phases 18–20 — **Reversibility:** `costly` — every existing screen and test file imports directly from `components/ui/`.
- **D-10:** Preserve `Select.tsx`'s **`(pointer: coarse)` native `<select>` fallback** styled to match MD3 outlined fields on touch devices, and render `<md-outlined-select positioning="fixed">` on fine-pointer desktops.
- **D-11:** Implement `Snackbar` (`Toast.tsx`) with a **single active snackbar slot backed by a sequential FIFO queue**: `success` and `info` auto-dismiss after `4000ms` to advance the queue, whereas snackbars with an `action` (`Undo`) or `variant: 'error'` remain **persistent until acted upon or dismissed** via an accessible Close (`×`) icon button — **Reversibility:** `costly` — `Toast.test.tsx` and sequential E2E action-undo flows depend on this queue and persistence contract.
- **D-12:** Enforce all React 19 + `@material/web@2.5.0` interop safeguards inside `components/md/` and `components/ui/`: subpath-only imports (no `all.js`, no `labs/*`), `exactOptionalPropertyTypes` normalization, `onInput`/`onChange` mapping, `md-switch` `selected` sync, `md-dialog` `closed`/`cancel` state sync, `soft-disabled` click guards with inline `disabledReason` preserved, `useFieldErrors` host `aria-invalid` forwarding, explicit `Switch`/`Checkbox` accessible labels (with `Checkbox` `variant="in-list"` full-row tap target preserved), `positioning="fixed"` on menus/selects, and ESLint `no-restricted-imports` + `jsx-a11y` custom component rules.

### Component Test Harness & Coexistence
- **D-13:** Gate the `jsdom@30.1.0` + forced `element-internals-polyfill@3.0.2` harness on **five concrete smoke checks passing cleanly in `primitives.test.tsx`**: (1) `useFieldErrors` focusing the invalid `<md-outlined-text-field>` host, (2) `md-checkbox` and `md-switch` state toggling, (3) `md-radio` (`setValidity` coercion), (4) `<md-dialog>` `Escape`/`closed` state sync plus `ModalBottomSheet` `<dialog>.showModal()` focus restoration, and (5) `<md-outlined-select>` value selection. Escalate the component test project to `@vitest/browser-playwright` only if `jsdom` requires fragile private-internal hacks.

### the agent's Discretion
- **ModalBottomSheet affordances:** Design `ModalBottomSheet` (over native `<dialog>.showModal()`) for MD3 visual clarity (`28dp` top corners, `<= 640dp` max width) and Playwright/keyboard accessibility (title header, accessible `Close` icon button, `Escape` and backdrop-click dismissal, avoiding misleading interactive drag handles unless useful as subtle non-interactive sheet chrome).
- **Native `DateField` / `TimeField` visual framing:** Align native `<input type="date">` and `<input type="time">` visually with `<md-outlined-text-field>` (`56px` height, `4px` radius, MD3 `--md-sys-color-outline` / `--md-sys-color-error` borders, supporting/error text) in whichever CSS structure stays cleanest and most reliable across Safari/Chromium/Firefox.
- **Vitest project split & Shadow DOM helpers:** Choose the exact `vite.config.ts` Vitest project configuration (`node` for pure unit tests and `tokens.test.ts`; `jsdom` or escalated Browser Mode for DOM components) and design shared shadow-aware RTL test helpers in `apps/web/src/test/` + host ARIA attributes to keep tests readable, close to Playwright accessibility semantics, and compliant with `.jscpd.json`.

### Deferred Ideas

None — discussion stayed within phase scope
</user_constraints>

---

## Project Constraints (from CLAUDE.md)

Directly observed in `.claude/CLAUDE.md`, `tsconfig.base.json`, `eslint.config.js`, `apps/web/tsconfig.json`, and CI configs [VERIFIED: repo files]:

- **Strict TypeScript (`tsconfig.base.json:1-24`, `apps/web/tsconfig.json:1-17`):** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noImplicitReturns: true`, `noPropertyAccessFromIndexSignature: true`, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`. Optional props must include `| undefined` when callers pass optional values explicitly (`disabledReason?: string | undefined`), and web modules use explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions: true`).
- **ESLint Zero-Warning Policy (`eslint.config.js:50-162`, `package.json:11`):** `pnpm lint` runs `eslint --max-warnings=0 .`. `apps/web/**/*.{ts,tsx}` extends `tseslint.configs.strictTypeChecked`, `stylisticTypeChecked`, `jsxA11y.flatConfigs.strict`, and `reactHooks.configs.flat.recommended`, plus `@typescript-eslint/explicit-module-boundary-types: 'error'` and `@typescript-eslint/no-non-null-assertion: 'error'` (off in tests).
- **Test Clock Fence (`eslint.config.js:13-48,145-160`, `test/clock-setup.mjs`):** `no-restricted-syntax` forbids bare `new Date()`, `Date.now()`, and `Intl.DateTimeFormat().format()` in `*.test.*`, `apps/web/src/test/**`, `apps/web/src/test-setup.ts`, `e2e/**`, and `test/*.mjs`. Use explicit instants or fake timers (`vi.useFakeTimers({ shouldAdvanceTime: true })`) pinned relative to `2026-10-14T12:00:00.000Z`.
- **Module & Export Discipline (`.claude/CLAUDE.md:195-277`):** Named exports only (`export function Button`), PascalCase components (`<Component>Props`), SCREAMING_SNAKE_CASE constants, string-union types over enums, zero `as any` and avoid `as` casts in production code, zero `console.*` in `apps/*/src`.
- **Prettier & CI Hygiene Gates (`.claude/CLAUDE.md:208-210`, `.github/workflows/ci.yml:160-186`, `scripts/check-repo-hygiene.mjs:228-235`, `knip.json:1-54`, `.jscpd.json:1-9`):** Prettier 3 (`singleQuote: true`, `printWidth: 100`), pure LF line endings across all tracked text files (including `.planning/` and generated `tokens.css`), `pnpm knip` + `node scripts/check-knip-baseline.mjs` (0 new unused dependencies/exports/files outside `scripts/knip-production-baseline.txt`), `pnpm jscpd` (`threshold: 5` in `.jscpd.json:8`), `node scripts/audit-prod.mjs`, and `apps/web/scripts/check-build.mjs` (`200 * 1024` bytes gzipped app shell budget).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Generate build-time Warm Terracotta light and dark `--md-sys-*` CSS tokens (`@material/material-color-utilities` `SchemeTonalSpot` + `MaterialDynamicColors` + harmonized semantic status roles) with WCAG AA contrast verified across all five `surfaceContainer*` tiers in `tokens.test.ts`, replacing `[data-section]` color ramps. | Seed `#B4532A` computed with `SchemeTonalSpot` + `MaterialDynamicColors`; `TonalPalette` clamping on harmonized `success`/`warning`/`info` (`tone(40)` light, `tone(80)` dark) fixes naive `Blend.harmonize` AA failures on `surfaceContainerHighest`; static `tokens.css` activated by `@media (prefers-color-scheme: dark)` + `:root[data-theme="light"\|"dark"]`; Tailwind v4 `@theme inline` semantic bridge until Phase 21; `<meta name="color-scheme">` + light/dark `theme-color` meta tags + manifest update. |
| FND-02 | Isolate all `@material/web@2.5.0` custom elements behind typed React 19 `@lit/react` wrappers (`components/md/` -> `components/ui/`) enforcing strict subpath imports, `exactOptionalPropertyTypes` normalization, `onInput`/`onChange`, `md-switch` `selected`, `md-dialog` `closed` state sync, `soft-disabled` guards, `useFieldErrors` host `aria-invalid` forwarding, explicit `Switch`/`Checkbox` labels, `positioning="fixed"` on menus/selects, and ESLint `no-restricted-imports` + `jsx-a11y` rules. | Verified `@lit/react@1.0.8` `createComponent` runtime and `.d.ts` `ElementProps<I>`; `omitUndefined` normalization helper; `menuPositioning="fixed"` on `MdOutlinedSelect` vs `positioning="fixed"` on `MdMenu`; `Button` `type="button"` default + `softDisabled` React `onClick` guard; `MdDialog` `closed`/`cancel` state sync + `ConfirmDialog` backdrop block; host `aria-invalid` forwarding for `useFieldErrors`; ESLint `no-restricted-imports` fence + explicit `jsx-a11y/control-has-associated-label: 'error'`. |
| FND-03 | Lock and implement the Material Symbols delivery contract behind `Icon.tsx` (`@material-symbols/font-400` WOFF2 vs curated inline `@material-symbols/svg-400`) with `aria-hidden="true"` and clean Workbox + Caddy `'self'` CSP compatibility. | Locked to curated inline `@material-symbols/svg-400/rounded/*.svg` (`D-05`–`D-08`); audited all 56 `lucide-react` specifiers in `apps/web/src` (54 rounded SVGs verified in `@material-symbols/svg-400@0.48.3` tarball + `LoaderCircle` -> `<md-circular-progress indeterminate>` + `type LucideIcon`); `fill?: boolean` active-state `-fill.svg` imports; `aria-hidden="true"` and `0 B` WOFF2 Workbox precache footprint. *(Requires human verification checkpoint before installing `@material-symbols/svg-400` due to `SUS` verdict.)* |
| FND-04 | Provide minimal light-DOM and native-`<dialog>` MD3 gap primitives (`ModalBottomSheet`, persistent-until-acted-upon Undo `Snackbar`, `Card`, `ListRow`, `Badge`, `SegmentedControl`, `Skeleton`, `FormMessage`, and styled native `date`/`time` fields). | Preserved prop contracts in `apps/web/src/components/ui/`; `<dialog>.showModal()` + `closedby="any"` + Safari bounding-rect fallback + `@starting-style` + `overscroll-behavior: contain` for `ModalBottomSheet` (`Sheet.tsx`); FIFO single-slot `Snackbar` (`Toast.tsx`, `4000ms` for `success`/`info`, `Infinity` for `action` & `'error'`) with flagged test updates in `Toast.test.tsx` & `chores.test.tsx`; tonal `Card`/`ListRow`/`Badge`/`SegmentedControl`/`Skeleton`/`FormMessage` and `56px` outlined `DateField`/`TimeField` for 7 native inputs; Vitest 5 `test.projects` + `D-13` `jsdom` smoke gate in `primitives.test.tsx`. |
</phase_requirements>

---

## Summary

Phase 17 establishes the entire Material Design 3 foundation behind `apps/web/src/components/ui/` while keeping unmigrated Tailwind screens, Playwright E2E suites, and Vitest coverage thresholds (`84/80/77/85`) green until Phases 18–21 complete migration and remove legacy packages (`FND-05`). Because all 16 existing primitive modules in `apps/web/src/components/ui/` are already imported directly across the app (including `Button` in 41 files, `Toast` in 24 files, `Skeleton` in 29 files, `Field` in 19 files, `FormMessage` in 18 files) [VERIFIED: repo codebase scan], upgrading `components/ui/` in place behind typed `components/md/` adapters avoids double-migration churn while isolating React 19 / Lit interop pitfalls to one audited boundary.

Two critical discoveries emerged from hands-on verification in this research session:
1. **Naive `Blend.harmonize()` breaks WCAG AA on elevated light surfaces, and raw Node ESM cannot load `@material/material-color-utilities@0.4.0` directly:** Testing seed `#B4532A` with `SchemeTonalSpot` shows that `Blend.harmonize('#15803D', '#B4532A')` (`#467c22`) and `Blend.harmonize('#A16207', '#B4532A')` (`#a95d20`) score **`3.91:1`** and **`3.81:1`** against `surfaceContainerHighest` (`#f1dfd9`) — failing 4.5:1 AA normal-text contrast! Clamping harmonized hues through MD3 `TonalPalette.fromHueAndChroma(harm.hue, harm.chroma)` at **`tone(40)`** (light role) and **`tone(80)`** (dark role) achieves **`4.99–5.04:1`** in light mode and **`7.25–7.29:1`** in dark mode across all five `surfaceContainer*` tiers (`5.78–5.83:1` at `tone(36)`) [VERIFIED: esbuild + `@material/material-color-utilities@0.4.0`]. Additionally, `@material/material-color-utilities@0.4.0` ships extensionless relative ESM imports (`scheme_tonal_spot.js`, `color_spec_2025.js`) that crash raw `node` ESM loaders [VERIFIED: Node v26.11.0]; either run token generation through Vite `ssrLoadModule` / `esbuild` or check generated `tokens.css` into git and verify against computed expectations in `tokens.test.ts` (under Vitest).
2. **`@material/web@2.5.0` Shadow DOM & ESLint traps require targeted guards in `components/md/`, `eslint.config.js`, and `vite.config.ts`:** `@material/web/select` exposes **`menuPositioning="fixed"`** (not `positioning="fixed"`, which only exists on `@material/web/menu`), `Button` defaults `type` to `'submit'` via `mixinFormSubmitter` and lets shadow `<button>` clicks reach React synthetic `onClick` even when `softDisabled` is true, `eslint-plugin-jsx-a11y@6.10.2`'s `strict` preset sets `jsx-a11y/control-has-associated-label` to **`'off'`**, and `@testing-library/dom` (`ByRole`/`ByLabelText`) in `jsdom` does **not** automatically pierce `<md-*>` shadow roots unless tests use light-DOM controls, coarse-pointer `<Select>`, or shadow-aware RTL helpers in `apps/web/src/test/`.

**Primary recommendation:** Build a two-tier wrapper architecture (`components/md/` thin `@lit/react` primitives + normalization -> `components/ui/` Hestia contracts + light-DOM/`<dialog>` gap components), enforce the `D-13` five-check smoke gate early in a split `vite.config.ts` (`node` + `jsdom` with `resolve.conditions: ['browser', ...]`), and verify user approval for `@material-symbols/svg-400@0.48.3` (`SUS: too-new`) via a `checkpoint:human-verify` gate before `pnpm add`.

---

## Architectural Responsibility Map

| Layer / File | Owns | Must NOT Own | Reversibility |
|---|---|---|---|
| `apps/web/scripts/generate-tokens.mjs` + `apps/web/src/styles/tokens.css` | Static Warm Terracotta `--md-sys-color-*`, semantic `--md-sys-color-{success,warning,info}*`, `--md-sys-elevation-*`, `--md-sys-shape-*`, and system `--md-sys-typescale-*` tokens in light (`:root`, `[data-theme="light"]`) and dark (`@media (prefers-color-scheme: dark)`, `:root[data-theme="dark"]`) | Runtime CSS injection (`style-src`), `[data-section]` multi-hue ramps, unverified raw hexes | Easy (build script + CSS file) |
| `apps/web/src/index.css` | Imports `tokens.css` + MD3 field/sheet/snackbar CSS; maintains Tailwind v4 `@theme` / `@theme inline` variables aliased to `--md-sys-color-*` until Phase 21 (`FND-05`) | Five distinct `[data-section='*']` color palettes (replaced by unified Terracotta aliases until Phase 18 removes `SectionProvider`) | Moderate (cleaned up in Phase 21) |
| `apps/web/index.html` + `apps/web/vite.config.ts` + `apps/web/scripts/generate-icons.mjs` | `<meta name="color-scheme" content="light dark">`, light/dark `<meta name="theme-color" media="...">`, MD3 PWA manifest `theme_color`/`background_color`, Vitest `test.projects` split | Inline FOUC `<script>` tags (`Caddyfile` `script-src 'self'` violation) | Easy |
| `apps/web/src/components/md/*` | Subpath `@material/web@2.5.0` custom element imports + `@lit/react@1.0.8` `createComponent` adapters, event mappings, `exactOptionalPropertyTypes` normalization | Hestia layout, domain copy, Tailwind utility classes, `all.js` or `labs/*` imports | Moderate |
| `apps/web/src/components/ui/Icon.tsx` | Curated static registry of `@material-symbols/svg-400/rounded/*.svg` (`?raw` or Vite SVG asset), `filled?: boolean` `-fill.svg` variants, `aria-hidden="true"` | Direct `lucide-react` re-exports, WOFF2 `@font-face` / CDN stylesheets, route-split SVG chunks | Costly (`D-05`, imported across all screens) |
| `apps/web/src/components/ui/*` | Stable Hestia prop contracts (`Button`, `TextField`, `TextAreaField`, `Select`, `Checkbox`, `Switch`, `ConfirmDialog`, `OverflowMenu`, `Tabs`, `DateField`, `TimeField`) + light-DOM/`<dialog>` gap primitives (`ModalBottomSheet`/`Sheet`, `Snackbar`/`ToastProvider`, `Card`, `ListRow`, `Badge`, `SegmentedControl`, `Skeleton`/`SkeletonRows`, `FormMessage`, `CopyButton`) | Direct `@material/web` subpath imports in screen code (`eslint` blocks outside `components/md/`) | Costly (`D-09`, imported by 41+ screen/component files) |
| `eslint.config.js` | `@typescript-eslint/no-restricted-imports` banning `@material/web*`, `lit*`, `radix-ui`, and `lucide-react` leaks in new/MD3-migrated layers (strict ban on `@material/web` & `lit` outside `components/md/`); `jsx-a11y/control-has-associated-label: 'error'` + custom component settings | Weakening existing `CLOCK_READS` / `explicit-module-boundary-types` / `--max-warnings=0` gates | Easy |
| `apps/web/src/test/*` & `apps/web/src/test-setup.ts` | Forced `element-internals-polyfill@3.0.2`, `HTMLDialogElement.prototype.showModal`/`close`, `Element.prototype.animate`, `IntersectionObserver`, shared Shadow DOM RTL query helpers | Real-clock `new Date()`/`Date.now()` calls, per-test duplicate shadow piercing | Moderate |

---

## Standard Stack

### Core New Dependencies (`apps/web`)

| Library | Verified Version | Purpose | Why Standard | Registry / Provenance Status |
|---|---|---|---|---|
| `@material/web` | `2.5.0` | Official Google MD3 Web Components (`md-filled-button`, `md-outlined-text-field`, `md-outlined-select`, `md-checkbox`, `md-switch`, `md-radio`, `md-dialog`, `md-menu`, `md-tabs`, `md-circular-progress`, `md-linear-progress`, `md-divider`, `md-ripple`, `md-focus-ring`) | Exact version locked by `FND-02` / `D-12`; ships subpath ESM + `.d.ts` files [VERIFIED: tarball + npm] | `OK` (`gsd-tools query package-legitimacy check`) |
| `@lit/react` | `1.0.8` | Thin `createComponent` React wrapper bridging properties, className (`class`), `ref`, and custom DOM events (`closed`, `cancel`, `opening`, `change`, `input`) | Standard Lit -> React wrapper (`~400 B` min runtime observed in `create-component.js`); avoids React 19 prop vs attribute pitfalls [VERIFIED: package source] | `OK` (`gsd-tools query package-legitimacy check`) |
| `@material/material-color-utilities` | `0.4.0` (`devDependency`) | Dynamic HCT color generation (`SchemeTonalSpot`, `MaterialDynamicColors`, `Hct`, `Blend`, `TonalPalette`) | Official Google MD3 color engine (`devDependency` only — build-time generation, `0 B` in client bundle) [VERIFIED: npm + esbuild probe] | `OK` (`gsd-tools query package-legitimacy check`) |
| `@material-symbols/svg-400` [WARNING: flagged as suspicious — verify before using.] | `0.48.3` (`devDependency` or `dependency` imported via Vite `?raw`) | Curated rounded Material Symbols SVG paths (`rounded/*.svg` + `rounded/*-fill.svg`) | Locked by `D-05`–`D-08`; eliminates WOFF2 Workbox precache bloat and screen-reader ligature text leakage [VERIFIED: `0.48.3` tarball] | **`SUS` (`too-new`, published `2026-11-04`)** — see *Package Legitimacy Audit* |
| `element-internals-polyfill` | `3.0.2` (`devDependency`) | Polyfills `attachInternals`, `ValidityState` delegation, `:invalid`, and form association in `jsdom` | `jsdom@30.1.0` lacks `CustomStateSet` and full form-associated internals integration (`md-checkbox`/`md-radio`/`md-switch` validation) [VERIFIED: runtime probe] | `OK` (`gsd-tools query package-legitimacy check`) |

### Retained Existing Dependencies (Coexistence until Phase 21 `FND-05`)

| Package | Current Version (`package.json` / `apps/web/package.json`) | Role During Phase 17–20 | Phase 21 Disposition |
|---|---|---|---|
| `react` / `react-dom` | `19.3.0` | Application runtime (native Custom Elements + `@lit/react`) | Kept |
| `tailwindcss` / `@tailwindcss/vite` | `4.3.3` | Coexists cleanly for unmigrated screens via `@theme inline` tokens in `index.css` | Removed in `FND-05` |
| `radix-ui` | `1.6.7` | Replaced inside `components/ui/` primitives (`Select`, `ConfirmDialog`, `OverflowMenu`, `Tabs`, `Sheet`, `Toast`) — check `knip` if any unmigrated screen still imports directly before removing | Removed in `FND-05` (or sooner if 0 importers remain) |
| `lucide-react` | `1.47.0` | Replaced inside `components/ui/`; kept installed while ~54 screen/component files migrate in Phases 18–20 | Removed in `FND-05` |
| `eslint-plugin-jsx-a11y` | `6.10.2` | A11y linting for `apps/web/**/*.{ts,tsx}` (requires explicit rule tuning in `eslint.config.js`) | Kept |
| `vitest` / `jsdom` | `5.0.1` / `30.1.0` | Test runner (`test.projects`) and DOM test environment (`D-13` gate) | Kept |

### Escalation-Only Contingency (`D-13`)

| Package | When Needed | Why Deferred |
|---|---|---|
| `@vitest/browser-playwright` [ASSUMED — version compatibility with `vitest@5.0.1` not installed/verified] | ONLY if any of the 5 `D-13` smoke checks in `primitives.test.tsx` fails or requires fragile internal Lit/polyfill monkeypatching in `jsdom@30.1.0` | Adds headless Chromium overhead to `test-unit` CI; E2E (`@playwright/test@1.63.0`) already runs Chromium in `test-e2e` |

**Installation (`apps/web`, only AFTER human verification of `@material-symbols/svg-400`):**
```bash
pnpm --filter @hestia/web add @material/web@2.5.0 @lit/react@1.0.8 @material-symbols/svg-400@0.48.3
pnpm --filter @hestia/web add -D @material/material-color-utilities@0.4.0 element-internals-polyfill@3.0.2
```
*(Why `@material-symbols/svg-400` sits in `dependencies` when imported by `Icon.tsx`: `knip.json:21-25` runs `knip --production` scanning `apps/web/src/main.tsx` and fails if production source imports a `devDependency` (`scripts/check-knip-baseline.mjs`). Because Vite inlines static SVG assets/strings at bundle time, keeping `@material-symbols/svg-400` in `dependencies` adds 0 runtime JS dependencies while satisfying `knip --production` and `audit-prod.mjs`; keep `@material/material-color-utilities` in `devDependencies` because only `scripts/generate-tokens.mjs` and `tokens.test.ts` import it.)*

---

## Package Legitimacy Audit

Executed live via `node "$env:USERPROFILE\.gemini\antigravity\gsd-core\bin\gsd-tools.cjs" query package-legitimacy check --ecosystem npm @material/web @lit/react @material/material-color-utilities @material-symbols/svg-400 element-internals-polyfill` [VERIFIED: command exit 0]:

| Package | Version Audited | Verdict | Signals (`publishedAt`, `weeklyDownloads`, `postinstall`, `repoUrl`) | Reasons | Disposition |
|---|---|---|---|---|---|
| `@material/web` | `2.5.0` | `OK` | `2026-07-15T14:39:18.532Z`, `186,412/wk`, `postinstall: null`, `github.com/material-components/material-web.git` | `[]` | Proceed normally |
| `@lit/react` | `1.0.8` | `OK` | `2025-07-11T03:36:49.981Z`, `5,039,770/wk`, `postinstall: null`, `github.com/lit/lit.git` | `[]` | Proceed normally |
| `@material/material-color-utilities` | `0.4.0` | `OK` | `2026-01-21T18:35:58.484Z`, `692,510/wk`, `postinstall: null`, `github.com/material-foundation/material-color-utilities.git` | `[]` | Proceed normally |
| `@material-symbols/svg-400` [WARNING: flagged as suspicious — verify before using.] | `0.48.3` | **`SUS`** | `2026-11-04T08:08:30.539Z` (<14 days old), `294,738/wk`, `postinstall: null`, `github.com/marella/material-symbols.git` | `["too-new"]` | **WARN — planner MUST insert a `checkpoint:human-verify` gate before `pnpm add` (or verify `marella/material-symbols` release tag `0.48.3` / pin an older >14-day release if preferred)** |
| `element-internals-polyfill` | `3.0.2` | `OK` | `2025-04-16T12:01:08.925Z`, `204,692/wk`, `postinstall: null`, `github.com/calebdwilliams/element-internals-polyfill.git` | `[]` | Proceed normally |

*(Note: `pnpm audit --prod` via `scripts/audit-prod.mjs` runs on production dependencies in CI; because `@material/web`, `@lit/react`, and `@material-symbols/svg-400` have `postinstall: null` and zero runtime transitive network surprises once pinned in `pnpm-lock.yaml`, verify `node scripts/audit-prod.mjs` after install.)*

---

## Architecture Patterns

### 1. Warm Terracotta Token Pipeline (`FND-01`, `D-01`–`D-04`)

#### Seed Calculation & Verified Contrast Numbers
Running `SchemeTonalSpot(Hct.fromInt(argbFromHex('#B4532A')), isDark, 0.0)` with `MaterialDynamicColors` in `@material/material-color-utilities@0.4.0` produces exact MD3 Warm Terracotta color roles [VERIFIED: `esbuild` + `@material/material-color-utilities@0.4.0`]:

| Token (`--md-sys-color-*`) | Light (`#B4532A`) | Dark (`#B4532A`) | Notes / Contrast Verification |
|---|---|---|---|
| `primary` | `#8e4c32` | `#ffb599` | Contrast on all 5 `surfaceContainer*`: `5.05–6.50` (L), `7.27–11.34` (D) |
| `on-primary` | `#ffffff` | `#552009` | `onPrimary`/`primary`: `6.50` (L), `7.72` (D) — passes AA `>= 4.5:1` |
| `primary-container` | `#ffdbce` | `#71361d` | Active nav indicator, tonal containers |
| `on-primary-container` | `#71361d` | `#ffdbce` | `7.24` (L), `7.24` (D) — passes AA `>= 4.5:1` |
| `secondary` | `#77574b` | `#e7beaf` | Supporting muted accents |
| `on-secondary` | `#ffffff` | `#442a20` | Passes AA |
| `secondary-container` | `#ffdbce` | `#5d4035` | Selected pill / chip / tonal button fill |
| `on-secondary-container` | `#5d4035` | `#ffdbce` | `7.23` (L), `7.23` (D) — passes AA `>= 4.5:1` |
| `tertiary` | `#685e30` | `#d4c78e` | Warm olive-gold accent |
| `on-tertiary` | `#ffffff` | `#383006` | Passes AA |
| `tertiary-container` | `#f1e3a8` | `#50471a` | Accent badges |
| `on-tertiary-container` | `#50471a` | `#f1e3a8` | Passes AA |
| `error` | `#ba1a1a` | `#ffb4ab` | Contrast on all 5 `surfaceContainer*`: `5.01–6.46` (L), `7.29–11.39` (D) |
| `on-error` | `#ffffff` | `#690005` | `6.46` (L), `7.72` (D) |
| `error-container` | `#ffdad6` | `#93000a` | Error banners / overdue badges |
| `on-error-container` | `#93000a` | `#ffdad6` | `7.24` (L), `7.24` (D) |
| `surface` | `#fff8f6` | `#1a110e` | Top App Bar & screen canvas; also PWA `theme-color` (`D-03`) |
| `surface-dim` | `#e8d6d1` | `#1a110e` | Scrim / depressed canvas |
| `surface-bright` | `#fff8f6` | `#423733` | Elevated dark canvas |
| `surface-container-lowest` | `#ffffff` | `#140c09` | Elevation tier 0 (`onSurface`: `17.06` L / `15.00` D; `onSurfaceVariant`: `9.37` L / `11.37` D) |
| `surface-container-low` | `#fff1ec` | `#231a16` | Elevation tier 1 — Cards (`onSurface`: `15.47` L / `13.24` D; `onSurfaceVariant`: `8.50` L / `10.04` D) |
| `surface-container` | `#fceae4` | `#271e1a` | Elevation tier 2 — Nav Bar / Rail (`onSurface`: `14.65` L / `12.66` D; `onSurfaceVariant`: `8.05` L / `9.60` D) |
| `surface-container-high` | `#f7e4df` | `#322824` | Elevation tier 3 — Dialogs / Sheets / App Bar scrolled (`onSurface`: `13.91` L / `11.13` D; `onSurfaceVariant`: `7.64` L / `8.44` D) |
| `surface-container-highest` | `#f1dfd9` | `#3d322f` | Elevation tier 4 — Filled fields / switches (`onSurface`: `13.24` L / `9.61` D; `onSurfaceVariant`: `7.27` L / `7.29` D) |
| `on-surface` | `#231a16` | `#f1dfd9` | Primary text (13.24+ L / 9.61+ D across all 5 tiers) |
| `on-surface-variant` | `#53433e` | `#d8c2bb` | Secondary text (7.27+ L / 7.29+ D across all 5 tiers) |
| `outline` | `#85736d` | `#a08d86` | Non-text `>= 3:1` UI borders (`3.49–4.50` L, `3.92–6.12` D — passes 3:1 on all 5 tiers!) |
| `outline-variant` | `#d8c2bb` | `#53433e` | Decorative hairlines / dividers |
| `inverse-surface` | `#392e2a` | `#f1dfd9` | MD3 Snackbar surface (`inverseOnSurface`: `11.59` L / `10.20` D) |
| `inverse-on-surface` | `#ffede7` | `#392e2a` | Snackbar body text |
| `inverse-primary` | `#ffb599` | `#8e4c32` | Snackbar action text (`4.5+:1` on `inverse-surface`) |
| `scrim` / `shadow` | `#000000` | `#000000` | Backdrop scrim & elevation shadows |

#### Critical Finding: Harmonized Semantic Status Roles (`success`, `warning`, `info`)
Calling raw `Blend.harmonize(argbFromHex(base), seed)` directly shifts HCT chroma/hue while preserving rough lightness against white (`#ffffff`), causing **`success` (`#467c22`, `3.91:1`) and `warning` (`#a95d20`, `3.81:1`) to FAIL WCAG 4.5:1 normal-text contrast on warm tinted `surfaceContainerHighest` (`#f1dfd9`)** [VERIFIED: esbuild + `@material/material-color-utilities@0.4.0`].

**Solution:** Generate a `TonalPalette.fromHueAndChroma(harmHct.hue, harmHct.chroma)` per harmonized base (`success: '#15803D'`, `warning: '#A16207'`, `info: '#0369A1'`) and emit MD3 custom color roles using `tone(40)` (or `tone(36)` for extra margin), `tone(100)`, `tone(90)`, `tone(10)` in light mode and `tone(80)`, `tone(20)`, `tone(30)`, `tone(90)` in dark mode:

| Status Role | Light Text/Accent (`tone(40)`) | Contrast on `surfaceContainerHighest` (`#f1dfd9`) | Light Container (`tone(90)`) / On (`tone(10)`) | Dark Text/Accent (`tone(80)`) | Contrast on `surfaceContainerHighest` (`#3d322f`) | Dark Container (`tone(30)`) / On (`tone(90)`) |
|---|---|---|---|---|---|---|
| `success` | `#366b11` | **`4.99:1`** (AA pass) | `#b5f48a` / `#0a2100` (`13.22:1`) | `#9ad771` | **`7.27:1`** (AA pass) | `#235100` / `#b5f48a` (`7.24:1`) |
| `warning` | `#924b0d` | **`5.04:1`** (AA pass) | `#ffdcc6` / `#311400` (`13.25:1`) | `#ffb786` | **`7.29:1`** (AA pass) | `#723600` / `#ffdcc6` (`7.27:1`) |
| `info` | `#2d5ea2` | **`5.04:1`** (AA pass) | `#d6e3ff` / `#001b3d` (`13.31:1`) | `#a9c7ff` | **`7.25:1`** (AA pass) | `#074689` / `#d6e3ff` (`7.25:1`) |

*(Verified `>= 4.99:1` across all 5 light tiers and `>= 7.25:1` across all 5 dark tiers using `@material/material-color-utilities@0.4.0`; `tone(36)` raises light floor further to `5.78–5.83:1`.)*

#### CSS Cascade & Theme Activation (`D-02` + Modern Web Guidance `dark-mode`)
Emit CSS blocks in strict specificity/source order in `apps/web/src/styles/tokens.css` (zero inline `<script>` in `index.html`):
1. `:root` -> `color-scheme: light dark;` + light `--md-sys-color-*`, static `--md-ref-typeface-*`, `--md-sys-typescale-*`, `--md-sys-shape-corner-*`, `--md-sys-elevation-*`
2. `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ...dark tokens... } }` *(using `:not([data-theme='light'])` keeps OS dark from overriding an explicit light attribute toggle while maintaining equal or clean cascade priority!)*
3. `:root[data-theme='light'] { color-scheme: light; ...light tokens... }`
4. `:root[data-theme='dark'] { color-scheme: dark; ...dark tokens... }`

#### Generator Execution Caveat
`@material/material-color-utilities@0.4.0` has extensionless relative ESM imports (`scheme/scheme_tonal_spot.js`, `dynamiccolor/color_spec_2025.js`) that throw `ERR_MODULE_NOT_FOUND` under raw Node `v26.11.0` [VERIFIED: Node command]. Two clean options:
- **Recommended:** Bundle/run `apps/web/scripts/generate-tokens.mjs` through `esbuild` (`node_modules/.pnpm/@esbuild...` or `vite` `createServer()` -> `ssrLoadModule` in one script) to write static `apps/web/src/styles/tokens.css` (committed with LF endings), and test `tokens.css` directly on disk in `apps/web/src/tokens.test.ts` (comparing exact generated light/dark/data-theme tokens and checking WCAG AA contrast across all 5 `surfaceContainer*` tiers). Note: `tokens.test.ts` should also run the color generator via Vitest (which transforms extensionless ESM cleanly!) or import a pure helper so drift between seed `#B4532A` and `tokens.css` fails CI immediately!

#### PWA & Chrome Integration (`D-03`, `D-04`)
- Replace `<meta name="theme-color" content="#475569" />` in `apps/web/index.html:6` with:
  ```html
  <meta name="color-scheme" content="light dark" />
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff8f6" />
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a110e" />
  ```
- Update `THEME_COLOR` in `apps/web/vite.config.ts:9` (`#fff8f6` or Terracotta `#8e4c32`? Look at `D-03`: *"with MD3 tonal `surface` / `surfaceContainer` colors per color scheme (light and dark `<meta name="theme-color" media="...">` tags plus matching PWA manifest `theme_color` / `background_color`)"* -> `#fff8f6` `surface` in light manifest `theme_color` & `background_color`, matching `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff8f6">`). Also update `BACKGROUND` in `apps/web/scripts/generate-icons.mjs:9` (`#475569` -> Warm Terracotta `[0xB4, 0x53, 0x2A]` or `[0x8E, 0x4C, 0x32]` primary so launcher icon matches the brand instead of retired slate) and re-run `pnpm --filter @hestia/web icons` if updating PNG icons in Phase 17.
- Define `--md-ref-typeface-brand` and `--md-ref-typeface-plain` as `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`, and map `--md-sys-typescale-*-font` tokens directly to `var(--md-ref-typeface-plain)` (`D-04`).

#### Tailwind v4 Coexistence Bridge (`apps/web/src/index.css`)
Keep `@import 'tailwindcss';`, `@theme { ... }`, and `@theme inline { ... }` (`apps/web/src/index.css:1-113`) intact through Phases 18–20 (`FND-05`), while **removing `[data-section='dashboard'|'lists'|'meals'|'bills'|'chores']` color ramps** (`apps/web/src/index.css:120-371`) and mapping the Tailwind semantic tokens inside `:root` and dark blocks to MD3 Warm Terracotta variables:
- `--bg-base: var(--md-sys-color-surface);` (or `surface-container-lowest` for cards where `--bg-raised` is `var(--md-sys-color-surface-container-low)`)
- `--border: var(--md-sys-color-outline-variant);`, `--border-input: var(--md-sys-color-outline);`
- `--text-primary: var(--md-sys-color-on-surface);`, `--text-secondary: var(--md-sys-color-on-surface-variant);`, `--text-muted: var(--md-sys-color-on-surface-variant);`
- `--section` / `--section-accent`: `var(--md-sys-color-primary)`, `--on-section`: `var(--md-sys-color-on-primary)`, `--section-tint`: `var(--md-sys-color-primary-container)`, `--section-badge`: `var(--md-sys-color-secondary-container)`, `--on-section-badge`: `var(--md-sys-color-on-secondary-container)`
- `--danger*`, `--warning*`, `--success*`, `--info*`, `--neutral-badge*` -> mapped cleanly to `--md-sys-color-error*`, `--md-sys-color-warning*`, `--md-sys-color-success*`, `--md-sys-color-info*`, `--md-sys-color-surface-container-high`.

*(Watch focus-visible: `apps/web/src/index.css:379-382` sets `:focus-visible { outline: 2px solid var(--section-accent); outline-offset: 2px; }` — once `--section-accent` aliases `--md-sys-color-primary`, unmigrated controls automatically inherit Terracotta focus rings, AND `@material/web` controls use `--md-focus-ring-color: var(--md-sys-color-secondary)` / `var(--md-sys-color-primary)`.)*

---

### 2. `@material/web@2.5.0` React 19 Interop Layer (`FND-02`, `D-12`)

#### Verified Public Subpaths (`@material/web@2.5.0` tarball)
Use ONLY explicit top-level subpath ESM imports (never `@material/web/all.js`, never `@material/web/labs/*`):
- Buttons & Icon Buttons: `button/{filled-button,filled-tonal-button,outlined-button,text-button,elevated-button}.js`, `iconbutton/{icon-button,filled-tonal-icon-button,outlined-icon-button,filled-icon-button}.js`
- Form Controls: `textfield/outlined-text-field.js`, `select/{outlined-select,select-option}.js`, `checkbox/checkbox.js`, `switch/switch.js`, `radio/radio.js`
- Overlays & Navigation: `dialog/dialog.js`, `menu/{menu,menu-item,sub-menu}.js`, `tabs/{tabs,primary-tab,secondary-tab}.js`
- Progress & Chrome: `progress/{circular-progress,linear-progress}.js`, `divider/divider.js`

#### How `@lit/react@1.0.8` (`createComponent`) Behaves with React 19 & TS6 `exactOptionalPropertyTypes`
Inspecting `@lit/react@1.0.8/create-component.js` and `create-component.d.ts` revealed exact runtime and type rules [VERIFIED: package source]:
1. `createComponent` checks `if (key in elementClass.prototype)`: known element properties are assigned via JS property (`el[prop] = val`) inside `useLayoutEffect`, `className` is translated to `class`, `events` keys bind `addEventListener`, and unknown attributes (like `'aria-invalid'`, `'aria-describedby'`, `'data-*'`, `'role'`, `'id'`, `'name'`) pass through as HTML host attributes!
2. Under `tsconfig.base.json:10` (`exactOptionalPropertyTypes: true`), `ElementProps<I> = Partial<Omit<I, keyof HTMLElement>>` produces `{ disabled?: boolean }` **without `| undefined`**. Passing `disabled={props.disabled}` where `props.disabled` is `boolean | undefined` fails `tsc` with `TS2375`. Provide one small typed helper `omitUndefined<T extends Record<string, unknown>>(obj: T)` in `apps/web/src/components/md/props.ts` (avoiding `as` casts or wrapping boolean flags as `disabled={Boolean(disabled)}`)!
3. **Exact Prop/Event Pitfalls Verified in `@material/web@2.5.0` Source:**
   - **Select uses `menuPositioning="fixed"`, NOT `positioning="fixed"`!** (`select/internal/select.js:137,386,708`: `this.menuPositioning = 'popover'`, bound to inner `<md-menu .positioning=${this.menuPositioning}>`). Passing `positioning="fixed"` to `<md-outlined-select>` is a no-op; `MdOutlinedSelect` must pass `menuPositioning="fixed"` (HTML attr `menu-positioning="fixed"`), while standalone `MdMenu` uses `positioning="fixed"` (`menu/internal/menu.d.ts:108`).
   - **`Button` default `type` is `'submit'` (`labs/behaviors/form-submitter.js:41`), NOT `'button'`:** Every existing `Button` in Hestia expects `type = 'button'` (`apps/web/src/components/ui/Button.tsx:54`). Always default `type = 'button'` in `Button.tsx`!
   - **`softDisabled` does NOT prevent React `onClick` (`button/internal/button.js:89-93,128-142` + observed `jsdom` smoke test):** `<md-filled-button>` puts `aria-disabled="true"` only inside shadow DOM `<button>` and still bubbles click events to React's delegated `onClick` handler. In `Button.tsx`, guard `onClick` with `if (isUnavailable) { event.preventDefault(); event.stopPropagation(); return; }`, forward `aria-disabled={isUnavailable || undefined}` and `aria-busy={isLoading || undefined}` and `aria-describedby` onto the host (AND `softDisabled={isUnavailable}`), and keep inline `<span id={reasonId}>{disabledReason}</span>`. Note: verify `Button.tsx`'s `'destructive'` variant styles error tokens (`--md-filled-button-container-color: var(--md-sys-color-error); --md-filled-button-label-text-color: var(--md-sys-color-on-error)`).
   - **`useFieldErrors` host `aria-invalid` forwarding (`apps/web/src/lib/use-field-errors.ts:22`, `textfield/internal/text-field.js:467,597`):** `useFieldErrors` runs `formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()`. Although `MdOutlinedTextField.focus()` delegates to shadow `<input>` (`text-field.js:597-600`) and sets `aria-invalid` internally, light-DOM `querySelector('[aria-invalid="true"]')` cannot pierce Shadow DOM. `TextField`, `TextAreaField`, `Select`, `DateField`, and `TimeField` MUST place `aria-invalid={isInvalid || undefined}` on the host/control matched by `querySelector('[aria-invalid="true"]')`.
   - **`md-switch` uses `.selected` (`switch/internal/switch.js:11`):** Do NOT pass `checked`. Bind `selected={checked}` and map both `onInput` / `onChange` cleanly reading `event.currentTarget.selected`.
   - **`md-dialog` `closed`/`cancel` state sync (`dialog/internal/dialog.js:143-327`):** Do NOT control only via JSX attribute without handling both native `cancel` and `closed`. For `ConfirmDialog` (`ConfirmDialog.tsx:24-25`: *"cannot be dismissed by an outside click"*), note `dialog/internal/dialog.js:286-292` fires cancelable `cancel` on scrim/backdrop click AND on Escape (`handleKeydown`/`handleCancel`), then closes unless `event.preventDefault()`. Distinguish Escape key vs pointer scrim click (or track `Escape` keydown flag in `ConfirmDialog`) so Escape can close (or follow AlertDialog semantics) while backdrop outside clicks call `event.preventDefault()` on `cancel`! Also confirm `type="alert"` adds `role="alertdialog"` (`dialog/internal/dialog.d.ts`).
   - **`md-radio` (`radio/internal/radio.js:140`, `labs/behaviors/constraint-validation.js:120`):** Under `jsdom` + `element-internals-polyfill@3.0.2`, `RadioValidator` passes spread `ValidityState` flags to `internals.setValidity(...)` — explicitly smoke-test `<md-radio>` `checked`/`required` in `primitives.test.tsx` (`D-13` check #3)!

#### ESLint Governance Rules (`eslint.config.js`)
Inspecting `node_modules/eslint-plugin-jsx-a11y/lib/index.js:133-137` revealed a critical landmine [VERIFIED]:
> `jsxA11y.flatConfigs.strict` sets `'jsx-a11y/control-has-associated-label': ['off', { ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video'], ... }]`!

Merely configuring `settings: { 'jsx-a11y': { components: ... } }` leaves `control-has-associated-label` **turned off**! In `eslint.config.js`:
1. Add `@typescript-eslint/no-restricted-imports` on `apps/web/**/*.{ts,tsx}` (ignoring `apps/web/src/components/md/**`) blocking `'@material/web'` and `'@material/web/*'` (and `'lit'`, `'lit/*'`, `'@lit/*'`), with a matching `no-restricted-syntax` `ImportExpression` guard mirroring `eslint.config.js:108-130`.
2. Explicitly configure `'jsx-a11y/control-has-associated-label': ['error', { labelAttributes: ['label', 'aria-label', 'aria-labelledby'], controlComponents: ['Button', 'Checkbox', 'Switch', 'MdIconButton', 'MdFilledIconButton', 'MdFilledTonalIconButton', 'MdOutlinedIconButton', 'MdCheckbox', 'MdSwitch'] }]`.
3. Configure `'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['TextField', 'TextAreaField', 'Select', 'DateField', 'TimeField', 'MdOutlinedTextField', 'MdOutlinedSelect', 'MdCheckbox', 'MdSwitch'], labelAttributes: ['label'] }]`.
4. **Do NOT map `Checkbox` or `Switch` to `'input'` in `settings['jsx-a11y'].components`** (`ignoreElements` explicitly skips `'input'` in `control-has-associated-label`!). Instead, map `TextField`/`TextAreaField`/`DateField`/`TimeField` -> `'input'` or keep wrapper props enforced via `controlComponents`. Also verify zero existing violations across `apps/web/src` before merging!

---

### 3. Material Symbols Inline SVG Delivery (`FND-03`, `D-05`–`D-08`)

Audited all `62` imports from `'lucide-react'` across `apps/web/src`: **56 unique specifiers** (`type LucideIcon`, `LoaderCircle` -> `<md-circular-progress indeterminate>`, and **54 icon names**). Verified via `tar -tzf` on `@material-symbols/svg-400@0.48.3` tarball that **0 files are missing** from `rounded/*.svg` + `-fill.svg` for active states [VERIFIED: 23,643-entry tarball check]:

- SVG anatomy observed (`rounded/add.svg`): `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="..."/></svg>` — NO `fill` attribute hardcoded, so CSS `fill: currentColor` matches Lucide's monochrome styling cleanly inside `<svg aria-hidden="true" viewBox="0 -960 960 960" fill="currentColor">`!
- **Recommended implementation inside `Icon.tsx`:** Keep static `ICON_SVGS` importing `@material-symbols/svg-400/rounded/<name>.svg?raw` (and extracting the `<path d="...">` string via one tiny module-init helper) OR extract pure `d` attributes at build time into `apps/web/src/components/ui/icon-paths.ts` using `@material-symbols/svg-400` via `Icon.tsx` Vite `?raw` imports so zero raw HTML string injection (`dangerouslySetInnerHTML`) is ever needed. Rendering `<svg viewBox="0 -960 960 960" aria-hidden="true" width={size} height={size} fill="currentColor"><path d={path} /></svg>`:
  - Avoids `dangerouslySetInnerHTML`, avoids runtime DOM parsing when pre-extracted at module load / build script, and works identically in `jsdom` and Chromium (`meal-components.test.tsx:60` and `primitives.test.tsx:166,172` query `container.querySelector('svg')` and assert `toHaveAttribute('aria-hidden', 'true')`!).
  - Full TypeScript exhaustiveness via `export type IconName = ...` union (`D-07` `FILLED_ICON_PATHS` for active states: `notifications`, `error`, `check_circle`, `info`, `dashboard`, `checklist`, `receipt_long`, `settings`, `shopping_cart`, `storefront`, `restaurant`, `star`, `home`).
  - Tiny payload: raw `<path d="...">` strings for 54 outline + ~13 fill glyphs compress far smaller than full `<svg>` wrappers (`< 10 KB` gzipped total, vs `200 KB` budget in `check-build.mjs:19`), and `Workbox` precaches `0 B` of `.woff2` fonts!

*(Note for `Toast.tsx` / `Field.tsx` / `FormMessage.tsx` / `Badge.tsx` / `Sheet.tsx` / `OverflowMenu.tsx` / `Select.tsx` / `Checkbox.tsx`: migrating these 16 files inside `components/ui/` to `<Icon name="..." />` and `<md-circular-progress indeterminate>` for `Button` `isLoading` immediately fulfills `FND-03` for all UI primitives without waiting for Phases 18–20!)*

---

### 4. Gap Primitives, Native `<dialog>`, and Modern Web Guidance (`FND-04`, `D-09`–`D-11`)

#### `ModalBottomSheet` & `Sheet.tsx` (Modern Web Guidance: `dialog`, `light-dismiss-a-dialog`, `prevent-page-scroll-under-modal-dialog`, `animate-to-from-top-layer`)
Implement `ModalBottomSheet` in `apps/web/src/components/ui/ModalBottomSheet.tsx` and keep `Sheet` (`apps/web/src/components/ui/Sheet.tsx`) delegating to it with preserved `SheetProps` (`open`, `onOpenChange`, `title`, `description?`, `trigger?`, `children`) so all 5 existing callers + `primitives.test.tsx` keep passing seamlessly:
- **Top-Layer Native `<dialog>`:** Open declaratively in `useEffect` via `dialog.showModal()` when `open` transitions `false -> true`, and `dialog.close()` when `open` transitions `true -> false` (avoiding `No role="dialog"` / `aria-modal="true"` redundancy — native `showModal()` implies `role="dialog"` and modal semantics; check `e2e/support/app.ts:48` `page.getByRole('dialog', { name: 'Households' })` works automatically via `aria-labelledby={titleId}`).
- **Trigger Focus Restoration:** If `trigger` is omitted (`open` toggled externally), snapshot `document.activeElement` before `showModal()`, then in `onClose` restore focus to `previousFocusRef.current` unless moved explicitly (`primitives.test.tsx:337` tests trigger focus restoration!). Reset `dialog.returnValue = ''` on `close`.
- **Light-Dismiss Cross-Browser (`closedby="any"` + Safari fallback):** Set `closedby="any"` (`@types/react@19.3.0` natively types `closedby?: "any" | "closerequest" | "none" | undefined` [VERIFIED: `index.d.ts`]). Attach a fallback `pointerdown` + `pointerup`/`click` outside-bounding-rect handler guarded by `if (!('closedBy' in HTMLDialogElement.prototype))` for Safari and `jsdom` (checking `clientX`/`clientY` against `dialog.getBoundingClientRect()` so text selection dragging out of the sheet doesn't false-dismiss!). Wait: in `jsdom`, `getBoundingClientRect()` returns zeros (`0,0,0,0`) unless stubbed or clicking the `<dialog>` element itself when `event.target === dialog`! Adding an explicit `Close` icon button (`aria-label="Close"`) handles programmatic/AT/test dismissal too.
- **Scroll Containment & Transitions (Zero `body { overflow: hidden }` hacks):**
  - Never put `display: flex` directly on `dialog` (it breaks closed hiding) — scope `display: flex; flex-direction: column;` strictly to `dialog[open]`.
  - Apply `dialog:modal { overscroll-behavior: contain; }` and `dialog::backdrop { overflow: hidden; overscroll-behavior: contain; }` (prevents rubber-band background scrolling on iOS/mobile!).
  - Animate entry/exit using `@starting-style`, `transition-behavior: allow-discrete`, listing `overlay` & `display` in `transition-property` cleanly outside `prefers-reduced-motion: reduce`, with `28px` (`1.75rem`) top corners and `max-width: 640px` centered bottom anchor (`inset: auto 0 0; margin-inline: auto;`). *(Note: `e2e/support/axe.ts:18-38` `settleAnimations()` calls `document.getAnimations()` — check whether `document.getAnimations()` sees `<dialog>` top-layer transitions cleanly! Yes, `document.getAnimations()` includes top-layer animations (`{ subtree: true }` for `element.getAnimations` if used on shadow elements, verified in `VER-03`), while `Toast`/`Button` spinners run infinitely and `axe.ts:25` already filters `iterations !== Infinity`.)*

#### `Snackbar` & `ToastProvider` (`D-11`)
Upgrade `apps/web/src/components/ui/Toast.tsx` in place while preserving exported `ToastVariant`, `ToastAction`, `ToastInput`, `toastDuration`, `ToastProvider`, and `useToast` (`24` callers!):
- **Single Active Slot + Sequential FIFO Queue:** Maintain `queue: ToastEntry[]`; only render `queue[0]` (`activeToast`)! Dismissing/completing `queue[0]` shifts the queue so `queue[1]` appears cleanly without overlapping stacks (matching MD3 Snackbar spec + `D-11`).
- **Duration Rules (`D-11`):**
  - `success` / `info` WITHOUT `action`: `toastDuration` returns **`4000`**, auto-dismiss timer pops `queue[0]` after `4000ms` (paused/cleared on unmount or explicit user action/dismiss).
  - `variant === 'error'` OR any toast with `action` (`Undo`): `toastDuration` returns **`Number.POSITIVE_INFINITY`**, remaining persistent until the user clicks the `action` button (which triggers `action.onAction()` and dismisses) or clicks the `aria-label="Dismiss"` Close (`×`) `<Icon name="close" />` button (`D-11`).
- **Accessibility:** Polite `<div role="status" aria-live="polite">` (or `<output>`) for `success`/`info`, assertive `<div role="alert">` for `error` (or avoid wrapping the action/dismiss button inside `role="alert"`? Better: keep live text `<span role={toast.variant === 'error' ? 'alert' : 'status'}>` beside the action + Close button inside a landmark `<section aria-label="Notifications">` or `role="region"`!). Note `Toast.test.tsx:61` queries `screen.queryByRole('status', ...)` / `Toast.test.tsx:69` clicks `button` `'Dismiss'` / `Toast.test.tsx:81` clicks `button` `'Undo'` / `Toast.test.tsx:62` queried `queryAllByRole('listitem')` (from Radix Toast's `ol` viewport!). **Flagged Test Impacts (`Toast.test.tsx:33-63` & `chores.test.tsx:308-340`):**
  - `Toast.test.tsx:38-43` currently asserts `toastDuration({ ..., action: Undo })` is `5000` (must update to `Number.POSITIVE_INFINITY` per `D-11`), and `Toast.test.tsx:62,70` asserts `queryAllByRole('listitem')` `0` (update to query the snackbar status/text).
  - `chores.test.tsx:308-340` (`'the completion toast holds Undo for five seconds, then lets it go'`) advances fake timers `4500ms` + `1000ms` expecting Undo to vanish — MUST be updated in Phase 17 alongside `D-11` so `test-unit` stays green!

#### Other Light-DOM Gap Primitives & Native Date/Time Fields (`FND-04`)
| Primitive | Strategy & Contract Notes | Caller / Test Impact |
|---|---|---|
| `Card` (`Card.tsx:1-27`) | Light DOM (`div`/`section`/`article`/`li`). `variant="flat"` -> `surfaceContainerLow` (`16px` padding, `12px` radius, hairline border only in `@media (forced-colors: active)`!); `variant="raised"` -> `surfaceContainer` + `--md-sys-elevation-1` shadow | `11` prod callers + `primitives.test.tsx:180` |
| `ListRow` (`ListRow.tsx:1-56`) | Light DOM (`min-h-[48px]` / `44px+`, optional `onSelect` renders native `<button type="button">` with `aria-current`, `leading`, `trailing`, `description`) styled with MD3 state-layer hover/active & `--md-sys-color-on-surface*` | `3` prod callers + `primitives.test.tsx:207` |
| `Badge` (`Badge.tsx:1-40`) | Light DOM tonal pill (`neutral`/`personal`: `surfaceContainerHigh`/`onSurfaceVariant`; `section`: `secondaryContainer`/`onSecondaryContainer`; `warning`: `warningContainer`/`onWarningContainer`; `danger`: `errorContainer`/`onErrorContainer`). Pair `danger` (`error` icon) & `personal` (`person` icon) with `<Icon>` (`svg[aria-hidden="true"]`) | `3` prod callers + `primitives.test.tsx:162-179` (`querySelector('svg')`) |
| `SegmentedControl` (`SegmentedControl.tsx:1-51`) | Accessible light-DOM MD3 single-select Segmented Button group (`role="radiogroup"` with `aria-label={label}` and `<button type="button" role="radio" aria-checked={isSelected}>` items): `primitives.test.tsx:240-252` strictly asserts `getByRole('radio')`, `Tab` focus into the group, `ArrowRight` moving focus, and `Enter` checking (`toBeChecked()`) without toggling off when already selected — implement roving `tabIndex` + ArrowLeft/ArrowRight/Home/End focus movement + MD3 `20dp` pill border (`outline`), `secondaryContainer` active fill, and leading checkmark icon! | `2` prod callers + `primitives.test.tsx:224-253` |
| `Skeleton` / `SkeletonRows` (`Skeleton.tsx:1-37`) | Keep `useDelayedVisible(delayMs)` (`200ms` delay) + immediate `<div role="status" aria-busy="true"><span className="sr-only">{label}</span>...</div>` with `--md-sys-color-surface-container-highest` placeholder blocks (`prefers-reduced-motion` safe) | `29` prod callers + `primitives.test.tsx:194` |
| `FormMessage` (`FormMessage.tsx:1-20`) | Keep exact `<div role="alert">{message !== undefined && <p ...><Icon name="error" /><span>{message}</span></p>}</div>` DOM structure because `e2e/tests/17-accessibility-states.spec.ts:117,159` asserts `page.getByRole('alert').locator('p')`! | `18` prod callers + E2E spec 17 |
| `DateField` & `TimeField` (`FND-04`, Discretion) | Native `<input type="date">` / `<input type="time">` inside light-DOM outlined wrapper styled to match `<md-outlined-text-field>`: `min-h-14` (`56px`), `4px` radius, `1px solid var(--md-sys-color-outline)` (`2px` `--md-sys-color-primary` on `:focus-within`, `2px` `--md-sys-color-error` on error), `16px` font size (prevents iOS Safari auto-zoom!), floating or top-notch caption label (`text-body-sm`), `aria-invalid={isInvalid || undefined}` directly on `<input>` for `useFieldErrors` | Ready for 7 existing `date`/`time` inputs across 6 files (wired in Phases 18–20; exported & tested in `primitives.test.tsx` in Phase 17) |
| `Switch` (`FND-02`, `D-09`) | New `components/ui/Switch.tsx` wrapping `<MdSwitch>` (`selected={checked}`, `onChange`/`onInput` normalizing `target.selected`, explicit `label` + optional `detail` / `variant="in-list"`, `aria-label` or `<label>` text association so `jsx-a11y/control-has-associated-label` passes!) | New in Phase 17; consumed in Phases 19–20 |
| `Select` (`D-10`) | Preserve `(pointer: coarse)` `useSyncExternalStore` native `<select>` styled as MD3 outlined `56px` control; fine-pointer renders `<MdOutlinedSelect menuPositioning="fixed" error={isInvalid} errorText={error ?? ''} supportingText={hint ?? ''} aria-invalid={isInvalid || undefined}>` with `<MdSelectOption>` children | `6` prod callers + `primitives.test.tsx:108-139` + `e2e/support/app.ts:55` |
| `Tabs` & `OverflowMenu` (`D-09`, `D-12`) | `OverflowMenu`: `<MdIconButton>` trigger + `<MdMenu positioning="fixed">` (`anchor` via `id` / `anchorElement` ref!) + `<MdMenuItem>` items (preserving `isDestructive`, `isDisabled`, `disabledReason` subtitle); `Tabs`: `<MdTabs>` + `<MdPrimaryTab>` (`activeTabIndex`, `change` event -> `onValueChange`, `scrollIntoView` preserved) | `OverflowMenu` (`8`), `Tabs` (`1`) + `primitives.test.tsx` |
| `Checkbox` (`D-09`, `D-12`) | Wrap `<MdCheckbox>` with `<label>` (keeping `variant="in-list"` full-row `min-h-11 px-4 py-3` tap target, explicit visible `label` + optional `detail`, `checked={checked}`, `indeterminate`, `onChange`) — **Verify click/Space activation on `<label><md-checkbox /><span>Label</span></label>` in Chromium and `jsdom`** (`md-checkbox` is `formAssociated` and `ElementInternals` or `label` click activates Shadow DOM checkbox via MD3 `form-label-activation.js`!) | `6` prod callers (`BillForm`, `ErrandRow`, `ShoppingListRow`, `FavoriteStores`, `NotificationsSection`, `NotificationTypeRows`) |

---

## Component & Primitive Migration Impact (Phase 17 Test Strategy, `D-13`)

### Vitest Project Split (`apps/web/vite.config.ts`)
Inspecting `apps/web/vite.config.ts:96-113` and `vitest@5.0.1`'s `TestProjectConfiguration` type (`plugin.d.CN87HSxv.d.ts:3635-3657`) [VERIFIED]:
- Split `test` into two inline `test.projects` entries under `apps/web/vite.config.ts`:
  1. **`unit` (`environment: 'node'`)**: Pure `.test.ts` files (`src/**/*.test.ts`, including `src/tokens.test.ts` which reads `src/styles/tokens.css` via `node:fs` and computes contrast!), running `../../test/clock-setup.mjs`. Zero `jsdom` startup cost!
  2. **`dom` (`environment: 'jsdom'`)**: Component `.test.tsx` files (`src/**/*.test.tsx`), with `resolve: { conditions: ['browser', 'development', 'import', 'module', 'default'] }` (NOTE: Vitest 5 spawns a separate Vite module graph when a project defines `resolve` — verify `tokens.test.ts` is NOT in `dom`, only `.test.tsx` is!), `setupFiles: ['src/test-setup.ts', '../../test/clock-setup.mjs']`.
- Preserve top-level `test.globalSetup: ['../../test/global-tz.mjs']` and `test.coverage.thresholds: { statements: 84, branches: 80, functions: 77, lines: 85 }` (`coverage` lives at root `test` config so `pnpm --filter @hestia/web test:coverage` aggregates both projects cleanly!).

### `test-setup.ts` Shims & `jsdom` Shadow DOM Testing Reality
Probed `jsdom@30.1.0` capabilities [VERIFIED]:
- Needs `import { forceElementInternalsPolyfill } from 'element-internals-polyfill';` (or `element-internals-polyfill/dist/element-internals.js` — note `jsdom` already defines a partial native `attachInternals` so **standard auto-polyfill skips patching**, meaning `forceElementInternalsPolyfill` / forced registration MUST run unconditionally BEFORE `@material/web` custom elements register!).
- Needs shims in `src/test-setup.ts`:
  - `Element.prototype.animate ??= () => ({ finished: Promise.resolve(), cancel: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined })` (required by `<md-dialog>` / `<md-menu>` / `<md-ripple>`!)
  - `globalThis.IntersectionObserver ??= ...`
  - `HTMLDialogElement.prototype.showModal` / `close` (`open = true`/`false`, `dispatchEvent(new Event('close'))` — `jsdom@30.1.0` leaves `HTMLDialogElement.prototype.showModal === undefined`!)
- **CRITICAL Planning Warning — RTL Queries Across 42 Existing Test Files:**
  Across `apps/web/src`, **`42` existing `.test.tsx` files** make **`751` `*ByRole(...)`** calls, **`129` `*ByLabelText(...)`** calls, and **`31` `.closest(...)`** calls across 15 files [VERIFIED: codebase audit]!
  Because `@testing-library/dom@10.4.2` (`aria-query` / `dom-accessibility-api`) in `jsdom` **does NOT pierce `<md-*>` Shadow DOM**:
  - `screen.getByRole('button', { name: 'Save' })` returns **`null`** on `<md-filled-button>Save</md-filled-button>`!
  - `screen.getByLabelText('Password')` returns **`null`** on `<md-outlined-text-field label="Password">`!
  - `screen.getByRole('checkbox', ...)` returns **`null`** on `<md-checkbox>`!
  - `buttonOrCheckboxInsideShadow.closest('li')` returns **`null`** when crossing Shadow DOM boundary (only `host.closest('li')` succeeds)!
  - **What DOES NOT break by accident:** `Select` stays light-DOM `<select>` whenever `stubCoarsePointer()` is active (`apps/web/src/test/browser.ts:27-33`); `Card`, `ListRow`, `Badge`, `SegmentedControl`, `SkeletonRows`, `FormMessage`, `ModalBottomSheet` (`Sheet`), `Snackbar` (`Toast`), `DateField`, `TimeField` remain light DOM!
  - **How the planner must handle the 42 `.test.tsx` screen tests in Phase 17:** Any UI wrapper (`Button`, `TextField`, `TextAreaField`, `Checkbox`, `ConfirmDialog`, `OverflowMenu`, `Tabs`, fine-pointer `Select`) migrated onto Shadow DOM `<md-*>` in Phase 17 requires **either**:
    - (A) Shared shadow-aware RTL query helpers in `apps/web/src/test/` (AND checking which screen tests invoke `getByRole('button')` / `getByLabelText(...)` on `Button`/`TextField`/`Checkbox` and updating those test selectors cleanly without triggering `.jscpd.json` duplication), **OR**
    - (B) Adding host accessibility helpers ONLY where spec-compliant — wait: adding redundant `role="button"` to `<md-filled-button>` host violates ARIA double-role / Playwright (`getByRole('button')` inside Chromium would see TWO buttons: host AND shadow `<button>`!!). **NEVER add `role="button"` / `role="checkbox"` / `role="textbox"` on `<md-*>` custom element hosts!** Instead, build shared shadow-aware RTL test helpers (`apps/web/src/test/md-queries.ts`, e.g., `findMdButton`, `findMdField`, `findMdCheckbox`, `findMdSwitch`, `findMdDialog`, `findMdSelect`, matching accessible name / `label` / `aria-label` across light + `shadowRoot`) and migrate affected screen test assertions cleanly, OR gate Phase 17's wrapper rollout cleanly per plan wave while keeping `pnpm test` green at every commit!

### `D-13` Five-Check Smoke Gate (`primitives.test.tsx`)
Phase 17 explicitly locks `primitives.test.tsx` to prove these 5 behaviors cleanly under `jsdom@30.1.0` + `element-internals-polyfill@3.0.2`:
1. `useFieldErrors` focusing the invalid `<md-outlined-text-field>` host (`aria-invalid="true"` on host -> `document.activeElement === host` and `host.shadowRoot?.activeElement?.tagName === 'INPUT'`).
2. `<md-checkbox>` and `<md-switch>` (`selected`) interactive state toggling & `onChange`/`onInput`.
3. `<md-radio>` (`setValidity` coercion & group checking without throwing `ElementInternals` TypeError).
4. `<md-dialog>` `Escape`/`closed` state sync + `ModalBottomSheet` `<dialog>.showModal()` focus restoration.
5. `<md-outlined-select menuPositioning="fixed">` value selection & `onValueChange` callback.

If ANY of checks 1–5 requires private `@material/web` internals monkeypatching in `jsdom`, escalate the `dom` Vitest project to `@vitest/browser-playwright` (`D-13`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| MD3 Tonal Color Math | Custom HSL darkening/lightening hex formulas | `@material/material-color-utilities@0.4.0` (`SchemeTonalSpot`, `MaterialDynamicColors`, `Blend.harmonize`, `TonalPalette`) | HCT guarantees perceptual chroma + predictable WCAG contrast ratios across all 5 `surfaceContainer*` elevation tiers |
| React <-> Custom Element Prop/Event Bridge | Manual `useRef` + `useEffect` `addEventListener` boilerplate per control | `@lit/react@1.0.8` `createComponent` | Handles React 19 props vs attributes (`in elementClass.prototype`), `className -> class`, forwarded refs, and custom event listener lifecycle |
| MD3 Ripple, Focus Ring, Floating Label, Menu Positioning | Custom CSS ripple animations, custom floating placeholder math, or manual Popper portal | `@material/web@2.5.0` subpaths (`md-ripple`, `md-focus-ring`, `md-outlined-text-field`, `md-menu positioning="fixed"`) | Accessible state tokens, keyboard nav, ARIA wiring, and top-layer/fixed viewport overflow handling already implemented |
| Modal Focus Trap & Scroll Lock | Custom `tabindex` sentinel trap or `document.body.style.overflow = 'hidden'` | Native `<dialog>.showModal()` + `closedby="any"` + `dialog:modal { overscroll-behavior: contain }` | Browser Top Layer guarantees Escape, `inert` background, focus restoration, and zero scroll-jump bugs (per Modern Web Guidance) |
| Material Icon Font Subset / SVG Sprite Server | Custom icon font WOFF2 pipeline or runtime CDN `<link>` | Static `@material-symbols/svg-400@0.48.3/rounded/*.svg` path registry in `Icon.tsx` (`aria-hidden="true"`) | `0 B` Workbox WOFF2 precache, strict Caddy `'self'` CSP compliant, zero screen-reader ligature text leakage |
| Form Error Focus Management | Per-form manual `ref.focus()` switches | Existing `useFieldErrors` (`apps/web/src/lib/use-field-errors.ts`) + host `aria-invalid` forwarding | Preserves uniform validation/focus behavior across existing and migrated screens |

---

## Runtime State Inventory

Checked all 5 runtime state categories for Phase 17 (`FND-01`–`FND-04` token + primitive foundation) — **None apply** [VERIFIED]:

| Category | Status | Evidence |
|---|---|---|
| Stored data (Postgres / IndexedDB / `idb-keyval`) | None | Phase 17 touches only `apps/web` CSS tokens, icon SVGs, and `components/md`/`components/ui` wrappers; zero schema, API, or IndexedDB persistence keys change |
| Live service config / env vars | None | Caddy CSP (`docker/Caddyfile:14`), Vite env prefix (`HESTIA_PUBLIC_`), and Supabase/GoTrue routes stay untouched (`FND-01` uses static CSS, zero inline scripts) |
| OS / scheduled / Workbox precache state | None (handled normally on deploy) | Workbox precache manifest hashes update automatically at Vite build (`vite-plugin-pwa` `injectManifest`); `scripts/generate-icons.mjs` outputs static PNG files under `public/icons/` |
| Secrets / tokens | None | Zero auth or credential changes |
| Build artifacts | None | `apps/web/dist/` is untracked CI/Docker output validated by `apps/web/scripts/check-build.mjs` |

---

## Common Pitfalls

### Pitfall 1: Raw Node `ERR_MODULE_NOT_FOUND` on `@material/material-color-utilities@0.4.0`
- **What goes wrong:** Running `node apps/web/scripts/generate-tokens.mjs` directly fails with `Cannot find module '.../dynamiccolor/dynamic_scheme'` because `@material/material-color-utilities@0.4.0` compiles extensionless relative imports.
- **How to avoid:** Invoke the generator via `esbuild` bundle-to-stdout or Vite's `ssrLoadModule` in `generate-tokens.mjs`, outputting pure LF `apps/web/src/styles/tokens.css`, and verify `tokens.css` via `tokens.test.ts` inside Vitest (whose Vite resolver handles extensionless ESM imports cleanly).

### Pitfall 2: Naive `Blend.harmonize()` Failing 4.5:1 on `surfaceContainerHighest`
- **What goes wrong:** Passing `#15803D` or `#A16207` through `Blend.harmonize()` alone yields `#467c22` (`3.91:1`) and `#a95d20` (`3.81:1`) against Warm Terracotta `surfaceContainerHighest` (`#f1dfd9`), breaking WCAG 4.5:1 normal text contrast (`FND-01` / `VER-03` axe-core audits).
- **How to avoid:** Pipe each harmonized HCT color through `TonalPalette.fromHueAndChroma(harm.hue, harm.chroma)` and select `tone(40)` (or `tone(36)`) in light mode (`>= 4.99:1`) and `tone(80)` in dark mode (`>= 7.25:1`), plus explicit `Container` (`90`/`30`) and `OnContainer` (`10`/`90`) tokens.

### Pitfall 3: `positioning="fixed"` vs `menuPositioning="fixed"` on `MdOutlinedSelect`
- **What goes wrong:** Writing `<MdOutlinedSelect positioning="fixed">` compiles as an unknown HTML attribute and leaves `<md-outlined-select>` at its default `menuPositioning = 'popover'`, which breaks in `jsdom` (no Popover API) and misaligns inside scrolled containers.
- **How to avoid:** Pass `menuPositioning="fixed"` on `<MdOutlinedSelect>` (`menu-positioning="fixed"`) and `positioning="fixed"` on standalone `<MdMenu>`.

### Pitfall 4: `softDisabled` Buttons Firing React `onClick` & Defaulting to `type="submit"`
- **What goes wrong:** Users clicking or pressing Enter on `<Button disabledReason="Needs a connection.">` still trigger React `onClick` handlers because `<md-filled-button>`'s internal `<button>` click bubbles to React's root delegation listener (`softDisabled` does not set native `disabled`). Also, omitted `type` defaults to `'submit'` via `@material/web`'s `mixinFormSubmitter` (`form-submitter.js:41`), accidentally submitting surrounding forms on secondary/Cancel buttons.
- **How to avoid:** Default `type = 'button'` in `Button.tsx`, set `softDisabled={isUnavailable}`, forward `aria-disabled={isUnavailable || undefined}` + `aria-describedby` to host, AND short-circuit inside React `onClick`: `if (isUnavailable) { e.preventDefault(); e.stopPropagation(); return; }`.

### Pitfall 5: React 19 / `exactOptionalPropertyTypes` `TS2375` on `@lit/react` Props
- **What goes wrong:** Forwarding `disabled={disabled}` (`boolean | undefined`) or `supportingText={hint}` (`string | undefined`) to `@lit/react` `ElementProps<I>` causes `Type 'boolean | undefined' is not assignable to type 'boolean'` under `tsconfig.base.json:10`.
- **How to avoid:** Use a zero-cast helper `omitUndefined` (or spread `{ ...(prop !== undefined ? { prop } : {}) }` / boolean coercion) inside `components/md/` and `components/ui/`.

### Pitfall 6: `eslint-plugin-jsx-a11y` `strict` Leaves `control-has-associated-label` Disabled
- **What goes wrong:** Developers rely on `jsxA11y.flatConfigs.strict` in `eslint.config.js:93` thinking `<Switch />` or `<MdIconButton />` without labels will fail ESLint, when `strict` configures `control-has-associated-label` as **`['off', ...]`**.
- **How to avoid:** Explicitly set `'jsx-a11y/control-has-associated-label': ['error', ...]` and do NOT alias `Checkbox` or `Switch` to `'input'` in `settings['jsx-a11y'].components` (`ignoreElements` explicitly skips `'input'`).

### Pitfall 7: `<dialog>` Light Dismiss & Safari / Scroll Leaks (`ModalBottomSheet`)
- **What goes wrong:** Styling `dialog { display: flex }` keeps closed `<dialog>` visible on page load; `overflow: hidden` on `html`/`body` causes horizontal layout shift when scrollbar disappears; `closedby="any"` alone fails on Safari `< 18.x` and `jsdom`.
- **How to avoid:** Style `dialog[open] { display: flex; }`, set `dialog:modal { overscroll-behavior: contain; }` + `dialog::backdrop { overflow: hidden; overscroll-behavior: contain; }`, set `closedby="any"` PLUS `if (!('closedBy' in HTMLDialogElement.prototype))` `pointerdown`/`pointerup` bounding-rect check, reset `dialog.returnValue = ''` on close, and keep a real accessible Close button (`aria-label="Close"`).

### Pitfall 8: Unupdated `Toast.test.tsx` & `chores.test.tsx` After `D-11` Persistent Undo Snackbar
- **What goes wrong:** Existing tests `Toast.test.tsx:38-43,62,70` and `chores.test.tsx:308-340` hardcode 5s auto-dismissal of `Undo` toasts and Radix `listitem` roles, causing `pnpm test` failures immediately upon landing `Snackbar`.
- **How to avoid:** Update `Toast.test.tsx` and `chores.test.tsx:308-340` in the same plan task as `Toast.tsx` (`Snackbar`) to assert persistence until `Undo` or `Dismiss` (`Close`) is clicked.

### Pitfall 9: Breaking 42 Screen Test Files via Shadow DOM `ByRole`/`ByLabelText` Blindness
- **What goes wrong:** Replacing `Button`, `TextField`, `TextAreaField`, and `Checkbox` with Shadow DOM `<md-*>` tags causes `751` `*ByRole` and `129` `*ByLabelText` queries in `jsdom` to return `null`.
- **How to avoid:** Treat Vitest Shadow DOM helper creation (`apps/web/src/test/md-queries.ts`) + auditing/updating existing `.test.tsx` screen specs (and `primitives.test.tsx` `D-13` gate) as explicit first-class tasks in Phase 17 — never defer broken unit tests to Phase 18!

---

## Code Examples

### 1. `@lit/react` Adapter + `exactOptionalPropertyTypes` Helper (`components/md/MdButton.tsx`)
```ts
import { createComponent } from '@lit/react';
import { MdFilledButton } from '@material/web/button/filled-button.js';
import { MdOutlinedButton } from '@material/web/button/outlined-button.js';
import { MdTextButton } from '@material/web/button/text-button.js';
import * as React from 'react';

export const LitFilledButton = createComponent({
  tagName: 'md-filled-button',
  elementClass: MdFilledButton,
  react: React,
});

export const LitOutlinedButton = createComponent({
  tagName: 'md-outlined-button',
  elementClass: MdOutlinedButton,
  react: React,
});

export const LitTextButton = createComponent({
  tagName: 'md-text-button',
  elementClass: MdTextButton,
  react: React,
});
```

### 2. Forced `element-internals-polyfill` + `jsdom` Shims (`apps/web/src/test-setup.ts`)
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { forceElementInternalsPolyfill } from 'element-internals-polyfill';
import { afterEach, vi } from 'vitest';

// Must run before any @material/web custom element registers: jsdom@30.1.0 exposes partial
// attachInternals without CustomStateSet or full form validity coercion.
forceElementInternalsPolyfill();

if (typeof Element.prototype.animate !== 'function') {
  Element.prototype.animate = () =>
    ({
      finished: Promise.resolve(),
      cancel: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as Animation;
}

if (typeof globalThis.IntersectionObserver !== 'function') {
  globalThis.IntersectionObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = () => [];
    root = null;
    rootMargin = '';
    thresholds = [];
  };
}

if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(returnValue?: string) {
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
});
```
*(Verify exact exported symbol name in `element-internals-polyfill@3.0.2/dist/index.d.ts` before committing — in `element-internals-polyfill@3.0.2`, check if default export/named `forceElementInternalsPolyfill` or `ElementInternals` re-export matches `dist/index.d.ts`! Flagged as quick Wave 0 check.)*

### 3. `ModalBottomSheet` with `<dialog>.showModal()` + Cross-Browser Light-Dismiss (`D-09`, Discretion)
```tsx
// Uses native <dialog>.showModal() (role="dialog" implicit — do NOT add role/aria-modal).
// closedby="any" enables top-layer Escape + backdrop dismiss on Chromium/Firefox;
// Safari fallback tracks pointerdown + pointerup outside getBoundingClientRect().
useEffect(() => {
  const dialog = dialogRef.current;
  if (!dialog) return;
  if (open && !dialog.open) {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
  } else if (!open && dialog.open) {
    dialog.close();
  }
}, [open]);

const handleClose = (): void => {
  const dialog = dialogRef.current;
  if (dialog) dialog.returnValue = '';
  onOpenChange(false);
  previousFocusRef.current?.focus();
  previousFocusRef.current = null;
};
```

### 4. CSS Sheet / Backdrop Rules (`apps/web/src/styles/gap-primitives.css`)
```css
dialog.hestia-sheet:modal {
  overscroll-behavior: contain;
}

dialog.hestia-sheet::backdrop {
  background: color-mix(in srgb, var(--md-sys-color-scrim) 32%, transparent);
  overflow: hidden;
  overscroll-behavior: contain;
}

dialog.hestia-sheet[open] {
  display: flex;
  flex-direction: column;
  inset: auto 0 0;
  margin-inline: auto;
  width: 100%;
  max-width: 640px;
  max-height: 85dvh;
  border: 0;
  border-radius: 28px 28px 0 0;
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: var(--md-sys-elevation-1);
}

@media (forced-colors: active) {
  dialog.hestia-sheet[open],
  .hestia-card {
    border: 1px solid CanvasText;
  }
}
```

---

## State of the Art

| Old Approach (v2.x) | MD3 / Modern Web Standard (Phase 17) | When Changed | Impact |
|---|---|---|---|
| Five `[data-section]` Tailwind ramps + slate `#475569` | Single Warm Terracotta HCT palette (`#B4532A` seed -> `SchemeTonalSpot` + 5 `surfaceContainer*` tiers) | MD3 (`@material/material-color-utilities@0.4.0`) | Eliminates multi-hue section borders/backgrounds; guarantees AA contrast across elevation surfaces |
| Radix UI `Dialog` / `AlertDialog` + `overflow: hidden` body locks | Native `<dialog>.showModal()` + `closedby="any"` + `overscroll-behavior: contain` + `@starting-style` + `md-dialog` | HTML Dialog `closedby` & CSS Top Layer baselines | Simpler modal focus/scroll behavior and alignment with MD3 top-layer elevation |
| Auto-dismissing `5s` Undo toast (`radix-ui` `Toast`) | Single active MD3 `Snackbar` + FIFO queue; `4000ms` for `success`/`info`, persistent for `action`/`error` (`D-11`) | Accessibility WCAG 2.2.1 (Timing Adjustable) | Prevents assistive-tech / slower users from missing time-critical Undo actions |
| `lucide-react` JS React trees across bundles | Curated rounded `@material-symbols/svg-400` inline `<svg><path d="..."/></svg>` (`aria-hidden="true"`, `0 B` WOFF2 precache) | Material Symbols Rounded `0.48.3` | Consistent MD3 iconography + zero font flash under strict Caddy `'self'` CSP |

---

## Assumptions Log

| Claim | Basis | Confidence | How Verified / Plan Check |
|---|---|---|---|
| `@vitest/browser-playwright` version matching `vitest@5.0.1` | Training knowledge (not installed or tested in workspace) | `LOW` [ASSUMED] | Only fetched/checked if `D-13` `jsdom` smoke gate fails |
| Extracted SVG `<path d="...">` strings across all 54 + 13 icons total `< 12 KB` gzipped | Measured 8 sample icons (`5,225 B` raw / `1,706 B` gz) + verified `0` missing in `0.48.3` tarball; exact full-54+13 sum not re-run in this session | `MEDIUM` | Run `pnpm --filter @hestia/web build` (`check-build.mjs` checks `<= 200 KB` gzipped shell) right after implementing `Icon.tsx` |
| Exact named export name `forceElementInternalsPolyfill` in `element-internals-polyfill@3.0.2/dist/index.d.ts` | Observed `dist/` directory contains `index.d.ts` and `element-internals.d.ts`, did not print `index.d.ts` contents in this session | `MEDIUM` | Check `element-internals-polyfill/dist/index.d.ts` on install before editing `src/test-setup.ts` |

---

## Open Questions (RESOLVED)

1. **Vitest `D-13` check #3 (`<md-radio>` `setValidity` coercion) under `jsdom@30.1.0` + `element-internals-polyfill@3.0.2`:**
   - **What we know:** `<md-radio>`'s `RadioValidator` (`radio/internal/radio.js:140`, `labs/behaviors/constraint-validation.js:120`) calls `setValidity({ ...validity, customError }, ...)`.
   - **What's unclear:** Whether `element-internals-polyfill@3.0.2` accepts spreading `ValidityState` flags cleanly without throwing `TypeError` when `forceElementInternalsPolyfill()` patches `jsdom@30.1.0`.
   - **RESOLVED:** Execute all 5 `D-13` smoke checks in Wave 2 before rolling out `components/ui/` wrappers; keep tests on `jsdom@30.1.0` + `forceElementInternalsPolyfill()` if all 5 checks pass without private internal hacks, or pivot the `dom` Vitest project to `@vitest/browser-playwright` exclusively if check #3 (or checks #1–#5) fails.

2. **Wave Rollout of Shadow DOM Wrappers vs 42 Screen Test Files (`pnpm test` green at every step):**
   - **What we know:** Replacing `Button`, `TextField`, `TextAreaField`, `Checkbox` with `<md-*>` custom elements in Phase 17 causes `751` `*ByRole` and `129` `*ByLabelText` RTL queries across 42 existing `.test.tsx` files to fail unless updated with shadow-aware helpers (`apps/web/src/test/`).
   - **RESOLVED:** Keep Wave 1 (`unit` node vs `dom` jsdom split) and Wave 2 (`components/md/*` + `apps/web/src/test/md-queries.ts` under `.jscpd.json` `threshold: 5`) non-breaking for existing screens, then roll out `components/ui/` wrappers and synchronize affected `.test.tsx` suites cleanly across Wave 5–6 feature batches so full `pnpm --filter @hestia/web test:coverage` passes before Phase 17 completion.

---

## Environment Availability

| Tool / Binary | Status | Version / Details | Impact on Phase 17 |
|---|---|---|---|
| Node.js | Available (`engines` mismatch note) | `v26.11.0` locally (`package.json:7` declares `>=24 <25`) | Verify CI parity (CI runs Node 24); raw Node fails `@material/material-color-utilities@0.4.0` extensionless ESM, so use `esbuild` / Vite `ssrLoadModule` |
| pnpm | Available | `10.34.5` | Workspace install, scripts, coverage, `audit-prod` |
| Git | Available | `2.56.0.windows.1` | Ensure LF line endings (`scripts/check-repo-hygiene.mjs`) on Windows |
| `esbuild` | Available (in workspace `node_modules`) | `0.28.2` | Fast zero-overhead bundling for `generate-tokens.mjs` |
| Vitest / TypeScript / ESLint / Knip / JSCPD | Available (installed) | `vitest@5.0.1`, `typescript@6.0.3`, `eslint@10.11.0`, `knip@6.41.0`, `jscpd@5.4.1` | All CI gates runnable locally |
| Playwright (`@playwright/test`) | Installed in `e2e/` | `@playwright/test@1.63.0`, `@axe-core/playwright@4.13.0` | Needed only for full stack Docker E2E or if `D-13` escalates to browser mode |

---

## Validation Architecture

`config.nyquist_validation` is `true` [VERIFIED: `.planning/config.json`] and CI gates every merge with `test:coverage` (`84/80/77/85`), `lint`, `typecheck`, `build`, `knip`, `jscpd`, and `check-repo-hygiene` (`.github/workflows/ci.yml`).

### Test Framework & Quick/Full Commands
- **Runner:** Vitest `5.0.1` (`apps/web/vite.config.ts`) split into `unit` (`node` project) + `dom` (`jsdom` project with `resolve.conditions: ['browser', ...]` and `src/test-setup.ts`).
- **Quick check (per task):** `pnpm --filter @hestia/web exec vitest run src/tokens.test.ts src/components/ui/primitives.test.tsx src/components/ui/Toast.test.tsx`
- **Coverage & typecheck/lint (per wave):** `pnpm --filter @hestia/web test:coverage && pnpm typecheck && pnpm lint && pnpm format:check`
- **Full phase verification:** `pnpm build && pnpm knip && node scripts/check-knip-baseline.mjs && pnpm jscpd && node scripts/audit-prod.mjs && node scripts/check-repo-hygiene.mjs` (plus `pnpm test:e2e` where Compose stack is available).

### Phase Requirements -> Test Map

| Req ID | Behavior Under Test | Test Type | Command / File Target | Automated? | Wave 0 Gap |
|---|---|---|---|---|---|
| `FND-01` | Light, dark (`@media`), `[data-theme="light"]`, `[data-theme="dark"]` `--md-sys-color-*` + harmonized semantic status tokens pass `>= 4.5:1` / `>= 3:1` AA contrast across all 5 `surfaceContainer*` tiers | Unit (`node` project) | `apps/web/src/tokens.test.ts` (reads `src/styles/tokens.css` from disk) | Yes | Rewrite `tokens.test.ts` away from deleted `#475569` / `[data-section]` hexes |
| `FND-01` / `FND-03` | Dual `theme-color` `<meta>` tags, `<meta name="color-scheme">`, zero inline scripts, `<= 200 KB` gzipped shell budget, `MAGIC_LINK_COPY` & zero CDN hosts | Build / Post-build check | `pnpm --filter @hestia/web build` (`apps/web/scripts/check-build.mjs`) | Yes | Update `apps/web/index.html` + `apps/web/vite.config.ts` |
| `FND-02` | `@material/web@2.5.0` `@lit/react` adapters, `D-13` 5 smoke checks (`useFieldErrors` host `aria-invalid` + focus, `md-checkbox`/`md-switch`, `md-radio`, `md-dialog` `Escape`/`closed`, `md-outlined-select`), `softDisabled` click guard + inline `disabledReason`, `type="button"` default, `ConfirmDialog` outside-click lock | Component (`dom` project) | `apps/web/src/components/ui/primitives.test.tsx` | Yes | Add `src/test-setup.ts` polyfills + `src/test/md-queries.ts` + update `primitives.test.tsx` |
| `FND-02` | No `@material/web`/`lit` imports outside `components/md/`; `control-has-associated-label` error on unlabelled controls | Static lint | `pnpm lint` (`eslint.config.js`) | Yes | Add ESLint `no-restricted-imports` + `jsx-a11y` rules |
| `FND-03` | `Icon.tsx` renders rounded `<svg aria-hidden="true">` for registered names, switches to filled path when `filled={true}`, `0 B` WOFF2 Workbox cache | Component + Build | `primitives.test.tsx` (`Icon` + `Badge`) + `pnpm --filter @hestia/web build` | Yes | Create `Icon.tsx` + `icon-paths.ts` |
| `FND-04` | `ModalBottomSheet`/`Sheet` `<dialog>.showModal()` focus restoration + Escape/backdrop/Close dismissal; `Snackbar` FIFO single slot, `4000ms` auto-dismiss (`success`/`info`), persistent `action`/`error`; `DateField`/`TimeField` `aria-invalid` & error linking; `Card`/`ListRow`/`Badge`/`SegmentedControl`/`Skeleton`/`FormMessage` | Component (`dom` project) | `primitives.test.tsx` + `Toast.test.tsx` + updated `chores.test.tsx` | Yes | Update `Toast.test.tsx:33-72` & `chores.test.tsx:308-340` for persistent Undo |

### Sampling Rate & CI Coverage Ratchet
- Coverage thresholds enforced on every PR (`apps/web/vite.config.ts:111`): **`{ statements: 84, branches: 80, functions: 77, lines: 85 }`**.
- Because `components/md/` and `components/ui/` live under `apps/web/src/`, all new branches (`Switch`, `ModalBottomSheet`, Safari light-dismiss fallback, `DateField`, `TimeField`, `Icon` `filled` vs outline, `Snackbar` FIFO queue) **must** be exercised in `primitives.test.tsx` and `Toast.test.tsx` so coverage stays safely above `84/80/77/85`.

---

## Security Domain

`config.security_enforcement` is enabled (`security_asvs_level: 1`) [VERIFIED: `.planning/config.json`]. Applicable Phase 17 ASVS V5 / V14 client controls:

| Control / Threat | Mitigation Verified in Phase 17 Design | Location |
|---|---|---|
| Strict Content Security Policy (`docker/Caddyfile:14`: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'`) | Zero inline `<script>` for theme FOUC prevention (`D-02` pure CSS `:root` + `@media (prefers-color-scheme: dark)` + `[data-theme]`); static CSS tokens; inline SVG `<path d="...">` strings without external CDNs or `data:` font links; `check-build.mjs` verifies zero forbidden external hosts | `apps/web/index.html`, `apps/web/src/styles/tokens.css`, `apps/web/src/components/ui/Icon.tsx`, `apps/web/scripts/check-build.mjs` |
| XSS / Unescaped HTML Injection via SVG Assets | Prefer `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d={ICON_PATHS[key]} /></svg>` static path registry over `dangerouslySetInnerHTML` on raw `.svg` strings | `apps/web/src/components/ui/Icon.tsx` |
| Disabled / Offline Control Action Bypass (`soft-disabled`) | Explicit React `onClick` guard (`if (isUnavailable) { event.preventDefault(); event.stopPropagation(); return; }`) because `@material/web` shadow `<button>` clicks reach React synthetic handlers even with `softDisabled` | `apps/web/src/components/ui/Button.tsx` |
| Supply-Chain & Advisory Hygiene | Pin exact versions (`@material/web@2.5.0`, `@lit/react@1.0.8`, etc.), human-verify `@material-symbols/svg-400@0.48.3` (`SUS: too-new`), run `node scripts/audit-prod.mjs` | `apps/web/package.json`, `pnpm-lock.yaml`, `scripts/audit-prod.mjs` |

---

## Sources

### Primary / Authoritative Verified Sources
- Workspace governance & configurations: `.claude/CLAUDE.md`, `.planning/config.json`, `.planning/REQUIREMENTS.md`, `.planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-CONTEXT.md`, `package.json`, `tsconfig.base.json`, `eslint.config.js`, `docker/Caddyfile`, `knip.json`, `.jscpd.json`, `.github/workflows/ci.yml` [VERIFIED: file read]
- Web application files audited: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/index.css`, `apps/web/src/tokens.test.ts`, `apps/web/src/test-setup.ts`, `apps/web/src/test/browser.ts`, `apps/web/src/lib/use-field-errors.ts`, `apps/web/src/lib/use-delayed-visible.ts`, `apps/web/src/lib/section-context.tsx`, `apps/web/scripts/generate-icons.mjs`, `apps/web/scripts/check-build.mjs`, all 18 files in `apps/web/src/components/ui/`, `apps/web/src/screens/chores/chores.test.tsx`, `e2e/support/{app,axe}.ts`, `e2e/tests/17-accessibility-states.spec.ts`, `test/{clock-setup,global-tz}.mjs` [VERIFIED: file read]
- Installed/tarball package internals inspected directly: `@material/web@2.5.0` tarball & `.d.ts`/`.js` internals (`button`, `iconbutton`, `textfield`, `select`, `checkbox`, `switch`, `radio`, `dialog`, `menu`, `tabs`, `progress`, `labs/behaviors`), `@lit/react@1.0.8` (`create-component.js`, `create-component.d.ts`), `@material/material-color-utilities@0.4.0` (`esbuild` execution), `@material-symbols/svg-400@0.48.3` tarball (`23,643` entries, `rounded/*.svg`), `eslint-plugin-jsx-a11y@6.10.2` (`lib/index.js`), `@types/react@19.3.0` (`DialogHTMLAttributes`), `vitest@5.0.1` (`plugin.d.CN87HSxv.d.ts`) [VERIFIED: tool output]
- Modern Web Guidance plugin patterns (`modern-web-guidance/SKILL.md`: `dialog`, `light-dismiss-a-dialog`, `prevent-page-scroll-under-modal-dialog`, `animate-to-from-top-layer`, `dark-mode`, `color`) [CITED: installed `modern-web-guidance` skill guides]
- `gsd-tools.cjs` legitimacy & planning seams (`package-legitimacy check`, `research-plan`, `classify-confidence`) [VERIFIED: command execution]

---

## Metadata

- **Confidence breakdown:**
  - Standard stack & versions: **HIGH** (tarballs, `.d.ts`, `create-component.js`, and `package-legitimacy check` executed directly; `@material-symbols/svg-400` flagged `SUS: too-new` for `checkpoint:human-verify`)
  - Token palette & contrast math: **HIGH** (exact hexes and WCAG AA ratios computed directly with `@material/material-color-utilities@0.4.0`)
  - React 19 + `@material/web@2.5.0` & ESLint architecture: **HIGH** (all props/events verified against `@material/web@2.5.0` source + `@lit/react@1.0.8` + `jsx-a11y@6.10.2`)
  - Test harness (`D-13`): **MEDIUM-HIGH** (42-file RTL query census measured directly; `md-radio` `setValidity` coercion & `jsdom` polyfill edge flagged for Wave 1 `D-13` smoke check gate)
- **Research date:** 2026-11-11
- **Valid until:** ~2026-12-11 (or until `@material/web` / `@material-symbols/svg-400` package versions change)
