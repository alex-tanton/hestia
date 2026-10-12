# Phase 1: Git History Curation and Branch Policy - Pattern Map

**Mapped:** 2026-10-11
**Files analyzed:** 6 (1 new repo file, 1 modified doc, 2 mode-only changes, 2 local-only config/exclude entries)
**Analogs found:** 4 / 6 (the other 2 are per-clone config with no repo analog)

All analog paths below were confirmed git-tracked (`git ls-files`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `CONTRIBUTING.md` (new, root) | docs / policy | static reference | `README.md` (root prose + tables, prettier-formatted) | role-match |
| `docs/file-map.md` (add one row) | docs | static reference | its own section 1 "Repository layout" table | exact |
| `.husky/pre-commit` (mode 100644 -> 100755) | hook script | event-driven (git hook) | `scripts/deploy.sh`, `docker/kong-entrypoint.sh` (100755 scripts) | mode-match |
| `.husky/commit-msg` (mode 100644 -> 100755) | hook script | event-driven (git hook) | same as above | mode-match |
| `.git/info/exclude` (local, untracked) | config | n/a | existing content (`BUILD_PROMPT.md`) | none needed |
| `.planning/config.json` (`commit_docs=false`, local) | config | n/a | itself | none needed |

No source code, test, or CI file is created or modified. `commitlint.config.js`, `.gitattributes`, `ci.yml`, and `deploy.yml` are read-only inputs (D-06, Phase 6).

## Pattern Assignments

### `CONTRIBUTING.md` (docs, static reference)

**Analog:** `README.md` (root) for tone and table formatting; `docs/file-map.md` for the "what / why" table style.

**Header and prose pattern** (`README.md` lines 1-5): H1 title, one short paragraph, relative links to `docs/` in backticks.
```markdown
# Hearth

A self-hosted household-admin PWA: ... The specifications in
[`docs/`](docs/) are the source of truth for behaviour, architecture, and design.
```

**Table pattern** (`README.md` lines 14-26): Prettier-aligned pipe tables with backticked paths. Run `pnpm exec prettier --check CONTRIBUTING.md` (lint-staged applies `prettier --write` to `*.md` on commit via `.lintstagedrc.json`; `printWidth` 100, `singleQuote`).
```markdown
| Path                  | Contents                                          |
| --------------------- | ------------------------------------------------- |
| `apps/web`            | React PWA (Vite, Tailwind, Workbox)               |
```

**Facts to cite verbatim, link do not copy** (from `commitlint.config.js` lines 5-16):
```js
['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'perf', 'build', 'ci']        // type-enum
['web', 'service', 'shared', 'recurrence', 'matching', 'db', 'e2e', 'docker']      // scope-enum
'subject-max-length': [2, 'always', 71]
```
Body lines cap at 100 (config-conventional `body-max-line-length`, the rule 13 original commits broke).

**Deploy-caveat facts** (`.github/workflows/deploy.yml` lines 7-10, 22-25): Deploy fires only on `workflow_run` of `CI` for `head_branch == 'main'`, `event == 'push'`, conclusion `success`; it skips when the tip commit touches only `docs/` (line 35). So root `README.md`/`CONTRIBUTING.md` edits are not "docs/" and redeploy.

**Section order** (from RESEARCH skeleton): How changes land (2-row table: direct vs PR/squash), Deploys, Commit and squash messages, Branches and worktrees, Scripts (`git add --chmod=+x`, `git ls-files -s` shows 100755, LF via `.gitattributes`), Not yet enforced (branch protection is an owner follow-up).

**Constraints:** root file, not under `docs/`; no ADR/decision-log/review wording (project memory and CLAUDE.md constraint); text only; commit as `docs: add contributing guide with branch and pr policy` (type `docs`, no scope, passes `scope-enum`).

---

### `docs/file-map.md` (docs, add one row)

**Analog:** its own section 1 table (lines 8-27). Add one row next to the `README.md` row so RED-05 does not later flag drift:
```markdown
| `README.md` | The entry point: prerequisites, local development, deployment, and backup/restore steps. |
| `CONTRIBUTING.md` | How changes land: which go straight to `main`, which need a pull request, and commit rules. |
```
Style: two-column `| Path | Purpose |`, purpose is one plain-language sentence ending in a period. Do not add a section 10 row (that table is for tools). Include in the same commit as `CONTRIBUTING.md`.

---

### `.husky/pre-commit` and `.husky/commit-msg` (hook scripts, mode change only)

**Analog:** `scripts/deploy.sh`, `scripts/generate-secrets.sh`, `docker/caddy-entrypoint.sh`, `docker/kong-entrypoint.sh` are tracked `100755`; `.husky/*` are `100644` (contents unchanged: `pnpm exec lint-staged` / `pnpm typecheck`; `pnpm exec commitlint --edit "$1"`).

**Mode pattern** (no content change; works with `core.filemode=false` on this host):
```bash
git update-index --chmod=+x .husky/pre-commit .husky/commit-msg
git ls-files -s .husky        # expect 100755 on both lines, blob hashes unchanged
```
Apply inside the rewritten `3ae2afd` commit (the commit that introduces them) via the todo line:
```
exec git update-index --chmod=+x .husky/pre-commit .husky/commit-msg && git commit --amend -F ../msgs/3ae2afd.txt
```
Husky runs hooks through `.husky/_/h` (`sh -e`), so the bit is cosmetic for execution but satisfies GIT-04 "every script".

---

## Shared Patterns

### Commit message gate
**Source:** `.husky/commit-msg` + `commitlint.config.js`
**Apply to:** every reworded commit and the new docs commit. `reword`/`exec git commit --amend` run hooks (typecheck then commitlint); `pick`/`fixup` do not, so the explicit `pnpm exec commitlint --from 7da55e3 --to curated-main` proof is still required. Never `--no-verify` or `HUSKY=0`; assert `test -f .husky/_/h` in the worktree first.

### Executable bit and LF proof
**Source:** `.gitattributes` (`* text=auto eol=lf`, `*.png`/`*.ico`/`*.gz` binary) and `git ls-files --eol`
**Apply to:** all scripts across the range (scan loop in 01-RESEARCH.md "Mode and CRLF scan").
```bash
git ls-files -s | grep -E '\.sh$|hearth-admin|\.husky/'   # all lines start 100755
git ls-files --eol | grep -v 'i/lf'                        # only 2 PNGs and an empty .gitkeep
```

### Shell script conventions (only if a helper script is added; none is planned)
**Source:** `scripts/deploy.sh` lines 1-14, 26-30: `#!/usr/bin/env bash`, header comment with usage and env vars, `set -euo pipefail`, small `log()`/`fail()` helpers. Helper scripts for this phase (todo, msgs, proof loops) live outside the repo per RESEARCH, so no new tracked script is expected.

### Local-only planning files
**Source:** RESEARCH Pattern 6 and D-03. Add `.planning/` and `.claude/` to `.git/info/exclude` (not `.gitignore`, not `.prettierignore`); local format check uses `pnpm exec prettier --check . '!.planning/**' '!.claude/**'`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.git/info/exclude` entries | per-clone config | n/a | Untracked by design (D-03); existing file holds only `BUILD_PROMPT.md` |
| `.planning/config.json` `commit_docs=false` | local GSD config | n/a | Untracked after the move; a one-key edit |
| Branch/PR policy approval artifact | planning doc | n/a | Lives under `.planning/phases/01-.../`, never `docs/`; no repo analog |

## Metadata

**Analog search scope:** root files, `docs/`, `scripts/`, `docker/`, `.husky/`, `.github/workflows/`, `commitlint.config.js`, `.lintstagedrc.json`, `.gitattributes`
**Files scanned:** ~12
**Pattern extraction date:** 2026-10-11
