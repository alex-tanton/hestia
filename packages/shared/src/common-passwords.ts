import type { z } from 'zod';
import { COMMON_PASSWORDS_TEXT } from './data/common-passwords.js';
import { COMMON_PASSWORD_MESSAGE, passwordShapeSchema } from './password.js';

/*
 * The common-password half of the password policy, behind its own entry point.
 *
 * The list is 99 KB of text, so it is imported only where a password is actually being set: the
 * service's signup and change-password routes, and the PWA's sign-up, set-password, and
 * change-password screens. Everything else — including every request schema that merely mentions
 * a password — stays on `@hearth/shared`, which never reaches this module, so the app shell never
 * carries the list (Engineering Practices › Performance budget). Both sides check it
 * synchronously; only the module boundary moved.
 */

let commonPasswords: ReadonlySet<string> | undefined;

// Built on first use rather than at import, so loading this module is cheap until a password
// is actually checked.
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

/** The whole password policy (Requirements, "Authentication"), for signup and password change. */
export const newPasswordSchema: z.ZodType<string> = passwordShapeSchema.refine(
  (value) => !isCommonPassword(value),
  { message: COMMON_PASSWORD_MESSAGE },
);
