# Fix ledger: CI image pulls from GHCR first (quick 261020-wnk)

base=48c111f79ecde910636805976752c94b5f615802
branch=ci/pull-supabase-from-ghcr
worktree=../hearth-ci-pull
commits=871ff4dffe9e17656514f80e4fb297670611d2d2 d25d8e66617b7bc12310c969e92d5593af6cee3d
pushed=none (local tip d25d8e66617b7bc12310c969e92d5593af6cee3d; the push was rejected, see Push status)
pr=none (the owner opens it and squash-merges; proposed title: ci: pull the Supabase test images from GHCR first)

Raw logs are `.planning/cleanup/logs/261020-wnk-*.log` (gitignored).

## Push status

`git push -u origin ci/pull-supabase-from-ghcr` was rejected by GitHub:

```text
! [remote rejected] ci/pull-supabase-from-ghcr -> ci/pull-supabase-from-ghcr (refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope)
```

The session's token has no `workflow` scope, and the branch changes `.github/workflows/ci.yml`. No other route was tried. The branch exists only in the worktree `../hearth-ci-pull` on this machine, and `git ls-remote --heads origin ci/pull-supabase-from-ghcr` prints nothing. To publish it, push from a credential with the `workflow` scope: `git -C ../hearth-ci-pull push -u origin ci/pull-supabase-from-ghcr`. Nothing about the commits needs to change.

## Why

- Main CI run 39465074029, attempt 1, job 118774234646: test-e2e failed pulling the gotrue image with `toomanyrequests`, before any test ran.
- PR 19 run 39510640048, jobs 118930495707 and 118933942180: both attempts exhausted six pulls of `public.ecr.aws/supabase/gotrue:v2.196.0` with `toomanyrequests: Data limit exceeded` (logs `pr19-e2e-attempt1.log`, `pr19-e2e-attempt2.log`). `pr19-e2e-attempt3.log` shows a third attempt failing the same way.
- PR 3 runs 39457296052 and 39460683347: the earlier E2E flakes the owner listed. Per `FIX-LEDGER-INFRA.md`, their attempt-1 failures were test flakes outside spec 08, and their saved logs have no `toomanyrequests`. They are context, not evidence for this change.

## Digests

Taken 2026-10-20 with an anonymous registry token, a manifest HEAD request and the `Docker-Content-Digest` header, on ghcr.io and public.ecr.aws (`261020-wnk-digests.log`):

```text
gotrue:v2.196.0 ghcr=sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232 ecr=sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232 equal=yes
postgres:17.6.1.167 ghcr=sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb ecr=sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb equal=yes
realtime:v2.130.0 ghcr=sha256:002193c9ff840a4946918641901bb6aa9e2036dc9ff7590e2b11e91d1e06bf86 ecr=sha256:002193c9ff840a4946918641901bb6aa9e2036dc9ff7590e2b11e91d1e06bf86 equal=yes
```

Tags stay mutable on both registries, as before. Production keeps pulling the unchanged ECR names.

## Red and green

| FIX | Test | Red (unfixed) | Green (fixed) | Commit |
| --- | --- | --- | --- | --- |
| CI-PULL | `scripts/ci-prepull-images.test.mjs`, ten cases | `node --test ../hearth-ci-pull/scripts/ci-prepull-images.test.mjs` against the no-GHCR variant (`261020-wnk-variant.sh`, never committed): exit=1, `ℹ pass 6`, `ℹ fail 4`. Failing: `pulls each public.ecr.aws/supabase image from ghcr.io first and tags it with its ECR name` (`AssertionError: ghcr.io/supabase/postgres:1.0.0.1 was never pulled`), `falls back to public.ecr.aws when the ghcr.io pull fails`, `tries ghcr.io again in every attempt before public.ecr.aws`, `sends every Supabase image in the real docker/ files through ghcr.io` | same command against the real script: exit=0, `ℹ pass 10`, `ℹ fail 0`. `pnpm test:harness`: exit=0, `ℹ tests 231`, `ℹ pass 231`, `ℹ fail 0` | 871ff4dffe9e17656514f80e4fb297670611d2d2 |

The six kept-behavior cases (Docker Hub direct, present image skipped, six attempts with `::error::`, delay scaling, hearth and backup images never pulled, unsafe name refused) pass on both the variant and the real script.

Gates in `../hearth-ci-pull` on the final head: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `bash -n scripts/ci-prepull-images.sh` and `commitlint --from origin/main --to HEAD` all exit=0, and the structural check prints `ci.yml structure ok`. The `pnpm test` run: harness `ℹ tests 231`, `ℹ pass 231`, `ℹ fail 0`; workspaces matching 156, shared 172, recurrence 77, service 757 and web 726 tests passed.

The real files with a stub `docker` (`261020-wnk-derive.log`, exit=0) derive today's seven images: `caddy:2.11.7-alpine`, `docker/dockerfile:1`, `kong/kong:3.9.3`, `node:24.21.0-bookworm-slim` and the three ECR images. The calls log (`261020-wnk-derive-calls.log`) has, for each Supabase image, a pull from ghcr.io and the tag back:

```text
docker tag ghcr.io/supabase/gotrue:v2.196.0 public.ecr.aws/supabase/gotrue:v2.196.0
docker tag ghcr.io/supabase/postgres:17.6.1.167 public.ecr.aws/supabase/postgres:17.6.1.167
docker tag ghcr.io/supabase/realtime:v2.130.0 public.ecr.aws/supabase/realtime:v2.130.0
```

The four Docker Hub images are pulled directly. No `hearth-` or `prodrigestivill/` image is pulled.

## Findings

- (a) What changed. Each attempt tries GHCR, then ECR, then waits. This is the planner's reading of "falling back to the ECR pull with the same backoff", accepted by the owner, so a transient GHCR failure is retried too. Compose and production image names are unchanged.
- (b) The real proof is the PR's own `test-e2e` run on GitHub-hosted runners. Nothing here pulled a real image (no Docker daemon). Until that run passes, the fix is unproven in CI. The branch must first be pushed (see Push status).
- (c) test-integration's `supabase start` (Supabase CLI 2.117.0) still pulls from public.ecr.aws. It is out of scope and can still hit the limit; `04-02-run-a-integration.log` shows `toomanyrequests: Rate exceeded` there.
- (d) Two optional repository secrets the owner may add: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, a read-only Docker Hub access token. Without them the Docker Hub login is skipped and nothing else changes. Forks and Dependabot runs never receive them.
- (e) Resolved by the owner's adjustment: both login steps (ghcr.io and the optional Docker Hub one) have `continue-on-error: true`, each with a comment. The GHCR images are public, so anonymous pulls work, and the script falls back to the ECR pull. A failed or misconfigured login therefore cannot fail the job before the fallback runs. The structural check pins the flag on both steps.
- (f) `docs/file-map.md` does not list the new script or test, following PR 3's precedent for `deploy.test.mjs`. It is left for the later cleanup phase (RED-05), as the owner accepted.
- (g) The test file was reformatted by the pre-commit hook (prettier). The green run and the harness run were repeated on the committed file, and the green and harness figures above are from those repeats. The red run was taken just before that rewrite, on the same test logic.
