import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { Deal } from '@hestia/shared';
import { ErrorState } from '../../components/states/StateBlocks.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { ModalBottomSheet } from '../../components/ui/ModalBottomSheet.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useAddDealToList, useShoppingLists } from '../../lib/api/deals.ts';
import { useDeleteListItem } from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { pluralize } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface AddToListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  householdId: string;
  onAdded?: (list: { id: string; name: string }) => void;
}

export function AddToListSheet({
  open,
  onOpenChange,
  deal,
  householdId,
  onAdded,
}: AddToListSheetProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const [quantity, setQuantity] = useState(1);
  const lists = useShoppingLists(isOnline ? householdId : undefined);
  const addToList = useAddDealToList(householdId);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const deleteItem = useDeleteListItem(householdId, selectedListId ?? '');

  const active = (lists.data ?? []).filter((list) => list.archivedAt === null);

  const handleSelect = (list: { id: string; name: string }): void => {
    if (!deal) return;
    setSelectedListId(list.id);
    onOpenChange(false);
    const payload: { listId: string; dealId: string; quantity?: number } = {
      listId: list.id,
      dealId: deal.id,
    };
    if (quantity > 1) {
      payload.quantity = quantity;
    }
    addToList.mutate(payload, {
      onSuccess: (data) => {
        onAdded?.(list);
        toast({
          variant: 'success',
          message: `Added '${deal.name}' to ${list.name}`,
          action: {
            label: 'Undo',
            onAction: () => {
              if (data.id) {
                deleteItem.mutate(data.id);
              }
            },
          },
        });
      },
      onError: (error) => {
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: `Could not add ${deal.name}. Try again.` }),
        });
      },
    });
  };

  return (
    <ModalBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add to which list?"
      description={deal?.name ?? 'Choose a list'}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-[var(--md-sys-color-surface-container)] px-4 py-2">
          <span className="text-body-md font-medium text-on-surface">Quantity</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => {
                setQuantity((q) => Math.max(1, q - 1));
              }}
            >
              <span className="text-title-md leading-none font-bold select-none">−</span>
            </Button>
            <span className="w-8 text-center text-body-md font-semibold tabular-nums">
              {quantity}
            </span>
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Increase quantity"
              onClick={() => {
                setQuantity((q) => q + 1);
              }}
            >
              <Icon name="add" size={20} />
            </Button>
          </div>
        </div>

        {lists.isPending && (
          <div className="px-4 py-2">
            <SkeletonRows label="Loading lists" rows={2} />
          </div>
        )}

        {lists.isError && (
          <div className="px-4 py-2">
            <ErrorState
              message="Couldn't load your lists. Try again."
              onRetry={() => {
                void lists.refetch();
              }}
            />
          </div>
        )}

        {lists.data && active.length === 0 && (
          <div className="flex flex-col items-start gap-3 px-4 py-2">
            <p className="text-body text-secondary">
              No lists yet. Create one, then add deals to it.
            </p>
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
                  onSelect={() => {
                    handleSelect(list);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalBottomSheet>
  );
}
