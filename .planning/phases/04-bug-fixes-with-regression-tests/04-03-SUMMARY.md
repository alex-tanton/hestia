---
phase: 04-bug-fixes-with-regression-tests
plan: 03
subsystem: guard-tests
tags: [eslint, service-role-fence, zod, patch-schemas, mutation-testing, fix-ledger]

requires:
  - phase: 03-evidence-gated-removal
    provides: "main at 9819e7c, the base of test/guard-tests"
provides:
  - "test/guard-tests (PR 2 head, pushed, no pull request yet): the service-role fence probe, the registry-driven PATCH default guard, harness wiring and docs"
  - ".planning/cleanup/FIX-LEDGER-GUARDS.md with the service-role audit (0 violations) and the FIX-03 and FIX-05 rows"
affects: [04-04 (opens PR 2), 04-05 (PR 3 is cut from test/guard-tests and adds its own harness entry and doc lines), 04-08 (ledger index)]

actuals:
  tokens: 3450
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "ESLint Node API probes of a lint rule: lintText on virtual files with the repo config and disableTypeChecked, filtered by rule id, asserting severity 2 and path scope"
    - "Structural Zod guard: read schema._zod.def, follow optional/nullable/readonly/default/prefault/catch wrappers and pipe inputs, and discover the schemas from the endpoints registry"
    - "A guard of a property that already holds is proven by a recorded mutation of the guarded source, restored and confirmed clean"

key-files:
  created:
    - test/eslint-service-role-fence.test.mjs
    - packages/shared/src/api/patch-schemas.test.ts
    - .planning/cleanup/FIX-LEDGER-GUARDS.md
  modified:
    - package.json
    - docs/testing.md

key-decisions:
  - "PATCH bodies are discovered from the `endpoints` registry in contract.ts, not by name or by scanning schemas, because that list is what the service validates against and what OpenAPI is built from; the `update*RequestSchema` export cross-check catches a schema wired in outside the registry"
  - "The fenced-path fence cases also assert error severity (not only presence), so the severity mutation fails 15 cases instead of the 7 the research saw"
  - "The fence is not widened: the four known gaps are written in the test header and docs/testing.md, and the audit found none in use"

requirements-completed: []

plan_head_before: 60f5a291f611cc44211c1109adcdf026efa55703
plan_head_after: c4e76a028355a7366f509204b4f31590d8b8c888
commits: 2

coverage:
  - id: D1
    description: "Service-role usage outside privileged/ is audited with no violation, and a test CI runs fails when the ESLint fence is violated or weakened"
    requirement: FIX-05
    verification:
      - kind: unit
        ref: "test/eslint-service-role-fence.test.mjs (28 probes; node --test, run by pnpm test:harness): pass 28, fail 0"
        status: pass
      - kind: other
        ref: "four killed mutations of the fence block in eslint.config.js: m1 15 fail, m2 10 fail, m3 2 fail, m4 17 fail, each restored clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "A structural test fails if any PATCH body schema defaults, prefaults or catches a field, and it is proven against the real autopay mutation"
    requirement: FIX-03
    verification:
      - kind: unit
        ref: "packages/shared/src/api/patch-schemas.test.ts (24 cases)"
        status: pass
      - kind: other
        ref: "bills.ts mutation: /api/bills/:id case fails with expected [ 'autopay' ] to deeply equal [], restored clean"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 03: Guard tests for the service-role fence and PATCH defaults Summary

**A 28-probe ESLint test that fails when the `privileged/` import fence is violated or weakened, and a registry-driven test that fails when any of the 11 PATCH bodies defaults a field, both proven by killed mutations and pushed on `test/guard-tests` with no runtime change.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-20T13:52Z (approximate; the start time was not captured before the first command)
- **Completed:** 2026-10-20T14:02Z
- **Tasks:** 2 (one tracer, one auto with `tdd="true"`)
- **Files:** 4 in the PR 2 branch (two new tests, `package.json`, `docs/testing.md`), plus the ledger

## Accomplishments

- **FIX-05 audit.** 116 grep hits over `apps`, `packages`, `supabase/seed` and `e2e`; every hit outside `apps/service/src/privileged/` is classified in the ledger and none builds a service-role database or GoTrue client outside `main.ts`, `cli.ts` and test code. `routes/users.ts` is clean (it calls the injected `changeEmail`), `http/context.ts:9` is a type-only import, `push/test-seam.ts` only compares the key. `audit-violations=0`, so no checkpoint was needed and nothing in the fence changed.
- **FIX-05 probe.** `test/eslint-service-role-fence.test.mjs`: nine bad import spellings reported at severity 2, four good ones silent, the value import reported at eight fenced paths and silent at seven exempt paths. 28 pass. It sits in `test:harness`, so `pnpm test` and CI's `test-unit` run it; `pnpm test:harness` is 215 tests, exit 0.
- **FIX-03 guard.** `patch-schemas.test.ts` takes the 11 PATCH bodies from `endpoints.filter((endpoint) => endpoint.method === 'PATCH')`, requires a non-empty registry, scans every field through its wrappers, parses `{}`, cross-checks every `update*RequestSchema` export, flags `departRequestSchema` / `recipesQuerySchema` / `flyersQuerySchema` when fed directly while keeping them out by registry, and holds eight mutant schemas. 24 pass; the whole shared suite is 172 passed.
- **Docs.** `docs/testing.md` now counts seven `node --test` files and five harness tests, names the fence test and lists its four gaps.

## Task Commits

Code commits are on `test/guard-tests` (pushed at its tip); ledger commits are on the working branch.

1. **Task 1 (tracer): FIX-05** - `ba7d50116bd1e0db91360d26dd879165f3be2612` (`test/guard-tests`, `test: lint-fence probes for the service role`)
2. **Task 2: FIX-03** - `72b0668741791409946a7fd7cd071d51fdf99a9d` (`test/guard-tests`, `test(shared): guard PATCH schemas against injected defaults`)

**Working-branch commits (`claude/trusting-lovelace-y4r87h`, the measured `commits: 2`):** `2610aaa` (`docs: record the FIX-05 audit and fence probes`) and `c4e76a0` (`docs: record the FIX-03 guard and its mutation`). The plan metadata commit (`docs: complete plan 04-03`) follows them.

## Red and green evidence

The full rows are in `.planning/cleanup/FIX-LEDGER-GUARDS.md`; raw logs are in the gitignored `.planning/cleanup/logs/04-03-*`.

| FIX | Red (a recorded mutation; both properties hold today) | Green |
| --- | --- | --- |
| FIX-05 | m1 `'error'` to `'warn'` on the import rule: exit=1, 15 failed / 13 passed. m2 `routes/**` added to `ignores`: exit=1, 10 failed. m3 selector `/privileged/` to `/no-such-module/`: exit=1, 2 failed. m4 `files` pointed at `apps/none/**/*.ts`: exit=1, 17 failed. | `node --test test/eslint-service-role-fence.test.mjs`: exit=0, pass 28, fail 0; `pnpm test:harness` 215 pass |
| FIX-03 | `updateBillRequestSchema` `autopay: billFieldsSchema.shape.autopay.unwrap(),` changed to `autopay: billFieldsSchema.shape.autopay,`: exit=1, 1 failed / 23 passed; `/api/bills/:id injects no default for a field left out`: `AssertionError: expected [ 'autopay' ] to deeply equal []` | same test, unmutated: exit=0, 24 passed; shared suite 172 passed; typecheck, ESLint, Prettier exit=0 |

RED semantic assessment: each mutation failed the intended test on the planned assertion (a downgraded severity, an ignored directory, a neutralised selector and a misdirected `files` each break the probes that assert them; the restored `autopay` default is reported by name), not on a syntax, import or fixture fault. `eslint.config.js` and `bills.ts` were restored with `git checkout --` after every mutation and confirmed clean, and the branch diff against `origin/main` has no change to either.

## Decisions Made

See `key-decisions` above. The fence probe's m1 count (15) differs from the research's 7 only because the fenced-path cases also assert severity 2; the mutation is killed either way.

## Deviations from Plan

None - plan executed exactly as written.

Small notes that are not deviations: Prettier removed a space in one `for` header of the FIX-03 test (`input; ) {` became `input;) {`), applied before the commit; the FIX-03 test is one case per concern, with the three non-PATCH defaulted schemas in a single case so the file has the 24 cases the plan expected. Plan rule 1 creates `test/guard-tests`, so the executor's generic `agent-*` branch-name allow-list was not applied to it (the protected-branch check was). `.planning/milestone.lock` stays untracked and untouched.

## Issues Encountered

None. No fix attempt was repeated, and no auth gate or checkpoint was hit.

## Known Stubs

None.

## Threat Flags

None. T-04-07 is mitigated by the fence probe (nine spellings, eight fenced paths, four killed mutations, CI `test-unit` through `test:harness`); T-04-08 by the registry-driven PATCH guard and the killed `autopay` mutation; T-04-09 by the four gaps named in the test header and `docs/testing.md` with the audit showing none in use. No package was added (the worktree installed with `--frozen-lockfile`), no endpoint, auth path or schema changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 04-04: open PR 2 from `test/guard-tests` (head `72b06687`, base `origin/main` 9819e7c) once PR 1 is merged (D-11). The branch is tests, harness wiring and docs only; PR 3's branch (04-05) is cut from it so the `test:harness` line and the testing-doc counts build on these. `requirements-completed` is empty because PR 2 is not merged yet. Nothing was pushed to `main` and no pull request exists.

## Self-Check: PASSED

- The two new test files and the ledger exist; commits `ba7d501` and `72b0668` are ancestors of `test/guard-tests`, and `2610aaa` and `c4e76a0` of the working branch; both branches are pushed at their tips.
- Task 1 and Task 2 `<verify>` commands each printed OK; `git diff --name-only origin/main...test/guard-tests` is exactly `docs/testing.md`, `package.json`, `packages/shared/src/api/patch-schemas.test.ts`, `test/eslint-service-role-fence.test.mjs`, and nothing under `.planning`, `.claude`, `supabase`, `docker`, `.github`, `eslint.config.js`, `knip.json`, `apps` or `bills.ts` changed.

---
*Phase: 04-bug-fixes-with-regression-tests*
*Completed: 2026-10-20*
