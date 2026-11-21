---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 08
subsystem: ui
tags: [md3, dialog, bottom-sheet, snackbar, toast, css, vitest, tailwind]

requires:
  - phase: 17-05
    provides: Icon.tsx SVG path primitive ('close', 'check_circle', 'error', 'info')
  - phase: 17-06
    provides: MD3 Button primitive and Field shadow-DOM contracts
  - phase: 17-07
    provides: Interactive MD3 controls (OverflowMenu, ConfirmDialog, MdDialog) and shadow-DOM focus patterns

provides:
  - gap-primitives.css (apps/web/src/styles/gap-primitives.css) imported in index.css with native dialog top-layer @starting-style transitions, :modal/::backdrop overscroll-behavior contain scroll lock, forced-colors hairlines, and .hestia-native-field sizing
  - ModalBottomSheet primitive (apps/web/src/components/ui/ModalBottomSheet.tsx) using native <dialog>.showModal(), closedby="any", Safari pointerdown/pointerup backdrop fallback, returnValue reset, and trigger focus restoration
  - Sheet primitive (apps/web/src/components/ui/Sheet.tsx) delegating to ModalBottomSheet while preserving SheetProps and removing Radix Dialog / Lucide imports
  - Snackbar & single-slot FIFO ToastProvider (apps/web/src/components/ui/Toast.tsx) with D-11 persistent Undo/error rules, 4000ms non-action auto-dismiss, MD3 inverse/error-container styling, and zero Radix Toast / Lucide imports
  - Updated Sheet tests in primitives.test.tsx, rewritten FIFO Snackbar & persistent Undo tests in Toast.test.tsx, and Wave 6-8 MD3 Shadow DOM & persistent Undo updates in chores.test.tsx

affects: [17-09, 17-10]

tech-stack:
  added: []
  patterns:
    - 'Native <dialog>.showModal() bottom sheet with closedby="any" and !("closedBy" in HTMLDialogElement.prototype) pointerdown/pointerup fallback skipping zero-rect stubs'
    - 'Native DOM listeners (keydown/pointerdown/pointerup) attached via useEffect on <dialog tabIndex={-1}> to keep JSX free of noninteractive-element-interactions violations and ensure jsdom Escape focus capture'
    - 'Single-slot FIFO ToastProvider rendering queue[0] only; non-action success/info auto-dismisses at 4000ms while error and action-bearing (Undo) snackbars return Number.POSITIVE_INFINITY'
    - 'Lit updateComplete microtask await before inner shadow control focus in RotationEditor after disabled -> enabled transition'

key-files:
  created:
    - apps/web/src/styles/gap-primitives.css
    - apps/web/src/components/ui/ModalBottomSheet.tsx
  modified:
    - apps/web/src/index.css
    - apps/web/src/components/ui/Sheet.tsx
    - apps/web/src/components/ui/primitives.test.tsx
    - apps/web/src/components/ui/Toast.tsx
    - apps/web/src/components/ui/Toast.test.tsx
    - apps/web/src/screens/chores/chores.test.tsx
    - apps/web/src/components/chores/RotationEditor.tsx

key-decisions:
  - 'Track trigger element in Sheet via useState<HTMLElement | null> passed as ModalBottomSheet returnFocusTo prop so React Compiler react-hooks/refs allows cloneElement without passing a ref during render'
  - 'Attach keydown/pointerdown/pointerup listeners in ModalBottomSheet useEffect and apply tabIndex={-1} fallback focus when MdIconButton shadow button is not yet upgraded synchronously after showModal()'
  - 'Leave FND-04 pending in REQUIREMENTS.md because Plan 17-09 completes the remaining gap primitives (Card, ListRow, Badge, SegmentedControl, Skeleton, FormMessage, CopyButton)'

patterns-established:
  - 'Native <dialog>.hestia-sheet owns top-layer scroll locking, backdrop dismissal, returnValue reset, and trigger focus return without Radix Dialog'
  - 'ToastProvider schedules timers only when Number.isFinite(toastDuration(active)), keeping Undo and error snackbars visible until user action or explicit Dismiss'

requirements-completed: []

duration: 24min
completed: 2026-11-12
status: complete
commits: 2
plan_head_before: b3ae1b43e416601959e52a477dac2181d3c03692
plan_head_after: 07a01954c8fa46be05d8e9d92e9d2616e74bf690
actuals:
  tokens: 12071
  tasks: 2
  commits: 2
---

# Phase 17 Plan 08: Native ModalBottomSheet, Gap CSS & FIFO Snackbar Summary

**Replaced Radix Dialog and Radix Toast with native top-layer `<dialog>.showModal()` (`ModalBottomSheet` + `gap-primitives.css`) and a single-slot FIFO `Snackbar` queue with persistent `Undo`/error semantics, updating `primitives.test.tsx`, `Toast.test.tsx`, and `chores.test.tsx` for MD3 Shadow DOM and `D-11`.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-11-12T14:33:38Z
- **Completed:** 2026-11-12T14:57:30Z
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- Created `apps/web/src/styles/gap-primitives.css` (imported in `apps/web/src/index.css`) defining `dialog.hestia-sheet`, `:modal` and `::backdrop` `overscroll-behavior: contain` scroll locks, `@starting-style` + `transition-behavior: allow-discrete` top-layer motion gated under `@media (prefers-reduced-motion: no-preference)`, `@media (forced-colors: active)` hairlines, and `.hestia-native-field` sizing.
- Built `ModalBottomSheet` with native `<dialog>.showModal()`, `closedby="any"`, Safari `pointerdown`/`pointerup` light-dismiss fallback (ignoring zero-rect jsdom stubs), `returnValue` reset on close, `data-section` inheritance, accessible `aria-label="Close"` `MdIconButton` (`Icon name="close"`), and trigger focus restoration; delegated `Sheet` to `ModalBottomSheet` preserving `SheetProps`.
- Replaced Radix Toast with an MD3 single-slot FIFO `Snackbar` + `ToastProvider` where non-action `success`/`info` auto-dismiss after `4000`ms while `error` (`role="alert"`) and action-bearing `Undo` (`role="status"`) snackbars persist (`Number.POSITIVE_INFINITY`) until `Undo` or `Dismiss`.
- Updated `primitives.test.tsx` (Sheet native `showModal`, Close icon dismissal, Escape close + trigger focus restoration, Safari backdrop fallback & `returnValue` reset), `Toast.test.tsx` (duration rules, persistent error/Undo, FIFO queue progression), and `chores.test.tsx` (Wave 6–8 `md-queries.ts` shadow-DOM queries and persistent Undo snackbar behavior).

## Task Commits

1. **Task 1 (tracer): ModalBottomSheet, gap-primitives.css, Sheet delegation & primitives Sheet tests** — `00dfcdc` (`feat(web): add ModalBottomSheet, gap CSS, delegate Sheet (17-08)`)
2. **Task 2: MD3 FIFO Snackbar, Toast.test.tsx, chores.test.tsx MD3/D-11 updates & RotationEditor focus fix** — `07a0195` (`feat(web): implement FIFO Snackbar and update Undo tests (17-08)`)

## Files Created/Modified

- `apps/web/src/styles/gap-primitives.css` — Top-layer `<dialog.hestia-sheet>` styles, `@starting-style` transitions, scroll containment, forced-colors hairlines, `.hestia-native-field`
- `apps/web/src/index.css` — Imports `./styles/gap-primitives.css` after `./styles/tokens.css`
- `apps/web/src/components/ui/ModalBottomSheet.tsx` — Native modal bottom sheet primitive
- `apps/web/src/components/ui/Sheet.tsx` — Preserves `SheetProps` and delegates to `ModalBottomSheet`
- `apps/web/src/components/ui/primitives.test.tsx` — Expanded `Sheet` / `ModalBottomSheet` DOM tests (46 tests pass)
- `apps/web/src/components/ui/Toast.tsx` — `Snackbar`, `ToastProvider` single-slot FIFO queue, `toastDuration` (`4000` vs `Infinity`), `useToast`
- `apps/web/src/components/ui/Toast.test.tsx` — Rewritten for `D-11` durations, FIFO queue, persistent `Undo`/error, and `4000`ms auto-dismiss (6 tests pass)
- `apps/web/src/screens/chores/chores.test.tsx` — Updated for Wave 6–8 `md-queries.ts`, shadow `<input>`/`<button>` interaction, `softDisabled`/`errorText`, and persistent Undo snackbar (25 tests pass)
- `apps/web/src/components/chores/RotationEditor.tsx` — Awaits Lit `updateComplete` and focuses the inner control in `shadowRoot` when moving focus after a button transitions from disabled to enabled

## Decisions Made

- Used `useState<HTMLElement | null>` for `triggerElement` in `Sheet.tsx` so `cloneElement` passes `returnFocusTo={triggerElement}` cleanly under React Compiler's `react-hooks/refs` rule.
- Attached `keydown`/`pointerdown`/`pointerup` listeners via `useEffect` in `ModalBottomSheet.tsx` with `tabIndex={-1}` fallback focus on `<dialog>`, satisfying `jsx-a11y/no-noninteractive-element-interactions` and ensuring `Escape` reaches `<dialog>` in jsdom even before `MdIconButton`'s shadow button upgrades.
- Kept `FND-04` unchecked in `.planning/REQUIREMENTS.md` because Plan `17-09` finishes the remaining `FND-04` primitives (`Card`, `ListRow`, `Badge`, `SegmentedControl`, `Skeleton`, `FormMessage`, `CopyButton`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RotationEditor focus move ran before Lit `updateComplete` cleared `disabled` on `<md-icon-button>`**
- **Found during:** Task 2 (`chores.test.tsx` > `a rotation is reordered with the keyboard: focus follows the member, and the order is saved`)
- **Issue:** When Sam Chen moved to index 0, `Move Sam Chen down` transitioned from `disabled={true}` to `disabled={false}`, and `RotationEditor`'s synchronous `useEffect` called `target.focus()` while Lit's shadow `<button>` still had `disabled=""` and without shadow-DOM `delegatesFocus` support in jsdom.
- **Fix:** Updated `RotationEditor.tsx` focus effect to wait for `target.updateComplete` when present and focus `target.shadowRoot?.querySelector('button, a')` (falling back to `target.focus()`).
- **Files modified:** `apps/web/src/components/chores/RotationEditor.tsx`
- **Commit:** `07a0195`

## Verification

- `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/Toast.test.tsx src/screens/chores/chores.test.tsx src/components/ui/primitives.test.tsx src/components/ui/Icon.test.tsx`: **4 files, 91 tests passed** (`Icon.test.tsx`: 14, `Toast.test.tsx`: 6, `primitives.test.tsx`: 46, `chores.test.tsx`: 25); `Toast.test.tsx` re-run after Prettier formatting: **6/6 passed**.
- `pnpm --filter @hestia/web exec vitest run --project unit`: **14 files, 254 tests passed**.
- `pnpm --filter @hestia/web typecheck` and `pnpm -r --parallel typecheck`: **passed**.
- `pnpm lint` (`eslint --max-warnings=0 .`): **passed with 0 errors and 0 warnings**.
- `pnpm prettier --check` on all 9 modified/created files: **passed**.
- Note: repo-wide `pnpm format:check` continues to exclude orchestrator-owned `.gsd/dispatch-isolation-sentinel.json`, which was left untouched.

## Self-Check: PASSED

