---
phase: 01-git-history-curation-and-branch-policy
verified: 2026-10-12T14:00:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".github/workflows/ci.yml"
  - ".husky/commit-msg"
  - ".husky/pre-commit"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-01-PLAN.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-01-SUMMARY.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-02-PLAN.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-02-SUMMARY.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-03-PLAN.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-03-SUMMARY.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-04-PLAN.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-04-SUMMARY.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-05-PLAN.md"
  - ".planning/phases/01-git-history-curation-and-branch-policy/01-05-SUMMARY.md"
  - "CONTRIBUTING.md"
  - "commitlint.config.js"
  - "docs/file-map.md"
covered_digest: "v3:sha256:736a6d7d28665e6367c705847578f3ac38e19f14e5f8a6adb572b94c4d2452a5"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Git History Curation and Branch Policy Verification Report

**Phase Goal:** The owner has a clean, approved history published to `origin` and a written workflow for how cleanup work lands afterward
**Verified:** 2026-10-12
**Status:** passed
**Re-verification:** No, initial verification

All evidence below was gathered directly from git objects, `git ls-remote`, and the authenticated `gh` CLI, not from the SUMMARY files.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1: Local commits curated on top of `7da55e3`; commitlint over the whole range exits clean | VERIFIED | `git rev-list --count 7da55e3..main` = 45, no merge commits, first commit `07db639` has parent `7da55e3`. `npx commitlint --from 7da55e3 --to main` exit 0. Negative control: the same command against `backup/pre-curation` (original history) exits 1, so the check is live. Every commit has the same author and committer, `Alex Tanton <alex.c.tanton@gmail.com>`. |
| 2 | SC2: Owner approved the plan (including what the first push triggers) before any push; `origin/main` equals curated history, reached as a fast-forward, no force-push | VERIFIED | `git ls-remote origin`: `main`, `HEAD` and `refs/pull/1/head` all `d3da748223fb85432fc06defaa25ac00ac4ed258`; local `main` and `origin/main` identical; `merge-base --is-ancestor 7da55e3 main` true. GitHub activity API: `push refs/heads/main 7da55e3 -> d3da748` with `activity_type: push` (not `force_push`); no other event on `main` after its 2026-09-18 creation. Reflog for `origin/main` has a single `update by push`. PR #1 is MERGED at `d3da748` (45 commits, base `main`). The proposal documents what each push triggers (`## What each push does`) and records Gate 1, Gate 2, Gate 3 owner replies in `## Owner approvals`; the activity timeline (branch created 2026-10-11 21:35Z after Gates 1 and 2, main push 2026-10-12 13:12Z after the re-confirmed Gate 3) is consistent with that ledger. |
| 3 | SC3: Written branch/PR policy in the repo, not an ADR/decision-log under `docs/` | VERIFIED | `CONTRIBUTING.md` at repo root (61 lines, tracked, in `main`); `docs/file-map.md` lists it (line 23). Policy table: docs, comment, formatting, lockfile/dependency bumps, mechanical renames go straight to `main`; behavior, tests, CI, migrations, Docker go through a PR from a branch or worktree, squash-merged. `git diff --name-status 7da55e3 main -- docs` adds only `architecture, branding, deploy, design, file-map, testing, use-cases`; no ADR, review, or decision-log file under `docs/`. Claims cross-checked against the repo (see Policy Claim Check). |
| 4 | SC4: Every script committed `100755` with LF, checkable with `git ls-files -s` and a CRLF scan | VERIFIED | At every one of the 45 commits (loop over `git ls-tree -r`): zero `*.sh`, `.husky/pre-commit`, `.husky/commit-msg`, `*entrypoint*` or `hearth-admin` entries with a mode other than `100755`. Shebang scan over all 45 commits finds exactly 5 files (`apps/service/bin/hearth-admin`, `docker/caddy-entrypoint.sh`, `docker/kong-entrypoint.sh`, `scripts/deploy.sh`, `scripts/generate-secrets.sh`), all `100755`. `git grep -lI $'\r'` over `*.sh`, `.husky/*`, the bin and the entrypoints at every commit: no hit. At the tip `git ls-files --eol` shows `i/lf w/lf` for all 7 files; `.gitattributes` has `* text=auto eol=lf`. |
| 5 | Content integrity: curated product tip differs from the original `b96ca32` only by the two `.husky` mode changes | VERIFIED | `git diff --summary b96ca32 9dd6668`: only `mode change 100644 => 100755` for `.husky/commit-msg` and `.husky/pre-commit`; 0 insertions, 0 deletions. `b96ca32` still reachable from `backup/pre-curation`. The two commits above `9dd6668` add only `CONTRIBUTING.md`, `docs/file-map.md` (`83eae2c`) and `.github/workflows/ci.yml` (`d3da748`). |
| 6 | D-03 and D-02: planning/agent files absent from every commit on `main` and present locally; safety net kept | VERIFIED | `git log main --name-only` contains no path under `.planning/`, `.claude/`, or `BUILD_PROMPT.md`; the tip tree top level has none of them; `git ls-files .planning .claude` is empty. Both directories exist on disk and are excluded by `.git/info/exclude` (`check-ignore -v` confirms); `.planning/config.json` has `commit_docs: false`. `backup/pre-curation` = `38f3a88`; `hearth-aside/pre-curation.bundle` passes `git bundle verify` ("records a complete history"). Working tree clean. |

**Score:** 6/6 truths verified (4 roadmap success criteria plus 2 derived from plan must-haves and context decisions)

### Policy Claim Check (CONTRIBUTING.md vs the repo)

| Claim | Source checked | Result |
| --- | --- | --- |
| Deploy is skipped only when the tip commit touches only `docs/`; root `README.md` and `CONTRIBUTING.md` deploy; only the tip commit is examined | `.github/workflows/deploy.yml` (`git diff --name-only HEAD~1 HEAD \| grep -qv '^docs/'`) | Holds |
| Deploy runs on self-hosted runner labelled `hearth` | `deploy.yml` `runs-on: [self-hosted, hearth]` | Holds |
| Types and scopes come from `commitlint.config.js`; subject at most 71, body lines at most 100 | `commitlint.config.js` (`subject-max-length 71`, closed type/scope enums), config-conventional body limit; commitlint over the range passes | Holds |
| Hooks installed by `pnpm install` per worktree | `package.json` `"prepare": "husky"`; `.husky/pre-commit` runs lint-staged and typecheck, `.husky/commit-msg` runs commitlint | Holds |
| Checks before pushing: `pnpm lint`, `format:check`, `typecheck`, `test` | root `package.json` scripts | All exist |
| `git add --chmod=+x` / `git ls-files -s` shows `100755`; `git ls-files --eol` shows `i/lf` | Reproduced above | Holds |
| "Not yet enforced": branch protection, required checks, squash-only merge | `gh api .../branches/main/protection` returns 404 (not protected); `gh api .../rulesets` returns `[]`; repo still allows merge, rebase and squash | Holds |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| GIT-01 | 01-01, 01-02, 01-03, 01-05 | Commits curated onto origin's initial commit, messages pass commitlint | SATISFIED | Truth 1 |
| GIT-02 | 01-01, 01-04, 01-05 | Owner approves rewrite plan before first push; history reaches `origin/main` as a fast-forward | SATISFIED | Truth 2 |
| GIT-03 | 01-02, 01-05 | Branch and PR policy written down | SATISFIED | Truth 3 |
| GIT-04 | 01-01, 01-02, 01-03, 01-05 | Scripts keep executable bit and LF in committed history | SATISFIED | Truth 4 |

All four IDs appear in plan frontmatter and are marked Complete in `REQUIREMENTS.md`. REQUIREMENTS.md maps no other ID to Phase 1, so there are no orphaned requirements.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `CONTRIBUTING.md` | Branch/PR policy at repo root | VERIFIED | Substantive (61 lines, policy table, deploy caveat, squash rules, worktree and script instructions), tracked on `main`, linked from `docs/file-map.md` |
| `docs/file-map.md` | Row for `CONTRIBUTING.md` | VERIFIED | Row present at line 23 |
| `.husky/pre-commit`, `.husky/commit-msg` | `100755` | VERIFIED | `100755` in the index at tip and at every commit where present |
| `backup/pre-curation`, `pre-curation.bundle` | Safety net (D-02) | VERIFIED | Branch at `38f3a88`; bundle verifies |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `origin/main` | `7da55e3` | ancestry | WIRED | `7da55e3` is an ancestor and the sole parent of the first curated commit |
| `docs/file-map.md` | `CONTRIBUTING.md` | table row | WIRED | Present |
| `CONTRIBUTING.md` | `deploy.yml`, `commitlint.config.js` | cited paths | WIRED | Both exist and match the described behavior |
| `.husky/commit-msg` | commitlint | `pnpm exec commitlint --edit` | WIRED | Same config that the range check used |

### Anti-Patterns Found

None applicable. The phase product is a rewritten git history plus one documentation file; no stub, debt-marker, or placeholder scan applies to a history rewrite. `CONTRIBUTING.md` contains no TBD, FIXME or XXX markers.

### Human Verification Required

None. The only human decision in the phase (owner approval at three gates) is recorded in the local ledger and corroborated by the independently observed push, PR and ruleset timeline. It is not something a further manual check would add to.

### Notes (accepted or advisory, not gaps)

1. **CI on `main` is red** (run 38254024046, `push` to `main`): only `test-unit` fails, on the timezone-dependent `apps/web/src/screens/deals/favorites.test.tsx` (expected `4:00 AM`, rendered `8:00 AM` on a UTC runner). The owner accepted this exception for the push (Gate 3, `push-main-accept-red`). Content is byte-identical to `b96ca32`. Owned by Phase 2 TIME-01. lint, typecheck, test-integration, test-e2e (102 of 102, Linux) and build are green. The `Deploy` run (38255363334) was skipped because CI was not successful, so nothing deployed.
2. **Ruleset removed:** `Main PR Enforcement` (id 23693495) was changed by the owner so the fast-forward could land; `gh api repos/alex-tanton/hearth/rulesets` now returns `[]` and `main` has no branch protection. CONTRIBUTING.md accurately says enforcement is not configured. Re-enabling it is an owner follow-up and, if restored, the red `test-unit` becomes a required-check blocker for later PRs until Phase 2 lands.
3. **Tip changed after Gate 2:** the published tip is `d3da748` (45 commits), not the Gate 2 SHA `83eae2c` (44). The extra commit touches only `.github/workflows/ci.yml` (ci pre-pull of registry images); the proposal records the change, the owner's approval, and re-proof of commitlint, modes, EOL and ancestry on `d3da748`. I re-ran those checks on the final range and they hold.
4. **Code review (`01-REVIEW.md`, `01-REVIEW-DISPOSITION.md`):** 0 critical, 4 warnings, 6 info, all open and advisory. Of note for the policy goal: WR-02 (the table is ambiguous for Docker-image and GitHub-Action version bumps, which are both "dependency bumps" and "changes under `docker/` or `.github/`") and WR-03 (squash-message commitlint has no enforcement path and is not listed under "Not yet enforced"). Neither makes GIT-03 false; the policy exists and every checkable fact in it holds. Suggested for a later docs commit (dispositions already point to Phase 6).
5. **Housekeeping, not required by the phase:** local branch `curated-main` and its worktree `C:/Users/actanton/Development/hearth-curate` still exist (the remote branch was auto-deleted on PR merge; its upstream shows `gone`). `backup/pre-curation` and the bundle are intentionally retained (D-02). The ROADMAP.md Phase 1 checkbox and progress row still read "In Progress"; the orchestrator should mark the phase complete. Author commits carry `Co-Authored-By: Claude ...` trailers (45 of 45), consistent with the repo's earlier convention.

### Gaps Summary

No gaps. The phase goal is achieved: `origin/main` carries a commitlint-clean, 45-commit linear history on `7da55e3`, reached by a plain fast-forward after recorded owner approval; planning and agent files never entered it; scripts are `100755` and LF at every commit; and a root `CONTRIBUTING.md` states the branch and PR policy with claims that match the repo.

---

_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
