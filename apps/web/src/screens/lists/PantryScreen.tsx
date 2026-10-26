import { Package, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { itemNameSchema, type PantryItem } from '@hestia/shared';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { Sheet } from '../../components/ui/Sheet.tsx';
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

interface PantrySheetProps {
  item?: PantryItem | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { itemName: string; quantityNote: string | null }) => Promise<void>;
}

/** Adding and editing are the same two fields, so they are the same sheet. */
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
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={item === undefined ? 'Add a pantry item' : `Edit ${item.itemName}`}
    >
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-3 px-4"
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
          // The pantry deliberately does no quantity arithmetic.
          hint="Optional, in your own words"
          value={quantityNote}
          onChange={(event) => {
            setQuantityNote(event.target.value);
          }}
        />
        <FormMessage message={formError} />
        <Button type="submit" isLoading={isPending}>
          {item === undefined ? 'Add item' : 'Save item'}
        </Button>
      </form>
    </Sheet>
  );
}

/** A flat searchable list of names with an optional quantity note. */
export function PantryScreen({ householdId }: { householdId: string }): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const pantry = usePantry(householdId);
  const createItem = useCreatePantryItem(householdId);
  const updateItem = useUpdatePantryItem(householdId);
  const deleteItem = useDeletePantryItem(householdId);

  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<PantryItem>();
  const [deleting, setDeleting] = useState<PantryItem>();

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;
  const items = pantry.data ?? [];
  const query = search.trim().toLowerCase();
  const matches =
    query === '' ? items : items.filter((item) => item.itemName.toLowerCase().includes(query));

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
          icon={Package}
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
      // A filtered-empty state is never the first-run one.
      return (
        <EmptyState
          icon={Package}
          message={PANTRY_NO_MATCH_COPY}
          action={{
            label: 'Clear search',
            onAction: () => {
              setSearch('');
            },
          }}
        />
      );
    }

    return (
      <ul className="flex flex-col rounded-md border border-border">
        {matches.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-1 border-b border-border px-4 py-1 last:border-b-0"
          >
            <span className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-2">
              <span className="truncate text-body text-primary">{item.itemName}</span>
              {item.quantityNote !== null && (
                <span className="text-body-sm text-secondary">{item.quantityNote}</span>
              )}
            </span>
            <OverflowMenu
              label={`More actions for ${item.itemName}`}
              items={[
                {
                  label: 'Edit',
                  icon: <Pencil aria-hidden size={20} strokeWidth={1.5} />,
                  disabledReason: offlineReason,
                  onSelect: () => {
                    setEditing(item);
                  },
                },
                {
                  label: 'Delete',
                  icon: <Trash2 aria-hidden size={20} strokeWidth={1.5} />,
                  isDestructive: true,
                  disabledReason: offlineReason,
                  onSelect: () => {
                    setDeleting(item);
                  },
                },
              ]}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TextField
          label="Search the pantry"
          type="search"
          name="pantrySearch"
          className="min-w-60"
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
