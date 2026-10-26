#!/usr/bin/env bash
# Read-only environment verification for the Hestia cloud session.
# Run: bash .planning/environment/cloud-check.sh   (exit code non-zero if a required check fails)
set -u

fail=0
pass() { printf 'PASS  %s\n' "$1"; }
bad() { printf 'FAIL  %s\n' "$1"; fail=1; }
info() { printf 'INFO  %s\n' "$1"; }

# Run from the repo root regardless of cwd.
script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
cd "$repo_root" || exit 2

v="$(node --version 2>/dev/null || true)"
case "$v" in
  v24.*) pass "node $v" ;;
  *) bad "node must be v24.x (found: ${v:-missing})" ;;
esac

v="$(pnpm --version 2>/dev/null || true)"
if [ "$v" = "10.34.5" ]; then pass "pnpm $v"; else bad "pnpm must be 10.34.5 (found: ${v:-missing})"; fi

v="$(supabase --version 2>/dev/null || true)"
if [ "$v" = "2.117.0" ]; then pass "supabase $v"; else bad "supabase must be 2.117.0 (found: ${v:-missing})"; fi

if command -v psql >/dev/null 2>&1; then pass "psql present"; else bad "psql missing"; fi

if command -v git >/dev/null 2>&1; then
  n="$(git config --get user.name || true)"
  e="$(git config --get user.email || true)"
  if [ -n "$n" ] && [ -n "$e" ]; then pass "git identity set"; else bad "git user.name/user.email not set"; fi
else
  bad "git missing"
fi

# gh must reach the API. A cloud session's proxy-managed GH_TOKEN makes `gh auth status` report an
# invalid token even though API calls work, so probe the API instead.
if command -v gh >/dev/null 2>&1; then
  v="$(gh api repos/alex-tanton/hestia --jq .full_name 2>/dev/null || true)"
  if [ "$v" = "alex-tanton/hestia" ]; then
    pass "gh reaches the GitHub API (repos/alex-tanton/hestia)"
  else
    bad "gh cannot read repos/alex-tanton/hestia (no GitHub access; see CLOUD-ENVIRONMENT.md)"
  fi
else
  bad "gh missing"
fi

if probe="$(mktemp -d "$repo_root/../.hestia-write-check.XXXXXX" 2>/dev/null)" && rmdir "$probe"; then
  pass "parent directory writable ($(cd "$repo_root/.." && pwd))"
else
  bad "cannot create sibling worktree directories next to the repo"
fi

if [ -n "${TZ:-}" ]; then
  bad "TZ is set to '$TZ'; it must be unset for the deterministic-clock work"
else
  pass "TZ unset"
fi

gsd="${HOME}/.claude/gsd-core/VERSION"
if [ -f "$gsd" ]; then pass "GSD core $(cat "$gsd")"; else bad "GSD core missing ($gsd)"; fi

# Optional
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    info "docker: present, daemon reachable (optional)"
  else
    info "docker: present, daemon not reachable (optional)"
  fi
else
  info "docker: absent (optional; no supabase start, integration or E2E locally)"
fi

if [ "$fail" -eq 0 ]; then echo "RESULT: all required checks passed"; else echo "RESULT: required checks failed"; fi
exit "$fail"
