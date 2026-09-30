import { describe, expect, it } from 'vitest';
import { ProblemError } from '../problem.js';
import { addDays, assertSunday } from './meal-plan.js';

/*
 * The week planner's pure logic (Technical Architecture, "API surface" — "Meal plan"): the
 * Sunday-only validation and the week's date-range math, both testable without a database.
 */
describe('assertSunday', () => {
  it('accepts a Sunday', () => {
    // 2026-10-04 is a Sunday.
    expect(() => {
      assertSunday('2026-10-04');
    }).not.toThrow();
  });

  it('rejects any other day of the week with 400', () => {
    // 2026-10-05 is a Monday.
    expect(() => {
      assertSunday('2026-10-05');
    }).toThrow(ProblemError);
    try {
      assertSunday('2026-10-05');
    } catch (error) {
      expect(error).toBeInstanceOf(ProblemError);
      expect((error as ProblemError).problem.status).toBe(400);
    }
  });
});

describe('addDays', () => {
  it('adds calendar days without drifting across a month boundary', () => {
    expect(addDays('2026-10-04', 6)).toBe('2026-10-10');
    expect(addDays('2026-10-28', 6)).toBe('2026-11-03');
  });

  it('adds zero as a no-op', () => {
    expect(addDays('2026-10-04', 0)).toBe('2026-10-04');
  });
});
