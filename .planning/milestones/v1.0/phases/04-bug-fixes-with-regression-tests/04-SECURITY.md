---
phase: "04"
slug: "bug-fixes-with-regression-tests"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-21"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `POST /api/lists/:id/items` | the client-minted item id decides whether a repeated add is a replay or a new row | list item ids |
| service → Postgres (add to list) | read-then-insert inside one request transaction, as the authenticated caller | list items |
| request-handling code → `service_role` | the service role bypasses RLS; only `privileged/`, `main.ts` and `cli.ts` may build it | privileged DB access |
| client → PATCH endpoints | a partial body must never reset a stored field the caller left out | stored entity fields |
| deploy script → process table and logs | anything on a command line is visible to every local user and to `set -x` and CI logs | database passwords |
| test harness → host | the deploy test runs the real script; it must never reach a real Docker, database or host env file | host credentials |
| npm registry → repo | a new devDependency enters the lockfile | `yaml@2.9.1` |
| internet (Tailscale Funnel) → Caddy → Kong → GoTrue | the anon key is public in the web bundle, so any GoTrue route Kong allows for `anon` is reachable from the internet | auth requests |
| service-role key → `admin/users` | the E2E seed's privileged path through the stack | admin credentials |
| repo config → host | `docker/kong.yml` is bind-mounted; a merge does not apply it by itself | gateway config |
| branch → `main` | the owner's squash merge publishes history and queues Deploy | repository history |
| phase index → owner's review | the index must not claim evidence that does not exist | review evidence |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | `useAddDealToList` reusing a held id for a different list | medium | mitigate | Ids held per `${listId}:${dealId}` (`apps/web/src/lib/api/deals.ts`); tests 3 and 4 in `deal-card.test.tsx` | closed |
| T-04-02 | Tampering | overlapping `addMissingIngredientsToList` calls | medium | mitigate | `pg_advisory_xact_lock` `add-to-list:{listId}` (`apps/service/src/services/add-to-list.ts:35`); overlap test in `meal-plan.integration.test.ts` | closed |
| T-04-03 | Denial of Service | lock waits or deadlock between add-to-list and list-activity locks | low | accept | Accepted: household scale; per-list key, transaction-scoped, fixed lock order (`add-to-list.ts:35` before `list-activity.ts:47`) | closed |
| T-04-04 | Tampering | `.planning/` files riding into PR 1 | medium | mitigate | PR 1 squash `1b0e69f` holds six files plus `.claude/CLAUDE.md`, no `.planning/` | closed |
| T-04-05 | Denial of Service | PR 1 breaking the deployed app | high | mitigate | Six green CI jobs on PR 1's squash run (recorded in 04-VERIFICATION) | closed (CI evidence only) |
| T-04-06 | Repudiation | FIX-02 "red" caused by something other than the overlap case | medium | mitigate | Job log shows the overlap test as the only failure (recorded in 04-VERIFICATION) | closed (CI evidence only) |
| T-04-07 | Elevation of Privilege | `privileged/` import fence regressing unnoticed | high | mitigate | `test/eslint-service-role-fence.test.mjs` (nine spellings, eight paths, severity 2), wired into `test:harness`; fence at `eslint.config.js:109-127` | closed |
| T-04-08 | Tampering | PATCH schema default overwriting a stored field | medium | mitigate | `packages/shared/src/api/patch-schemas.test.ts` registry scan and `update*RequestSchema` cross-check | closed |
| T-04-09 | Elevation of Privilege | false assurance from fence gaps | low | mitigate | Gaps listed in the fence test header and `docs/testing.md` | closed |
| T-04-10 | Tampering | runtime/schema change riding in a "tests only" PR 2 | high | mitigate | PR 2 squash `7da1461` holds exactly four files; `package.json` diff touches only `test:harness` | closed |
| T-04-11 | Denial of Service | `main` red from a flaky guard | medium | mitigate | Guards use no clock, network, spawn or Docker; CI green on the tip | closed |
| T-04-12 | Information Disclosure | `POSTGRES_PASSWORD` in `supabase migration up` argv | high | mitigate | `PGPASSWORD` prefix assignment and password-free URL (`scripts/deploy.sh:97-98`); `deploy.test.mjs` asserts no argv holds a password | closed |
| T-04-13 | Information Disclosure | `PGPASSWORD` readable in `/proc/{pid}/environ` | low | accept | Accepted in D-09: single-user runner host, variable lives only for that process | closed |
| T-04-14 | Tampering | deploy test reaching real `docker`, `supabase` or `curl` | high | mitigate | Stubs first on `PATH`, fake env file, `HEARTH_DEPLOY_SHA`; stub log line required (`deploy.test.mjs`) | closed |
| T-04-15 | Information Disclosure | real credential in test, log, ledger or PR body | medium | mitigate | Sentinel secrets only; added-line scan found no credential patterns | closed |
| T-04-16 | Elevation of Privilege | GoTrue routes reachable through Kong with the public anon key | high | mitigate | Allowlist and `auth-v1-denied` 403 route in `docker/kong.yml:30-162`, pinned by `kong-routes.test.ts`; E2E probes in spec 08 | closed |
| T-04-17 | Denial of Service | Kong refusing to load the file | high | mitigate | `_format_version: '3.0'` (`kong.yml:10`), asserted by the static test; boots in PR CI (`kong config parse` was skipped) | closed (CI evidence for the boot) |
| T-04-18 | Denial of Service | a browser path missing from the allowlist | high | mitigate | Static test maps `auth-client.ts` calls to routes; E2E sign-in, refresh and reset-password journeys in CI | closed (CI evidence for E2E) |
| T-04-19 | Elevation of Privilege | anon key reaching `admin/users` | high | mitigate | `allow: [admin]` ACL (`kong.yml:142-146`), asserted statically and by E2E probe | closed |
| T-04-20 | Denial of Service | production sign-in broken by the allowlist | high | mitigate | Rollback in `docs/deploy.md:177-180`; green E2E journeys in CI | closed (CI evidence for E2E) |
| T-04-21 | Elevation of Privilege | false sense of protection: Kong still on the old catch-all | medium | mitigate | Host step documented in `docs/deploy.md:177-180`; end-of-phase check recorded as UAT test 1 | closed (see note below) |
| T-04-22 | Repudiation | FIX-07 "red" caused by a registry flake | medium | mitigate | Kong refusal test is the failing test in the saved job log (recorded in 04-VERIFICATION) | closed (CI evidence only) |
| T-04-23 | Tampering | merge resolution dropping PR 2's lines | medium | mitigate | `test:harness` line equals PR 2's plus `scripts/deploy.test.mjs` (`48c111f`) | closed |
| T-04-24 | Repudiation | index citing a CI run that does not exist | low | mitigate | REST checks recorded in 04-VERIFICATION | closed (secondary evidence) |
| T-04-25 | Denial of Service | re-running CI for a superseded `main` commit | medium | mitigate | PR 2's red recorded, not re-run (04-08-SUMMARY) | closed (secondary evidence) |
| T-04-26 | Elevation of Privilege | production Kong left on the old catch-all | medium | mitigate | `kong-recreate=pending-owner` in `FIX-LEDGER.md`; command in `docs/deploy.md:178`; UAT test 1 | closed (see note below) |
| T-04-SC | Tampering | npm/pip/cargo installs (`yaml@2.9.1`) | high | mitigate | Exact pin in `apps/service/package.json`; three importer-line lockfile diff; `gate-yaml=approve` in `FIX-LEDGER-INFRA.md` | closed (`--frozen-lockfile` is CI evidence only) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note on Kong (T-04-20, T-04-21, T-04-26):** the owner has no deployment, so no production Kong exists and no production exposure can arise. The host step (`hearth-compose up -d --force-recreate kong`) was not performed on any host. UAT test 1 is recorded as pass but was not run against a live deployment; treat it as not applicable. The mitigation that exists is the documentation and the ledger entry `kong-recreate=pending-owner`. The step must be done on the first real deployment.

**Note on closures resting on CI evidence:** the auditor had no GitHub access. T-04-05, T-04-06, T-04-22, T-04-24, T-04-25 and the E2E and frozen-lockfile parts of T-04-17, T-04-18, T-04-20 and T-04-SC rest on CI results recorded in the SUMMARY and VERIFICATION files.

**Observation outside the register (WR-01):** `POST /auth/v1/otp` (`docker/kong.yml:106-124`) is reachable with the public anon key. The reviewer's claim that it can create confirmed users without `/api/signup` was never checked on a running stack. The owner decided on 2026-10-20 to keep the route because magic links are planned (04-UAT test 2). It stays open in 04-REVIEW-DISPOSITION.md; revisit when magic links ship.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-03 | Household scale; the lock key is per list, transaction-scoped, and always taken before `recordListActivity`'s key, so the order is fixed | Plan 04-01 | 2026-10-20 |
| AR-04-02 | T-04-13 | Decision D-09: the runner host is single-user, the variable lives only for that process, and a temporary `PGPASSFILE` would add a file lifecycle to a production script | Owner (D-09) | 2026-10-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-21 | 27 | 27 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-21
