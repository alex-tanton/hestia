import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Chore, ChoreDetail, Household } from '@hearth/shared';
import {
  adminPool,
  as,
  signUp,
  startStack,
  uniqueName,
  uniquePostalCode,
  type SignedUpUser,
  type Stack,
} from './test/service-stack.js';

/*
 * Chores, completions, rotation, and undo, against real Postgres (Technical Architecture, "API
 * surface" › "Chores"; PRD, "Recurrence is anchored and derived on read", "Rotation"). Every
 * request goes through withUserDb as hearth_service, so RLS decides every isolation assertion.
 */

let stack: Stack;
let app: FastifyInstance;

beforeAll(async () => {
  stack = await startStack();
});

beforeEach(async () => {
  app = await stack.newApp();
});

afterAll(async () => {
  await stack.close();
});

function expectStatus(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode, response.body).toBe(status);
}

/** Narrows a possibly-missing id so it is never interpolated into a URL as the string "undefined". */
function defined(value: string | undefined): string {
  if (value === undefined) throw new Error('expected a defined id');
  return value;
}

interface Home {
  admin: SignedUpUser;
  household: Household;
  /** admin first, then every joined member, in join order. */
  members: SignedUpUser[];
}

/** A household with `extraMembers` more members joined alongside the admin, via invite code. */
async function createHome(extraMembers = 0): Promise<Home> {
  // Plain names: signUp's own random suffix on the email is what makes it unique. uniqueName()
  // appends digits, which signUp's email-sanitizing regex turns into a trailing dot — fine for a
  // household name, but it collides with signUp's own ".<uuid>" suffix into an invalid
  // double-dot email ("admin.a.b.c..abcd1234@example.com").
  const admin = await signUp(app, 'Admin');
  const created = await as(app, admin, 'POST', '/api/households', {
    name: uniqueName('Household'),
    postalCode: uniquePostalCode(),
    timezone: 'America/New_York',
  });
  expectStatus(created, 201);
  const household = created.json<Household>();
  const members: SignedUpUser[] = [admin];
  for (let i = 0; i < extraMembers; i += 1) {
    const invite = await as(app, admin, 'POST', `/api/households/${household.id}/invites`);
    expectStatus(invite, 201);
    const { code } = invite.json<{ code: string }>();
    const member = await signUp(app, 'Member');
    expectStatus(await as(app, member, 'POST', '/api/households/join', { tokenOrCode: code }), 200);
    members.push(member);
  }
  return { admin, household, members };
}

async function createChore(
  home: Home,
  body: Record<string, unknown>,
  actor: SignedUpUser = home.admin,
): Promise<ChoreDetail> {
  const response = await as(
    app,
    actor,
    'POST',
    `/api/households/${home.household.id}/chores`,
    body,
  );
  expectStatus(response, 201);
  return response.json<ChoreDetail>();
}

async function getChore(actor: SignedUpUser, choreId: string): Promise<ChoreDetail> {
  const response = await as(app, actor, 'GET', `/api/chores/${choreId}`);
  expectStatus(response, 200);
  return response.json<ChoreDetail>();
}

async function complete(
  actor: SignedUpUser,
  choreId: string,
  body: Record<string, unknown> = {},
): Promise<ChoreDetail> {
  const response = await as(app, actor, 'POST', `/api/chores/${choreId}/complete`, body);
  expectStatus(response, 201);
  return response.json<ChoreDetail>();
}

/** A far-enough-in-the-past weekly anchor that the current occurrence is always within the last
 * 6 days — close enough to exercise "overdue" and "due today", never so close the next occurrence
 * is ambiguous with "today" across a test run. */
const WEEKLY_ANCHOR_DAYS_AGO = 60;

async function weeklyAnchor(home: Home): Promise<string> {
  const { rows } = await adminPool.query<{ anchor: string }>(
    `select ((now() at time zone h.timezone)::date - $2::int)::text as anchor
     from public.household h where h.id = $1`,
    [home.household.id, WEEKLY_ANCHOR_DAYS_AGO],
  );
  const anchor = rows[0]?.anchor;
  if (anchor === undefined) throw new Error('household not found while computing anchor');
  return anchor;
}

describe('chores: RLS isolation', () => {
  it('hides a chore from someone outside its household, as 404 not 403', async () => {
    const a = await createHome();
    const b = await createHome();
    const chore = await createChore(a, {
      name: 'Water plants',
      recurrenceUnit: 'day',
      interval: 1,
      anchorDate: '2024-01-01',
    });

    const asB = await as(app, b.admin, 'GET', `/api/chores/${chore.id}`);
    expectStatus(asB, 404);

    const listAsB = await as(app, b.admin, 'GET', `/api/households/${a.household.id}/chores`);
    expectStatus(listAsB, 404);
  });
});

describe('chores: rotation', () => {
  it('advances the turn from the scheduled member, not from whoever completed it', async () => {
    const home = await createHome(2);
    const [alex, sam, jordan] = home.members as [SignedUpUser, SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id, jordan.id] },
    });
    expect(chore.currentTurn).toBe(alex.id);
    expect(chore.nextTurn).toBe(sam.id);

    // Jordan does Alex's scheduled turn (PRD, "Rotation": "If Sam does Alex's turn, the next turn
    // is still the member after Alex").
    const afterCompletion = await complete(jordan, chore.id);
    expect(afterCompletion.lastCompletion?.completedBy).toBe(jordan.id);
    expect(afterCompletion.currentTurn).toBe(sam.id);
    expect(afterCompletion.nextTurn).toBe(jordan.id);
  });

  it('does not pass the turn for a missed occurrence — only a completion does', async () => {
    const home = await createHome(1);
    const [alex, sam] = home.members as [SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Clean bathroom',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });
    // 60 days of weekly occurrences have gone by with nothing completed: the current occurrence
    // is overdue, but completion_count is still 0, so the turn has not moved.
    expect(chore.isOverdue).toBe(true);
    expect(chore.currentTurn).toBe(alex.id);

    const reread = await getChore(alex, chore.id);
    expect(reread.currentTurn).toBe(alex.id);
    expect(reread.dueDate).toBe(chore.dueDate);
  });

  it('closes the upcoming occurrence when completed early', async () => {
    const home = await createHome();
    const { rows } = await adminPool.query<{ future: string }>(
      `select ((now() at time zone h.timezone)::date + 30)::text as future
       from public.household h where h.id = $1`,
      [home.household.id],
    );
    const future = rows[0]?.future;
    if (future === undefined) throw new Error('household not found');
    const chore = await createChore(home, {
      name: 'Deep clean fridge',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: future,
    });
    expect(chore.dueDate).toBe(future);
    expect(chore.isOverdue).toBe(false);

    const completed = await complete(home.admin, chore.id);
    expect(completed.lastCompletion?.occurrenceDate).toBe(future);
    expect(completed.completions).toHaveLength(1);
  });
});

describe('chores: undo', () => {
  it('reverts both the occurrence and the rotation, and cleans up the unsent chore_rotation row', async () => {
    const home = await createHome(1);
    const [alex, sam] = home.members as [SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const before = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });

    const afterCompletion = await complete(alex, before.id);
    const completionId = afterCompletion.lastCompletion?.id;
    const closedDate = afterCompletion.lastCompletion?.occurrenceDate;
    expect(completionId).toBeDefined();
    expect(afterCompletion.currentTurn).toBe(sam.id);

    const rotationRows = await adminPool.query<{ sent_at: Date | null }>(
      `select sent_at from public.notification
       where type = 'chore_rotation' and target_id = $1 and occurrence_key = $2`,
      [before.id, closedDate],
    );
    expect(rotationRows.rows).toHaveLength(1);
    expect(rotationRows.rows[0]?.sent_at).toBeNull();

    const undone = await as(
      app,
      alex,
      'DELETE',
      `/api/chores/${before.id}/completions/${defined(completionId)}`,
    );
    expectStatus(undone, 204);

    const reverted = await getChore(alex, before.id);
    expect(reverted.currentTurn).toBe(alex.id);
    expect(reverted.dueDate).toBe(before.dueDate);
    expect(reverted.completions).toHaveLength(0);

    const rotationRowsAfter = await adminPool.query<{ exists: boolean }>(
      `select 1 from public.notification
       where type = 'chore_rotation' and target_id = $1 and occurrence_key = $2`,
      [before.id, closedDate],
    );
    expect(rotationRowsAfter.rows).toHaveLength(0);
  });

  it('complete, undo, re-complete leaves the rotation exactly as if never undone', async () => {
    const home = await createHome(2);
    const [alex, sam, jordan] = home.members as [SignedUpUser, SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id, jordan.id] },
    });

    const firstPass = await complete(jordan, chore.id); // Jordan does Alex's scheduled turn.
    const firstCompletionId = defined(firstPass.lastCompletion?.id);
    const firstClosedDate = firstPass.lastCompletion?.occurrenceDate;
    expect(firstPass.currentTurn).toBe(sam.id);

    expectStatus(
      await as(app, alex, 'DELETE', `/api/chores/${chore.id}/completions/${firstCompletionId}`),
      204,
    );

    // Someone else does it the second time around — the rule under test (rotation advances from
    // the scheduled member, never the completer) must hold again, identically, after the undo.
    const secondPass = await complete(sam, chore.id);
    expect(secondPass.lastCompletion?.id).not.toBe(firstCompletionId); // a new completion row.
    expect(secondPass.lastCompletion?.occurrenceDate).toBe(firstClosedDate); // same occurrence.
    expect(secondPass.lastCompletion?.completedBy).toBe(sam.id); // records who actually did it...
    expect(secondPass.currentTurn).toBe(sam.id); // ...but the turn is exactly where it was before.
    expect(secondPass.nextTurn).toBe(firstPass.nextTurn);
    expect(secondPass.dueDate).toBe(firstPass.dueDate);
    expect(secondPass.isOverdue).toBe(firstPass.isOverdue);
    expect(secondPass.completions).toHaveLength(1);
  });

  it('refuses to delete anything but the most recent completion, with 409', async () => {
    const home = await createHome();
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Vacuum common areas',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
    });

    const first = await complete(home.admin, chore.id);
    const firstCompletionId = first.lastCompletion?.id;
    const firstDate = first.lastCompletion?.occurrenceDate;
    expect(first.isOverdue).toBe(false); // the just-closed occurrence is no longer current.

    const second = await complete(home.admin, chore.id); // early-closes the following occurrence.
    const secondCompletionId = second.lastCompletion?.id;
    expect(second.completions).toHaveLength(2);
    expect(secondCompletionId).not.toBe(firstCompletionId);

    const refused = await as(
      app,
      home.admin,
      'DELETE',
      `/api/chores/${chore.id}/completions/${defined(firstCompletionId)}`,
    );
    expectStatus(refused, 409);

    const allowed = await as(
      app,
      home.admin,
      'DELETE',
      `/api/chores/${chore.id}/completions/${defined(secondCompletionId)}`,
    );
    expectStatus(allowed, 204);

    const after = await getChore(home.admin, chore.id);
    expect(after.completions).toHaveLength(1);
    expect(after.completions[0]?.occurrenceDate).toBe(firstDate);
    // Back to exactly the state right after the first completion, before the second ever ran.
    expect(after.dueDate).toBe(first.dueDate);
  });
});

describe('chores: idempotent completion', () => {
  it('replaying the same client-generated completion id is a no-op', async () => {
    const home = await createHome(1);
    const [alex, sam] = home.members as [SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });

    // A fresh random id each run: these tests commit real rows rather than rolling back, so a
    // fixed literal here would collide with a previous run's leftover completion.
    const completionId = randomUUID();
    const first = await complete(alex, chore.id, { id: completionId });
    expect(first.completions).toHaveLength(1);
    expect(first.currentTurn).toBe(sam.id);

    const replay = await complete(alex, chore.id, { id: completionId });
    expect(replay.completions).toHaveLength(1);
    expect(replay.currentTurn).toBe(sam.id); // not advanced a second time.
  });
});

describe('chores: offline completion', () => {
  async function queuedChore(
    home: Home,
  ): Promise<{ alex: SignedUpUser; sam: SignedUpUser; choreId: string }> {
    const [alex, sam] = home.members as [SignedUpUser, SignedUpUser];
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: await weeklyAnchor(home),
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });
    return { alex, sam, choreId: chore.id };
  }

  it('a replayed completion, with its id, occurrence, and action time, changes nothing', async () => {
    const home = await createHome(1);
    const { alex, sam, choreId } = await queuedChore(home);
    const before = await getChore(alex, choreId);
    const body = {
      id: randomUUID(),
      occurrenceDate: before.dueDate,
      doneAt: new Date(Date.now() - 60_000).toISOString(),
    };

    const first = await complete(alex, choreId, body);
    // Another member replays it: the id is already there, so it is a no-op.
    const replay = await complete(sam, choreId, body);

    expect(replay.completions).toHaveLength(1);
    expect(replay.currentTurn).toBe(first.currentTurn);
    expect(replay.completions[0]?.completedBy).toBe(alex.id);
  });

  it('stores the moment the member acted, not the moment the request landed', async () => {
    const home = await createHome(1);
    const { alex, choreId } = await queuedChore(home);
    const doneAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString();

    const detail = await complete(alex, choreId, { id: randomUUID(), doneAt });

    expect(detail.completions[0]?.completedAt).toBe(doneAt);
  });

  it('clamps an action time in the future to now', async () => {
    const home = await createHome(1);
    const { alex, choreId } = await queuedChore(home);
    const doneAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

    const detail = await complete(alex, choreId, { id: randomUUID(), doneAt });

    const completedAt = detail.completions[0]?.completedAt;
    if (completedAt === undefined) throw new Error('expected a completion');
    expect(Date.parse(completedAt)).toBeLessThanOrEqual(Date.now());
  });
});

describe('chores: attribution', () => {
  it('ignores a client-supplied completedBy and records the caller from the JWT', async () => {
    const home = await createHome(1);
    const [alex, sam] = home.members as [SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Water plants',
      recurrenceUnit: 'day',
      interval: 3,
      anchorDate: anchor,
    });

    const completed = await complete(sam, chore.id, { completedBy: alex.id });
    expect(completed.lastCompletion?.completedBy).toBe(sam.id);
  });
});

describe('chores: update and delete', () => {
  it('updates name, recurrence, and reassigns from a rotation to a single member', async () => {
    const home = await createHome(1);
    const [alex, sam] = home.members as [SignedUpUser, SignedUpUser];
    const chore = await createChore(home, {
      name: 'Replace HVAC filter',
      recurrenceUnit: 'month',
      interval: 1,
      anchorDate: '2024-01-01',
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });

    const updated = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      name: 'Replace furnace filter',
      assignment: { type: 'single', assignedTo: sam.id },
    });
    expectStatus(updated, 200);
    const body = updated.json<ChoreDetail>();
    expect(body.name).toBe('Replace furnace filter');
    expect(body.assignedTo).toBe(sam.id);
    expect(body.rotationOrder).toBeNull();
    expect(body.currentTurn).toBeNull();
  });

  it('deletes a chore and its completion history', async () => {
    const home = await createHome();
    const chore = await createChore(home, {
      name: 'Buy birthday card',
      recurrenceUnit: 'month',
      interval: 1,
      anchorDate: '2024-01-01',
    });
    await complete(home.admin, chore.id);

    const deleted = await as(app, home.admin, 'DELETE', `/api/chores/${chore.id}`);
    expectStatus(deleted, 204);

    const gone = await as(app, home.admin, 'GET', `/api/chores/${chore.id}`);
    expectStatus(gone, 404);
  });
});

describe('chores: rotation edit (U4.3b)', () => {
  it('a pure reorder of the rotation preserves whose turn it is', async () => {
    const home = await createHome(2);
    const [alex, sam, jordan] = home.members as [SignedUpUser, SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id, jordan.id] },
    });
    const afterCompletion = await complete(alex, chore.id);
    expect(afterCompletion.currentTurn).toBe(sam.id);

    const reordered = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      assignment: { type: 'rotation', rotationOrder: [jordan.id, sam.id, alex.id] },
    });
    expectStatus(reordered, 200);
    const body = reordered.json<ChoreDetail>();
    expect(body.rotationOrder).toEqual([jordan.id, sam.id, alex.id]);
    expect(body.currentTurn).toBe(sam.id); // same person still has the turn, despite reordering.
  });

  it('appending a new member to the rotation preserves the current turn', async () => {
    const home = await createHome(2);
    const [alex, sam, jordan] = home.members as [SignedUpUser, SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });
    const afterCompletion = await complete(alex, chore.id);
    expect(afterCompletion.currentTurn).toBe(sam.id);

    const appended = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id, jordan.id] },
    });
    expectStatus(appended, 200);
    expect(appended.json<ChoreDetail>().currentTurn).toBe(sam.id);
  });

  it('removing the currently-scheduled member resets the offset to 0 (no history, so the first remaining member is next)', async () => {
    const home = await createHome(1);
    const [alex, sam] = home.members as [SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });
    expect(chore.currentTurn).toBe(alex.id);

    const edited = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      assignment: { type: 'rotation', rotationOrder: [sam.id] },
    });
    expectStatus(edited, 200);
    const body = edited.json<ChoreDetail>();
    expect(body.rotationOffset).toBe(0);
    expect(body.currentTurn).toBe(sam.id); // only member left, not "preserved" — just the new start.
  });

  it("removing a different, non-scheduled member preserves the scheduled member's turn", async () => {
    const home = await createHome(2);
    const [alex, sam, jordan] = home.members as [SignedUpUser, SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id, jordan.id] },
    });
    const afterCompletion = await complete(alex, chore.id);
    expect(afterCompletion.currentTurn).toBe(sam.id);

    const edited = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });
    expectStatus(edited, 200);
    expect(edited.json<ChoreDetail>().currentTurn).toBe(sam.id);
  });

  it('an edit that does not touch rotation_order leaves rotation_offset untouched', async () => {
    const home = await createHome(2);
    const [alex, sam, jordan] = home.members as [SignedUpUser, SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id, jordan.id] },
    });
    const afterCompletion = await complete(alex, chore.id);
    expect(afterCompletion.currentTurn).toBe(sam.id);

    const renamed = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      name: 'Take out the trash',
    });
    expectStatus(renamed, 200);
    const body = renamed.json<ChoreDetail>();
    expect(body.name).toBe('Take out the trash');
    expect(body.currentTurn).toBe(sam.id);
    expect(body.rotationOrder).toEqual([alex.id, sam.id, jordan.id]);
  });

  it('round-tripping through single-assignee mode restarts the rotation rather than preserving a stale turn', async () => {
    const home = await createHome(2);
    const [alex, sam, jordan] = home.members as [SignedUpUser, SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id, jordan.id] },
    });
    // Two completions: turn is (0+2) mod 3 = index 2, jordan.
    await complete(alex, chore.id);
    const afterTwo = await complete(alex, chore.id);
    expect(afterTwo.currentTurn).toBe(jordan.id);

    // A reorder (not a mode switch) that keeps jordan's turn, landing a non-zero rotation_offset.
    const reordered = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      assignment: { type: 'rotation', rotationOrder: [sam.id, jordan.id, alex.id] },
    });
    expectStatus(reordered, 200);
    expect(reordered.json<ChoreDetail>().currentTurn).toBe(jordan.id);
    expect(reordered.json<ChoreDetail>().rotationOffset).toBe(2);

    const toSingle = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      assignment: { type: 'single', assignedTo: alex.id },
    });
    expectStatus(toSingle, 200);
    expect(toSingle.json<ChoreDetail>().rotationOrder).toBeNull();

    // Back into rotation with the exact order that had a non-zero, jordan-preserving offset right
    // before the mode switch. If that stale offset were resurrected, the turn would still be
    // jordan's. It isn't: re-entering rotation mode starts fresh at offset 0 regardless.
    const backToRotation = await as(app, home.admin, 'PATCH', `/api/chores/${chore.id}`, {
      assignment: { type: 'rotation', rotationOrder: [sam.id, jordan.id, alex.id] },
    });
    expectStatus(backToRotation, 200);
    const body = backToRotation.json<ChoreDetail>();
    expect(body.rotationOffset).toBe(0);
    expect(body.currentTurn).toBe(alex.id); // (0 + 2) mod 3 = index 2 of [sam, jordan, alex].
  });
});

describe('chores: list and detail', () => {
  it('lists chores created in a household', async () => {
    const home = await createHome();
    await createChore(home, {
      name: 'Mow the lawn',
      recurrenceUnit: 'week',
      interval: 2,
      anchorDate: '2024-01-01',
    });
    const list = await as(app, home.admin, 'GET', `/api/households/${home.household.id}/chores`);
    expectStatus(list, 200);
    expect(list.json<Chore[]>().map((chore) => chore.name)).toEqual(['Mow the lawn']);
  });

  it('includes the next three occurrence dates on the detail view', async () => {
    const home = await createHome();
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Deep clean fridge',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
    });
    const detail = await getChore(home.admin, chore.id);
    expect(detail.previewDates).toHaveLength(3);
    expect(detail.previewDates[0]).toBe(chore.dueDate);
    let increasing = true;
    for (let index = 1; index < detail.previewDates.length; index += 1) {
      const prev = detail.previewDates[index - 1];
      const curr = detail.previewDates[index];
      if (prev === undefined || curr === undefined || curr <= prev) increasing = false;
    }
    expect(increasing).toBe(true);
  });
});

describe('chores: explicit occurrenceDate (Phase 5 forward-compatibility)', () => {
  // POST /chores/:id/complete accepts an optional client-supplied occurrenceDate, for Phase 5's
  // offline queue (see apps/service/src/chores/chores.ts, the completeChore doc comment). This
  // phase's own UI never sends it, but the field is validated here since the route accepts it.
  it('accepts a valid, not-yet-completed occurrence date and uses it as-is', async () => {
    const home = await createHome();
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Water plants',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
    });
    const completed = await complete(home.admin, chore.id, { occurrenceDate: chore.dueDate });
    expect(completed.lastCompletion?.occurrenceDate).toBe(chore.dueDate);
  });

  it('rejects a date that is not one of the chore’s own occurrences', async () => {
    const home = await createHome();
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Water plants',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
    });
    // One day off the weekly cadence can never be a real occurrence date.
    const offCycle = new Date(`${chore.dueDate}T00:00:00Z`);
    offCycle.setUTCDate(offCycle.getUTCDate() + 1);
    const response = await as(app, home.admin, 'POST', `/api/chores/${chore.id}/complete`, {
      occurrenceDate: offCycle.toISOString().slice(0, 10),
    });
    expectStatus(response, 400);
  });

  it('refuses to re-close an already-completed occurrence, with 409', async () => {
    const home = await createHome();
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Water plants',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
    });
    await complete(home.admin, chore.id, { occurrenceDate: chore.dueDate });
    const replay = await as(app, home.admin, 'POST', `/api/chores/${chore.id}/complete`, {
      occurrenceDate: chore.dueDate,
    });
    expectStatus(replay, 409);
  });

  it('refuses a valid but far-future occurrence date: no skipping ahead of the current occurrence', async () => {
    const home = await createHome(1);
    const [alex, sam] = home.members as [SignedUpUser, SignedUpUser];
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
      assignment: { type: 'rotation', rotationOrder: [alex.id, sam.id] },
    });
    // A real, on-cycle occurrence of this chore, but ten weeks past the current one: on-cadence
    // (so isValidOccurrence alone would accept it), just not the one actually due.
    const farFuture = new Date(`${chore.dueDate}T00:00:00Z`);
    farFuture.setUTCDate(farFuture.getUTCDate() + 70);
    const response = await as(app, alex, 'POST', `/api/chores/${chore.id}/complete`, {
      occurrenceDate: farFuture.toISOString().slice(0, 10),
    });
    expectStatus(response, 400);

    // Neither the occurrence nor the rotation moved.
    const reread = await getChore(alex, chore.id);
    expect(reread.dueDate).toBe(chore.dueDate);
    expect(reread.currentTurn).toBe(alex.id);
    expect(reread.completions).toHaveLength(0);
  });

  it('refuses to backfill a missed occurrence that has already stopped being due', async () => {
    const home = await createHome();
    const anchor = await weeklyAnchor(home);
    const chore = await createChore(home, {
      name: 'Water plants',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: anchor,
    });
    // The anchor itself is the very first occurrence — 60 days (far more than one week) before
    // today, so it has long since stopped being the current occurrence (PRD: "missed occurrences
    // do not stack up and are never backfilled").
    const response = await as(app, home.admin, 'POST', `/api/chores/${chore.id}/complete`, {
      occurrenceDate: anchor,
    });
    expectStatus(response, 400);

    const reread = await getChore(home.admin, chore.id);
    expect(reread.completions).toHaveLength(0);
  });
});
