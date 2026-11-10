import { logDroppedCopy } from '../notifications/copy.js';
import type { FastifyPluginAsync } from 'fastify';
import {
  addToListRequestSchema,
  createMealPlanEntryRequestSchema,
  householdIdParamsSchema,
  mealPlanEntryIdParamsSchema,
  mealPlanQuerySchema,
  weekAddToListRequestSchema,
} from '@hestia/shared';
import { parse, type RouteContext } from '../http/context.js';
import { addMissingIngredientsToList } from '../services/add-to-list.js';
import { addListItem } from '../services/lists.js';
import {
  addWeekMealsToList,
  createMealPlanEntry,
  deleteMealPlanEntry,
  getMealPlanWeek,
  requireMealPlanEntryTarget,
} from '../services/meal-plan.js';

/**
 * The week planner and "Add missing to list" from a planned meal or week. `/meal-plan/:id` routes
 * do not name a household in the path, so the service functions find it from the row, the same
 * convention `/recipes/:id` and `/pantry/:id` follow.
 */
export const mealPlanRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/households/:id/meal-plan', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const query = parse(mealPlanQuerySchema, request.query);
    return ctx.inHousehold(user, id, (db) => getMealPlanWeek(db, id, query.week));
  });

  app.post('/api/households/:id/meal-plan', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(createMealPlanEntryRequestSchema, request.body);
    const entry = await ctx.inHousehold(user, id, (db) =>
      createMealPlanEntry(db, id, user.id, body),
    );
    return reply.code(201).send(entry);
  });

  app.delete('/api/meal-plan/:id', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(mealPlanEntryIdParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteMealPlanEntry(db, id));
    return reply.code(204).send();
  });

  app.post('/api/meal-plan/:id/add-to-list', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(mealPlanEntryIdParamsSchema, request.params);
    const body = parse(addToListRequestSchema, request.body);
    return ctx.asUser(user, async (db) => {
      const target = await requireMealPlanEntryTarget(db, id);
      if (target.kind === 'recipe') {
        return addMissingIngredientsToList(
          db,
          body.listId,
          [target.recipeId],
          user.id,
          logDroppedCopy(request.log),
        );
      }
      return addListItem(
        db,
        body.listId,
        user.id,
        {
          source: 'manual',
          itemName: target.customTitle,
          quantity: 1,
        },
        logDroppedCopy(request.log),
      );
    });
  });

  app.post('/api/households/:id/meal-plan/add-to-list', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(weekAddToListRequestSchema, request.body);
    return ctx.inHousehold(user, id, (db) =>
      addWeekMealsToList(db, id, body.listId, body.week, user.id, logDroppedCopy(request.log)),
    );
  });

  return Promise.resolve();
};
