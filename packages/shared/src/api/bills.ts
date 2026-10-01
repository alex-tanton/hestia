import { z } from 'zod';
import {
  calendarDateSchema,
  centsSchema,
  idSchema,
  recurrenceUnitSchema,
  timestampSchema,
} from './common.js';

/**
 * Bills and subscriptions (Requirements, "Bills and subscriptions"; Technical Architecture, "API
 * surface" — "Bills"). Recurrence is anchored (`packages/recurrence`); a bill's current occurrence
 * and overdue flag are derived on every read, never stored (Requirements, "Recurrence is anchored
 * and derived on read"). `recurrenceUnitSchema`/`RecurrenceUnit` live in `common.js`, shared with
 * `chores.ts` (both export from `common.js` via `index.ts`, so neither re-exports them again here).
 */

export const billVisibilitySchema = z.enum(['household', 'personal']);
export type BillVisibility = z.infer<typeof billVisibilitySchema>;

export const billIdParamsSchema = z.object({ id: idSchema });
export const billPaymentParamsSchema = z.object({ id: idSchema, paymentId: idSchema });

/**
 * A bill as the Bills tab and dashboard show it: its own fields plus the current occurrence and
 * overdue flag derived at read time (never stored). `householdId` is null exactly for a personal
 * bill (the database's own `bill_personal_iff_no_household` constraint).
 */
export const billSchema = z.object({
  id: idSchema,
  householdId: idSchema.nullable(),
  ownerUserId: idSchema,
  name: z.string(),
  amountCents: centsSchema,
  category: z.string().nullable(),
  recurrenceUnit: recurrenceUnitSchema.nullable(),
  interval: z.int().positive(),
  anchorDate: calendarDateSchema,
  reminderDaysBefore: z.int().min(0),
  autopay: z.boolean(),
  visibility: billVisibilitySchema,
  isSubscription: z.boolean(),
  lastUsedConfirmedAt: timestampSchema.nullable(),
  archivedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  /** The earliest occurrence with no payment or skip row (Requirements, "Bills"). */
  currentOccurrenceDate: calendarDateSchema,
  /** True once the current occurrence's date is before "today" in the bill's own timezone. */
  isOverdue: z.boolean(),
});
export type Bill = z.infer<typeof billSchema>;

export const billListSchema = z.array(billSchema);

export const billPaymentSchema = z.object({
  id: idSchema,
  billId: idSchema,
  occurrenceDate: calendarDateSchema,
  paidDate: calendarDateSchema.nullable(),
  amountPaidCents: centsSchema.nullable(),
  isAuto: z.boolean(),
  isSkipped: z.boolean(),
  recordedBy: idSchema.nullable(),
  createdAt: timestampSchema,
});
export type BillPayment = z.infer<typeof billPaymentSchema>;

/** GET /bills/:id — the bill plus its full payment history, newest occurrence first. */
export const billDetailSchema = billSchema.extend({
  payments: z.array(billPaymentSchema),
});
export type BillDetail = z.infer<typeof billDetailSchema>;

const billFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(200),
  amountCents: centsSchema,
  category: z.string().trim().max(100).nullable().default(null),
  // Null means a one-time bill with a single occurrence on anchorDate (PRD, "Data model › Bills").
  recurrenceUnit: recurrenceUnitSchema.nullable().default(null),
  interval: z.int().positive().default(1),
  anchorDate: calendarDateSchema,
  reminderDaysBefore: z.int().min(0).default(3),
  autopay: z.boolean().default(false),
  isSubscription: z.boolean().default(false),
});

/** POST /households/:id/bills and POST /users/me/bills. Visibility and ownership are never taken
 * from the body: the route decides them from which endpoint was called and who the caller is. */
export const createBillRequestSchema = billFieldsSchema;
export type CreateBillRequest = z.infer<typeof createBillRequestSchema>;

/**
 * PATCH /bills/:id. Visibility, household, and ownership are deliberately not editable here: the
 * PRD describes no "move a bill" action, and the database's `keep_bill_scope` trigger (Technical
 * Architecture, "Database › RLS policy pattern") exists to guard the invariant, not to back a
 * feature this phase exposes.
 */
export const updateBillRequestSchema = billFieldsSchema
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  });
export type UpdateBillRequest = z.infer<typeof updateBillRequestSchema>;

/** POST /bills/:id/pay. Both fields default (paid today, for the bill's full amount). */
export const payBillRequestSchema = z.object({
  paidDate: calendarDateSchema.optional(),
  amountPaidCents: centsSchema.optional(),
});
export type PayBillRequest = z.infer<typeof payBillRequestSchema>;

/** PATCH /bills/:id/payments/:paymentId — editing an automatic payment, or correcting a manual one. */
export const updateBillPaymentRequestSchema = z
  .object({
    paidDate: calendarDateSchema.optional(),
    amountPaidCents: centsSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  });
export type UpdateBillPaymentRequest = z.infer<typeof updateBillPaymentRequestSchema>;

/** One row of the subscriptions view (Requirements, "Subscriptions view"). */
export const subscriptionSchema = z.object({
  id: idSchema,
  name: z.string(),
  visibility: billVisibilitySchema,
  monthlyCents: centsSchema,
  annualCents: centsSchema,
  /** 60+ calendar days since last_used_confirmed_at (or created_at, if never confirmed). */
  needsUsageConfirmation: z.boolean(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

/** GET /households/:id/subscriptions, sorted by monthlyCents descending. */
export const subscriptionsResponseSchema = z.object({
  subscriptions: z.array(subscriptionSchema),
  totalMonthlyCents: centsSchema,
});
export type SubscriptionsResponse = z.infer<typeof subscriptionsResponseSchema>;
