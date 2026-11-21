import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findMdButton, getMdButton } from '../../test/md-queries.ts';
import {
  problemBody,
  renderScreen,
  type FetchStub,
  type StubHandler,
  stubFetch,
} from '../../test/harness.tsx';
import { OAK_STREET_ID } from '../../test/fixtures.ts';
import {
  FOOD_LION,
  merchantFixtures,
  merchantsResponse,
  PUBLIX,
  dealScreenHandlers,
} from '../../test/deal-fixtures.ts';
import { HouseholdSettingsSection } from '../settings/HouseholdSettingsSection.tsx';
import { FAVORITES_OFFLINE_MESSAGE, FavoriteStores } from './FavoriteStores.tsx';

const viewerZone = vi.hoisted(() => {
  const previous = process.env['TZ'] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env['TZ'] = 'America/New_York';
  return previous;
});

afterAll(() => {
  process.env['TZ'] = viewerZone;
});

function stub(handlers: Readonly<Record<string, StubHandler>>): FetchStub {
  return stubFetch(dealScreenHandlers(handlers));
}

beforeEach(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('favorite stores', () => {
  it('displays the household’s favorite stores as filter chip pills', async () => {
    stub({});
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    expect(await screen.findByText('Harris Teeter')).toBeInTheDocument();
    expect(screen.getByText('Food Lion')).toBeInTheDocument();
    expect(screen.getByText('CVS Pharmacy')).toBeInTheDocument();
    expect(getMdButton('Add favorite store')).toBeInTheDocument();

    // Non-favorite stores are not in the chip strip
    const chips = document.querySelectorAll('md-filter-chip');
    expect(chips).toHaveLength(3);
  });

  it('adds a favorite store through the store picker dialog', async () => {
    const user = userEvent.setup();
    const created = stub({
      'POST /api/households/:id/favorite-stores': () => ({ status: 204 }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    await user.click(await findMdButton('Add favorite store'));

    const publixOption = await screen.findByRole('button', { name: /Publix/i });
    await user.click(publixOption);

    await waitFor(() => {
      expect(created.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    const post = created.calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe(`/api/households/${OAK_STREET_ID}/favorite-stores`);
    expect(post?.body).toEqual({ merchantId: PUBLIX, merchantName: 'Publix' });
  });

  it('removes a favorite by its merchant id using the trailing remove action', async () => {
    const user = userEvent.setup();
    const created = stub({
      'DELETE /api/households/:id/favorite-stores/:storeId': () => ({ status: 204 }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    const removeFoodLion = await screen.findByLabelText('Remove Food Lion from favorites');
    await user.click(removeFoodLion);

    await waitFor(() => {
      expect(created.calls.some((call) => call.method === 'DELETE')).toBe(true);
    });
    expect(created.calls.find((call) => call.method === 'DELETE')?.path).toBe(
      `/api/households/${OAK_STREET_ID}/favorite-stores/${FOOD_LION}`,
    );
  });

  it('says what failed when the write is refused', async () => {
    const user = userEvent.setup();
    stub({
      'POST /api/households/:id/favorite-stores': () => ({
        status: 500,
        body: problemBody(500, 'Server error'),
      }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    await user.click(await findMdButton('Add favorite store'));
    await user.click(await screen.findByRole('button', { name: /Publix/i }));

    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
  });

  it('names the ZIP when the postal code returns no merchants', async () => {
    stub({
      'GET /api/households/:id/merchants': () => ({ status: 200, body: merchantsResponse([]) }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="99999" />);

    expect(await screen.findByText('No stores found near 99999.')).toBeInTheDocument();
    expect(getMdButton('Change the postal code')).toBeInTheDocument();
  });

  it('keeps the stale list with its as-of date rather than emptying', async () => {
    stub({
      'GET /api/households/:id/merchants': () => ({
        status: 200,
        body: merchantsResponse(merchantFixtures, {
          stale: true,
          asOf: '2026-09-24T08:00:00.000Z',
        }),
      }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    expect(await screen.findByText('As of 09/24/2026, 4:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Harris Teeter')).toBeInTheDocument();
  });

  it('offers retry when the merchant list could not be loaded', async () => {
    stub({
      'GET /api/households/:id/merchants': () => ({
        status: 503,
        body: problemBody(503, 'Deal data unavailable'),
      }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    expect(
      await screen.findByText("Couldn't load the stores near this household. Try again."),
    ).toBeInTheDocument();
    expect(getMdButton(/Try again/)).toBeInTheDocument();
  });

  it('explains why the picker is unavailable offline instead of hiding it', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    stub({});
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);
    expect(await screen.findByText(FAVORITES_OFFLINE_MESSAGE)).toBeInTheDocument();
  });
});

describe('household settings', () => {
  it('lets a member who is not the admin edit the favorite stores', async () => {
    const user = userEvent.setup();
    const created = stub({
      'POST /api/households/:id/favorite-stores': () => ({ status: 204 }),
    });
    renderScreen(<HouseholdSettingsSection householdId={OAK_STREET_ID} isAdmin={false} />);

    expect(await screen.findByRole('heading', { name: 'Favorite stores' })).toBeInTheDocument();
    expect(
      await screen.findByText('Only the household admin can change these.'),
    ).toBeInTheDocument();

    await user.click(await findMdButton('Add favorite store'));
    await user.click(await screen.findByRole('button', { name: /Publix/i }));

    await waitFor(() => {
      expect(created.calls.some((call) => call.method === 'POST')).toBe(true);
    });
  });
});
