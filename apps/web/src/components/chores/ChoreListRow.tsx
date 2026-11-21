import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { Chore, Member } from '@hestia/shared';
import { cn } from '../../lib/cn.ts';
import { calendarDateOfInstant } from '../../lib/household-date.ts';
import { PENDING_CLASSES, PendingMark } from '../lists/PendingMark.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
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
 * `ChoreListRow`: borderless list row carrying member avatar, chore title, recurrence cadence,
 * due status, and a direct quick "Done" tonal icon button (CHOR-01, D-13). Zero 1-item overflow
 * menus exist.
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

  const currentMember =
    chore.rotationOrder !== null
      ? members.find((m) => m.userId === chore.currentTurn)
      : chore.assignedTo !== null
        ? members.find((m) => m.userId === chore.assignedTo)
        : null;

  const currentMemberName =
    chore.rotationOrder !== null
      ? memberName(members, chore.currentTurn)
      : chore.assignedTo !== null
        ? memberName(members, chore.assignedTo)
        : UNASSIGNED_LABEL;

  const assignmentLabel =
    chore.rotationOrder !== null
      ? `${currentMemberName}'s turn${
          chore.nextTurn !== null ? `, ${memberName(members, chore.nextTurn)} next` : ''
        }`
      : currentMemberName;

  const lastCompletedLabel = formatLastCompleted(
    chore.lastCompletion === null
      ? null
      : calendarDateOfInstant(chore.lastCompletion.completedAt, timezone),
    today,
  );

  const initial =
    currentMember?.displayName.trim().charAt(0).toUpperCase() ??
    (chore.rotationOrder !== null || chore.assignedTo !== null ? '?' : null);

  const avatar =
    initial !== null ? (
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--md-sys-color-primary-container)] text-label-lg font-medium text-[var(--md-sys-color-on-primary-container)]"
        aria-hidden="true"
      >
        {initial}
      </div>
    ) : (
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]"
        aria-hidden="true"
      >
        <Icon name="person" size={20} />
      </div>
    );

  return (
    <li
      className={cn(
        'flex min-h-12 items-center justify-between gap-3 border-b border-[var(--md-sys-color-outline-variant)] last:border-b-0 pl-4',
        isPending && PENDING_CLASSES,
      )}
    >
      {avatar}
      <Link
        to={`/chores/${chore.id}`}
        className="flex min-w-0 flex-1 flex-col gap-0.5 py-3 hover:bg-[var(--md-sys-color-surface-container-low)] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-body font-semibold text-[var(--md-sys-color-on-surface)]">
            {chore.name}
          </span>
          {chore.isOverdue && <Badge variant="danger">{dueLabel}</Badge>}
          {isPending && <PendingMark />}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          <span>{describeRecurrence(chore.recurrenceUnit, chore.interval)}</span>
          <span aria-hidden>·</span>
          {!chore.isOverdue && <span>{dueLabel}</span>}
          {!chore.isOverdue && <span aria-hidden>·</span>}
          <span>{assignmentLabel}</span>
        </span>
        <span className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          {lastCompletedLabel}
        </span>
      </Link>
      <div className="flex items-center pr-4">
        <Button
          variant="secondary"
          aria-label={`Mark done, ${chore.name}`}
          isLoading={isPending}
          disabledReason={disabledReason}
          onClick={() => {
            onComplete(chore);
          }}
        >
          Done
        </Button>
      </div>
    </li>
  );
}
