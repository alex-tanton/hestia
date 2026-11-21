# Architecture Research

**Domain:** React 19 + TypeScript 6 + Material Design 3 Web Frontend (`apps/web`, Hestia v3.0)
**Researched:** 2026-11-11
**Confidence:** HIGH (codebase contracts & CI gates), MEDIUM (`@material/web@2.5.0` & Vitest Browser Mode integration verified against npm metadata, local `jsdom@30.1.0` source, and official docs)

## Standard Architecture

### System Overview

Hestia's v3.0 frontend replaces Tailwind CSS v4, Radix UI, Lucide React, and the 5 per-pillar color ramps with a single unified **Warm Terracotta Material Design 3 (MD3)** architecture built on static build-time design tokens, isolated React 19 adapters over `@material/web@2.5.0`, light-DOM MD3 shell primitives (for surfaces Google's Web Components package omits), and a flattened feature-screen hierarchy.

```
+-----------------------------------------------------------------------------+
|  Build & Quality Layer (Compile-Time / Node Dev Tools)                      |
|  - scripts/generate-tokens.mjs (@material/material-color-utilities@0.4.0)   |
|  - Vite 8 + vite-plugin-pwa (Workbox injectManifest, <=200 KB shell budget) |
|  - TypeScript 6 (strict, exactOptionalPropertyTypes, erasableSyntaxOnly)     |
|  - ESLint (jsx-a11y strict) + Knip (+ baseline) + JSCPD + check-build.mjs   |
+--------------------------------------+--------------------------------------+
                                       | emits static CSS vars (--md-sys-*)
                                       v
+-----------------------------------------------------------------------------+
|  Styling & Asset Foundation (apps/web/src/styles/)                          |
|  - tokens.css (light + @media prefers-color-scheme: dark MD3 tonal palette) |
|  - typography.css (self-hosted WOFF2 / system stack + --md-sys-typescale-*) |
|  - surface.css (elevation, shape, motion tokens, light-DOM MD3 classes)     |
+--------------------------------------+--------------------------------------+
                                       | consumed across shadow boundary via CSS vars
                                       v
+-----------------------------------------------------------------------------+
|  UI Interop & Primitive Layer (apps/web/src/components/ui/)                 |
|  +----------------------------------+------------------------------------+  |
|  | @material/web@2.5.0 + @lit/react | Native Light-DOM MD3 Primitives    |  |
|  | Button, IconButton, FAB, Switch, | ModalBottomSheet, Snackbar, Card,  |  |
|  | Checkbox, TextField, Select,     | SegmentedControl, Skeleton, Badge, |  |
|  | Menu, Dialog (Alert), Tabs,      | ListRow (interactive anchor/label),|  |
|  | Chip, Divider, Progress          | FormMessage, CopyButton, Icon (SVG)|  |
|  +----------------------------------+------------------------------------+  |
+--------------------------------------+--------------------------------------+
                                       | pure typed React props (zero <md-*> in screens)
                                       v
+-----------------------------------------------------------------------------+
|  Unified MD3 Application Shell (apps/web/src/components/shell/)             |
|  - AppShell (Compact <600px NavigationBar <-> Medium/Expanded >=600px Rail) |
|  - AppTopBar (Small / Center-Aligned header, back nav, HouseholdSwitcher)   |
|  - AuthShell / OnboardingLayout (shared surface + top bar framing)          |
|  - OfflineBanner, UpdatePrompt, ErrorBoundary                               |
+--------------------------------------+--------------------------------------+
                                       | React Router 8 lazy feature routes
                                       v
+-----------------------------------------------------------------------------+
|  Feature Screens & Domain Modules (apps/web/src/screens/, pillars/, lib/)   |
|  Dashboard | Lists / Deals / Flyers / Pantry | Meals | Bills | Chores       |
|  Settings  | Onboarding / Sign-In (lazy-isolated MAGIC_LINK_COPY)           |
|  Domain Hooks: TanStack Query 5, offline queue, realtime, useFieldErrors    |
+-----------------------------------------------------------------------------+
```

### Component Responsibilities

| Layer | Directory / Module | Responsibility |
| --- | --- | --- |
| Token Generator | `apps/web/scripts/generate-tokens.mjs` | Runs `@material/material-color-utilities@0.4.0` (`SchemeTonalSpot` + `MaterialDynamicColors` + `Blend.harmonize`) at dev/author time to write static light/dark CSS variables into `apps/web/src/styles/tokens.css`. Zero runtime color-math JS in the bundle. |
| Theme & Global CSS | `apps/web/src/styles/*.css` + `index.css` | Declares `--md-sys-color-*`, `--hestia-color-{success,warning,info}*`, `--md-sys-typescale-*`, `--md-sys-shape-*`, `--md-sys-elevation-*`, and `--md-sys-motion-*`. Loaded unconditionally in `src/main.tsx`. |
| Custom Element Interop | `apps/web/src/components/md/` | Encapsulates `@lit/react@1.0.8` `createComponent` wrappers, event normalization (`change`, `input`, `closing`, `closed`), TypeScript `exactOptionalPropertyTypes` adapters, and `eslint-plugin-jsx-a11y` boundaries. |
| UI Primitives | `apps/web/src/components/ui/` | Minimal public MD3 component API consumed by screens and domain components (`Button`, `TextField`, `Select`, `ConfirmDialog`, `ModalBottomSheet`, `Snackbar`, `Card`, `ListRow`, `Icon`, etc.). |
| MD3 App Shell | `apps/web/src/components/shell/` | Owns responsive chrome: bottom `NavigationBar` (`<600px`), side `NavigationRail` (`>=600px`), `AppTopBar`, `HouseholdSwitcher`, `OfflineBanner`, and `UpdatePrompt`. Replaces `TabBar`, `TopBar`, and `SectionProvider`. |
| Route Composition | `apps/web/src/routes.tsx` & `pillars/` | Defines lazy route boundaries preserving shell size `<= 200 KB` gzipped and isolating `MAGIC_LINK_COPY` away from initial chunks. Removes shadowed placeholder routes in `ListsRoute.tsx`. |
| Feature Screens | `apps/web/src/screens/` & domain components | Owns feature layout, TanStack Query data binding, and `useFieldErrors` form validation. Uses MD3 tonal container spacing and overflow menus rather than bordered cards and nested sub-controls. |

## Recommended Project Structure

```
apps/web/
├── index.html                        # Updated <meta name="theme-color"> matching Warm Terracotta surface/primary
├── vite.config.ts                    # Remove @tailwindcss/vite; add Vitest workspace/projects; keep SW + thresholds
├── scripts/
│   ├── check-build.mjs               # Preserved 200 KB shell budget, MAGIC_LINK_COPY, forbidden external hosts
│   └── generate-tokens.mjs           # Deterministic static CSS token emitter (node script using color-utilities)
└── src/
    ├── main.tsx                      # Imports styles/tokens.css + index.css + App
    ├── App.tsx                       # QueryClient, RouterProvider, SnackbarProvider (replaces ToastProvider)
    ├── routes.tsx                    # Unchanged lazy split boundaries; cleaned pillar route wiring
    ├── index.css                     # Global resets, focus-ring defaults, light-DOM MD3 layout rules (no @theme)
    ├── styles/
    │   ├── tokens.css                # GENERATED light/dark --md-sys-color-* + harmonized status tokens
    │   ├── tokens.test.ts            # Reads tokens.css from disk; verifies WCAG AA contrast pairs light & dark
    │   ├── typescale.css             # --md-ref-typeface-*, --md-sys-typescale-* tokens & self-hosted @font-face
    │   └── surface.css               # Shape, elevation, motion, and tonal surface utility classes
    ├── components/
    │   ├── md/                       # INTERNAL ONLY: @lit/react createComponent bindings + shared factory
    │   │   ├── factory.ts            # Shared wrapper/event helpers (prevents JSCPD duplication)
    │   │   └── *.ts                  # Raw MD3 web component bindings (buttons, fields, select, dialog, menu, tabs)
    │   ├── ui/                       # PUBLIC PRIMITIVES: idiomatic React API over md/ or light-DOM MD3
    │   │   ├── Icon.tsx              # Typed inline SVG registry from @material-symbols/svg-400 + <md-icon> wrapper
    │   │   ├── Button.tsx            # Filled, tonal, outlined, text, icon-button, FAB; soft-disabled + reason
    │   │   ├── Field.tsx             # TextField / TextAreaField wrapping md-outlined-text-field + aria-invalid
    │   │   ├── Select.tsx            # Desktop md-outlined-select / coarse-pointer native <select> parity
    │   │   ├── Checkbox.tsx          # md-checkbox + semantic row label wrapper
    │   │   ├── Switch.tsx            # md-switch enforcing aria-label/htmlFor contract
    │   │   ├── ConfirmDialog.tsx     # md-dialog type="alert" with form method="dialog" + Cancel default focus
    │   │   ├── ModalBottomSheet.tsx  # Responsive bottom sheet (<600px) / modal dialog (>=600px)
    │   │   ├── OverflowMenu.tsx      # md-menu + md-menu-item with soft-disabled reason support
    │   │   ├── Tabs.tsx              # md-tabs + primary/secondary tab panels
    │   │   ├── SegmentedControl.tsx  # Accessible light-DOM radiogroup styled to MD3 segmented button tokens
    │   │   ├── Card.tsx              # Tonal surface-container-low/high wrappers (no labs border lock-in)
    │   │   ├── ListRow.tsx           # Interactive/static row supporting Link, checkbox-row, and trailing actions
    │   │   ├── Badge.tsx             # MD3 status pill using harmonized semantic & container tokens
    │   │   ├── Snackbar.tsx          # Replaces Toast.tsx; positions above NavigationBar (<600px) or bottom-left (>=600px)
    │   │   ├── Skeleton.tsx          # Tonal surface-container-high animated pulse placeholders
    │   │   ├── FormMessage.tsx       # role="alert" banner styled with error/tertiary container tokens
    │   │   └── CopyButton.tsx        # Clipboard feedback using Icon + Switch/Button
    │   ├── shell/                    # Unified MD3 Application Shell
    │   │   ├── AppShell.tsx          # Responsive frame + skip link + landmark layout
    │   │   ├── NavigationBar.tsx     # Compact (<600px) 5-destination bottom bar + active indicator pill
    │   │   ├── NavigationRail.tsx    # Medium/Expanded (>=600px) 80px side rail + Settings footer slot
    │   │   ├── AppTopBar.tsx         # Small / center-aligned header (h1, back nav, HouseholdSwitcher, overflow)
    │   │   ├── SubTabs.tsx           # MD3 Secondary Tabs strip inside main navigation flow
    │   │   ├── HouseholdSwitcher.tsx # Migrated to ModalBottomSheet + Switch/Menu actions
    │   │   ├── OfflineBanner.tsx     # Tonal banner above scroll content
    │   │   ├── UpdatePrompt.tsx      # Uses Snackbar / non-intrusive action banner
    │   │   └── screen-chrome.tsx     # Simplified chrome override (title, back target, topBarActions slot)
    │   ├── states/                   # EmptyState, ErrorState, OfflineState, StaleNotice, ErrorBoundary
    │   └── <domain>/                 # lists/, meals/, bills/, chores/, errands/, dashboard/
    ├── pillars/                      # Route group entry points (dead shadowed routes removed)
    ├── screens/                      # Feature screens migrated onto ui/ + shell/
    └── lib/
        ├── sections.ts               # Pure route metadata (paths, labels, icons) — NO color/theme maps
        ├── use-media-query.ts        # NAV_RAIL_QUERY ('(min-width: 600px)') & WIDE_CONTENT_QUERY ('(min-width: 1024px)')
        ├── use-field-errors.ts       # Unchanged `[aria-invalid="true"]?.focus()` contract
        └── ...                       # api/, offline/, push/, realtime/, auth/, barcode/, validation
```

### Structure Rationale

- **Strict two-tier `components/md/` vs `components/ui/` boundary:** No screen or domain component imports `@material/web/*` directly. All custom-element tag names, `@lit/react` event maps, Shadow DOM focus hooks, and `exactOptionalPropertyTypes` adapters live inside `components/md/` and `components/ui/`. ESLint `no-restricted-imports` prevents `@material/web` leakage into screens, keeping screen code readable, reviewable, and easy to adjust if an element moves out of `labs/` or changes behavior.
- **Deletion of `section-context.tsx` and `[data-section]` CSS theming:** Replacing 5 pillar palettes with one Warm Terracotta palette eliminates `SectionProvider`, `useSection()`, and ~200 lines of duplicated `[data-section]` token overrides in `index.css`. Route matching in `sections.ts` shrinks to navigation metadata (`path`, `label`, `iconName`).
- **`styles/tokens.css` as checked-in generated CSS:** Committing the generated CSS file keeps runtime CSS zero-JS, ensures zero flash of unstyled tokens before React hydration, satisfies Caddy's `style-src 'self'` CSP, and preserves `tokens.test.ts`'s exact disk-read contrast verification suite without requiring Chromium or DOM rendering.
- **Domain folders unchanged where behavior stays intact:** `lib/api/`, `lib/offline/`, `lib/push/`, `lib/realtime/`, `lib/auth/`, and `lib/barcode/` stay structurally untouched so API hooks, Workbox caching, and offline write queues suffer zero regression risk during the visual overhaul.

## Architectural Patterns

### Pattern 1: Build-Time Tonal Token Pipeline (`@material/material-color-utilities` -> Static CSS)

**What:** Use `Hct.fromInt(argbFromHex(seed))` -> `SchemeTonalSpot` -> `MaterialDynamicColors` in a build/generator script (`apps/web/scripts/generate-tokens.mjs`) rather than `themeFromSourceColor`/`applyTheme` at runtime.

**When to use:** Always for Hestia's fixed Warm Terracotta brand palette (user wallpaper extraction is out of scope in v3.0).

**Trade-offs:**
- **Pro:** Emits complete MD3 tonal surface roles (`surface-dim`, `surface-bright`, `surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `surface-container-highest`), which legacy `themeFromSourceColor` omits.
- **Pro:** Adds **0 KB** of `@material/material-color-utilities` JS to the 200 KB gzipped shell budget and avoids FOUC.
- **Pro:** Preserves `tokens.test.ts` WCAG AA contrast checks directly against CSS files on disk.
- **Con:** Changing the seed color requires running `pnpm --filter @hestia/web tokens:generate` rather than editing one CSS line at runtime (easily enforced with a `tokens:check` test).

**Example (`apps/web/scripts/generate-tokens.mjs`):**
```typescript
import {
  argbFromHex,
  Blend,
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  hexFromArgb,
} from '@material/material-color-utilities';

// Illustrative warm terracotta seed; final hex validated against WCAG AA in tokens.test.ts
const TERRACOTTA_SEED = '#B4532A';
const sourceArgb = argbFromHex(TERRACOTTA_SEED);
const sourceHct = Hct.fromInt(sourceArgb);

const lightScheme = new SchemeTonalSpot(sourceHct, false, 0.0);
const darkScheme = new SchemeTonalSpot(sourceHct, true, 0.0);

const ROLES = [
  ['primary', MaterialDynamicColors.primary],
  ['on-primary', MaterialDynamicColors.onPrimary],
  ['primary-container', MaterialDynamicColors.primaryContainer],
  ['on-primary-container', MaterialDynamicColors.onPrimaryContainer],
  ['secondary', MaterialDynamicColors.secondary],
  ['on-secondary', MaterialDynamicColors.onSecondary],
  ['secondary-container', MaterialDynamicColors.secondaryContainer],
  ['on-secondary-container', MaterialDynamicColors.onSecondaryContainer],
  ['tertiary', MaterialDynamicColors.tertiary],
  ['on-tertiary', MaterialDynamicColors.onTertiary],
  ['tertiary-container', MaterialDynamicColors.tertiaryContainer],
  ['on-tertiary-container', MaterialDynamicColors.onTertiaryContainer],
  ['error', MaterialDynamicColors.error],
  ['on-error', MaterialDynamicColors.onError],
  ['error-container', MaterialDynamicColors.errorContainer],
  ['on-error-container', MaterialDynamicColors.onErrorContainer],
  ['surface', MaterialDynamicColors.surface],
  ['surface-dim', MaterialDynamicColors.surfaceDim],
  ['surface-bright', MaterialDynamicColors.surfaceBright],
  ['surface-container-lowest', MaterialDynamicColors.surfaceContainerLowest],
  ['surface-container-low', MaterialDynamicColors.surfaceContainerLow],
  ['surface-container', MaterialDynamicColors.surfaceContainer],
  ['surface-container-high', MaterialDynamicColors.surfaceContainerHigh],
  ['surface-container-highest', MaterialDynamicColors.surfaceContainerHighest],
  ['on-surface', MaterialDynamicColors.onSurface],
  ['on-surface-variant', MaterialDynamicColors.onSurfaceVariant],
  ['outline', MaterialDynamicColors.outline],
  ['outline-variant', MaterialDynamicColors.outlineVariant],
  ['scrim', MaterialDynamicColors.scrim],
  ['inverse-surface', MaterialDynamicColors.inverseSurface],
  ['inverse-on-surface', MaterialDynamicColors.inverseOnSurface],
  ['inverse-primary', MaterialDynamicColors.inversePrimary],
] as const;

// Harmonized semantic status extensions (success / warning / info)
// Note: MD3 only provides error out of the box; keep green/amber distinguishable while harmonizing.
const successSeed = Blend.harmonize(argbFromHex('#2E7D32'), sourceArgb);
const warningSeed = Blend.harmonize(argbFromHex('#B26A00'), sourceArgb);
const infoSeed = Blend.harmonize(argbFromHex('#1565C0'), sourceArgb);
```

*Migration detail:* Keep Tailwind's semantic token names only during incremental migration if needed, or better yet, map all `components/ui/` primitives directly to `--md-sys-color-*` and `--hestia-color-*` in Phase 1 so semantic leftovers never linger. Also update `THEME_COLOR` in `apps/web/vite.config.ts` and `<meta name="theme-color">` in `apps/web/index.html` from `#475569` to match the generated Warm Terracotta surface/primary token.

---

### Pattern 2: React 19 + TypeScript 6 Wrapper Layer Over `@material/web@2.5.0`

**What:** Isolate every `<md-*>` custom element behind `@lit/react@1.0.8` `createComponent` bindings (`components/md/`) plus thin Hestia-specific wrapper components (`components/ui/`) that preserve React 19 ergonomics, `useFieldErrors` DOM contracts, `soft-disabled` discoverability, and `eslint-plugin-jsx-a11y` strict checks.

**When to use:** Every `@material/web` component (`md-filled-button`, `md-outlined-text-field`, `md-checkbox`, `md-switch`, `md-outlined-select`, `md-menu`, `md-dialog`, `md-tabs`).

**Trade-offs:**
- **Pro:** Isolates React 19 custom-element event mismatches (e.g., `closing`/`closed`, `change` vs synthetic `onChange`) and eliminates custom `JSX.IntrinsicElements` noise across 66 screens.
- **Pro:** Satisfies `tsconfig.base.json` (`exactOptionalPropertyTypes: true`, `explicit-module-boundary-types: error`, `no-non-null-assertion: error`) inside one small folder rather than spreading type assertions through screens.
- **Pro:** Enables JSCPD-clean factories (`components/md/factory.ts`) so button variants and text fields do not trigger the CI 2% duplication cap.
- **Con:** Thin wrappers require careful ref forwarding (`ref` prop in React 19) when screens focus fields or anchor menus.

**Key Interop Bridges:**

1. **Preserving `disabledReason` via `soft-disabled`:** Hestia's `Button` and `OverflowMenu` keep disabled actions keyboard-focusable with an explanation (`aria-disabled="true"` + inline/tooltip `aria-describedby`). `@material/web@2.5.0` provides `soft-disabled` on buttons, icon buttons, and menu items specifically for this pattern (keeping the control in tab order and setting `aria-disabled="true"`). When `disabledReason` is provided (and `disabled` is not forced hard-off), pass `softDisabled={true}` instead of `disabled={true}` and pair `aria-describedby` to a descriptive status span.

2. **Preserving `useFieldErrors` (`[aria-invalid="true"]?.focus()`):** `apps/web/src/lib/use-field-errors.ts` runs:
   `formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();`
   `<md-outlined-text-field>` uses `error` and `errorText` properties rather than setting `aria-invalid` on its light-DOM host element. Setting `aria-invalid={error !== undefined ? 'true' : undefined}` on the `<md-outlined-text-field>` host (whose element implements `.focus()`, delegating into the shadow `<input>`) keeps every form validation error focus jump across the app working with zero changes to `use-field-errors.ts`.

3. **Safe Dialog / Form Submission (`method="dialog"` + `form` attribute):** Action buttons slotted into `<div slot="actions">` on `<md-dialog>` sit outside `<form slot="content">`. Wire `form={formId}` on action `<md-text-button>` / `<md-filled-button>` elements with explicit `onClick` or `<form method="dialog" onSubmit={...}>`, and listen to `closed` / `cancel` via `@lit/react` `events` mapping to sync controlled React `open` state cleanly (never mutating `dialog.showModal()` directly from screen code).

4. **`Switch` ARIA Labeling Guarantee:** Official `@material/web` docs note `<md-switch>` is not reliably auto-labeled by an ancestor `<label>` alone across screen readers. Hestia's `<Switch>` wrapper requires either `label` (rendered with an explicit `id`/`htmlFor` pair) or `aria-label` in TypeScript props, guaranteeing `getByRole('switch', { name })` in Playwright and axe.

**Example (`apps/web/src/components/ui/Field.tsx`):**
```tsx
import React, { useId, type ReactElement } from 'react';
import { createComponent, type EventName } from '@lit/react';
import '@material/web/textfield/outlined-text-field.js';
import { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';

const MdOutlinedTextFieldReact = createComponent({
  tagName: 'md-outlined-text-field',
  elementClass: MdOutlinedTextField,
  react: React,
  events: {
    onInput: 'input' as EventName<InputEvent>,
    onChange: 'change' as EventName<Event>,
  },
});

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  supportingText?: string | undefined;
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' | undefined;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | undefined;
  autoComplete?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
}

export function TextField({
  label,
  value,
  onChange,
  error,
  supportingText,
  type = 'text',
  required,
  disabled,
  name,
  autoComplete,
  inputMode,
}: TextFieldProps): ReactElement {
  const errorId = useId();
  const hasError = error !== undefined && error !== '';

  return (
    <div className="hestia-field">
      <MdOutlinedTextFieldReact
        label={label}
        value={value}
        type={type}
        name={name}
        required={required ?? false}
        disabled={disabled ?? false}
        autocomplete={autoComplete}
        inputMode={inputMode}
        error={hasError}
        errorText={hasError ? error : ''}
        supportingText={hasError ? '' : (supportingText ?? '')}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={hasError ? errorId : undefined}
        onInput={(event) => {
          onChange((event.currentTarget as MdOutlinedTextField).value);
        }}
      />
      {hasError && (
        <span id={errorId} role="alert" className="sr-only">
          {error}
        </span>
      )}
    </div>
  );
}
```
*(Note: keeping `<span role="alert" className="sr-only">` or verifying `<md-outlined-text-field>` shadow error live-region ensures assistive tech and existing `useFieldErrors` tests see deterministic live-region error announcements without duplicating visible text.)*

---

### Pattern 3: Minimal Light-DOM MD3 Primitives for Material Web Gaps

**What:** Build lightweight semantic React + CSS primitives using `--md-sys-*` tokens for MD3 components that `@material/web@2.5.0` either does not ship (`NavigationBar`, `NavigationRail`, `TopAppBar`, `ModalBottomSheet`, `Snackbar`) or keeps unstable/inflexible (`Card`, `Badge`, `SegmentedControl`, interactive full-row `ListRow`).

**When to use:** Shell navigation, overlays requiring drag-handle sheet UX (`<600px`), status pills, and nested-interactive list rows (e.g., `Checkbox` `in-list` full-row `<label>`, or `<Link>` navigation rows).

**Complete Primitive Replacement Matrix (`components/ui/`):**

| Existing Primitive (`apps/web/src/components/ui/`) | Count of Callers | v3.0 MD3 Strategy | Rationale |
| --- | --- | --- | --- |
| `Button.tsx` | 41 | **Wrap `@material/web`** (`md-filled-button`, `md-filled-tonal-button`, `md-outlined-button`, `md-text-button`, `md-icon-button`, `md-fab`) | Exact MD3 ripple, focus ring, state layer, plus `soft-disabled` for `disabledReason`. |
| `Skeleton.tsx` | 29 | **Light-DOM MD3 CSS** | Styled with `--md-sys-color-surface-container-high` and `--md-sys-shape-corner-*`; zero JS overhead. |
| `Toast.tsx` -> `Snackbar.tsx` | 23 | **Light-DOM MD3 Snackbar** | `@material/web` has no snackbar. Keep `useToast()`/`useSnackbar()` hook contract (`error` persists until dismissed; supports `Undo` action + `aria-live`). |
| `Field.tsx` | 19 | **Wrap `@material/web`** (`md-outlined-text-field`) | Replaces custom Tailwind border/focus + preserves 16px iOS zoom floor (`--md-outlined-text-field-input-text-size: 1rem`). |
| `FormMessage.tsx` | 18 | **Light-DOM MD3 banner** | `surface` / `error-container` / `secondary-container` with `role="alert"`. |
| `Card.tsx` | 11 | **Light-DOM tonal MD3 Card** (preferred) or `@material/web/labs/card` | Tonal `surface-container-low` + `surface-container` fills avoid border clutter and `labs` churn while matching MD3 Filled/Elevated Card tokens. |
| `ConfirmDialog.tsx` | 9 | **Wrap `@material/web`** (`md-dialog type="alert"`) | Native Top Layer `<dialog>`, focus trap, and `type="alert"` -> `alertdialog` semantics; preserves initial focus on Cancel. |
| `OverflowMenu.tsx` | 8 | **Wrap `@material/web`** (`md-menu` + `md-menu-item`) | Keyboard arrow nav + positioning + `soft-disabled` item reason. |
| `Select.tsx` | 6 | **Hybrid:** `md-outlined-select` (fine pointer) + MD3-styled native `<select>` (coarse pointer) | Preserves native mobile OS picker ergonomics AND `combobox`/`option` Playwright accessibility tree (`e2e/support/app.ts`) on desktop. |
| `Sheet.tsx` -> `ModalBottomSheet.tsx` | 5 | **Light-DOM `<dialog>` sheet** (`<600px` bottom slide-up w/ drag handle; `>=600px` centered modal `md-dialog`) | Replaces Radix Dialog without scroll-lock hacks, respects safe-area insets, preserves `role="dialog"` + Esc + backdrop click. |
| `Badge.tsx` | 3 | **Light-DOM MD3 pill** | Styled with `--md-sys-color-*-container` & harmonized status tokens (`success`, `warning`, `info`) — no `labs` dependency needed. |
| `Checkbox.tsx` | 3 + lists | **`md-checkbox`** (standalone) + semantic row `<label>` for `in-list` toggle rows | Preserves full-width tappable list item toggle targets and `Checkbox` vs `Switch` distinction (`NotificationTypeRows.tsx` migrates to `Switch`). |
| `ListRow.tsx` | 3 + domain rows | **Hybrid:** `md-list`/`md-list-item` for interactive list items, or light-DOM `md-ripple` row when containing multiple interactive slots | `@material/web`'s `md-list-item` restricts arbitrary nested interactive elements (`Link` + `Checkbox` + `OverflowMenu`); light-DOM flex row with `--md-sys-color-surface-container-low`, `md-divider`, and leading/trailing slots avoids invalid nested interactives (`jsx-a11y`). |
| `SegmentedControl.tsx` | 2 | **Light-DOM MD3 Segmented Button** | Light-DOM `role="radiogroup"` / `radio` (or `md-outlined-segmented-button-set` from `labs`) with MD3 capsule geometry and checkmark active state; avoids `labs` breaking changes. |
| `CopyButton.tsx` | 1 | **Compose `Button` + `Icon`** | Drops custom timer wrapper UI boilerplate. |
| `Tabs.tsx` | 1 + `SubTabs` | **Wrap `@material/web`** (`md-tabs` + `md-primary-tab`/`md-secondary-tab`) | Built-in active indicator animation and roving `tabindex` keyboard handling. |
| *New:* `Icon.tsx` | All 63 icon callers | **Inline `<svg>` inside `<md-icon>`** | Sources only the ~54 distinct icons used across Hestia from `@material-symbols/svg-400@0.48.3` (see Scaling / Asset strategy). |

---

### Pattern 4: Unified Responsive MD3 App Shell (600px Rail / Bottom Bar)

**What:** Align Hestia's shell navigation to MD3 Window Size Classes (`<600px` Compact, `>=600px` Medium/Expanded) while keeping dense content grid expansion at `>=1024px`.

**When to use:** Authenticated routes (`AppShell`), Settings (`SettingsRoute`), and simplified top-bar chrome for Onboarding/Auth (`OnboardingLayout`).

**Trade-offs:**
- **Pro:** Unlocks an `80px` MD3 `NavigationRail` on tablets/foldables (`600px–1023px`) instead of leaving an oversized full-width mobile bottom bar across 768px–1023px viewports.
- **Pro:** Unifies top-bar height (`64px`), surface hierarchy (`surface` canvas, `surface-container` rail/bar, `surface-container-low` primary cards), and typography across authenticated, settings, and onboarding views.
- **Con:** Separates navigation breakpoint (`NAV_RAIL_QUERY = '(min-width: 600px)'`) from multi-column workspace grids (`WIDE_CONTENT_QUERY = '(min-width: 1024px)'`, e.g., `PlannerScreen` 7-column week view), requiring explicit distinction in `lib/use-media-query.ts`.

**Shell Anatomy:**
```
Compact (<600px)                         Medium / Expanded (>=600px)
+-----------------------------------+    +------+------------------------------+
| TopBar (surface, 64px)            |    | Rail | TopBar (surface, 64px)       |
|  [h1 Title]  [Household] [Menu]   |    | 80px |  [h1 Title]      [Household] |
+-----------------------------------+    |      +------------------------------+
| [OfflineBanner if offline]        |    | Home | [OfflineBanner if offline]   |
| [SubTabs: md-secondary-tab]       |    | List | [SubTabs: md-secondary-tab]  |
|                                   |    | Meal |                              |
| Scrollable <main>                 |    | Bill | Scrollable <main>            |
| (pb clears NavigationBar + inset) |    | Chor | (max-w-5xl centered grid)    |
|                                   |    |      |                              |
|           [FAB if primary action] |    | ---- |               [FAB / CTA]    |
+-----------------------------------+    | Sett |                              |
| NavigationBar (surface-container) |    +------+------------------------------+
|  Home  Lists  Meals  Bills Chores |
+-----------------------------------+
```

*Migration detail:* On Compact `<600px`, `Settings` remains accessible in `AppTopBar` (icon button linking to `/settings`), keeping the bottom `NavigationBar` strictly to the **5 MD3 max destinations** (Home, Lists, Meals, Bills, Chores) and preserving `e2e/support/app.ts` navigation contracts. On `>=600px`, `NavigationRail` pins `Settings` cleanly in its footer slot (`footer` region), freeing `AppTopBar` from extra chrome.

---

### Pattern 5: Route Cleanup & Screen Decomposition

**What:** Remove shadowed route scaffolding, flatten nested container UI (`Sheet` + `Tabs`, bordered boxes, cramped 4-way sub-segment bars), and break apart 300–550-line screen monoliths around MD3 container roles and progressive disclosure.

**Specific Refactoring Targets (verified against codebase):**
1. **Route & Dead Scaffolding Cleanup:**
   - `apps/web/src/pillars/lists/ListsRoute.tsx`: Remove shadowed `SubSectionComingSoon` cases for `deals` and `flyers` (already served by explicit lazy routes in `routes.tsx`!).
   - Prune `ComingSoon.tsx`, `SubSectionComingSoon.tsx`, and `section-context.tsx` once all 4 pillars (`lists`, `meals`, `bills`, `chores`) and settings render real routes cleanly (updating `scripts/knip-production-baseline.txt` in the same PR so `check-knip-baseline.mjs` stays exact).
2. **Replace `SubTabs` (`SegmentedControl`) with MD3 Secondary Tabs (`md-tabs`):**
   - `Lists` has 4 sub-views (`Lists`, `Deals`, `Flyers`, `Pantry`). A horizontal `SegmentedControl` squeezes labels at `320px–390px`. Converting `SubTabs.tsx` to scrollable MD3 secondary tabs inside `<nav aria-label="... sections">` scales cleanly to any count of sub-routes.
3. **Flatten Nested UI & Bordered Boxes:**
   - `ListDetailScreen.tsx` (551 lines): Extract item entry bar/FAB, checked-item disclosure section, bulk actions into `AppTopBar` / `OverflowMenu`, and `surface-container-low` grouped category containers (replacing `border-border` + `divide-y`).
   - `ChoreFormScreen.tsx` (352 lines), `PlannerScreen.tsx` (313 lines), `BillDetailScreen.tsx` (295 lines), `PantryScreen.tsx` (292 lines), `DealSearchScreen.tsx` (281 lines): Replace nested bordered boxes with `surface-container-low` sections + `md-divider` inset dividers; collapse infrequent per-item actions into `OverflowMenu`.
   - `MealPlacementSheet.tsx`: Eliminate `Tabs`-inside-`Sheet` nesting by replacing two tabbed sub-views with a clean MD3 segmented toggle at the top of the sheet or direct recipe-search -> fallback quick-entry row.
   - `NotificationTypeRows.tsx` & `NotificationTypes.tsx`: Replace `<Checkbox role="switch">` with native MD3 `<Switch>` trailing controls inside `ListRow` rows.
   - `OnboardingLayout.tsx` & auth screens (`SignInScreen.tsx`, `SignUpScreen.tsx`, `MagicLink*`, `ForgotPasswordScreen.tsx`, `SetPasswordScreen.tsx`): Align under a unified centered MD3 `surface-container-low` card/canvas and standard `TextField`/`Button` wrappers while keeping **`apps/web/src/screens/onboarding/SignInScreen.tsx`** and **`apps/web/src/screens/onboarding/magic-link.ts`** file paths and exact `MAGIC_LINK_COPY` strings intact for `check-build.mjs`.

## Data Flow

### Theme, Asset & Font Delivery Flow (CSP-Compliant Offline PWA)

```
Dev Build / Authoring                   Runtime Production App (Caddy CSP 'self')
─────────────────────                   ───────────────────────────────────────
scripts/generate-tokens.mjs             index.html (<meta theme-color>)
  │ SchemeTonalSpot(Hct)                  │ loads bundled CSS + main.js
  v                                       v
src/styles/tokens.css ─────────────>    :root + prefers-color-scheme: dark
src/styles/tokens.test.ts               --md-sys-color-* pierces Shadow DOM
  (verifies >=4.5:1 / >=3:1 WCAG AA)
                                        Icon.tsx (inline SVG paths, ~54 icons)
@material-symbols/svg-400 ─────────>      │ rendered directly inside <md-icon>
  (curated SVG path map, ~18 KB)          │ ZERO font files, ZERO FOIT, 100% offline
```

- **Font Architecture (CSP & SW Decision):** Caddy (`docker/Caddyfile`) sets `default-src 'self'` with no `font-src` directive, blocking Google Fonts CDNs. Furthermore, loading `@fontsource-variable/material-symbols-outlined` (10.42 MB unpacked) or `@material-symbols/font-400` (1.63 MB unpacked) bloats Workbox precaching and requires adding `.woff2` rules.
  - **Icons:** **Use curated inline SVGs** (`@material-symbols/svg-400@0.48.3` paths via typed `Icon.tsx` slotted inside `<md-icon><svg .../></md-icon>`). Only the ~54 distinct icons used in Hestia bundle (~15–20 KB pre-gzip, zero SW font entries, zero FOIT, Shadow DOM agnostic).
  - **Typography:** Self-host Latin `.woff2` subsets (`@fontsource-variable/plus-jakarta-sans` or `@fontsource/roboto`, ~15–60 KB total WOFF2) **and explicitly add `woff2` to `injectManifest.globPatterns` in `apps/web/vite.config.ts`** (currently `**/*.{js,css,html,png,svg,webmanifest,wasm}` omits `woff2`!), or pair a single Latin brand display WOFF2 with `system-ui, sans-serif` body copy for minimal precache size. Never reference external `fonts.googleapis.com` or `cdn.jsdelivr.net`.

### Form Validation, Accessibility & Overlay Event Flow

```
User submits <form ref={formRef}>
  │
  v
Zod schema parse fails -> setErrors({ fieldName: issue })
  │
  ├─> <TextField error={msg}> sets:
  │     • md-outlined-text-field .error = true, .errorText = msg
  │     • md-outlined-text-field aria-invalid="true" (host attribute)
  │
  └─> useFieldErrors() useEffect runs:
        formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
          └─> <md-outlined-text-field>.focus() delegates focus to shadow <input>
```

### Testing Architecture Flow (CRITICAL JSDOM vs Vitest Browser Boundary)

Local inspection of `apps/web/node_modules/jsdom` (`jsdom@30.1.0`) confirms two hard blockers for testing real `@material/web@2.5.0` elements inside JSDOM:
1. `ShadowRoot-impl.js` exposes `DocumentOrShadowRoot` without `adoptedStyleSheets` (`Material Web` constructs & assigns `CSSStyleSheet` arrays).
2. `HTMLDialogElement-impl.js` is an empty stub lacking `showModal()`, `show()`, and `close()` (used internally by `<md-dialog>`).
3. `@testing-library/dom` (`screen.getByRole`, `getByLabelText`) does not pierce open Shadow DOM trees.

**Recommended Testing Split (Vitest 5 `projects`):**
```
pnpm test (vitest@5.0.1 with projects)
  │
  ├── project: "unit" (environment: 'node')
  │     • Pure unit & static tests: tokens.test.ts, money, price-input,
  │       validation, format, recurrence-preview, problem, auth/offline logic
  │     • Runs in milliseconds with zero browser startup overhead
  │
  └── project: "browser" (@vitest/browser-playwright -> headless Chromium)
        • All UI primitives, shell, and 40+ screen component tests
        • Renders real Shadow DOM, CSS variables, <dialog>.showModal(), ElementInternals
        • Queries via vitest-browser-react `page.getByRole` (pierces open shadow roots)
        • Aggregates real Chromium V8 coverage with Node project against 84/80/77/85 gate
```
- **Why not JSDOM polyfills + `shadow-dom-testing-library`?** Polyfilling `CSSStyleSheet.replaceSync`, `ShadowRoot.adoptedStyleSheets`, and `HTMLDialogElement.showModal` in `test-setup.ts` masks real Top Layer, focus-trap, anchor-positioning (`md-menu`, `md-outlined-select`), and CSS token cascade bugs, while still forcing rewrites across test files to `findByShadowRole`. Since `playwright` is already installed in the monorepo (`@playwright/test@1.63.0` in `e2e/`), running component tests in Vitest Browser Mode (`@vitest/browser-playwright@5.0.1`) gives real browser truth and unifies query semantics with Playwright E2E.
- **Known Vitest + V8 Memory Mitigation:** Heavy Chromium suites under `@vitest/coverage-v8` can accumulate heap graphs across test files; mitigate by keeping pure tests in the `node` project and enabling file isolation/pool bounds or sharding if CI heap approaches limits.

## Scaling Considerations

| Concern | Current / Naive Approach | v3.0 Architectural Guardrail |
| --- | --- | --- |
| **Shell Bundle Budget (`<= 200 KB` gzipped)** | Bundling all `@material/web/all.js` + runtime `@material/material-color-utilities` + variable icon font | Tree-shake only imported `@material/web/<comp>` files inside `components/md/`; generate CSS tokens statically (0 KB runtime color JS); inline only ~54 SVG icons (~15–20 KB); keep `routes.tsx` lazy splits unchanged. |
| **JSCPD (`threshold: 5`, CI 2% check on TS/TSX)** | Duplicating `@lit/react` wrapper props/events per component variant | Extract shared event-mapping and prop types in `components/md/factory.ts` and compose button variants (`filled \| tonal \| outlined \| text`) inside one `Button.tsx` switch/lookup table rather than copying 4 wrapper files. |
| **Knip (`pnpm knip` + exact 26-row baseline)** | Leaving old UI exports, `section-context.tsx`, or adding `scripts/generate-tokens.mjs` untyped dependencies | Update `knip.json` `entry`/`project` patterns for `scripts/generate-tokens.mjs` (`@material/material-color-utilities` devDependency); remove `tailwindcss` from `ignoreDependencies`; update `scripts/knip-production-baseline.txt` atomically when pruning `ComingSoon`/`section-context` exports. |
| **Workbox Offline Precache** | Omitting `.woff2` from `globPatterns` silently breaks offline custom fonts | Either include `'woff2'` in `apps/web/vite.config.ts` `injectManifest.globPatterns` when bundling self-hosted font WOFF2s, or keep icons inline SVG so icon rendering never depends on cached font files. |

## Anti-Patterns

### Anti-Pattern 1: Importing `<md-*>` Custom Elements Directly in Screens

**What people do:** Render `<md-filled-button>` or `<md-outlined-text-field>` directly in `ListDetailScreen.tsx`, `SettingsScreen.tsx`, etc., adding global `JSX.IntrinsicElements` declarations.
**Why it's wrong:** `eslint-plugin-jsx-a11y` strict mode skips unknown kebab-case tags, React `onChange` collides with custom-element `change`/`input` events, `useFieldErrors` (`[aria-invalid="true"]`) breaks silently, and `@material/web` breaking changes spread across 60+ screens.
**Do this instead:** Enforce `components/md/` -> `components/ui/` encapsulation via ESLint `no-restricted-imports`, and map custom wrapper names in `eslint.config.js` `settings['jsx-a11y'].components`.

### Anti-Pattern 2: Using `@material/web` Form-Associated Submit Buttons Without Explicit Form Sync

**What people do:** Drop `<md-filled-button type="submit">` inside `<md-dialog>` actions expecting native form submission without `form` linkage or controlled React handling.
**Why it's wrong:** Slotted actions sit outside `<form slot="content">` and custom-element `ElementInternals` submit behavior can diverge from native buttons across edge cases.
**Do this instead:** Attach explicit `form={formId}` + `method="dialog"` (for native close/returnValue) or invoke `formRef.current?.requestSubmit()` explicitly from React `onClick` handlers inside the `Button` / `ConfirmDialog` wrappers.

### Anti-Pattern 3: Treating Dark Mode via Separate Theme Provider / Tailwind Classes

**What people do:** Add React theme context toggles or `@custom-variant dark` class hooks when `index.css` already tracks OS preference via `@media (prefers-color-scheme: dark)`.
**Why it's wrong:** Breaks SSR/pre-hydration consistency, violates Hestia's OS-driven light/dark Playwright assertions (`e2e/tests/17-accessibility-states.spec.ts`), and leaves stale `.dark` CSS rules.
**Do this instead:** Emit light tokens in `:root` and dark tokens in `@media (prefers-color-scheme: dark) { :root { ... } }` inside `styles/tokens.css`, mirroring existing `tokens.test.ts` behavior cleanly.

### Anti-Pattern 4: Importing `@material/web/labs/card` or `labs/segmentedbutton` Directly in Feature Screens

**What people do:** Depend directly on experimental `labs/*` exports across dozens of feature screens.
**Why it's wrong:** `@material/web` `labs/` components receive API changes between minor tags (v2.5.0 added card/badge utility CSS classes alongside container slots).
**Do this instead:** Use light-DOM MD3 token primitives for `Card`, `Badge`, and `SegmentedControl` (stable, zero shadow-root styling friction, trivial a11y testing), or confine any `labs` usage behind `components/ui/`.

### Anti-Pattern 5: Hardcoding `@media (min-width: 1024px)` CSS Classes Alongside MD3 `NavigationRail`

**What people do:** Keep Tailwind's `lg:` 1024px split for shell navigation instead of MD3's `600px` Compact->Medium transition.
**Why it's wrong:** Leaves phones-scaled bottom bars stretched across 768px–1023px tablets while duplicating layout queries.
**Do this instead:** Centralize breakpoints in `styles/surface.css` + `lib/use-media-query.ts` (`600px` shell rail transition, `1024px` multi-column workspace layout).

## Integration Points

### External / Tooling Boundaries

| Integration | Configuration File | Required Adjustment / Contract |
| --- | --- | --- |
| Build Check Script | `apps/web/scripts/check-build.mjs` | Preserve exact paths `src/screens/onboarding/SignInScreen.tsx` & `src/screens/onboarding/magic-link.ts`, `MAGIC_LINK_COPY` strings, `200 * 1024` gzipped shell ceiling, and zero `cdn.jsdelivr.net` URLs. |
| Caddy Security Headers | `docker/Caddyfile` | CSP `default-src 'self'`; `style-src 'self' 'unsafe-inline'` allows `@material/web` adopted/inline styles, while missing `font-src` restricts fonts strictly to `'self'` bundled assets. |
| Service Worker Precache | `apps/web/vite.config.ts` | Add `woff2` to `injectManifest.globPatterns` if self-hosting font files; update `THEME_COLOR` (`#475569` -> Warm Terracotta surface/primary hex). |
| ESLint Strict Config | `eslint.config.js` | Add `settings['jsx-a11y'].components` mappings for `Button`, `TextField`, `Checkbox`, `Switch`, `ListRow`, `ConfirmDialog`; enforce `no-restricted-imports` keeping `@material/web/*` inside `components/md/` & `components/ui/`; preserve `explicit-module-boundary-types`, `no-non-null-assertion`, and test bare-clock AST ban. |
| TypeScript 6 Compiler | `tsconfig.base.json` & `apps/web/tsconfig.json` | All wrapper props must respect `exactOptionalPropertyTypes: true` (e.g., `error?: string | undefined`), `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`, and `noUncheckedIndexedAccess: true`. |
| Playwright + Axe E2E | `e2e/support/app.ts`, `e2e/support/axe.ts`, `e2e/tests/17-accessibility-states.spec.ts` | Preserve role & accessible name contracts (`button` `/switch household$/`, `heading` level 1, `dialog` `'Households'`, `alertdialog`, `combobox` + `option` in `RotationEditor`, `switch`, `checkbox`, `menuitem`, `aria-invalid="true"`, WCAG 2.1 AA contrast light/dark). Tune `settleAnimations` helper if MD3 ripple/sheet durations differ. |

### Internal Boundaries (Phased Build Order)

Building strictly bottom-up keeps the build green and CI-verifiable at each stage (allowing coexistence during migration before removing Tailwind/Radix in Phase 4):

| Phase | Scope | Exit Gate |
| --- | --- | --- |
| **Phase 1: MD3 Foundation & Interop** | Add `@material/web@2.5.0`, `@lit/react@1.0.8`, `@material-symbols/svg-400@0.48.3` (dev/source), and `@material/material-color-utilities@0.4.0` (devDependency). Write `scripts/generate-tokens.mjs` + `styles/{tokens,typescale,surface}.css`. Implement `components/md/`, `components/ui/Icon.tsx`, and MD3 `components/ui/*` primitives. Configure Vitest `projects` (`node` + `@vitest/browser-playwright`) and `jsx-a11y` / `knip` rules. | `tokens.test.ts` passes light & dark WCAG AA; `primitives.test.tsx` passes in Chromium Browser Mode; `tsc` & `eslint` clean at 0 warnings; shell budget stays `<= 200 KB`. |
| **Phase 2: Unified Responsive Shell & Routes** | Build `NavigationBar` (`<600px`), `NavigationRail` (`>=600px`), `AppTopBar`, `SubTabs` (`md-tabs` secondary), `ModalBottomSheet`, `Snackbar`, `OfflineBanner`, `UpdatePrompt`, unified `AppShell` & `OnboardingLayout`. Migrate `HouseholdSwitcher`. Remove `SectionProvider` (`section-context.tsx`), `SubSectionComingSoon` dead routes in `ListsRoute.tsx`. | `shell.test.tsx` & `onboarding.test.tsx` pass across mobile + desktop viewports; `Dashboard` and `HouseholdSwitcher` E2E specs pass. |
| **Phase 3: Feature Screen Migration & Decomposition** | Migrate `Dashboard` & `states/` -> `Lists` / `Pantry` / `Deals` (`ListDetailScreen` decomposed, `BarcodeScannerDialog` styled) -> `Meals` (`PlannerScreen`, flattened `MealPlacementSheet`, `Recipe*`) -> `Bills` / `Chores` / `Errands` (`RotationEditor` `combobox`/`option` parity) -> `Settings` (`NotificationTypeRows` `Switch`) & `Onboarding`/`SignIn` (preserving `MAGIC_LINK_COPY` paths). | All 63 Vitest test files and full `e2e/` suite + `@axe-core/playwright` (`17-accessibility-states.spec.ts` light & dark) pass. |
| **Phase 4: Cleanup & Hardening** | Remove all remaining `lucide-react`, `radix-ui`, `tailwindcss`, and `@tailwindcss/vite` imports and packages. Prune dead CSS, temporary migration shims, and update `scripts/knip-production-baseline.txt`. | `pnpm lint`, `pnpm typecheck`, `pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`, Vitest coverage (`84/80/77/85`), `check-build.mjs`, and Playwright E2E all pass on a clean install. |

## Sources

- **Local Workspace Inspection (Authoritative Codebase Ground Truth):**
  - `C:/Users/actanton/Development/Aberrance/hestia/apps/web/package.json` (`@types/react@19.3.0`, `tailwindcss@4.3.3`, `radix-ui@1.6.7`, `lucide-react@1.47.0`, `vitest@5.0.1`, `jsdom@30.1.0`; React 19.3 per `.planning/PROJECT.md`)
  - `C:/Users/actanton/Development/Aberrance/hestia/tsconfig.base.json`, `eslint.config.js`, `knip.json`, `scripts/check-knip-baseline.mjs`, `scripts/knip-production-baseline.txt`, `.jscpd.json`, `docker/Caddyfile`, `apps/web/vite.config.ts`, `apps/web/scripts/check-build.mjs`, `e2e/package.json` (`@playwright/test@1.63.0`, `@axe-core/playwright@4.13.0`)
  - `apps/web/node_modules/jsdom` (`ShadowRoot-impl.js` lacks `adoptedStyleSheets`; `HTMLDialogElement-impl.js` lacks `showModal`/`show`/`close`)
- **npm Registry Metadata (Verified via `npm view`):**
  - `@material/web@2.5.0`, `@material/material-color-utilities@0.4.0`, `@lit/react@1.0.8`, `@material-symbols/svg-400@0.48.3`, `@vitest/browser-playwright@5.0.1`, `@vitest/coverage-v8@5.0.1`
- **Official Documentation & Community Verification (Web Search):**
  - [Material Web v2.5.0 Release Notes & `labs/` Updates](https://github.com/material-components/material-web/releases/tag/v2.5.0) — `custom-elements.json`, `labs` card/badge utility classes
  - [Material Web Dialog & Form Association Docs](https://material-web.dev/components/dialog/) — `type="alert"`, `method="dialog"`, `form` attribute association
  - [Material Web Switch Accessibility Docs](https://material-web.dev/components/switch/) — explicit `aria-label` / `id`+`for` guidance
  - [Material Web Button & Soft-Disabled Accessibility](https://material-web.dev/components/button/) — `soft-disabled` keeping keyboard focusability (`aria-disabled="true"`)
  - [Material Web Icon SVG Slotting Issue/Docs](https://github.com/material-components/material-web/tree/main) — slotting inline `<svg>` directly inside `<md-icon>`
  - [Material Color Utilities Dynamic Schemes (`SchemeTonalSpot`, `MaterialDynamicColors`, `Hct.fromInt`, `Blend.harmonize`)](https://github.com/material-foundation/material-color-utilities)
  - [@lit/react `createComponent` with React 19 & TypeScript](https://lit.dev/docs/frameworks/react/)
  - [Vitest Browser Mode + Playwright + V8 Coverage Projects](https://vitest.dev/guide/browser/)
  - [eslint-plugin-jsx-a11y `settings['jsx-a11y'].components`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
