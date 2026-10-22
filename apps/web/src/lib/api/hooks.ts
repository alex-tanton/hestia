import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createdInviteSchema,
  deepHealthResponseSchema,
  departResultSchema,
  departurePreviewSchema,
  householdSchema,
  inviteListSchema,
  memberListSchema,
  profileResponseSchema,
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  type CreateHouseholdRequest,
  type CreatedInvite,
  type DeepHealthResponse,
  type DepartRequest,
  type DepartResult,
  type DeparturePreview,
  type Household,
  type Invite,
  type Member,
  type ProfileResponse,
  type UpdateHouseholdRequest,
  type UpdateProfileRequest,
} from '@hearth/shared';
import { useApi } from './api-context.tsx';
import { HOUSEHOLD_SCOPE, queryKeys } from './keys.ts';

/*
 * Server state lives here and is never copied into component state. `GET /api/users/me` is the
 * single source of the profile, the memberships, the active household, and `isServerOwner`.
 */

export function useProfile(): UseQueryResult<ProfileResponse> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.profile,
    /*
     * Never served from cache without a fresh check behind it. This is the query every
     * household-scoped screen gates on (`AuthenticatedLayout`), and the query cache now survives
     * a full reload (`PersistQueryClientProvider`): with the client default `staleTime` a reload
     * within that window would keep showing a household the caller was just removed from, missing
     * the rule that a removed member loses access immediately by however much of the window was
     * left. The
     * persisted `data` still paints instantly — `staleTime` only decides whether a mount also
     * revalidates — so this costs nothing offline or on a quick reopen; it only removes the window
     * where a reload could still be trusting stale membership.
     */
    staleTime: 0,
    queryFn: ({ signal }) =>
      api.request({ method: 'GET', path: '/api/users/me', schema: profileResponseSchema, signal }),
  });
}

export function useHousehold(householdId: string | undefined): UseQueryResult<Household> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.household(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}`,
        schema: householdSchema,
        signal,
      }),
  });
}

export function useMembers(householdId: string | undefined): UseQueryResult<Member[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.members(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/members`,
        schema: memberListSchema,
        signal,
      }),
  });
}

/** Invites are admin-only, so the query runs only when the caller is the admin. */
export function useInvites(
  householdId: string | undefined,
  isAdmin: boolean,
): UseQueryResult<Invite[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.invites(householdId ?? ''),
    enabled: householdId !== undefined && isAdmin,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/invites`,
        schema: inviteListSchema,
        signal,
      }),
  });
}

export function useDeparturePreview(
  householdId: string,
  userId: string,
): UseQueryResult<DeparturePreview> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.departurePreview(householdId, userId),
    // The preview is the input to an irreversible action, so it is never served from cache.
    staleTime: 0,
    gcTime: 0,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${householdId}/members/${userId}/departure-preview`,
        schema: departurePreviewSchema,
        signal,
      }),
  });
}

export function useDeepHealth(isServerOwner: boolean): UseQueryResult<DeepHealthResponse> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.deepHealth,
    enabled: isServerOwner,
    staleTime: 0,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: '/api/health/deep',
        schema: deepHealthResponseSchema,
        signal,
      }),
  });
}

/** Every mutation that returns a profile writes it straight into the profile query. */
function useProfileWriter(): (profile: ProfileResponse) => void {
  const queryClient = useQueryClient();
  return (profile) => {
    queryClient.setQueryData(queryKeys.profile, profile);
  };
}

export function useUpdateProfile(): UseMutationResult<
  ProfileResponse,
  Error,
  UpdateProfileRequest
> {
  const api = useApi();
  const writeProfile = useProfileWriter();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) =>
      api.request({
        method: 'PATCH',
        path: '/api/users/me',
        body,
        schema: profileResponseSchema,
      }),
    onSuccess: writeProfile,
  });
}

/**
 * Switching household is a full context swap: every household-scoped query is removed, not merely
 * invalidated, so nothing from the previous household can be read from the cache while the new one
 * loads.
 */
export function useSwitchHousehold(): UseMutationResult<ProfileResponse, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (householdId: string) =>
      api.request({
        method: 'PUT',
        path: '/api/users/me/active-household',
        body: { householdId },
        schema: profileResponseSchema,
      }),
    onSuccess: (profile) => {
      queryClient.removeQueries({ queryKey: HOUSEHOLD_SCOPE });
      queryClient.setQueryData(queryKeys.profile, profile);
    },
  });
}

export function useCreateHousehold(): UseMutationResult<Household, Error, CreateHouseholdRequest> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateHouseholdRequest) =>
      api.request({ method: 'POST', path: '/api/households', body, schema: householdSchema }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: HOUSEHOLD_SCOPE });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useJoinHousehold(): UseMutationResult<Household, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenOrCode: string) =>
      api.request({
        method: 'POST',
        path: '/api/households/join',
        body: { tokenOrCode },
        schema: householdSchema,
      }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: HOUSEHOLD_SCOPE });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useUpdateHousehold(
  householdId: string,
): UseMutationResult<Household, Error, UpdateHouseholdRequest> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateHouseholdRequest) =>
      api.request({
        method: 'PATCH',
        path: `/api/households/${householdId}`,
        body,
        schema: householdSchema,
      }),
    onSuccess: async (household) => {
      queryClient.setQueryData(queryKeys.household(householdId), household);
      // The membership list carries the household name the switcher and Settings show.
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useCreateInvite(
  householdId: string,
): UseMutationResult<CreatedInvite, Error, void> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/invites`,
        schema: createdInviteSchema,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invites(householdId) });
    },
  });
}

export function useRevokeInvite(householdId: string): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api.send({
        method: 'DELETE',
        path: `/api/households/${householdId}/invites/${inviteId}`,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invites(householdId) });
    },
  });
}

export function useTransferAdmin(householdId: string): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.send({
        method: 'POST',
        path: `/api/households/${householdId}/transfer-admin`,
        body: { userId },
      }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: HOUSEHOLD_SCOPE });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

/**
 * Reassign-and-depart: leaving for oneself, removing for the admin. Both run the same server
 * transaction, so both drop every cached household and reload the profile.
 */
export function useDepart(
  householdId: string,
  userId: string,
  isSelf: boolean,
): UseMutationResult<DepartResult, Error, DepartRequest> {
  const api = useApi();
  const queryClient = useQueryClient();
  const path = isSelf
    ? `/api/households/${householdId}/leave`
    : `/api/households/${householdId}/members/${userId}/remove`;
  return useMutation({
    mutationFn: (body: DepartRequest) =>
      api.request({ method: 'POST', path, body, schema: departResultSchema }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: HOUSEHOLD_SCOPE });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useChangePassword(): UseMutationResult<void, Error, ChangePasswordRequest> {
  const api = useApi();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      api.send({ method: 'POST', path: '/api/users/me/password', body }),
  });
}

export function useChangeEmail(): UseMutationResult<void, Error, ChangeEmailRequest> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangeEmailRequest) =>
      api.send({ method: 'POST', path: '/api/users/me/email', body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}
