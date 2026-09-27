import { expect, type APIRequestContext } from '@playwright/test';
import { SEED_PASSWORD, readStackEnv } from './env.ts';

/**
 * A password grant through Caddy and Kong, the way the PWA signs in (Technical Architecture,
 * "Request paths"). Tests use the token to ask the API a question the UI cannot yet ask.
 */
export async function accessToken(
  request: APIRequestContext,
  email: string,
  password: string = SEED_PASSWORD,
): Promise<string> {
  const response = await request.post('/auth/v1/token?grant_type=password', {
    headers: { apikey: readStackEnv()['ANON_KEY'] ?? '' },
    data: { email, password },
  });
  expect(response.status(), 'password grant').toBe(200);
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

/** `GET /api/households/:id` as that caller: 200 for a member, 404 for anyone else. */
export async function householdStatus(
  request: APIRequestContext,
  token: string,
  householdId: string,
): Promise<number> {
  const response = await request.get(`/api/households/${householdId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.status();
}

/**
 * `POST /api/lists/:id/items` as that caller, status only. Sent twice with the same body and the
 * same client-generated `id`, this is how a journey replays an offline write directly rather than
 * racing the browser's own queue, to prove the replay is a no-op (Handoff non-negotiable 9).
 */
export async function addListItemStatus(
  request: APIRequestContext,
  token: string,
  listId: string,
  body: Readonly<Record<string, unknown>>,
): Promise<number> {
  const response = await request.post(`/api/lists/${listId}/items`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  return response.status();
}

/**
 * `POST /api/households/:id/members/:userId/remove` as that caller, with whatever reassignments
 * are given. The gating the departure preview shows is a server rule, not a disabled button, so
 * this is how a journey asks the server directly whether an unresolved departure is refused.
 */
export async function removeMemberStatus(
  request: APIRequestContext,
  token: string,
  householdId: string,
  userId: string,
  reassignments: Readonly<Record<string, string>>,
): Promise<number> {
  const response = await request.post(`/api/households/${householdId}/members/${userId}/remove`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { reassignments },
  });
  return response.status();
}
