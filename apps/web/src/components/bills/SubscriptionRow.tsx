import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { Subscription } from '@hestia/shared';
import { formatCents } from '../../lib/format.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { STILL_USING_PROMPT } from './bills-copy.ts';

export interface SubscriptionRowProps {
  subscription: Subscription;
  onStillUsing: () => void;
  onStopTracking: () => void;
  isConfirming: boolean;
  isStopping: boolean;
  offlineReason?: string | undefined;
}

/**
 * One subscription, its monthly cost, and its annualized figure.
 * A row past 60 days unconfirmed gets the inline "Still using this?"
 * prompt; the API decides when, via `needsUsageConfirmation`.
 */
export function SubscriptionRow({
  subscription,
  onStillUsing,
  onStopTracking,
  isConfirming,
  isStopping,
  offlineReason,
}: SubscriptionRowProps): ReactElement {
  return (
    <li className="flex flex-col gap-2 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/bills/${subscription.id}`}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="truncate text-body font-semibold text-[var(--md-sys-color-on-surface)]">
            {subscription.name}
          </span>
          {subscription.visibility === 'personal' && <Badge variant="personal" />}
        </Link>
        <span className="shrink-0 text-right text-body font-semibold tabular-nums text-[var(--md-sys-color-on-surface)]">
          {`${formatCents(subscription.monthlyCents)}/mo`}
        </span>
      </div>
      <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
        {`${formatCents(subscription.annualCents)}/yr`}
      </p>
      {subscription.needsUsageConfirmation && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--md-sys-color-surface-container-high)] px-3 py-2">
          <p className="flex-1 text-body-sm text-[var(--md-sys-color-on-surface)]">
            {STILL_USING_PROMPT}
          </p>
          <Button
            variant="secondary"
            disabledReason={offlineReason}
            isLoading={isConfirming}
            onClick={onStillUsing}
            aria-label={`Still using, ${subscription.name}`}
          >
            Still using
          </Button>
          <Button
            variant="ghost"
            disabledReason={offlineReason}
            isLoading={isStopping}
            onClick={onStopTracking}
            aria-label={`Stop tracking, ${subscription.name}`}
          >
            Stop tracking
          </Button>
        </div>
      )}
    </li>
  );
}
