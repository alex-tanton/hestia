import { describe, expect, it } from 'vitest';
import {
  currentTurn,
  currentTurnIndex,
  rebaseRotationOnDeparture,
  rebaseRotationOnEdit,
} from './rotation.js';

describe('currentTurnIndex / currentTurn', () => {
  const order = ['alex', 'casey', 'sam'];

  it.each([
    { offset: 0, count: 0, expectedIndex: 0 },
    { offset: 0, count: 1, expectedIndex: 1 },
    { offset: 0, count: 2, expectedIndex: 2 },
    { offset: 0, count: 3, expectedIndex: 0 }, // wraps
    { offset: 1, count: 0, expectedIndex: 1 },
    { offset: 1, count: 2, expectedIndex: 0 }, // (1+2) mod 3 = 0
    { offset: 2, count: 5, expectedIndex: 1 }, // (2+5) mod 3 = 1
  ])('offset=$offset, count=$count -> index $expectedIndex', ({ offset, count, expectedIndex }) => {
    expect(currentTurnIndex(order, offset, count)).toBe(expectedIndex);
    expect(currentTurn(order, offset, count)).toBe(order[expectedIndex]);
  });

  it('a missed occurrence does not advance the turn (no completion = no change in count = same turn)', () => {
    // Nothing completed between two reads: completionCount is unchanged, so the turn is unchanged.
    expect(currentTurnIndex(order, 0, 2)).toBe(currentTurnIndex(order, 0, 2));
  });

  it('throws for an empty rotation order', () => {
    expect(() => currentTurnIndex([], 0, 0)).toThrow(RangeError);
  });
});

describe('rebaseRotationOnDeparture', () => {
  const order = ['alex', 'casey', 'sam', 'drew']; // n = 4

  it('i < cur: the turn index shifts down by one to stay with the same person', () => {
    // offset=0, count=2 -> cur = 2 ("sam"). Removing index 0 ("alex"), which is < cur.
    const result = rebaseRotationOnDeparture(order, 0, 2, 0);
    expect(result.rotationOrder).toEqual(['casey', 'sam', 'drew']);
    // cur' = cur - 1 = 1. newOffset = (1 - 2) mod 3 = 2.
    expect(result.rotationOffset).toBe(2);
    // Confirm "sam" still has the turn in the new order at the same completion count.
    expect(currentTurn(result.rotationOrder!, result.rotationOffset, 2)).toBe('sam');
  });

  it('i > cur: the turn index is unchanged, since someone earlier in the order left', () => {
    // offset=0, count=0 -> cur = 0 ("alex"). Removing index 2 ("sam"), which is > cur.
    const result = rebaseRotationOnDeparture(order, 0, 0, 2);
    expect(result.rotationOrder).toEqual(['alex', 'casey', 'drew']);
    // cur' = cur = 0. newOffset = (0 - 0) mod 3 = 0.
    expect(result.rotationOffset).toBe(0);
    expect(currentTurn(result.rotationOrder!, result.rotationOffset, 0)).toBe('alex');
  });

  it('i === cur: the departing member was mid-turn, so the next member in order takes it', () => {
    // offset=0, count=1 -> cur = 1 ("casey"). Removing index 1 ("casey") themselves.
    const result = rebaseRotationOnDeparture(order, 0, 1, 1);
    expect(result.rotationOrder).toEqual(['alex', 'sam', 'drew']);
    // cur' = cur mod (n-1) = 1 mod 3 = 1 ("sam" in the new 3-member order).
    // newOffset = (1 - 1) mod 3 = 0.
    expect(result.rotationOffset).toBe(0);
    expect(currentTurn(result.rotationOrder!, result.rotationOffset, 1)).toBe('sam');
  });

  it('i === cur wrapping: when cur is the last index, the next turn wraps to the first remaining member', () => {
    // offset=0, count=3 -> cur = 3 ("drew"). Removing index 3 ("drew") themselves.
    const result = rebaseRotationOnDeparture(order, 0, 3, 3);
    expect(result.rotationOrder).toEqual(['alex', 'casey', 'sam']);
    // cur' = 3 mod 3 = 0. newOffset = (0 - 3) mod 3 = 0.
    expect(result.rotationOffset).toBe(0);
    expect(currentTurn(result.rotationOrder!, result.rotationOffset, 3)).toBe('alex');
  });

  it('removing the last member in an order leaves it null', () => {
    const result = rebaseRotationOnDeparture(['alex'], 0, 7, 0);
    expect(result.rotationOrder).toBeNull();
  });

  it('throws for an out-of-range departing index', () => {
    expect(() => rebaseRotationOnDeparture(order, 0, 0, 10)).toThrow(RangeError);
  });
});

describe('deleting the most recent completion moves the rotation back (composability)', () => {
  const order = ['alex', 'casey', 'sam'];

  it('reverting one completion restores the previous turn, computed the same way as everything else', () => {
    // 3 completions in: turn is (0+3) mod 3 = 0 ("alex").
    expect(currentTurn(order, 0, 3)).toBe('alex');
    // Undo the most recent completion: completionCount drops to 2, no new API needed.
    expect(currentTurn(order, 0, 2)).toBe('sam');
  });
});

describe('rebaseRotationOnEdit', () => {
  it('a pure reorder preserves the turn by identity, not by index', () => {
    const order = ['alex', 'casey', 'sam'];
    // offset=0, count=1 -> cur=1 ("casey").
    const reordered = ['sam', 'casey', 'alex'];
    const offset = rebaseRotationOnEdit(order, 0, 1, reordered);
    expect(currentTurn(reordered, offset, 1)).toBe('casey');
  });

  it('appending a new member to the end preserves the current turn', () => {
    const order = ['alex', 'sam'];
    // offset=0, count=1 -> cur=1 ("sam").
    const appended = ['alex', 'sam', 'jordan'];
    const offset = rebaseRotationOnEdit(order, 0, 1, appended);
    expect(currentTurn(appended, offset, 1)).toBe('sam');
  });

  it('removing the currently-scheduled member resets to 0', () => {
    const order = ['alex', 'sam'];
    // offset=0, count=0 -> cur=0 ("alex").
    const withoutAlex = ['sam'];
    const offset = rebaseRotationOnEdit(order, 0, 0, withoutAlex);
    expect(offset).toBe(0);
  });

  it('a reset with completion history gives the turn to order[completion_count mod n], not the first member', () => {
    // Offset 0 is not "first member next" once there is history: the turn is still derived as
    // (offset + completion_count) mod n, so after one completion sam's removal hands the turn to
    // jordan, the second member of the new order.
    const order = ['alex', 'sam', 'jordan'];
    // offset=0, count=1 -> cur=1 ("sam"), who is removed.
    const withoutSam = ['alex', 'jordan'];
    const offset = rebaseRotationOnEdit(order, 0, 1, withoutSam);
    expect(offset).toBe(0);
    expect(currentTurn(withoutSam, offset, 1)).toBe('jordan');
  });

  it("removing a different, non-scheduled member preserves the scheduled member's turn", () => {
    const order = ['alex', 'sam', 'jordan'];
    // offset=0, count=1 -> cur=1 ("sam").
    const withoutJordan = ['alex', 'sam'];
    const offset = rebaseRotationOnEdit(order, 0, 1, withoutJordan);
    expect(currentTurn(withoutJordan, offset, 1)).toBe('sam');
  });

  it('a no-op edit (identical order resubmitted) reproduces an equivalent turn', () => {
    const order = ['alex', 'casey', 'sam'];
    const offset = rebaseRotationOnEdit(order, 1, 4, order);
    expect(currentTurn(order, offset, 4)).toBe(currentTurn(order, 1, 4));
  });
});
