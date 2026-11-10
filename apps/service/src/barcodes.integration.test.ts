import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BarcodeProduct, ProblemDetails } from '@hestia/shared';
import { adminPool, as, household } from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';

/*
 * Barcode proxy integration tests against live PostgreSQL (`supabase start`).
 * Verifies Open Food Facts v3 upstream fetching, database caching in `barcode_products`,
 * upstream error resilience (429, 503, timeout), and schema validation / auth boundaries.
 */

registerStackHooks();

const TEST_BARCODE = '012345678905';

describe('barcode lookup integration (TEST-02, D-03)', () => {
  beforeEach(async () => {
    await adminPool.query('delete from public.barcode_products where barcode = $1', [TEST_BARCODE]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await adminPool.query('delete from public.barcode_products where barcode = $1', [TEST_BARCODE]);
  });

  it('fetches Open Food Facts v3 on cache miss, caches in PostgreSQL, and serves from cache on second request', async () => {
    const home = await household(app);

    let fetchCount = 0;
    let outboundUrl = '';
    let outboundHeaders: Record<string, string> = {};

    const mockFetch = vi.fn<typeof fetch>((input, init) => {
      fetchCount += 1;
      outboundUrl = typeof input === 'string' ? input : (input as Request).url;
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          outboundHeaders = Object.fromEntries(init.headers.entries());
        } else if (Array.isArray(init.headers)) {
          outboundHeaders = Object.fromEntries(init.headers);
        } else {
          outboundHeaders = { ...(init.headers as Record<string, string>) };
        }
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: 'success',
            product: {
              product_name: 'Organic Whole Milk',
              brands: 'Horizon Organic',
              quantity: '1 gal',
              image_front_url: 'https://images.openfoodfacts.org/1.jpg',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    });

    vi.stubGlobal('fetch', mockFetch);

    // 1. Initial request on cache miss
    const firstResponse = await as(app, home.user, 'GET', `/api/barcodes/${TEST_BARCODE}`);
    expectStatus(firstResponse, 200);

    const firstProduct = firstResponse.json<BarcodeProduct>();
    expect(firstProduct).toEqual({
      barcode: TEST_BARCODE,
      productName: 'Organic Whole Milk',
      brands: 'Horizon Organic',
      quantity: '1 gal',
      imageUrl: 'https://images.openfoodfacts.org/1.jpg',
    });

    // Verify upstream fetch invocation and User-Agent compliance
    expect(fetchCount).toBe(1);
    expect(outboundUrl).toContain(
      `https://world.openfoodfacts.org/api/v3/product/${TEST_BARCODE}.json`,
    );
    const userAgent = outboundHeaders['User-Agent'] ?? outboundHeaders['user-agent'];
    expect(userAgent).toMatch(/^Hestia\/2\.1 \(https:\/\/hestia\.aberrance\.app; mailto:/i);
    const acceptHeader = outboundHeaders['Accept'] ?? outboundHeaders['accept'];
    expect(acceptHeader).toBe('application/json');

    // 2. Query PostgreSQL directly to confirm persistence
    const { rows } = await adminPool.query<{
      barcode: string;
      product_name: string | null;
      brands: string | null;
      quantity: string | null;
      image_url: string | null;
    }>(
      'select barcode, product_name, brands, quantity, image_url from public.barcode_products where barcode = $1',
      [TEST_BARCODE],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      barcode: TEST_BARCODE,
      product_name: 'Organic Whole Milk',
      brands: 'Horizon Organic',
      quantity: '1 gal',
      image_url: 'https://images.openfoodfacts.org/1.jpg',
    });

    // 3. Second request for identical barcode resolves from database cache without calling fetch
    const secondResponse = await as(app, home.user, 'GET', `/api/barcodes/${TEST_BARCODE}`);
    expectStatus(secondResponse, 200);
    const secondProduct = secondResponse.json<BarcodeProduct>();
    expect(secondProduct).toEqual(firstProduct);
    expect(fetchCount).toBe(1); // zero additional calls
  });

  it('handles upstream 429 Too Many Requests cleanly, returning RFC 9457 404 Problem Details', async () => {
    const home = await household(app);

    const mockFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 429, statusText: 'Too Many Requests' })),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await as(app, home.user, 'GET', `/api/barcodes/${TEST_BARCODE}`);
    expectStatus(response, 404);

    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<ProblemDetails>();
    expect(body.status).toBe(404);
    expect(body.detail).toBe('Product not found for scanned barcode.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles upstream 503 Service Unavailable cleanly, returning RFC 9457 404 Problem Details', async () => {
    const home = await household(app);

    const mockFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 503, statusText: 'Service Unavailable' })),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await as(app, home.user, 'GET', `/api/barcodes/${TEST_BARCODE}`);
    expectStatus(response, 404);

    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<ProblemDetails>();
    expect(body.status).toBe(404);
    expect(body.detail).toBe('Product not found for scanned barcode.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles upstream fetch timeout / AbortError cleanly, returning RFC 9457 404 Problem Details', async () => {
    const home = await household(app);

    const mockFetch = vi.fn<typeof fetch>(() =>
      Promise.reject(new DOMException('The operation was aborted', 'AbortError')),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await as(app, home.user, 'GET', `/api/barcodes/${TEST_BARCODE}`);
    expectStatus(response, 404);

    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<ProblemDetails>();
    expect(body.status).toBe(404);
    expect(body.detail).toBe('Product not found for scanned barcode.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed barcodes with RFC 9457 400 Bad Request before database or upstream lookups', async () => {
    const home = await household(app);

    const mockFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', mockFetch);

    // Barcode with disallowed special characters
    const response = await as(app, home.user, 'GET', '/api/barcodes/invalid!@#');
    expectStatus(response, 400);

    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<ProblemDetails>();
    expect(body.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests with RFC 9457 401 Unauthorized Problem Details', async () => {
    const mockFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', mockFetch);

    const response = await app.inject({
      method: 'GET',
      url: `/api/barcodes/${TEST_BARCODE}`,
    });
    expectStatus(response, 401);

    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<ProblemDetails>();
    expect(body.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
