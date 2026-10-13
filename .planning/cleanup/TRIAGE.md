# Triage - knip and jscpd findings

## Approvals

- Package legitimacy: knip@6.41.0 approved - 2026-10-13
- Package legitimacy: jscpd@5.4.1 approved - 2026-10-13

## Calibration

### Setup

- knip 6.41.0, exact-pinned root devDependency on `chore/knip-config` (from `origin/main` 89eb558), Node v24.21.0. `pnpm add -Dw knip@6.41.0` printed no `Ignored build scripts` line.
- Config: root `knip.json` (entries per workspace as the plan specifies; no `ignore`, `ignoreFiles` or `ignoreDependencies`). Report-only: only `--reporter json` was ever run; no `--fix` or file-removal flag.
- Default mode: `pnpm --silent knip --reporter json` (exit 1: findings reported).
- Production mode: `pnpm --silent knip:production --reporter json`, which expands to `knip --production --workspace "!e2e" --workspace "!supabase/seed"` (exit 1: findings reported).
- Records: `.planning/cleanup/knip/calibration-default.json`, `calibration-production.json` and the normalized `calibration-default-summary.txt`, `calibration-production-summary.txt` (`kind<TAB>path<TAB>symbol`, sorted, final `total` line).

### Finding counts per kind (baseline config, no canaries)

| Kind | Default | Production |
| --- | --- | --- |
| files | 0 | 1 |
| dependencies | 0 | 0 |
| devDependencies | 2 | 0 |
| unlisted | 1 | 0 |
| binaries / unresolved | 0 | 0 |
| exports | 17 | 40 |
| types | 37 | 37 |
| duplicates | 1 | 1 |
| total | 58 | 79 |

Production mode sees no devDependency findings (devDependencies are out of scope there) and sees more exports because exports used only by tests are no longer counted as used.

### Known-live entries

None of the nine entry files below is reported on a `files` line in either mode's summary.

| Entry file | Reported as unused file (default) | Reported as unused file (production) |
| --- | --- | --- |
| `apps/web/src/sw.ts` | no | no |
| `supabase/seed/seed-users.ts` | no (workspace excluded from production) | no (workspace excluded from production) |
| `e2e/global-setup.ts` | no | no (workspace excluded from production) |
| `e2e/global-teardown.ts` | no | no (workspace excluded from production) |
| `apps/service/src/cli.ts` | no | no |
| `packages/shared/src/index.ts` | no | no |
| `packages/shared/src/common-passwords.ts` | no | no |
| `packages/recurrence/src/index.ts` | no | no |
| `packages/matching/src/index.ts` | no | no |

For `e2e` and `supabase/seed`, the production-mode "no" means the workspace is not analyzed at all by the `knip:production` script; the default-mode "no" is the real check for the three `e2e` and `supabase/seed` entries.

### Observations on the baseline report

- `tailwindcss` IS reported (default mode, unused devDependency in `apps/web/package.json`). This is a false positive: `apps/web/src/index.css` line 1 is `@import 'tailwindcss';` and knip does not follow CSS imports. Research predicted exactly this when `apps/web` gets an `entry` override, which the plan requires (for `sw.ts`). It is not hidden with an `ignoreDependencies` entry (D-10): it is a known limitation, routed to the uncertain bucket for plan 02-07.
- Research cross-check: `tsx` is reported as an unused devDependency of `supabase/seed/package.json`, and `fuse.js` as an unlisted dependency of `packages/matching/scripts/fuzzy-benchmark.ts`. Both match the research baseline. (`tsx` is launched by the service's `db:seed` script through a cross-workspace path, so it is a candidate for the owner list, not a deletion.)
- Other research findings reproduced: `pruneCutoffs` (jobs barrel), `useFavoriteStores`, `listIdOfWrite`, and the three meal fixtures (`currentWeekFixture`, `previousWeekFixture`, `emptyWeekFixture`).
- New in this config versus research: `includeEntryExports: true` on the three packages surfaces unused re-exports of the package barrels (for example `packages/matching/src/index.ts` `BRANDS`, `DESCRIPTORS`, `UNITS`, `tokenize`; `packages/recurrence/src/index.ts` `currentTurnIndex`). These are API-surface candidates, not proof of dead code, and are triaged in 02-07.
- Production mode reports one unused file, `apps/service/src/deals/flipp/normalized-fixtures.ts`. It is imported by a test (`normalized-fixtures.test.ts`) and a script (`apps/service/scripts/normalize-fixtures.ts`), so it is test/script-only rather than proven dead; triaged in 02-07.
- Configuration hints: default mode prints 13 "Remove redundant entry pattern" hints (every `!` production entry, plus `playwright.config.ts` and others), because plugins and `package.json` already supply those entries in default mode, and one hint that `.css` imports are not followed. The plan requires explicit entries and the redundancy is mode-dependent, so the hints are left unaddressed.

### Canary table

Four canaries were planted on the throwaway branch `scratch/knip-canaries` (commit `test: plant knip calibration canaries`, deleted afterwards; never pushed) and measured in both modes. Records: `calibration-canary-default.json`, `calibration-canary-production.json` and their `-summary.txt` files. The canary runs differ from the baseline runs only by the canary lines (diff of the two summaries per mode), and the totals moved from 58 to 61 (default) and from 79 to 83 (production).

| Canary | Planted at | Expected default | Expected production | Observed default | Observed production | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| dead file canary | `apps/web/src/lib/knip-canary-orphan.ts` | not reported (research: tests make everything reachable) or noted if reported | `files` line | `files` line (reported) | `files` line | PASS |
| dead export canary | `KNIP_CANARY_UNUSED_EXPORT` in `apps/web/src/lib/format.ts` | `exports` line | `exports` line | `exports` line | `exports` line | PASS |
| unused dependency canary | `fastest-levenshtein` in `apps/web/package.json` `dependencies` | `dependencies` line for `apps/web/package.json` | not required | `dependencies` line | `dependencies` line | PASS |
| test-only export canary | `knipCanaryTestOnly` in `apps/service/src/problem.ts`, called from `problem.test.ts` | absent | `exports` line | absent | `exports` line | PASS |
| known-live entries canary check | the nine entry files listed above | no `files` line | no `files` line | none of the nine reported | none of the nine reported | PASS |

All expectations held on the first measurement, so no `knip.json` change was needed (no config-gap row, no `ignoreDependencies` value).

Notes:

- Default mode DID report the orphan file as a `files` line. Research expected default mode to report no unused files; with explicit entries and `!`-suffixed project patterns this config does report a file nothing imports, even in default mode. Both modes therefore see dead files; production mode additionally sees files reachable only from tests, such as `apps/service/src/deals/flipp/normalized-fixtures.ts`.
- The unused-dependency canary was also reported in production mode, which the plan did not require.
- Only the test-only export separates the two modes as the plan intended: it is invisible in default mode (the test counts as a use) and visible in production mode.

### Known limitations (routed to 02-07's uncertain bucket)

- `tailwindcss` (unused devDependency, `apps/web`): CSS `@import` is not followed by knip. Not hidden by a config exception; owner or 02-07 decides.
- Anything reachable only through Docker, Compose, Kong, Caddy, SQL, shell scripts or string-built paths (for example `HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`, `e2e/fixtures/`) cannot be modelled and goes to the owner list rather than the removal list (D-10).
- `knip:production` skips the `e2e` and `supabase/seed` workspaces by construction, so dead code inside them is seen by default mode only.

## Method

### Tree and versions

- Analysis tree: scratch branch `scratch/phase2-combined` in `../hearth-analysis` (removed after this plan), built from `chore/knip-config` at `f2e3c04` with `test/deterministic-clock` (tip `9e794ae`) merged in by a merge commit (`6dc9999`; no conflicts, so no conflict resolution was needed), then `chore/knip-config` at `70acd70` merged in (`b144d0d`). Combined tree HEAD: `b144d0d`.
- Branch tips at analysis time: `test/deterministic-clock` `9e794ae`; `chore/knip-config` `70acd70` (`f2e3c04` plus the one `knip.json` commit below).
- knip 6.41.0 (exact-pinned root devDependency), Node v24.21.0, `pnpm install --frozen-lockfile` run in the tree before and after each merge.
- Report-only: only `--reporter json` and `--trace-*` were run; no `--fix`, no file removal.

### Commands

- Default mode: `pnpm --dir ../hearth-analysis --silent knip --reporter json > .planning/cleanup/knip/default.json` (exit 1: findings).
- Production mode: `pnpm --dir ../hearth-analysis --silent knip:production --reporter json > .planning/cleanup/knip/production.json` (exit 1: findings).
- Both reports are normalized by the session-local helper `node ../hearth-aside/bin/knip-summary.mjs {in.json} {out.txt}` into `default-summary.txt` and `production-summary.txt` (sorted `kind<TAB>path<TAB>symbol` lines and a final `total` line). A duplicates finding is written as `pathA:nameA|nameB` by the helper.
- Totals on the combined tree: default 59, production 80. Unique findings across both: 86.
- Tool evidence: `knip --trace-export {name}` for exports, types and duplicates (default mode, and `--production` as well for production-only items), `knip --trace-file {path}` for files, `knip --trace-dependency {name}` for dependency kinds.

### Combined-tree check (Phase 2 test infrastructure)

Before the fix, the first run on the combined tree reported three Phase 2 files as unused in production mode (`before-gap-fix-production-summary.txt`): `scripts/test-sweep.mjs`, `test/clock-setup.mjs`, `test/global-tz.mjs`. They are live (sweep script run by the root `test:sweep` scripts; the two `test/` files are `setupFiles` / `globalSetup` of the vitest configs), but `knip.json` declared no entries for the root workspace, and production mode only follows entries marked `!`. The narrowest declaration, `"entry": ["test/*.mjs!", "scripts/test-sweep.mjs!"]` on the root workspace, was committed on `chore/knip-config` as `70acd70` (`chore: declare the shared test setup as knip entries`), merged into the analysis tree, and both modes re-run. After it, none of those files, none of `apps/service/src/test/zone-dates.ts`, `zone-dates.test.ts`, `e2e/support/clock.ts`, `clock.test.ts`, and none of the exports of `zone-dates.ts` or `e2e/support/clock.ts` is reported (default mode never reported them; `before-gap-fix-default-summary.txt` equals the final default summary). The three files are recorded as `config-gap` rows below. The fix surfaced one new, real finding in production mode: `vitest` is imported by `test/clock-setup.mjs` but undeclared in the root `package.json` (it was already reported in default mode); it is an `uncertain` row, not a config gap.

### Bucket rules

- `proven-dead`: reported by knip; no importer (`--trace-export` or `--trace-file` shows none); no non-documentation hit in a text search across every tracked file type outside the file(s) that define the name; and not on the uncertain list below.
- `test-only`: reported by `--production` only, so only tests, test helpers or a barrel line that only tests import use it.
- `config-gap`: reported because the config missed a reachability knip can model, now fixed in `knip.json`.
- `uncertain`: reachable or plausibly reachable through Docker, Compose, Kong or Caddy config, SQL, string-built paths, a dynamic import, a script outside `package.json`, or any non-documentation text-search hit that is not a plain test use; plus the standing list in `OWNER-CANDIDATES.md`. Two further classes are forced here, following the 02-06 limitations:
  - package public surface: any finding on a symbol in `packages/*/src` that is exported through the package entry (knip reports these only because `includeEntryExports` is on). They are API-surface candidates, never proven dead, whatever the mode;
  - curated barrel re-exports: a re-export line in `apps/service/src/jobs/index.ts` with no importer. The file is a deliberate barrel with its own test (`jobs/index.test.ts`); the symbols live in their defining modules.
  - Also uncertain: dependency findings (`tailwindcss`, `tsx`, `fuse.js`, `vitest`), the one `duplicates` finding, and the Flipp fixture mechanism (`HEARTH_FLIPP_FIXTURE_DIR`).
- Precedence when an item fits more than one bucket: uncertain, then config-gap, then test-only, then proven-dead.
- Row order: bucket (proven-dead, test-only, config-gap, uncertain), then item path, then symbol, compared as plain strings so a re-run gives the same order.
- A bucket with no findings still shows a count line with 0.

### Text search

`git -C ../hearth-analysis grep -n -I -w -F -e {needle} -- . ':!pnpm-lock.yaml' ':!.planning' ':!.claude'`. The needle is the symbol for exports and types (each name of a duplicates pair), the basename without extension for files, and the package name for dependencies. `.planning/` and `.claude/` hold planning notes, not usage, and are excluded. Hits under `docs/` or in `*.md` are recorded as documentation: stale references for Phase 3 (DEAD-04), not usage. Test files are `*.test.*`, `*.spec.*`, `*/src/test/*` and `e2e/{support,tests,fixtures}/`. The defining file(s) of a name are the files that `--trace-export` lists as declaring or re-exporting it; hits inside them are counted separately ("inside them") because a name always appears where it is defined. An `-w` match on a name also hits unrelated identifiers of the same spelling (for example a local `UNITS` constant in `ItemSheet.tsx`, an object key `pruneCache` in `scheduler.ts`); such hits are listed, not discounted, and make the row `uncertain` unless the row is a barrel or test-only case explained in its Notes.

### Reading the ledger

Nothing here is acted on in this phase. `proven-dead` means the evidence that Phase 3's three-part proof starts from is present; Phase 3 still repeats the proof before deleting. A `types` or `exports` row is an unused `export`: removal may mean dropping the `export` keyword, not deleting the symbol.

## Findings

- proven-dead: 6
- test-only: 19
- config-gap: 3
- uncertain: 61

89 rows: 86 unique findings from the two knip reports plus 3 config-gap rows for items the Task 1 `knip.json` fix removed from the report. Ordered by bucket (proven-dead, test-only, config-gap, uncertain), then item path, then symbol. Hit counts exclude hits inside the file(s) that define or re-export the name, which are counted separately ("inside them"). A pipe inside an item is escaped as `\|` (see Notes below the table).

| # | Item | Kind | Mode | Bucket | Tool evidence | Text-search evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `apps/web/src/components/chores/chore-copy.ts:ChoreLike` | types | both | proven-dead | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Remove the `export` keyword or the type; it is not used in its own file either (`ignoreExportsUsedInFile`). |
| 2 | `apps/web/src/lib/api/deals.ts:useFavoriteStores` | exports | both | proven-dead | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | No importer and no mention outside its defining file. |
| 3 | `apps/web/src/lib/offline/write-queue.ts:listIdOfWrite` | exports | both | proven-dead | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | No importer and no mention outside its defining file. |
| 4 | `apps/web/src/test/meal-fixtures.ts:currentWeekFixture` | exports | default | proven-dead | knip exports (default); `--trace-export`: 0 importer(s) in default, not in module graph in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | No importer and no mention outside its defining file. |
| 5 | `apps/web/src/test/meal-fixtures.ts:emptyWeekFixture` | exports | default | proven-dead | knip exports (default); `--trace-export`: 0 importer(s) in default, not in module graph in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | No importer and no mention outside its defining file. |
| 6 | `apps/web/src/test/meal-fixtures.ts:previousWeekFixture` | exports | default | proven-dead | knip exports (default); `--trace-export`: 0 importer(s) in default, not in module graph in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | No importer and no mention outside its defining file. |
| 7 | `apps/service/src/jobs/index.ts:DISPATCH_NOTIFICATIONS_SCHEDULE` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 4 hit(s) outside the defining file(s) (0 doc, 4 test, 0 other): `apps/service/src/jobs/index.test.ts:25`, `apps/service/src/jobs/scheduler.test.ts:8`, `apps/service/src/jobs/scheduler.test.ts:74`; 4 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. |
| 8 | `apps/service/src/jobs/index.ts:PRUNE_CACHE_SCHEDULE` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 4 hit(s) outside the defining file(s) (0 doc, 4 test, 0 other): `apps/service/src/jobs/index.test.ts:26`, `apps/service/src/jobs/scheduler.test.ts:10`, `apps/service/src/jobs/scheduler.test.ts:75`; 4 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. |
| 9 | `apps/service/src/jobs/index.ts:REFRESH_DEALS_SCHEDULE` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 4 hit(s) outside the defining file(s) (0 doc, 4 test, 0 other): `apps/service/src/jobs/index.test.ts:27`, `apps/service/src/jobs/scheduler.test.ts:11`, `apps/service/src/jobs/scheduler.test.ts:72`; 4 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. |
| 10 | `apps/service/src/jobs/index.ts:autopayOccurrences` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 11 hit(s) outside the defining file(s) (0 doc, 11 test, 0 other): `apps/service/src/jobs/index.test.ts:16`, `apps/service/src/jobs/log-autopay.test.ts:2`, `apps/service/src/jobs/log-autopay.test.ts:10`; 3 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. |
| 11 | `apps/service/src/jobs/index.ts:planFlyerRefreshNotifications` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 12 hit(s) outside the defining file(s) (0 doc, 10 test, 2 other): `apps/service/src/jobs/refresh-deals.ts:12`, `apps/service/src/jobs/refresh-deals.ts:252`, `apps/service/src/jobs/index.test.ts:22`; 2 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 12 | `apps/service/src/jobs/index.ts:planRefresh` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 12 hit(s) outside the defining file(s) (0 doc, 10 test, 2 other): `apps/service/src/jobs/refresh-deals.ts:12`, `apps/service/src/jobs/refresh-deals.ts:200`, `apps/service/src/jobs/index.test.ts:23`; 3 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 13 | `apps/service/src/jobs/index.ts:pruneCache` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 4 hit(s) outside the defining file(s) (0 doc, 3 test, 1 other): `apps/service/src/jobs/scheduler.ts:145`, `apps/service/src/jobs.integration.test.ts:5`, `apps/service/src/jobs.integration.test.ts:838`; 3 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 14 | `apps/service/src/jobs/index.ts:readinessNotBuiltYet` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 13 hit(s) outside the defining file(s) (0 doc, 13 test, 0 other): `apps/service/src/dispatch-notifications.integration.test.ts:5`, `apps/service/src/dispatch-notifications.integration.test.ts:360`, `apps/service/src/jobs.integration.test.ts:7`; 2 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. |
| 15 | `apps/service/src/jobs/index.ts:runDispatchNotifications` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 11 hit(s) outside the defining file(s) (0 doc, 9 test, 2 other): `apps/service/src/jobs/scheduler.ts:5`, `apps/service/src/jobs/scheduler.ts:97`, `apps/service/src/dispatch-notifications.integration.test.ts:4`; 2 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 16 | `apps/service/src/jobs/index.ts:runLogAutopay` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 10 hit(s) outside the defining file(s) (0 doc, 8 test, 2 other): `apps/service/src/jobs/scheduler.ts:9`, `apps/service/src/jobs/scheduler.ts:93`, `apps/service/src/jobs/index.test.ts:15`; 2 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 17 | `apps/service/src/jobs/index.ts:runOnDemandRefresh` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 6 hit(s) outside the defining file(s) (0 doc, 4 test, 2 other): `apps/service/src/jobs/scheduler.ts:10`, `apps/service/src/jobs/scheduler.ts:119`, `apps/service/src/jobs.integration.test.ts:8`; 2 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 18 | `apps/service/src/jobs/index.ts:runPruneCache` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 3 hit(s) outside the defining file(s) (0 doc, 1 test, 2 other): `apps/service/src/jobs/scheduler.ts:11`, `apps/service/src/jobs/scheduler.ts:104`, `apps/service/src/jobs/index.test.ts:18`; 2 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 19 | `apps/service/src/jobs/index.ts:runRefreshDeals` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 29 hit(s) outside the defining file(s) (0 doc, 27 test, 2 other): `apps/service/src/jobs/scheduler.ts:10`, `apps/service/src/jobs/scheduler.ts:89`, `apps/service/src/jobs.integration.test.ts:9`; 2 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 20 | `apps/service/src/jobs/index.ts:withJobLock` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/jobs/index.test.ts`), 0 in production | 16 hit(s) outside the defining file(s) (1 doc, 12 test, 3 other): `apps/service/src/jobs/scheduler.ts:3`, `apps/service/src/jobs/scheduler.ts:65`, `apps/service/src/jobs/scheduler.ts:118`; 2 inside them | Barrel re-export exercised only by `jobs/index.test.ts` (namespace import); `main.ts` imports only `createScheduler`. The symbol lives in its defining module. The non-test hits are in `jobs/scheduler.ts` or `jobs/refresh-deals.ts` (direct imports of the defining modules, or same-named keys), not uses of the barrel line. |
| 21 | `apps/service/src/jobs/refresh-deals.ts:readinessNotBuiltYet` | exports | production | test-only | knip exports (production); `--trace-export`: 6 importer(s) in default (`apps/service/src/dispatch-notifications.integration.test.ts`, `apps/service/src/jobs.integration.test.ts`, `apps/service/src/jobs/scheduler-stop.test.ts`, ...), 1 in production | 13 hit(s) outside the defining file(s) (0 doc, 13 test, 0 other): `apps/service/src/dispatch-notifications.integration.test.ts:5`, `apps/service/src/dispatch-notifications.integration.test.ts:360`, `apps/service/src/jobs.integration.test.ts:7`; 2 inside them | Imported by integration and unit tests; its only production importer is the unused barrel re-export in `jobs/index.ts`. |
| 22 | `apps/service/src/recipes/ingredient-parser.ts:parseIngredientLines` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/service/src/recipes/ingredient-parser.test.ts`), 0 in production | 2 hit(s) outside the defining file(s) (0 doc, 2 test, 0 other): `apps/service/src/recipes/ingredient-parser.test.ts:2`, `apps/service/src/recipes/ingredient-parser.test.ts:50`; 1 inside them | Every importer is a test or test helper. |
| 23 | `apps/web/src/components/chores/chore-copy.ts:BANNED_GAMIFICATION_WORDS` | exports | production | test-only | knip exports (production); `--trace-export`: 2 importer(s) in default (`apps/web/src/screens/chores/chores.test.tsx`, `apps/web/src/screens/chores/errands.test.tsx`), 0 in production | 4 hit(s) outside the defining file(s) (0 doc, 4 test, 0 other): `apps/web/src/screens/chores/chores.test.tsx:9`, `apps/web/src/screens/chores/chores.test.tsx:391`, `apps/web/src/screens/chores/errands.test.tsx:8`; 1 inside them | Every importer is a test or test helper. |
| 24 | `apps/web/src/components/chores/chore-copy.ts:allChoreCopyStrings` | exports | production | test-only | knip exports (production); `--trace-export`: 2 importer(s) in default (`apps/web/src/screens/chores/chores.test.tsx`, `apps/web/src/screens/chores/errands.test.tsx`), 0 in production | 4 hit(s) outside the defining file(s) (0 doc, 4 test, 0 other): `apps/web/src/screens/chores/chores.test.tsx:14`, `apps/web/src/screens/chores/chores.test.tsx:390`, `apps/web/src/screens/chores/errands.test.tsx:12`; 1 inside them | Every importer is a test or test helper. |
| 25 | `apps/web/src/lib/push/use-push-device.tsx:PushPortProvider` | exports | production | test-only | knip exports (production); `--trace-export`: 1 importer(s) in default (`apps/web/src/test/harness.tsx`), 0 in production | 3 hit(s) outside the defining file(s) (0 doc, 3 test, 0 other): `apps/web/src/test/harness.tsx:19`, `apps/web/src/test/harness.tsx:214`, `apps/web/src/test/harness.tsx:216`; 1 inside them | Every importer is a test or test helper. |
| 26 | `scripts/test-sweep.mjs` | files | production | config-gap | knip files (production), before the fix only: reported in `before-gap-fix-production-summary.txt`; absent from `production-summary.txt` after root `entry` `test/*.mjs!` and `scripts/test-sweep.mjs!` (commit `70acd70`); never reported in default mode | referenced by root `package.json` scripts `test:sweep` and `test:sweep:integration`, `docs/testing.md` and `docs/file-map.md`: live | Phase 2 test infrastructure (from `test/deterministic-clock`); live. Config gap fixed in `knip.json` on `chore/knip-config`. |
| 27 | `test/clock-setup.mjs` | files | production | config-gap | knip files (production), before the fix only: reported in `before-gap-fix-production-summary.txt`; absent from `production-summary.txt` after root `entry` `test/*.mjs!` and `scripts/test-sweep.mjs!` (commit `70acd70`); never reported in default mode | referenced as `setupFiles` / `globalSetup` in the vitest configs of apps/web, apps/service and packages/*: live | Phase 2 test infrastructure (from `test/deterministic-clock`); live. Config gap fixed in `knip.json` on `chore/knip-config`. |
| 28 | `test/global-tz.mjs` | files | production | config-gap | knip files (production), before the fix only: reported in `before-gap-fix-production-summary.txt`; absent from `production-summary.txt` after root `entry` `test/*.mjs!` and `scripts/test-sweep.mjs!` (commit `70acd70`); never reported in default mode | referenced as `setupFiles` / `globalSetup` in the vitest configs of apps/web, apps/service and packages/*: live | Phase 2 test infrastructure (from `test/deterministic-clock`); live. Config gap fixed in `knip.json` on `chore/knip-config`. |
| 29 | `apps/service/src/deals/flipp/fixture-transport.ts:FIXTURE_NOW` | exports | production | uncertain | knip exports (production); `--trace-export`: 3 importer(s) in default (`apps/service/src/deals/flipp/flipp-deal-source.test.ts`, `apps/service/src/deals/flipp/normalized-fixtures.ts`, `apps/service/src/test/fixture-deal-source.ts`), 0 in production | 12 hit(s) outside the defining file(s) (0 doc, 8 test, 4 other): `apps/service/src/deals/flipp/normalized-fixtures.ts:5`, `apps/service/src/deals/flipp/normalized-fixtures.ts:33`, `apps/service/src/env.ts:61`; 1 inside them; config/script hits: `e2e/docker-compose.e2e.yml` | D-10 fixture mechanism (`HEARTH_FLIPP_FIXTURE_DIR`): named in comments in `env.ts` and `e2e/docker-compose.e2e.yml`; importers are tests and fixture helpers only. |
| 30 | `apps/service/src/deals/flipp/fixture-transport.ts:NORMALIZED_FIXTURE_DIR` | exports | production | uncertain | knip exports (production); `--trace-export`: 2 importer(s) in default (`apps/service/scripts/normalize-fixtures.ts`, `apps/service/src/deals/flipp/normalized-fixtures.test.ts`), 0 in production | 5 hit(s) outside the defining file(s) (0 doc, 2 test, 3 other): `apps/service/scripts/normalize-fixtures.ts:6`, `apps/service/scripts/normalize-fixtures.ts:16`, `apps/service/scripts/normalize-fixtures.ts:18`; 1 inside them | D-10 fixture mechanism: imported by the `fixtures:normalize` dev script (`apps/service/scripts/normalize-fixtures.ts`) as well as a test; a script outside the production graph. |
| 31 | `apps/service/src/deals/flipp/normalized-fixtures.ts` | files | production | uncertain | knip files (production); `--trace-file`: not in the production module graph; in default mode its exports are imported by `apps/service/scripts/normalize-fixtures.ts` and `normalized-fixtures.test.ts` | 2 hit(s) outside the defining file(s) (0 doc, 1 test, 1 other): `apps/service/scripts/normalize-fixtures.ts:5`, `apps/service/src/deals/flipp/normalized-fixtures.test.ts:4`; 0 inside them | D-10 fixture mechanism: used by the `fixtures:normalize` package script (`apps/service/scripts/normalize-fixtures.ts`) and `normalized-fixtures.test.ts`; reported in production mode only. |
| 32 | `apps/service/src/jobs/index.ts:AutopayBillRow` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 4 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 33 | `apps/service/src/jobs/index.ts:DispatchOutbox` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 13 hit(s) outside the defining file(s) (1 doc, 8 test, 4 other): `apps/service/src/jobs/scheduler.ts:6`, `apps/service/src/jobs/scheduler.ts:39`, `apps/service/src/privileged/notification-outbox.ts:5`; 4 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 34 | `apps/service/src/jobs/index.ts:DispatchOutcome` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 4 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 35 | `apps/service/src/jobs/index.ts:JobDatabase` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 21 hit(s) outside the defining file(s) (0 doc, 8 test, 13 other): `apps/service/src/jobs/log-autopay.ts:11`, `apps/service/src/jobs/log-autopay.ts:124`, `apps/service/src/jobs/prune-cache.ts:4`; 2 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 36 | `apps/service/src/jobs/index.ts:JobLogger` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 32 hit(s) outside the defining file(s) (0 doc, 21 test, 11 other): `apps/service/src/jobs/dispatch-notifications.ts:4`, `apps/service/src/jobs/dispatch-notifications.ts:87`, `apps/service/src/jobs/dispatch-notifications.ts:148`; 3 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 37 | `apps/service/src/jobs/index.ts:JobName` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 6 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 38 | `apps/service/src/jobs/index.ts:LockOutcome` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 39 | `apps/service/src/jobs/index.ts:LogAutopayOutcome` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 4 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 40 | `apps/service/src/jobs/index.ts:PruneOutcome` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 4 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 41 | `apps/service/src/jobs/index.ts:PushTransport` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 6 hit(s) outside the defining file(s) (0 doc, 0 test, 6 other): `apps/service/src/jobs/scheduler.ts:7`, `apps/service/src/jobs/scheduler.ts:39`, `apps/service/src/push/recording-transport.ts:4`; 5 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 42 | `apps/service/src/jobs/index.ts:RefreshDeps` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 7 hit(s) outside the defining file(s) (0 doc, 5 test, 2 other): `apps/service/src/jobs/scheduler.ts:10`, `apps/service/src/jobs/scheduler.ts:38`, `apps/service/src/jobs.integration.test.ts:10`; 7 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 43 | `apps/service/src/jobs/index.ts:RefreshOutcome` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 5 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 44 | `apps/service/src/jobs/index.ts:pruneCutoffs` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 3 hit(s) outside the defining file(s) (0 doc, 3 test, 0 other): `apps/service/src/jobs/prune-cache.test.ts:3`, `apps/service/src/jobs/prune-cache.test.ts:9`, `apps/service/src/jobs/prune-cache.test.ts:10`; 3 inside them | Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test. |
| 45 | `apps/web/package.json:tailwindcss` | devDependencies | default | uncertain | knip devDependencies (default); `--trace-dependency tailwindcss`: no imports found | 5 hit(s) outside the defining file(s) (0 doc, 0 test, 5 other): `apps/web/package.json:31`, `apps/web/package.json:41`, `apps/web/src/index.css:1`; 0 inside them; config/script hits: `apps/web/package.json`, `apps/web/src/index.css`, `apps/web/vite.config.ts` | Known knip limitation (02-06): `@import 'tailwindcss'` in `apps/web/src/index.css` line 1 and the `@tailwindcss/vite` plugin in `vite.config.ts` use it; CSS imports are not followed. Not dead. |
| 46 | `apps/web/src/components/bills/bills-copy.ts:BILLS_EMPTY_COPY\|BILLS_LIST_EMPTY_COPY` | duplicates | both | uncertain | knip duplicates (both); `--trace-export`: BILLS_EMPTY_COPY: 0 importer(s) in default, 0 in production; BILLS_LIST_EMPTY_COPY: 1 importer(s) in default (`apps/web/src/screens/bills/BillsIndexScreen.tsx`), 1 in production | 2 hit(s) outside the defining file(s) (0 doc, 0 test, 2 other): `apps/web/src/screens/bills/BillsIndexScreen.tsx:7`, `apps/web/src/screens/bills/BillsIndexScreen.tsx:152`; 3 inside them | Same value exported under two names (`BILLS_LIST_EMPTY_COPY = BILLS_EMPTY_COPY`, line 19). `BILLS_LIST_EMPTY_COPY` is imported by `BillsIndexScreen.tsx`; `BILLS_EMPTY_COPY` has no importer. A naming consolidation, not dead code; the owner picks the canonical name. |
| 47 | `packages/matching/scripts/fuzzy-benchmark.ts:fuse.js` | unlisted | default | uncertain | knip unlisted (default); `--trace-dependency fuse.js`: 1 import site(s) | 7 hit(s) outside the defining file(s) (0 doc, 0 test, 7 other): `eslint.config.js:24`, `packages/matching/scripts/fuzzy-benchmark.ts:4`, `packages/matching/scripts/fuzzy-benchmark.ts:10`; 0 inside them; config/script hits: `eslint.config.js` | D-10 standing list: ESLint-ignored benchmark script. `fuse.js` was removed from `package.json` by decision; the script header says it no longer runs as committed. |
| 48 | `packages/matching/src/index.ts:BRANDS` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 5 hit(s) outside the defining file(s) (0 doc, 3 test, 2 other): `packages/matching/src/normalize.ts:1`, `packages/matching/src/normalize.ts:30`, `e2e/fixtures/flipp/raw/data-27514.json:3284`; 2 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 49 | `packages/matching/src/index.ts:DESCRIPTORS` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 4 hit(s) outside the defining file(s) (0 doc, 2 test, 2 other): `packages/matching/src/normalize.ts:2`, `packages/matching/src/normalize.ts:29`, `packages/matching/src/fixtures.test.ts:5`; 2 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 50 | `packages/matching/src/index.ts:FUZZY_THRESHOLD` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 2 hit(s) outside the defining file(s) (0 doc, 2 test, 0 other): `packages/matching/src/similarity.test.ts:2`, `packages/matching/src/similarity.test.ts:43`; 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 51 | `packages/matching/src/index.ts:MatchDecision` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 6 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 52 | `packages/matching/src/index.ts:MatchResult` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 53 | `packages/matching/src/index.ts:MatchTargetKind` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 7 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 54 | `packages/matching/src/index.ts:UNITS` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 4 hit(s) outside the defining file(s) (0 doc, 0 test, 4 other): `apps/web/src/components/lists/ItemSheet.tsx:37`, `apps/web/src/components/lists/ItemSheet.tsx:149`, `packages/matching/src/normalize.ts:3`; 2 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 55 | `packages/matching/src/index.ts:normalizeTokens` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 10 hit(s) outside the defining file(s) (0 doc, 7 test, 3 other): `packages/matching/scripts/fuzzy-benchmark.ts:5`, `packages/matching/scripts/fuzzy-benchmark.ts:160`, `packages/matching/scripts/fuzzy-benchmark.ts:161`; 2 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 56 | `packages/matching/src/index.ts:singularize` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 6 hit(s) outside the defining file(s) (0 doc, 3 test, 3 other): `packages/matching/src/normalize.ts:4`, `packages/matching/src/normalize.ts:12`, `packages/matching/src/normalize.ts:101`; 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 57 | `packages/matching/src/index.ts:stripPunctuation` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 5 hit(s) outside the defining file(s) (0 doc, 5 test, 0 other): `packages/matching/src/fixtures.test.ts:6`, `packages/matching/src/fixtures.test.ts:119`, `packages/matching/src/normalize.test.ts:2`; 5 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 58 | `packages/matching/src/index.ts:tokenSimilarity` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 8 hit(s) outside the defining file(s) (0 doc, 8 test, 0 other): `packages/matching/src/similarity.test.ts:2`, `packages/matching/src/similarity.test.ts:4`, `packages/matching/src/similarity.test.ts:6`; 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 59 | `packages/matching/src/index.ts:tokenize` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 8 hit(s) outside the defining file(s) (0 doc, 5 test, 3 other): `packages/matching/src/matcher.ts:1`, `packages/matching/src/matcher.ts:54`, `packages/matching/src/matcher.ts:92`; 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 60 | `packages/matching/src/index.ts:tokensFuzzyMatch` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 7 hit(s) outside the defining file(s) (0 doc, 5 test, 2 other): `packages/matching/src/matcher.ts:2`, `packages/matching/src/matcher.ts:56`, `packages/matching/src/similarity.test.ts:2`; 2 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 61 | `packages/matching/src/normalize.ts:normalizeTokens` | exports | production | uncertain | knip exports (production); `--trace-export`: 4 importer(s) in default (`packages/matching/scripts/fuzzy-benchmark.ts`, `packages/matching/src/fixtures.test.ts`, `packages/matching/src/normalize.test.ts`, ...), 1 in production | 10 hit(s) outside the defining file(s) (0 doc, 7 test, 3 other): `packages/matching/scripts/fuzzy-benchmark.ts:5`, `packages/matching/scripts/fuzzy-benchmark.ts:160`, `packages/matching/scripts/fuzzy-benchmark.ts:161`; 2 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only. |
| 62 | `packages/recurrence/src/index.ts:BillOccurrenceState` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 63 | `packages/recurrence/src/index.ts:ChoreOccurrenceState` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 64 | `packages/recurrence/src/index.ts:RebasedRotation` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 65 | `packages/recurrence/src/index.ts:currentChoreOccurrence` | exports | production | uncertain | knip exports (production); `--trace-export`: 1 importer(s) in default (`packages/recurrence/src/index.test.ts`), 0 in production | 14 hit(s) outside the defining file(s) (0 doc, 13 test, 1 other): `apps/service/src/chores/occurrence.ts:70`, `packages/recurrence/src/chores.test.ts:2`, `packages/recurrence/src/chores.test.ts:5`; 4 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only. |
| 66 | `packages/recurrence/src/index.ts:currentTurnIndex` | exports | both | uncertain | knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production | 5 hit(s) outside the defining file(s) (0 doc, 5 test, 0 other): `packages/recurrence/src/rotation.test.ts:4`, `packages/recurrence/src/rotation.test.ts:9`, `packages/recurrence/src/rotation.test.ts:21`; 5 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 67 | `packages/recurrence/src/index.ts:rebaseRotationOnDeparture` | exports | production | uncertain | knip exports (production); `--trace-export`: 1 importer(s) in default (`packages/recurrence/src/index.test.ts`), 0 in production | 10 hit(s) outside the defining file(s) (0 doc, 10 test, 0 other): `packages/recurrence/src/index.test.ts:9`, `packages/recurrence/src/index.test.ts:39`, `packages/recurrence/src/rotation.test.ts:5`; 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only. |
| 68 | `packages/recurrence/src/rotation.ts:rebaseRotationOnDeparture` | exports | production | uncertain | knip exports (production); `--trace-export`: 3 importer(s) in default (`packages/recurrence/src/rotation.test.ts`, `packages/recurrence/src/index.ts`, `packages/recurrence/src/index.test.ts`), 1 in production | 10 hit(s) outside the defining file(s) (0 doc, 10 test, 0 other): `packages/recurrence/src/index.test.ts:9`, `packages/recurrence/src/index.test.ts:39`, `packages/recurrence/src/rotation.test.ts:5`; 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only. |
| 69 | `packages/shared/src/api/auth.ts:SessionResponse` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 70 | `packages/shared/src/api/errands.ts:ErrandStatus` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 71 | `packages/shared/src/api/households.ts:JoinHouseholdRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 72 | `packages/shared/src/api/lists.ts:CreateListRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 73 | `packages/shared/src/api/lists.ts:ListsQuery` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 74 | `packages/shared/src/api/lists.ts:UpdateListRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 75 | `packages/shared/src/api/matching.ts:MatchDecision` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 6 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 76 | `packages/shared/src/api/matching.ts:MatchTargetKind` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 7 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 77 | `packages/shared/src/api/meal-plan.ts:AddToListRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 78 | `packages/shared/src/api/meal-plan.ts:MealPlanQuery` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 79 | `packages/shared/src/api/meal-plan.ts:WeekAddToListRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 80 | `packages/shared/src/api/membership.ts:TransferAdminRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 81 | `packages/shared/src/api/notifications.ts:DeletePushSubscriptionRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 82 | `packages/shared/src/api/recipes.ts:ParseRecipeRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 83 | `packages/shared/src/api/recipes.ts:RecipesQuery` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 84 | `packages/shared/src/api/system.ts:ClientErrorRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 85 | `packages/shared/src/api/users.ts:QuietHours` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 86 | `packages/shared/src/api/users.ts:SetActiveHouseholdRequest` | types | both | uncertain | knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production | 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. |
| 87 | `packages/shared/src/scrub.ts:scrubFields` | exports | production | uncertain | knip exports (production); `--trace-export`: 1 importer(s) in default (`packages/shared/src/scrub.test.ts`), 0 in production | 6 hit(s) outside the defining file(s) (0 doc, 6 test, 0 other): `packages/shared/src/scrub.test.ts:7`, `packages/shared/src/scrub.test.ts:275`, `packages/shared/src/scrub.test.ts:278`; 1 inside them | Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only. |
| 88 | `supabase/seed/package.json:tsx` | devDependencies | default | uncertain | knip devDependencies (default); `--trace-dependency tsx`: no imports found | 742 hit(s) outside the defining file(s) (47 doc, 145 test, 550 other): `.lintstagedrc.json:2`, `apps/service/package.json:10`, `apps/service/package.json:11`; 0 inside them; config/script hits: `.lintstagedrc.json`, `apps/service/package.json`, `apps/web/vite.config.ts`, `eslint.config.js` | Launched by the `db:seed` script in `apps/service/package.json` (`tsx ../../supabase/seed/seed-users.ts`) across workspaces; script-reachable, not modelled by knip. `apps/service` declares its own `tsx` too. |
| 89 | `test/clock-setup.mjs:vitest` | unlisted | both | uncertain | knip unlisted (both); `--trace-dependency vitest`: 163 import site(s) | 198 hit(s) outside the defining file(s) (5 doc, 154 test, 39 other): `.github/workflows/ci.yml:71`, `apps/service/package.json:14`, `apps/service/package.json:15`; 0 inside them; config/script hits: `.github/workflows/ci.yml`, `apps/service/package.json`, `apps/service/tsconfig.json`, `apps/web/package.json` | New Phase 2 setup file imports `vitest` but the root `package.json` declares none; it resolves through workspace hoisting. Real declaration gap, not dead code; fixing it means a root `package.json` change (outside this plan). `test/clock-setup.mjs` itself is live (setupFiles in five vitest configs). |

Note on escaped pipes: the duplicates finding `apps/web/src/components/bills/bills-copy.ts:BILLS_EMPTY_COPY|BILLS_LIST_EMPTY_COPY` (the form the normalized summary uses) has its pipe escaped as `\|` inside its table row so the table stays valid Markdown; a parser that splits rows on every `|` sees one extra cell in that row.

## Duplication baseline (jscpd 5.4.1)

jscpd 5.4.1 was run through `pnpm dlx` from `../hearth-analysis` (the combined tree, HEAD `b144d0d`); nothing was added to `package.json`, the lockfile or the repo (no `.jscpd.json`). Raw reports: `.planning/cleanup/jscpd/{source,source-with-tests,whole-repo}/jscpd-report.json`. In the reports, file names are relative to the scanned path argument (for example `service/src/...` is `apps/service/src/...`); the tables below give repo-relative paths.

### Commands

The plan's command has a `--gitignore` flag that jscpd 5.4.1 rejects (`error: unexpected argument '--gitignore' found`, exit 2). `.gitignore` files are respected by default in this version (the opt-out is `--no-gitignore`), so the flag was dropped and nothing else changed. Output paths below are shown relative to the repo root; the runs used absolute paths into the primary checkout.

Source-only (the D-12 baseline):

```
pnpm dlx jscpd@5.4.1 apps packages e2e supabase/seed --format typescript,tsx --min-tokens 60 --min-lines 8 --ignore "**/node_modules/**,**/dist/**,**/coverage/**,**/db/types.ts,**/*.test.ts,**/*.test.tsx,**/*.spec.ts" --reporters json,console --output .planning/cleanup/jscpd/source
```

Test-inclusive (the same command with the three test-file globs removed from `--ignore`):

```
pnpm dlx jscpd@5.4.1 apps packages e2e supabase/seed --format typescript,tsx --min-tokens 60 --min-lines 8 --ignore "**/node_modules/**,**/dist/**,**/coverage/**,**/db/types.ts" --reporters json,console --output .planning/cleanup/jscpd/source-with-tests
```

Whole-repo (informational, different thresholds, not a baseline for either line below):

```
pnpm dlx jscpd@5.4.1 apps packages e2e supabase/seed .github scripts docker --min-tokens 50 --min-lines 6 --ignore "**/node_modules/**,**/dist/**,**/coverage/**,**/db/types.ts,e2e/fixtures/**" --reporters json,console --output .planning/cleanup/jscpd/whole-repo
```

### Totals (`statistics.total`)

| Scan | Sources | Clones | Duplicated lines | Lines | Duplicated lines % |
| --- | --- | --- | --- | --- | --- |
| source-only | 347 | 11 | 190 | 40801 | 0.47% |
| test-inclusive | 521 | 96 | 1438 | 77020 | 1.87% |
| whole-repo | 552 | 174 | 2146 | 80356 | 2.67% |

### Source-only clones (11)

| File A (lines) | File B (lines) | Lines |
| --- | --- | --- |
| `apps/service/src/services/matching-candidates.ts` 72-88 | `supabase/seed/compute-readiness.ts` 86-101 | 17 |
| `apps/web/src/screens/bills/BillDetailScreen.tsx` 223-239 | `apps/web/src/screens/meals/RecipeDetailScreen.tsx` 142-158 | 17 |
| `apps/web/src/screens/chores/ChoreDetailScreen.tsx` 68-85 | `apps/web/src/screens/chores/ChoreFormScreen.tsx` 107-124 | 18 |
| `apps/web/src/screens/lists/ListDetailScreen.tsx` 183-198 | `apps/web/src/screens/lists/PantryScreen.tsx` 193-207 | 16 |
| `apps/web/src/screens/lists/ListDetailScreen.tsx` 427-452 | `apps/web/src/screens/lists/PantryScreen.tsx` 283-308 | 26 |
| `apps/web/src/screens/onboarding/CreateHouseholdStep.tsx` 27-41 | `apps/web/src/screens/settings/HouseholdSettingsSection.tsx` 46-60 | 15 |
| `apps/web/src/screens/onboarding/SetPasswordScreen.tsx` 94-105 | `apps/web/src/screens/onboarding/SignUpScreen.tsx` 105-116 | 12 |
| `apps/web/src/screens/onboarding/SignInScreen.tsx` 63-79 | `apps/web/src/screens/onboarding/SignUpScreen.tsx` 89-105 | 17 |
| `apps/web/src/screens/onboarding/SignInScreen.tsx` 80-91 | `apps/web/src/screens/onboarding/SignUpScreen.tsx` 107-118 | 12 |
| `apps/web/src/screens/settings/account/ChangeEmailForm.tsx` 26-44 | `apps/web/src/screens/settings/account/ChangePasswordForm.tsx` 25-43 | 19 |
| `packages/matching/vitest.config.ts` 1-21 | `packages/shared/vitest.config.ts` 1-21 | 21 |

### Test-involved clones in the test-inclusive scan (85 of 96)

A clone is test-involved when at least one side's path contains `.test.`, `.spec.` or `/src/test/`, or starts with `e2e/`. The 11 other clones of that scan are exactly the 11 source-only clones (same file pairs and line ranges, checked).

| File A (lines) | File B (lines) | Lines |
| --- | --- | --- |
| `apps/service/src/api.integration.test.ts` 28-57 | `apps/service/src/chores.integration.test.ts` 11-40 | 30 |
| `apps/service/src/api.integration.test.ts` 29-57 | `apps/service/src/meal-plan.integration.test.ts` 17-46 | 29 |
| `apps/service/src/api.integration.test.ts` 32-57 | `apps/service/src/bills.integration.test.ts` 22-54 | 26 |
| `apps/service/src/api.integration.test.ts` 32-53 | `apps/service/src/lists.integration.test.ts` 21-42 | 22 |
| `apps/service/src/api.integration.test.ts` 32-60 | `apps/service/src/notifications.integration.test.ts` 20-41 | 29 |
| `apps/service/src/api.integration.test.ts` 39-57 | `apps/service/src/match-overrides.integration.test.ts` 21-38 | 19 |
| `apps/service/src/bills.integration.test.ts` 567-578 | `apps/service/src/bills.integration.test.ts` 653-660 | 12 |
| `apps/service/src/chores.integration.test.ts` 7-40 | `apps/service/src/errands.integration.test.ts` 6-38 | 34 |
| `apps/service/src/chores.integration.test.ts` 56-67 | `apps/service/src/errands.integration.test.ts` 45-54 | 12 |
| `apps/service/src/chores.integration.test.ts` 149-159 | `apps/service/src/chores.integration.test.ts` 264-274 | 11 |
| `apps/service/src/chores.integration.test.ts` 149-159 | `apps/service/src/chores.integration.test.ts` 486-496 | 11 |
| `apps/service/src/chores.integration.test.ts` 149-158 | `apps/service/src/chores.integration.test.ts` 509-518 | 10 |
| `apps/service/src/chores.integration.test.ts` 149-159 | `apps/service/src/chores.integration.test.ts` 552-562 | 11 |
| `apps/service/src/chores.integration.test.ts` 149-159 | `apps/service/src/chores.integration.test.ts` 573-583 | 11 |
| `apps/service/src/chores.integration.test.ts` 149-159 | `apps/service/src/chores.integration.test.ts` 597-607 | 11 |
| `apps/service/src/chores.integration.test.ts` 267-276 | `apps/service/src/chores.integration.test.ts` 489-497 | 10 |
| `apps/service/src/chores.integration.test.ts` 267-276 | `apps/service/src/chores.integration.test.ts` 555-563 | 10 |
| `apps/service/src/chores.integration.test.ts` 267-276 | `apps/service/src/chores.integration.test.ts` 576-584 | 10 |
| `apps/service/src/chores.integration.test.ts` 344-354 | `apps/service/src/chores.integration.test.ts` 530-540 | 11 |
| `apps/service/src/chores.integration.test.ts` 344-358 | `apps/service/src/chores.integration.test.ts` 727-740 | 15 |
| `apps/service/src/chores.integration.test.ts` 346-358 | `apps/service/src/chores.integration.test.ts` 511-520 | 13 |
| `apps/service/src/chores.integration.test.ts` 489-500 | `apps/service/src/chores.integration.test.ts` 555-566 | 12 |
| `apps/service/src/chores.integration.test.ts` 489-500 | `apps/service/src/chores.integration.test.ts` 576-587 | 12 |
| `apps/service/src/deals.integration.test.ts` 386-399 | `apps/service/src/deals.integration.test.ts` 444-456 | 14 |
| `apps/service/src/dispatch-notifications.integration.test.ts` 36-55 | `apps/service/src/jobs.integration.test.ts` 49-68 | 20 |
| `apps/service/src/dispatch-notifications.integration.test.ts` 36-47 | `apps/service/src/jobs/scheduler.test.ts` 25-36 | 12 |
| `apps/service/src/dispatch-notifications.integration.test.ts` 37-46 | `apps/service/src/jobs/dispatch-notifications.test.ts` 110-119 | 10 |
| `apps/service/src/jobs.integration.test.ts` 497-505 | `apps/service/src/jobs.integration.test.ts` 517-525 | 9 |
| `apps/service/src/jobs.integration.test.ts` 525-543 | `apps/service/src/jobs.integration.test.ts` 550-567 | 19 |
| `apps/service/src/jobs.integration.test.ts` 531-545 | `apps/service/src/jobs.integration.test.ts` 639-651 | 15 |
| `apps/service/src/jobs.integration.test.ts` 532-543 | `apps/service/src/jobs.integration.test.ts` 580-589 | 12 |
| `apps/service/src/jobs.integration.test.ts` 533-545 | `apps/service/src/jobs.integration.test.ts` 609-619 | 13 |
| `apps/service/src/jobs.integration.test.ts` 611-619 | `apps/service/src/jobs.integration.test.ts` 643-651 | 9 |
| `apps/service/src/jobs.integration.test.ts` 712-724 | `apps/service/src/jobs.integration.test.ts` 772-784 | 13 |
| `apps/service/src/jobs.integration.test.ts` 742-753 | `apps/service/src/jobs.integration.test.ts` 768-779 | 12 |
| `apps/service/src/jobs/scheduler.test.ts` 140-150 | `apps/service/src/jobs/scheduler.test.ts` 166-176 | 11 |
| `apps/service/src/lists.integration.test.ts` 19-42 | `apps/service/src/match-overrides.integration.test.ts` 10-34 | 24 |
| `apps/service/src/lists.integration.test.ts` 89-100 | `apps/service/src/meal-plan.integration.test.ts` 119-132 | 12 |
| `apps/service/src/match-overrides.integration.test.ts` 29-42 | `apps/service/src/meal-plan.integration.test.ts` 37-50 | 14 |
| `apps/service/src/meal-plan.integration.test.ts` 42-60 | `apps/service/src/readiness.integration.test.ts` 54-72 | 19 |
| `apps/service/src/notification-producers.integration.test.ts` 518-526 | `apps/service/src/notification-producers.integration.test.ts` 582-590 | 9 |
| `apps/web/src/App.test.tsx` 48-57 | `apps/web/src/screens/settings/settings.test.tsx` 37-46 | 10 |
| `apps/web/src/lib/offline/write-queue.test.tsx` 67-76 | `apps/web/src/screens/bills/bill-detail.test.tsx` 35-44 | 10 |
| `apps/web/src/lib/offline/write-queue.test.tsx` 67-79 | `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 43-54 | 13 |
| `apps/web/src/lib/offline/write-queue.test.tsx` 67-76 | `apps/web/src/screens/lists/lists.test.tsx` 86-96 | 10 |
| `apps/web/src/lib/offline/write-queue.test.tsx` 68-79 | `apps/web/src/screens/meals/planner.test.tsx` 99-109 | 12 |
| `apps/web/src/lib/offline/write-queue.test.tsx` 396-404 | `apps/web/src/lib/offline/write-queue.test.tsx` 533-541 | 9 |
| `apps/web/src/lib/offline/write-queue.test.tsx` 484-499 | `apps/web/src/lib/offline/write-queue.test.tsx` 548-563 | 16 |
| `apps/web/src/lib/realtime/supabase-realtime.test.ts` 111-120 | `apps/web/src/lib/realtime/supabase-realtime.test.ts` 131-140 | 10 |
| `apps/web/src/screens/bills/bill-detail.test.tsx` 34-71 | `apps/web/src/screens/bills/bills-index.test.tsx` 38-75 | 38 |
| `apps/web/src/screens/bills/bill-detail.test.tsx` 34-59 | `apps/web/src/screens/meals/recipe-detail.test.tsx` 53-78 | 26 |
| `apps/web/src/screens/bills/bill-detail.test.tsx` 36-47 | `apps/web/src/screens/lists/lists.test.tsx` 87-99 | 12 |
| `apps/web/src/screens/bills/bill-detail.test.tsx` 43-55 | `apps/web/src/screens/deals/deal-search.test.tsx` 71-84 | 13 |
| `apps/web/src/screens/bills/bill-detail.test.tsx` 47-57 | `apps/web/src/screens/chores/chores.test.tsx` 160-170 | 11 |
| `apps/web/src/screens/bills/bills-index.test.tsx` 38-51 | `apps/web/src/screens/bills/subscriptions.test.tsx` 36-49 | 14 |
| `apps/web/src/screens/bills/bills-index.test.tsx` 38-48 | `apps/web/src/screens/meals/planner.test.tsx` 97-107 | 11 |
| `apps/web/src/screens/bills/bills-index.test.tsx` 38-63 | `apps/web/src/screens/meals/recipe-library.test.tsx` 40-66 | 26 |
| `apps/web/src/screens/bills/bills-index.test.tsx` 153-161 | `apps/web/src/screens/bills/subscriptions.test.tsx` 99-108 | 9 |
| `apps/web/src/screens/bills/bills-index.test.tsx` 153-161 | `apps/web/src/screens/lists/lists.test.tsx` 132-140 | 9 |
| `apps/web/src/screens/bills/bills-index.test.tsx` 153-161 | `apps/web/src/screens/meals/recipe-library.test.tsx` 115-123 | 9 |
| `apps/web/src/screens/bills/household-timezone.test.tsx` 59-74 | `apps/web/src/screens/chores/household-timezone.test.tsx` 55-70 | 16 |
| `apps/web/src/screens/bills/household-timezone.test.tsx` 59-74 | `apps/web/src/screens/household-timezone.test.tsx` 103-118 | 16 |
| `apps/web/src/screens/bills/subscriptions.test.tsx` 41-58 | `apps/web/src/screens/lists/lists.test.tsx` 91-108 | 18 |
| `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 39-54 | `apps/web/src/screens/chores/errands-offline-queue.test.tsx` 33-48 | 16 |
| `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 46-54 | `apps/web/src/screens/chores/chores.test.tsx` 66-74 | 9 |
| `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 54-62 | `apps/web/src/screens/chores/errands-offline-queue.test.tsx` 48-56 | 9 |
| `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 87-104 | `apps/web/src/screens/chores/errands-offline-queue.test.tsx` 83-99 | 18 |
| `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 105-113 | `apps/web/src/screens/chores/chores-offline-queue.test.tsx` 144-151 | 9 |
| `apps/web/src/screens/chores/chores.test.tsx` 64-74 | `apps/web/src/screens/chores/errands.test.tsx` 39-54 | 11 |
| `apps/web/src/screens/chores/chores.test.tsx` 153-175 | `apps/web/src/screens/chores/errands.test.tsx` 90-111 | 23 |
| `apps/web/src/screens/chores/chores.test.tsx` 388-397 | `apps/web/src/screens/chores/errands.test.tsx` 351-360 | 10 |
| `apps/web/src/screens/deals/deal-card.test.tsx` 15-29 | `apps/web/src/screens/onboarding/onboarding.test.tsx` 31-45 | 15 |
| `apps/web/src/screens/deals/deal-search.test.tsx` 21-37 | `apps/web/src/screens/deals/favorites.test.tsx` 19-35 | 17 |
| `apps/web/src/screens/deals/deal-search.test.tsx` 21-37 | `apps/web/src/screens/deals/flyers.test.tsx` 23-39 | 17 |
| `apps/web/src/screens/deals/deal-search.test.tsx` 21-37 | `apps/web/src/screens/meals/suggestions.test.tsx` 15-31 | 17 |
| `apps/web/src/screens/deals/deal-search.test.tsx` 75-89 | `apps/web/src/screens/deals/flyers.test.tsx` 54-67 | 15 |
| `apps/web/src/screens/deals/favorites.test.tsx` 26-41 | `apps/web/src/screens/deals/flyers.test.tsx` 30-45 | 16 |
| `apps/web/src/screens/deals/favorites.test.tsx` 26-37 | `apps/web/src/screens/meals/suggestions.test.tsx` 22-33 | 12 |
| `apps/web/src/screens/lists/lists.test.tsx` 228-236 | `apps/web/src/screens/lists/lists.test.tsx` 262-270 | 9 |
| `apps/web/src/screens/meals/household-timezone.test.tsx` 103-119 | `apps/web/src/screens/meals/recipe-detail.test.tsx` 26-42 | 17 |
| `apps/web/src/screens/meals/planner.test.tsx` 214-223 | `apps/web/src/screens/meals/planner.test.tsx` 234-243 | 10 |
| `apps/web/src/screens/meals/recipe-detail.test.tsx` 67-80 | `apps/web/src/screens/meals/recipe-library.test.tsx` 55-68 | 14 |
| `apps/web/src/screens/meals/recipe-library.test.tsx` 156-179 | `apps/web/src/screens/meals/recipe-library.test.tsx` 193-216 | 24 |
| `apps/web/src/screens/onboarding/onboarding.test.tsx` 244-253 | `apps/web/src/screens/onboarding/onboarding.test.tsx` 262-271 | 10 |
| `packages/matching/scripts/fuzzy-benchmark.ts` 30-43 | `packages/matching/src/fixtures.test.ts` 134-147 | 14 |

### Whole-repo scan: ten files with the most clones

| File (most clones first) | Clones |
| --- | --- |
| `apps/service/src/chores.integration.test.ts` | 22 |
| `apps/web/src/screens/bills/bills-index.test.tsx` | 11 |
| `apps/service/src/jobs.integration.test.ts` | 10 |
| `apps/web/src/lib/offline/write-queue.test.tsx` | 9 |
| `apps/web/src/screens/chores/chores.test.tsx` | 9 |
| `apps/service/src/deals.integration.test.ts` | 8 |
| `apps/service/src/api.integration.test.ts` | 7 |
| `apps/web/src/screens/bills/bill-detail.test.tsx` | 7 |
| `apps/service/src/lists.integration.test.ts` | 6 |
| `apps/service/src/meal-plan.integration.test.ts` | 6 |

### Baseline lines

Phase 5 (RED-03) baseline: source-only clones = 11, duplicated lines = 0.47%
Phase 5 (RED-03) test-inclusive baseline: clones = 96, test-involved clones = 85, duplicated lines = 1.87%

Scope note for the owner: D-12 records the source-only figure as the RED-03 baseline, while RED-03 and ROADMAP Phase 5 criterion 3 measure duplicated test fixtures, which the source-only scan leaves out by design (it ignores every `*.test.ts`, `*.test.tsx` and `*.spec.ts` file). Both figures are recorded at identical thresholds (60 tokens, 8 lines), so Phase 5 can re-run either command unchanged. Which figure Phase 5 compares against is the owner's decision, and D-12 itself is unchanged.

Research (STACK.md, at `224b93b`) measured 11 clones and 0.46%. This scan finds the same 11 clones at 0.47% (190 of 40,801 lines; the unrounded value is 0.4657%). The cause of the 0.01 point difference was not isolated; Phase 2 added source files (for example `apps/service/src/test/zone-dates.ts` and `e2e/support/clock.ts`, which the source-only ignore list does not exclude), and the research figure may have been truncated rather than rounded. The clone list was not compared pair by pair with the research list.
