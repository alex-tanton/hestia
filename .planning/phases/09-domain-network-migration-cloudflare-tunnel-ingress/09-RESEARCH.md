# Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress) - Research

**Researched:** 2026-10-26
**Domain:** Docker Compose ingress (cloudflared remotely-managed tunnel), Caddy 2.11 client-IP trust, origin cutover, repo-hygiene guard
**Confidence:** HIGH (the Caddy, Compose, cloudflared-container and busybox behaviours below were each run in this session; the Cloudflare dashboard steps and `/ready` semantics are CITED or ASSUMED)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- Cloudflare edge caching for `/assets/*` and WAF rate limiting for `/auth/v1/*` — Phase 11 (EDGE-01).
- Trusting Cloudflare's published IP ranges in Caddy as defense in depth — not needed while nothing but cloudflared can reach Caddy; revisit only if Caddy is ever published directly.

Also out of scope (CONTEXT.md phase boundary): magic links and SMTP (Phase 10), VAPID subject, device push verification and Cloudflare edge caching/WAF rules (Phase 11).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NET-01 | Decommission Tailscale Funnel dependencies: no Tailscale commands, host network binding references, or Funnel docs | Complete inventory of live-file hits (see "Tailscale/Funnel inventory"); guard extension design; `deploy.sh` and `docs/development.md` also depend on the removed `127.0.0.1:8080` publish |
| NET-02 | `cloudflared` in Compose with a tunnel token, routing to `caddy:8080`, no router ports | Verified image, entrypoint, token env, healthcheck form; E2E overlay strategy; deploy.sh integration |
| NET-03 | Caddy trusts the proxy hop and takes the client IP from `CF-Connecting-IP`; downstream logs and rate limiting see the real IP | Caddy behaviour proven empirically (5 cases); Caddyfile design with env-driven subnet; E2E assertion via the service's `req.remoteAddress` log field |
| NET-04 | CSP `connect-src` (and CORS/cookie posture) correct for `hestia.aberrance.app` | Entrypoint derives `HESTIA_HOST`; verified there is no CORS or cookie surface; test design (stubbed-caddy entrypoint test + Caddyfile text pin) |
| NET-05 | Origin across web and service is `https://hestia.aberrance.app` | `HESTIA_ORIGIN` is the single source; list of every place it is literal or derived; `ts.net` test-fixture sweep; GoTrue is not recreated by `deploy.sh` (pitfall) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Source: `/home/user/hearth/.claude/CLAUDE.md` (read this session).

- Existing behaviour must not change except where fixing a documented bug; every change ships with tests; full suite and CI stay green.
- `main` is curated; every push to it runs CI and a passing run **deploys** unless only `docs/` and `.planning/` changed. Work on branches and land through pull requests per `CONTRIBUTING.md`; never force-push.
- Specs in `docs/` are the only source of truth; add no review, decision-log or ADR files there.
- Stack is fixed (pnpm, TypeScript, Fastify, React/Vite, Postgres/Supabase, Playwright). No framework migrations.
- Comments explain why, not what; no `console.*` in shipped code; a lint-suppression comment needs a `-- reason`.
- ESLint runs with `--max-warnings=0`; Prettier `singleQuote`, `printWidth: 100`. knip (zero findings) and jscpd (2% limit, test files included) gate CI's `hygiene` job.
- Tests: co-located Vitest; no real-clock reads in test files (`new Date()`/`Date.now()` banned by ESLint); root harness tests are `node --test` files that must be **listed explicitly** in the root `package.json` `test:harness` script.
- Relative imports in `apps/service` end in `.js`; named exports only.
- `.claude/CLAUDE.md` itself is a deliverable of D-10 (its stack/constraint text names Tailscale Funnel and `127.0.0.1:8080`).
- E2E in the Claude cloud sandbox needs the CA workaround documented in CLAUDE.md ("Running E2E in the Claude cloud sandbox"); the daemon IS available in this sandbox (checked), so E2E can be attempted there. Revert the workaround afterwards.

## Summary

The phase is mostly subtraction and re-wiring, not new logic. Production gains one Compose service (`cloudflared`, official image, token via environment) and loses the published `127.0.0.1:8080` port, the host-gateway trust entry, the pinned network gateway, and every Tailscale/Funnel reference. Caddy changes from "trust loopback + host gateway, read `X-Forwarded-For`" to "trust the Compose subnet, read only `CF-Connecting-IP`". All three behaviours CONTEXT.md relies on (header honoured from a trusted hop, `X-Forwarded-For` ignored, peer address used when the header is absent or the peer untrusted) were reproduced in this session against the pinned `caddy:2.11.7-alpine` image.

Four things the CONTEXT decisions do not spell out and the planner must carry: (1) **`scripts/deploy.sh` curls `http://127.0.0.1:8080/api/health`** (health gate and rollback decision) and `docs/development.md` seeds through the same address; both break the moment D-04 lands and must move to `docker compose exec`. (2) **Compose interpolates `${CLOUDFLARE_TUNNEL_TOKEN:?}` for the whole file on every invocation, even when an overlay overrides the service**, so the E2E overlay cannot "skip" the requirement by overriding; it must supply a placeholder token and exclude the service through a profile. (3) **Removing `gateway` from the network's `ipam` makes Compose recreate the network on the next `up`**, which briefly restarts every container on it (verified; data is safe). (4) **`deploy.sh` never recreates `auth`**, so GoTrue keeps the old `ts.net` site URL, allow list and issuer until the owner runs `hestia-compose up -d --wait` once; the runbook and owner checklist must say so.

The caddy `trusted_proxies` placeholder fails **silently** when its variable is empty (verified: Caddy adapts to an empty trust list, so `CF-Connecting-IP` is ignored and every client collapses to cloudflared's address). The entrypoint must guard it, and E2E (which bypasses the entrypoint) must pass the variable explicitly.

**Primary recommendation:** Implement as six small work packages in this order: (A) Compose + Caddyfile + entrypoint + E2E overlay/stack wiring, (B) `deploy.sh` and `docs/development.md` off port 8080, (C) origin literals, `.env.example`, `generate-secrets.sh`, `env.ts` comment and `ts.net` fixtures, (D) new tests (Vitest static config test, harness entrypoint test, E2E client-IP/CSP spec), (E) docs + CLAUDE.md rewrite with the owner checklist, (F) hygiene-guard extension **last**, once every mention is gone.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Public TLS termination and DNS for `hestia.aberrance.app` | CDN / Edge (Cloudflare) | — | Cloudflare edge terminates client TLS; no certs on the box (Caddy has `auto_https off`) |
| Tunnel transport (outbound-only) | Connector container (`cloudflared`) | — | Dials Cloudflare on port 7844; nothing inbound; public hostname -> `http://caddy:8080` is dashboard state |
| Real client IP resolution | Frontend server (Caddy) | API (Fastify `trustProxy`), Kong `KONG_REAL_IP_*` | Caddy resolves once from `CF-Connecting-IP` and re-emits a single `X-Forwarded-For`; downstream trusts only the pinned subnet |
| Security headers (CSP, HSTS) | Frontend server (Caddy) | — | Applied with `defer`; `connect-src` host derived from `HESTIA_ORIGIN` by the entrypoint |
| Origin used in links, GoTrue URLs | API (`env.ts` `HESTIA_ORIGIN`) | GoTrue env derived in Compose | One variable in `.env`; no code default (D-08) |
| Per-IP rate limiting | API (`@fastify/rate-limit` on `request.ip`) | GoTrue `GOTRUE_RATE_LIMIT_HEADER` | Real only when the proxy hop is trusted and spoofing is closed at Caddy |
| Health check for deploy gate | Host script (`deploy.sh`) via `docker compose exec` | — | No host port exists any more |
| Tailscale/Funnel regression guard | Repo tooling (`check-repo-hygiene.mjs`, CI `hygiene` job) | — | Same pattern as the Phase 8 legacy-name guard |

## Standard Stack

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `cloudflare/cloudflared` (Docker Hub, official publisher) | `2026.10.3` (recommended pin); `2026.10.4` is the newest, published today | Tunnel connector | Cloudflare's own image; distroless, non-root; `ENTRYPOINT ["cloudflared","--no-autoupdate"]`, `CMD ["tunnel","run"]`, `USER 65532:65532` [VERIFIED: `docker inspect` of the pulled image, this session] |
| `caddy:2.11.7-alpine` | already pinned in `docker/caddy.Dockerfile` | Ingress, CSP, client-IP resolution | Unchanged; `trusted_proxies`, `trusted_proxies_strict`, `client_ip_headers` are built in, no module needed |
| Docker Compose | v5.6.1 locally (`docker compose version`) | Stack definition | Existing |

`2026.10.4` was published 2026-10-26 11:29 UTC [VERIFIED: Docker Hub tags API]; `2026.10.3` is five days old and is the conservative pin. Either is acceptable; the planner should pick one and let it ride.

### Supporting
| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| `yaml` | 2.9.1 (already a devDependency of `apps/service`) | Parse `docker/docker-compose.yml` and the E2E overlay in a Vitest static test | Precedent: `apps/service/src/kong-routes.test.ts` parses both with `yaml` + Zod |
| `node:test` | Node 24 | Root harness test that runs `docker/caddy-entrypoint.sh` against a stub `caddy` | Precedent: `scripts/deploy.test.mjs` stubs `docker`/`supabase`/`curl` |
| Playwright | 1.63.0 (existing) | E2E assertion of client-IP header handling and CSP | `e2e/support/raw-http.ts` already sends arbitrary headers to Caddy |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Remotely-managed tunnel (D-01) | Locally-managed `config.yml` + credentials JSON | Locked out by D-01 |
| `trusted_proxies` = Compose subnet (D-05) | `trusted_proxies cloudflare` module / IP list | Locked out; module not in the stock image |
| Exec-form `cloudflared tunnel ready` healthcheck | No healthcheck | Locked out by D-03 (a healthcheck is required) |

**Installation:** no npm packages are added. The only new artifact is a container image:
```bash
docker pull cloudflare/cloudflared:2026.10.3   # CI's prepull script discovers it from docker-compose.yml
```

**Version verification:** Docker Hub tags API listed `2026.10.4` (2026-10-26), `2026.10.3` (2026-10-21), amd64 and arm64 [VERIFIED: hub.docker.com v2 API]; `docker pull cloudflare/cloudflared:2026.10.3` succeeded this session.

## Package Legitimacy Audit

No npm, PyPI or crates packages are installed by this phase, so the `package-legitimacy` seam was not run. The one new third-party artifact is a container image.

| Artifact | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|----------|----------|-----|-----------|-------------|---------|-------------|
| `cloudflare/cloudflared` | Docker Hub (publisher: Cloudflare) | long-lived; releases every 1-2 weeks (`2026.10.0` on 5 Oct ... `2026.10.4` on 26 Oct) | not queried | github.com/cloudflare/cloudflared | OK (official vendor image named in Cloudflare docs and the project's own Dockerfile) | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 Browser / installed PWA                      (public internet)
        │  https://hestia.aberrance.app  (TLS ends at Cloudflare)
        ▼
 Cloudflare edge  ── adds CF-Connecting-IP (real client), X-Forwarded-For, X-Forwarded-Proto
        │  tunnel (outbound-only from the box; port 7844 TCP/UDP)
        ▼
 ┌───────────────────────────── Compose network "hestia" 172.16.238.0/24 ─────────────────────────────┐
 │  cloudflared  ── public-hostname route (dashboard): hestia.aberrance.app -> http://caddy:8080        │
 │       │  plain HTTP, peer = cloudflared container IP (inside the trusted subnet)                    │
 │       ▼                                                                                             │
 │  caddy :8080   trusted_proxies = subnet only; client_ip_headers = CF-Connecting-IP only (strict)    │
 │       │  header absent / peer untrusted  ->  {client_ip} = connection address (never XFF)           │
 │       ├─ /api/*              ─ header_up X-Forwarded-For {client_ip} ─►  hestia-service :3000        │
 │       │                        (Fastify trustProxy = subnet; request.ip drives rate limits + logs)   │
 │       ├─ /auth/v1/* /realtime/v1/* ─ header_up X-Forwarded-For {client_ip} ─►  kong :8000 ─► auth/realtime │
 │       └─ everything else ─► static PWA from /srv (SPA fallback)                                      │
 │  no service publishes a host port                                                                    │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────┘

 Operator checks:  docker compose exec caddy wget … http://127.0.0.1:8080/api/health   (deploy.sh, runbook)
 E2E only:         Playwright ─► 127.0.0.1:<port> published by the overlay ─► caddy (peer = E2E bridge gateway,
                   inside HESTIA_E2E_SUBNET, so trusted); cloudflared excluded by profile.
```

### Recommended Project Structure (touch list)

```
docker/
├── Caddyfile                  # servers block rewritten; header comment rewritten
├── caddy-entrypoint.sh        # error text; guard HESTIA_TRUSTED_PROXIES
├── docker-compose.yml         # + cloudflared; - caddy ports/HOST_GATEWAY; - ipam gateway/&gateway
e2e/
├── docker-compose.e2e.yml     # cloudflared profile; caddy HESTIA_TRUSTED_PROXIES; drop gateway var and !override
├── setup/stack.ts             # placeholder token; drop HESTIA_E2E_GATEWAY line; comment
└── tests/                     # new ingress spec (client IP + CSP)
scripts/
├── deploy.sh                  # health check via compose exec; cloudflared in the keep-running up
├── deploy.test.mjs            # assert the new health call
├── generate-secrets.sh        # CLOUDFLARE_TUNNEL_TOKEN from env; placeholder warning
├── check-repo-hygiene.mjs     # + tailscale/funnel guard   (do LAST)
├── check-repo-hygiene.test.mjs
└── caddy-entrypoint.test.mjs  # NEW harness test (add to root package.json test:harness)
apps/service/src/
├── env.ts                     # one comment
└── ingress-config.test.ts     # NEW static test of compose/overlay/Caddyfile/.env.example
docs/ deployment.md (rewrite sections), development.md (seed command), file-map.md, testing.md (overlay text), README.md (check)
.env.example, .claude/CLAUDE.md
```

### Pattern 1: Caddy client-IP resolution (replace the `servers` block)

**What:** Trust the Compose subnet from an environment variable, read only `CF-Connecting-IP`, keep strict right-to-left parsing.
**When to use:** Production and E2E share the one Caddyfile; E2E needs a different subnet, so the subnet comes from the environment, not a literal.
**Example:**
```caddy
# Verified by running this exact block against caddy:2.11.7-alpine (see Empirical results below).
{
	auto_https off
	admin off
	servers {
		trusted_proxies static {$HESTIA_TRUSTED_PROXIES}
		trusted_proxies_strict
		client_ip_headers CF-Connecting-IP
	}
}
```
The rest of the file (CSP header, refusals, `header_up X-Forwarded-For {client_ip}` blocks, log) stays as is. Only the header comment and this block change.

**Empirical results (run this session, `caddy:2.11.7-alpine`, user-defined Docker network, `respond "{client_ip}"`):**

| Case | Peer trusted? | `CF-Connecting-IP` | `X-Forwarded-For` | Resolved `{client_ip}` |
|------|---------------|--------------------|-------------------|------------------------|
| a | yes | `203.0.113.7` | `198.51.100.9` (spoof) | `203.0.113.7` |
| b | yes | absent | `198.51.100.9` (spoof) | peer address |
| b2 | yes | absent | absent | peer address |
| c | no | `203.0.113.7` | absent | peer address |
| d | yes | `203.0.113.7, 10.9.9.9` | absent | `10.9.9.9` (strict = right-most untrusted; Cloudflare sends one value, so irrelevant in production) |
| e | n/a | n/a | n/a | `HESTIA_TRUSTED_PROXIES=""` adapts **without error** to `"trusted_proxies":{"source":"static"}` (an empty trust list) |

This matches the Caddy source behaviour [CITED: raw.githubusercontent.com/caddyserver/caddy/master/modules/caddyhttp/server.go, `determineTrustedProxy`: a trusted peer with no usable header returns the peer address] and the docs [CITED: caddyserver.com/docs/caddyfile/options].

### Pattern 2: cloudflared Compose service

**What:** Token by environment (never on a command line), metrics bound to loopback, exec-form healthcheck (the image has no shell).
**Example:**
```yaml
  cloudflared:
    image: cloudflare/cloudflared:2026.10.3
    restart: unless-stopped
    logging: *logging
    networks: [hestia]
    # The image's ENTRYPOINT already is `cloudflared --no-autoupdate` and its CMD is `tunnel run`;
    # the token is read from TUNNEL_TOKEN, so it never appears in the process list.
    command: [tunnel, run]
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN:?set in .env}
      # `cloudflared tunnel ready` reads the metrics address from here; loopback keeps it off the
      # Compose network.
      TUNNEL_METRICS: 127.0.0.1:2000
    healthcheck:
      test: [CMD, cloudflared, tunnel, ready]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```
No `depends_on: caddy`. cloudflared tolerates an unreachable origin (the edge answers 502 until Caddy is up), and a `depends_on` would make `deploy.sh`'s `up --no-deps` flow and first-start ordering harder.

### Pattern 3: Caddy service block after D-04

```yaml
    # Nothing is published: cloudflared reaches caddy:8080 over the Compose network.
    environment:
      HESTIA_ORIGIN: ${HESTIA_ORIGIN}
      # The only address allowed to name the client: the Compose subnet (cloudflared's hop).
      HESTIA_TRUSTED_PROXIES: *subnet
```
and the network:
```yaml
networks:
  hestia:
    name: hestia
    ipam:
      config:
        - subnet: *subnet
```
`&subnet` stays on `KONG_TRUSTED_IPS` (defined earlier than Caddy's use, so the alias resolves). `&gateway` and `HESTIA_HOST_GATEWAY` go.

### Pattern 4: E2E overlay after the change

```yaml
  cloudflared:
    # Never started in E2E: there is no Cloudflare in front of the loopback stack. A profile keeps
    # it out of every `up`/`config` that does not name it.
    profiles: [e2e-excluded]

  caddy:
    command: [caddy, run, --config, /etc/caddy/Caddyfile, --adapter, caddyfile]
    environment:
      HESTIA_HOST: 127.0.0.1:${HESTIA_E2E_CADDY_PORT:?}
      HESTIA_TRUSTED_PROXIES: ${HESTIA_E2E_SUBNET:?}
    ports:
      - 127.0.0.1:${HESTIA_E2E_CADDY_PORT:?}:8080
```
`ports: !override` is no longer needed because the base has no `ports`. In `e2e/setup/stack.ts`, pass `CLOUDFLARE_TUNNEL_TOKEN: 'e2e-not-a-real-token'` into the `generate-secrets.sh` environment (it is then in the run's `.env`, which satisfies Compose interpolation), and delete the `HESTIA_E2E_GATEWAY=` line from `appendRunEnv`. Keep `--gateway` in `reserveSubnet()`'s `docker network create` and the `Subnet.gateway` field; only the env-file line and the Compose reference are removed, so `run-identity.test.ts` is untouched.

**Why the E2E client IP is deterministic without changes to the test client:** Playwright reaches Caddy through the published loopback port, so Caddy's peer is the E2E bridge gateway, which lies inside `HESTIA_E2E_SUBNET` and is therefore trusted. With no `CF-Connecting-IP`, Caddy resolves the peer address (case b2 above), the same single shared address the suite has today (CONTEXT notes all E2E traffic shares one bucket; `HESTIA_RATE_LIMIT_PER_MINUTE: 3000`). No header needs to be injected globally. Header handling is exercised by one dedicated spec (below) that sends `CF-Connecting-IP` explicitly.

### Pattern 5: Hygiene guard extension (do last)

Generalise the existing legacy-name check in `scripts/check-repo-hygiene.mjs` (it already has `LEGACY_NAME`, `LEGACY_NAME_ALLOWLIST`, `LEGACY_NAME_QUOTES`, `legacyNameHits` using `git grep --cached -I -l -i -z -F -e`, `linesOutsideQuotes`) into a list of forbidden terms. Recommended terms and exemptions:

- Terms (case-insensitive, fixed-string): `tailscale`, and `funnel`. Add `ts.net` only if the fixture sweep in work package C is done (recommended; see Open Question 3).
- Path allowlist: `.planning/` (whole prefix, per D-10), this script and its test (they must spell the terms), and nothing else.
- The word "funnel" in `packages/recurrence/src/occurrence.ts` line 12 ("Both monthly and yearly recurrence funnel through here"): use the existing per-file **exact-quote** mechanism (`'funnel through here'` for that path) rather than exempting the whole file. Do not change that comment (it is production source).
- Test cases to add to `scripts/check-repo-hygiene.test.mjs`, mirroring the legacy-name cases at its line 262 onward: fails on a staged file containing `Tailscale` / `tailscale funnel` in any case (naming the path); fails on a tracked path containing the term; passes when the term is only under `.planning/`; the occurrence.ts quote passes but the same path with another `funnel` use fails. As with `OLD_NAME`, spell the terms in the test via a constant.

### Anti-Patterns to Avoid
- **Trusting broad private ranges or `X-Forwarded-For` as a fallback** (the superseded `DOMAIN-MIGRATION.md` §1.2 block): any container, or anything reaching Caddy, could then choose its own IP. CONTEXT D-05/D-06 supersede it; do not copy that block.
- **Putting the tunnel token on a command line** (`command: tunnel run --token …`, or `CLOUDFLARE_TUNNEL_TOKEN=… scripts/generate-secrets.sh` in the runbook): it shows in the process list and shell history. Use `TUNNEL_TOKEN` in the environment, and tell the owner to paste the token into the private `.env` (created `umask 077` by the script).
- **Overriding the service in the E2E overlay to "remove the requirement":** Compose still interpolates `:?` from the base file (verified, below).
- **A literal subnet in the Caddyfile:** E2E uses a different `/24` per run.
- **Running the guard before the sweep is complete:** the guard would fail CI mid-phase; add it last.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real client IP from the tunnel | A custom Caddy module, a Cloudflare IP-range fetcher, or app-level header parsing | Stock Caddy `trusted_proxies static` + `client_ip_headers` + `trusted_proxies_strict` | Behaviour proven above; D-05 forbids range lists |
| Tunnel liveness | A shell/curl healthcheck inside cloudflared | `cloudflared tunnel ready` (exec form) with `TUNNEL_METRICS` | The image is distroless; there is no `sh`, `wget` or `curl` |
| Health probe from the host | A published port, a host-side proxy, or `docker inspect` IP scraping | `docker compose exec -T caddy wget -q -T 5 -O /dev/null http://127.0.0.1:8080/api/health` | Busybox `wget` exits 1 on HTTP 5xx and on refused connections (verified) |
| Compose-file assertions in tests | A regex over YAML text | `yaml` + Zod (as `kong-routes.test.ts` does) | Anchors/aliases and merge keys are parsed correctly |
| Forbidden-term scan | A new script | Extend `check-repo-hygiene.mjs` (index-based `git grep`) | Reuses the allowlist/quote machinery and its test harness |
| Tunnel/DNS/TLS provisioning | Anything in the repo | Cloudflare dashboard + runbook steps | D-01: dashboard-managed route, no credentials file |

**Key insight:** every hard problem here (IP trust, tunnel health, TLS) already has a first-party mechanism; the work is wiring it so test and production share one Caddyfile and nothing is published.

## Runtime State Inventory

This is a migration (origin and ingress cutover), so the state outside git matters.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `auth.users` and app tables hold no origin. `push_subscription` rows carry endpoints and keys bound to the old origin; PWAs installed from the `ts.net` origin keep their IndexedDB/service worker on that origin. | None in code. D-07 abandons them (no production data to preserve). Say so in the owner checklist; no data migration task. |
| Live service config | **Cloudflare dashboard**: tunnel, token, and public-hostname route `hestia.aberrance.app -> http://caddy:8080` (and the DNS record it creates) exist only there. **GoTrue** (`auth` container) holds `API_EXTERNAL_URL`, `GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`, `GOTRUE_JWT_ISSUER` from the *old* `HESTIA_ORIGIN` until the container is recreated. | Owner creates the tunnel/route. Owner runs `hestia-compose up -d --wait` once after the first deploy so `auth` is recreated (deploy.sh never recreates it). Put in `docs/deployment.md` and the checklist. |
| OS-registered state | Tailscale on the host: `tailscaled`, and a persisted funnel config (`sudo tailscale funnel --bg …` survives reboot). No repo-managed systemd/cron/launchd entries mention it. | Owner (not repo): turn funnel off (`tailscale funnel reset`) and optionally uninstall; the docs no longer mention it (D-10 forbids a migration note), so put this in the phase owner checklist (a `.planning/` file), not in `docs/`. |
| Secrets/env vars | `/srv/hestia/.env` must gain `CLOUDFLARE_TUNNEL_TOKEN` and change `HESTIA_ORIGIN` to `https://hestia.aberrance.app` **before the merge**. A missing token makes the first `docker compose` call fail at interpolation, which `deploy.sh` reports as "build failed; nothing restarted" (safe, nothing restarts). No other variable is renamed. | Owner edits the private `.env`; docs list the new variable in the table. |
| Build artifacts / installed packages | `hestia-caddy:<sha>` and `hestia-service:<sha>` images are rebuilt per deploy; the Caddy image embeds the Caddyfile and entrypoint, so the old trust list disappears on the first deploy. No egg-info/binaries carry the old origin. | None. |

**Nothing found:** no database column, cron job, or CI secret stores the `ts.net` origin (the grep inventory below is exhaustive for tracked files).

### Tailscale/Funnel/`ts.net`/`:8080` inventory (tracked files outside `.planning/`; grep run this session)

| File | What | Action |
|------|------|--------|
| `docker/Caddyfile` lines 2, 7-14 | Funnel comments, `trusted_proxies static 127.0.0.1/32 ::1/128 {$HESTIA_HOST_GATEWAY}/32`, `client_ip_headers X-Forwarded-For` | Rewrite (Pattern 1) |
| `docker/docker-compose.yml` lines 244-251, 253, ~293-295 | `# Tailscale Funnel on the host forwards here…`, `ports: - 127.0.0.1:8080:8080`, `HESTIA_HOST_GATEWAY: &gateway 172.16.238.1`, ipam `gateway: *gateway` | Remove; add cloudflared. The in-container healthcheck on `http://127.0.0.1:8080/index.html` stays (it runs inside the container) |
| `docker/caddy-entrypoint.sh` line 9 | error text names `<machine>.<tailnet>.ts.net` | New text naming `https://hestia.aberrance.app`; add the `HESTIA_TRUSTED_PROXIES` guard |
| `scripts/deploy.sh` line 20 (+ header, step 8 wording in docs) | `health_url="http://127.0.0.1:8080/api/health"` and `curl` loop | Move to `compose exec` (Pitfall 1) |
| `.env.example` lines 8, 10 | comment and `HESTIA_ORIGIN=https://<machine>.<tailnet>.ts.net` | Literal `https://hestia.aberrance.app`; add token entry |
| `apps/service/src/env.ts` line 17 | comment `https://<machine>.<tailnet>.ts.net` | Comment only |
| `e2e/setup/stack.ts` line 50, 103 | "no Funnel in front of the E2E stack"; `HESTIA_E2E_GATEWAY` | Reword; delete the gateway env line |
| `e2e/docker-compose.e2e.yml` lines 70-72 | `HESTIA_HOST_GATEWAY: ${HESTIA_E2E_GATEWAY:?}`, `ports: !override` | Pattern 4 |
| `docs/deployment.md` | lines 6-8, 30, 58-59, 66-81, 87-88, 115, 143-151, 197, 311, 336, 345, 365, 372 | Rewrite (see work package E) |
| `docs/file-map.md` line 124 | "terminated upstream by Tailscale Funnel" | Reword to Cloudflare |
| `docs/development.md` line 117 | `HESTIA_SEED_AUTH_URL=http://127.0.0.1:8080/auth/v1` | Give a Caddy-container-IP form (below) |
| `.claude/CLAUDE.md` line 139 | ingress bullet; also the Container Images table lacks `cloudflared`, and the Configuration list lacks the token | Update |
| Test fixtures using `*.ts.net` | `packages/shared/src/scrub.test.ts` (151, 240), `apps/web/src/screens/settings/settings.test.tsx` (156), `apps/service/src/deals/flipp/flipp-deal-source.test.ts`, `request-queue.test.ts`, `services/invites.test.ts`, `test/fake-app.ts` (`TEST_ORIGIN = 'https://hestia.test.ts.net'`), `env.test.ts`, `push/web-push-transport.test.ts`, `cli.test.ts` | Optional mechanical sweep to `hestia.aberrance.app`-style hosts (Open Question 3) |
| `packages/recurrence/src/occurrence.ts` line 12 | unrelated "funnel through here" | Leave; guard exemption by exact quote |

`docs/development.md` seed command replacement (Caddy has no host port now; reach it by its container address like the `db` address is already obtained):
```sh
CADDY_IP=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
  "$(hestia-compose ps --quiet caddy)")
HESTIA_SEED_AUTH_URL=http://$CADDY_IP:8080/auth/v1 …
```
(The seed runs on the host and the container IP is routable from the host on a Linux Docker bridge; `[ASSUMED]` for non-Linux Docker Desktop, which this command already does not target since production is a Linux host.)

## Common Pitfalls

### Pitfall 1: `deploy.sh` health gate dies with the published port
**What goes wrong:** `health_url="http://127.0.0.1:8080/api/health"` plus `curl` in `healthy_within` can never succeed once `ports:` is removed, so every deploy rolls back (or fails with "no previous image") after 60 s.
**Why it happens:** CONTEXT lists `deploy.sh` only as "verify nothing depends on 127.0.0.1:8080"; it does.
**How to avoid:** replace the curl with
```bash
compose exec -T caddy wget -q -T 5 -O /dev/null http://127.0.0.1:8080/api/health
```
Verified in this session against a `caddy:2.11.7-alpine` container: exit 0 on 200, exit 1 on HTTP 503 ("server returned error"), exit 1 on connection refused. Update the header comment ("require GET /api/health through Caddy"), delete the `curl`-based loop, and extend `scripts/deploy.test.mjs` to assert that the health call is a `docker … exec -T caddy wget … /api/health` call and that no `curl` is invoked (its stub `docker` exits 0 for unrecognised calls, so the existing cases keep passing; `curl` can come off the stubbed-names list).
**Warning signs:** deploy log "GET /api/health did not succeed within 60s" on the first deploy after merge.

### Pitfall 2: Compose requires the token even when the overlay overrides the service
**What goes wrong:** E2E (and any `docker compose config`) fails with `required variable CLOUDFLARE_TUNNEL_TOKEN is missing a value`.
**Why it happens:** Interpolation runs per file before merge. Verified this session: base+overlay with `TUNNEL_TOKEN: !reset null` still errors; with the variable set and the service given `profiles: [disabled]`, `docker compose config --services` omits it.
**How to avoid:** give the E2E overlay's `cloudflared` a `profiles:` entry **and** put a placeholder `CLOUDFLARE_TUNNEL_TOKEN` in the run's generated `.env` (via `generate-secrets.sh`'s environment). `e2e/setup/stack.ts` names services explicitly (`DATA_SERVICES`, `APP_SERVICES`), so it would not start anyway, but the profile also protects `down`/`logs`/`ps` and any future unnamed `up`.
**Warning signs:** E2E bring-up fails before any container starts.

### Pitfall 3: Removing the ipam `gateway` recreates the network on the next `up`
**What goes wrong:** On a host that already runs the stack, the first `docker compose up` after this change removes and recreates the `hestia` network, which briefly stops and restarts every container attached to it (db, auth, realtime, kong, service, caddy, backup). Container IDs and volumes survive; there is a short outage and Postgres restarts.
**Why it happens:** Compose stores a config hash on the network; the ipam block is part of it. Reproduced this session (Compose v5.6.1): changing only the `gateway` line produced `Network … Creating/Created` and `Container … Starting` on the plain `up`, and again with `--no-recreate`.
**How to avoid:** D-04 explicitly removes the gateway, so accept it, but (a) note in the owner checklist that the first deploy of this change restarts the whole stack for a few seconds, (b) have the owner take a manual backup first (`hestia-compose exec -T backup /backup.sh`), which `deploy.sh` does anyway after step 3. If the owner prefers zero disturbance, keeping the literal `gateway: 172.16.238.1` line in `ipam` (without the `&gateway` anchor or any consumer) avoids it; that deviates from D-04's wording, so it needs owner confirmation (Open Question 1). `[ASSUMED]` that the host's existing network carries a hash label (any network created by Compose >= ~2.20 does).
**Warning signs:** Compose output lines `Network hestia Recreating` on the first deploy.

### Pitfall 4: GoTrue keeps the old origin after deploy
**What goes wrong:** Password-recovery and invite flows that go through GoTrue still use the `ts.net` site URL/allow list/issuer.
**Why it happens:** `docker/docker-compose.yml` derives `API_EXTERNAL_URL`, `GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`, `GOTRUE_JWT_ISSUER` from `HESTIA_ORIGIN`, but `scripts/deploy.sh` starts `db auth realtime kong backup` with `--no-recreate`, and `docs/deployment.md` states "A deploy never recreates `db`, `auth`, `realtime`, `kong`, or `backup`". The service does not verify the issuer (no `iss` handling in `apps/service/src/auth/jwt.ts`; grep found none), so JWT checks keep working, which hides the problem.
**How to avoid:** the runbook and owner checklist include `hestia-compose up -d --wait` right after the first deploy (it recreates only services whose configuration changed: `auth`, plus the network event above).
**Warning signs:** A reset link whose host or `redirect_to` is the old origin.

### Pitfall 5: An empty `HESTIA_TRUSTED_PROXIES` silently disables IP resolution
**What goes wrong:** Caddy starts fine, trusts nobody, ignores `CF-Connecting-IP`, and every visitor shares cloudflared's address, so one household's traffic can trip the per-IP rate limit for all.
**Why it happens:** Verified case e: `trusted_proxies static` with an empty expansion adapts without error.
**How to avoid:** in `docker/caddy-entrypoint.sh` add `: "${HESTIA_TRUSTED_PROXIES:?must be the Compose subnet}"`-style guard (the file uses plain `sh` with `set -eu`; a `[ -n … ]` check with an `echo … >&2; exit 1` matches the file's existing style). Production gets the value from the `*subnet` anchor; E2E gets it from the overlay and bypasses the entrypoint, so the Vitest static test must assert both files set it.

### Pitfall 6: CI's image pre-pull will fetch `cloudflared` for E2E
**What goes wrong:** `scripts/ci-prepull-images.sh` reads every `image:` line from `docker/docker-compose.yml` (excluding `^hestia-` and `^prodrigestivill/`), so CI pulls an image E2E never starts. Harmless, one extra pull, but it is exposed to Docker Hub rate limits the script exists to dodge.
**How to avoid (optional):** add `^cloudflare/` to the exclusion in the script and cover it in `scripts/ci-prepull-images.test.mjs`. Not required for correctness; the planner can defer it.

### Pitfall 7: Merge-to-deploy ordering
**What goes wrong:** Merging before the owner has put the token and new origin in `/srv/hestia/.env` triggers a deploy that fails at its first compose call (safe, nothing restarts) or, with only the origin set, deploys with no ingress.
**How to avoid:** put an explicit owner pre-merge checklist in the phase artifacts (`.planning/`, not `docs/`), mirroring Phase 8's `08-OWNER-CHECKLIST.md`, and a "before you merge" note in the `docs/deployment.md` Cloudflare Tunnel section (CONTEXT specifics).

### Pitfall 8: Deploy ordering for `cloudflared` itself
`deploy.sh` step 3 starts supporting services with `up --detach --wait --no-recreate --no-build db auth realtime kong backup`. Adding `cloudflared` there (no `depends_on`) starts it once and leaves it alone afterwards, like the others, and makes a bad token fail the deploy before anything is restarted. Its failure message currently reads "the Supabase services are not healthy; nothing restarted" and should be reworded. The alternative (start it after the health gate, non-fatal) keeps deploys independent of Cloudflare; the recommendation is the first (fail early, consistent with the doc's "ingress is part of the stack"), flagged as Open Question 2.

## Code Examples

### Entrypoint after the change (shape)
```sh
#!/bin/sh
# The CSP's connect-src names the origin's host for WebSockets; derive it from HESTIA_ORIGIN
# so .env holds the origin exactly once.
set -eu

case "${HESTIA_ORIGIN:-}" in
  https://*) ;;
  *)
    echo "HESTIA_ORIGIN must be an https origin such as https://hestia.aberrance.app (got '${HESTIA_ORIGIN:-}')" >&2
    exit 1
    ;;
esac
# An empty list is accepted by Caddy and silently stops it reading CF-Connecting-IP.
if [ -z "${HESTIA_TRUSTED_PROXIES:-}" ]; then
  echo "HESTIA_TRUSTED_PROXIES must be the Compose subnet, the only addresses allowed to name the client" >&2
  exit 1
fi
host="${HESTIA_ORIGIN#https://}"
HESTIA_HOST="${host%/}"
export HESTIA_HOST

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
```
Current file for comparison (verbatim, read this session): `echo "HESTIA_ORIGIN must be https://<machine>.<tailnet>.ts.net (got '${HESTIA_ORIGIN:-}')" >&2`, `host="${HESTIA_ORIGIN#https://}"`, `HESTIA_HOST="${host%/}"`, `exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile`.

### Harness test for the entrypoint (stub `caddy` on PATH, pattern from `scripts/deploy.test.mjs`)
```js
// scripts/caddy-entrypoint.test.mjs  (add to the root package.json test:harness list)
// Writes a stub `caddy` that prints HESTIA_HOST and its arguments, puts it first on PATH, and runs
// `sh docker/caddy-entrypoint.sh` with a made-up environment.
//   HESTIA_ORIGIN=https://hestia.aberrance.app  + HESTIA_TRUSTED_PROXIES=172.16.238.0/24
//     -> exit 0; stub saw HESTIA_HOST=hestia.aberrance.app and `run --config /etc/caddy/Caddyfile --adapter caddyfile`
//   HESTIA_ORIGIN=https://hestia.aberrance.app/ -> HESTIA_HOST has no trailing slash
//   HESTIA_ORIGIN=http://127.0.0.1:8080 or unset -> exit 1, stub never ran
//   HESTIA_TRUSTED_PROXIES unset or empty       -> exit 1, stub never ran
```
Keep the stub short: jscpd (2%, tests included) flags copy-pasted stub scaffolding from `deploy.test.mjs`.

### Vitest static config test (shape; precedent `apps/service/src/kong-routes.test.ts`)
Parse `docker/docker-compose.yml`, `e2e/docker-compose.e2e.yml` with `yaml` + Zod and read `docker/Caddyfile`, `.env.example` as text. Assert:
- no service in the base file has a `ports` key (`D-04`), and `HESTIA_HOST_GATEWAY` appears nowhere in either Compose file or the Caddyfile;
- `services.cloudflared.image` matches `^cloudflare/cloudflared:\d{4}\.\d+\.\d+$` (pinned, not `latest`), its `environment.TUNNEL_TOKEN` is exactly `${CLOUDFLARE_TUNNEL_TOKEN:?set in .env}`, it has a `healthcheck.test`, `restart: unless-stopped`, `networks` contains `hestia`, and `logging` equals the other services' (D-02, D-03);
- `services.caddy.environment.HESTIA_TRUSTED_PROXIES` equals `services.kong.environment.KONG_TRUSTED_IPS` (same `172.16.238.0/24` through the anchor) and the E2E overlay overrides it with `${HESTIA_E2E_SUBNET:?}`;
- the E2E overlay gives `cloudflared` a `profiles` entry and publishes only `caddy` and `db` ports;
- the Caddyfile's `servers` block has `trusted_proxies static {$HESTIA_TRUSTED_PROXIES}`, `trusted_proxies_strict`, exactly one `client_ip_headers` line whose value is `CF-Connecting-IP`, and the CSP line contains `connect-src 'self' wss://{$HESTIA_HOST}` (D-05, D-06, D-09);
- no `Access-Control-` header and no `Set-Cookie`/`cookie` directive in the Caddyfile, and `apps/service/package.json` has no `@fastify/cors` or `@fastify/cookie` dependency (D-09; the grep this session found no CORS or cookie code in `apps/service/src`, `apps/web/src` or `docker/`);
- `.env.example` has `HESTIA_ORIGIN=https://hestia.aberrance.app` and a `CLOUDFLARE_TUNNEL_TOKEN=` line.

### E2E spec for client IP and CSP (new file)
Uses `rawRequest` (already sends arbitrary headers to Caddy) and `serviceLogLines()` (already reads the service's pino log; E2E runs it at `LOG_LEVEL: info`).
1. `GET /api/health` with `CF-Connecting-IP: 203.0.113.7` and a spoof `X-Forwarded-For: 198.51.100.9`; then assert a service log line whose `req.url` is `/api/health` has `req.remoteAddress === '203.0.113.7'`. The serializer is in `apps/service/src/app.ts` (read this session): `req: (request: FastifyRequest) => ({ method: request.method, url: pathOnly(request.url), remoteAddress: request.ip, })`. Use a distinctive IP per run so other traffic cannot satisfy it.
2. Same request with only `X-Forwarded-For` (no `CF-Connecting-IP`): assert the logged `remoteAddress` is not `198.51.100.9` (D-06).
3. `GET /` and assert the `Content-Security-Policy` response header contains `connect-src 'self' wss://127.0.0.1:<port>` for the E2E host (production value is covered by the entrypoint test).
`rawRequest` currently issues a POST-shaped call (`method` is a parameter but it always writes a `{}` body); a GET with a body is tolerated by Caddy but the planner may prefer `fetch`/Playwright `request` for the GET cases.
Numbering: the suite's documented rule (`docs/testing.md`) keeps `20-remove-member.spec.ts` last, so a new journey is numbered after the last non-removal file and the removal file is renumbered; the lower-churn alternative is adding these tests to `08-caddy-refuses-gotrue-endpoints.spec.ts` (also about Caddy behaviour). Planner's call.

### `generate-secrets.sh` changes
Add `CLOUDFLARE_TUNNEL_TOKEN` to `fromEnvironment`; `.env.example` carries `CLOUDFLARE_TUNNEL_TOKEN=<from the Cloudflare dashboard>`; replace the final warning regex (current text, read this session: `if grep -Eq '^HESTIA_ORIGIN=.*<machine>|^HESTIA_OWNER_EMAIL=owner@example\.com$' "$out"; then`) with a missing-value check: warn when `HESTIA_ORIGIN=` is empty, `HESTIA_OWNER_EMAIL=owner@example.com`, or `CLOUDFLARE_TUNNEL_TOKEN=<…>` is still the placeholder, and update the message ("now set …"). Note `HESTIA_ORIGIN` already ships as the literal in `.env.example`, so there is nothing to set for it in the common case.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailscale Funnel to `127.0.0.1:8080`, Caddy trusts the host gateway | Remotely-managed Cloudflare Tunnel, Caddy trusts the Compose subnet and reads `CF-Connecting-IP` | This phase | No published ports; client IP does not depend on Docker's port-publish NAT address |
| `cloudflared` locally-managed (`config.yml`, credentials JSON) | Remotely-managed with `TUNNEL_TOKEN`; route configured in the dashboard | Cloudflare's current default flow [CITED: developers.cloudflare.com/.../create-remote-tunnel] | Nothing to commit; token is the only secret |
| `cloudflared` autoupdate | Image ENTRYPOINT already passes `--no-autoupdate`; versions pinned and bumped deliberately | image Dockerfile (master) | Don't repeat the flag |

**Deprecated/outdated:**
- `.planning/research/DOMAIN-MIGRATION.md` §1.2 `trusted_proxies` block (broad private ranges + XFF fallback): superseded by D-05/D-06.
- Dashboard wording drifts: the current docs call the route a **"Published application"** under **Networking > Tunnels > Routes** [CITED: create-remote-tunnel page]; older material says "Public Hostname". The runbook should use the current names and avoid pixel-level instructions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cloudflared` `/ready` returns 200 only while at least one edge connection is active and 503 otherwise (source: third-party descriptions; the cloudflared source for the metrics package was not fetched; could not exercise the tunnel in this sandbox because edge DNS lookups fail) | Pattern 2 | Healthcheck would mark a healthy tunnel unhealthy or vice versa; consequence is only a `docker ps` status and `up --wait` outcome. Planner should schedule a first-deploy check on the real host |
| A2 | `/ready` can read 200 while the public hostname fails (cloudflared issue #1772 reports this with HTTP/2) | Pattern 2 / Validation | Healthcheck is a local signal, not an end-to-end one; keep the manual "browse to the hostname" step in the runbook |
| A3 | The Cloudflare dashboard creates the proxied DNS CNAME automatically when a published-application route is added (the fetched page did not state it) | Runtime State Inventory, D-11 runbook | Runbook would omit a manual DNS step; the owner would see a hostname that does not resolve |
| A4 | Cloudflare proxies WebSocket upgrades through a tunnel without extra configuration (Realtime path `wss://hestia.aberrance.app/realtime/v1`) | Architecture | Realtime list sync fails in production only; E2E cannot see it. Add a manual verification step to the owner checklist; Phase 11 covers device checks |
| A5 | The production host's existing `hestia` network carries a Compose config-hash label, so removing `gateway` triggers the one-time recreate seen in the local reproduction | Pitfall 3 | Either a harmless no-op (if the host runs an older Compose) or the brief outage described |
| A6 | Container-IP access from the host works for `docs/development.md`'s Caddy seeding command on a Linux Docker bridge | Inventory | Dev-only doc command; the existing `db` address trick already relies on it |
| A7 | `docker compose exec` is permitted for the deploy runner's user (it is in the `docker` group per `docs/deployment.md`) | Pitfall 1 | `deploy.sh` already uses `compose exec -T backup` and `compose exec -T db`, so this is low risk |
| A8 | Dependabot's `docker` ecosystem (`directories: ['/docker']` in `.github/dependabot.yml`) may not bump image tags inside `docker-compose.yml`; the existing Supabase/Kong tags have the same property | State of the Art | `cloudflared` pin goes stale unless bumped by hand; not a blocker |

## Open Questions

1. **Keep the ipam `gateway` line to avoid a network recreate, or honour D-04 literally?**
   - What we know: D-04 says remove the pinned network gateway. Removing it recreates the network on a live host (reproduced locally), causing a brief whole-stack restart on the first deploy.
   - What's unclear: whether the owner minds a few seconds of downtime on a household app with no production data (D-07 says there is none to preserve).
   - Recommendation: implement D-04 as written, state the restart in the owner checklist; fall back to keeping the literal line only if the owner objects.

2. **Should `cloudflared` be part of `deploy.sh`'s fail-early `up --wait` set?**
   - What we know: with no `depends_on` it can join `db auth realtime kong backup`; a bad or revoked token then blocks deploys with "nothing restarted".
   - What's unclear: whether the owner wants a Cloudflare problem to block an app fix.
   - Recommendation: include it (consistent with D-02, "always part of the stack"); reword the failure message; the alternative is a non-fatal start after the health gate.

3. **Sweep the `*.ts.net` test fixtures and add `ts.net` to the guard?**
   - What we know: D-10 names `tailscale`/`funnel`; `.ts.net` hosts appear in about a dozen test files as made-up origins and in `fake-app.ts` (`TEST_ORIGIN`).
   - What's unclear: whether the owner counts these as "Tailscale mentions".
   - Recommendation: do the mechanical sweep (zero behavioural effect; the tests assert round-tripping, not the TLD) and include `ts.net` in the guard so no `tailnet` leftovers survive; if skipped, leave `ts.net` out of the guard.

4. **E2E spec placement and numbering** (new `20-…` with a rename of the removal journey, or extend spec 08). Planner decision; see the E2E section.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine + Compose | Config verification, E2E, image pulls | ✓ (daemon running in this sandbox) | Docker 29.9.2, Compose v5.6.1 | — |
| `caddy:2.11.7-alpine`, `cloudflare/cloudflared:2026.10.3` images | Behaviour proofs, E2E, prod | ✓ (both pulled this session) | as named | — |
| Docker Hub / GitHub raw / Cloudflare docs | Research | ✓ via the agent proxy | — | — |
| Cloudflare edge DNS (`argotunnel.com`) from the sandbox | Running a real tunnel | ✗ (`cloudflared` exits: `no such host`) | — | Cannot test a live tunnel here; first-deploy verification belongs to the owner |
| Node 24 + pnpm | Harness and Vitest | ✓ (Node v24.21.0, pnpm present); `node_modules` is **not installed** in this checkout | — | `pnpm install --frozen-lockfile` before running any suite |
| `supabase` CLI, `psql` | E2E bring-up | ✓ (`/usr/local/bin/supabase`, `/usr/bin/psql`) | — | — |
| Caddy binary on the host | Caddyfile validation outside Docker | ✗ | — | Run `docker run --rm -e HESTIA_TRUSTED_PROXIES=… -v …Caddyfile:/etc/caddy/Caddyfile:ro caddy:2.11.7-alpine caddy adapt --config /etc/caddy/Caddyfile` (worked this session) |

**Missing dependencies with no fallback:** a reachable Cloudflare edge (live tunnel test). Owner-only.
**Missing dependencies with fallback:** host `caddy` binary (use the container).

E2E in this cloud sandbox needs the documented CA workaround (CLAUDE.md "Running E2E in the Claude cloud sandbox"); it takes about 9 minutes and expects 104 passed before this phase's new spec(s).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node --test` (root harness), Vitest 5.0.1 (workspaces), Playwright 1.63.0 (E2E) |
| Config file | root `package.json` `test:harness` script (explicit file list); `apps/service/vitest.config.ts`; `e2e/playwright.config.ts` |
| Quick run command | `node --test scripts/check-repo-hygiene.test.mjs scripts/caddy-entrypoint.test.mjs scripts/deploy.test.mjs` and `pnpm --filter @hestia/service exec vitest run src/ingress-config.test.ts` |
| Full suite command | `pnpm test` (harness + all workspaces); `pnpm test:e2e` for the stack |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NET-01 | `tailscale`/`funnel` cannot reappear in tracked live files; allowlist and the `occurrence.ts` quote behave | harness | `node --test scripts/check-repo-hygiene.test.mjs` and `node scripts/check-repo-hygiene.mjs` (zero problems) | extend existing; new cases ❌ Wave 0 |
| NET-01 | `deploy.sh` no longer uses `127.0.0.1:8080` from the host; health via `compose exec` | harness | `node --test scripts/deploy.test.mjs` | extend existing ✅ |
| NET-02 | Compose: cloudflared pinned, token required, healthcheck, network, logging; no published ports; E2E overlay excludes it | vitest static | `pnpm --filter @hestia/service exec vitest run src/ingress-config.test.ts` | ❌ Wave 0 |
| NET-02 | Whole stack still comes up without Cloudflare in E2E | e2e | `pnpm test:e2e` | ✅ existing suite |
| NET-03 | Caddyfile pins `trusted_proxies static {$HESTIA_TRUSTED_PROXIES}`, strict, single `CF-Connecting-IP` header; entrypoint refuses an empty trust list | vitest static + harness | `vitest run src/ingress-config.test.ts`; `node --test scripts/caddy-entrypoint.test.mjs` | ❌ Wave 0 |
| NET-03 | Real header honoured, `X-Forwarded-For` ignored, downstream sees one address | e2e | `pnpm test:e2e` (new spec; or the Playwright filter for it) | ❌ Wave 0 |
| NET-04 | `HESTIA_ORIGIN=https://hestia.aberrance.app` yields `HESTIA_HOST=hestia.aberrance.app`; CSP template uses it; no CORS/cookie surface | harness + vitest static | `node --test scripts/caddy-entrypoint.test.mjs`; `vitest run src/ingress-config.test.ts` | ❌ Wave 0 |
| NET-05 | `.env.example` and docs carry the literal origin; GoTrue vars still derive from `HESTIA_ORIGIN`; `env.ts` still requires it | vitest static + existing unit | `vitest run src/ingress-config.test.ts src/env.test.ts` | ❌ Wave 0 / ✅ `env.test.ts` |

### Sampling Rate
- **Per task commit:** the two quick commands above (seconds). Husky pre-commit already runs lint-staged; run `pnpm lint` and `pnpm format:check` on touched `.mjs/.ts`.
- **Per wave merge:** `pnpm test` plus `node scripts/check-repo-hygiene.mjs`, `pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `pnpm typecheck`.
- **Phase gate:** full suite green and `pnpm test:e2e` green (expected 104 plus the new spec's tests) before `/gsd-verify-work`. Sanity-check the Caddyfile once with the containerised `caddy adapt` command from Environment Availability, with `HESTIA_TRUSTED_PROXIES=172.16.238.0/24` and `HESTIA_HOST=hestia.aberrance.app`.

### Wave 0 Gaps
- [ ] `apps/service/src/ingress-config.test.ts` — NET-02/03/04/05 static assertions (uses the existing `yaml` and `zod` dependencies).
- [ ] `scripts/caddy-entrypoint.test.mjs` — NET-03/04 entrypoint behaviour; **add it to the root `package.json` `test:harness` list** (the list is explicit).
- [ ] New cases in `scripts/check-repo-hygiene.test.mjs` — NET-01.
- [ ] New or extended case in `scripts/deploy.test.mjs` — health check without a host port.
- [ ] E2E spec for client IP and CSP — NET-03/04.
- [ ] `pnpm install --frozen-lockfile` — this checkout has no `node_modules`.

### Manual-only (owner), with justification
Live tunnel, DNS resolution of `hestia.aberrance.app`, WebSocket upgrade through Cloudflare, browser console free of CSP violations on the real origin (NET-04 acceptance), and `hestia-compose up -d --wait` after the first deploy. None can run in CI or in this sandbox (no edge connectivity). Provide them as a checklist, not as tasks the executor can complete.

## Security Domain

`security_enforcement` is enabled (absent/true in `.planning/config.json`), ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture / V14 Configuration | yes | No published ports; image pinned by tag; secrets only in the private `/srv/hestia/.env`; metrics bound to loopback; non-root distroless connector |
| V2 Authentication | no (unchanged) | GoTrue remains the authenticator; origin change only affects its URL config (Pitfall 4) |
| V3 Session Management | no (unchanged) | Tokens stay in browser storage; no cookies exist (grep verified) |
| V4 Access Control | no (unchanged) | RLS boundary untouched |
| V5 Input Validation | yes | Untrusted request header (`CF-Connecting-IP`) honoured only from a trusted peer; `HESTIA_ORIGIN` validated as an https origin in the entrypoint and by Zod in `env.ts` |
| V9 Communications | yes | TLS to the client terminates at Cloudflare; the edge-to-box leg is Cloudflare's encrypted tunnel; cloudflared to Caddy is plain HTTP on a private bridge; HSTS retained in Caddy's headers |
| V6 Cryptography | no | None hand-rolled |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-chosen IP via forged `CF-Connecting-IP` / `X-Forwarded-For` | Spoofing | Trust only the Compose subnet; no XFF fallback; no published port, so nothing outside the Docker network can reach Caddy directly (D-04..D-06). Residual: another container on the bridge could spoof; the stack's containers are all first-party |
| Tunnel token disclosure (grants the ability to run a connector for the route) | Information disclosure / Elevation | Token only in the 0600 `.env` and the container environment; never on a command line, in `docs/` examples, or in logs; rotate the token in the Cloudflare dashboard if exposed. `docker inspect` on the host shows it to host admins by design |
| Per-IP rate limit collapse (all users share cloudflared's address) | Denial of service | Entrypoint refuses an empty `HESTIA_TRUSTED_PROXIES`; static test pins both Compose files; E2E asserts the header is honoured |
| Edge terminates TLS and sees plaintext | Information disclosure | Accepted trade-off of a Cloudflare-fronted design; call it out in `docs/deployment.md` rather than hide it |
| Loss of the CSP `wss:` allowance for the new host | Tampering/availability | Entrypoint derives it from `HESTIA_ORIGIN`; harness test pins the derived value |
| Secrets in generated `.env` readable by others | Information disclosure | Existing `umask 077` creation in `generate-secrets.sh`; the token joins the same file |

## Sources

### Primary (HIGH confidence)
- Local repo files read this session: `docker/Caddyfile`, `docker/caddy-entrypoint.sh`, `docker/caddy.Dockerfile`, `docker/docker-compose.yml`, `docker/kong-entrypoint.sh`, `e2e/docker-compose.e2e.yml`, `e2e/setup/stack.ts`, `e2e/support/{env,run-identity,compose,logs,raw-http}.ts`, `scripts/{deploy,generate-secrets,check-repo-hygiene,ci-prepull-images}.sh|mjs`, `scripts/deploy.test.mjs`, `scripts/check-repo-hygiene.test.mjs`, `apps/service/src/{env,app}.ts`, `apps/service/src/kong-routes.test.ts`, `.env.example`, `docs/deployment.md`, `.claude/CLAUDE.md`, CONTEXT/REQUIREMENTS/STATE.
- Executed this session: `caddy:2.11.7-alpine` client-IP matrix and empty-variable adapt; `cloudflare/cloudflared:2026.10.3` entrypoint/cmd/user inspection, `tunnel ready` env handling and failure exit; busybox `wget` exit codes inside the Caddy image; Docker Compose interpolation with a base+overlay file; Compose network recreation on an ipam change (Compose v5.6.1).
- Docker Hub tags API for `cloudflare/cloudflared` (2026.10.3, 2026.10.4).

### Secondary (MEDIUM confidence)
- [Caddy global options](https://caddyserver.com/docs/caddyfile/options) — `trusted_proxies`, `trusted_proxies_strict`, `client_ip_headers`.
- [Caddy server.go](https://raw.githubusercontent.com/caddyserver/caddy/master/modules/caddyhttp/server.go) — `determineTrustedProxy` (fetched summary, consistent with the empirical run).
- [cloudflared Dockerfile](https://raw.githubusercontent.com/cloudflare/cloudflared/master/Dockerfile) — distroless, `--no-autoupdate` entrypoint.
- [cloudflared subcommands.go](https://raw.githubusercontent.com/cloudflare/cloudflared/master/cmd/cloudflared/tunnel/subcommands.go) — `ready` subcommand; `--metrics` required.
- [cloudflared run parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/cloudflared-parameters/run-parameters/) — `TUNNEL_TOKEN`, `NO_AUTOUPDATE`, `TUNNEL_METRICS`.
- [Cloudflare: create a remotely-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) — published application route to `http://caddy:8080`-style service URL.
- [Cloudflare: tunnel with firewall](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/) — outbound port 7844 TCP and UDP, edge hostnames.
- [Cloudflare tunnel metrics](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/monitor-tunnels/metrics/) — container default metrics address `0.0.0.0:<PORT>`.
- [Fastify logger-pino.js](https://raw.githubusercontent.com/fastify/fastify/main/lib/logger-pino.js) — default `req` serializer reads `req.ip` (the service overrides it with its own serializer, also `request.ip`).

### Tertiary (LOW confidence, flagged in the Assumptions Log)
- Third-party descriptions of `/ready` semantics and its blind spots: [cloudflared issue #1772](https://github.com/cloudflare/cloudflared/issues/1772), [OPNsense plugins PR #5819](https://github.com/opnsense/plugins/pull/5819).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — the image, its entrypoint/user, and the Caddy behaviours were run, not recalled.
- Architecture: HIGH — mirrors existing patterns (anchors, overlay, harness stubs, hygiene guard); every changed line was read in the repo.
- Pitfalls: HIGH for 1, 2, 3, 5 (reproduced); MEDIUM for 4 and 7 (derived from reading `deploy.sh`/docs, not run on a host); MEDIUM-LOW for `/ready` semantics and WebSocket pass-through (A1, A4).

**Research date:** 2026-10-26
**Valid until:** 2026-11-25 for the Caddy/Compose findings; re-check the `cloudflared` tag if planning slips past mid-November (releases land every 1-2 weeks; `2026.10.4` shipped the day of this research).
