---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 06
subsystem: ui
tags: [md3, material-web, lit-react, button, text-field, date-field, time-field, select, vitest]

requires:
  - phase: 17-03
    provides: ESLint MD import boundary, element-internals-polyfill, md-queries.ts, MdButton, MdTextField, MdSelect, omitUndefined
  - phase: 17-04
    provides: MdProgress (MdCircularProgress), D-13 jsdom smoke gate baseline
  - phase: 17-05
    provides: Icon.tsx SVG path primitive ('error', 'expand_more', etc.)

provides:
  - MD3 Button wrapper (MdFilledButton, MdOutlinedButton, MdTextButton, MdIconButton, MdCircularProgress) preserving BUTTON_BASE, disabled vs softDisabled separation, and type="button" default
  - 56px MD3-framed native DateField and TimeField primitives
  - MD3 Field module (TextField, TextAreaField, FieldFrame, FieldChangeEvent, NativePickerField) with type='date'|'time' delegation and zero as casts
  - Responsive MD3 Select wrapper (coarse pointer native <select> with expand_more icon; fine pointer MdOutlinedSelect with menuPositioning="fixed")
  - Widened HTMLElement ref and shadow-DOM focus delegation in IngredientRow, ChangeEmailForm, and ChangePasswordForm
  - Vitest dom test fix preventing jsdom decimal.js ESM/CJS mismatch under ElementInternals forms

affects: [17-07, 17-08, 17-09, 17-10]

tech-stack:
  added: []
  patterns:
    - 'Cast-free event target property reads via in-narrowing + Reflect.get and Ref forwarding via Reflect.set'
    - 'Native <input type="date"> / <input type="time"> and coarse-pointer <select> framed inside FieldFrame (min-h-14, 1rem text, --md-sys-color-* outline/error tokens)'
    - 'Vitest dom project conditions limited to ["browser", "development"] so Node does not force ESM import on jsdom decimal.js'

key-files:
  created:
    - apps/web/src/components/ui/DateField.tsx
    - apps/web/src/components/ui/TimeField.tsx
  modified:
    - apps/web/src/components/ui/Button.tsx
    - apps/web/src/components/ui/Field.tsx
    - apps/web/src/components/ui/Select.tsx
    - apps/web/src/components/ui/primitives.test.tsx
    - apps/web/src/components/meals/IngredientRow.tsx
    - apps/web/src/screens/settings/account/ChangeEmailForm.tsx
    - apps/web/src/screens/settings/account/ChangePasswordForm.tsx
    - apps/web/vite.config.ts

key-decisions:
  - 'Pass explicit ariaInvalid: "true" | undefined (zero as casts) to MdOutlinedTextField and MdOutlinedSelect, keeping host error attributes compatible with useFieldErrors'
  - 'Limit Vitest dom project resolve.conditions and ssr.resolve.conditions to ["browser", "development"] so CJS require("decimal.js") inside jsdom HTMLInputElement-impl.js does not load decimal.mjs as a non-constructor module namespace'
  - 'Focus md-icon-button inner shadow <button> in primitives.test.tsx OverflowMenu keyboard test because jsdom userEvent.tab() and host.focus() do not implement delegatesFocus on md-icon-button'

patterns-established:
  - 'FieldFrame wrapper provides shared 56px MD3 outline, focus/error border, and role="alert" FormMessage layout for native date/time/coarse-select controls'
  - 'Form screens using DateField alongside MdOutlinedTextField validate cleanly under ElementInternals without stepMismatch crashes'

requirements-completed: []

duration: 25min
completed: 2026-11-12
status: complete
commits: 3
plan_head_before: 951e0b5b295c10438e6e3d73527d47105f4ea890
plan_head_after: bf3774ee3357ca4b3d1b38340091c7678d0d692b
actuals:
  tokens: 14065
  tasks: 3
  commits: 3
---

# Phase 17 Plan 06: MD3 Button, Field, Date/Time, and Select Summary

**Upgraded `Button`, `TextField`, `TextAreaField`, and `Select` onto `components/md/` adapters with 56px native `DateField`/`TimeField` framing, widened `HTMLElement` refs in form callers, and zero `as` casts.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-11-12T13:24:18Z
- **Completed:** 2026-11-12T13:48:56Z
- **Tasks:** 3 (Task 1 tracer + Task 2 + Task 3)
- **Files modified:** 10 (2 created, 8 modified)
- **Measured diff tokens (`chars/4`):** 14,065

## Accomplishments

- **Button (`apps/web/src/components/ui/Button.tsx`)**: Upgraded onto `MdFilledButton` (`primary` / `destructive`), `MdOutlinedButton` (`secondary`), `MdTextButton` (`ghost`), `MdIconButton` (`isIconOnly`), and `MdCircularProgress` (`isLoading`) with zero `as` casts, preserving `BUTTON_BASE`, defaulting `type` to `'button'`, separating native `disabled={Boolean(disabled)}` from `softDisabled={Boolean(disabledReason) || isLoading}`, guarding `onClick`, and forwarding `Ref<HTMLElement>` + `autoFocus`. Updated the 3 `useRef` screen callers (`IngredientRow.tsx`, `ChangeEmailForm.tsx`, `ChangePasswordForm.tsx`) to `HTMLElement` and widened focus selectors in `ChangeEmailForm` and `ChangePasswordForm` to `'md-outlined-text-field, input'`.
- **Field, DateField, and TimeField (`apps/web/src/components/ui/Field.tsx`, `DateField.tsx`, `TimeField.tsx`)**: Upgraded `TextField` and `TextAreaField` (`rows = 4` default) onto `MdOutlinedTextField` with cast-free `FieldChangeEvent` normalization (`onInput` + `onChange`), `autoComplete` -> `autocomplete` mapping, and `type="date" | "time"` delegation to new 56px (`min-h-14`, `1rem`) `DateField` and `TimeField` primitives rendered in a shared MD3-styled `FieldFrame` with `<Icon name="error" size={16} />`.
- **Select (`apps/web/src/components/ui/Select.tsx`)**: Kept coarse-pointer `(pointer: coarse)` native `<select>` at 56px MD3 outlined styling with `<Icon name="expand_more" size={18} />`, and upgraded fine-pointer select onto `<MdOutlinedSelect menuPositioning="fixed">` with `<MdSelectOption>` preserving array ordering and handling empty `options` / unmatched `value` cleanly.
- **Primitive Tests (`apps/web/src/components/ui/primitives.test.tsx`)**: Updated `Button`, `TextField and TextAreaField`, `DateField and TimeField`, and `Select` specs (plus `OverflowMenu` and `ConfirmDialog` button queries impacted by `Button`'s MD3 host) using `apps/web/src/test/md-queries.ts`, passing 40/40 tests in `primitives.test.tsx`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Upgrade Button and HTMLElement ref callers** - `172aacc` (`feat(web): upgrade Button and HTMLElement ref callers (17-06)`)
2. **Task 2: Add DateField/TimeField and upgrade Field** - `e77e376` (`feat(web): add DateField/TimeField and upgrade Field (17-06)`)
3. **Task 3: Upgrade Select, update primitive tests, and fix Vitest jsdom conditions** - `bf3774e` (`feat(web): upgrade Select and update primitive tests (17-06)`)

## Files Created/Modified

- `apps/web/src/components/ui/Button.tsx` — MD3 Button wrapper and error-token destructive styling
- `apps/web/src/components/meals/IngredientRow.tsx` — Widened button/field `useRef` to `HTMLElement`
- `apps/web/src/screens/settings/account/ChangeEmailForm.tsx` — Widened `useRef<HTMLElement>` + `'md-outlined-text-field, input'` selector
- `apps/web/src/screens/settings/account/ChangePasswordForm.tsx` — Widened `useRef<HTMLElement>` + `'md-outlined-text-field, input'` selector
- `apps/web/src/components/ui/DateField.tsx` — 56px MD3-framed native date picker primitive
- `apps/web/src/components/ui/TimeField.tsx` — 56px MD3-framed native time picker primitive
- `apps/web/src/components/ui/Field.tsx` — `MdOutlinedTextField` wrappers, `FieldFrame`, `NativePickerField`, `FieldChangeEvent`
- `apps/web/src/components/ui/Select.tsx` — Coarse native `<select>` + fine-pointer `MdOutlinedSelect` (`menuPositioning="fixed"`)
- `apps/web/src/components/ui/primitives.test.tsx` — Updated MD3 unit/DOM test coverage for upgraded form primitives (40/40 passing)
- `apps/web/vite.config.ts` — Removed `'import'`, `'module'`, `'default'` from `dom` test project `resolve.conditions` / `ssr.resolve.conditions`

## Decisions Made

- Used an explicit `'true' | undefined` annotation for `ariaInvalid` passed to `MdOutlinedTextField` and `MdOutlinedSelect` rather than `string` inference or `as` casts.
- Left `FND-02` and `FND-04` unchecked in `.planning/REQUIREMENTS.md` because Plans `17-07`, `17-08`, and `17-09` also deliver parts of those requirements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Vitest `ssr.resolve.conditions` breaking `jsdom` `decimal.js` `stepMismatch` validation**
- **Found during:** Task 3 caller test run (`src/screens/chores/household-timezone.test.tsx`, `errands.test.tsx`, `chores.test.tsx`)
- **Issue:** Having `'import'` in `apps/web/vite.config.ts`'s `dom` project `ssr.resolve.conditions` made Vitest pass `--conditions import` to Node workers, causing `jsdom`'s CJS `require("decimal.js")` in `HTMLInputElement-impl.js` to load `decimal.mjs` as a module namespace object and throw `TypeError: Decimal is not a constructor` whenever `<MdOutlinedTextField>` triggered `element-internals-polyfill` `setFormValidity` on a `<form>` containing `<DateField>` (`<input type="date">`).
- **Fix:** Narrowed `dom` project `resolve.conditions` and `ssr.resolve.conditions` in `apps/web/vite.config.ts` to `['browser', 'development']`, preserving `@material/web`/Lit browser exports while keeping Node CJS `require("decimal.js")` intact.
- **Files modified:** `apps/web/vite.config.ts`
- **Commit:** `bf3774e`

**2. [Rule 3 - Blocking] Updated `ConfirmDialog` and `OverflowMenu` tests in `primitives.test.tsx` for MD3 `<Button>` host**
- **Found during:** Task 3 verification of `primitives.test.tsx`
- **Issue:** `ConfirmDialog` and `OverflowMenu` wrap `<Button>`, so their trigger/confirm buttons became `<md-icon-button>` and `<md-filled-button>`, causing `screen.getByRole('button', ...)` and jsdom `userEvent.tab()` to fail before Plan `17-07` migrates those two primitives.
- **Fix:** Switched those button lookups in `primitives.test.tsx` to `getMdButton(...)` and focused the `md-icon-button` inner `<button>` for the jsdom `Enter` keyboard test.
- **Files modified:** `apps/web/src/components/ui/primitives.test.tsx`
- **Commit:** `bf3774e`

## Verification & Scope Notes

- `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx`: **40/40 passed** after final edit.
- `pnpm --filter @hestia/web exec vitest run --project unit`: **14 files, 254/254 passed**.
- `pnpm --filter @hestia/web typecheck` (`tsc --noEmit`) & Husky `pnpm -r --parallel typecheck`: **passed (0 errors)**.
- `pnpm lint` (`eslint --max-warnings=0 .`): **passed (0 errors, 0 warnings)**.
- `pnpm prettier --check` on all 10 created/modified files: **passed**. Repo-wide `pnpm format:check` flags only orchestrator-owned `.gsd/dispatch-isolation-sentinel.json` (left untouched).
- Caller DOM tests (`pnpm --filter @hestia/web exec vitest run --project dom` prior to the `vite.config.ts` fix, plus post-fix `src/screens/chores/household-timezone.test.tsx` where `a new chore's anchor starts on the household's today` passed): screen tests that query `getByRole('button', ...)` or `getByLabelText(...)` fail as expected until Plan `17-10` migrates screen test queries onto `md-queries.ts`.
- `pnpm --filter @hestia/web build`: Vite client + service worker build succeeded cleanly; `node scripts/check-build.mjs` failed the 200 KB app-shell gzip budget check (`217.7 KB`) transiently because `radix-ui` and `@material/web` coexist until Plans `17-07`–`17-09` complete the remaining component migrations.

## Next Phase Readiness

- Ready for Wave 7 (`17-07-PLAN.md`: `Switch`, `Checkbox`, `ConfirmDialog`, `OverflowMenu`, `Tabs`, and remaining focus selector updates).

## Self-Check: PASSED
- Verified all 10 files exist (`Button.tsx`, `Field.tsx`, `DateField.tsx`, `TimeField.tsx`, `Select.tsx`, `primitives.test.tsx`, `IngredientRow.tsx`, `ChangeEmailForm.tsx`, `ChangePasswordForm.tsx`, `vite.config.ts`).
- Verified commits `172aacc`, `e77e376`, and `bf3774e` are ancestors of `HEAD` (`bf3774e`), matching `plan_head_before` (`951e0b5b295c10438e6e3d73527d47105f4ea890`) + `commits: 3`.
