import { describe, expect, it, vi } from 'vitest';
import { createGoTrueAdmin } from '../privileged/gotrue-admin.js';
import { createGoTrueClient } from './client.js';
import { GoTrueError, type Fetch } from './http.js';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(status: number, body: unknown): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: url instanceof Request ? url.url : url.toString(),
      method: init?.method ?? 'GET',
      headers: { ...(init?.headers as Record<string, string>) },
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status }));
  });
  return { fetch, calls };
}

describe('GoTrue client', () => {
  it('signs up with metadata, the anon key, and the client address', async () => {
    const { fetch, calls } = fakeFetch(200, { access_token: 't' });
    const client = createGoTrueClient({ url: 'http://auth:9999', anonKey: 'anon', fetch });
    const result = await client.signup(
      { email: 'a@b.co', password: 'pw', displayName: 'Alex', timezone: 'America/New_York' },
      '203.0.113.7',
    );
    expect(result).toEqual({ status: 200, body: { access_token: 't' } });
    expect(calls[0]).toEqual({
      url: 'http://auth:9999/signup',
      method: 'POST',
      headers: {
        apikey: 'anon',
        accept: 'application/json',
        'x-forwarded-for': '203.0.113.7',
        'content-type': 'application/json',
      },
      body: {
        email: 'a@b.co',
        password: 'pw',
        data: { display_name: 'Alex', timezone: 'America/New_York' },
      },
    });
  });

  it('reports a wrong password as false and other failures as errors', async () => {
    const wrong = fakeFetch(400, { error_code: 'invalid_credentials', msg: 'Invalid login' });
    const client = createGoTrueClient({ url: 'http://auth', anonKey: 'anon', fetch: wrong.fetch });
    expect(await client.verifyPassword('a@b.co', 'x', '1.2.3.4')).toBe(false);
    expect(wrong.calls[0]?.url).toBe('http://auth/token?grant_type=password');

    const right = fakeFetch(200, { access_token: 't' });
    const ok = createGoTrueClient({ url: 'http://auth', anonKey: 'anon', fetch: right.fetch });
    expect(await ok.verifyPassword('a@b.co', 'x', '1.2.3.4')).toBe(true);

    const limited = fakeFetch(429, { error_code: 'over_request_rate_limit', msg: 'slow down' });
    const busy = createGoTrueClient({ url: 'http://auth', anonKey: 'anon', fetch: limited.fetch });
    await expect(busy.verifyPassword('a@b.co', 'x', '1.2.3.4')).rejects.toMatchObject({
      status: 429,
      code: 'over_request_rate_limit',
      message: 'slow down',
    });
  });

  it('updates the password as the caller', async () => {
    const { fetch, calls } = fakeFetch(200, {});
    const client = createGoTrueClient({ url: 'http://auth', anonKey: 'anon', fetch });
    await client.updatePassword('user-jwt', 'new-password', '1.2.3.4');
    expect(calls[0]).toMatchObject({
      url: 'http://auth/user',
      method: 'PUT',
      headers: { authorization: 'Bearer user-jwt', apikey: 'anon' },
      body: { password: 'new-password' },
    });
  });

  it('reads the published keys, tolerating an empty or odd body', async () => {
    const keys = fakeFetch(200, { keys: [{ kty: 'EC', kid: 'k' }] });
    expect(
      await createGoTrueClient({ url: 'http://auth', anonKey: 'a', fetch: keys.fetch }).jwks(),
    ).toEqual({ keys: [{ kty: 'EC', kid: 'k' }] });
    const odd = fakeFetch(200, 'not json');
    expect(
      await createGoTrueClient({ url: 'http://auth', anonKey: 'a', fetch: odd.fetch }).jwks(),
    ).toEqual({ keys: [] });
  });

  it('describes errors from whichever field GoTrue used', async () => {
    const { fetch } = fakeFetch(422, { code: 'weak_password', message: 'too weak' });
    const client = createGoTrueClient({ url: 'http://auth', anonKey: 'anon', fetch });
    const error = await client.updatePassword('t', 'p', 'ip').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GoTrueError);
    expect(error).toMatchObject({ status: 422, code: 'weak_password', message: 'too weak' });

    const empty = fakeFetch(500, '');
    const failing = createGoTrueClient({ url: 'http://auth', anonKey: 'anon', fetch: empty.fetch });
    await expect(failing.updatePassword('t', 'p', 'ip')).rejects.toMatchObject({
      status: 500,
      code: 'unknown',
    });
  });
});

describe('GoTrue admin', () => {
  it('changes an email, confirmed, with the service-role key', async () => {
    const { fetch, calls } = fakeFetch(200, {});
    const admin = createGoTrueAdmin({ url: 'http://auth', serviceRoleKey: 'service', fetch });
    await admin.changeEmail('3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b', 'new@example.com');
    expect(calls[0]).toMatchObject({
      url: 'http://auth/admin/users/3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b',
      method: 'PUT',
      headers: { apikey: 'service', authorization: 'Bearer service' },
      body: { email: 'new@example.com', email_confirm: true },
    });
  });

  it('generates a recovery link from either response shape', async () => {
    const top = fakeFetch(200, { action_link: 'https://h/verify?token=1' });
    const admin = createGoTrueAdmin({ url: 'http://auth', serviceRoleKey: 's', fetch: top.fetch });
    expect(await admin.recoveryLink('a@b.co', 'https://h/set-password')).toBe(
      'https://h/verify?token=1',
    );
    expect(top.calls[0]?.body).toEqual({
      type: 'recovery',
      email: 'a@b.co',
      redirect_to: 'https://h/set-password',
    });

    const nested = fakeFetch(200, { properties: { action_link: 'https://h/verify?token=2' } });
    const older = createGoTrueAdmin({
      url: 'http://auth',
      serviceRoleKey: 's',
      fetch: nested.fetch,
    });
    expect(await older.recoveryLink('a@b.co', 'x')).toBe('https://h/verify?token=2');

    const none = fakeFetch(200, {});
    const broken = createGoTrueAdmin({
      url: 'http://auth',
      serviceRoleKey: 's',
      fetch: none.fetch,
    });
    await expect(broken.recoveryLink('a@b.co', 'x')).rejects.toThrow(/no recovery link/);
  });
});
