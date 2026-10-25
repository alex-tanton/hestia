# Research: Domain Migration, Cloudflare Integration, and Hestia Rebrand

**Date:** 2026-10-25
**Scope:** Architecture and technical contracts for migrating Hearth to Hestia on `hestia.aberrance.app` via Cloudflare.

---

## 1. Cloudflare Ingress & Cloudflare Tunnel (`cloudflared`)

### 1.1 Architecture Shift from Tailscale Funnel

- **Previous Architecture:** Tailscale Funnel terminated TLS on the host machine and forwarded plain HTTP to `127.0.0.1:8080`. Caddy trusted the host gateway IP.
- **New Architecture:** Cloudflare manages the DNS for `aberrance.app`. Ingress to `hestia.aberrance.app` is handled via **Cloudflare Tunnel (`cloudflared`)**:
  - A lightweight `cloudflared` container runs in the Docker Compose network (or systemd daemon).
  - Outbound-only connection: Establishes redundant encrypted HTTP/2 or QUIC tunnels to the nearest Cloudflare Edge data centers.
  - No open ports required on router/firewall (port 80 and 443 do not need forwarding).
  - Cloudflare Edge terminates client TLS with automatic certificates.
  - Traffic routes from Cloudflare Edge -> Tunnel -> Caddy (`http://caddy:8080`).

### 1.2 Caddy Configuration & Real IP Restoration

- When requests pass through Cloudflare (via Tunnel or Proxy), the client's true IP is passed in the `CF-Connecting-IP` header.
- Caddy must be configured to extract the client IP from `CF-Connecting-IP` rather than standard `X-Forwarded-For`.
- Caddy `trusted_proxies`:
  - When using Cloudflare Tunnel on the internal Docker network, Caddy trusts the `cloudflared` container IP / Docker gateway.
  - Caddy directives:
    ```caddy
    servers {
        trusted_proxies static 127.0.0.1/32 ::1/128 172.16.0.0/12 10.0.0.0/8 192.168.0.0/16
        client_ip_headers CF-Connecting-IP X-Forwarded-For
    }
    ```
- Security Headers:
  - CSP `connect-src` must be updated to `wss://hestia.aberrance.app https://hestia.aberrance.app`.
  - `form-action 'self'`, `frame-ancestors 'none'`, and HSTS `max-age=31536000` retained.

---

## 2. Magic Links & GoTrue Transactional Email

### 2.1 Web PWA Magic Link Capability

- The web app already has full UI screens and tests implemented in `apps/web/src/screens/onboarding/`:
  - `MagicLinkRequestScreen.tsx` (email submission)
  - `MagicLinkCodeScreen.tsx` (6-digit OTP code input)
  - `magic-link.ts` (copy, error mapping, normalization)
  - `magic-link.test.tsx` (Vitest coverage)
- These screens are conditionally compiled based on `VITE_MAGIC_LINK_ENABLED`.
- Enabling requires setting:
  - Docker build ARG: `ARG VITE_MAGIC_LINK_ENABLED=true`
  - Compose runtime: `HESTIA_MAGIC_LINK_ENABLED=true`

### 2.2 GoTrue SMTP Configuration (Resend / Postmark)

- GoTrue sends magic link confirmation emails via SMTP.
- Recommended configuration for Resend:
  - `GOTRUE_SMTP_HOST=smtp.resend.com`
  - `GOTRUE_SMTP_PORT=465` (or 587 with STARTTLS)
  - `GOTRUE_SMTP_USER=resend`
  - `GOTRUE_SMTP_PASS=<resend-api-key>`
  - `GOTRUE_SMTP_ADMIN_EMAIL=auth@aberrance.app`
  - `GOTRUE_SMTP_SENDER_NAME=Hestia`
- Cloudflare DNS records for `aberrance.app`:
  - SPF: `TXT @ v=spf1 include:amazonses.com ~all` (or Resend/Postmark SPF)
  - DKIM: `CNAME` records provided by email provider
  - DMARC: `TXT _dmarc.aberrance.app v=DMARC1; p=quarantine;`
- GoTrue URL allow-listing:
  - `GOTRUE_SITE_URL=https://hestia.aberrance.app`
  - `GOTRUE_URI_ALLOW_LIST=https://hestia.aberrance.app,https://hestia.aberrance.app/**`

---

## 3. Web Push & iOS PWA Requirements

### 3.1 VAPID Subject Specification (RFC 8292)

- Web Push servers (Apple Push Notification Service, Mozilla Autopush, Google FCM) require a valid contact URI in the JWT claims subject:
  - Form: `mailto:admin@aberrance.app` or `https://hestia.aberrance.app`
- Setting `VAPID_SUBJECT=mailto:admin@aberrance.app` satisfies strict RFC 8292 validation.

### 3.2 iOS Web Push Requirements

- iOS Safari 16.4+ requires:
  - Site must be running on a trusted HTTPS origin (fulfilled by `https://hestia.aberrance.app`).
  - Web App must be installed to the Home Screen (standalone display mode).
  - Push permission must be requested in response to an explicit user gesture.
  - Manifest must specify `display: "standalone"` and valid `icons`.

---

## 4. Rebrand: Hearth to Hestia

### 4.1 Scope of Changes

1. **Workspace Packages**:
   - `@hearth/shared` -> `@hestia/shared`
   - `@hearth/recurrence` -> `@hestia/recurrence`
   - `@hearth/matching` -> `@hestia/matching`
   - `@hearth/service` -> `@hestia/service`
   - `@hearth/web` -> `@hestia/web`
   - `@hearth/e2e` -> `@hestia/e2e`
2. **Environment & Docker**:
   - `HEARTH_*` -> `HESTIA_*` (`HESTIA_HOST`, `HESTIA_ORIGIN`, `HESTIA_MAGIC_LINK_ENABLED`, etc.)
   - Container names: `hestia-service`, `hestia-caddy`, `hestia-db`
   - CLI command: `hearth-admin` -> `hestia-admin`
3. **PWA Manifest & Web App**:
   - `name`: "Hestia"
   - `short_name`: "Hestia"
   - Title tags: `<title>Hestia</title>` and `${page} · Hestia`
   - User-facing strings in onboarding, headers, and shell.

---

## 5. Documentation Architecture

### 5.1 Simplified README

- The root `README.md` will focus on:
  - What Hestia is (purpose, key features)
  - Quickstart / Running locally in 3 commands
  - Project architecture & directory structure at a glance
  - Links to dedicated guides
- Abstracted guides created in `docs/`:
  - `docs/development.md`: Local development workflow, seed data, dev commands, and code standards.
  - `docs/deployment.md`: Production Docker Compose stack, Cloudflare Tunnel setup, environment variables, secrets generation, and backups.
  - `docs/testing.md`: Vitest unit/component tests, integration testing with Supabase, timezone sweep harness, and Playwright E2E suite.
