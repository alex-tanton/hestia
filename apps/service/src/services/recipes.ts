import type { Kysely, Selectable } from 'kysely';
import { normalize } from '@hearth/matching';
import type {
  CreateRecipeRequest,
  IngredientInput,
  Recipe,
  RecipeDetail,
  RecipeIngredient,
  RecipeListResponse,
  UpdateRecipeRequest,
} from '@hearth/shared';
import { RECIPE_PAGE_SIZE } from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';
import { paginate } from './deals/filter.js';
import { markHouseholdActive } from './households.js';
import { toNumber } from './money.js';

/*
 * Recipes (Requirements, "Recipe library"; Technical Architecture, "The Node service" › API
 * surface). Every function takes a Kysely bound to the caller's withUserDb transaction, so RLS
 * decides what it can see; a row RLS hides is reported as not found, never as forbidden, and no
 * function here ever needs to check household_id itself.
 *
 * Recipes are hard-deleted (Requirements, "Meal plan history and deleted recipes"): there is no
 * soft-delete column, and the schema's `meal_plan_entry` foreign key is `on delete set null`, so
 * deleting a recipe never needs to touch meal plan rows itself.
 */

type RecipeRow = Selectable<Database['recipe']>;
type IngredientRow = Selectable<Database['recipe_ingredient']>;

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    sourceUrl: row.source_url,
    instructions: row.instructions,
    servings: row.servings,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

function toIngredient(row: IngredientRow): RecipeIngredient {
  return {
    id: row.id,
    position: row.position,
    rawText: row.raw_text,
    itemName: row.item_name,
    normalizedName: row.normalized_name,
    quantity: toNumber(row.quantity),
    unit: row.unit,
  };
}

async function ingredientsOf(db: Kysely<Database>, recipeId: string): Promise<RecipeIngredient[]> {
  const rows = await db
    .selectFrom('recipe_ingredient')
    .selectAll()
    .where('recipe_id', '=', recipeId)
    .orderBy('position')
    .execute();
  return rows.map(toIngredient);
}

async function detailOf(db: Kysely<Database>, row: RecipeRow): Promise<RecipeDetail> {
  return { ...toRecipe(row), ingredients: await ingredientsOf(db, row.id) };
}

/** The recipe row, or 404; reading it means RLS allowed it. */
async function requireRecipe(db: Kysely<Database>, id: string): Promise<RecipeRow> {
  const row = await db.selectFrom('recipe').selectAll().where('id', '=', id).executeTakeFirst();
  if (row === undefined) throw fail(404, 'Recipe not found.');
  // The recipe's own path does not name its household, but working a recipe is household activity.
  await markHouseholdActive(db, row.household_id);
  return row;
}

/** Ingredients paginate at the same size as deal results (Requirements, "Scale and pagination"). */
export async function listRecipes(
  db: Kysely<Database>,
  householdId: string,
  page: number,
): Promise<RecipeListResponse> {
  const rows = await db
    .selectFrom('recipe')
    .selectAll()
    .where('household_id', '=', householdId)
    .orderBy('title')
    .orderBy('id')
    .execute();
  const paged = paginate(rows.map(toRecipe), page, RECIPE_PAGE_SIZE);
  return {
    recipes: paged.items,
    page: paged.page,
    pageSize: paged.pageSize,
    total: paged.total,
    hasMore: paged.hasMore,
  };
}

async function insertIngredients(
  db: Kysely<Database>,
  recipeId: string,
  ingredients: readonly IngredientInput[],
): Promise<void> {
  if (ingredients.length === 0) return;
  await db
    .insertInto('recipe_ingredient')
    .values(
      ingredients.map((ingredient, position) => ({
        recipe_id: recipeId,
        position,
        raw_text: ingredient.rawText ?? null,
        item_name: ingredient.itemName,
        normalized_name: normalize(ingredient.itemName),
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
      })),
    )
    .execute();
}

export async function createRecipe(
  db: Kysely<Database>,
  householdId: string,
  userId: string,
  input: CreateRecipeRequest,
): Promise<RecipeDetail> {
  const row = await db
    .insertInto('recipe')
    .values({
      household_id: householdId,
      title: input.title,
      source_url: input.sourceUrl ?? null,
      instructions: input.instructions ?? null,
      servings: input.servings ?? null,
      created_by: userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  await insertIngredients(db, row.id, input.ingredients);
  return detailOf(db, row);
}

export async function getRecipe(db: Kysely<Database>, id: string): Promise<RecipeDetail> {
  const row = await requireRecipe(db, id);
  return detailOf(db, row);
}

export async function updateRecipe(
  db: Kysely<Database>,
  id: string,
  input: UpdateRecipeRequest,
): Promise<RecipeDetail> {
  const current = await requireRecipe(db, id);
  const changes = {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.sourceUrl === undefined ? {} : { source_url: input.sourceUrl }),
    ...(input.instructions === undefined ? {} : { instructions: input.instructions }),
    ...(input.servings === undefined ? {} : { servings: input.servings }),
  };
  // A PATCH that only replaces ingredients touches no column on `recipe` itself; Kysely (and
  // Postgres) has no syntax for a SET clause with nothing in it, so that case skips the update
  // rather than issuing one.
  const row =
    Object.keys(changes).length === 0
      ? current
      : await db
          .updateTable('recipe')
          .set(changes)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow();
  if (input.ingredients !== undefined) {
    // A full replace, not a merge: the client always sends the complete edited set, so there is
    // no stable key to reconcile a partial one against (a raw_text can repeat, an id does not
    // exist yet for a newly added line).
    await db.deleteFrom('recipe_ingredient').where('recipe_id', '=', id).execute();
    await insertIngredients(db, id, input.ingredients);
  }
  return detailOf(db, row);
}

export async function deleteRecipe(db: Kysely<Database>, id: string): Promise<void> {
  await requireRecipe(db, id);
  // recipe_ingredient and recipe_readiness cascade; meal_plan_entry.recipe_id is set null by its
  // own foreign key, keeping the entry and its recipe_title snapshot (Requirements, "Meal plan
  // history and deleted recipes").
  await db.deleteFrom('recipe').where('id', '=', id).execute();
}
