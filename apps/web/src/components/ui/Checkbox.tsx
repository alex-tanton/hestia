import { Check } from 'lucide-react';
import type { InputHTMLAttributes, ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  /** In-list rows make the whole row the tap target (Branding › Tap targets). */
  variant?: 'default' | 'in-list';
  /** Extra row content beside the label, such as price or quantity. */
  detail?: ReactNode;
}

/**
 * A real checkbox input with its row as the label, so assistive tech announces it as a
 * checkbox rather than a clickable div (Design › Accessibility). Radix's Checkbox is a button,
 * which is why this one is native.
 */
export function Checkbox({
  label,
  variant = 'default',
  detail,
  className,
  disabled,
  ...inputProps
}: CheckboxProps): ReactElement {
  const isInList = variant === 'in-list';
  return (
    <label
      className={cn(
        'group flex min-h-11 items-center gap-3 text-body text-primary',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        isInList && 'w-full px-4 py-3 hover:bg-raised active:bg-section-tint',
        className,
      )}
    >
      <span className="relative inline-flex size-6 shrink-0 items-center justify-center">
        <input
          {...inputProps}
          type="checkbox"
          disabled={disabled}
          className="peer size-6 appearance-none rounded-sm border-2 border-input bg-base transition-colors duration-150 ease-out checked:border-section checked:bg-section group-hover:border-primary checked:group-hover:border-section disabled:cursor-not-allowed"
        />
        <Check
          aria-hidden
          size={16}
          strokeWidth={3}
          className="pointer-events-none absolute text-on-section opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {detail}
    </label>
  );
}
