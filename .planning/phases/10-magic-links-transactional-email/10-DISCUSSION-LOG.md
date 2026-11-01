# Phase 10: Magic Links & Transactional Email - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-01
**Phase:** 10-Magic Links & Transactional Email
**Areas discussed:** SMTP Provider & Sender Identity, E2E Testing & Email Interception, User Creation & Signup Boundary, Token Expiry & Rate Limiting

---

## SMTP Provider & Sender Identity

| Option | Description | Selected |
|--------|-------------|----------|
| Resend (smtp.resend.com:465) | Pre-configured for Resend with port 465 (TLS), user 'resend', and API key password; simple Cloudflare DNS setup. | ✓ |
| Postmark (smtp.postmarkapp.com:587) | Pre-configured for Postmark with STARTTLS on port 587 using server token. | |
| Provider-agnostic / Generic SMTP | Expose standard GOTRUE_SMTP_* variables with neutral defaults and document Resend and Postmark setup in docs/deployment.md. | |

**User's choice:** Resend (smtp.resend.com:465)
**Notes:** Configures GoTrue for Resend by default.

---

| Option | Description | Selected |
|--------|-------------|----------|
| auth@aberrance.app | Dedicated security/authentication address; cleanly separates auth tokens from general notifications. | ✓ |
| hestia@aberrance.app | Unified brand address for all application emails. | |
| You decide | Either is fine; pick the cleanest standard for GoTrue and DNS. | |

**User's choice:** auth@aberrance.app
**Notes:** Dedicated authentication address under aberrance.app.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standard GOTRUE_SMTP_* variables directly in .env.example | Matches GoTrue's native configuration without an unnecessary mapping layer; GOTRUE_SMTP_PASS is required when magic link is enabled. | ✓ |
| HESTIA_SMTP_* variables mapped in docker-compose.yml | Maintains strict HESTIA_* naming consistency in .env, mapping to GOTRUE_SMTP_* inside Compose. | |
| You decide | Planner selects the cleanest convention matching the rest of docker-compose.yml. | |

**User's choice:** Standard GOTRUE_SMTP_* variables directly in .env.example
**Notes:** Direct mapping keeps Compose and GoTrue standard.

---

| Option | Description | Selected |
|--------|-------------|----------|
| In docs/deployment.md under 'Transactional Email (SMTP & DNS)' | Keeps all operational deployment runbooks centralized without fragmenting into extra files. | ✓ |
| Create a standalone docs/email.md guide | Dedicated runbook for SMTP provisioning and DNS verification. | |
| You decide | Follow repo documentation architecture from Phase 7. | |

**User's choice:** In docs/deployment.md under 'Transactional Email (SMTP & DNS)'
**Notes:** Centralized in existing runbook.

---

| Option | Description | Selected |
|--------|-------------|----------|
| GoTrue default built-in template | Uses GoTrue's clean built-in magic link template (contains 'Your Magic Link' with both clickable button and 6-digit OTP code) with default subject line 'Your Magic Link'. | ✓ |
| Custom HTML/text templates mounted in Compose | Mount custom branded templates in docker/gotrue-templates/ with custom subject line like 'Your Hestia sign-in code'. | |
| You decide | Start with built-in templates; evaluate custom templates if needed. | |

**User's choice:** GoTrue default built-in template
**Notes:** Built-in template works cleanly and includes both link and code.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep GOTRUE_MAILER_AUTOCONFIRM: 'true' | Magic link and OTP verification inherently verify possession of the inbox; avoids unnecessary intermediate unconfirmed states. | ✓ |
| Set GOTRUE_MAILER_AUTOCONFIRM: 'false' | Enforces strict confirmation state machine in GoTrue auth tables. | |
| You decide | Keep current behavior unless magic link specifically requires changing it. | |

**User's choice:** Keep GOTRUE_MAILER_AUTOCONFIRM: 'true'
**Notes:** Retains existing auto-confirm setting.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Defaults with empty password fallback (${GOTRUE_SMTP_PASS:-}) | Allows local dev and non-magic-link stacks to boot without failure; production deployment checklist enforces setting the secret when magic links are enabled. | ✓ |
| Strict required check (${GOTRUE_SMTP_PASS:?set in .env}) | Compose fails immediately on boot if SMTP password is empty. | |
| You decide | Pick the pattern most resilient across dev, E2E, and production. | |

**User's choice:** Defaults with empty password fallback (${GOTRUE_SMTP_PASS:-})
**Notes:** Prevents local dev and test breakage while enforcing on deploy.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Add GOTRUE_SMTP_PASS to fromEnvironment in generate-secrets.sh | Allows automated passing via env if desired, otherwise keeps blank placeholder in generated /srv/hestia/.env. | ✓ |
| Keep generate-secrets.sh unchanged | Treat SMTP credentials purely as manual operator edits in .env. | |
| You decide | Match generate-secrets.sh conventions for external credentials like CLOUDFLARE_TUNNEL_TOKEN. | |

**User's choice:** Add GOTRUE_SMTP_PASS to fromEnvironment in generate-secrets.sh
**Notes:** Follows same pattern as CLOUDFLARE_TUNNEL_TOKEN.

---

## E2E Testing & Email Interception

| Option | Description | Selected |
|--------|-------------|----------|
| Inbucket mail-catcher service in E2E overlay (e2e/docker-compose.e2e.yml) | GoTrue points to Inbucket SMTP (port 2500); Playwright fetches the received email and OTP code via Inbucket's REST API. Matches standard Supabase local dev pattern. | ✓ |
| Query GoTrue database directly in test helper | Test helper queries Postgres auth tables for the issued token without running an extra mail container. | |
| Dedicated test-only endpoint in hestia-service | Similar to /api/test/push for Web Push test double. | |

**User's choice:** Inbucket mail-catcher service in E2E overlay (e2e/docker-compose.e2e.yml)
**Notes:** Fully offline, reproducible email validation in Playwright.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full coverage: OTP code entry, direct link click, and error validation | Tests both mobile PWA standalone flow (entering 6-digit code) and browser link navigation, plus invalid code handling and resend timer. | ✓ |
| OTP code entry and validation only | Focus strictly on the 6-digit code entry flow which is the primary path required for installed standalone PWAs. | |
| You decide | Cover the critical user journeys and regression edges. | |

**User's choice:** Full coverage: OTP code entry, direct link click, and error validation
**Notes:** Comprehensive E2E test coverage in 07-magic-link.spec.ts.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Set HESTIA_MAGIC_LINK_ENABLED=true in .env.example and stack.ts | Defaulting to true fulfills AUTH-01 across both default installs and E2E test runs; the PWA compiles with magic link routes active. | ✓ |
| Default false in .env.example, override true only in e2e/setup/stack.ts | Magic link stays opt-in for host deployments until explicitly turned on in /srv/hestia/.env. | |
| You decide | Select the configuration that best balances developer quickstart with production defaults. | |

**User's choice:** Set HESTIA_MAGIC_LINK_ENABLED=true in .env.example and stack.ts
**Notes:** Aligns production example and E2E harness.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic free loopback port (HESTIA_E2E_INBUCKET_PORT) | Follows exact same pattern as CADDY_PORT and DB_PORT in e2e/support/env.ts, completely preventing port collisions. | ✓ |
| Fixed loopback port (127.0.0.1:9000) | Hardcoded port mapping; simpler but fails if 9000 is occupied on the test machine. | |
| You decide | Follow existing E2E multi-run isolation patterns in e2e/setup/stack.ts. | |

**User's choice:** Dynamic free loopback port (HESTIA_E2E_INBUCKET_PORT)
**Notes:** Consistent with existing port allocator.

---

## User Creation & Signup Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Existing household users only (shouldCreateUser: false) | Prevents arbitrary public visitors from creating orphaned auth accounts; new members must join via household invite or admin provisioning. | ✓ |
| Allow user creation (shouldCreateUser: true) | Anyone entering an email gets an auth account created in GoTrue immediately upon code verification. | |
| You decide | Select the option that preserves Hestia's single-household security model. | |

**User's choice:** Existing household users only (shouldCreateUser: false)
**Notes:** Preserves single-household isolation boundary.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Clear message: 'No account found with this email. Ask your household admin for an invite.' | Avoids family members waiting indefinitely for an email when they made a typo or haven't been added to the household. | ✓ |
| Generic failure message: 'Couldn't send a sign-in link. Try again.' | Standard anti-enumeration response, does not confirm whether an account exists. | |
| You decide | Pick whichever best matches Hestia's private household threat model. | |

**User's choice:** Clear message: 'No account found with this email. Ask your household admin for an invite.'
**Notes:** Clear feedback for family members.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Set GOTRUE_DISABLE_SIGNUP: 'true' | Defense-in-depth: prevents direct public GoTrue signups; hestia-service still provisions members via service_role admin API. | ✓ |
| Keep GOTRUE_DISABLE_SIGNUP: 'false' | Leave GoTrue signup toggle alone and rely on shouldCreateUser: false on the client. | |
| You decide | Verify service_role admin compatibility and pick safest configuration. | |

**User's choice:** Set GOTRUE_DISABLE_SIGNUP: 'true'
**Notes:** Locks raw public signups to GoTrue.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep existing link layout | Reuses the existing styled link in SignInScreen.tsx; passes existing unit and component tests without UI disruption. | |
| Upgrade to secondary button with 'or' divider | Makes magic link more prominent as an alternative sign-in method above the password recovery link. | ✓ |
| You decide | Planner checks UI-SPEC / design consistency. | |

**User's choice:** Upgrade to secondary button with 'or' divider
**Notes:** Elevates magic link to first-class sign-in button.

---

## Token Expiry & Rate Limiting

| Option | Description | Selected |
|--------|-------------|----------|
| Tighten to 15 minutes (GOTRUE_MAILER_OTP_EXP: 900) | Standard modern security window for OTP codes and magic links; plenty of time to retrieve email without lingering credentials. | ✓ |
| Keep 1 hour (GOTRUE_MAILER_OTP_EXP: 3600) | More forgiving for delayed transactional relays or users opening links much later. | |
| You decide | Follow security best practices. | |

**User's choice:** Tighten to 15 minutes (GOTRUE_MAILER_OTP_EXP: 900)
**Notes:** Shorter window aligns with security standards.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit rate limit: GOTRUE_RATE_LIMIT_EMAIL_SENT: 30 | Pins an explicit ceiling of 30 emails/hour per recipient; protects against abuse and Resend quota exhaustion. | |
| Rely on GoTrue defaults | Do not set GOTRUE_RATE_LIMIT_EMAIL_SENT explicitly in docker-compose.yml. | ✓ |
| You decide | Set reasonable guardrails in Compose. | |

**User's choice:** Rely on GoTrue defaults
**Notes:** Keep Compose environment minimal.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 30 seconds (RESEND_AFTER_SECONDS = 30) | Fast enough for impatient users checking their inbox; already covered by existing Vitest tests in magic-link.test.tsx. | ✓ |
| Increase to 60 seconds (RESEND_AFTER_SECONDS = 60) | Discourages rapid repeated clicks before transactional relays deliver. | |
| You decide | Keep current timing unless testing suggests otherwise. | |

**User's choice:** Keep 30 seconds (RESEND_AFTER_SECONDS = 30)
**Notes:** Preserves tested timing.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Verify and pin with tests | Ensure GOTRUE_SITE_URL and GOTRUE_URI_ALLOW_LIST strictly resolve to HESTIA_ORIGIN in production and loopback in E2E, preventing open redirect risks. | ✓ |
| Leave as configured in Compose without separate test assertion | Rely on docker-compose.yml variable interpolation. | |
| You decide | Add necessary test assertions matching repository standards. | |

**User's choice:** Verify and pin with tests
**Notes:** Pinned via test assertions.

---

## The Agent's Discretion

- Inbucket Docker image tag (`inbucket/inbucket:3.1.0`) and healthcheck configuration.
- Playwright Inbucket client helper implementation details.
- Exact CSS styling and spacing for the "or" divider and secondary button in `SignInScreen.tsx`.

## Deferred Ideas

- None — discussion stayed within phase scope.

