import { Search } from 'lucide-react';
import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { useDealSearch, type DealSearchParams } from '../../lib/api/deals.ts';
import { useCreateMatchOverride } from '../../lib/api/meal-hooks.ts';
import { usePantry } from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { Sheet } from '../ui/Sheet.tsx';
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
  // Only a favorite-merchant deal counts toward a recipe's "on sale" bucket, so this is the same
  // scope the readiness matcher itself honors.
  scope: 'favorites',
  stores: [],
  category: undefined,
  minPriceCents: undefined,
  maxPriceCents: undefined,
  sort: 'relevance',
  page: 1,
};

/**
 * "Match to…" picks a pantry item or current deal and stores a force-match override. There is no
 * endpoint that lists every current deal (the API only offers a keyword search), so the deal half
 * of this picker searches the household's favorite-merchant deals by keyword — the same search
 * deal search itself uses — rather than inventing a new listing endpoint. It starts from the
 * ingredient's own name, since
 * that is usually what the shopper typed to name the ingredient in the first place, but the field
 * is editable: the ingredient's name is only ever a starting guess, and the deal a member actually
 * wants may share none of its tokens (matching needs 0.85 token
 * similarity, which a real product name often misses entirely).
 */
export function MatchToSheet({
  householdId,
  recipeId,
  ingredientName,
  onOpenChange,
}: MatchToSheetProps): ReactElement {
  const toast = useToast();
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
            message: userMessage(error, { fallback: `Couldn't save that match. Try again.` }),
          });
        },
      },
    );
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={`Match "${ingredientName}" to…`}>
      <div className="flex flex-col gap-4 px-4">
        <section aria-labelledby="match-pantry-heading" className="flex flex-col gap-2">
          <h3 id="match-pantry-heading" className="text-h3 text-primary">
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
          {pantry.data?.length === 0 && (
            <p className="text-body-sm text-secondary">Nothing in the pantry yet.</p>
          )}
          {pantry.data && pantry.data.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {pantry.data.map((item) => (
                <li key={item.id}>
                  <ListRow
                    title={item.itemName}
                    onSelect={() => {
                      pick('pantry', item.itemName);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="match-deals-heading" className="flex flex-col gap-2">
          <h3 id="match-deals-heading" className="text-h3 text-primary">
            Current deals
          </h3>
          <form role="search" noValidate className="flex items-end gap-2" onSubmit={handleSearch}>
            <TextField
              label="Search deals"
              type="search"
              className="min-w-0 flex-1"
              value={draftQuery}
              onChange={(event) => {
                setDraftQuery(event.target.value);
              }}
            />
            <Button type="submit" variant="secondary">
              <Search aria-hidden size={20} strokeWidth={1.5} />
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
          {deals.data?.deals.length === 0 && (
            <p className="text-body-sm text-secondary">
              No current deals match "{dealQuery}" at your favorite stores.
            </p>
          )}
          {deals.data && deals.data.deals.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {deals.data.deals.map((deal) => (
                <li key={deal.id}>
                  <ListRow
                    title={deal.name}
                    description={deal.merchantName}
                    onSelect={() => {
                      pick('deal', deal.name);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}
