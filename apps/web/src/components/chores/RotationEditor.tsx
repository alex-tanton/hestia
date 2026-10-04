import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react';
import type { Member } from '@hearth/shared';
import { ROTATION_EMPTY_COPY } from './chore-copy.ts';
import { Button } from '../ui/Button.tsx';
import { Select } from '../ui/Select.tsx';

export interface RotationEditorProps {
  members: readonly Member[];
  /** User ids, in turn order. */
  order: readonly string[];
  onChange: (next: string[]) => void;
  /** Why the order cannot be changed right now ("Needs a connection."). */
  disabledReason?: string | undefined;
}

type Control = 'up' | 'down' | 'remove' | 'heading';

interface FocusRequest {
  /** The row to land on; absent when focus should go to the editor heading. */
  userId?: string;
  control: Control;
}

function moveIndex<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * Design › "17. Chores" › Chore sheet: "A rotation is an ordered list of members, reorderable by
 * drag handles with up and down buttons as the non-gesture alternative." The up/down buttons are
 * the real accessibility requirement (Accessibility › Keyboard: "Full operation without a
 * pointer"); the drag handle is a pointer convenience on top of them, not a replacement.
 *
 * A button that moves a member, or removes one, is often the last focusable thing in its row once
 * the row reaches an edge, so focus follows the member to where it lands (Accessibility › Focus
 * management: focus moves into what replaced the control rather than falling back to the page).
 */
export function RotationEditor({
  members,
  order,
  onChange,
  disabledReason,
}: RotationEditorProps): ReactElement {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const focusRequest = useRef<FocusRequest | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUnavailable = disabledReason !== undefined;

  const nameOf = (userId: string): string =>
    members.find((member) => member.userId === userId)?.displayName ?? 'Former member';
  const available = members.filter((member) => !order.includes(member.userId));

  useEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = null;
    const container = containerRef.current;
    if (request === null || container === null) return;

    // The requested control first, then the row's other move button: the requested one is the
    // disabled one when a member has just reached an edge.
    const { userId } = request;
    const candidates: string[] = [];
    if (userId !== undefined) {
      for (const control of [request.control, 'up', 'down']) {
        candidates.push(`[data-member="${userId}"][data-control="${control}"]`);
      }
    }
    candidates.push('[data-control="heading"]');
    for (const selector of candidates) {
      const target = container.querySelector<HTMLElement>(selector);
      if (target !== null && !(target as HTMLButtonElement).disabled) {
        target.focus();
        return;
      }
    }
  });

  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const userId = order[index];
    focusRequest.current = {
      ...(userId === undefined ? {} : { userId }),
      control: delta < 0 ? 'up' : 'down',
    };
    onChange(moveIndex(order, index, target));
  };

  const remove = (index: number): void => {
    const next = order.filter((_, position) => position !== index);
    const landing = next[Math.min(index, next.length - 1)];
    focusRequest.current = {
      ...(landing === undefined ? {} : { userId: landing }),
      control: landing === undefined ? 'heading' : 'remove',
    };
    onChange(next);
  };

  const add = (userId: string): void => {
    if (userId === '' || order.includes(userId)) return;
    focusRequest.current = { userId, control: 'up' };
    onChange([...order, userId]);
  };

  const handleDrop =
    (dropIndex: number) =>
    (event: DragEvent<HTMLLIElement>): void => {
      event.preventDefault();
      if (dragIndex === null || dragIndex === dropIndex) return;
      onChange(moveIndex(order, dragIndex, dropIndex));
      setDragIndex(null);
    };

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      <h3 tabIndex={-1} data-control="heading" className="text-h3 text-primary focus:outline-none">
        Rotation order
      </h3>
      {disabledReason !== undefined && (
        <p className="text-body-sm text-secondary">{disabledReason}</p>
      )}
      {order.length === 0 && <p className="text-body-sm text-secondary">{ROTATION_EMPTY_COPY}</p>}
      <ol className="flex flex-col gap-2">
        {order.map((userId, index) => (
          // Drag is a pointer convenience on top of the Up/Down/Remove buttons below, which are
          // the real, tested, keyboard-operable mechanism (Accessibility › Keyboard: a
          // single-pointer gesture always needs a non-gesture alternative).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <li
            key={userId}
            data-member={userId}
            draggable={!isUnavailable}
            onDragStart={() => {
              setDragIndex(index);
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={handleDrop(index)}
            onDragEnd={() => {
              setDragIndex(null);
            }}
            className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-base px-2 py-1.5"
          >
            <GripVertical
              aria-hidden
              size={20}
              strokeWidth={1.5}
              className="shrink-0 cursor-grab text-muted"
            />
            <span className="min-w-0 flex-1 truncate text-body text-primary">
              {`${String(index + 1)}. ${nameOf(userId)}`}
            </span>
            <Button
              variant="ghost"
              isIconOnly
              data-member={userId}
              data-control="up"
              aria-label={`Move ${nameOf(userId)} up`}
              disabled={index === 0 || isUnavailable}
              onClick={() => {
                move(index, -1);
              }}
            >
              <ArrowUp aria-hidden size={18} strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              isIconOnly
              data-member={userId}
              data-control="down"
              aria-label={`Move ${nameOf(userId)} down`}
              disabled={index === order.length - 1 || isUnavailable}
              onClick={() => {
                move(index, 1);
              }}
            >
              <ArrowDown aria-hidden size={18} strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              isIconOnly
              data-member={userId}
              data-control="remove"
              aria-label={`Remove ${nameOf(userId)} from rotation`}
              disabled={isUnavailable}
              onClick={() => {
                remove(index);
              }}
            >
              <Trash2 aria-hidden size={18} strokeWidth={1.5} />
            </Button>
          </li>
        ))}
      </ol>
      {available.length > 0 && (
        <Select
          label="Add to rotation"
          placeholder="Choose a member"
          value=""
          disabledReason={disabledReason}
          options={available.map((member) => ({ value: member.userId, label: member.displayName }))}
          onValueChange={add}
        />
      )}
    </div>
  );
}
