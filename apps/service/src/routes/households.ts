import type { FastifyPluginAsync } from 'fastify';
import {
  createHouseholdRequestSchema,
  departRequestSchema,
  householdIdParamsSchema,
  inviteParamsSchema,
  joinHouseholdRequestSchema,
  memberParamsSchema,
  transferAdminRequestSchema,
  updateHouseholdRequestSchema,
} from '@hearth/shared';
import { parse, type RouteContext } from '../http/context.js';
import {
  createHousehold,
  getHousehold,
  joinHousehold,
  listHouseholds,
  listMembers,
  updateHousehold,
} from '../services/households.js';
import { createInvite, listInvites, revokeInvite } from '../services/invites.js';
import { depart, departurePreview, transferAdmin } from '../services/membership.js';

/** Households, invites, and membership. */
export const householdRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/households', async (request) => {
    const user = await ctx.authenticate(request);
    return ctx.asUser(user, (db) => listHouseholds(db, user.id));
  });

  app.post('/api/households', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const body = parse(createHouseholdRequestSchema, request.body);
    const household = await ctx.asUser(user, (db) => createHousehold(db, user.id, body));
    return reply.code(201).send(household);
  });

  app.post('/api/households/join', async (request) => {
    const user = await ctx.authenticate(request);
    const body = parse(joinHouseholdRequestSchema, request.body);
    return ctx.asUser(user, (db) => joinHousehold(db, user.id, body.tokenOrCode));
  });

  app.get('/api/households/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => getHousehold(db, user.id, id));
  });

  app.patch('/api/households/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(updateHouseholdRequestSchema, request.body);
    return ctx.inHousehold(user, id, (db) => updateHousehold(db, user.id, id, body));
  });

  app.get('/api/households/:id/members', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => listMembers(db, id));
  });

  app.get('/api/households/:id/invites', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => listInvites(db, user.id, id));
  });

  app.post('/api/households/:id/invites', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const created = await ctx.inHousehold(user, id, (db) =>
      createInvite(db, user.id, id, ctx.origin),
    );
    // The link and code are credentials, shown once; never cache them.
    return reply.code(201).header('cache-control', 'no-store').send(created);
  });

  app.delete('/api/households/:id/invites/:inviteId', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id, inviteId } = parse(inviteParamsSchema, request.params);
    await ctx.inHousehold(user, id, (db) => revokeInvite(db, user.id, id, inviteId));
    return reply.code(204).send();
  });

  app.get('/api/households/:id/members/:userId/departure-preview', async (request) => {
    const user = await ctx.authenticate(request);
    const { id, userId } = parse(memberParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => departurePreview(db, id, userId));
  });

  app.post('/api/households/:id/leave', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(departRequestSchema, request.body ?? {});
    return ctx.inHousehold(user, id, (db) =>
      depart(db, id, user.id, body.reassignments, body.confirmName),
    );
  });

  app.post('/api/households/:id/members/:userId/remove', async (request) => {
    const user = await ctx.authenticate(request);
    const { id, userId } = parse(memberParamsSchema, request.params);
    const body = parse(departRequestSchema, request.body ?? {});
    return ctx.inHousehold(user, id, (db) =>
      depart(db, id, userId, body.reassignments, body.confirmName),
    );
  });

  app.post('/api/households/:id/transfer-admin', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(transferAdminRequestSchema, request.body);
    await ctx.inHousehold(user, id, (db) => transferAdmin(db, id, body.userId));
    return reply.code(204).send();
  });

  return Promise.resolve();
};
