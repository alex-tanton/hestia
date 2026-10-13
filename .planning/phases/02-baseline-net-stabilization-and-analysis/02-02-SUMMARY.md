---
phase: 02-baseline-net-stabilization-and-analysis
plan: 02
subsystem: testing
tags: [vitest, clock-pin, timezone, sweep, web]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "02-01 BASELINE.md: the seven time-dependent web files and their per-zone status on untouched d3da748"
provides:
  - "test/clock-setup.mjs: global Vitest Date pin (HEARTH_TEST_NOW, default 2026-10-14T12:00:00.000Z), shared by every workspace"
  - "test/global-tz.mjs: Vitest globalSetup that validates TZ and prints one [test-clock] line"
  - "scripts/test-sweep.mjs: six-cell unit sweep and five-cell integration sweep runner"
  - "Web suite deterministic in all six unit cells and in the plain CI-shaped run"
affects: [02-03, 02-04, 02-05, 02-09, phase-06]

actuals:
  tokens: 5350
  tasks: 2
  commits: 4
plan_head_before: 89eb558e7c83865117a226239a2377642c43ef81
plan_head_after: cc7df63d88c58e119a6ba7cd58bbf575222b3220

tech-stack:
  added: []
  patterns:
    - "Clock pin as a subclass-safe Date installed before any test module loads, not vi.setSystemTime"
    - "Viewer-zone pin per file with vi.hoisted + afterAll restore, literal expected text kept as the oracle"

key-files:
  created:
    - test/clock-setup.mjs
    - test/global-tz.mjs
    - scripts/test-sweep.mjs
    - .planning/cleanup/BASELINE.md (carried from 02-01)
    - .planning/phases/02-baseline-net-stabilization-and-analysis/02-01-SUMMARY.md (carried from 02-01)
  modified:
    - apps/web/vite.config.ts
    - apps/web/src/screens/deals/favorites.test.tsx
    - apps/web/src/screens/deals/deal-search.test.tsx
    - apps/web/src/screens/deals/flyers.test.tsx
    - apps/web/src/screens/meals/suggestions.test.tsx

key-decisions:
  - "The pin is its own Date (function with copied prototype, constructs via Reflect.construct with new.target), not vi.setSystemTime"
  - "Viewer-zone literals stay literals; the three remaining files pin America/New_York like favorites.test.tsx"
  - "Branch is based on origin/main 89eb558, which differs from d3da748 only in .dockerignore, .gitignore, .prettierignore and .planning/.claude"

requirements-completed: [TIME-01]

duration: ~35min (start time not captured; approximate)
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 02: Clock pin, zone hook and sweep, web suite fixed Summary

**A global Date pin plus a validated TZ hook now run under the web suite, and `node scripts/test-sweep.mjs --workspace web` ends `sweep: 6/6 passed` (weekday, weekend, UTC-negative and UTC-positive zones); the plain web run is 715/715.**

## Performance

- **Tasks:** 2 of 2
- **Commits on `test/deterministic-clock`:** 4 code/record commits (measured from the ledger), plus the docs commit that carries this SUMMARY
- **Web suite before/after:** untouched main 714 passed / 1 failed; now 715 passed / 0 failed in the plain run and in all six cells

## Accomplishments

- `test/global-tz.mjs`: no-op when `TZ` is unset; otherwise validates the zone, re-asserts it, prints `[test-clock] TZ=... HEARTH_TEST_NOW=...`. Negative control: `TZ=Mars/Olympus` exits non-zero with `TZ="Mars/Olympus" is not an IANA time zone`.
- `test/clock-setup.mjs`: pins `Date` before any test module imports, re-pins before each test, restores after each; skips `*.integration.test.*`; installs no fake timers.
- `scripts/test-sweep.mjs`: six unit cells, five integration cells, `--suite/--workspace/--cell/--only/--log-dir/--list`; cells run sequentially in separate child processes, a signal-killed child is FAIL, the zone is self-checked per cell; `--only 'x;echo pwned'` exits 2 without spawning.
- `apps/web/vite.config.ts`: `setupFiles` gets `../../test/clock-setup.mjs` after `src/test-setup.ts`; `globalSetup: ['../../test/global-tz.mjs']`.
- Plan 02-01's records (BASELINE.md, 02-01-SUMMARY.md) are now committed on the branch as its first commit.

## Task Commits

1. Records: `b06ea88` docs: record the untouched-main test baseline
2. Task 1 (tracer): `a6ac116` test: pin the clock in unit tests and add a date and zone sweep
3. Task 2 fix to the pin: `914b946` test: make the clock pin safe for classes that extend Date
4. Task 2: `cc7df63` test(web): make the time-dependent web tests deterministic
5. This SUMMARY: `docs: complete plan 02-02` (made after this file was written, so not in `commits:` above)

## Per-file classification (Task 2)

| File | Class | Result |
|------|-------|--------|
| `favorites.test.tsx` | (b) viewer-zone expectation | Hoisted `TZ=America/New_York` pin, `afterAll` restore, literal `As of 09/24/2026, 4:00 AM` kept (tracer commit a6ac116) |
| `deal-search.test.tsx` | (b) | Same pin; fails only at UTC-11 (08:00Z reads as the previous day) |
| `flyers.test.tsx` | (b) | Same pin |
| `suggestions.test.tsx` | (b) | Same pin (09:00Z fails at UTC-11) |
| `recurrence-preview.test.ts` | none (pin artifact) | No edit; see Deviation 1 |
| `chores.test.tsx` | none (pin artifact) | No edit; see Deviation 1 |
| `chores-offline-queue.test.tsx` | none (pin artifact) | No edit; see Deviation 1 |

No class (c) item was found: no checkpoint:decision was raised. `grep -rn -i "as of" docs/` shows nothing requiring the deals "As of" stamp in the household zone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The planned pin (`vi.setSystemTime` at module scope) broke `TZDate`**
- **Found during:** Task 2 step 1 (first full web sweep: 3/6 passed)
- **Issue:** With `Date` mocked by `vi.setSystemTime` when `@date-fns/tz` first loads, `TZDate` overrides no methods, because the library lists `Object.getOwnPropertyNames(Date.prototype)` at load and the mock's prototype has none. `TZDate` then answers in the machine zone. `recurrence-preview`, `chores` and `chores-offline-queue` failed in `sat-utc-fri-la`, `newyear-pago-pago` and `dst-start-new-york` (every negative-offset zone), independent of the pinned instant. Probes in `packages/recurrence` reproduced it for both `vi.setSystemTime` and `vi.useFakeTimers({ toFake: ['Date'] })`. This also explains why these three files passed on untouched main at the real clock (BASELINE.md) and failed only under pinned runs.
- **Fix:** `test/clock-setup.mjs` installs its own `Date` (function with `new.target` handling, a prototype carrying copies of every `Date.prototype` own property, statics inherited from the native `Date`, `now` and zero-argument construction returning the pin). It follows `vi.setSystemTime` or fake timers a test installs over it, and is re-installed in `beforeEach` and after `vi.useRealTimers()` in `afterEach`.
- **Consequence:** the plan's acceptance count `vi.setSystemTime(` at least twice in `clock-setup.mjs` no longer holds literally (it is 0). The truths it served (module scope and `beforeAll` covered, re-pinned before every test, a local `vi.setSystemTime` keeps its instant) are met and verified by the sweep.
- **Files:** `test/clock-setup.mjs`. **Commit:** `914b946`.

**2. [Plan verify defect] `grep -qF "TZ = 'America/New_York'"` cannot match the strict-TS source**
- The repo's `noPropertyAccessFromIndexSignature` rejects `process.env.TZ = ...` (TS4111), so the assignment is `process.env['TZ'] = 'America/New_York'`. Task 1's verify clause `grep -qF "TZ = 'America/New_York'" favorites.test.tsx` therefore prints a non-match, while every other clause of that verify, the six-cell sweep and the Mars/Olympus control all pass. I did not add a contrived line to satisfy the literal grep.

**3. [Process] Plan 02-01's records committed alone, state files not**
- `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` in the primary checkout are byte-identical to `origin/main`'s, and this run was told not to change STATE/ROADMAP, so only `BASELINE.md` and `02-01-SUMMARY.md` were staged from the plan's five paths.

**4. [Process] The worktree branch-namespace check was not applied**
- The `<task_commit_protocol>` allow-list for worktrees (`agent-*`) targets parallel executor worktrees. This plan names `../hearth-clock` on `test/deterministic-clock` explicitly, so I applied the detached/protected-branch check, which passed, and not the `agent-*` pattern.

**5. [Base] `origin/main` is 89eb558, not d3da748**
- `git diff --name-only d3da748 origin/main -- . ':(exclude).planning' ':(exclude).claude'` lists `.dockerignore`, `.gitignore`, `.prettierignore` (ignore-file entries only), as already noted in 02-01. The branch is based on `origin/main`.

**Total deviations:** 1 auto-fixed bug (plan design), 4 recorded process or verify notes.

## Verification run

- Tracer: `node ../hearth-clock/scripts/test-sweep.mjs --workspace web --only src/screens/deals/favorites.test.tsx` gave 6/6 and each zoned cell logged its `[test-clock] TZ=` line. ESLint (`--max-warnings=0`) and Prettier clean on the new files.
- Web sweep before any test edit, original pin: 3/6 (LA, Pago Pago, New York failed). After the pin fix: 5/6 (Pago Pago: deal-search, flyers, suggestions). After the three viewer-zone pins: `sweep: 6/6 passed` (`logs/02-02-web/summary.txt`).
- Plain `pnpm --filter @hearth/web test`: 56 files, 715 tests, 0 failed (baseline run 1 had 715 tests). `pnpm --filter @hearth/web typecheck`, `pnpm lint`, `pnpm format:check`: clean.
- Added skip/todo lines in `apps/web/src` diff: 0. Changed files under `apps/web/src`: four `.test.tsx` files only.

## Not done / could not do

- Only the web workspace is wired to the pin and hook; the other workspaces and the integration config are plans 02-03 and 02-04.
- Branch backup push: see the orchestrator return message.

## Known Stubs

None.

## Threat Flags

None. `scripts/test-sweep.mjs` builds its shell string only from allowlists (T-02-04), as the plan's threat model covers.

## Self-Check

- FOUND: test/clock-setup.mjs, test/global-tz.mjs, scripts/test-sweep.mjs in `../hearth-clock`
- FOUND commits b06ea88, a6ac116, 914b946, cc7df63 on `test/deterministic-clock`
- `git status --porcelain` in `../hearth-clock` was empty after the code commits
