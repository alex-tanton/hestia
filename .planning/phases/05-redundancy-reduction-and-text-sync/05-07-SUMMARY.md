---
phase: 05-redundancy-reduction-and-text-sync
plan: 07
subsystem: service
tags: [citations, comments, typescript-compiler, codemod, ledger, apps-service]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-06: refactor/drop-spec-citations at 7437ac5 with the citation-inventory and comment-only-check tools"
provides:
  - apps/service free of retired-spec citations in comments (144 files, three proven comment-only batches), 15 describe/it titles left for 05-10
  - TSVs batch-service-http, batch-service-domain, batch-service-tests and three ledger rows
  - recorded service unit baseline tests-before-c.service-unit=757
affects: [05-09 apps/web batches, 05-10 non-TS files and titles, 05-11 PR C landing]

actuals:
  tokens: 62000
  tasks: 3
  commits: 3

# commits: measured on the working branch from plan_head_before (git rev-list --count 41574b6..4446af0 is 3:
# 78a91e7, e4c484b, 4446af0). The three code commits live on refactor/drop-spec-citations in ../hearth-citations
# (4b73f76, d210844, b4a9cb9) plus three merges of the working branch into it (77b82cc, 3ca12ff, da58b20), and
# are not on the working branch. The close-out commit `docs: complete plan 05-07` follows plan_head_after.
# tokens is chars/4 over the code diff (about 226k characters) plus the ledger rows and notes.
plan_head_before: 41574b660534bffc6230bef8769b6db7e1b739d8
plan_head_after: 4446af08054b3798cb0eca4e662652eac52c2fcb

tech-stack:
  added: []
  patterns:
    - "Each batch is applied with apply-pure, then every mixed and prose site is rewritten from the queue by exact-string edits, and the edited paragraph is refilled to 100 columns"
    - "A citation-only comment with no other content (a bare pointer above a test file's constants) is deleted with its blank line"

key-files:
  created:
    - .planning/cleanup/text-sync/batch-service-http.tsv
    - .planning/cleanup/text-sync/batch-service-domain.tsv
    - .planning/cleanup/text-sync/batch-service-tests.tsv
  modified:
    - ".planning/cleanup/TEXT-SYNC-LEDGER.md (three batch rows, tests-before-c.service-unit, notes)"
    - "144 files on refactor/drop-spec-citations under apps/service: 33 infrastructure source, 57 domain source, 54 test files; comments only"

key-decisions:
  - "Dispositions stay per line: removed (pointer-only parenthetical deleted), rewritten (mixed or prose restated as plain words), left:title (waits for 05-10)"
  - "The seed-fixture source is written 'the seed data' in lower case in test comments, per the citation rules"
  - "A notification-kind reference such as '(Branding, `bill_due`)' keeps the kind: '(`bill_due`)'"
  - "A sentence whose subject was a retired document states the rule itself (for example 'Rate discipline: one fetch per active postal code, ...')"

patterns-established:
  - "Service batch rows in TEXT-SYNC-LEDGER.md: service-http 50 sites, service-domain 184, service-tests 106 (340 in all, equal to the base inventory's apps/service rows)"

requirements-completed: []

duration: about 35 minutes wall time (20:05 to 20:19 UTC for the work, plus reading)
completed: 2026-10-21
status: complete
---

# Phase 5 Plan 07: PR C service Summary

**`apps/service` no longer cites the retired spec in any comment: 340 base-inventory sites over 144 files went through three proven comment-only batches (the compiler-print comparison prints `OK` from the PR C base to the tip), the service unit suite stays at 757 tests, and only 15 test titles are left for 05-10.**

## Performance

- **Duration:** about 35 minutes wall time
- **Completed:** 2026-10-21
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 144 code files on `refactor/drop-spec-citations`; three TSVs and the ledger on the working branch

## Accomplishments

- **Baseline.** `pnpm --filter @hearth/service test` at C's tip `7437ac5` before any service edit: 56 files, 757 tests. Recorded as `tests-before-c.service-unit=757` in `TEXT-SYNC-LEDGER.md`. Every batch reported 757 after.
- **Three batches on `refactor/drop-spec-citations`** (each: apply-pure, reviewed queue, hand edits, queue re-run empty of non-title sites, comment-only OK on the working tree, ESLint `--max-warnings=0` and Prettier `--check` on the changed files, service typecheck, service unit suite, migrations and `db/types.ts` identical to the phase base, then commit and a second comment-only OK on the commit):

| Batch | Paths | Files | Sites | Removed | Rewritten | Left (titles) | Commit |
| ----- | ----- | ----- | ----- | ------- | --------- | ------------- | ------ |
| service-http | routes, http, auth, db, gotrue, push, privileged, test helpers, top-level source, `scripts/`, `vitest.coverage.config.ts` | 33 | 50 | 41 | 9 | 0 | `4b73f76` |
| service-domain | services, chores, deals, jobs, notifications, recipes (non-test) | 57 | 184 | 134 | 50 | 0 | `d210844` |
| service-tests | every `apps/service/src/**/*.test.ts` (unit and integration) | 54 | 106 | 53 | 38 | 15 | `b4a9cb9` |

  Totals: 340 sites (equal to the base inventory's `apps/service` rows), 228 removed, 97 rewritten, 15 left as titles.
- **Whole-service proof (Task 3).** `comment-only-check.mjs --base 708c714 --head HEAD -- apps/service` printed `OK 144 files`. `citation-inventory.mjs inventory` over `apps/service` lists 15 rows, all class `title`. The service typecheck, ESLint over `apps/service` with `--max-warnings=0`, and the unit suite (757 passed) pass at the pushed tip. `supabase/migrations` and `apps/service/src/db/types.ts` are identical to the phase base. No removed line held a directive (`eslint-disable`, `@ts-`, `v8 ignore`, `c8 ignore`, `istanbul`, `prettier-ignore`, `<reference`).
- **Rules kept (T-05-19).** Each rewritten domain site states its rule without the attribution: equal weighting, half-up rounding and 0% for no ingredients (`readiness.ts`, `readiness.test.ts`); the no-backfill rule (`log-autopay.ts`); the rotation advances from the scheduled member, completions are validated for equality, undo reopens the occurrence (`chores.ts`); dormant postal codes and rate discipline (`deals.ts`, Flipp wrapper); integer cents (`deals/money.ts`); the notification kinds (`notifications/copy.ts`); the 1 request per second per host limit; the 50-per-page limit; the weeks x 52/12 conversion factors (`subscriptions.ts`).
- **Pushes.** `refactor/drop-spec-citations` is pushed at `da58b20`; the working branch `claude/eloquent-mayer-szjtjf` was pushed at `4446af0` before this summary. Before each code push the working branch was merged into C (`git merge --no-edit`, D-04); the changed paths outside `.planning` were all under `apps/service`, `apps/web`, `packages`, `e2e` or `supabase/seed`, and the secret-pattern scan of the added lines printed nothing. PR C is not opened: 05-11 lands it.

## Task Commits

1. **Task 1: service-http (tracer)** - `4b73f76` (code, on C), `78a91e7` (docs: record the service-http citation batch, on the working branch)
2. **Task 2: service-domain** - `d210844` (code, on C), `e4c484b` (docs: record the service-domain citation batch)
3. **Task 3: service-tests** - `b4a9cb9` (code, on C), `4446af0` (docs: record the service-tests citation batch)

Merges of the working branch into C before each push: `77b82cc`, `3ca12ff`, `da58b20`.

**Plan metadata:** the `docs: complete plan 05-07` commit that adds this summary and the state updates.

## Decisions Made

- Dispositions are by line, as in 05-06. The TSVs come from the base inventory rows of the files each batch changed (service-tests: every `*.test.ts` row, including the two title rows in files with no other edit).
- Where a citation was the only content of a comment (`jobs/prune-cache.test.ts`), the comment and its blank line were deleted; where only the source was named (`Seed Data's "This Week" list`), it became `the seed data's "This Week" list`.
- `updateBillPayment`'s comment pointed at an "autopay note" in the retired spec. The code does not exclude autopay-logged payments, so the comment now reads `(autopay-logged ones included)`; the original note's exact wording was not recoverable.
- `monthlyCents`'s comment cited the PRD's conversion table; the conversion factors are in the function, so the comment now lists them (weeks x 52/12, years / 12, days x 365/12, rounded half-up).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refill joined a split inline-code span**
- **Found during:** Task 2 (diff review of `chores/errands.ts`)
- **Issue:** the original comment broke a code span across lines (`` `Array.`` newline `filter` ``); refilling the paragraph produced `` `Array. filter` ``.
- **Fix:** restored `` `Array.filter` `` before staging. No other join of this kind appeared in the diffs.
- **Files modified:** `apps/service/src/chores/errands.ts`
- **Commit:** `d210844`

### Other deviations

- The plan names the working branch `claude/vigilant-gates-a4ihid`; the real one is `claude/eloquent-mayer-szjtjf`, as 05-01 to 05-06 recorded.
- The service-http commit subject was first `...from infrastructure comments` (75 characters, over phase rule 4's 71); it was amended to `refactor(service): drop retired spec citations from infra comments` (66) before its first push. No published commit was rewritten.
- Task 1's verify re-runs `comment-only-check.mjs --base HEAD~1 --head HEAD`; after the working-branch merge HEAD is a merge commit, so that command prints `OK 0 files`. The real per-commit proofs (`OK 33`, `OK 57`, `OK 54 files`) were taken on the batch commits before the merge, and the whole-service proof in Task 3 covers all three from the PR C base.
- Edits were applied with a script of exact-string replacements and a paragraph refill (kept in the session scratchpad, not committed); every replacement asserted a unique match, and three whose text had already been reflowed by an earlier refill were redone by hand.

**Total deviations:** 1 auto-fixed (a refill artifact), 0 architectural. **Impact on plan:** none; outputs match the plan's acceptance criteria.

## Issues Encountered

None beyond the above. The Husky pre-commit hook ran lint-staged and a full workspace typecheck on each commit and passed; no `workflow`-scope refusal, no registry flake, no gate failure. Integration test files were typechecked and linted only; they run in PR C's CI.

## Known Stubs

None.

## Threat Flags

None. Comment text only; no endpoint, auth path, file access or schema change. T-05-18 is mitigated by the compiler-print equality (template contents included) over all 144 files, and T-05-19 by the per-site rewrites listed above.

## Next Phase Readiness

- 05-08 (docs audit, PR D) is independent of this plan. 05-09 (`apps/web`) and 05-10 (non-TS files, the 45 title lines of which 15 are in the service, 4 HTML-body lines, the two root config TS files) can run the same procedure against `../hearth-citations`.
- `refactor/drop-spec-citations` has the working branch merged as of `4446af0`; it still has to take a fresh `git merge --no-edit {WB}` before any later push (D-04).

## Self-Check: PASSED

- Ledger rows `| service-http |`, `| service-domain |`, `| service-tests |` and the key `tests-before-c.service-unit=757` are present; the three TSVs are committed.
- Commits `4b73f76`, `d210844`, `b4a9cb9` are ancestors of `origin/refactor/drop-spec-citations` (`da58b20`); `78a91e7`, `e4c484b`, `4446af0` are ancestors of the working branch and its `origin` tip.
- Task 1 and Task 3 verify commands printed `TASK1-VERIFY-PASS` and `TASK3-VERIFY-PASS`; the token scans (tracked-pattern scan and value scan) succeeded.

---
*Phase: 05-redundancy-reduction-and-text-sync*
*Completed: 2026-10-21*
