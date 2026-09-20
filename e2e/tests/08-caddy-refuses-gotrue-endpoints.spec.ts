import { expect, test } from '@playwright/test';
import { accessToken } from '../support/api.ts';
import { rawRequest } from '../support/raw-http.ts';
import { SEED, readStackEnv } from '../support/env.ts';

/**
 * Engineering Practices › Testing: the E2E suite, which runs through Caddy, includes a smoke test
 * that external `POST /auth/v1/signup` and `PUT /auth/v1/user` are refused, including
 * percent-encoded and doubled-slash variants of the paths.
 *
 * Only hearth-service may call those two endpoints, which it does on the Compose network, so the
 * common-password check at signup and the password re-entry for a password or email change cannot
 * be skipped by calling GoTrue directly (Technical Architecture, "Routing"). Caddy's matcher is
 * method-restricted and runs after path normalization — percent-decoding, merged duplicate
 * slashes, resolved dot segments, case-insensitive — so every spelling below is the same path.
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
