#!/usr/bin/env bash
# Builds and pushes the `ci/enforce-gates` branch (Phase 6, PR 2) from committed patches.
#
# Why this exists: the session's token has no `workflow` scope, so GitHub refuses a branch that
# changes .github/workflows/. Run this from your own clone, with credentials that carry the scope.
# It applies the patches onto the exact base the work was proven on and pushes only when the
# resulting tree is the proven tree. It never reads or prints a token.
#
# Usage: git fetch origin && bash <(git show origin/{WB}:.planning/cleanup/patches/ci-enforce-gates/apply.sh)
# On Windows Git Bash, save the script to a file first and run it with
# MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' bash {file}.
# Set DRY_RUN=1 to build and check the tree without pushing.
set -euo pipefail

WB="claude/confident-dirac-10eu0a"
BASE="d0c587c0b55cf3f4c68404b80d6ed7ad40f1c59f"
TREE="54069f099544ee0c93b741e935104ffe6a271acd"
BRANCH="ci/enforce-gates"
PATCHES=(
  "0001-ci-add-a-hygiene-job-that-runs-the-repository-gates.patch"
  "0002-test-web-raise-the-coverage-thresholds-to-the-measur.patch"
  "0003-ci-enforce-web-coverage-db-types-drift-and-job-timeo.patch"
  "0004-ci-run-the-date-and-time-zone-sweep-on-main-and-nigh.patch"
  "0005-ci-gate-deploys-on-the-running-revision-and-keep-no-.patch"
  "0006-docs-describe-the-CI-gates-the-sweep-workflow-and-th.patch"
)

if [ -n "$(git ls-remote --heads origin "$BRANCH")" ]; then
  echo "origin already has $BRANCH; nothing to do (check it with: git ls-remote --heads origin $BRANCH)." >&2
  exit 1
fi

git fetch origin "$WB"
if ! git cat-file -e "$BASE^{commit}"; then
  echo "Base commit $BASE is not in this clone; fetch it first (git fetch origin $WB)." >&2
  exit 1
fi

tmp="$(mktemp -d)"
cleanup() {
  git worktree remove --force "$tmp" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

git worktree add --detach "$tmp" "$BASE"

for p in "${PATCHES[@]}"; do
  git show "origin/$WB:.planning/cleanup/patches/ci-enforce-gates/$p" | git -C "$tmp" am --3way
done

actual="$(git -C "$tmp" rev-parse 'HEAD^{tree}')"
if [ "$actual" != "$TREE" ]; then
  echo "Tree mismatch: expected $TREE, got $actual. Not pushing." >&2
  exit 1
fi

sha="$(git -C "$tmp" rev-parse HEAD)"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY_RUN=1: not pushing. Built $sha"
else
  git -C "$tmp" push origin "HEAD:refs/heads/$BRANCH"
  echo "Pushed $BRANCH at $sha"
fi
echo "tree matches ($actual)"
