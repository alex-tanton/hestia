import { distance } from 'fastest-levenshtein';

/**
 * Requirements, "Matching mechanics": token containment needs a per-token similarity of at least
 * 0.85. `fastest-levenshtein` won the Phase 3 benchmark (`scripts/fuzzy-benchmark.ts`;
 * Engineering Practices, "Key libraries") over `fuse.js` — tied at 12/12 on Seed Data's matching
 * test cases, 2-3x faster over hundreds of real deal names.
 */
export const FUZZY_THRESHOLD = 0.85;

/**
 * `distance()` is an edit-distance count, not a 0-1 similarity — the raw metric has no ceiling,
 * so "0.85" would be meaningless applied to it directly. Dividing by the longer string's length
 * turns it into "the share of characters that still agree after the cheapest edit", which is what
 * the PRD's 0.85 threshold means: two tokens differing in 15% of their length or less still match.
 * Two empty strings are defined as identical (similarity 1) so the function stays total; in
 * practice neither side is ever empty, since normalize.ts's tokenizer drops empty tokens.
 */
export function tokenSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - distance(a, b) / maxLength;
}

/** Whether two tokens clear the 0.85 similarity floor. */
export function tokensFuzzyMatch(a: string, b: string): boolean {
  return tokenSimilarity(a, b) >= FUZZY_THRESHOLD;
}
