export interface PhotoExif {
  name: string;
  focalLength: number | null;
  focalLength35mm: number | null;
  lensModel: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  fNumber: number | null;
}

export interface SkippedFile {
  name: string;
  reason: 'no-exif' | 'no-focal-length' | 'parse-error' | 'read-error';
}

export interface Bucket {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface GroupStat {
  key: string;
  count: number;
  topFocal: number;
}

export interface Insight {
  type: 'most-used' | 'prime-suggestion' | 'concentration' | 'data-quality';
  message: string;
  data?: Record<string, unknown>;
}

export interface FocalStats {
  mode: 'raw' | 'equiv35';
  total: number;
  scanned: number;
  equivFallbackCount: number;
  skipped: SkippedFile[];
  buckets: Bucket[];
  exact: { focal: number; count: number }[];
  topFocal: { focal: number; count: number; percentage: number }[];
  byLens: GroupStat[];
  byCamera: GroupStat[];
  insights: Insight[];
}

export interface AnalyzeConfig {
  mode: 'raw' | 'equiv35';
  bucketBoundaries: number[];
  filterLens: string | null;
  filterCamera: string | null;
  primeThreshold: number;
  topN: number;
}
