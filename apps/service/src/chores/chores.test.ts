import type { Kysely } from 'kysely';
import { describe, expect, it } from 'vitest';
import type { Database } from '../db.js';
import { ProblemError } from '../problem.js';
import { createChore, updateChore } from './chores.js';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const householdId = '33333333-3333-4333-8333-333333333333';
const choreId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';

// Any database access throws, so a test that reaches the database fails loudly with a marker
// message instead of passing for the wrong reason. The duplicate check must run before it.
const untouchedDb = new Proxy(
  {},
  {
    get() {
      throw new Error('database touched');
    },
  },
) as unknown as Kysely<Database>;

const createInput = (rotationOrder: string[]) => ({
  name: 'Bins',
  recurrenceUnit: 'week' as const,
  interval: 1,
  anchorDate: '2026-10-01',
  assignment: { type: 'rotation' as const, rotationOrder },
});

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

describe('rotation distinct members (service backstop)', () => {
  it('refuses a duplicate member on create as a 400 before touching the database', async () => {
    const error = await rejection(
      createChore(untouchedDb, householdId, userId, createInput([a, b, a])),
    );
    expect(error).toBeInstanceOf(ProblemError);
    expect((error as ProblemError).problem).toMatchObject({
      status: 400,
      detail: 'Each member can appear only once in the rotation.',
    });
  });

  it('refuses a duplicate member on edit as a 400 before touching the database', async () => {
    const error = await rejection(
      updateChore(untouchedDb, choreId, {
        assignment: { type: 'rotation', rotationOrder: [a, a] },
      }),
    );
    expect(error).toBeInstanceOf(ProblemError);
    expect((error as ProblemError).problem).toMatchObject({ status: 400 });
  });

  it('lets a distinct list through to the database on create', async () => {
    await expect(
      createChore(untouchedDb, householdId, userId, createInput([a, b])),
    ).rejects.toThrow('database touched');
  });

  it('lets a distinct list through to the database on edit', async () => {
    await expect(
      updateChore(untouchedDb, choreId, {
        assignment: { type: 'rotation', rotationOrder: [b, a] },
      }),
    ).rejects.toThrow('database touched');
  });

  it('lets a single-member rotation through to the database', async () => {
    await expect(createChore(untouchedDb, householdId, userId, createInput([a]))).rejects.toThrow(
      'database touched',
    );
  });
});
