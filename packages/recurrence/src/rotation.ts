/**
 * PRD, "Rotation": "For a chore with a `rotation_order` of n members, the member whose turn it is
 * is: `rotation_order[(rotation_offset + completion_count) mod n]`, where `completion_count` is
 * the number of `chore_completion` rows for the chore." `completion_count` is always the caller's
 * to compute (it comes from counting `chore_completion` rows); this package only does the mod
 * arithmetic once it has that count.
 */

/** Positive modulo — JS's `%` can return a negative result, which `mod(-1, 3) = 2` corrects. */
function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/** The index into `rotationOrder` of whoever's turn it is. */
export function currentTurnIndex(
  rotationOrder: readonly string[],
  rotationOffset: number,
  completionCount: number,
): number {
  if (rotationOrder.length === 0) {
    throw new RangeError('rotationOrder must have at least one member');
  }
  return mod(rotationOffset + completionCount, rotationOrder.length);
}

/** The household member (user id) whose turn it is. */
export function currentTurn(
  rotationOrder: readonly string[],
  rotationOffset: number,
  completionCount: number,
): string {
  const index = currentTurnIndex(rotationOrder, rotationOffset, completionCount);
  // rotationOrder.length > 0 is enforced by currentTurnIndex above, and index is always in range.
  const member = rotationOrder[index];
  if (member === undefined) throw new RangeError('rotation index out of range');
  return member;
}

export interface RebasedRotation {
  /** The order with the departing member removed, or `null` when they were the last member left. */
  readonly rotationOrder: readonly string[] | null;
  /** Meaningless (and conventionally 0) when `rotationOrder` is `null`. */
  readonly rotationOffset: number;
}

/**
 * PRD, "Rotation": "When a member leaves the household, they are removed from every rotation
 * order. Let `cur` be the index of the member whose turn it was before the removal and `i` the
 * removed index. `rotation_offset` is rebased so the turn stays with the same person: `cur' = cur
 * − 1` if `i < cur`, `cur' = cur` if `i > cur`, and `cur' = cur mod (n − 1)` if `i = cur` (the next
 * member takes the turn). The new offset is `(cur' − completion_count) mod (n − 1)`. When the last
 * member is removed from an order, the order becomes null."
 *
 * `completionCount` and `departingIndex` (the departing member's position in `rotationOrder`
 * before removal) are both the caller's to determine from `chore_completion` rows and the
 * departing member's id; this function only does the rebasing math.
 */
export function rebaseRotationOnDeparture(
  rotationOrder: readonly string[],
  rotationOffset: number,
  completionCount: number,
  departingIndex: number,
): RebasedRotation {
  const n = rotationOrder.length;
  if (departingIndex < 0 || departingIndex >= n) {
    throw new RangeError('departingIndex out of range');
  }
  if (n === 1) {
    return { rotationOrder: null, rotationOffset: 0 };
  }

  const cur = currentTurnIndex(rotationOrder, rotationOffset, completionCount);
  const i = departingIndex;
  let curPrime: number;
  if (i < cur) curPrime = cur - 1;
  else if (i > cur) curPrime = cur;
  else curPrime = mod(cur, n - 1);

  const newOrder = rotationOrder.filter((_, index) => index !== i);
  const newOffset = mod(curPrime - completionCount, n - 1);
  return { rotationOrder: newOrder, rotationOffset: newOffset };
}

/**
 * PRD, "Rotation": editing a chore's rotation order from the Chore sheet keeps the turn with
 * whoever holds it in `oldOrder` when they are still present in `newOrder` — `rotation_offset` is
 * recomputed from their new index — and resets to 0 when they are not, since there is then no
 * "same person" to preserve. This is the smallest conservative extension of departure's own "the
 * turn stays with the same person" rule to the edit case; it is not a generalization of
 * `rebaseRotationOnDeparture`'s `cur`/`i` formula above, which is built for removing exactly one
 * member and does not extend to an arbitrary reorder, insertion, or multi-member edit.
 *
 * `completionCount` is the caller's to determine, the same as everywhere else in this module.
 */
export function rebaseRotationOnEdit(
  oldOrder: readonly string[],
  oldOffset: number,
  completionCount: number,
  newOrder: readonly string[],
): number {
  const holder = currentTurn(oldOrder, oldOffset, completionCount);
  const newIndex = newOrder.indexOf(holder);
  if (newIndex === -1) return 0;
  return mod(newIndex - completionCount, newOrder.length);
}
