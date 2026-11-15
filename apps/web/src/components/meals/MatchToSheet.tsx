import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { useDealSearch, type DealSearchParams } from '../../lib/api/deals.ts';
import { usePantry } from '../../lib/api/list-hooks.ts';
import { useCreateMatchOverride } from '../../lib/api/meal-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';
import { useToast } from '../ui/Toast.tsx';

export interface MatchToSheetProps {
  householdId: string;
  recipeId: string;
  /** The ingredient's plain item name, e.g. "cheese" — never a pre-normalized string. */
  ingredientName: string;
  onOpenChange: (open: boolean) => void;
}

const DEAL_SEARCH_DEFAULTS: Omit<DealSearchParams, 'q'> = {
  scope: 'favorites',
  stores: [],
  category: undefined,
  minPriceCents: undefined,
  maxPriceCents: undefined,
  sort: 'relevance',
  page: 1,
};

/**
 * MatchToSheet allows overriding an ingredient match by selecting from Pantry or active Deals per D-06.
 * Renders inside ModalBottomSheet tabbed between "Pantry" and "Deals" via SegmentedControl.
 */
export function MatchToSheet({
  householdId,
  recipeId,
  ingredientName,
  onOpenChange,
}: MatchToSheetProps): ReactElement {
  const toast = useToast();
  const [tab, setTab] = useState<'pantry' | 'deals'>('pantry');
  const pantry = usePantry(householdId);
  const [draftQuery, setDraftQuery] = useState(ingredientName);
  const [dealQuery, setDealQuery] = useState(ingredientName);
  const deals = useDealSearch(householdId, { ...DEAL_SEARCH_DEFAULTS, q: dealQuery });
  const createOverride = useCreateMatchOverride(householdId);

  const handleSearch = (event: SyntheticEvent): void => {
    event.preventDefault();
    const trimmed = draftQuery.trim();
    if (trimmed !== '') setDealQuery(trimmed);
  };

  const pick = (targetKind: 'pantry' | 'deal', targetName: string): void => {
    createOverride.mutate(
      {
        recipeId,
        request: { ingredientName, targetKind, targetName, decision: 'force_match' },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast({ variant: 'success', message: `Matched ${ingredientName} to ${targetName}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't save that match. Try again." }),
          });
        },
      },
    );
  };

  const pantryContent = (
    <section aria-labelledby="match-pantry-heading" className="flex flex-col gap-2 pt-2">
      <h3 id="match-pantry-heading" className="text-title-small font-semibold text-primary">
        Pantry
      </h3>
      {pantry.isPending && <SkeletonRows label="Loading the pantry" rows={2} />}
      {pantry.isError && (
        <ErrorState
          message="Couldn't load the pantry. Try again."
          onRetry={() => {
            void pantry.refetch();
          }}
        />
      )}
      {!pantry.isPending && !pantry.isError && pantry.data.length === 0 && (
        <p className="text-body-sm text-secondary">No pantry items recorded yet.</p>
      )}
      {!pantry.isPending && !pantry.isError && pantry.data.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {pantry.data.map((item) => (
            <li key={item.id}>
              <ListRow
                title={item.itemName}
                description={item.quantityNote ?? undefined}
                onSelect={() => {
                  pick('pantry', item.itemName);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const dealsContent = (
    <section aria-labelledby="match-deals-heading" className="flex flex-col gap-3 pt-2">
      <h3 id="match-deals-heading" className="text-title-small font-semibold text-primary">
        Deals
      </h3>
      <form onSubmit={handleSearch} className="flex gap-2">
        <TextField
          label="Search deals"
          className="flex-1"
          value={draftQuery}
          onChange={(event) => {
            setDraftQuery(event.target.value);
          }}
        />
        <Button type="submit" variant="secondary" className="self-end">
          Search
        </Button>
      </form>
      {deals.isPending && <SkeletonRows label="Searching deals" rows={2} />}
      {deals.isError && (
        <ErrorState
          message="Couldn't search deals. Try again."
          onRetry={() => {
            void deals.refetch();
          }}
        />
      )}
      {!deals.isPending && !deals.isError && deals.data.deals.length === 0 && (
        <p className="text-body-sm text-secondary">
          No current deals match "{dealQuery}" at your favorite merchants.
        </p>
      )}
      {!deals.isPending && !deals.isError && deals.data.deals.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {deals.data.deals.map((deal) => (
            <li key={deal.id}>
              <ListRow
                title={deal.name}
                description={`${deal.merchantName} — ${deal.displayPrice}`}
                onSelect={() => {
                  pick('deal', deal.name);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <ModalBottomSheet open onOpenChange={onOpenChange} title={`Match "${ingredientName}" to…`}>
      <div className="flex flex-col gap-3 px-4 pb-6">
        <SegmentedControl
          label="Match source"
          value={tab}
          onValueChange={(val) => {
            setTab(val as 'pantry' | 'deals');
          }}
          segments={[
            { value: 'pantry', label: 'Pantry' },
            { value: 'deals', label: 'Deals' },
          ]}
        />
        {tab === 'pantry' ? pantryContent : dealsContent}
      </div>
    </ModalBottomSheet>
  );
}
