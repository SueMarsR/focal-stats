import { describe, expect, it } from 'vitest';
import { bucketize } from './bucket';

describe('bucketize', () => {
  it('按边界分桶并算百分比', () => {
    const buckets = bucketize([10, 20, 20, 300], [16, 24, 200]);
    expect(buckets.map((b) => b.label)).toEqual(['0–16', '16–24', '24–200', '200+']);
    expect(buckets.map((b) => b.count)).toEqual([1, 2, 0, 1]);
    expect(buckets[1].percentage).toBe(50);
  });
  it('空输入百分比为 0 不除零', () => {
    const buckets = bucketize([], [24]);
    expect(buckets.every((b) => b.percentage === 0 && b.count === 0)).toBe(true);
  });
  it('边界值归入右侧桶（左闭右开）', () => {
    const buckets = bucketize([24], [24]);
    expect(buckets[0].count).toBe(0);
    expect(buckets[1].count).toBe(1);
  });
  it('值等于下界 0 归入首桶', () => {
    const buckets = bucketize([0], [24]);
    expect(buckets[0].count).toBe(1); // [0,24)
    expect(buckets[0].label).toBe('0–24'); // en-dash U+2013
  });
});
