import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as api from '../index.js';
import { endpoints } from './contract.js';
import { flyersQuerySchema } from './deals.js';
import { departRequestSchema } from './membership.js';
import { recipesQuerySchema } from './recipes.js';

/*
 * A PATCH body sets only the fields it names. A schema that fills in a default for a field the
 * caller left out would reset that field on every partial update, so no PATCH body schema may
 * default, prefault, or catch a field. The endpoint list in `contract.ts` is what the service
 * validates against and what the OpenAPI document is built from, so it is the registry of which
 * schemas are PATCH bodies.
 *
 * Scanning the wrappers matters on top of parsing `{}`: every PATCH body rejects `{}` today (a
 * refine or a required field), which would hide a defaulted sibling of a field that is sent.
 */

const DEFAULTING = new Set(['default', 'prefault', 'catch']);
// Wrappers a field's schema can sit behind; `pipe` is followed through its input side.
const WRAPPERS = new Set(['optional', 'nullable', 'nonoptional', 'readonly', ...DEFAULTING]);
const MAX_DEPTH = 12;

interface Def {
  type: string;
  innerType?: z.ZodType;
  in?: z.ZodType;
  shape?: Record<string, z.ZodType>;
}

const defOf = (schema: z.ZodType): Def => schema._zod.def;

/** The object schema under any `pipe` (a transform or a refine-and-transform on the body). */
function objectShape(schema: z.ZodType): Record<string, z.ZodType> {
  let current = schema;
  for (let input = defOf(current).in; defOf(current).type === 'pipe' && input;) {
    current = input;
    input = defOf(current).in;
  }
  const { type, shape } = defOf(current);
  if (type !== 'object' || shape === undefined) {
    throw new Error(`a PATCH body must be an object schema, found ${type}`);
  }
  return shape;
}

/** The fields whose schema, through any wrappers, supplies a value the caller did not send. */
function defaultingFields(schema: z.ZodType): string[] {
  return Object.entries(objectShape(schema))
    .filter(([, field]) => {
      let current: z.ZodType | undefined = field;
      for (let depth = 0; current !== undefined && depth < MAX_DEPTH; depth += 1) {
        const { type, innerType, in: input } = defOf(current);
        if (DEFAULTING.has(type)) return true;
        current = type === 'pipe' ? input : WRAPPERS.has(type) ? innerType : undefined;
      }
      return false;
    })
    .map(([name]) => name);
}

const patchEndpoints = endpoints.filter((endpoint) => endpoint.method === 'PATCH');

describe('PATCH body schemas', () => {
  it('are found in the contract', () => {
    // Eleven today. An empty registry would let every check below pass over nothing, so it fails;
    // an endpoint without a body would have nothing to guard, so it is refused.
    expect(patchEndpoints.length).toBeGreaterThan(0);
    for (const endpoint of patchEndpoints) {
      expect('body' in endpoint, `${endpoint.method} ${endpoint.path} has no body schema`).toBe(
        true,
      );
    }
  });

  it.each(patchEndpoints.map((endpoint) => [endpoint.path, endpoint.body] as const))(
    '%s injects no default for a field left out',
    (_path, body) => {
      expect(body).toBeDefined();
      expect(defaultingFields(body as z.ZodType)).toEqual([]);
      // An empty body is refused (at least one field is required) or parses to nothing; it never
      // parses to a body the caller did not write.
      const parsed = (body as z.ZodType).safeParse({});
      expect(parsed.success ? Object.keys(parsed.data as object) : []).toEqual([]);
    },
  );

  it('are every exported update*RequestSchema, so none is wired in unregistered', () => {
    const registered = new Set<unknown>(patchEndpoints.map((endpoint) => endpoint.body));
    const named = Object.entries(api).filter(([name]) =>
      /^update[A-Z]\w*RequestSchema$/.test(name),
    );
    expect(named.length).toBeGreaterThan(0);
    for (const [name, schema] of named) {
      expect(registered.has(schema), `${name} is not the body of any PATCH endpoint`).toBe(true);
    }
  });

  it('leave out the schemas that default on purpose because they are not PATCH bodies', () => {
    // These default a field for a POST body or a query string, where a missing value should take
    // the default. The registry is what keeps them out of the guard, not luck: fed to it directly,
    // each is flagged.
    const notPatchBodies = {
      departRequestSchema: [departRequestSchema, ['reassignments']],
      recipesQuerySchema: [recipesQuerySchema, ['page']],
      flyersQuerySchema: [flyersQuerySchema, ['scope']],
    } as const;
    const registered = new Set<unknown>(patchEndpoints.map((endpoint) => endpoint.body));
    const outcome = Object.fromEntries(
      Object.entries(notPatchBodies).map(([name, [schema]]) => [
        name,
        [registered.has(schema), defaultingFields(schema)],
      ]),
    );
    expect(outcome).toEqual({
      departRequestSchema: [false, ['reassignments']],
      recipesQuerySchema: [false, ['page']],
      flyersQuerySchema: [false, ['scope']],
    });
  });
});

describe('the guard itself', () => {
  const mutants: [string, z.ZodType][] = [
    [
      'a .partial() over a defaulted field',
      z.object({ a: z.number().default(1), b: z.string() }).partial(),
    ],
    ['a default behind optional', z.object({ a: z.number().default(1).optional() })],
    ['a default under optional', z.object({ a: z.number().optional().default(1) })],
    ['a nullable default', z.object({ a: z.string().nullable().default(null) })],
    ['a prefault', z.object({ a: z.number().prefault(2) })],
    ['a catch', z.object({ a: z.number().catch(0).optional() })],
    ['a default under a refine', z.object({ a: z.number().default(1) }).refine((v) => v.a > 0)],
    ['a default under a transform', z.object({ a: z.number().default(1) }).transform((v) => v)],
  ];
  it.each(mutants)('flags %s', (_name, schema) => {
    expect(defaultingFields(schema)).toEqual(['a']);
  });

  it('leaves a clean schema alone', () => {
    const clean = z.object({ a: z.number().optional(), b: z.string().nullable().optional() });
    expect(defaultingFields(clean)).toEqual([]);
  });

  it('refuses a body that is not an object, rather than passing it unchecked', () => {
    expect(() => defaultingFields(z.string())).toThrow(/object schema/);
  });
});
