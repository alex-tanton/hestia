# Pitfalls Research: Material Design 3 Overhaul (`apps/web`)

**Domain:** Migrating React 19.3 + Vite 8.3 PWA + Vitest/jsdom + Playwright/axe-core + Knip/JSCPD/ESLint (`@hestia/web`) from Tailwind CSS v4 + Radix UI + Lucide to `@material/web`, `@material/material-color-utilities`, Material Symbols, and custom MD3 wrappers
**Researched:** 2026-11-11
**Confidence:** HIGH (grounded in direct inspection of repo configs, test harnesses, CI gates, empirical `jsdom@30.1.0` probes in `apps/web`, and external Material/React 19/axe documentation)

> **Repo structure note:** Vitest configuration lives inside `apps/web/vite.config.ts` (there is no `apps/web/vitest.config.*`), and Caddy reverse-proxy/CSP configuration lives in `docker/Caddyfile` (there is no top-level `caddy/` directory).

---

## Critical Pitfalls

### Pitfall 1: `jsdom@30.1.0` Ships a Partial `attachInternals` That Bypasses Naive Polyfills

**What goes wrong:**
`@material/web` form controls (`<md-outlined-text-field>`, `<md-outlined-select>`, `<md-checkbox>`, `<md-switch>`, `<md-filled-button type="submit">`) depend on `HTMLElement.prototype.attachInternals()`, `Element.prototype.animate()`, `HTMLDialogElement.prototype.showModal()`, and `adoptedStyleSheets`. Empirical inspection of `jsdom@30.1.0` installed in `apps/web` confirms:

| Browser API | `jsdom@30.1.0` Reality | Impact on `@material/web` Tests |
|---|---|---|
| `HTMLElement.prototype.attachInternals` | `'function'` (partial stub!) | Naive `if (!HTMLElement.prototype.attachInternals)` polyfills skip patching, yet the returned `ElementInternals` lacks `setFormValue`, `setValidity`, `form` (`false`), and `states` / `CustomStateSet` (`false`) -> throws `TypeError` or silently drops form submission/validation |
| `Element.prototype.animate` | `undefined` | Crashes `<md-ripple>`, `<md-dialog>`, `<md-menu>`, and `<md-switch>` interactions |
| `HTMLDialogElement.prototype.showModal` | `undefined` | Crashes `<md-dialog>` (used for `ConfirmDialog`, `BarcodeScannerDialog`) on open |
| `adoptedStyleSheets` (Document & ShadowRoot) | `false` (`replaceSync` exists) | Style adoption paths in Lit/custom elements fail if assumed native |
| `'popover' in HTMLElement.prototype` | `false` | Popover-based menus/sheets/tooltips cannot rely on native Popover API without fallback |
| `window.matchMedia` | `undefined` (stubbed selectively via `stubCoarsePointer()` in `apps/web/src/test/browser.ts`) | Fails any MD3 responsive breakpoint or reduced-motion check not guarded by test setup |

**Why it happens:**
`apps/web/src/test-setup.ts` only mocks `virtual:pwa-register/react` and stubs `ResizeObserver`, `window.scrollTo`, `scrollIntoView`, `hasPointerCapture`, and `releasePointerCapture` for Radix UI. Standard polyfills like `element-internals-polyfill` often skip installation when `attachInternals` is already defined on `HTMLElement.prototype` in newer jsdom versions.

**How to avoid:**
1. Force-override `HTMLElement.prototype.attachInternals` unconditionally in `apps/web/src/test-setup.ts` (do **not** gate on `if (!('attachInternals' in HTMLElement.prototype))` — verify `setFormValue` and `states` exist or replace unconditionally with a spec-faithful `ElementInternals` shim supporting `setFormValue`, `setValidity`, `validity`, `validationMessage`, `checkValidity`, `reportValidity`, `form`, and `states`).
2. Stub `Element.prototype.animate` in `test-setup.ts` returning an `Animation`-compatible stub with `finished: Promise.resolve()`, `cancel()`, `play()`, and `playState: 'finished'`.
3. Stub `HTMLDialogElement.prototype.showModal`, `show`, and `close` (toggling `[open]` and dispatching `close`/`cancel` as needed) plus `adoptedStyleSheets` (`[]`) and default `window.matchMedia` (`matches: false`, matching `prefers-reduced-motion` / pointer queries safely without breaking `stubCoarsePointer()`).
4. Treat Vitest/jsdom as behavioral unit/integration testing through Hestia's React wrappers, and rely on Playwright against real Chromium (or `@vitest/browser` if added) for genuine Shadow DOM layout, animation, and top-layer `<dialog>` behavior.

**Warning signs:**
- `TypeError: this._internals.setFormValue is not a function` or `this._internals.setValidity is not a function` in `primitives.test.tsx`.
- `TypeError: element.animate is not a function` on click, hover, or focus-visible.
- `element-internals-polyfill` imported in `test-setup.ts`, yet form values/validity remain empty because jsdom already defined `attachInternals`.

**Phase to address:** `MD3-FOUNDATION` (first task before rendering any `@material/web` component in Vitest).

---

### Pitfall 2: Shadow DOM Blind Spots in `@testing-library/dom@10.4.2` & Brittle Selectors Across 63 Unit Tests + 24 E2E Specs

**What goes wrong:**
`@testing-library/dom@10.4.2`, `@testing-library/react`, `@testing-library/user-event@14.6.7`, and `@testing-library/jest-dom` **do not traverse Shadow DOM boundaries**. Rendering bare `<md-outlined-text-field>`, `<md-filled-button>`, or `<md-checkbox>` causes `screen.getByRole('textbox')`, `screen.getByLabelText(...)`, `expect(...).toBeInvalid()`, and `userEvent.type(...)` to miss the internal shadow `<input>`/`<button>` completely. Simultaneously, Hestia's 63 `apps/web/src` test files and 24 sequential single-worker Playwright E2E specs (`e2e/playwright.config.ts`) rely heavily on current Tailwind/Radix/Lucide artifacts:
- Tailwind classes asserted directly: `toHaveClass('shadow-sm' | 'text-section' | 'line-through')`, plus E2E locators in `e2e/tests/22-deals-pricing-display.spec.ts:54,59` querying `.line-through` and `.text-section`.
- Radix attributes and interactions: `data-state` (`Tabs` `scrollIntoView` queries `[data-state="active"]`), `role="radiogroup"` on `SubTabs`, and `openMenu` in `apps/web/src/test/browser.ts:68-73` opening `DropdownMenu` via `Enter` because Radix pointer clicks failed in jsdom.
- Lucide assumptions: `querySelector('svg')` assertions expecting Lucide inline SVGs fail if switched to ligature `<md-icon>` fonts.
- Ligature text leaks: `shell.test.tsx:66` and accessible-name assertions (`getByRole('tab', { name: 'Settings' })`) break if `<md-icon>settings</md-icon>` lacks `aria-hidden="true"`, causing `textContent` / accessible names to become `"settings Settings"`.

**Why it happens:**
Tests grew around Radix light-DOM portals and Tailwind utility classes, while standard Testing Library treats custom element shadow roots as opaque. Playwright locators (`getByRole`, `getByLabel`, `locator`) *do* pierce open Shadow DOM automatically, **except** where ARIA properties or DOM structures shift (e.g., `<md-switch>` binds `selected` rather than `checked` while exposing `role="switch"` + `aria-checked`, and `<md-outlined-text-field>` places `aria-invalid="true"` on the shadow `<input>` rather than the host element).

**How to avoid:**
1. Keep semantic React wrappers in `apps/web/src/components/ui/*` and `apps/web/src/components/shell/*` with explicit light-DOM accessible names, host attributes (`aria-invalid`, `data-active`, `aria-current`), or `shadow-dom-testing-library` helpers where shadow traversal is genuinely needed.
2. Wrap all Material Icons/Symbols in a dedicated `Icon` primitive that forces `aria-hidden="true"` (for font ligatures) or renders an `aria-hidden="true"` SVG symbol — never leak icon ligature text into `textContent` or accessible names.
3. Replace Tailwind utility assertions (`.line-through`, `.text-section`, `shadow-sm`) and Radix `[data-state]` selectors with semantic attributes (`data-checked="true"`, `aria-current`, `<del>` / `aria-label` or semantic classes) before deleting Tailwind.
4. Keep unit + E2E test updates coupled to each phase slice rather than deferring 87 test files to the final phase.

**Warning signs:**
- `TestingLibraryElementError: Unable to find an accessible element with the role "textbox"` when a field is visibly rendered.
- `shell.test.tsx` or E2E `getByRole('button', { name: ... })` failing with `"add Add item"` or `"settings Settings"`.
- `e2e/tests/22-deals-pricing-display.spec.ts` or `17-accessibility-states.spec.ts` failing on missing `.text-section`, `.line-through`, or `radiogroup` roles.

**Phase to address:** `MD3-FOUNDATION` (test helpers, `Icon`, UI primitives), `MD3-NAV-SHELL` (`shell.test.tsx`), `MD3-SCREENS` (domain tests & E2E locators), `MD3-VERIFY`.

---

### Pitfall 3: React 19 Custom Element Event Semantics, `md-dialog` State Desync, and Strict TS 6 / ESLint Checks

**What goes wrong:**
Even though React `19.3.0` passes properties cleanly to Custom Elements:
1. **`onChange` does NOT alias `input`:** On React's native `<input>`, `onChange` fires per keystroke; on `<md-outlined-text-field>`, `onChange` only listens to the DOM `change` event (fires on blur/commit!). Controlled text inputs MUST wire `onInput` for live state updates (while `<md-outlined-select>`, `<md-checkbox>`, and `<md-switch>` emit `change`/`input` on selection).
2. **Non-standard custom events & `<md-dialog>` lifecycle desync:** Lowercase/hyphenated custom events (`closed`, `closing`, `opened`, `opening`, `request-selection`) can drop or mis-bind unless wrapped with `@lit/react` `createComponent` or `useRef` + `addEventListener`. Worse, `<md-dialog>` opens/closes natively via `<dialog>.showModal()` / `Escape` / backdrop click: pressing `Escape` closes the underlying `<md-dialog>` while React's `open` prop stays `true`, and unmounting immediately on `close` cuts off closing animations or strands focus restoration.
3. **Different property names & soft-disabled behavior:** `<md-switch>` uses **`selected`** (not `checked`). And Hestia's offline-guard buttons (`apps/web/src/components/ui/Button.tsx:28-39`) keep disabled buttons focusable via `aria-disabled="true"` + `aria-describedby`; in `@material/web`, `<md-filled-button>`/`<md-outlined-button>` must use `soft-disabled` (not `disabled`) **plus** an early-return click guard in the React wrapper because `soft-disabled` elements remain clickable/focusable.
4. **Strict TypeScript 6 & ESLint `jsx-a11y` friction:** `tsconfig.base.json` sets `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `noPropertyAccessFromIndexSignature: true`, and `erasableSyntaxOnly: true` (banning TS `enum` and parameter properties), while `eslint.config.js` enforces `explicit-module-boundary-types: 'error'`, `no-non-null-assertion: 'error'`, and `jsxA11y.flatConfigs.strict`. Writing raw `<md-*>` tags inside 20+ screen files triggers missing `JSX.IntrinsicElements` errors, `jsx-a11y/label-has-associated-control` errors, and `exactOptionalPropertyTypes` conflicts (`string | undefined` vs omitted).

**Why it happens:**
`@material/web` exposes imperative Web Component classes and DOM events, whereas Hestia's codebase is built around declarative React props and strict static typing/linting.

**How to avoid:**
1. **Isolate ALL `@material/web` imports inside `apps/web/src/components/ui/*`** wrapped via `@lit/react` (`createComponent`) or a single shared custom-element ref/event hook — never scatter raw `<md-*>` tags directly through `screens/`.
2. Declare clean `JSX.IntrinsicElements` module augmentations in one central `md-elements.d.ts` file without `any` or non-null assertions, matching `exactOptionalPropertyTypes`.
3. In `Button`, handle `disabledReason` by mapping to `soft-disabled={Boolean(disabledReason)}` and guarding `onClick` so activation is blocked while focus and `aria-describedby` tooltip/help remain intact.
4. In `Dialog` / `ConfirmDialog`, synchronize React `open` state declaratively with `show()`/`close()` and listen to `closed` (not just `close`) before firing `onOpenChange(false)` / unmounting children.
5. Configure `eslint-plugin-jsx-a11y` `controlComponents` only if needed, or better: keep all control-label wiring inside the typed React wrappers (`Field`, `TextField`, `Select`, `Checkbox`, `Switch`).

**Warning signs:**
- Controlled text inputs appear frozen while typing until blur.
- Pressing `Escape` closes a confirmation dialog visually, then clicking the trigger fails to reopen it because React `open` stayed `true`.
- TS6 `exactOptionalPropertyTypes` or `eslint` `jsx-a11y/label-has-associated-control` errors flooding screen PRs.

**Phase to address:** `MD3-FOUNDATION` (all `@material/web` React adapters built before screen migration).

---

### Pitfall 4: Validation & Focus Failure (`useFieldErrors`), Missing Checkbox/Switch Labels, and Select Menu Clipping

**What goes wrong:**
1. **`useFieldErrors` stops focusing invalid inputs:** `apps/web/src/lib/use-field-errors.ts:20-23` executes `formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()`. Because `<md-outlined-text-field error errorText={...}>` renders `aria-invalid="true"` on the `<input>` **inside its Shadow DOM** and NOT on the host element, `querySelector('[aria-invalid="true"]')` returns `null`! Furthermore, `e2e/tests/17-accessibility-states.spec.ts:145,154` asserts `expect(page.getByLabel(...)).toHaveAttribute('aria-invalid', 'true')`, and `primitives.test.tsx:91` expects `role="alert"` error presentation.
2. **Broken `<label>` association on Checkbox/Switch (`b/294081528`):** `<md-checkbox>` and `<md-switch>` do NOT participate in native `<label>` wrapping or `<label for="...">` click/accessibility association. In `NotificationTypeRows.tsx:45-54` (which currently renders `<Checkbox role="switch" />`), `ItemSheet.tsx`, and `RotationEditor.tsx`, migrating blindly leaves switches/checkboxes unlabeled to screen readers (`axe` `label` violation).
3. **Select & Menu clipping inside Dialogs/Sheets:** `<md-outlined-select>` and `<md-menu>` render in normal flow/relative positioning by default; inside `<md-dialog>` or scrollable bottom sheets (`ItemSheet`, `BillForm`, `MealPlacementSheet`, `OverflowMenu`) with `overflow: auto/hidden`, dropdown menus get cut off unless `positioning="fixed"` (`fixed` prop) is enabled.
4. **Mobile Select / Date Input regressions:** `apps/web/src/components/ui/Select.tsx:26,60` intentionally checks `(pointer: coarse)` to render a native `<select>` on touch phones. Replacing it unconditionally with `<md-outlined-select>` breaks mobile wheel/sheet UX and alters `stubCoarsePointer()` behavior. Similarly, `BillForm.tsx:220` uses `type="date"` — `<md-outlined-text-field type="date">` inherits native picker styling quirks, and any text field whose computed font size drops below `16px` (`1rem`) triggers iOS Safari viewport zoom.

**Why it happens:**
Shadow DOM encapsulation isolates native `aria-invalid` and `<label>` linkage from external `querySelector` and `<label for>` APIs, while top-layer/overflow containers trap non-fixed menus.

**How to avoid:**
1. Make Hestia's `TextField` / `Select` wrappers forward/reflect `aria-invalid={Boolean(error)}` onto a queryable focus target (either setting `aria-invalid` on the host with delegated `.focus()` / `data-invalid` hook for `useFieldErrors.ts`, or updating `useFieldErrors` to check `aria-invalid="true", [data-field-invalid="true"]` and call `.focus()` on the host element which delegates focus into Shadow DOM). Verify `e2e/tests/17-accessibility-states.spec.ts` `getByLabel(...)` resolves to whichever element carries `aria-invalid="true"`.
2. Ensure `Checkbox` and `Switch` wrappers ALWAYS require and wire `aria-label` or `aria-labelledby` pointing to an explicit label element ID (plus clicking the adjacent label toggles/focuses the control in React), never relying on bare `<label>` association.
3. Always pass `fixed` (`positioning="fixed"`) on `<md-outlined-select>` and `<md-menu>` instances hosted inside sheets, dialogs, or cards, and verify whether `(pointer: coarse)` should keep native `<select>` parity inside `Select.tsx`.
4. Enforce `>= 1rem` input font size across all MD3 text field/select typographic tokens (`--md-sys-typescale-body-large-size: 1rem`).

**Warning signs:**
- Submitting an invalid `BillForm` or `ItemSheet` shows red helper text, but focus never moves to the first invalid field.
- `17-accessibility-states.spec.ts` reports `Expected attribute "aria-invalid" to be "true", received null` or `axe` flags `label` on checkboxes/switches.
- Select dropdown opens visibly cropped inside a sheet or modal dialog.

**Phase to address:** `MD3-FOUNDATION` (field/select/checkbox/switch wrappers + `useFieldErrors`), `MD3-SCREENS` (form migrations), `MD3-VERIFY` (`17-accessibility-states.spec.ts`).

---

### Pitfall 5: `themeFromSourceColor()` Missing Surface Containers & Warm Terracotta/Amber WCAG AA Contrast Traps

**What goes wrong:**
1. **`themeFromSourceColor()` is legacy MD3:** `@material/material-color-utilities`'s older `themeFromSourceColor()` / `applyTheme()` helpers omit MD3's surface container hierarchy (`surfaceContainerLowest`, `surfaceContainerLow`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`, `surfaceDim`, `surfaceBright`), which modern `@material/web` (`v2.x`) components read for cards, dialogs, menus, and sheets.
2. **Warm terracotta/amber hues fail 4.5:1 / 3:1 contrast easily:** Unlike cool slate `#475569`, warm terracotta/amber hues have high HCT chroma that bleeds into neutral/surface-container tones (`Tone 94` light / `Tone 15-17` dark). Default Tone 40 primary/amber or warning amber tokens frequently dip below **4.5:1** text contrast on `surfaceContainer` / `surfaceContainerHigh` or below **3:1** UI-component contrast on borders (`outlineVariant` is strictly decorative `< 3:1` — using it for input borders or interactive dividers fails WCAG 1.4.11!). Hestia already hit a closely related failure documented in `Button.tsx` where 90% opacity on white dropped to ~4.18:1–4.34:1 and failed `axe-core`.
3. **Existing `tokens.test.ts` disk-parser breakage:** `apps/web/src/tokens.test.ts:1-115` reads `apps/web/src/index.css` directly with `readFileSync`, splits on `@media (prefers-color-scheme: dark)` and `[data-section='dashboard']`, and checks exact contrast rules (4.5:1 text/filled buttons, 3:1 `--border-input`/accents) plus forbidden old hexes. Switching tokens to JS runtime injection or leaving `tokens.test.ts` validating only `--bg-base`/`--bg-raised` hides contrast regressions on `surfaceContainer*`.
4. **Shadow DOM animation races in `axe-core`:** `e2e/support/axe.ts:18-57` runs `settleAnimations(page)` using `document.getAnimations()` before `AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])`. If ripple/dialog/menu fade animations inside shadow roots are still animating mid-fade (`opacity < 1`), `axe-core` catches transient `color-contrast` violations!

**Why it happens:**
Material Dynamic Color optimizes tonal harmony rather than strict 4.5:1 AA on every cross-surface pairing, and warm/amber luminance curves compress mid-tone contrast.

**How to avoid:**
1. Generate light and dark MD3 CSS variables at **build/generation time** using `Hct.fromInt(argbFromHex(...))` + `SchemeTonalSpot` + `MaterialDynamicColors` (all 5 `surfaceContainer*` roles + `outline` + section overrides), keeping `@material/material-color-utilities` in `devDependencies` (zero runtime JS, zero FOUC, directly readable by `tokens.test.ts`).
2. Keep `tokens.test.ts` parsing generated CSS tokens on disk and **expand** its WCAG matrix to verify all text/accent/interactive-border pairs across **every** surface container role (`surface`, `surfaceContainerLow`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`) plus composited state-layer hover/pressed opacities in both light and dark modes (tuning `contrastLevel` or overriding specific amber/terracotta tone stops when <4.5:1 or <3:1). Never map `--md-sys-color-outline-variant` to interactive field outlines (`outline` must meet 3:1).
3. Update `e2e/support/axe.ts` `settleAnimations()` to pass `{ subtree: true }` (or explicitly await shadow root animations / wait for open state stabilization) and honor `prefers-reduced-motion` cleanly across all MD3 transitions.

**Warning signs:**
- `tokens.test.ts` fails immediately because `@media (prefers-color-scheme: dark)` markers changed or surfaces appear flat white/black (`surfaceContainer*` undefined -> falling back to defaults).
- `axe-core` `color-contrast` violations on amber/terracotta badges, secondary buttons, disabled-look helper text, or `surfaceContainerHigh` dialogs/menus in `17-accessibility-states.spec.ts`.

**Phase to address:** `MD3-FOUNDATION` (token generator + `tokens.test.ts`), `MD3-VERIFY` (full light/dark `axe-core` pass).

---

### Pitfall 6: Caddy Strict CSP, Excluded `woff2` PWA Precaching, and the 200 KB Shell Budget Gate

**What goes wrong:**
1. **CSP blocks external font CDNs:** `docker/Caddyfile:14` enforces `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; ...` with **no `font-src` directive** (meaning `font-src` inherits `'self'`). Linking Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) in `apps/web/index.html` or CSS fails production CSP in Docker/Caddy and breaks offline PWA rendering.
2. **Self-hosted Material Symbols `.woff2` silently vanishes offline (or blows precache):** Even when self-hosted, the variable Material Symbols `.woff2` is ~1.5–2.6 MB raw — near/above Workbox's default 2 MiB `maximumFileSizeToCacheInBytes` — AND `apps/web/vite.config.ts:75-94` sets `injectManifest.globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,wasm}']`, which **excludes `woff2`**. Offline E2E tests and installed PWAs lose every icon with zero console error (showing raw ligature strings like `"shopping_cart"` instead of icons!). Worse, naive glyph subsetting of variable ligature fonts strips OpenType GSUB ligature tables unless `--no-layout-closure` / ligature retention is handled.
3. **`check-build.mjs` hard-fails on shell budget > 200 KB gzipped and Auth Copy checks:** `apps/web/scripts/check-build.mjs` enforces `SHELL_BUDGET_BYTES = 200 * 1024` across `index.html` + referenced `.js`/`.css` assets, forbids `cdn.jsdelivr.net`, AND asserts exact `MAGIC_LINK_COPY` strings (`'Email me a sign-in link'` in `SignInScreen.tsx` and 3 strings in `magic-link.ts`). Importing `@material/web/all.js` (~72–73 KB gz by itself before React, React Router, TanStack Query, CSS, and shell code) or pulling heavy MD3 dialogs/menus/selects into the eager shell chunk breaks the 200 KB budget.
4. **Hardcoded slate `theme-color`:** `apps/web/vite.config.ts:9` (`THEME_COLOR = '#475569'`) and `apps/web/index.html:6` (`<meta name="theme-color" content="#475569" />`, `background_color: '#FFFFFF'`) will clash starkly with the new MD3 terracotta/amber app shell on mobile PWA chrome/splash screens.

**Why it happens:**
Hestia's PWA shell budget, Caddy headers, and Workbox `globPatterns` were tuned for inline Lucide SVGs and Tailwind CSS utility pruning — not web component side-effect modules and multi-megabyte variable icon fonts.

**How to avoid:**
1. **Prefer build-time SVG icons over a multi-MB `.woff2` font** (e.g., `@material-symbols/svg-*` or an in-repo SVG sprite / tree-shaken icon registry inside `Icon.tsx`), which automatically inherits `'self'`/`svg` precaching, needs zero `woff2` font files, avoids GSUB ligature-subsetting traps, and prevents ligature text leakage into screen readers and `textContent`.
2. If self-hosting Material Symbols `.woff2` anyway, subset specifically preserving ligatures, add `woff2` to `injectManifest.globPatterns` in `apps/web/vite.config.ts`, check compressed asset size against `maximumFileSizeToCacheInBytes`, and verify offline rendering in `17-accessibility-states.spec.ts` / `sw.test.ts`.
3. Import `@material/web` strictly by per-component subpath (`@material/web/button/filled-button.js`, etc.) inside the components/lazy routes that use them (keeping heavy forms/dialogs out of `main.tsx` / `App.tsx` eager imports), and run `check-build.mjs` continuously so `SHELL_BUDGET_BYTES` (200 KB gz) never regresses.
4. Update `THEME_COLOR` (`apps/web/vite.config.ts` and `apps/web/index.html`) to match the MD3 terracotta surface/header color (plus `media="(prefers-color-scheme: dark)"` meta tag if dynamic light/dark chrome is desired), and preserve or intentionally coordinate any `MAGIC_LINK_COPY` changes in `SignInScreen.tsx` / `magic-link.ts`.

**Warning signs:**
- Browser console CSP errors (`Refused to load stylesheet/font from fonts.googleapis.com / fonts.gstatic.com`).
- Offline PWA displays words like `"delete"` or `"more_vert"` in boxes instead of icons.
- `apps/web/scripts/check-build.mjs` exits non-zero on shell size > 200 KB or missing `MAGIC_LINK_COPY`.

**Phase to address:** `MD3-FOUNDATION` (icon strategy, `THEME_COLOR`, `globPatterns`, lazy-import discipline), `MD3-NAV-SHELL` (shell budget check), `MD3-VERIFY` (production Caddy Docker + offline PWA test).

---

### Pitfall 7: `@material/web` Maintenance-Mode Component Gaps (Navigation, Sheets, Snackbar, Segmented Controls)

**What goes wrong:**
`@material/web` (`~v2.5.x`) is in maintenance mode and **does NOT provide** several primitives central to Hestia's UI:
- Navigation Bar (mobile bottom nav — replacing `TabBar.tsx`)
- Navigation Rail (tablet/desktop rail — new MD3 layout structure)
- Top App Bar (replacing `TopBar.tsx`)
- Modal Bottom Sheet / Side Sheet (replacing `Sheet.tsx` currently built on Radix Dialog)
- Snackbar / Toast (replacing `Toast.tsx`)
- Card & Badge (replacing `Card.tsx`, `Badge.tsx`)
- Stable Segmented Button (`md-outlined-segmented-button` never graduated to stable release; affects `SegmentedControl.tsx` and `SubTabs.tsx`)

Trying to force unrelated `@material/web` elements (like `<md-tabs>` or `<md-dialog>`) into acting as a Bottom Navigation Bar or Modal Bottom Sheet without preserving ARIA semantics (`nav`, `aria-current="page"`, `role="dialog"`, focus trapping, background `inert`, Escape handling, `prefers-reduced-motion`) breaks keyboard accessibility and Playwright navigation tests.

**Why it happens:**
Teams assume installing `@material/web` gives parity with MUI or Flutter Material 3, then discover mid-milestone that ~40% of the shell and container surface must be authored against MD3 specs directly.

**How to avoid:**
1. Audit every existing primitive in `apps/web/src/components/ui/` and `shell/` before Phase `MD3-FOUNDATION` and explicitly assign each to either `@material/web` (buttons, checkboxes, switches, radios/lists, dialogs, menus, text fields, selects, tabs, dividers, progress, ripples) OR a minimal MD3-spec CSS + React primitive (`NavigationBar`, `NavigationRail`, `TopAppBar`, `BottomSheet` over native `<dialog>`, `Snackbar`, `SegmentedButton`, `Card`, `Badge`).
2. Reuse native `<dialog>.showModal()` (already gives top-layer stacking, focus trapping, Escape handling, and backdrop without Radix Dialog!) for `BottomSheet`, styled via MD3 elevation, surface container, shape (`--md-sys-shape-corner-extra-large`), and `prefers-reduced-motion`.
3. Never duplicate focus-trap, backdrop, or custom-event wiring across `Sheet`, `ConfirmDialog`, and `BarcodeScannerDialog` — extract shared helpers cleanly to stay under `.jscpd.json`.

**Warning signs:**
- Installing third-party unmaintained MD3 forks or mixing Tailwind utilities back in "just for bottom sheets and nav bar."
- Keyboard `Tab` escaping open bottom sheets onto hidden `NavigationBar` destinations behind the scrim.

**Phase to address:** `MD3-FOUNDATION` (UI primitive architecture + `Sheet`/`Card`/`Badge`/`Toast`), `MD3-NAV-SHELL` (`AppShell`, Navigation Bar/Rail, Top App Bar, `SubTabs`).

---

### Pitfall 8: Knip Baseline Strictness, JSCPD Duplication Gate, CRLF/Hygiene Traps, and Big-Bang Rewrite Collapse

**What goes wrong:**
Hestia enforces unusually strict CI hygiene checks (`.github/workflows/ci.yml`) that punish uncoordinated big-bang UI rewrites:
1. **Bidirectional Knip failure (`scripts/check-knip-baseline.mjs`):** Checks live `knip --production` output against the 26-row `scripts/knip-production-baseline.txt` (which includes `chore-copy.ts` and `PushPortProvider`) and **fails on BOTH new entries AND stale/resolved rows**. Furthermore, `knip.json:6` contains `ignoreDependencies: ["tailwindcss"]`. Deleting Tailwind/Radix/Lucide or refactoring unused UI helpers mid-milestone immediately fails CI unless `knip.json` and `knip-production-baseline.txt` are updated atomically — and side-effect imports (`import '@material/web/button/filled-button.js'`) or CSS/font assets must verify clean under `knip`.
2. **JSCPD threshold mismatch (`.jscpd.json` vs `ci.yml`):** `.jscpd.json` sets `minTokens: 60`, `minLines: 8`, `threshold: 5` (TS/TSX), while `.github/workflows/ci.yml` labels the gate `"jscpd: duplication at most 2%"`. Copy-pasting `useRef` + `addEventListener` boilerplate or repeating verbose `<md-outlined-text-field>` validation/footer blocks across 20+ screens spikes token duplication rapidly.
3. **Repo hygiene & Windows CRLF check (`scripts/check-repo-hygiene.mjs`):** CI rejects **any** tracked file with CRLF line endings (`check-repo-hygiene.mjs:228-232`) and bans the retired v1.0 6-letter brand word anywhere outside `.planning/milestones/`, `scripts/check-repo-hygiene.mjs`, and exact allowlisted quotes.
4. **Big-bang UI + E2E collapse:** All 24 E2E specs run sequentially on 1 worker (`e2e/playwright.config.ts`, `retries: 0`, up to 40 min CI budget, mutating shared state such as `21-remove-member.spec.ts`), while `apps/web/vite.config.ts` enforces `{ statements: 84, branches: 80, functions: 77, lines: 85 }` coverage thresholds. Flipping tokens, shell, routes, and 20+ screens in one sweep breaks dozens of unit tests and sequential E2E tests at once, leaving zero passing baseline to bisect.

**Why it happens:**
Removing Tailwind CSS v4 while introducing Web Components alters CSS tokens, class contracts, DOM roles, imports, and dependency manifests simultaneously across the entire `apps/web` tree.

**How to avoid:**
1. Phase cleanly behind stable React wrapper boundaries:
   - `MD3-FOUNDATION`: Tokens, `@material/web` + custom MD3 UI wrappers, `test-setup.ts` polyfills, `tokens.test.ts` (keeping existing app rendering cleanly until Tailwind removal in `MD3-VERIFY` or migrating CSS layer-by-layer without broken intermediate imports).
   - `MD3-NAV-SHELL`: `AppShell`, MD3 Navigation Bar/Rail, Top App Bar, `SubTabs` + `shell.test.tsx` + shell/nav E2E alignment.
   - `MD3-SCREENS`: Migrate screens slice-by-slice (Onboarding -> Lists/Deals -> Chores/Meals -> Bills/Settings), updating each slice's Vitest & E2E specs together.
   - `MD3-VERIFY`: Uninstall `tailwindcss`, `@tailwindcss/vite`, `radix-ui`, `lucide-react`; remove Tailwind from `knip.json`; reconcile `scripts/knip-production-baseline.txt`; run full unit coverage (84/80/77/85), `check-build.mjs` (200 KB), `jscpd`, `check-repo-hygiene.mjs` (LF + hygiene), and full 24-spec `light`/`dark`/offline E2E + `axe-core`.
2. Centralize all Web Component wrappers and form field layouts in `components/ui/` to keep JSCPD well below 2–5%.
3. Configure `.gitattributes` / editor EOL to LF (`\n`) before editing any file on Windows.

**Warning signs:**
- CI fails on `hygiene` with `"stale baseline entry"` in `check-knip-baseline.mjs` or `"CRLF line endings found"`.
- A single branch accumulates 60+ failing unit specs and breaks half of the sequential `e2e/tests/*.spec.ts` pipeline before reaching `MD3-SCREENS` completion.

**Phase to address:** All phases (`MD3-FOUNDATION` -> `MD3-NAV-SHELL` -> `MD3-SCREENS` -> `MD3-VERIFY`).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Importing `@material/web/all.js` in `main.tsx` | Zero per-component import tracking | ~72–73 KB gz added directly to eager shell, threatening `SHELL_BUDGET_BYTES` (200 KB) and slowing initial parse | Never — always import per-component subpaths inside UI wrappers / lazy routes |
| Using bare `<md-*>` tags directly in `screens/` | Saves writing wrapper files initially | Scatters `onInput` vs `onChange`, `soft-disabled`, `aria-invalid`, `fixed`, and `JSX.IntrinsicElements` hacks across 20+ screens; blows `.jscpd.json` threshold | Never |
| Weakening `tokens.test.ts` or disabling `axe-core` rules for amber/terracotta surfaces | Passes build quickly during styling tweaks | Real WCAG 2.1 AA contrast failures on mobile/dark mode, violating `17-accessibility-states.spec.ts` | Never |
| Leaving Tailwind + `@material/web` coexisting permanently | Avoids migrating complex screens (`RotationEditor`, `BillForm`) right away | CSS token drift, bloated CSS bundle against 200 KB shell budget, `knip` & hygiene churn | Only temporarily inside `MD3-NAV-SHELL`/`MD3-SCREENS` feature branches; must be cleanly deleted in `MD3-VERIFY` |
| Suppressing `eslint-plugin-jsx-a11y` globally instead of fixing wrapper ARIA | Silences `label-has-associated-control` lint errors quickly | Ships inaccessible switches/checkboxes (`b/294081528`) that `axe-core` catches in E2E | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| React `19.3.0` + `@material/web` | Using `onChange` on `<md-outlined-text-field>` expecting keystroke updates; ignoring `closed` event on `<md-dialog>` | Wrap via `@lit/react` or shared ref/listener hook; use `onInput` for live text state + `onChange` for commit/select; sync React `open` from `closed` |
| `jsdom@30.1.0` + Vitest `5.0.1` | Guarding polyfill with `if (!HTMLElement.prototype.attachInternals)` | Unconditionally override `attachInternals` in `apps/web/src/test-setup.ts` + stub `Element.prototype.animate`, `HTMLDialogElement.prototype.showModal`/`close`, `adoptedStyleSheets`, `matchMedia` |
| `@testing-library/dom@10.4.2` + Shadow DOM | Calling `getByLabelText` / `toBeInvalid` expecting traversal into bare `<md-*>` shadow roots | Wrap controls in light-DOM-friendly React adapters forwarding host/label semantics, or use shadow-aware helpers where direct shadow testing is unavoidable |
| `@material/material-color-utilities` | Calling `themeFromSourceColor()` (missing `surfaceContainer*` tokens) | Build-time generation using `Hct.fromInt(argbFromHex(...))` + `SchemeTonalSpot` + `MaterialDynamicColors` written to CSS files inspected by `tokens.test.ts` |
| `docker/Caddyfile` CSP + Vite PWA | Linking Google Fonts CDN or omitting `woff2` from `apps/web/vite.config.ts` `globPatterns` | Self-host only (ideally build-time SVG icons instead of `.woff2`); if `.woff2` is used, add to `globPatterns` and check Workbox 2 MiB limit |
| Playwright + `@axe-core/playwright` | `document.getAnimations()` in `e2e/support/axe.ts` missing shadow animations or querying `.line-through` / `.text-section` / `[aria-invalid]` on wrong element | Update `settleAnimations()` (`{ subtree: true }`); use semantic locators and verify `getByLabel` + `aria-invalid` consistency in `17-accessibility-states.spec.ts` |
| `scripts/check-knip-baseline.mjs` | Removing `tailwindcss`/`radix-ui`/`lucide-react` or obsolete UI files without updating `knip.json` & `scripts/knip-production-baseline.txt` | Keep `knip.json` (`ignoreDependencies`) and all 26 baseline entries synchronized in the final cleanup PR |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Unbounded `@material/web` imports in eager entry (`main.tsx` / `App.tsx`) | `apps/web/scripts/check-build.mjs` fails `SHELL_BUDGET_BYTES` (200 KB gzipped) | Keep `@material/web` per-component imports inside lazy-loaded routes (`routes.tsx`), leaving shell minimal | Immediately on `npm run build` / `check-build.mjs` |
| Self-hosting unsubsetted Material Symbols variable `.woff2` (~1.5–2.6 MB) | Exceeds Workbox 2 MiB default precache cap (`maximumFileSizeToCacheInBytes`) or slows cold offline PWA install | Use tree-shaken build-time SVG icons (`@material-symbols/svg-*` or sprite) or properly ligature-preserved `.woff2` subsetting | Immediately in PWA precache build / offline mobile cold load |
| Runtime `themeFromSourceColor` / dynamic CSS generation on mount | Flash of unstyled/wrong-slate theme (`#475569`) before JS hydration and extra JS in shell | Pre-generate light/dark/section CSS tokens into static stylesheets and update `<meta name="theme-color">` in `index.html` / `vite.config.ts` | Every initial page load and dark-mode launch |
| Unthrottled `<md-ripple>` / motion animations during E2E & reduced-motion | Transient `axe-core` contrast failures mid-transition and flaky sequential Playwright runs (`retries: 0`) | Honor `@media (prefers-reduced-motion: reduce)` across custom sheets/transitions and settle shadow animations in `e2e/support/axe.ts` | E2E CI (`17-accessibility-states.spec.ts` light & dark runs) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Weakening `docker/Caddyfile` CSP (`font-src`/`style-src`/`connect-src` external domains) to load Google Fonts or CDN icons | Violates strict self-hosted origin boundary, creates third-party font tracking/compromise vector, and breaks `check-build.mjs` (`cdn.jsdelivr.net` check) / offline PWA | Keep `docker/Caddyfile` `default-src 'self'` strict (`font-src` implicitly `'self'`); serve 100% self-hosted CSS and SVG/font assets |
| Rendering unescaped user/OCR/item strings inside SVG/HTML or custom element `innerHTML` shortcuts while migrating away from Tailwind | XSS vector (especially on scanned grocery barcodes, Flipp deals, and household item names) | Pass text strictly via React JSX children or plain string DOM properties (`supportingText`, `label`), never `dangerouslySetInnerHTML` |
| Allowing `soft-disabled` offline actions in `Button.tsx` to execute API mutations | Offline/permission-guarded mutations still fire because `@material/web` `soft-disabled` preserves pointer/keyboard click events | Guard `onClick` inside `Button.tsx` whenever `disabled || Boolean(disabledReason)` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Letting `<md-icon>` ligature text leak into screen readers (`settings`, `shopping_cart`) | VoiceOver / TalkBack reads `"settings Settings"` on navigation tabs and buttons, and breaks test text checks | Wrap every icon with `aria-hidden="true"` (or use accessible SVG symbols with `aria-hidden="true"` inside labeled controls) |
| Using native `<md-outlined-select>` inside `<md-dialog>` or bottom sheets without `fixed` | Dropdown menu clips inside sheet/dialog boundaries on mobile and desktop | Always set `fixed` (`positioning="fixed"`) on selects/menus inside overlays; evaluate preserving `(pointer: coarse)` native `<select>` parity |
| Replacing soft-disabled offline buttons (`disabledReason`) with native `disabled` | Keyboard/screen-reader users cannot reach or read *why* an offline action is unavailable | Keep Hestia's focusable `soft-disabled` + `aria-describedby` pattern (`Button.tsx:28-39`) |
| Relying on `outlineVariant` for text field borders, switches, or dividers with interactive meaning | Low-contrast boundaries (<3:1) invisible on outdoor mobile screens and dark mode | Use full `outline` token verified >=3:1 on `surface` / `surfaceContainer*` in `tokens.test.ts` |
| Dropping input font size below `16px` (`1rem`) on MD3 text fields/selects | iOS Safari auto-zooms viewport on focus in mobile bottom sheets (`ItemSheet`, `BillForm`) | Lock body-large input typography to `>= 1rem` |
| Rendering `Error` banner / `FormMessage` without `role="alert"` or failing to focus first invalid field | Screen readers don't announce submission errors and mobile keyboards stay hidden/misplaced | Preserve `role="alert"` announcements and fix `useFieldErrors.ts` `[aria-invalid="true"]` shadow focus delegation |

---

## "Looks Done But Isn't" Checklist

- [ ] **Incomplete `attachInternals` check:** Verify `jsdom@30.1.0` `test-setup.ts` unconditionally provides `setFormValue`, `setValidity`, `form`, `states`, `Element.prototype.animate`, `HTMLDialogElement.prototype.showModal`, and `adoptedStyleSheets` — and prove form validation/submission actually passes in Vitest (not mocked away).
- [ ] **`tokens.test.ts` surfaces expanded:** Verify 4.5:1 text and 3:1 interactive boundary contrast against **all** MD3 `surfaceContainer*` tiers (`surface`, `surfaceContainerLow`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`) in both light and dark modes, plus section theme accents.
- [ ] **Invalid-field focus works end-to-end:** Trigger validation failure in `BillForm`, `ItemSheet`, and `SignInScreen`; confirm `useFieldErrors` moves focus to the first invalid control and `17-accessibility-states.spec.ts` `aria-invalid="true"` assertions pass.
- [ ] **Switches & Checkboxes accessible:** Confirm `NotificationTypeRows`, `ItemSheet`, and `RotationEditor` checkboxes/switches carry explicit `aria-label` / `aria-labelledby` (not broken `<label>` wrapping `b/294081528`), and `md-switch` reads `selected` (`aria-checked`), not `checked`.
- [ ] **Overlays never clip & Escape syncs React:** Open every `<md-outlined-select>` and `<md-menu>` inside `Sheet` and `ConfirmDialog`; dismiss via `Escape` and scrim click and verify clean reopen + focus return.
- [ ] **Offline PWA icons & 200 KB shell budget:** Run `apps/web/scripts/check-build.mjs` (`SHELL_BUDGET_BYTES` <= 200 KB gz and `MAGIC_LINK_COPY` intact) AND test offline PWA load in Playwright against production Caddy CSP verifying zero missing icons and zero CSP violations.
- [ ] **Coverage & hygiene gates untouched or cleanly reconciled:** Confirm `vitest --coverage` passes `{ statements: 84, branches: 80, functions: 77, lines: 85 }`, `npm run lint` (`jsx-a11y` strict + TS6 strict), `npm run jscpd`, `node scripts/check-knip-baseline.mjs` (both new AND stale entries zeroed), and `node scripts/check-repo-hygiene.mjs` (LF endings, zero banned legacy tokens).
- [ ] **No orphan Tailwind/Radix/Lucide artifacts:** Search `apps/web` for leftover Tailwind classes (`text-section`, `shadow-sm`, `line-through` expectations), `[data-state=...]`, `radix-ui`, or `lucide-react` references.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| `jsdom@30.1.0` crashes across all tests after installing `@material/web` | LOW | Patch `apps/web/src/test-setup.ts` unconditionally (`attachInternals`, `Element.prototype.animate`, `HTMLDialogElement.prototype.showModal`, `adoptedStyleSheets`, `matchMedia`) before touching component tests |
| `useFieldErrors` + E2E `[aria-invalid="true"]` broken across forms | LOW | Update `TextField`/`Select` wrapper to reflect `aria-invalid` onto a queryable target with delegated `.focus()`, and align `useFieldErrors.ts` once across all forms |
| Shell bundle blows 200 KB gz (`check-build.mjs`) | MEDIUM | Replace `@material/web/all.js` or eager imports in `App.tsx`/`routes.tsx` with granular per-component imports inside lazy routes; swap variable `.woff2` icon font for build-time SVG symbols |
| Warm terracotta/amber fails `axe-core` contrast on `surfaceContainer*` | MEDIUM | Regenerate static CSS tokens with `SchemeTonalSpot` + `MaterialDynamicColors` at bumped `contrastLevel` or clamped tone stops on offending roles; enforce via `tokens.test.ts` |
| `knip` / `jscpd` / `check-repo-hygiene` CI failures at merge time | LOW–MEDIUM | Reconcile `knip.json` + `scripts/knip-production-baseline.txt` atomically with dependency removal, deduplicate wrapper boilerplate into `components/ui/`, normalize CRLF -> LF |
| Massive E2E regression from premature Tailwind removal | HIGH | Keep Tailwind tokens/classes intact until every shell + screen slice is migrated to MD3 wrappers, migrating tests alongside each screen PR and reserving dependency deletion for `MD3-VERIFY` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| Pitfall 1: `jsdom@30.1.0` incomplete `attachInternals` & missing `animate`/`showModal` | `MD3-FOUNDATION` | Smoke test rendering form-associated `@material/web` controls + `<md-dialog>` in `vitest` (`primitives.test.tsx`) |
| Pitfall 2: Testing Library Shadow DOM blind spots & 63 unit / 24 E2E selector breaks | `MD3-FOUNDATION` (wrappers), `MD3-NAV-SHELL`, `MD3-SCREENS` | Passing Vitest + Playwright role/label queries per migrated slice (`shell.test.tsx`, `17-accessibility-states.spec.ts`, `22-deals-pricing-display.spec.ts`) |
| Pitfall 3: React 19 `onInput`/`onChange`, `md-dialog` `closed` sync, `soft-disabled`, TS6/ESLint | `MD3-FOUNDATION` | `npm run typecheck`, `npm run lint` (`jsx-a11y` strict), `primitives.test.tsx` (Escape close, controlled typing, soft-disabled click guard) |
| Pitfall 4: `useFieldErrors` shadow boundary, `b/294081528` switch/checkbox labels, select clipping | `MD3-FOUNDATION`, `MD3-SCREENS` | Form validation focus unit tests + `17-accessibility-states.spec.ts` (`aria-invalid` + `axe-core` label rules) + dialog select tests |
| Pitfall 5: `SchemeTonalSpot` + `MaterialDynamicColors`, amber/terracotta contrast, `axe-core` animation settle | `MD3-FOUNDATION`, `MD3-VERIFY` | Expanded `tokens.test.ts` across all `surfaceContainer*` tiers + `17-accessibility-states.spec.ts` light & dark WCAG 2.1 AA |
| Pitfall 6: `docker/Caddyfile` CSP, `woff2` precaching, SVG vs font icons, 200 KB shell budget, `#475569` `THEME_COLOR` | `MD3-FOUNDATION`, `MD3-NAV-SHELL`, `MD3-VERIFY` | `apps/web/scripts/check-build.mjs` (`<= 200 KB` + `MAGIC_LINK_COPY`), `sw.test.ts`, Caddy Docker + offline PWA E2E |
| Pitfall 7: `@material/web` maintenance gaps (Navigation Bar/Rail, Top Bar, Bottom Sheet, Segmented, Snackbar) | `MD3-FOUNDATION`, `MD3-NAV-SHELL` | Keyboard navigation, Escape/backdrop/inert focus trap tests in `shell.test.tsx` & `primitives.test.tsx` |
| Pitfall 8: Knip bidirectional baseline, JSCPD threshold, LF hygiene, sequential E2E stability | All phases -> finalized in `MD3-VERIFY` | Full CI gate: `lint`, `typecheck`, `test-unit` (84/80/77/85 coverage), `build` (`check-build.mjs`), `hygiene` (`knip`, `jscpd`, `check-repo-hygiene.mjs`), all 24 E2E specs |

---

## Sources

### Verified Repository Sources (Primary)
- `apps/web/package.json` & root `package.json` — exact package versions (`react@19.3.0`, `jsdom@30.1.0`, `vitest@5.0.1`, `vite-plugin-pwa@1.3.0`, `eslint@10.11.0`, `jscpd@5.4.1`, `knip@6.41.0`, `typescript@6.0.3`)
- `apps/web/vite.config.ts` — `THEME_COLOR = '#475569'`, Workbox `injectManifest.globPatterns` (omits `woff2`), Vitest `jsdom` & `{84, 80, 77, 85}` coverage thresholds
- `apps/web/index.html`, `apps/web/src/sw.ts`, & `apps/web/src/sw.test.ts` — theme-color meta, PWA precaching & offline navigation route
- `apps/web/src/test-setup.ts` & `apps/web/src/test/browser.ts` — existing Radix/jsdom stubs & keyboard `openMenu`
- `apps/web/src/tokens.test.ts` & `apps/web/src/index.css` — CSS contrast assertions & reduced-motion/focus-visible baselines
- `apps/web/src/lib/use-field-errors.ts`, `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/ui/Select.tsx`, & `apps/web/src/screens/settings/NotificationTypeRows.tsx`
- `apps/web/scripts/check-build.mjs` — `SHELL_BUDGET_BYTES = 200 * 1024`, `MAGIC_LINK_COPY`, CDN checks
- `docker/Caddyfile` — production CSP headers (`default-src 'self'`, implicit `font-src 'self'`)
- `eslint.config.js` & `tsconfig.base.json` — strict TypeScript 6 (`exactOptionalPropertyTypes`, `erasableSyntaxOnly`) & `jsxA11y.flatConfigs.strict`
- `knip.json`, `.jscpd.json`, `scripts/check-knip-baseline.mjs`, `scripts/knip-production-baseline.txt`, `scripts/check-repo-hygiene.mjs`, `.github/workflows/ci.yml`
- `e2e/playwright.config.ts`, `e2e/support/axe.ts`, and E2E specs (`17-accessibility-states.spec.ts`, `21-remove-member.spec.ts`, `22-deals-pricing-display.spec.ts`)
- Direct Node/`jsdom@30.1.0` runtime verification inside `apps/web` checking `attachInternals`, `ElementInternals`, `Element.prototype.animate`, `HTMLDialogElement.prototype.showModal`, `adoptedStyleSheets`, `popover`, and `matchMedia`

### Verified External Documentation (Web Verification)
- `@material/web` (~v2.5.x) maintenance status, component catalog gaps (missing Navigation Bar/Rail, Bottom Sheet, Top App Bar, Card, Badge, Snackbar, Segmented Button), `@material/web/all.js` gzipped footprint (~72–73 KB gz), `<md-switch>` `selected` API, `<md-dialog>` `closed` event, `<md-menu>`/`<md-outlined-select>` `fixed` positioning, `<md-icon>` `aria-hidden="true"`, and `<label>` association bug (`b/294081528`)
- React 19 Custom Element interoperability (`onInput` vs `onChange`, custom event forwarding, `@lit/react` `createComponent`)
- `@material/material-color-utilities` `themeFromSourceColor()` limitations vs `SchemeTonalSpot` + `MaterialDynamicColors` (`surfaceContainer*` token generation)
- `@testing-library/dom` Shadow DOM non-traversal vs Playwright open-Shadow-DOM piercing
- Material Symbols variable `.woff2` size (~1.5–2.6 MB raw) and OpenType ligature subsetting caveats

---
*Pitfalls research for: Hestia v3.0 Material Design 3 Overhaul (`apps/web`)*
*Researched: 2026-11-11*
