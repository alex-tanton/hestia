export { normalize, normalizeTokens, tokenize, stripPunctuation } from './normalize.js';
export { singularize } from './singularize.js';
export { BRANDS } from './data/brands.js';
export { DESCRIPTORS } from './data/descriptors.js';
export { UNITS } from './data/units.js';
export { FUZZY_THRESHOLD, tokenSimilarity, tokensFuzzyMatch } from './similarity.js';
export { matchIngredient } from './matcher.js';
export type {
  MatchCandidate,
  MatchDecision,
  MatchOverride,
  MatchResult,
  MatchTargetKind,
} from './matcher.js';
