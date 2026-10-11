# Contributing

This file describes how changes reach `main` and what the checks expect of them. The specifications
in [`docs/`](docs/) remain the source of truth for behavior, architecture, and design.

## How changes land

| Change                                                                                                                            | How it lands                                           |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Docs-only, comment-only, formatting, lockfile or dependency version bumps, and mechanical renames                                 | Commit straight to `main`.                             |
| Anything that changes behavior, tests, CI (`.github/`), migrations (`supabase/migrations/`), or Docker (`docker/`, compose files) | Pull request from a branch or worktree, squash-merged. |

A change that mixes both kinds goes through a pull request.

## Deploys

A push or merge to `main` deploys once CI passes, unless the tip commit touches only paths under
`docs/` (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). The root `README.md`
and `CONTRIBUTING.md` are not under `docs/`, so editing them deploys. The check looks only at the tip
commit of a push.

The deploy job runs on a self-hosted runner labelled `hearth`. Until such a runner is registered, a
Deploy run waits in the queue and deploys nothing.

## Commit and squash messages

- Use Conventional Commits, with types and scopes from the closed lists in
  [`commitlint.config.js`](commitlint.config.js).
- Keep the subject (the text after `type(scope): `) to at most 71 characters. For squash merges,
  keep it short enough that GitHub's appended ` (#N)` still fits.
- Keep body lines to at most 100 characters.
- Every squash message must pass commitlint.
- Never bypass the hooks (`--no-verify`, `HUSKY=0`).

## Branches and worktrees

Name branches `{type}/{topic}` and create each one in its own worktree:

```sh
git worktree add ../hearth-{topic} -b {type}/{topic}
```

Run `pnpm install` inside each new worktree. That installs the Husky hooks there; without it no hook
runs. Delete the branch after its squash merge.

## Scripts

Add a new executable with `git add --chmod=+x {file}` (or `git update-index --chmod=+x {file}`),
because checkouts with `core.filemode=false` cannot record the bit. Check it with
`git ls-files -s {file}`, which must show `100755`. Files stay LF through `.gitattributes`;
`git ls-files --eol {file}` shows `i/lf`.

## Checks before pushing

Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm test`. See
[`docs/testing.md`](docs/testing.md) for integration and E2E runs.

## Not yet enforced

GitHub branch protection, required status checks, and the squash-only merge setting are not
configured. The rules above hold by convention until the owner enables them.
