import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { distance as levenshteinDistance } from 'fastest-levenshtein';
import Fuse from 'fuse.js';
import { normalizeTokens } from '../src/normalize.js';

/**
 * Phase 3 fuzzy-library benchmark (Engineering Practices, "Key libraries"; Requirements,
 * "Matching mechanics"). Throwaway but committed: it is the reproducible record of why
 * `fastest-levenshtein` was chosen over `fuse.js`, run against real strings rather than invented
 * ones. The result (both 12/12 correct; fastest-levenshtein 2-3x faster) is written into
 * Engineering Practices' "Key libraries" table, worded as if it had always been there.
 *
 * Both candidates are wired into the same token-containment scheme the package ships
 * (normalize.ts's tokens, a 0.85 similarity floor per token pair) so the comparison is
 * apples-to-apples: which library gets the *matching decision* right, not which raw metric looks
 * nicer in isolation. Correctness decides the winner; performance is only a tiebreaker.
 *
 * fuse.js lost and was removed from package.json per that decision, so this script no longer runs
 * as committed — `pnpm add -D fuse.js@7.5.0 --filter @hearth/matching` restores it if the
 * comparison ever needs rerunning (a threshold change, a new fuzzy-library candidate). It is
 * excluded from lint and typecheck (eslint.config.js, and it sits outside packages/matching's
 * tsconfig `include`) for the same reason: it is a record of a decision, not shipped code.
 */

const THRESHOLD = 0.85;

// Seed Data, "Matching test cases" — the ground truth, verbatim, including both named
// false-positive cases.
const GROUND_TRUTH: [ingredient: string, candidate: string, shouldMatch: boolean][] = [
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

// Seed Data, "Pantry" and "Recipes": every ingredient name across the twelve Oak Street recipes,
// Rivera Family's two, and the pantry — the realistic "dozens of ingredients" side of the corpus.
const RECIPE_INGREDIENT_NAMES = [
  'olive oil',
  'salt',
  'black pepper',
  'garlic',
  'rice',
  'flour',
  'sugar',
  'butter',
  'milk',
  'bread',
  'soy sauce',
  'cumin',
  'paprika',
  'canned tomatoes',
  'black beans',
  'chicken broth',
  'parmesan',
  'eggs',
  'yellow onions',
  'pasta',
  'chicken breast',
  'broccoli',
  'bell pepper',
  'lemon',
  'ground beef',
  'onion',
  'tomato paste',
  'dried oregano',
  'frozen peas',
  'carrots',
  'green onions',
  'sesame oil',
  'flour tortillas',
  'avocado',
  'lime',
  'salsa',
  'cheese',
  'red onion',
  'egg noodles',
  'celery',
  'thyme',
  'bay leaves',
  'cucumber',
  'roma tomatoes',
  'feta cheese',
  'kalamata olives',
  'red wine vinegar',
  'mozzarella',
  'ricotta',
  'potatoes',
  'lentils',
  'coconut milk',
  'ginger',
  'curry powder',
  'basmati rice',
  'cilantro',
  'rice noodles',
  'shrimp',
  'tamarind paste',
  'fish sauce',
  'bean sprouts',
  'peanuts',
  'chuck roast',
  'russet potatoes',
  'beef broth',
  'rosemary',
  'worcestershire sauce',
  'ahi tuna',
  'sushi rice',
  'sesame seeds',
  'miso paste',
  'tofu',
  'dashi',
  'wakame',
];

interface Matcher {
  name: string;
  similarity: (a: string, b: string) => number;
}

/** 1 - normalized edit distance, so 0.85 means "85% of characters agree", same scale as the PRD. */
function levenshteinSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}

// Fuse.js has no standalone pairwise-similarity function; it is a list search engine. The closest
// apples-to-apples use is a single-item index, `includeScore`, matched against the other token.
// `ignoreLocation` and a generous `distance` turn off the position-weighting Fuse assumes for
// prose search, which token-vs-token comparison has no use for. Fuse's score is 0 (identical) to
// 1 (no relation), the inverse of a similarity, so `1 - score` puts it on the same 0-1 scale.
function fuseSimilarity(a: string, b: string): number {
  const fuse = new Fuse([b], {
    includeScore: true,
    threshold: 1,
    distance: 100,
    ignoreLocation: true,
    isCaseSensitive: false,
  });
  const [result] = fuse.search(a);
  if (result === undefined) return 0;
  return 1 - (result.score ?? 1);
}

/** The package's token-containment rule (normalize.ts docs), parameterized over the fuzzy metric. */
function tokenContainmentMatch(
  ingredientNormalized: string,
  candidateNormalized: string,
  similarity: (a: string, b: string) => number,
): boolean {
  const ingredientTokens = normalizeTokens(ingredientNormalized);
  const candidateTokens = normalizeTokens(candidateNormalized);
  return ingredientTokens.every((ingredientToken) =>
    candidateTokens.some(
      (candidateToken) => similarity(ingredientToken, candidateToken) >= THRESHOLD,
    ),
  );
}

function runCorrectness(matcher: Matcher): { passed: number; failed: string[] } {
  const failed: string[] = [];
  let passed = 0;
  for (const [ingredient, candidate, shouldMatch] of GROUND_TRUTH) {
    const got = tokenContainmentMatch(ingredient, candidate, matcher.similarity);
    if (got === shouldMatch) {
      passed += 1;
    } else {
      failed.push(`${ingredient} vs ${candidate}: expected ${shouldMatch}, got ${got}`);
    }
  }
  return { passed, failed };
}

// --- Real Flipp deal names (e2e/fixtures/flipp/normalized/*.json), the "hundreds of deals" side.

const normalizedDir = fileURLToPath(
  new URL('../../../e2e/fixtures/flipp/normalized/', import.meta.url),
);

function loadDealNames(): string[] {
  const names: string[] = [];
  for (const file of readdirSync(normalizedDir).filter(
    (name) => name.startsWith('search-') || name.startsWith('flyer-items-'),
  )) {
    const body: unknown = JSON.parse(readFileSync(`${normalizedDir}${file}`, 'utf8'));
    if (!Array.isArray(body)) continue;
    for (const entry of body as { name?: unknown }[]) {
      if (typeof entry.name === 'string') names.push(entry.name);
    }
  }
  return names;
}

function runPerformance(matcher: Matcher, dealNames: string[]): number {
  const started = performance.now();
  let matches = 0;
  for (const ingredient of RECIPE_INGREDIENT_NAMES) {
    for (const dealName of dealNames) {
      if (tokenContainmentMatch(ingredient, dealName, matcher.similarity)) matches += 1;
    }
  }
  const elapsed = performance.now() - started;
  // Touch `matches` so the loop is not dead code a future refactor optimizes away.
  if (matches < 0) throw new Error('unreachable');
  return elapsed;
}

function main(): void {
  const matchers: Matcher[] = [
    { name: 'fastest-levenshtein', similarity: levenshteinSimilarity },
    { name: 'fuse.js', similarity: fuseSimilarity },
  ];

  const dealNames = loadDealNames();
  const uniqueDealNames = [...new Set(dealNames)];

  console.log(
    `Corpus: ${uniqueDealNames.length} unique real deal names, ` +
      `${RECIPE_INGREDIENT_NAMES.length} recipe/pantry ingredient names.\n`,
  );

  console.log('--- Correctness: Seed Data "Matching test cases" (12 rows) ---');
  for (const matcher of matchers) {
    const { passed, failed } = runCorrectness(matcher);
    console.log(`${matcher.name}: ${passed}/${GROUND_TRUTH.length} correct`);
    for (const failure of failed) console.log(`  FAIL: ${failure}`);
  }

  console.log('\n--- Performance: every ingredient x every unique real deal name ---');
  const comparisons = RECIPE_INGREDIENT_NAMES.length * uniqueDealNames.length;
  console.log(`${comparisons.toLocaleString()} token-containment checks per library.\n`);
  for (const matcher of matchers) {
    // One warm-up pass so JIT warm-up does not skew the timed run.
    runPerformance(matcher, uniqueDealNames.slice(0, 20));
    const elapsedMs = runPerformance(matcher, uniqueDealNames);
    console.log(
      `${matcher.name}: ${elapsedMs.toFixed(1)}ms total, ` +
        `${((elapsedMs / comparisons) * 1000).toFixed(2)}µs per ingredient-vs-deal check`,
    );
  }
}

main();
