import { describe, expect, it } from 'vitest';
import type { NotificationType } from '@hearth/shared';
import { effectivePreferences, notificationDefaults } from './notifications.js';

const HOUSEHOLD_A = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';
const HOUSEHOLD_B = '7a1d2e3f-4b5c-4d6e-8f7a-9b0c1d2e3f4a';

// The default on/off setting of each notification type.
describe('notification defaults', () => {
  it.each<[NotificationType, boolean]>([
    ['bill_due', true],
    ['chore_due', true],
    ['chore_rotation', true],
    ['list_activity', true],
    ['meal_reminder', false],
    ['weekly_meal_nudge', false],
    ['flyer_refresh', false],
  ])('%s defaults to %s', (type, expected) => {
    expect(notificationDefaults[type]).toBe(expected);
  });
});

describe('effectivePreferences', () => {
  it('applies the defaults when nothing is stored, once per per-user type', () => {
    const preferences = effectivePreferences([], []);
    expect(preferences).toHaveLength(6);
    expect(preferences.map((p) => p.type)).toEqual([
      'bill_due',
      'chore_due',
      'chore_rotation',
      'list_activity',
      'meal_reminder',
      'flyer_refresh',
    ]);
    expect(preferences.every((p) => p.householdId === null)).toBe(true);
    expect(Object.fromEntries(preferences.map((p) => [p.type, p.enabled]))).toEqual({
      bill_due: true,
      chore_due: true,
      chore_rotation: true,
      list_activity: true,
      meal_reminder: false,
      flyer_refresh: false,
    });
  });

  it('lists the weekly meal nudge once for each household the caller belongs to', () => {
    const preferences = effectivePreferences([], [HOUSEHOLD_A, HOUSEHOLD_B]).filter(
      (p) => p.type === 'weekly_meal_nudge',
    );
    expect(preferences).toEqual([
      { type: 'weekly_meal_nudge', householdId: HOUSEHOLD_A, enabled: false },
      { type: 'weekly_meal_nudge', householdId: HOUSEHOLD_B, enabled: false },
    ]);
  });

  it('lets a stored row override the default, and only for its own household', () => {
    const preferences = effectivePreferences(
      [
        { type: 'bill_due', householdId: null, enabled: false },
        { type: 'weekly_meal_nudge', householdId: HOUSEHOLD_B, enabled: true },
      ],
      [HOUSEHOLD_A, HOUSEHOLD_B],
    );
    expect(preferences.find((p) => p.type === 'bill_due')?.enabled).toBe(false);
    expect(
      preferences
        .filter((p) => p.type === 'weekly_meal_nudge')
        .map((p) => [p.householdId, p.enabled]),
    ).toEqual([
      [HOUSEHOLD_A, false],
      [HOUSEHOLD_B, true],
    ]);
  });

  it('ignores a stored nudge row for a household the caller no longer belongs to', () => {
    const preferences = effectivePreferences(
      [{ type: 'weekly_meal_nudge', householdId: HOUSEHOLD_B, enabled: true }],
      [HOUSEHOLD_A],
    );
    expect(preferences.filter((p) => p.type === 'weekly_meal_nudge')).toEqual([
      { type: 'weekly_meal_nudge', householdId: HOUSEHOLD_A, enabled: false },
    ]);
  });
});
