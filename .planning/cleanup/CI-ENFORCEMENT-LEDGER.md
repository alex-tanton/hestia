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
