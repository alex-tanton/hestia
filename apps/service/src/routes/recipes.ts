import { logDroppedCopy } from '../notifications/copy.js';
import type { FastifyPluginAsync } from 'fastify';
import {
  addToListRequestSchema,
  createRecipeRequestSchema,
  householdIdParamsSchema,
  parseRecipeRequestSchema,
  recipeIdParamsSchema,
  recipesQuerySchema,
  updateRecipeRequestSchema,
} from '@hearth/shared';
import { parse, type RouteContext } from '../http/context.js';
import { addMissingIngredientsToList } from '../services/add-to-list.js';
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  listRecipes,
  updateRecipe,
} from '../services/recipes.js';
import { getSuggestions } from '../services/suggestions.js';

/**
 * Recipes. Handlers stay thin: validate with a shared schema, then one service function on the
 * caller's `withUserDb` transaction. `/recipes/:id` routes do not name a household in the path, so
 * the service functions find it from the row.
 */
export const recipeRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/households/:id/recipes', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const query = parse(recipesQuerySchema, request.query);
    return ctx.inHousehold(user, id, (db) => listRecipes(db, id, query.page));
  });

  app.post('/api/households/:id/recipes', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(createRecipeRequestSchema, request.body);
    const recipe = await ctx.inHousehold(user, id, (db) => createRecipe(db, id, user.id, body));
    return reply.code(201).send(recipe);
  });

  // The parse-and-preview endpoint never saves anything, so it needs no ingredient input and
  // touches recipe/recipe_ingredient not at all; it still runs under the household check so a
  // non-member cannot use it, and so household activity is stamped like every named-household
  // request.
  app.post('/api/households/:id/recipes/parse', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(parseRecipeRequestSchema, request.body);
    return ctx.inHousehold(user, id, () => ctx.deps.parseRecipeUrl(body.url));
  });

  app.get('/api/recipes/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(recipeIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => getRecipe(db, id));
  });

  app.patch('/api/recipes/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(recipeIdParamsSchema, request.params);
    const body = parse(updateRecipeRequestSchema, request.body);
    return ctx.asUser(user, (db) => updateRecipe(db, id, body));
  });

  app.delete('/api/recipes/:id', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(recipeIdParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteRecipe(db, id));
    return reply.code(204).send();
  });

  // A missing/foreign recipe 404s (via getRecipe) before the list is ever touched.
  app.post('/api/recipes/:id/add-to-list', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(recipeIdParamsSchema, request.params);
    const body = parse(addToListRequestSchema, request.body);
    return ctx.asUser(user, async (db) => {
      await getRecipe(db, id);
      return addMissingIngredientsToList(
        db,
        body.listId,
        [id],
        user.id,
        logDroppedCopy(request.log),
      );
    });
  });

  app.get('/api/households/:id/suggestions', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => getSuggestions(db, id));
  });

  return Promise.resolve();
};
