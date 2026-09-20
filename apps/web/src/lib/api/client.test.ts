import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE } from '@hearth/shared';
import { createApiClient, type AuthPort } from './client.ts';
import { ApiError } from './problem.ts';

const schema = z.object({ ok: z.boolean() });

function authPort(overrides: Partial<AuthPort> = {}): AuthPort {
  return {
    getAccessToken: vi.fn(() => Promise.resolve('first-token')),
    refreshAccessToken: vi.fn(() => Promise.resolve('second-token')),
    onUnauthorized: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function problem(status: number, detail: string): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'No', status, detail }), {
    status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE },
  });
}

describe('the API client', () => {
  it('sends the access token and validates the response', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(json({ ok: true })));
    const client = createApiClient(authPort(), fetchImpl);

    await expect(client.request({ method: 'GET', path: '/api/users/me', schema })).resolves.toEqual(
      { ok: true },
    );

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer first-token');
  });

  it('refreshes once on 401 and retries the request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(problem(401, 'Your session has expired.'))
      .mockResolvedValueOnce(json({ ok: true }));
    const auth = authPort();
    const client = createApiClient(auth, fetchImpl);

    await expect(client.request({ method: 'GET', path: '/api/users/me', schema })).resolves.toEqual(
      { ok: true },
    );
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.onUnauthorized).not.toHaveBeenCalled();
    const [, retry] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(new Headers(retry.headers).get('authorization')).toBe('Bearer second-token');
  });

  it('drops the session when the retry is refused too', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(problem(401, 'Your session has expired.')));
    const auth = authPort();
    const client = createApiClient(auth, fetchImpl);

    await expect(
      client.request({ method: 'GET', path: '/api/users/me', schema }),
    ).rejects.toMatchObject({ status: 401 });
    expect(auth.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('drops the session when there is no refresh token left', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(problem(401, 'Your session has expired.')));
    const auth = authPort({ refreshAccessToken: vi.fn(() => Promise.resolve(null)) });
    const client = createApiClient(auth, fetchImpl);

    await expect(
      client.request({ method: 'GET', path: '/api/users/me', schema }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(auth.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('keeps the problem details of a refusal', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(problem(403, 'Only the admin can do that.')));
    const client = createApiClient(authPort(), fetchImpl);

    await expect(
      client.send({ method: 'POST', path: '/api/households/x/invites' }),
    ).rejects.toMatchObject({ status: 403, problem: { detail: 'Only the admin can do that.' } });
  });

  it('reports a request that never reached the network as offline', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    const client = createApiClient(authPort(), fetchImpl);

    await expect(
      client.request({ method: 'GET', path: '/api/users/me', schema }),
    ).rejects.toMatchObject({ isOffline: true });
  });
});
