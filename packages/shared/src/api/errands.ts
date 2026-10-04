import { z } from 'zod';
import { calendarDateSchema, idSchema, timestampSchema } from './common.js';

/**
 * Errands: one-off tasks with a name, an optional due date, and a status of open or done
 * (Requirements, "Chores and errands" › "Errands"; Technical Architecture, "API surface" ›
 * "Errands").
 */

export const errandStatusSchema = z.enum(['open', 'done']);
export type ErrandStatus = z.infer<typeof errandStatusSchema>;

export const errandNameSchema = z.string().trim().min(1, 'Enter a name.').max(200);

export const errandSchema = z.object({
  id: idSchema,
  householdId: idSchema,
  name: z.string(),
  dueDate: calendarDateSchema.nullable(),
  status: errandStatusSchema,
  addedBy: idSchema,
  assignedTo: idSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  completedBy: idSchema.nullable(),
  createdAt: timestampSchema,
});
export type Errand = z.infer<typeof errandSchema>;

export const errandListSchema = z.array(errandSchema);

/**
 * POST /api/households/:id/errands. `id` is client-generated (PRD, "Data model" › "Chores":
 * `errand` has "id (client-generated UUID)"), so a replayed offline add is a no-op (Handoff
 * non-negotiable 9), the same as a shopping-list item.
 */
export const createErrandRequestSchema = z.object({
  id: idSchema.optional(),
  name: errandNameSchema,
  dueDate: calendarDateSchema.nullable().optional(),
  assignedTo: idSchema.nullable().optional(),
});
export type CreateErrandRequest = z.infer<typeof createErrandRequestSchema>;

/**
 * PATCH /api/errands/:id. Every field is an absolute value (Handoff non-negotiable 9), the same
 * convention `updateListItemRequestSchema` follows. `status` is set absolutely: `done` stamps
 * `completedAt`/`completedBy` from the caller's JWT, and `open` clears them — the schema's own
 * check constraint supports both directions, and the design's flat list ("done collapsed below")
 * implies a done errand can be reopened, the same as a bought list item can move back to needed
 * (Requirements, "Offline behavior" › "Conflict resolution"). The completion fields are never
 * client-supplied: only `status` drives them, so attribution can never be spoofed.
 */
export const updateErrandRequestSchema = z
  .object({
    name: errandNameSchema.optional(),
    dueDate: calendarDateSchema.nullable().optional(),
    assignedTo: idSchema.nullable().optional(),
    status: errandStatusSchema.optional(),
    /**
     * The action time of a `done` made offline (Requirements, "Offline behavior"). Stored as the
     * earlier of this and the service's clock, the same rule a chore completion follows. Only a
     * `done` status may carry it.
     */
    doneAt: timestampSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  })
  .refine((body) => body.doneAt === undefined || body.status === 'done', {
    message: 'doneAt is only sent with status done.',
    path: ['doneAt'],
  });
export type UpdateErrandRequest = z.infer<typeof updateErrandRequestSchema>;
