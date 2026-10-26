import type { Pool, PoolClient } from 'pg';
import { matchIngredient, type MatchCandidate, type MatchOverride } from '@hestia/matching';

/**
 * Recipe readiness for the seed data (the 12+2 readiness table is the test oracle, and readiness
 * scoring must match every expected bucket and percentage in it). `seed.sql` deliberately does not
 * hand-write `recipe_readiness` rows (matching is derived data); this runs the real computation
 * after `seed.sql` applies.
 *
 * This duplicates the small amount of query/bucket-assignment orchestration that
 * `apps/service/src/services/readiness.ts` and `matching-candidates.ts` own, rather than importing
 * them: they are built on the service's Kysely `Database` type and `db.ts`, and pulling that whole
 * module graph into this plain-`pg` seed script (which has none of the service's other
 * dependencies, and connects as `postgres`, not through `withUserDb`) is a much larger undertaking
 * than this one seed step justifies. `@hestia/matching` — the pure matcher this logic calls — is
 * a real, unchanged import from its own workspace package, not duplicated: only the SQL that
 * builds its candidates and the bucket/percent bookkeeping around it lives here, kept in lockstep
 * with the two service files' logic by construction (same queries, same rounding, same bucket
 * rules) since both read from the same `recipe_readiness`/`ingredient_match_override` schema.
 */

interface DealRow {
  id: string;
  name: string;
  normalized_name: string;
  unit_price: string;
}

interface PantryRow {
  id: string;
  item_name: string;
  normalized_name: string;
}

interface BreakdownEntry {
  ingredientId: string;
  bucket: 'on_sale' | 'in_pantry' | 'to_buy';
  matchedId: string | null;
  matchedName: string | null;
  overridden: boolean;
}

export async function recomputeReadinessForHousehold(
  client: Pool | PoolClient,
  householdId: string,
): Promise<void> {
  const { rows: recipeRows } = await client.query<{ id: string }>(
    `select id from public.recipe where household_id = $1`,
    [householdId],
  );
  if (recipeRows.length === 0) return;

  const { rows: householdRows } = await client.query<{ postal_code: string; today: string }>(
    `select postal_code, (pg_catalog.now() at time zone timezone)::date::text as today
     from public.household where id = $1`,
    [householdId],
  );
  const household = householdRows[0];
  if (household === undefined) return;

  const { rows: favoriteRows } = await client.query<{ merchant_id: string }>(
    `select merchant_id from public.household_favorite_store where household_id = $1`,
    [householdId],
  );
  const merchantIds = favoriteRows.map((row) => row.merchant_id);

  const { rows: pantryRows } = await client.query<PantryRow>(
    `select id, item_name, normalized_name from public.pantry_item where household_id = $1`,
    [householdId],
  );

  // Ascending unit price, id as tiebreak: `matchIngredient` keeps the first matching deal
  // candidate it sees, so pre-sorting by price is what makes the lowest-price favorite-merchant
  // deal win (mirrors `matching-candidates.ts`'s own comment).
  const dealRows =
    merchantIds.length === 0
      ? []
      : (
          await client.query<DealRow>(
            `select id, name, normalized_name, unit_price
             from public.deal
             where postal_code = $1 and merchant_id = any($2::text[]) and valid_to >= $3::date
             order by unit_price, id`,
            [household.postal_code, merchantIds, household.today],
          )
        ).rows;

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

  const { rows: overrideRows } = await client.query<{
    ingredient_normalized_name: string;
    target_kind: MatchOverride['targetKind'];
    target_normalized_name: string;
    decision: MatchOverride['decision'];
  }>(
    `select ingredient_normalized_name, target_kind, target_normalized_name, decision
     from public.ingredient_match_override where household_id = $1`,
    [householdId],
  );
  const overrides: MatchOverride[] = overrideRows.map((row) => ({
    ingredientNormalizedName: row.ingredient_normalized_name,
    targetKind: row.target_kind,
    targetNormalizedName: row.target_normalized_name,
    decision: row.decision,
  }));

  for (const recipe of recipeRows) {
    const { rows: ingredientRows } = await client.query<{ id: string; normalized_name: string }>(
      `select id, normalized_name from public.recipe_ingredient where recipe_id = $1`,
      [recipe.id],
    );

    let onSaleCount = 0;
    let inPantryCount = 0;
    let toBuyCount = 0;
    const breakdown: Record<string, BreakdownEntry> = {};

    for (const ingredient of ingredientRows) {
      const result = matchIngredient(ingredient.normalized_name, candidates, overrides);
      const overridden = result.reason === 'override';

      if (!result.matched || result.candidate === undefined) {
        toBuyCount += 1;
        breakdown[ingredient.id] = {
          ingredientId: ingredient.id,
          bucket: 'to_buy',
          matchedId: null,
          matchedName: null,
          overridden: false,
        };
      } else if (result.candidate.targetKind === 'pantry') {
        inPantryCount += 1;
        const pantry = pantryById.get(result.candidate.id);
        breakdown[ingredient.id] = {
          ingredientId: ingredient.id,
          bucket: 'in_pantry',
          matchedId: result.candidate.id,
          matchedName: pantry?.item_name ?? null,
          overridden,
        };
      } else {
        onSaleCount += 1;
        const deal = dealsById.get(result.candidate.id);
        breakdown[ingredient.id] = {
          ingredientId: ingredient.id,
          bucket: 'on_sale',
          matchedId: result.candidate.id,
          matchedName: deal?.name ?? null,
          overridden,
        };
      }
    }

    // Equal weighting, half-up rounding, 0% for a recipe with no ingredients, the same formula
    // `readiness.ts` uses.
    const readinessPercent =
      ingredientRows.length === 0
        ? 0
        : Math.round(((onSaleCount + inPantryCount) / ingredientRows.length) * 100);

    await client.query(
      `insert into public.recipe_readiness
         (recipe_id, household_id, on_sale_count, in_pantry_count, to_buy_count,
          readiness_percent, breakdown, computed_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
       on conflict (recipe_id) do update set
         on_sale_count = excluded.on_sale_count,
         in_pantry_count = excluded.in_pantry_count,
         to_buy_count = excluded.to_buy_count,
         readiness_percent = excluded.readiness_percent,
         breakdown = excluded.breakdown,
         computed_at = excluded.computed_at`,
      [
        recipe.id,
        householdId,
        onSaleCount,
        inPantryCount,
        toBuyCount,
        readinessPercent,
        JSON.stringify(breakdown),
      ],
    );
  }
}
