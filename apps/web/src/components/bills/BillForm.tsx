import { useState, type ReactElement, type SyntheticEvent } from 'react';
import type { Bill, BillVisibility, RecurrenceUnit } from '@hearth/shared';
import { recurrencePreviewSentence } from '../../lib/bills/recurrence-preview.ts';
import { formatPriceInput, parsePriceInput } from '../../lib/price-input.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { Button } from '../ui/Button.tsx';
import { Checkbox } from '../ui/Checkbox.tsx';
import { TextField } from '../ui/Field.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { Select } from '../ui/Select.tsx';
import { Sheet } from '../ui/Sheet.tsx';

export interface BillDraft {
  name: string;
  amountCents: number;
  category: string | null;
  recurrenceUnit: RecurrenceUnit | null;
  interval: number;
  anchorDate: string;
  reminderDaysBefore: number;
  autopay: boolean;
  isSubscription: boolean;
}

export interface BillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing bill, or adding a new one — visibility is asked only when adding, since
   * a bill's owner cannot move it between household and personal afterward. */
  bill?: Bill | undefined;
  onSubmit: (draft: BillDraft, visibility: BillVisibility) => void;
  isSaving?: boolean;
}

const RECURRENCE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'One time' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

const INTERVAL_HINT: Readonly<Record<RecurrenceUnit, string>> = {
  day: 'Number of days between bills',
  week: 'Number of weeks between bills',
  month: 'Number of months between bills',
  year: 'Number of years between bills',
};

const VISIBILITY_SEGMENTS = [
  { value: 'household', label: 'Household' },
  { value: 'personal', label: 'Personal' },
] as const;

type Field = 'name' | 'amount' | 'interval' | 'anchorDate' | 'reminderDaysBefore';

function toUnit(value: string): RecurrenceUnit | null {
  return value === '' ? null : (value as RecurrenceUnit);
}

/**
 * The bill sheet: name, amount, category, recurrence (with the next-three-dates preview),
 * autopay, reminder lead time, and whether it counts toward Subscriptions. Visibility is asked
 * only when adding a bill — the database's own
 * `bill_personal_iff_no_household` constraint, and the fact that PATCH /bills/:id does not accept
 * it, mean there is no "move a bill" action to build a control for.
 */
export function BillForm({
  open,
  onOpenChange,
  bill,
  onSubmit,
  isSaving = false,
}: BillFormProps): ReactElement {
  const isEditing = bill !== undefined;
  const { errors, setErrors, formRef } = useFieldErrors<Field>();

  const [visibility, setVisibility] = useState<BillVisibility>(bill?.visibility ?? 'household');
  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(formatPriceInput(bill?.amountCents ?? null));
  const [category, setCategory] = useState(bill?.category ?? '');
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit | null>(
    bill?.recurrenceUnit ?? 'month',
  );
  const [interval, setIntervalText] = useState(String(bill?.interval ?? 1));
  const [anchorDate, setAnchorDate] = useState(bill?.anchorDate ?? '');
  const [reminderDaysBefore, setReminderDaysBefore] = useState(
    String(bill?.reminderDaysBefore ?? 3),
  );
  const [autopay, setAutopay] = useState(bill?.autopay ?? false);
  const [isSubscription, setIsSubscription] = useState(bill?.isSubscription ?? false);

  const parsedInterval = Number.parseInt(interval, 10);
  const preview = recurrencePreviewSentence({
    unit: recurrenceUnit,
    interval: Number.isNaN(parsedInterval) ? 0 : parsedInterval,
    anchorDate,
  });

  const handleSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const next: Partial<Record<Field, string>> = {};

    const trimmedName = name.trim();
    if (trimmedName === '') next.name = 'Enter a name.';

    const parsedAmount = parsePriceInput(amount);
    if (parsedAmount.error !== undefined) next.amount = parsedAmount.error;
    else if (parsedAmount.cents === undefined) next.amount = 'Enter an amount.';

    // A one-time bill hides the interval field, so its (possibly blank) text must not block saving.
    if (recurrenceUnit !== null && (!Number.isInteger(parsedInterval) || parsedInterval <= 0)) {
      next.interval = 'Enter a whole number, 1 or more.';
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) next.anchorDate = 'Enter the first due date.';

    const parsedReminder = Number.parseInt(reminderDaysBefore, 10);
    if (!Number.isInteger(parsedReminder) || parsedReminder < 0) {
      next.reminderDaysBefore = 'Enter 0 or more days.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || parsedAmount.cents === undefined) return;

    onSubmit(
      {
        name: trimmedName,
        amountCents: parsedAmount.cents,
        category: category.trim() === '' ? null : category.trim(),
        recurrenceUnit,
        interval: recurrenceUnit === null ? 1 : parsedInterval,
        anchorDate,
        reminderDaysBefore: parsedReminder,
        autopay,
        isSubscription,
      },
      visibility,
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${bill.name}` : 'Add a bill'}
    >
      <form ref={formRef} noValidate className="flex flex-col gap-3 px-4" onSubmit={handleSubmit}>
        {isEditing ? (
          <p className="text-body-sm text-secondary">
            {bill.visibility === 'personal' ? 'Personal bill' : 'Household bill'}
          </p>
        ) : (
          <SegmentedControl
            label="Visibility"
            segments={VISIBILITY_SEGMENTS}
            value={visibility}
            onValueChange={(value) => {
              setVisibility(value === 'personal' ? 'personal' : 'household');
            }}
          />
        )}
        <TextField
          label="Name"
          name="name"
          autoComplete="off"
          value={name}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <TextField
          label="Amount"
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
        <TextField
          label="Category"
          name="category"
          autoComplete="off"
          hint="Optional"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
          }}
        />
        <Select
          label="Repeats"
          name="recurrenceUnit"
          options={RECURRENCE_OPTIONS}
          value={recurrenceUnit ?? ''}
          onValueChange={(value) => {
            setRecurrenceUnit(toUnit(value));
          }}
        />
        {recurrenceUnit !== null && (
          <TextField
            label="Every"
            name="interval"
            inputMode="numeric"
            hint={INTERVAL_HINT[recurrenceUnit]}
            value={interval}
            error={errors.interval}
            onChange={(event) => {
              setIntervalText(event.target.value);
            }}
          />
        )}
        <TextField
          label="First due date"
          name="anchorDate"
          type="date"
          value={anchorDate}
          error={errors.anchorDate}
          onChange={(event) => {
            setAnchorDate(event.target.value);
          }}
        />
        {preview !== undefined && <p className="text-body-sm text-secondary">{preview}</p>}
        <TextField
          label="Remind me this many days before"
          name="reminderDaysBefore"
          inputMode="numeric"
          value={reminderDaysBefore}
          error={errors.reminderDaysBefore}
          onChange={(event) => {
            setReminderDaysBefore(event.target.value);
          }}
        />
        <Checkbox
          label="Autopay"
          checked={autopay}
          onChange={(event) => {
            setAutopay(event.target.checked);
          }}
        />
        <Checkbox
          label="Track as a subscription"
          checked={isSubscription}
          onChange={(event) => {
            setIsSubscription(event.target.checked);
          }}
        />
        <Button type="submit" isLoading={isSaving} className="mt-1">
          {isEditing ? 'Save bill' : 'Add bill'}
        </Button>
      </form>
    </Sheet>
  );
}
