---
phase: 03-evidence-gated-removal
plan: 02
subsystem: pull-request-landing
tags: [pull-requests, ci, db-types, db-seed]

requires:
  - phase: 03-evidence-gated-removal
    provides: "03-01: branch build/unused-deps (normalizer, seed tsx removal) and the ledger"
provides:
  - "PR 1 (#12) open and green, awaiting the owner's squash merge"
  - "db:types determinism and db:seed evidence, from a local Docker run"
affects: [03-03, 03-07, 03-09]

requirements-completed: []

completed: 2026-10-19
status: complete
---

# Phase 3 Plan 02: Land PR 1 and collect the db evidence Summary

**PR 1 is open and all six CI jobs passed on its head. The `db:types` and `db:seed` questions are answered by a local Docker run, because the throwaway CI branch could not be pushed.**

## Gate

- `gate-pr1=approve-both (owner, 2026-10-19)`, `knip-summary=keep-reported (owner, 2026-10-19)`.
- Local gates on Node 24.21.0 (install, lint, format:check, typecheck, test, build) and commitlint over both commits: all exit 0.

## PR 1

- #12, `build/unused-deps` into `main`, head `e7a7dbcabf9523518795f92edec7ac49df87d3ca`, mergeable state clean, not merged. Proposed squash title: `build: drop unused seed tsx and add the knip summary script`.
- CI run 39325433012: `lint`, `typecheck`, `test-unit`, `test-integration`, `test-e2e`, `build` all `success`, no re-run. `test-e2e` builds the service and Caddy images, which is the Docker-build evidence for the `tsx` removal.

## db:types and db:seed

- The throwaway branch `ci/db-types-evidence` (`8401de9`) could not be pushed: the session credential lacks the `workflow` scope, and the owner could not push it. The owner asked for the run to happen here instead, so it ran against a local Supabase stack on the PR 1 tip. It is local evidence, not CI evidence.
- `dbtypes-run1-vs-run2=same`, `dbtypes-run2-vs-committed=same`, `dbtypes-diffstat=empty`: codegen is deterministic and the committed `types.ts` matches the migrations.
- `dbseed=exit0`; `dbseed-status=proven locally`. `pnpm db:seed` works with the seed package's `tsx` removed.

## Deviations from Plan

1. Throwaway CI run replaced by a local Docker run (owner override). No draft PR was opened and no workflow file was published.
2. The knip normalizer shows as a `files` line in `knip:production` (80 versus 79); kept and listed per the owner's choice (b).

## Self-Check

- FOUND: PR #12 open, unmerged, head `e7a7dbc`; six jobs `success`.
- FOUND: ledger lines `pr1=12`, `pr1-ci=`, `dbtypes-*`, `dbseed=exit0`, `dbseed-status=`.
- No merge, no push to `main`, no force-push.
