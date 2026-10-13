# Phase 2: Baseline, Net Stabilization, and Analysis - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 22 new/modified (plus ~20 swept test files)
**Analogs found:** 18 / 22 (4 have no in-repo analog; use CONTEXT/research)

All analog paths verified git-tracked (no `.gsd` mirror paths involved).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `apps/web/src/test-setup.ts` (modify: add pinned clock) | test setup | transform | itself + `apps/web/src/screens/bills/household-timezone.test.tsx` lines 63-69 | exact |
| `apps/web/src/test/test-clock.ts` (new, `testNow()` helper) | utility (test) | transform | `apps/web/src/test/fixtures.ts` (helper home) | role-match |
| `apps/service/vitest.config.ts` (modify: `setupFiles`, `globalSetup`) | config | n/a | `apps/web/vite.config.ts` test block (lines 73-88) | role-match |
| `apps/service/vitest.integration.config.ts` (modify: TZ via sweep, no pin) | config | n/a | itself | exact |
| `apps/service/vitest.coverage.config.ts` (modify: setup/global files; exclude new `src/test/**` already excluded) | config | n/a | itself | exact |
| `packages/{shared,recurrence,matching}/vitest.config.ts` (modify) | config | n/a | `packages/shared/vitest.config.ts` | exact |
| `apps/service/src/test/clock-setup.ts` + `global-setup-tz.ts` (new) | test setup | transform | `apps/service/src/test/world.ts` (helper home) | partial |
| `apps/service/src/test/zone-dates.ts` (new: shared `dateIn`, `householdToday`) | utility (test) | transform | `apps/service/src/bills.integration.test.ts` lines 549-600 | exact (extract) |
| `apps/service/src/bills.integration.test.ts` (modify, TIME-05) | test | request-response | itself | exact |
| ~10 `apps/service/src/*.integration.test.ts`, `cli.test.ts`, `routes/routes.test.ts`, `deals/flipp/request-queue.test.ts`, `recipes/host-rate-limiter.test.ts`, `packages/shared/src/api/schemas.test.ts` (audit) | test | mixed | `household-timezone.test.tsx` pin pattern; eslint-disable pattern at `cli.test.ts:65` | role-match |
| 7 failing web test files incl. `favorites.test.tsx` | test | transform | `apps/web/src/screens/chores/chores.test.tsx` 158-170 | exact |
| `e2e/tests/16-bill-paid-late-keeps-anchor.spec.ts`, `19-notifications.spec.ts` (modify) | test (e2e) | request-response | themselves (`householdToday()`, `reminderDay`) | exact |
| `eslint.config.js` (modify: TIME-04 rule) | config | n/a | same file lines 59-101 | exact |
| `scripts/test-sweep.sh` (or `.mjs`; new root sweep) | script | batch | `package.json` scripts + `scripts/deploy.sh` | partial |
| `package.json` (modify: knip devDep exact-pinned, `knip`/`sweep` scripts) | config | n/a | root `package.json` | exact |
| `knip.json` (new) | config | n/a | none | none |
| jscpd config / script (new) | config | batch | none | none |
| `.planning/cleanup/BASELINE.md`, `TRIAGE.md`, `OWNER-CANDIDATES.md`, raw JSON (new) | report | batch | none (no `.planning/cleanup/` exists) | none |
| `.prettierignore` (modify, if raw JSON reports are tracked) | config | n/a | itself | exact |

## Pattern Assignments

### `apps/web/src/test-setup.ts` (global pin, D-01/D-02)

**Analog:** itself (lines 1-28) plus ad hoc pins.

Existing setup shape to extend (lines 1-3, 26-28):
```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
...
afterEach(() => {
  cleanup();
});
```

Existing local pin pattern to fold under the global one (`apps/web/src/screens/bills/household-timezone.test.tsx` 62-70):
```typescript
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_INSTANT);
  onlineManager.setOnline(true);
});
afterEach(() => {
  vi.useRealTimers();
  ...
});
```

Planner notes:
- Pin with `vi.useFakeTimers({ toFake: ['Date'] })` only (never blanket timers; D-01). Read `process.env['HEARTH_TEST_NOW']` with a fixed Wednesday ~12:00Z default.
- Gotcha: local tests call `vi.useRealTimers()` in `afterEach`, which un-pins the global pin for later tests in the same file. The global `beforeEach` must re-install the pin each test; tests that call `useFakeTimers({ shouldAdvanceTime: true })` (chores.test.tsx 330-332, Toast.test.tsx 52, realtime.test.tsx 142, deal-search.test.tsx 272) already override locally.
- Other local-pin files to fold or leave: chores-offline-queue, errands, errands-offline-queue, chores, `screens/household-timezone`, `meals/household-timezone`, `chores/household-timezone`.

### `apps/web/src/test/test-clock.ts` (new helper; name is discretionary)

**Analog:** `apps/web/src/test/fixtures.ts` (shared helper home; kebab-case non-component module per CLAUDE.md). Export `PINNED_NOW` constant parsed from `HEARTH_TEST_NOW`, and `testNow(): Date` returning `new Date(PINNED_NOW)`. Use named exports, explicit return types, `.ts` extension imports on web.

### `apps/service/vitest.config.ts` and package configs (D-01)

**Analog:** `apps/web/vite.config.ts` lines 73-77:
```typescript
test: {
  environment: 'jsdom',
  include: ['src/**/*.test.{ts,tsx}'],
  setupFiles: ['src/test-setup.ts'],
```
Service config today (`apps/service/vitest.config.ts` 3-8) has no setupFiles:
```typescript
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'node_modules/**'],
```
Add `setupFiles: ['src/test/clock-setup.ts']` and `globalSetup: ['src/test/global-tz.ts']` (globalSetup sets `process.env.TZ` from env before workers fork; it must `export default function setup()` returning optional teardown). Copy the same shape into `packages/shared|recurrence|matching/vitest.config.ts` (identical 8-line structure; packages need their own setup file or a path to a shared one, since `packages/*` cannot import from `apps/*`).

Integration config (`vitest.integration.config.ts`) and `vitest.coverage.config.ts` (which also includes `*.integration.test.ts` via `src/**/*.test.ts`): do NOT pin the clock (D-07: DB `now()` cannot be pinned). They only receive `TZ` from the sweep env. Note `coverage.exclude` already lists `src/test/**`, so new setup files there need no change. `apps/service/vitest.coverage.config.ts` runs unit and integration together, so a global fake clock would leak into integration; make the setup file skip pinning for `*.integration.test.ts` or leave coverage config without setupFiles.

### `apps/service/src/test/zone-dates.ts` (new; TIME-05, D-06)

**Analog:** extract from `apps/service/src/bills.integration.test.ts`.

Helpers to move (lines 549-600):
```typescript
const HOUSEHOLD_ZONE = 'Pacific/Kiritimati';
const PROFILE_ZONE = 'Pacific/Pago_Pago';
const DAY_MS = 86_400_000;

function dateIn(zone: string, instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant);
}
function daysBetween(later: string, earlier: string): number { ... }
function householdYesterday(): string {
  const today = dateIn(HOUSEHOLD_ZONE, new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}
```
The UTC-vs-zone mixup: top-level `isoDate(offsetDays)` at line 54-58 uses UTC:
```typescript
function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
```
Fix by deriving from the household zone date (`dateIn(zone, now)`) and offsetting with `Date.parse(`${today}T00:00:00Z`)` arithmetic (as `householdYesterday` already does). Regression guard: a test that stubs/sets `TZ` (via the sweep or a child `vitest` run) where UTC date differs from household date and asserts `isoDate` equals the household date; red before, green after. Check which household zone bills created in this file use (`America/New_York` default?) before choosing the guard zone.

Naming: kebab-case file, camelCase verbs, explicit return types, JSDoc `/** ... */` on non-obvious helpers.

### Lint rule TIME-04 in `eslint.config.js`

**Analog:** same file, lines 87-94 (`no-restricted-syntax` selector style) and 97-101 (test file glob):
```javascript
'no-restricted-syntax': [
  'error',
  {
    selector: 'ImportExpression > Literal[value=/privileged/]',
    message: '...',
  },
],
...
{
  // Engineering Practices allows non-null assertions in tests only.
  files: ['**/*.test.{ts,tsx}', '**/*.spec.ts', 'e2e/**/*.ts'],
  rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
},
```
Add a new block before `prettier,` using `files: ['**/*.test.{ts,tsx}', '**/*.spec.ts', 'e2e/**/*.ts']` with selectors:
- `NewExpression[callee.name='Date'][arguments.length=0]`
- `CallExpression[callee.object.name='Date'][callee.property.name='now']`

Gotchas for the planner:
1. Flat config `rules` for the same rule name are replaced, not merged, by later matching blocks. The service block (63-96) sets `no-restricted-syntax` for `apps/service/src/**/*.ts` but ignores `*.test.ts` and `src/test/**`, so no collision for tests. But `apps/service/src/test/*.ts` helpers (not named `*.test.ts`) are not matched by the new glob; add `apps/service/src/test/**` and `apps/web/src/test/**` if helpers should be covered (the real-clock `testNow` helper itself will need an `eslint-disable-next-line` with reason).
2. `lint` runs `--max-warnings=0` and pre-commit; every currently flagged file must be fixed or disabled in the same change. Known offenders (13 test files plus `e2e/support/*`): see list below.
3. Disable convention (reason required), from `apps/service/src/cli.test.ts:65`:
```typescript
// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
```
Use `// eslint-disable-next-line no-restricted-syntax -- <reason>` (the `--` description form is the way to give the reason on one line; the repo's two existing disables carry a reason in surrounding prose, so match whichever the owner prefers).
4. `e2e/fixtures/` is in the global ignores; `e2e/**` otherwise linted. `e2e/support/run-identity.test.ts` also matches the test glob.

### Offender files (TIME-02 audit)

Measured `new Date()` / `Date.now()` hits:
- `apps/service/src/bills.integration.test.ts`: 55, 575, 592, 598
- `apps/service/src/{api,chores,deals,errands,jobs,log-autopay,meal-plan}.integration.test.ts`
- `apps/service/src/cli.test.ts:146` (`Date.now()` as a cache-bust query string: legitimate, disable with reason)
- `apps/service/src/deals/flipp/request-queue.test.ts`, `apps/service/src/recipes/host-rate-limiter.test.ts` (timing; legitimate, disable with reason or inject a clock)
- `apps/service/src/routes/routes.test.ts`
- `packages/shared/src/api/schemas.test.ts:82` (`createdAt: new Date().toISOString()`; replace with a literal ISO string)
- `e2e/tests/16-bill-paid-late-keeps-anchor.spec.ts:30`, `e2e/tests/19-notifications.spec.ts:200`

### `e2e/tests/16-...` and `19-...` (TIME-03, D-05; no server clock seam)

**Analog:** the files themselves. `16` already derives household date (lines 21-31):
```typescript
const HOUSEHOLD_TZ = 'America/New_York';
function householdToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: HOUSEHOLD_TZ, ... }).formatToParts(new Date());
```
`19` uses `reminderDay(new Date())` (line 120-125) with `newYorkDate`/`newYorkHour` and a fixed 17:00Z fallback clock; the dinner is "seeded one, or one planned via meal-plan API" (`ensureDinnerOn`, "Saturday in Seed Data" comment at ~line 130). The weekday dependence is in seed meal-plan content vs "today". Approach: read "today" at runtime from the household zone and plan via API when seed has none (already the pattern). Real-clock reads in e2e are legitimate (D-05: no seam), so route them through one shared `e2e/support/` helper (e.g. `e2e/support/clock.ts`) holding the single sanctioned `new Date()` with an eslint-disable and reason. Other support helpers: `e2e/support/bills.ts`, `db.ts`, `api.ts`. Grep `e2e/tests` for weekday literals (`Monday`, `Saturday`, `getDay`, `toLocaleDateString`) during planning; none were enumerated here beyond 16/19.

Existing env-driven clock seam (E2E-only, precedent only): `HEARTH_FLIPP_FIXTURE_NOW` parsed with `z.coerce.date().optional()` at `apps/service/src/env.ts:63`, consumed `apps/service/src/main.ts:67`.

### Sweep script (D-02)

**Analog:** root `package.json` scripts (lines 9-21) and shell style of `scripts/deploy.sh`. Keep naming `test:sweep`. Loop matrix of `HEARTH_TEST_NOW` x `TZ` over `pnpm -r test` (and `test:integration`). Env var names `HEARTH_TEST_NOW`, `TZ` are reused by Phase 6. New shell scripts must keep exec bit and LF (GIT-04): `git add --chmod=+x`. Prefer a `.mjs` with `child_process` for Windows hosts (Node ESM `.mjs` helpers exist at `apps/web/scripts/check-build.mjs`; ESLint `allowDefaultProject` covers `*.js`, `*.mjs`, `apps/web/scripts/*.mjs` only, so a root `scripts/*.mjs` needs an `allowDefaultProject` glob addition in `eslint.config.js` line 38 or lint will fail with a project-service error).

Note `e2e` `test` script is `node --test support/run-identity.test.ts` (not vitest): the clock pin does not apply there.

### `knip.json` (D-08..D-10)

**No analog.** Facts for entry declarations, from repo:
- Workspaces per `pnpm-workspace.yaml`: `apps/*`, `packages/*`, `e2e`, `supabase/seed`.
- Web SW entry: `apps/web/src/sw.ts` (referenced by `VitePWA({ filename: 'sw.ts', srcDir: 'src', strategies: 'injectManifest' })` in `apps/web/vite.config.ts` 42-44); knip's Vite plugin will not see it.
- E2E: `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `global-teardown.ts` (named in playwright config lines 17-18; knip's Playwright plugin may cover), plus `e2e/tests/*.spec.ts`.
- Service: `apps/service/src/main.ts`, `cli.ts`, `write-openapi.ts` (tsup/`tsx` in `build` script: `"tsup && tsx src/write-openapi.ts"`), `apps/service/bin/hearth-admin`.
- Seed: `supabase/seed/` (package has only a `typecheck` script; entries must be declared, scripts run via `db:seed` in service).
- Known exclusions to treat as uncertain, not dead: `packages/matching/scripts/` (eslint-ignored benchmark, imports removed `fuse.js`), `apps/service/src/push/web-push.d.ts`, `apps/service/src/db/types.ts` (generated), `docker/*`, `scripts/*.sh`, `supabase/migrations/*.sql`, fixture paths built from strings (`HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`, `e2e/fixtures/`).
- Add `"knip": "knip"` and `"knip:production": "knip --production"` to root scripts; devDependency exact-pinned (`saveExact: true`; research recommends 6.41.0). Do not add to `ci.yml`.
- Ensure `knip.json` itself passes `pnpm format:check` (Prettier: singleQuote, printWidth 100).

### jscpd config (D-12, BASE-04)

**No analog.** Source-only: exclude `**/*.test.*`, `e2e`, `**/dist`, `**/coverage`, `docs`, `apps/service/src/db/types.ts`, `supabase/migrations`, `pnpm-lock.yaml`. Output JSON to `.planning/cleanup/`. Pin jscpd exactly (research: 5.4.1) or run via `pnpm dlx` with a pinned version to avoid a dependency (planner decision).

### `.planning/cleanup/` outputs

**No analog.** `.planning/` currently holds `codebase/`, `phases/`, `research/`, `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `config.json`, `state.json`. Create `.planning/cleanup/BASELINE.md`, `TRIAGE.md`, `OWNER-CANDIDATES.md`, `knip.json`/`knip-production.json`, `jscpd-report.json`. `.prettierignore` currently lists `docs/`, `e2e/fixtures/`, `pnpm-lock.yaml`, `BUILD_PROMPT.md`, build dirs; raw tool JSON under `.planning/cleanup/` will fail `format:check` unless formatted or added to `.prettierignore` (check whether `.planning/` is tracked first). Constraint: no review/ADR files under `docs/`; these live in `.planning/` only.

## Shared Patterns

### Clock handling
**Source:** `apps/web/src/screens/chores/chores.test.tsx` 158-170 and `household-timezone.test.tsx` 62-70.
**Apply to:** every pinned test. `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)`, paired with `vi.useRealTimers()` in `afterEach`.

### Household-zone "today"
**Source:** `Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).format(instant)` (`bills.integration.test.ts` 554-560). `en-CA` yields `YYYY-MM-DD` directly. Day arithmetic via `Date.parse(`${d}T00:00:00Z`)` +/- `86_400_000`, never local `setDate`.
**Apply to:** `zone-dates.ts`, e2e helper, web tests needing "today".

### Lint-disable convention
**Source:** `apps/service/src/cli.test.ts:65`, `apps/web/src/components/chores/RotationEditor.tsx:132`. Next-line form, rule named, reason attached; only two instances exist today.

### Imports
Service and packages: relative imports end in `.js`; web and e2e: explicit `.ts`/`.tsx` extensions. Named exports only; `import type` / inline `type` per `verbatimModuleSyntax`. Strict TS (`noUncheckedIndexedAccess`: array destructure with defaults as at `e2e/tests/16` `[year = 1970, month = 1]`).

### CI shape (read-only this phase)
**Source:** `.github/workflows/ci.yml`. Workflow `name: CI`; jobs `lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e`, `build` (ids must not change). Each repeats the 5-line preamble (checkout@v7, pnpm/action-setup@v6, setup-node@v7 with `node-version-file: .nvmrc` and `cache: pnpm`, `pnpm install --frozen-lockfile`). `test-unit` runs `pnpm test`; `test-integration` runs `supabase start` then `pnpm --filter @hearth/service test:coverage`. Phase 2 makes no CI edits; Phase 6 adds the matrix reusing `HEARTH_TEST_NOW`/`TZ`. Any new global TZ hook must be a no-op when `TZ` is unset so existing CI stays unchanged.

### BASELINE procedure
Throwaway worktree at `d3da748` on Node 24 (`.nvmrc` = `24`). Commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` (needs `supabase start`), `pnpm build`; run twice, diff failures to mark flaky. Root scripts: `lint` is `eslint --max-warnings=0 .`; `format:check` also worth recording. Web unit: `pnpm --filter @hearth/web test`; note `packages/*` `pnpm test` runs with `--coverage` thresholds (comment in `packages/shared/vitest.config.ts`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `knip.json` | config | batch | no knip in repo |
| jscpd config | config | batch | no jscpd in repo |
| `.planning/cleanup/*` | report | batch | directory does not exist |
| root sweep script | script | batch | no multi-workspace matrix runner exists (nearest: `scripts/deploy.sh`) |

## Metadata

**Analog search scope:** `eslint.config.js`, `apps/web` (vite config, setup, tests), `apps/service` (vitest configs, src/test, integration tests), `packages/*/vitest.config.ts`, `e2e/` (config, support, tests 16/19), `.github/workflows/ci.yml`, root `package.json`, `.prettierignore`.
**Not located in this pass:** the exact list of the 7 failing web test files (BASE-01 produces it; only `favorites.test.tsx` is named in CONTEXT; local `setSystemTime` users are the 8 files above), and weekday-literal scan across all `e2e/tests`.
**Pattern extraction date:** 2026-10-12
