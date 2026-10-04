import { logDroppedCopy } from '../notifications/copy.js';
import type { FastifyPluginAsync } from 'fastify';
import {
  choreCompletionParamsSchema,
  choreIdParamsSchema,
  completeChoreRequestSchema,
  createChoreRequestSchema,
  householdIdParamsSchema,
  updateChoreRequestSchema,
} from '@hearth/shared';
import {
  completeChore,
  createChore,
  deleteChore,
  deleteChoreCompletion,
  getChoreDetail,
  listChores,
  updateChore,
} from '../chores/chores.js';
import { parse, type RouteContext } from '../http/context.js';

/**
 * Chores, completions, and undo (Technical Architecture, "API surface" › "Chores"). `/chores/:id`
 * routes do not name a household in the path, the same convention `/lists/:id` and `/recipes/:id`
 * follow: the service functions find it from the row.
 */
export const choreRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/households/:id/chores', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => listChores(db, id));
  });

  app.post('/api/households/:id/chores', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(createChoreRequestSchema, request.body);
    const chore = await ctx.inHousehold(user, id, (db) => createChore(db, id, user.id, body));
    return reply.code(201).send(chore);
  });

  app.get('/api/chores/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(choreIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => getChoreDetail(db, id));
  });

  app.patch('/api/chores/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(choreIdParamsSchema, request.params);
    const body = parse(updateChoreRequestSchema, request.body);
    return ctx.asUser(user, (db) => updateChore(db, id, body));
  });

  app.delete('/api/chores/:id', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(choreIdParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteChore(db, id));
    return reply.code(204).send();
  });

  app.post('/api/chores/:id/complete', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(choreIdParamsSchema, request.params);
    const body = parse(completeChoreRequestSchema, request.body ?? {});
    const chore = await ctx.asUser(user, (db) =>
      completeChore(db, id, user.id, body, logDroppedCopy(request.log)),
    );
    return reply.code(201).send(chore);
  });

  app.delete('/api/chores/:id/completions/:completionId', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id, completionId } = parse(choreCompletionParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteChoreCompletion(db, id, completionId));
    return reply.code(204).send();
  });

  return Promise.resolve();
};
