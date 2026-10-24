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

A passing `CI` push run on `main` triggers the Deploy workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)), which asks
[`scripts/deploy-gate.sh`](scripts/deploy-gate.sh) whether to deploy. The gate compares the commit
with the revision the running `hearth-service` image was built from:

- It deploys when anything outside `docs/` and `.planning/` changed since that revision, over the
  whole range and not only the tip commit. A code change whose deploy never ran therefore still
  ships behind a later docs-only commit. The root `README.md`, `CONTRIBUTING.md` and `.claude/` are
  outside those two folders, so editing them deploys.
- It never deploys a commit older than the running one (a re-run of an old `CI` run). A re-run of
  the running commit redeploys it.
- It deploys when no labelled image is running or the running revision is not in the history.
- A newer Deploy run replaces a pending one; the gate still deploys every change since the running
  revision.

The deploy job runs on a self-hosted runner labelled `hearth`. Until such a runner is registered, a
Deploy run waits in the queue and deploys nothing.

## What CI checks

The `CI` workflow runs seven jobs on every pull request and every push to `main`, each with a
timeout:

| Job                | What fails it                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `lint`             | `pnpm lint` or `pnpm format:check`.                                                                      |
| `typecheck`        | `pnpm typecheck`.                                                                                        |
| `test-unit`        | The harness tests, any non-web workspace's tests, or the web unit tests below their coverage thresholds. |
| `test-integration` | The integration suite, or `apps/service/src/db/types.ts` differing from what `pnpm db:types` generates.  |
| `test-e2e`         | A Playwright journey or accessibility check.                                                             |
| `build`            | `pnpm build`.                                                                                            |
| `hygiene`          | Any of the six checks below.                                                                             |

`test-unit` enforces the web coverage thresholds set in `apps/web/vite.config.ts`; add tests rather
than lowering a threshold. `test-integration` applies the migrations to a local database,
regenerates the types and fails on a difference: run `pnpm db:types` after a migration and commit
the result, and never edit that file by hand.

The `hygiene` job runs these six checks as separate steps. Every step runs even after another one
failed, so one run shows every finding:

| Check                                           | Fails when                                                                                                  | How to satisfy it                                                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm knip`                                     | knip reports any unused file, export or dependency.                                                         | Remove the dead code or dependency.                                                                                                                                                                |
| `node scripts/check-knip-baseline.mjs`          | A production finding is not in `scripts/knip-production-baseline.txt`, or a baseline row no longer appears. | Remove the row that no longer appears. A new row needs the owner's review before it goes into the baseline.                                                                                        |
| `pnpm jscpd`                                    | Duplicated lines exceed 2% of all lines, tests included.                                                    | Extract the duplicate, or share the test helper.                                                                                                                                                   |
| `node scripts/audit-prod.mjs`                   | `pnpm audit --prod` reports an advisory that has no allowance.                                              | Upgrade the package. An allowance in `scripts/audit-allowlist.json` needs the GHSA id, an `expires` date at most 180 days ahead and a reason; an expired allowance fails even if it still matches. |
| `node scripts/check-repo-hygiene.mjs`           | A tracked file is ignored by `.gitignore`, a script is not mode `100755`, or a text file has CRLF endings.  | Untrack the file, or fix the mode or the line endings (see Scripts).                                                                                                                               |
| `node scripts/check-migrations-append-only.mjs` | A change edits, renames or deletes an applied migration under `supabase/migrations/`.                       | Add a new migration; never edit, rename or delete an applied one.                                                                                                                                  |

The audit and an allowance's expiry depend on the date, so `CI` can turn red on an unchanged tree
when a new production advisory is published. That blocks the next deploy until the package is
upgraded or the advisory is allowlisted with an expiry.

The separate `Sweep` workflow runs the unit suites across a fixed date and time-zone matrix on pushes
to `main` that change more than `docs/` and `.planning/`, and nightly with an extra cell that
depends on the day. It never gates a merge and never triggers a deploy. A failed scheduled run mails
whoever last changed the workflow's cron line, so keep Actions notifications on. See
[`docs/testing.md`](docs/testing.md) for the matrix.

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
`git ls-files --eol {file}` shows `i/lf`. CI's `hygiene` job fails a tracked script (a file that
starts with a shebang, or whose name ends in .sh) that is not `100755`, and any text file with
CRLF endings.

## Checks before pushing

Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm test`. Also run the checks that
`hygiene` runs: `pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`,
`node scripts/audit-prod.mjs` and `node scripts/check-repo-hygiene.mjs`; for a change that touches
migrations, `node scripts/check-migrations-append-only.mjs --base origin/main`. See
[`docs/testing.md`](docs/testing.md) for integration and E2E runs.

## Not yet enforced

GitHub branch protection, required status checks, and the squash-only merge setting are not
configured, so a red `CI` run blocks nothing on its own until the owner makes the checks required.
The rules above hold by convention until the owner enables them.
