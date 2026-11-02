# Phase 9: Domain & Network Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-26
**Phase:** 09-domain-network-migration-cloudflare-tunnel-ingress
**Areas discussed:** cloudflared setup, Caddy trust and client IP, Origin cutover, Tailscale removal and runbook

---

## cloudflared setup

| Option | Description | Selected |
|--------|-------------|----------|
| Remotely-managed, token only | Token in .env, route set in the Cloudflare dashboard | ✓ |
| Locally-managed config | Committed config.yml plus credentials file | |
| Always on, token required | Required `${...:?}` value, no profile | ✓ |
| Compose profile (opt-in) | `profiles: [tunnel]`, enabled by deploy.sh | |

**User's choice:** Remotely-managed token; always on with required token.

## Caddy trust and client IP

| Option | Description | Selected |
|--------|-------------|----------|
| Remove port 8080 | Zero published ports; drop host-gateway trust | ✓ |
| Keep on loopback | Local smoke checks, keeps gateway trust entry | |
| Compose subnet only, CF-Connecting-IP | No IP list to maintain | ✓ |
| Subnet plus Cloudflare ranges | Defense in depth, list goes stale | |
| Use connection address when header missing | Callers cannot pick their IP | ✓ |
| Fall back to X-Forwarded-For | More forgiving, spoofable | |

**User's choice:** All recommended options.

## Origin cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Hard switch, no ts.net fallback | Old origin abandoned | ✓ |
| Dual-origin transition | More code and test surface | |
| Literal hostname in examples, required in .env | No code default | ✓ |
| Default inside env.ts | Risk of production origin in dev/tests | |
| Verify and pin NET-04 with tests | No CORS/cookie code invented | ✓ |
| Add explicit CORS and cookie config | No current caller | |

**User's choice:** All recommended options.

## Tailscale removal and runbook

| Option | Description | Selected |
|--------|-------------|----------|
| Delete everywhere, no migration note | Plus hygiene guard | ✓ |
| Delete, keep one migration note | Guard allowlists deployment.md | |
| docs/deployment.md section | Single source of truth | ✓ |
| Separate docs/cloudflare.md | Another doc to track | |

**User's choice:** All recommended options.

## Claude's Discretion

Image tag and healthcheck, E2E override and client-IP header, NET-04 test form, guard regex.

## Deferred Ideas

Edge caching and WAF (Phase 11); Cloudflare IP-range trust in Caddy.
