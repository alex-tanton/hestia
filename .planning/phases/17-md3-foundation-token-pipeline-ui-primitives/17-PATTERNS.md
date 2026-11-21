# Phase 17: MD3 Foundation, Token Pipeline & UI Primitives - Pattern Map

**Mapped:** 2026-11-12
**Files analyzed:** 50 (including affected screen/component `.test.tsx` test suites)
**Analogs found:** 40 / 50 (29 exact, 11 role-match/partial; 10 new `@lit/react` adapter files + `gap-primitives.css` top-layer CSS documented in `No Analog Found` via `17-RESEARCH.md` + `17-UI-SPEC.md`)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/package.json` | config | batch | `apps/web/package.json` (self) + `package.json` | exact |
| `eslint.config.js` | config | transform | `eslint.config.js` (lines 91-132) | exact |
| `apps/web/index.html` | config | request-response | `apps/web/index.html` (self) | exact |
| `apps/web/vite.config.ts` | config | batch | `apps/web/vite.config.ts` (self) | exact |
| `apps/web/scripts/generate-icons.mjs` | utility | file-I/O | `apps/web/scripts/generate-icons.mjs` (self) | exact |
| `apps/web/scripts/generate-tokens.mjs` | utility | file-I/O + transform | `apps/web/scripts/generate-icons.mjs` + `apps/web/scripts/check-build.mjs` | role-match |
| `apps/web/src/styles/tokens.css` | config | transform | `apps/web/src/index.css` (lines 185-328) | role-match |
| `apps/web/src/styles/gap-primitives.css` | config | transform | `apps/web/src/index.css` (lines 373-394) | partial (top-layer CSS in `17-RESEARCH.md`) |
| `apps/web/src/index.css` | config | transform | `apps/web/src/index.css` (self, lines 1-113, 185-394) | exact |
| `apps/web/src/tokens.test.ts` | test | file-I/O + transform | `apps/web/src/tokens.test.ts` (self) | exact |
| `apps/web/src/components/md/props.ts` | utility | transform | `apps/web/src/lib/cn.ts` (module conventions) | role-match |
| `apps/web/src/components/md/MdButton.tsx` | component | event-driven | `apps/web/src/components/ui/Button.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdTextField.tsx` | component | event-driven | `apps/web/src/components/ui/Field.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdSelect.tsx` | component | event-driven | `apps/web/src/components/ui/Select.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdCheckbox.tsx` | component | event-driven | `apps/web/src/components/ui/Checkbox.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdSwitch.tsx` | component | event-driven | `apps/web/src/components/ui/Checkbox.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdRadio.tsx` | component | event-driven | `apps/web/src/components/ui/SegmentedControl.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdDialog.tsx` | component | event-driven | `apps/web/src/components/ui/ConfirmDialog.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdMenu.tsx` | component | event-driven | `apps/web/src/components/ui/OverflowMenu.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdTabs.tsx` | component | event-driven | `apps/web/src/components/ui/Tabs.tsx` (TS exports only) | no-analog (`@lit/react`) |
| `apps/web/src/components/md/MdProgress.tsx` | component | event-driven | `apps/web/src/components/ui/Button.tsx` (spinner usage) | no-analog (`@lit/react`) |
| `apps/web/src/components/ui/icon-paths.ts` | config | transform | `apps/web/src/lib/sections.ts` + `apps/web/src/components/ui/Badge.tsx` | role-match |
| `apps/web/src/components/ui/Icon.tsx` | component | transform | `apps/web/src/components/ui/FormMessage.tsx` + `apps/web/src/components/ui/Badge.tsx` | role-match |
| `apps/web/src/components/ui/Button.tsx` | component | event-driven | `apps/web/src/components/ui/Button.tsx` (self) | exact |
| `apps/web/src/components/ui/Field.tsx` | component | event-driven | `apps/web/src/components/ui/Field.tsx` (self) | exact |
| `apps/web/src/components/ui/DateField.tsx` | component | event-driven | `apps/web/src/components/ui/Field.tsx` (lines 31-103) | role-match |
| `apps/web/src/components/ui/TimeField.tsx` | component | event-driven | `apps/web/src/components/ui/Field.tsx` (lines 31-103) | role-match |
| `apps/web/src/components/ui/Select.tsx` | component | event-driven | `apps/web/src/components/ui/Select.tsx` (self) | exact |
| `apps/web/src/components/ui/Checkbox.tsx` | component | event-driven | `apps/web/src/components/ui/Checkbox.tsx` (self) | exact |
| `apps/web/src/components/ui/Switch.tsx` | component | event-driven | `apps/web/src/components/ui/Checkbox.tsx` (lines 5-54) | role-match |
| `apps/web/src/components/ui/ConfirmDialog.tsx` | component | event-driven | `apps/web/src/components/ui/ConfirmDialog.tsx` (self) | exact |
| `apps/web/src/components/ui/OverflowMenu.tsx` | component | event-driven | `apps/web/src/components/ui/OverflowMenu.tsx` (self) | exact |
| `apps/web/src/components/ui/Tabs.tsx` | component | event-driven | `apps/web/src/components/ui/Tabs.tsx` (self) | exact |
| `apps/web/src/components/ui/ModalBottomSheet.tsx` | component | event-driven | `apps/web/src/components/ui/Sheet.tsx` (self, props/a11y) | role-match (native `<dialog>` in `17-RESEARCH.md`) |
| `apps/web/src/components/ui/Sheet.tsx` | component | event-driven | `apps/web/src/components/ui/Sheet.tsx` (self) | exact |
| `apps/web/src/components/ui/Toast.tsx` (Snackbar) | provider | event-driven | `apps/web/src/components/ui/Toast.tsx` (self) | exact |
| `apps/web/src/components/ui/Card.tsx` | component | transform | `apps/web/src/components/ui/Card.tsx` (self) | exact |
| `apps/web/src/components/ui/ListRow.tsx` | component | event-driven | `apps/web/src/components/ui/ListRow.tsx` (self) | exact |
| `apps/web/src/components/ui/Badge.tsx` | component | transform | `apps/web/src/components/ui/Badge.tsx` (self) | exact |
| `apps/web/src/components/ui/SegmentedControl.tsx` | component | event-driven | `apps/web/src/components/ui/SegmentedControl.tsx` (self) + `Tabs.tsx` | exact |
| `apps/web/src/components/ui/Skeleton.tsx` | component | event-driven | `apps/web/src/components/ui/Skeleton.tsx` + `apps/web/src/lib/use-delayed-visible.ts` | exact |
| `apps/web/src/components/ui/FormMessage.tsx` | component | transform | `apps/web/src/components/ui/FormMessage.tsx` (self) | exact |
| `apps/web/src/components/ui/CopyButton.tsx` | component | event-driven | `apps/web/src/components/ui/CopyButton.tsx` (self) | exact |
| `apps/web/src/test-setup.ts` | config | event-driven | `apps/web/src/test-setup.ts` (self) | exact |
| `apps/web/src/test/md-queries.ts` | utility | transform | `apps/web/src/test/browser.ts` + `apps/web/src/test/harness.tsx` | role-match |
| `apps/web/src/test/browser.ts` | utility | event-driven | `apps/web/src/test/browser.ts` (self) | exact |
| `apps/web/src/components/ui/primitives.test.tsx` | test | event-driven | `apps/web/src/components/ui/primitives.test.tsx` (self) | exact |
| `apps/web/src/components/ui/Toast.test.tsx` | test | event-driven | `apps/web/src/components/ui/Toast.test.tsx` (self) | exact |
| `apps/web/src/screens/chores/chores.test.tsx` | test | event-driven | `apps/web/src/screens/chores/chores.test.tsx` (lines 290-341) | exact |
| Affected screen `.test.tsx` suites (Shadow DOM query updates) | test | event-driven | `apps/web/src/components/meals/meal-components.test.tsx`, `apps/web/src/components/shell/shell.test.tsx`, `apps/web/src/screens/lists/lists.test.tsx` | exact |

*(Note: All existing analog paths above were verified as git-tracked via `git ls-files`.)*

---

## Pattern Assignments

### 1. Tooling, Config, Build Scripts & Token Pipeline

#### `apps/web/package.json` (config, batch)
**Analog:** `apps/web/package.json` (lines 1-55)

**Scripts & dependencies convention** (lines 6-31):
```json
  "scripts": {
    "dev": "vite",
    "build": "vite build && node scripts/check-build.mjs",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:coverage": "vitest run --coverage --passWithNoTests",
    "icons": "node scripts/generate-icons.mjs"
  },
```
- **Phase 17 pattern:** Add `"tokens": "node scripts/generate-tokens.mjs"` alongside `"icons"` so `knip` (`knip.json:24` includes `"scripts/**/*.mjs"`) recognizes `scripts/generate-tokens.mjs` as a live script entrypoint. Keep exact pinned versions (`saveExact: true`): `@material/web@2.5.0`, `@lit/react@1.0.8`, `@material-symbols/svg-400@0.48.3` in `"dependencies"` (since `knip --production` scans `src/main.tsx` and rejects `devDependencies` imported by `Icon.tsx`), and `@material/material-color-utilities@0.4.0`, `element-internals-polyfill@3.0.2` in `"devDependencies"`.

---

#### `eslint.config.js` (config, transform)
**Analog:** `eslint.config.js` (lines 91-132)

**Existing `apps/web` + import-fence pattern** (lines 91-132):
```js
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [jsxA11y.flatConfigs.strict, reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    // The service role bypasses RLS. Only main.ts and the owner CLI may build a privileged
    // client; everything else gets the narrow functions they hand out. Type-only imports carry no capability, so they are allowed.
    files: ['apps/service/src/**/*.ts'],
    ignores: [
      'apps/service/src/main.ts',
      'apps/service/src/cli.ts',
      'apps/service/src/privileged/**',
      'apps/service/src/**/*.test.ts',
      'apps/service/src/test/**',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/privileged/*'],
              allowTypeImports: true,
              message:
                'Service-role access is limited to the sanctioned uses; take the narrow function main.ts passes in.',
            },
          ],
        },
      ],
      // no-restricted-imports only sees static imports, so `await import('../privileged/…')`
      // would slip past the fence above.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression > Literal[value=/privileged/]',
          message:
            'Service-role access is limited to the sanctioned uses; take the narrow function main.ts passes in.',
        },
      ],
    },
  },
```
- **Phase 17 pattern:** Mirror the `apps/service/src/**/*.ts` fence for `apps/web/src/**/*.{ts,tsx}` (with `ignores: ['apps/web/src/components/md/**']`) banning `@material/web`, `@material/web/*`, `lit`, `lit/*`, `@lit/*` in both `@typescript-eslint/no-restricted-imports` and `no-restricted-syntax` (`ImportExpression`). Also inside `apps/web/src/components/md/**/*.{ts,tsx}` ban `@material/web/all.js` and `@material/web/labs/*`. In the `apps/web/**/*.{ts,tsx}` block, explicitly enable `'jsx-a11y/control-has-associated-label': ['error', { labelAttributes: ['label', 'aria-label', 'aria-labelledby'], controlComponents: ['Button', 'Checkbox', 'Switch', 'MdIconButton', 'MdFilledIconButton', 'MdFilledTonalIconButton', 'MdOutlinedIconButton', 'MdCheckbox', 'MdSwitch'] }]` and `'jsx-a11y/label-has-associated-control'` (because `jsxA11y.flatConfigs.strict` disables `control-has-associated-label`, and never map `Checkbox`/`Switch` to `'input'` in `settings['jsx-a11y'].components` because `ignoreElements` skips `'input'`).

---

#### `apps/web/index.html` (config, request-response)
**Analog:** `apps/web/index.html` (lines 1-19)

**Head meta pattern** (lines 1-14):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#475569" />
    <meta
      name="description"
      content="Deals, shopping lists, meals, bills, and chores for your household."
    />
    <link rel="icon" type="image/png" href="/icons/icon-192.png" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <title>Hestia</title>
  </head>
```
- **Phase 17 pattern:** Replace `#475569` with `<meta name="color-scheme" content="light dark" />`, `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff8f6" />`, `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a110e" />`. Keep `<title>Hestia</title>` verbatim (asserted by `apps/web/scripts/check-build.mjs:81`) and zero inline `<script>` tags (`docker/Caddyfile` strict `'self'` CSP).

---

#### `apps/web/vite.config.ts` (config, batch)
**Analog:** `apps/web/vite.config.ts` (lines 8-9, 75-113)

**Manifest & Vitest configuration pattern** (lines 8-9, 75-113):
```ts
// The Dashboard slate is the section-neutral color.
const THEME_COLOR = '#475569';
...
      manifest: {
        name: 'Hestia',
        short_name: 'Hestia',
        description: 'Deals, shopping lists, meals, bills, and chores for your household.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: THEME_COLOR,
        background_color: '#FFFFFF',
...
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts', '../../test/clock-setup.mjs'],
    globalSetup: ['../../test/global-tz.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test-setup.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { statements: 84, branches: 80, functions: 77, lines: 85 },
    },
  },
```
- **Phase 17 pattern:** Update `THEME_COLOR` (and `background_color`) to Warm Terracotta light surface `'#fff8f6'`. Split `test` into Vitest 5 `test.projects`: `unit` (`environment: 'node'`, `include: ['src/**/*.test.ts']`, `setupFiles: ['../../test/clock-setup.mjs']`) and `dom` (`environment: 'jsdom'`, `include: ['src/**/*.test.tsx']`, `resolve: { conditions: ['browser', 'development', 'import', 'module', 'default'] }`, `setupFiles: ['src/test-setup.ts', '../../test/clock-setup.mjs']`). Retain top-level `globalSetup` and `coverage.thresholds` (`84/80/77/85`), adding `src/test/**` or checking coverage inclusions cleanly.

---

#### `apps/web/scripts/generate-icons.mjs` & `apps/web/scripts/generate-tokens.mjs` (utility, file-I/O + transform)
**Analogs:** `apps/web/scripts/generate-icons.mjs` (lines 1-11, 71-75) & `apps/web/scripts/check-build.mjs` (lines 13-17)

**Script header, path resolution & write pattern** (`generate-icons.mjs` lines 1-11, 71-75; `check-build.mjs` lines 13-17):
```js
// Writes the placeholder PWA icons: a white "H" on the section-neutral slate, full-bleed so
// the same file works as a maskable icon. There is no app mark yet; replace these
// PNGs when there is one. Uses only Node built-ins so it adds no dependency.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const BACKGROUND = [0x47, 0x55, 0x69]; // #475569, the Dashboard slate
const FOREGROUND = [0xff, 0xff, 0xff];
const SIZES = [192, 512];
...
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(outDir, `icon-${String(size)}.png`), png(size));
}
```
```js
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const WEB = resolve(import.meta.dirname, '..');
```
- **Critical constraints:**
  1. Do **NOT** put a `#!/usr/bin/env node` shebang on `.mjs` scripts in `apps/web/scripts/` (`scripts/check-repo-hygiene.mjs:216-226` fails any file with `#!` that lacks git mode `100755`).
  2. Write `apps/web/src/styles/tokens.css` with pure LF (`\n`) line endings and note in `eslint.config.js:75` that `apps/web/scripts/*.mjs` is linted with Node globals.
  3. Because `@material/material-color-utilities@0.4.0` uses extensionless relative imports that fail raw Node ESM, `generate-tokens.mjs` should execute the generator module via `esbuild` (available in root `node_modules`) or Vite `ssrLoadModule`, computing `SchemeTonalSpot(Hct.fromInt(argbFromHex('#B4532A')), isDark, 0.0)` + `TonalPalette`-clamped harmonized semantic roles (`success: '#15803D'`, `warning: '#A16207'`, `info: '#0369A1'`) at `tone(40)`/`tone(80)`.
  4. In `generate-icons.mjs`, replace `BACKGROUND` `[0x47, 0x55, 0x69]` with Warm Terracotta (`[0xb4, 0x53, 0x2a]` or `[0x8e, 0x4c, 0x32]`) and regenerate `public/icons/icon-{192,512}.png`.

---

#### `apps/web/src/styles/tokens.css` & `apps/web/src/index.css` (config, transform)
**Analog:** `apps/web/src/index.css` (lines 1-114, 185-328, 373-394)

**Tailwind `@theme` + CSS custom-property theme pattern** (`index.css` lines 1-20, 78-113, 185-196, 259-268, 373-394):
```css
@import 'tailwindcss';

@theme {
  --color-*: initial;
  --text-*: initial;
  --radius-*: initial;
  --shadow-*: initial;

  --font-sans:
    ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
...
@theme inline {
  --color-base: var(--bg-base);
  --color-raised: var(--bg-raised);
  --color-border: var(--border);
  --color-input: var(--border-input);
  --color-primary: var(--text-primary);
  --color-secondary: var(--text-secondary);
  --color-muted: var(--text-muted);
  --color-overlay: var(--overlay);
...
}
```
```css
@layer base {
  body {
    @apply bg-base font-sans text-body text-primary antialiased;
  }

  :focus-visible {
    outline: 2px solid var(--section-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    ::before,
    ::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  }
}
```
- **Phase 17 pattern:**
  - `tokens.css` emits blocks in strict cascade order: `:root` (light + static `--md-ref-typeface-*`, `--md-sys-typescale-*`, `--md-sys-shape-corner-*`, `--md-sys-elevation-*`), `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ...dark tokens... } }`, `:root[data-theme='light']`, `:root[data-theme='dark']`.
  - `index.css` imports `./styles/tokens.css` and `./styles/gap-primitives.css`, preserves `@import 'tailwindcss';`, `@theme`, and `@theme inline` until Phase 21 (`FND-05`), deletes the 5 `--green-*`..`--slate-*` and `[data-section='*']` blocks, and maps `--bg-*`, `--border*`, `--text-*`, `--section*`, `--danger*`, `--warning*`, `--success*`, `--info*`, `--neutral-badge*` to `var(--md-sys-color-*)`.

---

#### `apps/web/src/tokens.test.ts` (test, file-I/O + transform)
**Analog:** `apps/web/src/tokens.test.ts` (lines 1-98)

**Disk CSS parser & contrast calculation pattern** (lines 1-69):
```ts
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest stubs CSS imports (even ?raw) to empty strings, so the token file is read from disk.
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

function declarations(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of source.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) map.set(name, value.trim());
  }
  return map;
}
```
- **Phase 17 pattern:** Keep the `/// <reference types="node" />`, `readFileSync`, `declarations`, `resolve`, `luminance`, `contrast`, and `describe.each` structure, reading `src/styles/tokens.css` (and `src/index.css` bridge) across light (`:root`), `@media (prefers-color-scheme: dark)`, `:root[data-theme='light']`, and `:root[data-theme='dark']`. Assert `>= 4.5` normal-text contrast on all 5 `surface-container-lowest`..`surface-container-highest` tiers for `on-surface`, `on-surface-variant`, `primary`, `error`, `success`, `warning`, `info`, plus container pairs and `>= 3.0` for `outline`. Because `tokens.test.ts` runs in the `node` Vitest project, it can also import `@material/material-color-utilities` (handled by Vite transform) to verify `tokens.css` matches seed `#B4532A` with zero drift.

---

### 2. `components/md/` Typed `@lit/react` Adapters

#### `apps/web/src/components/md/props.ts` (utility, transform)
**Analog:** `apps/web/src/lib/cn.ts` (lines 1-4) for pure-helper structure; `@lit/react` normalization from `17-RESEARCH.md` (lines 260-263, 423-425).

**Pure utility pattern** (`cn.ts` lines 1-4):
```ts
/** Joins class names, dropping falsy entries. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
```
- **Phase 17 pattern:** Export `omitUndefined<T extends Record<string, unknown>>(props: T)` with an explicit return type (`@typescript-eslint/explicit-module-boundary-types: 'error'`) and zero `as` casts (e.g., `Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined))` typed safely or via generic helper) so `exactOptionalPropertyTypes: true` optional props (`T | undefined`) satisfy `@lit/react`'s `ElementProps<I>` without `TS2375`.

#### `apps/web/src/components/md/Md{Button,TextField,Select,Checkbox,Switch,Radio,Dialog,Menu,Tabs,Progress}.tsx` (component, event-driven)
**Closest codebase conventions analog:** `apps/web/src/components/ui/Button.tsx` (lines 1-26) for TypeScript module structure; **component internals:** no existing analog (follow `17-RESEARCH.md` Section 2 & Code Example 1).

**Module convention to copy across all `components/md/*.tsx` files:**
- Named exports only (`export const MdFilledButton = createComponent(...)`).
- Explicit subpath ESM imports ONLY (`@material/web/button/filled-button.js`, never `all.js` or `labs/*`).
- Bind `react: React` (`import * as React from 'react'`) and custom DOM event maps (`events: { onInput: 'input', onChange: 'change', onClosed: 'closed', onCancel: 'cancel', ... }` matching each component's real events in `@material/web@2.5.0`).
- **Knip production rule:** Every exported `Md*` component in `components/md/` should be consumed by `components/ui/` in Phase 17 (or check `knip --production` before adding unused variants like `MdElevatedButton` / `MdLinearProgress` / `MdDivider`, and reconcile `MdRadio` needed for the `D-13` smoke test).

---

### 3. `components/ui/` Primitives (Upgraded & New)

#### `apps/web/src/components/ui/icon-paths.ts` & `apps/web/src/components/ui/Icon.tsx` (config/component, transform)
**Analogs:** `apps/web/src/lib/sections.ts` (lines 18-97), `apps/web/src/components/ui/Badge.tsx` (lines 13-38), `apps/web/src/components/ui/FormMessage.tsx` (lines 8-18)

**Typed lookup & icon rendering pattern** (`sections.ts` lines 18-40, `Badge.tsx` lines 13-37):
```ts
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-neutral-badge text-on-neutral-badge',
  personal: 'bg-neutral-badge text-on-neutral-badge',
  section: 'bg-section-badge text-on-section-badge',
  warning: 'bg-warning-badge text-on-warning-badge',
  danger: 'bg-danger-badge text-on-danger-badge',
};
```
```tsx
<CircleAlert aria-hidden size={20} strokeWidth={1.5} className="mt-px shrink-0" />
```
- **Phase 17 pattern:**
  - `icon-paths.ts`: Define `export type IconName = ...` string union (never TypeScript `enum`, per `.claude/CLAUDE.md:202`) covering all ~54 Hestia icons sourced from `@material-symbols/svg-400/rounded/*.svg` (`?raw` imports or pre-extracted `<path d="...">` strings), plus `FILLED_ICON_PATHS` (`Partial<Record<IconName, string>>`) for active/selected states (`D-07`).
  - `Icon.tsx`: Export `IconProps` (`name: IconName`, `filled?: boolean | undefined`, `size?: number | undefined`, `className?: string | undefined`) and `export function Icon({ name, filled = false, size = 20, className }: IconProps): ReactElement` rendering `<svg viewBox="0 -960 960 960" width={size} height={size} fill="currentColor" aria-hidden="true" className={cn('shrink-0', className)}><path d={path} /></svg>`. Zero `dangerouslySetInnerHTML`, zero WOFF2 font precache weight, compatible with `container.querySelector('svg')` + `aria-hidden="true"` assertions in existing tests (`primitives.test.tsx:166,172`, `meal-components.test.tsx:60`).

---

#### `apps/web/src/components/ui/Button.tsx` (component, event-driven)
**Analog:** `apps/web/src/components/ui/Button.tsx` (lines 1-95)

**Core prop, `disabledReason`, `isLoading`, and `BUTTON_BASE` contract to copy** (lines 11-26, 42-95):
```tsx
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Square 44×44 button for a lone icon; it must carry an `aria-label`. */
  isIconOnly?: boolean;
  /** An async action is in flight: the button is busy and ignores presses. */
  isLoading?: boolean;
  disabledReason?: string | undefined;
  ref?: Ref<HTMLButtonElement>;
}
```
```tsx
export const BUTTON_BASE =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md text-body font-semibold transition-colors duration-150 ease-out select-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50';
```
```tsx
  const reasonId = useId();
  const isUnavailable = Boolean(disabledReason) || isLoading;

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (isUnavailable) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
```
- **Phase 17 pattern & caller discoveries:**
  1. Preserve `BUTTON_BASE` export (still imported by `apps/web/src/components/shell/TopBar.tsx:4` for React Router `<Link>` until Phase 18!).
  2. Default `type = 'button'` (critical: `@material/web`'s `mixinFormSubmitter` defaults omitted `type` to `'submit'`).
  3. Map variants to `<MdFilledButton>` (`primary`, plus `destructive` styled via `--md-filled-button-container-color: var(--md-sys-color-error); --md-filled-button-label-text-color: var(--md-sys-color-on-error)`), `<MdOutlinedButton>` (`secondary`), `<MdTextButton>` (`ghost`), and `<MdIconButton>` (`isIconOnly`).
  4. Forward `softDisabled={isUnavailable}`, `aria-disabled={isUnavailable || undefined}`, `aria-busy={isLoading || undefined}`, and `aria-describedby={disabledReason ? reasonId : rest['aria-describedby']}` to the MD button host, AND short-circuit React `onClick` with `if (isUnavailable) { event.preventDefault(); event.stopPropagation(); return; }` (shadow `<button>` clicks bubble to React even when `softDisabled` is true).
  5. Preserve `ref` forwarding (`IngredientRow.tsx:127,142,153`, `ChangeEmailForm.tsx:76`, `ChangePasswordForm.tsx:71` call `ref.current?.focus()` on `<Button>`).
  6. Replace `<LoaderCircle>` with `<MdCircularProgress indeterminate />` (aria-hidden) when `isLoading`, and preserve `<span id={reasonId}>{disabledReason}</span>` layout wrapper.

---

#### `apps/web/src/components/ui/Field.tsx`, `DateField.tsx`, `TimeField.tsx` (component, event-driven)
**Analog:** `apps/web/src/components/ui/Field.tsx` (lines 11-140)

**ID linkage, error, hint & `disabledReason` contract to copy** (lines 11-70):
```tsx
interface FieldMessages {
  label: string;
  /** Helper text shown up front, e.g. "At least 8 characters". */
  hint?: string | undefined;
  /** Error message; turns the field into its error state. */
  error?: string | undefined;
  /** Why the field is unavailable ("Needs a connection."); disables it. */
  disabledReason?: string | undefined;
}
```
```tsx
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const hintId = hint ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const reasonId = disabledReason ? `${baseId}-reason` : undefined;
  const describedBy = [hintId, errorId, reasonId].filter(Boolean).join(' ') || undefined;
```
- **Phase 17 pattern & caller discoveries:**
  1. `TextField` / `TextAreaField`: Render `<MdOutlinedTextField>` (with `type="textarea"` and `rows` for `TextAreaField`) forwarding `label`, `value`, `disabled={disabled ?? Boolean(disabledReason)}`, `maxLength` (used in `CreateHouseholdStep.tsx:76`, `JoinHouseholdStep.tsx:117`, `HouseholdSettingsSection.tsx:93`), `inputMode`, `autoComplete`, `name`, `error={isInvalid}`, `errorText={error ?? ''}`, `supportingText={supportingText}` — **AND** forward `aria-invalid={isInvalid || undefined}` on `<MdOutlinedTextField>` host so `useFieldErrors` (`formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()` in `apps/web/src/lib/use-field-errors.ts:22`) locates and focuses the host (`MdOutlinedTextField.focus()` delegates into shadow `<input>`).
  2. **CRITICAL caller bridge for `type="date"` and `type="time"`:** 6 existing files (`BillForm.tsx:220`, `PaymentEditSheet.tsx:59`, `RecurrenceFields.tsx:76`, `ErrandSheet.tsx:114`, `PlaceOnPlannerSheet.tsx:68`, `NotificationsSection.tsx:116,127`) currently render `<TextField type="date" ... />` and `<TextField type="time" ... />`. Because `<md-outlined-text-field>` only supports text/email/number/password/search/tel/url/textarea, either have `TextField` delegate `type === 'date'` -> `<DateField>` and `type === 'time'` -> `<TimeField>` (which also ensures `DateField.tsx` / `TimeField.tsx` are live in the `knip --production` graph!) OR update those 6 callers. Delegating inside `Field.tsx` preserves 100% caller compatibility (`D-09`) while exposing `DateField` and `TimeField` directly for Phases 18–20.
  3. `DateField.tsx` & `TimeField.tsx`: Copy `FieldFrame` from `Field.tsx:31-70` (using `<Icon name="error" />` instead of `<CircleAlert>`) and render native `<input type="date">` / `<input type="time">` framed to match `<md-outlined-text-field>` (`min-h-14` `56px`, `rounded-xs` `4px`, `16px` input text to prevent iOS Safari zoom, `--md-sys-color-outline` / `2px --md-sys-color-primary` on focus / `2px --md-sys-color-error` on invalid, `aria-invalid={isInvalid || undefined}`, `aria-describedby={describedBy}`). Keep `FieldFrame` exported from `Field.tsx` for `Select.tsx`, `DateField.tsx`, and `TimeField.tsx`.

---

#### `apps/web/src/components/ui/Select.tsx` (component, event-driven)
**Analog:** `apps/web/src/components/ui/Select.tsx` (lines 8-102)

**Coarse-pointer external-store & fallback pattern** (lines 26-39, 60-101):
```tsx
const COARSE_POINTER = '(pointer: coarse)';

function subscribeToPointer(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function isCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COARSE_POINTER).matches;
}
```
```tsx
  const isNative = useSyncExternalStore(subscribeToPointer, isCoarsePointer, () => false);
  const isDisabled = disabled ?? Boolean(disabledReason);
```
- **Phase 17 pattern:**
  1. Preserve `SelectOption`, `SelectProps`, and the `(pointer: coarse)` native `<select>` branch (styled `56px` outlined to match MD3 outlined fields, swapping `<ChevronDown>` with `<Icon name="expand_more" />`).
  2. Replace the desktop `RadixSelect` branch (lines 103-145) with `<MdOutlinedSelect menuPositioning="fixed" ...>` (NOT `positioning="fixed"`, which `md-select` ignores!) + `<MdSelectOption value={option.value} selected={option.value === value}>` children, mapping `change` -> `onValueChange(event.currentTarget.value)` and forwarding `aria-invalid={isInvalid || undefined}` for `useFieldErrors`.

---

#### `apps/web/src/components/ui/Checkbox.tsx` & `apps/web/src/components/ui/Switch.tsx` (component, event-driven)
**Analog:** `apps/web/src/components/ui/Checkbox.tsx` (lines 5-54)

**Full-row tap target & prop contract to copy** (lines 5-35, 50-53):
```tsx
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  /** In-list rows make the whole row the tap target. */
  variant?: 'default' | 'in-list';
  /** Extra row content beside the label, such as price or quantity. */
  detail?: ReactNode;
}
```
```tsx
  const isInList = variant === 'in-list';
  return (
    <label
      className={cn(
        'group flex min-h-11 items-center gap-3 text-body text-primary',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        isInList && 'w-full px-4 py-3 hover:bg-raised active:bg-section-tint',
        className,
      )}
    >
```
- **Phase 17 pattern & caller discoveries:**
  1. **Critical caller requirement:** `FavoriteStores.tsx:125`, `ShoppingListRow.tsx:97`, and `ErrandRow.tsx:73` pass `onChange={(event) => { fn(event.target.checked); }}` AND `ErrandRow.tsx:69,76` passes `label=""` with `aria-label="Mark ... as done"`. Keep `<label>` wrapping `<MdCheckbox>` (and visible `label` / `detail` when non-empty), forward `aria-label` when `rest['aria-label']` is provided (or derive string label for `MdCheckbox`), map `MdCheckbox`'s `change` event so `event.target.checked` remains typed and accurate, and support `indeterminate`.
  2. **`Switch.tsx`:** Copy `Checkbox.tsx`'s `<label>` wrapper, `variant?: 'default' | 'in-list'`, `detail?: ReactNode`, `disabled?: boolean | undefined` contract, wrapping `<MdSwitch selected={checked} ...>` (NEVER pass `checked` to `md-switch` — it reads `.selected`) and normalizing both `onInput` and `onChange` from `event.currentTarget.selected`. Enforce explicit accessible labels (`aria-label` or visible `<label>` text; note `knip --production` check if no screen imports `Switch.tsx` until Phase 19/20).

---

#### `apps/web/src/components/ui/ConfirmDialog.tsx` (component, event-driven)
**Analog:** `apps/web/src/components/ui/ConfirmDialog.tsx` (lines 7-74) & `apps/web/src/screens/settings/DeleteHouseholdPanel.tsx` (lines 66-87)

**AlertDialog prop, children, and loading contract to copy** (`ConfirmDialog.tsx` lines 7-37, 52-69):
```tsx
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Names the consequence. */
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  /** Extra content, such as the typed-name field for household deletion. */
  children?: ReactNode;
  isConfirmDisabled?: boolean;
  isConfirming?: boolean;
}
```
- **Phase 17 pattern:**
  1. Replace `Radix AlertDialog` with `<MdDialog type="alert" open={open}>`, keeping `headline` slot (`{title}`), `content` slot (`{description}` + `{children}` such as `DeleteHouseholdPanel`'s `<TextField>`), and `actions` slot (Cancel `<Button variant="secondary" autoFocus ...>` + destructive `<Button variant="destructive" disabled={isConfirmDisabled} isLoading={isConfirming} onClick={onConfirm}>{confirmLabel}</Button>`).
  2. Synchronize open state via `closed` AND `cancel` events. To preserve *"cannot be dismissed by an outside click"* (`ConfirmDialog.tsx:24-25`), track non-Escape `cancel` events (or call `event.preventDefault()` on scrim clicks inside `onCancel`, distinguishing Escape keydown vs outside click) so backdrop clicks never close `ConfirmDialog`.

---

#### `apps/web/src/components/ui/OverflowMenu.tsx` (component, event-driven)
**Analog:** `apps/web/src/components/ui/OverflowMenu.tsx` (lines 8-70)

**Item, trigger, and `disabledReason` contract to copy** (lines 8-30, 56-65):
```tsx
export interface OverflowMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  isDestructive?: boolean;
  isDisabled?: boolean;
  disabledReason?: string | undefined;
}

export interface OverflowMenuProps {
  /** Names what the menu acts on, e.g. "More actions for Rent". */
  label: string;
  items: readonly OverflowMenuItem[];
}
```
- **Phase 17 pattern:** Use a unique `useId()` trigger ID linking `<MdIconButton id={anchorId} aria-label={label} onClick={...}><Icon name="more_vert" /></MdIconButton>` to `<MdMenu positioning="fixed" anchor={anchorId} open={isOpen} onClosed={() => setIsOpen(false)}>` with `<MdMenuItem>` rows. Preserve `isDestructive`, `(item.isDisabled ?? false) || item.disabledReason !== undefined` disabled state, and inline `disabledReason` subtitle inside `<MdMenuItem>`.

---

#### `apps/web/src/components/ui/Tabs.tsx` (component, event-driven)
**Analog:** `apps/web/src/components/ui/Tabs.tsx` (lines 4-58)

**Scroll-into-view & tab items pattern to copy** (lines 4-30):
```tsx
export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  label: string;
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
}
```
```tsx
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-state="active"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);
```
- **Phase 17 pattern:** Wrap `<MdTabs aria-label={label} activeTabIndex={activeIndex} onChange={...}>` with `<MdPrimaryTab>` children (matching `shrink-0` natural label width for 7-day planner strips) and render the active panel (`role="tabpanel"`) linked by `id` / `aria-controls` / `aria-labelledby`. Update the `useEffect` selector to target the active tab (`[active]` or `tabs[activeIndex]`) so `scrollIntoView({ block: 'nearest', inline: 'nearest' })` continues to fire on programmatic and keyboard selection (`primitives.test.tsx:279-296`).

---

#### `apps/web/src/components/ui/ModalBottomSheet.tsx` & `apps/web/src/components/ui/Sheet.tsx` (component, event-driven)
**Analog:** `apps/web/src/components/ui/Sheet.tsx` (lines 7-58)

**`SheetProps` & focus-restoration contract to copy** (`Sheet.tsx` lines 7-28, 40-54):
```tsx
export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The element that opens the sheet; focus returns to it on close. */
  trigger?: ReactNode;
  children: ReactNode;
}
```
- **Phase 17 pattern:** Implement `ModalBottomSheet` over native `<dialog className="hestia-sheet" closedby="any" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}>` (no redundant `role="dialog"` or `aria-modal="true"`), driven via `showModal()`/`close()` in `useEffect`, capturing/restoring `previousFocusRef.current`, resetting `dialog.returnValue = ''`, adding Safari/jsdom `!('closedBy' in HTMLDialogElement.prototype)` `pointerdown`+`pointerup` outside-rect fallback, and rendering an accessible `aria-label="Close"` `<Button variant="ghost" isIconOnly>` (`<Icon name="close" />`). Keep `Sheet.tsx` wrapping `ModalBottomSheet` (handling optional `trigger`) so all existing `Sheet` callers (`HouseholdSwitcher`, `PaymentEditSheet`, `ErrandSheet`, `ListPickerSheet`, `MatchToSheet`, `MealPlacementSheet`, `PlaceOnPlannerSheet`, `AddToList`, `ListNameSheet`) stay unchanged.

---

#### `apps/web/src/components/ui/Toast.tsx` (Snackbar provider/component, event-driven)
**Analog:** `apps/web/src/components/ui/Toast.tsx` (lines 14-115)

**Exported types, context & bottom-offset layout to copy** (lines 14-48, 100-115):
```tsx
export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  /** e.g. Undo. */
  action?: ToastAction;
}
```
```tsx
export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
```
- **Phase 17 pattern (`D-11`):**
  1. Replace `RadixToast` with a light-DOM `Snackbar` slot rendering ONLY `queue[0]` (`activeToast`) backed by a sequential FIFO queue (`setQueue((q) => [...q, entry])`, `dismissActive` shifts `q.slice(1)`).
  2. Update `toastDuration(toast)` (`Toast.tsx:36-39`): return `Number.POSITIVE_INFINITY` whenever `toast.variant === 'error' || toast.action !== undefined`, and `4000` for non-action `success`/`info`. Run `setTimeout` only when `Number.isFinite(duration)`!
  3. Style with MD3 snackbar tokens (`inverseSurface`, `inverseOnSurface`, `inversePrimary` for action button, `max-w-[70ch]`, `bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4`), replacing Lucide icons with `<Icon name="check_circle" | "error" | "info" | "close" />`. Preserve `aria-label="Dismiss"` on the Close button and `role={toast.variant === 'error' ? 'alert' : 'status'}` on the message container.

---

#### `apps/web/src/components/ui/Card.tsx`, `ListRow.tsx`, `Badge.tsx`, `SegmentedControl.tsx`, `Skeleton.tsx`, `FormMessage.tsx`, `CopyButton.tsx`
**Analogs:** Their existing files in `apps/web/src/components/ui/` (exact match on exported interfaces and DOM contracts):
- **`Card.tsx` (lines 4-26):** Keep `CardProps` (`variant?: 'flat' | 'raised'`, `as?: 'div' | 'section' | 'article' | 'li'`). Switch surface to borderless `surfaceContainerLow` (`12px` radius, `16px` padding; `raised` uses `surfaceContainer` + `--md-sys-elevation-1` and retains `shadow-sm` or equivalent test assertion — check `primitives.test.tsx:189-190`!). Add `@media (forced-colors: active)` `1px solid CanvasText` hairline in `gap-primitives.css`.
- **`ListRow.tsx` (lines 4-55):** Keep `ListRowProps` (`title`, `description`, `leading`, `trailing`, `onSelect`, `isCurrent`, `isDisabled`, `className`). Update classes to MD3 `min-h-12` (`48px`), `onSurface`/`onSurfaceVariant` colors, and state-layer hover/active backgrounds.
- **`Badge.tsx` (lines 5-39):** Keep `BadgeVariant`, `BadgeProps`, and `'Personal'` fallback copy. Replace `CircleAlert` / `User` with `<Icon name="error" size={14} />` / `<Icon name="person" size={14} />` (`svg[aria-hidden="true"]`), and bind tonal colors to `surfaceContainerHigh`/`onSurfaceVariant` (`neutral`/`personal`), `secondaryContainer`/`onSecondaryContainer` (`section`), `warningContainer`/`onWarningContainer` (`warning`), `errorContainer`/`onErrorContainer` (`danger`).
- **`SegmentedControl.tsx` (lines 4-50):** Replace `Radix ToggleGroup` with pure light-DOM `role="radiogroup"` (`aria-label={label}`) containing `<button type="button" role="radio" aria-checked={isSelected} tabIndex={isFocused ? 0 : -1}>` segments + roving `ArrowLeft`/`ArrowRight`/`Home`/`End` keyboard handler (preventing deselection when clicking/pressing Enter on the active segment, keeping `primitives.test.tsx:240-252` intact!). Style as MD3 full-pill outlined segmented buttons (`--md-sys-shape-corner-full`, `secondaryContainer` active fill, leading `<Icon name="check" />` on active segment).
- **`Skeleton.tsx` (lines 1-36):** Keep `Skeleton`, `SkeletonRows`, `SkeletonRowsProps`, `useDelayedVisible(delayMs)`, `<div role="status" aria-busy="true">`, and `data-testid="skeleton-row"`, updating placeholder fill from `bg-border` to `--md-sys-color-surface-container-highest`.
- **`FormMessage.tsx` (lines 8-19):** Preserve exact `<div role="alert">{message !== undefined && <p ...><Icon name="error" size={20} /><span className="max-w-[70ch]">{message}</span></p>}</div>` DOM hierarchy (`e2e/tests/17-accessibility-states.spec.ts:117,159` asserts `page.getByRole('alert').locator('p')`).
- **`CopyButton.tsx` (lines 6-42):** Preserve `CopyButtonProps` and error toast copy (`"Could not copy. Select the text and copy it by hand."`), replacing `<Copy>` with `<Icon name="content_copy" size={20} />`.

---

### 4. Test Infrastructure & Affected Tests

#### `apps/web/src/test-setup.ts` (config, event-driven)
**Analog:** `apps/web/src/test-setup.ts` (lines 1-28)

**Existing setup & global-shim pattern** (lines 1-28):
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}));

globalThis.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;

afterEach(() => {
  cleanup();
});
```
- **Phase 17 pattern:** Add unconditional `element-internals-polyfill` initialization at the top (before any `@material/web` import registers custom elements), plus `Element.prototype.animate` shim (resolved `finished` promise), `globalThis.IntersectionObserver` stub, and `HTMLDialogElement.prototype.showModal` / `close` shims (`setAttribute('open', '')` / `removeAttribute('open')` + `dispatchEvent(new Event('close'))`). *(Check exact exported symbol in `element-internals-polyfill@3.0.2/dist/index.d.ts` after install.)*

---

#### `apps/web/src/test/md-queries.ts` & `apps/web/src/test/browser.ts` (utility, transform/event-driven)
**Analogs:** `apps/web/src/test/browser.ts` (lines 1-73) & `apps/web/src/test/harness.tsx` (lines 25-29)

**Test-helper JSDoc & `openMenu` pattern** (`browser.ts` lines 13-33, 68-73):
```ts
/** Both halves of "offline": the banner reads `navigator`, the queue reads TanStack's manager. */
export function setOnline(isOnline: boolean): void {
  ...
}

/** Opens an overflow menu from the keyboard, as the lists tests do: a pointer click does not open a Radix menu under jsdom. */
export async function openMenu(user: UserEvent, triggerName: string): Promise<void> {
  const trigger = await screen.findByRole('button', { name: triggerName });
  trigger.focus();
  await user.keyboard('{Enter}');
}
```
- **Phase 17 pattern:**
  - Create `apps/web/src/test/md-queries.ts` centralizing shadow-aware host queries (`findMdButton`, `getMdButton`, `queryMdButton`, `getMdField`, `getMdCheckbox`, `getMdSwitch`, `getMdMenuItem`, `getMdTab`, `getMdDialog`, etc.) that return the custom-element host (`<md-filled-button>`, `<md-outlined-text-field>`, `<md-checkbox>`, etc.) so `.closest('li')`, `.focus()`, `toHaveAttribute('aria-disabled', 'true')`, `toHaveAccessibleDescription(...)` continue working cleanly while avoiding duplicate Shadow DOM traversal snippets that would trip `.jscpd.json` (`threshold: 5`).
  - Update `openMenu` in `apps/web/src/test/browser.ts:69-73` to locate `<md-icon-button>` host via `md-queries.ts` (and keep `stubCoarsePointer()` unchanged so `<Select>` tests on coarse pointer remain light-DOM `<select>`).

---

#### `apps/web/src/components/ui/primitives.test.tsx`, `Toast.test.tsx`, `chores.test.tsx`, and Affected `.test.tsx` Suites
**Analogs:**
- `apps/web/src/components/ui/Toast.test.tsx` (lines 33-84)
- `apps/web/src/screens/chores/chores.test.tsx` (lines 308-340)
- `apps/web/src/components/ui/primitives.test.tsx` (lines 25-398)
- `apps/web/src/components/meals/meal-components.test.tsx` (lines 175-192) & `apps/web/src/screens/lists/lists.test.tsx` (lines 94-120)

**Test update targets verified directly in source:**
1. **`Toast.test.tsx:33-71`:** Update `toastDuration` assertion for `action: { label: 'Undo' }` from `5000` to `Number.POSITIVE_INFINITY` (`D-11`), replace Radix `queryAllByRole('listitem')` checks with snackbar `role="status"` / text checks, and add tests for sequential FIFO queue promotion (`queue[0]` shown, `queue[1]` appears only after `queue[0]` dismisses/times out).
2. **`chores.test.tsx:308-340`:** Rewrite `'the completion toast holds Undo for five seconds, then lets it go'` to assert the Undo snackbar remains visible after advancing `5500ms` until dismissed (`aria-label="Dismiss"`) or `Undo` is clicked (`D-11`).
3. **`primitives.test.tsx`:** Add the 5 `D-13` smoke checks (`useFieldErrors` focusing invalid `<md-outlined-text-field>` host, `md-checkbox`/`md-switch` toggling, `md-radio` `setValidity` coercion, `<md-dialog>` `Escape`/`closed` + `ModalBottomSheet` `<dialog>.showModal()` focus restoration, `<md-outlined-select menuPositioning="fixed">` value selection) plus `Icon` (`filled`), `DateField`, `TimeField`, and `Switch` coverage to satisfy `84/80/77/85` thresholds.
4. **Affected screen/component `.test.tsx` files:** Audit and update `ByRole('button'|'textbox'|'checkbox'|'menuitem'|'tab'|'alertdialog')` and `ByLabelText(...)` queries targeting upgraded `components/ui/` Shadow DOM controls to use `apps/web/src/test/md-queries.ts` (note: **never** add redundant `role="button"`/`role="checkbox"`/`role="textbox"` onto `<md-*>` hosts!). Remember the test clock fence (`eslint.config.js:145-160`): never write bare `new Date()` or `Date.now()` in `test/md-queries.ts`, `test-setup.ts`, or any `*.test.*` file.

---

## Shared Patterns

### 1. Strict TypeScript, `exactOptionalPropertyTypes` & Export Style
**Source:** `tsconfig.base.json:8-22`, `apps/web/tsconfig.json:8`, `apps/web/src/components/ui/Button.tsx:11-56`
**Apply to:** All `apps/web/src/components/md/*`, `apps/web/src/components/ui/*`, and `apps/web/src/test/md-queries.ts`
```ts
// Explicit `.ts`/`.tsx` extensions, `import type`, named exports only, explicit return types,
// `| undefined` on optional props, string unions instead of enums, zero `as any` or non-test casts.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  disabledReason?: string | undefined;
}

export function Button({ ... }: ButtonProps): ReactElement { ... }
```

### 2. ESLint Import Boundary & A11y Control Enforcement
**Source:** `eslint.config.js:91-132` (adapted for `apps/web/src`)
**Apply to:** `eslint.config.js`, enforced across all `apps/web/src/**/*.{ts,tsx}`
- Block static and dynamic (`ImportExpression`) imports of `@material/web`, `@material/web/*`, `lit`, `lit/*`, `@lit/*` outside `apps/web/src/components/md/`.
- Block `@material/web/all.js` and `@material/web/labs/*` inside `apps/web/src/components/md/`.
- Enable `'jsx-a11y/control-has-associated-label': ['error', ...]` alongside `'jsx-a11y/label-has-associated-control'` with custom `controlComponents` (never aliasing `Checkbox`/`Switch` to `'input'`).

### 3. `useFieldErrors` Host `aria-invalid` & Focus Delegation
**Source:** `apps/web/src/lib/use-field-errors.ts:15-31`
**Apply to:** `TextField`, `TextAreaField`, `Select`, `DateField`, `TimeField`
```ts
useEffect(() => {
  if (attempt === 0) return;
  formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}, [attempt, errors]);
```
- Every form-field primitive must expose `aria-invalid={isInvalid || undefined}` on the light-DOM `<input>`/`<select>` or `<md-*>` host element (and ensure `.focus()` reaches the editable input) because `querySelector` cannot pierce Shadow DOM.

### 4. `knip`, `jscpd`, and `check-repo-hygiene.mjs` CI Gates
**Source:** `knip.json:22-25`, `scripts/check-knip-baseline.mjs`, `.jscpd.json:1-9`, `scripts/check-repo-hygiene.mjs:216-232`, `.gitattributes:1`
**Apply to:** All Phase 17 created/modified files
- **`knip` & `knip --production`:** Every new module/export in `apps/web/src/components/md/` and `apps/web/src/components/ui/` (including `Switch.tsx`, `MdRadio.tsx`, `DateField.tsx`, `TimeField.tsx`) must either be imported from `apps/web/src/main.tsx` production graph (or reconciled cleanly before merge), and `apps/web/scripts/generate-tokens.mjs` must be referenced in `apps/web/package.json` `"scripts"`.
- **`jscpd` (`threshold: 5`, `minTokens: 60`, `minLines: 8`):** Extract repeated `@lit/react` wrapper boilerplate, field framing (`FieldFrame`), and Shadow DOM test helpers (`apps/web/src/test/md-queries.ts`) into shared helpers rather than copy-pasting blocks across components or test files.
- **Repo hygiene:** Pure LF (`\n`) line endings in every file (including generated `tokens.css`), and zero `#!` shebang lines on `.mjs` scripts lacking `100755` git mode.

### 5. Test Clock Fence & CSP Safety
**Source:** `eslint.config.js:139-160`, `apps/web/scripts/check-build.mjs:57-126`
**Apply to:** All `*.test.{ts,tsx}`, `test-setup.ts`, `test/md-queries.ts`, `index.html`, `tokens.css`, `Icon.tsx`
- Never use bare `new Date()` / `Date.now()` in test code or helpers (`vi.useFakeTimers({ shouldAdvanceTime: true })` or explicit ISO instants).
- Keep zero inline `<script>` tags (`index.html`), zero external CDN URLs (`check-build.mjs:106`), `<title>Hestia</title>` verbatim, and verify `pnpm --filter @hestia/web build` stays under the `200 KB` gzipped app shell budget (`check-build.mjs:19`).

---

## No Analog Found

Files/mechanisms with no direct implementation analog in the existing codebase (planner should follow `17-RESEARCH.md` & `17-UI-SPEC.md` patterns while adhering to Shared Patterns above):

| File / Mechanism | Role | Data Flow | Reason & Reference |
|---|---|---|---|
| `apps/web/src/components/md/MdButton.tsx` | component | event-driven | First `@lit/react` + `@material/web` adapter (`17-RESEARCH.md` §2, Code Example 1; `type="button"` default, `softDisabled` click guard) |
| `apps/web/src/components/md/MdTextField.tsx` | component | event-driven | First `@lit/react` outlined text field adapter (`17-RESEARCH.md` §2; host `aria-invalid`, `input`/`change` mapping) |
| `apps/web/src/components/md/MdSelect.tsx` | component | event-driven | First `@lit/react` select adapter (`17-RESEARCH.md` §2; `menuPositioning="fixed"`, NOT `positioning="fixed"`) |
| `apps/web/src/components/md/MdCheckbox.tsx` | component | event-driven | First `@lit/react` checkbox adapter (`17-RESEARCH.md` §2, §4) |
| `apps/web/src/components/md/MdSwitch.tsx` | component | event-driven | First `@lit/react` switch adapter (`17-RESEARCH.md` §2; `.selected` prop instead of `checked`) |
| `apps/web/src/components/md/MdRadio.tsx` | component | event-driven | First `@lit/react` radio adapter (`17-RESEARCH.md` §2, `D-13` `setValidity` smoke check) |
| `apps/web/src/components/md/MdDialog.tsx` | component | event-driven | First `@lit/react` dialog adapter (`17-RESEARCH.md` §2; `closed`/`cancel` state sync, backdrop lock) |
| `apps/web/src/components/md/MdMenu.tsx` | component | event-driven | First `@lit/react` menu adapter (`17-RESEARCH.md` §2; `positioning="fixed"`, `anchor` ID) |
| `apps/web/src/components/md/MdTabs.tsx` | component | event-driven | First `@lit/react` tabs adapter (`17-RESEARCH.md` §2, §4; `activeTabIndex`, `change` sync) |
| `apps/web/src/components/md/MdProgress.tsx` | component | event-driven | First `@lit/react` circular progress adapter (`17-RESEARCH.md` §2, §3; `indeterminate` button spinner) |
| `apps/web/src/styles/gap-primitives.css` | config | transform | First native `<dialog>.showModal()` top-layer CSS (`closedby="any"`, `dialog:modal`, `dialog::backdrop`, `@starting-style`, `overscroll-behavior: contain` — `17-RESEARCH.md` Code Example 4) |

---

## Metadata

**Analog search scope:** `apps/web/src/components/ui/*`, `apps/web/src/components/shell/*`, `apps/web/src/components/bills/*`, `apps/web/src/components/chores/*`, `apps/web/src/components/errands/*`, `apps/web/src/components/lists/*`, `apps/web/src/components/meals/*`, `apps/web/src/screens/*`, `apps/web/src/lib/*`, `apps/web/src/test/*`, `apps/web/scripts/*`, root configs (`eslint.config.js`, `package.json`, `tsconfig.base.json`, `knip.json`, `.jscpd.json`, `scripts/*`), and `e2e/*`.
**Files scanned:** 40+ source, test, config, and script files read directly; full `apps/web/src` import/query census run via `git grep` & `git ls-files`.
**Pattern extraction date:** 2026-11-12
