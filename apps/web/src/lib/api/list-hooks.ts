import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  pantryItemSchema,
  pantryListSchema,
  shoppingListDetailSchema,
  shoppingListListSchema,
  type CreatePantryItemRequest,
  type PantryItem,
  type ShoppingList,
  type ShoppingListDetail,
  type UpdatePantryItemRequest,
} from '@hearth/shared';
import {
  listWriteMutationKey,
  listWriteScope,
  type AddListItemVariables,
  type UpdateListItemVariables,
} from '../offline/write-queue.ts';
import { useApi } from './api-context.tsx';
import { queryKeys } from './keys.ts';

/*
 * Shopping lists and the pantry (Technical Architecture, "API surface"). Server state lives in
 * TanStack Query and is never copied into component state (Engineering Practices › Frontend
 * patterns) — realtime and the write queue both go through the cache rather than around it.
 *
 * Every item write answers with the whole list, subtotals and unpriced counts already computed,
 * so the response is written straight into the detail query and the client never does money
 * arithmetic.
 */

export function useShoppingLists(
  householdId: string | undefined,
  archived = false,
): UseQueryResult<ShoppingList[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.lists(householdId ?? '', archived),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/lists${archived ? '?archived=true' : ''}`,
        schema: shoppingListListSchema,
        signal,
      }),
  });
}

export function useShoppingList(
  householdId: string | undefined,
  listId: string | undefined,
): UseQueryResult<ShoppingListDetail> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.list(householdId ?? '', listId ?? ''),
    enabled: householdId !== undefined && listId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/lists/${String(listId)}`,
        schema: shoppingListDetailSchema,
        signal,
      }),
  });
}

export function usePantry(householdId: string | undefined): UseQueryResult<PantryItem[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.pantry(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/pantry`,
        schema: pantryListSchema,
        signal,
      }),
  });
}

/** Both list views plus the detail, after a change that could have moved a list between them. */
function useListInvalidator(householdId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.lists(householdId, false) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.lists(householdId, true) }),
    ]);
  };
}

export function useCreateList(
  householdId: string,
): UseMutationResult<ShoppingListDetail, Error, string> {
  const api = useApi();
  const invalidate = useListInvalidator(householdId);
  return useMutation({
    mutationFn: (name: string) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/lists`,
        body: { name },
        schema: shoppingListDetailSchema,
      }),
    onSuccess: invalidate,
  });
}

export interface RenameListInput {
  listId: string;
  name: string;
}

export function useRenameList(
  householdId: string,
): UseMutationResult<ShoppingListDetail, Error, RenameListInput> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useListInvalidator(householdId);
  return useMutation({
    mutationFn: ({ listId, name }: RenameListInput) =>
      api.request({
        method: 'PATCH',
        path: `/api/lists/${listId}`,
        body: { name },
        schema: shoppingListDetailSchema,
      }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.list(householdId, detail.id), detail);
      await invalidate();
    },
  });
}

export interface ArchiveListInput {
  listId: string;
  /** Absolute, like every other write: archive or unarchive, never a toggle. */
  isArchived: boolean;
}

export function useSetListArchived(
  householdId: string,
): UseMutationResult<ShoppingListDetail, Error, ArchiveListInput> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useListInvalidator(householdId);
  return useMutation({
    mutationFn: ({ listId, isArchived }: ArchiveListInput) =>
      api.request({
        method: 'POST',
        path: `/api/lists/${listId}/${isArchived ? 'archive' : 'unarchive'}`,
        schema: shoppingListDetailSchema,
      }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.list(householdId, detail.id), detail);
      await invalidate();
    },
  });
}

export function useDeleteList(householdId: string): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useListInvalidator(householdId);
  return useMutation({
    mutationFn: (listId: string) => api.send({ method: 'DELETE', path: `/api/lists/${listId}` }),
    onSuccess: async (_result, listId) => {
      queryClient.removeQueries({ queryKey: queryKeys.list(householdId, listId) });
      await invalidate();
    },
  });
}

/**
 * Deleting an item is not queueable (Requirements › Offline behavior lists add, check, uncheck,
 * and edit and nothing else), so it is an ordinary online mutation.
 */
export function useDeleteListItem(
  householdId: string,
  listId: string,
): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api.send({ method: 'DELETE', path: `/api/lists/${listId}/items/${itemId}` }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.list(householdId, listId) });
    },
  });
}

export function useAddBoughtToPantry(
  householdId: string,
  listId: string,
): UseMutationResult<PantryItem[], Error, void> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.request({
        method: 'POST',
        path: `/api/lists/${listId}/add-bought-to-pantry`,
        schema: pantryListSchema,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pantry(householdId) });
    },
  });
}

/*
 * The two queueable writes. Neither names a `mutationFn`: it comes from the defaults registered
 * with `setMutationDefaults`, which is what lets a paused write resume after a reload
 * (Engineering Practices › The write queue). The scope makes writes to one list run one at a
 * time, in the order they were made.
 */

export function useAddListItem(
  listId: string,
): UseMutationResult<ShoppingListDetail, Error, AddListItemVariables> {
  return useMutation({
    mutationKey: listWriteMutationKey(listId, 'add-item'),
    scope: listWriteScope(listId),
  });
}

export function useUpdateListItem(
  listId: string,
): UseMutationResult<ShoppingListDetail, Error, UpdateListItemVariables> {
  return useMutation({
    mutationKey: listWriteMutationKey(listId, 'update-item'),
    scope: listWriteScope(listId),
  });
}

export function useCreatePantryItem(
  householdId: string,
): UseMutationResult<PantryItem, Error, CreatePantryItemRequest> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePantryItemRequest) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/pantry`,
        body,
        schema: pantryItemSchema,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pantry(householdId) });
    },
  });
}

export interface UpdatePantryItemInput extends UpdatePantryItemRequest {
  itemId: string;
}

export function useUpdatePantryItem(
  householdId: string,
): UseMutationResult<PantryItem, Error, UpdatePantryItemInput> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }: UpdatePantryItemInput) =>
      api.request({
        method: 'PATCH',
        path: `/api/pantry/${itemId}`,
        body,
        schema: pantryItemSchema,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pantry(householdId) });
    },
  });
}

export function useDeletePantryItem(householdId: string): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.send({ method: 'DELETE', path: `/api/pantry/${itemId}` }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pantry(householdId) });
    },
  });
}
