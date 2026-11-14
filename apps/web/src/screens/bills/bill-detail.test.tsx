import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatCalendarDate } from '../../lib/format.ts';
import { openMenu, registerBrowserStubs, setOnline } from '../../test/browser.ts';
import {
  findMdDialog,
  findMdField,
  findMdMenuItem,
  getMdButton,
  getMdMenuItem,
  queryMdMenuItem,
} from '../../test/md-queries.ts';
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

registerBrowserStubs();

describe('Bill detail', () => {
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
    const user = userEvent.setup();
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
    await openMenu(user, /More actions for the/);
    expect(queryMdMenuItem('Edit')).toBeNull();
    expect(getMdMenuItem('Delete')).toBeInTheDocument();
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
    expect(getMdButton('Back to bills')).toBeInTheDocument();
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
    const edit = getMdButton('Edit bill');
    expect(edit).toHaveProperty('softDisabled', true);
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
    await user.click(await findMdMenuItem('Archive'));
    const dialog = await findMdDialog('Archive this bill?');
    expect(dialog).toHaveTextContent('Archive Duke Energy?');
    await user.click(getMdButton('Archive bill', { container: dialog }));
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
    await user.click(await findMdMenuItem('Delete'));
    const dialog = await findMdDialog('Delete this bill?');
    expect(dialog).toHaveTextContent('Its payment history is removed with it.');
    await user.click(getMdButton('Delete bill', { container: dialog }));
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
    await openMenu(
      user,
      `More actions for the ${formatCalendarDate(payment.occurrenceDate)} payment`,
    );
    await user.click(await findMdMenuItem('Edit'));
    const amountInput = await findFieldInput('Amount paid');
    fireEvent.input(amountInput, { target: { value: '150.00' } });
    await user.click(getMdButton('Save payment'));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'PATCH' && call.path.includes('/payments/')),
      ).toBe(true);
    });
  });
});
