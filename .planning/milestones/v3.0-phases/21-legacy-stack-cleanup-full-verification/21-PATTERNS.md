# Phase 21: Legacy Stack Cleanup & Full Verification - Pattern Map

**Mapped:** 2026-11-15  
**Files analyzed:** 24  
**Analogs found:** 24 / 24  

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/styles/reset.css` | config / stylesheet | request-response | `apps/web/src/styles/gap-primitives.css` | exact |
| `apps/web/src/styles/layout.css` | config / stylesheet | request-response | `apps/web/src/styles/gap-primitives.css` | exact |
| `apps/web/src/styles/meals.css` | config / stylesheet | request-response | `apps/web/src/styles/gap-primitives.css` | exact |
| `apps/web/src/styles/bills.css` | config / stylesheet | request-response | `apps/web/src/styles/gap-primitives.css` | exact |
| `apps/web/src/styles/chores.css` | config / stylesheet | request-response | `apps/web/src/styles/gap-primitives.css` | exact |
| `apps/web/src/styles/deals.css` | config / stylesheet | request-response | `apps/web/src/styles/gap-primitives.css` | exact |
| `apps/web/src/styles/lists.css` | config / stylesheet | request-response | `apps/web/src/styles/gap-primitives.css` | exact |
| `apps/web/src/styles/settings.css` | config / stylesheet | request-response | `apps/web/src/styles/gap-primitives.css` | exact |
| `apps/web/src/index.css` | config / stylesheet | request-response | `apps/web/src/index.css` | exact |
| `apps/web/package.json` | config | batch | `apps/web/package.json` | exact |
| `apps/web/vite.config.ts` | config | batch | `apps/web/vite.config.ts` | exact |
| `knip.json` | config | batch | `knip.json` | exact |
| `scripts/knip-production-baseline.txt` | config / data | batch | `scripts/knip-production-baseline.txt` | exact |
| `.jscpd.json` | config | batch | `.jscpd.json` | exact |
| `apps/web/src/lib/sections.ts` | utility | request-response | `apps/web/src/lib/sections.ts` | exact |
| `apps/web/src/components/states/StaleNotice.tsx` | component | request-response | `apps/web/src/components/states/StateBlocks.tsx` | exact |
| `apps/web/src/components/states/ComingSoon.tsx` | component | dead-code | `apps/web/src/components/states/ComingSoon.tsx` | exact (delete) |
| `apps/web/src/components/ui/Icon.tsx` | component | request-response | `apps/web/src/components/ui/Icon.tsx` | exact |
| `apps/web/scripts/generate-icon-paths.mjs` | utility / script | batch | `apps/web/scripts/generate-icon-paths.mjs` | exact |
| `apps/web/scripts/check-build.mjs` | utility / script | batch | `apps/web/scripts/check-build.mjs` | exact |
| `e2e/support/axe.ts` | utility / test | request-response | `e2e/support/axe.ts` | exact |
| `e2e/support/app.ts` | utility / test | request-response | `e2e/support/app.ts` | exact |
| `e2e/tests/17-accessibility-states.spec.ts` | test | request-response | `e2e/tests/17-accessibility-states.spec.ts` | exact |
| `apps/web/src/tokens.test.ts` | test | batch | `apps/web/src/tokens.test.ts` | exact |

---

## Pattern Assignments

### 1. `apps/web/src/styles/reset.css` & `apps/web/src/styles/layout.css` (config / stylesheet)

**Analog:** `apps/web/src/styles/gap-primitives.css` (lines 70-103) & `apps/web/src/index.css` (lines 171-193)

**Imports / Token Binding Pattern:**
Domain and utility stylesheets do not import CSS files directly; they assume `--md-sys-*` and `--md-ref-*` tokens are declared in root context by `tokens.css`.
```css
/* apps/web/src/styles/gap-primitives.css:11-16 */
dialog.hestia-sheet {
  border-radius: 28px 28px 0 0;
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  box-shadow: var(--md-sys-elevation-1);
}
```

**Foundational Reset Pattern (`reset.css`):**
Extracted from `index.css:171-193` without `@layer base` or `@apply`:
```css
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
```

**MD3 Breakpoints & Layout Frame Pattern (`layout.css`):**
Strictly uses MD3 Window Size Class breakpoints (`<600px` compact, `>=600px` medium, `>=840px` expanded):
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

@media (min-width: 840px) {
  .shell-content {
    max-width: 1200px;
    padding-inline: 2rem;
  }
}
```

---

### 2. Domain Stylesheets: `meals.css`, `bills.css`, `chores.css`, `deals.css`, `lists.css`, `settings.css`

**Analog:** `apps/web/src/styles/gap-primitives.css` (lines 77-103)

**Class Naming & Scoping Pattern:**
BEM-like or descriptive semantic class names prefixed with domain or component name, referencing MD3 tokens directly:
```css
/* Scoped domain class conventions */
.meals-agenda-day {
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  padding: 1rem;
}

.recipe-card {
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-low);
  padding: 1rem;
}

.bill-hero-spend {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-radius: 16px;
  padding: 1.5rem;
}

.settings-avatar-pill {
  width: 48px;
  height: 48px;
  border-radius: 9999px;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
```

---

### 3. Modular CSS Manifest (`apps/web/src/index.css`)

**Analog:** `apps/web/src/index.css` (lines 1-4)

**Manifest Architecture Pattern:**
Clean declarative imports of the modular style graph with zero `@theme` or Tailwind directives:
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

---

### 4. Dependency Pruning & Vite Build Config (`apps/web/package.json` & `apps/web/vite.config.ts`)

**Analog:** `apps/web/vite.config.ts` (lines 1, 64-70, 151-163)

**Package Removal Pattern:**
In `apps/web/package.json`:
- Remove `"radix-ui"` and `"lucide-react"` from `dependencies`
- Remove `"@tailwindcss/vite"` and `"tailwindcss"` from `devDependencies`
- Prune `pnpm-lock.yaml` via `pnpm install`

**Vite Config Plugin Pruning (`apps/web/vite.config.ts`):**
```typescript
// Remove line 1: import tailwindcss from '@tailwindcss/vite';
// Keep react, VitePWA, localZbarWasmPlugin
export default defineConfig({
  // ...
  plugins: [
    localZbarWasmPlugin(),
    react(),
    // REMOVED: tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // ...
    }),
  ],
  // ...
});
```

**Coverage Threshold Calibration Pattern (`apps/web/vite.config.ts:151-163`):**
```typescript
coverage: {
  provider: 'v8',
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test-setup.ts'],
  reporter: ['text', 'html', 'json-summary'],
  thresholds: { statements: 84, branches: 80, functions: 77, lines: 85 },
},
```

---

### 5. Dead Code & Icon Migration (`StaleNotice.tsx`, `sections.ts`, Active Screens)

**Analog:** `apps/web/src/components/states/StateBlocks.tsx` (lines 1-27) & `apps/web/src/components/ui/Icon.tsx` (lines 1-33)

**Imports Pattern:**
```typescript
// Replace: import { RotateCw } from 'lucide-react';
// With:
import { Icon } from '../ui/Icon.tsx';
```

**Component Render Pattern (`StaleNotice.tsx:23-26`):**
```typescript
<Button variant="ghost" className="px-2" onClick={onRetry}>
  <Icon name="refresh" size={18} />
  Try again
</Button>
```

**Navigation Definition Cleanup (`apps/web/src/lib/sections.ts:1-23`):**
```typescript
// Remove:
// import { ClipboardCheck, LayoutDashboard, Receipt, ShoppingCart, UtensilsCrossed, type LucideIcon } from 'lucide-react';
// Remove `icon: LucideIcon;` property from `Tab` interface.

export interface Tab {
  id: SectionId;
  label: string;
  path: string;
}
```

**Standard Size & Color Mapping for Converted Icons (D-07):**
- Small actions/chips: `<Icon name="..." size={18} />` (`sm` tier)
- Default buttons/navigation: `<Icon name="..." size={24} />` (`md` tier)
- Feature hero/empty states: `<Icon name="..." size={32} />` (`lg` tier)
- Color inheritance: Inherits parent text color via `currentColor` / MD3 text tokens (`onSurface`, `primary`, `onSurfaceVariant`).

---

### 6. Playwright E2E Animation Disabling & Locators (`e2e/support/axe.ts` & `e2e/support/app.ts`)

**Analog:** `e2e/support/axe.ts` (lines 18-39) & `e2e/support/app.ts` (lines 40-43)

**Global CSS Animation Disabling Pattern (`e2e/support/axe.ts` per D-11):**
```typescript
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

**E2E Navigation Helper Modernization (`e2e/support/app.ts:40-43`):**
```typescript
export async function openSettings(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
}
```

---

### 7. Knip Baseline & Code Duplication Configuration (`knip.json`, `scripts/knip-production-baseline.txt`, `.jscpd.json`)

**Analog:** `knip.json` (lines 6-7), `scripts/knip-summary.mjs` (lines 1-39), `.jscpd.json` (lines 1-9)

**Knip Dependency Ignore Clean-Slate (`knip.json:6`):**
```json
{
  "ignoreExportsUsedInFile": true,
  "ignoreBinaries": ["supabase", "psql"],
  "ignore": [".planning/**"],
  "ignoreDependencies": ["@material/material-color-utilities"],
  "node": false
}
```

**Atomic Knip Baseline Generation Command:**
```bash
pnpm knip:production --reporter json > /tmp/knip.json && node scripts/knip-summary.mjs /tmp/knip.json scripts/knip-production-baseline.txt
```

**JSCPD Duplication Calibration (`.jscpd.json:3`):**
```json
{
  "path": ["apps", "packages", "e2e", "supabase/seed"],
  "format": ["typescript", "tsx"],
  "minTokens": 60,
  "minLines": 8,
  "ignore": ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/db/types.ts"],
  "reporters": ["console"],
  "threshold": 5
}
```
*(Note: `.jscpd.json` targets `typescript` and `tsx`, so domain `.css` stylesheets do not trigger duplication violations).*

---

## Shared Patterns

### MD3 Window Size Class Breakpoints
**Source:** `apps/web/src/styles/layout.css`  
**Apply to:** All responsive domain stylesheets and layout containers  
```css
/* Compact: < 600px (base mobile-first default) */

/* Medium: 600px - 839px (NavigationRail, side-by-side forms) */
@media (min-width: 600px) {
  /* ... */
}

/* Expanded: >= 840px (7-column meal planner board, expanded grids) */
@media (min-width: 840px) {
  /* ... */
}
```

### Material Symbols Round Icon Integration
**Source:** `apps/web/src/components/ui/Icon.tsx`  
**Apply to:** All component files replacing Lucide icons  
```typescript
import { Icon } from '../ui/Icon.tsx';

// Standard MD3 size tiers: sm=18, md=24, lg=32
<Icon name="check" size={24} />
<Icon name="delete" size={18} />
```

### Playwright Semantic User-Facing Locators
**Source:** `e2e/support/app.ts`  
**Apply to:** All 24 Playwright E2E spec files  
```typescript
// Query by visible role and label rather than CSS classes or shadow DOM internals
await page.getByRole('button', { name: 'Save' }).click();
await page.getByRole('heading', { name: 'This Week', level: 1 }).toBeVisible();
await page.getByLabel('Email').fill(email);
```

### Post-Build App Shell Size & Hygiene Verification
**Source:** `apps/web/scripts/check-build.mjs` & `scripts/check-repo-hygiene.mjs`  
**Apply to:** CI hygiene and build gates  
```javascript
// Shell budget enforcement <= 200 KB gzipped
const SHELL_BUDGET_BYTES = 200 * 1024;
```

---

## No Analog Found

Every file to be created or modified in Phase 21 has an exact or role-match analog in the existing codebase.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| *(None)* | — | — | Full analog coverage achieved |

---

## Metadata

**Analog search scope:** `apps/web/src/styles/`, `apps/web/src/components/`, `e2e/support/`, `scripts/`, `knip.json`, `.jscpd.json`  
**Files scanned:** 24  
**Pattern extraction date:** 2026-11-15  
