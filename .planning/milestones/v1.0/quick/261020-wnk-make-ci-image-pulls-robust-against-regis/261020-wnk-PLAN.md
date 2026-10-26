---
phase: quick-261020-wnk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # On branch ci/pull-supabase-from-ghcr, in the sibling worktree ../hearth-ci-pull:
  - .github/workflows/ci.yml
  - scripts/ci-prepull-images.sh
  - scripts/ci-prepull-images.test.mjs
  - package.json
  - docs/testing.md
  # On the session branch claude/trusting-lovelace-y4r87h (primary checkout):
  - .planning/cleanup/FIX-LEDGER-CI-PULL.md
autonomous: true
# Contributes to CI-05 (workflow robustness); it does not complete CI-05.
requirements: [CI-05]
user_setup:
  - service: dockerhub
    why: "Optional. Authenticated Docker Hub pulls in test-e2e get a higher rate limit. Without these two secrets the Docker Hub login step is skipped and everything else works."
    env_vars:
      - name: DOCKERHUB_USERNAME
        source: "GitHub -> repository Settings -> Secrets and variables -> Actions -> New repository secret (the Docker Hub user name)"
      - name: DOCKERHUB_TOKEN
        source: "Docker Hub -> Account settings -> Personal access tokens -> Generate, access Read-only; then add it as an Actions repository secret"

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "In CI's test-e2e job, each image named `public.ecr.aws/supabase/{name}:{tag}` in docker/docker-compose.yml is pulled from `ghcr.io/supabase/{name}:{tag}` first and tagged with its ECR name. Compose, the Dockerfiles and production image names do not change. When the GHCR pull fails, the job pulls the ECR name instead"
    - "The existing pre-pull behavior is kept. The image list is still derived from docker/docker-compose.yml and docker/*.Dockerfile (the BuildKit `# syntax=` frontend included), so a Dependabot bump needs no edit. Images already present locally are skipped. The hearth-built images, the backup image and build-stage names are never pulled. Each image gets up to six attempts with a growing delay (30, 60, 90, 120, 150 s). Each attempt tries GHCR, then ECR, for the Supabase images. After the sixth failed attempt the step exits nonzero with `::error::Could not pull {image} after 6 attempts`. `CI_PREPULL_DELAY_SCALE` multiplies the delays"
    - "Image names read from the files are checked against a conservative reference pattern before any pull, and are only ever passed as quoted docker arguments. An unsafe line is refused before anything is pulled, and its text is never executed"
    - "`scripts/ci-prepull-images.test.mjs` (ten cases, stub `docker` and `sleep` on PATH) runs red against a no-GHCR variant of the script: exactly the four GHCR cases fail. It runs green, 10 of 10, against the real script. It is wired into the root `test:harness`, so `pnpm test` and CI's test-unit run it"
    - "ci.yml's test-e2e job has job-level `permissions: {contents: read, packages: read}` and `env: DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}`. A ghcr.io login uses docker/login-action@v4 with `github.actor` and `secrets.GITHUB_TOKEN`. An optional Docker Hub login uses docker/login-action@v4 with `if: env.DOCKERHUB_USERNAME != ''` and the token from `secrets.DOCKERHUB_TOKEN`. Then comes `run: bash scripts/ci-prepull-images.sh`. Every other job, key and step is unchanged, and the YAML structural check proves this"
    - "The three images have equal manifest digests on ghcr.io and public.ecr.aws. This was checked at execution time and recorded"
    - "Branch ci/pull-supabase-from-ghcr is pushed from origin/main. Its diff against origin/main is exactly the five files. lint, format:check, typecheck, `pnpm test`, commitlint and `bash -n` pass on Node 24 with TZ unset. No pull request is opened"
    - "`.planning/cleanup/FIX-LEDGER-CI-PULL.md` is committed and pushed on the session branch. It records the base, branch, failing run ids, digests, red and green runs, the pushed SHA, `pr=none`, the out-of-scope `supabase start` note, and the two optional secrets"
  artifacts:
    - path: "scripts/ci-prepull-images.sh"
      provides: "the test-e2e pre-pull: derived list, name check, GHCR-first with tag-back for public.ecr.aws/supabase images, ECR fallback, six attempts with scaled backoff"
      contains: "CI_PREPULL_DELAY_SCALE"
    - path: "scripts/ci-prepull-images.test.mjs"
      provides: "ten node:test cases against the real script with stub docker and sleep"
      contains: "pulls each public.ecr.aws/supabase image from ghcr.io first and tags it with its ECR name"
    - path: ".github/workflows/ci.yml"
      provides: "test-e2e permissions, env, ghcr.io and optional Docker Hub logins, the script step"
      contains: "run: bash scripts/ci-prepull-images.sh"
    - path: ".planning/cleanup/FIX-LEDGER-CI-PULL.md"
      provides: "evidence ledger for the owner"
      contains: "branch=ci/pull-supabase-from-ghcr"
  key_links:
    - from: ".github/workflows/ci.yml (test-e2e)"
      to: "scripts/ci-prepull-images.sh"
      via: "the step `run: bash scripts/ci-prepull-images.sh`, after both login steps and before `pnpm test:e2e`"
      pattern: "run: bash scripts/ci-prepull-images.sh"
    - from: "scripts/ci-prepull-images.sh"
      to: "docker/docker-compose.yml and docker/*.Dockerfile"
      via: "the same sed/grep derivation the inline step used, read relative to the repository root"
      pattern: "docker-compose.yml"
    - from: "package.json test:harness"
      to: "scripts/ci-prepull-images.test.mjs"
      via: "appended to the node --test file list; `pnpm test` runs test:harness first"
      pattern: "scripts/ci-prepull-images.test.mjs"
    - from: "the `docker tag` back to the ECR name"
      to: "Compose `up` in e2e/setup/stack.ts"
      via: "Compose's default pull policy uses a local image of the same name, so the stack never contacts public.ecr.aws once the mirror pull succeeded"
      pattern: "docker tag"
  prohibitions:
    - statement: "MUST NOT change docker/docker-compose.yml, any Dockerfile, scripts/deploy.sh or any production image name"
      status: resolved
      verification: test
    - statement: "MUST NOT touch any CI job other than test-e2e (test-integration's `supabase start` stays as it is) or any other test-e2e step"
      status: resolved
      verification: test
    - statement: "MUST NOT print, log or commit a secret value. The script handles no credentials; logins happen only in the workflow"
      status: resolved
      verification: test
    - statement: "MUST NOT commit the no-GHCR variant or any .planning/ file on the code branch"
      status: resolved
      verification: test
    - statement: "MUST NOT open a pull request, merge, push main, force-push, rebase or bypass hooks"
      status: resolved
      verification: test
    - statement: "MUST NOT touch Phase 4 verification, WR-03 or any Phase 4 file"
      status: resolved
      verification: judgment
---

## Task Goal

The CI `test-e2e` job keeps failing before any test runs. Its anonymous pre-pull of `public.ecr.aws/supabase/gotrue:v2.196.0` hits `toomanyrequests: Data limit exceeded` six times in a row. GitHub-hosted runners share IPs, and public.ecr.aws limits anonymous pulls per IP. The owner's design is in the constraints. The same three Supabase images are published on ghcr.io/supabase with identical manifest digests. CI will pull them from there first and tag them back to the ECR names, so Compose finds them locally. If the mirror fails, CI falls back to ECR. The CI job also logs in to ghcr.io and, optionally, Docker Hub. The pre-pull shell moves into a tested script.

<objective>
Move test-e2e's inline pre-pull into `scripts/ci-prepull-images.sh` and keep its behavior. For each `public.ecr.aws/supabase/{name}:{tag}` image, the script tries `ghcr.io/supabase/{name}:{tag}` first and runs `docker tag` back to the ECR name. If that fails, it falls back to the ECR pull. The work is test-first. `scripts/ci-prepull-images.test.mjs` is written before the script and runs red against a no-GHCR variant, then green against the real script. The test-e2e job gets read-only package permissions, a ghcr.io login and an optional Docker Hub login.

Planner checks done while writing this plan, 2026-10-20:
- `git ls-remote --tags https://github.com/docker/login-action` lists `v4`, which points at `v4.6.0`.
- Anonymous manifest HEAD requests to both registries return the owner's three digests, equal on each side: gotrue `sha256:c0c25187…4232`, realtime `sha256:002193c9…6bf86`, postgres `sha256:69429624…f1bb`.
- The three evidence logs show the gotrue pull exhausting six attempts. They are PR 19 attempts 1 and 2 (`pr19-e2e-attempt3.log` shows a third attempt failing the same way) and main's `04-08-main-e2e-attempt1.log`.
- Today's derived list is `caddy:2.11.7-alpine`, `docker/dockerfile:1`, `kong/kong:3.9.3`, `node:24.21.0-bookworm-slim` and the three ECR images.
- `04-02-run-a-integration.log` shows test-integration's `supabase start` hitting `toomanyrequests: Rate exceeded`. That is out of scope here and goes into the ledger.

Interpretation, recorded for the owner: "falling back to the ECR pull with the same backoff" is implemented per attempt. Each of the six attempts tries GHCR, then ECR, then waits. A transient GHCR failure is therefore retried too, instead of ECR's rate limit getting the last five tries.

Purpose: a CI suite that passes repeatably (Core Value). Today's E2E reds are registry flakes, not test results.
Output: branch `ci/pull-supabase-from-ghcr` (worktree `../hearth-ci-pull`) pushed with two commits and no PR. The ledger `.planning/cleanup/FIX-LEDGER-CI-PULL.md` is committed and pushed on the session branch.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CONTRIBUTING.md
@.github/workflows/ci.yml
@docker/docker-compose.yml
@scripts/deploy.test.mjs
@docs/testing.md
@.planning/cleanup/FIX-LEDGER-INFRA.md

<interfaces>
These exist on origin/main (48c111f at planning time). The executor uses them directly.

- `.github/workflows/ci.yml` lines 75-135, job `test-e2e`: `if:` (pull requests and main), `runs-on: ubuntu-latest`, `timeout-minutes: 40`, then these steps in order: checkout, pnpm/action-setup, setup-node, `pnpm install --frozen-lockfile`, `supabase/setup-cli@v3`, the Playwright install. Next comes the comment block at lines 95-99 with the inline pre-pull `run: |` at lines 100-126. It is the only step whose run text contains `Pre-pulling images`. Then `pnpm test:e2e`, then upload-artifact on failure. The workflow-level `permissions: contents: read` (line 8) applies to every job without its own block.
- The inline step's derivation, which the script keeps verbatim. First, `sed -nE 's/^[[:space:]]*image:[[:space:]]*//p' docker/docker-compose.yml` filtered by `grep -vE '^hearth-|^prodrigestivill/'`. Second, `sed -nE 's/^FROM[[:space:]]+(--[^[:space:]]+[[:space:]]+)*([^[:space:]]+).*/\2/p' docker/*.Dockerfile` filtered by `grep -E '[:/]'`, which drops stage names such as `source`. Third, `grep -h '^# syntax=' docker/*.Dockerfile | sed 's/^# syntax=//'`. All three go through `sort -u`. The loop gives each image up to six attempts with delay `attempt * 30` and prints `Pull of $image failed (attempt $attempt of 6); retrying in ${delay}s`. The final failure prints `::error::Could not pull $image after $attempt attempts`, then `exit 1`. An image whose `docker image inspect` succeeds is not pulled.
- `scripts/deploy.test.mjs` is the stub pattern to copy. One stub script is symlinked under several names in a temp `bin` dir prepended to PATH (`PATH: binDir + delimiter + process.env['PATH']`). The stub appends `CALL\t{name}\t{args…}` lines to `$STUB_LOG`. The real script runs with `spawnSync('bash', [SCRIPT], { cwd, encoding: 'utf8', env })`. The log is parsed into `{ name, args }`. `REPO_ROOT = resolve(import.meta.dirname, '..')`. A temp dir comes from `mkdtempSync(join(tmpdir(), 'hearth-…-'))`, removed in `after`.
- Root `package.json` line 16 is the `test:harness` line, `node --test` with six files ending `scripts/deploy.test.mjs`. That line is the only `package.json` change.
- `docs/testing.md` places that list harness tests and counts:
  - Line 9 (table row: "plus eight `node --test` files: … six harness tests").
  - Lines 29-32 ("The other six are the harness tests (the four for …, plus the service-role fence probe and the deploy script's password test)").
  - Line 46 ("except the eight `node --test` files above").
  - Line 52 ("only the six harness tests").
  - Lines 162-166 (the `scripts/deploy.test.mjs` bullet in the harness sub-list, followed by the Kong route table bullet).
  - `docs/` is excluded by `.prettierignore`, so wrap by hand at 100 columns.
- The test file is under ESLint's clock ban (`**/*.test.mjs`). It needs no clock anyway. Node 24's `node --test` spec reporter prints `✖ {name}` for a failing case and summary lines `ℹ pass N` / `ℹ fail N` (checked).
- `yaml` 2.9.1 is a devDependency of `@hearth/service` only. Load it with `createRequire` from `{worktree}/apps/service/package.json`, as Task 2's verify does.
</interfaces>
</context>

<quick_rules>
These rules bind every task. Commands run in bash from the primary checkout root, the directory that holds `.planning/`. `W=../hearth-ci-pull`. `L=.planning/cleanup/logs` is gitignored; run `mkdir -p $L` first. Every logged run ends with a line `exit={code}` taken from that command's own status, for example `{command} > $L/{name}.log 2>&1; echo "exit=$?" >> $L/{name}.log`.

1. Checkouts. The primary checkout stays on `claude/trusting-lovelace-y4r87h` and receives only `.planning/` commits. Never run `git checkout`, `git switch`, `git reset --hard`, `git stash` or `git clean` there. Code changes happen only in `W`, on `ci/pull-supabase-from-ghcr`, cut from `origin/main`. Leave `../hearth-dbtypes` and `../hearth-held-id` alone.
2. Diff bound. Against `origin/main`, the code branch changes exactly `.github/workflows/ci.yml`, `docs/testing.md`, `package.json` (the `test:harness` line only), `scripts/ci-prepull-images.sh` and `scripts/ci-prepull-images.test.mjs`. Out of bounds:
   - every other job in `ci.yml` and every other test-e2e step;
   - `docker/**`, `scripts/deploy.sh`, `e2e/**`, `.github/dependabot.yml`, `.github/workflows/deploy.yml`;
   - `docs/file-map.md`, which follows PR 3's precedent: `deploy.test.mjs` is not listed there either;
   - `.planning/` and `.claude/`.
   If a gate can only pass by touching another file, stop and report.
3. Red first. The test exists and runs against the no-GHCR variant before the GHCR step is written. The variant is never committed.
4. Commits follow Conventional Commits per `commitlint.config.js`. No scope, because the scope list has no CI scope. Subjects are at most 71 characters after `ci: ` or `docs: `. Body lines are at most 100 characters. Every message ends with these two trailer lines: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01HxsZ7tmGHEy4wbta427fyF`. Hooks must run: never `--no-verify` or `HUSKY=0`. `git add` names files; never `git add -A` or `git add .`.
5. Pushes are plain only: `git -C ../hearth-ci-pull push -u origin ci/pull-supabase-from-ghcr` and `git push origin claude/trusting-lovelace-y4r87h`. Never push `main`. Never force (`--force`, `--force-with-lease`), never rebase, never use `--all`, `--mirror` or `--tags`. Open no pull request by any route (REST, `gh`, MCP) and merge nothing. If a push is rejected, report git's message and stop.
6. Environment: Node 24 (`node --version` starts `v24.`), pnpm 10.34.5, `TZ` unset. There is no Docker daemon in this box. Nothing here pulls a real image; stubs stand in for `docker`.
7. Secrets. No secret value goes into any file, log, commit message or command line. The workflow refers to secrets only as `${{ secrets.NAME }}` expressions. The anonymous registry tokens used for the digest check are held in shell variables only and never written to a log.
</quick_rules>

<tasks>

<task type="tracer">
  <name>Task 1: Tracer: digests confirmed, test written first, red on the no-GHCR variant, GHCR step green, wired into test:harness, docs and the test-e2e run step, commit</name>
  <files>scripts/ci-prepull-images.test.mjs, scripts/ci-prepull-images.sh, package.json, docs/testing.md, .github/workflows/ci.yml (all in ../hearth-ci-pull)</files>
  <precondition>`../hearth-ci-pull` does not exist, `git branch --list ci/pull-supabase-from-ghcr` prints nothing, and `git ls-remote --heads origin ci/pull-supabase-from-ghcr` prints nothing</precondition>
  <read_first>
    - .github/workflows/ci.yml (lines 75-135, the test-e2e job)
    - scripts/deploy.test.mjs (the whole file: the stub, the runner, the log parsing)
    - docker/docker-compose.yml (the `image:` lines 21, 63, 106, 146, 184, 227, 259) and the first lines and `FROM` lines of docker/service.Dockerfile and docker/caddy.Dockerfile
    - docs/testing.md (lines 1-60 and 136-171)
    - .planning/cleanup/logs/pr19-e2e-attempt1.log (lines 674-770: the derived list and the six failed gotrue pulls)
  </read_first>
  <behavior>
    The test file holds exactly these ten `it` cases. The names are fixed because the verify greps them.
    - 1 `pulls each public.ecr.aws/supabase image from ghcr.io first and tags it with its ECR name`: no failures configured. For each fixture ECR image `E` with mirror `G`, there is `pull G`, then `tag G E`, and no `pull E`. The only `ghcr.io/` arguments are those pulls and tags. Every docker call's first argument is `image`, `pull` or `tag`. Exit 0
    - 2 `falls back to public.ecr.aws when the ghcr.io pull fails`: the gotrue mirror always fails. Its `pull G` comes before a single `pull E`. There is no `tag` for gotrue. Exit 0
    - 3 `tries ghcr.io again in every attempt before public.ecr.aws`: the gotrue mirror fails once and its ECR name always fails. The calls are `pull G`, `pull E`, one sleep, `pull G`, `tag G E`. Exactly one ECR pull. Exit 0
    - 4 `pulls Docker Hub images directly with no ghcr.io attempt`: no failures. Each of `caddy`, `docker/dockerfile`, `kong/kong` and `node` from the fixture is pulled exactly once under its own name. Every `ghcr.io/` argument starts `ghcr.io/supabase/`
    - 5 `skips an image that is already present`: the postgres ECR name and `kong/kong` are present. Each gets an `image inspect` call and no `pull` or `tag` call naming it or the postgres mirror. Exit 0
    - 6 `stops after six attempts with an ::error:: annotation naming the image`: `CI_PREPULL_DELAY_SCALE` is unset, and both the gotrue mirror and its ECR name always fail. Exit is nonzero. stdout contains `::error::Could not pull public.ecr.aws/supabase/gotrue:{tag} after 6 attempts`. There are exactly six ECR pulls of gotrue. The sleep stub saw `30 60 90 120 150`
    - 7 `retries a failed pull and scales the delay by CI_PREPULL_DELAY_SCALE`: scale `0`, and `kong/kong` fails twice. Three kong pulls, sleeps `0 0`, stdout has `attempt 2 of 6`, exit 0. With scale `x`, exit is nonzero, there is an `::error::` naming `CI_PREPULL_DELAY_SCALE`, and no pull
    - 8 `never pulls the hearth-built images, the backup image or a build stage`: no call argument starts `hearth-` or `prodrigestivill/`, and none equals the stage name `source`
    - 9 `refuses an image name that is not a plain reference before pulling anything`: a fixture whose Compose file adds a line with `;touch {canary path}` after an otherwise normal name. Exit is nonzero, stdout has `::error::`, there is no `pull` call at all, and the canary file does not exist
    - 10 `sends every Supabase image in the real docker/ files through ghcr.io`: cwd is the worktree root, with no failures. Every `public.ecr.aws/supabase/…` name the test reads from the real docker/docker-compose.yml (at least one) gets a GHCR pull and a tag back, and no ECR pull. Exit 0. No version or tag is hard-coded, so Dependabot bumps cannot break it
    - Against the no-GHCR variant: cases 1, 2, 3 and 10 fail and the other six pass, so `ℹ fail 4` and `ℹ pass 6`. Against the real script, all ten pass
  </behavior>
  <action>
Apply the quick rules.

1. Preflight and premise.
   - Check that `node --version` starts `v24.` and that `TZ` is unset. Run `git fetch origin`, then `git worktree add -b ci/pull-supabase-from-ghcr ../hearth-ci-pull origin/main`.
   - Install: `pnpm --dir ../hearth-ci-pull install --frozen-lockfile > $L/261020-wnk-install.log 2>&1; echo "exit=$?" >> $L/261020-wnk-install.log`. The log must end `exit=0`. This also installs the Husky hooks.
   - Note `git -C ../hearth-ci-pull rev-parse HEAD` as `base` for the ledger.
   - Digest check, done the way the planner did it, into `$L/261020-wnk-digests.log`. For each of `postgres:17.6.1.167`, `gotrue:v2.196.0` and `realtime:v2.130.0` (take the names from the worktree's docker/docker-compose.yml), and for each registry:
     - Get an anonymous pull token with curl. ghcr.io uses `https://ghcr.io/token?scope=repository:supabase/{name}:pull`; public.ecr.aws uses `https://public.ecr.aws/token/?scope=repository:supabase/{name}:pull`. Read the JSON field `token` with jq into a shell variable.
     - Send a HEAD request to `https://{registry}/v2/supabase/{name}/manifests/{tag}`. It carries `Authorization: Bearer {token}` and an Accept header listing `application/vnd.oci.image.index.v1+json`, `application/vnd.docker.distribution.manifest.list.v2+json`, `application/vnd.oci.image.manifest.v1+json` and `application/vnd.docker.distribution.manifest.v2+json`.
     - Read the `Docker-Content-Digest` response header.
     - Write one line per image: `{name}:{tag} ghcr={digest} ecr={digest} equal={yes|no}`. Then write `exit=0`. Never write a token.
     - All three lines must say `equal=yes`, with the owner's digests (gotrue `sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232`, realtime `sha256:002193c9ff840a4946918641901bb6aa9e2036dc9ff7590e2b11e91d1e06bf86`, postgres `sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb`).
     - If any line differs, stop and report: the design's premise no longer holds.

2. Test first: write W's `scripts/ci-prepull-images.test.mjs` with node:test and node:assert/strict, modelled on `scripts/deploy.test.mjs`.
   - Header block comment. It says what the script is for: CI test-e2e's image pre-pull, GHCR first for the Supabase images, ECR fallback. It says the real script runs against stub `docker` and `sleep` binaries first on PATH, in fixture `docker/` folders, so nothing pulls an image or needs a Docker daemon. It says the test is run by `pnpm test` through `test:harness`.
   - One stub script is symlinked as `docker` and `sleep` in a temp `bin` dir. Every call appends `CALL\t{name}\t{args…}` to `$STUB_LOG`. Its behavior:
     - `sleep` exits 0 at once.
     - `docker image inspect {ref}` exits 0 only when `{ref}` is a whole line of the file `$STUB_PRESENT`.
     - `docker pull {ref}` looks `{ref}` up in `$STUB_FAILS` (lines `{ref} {n}`). If it is listed, and the number of logged `pull {ref}` calls so far, this one included, is at most n, it writes `Error response from daemon: toomanyrequests: Data limit exceeded` to stderr and exits 1. Otherwise it exits 0.
     - Anything else, including `docker tag`, exits 0.
   - A runner helper takes `{ cwd, present, fails, scale }`. It gives each run its own log and control files. It builds the env from `process.env` without `CI_PREPULL_DELAY_SCALE`, then sets `CI_PREPULL_DELAY_SCALE` only when `scale` is given; the default in the cases is `'0'`, and case 6 omits it. It prepends the stub `bin` to PATH. It runs `bash {W}/scripts/ci-prepull-images.sh`, resolved from `REPO_ROOT`. It returns `{ status, stdout, stderr, calls }`.
   - A fixture-writer builds a temp folder holding `docker/docker-compose.yml` with four-space-indented `image:` lines:
     - `public.ecr.aws/supabase/postgres:1.0.0.1`, `public.ecr.aws/supabase/gotrue:v1.0.0`, `public.ecr.aws/supabase/realtime:v1.0.0` and `kong/kong:1.0.0`;
     - `hearth-service:${HEARTH_TAG:-current}` and `hearth-caddy:${HEARTH_TAG:-current}`, each with a `build:` block;
     - `prodrigestivill/postgres-backup-local:1-debian-test`.
     It also writes `docker/service.Dockerfile`: `# syntax=docker/dockerfile:1` on line 1, then `FROM node:1.0.0-slim AS source`, `FROM source AS build`, `FROM node:1.0.0-slim`. And `docker/caddy.Dockerfile`: the same syntax line, `FROM node:1.0.0-slim AS build`, `FROM --platform=linux/amd64 caddy:1.0.0-alpine`. Escape the `${HEARTH_TAG…}` text inside JS template literals.
   - Write the ten cases in `<behavior>`, with those exact names. Cases 1, 4 and 8 may share one no-failure run in a `before`, as deploy.test.mjs does. Case 10 runs with cwd `REPO_ROOT` and reads the ECR names from the real Compose file with a regex. Hard-code no real tag.
   - Read no clock, import nothing outside `node:`, remove the temp dir in `after`.

3. The variant, i.e. the script without the GHCR step. Write W's `scripts/ci-prepull-images.sh` as the inline step moved into a file, with these parts and nothing about GHCR yet:
   - `#!/usr/bin/env bash`, then a header comment. The comment says why: anonymous public.ecr.aws pulls are rate limited per IP on shared runners, so Compose could fail with toomanyrequests before any test. It says the script runs from the repository root, that the list comes from the Compose file and Dockerfiles so Dependabot bumps need no edit, and that the attempts and delays are as described. Then `set -euo pipefail`.
   - `CI_PREPULL_DELAY_SCALE`, default `1`. If it is not a whole number (`^[0-9]+$`), print `::error::CI_PREPULL_DELAY_SCALE must be a whole number of seconds per step` and exit 1.
   - If `docker/docker-compose.yml` is missing, print an `::error::` saying to run from the repository root, and exit 1.
   - The list: the three derivations from `<interfaces>`, unchanged, joined with `sort -u` inside a command substitution so a failing sed stops the script. Read the list into an array with `mapfile -t`, skipping empty lines. Print `Pre-pulling images:` and the list, as today.
   - Name check, before any docker call: every entry must match `^[a-z0-9]+([._/-][a-z0-9]+)*(:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?(@sha256:[a-f0-9]{64})?$`. Hold the pattern in a variable and match it unquoted on the right of `[[ =~ ]]`. Otherwise print `::error::Refusing to pull '{entry}': not a plain image reference` and exit 1. All of today's images match. Spaces, `;`, `$`, quotes, backticks and a leading `-` cannot.
   - The loop: for each image in `"${images[@]}"`, if `docker image inspect "$image" >/dev/null 2>&1` succeeds, print `{image} is already present` and go on. Otherwise make up to six attempts of `docker pull "$image"`. After a failed attempt below six, print today's retry line with `delay=$((attempt * 30 * scale))` and `sleep "$delay"`. On the sixth failure, print `::error::Could not pull {image} after 6 attempts` and exit 1.
   - Quote every expansion. The file text is used only as docker arguments, never run or re-parsed as shell code.
   - Save a copy as `$L/261020-wnk-variant.sh`, the record of the red variant. It stays out of the branch.

4. Red: `node --test ../hearth-ci-pull/scripts/ci-prepull-images.test.mjs > $L/261020-wnk-red.log 2>&1; echo "exit=$?" >> $L/261020-wnk-red.log`.
   - Expected: `exit=1`, `ℹ fail 4`, `ℹ pass 6`, with cases 1, 2, 3 and 10 marked `✖`.
   - If a non-GHCR case fails, fix the test or the variant so it honestly checks the kept behavior. Never loosen a GHCR assertion. Re-run. If the cause is unclear, stop and report.

5. The GHCR step, added to the real script.
   - Mirror mapping: a validated image of exactly the shape `public.ecr.aws/supabase/{name}:{tag}`, with no further slash and no digest, maps to `ghcr.io/supabase/{name}:{tag}`. A `case` on the prefix with the nested-path and digest arms first is enough. Any other image has no mirror.
   - In each attempt, for an image with a mirror, run `docker pull "$mirror"` and then `docker tag "$mirror" "$image"`. If both succeed, print `Pulled {mirror} and tagged it {image}` and go to the next image. If either fails, print `Pull of {mirror} failed; trying {image}`, then make the ECR pull as before.
   - The attempt counter, the delays, the retry line and the `::error::` line, which names the ECR image, are unchanged. Docker Hub images and every other image take the existing path untouched.
   - Extend the header comment: the three Supabase images also come from ghcr.io/supabase (same publisher, same manifest digests, checked on 2026-10-20). Pulling them there and tagging them with their public.ecr.aws names lets Compose and production keep those names. public.ecr.aws remains the fallback.

6. Green: the same command into `$L/261020-wnk-green.log`. Expected: `exit=0`, `ℹ pass 10`, `ℹ fail 0`. Then `bash -n ../hearth-ci-pull/scripts/ci-prepull-images.sh` must exit 0.

7. Wiring in W.
   - Root `package.json`: append ` scripts/ci-prepull-images.test.mjs` to the end of the `test:harness` value and change nothing else.
   - `docs/testing.md`, the PR 3 pattern:
     - Line 9: raise the `node --test` file count from eight to nine and the harness count from six to seven.
     - Line 29: change the other-harness-files count from six to seven, keeping that line's wrap.
     - Lines 30-32: add the CI image pre-pull test to the parenthetical list after the deploy script's password test, and re-wrap those lines at 100 columns.
     - Line 46: raise the count from eight to nine.
     - Line 52: raise the count from six to seven.
     - After the `scripts/deploy.test.mjs` bullet and before the Kong route table bullet, add one harness sub-bullet. It says that `scripts/ci-prepull-images.test.mjs` runs the real `scripts/ci-prepull-images.sh`, which CI's `test-e2e` job uses to pre-pull the Compose stack's images, against stub `docker` and `sleep` binaries placed first on `PATH` and fixture `docker/` folders. It lists what is checked: each `public.ecr.aws/supabase` image is pulled from its `ghcr.io/supabase` mirror first and tagged with its ECR name; a failed mirror pull falls back to ECR within each attempt; Docker Hub images are pulled directly; a present image is skipped; the hearth-built and backup images are never pulled; an unsafe image name is refused before any pull; six failed attempts end in an `::error::` annotation, with the delays scaled by `CI_PREPULL_DELAY_SCALE`. One case reads the real `docker/` files. Nothing pulls an image or needs a Docker daemon.
     - Every prose line you add or re-wrap is at most 100 columns. The table row on line 9 is already longer, so leave its width as it is.
   - `.github/workflows/ci.yml`, test-e2e only:
     - Replace the inline `run: |` step (lines 100-126) with exactly `- run: bash scripts/ci-prepull-images.sh` at the same position, with no `name:` key.
     - Rewrite the comment above it (lines 95-99) so it states what is now true. Anonymous public.ecr.aws pulls are rate limited per IP and hosted runners share IPs, so `docker compose up` could fail with toomanyrequests before any test ran. The script pre-pulls the stack's images so Compose finds them locally. The three Supabase images come from their ghcr.io/supabase mirror (same publisher, same digests) and are tagged with the public.ecr.aws names Compose uses, falling back to public.ecr.aws. The rest come from Docker Hub. Each image gets up to six attempts with growing backoff. The list is read from the Compose file and Dockerfiles, so Dependabot bumps need no edit, and it includes the BuildKit `# syntax=` frontend.
     - Comment lines stay at most 100 columns. Nothing else changes in this task.

8. Harness: `pnpm --dir ../hearth-ci-pull test:harness > $L/261020-wnk-harness.log 2>&1; echo "exit=$?" >> $L/261020-wnk-harness.log`. It must end `exit=0` with `ℹ fail 0`.

9. Commit 1 in W.
   - Stage: `git -C ../hearth-ci-pull add --chmod=+x scripts/ci-prepull-images.sh`, then `git -C ../hearth-ci-pull add scripts/ci-prepull-images.test.mjs package.json docs/testing.md .github/workflows/ci.yml`.
   - Commit with the subject `ci: pull the Supabase test images from GHCR first`. The body names:
     - the cause: test-e2e's anonymous public.ecr.aws pulls fail with toomanyrequests on shared runner IPs (main run 39465074029, PR 19 run 39510640048);
     - the fix: the pre-pull moved into scripts/ci-prepull-images.sh, with the Supabase images taken from ghcr.io/supabase (identical digests) and tagged back to their ECR names, and ECR as the fallback in every attempt;
     - what is unchanged: the derived list, the skip of present images, six attempts and the backoff;
     - the new harness test.
     Then the trailers.
   - The hooks must pass. If lint-staged rewrites a file, re-run step 6's green command and step 8, and amend nothing: make a fresh commit only if the first one failed.
  </action>
  <verify>
    <automated>node --version | grep -q '^v24\.' && test -z "${TZ:-}" && W=../hearth-ci-pull && L=.planning/cleanup/logs && S=$W/scripts/ci-prepull-images.sh && T=$W/scripts/ci-prepull-images.test.mjs && test "$(git -C $W rev-parse --abbrev-ref HEAD)" = ci/pull-supabase-from-ghcr && git -C $W merge-base --is-ancestor origin/main HEAD && grep -qx 'exit=0' $L/261020-wnk-install.log && grep -qx 'gotrue:v2.196.0 ghcr=sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232 ecr=sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232 equal=yes' $L/261020-wnk-digests.log && grep -qx 'realtime:v2.130.0 ghcr=sha256:002193c9ff840a4946918641901bb6aa9e2036dc9ff7590e2b11e91d1e06bf86 ecr=sha256:002193c9ff840a4946918641901bb6aa9e2036dc9ff7590e2b11e91d1e06bf86 equal=yes' $L/261020-wnk-digests.log && grep -qx 'postgres:17.6.1.167 ghcr=sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb ecr=sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb equal=yes' $L/261020-wnk-digests.log && test -s $L/261020-wnk-variant.sh && ! cmp -s $L/261020-wnk-variant.sh $S && grep -qx 'exit=1' $L/261020-wnk-red.log && grep -qx 'ℹ fail 4' $L/261020-wnk-red.log && grep -qx 'ℹ pass 6' $L/261020-wnk-red.log && grep -qF '✖ pulls each public.ecr.aws/supabase image from ghcr.io first and tags it with its ECR name' $L/261020-wnk-red.log && grep -qF '✖ falls back to public.ecr.aws when the ghcr.io pull fails' $L/261020-wnk-red.log && grep -qF '✖ tries ghcr.io again in every attempt before public.ecr.aws' $L/261020-wnk-red.log && grep -qF '✖ sends every Supabase image in the real docker/ files through ghcr.io' $L/261020-wnk-red.log && grep -qx 'exit=0' $L/261020-wnk-green.log && grep -qx 'ℹ pass 10' $L/261020-wnk-green.log && grep -qx 'ℹ fail 0' $L/261020-wnk-green.log && grep -qx 'exit=0' $L/261020-wnk-harness.log && bash -n $S && head -1 $S | grep -qx '#!/usr/bin/env bash' && grep -qx 'set -euo pipefail' $S && grep -qF 'CI_PREPULL_DELAY_SCALE' $S && ! grep -v '^[[:space:]]*#' $S | grep -qw 'eval' && git -C $W ls-files -s scripts/ci-prepull-images.sh | grep -q '^100755 ' && git -C $W ls-files --eol scripts/ci-prepull-images.sh | grep -q '^i/lf' && grep -qF 'run: bash scripts/ci-prepull-images.sh' $W/.github/workflows/ci.yml && node -e 'const fs=require("node:fs");const [m,k]=process.argv.slice(1).map((p)=>JSON.parse(fs.readFileSync(p,"utf8")));const h=m.scripts["test:harness"]+" scripts/ci-prepull-images.test.mjs";if(k.scripts["test:harness"]!==h)process.exit(1);k.scripts["test:harness"]=m.scripts["test:harness"];if(JSON.stringify(k)!==JSON.stringify(m))process.exit(2)' <(git -C $W show origin/main:package.json) $W/package.json && grep -qF '`scripts/ci-prepull-images.test.mjs`' $W/docs/testing.md && grep -qF 'plus nine `node --test` files: two in `e2e/support`, seven harness tests' $W/docs/testing.md && grep -qF 'except the nine `node --test` files above' $W/docs/testing.md && grep -qF 'only the seven harness tests' $W/docs/testing.md && grep -qF 'The other seven are the' $W/docs/testing.md && ! grep -qE '(six harness tests|eight `node --test` files)' $W/docs/testing.md && DD=$(git -C $W diff origin/main...HEAD -- docs/testing.md) && test -n "$DD" && test -z "$(printf '%s\n' "$DD" | grep '^+[^+]' | grep -v '^+|' | awk 'length > 101')" && git -C $W log --format=%s origin/main..HEAD | grep -qx 'ci: pull the Supabase test images from GHCR first' && git -C $W diff --quiet HEAD && test "$(git -C $W diff --name-only origin/main...HEAD | LC_ALL=C sort | tr '\n' ' ')" = ".github/workflows/ci.yml docs/testing.md package.json scripts/ci-prepull-images.sh scripts/ci-prepull-images.test.mjs " && node --test $T</automated>
    <fails_when>The command exits non-zero. Any of these also counts:
- the worktree is not on the branch, or does not descend from origin/main;
- the install log lacks `exit=0`;
- the digest log does not have three `equal=yes` lines with the owner's three digests;
- the variant copy is missing or equals the real script;
- the red log lacks `exit=1`, `ℹ fail 4`, `ℹ pass 6`, or a `✖` line for any of the four GHCR cases;
- the green log lacks `exit=0`, `ℹ pass 10` or `ℹ fail 0`;
- the harness log lacks `exit=0`;
- the script fails `bash -n`, lacks the shebang, `set -euo pipefail` or `CI_PREPULL_DELAY_SCALE`, uses `eval` in code, or is not mode 100755 with LF endings;
- ci.yml lacks the script step;
- package.json differs from origin/main other than by the one appended harness entry;
- docs/testing.md lacks the new bullet or the updated counts (seven, nine, "The other seven"), still has an old count, or adds a non-table line over 100 columns;
- the commit subject is missing, or uncommitted changes remain;
- the branch diff names any file outside the five;
- `node --test` reports a failing case</fails_when>
  </verify>
  <acceptance_criteria>
    - `$L/261020-wnk-digests.log` shows equal digests for all three images on ghcr.io and public.ecr.aws
    - `$L/261020-wnk-red.log` ends `exit=1`, with the four GHCR cases failing and the six kept-behavior cases passing, against the variant recorded in `$L/261020-wnk-variant.sh`. `$L/261020-wnk-green.log` ends `exit=0` with 10 of 10
    - `pnpm test:harness` in W ends `exit=0`, with the new file in the root harness line
    - One commit, `ci: pull the Supabase test images from GHCR first`, holds the five files, and the hooks ran
  </acceptance_criteria>
  <done>CI's test-e2e step runs the new script, which pulls the Supabase images from GHCR first and keeps every old behavior. This is proven red on the no-GHCR variant and green on the real script, and runs in every `pnpm test`.</done>
</task>

<task type="auto">
  <name>Task 2: test-e2e permissions, ghcr.io and optional Docker Hub logins; full gates, structural YAML check, derived list on the real files; commit and push the branch</name>
  <files>.github/workflows/ci.yml (in ../hearth-ci-pull)</files>
  <reversibility rating="reversible">Pushes a new branch with no pull request. The owner can delete it, and nothing reaches main or the host.</reversibility>
  <read_first>
    - ../hearth-ci-pull/.github/workflows/ci.yml (the test-e2e job as Task 1 left it)
    - CONTRIBUTING.md (commit and squash message rules)
  </read_first>
  <action>
Apply the quick rules.

1. Edit W's `.github/workflows/ci.yml`, test-e2e job only.
   - After `timeout-minutes: 40` and before `steps:`, add a job-level `permissions:` block with exactly `contents: read` and `packages: read`. Then add a job-level `env:` block with exactly `DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}`. The `secrets` context cannot be read in an `if:`, so the job env carries it.
   - Immediately before the `- run: bash scripts/ci-prepull-images.sh` step, insert two steps in this order.
   - First, the ghcr.io login:
     - a short comment saying GHCR pulls run as this run's own read-only token instead of anonymously;
     - `name: Log in to ghcr.io`;
     - `uses: docker/login-action@v4`;
     - `with:` holding exactly `registry: ghcr.io`, `username: ${{ github.actor }}` and `password: ${{ secrets.GITHUB_TOKEN }}`;
     - no `if:`.
   - Second, the optional Docker Hub login:
     - a comment saying authenticated Docker Hub pulls get a higher limit. It runs only when the owner has set the DOCKERHUB_USERNAME and DOCKERHUB_TOKEN repository secrets (a read-only token). Forks and Dependabot runs do not receive those secrets and skip it;
     - `name: Log in to Docker Hub (optional)`;
     - `if: env.DOCKERHUB_USERNAME != ''`;
     - `uses: docker/login-action@v4`;
     - `with:` holding exactly `username: ${{ env.DOCKERHUB_USERNAME }}` and `password: ${{ secrets.DOCKERHUB_TOKEN }}`, with no `registry` key, so Docker Hub is the default.
   - The pre-pull comment from Task 1 moves below the two login steps and stays directly above the script step. Add half a sentence to it saying the logins above make the pulls authenticated where possible.
   - Nothing prints a secret, and no secret value appears anywhere. Every other job, key and step stays byte-for-byte as on origin/main. Comment lines are at most 100 columns.

2. Gates in W, each logged under `$L` with `exit=`:
   - `pnpm --dir ../hearth-ci-pull lint` into `261020-wnk-lint.log`;
   - `pnpm --dir ../hearth-ci-pull format:check` into `261020-wnk-format.log`;
   - `pnpm --dir ../hearth-ci-pull typecheck` into `261020-wnk-typecheck.log`;
   - `pnpm --dir ../hearth-ci-pull test` (harness first, then every workspace) into `261020-wnk-test.log`;
   - `bash -n ../hearth-ci-pull/scripts/ci-prepull-images.sh` into `261020-wnk-bashn.log`.
   Read only a log's tail unless it fails. A failure in one of the five branch files is fixed there, and then every gate re-runs. A failure anywhere else means stop and report (quick rule 2).

3. Workflow parse and structure. actionlint is not installed, and no new tool is fetched. Run the exact `node -e` structural check from this task's verify, with its three arguments, into `$L/261020-wnk-ci-yaml.log`. It must print `ci.yml structure ok` and end `exit=0`. It parses both files with the service's `yaml` package and checks all of this:
   - the top-level keys and job ids are unchanged;
   - every other job is deep-equal to origin/main's;
   - test-e2e keeps `if`, `runs-on` and `timeout-minutes`;
   - the permissions and env blocks are exactly as above;
   - the two login steps and the script step sit, in that order, where the old pre-pull step was;
   - every other test-e2e step is unchanged.

4. Derived list on the real files, with no real pulls.
   - In a `mktemp -d` directory, write an executable stub `docker`. It appends one line, `docker` followed by its arguments joined by single spaces, to the file named by `$DERIVE_CALLS`. It exits 1 for `image inspect` and 0 for everything else.
   - Set `DERIVE_CALLS` to the absolute path of `$L/261020-wnk-derive-calls.log` and start that file empty.
   - Run the script from W's root: `(cd ../hearth-ci-pull && PATH="{stub dir}:$PATH" CI_PREPULL_DELAY_SCALE=0 DERIVE_CALLS="$DERIVE_CALLS" bash scripts/ci-prepull-images.sh) > $L/261020-wnk-derive.log 2>&1; echo "exit=$?" >> $L/261020-wnk-derive.log`.
   - `261020-wnk-derive.log` must show `Pre-pulling images:` and today's seven images. The calls log must show a GHCR pull and a `docker tag ghcr.io/supabase/{name}:{tag} public.ecr.aws/supabase/{name}:{tag}` for each Compose Supabase image. It must show direct pulls for the four Docker Hub images, and nothing for `hearth-` or `prodrigestivill/`.

5. Commit 2 in W.
   - `git -C ../hearth-ci-pull add .github/workflows/ci.yml`, then commit with the subject `ci: log in to GHCR and Docker Hub before the E2E pulls`.
   - The body says:
     - test-e2e now has job-level `contents: read` and `packages: read`, and logs in to ghcr.io with the run's token;
     - an optional Docker Hub login runs only when the DOCKERHUB_USERNAME and DOCKERHUB_TOKEN secrets exist, so forks, Dependabot and repositories without them skip it;
     - no other job changes.
     Then the trailers. The hooks must pass.
   - Run `pnpm --dir ../hearth-ci-pull exec commitlint --from origin/main --to HEAD` into `$L/261020-wnk-commitlint.log`, ending `exit=0`.

6. Pre-push checks.
   - The branch diff names exactly the five files, and `git -C ../hearth-ci-pull diff --quiet HEAD` passes.
   - Capture `git -C ../hearth-ci-pull diff origin/main...HEAD` into a variable first, so a failing git cannot read as a clean scan. Its added lines must match nothing in the secret pattern in this task's verify: the Phase 4 pattern plus the GitHub and Docker Hub token shapes.

7. Push: `git -C ../hearth-ci-pull push -u origin ci/pull-supabase-from-ghcr`. Note the pushed tip's full SHA and both commit SHAs for the ledger. Open no pull request.
  </action>
  <verify>
    <automated>node --version | grep -q '^v24\.' && test -z "${TZ:-}" && W=../hearth-ci-pull && L=.planning/cleanup/logs && test "$(git -C $W rev-parse --abbrev-ref HEAD)" = ci/pull-supabase-from-ghcr && test "$(git -C $W log --format=%s origin/main..HEAD | LC_ALL=C sort | tr '\n' '|')" = "ci: log in to GHCR and Docker Hub before the E2E pulls|ci: pull the Supabase test images from GHCR first|" && git -C $W diff --quiet HEAD && test "$(git -C $W diff --name-only origin/main...HEAD | LC_ALL=C sort | tr '\n' ' ')" = ".github/workflows/ci.yml docs/testing.md package.json scripts/ci-prepull-images.sh scripts/ci-prepull-images.test.mjs " && for s in lint format typecheck test bashn ci-yaml derive commitlint; do grep -qx 'exit=0' $L/261020-wnk-$s.log || { echo "$s not green"; exit 1; }; done && grep -qx 'ci.yml structure ok' $L/261020-wnk-ci-yaml.log && grep -qx 'Pre-pulling images:' $L/261020-wnk-derive.log && N=0 && for i in $(sed -nE 's#^[[:space:]]*image:[[:space:]]*(public\.ecr\.aws/supabase/[^[:space:]]+)$#\1#p' $W/docker/docker-compose.yml); do N=$((N+1)); grep -qxF "docker tag ghcr.io/supabase/${i#public.ecr.aws/supabase/} $i" $L/261020-wnk-derive-calls.log || { echo "no GHCR tag-back for $i"; exit 1; }; done && test "$N" -ge 1 && ! grep -qE '^docker pull (hearth-|prodrigestivill/)' $L/261020-wnk-derive-calls.log && node -e 'const {createRequire}=require("node:module");const fs=require("node:fs");const [pkg,nf,of]=process.argv.slice(1);const Y=createRequire(pkg)("yaml");const n=Y.parse(fs.readFileSync(nf,"utf8"));const o=Y.parse(fs.readFileSync(of,"utf8"));const S=JSON.stringify;const no=(m)=>{console.error("ci.yml: "+m);process.exit(1)};const isPre=(s)=>typeof s.run==="string"&&s.run.includes("Pre-pulling images");if(S(Object.keys(n))!==S(Object.keys(o))||S(Object.keys(n.jobs))!==S(Object.keys(o.jobs)))no("top-level keys or job ids changed");for(const k of Object.keys(o))if(k!=="jobs"&&S(n[k])!==S(o[k]))no(k+" changed");for(const j of Object.keys(o.jobs))if(j!=="test-e2e"&&S(n.jobs[j])!==S(o.jobs[j]))no("job "+j+" changed");const e=n.jobs["test-e2e"],oe=o.jobs["test-e2e"];for(const k of ["if","runs-on","timeout-minutes"])if(S(e[k])!==S(oe[k]))no(k+" changed");if(S(e.permissions)!==S({contents:"read",packages:"read"}))no("permissions");if(S(e.env)!==S({DOCKERHUB_USERNAME:"${{ secrets.DOCKERHUB_USERNAME }}"}))no("env");const oi=oe.steps.findIndex(isPre);if(oi<0||oe.steps.filter(isPre).length!==1)no("old pre-pull step not found once");const st=e.steps,g=st[oi],h=st[oi+1],p=st[oi+2];if(!g||g.uses!=="docker/login-action@v4"||g.if!==undefined||S(g.with)!==S({registry:"ghcr.io",username:"${{ github.actor }}",password:"${{ secrets.GITHUB_TOKEN }}"}))no("ghcr login step");if(!h||h.uses!=="docker/login-action@v4"||h.if!=="env.DOCKERHUB_USERNAME != \x27\x27"||S(h.with)!==S({username:"${{ env.DOCKERHUB_USERNAME }}",password:"${{ secrets.DOCKERHUB_TOKEN }}"}))no("Docker Hub login step");if(!p||p.run!=="bash scripts/ci-prepull-images.sh"||Object.keys(p).length!==1)no("pre-pull step");const rest=st.filter((s,i)=>i<oi||i>oi+2),orest=oe.steps.filter((s,i)=>i!==oi);if(S(rest)!==S(orest))no("other test-e2e steps changed");console.log("ci.yml structure ok")' "$PWD/$W/apps/service/package.json" $W/.github/workflows/ci.yml <(git -C $W show origin/main:.github/workflows/ci.yml) && DIFF=$(git -C $W diff origin/main...HEAD) && test -n "$DIFF" && ! printf '%s\n' "$DIFF" | grep '^+' | grep -qE '(SERVICE_ROLE_KEY|JWT_SECRET|VAPID_PRIVATE_KEY|POSTGRES_PASSWORD|HEARTH_SERVICE_DB_PASSWORD)=[A-Za-z0-9+/_.-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|dckr_pat_[A-Za-z0-9_-]{16,}' && bash -n $W/scripts/ci-prepull-images.sh && test "$(git ls-remote --heads origin ci/pull-supabase-from-ghcr | cut -f1)" = "$(git -C $W rev-parse HEAD)" && test "$(gh api 'repos/alex-tanton/hearth/pulls?state=all&head=alex-tanton:ci/pull-supabase-from-ghcr' --jq length)" = 0</automated>
    <fails_when>The command exits non-zero. Any of these also counts:
- the branch does not hold exactly the two commits, or uncommitted changes remain;
- the diff names a file outside the five;
- the lint, format, typecheck, test, bashn, ci-yaml, derive or commitlint log lacks `exit=0`;
- the ci-yaml log lacks `ci.yml structure ok`;
- the derive log lacks `Pre-pulling images:`;
- a Compose Supabase image lacks its GHCR tag-back line;
- a hearth or backup image was pulled;
- the structural check reports changed keys, jobs or steps, or wrong permissions, env, login steps or the script step;
- an added line matches the secret pattern;
- origin's branch is missing or not at W's HEAD;
- a pull request exists for the branch</fails_when>
  </verify>
  <acceptance_criteria>
    - test-e2e has `permissions: {contents: read, packages: read}`, `env.DOCKERHUB_USERNAME` from secrets, a ghcr.io login with `github.actor` and `secrets.GITHUB_TOKEN`, a Docker Hub login gated on `env.DOCKERHUB_USERNAME != ''` with `secrets.DOCKERHUB_TOKEN`, then the script step. Every other job and step is unchanged (`ci.yml structure ok`)
    - lint, format:check, typecheck, `pnpm test`, `bash -n`, commitlint and the derive run all end `exit=0`, and the derive calls show the GHCR tag-back for each Supabase image
    - `ci/pull-supabase-from-ghcr` is on origin at W's HEAD with two commits and five files, and no pull request exists
  </acceptance_criteria>
  <done>The branch is pushed, holds the full change, passes every local gate and has a structurally checked workflow. It is ready for the owner to open a PR whose own test-e2e run is the real proof.</done>
</task>

<task type="auto">
  <name>Task 3: Ledger FIX-LEDGER-CI-PULL.md on the session branch, committed and pushed</name>
  <files>.planning/cleanup/FIX-LEDGER-CI-PULL.md (new)</files>
  <precondition>`git ls-remote --heads origin ci/pull-supabase-from-ghcr` equals `git -C ../hearth-ci-pull rev-parse HEAD` (Task 2 pushed)</precondition>
  <read_first>
    - .planning/cleanup/FIX-LEDGER-INFRA.md (header keys, the red and green table, the `main-ci-pr3=` line about run 39465074029)
    - .planning/cleanup/FIX-LEDGER-HELD-ID.md (the quick-task ledger shape)
    - the tails of $L/261020-wnk-digests.log, -red.log, -green.log, -harness.log, -test.log, -derive.log, -ci-yaml.log
  </read_first>
  <action>
Apply the quick rules. All edits happen in the primary checkout.

1. Write `.planning/cleanup/FIX-LEDGER-CI-PULL.md`.
   - Title: `# Fix ledger: CI image pulls from GHCR first (quick 261020-wnk)`.
   - Then one key per line:
     - `base={full origin/main SHA from Task 1}`
     - `branch=ci/pull-supabase-from-ghcr`
     - `worktree=../hearth-ci-pull`
     - `commits={commit 1 SHA} {commit 2 SHA}`
     - `pushed={full SHA of origin's ci/pull-supabase-from-ghcr}`
     - `pr=none (the owner opens it and squash-merges; proposed title: ci: pull the Supabase test images from GHCR first)`
   - A line saying the raw logs are `.planning/cleanup/logs/261020-wnk-*.log` (gitignored).
   - `## Why`. The failing runs, in plain words:
     - Main CI run 39465074029, attempt 1, job 118774234646: test-e2e failed pulling the gotrue image with `toomanyrequests`, before any test ran.
     - PR 19 run 39510640048, jobs 118930495707 and 118933942180: both attempts exhausted six pulls of `public.ecr.aws/supabase/gotrue:v2.196.0` with `toomanyrequests: Data limit exceeded` (logs `pr19-e2e-attempt1.log`, `pr19-e2e-attempt2.log`). `pr19-e2e-attempt3.log` shows a third attempt failing the same way.
     - PR 3 runs 39457296052 and 39460683347: the earlier E2E flakes the owner listed. Per `FIX-LEDGER-INFRA.md`, their attempt-1 failures were test flakes outside spec 08, and their saved logs have no `toomanyrequests`. They are context, not evidence for this change.
   - `## Digests`. The three lines from `261020-wnk-digests.log`, with the method: anonymous token, manifest HEAD, `Docker-Content-Digest`, and the date. State that tags stay mutable on both registries, as before.
   - `## Red and green`, a table with the FIX-LEDGER header (`| FIX | Test | Red (unfixed) | Green (fixed) | Commit |`) and one row `CI-PULL`:
     - test: `scripts/ci-prepull-images.test.mjs`, ten cases;
     - red: the `node --test` command against the no-GHCR variant, exit=1, `ℹ fail 4` / `ℹ pass 6`, the four `✖` names, and the first assertion line of case 1;
     - green: the same command, exit=0, `ℹ pass 10`, plus the harness total and exit=0 from `261020-wnk-harness.log`;
     - commit: commit 1's SHA.
   - A gates line: lint, format:check, typecheck, `pnpm test` (quote its harness and workspace summary lines), `bash -n`, commitlint and `ci.yml structure ok` all exit=0. Below it, the derived list from `261020-wnk-derive.log` and the three tag-back lines from the calls log.
   - `## Findings`, plain sentences:
     - (a) What changed. Each attempt tries GHCR, then ECR, then waits. This is the planner's reading of "falling back to the ECR pull with the same backoff", so a transient GHCR failure is retried too. Compose and production image names are unchanged.
     - (b) The real proof is the PR's own `test-e2e` run on GitHub-hosted runners. Nothing here pulled a real image (no Docker daemon). Until that run passes, the fix is unproven in CI.
     - (c) test-integration's `supabase start` (Supabase CLI 2.117.0) still pulls from public.ecr.aws. It is out of scope and can still hit the limit; `04-02-run-a-integration.log` shows `toomanyrequests: Rate exceeded` there.
     - (d) Two optional repository secrets the owner may add: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, a read-only Docker Hub access token. Without them the Docker Hub login is skipped and nothing else changes. Forks and Dependabot runs never receive them.
     - (e) If ghcr.io itself is down, the ghcr.io login step fails the job before the ECR fallback can run. That is the owner's design as specified. A `continue-on-error: true` on that one step would keep the fallback reachable; it is the owner's call.
     - (f) docs/file-map.md does not list the new script or test, following PR 3's precedent for `deploy.test.mjs`. It is left for RED-05.
   - Write no token and no secret value.

2. Commit on `claude/trusting-lovelace-y4r87h`:
   - `git add .planning/cleanup/FIX-LEDGER-CI-PULL.md`, this file only. The plan, SUMMARY and STATE.md are left for the orchestrator's docs commit.
   - Commit with the subject `docs: record the GHCR-first image pulls on ci/pull-supabase-from-ghcr`. Its length after `docs: ` must be at most 71 characters; shorten the wording if needed. The body names quick task 261020-wnk and the pushed SHA, then the trailers.
   - Push with `git push origin claude/trusting-lovelace-y4r87h` (plain).
  </action>
  <verify>
    <automated>LED=.planning/cleanup/FIX-LEDGER-CI-PULL.md && test "$(git rev-parse --abbrev-ref HEAD)" = claude/trusting-lovelace-y4r87h && grep -qE '^base=[0-9a-f]{40}$' $LED && grep -qx 'branch=ci/pull-supabase-from-ghcr' $LED && grep -qx "pushed=$(git ls-remote --heads origin ci/pull-supabase-from-ghcr | cut -f1)" $LED && grep -qE '^commits=[0-9a-f]{40} [0-9a-f]{40}$' $LED && grep -qE '^pr=none' $LED && for id in 39465074029 118774234646 39510640048 118930495707 118933942180 39457296052 39460683347 c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232 002193c9ff840a4946918641901bb6aa9e2036dc9ff7590e2b11e91d1e06bf86 6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb DOCKERHUB_USERNAME DOCKERHUB_TOKEN 'supabase start' 'ℹ fail 4' 'ℹ pass 10'; do grep -qF "$id" $LED || { echo "ledger lacks $id"; exit 1; }; done && grep -qi 'read-only' $LED && grep -qF 'test-integration' $LED && ! grep -qE 'gh[pousr]_[A-Za-z0-9]{30,}|dckr_pat_[A-Za-z0-9_-]{16,}|Bearer [A-Za-z0-9._-]{20,}' $LED && git ls-files --error-unmatch $LED > /dev/null && git diff --quiet HEAD -- $LED && git log -1 --format=%s -- $LED | grep -q '^docs: ' && test "$(git ls-remote --heads origin claude/trusting-lovelace-y4r87h | cut -f1)" = "$(git rev-parse HEAD)" && test "$(gh api 'repos/alex-tanton/hearth/pulls?state=all&head=alex-tanton:ci/pull-supabase-from-ghcr' --jq length)" = 0</automated>
    <fails_when>The command exits non-zero. Any of these also counts:
- the primary checkout is not on the session branch;
- the ledger lacks `base=`, `branch=`, `commits=`, `pr=none`, or a `pushed=` equal to origin's branch tip;
- the ledger is missing any listed run id or job id, any of the three digests, either secret name, the `supabase start` note, the red `ℹ fail 4` or the green `ℹ pass 10`;
- it lacks "read-only" or "test-integration";
- it contains a token-shaped string;
- the ledger is untracked or uncommitted, or its last commit is not a `docs:` commit;
- origin's session branch is not at HEAD;
- a pull request exists for the code branch</fails_when>
  </verify>
  <acceptance_criteria>
    - `.planning/cleanup/FIX-LEDGER-CI-PULL.md` is committed and pushed. It has the base, branch, commits, pushed SHA and `pr=none`; the failing run and job ids; the digest-equality lines; the red/green row; the gates; and findings (a) to (f), including the out-of-scope `supabase start` and the two optional read-only secrets
    - The session branch is pushed at HEAD. No pull request exists for `ci/pull-supabase-from-ghcr`
  </acceptance_criteria>
  <done>The owner has the evidence, the branch to open a PR from, the open risk (GHCR login hard-fail), and the optional secrets to add.</done>
</task>

</tasks>

## Artifacts this phase produces

| Artifact | Kind | Lands on |
|----------|------|----------|
| `scripts/ci-prepull-images.sh` (mode 100755; derived list, name check, GHCR-first with `docker tag` back to the ECR name, ECR fallback per attempt, six attempts, `::error::` on the cap) | new CI script | `ci/pull-supabase-from-ghcr` |
| `scripts/ci-prepull-images.test.mjs` (stub `docker` and `sleep`, fixture `docker/` folders, ten named cases) | new harness test | `ci/pull-supabase-from-ghcr` |
| root `package.json` `test:harness` entry `scripts/ci-prepull-images.test.mjs` | root script | `ci/pull-supabase-from-ghcr` |
| `docs/testing.md` counts (nine `node --test` files, seven harness tests) and the new harness bullet | docs | `ci/pull-supabase-from-ghcr` |
| test-e2e `permissions: {contents: read, packages: read}`, `env.DOCKERHUB_USERNAME`, steps `Log in to ghcr.io` and `Log in to Docker Hub (optional)` (`docker/login-action@v4`), step `run: bash scripts/ci-prepull-images.sh` | workflow | `ci/pull-supabase-from-ghcr` |
| env var `CI_PREPULL_DELAY_SCALE` (whole number, default 1; 0 in tests) | script input | `ci/pull-supabase-from-ghcr` |
| optional repository secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (read-only token; added by the owner, never by the executor) | GitHub settings | owner |
| branch `ci/pull-supabase-from-ghcr` (worktree `../hearth-ci-pull`, two commits, pushed, no PR) | git | `origin` |
| `.planning/cleanup/FIX-LEDGER-CI-PULL.md` | ledger | session branch |
| `.planning/cleanup/logs/261020-wnk-{install,digests,red,green,harness,lint,format,typecheck,test,bashn,ci-yaml,derive,derive-calls,commitlint}.log` and `261020-wnk-variant.sh` | logs | gitignored |

No production code, image name, Compose file, Dockerfile or migration changes.

## Source coverage audit

| Source | Item | Covered by |
|--------|------|------------|
| GOAL | test-e2e pre-pull robust against public.ecr.aws rate limits | Tasks 1-2 |
| Owner design | GHCR-first for `public.ecr.aws/supabase/{name}:{tag}`, `docker tag` back, ECR fallback with the same backoff | Task 1 step 5; cases 1-3, 10 |
| Owner design | Keep: list from Compose + Dockerfiles (Dependabot-safe), six attempts, growing backoff, skip present images | Task 1 step 3; cases 4-8, 10; Task 2 step 4 |
| Owner design | `CI_PREPULL_DELAY_SCALE` multiplies delays (0 in tests) | Task 1 step 3; cases 6-7 |
| Owner design | Compose and production image names unchanged | Quick rule 2; Task 2 diff bound |
| Owner design | Job permissions `contents: read`, `packages: read`; ghcr.io login (login-action@v4, actor, GITHUB_TOKEN) | Task 2 step 1; structural check |
| Owner design | Optional Docker Hub login gated by `env.DOCKERHUB_USERNAME != ''`, job env from secrets, token from secrets in `with` | Task 2 step 1; structural check |
| Owner design | Replace the inline step with `run: bash scripts/ci-prepull-images.sh`; keep and update the comment | Task 1 step 7; Task 2 step 1 |
| Owner design | login-action v4 exists | Planner check (`v4` -> v4.6.0); the structural check pins `@v4` |
| Test (a)-(f) | GHCR first + tag; fallback; Docker Hub direct; present skipped; cap with `::error::`; hearth/backup not pulled | Cases 1, 2, 4, 5, 6, 8 (plus 3, 7, 9, 10) |
| Test process | Test first; red on a no-GHCR variant kept out of the diff; green on the real script | Task 1 steps 2-6 |
| Wiring | `test:harness` line only; docs/testing.md lists and counts | Task 1 step 7; Task 1 verify |
| Git | Worktree from origin/main; five-file diff; conventional commits without scope; hooks; gates; plain push; no PR | Tasks 1-2; quick rules 1-5 |
| Evidence | Real-files derivation with a stub docker | Task 2 step 4 |
| Evidence | YAML parses (no actionlint) | Task 2 step 3 |
| Ledger | Base, branch, run ids, digest check, red/green, pushed SHA, `pr=none`, supabase start note, optional secrets | Task 3 |
| Threat model | ASVS L1 items from the constraints | threat_model below |
| STATE.md | List the quick task as the previous one did | Output (orchestrator's docs commit) |
| Exclusion | test-integration `supabase start` registry | Out of scope (owner); ledger finding (c) |
| Exclusion | Phase 4 verification, WR-03 | Out of scope (owner) |

<threat_model>
ASVS Level 1. This is a CI-only change. The images it fetches run only in the ephemeral test-e2e stack on GitHub-hosted runners.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CI runner → ghcr.io/supabase (new) | A second registry for the same three Supabase images, from the same publisher. Today the manifest digests equal public.ecr.aws's (Task 1 records them). Tags are mutable on both registries, as before |
| CI runner → public.ecr.aws, Docker Hub | Unchanged sources. ECR is now the fallback for the Supabase images |
| workflow → secrets | `GITHUB_TOKEN`, scoped to `contents: read`, `packages: read` on test-e2e only. `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` are optional repository secrets, absent on forks and Dependabot runs |
| repo files → shell | Compose/Dockerfile text becomes docker arguments inside `scripts/ci-prepull-images.sh` |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-wnk-01 | Spoofing | ghcr.io/supabase images tagged as public.ecr.aws names | medium | accept | Same publisher. Digests were checked equal on the day and recorded in the ledger. Production pulls the unchanged ECR names through deploy.sh/Compose, so only CI's throwaway stack is affected. Tag mutability is unchanged from before. Pinning by digest is out of scope (Dependabot manages tags) |
| T-wnk-02 | Elevation of Privilege | `GITHUB_TOKEN` in test-e2e | medium | mitigate | Job-level `permissions` is exactly `contents: read`, `packages: read`. Every other job keeps the workflow-level `contents: read`. Task 2's structural check fails on any other permission or on any change to another job |
| T-wnk-03 | Information Disclosure | `DOCKERHUB_TOKEN` | high | mitigate | Read only as `${{ secrets.DOCKERHUB_TOKEN }}` in the login step's `with` (structural check), and masked by Actions. Never printed or written. The step is skipped when `DOCKERHUB_USERNAME` is empty, which it always is on fork PRs and Dependabot runs, so a fork cannot exfiltrate a secret it never receives. The added-line secret scan in Task 2 includes Docker Hub and GitHub token shapes |
| T-wnk-04 | Information Disclosure | `DOCKERHUB_USERNAME` in job env (visible to every test-e2e step, including Playwright) | low | accept | A user name, not a credential. Actions masks it in logs. The job env is needed because a step `if:` cannot read `secrets` |
| T-wnk-05 | Tampering | image strings from docker/ files used in shell | medium | mitigate | Each entry must match the conservative reference pattern before any docker call: no spaces, `;`, `$`, quotes, backticks or leading `-`. Expansions are quoted and iterated from an array, and the text is never run as shell code. Case 9 proves a `;touch` line is refused before any pull and its canary is never created. The verify gate rejects `eval` in code lines. The script calls docker only with `image`, `pull` and `tag` (case 1) and handles no credentials |
| T-wnk-06 | Denial of Service | ghcr.io outage or limits | low | accept | A failed GHCR pull falls back to ECR in the same attempt (cases 2-3). The six-attempt cap and the 40-minute job timeout are unchanged. Residual: a failing ghcr.io login step stops the job before the fallback. This follows the owner's design and is flagged in the ledger (finding e) with the `continue-on-error` option |
| T-wnk-07 | Repudiation | claiming the flake is fixed without CI proof | low | mitigate | The ledger says `pr=none` and that the PR's own test-e2e run is the real proof (finding b). No real pull happens here |
| T-wnk-SC | Tampering | dependencies and third-party actions | medium | mitigate | No npm/pip/cargo install. `pnpm install --frozen-lockfile` uses the committed lockfile only, and the five-file diff bound excludes `pnpm-lock.yaml`. The one new action, `docker/login-action@v4`, is Docker's official action and its `v4` tag was verified to exist. It is pinned by major tag like every other action in the workflow, and Dependabot's github-actions updates track it. No legitimacy checkpoint is needed because no package is added |
</threat_model>

<verification>
- Task 1: the digests are equal; red on the no-GHCR variant (`ℹ fail 4`, exactly the GHCR cases); green 10/10; `test:harness` green; commit 1 with five files
- Task 2: lint, format:check, typecheck, `pnpm test`, `bash -n`, commitlint all `exit=0`; `ci.yml structure ok`; the real-files derivation shows the GHCR tag-back for every Supabase image; the branch is pushed with two commits and five files; no PR
- Task 3: the ledger is committed and pushed with every required fact
- Overall: `node --test ../hearth-ci-pull/scripts/ci-prepull-images.test.mjs` passes, and `git -C ../hearth-ci-pull diff --name-only origin/main...HEAD` lists exactly the five files
</verification>

<success_criteria>
- CI's test-e2e pulls the three Supabase images from ghcr.io first and tags them back to their ECR names, with ECR as the per-attempt fallback. Compose and production names are unchanged
- Every previous pre-pull behavior is kept and covered by a harness test that runs in `pnpm test`
- test-e2e logs in to ghcr.io with a read-only token and to Docker Hub only when the owner adds the optional secrets. No other job changes
- The branch is pushed, waiting for the owner's PR, whose own test-e2e run is the real proof. The ledger states this plainly
</success_criteria>

<output>
Create `.planning/quick/261020-wnk-make-ci-image-pulls-robust-against-regis/261020-wnk-SUMMARY.md` when done. The executor does not commit it. The orchestrator's docs commit takes it and the plan, together with one new row in `.planning/STATE.md`'s `### Quick Tasks Completed` table, the way 261020-v7v did. Row: `| 261020-wnk | CI: pull the Supabase E2E images from GHCR first with ECR fallback, plus GHCR and optional Docker Hub logins (branch ci/pull-supabase-from-ghcr, pushed, no PR, awaiting the owner's PR) | 2026-10-20 | {short pushed SHA} | [261020-wnk-make-ci-image-pulls-robust-against-regis](./quick/261020-wnk-make-ci-image-pulls-robust-against-regis/) |`. Nothing else in STATE.md changes.
</output>
