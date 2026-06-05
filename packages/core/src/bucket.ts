import type { Bucket } from './types';

export function bucketize(values: number[], boundaries: number[]): Bucket[] {
  const edges = [0, ...boundaries, Infinity];
  const total = values.length;
  return edges.slice(0, -1).map((min, i) => {
    const max = edges[i + 1];
    const count = values.filter((v) => v >= min && v < max).length;
    return {
      label: max === Infinity ? `${min}+` : `${min}–${max}`,
      min,
      max,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    };
  });
}
