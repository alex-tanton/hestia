import { describe, expect, it } from 'vitest';
import { currentChoreOccurrence, occurrenceToComplete } from './chores.js';
import type { Recurrence } from './types.js';

describe('currentChoreOccurrence', () => {
  const weekly: Recurrence = { unit: 'week', interval: 1, anchorDate: '2026-01-04' }; // a Sunday

  it('the first occurrence is current before it has arrived', () => {
    const result = currentChoreOccurrence(weekly, new Set(), '2026-01-01');
    expect(result).toEqual({
      occurrenceDate: '2026-01-04',
      occurrenceIndex: 0,
      isCompleted: false,
      isOverdue: false,
    });
  });

  it('the latest arrived occurrence is current, and overdue once uncompleted past its date', () => {
    const result = currentChoreOccurrence(weekly, new Set(), '2026-01-10');
    expect(result.occurrenceDate).toBe('2026-01-04');
    expect(result.isOverdue).toBe(true);
  });

  it('is not overdue on the due date itself', () => {
    const result = currentChoreOccurrence(weekly, new Set(), '2026-01-04');
    expect(result.isOverdue).toBe(false);
  });

  describe('rolling forward past a missed occurrence', () => {
    it('once the next occurrence arrives, the missed earlier one stops being due', () => {
      // Jan 4 was never completed. By Jan 11 (the next occurrence), current moves to Jan 11,
      // and Jan 4 is never backfilled or surfaced again.
      const result = currentChoreOccurrence(weekly, new Set(), '2026-01-11');
      expect(result.occurrenceDate).toBe('2026-01-11');
      expect(result.occurrenceIndex).toBe(1);
      expect(result.isCompleted).toBe(false);
    });

    it('several missed occurrences in a row still roll forward to the latest, not stacking up', () => {
      const result = currentChoreOccurrence(weekly, new Set(), '2026-02-15'); // ~6 weeks later
      expect(result.occurrenceDate).toBe('2026-02-15');
    });
  });

  it('a completed current occurrence is reflected as completed, not overdue', () => {
    const result = currentChoreOccurrence(weekly, new Set(['2026-01-04']), '2026-01-10');
    expect(result.isCompleted).toBe(true);
    expect(result.isOverdue).toBe(false);
  });
});

describe('occurrenceToComplete', () => {
  const weekly: Recurrence = { unit: 'week', interval: 1, anchorDate: '2026-01-04' };

  it('closes the current occurrence when it is open (the normal, on-time or late case)', () => {
    expect(occurrenceToComplete(weekly, new Set(), '2026-01-10')).toBe('2026-01-04');
  });

  it('a completion recorded after the due date still closes that occurrence, never a later one', () => {
    // Overdue by 3 days, but still within the same occurrence's window (next isn't due until
    // Jan 11). Still closes the occurrence that was due, not a date derived from today.
    expect(occurrenceToComplete(weekly, new Set(), '2026-01-07')).toBe('2026-01-04');
  });

  describe('early completion closes the upcoming occurrence', () => {
    it('completing before the current occurrence has arrived closes the first occurrence', () => {
      expect(occurrenceToComplete(weekly, new Set(), '2026-01-01')).toBe('2026-01-04');
    });

    it('completing twice in the same window closes the next occurrence early (current already completed)', () => {
      // Current (Jan 4) is already completed; a second completion today is early for Jan 11.
      const completed = new Set(['2026-01-04']);
      expect(occurrenceToComplete(weekly, completed, '2026-01-06')).toBe('2026-01-11');
    });

    it('skips over any occurrences already completed ahead of time to find the earliest open one', () => {
      const completed = new Set(['2026-01-04', '2026-01-11']);
      expect(occurrenceToComplete(weekly, completed, '2026-01-06')).toBe('2026-01-18');
    });
  });

  it('late completion does not shift the series: the occurrence after stays anchor-derived', () => {
    // Jan 4 completed late, on Jan 9. The next current occurrence is still Jan 11 (anchor + 1
    // week), not Jan 9 + 1 week.
    const completed = new Set(['2026-01-04']);
    const next = currentChoreOccurrence(
      { unit: 'week', interval: 1, anchorDate: '2026-01-04' },
      completed,
      '2026-01-11',
    );
    expect(next.occurrenceDate).toBe('2026-01-11');
  });
});

describe('deleting the most recent completion (composability, no dedicated undo function needed)', () => {
  const monthly: Recurrence = { unit: 'month', interval: 1, anchorDate: '2026-01-01' };

  it('removing the latest completion from the set reopens its occurrence and moves "current" back', () => {
    // Two completions so far: Jan 1 and Feb 1 (on time). Today is Feb 20.
    const withBoth = new Set(['2026-01-01', '2026-02-01']);
    const before = currentChoreOccurrence(monthly, withBoth, '2026-02-20');
    expect(before.occurrenceDate).toBe('2026-02-01');
    expect(before.isCompleted).toBe(true);

    // Undo = re-run the same pure functions with the most recent completion (Feb 1) removed.
    const withoutLatest = new Set(['2026-01-01']);
    const after = currentChoreOccurrence(monthly, withoutLatest, '2026-02-20');
    expect(after.occurrenceDate).toBe('2026-02-01');
    expect(after.isCompleted).toBe(false);
    expect(after.isOverdue).toBe(true);

    // And the next completion recorded now closes Feb 1 again, exactly as it did before the undo.
    expect(occurrenceToComplete(monthly, withoutLatest, '2026-02-20')).toBe('2026-02-01');
  });
});
