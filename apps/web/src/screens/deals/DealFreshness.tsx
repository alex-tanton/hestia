import type { ReactElement } from 'react';
import type { Freshness } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { formatDateTime } from '../../lib/format.ts';

export const REFRESHING_MESSAGE = "Fetching this week's deals…";

/** A recoverable error: what failed + what to do. */
export function staleMessage(asOf: string | null): string {
  if (asOf === null) return "Couldn't reach the store data. Showing what was already here.";
  return `Couldn't reach the store data. Showing deals as of ${formatDateTime(asOf)}.`;
}

export function asOfLabel(asOf: string): string {
  return `As of ${formatDateTime(asOf)}`;
}

export interface DealFreshnessProps extends Freshness {
  /** The subtle retry affordance the stale state offers. */
  onRetry: () => void;
  /** The poll gave up waiting for a dormant postal code's background refresh. */
  hasGivenUp?: boolean;
}

/**
 * DealFreshness renders as a compact tonal surfaceContainerLow banner with
 * schedule and refresh status icons per D-19 and DEAL-06.
 */
export function DealFreshness({
  asOf,
  stale,
  refreshing,
  onRetry,
  hasGivenUp = false,
}: DealFreshnessProps): ReactElement | null {
  if (!stale && !refreshing) return null;

  return (
    <Card
      variant="flat"
      className="flex flex-col gap-2 rounded-lg bg-[var(--md-sys-color-surface-container-low)] p-3 text-label-md text-on-surface-variant"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          {stale && (
            <p className="flex items-start gap-2 text-body-sm text-secondary">
              <Icon name="schedule" size={20} className="mt-px shrink-0 text-warning" />
              <span className="max-w-[70ch]">{staleMessage(asOf)}</span>
            </p>
          )}
          {refreshing && (
            <p role="status" className="flex items-start gap-2 text-body-sm text-secondary">
              <Icon name="refresh" size={20} className="mt-px shrink-0 text-primary" />
              <span className="max-w-[70ch]">
                {REFRESHING_MESSAGE}
                {!stale && asOf !== null && ` ${asOfLabel(asOf)}.`}
                {hasGivenUp && ' This is taking a while.'}
              </span>
            </p>
          )}
        </div>

        {(stale || hasGivenUp) && (
          <Button variant="ghost" className="self-start" onClick={onRetry}>
            <Icon name="refresh" size={20} />
            Try again
          </Button>
        )}
      </div>
    </Card>
  );
}
