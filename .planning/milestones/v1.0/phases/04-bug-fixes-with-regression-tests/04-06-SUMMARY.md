---
phase: 04-bug-fixes-with-regression-tests
plan: 06
subsystem: infra-fixes
tags: [kong, gotrue, allowlist, vitest, yaml, docs, fix-ledger]

requires:
  - phase: 04-bug-fixes-with-regression-tests
    provides: "fix/deploy-kong at 1f3f36c (plan 04-05): the FIX-07 E2E probes with docker/kong.yml unchanged, and the owner's gate-yaml=approve"
provides:
  - "fix/kong-allowlist (PR 3 continuation, pushed at 1e48226, no pull request yet): docker/kong.yml as a GoTrue allowlist with a deny-by-default route, the Vitest Kong route-table test, yaml 2.9.1, and the docs"
  - ".planning/cleanup/FIX-LEDGER-INFRA.md with the FIX-07 (static) row, kong-parse, kong-allowlist-tip and docs-commit"
affects: [04-07 (opens PR 3, reads the red E2E run on fix/deploy-kong, then fast-forwards fix/kong-allowlist onto it), 04-08 (ledger index)]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2

tech-stack:
  added:
    - "yaml 2.9.1 (devDependency of @hearth/service only, exact pin)"
  patterns:
    - "Static test of a deployment config: read the YAML with `yaml`, validate its shape with local Zod schemas, flatten to a route table and compare it exactly, plus a small model of the router for the calls that matter"
    - "Gateway allowlist: exact regex paths with method lists, ranked above one refusing prefix route, so a new GoTrue path is refused until someone adds it"

key-files:
  created:
    - apps/service/src/kong-routes.test.ts (on fix/kong-allowlist)
  modified:
    - docker/kong.yml (format 3.0, seven GoTrue services; consumers, acls and realtime untouched)
    - apps/service/package.json, pnpm-lock.yaml (yaml 2.9.1; lockfile +3 -0)
    - docs/deploy.md, docs/testing.md
    - .planning/cleanup/FIX-LEDGER-INFRA.md

key-decisions:
  - "D-07 applied as specified: verify, token, logout, user, otp, admin/users routes plus auth-v1-denied; admin/users kept for the E2E seed (A2) and otp kept so turning magic link on needs no gateway change (A5)"
  - "D-08 applied as specified: the guard is a Vitest test in apps/service (not the root node --test harness), so it runs in pnpm test and CI test-unit with no Docker"
  - "kong config parse was not run: no Docker daemon on this box (kong-parse=skipped (no daemon)); PR 3's E2E run boots the real file"
  - "deploy.sh and Compose are untouched: the Kong recreate after a kong.yml change is the owner's documented manual step"

requirements-completed: []

plan_head_before: a9c08f0b8fd46a8dd488e6ede1f107e6a567c8a6
plan_head_after: 2fce706f9f7ace1a8a1e1aa0a5f8648410d99ac5
commits: 2

duration: 8min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 06: Kong GoTrue allowlist Summary

**Kong now routes only the GoTrue calls the PWA makes and answers 403 `Access is forbidden.` for everything else under `/auth/v1`, pinned by a Vitest test (`yaml` 2.9.1) that was 13 of 32 red on the old catch-all and is 32 of 32 green on the allowlist.**

## Performance

- **Duration:** about 8 min on this working branch (the start timestamp was not captured; measured from the first log of the plan, 15:14Z, to 15:20Z)
- **Completed:** 2026-10-20T15:21Z
- **Tasks:** 2 (tracer: allowlist end to end; docs)

## Accomplishments

- **Allowlist (D-07).** `docker/kong.yml` is at `_format_version: '3.0'` (regex paths need it; under 2.1 Kong rewrites a regex path and rejects the leading `~`). GoTrue has seven services in order: `auth-v1-verify` (GET, POST; no key; email links and verifyOtp), `auth-v1-token` (POST), `auth-v1-logout` (POST), `auth-v1-user` (GET), `auth-v1-otp` (POST), each of those four key-authenticated with ACL `admin` and `anon`, `auth-v1-admin-users` (GET, POST; ACL `admin` only), and `auth-v1-denied` (prefix `/auth/v1`, `request-termination` 403 `Access is forbidden.`). Each allowed path is an exact regex `~/auth/v1/{name}/?$` on a path-stripped upstream `http://auth:9999/{name}`. The `consumers`, `acls` and four `realtime-v1-*` sections are byte-identical to `origin/main`.
- **Static test (D-08).** `apps/service/src/kong-routes.test.ts` reads `docker/kong.yml` and `docker/docker-compose.yml` with `yaml`, validates both with local Zod schemas and pins the exact route table, the per-route shape, which routes carry `key-auth`, the `admin/users` ACL, the realtime routes, the plugins against `KONG_PLUGINS`, eight browser calls that must reach their routes and seventeen calls that must reach `auth-v1-denied` (32 cases).
- **Dependency.** `yaml@2.9.1` added as a devDependency of `@hearth/service` only after the ledger's `gate-yaml=approve (owner, 2026-10-20)` line was found. Lockfile diff: 3 lines added, 0 deleted (importer lines only); root `package.json` unchanged; `pnpm install --frozen-lockfile` exit=0.
- **Docs.** `docs/deploy.md` describes the allowlist and the 403, and states that a `docker/kong.yml` change needs a manual backup and `hearth-compose up -d --force-recreate kong` on the host (Compose does not recreate a service when only a bind-mounted file changed; a deploy never recreates Kong), with the rollback. `docs/testing.md` names the new test.

## Branch and ledger facts

- Branch `fix/kong-allowlist`, cut from `origin/fix/deploy-kong` at `1f3f36cd8f180c496976ffb9fee01c76cb15d954` and pushed (plain push, new branch) at `1e482269fc1424811a3a5d01b1e9973a3a570c22`. `fix/deploy-kong` was not touched.
- Its diff over `origin/fix/deploy-kong` is exactly six files: `apps/service/package.json`, `apps/service/src/kong-routes.test.ts`, `docker/kong.yml`, `docs/deploy.md`, `docs/testing.md`, `pnpm-lock.yaml`.
- `kong-parse=skipped (no daemon)`; `docs-commit=1e482269fc1424811a3a5d01b1e9973a3a570c22`.
- The continuation's diff against `origin/main` also shows PR 2's `packages/shared/src/api/patch-schemas.test.ts`, because the branch stacks on `test/guard-tests` by design; none of it is from this plan.

## Task Commits

Code commits are on `fix/kong-allowlist`; ledger commits are on the working branch `claude/trusting-lovelace-y4r87h`.

1. **Task 1 (tracer): allowlist, test, yaml** - `5c800a0b37efe451ec781ddd2bf3a6c69826c68d` (`fix(docker): allowlist the GoTrue paths in Kong`)
2. **Task 2: docs** - `1e482269fc1424811a3a5d01b1e9973a3a570c22` (`docs: describe the Kong allowlist and its recreate step`)

**Working-branch commits (the measured `commits: 2`):** `3c1120d` (`docs: record the Kong allowlist red and green runs`), `2fce706` (`docs: record the Kong docs commit`). The plan metadata commit (`docs: complete plan 04-06`) follows them. The two code commits above are on the separate branch and are not in this count.

## Red and green evidence

Full row: `.planning/cleanup/FIX-LEDGER-INFRA.md`, `| FIX-07 (static) |`. Raw logs are in the gitignored `.planning/cleanup/logs/04-06-*`.

| FIX | Red (unfixed) | Green (fixed) |
| --- | --- | --- |
| FIX-07 (static) | `pnpm --filter @hearth/service exec vitest run src/kong-routes.test.ts` against the unchanged catch-all: exit=1, `Tests  13 failed \| 19 passed (32)`; first assertion `expected '2.1' to be '3.0'` | same command on the allowlist: exit=0, `Tests  32 passed (32)`; service unit suite 56 files and 757 tests; service typecheck, ESLint `--max-warnings=0`, Prettier and `pnpm install --frozen-lockfile` exit=0; `pnpm lint` and `pnpm format:check` over the tree exit=0 |
| FIX-07 (E2E) | pending PR 3 CI (04-07) | pending PR 3 CI (04-07) |

RED semantic assessment: the 13 failures are assertion failures on the intended property (format version, route table, per-route shape, open `/verify`, admin ACL, and the eight browser calls reaching `auth-v1-denied` instead of their routes), not parse, import or fixture faults; the schemas accept the old file. The 19 passing cases are the realtime, plugin and refusal cases that hold on the old file by design.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

None - plan executed exactly as written.

Two process notes, not deviations. The executor's per-commit check that a worktree branch matches `agent-*` was not applied to `fix/kong-allowlist`: it is the plan's own sibling worktree on a named fix branch (rule 1), and the protected-branch check passed. The worktree was created tracking `origin/fix/deploy-kong`, so every push used an explicit `fix/kong-allowlist:fix/kong-allowlist` refspec and the upstream was then reset to `origin/fix/kong-allowlist`.

## Issues Encountered

None. No fix attempt was repeated and no auth gate was hit. I ran Prettier on the new test file before the red run so the red log reflects the committed file.

## Known Stubs

None.

## Threat Flags

None. T-04-16 and T-04-19 are mitigated by the allowlist and pinned by the static test (E2E proof comes from PR 3 CI); T-04-17 by the `'3.0'` assertion (the optional `kong config parse` was skipped, no Docker daemon); T-04-18 by the browser-call cases (E2E sign-in, refresh and reset-password specs in PR CI); T-04-SC by the owner gate, the exact pin and the 3-line importer-only lockfile diff.

## User Setup Required

After PR 3 merges: take a backup by hand and run `hearth-compose up -d --force-recreate kong` on the host (documented in `docs/deploy.md`). A deploy does not do this.

## Next Phase Readiness

04-07 opens PR 3 from `fix/deploy-kong` after PR 1 and PR 2 merge (D-11), reads the red `test-e2e` run against the unchanged Kong, then fast-forwards `fix/kong-allowlist` onto `fix/deploy-kong` (`git merge-base --is-ancestor origin/fix/deploy-kong HEAD` holds now). `requirements-completed` is empty because PR 3 is not open yet. Nothing was pushed to `main` and no pull request was opened.

## Self-Check: PASSED

- `apps/service/src/kong-routes.test.ts` exists in `../hearth-kong-allowlist`; `docker/kong.yml` there has `_format_version: '3.0'`.
- `git ls-remote --heads origin fix/kong-allowlist` is `1e482269fc1424811a3a5d01b1e9973a3a570c22`; commits `5c800a0` and `1e48226` are ancestors of it; the working branch was pushed at `2fce706`.
- Both tasks' automated verify commands printed `TASK1-OK` and `TASK2-OK`.

---
*Phase: 04-bug-fixes-with-regression-tests*
*Completed: 2026-10-20*
