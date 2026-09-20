import { z } from 'zod';
import { COMMON_PASSWORDS_TEXT } from './data/common-passwords.js';

/** GoTrue enforces the same minimum (GOTRUE_PASSWORD_MIN_LENGTH). */
export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt, which GoTrue hashes with, ignores everything past 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

let commonPasswords: ReadonlySet<string> | undefined;

// Built on first use rather than at import, so a bundle that imports the package without
// checking a password does not pay for the set.
function commonPasswordSet(): ReadonlySet<string> {
  commonPasswords ??= new Set(COMMON_PASSWORDS_TEXT.split('\n').filter((line) => line !== ''));
  return commonPasswords;
}

/**
 * True when the password is on the common-password list. The comparison ignores case, so
 * "Password1" is as common as "password1".
 */
export function isCommonPassword(password: string): boolean {
  return commonPasswordSet().has(password.toLowerCase());
}

export const COMMON_PASSWORD_MESSAGE = 'This password is too common. Choose a less guessable one.';

/** The password policy (Requirements, "Authentication"), for signup and password change. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${String(PASSWORD_MIN_LENGTH)} characters.`)
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_LENGTH, {
    message: `Use at most ${String(PASSWORD_MAX_LENGTH)} bytes.`,
  })
  .refine((value) => !isCommonPassword(value), { message: COMMON_PASSWORD_MESSAGE });
