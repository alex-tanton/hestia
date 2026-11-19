import type { ReactElement } from 'react';
import { Button } from '../../components/ui/Button.tsx';
import { Icon } from '../../components/ui/Icon.tsx';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

/** Deal results and flyer item lists paginate at 50. */
export function Pagination({
  page,
  pageSize,
  total,
  hasMore,
  onPageChange,
}: PaginationProps): ReactElement | null {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => {
          onPageChange(page - 1);
        }}
      >
        <Icon name="chevron_left" size={20} />
        Previous
      </Button>
      <p aria-live="polite" className="text-body-sm tabular-nums text-secondary">
        Page {page} of {pageCount}
      </p>
      <Button
        variant="secondary"
        disabled={!hasMore}
        onClick={() => {
          onPageChange(page + 1);
        }}
      >
        Next
        <Icon name="chevron_right" size={20} />
      </Button>
    </nav>
  );
}
