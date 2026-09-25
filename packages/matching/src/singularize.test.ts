import { describe, expect, it } from 'vitest';
import { singularize } from './singularize.js';

describe('singularize', () => {
  const cases: [token: string, expected: string][] = [
    ['onions', 'onion'],
    ['eggs', 'egg'],
    ['peas', 'pea'],
    ['bananas', 'banana'],
    ['burritos', 'burrito'],
    ['tomatoes', 'tomato'],
    ['potatoes', 'potato'],
    ['peaches', 'peach'],
    ['squashes', 'squash'],
    ['boxes', 'box'],
    ['berries', 'berry'],
    ['glasses', 'glass'],
    ['leaves', 'leaf'],
    // Already singular, and the sibilant endings that would otherwise be mangled.
    ['chicken', 'chicken'],
    ['hummus', 'hummus'],
    ['couscous', 'couscous'],
    ['swiss', 'swiss'],
    ['molasses', 'molasses'],
    ['gas', 'gas'],
    ['ties', 'tie'],
  ];

  it.each(cases)('singularizes %j to %j', (token, expected) => {
    expect(singularize(token)).toBe(expected);
  });
});
