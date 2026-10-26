# v1.0 milestone archive

v1.0 was the Hearth cleanup and hardening milestone: six phases, 60 plans and 40 requirements, completed 2026-10-25. Phase 7 of v2.0 (CLEAN-01) moved its planning artifacts here so that `.planning/` holds only live material. Every file kept its history: `git log --follow <path>` reaches the pre-archive commits.

## Layout

| Path | Holds |
| --- | --- |
| `ROADMAP.md` | the v1.0 roadmap (was `.planning/milestones/v1.0-ROADMAP.md`) |
| `REQUIREMENTS.md` | the v1.0 requirements (was `.planning/milestones/v1.0-REQUIREMENTS.md`) |
| `phases/` | the six phase directories: `01-git-history-curation-and-branch-policy`, `02-baseline-net-stabilization-and-analysis`, `03-evidence-gated-removal`, `04-bug-fixes-with-regression-tests`, `05-redundancy-reduction-and-text-sync`, `06-ci-enforcement-and-lock-in` |
| `cleanup/` | ledgers, summaries, hand-written tools (`tools/`), hand-curated inventories (`text-sync/`), and raw outputs (`knip/`, `jscpd/`, `patches/`, one root `.patch`) |
| `quick/` | the two finished v1.0 quick tasks, `261020-v7v-...` and `261020-wnk-...` |

## Paths inside these files

The archived files were moved without editing, so they still cite the paths they had before the move. Read them with this mapping:

| Cited path | Archived at |
| --- | --- |
| `.planning/phases/0N-*` (N = 1 to 6) | `.planning/milestones/v1.0/phases/0N-*` |
| `.planning/cleanup/` | `.planning/milestones/v1.0/cleanup/` |
| `.planning/quick/` | `.planning/milestones/v1.0/quick/` |
| `.planning/milestones/v1.0-ROADMAP.md` | `.planning/milestones/v1.0/ROADMAP.md` |
| `.planning/milestones/v1.0-REQUIREMENTS.md` | `.planning/milestones/v1.0/REQUIREMENTS.md` |

- The move is the single rename-only commit `a0bf27b` (`chore: archive v1.0 phases, ledgers and quick tasks`): every path is `R100` with an unchanged mode.
- Raw logs that the ledgers cite under `.planning/cleanup/logs/` were never committed (they are gitignored), so they are not in this archive.
- The seven `.planning/codebase/` maps (ARCHITECTURE, CONCERNS, CONVENTIONS, INTEGRATIONS, STACK, STRUCTURE, TESTING) were deleted, not archived, in commit `f10ab38`. Read one with `git show f10ab38^:.planning/codebase/STACK.md`.

## Raw outputs

Rule: only a raw generated output that is regenerable and cited by no tracked planning file is deleted; anything cited, or any doubtful case, is kept and listed for the owner. A knip or jscpd output is regenerable by definition; a patch counts as regenerable only when every commit it carries exists in this repository with an identical `git patch-id --stable`. No patch met that test.

Result: 47 candidates, 47 kept, 0 deleted. Every candidate is cited by name, label or commit id by at least one tracked planning file. Always kept and not candidates: the Markdown ledgers and summaries at the `cleanup/` root, `tools/`, `text-sync/*.tsv` and `patches/*/apply.sh`.

Paths below are relative to `cleanup/`. Phase paths in the reasons are relative to `phases/`; `phaseN/` stands for the `0N-*` directory.

| Path | Class | Decision | Reason |
| --- | --- | --- | --- |
| `ci-pull-supabase-from-ghcr.patch` | patch | kept | only copy of commits 871ff4d and d25d8e6 (absent from this repository); cited by commit id in FIX-LEDGER-CI-PULL.md and the quick 261020-wnk summary |
| `jscpd/phase5-05-02-before/jscpd-report.json` | jscpd report, regenerable | kept | cited by FIXTURE-LEDGER.md, phase5/05-02-PLAN.md, phase5/05-02-SUMMARY.md, phase5/05-05-PLAN.md |
| `jscpd/phase5-05-02-t1/jscpd-report.json` | jscpd report, regenerable | kept | cited by FIXTURE-LEDGER.md, phase5/05-02-PLAN.md, phase5/05-02-SUMMARY.md |
| `jscpd/phase5-05-02-t2/jscpd-report.json` | jscpd report, regenerable | kept | cited by FIXTURE-LEDGER.md, phase5/05-02-PLAN.md, phase5/05-02-SUMMARY.md |
| `jscpd/phase5-05-02-t2a/jscpd-report.json` | jscpd report, regenerable | kept | cited by FIXTURE-LEDGER.md, phase5/05-02-PLAN.md, phase5/05-02-SUMMARY.md |
| `jscpd/phase5-05-02/jscpd-report.json` | jscpd report, regenerable | kept | cited by FIXTURE-LEDGER.md, phase5/05-01-PLAN.md, phase5/05-01-SUMMARY.md, phase5/05-02-PLAN.md |
| `jscpd/phase5-05-04-t1/jscpd-report.json` | jscpd report, regenerable | kept | cited by FIXTURE-LEDGER.md, phase5/05-04-PLAN.md, phase5/05-04-SUMMARY.md |
| `jscpd/phase5-05-04-t2/jscpd-report.json` | jscpd report, regenerable | kept | cited by FIXTURE-LEDGER.md, phase5/05-04-PLAN.md, phase5/05-04-SUMMARY.md |
| `jscpd/phase5-05-04/jscpd-report.json` | jscpd report, regenerable | kept | cited by FIXTURE-LEDGER.md, phase5/05-01-PLAN.md, phase5/05-01-SUMMARY.md, phase5/05-02-PLAN.md |
| `jscpd/phase5-05-05/jscpd-report.json` | jscpd report, regenerable | kept | cited by CI-SETUP-LEDGER.md, FIXTURE-LEDGER.md, phase5/05-01-PLAN.md, phase5/05-01-SUMMARY.md |
| `jscpd/phase5-05-11/jscpd-report.json` | jscpd report, regenerable | kept | cited by TEXT-SYNC-LEDGER.md, phase5/05-01-PLAN.md, phase5/05-02-PLAN.md, phase5/05-03-PLAN.md |
| `jscpd/phase5-05-13/jscpd-report.json` | jscpd report, regenerable | kept | cited by DOCS-AUDIT-LEDGER.md, ROADMAP.md, phase5/05-01-PLAN.md, phase5/05-01-SUMMARY.md |
| `jscpd/source-with-tests/jscpd-report.json` | jscpd report, regenerable | kept | cited by phase2/02-01-PLAN.md, phase2/02-02-PLAN.md, phase2/02-03-PLAN.md, phase2/02-04-PLAN.md |
| `jscpd/source/jscpd-report.json` | jscpd report, regenerable | kept | cited by phase2/02-01-PLAN.md, phase2/02-02-PLAN.md, phase2/02-03-PLAN.md, phase2/02-04-PLAN.md |
| `jscpd/whole-repo/jscpd-report.json` | jscpd report, regenerable | kept | cited by phase2/02-01-PLAN.md, phase2/02-02-PLAN.md, phase2/02-03-PLAN.md, phase2/02-04-PLAN.md |
| `knip/before-gap-fix-default-summary.txt` | knip output, regenerable | kept | cited by TRIAGE.md |
| `knip/before-gap-fix-production-summary.txt` | knip output, regenerable | kept | cited by TRIAGE.md |
| `knip/calibration-canary-default-summary.txt` | knip output, regenerable | kept | cited by REMOVAL-LEDGER.md, TRIAGE.md, phase2/02-06-PLAN.md, phase3/03-01-PLAN.md |
| `knip/calibration-canary-default.json` | knip output, regenerable | kept | cited by REMOVAL-LEDGER.md, TRIAGE.md, phase2/02-06-PLAN.md, phase3/03-01-PLAN.md |
| `knip/calibration-canary-production-summary.txt` | knip output, regenerable | kept | cited by REMOVAL-LEDGER.md, TRIAGE.md, phase2/02-06-PLAN.md, phase3/03-01-PLAN.md |
| `knip/calibration-canary-production.json` | knip output, regenerable | kept | cited by REMOVAL-LEDGER.md, TRIAGE.md, phase2/02-06-PLAN.md, phase3/03-01-PLAN.md |
| `knip/calibration-default-summary.txt` | knip output, regenerable | kept | cited by REMOVAL-LEDGER.md, TRIAGE.md, phase2/02-06-PLAN.md, phase3/03-01-PLAN.md |
| `knip/calibration-default.json` | knip output, regenerable | kept | cited by REMOVAL-LEDGER.md, TRIAGE.md, phase2/02-06-PLAN.md, phase3/03-01-PLAN.md |
| `knip/calibration-production-summary.txt` | knip output, regenerable | kept | cited by REMOVAL-LEDGER.md, TRIAGE.md, phase2/02-06-PLAN.md, phase3/03-01-PLAN.md |
| `knip/calibration-production.json` | knip output, regenerable | kept | cited by REMOVAL-LEDGER.md, TRIAGE.md, phase2/02-06-PLAN.md, phase3/03-01-PLAN.md |
| `knip/default-summary.txt` | knip output, regenerable | kept | cited by TRIAGE.md, phase2/02-01-PLAN.md, phase2/02-02-PLAN.md, phase2/02-03-PLAN.md |
| `knip/default.json` | knip output, regenerable | kept | cited by TRIAGE.md, phase2/02-01-PLAN.md, phase2/02-02-PLAN.md, phase2/02-03-PLAN.md |
| `knip/phase3-after-default-summary.txt` | knip output, regenerable | kept | cited by FIX-LEDGER-INFRA.md, phase3/03-09-PLAN.md, phase3/03-09-SUMMARY.md, phase4/04-02-PLAN.md |
| `knip/phase3-after-nonode-summary.txt` | knip output, regenerable | kept | cited by phase3/03-09-PLAN.md, phase3/03-09-SUMMARY.md |
| `knip/phase3-after-production-summary.txt` | knip output, regenerable | kept | cited by phase3/03-09-PLAN.md, phase3/03-09-SUMMARY.md, phase6/06-01-PLAN.md, phase6/06-01-SUMMARY.md |
| `knip/phase3-before-default-summary.txt` | knip output, regenerable | kept | cited by phase3/03-01-PLAN.md, phase3/03-07-PLAN.md, phase3/03-09-PLAN.md |
| `knip/phase3-before-nonode-summary.txt` | knip output, regenerable | kept | cited by phase3/03-01-PLAN.md |
| `knip/phase3-before-production-summary.txt` | knip output, regenerable | kept | cited by phase3/03-01-PLAN.md |
| `knip/phase3-pr2-default-summary.txt` | knip output, regenerable | kept | cited by phase3/03-07-PLAN.md, phase3/03-07-SUMMARY.md |
| `knip/phase3-pr2-nonode-summary.txt` | knip output, regenerable | kept | cited by phase3/03-07-PLAN.md, phase3/03-07-SUMMARY.md |
| `knip/phase3-pr2-production-summary.txt` | knip output, regenerable | kept | cited by phase3/03-07-PLAN.md, phase3/03-07-SUMMARY.md |
| `knip/production-summary.txt` | knip output, regenerable | kept | cited by TRIAGE.md, phase2/02-01-PLAN.md, phase2/02-02-PLAN.md, phase2/02-03-PLAN.md |
| `knip/production.json` | knip output, regenerable | kept | cited by TRIAGE.md, phase2/02-01-PLAN.md, phase2/02-02-PLAN.md, phase2/02-03-PLAN.md |
| `patches/ci-enforce-gates/0001-ci-add-a-hygiene-job-that-runs-the-repository-gates.patch` | patch | kept | cited by patches/ci-enforce-gates/apply.sh, phase6/06-06-PLAN.md, phase6/06-06-SUMMARY.md, phase6/06-07-SUMMARY.md |
| `patches/ci-enforce-gates/0002-test-web-raise-the-coverage-thresholds-to-the-measur.patch` | patch | kept | cited by patches/ci-enforce-gates/apply.sh, phase6/06-06-SUMMARY.md |
| `patches/ci-enforce-gates/0003-ci-enforce-web-coverage-db-types-drift-and-job-timeo.patch` | patch | kept | cited by patches/ci-enforce-gates/apply.sh, phase6/06-06-SUMMARY.md |
| `patches/ci-enforce-gates/0004-ci-run-the-date-and-time-zone-sweep-on-main-and-nigh.patch` | patch | kept | cited by patches/ci-enforce-gates/apply.sh, phase6/06-06-SUMMARY.md |
| `patches/ci-enforce-gates/0005-ci-gate-deploys-on-the-running-revision-and-keep-no-.patch` | patch | kept | cited by patches/ci-enforce-gates/apply.sh, phase6/06-06-SUMMARY.md |
| `patches/ci-enforce-gates/0006-docs-describe-the-CI-gates-the-sweep-workflow-and-th.patch` | patch | kept | cited by patches/ci-enforce-gates/apply.sh, phase6/06-07-SUMMARY.md |
| `patches/ci-setup-action/0001-ci-share-one-setup-action-across-the-six-CI-jobs.patch` | patch | kept | cited by patches/ci-setup-action/apply.sh, phase5/05-01-SUMMARY.md |
| `patches/ci-setup-action/0002-chore-typecheck-the-seed-workspace-only-once.patch` | patch | kept | cited by patches/ci-setup-action/apply.sh, phase5/05-01-SUMMARY.md |
| `patches/ci-setup-action/0003-ci-watch-the-setup-action-and-drop-two-spec-citation.patch` | patch | kept | cited by patches/ci-setup-action/apply.sh, phase5/05-01-SUMMARY.md |

## Owner review

Nothing in `cleanup/` was deleted, so there is nothing to restore. These are the candidates kept because they are cited, grouped for a later owner decision. The ones listed first in each group are cited only by phase plans and summaries, not by a ledger, so they are the weakest to keep.

Knip outputs (regenerable with `pnpm knip`; 23 files):

- Cited only by phase plans and summaries: `knip/phase3-after-nonode-summary.txt`, `knip/phase3-before-default-summary.txt`, `knip/phase3-before-nonode-summary.txt`, `knip/phase3-before-production-summary.txt`, `knip/phase3-pr2-default-summary.txt`, `knip/phase3-pr2-nonode-summary.txt`, `knip/phase3-pr2-production-summary.txt`, `knip/phase3-after-production-summary.txt`.
- Cited by a ledger: the other 15 (`before-gap-fix-*`, `calibration-*`, `calibration-canary-*`, `default*`, `production*`, `phase3-after-default-summary.txt`).

jscpd reports (regenerable with `pnpm jscpd`; 14 files):

- Cited only by phase 2 plans: `jscpd/source/jscpd-report.json`, `jscpd/source-with-tests/jscpd-report.json`, `jscpd/whole-repo/jscpd-report.json`.
- Cited by a ledger: the eleven `jscpd/phase5-*/jscpd-report.json` files.

Patches (10 files):

- `ci-pull-supabase-from-ghcr.patch` is the only copy of commits 871ff4d and d25d8e6, which this repository does not contain (the owner applied it with `git am`, which rewrote them as a3f55d4 and ebb9ff6). Keep it.
- The nine `patches/*/000N-*.patch` files are cited by their series' hand-written `apply.sh` and by phase summaries. None of their `From` commits exist in this repository and none has a matching `git patch-id --stable` among its commits, so they also fail the regenerable test.

Notes for the owner:

- GSD tooling (`history-digest`, `/gsd-cleanup`, `complete-milestone`) looks for `milestones/v1.0-phases/` and `milestones/v1.0-ROADMAP.md`. With the `milestones/v1.0/{phases,cleanup,quick,ROADMAP.md,REQUIREMENTS.md}` layout, `history-digest` no longer lists the v1.0 phases. This was accepted with the layout and not worked around.
- `.gitignore` keeps the `.planning/cleanup/logs/` rule, and `.planning/environment/CLOUD-ENVIRONMENT.md` keeps its matching sentence, so raw logs that a clone holds at that old path stay ignored.
- The five v1.0 research files in `.planning/research/` (ARCHITECTURE, FEATURES, PITFALLS, STACK, SUMMARY) still cite pre-archive paths. They stayed in place with the v2.0 research and could move into this archive if you want.
- Do not regenerate `.claude/CLAUDE.md` with GSD (`generate-claude-md`) until `/gsd-map-codebase` has rebuilt the maps: with `.planning/codebase/` gone it would rebuild the stack block from the v1.0 tooling research.
- GSD block-start markers in `.claude/CLAUDE.md` whose source is a deleted map. GSD owns these markers; phase 7 leaves them unchanged and exempts them by name from its active-reference scan. The deferred `/gsd-map-codebase` run after Phase 8 gives their sources back.
  - line 22: `<!-- GSD:stack-start source:codebase/STACK.md -->` (`GSD:stack-start source:codebase/STACK.md`)
  - line 173: `<!-- GSD:conventions-start source:CONVENTIONS.md -->`
  - line 290: `<!-- GSD:architecture-start source:ARCHITECTURE.md -->`
  - The other markers (`project-start` line 1, `skills-start` line 521, `workflow-start` line 528) do not name a deleted map.
