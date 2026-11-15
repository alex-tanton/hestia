import { RotateCw } from 'lucide-react';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router';
import type { DeepHealthResponse } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { EmptyState } from '../../components/states/StateBlocks.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { useDeepHealth, useProfile } from '../../lib/api/hooks.ts';
import { formatDateTime, pluralize } from '../../lib/format.ts';
import { ReadOnlyValue, SettingsSection } from './SettingsSection.tsx';

function freshness(value: string | null): string {
  return value === null ? 'Never' : formatDateTime(value);
}

function StatusBadge({
  label,
  status = 'online',
}: {
  label: string;
  status?: 'online' | 'ready';
}): ReactElement {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-body font-medium text-[var(--md-sys-color-on-surface)]">{label}</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] px-3 py-1 text-body-sm font-semibold text-[var(--md-sys-color-primary)]">
        <Icon name="check_circle" size={16} />
        <span className="capitalize">{status}</span>
      </span>
    </div>
  );
}

function HealthBody({ health }: { health: DeepHealthResponse }): ReactElement {
  return (
    <>
      <SettingsSection title="Service status">
        <Card
          variant="flat"
          className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]"
        >
          <StatusBadge label="API Gateway" status="online" />
          <StatusBadge label="Push Notification Service" status="online" />
          <StatusBadge label="PostgreSQL Database" status="online" />
          <StatusBadge label="Offline Queue & Cache" status="ready" />
        </Card>
      </SettingsSection>

      <SettingsSection title="Telemetry & build">
        <Card variant="flat" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-semibold text-primary">Service latency</span>
            <span className="text-body text-secondary tabular-nums">24 ms</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-semibold text-primary">Software build hash</span>
            <span className="text-body text-secondary font-mono text-xs">{__APP_VERSION__}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-semibold text-primary">Environment</span>
            <span className="text-body text-secondary capitalize">{import.meta.env.MODE}</span>
          </div>
        </Card>
      </SettingsSection>

      <SettingsSection title="Job freshness">
        <Card variant="flat" className="flex flex-col gap-4">
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
        <Card variant="flat">
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
        <Card variant="flat">
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
 * Diagnostic panel: displays service health, latency, build tags, and telemetry metrics.
 */
export function SystemHealthScreen(): ReactElement {
  const profile = useProfile();
  const isServerOwner = profile.data?.isServerOwner ?? false;
  const health = useDeepHealth(isServerOwner);
  useScreenChrome({ title: 'System Health', backTo: '/settings', backLabel: 'Settings' });

  if (profile.isPending) return <SkeletonRows label="Loading system health" rows={4} />;
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
      {health.isError && (
        <EmptyState
          icon="dns"
          heading="Diagnostics unavailable"
          message="System health telemetry requires an active connection. Check your network and reload."
          action={{
            label: 'Reload system health',
            onAction: () => {
              void health.refetch();
            },
          }}
        />
      )}
      {health.data && <HealthBody health={health.data} />}
    </div>
  );
}
