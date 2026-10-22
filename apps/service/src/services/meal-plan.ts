import { sql, type Kysely } from 'kysely';
import type {
  CreateMealPlanEntryRequest,
  MealPlanEntry,
  MealPlanWeekResponse,
} from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';
import { markHouseholdActive } from './households.js';

/*
 * The week planner. Every function takes a Kysely bound to the caller's withUserDb transaction, so
 * RLS decides what it can see; a row RLS hides is reported as not found, never as forbidden.
 */

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

interface EntryRow {
  id: string;
  household_id: string;
  recipe_id: string | null;
  recipe_title: string;
  planned_date: string;
  meal_type: MealPlanEntry['mealType'];
  added_by: string;
  created_at: Date | string;
  readiness_percent: number | null;
}

function toEntry(row: EntryRow): MealPlanEntry {
  return {
    id: row.id,
    householdId: row.household_id,
    recipeId: row.recipe_id,
    recipeTitle: row.recipe_title,
    // Null when the recipe was deleted (no recipe_id to look readiness up by) or, defensively,
    // when it has never been computed.
    readinessPercent: row.recipe_id === null ? null : row.readiness_percent,
    plannedDate: row.planned_date,
    mealType: row.meal_type,
    addedBy: row.added_by,
    createdAt: iso(row.created_at),
  };
}

function entryQuery(db: Kysely<Database>) {
  return db
    .selectFrom('meal_plan_entry')
    .leftJoin('recipe_readiness', 'recipe_readiness.recipe_id', 'meal_plan_entry.recipe_id')
    .select([
      'meal_plan_entry.id',
      'meal_plan_entry.household_id',
      'meal_plan_entry.recipe_id',
      'meal_plan_entry.recipe_title',
      'meal_plan_entry.planned_date',
      'meal_plan_entry.meal_type',
      'meal_plan_entry.added_by',
      'meal_plan_entry.created_at',
      'recipe_readiness.readiness_percent',
    ]);
}

/** `dateStr` (YYYY-MM-DD) plus `days` calendar days, as the same kind of string. */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A week query's `week` must actually be that week's Sunday, or the request is rejected. */
export function assertSunday(week: string): void {
  const day = new Date(`${week}T00:00:00Z`).getUTCDay();
  if (day !== 0) throw fail(400, 'week must be a Sunday date (YYYY-MM-DD).');
}

/** The current week's Sunday, in the household's own timezone. */
async function currentWeekSunday(db: Kysely<Database>, householdId: string): Promise<string> {
  const { rows } = await sql<{ week: string }>`
    select (
      (pg_catalog.now() at time zone h.timezone)::date
      - (extract(dow from (pg_catalog.now() at time zone h.timezone)::date))::int
    )::text as week
    from public.household h
    where h.id = ${householdId}
  `.execute(db);
  const week = rows[0]?.week;
  if (week === undefined) throw fail(404, 'Household not found.');
  return week;
}

export async function getMealPlanWeek(
  db: Kysely<Database>,
  householdId: string,
  week?: string,
): Promise<MealPlanWeekResponse> {
  if (week !== undefined) assertSunday(week);
  const sunday = week ?? (await currentWeekSunday(db, householdId));

  const rows = await entryQuery(db)
    .where('meal_plan_entry.household_id', '=', householdId)
    .where('meal_plan_entry.planned_date', '>=', sunday)
    .where('meal_plan_entry.planned_date', '<=', addDays(sunday, 6))
    .orderBy('meal_plan_entry.planned_date')
    .orderBy('meal_plan_entry.meal_type')
    .orderBy('meal_plan_entry.created_at')
    .execute();

  return { week: sunday, entries: rows.map(toEntry) };
}

/** The recipe, only if it belongs to this household; 404 otherwise (RLS may still hide it too). */
async function requireHouseholdRecipe(
  db: Kysely<Database>,
  householdId: string,
  recipeId: string,
): Promise<{ id: string; title: string }> {
  const row = await db
    .selectFrom('recipe')
    .select(['id', 'title', 'household_id'])
    .where('id', '=', recipeId)
    .executeTakeFirst();
  if (row?.household_id !== householdId) throw fail(404, 'Recipe not found.');
  return row;
}

export async function createMealPlanEntry(
  db: Kysely<Database>,
  householdId: string,
  userId: string,
  input: CreateMealPlanEntryRequest,
): Promise<MealPlanEntry> {
  const recipe = await requireHouseholdRecipe(db, householdId, input.recipeId);
  const row = await db
    .insertInto('meal_plan_entry')
    .values({
      household_id: householdId,
      recipe_id: recipe.id,
      // Snapshotted at placement time: the entry keeps this title even if the recipe is later
      // renamed or deleted.
      recipe_title: recipe.title,
      planned_date: input.plannedDate,
      meal_type: input.mealType,
      added_by: userId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();

  const created = await entryQuery(db).where('meal_plan_entry.id', '=', row.id).executeTakeFirst();
  if (created === undefined) throw new Error('meal plan entry vanished immediately after insert');
  return toEntry(created);
}

export async function deleteMealPlanEntry(db: Kysely<Database>, id: string): Promise<void> {
  const existing = await db
    .selectFrom('meal_plan_entry')
    .select('household_id')
    .where('id', '=', id)
    .executeTakeFirst();
  if (existing === undefined) throw fail(404, 'Meal plan entry not found.');
  await markHouseholdActive(db, existing.household_id);
  await db.deleteFrom('meal_plan_entry').where('id', '=', id).execute();
}

/**
 * The recipe id behind one planned meal, for "Add missing to list". 404s under the same message
 * whether the entry itself is not visible or its recipe has since been deleted (the planner UI
 * never offers this action for a deleted-recipe entry, so the API is equally conservative).
 */
export async function requireMealPlanEntryRecipeId(
  db: Kysely<Database>,
  id: string,
): Promise<string> {
  const row = await db
    .selectFrom('meal_plan_entry')
    .select(['household_id', 'recipe_id'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (row === undefined) throw fail(404, 'Meal plan entry not found.');
  await markHouseholdActive(db, row.household_id);
  if (row.recipe_id === null) throw fail(404, 'Recipe not found.');
  return row.recipe_id;
}

/**
 * Every recipe id planned in one household's week, `recipe_id is not null` only, in no deduplicated
 * order (a recipe planned twice contributes its ingredients twice).
 */
export async function recipeIdsForWeek(
  db: Kysely<Database>,
  householdId: string,
  week: string,
): Promise<string[]> {
  assertSunday(week);
  const rows = await db
    .selectFrom('meal_plan_entry')
    .select('recipe_id')
    .where('household_id', '=', householdId)
    .where('planned_date', '>=', week)
    .where('planned_date', '<=', addDays(week, 6))
    .where('recipe_id', 'is not', null)
    .orderBy('planned_date')
    .orderBy('meal_type')
    .orderBy('created_at')
    .execute();
  return rows.map((row) => row.recipe_id).filter((id): id is string => id !== null);
}
