---
phase: 03-evidence-gated-removal
plan: 01
subsystem: dead-code-removal
tags: [knip, ledger, dependencies, tracer]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "knip configuration, triage records and owner candidates"
provides:
  - "Removal ledger `.planning/cleanup/REMOVAL-LEDGER.md` with base totals, null results and the four owner decisions"
  - "Branch build/unused-deps (PR 1, not open): the knip report normalizer and the seed package tsx removal"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09]

requirements-completed: []

completed: 2026-10-19
status: complete
---

# Phase 3 Plan 01: Ledger, normalizer and the tsx tracer Summary

**The evidence chain works end to end on the thinnest real removal. PR 1's branch holds two commits, the ledger holds the base numbers and the owner has answered the four decisions.**

## Base

- Base SHA: `7d14b7775fa653e11ac85020564340ac5ba176cf` (`origin/main`).
- Base knip totals: default 54, production 79, nonode (throwaway config, node plugin off) 57.

## Branch `build/unused-deps` (worktree `/home/user/hearth-deps`, not open as a PR)

- `8c8209129a719dcbb24244d7d9d125756e759bd9` `chore: add the knip report normalizer`. Mode 100755, sha256 `74b6e969750cbc6115bae9c2c810a7cb709469aba2858013016a3ea90cd8cb12`, byte-identical reproduction of all six Phase 2 summaries.
- `e7a7dbcabf9523518795f92edec7ac49df87d3ca` `build: drop unused tsx from the seed package`. Four deleted lines across `supabase/seed/package.json` and `pnpm-lock.yaml`; default summary 54 to 53 with exactly the `tsx` line removed.

## Owner decisions (2026-10-19)

- A1=remove, A2=remove, A8=remove, OQ1=accept. Recorded in the ledger under `## Gates and decisions` (commit `5c92e7a`).

## Open item for the owner

Committing `scripts/knip-summary.mjs` makes `knip:production` report it as an unused file (production total 80 on the branch, not 79). `knip.json` stays unchanged in Phase 3 (D-08), so the line is listed on the owner list and later plans compare against "base plus that one line". The owner can instead add a `scripts/knip-summary.mjs!` entry to `knip.json`, or drop the normalizer commit, at the plan 03-02 gate. Nothing has reached `main`.

## Deviations from Plan

None beyond the finding above, which the plan itself anticipated for production mode.

## Self-Check

- FOUND: origin `build/unused-deps` at `e7a7dbc`, five changed files, no PR open, `origin/main` still `7d14b77`.
- FOUND: ledger lines `A1=remove`, `A2=remove`, `A8=remove`, `OQ1=accept`.
