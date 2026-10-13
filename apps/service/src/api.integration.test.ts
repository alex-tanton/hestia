import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  CreatedInvite,
  DeparturePreview,
  Household,
  Invite,
  Member,
  ProfileResponse,
} from '@hearth/shared';
import { runCli } from './cli.js';
import type { Database } from './db.js';
import { withUserDb } from './db/user-db.js';
import { createGoTrueAdmin } from './privileged/gotrue-admin.js';
import { errorFingerprint } from './services/errors.js';
import {
  adminPool,
  as,
  GOOD_PASSWORD,
  signIn,
  signUp,
  stackConfig,
  startStack,
  TEST_ORIGIN,
  uniqueName,
  type SignedUpUser,
  type Stack,
} from './test/service-stack.js';
import { currentInstant } from './test/zone-dates.js';

/*
 * The service end to end against `supabase start`: real GoTrue, real Postgres as hearth_service,
 * every request through withUserDb. Each test makes its own users and households.
 */

let stack: Stack;
let app: FastifyInstance;

beforeAll(async () => {
  stack = await startStack();
});

beforeEach(async () => {
  // A fresh app per test, so the in-memory per-IP rate limits never carry over.
  app = await stack.newApp();
});

afterAll(async () => {
  await stack.close();
});

function expectStatus(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode, response.body).toBe(status);
}

async function createHousehold(
  user: SignedUpUser,
  name = uniqueName('Oak Street'),
  postalCode = '27514',
): Promise<Household> {
  const response = await as(app, user, 'POST', '/api/households', {
    name,
    postalCode,
    timezone: 'America/New_York',
  });
  expectStatus(response, 201);
  return response.json<Household>();
}

async function invite(admin: SignedUpUser, householdId: string): Promise<CreatedInvite> {
  const response = await as(app, admin, 'POST', `/api/households/${householdId}/invites`);
  expectStatus(response, 201);
  return response.json<CreatedInvite>();
}

function tokenFromLink(link: string): string {
  const token = new URL(link).hash.replace(/^#token=/, '');
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  return token;
}

/** A household with an admin and a member who has joined by link. */
async function householdWithMember(): Promise<{
  admin: SignedUpUser;
  member: SignedUpUser;
  household: Household;
}> {
  const admin = await signUp(app, 'Alex Rivera');
  const member = await signUp(app, 'Sam Chen');
  const household = await createHousehold(admin);
  const created = await invite(admin, household.id);
  expectStatus(
    await as(app, member, 'POST', '/api/households/join', {
      tokenOrCode: tokenFromLink(created.link),
    }),
    200,
  );
  return { admin, member, household };
}

async function profile(user: SignedUpUser): Promise<ProfileResponse> {
  const response = await as(app, user, 'GET', '/api/users/me');
  expectStatus(response, 200);
  return response.json<ProfileResponse>();
}

async function insertId(text: string, params: unknown[]): Promise<string> {
  const { rows } = await adminPool.query<{ id: string }>(text, params);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`no id from ${text}`);
  return id;
}

describe('signup', () => {
  it('rejects a common password before GoTrue creates anyone', async () => {
    const email = `common.${crypto.randomUUID().slice(0, 8)}@example.com`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/signup',
      remoteAddress: '198.19.0.1',
      payload: { email, password: 'Password123', displayName: 'Common' },
    });
    expectStatus(response, 400);
    const { rows } = await adminPool.query('select 1 from auth.users where email = $1', [email]);
    expect(rows).toHaveLength(0);
  });

  it('creates a profile with the display name and timezone', async () => {
    const user = await signUp(app, 'Morgan Reed', 'America/Chicago');
    const me = await profile(user);
    expect(me).toEqual({
      id: user.id,
      email: user.email,
      displayName: 'Morgan Reed',
      timezone: 'America/Chicago',
      activeHouseholdId: null,
      quietHours: null,
      householdBillReminders: false,
      isServerOwner: false,
      memberships: [],
    });
  });

  it('refuses a second account with the same email', async () => {
    const user = await signUp(app, 'Casey Nguyen');
    const response = await app.inject({
      method: 'POST',
      url: '/api/signup',
      remoteAddress: user.ip,
      payload: { email: user.email, password: GOOD_PASSWORD },
    });
    expect([400, 409]).toContain(response.statusCode);
  });
});

describe('the profile', () => {
  it('marks the server owner, ignoring case', async () => {
    const user = await signUp(app, 'Owner');
    const ownerApp = await stack.newApp({ ownerEmail: user.email.toUpperCase() });
    expect(
      (await as(ownerApp, user, 'GET', '/api/users/me')).json<ProfileResponse>(),
    ).toMatchObject({ isServerOwner: true });
  });

  it('updates name, timezone, quiet hours, and reminders', async () => {
    const user = await signUp(app, 'Jordan Blake');
    const response = await as(app, user, 'PATCH', '/api/users/me', {
      displayName: 'Jordan B.',
      timezone: 'America/Los_Angeles',
      quietHours: { start: '22:00', end: '07:30' },
      householdBillReminders: true,
    });
    expectStatus(response, 200);
    expect(response.json<ProfileResponse>()).toMatchObject({
      displayName: 'Jordan B.',
      timezone: 'America/Los_Angeles',
      quietHours: { start: '22:00', end: '07:30' },
      householdBillReminders: true,
    });
    const cleared = await as(app, user, 'PATCH', '/api/users/me', { quietHours: null });
    expect(cleared.json<ProfileResponse>().quietHours).toBeNull();
  });

  it('refuses a timezone Postgres does not know', async () => {
    const user = await signUp(app, 'Tz');
    expectStatus(await as(app, user, 'PATCH', '/api/users/me', { timezone: 'Mars/Olympus' }), 400);
  });
});

describe('password and email changes', () => {
  it('requires the current password to change it', async () => {
    const user = await signUp(app, 'Pw');
    const next = 'lantern-orchid-canyon-42';
    expectStatus(await as(app, user, 'POST', '/api/users/me/password', { newPassword: next }), 400);
    expectStatus(
      await as(app, user, 'POST', '/api/users/me/password', {
        currentPassword: 'not-my-password',
        newPassword: next,
      }),
      403,
    );
    expectStatus(
      await as(app, user, 'POST', '/api/users/me/password', {
        currentPassword: user.password,
        newPassword: 'iloveyou123',
      }),
      400,
    );
    expectStatus(
      await as(app, user, 'POST', '/api/users/me/password', {
        currentPassword: user.password,
        newPassword: next,
      }),
      204,
    );
    await expect(signIn(user.email, next, user.ip)).resolves.toMatch(/^ey/);
    await expect(signIn(user.email, user.password, user.ip)).rejects.toThrow(/sign-in failed/);
  });

  it('lets a reset link from hearth-admin set a new password without the old one', async () => {
    const user = await signUp(app, 'Forgetful');
    const config = stackConfig();
    const admin = createGoTrueAdmin({
      url: config.gotrueUrl,
      serviceRoleKey: config.serviceRoleKey,
    });
    const out: string[] = [];
    const code = await runCli(['reset-password', user.email], admin, TEST_ORIGIN, {
      out: (line) => out.push(line),
      err: () => undefined,
    });
    expect(code).toBe(0);
    const link = out[0] ?? '';
    expect(link).toContain('/verify?token=');
    expect(link).toContain('type=recovery');

    // Opening the link: GoTrue verifies it and redirects to the set-new-password screen with the
    // session in the fragment.
    const opened = await fetch(link, { redirect: 'manual' });
    expect(opened.status).toBe(303);
    const location = new URL(opened.headers.get('location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe(`${TEST_ORIGIN}/set-password`);
    const fragment = new URLSearchParams(location.hash.slice(1));
    expect(fragment.get('type')).toBe('recovery');
    const recoveryToken = fragment.get('access_token') ?? '';

    const next = 'saffron-kettle-meadow-88';
    expectStatus(
      await as(app, { token: recoveryToken, ip: user.ip }, 'POST', '/api/users/me/password', {
        newPassword: next,
      }),
      204,
    );
    await expect(signIn(user.email, next, user.ip)).resolves.toMatch(/^ey/);

    // The link is one-time.
    const again = await fetch(link, { redirect: 'manual' });
    expect(again.headers.get('location') ?? '').toMatch(/error/);
  });

  it('changes the email after re-verifying the password', async () => {
    const user = await signUp(app, 'Mover');
    const newEmail = `moved.${crypto.randomUUID().slice(0, 8)}@example.com`;
    expectStatus(
      await as(app, user, 'POST', '/api/users/me/email', {
        currentPassword: 'wrong-password',
        newEmail,
      }),
      403,
    );
    expectStatus(
      await as(app, user, 'POST', '/api/users/me/email', {
        currentPassword: user.password,
        newEmail,
      }),
      204,
    );
    expect((await profile(user)).email).toBe(newEmail);
    await expect(signIn(newEmail, user.password, user.ip)).resolves.toMatch(/^ey/);
  });

  it('refuses an email another account has', async () => {
    const taken = await signUp(app, 'Taken');
    const user = await signUp(app, 'Wanter');
    const response = await as(app, user, 'POST', '/api/users/me/email', {
      currentPassword: user.password,
      newEmail: taken.email,
    });
    expect([400, 409]).toContain(response.statusCode);
  });
});

describe('households', () => {
  it('creates, lists, and switches between households', async () => {
    const user = await signUp(app, 'Switcher');
    const first = await createHousehold(user, uniqueName('Oak Street'));
    const second = await createHousehold(user, uniqueName('Lake House'), '28801');
    expect(first).toMatchObject({
      role: 'admin',
      postalCode: '27514',
      timezone: 'America/New_York',
    });

    const list = (await as(app, user, 'GET', '/api/households')).json<Household[]>();
    expect(list.map((household) => household.id)).toEqual([first.id, second.id]);
    expect((await profile(user)).activeHouseholdId).toBe(second.id);

    const switched = await as(app, user, 'PUT', '/api/users/me/active-household', {
      householdId: first.id,
    });
    expectStatus(switched, 200);
    expect(switched.json<ProfileResponse>().activeHouseholdId).toBe(first.id);
    expect((await profile(user)).memberships.map((membership) => membership.householdId)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('refuses switching to a household the caller is not in', async () => {
    const outsider = await signUp(app, 'Outsider');
    const owner = await signUp(app, 'Owner Two');
    const household = await createHousehold(owner);
    expectStatus(
      await as(app, outsider, 'PUT', '/api/users/me/active-household', {
        householdId: household.id,
      }),
      404,
    );
  });

  it('answers 404 to a non-member and lets only the admin edit', async () => {
    const { admin, member, household } = await householdWithMember();
    const outsider = await signUp(app, 'Stranger');
    expectStatus(await as(app, outsider, 'GET', `/api/households/${household.id}`), 404);
    expectStatus(await as(app, outsider, 'GET', `/api/households/${household.id}/members`), 404);

    expectStatus(
      await as(app, member, 'PATCH', `/api/households/${household.id}`, { name: 'Mine now' }),
      403,
    );
    const renamed = await as(app, admin, 'PATCH', `/api/households/${household.id}`, {
      name: 'Oak Street Renamed',
      postalCode: '27516',
      timezone: 'America/Chicago',
    });
    expectStatus(renamed, 200);
    expect(renamed.json<Household>()).toMatchObject({
      name: 'Oak Street Renamed',
      postalCode: '27516',
      timezone: 'America/Chicago',
    });
    expectStatus(
      await as(app, admin, 'PATCH', `/api/households/${household.id}`, { timezone: 'Nowhere/X' }),
      400,
    );
  });

  it('lists members with names and roles', async () => {
    const { admin, member, household } = await householdWithMember();
    const members = (await as(app, member, 'GET', `/api/households/${household.id}/members`)).json<
      Member[]
    >();
    expect(members.map(({ userId, displayName, role }) => ({ userId, displayName, role }))).toEqual(
      [
        { userId: admin.id, displayName: 'Alex Rivera', role: 'admin' },
        { userId: member.id, displayName: 'Sam Chen', role: 'member' },
      ],
    );
  });

  it('counts each membership’s members for the switcher', async () => {
    const { admin, member, household } = await householdWithMember();
    const solo = await createHousehold(admin, uniqueName('Solo House'), '27601');

    expect(
      (await profile(admin)).memberships.map(({ householdId, memberCount }) => ({
        householdId,
        memberCount,
      })),
    ).toEqual([
      { householdId: household.id, memberCount: 2 },
      { householdId: solo.id, memberCount: 1 },
    ]);
    expect((await profile(member)).memberships).toEqual([
      expect.objectContaining({ householdId: household.id, memberCount: 2 }),
    ]);
  });

  it('stamps the household active at most once per UTC day', async () => {
    const user = await signUp(app, 'Stamper');
    const household = await createHousehold(user);
    await adminPool.query(
      `update public.household set last_active_at = now() - interval '2 days' where id = $1`,
      [household.id],
    );
    await as(app, user, 'GET', `/api/households/${household.id}`);
    const stamped = await adminPool.query<{ fresh: boolean }>(
      `select last_active_at >= date_trunc('day', now(), 'UTC') as fresh
       from public.household where id = $1`,
      [household.id],
    );
    expect(stamped.rows[0]?.fresh).toBe(true);

    const earlierToday = await adminPool.query<{ at: Date }>(
      `update public.household set last_active_at = date_trunc('day', now(), 'UTC')
       where id = $1 returning last_active_at as at`,
      [household.id],
    );
    await as(app, user, 'GET', `/api/households/${household.id}/members`);
    const after = await adminPool.query<{ at: Date }>(
      'select last_active_at as at from public.household where id = $1',
      [household.id],
    );
    expect(after.rows[0]?.at.getTime()).toBe(earlierToday.rows[0]?.at.getTime());
  });
});

describe('invites', () => {
  it('joins by link token and by code, however the code is typed', async () => {
    const admin = await signUp(app, 'Inviter');
    const household = await createHousehold(admin);
    const created = await invite(admin, household.id);
    expect(created.link.startsWith(`${TEST_ORIGIN}/join#token=`)).toBe(true);
    expect(created.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(created.invite.createdBy).toBe(admin.id);

    // Only digests are stored.
    const stored = await adminPool.query<{ token_hash: string; code_hash: string }>(
      'select token_hash, code_hash from public.household_invite where id = $1',
      [created.invite.id],
    );
    expect(JSON.stringify(stored.rows)).not.toContain(created.code);
    expect(JSON.stringify(stored.rows)).not.toContain(tokenFromLink(created.link));

    const byLink = await signUp(app, 'By Link');
    const joined = await as(app, byLink, 'POST', '/api/households/join', {
      tokenOrCode: tokenFromLink(created.link),
    });
    expectStatus(joined, 200);
    expect(joined.json<Household>()).toMatchObject({ id: household.id, role: 'member' });
    expect((await profile(byLink)).activeHouseholdId).toBe(household.id);

    // Lowercase, with a hyphen and spaces, and 0 and 1 typed as o and l.
    const typed = created.code
      .toLowerCase()
      .replaceAll('0', 'o')
      .replaceAll('1', 'l')
      .replace(/^(.{4})/, ' $1 - ');
    const byCode = await signUp(app, 'By Code');
    expectStatus(
      await as(app, byCode, 'POST', '/api/households/join', { tokenOrCode: typed }),
      200,
    );

    // Joining again changes nothing.
    expectStatus(
      await as(app, byCode, 'POST', '/api/households/join', { tokenOrCode: created.code }),
      200,
    );
    const members = (await as(app, admin, 'GET', `/api/households/${household.id}/members`)).json<
      Member[]
    >();
    expect(members).toHaveLength(3);
  });

  it('answers an unknown code with 404 and a revoked invite with 410', async () => {
    const admin = await signUp(app, 'Revoker');
    const household = await createHousehold(admin);
    const created = await invite(admin, household.id);
    const joiner = await signUp(app, 'Late');
    expectStatus(
      await as(app, joiner, 'POST', '/api/households/join', { tokenOrCode: 'ZZZZ-ZZZZ' }),
      404,
    );

    const listed = (await as(app, admin, 'GET', `/api/households/${household.id}/invites`)).json<
      Invite[]
    >();
    expect(listed.map((item) => item.id)).toEqual([created.invite.id]);

    expectStatus(
      await as(
        app,
        admin,
        'DELETE',
        `/api/households/${household.id}/invites/${created.invite.id}`,
      ),
      204,
    );
    // Revoking twice is harmless.
    expectStatus(
      await as(
        app,
        admin,
        'DELETE',
        `/api/households/${household.id}/invites/${created.invite.id}`,
      ),
      204,
    );
    expectStatus(
      await as(app, joiner, 'POST', '/api/households/join', { tokenOrCode: created.code }),
      410,
    );
    expectStatus(
      await as(app, joiner, 'POST', '/api/households/join', {
        tokenOrCode: tokenFromLink(created.link),
      }),
      410,
    );
    expect(
      (await as(app, admin, 'GET', `/api/households/${household.id}/invites`)).json<Invite[]>(),
    ).toEqual([]);
    expectStatus(
      await as(
        app,
        admin,
        'DELETE',
        `/api/households/${household.id}/invites/${crypto.randomUUID()}`,
      ),
      404,
    );
  });

  it('is admin-only', async () => {
    const { member, household } = await householdWithMember();
    expectStatus(await as(app, member, 'GET', `/api/households/${household.id}/invites`), 403);
    expectStatus(await as(app, member, 'POST', `/api/households/${household.id}/invites`), 403);
    expectStatus(
      await as(
        app,
        member,
        'DELETE',
        `/api/households/${household.id}/invites/${crypto.randomUUID()}`,
      ),
      403,
    );
  });
});

describe('membership', () => {
  it('is refused to non-admins: remove and transfer', async () => {
    const { admin, member, household } = await householdWithMember();
    expectStatus(
      await as(
        app,
        member,
        'POST',
        `/api/households/${household.id}/members/${admin.id}/remove`,
        {},
      ),
      403,
    );
    expectStatus(
      await as(app, member, 'POST', `/api/households/${household.id}/transfer-admin`, {
        userId: member.id,
      }),
      403,
    );
    expectStatus(
      await as(
        app,
        member,
        'GET',
        `/api/households/${household.id}/members/${admin.id}/departure-preview`,
      ),
      403,
    );
  });

  it('transfers the admin role', async () => {
    const { admin, member, household } = await householdWithMember();
    expectStatus(
      await as(app, admin, 'POST', `/api/households/${household.id}/transfer-admin`, {
        userId: member.id,
      }),
      204,
    );
    const roles = (await as(app, admin, 'GET', `/api/households/${household.id}/members`))
      .json<Member[]>()
      .map(({ userId, role }) => ({ userId, role }));
    expect(roles).toEqual([
      { userId: admin.id, role: 'member' },
      { userId: member.id, role: 'admin' },
    ]);
    expectStatus(
      await as(app, member, 'POST', `/api/households/${household.id}/transfer-admin`, {
        userId: crypto.randomUUID(),
      }),
      404,
    );
  });

  describe('blocks a removal until everything is reassigned, then ends access at once', () => {
    // Shared setup, paid once: these five inserts and the household they sit in are read-only in
    // every negative case below (a refused removal must touch nothing), so only the final,
    // successful-removal test actually mutates this fixture — and it runs last.
    let admin: SignedUpUser;
    let member: SignedUpUser;
    let household: Household;
    let removeUrl: string;
    let list: string;
    let chore: string;
    let rotating: string;
    let errand: string;
    let bill: string;

    beforeAll(async () => {
      ({ admin, member, household } = await householdWithMember());
      removeUrl = `/api/households/${household.id}/members/${member.id}/remove`;
      list = await insertId(
        `insert into public.shopping_list (household_id, name, created_by)
         values ($1, 'Groceries', $2) returning id`,
        [household.id, member.id],
      );
      chore = await insertId(
        `insert into public.chore (household_id, name, recurrence_unit, anchor_date, assigned_to,
           created_by)
         values ($1, 'Trash', 'week', current_date, $2, $3) returning id`,
        [household.id, member.id, admin.id],
      );
      // A chore is rotating or assigned, never both, so the rotation is a second one.
      rotating = await insertId(
        `insert into public.chore (household_id, name, recurrence_unit, anchor_date, created_by,
           rotation_order)
         values ($1, 'Dishes', 'week', current_date, $2, array[$2, $3]::uuid[]) returning id`,
        [household.id, admin.id, member.id],
      );
      errand = await insertId(
        `insert into public.errand (household_id, name, added_by, assigned_to)
         values ($1, 'Post office', $2, $3) returning id`,
        [household.id, admin.id, member.id],
      );
      bill = await insertId(
        `insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit,
           anchor_date, visibility)
         values ($1, $2, 'Internet', 70.00, 'month', current_date, 'household') returning id`,
        [household.id, member.id],
      );
    });

    it('previews everything the departing member owns, naming who inherits the rotation', async () => {
      const previewResponse = await as(
        app,
        admin,
        'GET',
        `/api/households/${household.id}/members/${member.id}/departure-preview`,
      );
      expectStatus(previewResponse, 200);
      const preview = previewResponse.json<DeparturePreview>();
      expect(preview).toMatchObject({
        householdId: household.id,
        userId: member.id,
        isLastMember: false,
        lists: [{ id: list, name: 'Groceries' }],
        chores: [{ id: chore, name: 'Trash' }],
        errands: [{ id: errand, name: 'Post office' }],
        bills: [{ id: bill, name: 'Internet' }],
        rotations: [{ choreId: rotating, choreName: 'Dishes', nextTurnUserId: admin.id }],
      });
    });

    describe.each([
      {
        name: 'no reassignments at all',
        reassignments: () => ({}),
        status: 409,
      },
      {
        name: 'a partial set missing the bill',
        reassignments: () => ({ [list]: admin.id, [chore]: admin.id, [errand]: admin.id }),
        status: 409,
      },
      {
        name: 'the bill reassigned to the departing member, who cannot inherit their own bill',
        reassignments: () => ({
          [list]: admin.id,
          [chore]: admin.id,
          [errand]: admin.id,
          [bill]: member.id,
        }),
        status: 400,
      },
    ])('given $name', ({ reassignments, status }) => {
      it(`answers ${String(status)} and leaves everything untouched`, async () => {
        expectStatus(
          await as(app, admin, 'POST', removeUrl, { reassignments: reassignments() }),
          status,
        );
        expectStatus(await as(app, member, 'GET', `/api/households/${household.id}`), 200);
      });
    });

    it('ends access at once, once every item is reassigned', async () => {
      const removed = await as(app, admin, 'POST', removeUrl, {
        reassignments: {
          [list]: admin.id,
          [chore]: admin.id,
          [errand]: admin.id,
          [bill]: admin.id,
        },
      });
      expectStatus(removed, 200);
      expect(removed.json()).toEqual({ householdDeleted: false, promotedUserId: null });

      expectStatus(await as(app, member, 'GET', `/api/households/${household.id}`), 404);
      expectStatus(await as(app, member, 'GET', `/api/households/${household.id}/members`), 404);
      expect((await as(app, member, 'GET', '/api/households')).json<Household[]>()).toEqual([]);
      expect((await profile(member)).activeHouseholdId).toBeNull();
      const owners = await adminPool.query<{ created_by: string }>(
        'select created_by from public.shopping_list where id = $1',
        [list],
      );
      expect(owners.rows[0]?.created_by).toBe(admin.id);
    });
  });

  it('lets the admin leave, promoting the longest-tenured member', async () => {
    const { admin, member, household } = await householdWithMember();
    const left = await as(app, admin, 'POST', `/api/households/${household.id}/leave`, {});
    expectStatus(left, 200);
    expect(left.json()).toEqual({ householdDeleted: false, promotedUserId: member.id });
    expect(
      (await as(app, member, 'GET', `/api/households/${household.id}`)).json<Household>().role,
    ).toBe('admin');
  });

  it('deletes the household when the last member leaves, only with the typed name', async () => {
    const user = await signUp(app, 'Last One');
    const name = uniqueName('Solo Flat');
    const household = await createHousehold(user, name);
    const personalBill = await insertId(
      `insert into public.bill (owner_user_id, name, amount, recurrence_unit, anchor_date,
         visibility)
       values ($1, 'Phone', 45.00, 'month', current_date, 'personal') returning id`,
      [user.id],
    );
    await insertId(
      `insert into public.shopping_list (household_id, name, created_by)
       values ($1, 'Groceries', $2) returning id`,
      [household.id, user.id],
    );

    const preview = (
      await as(
        app,
        user,
        'GET',
        `/api/households/${household.id}/members/${user.id}/departure-preview`,
      )
    ).json<DeparturePreview>();
    expect(preview.isLastMember).toBe(true);
    expect(preview.deletionCounts.lists).toBe(1);

    const leaveUrl = `/api/households/${household.id}/leave`;
    expectStatus(await as(app, user, 'POST', leaveUrl, { confirmName: 'wrong name' }), 400);
    expectStatus(await as(app, user, 'POST', leaveUrl, {}), 400);
    const left = await as(app, user, 'POST', leaveUrl, { confirmName: name });
    expectStatus(left, 200);
    expect(left.json()).toMatchObject({ householdDeleted: true });

    const gone = await adminPool.query('select 1 from public.household where id = $1', [
      household.id,
    ]);
    expect(gone.rows).toHaveLength(0);
    const bills = await adminPool.query('select 1 from public.bill where id = $1', [personalBill]);
    expect(bills.rows).toHaveLength(1);
    expect((await profile(user)).activeHouseholdId).toBeNull();
  });
});

describe('isolation through withUserDb', () => {
  it('shows a handler that forgot its filter only the caller’s rows', async () => {
    const a = await householdWithMember();
    const b = await householdWithMember();
    await insertId(
      `insert into public.shopping_list (household_id, name, created_by)
       values ($1, 'A list', $2) returning id`,
      [a.household.id, a.admin.id],
    );
    await insertId(
      `insert into public.shopping_list (household_id, name, created_by)
       values ($1, 'B list', $2) returning id`,
      [b.household.id, b.admin.id],
    );

    const claims = { sub: a.member.id, role: 'authenticated', aud: 'authenticated' };
    const seen = await withUserDb(stack.database.db, claims, async (db) => ({
      // No where clause, on purpose: RLS is the only thing narrowing these.
      households: await db.selectFrom('household').select('id').execute(),
      lists: await db.selectFrom('shopping_list').select(['household_id']).execute(),
      profiles: await db.selectFrom('profile').select('id').execute(),
      members: await db.selectFrom('household_member').select('household_id').execute(),
    }));
    expect(seen.households.map((row) => row.id)).toEqual([a.household.id]);
    expect(new Set(seen.lists.map((row) => row.household_id))).toEqual(new Set([a.household.id]));
    expect(seen.profiles.map((row) => row.id)).toEqual([a.member.id]);
    expect(new Set(seen.members.map((row) => row.household_id))).toEqual(new Set([a.household.id]));

    // And a write aimed at B changes nothing.
    await withUserDb(stack.database.db, claims, (db) =>
      db.updateTable('shopping_list').set({ name: 'hijacked' }).execute(),
    );
    const bLists = await adminPool.query<{ name: string }>(
      'select name from public.shopping_list where household_id = $1',
      [b.household.id],
    );
    expect(bLists.rows.map((row) => row.name)).toEqual(['B list']);
    await adminPool.query(
      `update public.shopping_list set name = 'A list' where household_id = $1`,
      [a.household.id],
    );
  });

  it('never leaves the role or claims on a pooled connection', async () => {
    const user = await signUp(app, 'Pool');
    // One connection, so the check below runs on the very connection withUserDb used.
    const single = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: stackConfig().serviceDatabaseUrl, max: 1 }),
      }),
    });
    try {
      const claims = { sub: user.id, role: 'authenticated', aud: 'authenticated' };
      await withUserDb(single, claims, (db) => db.selectFrom('profile').select('id').execute());
      await expect(
        withUserDb(single, claims, () => Promise.reject(new Error('handler failed'))),
      ).rejects.toThrow('handler failed');
      const { rows } = await sql<{
        role: string;
        claims: string | null;
      }>`select current_user as role, current_setting('request.jwt.claims', true) as claims`.execute(
        single,
      );
      expect(rows[0]?.role).toBe('hearth_service');
      expect(rows[0]?.claims ?? '').toBe('');
      // hearth_service on its own may read nothing.
      await expect(single.selectFrom('profile').select('id').execute()).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await single.destroy();
    }
  });
});

describe('system routes', () => {
  it('records a scrubbed client error and limits reports per IP', async () => {
    const marker = crypto.randomUUID();
    const response = await app.inject({
      method: 'POST',
      url: '/api/client-error',
      remoteAddress: '198.19.1.1',
      payload: {
        name: 'TypeError',
        message: `Failed for sam@example.com paying $1,850.00 on "Groceries" ${marker}`,
        route: `/lists/${marker}?q=milk`,
      },
    });
    expectStatus(response, 204);
    const fingerprint = errorFingerprint('web', 'TypeError', `/lists/${marker}`);
    const { rows } = await adminPool.query<{ message: string; count: number }>(
      'select message, count from public.app_error where fingerprint = $1',
      [fingerprint],
    );
    expect(rows).toHaveLength(1);
    const message = rows[0]?.message ?? '';
    for (const secret of ['sam@', '1,850', 'Groceries', 'milk']) {
      expect(message).not.toContain(secret);
    }
    expect(message).toContain(marker);

    for (let i = 0; i < 9; i += 1) {
      expectStatus(
        await app.inject({
          method: 'POST',
          url: '/api/client-error',
          remoteAddress: '198.19.1.1',
          payload: { message: 'again' },
        }),
        204,
      );
    }
    expectStatus(
      await app.inject({
        method: 'POST',
        url: '/api/client-error',
        remoteAddress: '198.19.1.1',
        payload: { message: 'again' },
      }),
      429,
    );
  });

  it('shows system health to the owner only', async () => {
    const owner = await signUp(app, 'Server Owner');
    const someone = await signUp(app, 'Someone');
    const ownerApp = await stack.newApp({ ownerEmail: owner.email });

    expectStatus(await as(ownerApp, someone, 'GET', '/api/health/deep'), 403);

    await ownerApp.inject({
      method: 'POST',
      url: '/api/client-error',
      remoteAddress: '198.19.2.2',
      payload: { name: 'RangeError', message: 'health check marker' },
    });
    const response = await as(ownerApp, owner, 'GET', '/api/health/deep');
    expectStatus(response, 200);
    const body = response.json<{
      recentErrors: { message: string }[];
      merchantSkipRates: unknown[];
      newestBackupAt: string | null;
    }>();
    expect(body.recentErrors.some((error) => error.message.includes('health check marker'))).toBe(
      true,
    );
    expect(body.merchantSkipRates).toEqual([]);
    expect(body).toHaveProperty('newestDealFetchedAt');
    expect(body).toHaveProperty('newestNotificationSentAt');
  });

  // Public, unauthenticated, and the only route that pings the real database connection (every
  // other test's `pingDatabase` is a stub): `test/service-stack.ts` wires the real `db.ts`
  // `ping` into this stack, so this is what exercises it for real against `supabase start`.
  it('answers ok when the database is reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expectStatus(response, 200);
    expect(response.json()).toEqual({ status: 'ok', database: 'ok' });
  });
});

describe('probing another household over HTTP', () => {
  it('answers every household-scoped route with 403 or 404 and leaks nothing', async () => {
    const a = await householdWithMember();
    const b = await householdWithMember();
    const bInvite = await invite(b.admin, b.household.id);

    const probes: {
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
      url: string;
      payload?: unknown;
    }[] = [
      { method: 'GET', url: `/api/households/${b.household.id}` },
      { method: 'PATCH', url: `/api/households/${b.household.id}`, payload: { name: 'stolen' } },
      { method: 'GET', url: `/api/households/${b.household.id}/members` },
      { method: 'GET', url: `/api/households/${b.household.id}/invites` },
      { method: 'POST', url: `/api/households/${b.household.id}/invites` },
      { method: 'DELETE', url: `/api/households/${b.household.id}/invites/${bInvite.invite.id}` },
      {
        method: 'GET',
        url: `/api/households/${b.household.id}/members/${b.member.id}/departure-preview`,
      },
      {
        method: 'POST',
        url: `/api/households/${b.household.id}/members/${b.member.id}/remove`,
        payload: {},
      },
      {
        method: 'POST',
        url: `/api/households/${b.household.id}/transfer-admin`,
        payload: { userId: b.member.id },
      },
      { method: 'POST', url: `/api/households/${b.household.id}/leave`, payload: {} },
      {
        method: 'PUT',
        url: '/api/users/me/active-household',
        payload: { householdId: b.household.id },
      },
    ];
    for (const probe of probes) {
      const where = `${probe.method} ${probe.url}`;
      const response = await as(app, a.admin, probe.method, probe.url, probe.payload);
      expect([403, 404], `${where} answered ${String(response.statusCode)}`).toContain(
        response.statusCode,
      );
      for (const secret of [b.household.name, b.admin.email, b.member.email, b.member.id]) {
        expect(response.body, where).not.toContain(secret);
      }
    }

    // Nothing in B moved, and the caller's own view is unchanged.
    const bView = await as(app, b.admin, 'GET', `/api/households/${b.household.id}`);
    expect(bView.json<Household>().name).toBe(b.household.name);
    expect(
      (await as(app, b.admin, 'GET', `/api/households/${b.household.id}/members`)).json<Member[]>(),
    ).toHaveLength(2);
    const mine = await profile(a.admin);
    expect(mine.memberships.map((membership) => membership.householdId)).toEqual([a.household.id]);
  });

  it('answers a non-member exactly as it answers for a household that does not exist', async () => {
    const outsider = await signUp(app, 'Outsider');
    const b = await householdWithMember();
    const real = await as(app, outsider, 'GET', `/api/households/${b.household.id}`);
    const absent = await as(
      app,
      outsider,
      'GET',
      '/api/households/00000000-0000-4000-8000-000000000000',
    );
    expectStatus(real, 404);
    expect(absent.statusCode).toBe(real.statusCode);
    expect(absent.json()).toEqual(real.json());
  });

  it('refuses an invite id belonging to another household', async () => {
    const a = await householdWithMember();
    const b = await householdWithMember();
    const bInvite = await invite(b.admin, b.household.id);
    expectStatus(
      await as(
        app,
        a.admin,
        'DELETE',
        `/api/households/${a.household.id}/invites/${bInvite.invite.id}`,
      ),
      404,
    );
    const { rows } = await adminPool.query<{ revoked_at: Date | null }>(
      'select revoked_at from public.household_invite where id = $1',
      [bInvite.invite.id],
    );
    expect(rows[0]?.revoked_at).toBeNull();
  });
});

describe('attribution', () => {
  it('takes every id from the token, never from the body', async () => {
    const a = await signUp(app, 'Attribution A');
    const b = await signUp(app, 'Attribution B');
    const created = await as(app, a, 'POST', '/api/households', {
      name: uniqueName('Attribution'),
      postalCode: '27514',
      timezone: 'America/New_York',
      createdBy: b.id,
      created_by: b.id,
      role: 'member',
    });
    expectStatus(created, 201);
    const household = created.json<Household>();
    expect(household.role).toBe('admin');
    const { rows } = await adminPool.query<{ user_id: string; role: string }>(
      'select user_id, role from public.household_member where household_id = $1',
      [household.id],
    );
    expect(rows).toEqual([{ user_id: a.id, role: 'admin' }]);

    const invited = await as(app, a, 'POST', `/api/households/${household.id}/invites`, {
      createdBy: b.id,
      created_by: b.id,
      expiresAt: '2099-01-01T00:00:00Z',
    });
    expectStatus(invited, 201);
    const row = invited.json<CreatedInvite>().invite;
    expect(row.createdBy).toBe(a.id);
    expect(new Date(row.expiresAt).getUTCFullYear()).toBeLessThan(2099);
  });
});

describe('forged tokens', () => {
  function signHs256(payload: object, key: string): string {
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = createHmac('sha256', key).update(`${head}.${body}`).digest('base64url');
    return `${head}.${body}.${mac}`;
  }

  it('are refused with 401 problem details, expired or signed with another key', async () => {
    const user = await signUp(app, 'Forgery');
    const secret = stackConfig().jwtSecret;
    const base = { sub: user.id, role: 'authenticated', aud: 'authenticated', email: user.email };
    const now = Math.floor(currentInstant().getTime() / 1000);

    const expired = await as(
      app,
      { ...user, token: signHs256({ ...base, exp: now - 7200 }, secret) },
      'GET',
      '/api/users/me',
    );
    expectStatus(expired, 401);
    expect(expired.headers['content-type']).toContain('application/problem+json');
    expect(expired.json()).toMatchObject({ type: 'about:blank', status: 401 });

    expectStatus(
      await as(
        app,
        { ...user, token: signHs256({ ...base, exp: now + 3600 }, `${secret}-wrong`) },
        'GET',
        '/api/users/me',
      ),
      401,
    );
  });

  it('cannot waive the current-password check by rewriting amr', async () => {
    const user = await signUp(app, 'Amr Forgery');
    const [head, payload, signature] = user.token.split('.');
    const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    claims['amr'] = [
      { method: 'recovery', timestamp: Math.floor(currentInstant().getTime() / 1000) },
    ];
    const rewritten = `${head ?? ''}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature ?? ''}`;
    expectStatus(
      await as(app, { ...user, token: rewritten }, 'POST', '/api/users/me/password', {
        newPassword: 'another-good-passphrase-42',
      }),
      401,
    );
    // The untouched session still has to supply the old password.
    expectStatus(
      await as(app, user, 'POST', '/api/users/me/password', {
        newPassword: 'another-good-passphrase-42',
      }),
      400,
    );
  });
});

describe('scrubbing a thrown error on the way to app_error', () => {
  it('records the failure without the email, token, amount, digest, or JWT in it', async () => {
    const marker = `zz${randomUUID().replaceAll('-', '').slice(0, 8)}`;
    const fingerprint = errorFingerprint('service', 'Error', '/api/health/deep');
    // record_app_error keeps the first message for a fingerprint and only counts the rest, so
    // an earlier run's row would hide this one.
    await adminPool.query('delete from public.app_error where fingerprint = $1', [fingerprint]);
    const owner = await signUp(app, 'Scrub Owner');
    const leaky = await stack.newApp({
      ownerEmail: owner.email,
      deps: {
        merchantSkipRates: () => {
          throw new Error(
            `failed ${marker}: sam.member@example.com, Bearer abc123def456ghi789jkl, ` +
              `total $1,850.00, "Chicken Tikka Masala", deadbeefdeadbeefdeadbeefdeadbeef, ` +
              'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln',
          );
        },
      },
    });
    const response = await as(leaky, owner, 'GET', '/api/health/deep');
    expectStatus(response, 500);
    expect(response.json()).toMatchObject({ status: 500 });

    const { rows } = await adminPool.query<{ message: string }>(
      'select message from public.app_error where fingerprint = $1',
      [fingerprint],
    );
    const message = rows[0]?.message ?? '';
    expect(message, 'the error was never recorded').toContain(marker);
    for (const secret of [
      'sam.member',
      '@example.com',
      'abc123def456',
      '1,850',
      'Tikka',
      'deadbeef',
      'eyJhbGci',
    ]) {
      expect(message, message).not.toContain(secret);
      expect(response.body).not.toContain(secret);
    }
  });
});
