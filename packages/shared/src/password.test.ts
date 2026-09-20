import { describe, expect, it } from 'vitest';
import { passwordShapeSchema } from './password.js';

describe('passwordShapeSchema', () => {
  it('accepts a long password', () => {
    expect(passwordShapeSchema.safeParse('violet-teapot-harbor-17').success).toBe(true);
  });

  it('rejects a short password', () => {
    const result = passwordShapeSchema.safeParse('a1b2c3');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Use at least 8 characters.');
  });

  it('rejects a password bcrypt would truncate', () => {
    expect(passwordShapeSchema.safeParse('é'.repeat(37)).success).toBe(false);
    expect(passwordShapeSchema.safeParse('x'.repeat(72)).success).toBe(true);
  });

  // The list is the other half of the policy and lives behind its own entry point, so the shape
  // schema alone must not reject a common password — `common-passwords.test.ts` covers that.
  it('leaves the common-password rule to the subpath', () => {
    expect(passwordShapeSchema.safeParse('password1').success).toBe(true);
  });
});
