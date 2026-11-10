import { z } from 'zod';

/**
 * Barcodes and Open Food Facts product cache schemas.
 * Standard UPC-A, EAN-13, EAN-8, Code 128, etc.
 */

export const barcodeSchema = z
  .string()
  .trim()
  .min(3, 'Barcode must be at least 3 characters.')
  .max(64, 'Barcode must not exceed 64 characters.')
  .regex(/^[A-Za-z0-9_-]+$/, 'Barcode must be alphanumeric.');

export const barcodeParamsSchema = z.object({
  barcode: barcodeSchema,
});

export const barcodeProductSchema = z.object({
  barcode: z.string(),
  productName: z.string().nullable(),
  brands: z.string().nullable(),
  quantity: z.string().nullable(),
  imageUrl: z.string().nullable(),
});
export type BarcodeProduct = z.infer<typeof barcodeProductSchema>;
