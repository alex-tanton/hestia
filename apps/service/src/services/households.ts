import { sql, type Kysely } from 'kysely';
import type {
  CreateHouseholdRequest,
  Household,
  HouseholdRole,
  Member,
  UpdateHouseholdRequest,
} from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';

/*
 * Service functions take a Kysely bound to the caller's withUserDb transaction, so RLS decides
 * what they can see; the explicit checks here only choose the right response (403 versus 404).
 */

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function householdQuery(db: Kysely<Database>, userId: string) {
  return db
    .selectFrom('household as h')
    .innerJoin('household_member as m', 'm.household_id', 'h.id')
    .where('m.user_id', '=', userId)
    .select([
      'h.id',
      'h.name',
      'h.postal_code',
      'h.timezone',
      'h.created_at',
      'm.role',
      'm.joined_at',
    ]);
}

type HouseholdRow = Awaited<ReturnType<ReturnType<typeof householdQuery>['executeTakeFirst']>>;

function toHousehold(row: NonNullable<HouseholdRow>): Household {
  return {
    id: row.id,
    name: row.name,
    postalCode: row.postal_code,
    timezone: row.timezone,
    role: row.role,
    joinedAt: iso(row.joined_at),
    createdAt: iso(row.created_at),
  };
}

/** The caller's households, longest-held first. */
export async function listHouseholds(db: Kysely<Database>, userId: string): Promise<Household[]> {
  const rows = await householdQuery(db, userId).orderBy('m.joined_at').orderBy('h.id').execute();
  return rows.map(toHousehold);
}

export async function getHousehold(
  db: Kysely<Database>,
  userId: string,
  householdId: string,
): Promise<Household> {
  const row = await householdQuery(db, userId).where('h.id', '=', householdId).executeTakeFirst();
  if (row === undefined) throw fail(404, 'Household not found.');
  return toHousehold(row);
}

/** The caller's role in the household; 404 when they are not a member. */
export async function memberRole(
  db: Kysely<Database>,
  userId: string,
  householdId: string,
): Promise<HouseholdRole> {
  const row = await db
    .selectFrom('household_member')
    .where('household_id', '=', householdId)
    .where('user_id', '=', userId)
    .select('role')
    .executeTakeFirst();
  if (row === undefined) throw fail(404, 'Household not found.');
  return row.role;
}

/** Admin-only actions: 403 for a member, 404 for anyone else. */
export async function requireAdmin(
  db: Kysely<Database>,
  userId: string,
  householdId: string,
): Promise<void> {
  if ((await memberRole(db, userId, householdId)) !== 'admin') {
    throw fail(403, 'Only the household admin can do that.');
  }
}

/**
 * The household activity stamp. The function updates `last_active_at` at most once per UTC day. A
 * caller who is not a member gets 404, so a request cannot probe whether a household exists.
 */
export async function markHouseholdActive(
  db: Kysely<Database>,
  householdId: string,
): Promise<void> {
  try {
    await sql`select public.mark_household_active(${householdId})`.execute(db);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '42501') {
      throw fail(404, 'Household not found.');
    }
    throw error;
  }
}

export async function createHousehold(
  db: Kysely<Database>,
  userId: string,
  input: CreateHouseholdRequest,
): Promise<Household> {
  const { rows } = await sql<{ id: string }>`
    select public.create_household(${input.name}, ${input.postalCode}, ${input.timezone}) as id
  `.execute(db);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('create_household returned no id');
  return getHousehold(db, userId, id);
}

export async function updateHousehold(
  db: Kysely<Database>,
  userId: string,
  householdId: string,
  input: UpdateHouseholdRequest,
): Promise<Household> {
  await requireAdmin(db, userId, householdId);
  await db
    .updateTable('household')
    .set({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.postalCode === undefined ? {} : { postal_code: input.postalCode }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
    })
    .where('id', '=', householdId)
    .execute();
  return getHousehold(db, userId, householdId);
}

export async function listMembers(db: Kysely<Database>, householdId: string): Promise<Member[]> {
  const { rows } = await sql<{
    user_id: string;
    display_name: string;
    role: HouseholdRole;
    joined_at: Date;
  }>`select * from public.household_members(${householdId})`.execute(db);
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    joinedAt: iso(row.joined_at),
  }));
}

/** Redeems an invite by link token or typed code; the household becomes active. */
export async function joinHousehold(
  db: Kysely<Database>,
  userId: string,
  tokenOrCode: string,
): Promise<Household> {
  const { rows } = await sql<{
    id: string;
  }>`select public.redeem_invite(${tokenOrCode}) as id`.execute(db);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('redeem_invite returned no id');
  return getHousehold(db, userId, id);
}
