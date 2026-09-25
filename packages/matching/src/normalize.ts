import { BRANDS } from './data/brands.js';
import { DESCRIPTORS } from './data/descriptors.js';
import { UNITS } from './data/units.js';
import { singularize } from './singularize.js';

/**
 * Ingredient and product-name normalization (Requirements, "Matching mechanics").
 *
 * Both sides of a match go through this: a recipe's "chicken breast" and a flyer's "Boneless
 * Skinless Chicken Breast, Family Pack" have to meet somewhere. The pipeline is, in order:
 * lowercase, strip punctuation, strip quantities and units, strip descriptors, strip brands,
 * singularize. When that leaves nothing — "Coca-Cola 2L" is brand plus size and nothing else —
 * the result falls back to the lowercased original with only punctuation stripped, because an
 * empty normalized name would match everything.
 *
 * Fuzzy matching and readiness are Phase 3 and deliberately absent here.
 */

const UNIT_SET = new Set(UNITS);

/** A number, with or without a unit glued to it: "42ct", "2l", "16.3", "3". */
const QUANTITY = /^\d+(?:[.,]\d+)?([a-z]*)$/;

/** Longest phrases first, so "extra large" is stripped before "large" can match half of it. */
function byLengthDescending(terms: readonly string[]): string[] {
  return [...terms].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

const DESCRIPTOR_PHRASES = byLengthDescending(DESCRIPTORS.map(stripPunctuation));
const BRAND_PHRASES = byLengthDescending(BRANDS.map(stripPunctuation));

/**
 * Lowercases and reduces every non-letter, non-digit run to a single space. Unicode-aware so
 * "Le Gruyère" keeps its vowel; "Coca-Cola 2L" becomes "coca cola 2l" and "80/20" "80 20".
 */
export function stripPunctuation(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Removes whole-word occurrences of each phrase, leaving the surrounding words in place. */
function stripPhrases(text: string, phrases: readonly string[]): string {
  let result = ` ${text} `;
  for (const phrase of phrases) {
    if (phrase.length === 0) continue;
    let index = result.indexOf(` ${phrase} `);
    while (index !== -1) {
      result = `${result.slice(0, index)} ${result.slice(index + phrase.length + 2)}`;
      index = result.indexOf(` ${phrase} `);
    }
  }
  return result.trim().replace(/\s+/g, ' ');
}

/** Descriptors then brands, both maintained lists. */
function stripTerms(text: string): string {
  return stripPhrases(stripPhrases(text, DESCRIPTOR_PHRASES), BRAND_PHRASES);
}

/**
 * Drops quantities and the units they govern. "12 ct", "16 oz" and "3 lb" go; a bare unit word
 * with no number in front of it stays, because "Pound Cake" is a cake.
 */
function stripQuantities(tokens: readonly string[]): string[] {
  const kept: string[] = [];
  let previousWasBareNumber = false;
  for (const token of tokens) {
    const quantity = QUANTITY.exec(token);
    const suffix = quantity?.[1];
    if (suffix === '') {
      previousWasBareNumber = true;
      continue;
    }
    if (suffix !== undefined && UNIT_SET.has(suffix)) {
      // "42ct", "2l": the unit is glued to the number.
      previousWasBareNumber = false;
      continue;
    }
    if (previousWasBareNumber && UNIT_SET.has(token)) {
      previousWasBareNumber = false;
      continue;
    }
    previousWasBareNumber = false;
    kept.push(token);
  }
  return kept;
}

/**
 * The normalized form stored as `normalized_name` for ingredients, pantry items, deals, and
 * list items, and the input to Phase 3's token containment.
 */
export function normalize(name: string): string {
  const punctuationOnly = stripPunctuation(name);
  if (punctuationOnly === '') return '';

  const withoutTerms = stripTerms(punctuationOnly);
  const tokens = stripQuantities(withoutTerms.split(' ').filter((token) => token !== '')).map(
    singularize,
  );
  // Again after singularizing: the lists are singular, so "Sandwich Bags" only loses its "bag"
  // on this pass. Without it normalize(normalize(x)) could differ from normalize(x).
  const stripped = stripTerms(tokens.join(' '));

  // Nothing survived: the name was entirely brand, size, and descriptor.
  if (stripped === '') return punctuationOnly;
  return stripped;
}

/** The tokens of a normalized name, which is what token containment compares. */
export function tokenize(normalized: string): string[] {
  return normalized.split(' ').filter((token) => token !== '');
}

/** Normalizes and tokenizes in one step, for callers that only want the tokens. */
export function normalizeTokens(name: string): string[] {
  return tokenize(normalize(name));
}
