import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRANDS } from './data/brands.js';
import { DESCRIPTORS } from './data/descriptors.js';
import { normalize, normalizeTokens, stripPunctuation } from './normalize.js';

/**
 * Normalization against the real 27514 captures, not invented names. The package itself stays
 * dependency-free; only this test reads from disk.
 */

const rawDir = fileURLToPath(new URL('../../../e2e/fixtures/flipp/raw/', import.meta.url));

function searchItemNames(): string[] {
  const names: string[] = [];
  for (const file of readdirSync(rawDir).filter((name) => name.startsWith('search-'))) {
    const body: unknown = JSON.parse(readFileSync(`${rawDir}${file}`, 'utf8'));
    const items = (body as { items?: { item_type?: string; name?: string }[] }).items ?? [];
    for (const item of items) {
      if (item.item_type === 'flyer' && typeof item.name === 'string') names.push(item.name);
    }
  }
  return names;
}

describe('normalize over the raw Flipp captures', () => {
  const names = searchItemNames();

  it('has captures to work with', () => {
    expect(names.length).toBeGreaterThan(900);
  });

  it('never normalizes a real product name to nothing', () => {
    // An empty normalized name would match every ingredient, so the fallback must always fire.
    const empty = names.filter((name) => normalize(name) === '');
    expect(empty).toEqual([]);
  });

  it('is idempotent over every real name', () => {
    const unstable = names.filter((name) => {
      const once = normalize(name);
      return normalize(once) !== once;
    });
    expect(unstable).toEqual([]);
  });

  it('leaves no bare quantity token behind', () => {
    const withQuantities = names.filter((name) =>
      normalizeTokens(name).some((token) => /^\d+$/.test(token)),
    );
    expect(withQuantities).toEqual([]);
  });

  const realNames: [name: string, expected: string][] = [
    ['Broccoli Crowns', 'broccoli'],
    ['Beef Chuck Roast', 'beef chuck roast'],
    ['Food Lion Mini Cucumbers', 'mini cucumber'],
    ['Food Lion Pasta', 'pasta'],
    ['Nature’s Promise Jumbo Chicken Breast', 'nature s promise jumbo chicken breast'],
    ['Harris Teeter Cage Free Large Brown Eggs', 'cage free brown egg'],
    ['Kraft Shredded Cheese', 'cheese'],
    ['5 lb bag Idaho Russet Potatoes', 'idaho russet potato'],
    ['JUMBO YELLOW ONIONS', 'jumbo yellow onion'],
    ['80/20 GROUND BEEF', 'ground beef'],
    ['12 oz. Sunset Flavor Bomb or Sugar Bomb Tomatoes', 'sunset flavor bomb or sugar bomb tomato'],
  ];

  it.each(realNames)('normalizes the captured name %j to %j', (name, expected) => {
    expect(normalize(name)).toBe(expected);
  });
});

/**
 * The seed data's deal fixtures state the minimum contents of both lists, and the normalized names
 * in them are quoted against those lists. A term quietly missing from a list would make those
 * oracles wrong without failing anything else, so the claim is asserted here.
 */
describe('the lists the seed data says these are', () => {
  const documentedDescriptors = [
    'boneless',
    'skinless',
    'family pack',
    'large',
    'extra large',
    'grade a',
    'shredded',
    'sliced',
    'fresh',
    'crowns',
    'crumbles',
    'frozen',
    'organic',
    'sweet',
    'red or green',
    'bag',
  ];
  const documentedBrands = [
    'Kraft',
    'Barilla',
    "Dave's Killer",
    'Progresso',
    'Tropicana',
    'Publix',
    'Tide',
    'Coca-Cola',
    'Harris Teeter',
    'Food Lion',
    'ALDI',
    'CVS',
    'Lowes Foods',
  ];

  it.each(documentedDescriptors)('has the descriptor %j', (term) => {
    expect(DESCRIPTORS).toContain(term);
  });

  it.each(documentedBrands)('has the brand %j', (term) => {
    expect(BRANDS.map(stripPunctuation)).toContain(stripPunctuation(term));
  });
});

/**
 * The seed data's matching test cases. Phase 3 owns the 0.85 fuzzy threshold; what these assert is
 * the half normalization is responsible for — that exact token containment already lands on the
 * documented answer, so a later fuzzy step is not papering over a normalization bug.
 */
describe('the seed data matching test cases', () => {
  const contains = (ingredient: string, candidate: string): boolean => {
    const candidateTokens = new Set(normalizeTokens(candidate));
    return normalizeTokens(ingredient).every((token) => candidateTokens.has(token));
  };

  const cases: [ingredient: string, candidate: string, shouldMatch: boolean][] = [
    ['chicken breast', 'Boneless Skinless Chicken Breast, Family Pack', true],
    ['chicken breast', 'Chicken Broth, 32 oz', false],
    ['eggs', 'Large Grade A Eggs, 12 ct', true],
    ['eggs', 'Egg Noodles, 12 oz', true],
    ['pasta', 'Barilla Pasta, 16 oz', true],
    ['onion', 'Yellow Onions, 3 lb bag', true],
    ['tomatoes', 'Roma Tomatoes', true],
    ['tomato sauce', 'Roma Tomatoes', false],
    ['cheese', 'Kraft Shredded Cheese, 8 oz', true],
    ['bell pepper', 'black pepper', false],
    ['rice noodles', 'rice', false],
    ['potatoes', 'Russet Potatoes, 5 lb bag', true],
  ];

  it.each(cases)('%j against %j → %s', (ingredient, candidate, shouldMatch) => {
    expect(contains(ingredient, candidate)).toBe(shouldMatch);
  });

  it('chicken breast must not match chicken broth', () => {
    // The named false-positive case: "breast" has no counterpart in the candidate.
    expect(contains('chicken breast', 'Chicken Broth, 32 oz')).toBe(false);
  });
});
