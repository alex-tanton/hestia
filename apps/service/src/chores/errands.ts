import { sql, type Kysely } from 'kysely';
import type { CreateErrandRequest, Errand, UpdateErrandRequest } from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';
import { markHouseholdActive } from '../services/households.js';

/*
 * Errands: one-off tasks with a name, an optional due date, and a status of open or done
 * (Requirements, "Chores and errands" › "Errands"; Technical Architecture, "API surface" ›
 * "Errands"). Every function takes a Kysely bound to the caller's withUserDb transaction, so RLS
 * decides what it can see.
 */

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

interface ErrandRow {
  id: string;
  household_id: string;
  name: string;
  due_date: string | null;
  status: 'open' | 'done';
  added_by: string;
  assigned_to: string | null;
  completed_at: Date | string | null;
  completed_by: string | null;
  created_at: Date | string;
}

function toErrand(row: ErrandRow): Errand {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    dueDate: row.due_date,
    status: row.status,
    addedBy: row.added_by,
    assignedTo: row.assigned_to,
    completedAt: row.completed_at === null ? null : iso(row.completed_at),
    completedBy: row.completed_by,
    createdAt: iso(row.created_at),
  };
}

async function requireErrandRow(db: Kysely<Database>, id: string): Promise<ErrandRow> {
  const row = await db.selectFrom('errand').selectAll().where('id', '=', id).executeTakeFirst();
  if (row === undefined) throw fail(404, 'Errand not found.');
  return row;
}

/**
 * Open items first, done collapsed below (Design, "18. Errands"); within each group, the soonest
 * due date first — Postgres's default `nulls last` on `asc` is exactly "no due date sorts after
 * every dated one" with no extra clause needed. The query orders within each status group; `Array.
 * filter` is stable, so splitting open from done afterwards keeps that ordering in each half
 * without needing a database-side "is this open" sort key.
 */
export async function listErrands(db: Kysely<Database>, householdId: string): Promise<Errand[]> {
  const rows = await db
    .selectFrom('errand')
    .selectAll()
    .where('household_id', '=', householdId)
    .orderBy('due_date', 'asc')
    .orderBy('created_at', 'asc')
    .execute();
  const open = rows.filter((row) => row.status === 'open');
  const done = rows.filter((row) => row.status === 'done');
  return [...open, ...done].map(toErrand);
}

export async function getErrand(db: Kysely<Database>, id: string): Promise<Errand> {
  return toErrand(await requireErrandRow(db, id));
}

/**
 * `id` is client-generated (PRD, "Data model" › "Chores": `errand` has "id (client-generated
 * UUID)"); a replayed offline add is a no-op (Handoff non-negotiable 9), the same idempotent
 * insert `services/lists.ts`'s `addListItem` uses.
 */
export async function createErrand(
  db: Kysely<Database>,
  householdId: string,
  userId: string,
  input: CreateErrandRequest,
): Promise<Errand> {
  const inserted = await db
    .insertInto('errand')
    .values({
      ...(input.id === undefined ? {} : { id: input.id }),
      household_id: householdId,
      name: input.name,
      due_date: input.dueDate ?? null,
      added_by: userId,
      assigned_to: input.assignedTo ?? null,
    })
    .onConflict((conflict) => conflict.column('id').doNothing())
    .returning('id')
    .executeTakeFirst();
  // A conflict (replaying an id already landed) means the insert touched nothing; the id the
  // caller supplied is still the row to return.
  const id = inserted?.id ?? input.id;
  if (id === undefined) throw new Error('errand insert returned no id and none was given');
  return getErrand(db, id);
}

/**
 * Every field is an absolute value (Handoff non-negotiable 9). `status` drives the completion
 * stamp absolutely and exclusively: `done` sets `completedAt`/`completedBy` from the caller's JWT,
 * `open` clears both — never from client input, so attribution can never be spoofed (Technical
 * Architecture, "API surface" › "Errands": "`done` stamps `completed_at` and `completed_by`"; the
 * reverse direction mirrors the schema's own symmetric check constraint and the established
 * "set absolutely" pattern `updateListItemRequestSchema` uses for reopening a bought item).
 */
export async function updateErrand(
  db: Kysely<Database>,
  id: string,
  userId: string,
  input: UpdateErrandRequest,
): Promise<Errand> {
  const existing = await requireErrandRow(db, id);
  await markHouseholdActive(db, existing.household_id);

  /*
   * A `done` for an errand that is already done changes nothing: the first completion stands. This
   * is what makes a replayed offline done a no-op (Engineering Practices, "The write queue"), since
   * the PATCH carries no client id to recognise a replay by.
   */
  const alreadyDone = input.status === 'done' && existing.status === 'done';
  const statusFields =
    input.status === undefined || alreadyDone
      ? {}
      : input.status === 'done'
        ? {
            status: 'done' as const,
            // The earlier of the action time and the database clock, as for chore completions.
            completed_at:
              input.doneAt === undefined
                ? sql<Date>`now()`
                : sql<Date>`least(${input.doneAt}::timestamptz, now())`,
            completed_by: userId,
          }
        : { status: 'open' as const, completed_at: null, completed_by: null };

  const changes = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.dueDate === undefined ? {} : { due_date: input.dueDate }),
    ...(input.assignedTo === undefined ? {} : { assigned_to: input.assignedTo }),
    ...statusFields,
  };
  // A replayed done can change nothing at all, and an empty SET is not valid SQL.
  if (Object.keys(changes).length > 0) {
    await db.updateTable('errand').set(changes).where('id', '=', id).execute();
  }
  return getErrand(db, id);
}

export async function deleteErrand(db: Kysely<Database>, id: string): Promise<void> {
  const existing = await requireErrandRow(db, id);
  await markHouseholdActive(db, existing.household_id);
  await db.deleteFrom('errand').where('id', '=', id).execute();
}
