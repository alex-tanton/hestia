import { useState, type ReactElement, type SyntheticEvent } from 'react';
import type { Bill, BillVisibility, RecurrenceUnit } from '@hestia/shared';
import { recurrencePreviewSentence } from '../../lib/bills/recurrence-preview.ts';
import { formatPriceInput, parsePriceInput } from '../../lib/price-input.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { MdDialog } from '../md/MdDialog.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { Select } from '../ui/Select.tsx';
import { Switch } from '../ui/Switch.tsx';

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
  bill?: Bill | undefined;
  onSubmit: (draft: BillDraft, visibility: BillVisibility) => void;
  isSaving?: boolean;
  initialIsSubscription?: boolean;
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
 * Responsive MD3 Bill dialog (<600px full-screen canvas, >=600px centered max-w-[720px])
 * featuring MD3 Switch controls for recurrence, autopay, and subscription tracking (D-11, BILL-02).
 */
export function BillForm({
  open,
  onOpenChange,
  bill,
  onSubmit,
  isSaving = false,
  initialIsSubscription = false,
}: BillFormProps): ReactElement {
  const isEditing = bill !== undefined;
  const title = isEditing ? `Edit ${bill.name}` : 'Add bill';
  const { errors, setErrors, formRef } = useFieldErrors<Field>();

  const [visibility, setVisibility] = useState<BillVisibility>(bill?.visibility ?? 'household');
  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(formatPriceInput(bill?.amountCents ?? null));
  const [category, setCategory] = useState(bill?.category ?? '');
  const [isRecurring, setIsRecurring] = useState((bill?.recurrenceUnit ?? null) !== null);
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit | null>(
    bill?.recurrenceUnit ?? 'month',
  );
  const [interval, setIntervalText] = useState(String(bill?.interval ?? 1));
  const [anchorDate, setAnchorDate] = useState(bill?.anchorDate ?? '');
  const [reminderDaysBefore, setReminderDaysBefore] = useState(
    String(bill?.reminderDaysBefore ?? 3),
  );
  const [autopay, setAutopay] = useState(bill?.autopay ?? false);
  const [isSubscription, setIsSubscription] = useState(
    bill?.isSubscription ?? initialIsSubscription,
  );

  const parsedInterval = Number.parseInt(interval, 10);
  const effectiveUnit = isRecurring ? recurrenceUnit : null;
  const preview = recurrencePreviewSentence({
    unit: effectiveUnit,
    interval: Number.isNaN(parsedInterval) ? 0 : parsedInterval,
    anchorDate,
  });

  const handleSubmit = (event?: SyntheticEvent): void => {
    event?.preventDefault();
    const next: Partial<Record<Field, string>> = {};

    if (name.trim() === '') next.name = 'Enter the bill name.';
    const parsedAmount = parsePriceInput(amount);
    if (parsedAmount.error !== undefined) next.amount = parsedAmount.error;
    else if (parsedAmount.cents === undefined) next.amount = 'Enter the amount.';

    if (isRecurring && effectiveUnit !== null) {
      if (Number.isNaN(parsedInterval) || parsedInterval <= 0)
        next.interval = 'Interval must be at least 1.';
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) next.anchorDate = 'Enter the first due date.';

    const parsedReminder = Number.parseInt(reminderDaysBefore, 10);
    if (Number.isNaN(parsedReminder) || parsedReminder < 0)
      next.reminderDaysBefore = 'Reminder lead time cannot be negative.';

    setErrors(next);
    if (
      Object.keys(next).length > 0 ||
      parsedAmount.cents === undefined ||
      Number.isNaN(parsedReminder)
    )
      return;

    onSubmit(
      {
        name: name.trim(),
        amountCents: parsedAmount.cents,
        category: category.trim() === '' ? null : category.trim(),
        recurrenceUnit: effectiveUnit,
        interval: isRecurring && effectiveUnit !== null ? parsedInterval : 1,
        anchorDate,
        reminderDaysBefore: parsedReminder,
        autopay,
        isSubscription,
      },
      visibility,
    );
  };

  return (
    <MdDialog
      role="dialog"
      open={open}
      quick
      aria-label={title}
      className="md3-responsive-dialog w-full max-w-[720px]"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onOpenChange(false);
        }
      }}
    >
      <div
        slot="headline"
        id="dialog-title"
        className="text-title-lg font-semibold text-[var(--md-sys-color-on-surface)]"
      >
        {title}
      </div>
      <form
        ref={formRef}
        slot="content"
        noValidate
        className="flex flex-col gap-4 pt-2"
        onSubmit={handleSubmit}
      >
        {isEditing ? (
          <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
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
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
          }}
        />

        {/* Recurrence Switch and Cadence */}
        <Switch
          label="Recurring bill"
          checked={isRecurring}
          onCheckedChange={(checked) => {
            setIsRecurring(checked);
            if (checked && recurrenceUnit === null) {
              setRecurrenceUnit('month');
            }
          }}
        />
        {isRecurring && (
          <div className="flex flex-col gap-3 pl-2 border-l-2 border-[var(--md-sys-color-outline-variant)]">
            <Select
              label="Repeats"
              name="recurrenceUnit"
              options={RECURRENCE_OPTIONS}
              value={recurrenceUnit ?? 'month'}
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
          </div>
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
        {preview !== undefined && (
          <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">{preview}</p>
        )}
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

        {/* Autopay and Subscription MD3 Switches */}
        <Switch label="Autopay enabled" checked={autopay} onCheckedChange={setAutopay} />
        <Switch
          label="Track as a subscription"
          checked={isSubscription}
          onCheckedChange={setIsSubscription}
        />
      </form>
      <div slot="actions" className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          isLoading={isSaving}
          onClick={() => {
            handleSubmit();
          }}
        >
          {isEditing ? 'Save bill changes' : 'Add bill'}
        </Button>
      </div>
    </MdDialog>
  );
}
