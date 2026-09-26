import { LoaderCircle } from 'lucide-react';
import {
  useId,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type Ref,
} from 'react';
import { cn } from '../../lib/cn.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Square 44×44 button for a lone icon; it must carry an `aria-label`. */
  isIconOnly?: boolean;
  /** An async action is in flight: the button is busy and ignores presses. */
  isLoading?: boolean;
  /**
   * Why the control is unavailable ("Needs a connection."). Shown beside the button and set as
   * its accessible description. The button stays focusable (aria-disabled) so the reason is
   * reachable by keyboard and screen reader — Design › Offline rules.
   */
  disabledReason?: string | undefined;
  ref?: Ref<HTMLButtonElement>;
}

// Opacity below 95% lightens the white-on-fill text below 4.5:1 in the light theme for every
// section color (axe caught it on Deals green): the fill blends toward bg-base, which is white
// in light mode, so 90% opacity was measurably failing WCAG AA (Design › Accessibility). Active
// (pressed) blends the same way and needs its own floor above hover's: at 90% it recomputes to
// 4.18:1 (green), 4.22:1 (amber), 4.34:1 (blue), and 4.32:1 (danger) on white — still failing —
// so active goes to 97%, which holds AA with margin (>= 4.69:1 across every section plus danger)
// while staying visually distinct from hover's 95%.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-section text-on-section hover:bg-section/95 active:bg-section/97',
  secondary: 'border border-input bg-base text-primary hover:bg-raised active:bg-section-tint',
  ghost: 'text-section hover:bg-raised active:bg-section-tint',
  destructive: 'bg-danger text-on-danger hover:bg-danger/95 active:bg-danger/97',
};

export const BUTTON_BASE =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md text-body font-semibold transition-colors duration-150 ease-out select-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50';

export function Button({
  variant = 'primary',
  isIconOnly = false,
  isLoading = false,
  disabledReason,
  disabled,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps): ReactElement {
  const reasonId = useId();
  const isUnavailable = Boolean(disabledReason) || isLoading;

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (isUnavailable) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const button = (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-disabled={isUnavailable || undefined}
      aria-busy={isLoading || undefined}
      aria-describedby={disabledReason ? reasonId : rest['aria-describedby']}
      onClick={handleClick}
      className={cn(BUTTON_BASE, VARIANT_CLASSES[variant], isIconOnly ? 'p-0' : 'px-4', className)}
    >
      {isLoading && (
        <LoaderCircle aria-hidden size={20} strokeWidth={1.5} className="animate-spin" />
      )}
      {children}
    </button>
  );

  if (!disabledReason) return button;
  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      {button}
      <span id={reasonId} className="text-body-sm text-secondary">
        {disabledReason}
      </span>
    </span>
  );
}
