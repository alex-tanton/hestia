import { z } from 'zod';

/** GoTrue enforces the same minimum (GOTRUE_PASSWORD_MIN_LENGTH). */
export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt, which GoTrue hashes with, ignores everything past 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

/** Design › Screens › 1 writes this sentence; the PWA and the service both show exactly it. */
export const COMMON_PASSWORD_MESSAGE = 'That password is too common. Choose another.';

/**
 * The shape half of the password policy (Requirements, "Authentication"): length and bytes.
 *
 * The other half is the 10,000-entry common-password list, which is 99 KB of text. Every request
 * schema that mentions a password is reachable from this package's entry point, so keeping the
 * list here would drag it into the PWA's app shell, which has a budget to keep (Engineering
 * Practices › Performance budget). It lives behind the `@hearth/shared/common-passwords` subpath
 * instead, whose `newPasswordSchema` is this schema plus the list: the service validates with
 * that one, and the PWA reaches it only from the two screens that set a password.
 */
export const passwordShapeSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${String(PASSWORD_MIN_LENGTH)} characters.`)
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_LENGTH, {
    message: `Use at most ${String(PASSWORD_MAX_LENGTH)} bytes.`,
  });
