---
phase: 04-bug-fixes-with-regression-tests
plan: 07
subsystem: infra-fixes
tags: [pull-request, ci, kong, gotrue, deploy-sh, playwright, fix-ledger]

requires:
  - phase: 04-bug-fixes-with-regression-tests
    provides: "fix/deploy-kong (FIX-06 and the Kong E2E probes, plan 04-05) and fix/kong-allowlist (the allowlist, the static test and yaml 2.9.1, plan 04-06), plus PR 2 merged as 7da1461 (plan 04-04)"
provides:
  - "PR 3 (#18, fix/deploy-kong into main, open and unmerged) at head 7c0efdc0855e002606fc2924d00b85dac101bf6a with all six CI jobs green"
  - "A CI-recorded red for FIX-07 on the old kong.yml (run 39457296052, job 118753127163, 34 unrefused combinations) and the green run on the allowlist (run 39460683347, job 118764870460)"
  - ".planning/cleanup/FIX-LEDGER-INFRA.md with pr2-merged, gate-pr3, pr3, pr3-head-red, fix07-e2e-red, pr3-head, pr3-ci, fix07-e2e-green, a4-dropped and the filled red and green cells"
affects: [04-08 (phase close: PR 3 merge check, FIX-LEDGER index, main CI, the owner's Kong host step)]

actuals:
  tokens: 9000
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "Red from PR CI: open the pull request at the head without the fix, take the failing job as the red, then fast-forward the continuation branch onto the PR branch with a plain push"
    - "A flaky E2E attempt does not count as red or as green: the red needs the target test failing and nothing else failing, and the re-run attempt is the evidence"

key-files:
  created:
    - .planning/phases/04-bug-fixes-with-regression-tests/04-07-SUMMARY.md
  modified:
    - .planning/cleanup/FIX-LEDGER-INFRA.md

key-decisions:
  - "PR 3 opened at fix/deploy-kong (old kong.yml) only after pr2-merged and the owner's gate-pr3=approve were in the ledger; the allowlist was fast-forwarded in only after the red job had concluded"
  - "Run A attempt 1 was not counted as the red because a test outside spec 08 (push reminder) also failed; attempt 2, which failed only the two spec 08 Kong tests, is the red"
  - "No probe spelling was dropped (a4-dropped=none): Caddy never answered a probe itself, so no extra commit was made"
  - "REQUIREMENTS.md marks FIX-03 and FIX-05 complete as the plan's <output> says; FIX-06 and FIX-07 stay Pending until the owner merges PR 3 (04-08 checks the merge)"

requirements-completed: [FIX-06, FIX-07]

plan_head_before: 1ec678a
plan_head_after: 7bc60bba1120780fa6e774d2f73cc7c973afec1d
commits: 8

duration: 1h 15m wall-clock (mostly the owner gate and CI waits)
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 07: PR 3 landing Summary

**PR 3 (#18) is open into `main` with a CI-recorded red for the Kong allowlist (34 GoTrue combinations unrefused on the old catch-all) and all six `CI` jobs green on the head that carries FIX-06 and the allowlist, waiting for the owner's squash merge and the Kong recreate on the host.**

## Performance

- **Duration:** about 1h 15m wall-clock on the working branch (first commit 16:04Z, last ledger commit 17:13Z), most of it the owner gate and CI waits
- **Completed:** 2026-10-20
- **Tasks:** 3 (sync and local proof, owner gate, open the PR and read CI)
- **Files modified on the working branch:** 1 ledger (`.planning/cleanup/FIX-LEDGER-INFRA.md`) plus this summary; the code branches were only synced with `main` and fast-forwarded

## Accomplishments

- **Sync (Task 1).** `origin/main` (PR 2 squash `7da1461`, `pr2-merged=7da14613cd4060086c3ce8daeb13ffcfb0afd20b`) went into the working branch, then into `fix/deploy-kong` (F, `19f16fb`) and from there into `fix/kong-allowlist` (K, `7c0efdc`). The conflicted `package.json` and `docs/testing.md` hunks took F's side; F's and K's `test:harness` line is `origin/main`'s plus ` scripts/deploy.test.mjs`. K's diff against `origin/main` is the ten PR 3 files, F's the six without the Kong change. Local proof at K's tip: frozen install, lint, `format:check`, typecheck, `pnpm test`, `pnpm build`, commitlint, `bash -n scripts/deploy.sh` all exit 0, unit sweep 36/36, no knip finding beyond the Phase 3 baseline.
- **Owner gate (Task 2).** `gate-pr3=approve (owner, 2026-10-20)` is in the ledger and was committed before the pull request existed.
- **Red (Task 3, step 2).** PR 3 = https://github.com/alex-tanton/hearth/pull/18, `fix/deploy-kong` into `main`, title `fix: keep the db password off argv and allowlist GoTrue in Kong`, red head `19f16fb35a65b6f523149c802dc375c9da77ed4d` (old `kong.yml`). Run 39457296052: attempt 2, job 118753127163 failed only the two spec 08 Kong tests (`Kong refuses every GoTrue path and method that has no route, with or without a key` and `Kong answers the calls the PWA makes itself`), 102 passed, no `toomanyrequests`. Unrefused combinations: 34 (17 method and path pairs x no key and the anon key).
- **Fast-forward (step 3).** After the red job concluded, `fix/kong-allowlist` was pushed onto `fix/deploy-kong` as a plain fast-forward: both branches are at `pr3-head=7c0efdc0855e002606fc2924d00b85dac101bf6a`; the red head is its ancestor.
- **Green (steps 4 and 5).** Run 39460683347 on the green head: `lint:success typecheck:success test-unit:success test-integration:success test-e2e:success build:success`. `test-e2e` attempt 2, job 118764870460, passed everything, spec 08 and the sign-in, refresh and reset-password journeys against the allowlist included; `test-unit` runs `scripts/deploy.test.mjs` (through `test:harness`) and the Vitest Kong route test. `a4-dropped=none`. PR 18's mergeable state is clean.
- **Ledger.** The FIX-06, FIX-07 (E2E) and FIX-07 (static) red and green cells and commit column are filled from those runs; the `## CI` section names PR 18.

## Task Commits

Code lives on the two PR 3 branches; every commit of this plan on the working branch `claude/trusting-lovelace-y4r87h` is documentation or a plain merge of `origin/main`.

1. **Task 1: sync, local proof, PR body** - `f147846` (merge of `origin/main`), `1f0b3ca` (`docs: record the PR 3 pre-open proof`); branch tips F `19f16fb`, K `7c0efdc`
2. **Task 2: owner gate** - `8de4db4` (`docs: record the PR 3 owner gate`)
3. **Task 3: open PR, red, fast-forward, green** - `8c220e8` (`docs: record PR 3 opened at the red head`), `48651be` (`docs: record the PR 3 red run and the Kong fast-forward`), `abea385` (`docs: record PR 3 green on the Kong allowlist head`), `7bc60bb` (`docs: record PR 3 and its CI runs`)

**Measured commits: 8** (`git rev-list --count 1ec678a..7bc60bb`): the seven above plus `7da1461`, PR 2's squash, which arrived through the merge. The per-plan head ledger file was not created in the earlier session of this plan, so `plan_head_before` is `1ec678a`, the last commit of plan 04-04 and the parent of this plan's work. The plan metadata commit (`docs: complete plan 04-07`) follows and is not in the count.

## Verification

Task 3's automated command calls `gh api` throughout, and `gh` could not be used (see Deviations). The clauses that need `gh` were replaced by the evidence already recorded in the ledger, and every non-`gh` clause ran as written:

| Clause (as written) | What ran instead |
| --- | --- |
| `gh api pulls/$N` base and head refs, `merged_at` null | `pr3=18` and the title are in the ledger from the orchestrator's GitHub-tool read of PR 18 (`fix/deploy-kong` into `main`, open, `mergeable_state` clean); `git ls-remote` shows `fix/deploy-kong` at the recorded head |
| `gh api actions/jobs/$JR` is `test-e2e failure $RED` | the job id and its conclusion were read by the orchestrator through GitHub tools; the saved logs `04-07-run-a-e2e.log` and `04-07-run-a-e2e-attempt2.log` both name the Kong refusal test and have 0 `toomanyrequests` |
| `gh api pulls/$N` head sha equals `pr3-head=` | `git ls-remote --heads origin fix/deploy-kong` equals `pr3-head=` (checked with grep) |
| six `check-runs` conclusions are `success` | `pr3-ci=` in the ledger lists the six, read through GitHub tools |
| `pulls/$N/files` is exactly the files | `git diff --name-only origin/main...origin/fix/deploy-kong` is the ten files (the plan text says "nine" in one place and "ten" elsewhere; ten is correct and matches Task 1) |

Non-`gh` clauses: gate line, `pr3-head-red` is an ancestor of the head, `fix07-e2e-green=`, `a4-dropped=`, `pr3-ci=` present, ledger clean against `HEAD`, working branch pushed at `HEAD`. The phase-level check that the continuation diff touches nothing under `.planning`, `.claude`, `supabase`, `.github`, `eslint.config.js`, `knip.json`, `docker/Caddyfile`, `docker/docker-compose.yml` or `docker/kong-entrypoint.sh` printed nothing. The GitHub-tool facts are second-hand to this session (read by the orchestrator), not independently re-read.

## Decisions Made

See `key-decisions` above. The REQUIREMENTS choice follows the plan's `<output>` text (FIX-03, FIX-05). The `requirements-completed` list in this file's frontmatter is FIX-06 and FIX-07 because it copies the plan's `requirements` field, as the orchestrator asked; those two are not marked in REQUIREMENTS.md because PR 3 is not merged.

## Deviations from Plan

### Process deviations (no code changed)

**1. [Rule 3 - Blocking] The GitHub CLI was unusable, so the orchestrator did the GitHub steps**
- **Found during:** Tasks 1 and 3
- **Issue:** `gh` reports an invalid token in this session, so `gh api` could not open the pull request, poll check runs, re-run jobs or fetch job logs.
- **Fix:** The orchestrator opened PR 18, read the runs, jobs and logs through GitHub tools and saved the logs; the ledger lines (`pr3=`, `pr3-head-red=`, `fix07-e2e-red=`, `pr3-head=`, `pr3-ci=`, `fix07-e2e-green=`) record what it read. Task 1 had already read PR 2's merge with git for the same reason.
- **Committed in:** `8c220e8`, `48651be`, `abea385`, `7bc60bb`

**2. [Rule 1 - Bug, test infrastructure] E2E flakes outside the Kong work, on both heads**
- **Found during:** Task 3, runs A and B
- **Issue:** Run A attempt 1 (job 118747383726) failed three tests: the two spec 08 Kong tests and the push-reminder test `enables a type, delivers its reminder once, and a tap opens its household` (expected `/Oak Street/`, got `Rivera Family`). Run B attempt 1 (job 118759039156) failed two spec 17 accessibility-state tests that do not touch Kong.
- **Fix:** None to the code. Attempt 1 of run A was not counted as the red (a failure outside spec 08 voids it under the plan's red rule); attempt 2, with only the two Kong tests failing, is the red. Run B's attempt 2 passed and is the green. Spec 08 had the same result in every attempt of its head. The log of the failed run B attempt is `.planning/cleanup/logs/04-07-run-b-e2e.log`. These are the same kind of flakes Phase 3 recorded (`17-accessibility-states.spec.ts`, `19-notifications.spec.ts`); the phase-6 note in STATE.md already covers looking at them.
- **Verification:** the re-run attempts above.

**3. The red run's second Kong test also failed**
The plan expects the refusal test to fail on the old file. `Kong answers the calls the PWA makes itself` also failed in attempt 2 on the old `kong.yml`. Both failures are spec 08 Kong tests on the unchanged catch-all, so the red condition (nothing failing outside spec 08) holds; it is noted here because the plan names only the refusal test.

---

**Total deviations:** 3 documented (1 blocking tool, 1 test flake, 1 observation), no code fix and no weakened assertion.
**Impact on plan:** None on scope. The extra E2E attempts only cost time; no probe spelling was dropped and no commit was added to `fix/kong-allowlist`.

## Issues Encountered

Besides the flakes above, none. No auth gate other than the unusable `gh` token, no fix attempt repeated.

## Known Stubs

None.

## Threat Flags

None new. T-04-20 (sign-in broken by a missed path): mitigated by six green jobs on the head, including the sign-in, refresh and reset-password journeys against the allowlist. T-04-21 (false sense of protection): the PR body carries `## Host step after the merge`; the owner's recreate is still outstanding (04-08 checks it). T-04-22 (false red): the red counts only attempt 2, with the Kong tests the only failures and no `toomanyrequests`; the fast-forward waited for that job. T-04-23 (merge resolution): K's and F's file lists and the `test:harness` line were checked in Task 1. T-04-SC: no install beyond the approved `yaml@2.9.1`.

## User Setup Required

After the owner's squash merge of PR 18: take a backup and run `hearth-compose up -d --force-recreate kong` on the host, then sign in and refresh a session. A deploy does not apply `kong.yml`. Rollback is a revert of the squash commit and the same command. PR 18 was not merged, closed or touched by this plan.

## Next Phase Readiness

04-08 closes the phase once the owner has merged PR 18: every fix green on the final `main`, the `FIX-LEDGER.md` index, `main` CI, and the owner's Kong host step. REQUIREMENTS.md now shows FIX-03 and FIX-05 complete; FIX-01, FIX-02 and FIX-04 (PR 1, merged as `1b0e69f`) and FIX-06 and FIX-07 are still Pending there, and the plan text only names FIX-03 and FIX-05, so 04-08 or the verifier should settle those.

## Self-Check: PASSED

- `.planning/cleanup/FIX-LEDGER-INFRA.md` exists and carries the lines `gate-pr3=`, `pr3=18`, `pr3-head-red=`, `fix07-e2e-red=`, `pr3-head=`, `pr3-ci=`, `fix07-e2e-green=`, `a4-dropped=none`.
- `git ls-remote --heads origin` shows `fix/deploy-kong` and `fix/kong-allowlist` both at `7c0efdc0855e002606fc2924d00b85dac101bf6a`; the red head `19f16fb` is its ancestor.
- Commits `f147846`, `1f0b3ca`, `8de4db4`, `8c220e8`, `48651be`, `abea385`, `7bc60bb` are ancestors of `HEAD`, and the working branch was pushed at `7bc60bb` before this summary.

---
*Phase: 04-bug-fixes-with-regression-tests*
*Completed: 2026-10-20*
