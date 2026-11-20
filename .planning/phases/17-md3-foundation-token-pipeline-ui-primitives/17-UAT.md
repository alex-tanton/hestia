---
status: complete
phase: 17-md3-foundation-token-pipeline-ui-primitives
source:
  - 17-01-SUMMARY.md
  - 17-02-SUMMARY.md
  - 17-03-SUMMARY.md
  - 17-04-SUMMARY.md
  - 17-05-SUMMARY.md
  - 17-06-SUMMARY.md
  - 17-07-SUMMARY.md
  - 17-08-SUMMARY.md
  - 17-09-SUMMARY.md
  - 17-10-SUMMARY.md
  - 17-11-SUMMARY.md
  - 17-12-SUMMARY.md
  - 17-13-SUMMARY.md
  - 17-14-SUMMARY.md
  - 17-15-SUMMARY.md
started: "2026-11-20T00:48:00Z"
updated: 2026-11-20T14:23:48.728Z
---

## Current Test

[testing complete]

## Tests

### 1. Verify Warm Terracotta theme styling and PWA chrome
expected: The application renders with the Warm Terracotta MD3 tonal color scheme in both light (#fff8f6) and dark (#1a110e) modes with appropriate contrast, and the browser theme-color meta / PWA manifest reflect Warm Terracotta.
result: pass

### 2. Verify MD3 Button, TextField/TextAreaField, Date/TimeField, and Select primitives
expected: Buttons (primary, secondary, text, icon) display Material Design 3 filled/outlined/text styles with proper hover/active states; TextFields render with 56px height, outlined borders, floating labels, and inline error styling; Select renders MD3 outlined select with native mobile fallback on coarse pointer.
result: pass

### 3. Verify MD3 Dialog, Switch, OverflowMenu, and Tabs primitives
expected: Dialogs open as centered MD3 modals with scrim overlay and keyboard trap; Switches toggle smoothly between on/off states; OverflowMenu renders MD3 menu options positioned correctly; Tabs render with MD3 primary tab styling and active indicator pill.
result: pass

### 4. Verify ModalBottomSheet and MD3 Snackbar system
expected: Modal bottom sheets slide up anchored to the bottom of the viewport with backdrop scrim and dismiss on backdrop click or close button; Snackbars display at the bottom with 4-second auto-dismiss for info/success and persistent action buttons for errors/undo.
result: pass

### 5. ESLint import boundaries and type fences
expected: ESLint @material/web/lit/@lit static+dynamic import boundaries, all.js/labs/* exclusions, jsx-a11y label rules, and preserved CLOCK_READS/FORMATTER_READS across web tests
result: pass
source: automated
coverage_id: D1

### 6. Forced element-internals-polyfill and DOM shims
expected: Forced element-internals-polyfill and IntersectionObserver/animate/getAnimations/<dialog> shims in apps/web/src/test-setup.ts
result: pass
source: automated
coverage_id: D2

### 7. DRY Shadow DOM RTL host query utilities
expected: DRY Shadow DOM RTL host query utilities in apps/web/src/test/md-queries.ts compliant with jscpd and clock fence
result: pass
source: automated
coverage_id: D3

### 8. Zero-cast omitUndefined helper and @lit/react adapters
expected: Zero-cast omitUndefined helper and @lit/react adapters (MdTextField, MdButton, MdSelect, MdCheckbox) under exactOptionalPropertyTypes
result: pass
source: automated
coverage_id: D4

### 9. Six @material/web adapters
expected: Remaining six @material/web@2.5.0 @lit/react@1.0.8 adapters (MdSwitch, MdRadio, MdDialog, MdMenu, MdTabs, MdProgress) with zero type casts and no redundant host roles
result: pass
source: automated
coverage_id: D1

### 10. Material Web smoke gate passing in jsdom
expected: D-13 five-check Material Web smoke gate passing cleanly under jsdom@30.1.0 + element-internals-polyfill@3.0.2
result: pass
source: automated
coverage_id: D2

### 11. Reproducible commit-pinned SVG path extractor
expected: Reproducible commit-pinned SVG path extractor from google/material-design-icons emitting validated static TypeScript path geometry in apps/web/src/components/ui/icon-paths.ts
result: pass
source: automated
coverage_id: D1

### 12. Pure inline SVG Icon.tsx primitive
expected: Pure inline SVG Icon.tsx primitive supporting outline/filled variants, custom size/className, aria-hidden='true', and zero ligature text leakage
result: pass
source: automated
coverage_id: D2

### 13. Card and ListRow MD3 tonal surfaces
expected: Card and ListRow render MD3 tonal surfaces (min-h-12, truncated titles, omitted undefined slots) without overflow-hidden popover clipping
result: pass
source: automated
coverage_id: D1

### 14. Badge and SegmentedControl MD3 tonal pills and keyboard nav
expected: Badge and SegmentedControl render MD3 tonal pills, Icon.tsx glyphs, shrink-0 horizontal scroll items, roving Arrow/Home/End keys, and locked active selection without Radix ToggleGroup
result: pass
source: automated
coverage_id: D2

### 15. Skeleton, FormMessage, and CopyButton MD3 tokens
expected: Skeleton/SkeletonRows, FormMessage, and CopyButton apply MD3 tonal tokens, preserve role='status' 200ms delay / <div role='alert'><p> DOM contract / clipboard error snackbar, and remove all lucide-react/radix-ui imports from components/ui/
result: pass
source: automated
coverage_id: D3

### 16. browser.ts openMenu and MD3 button helpers
expected: browser.ts openMenu locates <md-icon-button> trigger hosts via md-queries.ts findMdButton without altering stubCoarsePointer or the ESLint clock fence
result: pass
source: automated
coverage_id: D1

### 17. Shell/dashboard/write-queue DOM test suites passing
expected: shell, dashboard, write-queue, realtime, and about-sign-out Vitest dom suites pass using md-queries.ts helpers without fake host ARIA roles
result: pass
source: automated
coverage_id: D2

### 18. Settings test suites passing against MD3 hosts
expected: Settings test suites pass cleanly against MD3 custom element hosts (Switch, Button, Field, Dialog) via md-queries.ts
result: pass
source: automated
coverage_id: D1

### 19. Onboarding, magic-link, dashboard test suites passing
expected: Onboarding, magic-link, and dashboard-route test suites pass cleanly against MD3 hosts using shared md-queries.ts helpers
result: pass
source: automated
coverage_id: D2

### 20. Lists test suites passing against MD3 hosts
expected: Lists test suites pass cleanly against MD3 custom element hosts (Button, Field, Checkbox, Menu, Dialog) via md-queries.ts
result: pass
source: automated
coverage_id: D1

### 21. Bills test suites passing against MD3 hosts
expected: Bills test suites pass cleanly against MD3 hosts and native date inputs using shared md-queries.ts helpers
result: pass
source: automated
coverage_id: D2

### 22. Chores and Errands test suites passing against MD3 hosts
expected: Chores and Errands test suites pass cleanly against MD3 custom element hosts (Button, Field, Checkbox, Dialog) via md-queries.ts
result: pass
source: automated
coverage_id: D1

### 23. Deals test suites passing against MD3 hosts
expected: Deals test suites pass cleanly against MD3 hosts (Button, TextField, Checkbox, Dialog) via md-queries.ts
result: pass
source: automated
coverage_id: D2

### 24. Meal component test suites passing against MD3 hosts
expected: Meal component test suites pass cleanly against MD3 custom element hosts (Tabs, Button, TextField, Select, OverflowMenu) via md-queries.ts
result: pass
source: automated
coverage_id: D1

### 25. Meal screen test suites passing against MD3 hosts
expected: Meal screen test suites pass cleanly against MD3 hosts (Tabs, Button, TextField, Select, Dialog) via md-queries.ts
result: pass
source: automated
coverage_id: D2

## Summary

total: 25
passed: 25
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
