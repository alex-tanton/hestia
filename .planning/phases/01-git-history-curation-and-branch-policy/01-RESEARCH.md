# Phase 1: Git History Curation and Branch Policy - Research

**Researched:** 2026-10-11
**Domain:** Local git history rewrite (Windows host), first publish to GitHub, branch/PR policy file
**Confidence:** HIGH (mechanics were rehearsed end to end in throwaway clones under the scratchpad; GitHub-side behavior is MEDIUM, cited from docs and not testable without pushing)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Reword + fold fixups. Keep roughly one commit per feature/test unit (~35-40 product commits remain); fold obvious fix-of-previous commits into their parents (e.g. `fix(e2e): ...`, `test(web): wait on the observable pending mark...`, `docs: cut self-referential narration...`); reword any subject failing commitlint (closed type and scope lists in `commitlint.config.js`, subject max 71). Do NOT collapse into milestone-sized commits.
- **D-02:** Proof standard = tree identical + commitlint over the range + every rewritten commit builds. Concretely: the final tree of the curated branch has an empty `git diff` against the current product tree of `main` (excluding the deliberate changes in D-03/D-04 and the removed planning files); `commitlint --from 7da55e3` exits clean; per-commit typecheck is run with `git rebase --exec` over the rewritten range. The original `main` is kept as a backup ref until the owner signs off.
- **D-03:** `.planning/` and `.claude/CLAUDE.md` stay local-only. Strip them (and the `.planning/research/.cache/` line the research commit added to `.gitignore`) from every published commit and drop the 7 planning commits (`3707ef2`, `ab2f814`, `224b93b`, `99f8447`, `1cd79c0`, `307ec55`, `f84077d`, plus any commit made during this discussion) from the published range. Implement via `.git/info/exclude` (per-clone, no repo trace) rather than a committed `.gitignore` entry. Set `commit_docs=false` in `.planning/config.json` so GSD stops committing planning docs. The rewrite must leave the local `.planning/` files intact in the working tree (copy aside and restore).
- **D-04:** (Claude's discretion, derived from GIT-04) `.husky/pre-commit` and `.husky/commit-msg` are currently `100644`; set them to `100755` for consistency with the success criterion "every script". Other scripts (`scripts/*.sh`, `docker/*-entrypoint.sh`, `apps/service/bin/hearth-admin`) are already `100755`. Apply mode fixes at the commit that introduces each file so every commit in the curated history is correct. `.gitattributes` already has `* text=auto eol=lf`; scan the whole curated range for CRLF in `*.sh` and hook files.
- **D-05:** Stage the push: (1) push the curated history to a throwaway non-main branch first (e.g. `curated-main`) so CI proves green on GitHub without the deploy path (deploy.yml only fires for `head_branch == main`); (2) after owner approval, push `main` as a fast-forward of `7da55e3`. No force-push is ever needed. The owner approves the rewrite plan and each push explicitly.
- **D-06:** Nothing is deployed anywhere and no `[self-hosted, hearth]` runner exists. The Deploy workflow will sit queued after a green CI push; accept this, leave `deploy.yml` untouched (review is Phase 6, CI-05/CI-07), and say so in the plan and approval request so the owner is not surprised. The owner may cancel the queued run manually.
- **D-07:** Policy lives in `CONTRIBUTING.md` at the repo root (not `docs/`, not an ADR or decision log).
- **D-08:** Rule is path/size-based, text only. Direct to `main`: docs-only, comment-only, formatting, lockfile/dependency bumps, mechanical renames. PR from a branch or worktree with squash merge: anything changing behavior, tests, CI, migrations, or Docker. Squash message must satisfy commitlint (same type and scope lists). GitHub branch protection and required checks are noted as an owner follow-up and are NOT configured by this phase.

### Claude's Discretion

- Exact rebase todo (which commits fold into which), final commit count, and wording of reworded subjects. Present as a proposed plan for owner approval before executing.
- Mechanics of the rewrite (rebase vs. cherry-pick onto a fresh branch, worktree usage), as long as the D-02 proofs hold and `main` is not force-pushed.
- Whether `CONTRIBUTING.md` also links to the commitlint type/scope lists and `docs/testing.md`.

### Deferred Ideas (OUT OF SCOPE)

- Guarding `deploy.yml` with a repo variable, or disabling the Deploy workflow until a runner exists: Phase 6 (CI-05/CI-07) or when production is set up.
- GitHub branch protection, required status checks, and squash-only merge setting: owner follow-up, confirmed in Phase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GIT-01 | ~55 local commits curated (squashed, reworded, reordered, noise dropped) onto origin's initial commit, messages pass commitlint | Planning commits are the 9 contiguous tip commits, so "drop" is trivial. A conflict-free 8-fold todo yields 43 product commits, tree-identical to `b96ca32` (rehearsed). 13 original commits fail `body-max-line-length` (verified by running commitlint 21.2.2); 11 survive the folds and need reworded bodies. See "Fold plan" and Pitfall 1. |
| GIT-02 | Owner approves the rewrite plan before the first push; history reaches `origin/main` as a fast-forward | Curated branch is built on `7da55e3`, so `git push origin curated-main:main` is a fast-forward by construction. Two approval gates (plan, then each push). A staging branch alone triggers no CI; a PR is required (Pitfall 6). |
| GIT-03 | Branch and PR policy written down: major work via PR from branch/worktree with squash merge; docs-only/mechanical straight to `main` | `CONTRIBUTING.md` skeleton below. Must reconcile with `deploy.yml`, where only paths under `docs/` skip a deploy (Pitfall 9). |
| GIT-04 | Scripts keep executable bit and LF endings in committed history | All 5 shebang scripts are already `100755` since introduced; only `.husky/pre-commit` and `.husky/commit-msg` need `+x`, applied in the rewrite of `3ae2afd` (rehearsed). Whole-range mode/CRLF scan script below (positive control run). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted from `./.claude/CLAUDE.md`, `~/.claude/CLAUDE.md` and project memory. Treat as locked.

- **Git (project):** nothing has been pushed; history must be cleaned before the first push; use branches or worktrees for local work; confirm the rewrite plan with the owner before any force-push or first push.
- **Docs (project + memory):** specs in `docs/` are the only source of truth; no review, decision-log, or ADR files are added there. The approval artifact for this phase therefore lives under `.planning/phases/01-.../`, never `docs/`.
- **Behavior / Evidence / Verification:** application behavior must not change; every change needs proof; full suite and CI stay green. For Phase 1 this is the tree-identity proof.
- **Tooling conventions:** conventional commits with the closed type and scope lists (commitlint), Prettier (`singleQuote`, `printWidth: 100`) applied by lint-staged to `*.md`, `pnpm typecheck` on every commit via `.husky/pre-commit`. Do not use `--no-verify` without owner approval (CONTEXT canonical refs).
- **GSD enforcement:** repo edits go through a GSD workflow; do not edit outside one.
- **Global user rules:** plan first, delegate implementation to a subagent, review with a *separate* subagent, keep the main context lean (report pass/fail counts, not full output).
- **Attribution:** commits created by Claude end with the `Co-Authored-By` trailer supplied by the harness; rewritten historic commits keep their original trailers (16 Opus 5, 35 Sonnet 5 in the product range).

## Summary

This is a local history rewrite plus a first publish, not a code phase. Everything needed was rehearsed in throwaway clones, so the plan can be prescriptive. The product history is `e86c43c..b96ca32` (51 commits); the 9 planning commits (`3707ef2` .. `4bec3ce`) are contiguous at the tip and touch only `.planning/`, `.claude/CLAUDE.md` and one `.gitignore` line. "Strip planning files" therefore reduces to "build the curated branch from `b96ca32`, never from `HEAD`". `git diff --name-only b96ca32 HEAD` lists only `.claude/*`, `.gitignore` and 19 `.planning/*` paths.

Three facts shape the plan. (1) Commitlint over the range does **not** pass today for a reason other than the type/scope lists: 13 product commits exceed `body-max-line-length` (100) and the two newest planning commits use unlisted scopes (they are dropped anyway). (2) `reword` and `exec git commit --amend` run the Husky hooks (pre-commit `typecheck` about 20-30 s, then `commit-msg` commitlint), while `pick`/`fixup` run none, so the rewording step is itself a commitlint gate and no `--no-verify` is needed. (3) A push of a non-main branch triggers nothing: `ci.yml` runs only on `pull_request` and `push` to `main`, so D-05's "prove CI green first" requires opening a PR from the staging branch, and `gh` is not installed.

**Primary recommendation:** Build `curated-main` in a separate worktree from `b96ca32` with a scripted `git rebase -i 7da55e3` (8 fixups + 11 reworded bodies + `.husky` mode fix inside the `3ae2afd` reword), add one `docs:` commit with `CONTRIBUTING.md`, prove tree identity / commitlint / per-commit typecheck / mode+CRLF, then move `main` with `git update-ref` + `git reset` (never a checkout in the primary working tree), and publish via a staging branch + PR before the fast-forward push of `main`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rewrite history (fold, reword, reorder, drop) | Local clone (git) | - | Pure local operation; `origin` is never force-pushed. |
| Commit-message and per-commit build proof | Local clone (Husky hooks, commitlint, pnpm typecheck) | - | CI does not run commitlint at all (`ci.yml` has no such step), so the only gate is local. |
| Mode/EOL guarantees | Local clone (index modes via `git update-index`, `.gitattributes`) | Repo files (`.gitattributes`) | `core.filemode=false` on this host means the working tree cannot express +x. |
| Stage and publish history | GitHub remote (`origin`, SSH alias `github-personal`) | Owner (approval) | Push is irreversible in practice once SHAs are public. |
| CI proof on the staged history | GitHub Actions (`pull_request` event) | Owner (opens the PR in a browser) | Branch push alone does not trigger CI. |
| Deploy side effect of the first push | GitHub Actions `deploy.yml` (self-hosted runner) | - | No runner exists; job queues. Owner-visible, not owner-actionable beyond cancel. |
| Branch/PR policy | Repo file `CONTRIBUTING.md` | `docs/file-map.md` row | Policy is text only; enforcement (branch protection) is a GitHub setting deferred to the owner. |
| Keeping `.planning/` and `.claude/` local | Local clone (`.git/info/exclude`) | `.planning/config.json` (`commit_docs=false`) | No repo trace by design (D-03). |

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git | 2.56.0.windows.1 `[VERIFIED: git --version]` | `rebase -i`, `update-index --chmod`, `worktree`, `update-ref`, `ls-files --eol` | The only history-rewrite tool needed. Planning commits sit at the tip, so no `filter-repo`/`filter-branch` is required. |
| @commitlint/cli + @commitlint/config-conventional | 21.2.2 `[VERIFIED: package.json:24-25 "@commitlint/cli": "21.2.2", "@commitlint/config-conventional": "21.2.2"]` | Message gate (D-02 proof) | Already the repo's gate, wired in `.husky/commit-msg`. |
| husky | 9.1.7 `[VERIFIED: package.json:33 "husky": "9.1.7"]` | Runs `.husky/pre-commit` and `.husky/commit-msg` through `.husky/_/h` | Existing. Hook files do not need the exec bit: `h` runs `sh -e "$s" "$@"` `[VERIFIED: .husky/_/h in scratch clone after pnpm install]`. |
| pnpm | 10.34.5 `[VERIFIED: pnpm --version]` | `pnpm install --frozen-lockfile`, `pnpm typecheck` (about 33 s at the tip) | Repo package manager. |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| lint-staged | 17.5.1 `[VERIFIED: package.json]` | pre-commit formatting of staged files | Runs inside hooks; no extra action. |
| Prettier | 3.9.8 `[VERIFIED: package.json]` | `prettier --check CONTRIBUTING.md` before committing the policy | The lint job runs `pnpm format:check` over root `*.md`. |
| `git worktree` | built in | Isolated curation checkout so `.planning/` in the primary tree is never touched | Always for this phase. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `git rebase -i` with a generated todo | cherry-pick each commit onto a fresh branch | Same result; loses `fixup` ergonomics and the built-in reword gate. |
| Per-commit typecheck loop (`checkout --detach` + `pnpm typecheck`) | `git rebase -x "pnpm typecheck"` | `-x` is acceptable but a failure leaves a half-finished rebase; the loop is read-only. D-02 says `git rebase --exec`; either satisfies "every rewritten commit builds". Prefer `-x` only as a final pass over the finished branch (no SHAs change when nothing fails). |
| `squash` for folded fixes | `fixup` | `fixup` drops the fix's message. Use `squash` only where the fix body carries information the parent lacks (decide per commit; see fold table). |

**Installation:** none. No new packages. Node on this host is `v26.10.0` against `.nvmrc` `24` and `engines >=24 <25`; `pnpm install` only warns (`WARN Unsupported engine`), and typecheck passes `[VERIFIED: scratch clone, 7 workspaces]`.

**Version verification:** commitlint/husky/pnpm versions come from the repo's own `package.json`, and commitlint 21.2.2 was executed against the real range (see Validation). Nothing new is installed in the repo.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none added) | - | - | - | - | n/a | No external packages are installed or recommended by this phase. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*For verification only, `@commitlint/cli@21.2.2` and `@commitlint/config-conventional@21.2.2` (the versions already pinned in the repo lockfile) were installed in a scratchpad directory outside the repo. They are existing project dependencies, so no legitimacy gate applies.*

## Architecture Patterns

### System Architecture Diagram

```
origin/main = 7da55e3 (README only)          local main = 60 commits ahead
        |                                           |
        |                       backup ref + bundle (before anything else)
        |                                           |
        |      b96ca32 = product tip (51 commits)   |   9 planning commits above it
        |            |                              |   (dropped, never replayed)
        |            v
        |   git worktree ../hearth-curate -b curated-main b96ca32
        |            |  pnpm install (creates .husky/_ so hooks fire)
        |            v
        |   git rebase -i 7da55e3   (todo from file via GIT_SEQUENCE_EDITOR=cp)
        |      pick / fixup (no hooks)      reword = exec amend -F msg (hooks: typecheck + commitlint)
        |      3ae2afd reword also does:  git update-index --chmod=+x .husky/*
        |            v
        |   + docs commit: CONTRIBUTING.md (+ docs/file-map.md row)
        |            v
        |   PROOFS: tree == b96ca32 (2 mode lines only) | commitlint --from 7da55e3
        |           per-commit typecheck loop | mode+CRLF scan | secret scan
        |            v
        |   OWNER GATE 1: rewrite plan (todo table, author identity, push consequences)
        |            v
        |   git push origin curated-main        -> no workflow fires (push filter = main)
        |   owner opens PR curated-main -> main -> CI (pull_request, incl. e2e); Deploy not fired
        |            v
        |   OWNER GATE 2: approve main push
        |            v
        +-- git push origin curated-main:main   (fast-forward)
                     -> CI (push, main) -> on success Deploy (workflow_run) -> queued, no runner
                     -> PR auto-marked merged; Dependabot wakes
        local main moved with git update-ref + git reset (primary tree untouched; .planning stays)
```

### Recommended Working Layout

```
C:\Users\actanton\Development\hearth          primary checkout (main, .planning/ tracked until the move)
C:\Users\actanton\Development\hearth-curate   curation worktree (curated-main)   <- all rewrite work here
<outside repo>\hearth-pre-curation.bundle     insurance bundle of --all
<outside repo>\planning-aside\                copy of .planning/ and .claude/
```

### Pattern 1: Safety net before anything else

**What:** Three independent copies of the old state.
**When:** First task, before any rewrite command.
```bash
git branch backup/pre-curation main                      # D-02 "original main kept as a backup ref"
git bundle create "../hearth-pre-curation.bundle" --all  # survives reflog expiry and branch deletion
cp -r .planning ../planning-aside/.planning && cp -r .claude ../planning-aside/.claude
```
Never push `backup/*`.

### Pattern 2: Scripted interactive rebase in a separate worktree

**What:** Generate a todo file, feed it with `GIT_SEQUENCE_EDITOR`, reword with `exec git commit --amend -F`.
**Why a worktree:** rebasing in the primary tree checks out `7da55e3`, which deletes every tracked `.planning/` file from disk (they are tracked until the move). The worktree never touches them.
```bash
git worktree add ../hearth-curate -b curated-main b96ca32      # NOT HEAD~N: HEAD moves when GSD commits
cd ../hearth-curate && pnpm install --frozen-lockfile          # ~55 s; creates .husky/_ and sets hooks
test -f .husky/_/h || { echo "hooks not installed - STOP"; exit 1; }   # else hooks silently do not run
printf '#!/bin/sh\ncp "%s" "$1"\n' "$PWD/../todo.txt" > ../seq.sh && chmod +x ../seq.sh
GIT_SEQUENCE_EDITOR="$PWD/../seq.sh" git rebase -i 7da55e3
```
Todo lines (rehearsed, conflict-free):
```
pick 3ae2afd
exec git update-index --chmod=+x .husky/pre-commit .husky/commit-msg && git commit --amend -F ../msgs/3ae2afd.txt
pick 3d771d7
fixup a14ecea
```
`[VERIFIED: scratch clone]` The amend with `-F` on `3ae2afd` ran hooks (14.6 s), commit-msg passed the wrapped message, `git ls-files -s .husky` then showed `100755`, blob hashes unchanged, and `git diff 3ae2afd HEAD` showed only two `old mode 100644 / new mode 100755` entries.

### Pattern 3: Fold plan (rehearsed: 51 -> 43 commits, no conflicts, tree identical)

| Fold (fixup) | Into | Note |
|--------------|------|------|
| `a14ecea` fix(web) keep focus after magic-link swap | `3d771d7` | adjacent |
| `77e642c` fix(service) coalesce fetches / dormant-claim race | `05a2d5a` | moved back past `1c8efe8`, `c4198c9`; no conflict |
| `2a410ac` test(web) wait on observable pending mark | `c4198c9` | single file `write-queue.test.tsx` |
| `4365c07` fix(e2e) per-run compose project, subnet, ports | `258f790` | moved back past `bafa74f`..`0ae57b4`; no conflict |
| `b2076b2` fix(service) preserve a chore's turn | `d3b272e` | touches `packages/recurrence` too; keep scope `service` |
| `114cd99` fix(service) reject a rotation that repeats a member | `d3b272e` | its body currently fails the line cap |
| `c592695` docs cut self-referential narration | `08936e7` | |
| `95b0bd2` test(service) legitimate PATCH persists | `1030b35` | body references `1030b35` by SHA, which would dangle |

Keep separate (real behavior changes, not mere fixups): `1de9275` (touches `app.ts`/`env.ts`/`main.ts`, whose previous toucher `d3b272e` makes moving it earlier conflict-prone), `8691032` (a cross-cutting timezone bug fix), `96af7b7`, `258f790`, `8a7e756`.
Result 43 commits plus the policy commit = 44. This is within a rounding of D-01's "~35-40"; folding more is possible but each extra fold needs its own rehearsal. Treat the list above as the *proposed* plan for the owner gate.

### Pattern 4: Reword list (messages fail `body-max-line-length`)

Original failures `[VERIFIED: commitlint 21.2.2 run per commit]`: `3ae2afd`, `46d170e`, `279b398`, `8d2b6de`, `c4198c9`, `bafa74f`, `0ae57b4`, `114cd99`, `b1cd32c`, `8a7e756`, `801f9fd`, `1030b35`, `95b0bd2`. `114cd99` and `95b0bd2` disappear in folds, leaving **11 to reword**. `8a7e756`'s body contains literal backslash-n sequences (a message-writing bug) that must become real line breaks. Wrapping at about 98 columns with `fold -s -w 98` then hand review worked for `3ae2afd`. Keep the `Co-Authored-By` trailer on its own last line. Optional (owner decision): strip references to documents that no longer exist ("Handoff non-negotiable 5", "PRD", "Design 17"); the bodies cite the old spec set that `08936e7` replaced.

### Pattern 5: Proofs (all four must pass before the owner gate)

```bash
# 1. Tree identity (D-02). Expect exactly two mode lines, nothing else.
git diff b96ca32 curated-main                      # old mode 100644 / new mode 100755 for .husky/commit-msg and .husky/pre-commit
# 2. commitlint over the whole range (GIT-01)
pnpm exec commitlint --from 7da55e3 --to curated-main ; echo "exit=$?"
# 3. Per-commit typecheck (read-only loop; see "Code Examples")
# 4. Mode + CRLF scan across every commit (GIT-04; see "Code Examples")
```

### Pattern 6: Move local `main` without touching `.planning/`

After owner sign-off, in the **primary** checkout, with `.planning/` and `.claude/` already listed in `.git/info/exclude`:
```bash
git update-ref refs/heads/main "$(git rev-parse curated-main)" "$(git rev-parse main)"  # old value guard
git reset -q                                  # mixed: index := new HEAD, working tree untouched
git checkout -- .gitignore                    # working copy still has the dropped '.planning/research/.cache/' line
git status --short                            # expect clean; .planning/ and .claude/ now ignored
```
Fallback if anything looks wrong: restore from `../planning-aside/` and `backup/pre-curation`.

### Pattern 7: Staged publish

```bash
git ls-remote origin main                       # expect 7da55e3...  (verified reachable over SSH today)
git merge-base --is-ancestor origin/main curated-main && echo FAST-FORWARD-OK
git push --dry-run origin curated-main:main     # sanity before the real thing
git push -u origin curated-main                 # stage 1 (owner-approved). Triggers no workflow.
# owner opens https://github.com/alex-tanton/hearth/pull/new/curated-main  (gh CLI is not installed)
git push origin curated-main:main               # stage 2 (owner-approved). Fast-forward, no --force.
```

**Approval request contents (write it to `.planning/phases/01-.../`, never `docs/`):**
1. Old-to-new commit table: every one of the 51 product SHAs with action (`pick`, `fixup into X`, `reword`), the 9 dropped planning SHAs, and the new subject lines.
2. Proof output summary: tree diff (two mode lines), commitlint exit 0 over `7da55e3..tip`, per-commit typecheck pass count, mode/CRLF scan result, secret-scan result.
3. Decisions needing an answer: author email (Pitfall 8), optional stripping of stale spec references from bodies, and whether further folds are wanted.
4. Consequences of each push: stage 1 (branch) triggers nothing; the PR runs CI (6 jobs including e2e) and never Deploy; stage 2 (`main`) runs CI on `push`, then Deploy is created and, if CI passed, its job waits for a `[self-hosted, hearth]` runner that does not exist (queued up to 24 h, owner may cancel; if CI failed the job is skipped); the PR is marked merged; Dependabot becomes active.
5. Rollback: `backup/pre-curation` branch and the bundle; a remote `curated-main` can be deleted; after the `main` push there is no rollback without a force-push, which is why gate 2 exists.

### `CONTRIBUTING.md` skeleton (root, prettier-clean, no ADR/decision-log content)

Sections, in this order, each short:
1. **How changes land** - table with two rows. *Direct to `main`:* changes that only touch documentation, comments, formatting, lockfile or dependency version bumps, or mechanical renames. *Pull request from a branch or worktree, squash-merged:* any change to behavior, tests, CI (`.github/`), migrations (`supabase/migrations/`), or Docker (`docker/`, compose files). Mixed change goes through a PR.
2. **Deploys** - a merge or push to `main` deploys once CI passes, unless the tip commit touches only `docs/` (`.github/workflows/deploy.yml`). `README.md` and `CONTRIBUTING.md` are *not* under `docs/`, so editing them redeploys.
3. **Commit and squash messages** - Conventional Commits; types and scopes are the closed lists in `commitlint.config.js` (link, do not copy); subject at most 71 characters after `type(scope): ` (GitHub appends ` (#N)` on squash, leave room); body lines at most 100 characters; never `--no-verify`.
4. **Branches and worktrees** - `git worktree add ../hearth-<topic> -b <type>/<topic>`; run `pnpm install` in each (it installs the Husky hooks for that worktree).
5. **Scripts** - new executables need `git add --chmod=+x <file>` (or `git update-index --chmod=+x`); verify with `git ls-files -s <file>` showing `100755`; files stay LF (`.gitattributes`).
6. **Not yet enforced** - branch protection and required checks are not configured; these rules are by convention.
Also add one row for `CONTRIBUTING.md` to the table in `docs/file-map.md` ("Repository layout"), which enumerates every root file, so RED-05 does not later flag drift.

### Anti-Patterns to Avoid

- **Rebasing in the primary checkout:** deletes tracked `.planning/` files from disk; use the worktree.
- **`HEAD~9` / `HEAD~N` as the range:** GSD may add another planning commit before execution. Always `b96ca32`.
- **`git commit --no-verify` or `HUSKY=0`:** disables both gates. Check `echo "${HUSKY-}"` is empty.
- **`git add` on Windows for a new script without `--chmod=+x`:** commits `100644` (positive control run: a fresh `good.sh` was staged `100644`).
- **Pushing `curated-main` before the plan is final:** a branch push publishes the SHAs and author identity just as a `main` push does.
- **Editing `deploy.yml` or `ci.yml` "to make the first push nicer":** out of scope (D-06, Phase 6), and the workflow name `CI` must not change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropping/renaming/reordering commits | `filter-branch` scripts or hand-built commit objects | `git rebase -i` with a generated todo | Tip-contiguous planning commits make plain rebase sufficient; replay is conflict-checked by git. |
| Message validation | A custom regex linter | `pnpm exec commitlint --from 7da55e3 --to <tip>` | Only commitlint applies `config-conventional` rules (header 100, body-line 100, case rules) on top of the repo's closed lists. A hand regex missed the body-line rule. |
| "Does the rewrite lose anything" | Eyeballing diffs | `git diff b96ca32 curated-main` and `git rev-parse <x>^{tree}` | Tree identity is exact and cheap. |
| Per-commit mode/EOL audit | Manual `ls -l` | `git ls-tree` + `git grep -P '\r$'` over each rev | Working-tree modes are meaningless here (`core.filemode=false`). |
| Moving `main` while keeping untracked-to-be files | `git checkout`/`reset --hard` in the primary tree | `git update-ref` + mixed `git reset` | Hard operations delete the tracked `.planning/` files. |

**Key insight:** every guarantee here is a property of the object database (trees, modes, messages), so verify it from git objects (`ls-tree`, `diff`, `grep <rev>`), not from the Windows working tree.

## Runtime State Inventory

History rewrite and an untracking migration, so each category is answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None in a datastore. SHA references: `.planning/STATE.md` frontmatter `state_head: d2d654f6d8e7772ba89f192c84e8106bcc52df1e` (SHA will no longer be on `main`); one commit body (`95b0bd2`) cites `1030b35` | After the move, update `state_head` in local STATE.md (code-edit of a local file, not a migration); fold `95b0bd2` into `1030b35` so no body cites a dead SHA |
| Live service config | GitHub repo settings are not visible from the repo: visibility, default branch, whether Actions is enabled, branch protection, squash-merge defaults, Dependabot. `dependabot.yml` will activate on first push to the default branch | Owner to confirm before gate 2 (Open Question 4); nothing for the repo to change |
| OS-registered state | `.git/config` has `core.hooksPath = .husky/_` (shared by all worktrees; resolves relative to each worktree root) and `core.filemode=false`; `.git/info/exclude` contains `BUILD_PROMPT.md` only | Add `.planning/` and `.claude/` to `.git/info/exclude` (shared by worktrees). Each new worktree needs its own `pnpm install` to create `.husky/_` |
| Secrets/env vars | None. Secret-pattern scan over all product diffs found only dev defaults (`postgres:postgres@127.0.0.1`, `hearth_service:hearth@127.0.0.1`) and the jwt.io sample token; no private keys, no tracked `.env` (only `.env.example`) | None. Mention the scan in the approval request |
| Build artifacts / installed packages | Primary checkout has **no** `node_modules` (never installed); `.husky/_/` is untracked and self-ignored (`*`) | Install per worktree; do not assume the primary tree can run hooks |

## Common Pitfalls

### Pitfall 1: commitlint fails on body line length, not on type or scope
**What goes wrong:** the owner expects "closed type and scope lists" to be the only risk; 13 product commits fail `body-max-line-length` `[VERIFIED: commitlint run]`, so GIT-01 fails on an unmodified range.
**Why it happens:** the commits were written with hook bypass or unwrapped bodies; `config-conventional` caps body lines at 100.
**How to avoid:** reword the 11 survivors; never rely on the type/scope lists alone. Warning sign: `✖ body's lines must not be longer than 100 characters [body-max-line-length]`.

### Pitfall 2: Rewording silently skips hooks when `.husky/_` is missing
**What goes wrong:** in a fresh worktree `core.hooksPath=.husky/_` points at a directory that does not exist; git runs no hooks and the commitlint gate vanishes.
**How to avoid:** `pnpm install` in the worktree, then assert `test -f .husky/_/h`. Also confirm `HUSKY` is unset.

### Pitfall 3: `fixup`/`pick` run no hooks, `reword`/`amend` do
**What goes wrong:** assuming every replayed commit was linted, or being surprised by 20-30 s per reword.
**How to avoid:** `[VERIFIED: scratch]` reword stopped the rebase on a bad message (22.8 s, commit-msg failure); a `fixup` rebase of 3 commits took 1.8 s with no hooks. Run the explicit `commitlint --from ... --to ...` proof regardless.

### Pitfall 4: New scripts commit as `100644` on this host
**What goes wrong:** `core.filemode=false` (repo-local), so `chmod +x` never reaches the index.
**How to avoid:** `git update-index --chmod=+x` / `git add --chmod=+x`; verify with `git ls-files -s`. Document it in `CONTRIBUTING.md`; CI-03 (Phase 6) will automate it.

### Pitfall 5: Local `pnpm format:check` fails after `.planning/` becomes untracked
**What goes wrong:** Prettier honors `.gitignore` and `.prettierignore`, not `.git/info/exclude`. `prettier --check .` over a copy of the local `.planning/` + `.claude/` reports **34 files** needing formatting (`[VERIFIED: scratch]`). CI is unaffected (files absent), but every later phase's local verification would show noise.
**How to avoid:** use `pnpm exec prettier --check . '!.planning/**' '!.claude/**'` locally (verified exit 0); do not add the paths to `.prettierignore` (that is a repo trace, against D-03). `eslint .` is unaffected (JS/TS only).

### Pitfall 6: A branch push does not run CI
**What goes wrong:** D-05 step 1 assumes pushing `curated-main` shows CI. `ci.yml:3-6` is `pull_request:` plus `push: branches: [main]`, so nothing fires until a PR exists.
**How to avoid:** the plan must include "owner opens a PR `curated-main` -> `main`" (GitHub prints the URL on push; `gh` is not installed). The PR's `head_branch` is `curated-main`, so `deploy.yml:10` (`branches: [main]`) and `:24` (`head_branch == 'main'`) do not fire. Do **not** merge the PR with the button (a squash/merge commit would break the fast-forward); push `main` instead and GitHub marks the PR merged `[CITED: github.blog/changelog/2023-09-26 - a PR is marked merged when its commits reach the base branch directly]`.

### Pitfall 7: The first-ever CI run will probably be red, so "proves green" cannot be a gate
**What goes wrong:** the repo has never run on GitHub. TIME-01 records 7 time-dependent failing web test files; `test-unit` runs `pnpm test` which includes the web suite. `[VERIFIED: scratch clone at b96ca32, Sunday 2026-10-11, Node 26, machine under load]` `pnpm test` exited 1: service 54 files / 716 tests, shared 148, matching 156 and recurrence 77 all passed, but web had `2 failed | 54 passed (56)` files and `3 failed | 712 passed (715)` tests (`src/App.test.tsx` x2, `src/lib/offline/write-queue.test.tsx` x1). The cause (date dependence versus CPU contention) was not isolated, so treat the count as "red is plausible", not as the Phase 2 baseline.
**How to avoid:** word D-05 as "CI runs and results are reported", and tell the owner in the approval request that a red `test-unit` is the documented Phase 2 baseline, not a regression of the rewrite (tree identity proves nothing changed). If CI is red on `main`, Deploy is created but its job is skipped (`deploy.yml:22` requires `conclusion == 'success'`).

### Pitfall 8: Author identity is permanent after the first push
**What goes wrong:** all 60 local commits are authored and committed as `Alex Tanton <actanton@ncsu.edu>` (from `~/.gitconfig`), while the remote is the personal account reached with `Key-GH-Personal` via the `github-personal` host alias and the Initial commit used `alex.c.tanton@gmail.com`. After publish, the email cannot be changed without a force-push.
**How to avoid:** ask the owner at gate 1. If the personal address is wanted: `git config --local user.email ...` first, then add `--reset-author` to the amend/rebase (`git rebase --exec 'git commit --amend --no-edit --reset-author'` or `-c user.email=` on the pass). Decide before the staging push, because a branch push also publishes authorship.

### Pitfall 9: "Docs-only direct to main" is narrower in deploy.yml
**What goes wrong:** `deploy.yml:35` skips a deploy only when `git diff --name-only HEAD~1 HEAD` contains nothing outside `docs/`. A root `README.md` or `CONTRIBUTING.md` edit pushed straight to `main` will deploy. The filter also inspects only the tip commit, so a multi-commit push whose tip is docs-only skips the deploy of everything under it.
**How to avoid:** say so in `CONTRIBUTING.md` (section 2). The policy commit itself (root `CONTRIBUTING.md`) is a non-`docs/` tip, which is harmless because Deploy queues anyway.

### Pitfall 10: First push wakes Dependabot
**What goes wrong:** `.github/workflows` is not the only automation: `dependabot.yml` (npm `/`, github-actions `/`, docker `/docker`, weekly, grouped) activates once it is on the default branch `[CITED: docs.github.com configuring-dependabot-version-updates - "checks ... as soon as it's enabled"]`. Expect up to three grouped PRs, each running CI including e2e, some possibly major bumps that the milestone puts out of scope.
**How to avoid:** no repo change. Tell the owner; Dependabot PRs follow the same squash-merge rule, and its configured prefixes (`build`, `ci`, `build(docker)`, `dependabot.yml:11,21,31`) already satisfy the closed lists.

### Pitfall 11: Local-only `.planning/` and `.claude/` do not exist in new worktrees
**What goes wrong:** D-08 asks for worktrees, D-03 untracks `.planning/` and `.claude/CLAUDE.md`. `git worktree add` checks out tracked files only, so a worktree session has no planning docs and no project CLAUDE.md (`claude_md_path` is `./.claude/CLAUDE.md`).
**How to avoid:** not a Phase 1 blocker, but record a worktree bootstrap in the local plan notes (copy `.claude/` into the worktree; run GSD from the primary checkout). `.git/info/exclude` is shared, so copies stay untracked. Symlinks are unavailable (`core.symlinks=false`). Flag for phases 2-6 (Open Question 3).

### Pitfall 12: Node 26 on this host, Node 24 in CI
**What goes wrong:** results and rehearsals ran on Node 26.10.0; typecheck does not depend on it, but test behavior might.
**How to avoid:** use typecheck (not tests) as the per-commit gate, as D-02 specifies; leave test parity to Phase 2 (STATE.md already notes this).

## Code Examples

### Per-commit typecheck loop (read-only, run after the todo is finished)
```bash
# Source: scratchpad preflight.sh, run over the ORIGINAL range in a clone
export HUSKY=0                      # safe here: no commits are made
for c in $(git rev-list --reverse 7da55e3..curated-main); do
  git checkout -q --detach "$c" || exit 1
  [ -f package.json ] || continue   # e86c43c (docs only) has no workspace
  pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1 || { echo "INSTALL-FAIL $c"; continue; }
  pnpm typecheck >/dev/null 2>&1 && echo "PASS $c" || echo "FAIL $c"
done
git checkout -q curated-main
```
Expect about 20-45 s per commit (about 20 min for 43). `pnpm install --frozen-lockfile` fails when a commit changed a `package.json` specifier without the lockfile; treat `INSTALL-FAIL` as a finding, not an automatic stop.

### Mode and CRLF scan across the whole range (GIT-04)
```bash
fail=0
for c in $(git rev-list --reverse 7da55e3..curated-main); do
  # every file whose first line is a shebang, except markdown, must be 100755
  git grep -n -I -e '^#!' "$c" -- . ':!*.md' | awk -F: '$3==1 {print $2}' | while read -r f; do
    m=$(git ls-tree "$c" -- "$f" | awk '{print $1}')
    [ "$m" = 100755 ] || echo "NONEXEC $c $f $m"
  done
  # *.sh, hooks, entrypoints, bin scripts must contain no CR
  git grep -l -I -P '\r$' "$c" -- '*.sh' '.husky/*' 'apps/service/bin/*' 'docker/*-entrypoint.sh' | sed "s/^/CRLF /"
done
# tip-level cross-check (success criterion 4 commands)
git ls-files -s | grep -E '\.sh$|hearth-admin|\.husky/'      # every line must start 100755
git ls-files --eol | grep -v 'i/lf'                           # only the 2 PNGs (-text) and .gitkeep (none) are expected
```
`[VERIFIED]` positive control: a throwaway repo with a CRLF `bad.sh` was reported by both `git grep -P '\r$'` and `git ls-files --eol` (`i/crlf`). `[VERIFIED]` over the original range the scan printed no `NONEXEC` or `CRLF` lines. Note `.mjs` helpers (`apps/web/scripts/check-build.mjs`, `generate-icons.mjs`) have no shebang and are run via `node`; `100644` is correct for them.

### Move to the policy commit (hooks verify the message)
```bash
git add CONTRIBUTING.md docs/file-map.md
pnpm exec prettier --check CONTRIBUTING.md
git commit -m "docs: add contributing guide with branch and pr policy"   # type docs, no scope: passes scope-enum
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Rewrite with `git filter-branch` | `git rebase -i` (small, linear, tip-only removals) | No extra tool, conflict reporting, reword hooks act as a lint gate |
| Trust the working tree for modes | Index/tree modes (`ls-files -s`, `ls-tree`) | Required on Windows with `core.filemode=false` |
| Deploy filter compares tip commit only | Known limitation (`deploy.yml:35`), Phase 6 review | Policy text must describe actual behavior |

**Deprecated/outdated:** nothing in the toolchain; actions used by CI all resolve (`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `supabase/setup-cli@v3`, `actions/upload-artifact@v7`, and Supabase CLI `v2.117.0` tags exist `[VERIFIED: git ls-remote --tags]`), so the first run will not fail at job setup for a missing action.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pull_request` CI uses the workflow files of the PR merge ref, so `ci.yml` on `curated-main` is what runs even though base `main` has no workflows | Pitfall 6 | If not, the PR shows no checks; fallback is to push `main` and rely on CI there |
| A2 | `workflow_run` workflows only fire from the default branch's copy, so Deploy exists only after `main` is pushed | Pattern 7 | Low: Deploy would simply also be absent on the staging branch |
| A3 | A job waiting for a `[self-hosted, hearth]` runner stays queued up to 24 h, then fails `[CITED: docs.github.com/en/actions/reference/runners/self-hosted-runners]` | Summary / approval text | Low; the owner can cancel either way |
| A4 | Claude Code resolves `.claude/CLAUDE.md` only from the working directory/ancestors, so a sibling worktree lacks it | Pitfall 11 | If ancestors are searched and worktrees are nested under the primary checkout, no copy is needed |
| A5 | GitHub repo is empty apart from `7da55e3` and Actions is enabled, default branch `main`, no protection (only `ls-remote` verified: `main` = `7da55e3`) | Runtime State | Branch protection could reject the push; owner must confirm |
| A6 | The 7 time-dependent web test files fail on the CI runner's date/time | Pitfall 7 | If they pass, CI may be green; the plan wording "report, not gate" still holds |

## Open Questions (RESOLVED)

Each question is either answered or routed to the owner gate that closes it before any irreversible step.

1. **Which author email should be published?**
   - Known: all 60 commits use `actanton@ncsu.edu`; remote is the personal account; Initial commit uses `alex.c.tanton@gmail.com`.
   - Unclear: owner's intent.
   - Recommendation: make it an explicit line in the gate-1 approval request, before any push.
   - **Resolution (routed to Gate 1):** plan 01-01 Task 3 (`checkpoint:decision`, `gate="blocking-human"`) makes the owner choose `approve-ncsu` or `approve-personal` before any rewrite runs, and well before any push. Plan 01-02 Task 2 applies the choice and verifies that one email covers the whole range.
2. **Is the fold list acceptable, and should informative fixup bodies be preserved with `squash`?**
   - Known: 8 folds rehearsed conflict-free; 44 commits vs D-01 "~35-40".
   - Recommendation: present the table as the proposed plan. Any additional fold beyond the eight must be rehearsed first (`git rebase -i` conflict check plus the tree-identity diff) because files such as `bills.integration.test.ts` and the spec docs are touched by many commits.
   - **Resolution (routed to Gate 1):**
     - Plan 01-01 Task 3 presents the 8 rehearsed folds and names the count explicitly: 43 product commits plus 1 policy commit.
     - The owner approves that count, or chooses `revise` to name further folds. Any extra fold is then rehearsed by plan 01-02 Task 1's conflict stop and tree-identity proof.
     - Squash versus fixup is answered: all 8 folds use `fixup`. The only fixup body carrying information the parent lacks is `95b0bd2`. Its content survives as one sentence appended to the reworded `1030b35` body (plan 01-01 Task 2 step 2), so no `squash` is needed.
3. **How do Phases 2-6 get `.planning/` and `.claude/CLAUDE.md` inside worktrees?**
   - Known: both are untracked after D-03; worktrees contain only tracked files.
   - Recommendation: the owner/planner picks "run GSD from the primary checkout, copy `.claude/` into worktrees" or revisits D-03.
   - **Resolution (answered):** D-03 is not revisited. `SKELETON.md` "Conventions Later Phases Inherit (local)" fixes the convention:
     - GSD commands run from the primary checkout, where `.planning/` lives.
     - Each worktree is created with `git worktree add ../hearth-{topic} -b {type}/{topic}`, followed by `pnpm install` inside it.
     - `.claude/` is copied into a worktree whenever a Claude session will run there.
     - `.git/info/exclude` is shared by all worktrees, so the copies stay untracked.
4. **GitHub-side settings** (visibility, Actions enabled, branch protection, squash default, Dependabot) are invisible from the repo.
   - Recommendation: one checklist item at gate 2; no repo changes.
   - **Resolution (routed to Gates 2 and 3):**
     - Plan 01-04 Task 1 (Gate 2) has the owner confirm the repository and its visibility, that Actions is enabled, that the default branch is `main`, and that no ruleset or protection rejects new branches.
     - Plan 01-05 Task 1 (Gate 3) has the owner confirm that no `hearth`-labelled runner exists and that no protection rejects the `main` push. That gate also discloses Dependabot activation.
     - The squash-merge default and branch protection stay an owner follow-up (CONTEXT Deferred Ideas). No repo change is made.
5. **What does the owner want done with the queued Deploy run?** (D-06 says cancel manually; confirm they know where.)
   - **Resolution (routed to Gate 3):**
     - Plan 01-05 Task 1 gives the cancel path: Actions, then Deploy, then the run, then Cancel workflow.
     - The gate also states the expected case: CI on `main` is red on `test-unit` (Phase 2 TIME-01 baseline), so the Deploy job is skipped and nothing queues.
     - Cancelling a queued run is listed as an owner follow-up in the 01-05 SUMMARY (plan 01-05 Task 3 step 11).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | everything | yes | 2.56.0.windows.1 | - |
| node | pnpm, hooks, commitlint | yes (mismatch) | v26.10.0 (repo wants 24) | warns only; typecheck passes |
| pnpm | install, typecheck | yes | 10.34.5 | - |
| SSH to `github-personal` | push, `ls-remote` | yes | `git ls-remote origin` returned `7da55e3` | - |
| gh CLI | opening the PR from the terminal | **no** | - | owner opens the PR via the URL GitHub prints on push |
| Docker / Supabase CLI | not needed for Phase 1 (CI runs integration and e2e) | not probed | - | - |
| `node_modules` in primary checkout | hooks, commitlint | **no** | - | `pnpm install` in the curation worktree (about 55 s) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `gh`, and `node_modules` in the primary checkout.

## Validation Architecture

There is no test framework for git operations; validation is a set of deterministic shell proofs run in the curation worktree (and re-run on the primary checkout after the move).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | shell proofs: `git`, `commitlint` 21.2.2, `pnpm typecheck` |
| Config file | `commitlint.config.js`, `.gitattributes`, `.husky/*` |
| Quick run command | `git diff b96ca32 curated-main && pnpm exec commitlint --from 7da55e3 --to curated-main` |
| Full suite command | quick run + per-commit typecheck loop + mode/CRLF scan |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GIT-01 | Range lints clean; no planning commits; tree unchanged | proof | `pnpm exec commitlint --from 7da55e3 --to curated-main; git diff b96ca32 curated-main` (only 2 mode lines) | n/a (commands) |
| GIT-01 | Every commit builds | proof | typecheck loop above (about 20 min) | n/a |
| GIT-02 | `origin/main` equals curated tip via fast-forward | proof | `git fetch origin && test "$(git rev-parse origin/main)" = "$(git rev-parse main)"` and `git merge-base --is-ancestor 7da55e3 origin/main` | n/a |
| GIT-02 | No force-push used | proof | push output shows `7da55e3..<tip>  main -> main` (no `+`/`forced update`) | n/a |
| GIT-03 | Policy file exists, not under `docs/`, prettier-clean, mentions squash, direct-to-main and the deploy caveat | proof | `test -f CONTRIBUTING.md && pnpm exec prettier --check CONTRIBUTING.md && grep -qi squash CONTRIBUTING.md`; `git ls-files docs | grep -iE 'adr|decision|review'` returns nothing | n/a |
| GIT-04 | Scripts `100755`, LF, across the range | proof | mode/CRLF scan above, plus `git ls-files -s .husky` | n/a |
| (D-03) | `.planning/` and `.claude/` absent from every published commit | proof | `git log --name-only 7da55e3..curated-main \| grep -E '^(\.planning\|\.claude)/'` returns nothing; `git show curated-main:.gitignore \| grep -c planning` is 0 | n/a |

### Sampling Rate
- **Per task commit:** the quick run command.
- **Per wave merge:** quick run + mode/CRLF scan.
- **Phase gate:** full suite plus owner approval artifact present before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Message files for the 11 rewords (`../msgs/<sha>.txt`) and the todo file - generated by the plan, outside the repo.
- [ ] `.git/info/exclude` entries for `.planning/` and `.claude/` and `commit_docs=false` in `.planning/config.json`, set **before** any further GSD commit.
- None for test framework: existing tooling covers the proofs.

## Security Domain

`security_enforcement` is enabled (absent/true in `.planning/config.json`, ASVS level 1). This phase handles no application code; relevant controls are about publishing history.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | no | - |
| V4 Access Control | no | branch protection is an owner-side GitHub setting (deferred) |
| V5 Input Validation | no | - |
| V6 Cryptography | no | - |
| V14 Configuration | yes | secret-pattern scan of the whole range before the first publish; no `.env` tracked; SSH key per host alias |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secrets or personal data baked into permanent public history | Information disclosure | Scan before push (done: only dev defaults and the jwt.io sample JWT; no private keys; postal code `27514` appears in 21 fixture paths as public Flipp data); confirm author email (Pitfall 8) |
| Force-push overwriting remote history | Tampering | Fast-forward only; backup ref + bundle; `--dry-run` first |
| Unreviewed code reaching the production deploy path | Elevation of privilege | Staging branch via PR does not match `head_branch == 'main'`; Deploy job gated on `conclusion == 'success'` |
| Hook bypass hiding bad commits | Repudiation | No `--no-verify`/`HUSKY=0`; commitlint re-run explicitly |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `commitlint.config.js:5-16`, `.husky/pre-commit` (`pnpm exec lint-staged` / `pnpm typecheck`), `.husky/commit-msg` (`pnpm exec commitlint --edit "$1"`), `.gitattributes:1` (`* text=auto eol=lf`), `.github/workflows/ci.yml:3-6,12-13,78`, `.github/workflows/deploy.yml:7-10,22-25,35`, `.github/dependabot.yml`, `package.json`, `.planning/config.json`, `docs/file-map.md`.
- Executed in scratch clones outside the repo: commitlint 21.2.2 over the range (per commit), conflict-free 51->43 rebase with tree identity, `reword`/`exec amend` hook behavior, `.husky` mode fix, `pnpm typecheck` at tip (about 33 s), CRLF positive control, Prettier negation patterns, `git ls-remote` for origin and the five action tags.

### Secondary (MEDIUM confidence)
- GitHub Docs, self-hosted runner requirements (queued job times out after 24 h): https://docs.github.com/en/actions/reference/runners/self-hosted-runners
- GitHub changelog, PR marked merged when commits reach the base branch another way: https://github.blog/changelog/2023-09-26-more-details-provided-when-a-pull-request-is-merged-indirectly-or-is-still-processing-updates/
- GitHub Docs, Dependabot version updates run on enable: https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates

### Tertiary (LOW confidence)
- `workflow_run` default-branch requirement: documented for sibling events, only reported for `workflow_run` (github/docs issue 799). Tagged A2.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all tools already in the repo and exercised.
- Architecture / mechanics: HIGH, rehearsed end to end (fold plan, hooks, modes, proofs).
- Pitfalls: HIGH for local ones; MEDIUM for GitHub-side behavior (cannot be tested without pushing).

**Research date:** 2026-10-11
**Valid until:** 2026-11-10 (history facts hold until `main` gets another commit; re-run `git rev-list --count 7da55e3..b96ca32` and the commitlint pass if the product range changes)

## Measured Baseline of the Original Range (scratch clones, read-only)

| Check | Result |
|-------|--------|
| Commits ahead of `7da55e3` | 60 (51 product `e86c43c..b96ca32`, 7 planning, 2 added during discuss-phase `d2d654f`, `4bec3ce`); no merges, no tags, no stashes, single author identity |
| Planning commits contiguous at the tip | yes; `git diff --name-only b96ca32 HEAD` = `.claude/CLAUDE.md`, `.gitignore`, 19 `.planning/*` files |
| commitlint 21.2.2 on original range | 13 product commits fail `body-max-line-length`; `d2d654f` and `4bec3ce` fail `scope-enum` (`docs(01)`, `docs(state)`); every subject is within 71 and every type/scope is in the closed lists |
| commitlint after the 8-fold rehearsal (43 commits) | exactly 11 fail, all `body-max-line-length`: `3ae2afd 46d170e 279b398 8d2b6de c4198c9 bafa74f 0ae57b4 b1cd32c 8a7e756 801f9fd 1030b35` (rehearsed SHAs differ: `83ccc87 a44c4fd 9c3109a 4507b8e 8ecb35b 33ac849 b223e03` for the later ones) |
| `pnpm typecheck` on each original product commit `3ae2afd..b96ca32` | 50 of 50 PASS (20-104 s each under contention, about 25 s idle; `e86c43c` has no `package.json`). The rewrite does not need to repair any commit, only to avoid creating a new broken intermediate tree |
| `pnpm install --frozen-lockfile` per commit | passed at all 50, even though `3d771d7`, `67b2d3b`, `8f78827`, `4365c07`, `8a7e756`, `801f9fd` edit a `package.json` without touching `pnpm-lock.yaml` |
| Modes at every commit | all 5 shebang scripts are `100755` from the commit that adds them (`3ae2afd`, `279b398`, `8d7730f`); `.husky/*` are `100644` and never modified after `3ae2afd` |
| CRLF at every commit | none in `*.sh`, hooks, `bin/*`, entrypoints; tip `git ls-files --eol`: 676 `i/lf`, 2 PNG `-text`, 1 empty `.gitkeep` |
| Largest blobs | `e2e/fixtures/flipp/raw/data-27514.json` (1.2 MB), `search-27514-cvs.json` (0.4 MB), lockfile versions (about 0.38 MB each); pack is 2.3 MiB, no history-size concern |
| Remote | `git ls-remote origin` -> `main` = `7da55e3` over SSH (`Host github-personal`, `Key-GH-Personal`) |
