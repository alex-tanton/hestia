import { describe, expect, it } from 'vitest';
import { normalize } from '@hearth/matching';

/*
 * The service does not normalize names itself: `@hearth/matching` owns the pipeline and its
 * maintained descriptor and brand lists, and the list and pantry services call it on save. The
 * pipeline's own cases live in that package's tests.
 *
 * What is asserted here is the integration point, which the package cannot see: every
 * `normalized_name` the service stores for a seed data fixture is the value `supabase/seed/
 * seed.sql` writes for the same name. A change to the lists that silently moved one of these would
 * leave a seeded pantry row and an item the service adds under two different keys, and the pantry's
 * merge and repricing's re-match both turn on that key matching.
 */

describe('the normalized names the service stores', () => {
  it.each([
    // The seed data's pantry: the twenty Oak Street staples, as seed.sql records them.
    ['Olive oil', 'olive oil'],
    ['Salt', 'salt'],
    ['Black pepper', 'black pepper'],
    ['Garlic', 'garlic'],
    ['Rice', 'rice'],
    ['Flour', 'flour'],
    ['Sugar', 'sugar'],
    ['Butter', 'butter'],
    ['Milk', 'milk'],
    ['Bread', 'bread'],
    ['Soy sauce', 'soy sauce'],
    ['Cumin', 'cumin'],
    ['Paprika', 'paprika'],
    ['Canned tomatoes', 'canned tomato'],
    ['Black beans', 'black bean'],
    ['Chicken broth', 'chicken broth'],
    ['Parmesan', 'parmesan'],
    ['Eggs', 'egg'],
    ['Yellow onions', 'yellow onion'],
    ['Pasta', 'pasta'],
  ])('normalizes the pantry staple %s to %s', (name, expected) => {
    expect(normalize(name)).toBe(expected);
  });

  it.each([
    // The seed data's shopping lists: the manually typed and recipe-sourced rows, whose key the
    // service computes rather than copying from a deal.
    ['Apples', 'apple'],
    ['Trash bags', 'trash'],
    ['Paper towels', 'paper towel'],
    ['Red onion', 'red onion'],
    ['Salsa', 'salsa'],
    ['Celery', 'celery'],
    ['Lemon', 'lemon'],
    ['Dish soap', 'dish soap'],
    ['Hot dogs', 'hot dog'],
    ['Buns', 'bun'],
    ['Charcoal', 'charcoal'],
    ['Ketchup', 'ketchup'],
    ['Paper plates', 'paper plate'],
    ['Napkins', 'napkin'],
    ['Plastic cups', 'plastic cup'],
    ['Birthday candles', 'birthday candle'],
    ['Balloons', 'balloon'],
    ['Ice', 'ice'],
    ['Tortilla chips', 'tortilla chip'],
    ['Lemonade', 'lemonade'],
  ])('normalizes the list item %s to %s', (name, expected) => {
    expect(normalize(name)).toBe(expected);
  });

  it('keeps a name the pipeline would empty, rather than storing a key that matches everything', () => {
    // The Requirements document's own example, which a stored `normalized_name` must never lose.
    expect(normalize('Coca-Cola 2L')).toBe('coca cola 2l');
  });

  it('is stable when it runs again over its own output', () => {
    // The pantry merges on this key and repricing re-matches on it, so normalizing a name the
    // service already normalized has to land in the same place.
    for (const name of ['Trash bags', 'Canned tomatoes', 'Yellow onions', 'Plastic cups']) {
      expect(normalize(normalize(name))).toBe(normalize(name));
    }
  });
});
