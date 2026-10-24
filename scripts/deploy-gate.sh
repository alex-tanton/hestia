#!/usr/bin/env bash
# Decides whether the checked-out commit should be deployed. Prints exactly one line on stdout,
# `deploy=true` or `deploy=false`, and one `deploy-gate: ...` line on stderr naming the running
# revision and the rule that decided. Exit 0 whenever a decision was printed; exit 1, with nothing
# on stdout, when HEARTH_DEPLOY_SHA is unusable.
#
#   HEARTH_DEPLOY_SHA=$(git rev-parse HEAD) [HEARTH_DEPLOY_ATTEMPT=1] scripts/deploy-gate.sh
#
#   HEARTH_DEPLOY_SHA       the commit being deployed: 40 lowercase hex digits, equal to the checked-out
#                           HEAD. It comes from a workflow payload and this runs on the production box,
#                           so it is checked before anything else uses it.
#   HEARTH_DEPLOY_ATTEMPT   the attempt number of this Deploy run (1..9999, default 1). Re-running CI
#                           starts a new Deploy run (attempt 1) and skips the running commit; re-running
#                           the Deploy run itself raises attempt to 2 or more and redeploys it.
#
# Called by the `changes` step of .github/workflows/deploy.yml, with the checkout at fetch-depth 0
# (the comparison needs history). The decision compares HEAD with the revision of the image that is
# running, `hearth-service:current`, whose `org.opencontainers.image.revision` label deploy.sh sets
# to the first 12 hex digits of the deployed SHA:
#
#   - Comparing with the running revision, not with HEAD~1, means a code deploy that never ran
#     (superseded, or its run failed) still ships when a later docs-only commit's CI run arrives:
#     everything since the running revision is what matters, not the tip commit alone.
#   - docs/ and .planning/ are not deployed code (docs/ is the specs, .planning/ is planning
#     state), so a change confined to them deploys nothing.
#   - HEAD an ancestor of the running revision means a re-run of an older CI run; deploying it
#     would roll production back to a stale commit.
#   - HEAD equal to the running revision is skipped at attempt 1: a CI push run on main completes,
#     and starts a new Deploy run, once per attempt, so re-running any job of a green run reached
#     the gate for the commit already running and rebuilt production for nothing; that commit is now
#     skipped (OD-6). Re-running the Deploy run itself (attempt 2 or later) is the deliberate redeploy
#     (OD-7), for example after a deploy failed once `current` was already re-tagged; running
#     `scripts/deploy.sh` by hand on the host also works.
#     An unknown running revision (no image, a hand build labelled `dev`, a commit not in this
#     history, an ambiguous abbreviation) deploys: a first deploy or a hand-built image must
#     never block production.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image="hearth-service:current"
# Spelled out rather than a-f / 0-9 ranges: ranges can match uppercase in some locales.
hex='0123456789abcdef'

refuse() {
  printf 'deploy-gate: %s\n' "$*" >&2
  exit 1
}

decide() {
  printf 'deploy-gate: running revision %s: %s\n' "${running:-none}" "$2" >&2
  printf 'deploy=%s\n' "$1"
  exit 0
}

sha="${HEARTH_DEPLOY_SHA-}"
[[ -n "$sha" ]] || refuse "HEARTH_DEPLOY_SHA is not set"
[[ "$sha" =~ ^[$hex]{40}$ ]] || refuse "HEARTH_DEPLOY_SHA is not 40 lowercase hex digits"
head_sha="$(git -C "$repo_root" rev-parse HEAD)" || refuse "cannot read HEAD of $repo_root"
[[ "$sha" == "$head_sha" ]] || refuse "HEARTH_DEPLOY_SHA is not the checked-out HEAD ($head_sha)"

attempt="${HEARTH_DEPLOY_ATTEMPT-1}"
[[ "$attempt" =~ ^[1-9][0-9]{0,3}$ ]] || refuse "HEARTH_DEPLOY_ATTEMPT is invalid: $attempt"

running="$(docker image inspect \
  --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null)" ||
  running=""
if [[ -z "$running" ]]; then
  decide true "$image has no revision label or does not exist; deploying"
fi
if [[ ! "$running" =~ ^[$hex]{7,40}$ ]]; then
  # Printed as data; the label was written by a build and is never used as a command or a path.
  decide true "the label of $image is not a commit (hand build?); deploying"
fi

resolved="$(git -C "$repo_root" rev-parse --verify --quiet "${running}^{commit}")" || resolved=""
[[ -n "$resolved" ]] ||
  decide true "not a unique commit in this history; deploying"

if [[ "$resolved" == "$head_sha" ]]; then
  if (( attempt > 1 )); then
    decide true "equal to HEAD, but this is attempt $attempt of this Deploy run, a deliberate re-run; deploying again"
  else
    decide false "equal to HEAD; that commit is already running, nothing to deploy"
  fi
fi

# 0: yes, 1: no, anything else: git could not tell (e.g. a shallow clone).
ancestor() {
  local status=0
  git -C "$repo_root" merge-base --is-ancestor "$1" "$2" >/dev/null 2>&1 || status=$?
  return "$status"
}

status=0
ancestor "$head_sha" "$resolved" || status=$?
case "$status" in
  0) decide false "HEAD is older than the running revision; not rolling production back" ;;
  1) ;;
  *) decide true "cannot compare HEAD with it (shallow history?); deploying" ;;
esac

status=0
ancestor "$resolved" "$head_sha" || status=$?
case "$status" in
  0) ;;
  1) decide true "not an ancestor of HEAD (diverged history); deploying" ;;
  *) decide true "cannot compare it with HEAD (shallow history?); deploying" ;;
esac

# Read with -z so a path with an odd character cannot split or hide another path, and without
# rename detection so moving code into docs/ still lists the code path it removed.
changed=0
while IFS= read -r -d '' path; do
  changed=$((changed + 1))
  case "$path" in
    docs/* | .planning/*) ;;
    *) decide true "code or config changed since it (first: $path); deploying" ;;
  esac
done < <(git -C "$repo_root" diff --name-only --no-renames -z "$resolved" "$head_sha")

decide false "only docs/ and .planning/ changed since it ($changed paths); nothing to deploy"
