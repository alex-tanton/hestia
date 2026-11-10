# Phase 12: Store & Deal Image Delivery - Research

**Researched:** 2026-11-09  
**Domain:** Content-Security-Policy (Caddy), PWA Service Worker (Workbox), Centralized Domain Validation (@hestia/shared), Image Rendering (React/DealImage)  
**Confidence:** HIGH  

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Centralize allowed image domain definitions and URL validation in `@hestia/shared` — Export `isAllowedImageUrl` and allowed domain constants so `apps/web/src/screens/deals/DealImage.tsx`, `apps/web/src/sw.ts`, and test suites share a single source of truth. — **Reversibility:** costly — touches shared package exports and web/service-worker bundler imports.
- **D-02:** Strict HTTPS and dot-subdomain suffix validation — Enforce `protocol === 'https:'` and match `hostname === domain || hostname.endsWith('.' + domain)` against `['flipp.com', 'wishabi.com', 'wishabi.net', 'openfoodfacts.org']`. This safely admits regional/subdomain CDNs while preventing attacker domain bypasses (e.g. `attacker-flipp.com`) and insecure HTTP.
- **D-03:** Scope strictly to remote HTTPS CDN domains — `isAllowedImageUrl` and service worker caching are scoped to remote HTTPS CDN domains. Internal application icons, UI assets, and local SVGs continue using standard Vite static asset imports and relative paths.
- **D-04:** Caddyfile Content-Security-Policy wildcard origins — Update `docker/Caddyfile` `img-src` directive to `img-src 'self' data: https://*.flipp.com https://flipp-image-retrieval.flipp.com https://*.wishabi.com https://*.wishabi.net https://*.openfoodfacts.org;`, aligning with CSP Level 3 and ensuring browser-level delivery is unblocked.

### the agent's Discretion
- **Service Worker cache sizing (`deal-images` cache in `apps/web/src/sw.ts`):** Builder may maintain the existing 100-entry / 7-day quota or moderately increase to 200 entries to handle the broader domain footprint. (Recommendation: Increase to 200 entries; 200 entries requires ~10-20MB cache storage, well within browser origin storage budgets and ideal for weekly multi-flyer browsing).
- **Unit and integration tests:** Comprehensive unit test coverage for the matcher in `@hestia/shared`, updated `sw.test.ts` for the route matcher, and tests for `DealImage.tsx` placeholder behavior.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **IMG-01** | Caddy Content-Security-Policy `img-src` allows modern Flipp (`*.flipp.com`, `flipp-image-retrieval.flipp.com`, `*.wishabi.com`, `*.wishabi.net`) and Open Food Facts CDNs. | Update `docker/Caddyfile:14` with CSP Level 3 wildcard hosts. Verified syntax and test coverage in `e2e/tests/20-ingress-client-ip-and-csp.spec.ts`. |
| **IMG-02** | PWA Service Worker intercepts and caches deal images and merchant logos across all allowed Flipp and Open Food Facts domains. | Update Workbox `registerRoute` in `apps/web/src/sw.ts:73-83` to use `isAllowedImageUrl(url)`, preserving `statuses: [0, 200]` for opaque CDN responses and sizing quota to 200 entries / 7 days. |
| **IMG-03** | `DealImage` component and merchant logo views permit modern Flipp and Open Food Facts origins, preventing broken placeholder fallbacks for valid images. | Refactor `apps/web/src/screens/deals/DealImage.tsx:11-23` to import `isAllowedImageUrl` from `@hestia/shared`. Re-export for backward compatibility. |
</phase_requirements>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ingress CSP Enforcement | Ingress (Caddy reverse proxy) | — | Caddy sets the `Content-Security-Policy` header (`img-src`), controlling which external origins the browser engine is allowed to fetch image bitmaps from. |
| Centralized CDN Validation | Shared Core (`@hestia/shared`) | — | Pure TypeScript validation logic (`isAllowedImageUrl`, `ALLOWED_IMAGE_DOMAINS`) shared by web runtime, service worker, and tests; prevents domain drift and bypass vulnerabilities. |
| Offline Asset Caching | Client PWA Worker (`apps/web/src/sw.ts`) | Browser Cache Storage | Intercepts fetch requests for allowed CDN images using Workbox `CacheFirst`, caching opaque responses (status 0) and status 200 for 7 days. |
| UI Rendering & Placeholder State | Client UI (`DealImage.tsx`) | Browser DOM | Renders `<img>` with lazy loading and async decoding for valid URLs; displays accessible `ImageOff` placeholder on null URLs, disallowed domains, or load errors. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 12 addresses the critical failure where deal item thumbnails and merchant store logos render as broken placeholders across the Hestia web application. This occurs because the initial implementation hardcoded external image sources to only two legacy hosts (`https://f.wishabi.net` and `https://images.wishabi.net`) across three disconnected locations: Caddy ingress CSP, Workbox service worker routing, and the `DealImage` React component. Modern Flipp infrastructure distributes flyer media and logos across multiple domains including `*.flipp.com`, `flipp-image-retrieval.flipp.com`, and `*.wishabi.com`, while upcoming barcode scanning and grocery features require `*.openfoodfacts.org`.

The architectural solution establishes a single source of truth in `@hestia/shared`:
1. `packages/shared/src/images.ts` defines `ALLOWED_IMAGE_DOMAINS` and `isAllowedImageUrl`, implementing strict HTTPS enforcement and dot-subdomain suffix validation (`hostname === domain || hostname.endsWith('.' + domain)`). This admits regional subdomains while preventing domain injection attacks (such as `attacker-flipp.com` or `flipp.com.attacker.com`).
2. `docker/Caddyfile` updates the `img-src` CSP directive to include the new wildcard domains according to CSP Level 3 rules.
3. `apps/web/src/sw.ts` delegates route matching to `isAllowedImageUrl`, caching opaque (`status: 0`) cross-origin responses and status 200 via `CacheFirst` with an updated 200-entry / 7-day limit.
4. `apps/web/src/screens/deals/DealImage.tsx` replaces its local origin array with the shared validator, maintaining decorative `alt=""` and graceful fallback to `<ImageOff />`.

**Primary recommendation:** Centralize all domain checking in `packages/shared/src/images.ts`, re-export through `packages/shared/src/index.ts`, update `docker/Caddyfile` line 14 with CSP Level 3 wildcards, and import `isAllowedImageUrl` into both `sw.ts` and `DealImage.tsx`.
</research_summary>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@hestia/shared` | workspace:* | Shared domain logic and types | Monorepo standard for cross-workspace utilities [VERIFIED: packages/shared/package.json:1-25] |
| `workbox-routing` | 7.4.1 | Service worker request interception | Existing PWA routing engine in `apps/web/src/sw.ts` [VERIFIED: apps/web/package.json:49] |
| `workbox-strategies` | 7.4.1 | `CacheFirst` resource handling | Serves immutable CDN images instantly from Cache Storage [VERIFIED: apps/web/package.json:50] |
| `workbox-cacheable-response` | 7.4.1 | Opaque cross-origin response caching | Status 0 responses from `no-cors` image fetches require explicit caching rules [VERIFIED: apps/web/package.json:46] |
| `workbox-expiration` | 7.4.1 | Cache size and TTL pruning | Enforces maxEntries quota and 7-day maxAgeSeconds [VERIFIED: apps/web/package.json:47] |
| `lucide-react` | 1.47.0 | Fallback `ImageOff` icon | Project design system icon for missing/failed images [VERIFIED: apps/web/src/screens/deals/DealImage.tsx:1] |

### Installation
No new packages are needed. All required packages are already pinned in the workspace lockfile and `package.json` manifests.

## Technical Deep Dives

### 1. Ingress Content Security Policy (`docker/Caddyfile`)
In `docker/Caddyfile:14`, the Content-Security-Policy header defines the browser's origin boundary.
**Current configuration:**
```caddy
Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://f.wishabi.net https://images.wishabi.net; connect-src 'self' wss://{$HESTIA_HOST}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
```
[VERIFIED: docker/Caddyfile:14]

**Updated configuration (D-04):**
```caddy
Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.flipp.com https://flipp-image-retrieval.flipp.com https://*.wishabi.com https://*.wishabi.net https://*.openfoodfacts.org; connect-src 'self' wss://{$HESTIA_HOST}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
```

**CSP Level 3 Wildcard Syntax Rules:**
- W3C CSP Level 3 defines `host-source = [ scheme "://" ] host [ ":" port ] [ path ]`, where `host = "*" / [ "*." ] 1*host-char *( "." 1*host-char )`.
- `https://*.flipp.com` matches any subdomain such as `https://dam.flipp.com` and `https://cdn.flipp.com`.
- In strict CSP Level 3, `*.flipp.com` does NOT match the bare apex domain `flipp.com` without a subdomain. Listing `https://flipp-image-retrieval.flipp.com` alongside `https://*.flipp.com` guarantees that dedicated image retrieval endpoints pass unambiguously across all browser engines.
- Caddy header syntax: Caddy only performs interpolation when curly braces `{placeholder}` are encountered. Wildcard strings without braces (`*.flipp.com`) are emitted verbatim as plain string literals.

### 2. Workbox Service Worker Route & Caching (`apps/web/src/sw.ts`)
In `apps/web/src/sw.ts:63-83`, deal images are intercepted and cached.
**Current implementation:**
```typescript
/*
 * Deal images come straight from Flipp's CDN: cache-first, 7-day expiry, 100-entry cap. These two
 * hosts are the only ones the CSP's img-src allows for images. Cross-origin responses are opaque,
 * so status 0 counts as cacheable alongside 200.
 */
// Workbox's plugin typings predate exactOptionalPropertyTypes; the plugins are valid at runtime.
type CachePlugin = NonNullable<
  NonNullable<ConstructorParameters<typeof CacheFirst>[0]>['plugins']
>[number];

registerRoute(
  ({ url }) =>
    url.origin === 'https://f.wishabi.net' || url.origin === 'https://images.wishabi.net',
  new CacheFirst({
    cacheName: 'deal-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }) as CachePlugin,
      new CacheableResponsePlugin({ statuses: [0, 200] }) as CachePlugin,
    ],
  }),
);
```
[VERIFIED: apps/web/src/sw.ts:63-83]

**Key Technical Details:**
- **Why status 0 is required:** When an `<img>` tag requests a cross-origin resource without `crossOrigin="anonymous"`, the request mode is `no-cors`. The browser produces an **opaque response** with HTTP status code `0`. Workbox by default only considers status `200` cacheable. Omitting `0` prevents cross-origin image responses from being stored in Cache Storage, breaking offline display.
- **Cache Sizing:** Increasing `maxEntries` from 100 to 200 allows users to browse multiple merchant circulars and product barcodes without evicting recently viewed images. Storage impact is ~10-20MB, which comfortably fits standard mobile PWA quotas.
- **URL Matching:** Workbox passes `{ url: URL }` to the route matcher callback. By importing `isAllowedImageUrl` from `@hestia/shared`, the route matcher becomes:
  ```typescript
  import { isAllowedImageUrl } from '@hestia/shared';
  
  registerRoute(
    ({ url }) => isAllowedImageUrl(url),
    new CacheFirst({
      cacheName: 'deal-images',
      plugins: [
        new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }) as CachePlugin,
        new CacheableResponsePlugin({ statuses: [0, 200] }) as CachePlugin,
      ],
    }),
  );
  ```

### 3. Centralized Validation in `@hestia/shared`
A new module `packages/shared/src/images.ts` will provide the single source of truth.
**Implementation details:**
```typescript
/**
 * Allowed remote image CDN domains for circulars, deals, store logos, and food products.
 * Must match Content-Security-Policy img-src in docker/Caddyfile.
 */
export const ALLOWED_IMAGE_DOMAINS = [
  'flipp.com',
  'wishabi.com',
  'wishabi.net',
  'openfoodfacts.org',
] as const;

export type AllowedImageDomain = (typeof ALLOWED_IMAGE_DOMAINS)[number];

/**
 * Validates whether a candidate image URL is an allowed remote HTTPS CDN image.
 *
 * Enforces:
 * 1. Valid URL string or URL instance
 * 2. Strict HTTPS protocol (prevents HTTP downgrade and insecure mixed content)
 * 3. Exact domain match or dot-prefixed subdomain match against ALLOWED_IMAGE_DOMAINS
 *
 * Prevents domain injection bypasses such as `attacker-flipp.com` or `flipp.com.attacker.com`.
 */
export function isAllowedImageUrl(url: string | URL | null | undefined): boolean {
  if (url === null || url === undefined || url === '') return false;
  try {
    const parsed = typeof url === 'string' ? new URL(url) : url;
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_IMAGE_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
```
**Export in `packages/shared/src/index.ts`:**
Per the monorepo convention (where relative imports within `packages/shared/src/` use `.js` extension):
```typescript
export * from './images.js';
```
[VERIFIED: packages/shared/src/index.ts:1-22]

**Security Analysis of Domain Matching:**
- `hostname === domain`: Matches apex domains (e.g. `openfoodfacts.org`, `flipp.com`).
- `hostname.endsWith('.' + domain)`: Matches valid subdomains (e.g. `images.openfoodfacts.org`, `f.wishabi.net`, `flipp-image-retrieval.flipp.com`).
- `attacker-flipp.com`: Fails both checks because `-flipp.com` does not start with `.`.
- `flipp.com.attacker.com`: Fails both checks because it ends with `.attacker.com`.
- `http://dam.flipp.com`: Fails `protocol === 'https:'`.
- `javascript:...` / `data:...`: Fails protocol check and URL parsing.

### 4. `DealImage.tsx` Integration
In `apps/web/src/screens/deals/DealImage.tsx:11-23`, replace local origin checking:
```typescript
// Replace:
// const ALLOWED_IMAGE_ORIGINS: readonly string[] = [...]
// export function isAllowedImageUrl(url: string | null): boolean { ... }

// With:
import { isAllowedImageUrl } from '@hestia/shared';
export { isAllowedImageUrl } from '@hestia/shared';
```
The component retains its existing layout-preserving fallback behavior [VERIFIED: apps/web/src/screens/deals/DealImage.tsx:39-63]:
- Renders `<span data-testid="deal-image-placeholder" className={cn(box, 'grid place-items-center')}><ImageOff aria-hidden size={20} ... /></span>` when `url` is null, invalid, disallowed, or when network load fails (`onError`).
- Renders `<img src={url} alt="" loading="lazy" decoding="async" className={cn(box, 'object-contain')} onError={() => setHasFailed(true)} />` when allowed.
- Accessibility: `alt=""` is kept because the item title in `DealCard.tsx` already announces the item name [VERIFIED: 12-UI-SPEC.md:106].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subdomain validation | Custom regex (e.g. `/.*flipp\.com/`) | `hostname === domain \|\| hostname.endsWith('.' + domain)` | Regex often forgets to escape dots or anchor ends, allowing `attacker-flipp.com` or `flipp.com.attacker.com` |
| URL parsing | String splitting / regex | WHATWG `new URL(url)` | Handles port numbers, credentials, IPv6, trailing slashes, and normalization reliably |
| Opaque caching | Hand-rolled fetch & cache in Service Worker | Workbox `CacheFirst` + `CacheableResponsePlugin({ statuses: [0, 200] })` | Handling opaque response quotas and CacheStorage limits by hand is notoriously error-prone |
| Cache expiration | Manual timestamp tracking in IndexedDB | Workbox `ExpirationPlugin` | Manages LRU eviction and quota limits atomically |

## Common Pitfalls

### Pitfall 1: Breaking Service Worker Route Tests on Quota Change
**What goes wrong:** Updating `maxEntries: 200` in `sw.ts` causes `apps/web/src/sw.test.ts` to fail because line 141 strictly asserts `{ options: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 } }`.
**How to avoid:** Update the test expectation in `sw.test.ts` in the same commit to reflect the new `maxEntries: 200` value.

### Pitfall 2: Opaque Response Quota Exhaustion
**What goes wrong:** Browsers pad opaque responses with up to 7MB of virtual storage to prevent cross-origin size fingerprinting.
**How to avoid:** Keep `maxEntries` bounded (e.g. 100 or 200 entries max) and set `maxAgeSeconds` to 7 days so stale flyer assets are regularly evicted.

### Pitfall 3: Import Extension in `packages/shared/src/index.ts`
**What goes wrong:** Exporting with `export * from './images.ts'` fails TypeScript or ESM runtime resolution.
**How to avoid:** Follow existing convention: `export * from './images.js';` in `packages/shared/src/index.ts`.

### Pitfall 4: Missing `statuses: [0, 200]` in CacheableResponsePlugin
**What goes wrong:** Removing status 0 because "0 means network error" breaks cross-origin CDN image caching entirely.
**How to avoid:** Always retain `statuses: [0, 200]`. Cross-origin images loaded via `<img>` are opaque responses with status 0.

## Validation Architecture

### Test Infrastructure
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 [VERIFIED: packages/shared/package.json:23, apps/web/package.json:45] |
| Shared suite command | `pnpm --filter @hestia/shared test` |
| Web suite command | `pnpm --filter @hestia/web test` |
| Full test command | `pnpm test` |
| Typecheck command | `pnpm typecheck` |
| E2E test command | `pnpm test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| **IMG-01** | Caddy CSP `img-src` header permits `*.flipp.com`, `flipp-image-retrieval.flipp.com`, `*.wishabi.com`, `*.wishabi.net`, `*.openfoodfacts.org` | integration / E2E | `pnpm --filter @hestia/e2e test:e2e tests/20-ingress-client-ip-and-csp.spec.ts` | ✅ (Add assertion to existing spec) |
| **IMG-02** | Workbox route matches all allowed domains and applies CacheFirst strategy with statuses [0, 200] and 200 maxEntries | unit | `pnpm --filter @hestia/web test src/sw.test.ts` | ✅ (Update existing test file) |
| **IMG-03** | `isAllowedImageUrl` validates HTTPS Flipp & Open Food Facts URLs, rejects insecure HTTP and spoofed domains | unit | `pnpm --filter @hestia/shared test src/images.test.ts` | ❌ Wave 0 Gap (`packages/shared/src/images.test.ts`) |
| **IMG-03** | `DealImage` renders `<img>` for valid URLs and placeholder for null, invalid, or failed URLs | component | `pnpm --filter @hestia/web test src/screens/deals/DealImage.test.tsx` | ❌ Wave 0 Gap (`apps/web/src/screens/deals/DealImage.test.tsx`) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @hestia/shared test && pnpm --filter @hestia/web test`
- **Per wave merge:** `pnpm typecheck && pnpm test`
- **Phase gate:** Full suite green (`pnpm typecheck && pnpm test`) before verification

### Wave 0 Gaps
- [ ] `packages/shared/src/images.test.ts` — Comprehensive unit test suite covering `isAllowedImageUrl` and `ALLOWED_IMAGE_DOMAINS` with positive and negative attack vectors.
- [ ] `apps/web/src/screens/deals/DealImage.test.tsx` — Component test verifying `DealImage` rendering with valid URLs, fallback placeholders on null/disallowed URLs, and `onError` image load failure.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — using existing project dependencies in Workbox, React, and Vitest.
- Architecture: HIGH — single-source-of-truth in `@hestia/shared` eliminates cross-tier drift.
- Pitfalls: HIGH — verified against W3C CSP Level 3 spec, Fetch API opaque response behavior, and existing test assertions.

**Research date:** 2026-11-09  
**Valid until:** 2027-11-09 (stable web standards)  

