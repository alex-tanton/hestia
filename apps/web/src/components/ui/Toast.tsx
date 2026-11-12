import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn.ts';
import { Icon, type IconName } from './Icon.tsx';

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

export interface SnackbarProps {
  variant: ToastVariant;
  message: string;
  action?: ToastAction | undefined;
  onDismiss: () => void;
}

const VARIANT_ICON: Record<ToastVariant, IconName> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

/**
 * Non-action success/info snackbars dismiss after 4s; action-bearing (e.g. Undo)
 * and error snackbars persist until acted upon or dismissed (D-11 / FND-04).
 */
export function toastDuration(toast: ToastInput): number {
  if (toast.variant === 'error' || toast.action !== undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return 4000;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * MD3 single-line/multi-line Snackbar with inverse surface / error container colors,
 * `max-w-[70ch]` line-length cap, explicit Dismiss control, and live-region role.
 */
export function Snackbar({ variant, message, action, onDismiss }: SnackbarProps): ReactElement {
  const isError = variant === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-atomic="true"
      className={cn(
        'pointer-events-auto mx-auto flex w-full max-w-[70ch] items-center gap-3 rounded-[var(--md-sys-shape-corner-extra-small)] py-1.5 pr-1.5 pl-4 shadow-[var(--md-sys-elevation-level3)]',
        isError
          ? 'bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]'
          : 'bg-[var(--md-sys-color-inverse-surface)] text-[var(--md-sys-color-inverse-on-surface)]',
      )}
    >
      <Icon name={VARIANT_ICON[variant]} size={20} className="shrink-0" />
      <p className="m-0 min-w-0 flex-1 text-body-sm break-words">{message}</p>
      {action !== undefined && (
        <button
          type="button"
          onClick={() => {
            action.onAction();
            onDismiss();
          }}
          className={cn(
            'min-h-11 shrink-0 rounded-md px-3 text-body-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
            isError
              ? 'text-[var(--md-sys-color-on-error-container)] hover:bg-[var(--md-sys-color-on-error-container)]/10 focus-visible:outline-[var(--md-sys-color-on-error-container)]'
              : 'text-[var(--md-sys-color-inverse-primary)] hover:bg-[var(--md-sys-color-inverse-on-surface)]/10 focus-visible:outline-[var(--md-sys-color-inverse-primary)]',
          )}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
          isError
            ? 'text-[var(--md-sys-color-on-error-container)] hover:bg-[var(--md-sys-color-on-error-container)]/10 focus-visible:outline-[var(--md-sys-color-on-error-container)]'
            : 'text-[var(--md-sys-color-inverse-on-surface)] hover:bg-[var(--md-sys-color-inverse-on-surface)]/10 focus-visible:outline-[var(--md-sys-color-inverse-on-surface)]',
        )}
      >
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

/**
 * Single-slot FIFO snackbar queue provider. Renders only `queue[0]` at a time so
 * stacked feedback never competes visually or covers screen actions.
 */
export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [queue, setQueue] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current;
    nextId.current += 1;
    setQueue((current) => [...current, { ...toast, id }]);
  }, []);

  const active = queue[0] ?? null;

  const dismissActive = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  useEffect(() => {
    if (active === null) {
      return;
    }
    const duration = toastDuration(active);
    if (!Number.isFinite(duration)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setQueue((current) => (current[0]?.id === active.id ? current.slice(1) : current));
    }, duration);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active]);

  return (
    <ToastContext value={show}>
      {children}
      {/* Bottom-anchored above the tab bar; the sidebar layout has no bottom bar to clear. */}
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 z-50 px-4',
          'bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4',
        )}
      >
        {active !== null && (
          <Snackbar
            key={active.id}
            variant={active.variant}
            message={active.message}
            action={active.action}
            onDismiss={dismissActive}
          />
        )}
      </div>
    </ToastContext>
  );
}

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
