# Feature Area: Shell & Navigation

Implementation patterns, constraints, and antipatterns established in Spikes 002, 005, and 006.

## Requirements

- Must follow official Material Design 3 adaptive navigation specifications for mobile and desktop viewports.
- Household selector dropdown must display the household name only with a dropdown arrow (no icons or emojis).
- Keep navigation and top bar minimal and authentic to M3 defaults.

## How to Build It

1. **Desktop Navigation Rail (>=600dp):**
   - Width: 80dp (or 88dp), fixed to leading edge.
   - Background: `var(--md-sys-color-surface)`.
   - Top section contains brand icon / app mark and optional extended FAB.
   - Destinations: Vertical stack of centered icon buttons with 12px label beneath.
   - Active destination uses active pill indicator (`64x32dp`, `secondary-container` background, `on-secondary-container` icon).
2. **Mobile Navigation Bar (<600dp):**
   - Height: 80dp, anchored to bottom.
   - Background: `var(--md-sys-color-surface-container)`.
   - 3 to 5 destinations spaced evenly.
   - Active destination pill: 64x32dp with 16dp corner radius (`--md-sys-shape-corner-full` or 16px pill).
   - Badge support for counters (e.g. pending bills or unread items).
3. **Top App Bar:**
   - Height: 64dp.
   - Surface color: `var(--md-sys-color-surface)`.
   - Title: `var(--md-sys-typescale-title-large)` (font-size 22px / 1.375rem, font-weight 500).
   - Household Selector:
     - Rendered as `<button>` with household name followed by dropdown arrow `expand_more` (or `▼`).
     - Example: `Oak Street Home ▼`.
     - Clicking opens a standard M3 Modal Bottom Sheet listing memberships with checkmarks.

## What to Avoid

- **No emojis or house icons in household selector:** User explicitly rejected 🏠 emoji/icon next to the house name. Show name only.
- **No old tab underline indicators:** Do not use 2px colored bottom border lines for tabs; use M3 active container pills.
- **No cramped touch targets:** All navigation destinations must have at least 48x48dp interactive touch target areas.

## Constraints

- Accessible screen reader labels: Household button must include assistive context (`<span className="sr-only">, switch household</span>`).
