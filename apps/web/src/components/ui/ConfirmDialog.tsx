import { AlertDialog } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { useSection } from '../../lib/section-context.tsx';
import { BUTTON_BASE, Button } from './Button.tsx';
import { cn } from '../../lib/cn.ts';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Names the consequence. */
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  /** Extra content, such as the typed-name field for household deletion. */
  children?: ReactNode;
  isConfirmDisabled?: boolean;
  isConfirming?: boolean;
}

/**
 * Dialogs are for destructive confirmation only, so this is an alert dialog: it traps focus, starts
 * on Cancel, and cannot be dismissed by an outside click.
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
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <AlertDialog.Content
          data-section={section}
          className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-base p-6 shadow-md data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        >
          <AlertDialog.Title className="text-h2 text-primary">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-body text-secondary">
            {description}
          </AlertDialog.Description>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel
              className={cn(
                BUTTON_BASE,
                'border border-input bg-base px-4 text-primary hover:bg-raised active:bg-section-tint',
              )}
            >
              {cancelLabel}
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              disabled={isConfirmDisabled}
              isLoading={isConfirming}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
