# Phase 8: Full Rebrand to Hestia - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-25
**Phase:** 08-full-rebrand-to-hestia
**Areas discussed:** Env var cutover, Infra & DB names, CLI & local state, Scope of prose sweep

---

## Env var cutover

| Option | Description | Selected |
|--------|-------------|----------|
| HESTIA_* primary, HEARTH_* fallback | Old env file keeps working until edited | |
| Hard cutover | Only HESTIA_* accepted | ✓ |
| Fallback in service only | env.ts accepts both, scripts/Compose HESTIA_* only | |

**User's choice:** Hard cutover
**Notes:** Overrides BRAND-05 "fallback compatibility where needed".

## Infra & DB names

| Option | Description | Selected |
|--------|-------------|----------|
| Rename images/services, keep stateful names | Keep project name, /srv/hearth, DB role | |
| Rename everything incl. data-bearing names | Project, volumes, path, role | ✓ |
| Rename code-level only | Leave Docker/DB/host names | |

**User's choice:** Rename everything
**Notes:** Follow-ups: no production data to keep (fresh deploy); role renamed by editing existing migrations (conflicts with the append-only CI gate, flagged as D-06).

## CLI & local state

| Option | Description | Selected |
|--------|-------------|----------|
| Clean-break CLI; rename keys with no migration | | ✓ |
| hearth-admin kept as deprecated alias | | |
| Migrate persisted state too | | |

**User's choice:** Clean break, no migration

## Scope of prose sweep

| Option | Description | Selected |
|--------|-------------|----------|
| Live files only | Leave archive and repo name | |
| Live files + planning docs | | |
| Everything incl. repo rename | | ✓ |

**User's choice:** Everything incl. repo rename
**Notes:** Follow-ups: rename GitHub repo after merge with in-repo URLs updated; v1.0 archive and git history left as-is.

## Claude's Discretion

Mechanical rename mechanics, form of the migration-gate exemption, lowercase casing.

## Deferred Ideas

Phases 9–11 items; migrating queued offline writes.
