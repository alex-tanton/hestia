import { describe, expect, it } from 'vitest';
import { ProblemError } from '../problem.js';
import { billOccurrence, billScope, planBillMove } from './bills.js';

/*
 * Pure logic only; everything that touches Postgres (RLS, the payment log, the job) is covered by
 * bills.integration.test.ts and log-autopay.integration.test.ts instead.
 */

describe('billOccurrence', () => {
  const monthly = { recurrence_unit: 'month' as const, interval: 1, anchor_date: '2026-01-01' };

  it('is the anchor itself when nothing has been paid or skipped yet', () => {
    const state = billOccurrence({ ...monthly, today: '2026-01-01' }, new Set());
    expect(state).toEqual({ date: '2026-01-01', overdue: false });
  });

  it('is overdue once its date is before today and still unresolved', () => {
    const state = billOccurrence({ ...monthly, today: '2026-01-05' }, new Set());
    expect(state).toEqual({ date: '2026-01-01', overdue: true });
  });

  it('advances past a paid occurrence to the next one, anchored rather than shifted', () => {
    const state = billOccurrence({ ...monthly, today: '2026-02-01' }, new Set(['2026-01-01']));
    expect(state).toEqual({ date: '2026-02-01', overdue: false });
  });

  it('advances past a skipped occurrence the same as a paid one', () => {
    const state = billOccurrence({ ...monthly, today: '2026-02-10' }, new Set(['2026-01-01']));
    expect(state).toEqual({ date: '2026-02-01', overdue: true });
  });

  it('stays current and overdue until explicitly resolved, never rolling forward on its own', () => {
    // Two months have passed with nothing paid; the occurrence due is still the first one.
    const state = billOccurrence({ ...monthly, today: '2026-03-15' }, new Set());
    expect(state).toEqual({ date: '2026-01-01', overdue: true });
  });

  describe('a one-time bill (null recurrence_unit)', () => {
    const oneTime = { recurrence_unit: null, interval: 1, anchor_date: '2026-06-01' };

    it('is overdue once its single occurrence passes unresolved', () => {
      expect(billOccurrence({ ...oneTime, today: '2026-06-02' }, new Set())).toEqual({
        date: '2026-06-01',
        overdue: true,
      });
    });

    it('is not overdue once it has been resolved', () => {
      expect(billOccurrence({ ...oneTime, today: '2026-06-02' }, new Set(['2026-06-01']))).toEqual({
        date: '2026-06-01',
        overdue: false,
      });
    });

    it('is not overdue before its date arrives', () => {
      expect(billOccurrence({ ...oneTime, today: '2026-05-01' }, new Set())).toEqual({
        date: '2026-06-01',
        overdue: false,
      });
    });
  });
});

describe('billScope — the household_id/visibility pairing (bill_personal_iff_no_household)', () => {
  it('a household bill always pairs the given household id with "household"', () => {
    const scope = billScope('household', 'household-1');
    expect(scope).toEqual({ householdId: 'household-1', visibility: 'household' });
    expect(scope.visibility === 'personal').toBe(scope.householdId === null);
  });

  it('a personal bill always pairs a null household id with "personal"', () => {
    const scope = billScope('personal', null);
    expect(scope).toEqual({ householdId: null, visibility: 'personal' });
    expect(scope.visibility === 'personal').toBe(scope.householdId === null);
  });

  it('refuses to build a household bill with no household id', () => {
    expect(() => billScope('household', null)).toThrow();
  });
});

describe('planBillMove — who may move a bill, and where to', () => {
  const OWNER = 'owner-1';
  const HOUSEHOLD = 'household-1';
  const OTHER_HOUSEHOLD = 'household-2';
  const household = { ownerUserId: OWNER, householdId: HOUSEHOLD, archived: false };
  const personal = { ownerUserId: OWNER, householdId: null, archived: false };

  /** The status and detail of the refusal a move raises. Fails the test if it does not refuse. */
  function refusal(run: () => unknown): { status: number; detail: string | undefined } {
    try {
      run();
    } catch (error) {
      if (error instanceof ProblemError) {
        return { status: error.statusCode, detail: error.problem.detail };
      }
      throw error;
    }
    throw new Error('expected the move to be refused');
  }

  it('moves a household bill to its owner alone', () => {
    expect(planBillMove(household, OWNER, { visibility: 'personal' })).toEqual({
      householdId: null,
      visibility: 'personal',
    });
  });

  it('moves a personal bill into a household the owner belongs to', () => {
    expect(
      planBillMove(personal, OWNER, { visibility: 'household', householdId: OTHER_HOUSEHOLD }),
    ).toEqual({ householdId: OTHER_HOUSEHOLD, visibility: 'household' });
  });

  it('refuses a move by anyone but the owner, with 403, whatever the bill', () => {
    const notOwner = 'member-1';
    expect(
      refusal(() => planBillMove(household, notOwner, { visibility: 'personal' })).status,
    ).toBe(403);
    expect(
      refusal(() =>
        planBillMove(personal, notOwner, { visibility: 'household', householdId: HOUSEHOLD }),
      ).status,
    ).toBe(403);
  });

  it('refuses to move an archived bill, with 409', () => {
    const archived = { ...household, archived: true };
    expect(refusal(() => planBillMove(archived, OWNER, { visibility: 'personal' }))).toEqual({
      status: 409,
      detail: 'An archived bill cannot be moved.',
    });
  });

  it('refuses a move to the scope the bill already has, with 409', () => {
    expect(refusal(() => planBillMove(personal, OWNER, { visibility: 'personal' })).status).toBe(
      409,
    );
    expect(
      refusal(() =>
        planBillMove(household, OWNER, { visibility: 'household', householdId: HOUSEHOLD }),
      ).detail,
    ).toBe('This bill is already in that household.');
  });

  it('never moves a household bill to another household, directly or by name', () => {
    expect(
      refusal(() =>
        planBillMove(household, OWNER, { visibility: 'household', householdId: OTHER_HOUSEHOLD }),
      ),
    ).toEqual({ status: 409, detail: 'A household bill cannot move to another household.' });
  });
});
