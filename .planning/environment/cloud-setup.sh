#!/usr/bin/env bash
# Hearth cloud-session setup script.
#
# Purpose: prepare a fresh Ubuntu 22.04/24.04 container (run as root, no Docker) so a Claude Code
# cloud session can execute the GSD Phase 2 plans for the Hearth repo.
# Use: paste this file into the cloud environment's "setup script" field, or run
#   bash .planning/environment/cloud-setup.sh
# from a checkout. Idempotent: every step is skipped when already satisfied.
# Optional env: GIT_USER_NAME, GIT_USER_EMAIL, INSTALL_PLAYWRIGHT=1, SKIP_PNPM_INSTALL=1.
# Never prints token values; GH_TOKEN is consumed by `gh` from the environment only.
set -euo pipefail

NODE_VERSION="24.21.0"
NODE_SHA256="fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6"
PNPM_VERSION="10.34.5"
SUPABASE_VERSION="2.117.0"
SUPABASE_SHA256="69c05f85b9e47ee706d30f1a6ca8a526b4e337bfd12c7ef1ef522d24e7280d24"
GSD_CORE_VERSION="1.16.0"

GIT_USER_NAME="${GIT_USER_NAME:-Alex Tanton}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-alex.c.tanton@gmail.com}"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export DEBIAN_FRONTEND=noninteractive

log() { printf '==> %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ "$(id -u)" -ne 0 ]; then
  echo "cloud-setup.sh must run as root" >&2
  exit 1
fi

# 1. apt prerequisites
log "apt prerequisites"
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  curl ca-certificates xz-utils git postgresql-client gnupg >/dev/null

# 2. Node.js
if [ "$(/opt/node-v24/bin/node --version 2>/dev/null || true)" != "v${NODE_VERSION}" ]; then
  log "installing Node ${NODE_VERSION}"
  tarball="node-v${NODE_VERSION}-linux-x64.tar.xz"
  curl -fsSL -o "$WORK/$tarball" "https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"
  echo "${NODE_SHA256}  $WORK/$tarball" | sha256sum -c -
  rm -rf /opt/node-v24
  mkdir -p /opt/node-v24
  tar -xJf "$WORK/$tarball" -C /opt/node-v24 --strip-components=1
else
  log "Node ${NODE_VERSION} already installed"
fi
# Some images put another Node (for example /opt/node22/bin) ahead of /usr/local/bin, so also link
# into ~/.local/bin and prepend Node 24 in ~/.bashrc; `node --version` must print v24 in the session.
link_node_bins() {
  mkdir -p "${HOME}/.local/bin"
  for bin in "$@"; do
    if [ -e "/opt/node-v24/bin/$bin" ]; then
      ln -sf "/opt/node-v24/bin/$bin" "/usr/local/bin/$bin"
      ln -sf "/opt/node-v24/bin/$bin" "${HOME}/.local/bin/$bin"
    fi
  done
}
link_node_bins node npm npx corepack
path_line='export PATH="/opt/node-v24/bin:$PATH" # hearth: Node 24 first'
touch "${HOME}/.bashrc"
grep -qxF "$path_line" "${HOME}/.bashrc" || printf '%s\n' "$path_line" >> "${HOME}/.bashrc"
export PATH="/opt/node-v24/bin:$PATH"

# 3. pnpm via corepack
log "pnpm ${PNPM_VERSION}"
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate
link_node_bins pnpm pnpx

# 4. Supabase CLI
if [ "$(supabase --version 2>/dev/null || true)" != "${SUPABASE_VERSION}" ]; then
  log "installing Supabase CLI ${SUPABASE_VERSION}"
  asset="supabase_${SUPABASE_VERSION}_linux_amd64.tar.gz"
  curl -fsSL -o "$WORK/$asset" \
    "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/${asset}"
  echo "${SUPABASE_SHA256}  $WORK/$asset" | sha256sum -c -
  mkdir -p "$WORK/supabase"
  tar -xzf "$WORK/$asset" -C "$WORK/supabase"
  install -m 0755 "$WORK/supabase/supabase" /usr/local/bin/supabase
else
  log "Supabase CLI ${SUPABASE_VERSION} already installed"
fi

# 5. GitHub CLI (official apt repository)
if ! have gh; then
  log "installing gh"
  mkdir -p -m 755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
  chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update -qq
  apt-get install -y -qq gh >/dev/null
else
  log "gh already installed"
fi

# 6. GSD tooling (user-level / global Claude install, pinned)
gsd_version_file="${HOME}/.claude/gsd-core/VERSION"
if [ "$(cat "$gsd_version_file" 2>/dev/null || true)" != "${GSD_CORE_VERSION}" ]; then
  log "installing @opengsd/gsd-core@${GSD_CORE_VERSION} (global, claude)"
  npx -y "@opengsd/gsd-core@${GSD_CORE_VERSION}" --claude --global
else
  log "GSD core ${GSD_CORE_VERSION} already installed"
fi

# 7. git identity
log "git identity"
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"

# 8. repo dependencies (only when run from inside the Hearth checkout)
if root="$(git rev-parse --show-toplevel 2>/dev/null)" && [ -f "$root/package.json" ] \
  && grep -q '"name": *"hearth"' "$root/package.json"; then
  if [ "${SKIP_PNPM_INSTALL:-0}" != "1" ]; then
    log "pnpm install --frozen-lockfile in $root"
    (cd "$root" && pnpm install --frozen-lockfile)
  fi
  if [ "${INSTALL_PLAYWRIGHT:-0}" = "1" ]; then
    log "playwright chromium"
    (cd "$root" && pnpm --filter @hearth/e2e exec playwright install --with-deps chromium)
  fi
  check="$root/.planning/environment/cloud-check.sh"
else
  log "not inside the hearth checkout; skipping pnpm install"
  check=""
fi

# 9. verification (Docker is intentionally not installed)
if [ -n "$check" ] && [ -f "$check" ]; then
  bash "$check" || echo "cloud-check reported failures (see above)" >&2
else
  node --version
  pnpm --version
  supabase --version
  psql --version
  gh --version | head -1
fi
log "setup complete"
