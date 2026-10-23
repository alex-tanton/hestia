# Phase 6 CI enforcement ledger

Key lines are `key=value` at the start of a line; the last occurrence of a key wins.

base=a0d4d760d2a555d95165ab05878682887d14bcb0
main=cb808e6d360909ec9714b66d7216a2a319eaa57b

## Owner decisions

| ID | Decision | Source |
|----|----------|--------|
| OD-1 | CI-04 follows D-09: the allowlist starts empty, no `braces` entry; `braces` is reachable only through the `apps/service` devDependency `kysely-codegen`, so `pnpm audit --prod` never reports it and CI-04's "expiring allowance for braces" is moot; the audit script fails closed (exit 2) when the report has an `error` key or no `advisories` object, because `pnpm audit --json` exits 0 with an `error` object when the registry is unreachable. | owner, planning time |
| OD-2 | D-17 adapted: `workflow_dispatch` cannot run a workflow that is not on the default branch, so `sweep.yml` is proven by a local `pnpm test:sweep` (36 of 36 fixed-cell runs) plus its first `push` run after the merge; no temporary `pull_request` trigger. | owner, planning time |
| OD-3 | knip adopts the research-verified `knip.json` change (`ignore` of `.planning/**`, `ignoreDependencies` of `tailwindcss`, `node: false`, root entry `test/**/*.mjs!`); default mode must be 0 findings; production mode is compared with the 28-row baseline; every new non-test `scripts/*.mjs` gets a `!` entry. | owner, planning time |
| OD-4 | The four deploy-behavior findings are fixed in this phase and each is flagged in PR 2's body (D-20): (a) a docs-only tip superseding a pending code deploy, (b) `.planning/`-only pushes deploying, (c) a re-run of an old CI run deploying a stale SHA, (d) `persist-credentials` on the self-hosted deploy runner; a merge to `main` must still fire `deploy.yml` from the workflow named `CI`. | owner, planning time |
| DA-1 | The jscpd limit stays 2% (D-08), not tightened. | defaults applied, flagged |
| DA-2 | `sweep.yml`'s `push` trigger has `paths-ignore` for `docs/**` and `.planning/**`. | defaults applied, flagged |
| DA-3 | No committed structural workflow test (it would need `yaml` at the root); `$T/workflow-facts.mjs` (06-06) gives the ledger evidence instead. | defaults applied, flagged |
| DA-4 | The notification E2E spec flakiness is out of scope and deferred. | defaults applied, flagged |
| PC-1 | `check-knip-baseline.mjs` runs `knip-summary.mjs` as a child process, never imports it, so `scripts/knip-summary.mjs` stays a reported production finding (keep-reported) and the baseline stays 28 rows. | planner, flagged |
| PC-2 | The line-ending rule covers every tracked text file (index EOL `crlf` or `mixed` fails unless the path's attribute is `-text`); D-13's mode rule covers shebang files and `*.sh`. | planner, flagged |
| PC-3 | An allowlist entry needs a GHSA `id`, `expires` (YYYY-MM-DD, valid through that day, at most 180 days ahead) and a `reason`; an expired entry fails whether or not it matches; an unexpired unmatched entry prints a note. | planner, flagged |
| PC-4 | The sweep's today cell is added by `--with-today`, its instant can be fixed with `--today-instant`, and its zone is one of 11 zones indexed by the UTC epoch day modulo 11; the nightly cron is `17 5 * * *`. | planner, flagged |
| PC-5 | The deploy gate redeploys when the commit equals the running revision (a re-run, as today), deploys when the running revision is unknown or not in the history (as today, reason logged), skips a commit older than the running revision, and skips when nothing outside `docs/` and `.planning/` changed since it. | planner, flagged |
| PC-6 | Each hygiene-job check runs even when an earlier one failed. | planner, flagged |
| PC-7 | `persist-credentials: false` on every checkout in `ci.yml` and `sweep.yml` (research F8) as well as `deploy.yml` (OD-4 d). | planner, flagged |
| PC-8 | Migration ordering is not checked (D-11 allows any added file); listed for the owner. | planner, flagged |
| PC-9 | Timeouts 10 for `hygiene`, 60 for `sweep` and `deploy` (no run history). | planner, flagged |
| PC-10 | Each web coverage threshold is the measured value rounded down minus one point, never lower than today's value. | planner, flagged |
| PC-11 | Success criteria 1 and 2 are shown on CI by an owner-gated throwaway canary pull request; it edits a migration only if the owner opts in (D-03). | planner, flagged |

## Flagged assumptions

- A1: failure mail for a scheduled run goes to the author of the last `cron:` change; the owner's squash merge authors it, so the owner must have Actions notifications on.
- A2: the owner's plan is Free, Pro or Team with the included Linux minutes quoted in research Pitfall 11, and the nightly sweep fits in them.
- A3: `pnpm fetch --frozen-lockfile` in the Docker builds fetches only host-platform optional dependencies, so adding jscpd costs one native tarball in the BuildKit cache and nothing in the runtime image; measure in the PR.
- A4: the npm audit endpoint that pnpm 10.34.5 uses stays available; otherwise `hygiene` goes red until pnpm is upgraded.
- A6: the web coverage thresholds measured locally hold on the CI runner (v8 coverage is the same on Linux).
- A7: for `pull_request`, `actions/checkout` checks out the merge commit of the pull request into the base; the three-dot diff from `base.sha` is correct either way.
- A9: `persist-credentials: false` is safe for every `ci.yml` job (none pushes); the hygiene job uses full history from checkout.

## Pre-flight

pr1-base=a0d4d760d2a555d95165ab05878682887d14bcb0
node=v24.21.0
knip-default-before=7
knip-production-before=34

## Task 1: knip gate

knip-baseline-source=phase3-after-equal
knip-default=0
knip-production=baseline-equal
knip-baseline-rows=28
knip-negative=default-exit1,baseline-exit1
knip-blindspot-closed=yes

Notes: the first baseline run showed one extra row, `binaries scripts/check-knip-baseline.mjs knip`: knip resolved the literal `pnpm --silent knip:production` arguments in the checker to the `knip` binary and reported that devDependency as unlisted in production mode. The arguments are now a module constant, the production run is byte-equal to the Phase 3 summary, and `knip.json` gained nothing beyond the planned keys. Raw logs: `.planning/cleanup/logs/06-01-knip-*` (gitignored).

## Task 2: repository hygiene gate

modes-fixed=3
hygiene-live=clean scripts=12
hygiene-negative=3-modes

Notes: the three scripts are `.planning/cleanup/tools/comment-only-controls.sh`, `.planning/environment/cloud-check.sh` and `.planning/environment/cloud-setup.sh` (mode `100755` on WB at `0b1ffe6`, in `ci/gate-scripts` through the WB merge). The negative control ran the new script on a detached worktree of `pr1-base` (the tree before the mode fix) and named exactly those three paths; the worktree is removed. Raw log: `.planning/cleanup/logs/06-01-hygiene-live.log` (gitignored).

## Task 3: migration append-only gate

migrations-live=pass

Notes: `--base origin/main` printed `migrations: 0 added, nothing else changed` (PR 1 adds no migration); the all-zero base exited 2. Raw log: `.planning/cleanup/logs/06-01-migrations-live.log` (gitignored).
pr1-branch-push=e5895b2fd62069c06e28774e200a514119da4824

## Plan 06-02 Task 1: audit gate

audit-script-commit=e66a70a (ci/gate-scripts, local; not pushed until the audit finding below is decided)
audit-prod-live=2-advisories-exit1
audit-negative=expired-exit1
braces=dev-only path=apps__service>kysely-codegen>micromatch>braces ghsa=GHSA-vfj7-8cjw-p6xm
ci04-braces-note=braces is reachable only through kysely-codegen, a devDependency of @hearth/service, so pnpm audit --prod cannot report it; the allowlist starts empty per D-09 and OD-1; the expiring-allowance mechanism is proven by scripts/audit-prod.test.mjs with the braces advisory as its fixture.
dependabot-alert-1=open GHSA-vfj7-8cjw-p6xm braces runtime

Notes:

- The live run did not exit 0. `pnpm audit --prod --json` (2026-10-23) reports two production advisories, both published 2026-10-22, after the research snapshot: `GHSA-389g-gv7q-r4x8` fastify (low, `>=5.12.2 <5.12.6`, patched `>=5.12.6`, installed 5.12.5, path `apps__service>fastify`) and `GHSA-rxp7-6hxx-x8q5` ip-address (moderate, `<=10.7.3`, patched `>=10.7.4`, installed 10.7.3, path `apps__service>@fastify/rate-limit>ip-address`). This is the research Pitfall 10 case. Per the plan, nothing was allowlisted and no dependency was changed; the owner decides.
- The negative control exited 1 with `allowance expired on 2026-01-01` for the braces entry (the two live advisories were reported beside it), so `audit-negative` is true; it is not evidence of a clean tree.
- `pnpm audit --json` without `--prod` today lists 10 advisories (vite x6, @vitest/mocker x2, fastify, ip-address) and no longer lists `GHSA-vfj7-8cjw-p6xm`; the braces path above is from `pnpm -r why braces` (braces 3.0.3, micromatch 4.0.8, kysely-codegen 0.20.0, `@hearth/service` devDependencies). GitHub's Dependabot alert 1 for braces is still open and shows scope `runtime`, which is GitHub's own classification; pnpm's graph has it dev-only.
- Raw logs (gitignored): `.planning/cleanup/logs/06-02-audit-prod.json`, `06-02-audit-full.json`, `06-02-why-braces.log`, `06-02-audit-live.log`, `06-02-audit-negative.log`.

## Plan 06-02 owner replies

audit-decision=bump-deps-first 2026-10-23 (owner: fix the two production advisories by upgrading; the allowlist stays empty; an explicit exception to phase rule 3 for this step only, on its own branch deps/fix-prod-advisories, not on ci/gate-scripts)
jscpd-legitimacy=approve-jscpd-5.4.1 2026-10-23

## Plan 06-02 audit fix branch

audit-fix-branch=89d2aac9dbc167820b347dcacb53429047ec2d6d
audit-prod-live=clean-on-fix-branch

Notes:

- Owner-approved exception to phase rule 3 for this step only: branch `deps/fix-prod-advisories` (worktree `/home/user/hearth-audit-fix`, cut from `origin/main` at `cb808e6`, pushed, no pull request opened) holds one commit. It exact-pins `fastify` 5.12.5 to 5.12.6 in `apps/service/package.json` and adds the root `pnpm.overrides` entry `"ip-address": "10.7.4"`; `pnpm-lock.yaml` changed by 19 lines, regenerated by `pnpm install --no-frozen-lockfile`, and only fastify and ip-address moved.
- Why an override: the newest `@fastify/rate-limit` (11.2.1) still depends on `ip-address ^10.2.0`, so upgrading it does not move the lockfile entry from 10.7.3. `pnpm update ip-address` and `pnpm update fastify@5.12.6` re-resolved 300+ lockfile lines (rollup, browserslist and others), so the override is the smaller change.
- Evidence on that branch: `pnpm audit --prod` reports `No known vulnerabilities found`; `node scripts/audit-prod.mjs --report` on its `pnpm audit --prod --json` output exits 0 (`0 advisories, 0 allowed, 0 problems`); `pnpm lint`, `format:check`, `typecheck` and `pnpm test` (service 757, web 728) exit 0; the service builds. Logs: `.planning/cleanup/logs/06-02-fix-*.log`, `06-02-audit-fixbranch.*` (gitignored). `audit-prod.mjs` has no repository option, so it was fed the report from the fix worktree.
- `ci/gate-scripts` itself stays red on `audit-prod.mjs` (2 advisories) until `deps/fix-prod-advisories` merges into `main`; merge it before PR 1's gate is wired by PR 2, and merge `main` into WB afterwards. The owner merges it; Claude opens no pull request for it unless asked. The verify clause `audit-prod-live=clean` for Task 1 is satisfied by the fix-branch evidence (deviation, recorded in the 06-02 SUMMARY).

## Plan 06-02 Task 3: duplication gate

jscpd-pre=e66a70ab452e6814c60283b2cd26b28ca9332b91
jscpd-commit=cb14138 (ci/gate-scripts)
jscpd-clones=66
jscpd-duplicated-lines=858
jscpd-percentage=1.11
jscpd-deterministic=yes
jscpd-limit=2
jscpd-negative=threshold1-exit1
jscpd-wording-note=The roadmap says "source duplication" but D-08 gates the test-inclusive percentage (tsx and typescript, tests included, DA-1 keeps the limit at 2); the recorded figure is the test-inclusive one: 66 clones, 858 duplicated lines, 1.11% (tsx 1.87%, typescript 0.75%), equal to the Phase 5 final figure.

Notes:

- `pnpm add -Dw --save-exact jscpd@5.4.1` (after the owner's reply) added 2 lines of devDependency and 87 lockfile lines, all package keys starting with `jscpd` (the main package and eight `jscpd-*` platform packages); `pnpm install --frozen-lockfile` exits 0.
- Two runs of `pnpm exec jscpd --reporters json` gave identical totals (66, 858, 1.1145...) and identical sorted clone lists (66 entries). `pnpm jscpd` exits 0; `pnpm exec jscpd --threshold 1` exits 1. `scripts/jscpd-config.test.mjs` passes 5 of 5; `test:harness` passes 325 of 325 in W1; eslint, prettier, knip (exit 0) and the baseline check (28 rows) are clean.
- Deviation: the plan's Task 1 verify wants `audit-prod-live=clean` on ci/gate-scripts. The owner chose to fix the two advisories on `deps/fix-prod-advisories` (`audit-fix-branch=` above), so the clean run is on that branch and ci/gate-scripts stays red on `audit-prod.mjs` until it merges. Raw logs (gitignored): `.planning/cleanup/logs/06-02-jscpd*`, `06-02-frozen.log`.

pr1-branch-push=0c1fb89445bfeea72936d97af72721861e30112c

## Plan 06-03 Task 1: sweep today cell

sweep-today-commit=b14b733 (ci/gate-scripts)
sweep-local=42/42 fixed=36/36 today=6/6 now=2026-10-23T18:32:46.709Z tz=Europe/London
sweep-list-today=  today: HEARTH_TEST_NOW=2026-10-22T14:00:00.000Z TZ=Asia/Kolkata

Notes:

- `--with-today` adds one unit cell after the selected fixed cells; `--today-instant ISO` (validated by `parseTestNow`) fixes its instant. The zone is `TODAY_ZONES[floor(epoch ms / 86400000) % 11]`. Verified instants: `2026-10-22T14:00:00.000Z` is `Asia/Kolkata`, `2026-10-23T14:00:00.000Z` is `Europe/London`, `2026-10-21T23:59:59.999Z` is `America/Los_Angeles`. `sweep-list-today` above is the line `--list --with-today --today-instant 2026-10-22T14:00:00.000Z` printed; the live run's own instant (`now=` above) resolved to `Europe/London`.
- The local run was `node scripts/test-sweep.mjs --with-today --log-dir` on Node 24 with `TZ` unset: 36 fixed-cell runs (six cells by six workspaces) and 6 today-cell runs, all PASS, `sweep: 42/42 passed`. Its dependency state is `ci/gate-scripts` (the two production advisories are an audit matter, not a test matter).
- `scripts/test-sweep.test.mjs` passes 54 of 54 (it was 33 before; the 21 new cases cover the three fixed instants, the UTC day boundaries, an eleven-day rotation, the rejections, and a real two-cell run). Raw logs (gitignored): `.planning/cleanup/logs/06-03-sweep.log`, `06-03-sweep/`.

## Plan 06-03 Task 2: deploy gate

deploy-gate-commit=aca380c (ci/gate-scripts)
deploy-gate-tests=pass cases=36
hygiene-live=clean scripts=13

Notes:

- `scripts/deploy-gate.sh` (`100755`, shellcheck clean) compares HEAD with the revision label of `hearth-service:current`: HEAD older than it gives `deploy=false` (OD-4 c); only `docs/` and `.planning/` changed since it gives `deploy=false` (OD-4 a, b); a re-run, no image, a non-commit label, an unknown or diverged revision, or anything else changed gives `deploy=true` (PC-5). A bad `HEARTH_DEPLOY_SHA` (unset, not 40 lowercase hex digits, not HEAD) exits 1 with empty stdout before docker is asked.
- Beyond the plan's list, the diff is read with `--no-renames` so code moved into `docs/` is still seen as a code change, and a git ancestry check that cannot decide (a shallow clone) deploys with the reason on stderr. `.github/workflows/deploy.yml` is untouched; PR 2 wires the gate in.

pr1-branch-push=22d7f26048656123f2f0b16285071e3fa96ec331

## Plan 06-04 Task 1: PR 1 docs

docs-commit=d0e985d (ci/gate-scripts, local; pushed with Task 2)
docs-claims-pr1=checked=2746 misses=0

Notes:

- `docs/testing.md` now counts fifteen `node --test` files (two in `e2e/support`, thirteen harness tests), lists the six new harness tests, documents `--with-today` and `--today-instant`, and replaces the on-demand dlx jscpd command with `pnpm jscpd` and `.jscpd.json`; "Analysis tools" now covers the knip baseline check, jscpd (1.11%), the audit and its allowlist rules, the hygiene check and the migration check, and says they are local commands that start running in CI with PR 2. `docs/file-map.md` has rows for the thirteen new files under `scripts/` and for `.jscpd.json`, and a longer `scripts/` summary. Neither file claims CI runs a gate or that `deploy.yml` calls `deploy-gate.sh`.
- The first claims run reported 3 misses: `hearth-service:current` (a Docker image reference) and `i/lf` (a column of `git ls-files --eol` output, already in `CONTRIBUTING.md` on `main`) were added to `docs-claims-allow.tsv` with reasons; a bare `.sh` token in the new hygiene text was reworded.
- Raw log: `.planning/cleanup/logs/06-04-docs-claims.log` (gitignored).

## Plan 06-04 Task 2: local proof on ci/gate-scripts

harness-files=13
gates-local=frozen,lint,format-check,typecheck,test,knip,knip-baseline,jscpd,audit,hygiene,migrations,build,commitlint all exit=0 (audit against the fix-branch report, see Notes)
pr1-head=f79f84eb51be0d109f8884426aa9ed3527cf3415
pr1-tree=153eae06a1462353c42bf426762511b7c7828db9
pr1-files=.jscpd.json docs/file-map.md docs/testing.md knip.json package.json pnpm-lock.yaml scripts/audit-allowlist.json scripts/audit-prod.mjs scripts/audit-prod.test.mjs scripts/check-knip-baseline.mjs scripts/check-knip-baseline.test.mjs scripts/check-migrations-append-only.mjs scripts/check-migrations-append-only.test.mjs scripts/check-repo-hygiene.mjs scripts/check-repo-hygiene.test.mjs scripts/deploy-gate.sh scripts/deploy-gate.test.mjs scripts/jscpd-config.test.mjs scripts/knip-production-baseline.txt scripts/test-sweep.mjs scripts/test-sweep.test.mjs

Notes:

- Every gate ran in W1 at `d0e985d` into `.planning/cleanup/logs/06-04-{name}.log` (gitignored), each ending `exit=0`. `pnpm test`: 13 harness files (382 tests) then packages/matching 156, packages/shared 172, packages/recurrence 77, apps/service 757, apps/web 728 and e2e 15, all passing. `pnpm jscpd`: 66 clones, under the 2% limit. The knip baseline check: 28 rows match. `--base origin/main` migration check: 0 added, nothing else changed. Commitlint over `origin/main..HEAD` passed.
- Deviation (audit): `node scripts/audit-prod.mjs` on ci/gate-scripts is red (`exit=1`, 2 advisories: `GHSA-389g-gv7q-r4x8` fastify and `GHSA-rxp7-6hxx-x8q5` ip-address), as recorded under 06-02, because `deps/fix-prod-advisories` (PR #32) is not on `main` yet. That run is kept as `06-04-audit-live.log`. `06-04-audit.log` is the script run with `--report` on the fix-branch `pnpm audit --prod --json` output saved in 06-02 (`06-02-audit-fixbranch.json`): `0 advisories, 0 allowed, 0 problems`, `exit=0`. PR 1's own CI does not run the audit; merge PR #32 before PR 2 wires the gate.
- After merging WB into W1 (`f79f84e`) hygiene (13 scripts clean), `pnpm knip` (exit 0) and the baseline check were rerun and are clean; the secret scan over `git diff origin/main...HEAD` matched nothing; the branch touches nothing under `.github/`, `supabase/migrations/` or `apps/service/src/db/types.ts`. `origin/ci/gate-scripts` equals `pr1-head`.

## Plan 06-04 Task 3: owner gate

gate-pr1=approve-pr1

Notes:

- The owner pre-authorized opening PR 1 in the session, superseding the Task 3 question: Claude creates the pull request, tells the owner when CI has passed, and the owner merges it. Task 3 therefore asked nothing and 06-04 opened no pull request; 06-05 opens PR 1 from `ci/gate-scripts` at `pr1-head` and never merges it.

## Plan 06-05 Task 1: PR 1 opened, CI green

pr1=33
pr1-url=https://github.com/alex-tanton/hearth/pull/33
pr1-opened-head=f79f84eb51be0d109f8884426aa9ed3527cf3415
pr1-ci=lint:success typecheck:success test-unit:success test-integration:success test-e2e:success build:success run=40007205181
pr1-harness-on-ci=13

Notes:

- PR 1 (#33) was opened through REST from `ci/gate-scripts` at `pr1-head` into `main`, with the body kept at `.planning/cleanup/logs/06-05-pr1.md` (gitignored) and title `ci: add the CI gate scripts and their tests`. Claude does not merge it; the owner squash-merges.
- All six jobs of the `CI` pull_request run 40007205181 concluded `success` on the first attempt (no registry-flake rerun). The `test-unit` log shows `node --test` over the thirteen harness files, 382 of 382 passing; saved to `.planning/cleanup/logs/06-05-test-unit.log` (gitignored).

## Plan 06-05 Task 3: PR 1 merged, main's CI, Deploy

pr1-merged=b585d25f97920c4d15a0f65b3bc7fea6eb1bc0d7
main-ci-after-pr1=lint:success typecheck:success test-unit:success test-integration:success test-e2e:success build:success run=40009409885
deploy-after-pr1=40011784566 workflow_run pending job=none

Notes:

- The owner squash-merged PR #33 at 2026-10-23T19:11:17Z as `b585d25` (`ci: add the CI gate scripts and their tests`), after PR #32 (`f624a34`, the fastify and ip-address fix). The `CI` push run 40009409885 on `b585d25` sat `pending` for about two minutes, then ran; all six jobs concluded `success`.
- Deploy: two `workflow_run` Deploy runs exist for `b585d25`. 40009996509 (created 19:15:42Z) ended `cancelled` at 19:29:23Z, which is the `deploy` concurrency group replacing a pending run; 40011784566 (created 19:29:16Z) is `pending` with no jobs, held for the unregistered `hearth` self-hosted runner. An older run, 39788747697 for `cb808e6`, is also still `pending`. Nothing was cancelled or touched by Claude.

## Plan 06-06 Task 1: hygiene job (W2, not pushed)

pr2-base=d0c587c0b55cf3f4c68404b80d6ed7ad40f1c59f
hygiene-emulated=6/6
ci-facts-jobs=lint,typecheck,test-unit,test-integration,test-e2e,build,hygiene
ci-facts-name=CI

Notes:

- W2 is `/home/user/hearth-enforce-gates` on `ci/enforce-gates`, cut from the WB tip `d0c587c` (which is on `origin`, contains PR 1's `b585d25` and the dependency fix). The token cannot push workflow files, so W2 stays local and its commits are saved as patches under `.planning/cleanup/patches/ci-enforce-gates/` after each commit (phase rule 5).
- The six hygiene commands were read from the YAML by `.planning/cleanup/tools/workflow-facts.mjs` and run in W2 with `BASE_SHA` at `origin/main`: knip, the baseline check (28 rows), jscpd (66 clones), the audit (0 advisories, now green on a tree cut from `main` after PR #32), repository hygiene (971 files, 13 scripts) and the migration check (0 added). Logs: `.planning/cleanup/logs/06-06-hygiene-{3..8}.log` (gitignored).
- `actionlint` (ignoring only the self-hosted `hearth` label), prettier, `pnpm knip` and the baseline check pass on W2 after the commit.

## Plan 06-06 Task 2: coverage, db:types drift, timeouts (W2, not pushed)

coverage-measured=85.38/81.83/78.59/86.96
coverage-thresholds=84/80/77/85
coverage-negative=statements99-fail
test-unit-split=ok
db-types-run1=81209804cfa662518d6e0546e38ba4b02ca0bb467a1fc463400cf07867b7ffdb
db-types-run2=81209804cfa662518d6e0546e38ba4b02ca0bb467a1fc463400cf07867b7ffdb
db-types-committed=81209804cfa662518d6e0546e38ba4b02ca0bb467a1fc463400cf07867b7ffdb
db-types-deterministic=yes

Notes:

- Web coverage was measured in W2 on 2026-10-23 at `pr2-base` `d0c587c` (`pnpm --filter @hearth/web test:coverage`, exit 0; 3884/4549 statements, 2401/2934 branches, 1212/1542 functions, 3616/4158 lines). Thresholds are the measured value rounded down minus one (PC-10), all at or above today's 82/78/74/84. `test:coverage` passes at them; `vitest run --coverage --coverage.thresholds.statements=99` exits 1 (`Coverage for statements (85.38%) does not meet global threshold (99%)`).
- `test-unit` now runs `pnpm test:harness` (382 tests, exit 0), `pnpm -r --filter '!@hearth/web' test` (exit 0; output from `@hearth/service`, `@hearth/e2e`, `@hearth/matching`, `@hearth/recurrence` and `@hearth/shared`, nothing from `@hearth/web`; `@hearth/seed` has no `test` script) and `pnpm --filter @hearth/web test:coverage` (the measurement run above). Logs: `.planning/cleanup/logs/06-06-unit-{1,2,3}.log` (gitignored).
- `db:types` determinism: `supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,storage-api,postgrest,postgres-meta` on a fresh stack (Node 24.21.0), `pnpm db:types` twice gave the same sha256 as the committed `types.ts` blob, `git diff --exit-code -- apps/service/src/db/types.ts` exited 0, and the stack was stopped with `supabase stop --no-backup`. This equals the hash research recorded. The runner proof is PR 2's CI run (06-08).
- `ci.yml` after this commit: every job has the planned `timeout-minutes` (lint, typecheck, build, hygiene 10; test-unit 15; test-integration 25; test-e2e 40) and every checkout has `persist-credentials: false`; `run-interpolation=0`.

## Plan 06-06 Task 3: sweep.yml and deploy.yml (W2, not pushed)

deploy-wiring-smoke=deploy=true
sweep-facts=ok
deploy-facts=ok
pr2-commits=bc856fd ci: add a hygiene job that runs the repository gates; 6dab328 test(web): raise the coverage thresholds to the measured values; dc55e65 ci: enforce web coverage, db types drift and job timeouts; ccfb84a ci: run the date and time-zone sweep on main and nightly; a2bb317 ci: gate deploys on the running revision and keep no token
pr2-head-local=a2bb317 (ci/enforce-gates, not on origin: the token has no workflow scope)

Notes:

- `sweep.yml` is named `Sweep` with triggers `push` (main, `paths-ignore` `docs/**` and `.planning/**`), `schedule` (`17 5 * * *`) and `workflow_dispatch`, no `pull_request`; one job `sweep` (timeout 60, `persist-credentials: false`, `permissions: contents: read`) with the push step `pnpm test:sweep --log-dir sweep-logs`, the schedule and dispatch step `pnpm test:sweep --with-today --log-dir sweep-logs`, and a failure-only `sweep-logs` upload for 14 days. `node scripts/test-sweep.mjs --list --with-today` exits 0 and prints a `today:` line. Facts: `.planning/cleanup/logs/06-06-sweep-facts.txt` (gitignored).
- `deploy.yml` keeps `name: Deploy`, `workflows: [CI]`, `types: [completed]`, `branches: [main]`, the three-part `if`, job `deploy` and `[self-hosted, hearth]`; it adds `timeout-minutes: 60`, `fetch-depth: 0` and `persist-credentials: false` on the checkout, and the `changes` step runs `scripts/deploy-gate.sh >> "$GITHUB_OUTPUT"` with `HEARTH_DEPLOY_SHA` in `env`. Facts: `.planning/cleanup/logs/06-06-deploy-facts.txt` (gitignored); `run-interpolation=0` for all three workflows.
- Wiring smoke test: with a stub `docker` that exits 1 first on `PATH`, `GITHUB_OUTPUT` a temp file and `HEARTH_DEPLOY_SHA` the W2 HEAD, the `changes` command read from the YAML left exactly `deploy=true` in the file (the gate's stderr said the image does not exist; deploying).
- `actionlint` (ignoring only the `hearth` label) passes on all three workflows; prettier passes on `.github/workflows`; `pnpm knip` and the baseline check pass. The secret scan over the W2 diff matched nothing. The Deploy workflow still waits on an unregistered `hearth` self-hosted runner; it was not touched.

## Plan 06-07 Task 1: docs and CI-05 review (W2, not pushed)

docs-commit-pr2=45ca790 docs: describe the CI gates, the sweep workflow and the deploy gate (ci/enforce-gates, local)

Notes:

- `docs/testing.md` now states the web thresholds 84/80/77/85 and that `test-unit` runs `pnpm --filter @hearth/web test:coverage` while web's `test` script stays plain; that `test-unit` runs `pnpm test:harness` first, then every non-web workspace's `test` script; that `test-integration` regenerates `types.ts` with `pnpm db:types` and fails on a difference; `sweep.yml` (six fixed cells on `main` pushes that change more than `docs/` and `.planning/`, the today cell nightly at 05:17 UTC and in manual runs, `sweep-logs` artifact for 14 days, never gates or triggers a deploy); and that the `hygiene` job runs every check on every pull request and push, every step even after a failure, with the date-dependent audit and allowance expiry holding back a deploy on an unchanged tree. `docs/deploy.md` and `README.md` state the OD-4 rule (running-revision comparison through `scripts/deploy-gate.sh`; skips `docs/` and `.planning/` only changes and any commit older than the running one; redeploys the running commit; deploys when no labelled image runs; full history, no token). `docs/file-map.md` names `sweep.yml`, seven jobs, the `knip.json`, `.jscpd.json` and `deploy-gate.sh` rows and the knip tool row.
- `README.md` passes `prettier --check` (the `docs/` files are in `.prettierignore`). The stale-phrase search over W2's `docs/` and `README.md` prints nothing. `CONTRIBUTING.md`, `.claude/CLAUDE.md` and `.planning/codebase/*` are PR 3's (06-09).

## CI-05 review

Scope: `.github/workflows/ci.yml`, `.github/workflows/sweep.yml`, `.github/workflows/deploy.yml` and `.github/actions/setup/action.yml` on `ci/enforce-gates` at the docs commit above. Evidence: `actionlint -ignore 'label "hearth" is unknown'` over the three workflows (exit 0, no output; the ignore is only the self-hosted `hearth` label, F13); `workflow-facts.mjs` outputs for all three (`.planning/cleanup/logs/06-07-facts-{ci,sweep,deploy}.txt`, gitignored: every job has a timeout, `run-interpolation=0` in each, checkouts `false/unset` or `false/0` meaning `persist-credentials: false`); zizmor 1.31.1 offline over W2's `.github` (`docker run --rm -v $W2:/repo:ro ghcr.io/zizmorcore/zizmor:1.31.1 --offline /repo/.github`, log `.planning/cleanup/logs/06-07-zizmor.log`): 42 findings, 13 suppressed, 29 shown = 17 `unpinned-uses` (F7), 8 `self-repository` (a style hint to write `$/.github/actions/setup` for `./.github/actions/setup`, kept: the local path works and is what the repository uses), 3 `dependabot-cooldown` (F14), 1 `dangerous-triggers` (F5), and none for `artipacked`, `template-injection` or `excessive-permissions` (research's run had `artipacked` x7, now fixed, F8).

| Area | `ci.yml` | `sweep.yml` | `deploy.yml` | setup action | Disposition |
|------|----------|-------------|--------------|--------------|-------------|
| Triggers | `pull_request` and `push` to `main` | `push` to `main` (`paths-ignore` `docs/**`, `.planning/**`), `schedule` `17 5 * * *`, `workflow_dispatch`; no `pull_request` (OD-2) | `workflow_run` of `CI`, `completed`, `branches: [main]` | composite action, none | kept; the new workflow cannot trigger a deploy because it is named `Sweep` |
| Permissions | workflow `contents: read`; `test-e2e` adds `packages: read`; `hygiene` inherits read | workflow `contents: read` | workflow `contents: read` | inherits the caller's | kept (F9); no job writes |
| Concurrency | `ci-${{ github.ref }}`, cancels only for pull requests | `sweep-${{ github.ref }}`, never cancels | `deploy`, never cancels | none | kept (F2); the deploy ordering problem is fixed in the gate, not here |
| Secrets | optional `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, `GITHUB_TOKEN` (both logins `continue-on-error`) | none | none (the self-hosted job reads the host's `.env`, not a secret) | none | kept (F10) |
| `workflow_run` safety | not applicable | not applicable | `conclusion == 'success'` and `event == 'push'` and `head_branch == 'main'`, trigger limited to `branches: [main]`, checks out `workflow_run.head_sha`; a fork pull request run has event `pull_request` and is rejected; the gate receives the SHA through `env`, and it refuses a SHA that is not 40 lowercase hex or not HEAD | not applicable | kept (F5); zizmor's `dangerous-triggers` is this trigger and the guard is its mitigation |
| Action pinning | `checkout@v7`, `supabase/setup-cli@v3`, `docker/login-action@v4`, `upload-artifact@v7` | `checkout@v7`, `upload-artifact@v7` | `checkout@v7` | `pnpm/action-setup@v6`, `setup-node@v7` | kept (F7): tags, not SHAs; SHA pinning is CIX-01 and Dependabot bumps actions weekly |
| Caching | setup action's pnpm store cache; Playwright browsers reinstalled each run | same setup action | none | `setup-node` `cache: pnpm` | kept (F11): performance, not correctness |
| Artifacts | `playwright-report` on failure, 7 days | `sweep-logs/` only, on failure, 14 days, never the workspace | none | none | kept (F12) |
| Timeouts | lint, typecheck, build, hygiene 10; test-unit 15; test-integration 25; test-e2e 40 | 60 | 60 | not applicable | fixed in PR 2 (F1): `ci: enforce web coverage, db types drift and job timeouts` and the commits adding each job |
| Credentials | `persist-credentials: false` on all seven checkouts | `false` | `false` with `fetch-depth: 0` | not applicable | fixed in PR 2 (F8, OD-4 d): `ci: enforce web coverage, db types drift and job timeouts`, `ci: gate deploys on the running revision and keep no token` |
| Script injection | `run-interpolation=0`; the pull request base reaches the migration check through `env: BASE_SHA` | `run-interpolation=0` | `run-interpolation=0`; `HEARTH_DEPLOY_SHA` through `env` | the one `run:` is a fixed command | kept: no expression is interpolated into a `run:` |

| Finding | Evidence | Disposition |
|---------|----------|-------------|
| F1 | five of six jobs had no `timeout-minutes`; now every job in the three workflows has one (`workflow-facts` `job.*.timeout`) | fixed in PR 2: `ci: enforce web coverage, db types drift and job timeouts` (and `ci: add a hygiene job that runs the repository gates`, `ci: run the date and time-zone sweep on main and nightly`, `ci: gate deploys on the running revision and keep no token` for the new job and `deploy`) |
| F2 | `ci.yml` concurrency unchanged; main runs queue, a newer pending run replaces an older pending one | kept: correct for deploy ordering; the replaced-run case no longer loses a code deploy because the gate compares with the running revision (F3) |
| F3 | a code commit's Deploy replaced by a later docs-only run was never deployed (tip-only `HEAD~1..HEAD` diff) | fixed in PR 2: `ci: gate deploys on the running revision and keep no token` (the decision is `scripts/deploy-gate.sh`, 36 harness cases, from PR 1); this is OD-4 a |
| F4 | `.planning/`-only pushes deployed because only `^docs/` was exempt | fixed in PR 2: `ci: gate deploys on the running revision and keep no token` (the gate treats `docs/` and `.planning/` as not deployed code); this is OD-4 b |
| F5 | `deploy.yml` three-part `if`, `branches: [main]`, `head_sha` checkout; zizmor `dangerous-triggers` x1 | kept: the guard is the mitigation and was not weakened; the gate adds a SHA format check |
| F6 | a re-run of an older CI run on `main` would deploy its older `head_sha` | fixed in PR 2: `ci: gate deploys on the running revision and keep no token` (a commit that is an ancestor of the running revision gives `deploy=false`); this is OD-4 c |
| F7 | all actions tag-pinned; zizmor `unpinned-uses` x17 (research saw 14 before the sweep workflow and the hygiene job) | kept: SHA pinning is CIX-01 (v2, deferred) and Dependabot bumps actions weekly |
| F8 | zizmor `artipacked` x7 in research; now 0; `workflow-facts` shows `false` on every checkout | fixed in PR 2: `ci: enforce web coverage, db types drift and job timeouts` for `ci.yml`, `ci: run the date and time-zone sweep on main and nightly` for `sweep.yml`, `ci: gate deploys on the running revision and keep no token` for `deploy.yml` (OD-4 d) |
| F9 | workflow-level `contents: read` in all three; `test-e2e` adds `packages: read` | kept: `sweep.yml` has the same block |
| F10 | only the optional Docker Hub secrets and `GITHUB_TOKEN`; logins are `continue-on-error`; the new workflows read no secret | kept |
| F11 | `setup-node` `cache: pnpm`; Playwright browsers reinstalled every run | kept: performance, not correctness |
| F12 | Playwright report 7 days; the sweep uploads only `sweep-logs/` for 14 days on failure | kept: the sweep follows the same pattern |
| F13 | actionlint reports only the self-hosted label `hearth` as unknown; run with `-ignore 'label "hearth" is unknown'` it is clean for all three workflows | kept: adopting actionlint in CI would need a config file (not added) |
| F14 | zizmor `dependabot-cooldown` x3 | kept: not CI correctness; the owner may add `cooldown` to `.github/dependabot.yml` |
| F15 | the repository allows merge commits and rebase merges as well as squash | deferred: owner repository setting; the deploy gate now compares with the running revision, so a multi-commit merge is judged on the whole range, which removes the tip-only risk |
| F16 | `main` is not protected and has no rulesets | deferred: owner repository setting |
| F17 | `test-e2e` is the job that fails most (registry flakes and the notification specs) | deferred: DA-4 (the notification E2E spec flakiness is out of scope; registry flakes are re-run per phase rule 9) |
| OD-4 a | a docs-only tip superseding a pending code deploy | fixed in PR 2: `ci: gate deploys on the running revision and keep no token`; flagged to the owner in PR 2's body (D-20) |
| OD-4 b | `.planning/`-only pushes deployed | fixed in PR 2: `ci: gate deploys on the running revision and keep no token`; flagged to the owner in PR 2's body (D-20) |
| OD-4 c | a re-run of an old CI run deployed a stale SHA | fixed in PR 2: `ci: gate deploys on the running revision and keep no token`; flagged to the owner in PR 2's body (D-20) |
| OD-4 d | `persist-credentials` on the self-hosted deploy runner | fixed in PR 2: `ci: gate deploys on the running revision and keep no token` (`persist-credentials: false`, `fetch-depth: 0`); flagged to the owner in PR 2's body (D-20) |

ci05-review=complete findings=21

## Plan 06-07 Task 1: full local proof on W2

pr2-local=16/16

Notes:

- All sixteen gates ran in W2 at `45ca790` into `.planning/cleanup/logs/06-07-{name}.log` (gitignored), each ending `exit=0`: `frozen`, `lint`, `format-check`, `typecheck`, `test` (13 harness files, then matching 156, shared 172, recurrence 77, service 757, web 728, e2e 15), `knip`, `knip-baseline`, `jscpd`, `audit` (0 advisories, tree cut from `main` after PR #32), `hygiene`, `migrations` (`--base origin/main`), `web-coverage` (85.38/81.83/78.59/86.96 against 84/80/77/85), `build`, `actionlint` (all three workflows, only the `hearth` label ignored), `commitlint` (`d0c587c..HEAD`, six commits) and `docs-claims` (`checked=2767 misses=0` over W2's `docs/*.md`, `README.md`, `CONTRIBUTING.md`, `.planning/codebase/*.md` and `.claude/CLAUDE.md`; no allowlist change needed). W2 is clean at `45ca790`.

## Plan 06-07 Task 2: delivery of ci/enforce-gates

pr2-head=45ca790571ee5e0d49211bc45aa91f279bcfa0b4
pr2-tree=54069f099544ee0c93b741e935104ffe6a271acd
pr2-files=.github/workflows/ci.yml .github/workflows/deploy.yml .github/workflows/sweep.yml README.md apps/web/vite.config.ts docs/deploy.md docs/file-map.md docs/testing.md
pr2-push=fallback
pr2-push-refusal=refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope
owner-command=git fetch origin && git show origin/claude/confident-dirac-10eu0a:.planning/cleanup/patches/ci-enforce-gates/apply.sh > apply-ci-enforce-gates.sh && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' bash apply-ci-enforce-gates.sh

Notes:

- The secret scan over `git diff pr2-base..HEAD` in W2 matched nothing. The one token push (inline credential helper, no token on a command line) was refused by GitHub for the missing `workflow` scope; nothing was retried through another ref or shape. Log: `.planning/cleanup/logs/06-07-push.log` (gitignored).
- `.planning/cleanup/patches/ci-enforce-gates/` holds six patches, one per W2 commit (`pr2-base` `d0c587c`..`pr2-head`), and `apply.sh` (mode `100755`) pinning `BASE=d0c587c0b55cf3f4c68404b80d6ed7ad40f1c59f`, `TREE=pr2-tree` and `BRANCH=ci/enforce-gates`. It stops if `origin` already has the branch, applies with `git am --3way` in a temporary detached worktree, pushes only when the tree equals `TREE`, supports `DRY_RUN=1`, removes the worktree on exit and never reads or prints a token.

dry-run=tree-match
- Dry run from the primary checkout (`DRY_RUN=1 bash apply.sh`, log `.planning/cleanup/logs/06-07-apply-dry.log`, gitignored): six `git am --3way` applications onto `d0c587c`, built `ef4c6a6` and printed `tree matches (54069f0...)`; the temporary worktree was removed.

## Plan 06-07 Task 3: owner gate

pr2-pushed=0061269c32e30c9f84eb3d80198577888dd31084
pr2-pushed-tree-match=yes
gate-pr2=pushed approve-pr2 canary=with-migration (owner reply, 2026-10-23)
canary-choice=with-migration

Notes:

- The owner ran `owner-command=` from their own clone. `git ls-remote --heads origin ci/enforce-gates` returns `0061269c32e30c9f84eb3d80198577888dd31084`, and `gh api repos/alex-tanton/hearth/git/commits/0061269c32e30c9f84eb3d80198577888dd31084 --jq .tree.sha` returns `54069f099544ee0c93b741e935104ffe6a271acd`, equal to `pr2-tree=` (the commit SHA differs from `pr2-head=` because `git am` rewrites committer data; the tree is the identity).
- The owner saw the four deploy-behavior changes (OD-4 a to d) in the gate text and chose the canary with the one-line newest-migration edit (PC-11, D-03 exception). PR 2 is not opened yet; 06-08 opens it and puts OD-4 a to d in its body.

## Plan 06-08 Task 1: PR 2 opened, CI attempt 1

pr2=36
pr2-url=https://github.com/alex-tanton/hearth/pull/36
pr2-opened-head=0061269c32e30c9f84eb3d80198577888dd31084
pr2-ci-attempt1=lint:success typecheck:success test-unit:success test-integration:success test-e2e:failure build:success hygiene:success run=40017353021
pr2-hygiene-steps=knip:success,knip-production:success,jscpd:success,audit:success,hygiene:success,migrations:success
pr2-db-types-on-ci=success
pr2-runner-coverage=85.38/81.83/78.59/86.96
pr2-e2e-failure=tests/17-accessibility-states.spec.ts:497 notification type: saving, then a failed save (light) 103 passed 1 failed; not a registry flake; DA-4; job=120632739896

Notes:

- PR 2 (#36) was opened through REST from `ci/enforce-gates` at `0061269` (tree `54069f0`) into `main`, title `ci: block regressions and gate deploys on the running revision`, with `## Deploy behavior changes (flagged)` listing OD-4 a to d (body kept at `.planning/cleanup/logs/06-08-pr2.md`, gitignored). Claude does not merge it.
- Attempt 1 (run 40017353021): six of seven jobs `success`. `hygiene` ran all six check steps green, `test-integration` ran `db:types matches the migrated schema` green (the runner's generated file equals the committed bytes), and web coverage on the runner (`All files`) is 85.38/81.83/78.59/86.96 against thresholds 84/80/77/85.
- `test-e2e` failed on one spec: `17-accessibility-states.spec.ts:497`, light theme, `notification type: saving, then a failed save` (`getByText("Couldn't save that setting. Try again.")` not visible within 15 s); the same spec passed in the dark theme in the same run and 103 of 104 passed. No `toomanyrequests` in the log, so phase rule 9's registry-flake rerun does not apply; the notification E2E spec flakiness is DA-4 (out of scope), so a re-run is the owner's call. Logs (gitignored): `.planning/cleanup/logs/06-08-test-e2e.log`, `06-08-test-unit.log`.
- Canary prepared, not pushed: W3 `/home/user/hearth-gate-canaries` on `ci/gate-canaries` holds one commit `1d5cbf1` on top of `0061269` with every plant and the local pre-check logs `06-08-canary-local-*.log`. Deviation: `yaml@2.9.1` as an `apps/web` devDependency is not reported by knip (`yaml` is an optional peer dependency of installed packages such as vite, which knip counts as used), so the unused-dependency plant is `fastest-levenshtein@1.0.16` (already a dependency of `@hearth/matching`, no new lockfile entry; knip reports `Unused devDependencies fastest-levenshtein apps/web/package.json`).
