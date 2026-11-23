# Spike Conventions: Material Design 3 Redesign

Established patterns and stack choices from the Pure MD3 redesign spikes.

## Stack & Styling
- **Framework:** React 19 + TypeScript + Vite 8
- **Primary Color Seed:** Google Material 3 Blue (`#0B57D0`)
- **Theme Modes:** Full Light (`:root` / `[data-theme='light']`) and Dark (`:root[data-theme='dark']` / `@media (prefers-color-scheme: dark)`) themes.
- **Dependencies:** Zero CSS utility frameworks. Tailwind CSS (`@tailwindcss/vite` and `tailwindcss`) is removed. Pure MD3 CSS custom properties with native CSS Grid and Flexbox are used.
- **Defaults:** Standard Material Design 3 specifications from `m3.material.io` are accepted as defaults across all screens.

## Layout & Components
- **Spacing:** Strict 8dp grid system (8px, 16px, 24px, 32px). Cards have 24px padding and 16-20px gaps.
- **Elevation:** Tonal container elevation only (no harsh drop shadows).
  - Cards use M3 **Filled Cards** (`surface-container-low` on base `surface`, 0px shadow, 16px corner radius).
  - Outlined variants use 1px solid `outline-variant` on `surface`.
- **Top App Bar:** 64px height. Contains the household switcher dropdown formatted with **name only** + subtle arrow (no icons).
- **Navigation:**
  - Desktop (>=600px): 80px Navigation Rail on the leading edge.
  - Mobile (<600px): 80px Navigation Bar with 64x32px active pill indicator (`secondary-container`).
- **Lists:** Standard M3 one-line (56px) and two-line (72px) list items with subtle hairline dividers.
- **FAB:** 56x56px Floating Action Button with 16px corner radius and `primary-container` fill.
