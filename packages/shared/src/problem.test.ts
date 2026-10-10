import { describe, expect, it } from 'vitest';
import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from './problem.js';

/**
 * RFC 9457 problem details is the only error body the API returns (Technical Architecture).
 * Nothing in the service or its tests imports this schema directly — each caller builds its own
 * problem body shape — so without a test here the module never loads at all.
 */
describe('problemDetailsSchema', () => {
  it('accepts a full problem body with an in-range HTTP status', () => {
    const result = problemDetailsSchema.safeParse({
      type: 'https://hearth.example/problems/validation',
      title: 'Validation failed',
      status: 422,
      detail: 'Enter a name.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a problem body with no detail, which is optional', () => {
    expect(
      problemDetailsSchema.safeParse({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
      }).success,
    ).toBe(true);
  });

  it('refuses a status outside the HTTP error range', () => {
    // status is meant to carry an HTTP error code (4xx/5xx); 200 and 600 are both out of range.
    expect(
      problemDetailsSchema.safeParse({ type: 'about:blank', title: 'OK', status: 200 }).success,
    ).toBe(false);
    expect(
      problemDetailsSchema.safeParse({ type: 'about:blank', title: 'Too high', status: 600 })
        .success,
    ).toBe(false);
  });

  it('refuses a non-integer status and a missing type or title', () => {
    expect(
      problemDetailsSchema.safeParse({ type: 'about:blank', title: 'Bad', status: 422.5 }).success,
    ).toBe(false);
    expect(problemDetailsSchema.safeParse({ title: 'No type', status: 400 }).success).toBe(false);
    expect(problemDetailsSchema.safeParse({ type: 'about:blank', status: 400 }).success).toBe(
      false,
    );
  });
});

describe('PROBLEM_CONTENT_TYPE', () => {
  it('is the RFC 9457 media type', () => {
    expect(PROBLEM_CONTENT_TYPE).toBe('application/problem+json');
  });
});
