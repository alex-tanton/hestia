import { expect, type APIRequestContext } from '@playwright/test';
import { readStackEnv } from './env.ts';

/*
 * The E2E push double, from the suite's side. The stack records each push instead of sending it
 * (HEARTH_PUSH_TRANSPORT=test-double), and these helpers run the dispatch job at a chosen instant
 * and read the record back. Both go through the service-role seam, so they need the run's own
 * generated key from `.env`.
 */

/** One push as the service recorded it: the subscription it was for and the JSON it carried. */
export interface Delivery {
  endpoint: string;
  message: string;
}

/** The body the service sends for a notification. */
export interface PushBody {
  title: string;
  body: string;
  url: string;
  householdId?: string;
}

function serviceRoleHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${readStackEnv()['SERVICE_ROLE_KEY'] ?? ''}` };
}

/**
 * Runs `dispatch-notifications` with `now` as its clock, so a reminder whose send time falls at or
 * before that instant is written and sent in this one call. The job's own schedule is every two
 * minutes; the suite does not wait for it. Returns false when another run held the job's lock.
 */
export async function runDispatchAt(request: APIRequestContext, now: Date): Promise<boolean> {
  const response = await request.post('/api/test/push/dispatch', {
    headers: serviceRoleHeaders(),
    data: { now: now.toISOString() },
  });
  expect(response.status(), 'push seam: dispatch').toBe(200);
  return ((await response.json()) as { ran: boolean }).ran;
}

/** Every push the service has recorded for this run, in the order the transport was called. */
export async function recordedDeliveries(request: APIRequestContext): Promise<Delivery[]> {
  const response = await request.get('/api/test/push/deliveries', {
    headers: serviceRoleHeaders(),
  });
  expect(response.status(), 'push seam: deliveries').toBe(200);
  return ((await response.json()) as { deliveries: Delivery[] }).deliveries;
}

export function parsePushBody(message: string): PushBody {
  return JSON.parse(message) as PushBody;
}
