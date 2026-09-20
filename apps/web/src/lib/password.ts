import { newPasswordSchema } from '@hearth/shared/common-passwords';

/** Design › Screens › 1: the rule is shown up front, not only after a failure. */
export const PASSWORD_HINT = 'At least 8 characters';

/**
 * The password policy, checked with the same schema the service validates with, so the common
 * password list and the length rule give the same sentence on both sides (Requirements,
 * "Authentication").
 *
 * The list is imported through its own entry point and this module is reached only from the three
 * screens that set a password — sign-up, set-password, and Settings' change-password — each of
 * which is behind a lazy route, so the 99 KB list never lands in the app shell (Engineering
 * Practices › Performance budget).
 */
export function validateNewPassword(value: string): string | undefined {
  const result = newPasswordSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}
