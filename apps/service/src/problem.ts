import { STATUS_CODES } from 'node:http';
import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from '@hestia/shared';
import type { GoTrueError } from './gotrue/http.js';
import type { RecipeFetchError, RecipeFetchErrorCode } from './recipes/fetch-recipe.js';

export { PROBLEM_CONTENT_TYPE, type ProblemDetails };

export function problem(status: number, detail?: string): ProblemDetails {
  return {
    // 'about:blank' is RFC 9457's type for problems with no more specific semantics.
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    ...(detail === undefined ? {} : { detail }),
  };
}

/**
 * An error carrying its own problem body. Thrown by rate limiting and route code so the
 * global error handler can send it unchanged.
 */
export class ProblemError extends Error {
  readonly statusCode: number;
  readonly problem: ProblemDetails;

  constructor(details: ProblemDetails) {
    super(details.detail ?? details.title);
    this.name = 'ProblemError';
    this.statusCode = details.status;
    this.problem = details;
  }
}

export function fail(status: number, detail?: string): ProblemError {
  return new ProblemError(problem(status, detail));
}

/**
 * SQLSTATEs from the membership functions and from constraints, mapped to responses. A null detail means the database's own
 * message is shown: 22023 is raised with messages written for the caller, or by Postgres echoing
 * only the caller's own input.
 */
const DATABASE_PROBLEMS: Readonly<Record<string, readonly [number, string | null]>> = {
  '42501': [403, 'You do not have permission to do that.'],
  P0002: [404, 'That person is not a member of this household.'],
  '22023': [400, null],
  HR001: [410, 'This invite has expired or was revoked.'],
  HR002: [404, 'No invite matches that link or code.'],
  HR003: [409, 'Reassign everything the member owns before they leave.'],
  HR004: [400, 'The household name does not match.'],
  '23505': [409, 'That already exists.'],
  '23503': [409, 'That refers to something that no longer exists.'],
  '23514': [400, 'That value is not allowed.'],
  '23502': [400, 'A required value is missing.'],
  '22P02': [400, 'A value has the wrong format.'],
  '22007': [400, 'A date or time has the wrong format.'],
  '22008': [400, 'A date or time is out of range.'],
};

function sqlState(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

/** The problem for a Postgres error with a known SQLSTATE, or undefined for anything else. */
export function problemFromDatabaseError(error: unknown): ProblemError | undefined {
  const code = sqlState(error);
  if (code === undefined) return undefined;
  const mapping = DATABASE_PROBLEMS[code];
  if (mapping === undefined) return undefined;
  const [status, detail] = mapping;
  const message = error instanceof Error ? error.message : undefined;
  return fail(status, detail ?? message);
}

/**
 * GoTrue's refusals, passed on: its 4xx messages are written for the user who caused them.
 * GoTrue failing outright is a bad gateway.
 */
export function problemFromGoTrueError(error: GoTrueError): ProblemError {
  if (error.status === 429) return fail(429, 'Too many attempts. Try again later.');
  if (error.status >= 400 && error.status < 500) {
    const status =
      error.code === 'user_already_exists' || error.code === 'email_exists' ? 409 : 400;
    return fail(status, error.message === '' ? undefined : error.message);
  }
  return fail(502, 'The sign-in service is unavailable.');
}

/**
 * A recipe URL that could not be fetched at all. This is distinct from a page that fetched fine but
 * had no usable JSON-LD: that is a 200 with `needsManualEntry: true`, never an error.
 */
const RECIPE_FETCH_STATUS: Readonly<Record<RecipeFetchErrorCode, number>> = {
  invalid_url: 400,
  private_address: 400,
  timeout: 504,
  too_large: 502,
  http_error: 502,
  network_error: 502,
};

export function problemFromRecipeFetchError(error: RecipeFetchError): ProblemError {
  return fail(RECIPE_FETCH_STATUS[error.code], error.message);
}
