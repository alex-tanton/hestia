import type { FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type { z } from 'zod';
import type { MerchantSkipRate, ParseRecipeResponse } from '@hearth/shared';
import { isServerOwner, TokenError, type TokenVerifier, type VerifiedUser } from '../auth/jwt.js';
import type { Database } from '../db.js';
import { withUserDb } from '../db/user-db.js';
import type { GoTrueClient } from '../gotrue/client.js';
import type { SystemHealthRow } from '../privileged/service-role-db.js';
import { fail } from '../problem.js';
import type { DealsService } from '../services/deals/deals.js';
import type { ErrorRecord } from '../services/errors.js';
import { markHouseholdActive } from '../services/households.js';

export interface AppDependencies {
  pingDatabase: () => Promise<void>;
  /** The hestia_service pool. Handlers reach it only through withUserDb. */
  db: Kysely<Database>;
  verifyToken: TokenVerifier;
  gotrue: Pick<GoTrueClient, 'signup' | 'verifyPassword' | 'updatePassword'>;
  /** The password-verified email change, through GoTrue's admin API (service role). */
  changeEmail: (userId: string, email: string) => Promise<void>;
  /** `system_health()` as service_role; called only after the owner check. */
  systemHealth: () => Promise<SystemHealthRow>;
  /** Records a scrubbed error as anon. */
  recordError: (record: ErrorRecord) => Promise<void>;
  newestBackupTime: () => Promise<Date | null>;
  merchantSkipRates: () => MerchantSkipRate[];
  /** The deals read path: the Flipp wrapper behind its caches. */
  deals: DealsService;
  /**
   * Fetches a pasted recipe URL server-side and extracts JSON-LD, never throwing on unusable
   * markup. A network or fetch-limit failure still throws, and the route maps it to a problem
   * response.
   */
  parseRecipeUrl: (url: string) => Promise<ParseRecipeResponse>;
}

export interface RouteContext {
  deps: AppDependencies;
  origin: string;
  ownerEmail: string;
  deals: DealsService;
  /** The verified caller, or 401. */
  authenticate: (request: FastifyRequest) => Promise<VerifiedUser>;
  isOwner: (user: VerifiedUser) => boolean;
  /** withUserDb for the caller. */
  asUser: <T>(user: VerifiedUser, fn: (db: Kysely<Database>) => Promise<T>) => Promise<T>;
  /**
   * withUserDb for a request that names a household: stamps the household active first, which
   * also answers 404 to a caller who is not a member.
   */
  inHousehold: <T>(
    user: VerifiedUser,
    householdId: string,
    fn: (db: Kysely<Database>) => Promise<T>,
  ) => Promise<T>;
}

export function createRouteContext(
  deps: AppDependencies,
  settings: { origin: string; ownerEmail: string },
): RouteContext {
  return {
    deps,
    origin: settings.origin,
    ownerEmail: settings.ownerEmail,
    deals: deps.deals,
    authenticate: async (request) => {
      const header = request.headers.authorization ?? '';
      const match = /^Bearer\s+(\S+)$/i.exec(header);
      const token = match?.[1];
      if (token === undefined) throw fail(401, 'Sign in to continue.');
      try {
        return await deps.verifyToken(token);
      } catch (error) {
        if (error instanceof TokenError)
          throw fail(401, 'Your session has expired. Sign in again.');
        throw error;
      }
    },
    isOwner: (user) => isServerOwner(user.email, settings.ownerEmail),
    asUser: (user, fn) => withUserDb(deps.db, user.claims, fn),
    inHousehold: (user, householdId, fn) =>
      withUserDb(deps.db, user.claims, async (db) => {
        await markHouseholdActive(db, householdId);
        return fn(db);
      }),
  };
}

/** Validates input with a shared schema; a failure is a 400 naming the first problem. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path.map(String).join('.') ?? '';
  const message = issue?.message ?? 'Invalid request.';
  throw fail(400, path === '' ? message : `${path}: ${message}`);
}
