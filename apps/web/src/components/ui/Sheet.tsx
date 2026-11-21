import {
  cloneElement,
  isValidElement,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ModalBottomSheet } from './ModalBottomSheet.tsx';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  /** The element that opens the sheet; focus returns to it on close. */
  trigger?: ReactNode | undefined;
  children: ReactNode;
}

interface TriggerElementProps {
  onClick?: ((event: MouseEvent<HTMLElement>) => void) | undefined;
  'aria-haspopup'?: 'dialog' | undefined;
  'aria-expanded'?: boolean | undefined;
}

/**
 * Bottom sheet for quick-add flows and the household switcher. Delegates to native-`<dialog>`
 * `ModalBottomSheet` while preserving `SheetProps` and restoring trigger focus on close.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: SheetProps): ReactElement {
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  let renderedTrigger: ReactNode = trigger;
  if (isValidElement<TriggerElementProps>(trigger)) {
    const originalOnClick = trigger.props.onClick;
    renderedTrigger = cloneElement(trigger, {
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      onClick: (event: MouseEvent<HTMLElement>) => {
        setTriggerElement(event.currentTarget);
        originalOnClick?.(event);
        if (!event.defaultPrevented) {
          onOpenChange(true);
        }
      },
    });
  }

  return (
    <>
      {renderedTrigger}
      <ModalBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        returnFocusTo={triggerElement}
      >
        {children}
      </ModalBottomSheet>
    </>
  );
}
