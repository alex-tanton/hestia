import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { signupRequestSchema } from './auth.js';
import { moveBillRequestSchema } from './bills.js';
import { endpoints } from './contract.js';
import { createHouseholdRequestSchema, updateHouseholdRequestSchema } from './households.js';
import { createdInviteSchema } from './invites.js';
import { createMatchOverrideRequestSchema } from './matching.js';
import { departRequestSchema } from './membership.js';
import { createRecipeRequestSchema, updateRecipeRequestSchema } from './recipes.js';
import { updateProfileRequestSchema } from './users.js';

const ID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

describe('request schemas', () => {
  it('validates signup, leaving the common-password rule to the route', () => {
    expect(
      signupRequestSchema.safeParse({
        email: 'alex@example.com',
        password: 'violet-teapot-harbor-17',
        displayName: ' Alex ',
        timezone: 'America/New_York',
      }).data,
    ).toEqual({
      email: 'alex@example.com',
      password: 'violet-teapot-harbor-17',
      displayName: 'Alex',
      timezone: 'America/New_York',
    });
    // The list lives behind `@hestia/shared/common-passwords`, which the route composes in
    // (`routes.test.ts` covers the refusal); the wire schema only checks length and bytes.
    expect(
      signupRequestSchema.safeParse({ email: 'alex@example.com', password: 'short' }).success,
    ).toBe(false);
    expect(
      signupRequestSchema.safeParse({ email: 'not-an-email', password: 'violet-teapot-17' })
        .success,
    ).toBe(false);
  });

  it('requires a five-digit ZIP code and a name for a household', () => {
    expect(
      createHouseholdRequestSchema.safeParse({
        name: 'Oak Street',
        postalCode: '27514',
        timezone: 'America/New_York',
      }).success,
    ).toBe(true);
    for (const postalCode of ['2751', '275140', 'abcde', '27514-1234']) {
      expect(
        createHouseholdRequestSchema.safeParse({ name: 'x', postalCode, timezone: 'UTC' }).success,
      ).toBe(false);
    }
    expect(
      createHouseholdRequestSchema.safeParse({ name: '   ', postalCode: '27514', timezone: 'UTC' })
        .success,
    ).toBe(false);
  });

  it('refuses an empty PATCH', () => {
    expect(updateHouseholdRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProfileRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProfileRequestSchema.safeParse({ quietHours: null }).success).toBe(true);
    expect(
      updateProfileRequestSchema.safeParse({ quietHours: { start: '22:00', end: '07:00' } })
        .success,
    ).toBe(true);
    expect(
      updateProfileRequestSchema.safeParse({ quietHours: { start: '24:00', end: '07:00' } })
        .success,
    ).toBe(false);
  });

  it('defaults reassignments and requires ids on both sides', () => {
    expect(departRequestSchema.parse({})).toEqual({ reassignments: {} });
    expect(departRequestSchema.safeParse({ reassignments: { [ID]: ID } }).success).toBe(true);
    expect(departRequestSchema.safeParse({ reassignments: { x: ID } }).success).toBe(false);
    expect(departRequestSchema.safeParse({ reassignments: { [ID]: 'x' } }).success).toBe(false);
  });

  it('only accepts Crockford codes in a created invite', () => {
    const invite = { id: ID, createdBy: ID, createdAt: '2026-10-14T12:00:00.000Z' };
    const base = { invite: { ...invite, expiresAt: invite.createdAt }, link: 'https://h.test/j' };
    expect(createdInviteSchema.safeParse({ ...base, code: '0123ABCZ' }).success).toBe(true);
    for (const code of ['0123ABCU', '0123ABCI', '0123abcz', '0123ABC']) {
      expect(createdInviteSchema.safeParse({ ...base, code }).success).toBe(false);
    }
  });

  it('requires a target kind and decision on a match override, refusing neither', () => {
    const base = { ingredientName: 'cheese', targetName: 'Kraft Shredded Cheese' };
    expect(
      createMatchOverrideRequestSchema.safeParse({
        ...base,
        targetKind: 'deal',
        decision: 'force_match',
      }).success,
    ).toBe(true);
    expect(
      createMatchOverrideRequestSchema.safeParse({
        ...base,
        targetKind: 'aisle',
        decision: 'force_match',
      }).success,
    ).toBe(false);
    expect(
      createMatchOverrideRequestSchema.safeParse({ ...base, targetKind: 'deal', decision: 'maybe' })
        .success,
    ).toBe(false);
    expect(
      createMatchOverrideRequestSchema.safeParse({ ...base, targetKind: 'deal' }).success,
    ).toBe(false);
  });

  it('accepts a recipe with manual or parsed-style ingredients, and requires a title', () => {
    const manual = {
      title: 'Lentil Curry',
      ingredients: [{ itemName: 'lentils', quantity: 2, unit: 'cups' }],
    };
    expect(createRecipeRequestSchema.safeParse(manual).success).toBe(true);
    const parsed = {
      title: 'Sheet Pan Chicken',
      sourceUrl: 'https://example.com/recipe',
      ingredients: [
        { itemName: 'chicken breast', quantity: 2, unit: 'lb', rawText: '2 lb chicken breast' },
      ],
    };
    expect(createRecipeRequestSchema.safeParse(parsed).success).toBe(true);
    expect(createRecipeRequestSchema.safeParse({ title: '  ', ingredients: [] }).success).toBe(
      false,
    );
    // A recipe with no ingredients at all is allowed (a recipe with no ingredients scores 0%).
    expect(createRecipeRequestSchema.safeParse({ title: 'Empty', ingredients: [] }).success).toBe(
      true,
    );
  });

  it('refuses an empty recipe PATCH, but accepts replacing just the ingredients', () => {
    expect(updateRecipeRequestSchema.safeParse({}).success).toBe(false);
    expect(
      updateRecipeRequestSchema.safeParse({
        ingredients: [{ itemName: 'salt' }],
      }).success,
    ).toBe(true);
    expect(updateRecipeRequestSchema.safeParse({ sourceUrl: null }).success).toBe(true);
  });
});

describe('bill moves', () => {
  it('takes a move to personal with no household, or a move into a named household', () => {
    expect(moveBillRequestSchema.safeParse({ visibility: 'personal' }).success).toBe(true);
    expect(
      moveBillRequestSchema.safeParse({ visibility: 'household', householdId: ID }).success,
    ).toBe(true);
  });

  it('refuses a move into a household that names no household, or an unknown visibility', () => {
    expect(moveBillRequestSchema.safeParse({ visibility: 'household' }).success).toBe(false);
    expect(
      moveBillRequestSchema.safeParse({ visibility: 'household', householdId: 'not-a-guid' })
        .success,
    ).toBe(false);
    expect(moveBillRequestSchema.safeParse({ visibility: 'shared' }).success).toBe(false);
  });
});

describe('the endpoint contract', () => {
  it('has unique method and path pairs', () => {
    const keys = endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('converts every schema to JSON Schema', () => {
    for (const endpoint of endpoints) {
      const schemas: z.ZodType[] = [];
      if ('body' in endpoint) schemas.push(endpoint.body);
      if ('params' in endpoint) schemas.push(endpoint.params);
      if ('schema' in endpoint.response) schemas.push(endpoint.response.schema);
      for (const schema of schemas) {
        expect(() => z.toJSONSchema(schema, { io: 'input' })).not.toThrow();
        expect(() => z.toJSONSchema(schema, { io: 'output' })).not.toThrow();
      }
    }
  });
});
