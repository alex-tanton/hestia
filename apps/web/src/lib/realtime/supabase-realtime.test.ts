import { describe, expect, it, vi } from 'vitest';
import type { SupabaseAuthClient } from '../auth/auth-client.ts';
import { createRealtimePort } from './supabase-realtime.ts';
import type { ListRealtimeHandlers } from './realtime-port.ts';

/*
 * `realtime.test.tsx` covers realtime BEHAVIOR through a stub of `RealtimePort`, never exercising
 * this file's own channel-setup code. This file is the direct unit test of that code: a minimal
 * fake of the two supabase-js calls it makes (`channel` and `removeChannel`), so a bug in the
 * subscription or in `rowId`'s payload reading would be caught here even though the stub hides it
 * from every screen test.
 */

interface OnBinding {
  event: string;
  config: { event: string; schema: string; table: string; filter: string };
  callback: (payload: { new: unknown; old: unknown }) => void;
}

interface FakeChannel {
  name: string;
  bindings: OnBinding[];
  on: (
    event: string,
    config: { event: string; schema: string; table: string; filter: string },
    callback: (payload: { new: unknown; old: unknown }) => void,
  ) => FakeChannel;
  subscribe: () => FakeChannel;
}

function createFakeClient(): {
  client: SupabaseAuthClient;
  channelsByName: Map<string, FakeChannel>;
  removedChannels: FakeChannel[];
} {
  const channelsByName = new Map<string, FakeChannel>();
  const removedChannels: FakeChannel[] = [];

  const client = {
    channel(name: string): FakeChannel {
      const bindings: OnBinding[] = [];
      const channel: FakeChannel = {
        name,
        bindings,
        on(event, config, callback) {
          bindings.push({ event, config, callback });
          return channel;
        },
        subscribe() {
          return channel;
        },
      };
      channelsByName.set(name, channel);
      return channel;
    },
    removeChannel(channel: FakeChannel) {
      removedChannels.push(channel);
    },
  };

  return { client: client as unknown as SupabaseAuthClient, channelsByName, removedChannels };
}

function handlersStub(): ListRealtimeHandlers & {
  itemChanges: (string | undefined)[];
  listChanges: number;
} {
  const itemChanges: (string | undefined)[] = [];
  let listChanges = 0;
  return {
    itemChanges,
    get listChanges() {
      return listChanges;
    },
    onItemChange: (itemId) => {
      itemChanges.push(itemId);
    },
    onListChange: () => {
      listChanges += 1;
    },
  };
}

describe('createRealtimePort', () => {
  it('opens one channel per list, named after it, with both postgres_changes bindings', async () => {
    const { client, channelsByName } = createFakeClient();
    const port = createRealtimePort(Promise.resolve(client));
    port.subscribeToList('list-1', handlersStub());

    await vi.waitFor(() => {
      expect(channelsByName.has('list:list-1')).toBe(true);
    });
    const channel = channelsByName.get('list:list-1');
    expect(channel?.bindings).toHaveLength(2);

    const [itemBinding, listBinding] = channel?.bindings ?? [];
    expect(itemBinding?.config).toEqual({
      event: '*',
      schema: 'public',
      table: 'shopping_list_item',
      filter: 'list_id=eq.list-1',
    });
    expect(listBinding?.config).toEqual({
      event: '*',
      schema: 'public',
      table: 'shopping_list',
      filter: 'id=eq.list-1',
    });
  });

  it('reads the changed row id from the new row, falling back to the old one', async () => {
    const { client, channelsByName } = createFakeClient();
    const handlers = handlersStub();
    const port = createRealtimePort(Promise.resolve(client));
    port.subscribeToList('list-1', handlers);

    await vi.waitFor(() => {
      expect(channelsByName.has('list:list-1')).toBe(true);
    });
    const [itemBinding] = channelsByName.get('list:list-1')?.bindings ?? [];

    itemBinding?.callback({ new: { id: 'item-new' }, old: null });
    itemBinding?.callback({ new: null, old: { id: 'item-old' } });
    // Neither row carries an id (malformed payload): undefined, not a thrown error.
    itemBinding?.callback({ new: null, old: null });
    itemBinding?.callback({ new: { id: 42 }, old: null });

    expect(handlers.itemChanges).toEqual(['item-new', 'item-old', undefined, undefined]);
  });

  it('signals a list-row change with no payload of its own', async () => {
    const { client, channelsByName } = createFakeClient();
    const handlers = handlersStub();
    const port = createRealtimePort(Promise.resolve(client));
    port.subscribeToList('list-1', handlers);

    await vi.waitFor(() => {
      expect(channelsByName.has('list:list-1')).toBe(true);
    });
    const [, listBinding] = channelsByName.get('list:list-1')?.bindings ?? [];
    listBinding?.callback({ new: null, old: null });

    expect(handlers.listChanges).toBe(1);
  });

  it('removes the channel it opened when torn down', async () => {
    const { client, channelsByName, removedChannels } = createFakeClient();
    const port = createRealtimePort(Promise.resolve(client));
    const teardown = port.subscribeToList('list-1', handlersStub());

    await vi.waitFor(() => {
      expect(channelsByName.has('list:list-1')).toBe(true);
    });
    teardown();

    await vi.waitFor(() => {
      expect(removedChannels).toHaveLength(1);
    });
    expect(removedChannels[0]).toBe(channelsByName.get('list:list-1'));
  });

  it('never opens a channel when torn down before the client resolves', async () => {
    let resolveClient: (client: SupabaseAuthClient) => void = () => undefined;
    const clientPromise = new Promise<SupabaseAuthClient>((resolve) => {
      resolveClient = resolve;
    });
    const { client, channelsByName, removedChannels } = createFakeClient();
    const port = createRealtimePort(clientPromise);

    const teardown = port.subscribeToList('list-1', handlersStub());
    // Cancelled before the client ever resolved — the screen unmounted mid-connect.
    teardown();
    resolveClient(client);

    // Give the resolved promise's `.then` a turn; no channel should ever open.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(channelsByName.size).toBe(0);
    expect(removedChannels).toHaveLength(0);
  });

  it('subscribes to each list under its own channel name', async () => {
    const { client, channelsByName } = createFakeClient();
    const port = createRealtimePort(Promise.resolve(client));
    port.subscribeToList('list-1', handlersStub());
    port.subscribeToList('list-2', handlersStub());

    await vi.waitFor(() => {
      expect(channelsByName.size).toBe(2);
    });
    expect([...channelsByName.keys()].sort()).toEqual(['list:list-1', 'list:list-2']);
  });

  it('swallows a client that never resolves, since the list still polls and writes', async () => {
    const port = createRealtimePort(Promise.reject(new Error('no session')));
    expect(() => port.subscribeToList('list-1', handlersStub())).not.toThrow();
    // The rejection is handled asynchronously; let that microtask run before the test ends.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
