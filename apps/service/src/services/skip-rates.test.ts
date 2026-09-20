import { describe, expect, it } from 'vitest';
import { SkipRateRegistry } from './skip-rates.js';

describe('SkipRateRegistry', () => {
  it('is empty until a refresh reports', () => {
    expect(new SkipRateRegistry().list()).toEqual([]);
  });

  it('keeps the latest refresh’s rates, highest first', () => {
    const registry = new SkipRateRegistry();
    registry.replace([{ merchantId: '1', merchantName: 'Old', fetched: 10, skipped: 10 }]);
    registry.replace([
      { merchantId: '2431', merchantName: 'Harris Teeter', fetched: 200, skipped: 10 },
      { merchantId: '2525', merchantName: 'Food Lion', fetched: 100, skipped: 25 },
      { merchantId: '9', merchantName: 'Empty', fetched: 0, skipped: 0 },
    ]);
    expect(registry.list()).toEqual([
      { merchantId: '2525', merchantName: 'Food Lion', fetched: 100, skipped: 25, skipRate: 0.25 },
      {
        merchantId: '2431',
        merchantName: 'Harris Teeter',
        fetched: 200,
        skipped: 10,
        skipRate: 0.05,
      },
      { merchantId: '9', merchantName: 'Empty', fetched: 0, skipped: 0, skipRate: 0 },
    ]);
  });
});
