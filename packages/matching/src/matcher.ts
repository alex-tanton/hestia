import { tokenize } from './normalize.js';
import { tokensFuzzyMatch } from './similarity.js';

/**
 * Token containment, overrides, and the pantry-beats-sale precedence (overrides are stored in
 * `ingredient_match_override`). Pure and dependency-free of the service and the database: every
 * input here is already a normalized name or an already-loaded override row, so a later readiness
 * unit can call `matchIngredient` once per ingredient against the household's pantry and deal set
 * without this package ever touching Postgres.
 */

/** Mirrors `ingredient_match_override.target_kind`. */
export type MatchTargetKind = 'deal' | 'pantry';

/** Mirrors `ingredient_match_override.decision`. */
export type MatchDecision = 'force_match' | 'force_no_match';

/** One deal or pantry row a recipe ingredient could match, reduced to what matching needs. */
export interface MatchCandidate {
  /** The caller's own id for the row (a deal id or a pantry item id), echoed back unchanged. */
  id: string;
  targetKind: MatchTargetKind;
  normalizedName: string;
}

/**
 * One `ingredient_match_override` row. Applies only when both normalized names equal the
 * override's exact recorded strings — this package never
 * fuzzy-matches an override itself, only the ingredient-to-candidate pair it governs.
 */
export interface MatchOverride {
  ingredientNormalizedName: string;
  targetKind: MatchTargetKind;
  targetNormalizedName: string;
  decision: MatchDecision;
}

export interface MatchResult {
  matched: boolean;
  /** The candidate that decided the match. Undefined when `matched` is false. */
  candidate?: MatchCandidate;
  /** Why the winning candidate matched: an override forced it, or fuzzy token containment did. */
  reason?: 'override' | 'fuzzy';
}

function tokenContainmentMatch(
  ingredientTokens: readonly string[],
  candidateNormalizedName: string,
): boolean {
  // An ingredient that normalized to nothing tokenizable cannot contain-match anything; normalize()
  // guarantees this never happens for a real name, but the check keeps this function total.
  if (ingredientTokens.length === 0) return false;
  const candidateTokens = tokenize(candidateNormalizedName);
  return ingredientTokens.every((ingredientToken) =>
    candidateTokens.some((candidateToken) => tokensFuzzyMatch(ingredientToken, candidateToken)),
  );
}

function findOverride(
  overrides: readonly MatchOverride[],
  ingredientNormalizedName: string,
  candidate: MatchCandidate,
): MatchOverride | undefined {
  return overrides.find(
    (override) =>
      override.ingredientNormalizedName === ingredientNormalizedName &&
      override.targetKind === candidate.targetKind &&
      override.targetNormalizedName === candidate.normalizedName,
  );
}

interface Winner {
  candidate: MatchCandidate;
  reason: 'override' | 'fuzzy';
}

/**
 * Whether `ingredientNormalizedName` matches each candidate, overrides applied before fuzzy
 * matching: a force-no-match override removes a pair from consideration entirely (the fuzzy layer
 * is never even consulted for it), and a force-match override matches a pair regardless of
 * similarity, as long as a candidate with that exact target normalized name is present. When both
 * a pantry and a deal candidate match, the pantry one wins (an ingredient that matches both the
 * pantry and a deal goes into the pantry bucket), so callers get the bucket precedence for free
 * rather than re-deriving it.
 */
export function matchIngredient(
  ingredientNormalizedName: string,
  candidates: readonly MatchCandidate[],
  overrides: readonly MatchOverride[] = [],
): MatchResult {
  const ingredientTokens = tokenize(ingredientNormalizedName);
  let pantryMatch: Winner | undefined;
  let dealMatch: Winner | undefined;

  for (const candidate of candidates) {
    const override = findOverride(overrides, ingredientNormalizedName, candidate);
    if (override?.decision === 'force_no_match') continue;

    const matched =
      override?.decision === 'force_match'
        ? true
        : tokenContainmentMatch(ingredientTokens, candidate.normalizedName);
    if (!matched) continue;

    const reason: 'override' | 'fuzzy' =
      override?.decision === 'force_match' ? 'override' : 'fuzzy';
    if (candidate.targetKind === 'pantry') {
      pantryMatch ??= { candidate, reason };
    } else {
      dealMatch ??= { candidate, reason };
    }
  }

  const winner = pantryMatch ?? dealMatch;
  return winner === undefined
    ? { matched: false }
    : { matched: true, candidate: winner.candidate, reason: winner.reason };
}
