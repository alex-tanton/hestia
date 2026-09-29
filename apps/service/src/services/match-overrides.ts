import type { Kysely } from 'kysely';
import { normalize } from '@hearth/matching';
import type { CreateMatchOverrideRequest, MatchOverride } from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';
import { markHouseholdActive } from './households.js';

/*
 * Match overrides (Requirements, "Match overrides"; Data model, "Meal planning" —
 * `ingredient_match_override`). A correction made from a recipe's breakdown; it applies to every
 * recipe in the household until a member removes it. Unique on (household_id,
 * ingredient_normalized_name, target_kind, target_normalized_name) — creating one that already
 * exists updates its decision rather than failing, the same idempotent-POST pattern as
 * favorite-stores and the pantry (Requirements, "Match overrides").
 */

interface MatchOverrideRow {
  id: string;
  household_id: string;
  ingredient_normalized_name: string;
  target_kind: MatchOverride['targetKind'];
  target_normalized_name: string;
  decision: MatchOverride['decision'];
  created_at: Date | string;
}

function toMatchOverride(row: MatchOverrideRow): MatchOverride {
  return {
    id: row.id,
    householdId: row.household_id,
    ingredientNormalizedName: row.ingredient_normalized_name,
    targetKind: row.target_kind,
    targetNormalizedName: row.target_normalized_name,
    decision: row.decision,
    createdAt: (row.created_at instanceof Date
      ? row.created_at
      : new Date(row.created_at)
    ).toISOString(),
  };
}

export async function createMatchOverride(
  db: Kysely<Database>,
  householdId: string,
  input: CreateMatchOverrideRequest,
): Promise<MatchOverride> {
  const row = await db
    .insertInto('ingredient_match_override')
    .values({
      household_id: householdId,
      ingredient_normalized_name: normalize(input.ingredientName),
      target_kind: input.targetKind,
      target_normalized_name: normalize(input.targetName),
      decision: input.decision,
    })
    .onConflict((conflict) =>
      conflict
        .columns([
          'household_id',
          'ingredient_normalized_name',
          'target_kind',
          'target_normalized_name',
        ])
        .doUpdateSet((eb) => ({ decision: eb.ref('excluded.decision') })),
    )
    .returningAll()
    .executeTakeFirst();
  if (row === undefined) throw fail(404, 'Household not found.');
  return toMatchOverride(row);
}

export async function deleteMatchOverride(db: Kysely<Database>, id: string): Promise<void> {
  // The household is read from the row itself (RLS already limits which row a caller can see),
  // the same order requirePantryItem uses: know which household owns it before stamping activity.
  const existing = await db
    .selectFrom('ingredient_match_override')
    .select('household_id')
    .where('id', '=', id)
    .executeTakeFirst();
  if (existing === undefined) throw fail(404, 'Match override not found.');
  await markHouseholdActive(db, existing.household_id);
  await db.deleteFrom('ingredient_match_override').where('id', '=', id).execute();
}
