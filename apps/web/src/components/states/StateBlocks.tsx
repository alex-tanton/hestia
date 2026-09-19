import { CircleAlert, RotateCw, WifiOff, type LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '../ui/Button.tsx';

interface StateAction {
  label: string;
  onAction: () => void;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  /** What this holds + the action (Branding › Copy patterns). */
  message: string;
  /**
   * First run: the primary action ("Add a recipe"). Filtered: "Clear filters" — Design keeps
   * the two states' copy different, so callers pass distinct messages.
   */
  action?: StateAction;
}

/** Empty state: icon in the section color, one line, one primary action (Design › State patterns). */
export function EmptyState({ icon: Icon, message, action }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <Icon aria-hidden size={24} strokeWidth={1.5} className="text-section-accent" />
      <p className="max-w-[70ch] text-body text-secondary">{message}</p>
      {action && <Button onClick={action.onAction}>{action.label}</Button>}
    </div>
  );
}

export interface ErrorStateProps {
  /** What failed + what to do ("Couldn't load bills. Try again."). */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** A route forward when retrying cannot help; every error offers one or the other. */
  alternative?: StateAction;
}

/** Inline, scoped to the failing region, never a full-screen takeover (Design › Error rules). */
export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Try again',
  alternative,
}: ErrorStateProps): ReactElement {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="flex items-start gap-2 text-body text-primary">
        <CircleAlert
          aria-hidden
          size={20}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0 text-danger-accent"
        />
        <span className="max-w-[70ch]">{message}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            <RotateCw aria-hidden size={20} strokeWidth={1.5} />
            {retryLabel}
          </Button>
        )}
        {alternative && (
          <Button variant="ghost" onClick={alternative.onAction}>
            {alternative.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export interface OfflineStateProps {
  /** e.g. "Deal search needs a connection. Your lists still work." */
  message: string;
}

/** Dedicated offline empty state for screens that need live data (Design › Offline rules). */
export function OfflineState({ message }: OfflineStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <WifiOff aria-hidden size={24} strokeWidth={1.5} className="text-info-accent" />
      <p className="max-w-[70ch] text-body text-secondary">{message}</p>
    </div>
  );
}
