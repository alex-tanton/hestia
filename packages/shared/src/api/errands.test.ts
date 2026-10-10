import { describe, expect, it } from 'vitest';
import { updateErrandRequestSchema } from './errands.js';

const USER_ID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

/**
 * updateErrandRequestSchema chains two refines. Nothing elsewhere in the codebase safeParse()s
 * this schema with real data (contract.ts only converts it to JSON Schema), so both refines'
 * predicates have never run.
 */
describe('updateErrandRequestSchema: at least one field', () => {
  it('refuses an empty PATCH', () => {
    expect(updateErrandRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a PATCH that reassigns the errand alone', () => {
    expect(updateErrandRequestSchema.safeParse({ assignedTo: USER_ID }).success).toBe(true);
  });
});

describe('updateErrandRequestSchema: doneAt only with status done', () => {
  it('accepts doneAt alongside status done', () => {
    expect(
      updateErrandRequestSchema.safeParse({
        status: 'done',
        doneAt: '2026-10-01T12:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('refuses doneAt without a status at all', () => {
    // doneAt records when an offline "done" action happened; without status: done in the same
    // PATCH there is nothing for that timestamp to attach to.
    expect(updateErrandRequestSchema.safeParse({ doneAt: '2026-10-01T12:00:00Z' }).success).toBe(
      false,
    );
  });

  it('refuses doneAt paired with status open', () => {
    expect(
      updateErrandRequestSchema.safeParse({
        status: 'open',
        doneAt: '2026-10-01T12:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('accepts status done with no doneAt (server stamps the time instead)', () => {
    expect(updateErrandRequestSchema.safeParse({ status: 'done' }).success).toBe(true);
  });
});
