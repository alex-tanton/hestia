import { sql, type Kysely } from 'kysely';
import type { Database } from '../db.js';
import { SEARCH_TTL_MS } from '../services/deals/cache.js';
import type { JobDatabase, JobLogger } from './types.js';

/**
 * `prune-cache` — daily 04:00 UTC (Technical Architecture, "Scheduled jobs"; Requirements,
 * "Retention"). It deletes exactly four things and nothing else:
 *
 * - `deal` rows past their `valid_to`; `deal` is a cache, not a historical record
 * - `deal_query_cache` rows past the six-hour search TTL
 * - sent `notification` rows older than 90 days
 * - `app_error` rows whose `last_seen` is older than 90 days
 *
 * Everything else — meal plan entries, chore completions, payment logs — is kept indefinitely.
 */

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1_000;

export interface PruneCutoffs {
  /** Deals are pruned once `valid_to` has passed, so the cutoff is a calendar date. */
  expiredDealsBefore: string;
  queryCacheBefore: Date;
  sentNotificationsBefore: Date;
  errorsLastSeenBefore: Date;
}

/** Pure, so the four predicates are a unit test rather than four delete statements to eyeball. */
export function pruneCutoffs(now: Date): PruneCutoffs {
  const retention = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
  return {
    expiredDealsBefore: now.toISOString().slice(0, 10),
    queryCacheBefore: new Date(now.getTime() - SEARCH_TTL_MS),
    sentNotificationsBefore: retention,
    errorsLastSeenBefore: retention,
  };
}

export interface PruneOutcome {
  deals: number;
  queryCache: number;
  notifications: number;
  errors: number;
}

export async function pruneCache(db: Kysely<Database>, now: Date): Promise<PruneOutcome> {
  const cutoffs = pruneCutoffs(now);

  const deals = await db
    .deleteFrom('deal')
    .where('valid_to', '<', cutoffs.expiredDealsBefore)
    .executeTakeFirst();
  const queryCache = await db
    .deleteFrom('deal_query_cache')
    .where('cached_at', '<', cutoffs.queryCacheBefore)
    .executeTakeFirst();
  const notifications = await db
    .deleteFrom('notification')
    .where('sent_at', 'is not', null)
    .where('sent_at', '<', cutoffs.sentNotificationsBefore)
    .executeTakeFirst();
  // app_error has no policy and no grant: only service_role reaches it directly.
  const { rows } = await sql<{ fingerprint: string }>`
    delete from public.app_error where last_seen < ${cutoffs.errorsLastSeenBefore}
    returning fingerprint
  `.execute(db);

  return {
    deals: Number(deals.numDeletedRows),
    queryCache: Number(queryCache.numDeletedRows),
    notifications: Number(notifications.numDeletedRows),
    errors: rows.length,
  };
}

export interface PruneDeps {
  database: JobDatabase;
  logger: JobLogger;
  now?: () => Date;
}

export async function runPruneCache(deps: PruneDeps): Promise<PruneOutcome> {
  const now = (deps.now ?? ((): Date => new Date()))();
  const outcome = await deps.database.asServiceRole((db) => pruneCache(db, now));
  deps.logger.info({ ...outcome }, 'prune-cache finished');
  return outcome;
}
