import { CircleAlert } from 'lucide-react';
import {
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn.ts';

interface FieldMessages {
  label: string;
  /** Helper text shown up front, e.g. "At least 8 characters". */
  hint?: string | undefined;
  /** Error message; turns the field into its error state. */
  error?: string | undefined;
  /** Why the field is unavailable ("Needs a connection."); disables it. */
  disabledReason?: string | undefined;
}

interface FieldIds {
  inputId: string;
  describedBy: string | undefined;
  isInvalid: boolean;
}

/** 16px text keeps iOS Safari from zooming on focus (Branding › Typography). */
const CONTROL_CLASSES =
  'w-full rounded-sm border bg-base px-3 text-body text-primary placeholder:text-muted transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:bg-raised disabled:opacity-60';

function FieldFrame({
  label,
  hint,
  error,
  disabledReason,
  children,
}: FieldMessages & { children: (ids: FieldIds) => ReactNode }): ReactElement {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const hintId = hint ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const reasonId = disabledReason ? `${baseId}-reason` : undefined;
  const describedBy = [hintId, errorId, reasonId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-body-sm font-semibold text-primary">
        {label}
      </label>
      {children({ inputId, describedBy, isInvalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-caption text-secondary">
          {hint}
        </p>
      )}
      {error && (
        // Design › Primitives: an error pairs the red border with a message, never color alone.
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-body-sm text-danger">
          <CircleAlert aria-hidden size={20} strokeWidth={1.5} className="mt-px shrink-0" />
          {error}
        </p>
      )}
      {disabledReason && (
        <p id={reasonId} className="text-body-sm text-secondary">
          {disabledReason}
        </p>
      )}
    </div>
  );
}

export type TextFieldProps = FieldMessages &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'aria-invalid' | 'aria-describedby'>;

export function TextField({
  label,
  hint,
  error,
  disabledReason,
  disabled,
  className,
  ...inputProps
}: TextFieldProps): ReactElement {
  return (
    <FieldFrame label={label} hint={hint} error={error} disabledReason={disabledReason}>
      {({ inputId, describedBy, isInvalid }) => (
        <input
          {...inputProps}
          id={inputId}
          disabled={disabled ?? Boolean(disabledReason)}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            CONTROL_CLASSES,
            'min-h-11',
            isInvalid ? 'border-2 border-danger' : 'border-input hover:border-primary',
            className,
          )}
        />
      )}
    </FieldFrame>
  );
}

export type TextAreaFieldProps = FieldMessages &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'aria-invalid' | 'aria-describedby'>;

export function TextAreaField({
  label,
  hint,
  error,
  disabledReason,
  disabled,
  className,
  rows = 4,
  ...textareaProps
}: TextAreaFieldProps): ReactElement {
  return (
    <FieldFrame label={label} hint={hint} error={error} disabledReason={disabledReason}>
      {({ inputId, describedBy, isInvalid }) => (
        <textarea
          {...textareaProps}
          id={inputId}
          rows={rows}
          disabled={disabled ?? Boolean(disabledReason)}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            CONTROL_CLASSES,
            'py-2.5',
            isInvalid ? 'border-2 border-danger' : 'border-input hover:border-primary',
            className,
          )}
        />
      )}
    </FieldFrame>
  );
}

export { FieldFrame };
