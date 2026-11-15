import { useId, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { ListItem, ListItemStatus, ShoppingListDetail, StoreGroup } from '@hestia/shared';
import { BarcodeScannerDialog } from '../../components/lists/BarcodeScannerDialog.tsx';
import { ItemSheet, type ItemDraft, type StoreChoice } from '../../components/lists/ItemSheet.tsx';
import { ShoppingListRow } from '../../components/lists/ShoppingListRow.tsx';
import { StoreGroupHeader } from '../../components/lists/StoreGroupHeader.tsx';
import { SyncToPantrySheet } from '../../components/lists/SyncToPantrySheet.tsx';
import { MdFab } from '../../components/md/MdFab.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useApi } from '../../lib/api/api-context.tsx';
import { fetchBarcodeProduct } from '../../lib/api/barcode-hooks.ts';
import { useMembers } from '../../lib/api/hooks.ts';
import {
  useAddListItem,
  useDeleteListItem,
  useSetListArchived,
  useShoppingList,
  useUpdateListItem,
} from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { matchScannedItem } from '../../lib/barcode/matching.ts';
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
  const navigate = useNavigate();
  const toast = useToast();
  const api = useApi();
  const list = useShoppingList(householdId, listId);
  const members = useMembers(householdId);
  const addItem = useAddListItem(listId);
  const updateItem = useUpdateListItem(listId);
  const deleteItem = useDeleteListItem(householdId, listId);
  const setArchived = useSetListArchived(householdId);
  const pending = usePendingListWrites(listId);
  const { changedItemIds, announcement } = useListRealtime(householdId, listId);

  const [quickAddName, setQuickAddName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncToPantryOpen, setIsSyncToPantryOpen] = useState(false);
  const [scannerDraft, setScannerDraft] = useState<Partial<ItemDraft> | undefined>(undefined);
  const [editing, setEditing] = useState<ListItem>();
  const [deleting, setDeleting] = useState<ListItem>();
  const [isBoughtOpen, setIsBoughtOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const boughtPanelId = useId();

  const detail = list.data;
  const isArchived = detail?.archivedAt != null;
  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  useScreenChrome({
    title: detail?.name ?? 'List',
    backTo: '/lists',
    backLabel: 'Lists',
  });

  const memberNames = new Map(
    (members.data ?? []).map((member) => [member.userId, member.displayName]),
  );

  const toggleGroup = (key: string): void => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** Every item write sends absolute values, never a toggle. */
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

  const executeCheckOff = (item: ListItem, scannedBarcode: string): void => {
    updateItem.mutate({
      kind: 'update-item',
      householdId,
      listId,
      itemId: item.id,
      itemName: item.itemName,
      patch: {
        status: 'bought',
        ...(!item.barcode ? { barcode: scannedBarcode } : {}),
      },
    });

    toast({
      variant: 'success',
      message: `${item.itemName} marked bought`,
      action: {
        label: 'Undo',
        onAction: () => {
          updateItem.mutate({
            kind: 'update-item',
            householdId,
            listId,
            itemId: item.id,
            itemName: item.itemName,
            patch: { status: 'needed' },
          });
        },
      },
    });
  };

  const handleScan = async (barcode: string, scanMode: 'add' | 'shop'): Promise<void> => {
    if (scanMode === 'add') {
      try {
        const product = await fetchBarcodeProduct(api, barcode);
        const nameParts: string[] = [];
        if (product.brands) nameParts.push(product.brands);
        if (product.productName) nameParts.push(product.productName);
        const formattedName =
          nameParts.length > 0 ? nameParts.join(' ') : (product.productName ?? barcode);

        setIsScanning(false);
        setScannerDraft({
          itemName: formattedName,
          barcode,
          quantity: 1,
        });
        setIsAdding(true);
      } catch {
        setIsScanning(false);
        setScannerDraft({
          itemName: '',
          barcode,
          quantity: 1,
        });
        setIsAdding(true);
        toast({
          variant: 'info',
          message: 'Barcode not found. Enter item details manually.',
        });
      }
      return;
    }

    // Mode 'shop'
    const unbought = (detail?.storeGroups.flatMap((g) => g.items) ?? []).filter(
      (item) => item.status !== 'bought',
    );

    // 1. Offline exact barcode match
    const exact = unbought.find((item) => item.barcode === barcode);
    if (exact) {
      executeCheckOff(exact, barcode);
      return;
    }

    // 2. Online lookup & matching
    let productName: string | null = null;
    try {
      const product = await fetchBarcodeProduct(api, barcode);
      productName = product.productName;
    } catch {
      // Lookup failed or offline
    }

    const matchResult = matchScannedItem(unbought, barcode, productName);
    if (matchResult.exactBarcodeMatch) {
      executeCheckOff(matchResult.exactBarcodeMatch, barcode);
    } else if (matchResult.normalizedNameMatch) {
      executeCheckOff(matchResult.normalizedNameMatch, barcode);
    } else if (matchResult.candidateMatches.length > 1) {
      toast({
        variant: 'info',
        message: `Multiple matches found for "${productName ?? barcode}".`,
      });
    } else {
      toast({
        variant: 'info',
        message: `${productName ?? 'Item'} is not on this list.`,
      });
    }
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
      barcode: draft.barcode ?? null,
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
        barcode: draft.barcode ?? null,
      },
    });
  };

  const handleQuickAdd = (): void => {
    const trimmed = quickAddName.trim();
    if (!trimmed) return;
    handleAdd({
      itemName: trimmed,
      quantity: null,
      priceCents: null,
      priceUnit: 'each',
      merchantId: null,
      merchantName: null,
      barcode: null,
    });
    setQuickAddName('');
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
        barcode: draft.barcode ?? null,
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
            icon: <Icon name="shopping_cart" size={20} />,
            onSelect: () => {
              setStatus(item, item.status === 'in_cart' ? 'needed' : 'in_cart');
            },
          },
        ]),
    {
      label: 'Edit',
      icon: <Icon name="edit" size={20} />,
      onSelect: () => {
        setEditing(item);
      },
    },
    {
      label: 'Delete',
      icon: <Icon name="delete" size={20} />,
      isDestructive: true,
      // Deleting an item is not one of the four queueable writes.
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
        if (isBought) {
          setStatus(item, 'bought');
          toast({
            variant: 'success',
            message: `Marked '${item.itemName}' as bought`,
            action: {
              label: 'Undo',
              onAction: () => {
                setStatus(item, 'needed');
              },
            },
          });
        } else {
          setStatus(item, 'needed');
        }
      }}
      menuItems={isArchived ? [] : menuFor(item)}
    />
  );

  const renderGroup = (group: StoreGroup, index: number): ReactElement => {
    const groupKey = group.merchantId ?? 'anywhere';
    const headingId = `store-group-${String(index)}`;
    const isCollapsed = Boolean(collapsedGroups[groupKey]);
    return (
      <section key={groupKey} aria-labelledby={headingId} className="flex flex-col">
        {/*
         * Any queued write can move any subtotal — checking an item off takes it out of its
         * group, and an edit can move it to another store — and the client never recomputes
         * money, so while writes are queued every group says its figure is the last one the
         * server sent rather than letting one of them be quietly wrong.
         */}
        <StoreGroupHeader
          group={group}
          headingId={headingId}
          isPending={pending.size > 0}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => {
            toggleGroup(groupKey);
          }}
        />
        {!isCollapsed && <ul>{group.items.map((item) => renderRow(item, false))}</ul>}
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
          icon="shopping_cart"
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
          <div className="flex flex-col gap-2">{detail.storeGroups.map(renderGroup)}</div>
        )}

        {detail.bought.length > 0 && (
          <div className="rounded-md bg-[var(--md-sys-color-surface-container-low)]">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button
                type="button"
                aria-expanded={isBoughtOpen}
                aria-controls={boughtPanelId}
                className="flex min-h-11 flex-1 items-center gap-2 text-title-sm font-semibold text-[var(--md-sys-color-on-surface-variant)]"
                onClick={() => {
                  setIsBoughtOpen((open) => !open);
                }}
              >
                <Icon name={isBoughtOpen ? 'expand_more' : 'chevron_right'} size={20} />
                <span>{`Bought (${String(detail.bought.length)})`}</span>
              </button>
              {!isArchived && (
                <Button
                  variant="ghost"
                  disabledReason={offlineReason}
                  onClick={() => {
                    setIsSyncToPantryOpen(true);
                  }}
                >
                  Add bought to pantry
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
    <section className="flex flex-col gap-4 pb-16">
      {/*
       * In the tree before it has anything to say, because a live region that arrives already
       * populated is announced unreliably.
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
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TextField
                label="Add an item..."
                name="quickAddItem"
                value={quickAddName}
                onChange={(e) => {
                  setQuickAddName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAdd();
                  }
                }}
              />
            </div>
            <Button
              variant="primary"
              disabledReason={offlineReason}
              onClick={handleQuickAdd}
              aria-label="Add grocery item"
            >
              <Icon name="add" size={20} />
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsScanning(true);
              }}
            >
              <Icon name="barcode_scanner" size={18} className="mr-1.5" />
              Scan barcode
            </Button>
            <Button
              onClick={() => {
                setIsAdding(true);
              }}
            >
              Add an item
            </Button>
            <OverflowMenu
              label="More actions for this list"
              items={[
                {
                  label: 'Archived lists',
                  onSelect: () => {
                    void navigate('/lists/archived');
                  },
                },
                ...(detail.bought.length > 0
                  ? [
                      {
                        label: 'Add bought to pantry',
                        onSelect: () => {
                          setIsSyncToPantryOpen(true);
                        },
                      },
                    ]
                  : []),
              ]}
            />
          </div>
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

      {!isArchived && detail !== undefined && (
        <div className="fixed bottom-6 right-6 z-20">
          <MdFab
            aria-label="Add grocery item"
            onClick={() => {
              setScannerDraft(undefined);
              setIsAdding(true);
            }}
          >
            <span slot="icon">
              <Icon name="add" size={24} />
            </span>
          </MdFab>
        </div>
      )}

      {isAdding && detail !== undefined && (
        <ItemSheet
          open
          onOpenChange={(open) => {
            setIsAdding(open);
            if (!open) setScannerDraft(undefined);
          }}
          initialDraft={scannerDraft}
          stores={storeChoices(detail)}
          onSubmit={handleAdd}
        />
      )}

      {isScanning && (
        <BarcodeScannerDialog
          open={isScanning}
          onOpenChange={setIsScanning}
          onScan={(code, scanMode) => {
            void handleScan(code, scanMode);
          }}
        />
      )}

      {isSyncToPantryOpen && detail !== undefined && (
        <SyncToPantrySheet
          open={isSyncToPantryOpen}
          onOpenChange={setIsSyncToPantryOpen}
          householdId={householdId}
          listId={listId}
          boughtItems={detail.bought}
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
