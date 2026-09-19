import { STATUS_CODES } from 'node:http';

/** RFC 9457 problem details, the only error body the API returns. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

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
