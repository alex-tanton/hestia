import { Archive, ArchiveRestore, Pencil, ShoppingCart, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ShoppingList } from '@hestia/shared';
import { ErrorState, EmptyState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { userMessage } from '../../lib/api/problem.ts';
import { useDeleteList, useSetListArchived, useShoppingLists } from '../../lib/api/list-hooks.ts';
import { formatDateTime, pluralize } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { ListNameSheet } from './ListNameSheet.tsx';

export const LISTS_EMPTY_COPY =
  'No lists yet. Create one for this week and add what you need to buy.';
export const OFFLINE_ACTION_REASON = 'Needs a connection.';

/** Deleting a list requires confirmation. */
export function deleteListConfirmation(list: ShoppingList): string {
  return `Delete ${list.name}? Its ${pluralize(list.itemCount, 'item')} are removed permanently.`;
}

export interface ListsIndexScreenProps {
  householdId: string;
  /** The archived view is the same screen, read-only, with an unarchive action. */
  isArchived?: boolean;
}

export function ListsIndexScreen({
  householdId,
  isArchived = false,
}: ListsIndexScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const lists = useShoppingLists(householdId, isArchived);
  const setArchived = useSetListArchived(householdId);
  const deleteList = useDeleteList(householdId);

  const [isCreating, setIsCreating] = useState(false);
  const [renaming, setRenaming] = useState<ShoppingList>();
  const [deleting, setDeleting] = useState<ShoppingList>();

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  const archiveList = (list: ShoppingList, next: boolean): void => {
    setArchived.mutate(
      { listId: list.id, isArchived: next },
      {
        onSuccess: () => {
          toast({
            variant: 'success',
            message: next ? `Archived ${list.name}.` : `Unarchived ${list.name}.`,
          });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: `Couldn't change ${list.name}. Try again.` }),
          });
        },
      },
    );
  };

  const menuFor = (list: ShoppingList): OverflowMenuItem[] =>
    isArchived
      ? [
          {
            label: 'Unarchive',
            icon: <ArchiveRestore aria-hidden size={20} strokeWidth={1.5} />,
            disabledReason: offlineReason,
            onSelect: () => {
              archiveList(list, false);
            },
          },
          {
            label: 'Delete',
            icon: <Trash2 aria-hidden size={20} strokeWidth={1.5} />,
            isDestructive: true,
            disabledReason: offlineReason,
            onSelect: () => {
              setDeleting(list);
            },
          },
        ]
      : [
          {
            label: 'Rename',
            icon: <Pencil aria-hidden size={20} strokeWidth={1.5} />,
            disabledReason: offlineReason,
            onSelect: () => {
              setRenaming(list);
            },
          },
          {
            label: 'Archive',
            icon: <Archive aria-hidden size={20} strokeWidth={1.5} />,
            disabledReason: offlineReason,
            onSelect: () => {
              archiveList(list, true);
            },
          },
          {
            label: 'Delete',
            icon: <Trash2 aria-hidden size={20} strokeWidth={1.5} />,
            isDestructive: true,
            disabledReason: offlineReason,
            onSelect: () => {
              setDeleting(list);
            },
          },
        ];

  function body(): ReactElement {
    // Offline with nothing cached: the fetch is paused, so it is not loading and not an error.
    if (lists.isPending && lists.fetchStatus === 'paused') {
      return (
        <OfflineState message="Your lists sync when you reconnect. What you have already opened stays readable." />
      );
    }
    if (lists.isPending) return <SkeletonRows label="Loading your lists" />;
    if (lists.isError && lists.data === undefined) {
      return (
        <ErrorState
          message="Couldn't load your lists. Try again."
          onRetry={() => {
            void lists.refetch();
          }}
        />
      );
    }
    const data = lists.data;
    if (data.length === 0) {
      return isArchived ? (
        <EmptyState icon={Archive} message="No archived lists. Archiving one keeps it readable." />
      ) : (
        <EmptyState
          icon={ShoppingCart}
          message={LISTS_EMPTY_COPY}
          action={{
            label: 'Create a list',
            onAction: () => {
              setIsCreating(true);
            },
          }}
        />
      );
    }

    return (
      <ul className="flex flex-col rounded-md border border-border">
        {data.map((list) => (
          <li
            key={list.id}
            className="flex items-center gap-1 border-b border-border last:border-b-0"
          >
            <Link
              to={`/lists/${list.id}`}
              className="flex min-h-11 flex-1 flex-col gap-0.5 px-4 py-3 hover:bg-raised"
            >
              <span className="truncate text-body text-primary">{list.name}</span>
              <span className="text-body-sm text-secondary">
                {`${pluralize(list.itemCount, 'item')} · ${String(list.outstandingCount)} outstanding · ${formatDateTime(list.updatedAt)}`}
              </span>
            </Link>
            <OverflowMenu label={`More actions for ${list.name}`} items={menuFor(list)} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {!isArchived && (
        <div className="flex justify-end">
          <Button
            disabledReason={offlineReason}
            onClick={() => {
              setIsCreating(true);
            }}
          >
            New list
          </Button>
        </div>
      )}

      {lists.isError && lists.data !== undefined && (
        <StaleNotice
          updatedAt={lists.dataUpdatedAt}
          onRetry={() => {
            void lists.refetch();
          }}
        />
      )}

      {body()}

      {!isArchived && (
        <Link to="/lists/archived" className="self-start text-body text-section underline">
          Archived lists
        </Link>
      )}

      {isCreating && (
        <ListNameSheet
          householdId={householdId}
          open
          onOpenChange={setIsCreating}
          onCreated={(list) => {
            void navigate(`/lists/${list.id}`);
          }}
        />
      )}

      {renaming !== undefined && (
        <ListNameSheet
          key={renaming.id}
          householdId={householdId}
          list={renaming}
          open
          onOpenChange={(open) => {
            if (!open) setRenaming(undefined);
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
        title="Delete this list?"
        description={deleting === undefined ? '' : deleteListConfirmation(deleting)}
        confirmLabel="Delete list"
        isConfirming={deleteList.isPending}
        onConfirm={() => {
          if (deleting === undefined) return;
          const { name, id } = deleting;
          deleteList.mutate(id, {
            onSuccess: () => {
              setDeleting(undefined);
              toast({ variant: 'success', message: `Deleted ${name}.` });
            },
            onError: (error) => {
              setDeleting(undefined);
              toast({
                variant: 'error',
                message: userMessage(error, { fallback: `Couldn't delete ${name}. Try again.` }),
              });
            },
          });
        }}
      />
    </section>
  );
}
