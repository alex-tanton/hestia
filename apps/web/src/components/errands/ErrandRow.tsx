import { useId, type ReactElement } from 'react';
import type { Errand, Member } from '@hearth/shared';
import { calendarDateOfInstant } from '../../lib/household-date.ts';
import { formatDueIn, formatOverdue, formatRelativeAgo, memberName } from '../chores/chore-copy.ts';
import { PENDING_CLASSES, PendingMark } from '../lists/PendingMark.tsx';
import { Checkbox } from '../ui/Checkbox.tsx';
import { OverflowMenu, type OverflowMenuItem } from '../ui/OverflowMenu.tsx';

export interface ErrandRowProps {
  errand: Errand;
  members: readonly Member[];
  /** Household "today" (YYYY-MM-DD). */
  today: string;
  timezone: string;
  onToggleDone: (isDone: boolean) => void;
  onSelect: () => void;
  /** A change to this errand is waiting to sync: the row is marked and its checkbox is held. */
  isPending?: boolean;
  /** Marked done offline and not yet synced: shown as done, with no completer until it lands. */
  isQueuedDone?: boolean;
  /** Why done cannot be toggled right now ("Needs a connection."). */
  disabledReason?: string | undefined;
  menuItems: readonly OverflowMenuItem[];
}

/**
 * Design › "18. Errands": a flat row with its due date and assignee; done rows show who completed
 * it and when. The checkbox is a real input, separate from the row's own tap target (opening the
 * same sheet for editing), so toggling done and editing stay two distinct, announced controls.
 */
export function ErrandRow({
  errand,
  members,
  today,
  timezone,
  onToggleDone,
  onSelect,
  isPending = false,
  isQueuedDone = false,
  disabledReason,
  menuItems,
}: ErrandRowProps): ReactElement {
  const reasonId = useId();
  const isDone = errand.status === 'done' || isQueuedDone;
  const isOverdue = !isDone && errand.dueDate !== null && errand.dueDate < today;
  const dueLabel =
    errand.dueDate === null
      ? undefined
      : isOverdue
        ? formatOverdue(errand.dueDate, today)
        : `Due ${formatDueIn(errand.dueDate, today)}`;
  const assigneeLabel =
    errand.assignedTo === null ? undefined : memberName(members, errand.assignedTo);
  const completedLabel =
    errand.status === 'done' && !isQueuedDone
      ? `Completed by ${memberName(members, errand.completedBy)} · ${formatRelativeAgo(
          calendarDateOfInstant(errand.completedAt ?? errand.createdAt, timezone),
          today,
        )}`
      : undefined;

  return (
    <li
      className={`flex items-center gap-2 border-b border-border px-4 py-2.5 last:border-b-0${
        isPending ? ` ${PENDING_CLASSES}` : ''
      }`}
    >
      <Checkbox
        aria-label={`Mark ${errand.name} as ${isDone ? 'open' : 'done'}`}
        aria-describedby={disabledReason === undefined ? undefined : reasonId}
        checked={isDone}
        disabled={isPending || disabledReason !== undefined}
        onChange={(event) => {
          onToggleDone(event.target.checked);
        }}
        label=""
        className="w-auto"
      />
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span
          className={
            isDone
              ? 'block break-words text-body text-secondary'
              : 'block break-words text-body text-primary'
          }
        >
          {errand.name}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-secondary">
          {isPending && <PendingMark />}
          {completedLabel !== undefined && <span>{completedLabel}</span>}
          {completedLabel === undefined && dueLabel !== undefined && (
            <span className={isOverdue ? 'text-danger' : undefined}>{dueLabel}</span>
          )}
          {completedLabel === undefined && assigneeLabel !== undefined && (
            <span>{assigneeLabel}</span>
          )}
        </span>
        {disabledReason !== undefined && (
          <span id={reasonId} className="block text-body-sm text-secondary">
            {disabledReason}
          </span>
        )}
      </button>
      <OverflowMenu label={`More actions for ${errand.name}`} items={menuItems} />
    </li>
  );
}
