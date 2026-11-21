import { useState, type ReactElement } from 'react';
import { Icon } from '../ui/Icon.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { Skeleton } from '../ui/Skeleton.tsx';

export interface HouseholdSummary {
  id: string;
  name: string;
  memberCount: number;
}

export interface HouseholdSwitcherProps {
  /** Every household the user belongs to; undefined while loading. */
  households: readonly HouseholdSummary[] | undefined;
  activeHouseholdId: string | undefined;
  onSelect: (householdId: string) => void;
  onJoinOrCreate: () => void;
}

function memberCountLabel(count: number): string {
  return count === 1 ? '1 member' : `${String(count)} members`;
}

/**
 * Top-bar trigger showing the active household, opening a modal bottom sheet of every membership.
 * A single membership still opens the sheet, since it is also the route to joining or creating
 * another household.
 */
export function HouseholdSwitcher({
  households,
  activeHouseholdId,
  onSelect,
  onJoinOrCreate,
}: HouseholdSwitcherProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const active = households?.find((household) => household.id === activeHouseholdId);

  if (!households) {
    return (
      <span role="status" className="flex min-h-11 items-center">
        <span className="sr-only">Loading households</span>
        <Skeleton className="h-5 w-28 rounded-full bg-surface-container-highest" />
      </span>
    );
  }

  const isSingleHousehold = households.length === 1;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
        className="flex min-h-11 max-w-full min-w-0 items-center gap-1 rounded-md px-2 text-body font-semibold text-primary transition-colors duration-150 ease-out hover:bg-surface-container-high"
      >
        <span className="truncate">{active?.name ?? 'Choose a household'}</span>
        <Icon name="expand_more" size={20} className="shrink-0 text-secondary" />
        <span className="sr-only">, switch household</span>
      </button>

      <ModalBottomSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Households"
        description={isSingleHousehold ? 'No other households' : undefined}
      >
        <ul className="divide-y divide-border">
          {households.map((household) => {
            const isActive = household.id === activeHouseholdId;
            return (
              <li key={household.id}>
                <ListRow
                  title={household.name}
                  description={memberCountLabel(household.memberCount)}
                  isCurrent={isActive}
                  leading={
                    <span className="flex size-5 items-center justify-center">
                      {isActive && <Icon name="check" size={20} />}
                    </span>
                  }
                  trailing={
                    isActive ? (
                      <span className="text-caption text-secondary">Current</span>
                    ) : undefined
                  }
                  onSelect={() => {
                    setIsOpen(false);
                    if (!isActive) onSelect(household.id);
                  }}
                />
              </li>
            );
          })}
          <li>
            <ListRow
              title="Join or create a household"
              leading={<Icon name="add" size={20} />}
              onSelect={() => {
                setIsOpen(false);
                onJoinOrCreate();
              }}
            />
          </li>
        </ul>
      </ModalBottomSheet>
    </>
  );
}
