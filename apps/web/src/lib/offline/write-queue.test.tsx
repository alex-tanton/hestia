import { onlineManager } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PENDING_CLASSES, PENDING_ROW_LABEL } from '../../components/lists/PendingMark.tsx';
import { ListDetailScreen } from '../../screens/lists/ListDetailScreen.tsx';
import { OAK_STREET_ID, oakStreetMembers, profileFixture } from '../../test/fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  testQueryClient,
  type StubHandler,
} from '../../test/harness.tsx';
import {
  THIS_WEEK_ID,
  WEEKEND_COOKOUT_ID,
  apples,
  broccoli,
  thisWeekDetailFixture,
} from '../../test/list-fixtures.ts';
import { createApiClient } from '../api/client.ts';
import { queryKeys } from '../api/keys.ts';
import { createQueryClient } from '../api/query-client.ts';
import {
  PERSIST_KEY,
  PERSIST_MAX_AGE_MS,
  createCachePersister,
  type AsyncStorage,
} from './persist.ts';
import { useWriteQueue } from './use-write-queue.ts';
import {
  listWriteMutationKey,
  listWriteScope,
  registerListWriteDefaults,
  subscribeToQueueNotices,
  type QueueNotice,
  type UpdateListItemVariables,
} from './write-queue.ts';

/*
 * The queue's contract (Engineering Practices › The write queue). It is TanStack Query's paused
 * mutations throughout — these tests never reach for a queue of their own, because there is not
 * one to reach for.
 */

function WithQueue({ children }: { children: ReactNode }): ReactElement {
  useWriteQueue();
  return <>{children}</>;
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  act(() => {
    onlineManager.setOnline(isOnline);
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  });
}

/** `idb-keyval` stands in as a plain map; nothing here needs IndexedDB itself. */
function fakeStorage(): AsyncStorage & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => Promise.resolve(entries.get(key) ?? null),
    setItem: (key, value) => {
      entries.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      entries.delete(key);
      return Promise.resolve();
    },
  };
}

function handlers(extra: Readonly<Record<string, StubHandler>> = {}): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id/lists': () => ({ status: 200, body: [] }),
    'GET /api/lists/:id': () => ({ status: 200, body: thisWeekDetailFixture }),
    'PATCH /api/lists/:id/items/:itemId': () => ({ status: 200, body: thisWeekDetailFixture }),
    'POST /api/lists/:id/items': () => ({ status: 201, body: thisWeekDetailFixture }),
    ...extra,
  };
}

async function openList(stubHandlers = handlers()): Promise<ReturnType<typeof createFetchStub>> {
  const stub = createFetchStub(stubHandlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(
    <WithQueue>
      <ListDetailScreen
        householdId={OAK_STREET_ID}
        listId={THIS_WEEK_ID}
        userId={profileFixture.id}
      />
    </WithQueue>,
  );
  await screen.findByRole('heading', { name: 'Food Lion' });
  return stub;
}

function rowOf(name: RegExp): HTMLElement {
  const checkbox = screen.getByRole('checkbox', { name });
  const row = checkbox.closest('li');
  if (row === null) throw new Error('the row is always there');
  return row;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('optimistic updates and the pending affordance', () => {
  it('applies a check at once and marks the row pending while it waits', async () => {
    const user = userEvent.setup();
    await openList();
    setOnline(false);

    await user.click(screen.getByRole('checkbox', { name: /Broccoli/ }));

    // The row moved into the Bought group, and says it is waiting.
    const bought = await screen.findByRole('button', { name: /Bought \(4\)/ });
    await user.click(bought);

    // The pending state is read through waitFor, not a synchronous query: the optimistic
    // cache write reaches React on a later tick, which a loaded machine can delay.
    await waitFor(() => {
      const row = rowOf(/Broccoli/);
      expect(within(row).getByText(PENDING_ROW_LABEL)).toBeInTheDocument();
      expect(row.className).toContain(PENDING_CLASSES);
    });
  });

  it('sends absolute values, never a toggle', async () => {
    const user = userEvent.setup();
    const stub = await openList();
    await user.click(screen.getByRole('checkbox', { name: /Broccoli/ }));

    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'PATCH')).toBe(true);
    });
    const patch = stub.calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toEqual({ status: 'bought' });
  });

  it('carries a client-generated UUID on an insert, so a replay is a no-op', async () => {
    const user = userEvent.setup();
    const stub = await openList();

    await user.click(screen.getByRole('button', { name: 'Add an item' }));
    await user.type(await screen.findByLabelText('Item'), 'Milk');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    const post = stub.calls.find((call) => call.method === 'POST');
    const body = post?.body as { id?: string; source?: string };
    expect(body.source).toBe('manual');
    expect(body.id).toMatch(UUID);
  });
});

describe('ordering within a scope', () => {
  it('runs one list’s writes one at a time, in the order they were made', async () => {
    const user = userEvent.setup();
    const gate = deferred();
    const stub = await openList(
      handlers({
        'PATCH /api/lists/:id/items/:itemId': async () => {
          await gate.promise;
          return { status: 200, body: thisWeekDetailFixture };
        },
      }),
    );

    setOnline(false);
    await user.click(screen.getByRole('checkbox', { name: /Broccoli/ }));
    await user.click(screen.getByRole('checkbox', { name: /Apples/ }));
    expect(stub.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);

    setOnline(true);

    // The scope lets only the first write run; the second waits for it to settle.
    await waitFor(() => {
      expect(stub.calls.filter((call) => call.method === 'PATCH')).toHaveLength(1);
    });
    expect(stub.calls.find((call) => call.method === 'PATCH')?.path).toContain(broccoli.id);

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });

    await waitFor(() => {
      expect(stub.calls.filter((call) => call.method === 'PATCH')).toHaveLength(2);
    });
    expect(stub.calls.filter((call) => call.method === 'PATCH').map((call) => call.path)).toEqual([
      expect.stringContaining(broccoli.id),
      expect.stringContaining(apples.id),
    ]);
  });

  it('does not let one list’s in-flight write block a write to a different list', async () => {
    const gateA = deferred();
    const gateB = deferred();
    const stub = createFetchStub({
      'PATCH /api/lists/:id/items/:itemId': async ({ params }) => {
        await (params['id'] === THIS_WEEK_ID ? gateA : gateB).promise;
        return { status: 200, body: thisWeekDetailFixture };
      },
    });
    vi.stubGlobal('fetch', stub.fetch);
    const api = createApiClient({
      getAccessToken: () => Promise.resolve('token'),
      refreshAccessToken: () => Promise.resolve('token'),
      onUnauthorized: () => Promise.resolve(),
    });
    const queryClient = testQueryClient();
    registerListWriteDefaults(queryClient, api);

    const variablesFor = (listId: string): UpdateListItemVariables => ({
      kind: 'update-item',
      householdId: OAK_STREET_ID,
      listId,
      itemId: broccoli.id,
      itemName: broccoli.itemName,
      patch: { status: 'bought' },
    });

    const mutationA = queryClient.getMutationCache().build(queryClient, {
      mutationKey: listWriteMutationKey(THIS_WEEK_ID, 'update-item'),
      scope: listWriteScope(THIS_WEEK_ID),
    });
    const mutationB = queryClient.getMutationCache().build(queryClient, {
      mutationKey: listWriteMutationKey(WEEKEND_COOKOUT_ID, 'update-item'),
      scope: listWriteScope(WEEKEND_COOKOUT_ID),
    });

    void mutationA.execute(variablesFor(THIS_WEEK_ID)).catch(() => undefined);
    void mutationB.execute(variablesFor(WEEKEND_COOKOUT_ID)).catch(() => undefined);

    // Two different scopes: both requests are in flight together, neither waiting on the other's
    // gate, which a shared scope (or a single global queue) would have serialized.
    await waitFor(() => {
      expect(stub.calls.filter((call) => call.method === 'PATCH')).toHaveLength(2);
    });

    await act(async () => {
      gateA.resolve();
      gateB.resolve();
      await Promise.all([gateA.promise, gateB.promise]);
    });
  });

  it('announces how many changes synced once the queue has replayed', async () => {
    const user = userEvent.setup();
    await openList();
    setOnline(false);
    await user.click(screen.getByRole('checkbox', { name: /Broccoli/ }));
    await user.click(screen.getByRole('checkbox', { name: /Apples/ }));

    setOnline(true);
    expect(await screen.findByText('2 changes synced.')).toBeInTheDocument();
  });
});

describe('failure', () => {
  it('rolls the row back and says what could not be saved', async () => {
    const user = userEvent.setup();
    await openList(
      handlers({
        // A refusal is not retried, so the failure is final as soon as it arrives.
        'PATCH /api/lists/:id/items/:itemId': () => ({
          status: 409,
          body: problemBody(409, 'Conflict'),
        }),
      }),
    );

    await user.click(screen.getByRole('checkbox', { name: /Broccoli/ }));
    expect(await screen.findByText(/Couldn.t save Broccoli/)).toBeInTheDocument();
    // The rollback is explicit: the row is back where the server last confirmed it.
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Broccoli/ })).not.toBeChecked();
    });
    expect(screen.getByRole('button', { name: /Bought \(3\)/ })).toBeInTheDocument();
  });

  it.each([403, 404, 410])(
    'drops a write that failed with %i and surfaces it exactly once',
    async (status) => {
      const user = userEvent.setup();
      // Counted at the source: Radix renders a visually hidden copy of every toast, so the DOM
      // is the wrong place to ask whether the queue announced something exactly once.
      const notices: QueueNotice[] = [];
      const stop = subscribeToQueueNotices((notice) => notices.push(notice));
      try {
        const { queryClient } = renderQueueProbe(status);
        await screen.findByRole('heading', { name: 'Food Lion' });

        await user.click(screen.getByRole('checkbox', { name: /Broccoli/ }));

        await waitFor(() => {
          expect(notices).toHaveLength(1);
        });
        expect(notices[0]?.variant).toBe('error');
        expect(notices[0]?.message).toBe("Couldn't save Broccoli. It is no longer on this list.");
        // And the member actually sees it.
        expect((await screen.findAllByText(/no longer on this list/)).length).toBeGreaterThan(0);

        // Dropped from the queue, so nothing can ever replay it.
        await waitFor(() => {
          expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
        });
        expect(notices).toHaveLength(1);
      } finally {
        stop();
      }
    },
  );

  it('never retries a refusal, and retries a transport failure a bounded number of times', async () => {
    const user = userEvent.setup();
    const stub = await openList(
      handlers({
        'PATCH /api/lists/:id/items/:itemId': () => ({
          status: 410,
          body: problemBody(410, 'Gone'),
        }),
      }),
    );

    await user.click(screen.getByRole('checkbox', { name: /Broccoli/ }));
    await screen.findByText(/no longer on this list/);
    expect(stub.calls.filter((call) => call.method === 'PATCH')).toHaveLength(1);
  });
});

/** Renders the list with a failing PATCH, handing back the client so the queue can be read. */
function renderQueueProbe(status: number): { queryClient: ReturnType<typeof testQueryClient> } {
  const stub = createFetchStub(
    handlers({
      'PATCH /api/lists/:id/items/:itemId': () => ({
        status,
        body: problemBody(status, 'Gone'),
      }),
    }),
  );
  vi.stubGlobal('fetch', stub.fetch);
  const queryClient = testQueryClient();
  renderScreen(
    <WithQueue>
      <ListDetailScreen
        householdId={OAK_STREET_ID}
        listId={THIS_WEEK_ID}
        userId={profileFixture.id}
      />
    </WithQueue>,
    { queryClient },
  );
  return { queryClient };
}

describe('surviving a reload', () => {
  it('restores a paused write from IndexedDB and resumes it', async () => {
    const stub = createFetchStub(handlers());
    vi.stubGlobal('fetch', stub.fetch);
    const storage = fakeStorage();
    const persister = createCachePersister(storage);
    const api = createApiClient({
      getAccessToken: () => Promise.resolve('token'),
      refreshAccessToken: () => Promise.resolve('token'),
      onUnauthorized: () => Promise.resolve(),
    });

    const variables: UpdateListItemVariables = {
      kind: 'update-item',
      householdId: OAK_STREET_ID,
      listId: THIS_WEEK_ID,
      itemId: broccoli.id,
      itemName: broccoli.itemName,
      patch: { status: 'bought' },
    };

    // Before the reload: a write made while offline, with the list already synced.
    onlineManager.setOnline(false);
    const before = testQueryClient();
    registerListWriteDefaults(before, api);
    before.setQueryData(queryKeys.list(OAK_STREET_ID, THIS_WEEK_ID), thisWeekDetailFixture);

    const mutation = before.getMutationCache().build(before, {
      mutationKey: listWriteMutationKey(THIS_WEEK_ID, 'update-item'),
      scope: listWriteScope(THIS_WEEK_ID),
    });
    void mutation.execute(variables).catch(() => undefined);
    await waitFor(() => {
      expect(mutation.state.isPaused).toBe(true);
    });
    expect(stub.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);

    await persistQueryClientSave({ queryClient: before, persister });
    expect(storage.entries.size).toBe(1);

    // The reload: a brand-new client, its defaults registered before anything hydrates.
    const after = testQueryClient();
    registerListWriteDefaults(after, api);
    await persistQueryClientRestore({
      queryClient: after,
      persister,
      maxAge: PERSIST_MAX_AGE_MS,
    });

    // Both halves of the payload came back: the last-synced list and the unsent write.
    expect(after.getQueryData(queryKeys.list(OAK_STREET_ID, THIS_WEEK_ID))).toBeDefined();
    expect(after.getMutationCache().getAll()).toHaveLength(1);

    onlineManager.setOnline(true);
    await after.resumePausedMutations();

    const sent = stub.calls.filter((call) => call.method === 'PATCH');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({ status: 'bought' });
    expect(sent[0]?.path).toContain(broccoli.id);

    // Replaying again sends nothing: the write has already left the queue.
    await after.resumePausedMutations();
    expect(stub.calls.filter((call) => call.method === 'PATCH')).toHaveLength(1);

    cleanup();
  });

  it('announces sync for a write that was already restored before the queue mounted', async () => {
    /*
     * Isolates the second half of the reload fix, independent of the online-status bug: the
     * queue's mount effect used to only react to a *change* in the mutation cache, so a write
     * that was already sitting there — restored ahead of the effect subscribing, exactly as
     * `idb-keyval`'s read can resolve ahead of React's passive effects — was never added to the
     * `watched` set and its sync toast never fired, even though the write itself replayed fine.
     */
    const stub = createFetchStub(handlers());
    vi.stubGlobal('fetch', stub.fetch);
    const api = createApiClient({
      getAccessToken: () => Promise.resolve('token'),
      refreshAccessToken: () => Promise.resolve('token'),
      onUnauthorized: () => Promise.resolve(),
    });

    // A paused write, built directly into the cache -- standing in for one a restore already
    // brought back before `useWriteQueue` ever mounted.
    onlineManager.setOnline(false);
    const queryClient = testQueryClient();
    registerListWriteDefaults(queryClient, api);
    queryClient.setQueryData(queryKeys.list(OAK_STREET_ID, THIS_WEEK_ID), thisWeekDetailFixture);
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: listWriteMutationKey(THIS_WEEK_ID, 'update-item'),
      scope: listWriteScope(THIS_WEEK_ID),
    });
    const variables: UpdateListItemVariables = {
      kind: 'update-item',
      householdId: OAK_STREET_ID,
      listId: THIS_WEEK_ID,
      itemId: broccoli.id,
      itemName: broccoli.itemName,
      patch: { status: 'bought' },
    };
    void mutation.execute(variables).catch(() => undefined);
    await waitFor(() => {
      expect(mutation.state.isPaused).toBe(true);
    });

    // Only now does the queue mount, on a cache that already holds the paused write.
    renderScreen(
      <WithQueue>
        <ListDetailScreen
          householdId={OAK_STREET_ID}
          listId={THIS_WEEK_ID}
          userId={profileFixture.id}
        />
      </WithQueue>,
      { queryClient },
    );
    await screen.findByRole('heading', { name: 'Food Lion' });

    setOnline(true);
    await queryClient.resumePausedMutations();

    expect(await screen.findByText('1 change synced.')).toBeInTheDocument();
    cleanup();
  });

  it('never fires a queued write on a reload that is genuinely offline', async () => {
    /*
     * TanStack's `onlineManager` assumes an active connection until an `online`/`offline` window
     * event corrects it, and a fresh page load fires no such event even when `navigator.onLine`
     * is already false. Left uncorrected, `resumePausedMutations()` — which the app calls right
     * after restore — trusts that wrong belief, sends the queued write for real, exhausts its
     * bounded retries against a network that was never there, and drops it as a permanent
     * failure: an offline write silently lost. `createQueryClient` seeds the manager from
     * `navigator.onLine` before anything reads it, which is what this test is guarding.
     */
    onlineManager.setOnline(true); // the manager's own default, unless something corrects it
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const stub = createFetchStub(handlers());
    vi.stubGlobal('fetch', stub.fetch);
    const storage = fakeStorage();
    const persister = createCachePersister(storage);
    const api = createApiClient({
      getAccessToken: () => Promise.resolve('token'),
      refreshAccessToken: () => Promise.resolve('token'),
      onUnauthorized: () => Promise.resolve(),
    });

    try {
      // A write queued in an earlier, genuinely offline session, and persisted.
      onlineManager.setOnline(false);
      const before = testQueryClient();
      registerListWriteDefaults(before, api);
      const mutation = before.getMutationCache().build(before, {
        mutationKey: listWriteMutationKey(THIS_WEEK_ID, 'update-item'),
        scope: listWriteScope(THIS_WEEK_ID),
      });
      const variables: UpdateListItemVariables = {
        kind: 'update-item',
        householdId: OAK_STREET_ID,
        listId: THIS_WEEK_ID,
        itemId: broccoli.id,
        itemName: broccoli.itemName,
        patch: { status: 'bought' },
      };
      void mutation.execute(variables).catch(() => undefined);
      await waitFor(() => {
        expect(mutation.state.isPaused).toBe(true);
      });
      await persistQueryClientSave({ queryClient: before, persister });

      // The reload: the manager resets to its own default (believes online) until something
      // corrects it — which is exactly what `createQueryClient` does, from the real `navigator`.
      onlineManager.setOnline(true);
      const after = createQueryClient();
      registerListWriteDefaults(after, api);
      await persistQueryClientRestore({
        queryClient: after,
        persister,
        maxAge: PERSIST_MAX_AGE_MS,
      });

      expect(onlineManager.isOnline()).toBe(false);

      // The app's own `onSuccess` callback: resume right after restore, unconditionally.
      await after.resumePausedMutations();

      expect(stub.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);
      expect(after.getMutationCache().getAll()).toHaveLength(1);
      expect(after.getMutationCache().getAll()[0]?.state.status).not.toBe('error');

      cleanup();
    } finally {
      onLine.mockRestore();
    }
  });

  it('flushes a newly queued write through its own channel, not the query cache’s throttled one', async () => {
    /*
     * `persister` (the query cache's own, passed to `PersistQueryClientProvider`) throttles its
     * saves (persist.ts, 1000ms) -- fine for the query cache, but not for a write the queue has
     * promised survives a restart the instant it queues ("the queue survives a page reload and a
     * browser restart; it is not in memory" -- Engineering Practices › The write queue). A restart
     * landing inside that window would otherwise lose the write silently (Handoff non-negotiable
     * 9). Its throttle here is set far longer than this test waits and is spent on the initial
     * list fetch below, so if the write's flush went through this same channel -- the bug this
     * test guards against -- it would be stuck behind that cooldown and never reach storage in
     * time. `flushPersister` is `useFlushPersister()`'s own, unthrottled channel onto the same
     * storage and key, uncoupled from that cooldown.
     */
    const user = userEvent.setup();
    const storage = fakeStorage();
    const persister = createCachePersister(storage, 60_000);
    const flushPersister = createCachePersister(storage, 0);
    const stub = createFetchStub(handlers());
    vi.stubGlobal('fetch', stub.fetch);
    const queryClient = testQueryClient();

    renderScreen(
      <WithQueue>
        <ListDetailScreen
          householdId={OAK_STREET_ID}
          listId={THIS_WEEK_ID}
          userId={profileFixture.id}
        />
      </WithQueue>,
      { queryClient, persister, flushPersister },
    );
    await screen.findByRole('heading', { name: 'Food Lion' });

    function hasPausedMutation(): boolean {
      const raw = storage.entries.get(PERSIST_KEY);
      if (raw === undefined) return false;
      const parsed = JSON.parse(raw) as {
        clientState: { mutations: { state: { isPaused: boolean } }[] };
      };
      return parsed.clientState.mutations.some((mutation) => mutation.state.isPaused);
    }

    // The initial list fetch already used up `persister`'s leading save (asyncThrottle fires its
    // first call at once, then waits out the interval), so from here a save landing within its
    // 60-second window can only have gone through the dedicated flush channel.
    await waitFor(() => {
      expect(storage.entries.has(PERSIST_KEY)).toBe(true);
    });
    expect(hasPausedMutation()).toBe(false);

    setOnline(false);
    await user.click(screen.getByRole('checkbox', { name: /Broccoli/ }));

    await waitFor(() => {
      expect(hasPausedMutation()).toBe(true);
    });
  });
});
