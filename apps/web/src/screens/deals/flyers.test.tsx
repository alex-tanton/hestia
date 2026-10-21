import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  problemBody,
  renderScreen,
  type FetchStub,
  type StubHandler,
  stubFetch,
} from '../../test/harness.tsx';
import {
  eggsDeal,
  flyerItemsResponse,
  flyersResponse,
  harrisTeeterFlyer,
  HARRIS_TEETER_FLYER,
  pumpkinDeal,
  thisWeekList,
  dealScreenHandlers,
} from '../../test/deal-fixtures.ts';
import { FLYERS_OFFLINE_MESSAGE, FlyersScreen } from './FlyersScreen.tsx';
import { FlyerItemsScreen } from './FlyerItemsScreen.tsx';

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

function stub(handlers: Readonly<Record<string, StubHandler>>): FetchStub {
  return stubFetch(
    dealScreenHandlers({
      'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekList] }),
      ...handlers,
    }),
  );
}

beforeEach(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('browsing flyers', () => {
  it('lists each active flyer with its store, dates, and item count', async () => {
    stub({ 'GET /api/households/:id/flyers': () => ({ status: 200, body: flyersResponse() }) });
    renderScreen(<FlyersScreen />);

    expect(await screen.findByText('Harris Teeter')).toBeInTheDocument();
    expect(screen.getByText('Food Lion')).toBeInTheDocument();
    expect(screen.getAllByText('09/23/2026 – 09/29/2026')).toHaveLength(2);
    expect(screen.getByText('42 items')).toBeInTheDocument();
    expect(screen.getByText('37 items')).toBeInTheDocument();
  });

  it('links each flyer to its own items', async () => {
    stub({ 'GET /api/households/:id/flyers': () => ({ status: 200, body: flyersResponse() }) });
    renderScreen(<FlyersScreen />);

    const link = await screen.findByRole('link', { name: /Harris Teeter/ });
    expect(link).toHaveAttribute('href', `/lists/flyers/${HARRIS_TEETER_FLYER}`);
  });

  it('asks for every merchant when the scope is widened', async () => {
    const user = userEvent.setup();
    const created = stub({
      'GET /api/households/:id/flyers': () => ({ status: 200, body: flyersResponse() }),
    });
    renderScreen(<FlyersScreen />);
    await screen.findByText('Harris Teeter');

    await user.click(screen.getByRole('radio', { name: 'All stores' }));
    await waitFor(() => {
      expect(created.calls.some((call) => call.path.includes('scope=all'))).toBe(true);
    });
  });

  it('shows cached flyers with their as-of date rather than nothing', async () => {
    stub({
      'GET /api/households/:id/flyers': () => ({
        status: 200,
        body: flyersResponse([harrisTeeterFlyer], {
          stale: true,
          asOf: '2026-09-24T08:00:00.000Z',
        }),
      }),
    });
    renderScreen(<FlyersScreen />);

    expect(await screen.findByText(/Showing deals as of 09\/24\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Harris Teeter')).toBeInTheDocument();
  });

  it('shows the refreshing state over a skeleton for a dormant postal code', async () => {
    stub({
      'GET /api/households/:id/flyers': () => ({
        status: 200,
        body: flyersResponse([], { asOf: null, stale: false, refreshing: true }),
      }),
    });
    renderScreen(<FlyersScreen />);

    expect(await screen.findByText(/Fetching this week/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByTestId('deal-skeleton').length).toBeGreaterThan(0);
    });
  });

  it('offers retry and a route forward when nothing is cached and the fetch failed', async () => {
    stub({
      'GET /api/households/:id/flyers': () => ({
        status: 503,
        body: problemBody(503, 'Deal data unavailable'),
      }),
    });
    renderScreen(<FlyersScreen />);

    expect(
      await screen.findByText("Couldn't reach the store data, and there is nothing saved to show."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add items by hand' })).toBeInTheDocument();
  });

  it('offers browse-all when no favorite store has an active flyer', async () => {
    const user = userEvent.setup();
    const created = stub({
      'GET /api/households/:id/flyers': () => ({ status: 200, body: flyersResponse([]) }),
    });
    renderScreen(<FlyersScreen />);

    expect(
      await screen.findByText('No active flyers at your favorite stores this week.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Browse all stores' }));
    await waitFor(() => {
      expect(created.calls.some((call) => call.path.includes('scope=all'))).toBe(true);
    });
  });

  it('names the postal code when no store near it has a flyer at all', async () => {
    const user = userEvent.setup();
    stub({ 'GET /api/households/:id/flyers': () => ({ status: 200, body: flyersResponse([]) }) });
    renderScreen(<FlyersScreen />);

    await user.click(await screen.findByRole('radio', { name: 'All stores' }));
    expect(await screen.findByText('No stores found near 27514.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change the postal code' })).toBeInTheDocument();
  });

  it('says browsing needs a connection when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    stub({});
    renderScreen(<FlyersScreen />);
    expect(await screen.findByText(FLYERS_OFFLINE_MESSAGE)).toBeInTheDocument();
  });
});

describe("one flyer's items", () => {
  const route = {
    path: '/lists/flyers/:flyerId',
    initialEntries: [`/lists/flyers/${HARRIS_TEETER_FLYER}`],
  };

  it('shows the flyer’s deals with the same card treatment', async () => {
    stub({
      'GET /api/households/:id/flyers/:flyerId/items': () => ({
        status: 200,
        body: flyerItemsResponse([eggsDeal, pumpkinDeal]),
      }),
    });
    renderScreen(<FlyerItemsScreen />, route);

    expect(
      await screen.findByRole('heading', { name: "Egg-Land's Best Extra Large Eggs" }),
    ).toBeInTheDocument();
    expect(screen.getByText('$2.50')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('filters by category and sorts, one page at a time', async () => {
    const user = userEvent.setup();
    const created = stub({
      'GET /api/households/:id/flyers/:flyerId/items': (request) => {
        const page = Number(request.query.get('page') ?? '1');
        return {
          status: 200,
          body: flyerItemsResponse([eggsDeal, pumpkinDeal], {
            page,
            total: 120,
            hasMore: page < 3,
          }),
        };
      },
    });
    renderScreen(<FlyerItemsScreen />, route);
    await screen.findAllByRole('article');

    await user.selectOptions(screen.getByLabelText('Category'), 'Pantry');
    await waitFor(() => {
      expect(created.calls.some((call) => call.path.includes('category=Pantry'))).toBe(true);
    });

    await user.selectOptions(screen.getByLabelText('Sort by'), 'price');
    await waitFor(() => {
      expect(created.calls.some((call) => call.path.includes('sort=price'))).toBe(true);
    });

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => {
      expect(created.calls.some((call) => call.path.includes('page=2'))).toBe(true);
    });
  });

  it('shows the no-cache refreshing state for a dormant postal code', async () => {
    stub({
      'GET /api/households/:id/flyers/:flyerId/items': () => ({
        status: 200,
        body: flyerItemsResponse([], { asOf: null, refreshing: true, total: 0 }),
      }),
    });
    renderScreen(<FlyerItemsScreen />, route);

    expect(await screen.findByText(/Fetching this week/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByTestId('deal-skeleton').length).toBeGreaterThan(0);
    });
  });

  it('shows an ordinary empty state when the flyer simply has no items', async () => {
    stub({
      'GET /api/households/:id/flyers/:flyerId/items': () => ({
        status: 200,
        body: flyerItemsResponse([], { total: 0 }),
      }),
    });
    renderScreen(<FlyerItemsScreen />, route);
    expect(await screen.findByText('No items in this flyer yet.')).toBeInTheDocument();
  });
});
