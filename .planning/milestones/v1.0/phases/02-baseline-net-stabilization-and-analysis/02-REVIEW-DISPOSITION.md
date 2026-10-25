---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Suite-level clock overrides are discarded by the per-test re-pin"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "--only matching no test reports PASS"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The no-restricted-syntax clock ban has false negatives and scope gaps"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Pin, zone hook and sweep validation have no tests"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "global-tz rejects valid TZ values and does not validate HEARTH_TEST_NOW"
  - id: IN-01
    severity: info
    disposition: open
    title: "Lint message and docs point to currentInstant(), absent in 4 of 6 workspaces"
  - id: IN-02
    severity: info
    disposition: open
    title: "spawnSync shell:true is safe only because of the regex"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "Frozen Date.now with a real performance.now is undocumented"
  - id: IN-04
    severity: info
    disposition: open
    title: "Sweep matrix omits US fall-back, leap day, month end, UTC-positive year rollover, half-hour zones"
  - id: IN-05
    severity: info
    disposition: open
    title: "knip.json produces 14 hints and an unlisted dependency"
  - id: IN-06
    severity: info
    disposition: open
    title: "Duplicated helpers and a duplicated hoisted TZ block"
  - id: IN-07
    severity: info
    disposition: open
    title: "A test title says more than it asserts"
  - id: IN-08
    severity: info
    disposition: open
    title: "Integration and E2E changes were reviewed by reading only"
open: 7
total: 13
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | PR #8 (4ebc90b): suite-owned clock kept, 41 clock-setup cases |
| WR-02 | warning | fixed | PR #8 (4ebc90b): sweep exits 2 when the filter selects no file |
| WR-03 | warning | fixed | PR #8 (4ebc90b): widened selectors and globs; gaps left open are listed in the PR body |
| WR-04 | warning | fixed | PR #8 (4ebc90b): 167 harness tests run by pnpm test via test:harness |
| WR-05 | warning | fixed | PR #8 (4ebc90b): accepts GMT and the POSIX colon form; HEARTH_TEST_NOW validated up front |
| IN-01 | info | open | Docs now say where the helper exists (PR #6); the lint message still names it everywhere |
| IN-02 | info | open | Not touched; tests for 15 hostile values exist (PR #8) |
| IN-03 | info | fixed | PR #6 (2cff293): docs/testing.md documents the mixed clock |
| IN-04 | info | open | Not addressed |
| IN-05 | info | open | vitest unlisted dependency fixed by PR #5 (0608107); the 14 redundant-entry hints remain |
| IN-06 | info | open | Not addressed |
| IN-07 | info | open | Not addressed |
| IN-08 | info | open | CI test-integration and test-e2e were green on every Phase 2 PR; not re-run by the reviewer |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.

Hand-written on 2026-10-19 from the first Phase 2 review (02-REVIEW.md, 0 critical, 5 warnings, 8 infos). A second review of the code PR #8 added is 02-REVIEW-FIXES.md; its findings are not in this ledger.
