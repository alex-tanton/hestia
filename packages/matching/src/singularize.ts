/**
 * Singularizes one token so "Yellow Onions" and "onion" normalize alike (Requirements,
 * "Matching mechanics": "singularize each remaining token").
 *
 * Deliberately a handful of suffix rules rather than an inflection library: this package is
 * dependency-free, and the vocabulary is grocery nouns, not English at large. The guards matter
 * more than the rules — "hummus", "couscous", "swiss" and "molasses" are singular already.
 */

/** Words that end in a sibilant but are not plurals ("hummus", "swiss", "couscous"). */
const NOT_PLURAL_SUFFIXES = ['ss', 'us', 'is'];

/** Plurals whose singular no suffix rule reaches. */
const IRREGULAR = new Map<string, string>([
  ['leaves', 'leaf'],
  ['loaves', 'loaf'],
  ['halves', 'half'],
  ['knives', 'knife'],
  // Singular already, but "sses" would otherwise take it for a plural.
  ['molasses', 'molasses'],
  ['children', 'child'],
  ['geese', 'goose'],
  ['teeth', 'tooth'],
]);

export function singularize(token: string): string {
  const irregular = IRREGULAR.get(token);
  if (irregular !== undefined) return irregular;

  if (token.length <= 3 || !token.endsWith('s')) return token;
  if (NOT_PLURAL_SUFFIXES.some((suffix) => token.endsWith(suffix))) return token;

  // "berries" → "berry", but never a two-letter stem such as "ties".
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  // "tomatoes" → "tomato", "boxes" → "box", "peaches" → "peach".
  if (/(oes|ches|shes|xes|zes|sses)$/.test(token)) return token.slice(0, -2);
  return token.slice(0, -1);
}
