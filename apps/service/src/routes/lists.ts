import { logDroppedCopy } from '../notifications/copy.js';
import type { FastifyPluginAsync } from 'fastify';
import {
  createListItemRequestSchema,
  createListRequestSchema,
  createPantryItemRequestSchema,
  householdIdParamsSchema,
  listIdParamsSchema,
  listItemParamsSchema,
  listsQuerySchema,
  pantryItemParamsSchema,
  updateListItemRequestSchema,
  updateListRequestSchema,
  updatePantryItemRequestSchema,
} from '@hestia/shared';
import { parse, type RouteContext } from '../http/context.js';
import {
  addBoughtToPantry,
  addListItem,
  createList,
  deleteList,
  deleteListItem,
  getList,
  listShoppingLists,
  renameList,
  setListArchived,
  updateListItem,
} from '../services/lists.js';
import {
  addPantryItem,
  deletePantryItem,
  listPantry,
  updatePantryItem,
} from '../services/pantry.js';

/**
 * Shopping lists and the pantry. Handlers stay thin: validate with a shared schema, call a service
 * function with the caller's transaction, send the mapped response. The list and pantry paths do
 * not name a household, so the service functions stamp household activity once they know which
 * household the row belongs to.
 */
export const listRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/households/:id/lists', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const query = parse(listsQuerySchema, request.query);
    return ctx.inHousehold(user, id, (db) => listShoppingLists(db, id, query.archived === 'true'));
  });

  app.post('/api/households/:id/lists', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(createListRequestSchema, request.body);
    const list = await ctx.inHousehold(user, id, (db) => createList(db, id, user.id, body.name));
    return reply.code(201).send(list);
  });

  app.get('/api/lists/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(listIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => getList(db, id));
  });

  app.patch('/api/lists/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(listIdParamsSchema, request.params);
    const body = parse(updateListRequestSchema, request.body);
    return ctx.asUser(user, (db) => renameList(db, id, body.name));
  });

  app.delete('/api/lists/:id', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(listIdParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteList(db, id));
    return reply.code(204).send();
  });

  app.post('/api/lists/:id/archive', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(listIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => setListArchived(db, id, true));
  });

  app.post('/api/lists/:id/unarchive', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(listIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => setListArchived(db, id, false));
  });

  app.post('/api/lists/:id/items', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(listIdParamsSchema, request.params);
    const body = parse(createListItemRequestSchema, request.body);
    const list = await ctx.asUser(user, (db) =>
      addListItem(db, id, user.id, body, logDroppedCopy(request.log)),
    );
    return reply.code(201).send(list);
  });

  app.patch('/api/lists/:id/items/:itemId', async (request) => {
    const user = await ctx.authenticate(request);
    const { id, itemId } = parse(listItemParamsSchema, request.params);
    const body = parse(updateListItemRequestSchema, request.body);
    return ctx.asUser(user, (db) => updateListItem(db, id, itemId, body));
  });

  app.delete('/api/lists/:id/items/:itemId', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id, itemId } = parse(listItemParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteListItem(db, id, itemId));
    return reply.code(204).send();
  });

  app.post('/api/lists/:id/add-bought-to-pantry', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(listIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => addBoughtToPantry(db, id));
  });

  app.get('/api/households/:id/pantry', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => listPantry(db, id));
  });

  app.post('/api/households/:id/pantry', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(createPantryItemRequestSchema, request.body);
    const item = await ctx.inHousehold(user, id, (db) => addPantryItem(db, id, body));
    return reply.code(201).send(item);
  });

  app.patch('/api/pantry/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(pantryItemParamsSchema, request.params);
    const body = parse(updatePantryItemRequestSchema, request.body);
    return ctx.asUser(user, (db) => updatePantryItem(db, id, body));
  });

  app.delete('/api/pantry/:id', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(pantryItemParamsSchema, request.params);
    await ctx.asUser(user, (db) => deletePantryItem(db, id));
    return reply.code(204).send();
  });

  return Promise.resolve();
};
