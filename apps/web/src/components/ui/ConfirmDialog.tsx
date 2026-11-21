import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useSection } from '../../lib/section-context.tsx';
import { MdDialog } from '../md/MdDialog.tsx';
import { Button } from './Button.tsx';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Names the consequence. */
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string | undefined;
  /** Extra content, such as the typed-name field for household deletion. */
  children?: ReactNode | undefined;
  isConfirmDisabled?: boolean | undefined;
  isConfirming?: boolean | undefined;
}

/**
 * Dialogs are for destructive confirmation only, so this is an alert dialog: it traps focus, starts
 * on Cancel, and cannot be dismissed by an outside scrim click.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancel',
  children,
  isConfirmDisabled = false,
  isConfirming = false,
}: ConfirmDialogProps): ReactElement {
  const section = useSection();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLElement>(null);
  const escapePressedRef = useRef(false);

  const focusCancel = (): void => {
    cancelRef.current?.focus();
  };

  useEffect(() => {
    if (!open) {
      escapePressedRef.current = false;
      return;
    }
    focusCancel();
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      escapePressedRef.current = true;
      onOpenChange(false);
    }
  };

  const handleCancel = (event: Event): void => {
    if (!escapePressedRef.current) {
      event.preventDefault();
      return;
    }
    escapePressedRef.current = false;
    onOpenChange(false);
  };

  const handleOpened = (): void => {
    focusCancel();
  };

  const handleClosed = (): void => {
    escapePressedRef.current = false;
    onOpenChange(false);
  };

  return (
    <MdDialog
      type="alert"
      quick
      open={open}
      data-section={section}
      aria-describedby={descriptionId}
      onKeyDown={handleKeyDown}
      onCancel={handleCancel}
      onOpened={handleOpened}
      onClosed={handleClosed}
    >
      <span slot="headline" className="break-words">
        {title}
      </span>
      <div slot="content" className="flex flex-col gap-4">
        <p
          id={descriptionId}
          className="m-0 break-words text-[0.9375rem] leading-6 text-[var(--md-sys-color-on-surface-variant)]"
        >
          {description}
        </p>
        {children}
      </div>
      <div slot="actions" className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          ref={cancelRef}
          variant="secondary"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- Alert dialog intentionally starts keyboard focus on non-destructive Cancel
          autoFocus
          onClick={() => {
            onOpenChange(false);
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="destructive"
          disabled={isConfirmDisabled}
          isLoading={isConfirming}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </MdDialog>
  );
}
