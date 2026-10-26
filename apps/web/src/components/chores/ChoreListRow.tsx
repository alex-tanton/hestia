import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { Chore, Member } from '@hestia/shared';
import { calendarDateOfInstant } from '../../lib/household-date.ts';
import { PENDING_CLASSES, PendingMark } from '../lists/PendingMark.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import {
  UNASSIGNED_LABEL,
  describeRecurrence,
  formatDueIn,
  formatLastCompleted,
  formatOverdue,
  memberName,
} from './chore-copy.ts';

export interface ChoreListRowProps {
  chore: Chore;
  members: readonly Member[];
  /** Household "today" (YYYY-MM-DD). */
  today: string;
  /** The household timezone, which dates the last completion. */
  timezone: string;
  onComplete: (chore: Chore) => void;
  /** A completion for this chore is waiting to sync: the row is marked, and Done is held. */
  isPending?: boolean;
  disabledReason?: string | undefined;
}

/**
 * `ChoreRow` carries name, recurrence, next due, current assignee, last-completed relative
 * time, and a complete action. Rotation chores show whose turn it is and who is next. Overdue
 * carries the danger color plus the word "Overdue" (never color alone), with neutral copy.
 *
 * The row's name is a link to the detail, and the complete action is a sibling button, so the
 * two stay separate tab stops rather than a button nested inside a link.
 */
export function ChoreListRow({
  chore,
  members,
  today,
  timezone,
  onComplete,
  isPending = false,
  disabledReason,
}: ChoreListRowProps): ReactElement {
  const dueLabel = chore.isOverdue
    ? formatOverdue(chore.dueDate, today)
    : `Due ${formatDueIn(chore.dueDate, today)}`;

  const assignmentLabel =
    chore.rotationOrder !== null
      ? `${memberName(members, chore.currentTurn)}'s turn${
          chore.nextTurn !== null ? `, ${memberName(members, chore.nextTurn)} next` : ''
        }`
      : chore.assignedTo !== null
        ? memberName(members, chore.assignedTo)
        : UNASSIGNED_LABEL;

  const lastCompletedLabel = formatLastCompleted(
    chore.lastCompletion === null
      ? null
      : calendarDateOfInstant(chore.lastCompletion.completedAt, timezone),
    today,
  );

  return (
    <li
      className={`flex items-center gap-2 border-b border-border pr-3 last:border-b-0${
        isPending ? ` ${PENDING_CLASSES}` : ''
      }`}
    >
      <Link
        to={`/chores/${chore.id}`}
        className="flex min-h-11 min-w-0 flex-1 flex-col gap-1 px-4 py-3 transition-colors duration-150 ease-out hover:bg-raised active:bg-section-tint"
      >
        {/* The name wraps rather than truncating, and the overdue badge drops to its own line
            before it would hide any of the name: nothing is clipped. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-body font-semibold break-words text-primary">
            {chore.name}
          </span>
          {chore.isOverdue && <Badge variant="danger">{dueLabel}</Badge>}
          {isPending && <PendingMark />}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-secondary">
          <span>{describeRecurrence(chore.recurrenceUnit, chore.interval)}</span>
          <span aria-hidden>·</span>
          {!chore.isOverdue && <span>{dueLabel}</span>}
          {!chore.isOverdue && <span aria-hidden>·</span>}
          <span>{assignmentLabel}</span>
        </span>
        <span className="text-body-sm text-secondary">{lastCompletedLabel}</span>
      </Link>
      <Button
        variant="secondary"
        aria-label={`Mark ${chore.name} done`}
        isLoading={isPending}
        disabledReason={disabledReason}
        onClick={() => {
          onComplete(chore);
        }}
      >
        Done
      </Button>
    </li>
  );
}
