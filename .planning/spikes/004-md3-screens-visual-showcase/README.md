---
spike: 004
idea: pure-md3-redesign
name: md3-screens-visual-showcase
type: standard
validates: "Given full interactive mockups of the primary screens (Dashboard, Shopping List, Bills, Meals), when headless rendering captures desktop and mobile screenshots, then the complete MD3 aesthetic can be visually inspected and reviewed directly via rendered images."
verdict: VALIDATED
related: [001, 002, 003a, 003b]
tags: [md3, showcase, screens, visual, desktop, mobile]
---

# Spike 004: MD3 Screens Visual Showcase

## What This Validates
Given full interactive mockups of the primary screens (Dashboard, Shopping List, Bills, Meals), when headless rendering captures desktop and mobile screenshots, then the complete MD3 aesthetic can be visually inspected and reviewed directly via rendered images.

## Research
Putting all pieces together without Tailwind:
1. Pure MD3 layout hierarchy using native CSS Grid and Flexbox with MD3 surface tokens.
2. Floating Action Button (FAB) at 56x56dp or extended with 16dp rounded corners and elevation level 3.
3. Categorized lists with tonal badges, MD3 checkboxes, and line-through completion states.
4. Top App bar integrated with household switcher pill and notification badges.

## How to Run
Open `.planning/spikes/004-md3-screens-visual-showcase/screens-showcase.html` or inspect `spike-004-showcase.png`.

## Results
- **Verdict:** VALIDATED
- **Findings:** The combined MD3 design provides a unified, coherent, and premium look. Dropping Tailwind produces cleaner HTML, tighter styling contracts, and authentic MD3 elevation behaviors.
