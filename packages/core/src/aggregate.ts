import type { AnalyzeConfig, FocalStats, GroupStat, PhotoExif, SkippedFile } from './types';
import { bucketize } from './bucket';
import { normalizeFocal } from './normalize';

function matchesFilter(value: string | null, filter: string | null): boolean {
  if (filter == null || filter === '') return true;
  if (value == null) return false;
  return value.toLowerCase().includes(filter.toLowerCase());
}

function countTop(focals: number[]): { focal: number; count: number }[] {
  const map = new Map<number, number>();
  for (const f of focals) map.set(f, (map.get(f) ?? 0) + 1);
  return [...map.entries()]
    .map(([focal, count]) => ({ focal, count }))
    .sort((a, b) => b.count - a.count || a.focal - b.focal);
}

/** Most frequent non-null value, or null if none present. */
function modeOf(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) {
    best = v;
    bestN = n;
  }
  return best;
}

function groupBy(entries: { key: string | null; focal: number; make?: string | null }[]): GroupStat[] {
  const map = new Map<string, { focals: number[]; makes: (string | null)[] }>();
  for (const e of entries) {
    const key = e.key ?? '未知';
    const g = map.get(key);
    if (g) {
      g.focals.push(e.focal);
      g.makes.push(e.make ?? null);
    } else {
      map.set(key, { focals: [e.focal], makes: [e.make ?? null] });
    }
  }
  return [...map.entries()]
    .map(([key, g]) => ({
      key,
      count: g.focals.length,
      topFocal: countTop(g.focals)[0].focal,
      make: modeOf(g.makes),
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function aggregate(
  photos: PhotoExif[],
  config: AnalyzeConfig,
): Omit<FocalStats, 'insights'> {
  // Filters narrow analysis scope. `skipped` only reports data-quality issues
  // (no focal length) among filter-passing photos; photos excluded by an active
  // filter are out of scope by user intent and are not counted in `skipped`.
  const filtered = photos.filter(
    (p) =>
      matchesFilter(p.lensModel, config.filterLens) &&
      matchesFilter(p.cameraModel, config.filterCamera),
  );

  const usable: { focal: number; lens: string | null; camera: string | null; make: string | null }[] = [];
  const skipped: SkippedFile[] = [];
  let equivFallbackCount = 0;

  for (const p of filtered) {
    const { focal, fellBack } = normalizeFocal(p, config.mode);
    if (focal == null) {
      skipped.push({ name: p.name, reason: 'no-focal-length' });
      continue;
    }
    if (fellBack) equivFallbackCount++;
    usable.push({ focal, lens: p.lensModel, camera: p.cameraModel, make: p.cameraMake });
  }

  const total = usable.length;
  const focals = usable.map((u) => u.focal);
  const exact = countTop(focals);
  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10);

  return {
    mode: config.mode,
    total,
    scanned: photos.length,
    equivFallbackCount,
    skipped,
    buckets: bucketize(focals, config.bucketBoundaries),
    exact,
    topFocal: exact.slice(0, config.topN).map((e) => ({ ...e, percentage: pct(e.count) })),
    byLens: groupBy(usable.map((u) => ({ key: u.lens, focal: u.focal }))),
    byCamera: groupBy(usable.map((u) => ({ key: u.camera, focal: u.focal, make: u.make }))),
  };
}
