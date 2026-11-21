---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 07
subsystem: ui
tags: [md3, material-web, lit-react, switch, checkbox, dialog, menu, tabs, vitest]

requires:
  - phase: 17-03
    provides: ESLint MD import boundary, element-internals-polyfill, md-queries.ts, MdSwitch, MdCheckbox, MdDialog, MdMenu, MdTabs, omitUndefined
  - phase: 17-05
    provides: Icon.tsx SVG path primitive ('more_vert', etc.)
  - phase: 17-06
    provides: MD3 Button (secondary/destructive/isLoading/Ref<HTMLElement>) and Field primitives

provides:
  - Switch primitive (apps/web/src/components/ui/Switch.tsx) wrapping MdSwitch with selected prop, normalized onCheckedChange, min-h-11 touch target, and variant="in-list"
  - Checkbox primitive upgraded onto MdCheckbox with CheckboxChangeEvent, indeterminate, variant="in-list", min-h-11 touch target, and zero as casts across all 5 callers
  - NotificationTypeRows migrated from <Checkbox role="switch"> to <Switch onCheckedChange={onChange} />
  - ConfirmDialog upgraded onto MdDialog (type="alert") with initial Cancel focus, blocked outside scrim cancellation, Escape/Cancel close, and isConfirming loading lock
  - OverflowMenu upgraded onto MdIconButton (Icon name="more_vert") + MdMenu (positioning="fixed", anchor) + MdMenuItem with disabledReason and empty-list safety
  - Tabs upgraded onto MdTabs + MdPrimaryTab (shrink-0) with activeTabIndex fallback, tabpanel linkage, scrollIntoView, and RTL-aware Arrow/Home/End keyboard handling
  - Initial-field shadow-DOM focus selectors updated in JoinHouseholdStep, MagicLinkCodeScreen, and RecipeForm

affects: [17-08, 17-09, 17-10]

tech-stack:
  added: []
  patterns:
    - 'Cast-free event target property reads (selected, checked, activeTabIndex) via in-narrowing'
    - 'MdSwitch input/change microtask deduplication so user clicks and synthetic input/change dispatches each invoke onCheckedChange once'
    - 'tabIndex={disabled ? undefined : 0} on MdCheckbox/MdSwitch hosts so @testing-library/user-event label activation and keyboard Tab recognize delegated shadow controls in jsdom'
    - 'ConfirmDialog scrim-cancel guard: track Escape keydown in ref and preventDefault on non-Escape cancel events'

key-files:
  created:
    - apps/web/src/components/ui/Switch.tsx
  modified:
    - apps/web/src/components/ui/Checkbox.tsx
    - apps/web/src/screens/settings/NotificationTypeRows.tsx
    - apps/web/src/components/ui/ConfirmDialog.tsx
    - apps/web/src/components/ui/OverflowMenu.tsx
    - apps/web/src/components/ui/Tabs.tsx
    - apps/web/src/components/ui/primitives.test.tsx
    - apps/web/src/screens/onboarding/JoinHouseholdStep.tsx
    - apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx
    - apps/web/src/screens/meals/RecipeForm.tsx

key-decisions:
  - 'Deduplicate MdSwitch onInput/onChange with a microtask flag so a real click (which emits both composed input and redispatched change) fires onCheckedChange once while standalone fireEvent.input or fireEvent.change still works'
  - 'Add tabIndex={disabled ? undefined : 0} to MdCheckbox and MdSwitch hosts inside <label htmlFor> because user-event label-click and Tab skip custom elements without a tabindex attribute in jsdom'
  - 'Handle ArrowLeft/ArrowRight/Home/End in Tabs onKeyDown with event.preventDefault() because jsdom nwsapi does not match :focus-within inside md-tabs focusedTab getter, while preventing double activation in real browsers'
  - 'Set quick on MdDialog in ConfirmDialog and assert Lit properties (positioning, anchor, type) rather than reflected attributes in primitives.test.tsx'

patterns-established:
  - 'Form-associated toggle primitives keep <label htmlFor> + min-h-11 row targets alongside host tabIndex={0} when enabled'
  - 'Tabs manages activeTabIndex fallback to index 0 on unmatched values and guards activeItem rendering when items is empty'

requirements-completed: []

duration: 33min
completed: 2026-11-12
status: complete
commits: 3
plan_head_before: c99fc15564963c9359b81ff8c53a518448b8c371
plan_head_after: 40b9c51c0450f10bc2472948d3d10afaacc65e01
actuals:
  tokens: 10452
  tasks: 3
  commits: 3
---

# Phase 17 Plan 07: Interactive & Selection Primitives Summary

**Added `Switch`, upgraded `Checkbox`, `ConfirmDialog`, `OverflowMenu`, and `Tabs` onto `@material/web` adapters via `components/md/`, migrated `NotificationTypeRows`, and updated shadow-DOM initial focus selectors in 3 screens with zero `as` casts.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-11-12T13:56:59Z
- **Completed:** 2026-11-12T14:31:10Z
- **Tasks:** 3 (Task 1 tracer + Task 2 + Task 3)
- **Files modified:** 10 (1 created, 9 modified)
- **Measured diff tokens (`chars/4`):** 10,452

## Accomplishments

- **Task 1 (tracer) — `Switch`, `Checkbox`, and `NotificationTypeRows`**:
  - Created `apps/web/src/components/ui/Switch.tsx` wrapping `MdSwitch` (`selected={Boolean(checked)}`, normalized `onInput`/`onChange`, `variant?: 'default' | 'in-list'`, `detail`, `min-h-11` label target, cast-free `readSwitchSelected`).
  - Migrated `apps/web/src/screens/settings/NotificationTypeRows.tsx` from `<Checkbox role="switch" ... />` to `<Switch onCheckedChange={onChange} ... />`.
  - Upgraded `apps/web/src/components/ui/Checkbox.tsx` onto `MdCheckbox` with `CheckboxChangeEvent` (`{ target: { checked }; currentTarget: { checked } }`), `indeterminate`, `variant="in-list"`, and `min-h-11` label target across all 5 callers without `as` casts.
- **Task 2 — `ConfirmDialog`, `OverflowMenu`, and `Tabs`**:
  - Upgraded `apps/web/src/components/ui/ConfirmDialog.tsx` onto `MdDialog` (`type="alert"`, `data-section`), focusing non-destructive secondary Cancel `<Button>` on open (`autoFocus`, `useEffect`, `onOpened`), blocking outside scrim `cancel` events without preceding Escape, handling Cancel/Escape close, and locking duplicate confirms with `isConfirming` `<Button isLoading>`.
  - Upgraded `apps/web/src/components/ui/OverflowMenu.tsx` onto `MdIconButton` (`<Icon name="more_vert" />`) + `MdMenu` (`positioning="fixed"`, `anchor`, `open`, `onClosed`) + `MdMenuItem` preserving item order, `isDestructive`, `(isDisabled ?? false) || disabledReason !== undefined`, `disabledReason` supporting text, and empty `items=[]` handling.
  - Upgraded `apps/web/src/components/ui/Tabs.tsx` onto `MdTabs` (`activeTabIndex`, `autoActivate`, RTL-aware keyboard nav) + `MdPrimaryTab` (`shrink-0`) with `tabpanel` ID linkage, `scrollIntoView({ block: 'nearest', inline: 'nearest' })`, unmatched-value fallback to index `0`, and empty `items=[]` safety.
- **Task 3 — Screen initial-field shadow-DOM focus selectors**:
  - Updated `querySelector` selectors to `'md-outlined-text-field, input, textarea'` in `JoinHouseholdStep.tsx`, `MagicLinkCodeScreen.tsx`, and `RecipeForm.tsx`.
- **Verification (`primitives.test.tsx`, `Icon.test.tsx`, `unit`, `typecheck`, `eslint`, Prettier)**:
  - `apps/web/src/components/ui/primitives.test.tsx`: 44/44 passed.
  - `apps/web/src/components/ui/Icon.test.tsx`: 14/14 passed.
  - `apps/web` `unit` Vitest project: 14/14 files, 254/254 tests passed.
  - `pnpm --filter @hestia/web typecheck` and workspace commit-hook `pnpm -r --parallel typecheck`: passed.
  - `pnpm lint` (`eslint --max-warnings=0 .`): passed with 0 errors and 0 warnings.
  - `pnpm prettier --check` on all 10 created/modified files: passed (`All matched files use Prettier code style!`). Note: repo-wide `pnpm format:check` was not run because orchestrator-owned `.gsd/dispatch-isolation-sentinel.json` is left untouched per orchestrator instructions. Un-migrated Wave 11/14 screen test files were intentionally not executed in this wave.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Switch, Checkbox, and NotificationTypeRows** - `1399424` (`feat(web): add Switch, upgrade Checkbox, migrate rows (17-07)`)
2. **Task 2: ConfirmDialog, OverflowMenu, and Tabs** - `164cf97` (`feat(web): upgrade ConfirmDialog, OverflowMenu, and Tabs (17-07)`)
3. **Task 3: Initial focus selectors for shadow fields** - `40b9c51` (`fix(web): update initial focus selectors for shadow fields (17-07)`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `tabIndex={disabled ? undefined : 0}` on `MdCheckbox` and `MdSwitch` hosts and microtask-deduplicated `MdSwitch` `onInput`/`onChange`**
- **Found during:** Task 1 (`primitives.test.tsx` tracer run)
- **Issue:** `@testing-library/user-event` label-click behavior skips `label.control` activation unless the control matches `FOCUSABLE_SELECTOR` (`[tabindex]:not([disabled])`), and clicking `<md-switch>` fires both composed `input` and redispatched `change` in one click.
- **Fix:** Added `tabIndex: disabled === true ? undefined : 0` via `omitUndefined` in `Checkbox.tsx` and `Switch.tsx`, and added a microtask guard in `Switch.tsx` so synchronous `input` + `change` emits `onCheckedChange` once while standalone `input` or `change` events also work.
- **Files modified:** `apps/web/src/components/ui/Checkbox.tsx`, `apps/web/src/components/ui/Switch.tsx`
- **Commit:** `1399424`

**2. [Rule 1 - Bug] Handled arrow/Home/End keyboard navigation in `Tabs` `onKeyDown`**
- **Found during:** Task 2 (`primitives.test.tsx` verification)
- **Issue:** `md-tabs` resolves `focusedTab` via `tab.matches(':focus-within')`, which fails in `jsdom`'s `nwsapi` selector engine and causes `ArrowRight` to re-focus index `0` instead of advancing.
- **Fix:** Added RTL-aware `ArrowLeft`/`ArrowRight`/`Home`/`End` navigation in `Tabs.tsx` `onKeyDown` calling `event.preventDefault()`, focusing the target `md-primary-tab`, and invoking `onValueChange` (preventing double navigation in `md-tabs` `handleKeydown`).
- **Files modified:** `apps/web/src/components/ui/Tabs.tsx`
- **Commit:** `164cf97`

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None (only UI primitive wrappers and screen focus selectors within the planned threat boundary `T-17-11`, `T-17-12`, and `T-17-SC`).

## Self-Check: PASSED

- All 10 created/modified files verified present on disk (`Switch.tsx`, `Checkbox.tsx`, `NotificationTypeRows.tsx`, `ConfirmDialog.tsx`, `OverflowMenu.tsx`, `Tabs.tsx`, `primitives.test.tsx`, `JoinHouseholdStep.tsx`, `MagicLinkCodeScreen.tsx`, `RecipeForm.tsx`).
- All 3 task commits verified as ancestors of `HEAD` (`1399424`, `164cf97`, `40b9c51`).
- Verification commands (`primitives.test.tsx`, `Icon.test.tsx`, `unit`, `typecheck`, `pnpm lint`, Prettier on modified files) passed after final code edits.
