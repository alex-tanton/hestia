import type { Chore, Member, RecurrenceUnit } from '@hestia/shared';
import { addDays, weekStart } from '../../lib/household-date.ts';

/*
 * Copy and pure formatting for the Chores pillar (never nag; no gamification in chores: no
 * streaks, points, badges, or motivational copy). Every string a member reads states a fact,
 * never a feeling — "Last done 5 weeks ago", never "You're behind!" — and overdue is carried by
 * the danger color plus the word "Overdue", never by color alone.
 */

export const OFFLINE_ACTION_REASON = 'Needs a connection.';

export const CHORES_EMPTY_COPY = 'No chores yet. Add one to start tracking what needs doing.';
export const ERRANDS_EMPTY_COPY = 'No errands yet. Add one to keep track of it.';
export const ERRANDS_ALL_DONE_COPY = 'Nothing open. Everything is done.';

export type ChoreGroupKey = 'overdue' | 'today' | 'thisWeek' | 'later';

/** The assignee choice that clears a single assignment; a Radix option cannot carry an empty value. */
export const UNASSIGNED_LABEL = 'Unassigned';
export const ROTATION_EMPTY_COPY = 'No one in the rotation yet.';
export const ROTATION_REQUIRED_ERROR = 'Add at least one member to the rotation.';

export const CHORE_GROUP_LABELS: Readonly<Record<ChoreGroupKey, string>> = {
  overdue: 'Overdue',
  today: 'Today',
  thisWeek: 'This week',
  later: 'Later',
};

export const CHORE_GROUP_ORDER: readonly ChoreGroupKey[] = [
  'overdue',
  'today',
  'thisWeek',
  'later',
];

/**
 * Overdue/Today/This week/Later, computed from each chore's own `dueDate` and `isOverdue` against
 * "today" in the household timezone. "This week" runs through Saturday of the current week
 * (weeks start Sunday), the same boundary the week planner uses.
 */
export function groupChores(
  chores: readonly Chore[],
  today: string,
): Record<ChoreGroupKey, Chore[]> {
  const weekEnd = addDays(weekStart(today), 6);
  const groups: Record<ChoreGroupKey, Chore[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
  };
  for (const chore of chores) {
    if (chore.isOverdue) groups.overdue.push(chore);
    else if (chore.dueDate === today) groups.today.push(chore);
    else if (chore.dueDate <= weekEnd) groups.thisWeek.push(chore);
    else groups.later.push(chore);
  }
  for (const key of CHORE_GROUP_ORDER) {
    groups[key].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
  }
  return groups;
}

const UNIT_LABEL: Readonly<Record<RecurrenceUnit, { one: string; many: string }>> = {
  day: { one: 'day', many: 'days' },
  week: { one: 'week', many: 'weeks' },
  month: { one: 'month', many: 'months' },
  year: { one: 'year', many: 'years' },
};

/** "Every week", "Every 3 days" — the recurrence summary. */
export function describeRecurrence(unit: RecurrenceUnit, interval: number): string {
  const label = UNIT_LABEL[unit];
  return interval === 1 ? `Every ${label.one}` : `Every ${String(interval)} ${label.many}`;
}

/** "today", "tomorrow", "in 5 days" — never used for an overdue date; see `formatOverdue`. */
export function formatDueIn(dueDate: string, today: string): string {
  if (dueDate === today) return 'today';
  if (dueDate === addDays(today, 1)) return 'tomorrow';
  const days = daysBetween(today, dueDate);
  return `in ${String(days)} days`;
}

/** "Overdue 3 days" — neutral, factual, never alarmist. */
export function formatOverdue(dueDate: string, today: string): string {
  const days = daysBetween(dueDate, today);
  return days <= 0 ? 'Overdue' : `Overdue ${String(days)} ${days === 1 ? 'day' : 'days'}`;
}

function daysBetween(from: string, to: string): number {
  const [fy = 1970, fm = 1, fd = 1] = from.split('-').map(Number);
  const [ty = 1970, tm = 1, td = 1] = to.split('-').map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * "Last done 5 weeks ago" — the relative-time copy for a chore's last completion, with no
 * nagging copy. Weeks once 7+ days have passed, otherwise days; "today" and "yesterday" cover
 * the near cases plainly. `completedDate` is the calendar date the completion was made, in the
 * household timezone (see `calendarDateOfInstant`), not the occurrence it closed: a completion
 * made early for next week's occurrence was still done today.
 */
export function formatLastCompleted(completedDate: string | null, today: string): string {
  if (completedDate === null) return 'Never completed';
  const days = daysBetween(completedDate, today);
  if (days <= 0) return 'Last done today';
  if (days === 1) return 'Last done yesterday';
  if (days < 7) return `Last done ${String(days)} days ago`;
  const weeks = Math.floor(days / 7);
  return `Last done ${String(weeks)} ${weeks === 1 ? 'week' : 'weeks'} ago`;
}

/** "4 days ago" / "today" — the same relative register for a completion's calendar date. */
export function formatRelativeAgo(completedDate: string, today: string): string {
  const days = daysBetween(completedDate, today);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${String(days)} days ago`;
  const weeks = Math.floor(days / 7);
  return `${String(weeks)} ${weeks === 1 ? 'week' : 'weeks'} ago`;
}

/**
 * A member's display name from the current roster, or "Former member" when they have left the
 * household (historical records keep the departed user's id and render as 'Former member'
 * rather than being rewritten). The list the API returns only ever
 * holds current members, so an id missing from it is exactly a departed one.
 */
export function memberName(members: readonly Member[], userId: string | null): string {
  if (userId === null) return 'Unassigned';
  return members.find((member) => member.userId === userId)?.displayName ?? 'Former member';
}

/**
 * The completion toast (`"Take out trash done. Sam is next."`). A chore
 * with no rotation has no "is next" clause — there is no turn to name.
 */
export function completionToastMessage(
  choreName: string,
  nextTurnName: string | undefined,
): string {
  return nextTurnName === undefined
    ? `${choreName} done.`
    : `${choreName} done. ${nextTurnName} is next.`;
}

export function deleteChoreConfirmation(chore: Pick<Chore, 'name'>): string {
  return `Delete ${chore.name}? This removes its recurrence and completion history.`;
}

export const DELETE_COMPLETION_CONFIRMATION =
  'Delete this completion? The next due date and rotation revert.';

export function deleteErrandConfirmation(errand: { name: string }): string {
  return `Delete ${errand.name}?`;
}

/**
 * Words this pillar's own copy must never use. Used by the copy-audit test to scan every
 * chore/errand string this module exports.
 */
export const BANNED_GAMIFICATION_WORDS: readonly string[] = [
  'streak',
  'points',
  'badge',
  'congrat',
  'great job',
  'nice work',
  'well done',
  'good job',
  'level up',
  'achievement',
  'reward',
  "you're behind",
  'keep it up',
  'don’t forget',
  "don't forget",
];

/** Every literal string this module hands the UI, gathered once for the copy-audit test. */
export function allChoreCopyStrings(): string[] {
  return [
    CHORES_EMPTY_COPY,
    ERRANDS_EMPTY_COPY,
    ERRANDS_ALL_DONE_COPY,
    ...Object.values(CHORE_GROUP_LABELS),
    UNASSIGNED_LABEL,
    ROTATION_EMPTY_COPY,
    ROTATION_REQUIRED_ERROR,
    DELETE_COMPLETION_CONFIRMATION,
    OFFLINE_ACTION_REASON,
    completionToastMessage('Take out trash', 'Sam'),
    completionToastMessage('Water plants', undefined),
    deleteChoreConfirmation({ name: 'Take out trash' }),
    deleteErrandConfirmation({ name: 'Return Amazon package' }),
    formatOverdue('2026-09-01', '2026-09-05'),
    formatLastCompleted('2026-08-01', '2026-09-20'),
    formatLastCompleted(null, '2026-09-20'),
  ];
}
