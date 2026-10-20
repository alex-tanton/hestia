import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  dealSearchResponseSchema,
  flyerItemsResponseSchema,
  flyersResponseSchema,
  merchantsResponseSchema,
  shoppingListListSchema,
  type AddFavoriteStoreRequest,
  type DealScope,
  type DealSearchResponse,
  type DealSort,
  type FlyerItemsResponse,
  type FlyersResponse,
  type MerchantsResponse,
  type ShoppingList,
} from '@hearth/shared';
import { useApi } from './api-context.tsx';
import { HOUSEHOLD_SCOPE } from './keys.ts';

/*
 * Deals, flyers, merchants, favorite stores, and the one list write a deal screen makes
 * (Technical Architecture, "API surface › Deals"). Keys are household-scoped and start with
 * `HOUSEHOLD_SCOPE`, so switching household removes them with everything else.
 */

export const dealKeys = {
  search: (householdId: string, query: DealSearchParams) =>
    [...HOUSEHOLD_SCOPE, householdId, 'deals', 'search', query] as const,
  flyers: (householdId: string, scope: DealScope) =>
    [...HOUSEHOLD_SCOPE, householdId, 'flyers', scope] as const,
  flyerItems: (householdId: string, flyerId: string, query: FlyerItemsParams) =>
    [...HOUSEHOLD_SCOPE, householdId, 'flyers', flyerId, 'items', query] as const,
  merchants: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'merchants'] as const,
  favoriteStores: (householdId: string) =>
    [...HOUSEHOLD_SCOPE, householdId, 'favorite-stores'] as const,
  /** The lists index, which the add-to-list picker reads (Design › Screens › 7 owns the screen). */
  lists: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'lists'] as const,
};

export interface DealSearchParams {
  q: string;
  scope: DealScope;
  /** Merchant ids; empty means every store in scope. */
  stores: readonly string[];
  category: string | undefined;
  minPriceCents: number | undefined;
  maxPriceCents: number | undefined;
  sort: DealSort;
  page: number;
}

export interface FlyerItemsParams {
  category: string | undefined;
  sort: DealSort;
  page: number;
}

function queryString(entries: Readonly<Record<string, string | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const rendered = params.toString();
  return rendered === '' ? '' : `?${rendered}`;
}

const cents = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

export function useDealSearch(
  householdId: string | undefined,
  params: DealSearchParams,
): UseQueryResult<DealSearchResponse> {
  const api = useApi();
  const search = queryString({
    q: params.q,
    scope: params.scope,
    stores: params.stores.join(','),
    category: params.category,
    minPrice: cents(params.minPriceCents),
    maxPrice: cents(params.maxPriceCents),
    sort: params.sort,
    page: String(params.page),
  });

  return useQuery({
    queryKey: dealKeys.search(householdId ?? '', params),
    enabled: householdId !== undefined && params.q.trim() !== '',
    // A failed fetch with a warm cache answers 200 and `stale`, so a retry here would only ever
    // repeat a 503 the service already decided it could not serve.
    retry: false,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/deals/search${search}`,
        schema: dealSearchResponseSchema,
        signal,
      }),
  });
}

export function useFlyers(
  householdId: string | undefined,
  scope: DealScope,
): UseQueryResult<FlyersResponse> {
  const api = useApi();
  return useQuery({
    queryKey: dealKeys.flyers(householdId ?? '', scope),
    enabled: householdId !== undefined,
    retry: false,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/flyers${queryString({ scope })}`,
        schema: flyersResponseSchema,
        signal,
      }),
  });
}

export function useFlyerItems(
  householdId: string | undefined,
  flyerId: string | undefined,
  params: FlyerItemsParams,
): UseQueryResult<FlyerItemsResponse> {
  const api = useApi();
  const search = queryString({
    category: params.category,
    sort: params.sort,
    page: String(params.page),
  });

  return useQuery({
    queryKey: dealKeys.flyerItems(householdId ?? '', flyerId ?? '', params),
    enabled: householdId !== undefined && flyerId !== undefined,
    retry: false,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/flyers/${String(flyerId)}/items${search}`,
        schema: flyerItemsResponseSchema,
        signal,
      }),
  });
}

/** Every merchant with an active flyer near the postal code, each flagged as a favorite or not. */
export function useMerchants(householdId: string | undefined): UseQueryResult<MerchantsResponse> {
  const api = useApi();
  return useQuery({
    queryKey: dealKeys.merchants(householdId ?? ''),
    enabled: householdId !== undefined,
    retry: false,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/merchants`,
        schema: merchantsResponseSchema,
        signal,
      }),
  });
}

/**
 * Favorites scope the deal search, the flyer list, and the daily refresh, so changing one
 * invalidates every deals query for the household along with the two store lists.
 */
function useFavoritesWriter(householdId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dealKeys.favoriteStores(householdId) }),
      queryClient.invalidateQueries({ queryKey: dealKeys.merchants(householdId) }),
      queryClient.invalidateQueries({
        queryKey: [...HOUSEHOLD_SCOPE, householdId, 'deals'],
      }),
      queryClient.invalidateQueries({ queryKey: [...HOUSEHOLD_SCOPE, householdId, 'flyers'] }),
    ]);
  };
}

/** Any member may edit the household's favorite stores (Design › Screens › 4). */
export function useAddFavoriteStore(
  householdId: string,
): UseMutationResult<void, Error, AddFavoriteStoreRequest> {
  const api = useApi();
  const invalidate = useFavoritesWriter(householdId);
  return useMutation({
    mutationFn: (body: AddFavoriteStoreRequest) =>
      api.send({ method: 'POST', path: `/api/households/${householdId}/favorite-stores`, body }),
    onSuccess: invalidate,
  });
}

/** Takes the **merchant id**, which is what the merchant and flyer rows carry. */
export function useRemoveFavoriteStore(
  householdId: string,
): UseMutationResult<void, Error, string> {
  const api = useApi();
  const invalidate = useFavoritesWriter(householdId);
  return useMutation({
    mutationFn: (merchantId: string) =>
      api.send({
        method: 'DELETE',
        path: `/api/households/${householdId}/favorite-stores/${encodeURIComponent(merchantId)}`,
      }),
    onSuccess: invalidate,
  });
}

/** The household's active lists, read by the add-to-list picker on a deal card. */
export function useShoppingLists(householdId: string | undefined): UseQueryResult<ShoppingList[]> {
  const api = useApi();
  return useQuery({
    queryKey: dealKeys.lists(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/lists`,
        schema: shoppingListListSchema,
        signal,
      }),
  });
}

export interface AddDealToList {
  listId: string;
  dealId: string;
}

const heldDealAdds = new WeakMap<QueryClient, Map<string, string>>();

function heldDealAddIds(queryClient: QueryClient): Map<string, string> {
  let ids = heldDealAdds.get(queryClient);
  if (ids === undefined) {
    ids = new Map();
    heldDealAdds.set(queryClient, ids);
  }
  return ids;
}

/**
 * Adding a deal to a list sends the deal's id and nothing else: the service reads the `deal` row
 * and takes the snapshot itself, so a client can never invent a price (Technical Architecture,
 * "API surface"). The row id is client-generated, which is what makes a replayed add a no-op
 * (Handoff non-negotiable 9), and it is held across a retry: a tap after an error carries the id
 * of the add that failed, and only a success starts the next add with a fresh one.
 */
export function useAddDealToList(
  householdId: string,
): UseMutationResult<void, Error, AddDealToList> {
  const api = useApi();
  const queryClient = useQueryClient();
  // A response lost after the request landed shows an error, and the next tap must carry the same
  // id so the service's `on conflict (id) do nothing` makes it a replay rather than a second
  // item. Ids are held per list and deal because the primary key is the id alone: an id reused
  // for another list would be swallowed while the toast says "Added". Only a success starts the
  // next add; nothing is cleared on an error. Ids are held per QueryClient, not per hook
  // instance, so a retry survives the card unmounting (a filter change, paging, navigating away
  // and back).
  return useMutation({
    mutationFn: ({ listId, dealId }: AddDealToList) => {
      const held = heldDealAddIds(queryClient);
      const key = `${listId}:${dealId}`;
      const id = held.get(key) ?? crypto.randomUUID();
      held.set(key, id);
      return api.send({
        method: 'POST',
        path: `/api/lists/${listId}/items`,
        body: { source: 'from_deal', id, dealId },
      });
    },
    onSuccess: async (_data, { listId, dealId }) => {
      heldDealAddIds(queryClient).delete(`${listId}:${dealId}`);
      await queryClient.invalidateQueries({ queryKey: dealKeys.lists(householdId) });
    },
  });
}
