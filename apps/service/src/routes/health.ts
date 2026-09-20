import type { FastifyPluginAsync } from 'fastify';
import { scrubErrorName, scrubErrorText } from '@hearth/shared';
import { PROBLEM_CONTENT_TYPE, problem } from '../problem.js';

export interface HealthRouteOptions {
  pingDatabase: () => Promise<void>;
}

/** GET /api/health — public liveness plus database connectivity, used by Docker and deploy. */
export const healthRoute: FastifyPluginAsync<HealthRouteOptions> = (app, { pingDatabase }) => {
  app.get('/api/health', async (request, reply) => {
    try {
      await pingDatabase();
    } catch (error) {
      // Scrubbed like every other logged error: a connection failure can name the database URL.
      request.log.error(
        {
          err: {
            name: scrubErrorName(error instanceof Error ? error.name : 'Error'),
            message: scrubErrorText(error),
          },
        },
        'health check: database unreachable',
      );
      return reply
        .code(503)
        .type(PROBLEM_CONTENT_TYPE)
        .send(problem(503, 'The database is unreachable.'));
    }
    return { status: 'ok', database: 'ok' };
  });
  return Promise.resolve();
};
