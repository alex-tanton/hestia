import { describe, expect, it } from 'vitest';
import { createMealPlanEntryRequestSchema, mealPlanEntrySchema } from './meal-plan.js';

const VALID_ID = '00000000-0000-4000-8000-000000000001';
const VALID_HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000002';
const VALID_USER_ID = '00000000-0000-4000-8000-000000000003';
const VALID_RECIPE_ID = '00000000-0000-4000-8000-000000000004';
const VALID_DATE = '2026-11-15';
const VALID_TIMESTAMP = '2026-11-10T12:00:00.000Z';

describe('createMealPlanEntryRequestSchema', () => {
  it('accepts a valid recipe entry request', () => {
    const input = {
      recipeId: VALID_RECIPE_ID,
      plannedDate: VALID_DATE,
      mealType: 'dinner',
    };
    const parsed = createMealPlanEntryRequestSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(input);
    }
  });

  it('accepts a valid standalone custom food item request', () => {
    const input = {
      customTitle: 'Greek Yogurt & Honey',
      plannedDate: VALID_DATE,
      mealType: 'breakfast',
    };
    const parsed = createMealPlanEntryRequestSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(input);
    }
  });

  it('trims whitespace on customTitle', () => {
    const input = {
      customTitle: '   Banana   ',
      plannedDate: VALID_DATE,
      mealType: 'lunch',
    };
    const parsed = createMealPlanEntryRequestSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success && 'customTitle' in parsed.data) {
      expect(parsed.data.customTitle).toBe('Banana');
    }
  });

  it('rejects empty or whitespace-only customTitle', () => {
    const empty = createMealPlanEntryRequestSchema.safeParse({
      customTitle: '',
      plannedDate: VALID_DATE,
      mealType: 'breakfast',
    });
    expect(empty.success).toBe(false);

    const whitespace = createMealPlanEntryRequestSchema.safeParse({
      customTitle: '     ',
      plannedDate: VALID_DATE,
      mealType: 'breakfast',
    });
    expect(whitespace.success).toBe(false);
  });

  it('rejects customTitle exceeding 200 characters', () => {
    const tooLong = createMealPlanEntryRequestSchema.safeParse({
      customTitle: 'A'.repeat(201),
      plannedDate: VALID_DATE,
      mealType: 'snack',
    });
    expect(tooLong.success).toBe(false);
  });

  it('rejects payload missing both recipeId and customTitle', () => {
    const missing = createMealPlanEntryRequestSchema.safeParse({
      plannedDate: VALID_DATE,
      mealType: 'dinner',
    });
    expect(missing.success).toBe(false);
  });

  it('rejects invalid mealType or invalid date', () => {
    const invalidMealType = createMealPlanEntryRequestSchema.safeParse({
      customTitle: 'Snack',
      plannedDate: VALID_DATE,
      mealType: 'midnight_snack',
    });
    expect(invalidMealType.success).toBe(false);

    const invalidDate = createMealPlanEntryRequestSchema.safeParse({
      customTitle: 'Snack',
      plannedDate: 'not-a-date',
      mealType: 'lunch',
    });
    expect(invalidDate.success).toBe(false);
  });
});

describe('mealPlanEntrySchema', () => {
  it('parses a standalone custom meal item with null recipe fields', () => {
    const entry = {
      id: VALID_ID,
      householdId: VALID_HOUSEHOLD_ID,
      recipeId: null,
      recipeTitle: null,
      customTitle: 'Organic Apple',
      readinessPercent: null,
      plannedDate: VALID_DATE,
      mealType: 'lunch',
      addedBy: VALID_USER_ID,
      createdAt: VALID_TIMESTAMP,
    };
    const parsed = mealPlanEntrySchema.safeParse(entry);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.customTitle).toBe('Organic Apple');
      expect(parsed.data.recipeId).toBeNull();
      expect(parsed.data.recipeTitle).toBeNull();
      expect(parsed.data.readinessPercent).toBeNull();
    }
  });

  it('parses an active recipe entry with readiness score', () => {
    const entry = {
      id: VALID_ID,
      householdId: VALID_HOUSEHOLD_ID,
      recipeId: VALID_RECIPE_ID,
      recipeTitle: 'Spaghetti Bolognese',
      customTitle: null,
      readinessPercent: 85,
      plannedDate: VALID_DATE,
      mealType: 'dinner',
      addedBy: VALID_USER_ID,
      createdAt: VALID_TIMESTAMP,
    };
    const parsed = mealPlanEntrySchema.safeParse(entry);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recipeTitle).toBe('Spaghetti Bolognese');
      expect(parsed.data.recipeId).toBe(VALID_RECIPE_ID);
      expect(parsed.data.customTitle).toBeNull();
      expect(parsed.data.readinessPercent).toBe(85);
    }
  });

  it('parses a deleted recipe snapshot with null recipeId and customTitle', () => {
    const entry = {
      id: VALID_ID,
      householdId: VALID_HOUSEHOLD_ID,
      recipeId: null,
      recipeTitle: 'Deleted Stew',
      customTitle: null,
      readinessPercent: null,
      plannedDate: VALID_DATE,
      mealType: 'dinner',
      addedBy: VALID_USER_ID,
      createdAt: VALID_TIMESTAMP,
    };
    const parsed = mealPlanEntrySchema.safeParse(entry);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recipeId).toBeNull();
      expect(parsed.data.recipeTitle).toBe('Deleted Stew');
      expect(parsed.data.customTitle).toBeNull();
    }
  });
});
