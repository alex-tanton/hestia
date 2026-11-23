---
spike: 002
idea: pure-md3-redesign
name: md3-shell-and-navigation
type: standard
validates: "Given mobile and desktop viewport profiles, when restyling the Top App Bar, Navigation Bar (bottom pill indicators), and Navigation Rail according to pure MD3 specifications, then the shell layout feels elegant, cohesive, and native across screen widths."
verdict: VALIDATED
related: [001]
tags: [md3, navigation, shell, responsive]
---

# Spike 002: MD3 Shell and Navigation

## What This Validates
Given mobile and desktop viewport profiles, when restyling the Top App Bar, Navigation Bar (bottom pill indicators), and Navigation Rail according to pure MD3 specifications, then the shell layout feels elegant, cohesive, and native across screen widths.

## Research
MD3 Adaptive Navigation Guidelines specify:
1. **Compact viewports (<600dp):** Bottom Navigation Bar (80dp height) with 3-5 destinations. Active destination uses a 64x32dp pill indicator (`secondary-container`), with icon in `on-secondary-container`.
2. **Medium & Expanded viewports (>=600dp):** Navigation Rail (80dp-88dp width) anchored to the leading edge.
3. **Top App Bar:** 64dp height with `title-large` typography, household switcher pill, and contextual action buttons.

## How to Run
Open `.planning/spikes/002-md3-shell-and-navigation/demo.html` in a browser or review the screenshots.

## What to Expect
- Desktop layout with 88px Navigation Rail on the left, top app bar, and clean content container.
- Mobile layout with 390px phone frame showcasing the 80px bottom navigation bar with active pill indicator and badge counter.

## Investigation Trail
1. Modeled MD3 Navigation Rail and Bottom Navigation Bar in `shell.css`.
2. Created SVG icons for the 5 destinations: This Week (Dashboard), Bills, Shopping, Meals, Chores.
3. Added active indicator pill animations and badge positioning.
4. Rendered screenshots with Chrome Headless.

## Results
- **Verdict:** VALIDATED
- **Findings:** The active pill indicator (`width: 64px, height: 32px, border-radius: 16px, background: secondary-container`) provides an immediately recognizable, polished MD3 signature that replaces the generic bottom border tabs.
