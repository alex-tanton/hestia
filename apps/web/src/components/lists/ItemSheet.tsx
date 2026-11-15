import { useMemo, useState, type ReactElement, type SyntheticEvent } from 'react';
import { itemNameSchema, type ListItem, type PriceUnit } from '@hestia/shared';
import { formatPriceInput, parsePriceInput, parseQuantityInput } from '../../lib/price-input.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { firstIssue } from '../../lib/validation.ts';
import { MdFilterChip } from '../md/MdFilterChip.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { Select } from '../ui/Select.tsx';

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
  barcode?: string | null;
}

export interface ItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing row, or adding a new one. */
  item?: ListItem | undefined;
  /** Pre-filled draft values (e.g. from barcode scanning). */
  initialDraft?: Partial<ItemDraft> | undefined;
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
 * The quick-add and edit sheet using ModalBottomSheet with horizontal tonal chip strip
 * of favorite/recent stores and full details.
 */
export function ItemSheet({
  open,
  onOpenChange,
  item,
  initialDraft,
  stores,
  onSubmit,
}: ItemSheetProps): ReactElement {
  const isEditing = item !== undefined;
  const canPrice = !isEditing || item.source === 'manual';
  const { errors, setErrors, formRef } = useFieldErrors<Field>();

  const availableStores = useMemo(() => {
    const list = [...stores];
    const initialId = item?.merchantId ?? initialDraft?.merchantId;
    const initialName = item?.merchantName ?? initialDraft?.merchantName;
    if (initialId && initialName && !list.some((s) => s.merchantId === initialId)) {
      list.push({ merchantId: initialId, merchantName: initialName });
    }
    return list;
  }, [stores, item, initialDraft]);

  const [itemName, setItemName] = useState(item?.itemName ?? initialDraft?.itemName ?? '');
  const [quantity, setQuantity] = useState(
    item?.quantity === null ? '' : String(item?.quantity ?? initialDraft?.quantity ?? ''),
  );
  const [price, setPrice] = useState(
    formatPriceInput(item?.priceCents ?? initialDraft?.priceCents ?? null),
  );
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(
    item?.priceUnit ?? initialDraft?.priceUnit ?? 'each',
  );
  const [merchantId, setMerchantId] = useState(
    item?.merchantId ?? initialDraft?.merchantId ?? ANYWHERE_VALUE,
  );
  const [barcode] = useState<string | null>(item?.barcode ?? initialDraft?.barcode ?? null);

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

    const store = availableStores.find((choice) => choice.merchantId === merchantId);
    const isAnywhere = merchantId === ANYWHERE_VALUE;
    const resolvedMerchantId = isAnywhere
      ? null
      : (store?.merchantId ?? item?.merchantId ?? initialDraft?.merchantId ?? merchantId);
    const resolvedMerchantName = isAnywhere
      ? null
      : (store?.merchantName ?? item?.merchantName ?? initialDraft?.merchantName ?? null);

    onSubmit({
      itemName: name.data,
      quantity: parsedQuantity.quantity ?? null,
      priceCents: canPrice ? (parsedPrice.cents ?? null) : (item.priceCents ?? null),
      priceUnit,
      merchantId: resolvedMerchantId,
      merchantName: resolvedMerchantName,
      barcode: barcode ?? null,
    });
    onOpenChange(false);
  };

  return (
    <ModalBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${item.itemName}` : 'Add an item'}
      description="Enter item details, quantity, price, and store assignment"
    >
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-4 px-4 pb-6"
        onSubmit={handleSubmit}
      >
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
        <div
          className="flex flex-col gap-1.5"
          role="group"
          aria-labelledby="item-sheet-store-label"
        >
          <span
            id="item-sheet-store-label"
            className="text-label-md text-[var(--md-sys-color-on-surface-variant)]"
          >
            Store
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <MdFilterChip
              selected={merchantId === ANYWHERE_VALUE}
              onClick={() => {
                setMerchantId(ANYWHERE_VALUE);
              }}
            >
              Anywhere
            </MdFilterChip>
            {availableStores.map((store) => (
              <MdFilterChip
                key={store.merchantId}
                selected={merchantId === store.merchantId}
                onClick={() => {
                  setMerchantId(store.merchantId);
                }}
              >
                {store.merchantName}
              </MdFilterChip>
            ))}
          </div>
          {stores.length > 3 && (
            <Select
              label="All stores"
              name="merchantId"
              options={[
                { value: ANYWHERE_VALUE, label: 'Anywhere' },
                ...stores.map((store) => ({ value: store.merchantId, label: store.merchantName })),
              ]}
              value={merchantId}
              onValueChange={setMerchantId}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--md-sys-color-outline-variant)]">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {isEditing ? 'Save item' : 'Add item'}
          </Button>
        </div>
      </form>
    </ModalBottomSheet>
  );
}
