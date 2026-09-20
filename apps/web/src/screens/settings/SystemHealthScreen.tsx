import { RotateCw } from 'lucide-react';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router';
import type { DeepHealthResponse } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { useDeepHealth, useProfile } from '../../lib/api/hooks.ts';
import { ApiError } from '../../lib/api/problem.ts';
import { formatDateTime, pluralize } from '../../lib/format.ts';
import { ReadOnlyValue, SettingsSection } from './SettingsSection.tsx';

function freshness(value: string | null): string {
  return value === null ? 'Never' : formatDateTime(value);
}

function HealthBody({ health }: { health: DeepHealthResponse }): ReactElement {
  return (
    <>
      <SettingsSection title="Job freshness">
        <Card className="flex flex-col gap-4">
          <ReadOnlyValue label="Last deal refresh" value={freshness(health.newestDealFetchedAt)} />
          <ReadOnlyValue
            label="Last notification sent"
            value={freshness(health.newestNotificationSentAt)}
          />
          <ReadOnlyValue label="Newest backup" value={freshness(health.newestBackupAt)} />
        </Card>
      </SettingsSection>

      <SettingsSection
        title="Top errors"
        description="The last 24 hours, by how often each was seen."
      >
        <Card>
          {health.recentErrors.length === 0 ? (
            <p className="text-body text-secondary">No errors have been recorded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {health.recentErrors.map((error) => (
                <li key={error.fingerprint} className="flex flex-col gap-1 py-3 first:pt-0">
                  <span className="text-body text-primary">{error.message}</span>
                  <span className="text-body-sm text-secondary">
                    {pluralize(error.count, 'time')} · first {formatDateTime(error.firstSeen)} ·
                    last {formatDateTime(error.lastSeen)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </SettingsSection>

      <SettingsSection
        title="Skip rates"
        description="Deals skipped because their price could not be parsed, since the last refresh."
      >
        <Card>
          {health.merchantSkipRates.length === 0 ? (
            <p className="text-body text-secondary">
              No refresh has run since the service started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {health.merchantSkipRates.map((rate) => (
                <li key={rate.merchantId} className="flex flex-col gap-1 py-3 first:pt-0">
                  <span className="text-body text-primary">{rate.merchantName}</span>
                  <span className="text-body-sm text-secondary tabular-nums">
                    {String(Math.round(rate.skipRate * 100))}% skipped · {String(rate.skipped)} of{' '}
                    {String(rate.fetched)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </SettingsSection>
    </>
  );
}

/**
 * Design › Screens › 4, "About": the server owner's System health. Everything on it is plain
 * text with an as-of time, and the only interactive control is the refresh.
 */
export function SystemHealthScreen(): ReactElement {
  const profile = useProfile();
  const isServerOwner = profile.data?.isServerOwner ?? false;
  const health = useDeepHealth(isServerOwner);
  useScreenChrome({ title: 'System health', backTo: '/settings', backLabel: 'Settings' });

  if (profile.isPending) return <SkeletonRows label="Loading system health" rows={4} />;
  // The endpoint refuses anyone else; the screen should not be reachable by typing its path.
  if (!isServerOwner) return <Navigate to="/settings" replace />;

  const asOf = health.dataUpdatedAt === 0 ? undefined : new Date(health.dataUpdatedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm text-secondary">
          {asOf === undefined ? 'Loading…' : `As of ${formatDateTime(asOf.toISOString())}`}
        </p>
        <Button
          variant="secondary"
          isLoading={health.isFetching}
          onClick={() => {
            void health.refetch();
          }}
        >
          <RotateCw aria-hidden size={20} strokeWidth={1.5} />
          Refresh
        </Button>
      </div>

      {health.isPending && <SkeletonRows label="Loading system health" rows={4} />}
      {health.isError &&
        (health.error instanceof ApiError && health.error.isOffline ? (
          <OfflineState message="System health needs a connection." />
        ) : (
          <ErrorState
            message="Couldn't load system health. Try again."
            onRetry={() => {
              void health.refetch();
            }}
          />
        ))}
      {health.data && <HealthBody health={health.data} />}
    </div>
  );
}
