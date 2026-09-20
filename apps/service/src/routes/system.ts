import type { FastifyPluginAsync } from 'fastify';
import { clientErrorRequestSchema, type DeepHealthResponse } from '@hearth/shared';
import { parse, type RouteContext } from '../http/context.js';
import { fail } from '../problem.js';
import { buildErrorRecord } from '../services/errors.js';

/** Technical Architecture, "Rate limits". */
export const CLIENT_ERROR_RATE_LIMIT_PER_MINUTE = 10;

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export const systemRoutes: FastifyPluginAsync<{
  ctx: RouteContext;
  openApiDocument: () => unknown;
}> = (app, { ctx, openApiDocument }) => {
  // Public and unauthenticated by design: the PWA reports errors that happen before or without
  // a session. It is limited per IP and scrubbed again here, whatever the PWA already did.
  app.post(
    '/api/client-error',
    {
      bodyLimit: 16 * 1024,
      config: { rateLimit: { max: CLIENT_ERROR_RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const body = parse(clientErrorRequestSchema, request.body);
      await ctx.deps.recordError(buildErrorRecord('web', body));
      return reply.code(204).send();
    },
  );

  app.get('/api/health/deep', async (request): Promise<DeepHealthResponse> => {
    const user = await ctx.authenticate(request);
    if (!ctx.isOwner(user)) throw fail(403, 'Only the server owner can see system health.');
    const [health, backup] = await Promise.all([
      ctx.deps.systemHealth(),
      ctx.deps.newestBackupTime(),
    ]);
    return {
      newestDealFetchedAt: iso(health.newest_deal_fetched_at),
      newestNotificationSentAt: iso(health.newest_notification_sent_at),
      newestBackupAt: iso(backup),
      recentErrors: health.recent_errors.map((error) => ({
        fingerprint: error.fingerprint,
        message: error.message,
        count: error.count,
        firstSeen: iso(error.first_seen) ?? '',
        lastSeen: iso(error.last_seen) ?? '',
      })),
      merchantSkipRates: ctx.deps.merchantSkipRates(),
    };
  });

  app.get('/api/openapi.json', () => openApiDocument());

  return Promise.resolve();
};
