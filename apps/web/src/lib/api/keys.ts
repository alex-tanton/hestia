/**
 * Structured, household-scoped query keys. Every
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
  /** The lists index. Archived lists are a separate read-only view, so a separate key. */
  lists: (householdId: string, archived: boolean) =>
    [...HOUSEHOLD_SCOPE, householdId, 'lists', archived ? 'archived' : 'active'] as const,
  /** One list's detail. A list's own path does not name its household; its cache entry must. */
  list: (householdId: string, listId: string) =>
    [...HOUSEHOLD_SCOPE, householdId, 'list', listId] as const,
  pantry: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'pantry'] as const,
  /** The recipe library, one page at a time. */
  recipes: (householdId: string, page: number) =>
    [...HOUSEHOLD_SCOPE, householdId, 'recipes', page] as const,
  recipe: (householdId: string, recipeId: string) =>
    [...HOUSEHOLD_SCOPE, householdId, 'recipe', recipeId] as const,
  suggestions: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'suggestions'] as const,
  /** A meal-plan week, keyed by its Sunday. */
  mealPlan: (householdId: string, week: string) =>
    [...HOUSEHOLD_SCOPE, householdId, 'meal-plan', week] as const,
  chores: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'chores'] as const,
  chore: (householdId: string, choreId: string) =>
    [...HOUSEHOLD_SCOPE, householdId, 'chore', choreId] as const,
  errands: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'errands'] as const,
  /** The household's bills plus the caller's own personal ones. */
  bills: (householdId: string) => [...HOUSEHOLD_SCOPE, householdId, 'bills'] as const,
  /** `/bills/:id` names no household, so the cache entry carries it instead (like `recipe`). */
  bill: (householdId: string, billId: string) =>
    [...HOUSEHOLD_SCOPE, householdId, 'bill', billId] as const,
  subscriptions: (householdId: string) =>
    [...HOUSEHOLD_SCOPE, householdId, 'subscriptions'] as const,
  deepHealth: ['health', 'deep'] as const,
  /**
   * The caller's notification preferences. They belong to the user, not a household (a weekly meal
   * nudge names its household inside the entry), so the key is not household-scoped.
   */
  notificationPreferences: ['notification-preferences'] as const,
};
