# Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress) - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace Tailscale Funnel with Cloudflare Tunnel as the only ingress for `https://hestia.aberrance.app`: add a `cloudflared` service to Docker Compose that routes to Caddy, make Caddy resolve the real client IP from `CF-Connecting-IP`, remove every Tailscale/Funnel dependency and reference, and point the pinned origin (and everything derived from it: CSP, GoTrue URLs, invite and reset links) at the new hostname (NET-01..NET-05).

Out of scope: magic links and SMTP (Phase 10), VAPID subject, device push verification and Cloudflare edge caching/WAF rules (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### cloudflared service
- **D-01:** Remotely-managed tunnel, token only. One `CLOUDFLARE_TUNNEL_TOKEN` in `/srv/hestia/.env`; the public hostname route (`hestia.aberrance.app` -> `http://caddy:8080`) is configured in the Cloudflare dashboard. No credentials file or `config.yml` in the repo. — **Reversibility:** reversible — switching to a locally-managed config later only changes one Compose service and the runbook.
- **D-02:** `cloudflared` is always part of the Compose stack, and the token is required: `${CLOUDFLARE_TUNNEL_TOKEN:?set in .env}`, like the VAPID keys. No Compose profile. The token is added to `.env.example` and handled by `scripts/generate-secrets.sh` (it cannot be generated, so it is copied from the environment or flagged as to-set, like `HESTIA_ORIGIN`). The E2E overlay (`e2e/docker-compose.e2e.yml`) must not need a real token (override or disable the service there).
- **D-03:** Pin the `cloudflared` image by version tag like the other images in `docker/docker-compose.yml`, give it a healthcheck, and keep it on the `hestia` network with the same logging anchor.

### Caddy trust and client IP
- **D-04:** Remove the published port `127.0.0.1:8080:8080`. The stack publishes no host ports; cloudflared reaches `caddy:8080` over the Compose network. Operator checks use `docker compose exec`. This removes `HESTIA_HOST_GATEWAY` (Caddyfile, Compose, E2E overlay `HESTIA_E2E_GATEWAY`) and the pinned network `gateway`; the pinned subnet `172.16.238.0/24` stays because Kong (`KONG_TRUSTED_IPS`) and the service (`HESTIA_TRUSTED_PROXIES`) use it. The E2E overlay must still publish its own loopback port for Playwright.
- **D-05:** Caddy `trusted_proxies` is the Compose subnet only (the cloudflared hop). No Cloudflare IP-range list, no module, no broad private ranges. `client_ip_headers CF-Connecting-IP` only, with `trusted_proxies_strict` kept.
- **D-06:** No `X-Forwarded-For` fallback. If `CF-Connecting-IP` is absent, Caddy uses the connection address, so a request that bypasses Cloudflare cannot choose its own IP. Downstream keeps receiving exactly one address via `header_up X-Forwarded-For {client_ip}` (reverse_proxy blocks for `/api/*` and `@kong`). The E2E stack, which has no Cloudflare in front, must still resolve a deterministic client IP; the planner decides how E2E supplies it (for example by sending the header in the test client) without weakening production config.

### Origin cutover
- **D-07:** Hard switch to `https://hestia.aberrance.app` with no `ts.net` fallback and no dual-origin period. Installed PWAs and push subscriptions on the old origin are abandoned (Phase 8 D-04: no production data to preserve). `docs/deployment.md` "Pinned names" is rewritten for the new origin. — **Reversibility:** one-way — the origin is baked into installed PWAs, push subscriptions, GoTrue site URL and issued links; moving it again would orphan them.
- **D-08:** Examples and docs use the literal `HESTIA_ORIGIN=https://hestia.aberrance.app` (`.env.example`, `docs/deployment.md`, env.ts comment). `apps/service/src/env.ts` still requires the variable with no code default, so dev, tests and E2E stay explicit. `generate-secrets.sh` keeps copying it from the environment; its `<machine>` placeholder check becomes a missing-value check.
- **D-09:** NET-04 is verify-and-pin, not new code. The service has no CORS and the app keeps tokens in browser storage (no cookies), so no CORS middleware or cookie flags are invented. CSP keeps deriving `connect-src 'self' wss://{$HESTIA_HOST}` from the origin (`docker/caddy-entrypoint.sh`); add a test (Caddyfile/entrypoint level or E2E assertion) that the `hestia.aberrance.app` value is produced and that no CORS/cookie surface exists. GoTrue `API_EXTERNAL_URL`, `GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`, `GOTRUE_JWT_ISSUER` already derive from `HESTIA_ORIGIN`; confirm and keep them derived.

### Tailscale removal and runbook
- **D-10:** Delete every Tailscale/Funnel mention in live files, with no migration note: `docs/deployment.md` (prerequisites, topology, pinned names, funnel command), `docs/file-map.md`, `docker/Caddyfile` and `docker/docker-compose.yml` comments, `e2e/setup/stack.ts` and `e2e/docker-compose.e2e.yml` comments, `.env.example`, `.claude/CLAUDE.md` (stack and constraints text). Extend the hygiene guard (`scripts/check-repo-hygiene.mjs` plus its test) so `tailscale`/`funnel` cannot return, with an allowlist for `.planning/` and the v1.0 archive. The unrelated word "funnel" in `packages/recurrence/src/occurrence.ts` must not trip the guard (match the product term, or allowlist that line/path).
- **D-11:** The owner's Cloudflare steps live in a "Cloudflare Tunnel" section of `docs/deployment.md` replacing the Funnel section: create the tunnel, copy the token into `/srv/hestia/.env`, add the public hostname `hestia.aberrance.app` -> `http://caddy:8080`, deploy, verify. No separate runbook file; specs in `docs/` stay the only source of truth. Edge caching and WAF steps belong to Phase 11.

### Claude's Discretion
- Exact `cloudflared` image tag, healthcheck command, restart policy and flags (for example `tunnel --no-autoupdate run`).
- How E2E overrides or disables the `cloudflared` service and supplies the client IP header.
- Form of the NET-04 test (unit test of the entrypoint/Caddyfile output vs E2E assertion).
- Hygiene-guard regex details and allowlist shape.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` (Phase 9) — goal and 5 success criteria
- `.planning/REQUIREMENTS.md` (NET-01..NET-05) — acceptance criteria
- `.planning/PROJECT.md` — constraints (no open router ports, zero test regressions, append-only migrations)
- `.planning/research/DOMAIN-MIGRATION.md` §1 — Cloudflare Tunnel and Caddy real-IP notes (its broad private-range `trusted_proxies` and X-Forwarded-For fallback are superseded by D-05/D-06)
- `.planning/phases/08-full-rebrand-to-hestia/08-CONTEXT.md` — hard-cutover style, D-04 (no production data), D-13 (hygiene guard pattern)
- `.claude/CLAUDE.md` — conventions; `main` auto-deploys on push, so the owner must have the tunnel token in `/srv/hestia/.env` before merge

### Ingress and deployment files
- `docker/Caddyfile`, `docker/caddy-entrypoint.sh`, `docker/caddy.Dockerfile` — trusted proxies, client IP, CSP
- `docker/docker-compose.yml` — caddy `ports`, `HESTIA_HOST_GATEWAY`, network gateway, Kong/service trusted subnet
- `docker/kong.yml`, `docker/kong-entrypoint.sh` — client IP passthrough
- `e2e/docker-compose.e2e.yml`, `e2e/setup/stack.ts` — E2E overlay (own port, `HESTIA_E2E_GATEWAY`, plain HTTP)
- `scripts/deploy.sh`, `scripts/deploy-gate.sh`, `scripts/generate-secrets.sh`, `.env.example` — env handling and the deploy path
- `apps/service/src/env.ts` — `HESTIA_ORIGIN`, `HESTIA_TRUSTED_PROXIES`
- `scripts/check-repo-hygiene.mjs` and `.test.mjs` — home of the Tailscale/Funnel guard

### Docs to update
- `docs/deployment.md`, `docs/file-map.md`, `docs/architecture.md`, `docs/testing.md`, `README.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docker/caddy-entrypoint.sh`: already derives `HESTIA_HOST` from `HESTIA_ORIGIN`, so CSP `connect-src` follows the origin with no hard-coded host.
- `x-logging` anchor and `&subnet` anchor in `docker/docker-compose.yml`: reuse for the new service and the Caddy trust list.
- `scripts/check-repo-hygiene.mjs` legacy-name check (Phase 8): template for the Tailscale/Funnel guard.

### Established Patterns
- Required secrets use `${NAME:?set in .env}` in Compose and are documented by name in `.env.example`.
- Images are version-pinned; services get healthchecks and `restart: unless-stopped`.
- Client IP is resolved once in Caddy and passed as a single `X-Forwarded-For`; Kong and GoTrue trust only the pinned subnet.

### Integration Points
- Caddy `servers` block (trusted proxies, client IP header) and the caddy service `ports`/environment.
- GoTrue env block (already derived from `HESTIA_ORIGIN`).
- E2E overlay: its own published port and gateway variable must change with D-04.
- `scripts/deploy.sh` and the self-hosted deploy workflow: verify nothing depends on `127.0.0.1:8080` or `tailscale`.

</code_context>

<specifics>
## Specific Ideas

- Public hostname route target is exactly `http://caddy:8080`; zero router ports and zero published host ports.
- Owner caveat to put in the runbook and phase checklist: merging to `main` auto-deploys, so `CLOUDFLARE_TUNNEL_TOKEN` and the new `HESTIA_ORIGIN` must be in `/srv/hestia/.env` first.

</specifics>

<deferred>
## Deferred Ideas

- Cloudflare edge caching for `/assets/*` and WAF rate limiting for `/auth/v1/*` — Phase 11 (EDGE-01).
- Trusting Cloudflare's published IP ranges in Caddy as defense in depth — not needed while nothing but cloudflared can reach Caddy; revisit only if Caddy is ever published directly.

</deferred>

---

*Phase: 09-Domain & Network Migration (Cloudflare Tunnel & Ingress)*
*Context gathered: 2026-10-26*
