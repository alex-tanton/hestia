import type { Kysely } from 'kysely';
import type { ProfileResponse, UpdateProfileRequest } from '@hestia/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

// Postgres returns `time` as HH:MM:SS; the API speaks HH:MM.
function hhmm(value: string): string {
  return value.slice(0, 5);
}

/** GET /api/users/me. `isServerOwner` comes from the verified token, not the database. */
export async function getProfile(
  db: Kysely<Database>,
  userId: string,
  isServerOwner: boolean,
): Promise<ProfileResponse> {
  const profile = await db
    .selectFrom('profile')
    .where('id', '=', userId)
    .select([
      'id',
      'email',
      'display_name',
      'timezone',
      'active_household_id',
      'quiet_hours_start',
      'quiet_hours_end',
      'household_bill_reminders',
    ])
    .executeTakeFirst();
  if (profile === undefined) throw fail(404, 'Profile not found.');

  const memberships = await db
    .selectFrom('household_member as m')
    .innerJoin('household as h', 'h.id', 'm.household_id')
    .where('m.user_id', '=', userId)
    .select((eb) => [
      'm.household_id',
      'h.name',
      'm.role',
      'm.joined_at',
      // The switcher shows a member count per household. Counting here avoids a request per
      // household, and the member_read policy already scopes it.
      eb
        .selectFrom('household_member as c')
        .whereRef('c.household_id', '=', 'm.household_id')
        .select((inner) => inner.fn.countAll<string>().as('count'))
        .as('member_count'),
    ])
    .orderBy('m.joined_at')
    .orderBy('m.household_id')
    .execute();

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    timezone: profile.timezone,
    activeHouseholdId: profile.active_household_id,
    quietHours:
      profile.quiet_hours_start === null || profile.quiet_hours_end === null
        ? null
        : { start: hhmm(profile.quiet_hours_start), end: hhmm(profile.quiet_hours_end) },
    householdBillReminders: profile.household_bill_reminders,
    isServerOwner,
    memberships: memberships.map((row) => ({
      householdId: row.household_id,
      name: row.name,
      role: row.role,
      joinedAt: iso(row.joined_at),
      memberCount: Number(row.member_count ?? 1),
    })),
  };
}

export async function updateProfile(
  db: Kysely<Database>,
  userId: string,
  input: UpdateProfileRequest,
): Promise<void> {
  await db
    .updateTable('profile')
    .set({
      ...(input.displayName === undefined ? {} : { display_name: input.displayName }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.quietHours === undefined
        ? {}
        : {
            quiet_hours_start: input.quietHours?.start ?? null,
            quiet_hours_end: input.quietHours?.end ?? null,
          }),
      ...(input.householdBillReminders === undefined
        ? {}
        : { household_bill_reminders: input.householdBillReminders }),
    })
    .where('id', '=', userId)
    .execute();
}

/** Switches the active household, which must be one of the caller's memberships. */
export async function setActiveHousehold(
  db: Kysely<Database>,
  userId: string,
  householdId: string,
): Promise<void> {
  const membership = await db
    .selectFrom('household_member')
    .where('household_id', '=', householdId)
    .where('user_id', '=', userId)
    .select('household_id')
    .executeTakeFirst();
  if (membership === undefined) throw fail(404, 'Household not found.');
  await db
    .updateTable('profile')
    .set({ active_household_id: householdId })
    .where('id', '=', userId)
    .execute();
}
