---
phase: 19-entry-dashboard-grocery-ecosystem-screens
plan: 04
subsystem: lists
tags:
  - barcode-scanner
  - md3
  - dark-theme
  - hud
  - media-stream
  - modal-bottom-sheet
requires:
  - LIST-01
  - LIST-02
provides:
  - LIST-03
affects:
  - apps/web/src/components/lists/BarcodeScannerDialog.tsx
tech-stack:
  - added: []
  - patterns:
      - MD3 Full-Screen Dialog dark HUD canvas
      - In-HUD ModalBottomSheet quick naming
      - Single-slot persistent Undo snackbar queue
key-files:
  - created: []
  - modified:
      - apps/web/src/components/lists/BarcodeScannerDialog.tsx
      - apps/web/src/components/lists/BarcodeScannerDialog.test.tsx
decisions:
  - Restyled BarcodeScannerDialog as an MD3 dark-scheme full-screen dialog (bg-[#1A110E]) with top actions, reticle, and bottom controls
  - Replaced Radix Dialog and Lucide icons with native dialog and Material Symbols Icon.tsx
  - Implemented in-HUD quick naming ModalBottomSheet for unknown barcodes without camera teardown
  - Integrated useToast persistent Undo snackbar with live session batch counter
metrics:
  duration: 15m
  completed_date: "2026-11-15"
status: complete
actuals:
  tokens: 9146
  tasks: 2
  commits: 2
plan_head_before: 6a6178b
plan_head_after: 11b8e48
---

# Phase 19 Plan 04: Barcode Scanner Dark HUD Summary

Restyled and enhanced BarcodeScannerDialog into a high-performance, dark-scheme Material Design 3 Full-Screen Dialog with continuous batch scanning, instant audio/haptic feedback, in-HUD quick naming Modal Bottom Sheet, persistent batch counter Undo snackbars, and robust MediaStream lifecycle management.

## Performance & Execution

- **Duration:** 15m
- **Tasks Completed:** 2 / 2
- **Commits:**
  - `d0c8a0e`: `feat(web): restyle BarcodeScannerDialog as full-screen dark HUD`
  - `11b8e48`: `feat(web): continuous batch scan and in-HUD naming sheet`
- **Key Files Modified:**
  - `apps/web/src/components/lists/BarcodeScannerDialog.tsx`
  - `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx`

## Core Accomplishments

1. **Dark HUD Canvas & Top Action Bar (D-13, D-15, LIST-03):**
   - Replaced Radix Dialog and Lucide icons with a native `<dialog>` container styled with MD3 dark-scheme tokens (`bg-[#1A110E]`, `text-[#FFF8F6]`).
   - Added top action bar with back/close (`arrow_back`) and flashlight (`flashlight_on`/`flashlight_off`) controls.
   - Designed a centered targeting reticle with corner brackets and a terracotta pulsing laser line (`border-[var(--md-sys-color-primary)]`).
   - Integrated floating bottom controls with SegmentedControl (`Add to List` | `Mark bought`) and manual entry button.

2. **MediaStream Lifecycle Management (T-19-07, LIST-03):**
   - Enforced explicit track stopping on dialog close and tab switch, clearing `streamRef.current` to prevent camera indicator persistence and battery drain.

3. **Continuous Batch Scanning & In-HUD Naming (D-13, D-14, D-16, LIST-03):**
   - Enabled uninterrupted camera scanning across items with immediate audio chime and haptic feedback.
   - Added in-HUD quick naming `ModalBottomSheet` for unrecognized barcodes with `TextField` and category filter chips (`MdFilterChip`).
   - Integrated `useToast` persistent batch counter snackbar ("Added N items · [Undo last]") with reversible undo capabilities.
   - Expanded unit and DOM test suite to 9 tests covering reticle rendering, mode toggling, manual keypad entry, stream cleanup, debounce window, and in-HUD naming with 100% pass rate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Avoid synchronously calling setState during render in commitScan**
- **Found during:** Task 2 test run
- **Issue:** Calling `toast(...)` inside the `setScannedCount((prev) => ...)` updater function triggered React's warning against updating another component during render.
- **Fix:** Switched to `scannedCountRef` and called `toast(...)` directly within `commitScan` outside state updaters.
- **Files modified:** `apps/web/src/components/lists/BarcodeScannerDialog.tsx`
- **Commit:** `11b8e48`

## Self-Check: PASSED

- [x] `apps/web/src/components/lists/BarcodeScannerDialog.tsx` exists and verified
- [x] `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` exists and verified
- [x] Commit `d0c8a0e` exists in HEAD history
- [x] Commit `11b8e48` exists in HEAD history
- [x] All 9 tests pass in Vitest
