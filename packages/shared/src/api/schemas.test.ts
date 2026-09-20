import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { signupRequestSchema } from './auth.js';
import { endpoints } from './contract.js';
import { createHouseholdRequestSchema, updateHouseholdRequestSchema } from './households.js';
import { createdInviteSchema } from './invites.js';
import { departRequestSchema } from './membership.js';
import { updateProfileRequestSchema } from './users.js';

const ID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

describe('request schemas', () => {
  it('validates signup and rejects a common password', () => {
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
    expect(
      signupRequestSchema.safeParse({ email: 'alex@example.com', password: 'password1' }).success,
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
    const invite = { id: ID, createdBy: ID, createdAt: new Date().toISOString() };
    const base = { invite: { ...invite, expiresAt: invite.createdAt }, link: 'https://h.test/j' };
    expect(createdInviteSchema.safeParse({ ...base, code: '0123ABCZ' }).success).toBe(true);
    for (const code of ['0123ABCU', '0123ABCI', '0123abcz', '0123ABC']) {
      expect(createdInviteSchema.safeParse({ ...base, code }).success).toBe(false);
    }
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
