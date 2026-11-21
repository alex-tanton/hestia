# Phase 17: MD3 Foundation, Token Pipeline & UI Primitives - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the static Warm Terracotta Material Design 3 design token pipeline (`FND-01`), typed `@material/web@2.5.0` React 19 `@lit/react@1.0.8` adapters inside `components/md/` → `components/ui/` with ESLint enforcement (`FND-02`), the locked Material Symbols `Icon.tsx` contract (`FND-03`), and light-DOM / native-`<dialog>` gap primitives (`FND-04`), while keeping Tailwind CSS, Radix UI, and Lucide coexisting behind `components/ui/` until Phase 21 (`FND-05`) so unit and sequential E2E suites remain verifiable at every step.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Phase Specifications
- `.planning/PROJECT.md` — Milestone v3.0 goal, constraints, and tech stack boundaries
- `.planning/REQUIREMENTS.md` — `FND-01`, `FND-02`, `FND-03`, `FND-04` acceptance requirements and `Out of Scope` constraints
- `.planning/ROADMAP.md` — Phase 17 goal, dependencies, and success criteria
- `.planning/STATE.md` — Locked Phase 17 decisions and deferred `FND-05` Phase 21 cleanup boundary

### Architecture & Material Web Research
- `.planning/research/SUMMARY.md` — Synthesized stack weights, trade-offs, and pitfalls
- `.planning/research/STACK.md` — Measured `@material/web@2.5.0` subpath weights, `@lit/react@1.0.8`, `@material/material-color-utilities@0.4.0`, `@material-symbols/svg-400@0.48.3`, and `jsdom@30.1.0` probes
- `.planning/research/ARCHITECTURE.md` — `components/md/` → `components/ui/` interop layer, build-time `generate-tokens.mjs`, and light-DOM gap primitive patterns
- `.planning/research/PITFALLS.md` — `jsdom` `attachInternals` pitfalls, `useFieldErrors` Shadow DOM focus pitfall, `md-switch`/`md-dialog`/`soft-disabled` traps, and CI ratchet constraints

### Existing Codebase Contracts & CI Gates
- `apps/web/src/index.css` — Current Tailwind v4 design tokens and `@media (prefers-color-scheme: dark)` structure
- `apps/web/src/tokens.test.ts` — Existing WCAG AA token contrast test pattern read from disk
- `apps/web/src/test-setup.ts` — Current Vitest `jsdom` polyfills and cleanup setup
- `apps/web/src/lib/use-field-errors.ts` — Form error focus management (`querySelector('[aria-invalid="true"]')?.focus()`)
- `apps/web/src/components/ui/Select.tsx` — Existing `(pointer: coarse)` native `<select>` fallback pattern
- `apps/web/src/components/ui/Toast.tsx` — Existing `ToastProvider` / `useToast` / `toastDuration` API
- `apps/web/src/components/ui/Sheet.tsx` — Existing `SheetProps` contract (`open`, `onOpenChange`, `title`, `description`, `trigger`)
- `apps/web/src/components/ui/Field.tsx` — Existing `TextField` / `TextAreaField` / `FieldFrame` error, hint, and `disabledReason` contract
- `apps/web/src/components/ui/Button.tsx` — Existing `ButtonVariant`, `isIconOnly`, `isLoading`, and focusable `disabledReason` contract
- `apps/web/src/components/ui/Checkbox.tsx` — Existing `variant="in-list"` full-row tap target contract
- `apps/web/src/components/ui/primitives.test.tsx` & `apps/web/src/components/ui/Toast.test.tsx` — Existing primitive unit test coverage
- `apps/web/index.html` & `apps/web/vite.config.ts` — `THEME_COLOR`, PWA manifest, Workbox `injectManifest`, and Vitest coverage thresholds (`84/80/77/85`)
- `apps/web/scripts/check-build.mjs` — `200 KB` gzipped shell budget, `MAGIC_LINK_COPY`, and external host checks
- `docker/Caddyfile` — Strict `'self'` CSP (`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'`)
- `eslint.config.js` & `tsconfig.base.json` — Strict TS6 (`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`) and ESLint (`jsx-a11y.flatConfigs.strict`, `explicit-module-boundary-types`) rules
- `scripts/check-repo-hygiene.mjs` — LF line endings and legacy term checks across git index

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/lib/use-field-errors.ts` (`useFieldErrors`): Relies on `formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()`. Since `<md-outlined-text-field>` places `aria-invalid` inside Shadow DOM, UI wrappers must mirror `aria-invalid={isInvalid || undefined}` on the host element (or wrapper) and delegate `focus()`.
- `apps/web/src/lib/use-delayed-visible.ts`: Used by `SkeletonRows` to delay visual skeletons by `200ms` while announcing `role="status"` immediately; reusable as-is in the MD3 `Skeleton` primitive.
- `apps/web/src/components/ui/Select.tsx`: Already encapsulates `(pointer: coarse)` detection via `useSyncExternalStore` + `window.matchMedia('(pointer: coarse)')`.

### Established Patterns
- Strict TypeScript (`exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`) requires `prop?: T | undefined` on optional props and explicit return types on all exported functions (`@typescript-eslint/explicit-module-boundary-types`).
- Named exports only across web components (`export function Button`), ESM relative imports with explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions: true`), and zero `console.*` in `apps/web/src/`.
- `tokens.test.ts` reads CSS files from disk via `node:fs` because Vitest stubs CSS imports to empty strings.
- Tailwind v4 `@theme` / `@theme inline` in `apps/web/src/index.css` remains live alongside `--md-sys-*` CSS files until Phase 21 (`FND-05`) removes Tailwind and Radix/Lucide dependencies.

### Integration Points
- `apps/web/src/main.tsx` and `apps/web/src/index.css`: Import generated MD3 token/surface/typescale CSS while preserving Tailwind CSS for unmigrated screens.
- `apps/web/vite.config.ts` and `apps/web/index.html`: Update `THEME_COLOR` (`#475569`) and configure Vitest projects / polyfill setup without lowering `84/80/77/85` coverage thresholds.
- `eslint.config.js`: Add `no-restricted-imports` preventing direct `@material/web/*` imports outside `apps/web/src/components/md/`, plus `settings['jsx-a11y'].components` mappings for wrapped UI controls.

</code_context>

<specifics>
## Specific Ideas

- **Terracotta tone:** Earthy terracotta clay (`~#B4532A`) with creamy `surfaceContainer*` elevation tints in light mode and balanced warm charcoal containers in dark mode.
- **Iconography:** `@material-symbols/svg-400/rounded` inline SVGs in one central `Icon.tsx` registry (`filled?: boolean` for active nav/favorites/toggles), avoiding both WOFF2 offline cache weight and ligature `textContent` leaks.
- **Snackbar UX:** Single active snackbar with sequential FIFO queue; `Undo` and `Error` stay visible until acted upon or closed via `×`.
- **Theme flexibility:** Support both OS `prefers-color-scheme` and `[data-theme="light"|"dark"]` on `<html>` purely in CSS so Playwright light/dark audits and potential future theme selection require zero inline scripts.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-md3-foundation-token-pipeline-ui-primitives*
*Context gathered: 2026-11-11*

