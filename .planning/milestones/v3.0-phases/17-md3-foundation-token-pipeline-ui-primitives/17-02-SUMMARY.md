---
phase: 17-md3-foundation-token-pipeline-ui-primitives
plan: 02
subsystem: ui
tags: [md3, design-tokens, tailwind-v4, vitest, pwa, csp]

# Dependency graph
requires:
  - phase: 17-md3-foundation-token-pipeline-ui-primitives
    provides: Generated Warm Terracotta MD3 design tokens in apps/web/src/styles/tokens.css (17-01)
provides:
  - All 32 @theme inline Tailwind color tokens and --md-focus-ring-color mapped onto --md-sys-* in index.css
  - CSP-safe dual light/dark color-scheme and theme-color metadata in index.html with zero inline scripts
  - Warm Terracotta (#fff8f6) PWA manifest theme/background colors and 192x192 / 512x512 launcher PNGs
  - Vitest 5 multi-project split (node unit vs jsdom dom) with explicit DOM_UNIT_TS_TESTS allowlist and preserved 84/80/77/85 coverage thresholds
affects: [17-03, 17-04, 17-05, 17-06, 17-07, 17-08, 17-09, 17-10, 17-11, 17-12, 17-13, 17-14, 17-15, phase-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind CSS v4 @theme inline utilities bridge deterministically to Material Design 3 --md-sys-color-* tokens"
    - "Vitest project split separates 14 pure Node unit suites (unit) from 6 DOM .test.ts and .test.tsx suites (dom)"

key-files:
  created: []
  modified:
    - apps/web/src/index.css
    - apps/web/index.html
    - apps/web/vite.config.ts
    - apps/web/scripts/generate-icons.mjs
    - apps/web/public/icons/icon-192.png
    - apps/web/public/icons/icon-512.png

key-decisions:
  - "Removed legacy palette ramps, slate dark overrides, and [data-section] selectors from index.css, bridging all 32 @theme inline properties plus --md-focus-ring-color onto --md-sys-*"
  - "Declared <meta name=\"color-scheme\" content=\"light dark\" /> and media-qualified #fff8f6 / #1a110e theme-color metas in index.html with zero inline scripts to comply with Caddy script-src 'self'"
  - "Split Vitest test.projects into unit (environment: 'node', extends: false) and dom (environment: 'jsdom', extends: true with browser resolve conditions) while keeping 84/80/77/85 coverage thresholds"
  - "Used 3-byte RGB [0x8e, 0x4c, 0x32] (#8e4c32) instead of 4-byte RGBA for BACKGROUND in generate-icons.mjs because the PNG encoder writes colour type 2 (RGB)"

patterns-established:
  - "CSS Bridge Pattern: ./styles/tokens.css imports before tailwindcss; --overlay maps to color-mix(in srgb, var(--md-sys-color-scrim) ...) for light (32%) and dark (45%) modes"
  - "Test Routing Pattern: Browser/DOM .test.ts files must be registered in DOM_UNIT_TS_TESTS in apps/web/vite.config.ts"

requirements-completed: [FND-01]

# Metrics
status: complete
duration: 5m 25s
completed: 2026-11-12
coverage:
  unit_test_files: 14
  unit_tests_passed: 254
  dom_ts_test_files: 6
  dom_ts_tests_passed: 47
  total_tests_run: 301
  total_tests_passed: 301
  typecheck: passed
  eslint: passed
  prettier: passed
actuals:
  tokens: 3820
  tasks: 2
  commits: 2
  plan_head_before: 0f512694c72b8f87544ccd354b607b31b4ac11bb
  plan_head_after: 2b6c138bd285170b68c5771d4bd660da273b8b65
---

# Phase 17 Plan 02: MD3 Token Bridge & Vitest Project Split Summary

**Replaced legacy Tailwind slate/section palettes in `index.css` with a 32-token Warm Terracotta `--md-sys-*` bridge, updated HTML/PWA chrome and terracotta launcher PNGs with zero inline scripts, and split Vitest into `unit` (node) and `dom` (jsdom) projects.**

## Performance

- **Duration:** 5m 25s
- **Started:** 2026-11-12T07:12:18Z
- **Completed:** 2026-11-12T07:17:45Z
- **Tasks:** 2 (Task 1 tracer + Task 2 auto)
- **Files modified:** 6

## Accomplishments

- **MD3 Tailwind Token Bridge (`apps/web/src/index.css`):** Imported `./styles/tokens.css` before `@import 'tailwindcss';`, mapped `--font-sans` to `var(--md-ref-typeface-plain)`, removed all legacy color ramps and `[data-section='*']` blocks, mapped all 32 `@theme inline` custom properties (including `--overlay` via `color-mix` on `--md-sys-color-scrim` with light/dark media and `data-theme` selectors) plus `--md-focus-ring-color`, and preserved utility/accessibility rules.
- **CSP-Safe Document & PWA Chrome (`apps/web/index.html`, `apps/web/vite.config.ts`):** Replaced retired `#475569` with `<meta name="color-scheme" content="light dark" />`, light `#fff8f6` and dark `#1a110e` `theme-color` metas, zero inline scripts, `<title>Hestia</title>`, and manifest `THEME_COLOR = '#fff8f6'`.
- **Vitest Node/DOM Split (`apps/web/vite.config.ts`):** Configured `test.projects` with `unit` (`environment: 'node'`, `extends: false`, running all 14 pure Node `.test.ts` suites) and `dom` (`environment: 'jsdom'`, `extends: true`, browser resolve conditions, running `.test.tsx` + all 6 browser/DOM `.test.ts` suites in `DOM_UNIT_TS_TESTS`), retaining `globalSetup` and `84/80/77/85` coverage thresholds.
- **Warm Terracotta PWA Icons (`apps/web/scripts/generate-icons.mjs`, `apps/web/public/icons/icon-{192,512}.png`):** Replaced retired slate `[0x47, 0x55, 0x69]` with Warm Terracotta primary `[0x8e, 0x4c, 0x32]` (`#8e4c32`) and regenerated valid `192x192` (512B) and `512x512` (2272B) RGB maskable PNGs.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Bridge MD3 tokens in index.css, update index.html & vite.config.ts** — `80e1976` (`feat(web): bridge MD3 tokens and split Vitest projects (17-02)`)
   - Tracer feedback gate (`human_verify_mode: end-of-phase`, `<automated>`-only): ⚡ Tracer verified end-to-end — expanding (14 unit files / 254 tests + 6 dom `.test.ts` files / 47 tests + assertions + typecheck + eslint + prettier all exited 0).
2. **Task 2 (auto): Update PWA icon generator to Warm Terracotta and run fast asset/typecheck verification** — `2b6c138` (`feat(web): update PWA icons to Warm Terracotta (17-02)`)

**Plan metadata:** Committed separately via `gsd-tools.cjs query commit`.

## Files Created/Modified

- `apps/web/src/index.css` — MD3 `./styles/tokens.css` import, `--font-sans` mapping, 32-token `:root` bridge, light/dark `--overlay` rules, zero `data-section` blocks
- `apps/web/index.html` — Dual light/dark `theme-color` metas, `color-scheme: light dark`, zero inline scripts, `<title>Hestia</title>` preserved
- `apps/web/vite.config.ts` — `THEME_COLOR = '#fff8f6'`, `background_color: THEME_COLOR`, `DOM_UNIT_TS_TESTS` (6 files), `test.projects` (`unit` node + `dom` jsdom), preserved `84/80/77/85` coverage thresholds
- `apps/web/scripts/generate-icons.mjs` — Warm Terracotta primary RGB `[0x8e, 0x4c, 0x32]` (`#8e4c32`) background
- `apps/web/public/icons/icon-192.png` — Regenerated 192x192 PNG (512 bytes)
- `apps/web/public/icons/icon-512.png` — Regenerated 512x512 PNG (2272 bytes)

## Decisions Made

- Mapped semantic section/badge tokens cleanly onto MD3 warm surface/container/tonal tokens in `:root` so existing screens continue compiling until later Phase 17/18 plans migrate call sites off `@theme inline` utility aliases.
- Kept `test.globalSetup` at the root Vitest config level and split `test.projects` into `unit` (`extends: false`, Node) and `dom` (`extends: true`, jsdom + browser resolve conditions) per Vitest 5 semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Encoded Warm Terracotta icon background as 3-byte RGB instead of 4-byte RGBA**
- **Found during:** Task 2 (`apps/web/scripts/generate-icons.mjs`)
- **Issue:** Plan prose suggested 4-byte RGBA `[0x8e, 0x4c, 0x32, 0xff]`, whereas `generate-icons.mjs` allocates 3 bytes per pixel (`rowLength = 1 + size * 3`), writes PNG `colour type: 2` (RGB), and pairs `BACKGROUND` with 3-byte `FOREGROUND = [0xff, 0xff, 0xff]`. Passing 4 bytes would overflow `Buffer.set` at the final pixel and corrupt scanlines.
- **Fix:** Set `const BACKGROUND = [0x8e, 0x4c, 0x32];` (`#8e4c32`, Warm Terracotta MD3 primary) matching the 3-channel RGB PNG encoder, and verified both generated PNGs decode to `192x192` and `512x512`.
- **Files modified:** `apps/web/scripts/generate-icons.mjs`, `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png`
- **Verification:** `pnpm --filter @hestia/web icons` exited 0; IHDR check confirmed 192x192 (512B) and 512x512 (2272B); ESLint + Prettier exited 0.
- **Committed in:** `2b6c138`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary for valid RGB PNG generation without changing dimensions, paths, or color value.

## Issues Encountered

None — all automated checks (`vitest --project unit`, 6 DOM `.test.ts` suites under `--project dom`, assertions, `icons`, `typecheck`, `eslint`, `prettier`) passed cleanly on the first verification run for both tasks.

## Threat Model & Stub Scan

- **T-17-03 (CSP / index.html):** Verified zero inline `<script>` elements in `apps/web/index.html` and dual light/dark metadata.
- **T-17-04 (`@theme inline` completeness):** Verified all 32 `--color-*` bridge variables (including `--overlay`) resolve inside `:root` with zero `data-section` selectors remaining.
- **T-17-SC (`pnpm-lock.yaml`):** Zero new npm packages installed.
- **Stub scan:** No code stubs or `TODO`/`FIXME` introduced in modified source files (`generate-icons.mjs` comment describes the intentional placeholder "H" app mark).

## Next Phase Readiness

- Phase 17 token bridge, CSS entry point, PWA chrome/icons, and fast `unit` / `dom` Vitest projects are complete (`FND-01` deliverables for `17-02` complete; `REQUIREMENTS.md` remains unchanged because `requirements.ready-ids` reports `FND-01` still blocked on remaining sibling plans).
- Ready for Wave 2 primitives and subsequent Phase 17 plans (`17-03` onward).

## Self-Check: PASSED

All 6 target files exist on disk, `17-02-SUMMARY.md` is complete, and commits `80e1976` and `2b6c138` are ancestors of `HEAD`.
