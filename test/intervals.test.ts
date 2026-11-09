import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

// Construct valid intervals directly: start <= end by building end = start + length.
// A small range makes shared endpoints, duplicates and adjacent integers common;
// it includes negatives and multi-digit numbers so ordering bugs show up.
const interval: fc.Arbitrary<Interval> = fc
  .tuple(fc.integer({ min: -12, max: 12 }), fc.nat(6))
  .map(([start, len]): Interval => [start, start + len]);
const intervalList = fc.array(interval, { maxLength: 10 });

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        const uncovered = xs.filter(([s, e]) => !out.some(([a, b]) => a <= s && e <= b));
        expect(uncovered).toEqual([]);
      }),
    );
  });
});
