import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ListItem } from '@hestia/shared';
import { ItemSheet } from './ItemSheet.tsx';

function fakeItem(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: 'item-1',
    listId: 'list-1',
    itemName: 'Milk',
    normalizedName: 'milk',
    quantity: 1,
    quantityNote: null,
    status: 'needed',
    barcode: null,
    addedBy: 'user-1',
    source: 'manual',
    merchantId: null,
    merchantName: null,
    dealExternalId: null,
    salePriceCents: null,
    regularPriceCents: null,
    dealValidTo: null,
    priceUnit: 'each',
    conditionalPrice: false,
    priceCents: null,
    originalSalePriceCents: null,
    repricedAt: null,
    contributingRecipeIds: [],
    createdAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('ItemSheet', () => {
  const stores = [
    { merchantId: 'store-1', merchantName: 'Trader Joe’s' },
    { merchantId: 'store-2', merchantName: 'Safeway' },
  ];

  it('pre-populates itemName and preserves barcode from initialDraft', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ItemSheet
        open={true}
        onOpenChange={onOpenChange}
        initialDraft={{
          itemName: 'Organic Whole Milk',
          barcode: '012345678905',
          quantity: 2,
        }}
        stores={stores}
        onSubmit={onSubmit}
      />,
    );

    const nameInput = screen.getByLabelText<HTMLInputElement>(/^item/i);
    expect(nameInput.value).toBe('Organic Whole Milk');

    const quantityInput = screen.getByLabelText<HTMLInputElement>(/^quantity/i);
    expect(quantityInput.value).toBe('2');

    const submitBtn = screen.getByRole('button', { name: /add item/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith({
      itemName: 'Organic Whole Milk',
      quantity: 2,
      priceCents: null,
      priceUnit: 'each',
      merchantId: null,
      merchantName: null,
      barcode: '012345678905',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('preserves barcode when editing an existing item', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const existingItem = fakeItem({
      itemName: 'Sourdough Bread',
      barcode: '987654321000',
      priceCents: 450,
    });

    render(
      <ItemSheet
        open={true}
        onOpenChange={vi.fn()}
        item={existingItem}
        stores={stores}
        onSubmit={onSubmit}
      />,
    );

    const nameInput = screen.getByLabelText<HTMLInputElement>(/^item/i);
    expect(nameInput.value).toBe('Sourdough Bread');

    const submitBtn = screen.getByRole('button', { name: /save item/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        itemName: 'Sourdough Bread',
        barcode: '987654321000',
        priceCents: 450,
      }),
    );
  });

  it('blocks submission with validation error when name is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ItemSheet
        open={true}
        onOpenChange={vi.fn()}
        initialDraft={{ itemName: '', barcode: '123' }}
        stores={stores}
        onSubmit={onSubmit}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /add item/i });
    await user.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a name/i)).toBeInTheDocument();
  });
});
