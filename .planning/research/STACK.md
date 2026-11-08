# Stack Research

**Domain:** Grocery Deals, Barcode Scanning & Kitchen Management PWA
**Researched:** 2026-11-08
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Browser `BarcodeDetector` API | Native (W3C standard) | Hardware-accelerated barcode scanning | Standard web API with zero bundle cost, direct GPU/camera stream decoding on supported browsers (Android Chrome, modern Safari/iOS PWA). |
| `barcode-detector` (WASM / ZXing) | ^2.3.0 | Cross-browser `BarcodeDetector` polyfill | Drop-in polyfill using WebAssembly ZXing engine when native `window.BarcodeDetector` is unavailable (Firefox, desktop web, older webviews). |
| Open Food Facts API v3 | REST v3 (`world.openfoodfacts.org`) | Barcode UPC/EAN product metadata lookup | Free, open-source global food database with over 3M products; official v3 JSON endpoint with field filtering and reliable product identification. |
| Fastify HTTP client (`undici` / native `fetch`) | Fastify 5.x / Node 24 | Service-side proxy and cache for Open Food Facts & Flipp | Safe server-side API proxy with proper custom `User-Agent` headers and caching to prevent client rate limiting and protect API keys/endpoints. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React (`lucide-react`) | 1.x (installed) | Barcode, camera, scanner, discount, and meal icons | UI affordances in scanner sheets, deal cards, and meal planner entry dialogs. |
| Zod (`zod`) | 3.x (installed in `@hestia/shared`) | Schema validation for barcode lookups, non-recipe meal plans, and pricing contracts | Validates API request/response payloads across monorepo boundaries. |
| Kysely | 0.27.x (installed) | Postgres query builder for barcode cache & meal planner schema | Schema extensions and migrations for standalone meal entries and barcode product caching. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Playwright | 1.50.x (installed) | E2E testing for barcode mock input, deal pricing badges, and meal planner items | Mock camera stream via `getUserMedia` fake video or test barcode manual input. |
| Vitest | 5.0.x (installed) | Unit & integration tests for price calculation math, sale story parsing, and Open Food Facts client | Fast deterministic tests with recorded network fixtures. |

## Installation

```bash
# In apps/web (for barcode detection polyfill)
pnpm --filter @hestia/web add barcode-detector

# Node 24 native fetch is used in apps/service for Open Food Facts API
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `BarcodeDetector` + `barcode-detector` polyfill | `html5-qrcode` | When supporting very legacy browsers; however `html5-qrcode` is heavier, creates UI lock-in, and lacks native W3C standards alignment. |
| Open Food Facts API v3 | UPCItemDB / Barcode Lookup API | When proprietary commercial API keys are paid for; Open Food Facts is open, community-driven, free, and ideal for self-hosted household management. |
| Service-side Open Food Facts proxy | Direct client-side browser fetch | Direct client fetch leaks client IPs and triggers Open Food Facts rate limits / CORS / User-Agent blocking; proxy allows local SQLite/Postgres caching. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Heavy proprietary scanner SDKs (Scandit, Dynamsoft) | High monthly commercial licensing fees, proprietary blobs | Native `BarcodeDetector` + open-source WASM fallback |
| Client-side direct calls to Open Food Facts | Open Food Facts blocks requests without strict custom User-Agent, and client IP rate-limiting disrupts household members | Service-side Fastify route with cached Postgres lookup |
| Sequential 500ms loops for hundreds of flyer items | Freezes deal refreshes for 15+ minutes per postal code | Concurrent batching, roster parsing, and targeted deal fetching |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `barcode-detector@^2.3.0` | Vite 7 / React 19 / ES2022 | Polyfills `globalThis.BarcodeDetector` cleanly with web workers/WASM |
| Fastify 5.x | Node 24 | Uses native `fetch` with custom User-Agent headers |

## Sources

- [W3C Barcode Detection API Specification](https://wicg.github.io/shape-detection-api/#barcode-detection-api)
- [Open Food Facts API Documentation (v3)](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v3/)
- [Flipp CDN Architecture & Asset Host Analysis](https://backflipp.wishabi.com)

---
*Stack research for: Grocery Deals, Barcode Scanning & Kitchen Management*
*Researched: 2026-11-08*
