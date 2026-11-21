# Technology Stack — Hestia v3.0 Material Design 3 Overhaul

**Project:** Hestia (`apps/web`)
**Researched:** 2026-11-11
**Scope:** Frontend Material Design 3 overhaul ONLY (`apps/web` design system, components, icons, tokens, bundling, TypeScript/React 19 integration, Vite/CSP/PWA/testing/linting). Validated backend, database, routing, TanStack Query, Workbox/BarcodeDetector core stack is unchanged.
**Overall Confidence:** **HIGH** — All npm versions, runtime dependencies, unpacked exports/types, WOFF2 font axes, `esbuild` bundle weights, `typescript@6.0.3` compiler behavior, and `jsdom@30.1.0` / `@testing-library/react@16.3.3` compatibility were empirically verified against the repository toolchain.

---

## Executive Decision Summary

Adopt **Google `@material/web@2.5.0`** via **per-component subpath imports** wrapped with **`@lit/react@1.0.8`** inside thin Hestia React UI primitives (`apps/web/src/components/ui/`), paired with **`@material-symbols/font-400@0.48.3`** (self-hosted variable-`FILL` WOFF2 precached offline by Workbox), build-time MD3 token generation via **`@material/material-color-utilities@0.4.0`**, and clean light-DOM CSS + semantic HTML wrappers for the Material Design 3 components absent from `@material/web` stable (Navigation Bar, Navigation Rail, Top App Bar, Bottom/Side Sheet, Card, Snackbar, and native Date/Time fields). Remove Tailwind CSS v4, Radix UI, and Lucide completely.

---

## Recommended Stack Additions & Upgrades

### Production Dependencies (`apps/web/package.json`)

| Technology | Verified Version | Released | Runtime Deps | Purpose | Why Recommended |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `@material/web` | `2.5.0` | `2026-07-15` | `lit@^2.8.0 \|\| ^3.0.0`, `tslib@^2.4.0`, `@lit/context@^1.1.6` | Core Material Design 3 custom elements, elevation, ripple, focus ring, & MD3 v0.192 CSS/typescale tokens | Official Google Material Design 3 web component library. Gives authentic MD3 controls, ink ripple, focus rings, `--md-sys-color-*` integration, and built-in typescale classes (`@material/web/typography/md-typescale-styles.css`). Maintenance-mode status (`2.5.1-nightly.*` ongoing) means stable subpath APIs with low churn. |
| `@lit/react` | `1.0.8` | `2025-07-11` | None (`peerDependencies`: `@types/react: 17 \|\| 18 \|\| 19`) | Strongly typed React 19 wrapper factory (`createComponent`) | Maps custom element events (`close`, `closed`, `open`, `cancel`, `change`, `input`) to React camelCase callbacks (`onClose`, `onClosed`, etc.), assigns JS properties/booleans cleanly, avoids manual `JSX.IntrinsicElements` boilerplate, and costs only **1.36 KB min / 0.77 KB gz**. |
| `@material-symbols/font-400` | `0.48.3` | `2026-11-04` | None | Self-hosted Material Symbols Outlined WOFF2 icon font (`FILL: 0..1` variable axis) | Satisfies Caddy's `'self'`-only CSP, matches `<md-icon>`'s default `font-family: "Material Symbols Outlined"`, uses `font-display: block` (no ligature text flash), supports `FILL` `0→1` transitions for active navigation states, and is **482.4 KiB (`493,972` bytes)** — safely under Workbox's 2 MiB precache limit. |

> **Note on `lit`:** Do **not** add `lit` directly to `apps/web/package.json` unless application code imports from `'lit'` directly (to write new Lit custom elements). Keeping `lit` (`3.3.3`) as a transitive dependency of `@material/web` satisfies pnpm strict isolation and Knip's unused-dependency check.

### Development Dependencies (`apps/web/package.json`)

| Technology | Verified Version | Released | Runtime Deps | Purpose | Why Recommended |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `@material/material-color-utilities` | `0.4.0` | `2026-01-21` | None | Build-time MD3 `SchemeTonalSpot` + `MaterialDynamicColors` tonal palette generator | Computes all 49 MD3 `--md-sys-color-*` light + dark roles from a warm terracotta/amber seed color via HCT color space and `SchemeTonalSpot`. Keeping it build-time avoids runtime palette JS inside the 200 KB app shell budget. |
| `element-internals-polyfill` | `3.0.2` | `2025-04-16` | None | Polyfills form-associated `ElementInternals` (`setFormValue`, `setValidity`, `states`) in `jsdom@30.1.0` | `jsdom@30.1.0` implements `attachInternals()` and `.role`, **but** omits `internals.states` (`CustomStateSet`), `setFormValue`, and `setValidity`, causing `@material/web` form controls to throw `TypeError: this[internals].setFormValue is not a function` in Vitest unless polyfilled. |

### Packages to Remove (`apps/web/package.json` + Configs)

| Remove Package | Current Version | Replaced By | Impact |
| :--- | :--- | :--- | :--- |
| `tailwindcss` | `4.3.3` | Plain MD3 CSS (`src/index.css`, `@material/web/typography/md-typescale-styles.css`, component CSS modules / colocated CSS) | Removes utility compiler + Tailwind CSS chunk (`index.css` was `8.6 KB` gz); remove `@tailwindcss/vite` plugin from `apps/web/vite.config.ts` and `"tailwindcss"` from `knip.json` `ignoreDependencies`. |
| `@tailwindcss/vite` | `4.3.3` | Native Vite CSS pipeline | Eliminates Tailwind Vite build plugin. |
| `radix-ui` | `1.6.7` | `@material/web` (`dialog`, `menu`, `select`, `checkbox`, `switch`, `tabs`) + native `<dialog>` MD3 Sheet | Reclaims **~32–34 KB gz** per Radix subset (current shared `Button-*.js` shell chunk alone holds **27.8 KB gz** of Radix/Lucide weight). |
| `lucide-react` | `1.47.0` | `@material-symbols/font-400` via `<md-icon>` | Reclaims **~5.91 KB gz** (`16.94 KB` min for ~49 icons) and eliminates 62 files' SVG icon imports. |

---

## `@material/web@2.5.0` Component Inventory vs. MD3 Gaps

Only import **stable** `@material/web` entrypoints per component subpath. **Do not import `@material/web/all.js`** (`460.24 KB` min / `78.89 KB` gz) and **do not use `@material/web/labs/*`** (`labs/badge`, `labs/card`, `labs/item`, `labs/navigationbar`, `labs/navigationdrawer`, `labs/navigationtab`, `labs/segmentedbutton`, `labs/segmentedbuttonset`).

### Verified Rationale for Avoiding `@material/web/labs/*`
- `labs/navigationbar` renders `<div class="md3-navigation-bar" role="tablist">` (`@material/web/labs/navigationbar/internal/navigation-bar.js:32`), breaking React Router `<NavLink>` `<a href>` semantics, browser link previews/new-tab opening, and `<nav aria-label>` landmark expectations.
- `labs/card` (`md-elevated-card`, `md-filled-card`, `md-outlined-card`) is a 21-line wrapper around `<md-elevation>` + `<slot>` (`@material/web/labs/card/internal/card.js`) carrying unstable `labs/` versioning caveats, where light-DOM CSS + optional `<md-elevation>`/`<md-ripple>` is simpler and avoids shadow-DOM layout styling friction.
- All `labs/` modules explicitly carry Google's pre-release/no-semver warning.

### Component Mapping Table

| Hestia Primitive / Gap | Source / Package | Exact Tag / HTML Pattern | Notes & Verified Behavior |
| :--- | :--- | :--- | :--- |
| **Buttons** | `@material/web/button/*` | `md-filled-button`, `md-filled-tonal-button`, `md-outlined-button`, `md-text-button`, `md-elevated-button` | Stable. Keep common variants lightweight; avoid importing unused `elevated-button` unless needed. |
| **Icon & Icon Buttons** | `@material/web/icon/icon.js`, `@material/web/iconbutton/*` | `md-icon`, `md-icon-button`, `md-filled-icon-button`, `md-filled-tonal-icon-button`, `md-outlined-icon-button` | `<md-icon>` consumes `--md-icon-font` (defaults to `'Material Symbols Outlined'`) and also supports `<svg>` slotting. |
| **FAB** | `@material/web/fab/fab.js` | `md-fab` | Stable. Supports `variant="primary\|secondary\|tertiary\|surface"`, `size="small\|medium\|large"`, and `label` (extended FAB). |
| **Dialogs & Confirm** | `@material/web/dialog/dialog.js` | `md-dialog` | Stable. Uses native top-layer `<dialog>`, focus trap (`noFocusTrap=false`), `type="alert"` for destructive confirmations (`role="alertdialog"` inside shadow `<dialog>`), `slot="headline"`, `slot="content"`, `slot="actions"`. |
| **Text / Email / Password / Search / Number / URL / Textarea** | `@material/web/textfield/*` | `md-outlined-text-field` (or `md-filled-text-field`) | Stable for `TextFieldType = 'email' \| 'number' \| 'password' \| 'search' \| 'tel' \| 'text' \| 'url' \| 'textarea'`. Built-in `error`, `errorText`, `supportingText`, `prefixText`, `suffixText`, `noSpinner`, `maxLength`. |
| **Date & Time Inputs (GAP)** | Custom light-DOM wrapper | Styled native `<input type="date">` & `<input type="time">` inside MD3 outlined field container | **Verified gap:** `@material/web/textfield/internal/text-field.d.ts:19` classifies `'date'` and `'time'` as `UnsupportedTextFieldType`, and `@material/web` CSS sets `.input::-webkit-calendar-picker-indicator { display: none; }` while native placeholders overlap the floating label. Style native inputs with `--md-sys-color-outline`, `--md-sys-shape-corner-extra-small` (`4px`), and MD3 label/error tokens to preserve OS mobile date/time pickers. |
| **Select / Dropdown** | `@material/web/select/*` | `md-outlined-select` + `md-select-option` | Stable. Use light-DOM fallback helpers only if async searchable filtering is needed; standard form selects work cleanly. |
| **Overflow Menu** | `@material/web/menu/*` | `md-menu` + `md-menu-item` (+ `md-sub-menu` if needed) | Stable. Anchors to trigger button via `anchorElement` ref / `id` and `anchor`. |
| **Checkbox / Switch / Radio** | `@material/web/checkbox/checkbox.js`, `switch/switch.js`, `radio/radio.js` | `md-checkbox`, `md-switch`, `md-radio` | Stable. Note `md-switch` uses `selected` boolean (not `checked`), while `md-checkbox` and `md-radio` use `checked`. |
| **Tabs (Sub-navigation)** | `@material/web/tabs/*` | `md-tabs` + `md-primary-tab` / `md-secondary-tab` | Stable. Good for in-page view switches (e.g., Pantry/Lists/Recipes tabs). |
| **Chips (Filters / Tags)** | `@material/web/chips/*` | `md-chip-set` + `md-filter-chip` / `md-assist-chip` / `md-input-chip` | Stable. |
| **List Rows** | `@material/web/list/*` | `md-list` + `md-list-item` | Stable. `slot="start"`, `slot="end"`, `slot="headline"`, `slot="supporting-text"`, `type="button\|link\|text"`. |
| **Progress / Loading** | `@material/web/progress/*` | `md-circular-progress`, `md-linear-progress` | Stable. Use `indeterminate` for spinners and `value` (`0..1`) for progress bars; keep CSS pulse `Skeleton` for list placeholders. |
| **Divider & Surface Effects** | `@material/web/divider/divider.js`, `ripple/ripple.js`, `elevation/elevation.js`, `focus/md-focus-ring.js` | `md-divider`, `md-ripple`, `md-elevation`, `md-focus-ring` | Stable. Essential building blocks for custom light-DOM gap components (cards, nav items, clickable rows) so every custom wrapper gets authentic MD3 ripple/elevation/focus rings. |
| **Navigation Bar (GAP)** | Custom React + CSS (`md-nav-bar`) | `<nav aria-label="Primary">` + React Router `<NavLink>` items + `<md-ripple>` + `<md-icon>` | Absent from stable (labs `md-navigation-bar` misuses `role="tablist"`). Match MD3 v0.192 spec tokens (`@material/web/tokens/versions/v0_192/_md-comp-navigation-bar.scss`): `surface-container` bg, `80px` height + `env(safe-area-inset-bottom)`, `secondary-container` active pill (`64px × 32px`, `corner-full`), `'FILL' 1` icon when `aria-current="page"`. |
| **Navigation Rail (GAP)** | Custom React + CSS (`md-nav-rail`) | `<nav aria-label="Primary">` + React Router `<NavLink>` items + `<md-ripple>` + `<md-fab>` | Absent from `@material/web` (even `labs/`). Desktop/tablet (`>= 768px`) rail matching `@material/web/tokens/versions/v0_192/_md-comp-navigation-rail.scss`: `80px` width, `56px × 32px` active pill, `'FILL' 1` icon, optional top FAB slot. |
| **Top App Bar (GAP)** | Custom React + CSS (`md-top-app-bar`) | `<header>` + `title-large` + `<md-icon-button>` actions | Absent from `@material/web`. Match `_md-comp-top-app-bar-small.scss`: `64px` height, `surface` bg transitioning to `surface-container` on scroll (`on-scroll` state), sticky top + safe-area inset. |
| **Bottom Sheet / Side Sheet (GAP)** | Custom React + CSS (`md-sheet`) | Native top-layer `<dialog>` via `showModal()`/`close()` | Absent from `@material/web`. Native `<dialog>` provides top-layer stacking, `Escape` dismissal, backdrop (`--md-sys-color-scrim`), and focus trapping without Radix. Style with `--md-sys-color-surface-container-low`, `corner-extra-large-top` (`28px 28px 0 0`) + drag handle (`32px × 4px`) on mobile (`bottom-sheet`), `corner-large-start` (`16px 0 0 16px`, `400px` max width) on desktop (`side-sheet`), respecting `prefers-reduced-motion`. |
| **Card (GAP)** | Custom React + CSS (`md-card`) | `<section>` / `<div>` / interactive `<button>` / `<Link>` + optional `<md-elevation>` + `<md-ripple>` | Stable missing (`labs/card` only). Implement 3 MD3 card variants via CSS classes using `--md-sys-shape-corner-medium` (`12px`): Elevated (`surface-container-low` + `--md-sys-elevation-level1`), Filled (`surface-container-highest`), Outlined (`surface` + `1px solid outline-variant`). |
| **Snackbar / Toast (GAP)** | Custom React + CSS (`md-snackbar`) | `<div role="status" aria-live="polite">` (`role="alert"` for errors) | Absent from `@material/web`. Match `_md-comp-snackbar.scss`: `--md-sys-color-inverse-surface` container, `--md-sys-color-inverse-on-surface` text, `--md-sys-color-inverse-primary` action button (`md-text-button`), `--md-sys-shape-corner-extra-small` (`4px`), `--md-sys-elevation-level3`, `48px` single-line min height, positioned above mobile Navigation Bar. |
| **Segmented Control (GAP)** | Custom React + CSS (`md-segmented-group`) | `<div role="group">` + semantic `<button aria-pressed>` + `<md-ripple>` | Avoids `labs/segmentedbutton`. Use `--md-sys-color-outline`, `--md-sys-color-secondary-container` active fill, `40px` height, `corner-full` outer corners. |
| **Badge (GAP)** | Custom CSS (`md-badge`) | Pure CSS dot (`6px`) or pill (`16px` height, `--md-sys-color-error`, `--md-sys-color-on-error`) | No custom element needed for simple notification dots or item counts (e.g., offline queue count / due counts). |

---

## React 19 + TypeScript 6 Integration (`@lit/react` Pattern)

### Why `@lit/react@1.0.8` over Native React 19 Custom Elements
Although React 19.3 supports custom element properties and lowercase event listeners natively, empirical testing against Hestia's codebase caught two critical integration issues with raw custom element JSX:
1. **Case-sensitive custom events:** React 19 passes `onClose` on custom elements as listener `'Close'` (capital `C`) rather than `'close'` — requiring un-idiomatic `onclose`, `onclosed`, `oncancel` props. `@lit/react` `createComponent({ events: { onClose: 'close', onClosed: 'closed', onCancel: 'cancel' } })` preserves standard React camelCase event props cleanly.
2. **TypeScript 6 JSX surface:** `@lit/react` derives React component prop types directly from each `@material/web` class `.d.ts` without maintaining `declare module "react" { namespace JSX { ... } }` augmentation blocks (`namespace` would also conflict with `erasableSyntaxOnly: true` if ever authored carelessly inside local TS files!).

### Solving `exactOptionalPropertyTypes: true` (`TS2375`)
Hestia's `tsconfig.base.json` sets `"strict": true`, `"exactOptionalPropertyTypes": true`, `"verbatimModuleSyntax": true`, and `"erasableSyntaxOnly": true`.

Empirically verified with `tsc@6.0.3`:
- `@material/web` class properties are declared non-nullable (e.g. `errorText: string`), so `@lit/react`'s `Partial<Omit<I, keyof HTMLElement>>` types `errorText?: string` (without `| undefined`).
- Passing `errorText={error}` directly where `error: string | undefined` fails compilation with **`TS2375`**.

**Solution:** Keep `@lit/react` definitions centralized inside thin Hestia UI wrapper components (`apps/web/src/components/ui/`), rather than calling raw `Md*` components directly across feature pages. Inside the thin wrapper, normalize optional props once (either stripping `undefined` keys via a tiny helper or typing a widened wrapper `ExactOptionalProps<T>` cast at the boundary) while exposing ergonomic `prop?: T | undefined` props to all pages:

```ts
// Example central helper in apps/web/src/components/ui/lit-helpers.ts
export type UndefinedProps<T> = { [K in keyof T]: T[K] | undefined };

export function definedProps<T extends Record<string, unknown>>(
  props: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as { [K in keyof T]?: Exclude<T[K], undefined> };
}
```

- `verbatimModuleSyntax: true` + `erasableSyntaxOnly: true`: Verified `tsc exit=0` with `import { createComponent, type EventName } from '@lit/react'` and `'input' as EventName<InputEvent>` (type-only `as` assertions are erasable; no `enum` or runtime `namespace` syntax used).
- `eslint.config.js` (`explicit-module-boundary-types: 'error'` + `jsx-a11y/strict`): Exported React wrapper components MUST carry explicit return types (`: React.JSX.Element` or `: React.ReactElement`), and custom light-DOM gap wrappers (`NavBar`, `NavRail`, `TopAppBar`, `Card`, `Sheet`, `Snackbar`, `SegmentedControl`) MUST use semantic HTML (`<nav>`, `<header>`, `<button>`, `<a>`/`<NavLink>`, `<dialog>`, `<output>`/`role="status"`) rather than interactive `<div>`s so `jsx-a11y/strict` passes without ESLint disable suppressions.

---

## Material Symbols Bundling, CSP, & PWA Precaching

### Caddy CSP & Offline PWA Constraints
- `docker/Caddyfile:14` defines:
  `Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.flipp.com ...; connect-src 'self' wss://{$HESTIA_HOST} ...; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"`
- There is **no `font-src` directive**, so browsers enforce **`default-src 'self'`**. Any external CDN (`fonts.googleapis.com` / `fonts.gstatic.com`) is blocked by Caddy CSP in production/E2E (`20-ingress-client-ip-and-csp.spec.ts`) and breaks offline PWA usage.
- `apps/web/vite.config.ts:91-93` configures Workbox `injectManifest.globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,wasm}']` — **currently missing `woff2`!**

### Material Symbols Packaging Comparison (Empirically Verified)

| Option | WOFF2 Payload | Variable Axes (`fvar`) | `font-family` & `font-display` | Workbox Default 2 MiB Limit | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`@material-symbols/font-400@0.48.3`** (`outlined.css`) | **`482.4 KiB`** (`493,972` B) | `FILL: 0..1` (fixed `wght=400`, `GRAD=0`, `opsz=48`) | `"Material Symbols Outlined"`, `font-display: block` | **Pass** (< 25% of 2 MiB cap) | **RECOMMENDED** — zero config match with `<md-icon>`, variable `FILL` for active nav icons, smallest WOFF2, no ligature FOUT flash. |
| `@fontsource-variable/material-symbols-outlined@5.3.9` (`fill.css`) | `1,111.7 KiB` (`1,138,408` B) | `FILL: 0..1`, `wght: 100..700` | `'Material Symbols Outlined Variable'`, `font-display: swap` | Pass (54% of 2 MiB cap) | Avoid — 2.3× larger font file, requires `--md-icon-font` override on `:root`, and `swap` briefly flashes raw ligature strings (e.g. `shopping_cart`). |
| `@fontsource-variable/.../wght.css` | `738.7 KiB` (`756,400` B) | `wght: 100..700` (**no `FILL` axis**) | `'Material Symbols Outlined Variable'`, `font-display: swap` | Pass | Reject — lacks `FILL` axis needed for MD3 active navigation icons. |
| `material-symbols@0.48.3` / `@fontsource-variable/.../full.css` | `~3.82–3.83 MiB` (`4,001–4,012 KB`) | `FILL`, `wght`, `GRAD`, `opsz` | `"Material Symbols Outlined"` / Variable | **FAIL** (> 2 MiB `maximumFileSizeToCacheInBytes`) | Reject — exceeds Workbox default precache file cap and wastes ~3.8 MB offline cache. |
| `@material-symbols/svg-400@0.48.3` / inline SVG registry | N/A (manual ~49 SVGs ≈ 20–30 KB JS) | None (separate `-fill` SVGs) | Inline `<svg>` inside `<md-icon>` | N/A (counts against JS bundle) | Viable fallback only if future budgets tighten; increases JS bundle size and maintenance across 62 files. |
| Google Fonts `<link>` | N/A | N/A | N/A | No offline guarantee | **REJECT** — blocked by Caddy `default-src 'self'` CSP (`docker/Caddyfile:14`). |

### Required VitePWA & Entry Import Changes
1. Import `@material-symbols/font-400/outlined.css` (side-effect import) in `apps/web/src/main.tsx` (NOT `@import` in `src/index.css`) so Vite emits the single `.woff2` asset cleanly **and** Knip detects `@material-symbols/font-400` usage in the TypeScript module graph without `ignoreDependencies`.
2. Update `apps/web/vite.config.ts` `injectManifest.globPatterns` to include `woff2`:
   ```ts
   globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,wasm,woff2}']
   ```
3. **200 KB Shell Budget Impact (`apps/web/scripts/check-build.mjs:19,59`):**
   - `check-build.mjs` budgets `SHELL_BUDGET_BYTES = 200 * 1024` across `index.html` preloaded `.js` and `.css` files (`dist` baseline is `199.4 KB` gz).
   - Because `.woff2` is loaded via `@font-face` in CSS (not linked/modulepreloaded in `index.html`), the precached `482.4 KiB` font adds **0 bytes** to `SHELL_BUDGET_BYTES`.
   - Measured with `esbuild@0.28.2` (`minify: true`, `target: 'es2024'`, `react`/`react-dom` external):
     - Removing `radix-ui` (7 primitives = `32.49–33.87 KB` gz per group) + `lucide-react` (`5.91 KB` gz) + Tailwind CSS (`8.6 KB` gz `index.css` baseline) reclaims **~36–40 KB gz** across the shell & UI chunks.
     - Shell-eager `@material/web` subpaths (`icon`, `icon-button`, buttons, `ripple`, `focus-ring`, `elevation`) total **`73.75 KB` min / `17.18 KB` gz** (including `lit` core `6.04 KB` gz + `@lit/react` `0.77 KB` gz) — fitting cleanly inside the `200 KB` shell budget with ~15–20 KB headroom!
     - **Critical chunking rule:** Keep heavy form/overlay controls (`outlined-text-field`, `outlined-select`, `select-option`, `checkbox`, `switch`, `radio`, `tabs`, `chips`) inside lazy route/sheet modules rather than static shell imports, because bundling ALL app `@material/web` controls eagerly into the shell chunk weighs **`325.41 KB` min / `62.82 KB` gz** (and `@material/web/all.js` weighs **`460.24 KB` min / `78.89 KB` gz**), which would breach `SHELL_BUDGET_BYTES`.

---

## MD3 Token Generation & CSS Architecture

### Build-Time Palette Generation with `@material/material-color-utilities@0.4.0`
- **Important Node.js ESM Caveat:** In `@material/material-color-utilities@0.4.0`, `dynamiccolor/color_spec_2025.js:21` contains an extensionless relative import (`'./dynamic_color'`) inside `"type": "module"`, which throws `ERR_MODULE_NOT_FOUND` under raw `node script.mjs` in Node 24. Execute any generator script via `esbuild` (bundled on the fly using Vite's existing `esbuild`) or inside Vitest (`vite`-resolved).
- **Avoid deprecated APIs:** `themeFromSourceColor()` (`Scheme`) in `@material/material-color-utilities` is deprecated and lacks MD3 v0.192 tonal surface roles (`surfaceDim`, `surfaceBright`, `surfaceContainerLowest..Highest`). Use:
  - `Hct.fromInt(argbFromHex(SEED_HEX))` (warm terracotta/amber seed, e.g., `#B85432`–`#C85A32` verified in light & dark modes)
  - `new SchemeTonalSpot(sourceHct, isDark, 0.0, '2021')` (or `'2025'` M3 Expressive spec — both verified in `0.4.0`)
  - `const mdc = new MaterialDynamicColors()` — **instance methods** (`mdc.primary()`, `mdc.surfaceContainerHigh()`, etc.; static properties on `MaterialDynamicColors` are `@deprecated` in `0.4.0`).
- **All 49 `--md-sys-color-*` Tokens:** Generate static light (`:root`) and dark (`:root[data-theme='dark']` / `@media (prefers-color-scheme: dark)`) CSS custom properties matching the exact 49 token names consumed by `@material/web@2.5.0/tokens/_md-sys-color.scss` (`primary`, `on-primary`, `primary-container`, `on-primary-container`, `secondary`, ..., `surface-dim`, `surface`, `surface-bright`, `surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `surface-container-highest`, `on-surface`, `on-surface-variant`, `outline`, `outline-variant`, `error`, `on-error`, `error-container`, `on-error-container`, `inverse-*`, `*-fixed*`, `scrim`, `shadow`, `surface-tint`, `background`, `on-background`).
- **Keep Domain Semantic & Section Accent Tokens:** Map Hestia's existing section accents (`apps/web/src/lib/sections.ts` + `[data-section=*]` overrides for `groceries`, `pantry`, `meals`, `planner`, `chores`, `maintenance`, `bills`) and `tokens.test.ts` WCAG AA contrast checks (`>= 4.5:1` text, `>= 3:1` UI/icons) cleanly onto `--md-sys-color-*` and section `--md-sys-color-primary` / `primary-container` overrides as needed.

### Typography, Shape, Elevation, & PWA Chrome
- Import `@material/web/typography/md-typescale-styles.css` in `main.tsx` (sets all 15 `.md-typescale-*` utility classes inside an anonymous `@layer{...}`).
- Define `--md-ref-typeface-brand` and `--md-ref-typeface-plain` in `src/index.css` using a clean self-hosted/system humanist sans-serif stack (CSP forbids Google Fonts external CSS; e.g., `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` — zero font network requests, zero FOIT).
- Set `color-scheme: light dark` and MD3 shape/motion/elevation helper variables (`--md-sys-shape-corner-*` from `4px` `extra-small` up to `9999px` `full`, and `--md-sys-elevation-level1..3` box shadows) in `src/index.css`.
- Update `apps/web/index.html:10` (`<meta name="theme-color">`) using `media="(prefers-color-scheme: light)"` and `media="(prefers-color-scheme: dark)"` aligned to MD3 `surface` / `surface-container` hex values, plus `apps/web/vite.config.ts:80-81` PWA `manifest.theme_color` / `background_color` (replacing `#475569` slate).

---

## Vite, Testing (Vitest/jsdom + Playwright/Axe), & Repo Quality Gates

### 1. Vite Configuration (`apps/web/vite.config.ts`)
- Remove `@tailwindcss/vite` import and plugin registration.
- Add `woff2` to `VitePWA.injectManifest.globPatterns`.
- Update `manifest.theme_color` and `manifest.background_color` from `#475569` / `#FFFFFF` to Hestia's MD3 light/warm surface colors.
- Keep `localZbarWasmPlugin`, `strategies: 'injectManifest'`, and Vitest `environment: 'jsdom'` + coverage thresholds (`84/80/77/85`) intact.

### 2. Vitest + `jsdom@30.1.0` + `@testing-library/react@16.3.3` (`apps/web/src/test-setup.ts`)
Verified empirically by running 14 `@material/web@2.5.0` elements inside `jsdom@30.1.0` + React `19.3.0`:

| Missing JSDOM 30.1.0 API | Failure Observed Without Polyfill | Required `test-setup.ts` Fix |
| :--- | :--- | :--- |
| `window.matchMedia` | Crashes **at module import time** in `ripple.js` for 12 components (`button`, `iconbutton`, `checkbox`, `switch`, `radio`, `select-option`, `menu-item`, `tabs`, `chips`, `list-item`) | Stub `window.matchMedia` returning `{ matches: false, media, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => false) }`. |
| `ElementInternals` (`setFormValue`, `setValidity`, `states`) | `TypeError: this[internals].setFormValue is not a function` on `md-outlined-text-field`, `md-outlined-select` | Import `forceElementInternalsPolyfill` & `forceCustomStateSetPolyfill` from `'element-internals-polyfill'` and call both at setup startup. |
| `element-internals-polyfill@3.0.2` vs `md-radio` | `DOMException: The second argument should not be empty if one or more flags in the first argument are true` when instantiating `<md-radio>` (`RadioValidator` leaves 8 flags `undefined`, which `element-internals-polyfill`'s `ValidityState.js:60` checks with `!== false`) | Wrap `ElementInternals.prototype.setValidity` (obtained via a temporary probe CE once in `test-setup.ts`) normalizing each flag value with `Boolean(v)` before calling original `setValidity`. |
| `IntersectionObserver` | `ReferenceError: IntersectionObserver is not defined` in `md-dialog` & `md-menu` | Stub minimal no-op `IntersectionObserver` class on `globalThis`. |
| `HTMLDialogElement.prototype.showModal` / `show` / `close` | `TypeError: dialog.showModal is not a function` in `md-dialog` & custom MD3 Sheet | Polyfill `.showModal`, `.show`, and `.close` toggling `this.open`, setting `this.returnValue`, and dispatching `new Event('close')`. |
| `Element.prototype.animate` & `getAnimations` | WAAPI missing in jsdom (`ripple.js`, `field.js`, `dialog.js`, `menu.js`) | Stub `Element.prototype.animate` returning `{ finished: Promise.resolve(), cancel() {}, finish() {}, pause() {}, play() {}, reverse() {}, addEventListener() {}, removeEventListener() {} }` and `Element.prototype.getAnimations = () => []`. |

> **Vitest 5 `AbortSignal` note:** Confirmed in `vitest@5.0.1` (`dist/chunks/index.D4dXTzh9.js:1372`) that Vitest calls `patchAddEventListener(dom.window)` and `populateGlobal`, preventing Node vs JSDOM `AbortSignal` WebIDL mismatch on `@material/web`'s `dispatch-hooks.js`.

### 3. Testing Library Shadow DOM Queries & Playwright / Axe E2E
- **Vitest / Testing Library (`@testing-library/react@16.3.3`):**
  - Standard `screen.getByRole(...)` and `screen.getByLabelText(...)` **do NOT pierce Shadow DOM** and return `null` for `<md-filled-button>`, `<md-outlined-text-field>`, `<md-checkbox>`, `<md-switch>`, `<md-outlined-select>`, and `<md-dialog>`!
  - **Empirically verified pattern:** `within(hostEl.shadowRoot).getByRole('button', { name: 'Save' })` / `within(tfEl.shadowRoot).getByRole('textbox')` / `within(dlgEl.shadowRoot).getByRole('dialog')` **DO work** in `@testing-library/react@16.3.3` (even resolving Light DOM `<slot>` accessible names!). Export tiny `getShadowControl(host)` / `clickShadowButton` / `fillShadowField` helpers in `apps/web/src/test/` for unit/integration specs.
  - Also note: in jsdom (which lacks `ShadowRoot.prototype.adoptedStyleSheets`), Lit injects component `<style>` blocks into `shadowRoot`, so assert on semantic `role`/`value`/`aria-invalid` or Light DOM slotted text rather than `shadowRoot.textContent`.
- **Playwright + `@axe-core/playwright` (`e2e/`):**
  - Playwright locators (`page.getByRole(...)`) and `@axe-core/playwright` **automatically pierce open Shadow DOM** (which all `@material/web` components use), so most E2E `getByRole('button'|'dialog'|'checkbox'|'switch'|'combobox')` locators continue functioning seamlessly.
  - **Watch out for `aria-invalid` assertions (`e2e/tests/17-accessibility-states.spec.ts`):** When `<md-outlined-text-field error>` is invalid, `aria-invalid="true"` is placed on the **inner shadow `<input>`**, NOT on the `<md-outlined-text-field>` host element (in jsdom, `element-internals-polyfill` even leaves `aria-invalid="false"` on the host!). Check `locator('md-outlined-text-field').getByRole('textbox')` (pierces shadow root) rather than asserting `aria-invalid` on the outer host wrapper.
  - **Animation settling (`e2e/support/axe.ts`):** Existing `settleAnimations(page)` waits on `document.getAnimations()` non-infinite animations — keep MD3 transitions finite (and respect `prefers-reduced-motion: reduce`), and avoid infinite progress spinners in static Axe contrast/state audit views unless ignored intentionally.

### 4. Knip, JSCPD, `audit-prod`, & Repo Hygiene
- **Knip (`knip@6.41.0`):** Remove `"tailwindcss"` from `knip.json:6` `ignoreDependencies`. Wire any token-generator script (`apps/web/scripts/generate-md3-tokens.mjs`) into `apps/web/package.json` `"scripts"` (e.g., `"tokens:generate"`) so Knip traces `@material/material-color-utilities` and the script without adding ignore rules. Importing `@material-symbols/font-400/outlined.css` inside `src/main.tsx` makes it naturally reachable by Knip.
- **JSCPD (`jscpd@5.4.1`):** With Radix/Tailwind prop-class repetition gone, enforce shared helpers in `apps/web/src/components/ui/` (e.g., `lit-helpers.ts`, unified field/sheet/nav styling classes) so duplicate JSX/CSS blocks don't trip `.jscpd.json`.
- **Prod Audit (`scripts/audit-prod.mjs`):** Adding `@material/web@2.5.0`, `@lit/react@1.0.8`, and `@material-symbols/font-400@0.48.3` brings only `@lit/context`, `lit`, and `tslib` into `--prod` dependencies — clean and auditable via `pnpm audit --prod`.

---

## Alternatives Considered (and Rejected)

| Category | Recommended | Rejected Alternative | Reason for Rejection |
| :--- | :--- | :--- | :--- |
| **Component Library** | `@material/web@2.5.0` (stable subpaths) + light-DOM gap wrappers | MUI (`@mui/material`) + Emotion | Explicitly out of scope for Google Material Design 3 Web goal; adds Emotion CSS-in-JS runtime (~35+ KB gz) and breaks vanilla MD3 custom property / web component architecture. |
| **Component Library** | `@material/web` stable subpaths only | `@material/web/labs/*` (`labs/navigationbar`, `labs/card`, `labs/segmentedbutton`) | Marked experimental/unstable by Google; `labs/navigationbar` misuses `role="tablist"` instead of `<nav>` + `<NavLink>`; `labs/card` adds shadow-root friction over 4 lines of CSS. |
| **React Integration** | `@lit/react@1.0.8` (`createComponent`) inside `components/ui/*` | Raw custom elements directly in JSX across all pages | React 19 native JSX mishandles camelCase custom event names (`onClose` listens for `'Close'`, not `'close'`) and requires manual `JSX.IntrinsicElements` definitions. `@lit/react` fixes both for `0.77 KB` gz. |
| **Icons** | `@material-symbols/font-400@0.48.3` (`outlined.css`) | `@fontsource-variable/material-symbols-outlined@5.3.9` (`fill.css`) or `material-symbols@0.48.3` | `material-symbols` WOFF2 is `3.83 MiB` (exceeds Workbox's 2 MiB limit); `@fontsource-variable/fill.css` is 2.3× larger (`1.09 MiB`), uses `font-display: swap` (FOUT ligature text), and changes `font-family` away from `<md-icon>` default. |
| **Icons** | `@material-symbols/font-400@0.48.3` | Google Fonts `<link>` CDN | Blocked by `docker/Caddyfile:14` strict CSP (`default-src 'self'`, no `font-src`) and fails offline PWA precaching. |
| **Color Tokens** | Build-time `@material/material-color-utilities@0.4.0` -> static CSS | Runtime token calculation on app startup | Wastes shell JS budget (`200 KB` max) for a fixed terracotta seed palette; static CSS lets `tokens.test.ts` validate WCAG AA contrast deterministically at test time. |
| **CSS System** | Plain CSS + `--md-sys-*` tokens + `@material/web/typography/md-typescale-styles.css` | Keeping Tailwind CSS v4 utilities alongside `@material/web` | Two competing design systems; MD3 shadow-DOM CSS custom properties + standard CSS classes remove Tailwind's `8.6 KB` gz stylesheet and build plugin completely. |

---

## Installation & Configuration Checklist (For Planning/Execution)

1. **Swap dependencies in `apps/web`:**
   ```bash
   pnpm --filter @hestia/web remove tailwindcss @tailwindcss/vite radix-ui lucide-react
   pnpm --filter @hestia/web add @material/web@2.5.0 @lit/react@1.0.8 @material-symbols/font-400@0.48.3
   pnpm --filter @hestia/web add -D @material/material-color-utilities@0.4.0 element-internals-polyfill@3.0.2
   ```
2. **Update build & tooling configs:**
   - `apps/web/vite.config.ts`: drop `@tailwindcss/vite`, add `woff2` to `injectManifest.globPatterns`, update PWA `manifest.theme_color` / `background_color`.
   - `apps/web/index.html`: replace `#475569` `theme-color` meta tag with light/dark MD3 surface hex values.
   - `knip.json`: remove `"tailwindcss"` from `ignoreDependencies`.
   - `apps/web/src/main.tsx`: import `@material-symbols/font-400/outlined.css` and `@material/web/typography/md-typescale-styles.css`.
   - `apps/web/src/test-setup.ts`: add `window.matchMedia`, `IntersectionObserver`, `ElementInternals` polyfill (+ `setValidity` boolean normalization), `HTMLDialogElement.prototype.{showModal,show,close}`, and `Element.prototype.{animate,getAnimations}`.

---

## Sources & Verification Log
- **npm Registry & Unpacked Tarballs (inspected `2026-11-11`):**
  - `@material/web@2.5.0`, `@lit/react@1.0.8`, `@material/material-color-utilities@0.4.0`, `@material-symbols/font-400@0.48.3`, `@fontsource-variable/material-symbols-outlined@5.3.9`, `material-symbols@0.48.3`, `@material-symbols/svg-400@0.48.3`, `element-internals-polyfill@3.0.2`, `lit@3.3.3`
- **Repository Toolchain Verification:**
  - `esbuild@0.28.2` minified + gzipped chunk measurements on `@material/web@2.5.0`, `@lit/react@1.0.8`, `radix-ui@1.6.7`, and `lucide-react@1.47.0`
  - WOFF2 SFNT `fvar` binary table inspection confirming `FILL:0..1` axis on `@material-symbols/font-400@0.48.3`
  - `typescript@6.0.3` compilation checks under repo `tsconfig.base.json` (`strict`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`)
  - Live `jsdom@30.1.0` + `react@19.3.0` + `@testing-library/react@16.3.3` + `vitest@5.0.1` environment verification across 14 `@material/web` custom elements
- **Repo Constraints Checked:** `docker/Caddyfile`, `apps/web/vite.config.ts`, `apps/web/scripts/check-build.mjs`, `eslint.config.js`, `knip.json`, `.jscpd.json`, `scripts/audit-prod.mjs`, `scripts/check-repo-hygiene.mjs`, `e2e/support/axe.ts`, `e2e/tests/17-accessibility-states.spec.ts`
