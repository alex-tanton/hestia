---
phase: 05-redundancy-reduction-and-text-sync
plan: 11
subsystem: tooling
tags: [citations, pull-request, ci, squash-merge, ledger, comment-only-proof]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-10: refactor/drop-spec-citations with pr-c-left=0 (non-TS files, fixtures, 45 titles)"
provides:
  - "PR C (#28) squash-merged into main as 9fdc9c9 with six green jobs before and after the merge"
  - "Whole-range proofs, post-condition (D-21), local gates, after-c-clones=66, spec 13 and integration-count evidence in TEXT-SYNC-LEDGER.md"
  - "Follow-up sweep (aaed732 comments, 33baf2d nine titles) recorded in the ledger and batch-followup.tsv"
affects: [05-12 PR D finish, 05-13 PR D landing]

actuals:
  tokens: 60000
  tasks: 3
  commits: 4

# commits: measured on the working branch from plan_head_before (git rev-list --count 0222cfd..9760693 is 4:
# aa7ec75, 38454d3, 99503a5, 9760693, the four ledger/scan commits). The close-out commit `docs: complete plan 05-11`
# follows this file. The code commits live on refactor/drop-spec-citations (now squash-merged); the follow-up
# sweep added aaed732 and 33baf2d there. tokens is an estimate: the code diff is comments and titles only, the
# new files here are the ledger text, batch-followup.tsv and the jscpd report.
plan_head_before: 0222cfd
plan_head_after: 9760693

tech-stack:
  added: []
  patterns:
    - "Owner-only squash merge, then main CI polled on the merge SHA and recorded next to the PR's own CI"
    - "Second comment-only sweep with a wider vocabulary than cit-rx.txt (bare document names, wrapped names, screen and rule numbers)"

key-files:
  created:
    - .planning/cleanup/text-sync/batch-followup.tsv
    - .planning/cleanup/jscpd/phase5-05-11/jscpd-report.json
  modified:
    - .planning/cleanup/TEXT-SYNC-LEDGER.md

key-decisions:
  - "The nine titles that named a retired document in bare words and the 43 comment sites outside cit-rx.txt were fixed in PR C at the owner's request (aaed732, 33baf2d), not left for PR D"
  - "Journey N labels in the E2E suite are reported, not edited: they double as the suite's own names and sit in test titles"
  - "No Kong recreate after the merge: docker/kong.yml parses to the same configuration"

patterns-established:
  - "A comment-only vocabulary regex undercounts; sweep bare names and wrapped names after the batches"

requirements-completed: []

duration: about 1h wall time on 2026-10-22 (PR C open 01:25 UTC, merged 02:01, main CI done 02:13)
completed: 2026-10-22
status: complete
---

# Phase 5 Plan 11: PR C landing Summary

**PR C (#28) is merged: 454 code files lost their retired-spec citations (comments, config comments, three fixture paragraphs and 54 test titles), every change proven by a check suited to its kind, migrations untouched, and `main`'s CI on the squash commit `9fdc9c9` is six of six green.**

## Performance

- **Duration:** about 1h wall time on 2026-10-22 (whole-range proof, PR C opened, follow-up sweep, owner merge at 02:01:12Z, main CI complete at 02:12:30Z)
- **Completed:** 2026-10-22
- **Tasks:** 3 (tracer, auto, owner-merge checkpoint)
- **Files modified:** ledger, `batch-followup.tsv` and the jscpd scan on the working branch; 454 code files outside `.planning/` in the PR

## Accomplishments

- **Task 1 (tracer): whole range proven.** From `base=708c714` in `../hearth-citations`: `comment-only-check.mjs --base 708c714 --head 96fb846~1` printed `OK 429 files (14 non-TS skipped)`; the title commit with `--titles` printed `OK 28 files`; `nonts-comment-check.mjs --html` printed `OK 14 files`. The range holds 14 non-merge code commits, all recorded in batch rows (`range-commits=14`). Post-condition (D-21): the citation inventory over the tree minus README and `.claude` has no rows; migrations hold 17 citation lines in 8 files and are identical to the phase base; `left-for-pr-d=4`. Local gates (frozen install, lint, format, typecheck, test, build, commitlint) all `exit=0`; test counts equal those taken at `base=` (matching 156, shared 172, recurrence 77, service 757, web 728, e2e support 15); `after-c-clones=66` (identical to `final-b-clones`, under the 96 limit). `pr-c-ready=2ae102e`.
- **Task 2: PR C opened and green.** PR #28 (`refactor/drop-spec-citations` into `main`), 454 files outside `.planning/` and none under `supabase/migrations/`, `docs/`, `.github/`, README or `.claude/`. First head `e1997a7`: CI run 39705754497, six green. Spec 13 passed in both themes (`pr-c-e2e-13=passed`, E2E `104 passed (8.7m)`). Integration `1190 passed` on the PR run and on `main`'s earlier green run (`pr-c-integration-tests=1190`, `main-integration-tests-c=1190`).
- **Follow-up sweep, at the owner's request after the PR opened.** `aaed732` (`refactor: drop remaining spec references from comments`): 37 files, 43 comment sites, `comment-only-check.mjs` `OK 37 files`. `33baf2d` (`test: restate nine test titles that named a retired document`): 8 files, 9 titles, `--titles` `OK 8 files` and without `--titles` `FAILED 8 of 8 files`. Whole range to `33baf2d` with `--titles`: `OK 448 files (14 non-TS skipped)`. Counts unchanged afterwards (integration list 382 lines, Playwright `Total: 104 tests in 19 files`). The head became `0ce37f6` after merging the working branch (plain push, no force), CI run 39707916284, six green. Table of the nine new titles is in the ledger.
- **Task 3: owner merge and main CI.** The owner squash-merged PR #28 as `9fdc9c910410d5e0bcdd5ff6472bb7f3cff75423` (`merged_at` 2026-10-22T02:01:12Z; title `refactor: remove retired spec citations from code`). `pr-c-merged=9fdc9c9...` is in the ledger. `CI` on `main` for that SHA (run 39709025122, `push`, one attempt, no rerun) concluded `success` in all six jobs: lint, typecheck, test-unit, test-integration, test-e2e (finished 02:12:30Z), build. `Deploy` run 39710099843 was `pending` at the last poll (waits for the self-hosted runner, as after PR A and PR B).

## Task Commits

Code commits for PR C (on `refactor/drop-spec-citations`, squash-merged as `9fdc9c9`) are listed per batch in `TEXT-SYNC-LEDGER.md`. This plan added:

1. **Task 1: whole-range proof, post-condition, clone count** - `aa7ec75` (docs)
2. **Task 2: PR C opened, six green jobs** - `38454d3` (docs)
3. **Follow-up sweep recorded** - `99503a5` (docs); follow-up head and CI - `9760693` (docs)
4. **Task 3: merge and main CI** - recorded in the close-out commit below
   Follow-up code commits on the PR C branch: `aaed732`, `33baf2d`.

**Plan metadata:** the `docs: complete plan 05-11` commit that carries this file, `STATE.md`, `ROADMAP.md` and the ledger.

## Files Created/Modified

- `.planning/cleanup/TEXT-SYNC-LEDGER.md` - whole-range proofs, Retained, Follow-up sweep, CI, Merge and CI on main
- `.planning/cleanup/text-sync/batch-followup.tsv` - one row per changed hunk of the sweep, plus reported and not-a-citation rows
- `.planning/cleanup/jscpd/phase5-05-11/jscpd-report.json` - the clone scan after PR C (66 clones, 858 lines, 1.11 percent)

## Left for the owner (ambiguous, reported not edited)

From the ledger's "Follow-up sweep" section:

- `Journey N` labels in the E2E suite (34 lines: spec header comments, `test.describe` titles such as `journey 9 - switch household`, the `u4-journey5` screenshot folder, `e2e-seed.sql`, `docker-compose.e2e.yml`). The numbers came from a retired use-case list, but the suite also uses them as its own names and they sit in test titles.
- `Phase N` mentions (29 lines) name the app's build phases (research A10); unchanged.
- `bills.integration.test.ts:533` names a requirement id (`TIME-05`) from the planning records.
- `meal-components.test.tsx:32` title ends `(Accessibility)`; read as the topic, not a citation.
- `kong-routes.test.ts:6` has a stray space in `08-caddy-refuses-gotrue-endpoints .spec.ts`; not a citation.
- Wording the owner may want to look at: `services/bills.ts` `updateBillPayment` ("(autopay-logged ones included)") and `services/subscriptions.ts` `monthlyCents` (lists the conversion factors), both rewritten because the cited spec text could not be recovered.
- Not citations (left alone): `CONTRIBUTING.md` and `docs/testing.md` pointers, `Dashboard slate`, `contrast requirements`, `primary design target`, `by design`, `Seed data:` fixture labels.

## Open README pointers for PR D (05-12, 05-13)

- `left-for-pr-d=4`: `README.md` lines 69, 121 and 146, and `.claude/CLAUDE.md` line 232 (plus the maps behind that file, regenerated in 05-12).
- `.env.example:9` (`README, "Deployment"`) and `docker/docker-compose.yml:275` (`README, "Restore"`) point into the README; PR D rewrites the README, so check these headings still exist, and fix the comment on a later code change if not.
- RED-04 and the roadmap's "262" wording get the recorded count (1,116 lines in 456 files at `base=`) in 05-12; RED-04 completes with PR D.

## Decisions Made

- The follow-up sweep stayed inside PR C (owner request), because the plan's vocabulary regex missed bare document names, names wrapped over two lines and screen or rule numbers; the sweep used a wider search and the same comment-only proof.
- Journey labels are reported, not renamed (see above).
- `requirements-completed` is empty by plan: RED-04 completes when PR D removes the README and `.claude/CLAUDE.md` sites.

## Deviations from Plan

### Auto-fixed Issues

None - the tracer, PR and merge steps ran as written. Two scope additions came from the owner, not from deviation rules:

- **Owner request: follow-up sweep and nine titles** - after PR C opened, the owner asked for the nine bare-word titles and a broader sweep; both are recorded above with their proofs. The PR gained two commits and a second CI run (39707916284) before the merge.
- **Ledger note: the plan's `nonts-comment-check.mjs` command without a pathspec exclusion cannot print OK** (it rejects `.ts`, `.tsx`, `.mjs` and `.js` as an unknown type); the proof used `':(exclude,glob)**/*.ts'` and similar and printed `OK 14 files`.

**Total deviations:** 0 auto-fixed
**Impact on plan:** none beyond the owner's follow-up work.

## Issues Encountered

- No registry flake and no rerun: the PR runs and the `main` run each passed on the first attempt.
- The remote branch `refactor/drop-spec-citations` no longer exists on `origin` after the merge (deleted by the owner or by GitHub's branch cleanup; this plan did not delete it).

## Known Stubs

None. This plan changed comments, test titles and planning records only.

## Threat Flags

None. No endpoint, auth path, file access or schema surface was added; `supabase/migrations/` is byte-identical to the phase base.

## User Setup Required

None - no external service configuration required. No Kong recreate is needed (`kong-yaml-equal=yes`).

## Next Phase Readiness

- 05-12 (PR D finish) may start: PR C is merged (`9fdc9c9`), and the working branch needs the sync with `origin/main` (phase rule 7) before it.
- `Deploy` for the PR C merge was still pending on the self-hosted runner when `main` CI finished.

---
*Phase: 05-redundancy-reduction-and-text-sync*
*Completed: 2026-10-22*
