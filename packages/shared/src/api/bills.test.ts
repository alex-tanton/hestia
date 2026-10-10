import { describe, expect, it } from 'vitest';
import {
  moveBillRequestSchema,
  payBillRequestSchema,
  updateBillPaymentRequestSchema,
  updateBillRequestSchema,
} from './bills.js';

const ID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

/**
 * moveBillRequestSchema's discriminated union is already covered by schemas.test.ts's "bill
 * moves" suite; these cover the request schemas nothing else in the codebase ever safeParse()s
 * with real data (contract.ts only feeds them to `z.toJSONSchema`, which never runs the refine
 * predicates below).
 */
describe('updateBillRequestSchema', () => {
  it('accepts a PATCH that changes exactly one field', () => {
    expect(updateBillRequestSchema.safeParse({ name: 'Internet' }).success).toBe(true);
  });

  it('accepts a PATCH that explicitly nulls out category', () => {
    // undefined and null are different here: category: null is a change (clearing it), while an
    // absent key is not, which is what the refine's `!== undefined` check distinguishes.
    expect(updateBillRequestSchema.safeParse({ category: null }).success).toBe(true);
  });

  it('an empty body still parses, since several fields default even through .partial()', () => {
    // This is the refine's blind spot, not a bug in the test: category/recurrenceUnit/interval/
    // reminderDaysBefore/autopay/isSubscription all default, so `Object.values(body).some(v =>
    // v !== undefined)` is always true for this schema — the "change at least one field" refine
    // can never actually reject anything here (contrast updateBillPaymentRequestSchema below,
    // whose fields have no defaults, where the same refine genuinely blocks an empty PATCH).
    // Route-level guards, not this schema, are what must refuse a truly empty PATCH /bills/:id.
    const result = updateBillRequestSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        category: null,
        recurrenceUnit: null,
        interval: 1,
        reminderDaysBefore: 3,
        autopay: false,
        isSubscription: false,
      });
    }
  });
});

describe('payBillRequestSchema', () => {
  it('accepts an empty body: both paidDate and amountPaidCents default on the server', () => {
    expect(payBillRequestSchema.safeParse({}).success).toBe(true);
  });

  it('accepts an explicit paid date and amount together', () => {
    expect(
      payBillRequestSchema.safeParse({ paidDate: '2026-10-01', amountPaidCents: 1500 }).success,
    ).toBe(true);
  });

  it('refuses a negative amount', () => {
    expect(payBillRequestSchema.safeParse({ amountPaidCents: -1 }).success).toBe(false);
  });
});

describe('updateBillPaymentRequestSchema', () => {
  it('refuses a PATCH that changes nothing', () => {
    expect(updateBillPaymentRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts correcting just the paid date on a payment', () => {
    expect(updateBillPaymentRequestSchema.safeParse({ paidDate: '2026-09-15' }).success).toBe(true);
  });

  it('accepts correcting just the amount on a payment', () => {
    expect(updateBillPaymentRequestSchema.safeParse({ amountPaidCents: 999 }).success).toBe(true);
  });
});

describe('moveBillRequestSchema (additional coverage beyond schemas.test.ts)', () => {
  it('strips a stray householdId off a personal move rather than rejecting it', () => {
    // The personal branch of the discriminated union declares no householdId field, so zod's
    // default (non-strict) object mode silently drops it instead of refusing the request.
    const result = moveBillRequestSchema.safeParse({
      visibility: 'personal',
      householdId: ID,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ visibility: 'personal' });
  });
});
