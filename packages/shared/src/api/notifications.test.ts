import { describe, expect, it } from 'vitest';
import { endpoints } from './contract.js';
import {
  deletePushSubscriptionRequestSchema,
  notificationCopySchema,
  notificationTypes,
  pushSubscriptionRequestSchema,
  updateNotificationPreferenceRequestSchema,
} from './notifications.js';

const ID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc-DEF_123';
const KEYS = {
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
};

describe('notification type list', () => {
  it('matches the database enum, in order', () => {
    expect([...notificationTypes]).toEqual([
      'bill_due',
      'chore_due',
      'chore_rotation',
      'list_activity',
      'meal_reminder',
      'weekly_meal_nudge',
      'flyer_refresh',
    ]);
  });
});

describe('updateNotificationPreferenceRequestSchema', () => {
  it.each([
    [{ type: 'bill_due', enabled: false }],
    [{ type: 'meal_reminder', enabled: true, householdId: null }],
    [{ type: 'weekly_meal_nudge', enabled: true, householdId: ID }],
  ])('accepts %j', (body) => {
    expect(updateNotificationPreferenceRequestSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['the weekly nudge without a household', { type: 'weekly_meal_nudge', enabled: true }],
    [
      'the weekly nudge with a null household',
      { type: 'weekly_meal_nudge', enabled: true, householdId: null },
    ],
    ['a per-user type with a household', { type: 'bill_due', enabled: true, householdId: ID }],
    ['an unknown type', { type: 'pizza_due', enabled: true }],
    ['a missing enabled flag', { type: 'bill_due' }],
    ['a non-boolean enabled flag', { type: 'bill_due', enabled: 'yes' }],
    ['a malformed household id', { type: 'weekly_meal_nudge', enabled: true, householdId: 'x' }],
  ])('rejects %s', (_label, body) => {
    expect(updateNotificationPreferenceRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe('pushSubscriptionRequestSchema', () => {
  it('accepts an https endpoint with base64url keys', () => {
    expect(
      pushSubscriptionRequestSchema.safeParse({ endpoint: ENDPOINT, keys: KEYS }).success,
    ).toBe(true);
  });

  it.each([
    ['http', 'http://push.example.com/abc'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['not a URL', 'push endpoint'],
    ['an empty string', ''],
    ['an endpoint over 2048 characters', `https://push.example.com/${'a'.repeat(2048)}`],
  ])('rejects %s as an endpoint', (_label, endpoint) => {
    const result = pushSubscriptionRequestSchema.safeParse({ endpoint, keys: KEYS });
    expect(result.success).toBe(false);
  });

  it.each([
    ['a missing auth key', { p256dh: KEYS.p256dh }],
    ['a key with a space', { p256dh: KEYS.p256dh, auth: 'tBHI tJI5' }],
    ['a standard base64 key with a plus sign', { p256dh: KEYS.p256dh, auth: 'tBHI+tJI5' }],
    ['an empty key', { p256dh: '', auth: KEYS.auth }],
    ['an oversized key', { p256dh: 'A'.repeat(201), auth: KEYS.auth }],
  ])('rejects %s', (_label, keys) => {
    expect(pushSubscriptionRequestSchema.safeParse({ endpoint: ENDPOINT, keys }).success).toBe(
      false,
    );
  });

  it('applies the same https rule to deletes', () => {
    expect(deletePushSubscriptionRequestSchema.safeParse({ endpoint: ENDPOINT }).success).toBe(
      true,
    );
    expect(
      deletePushSubscriptionRequestSchema.safeParse({ endpoint: 'http://push.example.com' })
        .success,
    ).toBe(false);
  });
});

describe('notificationCopySchema', () => {
  it.each([
    ['a title at the limit', { title: 'a'.repeat(60), body: '$74.99' }],
    ['a body at the limit', { title: 'Internet due Friday', body: 'b'.repeat(60) }],
  ])('accepts %s', (_label, copy) => {
    expect(notificationCopySchema.safeParse(copy).success).toBe(true);
  });

  it.each([
    ['a title one over the limit', { title: 'a'.repeat(61), body: '$74.99' }],
    ['a body one over the limit', { title: 'Internet due Friday', body: 'b'.repeat(61) }],
    ['an empty title', { title: '   ', body: '$74.99' }],
  ])('rejects %s', (_label, copy) => {
    expect(notificationCopySchema.safeParse(copy).success).toBe(false);
  });
});

describe('notification endpoints in the contract', () => {
  it('lists the four preference and subscription routes under the user scope', () => {
    const routes = endpoints
      .filter(
        (endpoint) =>
          endpoint.path.includes('/notification-preferences') ||
          endpoint.path.includes('/push-subscriptions'),
      )
      .map((endpoint) => [endpoint.method, endpoint.path, endpoint.access]);
    expect(routes).toEqual([
      ['GET', '/api/users/me/notification-preferences', 'user'],
      ['PATCH', '/api/users/me/notification-preferences', 'user'],
      ['POST', '/api/users/me/push-subscriptions', 'user'],
      ['DELETE', '/api/users/me/push-subscriptions', 'user'],
    ]);
  });
});
