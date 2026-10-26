import type { ReactElement } from 'react';
import { previewOccurrences, type RecurrenceUnit } from '@hestia/recurrence';
import { formatCalendarDate } from '../../lib/format.ts';
import { TextField } from '../ui/Field.tsx';
import { Select } from '../ui/Select.tsx';

const UNIT_OPTIONS: readonly { value: RecurrenceUnit; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

export interface RecurrenceValue {
  unit: RecurrenceUnit;
  /** Kept as text while editing; only parsed to a number at save time. */
  interval: string;
  anchorDate: string;
}

export interface RecurrenceFieldsProps {
  value: RecurrenceValue;
  onChange: (next: RecurrenceValue) => void;
  intervalError?: string | undefined;
  disabledReason?: string | undefined;
}

/**
 * The chore sheet's recurrence editor: unit, interval, and anchor date, with a plain-language
 * preview of the next three occurrence dates that updates as the fields change. Reuses
 * `@hestia/recurrence`'s own `previewOccurrences`, the same function behind both the bill and
 * chore sheets (`packages/recurrence/src/occurrence.ts`), so the preview can never
 * drift from the anchored-recurrence rules the server applies.
 */
export function RecurrenceFields({
  value,
  onChange,
  intervalError,
  disabledReason,
}: RecurrenceFieldsProps): ReactElement {
  const parsedInterval = Number(value.interval);
  const isValidInterval = Number.isInteger(parsedInterval) && parsedInterval > 0;
  const preview =
    isValidInterval && value.anchorDate !== ''
      ? previewOccurrences(
          { unit: value.unit, interval: parsedInterval, anchorDate: value.anchorDate },
          3,
        )
      : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Repeats every"
          value={value.unit}
          options={UNIT_OPTIONS}
          disabledReason={disabledReason}
          onValueChange={(unit) => {
            onChange({ ...value, unit: unit as RecurrenceUnit });
          }}
        />
        <TextField
          label="Interval"
          inputMode="numeric"
          value={value.interval}
          error={intervalError}
          disabledReason={disabledReason}
          onChange={(event) => {
            onChange({ ...value, interval: event.target.value });
          }}
        />
      </div>
      <TextField
        label="Anchor date"
        type="date"
        hint="The first occurrence. Defaults to today."
        value={value.anchorDate}
        disabledReason={disabledReason}
        onChange={(event) => {
          onChange({ ...value, anchorDate: event.target.value });
        }}
      />
      {preview.length > 0 && (
        <p className="text-body-sm text-secondary">
          Occurs on {preview.map((date) => formatCalendarDate(date)).join(', ')}
        </p>
      )}
    </div>
  );
}
