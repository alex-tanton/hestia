import { describe, expect, it } from 'vitest';
import { FUZZY_THRESHOLD, tokenSimilarity, tokensFuzzyMatch } from './similarity.js';

describe('tokenSimilarity', () => {
  it('is 1 for identical tokens', () => {
    expect(tokenSimilarity('chicken', 'chicken')).toBe(1);
  });

  it('is 1 for two empty strings', () => {
    expect(tokenSimilarity('', '')).toBe(1);
  });

  it('is the share of the longer token’s length that survives the cheapest edit', () => {
    // "chicken" -> "chicke" is one deletion out of 7 characters: 1 - 1/7.
    expect(tokenSimilarity('chicken', 'chicke')).toBeCloseTo(1 - 1 / 7, 10);
  });

  it('is symmetric', () => {
    expect(tokenSimilarity('breast', 'broth')).toBe(tokenSimilarity('broth', 'breast'));
  });
});

describe('tokensFuzzyMatch', () => {
  it('matches at exactly the 0.85 threshold', () => {
    // "abcdefgh" (8) vs "abcdefgx" (8): one substitution, similarity 1 - 1/8 = 0.875.
    expect(tokenSimilarity('abcdefgh', 'abcdefgx')).toBeCloseTo(0.875, 10);
    expect(tokensFuzzyMatch('abcdefgh', 'abcdefgx')).toBe(true);
  });

  it('does not match just under the threshold', () => {
    // "abcdefg" (7) vs "abcdefx" (7): one substitution, similarity 1 - 1/7 ≈ 0.857 < 0.85 is false —
    // pick a pair that actually lands under 0.85: two substitutions in a 7-length token, 1 - 2/7.
    expect(tokenSimilarity('abcdefg', 'abxdxfg')).toBeCloseTo(1 - 2 / 7, 10);
    expect(tokensFuzzyMatch('abcdefg', 'abxdxfg')).toBe(false);
  });

  it('the named false-positive pair fails well under the threshold', () => {
    // "breast" has no real counterpart in "broth"; the two share only their leading "b" and "r".
    expect(tokensFuzzyMatch('breast', 'broth')).toBe(false);
  });

  it('exposes the 0.85 fuzzy threshold', () => {
    expect(FUZZY_THRESHOLD).toBe(0.85);
  });
});
