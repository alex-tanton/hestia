# Phase 5: Redundancy Reduction and Text Sync - Discussion Log

> Audit trail only. Not consumed by downstream agents.

**Date:** 2026-10-21
**Areas discussed:** Fixture consolidation scope, Spec-citation removal rules, CI composite action shape, Docs and codebase-map sync method

| Area | Question | Options | Selected |
|------|----------|---------|----------|
| Owner note | Planning files and PRs | (free text) | `.planning/` files SHOULD be pushed and included in PRs (reverses Phase 3 D-13) |
| Fixtures | Baseline to beat | Test-inclusive 96 / Both / Source-only 11 | Test-inclusive 96 (recommended) |
| Fixtures | Shared setup location | `apps/service/src/test/` / new fixtures folder / you decide | `apps/service/src/test/` |
| Fixtures | Depth | Cross-file only / plus within-file / top N | Cross-file only |
| Citations | What is stale | Pattern match with docs rewrites / Remove all, no rewrites / exactly 262 | Remove all, no rewrites (not the recommended option) |
| Citations | Comment-only proof | AST compare / emit diff / diff review | AST compare |
| Citations | CLAUDE.md and non-TS files | Update CLAUDE.md and cover all / code and tests only / leave CLAUDE.md | Update CLAUDE.md, cover all code files |
| CI | Composite action shape | `.github/actions/setup` with checkout / without checkout / with supabase input | "Four steps incl. checkout"; infeasible, implemented as without checkout |
| CI | Seed typecheck | Drop from service script / drop seed script | Drop from `apps/service` typecheck |
| CI | Equivalence proof | PR CI plus step diff / PR CI only / actionlint | PR CI plus before/after step diff |
| Docs | Codebase map sync | Targeted edit / re-run map-codebase / only known claims | Re-run `/gsd-map-codebase` (not the recommended option) |
| Docs | `docs/` sync | Claim-by-claim audit / only touched / audit and report conflicts | Claim-by-claim audit |
| Docs | Spot-check rigor | Scripted plus sample / sample only / full read | Scripted checks plus sampled list |

## Claude's Discretion
PR split and order, ledger layout, helper names, non-TS comment-only proof, CLAUDE.md map refresh.

## Deferred Ideas
Source-only clone refactors (11 clones); Phase 6 enforcement work.
