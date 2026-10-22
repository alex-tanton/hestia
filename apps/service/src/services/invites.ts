import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CreatedInvite, Invite } from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';
import { requireAdmin } from './households.js';

/** Crockford Base32: no I, L, O, or U, so a typed code is hard to misread. */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** The link token: 32 random bytes, base64url. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The typed code: 8 uniformly random Crockford characters. */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) code += CROCKFORD_ALPHABET.charAt(randomInt(32));
  return code;
}

/** How credentials are stored: SHA-256, lowercase hex, never the credential itself. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * The shareable link. The token rides in the fragment, which browsers never send to a server, so
 * it stays out of every access log between the invitee and the PWA.
 */
export function inviteLink(origin: string, token: string): string {
  return `${origin}/join#token=${token}`;
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toInvite(row: {
  id: string;
  created_by: string;
  created_at: Date | string;
  expires_at: Date | string;
}): Invite {
  return {
    id: row.id,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
  };
}

/** Outstanding invites: not revoked, not expired, newest first. */
export async function listInvites(
  db: Kysely<Database>,
  userId: string,
  householdId: string,
): Promise<Invite[]> {
  await requireAdmin(db, userId, householdId);
  const rows = await db
    .selectFrom('household_invite')
    .where('household_id', '=', householdId)
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', new Date())
    .select(['id', 'created_by', 'created_at', 'expires_at'])
    .orderBy('created_at', 'desc')
    .orderBy('id')
    .execute();
  return rows.map(toInvite);
}

/**
 * Creates an invite. Only the two digests are inserted; the creator, creation time, and expiry
 * take their database defaults, so nothing about them comes from the request.
 */
export async function createInvite(
  db: Kysely<Database>,
  userId: string,
  householdId: string,
  origin: string,
): Promise<CreatedInvite> {
  await requireAdmin(db, userId, householdId);
  // A code collides with an existing one about once in 10^12 draws; draw again if it does.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateInviteToken();
    const code = generateInviteCode();
    const row = await db
      .insertInto('household_invite')
      .values({
        household_id: householdId,
        token_hash: sha256Hex(token),
        code_hash: sha256Hex(code),
      })
      .onConflict((conflict) => conflict.doNothing())
      .returning(['id', 'created_by', 'created_at', 'expires_at'])
      .executeTakeFirst();
    if (row !== undefined) {
      return { invite: toInvite(row), link: inviteLink(origin, token), code };
    }
  }
  throw new Error('could not draw an unused invite code');
}

/** Revokes an invite. Revoking one already revoked changes nothing and succeeds. */
export async function revokeInvite(
  db: Kysely<Database>,
  userId: string,
  householdId: string,
  inviteId: string,
): Promise<void> {
  await requireAdmin(db, userId, householdId);
  const existing = await db
    .selectFrom('household_invite')
    .where('id', '=', inviteId)
    .where('household_id', '=', householdId)
    .select(['id', 'revoked_at'])
    .executeTakeFirst();
  if (existing === undefined) throw fail(404, 'Invite not found.');
  if (existing.revoked_at !== null) return;
  await db
    .updateTable('household_invite')
    .set({ revoked_at: new Date() })
    .where('id', '=', inviteId)
    .where('household_id', '=', householdId)
    .where('revoked_at', 'is', null)
    .execute();
}
