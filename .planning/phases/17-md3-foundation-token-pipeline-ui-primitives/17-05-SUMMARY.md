---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 05
subsystem: ui
tags: [material-symbols, svg, icons, md3, csp, supply-chain]

requires:
  - phase: 17-03
    provides: "Vitest jsdom test-setup and strict ESLint + TypeScript conventions"
  - phase: 17-04
    provides: "Verified jsdom test harness and Material Web adapter baseline"
provides:
  - "Reproducible official Google Material Design Icons SVG extractor (apps/web/scripts/generate-icon-paths.mjs pinned to commit 10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7)"
  - "Static curated Material Symbols Rounded path registry (apps/web/src/components/ui/icon-paths.ts) with 72 outline paths and 14 filled active-state variants"
  - "Pure inline SVG Icon component (apps/web/src/components/ui/Icon.tsx) with filled toggle, aria-hidden='true', and zero raw HTML injection"
  - "Unit test coverage (apps/web/src/components/ui/Icon.test.tsx) for outline/filled geometry, fallback behavior, size, className, and zero ligature text"
affects:
  - 17-06
  - 17-07
  - 17-08
  - 17-09
  - 18
  - 19
  - 20
  - 21

actuals:
  tokens: 12674
  tasks: 2
  commits: 1
commits: 1
plan_head_before: 4f24e57f935d3bd9c57171b4fa3653bd04232ede
plan_head_after: 7526d997b1302d2cf8ca3d5de74417dd8c10b37d

tech-stack:
  added: []
  patterns:
    - "Build-time commit-pinned SVG path extraction from google/material-design-icons (zero third-party icon packages, zero runtime network calls, zero WOFF2 font precache weight)"
    - "Strict SVG path-syntax validation (viewBox='0 -960 960 960' and single <path d='...'> allowlist) during extraction (T-17-08)"
    - "Icon.tsx renders static <svg viewBox='0 -960 960 960' aria-hidden='true'><path d={path} /></svg> with FILLED_ICON_PATHS[name] ?? ICON_PATHS[name]"

key-files:
  created:
    - apps/web/scripts/generate-icon-paths.mjs
    - apps/web/src/components/ui/icon-paths.ts
    - apps/web/src/components/ui/Icon.tsx
    - apps/web/src/components/ui/Icon.test.tsx
  modified:
    - apps/web/package.json
    - .planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-05-PLAN.md

key-decisions:
  - "Rejected third-party @material-symbols/svg-400 (marella/material-symbols) at Task 1 supply-chain gate per explicit user directive; sourced Material Symbols Rounded SVGs exclusively from Google's official google/material-design-icons repository pinned at commit 10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7"
  - "Added reproducible apps/web/scripts/generate-icon-paths.mjs script validating single-path viewBox='0 -960 960 960' and SVG path command syntax before emitting static TypeScript strings in icon-paths.ts"
  - "Omitted non-existent delete_outline from Google's symbols/web/ directory (delete_24px.svg IS the outline glyph) and expanded the curated registry to 72 icons covering every legacy lucide-react import across apps/web/src/"

patterns-established:
  - "All Material Symbols Rounded glyphs resolve through IconName union and Icon.tsx without dangerouslySetInnerHTML, WOFF2 fonts, or external font CDNs"
  - "IconName is a keyof typeof ICON_PATHS string union (no TypeScript enum)"

requirements-completed:
  - FND-03

coverage:
  - id: D1
    description: "Reproducible commit-pinned SVG path extractor from google/material-design-icons emitting validated static TypeScript path geometry in apps/web/src/components/ui/icon-paths.ts"
    requirement: FND-03
    verification:
      - kind: unit
        ref: "apps/web/src/components/ui/Icon.test.tsx#has valid non-empty path strings for every registered IconName"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure inline SVG Icon.tsx primitive supporting outline/filled variants, custom size/className, aria-hidden='true', and zero ligature text leakage"
    requirement: FND-03
    verification:
      - kind: unit
        ref: "pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/Icon.test.tsx"
        status: pass
      - kind: unit
        ref: "pnpm --filter @hestia/web typecheck && pnpm lint"
        status: pass
    human_judgment: false

duration: 11 min
completed: 2026-11-12
status: complete
---

# Phase 17 Plan 05: Material Symbols Icon Registry Summary

**Established Hestia's Material Symbols Rounded inline SVG registry (`Icon.tsx` + `icon-paths.ts`) from Google's official `google/material-design-icons` repository (`10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7`) with zero third-party icon packages, zero WOFF2 font weight, and zero raw HTML injection.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-12T13:09:16Z
- **Completed:** 2026-11-12T13:20:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Completed Task 1 supply-chain gate under user directive rejecting `@material-symbols/svg-400` (`marella/material-symbols`) in favor of Google's official `google/material-design-icons` repository (`10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7`).
- Built `apps/web/scripts/generate-icon-paths.mjs` (`pnpm --filter @hestia/web icon-paths`) to fetch `<name>_24px.svg` and `<name>_fill1_24px.svg` from `symbols/web/<name>/materialsymbolsrounded/`, validate `viewBox="0 -960 960 960"` and strict `<path d="...">` command syntax (`T-17-08`), and emit static TypeScript strings in `apps/web/src/components/ui/icon-paths.ts` (72 outline icons covering all plan icons + all legacy `lucide-react` usages in `apps/web/src/`, plus 14 filled active-state variants).
- Implemented `apps/web/src/components/ui/Icon.tsx` and `apps/web/src/components/ui/Icon.test.tsx` (`14/14` Vitest `dom` tests passing, `tsc --noEmit` passing, `eslint --max-warnings=0 .` passing, Prettier check passing).

## Task Commits

Each task was committed atomically:

1. **Task 1: Human supply-chain review before installing @material-symbols/svg-400@0.48.3 (T-17-SC)** - `—` (User directive: rejected third-party package; authorized official Google repo source)
2. **Task 2: Implement official SVG extractor and static rounded Icon.tsx registry tracer** - `7526d99` (`feat(web): add Material Symbols Icon registry (17-05)`)

## Files Created/Modified

- `apps/web/scripts/generate-icon-paths.mjs` - Commit-pinned official `google/material-design-icons` SVG fetcher with strict single-path & path-syntax validation
- `apps/web/src/components/ui/icon-paths.ts` - Static `ICON_PATHS` (72 outline icons), `IconName` union, and `FILLED_ICON_PATHS` (14 filled active-state variants)
- `apps/web/src/components/ui/Icon.tsx` - Pure inline `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d={path} /></svg>` component (`filled` prop fallback, `size = 20`, `shrink-0`)
- `apps/web/src/components/ui/Icon.test.tsx` - 14 unit tests covering outline paths, filled switching, outline-only fallback, custom `size`/`className`, and zero ligature text
- `apps/web/package.json` - Added `"icon-paths": "node scripts/generate-icon-paths.mjs"` script (zero third-party icon dependencies added)
- `.planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-05-PLAN.md` - Updated `key_links` from `@material-symbols/svg-400` to `apps/web/scripts/generate-icon-paths.mjs -> github.com/google/material-design-icons`

## Decisions Made

- **Official Google SVG source over third-party npm mirror:** Honored user supply-chain directive rejecting `@material-symbols/svg-400` (`marella/material-symbols`), leaving `apps/web/package.json` and `pnpm-lock.yaml` completely free of `@material-symbols/svg-400`.
- **Static path extraction at generation time (`generate-icon-paths.mjs`):** Rather than Vite `?raw` imports from `node_modules`, generated `icon-paths.ts` directly as pure TypeScript string constants with strict SVG structure and `d` attribute syntax validation (`^[MmLlHhVvCcSsQqTtAaZz0-9.,eE+\-\s]+$`).
- **Expanded curated inventory & `delete` mapping:** Mapped `delete_24px.svg` directly (omitting `delete_outline`, which does not exist separately in Google's `symbols/web/`) and added 19 extra symbols (`archive`, `arrow_downward`, `arrow_upward`, `backspace`, `barcode_scanner`, `calendar_add_on`, `confirmation_number`, `credit_card`, `drag_indicator`, `hide_image`, `inventory_2`, `monitoring`, `newspaper`, `sell`, `shopping_basket`, `skip_next`, `smartphone`, `unarchive`, `wifi_off`) discovered by grepping all `lucide-react` usages across `apps/web/src/`.

## Deviations from Plan

### User-Directed Source Change

**1. [User Directive - Supply Chain] Replaced `@material-symbols/svg-400` npm dependency with official `google/material-design-icons` SVG extractor**
- **Found during:** Task 1 (`Human supply-chain review`) & Task 2
- **Issue:** Plan 17-05 originally specified installing `@material-symbols/svg-400@0.48.3` (`marella/material-symbols`, a third-party repository) and importing `.svg?raw` files from `node_modules`.
- **Fix:** Kept `@material-symbols/svg-400` out of `apps/web/package.json` and `pnpm-lock.yaml`, created `apps/web/scripts/generate-icon-paths.mjs` pinned to `google/material-design-icons@10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7`, validated every SVG `<path d="...">`, generated `apps/web/src/components/ui/icon-paths.ts`, and updated `17-05-PLAN.md` `key_links`.
- **Files modified:** `apps/web/package.json`, `apps/web/scripts/generate-icon-paths.mjs`, `apps/web/src/components/ui/icon-paths.ts`, `.planning/phases/17-md3-foundation-token-pipeline-ui-primitives/17-05-PLAN.md`
- **Verification:** `grep` confirmed zero `@material-symbols/svg-400` references in `package.json`, `pnpm-lock.yaml`, `apps/web/src/`, and `apps/web/scripts/`; `Icon.test.tsx` (14/14), `tsc --noEmit`, `eslint`, and Prettier checks all pass.
- **Committed in:** `7526d99` (Task 2 code commit) and plan metadata commit

---

**Total deviations:** 1 user-directed supply-chain deviation (plus omission of non-existent `delete_outline` and inclusion of 19 additional `lucide-react`-mapped icons in `ICON_PATHS`).
**Impact on plan:** Strengthened supply-chain posture with zero npm dependency bloat and zero runtime network calls while preserving the exact `Icon.tsx` / `IconName` / `FILLED_ICON_PATHS` contract for Waves 6–9.

## Issues Encountered

- Running `pnpm format:check` across the entire repo warns on the orchestrator-owned untracked `.gsd/dispatch-isolation-sentinel.json`; running `pnpm prettier --check` directly on all modified and created files passed with zero formatting issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `Icon.tsx`, `icon-paths.ts`, and `Icon.test.tsx` are complete, tested, and ready for Wave 6–9 UI primitives (`17-06` through `17-09`) and Phases 18–20 screen migrations.

---
*Phase: 17-md3-foundation-token-pipeline-ui-primitives*
*Completed: 2026-11-12*

## Self-Check: PASSED
