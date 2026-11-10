import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BarcodeProduct, ShoppingListDetail } from '@hestia/shared';
import { setOnline } from '../../test/browser.ts';
import { ALEX_ID, OAK_STREET_ID, oakStreetMembers, profileFixture } from '../../test/fixtures.ts';
import { createFetchStub, renderScreen, type StubHandler, WithQueue } from '../../test/harness.tsx';
import { listItem, THIS_WEEK_ID } from '../../test/list-fixtures.ts';
import { ListDetailScreen } from './ListDetailScreen.tsx';

vi.mock('../../components/lists/BarcodeScannerDialog.tsx', () => ({
  BarcodeScannerDialog: ({
    open,
    onOpenChange,
    onScan,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (code: string, mode: 'add' | 'shop') => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="mock-scanner-dialog">
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Close Scanner
        </button>
        <button
          type="button"
          onClick={() => {
            onScan('012345678905', 'add');
          }}
        >
          Trigger Scan Add
        </button>
        <button
          type="button"
          onClick={() => {
            onScan('012345678905', 'shop');
          }}
        >
          Trigger Scan Shop
        </button>
        <button
          type="button"
          onClick={() => {
            onScan('999999999999', 'shop');
          }}
        >
          Trigger Unknown Shop
        </button>
      </div>
    );
  },
}));

const mockMilkProduct: BarcodeProduct = {
  barcode: '012345678905',
  productName: 'Organic Whole Milk',
  brands: 'Horizon',
  quantity: '1 gal',
  imageUrl: 'https://images.openfoodfacts.org/1.jpg',
};

const MILK_ITEM_ID = 'a0000001-0000-4000-8000-000000000020';

function makeDetailFixture(
  items = [
    listItem({
      id: MILK_ITEM_ID,
      itemName: 'Horizon Organic Whole Milk',
      barcode: '012345678905',
      status: 'needed',
    }),
  ],
): ShoppingListDetail {
  return {
    id: THIS_WEEK_ID,
    householdId: OAK_STREET_ID,
    name: 'This Week',
    archivedAt: null,
    createdBy: ALEX_ID,
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    itemCount: items.length,
    outstandingCount: items.filter((i) => i.status !== 'bought').length,
    storeGroups: [
      {
        merchantId: null,
        merchantName: null,
        subtotalCents: 0,
        unpricedCount: items.length,
        items,
      },
    ],
    bought: [],
  };
}

function baseHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/lists/:id': () => ({
      status: 200,
      body: makeDetailFixture(),
    }),
    'GET /api/barcodes/:barcode': ({ params }) => {
      if (params['barcode'] === '012345678905') {
        return { status: 200, body: mockMilkProduct };
      }
      return { status: 404, body: { type: 'about:blank', title: 'Not Found', status: 404 } };
    },
    ...extra,
  };
}

function mount(
  ui: ReactElement,
  handlers: Record<string, StubHandler>,
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<WithQueue>{ui}</WithQueue>);
  return stub;
}

function renderDetail(handlers = baseHandlers()) {
  return mount(
    <ListDetailScreen
      householdId={OAK_STREET_ID}
      listId={THIS_WEEK_ID}
      userId={profileFixture.id}
    />,
    handlers,
  );
}

describe('ListDetailScreen - Barcode Scanning Integration', () => {
  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders "Scan barcode" button in header toolbar beside "Add an item"', async () => {
    renderDetail();

    const scanBtn = await screen.findByRole('button', { name: /scan barcode/i });
    expect(scanBtn).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: 'Add an item' });
    expect(addBtn).toBeInTheDocument();
  });

  it('clicking "Scan barcode" opens the scanner dialog', async () => {
    const user = userEvent.setup();
    renderDetail();

    const scanBtn = await screen.findByRole('button', { name: /scan barcode/i });
    await user.click(scanBtn);

    expect(screen.getByTestId('mock-scanner-dialog')).toBeInTheDocument();
  });

  it('handles "Add to List" scan flow by resolving barcode and pre-filling ItemSheet', async () => {
    const user = userEvent.setup();
    const stub = renderDetail({
      ...baseHandlers(),
      'POST /api/lists/:id/items': () => ({
        status: 201,
        body: makeDetailFixture(),
      }),
    });

    const scanBtn = await screen.findByRole('button', { name: /scan barcode/i });
    await user.click(scanBtn);

    // Trigger mock scan in Add mode
    const triggerAddBtn = screen.getByRole('button', { name: 'Trigger Scan Add' });
    await user.click(triggerAddBtn);

    // Scanner closes, ItemSheet opens pre-populated
    await waitFor(() => {
      expect(screen.queryByTestId('mock-scanner-dialog')).not.toBeInTheDocument();
    });

    const itemInput = await screen.findByLabelText<HTMLInputElement>(/^item/i);
    expect(itemInput.value).toBe('Horizon Organic Whole Milk');

    // Submit pre-filled sheet
    const submitBtn = screen.getByRole('button', { name: /add item/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        stub.calls.some(
          (c) => c.method === 'POST' && c.path.includes(`/api/lists/${THIS_WEEK_ID}/items`),
        ),
      ).toBe(true);
    });

    const addCall = stub.calls.find(
      (c) => c.method === 'POST' && c.path.includes(`/api/lists/${THIS_WEEK_ID}/items`),
    );
    const addPayload = addCall?.body as {
      itemName: string;
      barcode: string;
    };
    expect(addPayload.itemName).toBe('Horizon Organic Whole Milk');
    expect(addPayload.barcode).toBe('012345678905');
  });

  it('handles "Shop & Check Off" scan flow, marks item bought, and supports Undo', async () => {
    const user = userEvent.setup();
    const stub = renderDetail({
      ...baseHandlers(),
      'PATCH /api/lists/:id/items/:itemId': () => ({
        status: 200,
        body: makeDetailFixture(),
      }),
    });

    const scanBtn = await screen.findByRole('button', { name: /scan barcode/i });
    await user.click(scanBtn);

    // Trigger mock scan in Shop mode
    const triggerShopBtn = screen.getByRole('button', { name: 'Trigger Scan Shop' });
    await user.click(triggerShopBtn);

    // Scanner dialog remains open for continuous scanning per D-04
    expect(screen.getByTestId('mock-scanner-dialog')).toBeInTheDocument();

    // Item was updated to status 'bought'
    await waitFor(() => {
      expect(stub.calls.some((c) => c.method === 'PATCH' && c.path.includes(MILK_ITEM_ID))).toBe(
        true,
      );
    });

    const patchCall = stub.calls.find((c) => c.method === 'PATCH' && c.path.includes(MILK_ITEM_ID));
    const patchPayload = patchCall?.body as { status: string };
    expect(patchPayload.status).toBe('bought');

    // Toast displays marked bought with Undo button
    expect(await screen.findByText(/marked bought/i)).toBeInTheDocument();
    const undoBtn = screen.getByRole('button', { name: 'Undo' });

    // Click Undo
    await user.click(undoBtn);

    await waitFor(() => {
      expect(
        stub.calls.filter((c) => c.method === 'PATCH' && c.path.includes(MILK_ITEM_ID)),
      ).toHaveLength(2);
    });

    const undoCall = stub.calls.filter(
      (c) => c.method === 'PATCH' && c.path.includes(MILK_ITEM_ID),
    )[1];
    const undoPayload = undoCall?.body as { status: string };
    expect(undoPayload.status).toBe('needed');
  });

  it('shows informative toast when scanning a barcode not on the list', async () => {
    const user = userEvent.setup();
    renderDetail();

    const scanBtn = await screen.findByRole('button', { name: /scan barcode/i });
    await user.click(scanBtn);

    const triggerUnknownBtn = screen.getByRole('button', { name: 'Trigger Unknown Shop' });
    await user.click(triggerUnknownBtn);

    // Toast displays not on this list
    expect(await screen.findByText(/not on this list/i)).toBeInTheDocument();
    // Scanner stays open
    expect(screen.getByTestId('mock-scanner-dialog')).toBeInTheDocument();
  });
});
