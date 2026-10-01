/**
 * PRD, "Recurrence is anchored and derived on read": a recurrence is `recurrence_unit`,
 * `interval`, and `anchor_date`. Occurrence k's date is `anchor_date` plus k × `interval` units,
 * for k = 0, 1, 2, …; no occurrence exists before the anchor.
 *
 * `recurrence_unit` is nullable in the `bill` table for a one-time bill (PRD, "Data model ›
 * Bills"). That case has exactly one occurrence, on `anchor_date`, and needs no derivation: a
 * caller holding a null unit should treat `anchorDate` itself as the sole occurrence rather than
 * calling into this package. Building a parallel "one occurrence" code path here would be the kind
 * of abstraction the project's build rules ask us not to add for a single trivial branch.
 */
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

/**
 * A plain calendar date, `YYYY-MM-DD`, with no time or timezone component. Every date this package
 * accepts or returns is one of these strings — never a `Date`. Non-negotiable 8 ("dates are
 * evaluated in the timezone that owns them") and the PRD's "Timezone" section make resolving a
 * calendar date from a timezone the caller's job; this package only ever does calendar-date
 * arithmetic, which is why it never needs a timezone of its own.
 */
export type CalendarDate = string;

/** A recurring bill's or chore's anchored recurrence (never the one-time-bill case; see above). */
export interface Recurrence {
  readonly unit: RecurrenceUnit;
  /** Occurrences repeat every `interval` `unit`s. Must be a positive integer. */
  readonly interval: number;
  readonly anchorDate: CalendarDate;
}
