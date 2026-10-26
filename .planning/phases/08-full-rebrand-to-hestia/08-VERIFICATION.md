---
phase: 08-full-rebrand-to-hestia
verified: 2026-10-26T05:00:00Z
status: human_needed
score: 5/6 must-haves verified
covered_files:
  - .planning/phases/08-full-rebrand-to-hestia/08-01-PLAN.md
  - .planning/phases/08-full-rebrand-to-hestia/08-01-SUMMARY.md
  - .planning/phases/08-full-rebrand-to-hestia/08-02-PLAN.md
  - .planning/phases/08-full-rebrand-to-hestia/08-02-SUMMARY.md
  - .planning/phases/08-full-rebrand-to-hestia/08-03-PLAN.md
  - .planning/phases/08-full-rebrand-to-hestia/08-03-SUMMARY.md
  - .planning/phases/08-full-rebrand-to-hestia/08-04-PLAN.md
  - .planning/phases/08-full-rebrand-to-hestia/08-04-SUMMARY.md
  - .planning/phases/08-full-rebrand-to-hestia/08-05-PLAN.md
  - .planning/phases/08-full-rebrand-to-hestia/08-05-SUMMARY.md
  - .planning/phases/08-full-rebrand-to-hestia/08-06-PLAN.md
  - .planning/phases/08-full-rebrand-to-hestia/08-06-SUMMARY.md
  - .planning/phases/08-full-rebrand-to-hestia/08-07-PLAN.md
  - .planning/phases/08-full-rebrand-to-hestia/08-07-SUMMARY.md
  - apps/service/bin/hestia-admin
  - apps/service/src/env.ts
  - apps/web/vite.config.ts
  - docker/docker-compose.yml
  - scripts/check-migrations-append-only.mjs
  - scripts/check-repo-hygiene.mjs
  - scripts/migration-exemptions.json
  - supabase/migrations/20260919060000_hestia_service_role.sql
covered_digest: "v3:sha256:5567c2dddeb4164b7f66f2aea05d7ed0bcdd00b4f5012d5b3e5d4a7e1660d0fc"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the built app in a real browser (and, if possible, install it) and look at the tab title, shell header, onboarding install step and the installed app name"
    expected: "Tab title reads Hestia (and a page title like 'This Week · Hestia'); onboarding says 'Install Hestia' and 'Go to Hestia'; the installed PWA is named Hestia (iOS may keep the old label until the app is re-added)"
    why_human: "Strings are proven by unit tests and the built manifest/index.html, but no browser session was run; visual and install-prompt behavior cannot be checked headlessly"
  - test: "Confirm CI is green on the pull request, specifically test-integration (pnpm test:integration and service test:coverage) and test-e2e (Playwright, 104 tests)"
    expected: "All seven CI jobs pass under the new brand; E2E reports 104 passed"
    why_human: "This verification was told not to run supabase or E2E. The 08-07 SUMMARY claims integration 433 tests, service coverage 1193 tests and E2E 104 passed; those claims are plausible (every unit total matched on re-run) but unreproduced here"
  - test: "Work through .planning/phases/08-full-rebrand-to-hestia/08-OWNER-CHECKLIST.md steps 1-4 before merging, and steps 5-17 after"
    expected: "/srv/hestia/.env exists with HESTIA_* names and the unchanged origin, the runner has the hestia label, the old hearth stack is stopped, the Deploy run succeeds and /api/health answers, the repository is renamed to hestia"
    why_human: "These happen on the owner's host and GitHub settings; a merge to main auto-deploys, and the deploy job waits forever without the hestia runner label"
  - test: "Review the owner-visible choice that .planning/phases/ and .planning/research/ are allowlisted wholesale in LEGACY_NAME_ALLOWLIST"
    expected: "Owner accepts it or asks for those prefixes to be dropped in a follow-up"
    why_human: "Planner's reading of D-13's quoting clause; it is a policy choice, documented in the checklist"
---

# Phase 8: Full Rebrand to Hestia Verification Report

**Phase Goal:** Rebrand the application from Hearth to Hestia across the monorepo, UI, manifest, CLI, and configuration.
**Verified:** 2026-10-26
**Status:** human_needed
**Re-verification:** No, initial verification
**Branch:** claude/confident-dirac-10eu0a at 8614058 (merge base with origin/main c5b74e4)

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | PWA UI titles, shell header, onboarding copy and install banners display "Hestia" | VERIFIED (visual check outstanding) | `AppShell.tsx:86` sets `${title} · Hestia`; `index.html` `<title>Hestia</title>` (also present in the built `dist/index.html`); `InstallStep.tsx` "Install Hestia", "Go to Hestia"; `OnboardingLayout.tsx:54`, `OnboardingScreen.tsx:32`, `AuthenticatedLayout.tsx`, `notification-copy.ts`, `bills-copy.ts`, `FALLBACK_NOTIFICATION.title` all say Hestia. No `hearth` in any tracked file outside the allowlist (guard clean). Real-browser check is under human_verification. |
| 2 | Manifest generates with `name: "Hestia"` and `short_name: "Hestia"` | VERIFIED | `vite.config.ts:52-53`. Ran `pnpm --filter @hestia/web build` (includes check-build): emitted `dist/manifest.webmanifest` starts `{"name":"Hestia","short_name":"Hestia",...}`. Description deliberately unchanged (brand-free), matching BRAND-02 text. |
| 3 | Administrative CLI is `hestia-admin` in `apps/service` | VERIFIED | `apps/service/bin/hestia-admin` exists, mode 100755; `apps/service/package.json` `bin` is `{"hestia-admin":"bin/hestia-admin"}`; no `hearth-admin` file or reference remains; `docker/service.Dockerfile` copies and symlinks `hestia-admin`; `cli.ts` USAGE is `hestia-admin reset-password <email>`. Ran the built wrapper: it execs `dist/cli.js` and fails env validation as expected. |
| 4 | Packages renamed to `@hestia/shared|recurrence|matching|service|web|e2e|seed` | VERIFIED | All seven `package.json` names confirmed (root is `hestia`). `pnpm-lock.yaml` has 0 `hearth` matches. `pnpm install --frozen-lockfile --offline` succeeds; `pnpm typecheck` passes in all 7 workspaces; Dockerfiles/CI use `--filter @hestia/...`. |
| 5 | `HESTIA_*` environment and Compose services; hard cutover, old names not read | VERIFIED | `env.ts` reads only `HESTIA_*`. `env.test.ts` has a test that an environment with only old-prefix names is rejected naming `HESTIA_ORIGIN`, and that an old-prefix `TRUSTED_PROXIES` is ignored. The set of `HEARTH_*` identifiers on `origin/main` mapped to `HESTIA_*` equals exactly the set of `HESTIA_*` identifiers on this branch (no missed or invented names). Compose project `name: hestia`, network `hestia`, services `hestia-service`, images `hestia-service` and `hestia-caddy`, `/srv/hestia/.env`, `deploy.sh`/`deploy-gate.sh`/`generate-secrets.sh`/workflows/E2E overlay/`supabase/config.toml` `project_id = "hestia"` all renamed. |
| 6 | All unit, component, integration and E2E tests pass under the new brand | UNCERTAIN (partial re-run) | Re-ran here: `pnpm lint` (0 warnings), `format:check`, `typecheck`, `test:harness` 412 pass, matching 156, shared 172, recurrence 77, service unit 760, web 729, seed (ran), `knip` and baseline (28 rows match), `jscpd` exit 0, `audit-prod` 0 advisories, web and service builds. All totals equal the 08-07 SUMMARY. Integration (433), service coverage (1193) and E2E (104) require Supabase/Docker and were not re-run; only the SUMMARY claims them. |

**Score:** 5/6 truths verified (criterion 6 verified for everything re-runnable; integration and E2E are SUMMARY-only).

### Supporting Gate Checks

| Check | Command | Result |
|-------|---------|--------|
| No old name outside allowlist | `node scripts/check-repo-hygiene.mjs` | `repo-hygiene: clean (1034 files, 14 scripts)`, exit 0 |
| No tracked path contains the old name | `git ls-files \| grep -i hearth` | empty |
| Remaining `git grep -i hearth` hits | outside `.planning/milestones` | only `.planning/phases/`, `.planning/research/`, the guard script/test, `scripts/migration-exemptions.json`, and 4 planning state files at pinned quote lines (PROJECT, REQUIREMENTS, ROADMAP, STATE) |
| Migration gate with exemption | `node scripts/check-migrations-append-only.mjs --base origin/main` | `migrations: 0 added, nothing else changed, 2 exempt`, exit 0 |
| Migration gate is strict without the exemption | same with an empty exemptions file | exit 1, 2 problems (the rename and the schema header edit are rejected), so the exemption is the only thing admitting them |
| Role rename | `supabase/migrations/20260919060000_hestia_service_role.sql`, `docker/db/hestia-service-login.sql`, Compose `DATABASE_URL`, `deploy.sh` | consistently `hestia_service`; 12-line migration diff, `schema.sql` header comment only |
| Persisted browser keys | `persist.ts`, `push-message.ts` | `'hestia-query-cache'`, `'hestia:notification-click'` |
| Lockfile frozen install | `pnpm install --frozen-lockfile --offline` | succeeds, working tree unchanged |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/service/bin/hestia-admin` | VERIFIED | Substantive, executable, wired into package.json bin and Dockerfile |
| `scripts/migration-exemptions.json` | VERIFIED | Two entries, each pinned to from/to git blobs and paths; self-expiring |
| `scripts/check-migrations-append-only.mjs` (+test) | VERIFIED | Honors `--exemptions`; strict when none; covered in harness (412 pass) |
| `scripts/check-repo-hygiene.mjs` check 4 (+test) | VERIFIED | Content, path and per-line scan; allowlist of six whole paths plus twelve pinned quotes; tests pass |
| `docker/db/hestia-service-login.sql`, `docker/docker-compose.yml`, `docker/*.Dockerfile`, `e2e/docker-compose.e2e.yml` | VERIFIED | Renamed and cross-consistent |
| `08-OWNER-CHECKLIST.md` | VERIFIED | 17 numbered steps, PR body notes, assumptions table with owner-visible choices |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| BRAND-01 (UI copy, titles) | SATISFIED (visual check pending) | Truth 1 |
| BRAND-02 (manifest name/short_name) | SATISFIED | Truth 2 (description intentionally unchanged, per requirement text) |
| BRAND-03 (CLI) | SATISFIED | Truth 3 |
| BRAND-04 (packages) | SATISFIED | Truth 4 |
| BRAND-05 (env/Compose, hard cutover) | SATISFIED | Truth 5 |
| BRAND-06 (tests pass under new brand) | SATISFIED for unit/component/gates; integration and E2E per SUMMARY only | Truth 6 |

No orphaned requirements: BRAND-01..06 are the only IDs mapped to Phase 8.

### Anti-Patterns Found

No debt markers or stubs introduced by the rebrand were found in the verified files; knip and ESLint are clean. Two non-blocking observations:

| Item | Severity | Note |
|------|----------|------|
| `.planning/phases/` and `.planning/research/` allowlisted wholesale | Warning | Documented owner-visible choice; weaker than the line-level scan used on state files |
| Comment in `env.ts` still shows `https://<machine>.<tailnet>.ts.net` and the git remote still points at `alex-tanton/hearth` | Info | Origin change is Phase 9; remote rename is owner checklist step 11 |

### Deferred Items

None needed. The origin move, Cloudflare Tunnel, CSP/CORS (Phase 9), magic links (Phase 10) and VAPID (Phase 11) are out of scope per 08-CONTEXT.md.

### Gaps Summary

No gaps. Every rebrand deliverable is present, wired and consistent in the code, and every cheap re-runnable check passes with numbers equal to the SUMMARY claims. The status is `human_needed` rather than `passed` because (a) visual confirmation in a real browser and the iOS/home-screen name were never done, (b) integration and E2E results are only claimed, not reproduced here, and (c) the merge depends on the owner's host steps (new env file, runner label, stopping the old stack) that no code can perform.

---

_Verified: 2026-10-26_
_Verifier: Claude (gsd-verifier)_
