---
phase: "08"
slug: full-rebrand-to-hestia
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-25"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (workspaces), `node --test` (root harness), Playwright 1.63.0 (E2E) |
| **Config file** | per-workspace `vitest.config.ts`; `apps/web/vite.config.ts` test block; `e2e/playwright.config.ts` |
| **Quick run command** | `node --test scripts/check-repo-hygiene.test.mjs scripts/check-migrations-append-only.test.mjs` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build && pnpm test:integration && pnpm test:e2e`, plus `pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `node scripts/check-repo-hygiene.mjs`, `node scripts/check-migrations-append-only.mjs --base origin/main` |
| **Estimated runtime** | quick ~3 s; full suite ~15 min (E2E ~9 min, needs the sandbox CA workaround from CLAUDE.md) |

---

## Sampling Rate

- **After every task commit:** quick run command, the touched workspace's `test` and `typecheck`, and `git grep -n -i hearth -- . ':!.planning' ':!pnpm-lock.yaml'` (count must only decrease; zero at the end)
- **After every plan wave:** `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build`
- **Before `/gsd-verify-work`:** full suite green, including integration and E2E (104 passed expected)
- **Max feedback latency:** 120 seconds (excluding E2E)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | BRAND-05, BRAND-06 (D-05, D-06) | T-08-01, T-08-02, T-08-03 | exemption pinned to both blobs; role keeps NOINHERIT, exact memberships, no own privileges | harness + gate on real history + integration | `node scripts/check-migrations-append-only.mjs --base origin/main`; `node --test scripts/check-migrations-append-only.test.mjs`; policies and API integration files on a fresh `supabase start` | ❌ W0 (3 cases written in the task, RED first) | ⬜ pending |
| 08-01-02 | 01 | 1 | D-06 | T-08-04 | malformed or invalid exemptions exit 2, never pass | harness | `node --test scripts/check-migrations-append-only.test.mjs` | ❌ W0 (7 cases written in the task) | ⬜ pending |
| 08-02-01 | 02 | 2 | BRAND-04 | T-08-06, T-08-07, T-08-08 | lockfile diff is six lines; service bundle self-contained | install + static + build | `pnpm install --frozen-lockfile --offline`; `pnpm typecheck`; `pnpm --filter @hestia/service build`; `pnpm --filter @hestia/web build` | ✅ | ⬜ pending |
| 08-02-02 | 02 | 2 | BRAND-04, BRAND-06 | — | N/A | full unit + gates | `pnpm lint`; `pnpm format:check`; `pnpm knip`; `node scripts/check-knip-baseline.mjs`; `pnpm jscpd`; `pnpm test` | ✅ | ⬜ pending |
| 08-03-01 | 03 | 3 | BRAND-05 (D-01, D-02) | T-08-09, T-08-10, T-08-11 | old-only env rejected; old trusted-proxies name ignored | unit + compose config + CLI bundle | `pnpm --filter @hestia/service exec vitest run src/env.test.ts`; `docker compose ... config` (base and overlay) | ❌ W0 (3 cases written in the task, RED first) | ⬜ pending |
| 08-03-02 | 03 | 3 | BRAND-05 (D-03, D-12) | T-08-12, T-08-13 | only the runner label changes in deploy.yml | compose config + harness | `docker compose ... config` (one merged network); `node --test scripts/deploy.test.mjs scripts/deploy-gate.test.mjs scripts/ci-prepull-images.test.mjs`; `pnpm --filter @hestia/e2e test` | ✅ | ⬜ pending |
| 08-04-01 | 04 | 4 | BRAND-01, BRAND-02 (D-10) | T-08-17 | N/A | build check + component | `pnpm --filter @hestia/web build` (`check-build.mjs` check 3, mutation-proven) | ❌ W0 (check 3 written in the task) | ⬜ pending |
| 08-04-02 | 04 | 4 | BRAND-03 (D-07) | T-08-16 | wrapper keeps mode 100755 | unit + wrapper run | `pnpm --filter @hestia/service exec vitest run src/cli.test.ts`; `apps/service/bin/hestia-admin` | ✅ | ⬜ pending |
| 08-04-03 | 04 | 4 | BRAND-01 (D-08) | T-08-14, T-08-15 | built worker and page agree on the message type | unit + build | `pnpm --filter @hestia/web exec vitest run src/lib/offline src/lib/push src/sw.test.ts` | ✅ (one pin added, RED first) | ⬜ pending |
| 08-05-01 | 05 | 5 | BRAND-01, BRAND-06 (D-11) | T-08-18, T-08-19, T-08-21 | sweep never touches migrations, the exemptions file or planning | full unit + residual grep | `pnpm test`; residual `git grep` = 0 | ✅ | ⬜ pending |
| 08-05-02 | 05 | 5 | BRAND-05 text (D-02, D-07, D-09) | — | N/A | grep | planning-file greps in the task | ✅ | ⬜ pending |
| 08-05-03 | 05 | 5 | D-04, D-08, D-12 | T-08-20 | no secret values in the checklist | grep + `bash -n` | checklist greps; `bash -n .planning/environment/*.sh` | ❌ W0 (checklist written in the task) | ⬜ pending |
| 08-06-01 | 06 | 6 | BRAND-01 (D-13) | T-08-22, T-08-23 | allowlist exact-versus-prefix precision | harness + real tree + probe clone | `node --test scripts/check-repo-hygiene.test.mjs`; `node scripts/check-repo-hygiene.mjs` | ❌ W0 (7 cases written in the task, RED first) | ⬜ pending |
| 08-06-02 | 06 | 6 | BRAND-06 | T-08-24, T-08-25, T-08-26 | CA workaround reverted; no secret in the phase diff | full + integration + E2E | full suite; `pnpm --filter @hestia/service test:coverage` on `supabase start`; `pnpm test:e2e` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each item is written test-first inside the task that needs it (no separate Wave 0 plan; the sweep plans are strictly sequential because every token class touches shared files):

- [ ] `scripts/check-repo-hygiene.mjs` + tests — legacy-name guard with allowlist cases (08-06 Task 1; last, because it can only pass once the sweep reaches zero)
- [ ] `scripts/check-migrations-append-only.mjs` + tests + `scripts/migration-exemptions.json` — content-pinned self-expiring exemption (08-01 Tasks 1-2)
- [ ] `apps/web/scripts/check-build.mjs` — manifest and `<title>` assertion (BRAND-02; 08-04 Task 1)
- [ ] `apps/service/src/env.test.ts` — old-names-only rejected; old trusted-proxies name ignored; CLI env refuses the old origin name (08-03 Task 1)
- [ ] `.planning/phases/08-full-rebrand-to-hestia/08-OWNER-CHECKLIST.md` (08-05 Task 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Self-hosted runner label and old-stack teardown before first deploy | BRAND-05 | Host and GitHub settings sit outside the repo | Follow `08-OWNER-CHECKLIST.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
