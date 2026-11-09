# Phase 14: Barcode Scanning & Grocery List Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-09
**Phase:** 14-Barcode Scanning & Grocery List Integration
**Areas discussed:** Scanner Entry Point & Modes

---

## Scanner Entry Point & Modes

### Question 1: Where should the barcode scanner trigger live in the shopping list UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated button in list header toolbar | Placed next to 'Add an item' in ListDetailScreen for instant 1-tap access while shopping or building lists | ✓ |
| Inside the 'Add an item' sheet | A camera/barcode icon beside the item name input in ItemSheet, keeping the main list toolbar uncluttered | |
| Floating Action Button (FAB) | Persistent floating scan button in the bottom-right corner of the list screen | |
| You decide | Agent chooses best placement | |

**User's choice:** Dedicated button in list header toolbar — Placed next to 'Add an item' in ListDetailScreen for instant 1-tap access while shopping or building lists
**Notes:** Provides immediate access in `ListDetailScreen` without needing to open sub-menus or sheets.

### Question 2: How should the scanner differentiate between adding new items vs. marking existing items as bought?

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented toggle inside the scanner modal | Explicit 'Add to List' vs 'Shop & Check Off' tabs at the top of the scanner viewport, remembering the user's last mode | ✓ |
| Smart auto-match with fallback | If the scanned item exists on the active list as needed, mark it bought; if not found, offer to add it to the list | |
| Always 'Shop & Check Off' from list toolbar, 'Add' from ItemSheet | List toolbar scan focuses on in-store checking; adding via barcode lives inside ItemSheet | |
| You decide | Agent chooses differentiation behavior | |

**User's choice:** Segmented toggle inside the scanner modal — Explicit 'Add to List' vs 'Shop & Check Off' tabs at the top of the scanner viewport, remembering the user's last mode
**Notes:** User has full control over scanner intent; mode persists across invocations.

### Question 3: How should the scanner viewport and manual barcode entry tab be presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen mobile dialog / sheet | Clean camera viewfinder with top bar (mode toggle, close button, flashlight if supported) and bottom 'Enter barcode manually' tab with numeric keypad | ✓ |
| Bottom sheet overlay (Sheet.tsx) | Slide-up sheet with fixed viewfinder height and a sub-tab for manual numeric code entry, matching other sheets | |
| Inline expandable panel | Expands directly above the list rows without obscuring the shopping list items | |
| You decide | Agent chooses presentation layout | |

**User's choice:** Full-screen mobile dialog / sheet — Clean camera viewfinder with top bar (mode toggle, close button, flashlight if supported) and bottom 'Enter barcode manually' tab with numeric keypad
**Notes:** Maximizes viewfinder area on mobile screens for reliable scanning, with easy fallback to manual numeric entry.

### Question 4: When an item is matched and marked bought in 'Shop & Check Off' mode, what immediate feedback should the user receive?

| Option | Description | Selected |
|--------|-------------|----------|
| Sound + vibration + floating toast with Undo | Short success chime/vibration, green scan reticle flash, and an interactive toast banner displaying '[Item] marked bought' with an 'Undo' button, keeping the camera active | ✓ |
| Modal confirmation sheet | Brief overlay sheet popping up to show the item matched with an explicit 'Done' or 'Scan next' button | |
| Minimal reticle flash only | Viewfinder box turns green with an audio beep; rely on list updates in the background without toast banners | |
| You decide | Agent chooses feedback mechanism | |

**User's choice:** Sound + vibration + floating toast with Undo — Short success chime/vibration, green scan reticle flash, and an interactive toast banner displaying '[Item] marked bought' with an 'Undo' button, keeping the camera active
**Notes:** Hands-free shopping flow: camera stays open while audio/haptic/toast confirms checkout and allows immediate undo.

---

## The Builder's Discretion

The user elected to proceed directly to context after the primary area was locked, granting discretion for:
- Open Food Facts v3 API proxying and Postgres caching table schema (`barcode_products`).
- Barcode matching logic and disambiguation when multiple similar items are present.
- Pre-filling `ItemSheet` when adding a new item via barcode.
- Native `BarcodeDetector` API usage with WASM polyfill fallback.
- 1.5–2.0 second duplicate scan debounce window.

## Deferred Ideas

None — discussion stayed within phase scope.
