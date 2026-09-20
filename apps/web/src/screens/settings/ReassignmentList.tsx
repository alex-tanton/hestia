import type { ReactElement } from 'react';
import type { DeparturePreview, Member } from '@hearth/shared';
import { Card } from '../../components/ui/Card.tsx';
import { Select } from '../../components/ui/Select.tsx';

export interface OwnedGroup {
  title: string;
  items: readonly { id: string; name: string }[];
}

/** Everything a departing member owns, in the order the preview lists it. */
export function ownedGroups(preview: DeparturePreview): OwnedGroup[] {
  return [
    { title: 'Lists they created', items: preview.lists },
    { title: 'Chores assigned to them', items: preview.chores },
    { title: 'Open errands assigned to them', items: preview.errands },
    { title: 'Household bills they own', items: preview.bills },
  ].filter((group) => group.items.length > 0);
}

export function ownedItemIds(preview: DeparturePreview): string[] {
  return ownedGroups(preview).flatMap((group) => group.items.map((item) => item.id));
}

export interface ReassignmentListProps {
  preview: DeparturePreview;
  /** Everyone who stays, and can therefore take something on. */
  remainingMembers: readonly Member[];
  assignments: Readonly<Record<string, string>>;
  onAssign: (itemId: string, userId: string) => void;
  isDisabled: boolean;
  disabledReason?: string | undefined;
}

/**
 * The departure preview's reassignment pickers (Requirements, "Membership lifecycle"). Every
 * list, chore, errand, and bill the member owns must land on someone who stays; the confirm
 * stays disabled until they all have, and the server refuses the call otherwise either way.
 */
export function ReassignmentList({
  preview,
  remainingMembers,
  assignments,
  onAssign,
  isDisabled,
  disabledReason,
}: ReassignmentListProps): ReactElement {
  const options = remainingMembers.map((member) => ({
    value: member.userId,
    label: member.displayName,
  }));

  return (
    <div className="flex flex-col gap-4">
      {ownedGroups(preview).map((group) => (
        <Card key={group.title} className="flex flex-col gap-4">
          <h3 className="text-h3 text-primary">{group.title}</h3>
          {group.items.map((item) => (
            <Select
              key={item.id}
              label={item.name}
              placeholder="Choose a member"
              options={options}
              value={assignments[item.id] ?? ''}
              disabled={isDisabled}
              disabledReason={disabledReason}
              onValueChange={(userId) => {
                onAssign(item.id, userId);
              }}
            />
          ))}
        </Card>
      ))}
    </div>
  );
}

/** Rotations are listed for information only: no picker, just who holds the turn afterwards. */
export function RotationNotes({
  preview,
  members,
}: {
  preview: DeparturePreview;
  members: readonly Member[];
}): ReactElement | null {
  if (preview.rotations.length === 0) return null;
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-h3 text-primary">Rotations</h3>
      <ul className="flex flex-col gap-1">
        {preview.rotations.map((rotation) => {
          const next = members.find((member) => member.userId === rotation.nextTurnUserId);
          return (
            <li key={rotation.choreId} className="text-body-sm text-secondary">
              {rotation.choreName}: will be removed from rotation
              {next ? `; the turn passes to ${next.displayName}` : '; no one is left in rotation'}.
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
