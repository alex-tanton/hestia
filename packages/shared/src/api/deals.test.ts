import { describe, expect, it } from 'vitest';
import { dealSearchQuerySchema } from './deals.js';

/**
 * dealSearchQuerySchema is only ever fed to `z.toJSONSchema` by schemas.test.ts's
 * endpoint-contract check, which never runs the `stores` transform or the
 * min/max price refine below with real query data.
 */
describe('dealSearchQuerySchema: stores transform', () => {
  it('defaults an absent stores param to an empty array', () => {
    const result = dealSearchQuerySchema.safeParse({ q: 'milk' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stores).toEqual([]);
  });

  it('splits a comma-separated stores param into trimmed merchant ids', () => {
    const result = dealSearchQuerySchema.safeParse({
      q: 'milk',
      stores: ' lowes , harris-teeter ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stores).toEqual(['lowes', 'harris-teeter']);
  });

  it('drops empty entries left by a trailing or doubled comma', () => {
    // A client that joins an empty selection, or has a stray trailing comma, must not produce a
    // store id of the empty string, which would otherwise never match any real merchant.
    const result = dealSearchQuerySchema.safeParse({ q: 'milk', stores: 'lowes,,' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stores).toEqual(['lowes']);
  });
});

describe('dealSearchQuerySchema: price range refine', () => {
  it('accepts a search with neither bound set', () => {
    expect(dealSearchQuerySchema.safeParse({ q: 'milk' }).success).toBe(true);
  });

  it('accepts a search with only a minimum or only a maximum', () => {
    expect(dealSearchQuerySchema.safeParse({ q: 'milk', minPrice: '100' }).success).toBe(true);
    expect(dealSearchQuerySchema.safeParse({ q: 'milk', maxPrice: '500' }).success).toBe(true);
  });

  it('accepts a minimum at or below the maximum', () => {
    expect(
      dealSearchQuerySchema.safeParse({ q: 'milk', minPrice: '100', maxPrice: '100' }).success,
    ).toBe(true);
    expect(
      dealSearchQuerySchema.safeParse({ q: 'milk', minPrice: '100', maxPrice: '500' }).success,
    ).toBe(true);
  });

  it('refuses a minimum above the maximum', () => {
    const result = dealSearchQuerySchema.safeParse({
      q: 'milk',
      minPrice: '500',
      maxPrice: '100',
    });
    expect(result.success).toBe(false);
  });
});
