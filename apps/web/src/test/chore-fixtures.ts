import type { Chore, ChoreCompletion, ChoreDetail, Errand } from '@hearth/shared';
import { addDays } from '../lib/household-date.ts';
import { ALEX_ID, JORDAN_ID, OAK_STREET_ID, SAM_ID } from './fixtures.ts';

/*
 * Seed Data › "Chores" and "Errands", mirrored as test oracles (same convention as
 * `meal-fixtures.ts`). `TODAY` is a Sunday — the same one `meal-fixtures.ts` uses as
 * `CURRENT_WEEK_SUNDAY` — so "this week" runs `TODAY` through `addDays(TODAY, 6)` with no
 * day-of-week guesswork in the tests that group by it.
 */

export const TODAY = '2026-09-27';

/** Casey: a former member of Oak Street (Seed Data › "Households": "left 5 weeks ago"). */
export const CASEY_ID = '44444444-4444-4444-8444-444444444444';

const CREATED_AT = '2026-01-04T12:00:00.000Z';

function completion(
  id: string,
  choreId: string,
  occurrenceDate: string,
  completedBy: string,
  completedAt: string,
): ChoreCompletion {
  return { id, choreId, occurrenceDate, completedBy, completedAt };
}

export const TAKE_OUT_TRASH_ID = 'c1111111-0000-4000-8000-000000000001';
export const CLEAN_BATHROOM_ID = 'c1111111-0000-4000-8000-000000000002';
export const VACUUM_COMMON_AREAS_ID = 'c1111111-0000-4000-8000-000000000003';
export const REPLACE_HVAC_FILTER_ID = 'c1111111-0000-4000-8000-000000000004';
export const DEEP_CLEAN_FRIDGE_ID = 'c1111111-0000-4000-8000-000000000005';
export const WATER_PLANTS_ID = 'c1111111-0000-4000-8000-000000000006';

const takeOutTrashEarlierCompletion = completion(
  'd1111111-0000-4000-8000-000000000000',
  TAKE_OUT_TRASH_ID,
  addDays(TODAY, -14),
  ALEX_ID,
  `${addDays(TODAY, -14)}T09:00:00.000Z`,
);

const takeOutTrashLastCompletion = completion(
  'd1111111-0000-4000-8000-000000000001',
  TAKE_OUT_TRASH_ID,
  addDays(TODAY, -7),
  SAM_ID,
  `${addDays(TODAY, -7)}T09:00:00.000Z`,
);

/** Rotation Alex → Sam → Jordan, offset 2, 8 completions: (2 + 8) mod 3 = 1 → Sam. Due today. */
export const takeOutTrashFixture: Chore = {
  id: TAKE_OUT_TRASH_ID,
  householdId: OAK_STREET_ID,
  name: 'Take out trash',
  recurrenceUnit: 'week',
  interval: 1,
  anchorDate: addDays(TODAY, -56),
  rotationOrder: [ALEX_ID, SAM_ID, JORDAN_ID],
  rotationOffset: 2,
  assignedTo: null,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  dueDate: TODAY,
  isOverdue: false,
  lastCompletion: takeOutTrashLastCompletion,
  currentTurn: SAM_ID,
  nextTurn: JORDAN_ID,
};

export const takeOutTrashDetailFixture: ChoreDetail = {
  ...takeOutTrashFixture,
  previewDates: [TODAY, addDays(TODAY, 7), addDays(TODAY, 14)],
  completions: [takeOutTrashEarlierCompletion, takeOutTrashLastCompletion],
};

/** Rotation Alex → Sam → Jordan, offset 1, 1 completion: (1 + 1) mod 3 = 2 → Jordan. Due in 2 days. */
export const cleanBathroomFixture: Chore = {
  id: CLEAN_BATHROOM_ID,
  householdId: OAK_STREET_ID,
  name: 'Clean bathroom',
  recurrenceUnit: 'week',
  interval: 1,
  anchorDate: addDays(TODAY, -5),
  rotationOrder: [ALEX_ID, SAM_ID, JORDAN_ID],
  rotationOffset: 1,
  assignedTo: null,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  dueDate: addDays(TODAY, 2),
  isOverdue: false,
  lastCompletion: completion(
    'd1111111-0000-4000-8000-000000000002',
    CLEAN_BATHROOM_ID,
    addDays(TODAY, -5),
    ALEX_ID,
    `${addDays(TODAY, -5)}T09:00:00.000Z`,
  ),
  currentTurn: JORDAN_ID,
  nextTurn: ALEX_ID,
};

const vacuumCommonAreasCompletion = completion(
  'd1111111-0000-4000-8000-000000000003',
  VACUUM_COMMON_AREAS_ID,
  addDays(TODAY, -38),
  CASEY_ID,
  `${addDays(TODAY, -38)}T09:00:00.000Z`,
);

/** Unassigned; one completion 38 days ago by Casey, now a former member. Overdue 3 days. */
export const vacuumCommonAreasFixture: Chore = {
  id: VACUUM_COMMON_AREAS_ID,
  householdId: OAK_STREET_ID,
  name: 'Vacuum common areas',
  recurrenceUnit: 'week',
  interval: 1,
  anchorDate: addDays(TODAY, -38),
  rotationOrder: null,
  rotationOffset: 0,
  assignedTo: null,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  dueDate: addDays(TODAY, -3),
  isOverdue: true,
  lastCompletion: vacuumCommonAreasCompletion,
  currentTurn: null,
  nextTurn: null,
};

export const vacuumCommonAreasDetailFixture: ChoreDetail = {
  ...vacuumCommonAreasFixture,
  previewDates: [addDays(TODAY, -3), addDays(TODAY, 4), addDays(TODAY, 11)],
  completions: [vacuumCommonAreasCompletion],
};

/** Monthly, assigned to Alex, never completed. Due in 11 days (the "Later" bucket). */
export const replaceHvacFilterFixture: Chore = {
  id: REPLACE_HVAC_FILTER_ID,
  householdId: OAK_STREET_ID,
  name: 'Replace HVAC filter',
  recurrenceUnit: 'month',
  interval: 1,
  anchorDate: addDays(TODAY, 11),
  rotationOrder: null,
  rotationOffset: 0,
  assignedTo: ALEX_ID,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  dueDate: addDays(TODAY, 11),
  isOverdue: false,
  lastCompletion: null,
  currentTurn: null,
  nextTurn: null,
};

/** Rotation Alex → Sam, offset 0, no completions yet: (0 + 0) mod 2 = 0 → Alex. Due in 6 days. */
export const deepCleanFridgeFixture: Chore = {
  id: DEEP_CLEAN_FRIDGE_ID,
  householdId: OAK_STREET_ID,
  name: 'Deep clean fridge',
  recurrenceUnit: 'month',
  interval: 1,
  anchorDate: addDays(TODAY, 6),
  rotationOrder: [ALEX_ID, SAM_ID],
  rotationOffset: 0,
  assignedTo: null,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  dueDate: addDays(TODAY, 6),
  isOverdue: false,
  lastCompletion: null,
  currentTurn: ALEX_ID,
  nextTurn: SAM_ID,
};

/** Every 3 days, unassigned, due tomorrow. */
export const waterPlantsFixture: Chore = {
  id: WATER_PLANTS_ID,
  householdId: OAK_STREET_ID,
  name: 'Water plants',
  recurrenceUnit: 'day',
  interval: 3,
  anchorDate: addDays(TODAY, -8),
  rotationOrder: null,
  rotationOffset: 0,
  assignedTo: null,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  dueDate: addDays(TODAY, 1),
  isOverdue: false,
  lastCompletion: completion(
    'd1111111-0000-4000-8000-000000000006',
    WATER_PLANTS_ID,
    addDays(TODAY, -2),
    ALEX_ID,
    `${addDays(TODAY, -2)}T09:00:00.000Z`,
  ),
  currentTurn: null,
  nextTurn: null,
};

export const choreListFixture: Chore[] = [
  takeOutTrashFixture,
  cleanBathroomFixture,
  vacuumCommonAreasFixture,
  replaceHvacFilterFixture,
  deepCleanFridgeFixture,
  waterPlantsFixture,
];

/** Seed Data › "Errands": six for Oak Street. */
export const RETURN_PACKAGE_ID = 'e1111111-0000-4000-8000-000000000001';
export const DRY_CLEANING_ID = 'e1111111-0000-4000-8000-000000000002';
export const CAR_REGISTRATION_ID = 'e1111111-0000-4000-8000-000000000003';
export const BIRTHDAY_CARD_ID = 'e1111111-0000-4000-8000-000000000004';
export const MAIL_RENT_CHECK_ID = 'e1111111-0000-4000-8000-000000000005';
export const PORCH_LIGHT_ID = 'e1111111-0000-4000-8000-000000000006';

export const returnPackageFixture: Errand = {
  id: RETURN_PACKAGE_ID,
  householdId: OAK_STREET_ID,
  name: 'Return Amazon package',
  dueDate: addDays(TODAY, 2),
  status: 'open',
  addedBy: ALEX_ID,
  assignedTo: ALEX_ID,
  completedAt: null,
  completedBy: null,
  createdAt: CREATED_AT,
};

export const dryCleaningFixture: Errand = {
  id: DRY_CLEANING_ID,
  householdId: OAK_STREET_ID,
  name: 'Pick up dry cleaning',
  dueDate: addDays(TODAY, -2),
  status: 'open',
  addedBy: ALEX_ID,
  assignedTo: null,
  completedAt: null,
  completedBy: null,
  createdAt: CREATED_AT,
};

export const carRegistrationFixture: Errand = {
  id: CAR_REGISTRATION_ID,
  householdId: OAK_STREET_ID,
  name: 'Renew car registration',
  dueDate: addDays(TODAY, 21),
  status: 'open',
  addedBy: SAM_ID,
  assignedTo: SAM_ID,
  completedAt: null,
  completedBy: null,
  createdAt: CREATED_AT,
};

export const birthdayCardFixture: Errand = {
  id: BIRTHDAY_CARD_ID,
  householdId: OAK_STREET_ID,
  name: 'Buy birthday card',
  dueDate: null,
  status: 'open',
  addedBy: ALEX_ID,
  assignedTo: null,
  completedAt: null,
  completedBy: null,
  createdAt: CREATED_AT,
};

export const mailRentCheckFixture: Errand = {
  id: MAIL_RENT_CHECK_ID,
  householdId: OAK_STREET_ID,
  name: 'Mail rent check',
  dueDate: addDays(TODAY, -3),
  status: 'done',
  addedBy: ALEX_ID,
  assignedTo: ALEX_ID,
  completedAt: `${addDays(TODAY, -4)}T12:00:00.000Z`,
  completedBy: ALEX_ID,
  createdAt: CREATED_AT,
};

/** Assigned to Jordan, but completed by Sam — a completion by someone other than the assignee. */
export const porchLightFixture: Errand = {
  id: PORCH_LIGHT_ID,
  householdId: OAK_STREET_ID,
  name: 'Replace porch light bulb',
  dueDate: null,
  status: 'done',
  addedBy: ALEX_ID,
  assignedTo: JORDAN_ID,
  completedAt: `${addDays(TODAY, -6)}T12:00:00.000Z`,
  completedBy: SAM_ID,
  createdAt: CREATED_AT,
};

export const errandListFixture: Errand[] = [
  returnPackageFixture,
  dryCleaningFixture,
  carRegistrationFixture,
  birthdayCardFixture,
  mailRentCheckFixture,
  porchLightFixture,
];
