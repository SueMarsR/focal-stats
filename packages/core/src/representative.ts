import type { FocalStats } from './types';

export interface Representative {
  /** Most-common exact focal within the busiest bucket. */
  focal: number;
  /** Label of the busiest bucket, e.g. "100–200". */
  bucketLabel: string;
  /** Photos in the busiest bucket. */
  count: number;
  /** The busiest bucket's share of all analyzed photos. */
  percentage: number;
}

/**
 * The "most-used focal" headline: the busiest bucket's most-common exact focal.
 *
 * A single number that always sits on the histogram's peak — unlike the raw
 * most-repeated exact focal (`topFocal[0]`), which is noise for zoom data (every
 * frame a slightly different focal) and can disagree with where the mass actually is.
 * Returns null when there is no data.
 */
export function representativeFocal(
  stats: Pick<FocalStats, 'buckets' | 'exact'>,
): Representative | null {
  let top: FocalStats['buckets'][number] | null = null;
  for (const b of stats.buckets) {
    if (b.count > 0 && (top === null || b.count > top.count)) top = b;
  }
  if (!top) return null;

  // `exact` is sorted by count desc (then focal asc), so the first entry whose focal
  // falls in the busiest bucket is that bucket's most-common exact focal.
  const inBucket = stats.exact.find((e) => e.focal >= top!.min && e.focal < top!.max);
  const focal = inBucket
    ? inBucket.focal
    : Math.round(top.max === Infinity ? top.min : (top.min + top.max) / 2);

  return { focal, bucketLabel: top.label, count: top.count, percentage: top.percentage };
}
