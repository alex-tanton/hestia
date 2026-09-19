import { randomUUID } from 'node:crypto';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { PROBLEM_CONTENT_TYPE, ProblemError, problem } from './problem.js';
import { healthRoute } from './routes/health.js';

export interface AppDependencies {
  pingDatabase: () => Promise<void>;
}

export interface AppOptions {
  trustedProxies: string[];
  logger: NonNullable<FastifyServerOptions['logger']>;
}

const API_RATE_LIMIT_PER_MINUTE = 300;

function statusOf(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const { statusCode } = error;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) {
      return statusCode;
    }
  }
  return 500;
}

export async function buildApp(
  deps: AppDependencies,
  options: AppOptions,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger,
    // Fastify binds the id into every request-scoped log line as `reqId`. It is generated
    // here rather than taken from a client header, which anyone could forge.
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    // Rate limits key on request.ip, which is only the real client when the proxies in
    // front (Caddy on the Compose network) are trusted and nothing else is.
    trustProxy: options.trustedProxies.length > 0 ? options.trustedProxies : false,
  });

  app.setErrorHandler((error, request, reply) => {
    const status = statusOf(error);
    if (error instanceof ProblemError) {
      return reply.code(status).type(PROBLEM_CONTENT_TYPE).send(error.problem);
    }
    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled request error');
      // Internal details never reach the client.
      return reply.code(status).type(PROBLEM_CONTENT_TYPE).send(problem(status));
    }
    // Client errors raised by Fastify itself (malformed JSON, oversized body) are safe to describe.
    const detail = error instanceof Error ? error.message : undefined;
    return reply.code(status).type(PROBLEM_CONTENT_TYPE).send(problem(status, detail));
  });

  await app.register(rateLimit, {
    global: true,
    max: API_RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    // Only the service's own routes are limited; every one of them lives under /api.
    allowList: (request) => !request.url.startsWith('/api/'),
    errorResponseBuilder: (_request, context) =>
      new ProblemError(problem(429, `Rate limit exceeded. Try again in ${context.after}.`)),
  });

  // The global limit only hooks registered routes, so unknown /api paths opt in explicitly;
  // otherwise probing them would be unlimited.
  app.setNotFoundHandler({ preHandler: app.rateLimit() }, (request, reply) => {
    return reply
      .code(404)
      .type(PROBLEM_CONTENT_TYPE)
      .send(problem(404, `No route for ${request.method} ${request.url.split('?')[0] ?? ''}.`));
  });

  await app.register(healthRoute, { pingDatabase: deps.pingDatabase });

  return app;
}
