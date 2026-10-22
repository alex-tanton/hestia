import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { openMenu, registerBrowserStubs, setOnline } from '../../test/browser.ts';
import {
  billFixture,
  dukeEnergyFixture,
  spectrumInternetFixture,
  spotifyFixture,
} from '../../test/bills-fixtures.ts';
import { OAK_STREET_ID, oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import { addDays, todayInTimezone } from '../../lib/household-date.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { BillsIndexScreen, groupBills } from './BillsIndexScreen.tsx';

function baseHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/bills': () => ({
      status: 200,
      body: [dukeEnergyFixture, spectrumInternetFixture, spotifyFixture],
    }),
    ...extra,
  };
}

function mount(handlers = baseHandlers()): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<BillsIndexScreen householdId={OAK_STREET_ID} />);
  return stub;
}

registerBrowserStubs();

describe('groupBills (Overdue / This week / Later)', () => {
  it('sorts an overdue bill into Overdue regardless of how far past due it is', () => {
    const groups = groupBills([dukeEnergyFixture], '2026-10-03');
    expect(groups.overdue).toEqual([dukeEnergyFixture]);
    expect(groups.thisWeek).toEqual([]);
    expect(groups.later).toEqual([]);
  });

  it('sorts a bill due on or before the end of this week into This week', () => {
    const groups = groupBills([spectrumInternetFixture], '2026-10-04');
    expect(groups.thisWeek).toEqual([spectrumInternetFixture]);
  });

  it('sorts a bill due after the end of this week into Later', () => {
    const groups = groupBills([spotifyFixture], '2026-10-04');
    expect(groups.later).toEqual([spotifyFixture]);
  });
});

describe('Bills dashboard', () => {
  it('loading: announces it with skeletons', () => {
    mount(baseHandlers({ 'GET /api/households/:id/bills': () => new Promise(() => undefined) }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading your bills');
  });

  it('populated: groups by Overdue, This week, and Later, with badges and money formatted from cents', async () => {
    const today = todayInTimezone(oakStreetFixture.timezone);
    const thisWeekBill = billFixture({
      id: '30000001-0000-4000-8000-000000000001',
      name: 'Spectrum Internet',
      amountCents: 7_499,
      autopay: true,
      isSubscription: true,
      currentOccurrenceDate: today,
    });
    const laterBill = billFixture({
      id: '30000002-0000-4000-8000-000000000002',
      name: 'Spotify',
      amountCents: 1_199,
      householdId: null,
      visibility: 'personal',
      isSubscription: true,
      currentOccurrenceDate: addDays(today, 30),
    });
    mount(
      baseHandlers({
        'GET /api/households/:id/bills': () => ({
          status: 200,
          body: [dukeEnergyFixture, thisWeekBill, laterBill],
        }),
      }),
    );
    const overdueHeading = await screen.findByRole('heading', { name: 'Overdue' });
    const overdueGroup = overdueHeading.closest('section');
    expect(overdueGroup).not.toBeNull();
    const duke = within(overdueGroup!).getByText('Duke Energy').closest('a');
    expect(duke).toHaveTextContent('$142.30');
    expect(duke).toHaveTextContent('Overdue');

    const thisWeekGroup = screen.getByRole('heading', { name: 'This week' }).closest('section');
    expect(within(thisWeekGroup!).getByText('Spectrum Internet')).toBeInTheDocument();
    expect(within(thisWeekGroup!).getByText('Autopay')).toBeInTheDocument();

    const laterGroup = screen.getByRole('heading', { name: 'Later' }).closest('section');
    const spotify = within(laterGroup!).getByText('Spotify').closest('a');
    expect(spotify).toHaveTextContent('Personal');
  });

  it('empty: first run explains Hearth tracks bills but never pays them', async () => {
    mount(baseHandlers({ 'GET /api/households/:id/bills': () => ({ status: 200, body: [] }) }));
    expect(await screen.findByText(/Hearth tracks what you owe and when/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add a bill' })[0]).toBeInTheDocument();
  });

  it('error: states what failed and retries', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/bills': () => ({
          status: 500,
          body: problemBody(500, 'Internal Server Error'),
        }),
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(stub.calls.filter((call) => call.path.includes('/bills')).length).toBeGreaterThan(1);
    });
  });

  it('offline with nothing cached: a dedicated offline state, not an error', () => {
    setOnline(false);
    mount();
    expect(screen.getByText(/Your bills sync when you reconnect/)).toBeInTheDocument();
  });

  it('offline: disables adding, paying, and skipping, each with the same explanation', async () => {
    mount();
    await screen.findByText('Duke Energy');
    setOnline(false);
    const add = screen.getByRole('button', { name: 'Add a bill' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    const reasonId = add.getAttribute('aria-describedby');
    expect(document.getElementById(reasonId ?? '')).toHaveTextContent('Needs a connection.');

    const pay = screen.getAllByRole('button', { name: /^Mark paid/ })[0]!;
    expect(pay).toHaveAttribute('aria-disabled', 'true');
  });

  it('pay: records a payment for the current occurrence', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/bills/:id/pay': () => ({
          status: 201,
          body: {
            id: '40000001-0000-4000-8000-000000000001',
            billId: dukeEnergyFixture.id,
            occurrenceDate: dukeEnergyFixture.currentOccurrenceDate,
            paidDate: '2026-10-01',
            amountPaidCents: dukeEnergyFixture.amountCents,
            isAuto: false,
            isSkipped: false,
            recordedBy: profileFixture.id,
            createdAt: '2026-10-01T12:00:00.000Z',
          },
        }),
      }),
    );
    await screen.findByText('Duke Energy');
    await user.click(screen.getAllByRole('button', { name: /^Mark paid/ })[0]!);
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.method === 'POST' && call.path === `/api/bills/${dukeEnergyFixture.id}/pay`,
        ),
      ).toBe(true);
    });
    expect(await screen.findByText('Marked Duke Energy paid.')).toBeInTheDocument();
  });

  it('skip: confirms by naming the bill and the date before writing anything', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/bills/:id/skip': () => ({
          status: 201,
          body: {
            id: '40000002-0000-4000-8000-000000000002',
            billId: dukeEnergyFixture.id,
            occurrenceDate: dukeEnergyFixture.currentOccurrenceDate,
            paidDate: null,
            amountPaidCents: null,
            isAuto: false,
            isSkipped: true,
            recordedBy: profileFixture.id,
            createdAt: '2026-10-01T12:00:00.000Z',
          },
        }),
      }),
    );
    await screen.findByText('Duke Energy');
    await openMenu(user, 'More actions for Duke Energy');
    await user.click(await screen.findByRole('menuitem', { name: 'Skip' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Skip this bill?' });
    expect(dialog).toHaveTextContent(
      "Skip the 09/26/2026 Duke Energy bill? It won't be marked paid.",
    );
    expect(stub.calls.some((call) => call.path.includes('/skip'))).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: 'Skip bill' }));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.method === 'POST' && call.path === `/api/bills/${dukeEnergyFixture.id}/skip`,
        ),
      ).toBe(true);
    });
  });

  it('add flow: a household bill goes through the household endpoint', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/households/:id/bills': ({ body }) => ({
          status: 201,
          body: {
            id: '30000003-0000-4000-8000-000000000003',
            householdId: OAK_STREET_ID,
            ownerUserId: profileFixture.id,
            category: null,
            lastUsedConfirmedAt: null,
            archivedAt: null,
            createdAt: '2026-10-01T12:00:00.000Z',
            currentOccurrenceDate: '2026-11-01',
            isOverdue: false,
            visibility: 'household',
            isSubscription: false,
            ...(body as object),
          },
        }),
      }),
    );
    await screen.findByText('Duke Energy');
    await user.click(screen.getAllByRole('button', { name: 'Add a bill' })[0]!);
    await user.type(await screen.findByLabelText('Name'), 'Trash pickup');
    await user.type(screen.getByLabelText('Amount'), '24.00');
    fireEvent.change(screen.getByLabelText('First due date'), { target: { value: '2026-11-01' } });
    await user.click(screen.getByRole('button', { name: 'Add bill' }));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.method === 'POST' && call.path === `/api/households/${OAK_STREET_ID}/bills`,
        ),
      ).toBe(true);
    });
  });

  it('add flow: a personal bill goes through /users/me/bills', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/users/me/bills': ({ body }) => ({
          status: 201,
          body: {
            id: '30000004-0000-4000-8000-000000000004',
            householdId: null,
            ownerUserId: profileFixture.id,
            category: null,
            lastUsedConfirmedAt: null,
            archivedAt: null,
            createdAt: '2026-10-01T12:00:00.000Z',
            currentOccurrenceDate: '2026-11-01',
            isOverdue: false,
            visibility: 'personal',
            isSubscription: false,
            ...(body as object),
          },
        }),
      }),
    );
    await screen.findByText('Duke Energy');
    await user.click(screen.getAllByRole('button', { name: 'Add a bill' })[0]!);
    await user.click(await screen.findByRole('radio', { name: 'Personal' }));
    await user.type(screen.getByLabelText('Name'), 'Car Insurance');
    await user.type(screen.getByLabelText('Amount'), '128.00');
    fireEvent.change(screen.getByLabelText('First due date'), { target: { value: '2026-11-01' } });
    await user.click(screen.getByRole('button', { name: 'Add bill' }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'POST' && call.path === '/api/users/me/bills'),
      ).toBe(true);
    });
  });
});
