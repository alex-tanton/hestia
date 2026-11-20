---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 04
subsystem: ui
tags: [material-web, lit-react, md3, jsdom, element-internals-polyfill, vitest]

requires:
  - phase: 17-03
    provides: "@lit/react@1.0.8 adapter convention, baseline MdButton/MdCheckbox/MdTextField/MdSelect adapters, and useFieldErrors hook"
provides:
  - "Complete apps/web/src/components/md/ @material/web@2.5.0 adapter layer (MdSwitch, MdRadio, MdDialog, MdMenu, MdTabs, MdProgress)"
  - "Vitest dom project browser export conditions and inlined Lit/@material/web deps so jsdom loads client reactive-element rather than SSR isServer mode"
  - "ElementInternals.prototype.setValidity boolean coercion and matchMedia/scrollTo shims in apps/web/src/test-setup.ts"
  - "useFieldErrors compatibility with @material/web delegated aria attributes (data-aria-invalid and error host property)"
  - "Verified D-13 five-check Material Web jsdom smoke gate in apps/web/src/components/ui/primitives.test.tsx"
affects:
  - 17-05
  - 17-06
  - 17-07
  - 17-08
  - 17-09

actuals:
  tokens: 5940
  tasks: 2
  commits: 2
plan_head_before: b9cade5e0febc0ea9f5d28d1fb79e59c97a8e8e0
plan_head_after: dae44c10174cec0869b6311a5ea202fba000d64b

tech-stack:
  added: []
  patterns:
    - "Vitest 5 dom project configures ssr.resolve.conditions=['browser', 'development', 'import', 'module', 'default'] and server.deps.inline for Lit/@material/web"
    - "test-setup.ts normalizes ElementInternals.prototype.setValidity flags via Boolean(value) and shims window.matchMedia + Element.prototype.scrollTo"
    - "useFieldErrors queries [aria-invalid=\"true\"], [data-aria-invalid=\"true\"], [error]:not([error=\"false\"]) with Reflect.get(element, 'error') fallback"

key-files:
  created:
    - apps/web/src/components/md/MdSwitch.tsx
    - apps/web/src/components/md/MdRadio.tsx
    - apps/web/src/components/md/MdDialog.tsx
    - apps/web/src/components/md/MdMenu.tsx
    - apps/web/src/components/md/MdTabs.tsx
    - apps/web/src/components/md/MdProgress.tsx
  modified:
    - apps/web/src/components/ui/primitives.test.tsx
    - apps/web/src/test-setup.ts
    - apps/web/src/lib/use-field-errors.ts
    - apps/web/vite.config.ts

key-decisions:
  - "Kept jsdom@30.1.0 + element-internals-polyfill@3.0.2 without escalating to @vitest/browser-playwright by fixing Vitest SSR export conditions and standard Web API/polyfill shims"
  - "Inlined @material/web, @lit/*, and lit* in apps/web/vite.config.ts dom project so client-side Lit ReactiveElement executes in jsdom instead of node isServer build"
  - "Coerced ElementInternals.setValidity flag values to strict booleans in test-setup.ts using Object.getOwnPropertyDescriptor + Reflect.apply to satisfy element-internals-polyfill strict !== false checks"
  - "Extended useFieldErrors invalid-field selector to match data-aria-invalid and error host state produced by @material/web mixinDelegatesAria"

patterns-established:
  - "All Material Web @lit/react adapters enforce zero type casts and avoid redundant host role attributes"
  - "Tests inspect Lit event.currentTarget properties via Reflect.get narrowing rather than type assertions"

requirements-completed:
  - FND-02

coverage:
  - id: D1
    description: "Remaining six @material/web@2.5.0 @lit/react@1.0.8 adapters (MdSwitch, MdRadio, MdDialog, MdMenu, MdTabs, MdProgress) with zero type casts and no redundant host roles"
    requirement: FND-02
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web typecheck && pnpm lint"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-13 five-check Material Web smoke gate passing cleanly under jsdom@30.1.0 + element-internals-polyfill@3.0.2"
    requirement: FND-02
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx#D-13 Material Web jsdom smoke gate"
        status: pass
    human_judgment: false

duration: 20 min
completed: 2026-11-12
status: complete
---

# Phase 17 Plan 04: Material Web Adapters & D-13 jsdom Gate Summary

**Completed the remaining six `@material/web@2.5.0` `@lit/react@1.0.8` adapters (`MdSwitch`, `MdRadio`, `MdDialog`, `MdMenu`, `MdTabs`, `MdProgress`) and verified all five `D-13` smoke checks in `jsdom@30.1.0` without escalating to `@vitest/browser-playwright`.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-11-12T07:41:25Z
- **Completed:** 2026-11-12T08:01:34Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Implemented `MdSwitch`, `MdRadio`, `MdDialog`, `MdMenu`, `MdTabs`, and `MdProgress` in `apps/web/src/components/md/` using `@lit/react@1.0.8` `createComponent` with zero type casts and no redundant host ARIA `role` attributes.
- Resolved Vitest 5 SSR module resolution for `@lit/reactive-element` in the `dom` project (`ssr.resolve.conditions` + `server.deps.inline`), added `window.matchMedia` / `Element.prototype.scrollTo` shims and `ElementInternals.prototype.setValidity` boolean coercion in `test-setup.ts`, and verified all 5 `D-13` checks cleanly in `apps/web/src/components/ui/primitives.test.tsx` (37/37 tests passing in `primitives.test.tsx`).
- Updated `useFieldErrors` (`apps/web/src/lib/use-field-errors.ts`) so invalid-field focus recovery finds `@material/web` controls whose `mixinDelegatesAria` strips `aria-invalid` onto `data-aria-invalid` or reflects `error` on the host.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Create remaining six Material Web @lit/react adapters** - `3a3aa55` (`feat(web): add remaining Material Web @lit/react adapters (17-04)`)
2. **Task 2 (auto): Add D-13 Material Web jsdom smoke gate** - `dae44c1` (`test(web): add D-13 Material Web jsdom smoke gate (17-04)`)

## Files Created/Modified

- `apps/web/src/components/md/MdSwitch.tsx` - Switch `@lit/react` adapter with `selected` and `input`/`change` event wiring
- `apps/web/src/components/md/MdRadio.tsx` - Radio `@lit/react` adapter with `checked`, `name`, `value`, and `input`/`change` wiring
- `apps/web/src/components/md/MdDialog.tsx` - Modal dialog `@lit/react` adapter with `open`, `closed`, and `cancel` event wiring
- `apps/web/src/components/md/MdMenu.tsx` - Menu and `MdMenuItem` `@lit/react` adapters with `opened`/`closed` and item activation wiring
- `apps/web/src/components/md/MdTabs.tsx` - `MdTabs`, `MdPrimaryTab`, and `MdSecondaryTab` `@lit/react` adapters
- `apps/web/src/components/md/MdProgress.tsx` - `MdLinearProgress` and `MdCircularProgress` `@lit/react` adapters
- `apps/web/src/components/ui/primitives.test.tsx` - D-13 five-check Material Web `jsdom` smoke gate (`37/37` tests passing)
- `apps/web/vite.config.ts` - `dom` project `ssr.resolve.conditions` (`browser`) and `server.deps.inline` for Lit/`@material/web`
- `apps/web/src/test-setup.ts` - `window.matchMedia`, `Element.prototype.scrollTo`, and `ElementInternals.prototype.setValidity` boolean flag normalization
- `apps/web/src/lib/use-field-errors.ts` - `findFirstInvalidField` matching `[aria-invalid="true"]`, `[data-aria-invalid="true"]`, `[error]:not([error="false"])`, or `Reflect.get(element, 'error') === true`

## Decisions Made

- **Kept `jsdom@30.1.0` + `element-internals-polyfill@3.0.2` (no Playwright escalation):** The initial `jsdom` failures stemmed from Vitest 5's SSR export resolution (`isServer === true`), missing standard DOM APIs (`matchMedia`, `scrollTo`), and `element-internals-polyfill` rejecting undefined/boolean-coerced `setValidity` keys — all standard environment fixes rather than private `@material/web` internal hacks.
- **Configured browser conditions in Vitest `dom` project:** Added `ssr.resolve.conditions` with `'browser'` and `server.deps.inline` for `/@material\/web/`, `/^@lit\//`, and `/^lit(?:-|$|\/)/` so Lit client reactive lifecycle executes in `jsdom`.
- **Extended `useFieldErrors` host selector:** `@material/web`'s `mixinDelegatesAria` moves host `aria-invalid` into `data-aria-invalid` and manages `error` asynchronously, so matching `[data-aria-invalid="true"]` and `[error]:not([error="false"])` / `Reflect.get(element, 'error')` ensures form submit validation reliably focuses invalid Material Web inputs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Vitest 5 SSR module resolution and jsdom environment shims for Material Web**
- **Found during:** Task 2 (`D-13 Material Web jsdom smoke gate`)
- **Issue:** Vitest 5 loaded `@lit/reactive-element/node/development/reactive-element.js` (`isServer === true`) skipping Material Web client event/validation setup; `md-tabs` / ripple called unimplemented `window.matchMedia` and `Element.prototype.scrollTo`; `RadioValidator` passed non-strict boolean flags triggering `element-internals-polyfill` `ValidityState.js` TypeError.
- **Fix:** Configured `ssr.resolve.conditions` and `server.deps.inline` in `apps/web/vite.config.ts`, and added `matchMedia`, `Element.prototype.scrollTo`, and `ElementInternals.prototype.setValidity` boolean normalization in `apps/web/src/test-setup.ts`.
- **Files modified:** `apps/web/vite.config.ts`, `apps/web/src/test-setup.ts`
- **Verification:** `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx` (`37 passed`), `pnpm --filter @hestia/web typecheck`, and `pnpm lint` passed.
- **Committed in:** `dae44c1` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed `useFieldErrors` first-invalid selector for Material Web `mixinDelegatesAria`**
- **Found during:** Task 2 (`D-13` Check 1: `useFieldErrors` focusing invalid `md-outlined-text-field`)
- **Issue:** `findFirstInvalidField` only queried `[aria-invalid="true"]`, whereas `@material/web`'s `mixinDelegatesAria` strips `aria-invalid` onto `data-aria-invalid` on the custom element host and reflects `error` asynchronously while `element-internals-polyfill` overwrites host `aria-invalid`.
- **Fix:** Expanded `findFirstInvalidField` in `apps/web/src/lib/use-field-errors.ts` to match `[aria-invalid="true"], [data-aria-invalid="true"], [error]:not([error="false"])` and fall back to `Reflect.get(element, 'error') === true`.
- **Files modified:** `apps/web/src/lib/use-field-errors.ts`
- **Verification:** `D-13` Check 1 focuses `md-outlined-text-field` host and sets shadow `<input aria-invalid="true">` (`37/37` tests pass).
- **Committed in:** `dae44c1` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking environment/polyfill fix, 1 Rule 1 bug fix in `useFieldErrors`)
**Impact on plan:** Both fixes were required for genuine Material Web + React 19 behavior in `jsdom` and real DOM; no scope creep and zero private `@material/web` internal monkeypatching.

## Issues Encountered

- Running `pnpm format:check` across the entire repo fails only on the orchestrator-owned untracked `.gsd/dispatch-isolation-sentinel.json` if present; running `pnpm prettier --check` directly on all modified files passed with zero formatting issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All `@material/web@2.5.0` `@lit/react@1.0.8` adapters under `apps/web/src/components/md/` are complete and verified under `jsdom@30.1.0` + `element-internals-polyfill@3.0.2`.
- Ready for Wave 5 (`17-05`, installing `@material-symbols/svg-400`) and Waves 6–9 (`components/ui/*` primitive upgrades).

---
*Phase: 17-md3-foundation-token-pipeline-ui-primitives*
*Completed: 2026-11-12*

## Self-Check: PASSED
