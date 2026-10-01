import { describe, expect, it } from 'vitest';
import {
  occurrenceDate,
  occurrenceIndexAtOrAfter,
  occurrenceIndexAtOrBefore,
  previewOccurrences,
} from './occurrence.js';
import type { Recurrence } from './types.js';

describe('occurrenceDate', () => {
  describe('every unit and several intervals', () => {
    const cases: { name: string; recurrence: Recurrence; index: number; expected: string }[] = [
      // day
      {
        name: 'day, interval 1, k=0',
        recurrence: { unit: 'day', interval: 1, anchorDate: '2026-01-01' },
        index: 0,
        expected: '2026-01-01',
      },
      {
        name: 'day, interval 1, k=1',
        recurrence: { unit: 'day', interval: 1, anchorDate: '2026-01-01' },
        index: 1,
        expected: '2026-01-02',
      },
      {
        name: 'day, interval 3, k=2',
        recurrence: { unit: 'day', interval: 3, anchorDate: '2026-01-01' },
        index: 2,
        expected: '2026-01-07',
      },
      {
        name: 'day, interval 1, crosses month',
        recurrence: { unit: 'day', interval: 1, anchorDate: '2026-01-31' },
        index: 1,
        expected: '2026-02-01',
      },
      // week
      {
        name: 'week, interval 1, k=1',
        recurrence: { unit: 'week', interval: 1, anchorDate: '2026-01-01' },
        index: 1,
        expected: '2026-01-08',
      },
      {
        name: 'week, interval 2, k=3',
        recurrence: { unit: 'week', interval: 2, anchorDate: '2026-01-01' },
        index: 3,
        expected: '2026-02-12',
      },
      // month, no clamping needed
      {
        name: 'month, interval 1, k=1 (15th)',
        recurrence: { unit: 'month', interval: 1, anchorDate: '2026-03-15' },
        index: 1,
        expected: '2026-04-15',
      },
      {
        name: 'month, interval 3, k=2',
        recurrence: { unit: 'month', interval: 3, anchorDate: '2026-01-10' },
        index: 2,
        expected: '2026-07-10',
      },
      // year, no clamping needed
      {
        name: 'year, interval 1, k=2',
        recurrence: { unit: 'year', interval: 1, anchorDate: '2024-06-15' },
        index: 2,
        expected: '2026-06-15',
      },
      {
        name: 'year, interval 2, k=1',
        recurrence: { unit: 'year', interval: 2, anchorDate: '2024-06-15' },
        index: 1,
        expected: '2026-06-15',
      },
    ];

    it.each(cases)('$name', ({ recurrence, index, expected }) => {
      expect(occurrenceDate(recurrence, index)).toBe(expected);
    });
  });

  describe('month-end clamping — a 31st anchor through February and back to March', () => {
    it('non-leap year: Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31', () => {
      const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2025-01-31' };
      expect(occurrenceDate(recurrence, 0)).toBe('2025-01-31');
      expect(occurrenceDate(recurrence, 1)).toBe('2025-02-28');
      expect(occurrenceDate(recurrence, 2)).toBe('2025-03-31');
      expect(occurrenceDate(recurrence, 3)).toBe('2025-04-30');
      expect(occurrenceDate(recurrence, 4)).toBe('2025-05-31');
    });

    it('leap year: Jan 31 -> Feb 29 -> Mar 31', () => {
      const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2024-01-31' };
      expect(occurrenceDate(recurrence, 0)).toBe('2024-01-31');
      expect(occurrenceDate(recurrence, 1)).toBe('2024-02-29');
      expect(occurrenceDate(recurrence, 2)).toBe('2024-03-31');
    });

    it('clamp is computed fresh from the anchor each time, never from the previous clamped date', () => {
      // If Feb's clamped 28th were carried forward as the new "anchor day", March would also clamp
      // to the 28th. It must not: March gets the 31st back, straight from the original anchor.
      const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2025-01-31' };
      expect(occurrenceDate(recurrence, 2)).toBe('2025-03-31');
    });

    it('clamps past the 28th generally (30th anchor through February)', () => {
      const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2025-03-30' };
      // index 0 = Mar 30; index 11 = next Feb (non-leap 2026)
      expect(occurrenceDate(recurrence, 11)).toBe('2026-02-28');
    });
  });

  describe('leap years', () => {
    it('yearly anchor on Feb 29 gives Feb 28 in non-leap years, Feb 29 in leap years', () => {
      const recurrence: Recurrence = { unit: 'year', interval: 1, anchorDate: '2024-02-29' };
      expect(occurrenceDate(recurrence, 0)).toBe('2024-02-29'); // 2024 leap
      expect(occurrenceDate(recurrence, 1)).toBe('2025-02-28'); // 2025 non-leap
      expect(occurrenceDate(recurrence, 2)).toBe('2026-02-28'); // 2026 non-leap
      expect(occurrenceDate(recurrence, 4)).toBe('2028-02-29'); // 2028 leap
    });

    it('monthly recurrence through a Feb 29 behaves like any other clamp', () => {
      const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2023-12-31' };
      // index 2 = Feb 2024 (leap)
      expect(occurrenceDate(recurrence, 2)).toBe('2024-02-29');
    });

    it('century non-leap year (2100) still clamps correctly', () => {
      const recurrence: Recurrence = { unit: 'year', interval: 1, anchorDate: '2096-02-29' };
      // 2096 is leap (divisible by 4, not a century), 2100 is not leap (century, not div by 400)
      expect(occurrenceDate(recurrence, 0)).toBe('2096-02-29');
      expect(occurrenceDate(recurrence, 4)).toBe('2100-02-28');
    });
  });

  describe('validation', () => {
    it('rejects a non-positive interval', () => {
      expect(() =>
        occurrenceDate({ unit: 'day', interval: 0, anchorDate: '2026-01-01' }, 0),
      ).toThrow(RangeError);
    });

    it('rejects a negative index', () => {
      expect(() =>
        occurrenceDate({ unit: 'day', interval: 1, anchorDate: '2026-01-01' }, -1),
      ).toThrow(RangeError);
    });
  });
});

describe('occurrenceIndexAtOrBefore', () => {
  it('returns null when the date is before the anchor', () => {
    const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2026-03-15' };
    expect(occurrenceIndexAtOrBefore(recurrence, '2026-03-14')).toBeNull();
  });

  it('returns 0 on the anchor date itself', () => {
    const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2026-03-15' };
    expect(occurrenceIndexAtOrBefore(recurrence, '2026-03-15')).toBe(0);
  });

  it('finds the right index for a daily recurrence far from the anchor', () => {
    const recurrence: Recurrence = { unit: 'day', interval: 3, anchorDate: '2026-01-01' };
    // index 100 = anchor + 300 days = 2026-10-28
    expect(occurrenceIndexAtOrBefore(recurrence, '2026-10-28')).toBe(100);
    expect(occurrenceIndexAtOrBefore(recurrence, '2026-10-29')).toBe(100);
    expect(occurrenceIndexAtOrBefore(recurrence, '2026-10-30')).toBe(100);
    expect(occurrenceIndexAtOrBefore(recurrence, '2026-10-31')).toBe(101);
  });

  it('finds the right index across month-end clamping', () => {
    const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2025-01-31' };
    expect(occurrenceIndexAtOrBefore(recurrence, '2025-02-28')).toBe(1);
    expect(occurrenceIndexAtOrBefore(recurrence, '2025-03-01')).toBe(1);
    expect(occurrenceIndexAtOrBefore(recurrence, '2025-03-31')).toBe(2);
  });
});

describe('occurrenceIndexAtOrAfter', () => {
  it('returns 0 when the date precedes the anchor', () => {
    const recurrence: Recurrence = { unit: 'week', interval: 1, anchorDate: '2026-05-01' };
    expect(occurrenceIndexAtOrAfter(recurrence, '2026-04-01')).toBe(0);
  });

  it('returns the exact index when the date is an occurrence', () => {
    const recurrence: Recurrence = { unit: 'week', interval: 1, anchorDate: '2026-05-01' };
    expect(occurrenceIndexAtOrAfter(recurrence, '2026-05-08')).toBe(1);
  });

  it('returns the next index when the date falls between occurrences', () => {
    const recurrence: Recurrence = { unit: 'week', interval: 1, anchorDate: '2026-05-01' };
    expect(occurrenceIndexAtOrAfter(recurrence, '2026-05-10')).toBe(2); // next occurrence is 05-15
  });
});

describe('previewOccurrences', () => {
  it('returns the next N occurrence dates starting at the anchor', () => {
    const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2026-01-31' };
    expect(previewOccurrences(recurrence, 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('returns an empty array for count 0', () => {
    const recurrence: Recurrence = { unit: 'day', interval: 1, anchorDate: '2026-01-01' };
    expect(previewOccurrences(recurrence, 0)).toEqual([]);
  });

  it('rejects a negative count', () => {
    const recurrence: Recurrence = { unit: 'day', interval: 1, anchorDate: '2026-01-01' };
    expect(() => previewOccurrences(recurrence, -1)).toThrow(RangeError);
  });
});
