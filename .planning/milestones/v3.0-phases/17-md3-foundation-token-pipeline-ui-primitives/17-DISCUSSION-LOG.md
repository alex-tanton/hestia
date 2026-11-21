# Phase 17: MD3 Foundation, Token Pipeline & UI Primitives - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-11
**Phase:** 17-MD3 Foundation, Token Pipeline & UI Primitives
**Areas discussed:** Warm Terracotta palette, dark mode & typography; Material Symbols delivery & icon style; Gap primitives & control behavior; Component test harness

---

## Warm Terracotta palette, dark mode & typography

### Seed warmth and contrast feel

| Option | Description | Selected |
|--------|-------------|----------|
| Earthy terracotta clay (~#B4532A) | Warm primary with creamy surfaceContainer tints and comfortable AA contrast margin | ✓ |
| Deep burnt sienna (~#9E3E1F) | Bolder, darker terracotta accents against calmer neutral-warm surfaces | |
| Soft muted apricot (~#C86D4A) | Lighter, airier clay feel (with token contrast overrides where AA requires) | |
| You decide | Pick and tune seed hex strictly for cleanest WCAG AA contrast across all 5 surfaceContainer tiers | |

**User's choice:** Earthy terracotta clay (`~#B4532A`)

### Light and dark token activation

| Option | Description | Selected |
|--------|-------------|----------|
| OS-driven only via prefers-color-scheme | Matches current index.css and tokens.test.ts without adding theme state | |
| OS default plus explicit data-theme attribute override on html | Stays OS-driven today while letting Playwright or a future setting force light/dark without media emulation | ✓ |
| You decide | Match whatever keeps tokens.test.ts and Playwright light/dark audits cleanest | |

**User's choice:** OS default plus explicit `data-theme` attribute override on `<html>`

### PWA manifest and browser theme-color

| Option | Description | Selected |
|--------|-------------|----------|
| Match MD3 surface/surfaceContainer per color scheme | Light/dark theme-color meta tags blend seamlessly with MD3 Top App Bar and splash background | ✓ |
| Use Warm Terracotta primary brand color (~#B4532A) | Distinct terracotta status/title bar in installed PWA chrome | |
| You decide | Pick option matching MD3 Top App Bar best | |

**User's choice:** Match MD3 `surface`/`surfaceContainer` per color scheme

### Typography font family

| Option | Description | Selected |
|--------|-------------|----------|
| Native system UI font stack | Zero WOFF2 download/precache overhead, zero FOUT, uses Roboto/SF/Segoe natively per OS | ✓ |
| Self-hosted variable font | Uniform cross-platform typography at the cost of extra SW precache weight | |
| You decide | Choose based on offline precache budget and visual consistency | |

**User's choice:** Native system UI font stack

---

## Material Symbols delivery & icon style

### Symbol delivery strategy behind Icon.tsx

| Option | Description | Selected |
|--------|-------------|----------|
| Self-hosted WOFF2 (@material-symbols/font-400) | 0 B in JS/CSS shell budget, native CSS FILL transition for active nav, ~482 KiB in SW precache | |
| Curated inline SVG map (@material-symbols/svg-400) | 0 B SW font precache, zero ligature text leaks in DOM/screen readers, ~6-8 KB gz in JS with explicit registry + filled variants | ✓ |
| You decide | Choose based on shell budget vs offline SW cache size and test safety | |

**User's choice:** Curated inline SVG map (`@material-symbols/svg-400`)

### Material Symbols shape style

| Option | Description | Selected |
|--------|-------------|----------|
| Rounded (@material-symbols/svg-400/rounded) | Softer corners pairing well with Warm Terracotta and household UI | ✓ |
| Outlined (@material-symbols/svg-400/outlined) | Crisp standard MD3 geometry matching Google's baseline specs | |
| Sharp (@material-symbols/svg-400/sharp) | Angular, utilitarian geometry | |
| You decide | Pick between Rounded and Outlined based on MD3 consistency | |

**User's choice:** Rounded (`@material-symbols/svg-400/rounded`)

### Filled variants for active/selected states

| Option | Description | Selected |
|--------|-------------|----------|
| Support filled variants via filled?: boolean | Matches MD3 active-state guidance while importing -fill.svg only for icons with active/selected states | ✓ |
| Keep every icon outline-only | Simpler registry and slightly smaller JS chunk, uniform weight on active tabs/nav | |
| You decide | Add filled variants where MD3 expects them without bloating unused icons | |

**User's choice:** Support filled variants via `filled?: boolean`

### Bundling across shell and lazy routes

| Option | Description | Selected |
|--------|-------------|----------|
| Single central static icon registry in Icon.tsx | ~50 Hestia icons (~6-8 KB gz), simple `<Icon name="..." />` API everywhere, verified against 200 KB shell budget | ✓ |
| Split core shell icons from lazy feature maps | Saves a few KB in entry shell chunk with extra registry boilerplate | |
| You decide | Keep a single registry unless check-build.mjs shell headroom requires splitting | |

**User's choice:** Single central static icon registry in `Icon.tsx`

---

## Gap primitives & control behavior

### Select.tsx coarse-pointer fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Keep native <select> on (pointer: coarse) + <md-outlined-select positioning="fixed"> on fine pointers | Preserves fast one-handed mobile picker while giving desktop MD3 menus | ✓ |
| Always use <md-outlined-select positioning="fixed"> | Uniform MD3 menu appearance across touch and desktop | |
| You decide | Keep whatever preserves mobile ergonomics and Playwright combobox selectors cleanest | |

**User's choice:** Keep native `<select>` on `(pointer: coarse)` + `<md-outlined-select positioning="fixed">` on fine pointers

### Snackbar queuing and persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Single active snackbar (replace non-error toast) | New toast replaces non-error toast; Undo and Error stay visible with Dismiss × until acted on or dismissed | |
| Sequential queue | Wait until current Undo or Error snackbar is dismissed/acted on before showing the next toast | ✓ |
| Stacked list | Keep multiple toasts stacked vertically like current Toast.tsx | |
| You decide | Follow MD3 single-snackbar guidance while keeping Errors and Undo actionable | |

**User's choice:** Sequential queue (single active slot, waiting until current Undo or Error snackbar is dismissed/acted on before advancing)

### ModalBottomSheet header and dismissal affordances

| Option | Description | Selected |
|--------|-------------|----------|
| Title header + accessible Close (×) + backdrop/Escape | Omits decorative drag pill without swipe gesture | |
| MD3 32dp × 4dp drag handle pill + Close (×) + backdrop/Escape | Classic MD3 sheet silhouette with explicit close button | |
| MD3 drag handle pill only | Relies on backdrop click and Escape to close | |
| You decide | Optimize for MD3 visual clarity and Playwright/keyboard accessibility | ✓ |

**User's choice:** You decide — optimize for MD3 visual clarity and Playwright/keyboard accessibility

### DateField and TimeField visual alignment

| Option | Description | Selected |
|--------|-------------|----------|
| MD3 outlined field box matching <md-outlined-text-field> | 56px height, 4px radius, supporting/error text below | |
| Stacked label above MD3-bordered native input | Preserves current FieldFrame spacing without notch/floating-label CSS | |
| You decide | Match <md-outlined-text-field> closely where clean and reliable across browsers | ✓ |

**User's choice:** You decide — match `<md-outlined-text-field>` closely where clean and reliable across browsers

---

## Component test harness

### Vitest component test runner

| Option | Description | Selected |
|--------|-------------|----------|
| jsdom + forced element-internals-polyfill + shadow helpers | Fast unit/CI loop with node project for logic/tokens.test.ts; Playwright verifies Top Layer & CSS | |
| @vitest/browser-playwright (headless Chromium) | Real Shadow DOM, adoptedStyleSheets, and `<dialog>.showModal()` across all component tests | |
| Hybrid Browser Mode for primitives/shell only | Chromium for MD3 primitives/shell, jsdom for existing screen tests | |
| You decide | Pick jsdom unless Phase 17 smoke tests hit an unresolvable fidelity gap | ✓ |

**User's choice:** You decide — pick `jsdom` unless Phase 17 smoke tests hit an unresolvable fidelity gap

### Coexistence strategy for components/ui/ in Phase 17

| Option | Description | Selected |
|--------|-------------|----------|
| Upgrade components/ui/ in place onto MD3 wrappers | Keep prop contracts compatible so unmigrated screens and Tailwind utilities keep working until Phases 18-20 | ✓ |
| Keep legacy Radix components/ui/ untouched alongside new ui-md/ | Defer primitive swap until Phases 18-20 | |
| You decide | Choose whichever keeps CI green across existing tests and E2E at Phase 17 end | |

**User's choice:** Upgrade `components/ui/` in place onto MD3 wrappers with compatible prop contracts

### Shadow DOM interaction in Vitest tests

| Option | Description | Selected |
|--------|-------------|----------|
| Shared shadow-aware RTL helpers + host ARIA | Avoids duplicated shadowRoot boilerplate across primitives.test.tsx and screen tests | |
| Shadow helpers confined to primitives.test.tsx | Light-DOM ARIA/labels exposed on wrappers for standard RTL queries in screens | |
| You decide | Balance RTL query readability, .jscpd.json duplication limits, and real accessibility semantics | ✓ |

**User's choice:** You decide — balance RTL query readability, `.jscpd.json` duplication limits, and real accessibility semantics

### Go/no-go gate for escalating from jsdom to Browser Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Gate jsdom on 5 smoke checks passing cleanly in primitives.test.tsx | Escalate to @vitest/browser-playwright only if jsdom requires fragile hacks for focus, checkbox/switch, radio setValidity, dialog Escape/focus return, or select change | ✓ |
| Commit to jsdom unconditionally | Leave real Shadow DOM / Top Layer verification exclusively to Playwright E2E | |
| Go straight to @vitest/browser-playwright | Skip jsdom polyfills altogether | |

**User's choice:** Gate `jsdom` on the 5 `primitives.test.tsx` smoke checks passing cleanly

---

## the agent's Discretion

- `ModalBottomSheet` header/backdrop/chrome layout optimized for MD3 visual clarity and Playwright/keyboard accessibility
- `DateField` / `TimeField` outlined visual alignment matching `<md-outlined-text-field>` cleanly across browsers
- Vitest `projects` split and shared Shadow DOM / host-ARIA RTL helper ergonomics respecting `.jscpd.json`

## Deferred Ideas

None — discussion stayed within phase scope

