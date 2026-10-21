---
gsd_state_version: "1.0"
current_phase: 05
current_phase_name: Redundancy Reduction and Text Sync
status: executing
stopped_at: Completed 05-08-PLAN.md
last_updated: "2026-10-21T20:34:56.686Z"
last_activity: 2026-10-21
last_activity_desc: Phase 05 execution started
state_head: b8a4111b77c7cb1a6f5585fb713a321216fe607a
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 44
  completed_plans: 39
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** The owner can start a manual review from a lean, trustworthy base: no dead code or stray generated files, a CI suite that passes repeatably regardless of day or timezone, and the known bugs fixed with regression tests.
**Current focus:** Phase 05 — Redundancy Reduction and Text Sync

## Current Position

Phase: 05 (Redundancy Reduction and Text Sync) — EXECUTING
Plan: 8 of 13 complete (05-01 to 05-08); next 05-09 (PR C: apps/web comments), then 05-10 (non-TS files and titles)
Status: Ready to execute
Last activity: 2026-10-21 — Plan 05-08 complete (docs checker and audit; PR D branch docs/sync-specs at 158fd52, not yet a pull request)

Progress: [███████░░░] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 33
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 9 | - | - |
| 3 | 9 | - | - |
| 4 | 8 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 11min | 3 tasks | 15 files |
| Phase 01 P02 | 11min | 2 tasks | 2 files |
| Phase 01 P03 | 14min | 2 tasks | 2 files |
| Phase 01 P04 | 15min | 3 tasks | 1 files |
| Phase 01 P05 | ~35min | 3 tasks | 2 files |
| Phase 03 P03 | 1h | 3 tasks | 6 files |
| Phase 3 P04 | 30min | 2 tasks | 3 files |
| Phase 03 P05 | 25min | 3 tasks | 12 files |
| Phase 03 P06 | 30min | 2 tasks | 3 files |
| Phase 03 P07 | resumed | 3 tasks | 1 files |
| Phase 03 P08 | resumed session | 3 tasks | 1 files |
| Phase 03 P09 | 2 sessions | 2 tasks | 5 files |
| Phase 04 P01 | 12min | 3 tasks | 6 files |
| Phase 04 P03 | 10min | 2 tasks | 5 files |
| Phase 04 P05 | 10min | 3 tasks | 7 files |
| Phase 04 P02 | 51min | 3 tasks | 2 files |
| Phase 04 P06 | 8min | 2 tasks | 7 files |
| Phase 04 P04-04 | 31min | 3 tasks | 1 files |
| Phase 04 P07 | 1h 15m | 3 tasks | 1 files |
| Phase 04 P08 | 1h | 2 tasks | 6 files |
| Phase 05 P02 | 15min | 3 tasks | 17 files |
| Phase 05 P01 | ~45min | 3 tasks | 13 files |
| Phase 05 P04 | 35min | 3 tasks | 24 files |
| Phase 5 P03 | 1h | 2 tasks | 2 files |
| Phase 05 P05 | 1h45m | 3 tasks | 5 files |
| Phase 05 P06 | 30min | 3 tasks | 82 files |
| Phase 05 P07 | about 35min | 3 tasks | 144 files |
| Phase 05 P08 | about 20min | 3 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Git curation and push come first because every merge to `main` deploys (only `docs/` is exempt)
- [Roadmap]: Determinism precedes removal so failures are attributable; enforcement is last so `main` is never red
- [Roadmap]: Never rename the `CI` workflow or its job ids; `deploy.yml` fires on the workflow named `CI`
- [Phase 01]: Gate 1 approved (approve-personal): 43 product commits + 1 policy commit; publish alex.c.tanton@gmail.com as author/committer email via identity-rewrite pass in plan 01-02; stale spec references kept
- [Phase 01]: bee9a62 stays a plain pick: multi-scope header test(shared,matching) passes commitlint, scope-enum negative control fails
- [Phase 01]: Plan 01-02: curated-main rebuilt (43 commits, tip 9dd6668) plus policy commit 83eae2c; identity rewritten to alex.c.tanton@gmail.com; use curated-main/83eae2c, not pre-identity 3c1dcea
- [Phase 01]: Plan 01-03: curated tip 83eae2c841ab8de096d52990f8f3be3f4379c448 proven (43 PASS + 1 SKIP via rebase --exec, mode/CRLF/secret scans clean); plans 01-04 and 01-05 push only this SHA
- [Phase 01]: Plan 01-04: Gate 2 approved (approve-gate-2); 83eae2c pushed to origin/curated-main only (new branch, no force); origin/main still 7da55e3; PR #1 opened (not merged), CI results recorded (see next entry)
- [Phase 01]: Plan 01-04: PR #1 CI on tip 83eae2c: lint, typecheck, build, test-integration pass; test-unit fails (favorites.test.tsx as-of 4:00 AM vs 8:00 AM, 4h offset, analyst reading: UTC vs America/New_York, Phase 2 class) and test-e2e fails (registry toomanyrequests, no Playwright test ran); both in content identical to b96ca32; owner decides at Gate 3 (accept or re-run e2e first)

- [Phase 01]: Plan 01-05: candidate tip changed after Gate 2 to d3da748223fb85432fc06defaa25ac00ac4ed258 (83eae2c plus a ci.yml-only pre-pull commit); pushed fast-forward to origin/curated-main; PR #1 CI: lint, typecheck, test-integration, test-e2e (102/102), build pass; test-unit fails on the one known timezone web test (Phase 2 TIME-01 class, unproven)
- [Phase 01]: Plan 01-05: Gate 3 recorded as push-main-accept-red for d3da748 (owner reply approve-gate-3, 2026-10-12, red job test-unit). First push rejected by ruleset "Main PR Enforcement" (GH013); owner changed the ruleset and re-confirmed ("A done, re-confirm gate 3"); second plain push succeeded: origin/main 7da55e3..d3da748, PR #1 marked MERGED by GitHub; local main moved without disturbing .planning/ and .claude/; GIT-01..04 complete
- [Phase 2]: Development moved to Claude Code cloud sessions. `.planning/` and `.claude/CLAUDE.md` are tracked on `main` (`commit_docs: true`); the plans run on Linux against `.planning/environment/cloud-setup.sh`, with Docker optional (no Docker: integration and E2E evidence comes from PR CI). Work branches `test/deterministic-clock` and `chore/knip-config` are backup-pushed after each plan with no PR; PRs open only at 02-08's gate (or 02-04's early-CI draft). Raw logs under `.planning/cleanup/logs/` are gitignored and never committed.
- [Phase 2]: Clock pin is a subclass-safe `Date`, not `vi.setSystemTime` (it breaks `@date-fns/tz` in negative-offset zones); PR #8 later made suite-level overrides survive and covered the pin with 167 harness tests run by `pnpm test`
- [Phase 2]: Owner decisions after verification (D-13 to D-18 in 02-CONTEXT.md): Phase 5 uses the test-inclusive jscpd baseline; weekend E2E run deferred; vitest declared at the root; fuzzy benchmark deleted; packages are internal; the jobs barrel keeps its test
- [Phase 03]: A2=remove honored: 18 unused z.infer aliases removed from packages/shared, schemas kept
- [Phase 03]: Plan 03-07: gate-pr2=approve; PR 2 (#13) opened at head 5f5b090 with six green CI jobs (test-e2e passed on attempt 3 after two ECR toomanyrequests re-runs); awaiting the owner's squash merge
- [Phase 03]: Plan 03-09: final-tree proof on 9819e7c (knip default 1, production 28, nonode 1); knip-summary kept reported; DEAD-05 complete per OQ1=accept and local db:types evidence (permanent check Phase 6 CI-03); main test-e2e red on 51c077e and aefe63a (registry flake, owner-accepted, not re-run), green on 9819e7c after one re-run
- [Phase 04]: Plan 04-01: FIX-01 held-id map keyed by list and deal (d4b01b2); FIX-04 drag handle as a draggable button with a role=presentation drop row, no eslint-disable (f1e16fd); FIX-02 tests on fix/list-adds-rotation (1571f07), per-list advisory lock one commit ahead on fix/list-adds-lock (2e357e5). Red/green in FIX-LEDGER-WEB.md; FIX-02 red/green pending PR 1 CI (04-02)
- [Phase 04]: Plan 04-03: test/guard-tests (72b0668) holds the FIX-05 28-probe fence test (audit 0 violations, 4 mutations killed with 15/10/2/17 failures) and the FIX-03 registry-driven PATCH guard (autopay mutation killed); tests, harness wiring and docs only, no PR yet (04-04)
- [Phase 04]: 04-05: PGPASSWORD prefix assignment with a password-free URL (T-04-13 accepted, D-09); Kong probes ship before the Kong fix; yaml@2.9.1 approved by the owner, installed by 04-06
- [Phase 04]: 04-02: PR 1 (#15) opened with owner gate approve; FIX-02 red/green recorded from CI; test-e2e passed on attempt 2 after one owner-approved re-run of an unrelated attempt-1 failure
- [Phase 04]: 04-06: Kong GoTrue is an allowlist at format 3.0 (verify, token, logout, user, otp, admin/users, denied); guarded by a Vitest test in apps/service using yaml 2.9.1; kong config parse skipped (no Docker); a kong.yml change needs a manual force-recreate of kong on the host
- [Phase 04]: 04-04: PR 2 (#16) opened only after gate-pr2=approve was committed; six CI jobs green on first run, nothing merged
- [Phase 04]: 04-07: PR 3 (#18) open at 7c0efdc with six green jobs; FIX-07 red from run 39457296052 job 118753127163 (34 unrefused); E2E flakes outside spec 08 re-run; no probe dropped; awaiting the owner's squash merge and the Kong recreate
- [Phase 05]: Plan 05-02: service fixtures consolidated on test/shared-fixtures-wip (053f371): stack-hooks.ts and job-logger.ts, jscpd 99 -> 87 clones, service unit 757 = 757; readiness, deals and recipes keep their own hooks; 3 service pairs kept with reasons in FIXTURE-LEDGER.md; no PR opened
- [Phase 05]: Plan 05-01: PR A content is on origin as ci/setup-action (43672635, tree fd704a4c); composite setup action keeps checkout in each job (D-12 deviation, ledger row for PR A body); seed typechecked once; GitHub refused the token push (no workflow scope) so the owner pushed via apply.sh (Windows Git Bash needs MSYS_NO_PATHCONV=1); working branch is claude/eloquent-mayer-szjtjf, not the plan's claude/vigilant-gates-a4ihid
- [Phase 05]: Plan 05-04: web fixtures consolidated on test/shared-fixtures-wip (8a7e8e4): browser.ts, WithQueue, stubFetch, dealScreenHandlers, emptyDealSearch; jscpd 87 -> 66 clones, web 728 = 728; 14 pairs kept with reasons in FIXTURE-LEDGER.md (hoisted viewer-zone blocks, retry assertions, variant hooks); no PR opened
- [Phase 05]: Plan 05-05: WB synced past PR A by one ordinary merge (no workflow-scope refusal); PR B (#27) opened from test/shared-fixtures with six green jobs, jscpd 96 -> 66 clones, integration tests 1190 = main; owner squash-merged as a660d58, main CI green
- [Phase 05]: Plan 05-08: docs/sync-specs (158fd52) holds the seven specs and README audited against the code; docs-claims-check.mjs 582 tokens, 0 misses with a 34-token reasoned allowlist; hearth-admin documented as a hand-written shell wrapper; Kong routes, held deal-add id, per-list add-to-list lock and coverage setup stated as they are; README retired-spec citations removed; 14-row behavioral sample in DOCS-AUDIT-LEDGER.md; PR D opens in 05-13

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3]: Main CI gap: `test-e2e` is red on the main runs for 51c077e (PR 1) and aefe63a (PR 2) from the registry pre-pull flake; the owner chose not to re-run them so Deploy does not pick up superseded commits (each PR's own CI was green on an identical tree). 9819e7c is green after one re-run; `17-accessibility-states.spec.ts:527` and `19-notifications.spec.ts:141` flaked once there (look at them in Phase 6)
- [Phase 3]: DEAD-05 is marked complete on the owner-authorized local Docker run (`pnpm db:types` twice, both equal to the committed file; `pnpm db:seed` exit 0), not CI; the permanent drift check is Phase 6 CI-03
- [Phase 3]: `knip:production` reports `scripts/knip-summary.mjs` as a files line (owner decision keep-reported); revisit with Phase 6 CI-01, together with the `**/test/**` hidden-entry blind spot of the committed knip config
- [Phase 1]: The "Main PR Enforcement" ruleset (id 23693495) was changed by the owner to permit the main push (the API now returns 404 for it, so it appears deleted rather than disabled). Nothing is enforced on main now; if it is re-created, a required check plus the red test-unit (favorites.test.tsx timezone test, Phase 2 TIME-01 class) will block PRs. CONTRIBUTING.md says branch protection is not configured; reconcile in Phase 6. Owner may cancel a queued Deploy run and delete origin/curated-main.
- [Phase 3]: Three of the six proven-dead rows in `.planning/cleanup/TRIAGE.md` (`currentWeekFixture`, `emptyWeekFixture`, `previousWeekFixture` in `apps/web/src/test/meal-fixtures.ts`) no longer appear in a fresh `pnpm knip` run: the root `test:harness` script (PR #8) makes knip's Node plugin treat `test/**` files as entries, so a fresh default run gives 54 findings (recorded: 59) and 79 production (recorded: 80). Re-establish the tool evidence for those three before deleting anything; decide whether `knip.json` should stop that side effect
- [Phase 3]: `../hearth-aside/bin/knip-summary.mjs` (outside the repo) normalizes the knip reports and is cited by TRIAGE.md; it is lost with the cloud container unless committed
- [Phase 2]: TIME-03's weekend E2E confirmation is deferred by the owner; CI `test-e2e` has run on one calendar day only
- [Phase 2]: The second code review (02-REVIEW-FIXES.md, of PR #8's code) has 0 critical, 6 warnings and 6 infos, all open; the owner has not yet decided whether to fix them
- [Phase 6]: `main` has no branch protection and the Deploy job waits on an unregistered self-hosted runner; Dependabot PR #9 (29 npm updates) failed CI on 2026-10-16 and security alert dependabot/1 is unexamined
- [Phase 4]: The offline-duplicate root cause is unproven; reproduce `useAddDealToList` (client id minted inside `mutationFn`) before fixing.
- [Phase 6]: `db:types` determinism is unverified (run twice before gating); `braces` advisory has no upstream patch; web coverage thresholds need an enforce-or-remove decision.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261020-v7v | Fix WR-02: hold the deal-add item id at QueryClient scope (branch fix/held-deal-id, pushed, no PR, awaiting the owner's merge) | 2026-10-20 | c69569a | [261020-v7v-fix-wr-02-held-deal-add-id-at-queryclien](./quick/261020-v7v-fix-wr-02-held-deal-add-id-at-queryclien/) |
| 261020-wnk | CI: pull the Supabase E2E images from GHCR first with ECR fallback, plus GHCR and optional Docker Hub logins (branch ci/pull-supabase-from-ghcr, 2 local commits, NOT pushed: token lacks workflow scope; no PR) | 2026-10-20 | d25d8e6 | [261020-wnk-make-ci-image-pulls-robust-against-regis](./quick/261020-wnk-make-ci-image-pulls-robust-against-regis/) |
| 3 | Document the cloud-sandbox CA workaround for running e2e (.claude/CLAUDE.md, branch claude/admiring-cerf-5q7am1, not pushed) | 2026-10-21 | 0a9d89d | — |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-21T20:34:56.562Z
Stopped at: Completed 05-08-PLAN.md (paused by the owner before 05-09)
Resume file: None

### Resume point for Phase 5 (paused after 05-08, 2026-10-21)

Resume with `/gsd-execute-phase 5`. Plans 05-01 to 05-08 have SUMMARYs; 05-09 to 05-13 remain.

Working branch (WB) for all `.planning/` state: `claude/eloquent-mayer-szjtjf` (the plans name `claude/vigilant-gates-a4ihid`, which never existed). Pushed, tip `5d7c32e`; always read the newest STATE from `origin` of this branch.

Merged to `main`: PR A #26 (`ac8ef34`, RED-01/02) and PR B #27 (`a660d58`, RED-03); main CI green on both. The deploy runs for those merges were pending on the self-hosted runner.

Unmerged work, all pushed (no PR opened for either):

| Branch | Worktree | Tip | Holds | PR |
|--------|----------|-----|-------|----|
| `refactor/drop-spec-citations` | `/home/user/hearth-citations` | `da58b20` | PR C so far: recurrence, matching, shared, seed-ts, e2e, service batches; 15 service test titles left for 05-10 | opened and landed by 05-11 |
| `docs/sync-specs` | `/home/user/hearth-docs-sync` | `158fd52` | PR D so far: docs claims checker output, `docs/*.md` and `README.md` fixes | opened by 05-13 |

Before pushing either branch again, run `git merge --no-edit claude/eloquent-mayer-szjtjf` in its worktree (D-04). `test/shared-fixtures-wip` is a redundant backup (its content is merged via PR B). Worktrees are local to the container that ran this session; recreate with `git worktree add <path> <branch>` from `origin` if they are gone.

Next, in order: 05-09 (PR C, `apps/web` comments, about 476 lines), 05-10 (non-TS files, root configs, 46 test titles; also decide the 3 root config lines in `commitlint.config.js` and `eslint.config.js`), 05-11 (open and land PR C: owner merge), 05-12 (finish PR D: sync, maps, `.claude/CLAUDE.md`), 05-13 (land PR D and close the phase: owner merge).

Open items for the owner: squash-merges of PR C and PR D; journey 7 e2e test (`e2e/tests/18-chores-and-errands-offline.spec.ts:140`) flaked once on `main` and passed on one approved rerun; if a PR touches `.github/workflows` and GitHub refuses for the `workflow` scope, use the `apply.sh` hand-off with `export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'` on Windows Git Bash and a save-to-file invocation.

### Start-up checklist and standing rules for the next session (read before dispatching executors)

Start-up, in order:
1. You must be on `claude/eloquent-mayer-szjtjf` at tip `origin/claude/eloquent-mayer-szjtjf` (`git fetch origin && git status -sb`). `main` carries only the older `.planning/` state, so do not read STATE from it.
2. Run `/gsd-execute-phase 5`. Expected: 8 of 13 plans have SUMMARYs, 05-09 is ready (wave 6), and `blocked_by` is empty. The first dispatch is 05-09.
3. Recreate the PR C worktree before 05-09 (the old ones lived in a previous container): `git fetch origin && git worktree add /home/user/hearth-citations refactor/drop-spec-citations` (if the branch is not checked out locally, `git worktree add -b refactor/drop-spec-citations /home/user/hearth-citations origin/refactor/drop-spec-citations`). For PR D later: `git worktree add -b docs/sync-specs /home/user/hearth-docs-sync origin/docs/sync-specs`. Use the same paths the plans and ledgers name. Tip check after adding: `refactor/drop-spec-citations` = `da58b20`, `docs/sync-specs` = `158fd52`.
4. `config.json` has `workflow.use_worktrees: false`, so executors run one at a time on the primary checkout, with code branches in separate `git worktree` directories as above. Do not run two executors at once: they all commit to this branch.

Corrections to the plan text:
- Every plan names the working branch (WB) `claude/vigilant-gates-a4ihid`. That branch never existed. WB is `claude/eloquent-mayer-szjtjf` everywhere (plan files, ledgers and commands). Tell executors this in the dispatch prompt.
- `.planning/` files go in the PRs (D-04), so each of `refactor/drop-spec-citations` and `docs/sync-specs` needs `git merge --no-edit claude/eloquent-mayer-szjtjf` run in its worktree before every push.

Environment rules that earlier executors followed:
- Use Node 24: `export PATH=/opt/node-v24/bin:$PATH` (default `node` there was 22.22; `/opt/node-v24/bin/node` is 24.21.0). Re-check it exists in a new container; otherwise install Node 24 per `.nvmrc`.
- Commitlint (`commitlint.config.js`) allows scopes `web, service, shared, recurrence, matching, db, e2e, docker` or no scope; subjects must stay within the repo's length rule (keep to 71 characters or fewer). Never use `--no-verify`. Husky runs typecheck and lint-staged on every commit.
- Commit planning files path-limited (`git commit -- <paths>`), then check the file mode of any script (`git ls-tree`); path-limited commits reset the executable bit, so run `git update-index --chmod=+x` first for scripts.
- Leave the untracked `.planning/milestone.lock` alone (add `.planning/milestone.lock` to `.git/info/exclude` if the stop hook complains).
- `GH_TOKEN` is passed through the environment for the session and is never written to a file, log or commit. It lacks the `workflow` scope, so pushes that add or change `.github/workflows/*` fail; use the D-22 hand-off (patches under `.planning/cleanup/patches/` plus an `apply.sh` for the owner). PR C and PR D should touch no workflow files, so none is expected.
- Never rerun a CI job without the owner's explicit OK (registry `toomanyrequests` flakes are the only allowed exception, up to the number the plan states). A red job that is not a registry flake becomes a decision for the owner.
- Never force-push, never merge a PR (the owner squash-merges), and never add files under `docs/` beyond editing the seven existing specs.

Comment-only proof tooling for PR C (`.planning/cleanup/tools/`):
- `citation-inventory.mjs` (modes `inventory`, `apply-pure`, `queue`), `comment-only-check.mjs` (compiler-print comparison, `--titles` mode, directive guard), `comment-only-controls.sh` (six self-checks).
- In the controls output, controls 3, 4 and 6 are negative controls, so `FAIL FAIL` is the correct result for them. Controls 1, 2 and 5 must print `OK OK`.
- Ledger: `.planning/cleanup/TEXT-SYNC-LEDGER.md`, with per-batch TSVs under `.planning/cleanup/text-sync/`. Citation recount at plan 05-06: 1,116 lines in 456 files (592 pure, 239 mixed, 240 prose, 45 titles); 340 service sites are done; 15 service test titles are deferred to 05-10.

Open decisions already known for later plans: three root config lines (`commitlint.config.js` once, `eslint.config.js` twice) match the citation vocabulary and are outside every plan's scope so far, so decide in 05-10 whether to include them (D-09 names "the two root JS configs", so they likely belong there). The knip tool reports `.planning/cleanup/tools/expand-compare.mjs` and `jscpd-compare.mjs` as unused files; Phase 6's CI-01 must account for them.

PR C wording the owner may want to look at when it opens: `services/bills.ts` `updateBillPayment` ("(autopay-logged ones included)") and `services/subscriptions.ts` `monthlyCents` (lists the conversion factors), both rewritten because the cited spec text could not be recovered.

