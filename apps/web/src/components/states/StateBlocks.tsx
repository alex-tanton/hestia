import type { ComponentType, ReactElement } from 'react';
import { Button } from '../ui/Button.tsx';
import { Icon, type IconName } from '../ui/Icon.tsx';

interface StateAction {
  label: string;
  onAction: () => void;
}

export type EmptyStateIcon = IconName | ComponentType<{ className?: string; size?: number }>;

export interface EmptyStateProps {
  icon: EmptyStateIcon;
  heading?: string;
  /** What this holds + the action. */
  message: string;
  action?: StateAction;
  layout?: 'card' | 'page';
}

function RenderEmptyIcon({ icon, size }: { icon: EmptyStateIcon; size: number }): ReactElement {
  if (typeof icon === 'string') {
    return <Icon name={icon} size={size} />;
  }
  const CustomIcon = icon;
  return <CustomIcon size={size} className="shrink-0" />;
}

/**
 * Context-adaptive empty state:
 * - 'card': compact column with 32dp icon, text-body-sm copy, and ghost button action.
 * - 'page': centered layout with 48dp icon in a 64px circular surface-container-high pill,
 *   optional text-title-lg heading, text-body-md message, and Button variant="primary".
 */
export function EmptyState({
  icon,
  heading,
  message,
  action,
  layout = 'page',
}: EmptyStateProps): ReactElement {
  if (layout === 'card') {
    return (
      <div className="flex flex-col items-center gap-2 p-3 text-center">
        <div className="text-[var(--md-sys-color-secondary)]">
          <RenderEmptyIcon icon={icon} size={32} />
        </div>
        <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">{message}</p>
        {action && (
          <Button variant="ghost" onClick={action.onAction}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center max-w-[480px] mx-auto">
      <div className="flex size-16 items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)]">
        <RenderEmptyIcon icon={icon} size={48} />
      </div>
      {heading && (
        <h2 className="text-title-lg font-semibold text-[var(--md-sys-color-on-surface)]">
          {heading}
        </h2>
      )}
      <p className="max-w-[70ch] text-body-md text-[var(--md-sys-color-on-surface-variant)]">
        {message}
      </p>
      {action && (
        <Button variant="primary" onClick={action.onAction}>
          {action.label}
        </Button>
      )}
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
  layout?: 'card' | 'page';
}

/**
 * Context-adaptive error state:
 * - 'card': compact flex column with 24dp error icon, text-body-sm message, and secondary retry button.
 * - 'page': standard regional error display with retry and optional alternative action button.
 */
export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Try again',
  alternative,
  layout = 'page',
}: ErrorStateProps): ReactElement {
  if (layout === 'card') {
    return (
      <div className="flex flex-col items-start gap-2 p-2">
        <div className="flex items-start gap-2 text-body-sm text-[var(--md-sys-color-error)]">
          <Icon
            name="error"
            size={24}
            className="mt-0.5 shrink-0 text-[var(--md-sys-color-error)]"
          />
          <span className="max-w-[70ch]">{message}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              <Icon name="refresh" size={18} />
              <span>{retryLabel}</span>
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

  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="flex items-start gap-2 text-body-md text-[var(--md-sys-color-on-surface)]">
        <Icon name="error" size={24} className="mt-0.5 shrink-0 text-[var(--md-sys-color-error)]" />
        <span className="max-w-[70ch]">{message}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            <Icon name="refresh" size={18} />
            <span>{retryLabel}</span>
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
  layout?: 'card' | 'page';
}

/** Dedicated offline empty state with responsive card and page sizing. */
export function OfflineState({ message, layout = 'page' }: OfflineStateProps): ReactElement {
  if (layout === 'card') {
    return (
      <div className="flex flex-col items-center gap-2 p-3 text-center">
        <Icon name="wifi_off" size={32} className="text-[var(--md-sys-color-secondary)]" />
        <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center max-w-[480px] mx-auto">
      <div className="flex size-16 items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-secondary)]">
        <Icon name="wifi_off" size={48} />
      </div>
      <p className="max-w-[70ch] text-body-md text-[var(--md-sys-color-on-surface-variant)]">
        {message}
      </p>
    </div>
  );
}
