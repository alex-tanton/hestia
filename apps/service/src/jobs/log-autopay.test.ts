import { describe, expect, it } from 'vitest';
import { autopayOccurrences } from './log-autopay.js';

/*
 * Pure logic (the no-backfill rule explicitly). The database side (the insert, the unique-key
 * idempotency, and a real integration-test bill) is covered by log-autopay.integration.test.ts.
 */

describe('autopayOccurrences', () => {
  const monthly = { recurrence_unit: 'month' as const, interval: 1, anchor_date: '2026-01-01' };

  it('logs every occurrence from the anchor through today when the bill is as old as its anchor', () => {
    const dates = autopayOccurrences({
      ...monthly,
      created_date: '2026-01-01',
      today: '2026-03-15',
    });
    expect(dates).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('logs nothing before the anchor’s first occurrence arrives', () => {
    const dates = autopayOccurrences({
      ...monthly,
      anchor_date: '2026-06-01',
      created_date: '2026-06-01',
      today: '2026-05-01',
    });
    expect(dates).toEqual([]);
  });

  it('never backfills an occurrence dated before created_at, even though it is on or before today (the named no-backfill case)', () => {
    // Anchor is 3 months before today, but the bill was only created last month: the first two
    // monthly occurrences predate created_at and must never be auto-logged.
    const dates = autopayOccurrences({
      ...monthly,
      anchor_date: '2026-01-01',
      created_date: '2026-03-01',
      today: '2026-03-15',
    });
    expect(dates).toEqual(['2026-03-01']);
    expect(dates).not.toContain('2026-01-01');
    expect(dates).not.toContain('2026-02-01');
  });

  it('logs nothing when every occurrence through today predates created_at', () => {
    const dates = autopayOccurrences({
      ...monthly,
      anchor_date: '2026-01-01',
      created_date: '2026-06-01',
      today: '2026-03-01',
    });
    expect(dates).toEqual([]);
  });

  it('is idempotent in intent: the same inputs always produce the same occurrence list', () => {
    const input = { ...monthly, created_date: '2026-01-01', today: '2026-02-15' };
    expect(autopayOccurrences(input)).toEqual(autopayOccurrences(input));
  });

  describe('a one-time bill (null recurrence_unit)', () => {
    const oneTime = { recurrence_unit: null, interval: 1, anchor_date: '2026-06-01' };

    it('logs its single occurrence once due and on or after created_at', () => {
      expect(
        autopayOccurrences({ ...oneTime, created_date: '2026-06-01', today: '2026-06-02' }),
      ).toEqual(['2026-06-01']);
    });

    it('never backfills a one-time bill created after its own anchor date', () => {
      expect(
        autopayOccurrences({ ...oneTime, created_date: '2026-06-02', today: '2026-06-10' }),
      ).toEqual([]);
    });

    it('logs nothing before the date arrives', () => {
      expect(
        autopayOccurrences({ ...oneTime, created_date: '2026-06-01', today: '2026-05-01' }),
      ).toEqual([]);
    });
  });
});
