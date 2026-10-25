# Milestone Archive: v1.0 Requirements — Hearth Cleanup and Hardening

**Completed:** 2026-10-25
**Coverage:** 40 / 40 Complete (100%)

---

## v1 Requirements Summary

### Git history and workflow

- [x] **GIT-01**: The ~55 local commits are curated (squashed, reworded, reordered, noise dropped) onto origin's initial commit, with messages that pass commitlint (Outcome: Validated — completed in Phase 1)
- [x] **GIT-02**: The owner approves the rewrite plan before the first push; history reaches `origin/main` as a fast-forward (Outcome: Validated — completed in Phase 1)
- [x] **GIT-03**: A branch and PR policy is written down: major functionality goes through PRs from branches or worktrees with squash merge; docs-only or mechanical changes go straight to `main` (Outcome: Validated — completed in Phase 1)
- [x] **GIT-04**: New scripts keep the executable bit and LF endings in committed history (Outcome: Validated — completed in Phase 1)

### Baseline and analysis

- [x] **BASE-01**: A baseline of typecheck, lint, test and build results on untouched `main` is recorded (Outcome: Validated — completed in Phase 2)
- [x] **BASE-02**: knip is configured with explicit entry points (`sw.ts`, seed, e2e global setup, package exports) and calibrated with canaries (Outcome: Validated — completed in Phase 2)
- [x] **BASE-03**: Findings are triaged into proven-dead, config-gap, test-only and uncertain, with the uncertain list handed to the owner (Outcome: Validated — completed in Phase 2)
- [x] **BASE-04**: A duplication scan is recorded (Outcome: Validated — completed in Phase 2)

### Test determinism

- [x] **TIME-01**: Unit and component tests pin "now" and timezone through a global hook, and the 7 failing time-dependent web test files are fixed (Outcome: Validated — completed in Phase 2)
- [x] **TIME-02**: Service and package suites are swept for date and timezone dependence and fixed (Outcome: Validated — completed in Phase 2)
- [x] **TIME-03**: E2E expectations are derived from seed data with no weekday assumptions (Outcome: Validated — completed in Phase 2; weekend confirmation deferred by owner)
- [x] **TIME-04**: A lint rule bans bare `new Date()` and `Date.now()` in tests and `e2e/` (Outcome: Validated — completed in Phase 2)
- [x] **TIME-05**: The UTC-versus-household-zone date helper flake in `bills.integration.test.ts` is fixed (Outcome: Validated — completed in Phase 2)
- [x] **TIME-06**: CI runs unit and component tests across a date/timezone matrix on `main` and nightly (Outcome: Validated — completed in Phase 6)

### Dead code and hygiene

- [x] **DEAD-01**: Proven-dead files are removed (Outcome: Validated — completed in Phase 3)
- [x] **DEAD-02**: Proven-dead exports and types are removed (Outcome: Validated — completed in Phase 3)
- [x] **DEAD-03**: Unused dependencies are removed with the lockfile in the same commit (Outcome: Validated — completed in Phase 3)
- [x] **DEAD-04**: Stale references are removed (Outcome: Validated — completed in Phase 3)
- [x] **DEAD-05**: No tracked generated or leftover files remain, and `db/types.ts` has a drift check (Outcome: Validated — completed in Phase 3 & Phase 6 CI-03)
- [x] **DEAD-06**: Candidates tooling cannot prove dead are reported to the owner, not deleted (Outcome: Validated — completed in Phase 3)

### Bug fixes (each with a regression test)

- [x] **FIX-01**: Offline list-add replay is reproduced with a failing test, then fixed (stable ID in `useAddDealToList`) (Outcome: Validated — completed in Phase 4)
- [x] **FIX-02**: Recipe add-to-list idempotency is checked and fixed if it leaks duplicates (Outcome: Validated — completed in Phase 4)
- [x] **FIX-03**: A structural test guards every PATCH schema against default-injection (Outcome: Validated — completed in Phase 4)
- [x] **FIX-04**: The `RotationEditor` accessibility suppression is replaced with proper keyboard semantics (Outcome: Validated — completed in Phase 4)
- [x] **FIX-05**: Service-role client usage is audited, and a test proves the lint fence fails when violated (Outcome: Validated — completed in Phase 4)
- [x] **FIX-06**: `deploy.sh` no longer passes the database password on the command line (Outcome: Validated — completed in Phase 4)
- [x] **FIX-07**: Kong denies the unused GoTrue paths, not only Caddy, with positive-flow tests (Outcome: Validated — completed in Phase 4)

### Redundancy and docs

- [x] **RED-01**: A CI composite setup action replaces the preamble repeated in six jobs (Outcome: Validated — completed in Phase 5)
- [x] **RED-02**: The duplicate seed typecheck is removed (Outcome: Validated — completed in Phase 5)
- [x] **RED-03**: Duplicated test fixtures flagged by the scan are consolidated (Outcome: Validated — completed in Phase 5)
- [x] **RED-04**: Stale spec citations are removed, comment-only and verified (Outcome: Validated — completed in Phase 5)
- [x] **RED-05**: `docs/` and the codebase map match the code (Outcome: Validated — completed in Phase 5)

### CI enforcement

- [x] **CI-01**: knip is blocking in CI once the tree is clean (Outcome: Validated — completed in Phase 6)
- [x] **CI-02**: A jscpd source-duplication threshold is enforced (Outcome: Validated — completed in Phase 6 at 2% test-inclusive)
- [x] **CI-03**: CI checks for tracked-ignored files, `db:types` drift, migration append-only and script modes (Outcome: Validated — completed in Phase 6)
- [x] **CI-04**: `pnpm audit --prod` runs with an expiring allowance for `braces` (Outcome: Validated — completed in Phase 6)
- [x] **CI-05**: Jobs have timeouts, and both workflows get a correctness review (Outcome: Validated — completed in Phase 6; deploy gate redeploy prevention added in G-06-3 / PR #44)
- [x] **CI-06**: Web coverage thresholds are either enforced or removed (Outcome: Validated — completed in Phase 6)
- [x] **CI-07**: A PR confirms that `CI` still triggers deploy correctly (Outcome: Validated — completed in Phase 6)
- [x] **CI-08**: No test in the repository fails intermittently in CI; full test suite passes reliably without quarantine, retry, skips or weakened assertions (Outcome: Validated — completed in Phase 6 G-06-5 / PR #45)

---

## Traceability Matrix

| Requirement | Phase | Status | Outcome |
|-------------|-------|--------|---------|
| GIT-01 | Phase 1 | Complete | Validated |
| GIT-02 | Phase 1 | Complete | Validated |
| GIT-03 | Phase 1 | Complete | Validated |
| GIT-04 | Phase 1 | Complete | Validated |
| BASE-01 | Phase 2 | Complete | Validated |
| BASE-02 | Phase 2 | Complete | Validated |
| BASE-03 | Phase 2 | Complete | Validated |
| BASE-04 | Phase 2 | Complete | Validated |
| TIME-01 | Phase 2 | Complete | Validated |
| TIME-02 | Phase 2 | Complete | Validated |
| TIME-03 | Phase 2 | Complete | Validated (weekend run deferred) |
| TIME-04 | Phase 2 | Complete | Validated |
| TIME-05 | Phase 2 | Complete | Validated |
| DEAD-01 | Phase 3 | Complete | Validated |
| DEAD-02 | Phase 3 | Complete | Validated |
| DEAD-03 | Phase 3 | Complete | Validated |
| DEAD-04 | Phase 3 | Complete | Validated |
| DEAD-05 | Phase 3 | Complete | Validated |
| DEAD-06 | Phase 3 | Complete | Validated |
| FIX-01 | Phase 4 | Complete | Validated |
| FIX-02 | Phase 4 | Complete | Validated |
| FIX-03 | Phase 4 | Complete | Validated |
| FIX-04 | Phase 4 | Complete | Validated |
| FIX-05 | Phase 4 | Complete | Validated |
| FIX-06 | Phase 4 | Complete | Validated |
| FIX-07 | Phase 4 | Complete | Validated |
| RED-01 | Phase 5 | Complete | Validated |
| RED-02 | Phase 5 | Complete | Validated |
| RED-03 | Phase 5 | Complete | Validated |
| RED-04 | Phase 5 | Complete | Validated |
| RED-05 | Phase 5 | Complete | Validated |
| CI-01 | Phase 6 | Complete | Validated |
| CI-02 | Phase 6 | Complete | Validated |
| CI-03 | Phase 6 | Complete | Validated |
| CI-04 | Phase 6 | Complete | Validated |
| CI-05 | Phase 6 | Complete | Validated |
| CI-06 | Phase 6 | Complete | Validated |
| CI-07 | Phase 6 | Complete | Validated |
| TIME-06 | Phase 6 | Complete | Validated |
| CI-08 | Phase 6 | Complete | Validated |
