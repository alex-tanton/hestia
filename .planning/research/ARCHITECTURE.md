# Architecture Research

**Domain:** Grocery Deals, Barcode Scanning & Kitchen Management PWA
**Researched:** 2026-11-08
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 Client PWA (apps/web)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ BarcodeModal │  │ DealCard     │  │ MealPlannerScreen │  │
│  │ (Camera/WASM)│  │ (Price/Badge)│  │ (Recipe or Custom)│  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         │                 │                    │            │
├─────────┴─────────────────┴────────────────────┴────────────┤
│                 API Gateway & Ingress (Caddy)               │
│  • Content-Security-Policy: img-src *.wishabi.net,          │
│    *.wishabi.com, *.flipp.com, flipp-image-retrieval        │
├─────────────────────────────────────────────────────────────┤
│                 Fastify Service (apps/service)              │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │ Open Food Facts Client│   │ Optimized Flipp Pipeline  │  │
│  │ (v3 JSON API + Cache) │   │ (Batching & Roster Sync)  │  │
│  └──────────┬────────────┘   └─────────────┬─────────────┘  │
│             │                              │                │
├─────────────┴──────────────────────────────┴────────────────┤
│                 Postgres Database / Supabase RLS            │
│  ┌──────────────────────┐  ┌─────────────────────────────┐  │
│  │ barcode_product      │  │ meal_plan_entry             │  │
│  │ (barcode, name, etc.)│  │ (recipe_id NULLABLE, title) │  │
│  └──────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `BarcodeScannerModal` (`apps/web`) | Captures video stream from camera, runs `BarcodeDetector` (or WASM fallback), emits scanned barcode strings, provides manual text entry. | React component with `<video>` element, `navigator.mediaDevices.getUserMedia`, and `barcode-detector`. |
| `OpenFoodFactsService` (`apps/service`) | Resolves barcodes against Open Food Facts API v3 with correct User-Agent, caches results in Postgres table. | Fastify route `GET /api/barcodes/:barcode` with service-role cached lookup. |
| `DealPricingEngine` (`packages/shared` / `apps/service`) | Calculates regular price, unit price, and discount percent from deal data and sale story text. | Deterministic parsing function `computeDealDiscount()` returning `{ salePriceCents, originalPriceCents, percentOff }`. |
| `DealSyncService` (`apps/service`) | Fetches and stores flyers and deals efficiently without stalling the service for 15+ minutes. | Batched/concurrent detail queue or roster-based price extraction with smart priority. |
| `MealPlanController` (`apps/service`) | Handles both recipe-based and custom-item meal planning entries. | Updates `meal_plan_entry` table schema to support `recipe_id NULL` with `custom_title`. |

## Recommended Project Structure

```
apps/web/src/
├── components/
│   ├── barcode/
│   │   ├── BarcodeScannerModal.tsx   # Camera viewfinder & scan loop
│   │   ├── BarcodeManualInput.tsx    # Fallback numeric input
│   │   └── useBarcodeScanner.ts      # Stream & detector hook
│   └── meals/
│       └── PlaceCustomItemSheet.tsx  # Add custom food item (banana, yogurt)
├── screens/
│   ├── deals/
│   │   ├── DealCard.tsx              # Primary sale price, % off, strikethrough original
│   │   └── DealImage.tsx             # Expanded image origin allowlist
│   └── lists/
│       └── ListDetailScreen.tsx      # Barcode scan action in header & item checkoff

apps/service/src/
├── barcodes/
│   ├── open-food-facts.ts            # OFF v3 client with proper User-Agent
│   └── barcode-service.ts            # Cached resolution service
├── deals/
│   └── flipp/
│       └── request-queue.ts          # Optimized concurrency & latency
└── services/
    └── meals/
        └── meal-plan.ts              # Custom item meal persistence

packages/shared/src/
├── api/
│   ├── barcodes.ts                   # Barcode API request/response schemas
│   ├── deals.ts                      # Updated deal pricing models
│   └── meal-plan.ts                  # Optional recipeId + customTitle schema
└── pricing/
    └── discount.ts                   # Pure pricing calculation functions
```

## Architectural Patterns

### Pattern 1: Service-Proxied External API with Local Cache

**What:** The client PWA never calls Open Food Facts directly; it queries `GET /api/barcodes/:barcode`.
**When to use:** For third-party APIs that require strict User-Agent headers, enforce rate limits, or return heavy JSON payloads.
**Trade-offs:** Adds an API endpoint to Hestia service, but provides instant caching across all household devices and prevents third-party blocks.

### Pattern 2: Progressive Barcode Detection (Native API → WASM Fallback → Manual Input)

**What:** Feature-detect `window.BarcodeDetector`. If available, use browser native decoder. If not, polyfill via WASM ZXing. Always expose a manual numeric barcode input.
**When to use:** PWA camera scanning where browser capabilities vary between iOS Safari PWA, Android Chrome, and desktop browsers.
**Trade-offs:** Minimal bundle size for native users while guaranteeing 100% functionality everywhere.

### Pattern 3: Dual-Mode Meal Plan Entries

**What:** A meal plan entry can reference an existing `recipe_id` OR contain a standalone `custom_title`.
**When to use:** For meals consisting of quick ingredients or snacks without recipe instructions.
**Trade-offs:** Requires relaxing the foreign key constraint `recipe_id NOT NULL` to `NULL` and ensuring `CHECK (recipe_id IS NOT NULL OR custom_title IS NOT NULL)`.

## Data Flow

### Barcode Scan to Add to List

```
User opens scanner on Grocery List
    ↓
Camera stream decodes barcode "012345678905"
    ↓
PWA calls GET /api/barcodes/012345678905
    ↓
Service checks local `barcode_product` table cache
    ├── [Cache Hit] → Returns { name: "Organic Whole Milk", brand: "Horizon" }
    └── [Cache Miss] → Fetches Open Food Facts v3 API
                           ↓
                       Caches in `barcode_product` & returns to client
    ↓
PWA auto-populates list item name (allowing user quick confirmation/edit)
    ↓
PWA posts to POST /api/lists/:id/items
```

### Barcode Scan to Mark Bought

```
User scans item in-store
    ↓
Camera decodes barcode
    ↓
PWA checks active list for matching item:
    1. Exact barcode match (if item has barcode)
    2. Name match from barcode lookup
    ↓
Matches item in list → sends PATCH /api/lists/:id/items/:itemId with status: 'bought'
    ↓
UI gives audio/haptic feedback & updates status
```

---
*Architecture research for: Grocery Deals, Barcode Scanning & Kitchen Management*
*Researched: 2026-11-08*

