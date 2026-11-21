import { useSyncExternalStore, type ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';
import { MdOutlinedSelect, MdSelectOption } from '../md/MdSelect.tsx';
import { omitUndefined } from '../md/props.ts';
import { FieldFrame } from './Field.tsx';
import { Icon } from './Icon.tsx';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  disabledReason?: string | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
}

const COARSE_POINTER = '(pointer: coarse)';

function subscribeToPointer(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function isCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COARSE_POINTER).matches;
}

const NATIVE_SELECT_CLASSES =
  'min-h-14 w-full min-w-0 appearance-none rounded-[var(--md-sys-shape-corner-extra-small)] bg-[var(--md-sys-color-surface)] pr-10 pl-4 text-left text-[1rem] leading-6 text-[var(--md-sys-color-on-surface)] transition-colors duration-150 ease-out focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--md-sys-color-surface-container-highest)]/40 disabled:opacity-60';

function readSelectValue(target: EventTarget | null): string | undefined {
  if (target !== null && 'value' in target && typeof target.value === 'string') {
    return target.value;
  }
  return undefined;
}

/**
 * Hybrid MD3 Select: native `<select>` on coarse touch devices for fast platform pickers, and
 * `<MdOutlinedSelect menuPositioning="fixed">` on fine-pointer desktops so popovers escape clipped
 * cards and bottom sheets.
 */
export function Select({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  hint,
  error,
  disabledReason,
  disabled,
  name,
}: SelectProps): ReactElement {
  const isNative = useSyncExternalStore(subscribeToPointer, isCoarsePointer, () => false);
  const isDisabled = disabled ?? Boolean(disabledReason);
  const isInvalid = Boolean(error);

  if (isNative) {
    return (
      <FieldFrame label={label} hint={hint} error={error} disabledReason={disabledReason}>
        {({ inputId, describedBy }) => (
          <div className="relative">
            <select
              id={inputId}
              name={name}
              value={value}
              disabled={isDisabled}
              aria-invalid={isInvalid || undefined}
              aria-describedby={describedBy}
              onChange={(event) => {
                onValueChange(event.currentTarget.value);
              }}
              className={cn(
                NATIVE_SELECT_CLASSES,
                isInvalid
                  ? 'border-2 border-[var(--md-sys-color-error)] focus:border-2 focus:border-[var(--md-sys-color-error)]'
                  : 'border border-[var(--md-sys-color-outline)] hover:border-[var(--md-sys-color-on-surface)] focus:border-2 focus:border-[var(--md-sys-color-primary)]',
              )}
            >
              {placeholder && (
                <option value="" disabled>
                  {placeholder}
                </option>
              )}
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              size={18}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]"
            />
          </div>
        )}
      </FieldFrame>
    );
  }

  const hasMatchingOption = options.some((option) => option.value === value);
  const ariaInvalid: 'true' | undefined = isInvalid ? 'true' : undefined;
  const mdProps = omitUndefined({
    label,
    name,
    value: hasMatchingOption ? value : '',
    disabled: isDisabled,
    error: isInvalid,
    errorText: error ?? '',
    supportingText: disabledReason ?? hint ?? '',
    'aria-invalid': ariaInvalid,
    className: 'w-full min-w-0 max-w-full',
    onChange: (event: Event) => {
      const next = readSelectValue(event.currentTarget);
      if (next !== undefined) {
        onValueChange(next);
      }
    },
  });

  return (
    <MdOutlinedSelect menuPositioning="fixed" {...mdProps}>
      {options.map((option) => (
        <MdSelectOption key={option.value} value={option.value} selected={option.value === value}>
          <div slot="headline">{option.label}</div>
        </MdSelectOption>
      ))}
    </MdOutlinedSelect>
  );
}
