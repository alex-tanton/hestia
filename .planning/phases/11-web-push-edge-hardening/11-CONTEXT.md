# Phase 11: Web Push & Edge Hardening - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete Milestone v2.0 by hardening Web Push notifications under RFC 8292 VAPID requirements, configuring Cloudflare Edge caching and WAF rate limiting, providing operator tooling for mobile device verification, and running the full project verification suite (`PUSH-01`, `PUSH-02`, `EDGE-01`, `VERIFY-01`).

- Enforce `VAPID_SUBJECT` in `apps/service/src/env.ts` as a strictly required environment variable validated as a contact URI (`mailto:admin@aberrance.app` or `https:` URI).
- Pass `VAPID_SUBJECT` explicitly in `docker/docker-compose.yml`, `.env.example`, `scripts/generate-secrets.sh`, and `e2e/setup/stack.ts`.
- Update Caddy (`docker/Caddyfile`) to emit immutable `Cache-Control` headers for hashed Vite static assets (`/assets/*`), `no-cache` for entry and worker files (`index.html`, `sw.js`), and short cached revalidation for app icons and manifest.
- Document Cloudflare Cache Rules and WAF Rate Limiting rules (15 POST req/min per IP with Managed Challenge) in `docs/deployment.md`.
- Add `hestia-admin test-push` CLI command to trigger instantaneous test push notifications to registered user devices.
- Document iOS Safari (16.4+) and Android Chrome standalone PWA push verification runbook.
- Execute full test suite, build, Knip dead-code scan, JSCPD duplication check, and CI ratchet to guarantee zero regressions.

Out of scope:
- Background push notification payload encryption redesign (existing `web-push` transport handles this).
- Native iOS/Android app wrappers (Capacitor/React Native) — Hestia is an installable PWA.
- Additional authentication providers or OAuth integrations.

</domain>

<decisions>
## Implementation Decisions

### VAPID Subject & Claims Enforcement (PUSH-01)
- **D-01:** Strictly require `VAPID_SUBJECT` in `apps/service/src/env.ts` schema and Compose environment. Fails fast at service startup if unset. — **Reversibility:** costly — Startup environment validation touches `env.ts`, `docker-compose.yml`, and `.env.example`.
- **D-02:** Pre-populate `VAPID_SUBJECT=mailto:admin@aberrance.app` across `.env.example`, `scripts/generate-secrets.sh`, and `e2e/setup/stack.ts`. Guarantees RFC 8292 compliance by default across new environments and E2E runs.
- **D-03:** Validate `VAPID_SUBJECT` in `apps/service/src/env.ts` with RFC 8292 contact URI validation (valid `mailto:` with email or `https:` URI) via Zod refinement.
- **D-04:** Update `apps/service/src/env.test.ts` to test `VAPID_SUBJECT` strict validation and rejection, retiring obsolete fallback-derivation tests (e.g. falling back to `HESTIA_OWNER_EMAIL`).

### Cloudflare Edge Caching & Cache-Control Headers (EDGE-01)
- **D-05:** Configure Caddy (`docker/Caddyfile`) to emit explicit HTTP response headers: `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` (hashed bundles), and `Cache-Control: no-cache, must-revalidate` for `/index.html` and `/sw.js`. Document Cloudflare Cache Rules that respect these origin headers.
- **D-06:** Differentiate static asset caching in Caddy: `/assets/*` receives 1-year immutable caching; root files (`/index.html`, `/sw.js`) are `no-cache, must-revalidate`; static icons and manifest (`/icons/*`, `/manifest.webmanifest`, `/favicon.ico`) receive 1-day caching with revalidation (`max-age=86400, must-revalidate`).
- **D-07:** Document exact Cloudflare Edge Cache Rule in `docs/deployment.md` under a dedicated "Edge Caching" subsection, including dashboard navigation, rule expression (`http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/assets/")`), Edge/Browser TTL settings, and curl verification command checking `cf-cache-status: HIT`.
- **D-08:** Add automated Playwright tests in `e2e/tests/20-ingress.spec.ts` asserting exact `Cache-Control` header values on `/assets/*`, `/index.html`, and `/sw.js`.

### Cloudflare WAF Rate Limiting Policy for /auth/v1/* (EDGE-01)
- **D-09:** Set Cloudflare WAF rate limiting threshold to 15 requests per 1-minute window per client IP on `/auth/v1/*`. Balances brute-force prevention against shared household Wi-Fi / NAT false positives.
- **D-10:** Configure Cloudflare WAF mitigation action to "Managed Challenge" (Cloudflare Turnstile challenge) with a 10-minute action duration, blocking automated attacks while allowing human users to self-verify.
- **D-11:** Target rate limiting rule strictly to `POST` requests under `/auth/v1/*` (`http.request.method eq "POST"`). Protects sensitive authentication actions (`/token`, `/otp`, `/recover`) while preventing normal session checks (`GET /auth/v1/user`) from exhausting quota.
- **D-12:** Add dedicated "Cloudflare Edge Security & WAF Rate Limiting" runbook in `docs/deployment.md` documenting rule setup, expression syntax, and a curl simulation script.

### Mobile Push Verification & Quality Ratchet (PUSH-02, VERIFY-01)
- **D-13:** Add a new CLI command `pnpm hestia-admin test-push --email <user-email> [--title <title>] [--body <body>]` to `apps/service/src/cli/` (and root `package.json` command wrapper). Loads active device push subscriptions for the user and dispatches an immediate test push via `PushTransport`.
- **D-14:** Add unit/integration tests for `hestia-admin test-push` covering argument validation, user lookup, payload construction, and no-subscription error handling.
- **D-15:** Document step-by-step iOS Safari (16.4+) and Android Chrome PWA installation and notification verification runbook in `docs/deployment.md`, and provide a verification checklist in the phase artifacts for testing on `https://hestia.aberrance.app`.
- **D-16:** Dedicated verification plan running full CI ratchet (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:coverage`, `pnpm knip`, `pnpm jscpd`, `pnpm build`, and migration append-only check) with 100% green gate to close Milestone v2.0.

### The Agent's Discretion
- Exact Caddy path matcher syntax in `docker/Caddyfile` for `/assets/*` vs root files.
- Exact CLI flag names and formatting in `hestia-admin test-push`.
- Order of tasks within the phase plans.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` (Phase 11) — goal and 4 success criteria
- `.planning/REQUIREMENTS.md` (PUSH-01, PUSH-02, EDGE-01, VERIFY-01) — acceptance criteria
- `.planning/PROJECT.md` — constraints, decisions, and v2.0 scope
- `.planning/research/DOMAIN-MIGRATION.md` §3 — Web Push RFC 8292 VAPID & iOS PWA Requirements
- `.planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-CONTEXT.md` — Ingress, Caddy, CF-Connecting-IP, trusted proxies
- `.planning/phases/10-magic-links-transactional-email/10-CONTEXT.md` — GoTrue auth endpoints and transactional SMTP

### Configuration and deployment files
- `apps/service/src/env.ts` — `VAPID_SUBJECT`, `envSchema`, `isContactUri`
- `docker/docker-compose.yml` — `hestia-service` environment, `VAPID_SUBJECT`
- `docker/Caddyfile` — static file serving and `Cache-Control` response headers
- `.env.example` — `VAPID_SUBJECT=mailto:admin@aberrance.app`
- `scripts/generate-secrets.sh` — secrets generation with `VAPID_SUBJECT`
- `docs/deployment.md` — runbook for Cloudflare Edge Cache Rules, WAF Rate Limiting, and mobile push verification

### Push notification and CLI files
- `apps/service/src/push/web-push-transport.ts` — Web Push delivery via `web-push` library
- `apps/service/src/jobs/dispatch-notifications.ts` — notification dispatch and subscription handling
- `apps/service/src/cli/main.ts` — `hestia-admin` CLI command registration
- `apps/web/src/lib/push/push-port.ts` — browser Web Push port and subscription handling
- `apps/web/src/screens/settings/NotificationTypes.tsx` — notification preferences and device push registration

### Test files
- `apps/service/src/env.test.ts` — environment parsing and `VAPID_SUBJECT` validation tests
- `e2e/tests/20-ingress.spec.ts` — Caddy ingress headers test suite
- `e2e/setup/stack.ts` — E2E stack configuration with `VAPID_SUBJECT`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/service/src/push/web-push-transport.ts`: Production Web Push transport with `webPush.setVapidDetails`.
- `apps/service/src/jobs/dispatch-notifications.ts`: Database query for member push subscriptions and transport execution.
- `apps/service/src/cli/main.ts`: Commander-based CLI structure for `hestia-admin` commands.
- `apps/web/src/lib/push/push-port.ts`: Comprehensive client push port with iOS standalone detection (`isIosBrowser() && !isStandalone()`).

### Established Patterns
- Caddy acts as the single ingress container terminating plain HTTP from `cloudflared` and adding strict security headers.
- All service secrets and URLs are strongly typed and validated through Zod in `apps/service/src/env.ts`.
- E2E tests in `e2e/tests/` use real Docker Compose containers and Playwright to verify ingress headers and behaviors.
- CI quality ratchet commands in `package.json` (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm knip`, `pnpm jscpd`, `pnpm build`).

### Integration Points
- `docker/Caddyfile`: Adding route or header directives for `/assets/*`, `/index.html`, `/sw.js`.
- `docker/docker-compose.yml`: Forwarding `VAPID_SUBJECT` to `hestia-service`.
- `apps/service/src/cli/main.ts`: Registering `test-push` command under `hestia-admin`.
- `docs/deployment.md`: Documenting Cloudflare Edge rules and mobile push verification steps.

</code_context>

<specifics>
## Specific Ideas

- Adding `hestia-admin test-push` gives the operator a quick, repeatable way to verify mobile push delivery on iOS and Android devices without manipulating chores or waiting for scheduled cron tasks.
- Explicit Cache-Control headers in Caddy ensure both Cloudflare Edge and browser caches correctly cache hashed assets for 1 year while immediately revalidating `index.html` and `sw.js`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-Web Push & Edge Hardening*
*Context gathered: 2026-11-01*

