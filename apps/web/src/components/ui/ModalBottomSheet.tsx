import {
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Button } from './Button.tsx';
import { Icon } from './Icon.tsx';

export interface ModalBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  /** Optional fallback element to receive focus on close when activeElement was not the trigger. */
  returnFocusTo?: HTMLElement | null | undefined;
  children: ReactNode;
}

function isPointerOutsideDialog(dialog: HTMLDialogElement, event: PointerEvent): boolean {
  if (event.target !== dialog) {
    return false;
  }
  const rect = dialog.getBoundingClientRect();
  // Zero-sized rects (e.g. unlaid-out jsdom stubs) cannot distinguish backdrop from content.
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  const insideHorizontal = rect.left <= event.clientX && event.clientX <= rect.right;
  const insideVertical = rect.top <= event.clientY && event.clientY <= rect.bottom;
  return !(insideHorizontal && insideVertical);
}

function supportsClosedBy(): boolean {
  return typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;
}

/**
 * Native top-layer `<dialog>.showModal()` bottom sheet with `closedby="any"` light-dismiss,
 * Safari pointerdown/pointerup backdrop fallback, `overscroll-behavior: contain` scroll lock,
 * `returnValue` reset, and trigger focus restoration.
 */
export function ModalBottomSheet({
  open,
  onOpenChange,
  title,
  description,
  returnFocusTo,
  children,
}: ModalBottomSheetProps): ReactElement {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const pointerDownOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      if (!dialog.contains(document.activeElement)) {
        closeButtonRef.current?.focus();
      }
      if (!dialog.contains(document.activeElement)) {
        dialog.focus();
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented && dialog.open) {
        event.preventDefault();
        dialog.close();
      }
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (supportsClosedBy()) {
        pointerDownOutsideRef.current = false;
        return;
      }
      pointerDownOutsideRef.current = isPointerOutsideDialog(dialog, event);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      const startedOutside = pointerDownOutsideRef.current;
      pointerDownOutsideRef.current = false;
      if (supportsClosedBy() || !startedOutside) {
        return;
      }
      if (isPointerOutsideDialog(dialog, event) && dialog.open) {
        dialog.close();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handleNativeClose = (): void => {
    const dialog = dialogRef.current;
    if (dialog !== null) {
      dialog.returnValue = '';
    }
    pointerDownOutsideRef.current = false;

    const captured =
      previousFocusRef.current !== null && previousFocusRef.current !== document.body
        ? previousFocusRef.current
        : null;
    const focusTarget = captured ?? returnFocusTo ?? previousFocusRef.current;
    previousFocusRef.current = null;
    if (focusTarget?.isConnected) {
      focusTarget.focus();
    }

    if (open) {
      onOpenChange(false);
    }
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    if (!event.defaultPrevented && event.currentTarget.open) {
      event.currentTarget.close();
    }
  };

  const hasDescription = description !== undefined && description !== '';

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      closedby="any"
      aria-labelledby={titleId}
      aria-describedby={hasDescription ? descId : undefined}
      onClose={handleNativeClose}
      onCancel={handleCancel}
      className="hestia-sheet"
    >
      <div className="flex items-start justify-between gap-2 py-2 pr-2 pl-4">
        <h2 id={titleId} className="min-w-0 flex-1 py-1.5 text-h2 break-words text-primary">
          {title}
        </h2>
        <Button
          ref={closeButtonRef}
          variant="ghost"
          isIconOnly
          aria-label="Close"
          className="shrink-0 text-secondary"
          onClick={() => {
            dialogRef.current?.close();
          }}
        >
          <Icon name="close" size={20} />
        </Button>
      </div>
      {hasDescription && (
        <p id={descId} className="px-4 pb-2 text-body-sm break-words text-secondary">
          {description}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">{children}</div>
    </dialog>
  );
}
