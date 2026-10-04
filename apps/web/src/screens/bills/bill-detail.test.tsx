import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  billDetailFixture,
  dukeEnergyFixture,
  spectrumAutopayPaymentFixture,
  waterAndSewerFixture,
  waterSkippedPaymentFixture,
} from '../../test/bills-fixtures.ts';
import { OAK_STREET_ID, profileFixture } from '../../test/fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { BillDetailScreen } from './BillDetailScreen.tsx';

function baseHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/bills/:id': () => ({ status: 200, body: billDetailFixture }),
    ...extra,
  };
}

function mount(handlers = baseHandlers()): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<BillDetailScreen householdId={OAK_STREET_ID} billId={dukeEnergyFixture.id} />);
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
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens an overflow menu from the keyboard, as the lists tests do: a pointer click does not open a Radix menu under jsdom. */
async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
): Promise<void> {
  const trigger = await screen.findByRole('button', { name: triggerName });
  trigger.focus();
  await user.keyboard('{Enter}');
}

describe('Bill detail (Design › Screens › 15)', () => {
  it('loading: announces it with skeletons', () => {
    mount(baseHandlers({ 'GET /api/bills/:id': () => new Promise(() => undefined) }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading this bill');
  });

  it('populated: shows the amount, due date, category, and full payment history', async () => {
    mount();
    expect(await screen.findByText('$142.30')).toBeInTheDocument();
    expect(screen.getByText(/Due 09\/26\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Utilities/)).toBeInTheDocument();
    expect(screen.getByText(/Reminds 3 days before\./)).toBeInTheDocument();
    // Next-three-dates preview, computed client-side from the same anchored recurrence.
    expect(screen.getByText(/Next due dates:/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows an automatic payment labelled "Autopay"', async () => {
    mount(
      baseHandlers({
        'GET /api/bills/:id': () => ({
          status: 200,
          body: { ...billDetailFixture, payments: [spectrumAutopayPaymentFixture] },
        }),
      }),
    );
    expect(await screen.findByText('Autopay')).toBeInTheDocument();
  });

  it('shows a skipped occurrence without an amount, and offers no edit for it', async () => {
    mount(
      baseHandlers({
        'GET /api/bills/:id': () => ({
          status: 200,
          body: {
            ...billDetailFixture,
            id: waterAndSewerFixture.id,
            payments: [waterSkippedPaymentFixture],
          },
        }),
      }),
    );
    expect(await screen.findByText(/Skipped/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /More actions for the/ }));
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('empty: no payments recorded yet', async () => {
    mount(
      baseHandlers({
        'GET /api/bills/:id': () => ({ status: 200, body: { ...billDetailFixture, payments: [] } }),
      }),
    );
    expect(await screen.findByText('No payments recorded yet.')).toBeInTheDocument();
  });

  it('error: states what failed and offers a way back', async () => {
    mount(
      baseHandlers({
        'GET /api/bills/:id': () => ({
          status: 500,
          body: problemBody(500, 'Internal Server Error'),
        }),
      }),
    );
    expect(await screen.findByText("Couldn't load this bill. Try again.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to bills' })).toBeInTheDocument();
  });

  it('offline with nothing cached: a dedicated offline state', () => {
    setOnline(false);
    mount();
    expect(screen.getByText(/This bill syncs when you reconnect/)).toBeInTheDocument();
  });

  it('offline: disables editing, archiving, and deleting, with the same explanation', async () => {
    mount();
    await screen.findByText('$142.30');
    setOnline(false);
    const edit = screen.getByRole('button', { name: 'Edit bill' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    const reasonId = edit.getAttribute('aria-describedby');
    expect(document.getElementById(reasonId ?? '')).toHaveTextContent('Needs a connection.');
  });

  it('archive: confirms, then hides it and returns to the bills list', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/bills/:id/archive': () => ({
          status: 200,
          body: { ...dukeEnergyFixture, archivedAt: '2026-10-01T12:00:00.000Z' },
        }),
      }),
    );
    await screen.findByText('$142.30');
    await openMenu(user, 'More actions for Duke Energy');
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Archive this bill?' });
    expect(dialog).toHaveTextContent('Archive Duke Energy?');
    await user.click(within(dialog).getByRole('button', { name: 'Archive bill' }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.path === `/api/bills/${dukeEnergyFixture.id}/archive`),
      ).toBe(true);
    });
  });

  it('delete: confirms, names the consequence, then returns to the bills list', async () => {
    const user = userEvent.setup();
    const stub = mount(baseHandlers({ 'DELETE /api/bills/:id': () => ({ status: 204 }) }));
    await screen.findByText('$142.30');
    await openMenu(user, 'More actions for Duke Energy');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this bill?' });
    expect(dialog).toHaveTextContent('Its payment history is removed with it.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete bill' }));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) => call.method === 'DELETE' && call.path === `/api/bills/${dukeEnergyFixture.id}`,
        ),
      ).toBe(true);
    });
  });

  it('edit a payment: opens prefilled, saves the new date and amount', async () => {
    const user = userEvent.setup();
    const payment = billDetailFixture.payments[0]!;
    const stub = mount(
      baseHandlers({
        'PATCH /api/bills/:id/payments/:paymentId': ({ body }) => ({
          status: 200,
          body: { ...payment, ...(body as object) },
        }),
      }),
    );
    await screen.findByText('$142.30');
    const items = screen.getAllByRole('button', { name: /More actions for the/ });
    items[0]!.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const amountField = await screen.findByLabelText('Amount paid');
    await user.clear(amountField);
    await user.type(amountField, '150.00');
    await user.click(screen.getByRole('button', { name: 'Save payment' }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'PATCH' && call.path.includes('/payments/')),
      ).toBe(true);
    });
  });
});
