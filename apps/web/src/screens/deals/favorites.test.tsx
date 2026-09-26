import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type FetchStub,
  type StubHandler,
} from '../../test/harness.tsx';
import { OAK_STREET_ID, oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import {
  FOOD_LION,
  merchantFixtures,
  merchantsResponse,
  PUBLIX,
} from '../../test/deal-fixtures.ts';
import { HouseholdSettingsSection } from '../settings/HouseholdSettingsSection.tsx';
import { FAVORITES_OFFLINE_MESSAGE, FavoriteStores } from './FavoriteStores.tsx';

function stub(handlers: Readonly<Record<string, StubHandler>>): FetchStub {
  const created = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/merchants': () => ({ status: 200, body: merchantsResponse() }),
    ...handlers,
  });
  vi.stubGlobal('fetch', created.fetch);
  return created;
}

beforeEach(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('favorite stores', () => {
  it('checks the household’s favorites among the merchants near its postal code', async () => {
    stub({});
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    expect(await screen.findByRole('checkbox', { name: /Harris Teeter/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Food Lion/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /CVS Pharmacy/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Publix/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Lowes Foods/ })).not.toBeChecked();
  });

  it('adds a favorite by merchant id and name', async () => {
    const user = userEvent.setup();
    const created = stub({
      'POST /api/households/:id/favorite-stores': () => ({ status: 204 }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    await user.click(await screen.findByRole('checkbox', { name: /Publix/ }));
    await waitFor(() => {
      expect(created.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    const post = created.calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe(`/api/households/${OAK_STREET_ID}/favorite-stores`);
    expect(post?.body).toEqual({ merchantId: PUBLIX, merchantName: 'Publix' });
  });

  it('removes a favorite by its merchant id, not a row id', async () => {
    const user = userEvent.setup();
    const created = stub({
      'DELETE /api/households/:id/favorite-stores/:storeId': () => ({ status: 204 }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    await user.click(await screen.findByRole('checkbox', { name: /Food Lion/ }));
    await waitFor(() => {
      expect(created.calls.some((call) => call.method === 'DELETE')).toBe(true);
    });
    expect(created.calls.find((call) => call.method === 'DELETE')?.path).toBe(
      `/api/households/${OAK_STREET_ID}/favorite-stores/${FOOD_LION}`,
    );
  });

  it('says what failed and leaves the row alone when the write is refused', async () => {
    const user = userEvent.setup();
    stub({
      'POST /api/households/:id/favorite-stores': () => ({
        status: 500,
        body: problemBody(500, 'Server error'),
      }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="27514" />);

    await user.click(await screen.findByRole('checkbox', { name: /Publix/ }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Publix/ })).not.toBeChecked();
  });

  it('names the ZIP when the postal code returns no merchants', async () => {
    stub({
      'GET /api/households/:id/merchants': () => ({ status: 200, body: merchantsResponse([]) }),
    });
    renderScreen(<FavoriteStores householdId={OAK_STREET_ID} postalCode="99999" />);

    expect(await screen.findByText('No stores found near 99999.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change the postal code' })).toBeInTheDocument();
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
    expect(screen.getByRole('checkbox', { name: /Harris Teeter/ })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
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
    // The admin-only fields stay read-only for them.
    expect(
      await screen.findByText('Only the household admin can change these.'),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('checkbox', { name: /Publix/ }));
    await waitFor(() => {
      expect(created.calls.some((call) => call.method === 'POST')).toBe(true);
    });
  });
});
