# Requirements: Hearth — Cleanup and Hardening

**Defined:** 2026-10-11
**Core Value:** The owner can start a manual review from a lean, trustworthy base: no dead code or stray generated files, a CI suite that passes repeatably regardless of day or timezone, and the known bugs fixed with regression tests.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Git history and workflow

- [x] **GIT-01**: The ~55 local commits are curated (squashed, reworded, reordered, noise dropped) onto origin's initial commit, with messages that pass commitlint
- [x] **GIT-02**: The owner approves the rewrite plan before the first push; history reaches `origin/main` as a fast-forward
- [x] **GIT-03**: A branch and PR policy is written down: major functionality goes through PRs from branches or worktrees with squash merge; docs-only or mechanical changes go straight to `main`
- [x] **GIT-04**: New scripts keep the executable bit and LF endings in committed history

### Baseline and analysis

- [x] **BASE-01**: A baseline of typecheck, lint, test and build results on untouched `main` is recorded
- [x] **BASE-02**: knip is configured with explicit entry points (`sw.ts`, seed, e2e global setup, package exports) and calibrated with canaries
- [x] **BASE-03**: Findings are triaged into proven-dead, config-gap, test-only and uncertain, with the uncertain list handed to the owner
- [x] **BASE-04**: A duplication scan is recorded

### Test determinism

- [x] **TIME-01**: Unit and component tests pin "now" and timezone through a global hook, and the 7 failing time-dependent web test files are fixed
- [x] **TIME-02**: Service and package suites are swept for date and timezone dependence and fixed
- [x] **TIME-03**: E2E expectations are derived from seed data with no weekday assumptions (done and green in CI on one calendar day; the weekend confirmation run is deferred by the owner, see the Phase 2 UAT)
- [x] **TIME-04**: A lint rule bans bare `new Date()` and `Date.now()` in tests and `e2e/`
- [x] **TIME-05**: The UTC-versus-household-zone date helper flake in `bills.integration.test.ts` is fixed
- [ ] **TIME-06**: CI runs unit and component tests across a date/timezone matrix on `main` and nightly

### Dead code and hygiene

- [x] **DEAD-01**: Proven-dead files are removed
- [x] **DEAD-02**: Proven-dead exports and types are removed
- [x] **DEAD-03**: Unused dependencies are removed with the lockfile in the same commit (the `fuse.js` benchmark cluster, unused `tsx` in seed)
- [x] **DEAD-04**: Stale references are removed (e.g. `BUILD_PROMPT.md` in ignore files)
- [x] **DEAD-05**: No tracked generated or leftover files remain, and `db/types.ts` has a drift check (one-time check done in Phase 3; the permanent check is CI-03)
- [x] **DEAD-06**: Candidates tooling cannot prove dead are reported to the owner, not deleted

### Bug fixes (each with a regression test)

- [x] **FIX-01**: Offline list-add replay is reproduced with a failing test, then fixed (stable ID in `useAddDealToList`)
- [x] **FIX-02**: Recipe add-to-list idempotency is checked and fixed if it leaks duplicates
- [x] **FIX-03**: A structural test guards every PATCH schema against default-injection
- [x] **FIX-04**: The `RotationEditor` accessibility suppression is replaced with proper keyboard semantics
- [x] **FIX-05**: Service-role client usage is audited, and a test proves the lint fence fails when violated
- [x] **FIX-06**: `deploy.sh` no longer passes the database password on the command line
- [x] **FIX-07**: Kong denies the unused GoTrue paths, not only Caddy, with positive-flow tests

### Redundancy and docs

- [x] **RED-01**: A CI composite setup action replaces the preamble repeated in six jobs
- [x] **RED-02**: The duplicate seed typecheck is removed
- [x] **RED-03**: Duplicated test fixtures flagged by the scan are consolidated
- [ ] **RED-04**: The stale spec citations (1,116 lines in 456 files at PR C's base, recounted with the full retired-spec vocabulary; 262 was a Phase 2 count) are removed, comment-only and verified
- [ ] **RED-05**: `docs/` and the codebase map match the code

### CI enforcement

- [ ] **CI-01**: knip is blocking in CI once the tree is clean
- [ ] **CI-02**: A jscpd source-duplication threshold is enforced
- [ ] **CI-03**: CI checks for tracked-ignored files, `db:types` drift, migration append-only and script modes
- [ ] **CI-04**: `pnpm audit --prod` runs with an expiring allowance for `braces`
- [ ] **CI-05**: Jobs have timeouts, and both workflows get a correctness review
- [ ] **CI-06**: The web coverage thresholds are either enforced or removed, so config and docs agree
- [ ] **CI-07**: A PR confirms that `CI` still triggers deploy correctly

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Test health

- **TEST-01**: Large integration test files are split by domain
- **TEST-02**: DST-boundary cases are added to `packages/recurrence`
- **TEST-03**: Production-level per-IP rate limiting is exercised end to end

### Security and CI polish

- **SEC-01**: CSP `style-src 'unsafe-inline'` is removed or explicitly accepted
- **CIX-01**: actionlint, zizmor and action SHA pinning are adopted

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New product features | This milestone is cleanup and hardening only |
| Off-host backups and restore tests | Needs infrastructure decisions outside the repo |
| Replacing the unofficial Flipp deal source | Dependency risk, not cleanup |
| Scaling beyond one host | Not needed at household scale |
| Major dependency upgrades | Raises risk without serving cleanup goals |
| Editing applied migrations | Changes applied history; migrations stay append-only |
| Bulk deletion based on tool output alone | Static analysis misses config- and string-reachable code |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GIT-01 | Phase 1 | Complete |
| GIT-02 | Phase 1 | Complete |
| GIT-03 | Phase 1 | Complete |
| GIT-04 | Phase 1 | Complete |
| BASE-01 | Phase 2 | Complete |
| BASE-02 | Phase 2 | Complete |
| BASE-03 | Phase 2 | Complete |
| BASE-04 | Phase 2 | Complete |
| TIME-01 | Phase 2 | Complete |
| TIME-02 | Phase 2 | Complete |
| TIME-03 | Phase 2 | Complete |
| TIME-04 | Phase 2 | Complete |
| TIME-05 | Phase 2 | Complete |
| DEAD-01 | Phase 3 | Complete |
| DEAD-02 | Phase 3 | Complete |
| DEAD-03 | Phase 3 | Complete |
| DEAD-04 | Phase 3 | Complete |
| DEAD-05 | Phase 3 | Complete |
| DEAD-06 | Phase 3 | Complete |
| FIX-01 | Phase 4 | Complete |
| FIX-02 | Phase 4 | Complete |
| FIX-03 | Phase 4 | Complete |
| FIX-04 | Phase 4 | Complete |
| FIX-05 | Phase 4 | Complete |
| FIX-06 | Phase 4 | Complete |
| FIX-07 | Phase 4 | Complete |
| RED-01 | Phase 5 | Complete |
| RED-02 | Phase 5 | Complete |
| RED-03 | Phase 5 | Complete |
| RED-04 | Phase 5 | Pending |
| RED-05 | Phase 5 | Pending |
| CI-01 | Phase 6 | Pending |
| CI-02 | Phase 6 | Pending |
| CI-03 | Phase 6 | Pending |
| CI-04 | Phase 6 | Pending |
| CI-05 | Phase 6 | Pending |
| CI-06 | Phase 6 | Pending |
| CI-07 | Phase 6 | Pending |
| TIME-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 39 total (corrected from 37; category counts GIT 4, BASE 4, TIME 6, DEAD 6, FIX 7, RED 5, CI 7 sum to 39)
- Mapped to phases: 39
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-11*
*Last updated: 2026-10-11 after roadmap creation*
