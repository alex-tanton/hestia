import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  choreDetailSchema,
  choreListSchema,
  errandListSchema,
  errandSchema,
  type Chore,
  type ChoreDetail,
  type CreateChoreRequest,
  type CreateErrandRequest,
  type Errand,
  type UpdateChoreRequest,
  type UpdateErrandRequest,
} from '@hestia/shared';
import { useApi } from './api-context.tsx';
import { queryKeys } from './keys.ts';

/*
 * Chores and errands. Chore completion and marking an errand done are queueable
 * (`lib/offline/chore-errand-writes.ts`); every other mutation here is an ordinary online call,
 * disabled by the screen while offline, the same convention `meal-hooks.ts` follows for recipes and
 * the week planner.
 */

export function useChores(householdId: string | undefined): UseQueryResult<Chore[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.chores(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/chores`,
        schema: choreListSchema,
        signal,
      }),
  });
}

export function useChoreDetail(
  householdId: string | undefined,
  choreId: string | undefined,
): UseQueryResult<ChoreDetail> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.chore(householdId ?? '', choreId ?? ''),
    enabled: householdId !== undefined && choreId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/chores/${String(choreId)}`,
        schema: choreDetailSchema,
        signal,
      }),
  });
}

function useChoreInvalidator(householdId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.chores(householdId) });
}

export function useCreateChore(
  householdId: string,
): UseMutationResult<ChoreDetail, Error, CreateChoreRequest> {
  const api = useApi();
  const invalidate = useChoreInvalidator(householdId);
  return useMutation({
    mutationFn: (body: CreateChoreRequest) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/chores`,
        body,
        schema: choreDetailSchema,
      }),
    onSuccess: invalidate,
  });
}

export interface UpdateChoreInput {
  choreId: string;
  body: UpdateChoreRequest;
}

export function useUpdateChore(
  householdId: string,
): UseMutationResult<ChoreDetail, Error, UpdateChoreInput> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useChoreInvalidator(householdId);
  return useMutation({
    mutationFn: ({ choreId, body }: UpdateChoreInput) =>
      api.request({
        method: 'PATCH',
        path: `/api/chores/${choreId}`,
        body,
        schema: choreDetailSchema,
      }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.chore(householdId, detail.id), detail);
      await invalidate();
    },
  });
}

export function useDeleteChore(householdId: string): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useChoreInvalidator(householdId);
  return useMutation({
    mutationFn: (choreId: string) => api.send({ method: 'DELETE', path: `/api/chores/${choreId}` }),
    onSuccess: async (_result, choreId) => {
      queryClient.removeQueries({ queryKey: queryKeys.chore(householdId, choreId) });
      await invalidate();
    },
  });
}

export interface DeleteChoreCompletionInput {
  choreId: string;
  completionId: string;
}

/** Undo (the toast's Undo, or history's delete on the most recent completion are the same call). */
export function useDeleteChoreCompletion(
  householdId: string,
): UseMutationResult<void, Error, DeleteChoreCompletionInput> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useChoreInvalidator(householdId);
  return useMutation({
    mutationFn: ({ choreId, completionId }: DeleteChoreCompletionInput) =>
      api.send({ method: 'DELETE', path: `/api/chores/${choreId}/completions/${completionId}` }),
    onSuccess: async (_result, { choreId }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.chore(householdId, choreId) });
      await invalidate();
    },
  });
}

export function useErrands(householdId: string | undefined): UseQueryResult<Errand[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.errands(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/errands`,
        schema: errandListSchema,
        signal,
      }),
  });
}

function useErrandInvalidator(householdId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.errands(householdId) });
}

export function useCreateErrand(
  householdId: string,
): UseMutationResult<Errand, Error, CreateErrandRequest> {
  const api = useApi();
  const invalidate = useErrandInvalidator(householdId);
  return useMutation({
    mutationFn: (body: CreateErrandRequest) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/errands`,
        body,
        schema: errandSchema,
      }),
    onSuccess: invalidate,
  });
}

export interface UpdateErrandInput {
  errandId: string;
  body: UpdateErrandRequest;
}

export function useUpdateErrand(
  householdId: string,
): UseMutationResult<Errand, Error, UpdateErrandInput> {
  const api = useApi();
  const invalidate = useErrandInvalidator(householdId);
  return useMutation({
    mutationFn: ({ errandId, body }: UpdateErrandInput) =>
      api.request({
        method: 'PATCH',
        path: `/api/errands/${errandId}`,
        body,
        schema: errandSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteErrand(householdId: string): UseMutationResult<void, Error, string> {
  const api = useApi();
  const invalidate = useErrandInvalidator(householdId);
  return useMutation({
    mutationFn: (errandId: string) =>
      api.send({ method: 'DELETE', path: `/api/errands/${errandId}` }),
    onSuccess: invalidate,
  });
}
