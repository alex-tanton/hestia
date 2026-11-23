# Feature Area: Cards & Containers

Implementation patterns, constraints, and antipatterns established in Spikes 003a, 003b, 005, and 006.

## Requirements

- Must adhere to official M3 specifications: 8dp grid spacing, tonal surface container elevation (zero harsh drop shadows).
- Accept official M3 defaults for cards and list items.

## How to Build It

1. **M3 Filled Cards (Default / Recommended):**
   - Background: `var(--md-sys-color-surface-container-low)` on the canvas `var(--md-sys-color-surface)`.
   - Border radius: `16px` (`var(--md-sys-shape-corner-large)`).
   - Box shadow: `none` (0px drop shadow at resting state).
   - Padding: `24px` (`1.5rem` / `p-6`) conforming to the 8dp grid.
   - Inter-card gaps: `16px` to `24px`.
2. **M3 Outlined Cards (Secondary / Alternative):**
   - Background: `var(--md-sys-color-surface)`.
   - Border: `1px solid var(--md-sys-color-outline-variant)`.
   - Box shadow: `none`.
   - Border radius: `16px`.
   - Padding: `24px`.
3. **List Items Inside Cards:**
   - Use standard M3 two-line list rows (72px height) or single-line rows (56px height).
   - Item backgrounds: transparent, separated by subtle hairline borders (`var(--md-sys-color-outline-variant)` at 0.5px - 1px) or subtle spacing.
   - Avoid nesting heavy colored container boxes within cards.

## What to Avoid

- **No 2014-era drop-shadows:** Avoid heavy black shadows (`box-shadow: 0 4px 12px rgba(0,0,0,0.15)`). M3 relies on surface tint differences.
- **No cramped padding:** Do not use 12px or 16px padding on top-level pillar cards. Use 24px (`p-6`) for proper visual breathing room.
- **No arbitrary corner radii:** Stick to standard M3 shape tokens: None (0), Extra Small (4px), Small (8px), Medium (12px), Large (16px), Full (9999px).

## Constraints

- Visual regression tests and component tests expect `p-6` and `rounded-[var(--md-sys-shape-corner-large)]` on Card components.
