import { useId, useRef, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { MdSwitch } from '../md/MdSwitch.tsx';
import { omitUndefined } from '../md/props.ts';

export interface SwitchProps {
  label: ReactNode;
  variant?: 'default' | 'in-list' | undefined;
  detail?: ReactNode | undefined;
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
  name?: string | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-describedby'?: string | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
}

function readSwitchSelected(target: EventTarget | null): boolean | undefined {
  if (target !== null && 'selected' in target && typeof target.selected === 'boolean') {
    return target.selected;
  }
  return undefined;
}

export function Switch({
  label,
  variant = 'default',
  detail,
  checked,
  disabled,
  id,
  name,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  onCheckedChange,
}: SwitchProps): ReactElement {
  const generatedId = useId();
  const labelId = useId();
  const controlId = id ?? generatedId;
  const sawInputRef = useRef(false);
  const effectiveAriaLabel = ariaLabel ?? (typeof label === 'string' ? label : undefined);

  const emitCheckedChange = (target: EventTarget | null): void => {
    const nextSelected = readSwitchSelected(target);
    if (nextSelected !== undefined) {
      onCheckedChange?.(nextSelected);
    }
  };

  const handleInput = (event: Event): void => {
    sawInputRef.current = true;
    queueMicrotask(() => {
      sawInputRef.current = false;
    });
    emitCheckedChange(event.currentTarget);
  };

  const handleChange = (event: Event): void => {
    if (sawInputRef.current) {
      sawInputRef.current = false;
      return;
    }
    emitCheckedChange(event.currentTarget);
  };

  return (
    <label
      htmlFor={controlId}
      className={cn(
        'flex min-h-11 gap-3 text-[0.9375rem] leading-6 text-[var(--md-sys-color-on-surface)]',
        disabled === true ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        variant === 'in-list' ? 'w-full items-start px-4 py-3' : 'items-center',
        className,
      )}
    >
      <span className="flex min-h-6 min-w-0 flex-1 flex-col">
        <span id={labelId}>{label}</span>
        {detail !== undefined && (
          <span className="text-[0.8125rem] leading-[1.125rem] text-[var(--md-sys-color-on-surface-variant)]">
            {detail}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center justify-center">
        <MdSwitch
          id={controlId}
          selected={Boolean(checked)}
          disabled={Boolean(disabled)}
          onInput={handleInput}
          onChange={handleChange}
          {...omitUndefined({
            name,
            tabIndex: disabled === true ? undefined : 0,
            'aria-label': effectiveAriaLabel,
            'aria-labelledby': effectiveAriaLabel ? undefined : labelId,
            'aria-describedby': ariaDescribedBy,
          })}
        />
      </span>
    </label>
  );
}
