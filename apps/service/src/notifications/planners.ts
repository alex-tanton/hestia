import type { CalendarDate, Recurrence } from '@hestia/recurrence';
import { isValidOccurrence } from '../chores/occurrence.js';

/*
 * The pure rules behind the notification producers. Nothing here touches the database: the jobs and
 * services read the facts, ask these functions what to write, and write it.
 */

const MINUTE_MS = 60_000;

/** A batch's send time is five minutes after its last addition, but never more than fifteen after its first. */
export const LIST_BATCH_QUIET_MS = 5 * MINUTE_MS;
export const LIST_BATCH_MAX_MS = 15 * MINUTE_MS;

/** `send_after` for a list batch: `least(last_add + 5 minutes, first_add + 15 minutes)`. */
export function listBatchSendAt(firstAt: Date, lastAt: Date): Date {
  return new Date(
    Math.min(lastAt.getTime() + LIST_BATCH_QUIET_MS, firstAt.getTime() + LIST_BATCH_MAX_MS),
  );
}

export interface OpenListBatch {
  /** The batch's `occurrence_key`, which is its start timestamp. */
  key: string;
  firstAt: Date;
}

export interface ListBatchPlan {
  key: string;
  firstAt: Date;
  sendAt: Date;
  /** True when this addition opens a batch rather than joining the open one. */
  startsNew: boolean;
}

/**
 * Where an addition goes. A batch that is still unsent takes the addition and keeps its key; when
 * no batch is open (none exists, or the last one was sent), the addition opens a new batch keyed
 * by its own time. Sent batches are never reopened, so a later addition never resends one.
 */
export function planListBatch(open: OpenListBatch | null, at: Date): ListBatchPlan {
  const firstAt = open === null ? at : open.firstAt;
  return {
    key: open === null ? at.toISOString() : open.key,
    firstAt,
    sendAt: listBatchSendAt(firstAt, at),
    startsNew: open === null,
  };
}

/** `date` moved by whole days, computed in UTC so no timezone can shift a calendar date. */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day) + days * 24 * 60 * MINUTE_MS)
    .toISOString()
    .slice(0, 10);
}

/** The calendar date `instant` falls on in `timezone`. */
export function localDate(instant: Date, timezone: string): CalendarDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function weekdayOf(date: CalendarDate): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

/** Whether `date` is a Saturday, the day the weekly nudge goes out. */
export function isSaturday(date: CalendarDate): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 6;
}

export interface BillScheduleInput {
  /** Null for a one-time bill, whose only occurrence is its anchor date. */
  recurrence: Recurrence | null;
  anchorDate: CalendarDate;
  /** "Today" in the bill's own timezone. */
  today: CalendarDate;
  reminderDaysBefore: number;
}

export interface BillReminderDue {
  occurrenceDate: CalendarDate;
  kind: 'advance' | 'due';
}

function isOccurrence(input: BillScheduleInput, date: CalendarDate): boolean {
  if (input.recurrence === null) return date === input.anchorDate;
  return isValidOccurrence(input.recurrence, date);
}

/**
 * The bill reminders whose send day is `today`: the due-date reminder when today is an occurrence,
 * and the advance reminder when an occurrence falls `reminderDaysBefore` days ahead. With zero days
 * the advance reminder would land on the due date itself, so only the due-date reminder is sent.
 */
export function billRemindersDueToday(input: BillScheduleInput): BillReminderDue[] {
  const due: BillReminderDue[] = [];
  if (isOccurrence(input, input.today)) {
    due.push({ occurrenceDate: input.today, kind: 'due' });
  }
  if (input.reminderDaysBefore > 0) {
    const advanced = addCalendarDays(input.today, input.reminderDaysBefore);
    if (isOccurrence(input, advanced)) {
      due.push({ occurrenceDate: advanced, kind: 'advance' });
    }
  }
  return due;
}
