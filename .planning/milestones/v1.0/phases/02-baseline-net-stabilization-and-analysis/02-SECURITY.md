---
phase: "02"
slug: baseline-net-stabilization-and-analysis
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-19"
---

# Phase 02 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Audited on 2026-10-19 by the `gsd-security-auditor` agent against the code tree at `origin/main` `4ebc90b` (identical to this branch's code outside `.planning/`) and the GitHub history through the REST API. Block threshold: `high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Agent session to repository | Work branches are pushed to `origin` as backups; only the owner merges to `main` | Source, test and planning files; no secrets |
| Pull request to `main` to deploy | A merge to `main` triggers CI and a deploy job on a self-hosted runner (currently unregistered) | The merged tree |
| npm registry to repository | `knip` is the only package added in Phase 2 (exact pin, owner-approved); `jscpd` runs through `pnpm dlx` and is not installed | Dev dependency code |
| Sweep script to child processes | `scripts/test-sweep.mjs` spawns Vitest from CLI arguments | `--only`, workspace, cell, suite values |
| Local stack and logs | `supabase start` prints local demo keys; logs stay under the gitignored `.planning/cleanup/logs/` | Throwaway local credentials |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | Session toolchain (Node 24, pnpm, Supabase CLI) installed by .planning/environment/cloud-setup.sh | medium | transfer | Provenance and integrity of the binaries belong to the setup script (see .planning/environment/CLOUD-ENVIRONMENT.md), outside this plan. This plan installs and downloads... | closed |
| T-02-02 | Tampering | main and the session's planning files during the baseline | medium | mitigate | git worktree add --detach creates no branch; phase rule 1 forbids checkout, switch, reset, stash and clean in the primary checkout; Task 2 verifies that main holds no app... | closed |
| T-02-03 | Information disclosure | supabase start output in logs (path a) | low | accept | The local stack prints local demo keys, which protect only a throwaway local database; the output goes to supabase-start.log under .planning/cleanup/logs/, which is gitig... | closed |
| T-02-04 | Tampering | scripts/test-sweep.mjs command construction | medium | mitigate | Workspaces and cells come from fixed allowlists; --only must match ^[A-Za-z0-9._/-]+$; anything else exits 2 before spawning (Task 1 acceptance: 'x;echo pwned' exits 2) | closed |
| T-02-05 | Tampering | Integrity of sweep evidence (zone silently ignored or invalid) | medium | mitigate | test/global-tz.mjs rejects non-IANA zones and verifies the effective zone; the sweep self-checks each cell's zone in a child process; verification greps the [test-clock]... | closed |
| T-02-06 | Tampering | Test oracles in the seven web files | medium | mitigate | Phase rule 6 forbids weakened assertions, skips, retries, sleeps and suite-wide zones; Task 2 acceptance counts added skip or todo calls (must be 0), restricts the diff t... | closed |
| T-02-07 | Tampering | Service and package test oracles | medium | mitigate | Opt-outs are per test, with vi.useRealTimers() first and a written reason (class d); no assertion weakened, skipped or retried (phase rule 6); acceptance counts added ski... | closed |
| T-02-08 | Tampering | Coverage gate in pnpm test for recurrence | low | mitigate | The plain pnpm test run must still meet the 90% thresholds; no threshold is edited | closed |
| T-02-09 | Tampering | Integrity of the TIME-05 regression claim | medium | mitigate | The red run against the UTC helper is required before the fix (Task 1 step 5). The verify parses its JSON report for a guard result, found by title, that failed on an ass... | closed |
| T-02-10 | Tampering | Integration test oracles | medium | mitigate | Each clock read is classified and swapped for a helper with the same meaning; no assertion is loosened (phase rule 6); the source diff is limited to tests and src/test/ | closed |
| T-02-11 | Denial of service | Local Supabase stack shared with plan 02-01 (path a) | low | accept | Plans 02-01 and 02-04 sit in different waves (phase rule 9); the database is local and disposable (supabase db reset) | closed |
| T-02-12 | Tampering | no-restricted-syntax ban in eslint.config.js | medium | mitigate | Only next-line opt-outs with a  --  reason; Task 2 verify fails on any opt-out without a reason, on any opt-out outside the four expected files, and on file-level or bloc... | closed |
| T-02-13 | Information disclosure | Browser zone pinned to America/New_York | low | accept | A bug where the UI renders a calendar date in the browser's zone instead of the household's would no longer show on UTC CI runs. Calendar dates are covered by the zone-sw... | closed |
| T-02-14 | Tampering | E2E fixture SQL | low | mitigate | Edited only when a spec depends on a server-zone date, and then only to the household-zone pattern already used by supabase/seed/seed.sql; migrations are untouched (phase... | closed |
| T-02-15 | Tampering | Source files versus knip auto-fix | high | mitigate | Only --reporter json runs; the scripts are checked to equal the exact report-only strings; Task 3 acceptance shows no deleted file and a diff limited to four config and d... | closed |
| T-02-16 | Tampering | Canary residue in the shipped branch | medium | mitigate | Canaries live only on scratch/knip-canaries, which is deleted; verify greps chore/knip-config outside .planning/ for every canary name (the committed calibration records... | closed |
| T-02-17 | Repudiation | Calibration evidence | low | mitigate | Raw JSON and normalized summaries for every run are kept under .planning/cleanup/knip/, and the table records expected versus observed | closed |
| T-02-18 | Tampering | Triage buckets in TRIAGE.md | high | mitigate | Proven-dead needs a knip report, no importer from a trace, and no non-documentation text-search hit across all file types; conservative precedence; D-10 standing list for... | closed |
| T-02-19 | Tampering | Repo content during analysis | medium | mitigate | Analysis runs in a scratch worktree that is removed; Task 2 acceptance requires a clean status; the only repo write allowed is a narrow knip.json config-gap fix on chore/... | closed |
| T-02-20 | Information disclosure | Branch contents and PR bodies | high | mitigate | Task 1 blocks .claude/, env files, raw logs and any .planning/ path outside the phase rule 11 paths, and scans added lines (records included) for secret-shaped strings be... | closed |
| T-02-21 | Elevation of privilege | Opening pull requests without consent | high | mitigate | Task 2 is a gate="blocking-human" decision before any pull request opens or is marked ready (02-04's draft has its own gate); Task 3's precondition requires the recorded... | closed |
| T-02-22 | Tampering | Production deploy triggered by a merge | medium | transfer | Merging is the owner's action; CONTRIBUTING.md documents that a merge to main deploys once CI passes, and the Deploy job currently waits for an unregistered runner | closed |
| T-02-23 | Denial of service | CI flake from registry rate limits | low | accept | One bounded re-run of failed jobs for a documented registry error; any other failure is diagnosed, not retried | closed |
| T-02-24 | Repudiation | TIME-03 closure claim | medium | mitigate | Task 1 verify fails unless every spec file under e2e/tests/ has a ledger row with a valid verdict; Task 2 acceptance makes the SUMMARY state TIME-03 open whenever an owne... | closed |
| T-02-25 | Tampering | Merge target and diff of the stacked knip PR | medium | mitigate | The knip PR body, the Task 2 gate context and the SUMMARY give the clock-first order and say not to squash the knip PR before its base reads main and its Files tab lists... | closed |
| T-02-26 | Repudiation | Path (b) integration rows read from CI | low | mitigate | Rows come only from completed CI runs whose head is d3da748, each Log cell names the run URL, the job log is saved under .planning/cleanup/logs/baseline/, and ## Integrat... | closed |
| T-02-27 | Elevation of privilege | Early draft pull request from test/deterministic-clock (path b) | high | mitigate | A blocking-human checkpoint:decision must record decision=early-ci-approved before the draft pull request is opened (phase rule 4; the branch itself is already on origin... | closed |
| T-02-28 | Repudiation | TIME-05 red evidence from CI (path b) | medium | mitigate | The red and green claims are tied to recorded SHAs: the verify reads each run's headSha and test-integration conclusion from saved run JSON, requires a failing guard line... | closed |
| T-02-29 | Information disclosure | Branch backup push of a work branch to origin (phase rule 4) | medium | mitigate | Phase rule 4's pre-push checks block .claude/, .github/, supabase/migrations/, docker/ and .planning/cleanup/logs/ paths, env files and secret-shaped added lines; the pus... | closed |
| T-02-30 | Information disclosure | Branch backup push of a work branch to origin (phase rule 4) | medium | mitigate | Phase rule 4's pre-push checks block .claude/, .github/, supabase/migrations/, docker/ and .planning/cleanup/logs/ paths, env files and secret-shaped added lines; the pus... | closed |
| T-02-31 | Information disclosure | Branch backup push of a work branch to origin (phase rule 4) | medium | mitigate | Phase rule 4's pre-push checks block .claude/, .github/, supabase/migrations/, docker/ and .planning/cleanup/logs/ paths, env files and secret-shaped added lines; the pus... | closed |
| T-02-32 | Information disclosure | Branch backup push of a work branch to origin (phase rule 4) | medium | mitigate | Phase rule 4's pre-push checks block .claude/, .github/, supabase/migrations/, docker/ and .planning/cleanup/logs/ paths, env files and secret-shaped added lines; the pus... | closed |
| T-02-33 | Information disclosure | Branch backup push of a work branch to origin (phase rule 4) | medium | mitigate | Phase rule 4's pre-push checks block .claude/, .github/, supabase/migrations/, docker/ and .planning/cleanup/logs/ paths, env files and secret-shaped added lines; the pus... | closed |
| T-02-34 | Information disclosure | Branch backup push of a work branch to origin (phase rule 4) | medium | mitigate | Phase rule 4's pre-push checks block .claude/, .github/, supabase/migrations/, docker/ and .planning/cleanup/logs/ paths, env files and secret-shaped added lines; the pus... | closed |
| T-02-35 | Information disclosure | Branch backup push of a work branch to origin (phase rule 4) | medium | mitigate | Phase rule 4's pre-push checks block .claude/, .github/, supabase/migrations/, docker/ and .planning/cleanup/logs/ paths, env files and secret-shaped added lines; the pus... | closed |
| T-02-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package is added: pnpm install --frozen-lockfile installs only versions already pinned in pnpm-lock.yaml. The toolchain binaries are covered by T-02-01 | closed |

*Status: open - closed*
*T-02-29 is the branch-backup-push control. Plans 02-03, 02-04, 02-05, 02-06, 02-07 and 02-09 listed the same row, renumbered T-02-30 to T-02-35 so that IDs are unique (commit 0b1147b); it was verified once for all seven.*
*Severity: critical > high > medium > low. Only open threats at or above `high` count toward `threats_open`.*

---

## Accepted Risks Log

These four risks carry the disposition `accept` in the plans. They were accepted when the plans were written; the rationale is in the cited plan's threat row. This audit checked that the rationale is documented and did not re-decide them.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-03 | Local Supabase demo keys appear only in gitignored logs, never in a committed record | Phase 2 plan 02-01 (at planning) | 2026-10-12 |
| R-02-02 | T-02-11 | The local stack is shared by two plans in different waves; the database is disposable | Phase 2 plan 02-04 (at planning) | 2026-10-12 |
| R-02-03 | T-02-13 | The E2E browser zone is pinned to America/New_York; zone coverage comes from the unit and component sweep | Phase 2 plan 02-09 (at planning) | 2026-10-12 |
| R-02-04 | T-02-23 | One bounded CI re-run is allowed for a registry error; none was needed | Phase 2 plan 02-08 (at planning) | 2026-10-12 |

Transfers: T-02-01 transfers to `.planning/environment/cloud-setup.sh` (SHA-256 pins for the Node tarball and the Supabase CLI); T-02-22 transfers to the owner (merging, and registering the deploy runner), documented in `CONTRIBUTING.md`.

---

## Open Observations (non-blocking)

Raised by the audit; none maps to a registered threat and none changes `threats_open`.

- **No branch protection on `main`.** The controls "never push `main`, never merge, no force-push" hold by process discipline only. The session credential can write to the repository, `main` is not protected, and GitHub shows the same user for agent and owner actions. `CONTRIBUTING.md` says protection is not yet configured. Smallest remedy: enable branch protection on `main` (owner action in repository settings).
- **A force-push to `main` before Phase 2.** The activity feed shows `0c79874` to `89eb558` at 2026-10-12T21:55:35Z, before the Phase 2 plans, the primary checkout setup and the first Phase 2 branch push. `0c79874` is a "temporary planning commit" that was amended into `89eb558`. It is outside this phase's controls. No non-fast-forward push and no agent push to `main` occurred afterwards.
- **Self-reported evidence.** The owner's consent answers (the `approve-both` gates) and who clicked each merge cannot be proven from the API alone; the outcomes (fast-forward pushes, GitHub squash merges after PR creation) are verified.
- **Session branch on `origin`.** `claude/trusting-lovelace-y4r87h` is pushed and holds planning documents only; the scan found no forbidden path and no secret-shaped string.
- **Deploy queue.** Deploy runs for recent `main` commits wait on the unregistered self-hosted runner (T-02-22).
- **Limits of the audit.** ESLint, the unit suites and Docker were not run by the auditor; the lint ban (T-02-12) rests on static checks, the in-repo harness tests and green CI. The T-02-09 red result is a preserved artifact, not independently reproduced.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-19 | 36 | 36 | 0 | gsd-security-auditor (30 mitigate, 4 accept, 2 transfer) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-19 by the automated security audit; this is an audit result, not an owner sign-off.
