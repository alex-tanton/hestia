import { z } from 'zod';
import { calendarDateSchema, idSchema, recurrenceUnitSchema, timestampSchema } from './common.js';

/**
 * Chores (Requirements, "Chores and errands" › "Recurring chores"; Technical Architecture, "API
 * surface" › "Chores"). Recurrence is the same anchored model bills use (`packages/recurrence`):
 * never stored as "next due", always derived on read from the anchor, the interval, and the
 * recorded completions. `recurrenceUnitSchema`/`RecurrenceUnit` live in `common.js`, shared with
 * `bills.ts` (both export from `common.js` via `index.ts`, so neither re-exports them again here).
 */

export const choreNameSchema = z.string().trim().min(1, 'Enter a name.').max(200);
export const recurrenceIntervalSchema = z.int().min(1).max(999);

/**
 * The message the service's backstop (`apps/service/src/chores/chores.ts`) also returns, so the
 * client's inline error and the server's 400 read the same.
 */
export const rotationDuplicateMessage = 'Each member can appear only once in the rotation.';

/**
 * A rotation is an ordered list of distinct members (Design, "17. Chores" › "Chore sheet"; PRD,
 * "Data model" › "Chores"). A repeated member would hold more than one slot and skew whose turn it
 * is, since the rotation math counts positions. The database has no such constraint on `uuid[]`,
 * so the service enforces this again on create and edit rather than relying on this schema alone.
 */
export const rotationOrderSchema = z
  .array(idSchema)
  .min(1)
  .refine((order) => new Set(order).size === order.length, {
    message: rotationDuplicateMessage,
  });

/**
 * A chore's assignment is a rotation, a single member, or nobody — never a rotation and an
 * assignee together (PRD, "Data model" › "Chores": "`assigned_to` must be null when
 * `rotation_order` is set."). The Chore sheet always sends the whole new order rather than a diff
 * (Design, "17. Chores" › "Chore sheet"), but editing an existing rotation's order is not a fresh
 * start: `rotationOffset` is rebased to keep the turn with whoever holds it, the same way a
 * member's departure does, provided they are still in the new order — see
 * `apps/service/src/chores/chores.ts` for the rebase and PRD, "Rotation" for the rule.
 */
export const choreAssignmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rotation'), rotationOrder: rotationOrderSchema }),
  z.object({ type: z.literal('single'), assignedTo: idSchema.nullable() }),
  z.object({ type: z.literal('none') }),
]);
export type ChoreAssignment = z.infer<typeof choreAssignmentSchema>;

export const choreCompletionSchema = z.object({
  id: idSchema,
  choreId: idSchema,
  occurrenceDate: calendarDateSchema,
  completedBy: idSchema,
  completedAt: timestampSchema,
});
export type ChoreCompletion = z.infer<typeof choreCompletionSchema>;

/** A chore as the list screen's Overdue/Today/This week/Later buckets show it (Design, "17. Chores"). */
export const choreSchema = z.object({
  id: idSchema,
  householdId: idSchema,
  name: z.string(),
  recurrenceUnit: recurrenceUnitSchema,
  interval: z.int(),
  anchorDate: calendarDateSchema,
  rotationOrder: z.array(idSchema).nullable(),
  rotationOffset: z.int(),
  assignedTo: idSchema.nullable(),
  createdBy: idSchema,
  createdAt: timestampSchema,
  /**
   * The occurrence a completion right now would close: the current occurrence if it is still
   * open, or the next one if the current occurrence is already done or has not arrived yet (PRD,
   * "Recurrence is anchored and derived on read" › "Chores").
   */
  dueDate: calendarDateSchema,
  /** `dueDate` is in the past and still open. */
  isOverdue: z.boolean(),
  lastCompletion: choreCompletionSchema.nullable(),
  /** Null for a chore with no rotation (a single assignee or unassigned). */
  currentTurn: idSchema.nullable(),
  nextTurn: idSchema.nullable(),
});
export type Chore = z.infer<typeof choreSchema>;

export const choreListSchema = z.array(choreSchema);

/** GET /api/chores/:id: the list row plus the next three dates and full completion history. */
export const choreDetailSchema = choreSchema.extend({
  previewDates: z.array(calendarDateSchema),
  completions: z.array(choreCompletionSchema),
});
export type ChoreDetail = z.infer<typeof choreDetailSchema>;

/** POST /api/households/:id/chores */
export const createChoreRequestSchema = z.object({
  name: choreNameSchema,
  recurrenceUnit: recurrenceUnitSchema,
  interval: recurrenceIntervalSchema,
  anchorDate: calendarDateSchema,
  assignment: choreAssignmentSchema.optional(),
});
export type CreateChoreRequest = z.infer<typeof createChoreRequestSchema>;

/** PATCH /api/chores/:id */
export const updateChoreRequestSchema = z
  .object({
    name: choreNameSchema.optional(),
    recurrenceUnit: recurrenceUnitSchema.optional(),
    interval: recurrenceIntervalSchema.optional(),
    anchorDate: calendarDateSchema.optional(),
    assignment: choreAssignmentSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  });
export type UpdateChoreRequest = z.infer<typeof updateChoreRequestSchema>;

/**
 * POST /api/chores/:id/complete. Both fields are optional and, when given, are validated rather
 * than trusted (Handoff non-negotiable 1): `id` lets a replayed request be a no-op, and
 * `occurrenceDate` lets a caller confirm the exact occurrence it means to close — the server still
 * computes its own answer and rejects a supplied date that disagrees with it, rather than using it
 * as-is, since the PRD's rule for which occurrence a completion closes has exactly one right answer
 * at any moment and no caller-chosen alternative (never a skip-ahead, never a backfill of a missed
 * occurrence). Neither field is used by this phase's own (online-only) "complete" button — the
 * service computes both when they are omitted — but the shape is forward-compatible with Phase 5's
 * offline queue, which computes `occurrenceDate` on the client at the time of the (possibly
 * offline) action (Engineering Practices, "Offline queueing"). See
 * `apps/service/src/chores/chores.ts` for the full decision.
 */
export const completeChoreRequestSchema = z.object({
  id: idSchema.optional(),
  occurrenceDate: calendarDateSchema.optional(),
  /**
   * The moment the member acted, ISO 8601 (Requirements, "Offline behavior"). An offline completion
   * carries the time it was made, so `completedAt` is the action's time, not the replay's. The
   * service stores the earlier of this and its own clock, so a client clock running ahead cannot
   * post a completion into the future.
   */
  doneAt: timestampSchema.optional(),
});
export type CompleteChoreRequest = z.infer<typeof completeChoreRequestSchema>;
