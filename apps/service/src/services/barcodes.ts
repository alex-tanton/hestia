import type { Kysely } from 'kysely';
import type { BarcodeProduct } from '@hestia/shared';
import type { Database } from '../db.js';

export const OPEN_FOOD_FACTS_TIMEOUT_MS = 5000;

export async function lookupBarcode(
  db: Kysely<Database>,
  barcode: string,
  ownerEmail: string,
  fetchFn: typeof fetch = fetch,
): Promise<BarcodeProduct | null> {
  // 1. Check Postgres cache first
  const cached = await db
    .selectFrom('barcode_products')
    .select(['barcode', 'product_name', 'brands', 'quantity', 'image_url'])
    .where('barcode', '=', barcode)
    .executeTakeFirst();

  if (cached) {
    return {
      barcode: cached.barcode,
      productName: cached.product_name,
      brands: cached.brands,
      quantity: cached.quantity,
      imageUrl: cached.image_url,
    };
  }

  // 2. Fetch from Open Food Facts API v3
  const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,quantity,image_front_url`;
  const userAgent = `Hestia/2.1 (https://hestia.aberrance.app; mailto:${ownerEmail})`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, OPEN_FOOD_FACTS_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetchFn(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      status?: string;
      product?: {
        product_name?: string;
        brands?: string;
        quantity?: string;
        image_front_url?: string;
      };
    };

    if ((data.status !== 'success' && data.status !== 'success_with_warnings') || !data.product) {
      return null;
    }

    const cleanText = (value: string | undefined): string | null => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    };

    const productName = cleanText(data.product.product_name);
    const brands = cleanText(data.product.brands);
    const quantity = cleanText(data.product.quantity);
    const rawImageUrl = cleanText(data.product.image_front_url);
    const imageUrl =
      rawImageUrl && /^https?:\/\//i.test(rawImageUrl)
        ? rawImageUrl.replace(/^http:\/\//i, 'https://')
        : null;

    // 3. Cache in database
    await db
      .insertInto('barcode_products')
      .values({
        barcode,
        product_name: productName,
        brands,
        quantity,
        image_url: imageUrl,
        raw_payload: JSON.stringify(data),
      })
      .onConflict((oc) => oc.column('barcode').doNothing())
      .execute();

    return {
      barcode,
      productName,
      brands,
      quantity,
      imageUrl,
    };
  } catch {
    return null;
  }
}
