---
phase: 05-redundancy-reduction-and-text-sync
plan: 13
subsystem: docs
tags: [docs, pr-d, phase-close, ledger, ci, claude-md, codebase-maps]
status: complete

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-12: regenerated maps and .claude/CLAUDE.md, RED-04 restated, docs/sync-specs pushed"
provides:
  - "PR D (#29) squash-merged by the owner as a5c4384; origin/main carries the docs, README, maps and project instructions"
  - "REDUNDANCY-LEDGER.md: RED-01 to RED-05 with PR, squash commit, decisive evidence keys and Phase 6 hand-offs"
  - "Phase-close post-conditions recorded on the final main: citation inventory 0 rows, migrations identical to the phase base, docs 7 files, path checker 2662 tokens 0 misses"
affects: [phase 05 verification, 06 CI enforcement]

actuals:
  tokens: 45000
  tasks: 3
  commits: 7

# commits: measured on the working branch, git rev-list --count 9b0d1be..HEAD --first-parent is 7 at 0db4b1b:
# 6535a7a (index), 34db9f4, b9ae90f, 82324c0 (CLAUDE.md and maps restore), efc818c, 4be50fd, 0db4b1b (main sync).
# The close-out commit `docs: complete plan 05-13` follows this file. tokens is an estimate (chars/4 over
# the diff excluding the restored map and CLAUDE.md text, which came from an earlier owner request).
plan_head_before: 9b0d1be
plan_head_after: 0db4b1b

tech-stack:
  added: []
  patterns:
    - "Phase index ledger: one row per requirement naming its PR, squash commit and the ledger keys that hold the proof"
    - "A red CI job that is not a registry flake is recorded as an owner-approved exception only after a decision, never rerun on the executor's own authority"

key-files:
  created:
    - .planning/cleanup/REDUNDANCY-LEDGER.md
    - .planning/phases/05-redundancy-reduction-and-text-sync/05-13-SUMMARY.md
  modified:
    - .planning/cleanup/DOCS-AUDIT-LEDGER.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .claude/CLAUDE.md (docs/sync-specs, restored sections)
    - .planning/codebase/*.md (docs/sync-specs, restored sections)

key-decisions:
  - "The Anti-Patterns and Component Responsibilities material the regeneration dropped was restored at the owner's request, with 19 corrections recorded as restore-1 to restore-19"
  - "Attempts 1 and 2 of main CI on a5c4384 (test-e2e) are recorded as failures that were not registry flakes, and attempt 3 (run by the owner) as green; no code changed in response"

patterns-established:
  - "Restored generated content is checked claim by claim against the code before it goes back in, and each correction gets a ledger row"

requirements-completed: [RED-04, RED-05]

duration: 3 sessions
completed: 2026-10-22
---

# Phase 5 Plan 13: Land PR D and close the phase Summary

**PR D (#29) is squash-merged as `a5c4384` with the seven specs, README, regenerated maps and `.claude/CLAUDE.md` (its dropped Anti-Patterns and Component Responsibilities sections restored and corrected), main's CI is green on its third attempt after two non-registry test-e2e failures, and `REDUNDANCY-LEDGER.md` indexes the evidence for RED-01 to RED-05.**

## Performance

- **Duration:** 3 sessions (index and PR, CLAUDE.md restore, merge and close)
- **Completed:** 2026-10-22
- **Tasks:** 3 (Task 1 tracer, Task 2 PR D with six green jobs, Task 3 owner merge and close-out)

## Accomplishments

- Task 1: WB merged into `docs/sync-specs`; repo-wide post-conditions at the D head (`final-citations=0`, `migrations-untouched=yes`, `docs-files=7`, `final-claims-misses=0`, `final-clones=66` against 96); the phase index written (`6535a7a`); local gates green.
- Task 2: PR D (#29) opened with six green jobs on the first attempt for both heads (`166ae77` run 39712387383, `35a03ab` run 39716090446).
- Restored CLAUDE.md sections: on the owner's request the regenerated `.claude/CLAUDE.md` and the maps got back the Anti-Patterns (queries outside `withUserDb`, importing `privileged/`, isolation only in application code, duplicated schemas, hand-edited generated types) and the Component Responsibilities table (`82324c0`, `efc818c`; merged into D as `35a03ab`). Each restored claim was checked against the code; the corrections are `restore-1` to `restore-19` in `DOCS-AUDIT-LEDGER.md`. Examples: a bare query outside `withUserDb` fails (it does not run unscoped), JWT verification is HS256 with ES256 only for a JWKS-published key, `planBillMove` lives in `services/bills.ts`, the job list is four scheduled jobs with `refresh-plan.ts` a planner, the only CLI command is `reset-password`.
- Task 3: the owner merged PR D as `a5c43841a90b1ec3f98ea219b577b9100c2d712a`. Recorded `pr-d-merged=`, `main-ci-after-d=` and `phase-close-main=` (the same SHA, `origin/main`); post-conditions re-checked on it. RED-04 and RED-05 squash commits filled in `REDUNDANCY-LEDGER.md`.
- Follow-up sweep (PR C, merged earlier as `9fdc9c9`): comments `aaed732` (37 files, 43 sites) and nine bare-word test titles `33baf2d`; PR D finished the README and project-instruction citations. `Journey N` labels in the E2E suite were reported, not edited.

## Main CI after the merge: flake exception

Run 39718363858 on `a5c4384` took three attempts.

| Attempt | Result | Detail |
| --- | --- | --- |
| 1 | `test-e2e` failed | `19-notifications.spec.ts:140`, `expected /Oak Street/`; not a registry flake |
| 2 | `test-e2e` failed | `17-accessibility-states.spec.ts:497` (failed-save message never shown) and `:526` (no unchecked switch); 102 passed, 2 failed |
| 3 | all six jobs success | rerun performed by the owner |

The owner approved one rerun after attempt 1; this plan made it. When attempt 2 failed, I stopped for a decision, and the owner performed the third attempt themselves. Attempts 1 and 2 are recorded as owner-approved flake exceptions, not as red evidence, and nothing was changed or reverted. The three attempts ran from about 23:43 to 00:19 America/New_York; that the notification specs flake around local midnight is a hypothesis only, untested.

## Task Commits

1. **Task 1: tracer, post-conditions and phase index** - `6535a7a` (docs), D merge `166ae77`
2. **Task 2: PR D opened, six green jobs** - `34db9f4`, `b9ae90f` (docs); PR head `35a03ab`
3. **Task 3: merge, main CI, close-out** - `82324c0`, `efc818c`, `4be50fd` (restore and records), `0db4b1b` (sync with main), then `docs: complete plan 05-13`

## Files Created/Modified

- `.planning/cleanup/REDUNDANCY-LEDGER.md` - the phase index and Phase 6 hand-offs
- `.planning/cleanup/DOCS-AUDIT-LEDGER.md` - `pr-d=`, `pr-d-head=`, `pr-d-ci=`, `pr-d-merged=`, `main-ci-after-d=`, `phase-close-main=` and the Phase close section
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` - plan 13 of 13 complete

## Decisions Made

- Restore the dropped CLAUDE.md sections (owner request), correcting each claim first.
- Treat the attempt 1 and 2 test-e2e failures as owner-approved flake exceptions and not rerun beyond what the owner approved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan listed only docs, README and CLAUDE.md as PR D's files**
- **Found during:** Task 2
- **Issue:** the compose comment fix from 05-12 (`docker/docker-compose.yml`, comment only) is also in PR D.
- **Fix:** recorded in the ledger and the PR body; the PR file check accepts that one extra file.
- **Commit:** `29b9c6a` (docs/sync-specs)

### Owner requests

- The CLAUDE.md restore (above) changed PR D's head from `166ae77` to `35a03ab` and re-ran CI before the merge.
- Rule 8 allows reruns only for registry flakes; the attempt 1 rerun and the attempt 3 rerun were owner approvals, and attempt 2's failure was reported as a decision, not rerun.

## Known Stubs

None.

## Unresolved items for the owner

- Notification e2e tests flaked across three attempts on `a5c4384` (see above), and earlier at `17-accessibility-states.spec.ts:527` and `19-notifications.spec.ts:141`. The midnight America/New_York timing is a hypothesis.
- `Journey N` labels in the E2E suite, the `Phase N` mentions the follow-up sweep reported, and the requirement ID `TIME-05` were reported and not edited.
- Phase 6 hand-offs are in `REDUNDANCY-LEDGER.md` (knip entries for the proof tools, jscpd threshold, web coverage thresholds, the `workflow`-scope push constraint, CI-07).

## Threat Flags

None.

## Self-Check: PASSED

- `pr-d-merged=`, `main-ci-after-d=` and `phase-close-main=` present in `DOCS-AUDIT-LEDGER.md`; `REDUNDANCY-LEDGER.md` has no `pending` entries.
- Commits on WB found: 6535a7a, 34db9f4, b9ae90f, 82324c0, efc818c, 4be50fd, 0db4b1b. `a5c4384` is `origin/main`.
