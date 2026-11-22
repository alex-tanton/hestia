# Spike Manifest

## Ideas

### pure-md3-redesign
Complete visual overhaul of Hestia's UI to a clean, pure Material Design 3 (MD3) design language. Eliminate Tailwind CSS and unnecessary dependencies in favor of pure MD3 tokens, elevation, typography, and web components. Provide automated high-resolution screenshots at every milestone so design feedback can be given without deploying or running the frontend locally.

**Requirements:**
- Must use authentic Material Design 3 design system specifications (elevation levels 0-5, surface container hierarchy, MD3 typography scale, 8dp grid).
- Must eliminate Tailwind CSS dependency and avoid extra styling libraries; rely on pure CSS and `@material/web` components/tokens.
- Must provide high-resolution visual screenshots for review at each stage without requiring the user to deploy or run the frontend.
- Must support responsive layouts across mobile (Bottom Navigation Bar) and tablet/desktop (Navigation Rail / Drawer).
- Must maintain dark mode and dynamic color token compatibility through MD3 CSS custom properties.

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | pure-md3-redesign | pure-md3-styling-foundation | standard | Pure MD3 token and CSS layer replacing Tailwind utility classes | VALIDATED | md3, tokens, css, typography |
| 002 | pure-md3-redesign | md3-shell-and-navigation | standard | MD3 Top App Bar, Navigation Bar, and Navigation Rail styling across viewports | VALIDATED | navigation, shell, responsive |
| 003a | pure-md3-redesign | md3-cards-elevated-tonal | comparison | Dashboard pillar cards using MD3 Elevated / Surface Container treatment | VALIDATED | cards, dashboard, elevated |
| 003b | pure-md3-redesign | md3-cards-outlined | comparison | Dashboard pillar cards using MD3 Outlined card treatment | VALIDATED | cards, dashboard, outlined |
| 004 | pure-md3-redesign | md3-screens-visual-showcase | standard | Full screen visual showcase with automated screenshot pipeline | VALIDATED | showcase, screens, visual |
