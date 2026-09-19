import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { Toast as RadixToast } from 'radix-ui';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn.ts';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  /** e.g. Undo. */
  action?: ToastAction;
}

interface ToastEntry extends ToastInput {
  id: number;
}

/**
 * Design › Primitives › Toast: success and info dismiss after 4s, a toast with an action (Undo)
 * stays 5s, and errors stay until dismissed.
 */
export function toastDuration(toast: ToastInput): number {
  if (toast.variant === 'error') return Number.POSITIVE_INFINITY;
  return toast.action ? 5000 : 4000;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const ICONS = {
  success: <CircleCheck aria-hidden size={20} strokeWidth={1.5} className="text-success-accent" />,
  error: <CircleAlert aria-hidden size={20} strokeWidth={1.5} className="text-danger-accent" />,
  info: <Info aria-hidden size={20} strokeWidth={1.5} className="text-info-accent" />,
} satisfies Record<ToastVariant, ReactElement>;

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { ...toast, id }]);
  }, []);

  const remove = (id: number): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext value={show}>
      <RadixToast.Provider swipeDirection="down" label="Notifications">
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            duration={toastDuration(toast)}
            // Errors must be heard even when they arrive mid-task; the rest are polite.
            type={toast.variant === 'error' ? 'foreground' : 'background'}
            onOpenChange={(isOpen) => {
              if (!isOpen) remove(toast.id);
            }}
            className="flex items-center gap-3 rounded-md border border-border bg-base py-2 pr-2 pl-4 shadow-md data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
          >
            {ICONS[toast.variant]}
            <RadixToast.Description className="min-w-0 flex-1 text-body-sm text-primary">
              {toast.message}
            </RadixToast.Description>
            {toast.action && (
              <RadixToast.Action
                altText={toast.action.label}
                onClick={toast.action.onAction}
                className="min-h-11 rounded-md px-3 text-body-sm font-semibold text-section hover:bg-raised active:bg-section-tint"
              >
                {toast.action.label}
              </RadixToast.Action>
            )}
            <RadixToast.Close
              aria-label="Dismiss"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-raised active:bg-section-tint"
            >
              <X aria-hidden size={20} strokeWidth={1.5} />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        {/* Bottom-anchored above the tab bar; the sidebar layout has no bottom bar to clear. */}
        <RadixToast.Viewport
          className={cn(
            'fixed inset-x-0 z-50 mx-auto flex w-full max-w-160 flex-col gap-2 px-4',
            'bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4',
          )}
        />
      </RadixToast.Provider>
    </ToastContext>
  );
}

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
