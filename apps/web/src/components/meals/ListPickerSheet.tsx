import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { useShoppingLists } from '../../lib/api/list-hooks.ts';
import { pluralize } from '../../lib/format.ts';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Button } from '../ui/Button.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';

export interface MissingIngredientItem {
  id: string;
  itemName: string;
}

export interface ListPickerSheetProps {
  householdId: string;
  title: string;
  description?: string | null | undefined;
  isPicking: boolean;
  missingIngredients?: readonly MissingIngredientItem[] | undefined;
  onPick: (listId: string, listName: string, selectedIngredientIds?: string[]) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * ListPickerSheet opens from recipe detail, planned meals, or planner weeks.
 * Renders inside ModalBottomSheet with optional missing ingredient checklist and target list selection per D-04.
 */
export function ListPickerSheet({
  householdId,
  title,
  description,
  isPicking,
  missingIngredients,
  onPick,
  onOpenChange,
}: ListPickerSheetProps): ReactElement {
  const navigate = useNavigate();
  const lists = useShoppingLists(householdId);
  const active = (lists.data ?? []).filter((list) => list.archivedAt === null);

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    missingIngredients ? missingIngredients.map((item) => item.id) : [],
  );

  return (
    <ModalBottomSheet
      open
      onOpenChange={onOpenChange}
      title={title}
      description={description ?? undefined}
    >
      <div className="flex flex-col gap-4 px-4 pb-6">
        {/* Missing ingredients checklist per D-04 */}
        {missingIngredients && missingIngredients.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg bg-[var(--md-sys-color-surface-container-low)] p-3">
            <span className="text-caption font-semibold uppercase text-secondary">
              Ingredients to add ({selectedIds.length} of {missingIngredients.length})
            </span>
            <ul className="flex max-h-36 flex-col gap-1.5 overflow-y-auto">
              {missingIngredients.map((item) => {
                const isChecked = selectedIds.includes(item.id);
                return (
                  <li key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`missing-${item.id}`}
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds([...selectedIds, item.id]);
                        } else {
                          setSelectedIds(selectedIds.filter((id) => id !== item.id));
                        }
                      }}
                      className="size-4 accent-[var(--md-sys-color-primary)]"
                    />
                    <label
                      htmlFor={`missing-${item.id}`}
                      className="text-body-sm text-primary select-none"
                    >
                      {item.itemName}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {lists.isPending && <SkeletonRows label="Loading lists" rows={2} />}
        {lists.isError && (
          <ErrorState
            message="Couldn't load your lists. Try again."
            onRetry={() => {
              void lists.refetch();
            }}
          />
        )}
        {lists.data && active.length === 0 && (
          <div className="flex flex-col items-start gap-3">
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
          <div className="flex flex-col gap-2">
            <span className="text-caption font-semibold uppercase text-secondary">
              Choose destination list
            </span>
            <ul className="divide-y divide-border rounded-md border border-border">
              {active.map((list) => (
                <li key={list.id}>
                  <ListRow
                    title={list.name}
                    description={`${pluralize(list.outstandingCount, 'item')} outstanding`}
                    isDisabled={
                      isPicking || (missingIngredients !== undefined && selectedIds.length === 0)
                    }
                    onSelect={() => {
                      onPick(list.id, list.name, selectedIds);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ModalBottomSheet>
  );
}
