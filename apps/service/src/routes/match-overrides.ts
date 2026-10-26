import type { FastifyPluginAsync } from 'fastify';
import {
  createMatchOverrideRequestSchema,
  householdIdParamsSchema,
  matchOverrideParamsSchema,
} from '@hestia/shared';
import { parse, type RouteContext } from '../http/context.js';
import { createMatchOverride, deleteMatchOverride } from '../services/match-overrides.js';

/**
 * Match overrides. Handlers stay thin: validate with a shared schema, call a service function with
 * the caller's transaction, send the mapped response. The overrides that apply to a recipe come
 * back on `GET /recipes/:id` (a later unit); this file only owns creating and removing them.
 */
export const matchOverrideRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.post('/api/households/:id/match-overrides', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(createMatchOverrideRequestSchema, request.body);
    const override = await ctx.inHousehold(user, id, (db) => createMatchOverride(db, id, body));
    return reply.code(201).send(override);
  });

  app.delete('/api/match-overrides/:id', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(matchOverrideParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteMatchOverride(db, id));
    return reply.code(204).send();
  });

  return Promise.resolve();
};
