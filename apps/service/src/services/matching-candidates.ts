import { sql, type Kysely, type Selectable } from 'kysely';
import type { MatchCandidate, MatchOverride } from '@hearth/matching';
import type { Database } from '../db.js';
import { favoriteMerchantIds } from './deals/favorite-stores.js';

/**
 * The shared candidate-building step behind readiness and "Add missing to list". Both features
 * match a household's recipe ingredients against the same two candidate pools — its pantry and its
 * favorite-merchant deals — so this is built once and handed to `@hearth/matching`'s pure
 * `matchIngredient`, rather than re-implemented per caller.
 */

type DealRow = Selectable<Database['deal']>;
type PantryRow = Selectable<Database['pantry_item']>;

export interface HouseholdMatchContext {
  /**
   * Pantry candidates first, then deal candidates sorted ascending by `unit_price` (id as
   * tiebreak). `matchIngredient` keeps the *first* matching deal candidate it sees
   * (`dealMatch ??= ...`), so pre-sorting the deals by ascending price makes "first match" and
   * "lowest-price match" the same thing. That is what encodes "When several favorite-merchant
   * deals match, the one with the lowest unit price is used" without duplicating any matching logic
   * here or in `@hearth/matching` — a lower-price deal is simply seen, and therefore kept, before a
   * higher-priced one.
   */
  candidates: MatchCandidate[];
  dealsById: Map<string, DealRow>;
  pantryById: Map<string, PantryRow>;
}

const EMPTY_CONTEXT: HouseholdMatchContext = {
  candidates: [],
  dealsById: new Map(),
  pantryById: new Map(),
};

/** The household's pantry and current favorite-merchant deals, as `@hearth/matching` candidates. */
export async function buildMatchCandidates(
  db: Kysely<Database>,
  householdId: string,
): Promise<HouseholdMatchContext> {
  // "Today" is the household's own calendar date, the same `at time zone` idiom `repricing.ts` uses
  // for "does a deal's valid_to still cover today".
  const { rows } = await sql<{ postal_code: string; today: string }>`
    select postal_code, (pg_catalog.now() at time zone timezone)::date::text as today
    from public.household
    where id = ${householdId}
  `.execute(db);
  const household = rows[0];
  if (household === undefined) return EMPTY_CONTEXT;

  const merchantIds = await favoriteMerchantIds(db, householdId);
  const pantryRows = await db
    .selectFrom('pantry_item')
    .selectAll()
    .where('household_id', '=', householdId)
    .execute();

  const dealRows =
    merchantIds.length === 0
      ? []
      : await db
          .selectFrom('deal')
          .selectAll()
          .where('postal_code', '=', household.postal_code)
          .where('merchant_id', 'in', merchantIds)
          .where('valid_to', '>=', household.today)
          // Ascending unit price, id as tiebreak (see `HouseholdMatchContext.candidates`).
          .orderBy('unit_price')
          .orderBy('id')
          .execute();

  const dealsById = new Map(dealRows.map((row) => [row.id, row]));
  const pantryById = new Map(pantryRows.map((row) => [row.id, row]));

  const candidates: MatchCandidate[] = [
    ...pantryRows.map((row): MatchCandidate => ({
      id: row.id,
      targetKind: 'pantry',
      normalizedName: row.normalized_name,
    })),
    ...dealRows.map((row): MatchCandidate => ({
      id: row.id,
      targetKind: 'deal',
      normalizedName: row.normalized_name,
    })),
  ];

  return { candidates, dealsById, pantryById };
}

/** The household's match overrides, in `@hearth/matching`'s `MatchOverride` shape. */
export async function listMatchOverridesFor(
  db: Kysely<Database>,
  householdId: string,
): Promise<MatchOverride[]> {
  const rows = await db
    .selectFrom('ingredient_match_override')
    .select(['ingredient_normalized_name', 'target_kind', 'target_normalized_name', 'decision'])
    .where('household_id', '=', householdId)
    .execute();
  return rows.map((row) => ({
    ingredientNormalizedName: row.ingredient_normalized_name,
    targetKind: row.target_kind,
    targetNormalizedName: row.target_normalized_name,
    decision: row.decision,
  }));
}
