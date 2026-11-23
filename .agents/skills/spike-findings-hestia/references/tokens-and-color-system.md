# Feature Area: Tokens & Color System

Implementation patterns, constraints, and antipatterns established in Spikes 001, 005, and 006.

## Requirements

- Must use Theme 1 (Google Material 3 Blue `#0B57D0` seed) with authentic Light and Dark theme support.
- Must eliminate Tailwind CSS and avoid extra frontend dependencies; rely on pure MD3 CSS custom properties generated from `@material/material-color-utilities`.
- Dark theme must feature a soft, desaturated pastel color palette (avoiding hyper-saturated blues or clashing muddy tones).

## How to Build It

1. **Token Generation Script:**
   - Use `apps/web/scripts/generate-tokens.mjs` with `SEED_HEX = '#0B57D0'`.
   - Uses `SchemeTonalSpot(Hct.fromInt(...), isDark, 0.0)` from `@material/material-color-utilities`.
   - Generates the 5 canonical M3 surface container tiers:
     - Light: `surface` (`#FAF8FF`), `surface-container-lowest` (`#FFFFFF`), `surface-container-low` (`#F4F3FA`), `surface-container` (`#EEEDF4`), `surface-container-high` (`#E8E7EF`), `surface-container-highest` (`#E2E2E9`).
     - Dark (Pastel): `surface` (`#121318`), `surface-container-lowest` (`#0D0E13`), `surface-container-low` (`#1A1B21`), `surface-container` (`#1E1F25`), `surface-container-high` (`#282A2F`), `surface-container-highest` (`#33343A`).
2. **Elevation Tokens:**
   - Rely primarily on tonal surface containers (`surface-container-low`) rather than CSS drop shadows.
   - For floating components requiring drop shadows (FAB, Menus, Dialogs), use softened ambient elevation shadows with low opacity (0.04 - 0.08 alpha).
3. **Typography Tokens:**
   - Define canonical typescale variables (`--md-sys-typescale-display-large` through `body-small`) adhering to M3 font sizes, weights, and tracking.
4. **Theme Toggling:**
   - Dual support for system preference (`@media (prefers-color-scheme: dark)`) and explicit toggle via `:root[data-theme='light']` / `:root[data-theme='dark']`.

## What to Avoid

- **Avoid saturated dark mode backgrounds:** Do not use pure `#000000` or saturated dark blues (`#001F3F`). Use M3 tonal neutral dark tones (`#121318`).
- **Avoid Tailwind utility bloat:** Do not mix utility classes with CSS variables. Reference `var(--md-sys-color-*)` directly in component CSS.
- **Avoid Warm Terracotta seed:** Seed `#B4532A` produced muddy, clashing brown tones on large surfaces; Google M3 Blue `#0B57D0` provides clean contrast and native feel.

## Constraints

- Vitest tokens test (`apps/web/src/tokens.test.ts`) strictly asserts that all 5 surface container tiers are distinct and match computed SchemeTonalSpot hex values.
