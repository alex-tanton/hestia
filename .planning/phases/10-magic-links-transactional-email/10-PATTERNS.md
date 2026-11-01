# Phase 10: Magic Links & Transactional Email - Pattern Map

**Mapped:** 2026-11-01  
**Domain:** GoTrue SMTP configuration (Resend), Inbucket E2E mail-catcher, Web PWA passwordless auth flows (`/sign-in/link`, `/sign-in/code`), static email template delivery via Caddy, Nyquist static and E2E verification  
**Files Analyzed:** 17 files (4 newly created, 13 modified or replaced)  
**Analogs Found:** 17 / 17 (all files map directly to existing codebase implementations or self-extensions)  

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docker/docker-compose.yml` | Ingress & Service Orchestration | Container runtime env & build args | Itself (`auth` service lines 62–104, `caddy` lines 226–255) | Exact |
| `e2e/docker-compose.e2e.yml` | E2E Stack Test Double Overlay | Container runtime env & loopback ports | Itself (`db`, `hestia-service`, `caddy` lines 44–88) | Exact |
| `.env.example` | Environment Configuration Template | Host environment definition | Itself (`.env.example` lines 20–30) | Exact |
| `scripts/generate-secrets.sh` | Secrets Generation Script | Environment variable extraction & file generation | Itself (`scripts/generate-secrets.sh` lines 72–90) | Exact |
| `supabase/config.toml` | Local Supabase CLI Configuration | Local dev / CI auth configuration | Itself (`supabase/config.toml` lines 36–37, 48–65) | Exact |
| `apps/web/public/templates/magic_link.html` (NEW) | Static HTML Email Template | Served by Caddy, rendered by GoTrue mailer | `apps/web/index.html` (typography/reset) & GoTrue default templates | Strong |
| `apps/web/src/lib/auth/auth-client.ts` | Auth Client Port / SDK Wrapper | Client RPC to GoTrue `/auth/v1/otp` | Itself (`apps/web/src/lib/auth/auth-client.ts` lines 136–152) | Exact |
| `apps/web/src/screens/onboarding/magic-link.ts` | Frontend Auth Constants & Formatting | String manipulation & error mapping | Itself (`apps/web/src/screens/onboarding/magic-link.ts` lines 12–63) | Exact |
| `apps/web/src/screens/onboarding/SignInScreen.tsx` | React UI View (Sign In) | User input, form submission, navigation | Itself (`SignInScreen.tsx` lines 95–115) | Exact |
| `apps/web/src/screens/onboarding/magic-link.test.tsx` | Component Unit Test (Vitest / RTL) | DOM simulation, click/type events | Itself (`magic-link.test.tsx` lines 53–100) | Exact |
| `e2e/support/env.ts` | E2E Harness Port & Identity Allocator | Loopback port detection & env parsing | Itself (`e2e/support/env.ts` lines 61–93) | Exact |
| `e2e/setup/stack.ts` | E2E Stack Lifecycle Orchestrator | Process execution & Compose management | Itself (`e2e/setup/stack.ts` lines 35–60, 100–108) | Exact |
| `e2e/support/inbucket.ts` (NEW) | E2E Mail-Catcher Client Helper | HTTP REST polling, regex token extraction | `e2e/support/db.ts` & `apps/service/src/push/test-seam.ts` | Strong |
| `apps/service/src/docker-compose-smtp.test.ts` (NEW) | Static Configuration Test (Vitest) | YAML parsing & AST assertion | `apps/service/src/ingress-config.test.ts` lines 46–80 | Exact |
| `apps/service/src/ingress-config.test.ts` | Static Ingress Configuration Test | YAML parsing & published port assertion | Itself (`apps/service/src/ingress-config.test.ts` lines 129–140) | Exact |
| `e2e/tests/07-magic-link.spec.ts` (NEW, replaces `07-magic-link-disabled.spec.ts`) | Playwright E2E Integration Suite | Browser automation, email interception, verification | `e2e/tests/06-owner-reset-password.spec.ts` & `07-magic-link-disabled.spec.ts` | Exact |
| `docs/deployment.md` | Canonical Operations Runbook | Technical documentation | Itself (`docs/deployment.md` lines 88–105, 430–478) | Exact |

---

## Domain A: Infrastructure, Compose & Secrets Configuration

### 1. `docker/docker-compose.yml`

- **Role:** Central container orchestration specification defining the production GoTrue service, Caddy build arguments, and network environment.
- **Data Flow:** Supplies environment variables (`GOTRUE_SMTP_*`, `GOTRUE_DISABLE_SIGNUP`, `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK`) to container entrypoints.
- **Closest Analog:** Itself (`docker/docker-compose.yml`, lines 62–104).
- **Existing Pattern Excerpt (`docker/docker-compose.yml#L76-L98`):**
  ```yaml
      GOTRUE_SITE_URL: ${HESTIA_ORIGIN}
      GOTRUE_URI_ALLOW_LIST: ${HESTIA_ORIGIN},${HESTIA_ORIGIN}/**
      GOTRUE_DISABLE_SIGNUP: 'false'
      GOTRUE_JWT_ADMIN_ROLES: service_role
      ...
      # Auth configuration table. No GOTRUE_SMTP_* while magic link is disabled.
      GOTRUE_MAILER_AUTOCONFIRM: 'true'
      GOTRUE_PASSWORD_MIN_LENGTH: 8
      GOTRUE_MAILER_OTP_LENGTH: 6
      GOTRUE_MAILER_OTP_EXP: 3600
      GOTRUE_MAILER_URLPATHS_INVITE: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_RECOVERY: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: /auth/v1/verify
  ```
- **Changes & Adaptations:**
  - Flip `GOTRUE_DISABLE_SIGNUP` to `'true'` (D-15).
  - Shorten `GOTRUE_MAILER_OTP_EXP` to `900` (15 minutes, D-17).
  - Add `GOTRUE_MAILER_URLPATHS_MAGIC_LINK: /auth/v1/verify`.
  - Add `GOTRUE_MAILER_SUBJECTS_MAGIC_LINK: Your Magic Link`.
  - Add `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: http://caddy:8080/templates/magic_link.html`.
  - Add `GOTRUE_SMTP_*` block with empty fallback for password `${GOTRUE_SMTP_PASS:-}` (D-07):
    ```yaml
      GOTRUE_SMTP_HOST: ${GOTRUE_SMTP_HOST:-smtp.resend.com}
      GOTRUE_SMTP_PORT: ${GOTRUE_SMTP_PORT:-465}
      GOTRUE_SMTP_USER: ${GOTRUE_SMTP_USER:-resend}
      GOTRUE_SMTP_PASS: ${GOTRUE_SMTP_PASS:-}
      GOTRUE_SMTP_ADMIN_EMAIL: ${GOTRUE_SMTP_ADMIN_EMAIL:-auth@aberrance.app}
      GOTRUE_SMTP_SENDER_NAME: ${GOTRUE_SMTP_SENDER_NAME:-Hestia}
    ```
  - Under `caddy.build.args`: update `HESTIA_MAGIC_LINK_ENABLED: ${HESTIA_MAGIC_LINK_ENABLED:-true}` (D-11).
- **Pitfall / Trap:** Do NOT hardcode non-fallback variables; keep `${GOTRUE_SMTP_PASS:-}` so developer environments without SMTP credentials can still boot `auth`.

---

### 2. `e2e/docker-compose.e2e.yml`

- **Role:** E2E container topology overlay replacing external email delivery with an isolated test double.
- **Data Flow:** Routes GoTrue outbound SMTP to Inbucket's internal port `2500` and publishes Inbucket's REST API port `9000` to the loopback host interface.
- **Closest Analog:** Itself (`e2e/docker-compose.e2e.yml`, lines 45–88 for service definitions and loopback port bindings).
- **Existing Pattern Excerpt (`e2e/docker-compose.e2e.yml#L45-L48`):**
  ```yaml
  services:
    db:
      ports:
        - 127.0.0.1:${HESTIA_E2E_DB_PORT:?}:5432
  ```
- **Changes & Adaptations:**
  - Define `inbucket` service:
    ```yaml
    inbucket:
      image: inbucket/inbucket:3.1.0
      restart: unless-stopped
      networks: [hestia]
      ports:
        - 127.0.0.1:${HESTIA_E2E_INBUCKET_PORT:?}:9000
    ```
  - Add `auth` service override pointing SMTP to Inbucket without authentication:
    ```yaml
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
- **Pitfall / Trap:** Notice that `apps/service/src/ingress-config.test.ts` lines 135–140 checks `expect(published).toEqual(['caddy', 'db']);`. Adding a published port to `inbucket` will cause that test to fail unless updated to `['caddy', 'db', 'inbucket']`!

---

### 3. `.env.example` & `scripts/generate-secrets.sh`

- **Role:** Configuration template for new deployments and secret generation script populating throwaway secrets.
- **Data Flow:** `scripts/generate-secrets.sh` reads `.env.example`, populates random secrets, and extracts specified keys from the calling process environment.
- **Closest Analog:** Itself (`scripts/generate-secrets.sh` lines 72–77).
- **Existing Pattern Excerpt (`scripts/generate-secrets.sh#L72-L77`):**
  ```javascript
  const fromEnvironment = [
    'HESTIA_ORIGIN',
    'CLOUDFLARE_TUNNEL_TOKEN',
    'HESTIA_OWNER_EMAIL',
    'BACKUP_DIR',
  ];
  ```
- **Changes & Adaptations:**
  - In `.env.example`: Set `HESTIA_MAGIC_LINK_ENABLED=true` (D-11).
  - In `.env.example`: Add `GOTRUE_SMTP_*` block (D-03):
    ```bash
    # GoTrue SMTP configuration (Resend). Sender email must match the verified domain aberrance.app.
    GOTRUE_SMTP_HOST=smtp.resend.com
    GOTRUE_SMTP_PORT=465
    GOTRUE_SMTP_USER=resend
    GOTRUE_SMTP_PASS=
    GOTRUE_SMTP_ADMIN_EMAIL=auth@aberrance.app
    GOTRUE_SMTP_SENDER_NAME=Hestia
    ```
  - In `scripts/generate-secrets.sh`: Append `'GOTRUE_SMTP_PASS'` to `fromEnvironment` array (D-08).

---

### 4. `supabase/config.toml`

- **Role:** Local Supabase CLI configuration for developer parity (`supabase start`).
- **Data Flow:** Informs GoTrue daemon started by `supabase` CLI.
- **Closest Analog:** Itself (`supabase/config.toml`, lines 36–37 and 60–65).
- **Existing Pattern Excerpt (`supabase/config.toml#L36-L37` & `#L60-L65`):**
  ```toml
  # Hestia sends no email while magic link is disabled.
  [local_smtp]
  enabled = false

  [auth.email]
  enable_signup = true
  enable_confirmations = false
  otp_length = 6
  otp_expiry = 3600
  ```
- **Changes & Adaptations:**
  - Set `[local_smtp] enabled = true`.
  - Set `[auth] enable_signup = false` and `[auth.email] enable_signup = false`.
  - Update `otp_expiry = 900` to mirror production 15-minute validity (D-17).

---

## Domain B: Static Email Template Serving

### 5. `apps/web/public/templates/magic_link.html` (NEW)

- **Role:** Static HTML email template served via Caddy to GoTrue mailer daemon.
- **Data Flow:** GoTrue fetches `http://caddy:8080/templates/magic_link.html`, injects Go template variables (`{{ .ConfirmationURL }}`, `{{ .Token }}`), and transmits via SMTP.
- **Closest Analog:** Caddy static asset serving via `dist/` and GoTrue built-in template syntax.
- **Architecture Pattern:** Zero additional volume mounts or containers. Because `docker/caddy.Dockerfile` copies `apps/web/dist` to `/srv`, placing this file in `apps/web/public/templates/magic_link.html` automatically bundles it to `dist/templates/magic_link.html`, served by Caddy at `/templates/magic_link.html`.
- **Implementation Template:**
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
- **Pitfall / Trap:** Do NOT reference external fonts, scripts, or remote images. Keep all styles inline. Ensure both `{{ .ConfirmationURL }}` and `{{ .Token }}` are present and unescaped.

---

## Domain C: Web Client & UI Components

### 6. `apps/web/src/lib/auth/auth-client.ts`

- **Role:** Web auth client handling GoTrue authentication operations.
- **Data Flow:** Sends OTP requests to GoTrue backend over `/auth/v1/otp`.
- **Closest Analog:** Itself (`apps/web/src/lib/auth/auth-client.ts`, lines 136–146).
- **Existing Pattern Excerpt (`apps/web/src/lib/auth/auth-client.ts#L136-L146`):**
  ```typescript
  async sendSignInLink(email) {
    const { auth } = await ready;
    const { error } = await auth.signInWithOtp({
      email,
      // The email carries a link and a 6-digit code. The link lands on the app's root with the
      // session in the URL fragment, which `detectSessionInUrl` above is already watching for.
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    // The screen chooses the sentence: GoTrue's own message is for the log, not the user.
    if (error) throw new AuthError(error.message, error.status);
  },
  ```
- **Changes & Adaptations:**
  - Enforce `shouldCreateUser: false` (D-13):
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
    },
    ```

---

### 7. `apps/web/src/screens/onboarding/magic-link.ts`

- **Role:** Constants, formatting functions, and error handling for magic link screens.
- **Data Flow:** Maps raw `AuthError` responses to user-facing strings.
- **Closest Analog:** Itself (`apps/web/src/screens/onboarding/magic-link.ts`, lines 51–63).
- **Existing Pattern Excerpt (`apps/web/src/screens/onboarding/magic-link.ts#L57-L63`):**
  ```typescript
  export function magicLinkMessage(error: unknown, fallback: string): string {
    if (error instanceof AuthError) {
      if (error.status === 429) return RATE_LIMITED_MESSAGE;
      if (error.status === 0) return OFFLINE_MESSAGE;
    }
    return fallback;
  }
  ```
- **Changes & Adaptations:**
  - Add constant:
    ```typescript
    export const UNKNOWN_EMAIL_MESSAGE =
      'No account found with this email. Ask your household admin for an invite.';
    ```
  - Update `magicLinkMessage` to detect "signups not allowed for otp" or "not found" when an uninvited email is submitted (D-14):
    ```typescript
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

---

### 8. `apps/web/src/screens/onboarding/SignInScreen.tsx`

- **Role:** PWA Sign-in screen.
- **Data Flow:** Renders primary password sign-in form and magic link secondary action.
- **Closest Analog:** Itself (`SignInScreen.tsx`, lines 95–115).
- **Existing Pattern Excerpt (`SignInScreen.tsx#L101-L105`):**
  ```tsx
  {import.meta.env.VITE_MAGIC_LINK_ENABLED === 'true' && (
    <Link to="/sign-in/link" className="font-semibold text-section">
      Email me a sign-in link
    </Link>
  )}
  ```
- **Changes & Adaptations:**
  - Upgrade text link to secondary button with an "or" divider (D-16):
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
- **Pitfall / Trap:** The exact text string `"Email me a sign-in link"` must be preserved verbatim. `apps/web/scripts/check-build.mjs` contains a tripwire that scans for this literal text. Changing the wording will break post-build validation.

---

### 9. `apps/web/src/screens/onboarding/magic-link.test.tsx`

- **Role:** Unit / component tests for magic link screens and route registration.
- **Data Flow:** Simulates user interaction using `@testing-library/react` and `@testing-library/user-event`.
- **Closest Analog:** Itself (`magic-link.test.tsx`, lines 57–100).
- **Existing Pattern Excerpt (`magic-link.test.tsx#L58-L63` & `#L96-L100`):**
  ```typescript
  it('offers no magic-link option on sign in', () => {
    renderScreen(<SignInScreen />, { auth: signedOut() });

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: MAGIC_LINK_LABEL })).not.toBeInTheDocument();
  });

  it('offers the option on sign in', () => {
    renderScreen(<SignInScreen />, { auth: signedOut() });

    expect(screen.getByRole('link', { name: MAGIC_LINK_LABEL })).toHaveAttribute(
      'href',
  ...
  ```
- **Changes & Adaptations:**
  - Update queries: When flag is ON, `MAGIC_LINK_LABEL` is a `button` rather than a `link`.
  - Add test asserting that clicking the secondary button triggers navigation to `/sign-in/link`.
  - Add test for `MagicLinkRequestScreen` unknown email handling: mock `auth.sendSignInLink` rejecting with `AuthError('Signups not allowed for otp', 400)`, verify `UNKNOWN_EMAIL_MESSAGE` is displayed.

---

## Domain D: E2E Test Harness & Services

### 10. `e2e/support/env.ts`

- **Role:** Dynamic port allocator and run environment provider.
- **Data Flow:** Scans for available loopback ports at run start; exports constants to runner and workers.
- **Closest Analog:** Itself (`e2e/support/env.ts`, lines 62–93).
- **Existing Pattern Excerpt (`e2e/support/env.ts#L66-L93`):**
  ```typescript
  const CADDY_PORT_VALUE = (process.env['HESTIA_E2E_CADDY_PORT'] ??=
    reused['HESTIA_E2E_CADDY_PORT'] ?? freePort());
  const DB_PORT_VALUE = (process.env['HESTIA_E2E_DB_PORT'] ??=
    reused['HESTIA_E2E_DB_PORT'] ?? distinctFreePort(CADDY_PORT_VALUE));

  export const CADDY_PORT = Number(CADDY_PORT_VALUE);
  export const BASE_URL = `http://127.0.0.1:${CADDY_PORT_VALUE}`;
  export const DB_PORT = Number(DB_PORT_VALUE);

  function freePort(): string {
    const probe =
      "const s=require('node:net').createServer();" +
      "s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close();});";
    return execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8' }).trim();
  }

  function distinctFreePort(avoid: string): string {
    let port = freePort();
    while (port === avoid) port = freePort();
    return port;
  }
  ```
- **Changes & Adaptations:**
  - Generalize `distinctFreePort` to take multiple ports to avoid:
    ```typescript
    function distinctFreePort(...avoid: string[]): string {
      let port = freePort();
      while (avoid.includes(port)) port = freePort();
      return port;
    }
    ```
  - Allocate `HESTIA_E2E_INBUCKET_PORT` (D-12):
    ```typescript
    const INBUCKET_PORT_VALUE = (process.env['HESTIA_E2E_INBUCKET_PORT'] ??=
      reused['HESTIA_E2E_INBUCKET_PORT'] ??
      distinctFreePort(CADDY_PORT_VALUE, DB_PORT_VALUE));

    export const INBUCKET_PORT = Number(INBUCKET_PORT_VALUE);
    export const INBUCKET_BASE_URL = `http://127.0.0.1:${INBUCKET_PORT_VALUE}`;
    ```

---

### 11. `e2e/setup/stack.ts`

- **Role:** Docker Compose stack lifecycle manager for E2E runs.
- **Data Flow:** Writes run `.env` file, creates isolated bridge network, brings up data and application containers.
- **Closest Analog:** Itself (`e2e/setup/stack.ts`, lines 36–60, 100–108).
- **Existing Pattern Excerpt (`e2e/setup/stack.ts#L36-L55` & `#L100-L108`):**
  ```typescript
  const DATA_SERVICES = ['db', 'auth', 'realtime', 'kong'];
  ...
  function writeEnvFile(): void {
    mkdirSync(BACKUP_DIR, { recursive: true });
    rmSync(ENV_FILE, { force: true });
    runChecked('bash', [join(REPO_ROOT, 'scripts', 'generate-secrets.sh'), ENV_FILE], {
      HESTIA_ORIGIN: BASE_URL,
      CLOUDFLARE_TUNNEL_TOKEN: 'e2e-not-a-real-token',
      HESTIA_OWNER_EMAIL: 'alex@example.com',
      BACKUP_DIR,
    });
  }
  ...
  function appendRunEnv(subnet: Subnet): void {
    const lines = [
      `HESTIA_E2E_CADDY_PORT=${String(CADDY_PORT)}`,
      `HESTIA_E2E_DB_PORT=${String(DB_PORT)}`,
      `HESTIA_E2E_NETWORK=${NETWORK}`,
      `HESTIA_E2E_SUBNET=${subnet.subnet}`,
    ];
    appendFileSync(ENV_FILE, `${lines.join('\n')}\n`);
  }
  ```
- **Changes & Adaptations:**
  - Add `inbucket` to `DATA_SERVICES` before `auth`:
    ```typescript
    const DATA_SERVICES = ['db', 'inbucket', 'auth', 'realtime', 'kong'];
    ```
  - In `writeEnvFile()`, pass `HESTIA_MAGIC_LINK_ENABLED: 'true'` (D-11).
  - In `appendRunEnv()`, append `HESTIA_E2E_INBUCKET_PORT=${String(INBUCKET_PORT)}` (D-12).

---

### 12. `e2e/support/inbucket.ts` (NEW)

- **Role:** Test helper for querying Inbucket REST API and extracting auth tokens.
- **Data Flow:** Makes HTTP GET/DELETE requests to `${INBUCKET_BASE_URL}/api/v1/mailbox/{user}`.
- **Closest Analog:** `e2e/support/db.ts` (for helper ergonomics) and `e2e/support/env.ts` (for `INBUCKET_BASE_URL`).
- **Implementation Template:**
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

  export async function purgeMailbox(usernameOrEmail: string): Promise<void> {
    const mailbox = usernameOrEmail.split('@')[0];
    await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${mailbox}`, { method: 'DELETE' });
  }

  export async function waitForLatestEmail(
    usernameOrEmail: string,
    timeoutMs = 10000,
  ): Promise<InbucketMessageDetail> {
    const mailbox = usernameOrEmail.split('@')[0];
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
    throw new Error(`Timed out waiting for email to ${usernameOrEmail} in Inbucket`);
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
- **Pitfall / Trap:** Inbucket indexes mailboxes by the local username (`email.split('@')[0]`), NOT the full email address. Always extract the username before hitting `/api/v1/mailbox/{mailbox}`.

---

## Domain E: Automated Quality Gates & Static Testing

### 13. `apps/service/src/docker-compose-smtp.test.ts` (NEW)

- **Role:** Static configuration test enforcing production SMTP settings and E2E test-double bindings.
- **Data Flow:** Reads and parses `docker/docker-compose.yml` and `e2e/docker-compose.e2e.yml` with `yaml` and `zod`.
- **Closest Analog:** `apps/service/src/ingress-config.test.ts` (lines 9–80).
- **Existing Pattern Excerpt (`ingress-config.test.ts#L46-L80`):**
  ```typescript
  import { readFileSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  import { parseDocument, type ScalarTag } from 'yaml';
  import { describe, expect, it } from 'vitest';
  import { z } from 'zod';
  ...
  const composeReset: ScalarTag = { tag: '!reset', resolve: () => null };

  function readRepoFile(path: string): string {
    return readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');
  }

  function loadCompose(path: string): { messages: string[]; file: z.infer<typeof composeSchema> } {
    const document = parseDocument(readRepoFile(path), { customTags: [composeReset] });
    const messages = [...document.errors, ...document.warnings].map((problem) => problem.message);
    return { messages, file: composeSchema.parse(document.toJS()) };
  }
  ```
- **Test Invariants to Enforce:**
  - `auth` service in `docker-compose.yml`:
    - `GOTRUE_DISABLE_SIGNUP: 'true'`
    - `GOTRUE_MAILER_AUTOCONFIRM: 'true'`
    - `GOTRUE_MAILER_OTP_EXP: 900`
    - `GOTRUE_SITE_URL: ${HESTIA_ORIGIN}`
    - `GOTRUE_URI_ALLOW_LIST: ${HESTIA_ORIGIN},${HESTIA_ORIGIN}/**`
    - `GOTRUE_SMTP_HOST: ${GOTRUE_SMTP_HOST:-smtp.resend.com}`
    - `GOTRUE_SMTP_PORT: ${GOTRUE_SMTP_PORT:-465}`
    - `GOTRUE_SMTP_ADMIN_EMAIL: ${GOTRUE_SMTP_ADMIN_EMAIL:-auth@aberrance.app}`
    - `GOTRUE_SMTP_SENDER_NAME: ${GOTRUE_SMTP_SENDER_NAME:-Hestia}`
    - `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: http://caddy:8080/templates/magic_link.html`
  - `inbucket` service in `e2e/docker-compose.e2e.yml`:
    - image is `inbucket/inbucket:3.1.0`
    - ports include `127.0.0.1:${HESTIA_E2E_INBUCKET_PORT:?}:9000`
  - `auth` service in `e2e/docker-compose.e2e.yml`:
    - depends on `inbucket`
    - `GOTRUE_SMTP_HOST: inbucket`
    - `GOTRUE_SMTP_PORT: 2500`

---

### 14. `apps/service/src/ingress-config.test.ts` (Modification)

- **Role:** Existing static ingress configuration test.
- **Line to Update:** Line 139–140:
  ```typescript
  // Before:
  expect(published).toEqual(['caddy', 'db']);

  // After (accounting for Inbucket in E2E):
  expect(published).toEqual(['caddy', 'db', 'inbucket']);
  ```

---

### 15. `e2e/tests/07-magic-link.spec.ts` (NEW, replaces `07-magic-link-disabled.spec.ts`)

- **Role:** Primary Playwright E2E journey test covering complete magic link authentication flows.
- **Data Flow:** Web navigation, Inbucket mail retrieval, form submission, session assertion.
- **Closest Analog:** `e2e/tests/06-owner-reset-password.spec.ts` and `e2e/tests/07-magic-link-disabled.spec.ts`.
- **Key Test Cases:**
  1. **Build Flag & Entry Point:** Asserts `readStackEnv()['HESTIA_MAGIC_LINK_ENABLED'] === 'true'`. Verifies "or" divider and "Email me a sign-in link" button on `/sign-in`.
  2. **Uninvited Email Refusal:** Requests magic link for `uninvited@example.com`; asserts `UNKNOWN_EMAIL_MESSAGE` ("No account found with this email. Ask your household admin for an invite."); asserts zero emails received in Inbucket.
  3. **Happy Path OTP Code Entry:**
     - User `alex@example.com` requests magic link.
     - Intercepts email in Inbucket; verifies sender `Hestia <auth@aberrance.app>` and subject `Your Magic Link`.
     - Extracts 6-digit OTP code using `extractOtpCode`.
     - Fills code on `/sign-in/code`; clicks "Sign in".
     - Asserts `expectDashboard(page, 'Rivera Family')`.
  4. **Invalid Code Handling:** Submitting code `000000` displays error message `That code is incorrect or has expired. Ask for a new one.`
  5. **Direct Confirmation Link Navigation:**
     - User `sam@example.com` requests magic link.
     - Extracts confirmation URL via `extractConfirmationUrl`.
     - Opens URL in fresh browser context; asserts automatic session creation and redirect to dashboard.
  6. **Resend Cooldown Timer:** Navigates to `/sign-in/code`; verifies "Send a new code" button is disabled with countdown `You can ask for a new code in 30s.`.
  7. **Open Redirect Prevention:** Asserts GoTrue rejects redirect URLs to unauthorized external domains.

---

## Domain F: Canonical Documentation & Runbooks

### 16. `docs/deployment.md`

- **Role:** Central operational runbook for production infrastructure.
- **Data Flow:** Operator documentation for DNS setup and deployment verification.
- **Closest Analog:** Existing sections on "Dependencies the stack provides for itself" and "Troubleshooting".
- **Sections to Add / Update:**
  - Dedicated section **"Transactional Email (SMTP & DNS)"** documenting:
    - Provider: Resend (`smtp.resend.com:465`, TLS, user `resend`).
    - Sender identity: `Hestia <auth@aberrance.app>`.
    - Cloudflare DNS records:
      - SPF: `TXT @ v=spf1 include:resend.com ~all`
      - DKIM: `CNAME resend._domainkey resend._domainkey.resend.com.`
      - DMARC: `TXT _dmarc v=DMARC1; p=quarantine; rua=mailto:dmarc@aberrance.app; pct=100;`
      - Return-Path: `MX bounces feedback-smtp.resend.com. (Priority 10)`, `TXT bounces v=spf1 include:resend.com ~all`
  - Checklist in **"First-time setup" / "Ongoing deploys"**:
    - Note on recreating GoTrue: operators must run `hestia-compose up -d --wait` once after populating `GOTRUE_SMTP_PASS` in `/srv/hestia/.env` because `deploy.sh` does not recreate supporting services by default.
    - Smoke verification steps: trigger live magic link, verify SPF/DKIM pass in email headers, authenticate with 6-digit code.

---

## Verification & Anti-Pattern Checklist

| Check | Failure Mode Prevented | Verification Method |
|---|---|---|
| **App Shell Size Budget** | Bloating initial PWA bundle > 200 KB gzipped | `pnpm --filter @hestia/web build` (`check-build.mjs`) |
| **Build Tripwires** | Breaking lazy chunk checks for magic link copy | `check-build.mjs` validates all 4 strings in `MAGIC_LINK_COPY` |
| **Repo Hygiene Gate** | Accidental introduction of legacy names or CRLF | `node scripts/check-repo-hygiene.mjs` |
| **Ingress Overlay Port List** | `ingress-config.test.ts` failure due to Inbucket port | Line 140 updated to include `'inbucket'` in published array |
| **Port Collision Avoidance** | E2E runner port overlap under concurrent test runs | `distinctFreePort(CADDY_PORT_VALUE, DB_PORT_VALUE)` in `env.ts` |
| **Inbucket Mailbox Keying** | Querying empty mailbox due to full email address | `inbucket.ts` parses local username via `split('@')[0]` |
| **GoTrue Signup Protection** | Public visitors creating unauthorized user accounts | `GOTRUE_DISABLE_SIGNUP: 'true'` in Compose & `shouldCreateUser: false` in client |
| **Zero Additional Volumes** | Breaking D-05 constraint with extra container volumes | Caddy serves static `apps/web/public/templates/magic_link.html` |
