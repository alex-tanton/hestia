import { describe, expect, it } from 'vitest';
import {
  INVITE_CODE_LENGTH_MESSAGE,
  INVITE_CODE_MISMATCH_MESSAGE,
  normalizeInviteCode,
  tokenFromHash,
} from './invite-code.ts';

describe('normalizeInviteCode', () => {
  it('accepts a canonical code unchanged', () => {
    expect(normalizeInviteCode('9XKR4TZ2')).toEqual({ code: '9XKR4TZ2' });
  });

  it.each([
    ['lowercase', '9xkr4tz2', '9XKR4TZ2'],
    ['spaces', ' 9XKR 4TZ2 ', '9XKR4TZ2'],
    ['hyphens', '9XKR-4TZ2', '9XKR4TZ2'],
    ['I as one', 'I9KR4TZ2', '19KR4TZ2'],
    ['L as one', 'l9KR4TZ2', '19KR4TZ2'],
    ['O as zero', 'O9KR4TZ2', '09KR4TZ2'],
    ['mixed', ' o-i l9kr4t ', '0119KR4T'],
  ])('reads %s the Crockford way', (_label, input, expected) => {
    expect(normalizeInviteCode(input)).toEqual({ code: expected });
  });

  it('refuses U, which is not in the alphabet', () => {
    expect(normalizeInviteCode('9XKR4TZU')).toEqual({ error: INVITE_CODE_MISMATCH_MESSAGE });
  });

  it('refuses any other character', () => {
    expect(normalizeInviteCode('9XKR4TZ!')).toEqual({ error: INVITE_CODE_MISMATCH_MESSAGE });
  });

  it.each(['', '   ', '9XKR4TZ', '9XKR4TZ23'])('asks for eight characters given %o', (input) => {
    expect(normalizeInviteCode(input)).toEqual({ error: INVITE_CODE_LENGTH_MESSAGE });
  });
});

describe('tokenFromHash', () => {
  it('reads the invite link’s token', () => {
    expect(tokenFromHash('#token=abcdefghijklmnopqrstuvwxyz0123456789_-AB')).toBe(
      'abcdefghijklmnopqrstuvwxyz0123456789_-AB',
    );
  });

  it.each(['', '#', '#access_token=abc', '#token=short'])('ignores %o', (hash) => {
    expect(tokenFromHash(hash)).toBeUndefined();
  });
});
