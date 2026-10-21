# Phase 3: Evidence-Gated Removal - Pattern Map

**Mapped:** 2026-10-19
**Files analyzed:** 5 new/added artifacts + 14 edit sites (worklist itself NOT repeated; see 03-RESEARCH.md "Removal worklist" A-F)
**Analogs found:** 5 / 5 new; all edit sites have exact in-file excerpts
**Base:** cut code branches from `origin/main` (7d14b77), not the working branch (03-RESEARCH.md Drift #8).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `scripts/knip-summary.mjs` (new) | utility (CLI script) | batch/transform (JSON -> TSV) | `/home/user/hearth-aside/bin/knip-summary.mjs` (verbatim source), conventions from `scripts/test-sweep.mjs` | exact (source) / role-match (repo conventions) |
| root `package.json` `knip:summary` script (mod) | config | n/a | `package.json:25-26` `knip` / `knip:production` | exact |
| `.planning/cleanup/REMOVAL-LEDGER.md` (new) | ledger doc | n/a | `.planning/cleanup/TRIAGE.md` (`## Findings` table) and `OWNER-CANDIDATES.md` | role-match |
| `.planning/cleanup/OWNER-CANDIDATES.md` (refresh) | ledger doc | n/a | itself | exact |
| throwaway draft-PR CI step in `.github/workflows/ci.yml` (never merged) | CI config | batch | `ci.yml` `test-integration` job, "Start Supabase" step | exact |
| throwaway `knip.nonode.tmp.json` (never committed) | config | n/a | `knip.json` | exact |

## Pattern Assignments

### `scripts/knip-summary.mjs` (utility, JSON -> TSV transform)

**Analog:** `/home/user/hearth-aside/bin/knip-summary.mjs` (39 lines, sha256 `74b6e969...cb12`). NOTE: outside the repo and lost with the container; copy it in the first task, byte-for-byte (research verified it reproduces all six recorded summaries). Do not rewrite.

**Header/imports/usage** (lines 1-12):
```js
#!/usr/bin/env node
// Normalizes `knip --reporter json` output into sorted `kind<TAB>path<TAB>symbol` lines
// ... Usage: knip-summary.mjs {knip.json} {out.txt}
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: knip-summary.mjs {knip json} {out txt}');
  process.exit(2);
}
```
**Core** (lines 14-39): flatten `report.issues`, `files` kind takes `entry.name`, array entries (`duplicates`) join names with `|`, sort by kind/path/symbol with a plain `<`/`>` comparator, final `total\tN\t-`, trailing newline.

**Repo conventions to match (from `scripts/test-sweep.mjs`):** `node:` prefixed imports, single quotes, printWidth 100 (`scripts/test-sweep.mjs:16-18`). Test-sweep uses a `/* */` header block (lines 1-14) and `import.meta.dirname`; the knip-summary source uses `//` comments, which is fine; do not restyle.
**Lint:** `eslint.config.js:85-90` block `files: ['**/*.js','**/*.mjs']` applies `disableTypeChecked` + node globals; no `no-console` rule, so `console.error` is allowed in scripts. Run `pnpm lint` and `pnpm format:check` on it.
**Mode:** has a shebang, so commit executable: `git add --chmod=+x scripts/knip-summary.mjs`; `git ls-files -s` must show `100755` (existing precedent: `scripts/deploy.sh`, `generate-secrets.sh` are 100755; `scripts/test-sweep.mjs` is 100644 because it has no shebang, so do not copy that mode).
**knip entry convention:** `knip.json` root workspace entry is only `["test/*.mjs!", "scripts/test-sweep.mjs!"]`. `test-sweep.mjs` is reachable because root `package.json` scripts reference it (`package.json:18-19`). Same mechanism for the new file, no `knip.json` change (D-08). Failing direction: a `files scripts/knip-summary.mjs` line in default knip output (unverified, research A3).
**Optional golden test:** analog `scripts/test-sweep.test.mjs` run via `node --test` through `test:harness` at `package.json:16`; add `scripts/knip-summary.test.mjs` to that list if done. Note that test files under `test/**` and `scripts/` are subject to the clock-ban lint rule; avoid `new Date()`.

### root `package.json` script

**Analog** (`package.json:25-26`):
```json
"knip": "knip",
"knip:production": "knip --production --workspace \"!e2e\" --workspace \"!supabase/seed\""
```
Add after them: `"knip:summary": "node scripts/knip-summary.mjs"`. Keep scripts in the existing order; exact-pinned deps only (`saveExact`); no dependency change.

### `.planning/cleanup/REMOVAL-LEDGER.md` (ledger)

**Analog:** `.planning/cleanup/TRIAGE.md`: header, `## Approvals`, `## Calibration` (a `| Kind | Default | Production |` count table, line 20), `## Findings` (line 129) with one table row per item. `OWNER-CANDIDATES.md` opens with a one-line "lives only in `.planning/`, never in `docs/`" disclaimer (line 1) and uses `### \`path:symbol\`` per item with "What / Why tooling cannot settle it / Evidence / Question" bullets.
**Columns (RESEARCH Wave 0):** item, kind, tool evidence (`--trace-export` quote, committed AND throwaway config), text-search evidence (the `git grep -n -I -w -F -e NAME -- . ':!pnpm-lock.yaml' ':!.planning' ':!.claude'` result), build/test evidence, commit, PR.
**Required rows beyond the worklist:** DEAD-01 null result ("0 files pass the proof"), D-06 fuse.js re-check, `db:types` run id and verdict, the `CURRENT_WEEK_SUNDAY` keep/remove decision, and `pruneCutoffs` (A1). Commit on the working branch only, never in a code PR (D-13).

### `.planning/cleanup/OWNER-CANDIDATES.md` (refresh in place)
Remove three stale entries (fuse.js unlisted, `vitest` unlisted in `test/clock-setup.mjs`, `packages/matching/scripts/fuzzy-benchmark.ts`) per RESEARCH Drift #5-6. Keep the existing per-item format above.

### Throwaway draft-PR CI step (`.github/workflows/ci.yml`, never merged)

**Analog:** `ci.yml` `test-integration` job; insert after the "Start Supabase" step:
```yaml
      # Applies supabase/migrations/ to a fresh local stack, the database the tests run against.
      - name: Start Supabase
        run: supabase start
```
Step body is in 03-RESEARCH.md "`db:types` evidence (D-15)"; copy it verbatim. Conventions: steps use `- run:` / `- name:` + `run:`, comments explain why, 6-space indent under `steps:`. Keep workflow name `CI` and all job ids unchanged (`deploy.yml` triggers on the name). Branch off the PR-2 tip, mark draft, close without merging; `cancel-in-progress` means a later push cancels the run.

### Throwaway knip config (not committed)
**Analog:** `knip.json` (46 lines). Generate with the `node -e` snippet in RESEARCH Pattern 1 (sets top-level `"node": false`), write `knip.nonode.tmp.json` in repo root, add to `.git/info/exclude`, delete after use. Needed for any subject under a `test/` directory.

## Edit sites (exact current text; worklist in 03-RESEARCH.md sections A-F)

All verified on the working tree this session; line numbers match RESEARCH.

| Site | Lines | Edit | Orphaned |
|---|---|---|---|
| `apps/web/src/components/chores/chore-copy.ts` | 1, 210-211 | delete `/** ChoreDetail carries ... */` + `export type ChoreLike = Chore \| ChoreDetail;` | line 1 import becomes `import type { Chore, Member, RecurrenceUnit } from '@hearth/shared';` |
| `apps/web/src/lib/api/deals.ts` | 10 (`favoriteStoreListSchema`), 19 (`type FavoriteStore`), 172-185 | delete whole `useFavoriteStores`, plus the blank line | the two import lines; `dealKeys.favoriteStores` stays; `UseQueryResult` still used elsewhere in this file (verify with typecheck/lint) |
| `apps/web/src/lib/offline/write-queue.ts` | 42-46 | delete `listIdOfWrite` + one blank line (body uses `LIST_WRITE_PREFIX`, `MutationKey`; both stay used elsewhere) | none |
| `apps/web/src/test/meal-fixtures.ts` | 570-573, 588-591, 593 | delete `currentWeekFixture`, `previousWeekFixture`, `emptyWeekFixture` | `MealPlanWeekResponse` in the type import block (line 4 region, `import type { MatchOverride, MealPlanEntry, MealPlanWeekResponse, ...`) |
| same file, cascade | 543, 544, 546, 558, 575-586 | delete `CURRENT_WEEK_SUNDAY`, `PREVIOUS_WEEK_SUNDAY`, `wednesdayZitiEntry`, `wednesdaySaladEntry`, `deletedRecipeEntry` (committed knip config will NOT report these; use throwaway config) | `MealPlanEntry` import if no longer used; run to fixed point |
| `apps/web/src/test/chore-fixtures.ts` | 7-9 | reword the comment "the same one `meal-fixtures.ts` uses as `CURRENT_WEEK_SUNDAY`" if that constant is removed | n/a |
| `apps/web/src/components/bills/bills-copy.ts` | 16-19 | rename line 16 to `export const BILLS_LIST_EMPTY_COPY =`, delete `= BILLS_EMPTY_COPY` alias line 19 and its blank line | consumer `BillsIndexScreen.tsx:7,152` already imports `BILLS_LIST_EMPTY_COPY` |
| `apps/service/src/jobs/index.ts` | 1-31 | drop the `type` names (`LockOutcome`, `DispatchOutbox`, `DispatchOutcome`, `PushTransport`, `AutopayBillRow`, `LogAutopayOutcome`, `PruneOutcome`, `RefreshDeps`, `RefreshOutcome`, `JobName`), `pruneCutoffs` (A1), and line 31 `export type { JobDatabase, JobLogger }`; keep `Scheduler` (main.ts:16) and all 15 runtime names asserted by `index.test.ts:14-30`. Single-name lines collapse onto one line for prettier (e.g. `export { withJobLock } from './advisory-lock.js';`) |
| `packages/matching/src/index.ts` | 1-14 | F1: drop `normalizeTokens, tokenize, stripPunctuation, singularize, BRANDS, DESCRIPTORS, UNITS, FUZZY_THRESHOLD, tokenSimilarity, tokensFuzzyMatch` lines; keep `normalize`, `matchIngredient`; F2: type block becomes `export type { MatchCandidate, MatchOverride } from './matcher.js';` |
| `packages/recurrence/src/index.ts` | 21, 23-27, 29-35 | F3: `export { currentBillOccurrence } from './bills.js';`, `export { currentChoreOccurrence, occurrenceToComplete } from './chores.js';`, rotation block drops `currentTurnIndex` and `type RebasedRotation`; keep `currentChoreOccurrence`, `rebaseRotationOnDeparture` (test-only) |
| `packages/shared/src/api/{auth,errands,recipes,users,...}.ts` | e.g. `auth.ts:31`, `errands.ts:11`, `recipes.ts:171`, `users.ts:14` | F4: delete the one-line `export type X = z.infer<typeof xSchema>;` for each of the 18 names; keep every `xSchema` |
| `supabase/seed/package.json` | 16 | delete `"tsx": "4.23.13",`; run `pnpm install`, commit `pnpm-lock.yaml` (-3 lines) in the same commit |
| `.dockerignore` | 24 (last line) | delete `BUILD_PROMPT.md` |
| `.prettierignore` | 4 | delete `BUILD_PROMPT.md` |

Barrel rule: these three index files are pure re-exports (CLAUDE.md "Module Design"); never add logic. Prettier: re-run `pnpm format:check` since collapsing lists changes wrapping.

## Shared Patterns

### Three-part proof loop (D-11) - applies to every row
1. `pnpm --silent knip --config knip.nonode.tmp.json --trace-export NAME` shows `(no imports found)` (also run committed config).
2. `git grep -n -I -w -F -e NAME -- . ':!pnpm-lock.yaml' ':!.planning' ':!.claude'` shows only the definition.
3. `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` and `pnpm --filter @hearth/web build`; then re-run knip and look for new cascade findings until a fixed point.
Failure of any part: revert the edit, move to OWNER-CANDIDATES.md.

### Commit message (commitlint.config.js:5-17)
Types `feat|fix|docs|refactor|test|chore|perf|build|ci`; closed scope list `web, service, shared, recurrence, matching, db, e2e, docker`; root/tooling commits scope-less (e.g. `build: drop unused tsx from the seed package`); subject <= 71 chars, body lines <= 100, no trailing period. Body names items plus one line per proof result. Multi-scope allowed: `refactor(shared,matching): ...`. Never `--no-verify`; the pre-commit hook runs lint-staged and `pnpm typecheck`.

### Error handling / logging
Not applicable to removals. Do not touch `apps/service/src/privileged/**`, `eslint.config.js` no-restricted-imports (lines 96-133), or `supabase/migrations/`; gate `git diff --stat origin/main...HEAD -- supabase/migrations` must print nothing.

## No Analog Found

| File | Reason |
|---|---|
| `scripts/knip-summary.test.mjs` (optional) | `scripts/test-sweep.test.mjs` is the pattern to follow, but no knip-fixture exists yet; build a 6-line fixture JSON inline |

## Metadata

**Analog search scope:** `scripts/`, root `package.json`, `knip.json`, `eslint.config.js`, `.github/workflows/ci.yml`, `.planning/cleanup/`, all edit-site files listed above.
**Tracked-source check:** every repo path named is git-tracked source (`git ls-files -s scripts` confirmed); the one non-repo analog, `/home/user/hearth-aside/bin/knip-summary.mjs`, is the explicit copy source per D-09.
**Pattern extraction date:** 2026-10-19
