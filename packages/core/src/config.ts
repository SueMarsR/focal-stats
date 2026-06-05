import type { AnalyzeConfig } from './types';

export const DEFAULT_CONFIG: AnalyzeConfig = Object.freeze({
  mode: 'equiv35',
  bucketBoundaries: Object.freeze([16, 24, 35, 50, 70, 100, 200]) as number[],
  filterLens: null,
  filterCamera: null,
  primeThreshold: 0.6,
  topN: 3,
}) as AnalyzeConfig;

export function validateConfig(config: AnalyzeConfig): void {
  const b = config.bucketBoundaries;
  if (b.length === 0) throw new Error('bucketBoundaries 不能为空');
  if (b.some((x) => Number.isNaN(x))) throw new Error('bucketBoundaries 含无效数字 (NaN)');
  if (b.some((x) => x <= 0)) throw new Error('bucketBoundaries 必须为正数');
  for (let i = 1; i < b.length; i++) {
    if (b[i] <= b[i - 1]) {
      throw new Error(`bucketBoundaries 必须严格升序，发现 ${b[i - 1]} >= ${b[i]}`);
    }
  }
  if (Number.isNaN(config.primeThreshold) || config.primeThreshold < 0 || config.primeThreshold > 1) {
    throw new Error(`primeThreshold 必须在 0–1 之间，收到 ${config.primeThreshold}`);
  }
  if (!Number.isInteger(config.topN) || config.topN < 1) {
    throw new Error(`topN 必须为正整数，收到 ${config.topN}`);
  }
  if (config.mode !== 'raw' && config.mode !== 'equiv35') {
    throw new Error("mode 必须是 'raw' 或 'equiv35'");
  }
}

export function parseConfig(partial: Partial<AnalyzeConfig>): AnalyzeConfig {
  const config: AnalyzeConfig = { ...DEFAULT_CONFIG, ...partial };
  validateConfig(config);
  return config;
}
