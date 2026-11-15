import type { ReactElement } from 'react';
import type { ChoreCompletion, Member } from '@hestia/shared';
import { formatCalendarDate } from '../../lib/format.ts';
import { calendarDateOfInstant } from '../../lib/household-date.ts';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { formatRelativeAgo, memberName } from './chore-copy.ts';

export interface CompletionHistoryProps {
  completions: readonly ChoreCompletion[];
  members: readonly Member[];
  /** Household "today" (YYYY-MM-DD). */
  today: string;
  timezone: string;
  onDeleteCompletion: (completionId: string) => void;
  isDeleting?: boolean;
  disabledReason?: string | undefined;
}

/**
 * Completion history (who and when; departed members show "Former member"), where the
 * most-recent completion provides a direct trailing delete button with persistent Undo toast
 * feedback per UI-SPEC (eliminating per-row overflow menus).
 */
export function CompletionHistory({
  completions,
  members,
  today,
  timezone,
  onDeleteCompletion,
  isDeleting = false,
  disabledReason,
}: CompletionHistoryProps): ReactElement {
  const ordered = [...completions].sort(
    (a, b) =>
      b.occurrenceDate.localeCompare(a.occurrenceDate) ||
      b.completedAt.localeCompare(a.completedAt),
  );
  const mostRecentId = ordered[0]?.id;

  return (
    <section aria-labelledby="completion-history-heading" className="flex flex-col gap-2">
      <h2
        id="completion-history-heading"
        className="text-title-md font-semibold text-[var(--md-sys-color-on-surface)]"
      >
        Completion history
      </h2>
      {ordered.length === 0 ? (
        <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          No completions yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]">
          {ordered.map((completion) => (
            <li
              key={completion.id}
              className="flex items-center justify-between gap-2 px-4 py-2.5 text-body-sm text-[var(--md-sys-color-on-surface)]"
            >
              <span className="flex flex-col">
                <span className="font-medium text-[var(--md-sys-color-on-surface)]">
                  {memberName(members, completion.completedBy)}
                  <span className="text-[var(--md-sys-color-on-surface-variant)] font-normal">
                    {' · '}
                    {formatRelativeAgo(
                      calendarDateOfInstant(completion.completedAt, timezone),
                      today,
                    )}
                  </span>
                </span>
                <span className="text-[var(--md-sys-color-on-surface-variant)]">
                  For {formatCalendarDate(completion.occurrenceDate)}
                </span>
              </span>
              {completion.id === mostRecentId && (
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label="Delete completion"
                  disabledReason={disabledReason}
                  isLoading={isDeleting}
                  onClick={() => {
                    onDeleteCompletion(completion.id);
                  }}
                >
                  <Icon name="delete" size={20} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
