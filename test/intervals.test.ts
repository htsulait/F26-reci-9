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

// Already-disjoint, non-touching intervals in sorted order: each one starts
// at least 1 after the previous one ends (so there is a real gap).
const disjointSorted: fc.Arbitrary<Interval[]> = fc
  .tuple(
    fc.integer({ min: -15, max: 15 }),
    fc.array(fc.tuple(fc.integer({ min: 1, max: 3 }), fc.nat(4)), { maxLength: 8 }),
  )
  .map(([first, steps]) => {
    const out: Interval[] = [];
    let cursor = first;
    for (const [gap, len] of steps) {
      const start = out.length === 0 ? cursor : cursor + gap;
      out.push([start, start + len]);
      cursor = start + len;
    }
    return out;
  });

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

  // Pattern: algebraic. Merging is idempotent: merge(merge(xs)) equals merge(xs).
  it('merging an already-merged list changes nothing', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const once = mergeIntervals(xs);
        expect(mergeIntervals(once)).toEqual(once);
      }),
    );
  });

  // Pattern: conditional. If the input is already disjoint with gaps, the output is the sorted input.
  it('leaves disjoint, non-touching intervals as they are (sorted)', () => {
    const disjointShuffled = disjointSorted.chain(sorted =>
      fc.tuple(
        fc.constant(sorted),
        fc.shuffledSubarray(sorted, { minLength: sorted.length, maxLength: sorted.length }),
      ),
    );
    fc.assert(
      fc.property(disjointShuffled, ([sorted, shuffled]) => {
        expect(mergeIntervals(shuffled)).toEqual(sorted);
      }),
    );
  });

  // Pattern: invariant. The input array and its intervals are not modified, even when the output is.
  it('does not modify or alias the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const snapshot = structuredClone(xs);
        const out = mergeIntervals(xs);
        expect(xs).toEqual(snapshot);
        for (const iv of out) iv[1] += 100; // mutate output; input must not change
        expect(xs).toEqual(snapshot);
      }),
    );
  });
});
