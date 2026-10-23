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
