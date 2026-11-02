---
phase: "09"
slug: "09-domain-network-migration-cloudflare-tunnel-ingress"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 09 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| internet → Cloudflare edge → cloudflared → Caddy | Public traffic arrives only through the tunnel; request headers are client-controlled until edge sets `CF-Connecting-IP` | Untrusted HTTP/WebSocket requests |
| Compose network → Caddy | Any peer on the `hestia` bridge can reach `caddy:8080`; only this subnet is trusted to name the client | Reverse-proxied requests and internal health checks |
| host `.env` → containers | Tunnel token and runtime secrets cross from the 0600 env file into container environments | Token, DB passwords, JWT secrets, VAPID keys |
| deploy runner → Compose stack | Self-hosted runner executes health checks and deploy orchestration | Healthcheck probes via `docker compose exec` |
| pull request → hygiene gate | Changes could reintroduce retired ingress references | Code and documentation diffs |
| phase diff → public repository | Phase artifacts and code published upon merge | Public repository code |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Spoofing | `docker/Caddyfile` servers block | high | mitigate | `trusted_proxies static {$HESTIA_TRUSTED_PROXIES}`, `client_ip_headers CF-Connecting-IP`, `trusted_proxies_strict`, no `X-Forwarded-For` fallback, no published port | closed |
| T-09-02 | Information Disclosure | tunnel token (`CLOUDFLARE_TUNNEL_TOKEN`) | high | mitigate | Read from `TUNNEL_TOKEN` env, never in command; `:?` fails Compose if empty; `.env.example` empty | closed |
| T-09-03 | Denial of Service | per-IP rate limit | medium | mitigate | Caddy's trust list comes from `&subnet` anchor; entrypoint refuses empty list | closed |
| T-09-04 | Tampering | `cloudflare/cloudflared` image | medium | mitigate | Pinned to `2026.10.3` (non-root `65532:65532`) | closed |
| T-09-05 | Information Disclosure | cloudflared metrics endpoint | low | mitigate | `TUNNEL_METRICS: 127.0.0.1:2000` on loopback only | closed |
| T-09-06 | Tampering | CSP `connect-src`, CORS, cookies | medium | mitigate | CSP derives `wss://` host from origin; static assertions pin no CORS/cookie surface; live check verified | closed |
| T-09-07 | Information Disclosure | sandbox CA bundle during E2E | high | mitigate | Applied only to build stages, reverted before commit | closed |
| T-09-08 | Denial of Service | `scripts/deploy.sh` health gate | high | mitigate | Runs inside container via `compose exec -T caddy wget http://127.0.0.1:8080/api/health` | closed |
| T-09-09 | Denial of Service | bad tunnel token deployed | high | mitigate | cloudflared starts with supporting services; fails early before switch | closed |
| T-09-10 | Denial of Service | half-done network recreate | high | mitigate | Prepare step with `up --no-start --no-recreate --no-build` ensures compose project is intact | closed |
| T-09-11 | Denial of Service | token in log output | medium | mitigate | Deploy script never echoes the token; token passed through compose env | closed |
| T-09-12 | Denial of Service | `auth` keeping old origin | high | mitigate | GoTrue URL variables derived from `${HESTIA_ORIGIN}`; verified via docker inspect | closed |
| T-09-13 | Denial of Service | CI runner anonymous pull rate limit | low | mitigate | `scripts/ci-prepull-images.sh` skips cloudflared in CI since not needed | closed |
| T-09-14 | Information Disclosure | `generate-secrets.sh` leaking secrets | high | mitigate | Maintains `umask 077`, copies token only if present | closed |
| T-09-15 | Information Disclosure | leftover references to retired ingress | medium | mitigate | Sweep completed; `check-repo-hygiene.mjs` enforces zero occurrences | closed |
| T-09-16 | Spoofing | origin sweep missing invite or reset links | high | mitigate | All tests swept to `https://hestia.aberrance.app`; tests pass | closed |
| T-09-17 | Elevation of Privilege | public hostname misconfigured to backend | high | mitigate | Runbook specifies `http://caddy:8080`; Caddy blocks signup with 403 | closed |
| T-09-18 | Information Disclosure | Cloudflare edge terminates TLS | low | accept | Inherent trade-off of Cloudflare-fronted design; documented in `docs/deployment.md` | closed |
| T-09-19 | Denial of Service | merging before token/origin in `.env` | medium | mitigate | Checklist steps 1-6 gate merge; Compose fails immediately if token missing | closed |
| T-09-20 | Tampering | allowlist widened to hide retired ingress | medium | mitigate | Strict hygiene gate test covers allowlist exact match | closed |
| T-09-21 | Denial of Service | `git grep` status mishandled in hygiene gate | medium | mitigate | Status 0/1 handled properly | closed |
| T-09-22 | Information Disclosure | sandbox CA committed | high | mitigate | Verified by hygiene gate and git status clean | closed |
| T-09-23 | Information Disclosure | secrets in phase diff | high | mitigate | Scanned for secret patterns, clean | closed |
| T-09-24 | Spoofing | client address behind live tunnel | high | transfer | Verified in UAT test 3 (`remoteAddress` shows public IP) | closed |
| T-09-25 | Spoofing | `trusted_proxies` covering whole `hestia` /24 | low | accept | Accepted per locked decision D-05 (first-party pinned containers only) | closed |
| T-09-SC | Tampering | package installs | low | accept | Lockfile frozen, pinned cloudflared vendor image | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-09-01 | T-09-18 | Cloudflare edge terminates TLS and decrypts traffic before re-encrypting via tunnel. Inherent design of Cloudflare-fronted architecture. | Owner (D-01) | 2026-10-26 |
| R-09-02 | T-09-25 | `trusted_proxies` covers the `/24` Compose subnet. Every container on the network is a first-party, version-pinned service of this stack; none relays outside requests. | Owner (D-05) | 2026-10-26 |
| R-09-03 | T-09-SC | No npm/crates/PyPI packages added; official vendor image `cloudflare/cloudflared:2026.10.3` pinned. | Owner | 2026-10-26 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 26 | 26 | 0 | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01
