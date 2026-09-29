import { randomUUID } from 'node:crypto';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { scrubErrorName, scrubErrorText } from '@hearth/shared';
import { GoTrueError } from './gotrue/http.js';
import { createRouteContext, type AppDependencies } from './http/context.js';
import { buildOpenApiDocument } from './openapi.js';
import {
  PROBLEM_CONTENT_TYPE,
  ProblemError,
  problem,
  problemFromDatabaseError,
  problemFromGoTrueError,
  problemFromRecipeFetchError,
} from './problem.js';
import { RecipeFetchError } from './recipes/fetch-recipe.js';
import { authRoutes } from './routes/auth.js';
import { dealRoutes } from './routes/deals.js';
import { healthRoute } from './routes/health.js';
import { householdRoutes } from './routes/households.js';
import { listRoutes } from './routes/lists.js';
import { matchOverrideRoutes } from './routes/match-overrides.js';
import { recipeRoutes } from './routes/recipes.js';
import { systemRoutes } from './routes/system.js';
import { userRoutes } from './routes/users.js';
import { buildErrorRecord } from './services/errors.js';

export type { AppDependencies } from './http/context.js';

export interface AppOptions {
  trustedProxies: string[];
  logger: false | { level: string };
  /** HEARTH_ORIGIN: invite links are built on it. */
  origin: string;
  /** HEARTH_OWNER_EMAIL; empty means nobody is the owner. */
  ownerEmail: string;
  openApiDocument?: () => unknown;
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

// Logs never carry query strings: a search term or a token in a URL is user data.
function pathOnly(url: string): string {
  return url.split('?')[0] ?? '';
}

export async function buildApp(
  deps: AppDependencies,
  options: AppOptions,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            ...options.logger,
            serializers: {
              req: (request: FastifyRequest) => ({
                method: request.method,
                url: pathOnly(request.url),
                remoteAddress: request.ip,
              }),
            },
          },
    // Fastify binds the id into every request-scoped log line as `reqId`. It is generated
    // here rather than taken from a client header, which anyone could forge.
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    // Rate limits key on request.ip, which is only the real client when the proxies in
    // front (Caddy on the Compose network) are trusted and nothing else is.
    trustProxy: options.trustedProxies.length > 0 ? options.trustedProxies : false,
  });

  app.setErrorHandler(async (rawError, request, reply) => {
    const error =
      problemFromDatabaseError(rawError) ??
      (rawError instanceof GoTrueError
        ? problemFromGoTrueError(rawError)
        : rawError instanceof RecipeFetchError
          ? problemFromRecipeFetchError(rawError)
          : rawError);
    const status = statusOf(error);

    if (status >= 500) {
      const name = error instanceof Error ? error.name : 'Error';
      const message = error instanceof Error ? error.message : String(error);
      const route = request.routeOptions.url ?? 'unknown';
      // Scrubbed like everything recorded (Handoff non-negotiable 3); the stack stays out.
      request.log.error(
        { err: { name: scrubErrorName(name), message: scrubErrorText(message) }, route },
        'unhandled request error',
      );
      try {
        await deps.recordError(buildErrorRecord('service', { name, message, route }));
      } catch (recordFailure) {
        request.log.error(
          { err: { message: scrubErrorText(recordFailure) } },
          'could not record the error',
        );
      }
    }

    if (error instanceof ProblemError) {
      return reply.code(status).type(PROBLEM_CONTENT_TYPE).send(error.problem);
    }
    if (status >= 500) {
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
      .send(problem(404, `No route for ${request.method} ${pathOnly(request.url)}.`));
  });

  const ctx = createRouteContext(deps, { origin: options.origin, ownerEmail: options.ownerEmail });
  await app.register(healthRoute, { pingDatabase: deps.pingDatabase });
  await app.register(authRoutes, { ctx });
  await app.register(userRoutes, { ctx });
  await app.register(householdRoutes, { ctx });
  await app.register(dealRoutes, { ctx });
  await app.register(listRoutes, { ctx });
  await app.register(matchOverrideRoutes, { ctx });
  await app.register(recipeRoutes, { ctx });
  await app.register(systemRoutes, {
    ctx,
    openApiDocument: options.openApiDocument ?? buildOpenApiDocument,
  });

  return app;
}
