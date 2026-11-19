import type { ReactElement } from 'react';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { Icon } from '../ui/Icon.tsx';

export const OFFLINE_MESSAGE = 'Offline. Changes will sync when you reconnect.';

/**
 * The persistent Info strip below the top bar while offline, with the offline copy. The
 * status region is always mounted so the change is announced without stealing focus.
 */
export function OfflineBanner(): ReactElement {
  const isOnline = useOnlineStatus();
  return (
    <div role="status">
      {!isOnline && (
        <p className="flex items-center justify-center gap-2 bg-info px-4 py-2 text-body-sm font-semibold text-on-info">
          <Icon name="wifi_off" size={20} className="shrink-0" />
          {OFFLINE_MESSAGE}
        </p>
      )}
    </div>
  );
}
