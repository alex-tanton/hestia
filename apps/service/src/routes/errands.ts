import type { FastifyPluginAsync } from 'fastify';
import {
  createErrandRequestSchema,
  errandIdParamsSchema,
  householdIdParamsSchema,
  updateErrandRequestSchema,
} from '@hearth/shared';
import {
  createErrand,
  deleteErrand,
  getErrand,
  listErrands,
  updateErrand,
} from '../chores/errands.js';
import { parse, type RouteContext } from '../http/context.js';

/** Errands (Technical Architecture, "API surface" › "Errands"). */
export const errandRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/households/:id/errands', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => listErrands(db, id));
  });

  app.post('/api/households/:id/errands', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(createErrandRequestSchema, request.body);
    const errand = await ctx.inHousehold(user, id, (db) => createErrand(db, id, user.id, body));
    return reply.code(201).send(errand);
  });

  app.get('/api/errands/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(errandIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => getErrand(db, id));
  });

  app.patch('/api/errands/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(errandIdParamsSchema, request.params);
    const body = parse(updateErrandRequestSchema, request.body);
    return ctx.asUser(user, (db) => updateErrand(db, id, user.id, body));
  });

  app.delete('/api/errands/:id', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(errandIdParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteErrand(db, id));
    return reply.code(204).send();
  });

  return Promise.resolve();
};
