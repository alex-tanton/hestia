import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Household, ShoppingListDetail } from '@hestia/shared';
import {
  as,
  signUp,
  stackConfig,
  startStack,
  uniqueName,
  type SignedUpUser,
  type Stack,
} from './test/service-stack.js';

/*
 * Realtime propagation for lists. The PWA subscribes to Supabase Realtime directly rather than
 * through the service, so the only thing that protects a stream is RLS: this asserts that a
 * household member receives another member's change and that a non-member receives nothing at all.
 *
 * The socket is driven with the Phoenix frames Realtime speaks, through Node's own WebSocket, so
 * the test needs no client library.
 */

let stack: Stack;
let app: FastifyInstance;

beforeAll(async () => {
  stack = await startStack();
  app = await stack.newApp();
});

afterAll(async () => {
  await stack.close();
});

interface Change {
  table: string;
  eventType: string;
  record: Record<string, unknown>;
}

interface Subscription {
  changes: Change[];
  waitFor: (match: (change: Change) => boolean, timeoutMs?: number) => Promise<Change>;
  close: () => void;
}

interface PhoenixFrame {
  topic: string;
  event: string;
  ref?: string | null;
  payload: Record<string, unknown>;
}

/** Joins `realtime:list:<id>`, the channel shape the PWA uses for one list. */
async function subscribeToList(token: string, listId: string): Promise<Subscription> {
  const config = stackConfig();
  const url = new URL(config.gotrueUrl.replace('/auth/v1', '/realtime/v1/websocket'));
  url.protocol = 'ws:';
  url.searchParams.set('apikey', config.anonKey);
  url.searchParams.set('vsn', '1.0.0');
  const socket = new WebSocket(url.toString());
  const changes: Change[] = [];
  const listeners = new Set<() => void>();

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve();
    });
    socket.addEventListener('error', () => {
      reject(new Error('the realtime socket would not open'));
    });
  });

  // Realtime acknowledges the join before it has started replicating, and announces the second
  // step with a `system` frame. Waiting only for the reply would race the first change.
  const joined = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('the realtime channel never confirmed the subscription'));
    }, 20_000);
    socket.addEventListener('message', (event) => {
      // Node's WebSocket types leave the event's data as `any`; every frame here is text.
      const { data } = event as unknown as { data: string };
      const frame = JSON.parse(data) as PhoenixFrame;
      if (frame.event === 'phx_reply' && frame.ref === '1') {
        const status = (frame.payload as { status?: string }).status;
        if (status !== 'ok') {
          clearTimeout(timer);
          reject(new Error(`the realtime channel refused the subscription: ${String(status)}`));
        }
      }
      if (frame.event === 'system') {
        const payload = frame.payload as { status?: string; extension?: string };
        if (payload.extension === 'postgres_changes') {
          clearTimeout(timer);
          if (payload.status === 'ok') resolve();
          else reject(new Error('the realtime channel could not subscribe to postgres changes'));
        }
      }
      if (frame.event === 'postgres_changes') {
        const data = (frame.payload as { data?: Record<string, unknown> }).data;
        if (data === undefined) return;
        // Realtime's own frames name the operation `type`; a DELETE carries only `old_record`,
        // which holds the primary key alone under the default replica identity.
        changes.push({
          table: String(data['table']),
          eventType: String(data['type']),
          record: (data['record'] ?? data['old_record'] ?? {}) as Record<string, unknown>,
        });
        for (const listener of listeners) listener();
      }
    });
  });

  socket.send(
    JSON.stringify({
      topic: `realtime:list:${listId}`,
      event: 'phx_join',
      ref: '1',
      payload: {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
          private: false,
          postgres_changes: [
            {
              event: '*',
              schema: 'public',
              table: 'shopping_list_item',
              filter: `list_id=eq.${listId}`,
            },
            { event: '*', schema: 'public', table: 'shopping_list', filter: `id=eq.${listId}` },
          ],
        },
        access_token: token,
      },
    }),
  );
  await joined;

  return {
    changes,
    waitFor: (match, timeoutMs = 10_000) =>
      new Promise<Change>((resolve, reject) => {
        const settle = (): void => {
          const found = changes.find(match);
          if (found === undefined) return;
          listeners.delete(listener);
          clearTimeout(timer);
          resolve(found);
        };
        const listener = (): void => {
          settle();
        };
        const timer = setTimeout(() => {
          listeners.delete(listener);
          reject(new Error('no matching realtime change arrived'));
        }, timeoutMs);
        listeners.add(listener);
        settle();
      }),
    close: () => {
      socket.close();
    },
  };
}

async function createHousehold(user: SignedUpUser): Promise<Household> {
  const response = await as(app, user, 'POST', '/api/households', {
    name: uniqueName('Oak Street'),
    postalCode: '27514',
    timezone: 'America/New_York',
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<Household>();
}

describe('realtime list sharing', () => {
  it('delivers a member’s change to another member, and nothing to a stranger', async () => {
    const admin = await signUp(app, 'Alex Rivera');
    const household = await createHousehold(admin);
    const invite = await as(app, admin, 'POST', `/api/households/${household.id}/invites`);
    expect(invite.statusCode, invite.body).toBe(201);
    const member = await signUp(app, 'Sam Chen');
    const joined = await as(app, member, 'POST', '/api/households/join', {
      tokenOrCode: invite.json<{ code: string }>().code,
    });
    expect(joined.statusCode, joined.body).toBe(200);

    const created = await as(app, admin, 'POST', `/api/households/${household.id}/lists`, {
      name: 'This Week',
    });
    expect(created.statusCode, created.body).toBe(201);
    const list = created.json<ShoppingListDetail>();

    const stranger = await signUp(app, 'Blake Stranger');
    await createHousehold(stranger);

    const watcher = await subscribeToList(member.token, list.id);
    const outsider = await subscribeToList(stranger.token, list.id);
    try {
      const added = await as(app, admin, 'POST', `/api/lists/${list.id}/items`, {
        source: 'manual',
        itemName: 'Milk',
      });
      expect(added.statusCode, added.body).toBe(201);

      const insert = await watcher.waitFor(
        (change) => change.table === 'shopping_list_item' && change.eventType === 'INSERT',
      );
      expect(insert.record['item_name']).toBe('Milk');

      // The list's own row changes too, because the trigger bumps its last activity.
      const touched = await watcher.waitFor(
        (change) => change.table === 'shopping_list' && change.eventType === 'UPDATE',
      );
      expect(touched.record['id']).toBe(list.id);

      const itemId = String(insert.record['id']);
      await as(app, admin, 'PATCH', `/api/lists/${list.id}/items/${itemId}`, { status: 'bought' });
      const update = await watcher.waitFor(
        (change) => change.table === 'shopping_list_item' && change.eventType === 'UPDATE',
      );
      expect(update.record['status']).toBe('bought');

      // A delete on a filtered subscription carries only the primary key, so the filter on
      // `list_id` cannot match it and Realtime does not deliver it. The list row's own update is
      // what tells the PWA to refetch, which is why the subscription binds to both tables.
      const beforeDelete = String(
        [...watcher.changes].reverse().find((change) => change.table === 'shopping_list')?.record[
          'updated_at'
        ],
      );
      await as(app, admin, 'DELETE', `/api/lists/${list.id}/items/${itemId}`);
      await watcher.waitFor(
        (change) =>
          change.table === 'shopping_list' && String(change.record['updated_at']) > beforeDelete,
      );
      // The claim the two bindings rest on: the item delete itself never arrived. By the time the
      // list row's update is in hand, Realtime has processed that transaction.
      expect(
        watcher.changes.filter(
          (change) => change.table === 'shopping_list_item' && change.eventType === 'DELETE',
        ),
      ).toEqual([]);

      // RLS governs the stream the same way it governs a read: the stranger saw none of it.
      expect(outsider.changes).toEqual([]);
    } finally {
      watcher.close();
      outsider.close();
    }
  }, 40_000);
});
