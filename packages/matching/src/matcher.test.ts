import { describe, expect, it } from 'vitest';
import { matchIngredient, type MatchCandidate, type MatchOverride } from './matcher.js';
import { normalize } from './normalize.js';

/**
 * The matcher composes normalize.ts's normalization with fuzzy token containment and overrides.
 * normalize.test.ts and fixtures.test.ts already prove normalization in
 * isolation; these tests prove the matcher gets the right answer once normalization, fuzzy
 * matching, and overrides all run together — which is the thing a later readiness unit actually
 * depends on.
 */

function candidate(
  normalizedName: string,
  targetKind: MatchCandidate['targetKind'] = 'deal',
  id = normalizedName,
): MatchCandidate {
  return { id, targetKind, normalizedName };
}

describe('the seed data matching test cases (12 rows)', () => {
  // Verbatim from the seed data's matching test cases, including both
  // named false-positive rows. Names here are raw text, normalized the same way production data
  // is, so this proves the matcher end to end rather than assuming pre-normalized input.
  const cases: [
    label: string,
    ingredient: string,
    target: string,
    kind: MatchCandidate['targetKind'],
    shouldMatch: boolean,
  ][] = [
    [
      'chicken breast / boneless skinless chicken breast family pack',
      'chicken breast',
      'Boneless Skinless Chicken Breast, Family Pack',
      'deal',
      true,
    ],
    [
      'chicken breast / chicken broth — named false positive',
      'chicken breast',
      'Chicken Broth, 32 oz',
      'deal',
      false,
    ],
    ['eggs / large grade a eggs', 'eggs', 'Large Grade A Eggs, 12 ct', 'deal', true],
    ['eggs / egg noodles — containment holds', 'eggs', 'Egg Noodles, 12 oz', 'deal', true],
    ['pasta / barilla pasta', 'pasta', 'Barilla Pasta, 16 oz', 'deal', true],
    [
      'onion / yellow onions — singular against plural',
      'onion',
      'Yellow Onions, 3 lb bag',
      'deal',
      true,
    ],
    ['tomatoes / roma tomatoes', 'tomatoes', 'Roma Tomatoes', 'deal', true],
    [
      'tomato sauce / roma tomatoes — different product',
      'tomato sauce',
      'Roma Tomatoes',
      'deal',
      false,
    ],
    ['cheese / kraft shredded cheese', 'cheese', 'Kraft Shredded Cheese, 8 oz', 'deal', true],
    [
      'bell pepper / black pepper — named false positive',
      'bell pepper',
      'black pepper',
      'pantry',
      false,
    ],
    ['rice noodles / rice — noodles unmatched', 'rice noodles', 'rice', 'pantry', false],
    ['potatoes / russet potatoes', 'potatoes', 'Russet Potatoes, 5 lb bag', 'deal', true],
  ];

  it.each(cases)('%s', (_label, ingredient, target, kind, shouldMatch) => {
    const result = matchIngredient(normalize(ingredient), [candidate(normalize(target), kind)]);
    expect(result.matched).toBe(shouldMatch);
  });
});

describe('named false-positive cases', () => {
  it('chicken breast must not match chicken broth', () => {
    const result = matchIngredient(normalize('chicken breast'), [
      candidate(normalize('Chicken Broth, 32 oz')),
    ]);
    expect(result.matched).toBe(false);
  });

  it('bell pepper must not match black pepper', () => {
    const result = matchIngredient(normalize('bell pepper'), [
      candidate(normalize('black pepper'), 'pantry'),
    ]);
    expect(result.matched).toBe(false);
  });
});

describe('normalization composed with the fuzzy layer', () => {
  it('strips brand and package size before comparing tokens', () => {
    // "Kraft Shredded Cheese, 8 oz" normalizes to "cheese" (brand, descriptor, and size all gone),
    // which must still contain-match a bare "cheese" ingredient.
    const result = matchIngredient(normalize('cheese'), [
      candidate(normalize('Kraft Shredded Cheese, 8 oz')),
    ]);
    expect(result.matched).toBe(true);
    expect(result.candidate?.normalizedName).toBe('cheese');
  });

  it('singularizes both sides so plural packaging still matches a singular ingredient', () => {
    const result = matchIngredient(normalize('onion'), [
      candidate(normalize('JUMBO YELLOW ONIONS')),
    ]);
    expect(result.matched).toBe(true);
  });

  it('tolerates a small misspelling within the 0.85 floor', () => {
    // "tomatos" (one letter short of "tomatoes") still normalizes+fuzzy-matches "tomato".
    const result = matchIngredient(normalize('tomatos'), [candidate(normalize('Roma Tomatoes'))]);
    expect(result.matched).toBe(true);
  });

  it('does not match when normalization leaves no tokens in common', () => {
    const result = matchIngredient(normalize('ground beef'), [
      candidate(normalize('Chicken Broth')),
    ]);
    expect(result.matched).toBe(false);
  });

  it('a brand-and-size-only candidate name still compares on its fallback form', () => {
    // "Coca-Cola 2L" normalizes to "coca cola 2l" (normalize.ts's documented fallback), which
    // shares no token with an unrelated ingredient.
    const result = matchIngredient(normalize('pasta'), [candidate(normalize('Coca-Cola 2L'))]);
    expect(result.matched).toBe(false);
  });
});

describe('overrides applied before fuzzy matching', () => {
  it('force_match matches a pair the fuzzy layer would refuse', () => {
    // "snack cheese" shares no token with "cheese" once normalized, so fuzzy alone would refuse
    // it — this is the seed data's own override fixture (Oak Street, "cheese" force-no-match
    // against Harris Teeter's "snack cheese"), used here in its mirror-image form to prove
    // force_match.
    const overrides: MatchOverride[] = [
      {
        ingredientNormalizedName: 'cheese',
        targetKind: 'deal',
        targetNormalizedName: 'snack cheese',
        decision: 'force_match',
      },
    ];
    const result = matchIngredient('cheese', [candidate('snack cheese')], overrides);
    expect(result.matched).toBe(true);
    expect(result.reason).toBe('override');
  });

  it('force_no_match prevents a pair the fuzzy layer would otherwise accept', () => {
    const overrides: MatchOverride[] = [
      {
        ingredientNormalizedName: 'cheese',
        targetKind: 'deal',
        targetNormalizedName: 'cheese',
        decision: 'force_no_match',
      },
    ];
    const result = matchIngredient('cheese', [candidate('cheese')], overrides);
    expect(result.matched).toBe(false);
  });

  it('an override only applies to its exact recorded (ingredient, kind, target) triple', () => {
    const overrides: MatchOverride[] = [
      {
        ingredientNormalizedName: 'cheese',
        targetKind: 'deal',
        targetNormalizedName: 'snack cheese',
        decision: 'force_no_match',
      },
    ];
    // Different target name: the override does not apply, so fuzzy decides normally.
    const result = matchIngredient('cheese', [candidate('cheese')], overrides);
    expect(result.matched).toBe(true);
    expect(result.reason).toBe('fuzzy');
  });

  it('an override only applies to its recorded target_kind, not the same name under the other kind', () => {
    const overrides: MatchOverride[] = [
      {
        ingredientNormalizedName: 'cheese',
        targetKind: 'pantry',
        targetNormalizedName: 'cheese',
        decision: 'force_no_match',
      },
    ];
    // Same ingredient and target name, but this candidate is a deal, not a pantry item.
    const result = matchIngredient('cheese', [candidate('cheese', 'deal')], overrides);
    expect(result.matched).toBe(true);
  });

  it('force_match does nothing when no candidate with that target name is present', () => {
    // Requirements: "puts the ingredient in the target's bucket whenever a target with that
    // normalized name exists" — an override never fabricates a match against an absent target.
    const overrides: MatchOverride[] = [
      {
        ingredientNormalizedName: 'cheese',
        targetKind: 'deal',
        targetNormalizedName: 'snack cheese',
        decision: 'force_match',
      },
    ];
    const result = matchIngredient('cheese', [candidate('bread')], overrides);
    expect(result.matched).toBe(false);
  });
});

describe('pantry beats sale', () => {
  it('returns the pantry candidate when both a pantry item and a deal match', () => {
    const result = matchIngredient('pasta', [
      candidate('pasta', 'deal', 'deal-1'),
      candidate('pasta', 'pantry', 'pantry-1'),
    ]);
    expect(result.matched).toBe(true);
    expect(result.candidate?.targetKind).toBe('pantry');
    expect(result.candidate?.id).toBe('pantry-1');
  });

  it('falls back to the deal candidate when nothing in the pantry matches', () => {
    const result = matchIngredient('pasta', [
      candidate('rice', 'pantry', 'pantry-1'),
      candidate('pasta', 'deal', 'deal-1'),
    ]);
    expect(result.matched).toBe(true);
    expect(result.candidate?.targetKind).toBe('deal');
  });

  it('a force-matched deal still loses to a fuzzy-matched pantry item', () => {
    const overrides: MatchOverride[] = [
      {
        ingredientNormalizedName: 'cheese',
        targetKind: 'deal',
        targetNormalizedName: 'snack cheese',
        decision: 'force_match',
      },
    ];
    const result = matchIngredient(
      'cheese',
      [candidate('snack cheese', 'deal', 'deal-1'), candidate('cheese', 'pantry', 'pantry-1')],
      overrides,
    );
    expect(result.candidate?.targetKind).toBe('pantry');
  });
});

describe('no match', () => {
  it('with no candidates at all', () => {
    expect(matchIngredient('cheese', []).matched).toBe(false);
  });

  it('reports no candidate and no reason when nothing matches', () => {
    const result = matchIngredient('cheese', [candidate('bread')]);
    expect(result).toStrictEqual({ matched: false });
  });

  it('an ingredient that tokenizes to nothing cannot contain-match any candidate', () => {
    // normalize() never produces an empty normalized name for real input (it falls back to the
    // punctuation-stripped original instead), but matchIngredient takes a bare string and must
    // stay total rather than match everything when given one anyway.
    const result = matchIngredient('', [candidate('cheese')]);
    expect(result.matched).toBe(false);
  });
});
