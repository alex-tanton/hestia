import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { Household } from '@hearth/shared';
import { ErrorState, OfflineState } from '../states/StateBlocks.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';

/**
 * What a screen shows until the household's own timezone is known. Its dates (today, overdue, a
 * week's start, a new chore's anchor) are household dates, so a screen never dates anything with
 * the device's or the profile's zone instead. Offline with nothing cached, the screen says so; a
 * failed fetch offers retry; otherwise it is loading.
 */
export function householdFallback(
  household: UseQueryResult<Household>,
  loadingLabel: string,
): ReactElement {
  if (household.isPending && household.fetchStatus === 'paused') {
    return (
      <OfflineState message="The household's details sync when you reconnect. What you have already opened stays readable." />
    );
  }
  if (household.isError) {
    return (
      <ErrorState
        message="Couldn't load the household. Try again."
        onRetry={() => {
          void household.refetch();
        }}
      />
    );
  }
  return <SkeletonRows label={loadingLabel} />;
}
