import { Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { Deal } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
import { ErrorState } from '../../components/states/StateBlocks.tsx';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { Sheet } from '../../components/ui/Sheet.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useAddDealToList, useShoppingLists } from '../../lib/api/deals.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { pluralize } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface AddToListProps {
  householdId: string;
  deal: Deal;
}

/**
 * The deal card's add-to-list action. One list adds straight away; several open the list
 * picker the week planner's "Add missing to list" uses, since that is the established pattern for
 * the same choice.
 *
 * Only the deal's id is ever sent — the service takes the price snapshot from the `deal` row.
 */
export function AddToList({ householdId, deal }: AddToListProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const lists = useShoppingLists(isOnline ? householdId : undefined);
  const addToList = useAddDealToList(householdId);

  const active = (lists.data ?? []).filter((list) => list.archivedAt === null);

  const add = (listId: string, listName: string): void => {
    setIsPickerOpen(false);
    addToList.mutate(
      { listId, dealId: deal.id },
      {
        onSuccess: () => {
          toast({ variant: 'success', message: `Added to ${listName}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: `Could not add ${deal.name}. Try again.` }),
          });
        },
      },
    );
  };

  const handleClick = (): void => {
    const only = active.length === 1 ? active[0] : undefined;
    if (only) {
      add(only.id, only.name);
      return;
    }
    setIsPickerOpen(true);
  };

  return (
    <>
      <Button
        variant="secondary"
        className="self-start"
        isLoading={addToList.isPending}
        disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
        aria-label={`Add ${deal.name} to a list`}
        onClick={handleClick}
      >
        <Plus aria-hidden size={20} strokeWidth={1.5} />
        Add to list
      </Button>

      <Sheet
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        title="Add to which list?"
        description={deal.name}
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
            <p className="text-body text-secondary">
              No lists yet. Create one, then add deals to it.
            </p>
            <Button
              onClick={() => {
                setIsPickerOpen(false);
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
                  onSelect={() => {
                    add(list.id, list.name);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
