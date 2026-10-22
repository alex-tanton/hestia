import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import {
  matchOverrideSchema,
  mealPlanEntrySchema,
  mealPlanWeekResponseSchema,
  parseRecipeResponseSchema,
  recipeDetailSchema,
  recipeListResponseSchema,
  shoppingListDetailSchema,
  suggestionsResponseSchema,
  type CreateMatchOverrideRequest,
  type CreateMealPlanEntryRequest,
  type CreateRecipeRequest,
  type MatchOverride,
  type MealPlanEntry,
  type MealPlanWeekResponse,
  type ParseRecipeResponse,
  type RecipeDetail,
  type RecipeListResponse,
  type ShoppingListDetail,
  type SuggestionsResponse,
  type UpdateRecipeRequest,
} from '@hearth/shared';
import { useApi, useFlushPersister } from './api-context.tsx';
import { HOUSEHOLD_SCOPE, queryKeys } from './keys.ts';

/*
 * Recipes, readiness, the week planner, and match overrides. None of these writes are
 * offline-queueable (only list-item and, from v1.3, chore/errand writes queue), so every mutation
 * here is an ordinary online one, disabled by the screen while offline rather than going through
 * the write queue.
 */

export function useRecipes(
  householdId: string | undefined,
  page = 1,
): UseQueryResult<RecipeListResponse> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.recipes(householdId ?? '', page),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/recipes?page=${String(page)}`,
        schema: recipeListResponseSchema,
        signal,
      }),
  });
}

export function useRecipeDetail(
  householdId: string | undefined,
  recipeId: string | undefined,
): UseQueryResult<RecipeDetail> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.recipe(householdId ?? '', recipeId ?? ''),
    enabled: householdId !== undefined && recipeId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/recipes/${String(recipeId)}`,
        schema: recipeDetailSchema,
        signal,
      }),
  });
}

export function useSuggestions(
  householdId: string | undefined,
): UseQueryResult<SuggestionsResponse> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.suggestions(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/suggestions`,
        schema: suggestionsResponseSchema,
        signal,
      }),
  });
}

export function useMealPlanWeek(
  householdId: string | undefined,
  week: string | undefined,
): UseQueryResult<MealPlanWeekResponse> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.mealPlan(householdId ?? '', week ?? ''),
    enabled: householdId !== undefined && week !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/meal-plan?week=${String(week)}`,
        schema: mealPlanWeekResponseSchema,
        signal,
      }),
  });
}

/** Every recipe-list page plus suggestions, which both carry readiness for the same recipes. */
function useRecipeInvalidator(householdId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...HOUSEHOLD_SCOPE, householdId, 'recipes'],
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions(householdId) }),
    ]);
  };
}

/** Every meal-plan week query for the household, regardless of which Sunday it names. */
function invalidateMealPlan(queryClient: ReturnType<typeof useQueryClient>, householdId: string) {
  return queryClient.invalidateQueries({
    queryKey: [...HOUSEHOLD_SCOPE, householdId, 'meal-plan'],
  });
}

export function useCreateRecipe(
  householdId: string,
): UseMutationResult<RecipeDetail, Error, CreateRecipeRequest> {
  const api = useApi();
  const invalidate = useRecipeInvalidator(householdId);
  return useMutation({
    mutationFn: (body: CreateRecipeRequest) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/recipes`,
        body,
        schema: recipeDetailSchema,
      }),
    onSuccess: invalidate,
  });
}

export interface UpdateRecipeInput {
  recipeId: string;
  body: UpdateRecipeRequest;
}

export function useUpdateRecipe(
  householdId: string,
): UseMutationResult<RecipeDetail, Error, UpdateRecipeInput> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useRecipeInvalidator(householdId);
  return useMutation({
    mutationFn: ({ recipeId, body }: UpdateRecipeInput) =>
      api.request({
        method: 'PATCH',
        path: `/api/recipes/${recipeId}`,
        body,
        schema: recipeDetailSchema,
      }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.recipe(householdId, detail.id), detail);
      await invalidate();
    },
  });
}

export function useDeleteRecipe(householdId: string): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useRecipeInvalidator(householdId);
  return useMutation({
    mutationFn: (recipeId: string) =>
      api.send({ method: 'DELETE', path: `/api/recipes/${recipeId}` }),
    onSuccess: async (_result, recipeId) => {
      queryClient.removeQueries({ queryKey: queryKeys.recipe(householdId, recipeId) });
      // A deleted recipe's meal-plan entries keep their snapshot title, which only the meal-plan
      // response itself carries.
      await Promise.all([invalidate(), invalidateMealPlan(queryClient, householdId)]);
    },
  });
}

export function useParseRecipe(
  householdId: string,
): UseMutationResult<ParseRecipeResponse, Error, string> {
  const api = useApi();
  return useMutation({
    // Never persists: the client reviews and edits the result.
    mutationFn: (url: string) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/recipes/parse`,
        body: { url },
        schema: parseRecipeResponseSchema,
      }),
  });
}

/**
 * After adding to a list: the list's own detail and its counts on the index both moved.
 *
 * This is the one moment "add missing to list" writes fresh data straight into the cache rather
 * than only invalidating it (so the add-to-list sheet's own toast reflects the true new state
 * without a refetch round trip), which means the regular query-cache persister — throttled to
 * 1000ms so a busy screen does not hammer IndexedDB on every settle (`persist.ts`) — has not
 * necessarily saved it yet. A reload that lands inside that window would otherwise restore the
 * list as it was *before* this write and, since the restored snapshot is still within its own
 * staleTime, show that stale state indefinitely rather than refetching (journey 4, "lists exactly
 * what is missing": the picker's own list, visited empty right after creation, is exactly such a
 * case). `flushPersister` is the same unthrottled, second persister the write queue uses for the
 * identical reason — here it makes a just-completed,
 * already-successful write durable immediately rather than leaving the index down to the
 * throttle's next tick.
 */
function useListWriteEffects(): (householdId: string, detail: ShoppingListDetail) => void {
  const queryClient = useQueryClient();
  const flushPersister = useFlushPersister();
  return (householdId, detail) => {
    queryClient.setQueryData(queryKeys.list(householdId, detail.id), detail);
    void queryClient.invalidateQueries({ queryKey: queryKeys.lists(householdId, false) });
    if (flushPersister) void persistQueryClientSave({ queryClient, persister: flushPersister });
  };
}

export interface AddRecipeToListInput {
  recipeId: string;
  listId: string;
}

export function useAddRecipeToList(
  householdId: string,
): UseMutationResult<ShoppingListDetail, Error, AddRecipeToListInput> {
  const api = useApi();
  const onListWrite = useListWriteEffects();
  return useMutation({
    mutationFn: ({ recipeId, listId }: AddRecipeToListInput) =>
      api.request({
        method: 'POST',
        path: `/api/recipes/${recipeId}/add-to-list`,
        body: { listId },
        schema: shoppingListDetailSchema,
      }),
    onSuccess: (detail) => {
      onListWrite(householdId, detail);
    },
  });
}

export function useCreateMealPlanEntry(
  householdId: string,
): UseMutationResult<MealPlanEntry, Error, CreateMealPlanEntryRequest> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMealPlanEntryRequest) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/meal-plan`,
        body,
        schema: mealPlanEntrySchema,
      }),
    onSuccess: async () => {
      await invalidateMealPlan(queryClient, householdId);
    },
  });
}

export function useDeleteMealPlanEntry(
  householdId: string,
): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api.send({ method: 'DELETE', path: `/api/meal-plan/${entryId}` }),
    onSuccess: async () => {
      await invalidateMealPlan(queryClient, householdId);
    },
  });
}

export interface AddMealToListInput {
  entryId: string;
  listId: string;
}

export function useAddMealToList(
  householdId: string,
): UseMutationResult<ShoppingListDetail, Error, AddMealToListInput> {
  const api = useApi();
  const onListWrite = useListWriteEffects();
  return useMutation({
    mutationFn: ({ entryId, listId }: AddMealToListInput) =>
      api.request({
        method: 'POST',
        path: `/api/meal-plan/${entryId}/add-to-list`,
        body: { listId },
        schema: shoppingListDetailSchema,
      }),
    onSuccess: (detail) => {
      onListWrite(householdId, detail);
    },
  });
}

export interface AddWeekToListInput {
  week: string;
  listId: string;
}

export function useAddWeekToList(
  householdId: string,
): UseMutationResult<ShoppingListDetail, Error, AddWeekToListInput> {
  const api = useApi();
  const onListWrite = useListWriteEffects();
  return useMutation({
    mutationFn: (body: AddWeekToListInput) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/meal-plan/add-to-list`,
        body,
        schema: shoppingListDetailSchema,
      }),
    onSuccess: (detail) => {
      onListWrite(householdId, detail);
    },
  });
}

/** A hint for cache invalidation only; never sent to the server. */
export interface CreateMatchOverrideInput {
  request: CreateMatchOverrideRequest;
  recipeId: string;
}

function useOverrideInvalidator(householdId: string): (recipeId: string) => Promise<void> {
  const queryClient = useQueryClient();
  const invalidateRecipes = useRecipeInvalidator(householdId);
  return async (recipeId: string) => {
    // An override can move any recipe's bucket assignment, but it is corrected from one
    // recipe's breakdown, so that recipe's own detail is refetched too (an override applies to
    // every recipe in the household).
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.recipe(householdId, recipeId) }),
      invalidateRecipes(),
    ]);
  };
}

export function useCreateMatchOverride(
  householdId: string,
): UseMutationResult<MatchOverride, Error, CreateMatchOverrideInput> {
  const api = useApi();
  const invalidate = useOverrideInvalidator(householdId);
  return useMutation({
    mutationFn: ({ request }: CreateMatchOverrideInput) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/match-overrides`,
        body: request,
        schema: matchOverrideSchema,
      }),
    onSuccess: async (_override, variables) => {
      await invalidate(variables.recipeId);
    },
  });
}

export interface DeleteMatchOverrideInput {
  overrideId: string;
  recipeId: string;
}

export function useDeleteMatchOverride(
  householdId: string,
): UseMutationResult<void, Error, DeleteMatchOverrideInput> {
  const api = useApi();
  const invalidate = useOverrideInvalidator(householdId);
  return useMutation({
    mutationFn: ({ overrideId }: DeleteMatchOverrideInput) =>
      api.send({ method: 'DELETE', path: `/api/match-overrides/${overrideId}` }),
    onSuccess: async (_result, variables) => {
      await invalidate(variables.recipeId);
    },
  });
}
