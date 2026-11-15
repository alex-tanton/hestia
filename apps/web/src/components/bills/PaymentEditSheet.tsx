import { useState, type ReactElement, type SyntheticEvent } from 'react';
import type { BillPayment } from '@hestia/shared';
import { formatPriceInput, parsePriceInput } from '../../lib/price-input.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';

export interface PaymentEditDraft {
  paidDate: string;
  amountPaidCents: number;
}

export interface PaymentEditSheetProps {
  payment: BillPayment;
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: PaymentEditDraft) => void;
  isSaving?: boolean;
}

type Field = 'paidDate' | 'amount';

/**
 * Payment history edit sheet using ModalBottomSheet per D-12 and Pattern 3.
 * Adjusts payment date and amount; which occurrence the payment belongs to is never editable.
 */
export function PaymentEditSheet({
  payment,
  open = true,
  onOpenChange,
  onSubmit,
  isSaving = false,
}: PaymentEditSheetProps): ReactElement {
  const { errors, setErrors, formRef } = useFieldErrors<Field>();
  const [paidDate, setPaidDate] = useState(payment.paidDate ?? '');
  const [amount, setAmount] = useState(formatPriceInput(payment.amountPaidCents));

  const handleSubmit = (event?: SyntheticEvent): void => {
    event?.preventDefault();
    const next: Partial<Record<Field, string>> = {};

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) next.paidDate = 'Enter the date it was paid.';
    const parsedAmount = parsePriceInput(amount);
    if (parsedAmount.error !== undefined) next.amount = parsedAmount.error;
    else if (parsedAmount.cents === undefined) next.amount = 'Enter the amount paid.';

    setErrors(next);
    if (Object.keys(next).length > 0 || parsedAmount.cents === undefined) return;

    onSubmit({ paidDate, amountPaidCents: parsedAmount.cents });
  };

  return (
    <ModalBottomSheet open={open} onOpenChange={onOpenChange} title="Edit payment">
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-4 px-4 pb-6"
        onSubmit={handleSubmit}
      >
        <TextField
          label="Date paid"
          name="paidDate"
          type="date"
          value={paidDate}
          error={errors.paidDate}
          onChange={(event) => {
            setPaidDate(event.target.value);
          }}
        />
        <TextField
          label="Amount paid"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          hint="In dollars"
          value={amount}
          error={errors.amount}
          onChange={(event) => {
            setAmount(event.target.value);
          }}
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--md-sys-color-outline-variant)]">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSaving} onClick={handleSubmit}>
            Save payment changes
          </Button>
        </div>
      </form>
    </ModalBottomSheet>
  );
}
