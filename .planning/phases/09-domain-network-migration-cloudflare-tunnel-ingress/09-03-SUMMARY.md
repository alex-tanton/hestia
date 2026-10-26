---
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
plan: 03
subsystem: testing
tags: [test-fixtures, origin, hestia-aberrance-app, vitest, net-05]

requires:
  - phase: 09-domain-network-migration-cloudflare-tunnel-ingress
    provides: 09-01 put https://hestia.aberrance.app in .env.example; HESTIA_ORIGIN stays required with no code default
provides:
  - unit and component tests build, display and scrub links on https://hestia.aberrance.app
  - origin-as-configuration tests (env parsing, VAPID subject fallback, User-Agent, push subject) on the same origin
  - apps/service/src/env.ts origin comment naming https://hestia.aberrance.app
  - nothing under apps/ or packages/ names the retired private network, so 09-05's guard can cover them
affects: [09-04, 09-05]

plan_head_before: 08064eeebf696c9563dd0c7f9017d795c91a9b44
plan_head_after: a392c452aca9bf6040e529c88310bc9a2b53c9f9

actuals:
  tokens: 600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Test fixtures assert the production origin literal; the integration suite keeps http://127.0.0.1:5173 from service-stack.ts"

key-files:
  created: []
  modified:
    - apps/service/src/test/fake-app.ts
    - apps/service/src/services/invites.test.ts
    - apps/service/src/cli.test.ts
    - apps/web/src/screens/settings/settings.test.tsx
    - packages/shared/src/scrub.test.ts
    - apps/service/src/env.ts
    - apps/service/src/env.test.ts
    - apps/service/src/deals/flipp/flipp-deal-source.test.ts
    - apps/service/src/deals/flipp/request-queue.test.ts
    - apps/service/src/push/web-push-transport.test.ts

key-decisions:
  - "Literal-only sweep: every made-up host collapsed to hestia.aberrance.app with scheme, path, fragment and the env.test.ts trailing slash untouched; no test compared two of the old hosts, so no assertion changed meaning"
  - "env.ts changed by exactly one comment line; the origin schema and the no-default requirement are untouched (D-08, T-09-14)"

patterns-established:
  - "Commit scope for these test sweeps is service (commitlint scope list is closed; subject limit 71 characters)"

requirements-completed: [NET-05]

coverage:
  - id: D1
    description: "Invite links, the owner CLI reset link, route tests on TEST_ORIGIN, the Settings invite link and link scrubbing are asserted on https://hestia.aberrance.app"
    requirement: NET-05
    verification:
      - kind: unit
        ref: "apps/service/src/services/invites.test.ts (inviteLink expectation) and the full service unit suite, 768 passed"
        status: pass
      - kind: unit
        ref: "apps/web/src/screens/settings/settings.test.tsx, 14 passed"
        status: pass
      - kind: unit
        ref: "packages/shared/src/scrub.test.ts, 43 passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Env parsing, VAPID subject fallback, outbound User-Agent and Web Push subject tests use the production origin; env.ts still requires HESTIA_ORIGIN with unchanged validation"
    requirement: NET-05
    verification:
      - kind: unit
        ref: "apps/service/src/env.test.ts and the full service unit suite, 768 passed"
        status: pass
      - kind: other
        ref: "git diff --numstat against 90422bb: env.ts 1/1 (comment line only); five files 18/18; service typecheck passes"
        status: pass
    human_judgment: false
  - id: D3
    description: "No file under apps/ or packages/ names the retired private network"
    requirement: NET-05
    verification:
      - kind: other
        ref: "git grep -n -i -F -e 'ts.net' -e tailnet -- apps packages prints nothing (exit 1)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-26
status: complete
---

# Phase 09 Plan 03: Test Fixtures on the Production Origin Summary

**All ten test and source files that built or asserted links on made-up hosts under the retired private network now use `https://hestia.aberrance.app`, by a literal-only sweep (25 lines changed, `env.ts` comment included) with identical test counts.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-26T18:02:57Z
- **Completed:** 2026-10-26T18:07Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Task 1 (tracer): `TEST_ORIGIN` in `apps/service/src/test/fake-app.ts` is `https://hestia.aberrance.app`, so every route and app test that builds invite links runs on it; the `inviteLink` expectation, the owner CLI `ORIGIN`, the Settings invite link fixture and the two scrub fixtures moved with it.
- Task 2: the `env.ts` comment names the production origin (schema untouched); `env.test.ts` (seven lines, the trailing-slash fixture kept so the parser's slash drop is still proven), the five `buildUserAgent` calls in `flipp-deal-source.test.ts`, the two calls plus the expected User-Agent string in `request-queue.test.ts`, and both `subject:` fixtures in `web-push-transport.test.ts`.
- The integration suite and `apps/service/src/test/service-stack.ts` (`http://127.0.0.1:5173`) were not touched, as prohibited.

## Task Commits

1. **Task 1 (tracer): links built, displayed and scrubbed on the production origin** - `19341ba` `test(service): assert links on the hestia.aberrance.app origin` (`--stat`: 5 files changed, 7 insertions(+), 7 deletions(-))
2. **Task 2: origin-as-configuration tests and the env.ts comment** - `a392c45` `test(service): use hestia.aberrance.app in env and push tests` (`--stat`: 5 files changed, 18 insertions(+), 18 deletions(-))

(The plan's subjects were `test: build and assert links on the hestia.aberrance.app origin` and `test: use the hestia.aberrance.app origin in env, user-agent and push tests`; the repository's closed commitlint scope list and 71-character subject limit led to scope `service` and shorter subjects, as in 09-01 and 09-02.)

## Test Counts

| Suite | Before | After |
| ----- | ------ | ----- |
| `pnpm --filter @hestia/service test` | 57 files, 768 tests | 57 files, 768 tests (after Task 1 and again after Task 2) |
| `settings.test.tsx` (web) | 14 tests | 14 tests |
| `scrub.test.ts` (shared) | 43 tests | 43 tests |

## Verification Evidence

- Task 1 verify (full automated block): retired-host grep over the five files exits 1 (no hits), all six literal greps match, diff against `90422bb` totals 7 insertions and 7 deletions, service/web/shared suites pass, ESLint `--max-warnings=0` and Prettier clean.
- Task 2 verify (full automated block): `git grep -n -i -F -e 'ts.net' -e tailnet -- apps packages` empty, comment/fixture/User-Agent greps match, diff totals 18 and 18, `env.ts` diff is 1 and 1, service suite and typecheck pass, ESLint and Prettier clean.
- The commit hooks additionally ran lint-staged and the workspace typechecks on both commits; neither was bypassed.
- No file deletions in either commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commit subjects adapted to commitlint**
- **Found during:** Task 1 and Task 2 commits (same cause as 09-01 and 09-02; applied up front)
- **Issue:** The plan's subjects have no scope, and the closed scope list (`web, service, shared, recurrence, matching, db, e2e, docker`) plus the 71-character subject limit apply to this repository.
- **Fix:** Used scope `service` and the subjects listed above. Hooks were not bypassed.
- **Commits:** 19341ba, a392c45

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** none on repository content; only the commit subjects differ from the plan text.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. The change is fixture literals and one comment; T-09-13 (exact 7/7 and 18/18 line counts, unchanged totals) and T-09-14 (`env.ts` validation unchanged, one comment line) are both verified above.

## Next Phase Readiness

- 09-04 (docs and owner checklist) and 09-05 (hygiene guard over `apps/` and `packages/`) are unblocked; 09-05 must still re-run the integration suite, which was not touched here.

## Self-Check: PASSED

- Files exist: all ten listed under key-files.modified.
- Commits `19341ba` and `a392c45` are ancestors of HEAD; `git rev-list --count 08064ee..HEAD` before this SUMMARY commit: 2.
