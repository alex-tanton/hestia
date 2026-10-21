import { z } from 'zod';

// Any 8-4-4-4-12 hex id. Stricter RFC version checks would reject fixed seed ids.
export const idSchema = z.guid();

export const timestampSchema = z.iso.datetime({ offset: true });

/** A calendar date with no time component, read in the timezone that owns it. */
export const calendarDateSchema = z.iso.date();

/**
 * Money on the wire is integer cents, never floating-point dollars. The ceiling is what
 * `numeric(10, 2)` holds at two decimal places.
 */
export const centsSchema = z.int().min(0).max(99_999_999);

/** A five-digit US ZIP code. */
export const postalCodeSchema = z.string().regex(/^[0-9]{5}$/, 'Enter a five-digit ZIP code.');

/** An IANA timezone name; the database rejects names Postgres does not recognize. */
export const timezoneSchema = z.string().trim().min(1).max(64);

export const householdNameSchema = z.string().trim().min(1, 'Enter a name.').max(100);

export const displayNameSchema = z.string().trim().min(1, 'Enter a name.').max(100);

export const emailSchema = z.email('Enter a valid email address.').max(254);

/** A time of day as HH:MM, 24-hour. */
export const timeOfDaySchema = z
  .string()
  .regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/, 'Use a 24-hour HH:MM time.');

export const householdRoleSchema = z.enum(['admin', 'member']);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;

/**
 * The recurrence unit `bill` and `chore` share (recurrence uses the same three fields on `bill` and
 * `chore`: `recurrence_unit`, `interval`, and `anchor_date`). Lives here, not in either `bills.ts`
 * or `chores.ts`, so the two sibling units that each need it don't export the same name twice.
 */
export const recurrenceUnitSchema = z.enum(['day', 'week', 'month', 'year']);
export type RecurrenceUnit = z.infer<typeof recurrenceUnitSchema>;

export const householdIdParamsSchema = z.object({ id: idSchema });
export const memberParamsSchema = z.object({ id: idSchema, userId: idSchema });
export const inviteParamsSchema = z.object({ id: idSchema, inviteId: idSchema });
export const listIdParamsSchema = z.object({ id: idSchema });
export const listItemParamsSchema = z.object({ id: idSchema, itemId: idSchema });
export const pantryItemParamsSchema = z.object({ id: idSchema });
export const mealPlanEntryIdParamsSchema = z.object({ id: idSchema });
export const choreIdParamsSchema = z.object({ id: idSchema });
export const choreCompletionParamsSchema = z.object({ id: idSchema, completionId: idSchema });
export const errandIdParamsSchema = z.object({ id: idSchema });
