---
phase: "09"
slug: domain-network-migration-cloudflare-tunnel-ingress
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (root harness), Vitest 5.0.1 (workspaces), Playwright 1.63.0 (E2E) |
| **Config file** | root `package.json` `test:harness` (explicit file list); `apps/service/vitest.config.ts`; `e2e/playwright.config.ts` |
| **Quick run command** | `node --test scripts/check-repo-hygiene.test.mjs scripts/caddy-entrypoint.test.mjs scripts/deploy.test.mjs scripts/ci-prepull-images.test.mjs` and `pnpm --filter @hestia/service exec vitest run src/ingress-config.test.ts` |
| **Full suite command** | `pnpm test`; `pnpm test:integration` on `supabase start`; `pnpm test:e2e` for the stack (sandbox CA workaround from CLAUDE.md) |
| **Estimated runtime** | ~30 seconds quick; ~9 minutes E2E |

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** `pnpm test`, `node scripts/check-repo-hygiene.mjs`, `pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `pnpm typecheck`
- **Before `/gsd-verify-work`:** full suite and `pnpm test:e2e` green
- **Max feedback latency:** 60 seconds for per-task sampling (the quick run command and the touched workspace's tests). Only the steps in "Long-running verification steps" may exceed it.

## Long-running verification steps

Each of these is the only way to prove its requirement on a real stack, so it exceeds the per-task latency target by design. Each is a single labelled `<automated>` command, so it cannot be skipped without its task failing. Per-commit sampling never waits on them.

| Step | Plan task | Why it is slow | Approx. time | What only it proves |
|------|-----------|----------------|--------------|---------------------|
| Tracer E2E (spec 20 only) | 09-01-01 (end of its one automated command) | builds both images with the sandbox CA workaround and brings up the Compose stack | ~6 min | the Caddy trust rule on the real stack: `CF-Connecting-IP` honoured from the trusted subnet, `X-Forwarded-For` ignored, CSP and no CORS/cookie headers (NET-03, NET-04) |
| CI mirror plus integration | 09-05-02 (its one automated command) | every CI gate, `supabase start`, `pnpm test:integration` and the service coverage run | several minutes | the whole phase leaves every CI job green |
| E2E proof (full suite) | 09-05-03 (its one automated command) | builds both images and runs all Playwright specs | ~9 min | no regression anywhere on the stack with no published Caddy port and the tunnel excluded; the passed count matches CLAUDE.md (107) |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | NET-01, NET-03, NET-04 (D-04, D-05, D-06, D-09) | T-09-01, T-09-06, T-09-07 | client chosen only from `CF-Connecting-IP` via the trusted subnet; spoofed `X-Forwarded-For` never the client; CA workaround reverted | containerised `caddy adapt` + E2E (long-running, labelled) | `caddy adapt` in `caddy:2.11.7-alpine`; `pnpm --filter @hestia/e2e exec playwright test tests/20-ingress-client-ip-and-csp.spec.ts` inside the apply-and-revert command | ❌ W0 (spec 20 written in the task) | ⬜ pending |
| 09-01-02 | 01 | 1 | NET-02, NET-05 (D-01, D-02, D-03, D-07, D-08) | T-09-02, T-09-04, T-09-05 | empty token stops Compose; token never on a command line; non-root pinned image; E2E excludes the connector | script runs + compose config | `generate-secrets.sh` into temp files; `docker compose ... config` (base, empty token, merged E2E); `docker image inspect` user | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | NET-02, NET-03, NET-04, NET-05 (D-01 to D-09) | T-09-01, T-09-03, T-09-06 | every pinned ingress value fails CI when it drifts (two mutation probes) | vitest static | `pnpm --filter @hestia/service exec vitest run src/ingress-config.test.ts` | ❌ W0 (eight tests written in the task) | ⬜ pending |
| 09-02-01 | 02 | 2 | NET-01, NET-02 (planner decision 2) | T-09-08, T-09-11, T-09-12 | health gate works with no host port; bad token fails before anything restarts | harness | `node --test scripts/deploy.test.mjs scripts/ci-prepull-images.test.mjs` | ❌ W0 (3 cases written in the task, RED first) | ⬜ pending |
| 09-02-02 | 02 | 2 | NET-03, NET-04 (D-08, D-09) | T-09-09, T-09-10 | empty trust list and non-https origin refused before Caddy starts; production origin yields `wss://hestia.aberrance.app` | harness + real-image probe | `node --test scripts/caddy-entrypoint.test.mjs`; `pnpm test:harness`; entrypoint plus `caddy adapt` shim in `caddy:2.11.7-alpine` | ❌ W0 (4 cases written in the task, RED first) | ⬜ pending |
| 09-03-01 | 03 | 2 | NET-05 | T-09-13 | literal-only change (7/7 lines) | unit + component | `pnpm --filter @hestia/service test`; Settings and scrub tests | ✅ | ⬜ pending |
| 09-03-02 | 03 | 2 | NET-05 (D-08) | T-09-13, T-09-14 | literal-only change (18/18 lines); `env.ts` validation unchanged | unit + typecheck | `pnpm --filter @hestia/service test`; `pnpm --filter @hestia/service typecheck` | ✅ | ⬜ pending |
| 09-04-01 | 04 | 3 | NET-01, NET-02, NET-05 (D-07, D-10, D-11) | T-09-15, T-09-16, T-09-17, T-09-18, T-09-19 | no token value or token-shaped string in docs or checklist; route target named exactly | grep + doc checkers | required-fact greps; docs-claims (misses=0 for `docs/deployment.md`); doc links | ❌ W0 (checklist and allow TSV written in the task) | ⬜ pending |
| 09-04-02 | 04 | 3 | NET-01, NET-04 (D-10) | — | N/A | grep + doc checkers | retired-ingress grep over all docs, README, CONTRIBUTING, CLAUDE.md; docs-claims (only the four pre-existing misses); doc links | ✅ | ⬜ pending |
| 09-05-01 | 05 | 4 | NET-01 (D-10) | T-09-20, T-09-21 | allowlist exact-versus-prefix precision; one pinned quote | harness + real tree + probe clone | `node --test scripts/check-repo-hygiene.test.mjs`; `node scripts/check-repo-hygiene.mjs`; probe clone with three probes | ❌ W0 (5 cases written in the task, RED first) | ⬜ pending |
| 09-05-02 | 05 | 4 | NET-01 to NET-05 | T-09-23 | no secret or tunnel token in the phase diff | full CI mirror + integration (long-running, labelled) | every CI gate; doc checkers; `pnpm test:integration` and service coverage on `supabase start`; audit recorded, not gating | ✅ | ⬜ pending |
| 09-05-03 | 05 | 4 | NET-02, NET-03, NET-04 | T-09-22, T-09-24 | CA workaround reverted; nothing committed | E2E proof (long-running, labelled) | `pnpm test:e2e` inside the apply-and-revert command; count equals CLAUDE.md's | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

Each item is written test-first inside the task that needs it; there is no separate Wave 0 plan. 09-01 runs alone in wave 1 (it installs the workspace and runs the tracer E2E). 09-02 and 09-03 share wave 2 because they touch disjoint files: 09-02 shell scripts, harness `.mjs` and `package.json`; 09-03 string literals under `apps/` and `packages/`. 09-04 follows them. The guard in 09-05 runs last, because it can only pass once every mention is gone.

- [ ] `pnpm install --frozen-lockfile` — this checkout has no `node_modules` (09-01 Task 1, step 0)
- [ ] `e2e/tests/20-ingress-client-ip-and-csp.spec.ts` — client IP and CSP, three tests; the member-removal journey renamed to `21-remove-member.spec.ts` (09-01 Task 1)
- [ ] `apps/service/src/ingress-config.test.ts` — eight static tests with two mutation probes (09-01 Task 3)
- [ ] New cases in `scripts/deploy.test.mjs` (health gate inside the caddy container, tunnel in the fail-early start) and `scripts/ci-prepull-images.test.mjs` (tunnel image never pulled) (09-02 Task 1)
- [ ] `scripts/caddy-entrypoint.test.mjs`, added to the root `test:harness` list right after `scripts/deploy.test.mjs` (09-02 Task 2)
- [ ] New retired-ingress cases in `scripts/check-repo-hygiene.test.mjs` (09-05 Task 1)
- [ ] `.planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-OWNER-CHECKLIST.md` (09-04 Task 1)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live tunnel and DNS for `hestia.aberrance.app`, WebSocket upgrade through Cloudflare, browser console free of CSP violations on the real origin, real client address in the service log, `POST /auth/v1/signup` refused on the public origin, `hestia-compose up -d --wait` after the first deploy so GoTrue takes the new origin | NET-02, NET-03, NET-04, NET-05 | No Cloudflare edge is reachable from CI or the sandbox | `09-OWNER-CHECKLIST.md` steps 7-10; the `<human-check>` on 09-05 Task 3 |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for per-task sampling; the three long-running steps are labelled and listed above
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
