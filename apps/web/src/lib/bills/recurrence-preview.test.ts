import { describe, expect, it } from 'vitest';
import { previewDueDates, recurrencePreviewSentence } from './recurrence-preview.ts';

describe('previewDueDates', () => {
  it('previews the next three occurrences from the anchor for a monthly bill', () => {
    expect(previewDueDates({ unit: 'month', interval: 1, anchorDate: '2026-01-01' })).toEqual([
      '01/01/2026',
      '02/01/2026',
      '03/01/2026',
    ]);
  });

  it('clamps a month-end anchor the same way the service does (PRD › "Recurrence")', () => {
    expect(previewDueDates({ unit: 'month', interval: 1, anchorDate: '2026-01-31' })).toEqual([
      '01/31/2026',
      '02/28/2026',
      '03/31/2026',
    ]);
  });

  it('respects an interval greater than one', () => {
    expect(previewDueDates({ unit: 'week', interval: 2, anchorDate: '2026-01-01' })).toEqual([
      '01/01/2026',
      '01/15/2026',
      '01/29/2026',
    ]);
  });

  it('a one-time bill (null unit) previews only the anchor date', () => {
    expect(previewDueDates({ unit: null, interval: 1, anchorDate: '2026-03-12' })).toEqual([
      '03/12/2026',
    ]);
  });

  it('returns nothing for an incomplete or invalid draft, rather than guessing', () => {
    expect(previewDueDates({ unit: 'month', interval: 1, anchorDate: '' })).toEqual([]);
    expect(previewDueDates({ unit: 'month', interval: 0, anchorDate: '2026-01-01' })).toEqual([]);
    expect(previewDueDates({ unit: 'month', interval: 1, anchorDate: 'not-a-date' })).toEqual([]);
  });
});

describe('recurrencePreviewSentence', () => {
  it('names all three dates for a recurring bill', () => {
    expect(
      recurrencePreviewSentence({ unit: 'month', interval: 1, anchorDate: '2026-01-01' }),
    ).toBe('Next due dates: 01/01/2026, 02/01/2026, and 03/01/2026.');
  });

  it('names the single date for a one-time bill', () => {
    expect(recurrencePreviewSentence({ unit: null, interval: 1, anchorDate: '2026-03-12' })).toBe(
      'Due once, on 03/12/2026.',
    );
  });

  it('is undefined until the draft previews something', () => {
    expect(
      recurrencePreviewSentence({ unit: 'month', interval: 1, anchorDate: '' }),
    ).toBeUndefined();
  });
});
