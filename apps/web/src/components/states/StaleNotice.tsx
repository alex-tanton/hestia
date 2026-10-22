import { RotateCw } from 'lucide-react';
import type { ReactElement } from 'react';
import { formatDateTime } from '../../lib/format.ts';
import { Button } from '../ui/Button.tsx';

/**
 * Stale-over-empty: where a cache exists and a fetch fails, the cached content stays on screen with
 * an "as of" label rather than being replaced by nothing.
 */
export function StaleNotice({
  updatedAt,
  onRetry,
}: {
  /** When the shown data last synced, as epoch milliseconds. */
  updatedAt: number;
  onRetry: () => void;
}): ReactElement {
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-md bg-raised px-3 py-2 text-body-sm text-secondary">
      <span className="max-w-[70ch]">
        {`Couldn't refresh. Showing what synced as of ${formatDateTime(new Date(updatedAt).toISOString())}.`}
      </span>
      <Button variant="ghost" className="px-2" onClick={onRetry}>
        <RotateCw aria-hidden size={20} strokeWidth={1.5} />
        Try again
      </Button>
    </p>
  );
}
