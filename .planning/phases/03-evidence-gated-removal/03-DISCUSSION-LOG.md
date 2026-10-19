# Phase 3: Evidence-Gated Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 3-Evidence-Gated Removal
**Areas discussed:** tsx in seed, Stale evidence and knip.json, knip helper, Removal mechanics, Proof log, Landing, DEAD-05 leftovers, db:types evidence, DEAD-04 stale-reference boundary

---

## tsx in supabase/seed

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it (Recommended) | Unused, knip flags it, roadmap names it; lockfile in same commit | ✓ |
| Keep it (D-18 stands) | Record as owner-kept and add a knip ignoreDependencies entry | |
| Remove only if db:seed still works | Gate on a passing local db:seed run | |

**User's choice:** Remove it
**Notes:** Overrides the "keep pending objection" note in Phase 2 D-18; roadmap and DEAD-03 name it.

---

## Stale evidence and knip.json (meal-fixtures rows)

| Option | Description | Selected |
|--------|-------------|----------|
| Re-prove with trace and text search, leave knip.json (Recommended) | Three-part proof for the three rows; decide knip.json separately | ✓ |
| Fix knip.json first, then re-triage | Stop the side effect, regenerate reports, rebuild list | |
| Treat the recorded triage as the authority | Delete from the recorded list with a grep proof | |

**User's choice:** Re-prove with trace and text search, leave knip.json

---

## knip-summary.mjs helper

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild as a scratch script, do not commit | Under `.planning/cleanup/` only | |
| Commit as `scripts/knip-summary.mjs` | Reusable by Phase 6; subject to lint and format | ✓ |
| Skip it and use raw knip JSON plus jq | No helper | |

**User's choice:** Commit as `scripts/knip-summary.mjs`

---

## Removal mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Delete the symbol if unused in its own file too (Recommended) | Drop only `export` when still used in-file; delete otherwise | ✓ |
| Always just drop the export keyword | Smaller diffs, leaves unused code | |
| Always delete the whole symbol | Leanest, larger diffs | |

**User's choice:** Delete the symbol if unused in its own file too

---

## Proof log

| Option | Description | Selected |
|--------|-------------|----------|
| A removal ledger in .planning/cleanup/ plus commit bodies (Recommended) | One row per item with three proof results | ✓ |
| Commit bodies only | No ledger | |
| Update TRIAGE.md in place | Add a 'removed' column | |

**User's choice:** Removal ledger plus commit bodies

---

## Landing

| Option | Description | Selected |
|--------|-------------|----------|
| One PR per category, stacked in order (Recommended) | Dependencies, then files/exports/types, then stale refs and leftovers | ✓ |
| A single Phase 3 PR | One review and one CI run | |
| Docs-only stale-reference edits straight to main, the rest by PR | Uses CONTRIBUTING's exception | |

**User's choice:** One PR per category, stacked in order

---

## DEAD-05 leftover and generated files

| Option | Description | Selected |
|--------|-------------|----------|
| Ignored-file check plus an audit of tracked files by pattern (Recommended) | Anything unprovable goes to the owner list | ✓ |
| Only the ignored-file check | Record the empty result | |
| Also tighten .gitignore | Add rules for patterns found | |

**User's choice:** Ignored-file check plus an audit of tracked files by pattern

---

## db:types regeneration evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Run it in PR CI twice and diff (Recommended) | Throwaway step or draft PR job; Phase 6 makes it permanent | ✓ |
| Ask the owner to run it locally and report back | One local run | |
| Defer to Phase 6 (CI-03) entirely | Do not claim the criterion's last clause | |

**User's choice:** Run it in PR CI twice and diff

---

## DEAD-04 stale reference boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3: ignore-file and config references to files that no longer exist (Recommended) | Plus anything Phase 3's removals orphan; prose stays in Phase 5 | ✓ |
| Phase 3: only BUILD_PROMPT.md and references to things Phase 3 deletes | Narrowest | |
| Phase 3: all stale references including docs prose | Widest, overlaps RED-05 | |

**User's choice:** Ignore-file and config references to files that no longer exist

---

## Claude's Discretion

- Commit grouping inside each PR, ledger file name and columns, item order within a category.
- How the throwaway `db:types` CI evidence is arranged, as long as it is not merged to `main`.
- Which package-surface findings pass the proof under D-01.

## Deferred Ideas

- `knip.json` change for the `test/**` entry side effect and the blocking knip gate: Phase 6 (CI-01).
- Permanent `db:types` drift, migration append-only and ignored-file CI checks: Phase 6 (CI-03).
- Spec-citation removal and docs sync: Phase 5 (RED-04, RED-05).
- Open info items from the second Phase 2 code review.
