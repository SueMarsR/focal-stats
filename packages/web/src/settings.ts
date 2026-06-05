import { parseConfig, DEFAULT_CONFIG } from '@focal-stats/core';
import type { AnalyzeConfig } from '@focal-stats/core';

export function serializeConfig(config: AnalyzeConfig): string {
  return JSON.stringify(config);
}

export function parseStoredConfig(json: string): AnalyzeConfig {
  try {
    return parseConfig(JSON.parse(json) as Partial<AnalyzeConfig>);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
