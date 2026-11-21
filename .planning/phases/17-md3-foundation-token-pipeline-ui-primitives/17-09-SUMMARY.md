---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 09
subsystem: ui
tags: [md3, light-dom, card, list-row, badge, segmented-control, skeleton, form-message, copy-button, icon, vitest]

requires:
  - phase: 17-05
    provides: Icon.tsx inline SVG Material Symbols Rounded primitive ('error', 'person', 'check', 'content_copy')
  - phase: 17-06
    provides: MD3 Button primitive (variant="secondary" MdOutlinedButton)
  - phase: 17-08
    provides: gap-primitives.css (.hestia-card forced-colors hairline) and FIFO ToastProvider / Snackbar

provides:
  - Borderless tonal MD3 Card (apps/web/src/components/ui/Card.tsx) with .hestia-card, surfaceContainerLow/surfaceContainer, elevation-1 on raised, and zero overflow-hidden clipping
  - MD3 ListRow (apps/web/src/components/ui/ListRow.tsx) with min-h-12 (48dp), min-w-0 flex-1 title truncation + wrapping description, clean optional slot omission, and state layers
  - Tonal MD3 Badge (apps/web/src/components/ui/Badge.tsx) using Icon.tsx ('error', 'person') and MD3 container color pairs
  - Light-DOM MD3 SegmentedControl (apps/web/src/components/ui/SegmentedControl.tsx) with role="radiogroup", shrink-0 role="radio" pills, roving Arrow/Home/End keyboard navigation, scrollIntoView, and locked active selection
  - MD3 Skeleton & SkeletonRows (apps/web/src/components/ui/Skeleton.tsx) using surfaceContainerHighest blocks while preserving 200ms useDelayedVisible and rows={0} empty state
  - MD3 FormMessage (apps/web/src/components/ui/FormMessage.tsx) preserving <div role="alert"><p>...</p></div> DOM hierarchy, max-w-[70ch], and Icon name="error"
  - MD3 CopyButton (apps/web/src/components/ui/CopyButton.tsx) using Icon name="content_copy" and preserving persistent error Snackbar copy
  - Expanded primitives.test.tsx covering all 7 light-DOM primitives with zero lucide-react or radix-ui imports remaining in apps/web/src/components/ui/

affects: [17-10, 17-11, 18, 19, 20]

actuals:
  tokens: 7400
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 06bddabd6ed2e3045b0c6fbd345a29bc534f2cfd
plan_head_after: e6fe8ffbc1029a4a36557619dcad6ae6cbfff1bc

tech-stack:
  added: []
  patterns:
    - "Light-DOM MD3 radiogroup SegmentedControl using <button type='button' role='radio'> with onKeyDown/onBlur on interactive buttons to satisfy jsx-a11y without static element listeners"
    - "Borderless tonal surfaces (.hestia-card + surfaceContainerLow/surfaceContainer) omitting overflow-hidden so nested menus and popovers never clip"
    - "Optional slot omission helper (hasSlotContent) preventing empty spacer spans in ListRow when leading, description, or trailing are undefined"

key-files:
  created: []
  modified:
    - apps/web/src/components/ui/Card.tsx
    - apps/web/src/components/ui/ListRow.tsx
    - apps/web/src/components/ui/Badge.tsx
    - apps/web/src/components/ui/SegmentedControl.tsx
    - apps/web/src/components/ui/Skeleton.tsx
    - apps/web/src/components/ui/FormMessage.tsx
    - apps/web/src/components/ui/CopyButton.tsx
    - apps/web/src/components/ui/primitives.test.tsx

key-decisions:
  - "Replaced Radix ToggleGroup in SegmentedControl with light-DOM role='radiogroup' and button[role='radio'] implementing roving Arrow/Home/End focus, RTL support, scrollIntoView, and locked active selection"
  - "Upgraded Card (.hestia-card, surfaceContainerLow/surfaceContainer, elevation-1, no overflow-hidden), ListRow (min-h-12, optional slot omission), Badge/FormMessage/CopyButton (Icon.tsx), and Skeleton (surface-container-highest)"

patterns-established:
  - "All modules in apps/web/src/components/ui/ are 100% migrated onto @material/web adapters, native <dialog>, light-DOM MD3 tokens, and Icon.tsx with zero lucide-react or radix-ui imports"

requirements-completed:
  - FND-04

coverage:
  - id: D1
    description: "Card and ListRow render MD3 tonal surfaces (min-h-12, truncated titles, omitted undefined slots) without overflow-hidden popover clipping"
    requirement: FND-04
    verification:
      - kind: unit
        ref: "apps/web/src/components/ui/primitives.test.tsx#Badge and Card, ListRow"
        status: pass
    human_judgment: false
  - id: D2
    description: "Badge and SegmentedControl render MD3 tonal pills, Icon.tsx glyphs, shrink-0 horizontal scroll items, roving Arrow/Home/End keys, and locked active selection without Radix ToggleGroup"
    requirement: FND-04
    verification:
      - kind: unit
        ref: "apps/web/src/components/ui/primitives.test.tsx#Badge and Card, SegmentedControl"
        status: pass
    human_judgment: false
  - id: D3
    description: "Skeleton/SkeletonRows, FormMessage, and CopyButton apply MD3 tonal tokens, preserve role='status' 200ms delay / <div role='alert'><p> DOM contract / clipboard error snackbar, and remove all lucide-react/radix-ui imports from components/ui/"
    requirement: FND-04
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx src/components/ui/Toast.test.tsx src/components/ui/Icon.test.tsx"
        status: pass
      - kind: unit
        ref: "pnpm --filter @hestia/web typecheck && pnpm lint"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-11-12
status: complete
---

# Phase 17 Plan 09: Remaining Light-DOM MD3 Gap Primitives Summary

**Upgraded all 7 remaining light-DOM `components/ui/` primitives (`Card`, `ListRow`, `Badge`, `SegmentedControl`, `Skeleton`, `FormMessage`, `CopyButton`) onto Warm Terracotta MD3 tonal tokens and `Icon.tsx`, eliminating all `lucide-react` and `radix-ui` imports from `apps/web/src/components/ui/` and verifying all 7 in `primitives.test.tsx`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-11-12T15:00:01Z
- **Completed:** 2026-11-12T15:09:55Z
- **Tasks:** 2 (Task 1 tracer + Task 2)
- **Files modified:** 8
- **Measured diff tokens (`chars/4`):** 7,400

## Accomplishments

- **Task 1 (tracer) — `Card`, `ListRow`, `Badge`, and `SegmentedControl`**:
  - Upgraded `Card.tsx` to `.hestia-card` borderless tonal surfaces (`--md-sys-color-surface-container-low` for `flat`, `--md-sys-color-surface-container` + `--md-sys-elevation-1` for `raised`, `--md-sys-shape-corner-medium` `12px` radius, `p-4`, zero `overflow-hidden`).
  - Upgraded `ListRow.tsx` with `min-h-12` (`48dp`), `min-w-0 flex-1` truncated single-line title + wrapping `break-words` description, clean omission of undefined/empty `leading`/`description`/`trailing` slots via `hasSlotContent`, MD3 hover/active state layers, and zero `overflow-hidden`.
  - Upgraded `Badge.tsx` onto MD3 tonal container tokens (`surface-container-high`, `secondary-container`, `warning-container`, `error-container`), `whitespace-nowrap`, and `<Icon name="error" size={14} />` / `<Icon name="person" size={14} />`.
  - Replaced `radix-ui` `ToggleGroup` in `SegmentedControl.tsx` with light-DOM `<div role="radiogroup" aria-label={label}>` (`overflow-x-auto`) and `shrink-0` `<button type="button" role="radio">` pills with roving `ArrowLeft`/`ArrowRight`/`Home`/`End` keyboard movement, RTL support, `scrollIntoView({ block: 'nearest', inline: 'nearest' })` on selection change, `<Icon name="check" size={16} />`, and locked active selection.
- **Task 2 — `Skeleton`, `FormMessage`, `CopyButton`, and `primitives.test.tsx`**:
  - Upgraded `Skeleton.tsx` block surface to `--md-sys-color-surface-container-highest` with `--md-sys-shape-corner-extra-small` radius while retaining `role="status"`, `aria-busy="true"`, `200ms` `useDelayedVisible`, `rows={0}` empty handling, and `data-testid="skeleton-row"`.
  - Upgraded `FormMessage.tsx` onto `--md-sys-color-error` and `<Icon name="error" size={20} />` while preserving the exact `<div role="alert"><p>...<span className="max-w-[70ch]">` DOM hierarchy for E2E spec 17.
  - Upgraded `CopyButton.tsx` to `<Icon name="content_copy" size={20} />` while preserving `CopyButtonProps` and the persistent clipboard-error `Snackbar` copy (`"Could not copy. Select the text and copy it by hand."`).
  - Expanded `primitives.test.tsx` (49 tests) to cover all 7 upgraded primitives and verified zero `lucide-react` or `radix-ui` imports remain anywhere in `apps/web/src/components/ui/`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Card, ListRow, Badge, and SegmentedControl** - `cd6318a` (`feat(web): upgrade Card, ListRow, Badge, SegmentedControl (17-09)`)
2. **Task 2: Skeleton, FormMessage, CopyButton, and primitives.test.tsx** - `e6fe8ff` (`feat(web): upgrade Skeleton, FormMessage, CopyButton, tests (17-09)`)

## Files Created/Modified

- `apps/web/src/components/ui/Card.tsx` - Borderless tonal `.hestia-card` surface with `flat`/`raised` variants and no `overflow-hidden`
- `apps/web/src/components/ui/ListRow.tsx` - 48dp MD3 list row with optional slot omission, title truncation, and state layers
- `apps/web/src/components/ui/Badge.tsx` - Tonal MD3 status pill using `Icon.tsx` (`error`, `person`)
- `apps/web/src/components/ui/SegmentedControl.tsx` - Light-DOM `role="radiogroup"` pill strip with roving keyboard nav and `scrollIntoView`
- `apps/web/src/components/ui/Skeleton.tsx` - MD3 `surfaceContainerHighest` skeleton blocks with 200ms delayed reveal
- `apps/web/src/components/ui/FormMessage.tsx` - Accessible `role="alert"` error wrapper with `Icon name="error"` and `max-w-[70ch]`
- `apps/web/src/components/ui/CopyButton.tsx` - Clipboard action button using `Icon name="content_copy"` and persistent error snackbar
- `apps/web/src/components/ui/primitives.test.tsx` - Expanded assertions covering all 7 light-DOM primitives (49 tests total)

## Decisions Made

- Placed `onKeyDown` and `onBlur` directly on each `<button type="button" role="radio">` in `SegmentedControl.tsx` rather than on the `<div role="radiogroup">` container so ESLint `jsx-a11y` static-element interaction rules stay clean without suppressions.
- Kept `Card.tsx` `raised` elevation bound to `shadow-[var(--md-sys-elevation-1)]` and updated `primitives.test.tsx` to assert MD3 elevation and `.hestia-card` tonal surface classes directly.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Running `shell.test.tsx` as an additional tracer check on `SegmentedControl` showed all 25 navigation/sub-tab/shell tests passing (`SegmentedControl` `radiogroup` & `ArrowRight`/`Enter` navigation passed) and 1 expected failure in `UpdateAvailable` (`<Button>` `md-text-button` selector sync scheduled for Wave 10–11).

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx src/components/ui/Toast.test.tsx src/components/ui/Icon.test.tsx`: **3 files, 69 tests passed** (`Icon.test.tsx`: 14, `Toast.test.tsx`: 6, `primitives.test.tsx`: 49).
- `pnpm --filter @hestia/web exec vitest run --project unit`: **14 files, 254 tests passed**.
- `pnpm --filter @hestia/web typecheck` and workspace `pnpm -r --parallel typecheck` (pre-commit): **passed**.
- `pnpm lint` (`eslint --max-warnings=0 .`): **passed with 0 errors and 0 warnings**.
- `pnpm prettier --check` on all 8 modified files: **passed**.
- Legacy import scan across `apps/web/src/components/ui/`: **passed** (`ZERO_LEGACY_IMPORTS_OK`).
- Note: repo-wide `pnpm format:check` was not run so orchestrator-owned `.planning/milestone.lock` / `.gsd/` files remain untouched.

## Next Phase Readiness

- `FND-04` is complete (`100%` of `apps/web/src/components/ui/` primitives migrated to MD3 tokens, `@material/web` adapters, native `<dialog>`, and `Icon.tsx`).
- Wave 10–11 test suite synchronization (`17-10`+) can now execute against the finished Phase 17 UI primitive layer.

---
*Phase: 17-md3-foundation-token-pipeline-ui-primitives*
*Completed: 2026-11-12*

## Self-Check: PASSED

