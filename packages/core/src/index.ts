import type { AnalyzeConfig, FocalStats, PhotoExif, SkippedFile } from './types';
import { aggregate } from './aggregate';
import { generateInsights } from './insights';

export function analyze(
  photos: PhotoExif[],
  config: AnalyzeConfig,
  preSkipped: SkippedFile[] = [],
): FocalStats {
  const base = aggregate(photos, config);
  const merged: Omit<FocalStats, 'insights'> = {
    ...base,
    scanned: base.scanned + preSkipped.length,
    skipped: [...preSkipped, ...base.skipped],
  };
  return { ...merged, insights: generateInsights(merged, config) };
}

export * from './types';
export { DEFAULT_CONFIG, parseConfig, validateConfig } from './config';
export { extractExif, mapTags } from './exif';
export { aggregate } from './aggregate';
export { generateInsights } from './insights';
