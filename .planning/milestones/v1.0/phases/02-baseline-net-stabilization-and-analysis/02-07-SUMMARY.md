---
phase: 02-baseline-net-stabilization-and-analysis
plan: 07
subsystem: tooling
tags: [knip, jscpd, dead-code-analysis, triage, duplication-baseline]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "02-06: knip 6.41.0 calibrated config and the Approvals for knip and jscpd; 02-09: sweep scripts and docs on test/deterministic-clock"
provides:
  - "TRIAGE.md Method, Findings (89 rows in four buckets, each with tool and text-search evidence) and Duplication baseline (jscpd 5.4.1)"
  - "OWNER-CANDIDATES.md: 61 uncertain items, the D-10 standing list, 19 test-only items and the 6 proven-dead items"
  - "Raw knip (default, production) and jscpd (source, source-with-tests, whole-repo) reports from the combined Phase 2 tree"
  - "A knip.json fix declaring the shared test setup as root entries (config gap found on the combined tree)"
affects: [02-08, phase-03, phase-05]

actuals:
  tokens: 35000
  tasks: 3
  commits: 2
plan_head_before: f2e3c04fceeeb43e5ba4a73af3fe2b6ff314cdf0
plan_head_after: a1b05a21c61791e012ce7bf97bf39fca642dd58a

tech-stack:
  added: []
  patterns:
    - "Triage ledger: one row per unique finding, conservative bucket precedence, deterministic order"
    - "Analyze the tree main will hold (scratch merge of both branches), then remove it"

key-files:
  created:
    - .planning/cleanup/OWNER-CANDIDATES.md
    - .planning/cleanup/knip/ (default, production, before-gap-fix summaries and reports)
    - .planning/cleanup/jscpd/ (three reports)
  modified:
    - knip.json
    - .planning/cleanup/TRIAGE.md

key-decisions:
  - "Package public surface (any packages/*/src symbol exported through a package entry) and curated barrel re-exports with no importer (apps/service/src/jobs/index.ts) are forced to uncertain, following the 02-06 limitations; this is why 61 of 89 rows are uncertain"
  - "Root knip workspace gets entries test/*.mjs! and scripts/test-sweep.mjs! so the Phase 2 test infrastructure is not reported as unused in production mode"
  - "Text-search hits are counted outside the file(s) that define or re-export the name, so a name appearing where it is defined does not count as usage"

requirements-completed: [BASE-02, BASE-03, BASE-04]

duration: ~45min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 07: knip triage and jscpd duplication baseline Summary

**The combined Phase 2 tree was analyzed with knip 6.41.0 in both modes: 86 unique findings plus 3 config-gap rows are triaged into 6 proven-dead, 19 test-only, 3 config-gap and 61 uncertain, and the jscpd 5.4.1 baselines are 11 source-only clones at 0.47% and 96 clones (85 test-involved) at 1.87% with tests included.**

## Performance

- **Tasks:** 3 of 3 (no checkpoint reached; the jscpd precondition line was present in TRIAGE.md)
- **Commits on `chore/knip-config`:** 2 measured from the ledger (`f2e3c04..a1b05a2`), plus the docs commit that carries this SUMMARY
- **Changed files outside `.planning/`:** `knip.json` only. No file was deleted and no source file was changed.

## Accomplishments

- Combined tree: scratch branch `scratch/phase2-combined` from `chore/knip-config`, merged with `test/deterministic-clock` (clean, no conflicts), later with the one `knip.json` commit. Removed with its worktree afterwards; `chore/knip-config` and `test/deterministic-clock` were not touched except the one planned `knip.json` commit.
- knip ran in default (59 findings) and production (80) mode. No Phase 2 infrastructure file appears as unused in either mode, and none of the exports of `zone-dates.ts` or `e2e/support/clock.ts` is reported.
- Findings ledger: 89 rows (86 unique findings plus 3 config-gap rows), counts `proven-dead: 6`, `test-only: 19`, `config-gap: 3`, `uncertain: 61`.
  - proven-dead (export or type with no importer and no mention outside its file): `ChoreLike`, `useFavoriteStores`, `listIdOfWrite` and the three `apps/web/src/test/meal-fixtures.ts` fixtures.
  - test-only: 14 re-export lines of `apps/service/src/jobs/index.ts` that only `jobs/index.test.ts` imports, `readinessNotBuiltYet` in `refresh-deals.ts`, `parseIngredientLines`, `BANNED_GAMIFICATION_WORDS`, `allChoreCopyStrings`, `PushPortProvider`.
  - uncertain: package public-surface exports and types (matching, recurrence, shared), the `jobs/index.ts` barrel lines with no importer, the Flipp fixture mechanism, `tailwindcss`, `tsx`, `fuse.js`, `vitest`, and the `bills-copy.ts` duplicate-export pair.
- OWNER-CANDIDATES.md lists every uncertain row with its mechanism, evidence and one question, the D-10 standing list (11 entries), a test-only table and the proven-dead names.
- jscpd 5.4.1 (via `pnpm dlx`; nothing added to the repo): source-only 11 clones, 190 of 40,801 lines, 0.47%; test-inclusive 96 clones, 1,438 of 77,020 lines, 1.87%, 85 test-involved; whole-repo (informational) 174 clones, 2.67%. The 11 non-test-involved clones of the test-inclusive scan are exactly the 11 source-only clones.

## Task Commits

1. Task 1 `knip.json` fix: `70acd70` chore: declare the shared test setup as knip entries
2. Tasks 1 to 3 records: `a1b05a2` docs: record the knip triage and duplication baseline (TRIAGE.md, OWNER-CANDIDATES.md, `knip/`, `jscpd/`)
3. This SUMMARY: `docs: complete plan 02-07`, made after this file was written, so not in `commits:` above

## For the owner

Scope note for the owner: D-12 records the source-only figure as the RED-03 baseline, while RED-03 and ROADMAP Phase 5 criterion 3 measure duplicated test fixtures, which the source-only scan leaves out by design (it ignores every `*.test.ts`, `*.test.tsx` and `*.spec.ts` file). Both figures are recorded at identical thresholds (60 tokens, 8 lines), so Phase 5 can re-run either command unchanged. Which figure Phase 5 compares against is the owner's decision, and D-12 itself is unchanged.

Baseline lines (also in TRIAGE.md):

- Phase 5 (RED-03) baseline: source-only clones = 11, duplicated lines = 0.47%
- Phase 5 (RED-03) test-inclusive baseline: clones = 96, test-involved clones = 85, duplicated lines = 1.87%

Other things for the owner:

- 61 of 89 rows are `uncertain` because two classes were forced there: package public-surface exports (reported only because `includeEntryExports` is on for `packages/*`) and unused re-export lines of the `jobs/index.ts` barrel. Only 6 items are proven dead; if you consider `packages/*` internal-only, many of the 18 unused `@hearth/shared` types and the matching and recurrence barrel exports become removal candidates by your decision.
- `vitest` is imported by `test/clock-setup.mjs` but not declared in the root `package.json`; it works through hoisting. Declaring it is a root `package.json` change that this plan does not make.
- `packages/matching/scripts/fuzzy-benchmark.ts` no longer runs as committed (`fuse.js` was removed); keep or delete is your call.

## Deviations from Plan

**1. [Rule 3 - Config gap, planned branch] knip.json root entries**
- **Found during:** Task 1 combined-tree check
- **Issue:** production mode reported `scripts/test-sweep.mjs`, `test/clock-setup.mjs` and `test/global-tz.mjs` as unused files; the root workspace declared no entries.
- **Fix:** root `entry: ["test/*.mjs!", "scripts/test-sweep.mjs!"]` in `knip.json`, committed on `chore/knip-config` (`70acd70`), merged into the analysis tree, both modes re-run. Three `config-gap` rows record it; pre-fix summaries are kept as `before-gap-fix-*-summary.txt`.
- **Files modified:** `knip.json`

**2. [Plan/reality] `--gitignore` flag does not exist in jscpd 5.4.1**
- The plan's command exits 2 (`unexpected argument '--gitignore'`). `.gitignore` is respected by default (`--no-gitignore` opts out), so the flag was dropped; every other argument is as written. TRIAGE.md records the exact commands used.

**3. [Plan/reality] Task 1 verify merge clause cannot match after a config-gap fix**
- The verify requires the latest merge subject to contain `deterministic-clock`. Step 3 of the same task adds a later merge of `chore/knip-config`, whose subject does not. The first merge (`6dc9999`) names `test/deterministic-clock`. All other Task 1 verify clauses were checked and hold.

**4. [Plan/reality] Task 2 verify cannot parse the duplicates finding**
- knip's summary writes one finding as `apps/web/src/components/bills/bills-copy.ts:BILLS_EMPTY_COPY|BILLS_LIST_EMPTY_COPY`. A literal pipe breaks a Markdown table and the verify's `split('|')` indexing. The row escapes it as `\|` (and a note under the table gives the raw form so the "item appears in TRIAGE.md" clause holds). The verify as written fails on that one row (`bad bucket`); a pipe-aware copy of the same checks passes all clauses and also checks order and non-empty evidence cells. Both outputs are in `.planning/cleanup/logs/02-07-triage-check.log` (not committed).
- Related: the whole-repo "ten files" table was first written with a leading rank column, which the verify's row pattern (`^\| [0-9]+ \| \``) also matches; it was rewritten as `File | Clones` to avoid that.

**5. [Process] Text-search convention and bucket refinements**
- Hits inside the defining or re-exporting file(s) are counted separately; barrel and package-surface classes are explicit uncertain rules in the Method. The plan's literal rule ("any non-documentation hit") would otherwise make every export uncertain, since a name always appears where it is defined.

**6. [Process] STATE.md, ROADMAP.md and REQUIREMENTS.md not touched**
- The orchestrator owns those writes; this plan's docs commit carries only the SUMMARY.

**7. [State] Primary checkout is not on `main`**
- It is on `claude/trusting-lovelace-y4r87h`. Nothing there was switched, reset, stashed or cleaned; `.planning/cleanup/` files were written there and copied to `../hearth-knip` for commit. The worktree branch-namespace check (`agent-*`) was not applied, as in 02-02 to 02-06; the protected/detached-branch check was.

**Total deviations:** 1 config fix, 3 plan/reality mismatches, 3 process or state notes. No auth gates, no denied actions.

## Known Stubs

None.

## Threat Flags

None. A report-only config entry change and planning records; no endpoint, auth path or schema.

## Self-Check

- FOUND: `knip.json`, `TRIAGE.md`, `OWNER-CANDIDATES.md`, `knip/default.json`, `knip/production.json` and the three jscpd reports in `../hearth-knip`
- FOUND commits `70acd70` and `a1b05a2` on `chore/knip-config`
- `../hearth-analysis` and `scratch/phase2-combined` are gone; `chore/knip-config` and `test/deterministic-clock` exist; the clock branch is unchanged (`9e794ae`)
- Branch diff against `origin/main` lists no `.claude/`, `.github/`, `supabase/migrations/`, `docker/` or logs path, no env file, no deletion, no `jscpd` entry in `package.json`; the secret-shaped scan of added lines counted 0
- The final push and the check that `origin/chore/knip-config` equals the local tip follow this commit; result stated in the return message
