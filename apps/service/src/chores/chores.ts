import { sql, type Kysely } from 'kysely';
import {
  currentTurn,
  occurrenceToComplete,
  rebaseRotationOnEdit,
  type CalendarDate,
  type Recurrence,
} from '@hearth/recurrence';
import {
  rotationDuplicateMessage,
  type Chore,
  type ChoreCompletion,
  type ChoreDetail,
  type CompleteChoreRequest,
  type CreateChoreRequest,
  type UpdateChoreRequest,
} from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';
import { markHouseholdActive } from '../services/households.js';
import {
  deriveChoreState,
  householdToday,
  isValidOccurrence,
  nextOccurrenceDates,
} from './occurrence.js';

/*
 * Chores, completions, and rotation (Requirements, "Chores and errands"; Technical Architecture,
 * "API surface" › "Chores"). Every function takes a Kysely bound to the caller's withUserDb
 * transaction, so RLS decides what it can see; a row RLS hides is reported as not found, never as
 * forbidden (Handoff non-negotiable 10).
 *
 * Nothing here implements gamification (Handoff non-negotiable 13): no streak counts, no point
 * totals, no "nice work" copy — not even in a log line.
 */

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

interface ChoreRow {
  id: string;
  household_id: string;
  name: string;
  recurrence_unit: Recurrence['unit'];
  interval: number;
  anchor_date: string;
  rotation_order: string[] | null;
  rotation_offset: number;
  assigned_to: string | null;
  created_by: string;
  created_at: Date | string;
}

interface CompletionRow {
  id: string;
  chore_id: string;
  occurrence_date: string;
  completed_by: string;
  completed_at: Date | string;
}

function toRecurrence(row: ChoreRow): Recurrence {
  return { unit: row.recurrence_unit, interval: row.interval, anchorDate: row.anchor_date };
}

function toCompletion(row: CompletionRow): ChoreCompletion {
  return {
    id: row.id,
    choreId: row.chore_id,
    occurrenceDate: row.occurrence_date,
    completedBy: row.completed_by,
    completedAt: iso(row.completed_at),
  };
}

function toChore(row: ChoreRow, completions: readonly CompletionRow[], today: CalendarDate): Chore {
  const completedDates = new Set(completions.map((completion) => completion.occurrence_date));
  const derived = deriveChoreState(
    toRecurrence(row),
    completedDates,
    completions.length,
    today,
    row.rotation_order,
    row.rotation_offset,
  );
  // Sorted ascending by occurrence_date below, and that date is strictly increasing with each
  // successive completion (PRD, "Recurrence is anchored and derived on read"), so the last
  // element is always the most recently recorded completion.
  const last = completions.at(-1);
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    recurrenceUnit: row.recurrence_unit,
    interval: row.interval,
    anchorDate: row.anchor_date,
    rotationOrder: row.rotation_order,
    rotationOffset: row.rotation_offset,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    dueDate: derived.dueDate,
    isOverdue: derived.isOverdue,
    lastCompletion: last === undefined ? null : toCompletion(last),
    currentTurn: derived.currentTurn,
    nextTurn: derived.nextTurn,
  };
}

async function requireChoreRow(db: Kysely<Database>, choreId: string): Promise<ChoreRow> {
  const row = await db.selectFrom('chore').selectAll().where('id', '=', choreId).executeTakeFirst();
  if (row === undefined) throw fail(404, 'Chore not found.');
  return row;
}

async function completionsFor(db: Kysely<Database>, choreId: string): Promise<CompletionRow[]> {
  return db
    .selectFrom('chore_completion')
    .select(['id', 'chore_id', 'occurrence_date', 'completed_by', 'completed_at'])
    .where('chore_id', '=', choreId)
    .orderBy('occurrence_date')
    .execute();
}

export async function listChores(db: Kysely<Database>, householdId: string): Promise<Chore[]> {
  const today = await householdToday(db, householdId);
  const chores = await db
    .selectFrom('chore')
    .selectAll()
    .where('household_id', '=', householdId)
    .orderBy('created_at')
    .orderBy('id')
    .execute();
  if (chores.length === 0) return [];

  const completions = await db
    .selectFrom('chore_completion')
    .select(['id', 'chore_id', 'occurrence_date', 'completed_by', 'completed_at'])
    .where(
      'chore_id',
      'in',
      chores.map((chore) => chore.id),
    )
    .orderBy('occurrence_date')
    .execute();
  const byChore = new Map<string, CompletionRow[]>();
  for (const completion of completions) {
    const list = byChore.get(completion.chore_id) ?? [];
    list.push(completion);
    byChore.set(completion.chore_id, list);
  }

  return chores.map((chore) => toChore(chore, byChore.get(chore.id) ?? [], today));
}

export async function getChoreDetail(db: Kysely<Database>, choreId: string): Promise<ChoreDetail> {
  const row = await requireChoreRow(db, choreId);
  const today = await householdToday(db, row.household_id);
  const completions = await completionsFor(db, choreId);
  const chore = toChore(row, completions, today);
  return {
    ...chore,
    // Starts at the chore's own due date, not "today" — see nextOccurrenceDates's doc comment.
    previewDates: nextOccurrenceDates(toRecurrence(row), chore.dueDate, 3),
    completions: completions.map(toCompletion),
  };
}

function assignmentColumns(assignment: CreateChoreRequest['assignment']): {
  rotation_order: string[] | null;
  rotation_offset: number;
  assigned_to: string | null;
} {
  if (assignment === undefined || assignment.type === 'none') {
    return { rotation_order: null, rotation_offset: 0, assigned_to: null };
  }
  if (assignment.type === 'rotation') {
    return { rotation_order: assignment.rotationOrder, rotation_offset: 0, assigned_to: null };
  }
  return { rotation_order: null, rotation_offset: 0, assigned_to: assignment.assignedTo };
}

/**
 * Resolves the assignment columns for `PATCH /chores/:id` when the payload's assignment is a
 * `rotation` whose `rotationOrder` differs from what's stored. Unlike `assignmentColumns` (used
 * for create, and for every other assignment type on update), this does not always restart at
 * offset 0: a reviewer flagged that doing so contradicts the Design System's framing of the
 * rotation editor as "reorderable by drag handles" — reordering, or appending a member, shouldn't
 * silently reassign whose turn it is. The resolution applies the PRD's one stated precedent for
 * rotation mutation — a member's departure, which keeps "the turn stays with the same person" —
 * to the edit case too, as the smallest conservative extension (PRD, "Rotation").
 *
 * Re-entering rotation mode from "single" or "none" (`existing.rotation_order` is null) has no
 * prior turn to preserve, so it starts fresh at offset 0, exactly like creating a new rotation.
 * This is a deliberate, separate decision (the PRD doesn't address a mode round-trip): whatever
 * offset a chore had the last time it was in rotation mode is not given any special meaning just
 * because the order being set now happens to match it again — restarting cleanly is simpler and
 * less surprising than resurrecting stale state across an unrelated detour through another mode.
 */
async function resolveRotationUpdate(
  db: Kysely<Database>,
  choreId: string,
  existing: ChoreRow,
  newOrder: string[],
): Promise<{ rotation_order: string[]; rotation_offset: number; assigned_to: null }> {
  if (existing.rotation_order === null) {
    return { rotation_order: newOrder, rotation_offset: 0, assigned_to: null };
  }
  const completionCount = (await completionsFor(db, choreId)).length;
  const rotation_offset = rebaseRotationOnEdit(
    existing.rotation_order,
    existing.rotation_offset,
    completionCount,
    newOrder,
  );
  return { rotation_order: newOrder, rotation_offset, assigned_to: null };
}

/**
 * Backstop for `rotationOrderSchema` in `@hearth/shared`, which the route already applied. The
 * column is a plain `uuid[]` and would store a repeated member without complaint, so the service
 * refuses it here too rather than trusting that every caller goes through the route. Checked before
 * any database read so a bad order never reaches the rotation math.
 */
function assertDistinctRotation(assignment: CreateChoreRequest['assignment']): void {
  if (assignment?.type !== 'rotation') return;
  if (new Set(assignment.rotationOrder).size !== assignment.rotationOrder.length) {
    throw fail(400, rotationDuplicateMessage);
  }
}

export async function createChore(
  db: Kysely<Database>,
  householdId: string,
  userId: string,
  input: CreateChoreRequest,
): Promise<ChoreDetail> {
  assertDistinctRotation(input.assignment);
  const row = await db
    .insertInto('chore')
    .values({
      household_id: householdId,
      name: input.name,
      recurrence_unit: input.recurrenceUnit,
      interval: input.interval,
      anchor_date: input.anchorDate,
      created_by: userId,
      ...assignmentColumns(input.assignment),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return getChoreDetail(db, row.id);
}

export async function updateChore(
  db: Kysely<Database>,
  choreId: string,
  input: UpdateChoreRequest,
): Promise<ChoreDetail> {
  assertDistinctRotation(input.assignment);
  const existing = await requireChoreRow(db, choreId);
  await markHouseholdActive(db, existing.household_id);

  // A rotation edit gets its own resolver (resolveRotationUpdate) so it can preserve the current
  // turn by identity instead of always restarting at offset 0; every other assignment type (and no
  // assignment at all) keeps the simple, existing behavior unchanged.
  const assignmentUpdate =
    input.assignment === undefined
      ? {}
      : input.assignment.type === 'rotation'
        ? await resolveRotationUpdate(db, choreId, existing, input.assignment.rotationOrder)
        : assignmentColumns(input.assignment);

  await db
    .updateTable('chore')
    .set({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.recurrenceUnit === undefined ? {} : { recurrence_unit: input.recurrenceUnit }),
      ...(input.interval === undefined ? {} : { interval: input.interval }),
      ...(input.anchorDate === undefined ? {} : { anchor_date: input.anchorDate }),
      ...assignmentUpdate,
    })
    .where('id', '=', choreId)
    .execute();
  return getChoreDetail(db, choreId);
}

export async function deleteChore(db: Kysely<Database>, choreId: string): Promise<void> {
  const existing = await requireChoreRow(db, choreId);
  await markHouseholdActive(db, existing.household_id);
  // chore_completion rows cascade (schema: "chore_id uuid ... on delete cascade").
  await db.deleteFrom('chore').where('id', '=', choreId).execute();
}

/**
 * Writes the `chore_rotation` outbox row for whoever now holds the turn (PRD, "Notifications" ›
 * trigger table: "A completion passes a rotating chore's turn to another member"; `target_id` the
 * chore id, `occurrence_key` the occurrence date that was completed, which is exactly what
 * `deleteChoreCompletion` below deletes again on undo). Only the row is written here — sending it
 * is Phase 5's `dispatch-notifications` job (Handoff, "Phase 5 — Cross-cutting"), which is also
 * where per-user quiet hours are applied (see the note on `send_after` below).
 *
 * `send_after` is `now()`, not deferred into the recipient's quiet-hours window the way
 * `jobs/refresh-deals.ts` defers `flyer_refresh`: that job runs as service_role and can join
 * `profile` directly, but this row is written by the completing member's own request, and RLS
 * deliberately keeps a member from reading another member's `profile` row at all — "Co-members'
 * names come from `household_members`, never from `profile`" (Technical Architecture, "Database" ›
 * "RLS policy pattern"), which includes quiet hours. Quiet hours ship in Phase 5 (Handoff, "Phase 5
 * — Cross-cutting": "per-user quiet hours"), so deferring the check to the job that already has
 * service-role access, rather than exposing a new privileged read path here, is the simpler,
 * spec-consistent choice (this gap and its resolution are also recorded in Technical Architecture,
 * "Database" › "RLS policy pattern").
 */
async function enqueueChoreRotation(
  db: Kysely<Database>,
  chore: Pick<ChoreRow, 'id' | 'household_id' | 'name'>,
  recipientUserId: string,
  occurrenceDateClosed: CalendarDate,
): Promise<void> {
  await sql`
    insert into public.notification (user_id, type, target_id, occurrence_key, payload, send_after)
    values (
      ${recipientUserId}, 'chore_rotation', ${chore.id}, ${occurrenceDateClosed},
      jsonb_build_object(
        'title', 'Your turn',
        'body', ${chore.name} || ' is now your turn.',
        'householdId', ${chore.household_id}::uuid,
        'target', 'chores'
      ),
      pg_catalog.now()
    )
    on conflict (user_id, type, target_id, occurrence_key) do nothing
  `.execute(db);
}

/**
 * Completes a chore's current occurrence, or the next open one when done early (PRD, "Recurrence
 * is anchored and derived on read" › "Chores"). `completed_by` is always `userId`, the caller from
 * the JWT — a rotation advances from whoever was *scheduled*, never from whoever actually did it
 * (PRD, "Rotation": "If Sam does Alex's turn, the next turn is still the member after Alex"), which
 * is why the rotation math below only ever consumes the completion *count*, not `userId`.
 *
 * `occurrence_date`: see the PATCH-sized comment on `completeChoreRequestSchema` in
 * `@hearth/shared` for the decision this unit makes. In short: the server always computes its own
 * answer, `occurrenceToComplete`, from the current rotation/recurrence state; a caller that
 * supplies one must name that exact same date and gets a validation error otherwise, never a
 * silent substitution. There is no other value a correct completion can close — the PRD's rule is
 * exhaustive ("closes the current occurrence if open; otherwise the earliest later occurrence that
 * has no completion") — so "validated, not trusted" means checked for equality, not merely checked
 * for shape. An earlier draft of this function used a supplied date as-is once it looked like *a*
 * valid, uncompleted occurrence of the recurrence; that let a caller either jump the rotation ahead
 * by completing a far-future occurrence without ever closing the one actually due (passing the
 * turn without doing the current chore), or backfill a long-missed occurrence the PRD says must
 * "never" be backfilled. Requiring equality to the server's own answer closes both holes while
 * still leaving Phase 5's offline queue able to replay a completion computed at the time of a
 * (possibly offline) action: the common case — reconnecting before the occurrence has rolled over —
 * computes the same date the server would anyway, and the rare case where it has rolled over is
 * exactly a missed occurrence, which this PRD rule says should not be completable regardless of who
 * is asking.
 *
 * The insert is idempotent two ways at once (Handoff non-negotiable 9): a replayed `id` is a
 * no-op (handled before any rotation side effect runs, so a resend never double-advances the
 * turn), and a genuine double-booking of the same occurrence by two different ids still raises
 * `23505` on `chore_completion`'s own (`chore_id`, `occurrence_date`) unique constraint, which the
 * service's global error handler already maps to 409.
 */
export async function completeChore(
  db: Kysely<Database>,
  choreId: string,
  userId: string,
  input: CompleteChoreRequest,
): Promise<ChoreDetail> {
  const chore = await requireChoreRow(db, choreId);
  await markHouseholdActive(db, chore.household_id);

  if (input.id !== undefined) {
    const already = await db
      .selectFrom('chore_completion')
      .select('id')
      .where('id', '=', input.id)
      .executeTakeFirst();
    if (already !== undefined) return getChoreDetail(db, choreId);
  }

  const recurrence = toRecurrence(chore);
  const existing = await db
    .selectFrom('chore_completion')
    .select('occurrence_date')
    .where('chore_id', '=', choreId)
    .execute();
  const completedDates = new Set(existing.map((row) => row.occurrence_date));

  const today = await householdToday(db, chore.household_id);
  const occurrenceToClose = occurrenceToComplete(recurrence, completedDates, today);

  if (input.occurrenceDate !== undefined && input.occurrenceDate !== occurrenceToClose) {
    // isValidOccurrence rules out a date that could never be any chore's occurrence at all (a
    // shape error); completedDates rules out a date this chore already closed (a replay that
    // should 409, not silently pick a different, wrong occurrence to close instead). Anything
    // else that disagrees with the server's own answer is a would-be skip-ahead or backfill.
    if (!isValidOccurrence(recurrence, input.occurrenceDate)) {
      throw fail(400, 'That date is not one of this chore’s occurrences.');
    }
    if (completedDates.has(input.occurrenceDate)) {
      throw fail(409, 'That occurrence is already completed.');
    }
    throw fail(400, 'That date is not this chore’s current occurrence to complete.');
  }

  await db
    .insertInto('chore_completion')
    .values({
      ...(input.id === undefined ? {} : { id: input.id }),
      chore_id: choreId,
      occurrence_date: occurrenceToClose,
      completed_by: userId,
    })
    .onConflict((conflict) => conflict.column('id').doNothing())
    .execute();

  if (chore.rotation_order !== null) {
    const newTurn = currentTurn(
      chore.rotation_order,
      chore.rotation_offset,
      completedDates.size + 1,
    );
    await enqueueChoreRotation(db, chore, newTurn, occurrenceToClose);
  }

  return getChoreDetail(db, choreId);
}

/**
 * Undoes the most recent completion by deleting it (PRD, "Recurrence is anchored and derived on
 * read": "Deleting the most recent completion reopens its occurrence and moves the rotation back
 * one turn, since both are derived from the remaining completions"). "Most recent" means the
 * greatest `occurrence_date`: that column is unique per chore and strictly increasing with each
 * successive completion (see `toChore` above), so there is no separate `completed_at` tie-break to
 * consider. Also deletes that occurrence's unsent `chore_rotation` row, if any — a push already
 * sent stays sent (PRD, same section; Technical Architecture, "API surface" › "Chores").
 */
export async function deleteChoreCompletion(
  db: Kysely<Database>,
  choreId: string,
  completionId: string,
): Promise<void> {
  const chore = await requireChoreRow(db, choreId);
  await markHouseholdActive(db, chore.household_id);

  const completion = await db
    .selectFrom('chore_completion')
    .select(['id', 'occurrence_date'])
    .where('id', '=', completionId)
    .where('chore_id', '=', choreId)
    .executeTakeFirst();
  if (completion === undefined) throw fail(404, 'Completion not found.');

  const mostRecent = await db
    .selectFrom('chore_completion')
    .select('occurrence_date')
    .where('chore_id', '=', choreId)
    .orderBy('occurrence_date', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (mostRecent?.occurrence_date !== completion.occurrence_date) {
    throw fail(409, 'Only the most recent completion can be deleted.');
  }

  await db.deleteFrom('chore_completion').where('id', '=', completionId).execute();
  await db
    .deleteFrom('notification')
    .where('type', '=', 'chore_rotation')
    .where('target_id', '=', choreId)
    .where('occurrence_key', '=', completion.occurrence_date)
    .where('sent_at', 'is', null)
    .execute();
}
