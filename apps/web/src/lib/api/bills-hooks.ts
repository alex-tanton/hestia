import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  billDetailSchema,
  billListSchema,
  billPaymentSchema,
  billSchema,
  subscriptionsResponseSchema,
  type Bill,
  type BillDetail,
  type BillPayment,
  type CreateBillRequest,
  type PayBillRequest,
  type SubscriptionsResponse,
  type UpdateBillPaymentRequest,
  type UpdateBillRequest,
} from '@hearth/shared';
import { useApi } from './api-context.tsx';
import { queryKeys } from './keys.ts';

/*
 * Bills, the payment log, skip, archive, and subscriptions (Technical Architecture › "API surface"
 * — "Bills"). None of these writes are offline-queueable (Engineering Practices › "PWA
 * implementation": only list-item and chore/errand writes queue), so every mutation here is an
 * ordinary online one; the screen disables its controls while offline instead.
 */

export function useBills(householdId: string | undefined): UseQueryResult<Bill[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.bills(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/bills`,
        schema: billListSchema,
        signal,
      }),
  });
}

export function useBill(
  householdId: string | undefined,
  billId: string | undefined,
): UseQueryResult<BillDetail> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.bill(householdId ?? '', billId ?? ''),
    enabled: householdId !== undefined && billId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/bills/${String(billId)}`,
        schema: billDetailSchema,
        signal,
      }),
  });
}

export function useSubscriptions(
  householdId: string | undefined,
): UseQueryResult<SubscriptionsResponse> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.subscriptions(householdId ?? ''),
    enabled: householdId !== undefined,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: `/api/households/${String(householdId)}/subscriptions`,
        schema: subscriptionsResponseSchema,
        signal,
      }),
  });
}

/** Every view a bill can appear in: the list, its own detail, and the subscriptions total. */
function useBillInvalidator(householdId: string): (billId?: string) => Promise<void> {
  const queryClient = useQueryClient();
  return async (billId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.bills(householdId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(householdId) }),
      ...(billId === undefined
        ? []
        : [queryClient.invalidateQueries({ queryKey: queryKeys.bill(householdId, billId) })]),
    ]);
  };
}

export function useCreateHouseholdBill(
  householdId: string,
): UseMutationResult<Bill, Error, CreateBillRequest> {
  const api = useApi();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: (body: CreateBillRequest) =>
      api.request({
        method: 'POST',
        path: `/api/households/${householdId}/bills`,
        body,
        schema: billSchema,
      }),
    onSuccess: () => invalidate(),
  });
}

/** A personal bill belongs to no household, but still shows up in the active household's view. */
export function useCreatePersonalBill(
  householdId: string,
): UseMutationResult<Bill, Error, CreateBillRequest> {
  const api = useApi();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: (body: CreateBillRequest) =>
      api.request({ method: 'POST', path: '/api/users/me/bills', body, schema: billSchema }),
    onSuccess: () => invalidate(),
  });
}

export interface UpdateBillInput {
  billId: string;
  body: UpdateBillRequest;
}

export function useUpdateBill(
  householdId: string,
): UseMutationResult<Bill, Error, UpdateBillInput> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: ({ billId, body }: UpdateBillInput) =>
      api.request({ method: 'PATCH', path: `/api/bills/${billId}`, body, schema: billSchema }),
    onSuccess: async (bill, { billId }) => {
      queryClient.setQueryData(
        queryKeys.bill(householdId, billId),
        (detail: BillDetail | undefined) =>
          detail === undefined ? detail : { ...detail, ...bill },
      );
      await invalidate(billId);
    },
  });
}

export function useDeleteBill(householdId: string): UseMutationResult<void, Error, string> {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: (billId: string) => api.send({ method: 'DELETE', path: `/api/bills/${billId}` }),
    onSuccess: async (_result, billId) => {
      queryClient.removeQueries({ queryKey: queryKeys.bill(householdId, billId) });
      await invalidate();
    },
  });
}

export interface PayBillInput {
  billId: string;
  body?: PayBillRequest;
}

export function usePayBill(
  householdId: string,
): UseMutationResult<BillPayment, Error, PayBillInput> {
  const api = useApi();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: ({ billId, body }: PayBillInput) =>
      api.request({
        method: 'POST',
        path: `/api/bills/${billId}/pay`,
        body: body ?? {},
        schema: billPaymentSchema,
      }),
    onSuccess: async (_payment, { billId }) => {
      await invalidate(billId);
    },
  });
}

export function useSkipBill(householdId: string): UseMutationResult<BillPayment, Error, string> {
  const api = useApi();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: (billId: string) =>
      api.request({ method: 'POST', path: `/api/bills/${billId}/skip`, schema: billPaymentSchema }),
    onSuccess: async (_payment, billId) => {
      await invalidate(billId);
    },
  });
}

export function useArchiveBill(householdId: string): UseMutationResult<Bill, Error, string> {
  const api = useApi();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: (billId: string) =>
      api.request({ method: 'POST', path: `/api/bills/${billId}/archive`, schema: billSchema }),
    onSuccess: async (_bill, billId) => {
      await invalidate(billId);
    },
  });
}

/** "Still using this?" → "Still using": resets the 60-day clock (Requirements › "Subscriptions view"). */
export function useConfirmBillUsage(householdId: string): UseMutationResult<Bill, Error, string> {
  const api = useApi();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: (billId: string) =>
      api.request({
        method: 'POST',
        path: `/api/bills/${billId}/confirm-usage`,
        schema: billSchema,
      }),
    onSuccess: async (_bill, billId) => {
      await invalidate(billId);
    },
  });
}

export interface UpdateBillPaymentInput {
  billId: string;
  paymentId: string;
  body: UpdateBillPaymentRequest;
}

export function useUpdateBillPayment(
  householdId: string,
): UseMutationResult<BillPayment, Error, UpdateBillPaymentInput> {
  const api = useApi();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: ({ billId, paymentId, body }: UpdateBillPaymentInput) =>
      api.request({
        method: 'PATCH',
        path: `/api/bills/${billId}/payments/${paymentId}`,
        body,
        schema: billPaymentSchema,
      }),
    onSuccess: async (_payment, { billId }) => {
      await invalidate(billId);
    },
  });
}

export interface DeleteBillPaymentInput {
  billId: string;
  paymentId: string;
}

export function useDeleteBillPayment(
  householdId: string,
): UseMutationResult<void, Error, DeleteBillPaymentInput> {
  const api = useApi();
  const invalidate = useBillInvalidator(householdId);
  return useMutation({
    mutationFn: ({ billId, paymentId }: DeleteBillPaymentInput) =>
      api.send({ method: 'DELETE', path: `/api/bills/${billId}/payments/${paymentId}` }),
    onSuccess: async (_result, { billId }) => {
      await invalidate(billId);
    },
  });
}
