import { Check, ChevronDown, Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { ListRow } from '../ui/ListRow.tsx';
import { Sheet } from '../ui/Sheet.tsx';
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
 * Top-bar trigger showing the active household, opening a sheet of every membership
 * (Design › Screens › 3). A single membership still opens the sheet, since it is also the
 * route to joining or creating another household.
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
        <Skeleton className="h-4 w-28" />
      </span>
    );
  }

  const trigger = (
    <button
      type="button"
      className="flex min-h-11 max-w-full min-w-0 items-center gap-1 rounded-md px-2 text-body font-semibold text-primary transition-colors duration-150 ease-out hover:bg-raised active:bg-section-tint"
    >
      <span className="truncate">{active?.name ?? 'Choose a household'}</span>
      <ChevronDown aria-hidden size={20} strokeWidth={1.5} className="shrink-0 text-secondary" />
      <span className="sr-only">, switch household</span>
    </button>
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen} title="Households" trigger={trigger}>
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
                    {isActive && <Check aria-hidden size={20} strokeWidth={1.5} />}
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
            leading={<Plus aria-hidden size={20} strokeWidth={1.5} />}
            onSelect={() => {
              setIsOpen(false);
              onJoinOrCreate();
            }}
          />
        </li>
      </ul>
    </Sheet>
  );
}
