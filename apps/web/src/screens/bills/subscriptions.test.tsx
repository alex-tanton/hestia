import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  spectrumInternetFixture,
  spotifyFixture,
  subscriptionFixture,
  subscriptionsResponseFixture,
} from '../../test/bills-fixtures.ts';
import { OAK_STREET_ID, profileFixture } from '../../test/fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { SubscriptionsScreen } from './SubscriptionsScreen.tsx';

function baseHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/subscriptions': () => ({
      status: 200,
      body: subscriptionsResponseFixture,
    }),
    ...extra,
  };
}

function mount(handlers = baseHandlers()): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<SubscriptionsScreen householdId={OAK_STREET_ID} />);
  return stub;
}

function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  act(() => {
    onlineManager.setOnline(isOnline);
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  });
}

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Subscriptions (Design › Screens › 16)', () => {
  it('loading: announces it with skeletons', () => {
    mount(
      baseHandlers({ 'GET /api/households/:id/subscriptions': () => new Promise(() => undefined) }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading subscriptions');
  });

  it('populated: shows the total and each row, sorted by monthly cost, from the API response', async () => {
    mount();
    expect(await screen.findByText('$86.98')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // Spectrum Internet ($74.99/mo) outranks Spotify ($11.99/mo) — order comes straight from the
    // API's own sort, not something this screen recomputes.
    expect(rows[0]).toHaveTextContent('Spectrum Internet');
    expect(rows[0]).toHaveTextContent('$74.99/mo');
    expect(rows[0]).toHaveTextContent('$899.88/yr');
    expect(rows[1]).toHaveTextContent('Spotify');
    expect(rows[1]).toHaveTextContent('Personal');
    expect(rows[1]).toHaveTextContent('$11.99/mo');
    expect(rows[1]).toHaveTextContent('$143.88/yr');
  });

  it('empty: no subscriptions tracked, total reads zero', async () => {
    mount(
      baseHandlers({
        'GET /api/households/:id/subscriptions': () => ({
          status: 200,
          body: { subscriptions: [], totalMonthlyCents: 0 },
        }),
      }),
    );
    expect(await screen.findByText('No subscriptions tracked yet.')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('error: states what failed and retries', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/subscriptions': () => ({
          status: 500,
          body: problemBody(500, 'Internal Server Error'),
        }),
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(
        stub.calls.filter((call) => call.path.includes('/subscriptions')).length,
      ).toBeGreaterThan(1);
    });
  });

  it('offline with nothing cached: a dedicated offline state', () => {
    setOnline(false);
    mount();
    expect(screen.getByText(/Subscriptions sync when you reconnect/)).toBeInTheDocument();
  });

  it('the 60-day prompt: shows "Still using this?" only on the row the API flags', async () => {
    mount(
      baseHandlers({
        'GET /api/households/:id/subscriptions': () => ({
          status: 200,
          body: {
            subscriptions: [
              subscriptionFixture({ needsUsageConfirmation: false }),
              subscriptionFixture({
                id: spotifyFixture.id,
                name: 'Adobe Creative Cloud',
                monthlyCents: 5_999,
                annualCents: 71_988,
                needsUsageConfirmation: true,
              }),
            ],
            totalMonthlyCents: 13_498,
          },
        }),
      }),
    );
    const rows = await screen.findAllByRole('listitem');
    expect(within(rows[0]!).queryByText('Still using this?')).toBeNull();
    expect(within(rows[1]!).getByText('Still using this?')).toBeInTheDocument();
  });

  it('"Still using" resets the clock without archiving the bill', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/subscriptions': () => ({
          status: 200,
          body: {
            subscriptions: [subscriptionFixture({ needsUsageConfirmation: true })],
            totalMonthlyCents: 7_499,
          },
        }),
        'POST /api/bills/:id/confirm-usage': () => ({
          status: 200,
          body: { ...spectrumInternetFixture, lastUsedConfirmedAt: '2026-10-01T00:00:00.000Z' },
        }),
      }),
    );
    await screen.findByText('Still using this?');
    await user.click(screen.getByRole('button', { name: /^Still using/ }));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) => call.path === `/api/bills/${spectrumInternetFixture.id}/confirm-usage`,
        ),
      ).toBe(true);
    });
    expect(stub.calls.some((call) => call.path.includes('/archive'))).toBe(false);
  });

  it('"Stop tracking" archives the bill', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/subscriptions': () => ({
          status: 200,
          body: {
            subscriptions: [subscriptionFixture({ needsUsageConfirmation: true })],
            totalMonthlyCents: 7_499,
          },
        }),
        'POST /api/bills/:id/archive': () => ({
          status: 200,
          body: { ...spectrumInternetFixture, archivedAt: '2026-10-01T00:00:00.000Z' },
        }),
      }),
    );
    await screen.findByText('Still using this?');
    await user.click(screen.getByRole('button', { name: /^Stop tracking/ }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.path === `/api/bills/${spectrumInternetFixture.id}/archive`),
      ).toBe(true);
    });
  });
});
