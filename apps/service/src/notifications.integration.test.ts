import { describe, expect, it } from 'vitest';
import type { Household, NotificationPreferencesResponse } from '@hestia/shared';
import { adminPool, as, signUp, uniqueName, type SignedUpUser } from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';

/*
 * Notification preferences and push subscriptions through the service against `supabase start`:
 * real GoTrue, real Postgres as hestia_service, every request through withUserDb.
 */

const PUSH_ENDPOINT = 'https://push.example.com/send/alpha';
const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' };

registerStackHooks();

async function createHousehold(user: SignedUpUser): Promise<Household> {
  const response = await as(app, user, 'POST', '/api/households', {
    name: uniqueName('Oak Street'),
    postalCode: '27514',
    timezone: 'America/New_York',
  });
  expectStatus(response, 201);
  return response.json<Household>();
}

async function preferences(user: SignedUpUser): Promise<NotificationPreferencesResponse> {
  const response = await as(app, user, 'GET', '/api/users/me/notification-preferences');
  expectStatus(response, 200);
  return response.json<NotificationPreferencesResponse>();
}

async function storedRows(userId: string, type: string): Promise<{ enabled: boolean }[]> {
  const result = await adminPool.query<{ enabled: boolean }>(
    `select enabled from public.notification_preference
     where user_id = $1 and notification_type = $2`,
    [userId, type],
  );
  return result.rows;
}

async function storedSubscriptions(
  userId: string,
): Promise<{ endpoint: string; keys: Record<string, string> }[]> {
  const result = await adminPool.query<{ endpoint: string; keys: Record<string, string> }>(
    'select endpoint, keys from public.push_subscription where user_id = $1',
    [userId],
  );
  return result.rows;
}

describe('GET /api/users/me/notification-preferences', () => {
  it('answers the defaults for a user with no stored rows', async () => {
    const user = await signUp(app, 'Defaults');
    const body = await preferences(user);
    expect(body.preferences.filter((p) => p.householdId === null)).toHaveLength(6);
    expect(body.preferences.find((p) => p.type === 'bill_due')).toEqual({
      type: 'bill_due',
      householdId: null,
      enabled: true,
    });
    expect(body.preferences.find((p) => p.type === 'meal_reminder')?.enabled).toBe(false);
    expect(body.preferences.some((p) => p.type === 'weekly_meal_nudge')).toBe(false);
  });

  it('lists the weekly meal nudge for each household the caller belongs to', async () => {
    const user = await signUp(app, 'Nudged');
    const household = await createHousehold(user);
    const body = await preferences(user);
    expect(body.preferences).toContainEqual({
      type: 'weekly_meal_nudge',
      householdId: household.id,
      enabled: false,
    });
  });
});

describe('PATCH /api/users/me/notification-preferences', () => {
  it('stores a per-user setting and returns its effective value', async () => {
    const user = await signUp(app, 'Toggler');
    const response = await as(app, user, 'PATCH', '/api/users/me/notification-preferences', {
      type: 'bill_due',
      enabled: false,
    });
    expectStatus(response, 200);
    expect(response.json()).toEqual({ type: 'bill_due', householdId: null, enabled: false });
    expect((await preferences(user)).preferences).toContainEqual({
      type: 'bill_due',
      householdId: null,
      enabled: false,
    });
  });

  it('is idempotent: repeating the same change leaves one row', async () => {
    const user = await signUp(app, 'Repeater');
    for (let i = 0; i < 2; i += 1) {
      const response = await as(app, user, 'PATCH', '/api/users/me/notification-preferences', {
        type: 'list_activity',
        enabled: false,
      });
      expectStatus(response, 200);
    }
    expect(await storedRows(user.id, 'list_activity')).toEqual([{ enabled: false }]);
  });

  it('turns the weekly meal nudge on for one household only', async () => {
    const user = await signUp(app, 'Planner');
    const first = await createHousehold(user);
    const second = await createHousehold(user);
    const response = await as(app, user, 'PATCH', '/api/users/me/notification-preferences', {
      type: 'weekly_meal_nudge',
      enabled: true,
      householdId: first.id,
    });
    expectStatus(response, 200);
    const body = await preferences(user);
    expect(body.preferences.filter((p) => p.type === 'weekly_meal_nudge')).toEqual(
      expect.arrayContaining([
        { type: 'weekly_meal_nudge', householdId: first.id, enabled: true },
        { type: 'weekly_meal_nudge', householdId: second.id, enabled: false },
      ]),
    );
  });

  it('answers 404 for the weekly meal nudge in a household the caller does not belong to', async () => {
    const owner = await signUp(app, 'Owner');
    const outsider = await signUp(app, 'Outsider');
    const household = await createHousehold(owner);
    const response = await as(app, outsider, 'PATCH', '/api/users/me/notification-preferences', {
      type: 'weekly_meal_nudge',
      enabled: true,
      householdId: household.id,
    });
    expectStatus(response, 404);
    expect(await storedRows(outsider.id, 'weekly_meal_nudge')).toEqual([]);
  });

  it('refuses a household on a per-user type and a missing household on the nudge', async () => {
    const user = await signUp(app, 'Strict');
    const household = await createHousehold(user);
    const perUserWithHousehold = await as(
      app,
      user,
      'PATCH',
      '/api/users/me/notification-preferences',
      { type: 'bill_due', enabled: false, householdId: household.id },
    );
    expectStatus(perUserWithHousehold, 400);
    const nudgeWithoutHousehold = await as(
      app,
      user,
      'PATCH',
      '/api/users/me/notification-preferences',
      { type: 'weekly_meal_nudge', enabled: true },
    );
    expectStatus(nudgeWithoutHousehold, 400);
  });

  it('never shows or changes another user’s rows', async () => {
    const alex = await signUp(app, 'Alex Rows');
    const casey = await signUp(app, 'Casey Rows');
    await as(app, alex, 'PATCH', '/api/users/me/notification-preferences', {
      type: 'chore_due',
      enabled: false,
    });
    await as(app, casey, 'PATCH', '/api/users/me/notification-preferences', {
      type: 'chore_due',
      enabled: true,
    });
    expect(await storedRows(alex.id, 'chore_due')).toEqual([{ enabled: false }]);
    expect(await storedRows(casey.id, 'chore_due')).toEqual([{ enabled: true }]);
    expect((await preferences(alex)).preferences).toContainEqual({
      type: 'chore_due',
      householdId: null,
      enabled: false,
    });
  });
});

describe('push subscriptions', () => {
  it('stores a subscription and updates its keys when the same endpoint is posted again', async () => {
    const user = await signUp(app, 'Subscriber');
    expectStatus(
      await as(app, user, 'POST', '/api/users/me/push-subscriptions', {
        endpoint: PUSH_ENDPOINT,
        keys: KEYS,
      }),
      204,
    );
    const rotated = { p256dh: KEYS.p256dh, auth: 'rotated-auth-key-value' };
    expectStatus(
      await as(app, user, 'POST', '/api/users/me/push-subscriptions', {
        endpoint: PUSH_ENDPOINT,
        keys: rotated,
      }),
      204,
    );
    expect(await storedSubscriptions(user.id)).toEqual([
      { endpoint: PUSH_ENDPOINT, keys: rotated },
    ]);
  });

  it('refuses a non-https endpoint before anything is stored', async () => {
    const user = await signUp(app, 'Plain');
    const response = await as(app, user, 'POST', '/api/users/me/push-subscriptions', {
      endpoint: 'http://push.example.com/send/alpha',
      keys: KEYS,
    });
    expectStatus(response, 400);
    expect(await storedSubscriptions(user.id)).toEqual([]);
  });

  it('removes only the caller’s subscription, and a repeat delete is still 204', async () => {
    const alex = await signUp(app, 'Alex Push');
    const casey = await signUp(app, 'Casey Push');
    for (const user of [alex, casey]) {
      expectStatus(
        await as(app, user, 'POST', '/api/users/me/push-subscriptions', {
          endpoint: PUSH_ENDPOINT,
          keys: KEYS,
        }),
        204,
      );
    }
    expectStatus(
      await as(app, casey, 'DELETE', '/api/users/me/push-subscriptions', {
        endpoint: PUSH_ENDPOINT,
      }),
      204,
    );
    expect(await storedSubscriptions(casey.id)).toEqual([]);
    expect(await storedSubscriptions(alex.id)).toHaveLength(1);

    expectStatus(
      await as(app, casey, 'DELETE', '/api/users/me/push-subscriptions', {
        endpoint: PUSH_ENDPOINT,
      }),
      204,
    );
  });
});
