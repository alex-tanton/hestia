# Phase 12: Store & Deal Image Delivery - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Unblock modern Flipp image CDNs (`*.flipp.com`, `flipp-image-retrieval.flipp.com`, `*.wishabi.com`, `*.wishabi.net`) and Open Food Facts image hosts (`*.openfoodfacts.org`) across Caddy ingress CSP, PWA Service Worker caching, and React image components (`DealImage.tsx`) so store logos, flyer thumbnails, and deal product images render reliably without broken placeholders.

</domain>

<decisions>
## Implementation Decisions

### Domain Pattern Matching & Allowlist Strategy
- **D-01:** Centralize allowed image domain definitions and URL validation in `@hestia/shared` — Export `isAllowedImageUrl` and allowed domain constants so `apps/web/src/screens/deals/DealImage.tsx`, `apps/web/src/sw.ts`, and test suites share a single source of truth. — **Reversibility:** costly — touches shared package exports and web/service-worker bundler imports.
- **D-02:** Strict HTTPS and dot-subdomain suffix validation — Enforce `protocol === 'https:'` and match `hostname === domain || hostname.endsWith('.' + domain)` against `['flipp.com', 'wishabi.com', 'wishabi.net', 'openfoodfacts.org']`. This safely admits regional/subdomain CDNs while preventing attacker domain bypasses (e.g. `attacker-flipp.com`) and insecure HTTP.
- **D-03:** Scope strictly to remote HTTPS CDN domains — `isAllowedImageUrl` and service worker caching are scoped to remote HTTPS CDN domains. Internal application icons, UI assets, and local SVGs continue using standard Vite static asset imports and relative paths.
- **D-04:** Caddyfile Content-Security-Policy wildcard origins — Update `docker/Caddyfile` `img-src` directive to `img-src 'self' data: https://*.flipp.com https://flipp-image-retrieval.flipp.com https://*.wishabi.com https://*.wishabi.net https://*.openfoodfacts.org;`, aligning with CSP Level 3 and ensuring browser-level delivery is unblocked.

### Builder's Discretion
- Service Worker cache sizing (`deal-images` cache in `apps/web/src/sw.ts`): Builder may maintain the existing 100-entry / 7-day quota or moderately increase to 200 entries to handle the broader domain footprint.
- Unit and integration tests: Comprehensive unit test coverage for the matcher in `@hestia/shared`, updated `sw.test.ts` for the route matcher, and tests for `DealImage.tsx` placeholder behavior.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Phase Scope
- `.planning/ROADMAP.md` §Phase 12 — Scope, dependencies, and success criteria for Store & Deal Image Delivery
- `.planning/REQUIREMENTS.md` §Image Delivery — Requirements IMG-01, IMG-02, IMG-03
- `.planning/research/PITFALLS.md` §Pitfall 1 — Flipp CDN evolution, Caddy CSP, and Service Worker image allowlist analysis

### Implementation Files
- `docker/Caddyfile` — Ingress reverse proxy configuration and Content-Security-Policy header
- `apps/web/src/sw.ts` — Workbox Service Worker CacheFirst route and caching plugins
- `apps/web/src/screens/deals/DealImage.tsx` — Deal card and merchant logo image rendering component
- `packages/shared/src/index.ts` — Shared package root exports

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@hestia/shared`: Monorepo shared package already consumed by `apps/service` and `apps/web`; ideal location for cross-tier image validation utilities.
- `apps/web/src/screens/deals/DealImage.tsx`: Existing robust image container handling lazy loading, decoding, and fallback placeholder (`ImageOff`).
- `apps/web/src/sw.ts`: Existing Workbox setup using `CacheFirst`, `ExpirationPlugin`, and `CacheableResponsePlugin` for opaque cross-origin CDN responses.

### Established Patterns
- Shared pure TypeScript utilities in `packages/shared/src/` with high test determinism.
- Strict CSP enforcement at the Caddy ingress layer (`docker/Caddyfile`).
- Workbox routing using functional URL matchers in `registerRoute`.

### Integration Points
- `packages/shared/src/images.ts`: New module defining allowed CDN hostnames and URL validator, re-exported in `packages/shared/src/index.ts`.
- `docker/Caddyfile`: Line 14 `Content-Security-Policy` header `img-src` directive.
- `apps/web/src/sw.ts`: Line 73 `registerRoute` matcher for image caching.
- `apps/web/src/screens/deals/DealImage.tsx`: `isAllowedImageUrl` call site.
- `apps/web/src/sw.test.ts`: Service worker test verifying image URL routing.

</code_context>

<specifics>
## Specific Ideas

- Permitted external CDNs:
  - Flipp items & flyers: `flipp.com`, `flipp-image-retrieval.flipp.com`, `wishabi.com`, `wishabi.net`
  - Open Food Facts items: `openfoodfacts.org` (e.g., `images.openfoodfacts.org`)
- Keep `DealImage` decorative (`alt=""`) per current implementation to avoid duplicating screen-reader announcements when item names sit alongside.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-Store & Deal Image Delivery*
*Context gathered: 2026-11-08*

