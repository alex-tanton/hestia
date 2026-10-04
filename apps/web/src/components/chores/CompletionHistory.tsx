import { Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { ChoreCompletion, Member } from '@hearth/shared';
import { formatCalendarDate } from '../../lib/format.ts';
import { calendarDateOfInstant } from '../../lib/household-date.ts';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { OverflowMenu } from '../ui/OverflowMenu.tsx';
import { DELETE_COMPLETION_CONFIRMATION, formatRelativeAgo, memberName } from './chore-copy.ts';

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
 * Design › "17. Chores" › Chore detail: "completion history (who + when; departed members show
 * 'Former member')" and "the most-recent completion has a delete action with confirmation." Newest
 * first, since that is the one entry that can still be undone (PRD › "Recurrence is anchored and
 * derived on read": only the most recent completion can be deleted).
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
  const [pendingCompletion, setPendingCompletion] = useState<ChoreCompletion>();
  const ordered = [...completions].sort(
    (a, b) =>
      b.occurrenceDate.localeCompare(a.occurrenceDate) ||
      b.completedAt.localeCompare(a.completedAt),
  );
  const mostRecentId = ordered[0]?.id;

  return (
    <section aria-labelledby="completion-history-heading" className="flex flex-col gap-2">
      <h2 id="completion-history-heading" className="text-h2 text-primary">
        Completion history
      </h2>
      {ordered.length === 0 ? (
        <p className="text-body-sm text-secondary">No completions yet.</p>
      ) : (
        <ul className="flex flex-col rounded-md border border-border bg-base">
          {ordered.map((completion) => (
            <li
              key={completion.id}
              className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-body-sm last:border-b-0"
            >
              <span className="flex flex-col">
                <span className="text-primary">
                  {memberName(members, completion.completedBy)}
                  <span className="text-secondary">
                    {' · '}
                    {formatRelativeAgo(
                      calendarDateOfInstant(completion.completedAt, timezone),
                      today,
                    )}
                  </span>
                </span>
                <span className="text-secondary">
                  For {formatCalendarDate(completion.occurrenceDate)}
                </span>
              </span>
              {completion.id === mostRecentId && (
                <OverflowMenu
                  label="More actions for this completion"
                  items={[
                    {
                      label: 'Delete',
                      icon: <Trash2 aria-hidden size={18} strokeWidth={1.5} />,
                      isDestructive: true,
                      disabledReason,
                      onSelect: () => {
                        setPendingCompletion(completion);
                      },
                    },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingCompletion !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingCompletion(undefined);
        }}
        title="Delete this completion?"
        description={DELETE_COMPLETION_CONFIRMATION}
        confirmLabel="Delete completion"
        isConfirming={isDeleting}
        onConfirm={() => {
          if (pendingCompletion !== undefined) onDeleteCompletion(pendingCompletion.id);
          setPendingCompletion(undefined);
        }}
      />
    </section>
  );
}
