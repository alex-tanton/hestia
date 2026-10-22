import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShoppingListDetail } from '@hearth/shared';
import { ListDetailScreen } from '../../screens/lists/ListDetailScreen.tsx';
import { OAK_STREET_ID, oakStreetMembers, profileFixture } from '../../test/fixtures.ts';
import {
  createFetchStub,
  createRealtimeStub,
  renderScreen,
  type RealtimeStub,
  type StubHandler,
} from '../../test/harness.tsx';
import {
  THIS_WEEK_ID,
  broccoli,
  listItem,
  thisWeekDetailFixture,
} from '../../test/list-fixtures.ts';
import { REALTIME_HIGHLIGHT_MS } from './use-list-realtime.ts';

/*
 * Realtime. A message is only ever a signal to refetch: TanStack Query stays the single source of
 * truth, so nothing here writes a payload straight into the screen.
 */

const MILK = listItem({
  id: 'd0000001-0000-4000-8000-000000000001',
  itemName: 'Milk',
  merchantId: '1204',
  merchantName: 'Food Lion',
  priceCents: 399,
  quantity: 1,
});

/** The same list with one more Food Lion item, as the server would answer after another member adds it. */
function withMilk(): ShoppingListDetail {
  return {
    ...thisWeekDetailFixture,
    itemCount: 16,
    outstandingCount: 13,
    storeGroups: thisWeekDetailFixture.storeGroups.map((group) =>
      group.merchantName === 'Food Lion'
        ? { ...group, subtotalCents: 2225, items: [...group.items, MILK] }
        : group,
    ),
  };
}

function handlers(bodies: ShoppingListDetail[]): Record<string, StubHandler> {
  let call = 0;
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id/lists': () => ({ status: 200, body: [] }),
    'GET /api/lists/:id': () => {
      const body = bodies[Math.min(call, bodies.length - 1)];
      call += 1;
      return { status: 200, body };
    },
  };
}

interface Mounted {
  realtime: RealtimeStub;
  stub: ReturnType<typeof createFetchStub>;
  unmount: () => void;
}

function open(bodies: ShoppingListDetail[], listId = THIS_WEEK_ID): Mounted {
  const stub = createFetchStub(handlers(bodies));
  vi.stubGlobal('fetch', stub.fetch);
  const realtime = createRealtimeStub();
  const { unmount } = renderScreen(
    <ListDetailScreen householdId={OAK_STREET_ID} listId={listId} userId={profileFixture.id} />,
    { realtime },
  );
  return { realtime, stub, unmount };
}

function listFetches(stub: ReturnType<typeof createFetchStub>): number {
  return stub.calls.filter((call) => call.method === 'GET' && call.path.includes('/api/lists/'))
    .length;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('an open list subscribes to its own channel', () => {
  it('subscribes once, to the list it is showing', async () => {
    const { realtime } = open([thisWeekDetailFixture]);
    await screen.findByRole('heading', { name: 'Food Lion' });
    expect(realtime.subscribed).toEqual([THIS_WEEK_ID]);
  });

  it('tears the channel down when the screen goes', async () => {
    const { realtime, unmount } = open([thisWeekDetailFixture]);
    await screen.findByRole('heading', { name: 'Food Lion' });
    unmount();
    expect(realtime.unsubscribed).toEqual([THIS_WEEK_ID]);
    expect(realtime.open.size).toBe(0);
  });
});

describe('another member’s change', () => {
  it('refetches through the query cache rather than applying the payload', async () => {
    const { realtime, stub } = open([thisWeekDetailFixture, withMilk()]);
    await screen.findByRole('heading', { name: 'Food Lion' });
    const before = listFetches(stub);

    act(() => {
      realtime.open.get(THIS_WEEK_ID)?.onItemChange(MILK.id);
    });

    // The new row arrives from the refetch, with the server's recomputed subtotal.
    expect(await screen.findByRole('checkbox', { name: /Milk/ })).toBeInTheDocument();
    expect(listFetches(stub)).toBe(before + 1);
    expect(screen.getByRole('region', { name: 'Food Lion' })).toHaveTextContent('$22.25');
  });

  it('announces politely into a live region that was already in the tree', async () => {
    const { realtime } = open([thisWeekDetailFixture, withMilk()]);
    await screen.findByRole('heading', { name: 'Food Lion' });

    // The region exists and is empty before it has anything to say.
    const region = screen.getAllByRole('status').find((node) => node.className.includes('sr-only'));
    expect(region).toBeDefined();
    expect(region).toHaveTextContent('');

    act(() => {
      realtime.open.get(THIS_WEEK_ID)?.onItemChange(MILK.id);
    });
    await waitFor(() => {
      expect(region).toHaveTextContent('This list was updated by another member.');
    });
  });

  it('marks the changed row briefly, then clears the mark', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { realtime } = open([thisWeekDetailFixture]);
    await screen.findByRole('heading', { name: 'Food Lion' });

    act(() => {
      realtime.open.get(THIS_WEEK_ID)?.onItemChange(broccoli.id);
    });
    const row = screen.getByRole('checkbox', { name: /Broccoli/ }).closest('li');
    expect(row?.className).toContain('bg-section-tint');

    act(() => {
      vi.advanceTimersByTime(REALTIME_HIGHLIGHT_MS + 10);
    });
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /Broccoli/ }).closest('li')?.className,
      ).not.toContain('bg-section-tint');
    });
  });

  it('treats a change to the list row as the signal a filtered delete cannot carry', async () => {
    const withoutBroccoli: ShoppingListDetail = {
      ...thisWeekDetailFixture,
      itemCount: 14,
      outstandingCount: 11,
      storeGroups: thisWeekDetailFixture.storeGroups.map((group) =>
        group.merchantName === 'Food Lion'
          ? {
              ...group,
              subtotalCents: 1428,
              items: group.items.filter((item) => item.id !== broccoli.id),
            }
          : group,
      ),
    };
    const { realtime, stub } = open([thisWeekDetailFixture, withoutBroccoli]);
    await screen.findByRole('checkbox', { name: /Broccoli/ });
    const before = listFetches(stub);

    // A delete arrives only as the list row's own `updated_at` change.
    act(() => {
      realtime.open.get(THIS_WEEK_ID)?.onListChange();
    });

    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: /Broccoli/ })).toBeNull();
    });
    expect(listFetches(stub)).toBe(before + 1);
    expect(
      within(screen.getByRole('region', { name: 'Food Lion' })).getByText('$14.28'),
    ).toBeInTheDocument();
  });
});
