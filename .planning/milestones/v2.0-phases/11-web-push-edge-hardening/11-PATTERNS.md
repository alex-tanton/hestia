# Phase 11: Web Push & Edge Hardening - Pattern Map

**Mapped:** 2026-11-02  
**Domain:** RFC 8292 VAPID subject enforcement, Caddy static asset caching & response headers, Cloudflare edge cache & WAF rate limiting policies, operator push verification CLI (`hestia-admin test-push`), standalone iOS/Android PWA verification runbook, and zero-regression quality gate ratchet (`PUSH-01`, `PUSH-02`, `EDGE-01`, `VERIFY-01`).  
**Files Analyzed:** 13 files (0 newly created, 13 modified or extended)  
**Analogs Found:** 13 / 13 (all files map directly to existing codebase implementations or self-extensions)  

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/service/src/env.ts` | Environment Schema & Parsing | Validates `process.env` against Zod schema at startup | Itself (`apps/service/src/env.ts` lines 78–93, 103–138, 146–157) | Exact |
| `apps/service/src/env.test.ts` | Environment Unit Test Suite | Passes test fixtures to `parseEnv` and `parseCliEnv` | Itself (`apps/service/src/env.test.ts` lines 4–13, 133–144, 146–222) | Exact |
| `.env.example` | Production Environment Template | Source template copied by secrets generator | Itself (`.env.example` lines 8–18, 57–60) | Exact |
| `docker/docker-compose.yml` | Container Orchestration Manifest | Forwards host environment to `hestia-service` | Itself (`docker/docker-compose.yml` lines 208–221) | Exact |
| `scripts/generate-secrets.sh` | Secrets Generation Script | Shell + Node script populating `/srv/hestia/.env` | Itself (`scripts/generate-secrets.sh` lines 72–90) | Exact |
| `e2e/setup/stack.ts` | E2E Stack Harness Setup | Spawns Docker Compose with test environment | Itself (`e2e/setup/stack.ts` lines 46–62) | Exact |
| `docker/Caddyfile` | Ingress Reverse Proxy Configuration | Emits response headers & proxies requests | Itself (`docker/Caddyfile` lines 21–29, 35–43, 50–62) | Exact |
| `apps/service/src/ingress-config.test.ts` | Static Ingress Configuration Tests | Parses Caddyfile & Compose YAML to assert invariants | Itself (`apps/service/src/ingress-config.test.ts` lines 61–70, 120–127) | Exact |
| `e2e/tests/20-ingress-client-ip-and-csp.spec.ts` | E2E Live Ingress Integration Suite | Queries live Caddy container via Playwright | Itself (`e2e/tests/20-ingress-client-ip-and-csp.spec.ts` lines 68–82) | Exact |
| `apps/service/src/cli.ts` | Operator Administrative CLI | Parses CLI args and dispatches admin operations | Itself (`apps/service/src/cli.ts` lines 26–58, 60–74) | Exact |
| `apps/service/src/cli.test.ts` | CLI Unit & Direct Invocation Suite | Tests argument validation, errors, and direct script entrypoint | Itself (`apps/service/src/cli.test.ts` lines 20–72, 123–186) | Exact |
| `package.json` | Root Workspace Manifest | Defines monorepo scripts & dependencies | Itself (`package.json` lines 9–29) | Exact |
| `docs/deployment.md` | Canonical Operations Runbook | Documentation for deployment, edge rules & verification | Itself (`docs/deployment.md` lines 140–155, 450–495) | Exact |

---

## Domain A: RFC 8292 VAPID Subject & Environment Hardening (`PUSH-01`)

### 1. `apps/service/src/env.ts`

- **Role:** Strictly validates environment variables at service startup. Enforces RFC 8292 contact URI syntax on `VAPID_SUBJECT` and exposes typed `Env` and `CliEnv`.
- **Data Flow:** `process.env` → `envSchema.safeParse` → `Env`.
- **Closest Analog:** Itself (`apps/service/src/env.ts`, lines 78–93, 103–138, 146–157).
- **Existing Pattern Excerpt (`apps/service/src/env.ts#L78-L94, #L103-L138`):**
  ```typescript
  /*
   * Web Push. The dispatch job is scheduled in every service process, so the key pair is required
   * at startup rather than failing on the first send. Both match the names docker-compose.yml
   * passes through from the host's .env.
   */
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  // The contact URI sent in each push request's VAPID claims. Optional: when unset it is derived in
  // `vapidSubjectFor`, so `Env.VAPID_SUBJECT` is always a usable mailto: or https: URI.
  VAPID_SUBJECT: z.string().min(1).optional(),
  HESTIA_PUSH_TRANSPORT: z.enum(['web-push', 'test-double']).default('web-push'),
});

export type Env = z.infer<typeof envSchema> & { VAPID_SUBJECT: string };

function isContactUri(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'mailto:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function vapidSubjectFor(env: {
  VAPID_SUBJECT?: string | undefined;
  HESTIA_OWNER_EMAIL: string;
  HESTIA_ORIGIN: string;
}): string {
  // Fallback derivation logic ...
}
  ```
- **Changes & Adaptations:**
  - Strengthen `isContactUri` to enforce that `mailto:` URIs contain a syntactically valid email address (e.g. `z.string().email().safeParse(url.pathname).success`) and that only `mailto:` or `https:` protocols are accepted.
  - In `envSchema`: Make `VAPID_SUBJECT` strictly required and refine with `isContactUri`:
    ```typescript
    VAPID_SUBJECT: z.string().min(1).refine(isContactUri, {
      message: 'VAPID_SUBJECT must be a mailto: or https: URI',
    }),
    ```
  - In `export type Env`: Change to `export type Env = z.infer<typeof envSchema>;` since `VAPID_SUBJECT` is directly in `envSchema`.
  - In `parseEnv`: Eliminate `vapidSubjectFor` derivation; `parseEnv` returns `parse(envSchema, source)` directly.
  - In `cliEnvSchema`: Extend with optional `DATABASE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (optional so existing `reset-password` tests and flows without database/push requirements continue to pass without changes).
- **Pitfalls / Traps:**
  - `new URL("mailto:admin@aberrance.app")` parses `"admin@aberrance.app"` into `url.pathname`. If query parameters are appended (`?subject=test`), `url.pathname` remains the email address.
  - Do NOT echo raw secret values or user emails in error messages thrown by environment parsing.

---

### 2. `apps/service/src/env.test.ts`

- **Role:** Unit tests for `parseEnv`, `parseCliEnv`, and environment error handling.
- **Data Flow:** Mock environment objects → `parseEnv` / `parseCliEnv` → assertion on output or caught error.
- **Closest Analog:** Itself (`apps/service/src/env.test.ts`, lines 4–13, 133–144, 146–222).
- **Existing Pattern Excerpt (`apps/service/src/env.test.ts#L4-L13`):**
  ```typescript
  const REQUIRED = {
    DATABASE_URL: 'postgres://u:p@db:5432/postgres',
    HESTIA_ORIGIN: 'https://hestia.aberrance.app/',
    GOTRUE_URL: 'http://auth:9999/',
    JWT_SECRET: 'x'.repeat(40),
    ANON_KEY: 'anon',
    SERVICE_ROLE_KEY: 'service',
    VAPID_PUBLIC_KEY: 'BPublicKeyPlaceholder',
    VAPID_PRIVATE_KEY: 'privatePlaceholder',
  };
  ```
- **Changes & Adaptations:**
  - Pre-populate `VAPID_SUBJECT: 'mailto:admin@aberrance.app'` in `REQUIRED`.
  - Add test: refuses to start when `VAPID_SUBJECT` is missing or empty.
  - Add test: accepts valid `mailto:admin@aberrance.app` and `https://hestia.aberrance.app`.
  - Add test: refuses non-contact URIs (`http://...`, plain strings, `mailto:not-an-email`) without echoing the value.
  - Delete obsolete tests that verified derivation from `HESTIA_OWNER_EMAIL` or `HESTIA_ORIGIN`.
- **Pitfalls / Traps:**
  - Because `VAPID_SUBJECT` becomes required in `envSchema`, every test calling `parseEnv(REQUIRED)` needs `VAPID_SUBJECT` present in `REQUIRED`.

---

### 3. `.env.example`, `docker/docker-compose.yml`, `scripts/generate-secrets.sh`, `e2e/setup/stack.ts`

- **Role:** Environment declaration templates, container environment propagation, and secret generation scripts.
- **Data Flow:**
  - `.env.example` provides default configuration.
  - `docker/docker-compose.yml` forwards `VAPID_SUBJECT` to the `hestia-service` container.
  - `scripts/generate-secrets.sh` extracts `VAPID_SUBJECT` from caller environment or keeps `.env.example` default.
  - `e2e/setup/stack.ts` passes `VAPID_SUBJECT` when invoking `generate-secrets.sh`.
- **Closest Analogs:**
  - `.env.example` (lines 57–60)
  - `docker/docker-compose.yml` (lines 218–221)
  - `scripts/generate-secrets.sh` (lines 72–79)
  - `e2e/setup/stack.ts` (lines 50–61)
- **Existing Pattern Excerpt (`docker/docker-compose.yml#L218-L221`):**
  ```yaml
        VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY:?set in .env}
        VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY:?set in .env}
        BACKUP_DIR: /backups
  ```
- **Changes & Adaptations:**
  - In `.env.example`:
    ```bash
    # The contact URI sent in each push request's VAPID claims (RFC 8292). Must be mailto: or https:
    VAPID_SUBJECT=mailto:admin@aberrance.app
    ```
  - In `docker/docker-compose.yml`:
    ```yaml
          VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY:?set in .env}
          VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY:?set in .env}
          VAPID_SUBJECT: ${VAPID_SUBJECT:?set in .env}
    ```
  - In `scripts/generate-secrets.sh`:
    Add `'VAPID_SUBJECT'` to `fromEnvironment` array:
    ```javascript
    const fromEnvironment = [
      'HESTIA_ORIGIN',
      'CLOUDFLARE_TUNNEL_TOKEN',
      'HESTIA_OWNER_EMAIL',
      'HESTIA_MAGIC_LINK_ENABLED',
      'GOTRUE_SMTP_PASS',
      'VAPID_SUBJECT',
      'BACKUP_DIR',
    ];
    ```
  - In `e2e/setup/stack.ts`:
    Add `VAPID_SUBJECT: 'mailto:admin@aberrance.app'` to `runChecked('bash', ...)` env overrides.
- **Pitfalls / Traps:**
  - Do not put `VAPID_SUBJECT` in `generated` in `generate-secrets.sh`: it is not a random key.
  - If `VAPID_SUBJECT` is not forwarded in `docker-compose.yml`, the service container will crash on boot with a missing variable error.

---

## Domain B: Edge Caching & Response Headers (`EDGE-01`)

### 4. `docker/Caddyfile`

- **Role:** Production reverse proxy and static asset server. Emits strict HTTP response headers and routes requests to internal containers.
- **Data Flow:** Incoming HTTP request from `cloudflared` on `:8080` → evaluates matchers and response headers → static file server or reverse proxy.
- **Closest Analog:** Itself (`docker/Caddyfile`, lines 21–29, 35–43, 50–62).
- **Existing Pattern Excerpt (`docker/Caddyfile#L20-L29, #L58-L62`):**
  ```caddy
  :8080 {
  	header {
  		defer
  		Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://f.wishabi.net https://images.wishabi.net; connect-src 'self' wss://{$HESTIA_HOST}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  		Strict-Transport-Security "max-age=31536000"
  		X-Content-Type-Options "nosniff"
  		Referrer-Policy "same-origin"
  		Permissions-Policy "camera=(), microphone=(), geolocation=()"
  	}

  	route {
  		respond @refused_signup 403
  		respond @refused_user 403
  		...
  		root * /srv
  		try_files {path} /index.html
  		file_server
  	}
  }
  ```
- **Changes & Adaptations:**
  - Configure three path matchers and caching headers inside `:8080`:
    ```caddy
  	# Cache-Control policies
  	@assets path /assets/*
  	header @assets Cache-Control "public, max-age=31536000, immutable"

  	@entry path / /index.html /sw.js
  	header @entry Cache-Control "no-cache, must-revalidate"

  	@icons_manifest path /icons/* /manifest.webmanifest /favicon.ico
  	header @icons_manifest Cache-Control "public, max-age=86400, must-revalidate"
    ```
  - Place headers inside or outside `route`: in Caddy, putting `header @match ...` at the site block level or inside `route` ensures response headers are applied to static files.
- **Pitfalls / Traps:**
  - SPA client routes (like `/chores` or `/bills`) are rewritten to `/index.html` by `try_files {path} /index.html`. Using `@entry path / /index.html /sw.js` guarantees direct navigations to `/` and `/index.html` are never cached stale.

---

### 5. `apps/service/src/ingress-config.test.ts` & `e2e/tests/20-ingress-client-ip-and-csp.spec.ts`

- **Role:** Static configuration test and live container integration test asserting ingress header policies.
- **Data Flow:**
  - `ingress-config.test.ts`: Reads `docker/Caddyfile` directly and verifies directive strings and matchers.
  - `20-ingress-client-ip-and-csp.spec.ts`: Issues Playwright HTTP GET requests to `/index.html`, `/sw.js`, `/manifest.webmanifest`, `/assets/*` against running Caddy container and verifies `Cache-Control` header values.
- **Closest Analogs:**
  - `ingress-config.test.ts` (lines 61–70, 120–127)
  - `20-ingress-client-ip-and-csp.spec.ts` (lines 68–82)
- **Existing Pattern Excerpt (`ingress-config.test.ts#L64-L68`):**
  ```typescript
  const caddyDirectives = caddyfile
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
  ```
- **Existing Pattern Excerpt (`20-ingress-client-ip-and-csp.spec.ts#L68-L82`):**
  ```typescript
  test("the CSP allows WebSockets to the stack's own host and no CORS or cookie header is sent", async ({
    request,
  }) => {
    const page = await request.get('/');
    expect(page.status()).toBe(200);
    expect(page.headers()['content-security-policy']).toContain(
      `connect-src 'self' wss://${new URL(BASE_URL).host}`,
    );
  });
  ```
- **Changes & Adaptations:**
  - In `ingress-config.test.ts`:
    ```typescript
    it('configures differentiated Cache-Control headers for hashed assets, entrypoints, and manifest', () => {
      expect(caddyDirectives).toContain('@assets path /assets/*');
      expect(caddyDirectives).toContain(
        'header @assets Cache-Control "public, max-age=31536000, immutable"',
      );
      expect(caddyDirectives).toContain('@entry path / /index.html /sw.js');
      expect(caddyDirectives).toContain(
        'header @entry Cache-Control "no-cache, must-revalidate"',
      );
      expect(caddyDirectives).toContain(
        '@icons_manifest path /icons/* /manifest.webmanifest /favicon.ico',
      );
      expect(caddyDirectives).toContain(
        'header @icons_manifest Cache-Control "public, max-age=86400, must-revalidate"',
      );
    });
    ```
  - In `20-ingress-client-ip-and-csp.spec.ts`:
    ```typescript
    test('serves static assets with immutable cache and entrypoints with no-cache', async ({ request }) => {
      const index = await request.get('/index.html');
      expect(index.status()).toBe(200);
      expect(index.headers()['cache-control']).toBe('no-cache, must-revalidate');

      const sw = await request.get('/sw.js');
      expect(sw.status()).toBe(200);
      expect(sw.headers()['cache-control']).toBe('no-cache, must-revalidate');

      const manifest = await request.get('/manifest.webmanifest');
      expect(manifest.status()).toBe(200);
      expect(manifest.headers()['cache-control']).toBe('public, max-age=86400, must-revalidate');
    });
    ```
- **Pitfalls / Traps:**
  - If querying `/assets/*` in E2E tests, resolve an actual asset filename from the `index.html` body (e.g. regex match on `/assets/index-[a-zA-Z0-9_-]+\.js`) so Caddy returns a 200 rather than falling back via `try_files`.

---

## Domain C: Operator Push CLI Tooling (`PUSH-02`)

### 6. `apps/service/src/cli.ts`

- **Role:** Administrative CLI command processor for `hestia-admin`.
- **Data Flow:** CLI arguments (`process.argv.slice(2)`) → subcommand dispatcher → `reset-password` (GoTrue Admin) or `test-push` (Profile / PushSubscription lookup + `PushTransport.send`).
- **Closest Analog:** Itself (`apps/service/src/cli.ts`, lines 26–58, 60–74).
- **Existing Pattern Excerpt (`apps/service/src/cli.ts#L26-L58`):**
  ```typescript
  export async function runCli(
    args: readonly string[],
    admin: Pick<GoTrueAdmin, 'recoveryLink'>,
    origin: string,
    io: CliIo,
  ): Promise<number> {
    const [command, email, ...rest] = args;
    if (command !== 'reset-password' || email === undefined || rest.length > 0) {
      io.err(USAGE);
      return 2;
    }
    if (!z.email().safeParse(email).success) {
      io.err(`Not an email address: ${email}`);
      return 2;
    }
    ...
  ```
- **Changes & Adaptations:**
  - Define interfaces for push operations:
    ```typescript
    export interface PushSubscriptionTarget {
      id: string;
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }

    export interface PushOps {
      lookupUser: (email: string) => Promise<{ id: string } | undefined>;
      listSubscriptions: (userId: string) => Promise<PushSubscriptionTarget[]>;
      deleteSubscription: (id: string) => Promise<void>;
      transport: PushTransport;
    }
    ```
  - Subcommand parsing:
    - `reset-password <email>`: Keep existing behavior and error handling.
    - `test-push --email <email> [--title <title>] [--body <body>]`:
      - Parse options using Node's standard flags or a helper.
      - If `--email` is missing: print `Usage: hestia-admin test-push --email <email> [--title <title>] [--body <body>]` to `io.err` and return code 2.
      - If `--email` fails `z.string().email()`: print `Not an email address: ${email}` to `io.err` and return code 2.
      - Default `--title` to `'Test Push Notification'`.
      - Default `--body` to `'This is a test notification from Hestia.'`.
      - Execute `pushOps.lookupUser(email)`: if undefined, print `No user has the email ${email}.` to `io.err` and return code 1.
      - Execute `pushOps.listSubscriptions(user.id)`: if empty array, print `User ${email} has no active push subscriptions.` to `io.err` and return code 1.
      - For each subscription:
        - Construct message: `JSON.stringify({ title, body, url: '/' })`.
        - Send via `pushOps.transport.send(subscription, message)`.
        - If `result.kind === 'accepted'`: increment `accepted`.
        - If `result.kind === 'gone'`: call `pushOps.deleteSubscription(subscription.id)` and increment `gone`.
        - If `result.kind === 'failed'`: increment `failed`.
      - Print summary to `io.out`:
        `Dispatched test push to ${total} device(s) for ${email}: ${accepted} accepted, ${gone} gone, ${failed} failed.`
      - Return 0.
  - Backwards-compatible `runCli` signature:
    ```typescript
    export async function runCli(
      args: readonly string[],
      admin: Pick<GoTrueAdmin, 'recoveryLink'>,
      origin: string,
      io: CliIo,
      pushOps?: PushOps,
    ): Promise<number>
    ```
  - In `invokedDirectly` block:
    ```typescript
    if (invokedDirectly) {
      const env = parseCliEnv(process.env);
      const admin = createGoTrueAdmin({ url: env.GOTRUE_URL, serviceRoleKey: env.SERVICE_ROLE_KEY });
      let pushOps: PushOps | undefined;
      let dbHandle: DatabaseHandle | undefined;

      if (process.argv[2] === 'test-push') {
        if (!env.DATABASE_URL || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
          process.stderr.write('Missing required environment variables for test-push.\n');
          process.exit(1);
        }
        dbHandle = createDatabase(env.DATABASE_URL);
        const transport = createWebPushTransport({
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        });
        pushOps = {
          lookupUser: async (email) => {
            const { rows } = await withServiceRoleDb(dbHandle!.db, (trx) =>
              sql<{ id: string }>`select id from public.profile where lower(email) = lower(${email})`.execute(trx),
            );
            return rows[0];
          },
          listSubscriptions: async (userId) => {
            const { rows } = await withServiceRoleDb(dbHandle!.db, (trx) =>
              sql<{ id: string; endpoint: string; keys: unknown }>`
                select id, endpoint, keys from public.push_subscription where user_id = ${userId}::uuid order by created_at, endpoint
              `.execute(trx),
            );
            const valid: PushSubscriptionTarget[] = [];
            for (const row of rows) {
              const parsed = pushKeysSchema.safeParse(row.keys);
              if (parsed.success) valid.push({ id: row.id, endpoint: row.endpoint, keys: parsed.data });
            }
            return valid;
          },
          deleteSubscription: async (id) => {
            await withServiceRoleDb(dbHandle!.db, (trx) =>
              sql`delete from public.push_subscription where id = ${id}::uuid`.execute(trx),
            );
          },
          transport,
        };
      }

      try {
        process.exitCode = await runCli(
          process.argv.slice(2),
          admin,
          env.HESTIA_ORIGIN,
          {
            out: (line) => process.stdout.write(`${line}\n`),
            err: (line) => process.stderr.write(`${line}\n`),
          },
          pushOps,
        );
      } finally {
        if (dbHandle) await dbHandle.close();
      }
    }
    ```
- **Pitfalls / Traps:**
  - `cli.ts` is explicitly permitted by ESLint's service-role fence to import from `privileged/` (`withServiceRoleDb`).
  - Always close `dbHandle` in a `finally` block to prevent lingering open connection pools when executed as a script.

---

### 7. `apps/service/src/cli.test.ts`

- **Role:** Comprehensive unit and direct invocation tests for `cli.ts`.
- **Data Flow:** Test arguments and mocked dependencies → `runCli` → assertions on exit codes and stdout/stderr arrays.
- **Closest Analog:** Itself (`apps/service/src/cli.test.ts`, lines 20–72, 123–186).
- **Existing Pattern Excerpt (`apps/service/src/cli.test.ts#L7-L15`):**
  ```typescript
  function io() {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) },
    };
  }
  ```
- **Changes & Adaptations:**
  - Add tests for `test-push` argument validation:
    - Missing `--email` flag prints usage and exits with code 2.
    - Invalid email string prints error and exits with code 2.
    - Unknown subcommands print usage and exit with code 2.
  - Add tests for domain errors:
    - Non-existent user prints `No user has the email ...` and exits with code 1.
    - User with 0 subscriptions prints `User ... has no active push subscriptions.` and exits with code 1.
  - Add test for successful push dispatch:
    - Dispatches payload to subscriptions via mock `transport`.
    - Returns code 0 and prints summary: `Dispatched test push to 2 device(s) for user@example.com: 2 accepted, 0 gone, 0 failed.`.
  - Add test for expired subscription handling:
    - When transport returns `{ kind: 'gone' }`, `deleteSubscription` is called with that subscription's id.
- **Pitfalls / Traps:**
  - Retain all existing unit tests for `reset-password`.

---

### 8. `package.json`

- **Role:** Monorepo package manifest script configuration.
- **Data Flow:** Operator or developer invokes `pnpm hestia-admin <cmd>` → delegates to `@hestia/service`.
- **Closest Analog:** Itself (`package.json`, lines 20–23).
- **Existing Pattern Excerpt (`package.json#L20-L23`):**
  ```json
      "db:types": "pnpm --filter @hestia/service db:types",
      "db:seed": "pnpm --filter @hestia/service db:seed",
      "fixtures:normalize": "pnpm --filter @hestia/service fixtures:normalize",
      "test:e2e": "pnpm --filter @hestia/e2e test:e2e",
  ```
- **Changes & Adaptations:**
  - Add: `"hestia-admin": "pnpm --filter @hestia/service exec hestia-admin"`
- **Pitfalls / Traps:**
  - Ensure formatting matches Prettier rules (`pnpm format:check`).

---

## Domain D: Operational Documentation & Runbooks

### 9. `docs/deployment.md`

- **Role:** Canonical production deployment documentation and operator verification guide.
- **Data Flow:** Read by operators; contains configuration tables, curl verification commands, and PWA runbooks.
- **Closest Analog:** Itself (`docs/deployment.md`, lines 140–155 for environment variables, lines 450–495 for DNS and verification).
- **Changes & Adaptations:**
  1. **Environment Variables Table Update:**
     - Update `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` section to document `VAPID_SUBJECT` as strictly required in `/srv/hestia/.env` with RFC 8292 contact URI syntax.
     - Remove the obsolete paragraph describing fallback derivation from `HESTIA_OWNER_EMAIL` or `HESTIA_ORIGIN`.
  2. **Cloudflare Edge Caching Runbook:**
     - Document Cloudflare Dashboard navigation (Zone `aberrance.app` → **Caching** → **Cache Rules** → **Create rule**).
     - Rule Name: `Cache Hestia Static Assets`.
     - Expression: `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/assets/")`.
     - Setting: Cache eligibility `Eligible for cache`, Edge TTL `Respect origin`, Browser TTL `Respect origin`.
     - Curl verification command:
       ```bash
       curl -sI https://hestia.aberrance.app/assets/<bundle>.js | grep -iE 'cf-cache-status|cache-control'
       ```
       (Verifies `cf-cache-status: HIT` and `Cache-Control: public, max-age=31536000, immutable`).
  3. **Cloudflare Edge Security & WAF Rate Limiting Policy:**
     - Document Cloudflare Dashboard navigation (Zone `aberrance.app` → **Security** → **WAF** → **Rate limiting rules** → **Create rule**).
     - Rule Name: `Protect Hestia Auth Endpoints`.
     - Expression: `http.host eq "hestia.aberrance.app" and starts_with(http.request.uri.path, "/auth/v1/") and http.request.method eq "POST"`.
     - Rate threshold: 15 requests per 1 minute per client IP.
     - Mitigation Action: `Managed Challenge` (Cloudflare Turnstile) with a 10-minute action duration.
     - Include curl simulation test script demonstrating 15 accepted requests followed by HTTP 403 challenge.
  4. **Mobile Web Push Verification Runbook:**
     - Prerequisites and constraints for iOS Safari 16.4+ (standalone home-screen PWA, HTTPS origin, direct user tap permission grant) and Android Chrome.
     - Step-by-step verification instructions:
       1. Add to Home Screen from Safari / Chrome.
       2. Open standalone PWA.
       3. Sign in via magic link or password.
       4. Toggle notification permission in Settings → Notifications.
       5. Dispatch immediate test push via operator CLI:
          ```bash
          docker compose exec hestia-service hestia-admin test-push --email <user-email>
          ```
       6. Confirm native OS notification received and tapped.
- **Pitfalls / Traps:**
  - Never mention the former product name in any new text or code examples; `scripts/check-repo-hygiene.mjs` scans markdown documentation and will fail if the retired brand name appears outside the allowlist.

---

## Domain E: Quality Gate Ratchet Patterns (`VERIFY-01`)

The final phase plan must execute the full monorepo quality suite with a 100% green gate:

```bash
# 1. Code style & formatting
pnpm lint
pnpm format:check

# 2. TypeScript compilation across all 7 workspaces
pnpm typecheck

# 3. Unit & Integration test suites
pnpm test
pnpm --filter @hestia/service test:integration

# 4. Dead code & Knip baseline
pnpm knip
node scripts/check-knip-baseline.mjs

# 5. Code duplication budget (<= 2.0%)
pnpm jscpd

# 6. Repository hygiene & migration safety
node scripts/check-repo-hygiene.mjs
node scripts/check-migrations-append-only.mjs

# 7. Production build check
pnpm build
```

---

## Common Pitfalls & Anti-Patterns to Avoid

| Pitfall | Anti-Pattern | Correct Pattern |
|---|---|---|
| **VAPID Contact URI format** | Allowing arbitrary strings or plain `http://` URIs | Enforce `isContactUri` using `URL` parsing where protocol is `https:` or `mailto:` with validated email |
| **Caddy header override** | Using standard header directives that get overridden by upstream proxies | Use Caddy matchers with exact path patterns (`@assets`, `@entry`, `@icons_manifest`) alongside proper ordering |
| **WAF rate limiting GET requests** | Applying edge rate limiting to all requests under `/auth/v1/*` | Restrict rate limiting strictly to `POST` requests so frequent session checks (`GET /auth/v1/user`) are never rate limited |
| **CLI DB pool leaks** | Creating a Kysely pool in `cli.ts` without calling `close()` | Wrap CLI script execution in `try ... finally { await dbHandle.close(); }` |
| **Hygiene check regression** | Typing the former product name in comments or docs | Never use the legacy name; use "the former name" or "rebrand" |
| **JSCPD duplication spike** | Copying large argument parsing blocks or SQL queries | Reuse types (`PushSubscriptionTarget`, `PushOutcome`), helper functions, and schema definitions |

---

## PATTERN MAPPING COMPLETE
