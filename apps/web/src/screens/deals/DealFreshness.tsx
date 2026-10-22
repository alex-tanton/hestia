import { Clock, RefreshCw, RotateCw } from 'lucide-react';
import type { ReactElement } from 'react';
import type { Freshness } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
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
 * Stale results keep their "as of" date rather than being
 * replaced by an error, because stale data beats empty data, and a postal code whose background
 * refresh is still running says so while its cache stays on screen.
 *
 * Each line pairs an icon with its text, so none of these states is read from color alone.
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
    <div className="flex flex-col gap-2 rounded-md border border-border bg-raised p-3">
      {stale && (
        <p className="flex items-start gap-2 text-body-sm text-secondary">
          <Clock aria-hidden size={20} strokeWidth={1.5} className="mt-px shrink-0 text-warning" />
          <span className="max-w-[70ch]">{staleMessage(asOf)}</span>
        </p>
      )}
      {refreshing && (
        <p role="status" className="flex items-start gap-2 text-body-sm text-secondary">
          <RefreshCw
            aria-hidden
            size={20}
            strokeWidth={1.5}
            className="mt-px shrink-0 text-info-accent"
          />
          <span className="max-w-[70ch]">
            {REFRESHING_MESSAGE}
            {!stale && asOf !== null && ` ${asOfLabel(asOf)}.`}
            {hasGivenUp && ' This is taking a while.'}
          </span>
        </p>
      )}
      {(stale || hasGivenUp) && (
        <Button variant="ghost" className="self-start" onClick={onRetry}>
          <RotateCw aria-hidden size={20} strokeWidth={1.5} />
          Try again
        </Button>
      )}
    </div>
  );
}
