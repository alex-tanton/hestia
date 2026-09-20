import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS_TEXT } from './data/common-passwords.js';
import { COMMON_PASSWORD_MESSAGE, isCommonPassword, newPasswordSchema } from './password.js';

describe('the common-password list', () => {
  const entries = COMMON_PASSWORDS_TEXT.split('\n').filter((line) => line !== '');

  it('holds 10,000 distinct lowercase entries of at least 8 characters', () => {
    expect(entries).toHaveLength(10_000);
    expect(new Set(entries).size).toBe(entries.length);
    for (const entry of entries) {
      expect(entry.length).toBeGreaterThanOrEqual(8);
      expect(entry).toBe(entry.toLowerCase());
    }
  });
});

describe('isCommonPassword', () => {
  it.each(['password', '12345678', 'iloveyou', 'qwertyuiop', '1q2w3e4r5t', 'football'])(
    'flags %j',
    (password) => {
      expect(isCommonPassword(password)).toBe(true);
    },
  );

  it('ignores case', () => {
    expect(isCommonPassword('PassWord')).toBe(true);
    expect(isCommonPassword('FOOTBALL')).toBe(true);
  });

  it('passes an uncommon password', () => {
    expect(isCommonPassword('violet-teapot-harbor-17')).toBe(false);
    expect(isCommonPassword('')).toBe(false);
  });
});

describe('newPasswordSchema', () => {
  it('accepts a long, uncommon password', () => {
    expect(newPasswordSchema.safeParse('violet-teapot-harbor-17').success).toBe(true);
  });

  it('rejects a short password', () => {
    const result = newPasswordSchema.safeParse('a1b2c3');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Use at least 8 characters.');
  });

  it('rejects a common password', () => {
    const result = newPasswordSchema.safeParse('Password1');
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(COMMON_PASSWORD_MESSAGE);
  });

  it('rejects a password bcrypt would truncate', () => {
    expect(newPasswordSchema.safeParse('é'.repeat(37)).success).toBe(false);
    expect(newPasswordSchema.safeParse('x'.repeat(72)).success).toBe(true);
  });
});
