# Phase 14: Barcode Scanning & Grocery List Integration - Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 19
**Analogs found:** 18 / 19 (1 novel browser API integration referencing RESEARCH.md)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/service/src/routes/barcodes.ts` | route | request-response | `apps/service/src/routes/deals.ts` | exact |
| `apps/service/src/services/barcodes.ts` | service | request-response | `apps/service/src/recipes/fetch-recipe.ts` | exact |
| `apps/service/src/routes/barcodes.test.ts` | test | request-response | `apps/service/src/routes/routes.test.ts` | exact |
| `apps/service/src/services/barcodes.test.ts` | test | request-response | `apps/service/src/recipes/fetch-recipe.test.ts` | exact |
| `apps/service/src/app.ts` | config | static | `apps/service/src/app.ts` | exact |
| `packages/shared/src/api/barcodes.ts` | model | request-response | `packages/shared/src/api/recipes.ts` | exact |
| `packages/shared/src/api/lists.ts` | model | request-response | `packages/shared/src/api/lists.ts` | exact |
| `packages/shared/src/index.ts` | config | static | `packages/shared/src/index.ts` | exact |
| `apps/web/src/lib/api/barcode-hooks.ts` | hook | request-response | `apps/web/src/lib/api/deals.ts` | exact |
| `apps/web/src/lib/barcode/detector.ts` | utility | streaming | None (Browser BarcodeDetector API) | novel |
| `apps/web/src/lib/barcode/feedback.ts` | utility | event-driven | `apps/web/src/components/ui/Toast.tsx` | role-match |
| `apps/web/src/lib/barcode/matching.ts` | utility | transform | `packages/matching/src/matcher.ts` | exact |
| `apps/web/src/components/lists/BarcodeScannerDialog.tsx` | component | event-driven | `apps/web/src/components/ui/Sheet.tsx` | role-match |
| `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` | test | event-driven | `apps/web/src/components/ui/Toast.test.tsx` | role-match |
| `apps/web/src/components/lists/ItemSheet.tsx` | component | CRUD | `apps/web/src/components/lists/ItemSheet.tsx` | exact |
| `apps/web/src/screens/lists/ListDetailScreen.tsx` | component | CRUD | `apps/web/src/screens/lists/ListDetailScreen.tsx` | exact |
| `apps/web/src/screens/lists/lists.test.tsx` | test | event-driven | `apps/web/src/screens/lists/lists.test.tsx` | exact |
| `supabase/migrations/20261110000000_barcode_products.sql` | migration | batch | `supabase/migrations/20260919070000_schema.sql` | exact |
| `docker/Caddyfile` | config | request-response | `docker/Caddyfile` | exact |

---

## Pattern Assignments

### `apps/service/src/routes/barcodes.ts` (route, request-response)

**Analog:** `apps/service/src/routes/deals.ts` (lines 1-15, 50-57) and `apps/service/src/routes/lists.ts` (lines 1-42)

**Imports pattern:**
```typescript
// Analog: apps/service/src/routes/deals.ts:1-15
import type { FastifyPluginAsync } from 'fastify';
import { barcodeParamsSchema } from '@hestia/shared';
import { parse, type RouteContext } from '../http/context.js';
import { fail } from '../problem.js';
import { lookupBarcode } from '../services/barcodes.js';
```

**Auth & Validation pattern:**
```typescript
// Analog: apps/service/src/routes/deals.ts:50-57, apps/service/src/routes/users.ts:30-33
export const barcodeRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/barcodes/:barcode', async (request) => {
    const user = await ctx.authenticate(request);
    const { barcode } = parse(barcodeParamsSchema, request.params);
    return ctx.asUser(user, async (db) => {
      const product = await lookupBarcode(db, barcode, ctx.ownerEmail);
      if (!product) throw fail(404, 'Product not found for scanned barcode.');
      return product;
    });
  });

  return Promise.resolve();
};
```

**Error handling pattern:**
- Unauthenticated requests throw `fail(401, 'Sign in to continue.')` via `ctx.authenticate(request)`.
- Invalid params throw Zod validation errors formatted by `parse()`.
- Barcode misses throw `fail(404, 'Product not found for scanned barcode.')`.

---

### `apps/service/src/services/barcodes.ts` (service, request-response)

**Analog:** `apps/service/src/recipes/fetch-recipe.ts` (lines 19-33, 290-340) and `apps/service/src/services/lists.ts` (lines 270-340)

**Imports pattern:**
```typescript
// Analog: apps/service/src/services/lists.ts:1-12
import type { Kysely } from 'kysely';
import type { BarcodeProduct } from '@hestia/shared';
import type { Database } from '../db.js';
```

**Core pattern (Cache-first proxy with AbortController timeout):**
```typescript
// Analog: apps/service/src/recipes/fetch-recipe.ts:19-20, apps/service/src/services/deals/cache.ts:25-35
export const OPEN_FOOD_FACTS_TIMEOUT_MS = 5_000;

export async function lookupBarcode(
  db: Kysely<Database>,
  barcode: string,
  ownerEmail: string,
  fetchFn: typeof fetch = fetch,
): Promise<BarcodeProduct | null> {
  // 1. Check internal Postgres cache table (barcode_products)
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

  // 2. Fetch from Open Food Facts API v3 with compliant User-Agent header and 5s timeout
  const userAgent = `Hestia/2.1 (https://hestia.aberrance.app; mailto:${ownerEmail})`;
  const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,quantity,image_front_url`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPEN_FOOD_FACTS_TIMEOUT_MS);

  try {
    const response = await fetchFn(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

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

    // 3. Persist into Postgres cache
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
  } finally {
    clearTimeout(timeout);
  }
}
```

---

### `apps/service/src/routes/barcodes.test.ts` (test, request-response)

**Analog:** `apps/service/src/routes/routes.test.ts` (lines 1-60)

**Core pattern (Inject route test with fake app harness):**
```typescript
// Analog: apps/service/src/routes/routes.test.ts:1-25, 36-60
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { bearer, makeTestApp, signToken, userClaims } from '../test/fake-app.js';

const apps: FastifyInstance[] = [];

async function app(): Promise<FastifyInstance> {
  const instance = await makeTestApp({}, { ownerEmail: 'owner@example.com' });
  apps.push(instance);
  return instance;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});

describe('GET /api/barcodes/:barcode', () => {
  it('answers 401 without a valid token', async () => {
    const instance = await app();
    const response = await instance.inject({
      method: 'GET',
      url: '/api/barcodes/012345678905',
    });
    expect(response.statusCode).toBe(401);
  });

  it('answers 400 when barcode is malformed', async () => {
    const instance = await app();
    const response = await instance.inject({
      method: 'GET',
      url: '/api/barcodes/!',
      headers: bearer(),
    });
    expect(response.statusCode).toBe(400);
  });
});
```

---

### `apps/service/src/services/barcodes.test.ts` (test, request-response)

**Analog:** `apps/service/src/recipes/fetch-recipe.test.ts` (lines 1-35) and `apps/service/src/services/deals/cache.test.ts` (lines 1-50)

**Core pattern (Unit tests with mocked fetch and DB fixtures):**
```typescript
// Analog: apps/service/src/recipes/fetch-recipe.test.ts:1-35
import { describe, expect, it, vi } from 'vitest';
import { lookupBarcode } from './barcodes.js';

describe('lookupBarcode', () => {
  it('returns cached product from db without invoking fetch', async () => {
    const fakeDb = {
      selectFrom: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue({
              barcode: '012345678905',
              product_name: 'Organic Oat Milk',
              brands: 'Oatly',
              quantity: '32 fl oz',
              image_url: 'https://images.openfoodfacts.org/1.jpg',
            }),
          }),
        }),
      }),
    };

    const fetchFn = vi.fn();
    const result = await lookupBarcode(fakeDb as any, '012345678905', 'test@example.com', fetchFn);
    expect(result?.productName).toBe('Organic Oat Milk');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fetches from Open Food Facts on cache miss and writes to database', async () => {
    // Verifies User-Agent formatting, parsing, and caching
  });

  it('handles upstream timeouts gracefully and returns null', async () => {
    const fetchFn = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    // Verifies null return without unhandled rejection
  });
});
```

---

### `packages/shared/src/api/barcodes.ts` (model, request-response)

**Analog:** `packages/shared/src/api/recipes.ts` (lines 1-25) and `packages/shared/src/api/lists.ts` (lines 13-20)

**Imports & Schemas pattern:**
```typescript
// Analog: packages/shared/src/api/recipes.ts:1-25, packages/shared/src/api/common.ts:1-10
import { z } from 'zod';

export const barcodeSchema = z
  .string()
  .trim()
  .min(3, 'Barcode must be at least 3 characters.')
  .max(64, 'Barcode must not exceed 64 characters.')
  .regex(/^[A-Za-z0-9_-]+$/, 'Barcode must be alphanumeric.');

export const barcodeParamsSchema = z.object({
  barcode: barcodeSchema,
});
export type BarcodeParams = z.infer<typeof barcodeParamsSchema>;

export const barcodeProductSchema = z.object({
  barcode: z.string(),
  productName: z.string().nullable(),
  brands: z.string().nullable(),
  quantity: z.string().nullable(),
  imageUrl: z.string().nullable(),
});
export type BarcodeProduct = z.infer<typeof barcodeProductSchema>;
```

---

### `packages/shared/src/api/lists.ts` (model, request-response) [MODIFIED]

**Analog:** `packages/shared/src/api/lists.ts` (lines 25-50, 110-169)

**Core additions (optional barcode field on item models and create/update inputs):**
```typescript
// Analog: packages/shared/src/api/lists.ts:25-50
export const listItemSchema = z.object({
  id: idSchema,
  listId: idSchema,
  itemName: z.string(),
  normalizedName: z.string(),
  barcode: z.string().nullable().optional(), // Added for Phase 14
  quantity: z.number().nullable(),
  quantityNote: z.string().nullable(),
  status: listItemStatusSchema,
  ...
});

// Analog: packages/shared/src/api/lists.ts:112-126
const manualListItemRequestSchema = z
  .object({
    source: z.literal('manual'),
    id: idSchema.optional(),
    itemName: itemNameSchema,
    barcode: barcodeSchema.nullish(), // Added for Phase 14
    quantity: quantitySchema.nullish(),
    quantityNote: quantityNoteSchema.nullish(),
    priceCents: centsSchema.nullish(),
    priceUnit: priceUnitSchema.optional(),
    merchantId: merchantIdSchema.nullish(),
    merchantName: merchantNameSchema.nullish(),
  })
  .refine(storePair, { message: STORE_PAIR_MESSAGE, path: ['merchantName'] });

// Analog: packages/shared/src/api/lists.ts:150-169
export const updateListItemRequestSchema = z
  .object({
    itemName: itemNameSchema.optional(),
    barcode: barcodeSchema.nullable().optional(), // Added for Phase 14
    quantity: quantitySchema.nullable().optional(),
    quantityNote: quantityNoteSchema.nullable().optional(),
    status: listItemStatusSchema.optional(),
    priceCents: centsSchema.nullable().optional(),
    priceUnit: priceUnitSchema.optional(),
    merchantId: merchantIdSchema.nullable().optional(),
    merchantName: merchantNameSchema.nullable().optional(),
  })
  ...
```

---

### `apps/web/src/lib/api/barcode-hooks.ts` (hook, request-response)

**Analog:** `apps/web/src/lib/api/deals.ts` (lines 1-15, 80-107) and `apps/web/src/lib/api/list-hooks.ts` (lines 38-55)

**Core pattern (Client API fetcher + TanStack Query hook):**
```typescript
// Analog: apps/web/src/lib/api/deals.ts:1-15, 80-107
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { barcodeProductSchema, type BarcodeProduct } from '@hestia/shared';
import type { ApiClient } from './client.ts';
import { useApi } from './api-context.tsx';

export const barcodeKeys = {
  barcode: (barcode: string) => ['barcodes', barcode] as const,
};

export async function fetchBarcodeProduct(
  api: ApiClient,
  barcode: string,
  signal?: AbortSignal,
): Promise<BarcodeProduct> {
  return api.request({
    method: 'GET',
    path: `/api/barcodes/${encodeURIComponent(barcode)}`,
    schema: barcodeProductSchema,
    signal,
  });
}

export function useBarcodeProduct(
  barcode: string | null | undefined,
): UseQueryResult<BarcodeProduct> {
  const api = useApi();
  return useQuery({
    queryKey: barcodeKeys.barcode(barcode ?? ''),
    enabled: Boolean(barcode && barcode.trim().length > 0),
    retry: false,
    queryFn: ({ signal }) => fetchBarcodeProduct(api, barcode!, signal),
  });
}
```

---

### `apps/web/src/lib/barcode/detector.ts` (utility, streaming)

**Analog:** Novel browser API wrapper; follows dynamic polyfill pattern documented in `14-RESEARCH.md` Pattern 1 (lines 234-261).

**Core pattern (Native W3C BarcodeDetector with dynamic polyfill fallback):**
```typescript
// Source: W3C BarcodeDetector API Specification & 14-RESEARCH.md:234-261
export interface BarcodeResult {
  rawValue: string;
  format: string;
}

export interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<BarcodeResult[]>;
}

export const SUPPORTED_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'qr_code',
];

export async function createBarcodeDetector(): Promise<BarcodeDetectorInstance> {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    const NativeDetector = (
      window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => BarcodeDetectorInstance;
      }
    ).BarcodeDetector;
    return new NativeDetector({ formats: SUPPORTED_BARCODE_FORMATS });
  }

  // Dynamic import keeps polyfill and WASM out of initial PWA bundle
  const { BarcodeDetectorPolyfill } = await import('@undecaf/barcode-detector-polyfill');
  return new BarcodeDetectorPolyfill({
    formats: SUPPORTED_BARCODE_FORMATS,
  }) as unknown as BarcodeDetectorInstance;
}
```

---

### `apps/web/src/lib/barcode/feedback.ts` (utility, event-driven)

**Analog:** `apps/web/src/components/ui/Toast.tsx` (lines 33-47) and `14-RESEARCH.md` (lines 483-526)

**Core pattern (Web Audio oscillator sine chime + haptic vibration):**
```typescript
// Analog: 14-RESEARCH.md:483-526
export function playScanChime(success = true): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

export function triggerScanHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(40);
    } catch {
      // Graceful no-op
    }
  }
}
```

---

### `apps/web/src/lib/barcode/matching.ts` (utility, transform)

**Analog:** `packages/matching/src/matcher.ts` (lines 1-57) and `packages/matching/src/normalize.ts` (lines 1-30)

**Imports & Matching pattern:**
```typescript
// Analog: packages/matching/src/index.ts:1-3, packages/matching/src/matcher.ts:46-57
import { normalize } from '@hestia/matching';
import type { ListItem } from '@hestia/shared';

export interface MatchResult {
  exactBarcodeMatch: ListItem | null;
  normalizedNameMatch: ListItem | null;
  candidateMatches: ListItem[];
}

export function matchScannedItem(
  unboughtItems: readonly ListItem[],
  scannedBarcode: string,
  resolvedProductName: string | null,
): MatchResult {
  // 1. Direct barcode match on list item (works offline)
  const exact = unboughtItems.find((item) => item.barcode === scannedBarcode) ?? null;
  if (exact) {
    return { exactBarcodeMatch: exact, normalizedNameMatch: null, candidateMatches: [exact] };
  }

  // 2. Normalized name match if product name was resolved
  if (!resolvedProductName) {
    return { exactBarcodeMatch: null, normalizedNameMatch: null, candidateMatches: [] };
  }

  const normalizedScanned = normalize(resolvedProductName);
  const matched = unboughtItems.filter((item) => {
    return (
      item.normalizedName === normalizedScanned ||
      item.normalizedName.includes(normalizedScanned) ||
      normalizedScanned.includes(item.normalizedName)
    );
  });

  return {
    exactBarcodeMatch: null,
    normalizedNameMatch: matched.length === 1 ? matched[0] : null,
    candidateMatches: matched,
  };
}
```

---

### `apps/web/src/components/lists/BarcodeScannerDialog.tsx` (component, event-driven)

**Analog:** `apps/web/src/components/ui/Sheet.tsx` (lines 1-58) and `apps/web/src/components/ui/SegmentedControl.tsx` (lines 1-50)

**Imports pattern:**
```typescript
// Analog: apps/web/src/components/ui/Sheet.tsx:1-6, apps/web/src/components/ui/SegmentedControl.tsx:1-4
import { Flashlight, FlashlightOff, Keyboard, Video, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Button } from '../ui/Button.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { createBarcodeDetector } from '../../lib/barcode/detector.ts';
import { playScanChime, triggerScanHaptic } from '../../lib/barcode/feedback.ts';
```

**Stream Lifecycle & Clean-Up pattern:**
```typescript
// Analog: 14-RESEARCH.md:422-435
useEffect(() => {
  let activeStream: MediaStream | null = null;
  let animationFrameId: number | null = null;
  let isCancelled = false;

  async function startCamera(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (isCancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      activeStream = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Start 150-200ms detection loop
    } catch (err) {
      // Fallback to manual entry tab
    }
  }

  if (open && activeTab === 'camera') {
    void startCamera();
  }

  return () => {
    isCancelled = true;
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
  };
}, [open, activeTab]);
```

**Debounced Scan Pacing pattern:**
```typescript
// Analog: 14-RESEARCH.md:410-421
const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

function handleBarcodeDetected(barcode: string): void {
  const now = Date.now();
  if (lastScanRef.current.code === barcode && now - lastScanRef.current.time < 1800) {
    return; // Enforce 1.8s debounce window for identical barcodes
  }
  lastScanRef.current = { code: barcode, time: now };
  playScanChime(true);
  triggerScanHaptic();
  onScan(barcode, mode);
}
```

---

### `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` (test, event-driven)

**Analog:** `apps/web/src/components/ui/Toast.test.tsx` (lines 1-60) and `apps/web/src/components/ui/primitives.test.tsx` (lines 1-50)

**Core pattern (Component rendering with mediaDevices mocks):**
```typescript
// Analog: apps/web/src/components/ui/Toast.test.tsx:1-40
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarcodeScannerDialog } from './BarcodeScannerDialog.tsx';

describe('BarcodeScannerDialog', () => {
  beforeEach(() => {
    const mockTrack = { stop: vi.fn(), getCapabilities: () => ({ torch: true }) };
    const mockStream = { getTracks: () => [mockTrack], getVideoTracks: () => [mockTrack] };
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders mode toggle tabs for Add to List and Shop & Check Off', () => {
    render(<BarcodeScannerDialog open onOpenChange={vi.fn()} onScan={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /Add to List/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Shop & Check Off/i })).toBeInTheDocument();
  });

  it('allows manual barcode entry via numeric tab', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<BarcodeScannerDialog open onOpenChange={vi.fn()} onScan={onScan} />);
    await user.click(screen.getByRole('tab', { name: /Manual/i }));
    await user.type(screen.getByRole('textbox', { name: /Barcode/i }), '012345678905');
    await user.click(screen.getByRole('button', { name: /Submit/i }));
    expect(onScan).toHaveBeenCalledWith('012345678905', expect.any(String));
  });
});
```

---

### `apps/web/src/components/lists/ItemSheet.tsx` (component, CRUD) [MODIFIED]

**Analog:** `apps/web/src/components/lists/ItemSheet.tsx` (lines 18-35, 56-75)

**Core additions (support initial pre-filled draft from barcode scanner):**
```typescript
// Analog: apps/web/src/components/lists/ItemSheet.tsx:18-35
export interface ItemDraft {
  itemName: string;
  quantity: number | null;
  priceCents: number | null;
  priceUnit: PriceUnit;
  merchantId: string | null;
  merchantName: string | null;
  barcode?: string | null; // Added for Phase 14
}

export interface ItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ListItem | undefined;
  initialDraft?: Partial<ItemDraft> | undefined; // Added for Phase 14
  stores: readonly StoreChoice[];
  onSubmit: (draft: ItemDraft) => void;
}

// In ItemSheet:
const [itemName, setItemName] = useState(
  item?.itemName ?? initialDraft?.itemName ?? '',
);
const [barcode, setBarcode] = useState<string | null>(
  item?.barcode ?? initialDraft?.barcode ?? null,
);
```

---

### `apps/web/src/screens/lists/ListDetailScreen.tsx` (component, CRUD) [MODIFIED]

**Analog:** `apps/web/src/screens/lists/ListDetailScreen.tsx` (lines 62-105, 370-405)

**Toolbar trigger placement (Decision D-01):**
```typescript
// Analog: apps/web/src/screens/lists/ListDetailScreen.tsx:370-381
{!isArchived && detail !== undefined && (
  <div className="flex justify-end gap-2">
    <Button
      variant="secondary"
      onClick={() => {
        setIsScanning(true);
      }}
    >
      <ScanBarcode className="mr-1.5" size={18} />
      Scan barcode
    </Button>
    <Button
      onClick={() => {
        setIsAdding(true);
      }}
    >
      Add an item
    </Button>
  </div>
)}
```

**Multi-sensory Check-Off and Undo Toast (Decision D-04):**
```typescript
// Analog: apps/web/src/screens/lists/ListDetailScreen.tsx:92-105, apps/web/src/components/ui/Toast.tsx:16-26
const handleScanCheckOff = (item: ListItem, scannedBarcode?: string): void => {
  // Update item to bought, linking barcode if provided
  updateItem.mutate({
    kind: 'update-item',
    householdId,
    listId,
    itemId: item.id,
    itemName: item.itemName,
    patch: {
      status: 'bought',
      ...(scannedBarcode && !item.barcode ? { barcode: scannedBarcode } : {}),
    },
  });

  // Display floating toast with interactive Undo
  toast({
    variant: 'success',
    message: `${item.itemName} marked bought`,
    action: {
      label: 'Undo',
      onAction: () => {
        updateItem.mutate({
          kind: 'update-item',
          householdId,
          listId,
          itemId: item.id,
          itemName: item.itemName,
          patch: { status: 'needed' },
        });
      },
    },
  });
};
```

---

### `supabase/migrations/20261110000000_barcode_products.sql` (migration, batch)

**Analog:** `supabase/migrations/20260919070000_schema.sql` (lines 196-220) and `supabase/migrations/20260919070100_rls.sql` (lines 135-145, 203-222)

**DDL and RLS pattern:**
```sql
-- Upstream barcode metadata cache table (Open Food Facts v3)
create table if not exists public.barcode_products (
  barcode text primary key check (btrim(barcode) <> ''),
  product_name text,
  brands text,
  quantity text,
  image_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

-- Store barcode on shopping list items for instant offline matching
alter table public.shopping_list_item add column if not exists barcode text;
create index if not exists shopping_list_item_barcode_idx on public.shopping_list_item (barcode)
  where barcode is not null;

-- Enable RLS on barcode cache
alter table public.barcode_products enable row level security;

-- Authenticated household members can read and insert into shared cache
create policy authenticated_read on public.barcode_products
  for select to authenticated using (true);

create policy authenticated_insert on public.barcode_products
  for insert to authenticated with check (true);
```

---

### `docker/Caddyfile` (config, request-response) [MODIFIED]

**Analog:** `docker/Caddyfile` (lines 12-19)

**Header pattern:**
```caddy
# Analog: docker/Caddyfile:14-18
header {
    defer
    Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.flipp.com https://flipp-image-retrieval.flipp.com https://*.wishabi.com https://*.wishabi.net https://*.openfoodfacts.org; connect-src 'self' wss://{$HESTIA_HOST}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    Strict-Transport-Security "max-age=31536000"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "same-origin"
    Permissions-Policy "camera=(self), microphone=(), geolocation=()"
}
```

---

## Shared Patterns

### 1. Authentication & Route Context
**Source:** `apps/service/src/http/context.ts` (lines 45-58), `apps/service/src/routes/deals.ts` (lines 50-57)
**Apply to:** All Fastify routes in `apps/service/src/routes/barcodes.ts`
```typescript
const user = await ctx.authenticate(request);
return ctx.asUser(user, async (db) => {
  // Query executed under caller's RLS context
});
```

### 2. RFC 9457 Problem Details & Centralized Error Handling
**Source:** `apps/service/src/problem.ts` (lines 8-36)
**Apply to:** `apps/service/src/routes/barcodes.ts`, `apps/service/src/services/barcodes.ts`
```typescript
import { fail } from '../problem.js';

// Throws ProblemError formatted as application/problem+json
if (!product) throw fail(404, 'Product not found for scanned barcode.');
```

### 3. Upstream HTTP Fetch with AbortController Timeout
**Source:** `apps/service/src/recipes/fetch-recipe.ts` (lines 19-33, 290-340)
**Apply to:** `apps/service/src/services/barcodes.ts`
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': userAgent } });
} finally {
  clearTimeout(timeout);
}
```

### 4. Interactive Action Toasts with Undo
**Source:** `apps/web/src/components/ui/Toast.tsx` (lines 16-39), `apps/web/src/screens/lists/ListDetailScreen.tsx` (lines 92-105)
**Apply to:** "Shop & Check Off" mode check-off flow in `ListDetailScreen.tsx`
```typescript
const toast = useToast();
toast({
  variant: 'success',
  message: `${item.itemName} marked bought`,
  action: {
    label: 'Undo',
    onAction: () => {
      // Revert status to needed
    },
  },
});
```

### 5. Radix Dialog and Segmented Toggle Primitives
**Source:** `apps/web/src/components/ui/Sheet.tsx` (lines 21-57), `apps/web/src/components/ui/SegmentedControl.tsx` (lines 21-50)
**Apply to:** Viewfinder dialog and mode switcher in `BarcodeScannerDialog.tsx`
```typescript
<Dialog.Root open={open} onOpenChange={onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
    <Dialog.Content className="...">
      <SegmentedControl
        label="Scanner mode"
        segments={[
          { value: 'add', label: 'Add to List' },
          { value: 'shop', label: 'Shop & Check Off' },
        ]}
        value={mode}
        onValueChange={setMode}
      />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### 6. Grocery Name Normalization & Matching
**Source:** `packages/matching/src/matcher.ts` (lines 46-57)
**Apply to:** Client-side item matching in `apps/web/src/lib/barcode/matching.ts`
```typescript
import { normalize } from '@hestia/matching';
const normalizedScanned = normalize(resolvedProductName);
```

---

## No Analog Found

Files with novel hardware/browser APIs (planner should use patterns from `14-RESEARCH.md`):

| File | Role | Data Flow | Reason / Resolution |
|---|---|---|---|
| `apps/web/src/lib/barcode/detector.ts` | utility | streaming | First video barcode detector in Hestia; uses standard W3C `BarcodeDetector` API with dynamic `@undecaf/barcode-detector-polyfill` fallback detailed in RESEARCH.md Pattern 1. |

---

## Metadata

**Analog search scope:**
- `apps/service/src/routes/`
- `apps/service/src/services/`
- `apps/service/src/recipes/`
- `apps/web/src/components/lists/`
- `apps/web/src/components/ui/`
- `apps/web/src/lib/api/`
- `apps/web/src/screens/lists/`
- `packages/shared/src/api/`
- `packages/matching/src/`
- `supabase/migrations/`
- `docker/`

**Files scanned:** 38
**Pattern extraction date:** 2026-11-09
