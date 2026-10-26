import type { NotificationType } from '@hestia/shared';

/*
 * Copy for Settings › Notifications. Each type
 * gets a short name and one line on when it arrives, so a toggle says what it will do.
 */

export const NOTIFICATION_TYPE_COPY: Record<
  Exclude<NotificationType, 'weekly_meal_nudge'>,
  { label: string; hint: string }
> = {
  bill_due: {
    label: 'Bill reminders',
    hint: 'Before a bill is due, and on its due date while it is unpaid.',
  },
  chore_due: {
    label: 'Chore reminders',
    hint: 'When one of your chores or errands is due.',
  },
  chore_rotation: {
    label: 'Chore handed to you',
    hint: "When a rotating chore's turn passes to you.",
  },
  list_activity: {
    label: 'List activity',
    hint: 'When other members add items to a shared list, in one message.',
  },
  meal_reminder: {
    label: 'Meal reminders',
    hint: 'At 8am on a day that has a meal planned.',
  },
  flyer_refresh: {
    label: 'New weekly ads',
    hint: 'When a favorite store posts a new flyer.',
  },
};

/** The weekly nudge is set once per household, so its name carries the household. */
export function weeklyNudgeLabel(householdName: string): string {
  return `Plan next week: ${householdName}`;
}

export const WEEKLY_NUDGE_HINT = 'Saturdays at 9am, when next week has no meals planned.';

export const NOTIFICATION_TYPES_HEADING = 'Notification types';

export const NOTIFICATION_TYPES_EMPTY =
  'No notification types to turn on yet. Join a household to get reminders.';

export const NOTIFICATION_TYPES_LOADING = 'Loading notification types';
export const NOTIFICATION_TYPES_LOAD_ERROR = "Couldn't load notification types. Try again.";
export const NOTIFICATION_TYPES_OFFLINE = 'Notification settings need a connection.';

/** Shown beside a toggle that cannot be changed right now. */
export const WRITE_NEEDS_CONNECTION = 'Needs a connection.';

export const SAVING_MESSAGE = 'Saving…';
export const SAVED_MESSAGE = 'Notification settings saved.';
export const SAVE_ERROR_MESSAGE = "Couldn't save that setting. Try again.";

export const UNSUPPORTED_MESSAGE =
  "Notifications aren't available in this browser. Hestia still works without them.";

/** The device states that explain why this device will not receive a type yet. */
export const DEVICE_MESSAGES = {
  denied:
    "Notifications are blocked for Hestia in this browser, so this device won't get them. Allow notifications for this site in your browser's settings, then turn a type on again.",
  dismissed:
    'Notifications stay off on this device until you allow them. Turn a type on again to be asked.',
  failed: "Couldn't turn on notifications on this device. Try again.",
} as const;

/** Where to read about changing a browser's notification permission. */
export const BROWSER_SETTINGS_HELP_URL = 'https://support.google.com/chrome/answer/114662';
export const BROWSER_SETTINGS_HELP_LABEL = 'How to allow notifications';
