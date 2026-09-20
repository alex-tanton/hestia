import type {
  DeepHealthResponse,
  DeparturePreview,
  Household,
  Invite,
  Member,
  ProfileResponse,
} from '@hearth/shared';

/** The Seed Data households and people, so tests read like the real app (Seed Data). */
export const ALEX_ID = '11111111-1111-4111-8111-111111111111';
export const SAM_ID = '22222222-2222-4222-8222-222222222222';
export const JORDAN_ID = '33333333-3333-4333-8333-333333333333';
export const OAK_STREET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const RIVERA_FAMILY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const profileFixture: ProfileResponse = {
  id: ALEX_ID,
  email: 'alex@example.com',
  displayName: 'Alex Rivera',
  timezone: 'America/New_York',
  activeHouseholdId: OAK_STREET_ID,
  quietHours: null,
  householdBillReminders: true,
  isServerOwner: false,
  memberships: [
    {
      householdId: OAK_STREET_ID,
      name: 'Oak Street',
      role: 'admin',
      joinedAt: '2026-01-04T12:00:00.000Z',
      memberCount: 3,
    },
    {
      householdId: RIVERA_FAMILY_ID,
      name: 'Rivera Family',
      role: 'admin',
      joinedAt: '2026-02-10T12:00:00.000Z',
      memberCount: 2,
    },
  ],
};

export const oakStreetFixture: Household = {
  id: OAK_STREET_ID,
  name: 'Oak Street',
  postalCode: '27514',
  timezone: 'America/New_York',
  role: 'admin',
  joinedAt: '2026-01-04T12:00:00.000Z',
  createdAt: '2026-01-04T12:00:00.000Z',
};

export const riveraFamilyFixture: Household = {
  id: RIVERA_FAMILY_ID,
  name: 'Rivera Family',
  postalCode: '27601',
  timezone: 'America/New_York',
  role: 'admin',
  joinedAt: '2026-02-10T12:00:00.000Z',
  createdAt: '2026-02-10T12:00:00.000Z',
};

export const oakStreetMembers: Member[] = [
  { userId: ALEX_ID, displayName: 'Alex Rivera', role: 'admin', joinedAt: '2026-01-04T12:00:00Z' },
  { userId: SAM_ID, displayName: 'Sam Chen', role: 'member', joinedAt: '2026-01-06T12:00:00Z' },
  {
    userId: JORDAN_ID,
    displayName: 'Jordan Blake',
    role: 'member',
    joinedAt: '2026-01-09T12:00:00Z',
  },
];

export const riveraFamilyMembers: Member[] = [
  { userId: ALEX_ID, displayName: 'Alex Rivera', role: 'admin', joinedAt: '2026-02-10T12:00:00Z' },
];

export const inviteFixture: Invite = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  createdBy: ALEX_ID,
  createdAt: '2026-09-15T12:00:00.000Z',
  expiresAt: '2026-09-22T12:00:00.000Z',
};

const noCounts: DeparturePreview['deletionCounts'] = {
  lists: 0,
  pantryItems: 0,
  recipes: 0,
  mealPlanEntries: 0,
  chores: 0,
  errands: 0,
  bills: 0,
};

export const departurePreviewFixture: DeparturePreview = {
  householdId: OAK_STREET_ID,
  householdName: 'Oak Street',
  userId: SAM_ID,
  isLastMember: false,
  deletionCounts: noCounts,
  lists: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'This Week' }],
  chores: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'Take out trash' }],
  errands: [],
  bills: [],
  rotations: [
    {
      choreId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      choreName: 'Take out trash',
      nextTurnUserId: JORDAN_ID,
    },
  ],
};

export const lastMemberPreviewFixture: DeparturePreview = {
  householdId: RIVERA_FAMILY_ID,
  householdName: 'Rivera Family',
  userId: ALEX_ID,
  isLastMember: true,
  deletionCounts: { ...noCounts, lists: 4, recipes: 23, chores: 6 },
  lists: [],
  chores: [],
  errands: [],
  bills: [],
  rotations: [],
};

export const deepHealthFixture: DeepHealthResponse = {
  newestDealFetchedAt: '2026-09-19T09:00:00.000Z',
  newestNotificationSentAt: null,
  newestBackupAt: '2026-09-19T03:00:00.000Z',
  recentErrors: [
    {
      fingerprint: 'abc123',
      message: 'TypeError at /api/households/:param',
      count: 4,
      firstSeen: '2026-09-18T22:00:00.000Z',
      lastSeen: '2026-09-19T08:00:00.000Z',
    },
  ],
  merchantSkipRates: [],
};
