#!/usr/bin/env bash
# Apply the phase 8 patches to a local clone and push them.
# Run from Git Bash, from the root of your hearth clone:
#   bash apply-and-push.sh            (or path to this script)
set -euo pipefail

BRANCH="claude/confident-dirac-10eu0a"
PATCH_DIR=".planning/phases/08-full-rebrand-to-hestia/patches"

[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Working tree has local changes; commit or stash them first." >&2; exit 1; }

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

# Windows checkouts may rewrite line endings; keep patches byte-exact.
git config core.autocrlf false
git am --abort 2>/dev/null || true
git am --3way --keep-cr "$PATCH_DIR"/0*.patch

# Drop the patch files themselves so they do not stay in the branch.
git rm -r -q "$PATCH_DIR"
git commit -q -m "chore: remove applied phase 8 patch files"

git push origin "$BRANCH"
echo "Pushed $BRANCH. Open the pull request, then follow the owner checklist."
