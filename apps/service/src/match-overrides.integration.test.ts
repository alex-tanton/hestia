import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import type { MatchOverride } from '@hearth/shared';
import { adminPool, as, household, signUp, type HouseholdFixture } from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';

/*
 * Match overrides against `supabase start` (Technical Architecture, "API surface"; Requirements,
 * "Match overrides"): real Postgres as hearth_service, every request through withUserDb, so RLS
 * and the unique constraint are what decide each assertion. Requests here commit, so each test
 * makes its own household.
 */

registerStackHooks();

type Home = HouseholdFixture;

async function createOverride(
  home: Home,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return as(app, home.user, 'POST', `/api/households/${home.household.id}/match-overrides`, body);
}

describe('POST /households/:id/match-overrides', () => {
  it('normalizes both names through @hearth/matching before storing them', async () => {
    const home = await household(app);
    const response = await createOverride(home, {
      ingredientName: 'Cheese!',
      targetKind: 'deal',
      targetName: 'Kraft Shredded Cheese, 8 oz',
      decision: 'force_match',
    });
    expectStatus(response, 201);
    const override = response.json<MatchOverride>();
    expect(override.ingredientNormalizedName).toBe('cheese');
    expect(override.targetNormalizedName).toBe('cheese');
    expect(override.targetKind).toBe('deal');
    expect(override.decision).toBe('force_match');
    expect(override.householdId).toBe(home.household.id);
  });

  it('creating one that already exists updates its decision rather than duplicating it', async () => {
    const home = await household(app);
    const first = await createOverride(home, {
      ingredientName: 'cheese',
      targetKind: 'deal',
      targetName: 'snack cheese',
      decision: 'force_no_match',
    });
    expectStatus(first, 201);
    const firstId = first.json<MatchOverride>().id;

    const second = await createOverride(home, {
      ingredientName: 'cheese',
      targetKind: 'deal',
      targetName: 'snack cheese',
      decision: 'force_match',
    });
    expectStatus(second, 201);
    const overridden = second.json<MatchOverride>();
    expect(overridden.id).toBe(firstId);
    expect(overridden.decision).toBe('force_match');

    const { rows } = await adminPool.query<{ count: string }>(
      `select count(*)::text as count from public.ingredient_match_override where household_id = $1`,
      [home.household.id],
    );
    expect(rows[0]?.count).toBe('1');
  });

  it('rejects an invalid target kind or decision', async () => {
    const home = await household(app);
    expectStatus(
      await createOverride(home, {
        ingredientName: 'cheese',
        targetKind: 'aisle',
        targetName: 'cheese',
        decision: 'force_match',
      }),
      400,
    );
    expectStatus(
      await createOverride(home, {
        ingredientName: 'cheese',
        targetKind: 'deal',
        targetName: 'cheese',
        decision: 'maybe',
      }),
      400,
    );
  });

  it('answers 404 to a member of another household, never 403', async () => {
    const mine = await household(app, 'Alex Rivera');
    const stranger = await signUp(app, 'Blake Stranger');
    expectStatus(
      await as(app, stranger, 'POST', `/api/households/${mine.household.id}/match-overrides`, {
        ingredientName: 'cheese',
        targetKind: 'deal',
        targetName: 'cheese',
        decision: 'force_match',
      }),
      404,
    );
  });
});

describe('DELETE /match-overrides/:id', () => {
  it('removes an override, and a second delete answers 404', async () => {
    const home = await household(app);
    const created = await createOverride(home, {
      ingredientName: 'cheese',
      targetKind: 'pantry',
      targetName: 'cheese',
      decision: 'force_no_match',
    });
    const { id } = created.json<MatchOverride>();

    expectStatus(await as(app, home.user, 'DELETE', `/api/match-overrides/${id}`), 204);
    expectStatus(await as(app, home.user, 'DELETE', `/api/match-overrides/${id}`), 404);

    const { rows } = await adminPool.query(
      `select 1 from public.ingredient_match_override where id = $1`,
      [id],
    );
    expect(rows).toHaveLength(0);
  });

  it('answers 404 for another household’s override, never 403', async () => {
    const mine = await household(app, 'Alex Rivera');
    const stranger = await household(app, 'Blake Stranger');
    const created = await createOverride(mine, {
      ingredientName: 'cheese',
      targetKind: 'deal',
      targetName: 'cheese',
      decision: 'force_match',
    });
    const { id } = created.json<MatchOverride>();

    expectStatus(await as(app, stranger.user, 'DELETE', `/api/match-overrides/${id}`), 404);

    // The row survives the stranger's attempt.
    const { rows } = await adminPool.query(
      `select 1 from public.ingredient_match_override where id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
  });
});
