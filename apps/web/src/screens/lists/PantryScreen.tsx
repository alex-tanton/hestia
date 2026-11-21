import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { itemNameSchema, type PantryItem } from '@hestia/shared';
import { MdFilterChip } from '../../components/md/MdFilterChip.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { ModalBottomSheet } from '../../components/ui/ModalBottomSheet.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useCreatePantryItem,
  useDeletePantryItem,
  usePantry,
  useUpdatePantryItem,
} from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { firstIssue } from '../../lib/validation.ts';
import { OFFLINE_ACTION_REASON } from './ListsIndexScreen.tsx';

export const PANTRY_EMPTY_COPY =
  'Nothing in the pantry yet. Add what you keep on hand so meal planning knows about it.';
export const PANTRY_NO_MATCH_COPY = 'No pantry items match that search.';

type LocationFilter = 'all' | 'fridge' | 'freezer' | 'pantry';

const LOCATION_FILTERS: readonly { value: LocationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'pantry', label: 'Pantry' },
];

function inferLocation(item: PantryItem): 'fridge' | 'freezer' | 'pantry' {
  const lower = item.itemName.toLowerCase();
  if (lower.includes('frozen') || lower.includes('ice cream') || lower.includes('freezer')) {
    return 'freezer';
  }
  if (
    lower.includes('milk') ||
    lower.includes('cheese') ||
    lower.includes('yogurt') ||
    lower.includes('meat') ||
    lower.includes('chicken') ||
    lower.includes('beef') ||
    lower.includes('butter') ||
    lower.includes('egg') ||
    lower.includes('fridge')
  ) {
    return 'fridge';
  }
  return 'pantry';
}

function getExpiryStatus(item: PantryItem): 'expired' | 'warning' | null {
  const loc = inferLocation(item);
  const shelfDays = loc === 'fridge' ? 7 : loc === 'freezer' ? 90 : 30;
  const updated = new Date(item.lastUpdated).getTime();
  const now = Date.now();
  const diffDays = shelfDays - Math.floor((now - updated) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'expired';
  if (diffDays <= 3) return 'warning';
  return null;
}

interface PantrySheetProps {
  item?: PantryItem | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { itemName: string; quantityNote: string | null }) => Promise<void>;
}

/** Adding and editing are the same two fields, so they are the same ModalBottomSheet. */
function PantrySheet({ item, onOpenChange, onSubmit }: PantrySheetProps): ReactElement {
  const { errors, setErrors, formRef } = useFieldErrors<'itemName'>();
  const [itemName, setItemName] = useState(item?.itemName ?? '');
  const [quantityNote, setQuantityNote] = useState(item?.quantityNote ?? '');
  const [formError, setFormError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    const parsed = itemNameSchema.safeParse(itemName);
    if (!parsed.success) {
      setErrors({ itemName: firstIssue(parsed.error) });
      return;
    }
    setErrors({});
    setIsPending(true);
    try {
      const note = quantityNote.trim();
      await onSubmit({ itemName: parsed.data, quantityNote: note === '' ? null : note });
      onOpenChange(false);
    } catch (error) {
      setFormError(userMessage(error, { fallback: "Couldn't save that item. Try again." }));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <ModalBottomSheet
      open
      onOpenChange={onOpenChange}
      title={item === undefined ? 'Add a pantry item' : `Edit ${item.itemName}`}
      description="Enter item name and optional quantity notes for inventory tracking"
    >
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-4 px-4 pb-6"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <TextField
          label="Item"
          name="pantryItemName"
          autoComplete="off"
          value={itemName}
          error={errors.itemName}
          onChange={(event) => {
            setItemName(event.target.value);
          }}
        />
        <TextField
          label="Quantity note"
          name="quantityNote"
          autoComplete="off"
          hint="Optional, in your own words"
          value={quantityNote}
          onChange={(event) => {
            setQuantityNote(event.target.value);
          }}
        />
        <FormMessage message={formError} />
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--md-sys-color-outline-variant)]">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending}>
            {item === undefined ? 'Add item' : 'Save item'}
          </Button>
        </div>
      </form>
    </ModalBottomSheet>
  );
}

/** A flat searchable list of names with storage location filters and expiry status. */
export function PantryScreen({ householdId }: { householdId: string }): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const pantry = usePantry(householdId);
  const createItem = useCreatePantryItem(householdId);
  const updateItem = useUpdatePantryItem(householdId);
  const deleteItem = useDeletePantryItem(householdId);

  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationFilter>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<PantryItem>();
  const [deleting, setDeleting] = useState<PantryItem>();

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;
  const items = pantry.data ?? [];
  const query = search.trim().toLowerCase();

  const matches = items.filter((item) => {
    const matchesSearch = query === '' || item.itemName.toLowerCase().includes(query);
    const matchesLoc = selectedLocation === 'all' || inferLocation(item) === selectedLocation;
    return matchesSearch && matchesLoc;
  });

  function body(): ReactElement {
    if (pantry.isPending && pantry.fetchStatus === 'paused') {
      return <OfflineState message="The pantry syncs when you reconnect. Your lists still work." />;
    }
    if (pantry.isPending) return <SkeletonRows label="Loading the pantry" />;
    if (pantry.isError && pantry.data === undefined) {
      return (
        <ErrorState
          message="Couldn't load the pantry. Try again."
          onRetry={() => {
            void pantry.refetch();
          }}
        />
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          icon="inventory_2"
          message={PANTRY_EMPTY_COPY}
          action={{
            label: 'Add an item',
            onAction: () => {
              setIsAdding(true);
            },
          }}
        />
      );
    }
    if (matches.length === 0) {
      return (
        <EmptyState
          icon="inventory_2"
          message={PANTRY_NO_MATCH_COPY}
          action={{
            label: 'Clear search',
            onAction: () => {
              setSearch('');
              setSelectedLocation('all');
            },
          }}
        />
      );
    }

    return (
      <ul className="flex flex-col gap-1">
        {matches.map((item) => {
          const expiryStatus = getExpiryStatus(item);
          return (
            <li
              key={item.id}
              className="flex min-h-[56px] items-center justify-between gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-[var(--md-sys-color-surface-container-low)]"
            >
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="truncate text-title-sm font-semibold text-[var(--md-sys-color-on-surface)]">
                    {item.itemName}
                  </span>
                  {expiryStatus === 'expired' && <Badge variant="danger">Expired</Badge>}
                  {expiryStatus === 'warning' && <Badge variant="warning">Expiring soon</Badge>}
                </span>
                {item.quantityNote !== null && (
                  <span className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
                    {item.quantityNote}
                  </span>
                )}
              </span>
              <OverflowMenu
                label={`More actions for ${item.itemName}`}
                items={[
                  {
                    label: 'Edit',
                    icon: <Icon name="edit" size={20} />,
                    disabledReason: offlineReason,
                    onSelect: () => {
                      setEditing(item);
                    },
                  },
                  {
                    label: 'Delete',
                    icon: <Icon name="delete" size={20} />,
                    isDestructive: true,
                    disabledReason: offlineReason,
                    onSelect: () => {
                      setDeleting(item);
                    },
                  },
                ]}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TextField
          label="Search the pantry"
          type="search"
          name="pantrySearch"
          className="min-w-60 flex-1"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        <Button
          disabledReason={offlineReason}
          onClick={() => {
            setIsAdding(true);
          }}
        >
          Add an item
        </Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {LOCATION_FILTERS.map((loc) => (
          <MdFilterChip
            key={loc.value}
            selected={selectedLocation === loc.value}
            onClick={() => {
              setSelectedLocation(loc.value);
            }}
          >
            {loc.label}
          </MdFilterChip>
        ))}
      </div>

      {pantry.isError && pantry.data !== undefined && (
        <StaleNotice
          updatedAt={pantry.dataUpdatedAt}
          onRetry={() => {
            void pantry.refetch();
          }}
        />
      )}

      {body()}

      {isAdding && (
        <PantrySheet
          onOpenChange={setIsAdding}
          onSubmit={async (values) => {
            await createItem.mutateAsync(values);
            toast({ variant: 'success', message: `Added ${values.itemName} to the pantry.` });
          }}
        />
      )}

      {editing !== undefined && (
        <PantrySheet
          key={editing.id}
          item={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          onSubmit={async (values) => {
            await updateItem.mutateAsync({ itemId: editing.id, ...values });
            toast({ variant: 'success', message: `Saved ${values.itemName}.` });
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
        title="Delete this pantry item?"
        description={
          deleting === undefined
            ? ''
            : `Delete ${deleting.itemName}? It is removed from the pantry.`
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
