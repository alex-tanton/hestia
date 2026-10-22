import { sql, type Kysely } from 'kysely';
import type { DeparturePreview, DepartResult } from '@hearth/shared';
import type { Database } from '../db.js';

/*
 * Reassign-and-depart and the admin transfer are the membership functions; each checks its caller itself. These wrappers
 * only call them and map the result.
 */

interface PreviewJson {
  household_id: string;
  household_name: string;
  user_id: string;
  is_last_member: boolean;
  deletion_counts: {
    lists: number;
    pantry_items: number;
    recipes: number;
    meal_plan_entries: number;
    chores: number;
    errands: number;
    bills: number;
  };
  lists: { id: string; name: string }[];
  chores: { id: string; name: string }[];
  errands: { id: string; name: string }[];
  bills: { id: string; name: string }[];
  rotations: { chore_id: string; chore_name: string; next_turn_user_id: string | null }[];
}

export async function departurePreview(
  db: Kysely<Database>,
  householdId: string,
  userId: string,
): Promise<DeparturePreview> {
  const { rows } = await sql<{
    preview: PreviewJson;
  }>`select public.departure_preview(${householdId}, ${userId}) as preview`.execute(db);
  const preview = rows[0]?.preview;
  if (preview === undefined) throw new Error('departure_preview returned nothing');
  const counts = preview.deletion_counts;
  return {
    householdId: preview.household_id,
    householdName: preview.household_name,
    userId: preview.user_id,
    isLastMember: preview.is_last_member,
    deletionCounts: {
      lists: counts.lists,
      pantryItems: counts.pantry_items,
      recipes: counts.recipes,
      mealPlanEntries: counts.meal_plan_entries,
      chores: counts.chores,
      errands: counts.errands,
      bills: counts.bills,
    },
    lists: preview.lists,
    chores: preview.chores,
    errands: preview.errands,
    bills: preview.bills,
    rotations: preview.rotations.map((rotation) => ({
      choreId: rotation.chore_id,
      choreName: rotation.chore_name,
      nextTurnUserId: rotation.next_turn_user_id,
    })),
  };
}

export async function depart(
  db: Kysely<Database>,
  householdId: string,
  userId: string,
  reassignments: Readonly<Record<string, string>>,
  confirmName: string | undefined,
): Promise<DepartResult> {
  const { rows } = await sql<{
    result: { household_deleted: boolean; promoted_user_id: string | null };
  }>`
    select public.depart_household(
      ${householdId}, ${userId}, ${JSON.stringify(reassignments)}::jsonb, ${confirmName ?? null}
    ) as result
  `.execute(db);
  const result = rows[0]?.result;
  if (result === undefined) throw new Error('depart_household returned nothing');
  return {
    householdDeleted: result.household_deleted,
    promotedUserId: result.promoted_user_id,
  };
}

export async function transferAdmin(
  db: Kysely<Database>,
  householdId: string,
  newAdminId: string,
): Promise<void> {
  await sql`select public.transfer_admin(${householdId}, ${newAdminId})`.execute(db);
}
