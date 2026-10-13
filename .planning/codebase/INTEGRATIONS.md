---
last_mapped_commit: b96ca32ac1130c09f8aa3066d715181ddf3fb31a
last_mapped_at: 2026-10-11
---
# External Integrations

**Analysis Date:** 2026-10-11

## APIs & External Services

**Flipp (grocery flyer and price data):**
- Used for: weekly store flyer items and sale prices that feed the shopping list and deals screens
- Base URL: `https://backflipp.wishabi.com` (constant `BASE_URL` in `apps/service/src/deals/flipp/flipp-deal-source.ts`)
- Endpoints called: `/flipp/items/search`, `/flipp/flyers`, `/flipp/flyers/{flyerId}`, `/flipp/items/{itemId}`, `/flipp/merchants` (endpoint table in the header comment of `flipp-deal-source.ts`)
- Client: hand-written `fetch` wrapper, no SDK. Requests go through a serialising queue in `apps/service/src/deals/flipp/request-queue.ts` to respect upstream rate limits
- Response normalisation: `apps/service/src/deals/flipp/normalized-fixtures.ts`; raw response types in `apps/service/src/deals/flipp/flipp-deal-source.ts`
- Transport seam: `apps/service/src/deals/flipp/fixture-transport.ts` replaces the live transport when `HEARTH_FLIPP_FIXTURE_DIR` is set (E2E only)
- Auth: none (public endpoints; location is sent as `postal_code`)
- Images: flyer and product images are served from `f.wishabi.net` and `images.wishabi.net`; these hosts are allowed by the `img-src` CSP in `docker/Caddyfile`
- Scheduled by: `apps/service/src/jobs/refresh-deals.ts`

**Recipe web pages (user-supplied URLs):**
- Used for: importing recipes by pasting a URL
- Client: Node `fetch` in `apps/service/src/recipes/fetch-recipe.ts`; no redirects followed, timeout and body-size caps applied
- Safety: private, loopback and link-local addresses are refused (`apps/service/src/recipes/private-address.ts`); per-host rate gap in `apps/service/src/recipes/host-rate-limiter.ts`
- Parsing: JSON-LD schema.org `Recipe` blocks in `apps/service/src/recipes/json-ld.ts`; HTML via `cheerio`; ingredients via `parse-ingredient` in `apps/service/src/recipes/ingredient-parser.ts`
- E2E override: `HEARTH_RECIPE_FIXTURE_DIR` reads checked-in HTML pages instead of fetching (`apps/service/src/recipes/fixture-fetch.ts`)

**Web Push (browser push notifications):**
- Used for: bill, chore, and errand reminders and list activity notifications
- Library: `web-push` 3.6.7 in `apps/service/src/push/web-push-transport.ts`
- Sends to the push service URL stored per browser subscription (the endpoint each browser reports); the destination is whichever push service the browser vendor provides, so there is no single fixed host
- Auth: VAPID. The public key is baked into the PWA at build time (`VITE_VAPID_PUBLIC_KEY`, `docker/caddy.Dockerfile`); the private key `VAPID_PRIVATE_KEY` is read only by the service; `VAPID_SUBJECT` or a derived `mailto:`/`https:` contact is sent in claims (`apps/service/src/env.ts`, `vapidSubjectFor`)
- Transport seam: `apps/service/src/push/recording-transport.ts` and `apps/service/src/push/test-seam.ts` (`HEARTH_PUSH_TRANSPORT=test-double` only in the E2E overlay)
- Client side: service worker registration and subscription from `apps/web/src/` (`UpdatePrompt.tsx` shell component; subscription endpoints below)

**Tailscale Funnel (public ingress):**
- Used for: publishing the app to the internet at `https://<machine>.<tailnet>.ts.net`
- Not an API client; the host runs `tailscale funnel --bg http://127.0.0.1:8080`. Documented in `README.md` ("Deployment")
- Caddy trusts only the Funnel hop when resolving the client IP (`docker/Caddyfile`, `trusted_proxies_strict`)

**Supabase-compatible services (self-hosted, not SaaS):**
- GoTrue, Realtime, Kong, and Postgres run as containers from Supabase images (see `docker/docker-compose.yml`)
- Local development uses the Supabase CLI (`supabase/config.toml`)

**Docker image registries:**
- `public.ecr.aws` (Supabase images), Docker Hub (`kong/kong`, `prodrigestivill/postgres-backup-local`, `caddy`, `node`)
- Pulled during `hearth-compose build` / `up` and in CI

**Not detected:**
- No Stripe, Twilio, SendGrid, Resend, Mailgun, or other transactional email API client in `apps/` or `packages/`
- No Sentry, Datadog, OpenTelemetry, PostHog, or other error or analytics SDK (`grep` for these names in `apps/`, `packages/`, and `package.json` files returned nothing)
- No OpenAI, Anthropic, or other LLM SDK
- No object storage (S3, GCS) or CDN SDK; the storage bucket is disabled in `supabase/config.toml` (`[storage] enabled = false`)

## Data Storage

**Databases:**
- PostgreSQL 17 (`public.ecr.aws/supabase/postgres:17.6.1.167` in production; `supabase start` locally)
  - Service connection: `DATABASE_URL` (postgres URL, validated in `apps/service/src/env.ts`); pool created in `apps/service/src/db.ts` with `pg.Pool`
  - Login role: `hearth_service` (migration `supabase/migrations/20260919060000_hearth_service_role.sql`)
  - Client: Kysely with `PostgresDialect` (`apps/service/src/db.ts`); types in `apps/service/src/db/types.ts`
  - Row-level security: `supabase/migrations/20260919070100_rls.sql`; isolation verified by `apps/service/src/db/rls-isolation.integration.test.ts`
  - Privileged paths: service-role transactions in `apps/service/src/privileged/service-role-db.ts` and `apps/service/src/privileged/job-database.ts`
  - Realtime publication: `supabase/migrations/20260919070300_realtime.sql`
  - Browser access: `apps/web` does not query Postgres directly; all reads and writes go through the Fastify API
- Migrations are applied by `supabase db reset` (local) and by `scripts/deploy.sh` (production)

**Database backups:**
- `prodrigestivill/postgres-backup-local:17-debian-d257e5d` container (service `backup` in `docker/docker-compose.yml`)
- Schedule `0 2 * * *`; retention 14 daily, 8 weekly, 6 monthly
- Output directory is `BACKUP_DIR` on the second physical disk; mounted read-only into `hearth-service`, which reports the newest file's mtime in System health (`apps/service/src/services/backups.ts`)

**File Storage:**
- Local filesystem only for backups; Supabase Storage is disabled (`supabase/config.toml`)
- Static PWA assets are served from the Caddy image at `/srv` (`docker/caddy.Dockerfile`)

**Caching:**
- Server: in-database cache table pruned by `apps/service/src/jobs/prune-cache.ts` (cache logic in `apps/service/src/services/deals/cache.ts`); no Redis or memcached
- Client: TanStack Query cache persisted to IndexedDB via `idb-keyval` (`apps/web/src/lib/offline/persist.ts`)

## Authentication & Identity

**Auth Provider:**
- Supabase GoTrue (`public.ecr.aws/supabase/gotrue:v2.196.0`), self-hosted in the Compose stack, reached at `GOTRUE_URL` (`http://auth:9999` internally)
  - Browser client: `@supabase/supabase-js` 2.116.0 in `apps/web/src/lib/auth/auth-client.ts`; the anon key is passed as a build argument. Tokens are stored by supabase-js default storage
  - Service client: `apps/service/src/gotrue/client.ts` and `apps/service/src/gotrue/http.ts` call GoTrue admin and user endpoints; `apps/service/src/privileged/gotrue-admin.ts` uses the service-role key for admin operations
  - Token verification: HS256 JWTs verified in `apps/service/src/auth/jwt.ts` with `JWT_SECRET` (min 32 chars)
  - API key: `ANON_KEY` sent as `apikey` to Kong; `SERVICE_ROLE_KEY` used only for sanctioned service-role operations
- Password policy: common-password list `packages/shared/src/common-passwords.ts`; minimum 8 characters (`supabase/config.toml`)
- Sign-up and password reset flows are gated at the edge: Caddy returns 403 for `POST /auth/v1/signup*` and `PUT /auth/v1/user*` so that the service enforces the common-password check and password re-entry (`docker/Caddyfile`)
- Magic link: optional, controlled by `HEARTH_MAGIC_LINK_ENABLED` which becomes build-time `VITE_MAGIC_LINK_ENABLED`; GoTrue SMTP settings are present only when magic link is enabled (`docker/docker-compose.yml` comment on the `auth` service)
- Owner role: `HEARTH_OWNER_EMAIL` identifies the server owner who can open System health (`apps/service/src/routes/system.ts`)
- Admin CLI: `apps/service/bin/hearth-admin` (for example `reset-password`), runs against GoTrue with `SERVICE_ROLE_KEY`
- Email for auth mail: GoTrue mailer configuration in `docker/docker-compose.yml` (`GOTRUE_MAILER_*` URL paths); no SMTP relay is set unless magic link is enabled

**Gateway:**
- Kong 3.9.3 (`docker/kong.yml`) routes `/auth/v1/*` to GoTrue and `/realtime/v1/*` to Realtime; `key-auth` requires an `apikey` header with anon or service-role consumers
- Kong entrypoint substitutes keys at start: `docker/kong-entrypoint.sh`

## Realtime

- Supabase Realtime (`public.ecr.aws/supabase/realtime:v2.130.0`) provides WebSocket change notifications for Postgres tables
- Proxied by Caddy as `wss://{$HEARTH_HOST}` (allowed by the `connect-src` CSP) through Kong at `/realtime/v1/`
- Web client port: `apps/web/src/lib/realtime/realtime-port.ts` (interface) with the Supabase implementation in `apps/web/src/lib/realtime/supabase-realtime.ts`, wired into the app through `apps/web/src/lib/api/api-context.tsx`
- Realtime tenant-encryption key and cookie secret supplied via `REALTIME_DB_ENC_KEY` and `REALTIME_SECRET_KEY_BASE` (`.env.example`)

## Monitoring & Observability

**Error Tracking:**
- None. No third-party error tracker is integrated
- Client-side errors are POSTed to `POST /api/client-error` (`apps/service/src/routes/system.ts`) and recorded through the service's own `recordError` dependency, not forwarded to a third party

**Logs:**
- Service: Fastify logger (pino-compatible JSON) with level from `LOG_LEVEL` (`apps/service/src/env.ts`)
- Caddy: JSON access logs to stdout (`docker/Caddyfile` `log` directive)
- Compose services: `json-file` driver, 10 MB max size, 5 files (`x-logging` in `docker/docker-compose.yml`)

**Health:**
- `GET /api/health` - liveness plus database connectivity (`apps/service/src/routes/health.ts`); used by Docker and deploy
- `GET /api/health/deep` - owner-only system report including backup age (`apps/service/src/routes/system.ts`)

## CI/CD & Deployment

**Hosting:**
- Self-hosted single Linux host running Docker Compose (`docker/docker-compose.yml`)
- Ingress: Tailscale Funnel to Caddy on `127.0.0.1:8080`

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`) on GitHub-hosted runners for lint, typecheck, unit, integration (Supabase CLI), E2E (Playwright with `supabase/setup-cli@v3`), and build
- Deploy: `.github/workflows/deploy.yml` runs on a self-hosted runner (`self-hosted`, `hearth`) after a `workflow_run`; it executes `scripts/deploy.sh`, which builds images tagged with the commit SHA, starts the stack, and applies migrations
- Dependency updates: Dependabot, weekly, for npm, GitHub Actions, and Docker (`.github/dependabot.yml`)
- E2E stack: `e2e/docker-compose.e2e.yml` overlays the production Compose file with fixture env vars and the `test-double` push transport

## Environment Configuration

**Required env vars (names only; values are never stored in the repository):**
- Service: `DATABASE_URL`, `HEARTH_ORIGIN`, `GOTRUE_URL`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- Host: `HEARTH_ORIGIN`, `HEARTH_OWNER_EMAIL`, `HEARTH_MAGIC_LINK_ENABLED`, `BACKUP_DIR`, `POSTGRES_PASSWORD`, `HEARTH_SERVICE_DB_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `REALTIME_SECRET_KEY_BASE`, `REALTIME_DB_ENC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- Optional: `HEARTH_RATE_LIMIT_PER_MINUTE` (default 300), `VAPID_SUBJECT`, `LOG_LEVEL`, `HEARTH_TRUSTED_PROXIES`
- Template: `.env.example` at repository root

**Secrets location:**
- Production: `/srv/hearth/.env` on the host, outside the checkout, created once by `scripts/generate-secrets.sh` (refuses to overwrite)
- Local development: `supabase start` generates its own keys; the repository ignores `.env` (`.gitignore`)
- CI: no production secrets; integration and E2E use the Supabase CLI local stack and fixture values

## Webhooks & Callbacks

**Incoming:**
- None from third parties. The service exposes its own endpoints only: `/api/*` (Fastify) and `/auth/v1/*`, `/realtime/v1/*` (through Kong)
- Push subscription management: `POST` and `DELETE /api/users/me/push-subscriptions` (`apps/service/src/routes/users.ts`)

**Outgoing:**
- Web Push messages to browser push services, one per subscribed device, sent by the notification dispatch job (`apps/service/src/jobs/dispatch-notifications.ts`)
- Flipp HTTP requests during the deals refresh job (`apps/service/src/jobs/refresh-deals.ts`)
- Recipe page fetches on user request (`apps/service/src/recipes/fetch-recipe.ts`)
- GoTrue admin calls from the service (`apps/service/src/gotrue/`)
- No outbound webhooks to user-configured URLs

## Scheduled Jobs That Make External Calls

Scheduled in-process with `node-cron` (`apps/service/src/jobs/scheduler.ts`, registry in `apps/service/src/jobs/index.ts`):
- `refresh-deals.ts` - Flipp
- `dispatch-notifications.ts` - Web Push
- `refresh-plan.ts`, `log-autopay.ts`, `prune-cache.ts` - database only

---

*Integration audit: 2026-10-11*
