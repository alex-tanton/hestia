import { RefreshCw, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button.tsx';

export interface UpdateAvailableProps {
  isVisible: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

/**
 * The subtle "Update available" strip. The waiting
 * worker only takes over when the user asks, never mid-shopping-trip.
 */
export function UpdateAvailable({
  isVisible,
  onUpdate,
  onDismiss,
}: UpdateAvailableProps): ReactElement {
  return (
    <div role="status">
      {isVisible && (
        <div className="flex items-center gap-2 border-b border-border bg-raised py-1 pr-1 pl-4">
          <RefreshCw aria-hidden size={20} strokeWidth={1.5} className="shrink-0 text-secondary" />
          <p className="flex-1 text-body-sm text-secondary">Update available.</p>
          <Button variant="ghost" onClick={onUpdate}>
            Reload
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Dismiss update notice"
            onClick={onDismiss}
            className="text-secondary"
          >
            <X aria-hidden size={20} strokeWidth={1.5} />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Wires the strip to vite-plugin-pwa's prompt-style registration. */
export function UpdatePrompt(): ReactElement {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <UpdateAvailable
      isVisible={needRefresh}
      onUpdate={() => {
        void updateServiceWorker(true);
      }}
      onDismiss={() => {
        setNeedRefresh(false);
      }}
    />
  );
}
