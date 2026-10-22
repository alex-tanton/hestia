# Redundancy ledger (Phase 5 index: RED-01 to RED-05)

One row per requirement. Each row names the pull request, its squash commit on `main` and the ledger
keys that hold the decisive evidence, so the evidence can be found again without reading the plans.
Phase base: `c64d79e41ae7daab9ca48e3841a08db1446c64e5` (`phase-base=` in `CI-SETUP-LEDGER.md`).
Baseline for duplication (Phase 2, `TRIAGE.md`): 96 clones, 1,438 duplicated lines, 1.87%
(test-inclusive scan) and 11 clones, 190 lines, 0.47% (source-only scan).

| Req | What | PR (squash commit) | Decisive evidence keys | Ledger |
| --- | --- | --- | --- | --- |
| RED-01 | One composite setup action (`.github/actions/setup`) replaces the preamble repeated in six jobs; workflow name `CI` and the six job ids unchanged | PR A #26 (`ac8ef34`) | `expand-compare=OK` (expanded workflow deep-equals the original), `steps-compare=as-expected`, `deploy-yaml-equal=yes`, `pr-a-ci` (six success, run 39650921896), `main-ci-after-a` (one owner-approved rerun, attempt 2 green) | `CI-SETUP-LEDGER.md` |
| RED-02 | The duplicate seed typecheck is removed (the service `typecheck` script is `tsc --noEmit`; the seed is typechecked once) | PR A #26 (`ac8ef34`) | `typecheck-after=seed once`, `ci-seed-typecheck=once` | `CI-SETUP-LEDGER.md` |
| RED-03 | Duplicated integration and web test fixtures consolidated into shared helpers (`stack-hooks.ts`, `job-logger.ts`, `browser.ts`, `WithQueue`, `deal-fixtures.ts`) | PR B #27 (`a660d58`) | `before-clones=99`, `final-b-clones=66` (858 lines, 1.11%) against 96, `final-clones=66` (see `DOCS-AUDIT-LEDGER.md`), `pr-b-integration-tests=1190` = `main-integration-tests=1190`, `pr-b-ci` (six success, run 39658694324), `main-ci-after-b` (run 39661257811 six success) | `FIXTURE-LEDGER.md` |
| RED-04 | Retired-spec citations removed outside `.planning/`, `docs/` and `supabase/migrations/`, comment-only and verified; README and `.claude/CLAUDE.md` finished in PR D | PR C #28 (`9fdc9c9`) for code, tests and fixtures; PR D (pending until Task 3) for README, `.claude/CLAUDE.md` and the maps | `count-lines=1116` and `count-files=456` against the Phase 2 count of 262 (recounted with the full vocabulary), controls 1 to 6 (`OK OK`, `OK OK`, `FAIL FAIL`, `FAIL FAIL`, `OK OK`, `FAIL FAIL` as expected), `titles-commit=96fb846` with `titles-proof=OK` and `titles-counts-equal=yes`, `pr-c-left=0`, `pr-c-ci` (six success, run 39707916284), `main-ci-after-c` (run 39709025122 six success), `final-citations=0`, `migrations-untouched=yes` | `TEXT-SYNC-LEDGER.md`, `DOCS-AUDIT-LEDGER.md` |
| RED-05 | `docs/` and the codebase maps match the code; nothing added under `docs/` | PR D (pending until Task 3) | `misses-final=0` (docs and README, `checked-final=591`), `final-claims-misses=0` (docs, README, maps and `.claude/CLAUDE.md`, 2,353 tokens), `maps-commit=e486d7f692c29a79476a815cf858b6d63c3b496b`, `maps-mapped-at=283f15d` (contains `9fdc9c9`), `hearth-admin-claims=hand-written`, `docs-files=7`, the 14-row behavioral sample, `filemap-complete=yes` | `DOCS-AUDIT-LEDGER.md` |

PR D: the number, head, six CI conclusions and squash commit are in `DOCS-AUDIT-LEDGER.md`
(`pr-d=`, `pr-d-head=`, `pr-d-ci=`, `pr-d-merged=`, `main-ci-after-d=`, `phase-close-main=`).

## Final post-conditions (D head, `DOCS-AUDIT-LEDGER.md` "Phase close")

- `final-citations=0`: the citation inventory over the default scope is empty; the maps, docs, README and
  `.claude` print nothing for the vocabulary.
- `migrations-untouched=yes`: `supabase/migrations` is byte-identical to the phase base.
- `docs-files=7`: no file was added under `docs/`.
- `final-claims-misses=0`: the path checker reports zero misses over docs, README, maps and `.claude/CLAUDE.md`.
- `final-clones=66`, `final-duplicated-lines=858`, `final-percentage=1.11` against 96, 1,438 and 1.87%
  (source-only scan unchanged at 11 clones, 190 lines, 0.47%).
- Test counts equal in every workspace (harness 231, matching 156, shared 172, recurrence 77, service 757,
  web 728, e2e support 15).

## Hand-offs to Phase 6

- knip (CI-01): `knip-new=files .planning/cleanup/tools/citation-inventory.mjs; files
  .planning/cleanup/tools/comment-only-check.mjs; files .planning/cleanup/tools/docs-claims-check.mjs;
  files .planning/cleanup/tools/expand-compare.mjs; files .planning/cleanup/tools/jscpd-compare.mjs;
  files .planning/cleanup/tools/nonts-comment-check.mjs` (six `files` lines from a default `pnpm knip` at
  the D head; the `tailwindcss` devDependency line is the known `@import` false positive from `TRIAGE.md`).
  A blocking knip must either list `.planning/cleanup/tools/**` as entries or ignore the folder.
- jscpd (CI-02): the command is `pnpm dlx jscpd@5.4.1 apps packages e2e supabase/seed --format typescript,tsx
  --min-tokens 60 --min-lines 8 --ignore "**/node_modules/**,**/dist/**,**/coverage/**,**/db/types.ts"
  --reporters json,console --output {dir}` (jscpd 5.4.1 rejects `--gitignore`; drop it). With the three
  test globs added to `--ignore` it is the source-only scan. Final counts for a threshold: test-inclusive 66
  clones, 858 lines, 1.11%; source-only 11 clones, 190 lines, 0.47%. `jscpd-compare.mjs --max-clones N`
  reads either report.
- Web coverage thresholds (CI-06): `apps/web/vite.config.ts` sets thresholds 82/78/74/84, `apps/web` has
  no `test:coverage` script and CI runs no web coverage step, so the thresholds are not enforced;
  `docs/testing.md` states this as it is. Enforce or remove them. Only `packages/recurrence` runs
  `--coverage` inside `test`; the service coverage config (95/83/96/97) runs in `test-integration`.
- `workflow`-scope push constraint: `GH_TOKEN` lacks the `workflow` scope. PR A's branch needed the D-22
  hand-off (`pr-a-push=fallback`; the owner ran `apply.sh` from their own clone, Windows Git Bash needs
  `MSYS_NO_PATHCONV=1`). The later WB sync was an ordinary push (`post-a-sync=claude`), and PRs B, C and D
  touch no workflow file, so no further hand-off was needed. Phase 6 CI work will hit the same refusal.
- Throwaway-PR deploy check (CI-07): every squash merge in this phase (A, B, C and D) queued Deploy on
  the self-hosted `hearth` runner, which is not registered (STATE.md blocker); nothing here confirmed that
  `workflow_run` fires Deploy correctly after the setup-action change beyond the runs being created.
  CI-07 stays open.
- Owner-visible items carried from this phase: `Journey N` labels in the E2E suite and the follow-up
  sweep items in `TEXT-SYNC-LEDGER.md` were reported, not edited; the regenerated `.claude/CLAUDE.md`
  dropped the old Anti-Patterns and Component Responsibilities sections (owner decision in PR D).
