import type { ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';
import { useDelayedVisible } from '../../lib/use-delayed-visible.ts';

/** One placeholder block. Static, not shimmering: Branding rules out decorative animation. */
export function Skeleton({ className }: { className?: string }): ReactElement {
  return <span aria-hidden className={cn('block rounded-sm bg-border', className)} />;
}

export interface SkeletonRowsProps {
  /** What is loading, for screen readers ("Loading bills"). */
  label: string;
  /** Mirror the real layout: three list rows, not a grey box (Design › Loading rules). */
  rows?: number;
  delayMs?: number;
}

/**
 * The loading state for a list region. The status text is present at once for assistive tech;
 * the visual rows wait out the 200ms delay so fast responses do not flash.
 */
export function SkeletonRows({ label, rows = 3, delayMs }: SkeletonRowsProps): ReactElement {
  const isVisible = useDelayedVisible(delayMs);
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {isVisible &&
        Array.from({ length: rows }, (_, index) => (
          <span key={index} data-testid="skeleton-row" className="flex items-center gap-3">
            <Skeleton className="size-5 shrink-0" />
            <Skeleton className={cn('h-4', index % 2 === 0 ? 'w-3/4' : 'w-1/2')} />
          </span>
        ))}
    </div>
  );
}
