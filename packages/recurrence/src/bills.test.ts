import { describe, expect, it } from 'vitest';
import { currentBillOccurrence } from './bills.js';
import type { Recurrence } from './types.js';

describe('currentBillOccurrence', () => {
  const monthly: Recurrence = { unit: 'month', interval: 1, anchorDate: '2026-01-15' };

  it('the earliest occurrence with no log row is current', () => {
    const result = currentBillOccurrence(monthly, new Set(), '2026-01-20');
    expect(result).toEqual({ occurrenceDate: '2026-01-15', occurrenceIndex: 0, isOverdue: true });
  });

  it('stays overdue until paid, not just until due date passes further', () => {
    const result = currentBillOccurrence(monthly, new Set(), '2026-03-01');
    expect(result.occurrenceDate).toBe('2026-01-15');
    expect(result.isOverdue).toBe(true);
  });

  it('is not overdue on its due date, only strictly after', () => {
    const result = currentBillOccurrence(monthly, new Set(), '2026-01-15');
    expect(result.isOverdue).toBe(false);
  });

  it('is not overdue before its due date', () => {
    const result = currentBillOccurrence(monthly, new Set(), '2026-01-01');
    expect(result.isOverdue).toBe(false);
  });

  describe('late payment does not shift the series', () => {
    it('a bill paid late (after due date) advances to the anchor-derived next occurrence, not completion + interval', () => {
      // Paid on 2026-02-10, nearly a month late.
      const resolved = new Set(['2026-01-15']);
      const result = currentBillOccurrence(monthly, resolved, '2026-02-10');
      // Next due is the anchor's Feb occurrence (Feb 15), never Feb 10 + interval.
      expect(result.occurrenceDate).toBe('2026-02-15');
      expect(result.occurrenceIndex).toBe(1);
    });
  });

  it('a skip resolves an occurrence exactly like a payment, for the purposes of finding current', () => {
    // This package doesn't distinguish paid from skipped — the caller supplies only "resolved".
    const resolved = new Set(['2026-01-15']);
    const result = currentBillOccurrence(monthly, resolved, '2026-02-01');
    expect(result.occurrenceDate).toBe('2026-02-15');
  });

  it('skips over multiple resolved occurrences to find the earliest unresolved one', () => {
    const resolved = new Set(['2026-01-15', '2026-02-15', '2026-03-15']);
    const result = currentBillOccurrence(monthly, resolved, '2026-04-01');
    expect(result.occurrenceDate).toBe('2026-04-15');
    expect(result.occurrenceIndex).toBe(3);
  });

  it('a one-time-bill-like single occurrence (interval irrelevant, index 0 only queried) is overdue correctly', () => {
    const recurrence: Recurrence = { unit: 'year', interval: 1, anchorDate: '2026-06-01' };
    const result = currentBillOccurrence(recurrence, new Set(), '2026-06-02');
    expect(result).toEqual({ occurrenceDate: '2026-06-01', occurrenceIndex: 0, isOverdue: true });
  });
});
