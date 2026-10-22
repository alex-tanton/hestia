import type { FastifyPluginAsync } from 'fastify';
import type { Kysely } from 'kysely';
import {
  addFavoriteStoreRequestSchema,
  dealSearchQuerySchema,
  favoriteStoreParamsSchema,
  flyerItemsQuerySchema,
  flyerParamsSchema,
  flyersQuerySchema,
  householdIdParamsSchema,
} from '@hearth/shared';
import type { VerifiedUser } from '../auth/jwt.js';
import type { Database } from '../db.js';
import { withUserDb } from '../db/user-db.js';
import { parse, type RouteContext } from '../http/context.js';
import type { ClaimOnDemandRefresh, HouseholdContext } from '../services/deals/deals.js';
import {
  addFavoriteStore,
  listFavoriteStores,
  removeFavoriteStore,
} from '../services/deals/favorite-stores.js';
import { claimOnDemandRefresh } from '../services/deals/storage.js';
import { getHousehold } from '../services/households.js';

/**
 * Deals, flyers, merchants, and favorite stores. Handlers stay thin: validate with a shared schema,
 * then one service function on the caller's `withUserDb` transaction.
 */
export const dealRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  /** The household's postal code, read under RLS, so a non-member gets 404 and nothing else. */
  const household = async (
    db: Kysely<Database>,
    userId: string,
    householdId: string,
  ): Promise<HouseholdContext> => {
    const row = await getHousehold(db, userId, householdId);
    return { householdId: row.id, postalCode: row.postalCode };
  };

  /**
   * A dormant postal code's claim, run in its own transaction against the pool — never the
   * request's own — so it commits (or doesn't) independently of everything else the request does
   * (`services/deals/deals.ts`, `ClaimOnDemandRefresh`).
   */
  const claimForUser =
    (user: VerifiedUser): ClaimOnDemandRefresh =>
    (postalCode, now) =>
      withUserDb(ctx.deps.db, user.claims, (trx) => claimOnDemandRefresh(trx, postalCode, now));

  app.get('/api/households/:id/deals/search', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const query = parse(dealSearchQuerySchema, request.query);
    return ctx.inHousehold(user, id, async (db) =>
      ctx.deals.searchDeals(db, await household(db, user.id, id), query),
    );
  });

  app.get('/api/households/:id/flyers', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const query = parse(flyersQuerySchema, request.query);
    const claim = claimForUser(user);
    return ctx.inHousehold(user, id, async (db) =>
      ctx.deals.listFlyers(db, await household(db, user.id, id), query, claim),
    );
  });

  app.get('/api/households/:id/flyers/:flyerId/items', async (request) => {
    const user = await ctx.authenticate(request);
    const { id, flyerId } = parse(flyerParamsSchema, request.params);
    const query = parse(flyerItemsQuerySchema, request.query);
    const claim = claimForUser(user);
    return ctx.inHousehold(user, id, async (db) =>
      ctx.deals.listFlyerItems(db, await household(db, user.id, id), flyerId, query, claim),
    );
  });

  app.get('/api/households/:id/merchants', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, async (db) =>
      ctx.deals.listMerchants(db, await household(db, user.id, id)),
    );
  });

  app.get('/api/households/:id/favorite-stores', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => listFavoriteStores(db, id));
  });

  app.post('/api/households/:id/favorite-stores', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(addFavoriteStoreRequestSchema, request.body);
    const store = await ctx.inHousehold(user, id, (db) => addFavoriteStore(db, id, body));
    return reply.code(201).send(store);
  });

  app.delete('/api/households/:id/favorite-stores/:storeId', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id, storeId } = parse(favoriteStoreParamsSchema, request.params);
    await ctx.inHousehold(user, id, (db) => removeFavoriteStore(db, id, storeId));
    return reply.code(204).send();
  });

  return Promise.resolve();
};
