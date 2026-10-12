# Phase 1: Git History Curation and Branch Policy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-10-11
**Phase:** 1-Git History Curation and Branch Policy
**Areas discussed:** Curation shape, .planning/ in history, First-push deploy, Branch/PR policy doc

---

## Curation shape

| Option | Description | Selected |
|--------|-------------|----------|
| Reword + fold fixups | One commit per feature/test unit; fold fix-of-previous; reword failing subjects | ✓ |
| Squash to milestones | ~10-15 commits by area | |
| Messages only | Reword only, no squash/reorder | |
| You decide | Claude proposes todo | |

**User's choice:** Reword + fold fixups

| Option | Description | Selected |
|--------|-------------|----------|
| Tree identical + commitlint | Identical final tree, commitlint over range, backup of old main | |
| Plus every commit builds | Additionally typecheck each rewritten commit | ✓ |
| Tree identical only | Skip per-commit checks | |

**User's choice:** Plus every commit builds

---

## .planning/ in history

| Option | Description | Selected |
|--------|-------------|----------|
| Publish as one docs commit | Fold 7 into one commit | |
| Keep local, gitignore | Never push .planning/ | ✓ |
| Push on a separate branch | Long-lived planning branch | |
| Keep all 7 commits | Unmodified | |

**User's choice:** Keep local, gitignore

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude both via .git/info/exclude | Strip .planning/ and .claude/CLAUDE.md, commit_docs=false | ✓ |
| Exclude .planning/, publish .claude/CLAUDE.md | | |
| Repo .gitignore entry | | |

**User's choice:** Exclude both via .git/info/exclude

---

## First-push deploy

| Option | Description | Selected |
|--------|-------------|----------|
| Push branch first, then fast-forward main | | |
| Push main directly | | |
| Stop the runner during push | | |
| Make tip docs-only | | |

**User's choice:** Free text - "I haven't actually deployed the application anywhere yet. It is still in the development phase. I am fine with code making its way to origin/main, but deploy probably won't work."
**Notes:** Led to a follow-up on deploy noise.

| Option | Description | Selected |
|--------|-------------|----------|
| Accept it, note it in plan | Leave deploy.yml untouched; queued run expected | ✓ |
| Disable Deploy workflow in GitHub UI | | |
| Guard deploy.yml in this phase | | |

**User's choice:** Accept it, note it in plan
**Notes:** Branch-first staging (D-05) was retained as Claude's recommendation because CI can be proven before main moves; the owner did not object.

---

## Branch/PR policy doc

| Option | Description | Selected |
|--------|-------------|----------|
| CONTRIBUTING.md at repo root | | ✓ |
| Section in README.md | | |
| docs/ as-built reference | | |

**User's choice:** CONTRIBUTING.md at repo root

| Option | Description | Selected |
|--------|-------------|----------|
| Path/size-based rule, text only | | ✓ |
| Policy + branch protection checklist | | |
| Judgment-based | | |

**User's choice:** Path/size-based rule, text only

---

## Claude's Discretion

- Exact rebase todo and reworded subjects; rewrite mechanics; `.husky` hook mode fix (100644 to 100755).

## Deferred Ideas

- Guard or disable the deploy workflow until a runner exists (Phase 6).
- GitHub branch protection settings (owner follow-up).
