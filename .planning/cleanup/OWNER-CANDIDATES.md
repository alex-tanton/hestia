Nothing listed here is deleted without the owner's decision (DEAD-06). This file lives only in `.planning/`; it is not a spec and never goes into `docs/`.

Source: `TRIAGE.md` (knip 6.41.0 on the combined Phase 2 tree, HEAD `b144d0d`). Every `uncertain` row of its `## Findings` table is listed below, followed by the standing-list items from decision D-10 that tooling cannot settle.

## Uncertain

**Findings from the knip reports (61)**

### `apps/service/src/deals/flipp/fixture-transport.ts:FIXTURE_NOW`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: D-10 fixture mechanism (`HEARTH_FLIPP_FIXTURE_DIR`): named in comments in `env.ts` and `e2e/docker-compose.e2e.yml`; importers are tests and fixture helpers only.
- Evidence: knip exports (production); `--trace-export`: 3 importer(s) in default (`apps/service/src/deals/flipp/flipp-deal-source.test.ts`, `apps/service/src/deals/flipp/normalized-fixtures.ts`, `apps/service/src/test/fixture-deal-source.ts`), 0 in production. Text search: 12 hit(s) outside the defining file(s) (0 doc, 8 test, 4 other): `apps/service/src/deals/flipp/normalized-fixtures.ts:5`, `apps/service/src/deals/flipp/normalized-fixtures.ts:33`, `apps/service/src/env.ts:61`; 1 inside them; config/script hits: `e2e/docker-compose.e2e.yml`.
- Question: Is this part of the fixture workflow you want kept (keep), or may it go?

### `apps/service/src/deals/flipp/fixture-transport.ts:NORMALIZED_FIXTURE_DIR`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: D-10 fixture mechanism: imported by the `fixtures:normalize` dev script (`apps/service/scripts/normalize-fixtures.ts`) as well as a test; a script outside the production graph.
- Evidence: knip exports (production); `--trace-export`: 2 importer(s) in default (`apps/service/scripts/normalize-fixtures.ts`, `apps/service/src/deals/flipp/normalized-fixtures.test.ts`), 0 in production. Text search: 5 hit(s) outside the defining file(s) (0 doc, 2 test, 3 other): `apps/service/scripts/normalize-fixtures.ts:6`, `apps/service/scripts/normalize-fixtures.ts:16`, `apps/service/scripts/normalize-fixtures.ts:18`; 1 inside them.
- Question: Is this part of the fixture workflow you want kept (keep), or may it go?

### `apps/service/src/deals/flipp/normalized-fixtures.ts`

- What: files, reported by knip in production mode.
- Why tooling cannot settle it: D-10 fixture mechanism: used by the `fixtures:normalize` package script (`apps/service/scripts/normalize-fixtures.ts`) and `normalized-fixtures.test.ts`; reported in production mode only.
- Evidence: knip files (production); `--trace-file`: not in the production module graph; in default mode its exports are imported by `apps/service/scripts/normalize-fixtures.ts` and `normalized-fixtures.test.ts`. Text search: 2 hit(s) outside the defining file(s) (0 doc, 1 test, 1 other): `apps/service/scripts/normalize-fixtures.ts:5`, `apps/service/src/deals/flipp/normalized-fixtures.test.ts:4`; 0 inside them.
- Question: Is this part of the fixture workflow you want kept (keep), or may it go?

### `apps/service/src/jobs/index.ts:AutopayBillRow`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 4 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:DispatchOutbox`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 13 hit(s) outside the defining file(s) (1 doc, 8 test, 4 other): `apps/service/src/jobs/scheduler.ts:6`, `apps/service/src/jobs/scheduler.ts:39`, `apps/service/src/privileged/notification-outbox.ts:5`; 4 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:DispatchOutcome`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 4 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:JobDatabase`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 21 hit(s) outside the defining file(s) (0 doc, 8 test, 13 other): `apps/service/src/jobs/log-autopay.ts:11`, `apps/service/src/jobs/log-autopay.ts:124`, `apps/service/src/jobs/prune-cache.ts:4`; 2 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:JobLogger`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 32 hit(s) outside the defining file(s) (0 doc, 21 test, 11 other): `apps/service/src/jobs/dispatch-notifications.ts:4`, `apps/service/src/jobs/dispatch-notifications.ts:87`, `apps/service/src/jobs/dispatch-notifications.ts:148`; 3 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:JobName`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 6 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:LockOutcome`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:LogAutopayOutcome`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 4 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:PruneOutcome`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 4 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:PushTransport`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 6 hit(s) outside the defining file(s) (0 doc, 0 test, 6 other): `apps/service/src/jobs/scheduler.ts:7`, `apps/service/src/jobs/scheduler.ts:39`, `apps/service/src/push/recording-transport.ts:4`; 5 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:RefreshDeps`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 7 hit(s) outside the defining file(s) (0 doc, 5 test, 2 other): `apps/service/src/jobs/scheduler.ts:10`, `apps/service/src/jobs/scheduler.ts:38`, `apps/service/src/jobs.integration.test.ts:10`; 7 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:RefreshOutcome`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 5 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/service/src/jobs/index.ts:pruneCutoffs`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Curated barrel re-export (`jobs/index.ts`, asserted by `jobs/index.test.ts`; `main.ts` imports only `createScheduler`). No importer of this line; the symbol itself lives in its defining module. Types cannot be exercised by the barrel test.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 3 hit(s) outside the defining file(s) (0 doc, 3 test, 0 other): `apps/service/src/jobs/prune-cache.test.ts:3`, `apps/service/src/jobs/prune-cache.test.ts:9`, `apps/service/src/jobs/prune-cache.test.ts:10`; 3 inside them.
- Question: Is the barrel meant to re-export this name (keep), or may the re-export line be dropped?

### `apps/web/package.json:tailwindcss`

- What: devDependencies, reported by knip in default mode.
- Why tooling cannot settle it: Known knip limitation (02-06): `@import 'tailwindcss'` in `apps/web/src/index.css` line 1 and the `@tailwindcss/vite` plugin in `vite.config.ts` use it; CSS imports are not followed. Not dead.
- Evidence: knip devDependencies (default); `--trace-dependency tailwindcss`: no imports found. Text search: 5 hit(s) outside the defining file(s) (0 doc, 0 test, 5 other): `apps/web/package.json:31`, `apps/web/package.json:41`, `apps/web/src/index.css:1`; 0 inside them; config/script hits: `apps/web/package.json`, `apps/web/src/index.css`, `apps/web/vite.config.ts`.
- Question: Confirm `tailwindcss` stays (it is used by the CSS import).

### `apps/web/src/components/bills/bills-copy.ts:BILLS_EMPTY_COPY|BILLS_LIST_EMPTY_COPY`

- What: duplicates, reported by knip in both mode.
- Why tooling cannot settle it: Same value exported under two names (`BILLS_LIST_EMPTY_COPY = BILLS_EMPTY_COPY`, line 19). `BILLS_LIST_EMPTY_COPY` is imported by `BillsIndexScreen.tsx`; `BILLS_EMPTY_COPY` has no importer. A naming consolidation, not dead code; the owner picks the canonical name.
- Evidence: knip duplicates (both); `--trace-export`: BILLS_EMPTY_COPY: 0 importer(s) in default, 0 in production; BILLS_LIST_EMPTY_COPY: 1 importer(s) in default (`apps/web/src/screens/bills/BillsIndexScreen.tsx`), 1 in production. Text search: 2 hit(s) outside the defining file(s) (0 doc, 0 test, 2 other): `apps/web/src/screens/bills/BillsIndexScreen.tsx:7`, `apps/web/src/screens/bills/BillsIndexScreen.tsx:152`; 3 inside them.
- Question: Which of the two names is canonical, so the other can be removed?

### `packages/matching/scripts/fuzzy-benchmark.ts:fuse.js`

- What: unlisted, reported by knip in default mode.
- Why tooling cannot settle it: D-10 standing list: ESLint-ignored benchmark script. `fuse.js` was removed from `package.json` by decision; the script header says it no longer runs as committed.
- Evidence: knip unlisted (default); `--trace-dependency fuse.js`: 1 import site(s). Text search: 7 hit(s) outside the defining file(s) (0 doc, 0 test, 7 other): `eslint.config.js:24`, `packages/matching/scripts/fuzzy-benchmark.ts:4`, `packages/matching/scripts/fuzzy-benchmark.ts:10`; 0 inside them; config/script hits: `eslint.config.js`.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:BRANDS`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 5 hit(s) outside the defining file(s) (0 doc, 3 test, 2 other): `packages/matching/src/normalize.ts:1`, `packages/matching/src/normalize.ts:30`, `e2e/fixtures/flipp/raw/data-27514.json:3284`; 2 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:DESCRIPTORS`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 4 hit(s) outside the defining file(s) (0 doc, 2 test, 2 other): `packages/matching/src/normalize.ts:2`, `packages/matching/src/normalize.ts:29`, `packages/matching/src/fixtures.test.ts:5`; 2 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:FUZZY_THRESHOLD`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 2 hit(s) outside the defining file(s) (0 doc, 2 test, 0 other): `packages/matching/src/similarity.test.ts:2`, `packages/matching/src/similarity.test.ts:43`; 3 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:MatchDecision`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 6 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the type export be removed?

### `packages/matching/src/index.ts:MatchResult`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the type export be removed?

### `packages/matching/src/index.ts:MatchTargetKind`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 7 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the type export be removed?

### `packages/matching/src/index.ts:UNITS`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 4 hit(s) outside the defining file(s) (0 doc, 0 test, 4 other): `apps/web/src/components/lists/ItemSheet.tsx:37`, `apps/web/src/components/lists/ItemSheet.tsx:149`, `packages/matching/src/normalize.ts:3`; 2 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:normalizeTokens`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 10 hit(s) outside the defining file(s) (0 doc, 7 test, 3 other): `packages/matching/scripts/fuzzy-benchmark.ts:5`, `packages/matching/scripts/fuzzy-benchmark.ts:160`, `packages/matching/scripts/fuzzy-benchmark.ts:161`; 2 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:singularize`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 6 hit(s) outside the defining file(s) (0 doc, 3 test, 3 other): `packages/matching/src/normalize.ts:4`, `packages/matching/src/normalize.ts:12`, `packages/matching/src/normalize.ts:101`; 3 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:stripPunctuation`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 5 hit(s) outside the defining file(s) (0 doc, 5 test, 0 other): `packages/matching/src/fixtures.test.ts:6`, `packages/matching/src/fixtures.test.ts:119`, `packages/matching/src/normalize.test.ts:2`; 5 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:tokenSimilarity`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 8 hit(s) outside the defining file(s) (0 doc, 8 test, 0 other): `packages/matching/src/similarity.test.ts:2`, `packages/matching/src/similarity.test.ts:4`, `packages/matching/src/similarity.test.ts:6`; 3 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:tokenize`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 8 hit(s) outside the defining file(s) (0 doc, 5 test, 3 other): `packages/matching/src/matcher.ts:1`, `packages/matching/src/matcher.ts:54`, `packages/matching/src/matcher.ts:92`; 3 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/index.ts:tokensFuzzyMatch`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 7 hit(s) outside the defining file(s) (0 doc, 5 test, 2 other): `packages/matching/src/matcher.ts:2`, `packages/matching/src/matcher.ts:56`, `packages/matching/src/similarity.test.ts:2`; 2 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/matching/src/normalize.ts:normalizeTokens`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only.
- Evidence: knip exports (production); `--trace-export`: 4 importer(s) in default (`packages/matching/scripts/fuzzy-benchmark.ts`, `packages/matching/src/fixtures.test.ts`, `packages/matching/src/normalize.test.ts`, ...), 1 in production. Text search: 10 hit(s) outside the defining file(s) (0 doc, 7 test, 3 other): `packages/matching/scripts/fuzzy-benchmark.ts:5`, `packages/matching/scripts/fuzzy-benchmark.ts:160`, `packages/matching/scripts/fuzzy-benchmark.ts:161`; 2 inside them.
- Question: Is this part of the intended public API of `@hearth/matching` (keep), or may the export be removed?

### `packages/recurrence/src/index.ts:BillOccurrenceState`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the type export be removed?

### `packages/recurrence/src/index.ts:ChoreOccurrenceState`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the type export be removed?

### `packages/recurrence/src/index.ts:RebasedRotation`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the type export be removed?

### `packages/recurrence/src/index.ts:currentChoreOccurrence`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only.
- Evidence: knip exports (production); `--trace-export`: 1 importer(s) in default (`packages/recurrence/src/index.test.ts`), 0 in production. Text search: 14 hit(s) outside the defining file(s) (0 doc, 13 test, 1 other): `apps/service/src/chores/occurrence.ts:70`, `packages/recurrence/src/chores.test.ts:2`, `packages/recurrence/src/chores.test.ts:5`; 4 inside them.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the export be removed?

### `packages/recurrence/src/index.ts:currentTurnIndex`

- What: exports, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip exports (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 5 hit(s) outside the defining file(s) (0 doc, 5 test, 0 other): `packages/recurrence/src/rotation.test.ts:4`, `packages/recurrence/src/rotation.test.ts:9`, `packages/recurrence/src/rotation.test.ts:21`; 5 inside them.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the export be removed?

### `packages/recurrence/src/index.ts:rebaseRotationOnDeparture`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only.
- Evidence: knip exports (production); `--trace-export`: 1 importer(s) in default (`packages/recurrence/src/index.test.ts`), 0 in production. Text search: 10 hit(s) outside the defining file(s) (0 doc, 10 test, 0 other): `packages/recurrence/src/index.test.ts:9`, `packages/recurrence/src/index.test.ts:39`, `packages/recurrence/src/rotation.test.ts:5`; 3 inside them.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the export be removed?

### `packages/recurrence/src/rotation.ts:rebaseRotationOnDeparture`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only.
- Evidence: knip exports (production); `--trace-export`: 3 importer(s) in default (`packages/recurrence/src/rotation.test.ts`, `packages/recurrence/src/index.ts`, `packages/recurrence/src/index.test.ts`), 1 in production. Text search: 10 hit(s) outside the defining file(s) (0 doc, 10 test, 0 other): `packages/recurrence/src/index.test.ts:9`, `packages/recurrence/src/index.test.ts:39`, `packages/recurrence/src/rotation.test.ts:5`; 3 inside them.
- Question: Is this part of the intended public API of `@hearth/recurrence` (keep), or may the export be removed?

### `packages/shared/src/api/auth.ts:SessionResponse`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/errands.ts:ErrandStatus`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 3 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/households.ts:JoinHouseholdRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/lists.ts:CreateListRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/lists.ts:ListsQuery`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/lists.ts:UpdateListRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/matching.ts:MatchDecision`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 6 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/matching.ts:MatchTargetKind`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 7 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/meal-plan.ts:AddToListRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/meal-plan.ts:MealPlanQuery`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/meal-plan.ts:WeekAddToListRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/membership.ts:TransferAdminRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/notifications.ts:DeletePushSubscriptionRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/recipes.ts:ParseRecipeRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/recipes.ts:RecipesQuery`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/system.ts:ClientErrorRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/users.ts:QuietHours`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/api/users.ts:SetActiveHouseholdRequest`

- What: types, reported by knip in both mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code.
- Evidence: knip types (both); `--trace-export`: 0 importer(s) in default, 0 in production. Text search: 0 hit(s) outside the defining file(s) (0 doc, 0 test, 0 other); 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the type export be removed?

### `packages/shared/src/scrub.ts:scrubFields`

- What: exports, reported by knip in production mode.
- Why tooling cannot settle it: Package public surface: reported because `includeEntryExports` is on for `packages/*` (02-06). API-surface candidate, not proof of dead code. Used by tests only.
- Evidence: knip exports (production); `--trace-export`: 1 importer(s) in default (`packages/shared/src/scrub.test.ts`), 0 in production. Text search: 6 hit(s) outside the defining file(s) (0 doc, 6 test, 0 other): `packages/shared/src/scrub.test.ts:7`, `packages/shared/src/scrub.test.ts:275`, `packages/shared/src/scrub.test.ts:278`; 1 inside them.
- Question: Is this part of the intended public API of `@hearth/shared` (keep), or may the export be removed?

### `supabase/seed/package.json:tsx`

- What: devDependencies, reported by knip in default mode.
- Why tooling cannot settle it: Launched by the `db:seed` script in `apps/service/package.json` (`tsx ../../supabase/seed/seed-users.ts`) across workspaces; script-reachable, not modelled by knip. `apps/service` declares its own `tsx` too.
- Evidence: knip devDependencies (default); `--trace-dependency tsx`: no imports found. Text search: 742 hit(s) outside the defining file(s) (47 doc, 145 test, 550 other): `.lintstagedrc.json:2`, `apps/service/package.json:10`, `apps/service/package.json:11`; 0 inside them; config/script hits: `.lintstagedrc.json`, `apps/service/package.json`, `apps/web/vite.config.ts`, `eslint.config.js`.
- Question: Keep `tsx` as a `supabase/seed` devDependency (the `db:seed` script runs through the service workspace), or drop it there?

### `test/clock-setup.mjs:vitest`

- What: unlisted, reported by knip in both mode.
- Why tooling cannot settle it: New Phase 2 setup file imports `vitest` but the root `package.json` declares none; it resolves through workspace hoisting. Real declaration gap, not dead code; fixing it means a root `package.json` change (outside this plan). `test/clock-setup.mjs` itself is live (setupFiles in five vitest configs).
- Evidence: knip unlisted (both); `--trace-dependency vitest`: 163 import site(s). Text search: 198 hit(s) outside the defining file(s) (5 doc, 154 test, 39 other): `.github/workflows/ci.yml:71`, `apps/service/package.json:14`, `apps/service/package.json:15`; 0 inside them; config/script hits: `.github/workflows/ci.yml`, `apps/service/package.json`, `apps/service/tsconfig.json`, `apps/web/package.json`.
- Question: Declare `vitest` as a root devDependency (a `package.json` change for a later phase), or move the setup file under a workspace?

**Standing list (decision D-10)**

These stay out of every removal list. Most are not reported by knip at all.

### `packages/matching/scripts/fuzzy-benchmark.ts`

- Why tooling cannot settle it: An ESLint-ignored benchmark script (see `eslint.config.js`) that imports `fuse.js`, which was removed from `package.json` by the matching decision. Its own header says it no longer runs as committed and gives the `pnpm add -D fuse.js@7.5.0` command to restore it. knip reports only the unlisted `fuse.js` import (row above), not the file.
- Question: Keep it as the record of how the matcher library was chosen, or delete the script?

### `apps/service/src/push/web-push.d.ts`

- Why tooling cannot settle it: Ambient `declare module 'web-push'` types, because the package ships none. No import references it; TypeScript picks it up through the service `tsconfig` include. Deleting it would break typecheck, not knip.
- Question: No question unless you want the declarations replaced with a typed package; otherwise keep.

### `apps/service/src/db/types.ts`

- Why tooling cannot settle it: Generated by `pnpm db:types` (kysely-codegen) and committed. Imported by `apps/service/src/db.ts`; also named in `apps/service/package.json`, the vitest configs and the repo rules. Regenerate, never delete or hand-edit.
- Question: Keep (regenerate only).

### `docker/*` (`Caddyfile`, `caddy-entrypoint.sh`, `caddy.Dockerfile`, `db/`, `docker-compose.yml`, `kong-entrypoint.sh`, `kong.yml`, `service.Dockerfile`)

- Why tooling cannot settle it: Deployment files reached by Compose, Docker builds and `scripts/deploy.sh`, not by any import. Phase rule 5 forbids editing them in this phase.
- Question: Keep. Name any file here you believe is leftover.

### `scripts/deploy.sh`, `scripts/generate-secrets.sh`

- Why tooling cannot settle it: Shell scripts run by the deploy workflow and by an operator, not through `package.json` scripts or imports.
- Question: Keep. Name any step you believe is leftover.

### `supabase/migrations/*.sql` (8 files)

- Why tooling cannot settle it: Applied in filename order by `supabase db reset`, `supabase start` and `scripts/deploy.sh`. A migration is history; removing or rewriting one breaks existing databases.
- Question: Keep (never removed by a cleanup).

### `e2e/fixtures/flipp/` (`raw/`, `normalized/`), reached through `HEARTH_FLIPP_FIXTURE_DIR`

- Why tooling cannot settle it: The Flipp fixture transport reads these by a path the E2E Compose overlay supplies in an environment variable (`apps/service/src/main.ts`, `env.ts`, `e2e/docker-compose.e2e.yml`). The path is built at runtime, so no import or static reference shows it. The `fixtures:normalize` script writes the `normalized/` set.
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

Reported by `knip --production` only: no production code uses them, tests do. Options per row: keep, move under `src/test/`, or delete (the tests that use it go with it).

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

## Proven-dead candidates (for the record)

The 6 `proven-dead` rows in `TRIAGE.md` are not owner questions; Phase 3 removes them only after its own three-part proof. Listed here so the owner sees every non-keep item in one place:

- `apps/web/src/components/chores/chore-copy.ts:ChoreLike`
- `apps/web/src/lib/api/deals.ts:useFavoriteStores`
- `apps/web/src/lib/offline/write-queue.ts:listIdOfWrite`
- `apps/web/src/test/meal-fixtures.ts:currentWeekFixture`
- `apps/web/src/test/meal-fixtures.ts:emptyWeekFixture`
- `apps/web/src/test/meal-fixtures.ts:previousWeekFixture`
