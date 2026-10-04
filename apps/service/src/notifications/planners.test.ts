import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  billRemindersDueToday,
  isSaturday,
  listBatchSendAt,
  localDate,
  planListBatch,
  weekdayOf,
} from './planners.js';

const MINUTE = 60_000;
const at = (minutes: number): Date => new Date(Date.UTC(2026, 9, 4, 12, 0) + minutes * MINUTE);

describe('list batch window', () => {
  it('sends five minutes after the last addition while that is the earlier bound', () => {
    expect(listBatchSendAt(at(0), at(1))).toStrictEqual(at(6));
  });

  it('never sends more than fifteen minutes after the first addition', () => {
    expect(listBatchSendAt(at(0), at(12))).toStrictEqual(at(15));
    expect(listBatchSendAt(at(0), at(40))).toStrictEqual(at(15));
  });

  it('keeps the batch open when an addition joins it, with the first addition’s key', () => {
    const plan = planListBatch({ key: at(0).toISOString(), firstAt: at(0) }, at(4));

    expect(plan.startsNew).toBe(false);
    expect(plan.key).toBe(at(0).toISOString());
    expect(plan.firstAt).toStrictEqual(at(0));
    expect(plan.sendAt).toStrictEqual(at(9));
  });

  it('opens a batch keyed by its own time when none is open, so a sent batch is never reopened', () => {
    const sentKey = at(0).toISOString();
    const plan = planListBatch(null, at(30));

    expect(plan.startsNew).toBe(true);
    expect(plan.key).toBe(at(30).toISOString());
    expect(plan.key).not.toBe(sentKey);
    expect(plan.firstAt).toStrictEqual(at(30));
    expect(plan.sendAt).toStrictEqual(at(35));
  });
});

describe('calendar dates', () => {
  it('moves a date across month, year, and leap-day boundaries', () => {
    expect(addCalendarDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCalendarDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('reads the calendar date in the named timezone, not in UTC', () => {
    // 02:30 UTC on the 4th is still the evening of the 3rd in New York.
    const instant = new Date('2026-10-04T02:30:00Z');
    expect(localDate(instant, 'America/New_York')).toBe('2026-10-03');
    expect(localDate(instant, 'Asia/Tokyo')).toBe('2026-10-04');
  });

  it('knows Saturday and weekday names without a timezone', () => {
    expect(isSaturday('2026-10-03')).toBe(true);
    expect(isSaturday('2026-10-04')).toBe(false);
    expect(weekdayOf('2026-10-09')).toBe('Friday');
  });
});

describe('weekly nudge day', () => {
  it('is the household’s Saturday, even where a member is still on the Friday', () => {
    // Saturday 10:00 in Auckland is Friday 14:00 in Los Angeles at the same instant.
    const instant = new Date('2026-10-09T21:00:00Z');
    expect(isSaturday(localDate(instant, 'Pacific/Auckland'))).toBe(true);
    expect(isSaturday(localDate(instant, 'America/Los_Angeles'))).toBe(false);
  });
});

describe('bill reminder planner', () => {
  const monthly = { unit: 'month' as const, interval: 1, anchorDate: '2026-01-15' };

  it('sends the due-date reminder on an occurrence, and no advance reminder before it', () => {
    expect(
      billRemindersDueToday({
        recurrence: monthly,
        anchorDate: '2026-01-15',
        today: '2026-10-15',
        reminderDaysBefore: 3,
      }),
    ).toStrictEqual([{ occurrenceDate: '2026-10-15', kind: 'due' }]);
  });

  it('sends the advance reminder reminder_days_before days ahead of an occurrence', () => {
    expect(
      billRemindersDueToday({
        recurrence: monthly,
        anchorDate: '2026-01-15',
        today: '2026-10-12',
        reminderDaysBefore: 3,
      }),
    ).toStrictEqual([{ occurrenceDate: '2026-10-15', kind: 'advance' }]);
  });

  it('sends nothing on a day that is neither an occurrence nor reminder_days_before before one', () => {
    expect(
      billRemindersDueToday({
        recurrence: monthly,
        anchorDate: '2026-01-15',
        today: '2026-10-04',
        reminderDaysBefore: 3,
      }),
    ).toStrictEqual([]);
  });

  it('sends only the due-date reminder when reminder_days_before is zero', () => {
    expect(
      billRemindersDueToday({
        recurrence: monthly,
        anchorDate: '2026-01-15',
        today: '2026-10-15',
        reminderDaysBefore: 0,
      }),
    ).toStrictEqual([{ occurrenceDate: '2026-10-15', kind: 'due' }]);
  });

  it('treats a one-time bill as one occurrence, on its anchor date', () => {
    expect(
      billRemindersDueToday({
        recurrence: null,
        anchorDate: '2026-10-07',
        today: '2026-10-04',
        reminderDaysBefore: 3,
      }),
    ).toStrictEqual([{ occurrenceDate: '2026-10-07', kind: 'advance' }]);
  });
});
