import { AuthError, RATE_LIMITED_MESSAGE } from '../../lib/auth/auth-client.ts';
import { OFFLINE_MESSAGE } from '../../lib/api/problem.ts';

/**
 * The magic-link screens' copy and input rules (Design › Screens › 1, "Magic link
 * (flag-hidden)"; Branding › Copy patterns).
 *
 * Only the two magic-link screens import this module, and both sit behind routes that exist
 * only when `VITE_MAGIC_LINK_ENABLED` is `true` (Technical Architecture, "Auth configuration"),
 * so with the flag off none of these sentences are built into the app at all. `pnpm build`
 * checks that for itself.
 */

/** Where the two screens live; the sign-in entry point and the flow between them use these. */
export const MAGIC_LINK_PATH = '/sign-in/link';
export const MAGIC_CODE_PATH = '/sign-in/code';

/** GoTrue's `GOTRUE_MAILER_OTP_LENGTH` is 6 (Technical Architecture, "Auth configuration"). */
export const CODE_LENGTH = 6;

/** Design › Screens › 1: "a resend action enabled after 30s". */
export const RESEND_AFTER_SECONDS = 30;

export const SEND_FAILED_MESSAGE = "Couldn't send a sign-in link. Try again.";
export const EMAIL_REQUIRED_MESSAGE = 'Enter your email address.';
export const CODE_INVALID_MESSAGE = 'That code is incorrect or has expired. Ask for a new one.';
export const CODE_LENGTH_MESSAGE = 'Enter the 6-digit code from the email.';

export function sentConfirmation(email: string): string {
  return `We sent a sign-in link and a 6-digit code to ${email}. Open the link on this device, or enter the code.`;
}

export function resentConfirmation(email: string): string {
  return `Sent a new code to ${email}.`;
}

export function codeScreenDescription(email: string): string {
  return `Enter the 6-digit code we sent to ${email}.`;
}

export function resendCountdown(secondsLeft: number): string {
  return `You can ask for a new code in ${String(secondsLeft)}s.`;
}

/**
 * What the field keeps of what was typed or pasted. People paste the code out of an email with
 * whatever spacing it arrived in, so everything but the digits is dropped rather than refused.
 */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/**
 * The sentence for a refused magic-link call. GoTrue answers a bad or expired code and an
 * unknown address alike, which is deliberate — neither may confirm whether an address exists —
 * so everything but a rate limit and a request that never left the device falls to the caller's
 * own copy.
 */
export function magicLinkMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthError) {
    if (error.status === 429) return RATE_LIMITED_MESSAGE;
    if (error.status === 0) return OFFLINE_MESSAGE;
  }
  return fallback;
}
