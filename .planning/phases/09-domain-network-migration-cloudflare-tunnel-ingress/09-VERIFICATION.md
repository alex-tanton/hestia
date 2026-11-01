---
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
verified: 2026-10-26T19:10:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .env.example
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-01-PLAN.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-01-SUMMARY.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-02-PLAN.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-02-SUMMARY.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-03-PLAN.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-03-SUMMARY.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-04-PLAN.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-04-SUMMARY.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-05-PLAN.md
  - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-05-SUMMARY.md
  - apps/service/src/ingress-config.test.ts
  - docker/Caddyfile
  - docker/caddy-entrypoint.sh
  - docker/docker-compose.yml
  - docs/deployment.md
  - e2e/docker-compose.e2e.yml
  - e2e/tests/20-ingress-client-ip-and-csp.spec.ts
  - scripts/check-repo-hygiene.mjs
  - scripts/deploy.sh
  - scripts/generate-secrets.sh
covered_digest: "v3:sha256:01e07426c7edd13e5c65815339ccf7cb7ead7279cbb5fb7da4add5f9f48842ea"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Tunnel is live: create the remotely-managed tunnel, add the route hestia.aberrance.app -> http://caddy:8080, put CLOUDFLARE_TUNNEL_TOKEN and HESTIA_ORIGIN in /srv/hestia/.env, merge, and let Deploy run (owner checklist steps 1-7)"
    expected: "cloudflared reports healthy, the Deploy run's health gate passes, and the site answers on https://hestia.aberrance.app"
    why_human: "The tunnel, token and public-hostname route exist only in the Cloudflare dashboard and the host's .env; nothing in the repo can prove the edge accepts the connector"
  - test: "WebSocket and CSP on the real origin: sync a shopping list between two devices on https://hestia.aberrance.app with the browser console open; run curl -sSI https://hestia.aberrance.app/ (checklist step 10)"
    expected: "No CSP violation in the console; Content-Security-Policy names wss://hestia.aberrance.app; no access-control-allow-origin and no set-cookie header; POST /auth/v1/signup returns 403"
    why_human: "NET-04's acceptance criterion is about the browser console on the real origin; Cloudflare proxying WebSocket upgrades through the tunnel (assumption A4) cannot be exercised locally"
  - test: "Real client IP through Cloudflare: after a request from the owner's phone on mobile data, read hestia-compose logs hestia-service (checklist step 10)"
    expected: "remoteAddress is the owner's public address, not a 172.16.238.x address"
    why_human: "Cloudflare sets CF-Connecting-IP only at its edge; locally the header was injected by hand (E2E spec 20 and an independent Caddy probe)"
  - test: "First-deploy network recreate and GoTrue origin (checklist steps 7-9)"
    expected: "Deploy log shows Network hestia Removing/Removed/Creating/Created; after hestia-compose up -d --wait the four GoTrue URL variables show https://hestia.aberrance.app; docker ps shows no published port; router has no port forwards"
    why_human: "Needs the production host, Docker Compose on the runner and the owner's router"
  - test: "Retire the old ingress on the host and reinstall the PWA on each device (checklist steps 11-12)"
    expected: "The old host-level forwarding is off; installed PWAs are reinstalled from the new origin and notifications re-enabled"
    why_human: "Host and device state outside the repository"
---

# Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress) Verification Report

**Phase Goal:** Establish secure ingress for `hestia.aberrance.app` via Cloudflare Tunnel, eliminating Tailscale Funnel and port forwarding.
**Verified:** 2026-10-26T19:10:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

Everything that can be proven from the repository and the local Docker daemon is verified. No gap, no blocker. The remaining items can only be proven against the live Cloudflare edge and are listed under Human Verification Required, as the owner checklist (`09-OWNER-CHECKLIST.md`) already lists them.

## Goal Achievement

### Observable Truths

ROADMAP Success Criteria (the contract) first, then the plan must-haves that add detail.

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | Tailscale Funnel dependencies, host-loopback proxy requirements and Funnel documentation are removed | ✓ VERIFIED | `git grep -niE "tailscale\|funnel\|ts\.net\|HOST_GATEWAY\|E2E_GATEWAY"` outside `.planning/` hits only the pinned English verb in `packages/recurrence/src/occurrence.ts:12` and the guard script/tests that name the terms on purpose. No tracked path contains either term. `node scripts/check-repo-hygiene.mjs` prints `repo-hygiene: clean (1056 files, 14 scripts)`, exit 0. The only `ports:` keys under `docker/` and `e2e/` are the E2E overlay's two loopback publishes (`e2e/docker-compose.e2e.yml:46,86`); `docker/docker-compose.yml` has none. The remaining `127.0.0.1:8080` strings are in-container health probes (`wget` inside caddy), not host ports. |
| SC2 | `cloudflared` is integrated in Compose to route `hestia.aberrance.app` to Caddy with zero open router ports | ✓ VERIFIED | `docker/docker-compose.yml:260-277`: `cloudflare/cloudflared:2026.10.3`, `command: [tunnel, run]`, `TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN:?set in .env}` (never on a command line), `restart: unless-stopped`, shared `logging` anchor, `hestia` network, exec-form `cloudflared tunnel ready` healthcheck. No credentials file, `config.yml` or profile on the production service (D-01, D-02). Compose refuses a blank token (`docker compose config` with an empty token fails on required variables). No service publishes a port. Route target `http://caddy:8080` is dashboard-side (D-01) and is in the runbook. |
| SC3 | `docker/Caddyfile` trusts only the Compose subnet cloudflared connects from and resolves the client via `CF-Connecting-IP` alone | ✓ VERIFIED | Caddyfile global block: `trusted_proxies static {$HESTIA_TRUSTED_PROXIES}`, `trusted_proxies_strict`, `client_ip_headers CF-Connecting-IP`; no other client header. Compose passes `HESTIA_TRUSTED_PROXIES: *subnet` (`172.16.238.0/24`, same anchor as `KONG_TRUSTED_IPS` and the service). Both `reverse_proxy` blocks keep `header_up X-Forwarded-For {client_ip}`. **Behavior proven independently** with the real `caddy:2.11.7-alpine` and the committed global block (a probe that answers `{client_ip}`): trusted peer + `CF-Connecting-IP` + a spoofed `X-Forwarded-For` returned the CF address; trusted peer with `X-Forwarded-For` only returned the connection address; an untrusted peer sending `CF-Connecting-IP` returned its connection address. `docker/caddy-entrypoint.sh` additionally refuses to start with an empty trust list (`scripts/caddy-entrypoint.test.mjs`, passing). |
| SC4 | CSP `connect-src 'self' wss://hestia.aberrance.app` derives from the origin; tests pin that no CORS or cookie surface exists | ✓ VERIFIED (live-origin console check is a human item) | Caddyfile CSP uses `wss://{$HESTIA_HOST}`; the entrypoint derives `HESTIA_HOST` from `HESTIA_ORIGIN` (test asserts `HESTIA_HOST=hestia.aberrance.app`, trailing slash dropped, non-https refused). GoTrue `API_EXTERNAL_URL`, `GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`, `GOTRUE_JWT_ISSUER` all derive from `${HESTIA_ORIGIN}` (compose lines 73-84). `apps/service/src/ingress-config.test.ts` ("has no CORS or cookie surface") asserts no `access-control-*` or `set-cookie` in the Caddyfile and no `@fastify/cors` or `@fastify/cookie` dependency; E2E spec 20 test 3 asserts the response headers. |
| SC5 | Base origin across all services points to `https://hestia.aberrance.app` | ✓ VERIFIED | `.env.example`: `HESTIA_ORIGIN=https://hestia.aberrance.app` (pinned by `ingress-config.test.ts`); `apps/service/src/env.ts:17` comment names it, and `HESTIA_ORIGIN` is still required with no code default (D-08); invite/reset-link tests (`fake-app.ts` `TEST_ORIGIN`, `invites.test.ts`, `cli.test.ts`, `settings.test.tsx`, `scrub.test.ts`) and push/UA tests use the new origin. Caddy, GoTrue and `hestia-service` all take `${HESTIA_ORIGIN}`. `docs/deployment.md` "Pinned names" is rewritten with the one-way warning. |
| P1 | Downstream receives exactly one address and the service logs it as `remoteAddress` (D-06) | ✓ VERIFIED | Two `header_up X-Forwarded-For {client_ip}` (asserted by the static test); E2E spec 20 reads `req.remoteAddress` from service logs. |
| P2 | `deploy.sh` works with no published port (health gate inside caddy, tunnel in the fail-early start, whole-project prepare for the network recreate) | ✓ VERIFIED | `scripts/deploy.sh`: `compose exec -T caddy wget … http://127.0.0.1:8080/api/health`, `up --no-start --no-recreate --no-build` prepare, `cloudflared` in the supporting-services start. `scripts/deploy.test.mjs` passes (57/57 across the four harness files run). 09-02 SUMMARY records the disposable-stack network probe. |
| P3 | E2E never starts `cloudflared`; E2E overlay trusts the run subnet; CI pre-pull skips the tunnel image | ✓ VERIFIED | Overlay `cloudflared: profiles: [e2e-excluded]`, `HESTIA_TRUSTED_PROXIES: ${HESTIA_E2E_SUBNET:?}`; the only placeholder token is `e2e-not-a-real-token` in `e2e/setup/stack.ts`; `ci-prepull-images.test.mjs` passes. |
| P4 | Retired-ingress guard in the hygiene gate; docs and owner checklist complete | ✓ VERIFIED | `scripts/check-repo-hygiene.mjs` check 5 plus `check-repo-hygiene.test.mjs` (passing); `docs/deployment.md` has `## Cloudflare Tunnel`, `### The first deploy on the tunnel ingress`, token rotation; `09-OWNER-CHECKLIST.md` has 14 ordered steps, PR notes and the choices table and no token value. |

**Score:** 5/5 roadmap success criteria verified (all plan truths verified); 0 present-but-behavior-unverified.

### Prohibitions

| Prohibition | Status | Evidence |
| ----------- | ------ | -------- |
| No Cloudflare IP ranges, module, broad private ranges, or `X-Forwarded-For` fallback | ✓ HELD | Caddyfile reads `CF-Connecting-IP` only; trust list is the subnet variable only. |
| Token never on a command line, in a log, or as a real-looking value | ✓ HELD | Token only in `TUNNEL_TOKEN` env; `.env.example` is `CLOUDFLARE_TUNNEL_TOKEN=`; phase diff has no secret-shaped line. |
| No credentials file, `config.yml` or profile on the production `cloudflared` | ✓ HELD | None in `docker/`. |
| Sandbox CA workaround not committed | ✓ HELD | `git grep ca.crt -- docker .dockerignore` empty; working tree clean. |
| No new runbook or ADR file under `docs/` | ✓ HELD | Runbook is a section of `docs/deployment.md` (D-11). |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `docker/Caddyfile` | global servers block with trust list and `CF-Connecting-IP` | ✓ VERIFIED | Substantive, wired to Compose env, behavior probed. |
| `docker/docker-compose.yml` | `cloudflared` service; caddy without `ports` | ✓ VERIFIED | Present, pinned, wired. |
| `e2e/docker-compose.e2e.yml` | cloudflared excluded; Caddy trusts run subnet | ✓ VERIFIED | Contains `HESTIA_TRUSTED_PROXIES: ${HESTIA_E2E_SUBNET:?}`. |
| `e2e/tests/20-ingress-client-ip-and-csp.spec.ts` | three E2E tests | ✓ VERIFIED (not re-run here) | Three tests present; `21-remove-member.spec.ts` renumbered, `20-remove-member.spec.ts` gone. |
| `apps/service/src/ingress-config.test.ts` | eight static assertions | ✓ VERIFIED | 8 tests, all pass. |
| `docker/caddy-entrypoint.sh` + `scripts/caddy-entrypoint.test.mjs` | guards + harness test, in `test:harness` | ✓ VERIFIED | Listed in `package.json` `test:harness`; passes. |
| `scripts/deploy.sh`, `ci-prepull-images.sh`, `generate-secrets.sh` | updated | ✓ VERIFIED | Tests pass; `generate-secrets.sh` copies the token and flags a missing value. |
| `docs/deployment.md` and linked docs | Cloudflare Tunnel runbook | ✓ VERIFIED | Sections present; CLAUDE.md lists `cloudflared` image and no host port. |
| `scripts/check-repo-hygiene.mjs` | retired-ingress check | ✓ VERIFIED | Tree is clean under it. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| compose `caddy.environment.HESTIA_TRUSTED_PROXIES` | Caddyfile `trusted_proxies static` | env placeholder | WIRED | `*subnet` -> `{$HESTIA_TRUSTED_PROXIES}`; behavior probed. |
| `e2e/setup/stack.ts` | compose `${CLOUDFLARE_TUNNEL_TOKEN:?}` | generated `.env` | WIRED | Placeholder token at `stack.ts:55`. |
| spec 20 | service `req.remoteAddress` | `serviceLogLines()` | WIRED | Used in the spec. |
| `package.json` `test:harness` | `caddy-entrypoint.test.mjs`, `check-repo-hygiene.test.mjs` | file list | WIRED | Both listed. |
| `deploy.sh` `healthy_within` | caddy service | `compose exec -T caddy` | WIRED | Present and test-pinned. |
| `.env.example` token comment | `docs/deployment.md` "Cloudflare Tunnel" | section name | WIRED | Section exists. |

### Data-Flow Trace (Level 4)

Not applicable: infrastructure and configuration phase with no dynamic-data rendering. The one data flow, the client address, was traced end to end: header -> Caddy `{client_ip}` -> `X-Forwarded-For` -> service `request.ip`/`remoteAddress` (E2E spec 20 and the Caddy probe).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Ingress static config pinned | `vitest run src/ingress-config.test.ts src/env.test.ts src/cli.test.ts` (apps/service) | 42 passed | ✓ PASS |
| Entrypoint, deploy, hygiene, pre-pull harness | `node --test scripts/{caddy-entrypoint,deploy,check-repo-hygiene,ci-prepull-images}.test.mjs` | 57 pass, 0 fail, 0 skipped | ✓ PASS |
| Origin-sweep suites | service invites/push/flipp (56), shared scrub (43), web settings (14) | all pass | ✓ PASS |
| Lint and format | `pnpm lint`, `pnpm format:check` | exit 0 / clean | ✓ PASS |
| Hygiene gate on the tree | `node scripts/check-repo-hygiene.mjs` | clean, exit 0 | ✓ PASS |
| Compose requires the token | `docker compose config` with an empty token | refuses on required variables | ✓ PASS |
| Real Caddy client-IP rules | probe with `caddy:2.11.7-alpine` and the committed global block (trusted peer, XFF only, untrusted peer) | CF address / connection address / connection address | ✓ PASS |
| Full Playwright suite (107 tests) | not re-run (about 10 min and a sandbox CA workaround) | 09-05 SUMMARY reports `107 passed`; relied on, not independently confirmed | ? SKIP |

### Probe Execution

SKIPPED: the plans declare no `probe-*.sh` scripts and none exist for this phase.

### Requirements Coverage

Every ID in the plan frontmatter (`requirements:` of 09-01 through 09-05) was cross-referenced with `REQUIREMENTS.md`. IDs claimed: NET-01..NET-05 (09-01 all five, 09-02 NET-01..04, 09-03 NET-05, 09-04 all five, 09-05 all five). All five are marked `[x]` in REQUIREMENTS.md, and REQUIREMENTS.md maps no other ID to Phase 9: no orphans.

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| NET-01 | 09-01, 09-02, 09-04, 09-05 | Decommission Tailscale Funnel dependencies, host-binding references and docs | ✓ SATISFIED | See SC1; hygiene guard now fails CI if they return. |
| NET-02 | 09-01, 09-02, 09-04, 09-05 | `cloudflared` in Compose, token, routes to `caddy:8080`, no router ports | ✓ SATISFIED (live route is a human item) | See SC2. |
| NET-03 | 09-01, 09-02, 09-04, 09-05 | Caddy trusts only the Compose subnet; `CF-Connecting-IP` alone | ✓ SATISFIED (real public IP is a human item) | See SC3; wording matches D-05/D-06 in REQUIREMENTS.md and ROADMAP. |
| NET-04 | 09-01, 09-02, 09-04, 09-05 | CSP derived from origin; tests pin no CORS/cookie surface | ✓ SATISFIED (live console check is a human item) | See SC4. |
| NET-05 | 09-01, 09-03, 09-04, 09-05 | Origin defaults to `https://hestia.aberrance.app`; generated links use it | ✓ SATISFIED | See SC5. |

### Owner Decisions (09-CONTEXT.md)

| Decision | Honored |
| -------- | ------- |
| D-01 token only, no credentials file | Yes |
| D-02 always in stack, required token, E2E needs no real token | Yes |
| D-03 pinned image, healthcheck, hestia network, logging anchor | Yes |
| D-04 no published port, gateway and `HESTIA_HOST_GATEWAY` removed, subnet kept, E2E publishes its own loopback port | Yes |
| D-05 / D-06 subnet-only trust, `CF-Connecting-IP` only, no XFF fallback, one downstream address | Yes (and behavior probed) |
| D-07 hard origin switch, no fallback | Yes |
| D-08 literal examples, `env.ts` still requires the variable | Yes |
| D-09 verify-and-pin for CSP/CORS/cookies, GoTrue URLs derived | Yes |
| D-10 delete every Tailscale/Funnel mention, extend hygiene guard with allowlist | Yes |
| D-11 runbook is a section of `docs/deployment.md` | Yes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (phase source files) | - | `TBD`, `FIXME`, `XXX` markers | none found | No debt markers in files changed since `73294aa`. |
| (phase diff) | - | secret-shaped values | none found | Only the E2E placeholder `e2e-not-a-real-token`. |

No stubs or hollow wiring found.

### Code Review Findings (09-REVIEW.md) Judged Against Must-Haves

0 critical, 6 warnings, 5 info. None breaks a must-have or a success criterion; they stay advisory and none is closed (`09-REVIEW-DISPOSITION.md` shows all open).

| ID | Judgement |
| -- | --------- |
| WR-01 | Real operational risk, not a must-have: the first deploy has no working automatic rollback because the previous caddy image needs `HESTIA_HOST_GATEWAY` and the removed host port. Not documented in `docs/deployment.md` (the "first deploy" section covers the recreate and recovery, not the rollback). Recovery is fix-forward. WARNING. |
| WR-02 | Messages say "nothing restarted" while the first deploy's recreate has already stopped `hestia-service` and `caddy`. The docs and checklist state this exception and its recovery, so the owner is covered. WARNING. |
| WR-03 | A deploy never recreates `cloudflared` (`--no-recreate`), so a merged image bump or token change will not apply silently. Documented ("never recreated by a deploy"; rotation and bump steps are in the checklist). NET-02 is met. WARNING. |
| WR-04 | `ingress-config.test.ts` pins the trust directive with `toContain`, so a widened list would still pass the static test. The current Caddyfile is exact and the real-Caddy probe confirms the behavior. Test-strength weakness only. WARNING. |
| WR-05 | No repo test covers an untrusted peer's `CF-Connecting-IP` being ignored. This verification closed the question by probing the real Caddy image (untrusted peer gets its connection address), so SC3 holds, but the property has no regression test. WARNING. |
| WR-06 | `deploy.test.mjs` covers only the happy path of the new sequencing; the fail-early and rollback branches are unpinned. WARNING. |
| IN-01..05 | Informational (token preflight message, `ts.net` substring match, entrypoint input edge cases, production hostname as a test fixture, whole-/24 trust). No effect on must-haves. |

## Human Verification Required

Items that only the live Cloudflare edge or the production host can prove. These are the owner checklist's steps, not gaps.

### 1. Tunnel is live and the site answers

**Test:** Owner checklist steps 1-7: create the tunnel, add the route `hestia.aberrance.app` -> `http://caddy:8080`, set `CLOUDFLARE_TUNNEL_TOKEN` and `HESTIA_ORIGIN` in `/srv/hestia/.env`, merge, let Deploy run.
**Expected:** `cloudflared` healthy, health gate passes, site loads on `https://hestia.aberrance.app`.
**Why human:** The tunnel, token and route exist only in the Cloudflare dashboard and the host.

### 2. WebSocket and CSP on the real origin (NET-04 acceptance)

**Test:** Sync a list between two devices on the real origin with the console open; `curl -sSI https://hestia.aberrance.app/`; `POST /auth/v1/signup`.
**Expected:** No CSP violations; CSP names `wss://hestia.aberrance.app`; no `access-control-allow-origin` or `set-cookie`; signup returns 403.
**Why human:** Needs Cloudflare proxying WebSocket upgrades (assumption A4) and a real browser.

### 3. Real client IP (NET-03 acceptance)

**Test:** Request from a phone on mobile data; read `hestia-compose logs hestia-service`.
**Expected:** `remoteAddress` is the public address, not `172.16.238.x`.
**Why human:** Cloudflare sets `CF-Connecting-IP` only at its edge.

### 4. First-deploy recreate, GoTrue origin, no published port

**Test:** Checklist steps 7-9 (network log lines, `hestia-compose up -d --wait`, the four GoTrue URLs, `docker ps` shows no `->`).
**Expected:** As stated in the checklist.
**Why human:** Production host and router.

### 5. Retire the old ingress and reinstall PWAs

**Test:** Checklist steps 11-12.
**Expected:** Old host forwarding off; PWAs reinstalled and notifications re-enabled.
**Why human:** Host and device state outside the repo.

## Gaps Summary

No gaps. All five roadmap success criteria and all five requirements (NET-01..NET-05) are satisfied in the codebase, each owner decision (D-01..D-11) is honored, and the verifiable behavior (static config, entrypoint guards, deploy sequencing, hygiene guard, origin sweep, and the Caddy client-IP trust rules on the real image) passes when run here. The status is `human_needed` solely because the live-edge checks above cannot run from the repository.

Two items to carry forward, neither blocking: the full 107-test Playwright run is taken from the 09-05 SUMMARY and was not re-run in this verification, and the review warnings WR-01 (no working automatic rollback on the first tunnel deploy, undocumented) and WR-04..06 (weak or missing regression pins) remain open.

---

_Verified: 2026-10-26T19:10:00Z_
_Verifier: Claude (gsd-verifier)_
