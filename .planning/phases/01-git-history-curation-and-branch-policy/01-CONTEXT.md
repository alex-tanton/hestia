# Phase 1: Git History Curation and Branch Policy - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Curate the ~58 local commits on `main` (on top of origin's `7da55e3`) into a clean, commitlint-passing history, get owner approval, publish it to `origin/main` as a fast-forward (no force-push), and write down the branch/PR policy. Scripts in the curated history must be `100755` with LF endings (GIT-01..GIT-04). Nothing else: no dead-code work, no CI redesign, no deploy.yml changes.

</domain>

<decisions>
## Implementation Decisions

### Curation shape
- **D-01:** Reword + fold fixups. Keep roughly one commit per feature/test unit (~35-40 product commits remain); fold obvious fix-of-previous commits into their parents (e.g. `fix(e2e): ...`, `test(web): wait on the observable pending mark...`, `docs: cut self-referential narration...`); reword any subject failing commitlint (closed type and scope lists in `commitlint.config.js`, subject max 71). Do NOT collapse into milestone-sized commits.
- **D-02:** Proof standard = tree identical + commitlint over the range + every rewritten commit builds. Concretely: the final tree of the curated branch has an empty `git diff` against the current product tree of `main` (excluding the deliberate changes in D-03/D-04 and the removed planning files); `commitlint --from 7da55e3` exits clean; per-commit typecheck is run with `git rebase --exec` over the rewritten range. The original `main` is kept as a backup ref until the owner signs off.

### .planning/ and tooling files
- **D-03:** `.planning/` and `.claude/CLAUDE.md` stay local-only. Strip them (and the `.planning/research/.cache/` line the research commit added to `.gitignore`) from every published commit and drop the 7 planning commits (`3707ef2`, `ab2f814`, `224b93b`, `99f8447`, `1cd79c0`, `307ec55`, `f84077d`, plus any commit made during this discussion) from the published range. Implement via `.git/info/exclude` (per-clone, no repo trace) rather than a committed `.gitignore` entry. Set `commit_docs=false` in `.planning/config.json` so GSD stops committing planning docs. The rewrite must leave the local `.planning/` files intact in the working tree (copy aside and restore).
- **D-04:** (Claude's discretion, derived from GIT-04) `.husky/pre-commit` and `.husky/commit-msg` are currently `100644`; set them to `100755` for consistency with the success criterion "every script". Other scripts (`scripts/*.sh`, `docker/*-entrypoint.sh`, `apps/service/bin/hearth-admin`) are already `100755`. Apply mode fixes at the commit that introduces each file so every commit in the curated history is correct. `.gitattributes` already has `* text=auto eol=lf`; scan the whole curated range for CRLF in `*.sh` and hook files.

### First push and deploy
- **D-05:** Stage the push: (1) push the curated history to a throwaway non-main branch first (e.g. `curated-main`) so CI proves green on GitHub without the deploy path (deploy.yml only fires for `head_branch == main`); (2) after owner approval, push `main` as a fast-forward of `7da55e3`. No force-push is ever needed. The owner approves the rewrite plan and each push explicitly.
- **D-06:** Nothing is deployed anywhere and no `[self-hosted, hearth]` runner exists. The Deploy workflow will sit queued after a green CI push; accept this, leave `deploy.yml` untouched (review is Phase 6, CI-05/CI-07), and say so in the plan and approval request so the owner is not surprised. The owner may cancel the queued run manually.

### Branch/PR policy
- **D-07:** Policy lives in `CONTRIBUTING.md` at the repo root (not `docs/`, not an ADR or decision log).
- **D-08:** Rule is path/size-based, text only. Direct to `main`: docs-only, comment-only, formatting, lockfile/dependency bumps, mechanical renames. PR from a branch or worktree with squash merge: anything changing behavior, tests, CI, migrations, or Docker. Squash message must satisfy commitlint (same type and scope lists). GitHub branch protection and required checks are noted as an owner follow-up and are NOT configured by this phase.

### Claude's Discretion
- Exact rebase todo (which commits fold into which), final commit count, and wording of reworded subjects. Present as a proposed plan for owner approval before executing.
- Mechanics of the rewrite (rebase vs. cherry-pick onto a fresh branch, worktree usage), as long as the D-02 proofs hold and `main` is not force-pushed.
- Whether `CONTRIBUTING.md` also links to the commitlint type/scope lists and `docs/testing.md`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and project scope
- `.planning/ROADMAP.md` "Phase 1" - goal, success criteria, mode
- `.planning/REQUIREMENTS.md` "Git history and workflow" - GIT-01..GIT-04
- `.planning/PROJECT.md` - Git constraints, Key Decisions (curate first, PRs for major work)
- `.claude/CLAUDE.md` Constraints - no review/decision-log/ADR files in `docs/`; confirm the rewrite plan before the first push

### Commit and workflow rules in the repo
- `commitlint.config.js` - closed type list and scope list, subject max length 71
- `.husky/commit-msg`, `.husky/pre-commit`, `.lintstagedrc.json` - hooks that run on each commit (relevant to the rewrite; do not use `--no-verify` without owner approval)
- `.gitattributes` - `* text=auto eol=lf`, binary patterns
- `.github/workflows/ci.yml` - triggers `pull_request` and `push` to `main`; workflow name `CI` must not change
- `.github/workflows/deploy.yml` - `workflow_run` on `CI`, `branches: [main]`, runs only for push events from `main`, skips when the tip commit touches only `docs/`
- `docs/deploy.md` - as-built deploy reference
- `docs/testing.md` - as-built testing reference (candidate link from CONTRIBUTING.md)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `commitlint.config.js` + `@commitlint/cli`: `pnpm exec commitlint --from 7da55e3 --to HEAD` is the GIT-01 proof.
- `.gitattributes` already enforces LF; use `git ls-files --eol` for the CRLF scan.

### Established Patterns
- Conventional commits with scopes `web|service|shared|recurrence|matching|db|e2e|docker`; subjects are lowercase imperative with no trailing period.
- Local history is 58 commits ahead of origin: 51 product commits (`e86c43c` spec docs first, then scaffold, docker, db, web/service features, e2e journeys, coverage work, deps update) plus 7 GSD planning commits at the tip.

### Integration Points
- `origin` is `git@github-personal:alex-tanton/hearth.git` and holds only `7da55e3`; `origin/HEAD` points to `origin/main`.
- Husky hooks run lint-staged and commitlint on every commit, which affects per-commit rewrite speed.
- Phases 2-6 assume work lands via branches/worktrees and PRs per this phase's policy.

</code_context>

<specifics>
## Specific Ideas

- Per-commit build check via `git rebase --exec "pnpm typecheck"` (owner explicitly chose "every commit builds").
- First push goes to a non-main branch to see CI green before `main` moves.

</specifics>

<deferred>
## Deferred Ideas

- Guarding `deploy.yml` with a repo variable, or disabling the Deploy workflow until a runner exists: Phase 6 (CI-05/CI-07) or when production is set up.
- GitHub branch protection, required status checks, and squash-only merge setting: owner follow-up, confirmed in Phase 6.

</deferred>

---

*Phase: 1-Git History Curation and Branch Policy*
*Context gathered: 2026-10-11*
