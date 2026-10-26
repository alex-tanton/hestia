---
phase: 04-bug-fixes-with-regression-tests
plan: 05
subsystem: infra-fixes
tags: [deploy, pgpassword, kong, e2e-probes, package-gate, fix-ledger]

requires:
  - phase: 04-bug-fixes-with-regression-tests
    provides: "test/guard-tests at 72b0668 (plan 04-03), the base PR 3 is stacked on"
provides:
  - "fix/deploy-kong (PR 3 head candidate, pushed, no pull request yet): FIX-06 behind a stubbed-argv deploy test, plus the FIX-07 Kong probes in E2E spec 08 with docker/kong.yml unchanged"
  - ".planning/cleanup/FIX-LEDGER-INFRA.md with the FIX-06 red and green rows, the FIX-07 pending row, pr3-head-candidate and the yaml gate"
affects: [04-06 (installs yaml@2.9.1 and adds the static Kong test, now unblocked), 04-07 (opens PR 3 and reads the red E2E run), 04-08 (ledger index)]

actuals:
  tokens: 5700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Run the real shell script to the end against stub docker, supabase and curl binaries first on PATH, with a fake env file and made-up sentinel secrets, and require a logged stub call so a pass cannot be vacuous"
    - "Secret passed to one child process as a prefix assignment (PGPASSWORD=...) and a password-free URL, instead of a password in argv"
    - "expect.soft over a method and path matrix so one E2E run lists every unrefused combination"

key-files:
  created:
    - scripts/deploy.test.mjs (on fix/deploy-kong)
    - .planning/cleanup/FIX-LEDGER-INFRA.md
  modified:
    - scripts/deploy.sh (on fix/deploy-kong, one hunk)
    - package.json (test:harness line only), docs/testing.md, docs/deploy.md (on fix/deploy-kong)
    - e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts (on fix/deploy-kong)

key-decisions:
  - "T-04-13 (PGPASSWORD readable in /proc/{pid}/environ while the migration runs) is accepted per D-09: single-user runner host, variable lives only for that process"
  - "docker/kong.yml is left exactly as on origin/main on PR 3's head so the FIX-07 probes can go red in CI before 04-06 fixes it"
  - "yaml is not installed in this plan; the owner's gate-yaml=approve is a record-only gate and 04-06 does the install"

requirements-completed: []

plan_head_before: 7be5b41
plan_head_after: 4a411efafebe45931533b112123f23ea94d504e5
commits: 3

duration: 10min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 05: Deploy password and Kong probe fixes Summary

**The deploy script now hands the database password to `supabase migration up` only through `PGPASSWORD` with a password-free URL, proven by a stubbed-argv test that was red 4 of 6 and is green 6 of 6, and the 17-pair Kong refusal probes sit on the same branch with Kong unchanged, ready for a red CI run.**

## Performance

- **Duration:** about 10 min on this working branch (task 1 and 2 work in the `../hearth-deploy-kong` worktree started earlier; start time not captured)
- **Completed:** 2026-10-20T14:29Z
- **Tasks:** 3 (tracer FIX-06, FIX-07 probes, package legitimacy checkpoint)

## Accomplishments

- **FIX-06.** `scripts/deploy.test.mjs` runs the real `scripts/deploy.sh` against stubs (6 cases: runs to the end, the password is on no command line, the script does not print it, only the `supabase` stub sees `PGPASSWORD`, the `--db-url` is user and host only, a password with URL-reserved characters arrives intact). The script change is one hunk and `deploy.sh` stays mode 100755.
- **FIX-07 probes.** Two tests in `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts`: Kong refuses 17 GoTrue method and path pairs with and without the anon key (`expect.soft`, status 403, body `Access is forbidden.`), and Kong answers the calls the PWA makes itself. `docker/kong.yml` equals `origin/main`'s on the branch, so the first refusal test is expected to fail in PR 3's `test-e2e` (04-07). Its red and green are pending that CI run.
- **Package gate.** The owner approved `yaml@2.9.1`; the ledger records it. Nothing was installed.

## Branch and ledger facts

- Branch: `fix/deploy-kong`, cut from `origin/test/guard-tests` at `72b0668741791409946a7fd7cd071d51fdf99a9d`, pushed at `1f3f36cd8f180c496976ffb9fee01c76cb15d954` (`git ls-remote` confirmed).
- `pr3-head-candidate=1f3f36cd8f180c496976ffb9fee01c76cb15d954`
- `gate-yaml=approve (owner, 2026-10-20)`

## Task Commits

Code commits are on `fix/deploy-kong`; ledger commits are on the working branch `claude/trusting-lovelace-y4r87h`.

1. **Task 1 (tracer): FIX-06** - `e05a2203a6819c96c98643db28beaa58dfa55926` (`fix/deploy-kong`)
2. **Task 2: FIX-07 probes** - `1f3f36cd8f180c496976ffb9fee01c76cb15d954` (`fix/deploy-kong`)
3. **Task 3: yaml gate** - record-only, no code commit

**Working-branch commits (the measured `commits: 3`):** `8ba9d2f` (`docs: record the FIX-06 red and green runs`), `cb89b6d` (`docs: record the Kong probes awaiting PR 3 CI`), `4a411ef` (`docs: record the yaml legitimacy gate`). The plan metadata commit (`docs: complete plan 04-05`) follows them. The two code commits above are on the separate branch and are not in this count.

## Red and green evidence

Full rows are in `.planning/cleanup/FIX-LEDGER-INFRA.md`; raw logs are in the gitignored `.planning/cleanup/logs/04-05-*`.

| FIX | Red (unfixed) | Green (fixed) |
| --- | --- | --- |
| FIX-06 | `node --test scripts/deploy.test.mjs` on the unfixed `deploy.sh`: exit=1, `pass 2`, `fail 4` (the password in argv, `PGPASSWORD` never seen by the CLI, the URL carrying a password, a reserved-character password not intact) | same command after the one-command change: exit=0, `pass 6`, `fail 0`; `bash -n`, ESLint `--max-warnings=0` and Prettier exit=0; `pnpm test:harness` 221 pass |
| FIX-07 | pending PR 3 CI (04-07) | pending PR 3 CI (04-07) |

RED semantic assessment (FIX-06): the four failures are assertion failures on the intended property (`supabase was given the password`, `PGPASSWORD=<unset>`, a password in the URL), not syntax, import or fixture faults, and the two passing cases are the ones that hold on the unfixed script by design.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

None - plan executed exactly as written. Task 3 is a `blocking-human` checkpoint, so the original executor stopped there and this continuation recorded the owner's answer; that is the plan's normal flow, not a deviation.

## Issues Encountered

None. No fix attempt was repeated and no auth gate was hit.

## Known Stubs

None. The deploy test's `docker`, `supabase` and `curl` stubs are intentional test doubles, not shipped code.

## Threat Flags

None. T-04-12 (password in argv) is mitigated and proven by the red-to-green test; T-04-13 is accepted (D-09); T-04-14 is mitigated by stubs-first PATH, a fake env file and the required logged `supabase` stub call; T-04-15 by made-up sentinel secrets only; T-04-SC by the owner gate, with `yaml` not installed anywhere (`grep -n '"yaml"'` over every `../hearth-*/package.json`, `../hearth-*/apps/service/package.json`, and the root and service `package.json` printed nothing at gate time).

## User Setup Required

None.

## Next Phase Readiness

04-06 may now install `yaml@2.9.1` as a devDependency of `@hearth/service` (exact pin, `pnpm install --frozen-lockfile` must pass) and fix Kong. 04-07 opens PR 3 from `fix/deploy-kong` after PR 1 and PR 2 merge (D-11) and reads the red `test-e2e` run. `requirements-completed` is empty because PR 3 is not merged yet. Nothing was pushed to `main` and no pull request exists.

## Self-Check: PASSED

- `.planning/cleanup/FIX-LEDGER-INFRA.md` exists and has exactly one `^gate-yaml=(approve|reject) ` line (`approve`).
- `git ls-remote --heads origin fix/deploy-kong` is `1f3f36cd8f180c496976ffb9fee01c76cb15d954`; the working branch was pushed at `4a411ef`.
- No `package.json` in any Phase 4 worktree or the primary checkout declares `yaml`.

---
*Phase: 04-bug-fixes-with-regression-tests*
*Completed: 2026-10-20*
