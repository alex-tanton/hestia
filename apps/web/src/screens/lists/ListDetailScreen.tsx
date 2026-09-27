import { ChevronDown, ChevronRight, Pencil, ShoppingCart, Trash2 } from 'lucide-react';
import { useId, useState, type ReactElement } from 'react';
import type { ListItem, ListItemStatus, ShoppingListDetail, StoreGroup } from '@hearth/shared';
import { ItemSheet, type ItemDraft, type StoreChoice } from '../../components/lists/ItemSheet.tsx';
import { ShoppingListRow } from '../../components/lists/ShoppingListRow.tsx';
import { StoreGroupHeader } from '../../components/lists/StoreGroupHeader.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import type { OverflowMenuItem } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useMembers } from '../../lib/api/hooks.ts';
import {
  useAddBoughtToPantry,
  useAddListItem,
  useDeleteListItem,
  useSetListArchived,
  useShoppingList,
  useUpdateListItem,
} from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { pluralize } from '../../lib/format.ts';
import { usePendingListWrites } from '../../lib/offline/use-write-queue.ts';
import { useListRealtime } from '../../lib/realtime/use-list-realtime.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { OFFLINE_ACTION_REASON } from './ListsIndexScreen.tsx';

export const LIST_EMPTY_COPY = 'Nothing on this list yet. Add what you need to buy.';
export const ALL_BOUGHT_COPY = 'Everything on this list is bought.';
export const ARCHIVED_COPY =
  'This list is archived, so it is read-only. Unarchive it to change it.';

export interface ListDetailScreenProps {
  householdId: string;
  listId: string;
  /** The signed-in member, recorded as `added_by` on an optimistic row. */
  userId: string;
}

function storeChoices(detail: ShoppingListDetail): StoreChoice[] {
  const choices = new Map<string, string>();
  for (const group of detail.storeGroups) {
    if (group.merchantId !== null && group.merchantName !== null) {
      choices.set(group.merchantId, group.merchantName);
    }
  }
  for (const item of detail.bought) {
    if (item.merchantId !== null && item.merchantName !== null) {
      choices.set(item.merchantId, item.merchantName);
    }
  }
  return [...choices].map(([merchantId, merchantName]) => ({ merchantId, merchantName }));
}

export function ListDetailScreen({
  householdId,
  listId,
  userId,
}: ListDetailScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const list = useShoppingList(householdId, listId);
  const members = useMembers(householdId);
  const addItem = useAddListItem(listId);
  const updateItem = useUpdateListItem(listId);
  const deleteItem = useDeleteListItem(householdId, listId);
  const addBoughtToPantry = useAddBoughtToPantry(householdId, listId);
  const setArchived = useSetListArchived(householdId);
  const pending = usePendingListWrites(listId);
  const { changedItemIds, announcement } = useListRealtime(householdId, listId);

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<ListItem>();
  const [deleting, setDeleting] = useState<ListItem>();
  const [isBoughtOpen, setIsBoughtOpen] = useState(false);
  const boughtPanelId = useId();

  const detail = list.data;
  const isArchived = detail?.archivedAt != null;
  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  useScreenChrome({ title: detail?.name ?? 'List', backTo: '/lists', backLabel: 'Lists' });

  const memberNames = new Map(
    (members.data ?? []).map((member) => [member.userId, member.displayName]),
  );

  /** Every item write sends absolute values, never a toggle (Handoff non-negotiable 9). */
  const setStatus = (item: ListItem, status: ListItemStatus): void => {
    updateItem.mutate({
      kind: 'update-item',
      householdId,
      listId,
      itemId: item.id,
      itemName: item.itemName,
      patch: { status },
    });
  };

  const handleAdd = (draft: ItemDraft): void => {
    const id = crypto.randomUUID();
    const optimistic: ListItem = {
      id,
      listId,
      itemName: draft.itemName,
      // Only the service normalizes names; nothing on screen reads this one.
      normalizedName: '',
      quantity: draft.quantity,
      quantityNote: null,
      status: 'needed',
      addedBy: userId,
      source: 'manual',
      merchantId: draft.merchantId,
      merchantName: draft.merchantName,
      dealExternalId: null,
      salePriceCents: null,
      regularPriceCents: null,
      dealValidTo: null,
      priceUnit: draft.priceUnit,
      conditionalPrice: false,
      priceCents: draft.priceCents,
      originalSalePriceCents: null,
      repricedAt: null,
      contributingRecipeIds: [],
      createdAt: new Date().toISOString(),
    };
    addItem.mutate({
      kind: 'add-item',
      householdId,
      listId,
      optimistic,
      request: {
        source: 'manual',
        // The id is the client's, so replaying this add after a reconnect changes nothing.
        id,
        itemName: draft.itemName,
        quantity: draft.quantity,
        priceCents: draft.priceCents,
        priceUnit: draft.priceUnit,
        merchantId: draft.merchantId,
        merchantName: draft.merchantName,
      },
    });
  };

  const handleEdit = (item: ListItem, draft: ItemDraft): void => {
    updateItem.mutate({
      kind: 'update-item',
      householdId,
      listId,
      itemId: item.id,
      itemName: draft.itemName,
      patch: {
        itemName: draft.itemName,
        quantity: draft.quantity,
        merchantId: draft.merchantId,
        merchantName: draft.merchantName,
        // A deal-sourced row keeps the deal's own snapshot; only a manual price is the user's.
        ...(item.source === 'manual'
          ? { priceCents: draft.priceCents, priceUnit: draft.priceUnit }
          : {}),
      },
    });
  };

  const menuFor = (item: ListItem): OverflowMenuItem[] => [
    ...(item.status === 'bought'
      ? []
      : [
          {
            label: item.status === 'in_cart' ? 'Move out of cart' : 'Move to cart',
            icon: <ShoppingCart aria-hidden size={20} strokeWidth={1.5} />,
            onSelect: () => {
              setStatus(item, item.status === 'in_cart' ? 'needed' : 'in_cart');
            },
          },
        ]),
    {
      label: 'Edit',
      icon: <Pencil aria-hidden size={20} strokeWidth={1.5} />,
      onSelect: () => {
        setEditing(item);
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 aria-hidden size={20} strokeWidth={1.5} />,
      isDestructive: true,
      // Deleting an item is not one of the four queueable writes (Requirements › Offline).
      disabledReason: offlineReason,
      onSelect: () => {
        setDeleting(item);
      },
    },
  ];

  const renderRow = (item: ListItem, showStore: boolean): ReactElement => (
    <ShoppingListRow
      key={item.id}
      item={item}
      memberNames={memberNames}
      showStore={showStore}
      isPending={pending.has(item.id)}
      isChanged={changedItemIds.has(item.id)}
      isReadOnly={isArchived}
      onToggleBought={(isBought) => {
        setStatus(item, isBought ? 'bought' : 'needed');
      }}
      menuItems={isArchived ? [] : menuFor(item)}
    />
  );

  const renderGroup = (group: StoreGroup, index: number): ReactElement => {
    const headingId = `store-group-${String(index)}`;
    return (
      <section key={group.merchantId ?? 'anywhere'} aria-labelledby={headingId}>
        {/*
         * Any queued write can move any subtotal — checking an item off takes it out of its
         * group, and an edit can move it to another store — and the client never recomputes
         * money, so while writes are queued every group says its figure is the last one the
         * server sent rather than letting one of them be quietly wrong (non-negotiable 22).
         */}
        <StoreGroupHeader group={group} headingId={headingId} isPending={pending.size > 0} />
        <ul>{group.items.map((item) => renderRow(item, false))}</ul>
      </section>
    );
  };

  function body(): ReactElement {
    if (list.isPending && list.fetchStatus === 'paused') {
      return (
        <OfflineState message="This list has not synced to this device yet. It opens once you reconnect." />
      );
    }
    if (list.isPending) return <SkeletonRows label="Loading this list" />;
    if (detail === undefined) {
      return (
        <ErrorState
          message="Couldn't load this list. Try again."
          onRetry={() => {
            void list.refetch();
          }}
        />
      );
    }

    const hasItems = detail.itemCount > 0;
    if (!hasItems) {
      return (
        <EmptyState
          icon={ShoppingCart}
          message={LIST_EMPTY_COPY}
          {...(isArchived
            ? {}
            : {
                action: {
                  label: 'Add an item',
                  onAction: () => {
                    setIsAdding(true);
                  },
                },
              })}
        />
      );
    }

    const isAllBought = detail.storeGroups.length === 0 && detail.bought.length > 0;

    return (
      <div className="flex flex-col gap-4">
        {isAllBought && <p className="text-body text-secondary">{ALL_BOUGHT_COPY}</p>}

        {detail.storeGroups.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border">
            {detail.storeGroups.map(renderGroup)}
          </div>
        )}

        {detail.bought.length > 0 && (
          /*
           * Bought items collapse to a dimmed group rather than disappearing (Requirements,
           * "Shopping list lifecycle"). The dimming is the muted text token and the recessed
           * surface, not an opacity: blending text toward its background is what drops a
           * contrast ratio under 4.5:1, and WCAG AA is an acceptance criterion
           * (Handoff non-negotiable 16).
           */
          <div className="rounded-md border border-border bg-raised">
            <div className="flex items-center justify-between gap-2 bg-raised px-2 py-1">
              <button
                type="button"
                aria-expanded={isBoughtOpen}
                aria-controls={boughtPanelId}
                className="flex min-h-11 flex-1 items-center gap-2 px-2 text-h3 text-secondary"
                onClick={() => {
                  setIsBoughtOpen((open) => !open);
                }}
              >
                {isBoughtOpen ? (
                  <ChevronDown aria-hidden size={20} strokeWidth={1.5} />
                ) : (
                  <ChevronRight aria-hidden size={20} strokeWidth={1.5} />
                )}
                {`Bought (${String(detail.bought.length)})`}
              </button>
              {!isArchived && (
                <Button
                  variant="ghost"
                  disabledReason={offlineReason}
                  isLoading={addBoughtToPantry.isPending}
                  onClick={() => {
                    addBoughtToPantry.mutate(undefined, {
                      onSuccess: (items) => {
                        toast({
                          variant: 'success',
                          message: `Added ${pluralize(items.length, 'item')} to the pantry.`,
                        });
                      },
                      onError: (error) => {
                        toast({
                          variant: 'error',
                          message: userMessage(error, {
                            fallback: "Couldn't add these to the pantry. Try again.",
                          }),
                        });
                      },
                    });
                  }}
                >
                  Add bought items to pantry
                </Button>
              )}
            </div>
            <ul id={boughtPanelId} hidden={!isBoughtOpen}>
              {detail.bought.map((item) => renderRow(item, true))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {/*
       * In the tree before it has anything to say, because a live region that arrives already
       * populated is announced unreliably (Design › Accessibility › Specific patterns).
       */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {isArchived && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-raised px-3 py-2">
          <p className="max-w-[70ch] text-body-sm text-secondary">{ARCHIVED_COPY}</p>
          <Button
            variant="secondary"
            disabledReason={offlineReason}
            isLoading={setArchived.isPending}
            onClick={() => {
              setArchived.mutate({ listId, isArchived: false });
            }}
          >
            Unarchive
          </Button>
        </div>
      )}

      {!isArchived && detail !== undefined && (
        <div className="flex justify-end">
          {/* Add, check, uncheck, and edit are the writes that queue, so this stays available. */}
          <Button
            onClick={() => {
              setIsAdding(true);
            }}
          >
            Add an item
          </Button>
        </div>
      )}

      {list.isError && detail !== undefined && (
        <StaleNotice
          updatedAt={list.dataUpdatedAt}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      {body()}

      {isAdding && detail !== undefined && (
        <ItemSheet
          open
          onOpenChange={setIsAdding}
          stores={storeChoices(detail)}
          onSubmit={handleAdd}
        />
      )}

      {editing !== undefined && detail !== undefined && (
        <ItemSheet
          key={editing.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          item={editing}
          stores={storeChoices(detail)}
          onSubmit={(draft) => {
            handleEdit(editing, draft);
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
        title="Delete this item?"
        description={
          deleting === undefined ? '' : `Delete ${deleting.itemName}? It is removed from this list.`
        }
        confirmLabel="Delete item"
        isConfirming={deleteItem.isPending}
        onConfirm={() => {
          if (deleting === undefined) return;
          const { id, itemName } = deleting;
          deleteItem.mutate(id, {
            onSuccess: () => {
              setDeleting(undefined);
              toast({ variant: 'success', message: `Deleted ${itemName}.` });
            },
            onError: (error) => {
              setDeleting(undefined);
              toast({
                variant: 'error',
                message: userMessage(error, {
                  fallback: `Couldn't delete ${itemName}. Try again.`,
                }),
              });
            },
          });
        }}
      />
    </section>
  );
}
