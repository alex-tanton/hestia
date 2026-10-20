Nothing listed here is deleted without the owner's decision (DEAD-06). This file lives only in `.planning/`; it is not a spec and never goes into `docs/`.

Source: refreshed in Phase 3 on `final=9819e7c1436a8ad984f459c9fcb3e62fa68e0806` (`origin/main` after the owner's squash merges of PR 1 #12, PR 2 #13 and PR 3 #14), from the final knip summaries `.planning/cleanup/knip/phase3-after-{default,production,nonode}-summary.txt` (default 1 finding, production 28, `node`-plugin-off 1) and from the Kept section of `.planning/cleanup/REMOVAL-LEDGER.md`. Everything Phase 3 removed, with its three-part proof, is in the ledger and in the closing section `## Removed in Phase 3`. What remains below is what tooling could not prove dead, with the evidence and a question for each, followed by the standing-list items from decision D-10.

## Uncertain

**Findings from the knip reports (final tree)**

### `apps/service/src/deals/flipp/fixture-transport.ts:FIXTURE_NOW`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: D-10 fixture mechanism (`HEARTH_FLIPP_FIXTURE_DIR`): named in comments in `env.ts` and `e2e/docker-compose.e2e.yml`; importers are tests and fixture helpers only.
- Evidence: still reported in the final production summary. `--trace-export` on `9819e7c`: 3 importers in default (`apps/service/src/test/fixture-deal-source.ts`, `apps/service/src/deals/flipp/flipp-deal-source.test.ts`, `apps/service/src/deals/flipp/normalized-fixtures.ts`), 0 in production. Phase 2 text search: 12 hits outside the defining file (0 doc, 8 test, 4 other); config/script hits: `e2e/docker-compose.e2e.yml`.
- Question: Is this part of the fixture workflow you want kept (keep), or may it go?

### `apps/service/src/deals/flipp/fixture-transport.ts:NORMALIZED_FIXTURE_DIR`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: D-10 fixture mechanism: imported by the `fixtures:normalize` dev script (`apps/service/scripts/normalize-fixtures.ts`) as well as a test; a script outside the production graph.
- Evidence: still reported in the final production summary. Importers in default (Phase 2 trace): `apps/service/scripts/normalize-fixtures.ts`, `apps/service/src/deals/flipp/normalized-fixtures.test.ts`; 0 in production. Phase 2 text search: 5 hits outside the defining file (0 doc, 2 test, 3 other).
- Question: Is this part of the fixture workflow you want kept (keep), or may it go?

### `apps/service/src/deals/flipp/normalized-fixtures.ts`

- What: files, reported by knip in production mode.
- Why tooling cannot settle it: D-10 fixture mechanism: used by the `fixtures:normalize` package script (`apps/service/scripts/normalize-fixtures.ts`) and `normalized-fixtures.test.ts`; reported in production mode only. Phase 3 kept it (D-04): `knip --trace-file` shows `buildNormalizedFixtures` and `serializeFixture` imported by that script and that test.
- Evidence: the final production summary has this `files` line; the final default summary has no `files` line at all. In default mode its exports are imported by `apps/service/scripts/normalize-fixtures.ts` and `normalized-fixtures.test.ts`.
- Question: Is this part of the fixture workflow you want kept (keep), or may it go?

### `scripts/knip-summary.mjs`

- What: files, reported by knip in production mode since PR 1.
- Why tooling cannot settle it: Not dead. It is the report normalizer behind the root script `knip:summary` and has a row in `docs/file-map.md`. Production mode does not treat a `package.json` script reference as an entry (`scripts/test-sweep.mjs` is a `!`-marked entry in `knip.json`; this file is not). The owner decided `knip-summary=keep-reported` (2026-10-19): leave the line reported instead of adding `scripts/knip-summary.mjs!` to `knip.json`, because D-08 keeps `knip.json` unchanged in Phase 3.
- Evidence: ledger Kept row and Tooling section. `knip:production` on `9819e7c` reports `files	scripts/knip-summary.mjs	-`; default and `node`-plugin-off runs do not. Because of this line the final production summary has two `files` lines, not one.
- Question: Add a `scripts/knip-summary.mjs!` entry to `knip.json` together with Phase 6's blocking knip check (CI-01), or keep it reported?

### `apps/web/package.json:tailwindcss`

- What: devDependencies, reported by knip in default mode.
- Why tooling cannot settle it: Known knip limitation (02-06): `@import 'tailwindcss'` in `apps/web/src/index.css` line 1 and the `@tailwindcss/vite` plugin in `vite.config.ts` use it; CSS imports are not followed. Not dead (D-04).
- Evidence: the one finding left in the final default and `node`-plugin-off summaries (total 1 each). `--trace-dependency tailwindcss`: no imports found. Text search: hits in `apps/web/package.json`, `apps/web/src/index.css` and `apps/web/vite.config.ts`.
- Question: Confirm `tailwindcss` stays (it is used by the CSS import).

### `packages/matching/src/normalize.ts:normalizeTokens`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). Used by tests only (D-01 keeps test-only exports). The barrel re-export in `packages/matching/src/index.ts` was removed in PR 2; this defining-module export stays.
- Evidence: `--trace-export` on `9819e7c`: 2 importers in default (`packages/matching/src/fixtures.test.ts`, `packages/matching/src/normalize.test.ts`), 0 in production. The benchmark script that also imported it is gone.
- Question: Keep (test-only), move under `src/test/`, or delete together with the tests that use it?

### `packages/recurrence/src/index.ts:currentChoreOccurrence`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). Used by tests only; `packages/recurrence/src/index.test.ts` asserts the barrel exposes it, so PR 2 left it.
- Evidence: `--trace-export` on `9819e7c`: 1 importer in default (`packages/recurrence/src/index.test.ts`), 0 in production.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the export be removed?

### `packages/recurrence/src/index.ts:rebaseRotationOnDeparture`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). Used by tests only; `packages/recurrence/src/index.test.ts` asserts the barrel exposes it, so PR 2 left it.
- Evidence: `--trace-export` on `9819e7c`: 1 importer in default (`packages/recurrence/src/index.test.ts`), 0 in production.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the export be removed?

### `packages/recurrence/src/rotation.ts:rebaseRotationOnDeparture`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). Used by tests only.
- Evidence: `--trace-export` on `9819e7c`: `packages/recurrence/src/rotation.test.ts` imports it, and so does the barrel `index.ts`, whose own importer is `index.test.ts`; 0 in production.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the export be removed?

### `packages/shared/src/scrub.ts:scrubFields`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). Used by tests only.
- Evidence: `--trace-export` on `9819e7c`: 1 importer in default (`packages/shared/src/scrub.test.ts`), 0 in production.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the export be removed?

### Exports under any `test/` directory are invisible to the committed knip config

- What: a class of blind spot, not a single item.
- Why tooling cannot settle it: The `node` knip plugin adds the entry pattern `**/test/**/*.{cjs,mjs,js,cts,mts,ts}` because root `test:harness` runs `node --test`. Every file under a `test/` directory therefore counts as an entry file, and its exports are never reported (`No export ... found` from `--trace-export`). In Phase 3 this hid the three meal-plan week fixtures in `apps/web/src/test/meal-fixtures.ts` and the cascade behind them; they were found only with a throwaway config that turns the `node` plugin off (D-08). That config was never committed and `knip.json` is unchanged.
- Evidence: ledger sections "Tooling" and "Null results and re-checks" (D-08 hidden entry): the throwaway config reported 57 findings on the base against 54 for the committed one, the three extra lines being the week fixtures. On `9819e7c` both configs report exactly `tailwindcss`.
- Question: Should Phase 6 (CI-01, the blocking knip check) narrow the `node` plugin's `**/test/**` pattern in `knip.json` so test-directory exports are checked, or keep the current config and accept the blind spot?

**Standing list (decision D-10)**

These stay out of every removal list. Most are not reported by knip at all.

### `apps/service/src/push/web-push.d.ts`

- Why tooling cannot settle it: Ambient `declare module 'web-push'` types, because the package ships none. No import references it; TypeScript picks it up through the service `tsconfig` include. Deleting it would break typecheck, not knip.
- Question: No question unless you want the declarations replaced with a typed package; otherwise keep.

### `apps/service/src/db/types.ts`

- Why tooling cannot settle it: Generated by `pnpm db:types` (kysely-codegen) and committed. Imported by `apps/service/src/db.ts`; also named in `apps/service/package.json`, the vitest configs and the repo rules. Regenerate, never delete or hand-edit.
- Evidence: a local Docker run (owner-authorized, recorded in the ledger as `dbtypes-*`) generated it twice from the migrated schema and both outputs were byte-identical to the committed file. Migrations and this file are unchanged on `main` since that run.
- Question: Keep (regenerate only).

### `docker/*` (`Caddyfile`, `caddy-entrypoint.sh`, `caddy.Dockerfile`, `db/`, `docker-compose.yml`, `kong-entrypoint.sh`, `kong.yml`, `service.Dockerfile`)

- Why tooling cannot settle it: Deployment files reached by Compose, Docker builds and `scripts/deploy.sh`, not by any import. Phase rule 5 forbids editing them in this phase.
- Question: Keep. Name any file here you believe is leftover.

### `scripts/deploy.sh`, `scripts/generate-secrets.sh`

- Why tooling cannot settle it: Shell scripts run by the deploy workflow and by an operator, not through `package.json` scripts or imports.
- Question: Keep. Name any step you believe is leftover.

### `supabase/migrations/*.sql` (8 files)

- Why tooling cannot settle it: Applied in filename order by `supabase db reset`, `supabase start` and `scripts/deploy.sh`. A migration is history; removing or rewriting one breaks existing databases.
- Evidence: `git diff` of `supabase/migrations` between the Phase 3 base and `9819e7c` is empty.
- Question: Keep (never removed by a cleanup).

### `e2e/fixtures/flipp/` (`raw/`, `normalized/`), reached through `HEARTH_FLIPP_FIXTURE_DIR`

- Why tooling cannot settle it: The Flipp fixture transport reads these by a path the E2E Compose overlay supplies in an environment variable (`apps/service/src/main.ts`, `env.ts`, `e2e/docker-compose.e2e.yml`). The path is built at runtime, so no import or static reference shows it. The `fixtures:normalize` script writes the `normalized/` set.
- Evidence: the ten largest tracked files are Flipp raw captures from this folder (ledger, Leftovers audit); the E2E suite on PR 3's CI passed with them.
- Question: Keep the whole set; confirm no capture is stale.

### `e2e/fixtures/recipes/` and `apps/service/src/recipes/fixtures/`, reached through `HEARTH_RECIPE_FIXTURE_DIR`

- Why tooling cannot settle it: Same mechanism for the recipe fetch step (`apps/service/src/recipes/fixture-fetch.ts`).
- Question: Keep; confirm both folders are still needed.

### `e2e/fixtures/` (`e2e-seed.sql` and the two folders above)

- Why tooling cannot settle it: `e2e-seed.sql` is loaded by `e2e/setup/stack.ts` through psql, not by an import; the folders are env-var paths.
- Question: Keep.

### `workbox-*` devDependencies of `apps/web` (`workbox-cacheable-response`, `-expiration`, `-precaching`, `-routing`, `-strategies`, `-window`)

- Why tooling cannot settle it: Pulled in by `vite-plugin-pwa` `injectManifest` and imported by `src/sw.ts`, which is built as a service worker, not a normal entry. knip is configured with `sw.ts!` as an entry and does not report them today, but a config change could.
- Question: Keep (the service worker imports them).

### the `esbuild` override (`pnpm.overrides` `esbuild: 0.28.2` in the root `package.json`) and `onlyBuiltDependencies: [esbuild]`

- Why tooling cannot settle it: A resolution pin, not a dependency edge; no code references it. Removing it changes the lockfile.
- Question: Keep unless you want the override re-evaluated against current Vite and tsup.

## Test-only

Reported by `knip --production` only (final production summary): no production code uses them, tests do. D-01 and D-04 keep them. Options per row: keep, move under `src/test/`, or delete (the tests that use it go with it).

| Item | Used by (test files) | Question |
| --- | --- | --- |
| `apps/service/src/jobs/index.ts:DISPATCH_NOTIFICATIONS_SCHEDULE` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs/scheduler.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:PRUNE_CACHE_SCHEDULE` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs/scheduler.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:REFRESH_DEALS_SCHEDULE` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs/scheduler.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:autopayOccurrences` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs/log-autopay.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:planFlyerRefreshNotifications` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs/refresh-plan.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:planRefresh` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs/refresh-plan.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:pruneCache` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs.integration.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:readinessNotBuiltYet` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/dispatch-notifications.integration.test.ts`, `apps/service/src/jobs.integration.test.ts`, `apps/service/src/jobs/scheduler-stop.test.ts` (+1 more) | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:runDispatchNotifications` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/dispatch-notifications.integration.test.ts`, `apps/service/src/jobs/dispatch-notifications.test.ts`, `apps/service/src/notification-producers.integration.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:runLogAutopay` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/log-autopay.integration.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:runOnDemandRefresh` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs.integration.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:runPruneCache` | `apps/service/src/jobs/index.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:runRefreshDeals` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs.integration.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/index.ts:withJobLock` | `apps/service/src/jobs/index.test.ts`, `apps/service/src/jobs.integration.test.ts`, `apps/service/src/jobs/advisory-lock.test.ts`, `apps/service/src/jobs/scheduler-stop.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/service/src/jobs/refresh-deals.ts:readinessNotBuiltYet` | `apps/service/src/dispatch-notifications.integration.test.ts`, `apps/service/src/jobs.integration.test.ts`, `apps/service/src/jobs/scheduler-stop.test.ts`, `apps/service/src/jobs/scheduler.test.ts` (+1 more) | Keep, move under `src/test/`, or delete? |
| `apps/service/src/recipes/ingredient-parser.ts:parseIngredientLines` | `apps/service/src/recipes/ingredient-parser.test.ts` | Keep, move under `src/test/`, or delete? |
| `apps/web/src/components/chores/chore-copy.ts:BANNED_GAMIFICATION_WORDS` | `apps/web/src/screens/chores/chores.test.tsx`, `apps/web/src/screens/chores/errands.test.tsx` | Keep, move under `src/test/`, or delete? |
| `apps/web/src/components/chores/chore-copy.ts:allChoreCopyStrings` | `apps/web/src/screens/chores/chores.test.tsx`, `apps/web/src/screens/chores/errands.test.tsx` | Keep, move under `src/test/`, or delete? |
| `apps/web/src/lib/push/use-push-device.tsx:PushPortProvider` | `apps/web/src/test/harness.tsx` | Keep, move under `src/test/`, or delete? |

## Notes for the owner

- `BUILD_PROMPT.md` was never tracked. With the `.prettierignore` entry gone (PR 3), an untracked local copy in your checkout would now be checked by `pnpm format:check`; move it out of the checkout or ignore it locally. CI is unaffected.
- Phase 5 (RED-05) owns the codebase-map files under `.planning/codebase/` that still name removed barrel entries (ledger, Stale-reference sweep, `orphan-docs:`); nothing was edited there.
- Observation for Phase 5 (RED-04): `apps/service/vitest.coverage.config.ts` line 40 cites a build-process label, `test/service-coverage-and-fixtures`, that names no file in the repository.

## Removed in Phase 3

The 64 items below were removed after the three-part proof and are merged on `main` (PR 1 `51c077e`, PR 2 `aefe63a`, PR 3 `9819e7c`). Nothing here is a question; the proof for each row is in `.planning/cleanup/REMOVAL-LEDGER.md`, Removals section. Groups: dependencies (PR 1), A to F4 (PR 2: web exports, bills alias, meal fixtures and their cascade, jobs barrel, matching and recurrence barrels, shared type aliases), REF (PR 3: stale ignore-file entries).

| # | Item | Kind | Group | PR |
| --- | --- | --- | --- | --- |
| 1 | `supabase/seed/package.json:tsx` | devDependency | dependencies (PR 1) | PR 1 (#12) |
| 2 | `apps/web/src/lib/offline/write-queue.ts:listIdOfWrite` | export (function) | A | PR 2 (#13) |
| 3 | `apps/web/src/components/chores/chore-copy.ts:ChoreLike` | export (type) | A | PR 2 (#13) |
| 4 | `apps/web/src/lib/api/deals.ts:useFavoriteStores` | export (function) | A | PR 2 (#13) |
| 5 | `apps/web/src/components/bills/bills-copy.ts:BILLS_EMPTY_COPY` | export (const alias) | D | PR 2 (#13) |
| 6 | `apps/web/src/test/meal-fixtures.ts:currentWeekFixture` | export (const) | B | PR 2 (#13) |
| 7 | `apps/web/src/test/meal-fixtures.ts:previousWeekFixture` | export (const) | B | PR 2 (#13) |
| 8 | `apps/web/src/test/meal-fixtures.ts:emptyWeekFixture` | export (const) | B | PR 2 (#13) |
| 9 | `apps/web/src/test/meal-fixtures.ts:deletedRecipeEntry` | export (const) | C | PR 2 (#13) |
| 10 | `apps/web/src/test/meal-fixtures.ts:wednesdayZitiEntry` | export (const) | C | PR 2 (#13) |
| 11 | `apps/web/src/test/meal-fixtures.ts:wednesdaySaladEntry` | export (const) | C | PR 2 (#13) |
| 12 | `apps/web/src/test/meal-fixtures.ts:CURRENT_WEEK_SUNDAY` | export (const) | A8 | PR 2 (#13) |
| 13 | `apps/web/src/test/meal-fixtures.ts:PREVIOUS_WEEK_SUNDAY` | export (const) | A8 | PR 2 (#13) |
| 14 | `apps/web/src/test/meal-fixtures.ts:GREEK_SALAD_ID` | export (const) | A8 | PR 2 (#13) |
| 15 | `apps/service/src/jobs/index.ts:LockOutcome` | export (type, barrel re-export) | E | PR 2 (#13) |
| 16 | `apps/service/src/jobs/index.ts:DispatchOutbox` | export (type, barrel re-export) | E | PR 2 (#13) |
| 17 | `apps/service/src/jobs/index.ts:DispatchOutcome` | export (type, barrel re-export) | E | PR 2 (#13) |
| 18 | `apps/service/src/jobs/index.ts:PushTransport` | export (type, barrel re-export) | E | PR 2 (#13) |
| 19 | `apps/service/src/jobs/index.ts:AutopayBillRow` | export (type, barrel re-export) | E | PR 2 (#13) |
| 20 | `apps/service/src/jobs/index.ts:LogAutopayOutcome` | export (type, barrel re-export) | E | PR 2 (#13) |
| 21 | `apps/service/src/jobs/index.ts:PruneOutcome` | export (type, barrel re-export) | E | PR 2 (#13) |
| 22 | `apps/service/src/jobs/index.ts:RefreshDeps` | export (type, barrel re-export) | E | PR 2 (#13) |
| 23 | `apps/service/src/jobs/index.ts:RefreshOutcome` | export (type, barrel re-export) | E | PR 2 (#13) |
| 24 | `apps/service/src/jobs/index.ts:JobName` | export (type, barrel re-export) | E | PR 2 (#13) |
| 25 | `apps/service/src/jobs/index.ts:JobDatabase` | export (type, barrel re-export) | E | PR 2 (#13) |
| 26 | `apps/service/src/jobs/index.ts:JobLogger` | export (type, barrel re-export) | E | PR 2 (#13) |
| 27 | `apps/service/src/jobs/index.ts:pruneCutoffs` | export (function, barrel re-export) | E | PR 2 (#13) |
| 28 | `packages/matching/src/index.ts:normalizeTokens` | export (function, barrel re-export) | F1 | PR 2 (#13) |
| 29 | `packages/matching/src/index.ts:tokenize` | export (function, barrel re-export) | F1 | PR 2 (#13) |
| 30 | `packages/matching/src/index.ts:stripPunctuation` | export (function, barrel re-export) | F1 | PR 2 (#13) |
| 31 | `packages/matching/src/index.ts:singularize` | export (function, barrel re-export) | F1 | PR 2 (#13) |
| 32 | `packages/matching/src/index.ts:BRANDS` | export (const, barrel re-export) | F1 | PR 2 (#13) |
| 33 | `packages/matching/src/index.ts:DESCRIPTORS` | export (const, barrel re-export) | F1 | PR 2 (#13) |
| 34 | `packages/matching/src/index.ts:UNITS` | export (const, barrel re-export) | F1 | PR 2 (#13) |
| 35 | `packages/matching/src/index.ts:FUZZY_THRESHOLD` | export (const, barrel re-export) | F1 | PR 2 (#13) |
| 36 | `packages/matching/src/index.ts:tokenSimilarity` | export (function, barrel re-export) | F1 | PR 2 (#13) |
| 37 | `packages/matching/src/index.ts:tokensFuzzyMatch` | export (function, barrel re-export) | F1 | PR 2 (#13) |
| 38 | `packages/matching/src/index.ts:MatchDecision` | export (type, barrel re-export) | F2 | PR 2 (#13) |
| 39 | `packages/matching/src/index.ts:MatchResult` | export (type, barrel re-export) | F2 | PR 2 (#13) |
| 40 | `packages/matching/src/index.ts:MatchTargetKind` | export (type, barrel re-export) | F2 | PR 2 (#13) |
| 41 | `packages/recurrence/src/index.ts:currentTurnIndex` | export (function, barrel re-export) | F3 | PR 2 (#13) |
| 42 | `packages/recurrence/src/index.ts:BillOccurrenceState` | export (type, barrel re-export) | F3 | PR 2 (#13) |
| 43 | `packages/recurrence/src/index.ts:ChoreOccurrenceState` | export (type, barrel re-export) | F3 | PR 2 (#13) |
| 44 | `packages/recurrence/src/index.ts:RebasedRotation` | export (type, barrel re-export) | F3 | PR 2 (#13) |
| 45 | `packages/shared/src/api/auth.ts:SessionResponse` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 46 | `packages/shared/src/api/errands.ts:ErrandStatus` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 47 | `packages/shared/src/api/households.ts:JoinHouseholdRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 48 | `packages/shared/src/api/lists.ts:ListsQuery` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 49 | `packages/shared/src/api/lists.ts:CreateListRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 50 | `packages/shared/src/api/lists.ts:UpdateListRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 51 | `packages/shared/src/api/matching.ts:MatchTargetKind` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 52 | `packages/shared/src/api/matching.ts:MatchDecision` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 53 | `packages/shared/src/api/meal-plan.ts:MealPlanQuery` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 54 | `packages/shared/src/api/meal-plan.ts:AddToListRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 55 | `packages/shared/src/api/meal-plan.ts:WeekAddToListRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 56 | `packages/shared/src/api/membership.ts:TransferAdminRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 57 | `packages/shared/src/api/notifications.ts:DeletePushSubscriptionRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 58 | `packages/shared/src/api/recipes.ts:RecipesQuery` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 59 | `packages/shared/src/api/recipes.ts:ParseRecipeRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 60 | `packages/shared/src/api/system.ts:ClientErrorRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 61 | `packages/shared/src/api/users.ts:QuietHours` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 62 | `packages/shared/src/api/users.ts:SetActiveHouseholdRequest` | type alias (`z.infer`) | F4 | PR 2 (#13) |
| 63 | `.dockerignore:BUILD_PROMPT.md` | ignore-file entry (line 24, last line) | REF | PR 3 (#14) |
| 64 | `.prettierignore:BUILD_PROMPT.md` | ignore-file entry (line 4) | REF | PR 3 (#14) |
