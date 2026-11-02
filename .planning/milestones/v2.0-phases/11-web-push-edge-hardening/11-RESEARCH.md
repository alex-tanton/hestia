# Phase 11: Web Push & Edge Hardening - Research

**Date:** 2026-11-02  
**Status:** Completed  
**Milestone:** v2.0 (Hestia Domain Migration and Rebrand)  
**Requirements Addressed:** `PUSH-01`, `PUSH-02`, `EDGE-01`, `VERIFY-01`

---

## Executive Summary

Phase 11 is the final phase of Milestone v2.0. It hardens Hestia's production edge and Web Push notification delivery, implements operator tooling for real-device verification, documents edge caching and security policies, and closes the milestone with an uncompromising 100% green CI ratchet.

Specifically, Phase 11 delivers:
1. **Strict VAPID Subject Validation (`PUSH-01`)**: Enforces RFC 8292 contact URI compliance (`mailto:admin@aberrance.app` or `https:` URI) across `apps/service/src/env.ts`, `docker/docker-compose.yml`, `.env.example`, `scripts/generate-secrets.sh`, and `e2e/setup/stack.ts`, eliminating silent fallback derivations.
2. **Edge Caching & Response Headers (`EDGE-01`)**: Configures Caddy (`docker/Caddyfile`) with differentiated `Cache-Control` response headers (`1-year immutable` for hashed Vite assets, `no-cache` for root files and service worker, `1-day` for app icons and manifest), pins static and Playwright header tests, and documents Cloudflare Edge Cache Rules.
3. **Cloudflare WAF Rate Limiting Policy (`EDGE-01`)**: Establishes a 15 POST req/min per IP rate limiting policy on `/auth/v1/*` with Managed Challenge (Turnstile) mitigation, protecting sensitive auth endpoints against brute force while avoiding false positives on shared Wi-Fi.
4. **Operator Push CLI & Mobile Verification Runbook (`PUSH-02`)**: Adds `hestia-admin test-push` to `apps/service/src/cli.ts` (with root `package.json` shortcut), documents standalone PWA push verification for iOS Safari 16.4+ and Android Chrome, and provides a verification runbook in `docs/deployment.md`.
5. **Quality Ratchet & Zero-Regression Gate (`VERIFY-01`)**: Executes the complete quality sweep (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm knip`, `pnpm jscpd`, `pnpm build`, repo hygiene, and append-only migrations) guaranteeing zero regressions to conclude Milestone v2.0.

---

## 1. Architecture & Technical Decisions

### 1.1 RFC 8292 VAPID Subject Enforcement (`PUSH-01`)

RFC 8292 §2.1 mandates that the Voluntary Application Server Identification (VAPID) JWT `sub` (subject) claim contain a contact URI for the application operator as either a `mailto:` (RFC 6068) or `https:` (RFC 2818) URI. Push endpoints—specifically Apple Push Notification Service (APNs) and Mozilla Autopush—strictly reject or deprioritize push dispatches with invalid or missing contact claims.

#### Current State
In `apps/service/src/env.ts`, `VAPID_SUBJECT` is currently optional (`z.string().min(1).optional()`). If unset, `vapidSubjectFor` executes fallback derivation logic: it checks if `HESTIA_OWNER_EMAIL` is valid to construct `mailto:${HESTIA_OWNER_EMAIL}`, or falls back to `HESTIA_ORIGIN` if served over HTTPS. Furthermore, `docker/docker-compose.yml` does not forward `VAPID_SUBJECT` to `hestia-service`, and `.env.example` lacks the variable entirely.

#### Changes Required
- **`apps/service/src/env.ts`**:
  * Make `VAPID_SUBJECT` strictly required in `envSchema` with a custom Zod refinement enforcing RFC 8292 contact URI syntax:
    ```typescript
    function isContactUri(value: string): boolean {
      try {
        const url = new URL(value);
        if (url.protocol === 'mailto:') {
          // Address must follow mailto:<email>
          return z.string().email().safeParse(url.pathname).success;
        }
        return url.protocol === 'https:';
      } catch {
        return false;
      }
    }

    const envSchema = z.object({
      // ...
      VAPID_SUBJECT: z.string().min(1).refine(isContactUri, {
        message: 'VAPID_SUBJECT must be a mailto: or https: URI',
      }),
      // ...
    });
    ```
  * Retire the fallback derivation logic in `vapidSubjectFor`. Because `VAPID_SUBJECT` is required and validated directly by `envSchema`, `parseEnv` returns `parse(envSchema, source)` directly without augmentation.
  * In `parseCliEnv`, keep `VAPID_SUBJECT` and other database/VAPID fields optional or picked specifically where required by the CLI command.
- **Environment & Secret Tooling**:
  * `.env.example`: Add `VAPID_SUBJECT=mailto:admin@aberrance.app` under the Web Push VAPID section.
  * `docker/docker-compose.yml`: Forward `VAPID_SUBJECT: ${VAPID_SUBJECT:?set in .env}` under `hestia-service.environment`.
  * `scripts/generate-secrets.sh`: Include `'VAPID_SUBJECT'` in the `fromEnvironment` array so existing shell environment overrides are preserved, while defaulting to `.env.example`'s value.
  * `e2e/setup/stack.ts`: Pass `VAPID_SUBJECT: 'mailto:admin@aberrance.app'` when calling `generate-secrets.sh`.
  * `docs/deployment.md`: Update the environment variables table and remove the obsolete paragraph discussing fallback derivations.
- **Unit Tests (`apps/service/src/env.test.ts`)**:
  * Add `VAPID_SUBJECT: 'mailto:admin@aberrance.app'` to `REQUIRED`.
  * Assert that omitting `VAPID_SUBJECT` fails fast at startup.
  * Assert that non-contact URIs (e.g. `http://...`, plain string, `mailto:not-an-email`) are rejected.
  * Remove tests that verified derivation from `HESTIA_OWNER_EMAIL` or `HESTIA_ORIGIN`.

---

### 1.2 Ingress Static Asset Caching & Cloudflare Edge Rules (`EDGE-01`)

Modern Single Page Applications (SPAs) built with Vite use content-hashed filenames for static assets (JavaScript bundles, CSS stylesheets, images). These hashed files can be cached permanently. Conversely, the HTML entrypoint (`index.html`) and the service worker script (`sw.js`) must never be cached without revalidation; otherwise, client browsers will fail to detect new deployments.

#### Caddy Ingress Directives (`docker/Caddyfile`)
Caddy serves the built PWA files from `/srv`. Three distinct caching tiers must be configured using explicit path matchers:

```caddy
# Cache-Control policies
@assets path /assets/*
header @assets Cache-Control "public, max-age=31536000, immutable"

@entry path / /index.html /sw.js
header @entry Cache-Control "no-cache, must-revalidate"

@icons_manifest path /icons/* /manifest.webmanifest /favicon.ico
header @icons_manifest Cache-Control "public, max-age=86400, must-revalidate"
```

*Note on SPA fallback:* In Caddy, `try_files {path} /index.html` rewrites unmatched routes (e.g., `/chores`, `/bills`) to `/index.html`. Placing the `@entry` header directive ensures that client navigations landing on `/index.html` or `/` are served with `no-cache, must-revalidate`.

#### Automated Ingress Testing
- **Static Unit Check (`apps/service/src/ingress-config.test.ts`)**:
  Add assertions checking that `caddyDirectives` contains the `@assets`, `@entry`, and `@icons_manifest` matchers and their corresponding `Cache-Control` header directives.
- **Integration Test (`e2e/tests/20-ingress-client-ip-and-csp.spec.ts`)**:
  Add Playwright assertions querying the live Caddy container in the E2E stack:
  * `GET /index.html` returns `Cache-Control: no-cache, must-revalidate`.
  * `GET /sw.js` returns `Cache-Control: no-cache, must-revalidate`.
  * `GET /assets/*` (using a resolved file from Vite build manifest or fixtures) returns `Cache-Control: public, max-age=31536000, immutable`.
  * `GET /manifest.webmanifest` returns `Cache-Control: public, max-age=86400, must-revalidate`.

#### Cloudflare Edge Cache Rules (`docs/deployment.md`)
Cloudflare by default caches certain static file extensions, but respects origin `Cache-Control` headers when configured via **Cache Rules**:
- **Rule Name:** `Cache Hestia Static Assets`
- **Expression:** `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/assets/")`
- **Settings:**
  * Cache eligibility: `Eligible for cache`
  * Edge TTL: `Respect origin` (falls back to 1 year / 31536000s)
  * Browser TTL: `Respect origin`
- **Verification:**
  ```bash
  curl -sI https://hestia.aberrance.app/assets/<bundle>.js | grep -iE 'cf-cache-status|cache-control'
  ```
  First request returns `cf-cache-status: MISS` (or `DYNAMIC`); immediate subsequent request returns `cf-cache-status: HIT` and `Cache-Control: public, max-age=31536000, immutable`.

---

### 1.3 Cloudflare WAF Rate Limiting Policy for `/auth/v1/*` (`EDGE-01`)

GoTrue authentication endpoints (`/auth/v1/token`, `/auth/v1/otp`, `/auth/v1/recover`, etc.) are exposed through Kong. While internal rate limiting exists at the Fastify service level (`HESTIA_RATE_LIMIT_PER_MINUTE=300`), edge rate limiting prevents credential stuffing, password guessing, and distributed denial-of-service before requests reach the host server.

#### Policy Design
- **Target Endpoint Scope:** `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/auth/v1/") and http.request.method eq "POST"`
  * **Critical Distinction:** Only `POST` requests are rate limited. This protects sensitive operations (`/token`, `/otp`, `/verify`, `/recover`) while preventing read-only operations (`GET /auth/v1/user`, which is called frequently by the client to verify session state) from exhausting the quota.
- **Threshold:** 15 requests per 1-minute window per client IP.
  * Balances attack mitigation against normal household usage where multiple family devices connect over the same household NAT / public IP.
- **Mitigation Action:** **Managed Challenge** (Cloudflare Turnstile challenge) with a **10-minute action duration**.
  * Automated attack bots fail the challenge and are blocked.
  * Human household members experiencing a false positive solve the challenge transparently without being locked out.
- **Runbook in `docs/deployment.md`:**
  Document exact dashboard navigation:
  1. Cloudflare Dashboard → Domain `aberrance.app` → **Security** → **WAF** → **Rate limiting rules** → **Create rule**.
  2. Rule name: `Protect Hestia Auth Endpoints`.
  3. Expression: `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/auth/v1/") and http.request.method eq "POST"`.
  4. Rate: `15` requests per `1 minute`.
  5. Action: `Managed Challenge`, duration `10 minutes`.
  6. Include curl test script:
     ```bash
     # Simulation script: Send 16 rapid requests to test challenge trigger
     for i in $(seq 1 16); do
       curl -s -o /dev/null -w "%{http_code}\n" -X POST https://hestia.aberrance.app/auth/v1/otp \
         -H "Content-Type: application/json" -d '{"email":"probe@example.com"}'
     done
     # Requests 1-15 return 400/422/200; request 16 returns 403 (Cloudflare Managed Challenge)
     ```

---

### 1.4 Operator CLI & Standalone PWA Verification (`PUSH-02`)

To verify push notifications on real iOS and Android devices without manipulating cron schedules or modifying database records, an administrative CLI command is needed.

#### Architecture of `hestia-admin test-push`
- **Location:** Integrated into `apps/service/src/cli.ts` alongside `reset-password`.
- **Root Script Wrapper:** Add `"hestia-admin": "pnpm --filter @hestia/service exec hestia-admin"` to root `package.json`.
- **Command Syntax:**
  ```bash
  # Inside container:
  docker compose exec hestia-service hestia-admin test-push --email <user-email> [--title <title>] [--body <body>]

  # Local development:
  pnpm hestia-admin test-push --email <user-email> [--title <title>] [--body <body>]
  ```
- **CLI Implementation Details:**
  1. Argument Parsing: Support subcommands `reset-password <email>` and `test-push`. For `test-push`, parse flags `--email` (required), `--title` (optional, defaults to `'Test Push Notification'`), and `--body` (optional, defaults to `'This is a test notification from Hestia.'`).
  2. Input Validation: Email must pass `z.string().email()`.
  3. User Lookup: Query `public.profile` for `id` where `lower(email) = lower($1)`. If no matching profile exists, output `No user has the email <email>.` to `stderr` and exit with code 1.
  4. Active Subscription Retrieval: Query `public.push_subscription` for rows where `user_id = $1`.
  5. No Subscriptions Handling: If zero subscriptions are found, output `User <email> has no active push subscriptions.` to `stderr` and exit with code 1.
  6. Notification Dispatch:
     * Construct payload:
       ```json
       {
         "title": "<title>",
         "body": "<body>",
         "url": "/"
       }
       ```
     * For each subscription, send via `PushTransport` (`createWebPushTransport` in production or mock in unit tests).
     * If the push service returns `gone` (404/410), delete the expired subscription from `public.push_subscription`.
     * Report summary to stdout: `Dispatched test push to N device(s) for <email>: X accepted, Y gone, Z failed.`. Exit with code 0 if at least one device accepted (or if dispatches completed).
- **Unit & Integration Tests (`apps/service/src/cli.test.ts`)**:
  * Test argument parsing: missing `--email`, invalid email format, unknown subcommands.
  * Test non-existent user returns code 1 and descriptive error.
  * Test user with no subscriptions returns code 1 and descriptive notice.
  * Test successful dispatch to 1 or more subscriptions prints accepted count and returns code 0.
  * Test removal of expired subscriptions when outcome is `gone`.

#### Standalone Mobile PWA Verification Runbook (`docs/deployment.md`)
iOS Safari 16.4+ and Android Chrome enforce specific constraints for Web Push:
1. **iOS Safari (16.4+) Requirements:**
   - Origin must be HTTPS (satisfied by `https://hestia.aberrance.app`).
   - Web App **must** be installed to the Home Screen (`display: standalone`). Web Push is completely unavailable in standard Safari browser tabs.
   - User gesture requirement: Permission can only be requested in response to a direct tap (handled in `NotificationTypes.tsx`).
   - Apple Push Notification Service (APNs) enforces valid RFC 8292 VAPID JWT claims (`mailto:` contact claim).
2. **Android Chrome Requirements:**
   - Site must serve valid PWA manifest with icons (`manifest.webmanifest`).
   - Installed PWA receives push via Google Firebase Cloud Messaging (FCM).
3. **Runbook Steps:**
   - Step 1: Open `https://hestia.aberrance.app` in iOS Safari (or Android Chrome).
   - Step 2: Tap Share → **Add to Home Screen** (or Chrome install prompt).
   - Step 3: Launch Hestia from the Home Screen (verify standalone display without browser URL bar).
   - Step 4: Sign in with magic link or password.
   - Step 5: Navigate to **Settings → Notifications**, toggle on any notification type (e.g. Chore reminders), and tap **Allow** on the native prompt.
   - Step 6: On the host server, run:
     ```bash
     docker compose exec hestia-service hestia-admin test-push --email <user-email>
     ```
   - Step 7: Confirm notification banner appears on device lock screen / notification shade, with title "Test Push Notification", and tapping it opens Hestia.

---

### 1.5 Quality Ratchet & Verification Gate (`VERIFY-01`)

To close Milestone v2.0, all quality gates across the monorepo must be green with zero warnings, zero dead code, zero unauthorized duplications, and full test suite passing.

#### Verification Suite Matrix
| Check | Command | Acceptance Criteria |
|---|---|---|
| **Lint** | `pnpm lint` | 0 warnings, 0 errors |
| **Formatting** | `pnpm format:check` | All files adhere to Prettier rules |
| **Typecheck** | `pnpm typecheck` | Clean across all 7 workspace projects |
| **Unit Tests** | `pnpm test` | All package & service unit tests pass |
| **Dead Code** | `pnpm knip` | No unused files, exports, or dependencies |
| **Knip Baseline** | `node scripts/check-knip-baseline.mjs` | Findings match production baseline exactly |
| **Code Duplication** | `pnpm jscpd` | Total duplication <= 2.0% (currently 1.19%) |
| **Repo Hygiene** | `node scripts/check-repo-hygiene.mjs` | Clean (no CRLF, valid permissions, no legacy names) |
| **Migration Safety** | `node scripts/check-migrations-append-only.mjs` | Migrations are strictly append-only |
| **Production Build** | `pnpm build` | All packages and Docker-ready bundles build cleanly |

---

## 2. Validation Architecture

Nyquist validation guarantees that every requirement is backed by concrete, deterministic test harnesses and verification commands.

### 2.1 Test Categories & Fast Feedback Loops

```
+-------------------------------------------------------------------------+
|                           Fast Feedback Loop                            |
|             pnpm --filter @hestia/service test src/env.test.ts          |
|             pnpm --filter @hestia/service test src/cli.test.ts          |
|             pnpm --filter @hestia/service test src/ingress-config.test.ts|
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                        Monorepo Quality Gate                            |
|                     pnpm lint && pnpm typecheck                         |
|                     pnpm test && pnpm jscpd && pnpm knip                |
|                     node scripts/check-repo-hygiene.mjs                 |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                        Integration & E2E Gate                           |
|       pnpm --filter @hestia/e2e test:e2e tests/20-ingress*.spec.ts       |
+-------------------------------------------------------------------------+
```

### 2.2 Test Invariants & Seams

1. **`VAPID_SUBJECT` Strict Enforcement (`PUSH-01`)**:
   - *Test file:* `apps/service/src/env.test.ts`
   - *Invariants checked:*
     * Missing or empty `VAPID_SUBJECT` throws error naming `VAPID_SUBJECT`.
     * `http://...` URIs are rejected.
     * Malformed `mailto:` (e.g. `mailto:not-an-email`) is rejected.
     * Valid `mailto:admin@aberrance.app` and `https://hestia.aberrance.app` pass validation.
     * Error messages never echo sensitive household data or environment secrets.
     * Obsolete fallback derivation tests are removed.

2. **Ingress Caching Headers (`EDGE-01`)**:
   - *Static test file:* `apps/service/src/ingress-config.test.ts`
     * Asserts `docker/Caddyfile` contains `@assets path /assets/*` with `Cache-Control "public, max-age=31536000, immutable"`.
     * Asserts `docker/Caddyfile` contains `@entry path / /index.html /sw.js` with `Cache-Control "no-cache, must-revalidate"`.
     * Asserts `docker/Caddyfile` contains `@icons_manifest path /icons/* /manifest.webmanifest /favicon.ico` with `Cache-Control "public, max-age=86400, must-revalidate"`.
   - *Live E2E test file:* `e2e/tests/20-ingress-client-ip-and-csp.spec.ts`
     * Queries `/index.html` via Playwright API request: verifies `cache-control: no-cache, must-revalidate`.
     * Queries `/sw.js`: verifies `cache-control: no-cache, must-revalidate`.
     * Queries an asset under `/assets/*`: verifies `cache-control: public, max-age=31536000, immutable`.
     * Queries `/manifest.webmanifest`: verifies `cache-control: public, max-age=86400, must-revalidate`.

3. **Administrative Push CLI (`PUSH-02`)**:
   - *Test file:* `apps/service/src/cli.test.ts`
   - *Invariants checked:*
     * `hestia-admin test-push` without `--email` outputs usage and exits code 2.
     * Invalid email argument outputs `Not an email address: ...` and exits code 2.
     * Unknown user lookup outputs `No user has the email <email>.` and exits code 1.
     * User with zero subscriptions outputs `User <email> has no active push subscriptions.` and exits code 1.
     * User with valid subscriptions dispatches payload via mock `PushTransport`, removes any `gone` subscriptions, reports summary, and exits code 0.
     * Direct invocation test (`runInvokedDirectly`) tests script entrypoint with throwaway HTTP server / mock database.

4. **Zero Regressions & Hygiene (`VERIFY-01`)**:
   - `scripts/check-repo-hygiene.mjs`: Ensures no legacy name leaks or retired ingress terms in any tracked files.
   - `scripts/check-knip-baseline.mjs`: Ensures no new dead code or orphaned exports.
   - `jscpd`: Ensures codebase duplication remains under 2.0%.

---

## 3. Plan Decomposition Recommendation

To implement Phase 11 cleanly and manage risk effectively, the work should be split into 4 sequential plans:

### Plan 11-01: RFC 8292 VAPID Subject Enforcement (`PUSH-01`)
- **Scope:**
  * Update `apps/service/src/env.ts` with strict `VAPID_SUBJECT` schema validation (`isContactUri`) and retire fallback derivation in `vapidSubjectFor`.
  * Pre-populate `VAPID_SUBJECT=mailto:admin@aberrance.app` in `.env.example`, `docker/docker-compose.yml`, `scripts/generate-secrets.sh`, and `e2e/setup/stack.ts`.
  * Update `apps/service/src/env.test.ts` to assert strict validation and retire obsolete fallback tests.
  * Update `docs/deployment.md` environment variable documentation.
- **Verification:** `pnpm --filter @hestia/service test src/env.test.ts` passes; `pnpm typecheck` passes.

### Plan 11-02: Ingress Caching & Cloudflare Edge Hardening (`EDGE-01`)
- **Scope:**
  * Update `docker/Caddyfile` with explicit `Cache-Control` header directives for `/assets/*`, `/index.html`, `/sw.js`, and icons/manifest.
  * Add static unit tests in `apps/service/src/ingress-config.test.ts` verifying Caddy matchers and headers.
  * Add automated Playwright tests in `e2e/tests/20-ingress-client-ip-and-csp.spec.ts` asserting exact headers against running Caddy.
  * Add Cloudflare Edge Caching and Cloudflare WAF Rate Limiting documentation and verification runbooks to `docs/deployment.md`.
- **Verification:** `pnpm --filter @hestia/service test src/ingress-config.test.ts` passes; `e2e/tests/20-ingress-client-ip-and-csp.spec.ts` passes.

### Plan 11-03: Mobile Push CLI Tool & Verification Runbook (`PUSH-02`)
- **Scope:**
  * Implement `hestia-admin test-push --email <email> [--title <title>] [--body <body>]` in `apps/service/src/cli.ts`.
  * Add `"hestia-admin"` script wrapper in root `package.json`.
  * Add comprehensive unit and integration tests in `apps/service/src/cli.test.ts`.
  * Add Standalone PWA mobile push verification runbook (iOS Safari 16.4+ and Android Chrome) to `docs/deployment.md`.
- **Verification:** `pnpm --filter @hestia/service test src/cli.test.ts` passes; CLI manual invocation succeeds.

### Plan 11-04: Full Quality Gate Ratchet & Milestone Verification (`VERIFY-01`)
- **Scope:**
  * Run full CI ratchet: lint, format check, typecheck, unit tests, integration tests, knip, jscpd, repo hygiene, append-only migrations check, and production build.
  * Update roadmap and state artifacts to mark Phase 11 and Milestone v2.0 complete.
- **Verification:** 100% green gate across all CI commands.

---

## 4. Potential Pitfalls & Mitigation Strategies

| Risk / Pitfall | Impact | Mitigation Strategy |
|---|---|---|
| **Caddy header evaluation order** | If Caddy evaluates headers after rewrites or inside conflicting blocks, `Cache-Control` might not apply to rewritten `/index.html`. | Test both exact path matchers (`@entry path / /index.html /sw.js`) and live E2E assertions against Caddy container in `e2e/tests/20-ingress-client-ip-and-csp.spec.ts`. |
| **`cli.ts` database connectivity** | The CLI executable needs access to `public.push_subscription` which requires `DATABASE_URL`. | Use service role database capability (`asServiceRole`) within `cli.ts` when executing `test-push`, while keeping `reset-password` lightweight (GoTrue only). |
| **Legacy name check failure** | Introducing the former brand name in comments, docs, or tests triggers `check-repo-hygiene.mjs`. | Strictly refer to "the former name" or keep historical quotes within the existing allowlist. |
| **JSCPD duplication threshold spike** | Adding argument parsing or test fixtures could push total code duplication above 2.0%. | Share types and helpers cleanly; run `pnpm jscpd` before committing new code. |
| **VAPID email address validation edge cases** | Valid RFC 6068 `mailto:` URIs might contain query parameters (e.g. `mailto:admin@aberrance.app?subject=test`). | Parse the pathname of the URL before validating against `z.string().email()`. |

---

## RESEARCH COMPLETE
