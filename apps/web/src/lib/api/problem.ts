import { problemDetailsSchema, type ProblemDetails } from '@hearth/shared';

/**
 * A failed API call. `problem` carries the RFC 9457 body when the service sent one; `isOffline`
 * marks a request that never reached the network, which the UI presents as an offline state
 * rather than a failure.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | undefined;
  readonly isOffline: boolean;

  constructor(status: number, problem?: ProblemDetails, isOffline = false) {
    super(problem?.title ?? `Request failed with ${String(status)}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
    this.isOffline = isOffline;
  }
}

export function parseProblem(value: unknown): ProblemDetails | undefined {
  const result = problemDetailsSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

/**
 * Whether a problem's `detail` may be shown to the user as written.
 *
 * Most details are prose the service authors wrote for the person reading them, but a few paths
 * pass a database or GoTrue message through, and those can quote a household's own content. The
 * shared scrubber cannot help here — it is built for recording an error, not for rewriting one
 * into copy — so a detail is shown only when it is plain prose: no quotes or brackets (which is
 * how Postgres wraps an interpolated value), no URL, no address, and no great length.
 */
export function isPlainDetail(detail: string): boolean {
  const trimmed = detail.trim();
  if (trimmed === '' || trimmed.length > 160) return false;
  if (/[@"'`<>{}[\]\\|]/.test(trimmed)) return false;
  if (trimmed.includes('://')) return false;
  return /^[A-Za-z0-9 ,.;:()/%$#+\-–—‘’“”…?!]+$/.test(trimmed);
}

/** What each status means when the caller has no better copy of its own. */
const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'That did not work. Check what you entered and try again.',
  401: 'Your session has expired. Sign in again.',
  403: 'You do not have permission to do that.',
  404: 'That was not found.',
  409: 'That conflicts with something that has changed. Reload and try again.',
  410: 'This invite has expired. Ask for a new link or code.',
  429: 'Too many attempts. Try again in a minute.',
};

export const OFFLINE_MESSAGE = 'Offline. This needs a connection.';
export const UNEXPECTED_MESSAGE = 'Something went wrong. Try again.';

export interface UserMessageOptions {
  /** Copy for specific statuses, e.g. the invite states on the join screen. */
  byStatus?: Readonly<Record<number, string>>;
  /** Used when nothing more specific applies. */
  fallback?: string;
}

/**
 * The sentence to show a user for a failed call. Screen-specific copy wins, then the problem's
 * own detail when it is plain prose, then the status default.
 */
export function userMessage(error: unknown, options: UserMessageOptions = {}): string {
  const fallback = options.fallback ?? UNEXPECTED_MESSAGE;
  if (!(error instanceof ApiError)) return fallback;
  if (error.isOffline) return OFFLINE_MESSAGE;

  const specific = options.byStatus?.[error.status];
  if (specific !== undefined) return specific;

  const detail = error.problem?.detail;
  if (detail !== undefined && isPlainDetail(detail)) return detail;

  return STATUS_MESSAGES[error.status] ?? (error.status >= 500 ? UNEXPECTED_MESSAGE : fallback);
}
