import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Errand, Household } from '@hestia/shared';
import {
  as,
  signUp,
  uniqueName,
  uniquePostalCode,
  type SignedUpUser,
} from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';
import { currentInstant } from './test/zone-dates.js';

/*
 * Errands, against real Postgres.
 */

registerStackHooks();

interface Home {
  admin: SignedUpUser;
  household: Household;
}

async function createHome(): Promise<Home> {
  // Plain names: signUp's own random suffix on the email is what makes it unique (see the same
  // note in chores.integration.test.ts).
  const admin = await signUp(app, 'Admin');
  const created = await as(app, admin, 'POST', '/api/households', {
    name: uniqueName('Household'),
    postalCode: uniquePostalCode(),
    timezone: 'America/New_York',
  });
  expectStatus(created, 201);
  return { admin, household: created.json<Household>() };
}

async function inviteMember(home: Home): Promise<SignedUpUser> {
  const invite = await as(app, home.admin, 'POST', `/api/households/${home.household.id}/invites`);
  expectStatus(invite, 201);
  const { code } = invite.json<{ code: string }>();
  const member = await signUp(app, 'Member');
  expectStatus(await as(app, member, 'POST', '/api/households/join', { tokenOrCode: code }), 200);
  return member;
}

async function createErrand(home: Home, body: Record<string, unknown>): Promise<Errand> {
  const response = await as(
    app,
    home.admin,
    'POST',
    `/api/households/${home.household.id}/errands`,
    body,
  );
  expectStatus(response, 201);
  return response.json<Errand>();
}

describe('errands: RLS isolation', () => {
  it('hides an errand from someone outside its household, as 404 not 403', async () => {
    const a = await createHome();
    const b = await createHome();
    const errand = await createErrand(a, { name: 'Return Amazon package' });

    expectStatus(await as(app, b.admin, 'GET', `/api/errands/${errand.id}`), 404);
    expectStatus(await as(app, b.admin, 'GET', `/api/households/${a.household.id}/errands`), 404);
  });
});

describe('errands: create', () => {
  it('adds an errand with a due date and an assignee', async () => {
    const home = await createHome();
    const member = await inviteMember(home);
    const errand = await createErrand(home, {
      name: 'Renew car registration',
      dueDate: '2030-01-01',
      assignedTo: member.id,
    });
    expect(errand).toMatchObject({
      name: 'Renew car registration',
      dueDate: '2030-01-01',
      assignedTo: member.id,
      status: 'open',
      completedAt: null,
      completedBy: null,
    });
  });

  it('is idempotent on a client-generated id', async () => {
    const home = await createHome();
    const id = randomUUID();
    const first = await createErrand(home, { id, name: 'Buy birthday card' });
    expect(first.id).toBe(id);

    const replay = await as(
      app,
      home.admin,
      'POST',
      `/api/households/${home.household.id}/errands`,
      { id, name: 'Buy birthday card' },
    );
    expectStatus(replay, 201);
    expect(replay.json<Errand>().id).toBe(id);

    const list = await as(app, home.admin, 'GET', `/api/households/${home.household.id}/errands`);
    expect(list.json<Errand[]>().filter((errand) => errand.id === id)).toHaveLength(1);
  });
});

describe('errands: status transitions', () => {
  it('stamps completedAt/completedBy from the JWT when marked done, never from the client', async () => {
    const home = await createHome();
    const member = await inviteMember(home);
    const errand = await createErrand(home, { name: 'Mail rent check' });

    // A client-supplied completedBy is not even a field the schema accepts; the caller's own JWT
    // (the member marking it done, not the admin who created it) is what lands.
    const done = await as(app, member, 'PATCH', `/api/errands/${errand.id}`, {
      status: 'done',
      completedBy: home.admin.id,
    });
    expectStatus(done, 200);
    const doneBody = done.json<Errand>();
    expect(doneBody.status).toBe('done');
    expect(doneBody.completedBy).toBe(member.id);
    expect(doneBody.completedAt).not.toBeNull();

    // Reopening clears both fields.
    const reopened = await as(app, home.admin, 'PATCH', `/api/errands/${errand.id}`, {
      status: 'open',
    });
    expectStatus(reopened, 200);
    const reopenedBody = reopened.json<Errand>();
    expect(reopenedBody.status).toBe('open');
    expect(reopenedBody.completedBy).toBeNull();
    expect(reopenedBody.completedAt).toBeNull();
  });

  it('sets every field absolutely, never toggling', async () => {
    const home = await createHome();
    const errand = await createErrand(home, {
      name: 'Pick up dry cleaning',
      dueDate: '2030-06-01',
    });

    const updated = await as(app, home.admin, 'PATCH', `/api/errands/${errand.id}`, {
      name: 'Pick up and drop off dry cleaning',
      dueDate: null,
    });
    expectStatus(updated, 200);
    expect(updated.json<Errand>()).toMatchObject({
      name: 'Pick up and drop off dry cleaning',
      dueDate: null,
    });
  });

  it('refuses an empty PATCH', async () => {
    const home = await createHome();
    const errand = await createErrand(home, { name: 'Replace porch light bulb' });
    const response = await as(app, home.admin, 'PATCH', `/api/errands/${errand.id}`, {});
    expectStatus(response, 400);
  });
});

describe('errands: offline done', () => {
  async function markDone(actor: SignedUpUser, errandId: string, doneAt: string): Promise<Errand> {
    const response = await as(app, actor, 'PATCH', `/api/errands/${errandId}`, {
      status: 'done',
      doneAt,
    });
    expectStatus(response, 200);
    return response.json<Errand>();
  }

  it('a replayed done changes nothing, even when another member sends it', async () => {
    const home = await createHome();
    const member = await inviteMember(home);
    const errand = await createErrand(home, { name: 'Mail rent check' });
    const doneAt = new Date(currentInstant().getTime() - 60_000).toISOString();

    await markDone(home.admin, errand.id, doneAt);
    const replay = await markDone(member, errand.id, doneAt);

    expect(replay.completedAt).toBe(doneAt);
    expect(replay.completedBy).toBe(home.admin.id);
  });

  it('stores the moment the member acted, not the moment the request landed', async () => {
    const home = await createHome();
    const errand = await createErrand(home, { name: 'Return Amazon package' });
    const doneAt = new Date(currentInstant().getTime() - 2 * 60 * 60_000).toISOString();

    const done = await markDone(home.admin, errand.id, doneAt);

    expect(done.completedAt).toBe(doneAt);
  });

  it('clamps a done time in the future to now', async () => {
    const home = await createHome();
    const errand = await createErrand(home, { name: 'Renew car registration' });
    const doneAt = new Date(currentInstant().getTime() + 24 * 60 * 60_000).toISOString();

    const done = await markDone(home.admin, errand.id, doneAt);

    const completedAt = done.completedAt;
    if (completedAt === null) throw new Error('expected a completion time');
    expect(Date.parse(completedAt)).toBeLessThanOrEqual(currentInstant().getTime() + 5000);
  });
});

describe('errands: list and delete', () => {
  it('lists open before done, and removes an errand', async () => {
    const home = await createHome();
    const open = await createErrand(home, { name: 'Buy birthday card' });
    const done = await createErrand(home, { name: 'Mail rent check' });
    expectStatus(
      await as(app, home.admin, 'PATCH', `/api/errands/${done.id}`, { status: 'done' }),
      200,
    );

    const list = await as(app, home.admin, 'GET', `/api/households/${home.household.id}/errands`);
    const names = list.json<Errand[]>().map((errand) => errand.name);
    expect(names.indexOf(open.name)).toBeLessThan(names.indexOf(done.name));

    const deleted = await as(app, home.admin, 'DELETE', `/api/errands/${open.id}`);
    expectStatus(deleted, 204);
    expectStatus(await as(app, home.admin, 'GET', `/api/errands/${open.id}`), 404);
  });
});
