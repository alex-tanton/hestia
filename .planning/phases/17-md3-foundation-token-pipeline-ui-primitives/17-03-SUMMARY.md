---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 03
subsystem: ui
tags: [md3, material-web, lit-react, eslint, jsx-a11y, jsdom, rtl]

# Dependency graph
requires:
  - phase: 17-md3-foundation-token-pipeline-ui-primitives
    provides: Vitest node vs jsdom project split and token pipeline (17-02)
provides:
  - ESLint @material/web/lit/@lit static and dynamic import boundaries with preserved CLOCK_READS/FORMATTER_READS
  - Explicit jsx-a11y/control-has-associated-label and label-has-associated-control error enforcement
  - Forced element-internals-polyfill and IntersectionObserver/animate/dialog jsdom shims in test-setup.ts
  - DRY shadow-aware RTL host query utilities in apps/web/src/test/md-queries.ts
  - Zero-cast omitUndefined helper and @lit/react wrappers (MdOutlinedTextField, MdFilledButton, MdOutlinedButton, MdTextButton, MdIconButton, MdOutlinedSelect, MdSelectOption, MdCheckbox)
affects: [17-04, 17-06, 17-07, 17-08, 17-09, 17-10, 17-11, 17-12, 17-13, 17-14, 17-15]

# Actuals (#2632) & measured commit ledger (#3968)
actuals:
  tokens: 6510
  tasks: 2
  commits: 2
plan_head_before: f9b46805a036079db72333e3ba6f98d3f0037d6e
plan_head_after: aeb09a7a99ebd565097464bb36b3678b8320dbf0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat ESLint config merges CLOCK_READS, FORMATTER_READS, and MD_IMPORT_EXPRESSION_SELECTORS on web tests so rule replacement never drops test clock enforcement"
    - "Zero-cast omitUndefined<T extends object>(props: T) via Reflect.set bridges TS6 exactOptionalPropertyTypes to @lit/react ElementProps"
    - "Shared createHostQueries factory in test/md-queries.ts traverses light DOM labels, headline slots, and shadowRoot without duplicating selectors across widget helpers"

key-files:
  created:
    - apps/web/src/components/md/props.ts
    - apps/web/src/components/md/MdTextField.tsx
    - apps/web/src/components/md/MdButton.tsx
    - apps/web/src/components/md/MdSelect.tsx
    - apps/web/src/components/md/MdCheckbox.tsx
    - apps/web/src/test/md-queries.ts
  modified:
    - eslint.config.js
    - apps/web/src/test-setup.ts

key-decisions:
  - "Preserved eslint-plugin-jsx-a11y default ignoreElements (audio, canvas, embed, input, textarea, tr, video), ignoreRoles, and includeRoles when enabling jsx-a11y/control-has-associated-label as error so label-has-associated-control owns <input> and media tags do not false-fail"
  - "Shimmed Element.prototype.animate in test-setup.ts with EventTarget-backed microtask 'finish' dispatch and currentTime: null so @material/web menu/field animations complete and ripple avoids dangling timers"
  - "Centralized Shadow DOM RTL queries behind createHostQueries in md-queries.ts, filtering hidden elements and closed md-dialog/md-menu hosts by default"

patterns-established:
  - "MD Adapter Boundary: @material/web/<component>/<file>.js imports wrapped with @lit/react createComponent using import * as React from 'react', named exports, and zero TSAsExpression casts"
  - "Jsdom Polyfill Order: forceElementInternalsPolyfill() runs at top level of test-setup.ts before any custom element defines itself"

requirements-completed: [FND-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "ESLint @material/web/lit/@lit static+dynamic import boundaries, all.js/labs/* exclusions, jsx-a11y label rules, and preserved CLOCK_READS/FORMATTER_READS across web tests"
    requirement: FND-02
    verification:
      - kind: unit
        ref: "pnpm lint && pnpm exec eslint --print-config apps/web/src/components/ui/primitives.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Forced element-internals-polyfill and IntersectionObserver/animate/getAnimations/<dialog> shims in apps/web/src/test-setup.ts"
    requirement: FND-02
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run src/components/ui/primitives.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "DRY Shadow DOM RTL host query utilities in apps/web/src/test/md-queries.ts compliant with jscpd and clock fence"
    requirement: FND-02
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web typecheck && pnpm exec jscpd apps/web/src/components/md apps/web/src/test/md-queries.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero-cast omitUndefined helper and @lit/react adapters (MdTextField, MdButton, MdSelect, MdCheckbox) under exactOptionalPropertyTypes"
    requirement: FND-02
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web typecheck && pnpm lint && TS compiler API probe (menuPositioning + omitUndefined)"
        status: pass
    human_judgment: false

# Metrics
duration: 13m 33s
completed: 2026-11-12
status: complete
---

# Phase 17 Plan 03: MD ESLint Fence, Polyfills, Queries, and Form Adapters Summary

**ESLint `@material/web`/`lit`/`@lit` boundary and `jsx-a11y` rules preserving test clock checks, forced `element-internals-polyfill` + jsdom shims, DRY `md-queries.ts`, zero-cast `omitUndefined`, and `@lit/react` adapters for text fields, buttons, selects, and checkboxes.**

## Performance

- **Duration:** 13m 33s
- **Started:** 2026-11-12T07:22:55Z
- **Completed:** 2026-11-12T07:36:28Z
- **Tasks:** 2
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments
- Configured static (`@typescript-eslint/no-restricted-imports`) and dynamic (`ImportExpression`) fences banning `@material/web`, `lit`, and `@lit` imports outside `apps/web/src/components/md/` and banning `@material/web` root/`all.js`/`labs/*` inside `components/md/`, while explicitly merging `CLOCK_READS` + `FORMATTER_READS` onto all `@hestia/web` tests, `src/test/**`, and `test-setup.ts`.
- Enabled `jsx-a11y/control-has-associated-label` and `jsx-a11y/label-has-associated-control` as `'error'` across `apps/web/**/*.{ts,tsx}` (passing 0 errors / 0 warnings workspace-wide).
- Updated `apps/web/src/test-setup.ts` to call `forceElementInternalsPolyfill()` unconditionally before custom elements load and shimmed `IntersectionObserver`, `Element.prototype.animate` (microtask `'finish'` + `currentTime: null`), `Element.prototype.getAnimations`, and `HTMLDialogElement.prototype.showModal` / `close`.
- Implemented `apps/web/src/test/md-queries.ts` (`findMd*`/`getMd*`/`queryMd*` host queries across Buttons, Fields, Selects, Checkboxes, Switches, Dialogs, MenuItems, Tabs) with zero code clones (`jscpd` 0.00%).
- Built zero-cast `omitUndefined` (`props.ts`) and typed `@lit/react` adapters `MdOutlinedTextField`, `MdFilledButton`, `MdOutlinedButton`, `MdTextButton`, `MdIconButton`, `MdOutlinedSelect` (including `menuPositioning: 'absolute' | 'fixed' | 'popover'` and menu lifecycle events), `MdSelectOption`, and `MdCheckbox` with zero host role overrides.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire ESLint boundary + preserved test-clock fence, jsdom polyfills, props helper, MdTextField tracer, and md-queries** - `98ea097` (feat)
2. **Task 2: Build MdButton, MdSelect, and MdCheckbox @lit/react adapters** - `aeb09a7` (feat)

## Files Created/Modified
- `eslint.config.js` - MD import/bundle/labs boundaries, preserved web test clock+formatter fence, and `jsx-a11y` strict control/label error rules.
- `apps/web/src/test-setup.ts` - Forced `element-internals-polyfill`, `IntersectionObserver`, `Element.prototype.animate`/`getAnimations`, and `<dialog>` shims.
- `apps/web/src/test/md-queries.ts` - Shared shadow-aware RTL host query helpers.
- `apps/web/src/components/md/props.ts` - Zero-cast `omitUndefined` helper for `exactOptionalPropertyTypes` interop.
- `apps/web/src/components/md/MdTextField.tsx` - `MdOutlinedTextField` `@lit/react` wrapper (`input`, `change`).
- `apps/web/src/components/md/MdButton.tsx` - `MdFilledButton`, `MdOutlinedButton`, `MdTextButton`, and `MdIconButton` `@lit/react` wrappers.
- `apps/web/src/components/md/MdSelect.tsx` - `MdOutlinedSelect` (`input`, `change`, `opening`, `opened`, `closing`, `closed`) and `MdSelectOption` wrappers.
- `apps/web/src/components/md/MdCheckbox.tsx` - `MdCheckbox` wrapper (`input`, `change`).

## Decisions Made
- Preserved `eslint-plugin-jsx-a11y`'s default `ignoreElements`, `ignoreRoles`, and `includeRoles` on `jsx-a11y/control-has-associated-label` so `<video>` and `<input>` (governed by `label-has-associated-control`) do not produce false positives in `BarcodeScannerDialog.tsx`.
- Used `Reflect.set` in `omitUndefined` and `test-setup.ts` shims to satisfy strict TS6 `exactOptionalPropertyTypes: true` and ESLint `strictTypeChecked` with zero `as` assertions.
- Filtered hidden hosts and closed `md-dialog`/`md-menu` subtrees by default in `md-queries.ts` (`includeClosed` option available) so RTL assertions match open/visible accessibility semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved default `ignoreElements`/`ignoreRoles`/`includeRoles` on `jsx-a11y/control-has-associated-label`**
- **Found during:** Task 1 (`pnpm lint`)
- **Issue:** Configuring `jsx-a11y/control-has-associated-label` with only `{ labelAttributes, controlComponents, depth }` replaced the preset's `ignoreElements`, causing `<video>` and `<input id="manual-barcode-input">` (already labeled via `<label htmlFor>`) in `apps/web/src/components/lists/BarcodeScannerDialog.tsx` to fail ESLint.
- **Fix:** Explicitly included `jsx-a11y`'s default `ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video']`, `ignoreRoles`, and `includeRoles` in `eslint.config.js`.
- **Files modified:** `eslint.config.js`
- **Verification:** `pnpm lint` passed workspace-wide with 0 errors and 0 warnings.
- **Committed in:** `98ea097`

**2. [Rule 1 - Bug] Added TS6 `scrollMargin` field to `IntersectionObserverShim`**
- **Found during:** Task 1 (`pnpm --filter @hestia/web typecheck`)
- **Issue:** TypeScript 6 DOM lib requires `readonly scrollMargin: string` on classes implementing `IntersectionObserver`.
- **Fix:** Added `readonly scrollMargin = '0px'` to `IntersectionObserverShim` in `apps/web/src/test-setup.ts`.
- **Files modified:** `apps/web/src/test-setup.ts`
- **Verification:** `pnpm --filter @hestia/web typecheck` exited 0.
- **Committed in:** `98ea097`

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes were minor config/type adjustments required for clean TS6 + ESLint compliance across the workspace; no scope creep.

## Issues Encountered
- Initial commitlint check on Task 1 rejected a >100-char commit body line; wrapped commit body lines to <= 75 chars without altering any code or skipping hooks.
- Note on requirements tracking: `requirements.ready-ids` returned `blocked: ["FND-02"]` because sibling Phase 17 plans (`17-04` and downstream `components/ui/` plans) share `FND-02`, so `REQUIREMENTS.md` was intentionally left unmarked until remaining `FND-02` plans finish.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan `17-04` can immediately build `MdDialog`, `MdMenu`, `MdSwitch`, `MdRadio`, `MdTabs`, `MdProgress`, and the `D-13` jsdom smoke gate on top of the active polyfills, ESLint boundaries, `omitUndefined`, and `md-queries.ts`.
- Verified `knip` baseline note: unused export/file reconciliation is scoped to Plan `17-15` after `components/ui/` adapters wire into production screens.

## Self-Check: PASSED
- Verified all 8 created/modified code/config files and `17-03-SUMMARY.md` exist on disk with LF line endings.
- Verified Task 1 (`98ea097`) and Task 2 (`aeb09a7`) commits exist as ancestors of `HEAD`.
