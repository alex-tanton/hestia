# CI setup action ledger (PR A: RED-01, RED-02)

base=c64d79e41ae7daab9ca48e3841a08db1446c64e5
phase-base=c64d79e41ae7daab9ca48e3841a08db1446c64e5
branch=ci/setup-action
worktree=../hearth-ci-setup

## Owner decisions

| Decision | Owner chose                                  | Delivered                                                                                       | Why                                                                                 | Where the owner sees it |
| -------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------- |
| D-12     | composite of four steps including checkout | composite of three steps; each job keeps actions/checkout@v7 as its first step | a local action is read from the checked-out repository, so it cannot run checkout itself | PR A body (05-03)       |

pr-a-body-d12=Deviation from D-12, flagged for you: you chose a composite of four steps including checkout, but a local action is read from the checked-out repository and cannot run checkout itself, so each job keeps actions/checkout@v7 as its first step and the composite holds the other three.

## RED-01 composite action

expand-compare=OK
expand-compare-output=OK: expanded workflow deep-equals the original; jobs: lint, typecheck, test-unit, test-integration, test-e2e, build
expand-compare-negative=exit 1 (cache npm)
actionlint-ci=exit 0

Commit in `ci/setup-action`: 86666b222ea7d24015311dfb17df0aa32704325c (`ci: share one setup action across the six CI jobs`).

Steps per job, before and after (the Supabase CLI step stays inline in the two jobs that use it):

| Job              | Before                                                                                     | After                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| lint             | checkout, pnpm/action-setup, actions/setup-node, install, `pnpm lint`, `pnpm format:check` | checkout, `./.github/actions/setup`, `pnpm lint`, `pnpm format:check`                   |
| typecheck        | checkout, pnpm/action-setup, actions/setup-node, install, `pnpm typecheck`                | checkout, `./.github/actions/setup`, `pnpm typecheck`                                   |
| test-unit        | checkout, pnpm/action-setup, actions/setup-node, install, `pnpm test`                      | checkout, `./.github/actions/setup`, `pnpm test`                                        |
| test-integration | checkout, pnpm/action-setup, actions/setup-node, install, supabase/setup-cli, own steps    | checkout, `./.github/actions/setup`, supabase/setup-cli, the same own steps             |
| test-e2e         | checkout, pnpm/action-setup, actions/setup-node, install, supabase/setup-cli, own steps    | checkout, `./.github/actions/setup`, supabase/setup-cli, the same own steps             |
| build            | checkout, pnpm/action-setup, actions/setup-node, install, `pnpm build`                     | checkout, `./.github/actions/setup`, `pnpm build`                                       |

## RED-02 seed typecheck

Before (`.planning/cleanup/logs/05-01-typecheck-before.log`):

```text
apps/service typecheck$ tsc --noEmit && tsc --noEmit -p ../../supabase/seed
supabase/seed typecheck$ tsc --noEmit
```

After (`05-01-typecheck-after.log`):

```text
apps/service typecheck$ tsc --noEmit
supabase/seed typecheck$ tsc --noEmit
```

typecheck-after=seed once

Workspace test counts are equal before and after (`Tests  N passed`): matching 156, shared 172,
recurrence 77, service 757, web 728. `pnpm test:harness` passes on Node 24.

## Workflow comments (RED-04)

deploy-yaml-equal=yes
workflow-citations=0

The comment above `deploy.yml`'s `changes` step and the one above `pnpm test:e2e` in `ci.yml` no
longer cite the retired spec; the parsed `deploy.yml` equals its base and `expand-compare.mjs` still
prints OK. `git grep -nE -f cit-rx.txt -- .github` prints nothing. Dependabot's `github-actions`
entry scans `/` and `/.github/actions/setup`.

## Push

Branch `ci/setup-action` in `../hearth-ci-setup` has three commits on `base=`:
86666b2 (composite action), cfc666a (single seed typecheck), 2344443 (Dependabot directory and
comments). Its diff against `phase-base` is exactly the five files `.github/actions/setup/action.yml`,
`.github/dependabot.yml`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` and
`apps/service/package.json`.

Push with `GH_TOKEN` was refused by GitHub:
`refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope`.
The refused content is not pushed through any other ref.

pr-a-push=fallback
tree=fd704a4c1fbb066fb7402eaee02a950aae456177
owner-command=git fetch origin && bash <(git show origin/claude/eloquent-mayer-szjtjf:.planning/cleanup/patches/ci-setup-action/apply.sh)

The three patches and `apply.sh` are under `.planning/cleanup/patches/ci-setup-action/`.

dry-run=tree-match

`DRY_RUN=1 bash apply.sh` rebuilt the branch from the pushed patches onto `base=` and printed
`tree matches (fd704a4c1fbb066fb7402eaee02a950aae456177)`.

The owner pushed `ci/setup-action` by running `apply.sh` from their own clone. On Windows Git Bash
the owner had to set `MSYS_NO_PATHCONV=1` for the command to work (Git Bash otherwise rewrites the
`origin/...:path` and `HEAD:refs/heads/...` arguments as Windows paths).

pr-a-head=43672635ca3fafe9c46c87c10c4fb0d96f6757e1
pr-a-tree-match=yes

`git ls-remote --heads origin ci/setup-action` returns the head above; its tree is
`fd704a4c1fbb066fb7402eaee02a950aae456177`, equal to `tree=`, and its diff against `origin/main` is
exactly the five planned files. The head SHA differs from the local `2344443` only because `git am`
re-committed the patches.

## CI

pr-a=26
pr-a-url=https://github.com/alex-tanton/hearth/pull/26
pr-a-title=ci: share one setup action across the CI jobs

PR A opened through REST from `ci/setup-action` into `main` at `pr-a-head=` (tree `fd704a4c…`,
equal to `tree=`). Its files outside `.planning/` are exactly the five planned files, and GitHub
reports it `clean` and not merged. The PR body carries the `pr-a-body-d12=` sentence word for word.

pr-a-ci=lint:success typecheck:success test-unit:success test-integration:success test-e2e:success build:success run=39650921896

The run is attempt 1 (no re-run, no registry flake). Job ids: lint 119398705635, typecheck
119398705202, test-unit 119398705613, test-integration 119398705874, test-e2e 119398705669, build
119398705665.

### Job steps, before and after

Before: `main`'s last green `CI` run before PR A, run 39645569683 on `c64d79e` (the PR's base).
After: run 39650921896 on PR A's head. Both lists are the `steps[].name` of the jobs API.

| Job              | Before (steps 2 onward)                                                                                                                                                                                       | After (steps 2 onward)                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| lint             | checkout; pnpm/action-setup@v6; actions/setup-node@v7; pnpm install --frozen-lockfile; pnpm lint; pnpm format:check; post: setup-node, pnpm/action-setup, checkout                                            | checkout; `./.github/actions/setup`; pnpm lint; pnpm format:check; post: setup, checkout      |
| typecheck        | checkout; pnpm/action-setup@v6; actions/setup-node@v7; pnpm install --frozen-lockfile; pnpm typecheck; post: setup-node, pnpm/action-setup, checkout                                                          | checkout; `./.github/actions/setup`; pnpm typecheck; post: setup, checkout                    |
| test-unit        | checkout; pnpm/action-setup@v6; actions/setup-node@v7; pnpm install --frozen-lockfile; pnpm test; post: setup-node, pnpm/action-setup, checkout                                                              | checkout; `./.github/actions/setup`; pnpm test; post: setup, checkout                         |
| test-integration | checkout; pnpm/action-setup@v6; actions/setup-node@v7; pnpm install --frozen-lockfile; supabase/setup-cli@v3; Start Supabase; pnpm --filter @hearth/service test:coverage; post: supabase, setup-node, pnpm, checkout | checkout; `./.github/actions/setup`; supabase/setup-cli@v3; Start Supabase; test:coverage; post: supabase, setup, checkout |
| test-e2e         | checkout; pnpm/action-setup@v6; actions/setup-node@v7; pnpm install --frozen-lockfile; supabase/setup-cli@v3; playwright install; ghcr and Docker Hub logins; ci-prepull-images; pnpm test:e2e; upload-artifact; post: logins, supabase, setup-node, pnpm, checkout | checkout; `./.github/actions/setup`; supabase/setup-cli@v3; playwright install; ghcr and Docker Hub logins; ci-prepull-images; pnpm test:e2e; upload-artifact; post: logins, supabase, setup, checkout |
| build            | checkout; pnpm/action-setup@v6; actions/setup-node@v7; pnpm install --frozen-lockfile; pnpm build; post: setup-node, pnpm/action-setup, checkout                                                             | checkout; `./.github/actions/setup`; pnpm build; post: setup, checkout                        |

In every job the before steps `Run pnpm/action-setup@v6`, `Run actions/setup-node@v7` and
`Run pnpm install --frozen-lockfile` became one `Run ./.github/actions/setup` step, and the two
post steps `Post Run actions/setup-node@v7` and `Post Run pnpm/action-setup@v6` became one
`Post Run ./.github/actions/setup`. A programmatic collapse of the before lists (those steps replaced
by the composite) equals the after lists for all six jobs. Nothing else differs.

steps-compare=as-expected

The setup step's section of the `typecheck` job log (`05-03-setup-step.log`) shows the three
sub-steps ran inside `Run ./.github/actions/setup`: `Run pnpm/action-setup@v6` (self-installer),
`Run actions/setup-node@v7` (Node v24.21.0, pnpm cache hit and restored) and
`Run pnpm install --frozen-lockfile` (869 packages added, done).

### Seed typecheck in CI

The `typecheck` job log (`05-03-typecheck.log`) runs `pnpm typecheck` over seven workspaces and
prints `supabase/seed typecheck$ tsc --noEmit` once, and the service's line is
`apps/service typecheck$ tsc --noEmit` alone.

ci-seed-typecheck=once

## Gates and decisions

- The plan names the working branch `claude/vigilant-gates-a4ihid`. The session's checkout is on `claude/eloquent-mayer-szjtjf`, which is the only working branch that exists (no `claude/vigilant-gates-a4ihid` locally or on `origin`), and the orchestrator directed commits to it. This plan therefore treats `claude/eloquent-mayer-szjtjf` as WB; later plans must do the same or the owner must say otherwise.
- Environment: Node v24.21.0 from `/opt/node-v24/bin`; the shell default is Node 22.22.0.
