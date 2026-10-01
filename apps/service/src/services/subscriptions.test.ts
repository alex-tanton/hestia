import { describe, expect, it } from 'vitest';
import { monthlyCents, needsUsageConfirmation } from './subscriptions.js';

/*
 * The money-normalization table (PRD, "Subscriptions view") and the 60-day-unconfirmed boundary,
 * pure logic (Engineering Practices, "Testing"). Every division rounds half-up to the cent.
 */

describe('monthlyCents', () => {
  it('month: amount ÷ interval, exact when the interval is 1', () => {
    expect(monthlyCents(7499, 'month', 1)).toBe(7499); // Spectrum Internet, $74.99
    expect(monthlyCents(1199, 'month', 1)).toBe(1199); // Spotify, $11.99
  });

  it('month: divides by the interval, half-up', () => {
    // $30.00 billed every 2 months is $15.00/month, exact.
    expect(monthlyCents(3000, 'month', 2)).toBe(1500);
    // $10.00 billed every 3 months is $3.333.../month -> rounds to $3.33.
    expect(monthlyCents(1000, 'month', 3)).toBe(333);
  });

  it('week: amount × 52 ÷ 12 ÷ interval', () => {
    // $10.00/week -> 1000 * 52 / 12 = 4333.33... -> 4333 (rounds down, .33 < .5).
    expect(monthlyCents(1000, 'week', 1)).toBe(4333);
    // $12.00/week -> 1200 * 52 / 12 = 5200 exactly.
    expect(monthlyCents(1200, 'week', 1)).toBe(5200);
    // Every 2 weeks: 1000 * 52 / 24 = 2166.66... -> 2167 (half-up).
    expect(monthlyCents(1000, 'week', 2)).toBe(2167);
  });

  it('year: amount ÷ 12 ÷ interval', () => {
    // $186.00/year -> 18600 / 12 = 1550 exactly.
    expect(monthlyCents(18600, 'year', 1)).toBe(1550);
    // $100.00/year -> 10000 / 12 = 833.33... -> 833.
    expect(monthlyCents(10000, 'year', 1)).toBe(833);
    // $100.00 every 2 years -> 10000 / 24 = 416.66... -> 417 (half-up).
    expect(monthlyCents(10000, 'year', 2)).toBe(417);
  });

  it('day: amount × 365 ÷ 12 ÷ interval', () => {
    // $1.00/day -> 100 * 365 / 12 = 3041.66... -> 3042 (half-up).
    expect(monthlyCents(100, 'day', 1)).toBe(3042);
  });

  it('a one-time bill (null unit) has no recurring cost', () => {
    expect(monthlyCents(5000, null, 1)).toBe(0);
  });

  it('rounds exactly .5 up, not to even (half-up, not banker’s rounding)', () => {
    // 1 / 2 = 0.5 -> 1, every time, regardless of whether the quotient so far is even or odd.
    expect(monthlyCents(1, 'month', 2)).toBe(1);
    expect(monthlyCents(3, 'month', 2)).toBe(2); // 1.5 -> 2
  });
});

describe('needsUsageConfirmation', () => {
  it('is false just under 60 calendar days', () => {
    expect(needsUsageConfirmation('2026-03-01', '2026-01-01')).toBe(false); // 59 days
  });

  it('is true at exactly 60 calendar days', () => {
    expect(needsUsageConfirmation('2026-03-02', '2026-01-01')).toBe(true); // 60 days
  });

  it('is true well past 60 days (Seed Data: Sam’s Adobe subscription, confirmed 70 days ago)', () => {
    expect(needsUsageConfirmation('2026-09-30', '2026-07-22')).toBe(true); // 70 days
  });

  it('is false the moment it has just been confirmed', () => {
    expect(needsUsageConfirmation('2026-01-01', '2026-01-01')).toBe(false);
  });
});
