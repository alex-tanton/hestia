import type {
  Bill,
  BillDetail,
  BillPayment,
  Subscription,
  SubscriptionsResponse,
} from '@hearth/shared';
import { ALEX_ID, JORDAN_ID, SAM_ID } from './fixtures.ts';

/** Seed Data › "Bills": realistic fixtures so tests read like the real app. */

export function billFixture(overrides: Partial<Bill> = {}): Bill {
  return {
    id: '10000001-0000-4000-8000-000000000001',
    householdId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ownerUserId: ALEX_ID,
    name: 'Rent',
    amountCents: 185_000,
    category: 'Housing',
    recurrenceUnit: 'month',
    interval: 1,
    anchorDate: '2026-08-01',
    reminderDaysBefore: 7,
    autopay: false,
    visibility: 'household',
    isSubscription: false,
    lastUsedConfirmedAt: null,
    archivedAt: null,
    createdAt: '2026-01-25T12:00:00.000Z',
    currentOccurrenceDate: '2026-10-01',
    isOverdue: false,
    ...overrides,
  };
}

export function billPaymentFixture(overrides: Partial<BillPayment> = {}): BillPayment {
  return {
    id: '20000001-0000-4000-8000-000000000001',
    billId: '10000001-0000-4000-8000-000000000001',
    occurrenceDate: '2026-09-01',
    paidDate: '2026-09-01',
    amountPaidCents: 185_000,
    isAuto: false,
    isSkipped: false,
    recordedBy: ALEX_ID,
    createdAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

/** Seed Data: Duke Energy's current occurrence is 5 days overdue, with no logged payment. */
export const dukeEnergyFixture: Bill = billFixture({
  id: '10000002-0000-4000-8000-000000000002',
  name: 'Duke Energy',
  amountCents: 14_230,
  category: 'Utilities',
  anchorDate: '2026-04-01',
  reminderDaysBefore: 3,
  ownerUserId: SAM_ID,
  currentOccurrenceDate: '2026-09-26',
  isOverdue: true,
});

/** Seed Data: household subscription, autopay, due in 3 days. */
export const spectrumInternetFixture: Bill = billFixture({
  id: '10000003-0000-4000-8000-000000000003',
  name: 'Spectrum Internet',
  amountCents: 7_499,
  category: 'Utilities',
  anchorDate: '2026-07-01',
  reminderDaysBefore: 3,
  autopay: true,
  isSubscription: true,
  currentOccurrenceDate: '2026-10-04',
  isOverdue: false,
});

/** Seed Data: Alex's personal subscription, due in 12 days. */
export const spotifyFixture: Bill = billFixture({
  id: '10000004-0000-4000-8000-000000000004',
  householdId: null,
  name: 'Spotify',
  amountCents: 1_199,
  category: 'Entertainment',
  anchorDate: '2026-07-01',
  reminderDaysBefore: 3,
  autopay: true,
  visibility: 'personal',
  isSubscription: true,
  currentOccurrenceDate: '2026-10-13',
  isOverdue: false,
});

/** Seed Data: Water and Sewer has one skipped occurrence in its history. */
export const waterAndSewerFixture: Bill = billFixture({
  id: '10000005-0000-4000-8000-000000000005',
  name: 'Water and Sewer',
  amountCents: 5_840,
  category: 'Utilities',
  anchorDate: '2026-07-01',
  reminderDaysBefore: 5,
  ownerUserId: JORDAN_ID,
  currentOccurrenceDate: '2026-10-10',
  isOverdue: false,
});

export const billDetailFixture: BillDetail = {
  ...dukeEnergyFixture,
  payments: [
    billPaymentFixture({
      id: '20000002-0000-4000-8000-000000000002',
      billId: dukeEnergyFixture.id,
      occurrenceDate: '2026-08-26',
      paidDate: '2026-08-30',
      amountPaidCents: 14_230,
    }),
    billPaymentFixture({
      id: '20000003-0000-4000-8000-000000000003',
      billId: dukeEnergyFixture.id,
      occurrenceDate: '2026-07-26',
      paidDate: '2026-07-26',
      amountPaidCents: 14_230,
    }),
  ],
};

export const spectrumAutopayPaymentFixture: BillPayment = billPaymentFixture({
  id: '20000004-0000-4000-8000-000000000004',
  billId: spectrumInternetFixture.id,
  occurrenceDate: '2026-09-04',
  paidDate: '2026-09-04',
  amountPaidCents: 7_499,
  isAuto: true,
  recordedBy: null,
});

export const waterSkippedPaymentFixture: BillPayment = billPaymentFixture({
  id: '20000005-0000-4000-8000-000000000005',
  billId: waterAndSewerFixture.id,
  occurrenceDate: '2026-08-10',
  paidDate: null,
  amountPaidCents: null,
  isSkipped: true,
});

export function subscriptionFixture(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: spectrumInternetFixture.id,
    name: 'Spectrum Internet',
    visibility: 'household',
    monthlyCents: 7_499,
    annualCents: 89_988,
    needsUsageConfirmation: false,
    ...overrides,
  };
}

/** Seed Data › "Subscriptions view": Alex at Oak Street sees Spectrum Internet and Spotify. */
export const subscriptionsResponseFixture: SubscriptionsResponse = {
  subscriptions: [
    subscriptionFixture(),
    subscriptionFixture({
      id: spotifyFixture.id,
      name: 'Spotify',
      visibility: 'personal',
      monthlyCents: 1_199,
      annualCents: 14_388,
    }),
  ],
  totalMonthlyCents: 8_698,
};
