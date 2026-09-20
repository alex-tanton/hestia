import { describe, expect, it } from 'vitest';
import { GoTrueError } from './gotrue/http.js';
import { problem, problemFromDatabaseError, problemFromGoTrueError } from './problem.js';

function pgError(code: string, message = 'database says no'): Error {
  return Object.assign(new Error(message), { code });
}

describe('problemFromDatabaseError', () => {
  it.each([
    ['42501', 403],
    ['P0002', 404],
    ['22023', 400],
    ['HR001', 410],
    ['HR002', 404],
    ['HR003', 409],
    ['HR004', 400],
    ['23505', 409],
    ['23503', 409],
    ['23514', 400],
    ['23502', 400],
    ['22P02', 400],
    ['22007', 400],
    ['22008', 400],
  ])('maps SQLSTATE %s to %i', (code, status) => {
    const mapped = problemFromDatabaseError(pgError(code));
    expect(mapped?.problem.status).toBe(status);
    expect(mapped?.problem.type).toBe('about:blank');
  });

  it('shows the function’s own message only for invalid arguments', () => {
    expect(
      problemFromDatabaseError(pgError('22023', 'postal code must be five digits'))?.problem.detail,
    ).toBe('postal code must be five digits');
    expect(
      problemFromDatabaseError(pgError('23505', 'Key (email)=(a@b.c) already exists'))?.problem
        .detail,
    ).toBe('That already exists.');
  });

  it('leaves unknown codes and non-database errors alone', () => {
    expect(problemFromDatabaseError(pgError('XX000'))).toBeUndefined();
    expect(problemFromDatabaseError(pgError('nonsense'))).toBeUndefined();
    expect(problemFromDatabaseError(new Error('plain'))).toBeUndefined();
    expect(problemFromDatabaseError(null)).toBeUndefined();
    expect(problemFromDatabaseError({ code: 42501 })).toBeUndefined();
  });
});

describe('problemFromGoTrueError', () => {
  it('passes 4xx refusals on with GoTrue’s message', () => {
    expect(
      problemFromGoTrueError(new GoTrueError(422, 'weak_password', 'Password is too weak')).problem,
    ).toEqual(problem(400, 'Password is too weak'));
    expect(problemFromGoTrueError(new GoTrueError(400, 'unknown', '')).problem).toEqual(
      problem(400),
    );
  });

  it('turns an existing account into a conflict', () => {
    expect(
      problemFromGoTrueError(new GoTrueError(422, 'user_already_exists', 'User already registered'))
        .problem.status,
    ).toBe(409);
    expect(
      problemFromGoTrueError(new GoTrueError(422, 'email_exists', 'exists')).problem.status,
    ).toBe(409);
  });

  it('passes rate limiting on and hides GoTrue failures', () => {
    expect(
      problemFromGoTrueError(new GoTrueError(429, 'over_request_rate_limit', 'x')).problem.status,
    ).toBe(429);
    expect(problemFromGoTrueError(new GoTrueError(500, 'unexpected', 'boom')).problem).toEqual(
      problem(502, 'The sign-in service is unavailable.'),
    );
  });
});
