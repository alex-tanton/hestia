import { barcodeProductSchema, type BarcodeProduct } from '@hestia/shared';
import type { ApiClient } from './client.ts';

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
