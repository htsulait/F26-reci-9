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

// Obviously-correct reference: is point p inside any interval?
const covers = (xs: readonly Interval[], p: number) => xs.some(([s, e]) => s <= p && p <= e);

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

  // Pattern: invariant. The output is sorted, valid, and consecutive intervals neither overlap nor touch.
  it('output is sorted with strict gaps between intervals', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (const [s, e] of out) expect(s).toBeLessThanOrEqual(e);
        for (let i = 0; i + 1 < out.length; i++) expect(out[i][1]).toBeLessThan(out[i + 1][0]);
      }),
    );
  });

  // Pattern: differential. Input and output cover the same points, including half-integers.
  it('covers exactly the same points as the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (let p = -14; p <= 20; p += 0.5) expect(covers(out, p)).toBe(covers(xs, p));
      }),
    );
  });

  // Pattern: metamorphic. Reordering the input does not change the output.
  it('is independent of input order', () => {
    const listAndShuffle = intervalList.chain(xs =>
      fc.tuple(fc.constant(xs), fc.shuffledSubarray(xs, { minLength: xs.length, maxLength: xs.length })),
    );
    fc.assert(
      fc.property(listAndShuffle, ([xs, shuffled]) => {
        expect(mergeIntervals(shuffled)).toEqual(mergeIntervals(xs));
      }),
    );
  });
});
