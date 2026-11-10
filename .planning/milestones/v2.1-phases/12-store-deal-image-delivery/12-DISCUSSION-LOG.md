# Phase 12: Store & Deal Image Delivery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-08
**Phase:** 12-Store & Deal Image Delivery
**Areas discussed:** Domain Pattern Matching

---

## Domain Pattern Matching

### Question 1: Centralizing Allowed Image Domain Matching
| Option | Description | Selected |
|--------|-------------|----------|
| Shared package (@hestia/shared) | Export an allowlist / matcher utility from @hestia/shared so apps/web and sw.ts share a single source of truth. | ✓ |
| Web-local helper (apps/web/src/lib/images.ts) | Keep the helper inside apps/web, imported by both DealImage and sw.ts without touching shared packages. | |
| You decide | Builder chooses the cleanest boundary based on build and bundling constraints. | |

**User's choice:** Shared package (@hestia/shared) — Export an allowlist / matcher utility from @hestia/shared so apps/web and sw.ts share a single source of truth.
**Notes:** Establishes single source of truth across web components, service worker, and future backend utilities if needed.

### Question 2: Pattern Matcher Validation Logic
| Option | Description | Selected |
|--------|-------------|----------|
| Strict HTTPS + dot-subdomain suffix | Require https: and match hostname === domain \|\| hostname.endsWith('.' + domain) for flipp.com, wishabi.com, wishabi.net, openfoodfacts.org. | ✓ |
| Explicit known subdomains only | Maintain an enumerated list of known hosts without allowing wildcard subdomains. | |
| You decide | Builder implements standard secure URL parsing and domain suffix checks. | |

**User's choice:** Strict HTTPS + dot-subdomain suffix — Require https: and match hostname === domain || hostname.endsWith('.' + domain) for flipp.com, wishabi.com, wishabi.net, openfoodfacts.org.
**Notes:** Prevents attacker domain suffix bypasses while flexibly supporting regional Flipp and Open Food Facts CDNs.

### Question 3: Scope of Allowed URLs
| Option | Description | Selected |
|--------|-------------|----------|
| Remote HTTPS vetted domains only | DealImage strictly handles external CDN assets (Flipp, Wishabi, Open Food Facts); app icons and local assets use standard static imports. | ✓ |
| Vetted domains plus same-origin relative paths | Also permit relative paths (/...) for potential local proxying or static asset overrides. | |
| You decide | Builder chooses based on existing asset patterns in apps/web. | |

**User's choice:** Remote HTTPS vetted domains only — DealImage strictly handles external CDN assets (Flipp, Wishabi, Open Food Facts); app icons and local assets use standard static imports.
**Notes:** Keeps separation clean between external dynamic assets and bundled Vite assets.

### Question 4: Caddyfile Content-Security-Policy Directives
| Option | Description | Selected |
|--------|-------------|----------|
| Wildcard origins | https://*.flipp.com https://flipp-image-retrieval.flipp.com https://*.wishabi.com https://*.wishabi.net https://*.openfoodfacts.org — Aligns with CSP Level 3 and prevents breakage when Flipp or Open Food Facts routes to regional CDN subdomains. | ✓ |
| Pinned hostnames only | Enumerate explicit known hosts without wildcards (e.g. f.wishabi.net, images.wishabi.net, flipp-image-retrieval.flipp.com, images.openfoodfacts.org). | |
| You decide | Builder chooses the cleanest syntax conforming to Caddy and browser CSP standards. | |

**User's choice:** Wildcard origins (https://*.flipp.com https://flipp-image-retrieval.flipp.com https://*.wishabi.com https://*.wishabi.net https://*.openfoodfacts.org)
**Notes:** Mirrors the domain pattern matching in Caddy's CSP headers so browsers do not reject requests.

---

## the agent's Discretion

- Service Worker cache sizing and maxAge in `apps/web/src/sw.ts`.
- Exact test structure and suite organization for `DealImage.tsx` and the shared image matcher.

## Deferred Ideas

None — discussion stayed within phase scope.

