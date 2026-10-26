# Hestia cloud environment

Setup for a Claude Code cloud session that executes GSD Phase 2.

## 1. What the environment needs

- Ubuntu 22.04/24.04 container, root during setup. Docker is optional (see section 5).
- Node 24.21.0, pnpm 10.34.5, Supabase CLI 2.117.0 (binary only), `psql`, `gh`, git.
- GSD tooling `@opengsd/gsd-core@1.16.0`, installed user-level (`--claude --global`), so
  `/gsd-execute-phase` and the gsd-executor/gsd-verifier agents exist.
- The repo checkout with a writable parent directory (worktrees go in `../hestia-*`).

`.planning/environment/cloud-setup.sh` installs all of this and runs
`pnpm install --frozen-lockfile`. Images that ship another Node ahead of `/usr/local/bin` on
`PATH` (the Claude Code cloud image has `/opt/node22/bin`) are handled: the script links Node 24
and pnpm into `~/.local/bin` and prepends `/opt/node-v24/bin` in `~/.bashrc`, so `node --version`
prints `v24.21.0` in the session.

## 2. Environment variables

| Variable                          | Required | Value                                         |
| --------------------------------- | -------- | --------------------------------------------- |
| `GH_TOKEN`                        | see note | Fine-grained PAT on `alex-tanton/hestia`      |
| `GIT_USER_NAME`                   | no       | Defaults to `Alex Tanton`                     |
| `GIT_USER_EMAIL`                  | no       | Defaults to `alex.c.tanton@gmail.com`         |
| `CI`                              | yes      | `true`                                        |
| `COREPACK_ENABLE_DOWNLOAD_PROMPT` | yes      | `0`                                           |
| `INSTALL_PLAYWRIGHT`              | no       | `1` installs Chromium (not needed for Phase 2) |

`GH_TOKEN`: a Claude Code cloud session already injects a proxy-managed GitHub credential, so
`gh` works without a token of your own (`gh auth status` reports that token as invalid, but API
calls succeed). Set your own fine-grained PAT only if `gh api repos/alex-tanton/hestia` fails;
it needs Contents RW, Pull requests RW, Actions R, Metadata R. `cloud-check.sh` and the plans
test GitHub access with that `gh api` call, never with `gh auth status`.

`TZ` must NOT be set: the deterministic-clock work depends on the container default.

## 3. Network allowlist

- `nodejs.org` (Node tarball and checksums)
- `registry.npmjs.org` (pnpm packages, corepack, GSD installer, knip, jscpd)
- `github.com`, `api.github.com`, `objects.githubusercontent.com`,
  `release-assets.githubusercontent.com` (git, gh, Supabase CLI release asset)
- `cli.github.com` (gh apt repository and key)
- Ubuntu apt mirrors (`archive.ubuntu.com`, `security.ubuntu.com`, or the provider mirror)
- Playwright only: `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`

## 4. Running it

1. Paste `cloud-setup.sh` into the environment's setup-script field (or run it from a checkout).
2. First command in the session: `bash .planning/environment/cloud-check.sh`
   It prints one PASS/FAIL line per check and exits non-zero on any required failure.

## 5. Docker

Docker is optional. Each plan that needs Supabase runs `docker info` first (phase rule 9):

- exit 0 selects path (a): `supabase start` and the integration runs happen locally;
- any other exit selects path (b): integration and E2E evidence comes from the pull request's CI
  jobs `test-integration` and `test-e2e` (plan 02-04 asks the owner before opening a draft PR).

Unit tests, lint, typecheck, format, knip and jscpd always run locally.

## 6. Git and GitHub

- `main` is published (Phase 1). `.planning/` and `.claude/CLAUDE.md` are tracked on it
  (`commit_docs: true`); raw logs under `.planning/cleanup/logs/` are gitignored.
- The plans push only `test/deterministic-clock` and `chore/knip-config`, as plain backup pushes
  after each plan, with no pull request until plan 02-08's gate (phase rule 4). Never `main`,
  never force. If the session's git proxy refuses those branch names, rule 4 stops and reports;
  that has not been tried yet.
- Opening pull requests (`gh pr create`) has not been tried from a cloud session; plan 02-04
  path (b) or plan 02-08 is the first place it happens.
- Cloud sessions are ephemeral. Phase rule 12 describes how a new session resumes from the
  pushed branches.

## 7. Instructions available in the cloud

The owner's user-level `~/.claude/CLAUDE.md` is not present. The project
`.claude/CLAUDE.md` is, so user-level rules (for example subagent-only implementation) do not
apply unless repeated in the session prompt.

## 8. Phase 2 entry

`/gsd-execute-phase 2`
