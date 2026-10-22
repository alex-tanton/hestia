import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export interface ListRowProps {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Makes the row one button; omit for a static row. */
  onSelect?: () => void;
  /** Marks the row as the current choice (e.g. the active household). */
  isCurrent?: boolean;
  isDisabled?: boolean;
  className?: string;
}

/** A generic row: 12px vertical padding and at least a 44px target. */
export function ListRow({
  title,
  description,
  leading,
  trailing,
  onSelect,
  isCurrent = false,
  isDisabled = false,
  className,
}: ListRowProps): ReactElement {
  const content = (
    <>
      {leading && <span className="flex shrink-0 items-center text-section-accent">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-primary">{title}</span>
        {description && <span className="text-body-sm text-secondary">{description}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
    </>
  );
  const rowClasses = cn('flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left', className);

  if (!onSelect) return <div className={rowClasses}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      aria-current={isCurrent || undefined}
      className={cn(
        rowClasses,
        'transition-colors duration-150 ease-out hover:bg-raised active:bg-section-tint disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {content}
    </button>
  );
}
