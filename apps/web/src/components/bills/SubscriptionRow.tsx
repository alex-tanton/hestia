import type { ReactElement } from 'react';
import type { Subscription } from '@hearth/shared';
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
 * Design › Screens › 16: one subscription, its monthly cost, and its annualized figure (both from
 * the API's own normalized response — the client never computes these, Handoff non-negotiable
 * "money is integer cents"). A row past 60 days unconfirmed gets the inline "Still using this?"
 * prompt; the API decides when, via `needsUsageConfirmation` — this component only renders it.
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
    <li className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-1">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="truncate text-body text-primary">{subscription.name}</span>
          {subscription.visibility === 'personal' && <Badge variant="personal" />}
        </span>
        <span className="shrink-0 text-right text-body text-primary tabular-nums">
          {`${formatCents(subscription.monthlyCents)}/mo`}
        </span>
      </div>
      <p className="text-body-sm text-secondary">{`${formatCents(subscription.annualCents)}/yr`}</p>
      {subscription.needsUsageConfirmation && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-raised px-3 py-2">
          <p className="flex-1 text-body-sm text-primary">{STILL_USING_PROMPT}</p>
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
