import { useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { MdCheckbox } from '../md/MdCheckbox.tsx';
import { omitUndefined } from '../md/props.ts';

export interface CheckboxChangeEvent {
  target: { checked: boolean };
  currentTarget: { checked: boolean };
}

export interface CheckboxProps {
  label: ReactNode;
  /** In-list rows make the whole row the tap target. */
  variant?: 'default' | 'in-list' | undefined;
  /** Extra row content beside the label, such as price or quantity. */
  detail?: ReactNode | undefined;
  checked?: boolean | undefined;
  indeterminate?: boolean | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
  name?: string | undefined;
  value?: string | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-describedby'?: string | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  onChange?: ((event: CheckboxChangeEvent) => void) | undefined;
}

function readCheckboxChecked(target: EventTarget | null): boolean | undefined {
  if (target !== null && 'checked' in target && typeof target.checked === 'boolean') {
    return target.checked;
  }
  return undefined;
}

/**
 * Checkbox control wrapping `@material/web`'s `<md-checkbox>` inside a `<label>` with a
 * minimum 44px touch target so row clicks and screen-reader announcements stay reliable.
 */
export function Checkbox({
  label,
  variant = 'default',
  detail,
  checked,
  indeterminate,
  disabled,
  id,
  name,
  value,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  onCheckedChange,
  onChange,
}: CheckboxProps): ReactElement {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const isInList = variant === 'in-list';

  const handleChange = (event: Event): void => {
    const nextChecked = readCheckboxChecked(event.currentTarget);
    if (nextChecked === undefined) {
      return;
    }
    onCheckedChange?.(nextChecked);
    onChange?.({
      target: { checked: nextChecked },
      currentTarget: { checked: nextChecked },
    });
  };

  return (
    <label
      htmlFor={controlId}
      className={cn(
        'flex min-h-11 items-center gap-3 text-[0.9375rem] leading-6 text-[var(--md-sys-color-on-surface)]',
        disabled === true ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        isInList &&
          'w-full px-4 py-3 hover:bg-[var(--md-sys-color-surface-container-low)] active:bg-[var(--md-sys-color-surface-container)]',
        className,
      )}
    >
      <span className="inline-flex size-11 shrink-0 items-center justify-center">
        <MdCheckbox
          id={controlId}
          checked={Boolean(checked)}
          indeterminate={Boolean(indeterminate)}
          disabled={Boolean(disabled)}
          onChange={handleChange}
          {...omitUndefined({
            name,
            value,
            tabIndex: disabled === true ? undefined : 0,
            'aria-label': ariaLabel,
            'aria-describedby': ariaDescribedBy,
          })}
        />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {detail}
    </label>
  );
}
