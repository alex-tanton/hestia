import { useState, type ReactElement } from 'react';
import type { ListItem } from '@hestia/shared';
import { useAddBoughtToPantry } from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { pluralize } from '../../lib/format.ts';
import { MdFilterChip } from '../md/MdFilterChip.tsx';
import { Button } from '../ui/Button.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { useToast } from '../ui/Toast.tsx';

export interface SyncToPantrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  listId: string;
  boughtItems: readonly ListItem[];
  onCommit?: () => void;
}

type StorageCategory = 'fridge' | 'freezer' | 'pantry';

const DEFAULT_STORAGE_OPTION: { value: StorageCategory; label: string; days: number } = {
  value: 'fridge',
  label: 'Fridge',
  days: 7,
};

const STORAGE_OPTIONS: readonly { value: StorageCategory; label: string; days: number }[] = [
  DEFAULT_STORAGE_OPTION,
  { value: 'freezer', label: 'Freezer', days: 90 },
  { value: 'pantry', label: 'Pantry', days: 30 },
];

function defaultCategory(itemName: string): StorageCategory {
  const lower = itemName.toLowerCase();
  if (lower.includes('ice cream') || lower.includes('frozen') || lower.includes('pizza')) {
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
    lower.includes('egg')
  ) {
    return 'fridge';
  }
  return 'pantry';
}

export function SyncToPantrySheet({
  open,
  onOpenChange,
  householdId,
  listId,
  boughtItems,
  onCommit,
}: SyncToPantrySheetProps): ReactElement {
  const toast = useToast();
  const addBoughtToPantry = useAddBoughtToPantry(householdId, listId);
  const [categories, setCategories] = useState<Record<string, StorageCategory>>({});

  const getCategory = (item: ListItem): StorageCategory => {
    return categories[item.id] ?? defaultCategory(item.itemName);
  };

  const handleSelectCategory = (itemId: string, cat: StorageCategory): void => {
    setCategories((prev) => ({ ...prev, [itemId]: cat }));
  };

  const handleCommit = (): void => {
    addBoughtToPantry.mutate(undefined, {
      onSuccess: (items) => {
        toast({
          variant: 'success',
          message: `Added ${pluralize(items.length, 'item')} to the pantry.`,
        });
        onCommit?.();
        onOpenChange(false);
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
  };

  return (
    <ModalBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add bought to pantry"
      description="Review storage locations and expiry estimates before adding items to your pantry."
    >
      <div className="flex flex-col gap-4 px-4 pb-6">
        <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]">
          {boughtItems.map((item) => {
            const currentCat = getCategory(item);
            const currentOption =
              STORAGE_OPTIONS.find((opt) => opt.value === currentCat) ?? DEFAULT_STORAGE_OPTION;
            return (
              <li key={item.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-body-md font-medium text-[var(--md-sys-color-on-surface)]">
                    {item.itemName}
                  </span>
                  <span className="text-label-sm text-[var(--md-sys-color-on-surface-variant)]">
                    ~{currentOption.days} days
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {STORAGE_OPTIONS.map((opt) => (
                    <MdFilterChip
                      key={opt.value}
                      selected={currentCat === opt.value}
                      onClick={() => {
                        handleSelectCategory(item.id, opt.value);
                      }}
                    >
                      {opt.label}
                    </MdFilterChip>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--md-sys-color-outline-variant)]">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" isLoading={addBoughtToPantry.isPending} onClick={handleCommit}>
            Commit items to pantry
          </Button>
        </div>
      </div>
    </ModalBottomSheet>
  );
}
