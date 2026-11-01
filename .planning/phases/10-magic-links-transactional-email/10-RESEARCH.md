# Phase 10: Magic Links & Transactional Email - Research

**Researched:** 2026-11-01  
**Domain:** GoTrue SMTP configuration (Resend/Postmark), Inbucket mail-catcher in E2E, Web PWA passwordless authentication flows (`/sign-in/link`, `/sign-in/code`), token security, route code-splitting and bundling  
**Confidence:** HIGH (verified with pulled container images `inbucket/inbucket:3.1.0` and `gotrue:v2.196.0`, empirical SMTP dispatch and REST API retrieval tests, GoTrue binary inspection, and clean local Vite/Vitest runs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### SMTP Provider & Sender Identity
- **D-01:** Target Resend as primary transactional provider (`smtp.resend.com:465`, TLS, user `resend`, API key as password).
- **D-02:** Sender mailbox pinned to `auth@aberrance.app` with sender display name "Hestia". Cleanly separates authentication security tokens from general application notifications.
- **D-03:** Standard `GOTRUE_SMTP_*` variable names directly in `.env.example` and `docker/docker-compose.yml` (`GOTRUE_SMTP_HOST`, `GOTRUE_SMTP_PORT`, `GOTRUE_SMTP_USER`, `GOTRUE_SMTP_PASS`, `GOTRUE_SMTP_ADMIN_EMAIL`, `GOTRUE_SMTP_SENDER_NAME`). No redundant mapping layer.
- **D-04:** Document DNS records (SPF, DKIM, DMARC for `aberrance.app` under Resend) in `docs/deployment.md` under a dedicated "Transactional Email (SMTP & DNS)" section.
- **D-05:** Use GoTrue's email template capabilities with both clickable link and 6-digit OTP code — no custom template volume mounts needed in Compose.
- **D-06:** Keep `GOTRUE_MAILER_AUTOCONFIRM: 'true'` in Compose — entering the OTP code or clicking the magic link inherently verifies inbox possession.
- **D-07:** `GOTRUE_SMTP_PASS` in Compose uses default empty fallback `${GOTRUE_SMTP_PASS:-}` so non-magic local dev stacks boot without error; production deployment checklist enforces setting the secret when magic links are enabled.
- **D-08:** `scripts/generate-secrets.sh` adds `GOTRUE_SMTP_PASS` to `fromEnvironment` list.

#### E2E Testing & Email Interception
- **D-09:** Add `inbucket` mail-catcher service in `e2e/docker-compose.e2e.yml`. In E2E, GoTrue points to `inbucket:2500` (SMTP) and Playwright queries Inbucket's REST API (`/api/v1/mailbox/{email}`) to fetch the received 6-digit OTP code and magic link.
- **D-10:** Replaced E2E spec `07-magic-link.spec.ts` provides full coverage: 6-digit OTP code entry, direct link navigation, invalid code handling, and resend timer cooldown.
- **D-11:** Set `HESTIA_MAGIC_LINK_ENABLED=true` in `.env.example` and `e2e/setup/stack.ts` so all production builds and E2E runs compile with magic link routes enabled by default.
- **D-12:** Expose Inbucket REST API via dynamic free loopback port `HESTIA_E2E_INBUCKET_PORT` in `e2e/support/env.ts` and `e2e/setup/stack.ts`, preventing port collisions.

#### User Creation & Signup Boundary
- **D-13:** Pass `options: { shouldCreateUser: false, emailRedirectTo: ... }` to `auth.signInWithOtp` in `apps/web/src/lib/auth/auth-client.ts`. Magic link only authenticates existing invited household members; public visitors cannot create orphaned auth accounts.
- **D-14:** When an unknown email is submitted, `MagicLinkRequestScreen` shows a clear, helpful message: "No account found with this email. Ask your household admin for an invite."
- **D-15:** Set `GOTRUE_DISABLE_SIGNUP: 'true'` in `docker/docker-compose.yml`. Prevents direct public signups against GoTrue's `/auth/v1/signup`; `hestia-service` provisions members through `service_role` admin API.
- **D-16:** Upgrade the magic link entry point in `apps/web/src/screens/onboarding/SignInScreen.tsx` to a secondary button with an "or" divider above the password recovery link.

#### Token Expiry & Rate Limiting
- **D-17:** Tighten OTP validity to 15 minutes (`GOTRUE_MAILER_OTP_EXP: 900`) in `docker/docker-compose.yml`.
- **D-18:** Rely on GoTrue's built-in email rate limits without pinning custom limits in Compose; Caddy and Kong continue passing real client IP via `X-Forwarded-For`.
- **D-19:** Keep 30-second frontend resend cooldown timer (`RESEND_AFTER_SECONDS = 30`).
- **D-20:** Verify and pin with tests that `GOTRUE_SITE_URL` and `GOTRUE_URI_ALLOW_LIST` strictly resolve to `HESTIA_ORIGIN` (`https://hestia.aberrance.app` in production and loopback origin in E2E), preventing open redirect vulnerabilities.

### The Agent's Discretion
- Exact Inbucket Docker image tag (`inbucket/inbucket:3.1.0`) and healthcheck in `e2e/docker-compose.e2e.yml`.
- Playwright Inbucket client helper implementation details (`e2e/support/inbucket.ts` with REST polling and retry timeout).
- Exact CSS styling and spacing for the "or" divider and secondary button in `SignInScreen.tsx`.

### Deferred Ideas (OUT OF SCOPE)
- Web Push VAPID subject `mailto:admin@aberrance.app` and iOS/Android device push verification — Phase 11 (`PUSH-01`, `PUSH-02`).
- Cloudflare edge caching rules and WAF rate limits — Phase 11 (`EDGE-01`).
- Multi-household tenant partitioning or third-party OAuth providers.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **AUTH-01** | Enable magic link build arguments and runtime environment flags (`VITE_MAGIC_LINK_ENABLED=true`, `HESTIA_MAGIC_LINK_ENABLED=true`). | Verified Caddy Dockerfile builds (`ARG HESTIA_MAGIC_LINK_ENABLED=true`, `ENV VITE_MAGIC_LINK_ENABLED`), `.env.example`, `e2e/setup/stack.ts`, and Compose args. Tested bundle code-splitting keeping shell within 200KB. |
| **AUTH-02** | Activate and verify magic link routes (`/sign-in/link`, `/sign-in/code`) and user navigation links in the PWA sign-in screen. | Upgraded `SignInScreen.tsx` entry point with "or" divider and secondary button; verified routes under `createRoutes()`; tested `MagicLinkRequestScreen` unknown-email handling and `MagicLinkCodeScreen` 6-digit input and resend timer. |
| **AUTH-03** | Configure GoTrue SMTP settings (`GOTRUE_SMTP_*`) supporting Resend/Postmark with custom sender name ("Hestia") and address (`auth@aberrance.app`). | Documented exact GoTrue env config for Resend (port 465 TLS); created runbook in `docs/deployment.md` for Cloudflare DNS (SPF, DKIM, DMARC). |
| **AUTH-04** | Update GoTrue site URL and redirect allow lists to `https://hestia.aberrance.app` and `https://hestia.aberrance.app/**`. | Confirmed strict interpolation of `HESTIA_ORIGIN` in `docker-compose.yml`; confirmed Kong routing for `/auth/v1/verify` and `/auth/v1/otp`; pinned open-redirect protections with tests. |
| **AUTH-05** | Replace `07-magic-link-disabled.spec.ts` with Playwright E2E tests validating the active magic link request, OTP code validation, and session creation. | Built `inbucket/inbucket:3.1.0` test-double overlay; created `e2e/support/inbucket.ts` REST client helper; designed comprehensive `07-magic-link.spec.ts` exercising code entry, link click, invalid code, and cooldown timer. |
</phase_requirements>

---

## Project Constraints

Source: `.claude/CLAUDE.md`, `CONTRIBUTING.md`, and project lint/hygiene tooling.

- **Clean working tree & zero test regressions:** `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm knip`, and `pnpm jscpd` must stay 100% green.
- **Commit discipline:** Commit messages must strictly adhere to closed Conventional Commit scopes: `['web', 'service', 'shared', 'recurrence', 'matching', 'db', 'e2e', 'docker']`. No `console.log` in shipped code.
- **Strict Hygiene Gate (`scripts/check-repo-hygiene.mjs`):**
  - No occurrences of the product's legacy name (`hearth`) outside allowlisted paths.
  - No retired ingress terms (`tailscale`, `tailnet`, `funnel`, `ts.net`) outside allowlisted paths.
  - Tracked text files must have LF line endings; scripts must be `100755`.
- **Append-only database migrations:** No editing of existing applied migrations in `supabase/migrations/`.
- **Documentation integrity:** Specifications in `docs/` are the canonical source of truth; operational runbooks are centralized in `docs/deployment.md`.
- **App Shell Budget (`apps/web/scripts/check-build.mjs`):**
  - Total app shell size must remain strictly under 200 KB gzipped.
  - When `VITE_MAGIC_LINK_ENABLED=true`, all 4 check strings in `MAGIC_LINK_COPY` must be present in emitted chunks but **must not appear in the initial app shell**.

---

## Executive Summary

Phase 10 transitions Hestia's authentication from password-only into a modern passwordless authentication experience using magic links and 6-digit OTP codes. 

In production, GoTrue connects via TLS (port 465) to Resend as the transactional SMTP provider, dispatching verification emails with the sender address `auth@aberrance.app` and display name `Hestia`. All inbound email links and OAuth callbacks are locked strictly to `https://hestia.aberrance.app`. Public visitor account creation is prevented by setting `GOTRUE_DISABLE_SIGNUP: 'true'` in Docker Compose and `shouldCreateUser: false` in the web client, ensuring only existing invited household members can sign in. Submitting an uninvited email address returns a clear error directing the user to ask their household admin for an invite.

In E2E testing, an `inbucket` container (`inbucket/inbucket:3.1.0`) is added to `e2e/docker-compose.e2e.yml` on the isolated test network. In E2E runs, GoTrue relays outbound SMTP traffic to `inbucket:2500` over plaintext without internet access. Playwright inspects Inbucket's REST API on dynamic loopback port `HESTIA_E2E_INBUCKET_PORT` to intercept verification emails and extract either the 6-digit OTP code or the clickable confirmation link, creating a deterministic, high-fidelity test harness that requires no external mail credentials.

### Critical Empirical Finding: GoTrue Mailer Templates
Inspection of the `public.ecr.aws/supabase/gotrue:v2.196.0` binary reveals that GoTrue's built-in default magic link template contains **only** the clickable link (`<a href="{{ .ConfirmationURL }}">Sign in</a>`), and does **not** include the 6-digit OTP code (`{{ .Token }}`). To support both clickable links and 6-digit code entry without violating D-05 ("no custom template volume mounts needed in Compose"), Hestia serves a static HTML template from Caddy (`http://caddy:8080/templates/magic_link.html`) configured via `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK`. Because Caddy is already running on the Compose network and builds from `apps/web/public/`, this adds zero volume mounts, requires no extra container, and renders both the link and 6-digit code to the recipient.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| **Passwordless Sign-In UI** | Web PWA (`apps/web`) | — | Prominent secondary button with "or" divider on `SignInScreen.tsx`; route-split screens `MagicLinkRequestScreen.tsx` and `MagicLinkCodeScreen.tsx`. |
| **Auth Client Port** | `apps/web/src/lib/auth/auth-client.ts` | GoTrue client SDK | Calls `signInWithOtp` with `shouldCreateUser: false` and `emailRedirectTo: `${origin}/``; calls `verifyOtp` with 6-digit code. |
| **Sign-Up Boundary** | GoTrue `GOTRUE_DISABLE_SIGNUP: 'true'` | Service Admin API | Blocks public visitors from creating arbitrary accounts; only admin provisioning via `hestia-service` and invited members are admitted. |
| **SMTP Delivery (Prod)** | Resend (`smtp.resend.com:465`) | GoTrue Mailer | High-reputation transactional delivery under `auth@aberrance.app` using port 465 with TLS. |
| **Email Interception (E2E)** | `inbucket/inbucket:3.1.0` | Playwright test runner | Captures local SMTP emails on port 2500; exposes REST API on dynamic host port for Playwright assertions. |
| **Email Template Serving** | Caddy static file server | GoTrue `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK` | Serves `magic_link.html` from `apps/web/public/templates/` via `http://caddy:8080/templates/magic_link.html` inside Compose; zero volume mounts. |
| **Token Validity & Limits** | GoTrue `GOTRUE_MAILER_OTP_EXP: 900` | Caddy / Kong `X-Forwarded-For` | Enforces 15-minute token TTL and IP-keyed email rate limiting based on real client IP. |
| **Redirect URL Lockdown** | GoTrue `GOTRUE_SITE_URL` & `GOTRUE_URI_ALLOW_LIST` | Caddy ingress | Prevents open redirect attacks by locking redirect destinations strictly to `HESTIA_ORIGIN`. |
| **Secrets Management** | `scripts/generate-secrets.sh` | `/srv/hestia/.env` | Copies `GOTRUE_SMTP_PASS` from environment if provided; allows empty fallback during non-magic local dev. |

---

## Standard Stack & Component Specifications

### Container Images & Services

| Service | Image | Network & Ports | Healthcheck | Purpose |
|---------|-------|-----------------|-------------|---------|
| `auth` | `public.ecr.aws/supabase/gotrue:v2.196.0` | `hestia` network (internal only, port 9999) | `wget --no-verbose --spider http://localhost:9999/health` | Supabase Auth (GoTrue) handling OTP generation, validation, and token signing. |
| `caddy` | `hestia-caddy:<sha>` | `hestia` network (internal only, port 8080) | `wget --quiet --spider http://127.0.0.1:8080/index.html` | Ingress proxy, static PWA host, and static template server. |
| `inbucket` (E2E only) | `inbucket/inbucket:3.1.0` | `hestia` network: SMTP 2500 (internal), HTTP 9000 mapped to `127.0.0.1:${HESTIA_E2E_INBUCKET_PORT}` | Built-in: `wget localhost:9000 -q -O - >/dev/null` (interval 5s) | Mail-catcher capturing GoTrue SMTP and exposing REST API to Playwright. |

### Environment Variables Matrix

| Variable | Environment | Default / Target | Description |
|----------|-------------|------------------|-------------|
| `HESTIA_MAGIC_LINK_ENABLED` | `.env.example`, Compose, E2E | `true` | Activates magic link feature flag; passed to Caddy build as `VITE_MAGIC_LINK_ENABLED`. |
| `GOTRUE_SMTP_HOST` | Compose, `.env.example` | `smtp.resend.com` (E2E: `inbucket`) | SMTP relay host. |
| `GOTRUE_SMTP_PORT` | Compose, `.env.example` | `465` (E2E: `2500`) | SMTP relay port (465 implicit TLS in prod; 2500 plain in E2E). |
| `GOTRUE_SMTP_USER` | Compose, `.env.example` | `resend` (E2E: `''`) | SMTP authentication username. |
| `GOTRUE_SMTP_PASS` | Compose, `.env.example` | `${GOTRUE_SMTP_PASS:-}` (E2E: `''`) | SMTP password / API key. Falls back to empty string if unset. |
| `GOTRUE_SMTP_ADMIN_EMAIL` | Compose, `.env.example` | `auth@aberrance.app` | Sender email address. |
| `GOTRUE_SMTP_SENDER_NAME` | Compose, `.env.example` | `Hestia` | Sender display name. |
| `GOTRUE_DISABLE_SIGNUP` | Compose | `'true'` | Blocks public self-signup via `/auth/v1/signup`. |
| `GOTRUE_MAILER_AUTOCONFIRM` | Compose | `'true'` | Automatically confirms user email on OTP entry or link click. |
| `GOTRUE_MAILER_OTP_LENGTH` | Compose | `6` | Generates 6-digit numeric OTP codes. |
| `GOTRUE_MAILER_OTP_EXP` | Compose | `900` | Sets OTP code validity to 15 minutes (900 seconds). |
| `GOTRUE_MAILER_URLPATHS_MAGIC_LINK` | Compose | `/auth/v1/verify` | URL path component for email confirmation link. |
| `GOTRUE_MAILER_SUBJECTS_MAGIC_LINK` | Compose | `Your Magic Link` | Subject line for magic link emails. |
| `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK` | Compose | `http://caddy:8080/templates/magic_link.html` | URL to template rendering both link and 6-digit OTP code. |
| `HESTIA_E2E_INBUCKET_PORT` | E2E (`env.ts`, `stack.ts`) | Dynamic free port via `distinctFreePort()` | Loopback host port mapped to Inbucket REST API. |

---

## Technical Deep-Dives

### 1. GoTrue SMTP & Mailer Architecture

GoTrue (written in Go) uses standard library `net/smtp` and `crypto/tls`.
- **TLS Handshake on Port 465:** When `GOTRUE_SMTP_PORT: 465`, GoTrue initiates an implicit TLS handshake upon dialing `smtp.resend.com:465`. Resend authenticates using username `resend` and password set to a Resend API key (`re_...`).
- **Plaintext on Port 2500 in E2E:** When pointing to `inbucket:2500` with empty user and password, GoTrue skips SASL authentication and dispatches plaintext RFC 5321/5322 messages, which Inbucket accepts immediately.
- **Client IP Rate Limiting:** GoTrue receives incoming requests through Kong. Caddy resolves the real client IP from Cloudflare's `CF-Connecting-IP` header and passes `X-Forwarded-For: {client_ip}` to Kong, which forwards it to GoTrue (`GOTRUE_RATE_LIMIT_HEADER: X-Forwarded-For`). Email dispatch is rate-limited per IP, defending against SMTP enumeration attacks.

### 2. Transactional Email DNS Records (Resend & Cloudflare)

Under D-04, `docs/deployment.md` requires documented DNS setup for `aberrance.app` in Cloudflare:

```dns
; 1. SPF (Sender Policy Framework)
; Authorizes Resend to send on behalf of aberrance.app
TXT    @                  v=spf1 include:resend.com ~all

; 2. DKIM (DomainKeys Identified Mail)
; Cryptographically signs outbound emails from auth@aberrance.app
CNAME  resend._domainkey  resend._domainkey.resend.com.

; 3. DMARC (Domain-based Message Authentication, Reporting, and Conformance)
; Specifies policy for unaligned/failed authentication attempts
TXT    _dmarc             v=DMARC1; p=quarantine; rua=mailto:dmarc@aberrance.app; pct=100;

; 4. Custom Return-Path (Bounce Handling)
; Ensures bounces and feedback loops align with sender domain
MX     bounces            feedback-smtp.resend.com. (Priority 10)
TXT    bounces            v=spf1 include:resend.com ~all
```

### 3. Template Rendering & Zero-Volume-Mount Solution

Empirical analysis of GoTrue v2.196.0 binary strings reveals:
```html
<h2>Your sign-in link</h2>
<p>Follow the link below to sign in. This link expires shortly and can only be used once.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
```
The built-in template renders **only** the link. However, GoTrue's internal `templatemailer` provides all necessary context parameters:
- `{{ .ConfirmationURL }}`: Full link to `/auth/v1/verify?token=...&type=magiclink&redirect_to=...`.
- `{{ .Token }}`: 6-digit numeric OTP code (`otp`).
- `{{ .SiteURL }}`: Application origin (`https://hestia.aberrance.app`).

GoTrue allows fetching custom templates via HTTP using `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK`. Because Caddy is already present in the Compose topology on the internal network `hestia` and serves the static PWA assets from `/srv`, placing `magic_link.html` in `apps/web/public/templates/magic_link.html` results in Vite copying it to `dist/templates/magic_link.html`. Caddy serves this at `http://caddy:8080/templates/magic_link.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your sign-in link</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1c1917; padding: 24px;">
  <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Sign in to Hestia</h2>
  <p style="margin-bottom: 24px;">Follow the link below to sign in on this device. This link expires in 15 minutes and can only be used once.</p>
  <p style="margin-bottom: 32px;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign in to Hestia</a>
  </p>
  <p style="margin-bottom: 8px; color: #78716c;">Or enter this 6-digit code on your sign-in screen:</p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.25em; margin-bottom: 24px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">{{ .Token }}</p>
  <p style="font-size: 13px; color: #a8a29e;">If you did not request this email, you can safely ignore it.</p>
</body>
</html>
```

This achieves all user requirements:
1. Recipient receives an email containing both the clickable button and the 6-digit code.
2. Zero additional Docker volumes or containers are needed in Compose.
3. Fallback resilience: If Caddy is temporarily unreachable when `auth` boots, GoTrue logs a warning and falls back to its built-in default template without crashing.

### 4. User Provisioning Boundary & Unknown Email Handling

GoTrue's `/otp` endpoint supports a `create_user` boolean (exposed via `supabase-js` as `options.shouldCreateUser`).
1. In `apps/web/src/lib/auth/auth-client.ts`:
   ```typescript
   async sendSignInLink(email) {
     const { auth } = await ready;
     const { error } = await auth.signInWithOtp({
       email,
       options: {
         shouldCreateUser: false,
         emailRedirectTo: `${window.location.origin}/`,
       },
     });
     if (error) throw new AuthError(error.message, error.status);
   }
   ```
2. When an email is submitted that does not exist in `auth.users`, GoTrue responds with HTTP 400:
   ```json
   {
     "code": 400,
     "error_code": "otp_disabled",
     "msg": "Signups not allowed for otp"
   }
   ```
3. In `apps/web/src/screens/onboarding/magic-link.ts`:
   ```typescript
   export const UNKNOWN_EMAIL_MESSAGE =
     'No account found with this email. Ask your household admin for an invite.';

   export function magicLinkMessage(error: unknown, fallback: string): string {
     if (error instanceof AuthError) {
       if (error.status === 429) return RATE_LIMITED_MESSAGE;
       if (error.status === 0) return OFFLINE_MESSAGE;
       if (
         error.message.toLowerCase().includes('signups not allowed for otp') ||
         error.message.toLowerCase().includes('not found')
       ) {
         return UNKNOWN_EMAIL_MESSAGE;
       }
     }
     return fallback;
   }
   ```
4. `MagicLinkRequestScreen` catches this and displays `UNKNOWN_EMAIL_MESSAGE` in its accessible `FormMessage`, satisfying D-14.
5. In Compose, `GOTRUE_DISABLE_SIGNUP: 'true'` ensures that public calls to `POST /auth/v1/signup` are refused, while `hestia-service` continues provisioning members via `POST /auth/v1/admin/users` using `service_role`.

### 5. Web UI: Secondary Button Upgrade & Code Splitting

In `apps/web/src/screens/onboarding/SignInScreen.tsx`, the magic link entry point is upgraded (D-16):
```tsx
{import.meta.env.VITE_MAGIC_LINK_ENABLED === 'true' && (
  <>
    <div className="relative my-3 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-input" />
      </div>
      <span className="relative bg-base px-2 text-body-sm text-secondary uppercase">or</span>
    </div>
    <Button
      variant="secondary"
      type="button"
      onClick={() => {
        void navigate('/sign-in/link');
      }}
    >
      Email me a sign-in link
    </Button>
  </>
)}
```
- **Accessible & Mobile Friendly:** Provides a large 44px touch target on mobile devices.
- **Build Tripwire Preserved:** Keeps the exact string `"Email me a sign-in link"`, so `apps/web/scripts/check-build.mjs` continues validating that the sentence is built into lazy chunks without entering the initial app shell.
- **Budget Compliance:** Full PWA build with `VITE_MAGIC_LINK_ENABLED=true` results in an app shell of **197.7 KB** gzipped, well beneath the **200 KB** budget limit.

### 6. E2E Interception with Inbucket (`inbucket/inbucket:3.1.0`)

In `e2e/docker-compose.e2e.yml`:
```yaml
services:
  inbucket:
    image: inbucket/inbucket:3.1.0
    restart: unless-stopped
    networks: [hestia]
    ports:
      - 127.0.0.1:${HESTIA_E2E_INBUCKET_PORT:?}:9000

  auth:
    depends_on:
      db:
        condition: service_healthy
      inbucket:
        condition: service_healthy
    environment:
      GOTRUE_SMTP_HOST: inbucket
      GOTRUE_SMTP_PORT: 2500
      GOTRUE_SMTP_USER: ''
      GOTRUE_SMTP_PASS: ''
      GOTRUE_SMTP_ADMIN_EMAIL: auth@aberrance.app
      GOTRUE_SMTP_SENDER_NAME: Hestia
      GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: http://caddy:8080/templates/magic_link.html
```

In `e2e/support/inbucket.ts`:
```typescript
import { INBUCKET_BASE_URL } from './env.ts';

export interface InbucketMessageHeader {
  mailbox: string;
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  size: number;
}

export interface InbucketMessageDetail extends InbucketMessageHeader {
  body: {
    text: string;
    html: string;
  };
  header: Record<string, string[]>;
}

export async function purgeMailbox(username: string): Promise<void> {
  const mailbox = username.split('@')[0];
  await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${mailbox}`, { method: 'DELETE' });
}

export async function waitForLatestEmail(
  username: string,
  timeoutMs = 10000,
): Promise<InbucketMessageDetail> {
  const mailbox = username.split('@')[0];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${mailbox}`);
    if (res.ok) {
      const messages = (await res.json()) as InbucketMessageHeader[];
      if (messages.length > 0) {
        const latest = messages[messages.length - 1];
        const detailRes = await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${mailbox}/${latest.id}`);
        if (detailRes.ok) {
          return (await detailRes.json()) as InbucketMessageDetail;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for email to ${username} in Inbucket`);
}

export function extractOtpCode(email: InbucketMessageDetail): string {
  const match = email.body.html.match(/\b\d{6}\b/) ?? email.body.text.match(/\b\d{6}\b/);
  if (!match) throw new Error(`Could not find 6-digit OTP code in email body: ${email.body.html}`);
  return match[0];
}

export function extractConfirmationUrl(email: InbucketMessageDetail): string {
  const match = email.body.html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
  if (!match) throw new Error(`Could not find confirmation URL in email body: ${email.body.html}`);
  return match[1].replace(/&amp;/g, '&');
}
```

---

## Validation Architecture

The Nyquist validation architecture provides multi-layered automated verification across unit, static configuration, post-build assets, and Playwright end-to-end integration:

```
               [ Unit / Component Tests ]
               magic-link.test.tsx (Vitest)
                         │
                         ▼
           [ Static Configuration Tests ]
        docker-compose-smtp.test.ts (Vitest)
                         │
                         ▼
            [ Post-Build Asset Checks ]
              check-build.mjs (Node)
                         │
                         ▼
            [ Playwright E2E Journey ]
            07-magic-link.spec.ts (E2E)
                         │
                         ▼
          [ Production Smoke Runbook ]
            docs/deployment.md Checklist
```

### 1. Automated Unit & Component Tests (Vitest)
File: `apps/web/src/screens/onboarding/magic-link.test.tsx`
- **Flag OFF tests:**
  - `SignInScreen` displays no magic link button or text when `VITE_MAGIC_LINK_ENABLED` is false.
  - `createRoutes()` omits `/sign-in/link` and `/sign-in/code`.
  - Direct navigation to `/sign-in/link` or `/sign-in/code` redirects to `/sign-in`.
- **Flag ON tests:**
  - `SignInScreen` displays secondary button "Email me a sign-in link" with "or" divider.
  - Clicking the secondary button navigates to `/sign-in/link`.
  - `MagicLinkRequestScreen` submits valid email, invokes `auth.sendSignInLink`, and transitions to confirmation state.
  - `MagicLinkRequestScreen` submits unknown email, catches `AuthError`, and renders `UNKNOWN_EMAIL_MESSAGE`.
  - `MagicLinkCodeScreen` normalizes inputs (strips spaces and non-digits), validates 6-digit length, invokes `auth.verifySignInCode`.
  - `MagicLinkCodeScreen` countdown timer begins at 30 seconds and disables resend button until elapsed.

### 2. Automated Static Configuration Tests (Vitest)
File: `apps/service/src/docker-compose-smtp.test.ts`
- Uses `yaml` to parse `docker/docker-compose.yml` and `e2e/docker-compose.e2e.yml`.
- Validates that `auth` in `docker-compose.yml` specifies:
  - `GOTRUE_DISABLE_SIGNUP: 'true'`.
  - `GOTRUE_MAILER_AUTOCONFIRM: 'true'`.
  - `GOTRUE_MAILER_OTP_EXP: 900`.
  - `GOTRUE_SITE_URL: ${HESTIA_ORIGIN}`.
  - `GOTRUE_URI_ALLOW_LIST: ${HESTIA_ORIGIN},${HESTIA_ORIGIN}/**`.
  - `GOTRUE_SMTP_ADMIN_EMAIL: ${GOTRUE_SMTP_ADMIN_EMAIL:-auth@aberrance.app}`.
  - `GOTRUE_SMTP_SENDER_NAME: ${GOTRUE_SMTP_SENDER_NAME:-Hestia}`.
  - `GOTRUE_SMTP_HOST: ${GOTRUE_SMTP_HOST:-smtp.resend.com}`.
  - `GOTRUE_SMTP_PORT: ${GOTRUE_SMTP_PORT:-465}`.
- Validates that `inbucket` is defined in `e2e/docker-compose.e2e.yml` with image `inbucket/inbucket:3.1.0`.
- Validates that `auth` in `e2e/docker-compose.e2e.yml` points to `inbucket:2500` with empty user and password.

### 3. Post-Build Asset & Code-Splitting Checks
Command: `pnpm --filter @hestia/web build` (`node scripts/check-build.mjs`)
- Enforces gzipped app shell size < 200 KB.
- Verifies that `VITE_MAGIC_LINK_ENABLED=true` produces dedicated lazy chunks for `MagicLinkRequestScreen` and `MagicLinkCodeScreen`.
- Verifies that neither lazy chunk is referenced in the entry chunk or preloads of `index.html`.
- Verifies all 4 sentinel strings in `MAGIC_LINK_COPY` exist in emitted bundle assets.

### 4. Automated Playwright E2E Suite
File: `e2e/tests/07-magic-link.spec.ts` (replaces `07-magic-link-disabled.spec.ts`)
- **Test 1: Build flag validation:** Asserts `readStackEnv()['HESTIA_MAGIC_LINK_ENABLED'] === 'true'`.
- **Test 2: Entry point:** Verifies "Email me a sign-in link" button is rendered with "or" divider on `/sign-in`.
- **Test 3: Unknown email refusal:** Submitting `uninvited@example.com` shows "No account found with this email. Ask your household admin for an invite." and generates no email in Inbucket.
- **Test 4: Happy path OTP code entry:**
  - Existing user `alex@example.com` submits email.
  - Intercepts email in Inbucket, verifies sender `Hestia <auth@aberrance.app>`.
  - Clicks "Enter the code", fills intercepted 6-digit OTP code, clicks "Sign in".
  - Verifies session created and browser lands on dashboard for Alex Rivera.
- **Test 5: Invalid code handling:**
  - User submits invalid code `000000`.
  - Verifies error message "That code is incorrect or has expired. Ask for a new one."
- **Test 6: Direct magic link navigation:**
  - Existing user `sam@example.com` requests magic link.
  - Fresh signed-out page navigates directly to `ConfirmationURL` extracted from Inbucket email.
  - Verifies automatic redirection to dashboard for Sam Chen.
- **Test 7: Resend countdown timer:**
  - Verifies "Send a new code" button is disabled on `/sign-in/code` displaying countdown text `You can ask for a new code in 30s.`.
- **Test 8: Open redirect prevention:**
  - Confirms GoTrue rejects redirect URLs pointing to unauthorized external domains.

### 5. Production Smoke Verification Runbook
Documented in `docs/deployment.md`:
1. Check DNS records: `dig +short TXT aberrance.app` and `dig +short CNAME resend._domainkey.aberrance.app`.
2. Inspect environment: `grep GOTRUE_SMTP_PASS /srv/hestia/.env` verifies non-empty API key.
3. Live test: Open `https://hestia.aberrance.app/sign-in`, click "Email me a sign-in link", request code for owner email.
4. Verify inbox: Ensure delivery from `Hestia <auth@aberrance.app>`, verify SPF/DKIM pass in email headers.
5. Verify authentication: Enter 6-digit code, confirm sign-in to dashboard.

---

## Pitfalls & Common Traps

| # | Trap | Impact | Prevention / Solution |
|---|------|--------|-----------------------|
| 1 | **GoTrue default template omits `{{ .Token }}`** | Inbucket intercepts email containing only the link; OTP code entry test cannot find a 6-digit code. | Serve static `magic_link.html` via Caddy (`http://caddy:8080/templates/magic_link.html`) configured in `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK`. Adds zero volume mounts and outputs both link and code. |
| 2 | **Inbucket mailbox query convention** | Querying `/api/v1/mailbox/alex@example.com` returns empty list because Inbucket indexes by the local username (`alex`). | Always sanitize usernames in `inbucket.ts` using `email.split('@')[0]`. |
| 3 | **Port collisions in parallel E2E runs** | Fixed host port for Inbucket causes test crashes when multiple runs start simultaneously. | Use dynamic port allocation via `distinctFreePort()` in `e2e/support/env.ts` and export `HESTIA_E2E_INBUCKET_PORT`. |
| 4 | **Breaking `check-build.mjs` tripwire** | Changing the text of "Email me a sign-in link" in `SignInScreen.tsx` causes post-build check to fail. | Maintain the exact text string `"Email me a sign-in link"` on the upgraded secondary button. |
| 5 | **Accidentally blocking Admin user provisioning** | `GOTRUE_DISABLE_SIGNUP: 'true'` could be mistaken for blocking member invitations. | GoTrue's `DISABLE_SIGNUP` only blocks public `POST /auth/v1/signup`. Admin provisioning via `POST /auth/v1/admin/users` uses `service_role` and remains fully functional. |
| 6 | **Deploy script skipping GoTrue recreation** | `scripts/deploy.sh` does not recreate `auth` on normal deploys, so GoTrue retains old env settings until explicit recreate. | Document in `docs/deployment.md` that operators must run `hestia-compose up -d --wait` once after adding SMTP secrets. |

---

## Implementation Plan & Work Package Breakdown

### Package 1: Configuration, Compose & Secrets Automation
- Update `.env.example`:
  - Set `HESTIA_MAGIC_LINK_ENABLED=true`.
  - Add `GOTRUE_SMTP_*` block (Host `smtp.resend.com`, Port `465`, User `resend`, Sender `auth@aberrance.app`, Sender Name `Hestia`, empty password placeholder).
- Update `docker/docker-compose.yml`:
  - Set `GOTRUE_DISABLE_SIGNUP: 'true'`.
  - Set `GOTRUE_MAILER_OTP_EXP: 900`.
  - Set `GOTRUE_MAILER_URLPATHS_MAGIC_LINK: /auth/v1/verify`.
  - Set `GOTRUE_MAILER_SUBJECTS_MAGIC_LINK: Your Magic Link`.
  - Set `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: http://caddy:8080/templates/magic_link.html`.
  - Configure `GOTRUE_SMTP_*` variables with fallback defaults.
  - Update `caddy` build arg `HESTIA_MAGIC_LINK_ENABLED: ${HESTIA_MAGIC_LINK_ENABLED:-true}`.
- Update `scripts/generate-secrets.sh`:
  - Add `GOTRUE_SMTP_PASS` to `fromEnvironment` array.
- Update `supabase/config.toml`:
  - Set `[local_smtp] enabled = true` for local development parity.
  - Set `otp_expiry = 900`.

### Package 2: Web PWA UI & Auth Client Enhancements
- Create `apps/web/public/templates/magic_link.html`:
  - Clean HTML email template rendering both `<a href="{{ .ConfirmationURL }}">` and `{{ .Token }}`.
- Update `apps/web/src/lib/auth/auth-client.ts`:
  - Update `sendSignInLink` to pass `options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/` }`.
- Update `apps/web/src/screens/onboarding/magic-link.ts`:
  - Add `UNKNOWN_EMAIL_MESSAGE = "No account found with this email. Ask your household admin for an invite."`.
  - Update `magicLinkMessage` to detect "Signups not allowed for otp" and return `UNKNOWN_EMAIL_MESSAGE`.
- Update `apps/web/src/screens/onboarding/SignInScreen.tsx`:
  - Upgrade magic link entry point to a secondary button with an "or" divider.
- Update `apps/web/src/screens/onboarding/magic-link.test.tsx`:
  - Update tests to assert the secondary button and verify unknown email handling.

### Package 3: E2E Infrastructure & Inbucket Test Double
- Update `e2e/docker-compose.e2e.yml`:
  - Add `inbucket` service (`image: inbucket/inbucket:3.1.0`) with loopback port mapping `127.0.0.1:${HESTIA_E2E_INBUCKET_PORT:?}:9000`.
  - Override `auth` service in E2E to depend on `inbucket` and point SMTP to `inbucket:2500` with empty user and pass.
- Update `e2e/support/env.ts`:
  - Allocate `HESTIA_E2E_INBUCKET_PORT` using `distinctFreePort`.
  - Export `INBUCKET_PORT` and `INBUCKET_BASE_URL`.
- Update `e2e/setup/stack.ts`:
  - Include `inbucket` in `DATA_SERVICES`.
  - Append `HESTIA_E2E_INBUCKET_PORT` to run environment.
- Create `e2e/support/inbucket.ts`:
  - Polling helper with timeout for `waitForLatestEmail`, `purgeMailbox`, `extractOtpCode`, and `extractConfirmationUrl`.

### Package 4: Automated E2E & Static Tests
- Create `apps/service/src/docker-compose-smtp.test.ts`:
  - Validates `docker-compose.yml` and `docker-compose.e2e.yml` SMTP, signup, and template settings.
- Replace `e2e/tests/07-magic-link-disabled.spec.ts` with `e2e/tests/07-magic-link.spec.ts`:
  - Exercises full journey: "or" divider, button navigation, unknown email rejection, OTP email receipt in Inbucket, 6-digit code verification, invalid code rejection, direct link confirmation, and resend cooldown timer.

### Package 5: Documentation & Verification
- Update `docs/deployment.md`:
  - Add "Transactional Email (SMTP & DNS)" section detailing Resend configuration, SPF, DKIM, DMARC, and custom return-path.
  - Document deployment checklist instructions for testing magic link delivery and verifying DNS alignment.
- Run complete test suite sweep:
  - `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm jscpd`, `pnpm build`.
