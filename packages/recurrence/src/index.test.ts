import { describe, expect, it } from 'vitest';
import {
  currentBillOccurrence,
  currentChoreOccurrence,
  currentTurn,
  occurrenceDate,
  occurrenceToComplete,
  previewOccurrences,
  rebaseRotationOnDeparture,
  type Recurrence,
} from './index.js';

// Confirms the package's public entry point (`index.ts`) actually re-exports a working surface,
// as opposed to internal modules whose own tests import the implementation files directly.
describe('public API surface', () => {
  const recurrence: Recurrence = { unit: 'month', interval: 1, anchorDate: '2026-01-31' };

  it('exposes occurrence derivation', () => {
    expect(occurrenceDate(recurrence, 1)).toBe('2026-02-28');
  });

  it('exposes the preview helper', () => {
    expect(previewOccurrences(recurrence, 2)).toEqual(['2026-01-31', '2026-02-28']);
  });

  it('exposes bill current-occurrence logic', () => {
    expect(currentBillOccurrence(recurrence, new Set(), '2026-02-01').isOverdue).toBe(true);
  });

  it('exposes chore current-occurrence and completion-placement logic', () => {
    expect(currentChoreOccurrence(recurrence, new Set(), '2026-01-31').occurrenceDate).toBe(
      '2026-01-31',
    );
    expect(occurrenceToComplete(recurrence, new Set(), '2026-01-31')).toBe('2026-01-31');
  });

  it('exposes rotation turn and departure rebasing', () => {
    expect(currentTurn(['a', 'b', 'c'], 0, 1)).toBe('b');
    expect(rebaseRotationOnDeparture(['a', 'b', 'c'], 0, 1, 0).rotationOrder).toEqual(['b', 'c']);
  });
});
