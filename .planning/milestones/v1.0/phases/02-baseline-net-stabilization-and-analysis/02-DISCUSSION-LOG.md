# Phase 2: Baseline, Net Stabilization, and Analysis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 2-Baseline, Net Stabilization, and Analysis
**Areas discussed:** Clock pin + date lint ban; Real-clock suites (E2E + bills); knip scope + canaries; Baseline + findings output

---

## Clock pin + date lint ban

| Question | Options | Selected |
|----------|---------|----------|
| How to pin "now" | Global pin in setup / Per-file opt-in helper / Global TZ only | Global pin in setup |
| Sweep parameterization | Env vars + sweep script / Vitest projects / Manual one-off | Env vars + sweep script |
| Lint ban escape hatch | Helper + disable-with-reason / Per-file override block / Ban zero-arg only | Helper + disable-with-reason |
| Default pinned instant | Mid-week midday UTC / Reuse 2026-09-27T16:00Z / You decide | Mid-week midday UTC |

## Real-clock suites: E2E + bills

| Question | Options | Selected |
|----------|---------|----------|
| E2E weekday strategy | Seed-derived, no app change / Server clock seam / Seed-derived, seam if needed | Seed-derived, no app change |
| bills.integration flake | Fix helper + skewed-TZ guard / Helper only / Sweep other integration files | Fix helper + skewed-TZ guard |
| Integration in sweep | Yes, under TZ matrix / Unit only | Yes, under TZ matrix |

## knip scope + canaries

| Question | Options | Selected |
|----------|---------|----------|
| Config location | Committed knip.json + devDep / Scratch config | Committed knip.json + devDep |
| Calibration | Throwaway canaries / Permanent calibration test / Live-only check | Throwaway canaries, result recorded |
| Non-TS reachability | Entry points + manual uncertain list / Broad ignore globs | Entry points + manual uncertain list |

## Baseline + findings output

| Question | Options | Selected |
|----------|---------|----------|
| Baseline capture | Clean worktree at d3da748, 2 runs on Node 24 / Single run on current main | Clean worktree, 2 runs |
| Findings shape | One triage table + raw reports / Single combined document | One triage table + raw reports |

## Claude's Discretion

- Exact pinned instant and TZ matrix values; names/locations of the test clock helper and sweep script.

## Deferred Ideas

- CI date/TZ matrix and blocking knip/jscpd (Phase 6); DST cases (v2); server clock seam for E2E (rejected).
