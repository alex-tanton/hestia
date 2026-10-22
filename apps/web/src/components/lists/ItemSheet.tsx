import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { itemNameSchema, type ListItem, type PriceUnit } from '@hearth/shared';
import { formatPriceInput, parsePriceInput, parseQuantityInput } from '../../lib/price-input.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { firstIssue } from '../../lib/validation.ts';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { Select } from '../ui/Select.tsx';
import { Sheet } from '../ui/Sheet.tsx';

export const ANYWHERE_VALUE = '';

export interface StoreChoice {
  merchantId: string;
  merchantName: string;
}

export interface ItemDraft {
  itemName: string;
  quantity: number | null;
  priceCents: number | null;
  priceUnit: PriceUnit;
  merchantId: string | null;
  merchantName: string | null;
}

export interface ItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing row, or adding a new one. */
  item?: ListItem | undefined;
  /** Stores a manual item can be assigned to. */
  stores: readonly StoreChoice[];
  onSubmit: (draft: ItemDraft) => void;
}

const UNITS: readonly { value: PriceUnit; label: string }[] = [
  { value: 'each', label: 'Each' },
  { value: 'lb', label: 'Per pound' },
  { value: 'oz', label: 'Per ounce' },
];

type Field = 'itemName' | 'quantity' | 'price';

function toPriceUnit(value: string): PriceUnit {
  return value === 'lb' || value === 'oz' ? value : 'each';
}

/**
 * The quick-add and edit sheet. Price is editable only for a manual item: a deal-sourced row
 * carries the deal's own snapshot, which the client must never invent.
 *
 * The fields start from `item`, so a caller opening it for a different row gives it a `key` and
 * gets a fresh form rather than the last row's values.
 */
export function ItemSheet({
  open,
  onOpenChange,
  item,
  stores,
  onSubmit,
}: ItemSheetProps): ReactElement {
  const isEditing = item !== undefined;
  const canPrice = !isEditing || item.source === 'manual';
  const { errors, setErrors, formRef } = useFieldErrors<Field>();

  const [itemName, setItemName] = useState(item?.itemName ?? '');
  const [quantity, setQuantity] = useState(
    item?.quantity === null ? '' : String(item?.quantity ?? ''),
  );
  const [price, setPrice] = useState(formatPriceInput(item?.priceCents ?? null));
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(item?.priceUnit ?? 'each');
  const [merchantId, setMerchantId] = useState(item?.merchantId ?? ANYWHERE_VALUE);

  const handleSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const next: Partial<Record<Field, string>> = {};

    const name = itemNameSchema.safeParse(itemName);
    if (!name.success) next.itemName = firstIssue(name.error);
    const parsedQuantity = parseQuantityInput(quantity);
    if (parsedQuantity.error !== undefined) next.quantity = parsedQuantity.error;
    const parsedPrice = parsePriceInput(canPrice ? price : '');
    if (parsedPrice.error !== undefined) next.price = parsedPrice.error;

    setErrors(next);
    if (Object.keys(next).length > 0 || !name.success) return;

    const store = stores.find((choice) => choice.merchantId === merchantId);
    onSubmit({
      itemName: name.data,
      quantity: parsedQuantity.quantity ?? null,
      // A deal-sourced row keeps the snapshot the service took; only a manual price is the user's.
      priceCents: canPrice ? (parsedPrice.cents ?? null) : item.priceCents,
      priceUnit,
      merchantId: store?.merchantId ?? null,
      merchantName: store?.merchantName ?? null,
    });
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${item.itemName}` : 'Add an item'}
    >
      <form ref={formRef} noValidate className="flex flex-col gap-3 px-4" onSubmit={handleSubmit}>
        <TextField
          label="Item"
          name="itemName"
          autoComplete="off"
          value={itemName}
          error={errors.itemName}
          onChange={(event) => {
            setItemName(event.target.value);
          }}
        />
        <TextField
          label="Quantity"
          name="quantity"
          inputMode="decimal"
          autoComplete="off"
          hint="Optional"
          value={quantity}
          error={errors.quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
          }}
        />
        {canPrice && (
          <>
            <TextField
              label="Price"
              name="price"
              inputMode="decimal"
              autoComplete="off"
              hint="Optional, in dollars"
              value={price}
              error={errors.price}
              onChange={(event) => {
                setPrice(event.target.value);
              }}
            />
            <Select
              label="Price unit"
              name="priceUnit"
              options={UNITS}
              value={priceUnit}
              onValueChange={(value) => {
                setPriceUnit(toPriceUnit(value));
              }}
            />
          </>
        )}
        <Select
          label="Store"
          name="merchantId"
          options={[
            { value: ANYWHERE_VALUE, label: 'Anywhere' },
            ...stores.map((store) => ({ value: store.merchantId, label: store.merchantName })),
          ]}
          value={merchantId}
          onValueChange={setMerchantId}
        />
        <Button type="submit" className="mt-1">
          {isEditing ? 'Save item' : 'Add item'}
        </Button>
      </form>
    </Sheet>
  );
}
