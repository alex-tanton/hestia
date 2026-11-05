import { expect, type APIRequestContext } from '@playwright/test';
import { SEED_PASSWORD, readStackEnv } from './env.ts';

/**
 * A password grant through Caddy and Kong, the way the PWA signs in. Tests use the token to ask the
 * API a question the UI cannot yet ask.
 */
export async function accessToken(
  request: APIRequestContext,
  email: string,
  password: string = SEED_PASSWORD,
): Promise<string> {
  const response = await request.post('/auth/v1/token?grant_type=password', {
    headers: { apikey: readStackEnv()['HESTIA_PUBLIC_SUPABASE_ANON_KEY'] ?? '' },
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
 * racing the browser's own queue, to prove the replay is a no-op.
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

/** The bill fields a journey checks through the API rather than the screen. */
export interface BillState {
  householdId: string | null;
  currentOccurrenceDate: string;
  isOverdue: boolean;
  payments: {
    occurrenceDate: string;
    paidDate: string | null;
    amountPaidCents: number | null;
    isAuto: boolean;
    isSkipped: boolean;
  }[];
}

/** `GET /api/bills/:id` as that caller: the derived current occurrence and the payment log. */
export async function billState(
  request: APIRequestContext,
  token: string,
  billId: string,
): Promise<BillState> {
  const response = await request.get(`/api/bills/${billId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status(), `GET /api/bills/${billId}`).toBe(200);
  return (await response.json()) as BillState;
}

/** The ids of the household's bills the caller can see, as `GET /api/households/:id/bills` lists them. */
export async function householdBillIds(
  request: APIRequestContext,
  token: string,
  householdId: string,
): Promise<string[]> {
  const response = await request.get(`/api/households/${householdId}/bills`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status(), 'GET household bills').toBe(200);
  const bills = (await response.json()) as { id: string }[];
  return bills.map((bill) => bill.id);
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
