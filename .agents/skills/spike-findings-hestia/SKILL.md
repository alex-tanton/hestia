---
name: spike-findings-hestia
description: 'Implementation blueprint and conventions from Material Design 3 UI redesign spikes'
---

<purpose>
Implementation blueprint for Hestia's pure Material Design 3 design system and UI architecture.
Contains patterns, constraints, and antipatterns established during spikes 001-006.
</purpose>

<requirements>
## Requirements Validated

Requirements from idea `pure-md3-redesign`:

- Must use Theme 1 (Google Material 3 Blue `#0B57D0` seed) with authentic Light and Dark theme support.
- Must use pure Material Design 3 appearance throughout the entire app with minimal code, accepting official M3 defaults unless there is a compelling reason not to.
- Must eliminate Tailwind CSS and avoid extra frontend dependencies; rely on pure MD3 CSS custom properties and standard components.
- Household selector dropdown must display the household name only with a dropdown arrow (no icons or emojis).
- Must adhere to official M3 specifications: 8dp grid spacing, tonal surface container elevation (zero harsh drop shadows), and standard two-line list items.
- Must provide high-resolution visual screenshots for review at each stage without requiring the user to deploy or run the frontend.
</requirements>

<findings_index>

## Feature Areas

| Area                  | Reference                             | Key Finding                                                                         |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| Tokens & Color System | references/tokens-and-color-system.md | Google M3 Blue (#0B57D0) seed with pastel dark mode and 5 tonal surface containers  |
| Shell & Navigation    | references/shell-and-navigation.md    | 80dp Nav Rail (desktop) / 80dp Nav Bar (mobile) with 64x32dp active pill indicator  |
| Cards & Containers    | references/cards-and-containers.md    | Filled cards (surface-container-low, 0px shadow, 16px radius) and 8dp grid spacing  |
| Screens & Showcase    | references/screens-and-showcase.md    | Pure MD3 screens, 56/72dp list items, automated headless Chrome screenshot feedback |

## Source Files

Original spike source files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Spikes

- 001-pure-md3-styling-foundation
- 002-md3-shell-and-navigation
- 003a-md3-cards-elevated-tonal
- 003b-md3-cards-outlined
- 004-md3-screens-visual-showcase
- 005-authentic-official-md3
- 006-theme-1-light-dark-showcase
</metadata>
