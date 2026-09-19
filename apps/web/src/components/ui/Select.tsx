import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import { useSyncExternalStore, type ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';
import { useSection } from '../../lib/section-context.tsx';
import { FieldFrame } from './Field.tsx';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  hint?: string | undefined;
  error?: string | undefined;
  disabledReason?: string | undefined;
  disabled?: boolean;
  name?: string;
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

const TRIGGER_CLASSES =
  'flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border bg-base px-3 text-left text-body text-primary transition-colors duration-150 ease-out hover:border-primary disabled:cursor-not-allowed disabled:bg-raised disabled:opacity-60';

/**
 * Design › Primitives: Radix Select, native on mobile where possible. Touch devices get the
 * platform picker, which is faster one-handed than a custom listbox.
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
  const section = useSection();

  return (
    <FieldFrame label={label} hint={hint} error={error} disabledReason={disabledReason}>
      {({ inputId, describedBy, isInvalid }) => {
        const borderClass = isInvalid ? 'border-2 border-danger' : 'border-input';
        if (isNative) {
          return (
            <div className="relative">
              <select
                id={inputId}
                name={name}
                value={value}
                disabled={isDisabled}
                aria-invalid={isInvalid || undefined}
                aria-describedby={describedBy}
                onChange={(event) => {
                  onValueChange(event.target.value);
                }}
                className={cn(TRIGGER_CLASSES, 'appearance-none pr-10', borderClass)}
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
              <ChevronDown
                aria-hidden
                size={20}
                strokeWidth={1.5}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-secondary"
              />
            </div>
          );
        }
        return (
          <RadixSelect.Root
            value={value}
            onValueChange={onValueChange}
            disabled={isDisabled}
            {...(name ? { name } : {})}
          >
            <RadixSelect.Trigger
              id={inputId}
              aria-invalid={isInvalid || undefined}
              aria-describedby={describedBy}
              className={cn(TRIGGER_CLASSES, borderClass)}
            >
              <RadixSelect.Value placeholder={placeholder} />
              <RadixSelect.Icon>
                <ChevronDown aria-hidden size={20} strokeWidth={1.5} className="text-secondary" />
              </RadixSelect.Icon>
            </RadixSelect.Trigger>
            <RadixSelect.Portal>
              <RadixSelect.Content
                data-section={section}
                position="popper"
                sideOffset={4}
                className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-border bg-base shadow-md"
              >
                <RadixSelect.Viewport className="p-1">
                  {options.map((option) => (
                    <RadixSelect.Item
                      key={option.value}
                      value={option.value}
                      className="flex min-h-11 cursor-default items-center justify-between gap-2 rounded-sm px-3 text-body text-primary outline-none select-none data-highlighted:bg-raised data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-section-accent data-[state=checked]:font-semibold"
                    >
                      <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                      <RadixSelect.ItemIndicator>
                        <Check aria-hidden size={20} strokeWidth={1.5} className="text-section" />
                      </RadixSelect.ItemIndicator>
                    </RadixSelect.Item>
                  ))}
                </RadixSelect.Viewport>
              </RadixSelect.Content>
            </RadixSelect.Portal>
          </RadixSelect.Root>
        );
      }}
    </FieldFrame>
  );
}
