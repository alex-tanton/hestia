import {
  useCallback,
  useId,
  type ChangeEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from 'react';
import { cn } from '../../lib/cn.ts';
import { MdOutlinedTextField } from '../md/MdTextField.tsx';
import { omitUndefined } from '../md/props.ts';
import { DateField } from './DateField.tsx';
import { Icon } from './Icon.tsx';
import { TimeField } from './TimeField.tsx';

export interface FieldChangeEvent {
  target: { value: string };
  currentTarget: { value: string };
}

export interface FieldMessages {
  label?: string | undefined;
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

export function FieldFrame({
  label,
  hint,
  error,
  disabledReason,
  className,
  children,
}: FieldMessages & {
  className?: string | undefined;
  children: (ids: FieldIds) => ReactNode;
}): ReactElement {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const hintId = hint ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const reasonId = disabledReason ? `${baseId}-reason` : undefined;
  const describedBy = [hintId, errorId, reasonId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label !== undefined && (
        <label htmlFor={inputId} className="text-body-sm font-semibold text-primary">
          {label}
        </label>
      )}
      {children({ inputId, describedBy, isInvalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="max-w-[70ch] break-words text-caption text-secondary">
          {hint}
        </p>
      )}
      {error && (
        // An error pairs the red border with a message, never color alone.
        <p
          id={errorId}
          role="alert"
          className="flex max-w-[70ch] items-start gap-1.5 break-words text-body-sm text-danger"
        >
          <Icon name="error" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {disabledReason && (
        <p id={reasonId} className="max-w-[70ch] break-words text-body-sm text-secondary">
          {disabledReason}
        </p>
      )}
    </div>
  );
}

export interface NativePickerFieldProps extends FieldMessages {
  type: 'date' | 'time';
  value?: string | undefined;
  defaultValue?: string | undefined;
  name?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  min?: string | number | undefined;
  max?: string | number | undefined;
  step?: string | number | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  ref?: Ref<HTMLElement> | undefined;
  onChange?: ((event: FieldChangeEvent) => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
}

const NATIVE_PICKER_CLASSES =
  'min-h-14 w-full min-w-0 rounded-[var(--md-sys-shape-corner-extra-small)] bg-[var(--md-sys-color-surface)] px-4 text-[1rem] leading-6 text-[var(--md-sys-color-on-surface)] transition-colors duration-150 ease-out placeholder:text-[var(--md-sys-color-on-surface-variant)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--md-sys-color-surface-container-highest)]/40 disabled:opacity-60';

function forwardNodeRef<T extends HTMLElement>(
  ref: Ref<HTMLElement> | undefined,
  node: T | null,
): ReturnType<RefCallback<T>> {
  if (typeof ref === 'function') {
    return ref(node);
  }
  if (ref !== undefined && ref !== null) {
    Reflect.set(ref, 'current', node);
  }
  return undefined;
}

export function NativePickerField({
  type,
  label,
  hint,
  error,
  disabledReason,
  value,
  defaultValue,
  name,
  placeholder,
  disabled,
  min,
  max,
  step,
  className,
  'aria-label': ariaLabel,
  ref,
  onChange,
  onKeyDown,
}: NativePickerFieldProps): ReactElement {
  const forwardRef: RefCallback<HTMLInputElement> = useCallback(
    (node: HTMLInputElement | null) => forwardNodeRef(ref, node),
    [ref],
  );

  const refProps = ref !== undefined && ref !== null ? { ref: forwardRef } : undefined;

  return (
    <FieldFrame
      label={label}
      hint={hint}
      error={error}
      disabledReason={disabledReason}
      className={className}
    >
      {({ inputId, describedBy, isInvalid }) => {
        const inputProps = omitUndefined({
          value,
          defaultValue,
          name,
          placeholder,
          min,
          max,
          step,
          'aria-label': ariaLabel,
          'aria-describedby': describedBy,
          onKeyDown,
        });

        const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
          const next = event.currentTarget.value;
          onChange?.({ target: { value: next }, currentTarget: { value: next } });
        };

        return (
          <input
            {...inputProps}
            {...refProps}
            id={inputId}
            type={type}
            disabled={disabled ?? Boolean(disabledReason)}
            aria-invalid={isInvalid || undefined}
            onChange={handleChange}
            className={cn(
              NATIVE_PICKER_CLASSES,
              isInvalid
                ? 'border-2 border-[var(--md-sys-color-error)] focus:border-2 focus:border-[var(--md-sys-color-error)]'
                : 'border border-[var(--md-sys-color-outline)] hover:border-[var(--md-sys-color-on-surface)] focus:border-2 focus:border-[var(--md-sys-color-primary)]',
            )}
          />
        );
      }}
    </FieldFrame>
  );
}

type BaseFieldAttributes = Omit<
  HTMLAttributes<HTMLElement>,
  'onChange' | 'onInput' | 'onKeyDown' | 'className' | 'children' | 'defaultValue' | 'spellCheck'
>;

export interface CommonMdFieldProps extends FieldMessages, BaseFieldAttributes {
  value?: string | undefined;
  defaultValue?: string | undefined;
  name?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  maxLength?: number | undefined;
  min?: string | number | undefined;
  max?: string | number | undefined;
  step?: string | number | undefined;
  inputMode?: HTMLAttributes<HTMLElement>['inputMode'] | undefined;
  autoComplete?: string | undefined;
  enterKeyHint?: HTMLAttributes<HTMLElement>['enterKeyHint'] | undefined;
  autoCapitalize?: HTMLAttributes<HTMLElement>['autoCapitalize'] | undefined;
  spellCheck?: boolean | undefined;
  className?: string | undefined;
  ref?: Ref<HTMLElement> | undefined;
  onChange?: ((event: FieldChangeEvent) => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
}

export type TextFieldType =
  'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | 'number' | 'date' | 'time';

export interface TextFieldProps extends CommonMdFieldProps {
  type?: TextFieldType | undefined;
}

export interface TextAreaFieldProps extends CommonMdFieldProps {
  rows?: number | undefined;
}

function readFieldValue(target: EventTarget | null): string | undefined {
  if (target !== null && 'value' in target && typeof target.value === 'string') {
    return target.value;
  }
  return undefined;
}

function useMdFieldControl(
  ref: Ref<HTMLElement> | undefined,
  onChange: ((event: FieldChangeEvent) => void) | undefined,
): {
  refProps: { ref: RefCallback<HTMLElement> } | undefined;
  handleValueEvent: (event: Event) => void;
} {
  const forwardRef: RefCallback<HTMLElement> = useCallback(
    (node: HTMLElement | null) => forwardNodeRef(ref, node),
    [ref],
  );

  const handleValueEvent = useCallback(
    (event: Event): void => {
      const next = readFieldValue(event.currentTarget);
      if (next !== undefined) {
        onChange?.({ target: { value: next }, currentTarget: { value: next } });
      }
    },
    [onChange],
  );

  const refProps = ref !== undefined && ref !== null ? { ref: forwardRef } : undefined;
  return { refProps, handleValueEvent };
}

function toStringBound(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? String(value) : value;
}

export function TextField({
  type = 'text',
  label,
  hint,
  error,
  disabledReason,
  value,
  defaultValue,
  name,
  placeholder,
  disabled,
  maxLength,
  min,
  max,
  step,
  inputMode,
  autoComplete,
  enterKeyHint,
  autoCapitalize,
  spellCheck,
  className,
  ref,
  onChange,
  onKeyDown,
  ...rest
}: TextFieldProps): ReactElement {
  const { refProps, handleValueEvent } = useMdFieldControl(ref, onChange);

  if (type === 'date' || type === 'time') {
    const pickerProps = omitUndefined({
      label,
      hint,
      error,
      disabledReason,
      value,
      defaultValue,
      name,
      placeholder,
      disabled,
      min,
      max,
      step,
      className,
      'aria-label': rest['aria-label'],
      onChange,
      onKeyDown,
    });
    const hostRefProps = ref !== undefined && ref !== null ? { ref } : undefined;
    return type === 'date' ? (
      <DateField {...pickerProps} {...hostRefProps} />
    ) : (
      <TimeField {...pickerProps} {...hostRefProps} />
    );
  }

  const isInvalid = Boolean(error);
  const resolvedValue = value ?? defaultValue;

  const mdProps = omitUndefined({
    ...rest,
    type,
    label,
    value: resolvedValue,
    name,
    placeholder,
    disabled: disabled ?? Boolean(disabledReason),
    maxLength,
    min: toStringBound(min),
    max: toStringBound(max),
    step: toStringBound(step),
    inputMode,
    autocomplete: autoComplete,
    enterKeyHint,
    autoCapitalize,
    spellCheck,
    className: cn('w-full min-w-0 max-w-full', className),
    onKeyDown,
    error: isInvalid,
    errorText: error ?? '',
    supportingText: disabledReason ?? hint ?? '',
    'aria-invalid': isInvalid || undefined,
    onInput: handleValueEvent,
    onChange: handleValueEvent,
  });

  return <MdOutlinedTextField {...mdProps} {...refProps} />;
}

export function TextAreaField({
  label,
  hint,
  error,
  disabledReason,
  value,
  defaultValue,
  name,
  placeholder,
  disabled,
  maxLength,
  min,
  max,
  step,
  rows = 4,
  inputMode,
  autoComplete,
  enterKeyHint,
  autoCapitalize,
  spellCheck,
  className,
  ref,
  onChange,
  onKeyDown,
  ...rest
}: TextAreaFieldProps): ReactElement {
  const { refProps, handleValueEvent } = useMdFieldControl(ref, onChange);
  const isInvalid = Boolean(error);
  const resolvedValue = value ?? defaultValue;

  const mdProps = omitUndefined({
    ...rest,
    rows,
    label,
    value: resolvedValue,
    name,
    placeholder,
    disabled: disabled ?? Boolean(disabledReason),
    maxLength,
    min: toStringBound(min),
    max: toStringBound(max),
    step: toStringBound(step),
    inputMode,
    autocomplete: autoComplete,
    enterKeyHint,
    autoCapitalize,
    spellCheck,
    className: cn('w-full min-w-0 max-w-full', className),
    onKeyDown,
    error: isInvalid,
    errorText: error ?? '',
    supportingText: disabledReason ?? hint ?? '',
    'aria-invalid': isInvalid || undefined,
    onInput: handleValueEvent,
    onChange: handleValueEvent,
  });

  return <MdOutlinedTextField type="textarea" {...mdProps} {...refProps} />;
}
