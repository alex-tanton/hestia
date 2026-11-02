---
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
plan: 05
subsystem: ci
tags: [hygiene-gate, retired-ingress, guard, full-suite, e2e, net-01]

requires:
  - phase: 09-domain-network-migration-cloudflare-tunnel-ingress
    provides: 09-01 to 09-04 removed every trace of the retired ingress from code, config, tests and docs
provides:
  - check 5 in scripts/check-repo-hygiene.mjs that fails when the retired ingress returns to a tracked file, path or the pinned recurrence comment
  - the full CI mirror, doc checkers, integration suite and E2E suite proven green on the final tree
affects: []

plan_head_before: 6e6735697b9a5a472d3508f3cfd0fb89d92ee6d7
plan_head_after: f219d843d93db1d552956b887dac517871c3feca

actuals:
  tokens: 7545
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One term rule { label, terms, allowlist, quotes } applied by one function; the legacy-name check and the retired-ingress check are two rows of a TERM_RULES table"

key-files:
  created: []
  modified:
    - scripts/check-repo-hygiene.mjs
    - scripts/check-repo-hygiene.test.mjs
    - docs/testing.md
    - docs/file-map.md
    - CONTRIBUTING.md

key-decisions:
  - "The legacy-name machinery was generalised into a term rule table rather than copied, so the legacy messages and exit codes stay byte-identical and jscpd sees no new clone"
  - "RETIRED_INGRESS_ALLOWLIST has exactly three entries (.planning/, the guard script, its test) and RETIRED_INGRESS_QUOTES pins only 'funnel through here' in packages/recurrence/src/occurrence.ts"

requirements-completed: [NET-01, NET-02, NET-03, NET-04, NET-05]

coverage:
  - id: D1
    description: "Hygiene check 5 fails, naming the file, on a retired ingress term in content (any case), in a path, or outside the pinned recurrence quote; the committed tree passes"
    requirement: NET-01
    verification:
      - kind: test
        ref: "scripts/check-repo-hygiene.test.mjs#check-repo-hygiene: retired ingress terms (5 cases) plus all legacy cases: 33 pass, 0 fail"
        status: pass
      - kind: other
        ref: "Task 1 verify: real tree 'repo-hygiene: clean (1053 files, 14 scripts)'; probe clone exits 1 with exactly three messages and 'repo-hygiene: 3 problems'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The hygiene check is described by concept in docs/testing.md, docs/file-map.md and CONTRIBUTING.md without spelling any retired term"
    requirement: NET-01
    verification:
      - kind: other
        ref: "Task 1 verify greps for the constant names; hygiene check 5 clean on the committed docs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every CI check, both doc checkers, the integration suite and the service coverage run pass on the final tree"
    requirement: NET-02
    verification:
      - kind: other
        ref: "Task 2 verify exit 0 (log summarised in Verification Evidence)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full Playwright suite passes on the final stack: 107 passed, spec 20 ran, the member-removal journey ran last"
    requirement: NET-03
    verification:
      - kind: other
        ref: "Task 3 verify exit 0: '107 passed (9.6m)'"
        status: pass
    human_judgment: false
  - id: D5
    description: "The live tunnel, the WebSocket upgrade through Cloudflare, the real browser CSP on the real origin and the visitor's real address behind Cloudflare cannot be seen from CI or the sandbox"
    requirement: NET-04
    verification: []
    human_judgment: true
    rationale: "No Cloudflare edge is reachable here; the owner repeats the Task 3 human check after the first deploy (checklist steps 7-10)"

duration: 38min
completed: 2026-10-26
status: complete
---

# Phase 09 Plan 05: Retired-Ingress Guard and Full-Suite Proof Summary

**The hygiene gate now fails CI if the retired ingress returns to any tracked file, path or use of the word beyond one pinned recurrence comment, and the whole tree passes every CI check, the integration suite and all 107 Playwright tests on the tunnel-ready stack.**

## Performance

- **Duration:** about 38 min (including a 9.6 min E2E run and a 6 min service coverage run)
- **Tasks:** 3 (one code and docs task, two verification-only tasks)
- **Files:** 5 changed, 0 created

## Task Commits

1. **Task 1 (tracer), guard:** `dc1ec70` `ci: fail the hygiene gate on any return of the retired ingress`
2. **Task 1, docs:** `f219d84` `docs: describe the retired-ingress check in the hygiene gate`
3. **Task 2:** verification only, no commit
4. **Task 3:** verification only, no commit (the CA workaround was applied and reverted inside the run)

## Accomplishments

- `scripts/check-repo-hygiene.mjs`: the legacy-name code became a term rule `{ label, terms, allowlist, quotes }` applied by `termProblems` over a `TERM_RULES` table. `git grep --cached -I -l -i -z -F` runs from an argument array with one `-e` per term; status 0 and 1 are answers, anything else exits 2. Three frozen, commented constants: `RETIRED_INGRESS_TERMS` (four lowercase terms: the retired product name, its private-network term, its public-forwarding feature word and its hosts' DNS suffix), `RETIRED_INGRESS_ALLOWLIST` (`.planning/`, the script, its test) and `RETIRED_INGRESS_QUOTES` (`funnel through here` in `packages/recurrence/src/occurrence.ts`). Header comment now describes five kinds of drift.
- `scripts/check-repo-hygiene.test.mjs`: five table-style cases under `check-repo-hygiene: retired ingress terms`, built with two small helpers (`hygieneOnFiles`, `problemLines`) so jscpd sees no clone of the legacy block. RED run failed in the failing-direction cases; GREEN run: 33 pass, 0 fail, legacy cases unchanged.
- Docs: `docs/testing.md` (harness bullet and check 5 description with the three constants), `docs/file-map.md` row, and the `CONTRIBUTING.md` gate-table row. None spells a retired term.

## Verification Evidence

### Guard

Real tree:

```
repo-hygiene: clean (1053 files, 14 scripts)
```

Probe clone (a content hit, a path hit, a second use of the word in the recurrence file); exit 1:

```
retired ingress term in file name: docs/funnel-probe.md
retired ingress term in packages/recurrence/src/occurrence.ts:104
retired ingress term in probe-note.md
repo-hygiene: 3 problems
```

`git diff --quiet 90422bb -- .github knip.json` succeeds; `package.json`'s only change since that commit is 09-02's `scripts/caddy-entrypoint.test.mjs` entry in `test:harness`.

### Task 2 gates (all exit 0)

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | ok |
| lint, format check, typecheck | ok |
| `pnpm test` (harness included) | harness `tests 425, pass 425, fail 0`; web coverage run `Test Files 57 passed, Tests 729 passed` |
| web coverage thresholds | Statements 85.38%, Branches 81.83%, Functions 78.61%, Lines 86.96%, thresholds met |
| build | ok |
| knip | ok, no findings |
| knip baseline | `knip-baseline: 28 rows match` |
| jscpd | 1.13% duplicated lines (876 of 77363), 67 clones, under the 2% limit |
| hygiene | `repo-hygiene: clean (1053 files, 14 scripts)` |
| migration gate | `migrations: 0 added, nothing else changed` |
| claims checker | `checked=1380 misses=4` (the four pre-existing `migration-exemptions.json` ones; the awk filter printed nothing else) |
| link checker | `doc-links: files=11 links=35 broken=0` |
| audit-prod (not gating) | `audit-prod: exit 0`, `audit-prod: 0 advisories, 0 allowed, 0 problems` |
| `supabase start` then `pnpm db:types` | `types.ts` byte-identical (`git diff --quiet` succeeded) |
| `pnpm test:integration` | exit 0 (run silent under `pnpm -s`, so no totals line); the integration cases also run inside the coverage run below |
| `pnpm --filter @hestia/service test:coverage` | `Test Files 77 passed (77)`, `Tests 1201 passed (1201)`; Statements 96.81%, Branches 86.61%, Functions 98.07%, Lines 98.67% |
| secret scan of every added line since the planning commit | no token, key, JWT or tunnel-token shape |
| clean tree | `git status --porcelain` empty |

`supabase stop --no-backup` ran afterwards.

### E2E proof (Task 3)

```
107 passed (9.6m)
```

The count equals `.claude/CLAUDE.md`'s stated 107; spec 20's three tests were present, no failed/flaky/did-not-run line, and the last spec listed is `21-remove-member.spec.ts` (journey 8, light and dark, tests 106 and 107). The CA workaround was applied for the run only and reverted: afterwards `git status` is clean, `docker/ca.crt` does not exist, and `git grep` finds no `NODE_EXTRA_CA_CERTS` or `docker/ca.crt` under `docker/` or `.dockerignore`.

### Phase commits since the planning commit

`git log --oneline 90422bb..HEAD` lists 09-01 to 09-04 (feature, test and docs commits plus their SUMMARY and state commits) and this plan's `dc1ec70` and `f219d84`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docs commit subject unchanged, scopes absent**
- **Found during:** Task 1 commits
- **Issue:** The plan's subjects (`ci: ...`, `docs: ...`) already satisfy commitlint (unscoped, under 71 characters), so no adaptation was needed; the `(09-05)` scope the executor protocol suggests was omitted because the closed scope list rejects it, as in 09-01 to 09-04.
- **Fix:** Used the plan's exact subjects. Hooks were not bypassed.
- **Commits:** dc1ec70, f219d84

**Total deviations:** 1 (a note on commit scope, no repository behavior impact). **Impact:** none.

## Issues Encountered

- `pnpm -s test:integration` prints no totals line, so only its exit status (0) is on record; the same suites contributed to the 1201 passing tests in the service coverage run.
- The sandbox needed the Supabase image workaround recorded in 09-01-SUMMARY (images pulled by digest from Docker Hub and tagged locally); `supabase start` additionally pulled `ghcr.io/supabase/studio` successfully. No repository file changed for either.

## Known Stubs

None.

## Threat Flags

None. The plan's register is covered: T-09-20 (allowlist is three entries and one exact quote, with sibling-path and quote-scoping cases and the probe clone), T-09-21 (status 0 and 1 accepted, anything else exits 2), T-09-22 (workaround reverted and grepped), T-09-23 (secret scan clean). T-09-24 is transferred to the owner's live check.

## Next Phase Readiness

Phase 9 is complete in the repository. Nothing was pushed and no pull request was opened.

## Reminder for the owner

Steps 1-6 of `.planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-OWNER-CHECKLIST.md` gate the merge: the zone, the tunnel and token, the route to `http://caddy:8080`, the `.env` edit, a backup and the PR notes. After the first deploy (steps 7-10), open `https://hestia.aberrance.app`, add a list item on one device and watch it appear on another with no CSP violation in the console, then check that `remoteAddress` in `hestia-compose logs --since 5m hestia-service` shows the visitor's public address and never a `172.16.238.x` one, and that `POST https://hestia.aberrance.app/auth/v1/signup` returns 403.

## Self-Check: PASSED

- Files exist: `scripts/check-repo-hygiene.mjs`, `scripts/check-repo-hygiene.test.mjs`, `docs/testing.md`, `docs/file-map.md`, `CONTRIBUTING.md`.
- Commits `dc1ec70` and `f219d84` are ancestors of HEAD; `git rev-list --count 6e67356..HEAD` before this SUMMARY commit: 2.
