import { useId, type ReactElement } from 'react';
import type { Errand, Member } from '@hestia/shared';
import { calendarDateOfInstant } from '../../lib/household-date.ts';
import {
  formatDueIn,
  formatOverdue,
  formatRelativeAgo,
  memberName,
  parseErrandStore,
} from '../chores/chore-copy.ts';
import { PENDING_CLASSES, PendingMark } from '../lists/PendingMark.tsx';
import { Checkbox } from '../ui/Checkbox.tsx';
import { Icon } from '../ui/Icon.tsx';
import { MdIconButton } from '../md/MdButton.tsx';

export interface ErrandRowProps {
  errand: Errand;
  members: readonly Member[];
  /** Household "today" (YYYY-MM-DD). */
  today: string;
  timezone: string;
  onToggleDone: (isDone: boolean) => void;
  onSelect: () => void;
  onDelete: () => void;
  /** A change to this errand is waiting to sync: the row is marked and its checkbox is held. */
  isPending?: boolean;
  /** Marked done offline and not yet synced: shown as done, with no completer until it lands. */
  isQueuedDone?: boolean;
  /** Why done cannot be toggled right now ("Needs a connection."). */
  disabledReason?: string | undefined;
}

/**
 * A flat row with its due date, store badge, and assignee; done rows show who completed
 * it and when. The checkbox is a real input, separate from the row's own tap target (opening the
 * same sheet for editing), and trailing direct delete eliminates 1-item overflow menus.
 */
export function ErrandRow({
  errand,
  members,
  today,
  timezone,
  onToggleDone,
  onSelect,
  onDelete,
  isPending = false,
  isQueuedDone = false,
  disabledReason,
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

  const { title, store } = parseErrandStore(errand.name);

  return (
    <li
      className={`flex items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-2.5 last:border-b-0${
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
        <div className="flex items-center gap-2">
          <span
            className={
              isDone
                ? 'block break-words text-body text-[var(--md-sys-color-on-surface-variant)] line-through'
                : 'block break-words text-body text-[var(--md-sys-color-on-surface)]'
            }
          >
            {title}
          </span>
          {store !== undefined && (
            <span className="inline-flex items-center rounded-full bg-[var(--md-sys-color-surface-container-high)] px-2 py-0.5 text-label-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
              {store}
            </span>
          )}
        </div>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          {isPending && <PendingMark />}
          {completedLabel !== undefined && <span>{completedLabel}</span>}
          {completedLabel === undefined && dueLabel !== undefined && (
            <span className={isOverdue ? 'text-[var(--md-sys-color-error)]' : undefined}>
              {dueLabel}
            </span>
          )}
          {completedLabel === undefined && assigneeLabel !== undefined && (
            <span>{assigneeLabel}</span>
          )}
        </span>
        {disabledReason !== undefined && (
          <span
            id={reasonId}
            className="block text-body-sm text-[var(--md-sys-color-on-surface-variant)]"
          >
            {disabledReason}
          </span>
        )}
      </button>
      <MdIconButton
        aria-label={`Delete errand, ${errand.name}`}
        disabled={disabledReason !== undefined}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Icon name="delete" size={20} />
      </MdIconButton>
    </li>
  );
}
