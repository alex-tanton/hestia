---
phase: 01-git-history-curation-and-branch-policy
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - CONTRIBUTING.md
  - docs/file-map.md
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Scope was the three files this phase authored at tip `d3da748` (commits `83eae2c` and `d3da748`).
The rest of the phase product is a curated history re-parented unchanged and was not reviewed.

- `docs/file-map.md`: one added row. It is accurate and consistent with the neighbouring rows. No
  findings.
- `CONTRIBUTING.md`: every checkable factual claim held up (deploy docs-only skip and the tip-commit-only check,
  `hearth` self-hosted label, `core.filemode=false` here, `100755` and `i/lf` checks, Husky hooks
  needing `pnpm install` per worktree because `core.hooksPath=.husky/_` is relative and `.husky/_`
  is untracked, subject limit 71 and body limit 100 verified by running commitlint). No false
  statement was found. The defects are policy gaps and ambiguities, not wrong facts.
- `.github/workflows/ci.yml` pre-pull step: the image list it computes is correct today (7 images,
  verified by running the extraction against the repo). The weaknesses are that discovery silently
  degrades to a no-op, the retry budget exceeds the job timeout, and the step has never executed in
  CI (nothing has been pushed).

No security issue was found: the step adds no secrets, no new token permissions (workflow stays
`contents: read`), and interpolates only repo-controlled file content.

The red `test-unit` job and the "branch protection not configured" line were treated as accepted
and are not reported as findings.

## Warnings

### WR-01: Pre-pull image discovery silently degrades to a no-op and is brittle

**File:** `.github/workflows/ci.yml:100-112`
**Issue:** Every stage of the image-list pipeline ends in `|| true`, and inside `$( ... )` the earlier
stages' failures are not propagated, so `set -euo pipefail` does not protect the list construction.
Reproduced: run from a directory with no `docker/` folder, the extraction prints three `sed`/`grep`
errors, `images` is empty, the loop body never runs, and the step exits 0. If the compose file or the
`*.Dockerfile` glob is renamed or moved, the step keeps passing, pulls nothing, and the e2e job
reverts to the original `toomanyrequests` failure with no sign that the safeguard stopped working.

The parsing is also regex-over-YAML/Dockerfile and breaks on valid inputs, and a malformed result is
then retried six times (see WR-04) before failing:

- `image: "kong/kong:3.9.3"` keeps the quotes; `image: x:1 # note` keeps the trailing comment.
- `FROM` is matched upper-case only (Dockerfile instructions are case-insensitive).
- `FROM node:${NODE_VERSION}` yields a literal `${NODE_VERSION}` that cannot be pulled.
- `# syntax = docker/dockerfile:1` (spaces around `=`, which Docker accepts) is not matched.
- The `^prodrigestivill/` and `^hearth-` exclusions are hard-coded and undocumented in the step
  comment. They are correct only because `e2e/setup/stack.ts` (`DATA_SERVICES`, `APP_SERVICES`)
  never starts `backup`; if `backup` is ever added to the e2e stack its Docker Hub image is not
  pre-pulled and nothing says why.

**Fix:** Fail loudly when discovery finds nothing, strip quotes and trailing comments, and make the
`FROM` match case-insensitive:

```bash
images=$( { ...; } | sort -u )
if [ -z "$images" ]; then
  echo "::error::No images discovered for pre-pull; check docker/ paths"
  exit 1
fi
```

and, in the extraction, `sed -nE "s/^[[:space:]]*image:[[:space:]]*['\"]?([^'\"[:space:]#]+).*/\1/p"`
with `I` flag (`s/.../\2/Ip`) on the `FROM` expression. Add a comment next to the `grep -vE`
explaining that `hearth-*` is built locally and `backup` is not started by the e2e stack.

### WR-02: Policy table is self-contradictory for dependency, Docker image and Action version bumps

**File:** `CONTRIBUTING.md:10-13`
**Issue:** Row 1 sends "lockfile or dependency version bumps" straight to `main`. Row 2 sends anything
touching CI (`.github/`) or Docker (`docker/`, compose files) through a pull request. A Docker image
tag bump (`docker/docker-compose.yml`, `docker/*.Dockerfile`) and a GitHub Action version bump
(`.github/workflows/*.yml`) are both "dependency version bumps" and "changes to `.github/` /
`docker/`". Line 13 ("a change that mixes both kinds goes through a pull request") does not resolve a
change that is one kind under two rows. Also, `.github/dependabot.yml` is configured for npm, GitHub
Actions and Docker with weekly grouped updates, and Dependabot can only open pull requests, so the
actual flow for the dependency path is a PR the policy never mentions.

**Fix:** State precedence explicitly and cover Dependabot, for example: "A change under `.github/`,
`docker/`, `supabase/migrations/` or a compose file always goes through a pull request, including
version bumps. Dependabot pull requests are squash-merged like any other. Only `package.json` and
`pnpm-lock.yaml` version bumps made by hand go straight to `main`."

### WR-03: "Every squash message must pass commitlint" has no enforcement path and is not listed as unenforced

**File:** `CONTRIBUTING.md:25-33`, `CONTRIBUTING.md:58-61`
**Issue:** commitlint runs only in the local Husky `commit-msg` hook (`.husky/commit-msg`). A GitHub
web squash merge creates the commit server-side and never runs that hook, and `ci.yml` has no
commitlint step (no job runs `commitlint --from/--to` or lints the PR title). The rule can therefore
be violated silently, and nothing in the guide says how to satisfy it (set the PR title and body
before merging, since GitHub builds the squash message from them). The "Not yet enforced" section
lists branch protection, required checks and squash-only merge but omits this, so a reader will
assume the hook covers squash merges.

**Fix:** Add one sentence to "Commit and squash messages": "GitHub builds the squash message from the
pull request title and description; set them to a commitlint-valid message before merging. No CI
check validates this yet." Add "commit message linting in CI" to "Not yet enforced", or add a CI step
(`pnpm exec commitlint --from "$BASE_SHA" --to "$HEAD_SHA"` on `pull_request`, plus the PR title).

### WR-04: Retry budget exceeds the job timeout and permanent failures are retried

**File:** `.github/workflows/ci.yml:80`, `.github/workflows/ci.yml:113-126`
**Issue:** The loop sleeps 30, 60, 90, 120 and 150 seconds (450 s) per image before the sixth
attempt, for each of 7 images, so the step alone can sleep 52 minutes, while the job has
`timeout-minutes: 40` (covering install, Playwright install and the whole suite). Under a sustained
registry outage the job is cancelled by the timeout before the `::error::Could not pull` line is ever
printed. The step has no `timeout-minutes` of its own. Every failure is retried identically, including
permanent ones (`manifest unknown`, `invalid reference format`, `not found`), so a bad tag from a
Dependabot Docker bump waits 7.5 minutes before failing. The attempt count `6` is written three times
(`1 2 3 4 5 6`, `-eq 6`, `of 6`).

**Fix:** Bound the step and parameterise the count:

```yaml
- name: Pre-pull images
  timeout-minutes: 12
  run: |
    max=6
    ...
    for attempt in $(seq 1 "$max"); do
      ...
      if [ "$attempt" -eq "$max" ]; then ...
```

Optionally capture the `docker pull` output and break out early when it contains `manifest unknown`
or `invalid reference format`.

## Info

### IN-01: The new CI step has never run, and its key assumption is not verified

**File:** `.github/workflows/ci.yml:95-99`
**Issue:** Nothing has been pushed, so no CI run has exercised this step. The comment asserts that
BuildKit pulls the `# syntax=` frontend during `--build` and so pre-pulling `docker/dockerfile:1`
helps; BuildKit may still contact Docker Hub to resolve the `1` tag even when the image is in the
local store, so the frontend pre-pull may not remove that request. This could not be verified here
(no Docker on the review host).

**Fix:** After the first push, confirm from the e2e job log that `docker compose up` and `--build`
report no registry pulls for the seven listed images, and soften the comment if the frontend is
still fetched.

### IN-02: The CI change landed directly on `main`, contrary to the policy added one commit earlier

**File:** `.github/workflows/ci.yml` (commit `d3da748`), `CONTRIBUTING.md:11`
**Issue:** Row 2 requires a pull request for anything touching `.github/`, yet `d3da748` (which
modifies `ci.yml`) sits directly on `main` right after `83eae2c` introduced that rule. It is
unavoidable for the pre-push curated history, but it means the first workflow change was not
validated by a PR run before reaching `main`.

**Fix:** Either treat the first push as the validating run (see IN-01) or deliver the next `ci.yml`
change through a PR so the policy is exercised from the start.

### IN-03: "Checks before pushing" is not the CI set

**File:** `CONTRIBUTING.md:53-56`
**Issue:** The list (`lint`, `format:check`, `typecheck`, `test`) omits `pnpm build`, which is a
required CI job (`ci.yml` `build`, and `apps/service` `build` also runs `write-openapi.ts`), and
`pnpm test:integration`, which gates `test-integration`. A contributor following the guide can push a
change that fails the `build` job. `README.md` documents both commands.

**Fix:** Add `pnpm build`, and name `pnpm test:integration` (needs `supabase start`) and `pnpm test:e2e`
as the remaining CI jobs, or say the list is the fast subset.

### IN-04: Branch and worktree instructions are incomplete

**File:** `CONTRIBUTING.md:35-44`
**Issue:** "Delete the branch after its squash merge" does not work with `git branch -d`: a squash
merge is not an ancestor, so Git refuses and requires `-D` (or `gh pr merge --delete-branch`). The
guide never says to remove the worktree (`git worktree remove ../hearth-{topic}`), so stale worktrees
and their `node_modules` accumulate. `{type}` is not defined (commit types are in
`commitlint.config.js`, but the guide does not say the branch prefix should be one of them).

**Fix:** "After the squash merge: `git worktree remove ../hearth-{topic}` then `git branch -D
{type}/{topic}`. `{type}` is a commit type from `commitlint.config.js`."

### IN-05: Commit rule summary omits rules the hook enforces

**File:** `CONTRIBUTING.md:27-33`
**Issue:** Verified by running commitlint with this repo's config: `feat(web): Add thing` fails
(`subject-case`, inherited from `config-conventional`: no sentence, start, pascal or upper case), and
`commitlint.config.js` also forbids a trailing full stop. The guide lists only type/scope, subject
length and body length, so a squash title written "Fix ..." or ending in a period passes the guide and
fails the hook. Also, `fix(ci): ...` is rejected because `ci` is a type but not a scope, which the
reference to "closed lists" does not make obvious (scopes are optional; types and scopes are not
interchangeable).

**Fix:** Add: "Start the subject in lower case and do not end it with a full stop. Scope is optional,
and `ci` is a type, not a scope."

### IN-06: Commit conventions cite an "Engineering Practices" spec that does not exist in `docs/`

**File:** `CONTRIBUTING.md:3-4`, `commitlint.config.js:1` (also `deploy.yml`, `ci.yml`, `e2e/setup/stack.ts` comments)
**Issue:** `grep -rn "Engineering Practices" docs/` returns nothing, so the section named by
`commitlint.config.js` ("closed lists in Engineering Practices -> Conventional Commits") and by the
deploy and CI comments is dangling. `CONTRIBUTING.md` now holds the only prose statement of the commit
and branch rules, and it sits outside `docs/`, while the guide itself says `docs/` remains the source
of truth. It is not a policy violation (no review or ADR file was added to `docs/`), but the two
statements point at each other inconsistently.

**Fix:** Point the `commitlint.config.js` header comment (and the `deploy.yml` "Engineering
Practices" comment) at `CONTRIBUTING.md`, or state in `CONTRIBUTING.md` that it is the canonical home
of the commit and branch rules.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
