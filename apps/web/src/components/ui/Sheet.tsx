import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { useSection } from '../../lib/section-context.tsx';
import { Button } from './Button.tsx';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The element that opens the sheet; focus returns to it on close. */
  trigger?: ReactNode;
  children: ReactNode;
}

/**
 * Bottom sheet for quick-add flows and the household switcher. Radix Dialog traps focus and
 * returns it to the trigger on close.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: SheetProps): ReactElement {
  const section = useSection();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          data-section={section}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-160 flex-col rounded-t-lg border border-border bg-base pb-[env(safe-area-inset-bottom)] shadow-md data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in"
        >
          <div className="flex items-center justify-between gap-2 py-2 pr-2 pl-4">
            <Dialog.Title className="text-h2 text-primary">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" isIconOnly aria-label="Close" className="text-secondary">
                <X aria-hidden size={20} strokeWidth={1.5} />
              </Button>
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="px-4 pb-2 text-body-sm text-secondary">
              {description}
            </Dialog.Description>
          )}
          <div className="overflow-y-auto pb-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
