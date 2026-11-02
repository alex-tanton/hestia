# Phase 7: Planning Cleanup & Documentation Restructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-25
**Phase:** 7-Planning Cleanup & Documentation Restructure
**Areas discussed:** Archive scope in .planning/, docs/ file layout and names, README shape (under 150 lines)

---

## Archive scope in .planning/

| Question | Options | Selected |
|----------|---------|----------|
| Archive layout | v1.0/ with flat files moved in; v1.0/ keeping flat files in place | v1.0/ with flat files moved in |
| codebase/ maps | Keep; archive; delete | Delete |
| quick/ and environment/ | Archive quick, keep environment; archive both; keep both | Archive quick, keep environment |
| Mechanics | git mv verbatim; git mv then drop regenerable artifacts | git mv, then drop regenerable artifacts |

**Notes:** Which artifacts count as regenerable was not specified; recorded as a rule (evidence-cited items are kept, ambiguous ones listed for the owner).

## docs/ file layout and names

| Question | Options | Selected |
|----------|---------|----------|
| deploy.md vs deployment.md | git mv rename; keep and add thin index | git mv rename |
| README/deploy.md overlap | Merge keeping most complete; README overwrites; keep both | Merge |
| development.md content | New file, E2E stays in testing.md; also hold E2E | New file, E2E in testing.md |
| CONTRIBUTING.md | Leave, fix links; fold Scripts/Checks into development.md | Fold Scripts/Checks into development.md |

**Notes:** The CONTRIBUTING fold-in was flagged as widening scope beyond the three requirements; the user chose it anyway.

## README shape (under 150 lines)

| Question | Options | Selected |
|----------|---------|----------|
| Name | Keep Hearth; write Hestia now | Keep Hearth |
| Quickstart depth | Install+dev servers+4-5 commands; install+dev only; full table | Install+dev servers+4-5 commands |
| Architecture | Paragraph + Layout table; paragraph only | Paragraph + Layout table |
| Doc index | Every docs/ file + CONTRIBUTING; only three guides + CONTRIBUTING | Every docs/ file + CONTRIBUTING |

## Claude's Discretion

- Proof of zero knowledge loss (offered as a gray area, not selected).
- Section ordering, merged wording, which cleanup/ artifacts are regenerable.

## Deferred Ideas

- Remap codebase after Phase 8; Hestia/Cloudflare doc rewrites in Phases 8 and 9.
