import type { FastifyPluginAsync } from 'fastify';
import { signupRequestSchema } from '@hearth/shared';
import { parse, type RouteContext } from '../http/context.js';

/**
 * POST /api/signup (public). The password policy runs here before GoTrue sees the request;
 * Caddy refuses GoTrue's own /signup from outside, so there is no way around it.
 */
export const authRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.post('/api/signup', async (request, reply) => {
    const body = parse(signupRequestSchema, request.body);
    const session = await ctx.deps.gotrue.signup(
      {
        email: body.email,
        password: body.password,
        // Blank falls back to the email's local part, UTC until the PWA's first open (the
        // auth.users trigger).
        displayName: body.displayName ?? '',
        timezone: body.timezone ?? 'UTC',
      },
      request.ip,
    );
    return reply.code(200).send(session.body);
  });
  return Promise.resolve();
};
