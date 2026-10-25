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
| 08-XX-XX | TBD | TBD | BRAND-01 | — | N/A | component + guard | `pnpm --filter @hestia/web test`; `node scripts/check-repo-hygiene.mjs` | ✅ / ❌ W0 | ⬜ pending |
| 08-XX-XX | TBD | TBD | BRAND-02 | — | N/A | build check | `pnpm --filter @hestia/web build` (runs `check-build.mjs`) | ❌ W0 | ⬜ pending |
| 08-XX-XX | TBD | TBD | BRAND-03 | — | N/A | unit + e2e | `pnpm --filter @hestia/service test`; `sh -n apps/service/bin/hestia-admin` | ✅ | ⬜ pending |
| 08-XX-XX | TBD | TBD | BRAND-04 | — | N/A | install + static | `pnpm install --frozen-lockfile`; `pnpm typecheck`; `pnpm build` | ✅ | ⬜ pending |
| 08-XX-XX | TBD | TBD | BRAND-05 | env rename must not silently drop trusted proxies | old-only env rejected | unit | `pnpm --filter @hestia/service test -- env` | ❌ W0 | ⬜ pending |
| 08-XX-XX | TBD | TBD | BRAND-06 | — | N/A | full | full suite command | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-repo-hygiene.mjs` + tests — legacy-name guard with allowlist cases
- [ ] `scripts/check-migrations-append-only.mjs` + tests + `scripts/migration-exemptions.json` — content-pinned self-expiring exemption
- [ ] `apps/web/scripts/check-build.mjs` — manifest and `<title>` assertion (BRAND-02)
- [ ] `apps/service/src/env.test.ts` — old-names-only rejected; `HESTIA_TRUSTED_PROXIES` honoured
- [ ] `.planning/phases/08-full-rebrand-to-hestia/08-OWNER-CHECKLIST.md`

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
