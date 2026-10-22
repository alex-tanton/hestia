import { expect, test } from '@playwright/test';
import { accessToken } from '../support/api.ts';
import { rawRequest } from '../support/raw-http.ts';
import { SEED, readStackEnv } from '../support/env.ts';

/**
 * The E2E suite, which runs through Caddy, includes a smoke test that external
 * `POST /auth/v1/signup` and `PUT /auth/v1/user` are refused, including percent-encoded and
 * doubled-slash variants of the paths.
 *
 * Only hearth-service may call those two endpoints, which it does on the Compose network, so the
 * common-password check at signup and the password re-entry for a password or email change cannot
 * be skipped by calling GoTrue directly. Caddy's matcher is method-restricted and runs after path
 * normalization — percent-decoding, merged duplicate slashes, resolved dot segments,
 * case-insensitive — so every spelling below is the same path. Kong, the second layer behind Caddy,
 * is probed further down too.
 */

const SIGNUP_SPELLINGS = [
  '/auth/v1/signup',
  '/auth/v1/%73ignup',
  '/%61uth/v1/signup',
  '//auth/v1/signup',
  '/auth//v1/signup',
  '/auth/v1//signup',
  '/auth/v1/./signup',
  '/auth/v1/x/../signup',
  '/AUTH/V1/SIGNUP',
  '/auth/v1/signup/',
  '/auth/v1/signup?redirect_to=%2F',
];

const USER_SPELLINGS = [
  '/auth/v1/user',
  '/auth/v1/%75ser',
  '/%61uth/v1/user',
  '//auth/v1/user',
  '/auth//v1/user',
  '/auth/v1//user',
  '/auth/v1/./user',
  '/auth/v1/x/../user',
  '/AUTH/V1/USER',
  '/auth/v1/user/',
  '/auth/v1/user?x=1',
];

test('POST /auth/v1/signup is refused in every spelling', async () => {
  for (const path of SIGNUP_SPELLINGS) {
    const response = await rawRequest('POST', path);
    expect(response.status, `POST ${path}`).toBe(403);
  }
});

test('PUT /auth/v1/user is refused in every spelling', async () => {
  for (const path of USER_SPELLINGS) {
    const response = await rawRequest('PUT', path);
    expect(response.status, `PUT ${path}`).toBe(403);
  }
});

test('the refusal is method-restricted, so sign-in still reaches GoTrue', async ({ request }) => {
  const apikey = readStackEnv()['ANON_KEY'] ?? '';

  // Same path, different method: Kong and GoTrue answer, so it is 401 for a missing token.
  const read = await rawRequest('GET', '/auth/v1/user', { apikey });
  expect(read.status).toBe(401);

  // And the password grant the PWA signs in with is untouched.
  const token = await accessToken(request, SEED.alex.email);
  expect(token.length).toBeGreaterThan(0);
});

/**
 * Kong is the second layer. These are paths and methods Caddy passes through to it, and Kong
 * refuses them itself: its refusing route answers 403 with its own body, which tells it apart from
 * Caddy's empty 403 and from anything GoTrue would have answered (docker/kong.yml: GoTrue is an
 * allowlist, so only the calls supabase-js makes for sign-in, refresh and sign-out have a route).
 */

const KONG_REFUSAL = 'Access is forbidden.';

const KONG_REFUSED: readonly (readonly [method: string, path: string])[] = [
  // GoTrue endpoints the PWA never calls.
  ['POST', '/auth/v1/recover'],
  ['GET', '/auth/v1/settings'],
  ['GET', '/auth/v1/.well-known/jwks.json'],
  ['POST', '/auth/v1/invite'],
  ['POST', '/auth/v1/admin/generate_link'],
  ['GET', '/auth/v1/admin/users/00000000-0000-4000-8000-000000000000'],
  ['GET', '/auth/v1/authorize'],
  // A path the PWA does call, with a method it does not.
  ['GET', '/auth/v1/token'],
  ['PUT', '/auth/v1/token'],
  ['DELETE', '/auth/v1/logout'],
  ['POST', '/auth/v1/user'],
  ['PUT', '/auth/v1/admin/users'],
  // The same refusals in the spellings Caddy normalizes: Kong must not be reachable by one either.
  ['POST', '/auth/v1/%72ecover'],
  ['POST', '/auth/v1/x/../recover'],
  ['POST', '//auth/v1/recover'],
  ['POST', '/auth/v1/recover/'],
  ['POST', '/auth/v1/recover?redirect_to=%2F'],
];

test('Kong refuses every GoTrue path and method that has no route, with or without a key', async () => {
  const apikey = readStackEnv()['ANON_KEY'] ?? '';
  // Soft assertions, so one run lists every combination Kong does not refuse.
  for (const [method, path] of KONG_REFUSED) {
    for (const [keyed, headers] of [
      ['without a key', {}],
      ['with the anon key', { apikey }],
    ] as const) {
      const label = `${method} ${path} ${keyed}`;
      const response = await rawRequest(method, path, headers);
      expect.soft(response.status, label).toBe(403);
      expect.soft(response.body, label).toContain(KONG_REFUSAL);
    }
  }
});

test('Kong answers the calls the PWA makes itself', async () => {
  const apikey = readStackEnv()['ANON_KEY'] ?? '';
  const refused = (body: string): boolean => body.includes(KONG_REFUSAL);

  // Sign-in and refresh: a bad grant is GoTrue's 400, not a refusal.
  const grant = await rawRequest('POST', '/auth/v1/token?grant_type=password', { apikey });
  expect(grant.status).toBe(400);
  expect(refused(grant.body)).toBe(false);
  const refresh = await rawRequest('POST', '/auth/v1/token?grant_type=refresh_token', { apikey });
  expect(refused(refresh.body)).toBe(false);

  // Sign-out and the session check need a bearer token, which GoTrue says.
  const logout = await rawRequest('POST', '/auth/v1/logout?scope=local', { apikey });
  expect(refused(logout.body)).toBe(false);
  const user = await rawRequest('GET', '/auth/v1/user', { apikey });
  expect(user.status).toBe(401);
  expect(refused(user.body)).toBe(false);

  // The email link opens with no apikey at all.
  const verify = await rawRequest('GET', '/auth/v1/verify?token=nope&type=recovery');
  expect(refused(verify.body)).toBe(false);
  expect(verify.status).toBeLessThan(500);

  // Admin is the service-role key's alone: the anon key is turned away by the ACL, not the refusal.
  const admin = await rawRequest('GET', '/auth/v1/admin/users', { apikey });
  expect(admin.status).toBe(403);
  expect(refused(admin.body)).toBe(false);
});
