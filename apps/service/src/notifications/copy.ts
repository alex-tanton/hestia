import {
  notificationCopySchema,
  type NotificationCopy,
  type NotificationType,
} from '@hearth/shared';

/*
 * Notification copy (Branding, "Notification copy"). Every producer builds its title and body here
 * and validates them against the shared schema before a row is written. A line over the limit is
 * never shortened: the builder answers null, and the producer does not enqueue the row. The
 * producer reports only the type and id of what it dropped, never the household content.
 */

/** A notification a producer did not write, named by type and target id only. */
export interface DroppedCopy {
  type: NotificationType;
  id: string;
}

/** Where a request-side producer reports a dropped row, so the route can log it. */
export type DroppedCopyReport = (dropped: DroppedCopy) => void;

/** The route's request logger, as the report: the type and id are the only fields logged. */
export function logDroppedCopy(log: {
  warn: (data: object, message: string) => void;
}): DroppedCopyReport {
  return (dropped) => {
    log.warn(
      { type: dropped.type, id: dropped.id },
      'notification copy over the limit; not enqueued',
    );
  };
}

function copy(title: string, body: string): NotificationCopy | null {
  const parsed = notificationCopySchema.safeParse({ title, body });
  return parsed.success ? parsed.data : null;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** A bill amount as the screens show it: "$74.99". Money stays a numeric string until here. */
export function formatAmount(amount: string): string {
  return usd.format(Number(amount));
}

export interface BillReminderCopyInput {
  name: string;
  amount: string;
  autopay: boolean;
  kind: 'advance' | 'due';
  /** The occurrence's weekday, for the advance reminder. */
  weekday: string;
}

/** "Internet due Friday" / "$74.99 · autopay" (Branding, `bill_due`). */
export function billReminderCopy(input: BillReminderCopyInput): NotificationCopy | null {
  const when = input.kind === 'due' ? 'due today' : `due ${input.weekday}`;
  const amount = formatAmount(input.amount);
  return copy(`${input.name} ${when}`, input.autopay ? `${amount} · autopay` : amount);
}

/** A recurring chore's due day (Branding, `chore_due`): the name leads, the body says whose turn. */
export function choreDueCopy(name: string): NotificationCopy | null {
  return copy(name, 'Your turn this week');
}

/** An open errand on its due date. */
export function errandDueCopy(name: string): NotificationCopy | null {
  return copy(name, 'Due today');
}

/** The new holder of a rotating chore (Branding, `chore_rotation`). */
export function choreRotationCopy(input: {
  name: string;
  previousName: string;
}): NotificationCopy | null {
  return copy(`${input.name} is yours`, `Starting today, rotating from ${input.previousName}`);
}

/** Names joined as a sentence: "Sam", "Sam and Alex", "Sam, Alex and Jordan". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const head = names.slice(0, -1).join(', ');
  return `${head} and ${names[names.length - 1] ?? ''}`;
}

/** A batch of list additions: a count, never the items themselves (Branding, `list_activity`). */
export function listActivityCopy(input: {
  count: number;
  listName: string;
  adders: readonly string[];
}): NotificationCopy | null {
  const noun = input.count === 1 ? 'item' : 'items';
  return copy(
    `${String(input.count)} ${noun} added to ${input.listName}`,
    `by ${joinNames(input.adders)}`,
  );
}

/** The first meal planned for today, and how many more follow it (Branding, `meal_reminder`). */
export function mealReminderCopy(input: {
  recipeTitle: string;
  mealType: string;
  moreCount: number;
}): NotificationCopy | null {
  const body =
    input.moreCount === 0
      ? 'Only meal planned today'
      : `Plus ${String(input.moreCount)} more ${input.moreCount === 1 ? 'meal' : 'meals'} planned`;
  return copy(`Today: ${input.recipeTitle} for ${input.mealType}`, body);
}

/** The Saturday nudge for a week with no meals planned (Branding, `weekly_meal_nudge`). */
export function weeklyNudgeCopy(recipeCount: number): NotificationCopy | null {
  const body =
    recipeCount === 1
      ? '1 recipe has sale ingredients'
      : `${String(recipeCount)} recipes have sale ingredients`;
  return copy("Next week isn't planned", body);
}
