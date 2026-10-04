import { notificationCopySchema } from '@hearth/shared';
import { describe, expect, it } from 'vitest';
import {
  billReminderCopy,
  choreDueCopy,
  choreRotationCopy,
  errandDueCopy,
  joinNames,
  listActivityCopy,
  mealReminderCopy,
  weeklyNudgeCopy,
} from './copy.js';

const LONG = 'x'.repeat(200);

describe('notification copy length (Branding, "Notification copy": at most 60 characters)', () => {
  it('keeps a line of exactly 60 characters, and returns the trimmed copy', () => {
    const name = 'n'.repeat(60 - ' is yours'.length);
    expect(choreRotationCopy({ name, previousName: 'Sam' })).toStrictEqual({
      title: `${name} is yours`,
      body: 'Starting today, rotating from Sam',
    });
  });

  it('answers null for every builder whose line is over the limit, rather than shortening it', () => {
    const copies = [
      billReminderCopy({
        name: LONG,
        amount: '1850.00',
        autopay: true,
        kind: 'advance',
        weekday: 'Friday',
      }),
      billReminderCopy({ name: LONG, amount: '74.99', autopay: false, kind: 'due', weekday: '' }),
      choreDueCopy(LONG),
      errandDueCopy(LONG),
      choreRotationCopy({ name: LONG, previousName: LONG }),
      listActivityCopy({ count: 5, listName: LONG, adders: [LONG, LONG, LONG] }),
      mealReminderCopy({ recipeTitle: LONG, mealType: 'dinner', moreCount: 2 }),
    ];
    for (const copy of copies) {
      expect(copy).toBeNull();
    }
    expect(notificationCopySchema.safeParse({ title: 'x'.repeat(61), body: 'ok' }).success).toBe(
      false,
    );
  });
});

describe('copy wording', () => {
  it('states an advance bill reminder with its weekday, its amount, and the autopay label', () => {
    expect(
      billReminderCopy({
        name: 'Spectrum Internet',
        amount: '74.99',
        autopay: true,
        kind: 'advance',
        weekday: 'Friday',
      }),
    ).toStrictEqual({ title: 'Spectrum Internet due Friday', body: '$74.99 · autopay' });
  });

  it('states the due-day reminder as due today, with thousands separated', () => {
    expect(
      billReminderCopy({
        name: 'Rent',
        amount: '1850.00',
        autopay: false,
        kind: 'due',
        weekday: 'Sunday',
      }),
    ).toStrictEqual({ title: 'Rent due today', body: '$1,850.00' });
  });

  it('names the chore, and the rotation it moved from', () => {
    expect(choreRotationCopy({ name: 'Take out trash', previousName: 'Sam' })).toStrictEqual({
      title: 'Take out trash is yours',
      body: 'Starting today, rotating from Sam',
    });
  });

  it('counts a list batch and names who added to it, never the items', () => {
    expect(
      listActivityCopy({ count: 5, listName: 'Grocery List', adders: ['Sam', 'Alex'] }),
    ).toStrictEqual({ title: '5 items added to Grocery List', body: 'by Sam and Alex' });
    expect(listActivityCopy({ count: 1, listName: 'Grocery List', adders: ['Sam'] })).toStrictEqual(
      { title: '1 item added to Grocery List', body: 'by Sam' },
    );
  });

  it('joins three or more names as a sentence', () => {
    expect(joinNames(['Sam', 'Alex', 'Jordan'])).toBe('Sam, Alex and Jordan');
  });

  it('says how many more meals follow the first, and handles a single meal', () => {
    expect(
      mealReminderCopy({ recipeTitle: 'Baked Ziti', mealType: 'dinner', moreCount: 1 }),
    ).toStrictEqual({ title: 'Today: Baked Ziti for dinner', body: 'Plus 1 more meal planned' });
    expect(
      mealReminderCopy({ recipeTitle: 'Baked Ziti', mealType: 'dinner', moreCount: 0 }),
    ).toStrictEqual({ title: 'Today: Baked Ziti for dinner', body: 'Only meal planned today' });
  });

  it('states the nudge count with the right verb', () => {
    expect(weeklyNudgeCopy(12)?.body).toBe('12 recipes have sale ingredients');
    expect(weeklyNudgeCopy(1)?.body).toBe('1 recipe has sale ingredients');
  });

  it('keeps a chore’s and an errand’s due copy to the name and the due day', () => {
    expect(choreDueCopy('Trash night')).toStrictEqual({
      title: 'Trash night',
      body: 'Your turn this week',
    });
    expect(errandDueCopy('Renew car registration')).toStrictEqual({
      title: 'Renew car registration',
      body: 'Due today',
    });
  });
});
