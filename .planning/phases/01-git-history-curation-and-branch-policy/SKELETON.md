# Walking Skeleton - Hearth Cleanup and Hardening

**Phase:** 1
**Generated:** 2026-10-11

## Capability Proven End-to-End

The owner can open `origin/main` on GitHub and see a curated, commitlint-clean history. It reached GitHub as a fast-forward of `7da55e3` only after three explicit approvals, and it carries a written rule (`CONTRIBUTING.md`) for how every later change lands.

Scope note: Hearth's application stack (Fastify service, React/Vite PWA, Postgres/Supabase, Docker Compose) already exists, and this phase does not touch it. No scaffold, route, database read or write, or UI interaction is added, and none is invented here. What this skeleton proves is the delivery path every later phase depends on:

local branch or worktree, then Husky hooks and proofs, then owner approval, then `origin/main`, which deploys.

The thinnest slice through that path is plan 01-01 Task 1, extended by plan 01-02 Task 1. A dry-run push proves the remote fast-forward before anything is published.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| History base | `origin/main` starts at `7da55e3`; every publish is a fast-forward; force-push is never used | GIT-02; history is immutable once public |
| Product range | `b96ca32` is the product tip; the curated branch is built from that SHA, never from `HEAD~N` | Planning commits sit contiguously above it, and GSD may add more |
| Curation mechanics | Scripted `git rebase -i 7da55e3` in the sibling worktree `../hearth-curate` (branch `curated-main`); `fixup` for folds; `exec ... git commit --amend -F` for rewords | The worktree never touches the primary checkout's local files; amends run the hooks as a gate (D-01) |
| Proof standard | Tree identity against `b96ca32`; `commitlint --from 7da55e3`; per-commit typecheck through `git rebase --exec`; mode and CRLF scan of every commit with a planted control; secret scan | D-02, GIT-04; checks read git objects, not the Windows working tree (`core.filemode=false`) |
| Planning artifacts | `.planning/` and `.claude/` are local-only through `.git/info/exclude`; `commit_docs=false` | D-03; no repo trace |
| Publish path | Staging branch `curated-main`, then a PR (CI on `pull_request`; Deploy cannot fire), then owner approval, then `git push origin {tip}:refs/heads/main` | D-05; CI does not run on pushes to non-main branches |
| Deploy side effect | The first `main` push creates a Deploy run that queues with no `[self-hosted, hearth]` runner; `deploy.yml` is untouched | D-06; guarding Deploy is Phase 6 |
| Landing policy | Root `CONTRIBUTING.md`: docs-only, comment-only, formatting, lockfile or dependency bumps and mechanical renames go direct to `main`; behavior, tests, CI, migrations and Docker go through a squash-merged PR from a branch or worktree | D-07, D-08 |
| Commit gate | Husky `pre-commit` (lint-staged, `pnpm typecheck`) and `commit-msg` (commitlint) on every commit, never bypassed | CI has no commitlint step, so the hooks are the only message gate |
| Script hygiene | Executables are committed as `100755` with `git add --chmod=+x`; LF via `.gitattributes` | GIT-04; this host cannot record the exec bit from the working tree |

## Stack Touched in Phase 1

- [ ] Repository history: 43 curated product commits plus 1 policy commit on `origin/main` (plans 01-02, 01-05)
- [ ] Commit gates: Husky hooks and commitlint exercised on every reworded commit and the policy commit (plan 01-02)
- [ ] Proofs: tree identity, commitlint range, per-commit typecheck, mode/CRLF scan, secret scan (plans 01-02, 01-03)
- [ ] Remote: staging branch push, PR CI run, fast-forward push of `main` (plans 01-04, 01-05)
- [ ] Policy: `CONTRIBUTING.md` on `main` (plan 01-02)
- [ ] Local workspace: `main` moved without losing local-only planning files; hooks installed in the primary checkout (plan 01-05)
- Not applicable, because the application already exists and is out of scope here: project scaffold, routing, database, UI, deployment target

## Conventions Later Phases Inherit (local)

- Worktree bootstrap: run `git worktree add ../hearth-{topic} -b {type}/{topic}`, then `pnpm install` inside it (this installs the Husky hooks there). Copy `.claude/` into the worktree if a Claude session will run inside it. Run GSD commands from the primary checkout, where `.planning/` lives. `.git/info/exclude` is shared, so the copies stay untracked.
- Local format check: `pnpm exec prettier --check . '!.planning/**' '!.claude/**'`. Prettier reads `.gitignore` and `.prettierignore`, but not `.git/info/exclude`.
- Node: this host runs Node 26 while CI pins Node 24. Typecheck parity holds; compare test results on Node 24 (Phase 2).
- Never push `backup/*` refs or GSD tags.
- GSD worktree isolation (`workflow.use_worktrees`) was off for Phase 1, because the phase rewrites refs and moves `main` in the primary checkout. Whether to re-enable it for later phases is the owner's call.

## Out of Scope (Deferred to Later Slices)

- Guarding or disabling `deploy.yml` until a runner exists (Phase 6, CI-05 and CI-07, or production setup)
- GitHub branch protection, required status checks and the squash-only merge setting (owner follow-up, confirmed in Phase 6)
- Commit-message linting in CI
- Any application, test, CI, migration or Docker change

## Subsequent Slice Plan

Each later phase lands through the `CONTRIBUTING.md` rule without changing the decisions above:

- Phase 2: baseline, deterministic tests, calibrated knip and jscpd. Pull requests from branches or worktrees.
- Phase 3: evidence-gated removal of dead code. Pull requests.
- Phase 4: bug fixes, each with a red-then-green regression test. Pull requests.
- Phase 5: redundancy reduction and text sync. Pull requests for CI and fixtures; docs-only edits go direct to `main`.
- Phase 6: CI enforcement and lock-in. Pull requests; a throwaway PR confirms that `CI` still triggers Deploy.
