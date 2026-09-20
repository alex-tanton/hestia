import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CROCKFORD_ALPHABET,
  generateInviteCode,
  generateInviteToken,
  inviteLink,
  sha256Hex,
} from './invites.js';

describe('invite credentials', () => {
  it('uses the Crockford alphabet, which has no I, L, O, or U', () => {
    expect(CROCKFORD_ALPHABET).toHaveLength(32);
    expect(new Set(CROCKFORD_ALPHABET).size).toBe(32);
    expect(CROCKFORD_ALPHABET).not.toMatch(/[ILOU]/);
  });

  it('draws 8-character codes from every letter of the alphabet', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
      for (const character of code) seen.add(character);
    }
    expect(seen.size).toBe(32);
  });

  it('draws codes and tokens that do not repeat', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateInviteCode));
    const tokens = new Set(Array.from({ length: 1000 }, generateInviteToken));
    expect(codes.size).toBe(1000);
    expect(tokens.size).toBe(1000);
  });

  it('makes tokens of 32 random bytes in base64url', () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('hashes as SHA-256 lowercase hex, matching the database', () => {
    expect(sha256Hex('ABCD2345')).toBe(createHash('sha256').update('ABCD2345').digest('hex'));
    expect(sha256Hex('x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('puts the token in the link’s fragment', () => {
    expect(inviteLink('https://hearth.tail1234.ts.net', 'abc_-123')).toBe(
      'https://hearth.tail1234.ts.net/join#token=abc_-123',
    );
  });
});
