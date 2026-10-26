#!/usr/bin/env bash
# Builds and pushes the `ci/setup-action` branch (Phase 5, PR A) from committed patches.
#
# Why this exists: the session's token has no `workflow` scope, so GitHub refused to create a branch
# that changes .github/workflows/. Run this from your own clone, with credentials that carry the
# scope. It applies the patches onto the exact base the work was proven on and pushes only when
# the resulting tree is the proven tree. It never reads or prints a token.
#
# Usage: git fetch origin && bash <(git show origin/{WB}:.planning/cleanup/patches/ci-setup-action/apply.sh)
# Set DRY_RUN=1 to build and check the tree without pushing.
set -euo pipefail

WB="claude/eloquent-mayer-szjtjf"
BASE="c64d79e41ae7daab9ca48e3841a08db1446c64e5"
TREE="fd704a4c1fbb066fb7402eaee02a950aae456177"
BRANCH="ci/setup-action"
PATCHES=(
  "0001-ci-share-one-setup-action-across-the-six-CI-jobs.patch"
  "0002-chore-typecheck-the-seed-workspace-only-once.patch"
  "0003-ci-watch-the-setup-action-and-drop-two-spec-citation.patch"
)

if [ -n "$(git ls-remote --heads origin "$BRANCH")" ]; then
  echo "origin already has $BRANCH; nothing to do (check it with: git ls-remote --heads origin $BRANCH)." >&2
  exit 1
fi

git fetch origin "$WB"
if ! git cat-file -e "$BASE^{commit}"; then
  echo "Base commit $BASE is not in this clone; fetch it first (git fetch origin main)." >&2
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
  git show "origin/$WB:.planning/cleanup/patches/ci-setup-action/$p" | git -C "$tmp" am --3way
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
