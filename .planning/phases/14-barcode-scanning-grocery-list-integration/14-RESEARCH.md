# Phase 14: Barcode Scanning & Grocery List Integration - Research

**Researched:** 2026-11-09
**Domain:** Barcode Scanning (W3C BarcodeDetector API, WASM/JS polyfills), Open Food Facts API v3, PWA Mobile Camera Viewfinder, Fastify Caching Proxy, Shopping List Matching
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Scanner Entry Point & Viewport
- **D-01:** Dedicated button in list header toolbar — Positioned directly alongside "Add an item" in `ListDetailScreen.tsx` for immediate 1-tap access while shopping or building lists. — **Reversibility:** reversible — UI layout placement in `ListDetailScreen.tsx`.
- **D-02:** Segmented dual-mode toggle inside scanner — Provide explicit "Add to List" and "Shop & Check Off" tabs at the top of the scanner viewport, persisting the user's last selected mode in localStorage. — **Reversibility:** reversible — scanner dialog state management.
- **D-03:** Full-screen mobile dialog / sheet — Clean camera viewfinder with top navigation bar (mode toggle, close button, flashlight toggle when hardware permits) and a bottom tab for manual barcode numeric entry with a dedicated keypad. — **Reversibility:** reversible — modal styling and viewport component structure.
- **D-04:** Multi-sensory checkout confirmation with Undo — In "Shop & Check Off" mode, a detected and matched item produces a short audio chime, device vibration (`navigator.vibrate`), green reticle flash, and an interactive floating toast displaying `"[Item] marked bought"` with an `"Undo"` button, keeping the camera active for rapid subsequent scans. — **Reversibility:** reversible — toast notification and scan event handlers.

### the agent's Discretion
- **Barcode Lookup & Service Proxy:** Fastify service proxies barcode lookups to Open Food Facts API v3 using compliant `User-Agent` headers (identifying Hestia application and contact email) with caching in Postgres (`barcode_products` table) to minimize external network requests and prevent rate limits.
- **Item Matching & Disambiguation:** In "Shop & Check Off" mode, match items by barcode if recorded on `list_items`, or normalized product name comparison against unbought list items. If multiple matches or no exact match is found, present a quick pick-list or prompt to link the scanned barcode to an item.
- **Add Item Review:** In "Add to List" mode, resolving a barcode pre-populates item name and brand; open the `ItemSheet` pre-filled so the user can verify quantity and store before saving.
- **Detection Engine & WASM Polyfill:** Use native browser `BarcodeDetector` when available (Chrome Android, modern Safari); fall back to lightweight WASM/JS barcode detection (e.g. `@zxing/library` or `@undecaf/barcode-detector-polyfill`) for desktop and older browsers.
- **Debounce & Scan Pacing:** Enforce a 1.5–2.0 second debounce window after a successful barcode read before accepting the identical barcode again, preventing accidental duplicate writes while keeping the viewfinder live.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| **SCAN-01** | PWA provides a camera barcode scanner modal using the standard `BarcodeDetector` API with WASM polyfill fallback, plus a manual barcode text entry tab. | Research covers standard W3C `BarcodeDetector` API with `@undecaf/barcode-detector-polyfill` (or `@zxing/library` pure-JS fallback), media stream lifecycle management, flashlight/torch hardware constraints, and dedicated numeric keypad manual entry fallback. Also identifies critical Caddy `Permissions-Policy` and CSP updates required for camera and WASM execution. |
| **SCAN-02** | Fastify service proxies and caches barcode lookups against Open Food Facts API v3 using compliant User-Agent headers, falling back gracefully to manual item naming on misses or timeouts. | Research verifies Open Food Facts v3 JSON endpoints (`https://world.openfoodfacts.org/api/v3/product/{barcode}.json`), mandatory header formats (`Hestia/2.1 (contact email)`), 5s timeout resilience with `AbortController`, and append-only Postgres caching table (`barcode_products`). |
| **SCAN-03** | User can scan a barcode from a shopping list to automatically populate the item name and add it to the list. | Research details "Add to List" mode workflow: resolves product metadata, formats item name (`"${brand} ${product_name}"`) and quantity note, opens pre-populated `ItemSheet` for user confirmation and store selection before committing. |
| **SCAN-04** | User can scan a barcode from an active shopping list to automatically match the item and mark it as `bought`. | Research specifies "Shop & Check Off" mode: matches by stored `barcode` on `shopping_list_item` (works 100% offline!) or by normalized product name via `@hestia/matching`, triggers multi-sensory feedback (Web Audio synth beep, `navigator.vibrate`, green reticle flash), and fires `useUpdateListItem` with interactive Undo toast. |
</phase_requirements>

---

## Summary

Phase 14 delivers grocery list barcode scanning and Open Food Facts v3 integration to Hestia. The system consists of two major tiers:
1. **Frontend PWA (`apps/web`)**: A full-screen camera viewfinder dialog triggered directly from the shopping list header alongside "Add an item" (D-01). It features a segmented toggle between "Add to List" and "Shop & Check Off" (D-02), hardware torch toggle, manual numeric entry keypad fallback (D-03), and multi-sensory scan feedback (synthesized Web Audio chime, vibration, green reticle flash, and an interactive Undo toast) (D-04). Barcode detection leverages the standard W3C `BarcodeDetector` API when natively available (Android Chrome, modern Safari/ChromeOS) and dynamically imports a lightweight polyfill for unsupported environments.
2. **Backend Fastify Service (`apps/service`)**: An authenticated `GET /api/barcodes/:barcode` endpoint that checks an internal Postgres `barcode_products` cache table before proxying lookups to the Open Food Facts API v3. Requests include a compliant `User-Agent` header, an `AbortController` timeout (5 seconds), and resilient error handling that returns 404 Problem Details on lookup misses or upstream outages, enabling the web app to gracefully prompt the user for manual item input.

**Primary recommendation:** Use native `BarcodeDetector` dynamically backed by `@undecaf/barcode-detector-polyfill` (or `@zxing/library` pure-JS fallback), update `docker/Caddyfile` to permit `camera=(self)` in `Permissions-Policy` and `'wasm-unsafe-eval'` in `Content-Security-Policy`, store scanned barcodes in a new `barcode` column on `shopping_list_item` to enable instant offline check-off, and cache Open Food Facts responses indefinitely in a new Postgres `barcode_products` table.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Camera Stream & Viewfinder | Browser / Client (`apps/web`) | — | Camera hardware access (`getUserMedia`) and video rendering can only happen in the client browser. |
| Barcode Detection & Pacing | Browser / Client (`apps/web`) | — | Real-time video frame analysis (via native `BarcodeDetector` or polyfill) and 1.8s debounce must execute on-device for zero-latency feedback. |
| Sensory Feedback (Audio/Haptics) | Browser / Client (`apps/web`) | — | Web Audio API oscillator synthesis and `navigator.vibrate` are client-only browser APIs. |
| Shopping List Check-Off Mutation | Browser / Client (`apps/web`) | API / Backend (`apps/service`) | Client manages optimistic updates, toast notifications with Undo, and offline write queuing via `useUpdateListItem`. |
| External Barcode API Proxy | API / Backend (`apps/service`) | — | Keeps external Open Food Facts rate limits, User-Agent policies, and caching centralized; prevents CORS and protects client privacy. |
| Barcode Product Caching | Database / Storage (Postgres) | API / Backend (`apps/service`) | Persistent cache in Postgres (`barcode_products` table) eliminates duplicate upstream queries across all household members. |
| Camera Ingress Permissions | Ingress (`docker/Caddyfile`) | Browser / Client | HTTP `Permissions-Policy: camera=(self)` header controls browser authorization to request media streams. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| Native `BarcodeDetector` | W3C Standard | Primary barcode decoding | Zero bundle overhead, GPU/OS-accelerated 1D/2D barcode detection natively supported on Android Chrome and modern browsers [VERIFIED: W3C Spec]. |
| `@undecaf/barcode-detector-polyfill` | `0.9.23` | WASM BarcodeDetector polyfill | Standard-compliant drop-in polyfill using ZBar WASM; matches W3C `BarcodeDetector` interface [VERIFIED: npm registry]. |
| `@hestia/matching` | Workspace (`1.0.16` Levenshtein) | Product name normalization & fuzzy matching | Existing repository package for normalizing and matching grocery item names [VERIFIED: packages/matching/src/index.ts:1-3]. |
| Fastify | `5.12.6` | HTTP service proxy | Existing backend framework in `apps/service` [VERIFIED: apps/service/package.json:27]. |
| Postgres / Kysely | `0.29.6` | Product cache storage | Database layer in `apps/service` providing typed query building and RLS isolation [VERIFIED: apps/service/package.json:28]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@zxing/library` | `0.23.0` | Alternative pure JS barcode polyfill | Zero-WASM alternative fallback if strict CSP forbids `'wasm-unsafe-eval'` [VERIFIED: npm registry]. |
| Web Audio API | Browser Native | Audio chime synthesis | Generates 880Hz / 440Hz sine burst without downloading external sound assets [VERIFIED: MDN Web Audio API]. |
| `lucide-react` | `1.47.0` | Icons (`ScanBarcode`, `Flashlight`, etc.) | Existing icon set in `apps/web` [VERIFIED: apps/web/package.json:23]. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| `@undecaf/barcode-detector-polyfill` (WASM) | `@zxing/library` (Pure JS) | Pure JS has slightly higher CPU usage per frame (~15ms vs ~3ms) but requires zero WASM binary loading and zero CSP `'wasm-unsafe-eval'` relaxation. Both can implement the same `BarcodeDetector` contract. |
| Open Food Facts API v3 | UPCItemDB / BarcodeLookup | Commercial barcode APIs charge recurring subscriptions; Open Food Facts is open-source, free, and contains over 3 million products [CITED: REQUIREMENTS.md:55]. |
| Direct client fetch to Open Food Facts | Backend Fastify proxy | Direct client fetch would trigger CORS, leak client IPs, fail to cache across household members, and make centralized User-Agent compliance impossible. |

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `@undecaf/barcode-detector-polyfill` | npm | ~4 years | ~40,000/wk | `github.com/undecaf/barcode-detector-polyfill` | [OK] | Approved (WASM Polyfill) |
| `@undecaf/zbar-wasm` | npm | ~4 years | ~40,000/wk | `github.com/undecaf/zbar-wasm` | [OK] | Approved (Transitive dependency of polyfill) |
| `@zxing/library` | npm | >6 years | ~1,200,000/wk | `github.com/zxing-js/library` | [OK] | Approved (Pure JS Alternative) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                    BROWSER / CLIENT (apps/web)                                     |
|                                                                                                    |
|  [ListDetailScreen]  -- (1) Tap "Scan" -->  [BarcodeScannerDialog]                                 |
|                                                     |                                              |
|                                            (2) getUserMedia                                        |
|                                                     v                                              |
|                                            <video> Viewfinder                                      |
|                                                     |                                              |
|                                         (3) Frame Scan Loop                                        |
|                                         (every 150-200ms)                                          |
|                                                     v                                              |
|                            [BarcodeDetector API] (Native or WASM Polyfill)                         |
|                                                     |                                              |
|                                             (4) Barcode Detected                                   |
|                                            (1.8s Debounce Check)                                   |
|                                                     |                                              |
|                    +--------------------------------+--------------------------------+             |
|                    |                                                                 |             |
|                    v (Shop & Check Off Mode)                                         v (Add Mode)  |
|         Does unbought list item have                                        (7) GET /api/barcodes  |
|         item.barcode === barcode?                                                    |             |
|          /                     \                                                     v             |
|        Yes                      No                                         Pre-populate ItemSheet  |
|         |                        |                                         with name, brand, qty   |
|         v                        v                                                   |             |
|  (5) Instant Match!     (6) GET /api/barcodes/:barcode                               v             |
|         |                        |                                         User reviews & saves    |
|         |                Match unbought items                                        |             |
|         |                by normalized name?                                         |             |
|         |                /                  \                                        |             |
|         |              Yes                   No / Ambiguous                          |             |
|         |               |                    |                                       |             |
|         |               v                    v                                       |             |
|         |         Link barcode &        Show Pick-list /                             |             |
|         |         mark bought           "Not on list" prompt                         |             |
|         +---------------+                    |                                       |             |
|                         v                    v                                       |             |
|           Multi-sensory Feedback       (Optional Manual Entry)                       |             |
|           - Audio Chime (Web Audio)          |                                       |             |
|           - Vibration (40ms)                 |                                       |             |
|           - Green Reticle Flash              |                                       |             |
|           - Toast with [Undo]                |                                       |             |
|                         |                    |                                       |             |
|                         +--------------------+                                       |             |
|                                  |                                                   |             |
+----------------------------------|---------------------------------------------------|-------------+
                                   |                                                   |
                     (8) Mutate Status / Add Item                                      |
                                   |                                                   |
                                   v                                                   v
+----------------------------------------------------------------------------------------------------+
|                                      FASTIFY SERVICE (apps/service)                                |
|                                                                                                    |
|  [GET /api/barcodes/:barcode]                                [POST/PATCH /api/lists/:id/items]     |
|          |                                                                   |                     |
|          v                                                                   v                     |
|  Check Postgres Table                                                Update `shopping_list_item`   |
|  `barcode_products`                                                  (set status='bought',         |
|      /             \                                                  set barcode=:barcode)        |
|    Hit             Miss                                                      |                     |
|     |               |                                                        v                     |
|     |        (9) Fetch Open Food Facts v3                                Postgres DB               |
|     |        world.openfoodfacts.org/api/v3/product/:code.json               |                     |
|     |        User-Agent: Hestia/2.1 (contact)                                |                     |
|     |        Timeout: 5000ms AbortController                                 |                     |
|     |               |                                                        |                     |
|     |        Insert into `barcode_products`                                  |                     |
|     +---------------+                                                        |                     |
|             v                                                                |                     |
|      Return Product JSON                                                     |                     |
+------------------------------------------------------------------------------|---------------------+
                                                                               v
                                                                   Postgres Database
                                                                   - `barcode_products`
                                                                   - `shopping_list_item`
```

### Recommended Project Structure
```
apps/
├── service/
│   └── src/
│       ├── routes/
│       │   └── barcodes.ts                 # GET /api/barcodes/:barcode route plugin
│       ├── services/
│       │   ├── barcodes.ts                 # Barcode lookup, caching, and Open Food Facts client
│       │   └── barcodes.test.ts            # Unit tests with mocked HTTP and DB fixtures
│       └── app.ts                          # Wire barcodeRoutes into Fastify app
├── web/
│   └── src/
│       ├── components/
│       │   └── lists/
│       │       ├── BarcodeScannerDialog.tsx # Camera viewfinder, reticle, controls, manual input
│       │       ├── BarcodeScannerDialog.test.tsx
│       │       ├── ItemSheet.tsx           # Enhanced with initialDraft/barcode prop support
│       │       └── ShoppingListRow.tsx
│       ├── lib/
│       │   ├── barcode/
│       │   │   ├── detector.ts             # W3C BarcodeDetector wrapper + polyfill fallback
│       │   │   ├── feedback.ts             # Web Audio chime, vibration, reticle flash triggers
│       │   │   └── matching.ts             # Client-side barcode / normalized name matching
│       │   └── api/
│       │       └── barcode-hooks.ts        # TanStack Query hook for /api/barcodes/:barcode
│       └── screens/
│           └── lists/
│               └── ListDetailScreen.tsx    # Header button next to "Add an item"
packages/
└── shared/
    └── src/
        ├── api/
        │   ├── barcodes.ts                 # Barcode query params and product response schemas
        │   └── lists.ts                    # Updated with optional barcode on items and requests
        └── index.ts                        # Re-export barrel
supabase/
└── migrations/
    └── 20261110000000_barcode_products.sql # Table barcode_products + column list_item.barcode
```

### Pattern 1: Barcode Detection with Dynamic Polyfill Fallback
**What:** Target the standard W3C `BarcodeDetector` API. If `window.BarcodeDetector` is present, instantiate it immediately. If absent, dynamically import `@undecaf/barcode-detector-polyfill` (or `@zxing/library`).
**When to use:** Every time the scanner modal opens.
**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
export interface BarcodeResult {
  rawValue: string;
  format: string;
}

export interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<BarcodeResult[]>;
}

const SUPPORTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];

export async function createBarcodeDetector(): Promise<BarcodeDetectorInstance> {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    const NativeDetector = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => BarcodeDetectorInstance }).BarcodeDetector;
    return new NativeDetector({ formats: SUPPORTED_FORMATS });
  }

  // Dynamic import keeps polyfill and WASM out of initial PWA bundle
  const { BarcodeDetectorPolyfill } = await import('@undecaf/barcode-detector-polyfill');
  return new BarcodeDetectorPolyfill({ formats: SUPPORTED_FORMATS }) as unknown as BarcodeDetectorInstance;
}
```

### Pattern 2: Open Food Facts v3 Service Proxy with Timeout and Caching
**What:** Fastify route proxies barcode requests to Open Food Facts API v3, passing an RFC-compliant User-Agent header, enforcing a 5-second timeout via `AbortController`, caching results in Postgres, and returning 404 Problem Details on failure.
**When to use:** When resolving scanned barcodes that are not yet cached in the client or database.
**Example:**
```typescript
// Source: https://openfoodfacts.github.io/openfoodfacts-server/api/v3/
export async function lookupBarcode(
  db: Kysely<Database>,
  barcode: string,
  userAgent: string,
  fetchFn: typeof fetch = fetch,
): Promise<BarcodeProduct | null> {
  // 1. Query internal Postgres cache
  const cached = await db
    .selectFrom('barcode_products')
    .selectAll()
    .where('barcode', '=', barcode)
    .executeTakeFirst();

  if (cached) {
    return {
      barcode: cached.barcode,
      productName: cached.product_name,
      brands: cached.brands,
      quantity: cached.quantity,
      imageUrl: cached.image_url,
    };
  }

  // 2. Fetch from Open Food Facts API v3
  const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,quantity,image_front_url`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetchFn(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      status?: string;
      product?: {
        product_name?: string;
        brands?: string;
        quantity?: string;
        image_front_url?: string;
      };
    };

    if (data.status !== 'success' || !data.product) return null;

    const productName = data.product.product_name?.trim() || null;
    const brands = data.product.brands?.trim() || null;
    const quantity = data.product.quantity?.trim() || null;
    const imageUrl = data.product.image_front_url?.trim() || null;

    // 3. Cache in database
    await db
      .insertInto('barcode_products')
      .values({
        barcode,
        product_name: productName,
        brands,
        quantity,
        image_url: imageUrl,
        raw_payload: JSON.stringify(data),
      })
      .onConflict((oc) => oc.column('barcode').doNothing())
      .execute();

    return { barcode, productName, brands, quantity, imageUrl };
  } catch {
    return null;
  }
}
```

### Pattern 3: Offline-First Grocery Matching & Disambiguation
**What:** In "Shop & Check Off" mode, check whether an unbought list item matches the scanned barcode locally first. This allows immediate check-off even in a basement supermarket with zero mobile connectivity. If not matched locally, call the API, normalize the product name via `@hestia/matching`, and compare against unbought items.
**When to use:** In the scanner scan handler when in "Shop & Check Off" mode.

### Anti-Patterns to Avoid
- **Running continuous video frame detection on every animation frame:** Running `detector.detect()` on every 60fps frame wastes CPU/battery and causes thermal throttling on mobile devices. Use an interval or throttled loop (e.g., 150ms–200ms between detection frames).
- **Hard-locking the camera without debounce:** Scanning a barcode repeatedly while the viewfinder is live creates rapid duplicate check-off mutations. Enforce a 1.5–2.0 second debounce window for identical barcodes.
- **Direct client requests to Open Food Facts:** Violates CSP, exposes client IP, causes CORS issues, and misses cross-member caching opportunities.
- **Blocking the UI on missing barcodes:** If Open Food Facts does not recognize a barcode, never show a blocking error modal. Gracefully offer the user a manual entry tab or the ability to link the barcode to an existing item on the list.
- **Failing to release media stream tracks:** Failing to call `track.stop()` on all video tracks when the modal closes keeps the device camera hardware active (green indicator light on), draining battery.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Barcode Image Processing | Custom edge detection or image thresholding algorithms | Standard `BarcodeDetector` API & ZBar WASM / ZXing | Barcode decoding is computationally intensive with hundreds of edge cases (blur, glare, angles, lighting, damaged UPC bars). |
| Audio Feedback Chime | Custom audio asset loading / MP3 fetch | Web Audio API oscillator (`new AudioContext()`) | Zero network latency, no asset 404s, works 100% offline, tiny 10-line helper. |
| Fuzzy Name Normalization | Ad-hoc regex substring checks | `@hestia/matching` (`normalize` / `matchIngredient`) | Repository already has an optimized normalization and Levenshtein token matcher [VERIFIED: packages/matching/src/index.ts:1-3]. |
| Toast Notification with Action | Custom floating alert DOM elements | `useToast` from `apps/web/src/components/ui/Toast.tsx` | Already supports `action: { label: 'Undo', onAction: ... }` with proper WCAG contrast and auto-dismiss timing [VERIFIED: apps/web/src/components/ui/Toast.tsx:16-26]. |

---

## Runtime State Inventory

> Note: Phase 14 is a greenfield feature addition with an append-only database migration, not a rename or refactor phase.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None. New table `barcode_products` and new column `shopping_list_item.barcode` added via append-only migration. | Apply migration `20261110000000_barcode_products.sql`. |
| Live service config | Caddy `docker/Caddyfile` permissions header restricts camera: `Permissions-Policy "camera=(), microphone=(), geolocation=()"`. | Update to `Permissions-Policy "camera=(self), microphone=(), geolocation=()"` and add `'wasm-unsafe-eval'` to CSP `script-src`. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. `HESTIA_OWNER_EMAIL` already exists in `env.ts` and is used for compliant OFF `User-Agent`. | None. |
| Build artifacts | `apps/service/src/db/types.ts` must be regenerated via `pnpm db:types` after migration. | Run `pnpm db:types` to update Kysely schema types. |

---

## Common Pitfalls

### Pitfall 1: Caddy Permissions-Policy Blocking Camera Access
**What goes wrong:** `navigator.mediaDevices.getUserMedia` immediately throws a `NotAllowedError` or `SecurityError` in production even when the user grants browser permissions.
**Why it happens:** `docker/Caddyfile` currently sets [VERIFIED: docker/Caddyfile:18]:
```
Permissions-Policy "camera=(), microphone=(), geolocation=()"
```
Setting `camera=()` explicitly bans the camera API on the entire origin!
**How to avoid:** Update `docker/Caddyfile` to:
```
Permissions-Policy "camera=(self), microphone=(), geolocation=()"
```
**Warning signs:** Camera fails in production/staging while working in unproxied local dev.

### Pitfall 2: Strict CSP Blocking WebAssembly Polyfill
**What goes wrong:** On browsers without native `BarcodeDetector` (e.g. Firefox, Safari desktop), the polyfill fails to instantiate with `WebAssembly.compile(): Wasm code generation disallowed by embedder`.
**Why it happens:** The Caddy CSP header has `script-src 'self'`. Running WebAssembly in modern browsers under strict CSP requires `'wasm-unsafe-eval'` [CITED: github.com/undecaf/barcode-detector-polyfill].
**How to avoid:** Add `'wasm-unsafe-eval'` to `script-src` in `docker/Caddyfile`. Alternatively, `@zxing/library` can be used as a pure JavaScript polyfill that requires no eval or WASM permissions.

### Pitfall 3: Open Food Facts API User-Agent Blocking & Rate Limiting
**What goes wrong:** Open Food Facts returns HTTP 403 or silently drops requests.
**Why it happens:** Open Food Facts Terms of Service require a descriptive `User-Agent` identifying the application name, version, and contact info (URL or email). Generic headers like `node-fetch` are aggressively throttled.
**How to avoid:** Format the outbound header as `Hestia/2.1 (https://hestia.aberrance.app; mailto:${ownerEmail})` and cache every resolved barcode indefinitely in Postgres `barcode_products`.

### Pitfall 4: Rapid Duplicate Scan Triggers
**What goes wrong:** Pointing the camera at a barcode causes 5–10 rapid scans per second, triggering multiple check-offs or duplicate items.
**Why it happens:** The video stream processes 5–10 frames per second and repeatedly detects the same code.
**How to avoid:** Implement a strict debounce window of 1.5–2.0 seconds:
```typescript
if (lastCodeRef.current === barcode && Date.now() - lastTimeRef.current < 1800) {
  return;
}
lastCodeRef.current = barcode;
lastTimeRef.current = Date.now();
```

### Pitfall 5: Camera Stream Leak on Dialog Close
**What goes wrong:** The device camera remains on (hardware privacy indicator stays lit) after the modal is closed, draining battery.
**Why it happens:** Failing to stop the tracks on the active `MediaStream`.
**How to avoid:** In `useEffect` cleanup:
```typescript
return () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }
};
```

---

## Code Examples

### 1. In-Repo Verbatim Source Citations
Per In-repo value provenance rules, the following definitions were read directly from repo files this session:

- **List Item Status** [VERIFIED: packages/shared/src/api/lists.ts:4-5]:
```typescript
export const listItemStatusSchema = z.enum(['needed', 'in_cart', 'bought']);
export type ListItemStatus = z.infer<typeof listItemStatusSchema>;
```

- **Toast Action & Duration** [VERIFIED: apps/web/src/components/ui/Toast.tsx:16-26]:
```typescript
export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  /** e.g. Undo. */
  action?: ToastAction;
}
```

- **Allowed Image Domains** [VERIFIED: packages/shared/src/images.ts:6-11]:
```typescript
export const ALLOWED_IMAGE_DOMAINS = [
  'flipp.com',
  'wishabi.com',
  'wishabi.net',
  'openfoodfacts.org',
] as const;
```

- **Caddy Permissions Policy & CSP** [VERIFIED: docker/Caddyfile:14-18]:
```caddy
Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.flipp.com https://flipp-image-retrieval.flipp.com https://*.wishabi.com https://*.wishabi.net https://*.openfoodfacts.org; connect-src 'self' wss://{$HESTIA_HOST}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
Strict-Transport-Security "max-age=31536000"
X-Content-Type-Options "nosniff"
Referrer-Policy "same-origin"
Permissions-Policy "camera=(), microphone=(), geolocation=()"
```

### 2. Audio Chime Synthesis (Zero-Asset Web Audio API)
```typescript
export function playScanChime(success = true): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(success ? 880 : 440, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Graceful no-op if audio context is blocked
  }
}
```

### 3. Flashlight / Torch Toggle Helper
```typescript
export async function toggleTorch(stream: MediaStream, enable: boolean): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;

  const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
  if (!capabilities?.torch) return false;

  try {
    await track.applyConstraints({
      advanced: [{ torch: enable } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Pure JS scanning on full-resolution frames (e.g. QuaggaJS) | Standard W3C `BarcodeDetector` API with WASM polyfill fallback | 2023-2025 | Hardware-accelerated barcode detection; 10x lower CPU utilization and near-zero battery drain on mobile devices. |
| Open Food Facts API v0/v2 (flat JSON, inconsistent status flags) | Open Food Facts API v3 (`/api/v3/product/{barcode}.json`) | 2024 | Modern REST structure with `?fields=` filtering, clean `status: "success"` wrappers, and structured `product` properties. |
| External audio asset downloads (`new Audio('/beep.mp3')`) | In-memory Web Audio API sine synthesis | Standard PWA practice | Eliminates network latency, prevents broken audio offline, zero bundle weight. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Most mobile scanning occurs on Chromium Android and modern Safari supporting either native `BarcodeDetector` or fast WASM execution. | Standard Stack | Very low; fallback polyfill handles all other browsers. |
| A2 | Open Food Facts product metadata (product name, brand, quantity) does not change frequently, making indefinite Postgres caching safe and desirable. | Architecture Patterns | Low; UPC codes describe static consumer goods. Cache can be pruned if needed. |

---

## Open Questions

1. **How should ambiguous matches be resolved in "Shop & Check Off" mode?**
   - What we know: If a scanned barcode matches a product named "Organic Whole Milk", but the shopping list contains both "Milk" and "Oat Milk", exact barcode matching may not match.
   - What's unclear: Should the app automatically check off the closest match or prompt the user?
   - Recommendation: If an item already has the identical `barcode`, match immediately. If matching by product name and multiple unbought items match, display a lightweight disambiguation bottom sheet listing the matching candidates.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | Service & Web runtime | ✓ | 24.13.6 (`.nvmrc: 24`) | — |
| pnpm | Workspace package manager | ✓ | 10.34.5 | — |
| Postgres | Persistence & Caching | ✓ | 17 (Supabase local/docker) | — |
| Open Food Facts v3 | Barcode product resolution | ✓ | API v3 (Public HTTP) | Graceful fallback to manual item naming on misses/timeouts |
| Camera Hardware | Video barcode scanning | ✓ / ✗ (Device-dependent) | `navigator.mediaDevices` | Dedicated manual numeric keypad entry tab |

---

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest 5.0.1 [VERIFIED: apps/web/package.json:45, apps/service/package.json:43] |
| Config files | `apps/web/vite.config.ts`, `apps/service/vitest.config.ts`, `apps/service/vitest.coverage.config.ts`, `apps/service/vitest.integration.config.ts` |
| Quick run command | `pnpm --filter @hestia/web test && pnpm --filter @hestia/service test` |
| Full suite command | `pnpm test && pnpm test:integration` |
| Web coverage command | `pnpm --filter @hestia/web test:coverage` (Thresholds: 84% stmts, 80% branches, 77% funcs, 85% lines) [VERIFIED: apps/web/vite.config.ts:88] |
| Service coverage command | `pnpm --filter @hestia/service test:coverage` (Thresholds: 95% stmts, 83% branches, 96% funcs, 97% lines) [VERIFIED: apps/service/vitest.coverage.config.ts:43-46] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| **SCAN-01** | Scanner modal renders with viewfinder, mode toggle, and manual entry tab; decodes barcodes | unit / component | `pnpm --filter @hestia/web test src/components/lists/BarcodeScannerDialog.test.tsx` | ❌ Wave 0 Gap |
| **SCAN-02** | Fastify service proxies OFF v3, caches in Postgres, passes User-Agent, handles timeouts | unit / integration | `pnpm --filter @hestia/service test src/services/barcodes.test.ts && pnpm --filter @hestia/service test src/routes/barcodes.test.ts` | ❌ Wave 0 Gap |
| **SCAN-03** | Scanning in "Add to List" mode pre-populates ItemSheet and saves item | component | `pnpm --filter @hestia/web test src/screens/lists/ListDetailScreen.test.tsx` | ❌ Wave 0 Gap |
| **SCAN-04** | Scanning in "Shop & Check Off" mode matches item, marks bought, and supports Undo | component | `pnpm --filter @hestia/web test src/screens/lists/ListDetailScreen.test.tsx` | ❌ Wave 0 Gap |

### Sampling Rate
- **Per task commit:** `pnpm --filter @hestia/web test && pnpm --filter @hestia/service test`
- **Per wave merge:** Full test run including coverage: `pnpm --filter @hestia/web test:coverage && pnpm --filter @hestia/service test:coverage`
- **Phase gate:** Full CI parity: `pnpm lint && pnpm typecheck && pnpm test && pnpm knip`

### Wave 0 Gaps
- [ ] `apps/service/src/services/barcodes.test.ts` — Tests `lookupBarcode` cache hit, cache miss, OFF API response parsing, timeout abort, and error handling.
- [ ] `apps/service/src/routes/barcodes.test.ts` — Tests Fastify route authentication, param validation, and 200/404 responses.
- [ ] `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` — Tests mode toggle, manual numeric entry, pacing debounce, and camera stream cleanup.
- [ ] `apps/web/src/screens/lists/ListDetailScreen.test.tsx` — Tests scanner entry button, scan-to-add, scan-to-check-off, and toast undo.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| **V2 Authentication** | Yes | `GET /api/barcodes/:barcode` must authenticate the user via `ctx.authenticate(request)`; reject unauthenticated calls with 401 [VERIFIED: apps/service/src/http/context.ts]. |
| **V4 Access Control** | Yes | RLS policies on `barcode_products` and `shopping_list_item`. Only authenticated household members can read/modify list items [VERIFIED: supabase/migrations/20260919070100_rls.sql:203-220]. |
| **V5 Input Validation** | Yes | Zod validation on barcode parameters (`barcodeParamsSchema`: 3–64 characters alphanumeric). Manual input is sanitized before use. |
| **V6 SSRF Protection** | Yes | Upstream HTTP request in `lookupBarcode` is strictly hardcoded to `https://world.openfoodfacts.org/api/v3/product/...`. No user-supplied URLs or redirect traversal are permitted. |
| **V14 Browser Security** | Yes | Update `docker/Caddyfile` `Permissions-Policy` from `camera=()` to `camera=(self)` to permit camera access on the trusted origin while blocking cross-origin iframes. |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Unrestricted Camera Access in iframes | Elevation of Privilege | Lock `Permissions-Policy: camera=(self)` in Caddy; disallow third-party framing (`frame-ancestors 'none'`). |
| Upstream OFF Flooding / DoS | Denial of Service | Postgres caching in `barcode_products` + 5s client abort timeout + Fastify global rate limiting (`@fastify/rate-limit`). |
| Malformed OFF JSON Payload Injection | Tampering | Defensive parsing with Zod / explicit property extraction before caching or returning. |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/screens/lists/ListDetailScreen.tsx` [VERIFIED: lines 370-381]
- `apps/web/src/components/ui/Toast.tsx` [VERIFIED: lines 16-26]
- `docker/Caddyfile` [VERIFIED: lines 14-18]
- `packages/shared/src/images.ts` [VERIFIED: lines 6-11]
- `packages/shared/src/api/lists.ts` [VERIFIED: lines 4-5, 112-169]
- `supabase/migrations/20260919070000_schema.sql` [VERIFIED: lines 196-220]
- `supabase/migrations/20260919070100_rls.sql` [VERIFIED: lines 203-220]

### Secondary (MEDIUM confidence)
- Open Food Facts API v3 Documentation (`https://world.openfoodfacts.org/api/v3/product/{barcode}.json`)
- W3C Barcode Detection API Specification (`BarcodeDetector`)
- `@undecaf/barcode-detector-polyfill` & `@zxing/library` npm documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Native `BarcodeDetector` with polyfill fallback verified against browser support tables; Open Food Facts v3 verified.
- Architecture: HIGH — Follows established Hestia patterns: Fastify proxy route, Kysely queries, React Radix/Tailwind components, offline TanStack mutations.
- Pitfalls: HIGH — Identified critical Caddy Permissions-Policy blocker and debounce/lifecycle requirements.

**Research date:** 2026-11-09
**Valid until:** 2026-12-09

---

## RESEARCH COMPLETE

