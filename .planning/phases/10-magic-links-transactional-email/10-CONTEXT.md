# Phase 10: Magic Links & Transactional Email - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable passwordless magic link and 6-digit OTP code authentication in the Hestia web PWA, backed by GoTrue transactional SMTP email delivery via Resend (`AUTH-01` through `AUTH-05`).

- Activate build arguments and runtime environment flags (`VITE_MAGIC_LINK_ENABLED=true`, `HESTIA_MAGIC_LINK_ENABLED=true`).
- Activate and verify magic link routes (`/sign-in/link`, `/sign-in/code`) and upgraded sign-in entry point in the PWA.
- Configure GoTrue SMTP settings (`GOTRUE_SMTP_*`) supporting Resend on port 465 with sender address `auth@aberrance.app` and sender name "Hestia".
- Lock GoTrue site URL and URI allow-list strictly to `https://hestia.aberrance.app` and `https://hestia.aberrance.app/**`.
- Replace `07-magic-link-disabled.spec.ts` with Playwright E2E tests validating the active magic link request, Inbucket OTP interception, 6-digit code entry flow, and direct link verification.

Out of scope:
- Web Push VAPID subject `mailto:admin@aberrance.app` and iOS/Android device push verification (Phase 11: `PUSH-01`, `PUSH-02`).
- Cloudflare edge caching rules and WAF rate limits (Phase 11: `EDGE-01`).
- Multi-household tenant partitioning or third-party OAuth providers.

</domain>

<decisions>
## Implementation Decisions

### SMTP Provider & Sender Identity
- **D-01:** Target Resend as primary transactional provider (`smtp.resend.com:465`, TLS, user `resend`, API key as password).
- **D-02:** Sender mailbox pinned to `auth@aberrance.app` with sender display name "Hestia". Cleanly separates authentication security tokens from general application notifications.
- **D-03:** Standard `GOTRUE_SMTP_*` variable names directly in `.env.example` and `docker/docker-compose.yml` (`GOTRUE_SMTP_HOST`, `GOTRUE_SMTP_PORT`, `GOTRUE_SMTP_USER`, `GOTRUE_SMTP_PASS`, `GOTRUE_SMTP_ADMIN_EMAIL`, `GOTRUE_SMTP_SENDER_NAME`). No redundant mapping layer.
- **D-04:** Document DNS records (SPF, DKIM, DMARC for `aberrance.app` under Resend) in `docs/deployment.md` under a dedicated "Transactional Email (SMTP & DNS)" section.
- **D-05:** Use GoTrue's built-in email template ("Your Magic Link" with both clickable link and 6-digit OTP code) — no custom template volume mounts needed.
- **D-06:** Keep `GOTRUE_MAILER_AUTOCONFIRM: 'true'` in Compose — entering the OTP code or clicking the magic link inherently verifies inbox possession.
- **D-07:** `GOTRUE_SMTP_PASS` in Compose uses default empty fallback `${GOTRUE_SMTP_PASS:-}` so non-magic local dev stacks boot without error; production deployment checklist enforces setting the secret when magic links are enabled.
- **D-08:** `scripts/generate-secrets.sh` adds `GOTRUE_SMTP_PASS` to `fromEnvironment` list.

### E2E Testing & Email Interception
- **D-09:** Add `inbucket` mail-catcher service in `e2e/docker-compose.e2e.yml`. In E2E, GoTrue points to `inbucket:2500` (SMTP) and Playwright queries Inbucket's REST API (`/api/v1/mailbox/{email}`) to fetch the received 6-digit OTP code and magic link.
- **D-10:** Replaced E2E spec `07-magic-link.spec.ts` provides full coverage: 6-digit OTP code entry, direct link navigation, invalid code handling, and resend timer cooldown.
- **D-11:** Set `HESTIA_MAGIC_LINK_ENABLED=true` in `.env.example` and `e2e/setup/stack.ts` so all production builds and E2E runs compile with magic link routes enabled by default.
- **D-12:** Expose Inbucket REST API via dynamic free loopback port `HESTIA_E2E_INBUCKET_PORT` in `e2e/support/env.ts` and `e2e/setup/stack.ts`, preventing port collisions.

### User Creation & Signup Boundary
- **D-13:** Pass `options: { shouldCreateUser: false, emailRedirectTo: ... }` to `auth.signInWithOtp` in `apps/web/src/lib/auth/auth-client.ts`. Magic link only authenticates existing invited household members; public visitors cannot create orphaned auth accounts.
- **D-14:** When an unknown email is submitted, `MagicLinkRequestScreen` shows a clear, helpful message: "No account found with this email. Ask your household admin for an invite."
- **D-15:** Set `GOTRUE_DISABLE_SIGNUP: 'true'` in `docker/docker-compose.yml`. Prevents direct public signups against GoTrue's `/auth/v1/signup`; `hestia-service` provisions members through `service_role` admin API.
- **D-16:** Upgrade the magic link entry point in `apps/web/src/screens/onboarding/SignInScreen.tsx` to a secondary button with an "or" divider above the password recovery link.

### Token Expiry & Rate Limiting
- **D-17:** Tighten OTP validity to 15 minutes (`GOTRUE_MAILER_OTP_EXP: 900`) in `docker/docker-compose.yml`.
- **D-18:** Rely on GoTrue's built-in email rate limits without pinning custom limits in Compose; Caddy and Kong continue passing real client IP via `X-Forwarded-For`.
- **D-19:** Keep 30-second frontend resend cooldown timer (`RESEND_AFTER_SECONDS = 30`).
- **D-20:** Verify and pin with tests that `GOTRUE_SITE_URL` and `GOTRUE_URI_ALLOW_LIST` strictly resolve to `HESTIA_ORIGIN` (`https://hestia.aberrance.app` in production and loopback origin in E2E), preventing open redirect vulnerabilities.

### The Agent's Discretion
- Exact Inbucket Docker image tag (`inbucket/inbucket:3.1.0` or official equivalent) and healthcheck in `e2e/docker-compose.e2e.yml`.
- Playwright Inbucket client helper implementation details (REST polling with retry timeout).
- Exact CSS styling and spacing for the "or" divider and secondary button in `SignInScreen.tsx`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` (Phase 10) — goal and 4 success criteria
- `.planning/REQUIREMENTS.md` (AUTH-01..AUTH-05) — acceptance criteria
- `.planning/PROJECT.md` — constraints (no open router ports, zero test regressions, append-only migrations)
- `.planning/research/DOMAIN-MIGRATION.md` §2 — Magic Links & GoTrue Transactional Email architecture
- `.planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-CONTEXT.md` — origin cutover, Caddy real-IP and proxy trust

### Configuration and deployment files
- `docker/docker-compose.yml` — GoTrue environment configuration, SMTP variables, caddy build args
- `docker/caddy.Dockerfile` — `ARG HESTIA_MAGIC_LINK_ENABLED`, `ENV VITE_MAGIC_LINK_ENABLED`
- `.env.example` — `HESTIA_MAGIC_LINK_ENABLED=true`, `GOTRUE_SMTP_*` settings
- `scripts/generate-secrets.sh` — `fromEnvironment` variable handling
- `docs/deployment.md` — Transactional email runbook and Cloudflare DNS instructions

### Frontend magic link files
- `apps/web/src/screens/onboarding/SignInScreen.tsx` — sign-in entry point, button upgrade
- `apps/web/src/screens/onboarding/MagicLinkRequestScreen.tsx` — email request screen and error handling
- `apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx` — 6-digit OTP code entry screen and resend timer
- `apps/web/src/screens/onboarding/magic-link.ts` — constants, messages, code normalization
- `apps/web/src/routes.tsx` — route registration under `VITE_MAGIC_LINK_ENABLED`
- `apps/web/src/lib/auth/auth-client.ts` — `sendSignInLink` with `shouldCreateUser: false`

### Test files
- `e2e/docker-compose.e2e.yml` — Inbucket container configuration
- `e2e/setup/stack.ts` — E2E stack bring-up, `HESTIA_E2E_INBUCKET_PORT`
- `e2e/tests/07-magic-link-disabled.spec.ts` — spec to be replaced by `07-magic-link.spec.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/screens/onboarding/MagicLinkRequestScreen.tsx`: Pre-built email request form with accessible status regions and error handling.
- `apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx`: Pre-built 6-digit OTP entry screen with deadline-based resend countdown and digit normalization.
- `apps/web/src/screens/onboarding/magic-link.test.tsx`: Existing Vitest component tests verifying magic link UI behaviors.
- `e2e/support/compose.ts` and `e2e/support/env.ts`: Compose runner and dynamic loopback port management for E2E runs.

### Established Patterns
- Build-time flags in Caddy Dockerfile: `ARG HESTIA_MAGIC_LINK_ENABLED` exposed to Vite as `VITE_MAGIC_LINK_ENABLED`.
- External services in E2E use isolated test doubles (e.g. Inbucket on internal bridge network with dynamic host port mapping).
- GoTrue client IP rate-limiting keyed to `X-Forwarded-For` supplied by Caddy and Kong.

### Integration Points
- `docker/docker-compose.yml`: GoTrue `auth` container environment variables.
- `e2e/docker-compose.e2e.yml`: `inbucket` service definition.
- `apps/web/src/lib/auth/auth-client.ts`: `sendSignInLink` method invoking GoTrue `signInWithOtp`.
- `apps/web/src/screens/onboarding/SignInScreen.tsx`: Sign-in screen actions layout.

</code_context>

<specifics>
## Specific Ideas

- Inbucket mail-catcher is the standard Supabase CLI tool for local email development; using it in E2E tests provides high-fidelity SMTP validation without external network calls.
- Upgrading "Email me a sign-in link" from a text link to a prominent secondary button with an "or" divider makes passwordless authentication first-class on mobile devices.

</specifics>

<deferred>
## Deferred Ideas

- Web Push VAPID subject `mailto:admin@aberrance.app` and iOS/Android device push verification — Phase 11 (`PUSH-01`, `PUSH-02`).
- Cloudflare edge caching rules and WAF rate limits — Phase 11 (`EDGE-01`).

</deferred>

---

*Phase: 10-Magic Links & Transactional Email*
*Context gathered: 2026-11-01*
