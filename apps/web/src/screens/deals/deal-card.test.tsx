import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchStub, renderScreen, type StubHandler } from '../../test/harness.tsx';
import { OAK_STREET_ID } from '../../test/fixtures.ts';
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

function stubFetch(
  handlers: Readonly<Record<string, StubHandler>>,
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  return stub;
}

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
    expect(screen.getByText('$2.50')).toBeInTheDocument();
    expect(screen.getByText('2/$5.00')).toBeInTheDocument();
  });

  it('strikes the original price, shows the discount, and names the validity dates', () => {
    stubFetch({});
    renderScreen(<DealCard householdId={OAK_STREET_ID} deal={stouffersDeal} />);

    expect(screen.getByText('$2.00')).toBeInTheDocument();
    expect(screen.getByText('$3.00')).toHaveClass('line-through');
    expect(screen.getByText('33% off')).toBeInTheDocument();
    expect(screen.getByText('09/23/2026 – 09/29/2026')).toBeInTheDocument();
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
  it('accepts only the two hosts the CSP allows', () => {
    expect(isAllowedImageUrl('https://f.wishabi.net/items/eggs.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://images.wishabi.net/merchants/ht.png')).toBe(true);
    expect(isAllowedImageUrl('https://flipp-image-retrieval.flipp.com/x.jpg')).toBe(false);
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
