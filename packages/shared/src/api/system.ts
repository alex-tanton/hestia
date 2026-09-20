import { z } from 'zod';
import { timestampSchema } from './common.js';

/**
 * POST /api/client-error. The PWA scrubs before sending and the service scrubs again, so the
 * limits here only bound what the service has to read.
 */
export const clientErrorRequestSchema = z.object({
  name: z.string().max(200).optional(),
  message: z.string().max(4000),
  route: z.string().max(2000).optional(),
});
export type ClientErrorRequest = z.infer<typeof clientErrorRequestSchema>;

/** GET /api/health */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('ok'),
});

export const recentErrorSchema = z.object({
  fingerprint: z.string(),
  message: z.string(),
  count: z.number().int(),
  firstSeen: timestampSchema,
  lastSeen: timestampSchema,
});

export const merchantSkipRateSchema = z.object({
  merchantId: z.string(),
  merchantName: z.string(),
  fetched: z.number().int(),
  skipped: z.number().int(),
  skipRate: z.number().min(0).max(1),
});
export type MerchantSkipRate = z.infer<typeof merchantSkipRateSchema>;

/** GET /api/health/deep (server owner only): how fresh each job's output is. */
export const deepHealthResponseSchema = z.object({
  newestDealFetchedAt: timestampSchema.nullable(),
  newestNotificationSentAt: timestampSchema.nullable(),
  newestBackupAt: timestampSchema.nullable(),
  recentErrors: z.array(recentErrorSchema),
  merchantSkipRates: z.array(merchantSkipRateSchema),
});
export type DeepHealthResponse = z.infer<typeof deepHealthResponseSchema>;
