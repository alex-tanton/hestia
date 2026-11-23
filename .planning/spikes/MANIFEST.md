# Spike Manifest

## Ideas

### pure-md3-redesign
Complete visual overhaul of Hestia's UI to a clean, pure Material Design 3 (MD3) design language. Eliminate Tailwind CSS and unnecessary dependencies in favor of pure MD3 tokens, elevation, typography, and web components. Provide automated high-resolution screenshots at every milestone so design feedback can be given without deploying or running the frontend locally.

**Requirements:**
- Must use Theme 1 (Google Material 3 Blue `#0B57D0` seed) with authentic Light and Dark theme support.
- Must use pure Material Design 3 appearance throughout the entire app with minimal code, accepting official M3 defaults unless there is a compelling reason not to.
- Must eliminate Tailwind CSS and avoid extra frontend dependencies; rely on pure MD3 CSS custom properties and standard components.
- Household selector dropdown must display the household name only with a dropdown arrow (no icons or emojis).
- Must adhere to official M3 specifications: 8dp grid spacing, tonal surface container elevation (zero harsh drop shadows), and standard two-line list items.
- Must provide high-resolution visual screenshots for review at each stage without requiring the user to deploy or run the frontend.

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | pure-md3-redesign | pure-md3-styling-foundation | standard | Pure MD3 token and CSS layer replacing Tailwind utility classes | VALIDATED | md3, tokens, css, typography |
| 002 | pure-md3-redesign | md3-shell-and-navigation | standard | MD3 Top App Bar, Navigation Bar, and Navigation Rail styling across viewports | VALIDATED | navigation, shell, responsive |
| 003a | pure-md3-redesign | md3-cards-elevated-tonal | comparison | Dashboard pillar cards using MD3 Elevated / Surface Container treatment | VALIDATED | cards, dashboard, elevated |
| 003b | pure-md3-redesign | md3-cards-outlined | comparison | Dashboard pillar cards using MD3 Outlined card treatment | VALIDATED | cards, dashboard, outlined |
| 004 | pure-md3-redesign | md3-screens-visual-showcase | standard | Full screen visual showcase with automated screenshot pipeline | VALIDATED | showcase, screens, visual |
| 005 | pure-md3-redesign | authentic-official-md3 | standard | Authentic m3.material.io specifications: Google Blue/Iris, 8dp spacing, tonal container elevation | VALIDATED | official-md3, google-blue, iris, tonal-elevation |
| 006 | pure-md3-redesign | theme-1-light-dark-showcase | standard | Google Blue (#0B57D0) in Light & Dark modes with name-only household selector | VALIDATED | theme-1, google-blue, dark-mode, name-only-selector |
