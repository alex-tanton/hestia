import {
  useCallback,
  useId,
  type HTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from 'react';
import { cn } from '../../lib/cn.ts';
import { MdFilledButton, MdIconButton, MdOutlinedButton, MdTextButton } from '../md/MdButton.tsx';
import { MdCircularProgress } from '../md/MdProgress.tsx';
import { omitUndefined } from '../md/props.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'onClick' | 'onInput' | 'onChange' | 'className' | 'children'
> {
  variant?: ButtonVariant | undefined;
  /** Square 44×44 button for a lone icon; it must carry an `aria-label`. */
  isIconOnly?: boolean | undefined;
  /** An async action is in flight: the button is busy and ignores presses. */
  isLoading?: boolean | undefined;
  /**
   * Why the control is unavailable ("Needs a connection."). Shown beside the button and set as
   * its accessible description. The button stays focusable (aria-disabled) so the reason is
   * reachable by keyboard and screen reader.
   */
  disabledReason?: string | undefined;
  disabled?: boolean | undefined;
  type?: 'button' | 'submit' | 'reset' | undefined;
  autoFocus?: boolean | undefined;
  className?: string | undefined;
  children?: ReactNode | undefined;
  onClick?: ((event: MouseEvent<HTMLElement>) => void) | undefined;
  ref?: Ref<HTMLElement> | undefined;
}

export const BUTTON_BASE =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md text-body font-semibold transition-colors duration-150 ease-out select-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50';

const DESTRUCTIVE_CLASSES =
  '[--md-filled-button-container-color:var(--md-sys-color-error)] [--md-filled-button-label-text-color:var(--md-sys-color-on-error)]';

const DESTRUCTIVE_ICON_CLASSES = '[--md-icon-button-icon-color:var(--md-sys-color-error)]';

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
  ref,
  ...rest
}: ButtonProps): ReactElement {
  const reasonId = useId();
  const isDisabled = Boolean(disabled);
  const isUnavailable = Boolean(disabledReason) || isLoading;

  const forwardRef: RefCallback<HTMLElement> = useCallback(
    (node: HTMLElement | null) => {
      if (typeof ref === 'function') {
        return ref(node);
      }
      if (ref !== undefined && ref !== null) {
        ref.current = node;
      }
      return undefined;
    },
    [ref],
  );

  const handleClick = (event: MouseEvent<HTMLElement>): void => {
    if (isDisabled || isUnavailable) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  const content = (
    <>
      {isLoading && (
        <MdCircularProgress
          indeterminate
          aria-hidden="true"
          className="size-5 shrink-0 [--md-circular-progress-active-indicator-color:currentColor] [--md-circular-progress-size:20px]"
        />
      )}
      {children}
    </>
  );

  const sharedProps = omitUndefined({
    ...rest,
    type,
    disabled: isDisabled,
    softDisabled: isUnavailable,
    'aria-disabled': isUnavailable || undefined,
    'aria-busy': isLoading || undefined,
    'aria-describedby': disabledReason ? reasonId : rest['aria-describedby'],
    onClick: handleClick,
  });

  const refProps = ref !== undefined && ref !== null ? { ref: forwardRef } : undefined;

  const buttonClassName = cn(
    'min-h-11 min-w-11 max-w-full',
    isIconOnly && variant === 'destructive' && DESTRUCTIVE_ICON_CLASSES,
    !isIconOnly && variant === 'destructive' && DESTRUCTIVE_CLASSES,
    className,
  );

  let button: ReactElement;
  if (isIconOnly) {
    button = (
      <MdIconButton {...sharedProps} {...refProps} className={buttonClassName}>
        {content}
      </MdIconButton>
    );
  } else if (variant === 'secondary') {
    button = (
      <MdOutlinedButton {...sharedProps} {...refProps} className={buttonClassName}>
        {content}
      </MdOutlinedButton>
    );
  } else if (variant === 'ghost') {
    button = (
      <MdTextButton {...sharedProps} {...refProps} className={buttonClassName}>
        {content}
      </MdTextButton>
    );
  } else {
    button = (
      <MdFilledButton {...sharedProps} {...refProps} className={buttonClassName}>
        {content}
      </MdFilledButton>
    );
  }

  if (!disabledReason) return button;
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1.5">
      {button}
      <span id={reasonId} className="max-w-[70ch] text-body-sm text-secondary">
        {disabledReason}
      </span>
    </span>
  );
}
