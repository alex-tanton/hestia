import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCoarsePointer } from '../../test/browser.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import {
  broccoliDeal,
  dealFixtures,
  eggsDeal,
  FOOD_LION,
  merchantFixtures,
  merchantsResponse,
  searchResponse,
  thisWeekList,
  dealScreenHandlers,
} from '../../test/deal-fixtures.ts';
import { DealSearchScreen, SEARCH_OFFLINE_MESSAGE } from './DealSearchScreen.tsx';

// The "Showing deals as of" date renders an instant in the viewer's zone, and the dates below were
// written for a New York viewer. `format.ts` builds its DATE_TIME formatter when the module loads,
// so the zone has to change before the imports run, which `vi.hoisted` guarantees. The expected
// text stays a literal on purpose: rebuilding it from the instant in the zone the component uses
// would only test the component against itself.
const viewerZone = vi.hoisted(() => {
  const previous = process.env['TZ'] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env['TZ'] = 'America/New_York';
  return previous;
});

afterAll(() => {
  // Assigned, never deleted: assigning makes Node re-detect the zone, deleting may not.
  process.env['TZ'] = viewerZone;
});

interface Recorded {
  calls: { method: string; path: string; body: unknown }[];
  searches: URLSearchParams[];
}

function stubDeals(
  search: StubHandler,
  extra: Readonly<Record<string, StubHandler>> = {},
): Recorded {
  const searches: URLSearchParams[] = [];
  const stub = createFetchStub(
    dealScreenHandlers({
      'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekList] }),
      'GET /api/households/:id/deals/search': (request) => {
        searches.push(request.query);
        return search(request);
      },
      ...extra,
    }),
  );
  vi.stubGlobal('fetch', stub.fetch);
  return { calls: stub.calls, searches };
}

function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
}

async function search(term: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Search deals'), term);
  await user.click(screen.getByRole('button', { name: 'Search' }));
}

beforeEach(() => {
  setOnline(true);
  stubCoarsePointer();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('deal search', () => {
  it('offers the favorite stores as shortcuts before a query is entered', async () => {
    stubDeals(() => ({ status: 200, body: searchResponse() }));
    renderScreen(<DealSearchScreen />);

    expect(await screen.findByRole('heading', { name: 'Your stores' })).toBeInTheDocument();
    const shortcuts = within(screen.getByRole('list', { name: 'Your favorite stores' }));
    expect(shortcuts.getByRole('button', { name: 'Harris Teeter' })).toBeInTheDocument();
    expect(shortcuts.getByRole('button', { name: 'Food Lion' })).toBeInTheDocument();
    // Publix is not a favorite, so it is not a shortcut.
    expect(shortcuts.queryByRole('button', { name: 'Publix' })).toBeNull();
    // Nothing is fetched until there is something to search for.
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('searches the favorite stores by default and shows the results as deal cards', async () => {
    const recorded = stubDeals(() => ({ status: 200, body: searchResponse() }));
    renderScreen(<DealSearchScreen />);
    await search('eggs');

    expect(
      await screen.findByRole('heading', { name: "Egg-Land's Best Extra Large Eggs" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(dealFixtures.length);
    expect(recorded.searches[0]?.get('q')).toBe('eggs');
    expect(recorded.searches[0]?.get('scope')).toBe('favorites');
    expect(recorded.searches[0]?.get('sort')).toBe('relevance');
  });

  it('widens to every merchant when the scope is toggled', async () => {
    const user = userEvent.setup();
    const recorded = stubDeals(() => ({ status: 200, body: searchResponse() }));
    renderScreen(<DealSearchScreen />);
    await search('eggs');
    await screen.findAllByRole('article');

    await user.click(screen.getByRole('radio', { name: 'All stores' }));
    await waitFor(() => {
      expect(recorded.searches.at(-1)?.get('scope')).toBe('all');
    });
  });

  it('passes the store, category, price range, and sort to the service', async () => {
    const user = userEvent.setup();
    const recorded = stubDeals(() => ({ status: 200, body: searchResponse() }));
    renderScreen(<DealSearchScreen />);
    await search('produce');
    await screen.findAllByRole('article');

    await user.selectOptions(screen.getByLabelText('Store'), FOOD_LION);
    await user.selectOptions(screen.getByLabelText('Sort by'), 'price');
    await user.selectOptions(screen.getByLabelText('Category'), 'Produce');
    await user.type(screen.getByLabelText('Lowest price'), '1.00');
    await user.type(screen.getByLabelText('Highest price'), '4.99');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(recorded.searches.at(-1)?.get('maxPrice')).toBe('499');
    });
    const last = recorded.searches.at(-1);
    expect(last?.get('stores')).toBe(FOOD_LION);
    expect(last?.get('sort')).toBe('price');
    expect(last?.get('category')).toBe('Produce');
    expect(last?.get('minPrice')).toBe('100');
  });

  it('refuses a price it cannot read rather than guessing at one', async () => {
    const user = userEvent.setup();
    const recorded = stubDeals(() => ({ status: 200, body: searchResponse() }));
    renderScreen(<DealSearchScreen />);
    await search('milk');
    await screen.findAllByRole('article');

    await user.type(screen.getByLabelText('Lowest price'), 'cheap');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Enter a price like 4.99.')).toBeInTheDocument();
    expect(recorded.searches.at(-1)?.get('minPrice')).toBeNull();
  });

  it('paginates 50 to a page and asks for the next one', async () => {
    const user = userEvent.setup();
    const recorded = stubDeals((request) => {
      const page = Number(request.query.get('page') ?? '1');
      return {
        status: 200,
        body: searchResponse(page === 1 ? dealFixtures : [broccoliDeal], {
          page,
          total: 128,
          hasMore: page < 3,
        }),
      };
    });
    renderScreen(<DealSearchScreen />);
    await search('chicken');

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('128 deals')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => {
      expect(recorded.searches.at(-1)?.get('page')).toBe('2');
    });
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('shows a skeleton of the results layout while the fetch is in flight', async () => {
    stubDeals(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ status: 200, body: searchResponse() });
          }, 400);
        }),
    );
    renderScreen(<DealSearchScreen />);
    await search('chicken');

    expect(await screen.findByText('Loading deals')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByTestId('deal-skeleton').length).toBeGreaterThan(0);
    });
  });

  it('keeps stale results with their as-of date instead of showing nothing', async () => {
    stubDeals(() => ({
      status: 200,
      body: searchResponse(dealFixtures, {
        stale: true,
        asOf: '2026-09-25T08:00:00.000Z',
        refreshing: false,
      }),
    }));
    renderScreen(<DealSearchScreen />);
    await search('chicken');

    expect(await screen.findByText(/Showing deals as of 09\/25\/2026/)).toBeInTheDocument();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });

  it('offers retry and a way forward when the fetch failed with nothing cached', async () => {
    stubDeals(() => ({
      status: 503,
      body: problemBody(503, 'Deal data unavailable'),
    }));
    renderScreen(<DealSearchScreen />);
    await search('chicken');

    expect(
      await screen.findByText("Couldn't reach the store data, and there is nothing saved to show."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add items by hand' })).toBeInTheDocument();
  });

  it('separates the filtered-empty state from a query that simply found nothing', async () => {
    const user = userEvent.setup();
    stubDeals(() => ({ status: 200, body: searchResponse([], { total: 0 }) }));
    renderScreen(<DealSearchScreen />);
    // The seed data's empty-result fixture.
    await search('saffron');

    expect(
      await screen.findByText('No deals match “saffron” at these stores.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search all stores' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Store'), FOOD_LION);
    expect(await screen.findByText('No deals match these filters.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0);
  });

  it('prompts for favorites while browse-all already works', async () => {
    stubDeals(() => ({ status: 200, body: searchResponse() }), {
      'GET /api/households/:id/merchants': () => ({
        status: 200,
        body: merchantsResponse(
          merchantFixtures.map((merchant) => ({ ...merchant, isFavorite: false })),
        ),
      }),
    });
    renderScreen(<DealSearchScreen />);

    expect(await screen.findByText(/No favorite stores yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose favorite stores' })).toBeInTheDocument();
  });

  it('says search needs a connection rather than failing quietly offline', async () => {
    setOnline(false);
    stubDeals(() => ({ status: 200, body: searchResponse() }));
    renderScreen(<DealSearchScreen />);

    expect(await screen.findByText(SEARCH_OFFLINE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByLabelText('Search deals')).toBeNull();
  });

  it('refetches while a dormant postal code is refreshing, then stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let refreshing = true;
    const recorded = stubDeals(() => ({
      status: 200,
      body: searchResponse(refreshing ? [] : [eggsDeal], {
        asOf: null,
        stale: false,
        refreshing,
        total: refreshing ? 0 : 1,
      }),
    }));
    renderScreen(<DealSearchScreen />);
    await search('chicken');

    expect(await screen.findByText(/Fetching this week/)).toBeInTheDocument();
    const before = recorded.searches.length;

    refreshing = false;
    await vi.advanceTimersByTimeAsync(4000);
    await waitFor(() => {
      expect(recorded.searches.length).toBeGreaterThan(before);
    });
    expect(
      await screen.findByRole('heading', { name: "Egg-Land's Best Extra Large Eggs" }),
    ).toBeInTheDocument();

    const after = recorded.searches.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(recorded.searches.length).toBe(after);
    vi.useRealTimers();
  });
});
