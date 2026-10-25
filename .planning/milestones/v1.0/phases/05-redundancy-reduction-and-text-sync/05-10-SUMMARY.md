---
phase: 05-redundancy-reduction-and-text-sync
plan: 10
subsystem: tooling
tags: [citations, non-ts, yaml, sql, css, html-fixtures, test-titles, ledger]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-09: refactor/drop-spec-citations with apps/web done, the citation-inventory and comment-only-check tools"
provides:
  - "PR C content complete: non-TS code and config files, the two root JS configs, the 3 recipe HTML fixtures and the 45 citing test titles are free of retired-spec citations (pr-c-left=0)"
  - ".planning/cleanup/tools/nonts-comment-check.mjs with five negative controls (nonts-comment-controls.sh)"
  - "batch-nonts.tsv (62 rows), titles.tsv (45 rows) and the ledger sections Non-TS proofs, HTML fixtures, Titles"
affects: [05-11 PR C landing]

actuals:
  tokens: 45000
  tasks: 3
  commits: 3

# commits: measured on the working branch from plan_head_before (git rev-list --count 4903716..752b150 is 3:
# 135353a, 124a452, 752b150, the three ledger/TSV/tool commits). The four code commits live on
# refactor/drop-spec-citations in ../hearth-citations (05cebd4 nonts, 4f4c124 fixtures, 96fb846 titles) plus
# working-branch merges (ddcce52, b8decf1 and an earlier one), and are not on the working branch.
# tokens is chars/4 over the code diff (about 60k characters of comment/title text plus the checker and ledger).
plan_head_before: 490371689e1dca1205e847f92a8eb56a518a366f
plan_head_after: 752b150c1f35719eb18fc3c1bfacdc8e308be271

tech-stack:
  added: []
  patterns:
    - "Per-type comment-only proof for non-TS files: parsed YAML deep-equal, comment-stripped #, -- and /* */ text equal, compiler print for JS"
    - "Title commit kept separate: --titles print OK, plain print FAILs on exactly the files of titles.tsv"

key-files:
  created:
    - .planning/cleanup/tools/nonts-comment-check.mjs
    - .planning/cleanup/tools/nonts-comment-controls.sh
    - .planning/cleanup/text-sync/batch-nonts.tsv
    - .planning/cleanup/text-sync/titles.tsv
  modified:
    - ".planning/cleanup/TEXT-SYNC-LEDGER.md (nonts row, Non-TS proofs, HTML fixtures, Titles sections)"
    - "13 non-TS and root-config files, 3 HTML fixtures and 28 test files on refactor/drop-spec-citations"

key-decisions:
  - "The three root JS config lines (commitlint.config.js 1, eslint.config.js 98 and 135) are in PR C, because D-09 names the two root JS configs; proven by the compiler print"
  - "apply-pure is not used for non-TS files; all 62 sites were edited by hand without reflow"
  - "Only the 45 inventory title rows were edited; nine titles with bare Design, Branding or Requirements wording are reported, not changed"

patterns-established:
  - "nonts-comment-check.mjs: one rule per file type, with --html for the fixture pages"

requirements-completed: []

duration: about 50 minutes wall time
completed: 2026-10-22
status: complete
---

# Phase 5 Plan 10: PR C non-TS files, fixtures and titles Summary

**PR C's content is complete: 62 sites in 13 non-TS and root-config files, the 3 recipe fixture pages and 45 test titles no longer cite the retired spec (`pr-c-left=0`), each proven by a check that fits what changed, with every test count unchanged.**

## Performance

- **Duration:** about 50 minutes wall time
- **Completed:** 2026-10-22
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 13 + 3 + 28 files on `refactor/drop-spec-citations`; the checker, controls, two TSVs and the ledger on the working branch

## Accomplishments

- **Task 1 (tracer): the checker and the `nonts` batch.** `nonts-comment-check.mjs` has one rule per file type (parsed YAML deep-equal; `#` comments with a diff-line check, shebang and `# syntax=` guard; `--` SQL with an unsafe-quote guard; `/* */` CSS; HTML with `--html`). Negative controls: `nonts-control-yaml|hash|sql|css|html=FAIL OK` (a code-changing mutant fails, a comment-only change passes). Batch `nonts`, commit `05cebd4`: 62 sites (46 removed, 16 rewritten) in `.env.example`, `docker/` (Caddyfile, caddy.Dockerfile, docker-compose.yml, kong.yml), `e2e/docker-compose.e2e.yml`, `e2e/fixtures/e2e-seed.sql`, `scripts/deploy.sh`, `supabase/config.toml`, `supabase/seed/seed.sql`, `apps/web/src/index.css`, `commitlint.config.js`, `eslint.config.js`. Checker prints `OK 11 files` plus the compiler-print check `OK 2 files`, on the working tree and on the commit. `kong-yaml-equal=yes`: `docker/kong.yml` parses to the same configuration, so no Kong recreate is needed. Gates: `bash -n scripts/deploy.sh`, `pnpm test:harness` (231 pass), `pnpm lint`, `pnpm format:check`, service suite 757 (Kong allowlist test included), web build (`App shell 198.0 KB gzipped`), migrations identical to the phase base.
- **Task 2: recipe fixtures (D-20).** Commit `4f4c124`: one paragraph in each of `full-json-ld-light.html`, `full-json-ld-dark.html`, `no-json-ld.html`. The nonts check with `--html` prints `OK 3 files` (JSON-LD blocks byte-identical, nothing outside the paragraphs changed). `extractRecipeJsonLd` returns equal output for the old and new version of each page (`html-extract-equal=yes`); no code or test outside the fixtures reads any removed phrase (`html-consumers=none`). The journey (spec 13) runs in PR C's CI.
- **Task 3: titles (D-19).** Commit `96fb846` (`test: restate test titles without spec citations`, message says it is not comment-only): 45 titles in 28 files, in one style (describe = subject in plain words; it/test = present-tense behavior; rules kept in plain words; `the seed data` lower case; two concatenated titles became one literal). `comment-only-check.mjs --titles` prints `OK 28 files` on the commit (`titles-proof=OK`); without `--titles` it prints `FAILED 28 of 28 files`, exactly the 28 files of `titles.tsv` (`titles-plain-check=FAIL as expected`). `title-consumers=none`. `pr-c-left=0`: the inventory over the PR C tree (minus README and `.claude`) has no rows.

## Test counts (before and after the titles commit, `pnpm -r test` at C)

| Workspace | Before | After |
| --------- | ------ | ----- |
| matching | 156 | 156 |
| shared | 172 | 172 |
| recurrence | 77 | 77 |
| service (unit) | 757 | 757 |
| web | 728 | 728 |
| e2e support tests | 15 | 15 |
| service integration (`vitest list`, lines) | 382 | 382 |
| Playwright (`--list`) | 104 tests in 19 files | 104 tests in 19 files |

## Task Commits

1. **Task 1: nonts batch (tracer)** - `05cebd4` (code, on C), `135353a` (docs: checker, controls, TSV, ledger, on the working branch)
2. **Task 2: recipe fixtures** - `4f4c124` (code, on C), `124a452` (docs: ledger)
3. **Task 3: titles** - `96fb846` (code, on C), `752b150` (docs: titles.tsv, ledger)

Merges of the working branch into C before each push: `ddcce52`, `b8decf1` (and one at the start of Task 1). C is pushed at `b8decf1`.

## Decisions Made

- **Root JS configs in scope.** D-09 names "the two root JS configs", so the 3 lines in `commitlint.config.js` and `eslint.config.js` were rewritten in the `nonts` commit and proven by the TypeScript compiler print (`comment-only-check.mjs`), not the non-TS checker. `eslint.config.js:135` now reads `Non-null assertions are allowed in tests only.`
- **Hand edits for non-TS files.** `apply-pure`'s refill merged the commented-out `HEARTH_RATE_LIMIT_PER_MINUTE=300` example in `.env.example` into a sentence, broke comment indentation in `e2e/docker-compose.e2e.yml` and deleted the `-- ----` rule lines in the SQL files. It was reverted and all 62 sites were edited with exact-string replacements (no reflow); a `Dockerfile` line it would have pushed past 100 characters was rewrapped by hand.
- **Bare references in the same files.** `Design:`, `Branding:`, `the Branding ones`, `Seed Data` as a subject and `Phase 3 "Done when"` in the batch's files were reworded with the citations, as in 05-09.
- **Titles scope.** The plan limits the title edit to the inventory's `title` class, so nine further titles that name a retired document without matching the vocabulary were left (see Open items).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `apply-pure` damaged non-TS comment layout**
- **Found during:** Task 1 (diff review of the `apply-pure` output)
- **Issue:** the refill merged a commented-out config example into prose, left a comment line at column 0 inside a YAML list and removed SQL separator rules.
- **Fix:** reverted the tool's output and applied the 62 edits by hand; the checkers would have passed the damaged output, so the diff review was the control.
- **Files modified:** all `nonts` batch files
- **Commit:** `05cebd4`

### Other deviations

- The plan says 46 titles in 27 files; the inventory has 45 rows in 28 files (`count-titles=45`, as the ledger recorded at 05-06). `titles.tsv` has 45 rows.
- The plan names the working branch `claude/vigilant-gates-a4ihid`; the real one is `claude/eloquent-mayer-szjtjf`.
- The titles commit was first created without the attribution trailers and amended before its first push (no published commit was rewritten). `96fb846` is the pushed hash.
- Added `nonts-comment-controls.sh` (not named in the plan) so the five controls are reproducible; it is committed with the checker.
- The `title-consumers` grep from the plan prints one hit, `mapfile -t lines` in `scripts/ci-prepull-images.sh`, which is a bash flag and not a test filter.

**Total deviations:** 1 auto-fixed, 0 architectural. **Impact on plan:** none; outputs match the acceptance criteria.

## Issues Encountered

None beyond the above. The Husky pre-commit hook (lint-staged and a full typecheck) passed on every commit; no `workflow`-scope refusal and no gate failure. Integration, E2E and Docker-image evidence comes from PR C's CI.

## Open items for 05-11 or the owner

- Nine test titles still say `Design`, `Branding` or `Requirements` without matching the vocabulary: `apps/service/src/deals/price/parse-price.test.ts:34`, `apps/web/src/components/ui/Toast.test.tsx:34`, `apps/web/src/lib/password.test.ts:12`, `apps/web/src/lib/sections.test.ts:15`, `apps/web/src/screens/onboarding/onboarding.test.tsx:225` and `:243`, `apps/web/src/screens/settings/settings.test.tsx:95`, `apps/web/src/tokens.test.ts:99`, `packages/matching/src/similarity.test.ts:42`. Restating them is one more titles-style commit if wanted.
- The knip tool reports `nonts-comment-check.mjs` like the other `.planning/cleanup/tools` files as unused; Phase 6's CI-01 already has to account for those.

## Known Stubs

None.

## Threat Flags

None. Comment text, fixture paragraphs and test names only; no endpoint, auth path, file access or schema change. T-05-24 is mitigated by the per-type checker with controls plus the harness, lint, service (Kong allowlist) and web build gates; T-05-25 by `kong-yaml-equal=yes`; T-05-26 by the byte-identical JSON-LD, equal importer output and no consumers; T-05-27 by the title-normalised print, the failing plain print and equal counts.

## Next Phase Readiness

- PR C content is complete on `refactor/drop-spec-citations` (pushed at `b8decf1`, working branch merged in). 05-11 opens and lands it (owner squash-merge); the PR body should say that `docker/kong.yml` needs no recreate, that the titles commit is not comment-only, and that the fixture paragraphs are visible text.

## Self-Check: PASSED

- Files: `nonts-comment-check.mjs`, `nonts-comment-controls.sh`, `batch-nonts.tsv` (62 rows), `titles.tsv` (45 rows) exist; ledger keys `kong-yaml-equal=yes`, `nonts-control-*=FAIL OK` (5), `html-*` (3), `titles-commit=`, `titles-proof=OK`, `title-consumers=none`, `titles-counts-equal=yes`, `pr-c-left=0` are present.
- Commits `05cebd4`, `4f4c124`, `96fb846` are ancestors of `origin/refactor/drop-spec-citations` (`b8decf1`); `135353a`, `124a452`, `752b150` are ancestors of the working branch and its `origin` tip.
- Task 3's verify command printed `TASK3-VERIFY-PASS`; the tracked-pattern scan and the token value scan succeeded.

---
*Phase: 05-redundancy-reduction-and-text-sync*
*Completed: 2026-10-22*
