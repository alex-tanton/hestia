# Spike Conventions: Material Design 3 Redesign

Established patterns and stack choices from the Pure MD3 redesign spikes. New spikes and UI work follow these unless the task requires otherwise.

## Stack
- **Framework:** React 19 + TypeScript + Vite 8
- **Primary Color Seed:** Google Material 3 Blue (`#0B57D0`)
- **Theme Modes:** Full Light (`:root` / `[data-theme='light']`) and Dark (`:root[data-theme='dark']` / `@media (prefers-color-scheme: dark)`) themes.
- **Styling Architecture:** Pure Material Design 3 CSS custom properties with native CSS Grid and Flexbox. Tailwind CSS is completely omitted from new components.
- **Color Utilities:** `@material/material-color-utilities` SchemeTonalSpot generating 5-tier surface containers.

## Structure
- Token generation: `apps/web/scripts/generate-tokens.mjs`
- Design tokens: `apps/web/src/styles/tokens.css`
- Component CSS: `apps/web/src/styles/layout.css`, `reset.css`
- Spikes & Proofs: `.planning/spikes/`
- Visual Artifacts: Automated headless Chrome rendering to `.planning/spikes/` and conversation artifacts.

## Patterns
- **Spacing:** Strict 8dp grid system (8px, 16px, 24px, 32px). Cards use 24px padding (`p-6`) and 16-20px gaps.
- **Elevation:** Tonal container elevation only (no harsh drop shadows).
  - Cards use M3 **Filled Cards** (`surface-container-low` on base `surface`, 0px shadow, 16px corner radius).
  - Outlined variants use 1px solid `outline-variant` on `surface`.
- **Top App Bar:** 64px height. Contains the household switcher dropdown formatted with **name only** + subtle arrow (no icons or emojis).
- **Navigation:**
  - Desktop (>=600px): 80px Navigation Rail on the leading edge.
  - Mobile (<600px): 80px Navigation Bar with 64x32px active pill indicator (`secondary-container`).
- **Lists:** Standard M3 one-line (56px) and two-line (72px) list items with subtle hairline dividers.
- **FAB:** 56x56px Floating Action Button with 16px corner radius and `primary-container` fill.
- **Dark Mode Palette:** Desaturated, pastel color tones (`#B2C5FF` / `#B8D2F8` on `#121318`) to eliminate harsh saturation.

## Tools & Libraries
- `@material/material-color-utilities`: for deterministic HCT color scheme calculations.
- Headless Chrome (`--headless=new`): for automated screenshot capture without requiring local dev server deployment.
