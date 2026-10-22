import { Clock } from 'lucide-react';
import type { ReactElement } from 'react';

export const PENDING_ROW_LABEL = 'Waiting to sync';
export const PENDING_SUBTOTAL_LABEL = 'Subtotal updates when your changes sync.';

/**
 * The pending style, carried by a section-coloured edge and the
 * clock rather than by an opacity. Blending a row's text toward its background is what drops a
 * contrast ratio below 4.5:1, and WCAG AA is an acceptance criterion; an edge marker only has to
 * meet the 3:1 UI-boundary threshold, which the section accent does.
 */
export const PENDING_CLASSES = 'border-l-4 border-l-section-accent';

/**
 * The clock beside a queued row, or beside a subtotal a queued write has moved. The icon and its
 * text carry the meaning, never the styling alone.
 */
export function PendingMark({ label = PENDING_ROW_LABEL }: { label?: string }): ReactElement {
  return (
    <span className="inline-flex shrink-0 items-center text-secondary">
      <Clock aria-hidden size={16} strokeWidth={2} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
