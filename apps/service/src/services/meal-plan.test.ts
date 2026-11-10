import { describe, expect, it } from 'vitest';
import { ProblemError } from '../problem.js';
import { addDays, assertSunday, toEntry, type EntryRow } from './meal-plan.js';

/*
 * The week planner's pure logic: the Sunday-only validation and the week's date-range math, both
 * testable without a database.
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

describe('toEntry', () => {
  it('maps custom meal item with null recipe fields and null readiness', () => {
    const row: EntryRow = {
      id: '00000000-0000-4000-8000-000000000001',
      household_id: '00000000-0000-4000-8000-000000000002',
      recipe_id: null,
      recipe_title: null,
      custom_title: 'Banana',
      planned_date: '2026-11-15',
      meal_type: 'breakfast',
      added_by: '00000000-0000-4000-8000-000000000003',
      created_at: '2026-11-10T12:00:00.000Z',
      readiness_percent: null,
    };
    const entry = toEntry(row);
    expect(entry.customTitle).toBe('Banana');
    expect(entry.recipeId).toBeNull();
    expect(entry.recipeTitle).toBeNull();
    expect(entry.readinessPercent).toBeNull();
  });

  it('maps deleted recipe snapshot with null recipeId, intact title, and null readiness', () => {
    const row: EntryRow = {
      id: '00000000-0000-4000-8000-000000000001',
      household_id: '00000000-0000-4000-8000-000000000002',
      recipe_id: null,
      recipe_title: 'Old Deleted Recipe',
      custom_title: null,
      planned_date: '2026-11-15',
      meal_type: 'dinner',
      added_by: '00000000-0000-4000-8000-000000000003',
      created_at: '2026-11-10T12:00:00.000Z',
      readiness_percent: 75,
    };
    const entry = toEntry(row);
    expect(entry.customTitle).toBeNull();
    expect(entry.recipeId).toBeNull();
    expect(entry.recipeTitle).toBe('Old Deleted Recipe');
    expect(entry.readinessPercent).toBeNull();
  });

  it('maps active recipe entry preserving readiness score', () => {
    const row: EntryRow = {
      id: '00000000-0000-4000-8000-000000000001',
      household_id: '00000000-0000-4000-8000-000000000002',
      recipe_id: '00000000-0000-4000-8000-000000000004',
      recipe_title: 'Lasagna',
      custom_title: null,
      planned_date: '2026-11-15',
      meal_type: 'dinner',
      added_by: '00000000-0000-4000-8000-000000000003',
      created_at: '2026-11-10T12:00:00.000Z',
      readiness_percent: 92,
    };
    const entry = toEntry(row);
    expect(entry.customTitle).toBeNull();
    expect(entry.recipeId).toBe('00000000-0000-4000-8000-000000000004');
    expect(entry.recipeTitle).toBe('Lasagna');
    expect(entry.readinessPercent).toBe(92);
  });
});
