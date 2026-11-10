import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_MESSAGE } from '../../lib/api/problem.ts';
import { createFetchStub, renderScreen, type StubHandler, stubFetch } from '../../test/harness.tsx';
import { OAK_STREET_ID, SAM_ID } from '../../test/fixtures.ts';
import {
  broccoliDeal,
  eggsDeal,
  porkChopsDeal,
  stouffersDeal,
  thisWeekList,
  weekendCookoutList,
} from '../../test/deal-fixtures.ts';
import { DealCard } from './DealCard.tsx';
import { isAllowedImageUrl } from './DealImage.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a deal card', () => {
  it('shows the name, store, computed unit price, and Flipp’s own copy beside it', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);

    expect(
      screen.getByRole('heading', { name: "Egg-Land's Best Extra Large Eggs" }),
    ).toBeInTheDocument();
    expect(screen.getByText('Harris Teeter')).toBeInTheDocument();
    const unitPrice = screen.getByText('$2.50');
    expect(unitPrice).toBeInTheDocument();
    expect(unitPrice).toHaveClass('text-section');
    expect(screen.getByText('2/$5.00')).toBeInTheDocument();
  });

  it('strikes the original price, shows the inline discount badge, and names the validity dates', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={stouffersDeal} />);

    const salePrice = screen.getByText('$2.00');
    expect(salePrice).toBeInTheDocument();
    expect(salePrice).toHaveClass('text-section');
    expect(screen.getByText('$3.00')).toHaveClass('line-through');
    expect(screen.getByText('-33%')).toBeInTheDocument();
    expect(screen.getByText('09/23/2026 – 09/29/2026')).toBeInTheDocument();
  });

  it('renders clean unit price with no strikethrough or discount badge when regular price is missing', () => {
    stubFetch({});
    const { container } = renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);

    const unitPrice = screen.getByText('$2.50');
    expect(unitPrice).toHaveClass('text-section');
    expect(screen.queryByText(/%/)).toBeNull();
    expect(container.querySelector('.line-through')).toBeNull();
  });

  it('prices a per-pound deal with its unit', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={broccoliDeal} />);
    expect(screen.getByText('$1.99/lb')).toBeInTheDocument();
  });

  it('names the loyalty card rather than saying only "conditional"', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);
    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.queryByText('Coupon')).toBeNull();
  });

  it('names a digital coupon when that is what the price depends on', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={stouffersDeal} />);
    expect(screen.getByText('Coupon')).toBeInTheDocument();
    expect(screen.queryByText('Card')).toBeNull();
  });

  it('badges nothing on a deal whose price has no condition', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={porkChopsDeal} />);
    expect(screen.queryByText('Card')).toBeNull();
    expect(screen.queryByText('Coupon')).toBeNull();
    expect(screen.getByText('$3.49/lb')).toBeInTheDocument();
  });

  it('announces the price and discount as one sentence', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={stouffersDeal} />);

    const card = screen.getByRole('article');
    expect(card).toHaveAccessibleName(
      "Stouffer's Entrees Stouffer's Entrees at Lowes Foods, $2.00 each, marked FINAL PRICE 2/$4.00, was $3.00 each, 33% off, with a digital coupon, valid 09/23/2026 – 09/29/2026.",
    );
  });
});

describe('a deal image', () => {
  it('accepts only approved CDN hosts that CSP allows', () => {
    expect(isAllowedImageUrl('https://f.wishabi.net/items/eggs.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://images.wishabi.net/merchants/ht.png')).toBe(true);
    expect(isAllowedImageUrl('https://flipp-image-retrieval.flipp.com/x.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://attacker-flipp.com/x.jpg')).toBe(false);
    expect(isAllowedImageUrl('http://f.wishabi.net/items/eggs.jpg')).toBe(false);
    expect(isAllowedImageUrl('not a url')).toBe(false);
    expect(isAllowedImageUrl(null)).toBe(false);
  });

  it('shows a neutral placeholder rather than a broken image when there is none', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={porkChopsDeal} />);

    expect(screen.getByTestId('deal-image-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('falls back to the placeholder when the image fails to load', () => {
    stubFetch({});
    const { container } = renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    // The image is decorative: the name beside it carries the meaning.
    expect(image).toHaveAttribute('alt', '');

    fireEvent.error(image!);
    expect(screen.getByTestId('deal-image-placeholder')).toBeInTheDocument();
  });
});

describe('adding a deal to a list', () => {
  it('sends the deal id and nothing else, never a price', async () => {
    const user = userEvent.setup();
    const stub = stubFetch({
      'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekList] }),
      'POST /api/lists/:id/items': () => ({ status: 201, body: {} }),
    });
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);

    await user.click(
      await screen.findByRole('button', { name: "Add Egg-Land's Best Extra Large Eggs to a list" }),
    );

    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    const post = stub.calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe(`/api/lists/${thisWeekList.id}/items`);
    const body = post?.body as Record<string, unknown>;
    expect(Object.keys(body).toSorted()).toEqual(['dealId', 'id', 'source']);
    expect(body['source']).toBe('from_deal');
    expect(body['dealId']).toBe(eggsDeal.id);
    expect(await screen.findByText('Added to This Week.')).toBeInTheDocument();
  });

  it('asks which list when the household keeps more than one', async () => {
    const user = userEvent.setup();
    const stub = stubFetch({
      'GET /api/households/:id/lists': () => ({
        status: 200,
        body: [thisWeekList, weekendCookoutList],
      }),
      'POST /api/lists/:id/items': () => ({ status: 201, body: {} }),
    });
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={broccoliDeal} />);

    await user.click(await screen.findByRole('button', { name: 'Add Broccoli Crowns to a list' }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Add to which list?')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: /Weekend Cookout/ }));

    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    expect(stub.calls.find((call) => call.method === 'POST')?.path).toBe(
      `/api/lists/${weekendCookoutList.id}/items`,
    );
  });

  it('routes to Lists rather than dead-ending when there is no list yet', async () => {
    const user = userEvent.setup();
    stubFetch({ 'GET /api/households/:id/lists': () => ({ status: 200, body: [] }) });
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);

    await user.click(
      await screen.findByRole('button', { name: "Add Egg-Land's Best Extra Large Eggs to a list" }),
    );
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(/No lists yet/)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Go to Lists' })).toBeInTheDocument();
  });
});

describe('adding a deal after a lost response', () => {
  /**
   * The server's `shopping_list_item` rows by id: `on conflict (id) do nothing` keeps the first
   * row an id lands, whatever list a later request names, so a row's value is the list it landed
   * on.
   */
  function itemStore(): { rows: Map<string, string>; insert: StubHandler } {
    const rows = new Map<string, string>();
    const insert: StubHandler = ({ body, params }) => {
      const { id } = body as { id: string };
      if (!rows.has(id)) rows.set(id, params['id'] ?? '');
      return { status: 201, body: {} };
    };
    return { rows, insert };
  }

  /** A `POST /api/lists/:id/items` handler whose chosen calls land and then lose their response. */
  function losingResponses(
    store: ReturnType<typeof itemStore>,
    lost: readonly number[],
  ): StubHandler {
    let posts = 0;
    return (request) => {
      posts += 1;
      const response = store.insert(request);
      // The request lands, but the response never reaches the browser: fetch rejects.
      if (lost.includes(posts)) throw new TypeError('Failed to fetch');
      return response;
    };
  }

  const idsPostedTo = (stub: ReturnType<typeof createFetchStub>, listId: string): string[] =>
    stub.calls
      .filter((call) => call.method === 'POST' && call.path === `/api/lists/${listId}/items`)
      .map((call) => (call.body as { id: string }).id);

  it('sends the same item id on the retry, so the deal lands once', async () => {
    const user = userEvent.setup();
    const store = itemStore();
    const stub = stubFetch({
      'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekList] }),
      'POST /api/lists/:id/items': losingResponses(store, [1]),
    });
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);
    const add = await screen.findByRole('button', {
      name: "Add Egg-Land's Best Extra Large Eggs to a list",
    });

    await user.click(add);
    expect(await screen.findByText(OFFLINE_MESSAGE)).toBeInTheDocument();
    await user.click(add);
    expect(await screen.findByText('Added to This Week.')).toBeInTheDocument();

    const ids = idsPostedTo(stub, thisWeekList.id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(store.rows.size).toBe(1);
  });

  it('mints a new id once an add succeeds, so adding the same deal twice still works', async () => {
    const user = userEvent.setup();
    const store = itemStore();
    stubFetch({
      'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekList] }),
      'POST /api/lists/:id/items': store.insert,
    });
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);
    const add = await screen.findByRole('button', {
      name: "Add Egg-Land's Best Extra Large Eggs to a list",
    });

    await user.click(add);
    await waitFor(() => {
      expect(store.rows.size).toBe(1);
    });
    await user.click(add);
    await waitFor(() => {
      expect(store.rows.size).toBe(2);
    });
  });

  it('does not carry the id of a failed add to a different list', async () => {
    const user = userEvent.setup();
    const store = itemStore();
    stubFetch({
      'GET /api/households/:id/lists': () => ({
        status: 200,
        body: [thisWeekList, weekendCookoutList],
      }),
      'POST /api/lists/:id/items': losingResponses(store, [1]),
    });
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={broccoliDeal} />);
    const add = await screen.findByRole('button', { name: 'Add Broccoli Crowns to a list' });

    await user.click(add);
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /This Week/ }),
    );
    expect(await screen.findByText(OFFLINE_MESSAGE)).toBeInTheDocument();

    await user.click(add);
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /Weekend Cookout/ }),
    );
    expect(await screen.findByText('Added to Weekend Cookout.')).toBeInTheDocument();

    // Both lists hold the deal: a reused id would have been swallowed by `on conflict (id)`.
    expect(new Set(store.rows.values())).toEqual(new Set([thisWeekList.id, weekendCookoutList.id]));
  });

  it('keeps the id of a failed add for its list while the deal goes to another list', async () => {
    const user = userEvent.setup();
    const store = itemStore();
    const stub = stubFetch({
      'GET /api/households/:id/lists': () => ({
        status: 200,
        body: [thisWeekList, weekendCookoutList],
      }),
      'POST /api/lists/:id/items': losingResponses(store, [1]),
    });
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={broccoliDeal} />);
    const add = await screen.findByRole('button', { name: 'Add Broccoli Crowns to a list' });
    const addTo = async (listName: RegExp): Promise<void> => {
      await user.click(add);
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: listName }),
      );
    };

    await addTo(/This Week/);
    expect(await screen.findByText(OFFLINE_MESSAGE)).toBeInTheDocument();
    await addTo(/Weekend Cookout/);
    expect(await screen.findByText('Added to Weekend Cookout.')).toBeInTheDocument();
    await addTo(/This Week/);
    expect(await screen.findByText('Added to This Week.')).toBeInTheDocument();

    // The retry of the first add reuses its id, so This Week holds the deal once.
    const toThisWeek = idsPostedTo(stub, thisWeekList.id);
    expect(toThisWeek).toHaveLength(2);
    expect(toThisWeek[1]).toBe(toThisWeek[0]);
    expect([...store.rows.values()].filter((listId) => listId === thisWeekList.id)).toHaveLength(1);
  });

  it('sends the same item id after the card unmounts, so the deal lands once', async () => {
    const user = userEvent.setup();
    const store = itemStore();
    const stub = stubFetch({
      'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekList] }),
      'POST /api/lists/:id/items': losingResponses(store, [1]),
    });
    const first = renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);
    await user.click(
      await screen.findByRole('button', { name: "Add Egg-Land's Best Extra Large Eggs to a list" }),
    );
    expect(await screen.findByText(OFFLINE_MESSAGE)).toBeInTheDocument();

    // A filter change, paging, or leaving and coming back unmounts the card. The page keeps its one
    // QueryClient and its session, so the fresh card shares both with the first.
    first.unmount();
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />, {
      queryClient: first.queryClient,
      auth: first.auth,
    });
    await user.click(
      await screen.findByRole('button', { name: "Add Egg-Land's Best Extra Large Eggs to a list" }),
    );
    expect(await screen.findByText('Added to This Week.')).toBeInTheDocument();

    const ids = idsPostedTo(stub, thisWeekList.id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(store.rows.size).toBe(1);
  });

  it('mints a fresh id when another user signs in on the same page', async () => {
    const user = userEvent.setup();
    const store = itemStore();
    const stub = stubFetch({
      'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekList] }),
      'POST /api/lists/:id/items': losingResponses(store, [1]),
    });
    const first = renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);
    await user.click(
      await screen.findByRole('button', { name: "Add Egg-Land's Best Extra Large Eggs to a list" }),
    );
    expect(await screen.findByText(OFFLINE_MESSAGE)).toBeInTheDocument();

    // Alex signs out and Sam signs in without a reload, so the page's one QueryClient carries over.
    first.unmount();
    first.auth.setState({ status: 'signed-out', userId: null });
    first.auth.setState({ status: 'signed-in', userId: SAM_ID });
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />, {
      queryClient: first.queryClient,
      auth: first.auth,
    });
    await user.click(
      await screen.findByRole('button', { name: "Add Egg-Land's Best Extra Large Eggs to a list" }),
    );
    expect(await screen.findByText('Added to This Week.')).toBeInTheDocument();

    const ids = idsPostedTo(stub, thisWeekList.id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
    expect(store.rows.size).toBe(2);
  });

  it('renders primary sale price, strikethrough original price, discount badge, and display copy for derived multi-buy (Tracer)', () => {
    stubFetch({});
    const multiBuyDeal = {
      ...eggsDeal,
      id: 'deal-multibuy-1',
      name: 'DiGiorno Rising Crust Pizza',
      merchantName: 'Food Lion',
      unitPrice: 300,
      priceUnit: 'each' as const,
      originalPrice: 375,
      discountPercent: 20,
      displayPrice: '2/$6.00 with $1.50 off on 2',
    };
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={multiBuyDeal} />);

    const salePrice = screen.getByText('$3.00');
    expect(salePrice).toBeInTheDocument();
    expect(salePrice).toHaveClass('text-section');

    const originalPrice = screen.getByText('$3.75');
    expect(originalPrice).toBeInTheDocument();
    expect(originalPrice).toHaveClass('line-through', 'text-muted');

    const badge = screen.getByText('-20%');
    expect(badge).toBeInTheDocument();

    expect(screen.getByText('2/$6.00 with $1.50 off on 2')).toBeInTheDocument();
  });

  it('renders card article with accessible name announcing complete deal sentence', () => {
    stubFetch({});
    const multiBuyDeal = {
      ...eggsDeal,
      id: 'deal-multibuy-2',
      name: 'DiGiorno Rising Crust Pizza',
      merchantName: 'Food Lion',
      unitPrice: 300,
      priceUnit: 'each' as const,
      originalPrice: 375,
      discountPercent: 20,
      displayPrice: '2/$6.00 with $1.50 off on 2',
    };
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={multiBuyDeal} />);

    const article = screen.getByRole('article');
    expect(article).toBeInTheDocument();
    expect(article).toHaveAccessibleName(/DiGiorno Rising Crust Pizza at Food Lion/i);
  });
});
