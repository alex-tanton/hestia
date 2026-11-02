---
phase: "11"
plan: "02"
subsystem: "docker"
tags: [caddy, cache-control, edge-caching, cloudflare, waf, rate-limiting, vitest, playwright]
requires: ["11-01"]
provides:
  - caddy-differentiated-cache-control
  - static-ingress-cache-control-assertions
  - e2e-ingress-cache-control-assertions
  - cloudflare-edge-cache-runbook
  - cloudflare-waf-rate-limiting-runbook
affects:
  - docker
  - apps/service
  - e2e
  - docs
tech-stack:
  - caddy
  - vitest
  - playwright
  - cloudflare-waf
requirements-completed: [EDGE-01]
key-files:
  modified:
    - docker/Caddyfile
    - apps/service/src/ingress-config.test.ts
    - e2e/tests/20-ingress-client-ip-and-csp.spec.ts
    - docs/deployment.md
commits:
  - sha: "8ad1907"
    subject: "feat(docker): configure differentiated Cache-Control response headers"
  - sha: "641fbbe"
    subject: "test(e2e): assert ingress Cache-Control headers on entrypoints and manifest"
  - sha: "07b8ed6"
    subject: "docs: document Cloudflare Edge Caching and WAF Rate Limiting runbooks"
verification: PASSED
---

# Plan 11-02 Summary: Ingress Cache-Control Headers, Cloudflare Edge Caching & WAF Rate Limiting Runbooks

## What Was Built

Implements edge performance and security hardening (`EDGE-01`) across Caddy reverse proxy configuration, static unit test assertions, E2E ingress tests, and Cloudflare Edge runbooks:

1. **Differentiated Ingress Cache-Control Headers (`docker/Caddyfile`)**:
   - Added `@assets path /assets/*` with `header @assets Cache-Control "public, max-age=31536000, immutable"` for hashed Vite bundle assets, enabling year-long edge and browser caching.
   - Added `@entry path / /index.html /sw.js` with `header @entry Cache-Control "no-cache, must-revalidate"` ensuring fresh entrypoints and prompt service worker updates on client browsers.
   - Added `@icons_manifest path /icons/* /manifest.webmanifest /favicon.ico` with `header @icons_manifest Cache-Control "public, max-age=86400, must-revalidate"` for static icon assets and PWA manifest.
   - Verified Caddy configuration syntax with `caddy validate`.

2. **Static Ingress Assertions (`apps/service/src/ingress-config.test.ts`)**:
   - Added Vitest test case verifying that `caddyDirectives` in `docker/Caddyfile` statically includes all three path matchers (`@assets`, `@entry`, `@icons_manifest`) and their corresponding `Cache-Control` header directives.

3. **Live Ingress Header Test Assertions (`e2e/tests/20-ingress-client-ip-and-csp.spec.ts`)**:
   - Added Playwright test `serves static assets with immutable cache and entrypoints with no-cache` asserting live response headers from the Caddy ingress container:
     - `GET /index.html` returns `Cache-Control: no-cache, must-revalidate`.
     - `GET /sw.js` returns `Cache-Control: no-cache, must-revalidate`.
     - `GET /manifest.webmanifest` returns `Cache-Control: public, max-age=86400, must-revalidate`.
     - Dynamically extracted `/assets/*` bundles return `Cache-Control: public, max-age=31536000, immutable`.

4. **Cloudflare Edge Caching & WAF Rate Limiting Runbooks (`docs/deployment.md`)**:
   - Authored "Cloudflare Edge Caching" runbook:
     - Documented Cache Rule `Cache Hestia Static Assets` on domain `aberrance.app`.
     - Expression: `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/assets/")`.
     - Configured `Respect origin` for Edge and Browser TTL.
     - Documented verification curl commands checking `cf-cache-status: HIT` and `cache-control: public, max-age=31536000, immutable`.
   - Authored "Cloudflare Edge Security & WAF Rate Limiting" runbook:
     - Documented rate limiting rule `Protect Hestia Auth Endpoints`.
     - Expression: `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/auth/v1/") and http.request.method eq "POST"`.
     - Configured threshold of 15 requests per 1-minute window per client IP with a 10-minute `Managed Challenge` (Cloudflare Turnstile) action duration, explicitly exempting `GET /auth/v1/*` requests (such as `GET /auth/v1/user`) to prevent false-positive lockouts on shared household Wi-Fi.
     - Documented curl simulation loop testing 16 consecutive POST requests and verifying HTTP 403 challenge response on request 16.

## Verification Results

- `docker run ... caddy validate --config /etc/caddy/Caddyfile`:
  Passed (`Valid configuration`).
- `pnpm --filter @hestia/service exec vitest run src/ingress-config.test.ts`:
  Passed (9 tests passed, 0 failures).
- Playwright E2E spec check:
  Passed verification of required `Cache-Control` header assertions.
- `pnpm --filter @hestia/e2e typecheck`:
  Passed (0 errors).
- Documentation content automated checks:
  Passed (all Edge Caching and WAF Rate Limiting rule specifications, expressions, and verification scripts present).
- `node scripts/check-repo-hygiene.mjs`:
  Passed (clean across 1087 files).
- `pnpm lint`:
  Passed with 0 warnings.

## Self-Check: PASSED
