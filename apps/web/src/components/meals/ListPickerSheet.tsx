import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { useShoppingLists } from '../../lib/api/list-hooks.ts';
import { pluralize } from '../../lib/format.ts';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Button } from '../ui/Button.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';

export interface ListPickerSheetProps {
  householdId: string;
  title: string;
  description?: string;
  isPicking: boolean;
  onPick: (listId: string, listName: string) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * The list picker "Add missing to list" opens from a recipe, a planned meal, or a whole planned
 * week (Design › Screens › 10, 12; Requirements › "Add missing to list") — one target list, so one
 * picker. Mirrors `AddToList`'s own sheet body, the pattern Design's week planner reuses.
 */
export function ListPickerSheet({
  householdId,
  title,
  description,
  isPicking,
  onPick,
  onOpenChange,
}: ListPickerSheetProps): ReactElement {
  const navigate = useNavigate();
  const lists = useShoppingLists(householdId);
  const active = (lists.data ?? []).filter((list) => list.archivedAt === null);

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={title}
      {...(description === undefined ? {} : { description })}
    >
      {lists.isPending && (
        <div className="px-4">
          <SkeletonRows label="Loading lists" rows={2} />
        </div>
      )}
      {lists.isError && (
        <div className="px-4">
          <ErrorState
            message="Couldn't load your lists. Try again."
            onRetry={() => {
              void lists.refetch();
            }}
          />
        </div>
      )}
      {lists.data && active.length === 0 && (
        <div className="flex flex-col items-start gap-3 px-4">
          <p className="text-body text-secondary">No lists yet. Create one, then add to it.</p>
          <Button
            onClick={() => {
              onOpenChange(false);
              void navigate('/lists');
            }}
          >
            Go to Lists
          </Button>
        </div>
      )}
      {active.length > 0 && (
        <ul className="divide-y divide-border">
          {active.map((list) => (
            <li key={list.id}>
              <ListRow
                title={list.name}
                description={`${pluralize(list.outstandingCount, 'item')} outstanding`}
                isDisabled={isPicking}
                onSelect={() => {
                  onPick(list.id, list.name);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
