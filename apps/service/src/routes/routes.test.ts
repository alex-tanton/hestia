import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { endpoints } from '@hearth/shared';
import type { AppDependencies } from '../app.js';
import { GoTrueError } from '../gotrue/http.js';
import type { ErrorRecord } from '../services/errors.js';
import { errorFingerprint } from '../services/errors.js';
import { bearer, makeTestApp, signToken, TEST_OWNER_EMAIL, userClaims } from '../test/fake-app.js';

const apps: FastifyInstance[] = [];
const ID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

async function app(
  overrides: Partial<AppDependencies> = {},
  ownerEmail = TEST_OWNER_EMAIL,
): Promise<FastifyInstance> {
  const instance = await makeTestApp(overrides, { ownerEmail });
  apps.push(instance);
  return instance;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});

function gotrue(overrides: Partial<AppDependencies['gotrue']> = {}): AppDependencies['gotrue'] {
  return {
    signup: vi.fn(() => Promise.resolve({ status: 200, body: { access_token: 'session' } })),
    verifyPassword: vi.fn(() => Promise.resolve(true)),
    updatePassword: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe('authentication', () => {
  const protectedRoutes = endpoints.filter((endpoint) => endpoint.access !== 'public');

  it.each(protectedRoutes.map((endpoint) => [endpoint.method, endpoint.path] as const))(
    '%s %s answers 401 without a valid token',
    async (method, path) => {
      const instance = await app();
      const url = path
        .replace(':inviteId', ID)
        .replace(':itemId', ID)
        .replace(':userId', ID)
        .replace(':completionId', ID)
        .replace(':id', ID);
      for (const headers of [
        {},
        { authorization: 'Basic abc' },
        { authorization: 'Bearer not.a.jwt' },
        { authorization: `Bearer ${signToken(userClaims({ exp: 1 }))}` },
        { authorization: `Bearer ${signToken({ role: 'service_role', exp: 9e9 })}` },
      ]) {
        const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
        const response = await instance.inject({
          method,
          url,
          headers,
          ...(hasBody ? { payload: {} } : {}),
        });
        expect(response.statusCode).toBe(401);
        expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      }
    },
  );
});

describe('the contract matches the routes', () => {
  it('registers every endpoint in the shared contract', async () => {
    const instance = await app();
    for (const endpoint of endpoints) {
      expect(
        instance.hasRoute({ method: endpoint.method, url: endpoint.path }),
        `${endpoint.method} ${endpoint.path}`,
      ).toBe(true);
    }
  });

  it('serves the OpenAPI document', async () => {
    const instance = await app();
    const response = await instance.inject({ method: 'GET', url: '/api/openapi.json' });
    expect(response.statusCode).toBe(200);
    const document = response.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths)).toContain('/api/households/{id}/invites/{inviteId}');
  });
});

describe('POST /api/signup', () => {
  it('rejects a common password before GoTrue is called', async () => {
    const client = gotrue();
    const instance = await app({ gotrue: client });
    const response = await instance.inject({
      method: 'POST',
      url: '/api/signup',
      payload: { email: 'alex@example.com', password: 'Password123' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ detail: string }>().detail).toMatch(/too common/);
    expect(client.signup).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: 'alex@example.com', password: 'short' }, /at least 8/],
    [{ email: 'nope', password: 'violet-teapot-harbor-17' }, /email/],
    [{ password: 'violet-teapot-harbor-17' }, /email/],
  ])('rejects %j', async (payload, detail) => {
    const client = gotrue();
    const instance = await app({ gotrue: client });
    const response = await instance.inject({ method: 'POST', url: '/api/signup', payload });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ detail: string }>().detail).toMatch(detail);
    expect(client.signup).not.toHaveBeenCalled();
  });

  it('passes the name, timezone, and client address to GoTrue and returns its session', async () => {
    const client = gotrue();
    const instance = await app({ gotrue: client });
    const response = await instance.inject({
      method: 'POST',
      url: '/api/signup',
      remoteAddress: '203.0.113.7',
      payload: {
        email: 'alex@example.com',
        password: 'violet-teapot-harbor-17',
        displayName: 'Alex Rivera',
        timezone: 'America/New_York',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ access_token: 'session' });
    expect(client.signup).toHaveBeenCalledWith(
      {
        email: 'alex@example.com',
        password: 'violet-teapot-harbor-17',
        displayName: 'Alex Rivera',
        timezone: 'America/New_York',
      },
      '203.0.113.7',
    );
  });

  it('defaults a missing name and timezone for the trigger to fill in', async () => {
    const client = gotrue();
    const instance = await app({ gotrue: client });
    await instance.inject({
      method: 'POST',
      url: '/api/signup',
      payload: { email: 'alex@example.com', password: 'violet-teapot-harbor-17' },
    });
    expect(client.signup).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: '', timezone: 'UTC' }),
      expect.any(String),
    );
  });

  it('maps GoTrue refusals', async () => {
    const instance = await app({
      gotrue: gotrue({
        signup: () =>
          Promise.reject(new GoTrueError(422, 'user_already_exists', 'User already registered')),
      }),
    });
    const response = await instance.inject({
      method: 'POST',
      url: '/api/signup',
      payload: { email: 'alex@example.com', password: 'violet-teapot-harbor-17' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ detail: 'User already registered' });
  });
});

describe('POST /api/users/me/password', () => {
  const url = '/api/users/me/password';

  it('re-verifies the current password, then updates as the caller', async () => {
    const client = gotrue();
    const instance = await app({ gotrue: client });
    const claims = userClaims({ email: 'sam@example.com' });
    const headers = bearer(claims);
    const response = await instance.inject({
      method: 'POST',
      url,
      headers,
      remoteAddress: '198.51.100.4',
      payload: { currentPassword: 'old-password-here', newPassword: 'violet-teapot-harbor-17' },
    });
    expect(response.statusCode).toBe(204);
    expect(client.verifyPassword).toHaveBeenCalledWith(
      'sam@example.com',
      'old-password-here',
      '198.51.100.4',
    );
    expect(client.updatePassword).toHaveBeenCalledWith(
      headers['authorization']?.slice('Bearer '.length),
      'violet-teapot-harbor-17',
      '198.51.100.4',
    );
  });

  it('refuses a wrong current password', async () => {
    const client = gotrue({ verifyPassword: vi.fn(() => Promise.resolve(false)) });
    const instance = await app({ gotrue: client });
    const response = await instance.inject({
      method: 'POST',
      url,
      headers: bearer(),
      payload: { currentPassword: 'wrong', newPassword: 'violet-teapot-harbor-17' },
    });
    expect(response.statusCode).toBe(403);
    expect(client.updatePassword).not.toHaveBeenCalled();
  });

  it('requires the current password outside a recovery session', async () => {
    const client = gotrue();
    const instance = await app({ gotrue: client });
    const response = await instance.inject({
      method: 'POST',
      url,
      headers: bearer(),
      payload: { newPassword: 'violet-teapot-harbor-17' },
    });
    expect(response.statusCode).toBe(400);
    expect(client.updatePassword).not.toHaveBeenCalled();
  });

  it('skips re-verification in a session that began from a reset link', async () => {
    const client = gotrue();
    const instance = await app({ gotrue: client });
    const now = Math.floor(Date.now() / 1000);
    const response = await instance.inject({
      method: 'POST',
      url,
      headers: bearer(userClaims({ amr: [{ method: 'recovery', timestamp: now - 30 }] })),
      payload: { newPassword: 'violet-teapot-harbor-17' },
    });
    expect(response.statusCode).toBe(204);
    expect(client.verifyPassword).not.toHaveBeenCalled();
    expect(client.updatePassword).toHaveBeenCalled();
  });

  it('applies the common-password check to the new password', async () => {
    const client = gotrue();
    const instance = await app({ gotrue: client });
    const response = await instance.inject({
      method: 'POST',
      url,
      headers: bearer(),
      payload: { currentPassword: 'x', newPassword: 'iloveyou1' },
    });
    expect(response.statusCode).toBe(400);
    expect(client.verifyPassword).not.toHaveBeenCalled();
  });

  it('passes GoTrue’s refusal on', async () => {
    const instance = await app({
      gotrue: gotrue({
        updatePassword: () =>
          Promise.reject(new GoTrueError(422, 'same_password', 'Use a different password.')),
      }),
    });
    const response = await instance.inject({
      method: 'POST',
      url,
      headers: bearer(),
      payload: { currentPassword: 'x', newPassword: 'violet-teapot-harbor-17' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ detail: 'Use a different password.' });
  });
});

describe('POST /api/users/me/email', () => {
  it('changes the email only after re-verifying the password', async () => {
    const changeEmail = vi.fn(() => Promise.resolve());
    const claims = userClaims({ email: 'sam@example.com' });
    const instance = await app({ gotrue: gotrue(), changeEmail });
    const response = await instance.inject({
      method: 'POST',
      url: '/api/users/me/email',
      headers: bearer(claims),
      payload: { currentPassword: 'pw', newEmail: 'sam.chen@example.com' },
    });
    expect(response.statusCode).toBe(204);
    expect(changeEmail).toHaveBeenCalledWith(claims['sub'], 'sam.chen@example.com');
  });

  it('does not change the email when the password is wrong', async () => {
    const changeEmail = vi.fn(() => Promise.resolve());
    const instance = await app({
      gotrue: gotrue({ verifyPassword: () => Promise.resolve(false) }),
      changeEmail,
    });
    const response = await instance.inject({
      method: 'POST',
      url: '/api/users/me/email',
      headers: bearer(),
      payload: { currentPassword: 'pw', newEmail: 'sam.chen@example.com' },
    });
    expect(response.statusCode).toBe(403);
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it('maps an email already in use to 409', async () => {
    const instance = await app({
      gotrue: gotrue(),
      changeEmail: () => Promise.reject(new GoTrueError(422, 'email_exists', 'Email exists')),
    });
    const response = await instance.inject({
      method: 'POST',
      url: '/api/users/me/email',
      headers: bearer(),
      payload: { currentPassword: 'pw', newEmail: 'taken@example.com' },
    });
    expect(response.statusCode).toBe(409);
  });
});

describe('request validation', () => {
  it.each([
    ['PATCH', '/api/users/me', {}],
    ['PATCH', '/api/users/me', { quietHours: { start: '25:00', end: '07:00' } }],
    ['PUT', '/api/users/me/active-household', { householdId: 'nope' }],
    ['POST', '/api/households', { name: 'Oak', postalCode: '2751', timezone: 'UTC' }],
    ['POST', '/api/households/join', { tokenOrCode: '  ' }],
    ['PATCH', `/api/households/${ID}`, {}],
    ['GET', '/api/households/not-a-uuid', undefined],
    ['POST', `/api/households/${ID}/transfer-admin`, { userId: 'x' }],
    ['POST', `/api/households/${ID}/leave`, { reassignments: { x: ID } }],
    ['DELETE', `/api/households/${ID}/invites/nope`, undefined],
  ] as const)('%s %s with %j is a 400', async (method, url, payload) => {
    const instance = await app();
    const response = await instance.inject({
      method,
      url,
      headers: bearer(),
      ...(payload === undefined ? {} : { payload }),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ type: 'about:blank', status: 400 });
  });
});

describe('POST /api/client-error', () => {
  it('records a scrubbed report under a web fingerprint', async () => {
    const recordError = vi.fn<(record: ErrorRecord) => Promise<void>>(() => Promise.resolve());
    const instance = await app({ recordError });
    const response = await instance.inject({
      method: 'POST',
      url: '/api/client-error',
      payload: {
        name: 'TypeError',
        message: 'Cannot read "Oat milk" for sam@example.com, total $45.10',
        route: '/lists/abc?q=milk',
      },
    });
    expect(response.statusCode).toBe(204);
    expect(recordError).toHaveBeenCalledWith({
      fingerprint: errorFingerprint('web', 'TypeError', '/lists/abc'),
      message: 'TypeError at /lists/abc: Cannot read [text] for [email], total [amount]',
    });
  });

  it('allows 10 reports a minute per IP', async () => {
    const instance = await app();
    for (let i = 0; i < 10; i += 1) {
      const ok = await instance.inject({
        method: 'POST',
        url: '/api/client-error',
        payload: { message: 'x' },
      });
      expect(ok.statusCode).toBe(204);
    }
    const limited = await instance.inject({
      method: 'POST',
      url: '/api/client-error',
      payload: { message: 'x' },
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    const other = await instance.inject({
      method: 'POST',
      url: '/api/client-error',
      remoteAddress: '10.0.0.9',
      payload: { message: 'x' },
    });
    expect(other.statusCode).toBe(204);
  });

  it('refuses an oversized or malformed report', async () => {
    const instance = await app();
    const big = await instance.inject({
      method: 'POST',
      url: '/api/client-error',
      payload: { message: 'x'.repeat(20_000) },
    });
    expect(big.statusCode).toBe(413);
    const bad = await instance.inject({
      method: 'POST',
      url: '/api/client-error',
      payload: { message: 5 },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe('unhandled errors', () => {
  it('are recorded scrubbed, with a service fingerprint on the route pattern', async () => {
    const recordError = vi.fn<(record: ErrorRecord) => Promise<void>>(() => Promise.resolve());
    const instance = await app({
      recordError,
      systemHealth: () => Promise.reject(new TypeError('boom for owner@example.com')),
    });
    const response = await instance.inject({
      method: 'GET',
      url: '/api/health/deep',
      headers: bearer(userClaims({ email: TEST_OWNER_EMAIL })),
    });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('boom');
    expect(recordError).toHaveBeenCalledWith({
      fingerprint: errorFingerprint('service', 'TypeError', '/api/health/deep'),
      message: 'TypeError at /api/health/deep: boom for [email]',
    });
  });

  it('still answer 500 when recording fails', async () => {
    const instance = await app({
      recordError: () => Promise.reject(new Error('db down')),
      systemHealth: () => Promise.reject(new Error('boom')),
    });
    const response = await instance.inject({
      method: 'GET',
      url: '/api/health/deep',
      headers: bearer(userClaims({ email: TEST_OWNER_EMAIL })),
    });
    expect(response.statusCode).toBe(500);
  });

  it('map known database errors instead of recording them', async () => {
    const recordError = vi.fn(() => Promise.resolve());
    const instance = await app({
      recordError,
      systemHealth: () =>
        Promise.reject(Object.assign(new Error('permission denied'), { code: '42501' })),
    });
    const response = await instance.inject({
      method: 'GET',
      url: '/api/health/deep',
      headers: bearer(userClaims({ email: TEST_OWNER_EMAIL })),
    });
    expect(response.statusCode).toBe(403);
    expect(recordError).not.toHaveBeenCalled();
  });
});

describe('GET /api/health/deep', () => {
  it('is closed to anyone but the server owner', async () => {
    const systemHealth = vi.fn();
    const instance = await app({ systemHealth });
    const response = await instance.inject({
      method: 'GET',
      url: '/api/health/deep',
      headers: bearer(userClaims({ email: 'member@example.com' })),
    });
    expect(response.statusCode).toBe(403);
    expect(systemHealth).not.toHaveBeenCalled();
  });

  it('is closed to everyone when no owner is configured', async () => {
    const instance = await app({}, '');
    const response = await instance.inject({
      method: 'GET',
      url: '/api/health/deep',
      headers: bearer(userClaims({ email: '' })),
    });
    expect(response.statusCode).toBe(403);
  });

  it('reports job freshness, backups, errors, and skip rates to the owner', async () => {
    const instance = await app({
      systemHealth: () =>
        Promise.resolve({
          newest_deal_fetched_at: '2026-09-19T08:00:03.123+00:00',
          newest_notification_sent_at: null,
          recent_errors: [
            {
              fingerprint: 'f'.repeat(64),
              message: 'TypeError at /lists/:param: x',
              count: 3,
              first_seen: '2026-09-19T01:00:00+00:00',
              last_seen: '2026-09-19T02:00:00+00:00',
            },
          ],
        }),
      newestBackupTime: () => Promise.resolve(new Date('2026-09-19T02:00:05Z')),
      merchantSkipRates: () => [
        {
          merchantId: '2431',
          merchantName: 'Harris Teeter',
          fetched: 10,
          skipped: 1,
          skipRate: 0.1,
        },
      ],
    });
    const response = await instance.inject({
      method: 'GET',
      url: '/api/health/deep',
      // Case differs from HEARTH_OWNER_EMAIL on purpose.
      headers: bearer(userClaims({ email: 'owner@example.COM' })),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      newestDealFetchedAt: '2026-09-19T08:00:03.123Z',
      newestNotificationSentAt: null,
      newestBackupAt: '2026-09-19T02:00:05.000Z',
      recentErrors: [
        {
          fingerprint: 'f'.repeat(64),
          message: 'TypeError at /lists/:param: x',
          count: 3,
          firstSeen: '2026-09-19T01:00:00.000Z',
          lastSeen: '2026-09-19T02:00:00.000Z',
        },
      ],
      merchantSkipRates: [
        {
          merchantId: '2431',
          merchantName: 'Harris Teeter',
          fetched: 10,
          skipped: 1,
          skipRate: 0.1,
        },
      ],
    });
  });
});

describe('notification routes', () => {
  // Validation runs before any query, so these need no database.
  it.each([
    [
      'PATCH',
      '/api/users/me/notification-preferences',
      { type: 'weekly_meal_nudge', enabled: true },
    ],
    [
      'PATCH',
      '/api/users/me/notification-preferences',
      { type: 'bill_due', enabled: true, householdId: ID },
    ],
    ['PATCH', '/api/users/me/notification-preferences', { type: 'not_a_type', enabled: true }],
    [
      'POST',
      '/api/users/me/push-subscriptions',
      { endpoint: 'http://push.example.com/a', keys: { p256dh: 'AAAA', auth: 'AAAA' } },
    ],
    [
      'POST',
      '/api/users/me/push-subscriptions',
      { endpoint: 'https://push.example.com/a', keys: {} },
    ],
    ['DELETE', '/api/users/me/push-subscriptions', { endpoint: 'javascript:alert(1)' }],
  ] as const)(
    '%s %s refuses %j with 400 before reaching the database',
    async (method, url, payload) => {
      const instance = await app();
      const response = await instance.inject({ method, url, headers: bearer(), payload });
      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    },
  );
});

describe('GET /api/users/me', () => {
  it('reaches the database only as the caller and answers 404 for a missing profile', async () => {
    // The fake database answers every query with no rows.
    const instance = await app();
    const response = await instance.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: bearer(),
    });
    expect(response.statusCode).toBe(404);
  });
});
