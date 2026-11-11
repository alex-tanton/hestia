import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
  type RootOperationNode,
} from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../db.js';
import { lookupBarcode } from './barcodes.js';

function createMockDb(queryHandler: (node: RootOperationNode) => unknown[]): Kysely<Database> {
  const connection: DatabaseConnection = {
    executeQuery<R>(compiledQuery: { query: RootOperationNode }): Promise<QueryResult<R>> {
      const rows = queryHandler(compiledQuery.query);
      return Promise.resolve({ rows: rows as R[] });
    },
    streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
      throw new Error('Not supported');
    },
  };

  const driver: Driver = {
    init: () => Promise.resolve(),
    acquireConnection: () => Promise.resolve(connection),
    beginTransaction: () => Promise.resolve(),
    commitTransaction: () => Promise.resolve(),
    rollbackTransaction: () => Promise.resolve(),
    releaseConnection: () => Promise.resolve(),
    destroy: () => Promise.resolve(),
  };

  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}

describe('lookupBarcode service', () => {
  const ownerEmail = 'owner@example.com';
  const barcode = '012345678905';

  it('returns cached barcode product without calling upstream fetch on cache hit', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const db = createMockDb((node) => {
      if (node.kind === 'SelectQueryNode') {
        return [
          {
            barcode,
            product_name: 'Organic Milk',
            brands: 'Horizon',
            quantity: '1 gal',
            image_url: 'https://images.openfoodfacts.org/1.jpg',
          },
        ];
      }
      return [];
    });

    const result = await lookupBarcode(db, barcode, ownerEmail, fetchFn);

    expect(result).toEqual({
      barcode,
      productName: 'Organic Milk',
      brands: 'Horizon',
      quantity: '1 gal',
      imageUrl: 'https://images.openfoodfacts.org/1.jpg',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fetches Open Food Facts v3 API on cache miss, caches row in database, and returns mapped product', async () => {
    const executedQueries: RootOperationNode[] = [];
    const db = createMockDb((node) => {
      executedQueries.push(node);
      return [];
    });

    const mockResponse = {
      status: 'success',
      product: {
        product_name: 'Organic Milk',
        brands: 'Horizon',
        quantity: '1 gal',
        image_front_url: 'https://images.openfoodfacts.org/1.jpg',
      },
    };

    let requestedUrl = '';
    let capturedHeaders: Record<string, string> | undefined;

    const fetchFn = vi.fn<typeof fetch>((input, init) => {
      requestedUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const result = await lookupBarcode(db, barcode, ownerEmail, fetchFn);

    expect(requestedUrl).toContain(encodeURIComponent(barcode));
    expect(capturedHeaders).toMatchObject({
      'User-Agent': 'Hestia/2.1 (https://hestia.aberrance.app; mailto:owner@example.com)',
      Accept: 'application/json',
    });

    expect(result).toEqual({
      barcode,
      productName: 'Organic Milk',
      brands: 'Horizon',
      quantity: '1 gal',
      imageUrl: 'https://images.openfoodfacts.org/1.jpg',
    });

    const insertNode = executedQueries.find((q) => q.kind === 'InsertQueryNode');
    expect(insertNode).toBeDefined();
  });

  it('returns null without caching when Open Food Facts reports product not found', async () => {
    const executedQueries: RootOperationNode[] = [];
    const db = createMockDb((node) => {
      executedQueries.push(node);
      return [];
    });

    const fetchFn = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'product_not_found' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const result = await lookupBarcode(db, barcode, ownerEmail, fetchFn);

    expect(result).toBeNull();
    const insertNode = executedQueries.find((q) => q.kind === 'InsertQueryNode');
    expect(insertNode).toBeUndefined();
  });

  it('accepts success_with_warnings from Open Food Facts v3 (12-digit UPC-A normalization) and upgrades http image URLs', async () => {
    const executedQueries: RootOperationNode[] = [];
    const db = createMockDb((node) => {
      executedQueries.push(node);
      return [];
    });

    const mockResponse = {
      status: 'success_with_warnings',
      warnings: [{ message: { id: 'different_normalized_product_code' } }],
      product: {
        product_name: 'Whole Organic Milk',
        brands: 'Horizon Organic',
        quantity: '64 fl oz',
        image_front_url: 'http://images.openfoodfacts.org/images/products/001/234/567/8905/1.jpg',
      },
    };

    const fetchFn = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const result = await lookupBarcode(db, barcode, ownerEmail, fetchFn);

    expect(result).toEqual({
      barcode,
      productName: 'Whole Organic Milk',
      brands: 'Horizon Organic',
      quantity: '64 fl oz',
      imageUrl: 'https://images.openfoodfacts.org/images/products/001/234/567/8905/1.jpg',
    });
    expect(executedQueries.find((q) => q.kind === 'InsertQueryNode')).toBeDefined();
  });

  it('handles upstream timeout gracefully by returning null without throwing', async () => {
    const db = createMockDb(() => []);
    const fetchFn = vi.fn<typeof fetch>(() => {
      const error = new Error('The operation was aborted.');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    const result = await lookupBarcode(db, barcode, ownerEmail, fetchFn);

    expect(result).toBeNull();
  });
});
