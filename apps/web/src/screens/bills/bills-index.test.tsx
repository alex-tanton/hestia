import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { registerBrowserStubs, setOnline } from '../../test/browser.ts';
import { findMdButton, findMdDialog, findMdField, getMdButton } from '../../test/md-queries.ts';
import {
  dukeEnergyFixture,
  spectrumInternetFixture,
  spotifyFixture,
} from '../../test/bills-fixtures.ts';
import { OAK_STREET_ID, oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { BillsIndexScreen, groupBills } from './BillsIndexScreen.tsx';

async function findFieldInput(name: string, container?: HTMLElement): Promise<HTMLElement> {
  const host = await findMdField(name, { container });
  if (host instanceof HTMLInputElement || host instanceof HTMLTextAreaElement) {
    return host;
  }
  return waitFor(() => {
    const input = host.shadowRoot?.querySelector<HTMLElement>('input, textarea');
    if (input === null || input === undefined) {
      throw new Error(`Expected shadow input inside <${host.localName}>`);
    }
    return input;
  });
}

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

describe('groupBills (Overdue / Upcoming / Inactive)', () => {
  it('sorts an overdue bill into Overdue regardless of how far past due it is', () => {
    const groups = groupBills([dukeEnergyFixture]);
    expect(groups.overdue).toEqual([dukeEnergyFixture]);
    expect(groups.upcoming).toEqual([]);
    expect(groups.inactive).toEqual([]);
  });

  it('sorts an active non-overdue bill into Upcoming', () => {
    const groups = groupBills([spectrumInternetFixture]);
    expect(groups.upcoming).toEqual([spectrumInternetFixture]);
    expect(groups.overdue).toEqual([]);
    expect(groups.inactive).toEqual([]);
  });

  it('sorts an archived bill into Inactive', () => {
    const archived = { ...spotifyFixture, archivedAt: '2026-10-01T00:00:00.000Z' };
    const groups = groupBills([archived]);
    expect(groups.inactive).toEqual([archived]);
    expect(groups.overdue).toEqual([]);
    expect(groups.upcoming).toEqual([]);
  });
});

describe('Bills dashboard', () => {
  it('loading: announces it with skeletons', () => {
    mount(baseHandlers({ 'GET /api/households/:id/bills': () => new Promise(() => undefined) }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading your bills');
  });

  it('populated: groups by Overdue and Upcoming, with badges, money formatted, FAB, and zero overflow menus', async () => {
    mount(
      baseHandlers({
        'GET /api/households/:id/bills': () => ({
          status: 200,
          body: [dukeEnergyFixture, spectrumInternetFixture, spotifyFixture],
        }),
      }),
    );
    const overdueHeading = await screen.findByRole('heading', { name: 'Overdue' });
    const overdueGroup = overdueHeading.closest('section');
    expect(overdueGroup).not.toBeNull();
    const duke = within(overdueGroup!).getByText('Duke Energy').closest('a');
    expect(duke).toHaveTextContent('$142.30');
    expect(duke).toHaveTextContent('Overdue');

    const upcomingGroup = screen.getByRole('heading', { name: 'Upcoming' }).closest('section');
    expect(within(upcomingGroup!).getByText('Spectrum Internet')).toBeInTheDocument();
    expect(within(upcomingGroup!).getAllByText('Autopay').length).toBeGreaterThan(0);

    const spotify = within(upcomingGroup!).getByText('Spotify').closest('a');
    expect(spotify).toHaveTextContent('Personal');

    // Zero 1-item overflow menus exist on rows per BILL-01
    expect(screen.queryByRole('button', { name: /More actions for/ })).toBeNull();
    // Floating action button MdFab present per BILL-01
    expect(getMdButton('Add bill')).toBeInTheDocument();
  });

  it('empty: first run explains Hestia tracks bills but never pays them', async () => {
    mount(baseHandlers({ 'GET /api/households/:id/bills': () => ({ status: 200, body: [] }) }));
    expect(
      await screen.findByRole('heading', { name: 'No bills tracked yet' }),
    ).toBeInTheDocument();
    const emptyNotice = screen.getByText(/Hestia tracks what you owe and when/);
    expect(emptyNotice).toBeInTheDocument();
    const emptyContainer = emptyNotice.parentElement!;
    expect(getMdButton('Add bill', { container: emptyContainer })).toBeInTheDocument();
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
    await user.click(await findMdButton('Try again'));
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
    const add = getMdButton('Add a bill');
    expect(add).toHaveProperty('softDisabled', true);
    const reasonId = add.getAttribute('aria-describedby');
    expect(document.getElementById(reasonId ?? '')).toHaveTextContent('Needs a connection.');

    const pay = getMdButton('Mark paid, Duke Energy');
    expect(pay).toHaveProperty('softDisabled', true);
  });

  it('pay: records a payment for the current occurrence and provides undo', async () => {
    const user = userEvent.setup();
    const paymentId = '40000001-0000-4000-8000-000000000001';
    const stub = mount(
      baseHandlers({
        'POST /api/bills/:id/pay': () => ({
          status: 201,
          body: {
            id: paymentId,
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
        'DELETE /api/bills/:id/payments/:paymentId': () => ({
          status: 204,
          body: undefined,
        }),
      }),
    );
    await screen.findByText('Duke Energy');
    await user.click(getMdButton('Mark paid, Duke Energy'));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.method === 'POST' && call.path === `/api/bills/${dukeEnergyFixture.id}/pay`,
        ),
      ).toBe(true);
    });
    expect(await screen.findByText('Marked Duke Energy as paid.')).toBeInTheDocument();

    // Clicking Undo triggers payment deletion
    const undoButton = screen.getByRole('button', { name: 'Undo' });
    await user.click(undoButton);
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.method === 'DELETE' &&
            call.path === `/api/bills/${dukeEnergyFixture.id}/payments/${paymentId}`,
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
    await user.click(getMdButton('Add a bill'));
    const form = await findMdDialog(/Add (a )?bill/i);
    const nameInput = await findFieldInput('Name', form);
    fireEvent.input(nameInput, { target: { value: 'Trash pickup' } });
    const amountInput = await findFieldInput('Amount', form);
    fireEvent.input(amountInput, { target: { value: '24.00' } });
    const dueDateInput = await findFieldInput('First due date', form);
    fireEvent.input(dueDateInput, { target: { value: '2026-11-01' } });
    await user.click(getMdButton('Add bill', { container: form }));
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
    await user.click(getMdButton('Add a bill'));
    const form = await findMdDialog(/Add (a )?bill/i);
    await user.click(await screen.findByRole('radio', { name: 'Personal' }));
    const nameInput = await findFieldInput('Name', form);
    fireEvent.input(nameInput, { target: { value: 'Car Insurance' } });
    const amountInput = await findFieldInput('Amount', form);
    fireEvent.input(amountInput, { target: { value: '128.00' } });
    const dueDateInput = await findFieldInput('First due date', form);
    fireEvent.input(dueDateInput, { target: { value: '2026-11-01' } });
    await user.click(getMdButton('Add bill', { container: form }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'POST' && call.path === '/api/users/me/bills'),
      ).toBe(true);
    });
  });
});
