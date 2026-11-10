import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { barcodeProductSchema, type BarcodeProduct } from '@hestia/shared';
import { useApi } from './api-context.tsx';
import type { ApiClient } from './client.ts';

export const barcodeKeys = {
  barcode: (code: string) => ['barcodes', code] as const,
};

export async function fetchBarcodeProduct(
  api: ApiClient,
  barcode: string,
  signal?: AbortSignal,
): Promise<BarcodeProduct> {
  return api.request({
    method: 'GET',
    path: `/api/barcodes/${encodeURIComponent(barcode)}`,
    schema: barcodeProductSchema,
    ...(signal ? { signal } : {}),
  });
}

export function useBarcodeProduct(
  barcode: string | null | undefined,
): UseQueryResult<BarcodeProduct> {
  const api = useApi();
  const trimmed = barcode?.trim();
  const isEnabled = Boolean(trimmed && trimmed.length > 0);

  return useQuery({
    queryKey: barcodeKeys.barcode(trimmed ?? ''),
    queryFn: ({ signal }) => fetchBarcodeProduct(api, trimmed ?? '', signal),
    enabled: isEnabled,
    retry: false,
  });
}
