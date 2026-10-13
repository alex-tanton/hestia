import { describe, expect, it, vi } from 'vitest';
import { addDays, currentInstant, dateInZone, daysBetween, householdDate } from './zone-dates.js';

// 02:00Z on the 15th is still the evening of the 14th in New York (UTC-4 in October), so the UTC
// calendar and the household calendar name different days.
const STRADDLE = new Date('2026-10-15T02:00:00.000Z');

describe('dateInZone', () => {
  it('names the household date, not the UTC date, around the household’s midnight', () => {
    expect(STRADDLE.toISOString().slice(0, 10)).toBe('2026-10-15');
    expect(dateInZone('America/New_York', STRADDLE)).toBe('2026-10-14');
  });

  it('puts the same instant on different dates in Kiritimati (UTC+14) and Pago Pago (UTC-11)', () => {
    const noon = new Date('2026-10-14T12:00:00.000Z');
    expect(dateInZone('Pacific/Kiritimati', noon)).toBe('2026-10-15');
    expect(dateInZone('Pacific/Pago_Pago', noon)).toBe('2026-10-14');
  });
});

describe('addDays', () => {
  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('moves back across a month boundary and the US spring-forward date', () => {
    expect(addDays('2026-03-08', -1)).toBe('2026-03-07');
  });

  it('counts calendar days over the US fall-back date', () => {
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2027-01-01', '2026-12-31')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(-1);
  });
});

describe('householdDate', () => {
  it('offsets the household’s own today, which the UTC calendar mis-dates around midnight', () => {
    expect(householdDate('America/New_York', -1, STRADDLE)).toBe('2026-10-13');
    expect(householdDate('America/New_York', 0, STRADDLE)).toBe('2026-10-14');
    expect(householdDate('America/New_York', 3, STRADDLE)).toBe('2026-10-17');
  });

  it('reads the zone the caller names', () => {
    const noon = new Date('2026-10-14T12:00:00.000Z');
    expect(householdDate('Pacific/Kiritimati', 0, noon)).toBe('2026-10-15');
    expect(householdDate('Pacific/Pago_Pago', 0, noon)).toBe('2026-10-14');
  });
});

describe('currentInstant', () => {
  it('is the process clock: the instant a unit test pins is the instant it returns', () => {
    // The shared pin follows `vi.setSystemTime`, so a test chooses its own instant this way.
    vi.setSystemTime(STRADDLE);
    expect(vi.getMockedSystemTime()?.getTime()).toBe(STRADDLE.getTime());
    expect(currentInstant().getTime()).toBe(STRADDLE.getTime());
  });
});
