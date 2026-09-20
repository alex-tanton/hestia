/**
 * Structured, household-scoped query keys (Engineering Practices › Frontend patterns). Every
 * household-scoped key starts with `HOUSEHOLD_SCOPE`, so switching household removes all of
 * them in one call and no previous household's data can survive the swap.
 */
export const HOUSEHOLD_SCOPE = ['household'] as const;

export const queryKeys = {
  profile: ['profile'] as const,
  household: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId] as const,
  members: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'members'] as const,
  invites: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'invites'] as const,
  departurePreview: (householdId: string, userId: string) =>
    [...HOUSEHOLD_SCOPE, householdId, 'departure-preview', userId] as const,
  deepHealth: ['health', 'deep'] as const,
};
