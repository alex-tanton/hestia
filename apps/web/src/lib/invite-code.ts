/**
 * The typed 8-character invite code.
 *
 * The code is drawn from the Crockford Base32 alphabet, so the field reads what a person is
 * likely to type rather than insisting they get it exactly right: case, spaces, and hyphens are
 * ignored, I and L read as 1, and O reads as 0. U is not in the alphabet, so a code containing
 * one is not a code at all. `public.redeem_invite` decodes the same way, so normalizing here
 * only tells the user sooner.
 */

export const INVITE_CODE_LENGTH = 8;

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** The copy for a code that matches no invite. */
export const INVITE_CODE_MISMATCH_MESSAGE =
  "That code doesn't match an invite. Check it and try again.";
export const INVITE_CODE_LENGTH_MESSAGE = 'Enter the 8-character code from the invite.';

export type InviteCodeResult = { code: string; error?: undefined } | { error: string };

export function normalizeInviteCode(input: string): InviteCodeResult {
  const stripped = input.replace(/[\s-]/g, '');
  if (stripped === '') return { error: INVITE_CODE_LENGTH_MESSAGE };

  let normalized = '';
  for (const character of stripped.toUpperCase()) {
    if (character === 'I' || character === 'L') normalized += '1';
    else if (character === 'O') normalized += '0';
    else if (CROCKFORD_ALPHABET.includes(character)) normalized += character;
    else return { error: INVITE_CODE_MISMATCH_MESSAGE };
  }
  if (normalized.length !== INVITE_CODE_LENGTH) return { error: INVITE_CODE_LENGTH_MESSAGE };
  return { code: normalized };
}

/** The invite link is `<origin>/join#token=<token>`; the token never leaves the fragment. */
export function tokenFromHash(hash: string): string | undefined {
  const match = /^#?token=([A-Za-z0-9_-]{16,200})$/.exec(hash);
  return match?.[1];
}
