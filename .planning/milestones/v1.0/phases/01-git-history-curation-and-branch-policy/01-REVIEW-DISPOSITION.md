---
phase: 01-git-history-curation-and-branch-policy
review: 01-REVIEW.md
recorded: 2026-10-12
open: 10 of 10
---

# Phase 01 Code Review Disposition

Advisory ledger. Every finding is `open` until the owner triages it. Nothing here blocks the phase.

| ID | Finding | Disposition | Note |
|----|---------|-------------|------|
| WR-01 | ci.yml pre-pull image discovery swallows failures with `|| true` and never checks the list is non-empty; parsing is brittle (quoted images, trailing comments, lowercase FROM, `FROM ${ARG}`) | open | Extraction yields the correct 7 images today. Candidate for Phase 6 CI hardening |
| WR-02 | CONTRIBUTING.md contradicts itself: dependency bumps go to main, but Docker and Actions bumps touch docker/ and .github/ which need a PR; Dependabot not mentioned | open | Policy text is part of the published tip; fix in a later docs commit (Phase 6) |
| WR-03 | "Every squash message must pass commitlint" has no enforcement path (hook is local, web squash and CI skip it); not listed under "Not yet enforced" | open | Phase 6 |
| WR-04 | Retry budget can sleep about 52 min worst case (7 images x 450 s) against a 40 min job timeout; permanent errors are retried; attempt count repeated three times | open | Worst case only; the measured run needed no retries |
| IN-01 | New step "has never run in CI"; BuildKit reuse of the pre-pulled docker/dockerfile:1 is unverified | open | Premise is stale: the step ran in CI run 38206071791 (test-e2e passed, 102 of 102). BuildKit frontend reuse is still unverified |
| IN-02 | d3da748 changes .github/ and sits directly on main, which the policy one commit earlier says needs a PR | open | Inherent to the first publish (D-05 fast-forward) |
| IN-03 | "Checks before pushing" omits `pnpm build` and `pnpm test:integration` | open | |
| IN-04 | Branch cleanup guidance incomplete (`git branch -d` refuses after squash merge, worktree removal, `{type}` undefined) | open | |
| IN-05 | Commit rules omit lowercase subject and no trailing full stop; `ci` is a type, not a scope, is unclear | open | |
| IN-06 | The "Engineering Practices" spec cited by commitlint.config.js and workflow comments does not exist in docs/ | open | CONTRIBUTING.md is now the only prose home of the commit and branch rules |
