import { describe, expect, it } from 'vitest';
import {
  createChoreRequestSchema,
  rotationDuplicateMessage,
  updateChoreRequestSchema,
} from './chores.js';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';

const base = {
  name: 'Bins',
  recurrenceUnit: 'week',
  interval: 1,
  anchorDate: '2026-10-01',
} as const;

describe('rotation distinct members (shared schema)', () => {
  it('rejects a repeated member on create, at the rotation order path', () => {
    const result = createChoreRequestSchema.safeParse({
      ...base,
      assignment: { type: 'rotation', rotationOrder: [a, b, a] },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(['assignment', 'rotationOrder']);
    expect(result.error.issues[0]?.message).toBe(rotationDuplicateMessage);
  });

  it('rejects a repeated member on edit', () => {
    const result = updateChoreRequestSchema.safeParse({
      assignment: { type: 'rotation', rotationOrder: [a, a] },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a distinct list on create and edit', () => {
    expect(
      createChoreRequestSchema.safeParse({
        ...base,
        assignment: { type: 'rotation', rotationOrder: [a, b] },
      }).success,
    ).toBe(true);
    expect(
      updateChoreRequestSchema.safeParse({
        assignment: { type: 'rotation', rotationOrder: [b, a] },
      }).success,
    ).toBe(true);
  });

  it('accepts a single-member rotation', () => {
    expect(
      createChoreRequestSchema.safeParse({
        ...base,
        assignment: { type: 'rotation', rotationOrder: [a] },
      }).success,
    ).toBe(true);
  });

  it('still rejects an empty rotation', () => {
    expect(
      createChoreRequestSchema.safeParse({
        ...base,
        assignment: { type: 'rotation', rotationOrder: [] },
      }).success,
    ).toBe(false);
  });
});
