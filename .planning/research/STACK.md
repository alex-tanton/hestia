# Stack Research

**Domain:** Cleanup and hardening tooling for a TypeScript pnpm monorepo (dead code, unused dependencies, duplication, generated-file hygiene, deterministic clock/timezone tests, CI enforcement)
**Researched:** 2026-10-11
**Confidence:** HIGH for the recommended tools and configs (each was executed against a scratch copy of HEAD, not only read from docs); MEDIUM where marked

Scope note: this covers only the tooling the cleanup milestone adds. The existing stack (Fastify, React/Vite, Vitest 5.0.1, Playwright 1.63.0, ESLint 10 with typescript-eslint strictTypeChecked, pnpm 10.34.5, Node 24) is not re-researched. The repo working tree was not modified; all experiments ran in a throwaway copy.

## Confidence convention

The `classify-confidence` seam rates the docs providers used here (WebFetch/WebSearch) as LOW, and cached digests are stored with that tier. The HIGH ratings below come from a second, independent source: the tool was installed and run on this repo (or the behavior was probed directly). Each row says which. Nothing rated HIGH rests on docs alone.

## Recommended Stack

### Core Technologies (new dev dependencies, root workspace)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| knip | 6.41.0 | Unused files, exports, exported types, dependencies, devDependencies, unlisted dependencies, unlisted binaries, duplicate exports | The one maintained tool that covers every dead-code category in a pnpm workspace. Reads `pnpm-workspace.yaml`, enables Vite/Vitest/Playwright/tsup/ESLint/Husky/commitlint/GitHub Actions plugins automatically, and parses `package.json` scripts and workflow files for binaries. Node `^20.19 \|\| >=22.12`; no TypeScript peer dependency (uses oxc), so TypeScript 6.0.3 is not a concern. Runs in about 8-15 s on this repo. The Knip docs list depcheck, unimported and ts-prune as archived and recommending Knip. | HIGH (ran on repo; docs cross-checked) |
| jscpd | 5.4.1 | Copy/paste duplication in source, tests, YAML and shell | v5 is a Rust engine shipped through npm optional platform packages (linux-x64-gnu, windows-x64-msvc, darwin, arm64), `node >=18`, TS/TSX supported. Whole repo scans in 1-2 s. Reports line/token percentages and exits non-zero past `threshold`. The only actively maintained, language-agnostic option (also parses the YAML in `.github/workflows/`). | HIGH for flags and results (ran on repo); MEDIUM for `.jscpd.json` key names (docs only) |
| Vitest fake timers + `vi.setSystemTime` | already installed (5.0.1; 5.0.3 is latest) | Deterministic `Date`/`Temporal` in unit and component tests | No new library. Vitest 5 bundles the fake-timer implementation. `vi.setSystemTime` without fake timers freezes `Date` and `Temporal.Now` while real timers keep running (probed: clock advanced 0 ms across a 60 ms real wait), which is the right mode for Testing Library `waitFor`. `useFakeTimers()` fakes `Date`, `setTimeout`, `performance`, and (v5) `Temporal`; it does not fake `process.nextTick` or `queueMicrotask`. | HIGH (probed on 5.0.3) |
| Vitest `globalSetup` for `TZ` | already installed | Pin the process timezone for every worker | Verified on this Windows machine: setting `process.env.TZ` in a `globalSetup` module changes `Intl` and `getTimezoneOffset()` in both `forks` (the default pool) and `threads` workers. `test.env.TZ` and `setupFiles` only work under `forks`; Vitest's docs state "Changing `process.env.TZ` does not affect the time zone in a worker thread". Inline `TZ=... vitest` is swallowed by Git Bash on Windows (probed: `process.env.TZ` was undefined in the child), and does not exist in `cmd.exe`. | HIGH (probed; matches Vitest docs) |
| Playwright `page.clock`, `timezoneId`, `locale` | already installed (1.63.0; 1.64.0 published 2026-10-11) | Browser-side clock and timezone in E2E | Built in. `page.clock.setFixedTime` freezes `Date` while timers run; `install` + `pauseAt`/`fastForward`/`runFor` give full control. Installed as a browser-context init script (applies to new documents) and evaluated in already-open main frames; no worker or service-worker path appears in its source. `timezoneId`/`locale` in `use` affect the browser, not the test runner. No clock, timezone or locale changes in the 1.60-1.64 release notes, so there is no reason to bump during cleanup. | HIGH (docs + Playwright source) |

### Supporting Libraries and Built-ins

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `git ls-files -ci --exclude-standard` | git built-in | Lists tracked files that match `.gitignore` (committed build output, reports, env files) | Add as a CI step that fails on any output. Verified: currently returns nothing on HEAD. Zero dependency. |
| `git ls-files` name sweep (`dist/`, `coverage/`, `*.tsbuildinfo`, `*.log`, `.DS_Store`, `*.orig`, `*.bak`, `*.map`) | git built-in | Catches generated or leftover files that are not (yet) gitignored | One-off in the cleanup phase; verified to return nothing on HEAD. Then rely on `.gitignore` plus the `-ci` check. |
| `pnpm db:types` + `git diff --exit-code apps/service/src/db/types.ts` | existing script | Drift check for the only committed generated file (`apps/service/src/db/types.ts`, kysely-codegen 0.20.0) | Run in the `test-integration` job right after `supabase start`, which already provides the database `db:types` defaults to (`127.0.0.1:54322`). The script already ends with `prettier --write`, so output is deterministic. MEDIUM: not executed here (needs a running stack). |
| ESLint `no-restricted-syntax` (built-in rule) | ESLint 10.11.0 | Bans bare `new Date()` and `Date.now()` in `*.test.*` and `e2e/**` | Prevents wall-clock reads from re-entering tests. Selectors: `NewExpression[callee.name='Date'][arguments.length=0]` and `CallExpression[callee.object.name='Date'][callee.property.name='now']`. The repo already configures `no-restricted-syntax` in `eslint.config.js` (dynamic-import fence); in flat config a later block replaces rather than merges a rule's options, so scope the new block to test and e2e globs and keep it from overlapping files that rule covers. MEDIUM: standard ESLint feature, not run here. |
| GitHub composite action `.github/actions/setup/action.yml` | GitHub built-in | Collapses the checkout/pnpm/node/install block repeated in all six CI jobs | jscpd found 5 intra-file clones in `ci.yml`, which is that block. A composite action removes it with no dependency. |
| actionlint | 1.7.12 (2026-03-30) | Static lint of workflow YAML (expressions, shell, job wiring) | Optional CI job. Go binary, run via its official action or Docker; not an npm package. MEDIUM: version verified, not executed. |
| zizmor | 1.30.1 (2026-09-09) | Security audit of workflows (unpinned actions, excessive permissions) | Optional. `ci.yml` already sets `permissions: contents: read`; actions are tag-pinned, so expect "unpinned-uses" findings. MEDIUM: version verified, not executed. |
| `pnpm dedupe --check` | pnpm 10.34.5 built-in | Fails when the lockfile contains avoidable duplicate versions | Cheap CI step. Ran on a copy: completed with no "could be deduped" error. MEDIUM (exit code not captured cleanly). |

### Development Tools (configuration)

| Tool | Purpose | Notes |
|------|---------|-------|
| `knip.json` (root) | Workspace-aware entry/project patterns | Verified configuration below. Two runs: default mode and `--production` mode. |
| `.jscpd.json` (root) | Duplication scan scope and threshold | Below. Gate source only; report tests/YAML without failing. |
| `test/clock-sweep.ts` and `test/global-tz.ts` (new, root) | Reusable `HEARTH_TEST_NOW` / `HEARTH_TEST_TZ` hooks for Vitest `setupFiles` and `globalSetup` | Below. The top-level-call variant of the setup hook was used for the verification sweep. |

#### Verified `knip.json`

This exact config was run against HEAD (default and production mode) and produced the baseline in "Observed Baseline" below.

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "ignoreExportsUsedInFile": true,
  "ignoreBinaries": ["supabase", "psql"],
  "workspaces": {
    ".": {},
    "apps/service": {
      "entry": ["src/write-openapi.ts!"],
      "project": ["src/**/*.ts!", "scripts/**/*.ts", "!src/test/**!"]
    },
    "apps/web": {
      "project": ["src/**/*.{ts,tsx}!", "scripts/**/*.mjs", "!src/test/**!", "!src/test-setup.ts!"]
    },
    "packages/*": {
      "project": ["src/**/*.ts!"]
    }
  }
}
```

Why each line matters:

- `ignoreExportsUsedInFile`: removes about 165 items of zero-config noise (185 down to 19), including all 45 exports in the generated `db/types.ts` (they are used inside that file). No `ignore` entry for `db/types.ts` is needed; Knip even hints "Remove from ignore" if you add one.
- `ignoreBinaries`: `supabase` and `psql` are external CLIs invoked by `service-stack.ts` and `seed-users.ts`.
- `src/write-openapi.ts!`: run by `tsup && tsx src/write-openapi.ts` in the `build` script. Production mode only follows the `start` script, so it must be declared. In default mode Knip prints a "redundant entry" config hint for it; leave it, since the hint is mode-dependent.
- `!src/test/**!` and `!src/test-setup.ts!`: keep test helpers out of the production graph, so code reachable only from tests surfaces as dead.
- No `entry` is needed for `main.tsx`, `sw.ts` (vite-plugin-pwa `injectManifest`), `cli.ts` (tsup), `src/index.ts` of the packages (package `exports`), `e2e` global setup, Playwright specs, or Vitest files; plugins and `package.json` cover them, and adding the first group produced "redundant entry" hints. Do not add an `entry` override for `apps/web`: in an earlier trial config that did, `tailwindcss` was reported as an unused devDependency (CSS `@import` is not followed). The final config prints two harmless hints (the mode-dependent `write-openapi` one and `.css` not followed) and does not report `tailwindcss`.

#### `package.json` scripts (root)

```json
{
  "knip": "knip",
  "knip:production": "knip --production --workspace \"!e2e\" --workspace \"!supabase/seed\"",
  "dup": "jscpd"
}
```

Use escaped double quotes, not single quotes: pnpm runs scripts through `cmd.exe` on Windows (this owner's machine), where single quotes are not quoting. Verified through `pnpm run knip:production`. `ignoreWorkspaces` exists in Knip's JSON schema but only excludes a workspace from the report in every mode, so the CLI negation is still needed for the production run.

#### `.jscpd.json`

```json
{
  "path": ["apps", "packages", "e2e", "supabase/seed"],
  "format": ["typescript", "tsx"],
  "minTokens": 60,
  "minLines": 8,
  "threshold": 1,
  "gitignore": true,
  "reporters": ["console"],
  "ignore": [
    "**/node_modules/**", "**/dist/**", "**/coverage/**",
    "**/db/types.ts", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"
  ]
}
```

The CLI-flag equivalent (`--min-tokens 60 --min-lines 8 --format typescript,tsx --ignore ...`) was run and produced 11 clones, 0.46% duplicated lines. `threshold: 1` is a ratchet one point above today's figure: a whole-tree percentage, so no baseline file has to be committed (a committed baseline would itself be a generated artifact). `--fail-on-new-clones` with `--baseline-from-ref origin/main` is the stricter alternative but needs `fetch-depth: 0` in CI.

#### `test/clock-sweep.ts` (Vitest setup file, shared by every workspace)

```ts
import { beforeEach, vi } from 'vitest';

// Differential flake detector: pin "now" and the timezone from the environment.
// Unset = no change, so normal runs are untouched.
const now = process.env['HEARTH_TEST_NOW'];
if (now !== undefined && now !== '') {
  beforeEach(() => {
    vi.setSystemTime(new Date(now)); // re-applied: useRealTimers() in a test discards it
  });
}
```

and a `globalSetup` module (works under both pools, and on Windows):

```ts
// test/global-tz.ts
export default function setup(): void {
  process.env['TZ'] = process.env['HEARTH_TEST_TZ'] ?? 'UTC';
}
```

Register with `test.globalSetup` and `test.setupFiles` in each workspace's Vitest config (for `apps/web` that is the `test` block in `vite.config.ts`). The `beforeEach` form is a deliberate hardening over the top-level call used in the verification sweep, because `vi.useRealTimers()` (called in existing `afterEach` blocks) restores the real clock for the rest of the file. MEDIUM until run; the top-level variant was run.

## Observed Baseline (what the roadmap is sizing)

All numbers are from executing the tools on a clean copy of HEAD `224b93b`, pnpm install `--frozen-lockfile --ignore-scripts`.

**Knip, zero-config:** exit 1; 0 unused files; 1 unused devDependency; 1 unlisted dependency; 3 unlisted binaries; 102 unused exports; 83 unused exported types (45 of them in generated `db/types.ts`); 1 duplicate export. About 165 of these disappear with the config above, almost all via `ignoreExportsUsedInFile`.

**Knip, default mode with the config above** (what a PR gate would see):

| Finding | Where |
|---------|-------|
| Unused devDependency `tsx` | `supabase/seed/package.json` (the seed script is launched by `apps/service`'s `tsx`) |
| Unlisted dependency `fuse.js` | `packages/matching/scripts/fuzzy-benchmark.ts` (script imports a package that is not installed, so it cannot run: broken or dead) |
| 6 unused exports | `pruneCutoffs` (jobs barrel), `useFavoriteStores`, `listIdOfWrite`, three meal fixtures (`currentWeekFixture`, `previousWeekFixture`, `emptyWeekFixture`) |
| 13 unused exported types | 12 in `apps/service/src/jobs/index.ts` barrel, `ChoreLike` |
| 1 duplicate export | `BILLS_EMPTY_COPY` / `BILLS_LIST_EMPTY_COPY` in `bills-copy.ts` (same value exported under two names) |

**Knip, `--production`** (code unreachable from shipped entry points; the dead-code signal):

| Finding | Detail |
|---------|--------|
| 1 unused file | `apps/service/src/deals/flipp/normalized-fixtures.ts` (a test fixture living in `src/`) |
| 24 unused exports | mostly the `jobs/index.ts` barrel and `FIXTURE_NOW`/`NORMALIZED_FIXTURE_DIR`; also `parseIngredientLines`, `BANNED_GAMIFICATION_WORDS`, `allChoreCopyStrings`, `PushPortProvider` |
| 13 unused exported types | same barrel |

These are candidates, not deletions. Per project policy ("remove only proven-dead code; list uncertain candidates"), use Knip as the evidence and the `markdown` or `json` reporter to produce the owner list. A symbol used only by tests is dead in production but still guarded by a test, so each needs a human call.

**Default mode finds no unused files by design.** Vitest and Playwright plugins make every test file an entry, and tests import helpers, so everything stays reachable. Only `--production` exposes dead modules. A zero-config run that reports "0 unused files" is a false all-clear.

**jscpd:** source only (min 60 tokens / 8 lines, tests excluded): 345 files, 11 clones, 188 duplicated lines (0.46%). The clones are web screen forms: `SignInScreen`/`SignUpScreen`, `ChangeEmailForm`/`ChangePasswordForm`, `ListDetailScreen`/`PantryScreen`, `ChoreDetailScreen`/`ChoreFormScreen`, `CreateHouseholdStep`/`HouseholdSettingsSection`, and `matching`/`shared` `vitest.config.ts`. Whole repo including tests, YAML and shell (min 50 / 6): 169 clones, 2.74%. Concentrated in `chores.integration.test.ts` (19), `jobs.integration.test.ts` (9), `ci.yml` (5), `deals.integration.test.ts` (5), and `chores.test.tsx`/`errands.test.tsx` pairs.

**Time-dependent tests, found by the sweep** (web suite, 715 tests; baseline passes 715/715 in 85 s on the owner's machine timezone):

| Pinned instant and TZ | Result |
|-----------------------|--------|
| 2026-10-17T02:30Z (Saturday UTC, Friday evening in LA), `America/Los_Angeles` | 7 failed |
| 2026-03-08T07:30Z (US DST start), `Pacific/Kiritimati` (UTC+14) | 1 failed |
| 2027-01-01T00:30Z (year boundary), `Pacific/Pago_Pago` (UTC-11) | 10 failed |

Union of failing files, all needing triage: `src/lib/bills/recurrence-preview.test.ts` (4 tests), `src/screens/chores/chores.test.tsx`, `src/screens/chores/chores-offline-queue.test.tsx`, `src/screens/deals/favorites.test.tsx`, `src/screens/deals/deal-search.test.tsx`, `src/screens/deals/flyers.test.tsx`, `src/screens/meals/suggestions.test.tsx`. Caveat: the "stale as-of date" tests (favorites, deal-search, flyers, suggestions) fail at every pinned instant, which suggests they assume a wall clock later than their fixture dates. That is still a wall-clock dependency and would eventually fail in the other direction, but it is a different defect from a timezone bug and should be fixed by pinning "now" inside the test. The service unit, packages and integration suites were not swept.

## Installation

```bash
# Root workspace only (saveExact is already true in pnpm-workspace.yaml)
pnpm add -Dw knip@6.41.0 jscpd@5.4.1
```

No other package is added. Do not run `pnpm add` for fake-timer, date-mocking or cross-env packages.

## CI Enforcement

Put both Knip runs and the cheap guards in the existing `lint` job (they need install only, about 30 s total); do not create a job that repeats the install.

```yaml
- run: pnpm knip
- run: pnpm knip:production
- run: pnpm dup
- name: No tracked files match .gitignore
  run: test -z "$(git ls-files -ci --exclude-standard)"
```

Knip exit codes: 0 clean, 1 issues, 2 could not run (bad config or plugin load error). Use `--max-issues N` as a temporary ratchet while cleanup is in flight, and `rules` (`"error"` default, `"warn"` prints but is not counted, `"off"`) to stage category by category. Suggested order: dependencies, unlisted, binaries, files (blocking from day one, they are few), then exports and types as `warn`, flipped to `error` when the owner list is resolved. Add `--treat-config-hints-as-errors` only after the redundant-entry hint above is accepted or removed.

For flake detection, add a matrix to the unit-test job after the suite is fixed (about 90 s each, run in parallel):

```yaml
strategy:
  matrix:
    include:
      - { tz: UTC,                  now: '' }
      - { tz: America/Los_Angeles,  now: '2026-10-17T02:30:00Z' }
      - { tz: Pacific/Kiritimati,   now: '2026-03-08T07:30:00Z' }
env:
  HEARTH_TEST_TZ: ${{ matrix.tz }}
  HEARTH_TEST_NOW: ${{ matrix.now }}
```

An empty `HEARTH_TEST_NOW` (the UTC row) is treated as unset by the hook. This is the concrete mechanism for the requirement "passes on any weekday and household timezone".

Optional: `pnpm audit --prod --audit-level high` as a gate. The `braces` transitive advisory has no upstream patch, so the gate needs an ignore entry. The ignore key depends on the pnpm major: the pnpm docs fetched here describe pnpm 12 (`audit.ignore` in `pnpm-workspace.yaml`, with `auditConfig.ignoreGhsas` as the deprecated older name). The repo is pinned to pnpm 10.34.5, so confirm the key against pnpm 10 docs before adding it. MEDIUM.

## E2E Determinism (what the tooling can and cannot do)

- **The browser clock does not move the server or database.** `page.clock` patches `Date`, `Temporal.Now`, timers, `requestAnimationFrame`, `performance` and `Event.timeStamp` in the page (init script plus already-open main frames), not in workers. The Fastify service, Postgres `now()` and cron jobs keep real time, and `chores.ts` explicitly compares against "the database clock". Installing a fake browser clock in an E2E journey that renders server-derived dates will make the UI disagree with the data.
- **Therefore:** keep E2E on the real clock; derive expected days from the seeded data or from one household-timezone helper (the two argument-less `new Date()` reads in `e2e/` are `16-bill-paid-late-keeps-anchor.spec.ts:30` and `19-notifications.spec.ts:200`; the lint rule above catches exactly that shape and stops new ones). Pin `timezoneId` and `locale` in `playwright.config.ts` `use` so the browser matches the household regardless of runner TZ. Use `page.clock.setFixedTime` only for assertions that are purely client-side.
- **Weekday and timezone coverage belongs at unit/component/integration level**, where the repo already injects `now: () => Date` (jobs, deals, JWT). That is what the sweep matrix exercises.
- **Service worker is outside the fake clock.** Playwright installs the clock as a context init script and evaluates it in main frames; nothing in its source or docs extends it to workers. Treat `sw.ts` time logic as covered by `sw.test.ts`, not by `page.clock`. MEDIUM (absence of evidence in source; not tested in a browser).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| knip | ESLint `no-unused-vars` / TypeScript `noUnusedLocals` | Already covered and clean: `strictTypeChecked` is on, and `tsc --noUnusedLocals --noUnusedParameters` reports 0 in all six workspaces. They only see inside one file; Knip sees across modules and packages. Keep both, add Knip. |
| knip | dependency-cruiser 18.5.0 | If the owner later wants enforced architecture boundaries (the `privileged/` fence already uses ESLint `no-restricted-imports`). Not a dead-code tool. Knip 6 also has a `cycles` issue type (off by default) for circular imports. |
| jscpd `threshold` | jscpd `--fail-on-new-clones` + `--baseline-from-ref origin/main` | If the team wants "no new duplication, ignore the legacy" rather than an absolute ceiling. Costs `fetch-depth: 0`. |
| globalSetup `TZ` | `cross-env TZ=UTC vitest` | Works, and is the right choice only if a workspace's tests must run under a different TZ than its siblings and you want it visible in the script. Adds a dependency for no gain here. |
| Vitest `vi.setSystemTime` | `@sinonjs/fake-timers` 15.4.0 directly | Never in this repo; Vitest wraps it. Only for non-Vitest runners (the `node --test` file in `e2e/support/run-identity.test.ts` does not read the clock). |
| Playwright `page.clock` | libfaketime in the service container | If full-stack time travel is ever required. Postgres runs in a separate container and uses its own clock; both would need faking, plus a restart per scenario. Disproportionate for a household app. |
| pnpm built-ins (`dedupe --check`) | sherif 1.13.0 | Ran sherif on the repo: "No issues found". `saveExact` plus the frozen lockfile already enforce consistency, so it would add a CI step with no findings. Revisit if the workspace grows. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| depcheck 1.4.7 | Knip's comparison page lists it as archived and recommending Knip, and says none of these tools support workspaces | knip |
| ts-prune 0.10.3 | Last published 2022-05; archived; recommends Knip | knip |
| unimported 1.31.1 | Last published 2024-03; archived; production mode only | knip `--production` |
| ts-unused-exports 11.0.1 | Subset of Knip (exports only), no workspace awareness | knip |
| madge 8.0.0 | Last published 2024-08; only circular-dependency detection | knip `cycles`, or dependency-cruiser if boundaries are needed |
| `knip --fix` / `--allow-remove-files` | Deletes code and files automatically; conflicts with the "uncertain candidates are listed, not deleted" constraint, and dynamic imports/Docker/Supabase config defeat static analysis | Report with `--reporter markdown` or `json`, review by hand |
| Zero-config Knip as a gate | Would fail on about 185 issues, most of them noise (generated types, exports used in-file) and report 0 unused files | The verified config above |
| `test.env: { TZ }` or a `setupFiles` assignment as the only TZ mechanism | Silently ignored under `pool: 'threads'` (probed and documented); breaks if anyone changes the pool | `globalSetup` |
| Inline `TZ=UTC vitest` in `package.json` scripts | Not valid in `cmd.exe`; swallowed by Git Bash on Windows (probed) | `globalSetup` |
| mockdate 3.0.5, timekeeper 2.3.1, a second fake-timer library | Last published 2022 and 2023; redundant with Vitest, and two mocks of `Date` fight each other | `vi.setSystemTime` / `vi.useFakeTimers` |
| `vi.useFakeTimers()` with defaults around Testing Library `waitFor` | Fakes `setTimeout`, so `waitFor` polling hangs. The repo's existing `toFake: ['Date']` and `shouldAdvanceTime: true` patterns are the correct ones | `vi.useFakeTimers({ toFake: ['Date'] })` or no fake timers plus `vi.setSystemTime` |
| `page.clock.install` for journeys that read server dates | Browser and server disagree about "today" | Real clock plus data-derived expectations |
| jscpd `--semantic` | Experimental; downloads a 548 MB embedding model | Default token-based detection |
| jscpd v4 (4.3.0, `latest-4` tag) | Superseded line (npm tag `latest-4`); v5 reads v4 config files, so there is no migration cost | jscpd 5.4.1 |
| TypeScript 7.0.2 migration | Now `latest` on npm, but a compiler migration is outside "no framework migrations / behavior unchanged" | Stay on 6.0.3; Knip does not depend on it |

## Stack Patterns by Variant

**If a Knip finding is a barrel re-export (the `jobs/index.ts` case):**
- Prefer deleting the barrel entries only after confirming no `import ... from './jobs'` or dynamic import remains (`knip --trace-export <name>` shows importers).
- Because the barrel is a public-facing seam for a package-like folder, list it for the owner rather than delete.

**If a test fixture lives in `src/` (the `normalized-fixtures.ts` case):**
- Move it under `src/test/` (already excluded from production by `!src/test/**!`), rather than ignoring it in Knip.
- Because that makes the production/test boundary mechanical.

**If a test needs a fixed "now" itself (the stale as-of-date tests):**
- Call `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(<fixture-relative instant>)` inside the test or `beforeEach`, as `chores.test.tsx` already does.
- Because the sweep hook only supplies a *different* now per run; a test that hard-codes its own now is immune, which is the goal.

**If the service or packages Vitest suites are added to the matrix:**
- Reuse the same two files. Integration tests (`*.integration.test.ts`) should stay out of the matrix: they use the database clock and `fileParallelism: false`, so the cost is high and the signal low.

**If CI minutes matter:**
- Run the `HEARTH_TEST_NOW` matrix on `push` to `main` and nightly, not on every pull request; keep the single UTC run as the PR gate.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| knip@6.41.0 | Node 24, TypeScript 6.0.3, pnpm 10.34.5 | Declares Node `^20.19.0 \|\| >=22.12.0`; no `peerDependencies`; ran against TS 6.0.3 without issue. Auto-enables vite, vitest, playwright, tsup, eslint, husky, lint-staged, commitlint, github-actions plugins. Does not know `kysely-codegen` or Workbox; neither produced false positives. |
| jscpd@5.4.1 | Node >=18, ubuntu-latest (linux-x64-gnu), Windows x64 (windows-x64-msvc) | Native binary arrives as an optional dependency; no install script, so `onlyBuiltDependencies` needs no change. Windows `pnpm dlx` run worked. |
| vitest@5.0.1 (repo) / 5.0.3 | Vite `^6.4 \|\| ^7 \|\| ^8` (repo: Vite 8.3.0), Node >=22.12 | v5 changes relevant here: fake timers and `setSystemTime` also mock `Temporal`; `clearMocks` defaults to `true`; `VITEST_WORKER_ID` is 1-based; default pool `forks`. Behavior probed on 5.0.3 and the web suite swept on the repo's 5.0.1. |
| @playwright/test@1.63.0 | `page.clock` API as documented for 1.63 | 1.64.0 (2026-10-11) forwards device `screen` to the page, changes JSX handling in test files and renames the `--update-snapshots` default; no clock/timezone changes. Do not bump as part of cleanup. |
| actionlint@1.7.12, zizmor@1.30.1 | any runner | Standalone binaries, not part of the pnpm graph. |
| Local Node 26.10.0 (this machine) vs `.nvmrc` 24 | n/a | Experiments ran on Node 26.10.0; CI and Docker pin Node 24. `Temporal` is present as a global on 26, so `Temporal` behavior in the probe may differ on 24. The TZ and `Date` conclusions do not depend on it. |

## Sources

- knip.dev "Monorepos & workspaces", "Production mode", "Rules & filters", "CLI reference", "Configuration", "Comparison & migration" (fetched 2026-10-11) — workspace config, `!` production entries, exit codes 0/1/2, `rules`, tool comparison and archived status of depcheck/unimported/ts-prune; confirmed by running knip 6.41.0 on the repo copy. Seam tier LOW (WebFetch); behavior HIGH (executed).
- npm registry (`npm view`, 2026-10-11) — knip 6.41.0 (modified 2026-10-09, engines, no peerDependencies), jscpd 5.4.1 (bin, optionalDependencies, engines), vitest 5.0.3, @playwright/test 1.64.0, depcheck 1.4.7 (2025-08), ts-prune 0.10.3 (2022-05), unimported 1.31.1 (2024-03), ts-unused-exports 11.0.1 (2024-11), madge 8.0.0 (2024-08), mockdate 3.0.5 (2022), timekeeper 2.3.1 (2023), sherif 1.13.0, TypeScript dist-tags (latest 7.0.2). HIGH (registry metadata).
- github.com/kucherenko/jscpd README and `docs/rust.md` (fetched 2026-10-11) — v5 Rust engine, flags, exit-code table, config keys and discovery order. Truncated at 100,000 characters (dead-code section unread, not needed). Seam tier LOW; flags used were executed.
- vitest.dev `api/vi`, `config/pool`, `guide/migration` (v5.0.3 reference) — `setSystemTime`, `useFakeTimers`, `stubEnv`, default pool `forks`, "Changing `process.env.TZ` does not affect the time zone in a worker thread", Vitest 5 breaking changes. Cross-checked by probe.
- playwright.dev `docs/clock`, `docs/emulation`, `docs/release-notes` (1.60-1.64) and `packages/playwright-core/src/server/clock.ts` on GitHub main — clock API, init-script installation in main frames, `timezoneId`/`locale` scope, no clock changes in 1.60-1.64. Seam tier LOW; source reading HIGH.
- pnpm.io `cli/audit` — `audit.ignore` / deprecated `auditConfig.ignoreGhsas` (pnpm 12 docs; pnpm 10 key unverified). MEDIUM.
- GitHub releases API — actionlint v1.7.12, zizmor v1.30.1. MEDIUM (versions only).
- Local probes (scratchpad, Node 26.10.0, Windows 11): Vitest TZ across `forks`/`threads` x `globalSetup`/`setupFiles`/`test.env`/CLI; `setSystemTime` and `useFakeTimers` defaults; Knip zero-config, default, production and final-config runs; jscpd source and whole-repo runs; sherif; `pnpm dedupe --check`; web-suite sweep under three pinned instant/TZ pairs; `tsc --noUnusedLocals`. HIGH.
- Not available: Context7 MCP and the `ctx7` CLI were not present in this environment, so library docs came from official documentation sites via WebFetch plus the executed checks above.

---
*Stack research for: cleanup and hardening of a TypeScript pnpm monorepo (hearth)*
*Researched: 2026-10-11*
