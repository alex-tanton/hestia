---
spike: 001
idea: pure-md3-redesign
name: pure-md3-styling-foundation
type: standard
validates: "Given pure MD3 tokens and zero Tailwind CSS dependencies, when replacing utility classes with standard MD3 CSS (surfaces, typography, shapes, states), then the app renders cleanly with a pure MD3 design baseline and smaller bundle size."
verdict: VALIDATED
related: []
tags: [md3, tokens, css, typography, surfaces]
---

# Spike 001: Pure MD3 Styling Foundation

## What This Validates
Given pure MD3 tokens and zero Tailwind CSS dependencies, when replacing utility classes with standard MD3 CSS (surfaces, typography, shapes, states), then the app renders cleanly with a pure MD3 design baseline and smaller bundle size.

## Research
Material Design 3 defines a strict surface container hierarchy rather than arbitrary elevation shadows:
- `surface`: main application canvas
- `surface-container-lowest`: nested elements requiring distinct separation from containers
- `surface-container-low`: standard cards and baseline container blocks
- `surface-container`: default navigation elements and top app bar scrolled state
- `surface-container-high`: dialogs, menus, floating sheets
- `surface-container-highest`: text field backings, filter chips

By leveraging CSS custom properties already generated from Hestia's Warm Terracotta seed (`#B4532A`), we can drop Tailwind CSS entirely. This eliminates the dependency, prevents style pollution, and produces authentic MD3 components with standard corner radii (8px/12px/16px/9999px) and typography line heights.

### Approach Comparison

| Approach | Tool / Library | Pros | Cons | Status |
|----------|----------------|------|------|--------|
| Tailwind v4 + ad-hoc classes | `@tailwindcss/vite` | Fast prototyping | Bloated build, inconsistent MD3 elevation, un-material look | Deprecated |
| Pure MD3 CSS + Tokens | Native CSS + `@material/web` tokens | 0 extra deps, pure MD3 specs, authentic surface hierarchy, tiny bundle | Must write focused component CSS classes | **Selected** |
| Heavy component library (MUI / etc.) | `@mui/material` | Pre-built components | Extra 300KB+ runtime dependency, violates minimalist requirement | Rejected |

## How to Run
Open `.planning/spikes/001-pure-md3-styling-foundation/demo.html` in any browser or review the captured screenshots.

Headless render command:
```bash
chrome --headless=new --screenshot=.planning/spikes/001-pure-md3-styling-foundation/screenshot-desktop.png --window-size=1200,900 .planning/spikes/001-pure-md3-styling-foundation/demo.html
```

## What to Expect
- Pure MD3 surface containers rendered in Warm Terracotta tones
- Standard MD3 typography scale (`title-large`, `body-medium`, `label-small`)
- MD3 button styles (Filled Primary, Tonal Secondary, Outlined, Text)
- Clear comparison between Elevated, Outlined, and Filled card styles

## Investigation Trail
1. Analyzed existing `tokens.css` which already holds full MD3 light/dark palettes from `@material/material-color-utilities`.
2. Built `md3-foundation.css` without Tailwind classes, defining clean semantic classes for surfaces, typography, elevation, and buttons.
3. Constructed `demo.html` showcasing the token hierarchy and card treatments.
4. Rendered desktop (1200x900) and mobile (400x900) screenshots via Chrome headless and confirmed clear visual hierarchy.

## Results
- **Verdict:** VALIDATED
- **Findings:** Eliminating Tailwind removes styling ambiguity. The warm terracotta MD3 palette produces a warm, cohesive look when anchored by `surface-container-low` cards on a `surface` canvas.
