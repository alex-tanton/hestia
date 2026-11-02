# Phase 11: Web Push & Edge Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-01
**Phase:** 11-web-push-edge-hardening
**Areas discussed:** VAPID Subject & Claims Enforcement, Cloudflare Edge Caching & Cache-Control Headers, WAF Rate Limiting Policy for /auth/v1/*, Mobile Push Verification Strategy

---

## VAPID Subject & Claims Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Default fallback to mailto:admin@aberrance.app in env.ts | Fallback derivation when unset | |
| Strictly require VAPID_SUBJECT in .env and Compose | Fail fast at service startup if unset | ✓ |
| You decide | Agent discretion on config priority | |

**User's choice:** Strictly require VAPID_SUBJECT in .env and Compose (fail fast at service startup if unset)
**Notes:** `VAPID_SUBJECT` must be explicitly declared in `.env` and `docker/docker-compose.yml`.

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-populate VAPID_SUBJECT=mailto:admin@aberrance.app | Set in .env.example, scripts/generate-secrets.sh, and E2E stack.ts | ✓ |
| Only add VAPID_SUBJECT to .env.example without defaulting | Operator must supply manually | |
| You decide | Agent discretion | |

**User's choice:** Pre-populate VAPID_SUBJECT=mailto:admin@aberrance.app in .env.example, scripts/generate-secrets.sh, and E2E stack.ts
**Notes:** Ensures all environments and E2E runs are RFC 8292 compliant out of the box.

| Option | Description | Selected |
|--------|-------------|----------|
| Enforce RFC 8292 contact URI validation | Valid mailto: with email or https: URI via Zod refinement | ✓ |
| Strictly enforce mailto: only | Reject https: URIs | |
| You decide | Agent discretion | |

**User's choice:** Enforce RFC 8292 contact URI validation (valid mailto: with email or https: URI) at service startup using Zod refinement
**Notes:** Reuses and strengthens contact URI validation during environment parsing.

| Option | Description | Selected |
|--------|-------------|----------|
| Update env.test.ts to test strict validation | Retire obsolete fallback derivation tests | ✓ |
| Retain fallback derivation tests | Keep legacy edge-case tests | |
| You decide | Agent discretion | |

**User's choice:** Update env.test.ts to test VAPID_SUBJECT validation and rejection, and retire obsolete fallback-derivation tests
**Notes:** Align unit tests with strict startup requirement.

---

## Cloudflare Edge Caching & Cache-Control Headers

| Option | Description | Selected |
|--------|-------------|----------|
| Configure Caddy with explicit headers | Cache-Control: public, max-age=31536000, immutable for /assets/*, no-cache for index.html/sw.js | ✓ |
| Cloudflare Dashboard only | Keep Caddy Caddyfile unchanged | |
| You decide | Agent discretion | |

**User's choice:** Configure Caddy to set Cache-Control: public, max-age=31536000, immutable for /assets/* and no-cache for index.html/sw.js, and document Cloudflare Cache Rules honoring them
**Notes:** End-to-end cache predictability from origin to edge.

| Option | Description | Selected |
|--------|-------------|----------|
| /assets/*: 1y immutable; index/sw: no-cache; icons/manifest: 1d revalidate | Tiered caching strategy across asset types | ✓ |
| /assets/*: 1y immutable; everything else: no-cache, no-store | Strict binary cache policy | |
| You decide | Agent discretion | |

**User's choice:** /assets/*: 1 year immutable; index.html & sw.js: no-cache, must-revalidate; icons/manifest: 1 day with revalidation
**Notes:** Prevents stale PWA shell or service worker while optimizing cache hit ratio for immutable bundles and icons.

| Option | Description | Selected |
|--------|-------------|----------|
| Document exact Cache Rule expression and curl test | Step-by-step in docs/deployment.md | ✓ |
| High-level guidelines | General advice only | |
| You decide | Agent discretion | |

**User's choice:** Document exact Cache Rule expression, settings, and curl verification command (checking cf-cache-status: HIT) in docs/deployment.md
**Notes:** Complete operational runbook.

| Option | Description | Selected |
|--------|-------------|----------|
| Add Playwright tests in e2e/tests/20-ingress.spec.ts | Assert exact Cache-Control headers | ✓ |
| Manual curl checks only | No automated tests | |
| You decide | Agent discretion | |

**User's choice:** Add Playwright tests in e2e/tests/20-ingress.spec.ts asserting Cache-Control headers on /assets/*, /index.html, and /sw.js
**Notes:** Automated regression prevention in CI.

---

## WAF Rate Limiting Policy for /auth/v1/*

| Option | Description | Selected |
|--------|-------------|----------|
| 15 requests per 1-minute window per IP | Balances brute force protection with shared Wi-Fi | ✓ |
| 10 requests per 1-minute window per IP | Stricter protection | |
| 30 requests per 1-minute window per IP | More permissive | |
| You decide | Agent discretion | |

**User's choice:** 15 requests per 1-minute window per client IP (balances brute-force protection with shared household Wi-Fi / NAT)
**Notes:** Prevents OTP guessing while accommodating normal multi-member logins.

| Option | Description | Selected |
|--------|-------------|----------|
| Managed Challenge (Cloudflare Turnstile) | Halts automated bots while allowing humans to self-verify | ✓ |
| Block with HTTP 429 for 10 minutes | Hard temporary block | |
| Block with HTTP 429 for 1 hour | Long temporary block | |
| You decide | Agent discretion | |

**User's choice:** Managed Challenge (Cloudflare Turnstile challenge; halts automated bots while allowing humans to self-verify)
**Notes:** Prevents hard lockout of household members who mistype credentials.

| Option | Description | Selected |
|--------|-------------|----------|
| Target POST requests to /auth/v1/* | Covers login, OTP, recover without hitting GET /user | ✓ |
| Target all requests to /auth/v1/* | Broad rule across all methods | |
| You decide | Agent discretion | |

**User's choice:** Target POST requests to /auth/v1/* (covers login, OTP request, OTP verification, password recovery without impacting GET /auth/v1/user)
**Notes:** Leaves background session verification unaffected.

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated WAF section in docs/deployment.md | Expression, settings, curl simulation | ✓ |
| High-level guidelines | General advice only | |
| You decide | Agent discretion | |

**User's choice:** Add dedicated Cloudflare Edge Security & WAF section in docs/deployment.md with exact rule expression, settings, and curl verification instructions
**Notes:** Operator instructions in deployment runbook.

---

## Mobile Push Verification Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Add hestia-admin test-push --email <user> | CLI command to trigger instant push | ✓ |
| Trigger via UI chore creation | Manual UI path | |
| You decide | Agent discretion | |

**User's choice:** Add `hestia-admin test-push --email <user>` CLI command to send an immediate test push to registered devices
**Notes:** Clean, reproducible verification tool for operators.

| Option | Description | Selected |
|--------|-------------|----------|
| Document mobile runbook and verification checklist | In docs/deployment.md and phase artifacts | ✓ |
| Brief notes in docs/deployment.md | Minimal documentation | |
| You decide | Agent discretion | |

**User's choice:** Document step-by-step mobile verification runbook in docs/deployment.md and provide an interactive verification checklist in the phase artifacts
**Notes:** Detailed iOS Safari and Android Chrome verification guide.

| Option | Description | Selected |
|--------|-------------|----------|
| Unit/integration tests for hestia-admin test-push | Arg parsing, user resolution, delivery, errors | ✓ |
| Manual CLI testing only | No automated tests | |
| You decide | Agent discretion | |

**User's choice:** Add unit/integration tests for hestia-admin test-push covering argument parsing, user resolution, payload delivery, and no-subscription handling
**Notes:** Fully tested CLI surface.

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated verification plan running full CI ratchet | Lint, typecheck, tests, knip, jscpd, build, migrations | ✓ |
| Run CI checks in implementation plan | No dedicated verification plan | |
| You decide | Agent discretion | |

**User's choice:** Dedicated verification plan running full CI ratchet (lint, typecheck, tests, knip, jscpd, build, migration-append-only) with 100% green gate
**Notes:** Final quality lock before closing Milestone v2.0.

---

## the agent's Discretion

- Exact Caddy path matcher syntax in `docker/Caddyfile` for `/assets/*` vs root files.
- Exact CLI flag names and formatting in `hestia-admin test-push`.
- Order of tasks within the phase plans.

## Deferred Ideas

None — discussion stayed within phase scope.

