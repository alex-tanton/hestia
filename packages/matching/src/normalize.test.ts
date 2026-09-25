import { describe, expect, it } from 'vitest';
import { normalize, normalizeTokens, stripPunctuation, tokenize } from './normalize.js';

/**
 * Table-driven over Seed Data ("Deal fixtures" and "Matching test cases"), which is the oracle
 * for what each name must normalize to.
 */
describe('normalize', () => {
  const cases: [name: string, expected: string][] = [
    // Clean prices.
    ['Boneless Skinless Chicken Breast, Family Pack', 'chicken breast'],
    ['Large Grade A Eggs, 12 ct', 'egg'],
    ['Barilla Pasta, 16 oz', 'pasta'],
    ['Yellow Onions, 3 lb bag', 'yellow onion'],
    ['Lowes Foods Whole Milk, 1 gal', 'whole milk'],
    ['Roma Tomatoes', 'roma tomato'],
    // Multi-buy.
    ['Kraft Shredded Cheese, 8 oz', 'cheese'],
    ['Ground Beef 80/20, 1 lb', 'ground beef'],
    ['Progresso Soup', 'soup'],
    ['Tropicana Orange Juice 52 oz', 'orange juice'],
    // Conditional price, including the documented empty-normalization fallback.
    ['Tide Pods 42ct', 'pod'],
    ['Coca-Cola 2L', 'coca cola 2l'],
    // Amount-off.
    ["Dave's Killer Bread", 'bread'],
    // Favorite-store groceries.
    ['Fresh Broccoli Crowns', 'broccoli'],
    ['Bell Peppers, Red or Green', 'bell pepper'],
    ['Russet Potatoes, 5 lb bag', 'russet potato'],
    ['Feta Cheese Crumbles, 6 oz', 'feta cheese'],
    ['Egg Noodles, 12 oz', 'egg noodle'],
    ['Carrots, 2 lb bag', 'carrot'],
    ['Flour Tortillas, 10 ct', 'flour tortilla'],
    ['Chuck Roast', 'chuck roast'],
    ['Cucumbers', 'cucumber'],
    ['Frozen Sweet Peas, 12 oz', 'pea'],
    // Expired fixtures.
    ['Bananas', 'banana'],
    // The named false-positive pair.
    ['Chicken Broth, 32 oz', 'chicken broth'],
  ];

  it.each(cases)('normalizes %j to %j', (name, expected) => {
    expect(normalize(name)).toBe(expected);
  });

  it('is idempotent: normalizing a normalized name changes nothing', () => {
    for (const [name] of cases) {
      const once = normalize(name);
      expect(normalize(once)).toBe(once);
    }
  });
});

describe('normalize: the pipeline steps', () => {
  it('lowercases', () => {
    expect(normalize('CHUCK ROAST')).toBe('chuck roast');
  });

  it('strips punctuation rather than deleting it, so hyphens split words', () => {
    expect(normalize('Bone-In Pork Chops')).toBe('bone in pork chop');
  });

  it('keeps letters outside ASCII', () => {
    expect(normalize('Mifroma Le Gruyère AOP Cheese')).toBe('mifroma le gruyère aop cheese');
  });

  it('strips a quantity glued to its unit', () => {
    expect(normalize('Planet Oat Oatmilk 52oz')).toBe('planet oat oatmilk');
  });

  it('strips a quantity separated from its unit', () => {
    expect(normalize('Sliced White Mushrooms 8 oz')).toBe('white mushroom');
  });

  it('keeps a unit word that no number governs', () => {
    expect(normalize('Pound Cake')).toBe('pound cake');
  });

  it('strips a descriptor phrase only on word boundaries', () => {
    expect(normalize('Sweetpops Tomatoes')).toBe('sweetpop tomato');
  });

  it('strips the longest descriptor phrase first', () => {
    expect(normalize("Egg-Land's Best Extra Large Eggs")).toBe('egg land s best egg');
  });

  it('strips a store brand', () => {
    expect(normalize('Harris Teeter Cage Free Large Brown Eggs')).toBe('cage free brown egg');
  });

  it('falls back to the punctuation-stripped original when every token is stripped', () => {
    expect(normalize('Publix')).toBe('publix');
    expect(normalize('Family Pack')).toBe('family pack');
  });

  it('returns an empty string for a name with no letters or digits', () => {
    expect(normalize('  ***  ')).toBe('');
  });
});

describe('tokenize', () => {
  it('splits a normalized name into the tokens containment compares', () => {
    expect(tokenize(normalize('Boneless Skinless Chicken Breast, Family Pack'))).toEqual([
      'chicken',
      'breast',
    ]);
  });

  it('yields no tokens for an empty normalized name', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('normalizeTokens is normalize then tokenize', () => {
    expect(normalizeTokens('Russet Potatoes, 5 lb bag')).toEqual(['russet', 'potato']);
  });
});

describe('stripPunctuation', () => {
  it('is the fallback form: lowercased, punctuation only', () => {
    expect(stripPunctuation('Coca-Cola 2L')).toBe('coca cola 2l');
  });
});
